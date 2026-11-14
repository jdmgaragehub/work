'use strict';
/** Panel 1 — Course Map (exemplar panel, A6). Week grid, progress, links to zones/missions/paradigms + whole-degree map. */
module.exports = [{
  id: 'course',
  render(body, api) {
    const { h, btn, sim } = api;
    const C = sim.data.course;
    body.appendChild(h('p', null, C.title + '. ', h('span', { class: 'note' }, C.note)));
    const wkDone = (w) => {
      const m = sim.state.missions[w.mission];
      const runs = w.paradigms.filter((p) => sim.state.paradigmsRun[p]).length;
      const opened = w.panels.filter((p) => sim.state.panelsOpened[p]).length;
      const quiz = sim.data.quiz.filter((q) => q.week === w.week && sim.state.quiz[q.id] && sim.state.quiz[q.id].correct).length;
      const parts = [m && m.done ? 1 : 0, w.paradigms.length ? runs / w.paradigms.length : 1, opened / w.panels.length, Math.min(1, quiz / 10)];
      return parts.reduce((a, b) => a + b, 0) / parts.length;
    };
    const grid = h('div', { class: 'grid2' });
    for (const w of C.weeks) {
      const pct = Math.round(100 * wkDone(w));
      grid.appendChild(h('div', { class: 'card', style: sim.state.week === w.week ? { outline: '2px solid #F59E0B' } : null },
        h('h4', null, `Week ${w.week} — ${w.topic}`),
        h('div', { class: 'row' }, ...w.apa.map((a) => h('span', { class: 'tag apa' }, 'APA ' + a)), h('span', { class: 'tag dom' }, w.domain)),
        h('p', { class: 'note' }, w.openstax.join(' · ')),
        h('p', null, h('b', null, '3D: '), w.mechanic),
        h('p', { class: 'note' }, 'HEC: ' + w.hec.join('; ')),
        h('div', { class: 'progress', 'aria-label': `Week ${w.week} progress ${pct}%`, role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: pct + '%' } })),
        h('div', { class: 'row' },
          btn('Go to zone', () => { api.goZone(w.zone); sim.state.week = w.week; sim.bus.emit('week:set', { week: w.week }); }, 'teal'),
          ...w.panels.slice(0, 2).map((p) => btn('Open ' + p, () => api.openPanel(p))),
          btn('Mission: ' + w.missionTitle, () => api.openPanel('missions'), 'ghost'),
          btn('Set as current week', () => { sim.state.week = w.week; sim.bus.emit('week:set', { week: w.week }); api.toast('Current week: ' + w.week); api.openPanel('course'); }, 'ghost'))));
    }
    body.appendChild(h('h3', null, '16-week plan'));
    body.appendChild(grid);
    body.appendChild(h('h3', null, 'Whole-degree map (HEC 2025 model scheme → ZEHN)'));
    body.appendChild(api.table(['Semester', 'HEC major courses', 'ZEHN coverage'], C.degree.map((d) => [d.semester, d.courses.join('; '), d.coverage])));
    body.appendChild(h('p', null, 'Specialisation elective tracks (unlock after week 16): ' + C.specialisations.join(', ') + '. ', btn('Open elective missions', () => api.openPanel('missions'), 'ghost')));
    body.appendChild(h('h3', null, 'APA Guidelines 3.0 outcomes'));
    body.appendChild(api.table(['Outcome', 'Short paraphrase'], Object.entries(C.apaOutcomes).map(([k, v]) => ['APA ' + k, v])));
    body.appendChild(api.factLine('F-APA'));
    body.appendChild(api.factLine('F-HEC1'));
  },
}];
