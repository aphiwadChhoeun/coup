/* Lightweight structural checks (dev).
   Usage: node test/check.js */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
let balance = 0;
let min = 0;
for (const ch of css) {
  if (ch === '{') balance++;
  else if (ch === '}') { balance--; if (balance < min) min = balance; }
}
console.log('CSS braces:', balance, '| min depth:', min);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log('HTML ids:', ids.length, '| duplicates:', dupes);
console.log('HTML divs open/close:', (html.match(/<div/g) || []).length, (html.match(/<\/div>/g) || []).length);

const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const missing = scripts.filter(src => !fs.existsSync(path.join(root, src)));
console.log('Scripts:', scripts.length, '| missing:', missing);

const js = fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8') + fs.readFileSync(path.join(root, 'js/main.js'), 'utf8');
const refs = new Set([...js.matchAll(/[$(]'([A-Za-z][A-Za-z0-9_-]+)'\)/g)].map(m => m[1]));
const staticRefs = [...refs].filter(r => r !== '');
const unknown = staticRefs.filter(r => !ids.includes(r) && !/^(activity|swap|select|chart|join|toFixed|includes|push|remove|open)$/.test(r));
console.log('Static id refs:', staticRefs.length, '| not in index.html:', unknown);

let ok = balance === 0 && dupes.length === 0 && missing.length === 0;
if (!ok) process.exit(1);
