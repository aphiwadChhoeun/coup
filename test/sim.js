/* Headless simulation + invariant checks for the Coup engine.
   Usage: node test/sim.js [games] */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const files = ['js/cards.js', 'js/ai.js', 'js/engine.js'];
const source = files.map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  Promise,
  Math,
  Set,
  Map,
  Number,
  Array,
  Object,
  String,
  JSON,
  GAMES: Number(process.argv[2] || 300)
};
vm.createContext(sandbox);

const harness = `
/* Fast AI: same decision logic, no thinking delay. */
CoupAI.prototype.decide = function (d) {
  switch (d.kind) {
    case 'action': return this.chooseAction(d);
    case 'challenge': return this.chooseChallenge(d);
    case 'block': return this.chooseBlock(d);
    case 'loseInfluence': return this.chooseLoseInfluence(d);
    case 'exchange': return this.chooseExchange(d);
    default: return null;
  }
};

async function playOne(seed) {
  const profiles = [
    { title: 'Gambler', bluff: .8, skeptic: .35, aggression: .65 },
    { title: 'Ironclad', bluff: .3, skeptic: .7, aggression: .45 },
    { title: 'Widow', bluff: .5, skeptic: .5, aggression: .35 },
    { title: 'Usurper', bluff: .6, skeptic: .45, aggression: .85 },
    { title: 'Fox', bluff: .55, skeptic: .62, aggression: .55 }
  ];
  const count = 3 + (seed % 4);
  const players = [];
  for (let i = 0; i < count; i++) {
    players.push({
      name: 'AI ' + i,
      color: '#ffffff',
      isHuman: false,
      profile: profiles[i % profiles.length]
    });
  }
  let ended = null;
  let logCount = 0;
  const hooks = {
    update() {},
    log() { logCount++; },
    banner() {},
    fx() {},
    sound() {},
    askHuman() { throw new Error('The engine asked a human with no human present'); },
    gameover(winner, reason) { ended = { winner, reason }; },
    error(err) { throw err; }
  };
  const game = new CoupGame({ players, difficulty: ['easy', 'normal', 'hard'][seed % 3], hooks });
  game.pause = () => Promise.resolve();
  await game.start();

  if (!game.over) throw new Error('Game did not finish');
  if (!ended) throw new Error('No gameover event');

  /* ---- invariants ---- */
  const roleCounts = {};
  for (const role of ROLES) roleCounts[role] = 0;
  let totalCards = 0;
  for (const role of game.deck) { roleCounts[role]++; totalCards++; }
  for (const p of game.players) {
    if (p.cards.length > 2) throw new Error('Player has more than two cards');
    if (p.cards.length < 1) throw new Error('Player has no cards');
    if (p.coins < 0) throw new Error('Negative coins');
    for (const card of p.cards) {
      roleCounts[card.role]++;
      totalCards++;
    }
  }
  if (totalCards !== 15) throw new Error('Card total is ' + totalCards + ', expected 15');
  for (const role of ROLES) {
    if (roleCounts[role] !== 3) throw new Error('Role count wrong for ' + role + ': ' + roleCounts[role]);
  }
  const alive = game.players.filter(p => !p.eliminated);
  if (alive.length !== 1) throw new Error('Expected one survivor, got ' + alive.length);
  if (game.players[game.winnerId] !== alive[0]) throw new Error('Winner mismatch');

  return {
    turns: game.turnCount,
    logs: logCount,
    playerCount: count,
    winner: alive[0].name,
    coins: alive[0].coins
  };
}

(async () => {
  const games = GAMES;
  const results = [];
  for (let i = 0; i < games; i++) {
    try {
      const result = await Promise.race([
        playOne(i),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timed out')), 5000))
      ]);
      results.push(result);
    } catch (err) {
      console.error('FAILED on game', i, '-', err.stack);
      process.exit(1);
    }
  }
  const turns = results.map(r => r.turns);
  const avg = turns.reduce((a, b) => a + b, 0) / turns.length;
  console.log('OK — ' + games + ' games completed with invariants intact.');
  console.log('Average turns: ' + avg.toFixed(1) + '  |  min ' + Math.min(...turns) + '  |  max ' + Math.max(...turns));
  const byCount = {};
  for (const r of results) byCount[r.playerCount] = (byCount[r.playerCount] || 0) + 1;
  console.log('Games by seat count:', byCount);
})();
`;

vm.runInContext(source + harness, sandbox, { filename: 'coup-sim.js' });
