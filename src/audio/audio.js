'use strict';
/**
 * ZEHN procedural audio (A10). Service: `sim.services.audio`.
 *
 * Everything is synthesised in the Web Audio graph — no audio files. The
 * AudioContext is created lazily on the first user gesture (`unlock()`), as
 * browsers require. When WebAudio is unavailable (node, old browsers, blocked
 * contexts) every method is a silent no-op that never throws.
 *
 * Graph:
 *   stimBus (experiment tones/noise; uncompressed so dB steps stay exact) ─┐
 *   uiBus  ─┐                                                             ├─ master (sim.settings.volume / .audio) ─ destination
 *   ambBus (zone beds; ducked to 0 during experiments) ─ comp ─────────────┘
 *
 * Experiment hook (docs/EXPERIMENT_API.md):
 *   audio.tone({freq, dur, pan, gain, type, when})   dur/when in seconds; `when` = offset from now
 *   audio.noise({dur, pan, gain, when, color})
 * pan −1 / +1 is exact hard panning (equal-power law: the other ear gets 0), for
 * dichotic listening. Start times are snapped to the sample grid and scheduled on
 * the audio clock, so offsets inside one call (and calls in the same JS turn) are
 * sample-accurate.
 *
 * Bus: listens to zone:enter, xp:gain, badge:earned, consent:given, exp:start,
 * exp:complete, exp:withdrawn, settings:changed. Emits `caption` {text} for
 * meaningful sounds when sim.settings.captions is on (throttled for ambience).
 */
const D = require('./dsp.js');

const LOOKAHEAD = 0.012; // s added to "now" so the first ramp point is never in the past
const MAX_VOICES = 40; // cap for ambience/UI one-shots (experiment stimuli are never dropped)
const TICK_MS = 100;
const SCHED_AHEAD = 0.25; // s of ambience events scheduled ahead of the audio clock
const XFADE = 2.5; // s zone crossfade
const TYPES = new Set(['sine', 'square', 'sawtooth', 'triangle']);

const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const NULL_HANDLE = Object.freeze({ ok: false, start: null, end: null, stop() {} });

function getCtor(opts) {
  if (opts && opts.AudioContext) return opts.AudioContext;
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function makeNoise(ctx, color, seconds) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0; let b1 = 0; let b2 = 0; let last = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
    } else if (color === 'brown') {
      last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2;
    } else d[i] = w;
  }
  // short crossfade at the loop point so looping beds do not click
  const f = Math.min(256, n >> 2);
  for (let i = 0; i < f; i++) { const k = i / f; d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k; }
  return buf;
}

/* ------------------------------------------------------------------------- */
/* Zone ambience recipes. build(eng, bed) makes the looping bed; events are    */
/* one-shots scheduled on the audio clock every [min,max] seconds.             */
/* ------------------------------------------------------------------------- */

function birdCall(eng, bed, t) {
  const pan = rnd(-0.8, 0.8);
  const kind = pick(['sparrow', 'myna', 'bulbul', 'sparrow', 'babbler']);
  const g = rnd(0.006, 0.014);
  if (kind === 'sparrow') {
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) eng._blip(bed.out, t + i * rnd(0.09, 0.14), { freq: rnd(4200, 5200), freq2: rnd(3000, 3600), dur: 0.06, gain: g, pan });
  } else if (kind === 'myna') {
    eng._blip(bed.out, t, { freq: rnd(1500, 1900), freq2: rnd(2600, 3200), dur: 0.22, gain: g, pan, attack: 0.02 });
    eng._blip(bed.out, t + 0.28, { freq: rnd(2800, 3100), freq2: rnd(1400, 1700), dur: 0.18, gain: g * 0.8, pan, attack: 0.02 });
  } else if (kind === 'bulbul') {
    const base = rnd(1700, 2200);
    [1, 1.25, 1.12].forEach((r, i) => eng._blip(bed.out, t + i * 0.16, { freq: base * r, freq2: base * r * 1.08, dur: 0.13, gain: g, pan, attack: 0.015 }));
  } else {
    for (let i = 0; i < 5; i++) eng._blip(bed.out, t + i * 0.07, { freq: rnd(2400, 2900), dur: 0.05, gain: g * 0.7, pan, type: 'triangle' });
  }
}

function click(eng, dest, t, o = {}) {
  eng._burst(dest, t, { color: 'white', dur: o.dur || 0.012, gain: o.gain || 0.03, ftype: 'bandpass', freq: o.freq || 2600, q: o.q || 1.5, pan: o.pan || 0, attack: 0.0005 });
}

function rickshaw(eng, bed, t) {
  const dur = rnd(4, 6.5);
  const dir = Math.random() < 0.5 ? -1 : 1;
  eng._voice((reg, track) => {
    const c = eng.ctx;
    const env = eng._G(reg, 0);
    let panIn = null;
    if (c.createStereoPanner) {
      const sp = reg(c.createStereoPanner());
      sp.pan.setValueAtTime(-0.85 * dir, t); sp.pan.linearRampToValueAtTime(0.85 * dir, t + dur);
      sp.connect(bed.out); panIn = sp;
    } else { env.connect(bed.out); }
    if (panIn) env.connect(panIn);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.035, t + dur * 0.45);
    env.gain.linearRampToValueAtTime(0.0, t + dur);
    const lp = eng._F(reg, 'lowpass', 420, 1.2, env);
    // two-stroke putter: low saw at the firing rate, slight Doppler drop as it passes
    const f = rnd(24, 31);
    const o1 = eng._O(reg, 'sawtooth', f, lp);
    const o2 = eng._O(reg, 'square', f * 2.01, eng._G(reg, 0.25, lp));
    for (const o of [o1, o2]) {
      o.frequency.setValueAtTime(o.frequency.value * 1.05, t);
      o.frequency.linearRampToValueAtTime(o.frequency.value * 0.95, t + dur);
    }
    // exhaust noise gated by the firing rate
    const nz = eng._N(reg, 'pink');
    const bp = eng._F(reg, 'bandpass', 260, 1.5);
    const gate = eng._G(reg, 0.5, lp);
    nz.connect(bp); bp.connect(gate);
    const lfo = eng._O(reg, 'square', f, eng._G(reg, 0.5, gate.gain));
    for (const s of [o1, o2, nz, lfo]) { s.start(t); s.stop(t + dur + 0.05); track(s); }
  });
  eng._captionLater('[an auto-rickshaw putters past]', 'rickshaw', 45, t);
}

