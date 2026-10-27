/* ============================================================
   Coup — tiny synthesized sound design (no assets)
   ============================================================ */

const Sound = (() => {
  let ctx = null;
  let master = null;
  let enabled = true;

  try {
    enabled = localStorage.getItem('coup.sound') !== 'off';
  } catch (e) { /* ignore */ }

  function ensure() {
    if (!enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.32;
        master.connect(ctx.destination);
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function init() {
    ensure();
  }

  function setEnabled(value) {
    enabled = !!value;
    if (enabled) ensure();
    try { localStorage.setItem('coup.sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
  }

  function note(freq, start, dur, type = 'sine', gain = 0.12, slideTo = null) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.03, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(start, dur, gain = 0.04, filterFreq = 1200) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + start;
    const frames = Math.floor(c.sampleRate * dur);
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq;
    filter.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
  }

  const sounds = {
    click() {
      note(660, 0, 0.045, 'sine', 0.05);
    },
    deal() {
      noise(0, 0.12, 0.05, 1800);
    },
    action() {
      noise(0, 0.16, 0.045, 700);
      note(180, 0, 0.12, 'sine', 0.05);
    },
    coin() {
      note(1320, 0, 0.08, 'triangle', 0.055);
      note(1760, 0.055, 0.1, 'triangle', 0.045);
    },
    block() {
      note(150, 0, 0.22, 'triangle', 0.07);
      note(320, 0, 0.16, 'sine', 0.04);
    },
    challenge() {
      note(220, 0, 0.16, 'sawtooth', 0.05);
      note(233, 0, 0.16, 'sawtooth', 0.045);
      note(110, 0.1, 0.28, 'sine', 0.07);
    },
    prove() {
      note(880, 0, 0.12, 'sine', 0.05);
      note(1320, 0.09, 0.16, 'sine', 0.05);
      note(1760, 0.18, 0.24, 'triangle', 0.04);
    },
    caught() {
      note(440, 0, 0.12, 'sawtooth', 0.045);
      note(330, 0.1, 0.14, 'sawtooth', 0.04);
      note(220, 0.22, 0.3, 'sine', 0.06);
    },
    lose() {
      note(140, 0, 0.32, 'sine', 0.09, 70);
      noise(0, 0.2, 0.03, 400);
    },
    eliminate() {
      note(110, 0, 0.6, 'sine', 0.08, 55);
      note(165, 0.05, 0.5, 'sine', 0.03, 82);
    },
    win() {
      const seq = [523.25, 659.25, 783.99, 1046.5];
      seq.forEach((f, i) => note(f, i * 0.11, 0.5, 'triangle', 0.06));
      note(261.63, 0, 0.9, 'sine', 0.05);
    },
    defeat() {
      const seq = [392, 349.23, 293.66, 220];
      seq.forEach((f, i) => note(f, i * 0.16, 0.55, 'triangle', 0.055));
    }
  };

  function play(name) {
    if (!enabled) return;
    const fn = sounds[name];
    if (fn) fn();
  }

  return {
    init,
    play,
    setEnabled,
    isEnabled: () => enabled
  };
})();
