'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/game/logic.js');
const missions = require('../src/data/missions.json');
const dilemmas = require('../src/data/dilemmas.json');
const irb = require('../src/data/irb.json');
const tour = require('../src/data/tour.json');

const mk = (objectives) => ({ id: 'X', objectives, xp: 10 });

test('matchWhere: equality on every key, empty where matches', () => {
  assert.ok(L.matchWhere(null, { a: 1 }));
  assert.ok(L.matchWhere({}, {}));
  assert.ok(L.matchWhere({ id: 'stats' }, { id: 'stats', extra: 1 }));
  assert.ok(!L.matchWhere({ id: 'stats' }, { id: 'irb' }));
  assert.ok(L.matchWhere({ week: 3, correct: true }, { week: 3, correct: true }));
  assert.ok(!L.matchWhere({ week: 3, correct: true }, { week: 3, correct: false }));
  assert.ok(!L.matchWhere({ ethicsPenalty: false }, {}), 'missing key does not match');
});

test('matchObjective: event name, where clause and bot exclusion', () => {
  const o = { event: 'exp:complete', where: { paradigm: 'stroop' }, count: 1 };
  assert.ok(L.matchObjective(o, 'exp:complete', { paradigm: 'stroop', rows: 72 }));
  assert.ok(!L.matchObjective(o, 'exp:start', { paradigm: 'stroop' }));
  assert.ok(!L.matchObjective(o, 'exp:complete', { paradigm: 'flanker' }));
  assert.ok(!L.matchObjective(o, 'exp:complete', { paradigm: 'stroop', bot: true }), 'bot runs are not the player');
  assert.ok(L.matchObjective({ event: 'builder:save', count: 1 }, 'builder:save', { design: {} }));
});

test('applyEvent counts up to count and completes once all objectives met', () => {
  const m = mk([{ event: 'quiz:answer', where: { week: 1 }, count: 3 }, { event: 'panel:open', where: { id: 'history' }, count: 1 }]);
  const ms = L.newMissionState(m);
  for (let i = 0; i < 5; i++) L.applyEvent(m, ms, 'quiz:answer', { week: 1, correct: false });
  assert.deepEqual(ms.progress, [3, 0]);
  assert.equal(ms.done, false);
  L.applyEvent(m, ms, 'quiz:answer', { week: 2 });
  const r = L.applyEvent(m, ms, 'panel:open', { id: 'history' });
  assert.ok(r.completed && ms.done);
  assert.equal(L.applyEvent(m, ms, 'panel:open', { id: 'history' }).changed, false, 'done missions are frozen');
});

test('missionProgress replays an event log (M01)', () => {
  const m01 = missions.find((m) => m.id === 'M01');
  const log = [{ event: 'zone:enter', payload: { zone: 'wundt' } }, { event: 'panel:open', payload: { id: 'history' } }, { event: 'panel:open', payload: { id: 'perspectives' } }];
  for (let i = 0; i < 5; i++) log.push({ event: 'quiz:answer', payload: { week: 1, correct: i % 2 === 0 } });
  const p = L.missionProgress(m01, log);
  assert.equal(p.done, true);
  assert.equal(p.fraction, 1);
  assert.equal(L.missionProgress(m01, log.slice(0, 4)).done, false);
});

test('all 44 missions use catalogued events with valid counts', () => {
  assert.equal(missions.length, 44);
  assert.deepEqual(L.validateMissions(missions), []);
  assert.equal(missions.filter(L.isCore).length, 16);
  assert.ok(missions.filter((m) => !L.isCore(m)).every((m) => m.unlockAfterWeek === 16));
});

test('every mission is completable by synthesising its objective events', () => {
  for (const m of missions) {
    const log = [];
    for (const o of m.objectives) for (let i = 0; i < o.count; i++) log.push({ event: o.event, payload: Object.assign({}, o.where || {}) });
    assert.equal(L.missionProgress(m, log).done, true, m.id);
  }
});

test('electives unlock only after all core missions through week 16 are done', () => {
  const e = missions.find((m) => m.id === 'E-IO-4');
  const st = {};
  assert.equal(L.isUnlocked(e, st, missions), false);
  missions.filter(L.isCore).forEach((m) => { st[m.id] = { done: true }; });
  assert.equal(L.isUnlocked(e, st, missions), true);
  delete st.M16;
  assert.equal(L.isUnlocked(e, st, missions), false);
  assert.equal(L.isUnlocked(e, st, missions, true), true, 'instructor override');
});

test('XP curve agrees with sim.addXP and levelProgress is consistent', () => {
  assert.equal(L.levelForXP(0), 1);
  assert.equal(L.levelForXP(119), 1);
  assert.equal(L.levelForXP(120), 2);
  assert.equal(L.levelForXP(480), 3);
  for (let lv = 1; lv < 10; lv++) assert.equal(L.levelForXP(L.xpForLevel(lv)), lv);
  const p = L.levelProgress(300);
  assert.equal(p.level, 2); assert.ok(p.frac > 0 && p.frac < 1);
});