function vendorCall(eng, bed, t) {
  const pan = rnd(-0.7, 0.7);
  const dur = rnd(0.9, 1.5);
  eng._voice((reg, track) => {
    const env = eng._G(reg, 0);
    env.connect(eng._P(reg, pan, bed.out));
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.012, t + 0.08);
    env.gain.setValueAtTime(0.012, t + dur * 0.7);
    env.gain.linearRampToValueAtTime(0, t + dur);
    const lp = eng._F(reg, 'lowpass', 1400, 0.7, env);
    // vowel-like formants on a glottal saw; muffled so it stays unintelligible
    const f1 = eng._F(reg, 'bandpass', rnd(600, 800), 5, lp);
    const f2 = eng._F(reg, 'bandpass', rnd(1050, 1300), 6, lp);
    const o = eng._O(reg, 'sawtooth', 170);
    o.connect(f1); o.connect(f2);
    const p = rnd(150, 200);
    o.frequency.setValueAtTime(p, t);
    o.frequency.linearRampToValueAtTime(p * 1.35, t + dur * 0.3);
    o.frequency.linearRampToValueAtTime(p * 1.3, t + dur * 0.65);
    o.frequency.linearRampToValueAtTime(p * 0.9, t + dur);
    o.start(t); o.stop(t + dur + 0.05); track(o);
  });
  eng._captionLater('[a vendor calls out, unintelligible]', 'vendor', 40, t);
}

function bicycleBell(eng, bed, t) {
  const pan = rnd(-0.7, 0.7);
  const f = rnd(2000, 2300);
  for (let i = 0; i < 2; i++) eng._bell(bed.out, t + i * 0.17, { freq: f, gain: 0.02, decay: 0.55, pan, partials: [[1, 1], [1.52, 0.5], [2.31, 0.3], [3.1, 0.15]] });
  eng._captionLater('[bicycle bell rings]', 'bicycle', 30, t);
}

function horn(eng, bed, t) {
  const pan = rnd(-0.9, 0.9);
  const dur = rnd(0.25, 0.6);
  eng._voice((reg, track) => {
    const env = eng._G(reg, 0);
    env.connect(eng._P(reg, pan, bed.out));
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.005, t + 0.03);
    env.gain.setValueAtTime(0.005, t + dur); env.gain.linearRampToValueAtTime(0, t + dur + 0.05);
    const lp = eng._F(reg, 'lowpass', 900, 0.7, env);
    for (const f of [410, 515]) { const o = eng._O(reg, 'square', f, lp); o.start(t); o.stop(t + dur + 0.08); track(o); }
  });
  eng._captionLater('[distant horn]', 'horn', 60, t);
}

function pageTurn(eng, bed, t) {
  eng._burst(bed.out, t, { color: 'pink', dur: rnd(0.25, 0.4), gain: 0.022, ftype: 'bandpass', freq: 1200, freq2: 4200, q: 0.9, pan: rnd(-0.6, 0.6), attack: 0.08 });
  eng._captionLater('[a page turns]', 'page', 45, t);
}

function breath(eng, bed, t) {
  // inhale ~1.8 s, exhale ~2.4 s (≈12 breaths/min, the resting rate)
  eng._voice((reg, track) => {
    const nz = eng._N(reg, 'pink');
    const bp = eng._F(reg, 'bandpass', 700, 0.8);
    const env = eng._G(reg, 0, bed.out);
    nz.connect(bp); bp.connect(env);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.03, t + 1.6);
    env.gain.linearRampToValueAtTime(0.006, t + 1.9);
    env.gain.linearRampToValueAtTime(0.024, t + 2.3);
    env.gain.linearRampToValueAtTime(0, t + 4.3);
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.setValueAtTime(800, t + 1.8);
    bp.frequency.linearRampToValueAtTime(450, t + 4.3);
    nz.start(t, Math.random()); nz.stop(t + 4.4); track(nz);
  });
}

function clockTick(eng, bed, t) {
  bed.state.tock = !bed.state.tock;
  click(eng, bed.out, t, { freq: bed.state.tock ? 2300 : 3100, q: 6, gain: 0.025, dur: 0.01, pan: 0.35 });
}

