'use strict';
/** Paradigm registry (A8): all paradigm groups. Count is checked by test/paradigms.test.js and tools/count.mjs (G3). */
const groups = [
  require('./paradigms/attention_core.js'),
  require('./paradigms/perception.js'),
  require('./paradigms/attention.js'),
  require('./paradigms/memory.js'),
  require('./paradigms/learning.js'),
  require('./paradigms/cognition.js'),
  require('./paradigms/social.js'),
];
function register(sim) { for (const g of groups) for (const spec of g) sim.registry.paradigms.set(spec.id, spec); return sim.registry.paradigms; }
module.exports = { register, all: () => groups.flat() };
