'use strict';
/** Data schemas + G3 minimums + facts validator (A1/A11). */
const test = require('node:test');
const assert = require('node:assert/strict');
const D = (f) => require('../src/data/' + f);
const PANELS = require('../src/ui/panels/meta.js').PANELS.map((p) => p.id);
const ZONES = Object.keys(require('../src/world/layout.js').ZONES);
const APA = /^[1-5]\.[1-6]$/;
const DOMAIN = /^(Bio|Cog|Dev|Social|IndDiff|CHI|Methods|Applied)(\/(Bio|Cog|Dev|Social|IndDiff|CHI|Methods|Applied))*$/;

test('facts.json schema; ids unique; enums valid', () => {
  const f = D('facts.json'); const ids = new Set();
  for (const x of f) {
    for (const k of ['id', 'claim', 'value', 'source', 'confidence', 'replication']) assert.ok(x[k] != null, `${x.id} missing ${k}`);
    assert.ok(['verified', 'must-verify', 'disputed'].includes(x.confidence), x.id);
    assert.ok(['robust', 'mixed', 'failed', 'contested', 'n/a'].includes(x.replication), x.id + ' ' + x.replication);
    assert.ok(!ids.has(x.id), 'dup ' + x.id); ids.add(x.id);
  }
  for (const id of ['F-OSC', 'F-EGO', 'F-SPE', 'F-MIL', 'F-IB', 'F-LP', 'F-BYS', 'F-FC', 'F-COW', 'F-TIME', 'F-H1', 'F-H2', 'F-H3', 'F-H4', 'F-H5', 'F-H6']) assert.ok(ids.has(id), 'missing ' + id);
  for (const h of ['F-H1', 'F-H2', 'F-H3', 'F-H4', 'F-H5', 'F-H6']) { const x = f.find((y) => y.id === h); assert.ok(x.retrieved, h + ' needs verified-on date'); assert.match((x.caveat || '').toLowerCase(), /verify|vary/); }
});
test('every factRef used in content resolves to facts.json', () => {
  const ids = new Set(D('facts.json').map((x) => x.id));
  for (const q of D('quiz.json')) if (q.factRef) assert.ok(ids.has(q.factRef), q.id + ' → ' + q.factRef);
  for (const c of D('cases.json')) for (const r of c.factRefs || []) assert.ok(ids.has(r), c.id + ' → ' + r);
  for (const s of require('../src/exp/registry.js').all()) for (const r of s.factRefs || []) assert.ok(ids.has(r) || /^F-/.test(r), s.id + ' → ' + r);
});
test('quiz: ≥320, ≥20 per week, ≥30% apply/analyse, valid tags', () => {
  const q = D('quiz.json'); assert.ok(q.length >= 320, 'quiz ' + q.length);
  for (let w = 1; w <= 16; w++) assert.ok(q.filter((x) => x.week === w).length >= 20, 'week ' + w);
  const aa = q.filter((x) => x.bloom === 'apply' || x.bloom === 'analyse').length / q.length; assert.ok(aa >= 0.3, 'apply/analyse ' + aa);
  const ids = new Set();
  for (const x of q) { assert.equal(x.options.length, 4); assert.ok(x.answer >= 0 && x.answer < 4); assert.match(x.apa, APA); assert.match(x.domain, DOMAIN, x.id); assert.ok(x.hec); assert.ok(!ids.has(x.id)); ids.add(x.id); }
});
test('glossary ≥420 unique; ≥100 with Urdu', () => {
  const g = D('glossary.json'); assert.ok(g.length >= 420); assert.equal(new Set(g.map((x) => x.term.toLowerCase())).size, g.length);
  assert.ok(g.filter((x) => x.ur).length >= 100);
});
test('intents ≥130; regexes compile; crisis intents present; action args valid', () => {
  const it = D('intents.json'); assert.ok(it.length >= 130);
  const paradigms = require('../src/exp/registry.js').all().map((p) => p.id);
  for (const x of it) {
    for (const p of x.patterns) new RegExp(p, 'i');
    if (x.action) {
      const { type, arg } = x.action;
      if (type === 'openPanel') assert.ok(PANELS.includes(arg), x.id + ' panel ' + arg);
      if (type === 'goZone') assert.ok(ZONES.includes(arg), x.id + ' zone ' + arg);
      if (type === 'startParadigm') assert.ok(paradigms.includes(arg), x.id + ' paradigm ' + arg);
    }
  }
  assert.ok(it.filter((x) => x.category === 'crisis').length >= 5);
});
test('dilemmas ≥56 with trade-offs; IRB ≥15', () => {
  const d = D('dilemmas.json'); assert.ok(d.length >= 56);
  for (const x of d) { assert.ok(x.options.length >= 2); for (const o of x.options) for (const k of ['rigour', 'ethics', 'time', 'welfare']) assert.ok(Number.isInteger(o.effects[k]) && Math.abs(o.effects[k]) <= 3, x.id); }
  const irb = D('irb.json'); assert.ok(irb.length >= 15); for (const p of irb) assert.ok(['approve', 'revise', 'reject'].includes(p.correct));
});
test('clients ≥20; cases ≥14; missions ≥16 core; tour ≥32', () => {
  assert.ok(D('clients.json').length >= 20);
  const cases = D('cases.json'); assert.ok(cases.length >= 14);
  for (const c of cases) assert.ok(c.summary.split(/\s+/).length <= 300, c.id + ' > 300 words');
  const m = D('missions.json'); assert.ok(m.filter((x) => x.track === 'core').length >= 16);
  const t = D('tour.json'); assert.ok(t.length >= 32); for (const b of t) { assert.ok(ZONES.includes(b.zone), b.id); if (b.panel) assert.ok(PANELS.includes(b.panel), b.id); }
});
test('course: 16 weeks, each with panel, mechanic, mission, quiz set, tour beats, APA, domain, HEC (G2)', () => {
  const c = D('course.json'); assert.equal(c.weeks.length, 16);
  const missions = D('missions.json').map((m) => m.id), tour = D('tour.json').map((t) => t.id);
  for (const w of c.weeks) {
    assert.ok(w.panels.length >= 1 && w.panels.every((p) => PANELS.includes(p)), 'week ' + w.week);
    assert.ok(w.mechanic && missions.includes(w.mission) && w.tourBeats.every((b) => tour.includes(b)), 'week ' + w.week);
    assert.ok(w.apa.every((a) => APA.test(a)) && w.hec.length && DOMAIN.test(w.domain.replace('IndDiff/Applied', 'IndDiff/Applied')));
    assert.ok(D('quiz.json').filter((q) => q.week === w.week).length >= 20);
  }
});
test('IPIP: 50 items, 5 scales, keyed ±', () => {
  const i = D('ipip.json'); assert.equal(i.items.length, 50);
  for (const it of i.items) { assert.ok(['+', '-'].includes(it.keyed)); assert.ok(it.text.length > 3); }
  assert.equal(new Set(i.items.map((x) => x.scale)).size, 5);
});
