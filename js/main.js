/* ============================================================
   Coup — bootstrap, title screen, game lifecycle
   ============================================================ */

(() => {
  const ROSTER = [
    {
      name: 'Vesper', color: '#d97b9e',
      profile: { title: 'The Gambler', bluff: 0.78, skeptic: 0.36, aggression: 0.62 }
    },
    {
      name: 'Rook', color: '#7fa7cf',
      profile: { title: 'The Ironclad', bluff: 0.32, skeptic: 0.68, aggression: 0.48 }
    },
    {
      name: 'Lysandra', color: '#79b98b',
      profile: { title: 'The Widow', bluff: 0.52, skeptic: 0.5, aggression: 0.34 }
    },
    {
      name: 'Baron Vex', color: '#d3a34c',
      profile: { title: 'The Usurper', bluff: 0.6, skeptic: 0.44, aggression: 0.82 }
    },
    {
      name: 'Mirabel', color: '#b08ad6',
      profile: { title: 'The Fox', bluff: 0.55, skeptic: 0.62, aggression: 0.56 }
    }
  ];

  const DIFF_HINTS = {
    easy: 'Courtier — a forgiving table. They bluff less and miss more.',
    normal: 'Noble — sharp instincts and a healthy appetite for risk.',
    hard: 'Assassin — cold reads, ruthless bluffs. Trust nothing.'
  };

  const ui = new CoupUI();
  let currentGame = null;
  let gameToken = 0;

  const state = { count: 4, diff: 'normal' };
  const $ = id => document.getElementById(id);

  /* ---------------- title decorations ---------------- */

  function buildGhostCards() {
    const wrap = $('ghostCards');
    if (!wrap) return;
    const picks = ['duke', 'assassin', 'captain', 'contessa', 'ambassador'];
    picks.forEach(role => {
      const card = document.createElement('div');
      card.className = 'ghost-card';
      card.setAttribute('aria-hidden', 'true');
      card.innerHTML = cardFrontHTML(role);
      wrap.append(card);
    });
  }

  /* ---------------- settings ---------------- */

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('coup.settings') || '{}');
      if (saved.name) $('nameInput').value = saved.name;
      if ([3, 4, 5, 6].includes(saved.count)) state.count = saved.count;
      if (['easy', 'normal', 'hard'].includes(saved.diff)) state.diff = saved.diff;
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem('coup.settings', JSON.stringify({
        name: $('nameInput').value.trim().slice(0, 14),
        count: state.count,
        diff: state.diff
      }));
    } catch (e) { /* ignore */ }
  }

  function paintSegments() {
    document.querySelectorAll('#countSeg [data-count]').forEach(btn => {
      const on = Number(btn.dataset.count) === state.count;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('#diffSeg [data-diff]').forEach(btn => {
      const on = btn.dataset.diff === state.diff;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    const hint = $('diffHint');
    if (hint) hint.textContent = DIFF_HINTS[state.diff];
  }

  function bindSetup() {
    document.querySelectorAll('#countSeg [data-count]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.count = Number(btn.dataset.count);
        paintSegments();
        Sound.play('click');
      });
    });
    document.querySelectorAll('#diffSeg [data-diff]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.diff = btn.dataset.diff;
        paintSegments();
        Sound.play('click');
      });
    });
    $('startBtn').addEventListener('click', () => {
      Sound.init();
      startGame();
    });
    $('nameInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') startGame();
    });
    document.addEventListener('pointerdown', () => Sound.init(), { once: true });
  }

  /* ---------------- lifecycle ---------------- */

  function makeHooks(token) {
    const live = () => token === gameToken;
    return {
      update: game => { if (live()) ui.update(game); },
      log: entry => { if (live()) ui.addLog(entry); },
      banner: data => { if (live()) ui.banner(data); },
      fx: data => { if (live()) ui.fx(data); },
      askHuman: decision => live() ? ui.ask(decision) : Promise.resolve(null),
      gameover: (winner, reason) => { if (live()) ui.gameOver(winner, reason); },
      sound: name => { if (live()) Sound.play(name); },
      error: err => { if (live()) ui.showError(err); }
    };
  }

  function startGame() {
    if (currentGame) {
      currentGame.abort();
      ui.cancelPending();
      currentGame = null;
    }
    gameToken++;
    const token = gameToken;
    const name = ($('nameInput').value.trim().slice(0, 14)) || 'You';
    saveSettings();

    const human = { name, color: '#d7b46a', isHuman: true };
    const bots = ROSTER.slice(0, state.count - 1).map(bot => ({
      name: bot.name,
      color: bot.color,
      isHuman: false,
      profile: bot.profile
    }));

    const game = new CoupGame({
      players: [human, ...bots],
      difficulty: state.diff,
      hooks: makeHooks(token),
      pace: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.45 : 1
    });
    currentGame = game;

    document.body.classList.add('in-game');
    $('screen-title').classList.add('hidden');
    $('screen-game').classList.remove('hidden');
    $('logPanel').classList.remove('open');

    ui.setHandlers({
      onRematch: () => startGame(),
      onMenu: () => showMenu()
    });
    ui.startGame(game);
    game.start();
  }

  function showMenu() {
    if (currentGame) {
      currentGame.abort();
      ui.cancelPending();
      currentGame = null;
    }
    gameToken++;
    ui.closeModal();
    ui.bannerLayer.innerHTML = '';
    ui.dock.innerHTML = '';
    ui.dock.classList.remove('visible');
    document.querySelectorAll('.confetti').forEach(el => el.remove());
    document.body.classList.remove('in-game');
    $('screen-game').classList.add('hidden');
    $('screen-title').classList.remove('hidden');
    paintSegments();
    Sound.play('click');
  }

  /* ---------------- init ---------------- */

  function init() {
    buildGhostCards();
    loadSettings();
    paintSegments();
    bindSetup();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Dev-only inspection hook (open with #debug). */
  if (window.location.hash === '#debug') {
    window.__coup = {
      ui,
      startGame,
      showMenu,
      get game() { return currentGame; }
    };
  }
})();
