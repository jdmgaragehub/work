'use strict';
/**
 * The shared `sim` object (docs/ARCHITECTURE.md §1). Created once in main.js.
 */
const { EventBus } = require('./bus.js');
const { Rng } = require('./rng.js');
const facts = require('./facts.js');
const store = require('./store.js');

function readParams() {
  try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); }
}

function createSim() {
  const params = readParams();
  const seed = params.get('seed') || store.getPref('seed', 'iibs-2026');
  const data = {
    facts: require('../data/facts.json'),
    quiz: require('../data/quiz.json'),
    glossary: require('../data/glossary.json'),
    intents: require('../data/intents.json'),
    dilemmas: require('../data/dilemmas.json'),
    irb: require('../data/irb.json'),
    clients: require('../data/clients.json'),
    cases: require('../data/cases.json'),
    missions: require('../data/missions.json'),
    tour: require('../data/tour.json'),
    course: require('../data/course.json'),
    ipip: require('../data/ipip.json'),
  };
  facts.load(data.facts);
  const sim = {
    params,
    seed,
    rng: new Rng(seed),
    bus: new EventBus(),
    data,
    facts,
    store,
    clock: { speed: 1, paused: false, t0: performance.now(), now() { return performance.now() - this.t0; } },
    state: {
      mode: 'walk', zone: 'courtyard', week: 1, difficulty: store.getPref('difficulty', 'bachelor'), role: store.getPref('role', 'student'),
      xp: 0, level: 1, badges: [], consentLog: [], quiz: {}, irb: {}, dilemmas: {}, clinic: {}, missions: {}, journey: {}, scorecard: { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0 },
      ethicsPenalty: 0, panelsOpened: {}, paradigmsRun: {}, pid: store.getPref('pid', null), session: 1, timeOfDay: 'day', designs: [], leaderboard: [],
    },
    settings: Object.assign({
      quality: params.get('quality') || 'auto', reducedMotion: false, photosafe: false, dyslexia: false, cbSafe: false, captions: true,
      lang: 'en', conference: false, emotionGrade: false, contentWarnings: { suicide: 'ask', abuse: 'ask', trauma: 'ask', obedience: 'ask', prison: 'ask', 'self-harm': 'ask' },
      toggles: { taa: true, motionBlur: true, ssao: true, bloom: true, godrays: true, ssr: true, dof: true, lensflare: true, grain: true, vignette: true, chroma: true, autoExposure: true, volumetric: true, sss: true },
      audio: true, volume: 0.6, mouseSens: 1, invertY: false,
    }, store.getPref('settings', {})),
    datasets: {},
    registry: { panels: new Map(), paradigms: new Map() },
    services: {}, // filled by main: ui, runner, world, ai, audio, director ...
  };
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches && store.getPref('settings', null) == null) sim.settings.reducedMotion = true;
  if (!sim.state.pid) { sim.state.pid = 'P-' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'); store.setPref('pid', sim.state.pid); }
  sim.saveSettings = () => store.setPref('settings', sim.settings);
  sim.snapshot = () => ({ v: 1, seed: sim.seed, state: sim.state, settings: sim.settings, datasets: sim.datasets, savedAt: new Date().toISOString() });
  sim.restore = (snap) => {
    if (!snap || snap.v !== 1) return false;
    Object.assign(sim.state, snap.state); Object.assign(sim.settings, snap.settings); sim.datasets = snap.datasets || {};
    sim.bus.emit('state:restored', {});
    return true;
  };
  sim.addXP = (n, why) => {
    sim.state.xp += n;
    const lvl = 1 + Math.floor(Math.sqrt(sim.state.xp / 120));
    if (lvl > sim.state.level) { sim.state.level = lvl; sim.bus.emit('level:up', { level: lvl }); }
    sim.bus.emit('xp:gain', { n, why });
  };
  return sim;
}

module.exports = { createSim };
