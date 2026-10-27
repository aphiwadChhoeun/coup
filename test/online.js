/* Online room integration test (requires `wrangler dev` on port 8787).
   Usage: node test/online.js [baseUrl] */
const BASE = process.argv[2] || process.env.COUP_BASE || 'http://127.0.0.1:8787';
const WS_BASE = BASE.replace(/^http/, 'ws');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 5; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function defaultDecision(decision) {
  switch (decision.kind) {
    case 'action': {
      const actions = (decision.actions || []).filter(a => a.enabled !== false);
      const income = actions.find(a => a.type === 'income');
      if (income) return { type: 'income' };
      const coup = actions.find(a => a.type === 'coup');
      if (coup && decision.targets?.length) return { type: 'coup', targetId: decision.targets[0].id };
      const a = actions[0];
      if (!a) return null;
      return a.target && decision.targets?.length
        ? { type: a.type, targetId: decision.targets[0].id }
        : { type: a.type };
    }
    case 'challenge': return false;
    case 'block': return null;
    case 'loseInfluence': return decision.options[0].index;
    case 'exchange': return decision.options.slice(0, decision.keepCount).map((_, i) => i);
    default: return null;
  }
}

class Client {
  constructor(name) {
    this.name = name;
    this.token = crypto.randomUUID();
    this.messages = [];
    this.ws = null;
    this.paused = false;
    this.closed = false;
    this.youSeat = null;
    this.states = [];
    this.prompts = [];
    this.gameStartCount = 0;
    this.gameover = null;
    this.errors = [];
    this.hiddenLeaks = [];
    this.onGameOverResolve = null;
    this.gameOverPromise = new Promise(resolve => { this.onGameOverResolve = resolve; });
  }

