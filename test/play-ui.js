/* Drives a full game through the DOM in headless Chrome.
   Captures each prompt type and reports console/runtime errors.
   Usage: node test/play-ui.js [width] [height] */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const width = Number(process.argv[2] || 1440);
const height = Number(process.argv[3] || 900);
const port = 9700 + Math.floor(Math.random() * 200);
const profile = path.join(os.tmpdir(), `coup-ui-${Date.now()}-${Math.random().toString(16).slice(2)}`);
const outDir = path.resolve('shots');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--disable-extensions',
    '--no-first-run', '--no-default-browser-check', '--mute-audio',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, 'about:blank'
  ], { stdio: 'ignore' });

  let target = null;
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      target = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (target) break;
    } catch (e) { /* retry */ }
    await sleep(100);
  }
  if (!target) throw new Error('No Chrome page target');

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let nextId = 1;
  const pending = new Map();
  const errors = [];
  const consoleErrors = [];

  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map(a => a.value || a.description).join(' '));
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  };
  const capture = async name => {
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, name + '.png');
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('  captured', file);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await send('Page.navigate', { url: 'http://localhost:4173' });
  for (let i = 0; i < 100; i++) {
    if (await evaluate('document.readyState') === 'complete') break;
    await sleep(100);
  }
  await sleep(400);

  await evaluate(`
    window.__errs = [];
    window.addEventListener('error', e => window.__errs.push(e.message));
    window.addEventListener('unhandledrejection', e => window.__errs.push(String(e.reason)));
    document.getElementById('nameInput').value = 'Aphiwe';
    document.getElementById('startBtn').click();
  `);

  const seen = new Set();
  const deadline = Date.now() + 180000;
  let turnsSeen = 0;

  const inspect = await evaluate(`
    (() => {
      const dock = document.getElementById('dock');
      const visible = dock.classList.contains('visible');
      const state = {
        over: !!document.querySelector('.gameover-panel'),
        exchange: !!document.querySelector('.modal-panel--exchange'),
        action: visible && !!document.querySelector('.action-btn'),
        target: visible && !!document.querySelector('.target-btn'),
        challenge: visible && !!document.querySelector('.dock--challenge'),
        block: visible && !!document.querySelector('.dock--block'),
        lose: visible && !!document.querySelector('.dock--lose'),
        turn: document.getElementById('statusSub')?.textContent || '',
        errs: window.__errs.slice()
      };
      return state;
    })()
  `);

  while (Date.now() < deadline) {
    const state = await evaluate(`
      (() => {
        const dock = document.getElementById('dock');
        const visible = dock.classList.contains('visible');
        return {
          over: !!document.querySelector('.gameover-panel'),
          exchange: !!document.querySelector('.modal-panel--exchange'),
          action: visible && !!document.querySelector('.action-btn'),
          target: visible && !!document.querySelector('.target-btn'),
          challenge: visible && !!document.querySelector('.dock--challenge'),
          block: visible && !!document.querySelector('.dock--block'),
          lose: visible && !!document.querySelector('.dock--lose'),
          logLines: document.querySelectorAll('.log-entry').length,
          errs: window.__errs.slice()
        };
      })()
    `);

    if (state.errs.length) throw new Error('Page error: ' + state.errs.join(' | '));
    turnsSeen = state.logLines;

    let kind = null;
    if (state.over) kind = 'gameover';
    else if (state.exchange) kind = 'exchange';
    else if (state.challenge) kind = 'challenge';
    else if (state.block) kind = 'block';
    else if (state.lose) kind = 'lose';
    else if (state.target) kind = 'target';
    else if (state.action) kind = 'action';

    if (kind && !seen.has(kind)) {
      seen.add(kind);
      await sleep(kind === 'gameover' ? 1200 : 350);
      await capture('ui-' + kind + (width < 600 ? '-mobile' : ''));
    }

    if (state.over) break;

    if (state.exchange) {
      await evaluate(`document.getElementById('exchangeConfirm')?.click()`);
    } else if (state.action) {
      // Cycle through action types so every prompt path is exercised.
      const clicked = await evaluate(`
        (() => {
          const buttons = [...document.querySelectorAll('.action-btn:not([disabled])')];
          if (!buttons.length) return false;
          window.__tried = window.__tried || new Set();
          const order = ['exchange', 'steal', 'coup', 'assassinate', 'tax', 'foreignAid', 'income'];
          let pick = null;
          for (const type of order) {
            pick = buttons.find(b => b.dataset.action === type && !window.__tried.has(type));
            if (pick) break;
          }
          if (!pick) pick = buttons[Math.floor(Math.random() * buttons.length)];
          window.__tried.add(pick.dataset.action);
          pick.click();
          return pick.dataset.action;
        })()
      `);
      if (clicked) console.log('  action:', clicked);
    } else if (state.target) {
      const picked = await evaluate(`
        (() => {
          const targets = [...document.querySelectorAll('.target-btn')];
          if (!targets.length) return null;
          const t = targets[Math.floor(Math.random() * targets.length)];
          t.click();
          return t.querySelector('.target-name')?.textContent;
        })()
      `);
      if (picked) console.log('  target:', picked);
    } else if (state.challenge) {
      const doChallenge = Math.random() < 0.28;
      await evaluate(`document.getElementById('${doChallenge ? 'challengeYes' : 'challengeNo'}')?.click()`);
      console.log('  challenge:', doChallenge ? 'yes' : 'allow');
    } else if (state.block) {
      const blocks = await evaluate(`[...document.querySelectorAll('[data-block]')].map(b => b.dataset.block)`);
      const doBlock = blocks.length && Math.random() < 0.5;
      if (doBlock) await evaluate(`document.querySelector('[data-block]').click()`);
      else await evaluate(`document.getElementById('blockNo')?.click()`);
      console.log('  block:', doBlock ? blocks[0] : 'allow');
    } else if (state.lose) {
      await evaluate(`document.querySelector('.lose-role')?.click()`);
      console.log('  lost influence');
    } else {
      await sleep(180);
    }
    await sleep(160);
  }

  const final = await evaluate(`({
    over: !!document.querySelector('.gameover-panel'),
    title: document.querySelector('.gameover-title')?.textContent,
    sub: document.querySelector('.gameover-sub')?.textContent,
    standings: document.querySelectorAll('.standing').length,
    errs: window.__errs
  })`);
  console.log('Seen prompts:', [...seen].join(', '));
  console.log('Final:', final);
  if (errors.length) console.error('Runtime exceptions:', errors);
  if (consoleErrors.length) console.error('Console errors:', consoleErrors);
  if (!final.over) throw new Error('Game did not reach the game over screen');

  ws.close();
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  return { errors: errors.length, consoleErrors: consoleErrors.length };
}

main().then(r => {
  if (r.errors || r.consoleErrors) process.exit(1);
  console.log('UI playthrough OK');
}).catch(err => {
  console.error(err);
  process.exit(1);
});
