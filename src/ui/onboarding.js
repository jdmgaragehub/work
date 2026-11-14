'use strict';
/** 60-second onboarding (§8): role, difficulty, seed, accessibility quick-set, content-warning preferences. */
const { h, modal } = require('./dom.js');

function radio(name, opts, value) {
  return h('div', { class: 'opts', role: 'radiogroup' }, opts.map(([v, label]) => h('label', null, h('input', { type: 'radio', name, value: v, checked: v === value }), ' ' + label)));
}
function check(name, label, on) { return h('label', null, h('input', { type: 'checkbox', name, checked: !!on }), ' ' + label); }

async function onboarding(sim, { force = false } = {}) {
  if (!force && sim.store.getPref('onboarded', false)) return false;
  const s = sim.settings;
  const body = h('form', { class: 'onb', onsubmit: (e) => e.preventDefault() },
    h('p', null, 'Welcome to ', h('b', null, 'ZEHN'), ' — a psychology lab in 3D at the ', h('b', null, 'Indus Institute of Behavioural Sciences'), ' (a ', h('i', null, 'simulated'), ' institution). You will run real timed experiments on yourself, study simulated participants, analyse data, face an ethics board and counsel simulated clients.'),
    h('fieldset', null, h('legend', null, 'I am a…'), radio('role', [['student', 'Student'], ['instructor', 'Instructor']], sim.state.role)),
    h('fieldset', null, h('legend', null, 'Difficulty'), radio('difficulty', [['foundation', 'Foundation (hints on)'], ['bachelor', 'Bachelor'], ['honours', 'Honours (fewer hints, more confounds)']], sim.state.difficulty)),
    h('fieldset', null, h('legend', null, 'Seed (same seed = same simulated participants)'), h('input', { type: 'text', name: 'seed', value: sim.seed, 'aria-label': 'Seed' })),
    h('fieldset', null, h('legend', null, 'Accessibility'), h('div', { class: 'opts' },
      check('reducedMotion', 'Reduced motion', s.reducedMotion), check('dyslexia', 'Dyslexia-friendly spacing', s.dyslexia), check('cbSafe', 'Colour-blind-safe palette', s.cbSafe),
      check('captions', 'Captions', s.captions), check('photosafe', 'Photosensitive-safe (no flicker)', s.photosafe), check('conference', 'Conference / projector mode', s.conference))),
    h('fieldset', null, h('legend', null, 'Sensitive topics — before modules on these, ZEHN will…'),
      ...['suicide', 'self-harm', 'abuse', 'trauma', 'obedience', 'prison'].map((t) => h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', margin: '3px 0' } }, h('span', { style: { minWidth: '90px' } }, t),
        h('select', { name: 'cw-' + t, 'aria-label': 'Content preference for ' + t }, [['ask', 'ask me first'], ['show', 'show it'], ['skip', 'use text-only path']].map(([v, l]) => h('option', { value: v, selected: s.contentWarnings[t] === v }, l)))))),
    h('p', { class: 'note' }, 'Your data never leaves this device. ZEHN never diagnoses you; questionnaires are for learning only. Crisis resources are always in Settings.'),
  );
  const ok = await modal({ title: 'Set up your lab (about 60 seconds)', body, actions: [{ label: 'Use defaults', value: 'default', cls: 'ghost' }, { label: 'Enter the campus', value: 'go' }], dismissable: false });
  if (ok === 'go') {
    const f = new FormData(body);
    sim.state.role = f.get('role') || 'student';
    sim.state.difficulty = f.get('difficulty') || 'bachelor';
    const seed = String(f.get('seed') || '').trim();
    if (seed && seed !== sim.seed) { sim.store.setPref('seed', seed); sim.seed = seed; sim.rng = new (require('../core/rng.js').Rng)(seed); }
    for (const k of ['reducedMotion', 'dyslexia', 'cbSafe', 'captions', 'photosafe', 'conference']) s[k] = f.get(k) === 'on';
    for (const t of Object.keys(s.contentWarnings)) s.contentWarnings[t] = f.get('cw-' + t) || 'ask';
  }
  sim.store.setPref('role', sim.state.role); sim.store.setPref('difficulty', sim.state.difficulty); sim.store.setPref('onboarded', true);
  sim.saveSettings();
  sim.bus.emit('settings:changed', {});
  return true;
}

module.exports = { onboarding };
