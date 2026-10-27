/* ============================================================
   Coup — UI layer
   ============================================================ */

const UI_ICONS = {
  rules: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5Z"/><path d="M4 5.5v16"/><path d="M8 7h8M8 11h8M8 15h5"/></svg>`,
  soundOn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19Z"/><path d="M15 9.5a4 4 0 0 1 0 5"/><path d="M17.5 7a7.5 7.5 0 0 1 0 10"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6.5 9H3v6h3.5L11 19Z"/><path d="m15 9.5 5 5M20 9.5l-5 5"/></svg>`,
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  log: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`,
  close: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>`,
  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg>`,
  coin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.2h4a2 2 0 0 1 0 4h-3a2 2 0 0 0 0 4h4" opacity=".55"/></svg>`,
  coins: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><ellipse cx="10" cy="7" rx="6" ry="3"/><path d="M4 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M8 18c0 1.7 2.7 3 6 3s6-1.3 6-3v-4"/><path d="M14 10v4"/></svg>`,
  crown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 17 2.5 7l5.5 4L12 4l4 7 5.5-4-1 10Z"/><path d="M3.5 20h17"/></svg>`,
  sword: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m14 4 6-1-1 6-8 8-4-4Z"/><path d="m9 15-4 4M4 20l1 1M12 6l4 4"/></svg>`
};

const REASON_TEXT = {
  'coup': 'A coup has broken your hold on the court.',
  'assassination': 'The assassin found you.',
  'lost a challenge': 'You challenged a truth.',
  'caught bluffing': 'Your bluff was called.'
};

class CoupUI {
  constructor() {
    this.$ = id => document.getElementById(id);
    this.screenTitle = this.$('screen-title');
    this.screenGame = this.$('screen-game');
    this.opponentsEl = this.$('opponents');
    this.handEl = this.$('hand');
    this.youPlate = this.$('youPlate');
    this.dock = this.$('dock');
    this.bannerLayer = this.$('bannerLayer');
    this.logPanel = this.$('logPanel');
    this.logList = this.$('logList');
    this.modalRoot = this.$('modalRoot');
    this.deckCountEl = this.$('deckCount');
    this.statusEyebrow = this.$('statusEyebrow');
    this.statusText = this.$('statusText');
    this.statusSub = this.$('statusSub');
    this.soundBtn = this.$('soundBtn');
    this.game = null;
    this.pods = new Map();
    this.handNodes = [];
    this.pending = null;
    this.selectable = null;
    this.modalDismissible = false;
    this.handlers = {};
    this.lastLogCount = 0;
    this.mode = 'solo';
    this.promptTimerEl = null;

    this.bindStatic();
    this.updateSoundButton();
  }

  setHandlers(handlers) {
    this.handlers = handlers || {};
  }

  setMode(mode = 'solo') {
    this.mode = mode === 'online' ? 'online' : 'solo';
  }

  /* ================= static bindings ================= */

