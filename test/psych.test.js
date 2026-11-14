'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/psych/dist.js');
const S = require('../src/psych/stats.js');
const P = require('../src/psych/psychometrics.js');
const SDT = require('../src/psych/sdt.js');
const PP = require('../src/psych/psychophysics.js');
const L = require('../src/psych/learning.js');
const N = require('../src/psych/neuron.js');
const { Rng } = require('../src/core/rng.js');
const GD = require('./golden/dist.json');
const GS = require('./golden/stats.json');
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a} (tol ${tol})`);

// ---- distributions vs SciPy (G4: within 1e-4; we hold 1e-8)
test('t two-tailed p matches SciPy at 10 points', () => { for (const g of GD.tP2) close(D.tP2(g.t, g.df), g.p, 1e-8, `t=${g.t},df=${g.df}`); });
test('F upper p matches SciPy at 10 points', () => { for (const g of GD.fP) close(D.fP(g.F, g.d1, g.d2), g.p, 1e-8, `F=${g.F}`); });
test('chi2 upper p matches SciPy at 10 points', () => { for (const g of GD.chi2P) close(D.chi2P(g.x, g.k), g.p, 1e-8, `x=${g.x}`); });
test('normal CDF matches SciPy at 10 points', () => { for (const g of GD.normCdf) close(D.normCdf(g.z), g.p, 1e-10); });
test('inverse normal matches SciPy at 10 points', () => { for (const g of GD.normInv) close(D.normInv(g.p), g.z, 1e-8); });
test('textbook anchors: Φ(2)=.97725, Φ⁻¹(.975)=1.95996', () => { close(D.normCdf(2), 0.97725, 5e-6); close(D.normInv(0.975), 1.95996, 5e-6); });
test('critical values give p≈.050: t(10)=2.228, F(2,27)=3.354, χ²(1)=3.841', () => {
  close(D.tP2(2.228, 10), 0.05, 2e-4); close(D.fP(3.354, 2, 27), 0.05, 2e-4); close(D.chi2P(3.841, 1), 0.05, 2e-4);
});
test('tInv inverts tCdf', () => { close(D.tCdf(D.tInv(0.975, 12), 12), 0.975, 1e-9); });
test('lgamma(5)=ln 24 and erf(0)=0', () => { close(D.lgamma(5), Math.log(24), 1e-12); close(D.erf(0), 0, 1e-15); close(D.erf(1), 0.8427007929497149, 1e-12); });

// ---- descriptives
test('mean, sample and population SD on the same data', () => {
  const xs = [2, 4, 4, 4, 5, 5, 7, 9];
  assert.equal(S.mean(xs), 5); close(S.sdP(xs), 2, 1e-12); close(S.sd(xs), Math.sqrt(32 / 7), 1e-12);
});
test('describe() matches SciPy/NumPy', () => {
  const d = S.describe(GS.data.a), g = GS.describe_a;
  close(d.mean, g.mean, 1e-9); close(d.sd, g.sd, 1e-9); close(d.sdPop, g.sdPop, 1e-9); close(d.median, g.median, 1e-9); close(d.q1, g.q1, 1e-9); close(d.skew, g.skew, 1e-9);
});
test('z, T, IQ-style: x=130 μ=100 σ=15 → z=2, T=70, IQ=130', () => {
  const zv = S.z(130, 100, 15); assert.equal(zv, 2); assert.equal(S.tScore(zv), 70); assert.equal(S.iqScore(zv), 130); close(S.percentile(2), 97.725, 1e-3);
});
test('histogram counts all values', () => { const h = S.histogram([1, 2, 2, 3, 9], 4); assert.equal(h.counts.reduce((a, b) => a + b), 5); });

// ---- inferential vs SciPy
test('independent t (Student) matches SciPy', () => { const r = S.tIndependent(GS.data.a, GS.data.b); close(r.t, GS.t_ind.t, 1e-9); close(r.p, GS.t_ind.p, 1e-8); assert.equal(r.df, GS.t_ind.df); close(r.d, GS.t_ind.d, 1e-9); });
test('Welch t matches SciPy', () => { const r = S.tIndependent(GS.data.a, GS.data.b, { welch: true }); close(r.t, GS.t_welch.t, 1e-9); close(r.p, GS.t_welch.p, 1e-7); });
test('paired t and d_z match SciPy', () => { const r = S.tPaired(GS.data.pa, GS.data.pb); close(r.t, GS.t_paired.t, 1e-9); close(r.p, GS.t_paired.p, 1e-8); close(r.dz, GS.t_paired.dz, 1e-9); });
test('one-way ANOVA matches SciPy; η² in [0,1]', () => { const r = S.anova1([GS.data.g1, GS.data.g2, GS.data.g3]); close(r.F, GS.anova.F, 1e-9); close(r.p, GS.anova.p, 1e-8); assert.ok(r.eta2 > 0 && r.eta2 < 1); close(r.ssb + r.ssw, S.ss(GS.data.g1.concat(GS.data.g2, GS.data.g3)), 1e-6); });
test('Pearson r and p match SciPy; perfect line → 1', () => { const r = S.pearson(GS.data.x, GS.data.y); close(r.r, GS.pearson.r, 1e-12); close(r.p, GS.pearson.p, 1e-8); close(S.pearson([1, 2, 3, 4], [3, 5, 7, 9]).r, 1, 1e-12); });
test('regression matches SciPy linregress', () => { const r = S.regression(GS.data.x, GS.data.y); close(r.b, GS.regression.b, 1e-9); close(r.a, GS.regression.a, 1e-9); close(r.r2, GS.regression.r2, 1e-12); close(r.seB, GS.regression.seB, 1e-9); });
test('χ² independence and GOF match SciPy', () => {
  const r = S.chi2Independence(GS.data.tab); close(r.chi2, GS.chi2_ind.chi2, 1e-9); close(r.p, GS.chi2_ind.p, 1e-9); assert.equal(r.df, 1);
  const g = S.chi2Gof(GS.data.obs); close(g.chi2, GS.chi2_gof.chi2, 1e-9); close(g.p, GS.chi2_gof.p, 1e-9);
});
test('power: d=0.5, n=64/group → ≈.80; nForPower(0.5)=63', () => { close(S.powerTwoSample(0.5, 64), GS.power_d05_n64, 1e-12); close(S.powerTwoSample(0.5, 64), 0.80, 0.01); assert.equal(S.nForPower(0.5, 0.8), 63); });
test('CI for mean contains mean; ciScore symmetric', () => { const c = S.ciMean([1, 2, 3, 4, 5]); assert.ok(c.lo < 3 && c.hi > 3); const s = S.ciScore(100, 15, 0.91); close(s.hi - 100, 100 - s.lo, 1e-9); });

// ---- psychometrics
test('SEM: SD=15, r=.91 → 4.5', () => close(S.semMeasurement(15, 0.91), 4.5, 1e-12));
test('Spearman–Brown: r=.60, k=2 → .75; inverse', () => { close(P.spearmanBrown(0.6, 2), 0.75, 1e-12); close(P.spearmanBrownK(0.6, 0.75), 2, 1e-12); close(P.spearmanBrown(0.5, 1), 0.5, 1e-12); });
test('Cronbach α matches NumPy formula (= R psych::alpha raw_alpha)', () => close(P.cronbachAlpha(GS.data.items), GS.alpha, 1e-12));
test('α of identical items is 1; item analysis returns k rows', () => { close(P.cronbachAlpha([[1, 1, 1], [2, 2, 2], [4, 4, 4]]), 1, 1e-12); assert.equal(P.itemAnalysis(GS.data.items).length, 6); });
test("Cohen's κ: po=.80, pe=.50 → .60; from table", () => { close(P.cohenKappa(0.8, 0.5), 0.6, 1e-12); const k = P.kappaFromTable([[20, 5], [10, 15]]); close(k.po, 0.7, 1e-12); close(k.pe, 0.5, 1e-12); close(k.kappa, 0.4, 1e-12); });
test('split-half applies Spearman–Brown', () => { const r = P.splitHalf(GS.data.items); close(r.rSB, P.spearmanBrown(r.rHalf, 2), 1e-12); });
test('IPIP scoring reverses minus-keyed items', () => { const s = P.scoreIPIP([{ scale: 'E', keyed: '+' }, { scale: 'E', keyed: '-' }], [5, 1]); assert.equal(s.E.sum, 10); });

// ---- SDT
test('SDT: H=.84, FA=.16 → d′≈1.99, c≈0', () => { close(SDT.dprime(0.84, 0.16), 1.9889, 1e-3); close(SDT.dprime(0.84, 0.16), GS.sdt.d, 1e-9); close(SDT.criterion(0.84, 0.16), 0, 1e-12); });
test('SDT log-linear (Hautus 1995) handles rates of 0 and 1', () => { const r = SDT.fromCounts({ hits: 20, misses: 0, fas: 0, crs: 20 }); assert.ok(r.corrected); close(r.H, 20.5 / 21, 1e-12); close(r.FA, 0.5 / 21, 1e-12); assert.ok(Number.isFinite(r.dprime)); });
test('SDT liberal criterion is negative; ROC is monotone; AUC(0)=.5', () => {
  assert.ok(SDT.criterion(0.95, 0.4) < 0);
  const roc = SDT.rocCurve(1.5); for (let i = 1; i < roc.length; i++) assert.ok(roc[i].H >= roc[i - 1].H - 1e-12);
  close(SDT.auc(0), 0.5, 1e-12);
});

// ---- psychophysics & laws
test('Weber: constant ΔI/I recovered', () => { const f = PP.fitWeber([{ I: 10, jnd: 1 }, { I: 20, jnd: 2 }, { I: 40, jnd: 4 }]); close(f.k, 0.1, 1e-12); close(f.kSlope, 0.1, 1e-12); });
test('Fechner is monotonic increasing and 0 at I₀', () => { assert.equal(PP.fechner(5, 5), 0); assert.ok(PP.fechner(10, 1) > PP.fechner(5, 1)); assert.ok(PP.fechner(100, 1) > PP.fechner(10, 1)); });
test('Stevens: log–log slope = exponent', () => { const phis = [1, 2, 4, 8, 16]; const f = PP.fitStevens(phis, phis.map((p) => PP.stevens(p, 2, 0.33))); close(f.a, 0.33, 1e-9); close(f.k, 2, 1e-9); });
test('Hick–Hyman: linear in log₂(n+1)', () => { const ns = [1, 3, 7]; const f = PP.fitHick(ns, ns.map((n) => 200 + 150 * Math.log2(n + 1))); close(f.a, 200, 1e-9); close(f.b, 150, 1e-9); close(PP.hickBits(7), 3, 1e-12); });
test('Fitts ID: log₂(2D/W) and Shannon form', () => { close(PP.fittsID(256, 32), 4, 1e-12); close(PP.fittsIDShannon(256, 32), Math.log2(9), 1e-12); const f = PP.fitFitts([64, 128, 256], [32, 32, 32], [300, 400, 500]); close(f.b, 100, 1e-9); });
test('Ebbinghaus savings: OL=20, RL=8 → 60%; retention model decays', () => { assert.equal(PP.savings(20, 8), 60); close(PP.retentionModel(0, 5), 1, 1e-12); assert.ok(PP.retentionModel(5, 5) < 0.4); });
test('Serial position: synthetic U-curve gives primacy & recency > middle', () => {
  const lists = []; const p = [0.9, 0.8, 0.7, 0.4, 0.35, 0.3, 0.35, 0.4, 0.6, 0.8, 0.9, 0.95]; const rng = new Rng(3);
  for (let l = 0; l < 400; l++) lists.push(p.map((v) => rng.random() < v));
  const s = PP.serialPosition(lists); assert.ok(s.primacy > s.middle + 20); assert.ok(s.recency > s.middle + 20);
});
test('Mental rotation: linear slope recovered', () => { const a = [0, 45, 90, 135, 180]; const f = PP.fitRotation(a, a.map((x) => 1000 + 17 * x)); close(f.slope, 17, 1e-9); close(f.intercept, 1000, 1e-9); });
test('Staircase converges and reports threshold', () => { const s = new PP.Staircase({ start: 20, step: 4, nDown: 2, maxReversals: 8 }); const rng = new Rng(9); let g = 0; while (!s.done && g++ < 500) s.update(rng.random() < (s.level > 8 ? 0.95 : 0.3)); assert.ok(s.done); assert.ok(s.threshold() > 3 && s.threshold() < 14); });

// ---- learning
test('Rescorla–Wagner: acquisition asymptotes at λ', () => { const t = Array.from({ length: 200 }, () => ({ cues: ['CS'], us: true })); close(L.rescorlaWagner(t, { beta: 0.3, defaultAlpha: 0.3 }).V.CS, 1, 1e-4); });
test('Rescorla–Wagner: single-step ΔV = αβ(λ−ΣV)', () => { const r = L.rescorlaWagner([{ cues: ['A'], us: true }], { alpha: { A: 0.5 }, beta: 0.4 }); close(r.V.A, 0.2, 1e-12); });
test('Rescorla–Wagner: blocking emerges', () => { const b = L.blockingDemo(); assert.ok(b.blockedX < 0.2 * b.controlX, JSON.stringify(b)); });
test('extinction lowers V; recovery illustrative point flagged', () => { const c = L.conditioningCurve(); const acqEnd = c[19].V, extEnd = c[39].V; assert.ok(extEnd < acqEnd * 0.3); assert.match(c[c.length - 1].phase, /illustrative/); });
test('Operant schedules: ratio schedules out-respond interval schedules', () => {
  const vr = L.simulateSchedule('VR', 10, new Rng(1)); const vi = L.simulateSchedule('VI', 30, new Rng(1));
  assert.ok(vr.totalResponses > vi.totalResponses); assert.ok(vr.reinforcers.length > 0);
  for (let i = 1; i < vr.record.length; i++) assert.ok(vr.record[i].count >= vr.record[i - 1].count);
});

// ---- neuron
test('LIF: f–I curve monotonic; no spikes below threshold current', () => {
  const f = N.fiCurve('lif', [1, 1.6, 2, 3, 4, 6]); assert.equal(f[0].rate, 0);
  for (let i = 1; i < f.length; i++) assert.ok(f[i].rate >= f[i - 1].rate);
});
test('Hodgkin–Huxley: rest ≈ −65 mV with I=0; spikes peak > +30 mV', () => {
  const r0 = N.hh({ I: 0, ms: 50 }); close(r0.trace[r0.trace.length - 1].V, -65, 1.0); assert.equal(r0.spikes.length, 0);
  const r = N.hh({ I: 10, ms: 100 }); assert.ok(r.spikes.length >= 4); assert.ok(Math.max(...r.trace.map((p) => p.V)) > 30);
});
test('Hodgkin–Huxley: repetitive-firing threshold ≈ 6–7 µA/cm² DC', () => { const rb = N.hhRheobase(); assert.ok(rb > 5.5 && rb < 7.5, `rheobase ${rb}`); });

// ---- rng
test('mulberry32 is deterministic per seed; ex-Gaussian mean ≈ μ+τ', () => {
  const a = new Rng('iibs'), b = new Rng('iibs'); for (let i = 0; i < 5; i++) assert.equal(a.random(), b.random());
  const r = new Rng(42); const xs = Array.from({ length: 20000 }, () => r.exGaussian(400, 40, 100)); close(S.mean(xs), 500, 4);
});
