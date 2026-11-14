'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/exp/core/timeline.js');
const timing = require('../src/exp/core/timing.js');
const { Rng } = require('../src/core/rng.js');
test('Latin square: each condition once per row and column (n=4)', () => {
  const L = T.latinSquare(4);
  for (const r of L) assert.deepEqual(r.slice().sort(), [0, 1, 2, 3]);
  for (let c = 0; c < 4; c++) assert.deepEqual(L.map((r) => r[c]).sort(), [0, 1, 2, 3]);
});
test('Latin square (Williams): first-order carryover balanced for n=4', () => {
  const L = T.latinSquare(4); const seen = {};
  for (const r of L) for (let i = 1; i < r.length; i++) { const k = r[i - 1] + '>' + r[i]; seen[k] = (seen[k] || 0) + 1; }
  assert.equal(Object.keys(seen).length, 12); for (const v of Object.values(seen)) assert.equal(v, 1);
});
test('Latin square odd n doubles rows', () => assert.equal(T.latinSquare(3).length, 6));
test('balancedSequence: equal counts and max run respected', () => {
  const s = T.balancedSequence(['a', 'b', 'c'], 10, new Rng(4), 3);
  assert.equal(s.filter((x) => x === 'a').length, 10);
  let run = 1; for (let i = 1; i < s.length; i++) { run = s[i] === s[i - 1] ? run + 1 : 1; assert.ok(run <= 3); }
});
test('CSV round-trip with commas and quotes', () => {
  const rows = [{ pid: 'P', session: 1, paradigm: 'x', block: 'main', trial: 1, condition: 'a,b', stimulus: 'say "hi"', onset_req: 1, onset_actual: 2, frames: 0.1, rt_ms: 300.5, response: 'f', correct: 1, seed: 's', ua_hash: 'h' }];
  const back = T.parseCSV(T.toCSV(rows)); assert.equal(back[0].condition, 'a,b'); assert.equal(back[0].stimulus, 'say "hi"');
});
test('validateRows flags NaN and imbalance', () => {
  const base = { pid: 'P', session: 1, paradigm: 'x', block: 'main', trial: 1, condition: 'a', stimulus: '', onset_req: 1, onset_actual: 2, frames: 0, rt_ms: 'NaN', response: '', correct: '', seed: 's', ua_hash: 'h' };
  assert.equal(T.validateRows([base]).ok, false);
  const ok = Object.assign({}, base, { rt_ms: 300 });
  const rows = [ok, ok, ok, Object.assign({}, ok, { condition: 'b' })];
  assert.equal(T.validateRows(rows, { expectBalanced: true }).ok, false);
});
test('codebook lists every field', () => { const md = T.codebookMarkdown('stroop'); for (const f of T.ROW_FIELDS) assert.ok(md.includes('| ' + f + ' |')); });
test('timing summary: median ≤1 frame passes, resolution computed', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ onset_req: i * 100, onset_actual: i * 100 + (i % 10), rt_ms: 300 + i * 0.1 }));
  const s = timing.summarise(rows, 16.67); assert.ok(s.pass); assert.ok(s.rtResolutionMs <= 1); assert.equal(timing.frameDuration([0, 16, 33, 50]), 17);
});