  bindStatic() {
    this.$('rulesBtn')?.addEventListener('click', () => { Sound.play('click'); this.openRules(); });
    this.$('titleRulesBtn')?.addEventListener('click', () => { Sound.play('click'); this.openRules(); });
    this.$('soundBtn')?.addEventListener('click', () => {
      Sound.setEnabled(!Sound.isEnabled());
      if (Sound.isEnabled()) Sound.play('click');
      this.updateSoundButton();
    });
    this.$('logBtn')?.addEventListener('click', () => { Sound.play('click'); this.toggleLog(); });
    this.$('logClose')?.addEventListener('click', () => { this.logPanel.classList.remove('open'); });
    this.$('menuBtn')?.addEventListener('click', () => { Sound.play('click'); this.openGameMenu(); });
    this.$('brandBtn')?.addEventListener('click', () => {
      if (document.body.classList.contains('in-game') && this.game && !this.game.over) this.openGameMenu();
    });

    this.handEl.addEventListener('click', e => {
      const cardEl = e.target.closest('.card');
      if (!cardEl || !this.selectable) return;
      const index = Number(cardEl.dataset.index);
      if (this.selectable.has(index)) {
        Sound.play('click');
        this.resolve(index);
      }
    });

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (this.modalRoot.classList.contains('open') && this.modalDismissible) {
        this.closeModal();
      }
    });
  }

  updateSoundButton() {
    if (!this.soundBtn) return;
    const enabled = Sound.isEnabled();
    this.soundBtn.innerHTML = enabled ? UI_ICONS.soundOn : UI_ICONS.soundOff;
    this.soundBtn.classList.toggle('is-off', !enabled);
    this.soundBtn.setAttribute('aria-label', enabled ? 'Mute sound' : 'Enable sound');
    this.soundBtn.title = enabled ? 'Mute sound' : 'Enable sound';
  }

  toggleLog() {
    if (window.innerWidth <= 980) {
      this.logPanel.classList.toggle('open');
    } else {
      this.screenGame.classList.toggle('log-collapsed');
    }
  }

  /* ================= game boot / table ================= */

  startGame(game, options = {}) {
    this.game = game;
    this.pods = new Map();
    this.handNodes = [];
    this.selectable = null;
    this.pending = null;
    this.clearPromptTimer();
    this.modalRoot.innerHTML = '';
    this.modalRoot.classList.remove('open');
    this.bannerLayer.innerHTML = '';
    this.dock.innerHTML = '';
    this.dock.classList.remove('visible');
    this.logList.innerHTML = '';
    this.screenGame.classList.remove('log-collapsed');
    this.logPanel.classList.remove('open');
    document.querySelectorAll('.confetti').forEach(el => el.remove());

    this.buildTable({ skipOpeningLog: !!options.skipOpeningLog });
    this.update(game);
    Sound.play('deal');
  }

  buildTable(options = {}) {
    const game = this.game;
    this.opponentsEl.innerHTML = '';
    const opponents = game.players.filter(p => !p.isHuman);
    this.opponentsEl.classList.toggle('opponents--many', opponents.length >= 4);

    opponents.forEach((player, index) => {
      const pod = document.createElement('div');
      pod.className = 'player-pod';
      pod.dataset.id = player.id;
      pod.style.setProperty('--pc', player.color);
      const arc = Math.abs(index - (opponents.length - 1) / 2);
      pod.style.marginTop = `${arc * 9}px`;

      pod.innerHTML = `
        <div class="pod-turn">Turn</div>
        <div class="pod-head">
          <div class="avatar">${esc(player.name.charAt(0).toUpperCase())}</div>
          <div class="pod-id">
            <span class="pod-name">${esc(player.name)}</span>
            <span class="pod-title">${esc(player.profile?.title || 'Courtier')}</span>
          </div>
        </div>
        <div class="pod-cards"></div>
        <div class="pod-foot">
          <span class="coin-chip"><i class="coin"></i><span class="pod-coins">${player.coins}</span></span>
          <span class="pod-influence"></span>
        </div>`;

      this.opponentsEl.append(pod);
      const cardsWrap = pod.querySelector('.pod-cards');
      const cardNodes = player.cards.map((card, ci) => {
        const node = this.createCard(card.role, { known: false, mini: true });
        node.el.dataset.index = ci;
        cardsWrap.append(node.el);
        return node;
      });

      this.pods.set(player.id, {
        el: pod,
        coins: pod.querySelector('.pod-coins'),
        influence: pod.querySelector('.pod-influence'),
        cards: cardNodes,
        lastCoins: player.coins
      });
    });

    /* Human seat */
    const human = game.players.find(p => p.isHuman);
    this.youPlate.innerHTML = `
      <div class="you-head">
        <div class="avatar avatar--you">${esc(human.name.charAt(0).toUpperCase())}</div>
        <div class="you-id">
          <span class="you-eyebrow">Your seat</span>
          <span class="you-name">${esc(human.name)}</span>
        </div>
      </div>
      <div class="you-stats">
        <span class="coin-chip coin-chip--lg"><i class="coin"></i><span class="you-coins">${human.coins}</span></span>
        <span class="you-influence"></span>
      </div>`;
    this.youCoinsEl = this.youPlate.querySelector('.you-coins');
    this.youInfluenceEl = this.youPlate.querySelector('.you-influence');
    this.youPlate.style.setProperty('--pc', human.color);

    this.handEl.innerHTML = '';
    this.handNodes = human.cards.map((card, ci) => {
      const node = this.createCard(card.role, { known: true });
      node.el.dataset.index = ci;
      node.el.classList.add('card--hand');
      node.el.classList.add('is-known');
      this.handEl.append(node.el);
      return node;
    });
    this.handNodes.forEach(n => { n.mounted = true; });
    [...this.pods.values()].forEach(pod => pod.cards.forEach(n => { n.mounted = true; }));

    this.lastLogCount = 0;
    if (!options.skipOpeningLog) {
      this.addLog({
        html: `<span class="log-muted">A game of Coup — ${game.players.length} players. Trust no one.</span>`,
        cls: 'opening'
      });
    }

    /* Deal-in animation (classes removed after the cards settle). */
    clearTimeout(this.dealTimer);
    this.opponentsEl.querySelectorAll('.player-pod').forEach(el => el.classList.add('dealing'));
    this.youPlate.classList.add('dealing');
    this.handNodes.forEach(node => node.el.classList.add('dealing'));
    this.dealTimer = setTimeout(() => {
      this.screenGame.querySelectorAll('.dealing').forEach(el => el.classList.remove('dealing'));
    }, 1100);

    const courtRef = this.$('courtRef');
    if (courtRef) {
      courtRef.innerHTML = ROLES.map(role => {
        const c = CHARACTERS[role];
        return `<div class="ref-row" style="--rc:${c.accent};--rb:${c.accentBright}">
          <span class="ref-icon">${roleIcon(role)}</span>
          <b>${c.name}</b>
          <span>${c.ability === 'Counter' ? 'Blocks assassination' : c.ability}</span>
        </div>`;
      }).join('');
    }
  }

  createCard(role, { known = false, mini = false } = {}) {
    const el = document.createElement('div');
    el.className = `card${mini ? ' card--mini' : ''}`;
    const inner = document.createElement('div');
    inner.className = 'card-inner';
    const back = document.createElement('div');
    back.className = 'face face-back';
    back.innerHTML = cardBackHTML();
    const front = document.createElement('div');
    front.className = 'face face-front';
    if (known && role) front.innerHTML = cardFrontHTML(role);
    inner.append(back, front);
    const lost = document.createElement('span');
    lost.className = 'stamp stamp--lost';
    lost.textContent = 'Lost';
    const proven = document.createElement('span');
    proven.className = 'stamp stamp--proven';
    proven.textContent = 'Proven';
    el.append(inner, lost, proven);
    const node = { el, front, role: known ? role : null, mounted: false };
    if (known) el.classList.add('show-front');
    return node;
  }

  /* ================= render state ================= */

  update(game) {
    if (!game || !this.game) return;
    this.game = game;

    for (const player of game.players) {
      if (player.isHuman) {
        this.updateYou(player, game);
        continue;
      }
      const pod = this.pods.get(player.id);
      if (!pod) continue;
      pod.el.classList.toggle('active', game.turnIndex === player.id && !game.over && !player.eliminated);
      pod.el.classList.toggle('eliminated', player.eliminated);
      pod.el.classList.toggle('is-human-turn', false);

      const hidden = player.cards.filter(c => !c.revealed).length;
      pod.coins.textContent = player.coins;
      pod.influence.innerHTML = this.pips(hidden);
      player.cards.forEach((card, i) => {
        const node = pod.cards[i];
        if (node) this.updateCard(node, card, { known: false, player });
      });

      if (pod.lastCoins !== player.coins) {
        pod.lastCoins = player.coins;
      }
    }

    const deckCount = game.deck.length;
    if (this.deckCountEl.textContent !== String(deckCount)) {
      this.deckCountEl.textContent = deckCount;
      const deck = this.$('deck');
      deck.classList.remove('deck-pulse');
      void deck.offsetWidth;
      deck.classList.add('deck-pulse');
    }

    this.updateStatus(game);
  }

  updateYou(player, game) {
    if (!this.youCoinsEl) return;
    this.youCoinsEl.textContent = player.coins;
    const hidden = player.cards.filter(c => !c.revealed).length;
    this.youInfluenceEl.innerHTML = `${this.pips(hidden)}<span class="influence-label">${hidden} influence</span>`;
    this.youPlate.classList.toggle('active', game.turnIndex === player.id && !game.over);
    this.youPlate.classList.toggle('eliminated', player.eliminated);
    this.handEl.classList.toggle('active', game.turnIndex === player.id && !game.over);

    player.cards.forEach((card, i) => {
      const node = this.handNodes[i];
      if (!node) return;
      this.updateCard(node, card, { known: true, player });
      const selectable = this.selectable && this.selectable.has(i);
      node.el.classList.toggle('selectable', !!selectable);
    });
  }

  updateCard(node, card, { known = false } = {}) {
    const visible = known || card.revealed || card.proven;
    if (visible) {
      if (node.role !== card.role) {
        node.front.innerHTML = cardFrontHTML(card.role);
        node.role = card.role;
        if (node.mounted) {
          node.el.classList.add('role-swap');
          setTimeout(() => node.el.classList.remove('role-swap'), 800);
        }
      }
    }
    node.el.classList.toggle('show-front', visible);
    node.el.classList.toggle('lost', !!card.revealed && !card.proven);
    node.el.classList.toggle('proven', !!card.proven);
  }

  pips(hidden) {
    let out = '';
    for (let i = 0; i < 2; i++) {
      out += `<i class="pip${i < hidden ? ' pip--full' : ''}"></i>`;
    }
    return out;
  }

  updateStatus(game) {
    const aliveCount = typeof game.alive === 'function'
      ? game.alive().length
      : game.players.filter(p => !p.eliminated).length;
    if (game.over) {
      this.statusEyebrow.textContent = 'The court is decided';
      const winner = game.winnerId != null ? game.players[game.winnerId] : null;
      const secondPerson = winner && (typeof game.isSecondPerson === 'function'
        ? game.isSecondPerson(winner)
        : winner.isHuman && winner.name.trim().toLowerCase() === 'you');
      this.statusText.textContent = winner
        ? (secondPerson ? 'You stand alone' : `${winner.name} stands alone`)
        : 'Your influence is spent';
      this.statusSub.textContent = 'The dust settles…';
      return;
    }
    const active = game.players[game.turnIndex];
    this.statusEyebrow.textContent = active.isHuman ? 'Your move' : `${active.name} is thinking`;
    this.statusText.textContent = active.isHuman ? 'Choose your action' : 'The court waits…';
    this.statusSub.textContent = `Turn ${game.turnCount} · ${aliveCount} in the court · ${game.deck.length} cards unseen`;
    this.youPlate?.classList.toggle('is-turn', active.isHuman);
  }

  /* ================= log ================= */

  addLog(entry) {
    if (!entry) return;
    const nearBottom = this.logList.scrollHeight - this.logList.scrollTop - this.logList.clientHeight < 90;
    let el;
    if (entry.cls === 'sep') {
      el = document.createElement('div');
      el.className = 'log-sep';
      el.innerHTML = `<span>${esc(entry.label || '')}</span>`;
    } else {
      el = document.createElement('div');
      el.className = `log-entry ${entry.cls || ''}`;
      el.innerHTML = entry.html || '';
    }
    this.logList.append(el);
    while (this.logList.children.length > 140) this.logList.firstChild.remove();
    if (nearBottom) this.logList.scrollTop = this.logList.scrollHeight;
  }

  /* ================= banners & effects ================= */

  banner({ title, sub, tone = 'gold' }) {
    if (!this.bannerLayer) return;
    const el = document.createElement('div');
    el.className = `banner banner--${tone}`;
    el.innerHTML = `<span class="banner-title">${esc(title)}</span><span class="banner-sub">${esc(sub || '')}</span>`;
    this.bannerLayer.append(el);

    const flash = { danger: 'flash-danger', fail: 'flash-danger', eliminate: 'flash-danger', prove: 'flash-prove', block: 'flash-block' }[tone];
    if (flash) {
      const table = this.$('table');
      table.classList.remove('flash-danger', 'flash-prove', 'flash-block');
      void table.offsetWidth;
      table.classList.add(flash);
      setTimeout(() => table.classList.remove(flash), 700);
    }

    setTimeout(() => el.classList.add('leaving'), 1150);
    setTimeout(() => el.remove(), 1650);
    while (this.bannerLayer.children.length > 2) this.bannerLayer.firstChild.remove();
  }

  fx(event) {
    if (!event) return;
    if (event.type === 'coins') {
      this.floatCoins(event.playerId, event.delta);
    } else if (event.type === 'prove' || event.type === 'lose' || event.type === 'eliminate') {
      this.flashPlayer(event.playerId, event.type);
    } else if (event.type === 'redraw' || event.type === 'exchange') {
      const hand = this.$('deck');
      hand?.classList.add('deck-pulse');
      setTimeout(() => hand?.classList.remove('deck-pulse'), 700);
    } else if (event.type === 'action') {
      this.flashPlayer(event.playerId, 'action');
    }
  }

  floatCoins(playerId, delta) {
    if (!delta) return;
    const anchor = playerId === this.game?.human?.id
      ? this.youPlate?.querySelector('.you-stats')
      : this.pods.get(playerId)?.el.querySelector('.pod-foot');
    if (!anchor) return;
    const el = document.createElement('span');
    el.className = `coin-float ${delta > 0 ? 'plus' : 'minus'}`;
    el.textContent = `${delta > 0 ? '+' : '−'}${Math.abs(delta)}`;
    anchor.append(el);
    setTimeout(() => el.remove(), 1000);
    anchor.closest('.player-pod, .you-plate')?.classList.add('coin-bump');
    setTimeout(() => anchor.closest('.player-pod, .you-plate')?.classList.remove('coin-bump'), 300);
  }

  flashPlayer(playerId, kind) {
    const el = playerId === this.game?.human?.id
      ? this.youPlate
      : this.pods.get(playerId)?.el;
    if (!el) return;
    el.classList.remove(`fx-${kind}`);
    void el.offsetWidth;
    el.classList.add(`fx-${kind}`);
    setTimeout(() => el.classList.remove(`fx-${kind}`), 900);
  }

  /* ================= prompts ================= */

  ask(decision) {
    return new Promise(resolve => {
      this.clearPromptTimer();
      this.pending = { decision, resolve };
      this.selectable = null;
      this.clearSelectable();
      this.promptStatus(decision);
      Sound.play('click');
      switch (decision.kind) {
        case 'action': this.renderActionDock(decision); break;
        case 'challenge': this.renderChallengeDock(decision); break;
        case 'block': this.renderBlockDock(decision); break;
        case 'loseInfluence': this.renderLoseDock(decision); break;
        case 'exchange': this.renderExchange(decision); break;
        default:
          this.resolve(null);
      }
      if (this.pending) this.startPromptTimer(decision.timeoutMs);
    });
  }

  startPromptTimer(ms) {
    this.clearPromptTimer();
    if (!ms || ms < 1000 || !this.pending) return;
    const target = this.dock.querySelector('.dock-inner') || this.modalRoot.querySelector('.modal-panel');
    if (!target) return;
    const bar = document.createElement('div');
    bar.className = 'prompt-timer';
    bar.innerHTML = '<i></i>';
    target.append(bar);
    const fill = bar.firstElementChild;
    // Force layout before starting the transition.
    void fill.offsetWidth;
    requestAnimationFrame(() => {
      fill.style.transitionDuration = `${ms}ms`;
      fill.style.width = '0%';
    });
    this.promptTimerEl = bar;
  }

  clearPromptTimer() {
    if (this.promptTimerEl) {
      this.promptTimerEl.remove();
      this.promptTimerEl = null;
    }
  }

  promptStatus(d) {
    const actor = this.game?.players[d.actorId];
    const role = d.role ? CHARACTERS[d.role]?.name : '';
    const alive = this.game
      ? (typeof this.game.alive === 'function' ? this.game.alive().length : this.game.players.filter(p => !p.eliminated).length)
      : 0;
    if (d.kind === 'action') {
      this.statusEyebrow.textContent = 'Your turn';
      this.statusText.textContent = 'Choose your move';
      this.statusSub.textContent = d.mustCoup
        ? 'A coup is mandatory'
        : `Turn ${this.game.turnCount} · ${alive} in the court`;
    } else if (d.kind === 'challenge') {
      this.statusEyebrow.textContent = 'A claim on the table';
      this.statusText.textContent = 'Challenge or allow?';
      this.statusSub.textContent = `${actor ? actor.name : 'Someone'} claims the ${role}`;
    } else if (d.kind === 'block') {
      this.statusEyebrow.textContent = 'Your decision';
      this.statusText.textContent = 'Block or allow?';
      this.statusSub.textContent = d.action === 'foreignAid' ? 'The Duke may intervene' : 'A character may save you';
    } else if (d.kind === 'loseInfluence') {
      this.statusEyebrow.textContent = 'Influence lost';
      this.statusText.textContent = 'Surrender a card';
      this.statusSub.textContent = REASON_TEXT[d.reason] || 'The court demands payment';
    } else if (d.kind === 'exchange') {
      this.statusEyebrow.textContent = 'The Ambassador';
      this.statusText.textContent = 'Exchange with the Court';
      this.statusSub.textContent = 'Keep what serves you';
    }
  }

  cancelPending() {
    if (!this.pending) return;
    const { resolve } = this.pending;
    this.pending = null;
    this.selectable = null;
    this.clearSelectable();
    this.clearPromptTimer();
    this.dock.innerHTML = '';
    this.dock.classList.remove('visible');
    resolve(null);
  }

  resolve(value) {
    if (!this.pending) return;
    const { resolve } = this.pending;
    this.pending = null;
    this.selectable = null;
    this.clearSelectable();
    this.clearPromptTimer();
    this.dock.innerHTML = '';
    this.dock.classList.remove('visible');
    if (this.modalRoot.classList.contains('open')) this.closeModal();
    resolve(value);
  }

  clearSelectable() {
    this.handNodes.forEach(node => node.el.classList.remove('selectable'));
  }

  renderActionDock(d) {
    const me = this.game.players[d.playerId];
    const actions = d.actions;
    const grid = actions.map(a => {
      const accent = a.role ? CHARACTERS[a.role].accent : (a.type === 'coup' ? '#c14a4a' : '#c9a75b');
      const bright = a.role ? CHARACTERS[a.role].accentBright : '#f0dca4';
      const icon = a.role ? roleIcon(a.role) : (UI_ICONS[a.type === 'income' ? 'coin' : a.type === 'foreignAid' ? 'coins' : 'crown']);
      const roleName = a.role ? `<em>${CHARACTERS[a.role].name}</em>` : '';
      return `<button class="action-btn tone-${a.tone}" data-action="${a.type}" style="--accent:${accent};--accent-bright:${bright}" ${a.enabled === false ? 'disabled' : ''}>
        <span class="a-icon">${icon}</span>
        <span class="a-body">
          <span class="a-title">${a.title} ${roleName}</span>
          <span class="a-desc">${a.enabled === false ? a.reason : a.desc}</span>
        </span>
        ${a.cost ? `<span class="a-cost"><i class="coin"></i>${a.cost}</span>` : ''}
      </button>`;
    }).join('');

    this.dock.innerHTML = `<div class="dock-inner">
      <div class="dock-head">
        <div>
          <span class="eyebrow">Your turn</span>
          <h3>Choose your move</h3>
        </div>
        <div class="dock-meta">
          <span class="coin-chip"><i class="coin"></i>${me.coins}</span>
          <span class="dock-hint">Bluff freely. Just don't get caught.</span>
        </div>
      </div>
      ${d.mustCoup ? `<div class="dock-alert">You hold 10+ coins — a coup is mandatory.</div>` : ''}
      <div class="actions-grid">${grid}</div>
    </div>`;
    this.dock.classList.add('visible');

    this.dock.querySelectorAll('.action-btn:not([disabled])').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = actions.find(a => a.type === btn.dataset.action);
        if (!action) return;
        Sound.play('click');
        if (action.target) this.renderTargetDock(d, action);
        else this.resolve({ type: action.type });
      });
    });
  }

  renderTargetDock(d, action) {
    const targets = this.game.players.filter(p => !p.eliminated && p.id !== d.playerId);
    const cards = targets.map(p => {
      const hidden = p.cards.filter(c => !c.revealed).length;
      return `<button class="target-btn" data-target="${p.id}" style="--pc:${p.color}">
        <span class="avatar">${esc(p.name.charAt(0).toUpperCase())}</span>
        <span class="target-id">
          <span class="target-name">${esc(p.name)}</span>
          <span class="target-sub">${p.coins} coins · ${hidden} influence${hidden === 1 ? ' — last card!' : ''}</span>
        </span>
        <span class="target-pips">${this.pips(hidden)}</span>
      </button>`;
    }).join('');

    this.dock.innerHTML = `<div class="dock-inner">
      <div class="dock-head">
        <button class="back-btn" id="targetBack" aria-label="Back">${UI_ICONS.back}</button>
        <div>
          <span class="eyebrow">${action.title} · choose a target</span>
          <h3>Who feels the blow?</h3>
        </div>
      </div>
      <div class="target-grid">${cards}</div>
    </div>`;
    this.dock.classList.add('visible');

    this.$('targetBack').addEventListener('click', () => {
      Sound.play('click');
      this.renderActionDock(d);
    });
    this.dock.querySelectorAll('.target-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Sound.play('click');
        this.resolve({ type: action.type, targetId: Number(btn.dataset.target) });
      });
    });
  }

  renderChallengeDock(d) {
    const actor = this.game.players[d.actorId];
    const c = CHARACTERS[d.role];
    const actionTitle = ACTIONS[d.type] ? ACTIONS[d.type].title : 'action';
    let context;
    if (d.claimKind === 'block') {
      context = d.blockedPlayerId != null && d.blockedPlayerId === this.game.human?.id
        ? `${actor.name} claims the ${c.name} to block your ${actionTitle}.`
        : `${actor.name} claims the ${c.name} to block the ${actionTitle}.`;
    } else {
      context = `${actor.name} claims the ${c.name} for ${actionTitle}.`;
    }

    this.dock.innerHTML = `<div class="dock-inner dock--challenge">
      <div class="dock-head">
        <div>
          <span class="eyebrow">A claim is on the table</span>
          <h3>Do you believe them?</h3>
        </div>
        <span class="role-chip" style="--rc:${c.accent};--rb:${c.accentBright}">${roleIcon(d.role)}${c.name}</span>
      </div>
      <p class="dock-text">${esc(context)}</p>
      <div class="dock-actions">
        <button class="btn btn-danger" id="challengeYes">Challenge</button>
        <button class="btn btn-ghost" id="challengeNo">Allow it</button>
      </div>
      <p class="dock-note">If you challenge and they hold the ${c.name}, you lose an influence.</p>
      <span class="dock-emblem" style="--rc:${c.accent}">${roleIcon(d.role)}</span>
    </div>`;
    this.dock.classList.add('visible');
    this.$('challengeYes').addEventListener('click', () => { Sound.play('challenge'); this.resolve(true); });
    this.$('challengeNo').addEventListener('click', () => { Sound.play('click'); this.resolve(false); });
  }

  renderBlockDock(d) {
    const actor = this.game.players[d.actorId];
    const human = this.game.human;
    let title;
    let text;
    if (d.action === 'foreignAid') {
      title = `${actor.name} takes Foreign Aid`;
      text = 'You may claim the Duke to block the two coins.';
    } else if (d.action === 'steal') {
      title = `${actor.name} steals from you`;
      text = 'Claim the Captain or the Ambassador to stop the theft.';
    } else {
      title = `${actor.name} sends an assassin`;
      text = 'Claim the Contessa to block the assassination.';
    }
    if (d.action !== 'foreignAid' && d.targetId !== human?.id) {
      title = `${actor.name} moves against ${this.game.players[d.targetId]?.name || 'a rival'}`;
    }

    const buttons = d.roles.map(role => {
      const c = CHARACTERS[role];
      return `<button class="btn btn-block-role" data-block="${role}" style="--rc:${c.accent};--rb:${c.accentBright}">
        <span class="role-chip role-chip--sm">${roleIcon(role)}${c.name}</span>
        <span>Block with ${c.name}</span>
      </button>`;
    }).join('');

    this.dock.innerHTML = `<div class="dock-inner dock--block">
      <div class="dock-head">
        <div>
          <span class="eyebrow">${d.action === 'foreignAid' ? 'An opening at the table' : 'A move against you'}</span>
          <h3>${esc(title)}</h3>
        </div>
        <span class="role-chip role-chip--ghost">${UI_ICONS.sword}${ACTIONS[d.action]?.title || ''}</span>
      </div>
      <p class="dock-text">${esc(text)}</p>
      <div class="dock-actions dock-actions--wrap">
        ${buttons}
        <button class="btn btn-ghost" id="blockNo">Let it happen</button>
      </div>
      <p class="dock-note">A block is a claim too — it can be challenged.</p>
      <span class="dock-emblem" style="--rc:#d7b46a">${UI_ICONS.sword}</span>
    </div>`;
    this.dock.classList.add('visible');
    this.dock.querySelectorAll('[data-block]').forEach(btn => {
      btn.addEventListener('click', () => { Sound.play('click'); this.resolve(btn.dataset.block); });
    });
    this.$('blockNo').addEventListener('click', () => { Sound.play('click'); this.resolve(null); });
  }

  renderLoseDock(d) {
    const indices = d.options.map(o => o.index);
    this.selectable = new Set(indices);
    this.handNodes.forEach(node => {
      node.el.classList.toggle('selectable', this.selectable.has(Number(node.el.dataset.index)));
    });
    const reason = REASON_TEXT[d.reason] || 'The court demands payment.';
    const buttons = d.options.map(o => {
      const c = CHARACTERS[o.role];
      return `<button class="lose-role" data-index="${o.index}" style="--rc:${c.accent};--rb:${c.accentBright}">
        ${roleIcon(o.role)}<span>${c.name}</span>
      </button>`;
    }).join('');

    this.dock.innerHTML = `<div class="dock-inner dock--lose">
      <div class="dock-head">
        <div>
          <span class="eyebrow">Influence lost</span>
          <h3>Surrender an influence</h3>
        </div>
        <span class="role-chip role-chip--ghost">${UI_ICONS.sword}Choose</span>
      </div>
      <p class="dock-text">${esc(reason)}</p>
      <div class="lose-options">${buttons}</div>
      <p class="dock-note">Or select one of your cards below.</p>
    </div>`;
    this.dock.classList.add('visible');

    this.dock.querySelectorAll('.lose-role').forEach(btn => {
      btn.addEventListener('click', () => { Sound.play('click'); this.resolve(Number(btn.dataset.index)); });
    });
  }

  renderExchange(d) {
    const panelHtml = `<div class="modal-head">
        <span class="eyebrow">The Ambassador</span>
        <h2>Exchange with the Court</h2>
        <p>Keep <b>${d.keepCount}</b> cards. The rest return to the deck.</p>
      </div>
      <div class="exchange-grid" id="exchangeGrid"></div>
      <div class="exchange-foot">
        <span class="exchange-count" id="exchangeCount"></span>
        <button class="btn btn-primary" id="exchangeConfirm">Keep selected</button>
      </div>`;
    const { panel, backdrop } = this.openModal(panelHtml, { className: 'modal-panel--exchange', dismissible: false });
    const grid = panel.querySelector('#exchangeGrid');
    const countEl = panel.querySelector('#exchangeCount');
    const confirm = panel.querySelector('#exchangeConfirm');
    const selected = new Set();
    const nodeByIndex = new Map();
    for (let i = 0; i < d.keepCount; i++) selected.add(i);

    d.options.forEach((option, index) => {
      const node = this.createCard(option.role, { known: true });
      nodeByIndex.set(index, node);
      node.el.classList.add('card--pick', 'show-front');
      if (option.source === 'court') node.el.classList.add('from-court');
      if (selected.has(index)) node.el.classList.add('selected');
      node.el.tabIndex = 0;
      node.el.setAttribute('role', 'button');
      node.el.setAttribute('aria-pressed', String(selected.has(index)));
      node.el.setAttribute('aria-label', `${CHARACTERS[option.role].name}${option.source === 'court' ? ', from the court' : ', from your hand'}`);
      const badge = document.createElement('span');
      badge.className = 'pick-badge';
      badge.textContent = option.source === 'court' ? 'From the Court' : 'Your hand';
      node.el.append(badge);

      const toggle = () => {
        Sound.play('click');
        if (selected.has(index)) {
          selected.delete(index);
          node.el.classList.remove('selected');
        } else {
          // At capacity, swap out the oldest pick so choosing is frictionless.
          if (selected.size >= d.keepCount) {
            const oldest = selected.values().next().value;
            selected.delete(oldest);
            const oldNode = nodeByIndex.get(oldest);
            if (oldNode) {
              oldNode.el.classList.remove('selected');
              oldNode.el.setAttribute('aria-pressed', 'false');
            }
          }
          selected.add(index);
          node.el.classList.add('selected');
        }
        node.el.setAttribute('aria-pressed', String(selected.has(index)));
        refresh();
      };
      node.el.addEventListener('click', toggle);
      node.el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
      grid.append(node.el);
    });

    const refresh = () => {
      countEl.textContent = `${selected.size} of ${d.keepCount} kept`;
      confirm.disabled = selected.size !== d.keepCount;
    };
    refresh();

    confirm.addEventListener('click', () => {
      if (selected.size !== d.keepCount) return;
      Sound.play('coin');
      const keep = [...selected].sort((a, b) => a - b);
      this.closeModal();
      this.resolve(keep);
    });
    backdrop.classList.add('exchange-backdrop');
  }

  /* ================= modals ================= */

  openModal(html, { dismissible = false, className = '' } = {}) {
    this.modalRoot.innerHTML = `<div class="modal-backdrop"><div class="modal-panel ${className}" role="dialog" aria-modal="true">${html}</div></div>`;
    this.modalRoot.classList.add('open');
    this.modalDismissible = dismissible;
    const backdrop = this.modalRoot.querySelector('.modal-backdrop');
    const panel = this.modalRoot.querySelector('.modal-panel');
    if (dismissible) {
      backdrop.addEventListener('click', e => {
        if (e.target === backdrop) this.closeModal();
      });
      panel.querySelectorAll('[data-close]').forEach(btn => btn.addEventListener('click', () => this.closeModal()));
    }
    return { backdrop, panel };
  }

  closeModal() {
    this.modalRoot.classList.remove('open');
    this.modalRoot.innerHTML = '';
    this.modalDismissible = false;
  }

  openRules() {
    const rows = ROLES.map(role => {
      const c = CHARACTERS[role];
      return `<div class="rules-role" style="--rc:${c.accent};--rb:${c.accentBright}">
        <span class="rules-icon">${c.icon}</span>
        <div>
          <b>${c.name}</b>
          <span>${c.ability === 'Counter' ? 'Blocks assassination' : `${c.ability} — ${c.detail}`}</span>
          ${c.block ? `<em>${c.block}</em>` : ''}
        </div>
      </div>`;
    }).join('');

    const html = `<div class="modal-head">
        <span class="eyebrow">How to play</span>
        <h2>Coup</h2>
        <p class="modal-lede">A game of influence, deception and nerve. Be the last player with a face-down card.</p>
        <button class="modal-close" data-close aria-label="Close">${UI_ICONS.close}</button>
      </div>
      <div class="rules-scroll">
        <section>
          <h3>The seat of power</h3>
          <p>Each player begins with <b>2 coins</b> and <b>2 influence cards</b>, face down. The deck holds three copies of each of the five characters. Revealed cards are out of play — lose both and you are eliminated.</p>
        </section>
        <section>
          <h3>On your turn</h3>
          <p>Take one action — core or character. You may claim <i>any</i> character, whether you hold it or not.</p>
          <ul class="rules-list">
            <li><b>Income</b> — take 1 coin.</li>
            <li><b>Foreign Aid</b> — take 2 coins. A Duke may block.</li>
            <li><b>Coup</b> — pay 7, force an influence loss. Cannot be challenged or blocked. At 10+ coins it is mandatory.</li>
            <li><b>Tax</b> <span>(Duke)</span> — take 3 coins.</li>
            <li><b>Assassinate</b> <span>(Assassin)</span> — pay 3, force an influence loss. A Contessa may block.</li>
            <li><b>Steal</b> <span>(Captain)</span> — take 2 coins. A Captain or Ambassador may block.</li>
            <li><b>Exchange</b> <span>(Ambassador)</span> — draw 2, keep what you like, return 2.</li>
          </ul>
        </section>
        <section>
          <h3>Challenges</h3>
          <p>Anyone may challenge a character claim. The claimant must reveal that character. If they hold it, the challenger loses an influence and the revealed card returns to the deck for a replacement. If they do not, the claimant loses an influence and the action fails. Costs are refunded if the action is caught as a bluff.</p>
        </section>
        <section>
          <h3>Blocks</h3>
          <p>Blocks are claims too. Block a foreign aid with the Duke, an assassination with the Contessa, a theft with the Captain or Ambassador. The acting player — or anyone else — may challenge the block. A failed block loses an influence; a proven block stops the action.</p>
        </section>
        <section>
          <h3>The characters</h3>
          <div class="rules-roles">${rows}</div>
        </section>
        <p class="rules-foot">Influence lost is chosen by its owner. The last player with a face-down influence wins.</p>
      </div>`;
    const { panel } = this.openModal(html, { dismissible: true, className: 'modal-panel--rules' });
    panel.querySelector('.modal-close')?.focus?.();
  }

  openGameMenu() {
    if (this.mode === 'online') {
      const html = `<div class="modal-head">
          <span class="eyebrow">Online table</span>
          <h2>Leave the room?</h2>
          <p>Leaving gives up your seat. You can only rejoin while the host keeps the room open.</p>
          <button class="modal-close" data-close aria-label="Close">${UI_ICONS.close}</button>
        </div>
        <div class="menu-actions">
          <button class="btn btn-primary" data-close>Back to game</button>
          <button class="btn btn-ghost" id="menuRules">How to play</button>
          <button class="btn btn-danger" id="menuLeaveOnline">Leave room</button>
        </div>`;
      const { panel } = this.openModal(html, { dismissible: true, className: 'modal-panel--small' });
      panel.querySelector('#menuRules').addEventListener('click', () => {
        this.closeModal();
        this.openRules();
      });
      panel.querySelector('#menuLeaveOnline').addEventListener('click', () => {
        this.closeModal();
        this.handlers.onLeaveOnline?.();
      });
      return;
    }

    const html = `<div class="modal-head">
        <span class="eyebrow">The table</span>
        <h2>Leave the court?</h2>
        <p>Your current game will be abandoned.</p>
        <button class="modal-close" data-close aria-label="Close">${UI_ICONS.close}</button>
      </div>
      <div class="menu-actions">
        <button class="btn btn-primary" id="menuRestart">New game</button>
        <button class="btn btn-ghost" id="menuRules">How to play</button>
        <button class="btn btn-ghost" id="menuMain">Main menu</button>
      </div>`;
    const { panel } = this.openModal(html, { dismissible: true, className: 'modal-panel--small' });
    panel.querySelector('#menuRestart').addEventListener('click', () => {
      this.closeModal();
      this.handlers.onRematch?.();
    });
    panel.querySelector('#menuMain').addEventListener('click', () => {
      this.closeModal();
      this.handlers.onMenu?.();
    });
    panel.querySelector('#menuRules').addEventListener('click', () => {
      this.closeModal();
      this.openRules();
    });
  }

  /* ================= game over ================= */

  gameOver(winner, reason, options = {}) {
    const game = this.game;
    setTimeout(() => {
      if (!game || this.game !== game) return;
      const human = game.human;
      const humanWon = !!(winner && human && winner.id === human.id);
      const ranked = [...game.players].sort((a, b) => {
        if (winner && a.id === winner.id) return -1;
        if (winner && b.id === winner.id) return 1;
        if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
        const ai = a.cards.filter(c => !c.revealed).length;
        const bi = b.cards.filter(c => !c.revealed).length;
        return bi - ai || b.coins - a.coins;
      });

      const standing = ranked.map((p, i) => {
        const hidden = p.cards.filter(c => !c.revealed).length;
        const isWinner = winner && p.id === winner.id;
        const youTag = p.isHuman && p.name.trim().toLowerCase() !== 'you' ? ' <em>you</em>' : '';
        return `<div class="standing ${p.isHuman ? 'standing--you' : ''} ${p.eliminated ? 'out' : ''} ${isWinner ? 'standing--winner' : ''}">
          <span class="standing-rank">${i + 1}</span>
          <span class="avatar" style="--pc:${p.color}">${esc(p.name.charAt(0).toUpperCase())}</span>
          <span class="standing-name">${esc(p.name)}${youTag}${isWinner ? `<span class="standing-crown">${UI_ICONS.crown}</span>` : ''}</span>
          <span class="standing-coins"><i class="coin"></i>${p.coins}</span>
          <span class="standing-pips">${this.pips(hidden)}</span>
        </div>`;
      }).join('');

      let eyebrow = 'The court is decided';
      let title = 'Defeat';
      let subtitle;
      if (humanWon) {
        eyebrow = 'Last influence standing';
        title = 'Victory';
        subtitle = 'The court is yours. Every bluff paid off.';
      } else if (winner) {
        subtitle = `${winner.name} holds the last influence.`;
      } else {
        eyebrow = 'Your influence is spent';
        title = 'Defeat';
        subtitle = 'The court moves on without you.';
      }

      const custom = Array.isArray(options.actions) && options.actions.length ? options.actions : null;
      const actionsHtml = custom
        ? custom.map((action, index) => {
            const cls = action.kind === 'primary' ? 'btn-primary' : action.kind === 'link' ? 'btn-link' : action.kind === 'danger' ? 'btn-danger' : 'btn-ghost';
            return `<button class="btn ${cls}" data-over-action="${index}">${esc(action.label)}</button>`;
          }).join('')
        : `<button class="btn btn-primary" id="overRematch">Play again</button>
           <button class="btn btn-ghost" id="overMenu">Main menu</button>`;

      const html = `<div class="gameover-panel">
        <span class="eyebrow">${eyebrow}</span>
        <h2 class="gameover-title ${humanWon ? 'victory' : ''}">${title}</h2>
        <p class="gameover-sub">${esc(subtitle)}</p>
        <div class="standings">${standing}</div>
        <div class="gameover-actions ${custom && custom.length > 2 ? 'gameover-actions--multi' : ''}">${actionsHtml}</div>
      </div>`;

      const { backdrop, panel } = this.openModal(html, { dismissible: false, className: 'modal-panel--gameover' });
      backdrop.classList.add('gameover-backdrop');

      if (custom) {
        custom.forEach((action, index) => {
          panel.querySelector(`[data-over-action="${index}"]`)?.addEventListener('click', () => {
            Sound.play('click');
            if (!action.keepOpen) this.closeModal();
            action.onClick?.();
          });
        });
      } else {
        panel.querySelector('#overRematch').addEventListener('click', () => { Sound.play('click'); this.closeModal(); this.handlers.onRematch?.(); });
        panel.querySelector('#overMenu').addEventListener('click', () => { Sound.play('click'); this.closeModal(); this.handlers.onMenu?.(); });
      }

      if (humanWon) {
        Sound.play('win');
        this.confetti();
      } else {
        Sound.play('defeat');
      }
    }, options.delay === undefined ? 950 : options.delay);
  }

  toast(message, tone = 'gold', ms = 2800) {
    const root = this.$('toastRoot');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast toast--${tone}`;
    el.textContent = message;
    root.append(el);
    while (root.children.length > 3) root.firstChild.remove();
    setTimeout(() => el.classList.add('leaving'), Math.max(300, ms - 380));
    setTimeout(() => el.remove(), ms);
  }

  confetti() {
    const root = document.createElement('div');
    root.className = 'confetti';
    const colors = ['#d7b46a', '#f4dfa3', '#fff4d0', '#c14a4a', '#8a63d2', '#4d9567'];
    for (let i = 0; i < 90; i++) {
      const piece = document.createElement('i');
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.background = colors[Math.floor(Math.random() * colors.length)];
      piece.style.animationDelay = `${Math.random() * 1.6}s`;
      piece.style.animationDuration = `${2.4 + Math.random() * 2.4}s`;
      piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 220}px`);
      piece.style.width = `${4 + Math.random() * 6}px`;
      piece.style.height = `${8 + Math.random() * 10}px`;
      root.append(piece);
    }
    document.body.append(root);
    setTimeout(() => root.remove(), 6500);
  }

  showError(err) {
    console.error(err);
    const html = `<div class="modal-head">
      <span class="eyebrow">Something broke</span>
      <h2>The court is in chaos</h2>
      <p>${esc(err?.message || 'An unexpected error occurred.')}</p>
      <button class="modal-close" data-close aria-label="Close">${UI_ICONS.close}</button>
    </div>
    <div class="menu-actions"><button class="btn btn-primary" id="errReload">Reload</button></div>`;
    const { panel } = this.openModal(html, { dismissible: true, className: 'modal-panel--small' });
    panel.querySelector('#errReload').addEventListener('click', () => window.location.reload());
  }
}
