# Coup

A complete web version of **Coup** — the bluffing card game about influence, deception and nerve. Play locally against AI courtiers, or host a private online room for 3–6 friends.

No build step for the game itself, no runtime dependencies. Online rooms run on Cloudflare Workers + Durable Objects, and fit within Cloudflare's **free plan** for casual use.

## Play

### Solo vs AI

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000).

You can also open `public/index.html` directly — every client script is a classic script, so `file://` works. The only network request is the optional Google Font, which falls back gracefully.

### Online rooms locally

Online play needs the Cloudflare Worker (the static server has no WebSocket backend):

```bash
npm install
npm run dev
```

Open [http://localhost:8787](http://localhost:8787), choose **Play online**, and create a room. Open the invite link or enter the room code in another browser to join.

### Deploy online to Cloudflare

```bash
npm install
npx wrangler login
npm run deploy
```

Wrangler prints your `https://coup-online.<your-subdomain>.workers.dev` URL. Static assets, the Worker and the Durable Object are all deployed together — no Pages project, database or KV setup required.

To use a custom domain, add it to the Worker in the Cloudflare dashboard.

## What's included

- **Complete Coup rules**
  - Income, Foreign Aid, Coup, Tax, Assassinate, Steal, Exchange
  - Challenge windows for every character claim
  - Duke / Contessa / Captain / Ambassador blocks, and challenges to blocks
  - Costs paid, refunded on a caught bluff, and kept when an action is blocked
  - Forced coup at 10+ coins
  - Choose which influence to surrender; last player standing wins
- **Solo mode** against 2–5 AI opponents with three difficulty levels
- **Online rooms for 3–6 players**
  - Share a five-letter code or invite link
  - Host can add AI seats to fill the table
  - Server-authoritative rules: no client ever receives another player's hidden hand
  - Per-player prompts with decision timers, and automatic safe defaults if someone goes AFK
  - Reconnect with your saved seat; game state is rehydrated from the server
  - Rematch and back-to-lobby flows
- **A cinematic table** — velvet felt, hand-drawn SVG crests, gold-stamped cards with 3D flips, animated coins, challenge flashes, reveal stamps and a victory confetti storm
- **Casino-table sound design** — synthesized chip clinks, card riffles, roulette ticks, table bells and a jackpot fanfare, generated in the browser with no audio assets
- **Responsive** — desktop, tablet, phone portrait and phone landscape, with compact six-player layouts and a slide-up table log
- **A running table log** with every claim, challenge and consequence, plus a court reference card

## How to play

Be the last player with a face-down influence card.

Each player starts with **2 coins** and **2 influence cards**. The court deck holds three copies of each of five characters.

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

## Online details

- **Room code** — five characters, excluding ambiguous letters. Share the code or the `?room=CODE` link.
- **Host powers** — add/remove AI seats, choose AI difficulty, start the game, return the room to the lobby, or start a rematch.
- **AI seats** — bots use the same `CoupAI` as solo play. A two-person group can start with one AI.
- **Decision timers** — 60s actions, 20s challenges/blocks, 30s influence choices, 45s exchanges. A timeout auto-plays a safe default so the table never stalls.
- **Reconnects** — the browser stores a room token in `localStorage`. Refreshing or dropping the socket lets you rejoin the same seat while the room is alive.
- **Private hands** — the server builds a separate state and prompt payload for each player. Other players' face-down cards are sent as `null`.
- **Room lifecycle** — the game engine lives in memory in the room's Durable Object while players are connected. If every player disconnects and the Durable Object is evicted, the room returns to the lobby; start a new game. There are no spectators.

### Cloudflare cost

The project is designed for the **Workers Free** plan:

- Static assets: free
- Workers requests: 100,000/day
- Durable Object requests: 100,000/day (incoming WebSocket messages are billed at 20:1)
- Durable Object duration: 13,000 GB-s/day (about 28 room-hours/day at 128 MB)
- SQLite storage: free limits are ample for lobby metadata and reconnect tokens
- No KV, D1, R2, Queues or paid add-ons

A normal evening with one or two rooms is comfortably free. If you run many simultaneous rooms for long periods, the Workers Paid plan starts at $5/month and removes the daily caps.

## Controls

Everything is clickable.

- `Enter` on the name field starts a solo game
- `Esc` closes the rules or game menu
- The top-right buttons handle rules, sound, table log and the game menu
- Exchange cards are keyboard-selectable (`Tab`, then `Enter`/`Space`)
- In an online game, the top-right menu button offers **Leave room**

## Project layout

```
public/index.html          Markup and SVG iconography
public/css/style.css       Visual system, cards, table, responsive layout, motion
public/js/cards.js         Characters, card artwork, shared helpers
public/js/ai.js            AI opponents
public/js/engine.js        Rules engine and async decision flow
public/js/ui.js            Table rendering, prompts, log, modals
public/js/online.js        Online rooms client, lobby and reconnect flow
public/js/sound.js         Web Audio sound design
public/js/main.js          Title screen and game lifecycle
worker/index.js            Cloudflare Worker entry and room routing
worker/room.js             Durable Object: lobby, WebSocket protocol, server game
worker/generated/game.js   Auto-generated server copy of the rules engine
scripts/build-engine.mjs   Generates worker/generated/game.js
wrangler.jsonc             Cloudflare Workers + Durable Objects config
serve.js                   Tiny static server for solo local play
test/                      Engine, rules, protocol and UI tests
```

The server engine is generated from the same source as the browser engine. After changing `cards.js`, `ai.js` or `engine.js`, run:

```bash
npm run worker:build
```

The generated file is committed so `wrangler deploy` works without a separate build step; the deploy script rebuilds it anyway.

## Tests

```bash
npm test
```

Runs 200 headless engine games across all seat counts and difficulties, checking that games terminate, exactly one player wins, all 15 cards stay accounted for, no player has extra cards, and coins never go negative. It then runs four targeted scenarios: an eliminated target, a refunded bluff, a proven block, and a mandatory coup.

```bash
npm run check
```

Quick structural checks for CSS braces, duplicate HTML ids and script paths.

### Online protocol tests

Start the Worker locally first:

```bash
npm run dev
```

In another terminal:

```bash
npm run test:online
```

This creates a room, joins a second human, adds AI seats, starts a game, rejects a late join, verifies that hidden hands never leak through state or prompt payloads, drops and reconnects a player with the saved token, plays to a winner, and returns the room to the lobby.

### UI bot

With a server running (solo static server or Wrangler):

```bash
node test/play-ui.js 1440 900
node test/play-ui.js 390 844
```

The bot plays through a real game in headless Chrome and fails on any page error. Set `COUP_URL` to point it somewhere else (defaults to `http://localhost:3000`). Set `CHROME=/path/to/chrome` if Chrome is not at the default Windows path.

## Notes

- Sound starts on your first click, as required by browsers.
- Solo settings (name, seat count, difficulty, mute) are stored in `localStorage`.
- Online rooms use a per-room reconnect token, also in `localStorage`.
- Append `#debug` to the URL to expose `window.__coup` and `window.__coupOnline` for tinkering.
