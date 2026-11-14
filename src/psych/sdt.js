'use strict';
/**
 * Signal detection theory (Panel 11, paradigm sdt_yesno).
 *  d′ = z(H) − z(FA);  c = −½[z(H) + z(FA)];  β = exp(d′·c)
 *  Log-linear correction (Hautus 1995): H = (hits + 0.5)/(signal trials + 1),
 *  FA = (false alarms + 0.5)/(noise trials + 1) — applied to all cells when requested
 *  or automatically when any rate is 0 or 1.
 */
const { normInv, normCdf } = require('./dist.js');

function dprime(H, FA) { return normInv(H) - normInv(FA); }
function criterion(H, FA) { return -0.5 * (normInv(H) + normInv(FA)); }
function beta(H, FA) { return Math.exp(dprime(H, FA) * criterion(H, FA)); }

function fromCounts({ hits, misses, fas, crs }, { correction = 'auto' } = {}) {
  const nS = hits + misses, nN = fas + crs;
  let H = hits / nS, FA = fas / nN;
  const extreme = H === 0 || H === 1 || FA === 0 || FA === 1;
  let corrected = false;
  if (correction === 'loglinear' || (correction === 'auto' && extreme)) {
    H = (hits + 0.5) / (nS + 1);
    FA = (fas + 0.5) / (nN + 1);
    corrected = true;
  }
  return { H, FA, dprime: dprime(H, FA), c: criterion(H, FA), beta: beta(H, FA), corrected };
}

/** Theoretical ROC for equal-variance Gaussian model with sensitivity d′. */
function rocCurve(d, steps = 41) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const c = -4 + (8 * i) / (steps - 1);
    pts.push({ FA: 1 - normCdf(c), H: 1 - normCdf(c - d) });
  }
  return pts.sort((a, b) => a.FA - b.FA);
}
/** Area under the equal-variance ROC: AUC = Φ(d′/√2). */
function auc(d) { return normCdf(d / Math.SQRT2); }

/** Optimal β given priors and payoffs (Green & Swets): β* = [P(N)/P(S)]·[(V_CR + C_FA)/(V_H + C_M)]. */
function optimalBeta(pSignal, payoffs) {
  const { hit = 1, miss = 1, cr = 1, fa = 1 } = payoffs || {};
  return ((1 - pSignal) / pSignal) * ((cr + fa) / (hit + miss));
}

module.exports = { dprime, criterion, beta, fromCounts, rocCurve, auc, optimalBeta };
