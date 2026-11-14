'use strict';
/** Crisis detector (G14): ≥30 crisis phrases → 0 false negatives; clearly neutral phrases → not flagged. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { detect } = require('../src/ai/crisis.js');

const CRISIS = [
  // suicide — direct
  ['I want to kill myself', 'suicide'],
  ['i am suicidal', 'suicide'],
  ["I've been thinking about suicide a lot lately", 'suicide'],
  ['I want to end my life', 'suicide'],
  ['I wish I was dead', 'suicide'],
  ['honestly I just want to die', 'suicide'],
  ['I am planning to take my own life tonight', 'suicide'],
  // suicide — indirect
  ["I don't want to be here anymore", 'suicide'],
  ['everyone would be better off without me', 'suicide'],
  ["I can't go on like this anymore", 'suicide'],
  ['there is no reason to live', 'suicide'],
  ['nobody would miss me if i was gone', 'suicide'],
  ["I'm going to end it all", 'suicide'],
  ['I want to go to sleep and never wake up', 'suicide'],
  ['this is my goodbye note to everyone', 'suicide'],
  ['I took all my pills', 'suicide'],
  ['what is the most painless way to die', 'suicide'],
  ['I feel so hopeless', 'suicide'],
  ['i want to k1ll mys3lf', 'suicide'],
  // romanised Urdu + Urdu script
  ['main khudkushi karna chahta hoon', 'suicide'],
  ['mera mar jana chahta hoon', 'suicide'],
  ['main mar jana chahti hoon', 'suicide'],
  ['ab jeena nahi chahta', 'suicide'],
  ['main apni jaan le lun ga', 'suicide'],
  ['zindagi khatam karna chahta hoon', 'suicide'],
  ['میں خودکشی کرنا چاہتا ہوں', 'suicide'],
  ['میں مرنا چاہتی ہوں', 'suicide'],
  ['میں جینا نہیں چاہتا', 'suicide'],
  // self-harm
  ['I cut myself again last night', 'self-harm'],
  ['I keep hurting myself when I am stressed', 'self-harm'],
  ['I have been self-harming', 'self-harm'],
  ['i have urges to cut', 'self-harm'],
  ['main khud ko nuqsan pohanchata hoon', 'self-harm'],
  ['میں خود کو نقصان پہنچاتی ہوں', 'self-harm'],
  // abuse
  ['my father beats me', 'abuse'],
  ['my uncle touches me and I feel scared', 'abuse'],
  ['I was sexually abused as a child', 'abuse'],
  ["I don't feel safe at home", 'abuse'],
  ['my husband hits me every night', 'abuse'],
  ['ghar mein mehfooz nahi hoon, abbu mujhe roz maarte hain', 'abuse'],
  ['mere saath ziyadti hui', 'abuse'],
  ['شوہر مجھے مارتا ہے', 'abuse'],
  // harm to others
  ['I am going to kill him', 'harm-others'],
  ['i want to shoot up the school', 'harm-others'],
  ['main usay jaan se maar dunga', 'harm-others'],
];

const NEUTRAL = [
  'what is the stroop effect',
  'kill the music',
  'kill the process and restart the run',
  'this neuron dies after the stimulus',
  'explain classical conditioning',
  'how do I compute a t-test',
  'take me to the neuro atrium',
  'what is cronbach alpha',
  'open the memory lab',
  'define working memory',
  "I'm dying to know how the Ames room works",
  'can you critique my design',
  'what does d prime mean',
  'show me the serial position curve',
  'assalam o alaikum raahi',
  'cut the outliers from my reaction times',
  'shoot a photo in tour mode',
  'thank you, that was helpful',
  'who was Wilhelm Wundt',
];

test(`crisis detector: ${CRISIS.length} crisis phrases, 0 false negatives (G14)`, () => {
  assert.ok(CRISIS.length >= 30);
  const missed = CRISIS.filter(([p]) => !detect(p).crisis).map(([p]) => p);
  assert.deepEqual(missed, [], 'false negatives: ' + missed.join(' | '));
});

test('crisis detector assigns the expected category', () => {
  for (const [p, cat] of CRISIS) assert.equal(detect(p).category, cat, p + ' → ' + JSON.stringify(detect(p)));
});

test(`crisis detector: ${NEUTRAL.length} clearly neutral phrases are not flagged`, () => {
  assert.ok(NEUTRAL.length >= 15);
  const fp = NEUTRAL.filter((p) => detect(p).crisis).map((p) => p + ' → ' + detect(p).matched);
  assert.deepEqual(fp, []);
});

test('result shape and empty input', () => {
  assert.deepEqual(detect(''), { crisis: false, category: null, matched: null });
  assert.deepEqual(detect(null), { crisis: false, category: null, matched: null });
  const r = detect('I want to die');
  assert.equal(r.crisis, true); assert.equal(typeof r.matched, 'string');
});

test('negation is never allowed to hide a hedged disclosure', () => {
  assert.equal(detect("I'm not suicidal but sometimes I want to die").crisis, true);
  assert.equal(detect("I'm not suicidal, but lately I think about suicide").crisis, true);
  assert.equal(detect("I'm not suicidal").crisis, false); // explicit, unhedged reassurance
});

test('academic third-person mention is not flagged; first-person mention is', () => {
  assert.equal(detect("Durkheim's theory of suicide rates").crisis, false);
  assert.equal(detect('I keep thinking about suicide').crisis, true);
  assert.equal(detect('suicide').crisis, true); // bare word with no context: prefer safety
});
