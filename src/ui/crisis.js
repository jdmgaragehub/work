'use strict';
/**
 * Crisis-resource card (§1 rule 4, §7 rail 3). Always reachable from Settings; auto-shown by the
 * crisis detector. Numbers come ONLY from facts.json (F-H1..F-H6) with "hours may vary — verify".
 */
const { h, modal } = require('./dom.js');
const { esc } = require('../core/format.js');

function showCrisis(sim, { source = 'manual' } = {}) {
  const ids = ['F-H4', 'F-H1', 'F-H2', 'F-H3', 'F-H5', 'F-H6'];
  const rows = ids.map((id) => sim.facts.get(id)).filter(Boolean);
  const body = h('div', null,
    h('p', null, 'If you are in danger or thinking about harming yourself, please reach out now. You deserve support, and talking to someone can help.'),
    h('p', null, h('b', null, 'Immediate danger in Pakistan: '), 'call emergency services (see the first row below).'),
    h('table', { class: 't' }, h('thead', null, h('tr', null, h('th', null, 'Service'), h('th', null, 'Contact'), h('th', null, 'Notes'))),
      h('tbody', null, rows.map((f) => h('tr', null,
        h('td', { html: esc(f.claim) }),
        h('td', { html: `<b>${esc(f.value)}</b>` }),
        h('td', { html: `${esc(f.caveat || 'Hours may vary — verify before calling.')} <span class="note">(source: ${esc(f.source)}; checked ${esc(f.retrieved || '')}${f.confidence !== 'verified' ? '; status: verify before relying on it' : ''})</span>` })))),
    ),
    h('p', { class: 'note' }, 'Hours may vary — verify. ZEHN is a learning game; RAAHI is an AI tutor, not a counsellor or therapist, and cannot help in an emergency. Nothing you type leaves this device.'),
  );
  sim.bus.emit('crisis:shown', { source });
  return modal({ title: 'Support is available', body, cls: 'crisis', actions: [{ label: 'Pause the game', value: 'pause' }, { label: 'Close', value: 'close' }] }).then((v) => {
    if (v === 'pause') { sim.clock.paused = true; if (sim.services.engine) sim.services.engine.setExperimentMode(true); document.body.classList.add('paused'); modal({ title: 'Game paused', body: '<p>Take all the time you need. The crisis resources stay available in Settings.</p>', actions: [{ label: 'Resume', value: true }] }).then(() => { sim.clock.paused = false; if (sim.services.engine) sim.services.engine.setExperimentMode(false); document.body.classList.remove('paused'); }); }
    return v;
  });
}

module.exports = { showCrisis };