  connect(code, { create = false } = {}) {
    return new Promise((resolve, reject) => {
      const url = `${WS_BASE}/api/rooms/${code}/ws?name=${encodeURIComponent(this.name)}&token=${encodeURIComponent(this.token)}${create ? '&create=1' : ''}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      this.closed = false;
      const timer = setTimeout(() => reject(new Error(`${this.name}: connect timeout`)), 10_000);

      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
      });
      ws.addEventListener('close', event => {
        this.closed = true;
        if (event.code === 4004) return;
      });
      ws.addEventListener('message', event => {
        let msg;
        try { msg = JSON.parse(event.data); } catch (e) { return; }
        this.messages.push(msg);
        this.handle(msg);
      });
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(data));
  }

  handle(msg) {
    if (msg.type === 'error') {
      this.errors.push(msg);
      return;
    }
    if (msg.type === 'gameover') {
      this.gameover = msg;
      this.onGameOverResolve?.(msg);
      return;
    }
    if (msg.type === 'gameStart') {
      this.youSeat = msg.youSeat;
      this.gameStartCount++;
      if (process.env.DEBUG) console.log(this.name, 'gameStart', this.youSeat, 'turn', msg.state?.turnCount);
      this.checkState(msg.state, 'gameStart');
      return;
    }
    if (msg.type === 'state') {
      if (process.env.DEBUG) console.log(this.name, 'state turn', msg.state?.turnCount, 'turnIndex', msg.state?.turnIndex);
      this.checkState(msg.state, 'state');
      return;
    }
    if (msg.type === 'prompt') {
      this.prompts.push(msg);
      this.checkPrompt(msg);
      if (process.env.DEBUG) console.log(this.name, 'prompt', msg.promptId, msg.decision.kind, 'seat', this.youSeat);
      if (this.paused) return;
      setTimeout(() => {
        if (this.paused) return;
        const value = defaultDecision(msg.decision);
        if (process.env.DEBUG) console.log(this.name, '-> decision', msg.promptId, JSON.stringify(value));
        this.send({ type: 'decision', promptId: msg.promptId, value });
      }, 15);
    }
    if (msg.type === 'log' && process.env.DEBUG) {
      const text = String(msg.entry?.html || '').replace(/<[^>]+>/g, '').slice(0, 120);
      console.log(this.name, 'LOG', msg.entry?.label || text);
    }
    if (msg.type === 'banner' && process.env.DEBUG) {
      console.log(this.name, 'BANNER', msg.banner?.title, '-', msg.banner?.sub);
    }
  }

  checkState(state, source) {
    if (!state) return;
    this.states.push(state);
    if (this.youSeat == null) this.youSeat = state.youSeat;
    for (const player of state.players) {
      for (const card of player.cards) {
        if (player.id !== this.youSeat && !card.revealed && !card.proven && card.role !== null) {
          this.hiddenLeaks.push({ source, player: player.id, role: card.role, viewer: this.youSeat });
        }
      }
    }
  }

  checkPrompt(msg) {
    const view = msg.decision?.view;
    if (!view) return;
    for (const player of view.players || []) {
      if (player.cards || player.hidden) {
        this.hiddenLeaks.push({ source: 'prompt-view', player: player.id });
      }
    }
    for (const target of msg.decision.targets || []) {
      if (target.cards || target.role) {
        this.hiddenLeaks.push({ source: 'prompt-target', target: target.id });
      }
    }
  }

  async waitFor(type, timeout = 15_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const found = this.messages.find(m => m.type === type && !m.__seen);
      if (found) { found.__seen = true; return found; }
      await sleep(30);
    }
    throw new Error(`${this.name}: timed out waiting for ${type}`);
  }

  async waitForLobbySeats(count, timeout = 10_000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      const lobbies = this.messages.filter(m => m.type === 'lobby' && (m.room?.seats?.length === count));
      const found = lobbies.find(m => !m.__seatSeen);
      if (found) { found.__seatSeen = true; return found; }
      await sleep(30);
    }
    throw new Error(`${this.name}: timed out waiting for a ${count}-seat lobby`);
  }

  async reconnect(code) {
    this.paused = false;
    await this.connect(code, { create: false });
    const welcome = await this.waitFor('welcome', 10_000);
    return welcome;
  }

  close() {
    try { this.ws?.close(1000, 'test over'); } catch (e) { /* ignore */ }
  }
}

async function main() {
  const code = randomCode();
  console.log('Room', code, 'on', BASE);

  const a = new Client('Ada');
  await a.connect(code, { create: true });
  await a.waitFor('welcome');
  await a.waitFor('lobby');
  console.log('OK 1 — host created the room');

  const b = new Client('Bram');
  await b.connect(code);
  await b.waitFor('welcome');
  await b.waitFor('lobby');
  await a.waitForLobbySeats(2);
  console.log('OK 2 — second human joined');

  a.send({ type: 'addBot' });
  await a.waitForLobbySeats(3);
  await b.waitForLobbySeats(3);
  a.send({ type: 'addBot' });
  await a.waitForLobbySeats(4);
  await b.waitForLobbySeats(4);
  console.log('OK 3 — AI seats filled the table');

  a.send({ type: 'start' });
  await a.waitFor('gameStart');
  await b.waitFor('gameStart');
  console.log('OK 4 — game started for both humans');

  // A spectator/new player must not be able to join a running game.
  const c = new Client('Late');
  await c.connect(code);
  const lateError = await c.waitFor('error');
  if (!/already started/i.test(lateError.message)) {
    throw new Error(`Unexpected late-join error: ${lateError.message}`);
  }
  c.close();
  console.log('OK 5 — late join rejected during a running game');

  // Drop Bram and reconnect with the same token; the server must restore the seat.
  await sleep(900);
  b.close();
  await sleep(500);
  b.messages = b.messages.filter(m => m.type !== 'gameStart' && m.type !== 'welcome');
  await b.reconnect(code);
  await b.waitFor('gameStart', 10_000);
  console.log('OK 6 — player reconnected with the saved token');

  const deadline = Date.now() + 120_000;
  while (!a.gameover && Date.now() < deadline) await sleep(200);
  if (!a.gameover) {
    console.log('DEBUG snapshots', {
      aStates: a.states.length,
      bStates: b.states.length,
      aPrompts: a.prompts.length,
      bPrompts: b.prompts.length,
      aLast: a.states.at(-1)?.turnCount,
      bLast: b.states.at(-1)?.turnCount,
      errors: [a.errors, b.errors]
    });
    throw new Error('Game did not finish within 120s');
  }
  await b.gameOverPromise;
  console.log('OK 7 — game reached a winner over the wire');

  for (const client of [a, b]) {
    if (client.hiddenLeaks.length) {
      throw new Error(`${client.name}: hidden card leak ${JSON.stringify(client.hiddenLeaks.slice(0, 3))}`);
    }
    if (!client.states.length) throw new Error(`${client.name}: no states received`);
    const expectedStarts = client === b ? 2 : 1;
    if (client.gameStartCount < expectedStarts) throw new Error(`${client.name}: missing reconnect gameStart`);
  }
  console.log('OK 8 — private hands and prompt payloads stayed private');
  console.log('OK 9 — both clients rehydrated from gameStart');

  a.messages = [];
  b.messages = [];
  a.send({ type: 'toLobby' });
  await a.waitFor('lobby', 10_000);
  await b.waitFor('lobby', 10_000);
  console.log('OK 10 — host returned the room to the lobby');

  a.send({ type: 'leave' });
  b.send({ type: 'leave' });
  a.close();
  b.close();
  console.log('All online room tests passed.');
}

main().catch(err => {
  console.error('FAILED:', err.stack || err);
  process.exit(1);
});
