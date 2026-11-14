'use strict';
/**
 * Pure audio maths for ZEHN (A10). No WebAudio, no DOM: `node --test` loads it.
 *
 * - dB <-> linear gain conversions (amplitude convention: 20·log10)
 * - stereo panning laws (equal-power, as StereoPannerNode uses; hard pan is exact)
 * - ADSR envelope values and breakpoint lists for AudioParam scheduling
 * - binaural-beat and chirp maths
 * - master-gain resolution from sim.settings
 */

const MIN_DB = -120;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

/** Decibels (re full scale / max) to linear amplitude gain. 0 dB -> 1, -6.02 dB -> 0.5, -20 dB -> 0.1. */
function dbToGain(db) {
  db = num(db, MIN_DB);
  if (db <= MIN_DB) return 0;
  return Math.pow(10, db / 20);
}

/** Linear amplitude gain to decibels. gain <= 0 -> MIN_DB (-120). */
function gainToDb(gain) {
  gain = num(gain, 0);
  if (gain <= 0) return MIN_DB;
  return Math.max(MIN_DB, 20 * Math.log10(gain));
}

/** Power ratio to dB (10·log10). */
function powerToDb(ratio) {
  ratio = num(ratio, 0);
  return ratio <= 0 ? MIN_DB : Math.max(MIN_DB, 10 * Math.log10(ratio));
}

/**
 * Equal-power pan law for a mono source, identical to the WebAudio
 * StereoPannerNode spec: x = (pan + 1) / 2, L = cos(x·π/2), R = sin(x·π/2).
 * pan −1 / +1 give exactly {l:1, r:0} / {l:0, r:1} (dichotic listening needs this).
 */
function equalPowerPan(pan) {
  const p = clamp(num(pan, 0), -1, 1);
  if (p === -1) return { l: 1, r: 0 };
  if (p === 1) return { l: 0, r: 1 };
  const x = (p + 1) / 2;
  return { l: Math.cos((x * Math.PI) / 2), r: Math.sin((x * Math.PI) / 2) };
}

/** Linear pan law (sums to 1; −6 dB in the centre). */
function linearPan(pan) {
  const p = clamp(num(pan, 0), -1, 1);
  return { l: (1 - p) / 2, r: (1 + p) / 2 };
}

/** Crossfade gains for progress t in [0,1] (equal-power). */
function crossfade(t) {
  const x = clamp(num(t, 0), 0, 1);
  return { out: Math.cos((x * Math.PI) / 2), in: Math.sin((x * Math.PI) / 2) };
}

/** Normalise ADSR options. Times in seconds; sustain is a fraction of peak. */
function adsrOpts(o = {}) {
  return {
    a: Math.max(0, num(o.a, 0.005)),
    d: Math.max(0, num(o.d, 0)),
    s: clamp(num(o.s, 1), 0, 1),
    r: Math.max(0, num(o.r, 0.01)),
    peak: Math.max(0, num(o.peak, 1)),
    dur: Math.max(0, num(o.dur, 0.2)), // gate length: release starts at t = dur
  };
}

/** Level the sustain phase would have reached at gate time g (handles gate inside A or D). */
function _gateLevel(t, e) {
  const sus = e.s * e.peak;
  if (t < e.a) return e.a > 0 ? (e.peak * t) / e.a : e.peak;
  if (t < e.a + e.d) return e.d > 0 ? e.peak + (sus - e.peak) * ((t - e.a) / e.d) : sus;
  return sus;
}

/**
 * Envelope value at time t (s) since note-on. Linear segments:
 * attack 0 -> peak, decay peak -> s·peak, hold until dur, release to 0 over r.
 */
function adsr(t, opts) {
  const e = adsrOpts(opts);
  t = num(t, 0);
  if (t < 0) return 0;
  if (t < e.dur) return _gateLevel(t, e);
  const start = _gateLevel(e.dur, e);
  if (e.r <= 0) return 0;
  const k = (t - e.dur) / e.r;
  return k >= 1 ? 0 : start * (1 - k);
}

/** Total audible length of an ADSR note (gate + release). */
function adsrLength(opts) {
  const e = adsrOpts(opts);
  return e.dur + e.r;
}

/**
 * Breakpoints [[t, value], ...] (t relative to note-on) for linearRampToValueAtTime
 * scheduling of the same envelope adsr() evaluates.
 */
function adsrPoints(opts) {
  const e = adsrOpts(opts);
  const pts = [[0, 0]];
  const sus = e.s * e.peak;
  if (e.dur <= e.a) {
    pts.push([e.dur, _gateLevel(e.dur, e)]);
  } else {
    pts.push([e.a, e.peak]);
    if (e.dur <= e.a + e.d) pts.push([e.dur, _gateLevel(e.dur, e)]);
    else {
      if (e.d > 0) pts.push([e.a + e.d, sus]);
      pts.push([e.dur, sus]);
    }
  }
  pts.push([e.dur + e.r, 0]);
  return pts;
}

/** Binaural beat: left ear base, right ear base + beat. Perceived beat = |fR − fL|. */
function binauralFreqs(base, beat) {
  const b = Math.max(1, num(base, 200));
  const d = num(beat, 6);
  return { left: b, right: b + d, beat: Math.abs(d) };
}

/** Beat frequency of two tones (Hz). */
function beatFrequency(f1, f2) {
  return Math.abs(num(f1, 0) - num(f2, 0));
}

/** Instantaneous frequency of a chirp at time t. curve 'exp' (log sweep) or 'lin'. */
function chirpFreqAt(t, f0, f1, dur, curve = 'exp') {
  const T = Math.max(1e-6, num(dur, 1));
  const k = clamp(num(t, 0) / T, 0, 1);
  const a = Math.max(1e-3, num(f0, 200));
  const b = Math.max(1e-3, num(f1, 2000));
  return curve === 'lin' ? a + (b - a) * k : a * Math.pow(b / a, k);
}

/** Frequency ratio of n semitones (12-TET). */
function semitones(n) {
  return Math.pow(2, num(n, 0) / 12);
}

/** MIDI note number to Hz (A4 = 69 = 440 Hz). */
function midiToHz(m) {
  return 440 * Math.pow(2, (num(m, 69) - 69) / 12);
}

/** Master gain from sim.settings: 0 when audio is off, else volume clamped to [0,1] (default 0.6). */
function masterGain(settings) {
  const s = settings || {};
  if (s.audio === false) return 0;
  return clamp(num(s.volume, 0.6), 0, 1);
}

/** Snap a time (s) to the sample grid of a given rate, so scheduled starts are sample-accurate. */
function snapToSample(t, sampleRate) {
  const sr = Math.max(1, num(sampleRate, 48000));
  return Math.round(num(t, 0) * sr) / sr;
}

module.exports = {
  MIN_DB, clamp, dbToGain, gainToDb, powerToDb, equalPowerPan, linearPan, crossfade,
  adsr, adsrLength, adsrPoints, binauralFreqs, beatFrequency, chirpFreqAt, semitones, midiToHz,
  masterGain, snapToSample,
};
