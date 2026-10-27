import { CoupGame, esc } from './generated/game.js';

const MAX_PLAYERS = 6;
const MIN_PLAYERS = 3;
const COLORS = ['#d7b46a', '#d97b9e', '#7fa7cf', '#79b98b', '#d3a34c', '#b08ad6'];
const DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const STALE_MS = 30 * 60 * 1000;

const BOT_ROSTER = [
  { name: 'Vesper', profile: { title: 'The Gambler', bluff: 0.78, skeptic: 0.36, aggression: 0.62 } },
  { name: 'Rook', profile: { title: 'The Ironclad', bluff: 0.32, skeptic: 0.68, aggression: 0.48 } },
  { name: 'Lysandra', profile: { title: 'The Widow', bluff: 0.52, skeptic: 0.5, aggression: 0.34 } },
  { name: 'Baron Vex', profile: { title: 'The Usurper', bluff: 0.6, skeptic: 0.44, aggression: 0.82 } },
  { name: 'Mirabel', profile: { title: 'The Fox', bluff: 0.55, skeptic: 0.62, aggression: 0.56 } }
];

const TIMEOUT_MS = {
  action: 60_000,
  challenge: 20_000,
  block: 20_000,
  loseInfluence: 30_000,
  exchange: 45_000
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function now() {
  return Date.now();
}

function cleanName(value) {
  const name = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 14);
  return name || 'Player';
}

function cleanToken(value) {
  const token = String(value ?? '').trim();
  return /^[A-Za-z0-9_-]{8,80}$/.test(token) ? token : '';
}

function validCode(code) {
  return /^[A-Z0-9]{4,8}$/.test(code);
}

function send(ws, data) {
  try {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(data));
  } catch (e) {
    // A socket can close between the readyState check and send.
  }
}

function uniqueName(room, rawName) {
  const name = cleanName(rawName);
  const used = new Set([...room.players, ...room.bots].map(p => p.name.toLowerCase()));
  if (!used.has(name.toLowerCase())) return name;
  let i = 2;
  while (used.has(`${name} ${i}`.toLowerCase())) i++;
  return `${name} ${i}`.slice(0, 14);
}

function firstFreeColor(room) {
  const used = new Set([...room.players, ...room.bots].map(p => p.color));
  return COLORS.find(color => !used.has(color)) || COLORS[0];
}

function defaultDecision(d) {
  if (!d) return null;
  switch (d.kind) {
    case 'action': {
      const actions = (d.actions || []).filter(a => a.enabled !== false);
      const income = actions.find(a => a.type === 'income');
      if (income) return { type: 'income' };
      const coup = actions.find(a => a.type === 'coup');
      if (coup && d.targets && d.targets.length) return { type: 'coup', targetId: d.targets[0].id };
      const fallback = actions[0];
      if (!fallback) return null;
      return fallback.target && d.targets && d.targets.length
        ? { type: fallback.type, targetId: d.targets[0].id }
        : { type: fallback.type };
    }
    case 'challenge':
      return false;
    case 'block':
      return null;
    case 'loseInfluence':
      return d.options && d.options.length ? d.options[0].index : 0;
    case 'exchange':
      return d.options ? d.options.slice(0, d.keepCount).map((_, i) => i) : [];
    default:
      return null;
  }
}

function sanitizeDecision(d, raw) {
  if (!d) return null;
  switch (d.kind) {
    case 'action': {
      if (!raw || typeof raw !== 'object') return defaultDecision(d);
      const action = (d.actions || []).find(a => a.type === raw.type && a.enabled !== false);
      if (!action) return defaultDecision(d);
      if (action.target) {
        const targetId = Number(raw.targetId);
        if (!Number.isInteger(targetId) || !(d.targets || []).some(t => t.id === targetId)) {
          return defaultDecision(d);
        }
        return { type: action.type, targetId };
      }
      return { type: action.type };
    }
    case 'challenge':
      return raw === true;
    case 'block':
      return (d.roles || []).includes(raw) ? raw : null;
    case 'loseInfluence': {
      const index = Number(raw && raw.index !== undefined ? raw.index : raw);
      return (d.options || []).some(o => o.index === index) ? index : defaultDecision(d);
    }
    case 'exchange': {
      const chosen = Array.isArray(raw) ? raw.map(Number) : [];
      const unique = [...new Set(chosen)];
      const count = d.keepCount || 0;
      if (unique.length === count && unique.every(i => Number.isInteger(i) && i >= 0 && i < (d.options || []).length)) {
        return unique;
      }
      return defaultDecision(d);
    }
    default:
      return null;
  }
}

