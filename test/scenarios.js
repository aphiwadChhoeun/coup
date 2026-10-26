/* Targeted rules scenarios for the Coup engine (dev).
   Usage: node test/scenarios.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const source = ['js/cards.js', 'js/ai.js', 'js/engine.js']
  .map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

const sandbox = { console, setTimeout, clearTimeout, Promise, Math, Set, Map, Number, Array, Object, String, JSON };
vm.createContext(sandbox);

const harness = `
function assert(condition, message) {
  if (!condition) throw new Error('ASSERTION FAILED: ' + message);
}

function buildGame(hands, coins) {
  const names = ['A', 'B', 'C'];
  const colors = ['#f00', '#0f0', '#00f'];
  const players = names.map((name, i) => ({
    name, color: colors[i], isHuman: false,
    profile: { title: 'Test', bluff: 0.5, skeptic: 0.5, aggression: 0.5 }
  }));
  const logs = [];
  let winner;
  const game = new CoupGame({
    players,
    difficulty: 'normal',
    hooks: {
      update() {}, log(e) { logs.push(e); }, banner() {}, fx() {}, sound() {},
      askHuman() { throw new Error('This scenario has no human'); },
      gameover(w) { winner = w; },
      error(e) { throw e; }
    }
  });
  game.pause = () => Promise.resolve();
  game.turnIndex = 0;
  game.turnCount = 1;
  game.over = false;
  game.winnerId = null;
  game.claims = [];
  game.players.forEach((p, i) => {
    p.coins = coins[i];
    p.eliminated = false;
    p.cards = hands[i].map(h => ({ role: h.role, revealed: !!h.revealed, proven: false }));
  });

  /* Rebuild a valid 15-card court deck from what remains. */
  const counts = {};
  for (const role of ROLES) counts[role] = 3;
  for (const p of game.players) for (const card of p.cards) counts[card.role]--;
  game.deck = [];
  for (const role of ROLES) {
    if (counts[role] < 0) throw new Error('Scenario uses too many copies of ' + role);
    for (let i = 0; i < counts[role]; i++) game.deck.push(role);
  }

  /* A scripted, instant agent. */
  game.agents = {};
  game.players.forEach(p => {
    game.agents[p.id] = {
      async decide(d) {
        return game.decideScript(p.id, d);
      }
    };
  });
  game.decideScript = null;
  game.logs = logs;
  game.getWinner = () => winner;
  return game;
}

function scriptAgent(overrides = {}) {
  return async (d, game) => {
    if (overrides[d.kind]) return overrides[d.kind](d, game);
    switch (d.kind) {
      case 'challenge': return false;
      case 'block': return null;
      case 'loseInfluence': return d.options[0].index;
      case 'exchange': return d.options.slice(0, d.keepCount).map((_, i) => i);
      default: return { type: 'income' };
    }
  };
}

