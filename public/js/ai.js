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