const ZONES = {
  courtyard: {
    caption: '[ambience: birdsong, rustling neem leaves, distant traffic, murmur of a chai stall]',
    build(eng, bed) {
      // leaves: airy pink noise with slow gusts
      const leaves = eng._loopNoise(bed, 'pink', 'bandpass', 3000, 0.6, 0.012);
      eng._lfo(bed, 0.13, 0.007, leaves.gain); eng._lfo(bed, 0.37, 0.004, leaves.gain);
      // distant traffic rumble
      const traffic = eng._loopNoise(bed, 'brown', 'lowpass', 220, 0.7, 0.05);
      eng._lfo(bed, 0.05, 0.015, traffic.gain);
      // chai stall chatter, off to the right
      eng._murmur(bed, 0.012, 0.4);
    },
    events: [
      { every: [0.8, 4], fn: birdCall },
      { every: [14, 32], fn: (eng, bed, t) => { eng._bell(bed.out, t, { freq: rnd(2500, 2900), gain: 0.008, decay: 0.25, pan: 0.45 }); eng._captionLater('[cups clink at the chai stall]', 'clink', 60, t); } },
      { every: [18, 45], fn: horn },
    ],
  },
  wundt: {
    caption: '[ambience: quiet museum hall, slow pendulum clock]',
    build(eng, bed) {
      eng._loopNoise(bed, 'brown', 'lowpass', 250, 0.7, 0.02);
      eng._loopNoise(bed, 'pink', 'lowpass', 1500, 0.5, 0.004);
    },
    events: [
      { every: [2, 2], fn: clockTick },
      { every: [45, 90], fn: (eng, bed, t) => { [0, 0.9, 1.8].forEach((d, i) => eng._bell(bed.out, t + d, { freq: [659, 523, 587][i], gain: 0.012, decay: 1.8, pan: 0.35 })); eng._captionLater('[a clock chimes]', 'chime', 60, t); } },
    ],
  },
  explab: {
    caption: '[ambience: lab equipment hum, relay clicks, keyboard tapping]',
    build(eng, bed) {
      const hum = eng._G(bed.add, 1, bed.out);
      // Indian mains is 50 Hz: hum plus harmonics
      [[50, 0.01], [100, 0.006], [150, 0.003]].forEach(([f, g]) => eng._drone(bed, 'sine', f, g, hum));
      eng._loopNoise(bed, 'pink', 'lowpass', 900, 0.5, 0.01);
    },
    events: [
      { every: [1.5, 6], fn: (eng, bed, t) => click(eng, bed.out, t, { pan: rnd(-0.7, 0.7), freq: rnd(1800, 3200), gain: 0.035 }) },
      { every: [5, 12], fn: (eng, bed, t) => { const pan = rnd(-0.6, 0.6); let d = 0; const n = 4 + Math.floor(Math.random() * 7); for (let i = 0; i < n; i++) { d += rnd(0.08, 0.2); click(eng, bed.out, t + d, { pan, freq: rnd(3500, 4500), gain: 0.012, dur: 0.008 }); } } },
      { every: [20, 45], fn: (eng, bed, t) => { eng._blip(bed.out, t, { freq: 1000, dur: 0.1, gain: 0.006, type: 'sine', pan: rnd(-0.5, 0.5), attack: 0.005 }); eng._captionLater('[equipment beeps]', 'beep', 60, t); } },
    ],
  },
  neuro: {
    caption: '[ambience: soft synth pad, gentle neural pops]',
    build(eng, bed) {
      const lp = eng._F(bed.add, 'lowpass', 900, 0.8, eng._G(bed.add, 1, bed.out));
      eng._lfo(bed, 0.07, 400, lp.frequency);
      const trem = eng._G(bed.add, 0.8, lp);
      eng._lfo(bed, 0.11, 0.2, trem.gain);
      for (const m of [45, 52, 57, 61, 64]) { // A2 E3 A3 C#4 E4
        const f = D.midiToHz(m);
        eng._drone(bed, 'triangle', f * D.semitones(0.03), 0.006, trem);
        eng._drone(bed, 'sine', f * D.semitones(-0.03), 0.006, trem);
      }
    },
    events: [
      { every: [0.4, 2.5], fn: (eng, bed, t) => eng._blip(bed.out, t, { freq: 1300, freq2: 280, dur: 0.035, gain: 0.008, pan: rnd(-0.9, 0.9), attack: 0.001 }) },
      { every: [10, 22], fn: (eng, bed, t) => eng._bell(bed.out, t, { freq: pick([880, 1109, 1319, 1760]), gain: 0.005, decay: 2.5, pan: rnd(-0.6, 0.6) }) },
    ],
  },
  sleep: {
    caption: '[ambience: slow breathing, a ticking clock]',
    build(eng, bed) { eng._loopNoise(bed, 'brown', 'lowpass', 180, 0.7, 0.02); },
    events: [
      { every: [1, 1], fn: clockTick },
      { every: [4.6, 5.6], fn: breath },
    ],
  },
  learning: {
    caption: '[ambience: lever clicks, pellet dispenser, ventilation hum]',
    build(eng, bed) {
      eng._loopNoise(bed, 'brown', 'lowpass', 300, 0.7, 0.02);
      eng._drone(bed, 'sine', 120, 0.003, bed.out);
    },
    events: [
      { every: [0.6, 3.5], fn: (eng, bed, t) => { const pan = rnd(-0.6, 0.6); click(eng, bed.out, t, { pan, freq: 2500, gain: 0.03 }); click(eng, bed.out, t + 0.035, { pan, freq: 900, q: 2, gain: 0.035, dur: 0.02 }); } },
      { every: [3, 9], fn: (eng, bed, t) => { const pan = rnd(-0.6, 0.6); for (let i = 0; i < 5; i++) click(eng, bed.out, t + i * rnd(0.025, 0.05), { pan, freq: rnd(4000, 6000), q: 3, gain: 0.012, dur: 0.006 }); } },
      { every: [25, 55], fn: (eng, bed, t) => { eng._bell(bed.out, t, { freq: 1250, gain: 0.018, decay: 1.6, pan: -0.3 }); eng._captionLater('[bell rings]', 'pavlov', 30, t); } },
    ],
  },
  childdev: {
    caption: '[ambience: quiet playroom, soft music box]',
    build(eng, bed) { eng._loopNoise(bed, 'brown', 'lowpass', 240, 0.7, 0.016); eng._loopNoise(bed, 'pink', 'lowpass', 1200, 0.5, 0.003); },
    events: [
      { every: [1.5, 5], fn: (eng, bed, t) => eng._bell(bed.out, t, { freq: D.midiToHz(pick([72, 74, 76, 79, 81, 84])), gain: 0.006, decay: 1.2, pan: 0.3, partials: [[1, 1], [3.9, 0.2]] }) },
      { every: [20, 50], fn: (eng, bed, t) => { for (let i = 0; i < 6; i++) click(eng, bed.out, t + i * 0.06, { freq: 3500, q: 2, gain: 0.01, pan: -0.4 }); eng._captionLater('[a toy rattles]', 'rattle', 60, t); } },
    ],
  },
  clinic: {
    caption: '[ambience: calm, quiet counselling room]',
    build(eng, bed) {
      const room = eng._loopNoise(bed, 'brown', 'lowpass', 260, 0.7, 0.018);
      eng._lfo(bed, 0.03, 0.004, room.gain);
      eng._loopNoise(bed, 'pink', 'lowpass', 900, 0.5, 0.004);
    },
    events: [],
  },
  mohalla: {
    caption: '[ambience: busy mohalla street, rickshaws, vendors murmuring, bicycle bells]',
    build(eng, bed) {
      const traffic = eng._loopNoise(bed, 'brown', 'lowpass', 300, 0.7, 0.05);
      eng._lfo(bed, 0.07, 0.015, traffic.gain);
      eng._murmur(bed, 0.016, -0.35);
      eng._murmur(bed, 0.012, 0.45);
    },
    events: [
      { every: [6, 16], fn: rickshaw },
      { every: [7, 18], fn: vendorCall },
      { every: [8, 22], fn: bicycleBell },
      { every: [12, 30], fn: horn },
    ],
  },
  library: {
    caption: '[ambience: very quiet library, pages turning]',
    build(eng, bed) { eng._loopNoise(bed, 'brown', 'lowpass', 200, 0.7, 0.012); eng._loopNoise(bed, 'pink', 'lowpass', 1200, 0.5, 0.002); },
    events: [{ every: [5, 14], fn: pageTurn }],
  },
};

