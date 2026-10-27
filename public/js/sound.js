/* ============================================================
   Coup — casino-table sound design (synthesized, no assets)
   Chip clinks, card riffles, roulette ticks, slot bells.
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
        master.gain.value = 0.72;

        // The casino cues live in the highs: lift the air band.
        const air = ctx.createBiquadFilter();
        air.type = 'highshelf';
        air.frequency.value = 3000;
        air.gain.value = 2;

        // Keep stacked chips, bells and coin showers from clipping.
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -17;
        compressor.knee.value = 12;
        compressor.ratio.value = 7;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.14;

        master.connect(air);
        air.connect(compressor);
        compressor.connect(ctx.destination);
      } catch (e) {
        ctx = null;
        master = null;
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

  function note(freq, start, dur, type = 'sine', gain = 0.12, slideTo = null, attack = null) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + start;
    const osc = c.createOscillator();
    const g = c.createGain();
    const a = attack === null ? Math.min(0.004, Math.max(0.001, dur * 0.08)) : attack;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);

    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(start, dur, gain = 0.05, filterFreq = 1600, type = 'bandpass', q = 0.9) {
    const c = ensure();
    if (!c) return;
    const t0 = c.currentTime + start;
    const frames = Math.max(1, Math.floor(c.sampleRate * dur));
    const buffer = c.createBuffer(1, frames, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 1.35);
    }

    const src = c.createBufferSource();
    src.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    filter.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.0025);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.01);
  }

  /* A single clay chip, or a small stack when struck twice. */
  function chip(start = 0, gain = 0.07, base = 2100) {
    note(base, start, 0.034, 'triangle', gain, null, 0.001);
    note(base * 1.47, start + 0.003, 0.026, 'sine', gain * 0.62, null, 0.001);
    noise(start, 0.017, gain * 0.42, 4700, 'highpass', 0.7);
    if (gain >= 0.05) {
      note(base * 1.12, start + 0.039, 0.028, 'triangle', gain * 0.5, null, 0.001);
      note(base * 1.61, start + 0.044, 0.021, 'sine', gain * 0.3, null, 0.001);
    }
  }

  /* Cards sliding off the deck. */
  function riffle(start = 0, count = 5, gain = 0.065) {
    for (let i = 0; i < count; i++) {
      const at = start + i * 0.031 + Math.random() * 0.008;
      noise(at, 0.03, gain * (0.55 + Math.random() * 0.45), 1800 + Math.random() * 900, 'bandpass', 0.8);
      note(2400 + Math.random() * 900, at, 0.014, 'triangle', gain * 0.16, null, 0.001);
    }
  }

  /* Roulette ball ticking around the wheel, then settling. */
  function roulette(start = 0, count = 7, gain = 0.035) {
    let at = start;
    for (let i = 0; i < count; i++) {
      note(1700 - i * 70 + Math.random() * 120, at, 0.018, 'square', gain * (1 - i * 0.055), null, 0.001);
      noise(at, 0.013, gain * 0.45, 5000, 'highpass', 0.9);
      at += 0.033 + i * 0.007;
    }
    note(128, at, 0.13, 'sine', 0.085, 78);
  }

  /* A bright table bell. */
  function bell(freq, start = 0, gain = 0.09, dur = 0.36) {
    note(freq, start, dur, 'sine', gain, null, 0.002);
    note(freq * 2.01, start + 0.003, dur * 0.72, 'sine', gain * 0.45, null, 0.002);
    note(freq * 3.02, start + 0.006, dur * 0.38, 'sine', gain * 0.18, null, 0.002);
    noise(start, 0.019, gain * 0.28, 3400, 'highpass', 0.7);
  }

  function coinRain(start = 0, count = 8, gain = 0.032) {
    for (let i = 0; i < count; i++) {
      const at = start + i * 0.042 + Math.random() * 0.018;
      const freq = 1700 + Math.random() * 1900;
      note(freq, at, 0.039, 'triangle', gain * (0.5 + Math.random() * 0.6), null, 0.001);
      note(freq * 1.5, at + 0.007, 0.028, 'sine', gain * 0.24, null, 0.001);
    }
  }

  function chipCrash(start = 0, gain = 0.075) {
    for (let i = 0; i < 5; i++) {
      chip(start + i * 0.018, gain * (0.7 - i * 0.09), 1550 + Math.random() * 800);
    }
    note(92, start + 0.03, 0.2, 'sine', 0.14, 54);
    noise(start + 0.02, 0.12, gain * 0.42, 620, 'lowpass', 0.7);
  }

  function buzzer(start = 0, dur = 0.24, gain = 0.07, from = 220, to = 105) {
    note(from, start, dur, 'sawtooth', gain, to, 0.002);
    note(from * 1.01, start, dur, 'square', gain * 0.24, to, 0.002);
    noise(start, dur * 0.45, gain * 0.2, 750, 'lowpass', 0.7);
  }

  const sounds = {
    click() {
      chip(0, 0.038, 2650);
    },
    deal() {
      riffle(0, 5, 0.075);
      note(140, 0.14, 0.06, 'sine', 0.045, 105);
    },
    action() {
      chip(0, 0.085, 1550);
      note(128, 0, 0.075, 'sine', 0.12, 84);
      noise(0, 0.052, 0.035, 950, 'lowpass', 0.8);
    },
    coin() {
      chip(0, 0.08, 2200);
      note(2637, 0.024, 0.06, 'sine', 0.06, null, 0.001);
      note(3136, 0.045, 0.045, 'sine', 0.042, null, 0.001);
    },
    block() {
      noise(0, 0.05, 0.085, 1250, 'bandpass', 0.7);
      note(140, 0, 0.115, 'sine', 0.16, 68);
      chip(0.022, 0.06, 1250);
    },
    challenge() {
      note(1568, 0, 0.055, 'triangle', 0.07);
      roulette(0.025, 7, 0.032);
      note(178, 0.045, 0.16, 'sine', 0.105, 112);
    },
    prove() {
      chip(0, 0.04, 2350);
      bell(1318.5, 0.02, 0.085, 0.3);
      bell(1760, 0.105, 0.07, 0.34);
    },
    caught() {
      buzzer(0, 0.25, 0.08, 233, 105);
      noise(0.02, 0.05, 0.04, 1600, 'bandpass', 0.9);
      note(174, 0.15, 0.22, 'sine', 0.09, 88);
    },
    lose() {
      chipCrash(0, 0.075);
      note(150, 0.02, 0.2, 'sine', 0.09, 65);
    },
    eliminate() {
      bell(392, 0, 0.08, 0.3);
      bell(329.63, 0.12, 0.075, 0.32);
      bell(261.63, 0.24, 0.075, 0.45);
      note(88, 0.24, 0.38, 'sine', 0.13, 48);
      chip(0.24, 0.04, 1500);
    },
    win() {
      // A slot jackpot: fast chime run, bells, then a coin shower.
      const run = [783.99, 1046.5, 1318.5, 1568, 2093];
      run.forEach((f, i) => note(f, i * 0.06, 0.2, 'triangle', 0.085));
      bell(1046.5, 0, 0.1, 0.42);
      bell(1318.5, 0.105, 0.09, 0.46);
      bell(1568, 0.21, 0.085, 0.52);
      coinRain(0.12, 9, 0.034);
      note(261.63, 0, 0.52, 'sine', 0.09);
    },
    defeat() {
      // The cash-out line: a slow descent from the tables.
      [392, 349.23, 293.66, 233.08].forEach((f, i) => bell(f, i * 0.115, 0.07, 0.34));
      note(98, 0.28, 0.5, 'sine', 0.09);
      chip(0.42, 0.04, 1400);
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
