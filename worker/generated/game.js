/* AUTO-GENERATED FILE — do not edit by hand.
   Source: public/js/cards.js + public/js/ai.js + public/js/engine.js
   Regenerate with: npm run worker:build
   The Worker uses this module as the authoritative game engine. */

/* ---- public/js/cards.js ---- */
/* ============================================================
   Coup — characters, card artwork, shared helpers
   ============================================================ */

const ROLES = ['duke', 'assassin', 'captain', 'ambassador', 'contessa'];

const CHARACTERS = {
  duke: {
    name: 'Duke',
    title: 'The Duke',
    ability: 'Tax',
    detail: 'Take 3 coins',
    block: 'Blocks Foreign Aid',
    accent: '#8a63d2',
    accentBright: '#cbb2ff',
    deep: '#22153d',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 45 9 22l13.5 10L32 15l9.5 17L55 22l-3 23Z"/>
      <path d="M12 51h40"/>
      <circle cx="9" cy="19.5" r="2.4" fill="currentColor" stroke="none"/>
      <circle cx="32" cy="12" r="2.4" fill="currentColor" stroke="none"/>
      <circle cx="55" cy="19.5" r="2.4" fill="currentColor" stroke="none"/>
      <path d="M23 38.5h18" opacity=".55"/>
      <path d="M32 33.5v5" opacity=".55"/>
    </svg>`
  },
  assassin: {
    name: 'Assassin',
    title: 'The Assassin',
    ability: 'Assassinate',
    detail: 'Pay 3 · remove an influence',
    block: '',
    accent: '#c1425b',
    accentBright: '#ff9cae',
    deep: '#390e18',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 5.5 37 19l-2.2 21h-5.6L27 19Z"/>
      <path d="M32 11v25" opacity=".45"/>
      <path d="M21 41h22"/>
      <path d="M32 41v13.5"/>
      <path d="M27.5 57.5h9"/>
      <path d="M24.5 45.5c1.5 2 4 2 5.5 1M39.5 45.5c-1.5 2-4 2-5.5 1" opacity=".45"/>
    </svg>`
  },
  captain: {
    name: 'Captain',
    title: 'The Captain',
    ability: 'Steal',
    detail: 'Take 2 coins from a rival',
    block: 'Blocks Stealing',
    accent: '#2f879b',
    accentBright: '#99ebf7',
    deep: '#082b34',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="32" cy="12" r="6"/>
      <path d="M32 18v34"/>
      <path d="M20 26h24"/>
      <path d="M14 41c0 11 8.5 17 18 17s18-6 18-17"/>
      <path d="M14 41l-4-1.5L13 47M50 41l4-1.5L51 47"/>
      <path d="M26 20.5h12" opacity=".5"/>
    </svg>`
  },
  ambassador: {
    name: 'Ambassador',
    title: 'The Ambassador',
    ability: 'Exchange',
    detail: 'Swap cards with the Court',
    block: 'Blocks Stealing',
    accent: '#4d9567',
    accentBright: '#b6efc2',
    deep: '#0d2b1e',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 13h27c3 0 5 2.4 5 5.4V46c0 3.2-2.2 5.5-5.4 5.5H20c-3.5 0-6-2.4-6-5.8V22"/>
      <path d="M14 22c0-4.8 2.6-9 8-9"/>
      <path d="M18 13v9h8"/>
      <path d="M23 25h17M23 32h17M23 39h11"/>
      <circle cx="43" cy="45" r="5.2" fill="currentColor" fill-opacity=".18"/>
      <path d="M41 45h4M43 43v4" opacity=".8"/>
    </svg>`
  },
  contessa: {
    name: 'Contessa',
    title: 'The Contessa',
    ability: 'Counter',
    detail: 'Blocks an assassination',
    block: '',
    accent: '#b45a7c',
    accentBright: '#ffc2d6',
    deep: '#3a1422',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
      <path d="M32 8c-8.6 0-15 6-15 13.4 0 7.7 6.6 12.6 15 12.6s15-4.9 15-12.6C47 14 40.6 8 32 8Z"/>
      <path d="M23 20c1.8-4.2 5.6-6.4 9.5-5.2 4 1.2 5.4 6 2.8 8.6-2.6 2.6-8.6 2-10.8-1.4-1.5-2.3-1-4.5.5-5.8"/>
      <path d="M32 34v22"/>
      <path d="M32 42c-8-2-12.8 2-15 9 8.6 2.4 13.2-1.8 15-9Z"/>
      <path d="M32 48c7-1.8 11.4 1.4 13.4 7.6-7.8 2.2-12-1.4-13.4-7.6Z"/>
      <path d="M32 37c-5-3-9-2-12 1M32 40c4-2.4 7.4-1.6 9.6.6" opacity=".5"/>
    </svg>`
  }
};

/* Classic script friendly card face markup. */
function cardFrontHTML(role, extraClass = '') {
  const c = CHARACTERS[role];
  if (!c) return '';
  return `<div class="card-front ${extraClass}" style="--accent:${c.accent};--accent-bright:${c.accentBright};--accent-deep:${c.deep}">
    <div class="cf-wash"></div>
    <div class="cf-frame"></div>
    <span class="cf-corner cf-corner--tl">✦</span>
    <span class="cf-corner cf-corner--br">✦</span>
    <div class="cf-crest">${c.icon}</div>
    <div class="cf-name">${c.name}</div>
    <div class="cf-rule"><i></i><span>✦</span><i></i></div>
    <div class="cf-ability"><b>${c.ability}</b><span>${c.detail}</span></div>
    ${c.block ? `<div class="cf-block">${c.block}</div>` : `<div class="cf-block cf-block--empty">Influence</div>`}
  </div>`;
}

function cardBackHTML() {
  return `<div class="card-back">
    <div class="cb-lattice"></div>
    <div class="cb-ring"></div>
    <div class="cb-sigil">
      <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 42 13 24l10.5 8L32 19l8.5 13L51 24l-3 18Z"/>
        <path d="M16 47h32"/>
        <circle cx="32" cy="16" r="1.8" fill="currentColor" stroke="none"/>
      </svg>
    </div>
    <div class="cb-word">COUP</div>
    <div class="cb-stars">✦</div>
  </div>`;
}

function roleIcon(role) {
  return CHARACTERS[role] ? CHARACTERS[role].icon : '';
}

/* Shared small helpers */
function esc(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shuffleCopy(arr) {
  return shuffle(arr.slice());
}


/* ---- public/js/ai.js ---- */
/* ============================================================
   Coup — AI opponents
   Sees only public information plus its own hand.
   ============================================================ */

const DIFFICULTY = {
  easy:   { key: 'easy',   challenge: 0.25, think: [280, 540], mistake: 0.22 },
  normal: { key: 'normal', challenge: 0.37, think: [360, 680], mistake: 0.08 },
  hard:   { key: 'hard',   challenge: 0.49, think: [330, 600], mistake: 0.02 }
};

const ROLE_KEEP_VALUE = {
  duke: 3.0,
  captain: 2.8,
  assassin: 2.6,
  contessa: 2.35,
  ambassador: 2.05
};

class CoupAI {
  constructor(profile = {}, difficulty = 'normal') {
    this.p = {
      bluff: 0.5,
      skeptic: 0.5,
      aggression: 0.5,
      ...profile
    };
    this.diff = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  }

  async decide(d) {
    const [lo, hi] = this.diff.think;
    await sleep(lo + Math.random() * (hi - lo));
    switch (d.kind) {
      case 'action': return this.chooseAction(d);
      case 'challenge': return this.chooseChallenge(d);
      case 'block': return this.chooseBlock(d);
      case 'loseInfluence': return this.chooseLoseInfluence(d);
      case 'exchange': return this.chooseExchange(d);
      default: return null;
    }
  }

  /* ---------- probability: does the actor hold this role? ---------- */

  roleProbability(role, actorHidden, view) {
    let revealed = 0;
    for (const p of view.players) {
      revealed += p.revealed.filter(r => r === role).length;
    }
    const mine = view.me.hidden.filter(r => r === role).length;
    const remaining = Math.max(0, 3 - revealed - mine);
    if (remaining === 0 || actorHidden === 0) return 0;

    const unknown = view.players
      .filter(p => p.id !== view.me.id)
      .reduce((sum, p) => sum + p.hiddenCount, 0) + view.deckCount;
    if (unknown <= 0) return 0;

    let none = 1;
    for (let i = 0; i < remaining; i++) {
      const numerator = Math.max(0, unknown - actorHidden - i);
      const denominator = unknown - i;
      none *= denominator > 0 ? numerator / denominator : 0;
    }
    return Math.max(0, Math.min(1, 1 - none));
  }

  /* ---------- action selection ---------- */

  chooseAction(d) {
    const view = d.view;
    const me = view.me;
    const others = view.players.filter(p => p.id !== me.id && !p.eliminated);
    if (!others.length) return null;

    const available = d.actions.filter(a => a.enabled !== false);
    if (!available.length) return { type: 'coup', targetId: others[0].id };

    if (d.mustCoup) {
      return { type: 'coup', targetId: this.pickTarget(others, 'coup') };
    }

    const has = role => me.hidden.includes(role);
    const influence = me.hidden.length;

    const coupTarget = this.pickTarget(others, 'coup');
    const strikeTarget = this.pickTarget(others, 'strike');
    const stealTargetPlayer = others.slice().sort((a, b) =>
      (b.coins * 5 + Math.random() * 3) - (a.coins * 5 + Math.random() * 3)
    )[0];
    const richest = others.reduce((m, p) => Math.max(m, p.coins), 0);
    const maxHidden = others.reduce((m, p) => Math.max(m, p.hiddenCount), 0);
    const endgame = others.length === 1;

    const bluffCost = (role) => {
      if (has(role)) return 0;
      return 9 + (influence === 1 ? 9 : 0) - this.p.bluff * 8;
    };

    let best = null;
    for (const action of available) {
      let score = 0;
      let targetId = null;

      switch (action.type) {
        case 'income':
          score = 20 + (me.coins <= 3 ? 4 : 0);
          if (endgame && me.coins >= 6 && me.coins < 7) score += 8;
          break;

        case 'foreignAid':
          score = 29 + (me.coins < 7 ? 5 : 0);
          // Someone likely holds a Duke to block.
          score -= 4 + this.diff.challenge * 5;
          if (influence === 1) score -= 2;
          break;

        case 'coup':
          score = 120;
          targetId = coupTarget;
          break;

        case 'tax':
          score = 40 + (me.coins < 7 ? 6 : 0) + (has('duke') ? 13 : 0) - bluffCost('duke');
          // Coins in hand are leverage; build toward an unblockable coup.
          if (me.coins >= 4) score += 14;
          if (me.coins >= 6) score += 8;
          if (endgame && me.coins < 7) score += 10;
          break;

        case 'assassinate': {
          score = 44 + (has('assassin') ? 12 : 0) - bluffCost('assassin');
          targetId = strikeTarget;
          const t = others.find(p => p.id === strikeTarget);
          if (t) {
            if (t.hiddenCount === 1) score += 20;
            if (t.coins >= 6) score += 5;
            // A target who keeps claiming Contessa is a poor assassination target.
            const risk = this.blockRisk('contessa', t, view);
            score -= risk * 52;
            if (risk > 0.55) score -= 12;
          }
          if (me.coins >= 4 && me.coins < 7) score -= 14;
          score += this.p.aggression * 8;
          break;
        }

        case 'steal': {
          score = 31 + (has('captain') ? 10 : 0) - bluffCost('captain');
          targetId = stealTargetPlayer ? stealTargetPlayer.id : null;
          if (richest < 2) score -= 18;
          else score += Math.min(stealValue(stealTargetPlayer), 2) * 3;
          if (maxHidden === 1) score -= 3;
          break;
        }

        case 'exchange':
          score = 21 + (has('ambassador') ? 7 : 0) - bluffCost('ambassador') * 0.5;
          if (influence === 1) score -= 3;
          break;
      }

      score += (Math.random() - 0.5) * 9;
      if (this.diff.key === 'easy') score += (Math.random() - 0.5) * 10;

      if (!best || score > best.score) best = { score, type: action.type, targetId };
    }

    if (!best) return { type: available[0].type, targetId: available[0].target ? coupTarget : null };
    if (!ACTIONS[best.type].target) best.targetId = null;
    return { type: best.type, targetId: best.targetId };

    function stealValue(p) {
      return p ? Math.min(2, p.coins) : 0;
    }
  }

  /* How likely is this player to hold (and play) the role as a block? */
  blockRisk(role, target, view) {
    const base = this.roleProbability(role, target.hiddenCount, view);
    const recent = view.claims.filter(c =>
      c.playerId === target.id &&
      c.kind === 'block' &&
      c.role === role &&
      view.turnCount - c.turn <= 10
    );
    if (!recent.length) return base;
    const claimed = Math.min(0.92, 0.35 + recent.length * 0.14);
    return Math.max(base, claimed);
  }

  pickTarget(players, mode) {
    let best = null;
    for (const p of players) {
      let score = 0;
      if (mode === 'steal') {
        score = p.coins * 5;
      } else {
        score = p.coins * 1.2 + p.hiddenCount * 2;
        if (p.hiddenCount === 1) score += 26;
        if (p.isHuman) score += 2;
        if (this.p.aggression > 0.6) score += Math.random() * 3;
      }
      score += Math.random() * 6;
      if (!best || score > best.score) best = { score, id: p.id };
    }
    return best ? best.id : null;
  }

  /* ---------- challenges ---------- */

  chooseChallenge(d) {
    const view = d.view;
    const actor = view.players.find(p => p.id === d.actorId);
    if (!actor) return false;

    const p = this.roleProbability(d.role, actor.hiddenCount, view);
    let threshold = this.diff.challenge + (this.p.skeptic - 0.5) * 0.22;

    if (d.claimKind === 'block') threshold += 0.025;
    if (view.me.hidden.length === 1) threshold -= 0.055;
    threshold += this.p.aggression * 0.035;

    const caughtRecently = view.claims.some(c =>
      c.playerId === d.actorId && c.held === false && view.turnCount - c.turn <= 6
    );
    if (caughtRecently) threshold += 0.025;

    if (this.diff.key === 'easy') threshold -= 0.02;
    if (this.diff.key === 'hard') threshold += 0.015;

    const roll = p + (Math.random() - 0.5) * 0.045;
    return roll < threshold;
  }

  /* ---------- blocks ---------- */

  chooseBlock(d) {
    const me = d.view.me;
    const held = d.roles.filter(r => me.hidden.includes(r));

    if (held.length) {
      // Claim a role actually held. Prefer one whose active power matters less.
      return held[Math.floor(Math.random() * held.length)];
    }

    const influence = me.hidden.length;
    let chance = 0.08 + this.p.bluff * 0.2;

    if (d.action === 'foreignAid') {
      chance *= 0.32;
    } else if (d.action === 'assassinate') {
      chance = influence === 1
        ? 0.58 + this.p.bluff * 0.28
        : 0.15 + this.p.bluff * 0.16;
    } else if (d.action === 'steal') {
      chance = 0.06 + this.p.bluff * 0.14;
    }

    if (this.diff.key === 'easy') chance *= 0.7;
    if (this.diff.key === 'hard') chance *= 1.15;

    if (Math.random() < chance) {
      // Bluff with the role that is statistically likeliest to be believed.
      return d.roles[Math.floor(Math.random() * d.roles.length)];
    }
    return null;
  }

  /* ---------- influence selection ---------- */

  chooseLoseInfluence(d) {
    const view = d.view;
    const lastClaim = [...view.claims].reverse().find(c => c.playerId === view.me.id);
    let worst = null;

    for (const option of d.options) {
      let keep = ROLE_KEEP_VALUE[option.role] || 2;
      if (lastClaim && lastClaim.role === option.role) keep += 1.1;
      keep += Math.random() * 0.35;
      if (option.role === 'contessa' && view.me.hidden.length === 1) keep += 0.3;
      if (!worst || keep < worst.keep) worst = { keep, index: option.index };
    }

    return worst ? worst.index : d.options[0].index;
  }

  chooseExchange(d) {
    const view = d.view;
    const lastClaim = [...view.claims].reverse().find(c => c.playerId === view.me.id);
    const scored = d.options.map((option, index) => {
      let value = ROLE_KEEP_VALUE[option.role] || 2;
      if (lastClaim && lastClaim.role === option.role) value += 0.9;
      value += Math.random() * 0.5;
      return { index, value };
    });
    scored.sort((a, b) => b.value - a.value);
    return scored.slice(0, d.keepCount).map(s => s.index);
  }
}


/* ---- public/js/engine.js ---- */
/* ============================================================
   Coup — game engine
   Pure rules + async decision flow. No DOM here.
   ============================================================ */

const ACTIONS = {
  income: {
    type: 'income', title: 'Income', desc: 'Take 1 coin from the treasury',
    tone: 'neutral', target: false, cost: 0, role: null
  },
  foreignAid: {
    type: 'foreignAid', title: 'Foreign Aid', desc: 'Take 2 coins · Duke may block',
    tone: 'neutral', target: false, cost: 0, role: null,
    blockable: true, blockRoles: ['duke'], blockScope: 'any'
  },
  coup: {
    type: 'coup', title: 'Coup', desc: 'Pay 7 · force an influence loss',
    tone: 'coup', target: true, cost: 7, role: null
  },
  tax: {
    type: 'tax', title: 'Tax', desc: 'Take 3 coins',
    tone: 'duke', target: false, cost: 0, role: 'duke'
  },
  assassinate: {
    type: 'assassinate', title: 'Assassinate', desc: 'Pay 3 · force an influence loss',
    tone: 'assassin', target: true, cost: 3, role: 'assassin',
    blockable: true, blockRoles: ['contessa'], blockScope: 'target'
  },
  steal: {
    type: 'steal', title: 'Steal', desc: 'Take 2 coins from a rival',
    tone: 'captain', target: true, cost: 0, role: 'captain',
    blockable: true, blockRoles: ['captain', 'ambassador'], blockScope: 'target'
  },
  exchange: {
    type: 'exchange', title: 'Exchange', desc: 'Swap cards with the Court',
    tone: 'ambassador', target: false, cost: 0, role: 'ambassador'
  }
};

const ACTION_ORDER = ['income', 'foreignAid', 'coup', 'tax', 'assassinate', 'steal', 'exchange'];

class CoupGame {
  constructor({ players, difficulty = 'normal', hooks = {}, pace = 1 }) {
    this.hooks = hooks;
    this.pace = pace;
    this.difficulty = difficulty;
    this.players = players.map((p, i) => ({
      id: i,
      name: p.name,
      color: p.color,
      isHuman: !!p.isHuman,
      profile: p.profile || null,
      coins: 2,
      cards: [],
      eliminated: false
    }));
    this.human = this.players.find(p => p.isHuman) || null;
    this.deck = [];
    this.turnIndex = 0;
    this.turnCount = 0;
    this.over = false;
    this.winnerId = null;
    this.claims = [];
    this.agents = {};
    for (const p of this.players) {
      if (!p.isHuman) this.agents[p.id] = new CoupAI(p.profile || {}, difficulty);
    }
    this.buildDeck();
    this.deal();
  }

  /* ---------- setup ---------- */

  buildDeck() {
    this.deck = [];
    for (const role of ROLES) {
      for (let i = 0; i < 3; i++) this.deck.push(role);
    }
    shuffle(this.deck);
  }

  deal() {
    for (let round = 0; round < 2; round++) {
      for (const p of this.players) {
        p.cards.push({ role: this.deck.pop(), revealed: false, proven: false });
      }
    }
  }

  async start() {
    this.hooks.update?.(this);
    this.log(`<span class="log-muted">The court convenes — ${this.players.length} players, two coins and two secrets each.</span>`);
    this.banner('The Court Convenes', `${this.players.length} players · 2 coins · 2 influence`, 'gold');
    await this.pause(900);

    this.turnIndex = Math.floor(Math.random() * this.players.length);
    const first = this.players[this.turnIndex];
    const you = this.isSecondPerson(first);
    this.banner(
      you ? 'You Begin' : `${first.name} Begins`,
      you ? 'The court looks to you' : 'Watch every claim closely',
      'gold'
    );
    this.log(`<span class="log-muted">${this.nameTag(first)} ${you ? 'have' : 'has'} the first move.</span>`);
    await this.pause(650);
    await this.run();
  }

  isSecondPerson(player) {
    if (!player) return false;
    if (typeof player.secondPerson === 'boolean') return player.secondPerson;
    return !!player.isHuman && player.name.trim().toLowerCase() === 'you';
  }

  v(player, third, second) {
    return this.isSecondPerson(player) ? second : third;
  }

  async run() {
    try {
      while (!this.over) {
        const player = this.players[this.turnIndex];
        if (!player.eliminated) {
          await this.playTurn(player);
        }
        if (this.over) break;
        this.advanceTurn();
        await this.pause(260);
      }
    } catch (err) {
      console.error('Coup engine error:', err);
      this.hooks.error?.(err);
    }
  }

  advanceTurn() {
    let guard = 0;
    do {
      this.turnIndex = (this.turnIndex + 1) % this.players.length;
      guard++;
    } while (this.players[this.turnIndex].eliminated && guard < this.players.length * 2);
  }

  /* ---------- turn / action choice ---------- */

  async playTurn(player) {
    this.turnCount++;
    this.update();
    this.hooks.log?.({ html: '', cls: 'sep', label: `Turn ${this.turnCount}` });
    this.log(`${this.nameTag(player)} ${this.isSecondPerson(player) ? 'take' : 'takes'} the turn.`);

    const mustCoup = player.coins >= 10;
    let actions = this.actionsFor(player);
    if (mustCoup) actions = actions.filter(a => a.type === 'coup');

    if (mustCoup) {
      this.banner('You must Coup', `${player.name} ${this.v(player, 'holds', 'hold')} 10+ coins`, 'danger');
      await this.pause(450);
    }

    const choice = await this.ask(player, {
      kind: 'action',
      actions,
      mustCoup,
      // Public target information only: prompts can cross the network in online play.
      targets: this.players
        .filter(p => !p.eliminated && p.id !== player.id)
        .map(p => ({
          id: p.id,
          name: p.name,
          coins: p.coins,
          hiddenCount: p.cards.filter(c => !c.revealed).length
        }))
    });
    if (this.over) return;
    await this.doAction(player, choice);
  }

  actionsFor(player) {
    return ACTION_ORDER.map(type => {
      const spec = ACTIONS[type];
      const enabled = !spec.cost || player.coins >= spec.cost;
      let reason = '';
      if (!enabled) reason = `Needs ${spec.cost} coins`;
      return {
        type,
        title: spec.title,
        desc: spec.desc,
        role: spec.role,
        roleName: spec.role ? CHARACTERS[spec.role].name : null,
        cost: spec.cost,
        target: spec.target,
        tone: spec.tone,
        enabled,
        reason
      };
    });
  }

  async doAction(actor, choice) {
    let spec = ACTIONS[choice && choice.type];
    if (!spec) return;

    let target = null;
    if (spec.target) {
      target = this.players[choice.targetId];
      if (!target || target.eliminated || target.id === actor.id) {
        target = this.players.find(p => !p.eliminated && p.id !== actor.id) || null;
      }
      if (!target) return;
    }

    if (spec.cost) this.changeCoins(actor, -spec.cost);

    const claim = spec.role ? {
      playerId: actor.id,
      role: spec.role,
      kind: 'action',
      type: spec.type,
      turn: this.turnCount,
      challenged: false,
      held: null
    } : null;
    if (claim) this.claims.push(claim);

    const targetText = target ? ` → ${target.name}` : '';
    const costText = spec.cost ? ` · −${spec.cost} coins` : '';
    this.banner(
      spec.title,
      spec.role
        ? `${actor.name} ${this.v(actor, 'claims', 'claim')} the ${CHARACTERS[spec.role].name}${targetText}${costText}`
        : `${actor.name}${targetText}${costText}`,
      spec.tone
    );
    this.hooks.fx?.({ type: 'action', playerId: actor.id, action: spec.type, role: spec.role });
    this.hooks.sound?.('action');

    let html = `${this.nameTag(actor)} `;
    const takes = this.v(actor, 'takes', 'take');
    const claims = this.v(actor, 'claims', 'claim');
    if (spec.type === 'income') html += `${takes} <b>1 coin</b> in income.`;
    else if (spec.type === 'foreignAid') html += `${takes} <b>2 coins</b> in foreign aid.`;
    else if (spec.type === 'coup') html += `${this.v(actor, 'launches', 'launch')} a <b>coup</b> against ${this.nameTag(target)}.`;
    else if (spec.type === 'tax') html += `${claims} the ${this.roleTag('duke')} and ${takes} <b>3 coins</b>.`;
    else if (spec.type === 'assassinate') html += `${claims} the ${this.roleTag('assassin')} and ${this.v(actor, 'moves', 'move')} against ${this.nameTag(target)}.`;
    else if (spec.type === 'steal') html += `${claims} the ${this.roleTag('captain')} and ${this.v(actor, 'steals', 'steal')} from ${this.nameTag(target)}.`;
    else if (spec.type === 'exchange') html += `${claims} the ${this.roleTag('ambassador')} and ${this.v(actor, 'consults', 'consult')} the Court.`;
    if (spec.cost) html += ` <span class="log-muted">(−${spec.cost} coins)</span>`;
    this.log(html);
    this.update();
    await this.pause(620);

    /* ---- challenge the action ---- */
    if (spec.role) {
      const challenger = await this.gatherChallenge({
        actorId: actor.id,
        role: spec.role,
        claimKind: 'action',
        type: spec.type
      });
      if (challenger) {
        claim.challenged = true;
        this.banner('Challenge!', `${challenger.name} ${this.v(challenger, 'doubts', 'doubt')} ${actor.name}`, 'danger');
        this.hooks.sound?.('challenge');
        this.log(`⚔ ${this.nameTag(challenger)} <b>${this.v(challenger, 'challenges', 'challenge')}</b> the ${this.roleTag(spec.role)} claim!`);
        this.update();
        await this.pause(500);

        const actorHeld = await this.resolveChallenge(actor, challenger, spec.role, claim);
        claim.held = actorHeld;

        if (this.over) return;
        if (!actorHeld) {
          if (spec.cost) this.changeCoins(actor, spec.cost);
          this.log(`<span class="log-muted">The ${ACTIONS[spec.type].title} fails${spec.cost ? ` and the ${spec.cost} coins are returned` : ''}.</span>`);
          this.update();
          await this.pause(380);
          this.checkWin();
          return;
        }
      }
    }

    /* ---- block window ---- */
    if (target && target.eliminated && !this.over) {
      this.log(`<span class="log-muted">${esc(target.name)} is already out of the court.</span>`);
      this.update();
      await this.pause(320);
      this.checkWin();
      return;
    }

    if (spec.blockable && target && !this.over) {
      const block = await this.gatherBlock(actor, target, spec);
      if (block) {
        const blockClaim = {
          playerId: block.blocker.id,
          role: block.role,
          kind: 'block',
          type: spec.type,
          turn: this.turnCount,
          challenged: false,
          held: null
        };
        this.claims.push(blockClaim);
        this.banner(
          `${CHARACTERS[block.role].name} Blocks`,
          `${block.blocker.name} ${this.v(block.blocker, 'intervenes', 'intervene')}`,
          'block'
        );
        this.hooks.sound?.('block');
        this.log(`🛡 ${this.nameTag(block.blocker)} ${this.v(block.blocker, 'claims', 'claim')} the ${this.roleTag(block.role)} to <b>block</b> the ${spec.title}.`);
        this.update();
        await this.pause(520);

        const challenger = await this.gatherChallenge({
          actorId: block.blocker.id,
          role: block.role,
          claimKind: 'block',
          type: spec.type,
          blockedPlayerId: actor.id
        });

        if (challenger) {
          blockClaim.challenged = true;
          this.banner('Challenge!', `${challenger.name} ${this.v(challenger, 'doubts', 'doubt')} the block`, 'danger');
          this.hooks.sound?.('challenge');
          this.log(`⚔ ${this.nameTag(challenger)} <b>${this.v(challenger, 'challenges', 'challenge')}</b> the ${this.roleTag(block.role)} block!`);
          this.update();
          await this.pause(480);

          const blockerHeld = await this.resolveChallenge(block.blocker, challenger, block.role, blockClaim);
          blockClaim.held = blockerHeld;

          if (this.over) return;
          if (blockerHeld) {
            this.log(`<span class="log-muted">The block holds. ${spec.title} fails${spec.cost ? '; coins already paid stay spent' : ''}.</span>`);
            this.update();
            await this.pause(420);
            return;
          }
          this.log(`<span class="log-muted">The block is a bluff — ${spec.title} proceeds.</span>`);
          this.update();
          await this.pause(320);
        } else {
          this.log(`<span class="log-muted">The block stands. ${spec.title} fails${spec.cost ? '; coins already paid stay spent' : ''}.</span>`);
          this.update();
          await this.pause(420);
          return;
        }
      }
    }

    if (this.over) return;
    await this.applyAction(actor, spec, target);
  }

  async applyAction(actor, spec, target) {
    switch (spec.type) {
      case 'income':
        this.changeCoins(actor, 1);
        this.log(`${this.nameTag(actor)} ${this.v(actor, 'collects', 'collect')} <b>1 coin</b>.`);
        break;
      case 'foreignAid':
        this.changeCoins(actor, 2);
        this.log(`${this.nameTag(actor)} ${this.v(actor, 'collects', 'collect')} <b>2 coins</b> in foreign aid.`);
        break;
      case 'tax':
        this.changeCoins(actor, 3);
        this.log(`${this.nameTag(actor)} ${this.v(actor, 'collects', 'collect')} <b>3 coins</b> in tax.`);
        break;
      case 'coup':
        this.log(`The coup lands. ${this.nameTag(target)} must surrender an influence.`);
        this.update();
        await this.pause(360);
        await this.loseInfluence(target, 'coup');
        break;
      case 'assassinate':
        this.log(`The blade finds its mark. ${this.nameTag(target)} must surrender an influence.`);
        this.update();
        await this.pause(360);
        await this.loseInfluence(target, 'assassination');
        break;
      case 'steal': {
        const amount = Math.min(2, target.coins);
        if (amount > 0) {
          this.changeCoins(target, -amount);
          this.changeCoins(actor, amount);
          this.log(`${this.nameTag(actor)} ${this.v(actor, 'takes', 'take')} <b>${amount} coin${amount === 1 ? '' : 's'}</b> from ${this.nameTag(target)}.`);
        } else {
          this.log(`There is nothing to steal from ${this.nameTag(target)}.`);
        }
        break;
      }
      case 'exchange':
        await this.exchange(actor);
        break;
    }

    this.update();
    this.hooks.sound?.('coin');
    await this.pause(460);
    this.checkWin();
  }

  /* ---------- challenges ---------- */

  async gatherChallenge({ actorId, role, claimKind, type, blockedPlayerId = null }) {
    const actor = this.players[actorId];
    const eligible = this.players.filter(p => !p.eliminated && p.id !== actorId);
    if (!eligible.length) return null;

    const base = { kind: 'challenge', actorId, role, claimKind, type, blockedPlayerId };
    const human = eligible.find(p => p.isHuman);

    const aiPromises = eligible
      .filter(p => !p.isHuman)
      .map(p => this.ask(p, { ...base })
        .then(want => (want ? p : null))
        .catch(() => null));

    if (human) {
      const wants = await this.ask(human, { ...base });
      if (wants) {
        // Let the in-flight AI decisions settle without blocking play.
        Promise.allSettled(aiPromises);
        return human;
      }
    }

    const results = await Promise.all(aiPromises);
    return results.find(Boolean) || null;
  }

  async resolveChallenge(claimer, challenger, role, claim) {
    const idx = claimer.cards.findIndex(c => !c.revealed && c.role === role);
    const roleName = CHARACTERS[role].name;

    if (idx !== -1) {
      /* Claimant was telling the truth. Show the card, then replace it. */
      const card = claimer.cards[idx];
      card.revealed = true;
      card.proven = true;
      this.banner(`${roleName} Proven`, `${claimer.name} ${this.v(claimer, 'holds', 'hold')} the ${roleName}`, 'prove');
      this.hooks.fx?.({ type: 'prove', playerId: claimer.id, cardIndex: idx });
      this.hooks.sound?.('prove');
      this.log(`${this.nameTag(claimer)} ${this.v(claimer, 'reveals', 'reveal')} the ${this.roleTag(role)} — <b>the challenge fails</b>.`);
      this.update();
      await this.pause(880);

      // The revealed card returns to the Court, a new one is drawn.
      claimer.cards.splice(idx, 1);
      this.deck.push(role);
      shuffle(this.deck);
      const replacement = this.deck.pop();
      claimer.cards.splice(idx, 0, { role: replacement, revealed: false, proven: false });
      this.hooks.fx?.({ type: 'redraw', playerId: claimer.id });
      this.update();
      await this.pause(480);

      this.log(`${this.nameTag(challenger)} challenged wrongly and must surrender an influence.`);
      await this.loseInfluence(challenger, 'lost a challenge');
      return true;
    }

    /* Bluff called correctly. */
    this.banner('Bluff Called', `${claimer.name} ${this.v(claimer, 'does', 'do')} not hold the ${roleName}`, 'fail');
    this.hooks.fx?.({ type: 'caught', playerId: claimer.id });
    this.hooks.sound?.('caught');
    this.log(`${this.nameTag(claimer)} cannot show the ${this.roleTag(role)} — <b>the claim was a bluff</b>.`);
    this.update();
    await this.pause(620);
    await this.loseInfluence(claimer, 'caught bluffing');
    return false;
  }

  /* ---------- blocks ---------- */

  async gatherBlock(actor, target, spec) {
    const roles = spec.blockRoles;
    const eligible = spec.blockScope === 'target'
      ? (target && !target.eliminated ? [target] : [])
      : this.players.filter(p => !p.eliminated && p.id !== actor.id);
    if (!eligible.length) return null;

    const base = {
      kind: 'block',
      actorId: actor.id,
      targetId: target ? target.id : null,
      roles,
      action: spec.type
    };

    const human = eligible.find(p => p.isHuman);
    const aiPromises = eligible
      .filter(p => !p.isHuman)
      .map(p => this.ask(p, { ...base })
        .then(role => (role && roles.includes(role) ? { blocker: p, role } : null))
        .catch(() => null));

    if (human) {
      const role = await this.ask(human, { ...base });
      if (role && roles.includes(role)) {
        Promise.allSettled(aiPromises);
        return { blocker: human, role };
      }
    }

    const results = await Promise.all(aiPromises);
    return results.find(Boolean) || null;
  }

  /* ---------- losing influence ---------- */

  async loseInfluence(player, reason) {
    if (player.eliminated) return;
    const hidden = [];
    player.cards.forEach((c, i) => { if (!c.revealed) hidden.push(i); });
    if (!hidden.length) return;

    let idx = hidden[0];
    if (hidden.length > 1) {
      const options = hidden.map(i => ({ index: i, role: player.cards[i].role }));
      const answer = await this.ask(player, {
        kind: 'loseInfluence',
        reason,
        options
      });
      if (hidden.includes(answer)) idx = answer;
      else if (answer && typeof answer.index === 'number' && hidden.includes(answer.index)) idx = answer.index;
    }

    const card = player.cards[idx];
    card.revealed = true;
    card.proven = false;
    const roleName = CHARACTERS[card.role].name;
    this.hooks.fx?.({ type: 'lose', playerId: player.id, cardIndex: idx });
    this.hooks.sound?.('lose');
    this.log(`${this.nameTag(player)} ${this.v(player, 'surrenders', 'surrender')} the ${this.roleTag(card.role)}${reason ? ` <span class="log-muted">(${reason})</span>` : ''}.`);
    this.update();
    await this.pause(820);

    if (player.cards.every(c => c.revealed)) {
      player.eliminated = true;
      this.banner(`${player.name} Is Out`, 'Their influence is spent', 'eliminate');
      this.hooks.fx?.({ type: 'eliminate', playerId: player.id });
      this.hooks.sound?.('eliminate');
      this.log(`☠ ${this.nameTag(player)} ${this.v(player, 'has', 'have')} <b>no influence left</b> and ${this.v(player, 'leaves', 'leave')} the court.`);
      this.update();
      await this.pause(720);
      this.checkWin();
    }
  }

  /* ---------- exchange ---------- */

  async exchange(player) {
    const hiddenIdxs = [];
    player.cards.forEach((c, i) => { if (!c.revealed) hiddenIdxs.push(i); });
    const drawn = [];
    for (let i = 0; i < 2 && this.deck.length; i++) drawn.push(this.deck.pop());

    const options = hiddenIdxs.map(i => ({
      index: i,
      role: player.cards[i].role,
      source: 'hand'
    })).concat(drawn.map(role => ({ role, source: 'court' })));

    const keepCount = hiddenIdxs.length;
    let keep = await this.ask(player, {
      kind: 'exchange',
      options,
      keepCount,
      drawnCount: drawn.length
    });

    if (!Array.isArray(keep) || keep.length !== keepCount || new Set(keep).size !== keepCount ||
        keep.some(i => !Number.isInteger(i) || i < 0 || i >= options.length)) {
      keep = hiddenIdxs.map((_, i) => i).slice(0, keepCount);
    }

    const keptSet = new Set(keep);
    const keptRoles = options.filter((_, i) => keptSet.has(i)).map(o => o.role);
    const returned = options.filter((_, i) => !keptSet.has(i)).map(o => o.role);

    hiddenIdxs.forEach((cardIdx, j) => {
      player.cards[cardIdx].role = keptRoles[j];
    });
    this.deck.push(...returned);
    shuffle(this.deck);

    this.hooks.fx?.({ type: 'exchange', playerId: player.id });
    this.log(`${this.nameTag(player)} ${this.v(player, 'returns', 'return')} two cards to the Court.`);
    this.update();
    await this.pause(520);
  }

  /* ---------- coin helper ---------- */

  changeCoins(player, delta) {
    if (!delta) return;
    player.coins = Math.max(0, player.coins + delta);
    this.hooks.fx?.({ type: 'coins', playerId: player.id, delta });
  }

  /* ---------- win / state ---------- */

  checkWin() {
    if (this.over) return true;
    const alive = this.players.filter(p => !p.eliminated);
    if (alive.length <= 1) {
      this.over = true;
      this.winnerId = alive.length === 1 ? alive[0].id : null;
      this.update();
      this.hooks.gameover?.(alive[0] || null, 'last-standing');
      return true;
    }
    if (this.human && this.human.eliminated) {
      this.over = true;
      this.winnerId = null;
      this.update();
      this.hooks.gameover?.(null, 'human-eliminated');
      return true;
    }
    return false;
  }

  alive() {
    return this.players.filter(p => !p.eliminated);
  }

  abort() {
    this.over = true;
  }

  update() {
    this.hooks.update?.(this);
  }

  pause(ms) {
    return sleep(ms * this.pace);
  }

  banner(title, sub, tone) {
    this.hooks.banner?.({ title, sub, tone });
  }

  log(html, cls = '') {
    this.hooks.log?.({ html, cls });
  }

  nameTag(player) {
    return `<b class="pname" style="--pc:${player.color}">${esc(player.name)}</b>`;
  }

  roleTag(role) {
    const c = CHARACTERS[role];
    return `<span class="role-tag" style="--rc:${c.accent};--rb:${c.accentBright}">${c.name}</span>`;
  }

  /* ---------- public information for a player (AI) ---------- */

  viewFor(player) {
    return {
      me: {
        id: player.id,
        coins: player.coins,
        hidden: player.cards.filter(c => !c.revealed).map(c => c.role)
      },
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        coins: p.coins,
        eliminated: p.eliminated,
        isHuman: p.isHuman,
        hiddenCount: p.cards.filter(c => !c.revealed).length,
        revealed: p.cards.filter(c => c.revealed).map(c => c.role)
      })),
      deckCount: this.deck.length,
      turnCount: this.turnCount,
      claims: this.claims.map(c => ({ ...c }))
    };
  }

  /* ---------- ask a decision from a human or AI ---------- */

  async ask(player, decision) {
    decision.playerId = player.id;
    decision.view = this.viewFor(player);
    if (player.isHuman) {
      this.update();
      return this.hooks.askHuman(decision);
    }
    const agent = this.agents[player.id];
    if (!agent) return null;
    return agent.decide(decision);
  }
}


export {
  ROLES,
  CHARACTERS,
  CoupGame,
  CoupAI,
  cardFrontHTML,
  cardBackHTML,
  roleIcon,
  esc,
  shuffle,
  sleep
};
