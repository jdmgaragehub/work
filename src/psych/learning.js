'use strict';
/**
 * Learning models (Panel 14; paradigms classical_cond, operant_schedules, shaping). Pure.
 *  Rescorla–Wagner (1972): ΔV_X = α_X·β·(λ − ΣV);  V ← V + ΔV
 */

/**
 * Run R–W over a list of trials. Each trial: { cues: ['A','X'], us: true|false }.
 * alpha: per-cue salience map; beta: US learning rate; lambda: asymptote when US present.
 */
function rescorlaWagner(trials, { alpha = {}, beta = 0.3, lambda = 1, defaultAlpha = 0.3, V0 = {} } = {}) {
  const V = Object.assign({}, V0);
  const history = [];
  for (const tr of trials) {
    const sumV = tr.cues.reduce((s, c) => s + (V[c] || 0), 0);
    const target = tr.us ? lambda : 0;
    const err = target - sumV;
    for (const c of tr.cues) {
      const a = alpha[c] != null ? alpha[c] : defaultAlpha;
      V[c] = (V[c] || 0) + a * beta * err;
    }
    history.push(Object.assign({ predictionError: err }, V));
  }
  return { V, history };
}

/** Classical conditioning phases: acquisition → extinction → rest → test (spontaneous recovery, illustrative model). */
function conditioningCurve({ acq = 20, ext = 20, recoveryFraction = 0.35, alpha = 0.4, beta = 0.5 } = {}) {
  const trials = [];
  for (let i = 0; i < acq; i++) trials.push({ cues: ['CS'], us: true, phase: 'acquisition' });
  for (let i = 0; i < ext; i++) trials.push({ cues: ['CS'], us: false, phase: 'extinction' });
  const run = rescorlaWagner(trials, { alpha: { CS: alpha }, beta });
  const curve = run.history.map((h, i) => ({ trial: i + 1, V: h.CS, phase: trials[i].phase }));
  // Spontaneous recovery is NOT predicted by basic R–W; shown as an illustrative partial rebound (labelled "model").
  const peak = Math.max(...curve.filter((c) => c.phase === 'acquisition').map((c) => c.V));
  const last = curve[curve.length - 1].V;
  curve.push({ trial: curve.length + 1, V: last + recoveryFraction * (peak - last), phase: 'recovery (illustrative)' });
  return curve;
}

/** Blocking (Kamin): A+ pre-training, then AX+; X ends with little strength. */
function blockingDemo({ pre = 20, compound = 20, beta = 0.4, alpha = 0.3 } = {}) {
  const t = [];
  for (let i = 0; i < pre; i++) t.push({ cues: ['A'], us: true });
  for (let i = 0; i < compound; i++) t.push({ cues: ['A', 'X'], us: true });
  const blocked = rescorlaWagner(t, { beta, defaultAlpha: alpha }).V;
  const ctrl = [];
  for (let i = 0; i < compound; i++) ctrl.push({ cues: ['B', 'X'], us: true });
  const control = rescorlaWagner(ctrl, { beta, defaultAlpha: alpha }).V;
  return { blockedX: blocked.X, controlX: control.X };
}

/**
 * Operant schedule simulator with a simple matching-style agent.
 * Returns a cumulative record (responses over time) and reinforcer times.
 * Agent response rate adapts to reinforcement density; FI produces a scallop via
 * time-since-reinforcement modulation; FR produces post-reinforcement pauses.
 * Behaviour patterns are a qualitative teaching model (labelled "Simulated").
 */
function simulateSchedule(type, param, rng, { seconds = 600, dt = 0.25, baseRate = 1.2 } = {}) {
  let count = 0, sinceRf = 0, respSinceRf = 0, nextVR = Math.max(1, Math.round(param * (0.5 + rng.random()))), nextVI = param * (0.5 + rng.random());
  let pause = 0;
  const record = [], reinforcers = [];
  for (let t = 0; t <= seconds; t += dt) {
    sinceRf += dt;
    let rate = baseRate;
    if (type === 'FI') rate = baseRate * Math.min(2.2, Math.pow(sinceRf / param, 2) * 1.6 + 0.05);
    if (type === 'FR') rate = baseRate * 2.0;
    if (type === 'VR') rate = baseRate * 2.4;
    if (type === 'VI') rate = baseRate * 1.1;
    if (pause > 0) { pause -= dt; rate = 0; }
    if (rng.random() < rate * dt) {
      count++; respSinceRf++;
      let rf = false;
      if (type === 'FR' && respSinceRf >= param) rf = true;
      if (type === 'VR' && respSinceRf >= nextVR) { rf = true; nextVR = Math.max(1, Math.round(param * (0.5 + rng.random()))); }
      if (type === 'FI' && sinceRf >= param) rf = true;
      if (type === 'VI' && sinceRf >= nextVI) { rf = true; nextVI = param * (0.5 + rng.random()); }
      if (type === 'CRF') rf = true;
      if (rf) {
        reinforcers.push({ t, count });
        if (type === 'FR') pause = Math.min(param * 0.12, 8) * (0.6 + 0.8 * rng.random());
        sinceRf = 0; respSinceRf = 0;
      }
    }
    if (Math.abs(t - Math.round(t)) < dt / 2) record.push({ t: Math.round(t), count });
  }
  return { record, reinforcers, totalResponses: count, rate: count / seconds };
}

/** Shaping by successive approximation: agent position drifts toward criterion; reinforce if within window. */
function shapingStep(state, criterion, rng) {
  const behaviour = state.mean + rng.normal(0, state.spread);
  const reinforced = behaviour >= criterion;
  if (reinforced) state.mean += 0.35 * (behaviour - state.mean) + 0.05;
  else state.mean -= 0.02;
  state.spread = Math.max(0.05, state.spread * (reinforced ? 0.99 : 1.0));
  return { behaviour, reinforced };
}

module.exports = { rescorlaWagner, conditioningCurve, blockingDemo, simulateSchedule, shapingStep };
