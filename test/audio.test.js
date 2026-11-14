'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/audio/dsp.js');
const { AudioEngine } = require('../src/audio/audio.js');
const { EventBus } = require('../src/core/bus.js');

const close = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a}`);

// ---------------------------------------------------------------- dsp.js
test('dB <-> gain round trip and reference points', () => {
  close(D.dbToGain(0), 1);
  close(D.dbToGain(-20), 0.1);
  close(D.dbToGain(-40), 0.01);
  close(D.dbToGain(-6.0206), 0.5, 1e-4);
  assert.equal(D.dbToGain(-200), 0);
  assert.equal(D.gainToDb(0), D.MIN_DB);
  for (const db of [-60, -33.3, -12, -3, 0, 6]) close(D.gainToDb(D.dbToGain(db)), db, 1e-9, `db ${db}`);
  close(D.powerToDb(2), 3.0103, 1e-4);
});

test('equal-power pan: hard pan is exact, centre is -3 dB, power constant', () => {
  assert.deepEqual(D.equalPowerPan(-1), { l: 1, r: 0 });
  assert.deepEqual(D.equalPowerPan(1), { l: 0, r: 1 });
  assert.deepEqual(D.equalPowerPan(-5), { l: 1, r: 0 }, 'clamped');
  const c = D.equalPowerPan(0);
  close(c.l, Math.SQRT1_2, 1e-12); close(c.r, Math.SQRT1_2, 1e-12);
  close(D.gainToDb(c.l), -3.0103, 1e-4);
  for (const p of [-0.9, -0.3, 0.2, 0.75]) { const g = D.equalPowerPan(p); close(g.l * g.l + g.r * g.r, 1, 1e-12); }
  const lin = D.linearPan(0.5); close(lin.l + lin.r, 1);
  const x = D.crossfade(0.5); close(x.in * x.in + x.out * x.out, 1, 1e-12);
});

test('ADSR envelope values, breakpoints and length', () => {
  const o = { a: 0.1, d: 0.1, s: 0.5, r: 0.2, peak: 1, dur: 1 };
  assert.equal(D.adsr(-0.01, o), 0);
  close(D.adsr(0.05, o), 0.5);
  close(D.adsr(0.1, o), 1);
  close(D.adsr(0.15, o), 0.75);
  close(D.adsr(0.5, o), 0.5);
  close(D.adsr(1.1, o), 0.25);
  assert.equal(D.adsr(1.3, o), 0);
  close(D.adsrLength(o), 1.2);
  const pts = D.adsrPoints(o);
  assert.deepEqual(pts.map((p) => p[0]).map((t) => +t.toFixed(9)), [0, 0.1, 0.2, 1, 1.2]);
  for (const [t, v] of pts) close(D.adsr(t, o), v, 1e-9, `pt ${t}`);
  // gate shorter than attack: release starts from the partial level
  const short = { a: 0.2, d: 0, s: 1, r: 0.1, dur: 0.1 };
  close(D.adsr(0.1, short), 0.5); close(D.adsr(0.15, short), 0.25);
});

test('binaural beat and chirp maths', () => {
  assert.deepEqual(D.binauralFreqs(200, 6), { left: 200, right: 206, beat: 6 });
  assert.equal(D.binauralFreqs(400, 10).right - D.binauralFreqs(400, 10).left, 10);
  assert.equal(D.beatFrequency(440, 444), 4);
  close(D.chirpFreqAt(0, 100, 1600, 2), 100);
  close(D.chirpFreqAt(1, 100, 1600, 2), 400, 1e-9, 'exp sweep midpoint is geometric mean');
  close(D.chirpFreqAt(1, 100, 1600, 2, 'lin'), 850);
  close(D.chirpFreqAt(5, 100, 1600, 2), 1600, 1e-9, 'clamped at end');
  close(D.semitones(12), 2); close(D.midiToHz(69), 440); close(D.midiToHz(57), 220);
});

test('master gain follows settings.audio / settings.volume; sample snapping', () => {
  assert.equal(D.masterGain({ audio: false, volume: 0.9 }), 0);
  assert.equal(D.masterGain({ audio: true, volume: 0.4 }), 0.4);
  assert.equal(D.masterGain({ volume: 3 }), 1);
  assert.equal(D.masterGain({}), 0.6);
  assert.equal(D.masterGain(null), 0.6);
  const t = D.snapToSample(1.23456789, 48000);
  close(t * 48000, Math.round(t * 48000), 1e-6);
  assert.ok(Math.abs(t - 1.23456789) <= 0.5 / 48000);
});

// ------------------------------------------------------- mock WebAudio
function mockAudio() {
  const log = { nodes: [], panners: [], starts: [], ctx: null };
  const param = (v) => ({ value: v, events: [], setValueAtTime(x, t) { this.events.push(['set', x, t]); }, linearRampToValueAtTime(x, t) { this.events.push(['lin', x, t]); }, exponentialRampToValueAtTime(x, t) { this.events.push(['exp', x, t]); }, setTargetAtTime(x, t, c) { this.events.push(['target', x, t, c]); }, cancelScheduledValues() {} });
  const node = (kind, extra = {}) => { const n = Object.assign({ kind, conns: [], connect(d) { this.conns.push(d); return d; }, disconnect() { this.conns = []; } }, extra); log.nodes.push(n); return n; };
  const src = (kind, extra) => node(kind, Object.assign({ start(t, off) { log.starts.push({ kind, t, node: this }); }, stop(t) { this.stopAt = t; } }, extra));
  class Ctx {
    constructor() { this.currentTime = 10.0; this.sampleRate = 48000; this.state = 'running'; this.destination = node('dest'); log.ctx = this; }
    createGain() { return node('gain', { gain: param(1) }); }
    createOscillator() { return src('osc', { type: 'sine', frequency: param(440) }); }
    createBufferSource() { return src('buf', { buffer: null, loop: false }); }
    createBiquadFilter() { return node('filter', { type: 'lowpass', frequency: param(350), Q: param(1) }); }
    createStereoPanner() { const p = node('panner', { pan: param(0) }); log.panners.push(p); return p; }
    createDynamicsCompressor() { return node('comp', { threshold: param(0), knee: param(0), ratio: param(1), attack: param(0), release: param(0) }); }
    createChannelMerger() { return node('merger'); }
    createBuffer(ch, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
  }
  return { Ctx, log };
}

function makeSim() {
  return { bus: new EventBus(), settings: { audio: true, volume: 0.5, captions: true }, state: { zone: null } };
}

test('no WebAudio: every method is a silent no-op', () => {
  const sim = makeSim();
  const a = new AudioEngine(sim); // node: no window, no AudioContext
  assert.equal(a.available, false);
  assert.equal(a.unlock(), false);
  const h = a.tone({ freq: 1000, dur: 0.1, pan: -1 });
  assert.equal(h.ok, false); h.stop();
  assert.equal(a.noise({ dur: 0.1 }).ok, false);
  assert.equal(a.chirp({}).ok, false);
  assert.equal(a.binaural(200, 6, 4).ok, false);
  assert.equal(a.toneAtDb(1000, -20).ok, false);
  assert.equal(a.ui('click'), false);
  assert.equal(a.ambience('courtyard'), false);
  assert.doesNotThrow(() => { sim.bus.emit('zone:enter', { zone: 'mohalla' }); sim.bus.emit('exp:start', {}); sim.bus.emit('xp:gain', { n: 5 }); a.duck(true); a.stopAll(); a.dispose(); });
});

test('tone: hard pan exact, dB gain, sample-accurate when offsets', () => {
  const { Ctx, log } = mockAudio();
  const a = new AudioEngine(makeSim(), { AudioContext: Ctx });
  assert.ok(a.unlock());
  const L = a.tone({ freq: 1000, dur: 0.2, pan: -1, gain: 0.3 });
  const R = a.tone({ freq: 1000, dur: 0.2, pan: 1, db: -20, when: 0.5 });
  assert.ok(L.ok && R.ok);
  const pans = log.panners.slice(-2).map((p) => p.pan.value);
  assert.deepEqual(pans, [-1, 1]);
  close(R.start - L.start, 0.5, 1 / 48000, 'offset');
  for (const t of [L.start, R.start]) close(t * 48000, Math.round(t * 48000), 1e-6, 'on sample grid');
  assert.ok(L.start > log.ctx.currentTime, 'scheduled in the future');
  // the envelope peak of R is 10^(-20/20) = 0.1
  const oscR = log.starts.filter((s) => s.kind === 'osc').pop().node;
  const envR = oscR.conns[0];
  const peak = Math.max(...envR.gain.events.map((e) => e[1]));
  close(peak, 0.1, 1e-12);
  close(R.end - R.start, 0.2, 1e-9, 'gated duration');
  const n = a.noise({ dur: 0.25, gain: 0.08, when: 0.4, pan: 1 });
  close(n.start - L.start, 0.4, 1 / 48000);
  const b = a.binaural(200, 6, 4);
  assert.ok(b.ok);
  const freqs = log.starts.filter((s) => s.kind === 'osc').slice(-2).map((s) => s.node.frequency.value);
  assert.deepEqual(freqs, [200, 206]);
  assert.deepEqual(log.panners.slice(-2).map((p) => p.pan.value), [-1, 1]);
  a.dispose();
});

test('bus wiring: captions, ducking, zone ambience, settings', () => {
  const { Ctx } = mockAudio();
  const sim = makeSim();
  const caps = [];
  sim.bus.on('caption', (p) => caps.push(p.text));
  const a = new AudioEngine(sim, { AudioContext: Ctx });
  a.unlock();
  for (const z of AudioEngine.ZONES) { sim.bus.emit('zone:enter', { zone: z }); assert.equal(a.zone, z); assert.ok(a.bed && a.bed.zone === z, z); }
  assert.ok(caps.some((c) => /mohalla/.test(c)));
  sim.bus.emit('badge:earned', { id: 'x' });
  assert.ok(caps.includes('[badge earned fanfare]'));
  for (const n of AudioEngine.UI_SOUNDS) assert.doesNotThrow(() => a.ui(n));
  sim.bus.emit('exp:start', { paradigm: 'dichotic' });
  assert.equal(a.ducked, true);
  assert.deepEqual(a.ambBus.gain.events.pop().slice(0, 2), ['target', 0]);
  sim.bus.emit('exp:complete', { paradigm: 'dichotic' });
  assert.equal(a.ducked, false);
  sim.settings.captions = false; const before = caps.length;
  a.ui('success'); assert.equal(caps.length, before, 'no captions when disabled');
  sim.settings.audio = false; sim.bus.emit('settings:changed', {});
  assert.deepEqual(a.master.gain.events.pop().slice(0, 2), ['target', 0]);
  // ambience scheduler runs without throwing for every zone
  for (const z of AudioEngine.ZONES) { sim.settings.audio = true; a.ambience(z); a.ctx.currentTime += 30; a._tick(); a._tick(); }
  assert.ok(a.voiceCount <= 40);
  a.dispose();
});
