/* Build the server-side rules module from the shared browser engine.
   The client stays a classic-script app; the Worker needs an ES module. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const files = ['public/js/cards.js', 'public/js/ai.js', 'public/js/engine.js'];
const source = files
  .map(file => `/* ---- ${file} ---- */\n${fs.readFileSync(path.join(root, file), 'utf8')}`)
  .join('\n\n');

const exported = ['ROLES', 'CHARACTERS', 'CoupGame', 'CoupAI', 'cardFrontHTML', 'cardBackHTML', 'roleIcon', 'esc', 'shuffle', 'sleep'];

const out = `/* AUTO-GENERATED FILE — do not edit by hand.
   Source: public/js/cards.js + public/js/ai.js + public/js/engine.js
   Regenerate with: npm run worker:build
   The Worker uses this module as the authoritative game engine. */

${source}

export {
  ${exported.join(',\n  ')}
};
`;

const target = path.join(root, 'worker', 'generated', 'game.js');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, out, 'utf8');
console.log(`Wrote ${path.relative(root, target)} (${(out.length / 1024).toFixed(1)} KB)`);
