'use strict';
/**
 * Learning paradigms (A8, Panel 14 Learning Lab): classical_cond, operant_schedules, shaping.
 * Contract: docs/EXPERIMENT_API.md. Pure apart from drawing on a passed 2D context.
 * Model curves come from src/psych/learning.js; any agent/bot behaviour is labelled "Simulated".
 */
const S = require('../../psych/stats.js');
const L = require('../../psych/learning.js');
const { drawRT, drawCorrect } = require('../../psych/participants.js');

const TAGS = { week: 8, panel: 'learning', zone: 'learning', apa: '1.1', domain: 'Bio/Cog', hec: 'S2 Experimental Psychology' };
const text = (ctx, s, x, y, size = 20, color = '#111', weight = 600, align = 'center') => { ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(0) + '%' : '—');
const meanOr = (xs, d = NaN) => (xs.length ? S.mean(xs) : d);

/** Small seeded generator (mulberry32) for model simulations inside analyse (no Rng import needed). */
function mkRng(seed) {
  let a = seed >>> 0;
  const random = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { random, normal(mu = 0, s = 1) { let u, v, q; do { u = random() * 2 - 1; v = random() * 2 - 1; q = u * u + v * v; } while (q >= 1 || q === 0); return mu + s * u * Math.sqrt(-2 * Math.log(q) / q); } };
}

// ---------------------------------------------------------------- classical conditioning
const CS_AT = 0, US_AT = 1500, TRIAL_DUR = 2500;
const RW = { alpha: 0.4, beta: 0.5 };