/* UI cues. Notes: [freq, offsetS, durS]. Only meaningful cues are captioned. */
const UI = {
  click: { type: 'triangle', gain: 0.04, notes: [[1800, 0, 0.03]] },
  open: { type: 'sine', gain: 0.05, sweep: [500, 900, 0.12] },
  close: { type: 'sine', gain: 0.05, sweep: [900, 500, 0.12] },
  success: { type: 'triangle', gain: 0.07, notes: [[523.25, 0, 0.14], [659.25, 0.1, 0.14], [783.99, 0.2, 0.3]], caption: '[success chime]' },
  fail: { type: 'triangle', gain: 0.07, notes: [[220, 0, 0.18], [185, 0.16, 0.3]], caption: '[error tone]' },
  xp: { type: 'sine', gain: 0.05, notes: [[880, 0, 0.08], [1318.5, 0.07, 0.16]], caption: '[XP chime]' },
  badge: { type: 'triangle', gain: 0.07, notes: [[523.25, 0, 0.12], [659.25, 0.11, 0.12], [783.99, 0.22, 0.12]], bell: [1046.5, 0.33], caption: '[badge earned fanfare]' },
  consent: { type: 'sine', gain: 0.05, notes: [[659.25, 0, 0.25], [880, 0.18, 0.45]], caption: '[consent recorded chime]' },
};

class AudioEngine {
  /**
   * @param sim  shared sim object (settings, bus, state)
   * @param opts {AudioContext?, window?, document?} — injection for tests
   */
  constructor(sim, opts = {}) {
    this.sim = sim || { settings: {} };
    this._opts = opts;
    this._Ctor = getCtor(opts);
    this.available = !!this._Ctor;
    this.ctx = null;
    this.zone = null;
    this.wantZone = (this.sim.state && this.sim.state.zone) || null;
    this.bed = null;
    this.ducked = false;
    this._voices = 0;
    this._live = new Set();
    this._capAt = {};
    this._uiAt = {};
    this._timers = new Set();
    this._offs = [];
    this._master = null;
    this._disposed = false;
    this._hidden = false;
    this._win = opts.window || (typeof window !== 'undefined' ? window : null);
    this._doc = opts.document || (typeof document !== 'undefined' ? document : null);
    this._wireBus();
    this._wireDom();
  }

