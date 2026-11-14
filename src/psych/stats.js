'use strict';
/**
 * Statistics Workbench engine (§5.3). Pure functions, no DOM.
 * Formulas follow standard intro-stats texts (e.g. Gravetter & Wallnau; Howell);
 * p-values via regularised incomplete beta/gamma in ./dist.js.
 */
const D = require('./dist.js');

const sum = (xs) => xs.reduce((a, b) => a + b, 0);
const mean = (xs) => sum(xs) / xs.length;

/** Sum of squared deviations Σ(x − x̄)². */
function ss(xs) { const m = mean(xs); let s = 0; for (const x of xs) s += (x - m) * (x - m); return s; }
/** Sample variance s² = Σ(x−x̄)²/(n−1). */
function variance(xs) { return ss(xs) / (xs.length - 1); }
/** Population variance σ² = Σ(x−μ)²/N. */
function varianceP(xs) { return ss(xs) / xs.length; }
/** Sample SD s = √[Σ(x−x̄)²/(n−1)]. */
function sd(xs) { return Math.sqrt(variance(xs)); }
/** Population SD σ = √[Σ(x−μ)²/N]. */
function sdP(xs) { return Math.sqrt(varianceP(xs)); }

function quantile(xs, q) {
  // Type-7 (R default / NumPy linear) quantile.
  const s = xs.slice().sort((a, b) => a - b);
  const h = (s.length - 1) * q;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (h - lo) * (s[hi] - s[lo]);
}
const median = (xs) => quantile(xs, 0.5);

function describe(xs) {
  const n = xs.length;
  const m = mean(xs);
  const s = n > 1 ? sd(xs) : 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  // Sample skewness (adjusted Fisher–Pearson G1).
  let m3 = 0, m2 = 0;
  for (const x of xs) { m2 += (x - m) ** 2; m3 += (x - m) ** 3; }
  m2 /= n; m3 /= n;
  const g1 = m2 > 0 ? m3 / Math.pow(m2, 1.5) : 0;
  const skew = n > 2 ? g1 * Math.sqrt(n * (n - 1)) / (n - 2) : 0;
  return {
    n, mean: m, sd: s, sdPop: sdP(xs), variance: n > 1 ? variance(xs) : 0,
    min: sorted[0], max: sorted[n - 1], median: median(xs),
    q1: quantile(xs, 0.25), q3: quantile(xs, 0.75), sem: s / Math.sqrt(n), skew,
  };
}

/** z = (x−μ)/σ. */
const z = (x, mu, sigma) => (x - mu) / sigma;
/** T = 50 + 10z. */
const tScore = (zv) => 50 + 10 * zv;
/** Deviation IQ-style = 100 + 15z. */
const iqScore = (zv) => 100 + 15 * zv;
/** Percentile = 100·Φ(z). */
const percentile = (zv) => 100 * D.normCdf(zv);

