'use strict';
/**
 * Missions (A9). Listens to every bus event ('*'), advances objectives
 * (src/data/missions.json: {event, where, count}), stores sim.state.missions[id] = {done, progress[]},
 * unlocks the elective tracks once the 16 core missions are done, emits 'mission:complete' {id}
 * and 'badge:earned' {id}, toasts and adds XP.
 *
 *   const missions = new Missions(sim)       // sim.services.missions
 *   missions.list() → [{ mission, state, unlocked, fraction }]
 *   missions.active() → first unfinished unlocked core mission for the current week
 *   missions.electivesUnlocked()
 *   missions.unlockElectives()                // instructor override (Settings)
 *   missions.render(container)                // used by the Missions panel
 */
const L = require('./logic.js');
const { h, btn, toast } = require('../ui/dom.js');

class Missions {
  constructor(sim) {
    this.sim = sim;
    this.defs = sim.data.missions || [];
    this.byId = new Map(this.defs.map((m) => [m.id, m]));
    this._ensure();
    this._wasUnlocked = this.electivesUnlocked();
    this.offs = [
      sim.bus.on('*', (p, e) => this.onEvent(e, p)),
      sim.bus.on('state:restored', () => { this._ensure(); this._wasUnlocked = this.electivesUnlocked(); }),
    ];
  }

  _ensure() {
    const st = this.sim.state;
    if (!st.missions || typeof st.missions !== 'object') st.missions = {};
    for (const m of this.defs) {
      const cur = st.missions[m.id];
      if (!cur || !Array.isArray(cur.progress)) st.missions[m.id] = L.newMissionState(m);
      else while (cur.progress.length < m.objectives.length) cur.progress.push(0);
    }
  }

  electivesUnlocked() {
    const e = this.defs.find((m) => !L.isCore(m));
    return !!e && L.isUnlocked(e, this.sim.state.missions, this.defs, this.sim.state.electivesOverride);
  }

  unlockElectives() { this.sim.state.electivesOverride = true; this._checkUnlock(); }

  onEvent(event, payload) {
    if (L.SELF_EVENTS.has(event)) return;
    const st = this.sim.state.missions;
    const completed = [];
    for (const m of this.defs) {
      if (!L.isUnlocked(m, st, this.defs, this.sim.state.electivesOverride)) continue;
      const r = L.applyEvent(m, st[m.id], event, payload);
      if (r.changed) this.sim.bus.emit('mission:progress', { id: m.id, fraction: L.fraction(m, st[m.id]) });
      if (r.completed) completed.push(m);
    }
    for (const m of completed) this.complete(m);
    if (completed.length) this._checkUnlock();
  }

  complete(m) {
    const ms = this.sim.state.missions[m.id];
    ms.done = true; ms.at = new Date().toISOString();
    this.sim.bus.emit('mission:complete', { id: m.id });
    try { toast(`✅ Mission complete: ${m.title} (+${m.xp} XP)`); } catch (e) { /* no DOM */ }
    this.sim.addXP(m.xp, 'Mission ' + m.id);
    if (m.badge) {
      const sc = this.sim.services.scoring;
      if (sc && sc.award) sc.award(m.badge, m.title);
      else if (!this.sim.state.badges.includes(m.badge)) { this.sim.state.badges.push(m.badge); this.sim.bus.emit('badge:earned', { id: m.badge }); }
    }
    if (this.sim.services.audio && this.sim.services.audio.ui) try { this.sim.services.audio.ui('success'); } catch (e) { /* optional */ }
  }

  _checkUnlock() {
    const now = this.electivesUnlocked();
    if (now && !this._wasUnlocked) {
      this.sim.bus.emit('missions:unlocked', { track: 'electives' });
      try { toast('🎓 Elective tracks unlocked: Clinical, Cognitive Neuroscience, Developmental, Educational, Forensic, Health, I-O.', 6000); } catch (e) { /* no DOM */ }
    }
    this._wasUnlocked = now;
  }

  list() {
    const st = this.sim.state.missions;
    return this.defs.map((m) => ({ mission: m, state: st[m.id], unlocked: L.isUnlocked(m, st, this.defs, this.sim.state.electivesOverride), fraction: L.fraction(m, st[m.id]) }));
  }

  active() {
    const wk = this.sim.state.week || 1;
    const open = this.list().filter((x) => x.unlocked && !x.state.done);
    return (open.find((x) => x.mission.week === wk) || open.find((x) => L.isCore(x.mission)) || open[0] || {}).mission || null;
  }

  /** Mission board UI (for the Missions panel). */
  render(container) {
    const sim = this.sim;
    const wrap = h('div', { class: 'zg-missions' });
    const items = this.list();
    const core = items.filter((x) => L.isCore(x.mission));
    const done = core.filter((x) => x.state.done).length;
    wrap.appendChild(h('p', null, `Core missions: ${done}/${core.length}. `, this.electivesUnlocked() ? h('span', { class: 'badge badge-ok' }, 'Electives unlocked') : h('span', { class: 'note' }, 'Elective tracks unlock after all 16 core missions.')));
    const card = (x) => {
      const m = x.mission;
      const pctv = Math.round(x.fraction * 100);
      return h('div', { class: 'card', style: m.week === sim.state.week ? { outline: '2px solid #F59E0B' } : null },
        h('h4', null, `${m.id} — ${m.title}`, x.state.done ? h('span', { class: 'badge badge-ok' }, 'done') : null, !x.unlocked ? h('span', { class: 'badge' }, 'locked') : null),
        h('div', { class: 'row' }, h('span', { class: 'tag apa' }, 'APA ' + m.apa), m.week ? h('span', { class: 'tag' }, 'Week ' + m.week) : h('span', { class: 'tag dom' }, m.track), h('span', { class: 'tag' }, m.xp + ' XP'), m.badge ? h('span', { class: 'tag' }, '🏅 ' + L.badgeName(m.badge)) : null),
        h('p', null, m.brief),
        h('ul', null, m.objectives.map((o, i) => { const n = Math.min(o.count, x.state.progress[i] || 0); return h('li', null, (n >= o.count ? '✔ ' : '○ ') + o.text + (o.count > 1 ? ` (${n}/${o.count})` : '')); })),
        h('div', { class: 'progress', role: 'progressbar', 'aria-label': m.title + ' progress', 'aria-valuenow': pctv, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: pctv + '%' } })));
    };
    wrap.appendChild(h('h3', null, 'Semester campaign — Run a Research Programme'));
    wrap.appendChild(h('div', { class: 'grid2' }, core.map(card)));
    const tracks = {};
    items.filter((x) => !L.isCore(x.mission)).forEach((x) => { (tracks[x.mission.track] = tracks[x.mission.track] || []).push(x); });
    wrap.appendChild(h('h3', null, 'Specialisation electives'));
    for (const t of Object.keys(tracks)) {
      wrap.appendChild(h('h4', null, t.charAt(0).toUpperCase() + t.slice(1) + ' track'));
      wrap.appendChild(h('div', { class: 'grid2' }, tracks[t].map(card)));
    }
    if (!this.electivesUnlocked()) wrap.appendChild(h('div', { class: 'row' }, btn('Instructor: unlock electives now', () => { this.unlockElectives(); wrap.replaceWith(this.render()); }, 'ghost')));
    if (container) container.appendChild(wrap);
    return wrap;
  }

  dispose() { this.offs.forEach((f) => f()); }
}

module.exports = { Missions };