test('grade boundaries A/B/C/D/F', () => {
  assert.equal(L.gradeFor(100), 'A'); assert.equal(L.gradeFor(85), 'A'); assert.equal(L.gradeFor(84.9), 'B');
  assert.equal(L.gradeFor(70), 'B'); assert.equal(L.gradeFor(69.9), 'C'); assert.equal(L.gradeFor(55), 'C');
  assert.equal(L.gradeFor(54.9), 'D'); assert.equal(L.gradeFor(40), 'D'); assert.equal(L.gradeFor(39.9), 'F'); assert.equal(L.gradeFor(0), 'F');
  assert.equal(L.overallScore({ g1: 100, g2: 80, g3: 60, g4: 40, g5: 20 }), 60);
});

test('scorecard maps events to the 5 APA goals', () => {
  const s = L.newStats();
  const st = { missions: {}, ethicsPenalty: 0 };
  const zero = L.computeScorecard(s, st, { missions });
  assert.deepEqual(zero, { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0 });
  L.tally(s, 'quiz:answer', { correct: true, week: 1 }); L.tally(s, 'panel:open', { id: 'history' });
  L.tally(s, 'exp:complete', { paradigm: 'stroop' }); L.tally(s, 'stats:test', { test: 'corr' });
  L.tally(s, 'irb:decision', { correct: true }); L.tally(s, 'debrief:shown', {});
  L.tally(s, 'report:generated', {}); L.tally(s, 'export:done', { kind: 'csv' });
  st.missions.M01 = { done: true };
  const sc = L.computeScorecard(s, st, { missions });
  for (const g of ['g1', 'g2', 'g3', 'g4', 'g5']) assert.ok(sc[g] > 0, g);
  L.tally(s, 'exp:complete', { paradigm: 'flanker', bot: true });
  assert.equal(Object.keys(s.paradigms).length, 1, 'bot runs do not count as inquiry');
});

test('ethics penalty reduces XP (floored at 0) and g3', () => {
  const d = dilemmas.find((x) => x.options.some((o) => o.ethicsPenalty));
  const bad = d.options.findIndex((o) => o.ethicsPenalty);
  const r = L.resolveDilemma(d, bad, 'bachelor');
  assert.equal(r.ethicsPenalty, true);
  assert.ok(r.xp < 0);
  assert.equal(L.resolveDilemma(d, bad, 'honours').xp, -L.PENALTY_XP.honours);
  const good = L.bestOption(d);
  assert.equal(d.options[good].ethicsPenalty, false);
  assert.ok(L.resolveDilemma(d, good, 'bachelor').xp > 0);
  const state = { xp: 50, ethicsPenalty: 0, scorecard: { g3: 30 } };
  assert.equal(L.applyEthicsPenalty(state, 'bachelor'), 30);
  assert.equal(state.xp, 20); assert.equal(state.ethicsPenalty, 1); assert.equal(state.scorecard.g3, 22);
  L.applyEthicsPenalty(state, 'honours');
  assert.equal(state.xp, 0);
  const s = L.newStats();
  for (let i = 0; i < 12; i++) L.tally(s, 'dilemma:resolved', { ethicsPenalty: false });
  const clean = L.computeScorecard(s, { ethicsPenalty: 0 }, { missions }).g3;
  const pen = L.computeScorecard(s, { ethicsPenalty: 2 }, { missions }).g3;
  assert.equal(clean - pen, 2 * L.ETHICS_G3_POINTS);
});

test('IRB judgement: correctness and approving a reject-worthy study is penalised', () => {
  const rej = irb.find((p) => p.correct === 'reject');
  assert.ok(rej);
  assert.deepEqual([L.judgeIRB(rej, 'reject').correct, L.judgeIRB(rej, 'approve').ethicsPenalty, L.judgeIRB(rej, 'revise').ethicsPenalty], [true, true, false]);
});

test('leaderboard sorts by score, then XP, then earlier date, and filters by seed', () => {
  let lb = [];
  lb = L.insertEntry(lb, L.makeEntry({ name: 'Ayesha', seed: 's1', xp: 500, score: 70, date: '2026-01-02' }));
  lb = L.insertEntry(lb, L.makeEntry({ name: 'Bilal', seed: 's1', xp: 900, score: 70, date: '2026-01-03' }));
  lb = L.insertEntry(lb, L.makeEntry({ name: 'Sana', seed: 's1', xp: 100, score: 88, date: '2026-01-04' }));
  lb = L.insertEntry(lb, L.makeEntry({ name: 'Other', seed: 's2', xp: 999, score: 99 }));
  lb = L.insertEntry(lb, L.makeEntry({ name: 'Tie', seed: 's1', xp: 900, score: 70, date: '2026-01-01' }));
  const s1 = L.leaderboardFor(lb, 's1');
  assert.deepEqual(s1.map((e) => e.name), ['Sana', 'Tie', 'Bilal', 'Ayesha']);
  assert.equal(s1[0].rank, 1); assert.equal(s1[0].grade, 'A');
  assert.equal(L.leaderboardFor(lb, 's2').length, 1);
  let big = [];
  for (let i = 0; i < 30; i++) big = L.insertEntry(big, L.makeEntry({ name: 'p' + i, seed: 'x', score: i }), 20);
  assert.equal(big.length, 20); assert.equal(big[0].score, 29);
  assert.equal(L.makeEntry({ name: '<script>', seed: 1 }).name, 'script');
});

