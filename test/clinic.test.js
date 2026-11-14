'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/clinic/engine.js');
const clients = require('../src/data/clients.json');

/** Play a session choosing with `pick(node, engine) → index`. */
function play(client, pick) {
  const e = new E.SessionEngine(client);
  let guard = 0;
  while (!e.done) { e.choose(pick(e.node, e)); assert.ok(++guard <= E.MAX_TURNS, `${client.id} exceeded ${E.MAX_TURNS} turns`); }
  return e;
}
const best = (c) => play(c, (n) => E.bestIndex(n));
const worst = (c) => play(c, (n) => E.worstIndex(n));

/** Enumerate every path (option sequence) through a client. */
function allPaths(client) {
  const out = [];
  const walk = (prefix) => {
    const e = new E.SessionEngine(client);
    for (const i of prefix) e.choose(i);
    if (e.done) { out.push(e); return; }
    e.node.options.forEach((_, i) => walk(prefix.concat(i)));
  };
  walk([]);
  return out;
}

test('clients: at least 20 and schema-valid', () => {
  assert.ok(clients.length >= 20, `only ${clients.length} clients`);
  const v = E.validateClients(clients);
  assert.deepEqual(v.errors, []);
  assert.equal(v.ok, true);
});

test('validateClients catches broken data', () => {
  const bad = JSON.parse(JSON.stringify(clients[0]));
  bad.nodes.n1.options[0].next = 'nope';
  bad.nodes.n1.options[1].score = 9;
  const loop = JSON.parse(JSON.stringify(clients[1]));
  loop.nodes[loop.start].options[0].next = loop.start;
  const v = E.validateClients([bad, loop]);
  assert.equal(v.ok, false);
  assert.ok(v.errors.some((x) => /dangling/.test(x)));
  assert.ok(v.errors.some((x) => /score/.test(x)));
  assert.ok(v.errors.some((x) => /cycle/.test(x)));
});

test('every client loads and every path terminates within 10 turns', () => {
  for (const c of clients) {
    const e = new E.SessionEngine(c);
    assert.ok(e.node && e.node.client, c.id);
    const paths = allPaths(c);
    assert.ok(paths.length >= 3, c.id);
    for (const p of paths) {
      assert.ok(p.done && p.transcript.length <= E.MAX_TURNS, `${c.id} path len ${p.transcript.length}`);
      const s = p.summary();
      assert.ok(s.total <= s.max, `${c.id} total ${s.total} > max ${s.max}`);
      for (const k of ['empathy', 'unconditionalRegard', 'congruence']) assert.ok(s.rogers[k] >= 0 && s.rogers[k] <= 1);
      assert.ok(s.strengths.length >= 1 && s.growth.length >= 1);
    }
  }
});

test('all-best path scores higher than all-worst, and reaches max', () => {
  for (const c of clients) {
    const b = best(c).summary(), w = worst(c).summary();
    assert.ok(b.total > w.total, `${c.id}: best ${b.total} <= worst ${w.total}`);
    assert.equal(b.total, b.max, `${c.id} greedy best should be optimal`);
    assert.ok(b.rogers.empathy > w.rogers.empathy, c.id + ' empathy');
    assert.ok(b.rogers.unconditionalRegard >= w.rogers.unconditionalRegard, c.id + ' regard');
  }
});

test('choose() returns feedback/skill/score and OARS counts add up', () => {
  const c = clients[0];
  const e = new E.SessionEngine(c);
  const r = e.choose(E.bestIndex(e.node));
  assert.equal(typeof r.feedback, 'string');
  assert.ok(E.SKILLS.includes(r.skill));
  assert.equal(typeof r.score, 'number');
  while (!e.done) e.choose(0);
  assert.throws(() => e.choose(0));
  const s = e.summary();
  assert.equal(s.oars.reflect, s.bySkill['reflect-simple'] + s.bySkill['reflect-complex']);
  const sum = E.SKILLS.reduce((a, k) => a + s.bySkill[k], 0);
  assert.equal(sum, s.turns);
});

test('affect drifts up with good replies and down with poor ones', () => {
  for (const c of clients) {
    const b = best(c), w = worst(c);
    assert.deepEqual(b.affectAt(0), w.affectAt(0));
    assert.ok(b.affectAt(b.transcript.length).valence > b.affectAt(0).valence, c.id + ' best valence up');
    assert.ok(w.affectAt(w.transcript.length).valence < w.affectAt(0).valence, c.id + ' worst valence down');
    assert.ok(w.affectAt(w.transcript.length).arousal >= w.affectAt(0).arousal, c.id + ' worst arousal up');
    const a = b.affectAt(99);
    assert.ok(a.valence >= -1 && a.valence <= 1 && a.arousal >= 0 && a.arousal <= 1);
  }
});

test('risk clients flag riskHandled only when the risk option is chosen', () => {
  const risk = clients.filter(E.isRiskClient);
  assert.ok(risk.length >= 3, 'need several risk clients');
  for (const id of ['C03', 'C12', 'C23']) assert.ok(risk.some((c) => c.id === id), id + ' should be a risk client');
  for (const c of risk) {
    const b = best(c).summary();
    assert.equal(b.riskCase, true);
    assert.equal(b.riskHandled, true, c.id + ' best path handles risk');
    // best everywhere except never pick the direct risk question
    const avoid = play(c, (n) => {
      const idx = n.options.map((o, i) => i).filter((i) => !E.isRiskAsk(n.options[i]));
      return idx.reduce((a, i) => (n.options[i].score > n.options[a].score ? i : a), idx[0]);
    }).summary();
    assert.equal(avoid.riskAsked, false, c.id);
    assert.equal(avoid.riskHandled, false, c.id + ' must not flag risk handled without the risk option');
    assert.ok(avoid.growth.some((g) => /risk/i.test(g)), c.id + ' growth mentions missed risk');
    // exhaustive: riskHandled implies the risk option was chosen
    for (const p of allPaths(c)) {
      const s = p.summary();
      if (s.riskHandled) assert.ok(p.transcript.some((x) => x.riskAsk), c.id + ' handled without ask');
    }
  }
  for (const c of clients.filter((x) => !E.isRiskClient(x))) {
    const s = best(c).summary();
    assert.equal(s.riskCase, false);
    assert.equal(s.riskHandled, false);
  }
});

test('screener totals are for simulated clients and labelled not-a-diagnosis', () => {
  const c = clients.find((x) => x.id === 'C03');
  const t = E.screenerTotals(c);
  assert.equal(t.phq9.total, 17);
  assert.equal(t.phq9.max, 27);
  assert.equal(t.gad7, null);
  assert.match(t.note, /not diagnoses/);
});

test('engine module is pure (no DOM access)', () => {
  const src = require('node:fs').readFileSync(require.resolve('../src/clinic/engine.js'), 'utf8');
  assert.ok(!/\b(document|window|localStorage)\b/.test(src));
});
