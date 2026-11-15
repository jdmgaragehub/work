'use strict';
/** Pure-helper tests for the Foundations and Brain & Mind panels (no DOM needed). */
const test = require('node:test');
const assert = require('node:assert');
const F = require('../src/ui/panels/foundations.js');
const B = require('../src/ui/panels/brain.js');
const { Rng } = require('../src/core/rng.js');
const latinSquare = require('../src/exp/core/timeline.js').latinSquare;

test('panel modules export the required ids', () => {
  assert.deepStrictEqual(F.map((p) => p.id), ['history', 'perspectives', 'methods', 'irb', 'stats']);
  assert.deepStrictEqual(B.map((p) => p.id), ['bio', 'brain', 'sleep', 'sensation', 'sdt', 'illusions', 'attention']);
  for (const p of F.concat(B)) assert.strictEqual(typeof p.render, 'function');
});

test('parsePasted handles plain numbers and CSV with header', () => {
  assert.deepStrictEqual(F.helpers.parsePasted('1 2, 3\n4'), { x: [1, 2, 3, 4] });
  const raw = F.helpers.parsePasted('group,score\nA,12\nB,9');
  assert.deepStrictEqual(raw, { group: ['A', 'B'], score: ['12', '9'] });
  const ds = F.helpers.makeDataset('t', false, raw);
  assert.strictEqual(ds.cols.score.type, 'num');
  assert.strictEqual(ds.cols.group.type, 'cat');
  assert.strictEqual(F.helpers.parsePasted('   '), null);
});

test('try-first tolerance check', () => {
  const tol = F.helpers.tolFor(2.5);
  assert.ok(F.helpers.withinTol(2.52, 2.5, tol));
  assert.ok(!F.helpers.withinTol(2.7, 2.5, tol));
  assert.ok(!F.helpers.withinTol(NaN, 2.5, tol));
});

test('every IRB code used in irb.json has a paraphrase', () => {
  const irb = require('../src/data/irb.json');
  for (const p of irb) for (const c of p.codes) assert.ok(F.helpers.CODE_TEXT[c], 'missing ' + c);
});

test('Latin square used by the design builder balances positions', () => {
  const sq = latinSquare(4);
  for (let pos = 0; pos < 4; pos++) assert.deepStrictEqual(sq.map((r) => r[pos]).sort(), [0, 1, 2, 3]);
});

test('simulated night has requested length and valid stages', () => {
  const st = B.helpers.simulateNight(new Rng(3), { hours: 8, pressure: 0.5, disrupt: 0.01 });
  assert.strictEqual(st.length, 960);
  assert.ok(st.every((s) => ['W', 'N1', 'N2', 'N3', 'REM'].includes(s)));
  const firstHalf = st.slice(0, 480).filter((s) => s === 'N3').length, secondHalf = st.slice(480).filter((s) => s === 'N3').length;
  assert.ok(firstHalf > secondHalf, 'slow-wave sleep front-loaded');
});

test('sdtRates matches d′ and c definitions', () => {
  const sdt = require('../src/psych/sdt.js');
  const r = B.helpers.sdtRates(1.5, 0.3);
  assert.ok(Math.abs(sdt.dprime(r.H, r.FA) - 1.5) < 1e-6);
  assert.ok(Math.abs(sdt.criterion(r.H, r.FA) - 0.3) < 1e-6);
});
