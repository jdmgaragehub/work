'use strict';
/**
 * Social-psychology teaching models for Mode 5 (Social Sim / "Mohalla"). Pure logic: no THREE, no DOM.
 * Every result carries `label: 'Simulated'` — these are agent-based teaching models with exposed, adjustable
 * parameters, not reproductions of any original dataset.
 *
 *  conformity(params)  — Asch-style line judgement: naive agents face a unanimous (or broken) wrong majority.
 *                        Pressure saturates with majority size (Asch 1955 reported little gain beyond ~3–4).
 *  bystander(params)   — diffusion of responsibility (Darley & Latané 1968): each onlooker's hazard of helping
 *                        falls with the number of others present, steeply enough that the *group* helps less.
 *  cooperation(params) — iterated prisoner's dilemma round-robin (Axelrod 1984) with TFT/AllD/AllC/Random/Grudger.
 * Tested in test/socialmodels.test.js.
 */

function makeRng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed == null ? 'mohalla' : seed));
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
function gauss(rng) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

/* ------------------------------------------------------------------ conformity */

const CONFORMITY_DEFAULTS = {
  n: 50,               // naive participants
  majority: 7,         // confederates giving the wrong answer
  trials: 12,          // critical trials per participant
  traitMean: 0.42,     // mean individual conformity trait (0..1)
  traitSD: 0.25,
  midpoint: 2,         // majority size at half pressure: pressure = 1 / (1 + exp(-slope * (k - midpoint)))
  slope: 2.2,          // steepness: with these defaults pressure is ~0.1 / 0.5 / 0.9 / 0.99 for k = 1 / 2 / 3 / 4
  gain: 0.8,           // P(conform on a trial) = trait * pressure * gain
  dissenter: false,    // one ally breaks unanimity
  dissenterFactor: 0.25,
  baseError: 0.01,     // errors when alone (control condition)
  seed: 'asch',
};

/** Social pressure exerted by a majority of size k (0..1). Saturates ("plateau") after ~3–4 people. */
function pressure(k, p = {}) {
  if (k <= 0) return 0;
  const mid = p.midpoint != null ? p.midpoint : CONFORMITY_DEFAULTS.midpoint;
  const slope = p.slope != null ? p.slope : CONFORMITY_DEFAULTS.slope;
  return 1 / (1 + Math.exp(-slope * (k - mid)));
}

/**
 * Asch-style conformity. Returns { label, params, conformityRate, everConformed, neverConformed,
 * perAgent: [{trait, conformed}], choices: [0|1 per agent on last trial] }.
 */
function conformity(params = {}) {
  const p = Object.assign({}, CONFORMITY_DEFAULTS, params);
  const rng = makeRng(p.seed);
  const press = pressure(p.majority, p) * (p.dissenter ? p.dissenterFactor : 1);
  const perAgent = [];
  let conformTotal = 0;
  const choices = [];
  for (let i = 0; i < p.n; i++) {
    const trait = clamp01(p.traitMean + p.traitSD * gauss(rng));
    let c = 0, last = 0;
    for (let t = 0; t < p.trials; t++) {
      const pc = clamp01(trait * press * p.gain);
      const conformed = rng() < pc || rng() < p.baseError;
      if (conformed) c++;
      last = conformed ? 1 : 0;
    }
    perAgent.push({ trait, conformed: c });
    choices.push(last);
    conformTotal += c;
  }
  const rate = p.n && p.trials ? conformTotal / (p.n * p.trials) : 0;
  return {
    label: 'Simulated', model: 'conformity', params: p,
    conformityRate: rate,
    everConformed: perAgent.filter((a) => a.conformed > 0).length / Math.max(1, p.n),
    neverConformed: perAgent.filter((a) => a.conformed === 0).length / Math.max(1, p.n),
    perAgent, choices,
  };
}

/** Conformity rate as a function of majority size 1..maxK (same seed per point). */
function conformityCurve(params = {}, maxK = 15) {
  const out = [];
  for (let k = 0; k <= maxK; k++) out.push({ majority: k, rate: conformity(Object.assign({}, params, { majority: k })).conformityRate });
  return out;
}

/**
 * One step of a continuous majority pull for live crowds: each agent's choice (0/1) flips toward the
 * local majority with probability trait * pressure(majority size). Returns the new choices array.
 */
function majorityStep(choices, traits, rng, params = {}) {
  const ones = choices.reduce((s, c) => s + c, 0);
  const out = choices.slice();
  for (let i = 0; i < choices.length; i++) {
    const others1 = ones - choices[i], others0 = choices.length - 1 - others1;
    const maj = others1 > others0 ? 1 : 0, k = Math.abs(others1 - others0);
    if (choices[i] !== maj && rng() < (traits[i] || 0) * pressure(k, params) * (params.rate || 0.3)) out[i] = maj;
  }
  return out;
}

/* ------------------------------------------------------------------ bystander */

const BYSTANDER_DEFAULTS = {
  n: 1,                // onlookers present (including the focal agent)
  trials: 400,
  window: 240,         // seconds before the event resolves without help (Darley & Latané used ~4 min)
  baseHazard: 0.008,   // per-second hazard of helping for a lone bystander (~85% help within 4 min)
  diffusion: 2,        // exponent: individual hazard = base * trait / n^diffusion (>1 ⇒ groups help less;
                       // 2 gives roughly 85% / 62% / 31% for 1 / 2 / 5 present, the 1968 pattern)
  traitSD: 0.3,
  seed: 'bystander',
};

/** Probability that ONE onlooker helps within the window, for a group of size n (expected trait 1). */
function individualHelpProb(n, params = {}) {
  const p = Object.assign({}, BYSTANDER_DEFAULTS, params);
  const h = p.baseHazard / Math.pow(Math.max(1, n), p.diffusion);
  return 1 - Math.exp(-h * p.window);
}

