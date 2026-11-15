'use strict';
/** Panel module registry (A0). Each file exports [{id, render(body, api)}]. A failing module is skipped (logged), never fatal. */
const load = (fn, name) => { try { return fn(); } catch (e) { console.warn('[ZEHN] panel module failed: ' + name, e); return []; } };
module.exports = [
  load(() => require('./course.js'), 'course'),
  load(() => require('./foundations.js'), 'foundations'),   // history, perspectives, methods, irb, stats
  load(() => require('./brain.js'), 'brain'),               // bio, brain, sleep, sensation, sdt, illusions, attention
  load(() => require('./thinking.js'), 'thinking'),         // learning, memory, eyewitness, cognition, intelligence
  load(() => require('./lifespan.js'), 'lifespan'),         // development, emotion, health, personality, psychometrics
  load(() => require('./practice_a.js'), 'practice_a'),     // social, io, psychopathology
  load(() => require('./practice_b.js'), 'practice_b'),     // therapy, crosscultural, positive, replication
  load(() => require('./system.js'), 'system'),             // builder, export, report, cases, missions, quiz, aiethics, present, settings
];