class RemoteAgent {
  constructor(room, roomPlayer, seat) {
    this.room = room;
    this.roomPlayer = roomPlayer;
    this.seat = seat;
    this.pending = null;
  }

  decide(decision) {
    const timeoutMs = TIMEOUT_MS[decision.kind] || 30_000;
    const promptId = ++this.room.promptSeq;
    const deadline = now() + timeoutMs;

    return new Promise(resolve => {
      this.pending = { promptId, decision, resolve, deadline, timeoutMs, timer: null };
      this.room.prompts.set(this.roomPlayer.id, this);
      this.sendPrompt(timeoutMs);
      this.pending.timer = setTimeout(() => this.onTimeout(promptId), timeoutMs);
    });
  }

  sendPrompt(timeoutMs) {
    if (!this.pending) return;
    const remaining = Math.max(1000, this.pending.deadline - now());
    this.room.sendToPlayer(this.roomPlayer.id, {
      type: 'prompt',
      promptId: this.pending.promptId,
      decision: this.pending.decision,
      timeoutMs: Math.min(timeoutMs || this.pending.timeoutMs, remaining)
    });
  }

  resend() {
    if (this.pending) this.sendPrompt(Math.max(1000, this.pending.deadline - now()));
  }

  handleDecision(promptId, raw) {
    if (!this.pending || this.pending.promptId !== promptId) return false;
    const value = sanitizeDecision(this.pending.decision, raw);
    this.finish(value);
    return true;
  }

  onTimeout(promptId) {
    if (!this.pending || this.pending.promptId !== promptId) return;
    const promptIdNow = this.pending.promptId;
    this.room.systemLog(`${this.roomPlayer.name} ran out of time — the court auto-played for them.`);
    this.room.broadcast({ type: 'notice', message: `${this.roomPlayer.name} ran out of time.` });
    this.room.sendToPlayer(this.roomPlayer.id, { type: 'promptCancel', promptId: promptIdNow });
    this.finish(defaultDecision(this.pending.decision));
  }

  forceDefault() {
    if (!this.pending) return;
    const pending = this.pending;
    this.room.sendToPlayer(this.roomPlayer.id, { type: 'promptCancel', promptId: pending.promptId });
    this.finish(defaultDecision(pending.decision));
  }

  discard() {
    if (!this.pending) return;
    clearTimeout(this.pending.timer);
    this.pending = null;
    this.room.prompts.delete(this.roomPlayer.id);
  }

  finish(value) {
    if (!this.pending) return;
    const { resolve, timer } = this.pending;
    clearTimeout(timer);
    this.pending = null;
    this.room.prompts.delete(this.roomPlayer.id);
    resolve(value);
  }
}