/**
 * Bystander intervention. Returns { label, params, helpedPct (0..1), meanTimeToHelp (s, helped trials),
 * medianTimeToHelp, individualHelpProb, times: [s|null per trial] }.
 */
function bystander(params = {}) {
  const p = Object.assign({}, BYSTANDER_DEFAULTS, params);
  const n = Math.max(1, Math.round(p.n));
  const rng = makeRng(typeof p.seed === 'string' ? p.seed + ':' + n : p.seed + n);
  const times = [];
  for (let t = 0; t < p.trials; t++) {
    let first = Infinity;
    for (let i = 0; i < n; i++) {
      const trait = Math.max(0.05, 1 + p.traitSD * gauss(rng));
      const h = (p.baseHazard * trait) / Math.pow(n, p.diffusion);
      const u = rng() || 1e-12;
      const tt = -Math.log(u) / h;
      if (tt < first) first = tt;
    }
    times.push(first <= p.window ? first : null);
  }
  const helped = times.filter((x) => x != null).sort((a, b) => a - b);
  return {
    label: 'Simulated', model: 'bystander', params: Object.assign({}, p, { n }),
    helpedPct: helped.length / Math.max(1, p.trials),
    meanTimeToHelp: helped.length ? mean(helped) : null,
    medianTimeToHelp: helped.length ? helped[Math.floor(helped.length / 2)] : null,
    individualHelpProb: individualHelpProb(n, p),
    times,
  };
}

/** helped% and time-to-help across group sizes. */
function bystanderCurve(params = {}, sizes = [1, 2, 3, 5, 8, 12]) {
  return sizes.map((n) => { const r = bystander(Object.assign({}, params, { n })); return { n, helpedPct: r.helpedPct, meanTimeToHelp: r.meanTimeToHelp }; });
}

/* ------------------------------------------------------------------ cooperation (IPD) */

const C = 1, D = 0;
const STRATEGIES = {
  TFT: { name: 'Tit-for-Tat', move: (my, their) => (their.length ? their[their.length - 1] : C) },
  AllD: { name: 'Always Defect', move: () => D },
  AllC: { name: 'Always Cooperate', move: () => C },
  Random: { name: 'Random', move: (my, their, rng) => (rng() < 0.5 ? C : D) },
  Grudger: { name: 'Grudger (Grim trigger)', move: (my, their) => (their.includes(D) ? D : C) },
};

const COOPERATION_DEFAULTS = {
  population: { TFT: 4, AllD: 4, AllC: 4, Random: 4, Grudger: 4 },
  rounds: 100,
  payoff: { T: 5, R: 3, P: 1, S: 0 }, // temptation, reward, punishment, sucker (T > R > P > S, 2R > T + S)
  noise: 0,                            // probability a move is flipped by mistake
  selfPlay: false,
  seed: 'axelrod',
};

function playMatch(sa, sb, p, rng) {
  const ha = [], hb = [];
  let A = 0, B = 0, coop = 0;
  const pay = p.payoff;
  for (let r = 0; r < p.rounds; r++) {
    let a = STRATEGIES[sa].move(ha, hb, rng), b = STRATEGIES[sb].move(hb, ha, rng);
    if (p.noise && rng() < p.noise) a = 1 - a;
    if (p.noise && rng() < p.noise) b = 1 - b;
    if (a === C && b === C) { A += pay.R; B += pay.R; } else if (a === C && b === D) { A += pay.S; B += pay.T; } else if (a === D && b === C) { A += pay.T; B += pay.S; } else { A += pay.P; B += pay.P; }
    coop += a + b;
    ha.push(a); hb.push(b);
  }
  return { A, B, coop: coop / (2 * p.rounds) };
}

/**
 * Round-robin iterated prisoner's dilemma. Returns { label, params, agents:[{id, strategy, score}],
 * scores: {strategy: mean score per match}, ranking: [strategy...], cooperationRate, matches }.
 */
function cooperation(params = {}) {
  const p = Object.assign({}, COOPERATION_DEFAULTS, params);
  p.payoff = Object.assign({}, COOPERATION_DEFAULTS.payoff, params.payoff || {});
  const rng = makeRng(p.seed);
  const agents = [];
  for (const s of Object.keys(p.population)) {
    if (!STRATEGIES[s]) throw new Error('Unknown strategy ' + s);
    for (let i = 0; i < p.population[s]; i++) agents.push({ id: agents.length, strategy: s, score: 0, games: 0 });
  }
  let coopSum = 0, matches = 0;
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const m = playMatch(agents[i].strategy, agents[j].strategy, p, rng);
      agents[i].score += m.A; agents[j].score += m.B; agents[i].games++; agents[j].games++;
      coopSum += m.coop; matches++;
    }
  }
  const scores = {};
  for (const s of Object.keys(p.population)) {
    const g = agents.filter((a) => a.strategy === s);
    if (g.length) scores[s] = mean(g.map((a) => a.score / Math.max(1, a.games)));
  }
  const ranking = Object.keys(scores).sort((a, b) => scores[b] - scores[a]);
  return { label: 'Simulated', model: 'cooperation', params: p, agents, scores, ranking, cooperationRate: matches ? coopSum / matches : 0, matches };
}

module.exports = {
  makeRng, pressure, conformity, conformityCurve, majorityStep, CONFORMITY_DEFAULTS,
  bystander, bystanderCurve, individualHelpProb, BYSTANDER_DEFAULTS,
  cooperation, playMatch, STRATEGIES, COOPERATION_DEFAULTS,
};
