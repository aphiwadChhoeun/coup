/* ============================================================
   Coup — online rooms (Cloudflare Workers + Durable Objects)
   ============================================================ */

const ONLINE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ONLINE_SAVE_KEY = 'coup.online.room';
const DIFFICULTY_LABELS = { easy: 'Courtier', normal: 'Noble', hard: 'Assassin' };

function onlineToken() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* ignore */ }
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function onlineCode() {
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => ONLINE_ALPHABET[b % ONLINE_ALPHABET.length]).join('');
}

function normalizeCode(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function cleanOnlineName(value) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14) || 'Player';
}

class CoupOnline {
  constructor(options) {
    this.ui = options.ui;
    this.onShowOnline = options.onShowOnline;
    this.onEnterGame = options.onEnterGame;
    this.onEnterLobby = options.onEnterLobby;
    this.onExit = options.onExit;
    this.getTitleName = options.getTitleName;
    this.setTitleName = options.setTitleName;

    this.screen = document.getElementById('screen-online');
    this.panel = document.getElementById('onlinePanel');
    this.backBtn = document.getElementById('onlineBack');
    this.netBar = document.getElementById('netBar');

    this.socket = null;
    this.socketOpen = false;
    this.code = '';
    this.token = '';
    this.name = 'Player';
    this.roomPlayerId = null;
    this.youSeat = null;
    this.room = null;
    this.state = null;
    this.inGame = false;
    this.activePromptId = null;
    this.terminal = false;
    this.intentional = false;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.heartbeat = null;
    this.pendingCreate = false;
    this.createAttempts = 0;
    this.entryCode = '';
    this.connectionGen = 0;
    this.gameOverShown = false;
    this.entryBusy = false;

    this.bindStatic();
    window.addEventListener('beforeunload', () => {
      this.intentional = true;
      try { this.socket?.close(1000, 'Page closed'); } catch (e) { /* ignore */ }
    });
  }

  /* ================= entry ================= */

  bindStatic() {
    this.backBtn?.addEventListener('click', () => {
      Sound.play('click');
      if (this.room || this.socket) this.leaveRoom(true);
      else this.onExit();
    });
  }

  openEntry(prefillCode = '') {
    const saved = this.loadSaved();
    const titleName = this.getTitleName();
    if (!this.name || this.name === 'Player') {
      this.name = saved?.name || (titleName && titleName.trim().toLowerCase() !== 'you' ? titleName : 'Player');
    }
    this.entryCode = normalizeCode(prefillCode) || (saved?.code || '');
    this.onShowOnline();
    this.updateBack();
    this.renderEntry();
    this.hideNet();
  }

  renderEntry() {
    if (!this.panel) return;
    const saved = this.loadSaved();
    const wsSupported = typeof WebSocket !== 'undefined' && /^https?:$/.test(location.protocol);
    const rejoin = saved && saved.code && saved.token
      ? `<section class="rejoin-card">
          <div class="rejoin-main">
            <span class="eyebrow">Saved seat</span>
            <b>Room ${esc(saved.code)}</b>
            <span>${esc(saved.name || 'Player')} · rejoin if the table is still open.</span>
          </div>
          <button id="onlineRejoin" class="btn btn-primary" type="button">Rejoin room</button>
        </section>`
      : '';

    this.panel.innerHTML = `<div class="online-entry">
      <header class="online-head">
        <span class="eyebrow">Online play</span>
        <h2>Gather the court</h2>
        <p>Host a private table and invite friends with a room code. Three players minimum; the host can add AI seats.</p>
      </header>

      <label class="online-name-field">
        <span>Playing as</span>
        <input id="onlineName" maxlength="14" value="${esc(this.name)}" autocomplete="off" spellcheck="false">
      </label>

      <div class="online-entry-grid">
        <section class="online-card online-card--create">
          <span class="online-card-glyph" aria-hidden="true">✦</span>
          <h3>Create a room</h3>
          <p>You become the host. Share the code, add AI if you need a third seat.</p>
          <button id="onlineCreate" class="btn btn-primary" type="button" ${wsSupported ? '' : 'disabled'}>Create private room</button>
        </section>
        <section class="online-card">
          <span class="online-card-glyph" aria-hidden="true">♛</span>
          <h3>Join a room</h3>
          <p>Enter the five-letter code from your host.</p>
          <div class="join-row">
            <input id="onlineCode" maxlength="8" placeholder="CODE" value="${esc(this.entryCode)}" autocomplete="off" autocapitalize="characters" spellcheck="false" ${wsSupported ? '' : 'disabled'}>
            <button id="onlineJoin" class="btn btn-ghost" type="button" ${wsSupported ? '' : 'disabled'}>Join</button>
          </div>
        </section>
      </div>

      ${rejoin}

      <p id="onlineError" class="online-error"></p>
      <p class="online-note">${wsSupported ? 'Rooms are server-authoritative and reconnect automatically.' : 'Online rooms need a hosted build. Start the Cloudflare dev server or deploy the Worker to play online.'}</p>
    </div>`;

    this.bindEntry();
    this.updateBack();
  }

