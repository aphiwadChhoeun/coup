/* ============================================================
   Coup — tiny synthesized sound design (no assets)
   Short attacks, bright transients, compressed master.
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

        // Lift the top end a touch so clicks read as crisp rather than dull.
        const air = ctx.createBiquadFilter();
        air.type = 'highshelf';
        air.frequency.value = 2800;
        air.gain.value = 1.5;

        // Keep the new, hotter transients from clipping when several land together.
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16;
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
      const fade = Math.pow(1 - i / frames, 1.35);
      data[i] = (Math.random() * 2 - 1) * fade;
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

  function snap(start = 0, gain = 0.025, freq = 3000) {
    noise(start, 0.022, gain, freq, 'highpass', 0.7);
    note(freq * 0.82, start, 0.026, 'triangle', gain * 0.55);
  }

  const sounds = {
    click() {
      snap(0, 0.02, 3300);
      note(1046.5, 0, 0.03, 'triangle', 0.045);
    },
    deal() {
      noise(0, 0.085, 0.065, 2300, 'bandpass', 0.7);
      note(150, 0.012, 0.07, 'triangle', 0.05, 110);
    },
    action() {
      note(165, 0, 0.085, 'sine', 0.15, 90);
      noise(0, 0.07, 0.055, 800, 'lowpass', 1);
      snap(0, 0.022, 2200);
    },
    coin() {
      note(1975.5, 0, 0.05, 'triangle', 0.095);
      note(2637, 0.032, 0.075, 'sine', 0.08);
      snap(0, 0.018, 3800);
    },
    block() {
      note(150, 0, 0.13, 'triangle', 0.15, 72);
      note(430, 0.008, 0.065, 'triangle', 0.07, 300);
      noise(0, 0.055, 0.045, 650, 'lowpass', 0.8);
    },
    challenge() {
      note(880, 0, 0.075, 'square', 0.072);
      note(932.3, 0.018, 0.075, 'square', 0.06);
      note(174, 0.045, 0.19, 'sine', 0.13, 116);
      noise(0, 0.05, 0.04, 1900, 'bandpass', 1.1);
    },
    prove() {
      note(880, 0, 0.065, 'triangle', 0.09);
      note(1318.5, 0.055, 0.075, 'triangle', 0.08);
      note(1760, 0.11, 0.14, 'sine', 0.075);
      snap(0.11, 0.022, 3100);
    },
    caught() {
      note(523.3, 0, 0.07, 'square', 0.075);
      note(392, 0.075, 0.08, 'square', 0.065);
      note(261.6, 0.15, 0.17, 'sine', 0.11, 180);
      noise(0, 0.05, 0.03, 900, 'lowpass', 0.8);
    },
    lose() {
      note(180, 0, 0.19, 'sine', 0.17, 66);
      noise(0, 0.1, 0.06, 480, 'lowpass', 0.8);
      snap(0, 0.022, 1800);
    },
    eliminate() {
      note(110, 0, 0.46, 'sine', 0.17, 44);
      note(165, 0.03, 0.36, 'triangle', 0.065, 82);
      noise(0, 0.14, 0.05, 320, 'lowpass', 0.7);
    },
    win() {
      const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      seq.forEach((f, i) => note(f, i * 0.065, 0.28, 'triangle', 0.10));
      note(261.63, 0, 0.52, 'sine', 0.09);
      note(1568, 0.23, 0.36, 'sine', 0.055);
      snap(0.23, 0.018, 3600);
    },
    defeat() {
      const seq = [392, 349.23, 293.66, 233.08, 196];
      seq.forEach((f, i) => note(f, i * 0.11, 0.32, 'triangle', 0.09));
      note(98, 0.22, 0.52, 'sine', 0.1);
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
