'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SM = require('../src/psych/socialmodels.js');

test('bystander: helped% decreases as the number of onlookers grows', () => {
  const curve = SM.bystanderCurve({ trials: 600 }, [1, 2, 5, 10]);
  for (let i = 1; i < curve.length; i++) assert.ok(curve[i].helpedPct < curve[i - 1].helpedPct, `n=${curve[i].n}: ${curve[i].helpedPct} !< ${curve[i - 1].helpedPct}`);
  assert.ok(curve[0].helpedPct > 0.8, 'a lone bystander usually helps');
  assert.ok(SM.individualHelpProb(5) < SM.individualHelpProb(1));
  const r = SM.bystander({ n: 3 });
  assert.equal(r.label, 'Simulated');
  assert.ok(r.meanTimeToHelp > 0);
});

test('bystander: time-to-help gets longer in larger groups', () => {
  const a = SM.bystander({ n: 1, trials: 800 }), b = SM.bystander({ n: 6, trials: 800 });
  assert.ok(b.meanTimeToHelp > a.meanTimeToHelp);
});

test('cooperation: TFT beats AllD in a mixed population', () => {
  const r = SM.cooperation();
  assert.equal(r.label, 'Simulated');
  assert.ok(r.scores.TFT > r.scores.AllD, `TFT ${r.scores.TFT} vs AllD ${r.scores.AllD}`);
  assert.equal(r.agents.length, 20);
  // AllD wins head-to-head, as in Axelrod's tournaments
  const m = SM.playMatch('TFT', 'AllD', SM.COOPERATION_DEFAULTS, SM.makeRng(1));
  assert.ok(m.B > m.A);
});

test('cooperation: AllD dominates a population of unconditional cooperators', () => {
  const r = SM.cooperation({ population: { AllC: 8, AllD: 2 } });
  assert.ok(r.scores.AllD > r.scores.AllC);
});

test('conformity: rate rises with majority size, then plateaus', () => {
  const curve = SM.conformityCurve({ n: 200 }, 15);
  const at = (k) => curve[k].rate;
  assert.ok(at(0) < 0.05, 'alone, almost no errors');
  assert.ok(at(1) < at(2) && at(2) < at(3), 'increases for small majorities');
  assert.ok(at(3) > 0.25 && at(3) < 0.5, `Asch-like ~1/3 at 3+: ${at(3)}`);
  assert.ok(Math.abs(at(15) - at(5)) < 0.06, `plateau: ${at(5)} vs ${at(15)}`);
});

test('conformity: a single dissenter sharply reduces conformity', () => {
  const a = SM.conformity({ majority: 7 }), b = SM.conformity({ majority: 7, dissenter: true });
  assert.ok(b.conformityRate < a.conformityRate * 0.5);
});

test('majorityStep pulls choices toward the majority', () => {
  const rng = SM.makeRng(3);
  let ch = Array.from({ length: 20 }, (_, i) => (i < 14 ? 1 : 0));
  const tr = ch.map(() => 0.8);
  for (let s = 0; s < 30; s++) ch = SM.majorityStep(ch, tr, rng, { rate: 0.5 });
  assert.ok(ch.reduce((a, b) => a + b, 0) > 16);
});
