# Coup

A complete, single-player web version of **Coup** — the bluffing card game about influence, deception and nerve. Play against 2–5 sharp AI courtiers at a candlelit table.

No build step, no dependencies. Just open it and play.

## Run it

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

You can also open `index.html` directly in a browser — every script is a classic script, so `file://` works too. The only network request is the optional Google Font, which falls back gracefully if offline.

## What's included

- **Complete Coup rules**
  - Income, Foreign Aid, Coup, Tax, Assassinate, Steal, Exchange
  - Challenge windows for every character claim
  - Duke / Contessa / Captain / Ambassador blocks, including challenges to blocks
  - Costs paid, refunded on a caught bluff, and kept when an action is blocked
  - Forced coup at 10+ coins
  - Choose which influence to surrender; last player standing wins
- **3–6 players** — you plus up to five AI opponents
- **Three difficulty levels** — Courtier, Noble, Assassin — with different challenge thresholds and nerve
- **AI that bluffs and reads the table** — probability-based challenge decisions, bluff-aware blocks, target selection and influence-keeping heuristics
- **A cinematic table** — velvet felt, hand-drawn SVG crests, gold-stamped cards with 3D flips, animated coins, challenge/block/reveal effects and a victory confetti storm
- **Synthesized sound design** — coins, flips, challenges, gongs and a victory fanfare, generated in the browser with no audio assets
- **Responsive** — desktop, phone portrait, phone landscape, plus a slide-up table log and compact six-player layouts
- **A running table log** with every claim, challenge and consequence, plus a court reference card

## How to play

Be the last player with a face-down influence card.

Each player starts with **2 coins** and **2 influence cards**. There are three copies of each of five characters in the court deck.

On your turn, take one action:

| Action | Cost | Effect |
| --- | --- | --- |
| Income | — | Take 1 coin |
| Foreign Aid | — | Take 2 coins (a Duke may block) |
| Coup | 7 | Force an influence loss (cannot be challenged or blocked) |
| Tax — Duke | — | Take 3 coins |
| Assassinate — Assassin | 3 | Force an influence loss (a Contessa may block) |
| Steal — Captain | — | Take 2 coins (a Captain or Ambassador may block) |
| Exchange — Ambassador | — | Draw 2, keep what you want, return 2 |

You may claim any character, whether or not you hold it. Anyone may challenge a claim. If the claimant holds the character, the challenger loses an influence and the revealed card is replaced from the deck. If not, the claimant loses an influence and the action fails.

At **10+ coins**, your only action is Coup.

## Controls

Everything is clickable. On the title screen choose your name, seat count and difficulty. A few conveniences:

- `Enter` on the name field starts the game
- `Esc` closes the rules or game menu
- The top-right buttons handle the rules, sound, table log and game menu
- Exchange cards are keyboard-selectable (`Tab`, then `Enter`/`Space`)

## Project layout

```
index.html          Markup and SVG iconography
css/style.css       Visual system, cards, table, responsive layout, motion
js/cards.js         Characters, card artwork, shared helpers
js/ai.js            AI opponents
js/engine.js        Rules engine and async decision flow
js/ui.js            Table rendering, prompts, log, modals
js/sound.js         Web Audio sound design
js/main.js          Title screen and game lifecycle
serve.js            Tiny static server for local play
test/sim.js         Headless engine simulation and invariant checks
test/scenarios.js   Targeted rules edge-case tests
test/play-ui.js     End-to-end UI bot (needs Chrome + the local server)
test/shot.js        Headless screenshot helper used during development
test/check.js       Structural checks for CSS braces, HTML ids and script paths
```

## Tests

```bash
npm test
```

This runs 200 headless games across all seat counts and difficulties, checking that games terminate, exactly one player wins, all 15 cards stay accounted for, no player has extra cards, and coins never go negative. It then runs four targeted scenarios: an eliminated target, a refunded bluff, a proven block, and a mandatory coup.

For the UI bot, start the server first, then:

```bash
node test/play-ui.js 1440 900
node test/play-ui.js 390 844
```

The bot plays through a real game in headless Chrome, opens every prompt type, and fails on any page error. Set `CHROME=/path/to/chrome` if Chrome isn't at the default Windows path.

`npm run check` performs a quick structural sanity pass over the CSS, HTML and script references.

## Notes

- Sound starts on your first click, as required by browsers.
- Settings (name, seat count, difficulty, mute) are stored in `localStorage`.
- Append `#debug` to the URL to expose `window.__coup` for tinkering.
