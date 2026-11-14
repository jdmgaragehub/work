'use strict';
/**
 * Licence linter (§1 rule 5, G14): banned instrument names must not appear in ITEM/STIMULUS text
 * (IPIP items, client dialogue, paradigm stimulus files), and no DSM/ICD criteria text anywhere in data.
 * Mentions in teaching prose (quiz explanations, glossary, panels) are allowed — reproduction is not.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BANNED = /\b(WAIS|WISC|Stanford[–-]Binet|MMPI|Rorschach plate|TAT card|BDI-?II|Beck Depression Inventory|NEO-PI-R|MBTI|Myers[–-]Briggs|Raven'?s (Progressive )?Matrices|Ishihara plate)\b/i;
const CRITERIA = /(Criterion [A-E][.:]|DSM-5(-TR)? criteria (are|include)\s*:|five \(or more\) of the following)/i;
const root = path.join(__dirname, '..');
test('IPIP item text contains no banned instrument content', () => {
  for (const it of require('../src/data/ipip.json').items) assert.ok(!BANNED.test(it.text), it.text);
});
test('client dialogue contains no banned instrument items or criteria text', () => {
  const s = fs.readFileSync(path.join(root, 'src/data/clients.json'), 'utf8');
  assert.ok(!BANNED.test(s), 'banned instrument in clients'); assert.ok(!CRITERIA.test(s), 'criteria text in clients');
});
test('PHQ-9/GAD-7 appear only as simulated client scores (no item text shipped)', () => {
  const s = fs.readFileSync(path.join(root, 'src/data/clients.json'), 'utf8');
  assert.ok(!/little interest or pleasure in doing things/i.test(s)); assert.ok(!/feeling nervous, anxious,? or on edge/i.test(s));
});
test('paradigm stimulus files contain no banned instrument content', () => {
  const dir = path.join(root, 'src/exp/paradigms');
  for (const f of fs.readdirSync(dir)) { const s = fs.readFileSync(path.join(dir, f), 'utf8'); const m = s.match(BANNED); assert.ok(!m, f + ': ' + (m && m[0])); }
});
test('no DSM/ICD criteria text in any data file', () => {
  const dir = path.join(root, 'src/data');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json'))) assert.ok(!CRITERIA.test(fs.readFileSync(path.join(dir, f), 'utf8')), f);
});
test('three.js MIT header kept in vendor', () => { assert.match(fs.readFileSync(path.join(root, 'vendor/three.r160.raw.js'), 'utf8').slice(0, 600), /MIT License/); });
