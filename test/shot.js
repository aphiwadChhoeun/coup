/* Headless Chrome screenshot helper (dev only).
   Usage: node test/shot.js --out=shots/title.png --width=1440 --height=900 --url=http://localhost:4173 [--script=...] [--wait=2000] [--wait-for="#dock.visible"] */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = {};
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([^=]+)=(.*)$/);
  if (m) args[m[1]] = m[2];
  else if (arg.startsWith('--')) args[arg.slice(2)] = true;
}

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const width = Number(args.width || 1440);
const height = Number(args.height || 900);
const url = args.url || 'http://localhost:4173';
const out = path.resolve(args.out || 'shots/shot.png');
const wait = Number(args.wait || 1500);
const script = args.script ? fs.readFileSync(path.resolve(args.script), 'utf8') : null;
const waitFor = args['wait-for'] || null;
const waitTimeout = Number(args['wait-timeout'] || 20000);
const port = 9200 + Math.floor(Math.random() * 500);
const profile = path.join(os.tmpdir(), `coup-shot-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--mute-audio',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let version = null;
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      version = await res.json();
      break;
    } catch (e) {
      await sleep(100);
    }
  }
  if (!version) throw new Error('Chrome did not start');

  let pageTarget = null;
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      pageTarget = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTarget) break;
    } catch (e) { /* retry */ }
    await sleep(100);
  }
  if (!pageTarget) throw new Error('No page target');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 1;
  const pending = new Map();
  ws.onmessage = event => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: !!args.mobile
  });
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }]
  });
  await send('Page.navigate', { url });

  for (let i = 0; i < 120; i++) {
    const ready = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true });
    if (ready.result.value === 'complete') break;
    await sleep(100);
  }
  await sleep(400);

  if (script) {
    const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) console.error('Script error:', res.exceptionDetails.text);
  }

  if (waitFor) {
    const started = Date.now();
    while (Date.now() - started < waitTimeout) {
      const res = await send('Runtime.evaluate', {
        expression: `!!document.querySelector(${JSON.stringify(waitFor)})`,
        returnByValue: true
      });
      if (res.result.value) break;
      await sleep(120);
    }
  }

  await sleep(wait);

  if (args.measure) {
    const m = await send('Runtime.evaluate', { expression: args.measure, returnByValue: true, awaitPromise: true });
    console.log('MEASURE', JSON.stringify(m.result?.value ?? m.exceptionDetails, null, 2));
  }

  const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`Saved ${out} (${width}x${height})`);

  ws.close();
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