test('every dilemma id is reachable through pickDilemma (any zone, any week)', () => {
  assert.ok(dilemmas.length >= 56);
  for (const [zone, week] of [['library', 2], ['clinic', 16], ['courtyard', 1], [null, 8]]) {
    const seen = {}; let i = 0;
    const rng = (() => { let k = 0; return () => ((k++ * 0.37) % 1); })();
    while (Object.keys(seen).length < dilemmas.length && i++ < 500) {
      const d = L.pickDilemma(dilemmas, { week, zone, seen, rng });
      seen[d.id] = { at: String(i).padStart(4, '0') };
    }
    assert.equal(Object.keys(seen).length, dilemmas.length, `zone ${zone}`);
    assert.ok(L.pickDilemma(dilemmas, { week, zone, seen }), 'cycles once all seen');
  }
  for (const d of dilemmas) { assert.equal(d.options.length, 3, d.id); assert.ok(d.options.some((o) => !o.ethicsPenalty), d.id + ' has an ethical option'); }
});

test('every IRB proposal id is reachable through pickIRB and has a valid answer', () => {
  assert.ok(irb.length >= 15);
  const judged = {};
  for (let i = 0; i < irb.length; i++) { const p = L.pickIRB(irb, judged); judged[p.id] = Object.assign(L.judgeIRB(p, p.correct), { at: String(i).padStart(3, '0') }); }
  assert.equal(Object.keys(judged).length, irb.length);
  assert.ok(irb.every((p) => ['approve', 'revise', 'reject'].includes(p.correct) && p.reasons.length && p.codes.length));
  judged[irb[3].id].correct = false;
  assert.equal(L.pickIRB(irb, judged).id, irb[3].id, 'incorrectly judged proposals come back first');
});

test('badges: rule badges fire on thresholds and are not re-awarded', () => {
  const s = L.newStats();
  for (let i = 0; i < 5; i++) L.tally(s, 'debrief:shown', { paradigm: 'asch' });
  for (let i = 0; i < 3; i++) L.tally(s, 'replication:run', { finding: 'f' });
  L.tally(s, 'builder:save', { design: { preregistered: true } });
  const got = L.evaluateBadges(s, {}, []);
  for (const b of ['debrief_champion', 'replicator', 'preregistered']) assert.ok(got.includes(b), b);
  assert.ok(!L.evaluateBadges(s, {}, got).includes('replicator'));
  assert.equal(L.badgeName('debrief_champion'), 'Debrief Champion');
  assert.equal(L.badgeName('ethics_guardian'), 'Ethics Guardian');
});

test('director never interrupts experiments, modals, tours or journeys; respects cooldown', () => {
  const base = { now: 1e6, last: 0, cooldownMs: 1000 };
  assert.ok(L.canInterrupt(base));
  for (const k of ['experiment', 'modal', 'journey', 'tour']) assert.equal(L.canInterrupt(Object.assign({}, base, { [k]: true })), false, k);
  assert.equal(L.canInterrupt(Object.assign({}, base, { mode: 'participant' })), false);
  assert.equal(L.canInterrupt({ now: 500, last: 0, cooldownMs: 1000 }), false);
  assert.ok(L.CONFOUNDS.every((c) => c.options[c.answer]));
});

test('tour has ≥32 beats and the journey has exactly 12 steps; simulated class is seeded', () => {
  assert.ok(tour.length >= 32);
  assert.ok(tour.every((b) => b.id && b.zone && b.title && b.text && ['aerial', 'front', 'inside', 'exhibit'].includes(b.view)));
  assert.equal(L.JOURNEY_STEPS.length, 12);
  assert.deepEqual(L.JOURNEY_STEPS.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(L.simulatedClass('a'), L.simulatedClass('a'));
  assert.notDeepEqual(L.simulatedClass('a'), L.simulatedClass('b'));
  const sum = L.classSummary(L.simulatedClass('a', 200));
  assert.ok(Math.abs(sum.stroop_ms.mean - 95) < 10);
  assert.notEqual(L.anonymiseId('P-123'), 'P-123');
  assert.equal(L.anonymiseId('P-123'), L.anonymiseId('P-123'));
});
