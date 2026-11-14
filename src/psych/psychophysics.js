'use strict';
/**
 * Psychophysics & performance laws (Panels 10, 13, 15, 17). Pure.
 *  Weber        ΔI/I = k
 *  Fechner      S = k·ln(I/I₀)
 *  Stevens      ψ = k·φᵃ   (fit by log–log regression; slope = a)
 *  Hick–Hyman   RT = a + b·log₂(n+1)
 *  Fitts        MT = a + b·log₂(2D/W)   (Shannon: log₂(D/W + 1), MacKenzie 1992)
 *  Ebbinghaus   savings % = 100·(OL − RL)/OL;  retention model R = e^(−t/S)  (labelled "model")
 *  Mental rot.  RT = a + b·angle (ms/deg)
 */
const S = require('./stats.js');

const weberFraction = (deltaI, I) => deltaI / I;
/** Fit Weber k as the mean ΔI/I across standards; also slope through origin. */
function fitWeber(pairs) {
  const ks = pairs.map((p) => p.jnd / p.I);
  const sxy = S.sum(pairs.map((p) => p.I * p.jnd)), sxx = S.sum(pairs.map((p) => p.I * p.I));
  return { k: S.mean(ks), kSlope: sxy / sxx, ks };
}
const fechner = (I, I0, k = 1) => k * Math.log(I / I0);
const stevens = (phi, k, a) => k * Math.pow(phi, a);
function fitStevens(phis, psis) {
  const reg = S.regression(phis.map(Math.log), psis.map(Math.log));
  return { a: reg.b, k: Math.exp(reg.a), r2: reg.r2 };
}

const hickBits = (n) => Math.log2(n + 1);
function fitHick(ns, rts) { const r = S.regression(ns.map(hickBits), rts); return { a: r.a, b: r.b, r2: r.r2 }; }

const fittsID = (D, W) => Math.log2((2 * D) / W);
const fittsIDShannon = (D, W) => Math.log2(D / W + 1);
function fitFitts(Ds, Ws, MTs, shannon = false) {
  const ids = Ds.map((d, i) => (shannon ? fittsIDShannon(d, Ws[i]) : fittsID(d, Ws[i])));
  const r = S.regression(ids, MTs);
  return { a: r.a, b: r.b, r2: r.r2, throughput: 1000 / r.b };
}

const savings = (OL, RL) => (100 * (OL - RL)) / OL;
const retentionModel = (t, Sv) => Math.exp(-t / Sv);

function fitRotation(angles, rts) { const r = S.regression(angles, rts); return { intercept: r.a, slope: r.b, r2: r.r2 }; }

/**
 * Serial-position summary: % recall per position; primacy = mean(pos 1–3), recency = mean(last 3).
 * recalledByList: array of lists, each a boolean array by position.
 */
function serialPosition(recalledByList) {
  const L = recalledByList[0].length;
  const pct = [];
  for (let i = 0; i < L; i++) pct.push(100 * S.mean(recalledByList.map((l) => (l[i] ? 1 : 0))));
  return { pct, primacy: S.mean(pct.slice(0, 3)), middle: S.mean(pct.slice(3, L - 3)), recency: S.mean(pct.slice(L - 3)) };
}

/**
 * Transformed up/down staircase (Levitt 1971). `n`-down-1-up converges on
 * the p = 0.5^(1/n) point (2-down-1-up → 70.7%).
 */
class Staircase {
  constructor({ start, step, minStep = step / 4, nDown = 2, floor = 0, ceiling = Infinity, maxReversals = 8 }) {
    Object.assign(this, { level: start, step, minStep, nDown, floor, ceiling, maxReversals });
    this.correctRun = 0; this.lastDir = 0; this.reversals = []; this.history = [];
  }
  update(correct) {
    this.history.push({ level: this.level, correct });
    let dir = 0;
    if (correct) { this.correctRun++; if (this.correctRun >= this.nDown) { dir = -1; this.correctRun = 0; } } else { dir = 1; this.correctRun = 0; }
    if (dir !== 0) {
      if (this.lastDir !== 0 && dir !== this.lastDir) {
        this.reversals.push(this.level);
        this.step = Math.max(this.minStep, this.step / 2);
      }
      this.lastDir = dir;
      this.level = Math.min(this.ceiling, Math.max(this.floor, this.level + dir * this.step));
    }
    return this.level;
  }
  get done() { return this.reversals.length >= this.maxReversals; }
  /** Threshold = mean of reversals after discarding the first two. */
  threshold() { const r = this.reversals.slice(2); return r.length ? S.mean(r) : this.level; }
}

module.exports = {
  weberFraction, fitWeber, fechner, stevens, fitStevens, hickBits, fitHick,
  fittsID, fittsIDShannon, fitFitts, savings, retentionModel, fitRotation, serialPosition, Staircase,
};
