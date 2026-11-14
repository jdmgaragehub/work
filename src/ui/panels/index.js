'use strict';
/** Panel module registry (A0). Each file exports [{id, render(body, api)}]. */
module.exports = [
  require('./course.js'),
  require('./foundations.js'),   // history, perspectives, methods, irb, stats
  require('./brain.js'),         // bio, brain, sleep, sensation, sdt, illusions, attention
  require('./thinking.js'),      // learning, memory, eyewitness, cognition, intelligence
  require('./lifespan.js'),      // development, emotion, health, personality, psychometrics
  require('./practice_a.js'),    // social, io, psychopathology
  require('./practice_b.js'),    // therapy, crosscultural, positive, replication
  require('./system.js'),        // builder, export, report, cases, missions, quiz, aiethics, present, settings
];
