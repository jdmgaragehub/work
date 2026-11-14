'use strict';
/** Headless paradigm checks (A8/A11): every paradigm builds trials, simulates a bot, analyses, draws on a mock context. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Rng } = require('../src/core/rng.js');
const T = require('../src/exp/core/timeline.js');
const P = require('../src/psych/participants.js');

const dir = path.join(__dirname, '../src/exp/paradigms');
const specs = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).flatMap((f) => require(path.join(dir, f)));
const REQUIRED = ['muller_lyer','ponzo','ames','jnd_staircase','magnitude_est','sdt_yesno','stroop','visual_search','posner','attn_blink','dichotic','inattentional_blindness','change_blindness','serial_position','brown_peterson','levels_processing','drm','misinformation','nback','memory_palace','classical_cond','operant_schedules','shaping','mental_rotation','hanoi','wason','framing','anchoring','hick_hyman','fitts','conservation','false_belief','asch','prisoners_dilemma','ipip_big5','face_recognition','flanker','go_nogo'];

function mockCtx() {
  const noop = () => {};
  return new Proxy({ canvas: { width: 800, height: 600 } }, { get(t, k) { if (k in t) return t[k]; if (k === 'measureText') return () => ({ width: 10 }); if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop: noop }); if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) }); return noop; }, set(t, k, v) { t[k] = v; return true; } });
}
const charts = new Proxy({}, { get: () => () => ({}) });

test('all required paradigms registered (≥36)', () => {
  const ids = specs.map((s) => s.id);
  for (const id of REQUIRED) assert.ok(ids.includes(id), 'missing ' + id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate ids');
  assert.ok(ids.length >= 36);
});

for (const spec of specs) {
  test(`paradigm ${spec.id}: build → bot → rows valid → analyse`, () => {
    for (const k of ['title', 'week', 'panel', 'zone', 'apa', 'domain', 'hec', 'purpose', 'instructions', 'buildTrials', 'draw', 'simulate', 'analyse']) assert.ok(spec[k] != null, `${spec.id} missing ${k}`);
    if (spec.deception) assert.ok(spec.debrief && spec.debrief.deception && spec.debrief.purpose, 'deception needs debrief');
    if (spec.contentWarning) assert.ok(spec.textAlternative, 'content warning needs textAlternative');
    const rng = new Rng('test:' + spec.id);
    const opts = { quick: true, bot: true };
    const trials = T.buildTimeline(spec, rng, opts);
    assert.ok(trials.length >= 4, 'too few trials');
    const t2 = spec.buildTrials(new Rng(1), { trials: 40 });
    assert.ok(t2.length >= Math.min(40, 6), 'opts.trials not honoured');
    const state = spec.init ? spec.init(rng, opts) : {};
    const bot = P.bot(new Rng(2));
    const ctx = mockCtx();
    const rows = [];
    trials.forEach((tr, i) => {
      if (spec.prepare) spec.prepare(tr, state, rng);
      spec.draw(ctx, tr, 800, 600, 0, state);
      spec.draw(ctx, tr, 800, 600, 250, state);
      const s = spec.simulate(bot, tr, rng, state) || {};
      assert.ok(s.rt == null || Number.isFinite(s.rt), 'rt NaN');
      const correct = s.correct != null ? s.correct : spec.score ? spec.score(tr, s.response, state) : null;
      if (spec.update) spec.update(state, tr, { correct, response: s.response, rt: s.rt }, rng);
      rows.push(T.makeRow({ pid: 'BOT001', session: 1, paradigm: spec.id, seed: 's', ua_hash: 'x' }, tr, { onset_req: i * 1000, onset_actual: i * 1000 + 3, frames: 0.2, rt_ms: s.rt, response: s.response, correct }));
    });
    const v = T.validateRows(rows);
    assert.ok(v.ok, v.errors.join('; '));
    const csv = T.toCSV(rows);
    assert.equal(T.parseCSV(csv).length, rows.length);
    const out = spec.analyse(rows.filter((r) => r.block !== 'practice'), state);
    assert.ok(out && Array.isArray(out.lines) && out.lines.length > 0, 'analyse lines');
    for (const l of out.lines) assert.ok(!/undefined/.test(l), 'analyse text contains undefined: ' + l);
    if (out.chart) out.chart(charts);
  });
}