const classicalCond = Object.assign({
  id: 'classical_cond', title: 'Classical conditioning (Rescorla–Wagner)',
  purpose: 'To experience how a neutral light (CS) that predicts a soft puff (US) comes to trigger an anticipatory response, how that response extinguishes, and how it can partly return after a rest.',
  instructions: '<p>An amber <b>light</b> will come on. Sometimes a soft blue <b>"puff"</b> ripple follows it. Press <kbd>Space</kbd> as soon as you <b>expect</b> the puff — before it arrives. Presses made before the puff time count as anticipatory (conditioned) responses.</p><p>No flashing: the light is steady and the ripple is a gentle, low-contrast wave. Just respond naturally; there are no right or wrong answers.</p>',
  estimateMin: 3, practice: 0, fix: 500, iti: 1000, timeout: null, background: '#1f2937', animated: true,
  response: { type: 'count', keys: ['space'], labels: { space: 'expect puff' } },
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 14 : 30);
    const test = Math.max(2, Math.round(n * 0.12));
    const acq = Math.ceil((n - test) / 2), ext = Math.max(1, n - test - acq);
    const out = [];
    const add = (phase, us, k, extra) => out.push(Object.assign({ block: phase, condition: phase, us, dur: TRIAL_DUR, usAt: US_AT, iti: 700 + rng.int(0, 900), stimulus: `${phase}:${us ? 'CS+US' : 'CS alone'}:${k + 1}`, audio: true, caption: us ? 'tone … soft puff' : 'tone' }, extra || {}));
    for (let i = 0; i < acq; i++) add('acquisition', true, i);
    for (let i = 0; i < ext; i++) add('extinction', false, i);
    for (let i = 0; i < test; i++) add('test', false, i, i === 0 ? { fix: 4000, restBefore: true } : null);
    return out;
  },
  init() { return { simV: 0, simPeak: 0, simInTest: false }; },
  draw(ctx, t, W, H, elapsed) {
    const cx = W / 2, cy = H / 2 - 20;
    // lamp housing
    ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.arc(cx, cy, 78, 0, Math.PI * 2); ctx.fill();
    const csOn = elapsed >= CS_AT && elapsed < TRIAL_DUR - 200;
    ctx.fillStyle = csOn ? '#E69F00' : '#4b5563';
    ctx.beginPath(); ctx.arc(cx, cy, 60, 0, Math.PI * 2); ctx.fill();
    if (csOn) { ctx.fillStyle = 'rgba(230,159,0,0.18)'; ctx.beginPath(); ctx.arc(cx, cy, 92, 0, Math.PI * 2); ctx.fill(); }
    // US: soft low-contrast ripple (no flash)
    const ue = elapsed - (t.usAt || US_AT);
    if (t.us && ue >= 0 && ue < 800) {
      for (let k = 0; k < 3; k++) {
        const r = 70 + (ue / 800) * 140 + k * 22, a = 0.35 * (1 - ue / 800);
        ctx.strokeStyle = `rgba(86,180,233,${a.toFixed(3)})`; ctx.lineWidth = 6 - k * 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      }
      text(ctx, 'puff', cx, cy + 150, 20, '#93c5fd', 600);
    }
    text(ctx, 'Press Space when you expect the puff', cx, H - 60, 18, '#e5e7eb', 500);
  },
  audio(t, audio) {
    audio.tone({ freq: 520, dur: 0.4, gain: 0.15, type: 'sine' });
    if (t.us) audio.noise({ dur: 0.25, gain: 0.08, when: (t.usAt || US_AT) / 1000 });
  },
  onKey(t, k, state, elapsed) { if (elapsed >= (t.usAt || US_AT)) state.count = Math.max(0, state.count - 1); },
  score() { return null; },
  simulate(p, t, rng, state) {
    // Simulated learner: R–W associative strength plus an illustrative spontaneous-recovery rebound (not an R–W prediction).
    if (t.condition === 'test' && !state.simInTest) { state.simInTest = true; state.simV += 0.35 * (state.simPeak - state.simV); }
    const pr = clamp(0.04 + 0.9 * state.simV + 0.05 * p.ability, 0.01, 0.97);
    const cr = rng.random() < pr;
    state.simV += RW.alpha * RW.beta * ((t.us ? 1 : 0) - state.simV);
    state.simPeak = Math.max(state.simPeak, state.simV);
    return { response: cr ? 1 + (rng.random() < 0.3 ? 1 : 0) : 0 };
  },
  analyse(rows) {
    const tr = rows.map((r) => ({ phase: r.condition, cr: +r.response > 0 ? 1 : 0 }));
    const rate = (ph, part) => { let v = tr.filter((x) => x.phase === ph); if (part === 'first') v = v.slice(0, Math.ceil(v.length / 2)); if (part === 'last') v = v.slice(Math.floor(v.length / 2)); return meanOr(v.map((x) => x.cr)); };
    const model = L.rescorlaWagner(tr.map((x) => ({ cues: ['CS'], us: x.phase === 'acquisition' })), { alpha: { CS: RW.alpha }, beta: RW.beta }).history.map((h) => h.CS);
    const ma = tr.map((x, i) => { const w = tr.slice(Math.max(0, i - 1), i + 2).filter((y) => y.phase === x.phase); return S.mean(w.map((y) => y.cr)); });
    const lastExt = meanOr(tr.filter((x) => x.phase === 'extinction').slice(-3).map((x) => x.cr));
    const testR = rate('test');
    const lines = [
      `Anticipatory responses (CRs) — acquisition: first half ${pct(rate('acquisition', 'first'))}, second half ${pct(rate('acquisition', 'last'))}`,
      `Extinction (light alone): first half ${pct(rate('extinction', 'first'))}, second half ${pct(rate('extinction', 'last'))}`,
      `Test after rest: ${pct(testR)} vs last 3 extinction trials ${pct(lastExt)}${Number.isFinite(testR) && Number.isFinite(lastExt) && testR > lastExt ? ' — a rebound consistent with spontaneous recovery' : ''}`,
      `Rescorla–Wagner model (α = ${RW.alpha}, β = ${RW.beta}, λ = 1): V ends acquisition at ${(model[tr.filter((x) => x.phase === 'acquisition').length - 1] || 0).toFixed(2)} and extinction at ${(model[tr.length - 1] || 0).toFixed(2)}.`,
      'Note: basic R–W has no mechanism for spontaneous recovery — it predicts the test response stays at the extinguished level.',
    ];
    return { lines, stats: { acqLate: rate('acquisition', 'last'), extLate: rate('extinction', 'last'), test: testR },
      chart: (ch) => ch.line([
        { name: 'Your CR rate (moving avg 3)', points: ma.map((y, i) => ({ x: i + 1, y })), dots: true },
        { name: 'R–W V (model)', points: model.map((y, i) => ({ x: i + 1, y })), dash: true },
      ], { label: 'Conditioned responding vs Rescorla–Wagner model', xl: 'trial', yl: 'CR rate / V', yr: [0, 1.05] }) };
  },
}, TAGS);