  get ready() { return !!this.ctx && !this._disposed; }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }
  get voiceCount() { return this._voices; }
  /** Audio-clock time (s), or null before unlock. */
  now() { return this.ctx ? this.ctx.currentTime : null; }

  /* ----------------------------- lifecycle ------------------------------ */

  /** Create/resume the AudioContext. Call from a user gesture. Returns true when running. */
  unlock() {
    if (!this.available || this._disposed) return false;
    try {
      if (!this.ctx) {
        this.ctx = new this._Ctor({ latencyHint: 'interactive' });
        this._build();
        this._tickId = setInterval(() => { try { this._tick(); } catch (e) { /* never break the game loop */ } }, TICK_MS);
        if (this.wantZone) this.ambience(this.wantZone);
      }
      if (this.ctx.state === 'suspended' && !this._hidden) {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
      return this.ctx.state === 'running';
    } catch (e) {
      this.ctx = null;
      this.available = false;
      return false;
    }
  }

  _wireBus() {
    const bus = this.sim.bus;
    if (!bus || typeof bus.on !== 'function') return;
    const on = (ev, fn) => { const off = bus.on(ev, (p) => { try { fn(p || {}); } catch (e) { /* ignore */ } }); this._offs.push(typeof off === 'function' ? off : () => bus.off && bus.off(ev, fn)); };
    on('zone:enter', (p) => this.ambience(p.zone));
    on('xp:gain', () => this.ui('xp'));
    on('badge:earned', () => this.ui('badge'));
    on('consent:given', () => this.ui('consent'));
    on('exp:start', () => this.duck(true));
    on('exp:complete', () => this.duck(false));
    on('exp:withdrawn', () => { this.stopAll(); this.duck(false); });
    on('settings:changed', () => this.applySettings());
  }

  _wireDom() {
    const w = this._win; const d = this._doc;
    if (w && w.addEventListener && this.available) {
      this._gesture = () => { if (this.unlock()) this._unwireGesture(); };
      for (const ev of ['pointerdown', 'keydown', 'touchstart']) w.addEventListener(ev, this._gesture, { capture: true, passive: true });
    }
    if (d && d.addEventListener) {
      this._vis = () => this._setHidden(!!d.hidden);
      d.addEventListener('visibilitychange', this._vis);
    }
  }

  _unwireGesture() {
    const w = this._win;
    if (!w || !this._gesture) return;
    for (const ev of ['pointerdown', 'keydown', 'touchstart']) w.removeEventListener(ev, this._gesture, { capture: true });
    this._gesture = null;
  }

  _setHidden(hidden) {
    this._hidden = hidden;
    if (!this.ctx) return;
    try {
      const p = hidden ? this.ctx.suspend() : this.ctx.resume();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* ignore */ }
  }

  dispose() {
    this._disposed = true;
    for (const off of this._offs) { try { off(); } catch (e) { /* ignore */ } }
    this._offs = [];
    this._unwireGesture();
    if (this._doc && this._vis) this._doc.removeEventListener('visibilitychange', this._vis);
    if (this._tickId) clearInterval(this._tickId);
    for (const id of this._timers) clearTimeout(id);
    this._timers.clear();
    if (this.ctx) { try { const p = this.ctx.close(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }
    this.ctx = null; this.bed = null;
  }

  _later(ms, fn) {
    const id = setTimeout(() => { this._timers.delete(id); try { fn(); } catch (e) { /* ignore */ } }, ms);
    this._timers.add(id);
    return id;
  }

  /* ------------------------------- graph -------------------------------- */

  _build() {
    const c = this.ctx;
    const reg = (n) => n;
    this.master = this._G(reg, 0, c.destination);
    this._master = D.masterGain(this.sim.settings);
    this.master.gain.setValueAtTime(0, c.currentTime);
    this.master.gain.linearRampToValueAtTime(this._master, c.currentTime + 0.4);
    this.stimBus = this._G(reg, 1, this.master);
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.01; comp.release.value = 0.3;
    comp.connect(this.master);
    this.uiBus = this._G(reg, 0.9, comp);
    this.ambBus = this._G(reg, this.ducked ? 0 : 1, comp);
    this.buffers = { white: makeNoise(c, 'white', 2), pink: makeNoise(c, 'pink', 3), brown: makeNoise(c, 'brown', 4) };
  }

  _G(reg, v, dest) { const g = reg(this.ctx.createGain()); g.gain.value = v; if (dest) g.connect(dest); return g; }
  _F(reg, type, f, q, dest) { const n = reg(this.ctx.createBiquadFilter()); n.type = type; n.frequency.value = f; n.Q.value = q; if (dest) n.connect(dest); return n; }
  _O(reg, type, f, dest) { const o = reg(this.ctx.createOscillator()); o.type = type; o.frequency.value = f; if (dest) o.connect(dest); return o; }
  _N(reg, color, dest) {
    const s = reg(this.ctx.createBufferSource());
    s.buffer = this.buffers[color] || this.buffers.white; s.loop = true;
    if (dest) s.connect(dest);
    return s;
  }

  /** Panner input node routed to dest. pan ±1 is exact hard panning. */
  _P(reg, pan, dest) {
    const c = this.ctx;
    const p = D.clamp(num(pan, 0), -1, 1);
    if (c.createStereoPanner) {
      const sp = reg(c.createStereoPanner());
      sp.pan.value = p;
      sp.connect(dest);
      return sp;
    }
    // fallback: explicit equal-power gains into a 2-channel merger
    const inp = reg(c.createGain());
    try { inp.channelCount = 1; inp.channelCountMode = 'explicit'; inp.channelInterpretation = 'speakers'; } catch (e) { /* ignore */ }
    const m = reg(c.createChannelMerger(2));
    const { l, r } = D.equalPowerPan(p);
    const gl = this._G(reg, l); const gr = this._G(reg, r);
    inp.connect(gl); inp.connect(gr);
    gl.connect(m, 0, 0); gr.connect(m, 0, 1);
    m.connect(dest);
    return inp;
  }

  /** Absolute audio-clock time for an offset `when` (s), snapped to the sample grid. */
  _at(when) {
    const c = this.ctx;
    return D.snapToSample(c.currentTime + LOOKAHEAD + Math.max(0, num(when, 0)), c.sampleRate);
  }

  /**
   * Run a short-lived voice: build(reg, track) creates nodes; all are
   * disconnected when the tracked sources end. Capped unless `stim`.
   */
  _voice(build, stim = false) {
    if (!this.ctx) return null;
    if (!stim && this._voices >= MAX_VOICES) return null;
    const nodes = [];
    const srcs = [];
    const reg = (n) => { nodes.push(n); return n; };
    let left = 0; let done = false;
    if (!stim) this._voices++;
    const v = { nodes, srcs, finish: null };
    const finish = () => {
      if (done) return; done = true;
      if (!stim) this._voices--;
      this._live.delete(v);
      for (const n of nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    };
    v.finish = finish;
    const track = (s) => { left++; srcs.push(s); s.onended = () => { if (--left <= 0) finish(); }; };
    try { build(reg, track); } catch (e) { finish(); return null; }
    if (left === 0) { finish(); return null; }
    if (stim) this._live.add(v);
    return v;
  }

  /** Gain envelope for a gated stimulus: linear on/off ramps inside dur (or ADSR). */
  _gate(param, t0, peak, dur, o) {
    if (o.adsr) {
      const pts = D.adsrPoints(Object.assign({}, o.adsr, { peak, dur }));
      param.setValueAtTime(0, t0);
      for (let i = 1; i < pts.length; i++) param.linearRampToValueAtTime(pts[i][1], t0 + pts[i][0]);
      return t0 + pts[pts.length - 1][0];
    }
    let a = Math.max(0, num(o.attack, 0.005));
    let r = Math.max(0, num(o.release, 0.005));
    if (a + r > dur) { const k = dur / (a + r); a *= k; r *= k; }
    param.setValueAtTime(0, t0);
    if (a > 0) param.linearRampToValueAtTime(peak, t0 + a); else param.setValueAtTime(peak, t0);
    param.setValueAtTime(peak, t0 + dur - r);
    param.linearRampToValueAtTime(0, t0 + dur);
    return t0 + dur;
  }

  _handle(v, t0, end, gainNode) {
    if (!v) return NULL_HANDLE;
    const self = this;
    return {
      ok: true, start: t0, end,
      stop(fade = 0.01) {
        try {
          const c = self.ctx; if (!c) return;
          const t = c.currentTime;
          if (gainNode) { gainNode.gain.cancelScheduledValues(t); gainNode.gain.setValueAtTime(gainNode.gain.value, t); gainNode.gain.linearRampToValueAtTime(0, t + fade); }
          for (const s of v.srcs) { try { s.stop(t + fade + 0.005); } catch (e) { /* ignore */ } }
        } catch (e) { /* ignore */ }
      },
    };
  }

  /* --------------------------- experiment API --------------------------- */

  /**
   * Pure tone. {freq=440 Hz, dur=0.2 s, pan=0, gain=0.2 | db (re max, ≤0), type='sine',
   * when=0 s, attack=0.005, release=0.005, adsr?, caption?}. Returns {ok, start, end, stop()}.
   */
  tone(o = {}) {
    if (!this.ctx && !this.unlock() && !this.ctx) return NULL_HANDLE;
    try {
      const c = this.ctx;
      const freq = D.clamp(num(o.freq, 440), 1, c.sampleRate / 2);
      const dur = Math.max(0.001, num(o.dur, 0.2));
      const peak = o.db != null ? D.dbToGain(Math.min(0, num(o.db, -120))) : D.clamp(num(o.gain, 0.2), 0, 1);
      const type = TYPES.has(o.type) ? o.type : 'sine';
      const t0 = this._at(o.when);
      let env; let end = t0 + dur;
      const v = this._voice((reg, track) => {
        env = this._G(reg, 0);
        env.connect(this._P(reg, o.pan, o._dest || this.stimBus));
        end = this._gate(env.gain, t0, peak, dur, o);
        const osc = this._O(reg, type, freq, env);
        osc.frequency.setValueAtTime(freq, t0);
        osc.start(t0); osc.stop(end + 0.01); track(osc);
      }, true);
      if (o.caption) this._caption(o.caption);
      return this._handle(v, t0, end, env);
    } catch (e) { return NULL_HANDLE; }
  }

  /** Noise burst. {dur=0.2, pan=0, gain=0.1 | db, when=0, color='white'|'pink'|'brown', filter?:{type,freq,q}, caption?}. */
  noise(o = {}) {
    if (!this.ctx && !this.unlock() && !this.ctx) return NULL_HANDLE;
    try {
      const dur = Math.max(0.001, num(o.dur, 0.2));
      const peak = o.db != null ? D.dbToGain(Math.min(0, num(o.db, -120))) : D.clamp(num(o.gain, 0.1), 0, 1);
      const t0 = this._at(o.when);
      let env; let end = t0 + dur;
      const v = this._voice((reg, track) => {
        env = this._G(reg, 0);
        env.connect(this._P(reg, o.pan, o._dest || this.stimBus));
        end = this._gate(env.gain, t0, peak, dur, Object.assign({ attack: 0.002, release: 0.005 }, o));
        const src = this._N(reg, o.color || 'white');
        if (o.filter && o.filter.type) src.connect(this._F(reg, o.filter.type, num(o.filter.freq, 1000), num(o.filter.q, 0.7), env));
        else src.connect(env);
        src.start(t0, Math.random() * 1.5); src.stop(end + 0.01); track(src);
      }, true);
      if (o.caption) this._caption(o.caption);
      return this._handle(v, t0, end, env);
    } catch (e) { return NULL_HANDLE; }
  }

  /** Frequency sweep. {f0=200, f1=2000, dur=1, curve='exp'|'lin', pan, gain=0.15, type, when, caption?}. */
  chirp(o = {}) {
    if (!this.ctx && !this.unlock() && !this.ctx) return NULL_HANDLE;
    try {
      const c = this.ctx;
      const f0 = D.clamp(num(o.f0, 200), 1, c.sampleRate / 2);
      const f1 = D.clamp(num(o.f1, 2000), 1, c.sampleRate / 2);
      const dur = Math.max(0.01, num(o.dur, 1));
      const peak = o.db != null ? D.dbToGain(Math.min(0, num(o.db, -120))) : D.clamp(num(o.gain, 0.15), 0, 1);
      const t0 = this._at(o.when);
      let env; let end = t0 + dur;
      const v = this._voice((reg, track) => {
        env = this._G(reg, 0);
        env.connect(this._P(reg, o.pan, this.stimBus));
        end = this._gate(env.gain, t0, peak, dur, Object.assign({ attack: 0.01, release: 0.02 }, o));
        const osc = this._O(reg, TYPES.has(o.type) ? o.type : 'sine', f0, env);
        osc.frequency.setValueAtTime(f0, t0);
        if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(f1, t0 + dur);
        else osc.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
        osc.start(t0); osc.stop(end + 0.01); track(osc);
      }, true);
      if (o.caption) this._caption(o.caption);
      return this._handle(v, t0, end, env);
    } catch (e) { return NULL_HANDLE; }
  }

  /**
   * Binaural-beat demo: baseFreq to the left ear, baseFreq+beat to the right
   * (headphones needed; the beat is constructed in the brainstem, not the air).
   */
  binaural(baseFreq = 200, beat = 6, dur = 8, o = {}) {
    if (!this.ctx && !this.unlock() && !this.ctx) return NULL_HANDLE;
    try {
      const { left, right } = D.binauralFreqs(baseFreq, beat);
      const d = Math.max(0.5, num(dur, 8));
      const peak = D.clamp(num(o.gain, 0.12), 0, 1);
      const t0 = this._at(o.when);
      let env; const end = t0 + d;
      const v = this._voice((reg, track) => {
        env = this._G(reg, 0);
        const fade = Math.min(0.5, d / 4);
        this._gate(env.gain, t0, peak, d, { attack: fade, release: fade });
        [[left, -1], [right, 1]].forEach(([f, pan]) => {
          const osc = this._O(reg, 'sine', f);
          const g = this._G(reg, 1);
          osc.connect(g); g.connect(env);
          // each ear needs its own panner after the shared envelope
          const ear = this._G(reg, 1);
          osc.disconnect(); osc.connect(ear); ear.connect(this._G(reg, 1, this._P(reg, pan, this.stimBus)));
          ear.gain.value = 0; ear.gain.setValueAtTime(0, t0);
          this._gate(ear.gain, t0, peak, d, { attack: fade, release: fade });
          osc.start(t0); osc.stop(end + 0.01); track(osc);
        });
      }, true);
      this._caption(o.caption || `[binaural beat: ${Math.round(left)} Hz left ear, ${Math.round(right)} Hz right ear; headphones needed]`);
      return this._handle(v, t0, end, null);
    } catch (e) { return NULL_HANDLE; }
  }

  /** Psychophysics helper: tone at `dB` re maximum stimulus level (0 dB = gain 1; −20 dB = 0.1). */
  toneAtDb(freq, dB, o = {}) {
    return this.tone(Object.assign({}, o, { freq, db: num(dB, -120) }));
  }

  /** Dichotic pair, same onset: left/right are tone opts ({noise:true} for a noise burst). */
  dichotic(left = {}, right = {}, when = 0) {
    const play = (o, pan) => (o.noise ? this.noise(Object.assign({}, o, { pan, when })) : this.tone(Object.assign({}, o, { pan, when })));
    return { left: play(left, -1), right: play(right, 1) };
  }

  /** Stop every experiment stimulus still playing (withdrawal / abort). */
  stopAll() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const v of [...this._live]) {
      for (const s of v.srcs) { try { s.stop(t + 0.01); } catch (e) { /* ignore */ } }
    }
  }

  /* --------------------------------- UI --------------------------------- */

  ui(name) {
    if (!this.ctx && !this.unlock() && !this.ctx) return false;
    try {
      const def = UI[name];
      if (!def) return false;
      const nowMs = Date.now();
      if (this._uiAt[name] && nowMs - this._uiAt[name] < 50) return false;
      this._uiAt[name] = nowMs;
      const t = this._at(0);
      if (def.sweep) {
        const [a, b, d] = def.sweep;
        this._blip(this.uiBus, t, { freq: a, freq2: b, dur: d, gain: def.gain, type: def.type, attack: 0.01 });
      }
      for (const [f, off, d] of def.notes || []) this._blip(this.uiBus, t + off, { freq: f, dur: d, gain: def.gain, type: def.type, attack: 0.006 });
      if (def.bell) this._bell(this.uiBus, t + def.bell[1], { freq: def.bell[0], gain: def.gain * 0.8, decay: 1.2 });
      if (def.caption) this._caption(def.caption);
      return true;
    } catch (e) { return false; }
  }

  /* one-shot building blocks (capped voices) */

  /** Short decaying tone, optional pitch sweep freq -> freq2. */
  _blip(dest, t, o) {
    const dur = Math.max(0.01, num(o.dur, 0.1));
    return this._voice((reg, track) => {
      const env = this._G(reg, 0);
      env.connect(o.pan ? this._P(reg, o.pan, dest) : dest);
      const a = Math.min(num(o.attack, 0.004), dur / 2);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(num(o.gain, 0.05), t + a);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const osc = this._O(reg, TYPES.has(o.type) ? o.type : 'sine', o.freq, env);
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.freq2) osc.frequency.exponentialRampToValueAtTime(o.freq2, t + dur);
      osc.start(t); osc.stop(t + dur + 0.02); track(osc);
    });
  }

  /** Filtered noise burst with optional filter sweep freq -> freq2. */
  _burst(dest, t, o) {
    const dur = Math.max(0.003, num(o.dur, 0.05));
    return this._voice((reg, track) => {
      const env = this._G(reg, 0);
      env.connect(o.pan ? this._P(reg, o.pan, dest) : dest);
      const a = Math.min(num(o.attack, 0.002), dur / 2);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(num(o.gain, 0.03), t + a);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const f = this._F(reg, o.ftype || 'bandpass', num(o.freq, 2000), num(o.q, 1), env);
      f.frequency.setValueAtTime(num(o.freq, 2000), t);
      if (o.freq2) f.frequency.exponentialRampToValueAtTime(o.freq2, t + dur);
      const src = this._N(reg, o.color || 'white', f);
      src.start(t, Math.random()); src.stop(t + dur + 0.02); track(src);
    });
  }

  /** Struck bell / metal: inharmonic partials with exponential decay. */
  _bell(dest, t, o) {
    const partials = o.partials || [[1, 1], [2.0, 0.6], [2.76, 0.4], [5.4, 0.25], [8.93, 0.12]];
    const decay = Math.max(0.05, num(o.decay, 1));
    return this._voice((reg, track) => {
      const out = this._G(reg, 1);
      out.connect(o.pan ? this._P(reg, o.pan, dest) : dest);
      partials.forEach(([ratio, amp], i) => {
        const f = o.freq * ratio;
        if (f >= this.ctx.sampleRate / 2) return;
        const env = this._G(reg, 0, out);
        const d = decay / (1 + i * 0.5);
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(num(o.gain, 0.02) * amp, t + 0.003);
        env.gain.exponentialRampToValueAtTime(0.0001, t + d);
        const osc = this._O(reg, 'sine', f, env);
        osc.start(t); osc.stop(t + d + 0.02); track(osc);
      });
    });
  }

  /* ------------------------------ ambience ------------------------------ */

  _loopNoise(bed, color, ftype, freq, q, gain) {
    const g = this._G(bed.add, gain, bed.out);
    const f = this._F(bed.add, ftype, freq, q, g);
    const s = this._N(bed.add, color, f);
    s.start(0, Math.random() * 1.5); bed.srcs.push(s);
    return { gain: g.gain, filter: f };
  }

  _drone(bed, type, freq, gain, dest) {
    const o = this._O(bed.add, type, freq, this._G(bed.add, gain, dest));
    o.start(); bed.srcs.push(o);
    return o;
  }

  _lfo(bed, rate, depth, param) {
    const o = this._O(bed.add, 'sine', rate, this._G(bed.add, depth, param));
    o.start(0); bed.srcs.push(o);
    return o;
  }

  /** Unintelligible crowd murmur: formant-filtered pink noise with syllabic (3–5 Hz) modulation. */
  _murmur(bed, gain, pan) {
    const out = this._G(bed.add, gain, this._P(bed.add, pan, bed.out));
    const lp = this._F(bed.add, 'lowpass', 1600, 0.6, out);
    const am = this._G(bed.add, 0.5, lp);
    this._lfo(bed, rnd(3.0, 3.6), 0.25, am.gain);
    this._lfo(bed, rnd(4.6, 5.2), 0.15, am.gain);
    this._lfo(bed, rnd(0.9, 1.3), 0.12, am.gain);
    const src = this._N(bed.add, 'pink');
    src.start(0, Math.random() * 2); bed.srcs.push(src);
    for (const [f, q, depth] of [[450, 4, 120], [950, 5, 220], [1500, 6, 300]]) {
      const bp = this._F(bed.add, 'bandpass', f, q, this._G(bed.add, 0.6, am));
      src.connect(bp);
      this._lfo(bed, rnd(0.15, 0.5), depth, bp.frequency);
    }
  }

  _newBed(zone) {
    const bed = { zone, nodes: [], srcs: [], next: [], state: {}, out: null };
    bed.add = (n) => { bed.nodes.push(n); return n; };
    bed.out = this._G(bed.add, 0, this.ambBus);
    return bed;
  }

  _disposeBed(bed) {
    for (const s of bed.srcs) { try { s.stop(); } catch (e) { /* ignore */ } }
    for (const n of bed.nodes) { try { n.disconnect(); } catch (e) { /* ignore */ } }
    bed.srcs = []; bed.nodes = [];
  }

  /** Crossfade to the procedural bed of `zone` (docs/ARCHITECTURE.md §2 zone ids). */
  ambience(zone) {
    this.wantZone = zone || null;
    if (!this.ctx) return false;
    try {
      if (this.bed && this.bed.zone === zone) return true;
      const c = this.ctx;
      const t = c.currentTime;
      const old = this.bed;
      if (old) {
        old.out.gain.cancelScheduledValues(t);
        old.out.gain.setValueAtTime(old.out.gain.value, t);
        old.out.gain.linearRampToValueAtTime(0, t + XFADE);
        this._later((XFADE + 0.5) * 1000, () => this._disposeBed(old));
      }
      this.bed = null;
      this.zone = zone || null;
      const recipe = ZONES[zone];
      if (!recipe) return false;
      const bed = this._newBed(zone);
      recipe.build(this, bed);
      bed.out.gain.setValueAtTime(0, t);
      bed.out.gain.linearRampToValueAtTime(1, t + XFADE);
      bed.next = recipe.events.map((ev) => t + (ev.every[0] === ev.every[1] ? 0.5 : rnd(0.5, ev.every[1])));
      this.bed = bed;
      if (!this.ducked && D.masterGain(this.sim.settings) > 0) this._caption(recipe.caption, 'zone:' + zone, 20);
      return true;
    } catch (e) { return false; }
  }

  /** Duck ambience to 0 during experiments (on) and restore it (off). */
  duck(on) {
    this.ducked = !!on;
    if (!this.ctx) return;
    try {
      const g = this.ambBus.gain; const t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.setTargetAtTime(on ? 0 : 1, t, on ? 0.08 : 0.8);
    } catch (e) { /* ignore */ }
  }

  /** Re-read sim.settings.volume / .audio and ramp the master gain. */
  applySettings() {
    if (!this.ctx) return;
    const target = D.masterGain(this.sim.settings);
    if (target === this._master) return;
    this._master = target;
    try { this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08); } catch (e) { /* ignore */ }
  }

  _tick() {
    if (!this.ctx || this._disposed) return;
    this.applySettings();
    const bed = this.bed;
    if (!bed) return;
    const recipe = ZONES[bed.zone];
    const now = this.ctx.currentTime;
    const idle = this._hidden || this.ducked || this._master === 0 || this.ctx.state !== 'running';
    recipe.events.forEach((ev, i) => {
      let guard = 0;
      while (bed.next[i] < now + SCHED_AHEAD && guard++ < 8) {
        const t = bed.next[i];
        if (!idle && t >= now) { try { ev.fn(this, bed, D.snapToSample(t, this.ctx.sampleRate)); } catch (e) { /* ignore */ } }
        bed.next[i] = Math.max(t, now) + rnd(ev.every[0], ev.every[1]);
      }
    });
  }

  /* ------------------------------ captions ------------------------------ */

  _caption(text, key, minGapS = 0) {
    const s = this.sim.settings || {};
    const bus = this.sim.bus;
    if (!text || !s.captions || !bus || typeof bus.emit !== 'function') return false;
    if (key) {
      const nowMs = Date.now();
      if (this._capAt[key] && nowMs - this._capAt[key] < minGapS * 1000) return false;
      this._capAt[key] = nowMs;
    }
    bus.emit('caption', { text });
    return true;
  }

  /** Caption timed to when a scheduled ambience sound actually plays. */
  _captionLater(text, key, minGapS, t) {
    const delay = this.ctx ? Math.max(0, (t - this.ctx.currentTime) * 1000) : 0;
    if (delay < 20) return this._caption(text, key, minGapS);
    this._later(delay, () => this._caption(text, key, minGapS));
    return true;
  }
}

AudioEngine.ZONES = Object.keys(ZONES);
AudioEngine.UI_SOUNDS = Object.keys(UI);
module.exports = { AudioEngine, LOOKAHEAD };
