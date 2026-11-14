'use strict';
/** RAAHI offline engine (A7): intents, ranking, glossary, refusals, advice cards. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { IntentEngine, adviseDesign, PRIORITY } = require('../src/ai/engine.js');
const intents = require('../src/data/intents.json');
const glossary = require('../src/data/glossary.json');
const facts = require('../src/data/facts.json');

const eng = new IntentEngine({ intents, glossary, facts });

test('≥130 intents load and every pattern compiles', () => {
  assert.ok(eng.size >= 130, 'loaded ' + eng.size);
  assert.equal(eng.size, intents.length);
});

test('glossary has ≥420 terms and lookup is case/possessive/hyphen-insensitive', () => {
  assert.ok(glossary.length >= 420);
  assert.equal(eng.lookup('stroop effect').term, 'Stroop effect');
  assert.equal(eng.lookup('CRONBACH ALPHA').term, "Cronbach's alpha");
  assert.equal(eng.lookup('t test').term, 't-test');
  assert.equal(eng.lookup('zzzz-not-a-term'), null);
});

test('glossary queries: "what is X", "define X", romanised Urdu "X kya hai"', () => {
  assert.equal(eng.glossaryQuery('What is the Stroop effect?').entry.term, 'Stroop effect');
  assert.equal(eng.glossaryQuery('define working memory').entry.term, 'Working memory');
  assert.equal(eng.glossaryQuery('working memory kya hai').entry.term, 'Working memory');
  const r = eng.respond('what is the stroop effect');
  assert.equal(r.kind, 'glossary');
  assert.match(r.text, /^Stroop effect: /);
});

test('crisis outranks everything (category priority)', () => {
  const ranked = eng.match('what is the stroop effect, I want to kill myself');
  assert.equal(ranked[0].category, 'crisis');
  const r = eng.respond('I want to kill myself');
  assert.equal(r.kind, 'crisis');
  assert.deepEqual(r.action, { type: 'showCrisis' });
  assert.ok(PRIORITY.crisis > PRIORITY.safety && PRIORITY.safety > PRIORITY.nav && PRIORITY.nav > PRIORITY.stats && PRIORITY.stats > PRIORITY.concept);
});

test('ranking: results sorted by score, specific stats intent beats generic one', () => {
  const ranked = eng.match('how do I run an independent-samples t-test');
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].score >= ranked[i].score);
  assert.equal(ranked[0].id, 's_t_ind');
});

test('ranking: safety outranks concept when both match', () => {
  const ranked = eng.match('do I have depression? explain depression');
  assert.equal(ranked[0].category, 'safety');
});

test('current week boosts matching intents', () => {
  const t = 'explain introspection and classical conditioning';
  const w1 = eng.match(t, { week: 1 }).find((r) => r.id === 'i_structuralism');
  const w8 = eng.match(t, { week: 8 }).find((r) => r.id === 'i_structuralism');
  assert.ok(w1 && w8 && w1.score > w8.score);
});

test('navigation: zone and panel intents carry actions; generic "open X" resolves panels', () => {
  assert.deepEqual(eng.respond('take me to the neuro atrium').action, { type: 'goZone', arg: 'neuro' });
  assert.deepEqual(eng.respond('open the memory lab').action, { type: 'openPanel', arg: 'memory' });
});

test('refusal: copyrighted test items (MMPI, WAIS, Rorschach, Raven, BDI, MBTI)', () => {
  for (const q of ['give me the MMPI items', 'show me the Rorschach plates', 'list the WAIS-IV questions', "can I take Raven's progressive matrices here", 'send the BDI-II questions', 'give me the MBTI questions and scoring key']) {
    const r = eng.refusal(q);
    assert.ok(r && r.kind === 'copyright', q);
  }
});

test('refusal: DSM/ICD criteria text', () => {
  const r = eng.respond('show me the DSM-5 criteria for major depression');
  assert.equal(r.kind, 'refusal'); assert.equal(r.refusal, 'dsm');
  assert.match(r.text, /official manuals/);
});

test('refusal: diagnosis requests → not a diagnosis, AI tutor not a therapist', () => {
  for (const q of ['diagnose me', 'do I have ADHD?', 'am I depressed', "what's wrong with me"]) {
    const r = eng.respond(q);
    assert.equal(r.kind, 'refusal', q); assert.equal(r.refusal, 'diagnosis', q);
    assert.match(r.text, /AI tutor, not a psychologist or therapist/);
  }
  assert.equal(eng.respond('be my therapist').refusal, 'therapy');
});

test('"compute it for me" → coach to try first in the Statistics Workbench', () => {
  const r = eng.respond('calculate the anova for me');
  assert.equal(r.refusal, 'coach');
  assert.deepEqual(r.action, { type: 'openPanel', arg: 'stats' });
  assert.match(r.text, /Statistics Workbench/);
});

test('advice: within-subjects design without counterbalancing → Latin square one-click', () => {
  const cards = adviseDesign({ name: 'Stroop', within: true, conditions: ['congruent', 'incongruent', 'neutral'], counterbalance: 'none', n: 60, consent: true });
  const c = cards.find((x) => x.id === 'counterbalance');
  assert.ok(c);
  assert.equal(c.severity, 'high');
  assert.deepEqual(c.oneClickAction.type, 'applyDesignFix');
  assert.deepEqual(c.oneClickAction.arg, { counterbalance: 'latin' });
  assert.match(c.impact, /6 condition orders/); // odd n=3 → Williams 2n rows
  for (const k of ['severity', 'title', 'why', 'recommendation', 'impact', 'oneClickAction']) assert.ok(c[k], k);
});

test('advice: small n → power card with required N; adequate n → no power card', () => {
  const small = adviseDesign({ within: false, conditions: ['a', 'b'], n: 20, expectedD: 0.5, randomAssignment: true, consent: true });
  const p = small.find((x) => x.id === 'power');
  assert.ok(p); assert.equal(p.severity, 'high');
  assert.equal(p.oneClickAction.arg.n, 2 * require('../src/psych/stats.js').nForPower(0.5)); // per-group n × 2 groups
  const big = adviseDesign({ within: false, conditions: ['a', 'b'], n: 200, expectedD: 0.5, randomAssignment: true, consent: true });
  assert.ok(!big.some((x) => x.id === 'power'));
});

test('advice: deception without debrief, confound, no random assignment; ranked by severity', () => {
  const cards = adviseDesign({ within: false, conditions: ['a', 'b'], n: 200, deception: true, debrief: false, confounds: ['time of day'], randomAssignment: false, practice: 0 });
  const ids = cards.map((c) => c.id);
  assert.ok(ids.includes('debrief')); assert.ok(ids.includes('random-assign')); assert.ok(ids.some((i) => i.startsWith('confound-')));
  assert.deepEqual(cards.find((c) => c.id === 'debrief').oneClickAction.arg, { debrief: true });
  const rank = { high: 3, medium: 2, low: 1 };
  for (let i = 1; i < cards.length; i++) assert.ok(rank[cards[i - 1].severity] >= rank[cards[i].severity]);
  assert.equal(cards[cards.length - 1].severity, 'low');
});

test('respond("critique my design") with a design in context returns advice cards', () => {
  const r = eng.respond('critique my design', { design: { within: true, conditions: ['c', 'i'], n: 10 } });
  assert.equal(r.kind, 'advice');
  assert.ok(r.cards.length >= 2);
});

test('unknown input → helpful fallback, never empty', () => {
  const r = eng.respond('qwrtzp blorf');
  assert.equal(r.kind, 'fallback');
  assert.ok(r.text.length > 20);
  assert.deepEqual(eng.match(''), []);
});

test('pure module: engine and crisis never touch the DOM', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  const src = require('fs').readFileSync(require.resolve('../src/ai/engine.js'), 'utf8') + require('fs').readFileSync(require.resolve('../src/ai/crisis.js'), 'utf8');
  assert.ok(!/\bdocument\.|\bwindow\./.test(src));
});