/** Pearson r = Σ(x−x̄)(y−ȳ)/√[Σ(x−x̄)²·Σ(y−ȳ)²], with t-test p (df = n−2). */
function pearson(x, y) {
  const n = x.length;
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx, dy = y[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const r = sxy / Math.sqrt(sxx * syy);
  const df = n - 2;
  const rc = Math.max(-1, Math.min(1, r));
  const t = Math.abs(rc) >= 1 ? Infinity * Math.sign(rc) : rc * Math.sqrt(df / (1 - rc * rc));
  const p = Number.isFinite(t) ? D.tP2(t, df) : 0;
  return { r: rc, t, df, p, n };
}

/** Simple regression: b = r·(s_y/s_x); a = ȳ − b·x̄; R² = r². */
function regression(x, y) {
  const c = pearson(x, y);
  const b = c.r * (sd(y) / sd(x));
  const a = mean(y) - b * mean(x);
  const n = x.length;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (y[i] - (a + b * x[i])) ** 2;
  const seEst = Math.sqrt(sse / (n - 2));
  const seB = seEst / Math.sqrt(ss(x));
  return { a, b, r: c.r, r2: c.r * c.r, seB, t: b / seB, df: n - 2, p: c.p, predict: (v) => a + b * v };
}

/**
 * Independent-samples t. Student (pooled):
 * t = (x̄₁−x̄₂)/[s_p√(1/n₁+1/n₂)], s_p² = [(n₁−1)s₁²+(n₂−1)s₂²]/(n₁+n₂−2), df = n₁+n₂−2.
 * Welch option: df by Welch–Satterthwaite.
 */
function tIndependent(a, b, { welch = false } = {}) {
  const n1 = a.length, n2 = b.length;
  const m1 = mean(a), m2 = mean(b);
  const v1 = variance(a), v2 = variance(b);
  const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
  const sp = Math.sqrt(sp2);
  let t, df;
  if (welch) {
    const se2 = v1 / n1 + v2 / n2;
    t = (m1 - m2) / Math.sqrt(se2);
    df = se2 * se2 / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  } else {
    t = (m1 - m2) / (sp * Math.sqrt(1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  }
  const p = D.tP2(t, df);
  const d = (m1 - m2) / sp;
  return { t, df, p, d, m1, m2, sd1: Math.sqrt(v1), sd2: Math.sqrt(v2), n1, n2, sp, welch };
}

/** Paired t: t = d̄/(s_d/√n), df = n−1; d_z = d̄/s_d. */
function tPaired(a, b) {
  const diffs = a.map((v, i) => v - b[i]);
  const n = diffs.length;
  const dm = mean(diffs), dsd = sd(diffs);
  const t = dm / (dsd / Math.sqrt(n));
  const df = n - 1;
  return { t, df, p: D.tP2(t, df), dz: dm / dsd, meanDiff: dm, sdDiff: dsd, n };
}

/** One-sample t. */
function tOne(xs, mu0) {
  const n = xs.length;
  const t = (mean(xs) - mu0) / (sd(xs) / Math.sqrt(n));
  return { t, df: n - 1, p: D.tP2(t, n - 1), d: (mean(xs) - mu0) / sd(xs) };
}

/** One-way ANOVA: F = MS_between/MS_within; η² = SS_between/SS_total. */
function anova1(groups) {
  const all = groups.flat();
  const N = all.length, k = groups.length;
  const gm = mean(all);
  let ssb = 0, ssw = 0;
  for (const g of groups) {
    const m = mean(g);
    ssb += g.length * (m - gm) ** 2;
    for (const x of g) ssw += (x - m) ** 2;
  }
  const dfb = k - 1, dfw = N - k;
  const msb = ssb / dfb, msw = ssw / dfw;
  const F = msb / msw;
  return { F, dfb, dfw, p: D.fP(F, dfb, dfw), ssb, ssw, sst: ssb + ssw, msb, msw, eta2: ssb / (ssb + ssw), means: groups.map(mean) };
}

/** χ² goodness of fit: Σ(O−E)²/E, df = k−1. `expected` defaults to equal. */
function chi2Gof(observed, expected) {
  const N = sum(observed);
  const E = expected || observed.map(() => N / observed.length);
  let chi2 = 0;
  for (let i = 0; i < observed.length; i++) chi2 += (observed[i] - E[i]) ** 2 / E[i];
  const df = observed.length - 1;
  return { chi2, df, p: D.chi2P(chi2, df), expected: E };
}

/** χ² independence: E = (row·col)/N, df = (r−1)(c−1); Cramér's V. */
function chi2Independence(table) {
  const r = table.length, c = table[0].length;
  const rows = table.map(sum);
  const cols = table[0].map((_, j) => sum(table.map((row) => row[j])));
  const N = sum(rows);
  let chi2 = 0;
  const E = table.map((row, i) => row.map((_, j) => rows[i] * cols[j] / N));
  for (let i = 0; i < r; i++) for (let j = 0; j < c; j++) chi2 += (table[i][j] - E[i][j]) ** 2 / E[i][j];
  const df = (r - 1) * (c - 1);
  return { chi2, df, p: D.chi2P(chi2, df), expected: E, cramersV: Math.sqrt(chi2 / (N * (Math.min(r, c) - 1))), N };
}

/** Cohen's d = (M₁−M₂)/s_pooled. */
function cohenD(a, b) { return tIndependent(a, b).d; }

/** Power, two-sample (normal approx.): Φ(d·√(n/2) − z₁₋α/₂). */
function powerTwoSample(d, nPerGroup, alpha = 0.05) {
  return D.normCdf(Math.abs(d) * Math.sqrt(nPerGroup / 2) - D.normInv(1 - alpha / 2));
}
/** Smallest n per group reaching target power (normal approx.). */
function nForPower(d, power = 0.8, alpha = 0.05) {
  for (let n = 2; n < 100000; n++) if (powerTwoSample(d, n, alpha) >= power) return n;
  return Infinity;
}

/** SEM (measurement) = SD·√(1−rₓₓ); CI = X ± z·SEM. */
function semMeasurement(sdv, rxx) { return sdv * Math.sqrt(1 - rxx); }
function ciScore(x, sdv, rxx, level = 0.95) {
  const s = semMeasurement(sdv, rxx);
  const zc = D.normInv(1 - (1 - level) / 2);
  return { lo: x - zc * s, hi: x + zc * s, sem: s };
}
/** CI for a mean using t. */
function ciMean(xs, level = 0.95) {
  const n = xs.length, m = mean(xs), se = sd(xs) / Math.sqrt(n);
  const tc = D.tInv(1 - (1 - level) / 2, n - 1);
  return { lo: m - tc * se, hi: m + tc * se, mean: m, se };
}

function histogram(xs, bins = 10, lo, hi) {
  const min = lo != null ? lo : Math.min(...xs);
  const max = hi != null ? hi : Math.max(...xs);
  const w = (max - min) / bins || 1;
  const counts = new Array(bins).fill(0);
  for (const x of xs) {
    let i = Math.floor((x - min) / w);
    if (i >= bins) i = bins - 1;
    if (i < 0) i = 0;
    counts[i]++;
  }
  return { counts, edges: counts.map((_, i) => min + i * w).concat([max]), width: w };
}

/** Tukey fences for outlier flagging (1.5·IQR). */
function outliers(xs) {
  const q1 = quantile(xs, 0.25), q3 = quantile(xs, 0.75), iqr = q3 - q1;
  return xs.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);
}

module.exports = {
  sum, mean, ss, variance, varianceP, sd, sdP, quantile, median, describe,
  z, tScore, iqScore, percentile, pearson, regression,
  tIndependent, tPaired, tOne, anova1, chi2Gof, chi2Independence,
  cohenD, powerTwoSample, nForPower, semMeasurement, ciScore, ciMean, histogram, outliers,
};