  bindEntry() {
    const nameInput = document.getElementById('onlineName');
    const codeInput = document.getElementById('onlineCode');
    const error = document.getElementById('onlineError');

    nameInput?.addEventListener('input', () => {
      this.name = cleanOnlineName(nameInput.value);
      this.setTitleName?.(this.name);
    });
    codeInput?.addEventListener('input', () => {
      codeInput.value = normalizeCode(codeInput.value).slice(0, 5);
      this.entryCode = codeInput.value;
    });
    codeInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this.joinRoom(codeInput.value); }
    });

    document.getElementById('onlineCreate')?.addEventListener('click', () => {
      this.readEntryName();
      Sound.play('click');
      this.createRoom();
    });
    document.getElementById('onlineJoin')?.addEventListener('click', () => {
      this.readEntryName();
      Sound.play('click');
      this.joinRoom(codeInput?.value || '');
    });
    document.getElementById('onlineRejoin')?.addEventListener('click', () => {
      const saved = this.loadSaved();
      if (!saved || this.entryBusy || this.socket) return;
      Sound.play('click');
      this.entryBusy = true;
      this.name = saved.name || this.name;
      this.entryCode = saved.code;
      this.connect({ code: saved.code, token: saved.token, create: false, reconnect: true });
    });

    if (error && this.entryErrorText) {
      error.textContent = this.entryErrorText;
    }
  }

  readEntryName() {
    const input = document.getElementById('onlineName');
    if (input) {
      this.name = cleanOnlineName(input.value);
      this.setTitleName?.(this.name);
    }
  }

  showEntryError(message) {
    this.entryErrorText = message;
    const el = document.getElementById('onlineError');
    if (el) el.textContent = message;
  }

  updateBack() {
    if (!this.backBtn) return;
    const label = this.room || this.socket ? 'Leave room' : 'Back';
    this.backBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg><span>${label}</span>`;
  }

  /* ================= create / join / connect ================= */

  createRoom() {
    if (!this.canConnect() || this.entryBusy) return;
    this.entryBusy = true;
    this.ensureBackend().then(ok => {
      if (!ok) { this.entryBusy = false; return; }
      this.pendingCreate = true;
      this.createAttempts = 0;
      this.connect({ code: onlineCode(), token: onlineToken(), create: true });
    });
  }

  joinRoom(rawCode) {
    if (!this.canConnect() || this.entryBusy) return;
    const code = normalizeCode(rawCode).slice(0, 5);
    if (code.length < 4) {
      this.showEntryError('Enter the room code your host shared.');
      return;
    }
    this.entryBusy = true;
    this.ensureBackend().then(ok => {
      if (!ok) { this.entryBusy = false; return; }
      this.entryCode = code;
      const saved = this.loadSaved();
      const token = saved && saved.code === code ? saved.token : onlineToken();
      this.pendingCreate = false;
      this.connect({ code, token, create: false });
    });
  }

  async ensureBackend() {
    if (this.backendOk) return true;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch('/api/health', { cache: 'no-store', signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error('No online backend');
      const data = await response.json();
      if (!data || !data.ok) throw new Error('No online backend');
      this.backendOk = true;
      return true;
    } catch (e) {
      this.showEntryError('Online play needs the Cloudflare Worker. Run "npm run dev" locally, or deploy with "npm run deploy".');
      this.onShowOnline();
      this.renderEntry();
      this.showEntryError('Online play needs the Cloudflare Worker. Run "npm run dev" locally, or deploy with "npm run deploy".');
      return false;
    }
  }

  canConnect() {
    if (typeof WebSocket === 'undefined' || !/^https?:$/.test(location.protocol)) {
      this.showEntryError('Online play needs the game to be hosted on Cloudflare (or the local Wrangler server).');
      return false;
    }
    return true;
  }

  connect({ code, token, create, reconnect = false }) {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeat);
    if (this.socket) {
      this.intentional = true;
      try { this.socket.close(1000, 'Switch connection'); } catch (e) { /* ignore */ }
    }

    this.code = code;
    this.token = token;
    this.pendingCreate = create;
    this.terminal = false;
    this.intentional = false;
    this.reconnectAttempt = reconnect ? this.reconnectAttempt : 0;
    this.socketOpen = false;
    const generation = ++this.connectionGen;

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/api/rooms/${encodeURIComponent(code)}/ws` +
      `?name=${encodeURIComponent(this.name)}&token=${encodeURIComponent(token)}${create ? '&create=1' : ''}`;

    this.showNet(reconnect ? 'Reconnecting to the court…' : 'Connecting to the court…');
    let socket;
    try {
      socket = new WebSocket(url);
    } catch (e) {
      this.showEntryError('Could not reach the online server.');
      this.entryBusy = false;
      this.hideNet();
      return;
    }
    this.socket = socket;

    socket.addEventListener('open', () => {
      if (generation !== this.connectionGen) return;
      this.socketOpen = true;
      this.reconnectAttempt = 0;
      this.startHeartbeat();
    });

    socket.addEventListener('message', event => {
      if (generation !== this.connectionGen) return;
      let data;
      try { data = JSON.parse(event.data); } catch (e) { return; }
      if (!data || typeof data.type !== 'string') return;
      this.handleMessage(data);
    });

    socket.addEventListener('close', event => {
      if (generation !== this.connectionGen) return;
      this.socketOpen = false;
      clearInterval(this.heartbeat);
      this.onSocketClose(event);
    });

    socket.addEventListener('error', () => {
      // close always follows; keep errors quiet.
    });
  }

  startHeartbeat() {
    clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (this.socketOpen) this.send({ type: 'ping' });
    }, 25_000);
  }

  send(data) {
    try {
      if (this.socket && this.socket.readyState === 1) {
        this.socket.send(JSON.stringify(data));
      }
    } catch (e) { /* ignore */ }
  }

  /* ================= incoming messages ================= */

  handleMessage(msg) {
    switch (msg.type) {
      case 'welcome': return this.onWelcome(msg);
      case 'lobby': return this.onLobby(msg);
      case 'gameStart': return this.onGameStart(msg);
      case 'state': return this.onState(msg);
      case 'prompt': return this.onPrompt(msg);
      case 'promptCancel': return this.onPromptCancel(msg);
      case 'log': if (this.inGame) this.ui.addLog(msg.entry); return;
      case 'banner': if (this.inGame) this.ui.banner(msg.banner); return;
      case 'fx': if (this.inGame) this.ui.fx(msg.fx); return;
      case 'sound': if (this.inGame) Sound.play(msg.sound); return;
      case 'gameover': return this.onGameOver(msg);
      case 'notice': this.ui.toast(msg.message || 'The court stirs.', 'gold'); return;
      case 'error': return this.onServerError(msg);
      case 'pong': return;
      default: return;
    }
  }

  onWelcome(msg) {
    this.room = msg.room || null;
    this.roomPlayerId = msg.youId || null;
    this.terminal = false;
    this.intentional = false;
    this.pendingCreate = false;
    this.createAttempts = 0;
    this.entryErrorText = '';
    this.entryBusy = false;
    this.hideNet();
    this.saveRoom();
    this.updateBack();
    this.setUrlRoom(this.code);

    if (!this.room) return;
    if (this.room.phase === 'lobby') {
      if (this.inGame) {
        this.showLobbyScreen();
      } else {
        this.inGame = false;
        this.renderLobby();
      }
    }
    // playing/over: the server follows with gameStart and possibly gameover.
  }

  onLobby(msg) {
    if (!msg.room) return;
    this.room = msg.room;
    this.hideNet();
    this.updateBack();

    if (this.inGame) {
      if (msg.room.phase === 'lobby') {
        this.showLobbyScreen();
      }
      return;
    }
    this.renderLobby();
  }

  onGameStart(msg) {
    if (!msg.state) return;
    this.youSeat = msg.youSeat;
    this.state = this.hydrate(msg.state, msg.youSeat);
    this.inGame = true;
    this.gameOverShown = false;
    this.activePromptId = null;
    if (this.room) this.room.phase = 'playing';
    this.ui.cancelPending();
    this.ui.closeModal();
    this.ui.setMode('online');
    this.ui.setHandlers({ onLeaveOnline: () => this.leaveRoom(true) });
    this.hideNet();
    this.onEnterGame();
    this.ui.startGame(this.state, { skipOpeningLog: true });
    for (const entry of (msg.logs || [])) this.ui.addLog(entry);
    this.saveRoom();
    this.updateBack();
    this.setUrlRoom(this.code);
  }

  onState(msg) {
    if (!this.inGame || !msg.state) return;
    this.state = this.hydrate(msg.state, this.youSeat);
    this.ui.update(this.state);
  }

  onPrompt(msg) {
    if (!this.inGame || !msg.decision) return;
    const promptId = msg.promptId;
    if (this.activePromptId === promptId && this.ui.pending) return;

    this.activePromptId = promptId;
    if (this.ui.pending) this.ui.cancelPending();
    const decision = { ...msg.decision, timeoutMs: msg.timeoutMs || 0 };
    this.ui.ask(decision).then(value => {
      if (this.activePromptId !== promptId) return;
      this.activePromptId = null;
      this.send({ type: 'decision', promptId, value });
    });
  }

  onPromptCancel(msg) {
    if (this.activePromptId !== msg.promptId) return;
    this.activePromptId = null;
    this.ui.cancelPending();
  }

  onGameOver(msg) {
    if (!this.state) return;
    this.activePromptId = null;
    this.ui.cancelPending();
    this.room = this.room || {};
    this.room.phase = 'over';
    this.gameOverShown = true;
    const winner = this.state.players.find(p => p.id === msg.winnerId) || null;
    const isHost = this.isHost();
    const actions = [];

    if (isHost) {
      actions.push({
        label: 'Play again',
        kind: 'primary',
        keepOpen: true,
        onClick: () => { this.send({ type: 'rematch' }); this.ui.toast('Starting a new game…'); }
      });
      actions.push({
        label: 'Back to lobby',
        kind: 'ghost',
        keepOpen: true,
        onClick: () => { this.send({ type: 'toLobby' }); }
      });
    } else {
      actions.push({
        label: 'Back to lobby',
        kind: 'primary',
        keepOpen: true,
        onClick: () => this.showLobbyScreen()
      });
    }
    actions.push({
      label: 'Leave room',
      kind: 'link',
      keepOpen: false,
      onClick: () => this.leaveRoom(true)
    });

    this.ui.gameOver(winner, 'online', { actions, delay: 0 });
    this.renderLobby();
  }

  hydrate(state, seat) {
    const players = state.players.map(player => ({
      ...player,
      isHuman: player.id === seat,
      profile: player.profile || { title: 'Courtier' }
    }));
    const human = players.find(p => p.isHuman) || null;
    return {
      ...state,
      players,
      human,
      deck: new Array(state.deckCount || 0).fill(null),
      alive() { return players.filter(p => !p.eliminated); },
      isSecondPerson(player) {
        return !!player && player.id === seat && player.name.trim().toLowerCase() === 'you';
      }
    };
  }

  /* ================= lobby ================= */

  showLobbyScreen() {
    this.activePromptId = null;
    this.ui.cancelPending();
    this.ui.closeModal();
    this.inGame = false;
    this.gameOverShown = false;
    this.onEnterLobby();
    this.updateBack();
    this.renderLobby();
  }

  renderLobby() {
    if (!this.panel || !this.room) return;
    const room = this.room;
    const seats = room.seats || [];
    const me = seats.find(s => s.isYou);
    const isHost = room.hostId === me?.id;
    const phase = room.phase;
    const botCount = seats.filter(s => s.bot).length;
    const total = seats.length;
    const canStart = total >= 3 && total <= 6;
    const difficulty = DIFFICULTY_LABELS[room.difficulty] || 'Noble';

    const seatCards = seats.map(seat => {
      const tags = [
        seat.isHost ? '<span class="seat-tag seat-tag--host">Host</span>' : '',
        seat.isYou ? '<span class="seat-tag seat-tag--you">You</span>' : '',
        seat.bot ? '<span class="seat-tag seat-tag--bot">AI</span>' : ''
      ].join('');
      const remove = isHost && seat.bot && phase === 'lobby'
        ? `<button class="seat-remove" type="button" data-remove-bot="${esc(seat.id)}" aria-label="Remove AI seat">×</button>`
        : '';
      return `<div class="lobby-seat ${seat.isYou ? 'is-you' : ''} ${seat.bot ? 'is-bot' : ''} ${!seat.connected ? 'is-offline' : ''}">
        <span class="avatar" style="--pc:${esc(seat.color)}">${esc((seat.name || '?').charAt(0).toUpperCase())}</span>
        <span class="seat-info">
          <b>${esc(seat.name)}</b>
          <span>${seat.connected ? (seat.bot ? 'Court AI' : 'Ready') : 'Reconnecting…'}</span>
        </span>
        <span class="seat-tags">${tags}</span>
        ${remove}
      </div>`;
    }).join('');

    const empties = [];
    for (let i = total; i < 6; i++) {
      empties.push(`<div class="lobby-seat lobby-seat--empty"><span class="seat-plus">+</span><span>Open seat</span></div>`);
    }

    const difficultyControls = isHost && phase === 'lobby' && botCount > 0
      ? `<div class="lobby-difficulty">
          <span>AI nerve</span>
          <div class="segmented segmented--wide">
            ${['easy', 'normal', 'hard'].map(value =>
              `<button type="button" data-difficulty="${value}" class="${room.difficulty === value ? 'on' : ''}">${DIFFICULTY_LABELS[value]}</button>`
            ).join('')}
          </div>
        </div>`
      : (botCount > 0 ? `<span class="lobby-diff-static">AI · ${difficulty}</span>` : '');

    const addBot = isHost && phase === 'lobby'
      ? `<button id="onlineAddBot" class="btn btn-ghost" type="button" ${total >= 6 ? 'disabled' : ''}>+ Add AI seat</button>`
      : '';

    const start = isHost && (phase === 'lobby' || phase === 'over')
      ? `<button id="onlineStart" class="btn btn-primary" type="button" ${canStart ? '' : 'disabled'}>${phase === 'over' ? 'Start next game' : 'Start game'}</button>`
      : `<span class="lobby-wait">Waiting for the host…</span>`;

    const subtitle = phase === 'over'
      ? 'The game has ended. The host can start the next one.'
      : (isHost ? 'Share the code, add AI if needed, then start when three seats are filled.' : 'The host will start when the table is ready.');

    this.panel.innerHTML = `<div class="online-lobby">
      <header class="lobby-head">
        <div class="lobby-title">
          <span class="eyebrow">${phase === 'over' ? 'The court has settled' : 'Private room'}</span>
          <h2 class="room-code">${esc(room.code)}</h2>
          <p class="lobby-sub">${esc(subtitle)}</p>
        </div>
        <div class="room-actions">
          <button id="onlineCopyCode" class="btn btn-ghost" type="button">Copy code</button>
          <button id="onlineCopyLink" class="btn btn-ghost" type="button">Copy link</button>
        </div>
      </header>

      ${room.interrupted ? `<div class="lobby-notice">The previous game was interrupted because the room went idle. This room is back in the lobby.</div>` : ''}

      <div class="seat-grid">${seatCards}${empties.join('')}</div>

      <div class="lobby-bar">
        <div class="lobby-left">
          ${addBot}
          ${difficultyControls}
        </div>
        <div class="lobby-right">
          ${start}
          <button id="onlineLeave" class="btn btn-ghost" type="button">Leave room</button>
        </div>
      </div>
      <p class="lobby-hint">${total} / 6 seats · ${total < 3 ? 'add an AI or invite a friend to start.' : 'the host starts when everyone is ready.'}</p>
    </div>`;

    this.bindLobby();
    this.updateBack();
  }

  bindLobby() {
    const copy = async text => {
      try {
        await navigator.clipboard.writeText(text);
        this.ui.toast('Copied to clipboard.', 'gold');
      } catch (e) {
        this.ui.toast(text, 'gold', 5000);
      }
    };

    document.getElementById('onlineCopyCode')?.addEventListener('click', () => {
      Sound.play('click');
      copy(this.room?.code || '');
    });
    document.getElementById('onlineCopyLink')?.addEventListener('click', () => {
      Sound.play('click');
      copy(this.inviteLink());
    });
    document.getElementById('onlineLeave')?.addEventListener('click', () => {
      Sound.play('click');
      this.leaveRoom(true);
    });
    document.getElementById('onlineAddBot')?.addEventListener('click', () => {
      Sound.play('click');
      this.send({ type: 'addBot' });
    });
    document.getElementById('onlineStart')?.addEventListener('click', () => {
      Sound.play('click');
      const type = this.room?.phase === 'over' ? 'rematch' : 'start';
      this.send({ type });
      const btn = document.getElementById('onlineStart');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Starting…';
        setTimeout(() => {
          if (!this.inGame && this.room) this.renderLobby();
        }, 1600);
      }
    });
    this.panel.querySelectorAll('[data-difficulty]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.play('click');
        this.send({ type: 'difficulty', value: btn.dataset.difficulty });
      });
    });
    this.panel.querySelectorAll('[data-remove-bot]').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.play('click');
        this.send({ type: 'removeBot', botId: btn.dataset.removeBot });
      });
    });
  }

  isHost() {
    if (!this.room) return false;
    const me = (this.room.seats || []).find(s => s.isYou);
    return !!me && me.id === this.room.hostId;
  }

  inviteLink() {
    return `${location.origin}${location.pathname}?room=${encodeURIComponent(this.room?.code || this.code)}`;
  }

  /* ================= lifecycle ================= */

  leaveRoom(explicit = true) {
    if (explicit) {
      this.intentional = true;
      this.send({ type: 'leave' });
      this.clearSavedRoom();
    }
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeat);
    try { this.socket?.close(1000, 'Leaving'); } catch (e) { /* ignore */ }
    this.socket = null;
    this.socketOpen = false;
    this.room = null;
    this.roomPlayerId = null;
    this.youSeat = null;
    this.state = null;
    this.inGame = false;
    this.activePromptId = null;
    this.terminal = false;
    this.entryBusy = false;
    this.ui.cancelPending();
    this.ui.closeModal();
    this.hideNet();
    this.clearSavedRoom();
    this.onExit();
  }

  onSocketClose(event) {
    if (this.intentional || this.terminal) return;
    if (event && event.code === 4001) {
      this.terminal = true;
      this.showNet('This room was opened in another tab.', 'error');
      this.ui.toast('This room was opened in another tab.', 'red', 5000);
      return;
    }
    if (!this.code || !this.token) return;

    this.showNet('Connection lost — reconnecting…', 'warn');
    const attempt = this.reconnectAttempt++;
    const delay = Math.min(8000, 700 * Math.pow(1.6, Math.min(attempt, 8)));
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.intentional || this.terminal) return;
      this.connect({ code: this.code, token: this.token, create: !!this.pendingCreate, reconnect: true });
    }, delay);
  }

  onServerError(msg) {
    const message = msg.message || 'The room returned an error.';
    if (msg.code === 'code_taken' && this.pendingCreate && this.createAttempts < 3) {
      this.createAttempts++;
      this.terminal = true;
      try { this.socket?.close(1000, 'Retry code'); } catch (e) { /* ignore */ }
      setTimeout(() => {
        this.terminal = false;
        this.intentional = false;
        this.pendingCreate = true;
        this.connect({ code: onlineCode(), token: onlineToken(), create: true });
      }, 120);
      return;
    }

    if (msg.fatal) {
      this.terminal = true;
      this.entryBusy = false;
      this.clearSavedRoom();
      this.showNet(message, 'error');
      this.ui.toast(message, 'red', 5000);
      try { this.socket?.close(1000, 'Fatal room error'); } catch (e) { /* ignore */ }
      this.socket = null;
      this.socketOpen = false;
      if (this.inGame) {
        setTimeout(() => {
          if (!this.terminal) return;
          this.inGame = false;
          this.gameOverShown = false;
          this.room = null;
          this.roomPlayerId = null;
          this.youSeat = null;
          this.state = null;
          this.ui.cancelPending();
          this.ui.closeModal();
          this.onShowOnline();
          this.renderEntry();
          this.showEntryError(message);
        }, 900);
      } else {
        this.room = null;
        this.roomPlayerId = null;
        this.youSeat = null;
        this.state = null;
        this.showEntryError(message);
        this.onShowOnline();
        this.renderEntry();
        this.showEntryError(message);
      }
      return;
    }

    this.ui.toast(message, 'red');
    this.showLobbyError(message);
  }

  showLobbyError(message) {
    if (!this.room || this.inGame) return;
    const hint = document.querySelector('.lobby-hint');
    if (hint) {
      hint.textContent = message;
      hint.classList.add('is-error');
    }
  }

  /* ================= net bar ================= */

  showNet(message, tone = '') {
    if (!this.netBar) return;
    this.netBar.textContent = message;
    this.netBar.className = `net-bar visible ${tone ? `net-bar--${tone}` : ''}`;
  }

  hideNet() {
    if (!this.netBar) return;
    this.netBar.className = 'net-bar hidden';
  }

  /* ================= storage / url ================= */

  saveRoom() {
    if (!this.code || !this.token) return;
    try {
      localStorage.setItem(ONLINE_SAVE_KEY, JSON.stringify({
        code: this.code,
        token: this.token,
        name: this.name,
        ts: Date.now()
      }));
    } catch (e) { /* ignore */ }
  }

  loadSaved() {
    try {
      const raw = JSON.parse(localStorage.getItem(ONLINE_SAVE_KEY) || 'null');
      if (!raw || !raw.code || !raw.token) return null;
      return raw;
    } catch (e) {
      return null;
    }
  }

  clearSavedRoom() {
    try { localStorage.removeItem(ONLINE_SAVE_KEY); } catch (e) { /* ignore */ }
  }

  setUrlRoom(code) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('room', code);
      history.replaceState(null, '', url);
    } catch (e) { /* ignore */ }
  }
}