// ---------------------------------------------------------------- operant schedules
const SCHED = { FR: { param: 5, label: 'FR 5' }, VR: { param: 5, label: 'VR 5' }, FI: { param: 4, label: 'FI 4 s' }, VI: { param: 4, label: 'VI 4 s' } };

function opPress(t, state, elapsed) {
  const op = state.op; if (!op) return;
  op.presses.push(elapsed); op.respSinceRf++;
  const P = SCHED[t.schedule].param;
  let rf = false;
  if (t.schedule === 'FR') rf = op.respSinceRf >= P;
  else if (t.schedule === 'VR') rf = op.respSinceRf >= op.vr[op.vi_r % op.vr.length];
  else if (t.schedule === 'FI') rf = elapsed - op.lastRfAt >= P * 1000;
  else if (t.schedule === 'VI') rf = elapsed - op.lastRfAt >= op.vi[op.vi_i % op.vi.length];
  if (rf) {
    op.points++; op.rfs.push({ t: elapsed, n: op.presses.length }); op.respSinceRf = 0; op.lastRfAt = elapsed;
    if (t.schedule === 'VR') op.vi_r++;
    if (t.schedule === 'VI') op.vi_i++;
  }
}

const operantSchedules = Object.assign({
  id: 'operant_schedules', title: 'Operant schedules FR/VR/FI/VI',
  purpose: 'To feel how fixed/variable ratio and interval schedules of reinforcement shape the rate and pattern of your lever pressing.',
  instructions: '<p>Each block is one reinforcement <b>schedule</b>. Press the lever with <kbd>Space</kbd> (or the button) to earn points.</p><ul><li><b>FR</b> (fixed ratio): a point after a fixed number of presses.</li><li><b>VR</b> (variable ratio): a point after an unpredictable number of presses.</li><li><b>FI</b> (fixed interval): the first press after a fixed time earns a point.</li><li><b>VI</b> (variable interval): the first press after an unpredictable time earns a point.</li></ul><p>Watch your live cumulative record on the right.</p>',
  estimateMin: 4, practice: 0, fix: 400, iti: 1200, timeout: null, background: '#e5e7eb', animated: true,
  response: { type: 'count', keys: ['space'], labels: { space: 'press lever' } },
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 8 : 12);
    const dur = opts.quick ? 10000 : 20000;
    const out = [];
    while (out.length < n) for (const s of rng.shuffle(Object.keys(SCHED))) if (out.length < n) out.push({ condition: s, schedule: s, dur, stimulus: `${SCHED[s].label}|${dur / 1000}s` });
    return out;
  },
  init() { return { blockLog: [] }; },
  prepare(t, state, rng) {
    const P = SCHED[t.schedule].param;
    state.op = { presses: [], rfs: [], points: 0, respSinceRf: 0, lastRfAt: 0, vi_r: 0, vi_i: 0,
      vr: Array.from({ length: 40 }, () => Math.max(1, Math.round(P * (0.5 + rng.random())))),
      vi: Array.from({ length: 40 }, () => P * 1000 * (0.5 + rng.random())) };
  },
  onKey(t, k, state, elapsed) { opPress(t, state, elapsed); },
  draw(ctx, t, W, H, elapsed, state) {
    const op = (state && state.op) || { presses: [], rfs: [], points: 0 };
    const dur = t.dur || 10000;
    text(ctx, `Schedule: ${SCHED[t.schedule].label}`, W * 0.27, 50, 24, '#111', 700);
    // lever
    const lx = W * 0.27, ly = H * 0.55;
    const last = op.presses.length ? op.presses[op.presses.length - 1] : -1e9;
    const down = elapsed - last < 150;
    ctx.fillStyle = '#6b7280'; ctx.fillRect(lx - 90, ly + 30, 180, 30);
    ctx.save(); ctx.translate(lx - 60, ly + 30); ctx.rotate(down ? 0.12 : -0.25);
    ctx.fillStyle = '#334155'; ctx.fillRect(0, -10, 140, 18); ctx.fillStyle = '#0072B2'; ctx.beginPath(); ctx.arc(140, -1, 16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    text(ctx, `Points: ${op.points}`, lx, ly - 90, 34, '#065f46', 800);
    const lastRf = op.rfs.length ? op.rfs[op.rfs.length - 1].t : -1e9;
    if (elapsed - lastRf < 500) text(ctx, '+1', lx + 90, ly - 120, 28, '#009E73', 800);
    text(ctx, `Presses: ${op.presses.length}`, lx, ly + 100, 18, '#111', 500);
    // time bar
    const fr = clamp(elapsed / dur, 0, 1);
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(lx - 120, H - 50, 240, 10); ctx.fillStyle = '#475569'; ctx.fillRect(lx - 120, H - 50, 240 * fr, 10);
    // mini cumulative record
    const gx = W * 0.55, gy = 90, gw = W * 0.38, gh = H - 200;
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke();
    text(ctx, 'Your cumulative record', gx + gw / 2, gy - 20, 16, '#111', 600);
    const ymax = Math.max(20, op.presses.length + 5);
    const sx = (v) => gx + (v / dur) * gw, sy = (c) => gy + gh - (c / ymax) * gh;
    ctx.strokeStyle = '#E69F00'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx, gy + gh);
    op.presses.forEach((p, i) => { ctx.lineTo(sx(p), sy(i)); ctx.lineTo(sx(p), sy(i + 1)); });
    ctx.lineTo(sx(Math.min(elapsed, dur)), sy(op.presses.length)); ctx.stroke();
    ctx.strokeStyle = '#009E73'; ctx.lineWidth = 2;
    for (const r of op.rfs) { ctx.beginPath(); ctx.moveTo(sx(r.t), sy(r.n)); ctx.lineTo(sx(r.t) + 6, sy(r.n) + 8); ctx.stroke(); }
    text(ctx, 'time →', gx + gw - 30, gy + gh + 16, 13, '#334155', 500);
  },
  score() { return null; },
  simulate(p, t, rng) {
    // Simulated effect size: schedule multipliers are a qualitative teaching model, not real-study values.
    const mult = { FR: 1.0, VR: 1.15, FI: 0.55, VI: 0.75 }[t.schedule];
    const rate = Math.max(0.8, 2.2 + 0.3 * p.ability);
    return { response: Math.max(0, Math.round(rate * mult * ((t.dur || 10000) / 1000) * (1 + rng.normal(0, 0.1)))) };
  },
  update(state, t, result) {
    if (!state.op) return;
    const n = +result.response || 0;
    if (!state.op.presses.length && n > 0) for (let i = 0; i < n; i++) opPress(t, state, ((i + 0.5) / n) * (t.dur || 10000));
    (state.blockLog = state.blockLog || []).push({ schedule: t.schedule, presses: state.op.presses.length || n, points: state.op.points });
  },
  analyse(rows, state) {
    const lines = [];
    const rates = {};
    for (const s of Object.keys(SCHED)) {
      const r = rows.filter((x) => x.condition === s);
      const per = r.map((x) => { const sec = +(String(x.stimulus).split('|')[1] || '10s').replace('s', '') || 10; return (+x.response || 0) / sec * 60; });
      rates[s] = meanOr(per, 0);
      const pts = state && state.blockLog ? state.blockLog.filter((b) => b.schedule === s).map((b) => b.points) : [];
      lines.push(`${SCHED[s].label}: ${rates[s].toFixed(0)} presses/min over ${r.length} block(s)${pts.length ? `, ${S.sum(pts)} points` : ''}`);
    }
    // Simulated agent (learning.simulateSchedule) — four schedules back to back.
    const rng = mkRng(2027);
    const seg = 150, plan = [['FR', 10], ['VR', 10], ['FI', 30], ['VI', 30]];
    const record = [], reinforcers = [];
    let t0 = 0, c0 = 0;
    const simRates = {};
    for (const [type, param] of plan) {
      const sim = L.simulateSchedule(type, param, rng, { seconds: seg });
      simRates[type] = sim.rate * 60;
      for (const r of sim.record) record.push({ t: r.t + t0, count: r.count + c0 });
      for (const r of sim.reinforcers) reinforcers.push({ t: r.t + t0, count: r.count + c0 });
      t0 += seg; c0 += sim.totalResponses;
    }
    lines.push(`Simulated agent (teaching model, not real data): ${plan.map(([s, p]) => `${s}${p}${s[1] === 'I' ? ' s' : ''} ${simRates[s].toFixed(0)}/min`).join(', ')}`);
    lines.push('Look for: steep steady ratio runs, post-reinforcement pauses on FR, a "scallop" on FI, and steady moderate VI responding.');
    return { lines, stats: { rates, simulated: simRates },
      chart: (ch) => ch.cumulative(record, reinforcers, { label: 'Simulated agent — cumulative record (FR10 → VR10 → FI30 s → VI30 s, 150 s each)' }) };
  },
}, TAGS);

