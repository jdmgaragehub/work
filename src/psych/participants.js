'use strict';
/**
 * Simulated participants (§5.3). Pure.
 * Each agent: latent traits drawn from seeded distributions —
 *   ability (z), speed (ms offset), noise σ, lapse rate, Big Five vector.
 * RT = ex-Gaussian(μ, σ, τ) + condition effect. Condition effects are passed in by
 * paradigms; unless a fact in facts.json is verified, the UI labels them "Simulated effect size".
 */

function makeParticipant(rng, i) {
  const big5 = ['E', 'A', 'C', 'N', 'O'].reduce((o, k) => { o[k] = Math.max(1, Math.min(5, rng.normal(3.2, 0.7))); return o; }, {});
  return {
    pid: 'S' + String(i + 1).padStart(3, '0'),
    ability: rng.normal(0, 1),
    speed: rng.normal(0, 60),
    sigma: Math.max(20, rng.normal(45, 10)),
    tau: Math.max(30, rng.normal(110, 30)),
    lapse: Math.min(0.08, Math.max(0, rng.normal(0.02, 0.015))),
    conformity: Math.min(0.95, Math.max(0.02, rng.normal(0.3, 0.2))),
    cooperativeness: Math.min(0.95, Math.max(0.05, rng.normal(0.5, 0.2))),
    big5,
  };
}

function cohort(rng, n) { return Array.from({ length: n }, (_, i) => makeParticipant(rng, i)); }

/** RT draw: base μ + participant speed + condition effect, plus ex-Gaussian noise; lapses are slow guesses. */
function drawRT(p, rng, { mu = 520, effect = 0, minRT = 150 } = {}) {
  if (rng.random() < p.lapse) return { rt: Math.max(minRT, rng.uniform(900, 1800)), lapse: true };
  return { rt: Math.max(minRT, rng.exGaussian(mu + p.speed + effect, p.sigma, p.tau)), lapse: false };
}

/** Accuracy draw from a logistic of ability minus difficulty. */
function drawCorrect(p, rng, difficulty = 0, base = 2.5) {
  const pr = 1 / (1 + Math.exp(-(base + p.ability * 0.8 - difficulty)));
  return rng.random() < pr;
}

/** Bot participant used by e2e: deterministic seeded ex-Gaussian RTs. */
function bot(rng) { return Object.assign(makeParticipant(rng, 0), { pid: 'BOT001', lapse: 0 }); }

module.exports = { makeParticipant, cohort, drawRT, drawCorrect, bot };