export class CoupRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.room = null;
    this.game = null;
    this.sockets = new Map();        // WebSocket -> room player id
    this.playerSockets = new Map();  // room player id -> WebSocket
    this.prompts = new Map();        // room player id -> RemoteAgent
    this.seatByPlayer = new Map();   // room player id -> engine seat
    this.logHistory = [];
    this.promptSeq = 0;
    this.lastGameResult = null;
    this.ready = this.load();
    this.gameToken = 0;
  }

  async load() {
    const saved = await this.state.storage.get('room');
    if (!saved) return;
    this.room = saved;
    // WebSockets do not survive a DO restart, and the in-memory async engine cannot be rehydrated.
    if (this.room.phase === 'playing' || this.room.phase === 'over') {
      this.room.phase = 'lobby';
      this.room.interrupted = true;
    }
    for (const player of this.room.players) player.connected = false;
  }

  async fetch(request) {
    await this.ready;
    const url = new URL(request.url);
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') {
      return json({ error: 'Expected a WebSocket upgrade' }, 426);
    }

    const match = url.pathname.match(/\/api\/rooms\/([A-Za-z0-9]{4,8})\/ws$/);
    const code = (match ? match[1] : url.searchParams.get('code') || '').toUpperCase();
    if (!validCode(code)) return json({ error: 'Invalid room code' }, 400);

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();

    try {
      await this.connect(server, url, code);
    } catch (err) {
      console.error('room connect error', err);
      this.reject(server, 'server_error', 'The room could not be opened.');
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /* ---------------- connection ---------------- */

  async connect(server, url, code) {
    const token = cleanToken(url.searchParams.get('token'));
    const suppliedName = cleanName(url.searchParams.get('name'));
    const wantsCreate = url.searchParams.get('create') === '1';

    if (!token) {
      this.reject(server, 'bad_token', 'Missing player identity. Refresh and try again.');
      return;
    }

    if (!this.room) {
      if (!wantsCreate) {
        this.reject(server, 'room_not_found', 'That room no longer exists.');
        return;
      }
      this.room = {
        code,
        phase: 'lobby',
        hostId: null,
        players: [],
        bots: [],
        difficulty: 'normal',
        createdAt: now(),
        lastActivity: now(),
        interrupted: false
      };
    }

    if (wantsCreate && this.room.players.length > 0) {
      const existing = this.room.players.find(p => p.token === token);
      if (!existing) {
        const stale = this.room.players.every(p => !p.connected) && now() - this.room.lastActivity > STALE_MS;
        if (!stale) {
          this.reject(server, 'code_taken', 'That room code is already in use. Please try another.');
          return;
        }
        // An abandoned room can be claimed with a fresh create.
        this.resetRoom(code);
      }
    }

    if (!this.room || this.room.code !== code) {
      this.reject(server, 'room_not_found', 'That room no longer exists.');
      return;
    }

    let player = this.room.players.find(p => p.token === token);

    if (player) {
      // Reconnect (or a second tab). Replace the previous socket.
      const oldSocket = this.playerSockets.get(player.id);
      if (oldSocket && oldSocket !== server) {
        try { oldSocket.close(4001, 'Reconnected elsewhere'); } catch (e) { /* ignore */ }
        this.sockets.delete(oldSocket);
      }
    } else {
      if (this.room.phase !== 'lobby') {
        this.reject(server, 'game_in_progress', 'That game has already started.');
        return;
      }
      if (this.room.players.length + this.room.bots.length >= MAX_PLAYERS) {
        this.reject(server, 'room_full', 'This room is full.');
        return;
      }
      player = {
        id: crypto.randomUUID(),
        token,
        name: uniqueName(this.room, suppliedName),
        color: firstFreeColor(this.room),
        connected: false
      };
      this.room.players.push(player);
    }

    player.connected = true;
    this.room.lastActivity = now();
    if (this.room.phase !== 'playing') this.ensureHost();
    else if (!this.room.hostId || !this.room.players.some(p => p.id === this.room.hostId)) this.ensureHost();

    this.sockets.set(server, player.id);
    this.playerSockets.set(player.id, server);
    server.addEventListener('message', event => {
      this.onMessage(server, event.data).catch(err => {
        console.error('room message error', err);
        this.sendError(server, 'server_error', 'Something went wrong in the room.', false);
      });
    });
    server.addEventListener('close', () => this.onClose(server));
    server.addEventListener('error', () => this.onClose(server));

    await this.saveRoom();

    // Send after returning the upgrade response.
    setTimeout(() => {
      try {
        this.sendInitial(server, player);
        if (this.room && this.room.phase !== 'playing') this.broadcastLobby(player.id);
      } catch (err) {
        console.error('room initial send error', err);
      }
    }, 0);
  }

  reject(server, code, message) {
    setTimeout(() => {
      send(server, { type: 'error', code, message, fatal: true });
      setTimeout(() => {
        try { server.close(4004, code); } catch (e) { /* ignore */ }
      }, 300);
    }, 10);
  }

  sendInitial(server, player) {
    if (!this.room || !this.playerSockets.has(player.id)) return;
    send(server, {
      type: 'welcome',
      youId: player.id,
      room: this.publicRoom(player.id)
    });

    if (this.room.phase === 'playing' && this.game) {
      const seat = this.seatByPlayer.get(player.id);
      if (seat !== undefined) {
        this.sendGameStart(server, player);
        const agent = this.prompts.get(player.id);
        if (agent) agent.resend();
      }
      return;
    }

    if (this.room.phase === 'over' && this.game) {
      const seat = this.seatByPlayer.get(player.id);
      if (seat !== undefined) {
        this.sendGameStart(server, player);
        send(server, {
          type: 'gameover',
          winnerId: this.lastGameResult ? this.lastGameResult.winnerId : this.game.winnerId,
          reason: this.lastGameResult ? this.lastGameResult.reason : 'last-standing'
        });
        return;
      }
    }

    send(server, { type: 'lobby', room: this.publicRoom(player.id) });
  }

  sendGameStart(server, player) {
    const seat = this.seatByPlayer.get(player.id);
    if (seat === undefined) return;
    send(server, {
      type: 'gameStart',
      youSeat: seat,
      state: this.stateFor(seat),
      logs: this.logHistory.slice()
    });
  }

  sendToPlayer(playerId, data) {
    const ws = this.playerSockets.get(playerId);
    if (ws) send(ws, data);
  }

  broadcast(data) {
    if (!this.room) return;
    for (const player of this.room.players) {
      if (player.connected) this.sendToPlayer(player.id, data);
    }
  }

  sendError(ws, code, message, fatal = false) {
    send(ws, { type: 'error', code, message, fatal });
  }

  broadcastLobby(exceptId = null) {
    if (!this.room) return;
    for (const player of this.room.players) {
      if (!player.connected || player.id === exceptId) continue;
      this.sendToPlayer(player.id, { type: 'lobby', room: this.publicRoom(player.id) });
    }
  }

  publicRoom(youId) {
    const humans = this.room.players.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      connected: p.connected,
      bot: false,
      isHost: p.id === this.room.hostId,
      isYou: p.id === youId
    }));
    const bots = this.room.bots.map(b => ({
      id: b.id,
      name: b.name,
      color: b.color,
      connected: true,
      bot: true,
      isHost: false,
      isYou: false,
      profile: { title: b.profile?.title || 'Courtier' }
    }));
    const seats = [...humans, ...bots];
    const connectedHumans = this.room.players.filter(p => p.connected).length;
    return {
      code: this.room.code,
      phase: this.room.phase,
      hostId: this.room.hostId,
      difficulty: this.room.difficulty,
      seats,
      youId: youId || null,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      connectedHumans,
      canStart: this.room.phase === 'lobby' && connectedHumans + this.room.bots.length >= MIN_PLAYERS,
      interrupted: !!this.room.interrupted
    };
  }

  /* ---------------- persistence ---------------- */

  async saveRoom() {
    if (!this.room) return;
    await this.state.storage.put('room', {
      code: this.room.code,
      phase: this.room.phase,
      hostId: this.room.hostId,
      players: this.room.players.map(p => ({
        id: p.id,
        token: p.token,
        name: p.name,
        color: p.color,
        connected: p.connected
      })),
      bots: this.room.bots,
      difficulty: this.room.difficulty,
      createdAt: this.room.createdAt,
      lastActivity: this.room.lastActivity,
      interrupted: !!this.room.interrupted
    });
  }

  ensureHost() {
    if (!this.room) return;
    const current = this.room.players.find(p => p.id === this.room.hostId);
    if (current && current.connected) return;
    const next = this.room.players.find(p => p.connected) || this.room.players[0];
    this.room.hostId = next ? next.id : null;
  }

  resetRoom(code) {
    this.gameToken++;
    this.room = {
      code,
      phase: 'lobby',
      hostId: null,
      players: [],
      bots: [],
      difficulty: 'normal',
      createdAt: now(),
      lastActivity: now(),
      interrupted: false
    };
    this.game = null;
    this.seatByPlayer.clear();
    this.prompts.clear();
    this.logHistory = [];
    this.lastGameResult = null;
  }

  /* ---------------- game lifecycle ---------------- */

  async startGame() {
    if (!this.room) return { ok: false, code: 'no_room', message: 'No room.' };
    if (this.room.phase !== 'lobby' && this.room.phase !== 'over') {
      return { ok: false, code: 'bad_phase', message: 'The game is already running.' };
    }

    // Drop anyone who is no longer connected.
    const connectedHumans = this.room.players.filter(p => p.connected);
    if (!connectedHumans.length) {
      return { ok: false, code: 'no_players', message: 'There is nobody here to play.' };
    }
    this.room.players = connectedHumans;
    this.ensureHost();

    const seats = [...this.room.players, ...this.room.bots];
    if (seats.length < MIN_PLAYERS) {
      return { ok: false, code: 'not_enough', message: `Coup needs at least ${MIN_PLAYERS} players. Add an AI or invite a friend.` };
    }
    if (seats.length > MAX_PLAYERS) {
      return { ok: false, code: 'too_many', message: `At most ${MAX_PLAYERS} players fit at the table.` };
    }
    const humanIds = new Set(this.room.players.map(p => p.id));

    for (const agent of this.prompts.values()) agent.discard();
    this.prompts.clear();
    this.logHistory = [];
    this.lastGameResult = null;
    this.promptSeq = 0;
    this.seatByPlayer.clear();

    const game = new CoupGame({
      players: seats.map(seat => {
        const isBot = !humanIds.has(seat.id);
        return {
          name: seat.name,
          color: seat.color,
          isHuman: false,
          profile: isBot ? (seat.profile || {}) : { title: 'Contender' }
        };
      }),
      difficulty: this.room.difficulty,
      hooks: this.makeHooks(),
      pace: 0.9
    });

    this.game = game;
    this.room.phase = 'playing';
    this.room.interrupted = false;
    this.room.lastActivity = now();

    seats.forEach((seat, seatIndex) => {
      if (!humanIds.has(seat.id)) return;
      const enginePlayer = game.players[seatIndex];
      enginePlayer.secondPerson = seat.name.trim().toLowerCase() === 'you';
      const agent = new RemoteAgent(this, seat, seatIndex);
      game.agents[seatIndex] = agent;
      this.seatByPlayer.set(seat.id, seatIndex);
    });

    await this.saveRoom();

    for (const player of this.room.players) {
      const ws = this.playerSockets.get(player.id);
      if (ws) this.sendGameStart(ws, player);
    }

    game.start().catch(err => this.failGame(err));
    return { ok: true };
  }

  makeHooks() {
    const room = this;
    const token = ++this.gameToken;
    const active = (game) => {
      if (room.gameToken !== token || !room.game) return false;
      if (game && room.game !== game) return false;
      return true;
    };
    return {
      update(game) {
        if (!active(game) || room.room.phase !== 'playing') return;
        room.broadcastState();
      },
      log(entry) {
        if (!active() || room.room.phase !== 'playing' || !entry) return;
        room.logHistory.push(entry);
        if (room.logHistory.length > 160) room.logHistory.shift();
        room.broadcast({ type: 'log', entry });
      },
      banner(banner) {
        if (!active() || room.room.phase !== 'playing') return;
        room.broadcast({ type: 'banner', banner });
      },
      fx(fx) {
        if (!active() || room.room.phase !== 'playing') return;
        room.broadcast({ type: 'fx', fx });
      },
      sound(sound) {
        if (!active() || room.room.phase !== 'playing') return;
        room.broadcast({ type: 'sound', sound });
      },
      askHuman() {
        throw new Error('Online rooms do not use local human handlers');
      },
      gameover(winner, reason) {
        if (!active() || room.room.phase !== 'playing') return;
        room.onGameOver(room.game, winner, reason);
      },
      error(err) {
        if (!active()) return;
        room.failGame(err);
      }
    };
  }

  broadcastState() {
    if (!this.game || !this.room) return;
    for (const [roomPlayerId, seat] of this.seatByPlayer) {
      const player = this.room.players.find(p => p.id === roomPlayerId);
      if (!player || !player.connected) continue;
      const ws = this.playerSockets.get(roomPlayerId);
      if (!ws) continue;
      send(ws, { type: 'state', state: this.stateFor(seat) });
    }
  }

  stateFor(seat) {
    const game = this.game;
    if (!game) return null;
    const players = game.players.map((p, i) => ({
      id: i,
      name: p.name,
      color: p.color,
      coins: p.coins,
      eliminated: p.eliminated,
      isHuman: false,
      profile: { title: p.profile?.title || 'Courtier' },
      cards: p.cards.map(card => ({
        role: (i === seat || card.revealed || card.proven) ? card.role : null,
        revealed: !!card.revealed,
        proven: !!card.proven
      }))
    }));
    return {
      code: this.room.code,
      phase: this.room.phase,
      youSeat: seat,
      players,
      deckCount: game.deck.length,
      turnIndex: game.turnIndex,
      turnCount: game.turnCount,
      over: !!game.over,
      winnerId: game.winnerId
    };
  }

  onGameOver(game, winner, reason) {
    if (this.game !== game || !this.room) return;
    this.room.phase = 'over';
    this.room.lastActivity = now();
    this.lastGameResult = { winnerId: winner ? winner.id : null, reason };
    this.ensureHost();
    for (const agent of this.prompts.values()) agent.discard();
    this.prompts.clear();
    this.saveRoom().catch(() => {});
    const winnerId = winner ? winner.id : null;
    // Send the updated room first so the client knows who the host is now.
    this.broadcastLobby();
    this.broadcast({ type: 'gameover', winnerId, reason });
  }

  failGame(err) {
    console.error('engine failure', err);
    if (!this.room || this.room.phase !== 'playing') return;
    this.gameToken++;
    if (this.room) {
      for (const agent of this.prompts.values()) agent.discard();
      this.prompts.clear();
      this.room.phase = 'lobby';
      this.room.interrupted = false;
      this.game = null;
      this.seatByPlayer.clear();
      this.lastGameResult = null;
      this.logHistory = [];
      this.ensureHost();
      this.saveRoom().catch(() => {});
    }
    this.broadcast({ type: 'error', code: 'engine_error', message: 'The game hit an unexpected error. The room is back in the lobby.', fatal: false });
    this.broadcastLobby();
  }

  async toLobby(player) {
    if (!this.room || this.room.phase !== 'over' || this.room.hostId !== player.id) {
      return { ok: false, code: 'not_allowed', message: 'Only the host can return the room to the lobby.' };
    }
    this.gameToken++;
    for (const agent of this.prompts.values()) agent.discard();
    this.prompts.clear();
    this.game = null;
    this.seatByPlayer.clear();
    this.logHistory = [];
    this.lastGameResult = null;
    this.room.phase = 'lobby';
    this.room.lastActivity = now();
    this.ensureHost();
    await this.saveRoom();
    this.broadcastLobby();
    return { ok: true };
  }

  async addBot(player) {
    if (!this.room || this.room.phase !== 'lobby' || this.room.hostId !== player.id) {
      return { ok: false, code: 'not_allowed', message: 'Only the host can add an AI seat.' };
    }
    if (this.room.players.length + this.room.bots.length >= MAX_PLAYERS) {
      return { ok: false, code: 'room_full', message: 'All six seats are taken.' };
    }
    const used = new Set(this.room.bots.map(b => b.name.toLowerCase()));
    const bot = BOT_ROSTER.find(b => !used.has(b.name.toLowerCase())) || BOT_ROSTER[0];
    this.room.bots.push({
      id: `bot-${crypto.randomUUID()}`,
      name: uniqueName(this.room, bot.name),
      color: firstFreeColor(this.room),
      bot: true,
      profile: bot.profile
    });
    this.room.lastActivity = now();
    await this.saveRoom();
    this.broadcastLobby();
    return { ok: true };
  }

  async removeBot(player, botId) {
    if (!this.room || this.room.phase !== 'lobby' || this.room.hostId !== player.id) {
      return { ok: false, code: 'not_allowed', message: 'Only the host can remove an AI seat.' };
    }
    const before = this.room.bots.length;
    this.room.bots = this.room.bots.filter(b => b.id !== botId);
    if (this.room.bots.length === before) return { ok: false, code: 'not_found', message: 'That seat is already empty.' };
    this.room.lastActivity = now();
    await this.saveRoom();
    this.broadcastLobby();
    return { ok: true };
  }

  async setDifficulty(player, value) {
    if (!this.room || this.room.phase !== 'lobby' || this.room.hostId !== player.id) {
      return { ok: false, code: 'not_allowed', message: 'Only the host can set the AI difficulty.' };
    }
    if (!DIFFICULTIES.has(value)) return { ok: false, code: 'bad_value', message: 'Unknown difficulty.' };
    this.room.difficulty = value;
    this.room.lastActivity = now();
    await this.saveRoom();
    this.broadcastLobby();
    return { ok: true };
  }

  /* ---------------- messages ---------------- */

  async onMessage(ws, raw) {
    const playerId = this.sockets.get(ws);
    if (!playerId || !this.room) return;
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;

    let text;
    try {
      text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw);
    } catch (e) {
      return;
    }
    if (!text || text.length > 8192) return;

    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (!msg || typeof msg.type !== 'string') return;

    if (msg.type === 'ping') {
      send(ws, { type: 'pong', t: now() });
      return;
    }

    this.room.lastActivity = now();

    switch (msg.type) {
      case 'decision': {
        const agent = this.prompts.get(player.id);
        if (agent) agent.handleDecision(msg.promptId, msg.value);
        break;
      }
      case 'start': {
        if (this.room.hostId !== player.id) {
          this.sendError(ws, 'not_host', 'Only the host can start the game.');
          break;
        }
        if (this.room.phase !== 'lobby') {
          this.sendError(ws, 'bad_phase', 'The game has already started.');
          break;
        }
        const result = await this.startGame();
        if (!result.ok) this.sendError(ws, result.code, result.message);
        break;
      }
      case 'rematch': {
        if (this.room.hostId !== player.id) {
          this.sendError(ws, 'not_host', 'Only the host can start a rematch.');
          break;
        }
        if (this.room.phase !== 'over') {
          this.sendError(ws, 'bad_phase', 'The current game is still running.');
          break;
        }
        const result = await this.startGame();
        if (!result.ok) this.sendError(ws, result.code, result.message);
        break;
      }
      case 'toLobby': {
        const result = await this.toLobby(player);
        if (!result.ok) this.sendError(ws, result.code, result.message);
        break;
      }
      case 'addBot': {
        const result = await this.addBot(player);
        if (!result.ok) this.sendError(ws, result.code, result.message);
        break;
      }
      case 'removeBot': {
        const result = await this.removeBot(player, String(msg.botId || ''));
        if (!result.ok) this.sendError(ws, result.code, result.message);
        break;
      }
      case 'difficulty': {
        const result = await this.setDifficulty(player, msg.value);
        if (!result.ok) this.sendError(ws, result.code, result.message);
        break;
      }
      case 'leave': {
        await this.leaveRoom(player, ws);
        break;
      }
      default:
        break;
    }
  }

  async leaveRoom(player, ws) {
    if (!this.room) return;
    const agent = this.prompts.get(player.id);
    if (agent) {
      this.systemLog(`${player.name} left the court.`);
      agent.forceDefault();
    }
    this.room.players = this.room.players.filter(p => p.id !== player.id);
    this.playerSockets.delete(player.id);
    this.sockets.delete(ws);
    try { ws.close(4002, 'Left room'); } catch (e) { /* ignore */ }
    this.ensureHost();
    this.room.lastActivity = now();
    await this.saveRoom();
    this.broadcastLobby();
    if (this.room.phase === 'playing') {
      this.broadcast({ type: 'notice', message: `${player.name} left the room.` });
    }
  }

  onClose(ws) {
    const playerId = this.sockets.get(ws);
    if (!playerId) return;
    this.sockets.delete(ws);
    if (this.playerSockets.get(playerId) !== ws) return;
    this.playerSockets.delete(playerId);
    if (!this.room) return;
    const player = this.room.players.find(p => p.id === playerId);
    if (!player) return;
    player.connected = false;
    this.room.lastActivity = now();
    if (this.room.phase !== 'playing') {
      this.ensureHost();
      this.broadcastLobby();
    }
    this.saveRoom().catch(() => {});
  }

  /* ---------------- helpers ---------------- */

  systemLog(text) {
    const entry = { html: `<span class="log-muted">${esc(text)}</span>` };
    if (!this.room) return;
    this.logHistory.push(entry);
    if (this.logHistory.length > 160) this.logHistory.shift();
    this.broadcast({ type: 'log', entry });
  }
}
