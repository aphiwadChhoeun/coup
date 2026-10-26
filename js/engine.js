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
      targets: this.players.filter(p => !p.eliminated && p.id !== player.id)
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
