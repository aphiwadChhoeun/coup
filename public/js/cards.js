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
