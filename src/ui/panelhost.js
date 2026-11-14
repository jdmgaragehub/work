'use strict';
/**
 * Panel host (A6): the right-hand drawer + left rails. Panel modules are listed in
 * src/ui/panels/index.js; each exports [{id, render(body, api), onClose?}]. Contract: docs/PANEL_API.md.
 */
const dom = require('./dom.js');
const { h } = dom;
const { PANELS, RAILS, byId } = require('./panels/meta.js');
const charts = require('./charts.js');
const format = require('../core/format.js');

function buildApi(sim, host) {
  const factsMod = sim.facts;
  return Object.assign({}, dom, {
    sim, charts, format, apa: format.apa,
    stats: require('../psych/stats.js'), dist: require('../psych/dist.js'), psychometrics: require('../psych/psychometrics.js'),
    sdt: require('../psych/sdt.js'), psychophysics: require('../psych/psychophysics.js'), learning: require('../psych/learning.js'),
    neuron: require('../psych/neuron.js'), participants: require('../psych/participants.js'), timeline: require('../exp/core/timeline.js'),
    face2d: require('../people/face2d.js'), Rng: require('../core/rng.js').Rng,
    fact: (id) => factsMod.get(id), factBadge: (id) => factsMod.badge(factsMod.get(id)), factCite: (id) => factsMod.cite(id),
    /** Render a fact sentence: claim + value + badges + source (the only way panels state study numbers). */
    factLine(id) {
      const f = factsMod.get(id);
      if (!f) return h('p', { class: 'note', html: `[fact ${format.esc(id)} not in facts.json]` });
      return h('p', { class: 'fact', html: `${format.esc(f.claim)}${f.confidence === 'verified' || f.confidence === 'disputed' ? ': <b>' + format.esc(f.value) + '</b>' : ''} ${factsMod.badge(f)} <span class="note">— ${format.esc(f.source)}</span>${f.caveat ? `<br><span class="note">Caveat: ${format.esc(f.caveat)}</span>` : ''}` });
    },
    simLabel: (txt = 'Simulated data') => h('span', { class: 'sim-label' }, txt),
    openPanel: (id) => host.open(id),
    runParadigm: (id, opts) => sim.services.runner.run(id, opts || {}),
    paradigms: () => Array.from(sim.registry.paradigms.values()),
    paradigm: (id) => sim.registry.paradigms.get(id),
    goZone: (z) => sim.services.world && sim.services.world.teleport(z),
    setMode: (m) => sim.services.controls && sim.services.controls.setMode(m),
    emit: (e, p) => sim.bus.emit(e, p),
    glossary: (term) => sim.data.glossary.find((g) => g.term.toLowerCase() === String(term).toLowerCase()),
    service: (name) => sim.services[name] || null,
  });
}

class PanelHost {
  constructor(sim, root) {
    this.sim = sim;
    this.current = null;
    this.modules = new Map();
    for (const group of require('./panels/index.js')) for (const p of group) this.modules.set(p.id, p);
    this.api = buildApi(sim, this);
    this.drawer = h('aside', { class: 'drawer', hidden: true, 'aria-label': 'Dashboard panel', role: 'region' });
    this.rail = h('nav', { class: 'rail', 'aria-label': 'Dashboard panels' });
    for (const r of RAILS) {
      const g = h('div', { class: 'rail-group', role: 'group', 'aria-label': r.title }, h('span', null, r.title.split(' ')[0]));
      for (const p of PANELS.filter((x) => x.rail === r.id)) {
        g.appendChild(h('button', { type: 'button', 'data-panel': p.id, title: `${p.title} (week ${p.week})`, 'aria-label': p.title, onclick: () => this.toggle(p.id) }, h('span', { class: 'ic', 'aria-hidden': 'true' }, p.icon), p.title.split(/[ &(]/)[0]));
      }
      this.rail.appendChild(g);
    }
    root.appendChild(this.rail);
    root.appendChild(this.drawer);
    sim.registry.panels = this.modules;
  }

  toggle(id) { if (this.current === id) this.close(); else this.open(id); }

  open(id) {
    const meta = byId(id);
    const mod = this.modules.get(id);
    if (!meta || !mod) { dom.toast('Panel not found: ' + id); return; }
    if (this.current && this.modules.get(this.current) && this.modules.get(this.current).onClose) try { this.modules.get(this.current).onClose(); } catch (e) { /* ignore */ }
    this.current = id;
    const ur = this.sim.settings.lang === 'ur' && meta.ur ? h('span', { lang: 'ur', dir: 'rtl', style: { marginLeft: '8px', color: '#fde68a' } }, meta.ur) : null;
    const body = h('div', { class: 'body', tabindex: '0' });
    this.drawer.innerHTML = '';
    this.drawer.appendChild(h('header', null,
      h('div', { style: { flex: 1 } }, h('h2', { id: 'panel-title' }, meta.icon + ' ' + meta.title, ur),
        h('div', { class: 'tags' }, h('span', { class: 'tag apa', title: 'APA Guidelines 3.0 outcome' }, 'APA ' + meta.apa), h('span', { class: 'tag dom', title: 'BPS domain' }, meta.domain === '—' ? 'Skills' : meta.domain), h('span', { class: 'tag hec', title: 'HEC 2025 course' }, 'HEC ' + meta.hec), h('span', { class: 'tag wk' }, meta.week === 'all' || meta.week === '—' ? 'All weeks' : 'Week ' + meta.week))),
      h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Close panel', onclick: () => this.close() }, '✕')));
    this.drawer.appendChild(body);
    this.drawer.setAttribute('aria-labelledby', 'panel-title');
    this.drawer.hidden = false;
    for (const b of this.rail.querySelectorAll('button')) b.setAttribute('aria-current', String(b.dataset.panel === id));
    try { mod.render(body, this.api); } catch (err) { body.appendChild(h('p', { class: 'note' }, 'This panel hit an error: ' + err.message)); console.error(err); }
    this.sim.state.panelsOpened[id] = (this.sim.state.panelsOpened[id] || 0) + 1;
    this.sim.bus.emit('panel:open', { id });
    if (this.sim.services.audio) this.sim.services.audio.ui('open');
  }

  close() {
    if (this.current && this.modules.get(this.current) && this.modules.get(this.current).onClose) try { this.modules.get(this.current).onClose(); } catch (e) { /* ignore */ }
    this.current = null; this.drawer.hidden = true; this.drawer.innerHTML = '';
    for (const b of this.rail.querySelectorAll('button')) b.setAttribute('aria-current', 'false');
  }
}

module.exports = { PanelHost, buildApi };
