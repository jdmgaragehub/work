'use strict';
/**
 * Seeded random numbers (`sim.rng`). mulberry32 — same generator family as the
 * benchmark — plus the distributions the participant model needs.
 * Pure: no DOM, no THREE. Tested in test/rng.test.js.
 */

function hashSeed(seed) {
  // Accept numbers or strings ("?seed=iibs-2026"); FNV-1a for strings.
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed == null ? 'zehn' : seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = hashSeed(seed);
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Rng {
  constructor(seed) {
    this.seed = hashSeed(seed);
    this.next = mulberry32(this.seed);
    this._spare = null;
  }
  random() { return this.next(); }
  uniform(a = 0, b = 1) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  chance(p) { return this.next() < p; }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  /** Standard normal via Box–Muller (polar form, cached spare). */
  normal(mu = 0, sigma = 1) {
    if (this._spare !== null) { const s = this._spare; this._spare = null; return mu + sigma * s; }
    let u, v, s;
    do { u = this.next() * 2 - 1; v = this.next() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
    const m = Math.sqrt(-2 * Math.log(s) / s);
    this._spare = v * m;
    return mu + sigma * u * m;
  }
  exponential(mean) { return -mean * Math.log(1 - this.next()); }
  /** Ex-Gaussian RT: Normal(mu, sigma) + Exponential(tau). Standard RT model. */
  exGaussian(mu, sigma, tau) { return this.normal(mu, sigma) + this.exponential(tau); }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  fork(label) { return new Rng(hashSeed(this.seed + ':' + label)); }
}

module.exports = { Rng, mulberry32, hashSeed };
