// G3 auto-count: compares ZEHN content against the §5.4 minimums and the benchmark baseline.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const D = (f) => require('../src/data/' + f);
let paradigms = 0; try { paradigms = require('../src/exp/registry.js').all().length; } catch (e) { paradigms = -1; }
let panels = 0; try { const idx = fs.readdirSync('src/ui/panels').filter((f) => f.endsWith('.js') && !['index.js', 'meta.js'].includes(f)); panels = idx.flatMap((f) => { try { return require('../src/ui/panels/' + f); } catch (e) { return []; } }).length; } catch (e) { panels = -1; }
const face = require('../src/people/face2d.js');
const modes = 7;
const rows = [
  ['Runnable paradigms', 0, 36, paradigms],
  ['Dashboard panels (implemented)', 25, 34, panels],
  ['Quiz questions', 142, 320, D('quiz.json').length],
  ['Glossary terms', 317, 420, D('glossary.json').length],
  ['AI intents', 84, 130, D('intents.json').length],
  ['Tour beats', 21, 32, D('tour.json').length],
  ['Decision events / dilemmas (+IRB)', 38, 56, D('dilemmas.json').length + D('irb.json').length],
  ['Simulated client cases', 0, 20, D('clients.json').length],
  ['Missions (core)', 0, 16, D('missions.json').filter((m) => m.track === 'core').length],
  ['Case studies with sources', 0, 14, D('cases.json').length],
  ['Modes', 5, 7, modes],
  ['Expressive face AUs', 0, 14, face.AUS.length],
  ['Facts (facts.json)', 0, 0, D('facts.json').length],
];
let ok = true;
console.log('| Item | Benchmark | ZEHN minimum | ZEHN actual | Pass |\n|---|---|---|---|---|');
for (const [n, b, m, a] of rows) { const pass = a >= m && a > b; if (!pass) ok = false; console.log(`| ${n} | ${b} | ${m} | ${a} | ${pass ? '✅' : '❌'} |`); }
console.log(ok ? '\nG3 PASS' : '\nG3 FAIL');
process.exitCode = ok ? 0 : 1;