// ---------------------------------------------------------------- shaping
const shaping = Object.assign({
  id: 'shaping', title: 'Shaping by successive approximation',
  purpose: 'To train a simulated lab animal to raise its paw to a bell by reinforcing closer and closer approximations to the target behaviour.',
  instructions: '<p>A simulated rat, <b>Chiku</b>, lifts its paw each trial. The dashed line is your current <b>criterion</b>. Press <kbd>R</kbd> to <b>reinforce</b> (give a treat) if the paw reaches the criterion line; press <kbd>N</kbd> to <b>skip</b> if it does not.</p><p>When Chiku meets the criterion reliably, the criterion is raised toward the bell (successive approximation). Reinforcing the wrong behaviour pulls Chiku back.</p>',
  estimateMin: 3, practice: 2, fix: 300, iti: 500, timeout: 5000, background: '#f1f5f9', animated: true,
  response: { type: 'key', keys: ['r', 'n'], labels: { r: 'reinforce', n: 'skip' } },
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.practice === true ? 2 : opts.quick ? 16 : 36);
    return Array.from({ length: n }, (_, i) => ({ condition: 'pending', stimulus: 'trial ' + (i + 1) }));
  },
  init() { return { agent: { mean: 0.12, spread: 0.12 }, criterion: 0.2, target: 1.0, step: 0.1, streak: 0, misses: 0, history: [] }; },
  prepare(t, state, rng) {
    if (!state.agent) Object.assign(state, shaping.init());
    const tmp = { mean: state.agent.mean, spread: state.agent.spread };
    const out = L.shapingStep(tmp, state.criterion, rng); // behaviour emitted by the agent model
    const b = clamp(out.behaviour, 0, 1.2);
    t.behaviour = b; t.criterion = state.criterion; t.target = state.target;
    t.correctResponse = b >= state.criterion ? 'r' : 'n';
    t.condition = b >= state.criterion ? 'at_or_above' : 'below';
    t.stimulus = `paw=${b.toFixed(2)};crit=${state.criterion.toFixed(2)}`;
  },
  draw(ctx, t, W, H, elapsed) {
    const floor = H - 90, scale = (H - 220), x0 = W / 2 - 60;
    const b = t.behaviour != null ? t.behaviour : 0, crit = t.criterion != null ? t.criterion : 0.2, target = t.target || 1;
    const yOf = (v) => floor - 40 - v * scale * 0.8;
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(0, floor, W, H - floor);
    // bell (target)
    ctx.fillStyle = '#D4A017'; ctx.beginPath(); ctx.arc(x0 + 110, yOf(target) - 10, 18, Math.PI, 0); ctx.fill(); ctx.fillRect(x0 + 90, yOf(target) - 12, 40, 6);
    text(ctx, 'bell (target)', x0 + 200, yOf(target) - 12, 14, '#7c5e10', 600);
    // criterion line
    ctx.setLineDash([8, 6]); ctx.strokeStyle = '#D55E00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0 - 40, yOf(crit)); ctx.lineTo(x0 + 260, yOf(crit)); ctx.stroke(); ctx.setLineDash([]);
    text(ctx, 'criterion', x0 + 300, yOf(crit), 14, '#D55E00', 700);
    // rat body
    ctx.fillStyle = '#9ca3af'; ctx.beginPath(); ctx.ellipse(x0 - 30, floor - 35, 70, 35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x0 + 40, floor - 60, 30, 24, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.arc(x0 + 30, floor - 88, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x0 + 52, floor - 64, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9ca3af'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0 - 98, floor - 30); ctx.quadraticCurveTo(x0 - 150, floor - 10, x0 - 170, floor - 40); ctx.stroke();
    // paw rises to behaviour over 600 ms
    const v = b * clamp(elapsed / 600, 0, 1);
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(x0 + 50, floor - 45); ctx.lineTo(x0 + 85, yOf(v)); ctx.stroke();
    ctx.fillStyle = '#f9a8d4'; ctx.beginPath(); ctx.arc(x0 + 85, yOf(v), 8, 0, Math.PI * 2); ctx.fill();
    text(ctx, 'Chiku (simulated rat)', x0 - 30, floor + 25, 15, '#334155', 600);
    // progress
    ctx.fillStyle = '#e2e8f0'; ctx.fillRect(30, 30, 220, 12); ctx.fillStyle = '#009E73'; ctx.fillRect(30, 30, 220 * clamp(crit / target, 0, 1), 12);
    text(ctx, `criterion ${crit.toFixed(2)} / target ${target.toFixed(2)}`, 140, 58, 13, '#111', 500);
    text(ctx, 'R = reinforce   N = skip', W / 2, H - 30, 18, '#111', 600);
  },
  score(t, r) { return r == null ? false : r === t.correctResponse; },
  simulate(p, t, rng) {
    const close = Math.abs((t.behaviour || 0) - (t.criterion || 0)) < 0.05;
    const ok = drawCorrect(p, rng, close ? 1.8 : 0.2);
    return { response: ok ? t.correctResponse : (t.correctResponse === 'r' ? 'n' : 'r'), rt: drawRT(p, rng, { mu: 700 }).rt };
  },
  update(state, t, result) {
    if (!state.agent) return;
    const b = t.behaviour || 0, met = b >= t.criterion;
    // Same reinforcement rule as learning.shapingStep, but driven by the player's decision.
    if (result.response === 'r') { state.agent.mean += 0.35 * (b - state.agent.mean) + 0.05; state.agent.spread = Math.max(0.05, state.agent.spread * 0.99); } else state.agent.mean -= 0.02;
    state.agent.mean = clamp(state.agent.mean, 0, 1.2);
    if (met && result.response === 'r') { state.misses = 0; if (++state.streak >= 2) { state.criterion = Math.min(state.target, +(state.criterion + state.step).toFixed(2)); state.streak = 0; } } else if (!met) { state.streak = 0; if (++state.misses >= 4) { state.criterion = Math.max(0.1, +(state.criterion - 0.05).toFixed(2)); state.misses = 0; } }
    state.history.push({ behaviour: b, criterion: t.criterion, mean: state.agent.mean, reinforced: result.response === 'r', correct: !!result.correct });
  },
  analyse(rows, state) {
    const parsed = rows.map((r) => { const m = /paw=([\d.]+);crit=([\d.]+)/.exec(r.stimulus) || []; return { b: +m[1] || 0, c: +m[2] || 0, correct: String(r.correct) === '1', resp: r.response }; });
    const acc = meanOr(parsed.map((x) => (x.correct ? 1 : 0)), 0);
    const third = Math.max(1, Math.floor(parsed.length / 3));
    const early = meanOr(parsed.slice(0, third).map((x) => x.b)), late = meanOr(parsed.slice(-third).map((x) => x.b));
    const finalCrit = state && state.criterion != null ? state.criterion : (parsed.length ? parsed[parsed.length - 1].c : 0);
    const target = (state && state.target) || 1;
    const wrongR = parsed.filter((x) => x.resp === 'r' && x.b < x.c).length, missed = parsed.filter((x) => x.resp !== 'r' && x.b >= x.c).length;
    const lines = [
      `Reinforcement decisions correct: ${pct(acc)} (${parsed.length} trials)`,
      `Mean paw height: first third ${Number.isFinite(early) ? early.toFixed(2) : '—'} → last third ${Number.isFinite(late) ? late.toFixed(2) : '—'}`,
      `Criterion reached ${finalCrit.toFixed(2)} of target ${target.toFixed(2)} (${pct(finalCrit / target)} of the way)`,
      `Errors: reinforced below criterion ${wrongR}×, withheld a treat for a criterion-meeting response ${missed}×`,
      'Agent behaviour is generated by a simple successive-approximation model (Simulated).',
    ];
    return { lines, stats: { accuracy: acc, early, late, finalCriterion: finalCrit },
      chart: (ch) => ch.line([
        { name: 'paw height', points: parsed.map((x, i) => ({ x: i + 1, y: x.b })), dots: true },
        { name: 'criterion', points: parsed.map((x, i) => ({ x: i + 1, y: x.c })), dash: true },
        { name: 'target', points: [{ x: 1, y: target }, { x: Math.max(2, parsed.length), y: target }] },
      ], { label: 'Shaping progress (Simulated agent)', xl: 'trial', yl: 'height (0–1)', step: false }) };
  },
}, TAGS);

module.exports = [classicalCond, operantSchedules, shaping];