(async () => {
  /* ============ 1. Target eliminated during the challenge ============ */
  {
    const game = buildGame([
      [{ role: 'assassin' }, { role: 'duke' }],
      [{ role: 'contessa', revealed: true }, { role: 'captain' }],
      [{ role: 'duke' }, { role: 'captain' }]
    ], [5, 2, 2]);

    let blockAsked = false;
    const scripts = {
      0: scriptAgent({
        action: () => ({ type: 'assassinate', targetId: 1 })
      }),
      1: scriptAgent({
        challenge: () => true,
        block: () => { blockAsked = true; return null; }
      }),
      2: scriptAgent({ challenge: () => false })
    };
    game.decideScript = (id, d) => scripts[id](d, game);

    await game.playTurn(game.players[0]);
    assert(game.players[1].eliminated, 'target with no influence left should be eliminated');
    assert(!blockAsked, 'an eliminated target must not be asked to block');
    assert(game.players[0].coins === 2, 'assassination cost should stay spent when the target is already out');
    assert(game.logs.some(e => e.html && e.html.includes('already out')), 'log should note the target is already out');
    console.log('OK 1 — target eliminated during challenge');
  }

  /* ============ 2. Caught bluff refunds an action cost ============ */
  {
    const game = buildGame([
      [{ role: 'duke' }, { role: 'captain' }],
      [{ role: 'contessa' }, { role: 'ambassador' }],
      [{ role: 'duke' }, { role: 'captain' }]
    ], [5, 2, 2]);

    const scripts = {
      0: scriptAgent({
        action: () => ({ type: 'assassinate', targetId: 1 }),
        loseInfluence: d => d.options[0].index
      }),
      1: scriptAgent({ challenge: () => true }),
      2: scriptAgent({ challenge: () => false })
    };
    game.decideScript = (id, d) => scripts[id](d, game);

    await game.playTurn(game.players[0]);
    assert(game.players[0].coins === 5, 'cost must be refunded when the action is successfully challenged');
    assert(game.players[0].cards.filter(c => !c.revealed).length === 1, 'caught actor should lose one influence');
    assert(game.players[1].cards.filter(c => !c.revealed).length === 2, 'target must not lose influence');
    assert(game.logs.some(e => e.html && e.html.includes('coins are returned')), 'log should mention the refund');
    console.log('OK 2 — caught bluff refund');
  }

  /* ============ 3. Proven block stops the action, cost stays spent ============ */
  {
    const game = buildGame([
      [{ role: 'assassin' }, { role: 'duke' }],
      [{ role: 'contessa' }, { role: 'ambassador' }],
      [{ role: 'duke' }, { role: 'captain' }]
    ], [5, 2, 2]);

    let blockAsked = false;
    const scripts = {
      0: scriptAgent({
        action: () => ({ type: 'assassinate', targetId: 1 }),
        challenge: d => d.claimKind === 'block',
        loseInfluence: d => d.options[0].index
      }),
      1: scriptAgent({
        challenge: () => false,
        block: () => { blockAsked = true; return 'contessa'; }
      }),
      2: scriptAgent({ challenge: () => false })
    };
    game.decideScript = (id, d) => scripts[id](d, game);

    await game.playTurn(game.players[0]);
    assert(blockAsked, 'target should be asked to block');
    assert(game.players[1].cards.filter(c => !c.revealed).length === 2, 'blocker must keep two hidden influences');
    assert(game.players[0].cards.filter(c => !c.revealed).length === 1, 'actor who challenged the block should lose an influence');
    assert(game.players[0].coins === 2, 'assassination cost should stay spent after a proven block');
    assert(game.logs.some(e => e.html && e.html.includes('The block holds')), 'log should confirm the block');
    console.log('OK 3 — proven block');
  }

  /* ============ 4. Mandatory coup at 10 coins ============ */
  {
    const game = buildGame([
      [{ role: 'assassin' }, { role: 'duke' }],
      [{ role: 'contessa' }, { role: 'ambassador' }],
      [{ role: 'duke' }, { role: 'captain' }]
    ], [10, 2, 2]);

    let offered = null;
    const scripts = {
      0: scriptAgent({
        action: d => { offered = d.actions.map(a => a.type); return { type: 'coup', targetId: 1 }; }
      }),
      1: scriptAgent({ loseInfluence: d => d.options[0].index })
    };
    game.decideScript = (id, d) => scripts[id](d, game);

    await game.playTurn(game.players[0]);
    assert(offered && offered.length === 1 && offered[0] === 'coup', '10+ coins must force coup as the only option');
    assert(game.players[0].coins === 3, 'coup should cost 7 coins');
    assert(game.players[1].cards.filter(c => !c.revealed).length === 1, 'coup target should lose one influence');
    console.log('OK 4 — mandatory coup');
  }

  console.log('All engine scenarios passed.');
})();
`;

vm.runInContext(source + harness, sandbox, { filename: 'scenarios.js' });
