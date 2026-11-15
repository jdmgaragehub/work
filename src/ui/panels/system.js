'use strict';
/**
 * Panels 31–39 (A6c, System rail): builder, export, report, cases, missions, quiz, aiethics, present, settings.
 * Contract: docs/PANEL_API.md. Bus events: docs/ARCHITECTURE.md §3. Generated data is labelled "Simulated data";
 * study numbers appear only through api.factLine / api.fact.
 */

// ------------------------------------------------------------------ shared helpers
const paras = (api, list) => list.map((t) => api.h('p', { html: t }));
const isNum = (v) => v !== '' && v != null && Number.isFinite(+v);
const fmt0 = (v) => (Number.isFinite(v) ? v.toFixed(0) : '—');
const fmt2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : '—');

function glossRow(api, terms) {
  const out = api.h('p', { class: 'note', 'aria-live': 'polite' });
  const row = api.h('div', { class: 'row', role: 'group', 'aria-label': 'Glossary terms' }, api.h('span', { class: 'note' }, 'Glossary:'));
  for (const t of terms) {
    const g = api.glossary(t);
    if (!g) continue;
    row.appendChild(api.btn(g.term, () => {
      const ur = api.sim.settings.lang === 'ur' && g.ur ? ` <span lang="ur" dir="rtl">(${api.esc(g.ur)})</span>` : '';
      out.innerHTML = `<b>${api.esc(g.term)}</b>${ur}: ${api.esc(g.def)}`;
      api.emit('glossary:lookup', { term: g.term });
    }, 'ghost'));
  }
  return api.h('div', null, row, out);
}
function factLines(api, ids) {
  return ids.filter((id) => api.fact(id)).map((id) => {
    const f = api.fact(id);
    if (/instructor to add/i.test(f.source)) return api.h('p', { class: 'note' }, `[${id}] ${f.claim} — figure withheld until an instructor adds a verified source.`);
    return api.factLine(id);
  });
}
function textInput(api, label, value) {
  const t = api.h('input', { type: 'text', 'aria-label': label, value: value == null ? '' : String(value) });
  return { el: api.h('label', { class: 'f' }, label, t), input: t };
}
function numInput(api, label, value, min, max, onChange) {
  const t = api.h('input', { type: 'number', 'aria-label': label, min, max, value: String(value), onchange: () => { const v = Math.max(min, Math.min(max, Math.round(+t.value || min))); t.value = v; onChange(v); } });
  return api.h('label', { class: 'f' }, label, t);
}
function textarea(api, label, value, rows = 2) {
  const t = api.h('textarea', { 'aria-label': label, rows });
  t.value = value || '';
  return { el: api.h('label', { class: 'f' }, label, t), input: t };
}
function checkbox(api, label, checked, onChange) {
  return api.h('label', { style: { display: 'block' } }, api.h('input', { type: 'checkbox', checked: !!checked, onchange: (e) => onChange(e.target.checked) }), ' ' + label);
}
const datasetKeys = (sim) => Object.keys(sim.datasets || {}).filter((k) => Array.isArray(sim.datasets[k]) && sim.datasets[k].length);
const paradigmOf = (key) => String(key).split(':')[0];
const isSimKey = (key) => /:(sim|bot)$/.test(key);
function datasetLabel(api, key) {
  const spec = api.paradigm(paradigmOf(key));
  const tag = /:sim$/.test(key) ? ' — Simulated data' : /:bot$/.test(key) ? ' — bot run (Simulated)' : ' — your own runs';
  return (spec ? spec.title : paradigmOf(key)) + tag + ` (${api.sim.datasets[key].length} rows)`;
}

/**
 * Pick a sensible analysis for a set of trial rows: per-participant means when ≥3 participants
 * (paired t / one-way ANOVA), trial-level tests otherwise (Welch t / ANOVA / χ²), plus secondary χ² and r.
 */
function analyseRows(api, rows) {
  const S = api.stats, A = api.apa;
  const main = rows.filter((r) => r.block !== 'practice' && r.block !== 'check');
  const conds = [...new Set(main.map((r) => String(r.condition)).filter((c) => c !== ''))];
  const pids = [...new Set(main.map((r) => r.pid))];
  const hasRT = main.some((r) => isNum(r.rt_ms));
  const hasCorrect = main.some((r) => String(r.correct) === '1' || String(r.correct) === '0');
  const resp = main.filter((r) => r.response !== '' && r.response != null);
  const numericResp = resp.length > 0 && resp.every((r) => isNum(r.response));
  const dv = hasRT ? 'rt' : numericResp ? 'response' : hasCorrect ? 'accuracy' : null;
  const dvLabel = { rt: hasCorrect ? 'mean response time on correct trials (ms)' : 'mean response time (ms)', response: 'mean response value', accuracy: 'proportion correct' }[dv] || 'no analysable dependent variable';
  const value = (r) => {
    if (dv === 'rt') return (hasCorrect && String(r.correct) !== '1') || !isNum(r.rt_ms) ? null : +r.rt_ms;
    if (dv === 'response') return isNum(r.response) ? +r.response : null;
    if (dv === 'accuracy') return String(r.correct) === '1' ? 1 : String(r.correct) === '0' ? 0 : null;
    return null;
  };
  const keys = conds.length ? conds : ['all trials'];
  const inC = (r, c) => !conds.length || String(r.condition) === c;
  const design = pids.length >= 3 ? 'participants' : 'trials';
  const groups = {};
  if (design === 'participants') {
    const perP = {};
    for (const c of keys) perP[c] = pids.map((p) => { const v = main.filter((r) => r.pid === p && inC(r, c)).map(value).filter((x) => x != null); return v.length ? S.mean(v) : NaN; });
    const complete = pids.map((_, i) => i).filter((i) => keys.every((c) => Number.isFinite(perP[c][i])));
    for (const c of keys) groups[c] = complete.map((i) => perP[c][i]);
  } else for (const c of keys) groups[c] = main.filter((r) => inC(r, c)).map(value).filter((x) => x != null);
  const desc = keys.map((c) => { const g = groups[c]; const m = g.length ? S.mean(g) : NaN; const sd = g.length > 1 ? S.sd(g) : NaN; return { cond: c, n: g.length, m, sd, se: g.length > 1 ? sd / Math.sqrt(g.length) : 0 }; });
  const tests = [];
  const ok = (v) => Number.isFinite(v);
  const g = keys.map((c) => groups[c]);
  const enough = g.every((x) => x.length >= 2);
  if (dv && keys.length >= 2 && enough) {
    if (dv === 'accuracy' && design === 'trials') {
      const table = keys.map((c) => { const v = groups[c]; const k = v.filter((x) => x === 1).length; return [k, v.length - k]; });
      if (table.every((r) => r[0] + r[1] > 0) && [0, 1].every((j) => table.some((r) => r[j] > 0))) {
        const r = S.chi2Independence(table);
        if (ok(r.chi2)) tests.push({ kind: 'chi2', name: 'χ² test of independence (condition × correct)', res: r, str: A.chi2(r) + `, Cramér's V = ${A.noLead(r.cramersV)}` });
      }
    } else if (keys.length === 2) {
      if (design === 'participants') { const r = S.tPaired(g[0], g[1]); if (ok(r.t)) tests.push({ kind: 't_paired', name: `Paired-samples t test on participant means (${keys[0]} vs ${keys[1]})`, res: r, str: A.t(r) }); }
      else { const r = S.tIndependent(g[0], g[1], { welch: true }); if (ok(r.t)) tests.push({ kind: 't_ind', name: `Welch t test on trials (${keys[0]} vs ${keys[1]}); illustrative — trials from one person are not independent participants`, res: r, str: A.t(r) }); }
    } else {
      const r = S.anova1(g);
      if (ok(r.F)) tests.push({ kind: 'anova', name: design === 'participants' ? 'One-way ANOVA on participant means (treats conditions as independent groups; a repeated-measures ANOVA would be more powerful)' : 'One-way ANOVA on trials (illustrative)', res: r, str: A.F(r) });
    }
  }
  if (dv === 'rt' && hasCorrect && keys.length >= 2) {
    const table = keys.map((c) => { const v = main.filter((r) => inC(r, c) && (String(r.correct) === '1' || String(r.correct) === '0')); const k = v.filter((r) => String(r.correct) === '1').length; return [k, v.length - k]; });
    if (table.every((r) => r[0] + r[1] > 0) && [0, 1].every((j) => table.some((r) => r[j] > 0))) {
      const r = S.chi2Independence(table);
      if (ok(r.chi2)) tests.push({ kind: 'chi2', name: 'Secondary: accuracy by condition (χ² on trials)', res: r, str: A.chi2(r) });
    }
  }
  if (pids.length >= 5 && hasRT && hasCorrect) {
    const rt = [], acc = [];
    for (const p of pids) {
      const pr = main.filter((r) => r.pid === p);
      const c = pr.filter((r) => String(r.correct) === '1' && isNum(r.rt_ms)).map((r) => +r.rt_ms);
      const a = pr.filter((r) => String(r.correct) === '1' || String(r.correct) === '0');
      if (c.length && a.length) { rt.push(S.mean(c)); acc.push(a.filter((r) => String(r.correct) === '1').length / a.length); }
    }
    if (rt.length >= 5 && S.sd(acc) > 0 && S.sd(rt) > 0) { const r = S.pearson(rt, acc); if (ok(r.r)) tests.push({ kind: 'corr', name: 'Secondary: speed–accuracy correlation across participants (mean RT vs accuracy)', res: r, str: A.r(r) }); }
  }
  return { main, conds: keys, pids, dv, dvLabel, design, desc, tests, nTrials: main.length };
}
function analysisChart(api, an, label) {
  const groups = an.desc.filter((d) => Number.isFinite(d.m)).map((d) => ({ name: d.cond.length > 14 ? d.cond.slice(0, 13) + '…' : d.cond, value: +d.m.toFixed(an.dv === 'accuracy' ? 3 : 1), err: Number.isFinite(d.se) ? d.se : 0 }));
  if (!groups.length) return null;
  return api.charts.bar(groups, { label: label + ' (error bars = ±1 SE)', yl: an.dv === 'rt' ? 'ms' : an.dv === 'accuracy' ? 'proportion' : 'value', W: 560 });
}

// ------------------------------------------------------------------ 31 builder
function probeSpec(api, spec) {
  let trials = [];
  try { trials = spec.buildTrials(new api.Rng('probe:' + spec.id), { quick: true, trials: 24 }) || []; } catch (e) { trials = []; }
  const conds = [...new Set(trials.map((t) => String(t.condition == null ? '' : t.condition)).filter((c) => c !== ''))];
  const phases = [...new Set(trials.map((t) => t.block || 'main'))];
  return { conds, phased: phases.some((b) => b !== 'main'), n: trials.length };
}

function constrainedShuffle(rng, arr, maxRun = 3) {
  for (let a = 0; a < 200; a++) {
    const s = rng.shuffle(arr);
    let run = 1, good = true;
    for (let i = 1; i < s.length && good; i++) { run = String(s[i].condition) === String(s[i - 1].condition) ? run + 1 : 1; if (run > maxRun) good = false; }
    if (good) return s;
  }
  return rng.shuffle(arr);
}

/** Build one simulated participant's timeline under the design. */
function buildDesignTimeline(api, spec, d, prng, pIndex, info) {
  const total = d.trialsPerBlock * d.blocks;
  let main = (spec.buildTrials(prng.fork('main'), { trials: total, quick: false, photosafe: true }) || []).map((t) => Object.assign({ block: t.block || 'main' }, t)).slice(0, total);
  if (!info.phased) {
    if (d.counterbalance === 'latin' && info.conds.length > 1) {
      const sq = api.timeline.latinSquare(info.conds.length);
      const order = sq[pIndex % sq.length].map((k) => info.conds[k]);
      const rank = (t) => { const i = order.indexOf(String(t.condition)); return i < 0 ? order.length : i; };
      main = main.map((t, i) => ({ t, i })).sort((a, b) => rank(a.t) - rank(b.t) || a.i - b.i).map((x) => x.t);
    } else if (d.randomise === 'shuffle') {
      const per = Math.ceil(main.length / d.blocks); const out = [];
      for (let b = 0; b < d.blocks; b++) out.push(...prng.shuffle(main.slice(b * per, (b + 1) * per)));
      main = out;
    } else if (d.randomise === 'constrained') main = constrainedShuffle(prng, main, 3);
  }
  const out = [];
  if (d.practice > 0) {
    const prac = (spec.buildTrials(prng.fork('practice'), { practice: true, quick: true, photosafe: true }) || []).slice(0, d.practice);
    for (const p of prac) out.push(Object.assign({}, p, { block: 'practice' }));
  }
  out.push(...main);
  if (spec.attentionCheck) for (let i = 0; i < d.checks; i++) {
    const at = (d.practice || 0) + Math.floor(prng.uniform(0.2, 0.95) * main.length);
    out.splice(at, 0, Object.assign({ block: 'check' }, spec.attentionCheck(prng)));
  }
  return out.map((t, i) => Object.assign(t, { index: i + 1 }));
}

function simulateStudy(api, spec, d, info) {
  const rng = new api.Rng(d.seed);
  const people = api.participants.cohort(rng.fork('cohort'), d.n);
  const rows = [];
  let errors = 0;
  const rtypeOf = (t) => t.responseType || (spec.response && spec.response.type) || 'key';
  people.forEach((p, i) => {
    const prng = rng.fork('p' + i);
    try {
      const trials = buildDesignTimeline(api, spec, d, prng, i, info);
      const state = spec.init ? spec.init(prng, { quick: false, photosafe: true }) || {} : {};
      state.photosafe = true;
      const base = { pid: p.pid, session: 'sim', paradigm: spec.id, seed: d.seed, ua_hash: 'sim' };
      for (const t of trials) {
        if (spec.prepare) spec.prepare(t, state, prng);
        const s = spec.simulate(p, t, prng, state) || {};
        let response = s.response;
        if (rtypeOf(t) === 'count') { state.count = s.response || 0; if (spec.onBotCount) spec.onBotCount(t, state, s); response = state.count; }
        if (response != null && t.followup && s.followup != null) response = response + '|' + s.followup;
        let correct = s.correct != null ? s.correct : spec.score ? spec.score(t, response, state) : null;
        if (t.block === 'check') correct = response === t.correctResponse;
        const rt = response == null ? null : (s.rt != null ? s.rt : null);
        rows.push(api.timeline.makeRow(base, t, { onset_req: null, onset_actual: null, frames: null, rt_ms: rt, response, correct }));
        if (spec.update) spec.update(state, t, { correct, response, rt }, prng);
      }
    } catch (e) { errors++; }
  });
  return { rows, errors };
}

function builder(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Design an experiment, then run it on simulated participants'));
  body.append(...paras(api, [
    'An experiment is a <b>timeline</b>: optional practice trials, then main trials grouped into blocks, with attention-check trials hidden among them. <b>Randomisation</b> spreads conditions unpredictably so that fatigue, learning or a sudden noise do not line up with one condition; a <b>constrained</b> shuffle also stops long runs of the same condition. <b>Counterbalancing</b> varies the order of blocked conditions across participants; a balanced <b>Latin square</b> (Williams design) makes each condition appear in each position, and follow every other condition, equally often.',
    'Before collecting real data, researchers often pilot a design on <b>simulated participants</b>. ZEHN\'s participant model gives each agent its own speed, noise, attention lapses and ability, so you can check that your timeline is balanced and your analysis runs. Simulated effects are teaching values, not findings: every output here is labelled <b>Simulated data</b>.',
  ]));
  const specs = api.paradigms().filter((p) => p && p.buildTrials);
  if (!specs.length) {
    body.appendChild(h('p', { class: 'note' }, 'No runnable paradigms are registered in this build yet, so the builder has nothing to simulate. Plan a design on paper in the Research Methods Lab meanwhile.'));
    body.appendChild(h('div', { class: 'row' }, btn('Open Research Methods Lab', () => api.openPanel('methods'), 'primary'), btn('Open Ethics Board', () => api.openPanel('irb'), 'ghost')));
    return;
  }
  const d = { paradigm: specs[0].id, trialsPerBlock: 24, blocks: 2, randomise: 'constrained', counterbalance: 'none', practice: 4, checks: 1, n: 30, seed: sim.seed + ':study' };
  const cfg = h('div');
  const out = h('div', { 'aria-live': 'polite' });
  body.appendChild(api.select('Paradigm', specs.map((s) => ({ value: s.id, label: `${s.title} (week ${s.week})` })), d.paradigm, (v) => { d.paradigm = v; out.innerHTML = ''; renderCfg(); }));
  body.appendChild(cfg);
  body.appendChild(out);

  function renderCfg() {
    cfg.innerHTML = '';
    const spec = api.paradigm(d.paradigm);
    const info = probeSpec(api, spec);
    cfg.appendChild(h('p', null, h('b', null, spec.title + ': '), spec.purpose || ''));
    cfg.appendChild(h('p', { class: 'note' }, `Conditions found: ${info.conds.join(', ') || 'none labelled'}. ${info.phased ? 'This paradigm runs in fixed phases (e.g., acquisition → extinction), so trial order is locked to keep its logic; randomisation and counterbalancing are disabled.' : ''}`));
    cfg.append(
      numInput(api, 'Main trials per block', d.trialsPerBlock, 4, 120, (v) => { d.trialsPerBlock = v; }),
      numInput(api, 'Blocks', d.blocks, 1, 8, (v) => { d.blocks = v; }),
      numInput(api, 'Practice trials', d.practice, 0, 12, (v) => { d.practice = v; }),
      numInput(api, 'Attention-check trials', d.checks, 0, 5, (v) => { d.checks = v; }));
    if (!spec.attentionCheck) cfg.appendChild(h('p', { class: 'note' }, 'This paradigm defines no attention-check trial, so the check count is ignored.'));
    if (!info.phased) {
      cfg.appendChild(api.select('Randomisation', [{ value: 'constrained', label: 'Constrained shuffle (max 3 same in a row)' }, { value: 'shuffle', label: 'Full shuffle within each block' }, { value: 'fixed', label: 'Fixed order as generated' }], d.randomise, (v) => { d.randomise = v; }));
      cfg.appendChild(api.select('Counterbalancing', [{ value: 'none', label: 'None (mixed conditions)' }, { value: 'latin', label: 'Blocked conditions, Latin-square order' }], d.counterbalance, (v) => { d.counterbalance = v; renderSquare(); }));
    }
    const sq = h('div');
    cfg.appendChild(sq);
    function renderSquare() {
      sq.innerHTML = '';
      if (info.phased || info.conds.length < 2) return;
      const m = api.timeline.latinSquare(info.conds.length);
      sq.appendChild(h('h4', null, `Balanced Latin square for ${info.conds.length} conditions (${m.length} orders)`));
      sq.appendChild(api.table(['Order (participant row)'].concat(info.conds.map((_, i) => 'Position ' + (i + 1))), m.map((row, r) => [`Order ${r + 1} (P${r + 1}, P${r + 1 + m.length}, …)`].concat(row.map((k) => api.esc(info.conds[k]))))));
      if (d.counterbalance !== 'latin') sq.appendChild(h('p', { class: 'note' }, 'Shown for reference; choose "Blocked conditions, Latin-square order" to apply it.'));
    }
    renderSquare();
    cfg.appendChild(api.slider('Simulated participants (N)', { min: 5, max: 200, step: 5, value: d.n, onInput: (v) => { d.n = v; } }));
    const seedIn = textInput(api, 'Seed (same seed → same simulated people)', d.seed);
    seedIn.input.addEventListener('change', () => { d.seed = seedIn.input.value.trim() || d.seed; });
    cfg.appendChild(seedIn.el);
    const est = Math.round(((spec.estimateMin || 3) * (d.trialsPerBlock * d.blocks)) / Math.max(1, info.n || 24));
    cfg.appendChild(h('div', { class: 'row' },
      btn('Preview timeline', () => preview(spec, info), 'ghost'),
      btn('Save design', () => {
        const design = Object.assign({ kind: 'builder', title: spec.title, phased: info.phased, conditions: info.conds, savedAt: new Date().toISOString() }, d);
        sim.state.designs.push(design);
        api.emit('builder:save', { design });
        sim.addXP(30, 'Saved a design');
        api.toast('Design saved (' + sim.state.designs.length + ' in your portfolio).');
      }, 'teal'),
      btn(`Run ${d.n} simulated participants`, () => run(spec, info), 'primary'),
      btn('Submit to IRB', () => {
        const dir = api.service('director');
        if (dir && dir.presentIRB) dir.presentIRB(); else api.openPanel('irb');
      }),
      btn('Run it yourself', () => api.runParadigm(spec.id)),
      btn('Go to zone', () => api.goZone(spec.zone || 'explab'), 'ghost')));
    cfg.appendChild(h('h4', null, 'Ethics checklist for this design'));
    cfg.appendChild(api.table(['Item', 'Status'], [
      ['Informed consent screen', 'Yes — shown by the runner before any real participant run'],
      ['Right to withdraw (Esc)', 'Yes'],
      ['Deception → debrief required', spec.deception ? '<b>Yes</b> — debrief with delete-data option' : 'No deception'],
      ['Content warnings', spec.contentWarning && spec.contentWarning.length ? api.esc(spec.contentWarning.join(', ')) + ' (text path offered)' : 'None'],
      ['Photosensitivity', spec.photosensitive ? 'Flicker ≤ 3 Hz with static alternative' : 'No flicker'],
      ['Estimated duration per participant', `about ${Math.max(1, est)} min`],
    ]));
  }

  function preview(spec, info) {
    out.innerHTML = '';
    const tl = buildDesignTimeline(api, spec, d, new api.Rng(d.seed).fork('p0'), 0, info);
    const counts = {};
    for (const t of tl) { const k = t.block === 'main' || info.phased ? String(t.condition) : t.block; counts[k] = (counts[k] || 0) + 1; }
    out.appendChild(h('h4', null, `Timeline preview — participant 1 (${tl.length} trials)`));
    out.appendChild(api.table(['#', 'Block', 'Condition', 'Stimulus'], tl.slice(0, 16).map((t) => [t.index, api.esc(t.block), api.esc(t.condition == null ? '' : t.condition), api.esc(t.stimulus == null ? '' : String(t.stimulus).slice(0, 40))])));
    if (tl.length > 16) out.appendChild(h('p', { class: 'note' }, `…and ${tl.length - 16} more trials.`));
    out.appendChild(api.charts.bar(Object.entries(counts).map(([k, v]) => ({ name: k.length > 12 ? k.slice(0, 11) + '…' : k, value: v })), { label: 'Trials per condition / block type for participant 1', yl: 'trials', W: 560 }));
  }

  function run(spec, info) {
    out.innerHTML = '';
    if (!spec.simulate) { out.appendChild(h('p', { class: 'note' }, 'This paradigm has no simulated-participant model, so it can only be run by you.')); return; }
    const t0 = performance.now();
    const res = simulateStudy(api, spec, d, info);
    if (!res.rows.length) { out.appendChild(h('p', { class: 'note' }, 'Simulation produced no rows for this design.')); return; }
    const key = spec.id + ':sim';
    sim.datasets[key] = res.rows;
    api.emit('study:run', { paradigm: spec.id, n: d.n });
    sim.addXP(40, 'Ran a simulated study');
    const an = analyseRows(api, res.rows);
    const checks = res.rows.filter((r) => r.block === 'check');
    out.appendChild(h('h4', null, `${spec.title}: ${d.n} simulated participants, ${res.rows.length} rows `, api.simLabel()));
    out.appendChild(h('p', { class: 'note' }, `Seed ${d.seed}; ${(performance.now() - t0).toFixed(0)} ms to simulate.${res.errors ? ' ' + res.errors + ' participant(s) failed to simulate and were skipped.' : ''}${checks.length ? ` Attention checks passed: ${(100 * checks.filter((r) => String(r.correct) === '1').length / checks.length).toFixed(0)}%.` : ''} Stored as dataset "${key}" for export and reports.`));
    out.appendChild(api.table(['Condition', 'n', 'M', 'SD'], an.desc.map((x) => [api.esc(x.cond), x.n, an.dv === 'accuracy' ? fmt2(x.m) : fmt0(x.m), an.dv === 'accuracy' ? fmt2(x.sd) : fmt0(x.sd)])));
    for (const t of an.tests) { out.appendChild(h('p', { html: `${api.esc(t.name)}: ${api.format.italicise(api.esc(t.str))}` })); api.emit('stats:test', { test: t.kind }); }
    const ch = analysisChart(api, an, `Simulated data: ${an.dvLabel} by condition`);
    if (ch) out.appendChild(ch);
    if (spec.analyse) {
      try {
        const s = spec.analyse(res.rows.filter((r) => r.block !== 'practice'), {});
        if (s && s.lines) out.appendChild(h('div', { class: 'stat-out' }, 'Paradigm summary (pooled over all simulated participants):\n' + s.lines.join('\n')));
      } catch (e) { /* paradigm summary is optional */ }
    }
    out.appendChild(h('div', { class: 'row' },
      btn('Write the APA report', () => api.openPanel('report'), 'primary'),
      btn('Export this dataset', () => api.openPanel('export')),
      btn('Statistics Workbench', () => api.openPanel('stats'), 'ghost')));
  }
  renderCfg();
  body.appendChild(glossRow(api, ['Counterbalancing', 'Latin square', 'Preregistration']));
}

// ------------------------------------------------------------------ 32 export
function exportPanel(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Your data, your files'));
  body.append(...paras(api, [
    'Every trial you run is stored as one row on <b>this device only</b> (browser storage), with the fields listed in the codebook. Nothing is uploaded. Exports are files you choose to download.',
    '<b>Anonymisation:</b> rows carry a random participant id (such as P-1a2b3c), a session counter and a short hash of the browser type — never your name, email or exact time of day. Before sharing data with a class, still check free-text responses for anything identifying, and keep the codebook with the data so others can interpret each column. Simulated datasets are marked with ":sim" in their name and must be described as simulated in any report.',
  ]));
  const list = h('div');
  body.appendChild(list);
  const render = () => {
    list.innerHTML = '';
    const keys = datasetKeys(sim);
    if (!keys.length) {
      list.appendChild(h('p', { class: 'note' }, 'No datasets yet. Run a paradigm yourself, or run simulated participants in the Experiment Builder.'));
      list.appendChild(h('div', { class: 'row' }, btn('Open Experiment Builder', () => api.openPanel('builder'), 'primary'), btn('Go to the Experimental Lab', () => api.goZone('explab'), 'teal')));
      return;
    }
    list.appendChild(api.charts.bar(keys.map((k) => ({ name: paradigmOf(k).slice(0, 10) + (isSimKey(k) ? '*' : ''), value: sim.datasets[k].length })), { label: 'Rows stored per dataset (* = simulated)', yl: 'rows', W: 560 }));
    for (const k of keys) {
      const rows = sim.datasets[k];
      const pids = new Set(rows.map((r) => r.pid)).size;
      const v = api.timeline.validateRows(rows);
      const pid = paradigmOf(k);
      const base = k.replace(/:/g, '_');
      list.appendChild(h('div', { class: 'card' },
        h('h4', null, datasetLabel(api, k)),
        h('p', { class: 'note' }, `${pids} participant id(s); schema check: ${v.ok ? 'passed' : v.errors.slice(0, 2).join('; ')}`),
        isSimKey(k) ? api.simLabel() : null,
        h('div', { class: 'row' },
          btn('CSV', () => { api.download(base + '.csv', api.timeline.toCSV(rows), 'text/csv'); api.emit('export:done', { kind: 'csv' }); api.toast('CSV downloaded.'); }, 'primary'),
          btn('JSON', () => { api.download(base + '.json', JSON.stringify({ dataset: k, simulated: isSimKey(k), rows }, null, 1), 'application/json'); api.emit('export:done', { kind: 'json' }); }),
          btn('Codebook (.md)', () => {
            const md = api.timeline.codebookMarkdown(pid) + `\n## Notes\n- Dataset key: \`${k}\`${isSimKey(k) ? ' — **Simulated data** (ZEHN participant model, not real people)' : ''}\n- Anonymisation: random per-device participant id; no names, emails or clock times are stored.\n- Timing: browser RTs include a fixed lag and jitter; suitable for teaching, not publication.\n- Exported from ZEHN (simulated institution).\n`;
            api.download(base + '_codebook.md', md, 'text/markdown'); api.emit('export:done', { kind: 'codebook' });
          }),
          btn('Delete this dataset', async () => {
            const ok = await api.modal({ title: 'Delete dataset?', body: `<p>Delete <b>${api.esc(k)}</b> (${rows.length} rows) from this device? This cannot be undone.</p>`, actions: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Delete', value: true }] });
            if (ok) { delete sim.datasets[k]; api.toast('Dataset deleted.'); render(); }
          }, 'ghost'))));
    }
    list.appendChild(h('div', { class: 'row' },
      btn('Download all datasets (JSON)', () => { api.download('zehn_all_datasets.json', JSON.stringify(sim.datasets, null, 1), 'application/json'); api.emit('export:done', { kind: 'json' }); }, 'teal'),
      btn('Delete all my experiment data', async () => {
        const ok = await api.modal({ title: 'Delete all experiment data?', body: '<p>This removes every dataset (your runs and simulated studies) from this device and from the saved game. It cannot be undone.</p>', actions: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Delete everything', value: true }] });
        if (!ok) return;
        for (const key of Object.keys(sim.datasets)) delete sim.datasets[key];
        const snap = sim.store.load(); if (snap) { snap.datasets = {}; sim.store.save(snap); }
        api.toast('All experiment data deleted.'); render();
      }, 'ghost')));
  };
  render();

  body.appendChild(h('h3', null, 'Save game (export / import)'));
  body.appendChild(h('p', null, 'A save file contains your progress, settings and datasets as JSON. Use it to move between computers or to hand in a portfolio.'));
  const file = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': 'Choose a ZEHN save file' });
  const status = h('p', { class: 'note', 'aria-live': 'polite' });
  file.addEventListener('change', () => {
    const f = file.files && file.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const snap = JSON.parse(String(reader.result));
        if (sim.restore(snap)) { status.textContent = 'Save loaded (' + (snap.savedAt || 'undated') + ').'; render(); } else status.textContent = 'That file is not a ZEHN v1 save.';
      } catch (e) { status.textContent = 'Could not read that file: ' + e.message; }
    };
    reader.readAsText(f);
  });
  body.appendChild(h('div', { class: 'row' },
    btn('Export save game (JSON)', () => { api.download('zehn_save_' + sim.state.pid + '.json', JSON.stringify(sim.snapshot(), null, 1), 'application/json'); api.emit('export:done', { kind: 'json' }); }, 'primary'),
    btn('Save to this device', () => { status.textContent = sim.store.save(sim.snapshot()) ? 'Saved on this device.' : 'Browser storage unavailable — export a file instead.'; }),
    btn('Load from this device', () => { const s = sim.store.load(); status.textContent = s && sim.restore(s) ? 'Loaded the save from this device.' : 'No save found on this device.'; render(); })));
  body.appendChild(h('label', { class: 'f' }, 'Import a save file', file));
  body.appendChild(status);
  body.appendChild(h('div', { class: 'row' }, btn('APA Report Generator', () => api.openPanel('report'), 'ghost'), btn('Settings & data deletion', () => api.openPanel('settings'), 'ghost')));
}

// ------------------------------------------------------------------ 33 report
function buildReport(api, key, meta) {
  const { sim } = api;
  const rows = sim.datasets[key];
  const pid = paradigmOf(key);
  const spec = api.paradigm(pid) || { id: pid, title: pid };
  const an = analyseRows(api, rows);
  const simulated = isSimKey(key);
  const N = an.pids.length;
  const practice = rows.filter((r) => r.block === 'practice').length;
  const checks = rows.filter((r) => r.block === 'check').length;
  const main = an.test || an.tests[0];
  const sig = main && main.res && main.res.p < 0.05;
  const resultSentence = main
    ? `${an.dvLabel.charAt(0).toUpperCase() + an.dvLabel.slice(1)} ${sig ? 'differed significantly' : 'did not differ significantly'} ${main.kind === 'corr' ? 'with accuracy' : 'across conditions'}, ${main.str}.`
    : 'The data did not support an inferential test (too few conditions or observations), so only descriptive statistics are reported.';
  const descTxt = an.desc.map((x) => `${x.cond}: ${api.apa.mean(x.m, x.sd)}${an.dv === 'rt' ? ' ms' : ''}`).join('; ');
  const facts = (spec.factRefs || []).map((id) => api.fact(id)).filter((f) => f && !/instructor to add/i.test(f.source));
  const sections = [];
  sections.push({ h: 'Abstract', p: [`This report examined ${spec.title.toLowerCase()}. ${simulated ? `${N} simulated participants (Simulated data)` : N === 1 ? 'One participant (the author)' : N + ' participants'} completed ${an.nTrials} main trials${an.conds.length > 1 ? ` across ${an.conds.length} conditions (${an.conds.join(', ')})` : ''}. ${resultSentence} Results are discussed in relation to published work and to the limits of browser-based measurement${simulated ? ' and simulated samples' : ''}.`] });
  sections.push({ h: 'Method', sub: [
    ['Participants', simulated ? `${N} simulated participants were generated by ZEHN's seeded participant model, which gives each agent individual differences in processing speed, response noise, attention lapses and ability. These are not real people; all values are Simulated data.` : `${N === 1 ? 'The author took part as a single participant' : N + ' participants took part'} after giving informed consent on screen, with the right to withdraw at any time. Data were stored locally under an anonymous id.`],
    ['Materials and apparatus', `The ${spec.title} task ran in a web browser inside ZEHN. Stimuli were drawn procedurally on a 2D canvas and responses were timed with the browser's high-resolution clock; such timings include a fixed lag and some jitter and are suitable for teaching rather than publication.${spec.purpose ? ' Purpose as stated to participants: ' + spec.purpose : ''}`],
    ['Design', an.conds.length > 1 ? `A ${an.design === 'participants' ? 'within-participants' : 'single-participant, trial-level'} design with one factor, condition (${an.conds.join(', ')}). The dependent variable was ${an.dvLabel}.` : `A single-condition descriptive design. The dependent variable was ${an.dvLabel}.`],
    ['Procedure', `After consent and instructions, participants completed ${practice ? practice + ' practice trial row(s) with feedback, then ' : ''}${an.nTrials} main trial row(s)${checks ? `, with ${checks} attention-check row(s) embedded` : ''}. Practice and attention-check trials were excluded from analysis.${spec.deception ? ' Because the task involved deception, a full debrief with an option to delete data followed.' : ''}`],
  ] });
  const resP = [`Descriptive statistics: ${descTxt}.`];
  for (const t of an.tests) resP.push(`${t.name}: ${t.str}.`);
  if (!an.tests.length) resP.push('No inferential test was appropriate for these data.');
  if (simulated) resP.push('All values above are Simulated data.');
  sections.push({ h: 'Results', p: resP, table: true });
  const disc = [
    `Restate the main result in plain words: ${resultSentence}`,
    'Does the direction and size of the effect match what the original literature reports? (See the facts below.)',
    'What alternative explanations remain — practice, fatigue, order effects, speed–accuracy trade-off?',
    simulated ? 'Simulated participants embody the model\'s assumptions: what would real participants add or change?' : 'With so few participants, how far can the result generalise? Who would you need to sample next (think WEIRD)?',
    'What would a preregistered replication of this study need to fix (sample size, exclusions, analysis plan)?',
  ];
  sections.push({ h: 'Discussion (prompts to answer in your own words)', list: disc, facts });
  const refs = facts.map((f) => f.source + (f.doi_or_url && !/instructor/.test(f.doi_or_url) ? ' ' + f.doi_or_url : ''));
  const ft = api.fact('F-TIME'); if (ft) refs.push(ft.source + ' ' + (ft.doi_or_url || ''));
  return { spec, an, sections, refs, simulated, key, meta, title: meta.title || `${spec.title}: A ${simulated ? 'Simulated ' : ''}Laboratory Study` };
}

function reportToHTML(api, R) {
  const e = api.esc, it = (s) => api.format.italicise(e(s));
  let s = `<div style="text-align:center;margin:20px 0 28px"><h4 style="font-size:1.2em">${e(R.title)}</h4><p>${e(R.meta.author)}<br>${e(R.meta.affiliation)}<br>${e(R.meta.course)}<br>${e(R.meta.date)}</p>${R.simulated ? '<p><b>Contains Simulated data</b></p>' : ''}</div>`;
  for (const sec of R.sections) {
    s += `<h4>${e(sec.h)}</h4>`;
    if (sec.sub) for (const [k, v] of sec.sub) s += `<p><b>${e(k)}.</b> ${it(v)}</p>`;
    if (sec.p) for (const p of sec.p) s += `<p style="text-indent:2em">${it(p)}</p>`;
    if (sec.table) {
      s += `<table style="border-collapse:collapse;margin:8px auto"><caption style="text-align:left"><i>Table 1. Descriptive statistics by condition (${e(R.an.dvLabel)})</i></caption><tr><th style="border-bottom:1px solid #000;padding:2px 10px">Condition</th><th style="border-bottom:1px solid #000;padding:2px 10px"><i>n</i></th><th style="border-bottom:1px solid #000;padding:2px 10px"><i>M</i></th><th style="border-bottom:1px solid #000;padding:2px 10px"><i>SD</i></th></tr>`;
      for (const x of R.an.desc) s += `<tr><td style="padding:2px 10px">${e(x.cond)}</td><td style="padding:2px 10px">${x.n}</td><td style="padding:2px 10px">${R.an.dv === 'accuracy' ? fmt2(x.m) : fmt2(x.m)}</td><td style="padding:2px 10px">${fmt2(x.sd)}</td></tr>`;
      s += '</table>';
    }
    if (sec.list) s += '<ol>' + sec.list.map((x) => `<li>${it(x)}</li>`).join('') + '</ol>';
    if (sec.facts && sec.facts.length) s += '<p><b>Published findings to compare with:</b></p><ul>' + sec.facts.map((f) => `<li>${e(f.claim)}${f.confidence === 'verified' || f.confidence === 'disputed' ? ': ' + e(f.value) : ' (figure under verification)'}${f.replication && f.replication !== 'n/a' ? ' [replication: ' + e(f.replication) + ']' : ''}</li>`).join('') + '</ul>';
  }
  s += '<h4>References</h4>' + R.refs.map((r) => `<p style="padding-left:2em;text-indent:-2em">${e(r)}</p>`).join('');
  return s;
}
function reportToMarkdown(R) {
  let s = `# ${R.title}\n\n${R.meta.author}  \n${R.meta.affiliation}  \n${R.meta.course}  \n${R.meta.date}\n${R.simulated ? '\n**Contains Simulated data**\n' : ''}\n`;
  for (const sec of R.sections) {
    s += `\n## ${sec.h}\n\n`;
    if (sec.sub) for (const [k, v] of sec.sub) s += `**${k}.** ${v}\n\n`;
    if (sec.p) for (const p of sec.p) s += p + '\n\n';
    if (sec.table) s += `| Condition | n | M | SD |\n|---|---|---|---|\n` + R.an.desc.map((x) => `| ${x.cond} | ${x.n} | ${fmt2(x.m)} | ${fmt2(x.sd)} |`).join('\n') + '\n\n';
    if (sec.list) s += sec.list.map((x, i) => `${i + 1}. ${x}`).join('\n') + '\n\n';
    if (sec.facts && sec.facts.length) s += 'Published findings to compare with:\n\n' + sec.facts.map((f) => `- ${f.claim}${f.confidence === 'verified' || f.confidence === 'disputed' ? ': ' + f.value : ' (figure under verification)'}`).join('\n') + '\n\n';
  }
  s += '## References\n\n' + R.refs.map((r) => '- ' + r).join('\n') + '\n';
  return s;
}

function report(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'From data to an APA-7 report'));
  body.append(...paras(api, [
    'An APA-style empirical report follows a fixed order: <b>title page</b>, <b>abstract</b> (about 150–250 words), <b>introduction</b>, <b>method</b> (participants, materials, design, procedure — enough detail for someone to replicate), <b>results</b> (descriptives, then the planned test with its statistic, degrees of freedom, exact <i>p</i> and an effect size), <b>discussion</b> and <b>references</b>.',
    'APA-7 number style: statistical symbols in italics, <i>p</i> to three decimals (report "<i>p</i> < .001" below that), no leading zero for values that cannot exceed 1 (<i>p</i>, <i>r</i>, η²), and degrees of freedom in parentheses — for example <i>t</i>(df) = value, <i>p</i> = value, <i>d</i> = value. The generator below picks a test that fits your data and formats it for you; the discussion is yours to write.',
  ]));
  const keys = datasetKeys(sim);
  if (!keys.length) {
    body.appendChild(h('p', { class: 'note' }, 'No datasets yet. Run a paradigm, or simulate a study in the Experiment Builder, then return here.'));
    body.appendChild(h('div', { class: 'row' }, btn('Open Experiment Builder', () => api.openPanel('builder'), 'primary'), btn('Go to the Library', () => api.goZone('library'), 'teal')));
    return;
  }
  let key = keys.find((k) => /:sim$/.test(k)) || keys[0];
  const meta = { title: '', author: 'Student ' + sim.state.pid, affiliation: 'Indus Institute of Behavioural Sciences (simulated institution)', course: 'Introduction to Psychology + Experimental Lab', date: new Date().toISOString().slice(0, 10) };
  body.appendChild(api.select('Dataset', keys.map((k) => ({ value: k, label: datasetLabel(api, k) })), key, (v) => { key = v; }));
  const fT = textInput(api, 'Title (leave blank for an automatic title)', '');
  const fA = textInput(api, 'Author (anonymous id by default)', meta.author);
  const fC = textInput(api, 'Course', meta.course);
  body.append(fT.el, fA.el, fC.el);
  const outWrap = h('div', { 'aria-live': 'polite' });
  let last = null;
  body.appendChild(h('div', { class: 'row' }, btn('Generate report', () => {
    Object.assign(meta, { title: fT.input.value.trim(), author: fA.input.value.trim() || meta.author, course: fC.input.value.trim() || meta.course });
    const R = buildReport(api, key, meta);
    last = R;
    outWrap.innerHTML = '';
    const paper = h('div', { class: 'apa-out', html: reportToHTML(api, R) });
    const ch = analysisChart(api, R.an, (R.simulated ? 'Simulated data: ' : '') + 'Figure 1. ' + R.an.dvLabel + ' by condition');
    if (ch) { ch.style.background = '#1e1b4b'; ch.style.borderRadius = '6px'; paper.appendChild(ch); }
    outWrap.appendChild(paper);
    outWrap.appendChild(h('div', { class: 'row' },
      btn('Print', () => { paper.classList.add('printable'); api.emit('export:done', { kind: 'print' }); try { window.print(); } finally { setTimeout(() => paper.classList.remove('printable'), 500); } }, 'primary'),
      btn('Download .md', () => { api.download('apa_report_' + paradigmOf(key) + '.md', reportToMarkdown(last), 'text/markdown'); api.emit('export:done', { kind: 'md' }); }),
      btn('Download .html', () => {
        const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${api.esc(last.title)}</title><style>body{font-family:"Times New Roman",Georgia,serif;max-width:760px;margin:40px auto;line-height:1.8;color:#000}h4{text-align:center}</style></head><body>${reportToHTML(api, last)}</body></html>`;
        api.download('apa_report_' + paradigmOf(key) + '.html', html, 'text/html'); api.emit('export:done', { kind: 'html' });
      }),
      btn('Poster & slides', () => api.openPanel('present'), 'ghost')));
    api.emit('report:generated', { paradigm: paradigmOf(key) });
    for (const t of R.an.tests) api.emit('stats:test', { test: t.kind });
    sim.addXP(50, 'APA report');
  }, 'primary'), btn('Statistics Workbench', () => api.openPanel('stats'), 'ghost'), btn('Export data', () => api.openPanel('export'), 'ghost')));
  body.appendChild(outWrap);
}

// ------------------------------------------------------------------ 34 cases
function cases(body, api) {
  const { h, btn, sim } = api;
  const all = sim.data.cases || [];
  body.appendChild(h('h3', null, 'Classic cases — and what later research says'));
  body.append(...paras(api, [
    'Textbook studies are often remembered in a simplified, sometimes wrong, form. Each card gives an original summary, a "What later research says" box, a replication badge and the sources behind every number. Numbers in the fact lines come only from ZEHN\'s verified fact base; anything not yet verified is marked and left for your instructor.',
    'Cards on sensitive topics are hidden behind a content note. Your preferences in Settings decide whether they open automatically.',
  ]));
  const counts = {};
  for (const c of all) counts[c.replication || 'n/a'] = (counts[c.replication || 'n/a'] || 0) + 1;
  if (all.length) body.appendChild(api.charts.bar(Object.entries(counts).map(([k, v]) => ({ name: k, value: v })), { label: 'Case cards by replication status', yl: 'cards' }));
  let filter = 'all';
  const list = h('div');
  body.appendChild(api.select('Show', [{ value: 'all', label: 'All cases' }].concat(Object.keys(counts).map((k) => ({ value: k, label: 'Replication: ' + k }))), filter, (v) => { filter = v; render(); }));
  body.appendChild(list);
  const prefFor = (topics) => {
    const cw = sim.settings.contentWarnings || {};
    let mode = 'ask';
    for (const t of topics || []) for (const [k, v] of Object.entries(cw)) if (String(t).toLowerCase().includes(k.split('-')[0])) { if (v === 'skip') return 'skip'; if (v === 'show') mode = 'show'; }
    return topics && topics.length ? mode : 'show';
  };
  function card(c) {
    const inner = h('div');
    const saved = sim.store.getPref('case.' + c.id, null);
    inner.appendChild(h('p', null, c.summary));
    inner.appendChild(h('div', { class: 'card', style: { borderLeft: '3px solid #0F766E' } }, h('h4', null, 'What later research says'), h('p', null, c.laterResearch || '—')));
    inner.append(...factLines(api, c.factRefs || []));
    if (c.sources && c.sources.length) inner.appendChild(h('details', null, h('summary', null, 'Sources'), h('ul', null, c.sources.map((s) => h('li', null, s.cite + (s.doi_or_url ? ' — ' + s.doi_or_url : ''))))));
    if (c.instructorEditable || sim.state.role === 'instructor') {
      const fld = c.instructorField || { label: 'Instructor note', value: '' };
      const fV = textInput(api, fld.label, saved && saved.value != null ? saved.value : '');
      const fS = textInput(api, 'Verified source for this entry', saved && saved.source || '');
      const fN = textarea(api, 'Instructor note for class discussion', saved && saved.note || '', 2);
      const shown = h('p', { class: 'note', 'aria-live': 'polite' });
      const show = (v) => { shown.textContent = v && v.value ? `Instructor-entered (not checked by ZEHN): ${v.value} — ${v.source || 'source missing'}` : `${fld.label}: ${fld.value || '[instructor to add verified source]'}`; };
      show(saved);
      inner.appendChild(h('div', { class: 'card' }, h('h4', null, 'Instructor-editable fields'), shown, fV.el, fS.el, fN.el,
        btn('Save card edits', () => {
          const v = { value: fV.input.value.trim(), source: fS.input.value.trim(), note: fN.input.value.trim() };
          if (v.value && !v.source) { api.toast('Add a verified source before saving a figure.'); return; }
          sim.store.setPref('case.' + c.id, v); show(v); api.toast('Saved on this device.');
        }, 'ghost')));
      if (saved && saved.note) inner.appendChild(h('p', null, h('b', null, 'Instructor note: '), saved.note));
    }
    const pref = prefFor(c.contentWarning);
    const wrap = h('div', { class: 'card' },
      h('h4', null, `${c.title} (${c.years}) `, h('span', { class: 'badge rep-' + (c.replication || 'n/a') }, 'replication: ' + (c.replication || 'n/a'))),
      h('div', { class: 'row' }, h('span', { class: 'tag apa' }, 'APA ' + c.apa), h('span', { class: 'tag dom' }, c.domain), h('span', { class: 'tag wk' }, 'Week ' + c.week)));
    if (pref === 'show') wrap.appendChild(inner);
    else {
      const note = h('p', { class: 'note' }, `Content note: ${(c.contentWarning || []).join(', ')}. ${pref === 'skip' ? 'Your settings hide this topic; you can still choose to read it.' : 'Reveal when you are ready.'}`);
      wrap.append(note, btn('Reveal case', (e) => { e.target.remove(); note.remove(); wrap.appendChild(inner); }, 'ghost'));
    }
    return wrap;
  }
  function render() {
    list.innerHTML = '';
    const shown = all.filter((c) => filter === 'all' || (c.replication || 'n/a') === filter);
    for (const c of shown) list.appendChild(card(c));
    list.appendChild(h('p', { class: 'note' }, `${shown.length} of ${all.length} cases shown.`));
  }
  render();
  body.appendChild(h('div', { class: 'row' }, btn('Replication & Open Science', () => api.openPanel('replication'), 'primary'), btn('Ethics Board (IRB)', () => api.openPanel('irb'), 'ghost'), btn('Visit Wundt Hall', () => api.goZone('wundt'), 'teal')));
}

// ------------------------------------------------------------------ 35 missions
function missions(body, api) {
  const { h, btn, sim } = api;
  const all = sim.data.missions || [];
  const st = (id) => sim.state.missions[id] || { done: false, progress: [] };
  const core = all.filter((m) => (m.track || 'core') === 'core').sort((a, b) => (a.week || 0) - (b.week || 0));
  const finalCore = core.filter((m) => m.week === 16);
  const electivesOpen = finalCore.length ? finalCore.every((m) => st(m.id).done) : false;
  body.appendChild(h('h3', null, 'Run a research programme'));
  body.append(...paras(api, [
    'Each week has a core mission: learn on a tour beat, experience a paradigm, design a variant, pass ethics review, run simulated participants, analyse, write and replicate. Progress updates automatically as you play — the missions service listens for the events your actions produce.',
    `Elective specialisation tracks (clinical, cognitive neuroscience, developmental, educational, forensic, health and I-O) unlock after the week 16 mission. ${electivesOpen ? '<b>Electives are unlocked.</b>' : 'Electives are <b>locked</b> for now.'}`,
  ]));
  const done = all.filter((m) => st(m.id).done).length;
  body.appendChild(h('p', null, h('b', null, `XP ${sim.state.xp} · level ${sim.state.level} · ${done}/${all.length} missions complete · badges: `), sim.state.badges.length ? sim.state.badges.join(', ') : 'none yet'));
  const sc = sim.state.scorecard || {};
  const scoreKeys = Object.keys(sc);
  if (scoreKeys.length) body.appendChild(api.charts.bar(scoreKeys.map((k) => ({ name: 'APA ' + k.replace('g', 'goal '), value: +sc[k] || 0 })), { label: 'Scorecard by APA 3.0 goal', yl: 'points', W: 560 }));
  const tracks = [...new Set(all.map((m) => m.track || 'core'))];
  body.appendChild(api.charts.bar(tracks.map((t) => { const ms = all.filter((m) => (m.track || 'core') === t); return { name: t, value: Math.round(100 * ms.filter((m) => st(m.id).done).length / ms.length) }; }), { label: 'Missions complete per track (%)', yl: '% complete', yr: [0, 100], W: 600 }));
  const scoring = api.service('scoring');
  if (scoring && scoring.certificate) body.appendChild(btn('Show my certificate', () => scoring.certificate(), 'teal'));

  const go = (o) => {
    const w = o.where || {};
    if (o.event === 'panel:open' && w.id) return () => api.openPanel(w.id);
    if (o.event === 'zone:enter' && w.zone) return () => api.goZone(w.zone);
    if ((o.event === 'exp:complete' || o.event === 'consent:given' || o.event === 'debrief:shown') && w.paradigm) return () => api.runParadigm(w.paradigm);
    if (o.event === 'mode:change' && w.mode) return () => api.setMode(w.mode);
    const map = { 'quiz:answer': 'quiz', 'stats:test': 'stats', 'irb:decision': 'irb', 'builder:save': 'builder', 'study:run': 'builder', 'report:generated': 'report', 'export:done': 'export', 'replication:run': 'replication', 'face:au': 'emotion', 'neuron:spike': 'bio', 'glossary:lookup': 'course', 'journey:step': 'course' };
    if (o.event === 'client:turn' || o.event === 'client:session:end') return () => api.goZone('clinic');
    if (o.event === 'dilemma:resolved') return () => api.openPanel('irb');
    return map[o.event] ? () => api.openPanel(map[o.event]) : null;
  };
  const mcard = (m, locked) => {
    const s = st(m.id);
    const wrap = h('div', { class: 'card', style: s.done ? { outline: '2px solid #0F766E' } : null },
      h('h4', null, `${m.week ? 'Week ' + m.week + ' — ' : ''}${m.title} ${s.done ? '✔ complete' : locked ? '🔒 locked' : ''}`),
      h('p', null, m.brief),
      h('p', { class: 'note' }, `${m.xp} XP${m.badge ? ' · badge: ' + m.badge : ''} · APA ${m.apa}`));
    m.objectives.forEach((o, i) => {
      const c = Math.min(o.count, (s.progress && s.progress[i]) || 0);
      const pct = Math.round(100 * c / o.count);
      const act = locked ? null : go(o);
      wrap.appendChild(h('div', { class: 'row' },
        h('span', { style: { flex: 1 } }, `${c >= o.count ? '✔' : '○'} ${o.text} (${c}/${o.count})`),
        act ? btn('Go', act, 'ghost', { 'aria-label': 'Go: ' + o.text }) : null));
      wrap.appendChild(h('div', { class: 'progress', role: 'progressbar', 'aria-label': `${o.text} ${pct}%`, 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: pct + '%' } })));
    });
    return wrap;
  };
  body.appendChild(h('h3', null, 'Core missions'));
  const grid = h('div', { class: 'grid2' });
  for (const m of core) grid.appendChild(mcard(m, false));
  body.appendChild(grid);
  for (const t of tracks.filter((x) => x !== 'core')) {
    const ms = all.filter((m) => m.track === t);
    const det = h('details', { open: electivesOpen && t === tracks.find((x) => x !== 'core') }, h('summary', null, `Elective track: ${t} (${ms.filter((m) => st(m.id).done).length}/${ms.length}) ${electivesOpen ? '' : '— locked until week 16 is complete'}`));
    const g = h('div', { class: 'grid2' });
    for (const m of ms) g.appendChild(mcard(m, !electivesOpen));
    det.appendChild(g);
    body.appendChild(det);
  }
  body.appendChild(h('div', { class: 'row' }, btn('Course Map', () => api.openPanel('course'), 'primary'), btn('Assessment & Quiz', () => api.openPanel('quiz'), 'ghost')));
}

// ------------------------------------------------------------------ 36 quiz
const BLOOMS = ['remember', 'understand', 'apply', 'analyse', 'evaluate', 'create'];
const BLOOM_B = { remember: -1.2, understand: -0.6, apply: 0, analyse: 0.5, evaluate: 0.9, create: 1.2 };

function quiz(body, api) {
  const { h, btn, sim } = api;
  const items = sim.data.quiz || [];
  body.appendChild(h('h3', null, 'Assessment & adaptive practice'));
  body.append(...paras(api, [
    `${items.length} multiple-choice items cover all 16 weeks, tagged by Bloom level (remember → evaluate). In <b>adaptive practice</b>, items you have answered wrongly come back more often and items you have mastered appear less, a simple form of spaced retrieval practice.`,
    'The <b>item analysis</b> tool shows how instructors judge item quality: <b>difficulty</b> (the proportion of a class answering correctly, called the item <i>p</i>-value) and <b>discrimination</b> (how much better strong students do on the item than weak students). Because ZEHN has no real class, the analysis uses a simulated class and is labelled accordingly.',
  ]));
  const f = { week: String(sim.state.week || 'all'), bloom: 'all', adaptive: true };
  const rng = new api.Rng(sim.seed + ':quiz:' + Object.keys(sim.state.quiz).length);
  const pool = () => items.filter((q) => (f.week === 'all' || String(q.week) === f.week) && (f.bloom === 'all' || q.bloom === f.bloom));
  body.appendChild(h('div', { class: 'row' },
    api.select('Week', [{ value: 'all', label: 'All weeks' }].concat(Array.from({ length: 16 }, (_, i) => ({ value: String(i + 1), label: 'Week ' + (i + 1) }))), f.week, (v) => { f.week = v; next(); }),
    api.select('Bloom level', ['all'].concat(BLOOMS), f.bloom, (v) => { f.bloom = v; next(); }),
    checkbox(api, 'Adaptive (repeat what I got wrong)', f.adaptive, (v) => { f.adaptive = v; })));
  const qBox = h('div', { class: 'card', 'aria-live': 'polite' });
  body.appendChild(qBox);
  const sess = { n: 0, right: 0 };
  let current = null;
  function pick() {
    const p = pool();
    if (!p.length) return null;
    const cand = p.length > 1 && current ? p.filter((q) => q.id !== current.id) : p;
    if (!f.adaptive) return rng.pick(cand);
    const w = cand.map((q) => { const s = sim.state.quiz[q.id]; return !s ? 2 : s.correct ? 0.4 : 3 + Math.min(3, s.tries || 1); });
    let r = rng.uniform(0, w.reduce((a, b) => a + b, 0));
    for (let i = 0; i < cand.length; i++) { r -= w[i]; if (r <= 0) return cand[i]; }
    return cand[cand.length - 1];
  }
  function next() {
    current = pick();
    qBox.innerHTML = '';
    if (!current) { qBox.appendChild(h('p', { class: 'note' }, 'No items match this filter.')); return; }
    const q = current;
    const rec = sim.state.quiz[q.id];
    qBox.appendChild(h('p', { class: 'note' }, `${q.id} · week ${q.week} · ${q.topic} · Bloom: ${q.bloom} · APA ${q.apa}${rec ? ` · seen before (${rec.correct ? 'last answer correct' : 'last answer wrong'}, ${rec.tries} tr${rec.tries === 1 ? 'y' : 'ies'})` : ''}`));
    qBox.appendChild(h('p', null, h('b', null, q.q)));
    const fb = h('div', { 'aria-live': 'polite' });
    const opts = q.options.map((o, i) => btn(String.fromCharCode(65 + i) + '. ' + o, () => answer(i), '', { style: 'display:block;width:100%;text-align:left;margin:4px 0' }));
    opts.forEach((b) => qBox.appendChild(b));
    qBox.appendChild(fb);
    function answer(i) {
      const correct = i === q.answer;
      opts.forEach((b, k) => { b.disabled = true; if (k === q.answer) b.classList.add('teal'); });
      const prev = sim.state.quiz[q.id] || { correct: false, tries: 0 };
      sim.state.quiz[q.id] = { correct, tries: prev.tries + 1 };
      api.emit('quiz:answer', { id: q.id, correct, week: q.week });
      sess.n++; if (correct) { sess.right++; sim.addXP(5, 'Quiz item'); }
      fb.appendChild(h('p', null, h('b', null, correct ? '✔ Correct. ' : `✘ Not quite — the answer is ${String.fromCharCode(65 + q.answer)}. `), q.explain));
      if (q.factRef && api.fact(q.factRef)) fb.append(...factLines(api, [q.factRef]));
      fb.appendChild(h('p', { class: 'note' }, `This session: ${sess.right}/${sess.n} correct.`));
      fb.appendChild(btn('Next item', next, 'primary'));
      renderProgress();
    }
  }
  const prog = h('div');
  body.appendChild(h('h3', null, 'My progress by week'));
  body.appendChild(prog);
  function renderProgress() {
    prog.innerHTML = '';
    const weeks = Array.from({ length: 16 }, (_, i) => i + 1);
    const data = weeks.map((w) => { const ans = items.filter((q) => q.week === w && sim.state.quiz[q.id]); return { w, n: ans.length, c: ans.filter((q) => sim.state.quiz[q.id].correct).length }; });
    const answered = data.filter((d) => d.n);
    if (answered.length) prog.appendChild(api.charts.bar(answered.map((d) => ({ name: 'W' + d.w, value: Math.round(100 * d.c / d.n) })), { label: 'Your % correct (latest answer) per week answered', yl: '% correct', yr: [0, 100], W: 600 }));
    else prog.appendChild(api.charts.bar(weeks.map((w) => ({ name: 'W' + w, value: items.filter((q) => q.week === w).length })), { label: 'Items available per week (answer some to see your own progress)', yl: 'items', W: 600 }));
    const total = Object.keys(sim.state.quiz).length;
    prog.appendChild(h('p', { class: 'note' }, `${total} of ${items.length} items attempted; ${Object.values(sim.state.quiz).filter((s) => s.correct).length} currently correct.`));
  }
  next();
  renderProgress();

  body.appendChild(h('h3', null, 'Item analysis'));
  const iaOut = h('div', { 'aria-live': 'polite' });
  let classN = 80;
  body.appendChild(api.slider('Simulated class size', { min: 30, max: 200, step: 10, value: classN, onInput: (v) => { classN = v; } }));
  body.appendChild(btn('Run item analysis on the current filter', () => {
    iaOut.innerHTML = '';
    let set = pool();
    const arng = new api.Rng(sim.seed + ':itemanalysis');
    if (set.length > 60) set = arng.shuffle(set).slice(0, 60);
    if (set.length < 3) { iaOut.appendChild(h('p', { class: 'note' }, 'Choose a filter with at least 3 items.')); return; }
    const students = api.participants.cohort(arng.fork('class'), classN);
    const params = set.map((q) => { const r = new api.Rng('item:' + q.id); return { b: (BLOOM_B[q.bloom] || 0) + r.normal(0, 0.6), a: 0.5 + r.uniform(0, 1.4) }; });
    const M = students.map((s) => params.map((pr) => (arng.random() < 0.25 + 0.75 / (1 + Math.exp(-pr.a * (s.ability - pr.b))) ? 1 : 0)));
    const totals = M.map((row) => row.reduce((x, y) => x + y, 0));
    const order = totals.map((t, i) => [t, i]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    const g = Math.max(1, Math.round(0.27 * classN));
    const low = order.slice(0, g), high = order.slice(-g);
    const rowsOut = set.map((q, j) => {
      const p = M.reduce((s, r) => s + r[j], 0) / classN;
      const D = high.reduce((s, i) => s + M[i][j], 0) / g - low.reduce((s, i) => s + M[i][j], 0) / g;
      const flag = p < 0.2 ? 'very hard' : p > 0.9 ? 'very easy' : D < 0.2 ? 'review: weak discrimination' : 'OK';
      const mine = sim.state.quiz[q.id];
      return { q, p, D, flag, mine };
    });
    const alpha = api.psychometrics.cronbachAlpha(M);
    iaOut.appendChild(h('p', null, h('b', null, `${set.length} items × ${classN} simulated students. `), `Internal consistency (KR-20 / α) = ${Number.isFinite(alpha) ? api.apa.noLead(alpha) : '—'}. `, api.simLabel()));
    iaOut.appendChild(api.charts.scatter(rowsOut.map((r) => r.p), rowsOut.map((r) => r.D), { label: 'Simulated data: item difficulty (p) vs discrimination (D)', xl: 'difficulty p (proportion correct)', yl: 'discrimination D' }));
    iaOut.appendChild(api.table(['Item', 'Week', 'Bloom', '<i>p</i>', '<i>D</i>', 'Flag', 'Your record'], rowsOut.sort((x, y) => x.D - y.D).slice(0, 30).map((r) => [r.q.id, r.q.week, r.q.bloom, api.apa.noLead(r.p), api.apa.num(r.D), r.flag, r.mine ? (r.mine.correct ? '✔' : '✘') + ` (${r.mine.tries})` : '—'])));
    iaOut.appendChild(h('p', { class: 'note' }, 'Simulated class: responses come from a 3-parameter logistic model with guessing at chance (.25), item difficulty set by Bloom level plus seeded noise. Rule of thumb: D below .20 suggests an item that does not separate stronger from weaker students. Showing the 30 lowest-D items.'));
    api.emit('stats:test', { test: 'alpha' });
  }, 'teal'));
  body.appendChild(iaOut);
  body.appendChild(h('div', { class: 'row' }, btn('Missions', () => api.openPanel('missions'), 'ghost'), btn('Course Map', () => api.openPanel('course'), 'ghost')));
}

// ------------------------------------------------------------------ 37 aiethics
const AI_ERRORS = [
  { text: '“According to Rahman & Qureshi (2019) in the Journal of Lahore Memory Studies, 83% of students forget lectures within a day.”', type: 'source', why: 'A confident, specific citation that does not exist. Language models can generate plausible-looking references; always look a source up yourself.' },
  { text: '“Your result p = .03 means there is a 97% chance your hypothesis is true.”', type: 'stats', why: 'A p-value is the probability of data this extreme if the null hypothesis were true, not the probability that your hypothesis is true.' },
  { text: '“Students who drink more chai have higher GPAs, so chai improves grades.”', type: 'causal', why: 'A correlation alone cannot show causation; a third variable (for example, late-night study habits) could explain both.' },
  { text: '“From what you have told me, you clearly have clinical depression and should start medication.”', type: 'diagnose', why: 'A chatbot must never diagnose or prescribe for a real user. It should express care, suggest a qualified professional and show crisis resources if there is risk.' },
  { text: '“A study of 60 American undergraduates proves that all humans prefer analytic thinking.”', type: 'weird', why: 'Generalising from a small WEIRD sample to all humans ignores cultural variation and sampling limits.' },
  { text: '“Paste your participants\' names and phone numbers here so I can clean the dataset for you.”', type: 'privacy', why: 'Identifiable participant data should never be pasted into an external AI service; anonymise first and follow your consent agreement.' },
  { text: '“Here are the exact items and scoring key of a commercial intelligence test so you can practise.”', type: 'copyright', why: 'Reproducing protected test items breaks copyright and test security and makes the test useless for future clients.' },
  { text: '“Great idea! Skipping the debrief will save time, and participants won\'t mind.”', type: 'sycophancy', why: 'Sycophancy: models tend to agree with the user. Here it endorses an ethics violation; debriefing after deception is required.' },
];
const AI_TYPES = [
  { value: '', label: '— choose the error —' }, { value: 'source', label: 'Hallucinated source' }, { value: 'stats', label: 'Statistical misinterpretation' },
  { value: 'causal', label: 'Causal overreach' }, { value: 'diagnose', label: 'Diagnosing / acting as therapist' }, { value: 'weird', label: 'Overgeneralisation (WEIRD sample)' },
  { value: 'privacy', label: 'Privacy breach' }, { value: 'copyright', label: 'Copyrighted test material' }, { value: 'sycophancy', label: 'Sycophancy / unethical agreement' },
];

function aiethics(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'AI in psychology: useful, fallible, and not a therapist'));
  body.append(...paras(api, [
    'Large language models (LLMs) generate text by predicting likely next words from patterns in their training data. That makes them fluent explainers and drafters, but fluency is not knowledge: a model can produce a confident, wrong answer — a <b>hallucination</b> — including invented statistics and references. Every number and citation from an AI must be checked against a primary source.',
    'Models also inherit <b>bias</b> from their data: they may describe "normal" behaviour from a Western, English-language perspective, under-represent Urdu or Sindhi speakers, or repeat stereotypes about mental illness. They tend to be <b>sycophantic</b>, agreeing with the user\'s framing. In research, AI tools raise questions of <b>privacy</b> (never paste identifiable participant data into an external service), <b>consent</b> (participants should know if AI will process their responses) and transparency (follow your institution\'s policy on disclosing AI use in coursework).',
    '<b>Chatbot therapy risks:</b> a general chatbot has no professional training, licence or duty of care; it can miss or mishandle a crisis, give harmful advice, encourage dependence, and store sensitive disclosures. Some purpose-built, clinically tested digital interventions exist, but they are evaluated and supervised — a general assistant is not. Psychology students should treat AI as a tool to check, not an authority to trust.',
  ]));
  body.appendChild(glossRow(api, ['Hallucination', 'Informed consent', 'Confirmation bias']));

  body.appendChild(h('h3', null, 'Spot the AI error'));
  body.appendChild(h('p', { class: 'note' }, 'Each line is an original example of the kind of output an AI assistant might produce. Name the main problem.'));
  const picks = [];
  const fbs = AI_ERRORS.map(() => h('p', { class: 'note' }));
  AI_ERRORS.forEach((e, i) => body.appendChild(h('div', { class: 'card' }, h('p', null, e.text), api.select('Error in example ' + (i + 1), AI_TYPES, '', (v) => { picks[i] = v; }), fbs[i])));
  const res = h('div', { 'aria-live': 'polite' });
  body.appendChild(btn('Check my answers', () => {
    let right = 0;
    AI_ERRORS.forEach((e, i) => { const ok = picks[i] === e.type; if (ok) right++; fbs[i].textContent = (ok ? '✔ ' : '✘ ' + AI_TYPES.find((t) => t.value === e.type).label + '. ') + e.why; });
    res.innerHTML = '';
    res.appendChild(h('p', null, h('b', null, `${right} / ${AI_ERRORS.length} errors identified.`)));
    res.appendChild(api.charts.bar([{ name: 'identified', value: right }, { name: 'missed', value: AI_ERRORS.length - right }], { label: 'Spot-the-AI-error result', yl: 'examples', colors: ['#009E73', '#D55E00'] }));
    if (right >= 6) sim.addXP(25, 'Spot the AI error');
  }, 'primary'));
  body.appendChild(res);

  body.appendChild(h('h3', null, 'How RAAHI, ZEHN\'s AI tutor, is kept safe'));
  body.appendChild(api.table(['Guardrail', 'What it means'], [
    ['Identity', 'RAAHI always introduces itself as an AI tutor, not a psychologist or therapist.'],
    ['No diagnosis', 'It never diagnoses, screens or labels you. Screeners appear only on fictional clients.'],
    ['Crisis detector', 'Text suggesting self-harm, suicide or abuse in any box stops the conversation and shows crisis resources, with an option to pause.'],
    ['Simulated clients only', 'Role-play happens only with fictional clients inside the Clinic, under a visible "Simulation" banner.'],
    ['Grounded numbers', 'In live mode it receives a snapshot of your data and verified facts and is told to say "not in my data" rather than invent numbers.'],
    ['Human in the loop', 'Any change it proposes to your design or data needs your Approve/Reject.'],
    ['Copyright', 'It refuses to reproduce protected test items or diagnostic-manual text.'],
    ['Privacy', 'Offline by default. An optional API key is kept for the browser session only, and is entered in Settings.'],
  ]));
  body.append(...factLines(api, ['F-MODELS']));
  const ai = api.service('ai');
  const askOut = h('p', { class: 'note', 'aria-live': 'polite' });
  body.appendChild(h('div', { class: 'row' },
    ai && ai.ask ? btn('Ask RAAHI about its limits', async () => { askOut.textContent = 'Asking…'; try { const r = await ai.ask('What are your limits as an AI tutor?'); askOut.textContent = typeof r === 'string' ? r : (r && (r.text || r.answer)) || 'RAAHI answered in the chat window.'; } catch (e) { askOut.textContent = 'RAAHI is unavailable: ' + e.message; } }, 'teal') : null,
    btn('AI key & privacy settings', () => api.openPanel('settings'), 'ghost'),
    btn('Ethics Board (IRB)', () => api.openPanel('irb'), 'ghost'),
    btn('Go to the Library', () => api.goZone('library'), 'teal')));
  body.appendChild(askOut);
}

// ------------------------------------------------------------------ 38 present
function buildSlides(api) {
  const { sim } = api;
  const ran = Object.entries(sim.state.paradigmsRun || {}).filter(([, n]) => n > 0);
  const keys = datasetKeys(sim);
  const designs = sim.state.designs || [];
  const quizVals = Object.values(sim.state.quiz || {});
  const irbVals = Object.values(sim.state.irb || {});
  const slides = [];
  slides.push({ title: 'My research programme in ZEHN', bullets: [`Researcher ${sim.state.pid} — week ${sim.state.week}`, 'Indus Institute of Behavioural Sciences (simulated institution)', `Level ${sim.state.level} · ${sim.state.xp} XP`] });
  slides.push({ title: 'What I experienced', bullets: ran.length ? ran.slice(0, 6).map(([id, n]) => `${(api.paradigm(id) || { title: id }).title} — ${n} run(s)`) : ['No paradigms run yet: start in the Experimental Lab'] });
  slides.push({ title: 'What I designed', bullets: designs.length ? designs.slice(-5).map((d) => `${d.kind === 'prereg' ? 'Preregistration' : 'Design'}: ${d.title}${d.n ? ' (n = ' + d.n + ')' : ''}`) : ['No saved designs yet: use the Experiment Builder'] });
  for (const k of keys.slice(0, 2)) {
    const an = analyseRows(api, sim.datasets[k]);
    slides.push({ title: 'Result: ' + (api.paradigm(paradigmOf(k)) || { title: k }).title + (isSimKey(k) ? ' (Simulated data)' : ''), bullets: [`N = ${an.pids.length}; ${an.nTrials} trials; DV: ${an.dvLabel}`].concat(an.desc.slice(0, 4).map((x) => `${x.cond}: ${api.apa.mean(x.m, x.sd)}`)).concat(an.tests.slice(0, 1).map((t) => t.str)) });
  }
  slides.push({ title: 'Ethics', bullets: [`${(sim.state.consentLog || []).length} consent record(s)`, `${irbVals.length} IRB proposal(s) reviewed`, 'Deception studies were debriefed; data can be deleted at any time'] });
  slides.push({ title: 'Learning check', bullets: [`${quizVals.length} quiz items attempted, ${quizVals.filter((q) => q.correct).length} correct`, `Badges: ${(sim.state.badges || []).join(', ') || 'none yet'}`] });
  slides.push({ title: 'Replication & next steps', bullets: ['Which result would I preregister and replicate?', 'What sample would make it less WEIRD?', 'What would change my mind?'] });
  return slides;
}

function drawPoster(api, canvas, key, title) {
  const { sim } = api;
  const W = 1200, H = 1700;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
  c.fillStyle = '#1E1B4B'; c.fillRect(0, 0, W, 210);
  c.fillStyle = '#F59E0B'; c.fillRect(0, 210, W, 8);
  const wrap = (txt, x, y, maxW, lh, font, color) => {
    c.font = font; c.fillStyle = color;
    const words = String(txt).split(/\s+/); let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (c.measureText(t).width > maxW && line) { c.fillText(line, x, y); y += lh; line = w; } else line = t; }
    if (line) { c.fillText(line, x, y); y += lh; }
    return y;
  };
  c.textBaseline = 'top';
  wrap(title, 50, 40, W - 100, 56, 'bold 48px system-ui, sans-serif', '#F8FAFC');
  wrap(`Researcher ${sim.state.pid} · Indus Institute of Behavioural Sciences (simulated institution)`, 50, 160, W - 100, 30, '24px system-ui, sans-serif', '#fde68a');
  const rows = sim.datasets[key];
  const spec = api.paradigm(paradigmOf(key)) || { title: paradigmOf(key) };
  const an = analyseRows(api, rows);
  let y = 250;
  const head = (t) => { c.fillStyle = '#9F1239'; c.font = 'bold 34px system-ui, sans-serif'; c.fillText(t, 50, y); y += 50; };
  head('Method');
  y = wrap(`${isSimKey(key) ? an.pids.length + ' simulated participants (Simulated data)' : an.pids.length + ' participant(s)'} completed ${an.nTrials} trials of ${spec.title}. ${an.conds.length > 1 ? 'Conditions: ' + an.conds.join(', ') + '. ' : ''}DV: ${an.dvLabel}.`, 50, y, W - 100, 34, '26px system-ui, sans-serif', '#0f172a') + 20;
  head('Results');
  const ds = an.desc.filter((d) => Number.isFinite(d.m));
  if (ds.length) {
    const cx = 120, cy = y + 20, cw = W - 220, chh = 460;
    const max = Math.max(...ds.map((d) => d.m + (d.se || 0))) * 1.15 || 1;
    c.strokeStyle = '#334155'; c.lineWidth = 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx, cy + chh); c.lineTo(cx + cw, cy + chh); c.stroke();
    const OI = api.charts.OI;
    const bw = (cw / ds.length) * 0.6;
    ds.forEach((d, i) => {
      const x = cx + (i + 0.5) * (cw / ds.length) - bw / 2, hgt = (d.m / max) * chh;
      c.fillStyle = OI[i % OI.length]; c.fillRect(x, cy + chh - hgt, bw, hgt);
      c.strokeStyle = '#0f172a'; c.beginPath(); c.moveTo(x + bw / 2, cy + chh - ((d.m + d.se) / max) * chh); c.lineTo(x + bw / 2, cy + chh - ((d.m - d.se) / max) * chh); c.stroke();
      c.fillStyle = '#0f172a'; c.font = '22px system-ui, sans-serif'; c.textAlign = 'center';
      c.fillText(d.cond.slice(0, 16), x + bw / 2, cy + chh + 12);
      c.fillText(an.dv === 'accuracy' ? d.m.toFixed(2) : d.m.toFixed(0), x + bw / 2, cy + chh - hgt - 30);
      c.textAlign = 'left';
    });
    c.save(); c.translate(70, cy + chh / 2); c.rotate(-Math.PI / 2); c.textAlign = 'center'; c.font = '22px system-ui, sans-serif'; c.fillText(an.dvLabel, 0, -20); c.restore();
    y = cy + chh + 60;
    wrap('Error bars = ±1 SE.' + (isSimKey(key) ? ' Simulated data.' : ''), 50, y, W - 100, 30, 'italic 22px system-ui, sans-serif', '#475569');
    y += 40;
  }
  for (const t of an.tests.slice(0, 2)) y = wrap(`${t.name.split(';')[0]}: ${t.str}`, 50, y, W - 100, 34, '26px system-ui, sans-serif', '#0f172a') + 8;
  y += 20;
  head('Take-home');
  y = wrap(an.tests[0] ? (an.tests[0].res.p < 0.05 ? 'The conditions differed reliably in this sample. Next: a preregistered replication with a planned sample size.' : 'No reliable difference in this sample. Check power before concluding there is no effect.') : 'Descriptive results only; more data needed for inference.', 50, y, W - 100, 34, '26px system-ui, sans-serif', '#0f172a');
  c.fillStyle = '#1E1B4B'; c.fillRect(0, H - 70, W, 70);
  c.fillStyle = '#F8FAFC'; c.font = '22px system-ui, sans-serif'; c.fillText('ZEHN — Psychology Lab Simulator · simulated institution · data stays on this device', 50, H - 48);
}

function present(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Present your work'));
  body.append(...paras(api, [
    'Scientists communicate in two short formats besides papers: a <b>talk</b> (one idea per slide, large type, a single clear figure) and a <b>poster</b> (title, method in a few lines, one strong chart, the key statistic and a take-home message). Below, ZEHN drafts both from your own progress so you can rehearse — edit what you say, not the numbers.',
  ]));
  const slides = buildSlides(api);
  body.appendChild(h('h4', null, `Slide outline (${slides.length} slides, generated from your progress)`));
  const outline = h('ol', { class: 'printable-outline' }, slides.map((s) => h('li', null, h('b', null, s.title), h('ul', null, s.bullets.map((b) => h('li', null, b))))));
  body.appendChild(outline);
  const startPresenter = () => {
    let i = 0;
    const big = h('div', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Presenter mode', tabindex: '-1', style: { position: 'fixed', inset: '0', zIndex: 9999, background: '#1E1B4B', color: '#F8FAFC', padding: '6vh 8vw', display: 'flex', flexDirection: 'column', fontSize: 'calc(28px * var(--ui-scale, 1))' } });
    const content = h('div', { style: { flex: 1 }, 'aria-live': 'polite' });
    const counter = h('span');
    const close = () => { window.removeEventListener('keydown', onKey, true); big.remove(); };
    const show = () => {
      content.innerHTML = '';
      content.appendChild(h('h2', { style: { fontSize: '2em', color: '#F59E0B', margin: '0 0 0.6em' } }, slides[i].title));
      content.appendChild(h('ul', { style: { lineHeight: 1.6 } }, slides[i].bullets.map((b) => h('li', null, b))));
      counter.textContent = ` ${i + 1} / ${slides.length} `;
    };
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { i = Math.min(slides.length - 1, i + 1); show(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { i = Math.max(0, i - 1); show(); e.preventDefault(); e.stopPropagation(); }
      else if (e.key === 'Escape') { close(); e.stopPropagation(); }
    };
    big.append(content, h('div', { class: 'row' }, btn('◀ Previous', () => { i = Math.max(0, i - 1); show(); }), counter, btn('Next ▶', () => { i = Math.min(slides.length - 1, i + 1); show(); }, 'primary'), btn('Exit (Esc)', close, 'ghost')));
    document.body.appendChild(big);
    window.addEventListener('keydown', onKey, true);
    show(); big.focus();
  };
  body.appendChild(h('div', { class: 'row' },
    btn('Start presenter mode', startPresenter, 'primary'),
    btn('Print outline', () => { outline.classList.add('printable'); api.emit('export:done', { kind: 'print' }); try { window.print(); } finally { setTimeout(() => outline.classList.remove('printable'), 500); } }),
    btn('Download outline (.md)', () => { api.download('talk_outline.md', slides.map((s, k) => `## ${k + 1}. ${s.title}\n` + s.bullets.map((b) => '- ' + b).join('\n')).join('\n\n') + '\n', 'text/markdown'); api.emit('export:done', { kind: 'md' }); }, 'ghost')));

  body.appendChild(h('h3', null, 'Poster (PNG)'));
  const keys = datasetKeys(sim);
  if (!keys.length) {
    body.appendChild(h('p', { class: 'note' }, 'A poster needs a dataset. Run a paradigm or simulate a study first.'));
    body.appendChild(btn('Open Experiment Builder', () => api.openPanel('builder'), 'teal'));
  } else {
    let key = keys.find((k) => /:sim$/.test(k)) || keys[0];
    const fT = textInput(api, 'Poster title', 'What my data show: ' + ((api.paradigm(paradigmOf(key)) || { title: paradigmOf(key) }).title));
    const canvas = h('canvas', { 'aria-label': 'Poster preview', role: 'img', style: { width: '100%', maxWidth: '360px', border: '1px solid #475569', borderRadius: '6px', background: '#fff' } });
    body.appendChild(api.select('Dataset', keys.map((k) => ({ value: k, label: datasetLabel(api, k) })), key, (v) => { key = v; }));
    body.appendChild(fT.el);
    body.appendChild(h('div', { class: 'row' },
      btn('Draw poster', () => { drawPoster(api, canvas, key, fT.input.value || 'My study'); }, 'primary'),
      btn('Download poster PNG', () => {
        drawPoster(api, canvas, key, fT.input.value || 'My study');
        const name = 'poster_' + paradigmOf(key) + '.png';
        if (canvas.toBlob) canvas.toBlob((b) => { if (b) { api.download(name, b, 'image/png'); api.emit('export:done', { kind: 'png' }); } });
        else { const a = h('a', { href: canvas.toDataURL('image/png'), download: name }); document.body.appendChild(a); a.click(); a.remove(); api.emit('export:done', { kind: 'png' }); }
      }, 'teal')));
    body.appendChild(canvas);
    drawPoster(api, canvas, key, fT.input.value);
    const rnd = api.service('renderer');
    if (rnd && rnd.screenshot) body.appendChild(btn('Save a 3D campus screenshot (PNG)', () => {
      const url = rnd.screenshot();
      if (!url) { api.toast('Screenshot unavailable.'); return; }
      const a = h('a', { href: url, download: 'zehn_campus.png' }); document.body.appendChild(a); a.click(); a.remove();
      api.emit('export:done', { kind: 'png' });
    }, 'ghost'));
  }
  body.appendChild(h('div', { class: 'row' }, btn('APA Report Generator', () => api.openPanel('report'), 'ghost'), btn('Poster hall (Library)', () => api.goZone('library'), 'teal')));
}

// ------------------------------------------------------------------ 39 settings
const CW_TOPICS = ['suicide', 'self-harm', 'abuse', 'trauma', 'obedience', 'prison'];
function applyAccessibility(sim) {
  const s = sim.settings, b = document.body;
  b.classList.toggle('reduced-motion', !!s.reducedMotion);
  b.classList.toggle('dyslexia', !!s.dyslexia);
  b.classList.toggle('cbsafe', !!s.cbSafe);
  b.classList.toggle('photosafe', !!s.photosafe);
  b.classList.toggle('conference', !!s.conference);
  b.classList.toggle('captions', !!s.captions);
  b.style.setProperty('--ui-scale', String((+s.uiScale || 1) * (s.conference ? 1.3 : 1)));
}

function settings(body, api) {
  const { h, btn, sim } = api;
  const s = sim.settings;
  const changed = (what) => { applyAccessibility(sim); sim.saveSettings(); api.emit('settings:changed', { what }); };
  body.appendChild(h('div', { class: 'card', style: { borderLeft: '4px solid #9F1239' } },
    h('h4', null, 'Need support now?'),
    h('p', null, 'If you are struggling or thinking about harming yourself, crisis resources for Pakistan are one click away. ZEHN is a learning game; RAAHI is an AI tutor, not a counsellor.'),
    btn('Show crisis resources', () => {
      const ui = api.service('ui');
      if (ui && ui.showCrisis) ui.showCrisis(); else require('../crisis.js').showCrisis(sim, { source: 'settings' });
    }, 'primary')));
  body.appendChild(h('p', { class: 'note' }, 'ZEHN takes place at the Indus Institute of Behavioural Sciences, a simulated institution. Characters, clients and generated data are fictional; your data stays on this device.'));

  // Graphics
  body.appendChild(h('h3', null, 'Graphics'));
  const rnd = api.service('renderer');
  body.appendChild(api.select('Quality tier', ['auto', 'low', 'medium', 'high', 'ultra'], s.quality, (v) => {
    if (rnd && rnd.setQuality) rnd.setQuality(v); else s.quality = v;
    s.quality = v; changed('quality'); api.toast('Quality: ' + v);
  }));
  const fx = h('div', { class: 'grid2' });
  const FX_LABELS = { taa: 'Temporal anti-aliasing', motionBlur: 'Motion blur', ssao: 'Ambient occlusion (SSAO)', bloom: 'Bloom', godrays: 'God rays', ssr: 'Screen-space reflections', dof: 'Depth of field', lensflare: 'Lens flare', grain: 'Film grain', vignette: 'Vignette', chroma: 'Chromatic aberration', autoExposure: 'Auto exposure', volumetric: 'Volumetric light', sss: 'Skin subsurface scattering' };
  for (const k of Object.keys(s.toggles || {})) fx.appendChild(checkbox(api, FX_LABELS[k] || k, s.toggles[k], (v) => { if (rnd && rnd.setToggle) rnd.setToggle(k, v); s.toggles[k] = v; changed('toggle'); }));
  body.appendChild(fx);
  body.appendChild(checkbox(api, 'Subtle emotion colour grade in counselling scenes', s.emotionGrade, (v) => { s.emotionGrade = v; changed('emotionGrade'); }));
  body.appendChild(api.select('Time of day', ['day', 'dusk', 'night'], sim.state.timeOfDay || 'day', (v) => {
    sim.state.timeOfDay = v;
    const w = api.service('world');
    if (w && w.setTimeOfDay) w.setTimeOfDay(v); else if (rnd && rnd.setTimeOfDay) rnd.setTimeOfDay(v);
    api.toast('Time of day: ' + v);
  }));

  // Accessibility
  body.appendChild(h('h3', null, 'Accessibility'));
  const acc = [['reducedMotion', 'Reduced motion'], ['dyslexia', 'Dyslexia-friendly spacing'], ['cbSafe', 'Colour-blind-safe palette'], ['captions', 'Captions for all audio'], ['photosafe', 'Photosensitive-safe (no flicker; static alternatives)'], ['conference', 'Conference / projector mode (large type)']];
  body.appendChild(h('div', { class: 'grid2' }, acc.map(([k, l]) => checkbox(api, l, s[k], (v) => { s[k] = v; changed(k); }))));
  body.appendChild(api.slider('UI scale', { min: 0.8, max: 1.6, step: 0.05, value: +s.uiScale || 1, onInput: (v) => { s.uiScale = v; changed('uiScale'); }, fmt: (v) => Math.round(v * 100) + '%' }));
  body.appendChild(api.select('Labels language', [{ value: 'en', label: 'English' }, { value: 'ur', label: 'English + Urdu labels (اردو)' }], s.lang, (v) => {
    s.lang = v; const ui = api.service('ui'); if (ui && ui.setLang) ui.setLang(v);
    changed('lang'); api.openPanel('settings');
  }));

  // Content warnings
  body.appendChild(h('h3', null, 'Sensitive topics'));
  body.appendChild(h('p', { class: 'note' }, 'Before modules on these topics ZEHN will ask, show the content, or switch to the equivalent text-and-quiz path. Your progress is never blocked.'));
  s.contentWarnings = s.contentWarnings || {};
  body.appendChild(h('div', { class: 'grid2' }, CW_TOPICS.map((t) => api.select(t, [{ value: 'ask', label: 'Ask me first' }, { value: 'show', label: 'Show it' }, { value: 'skip', label: 'Use text-only path' }], s.contentWarnings[t] || 'ask', (v) => { s.contentWarnings[t] = v; changed('contentWarnings'); }))));

  // Audio
  body.appendChild(h('h3', null, 'Audio'));
  const audio = api.service('audio');
  body.appendChild(checkbox(api, 'Sound on', s.audio, (v) => { s.audio = v; if (audio && audio.setEnabled) audio.setEnabled(v); changed('audio'); }));
  body.appendChild(api.slider('Volume', { min: 0, max: 1, step: 0.05, value: s.volume, onInput: (v) => { s.volume = v; if (audio && audio.setVolume) audio.setVolume(v); changed('volume'); }, fmt: (v) => Math.round(v * 100) + '%' }));
  if (audio && audio.ui) body.appendChild(btn('Test sound', () => { if (audio.unlock) audio.unlock(); audio.ui('open'); api.toast('Played a test sound (procedural WebAudio).'); }, 'ghost'));

  // Game
  body.appendChild(h('h3', null, 'Game'));
  body.appendChild(api.select('Difficulty', [{ value: 'foundation', label: 'Foundation (hints on)' }, { value: 'bachelor', label: 'Bachelor' }, { value: 'honours', label: 'Honours (fewer hints, more confounds)' }], sim.state.difficulty, (v) => { sim.state.difficulty = v; sim.store.setPref('difficulty', v); api.toast('Difficulty: ' + v); }));
  body.appendChild(api.select('Role', [{ value: 'student', label: 'Student' }, { value: 'instructor', label: 'Instructor (can edit case cards)' }], sim.state.role, (v) => { sim.state.role = v; sim.store.setPref('role', v); api.toast('Role: ' + v); }));
  const seedIn = textInput(api, 'Seed (same seed → same simulated participants)', sim.seed);
  body.appendChild(h('div', { class: 'row' }, seedIn.el, btn('Apply seed', () => {
    const v = seedIn.input.value.trim();
    if (!v) return;
    sim.store.setPref('seed', v); sim.seed = v; sim.rng = new api.Rng(v);
    api.toast('Seed set to ' + v + '. New simulations use it; reload to re-seed the whole campus.');
  }, 'ghost')));

  // Consent log
  body.appendChild(h('h3', null, 'Consent log'));
  const log = sim.state.consentLog || [];
  if (log.length) {
    body.appendChild(api.table(['#', 'Paradigm', 'Consent given at'], log.slice(-20).reverse().map((c, i) => [log.length - i, api.esc((api.paradigm(c.paradigm) || { title: c.paradigm }).title), api.esc(c.at)])));
    const cnt = {};
    for (const c of log) cnt[c.paradigm] = (cnt[c.paradigm] || 0) + 1;
    body.appendChild(api.charts.bar(Object.entries(cnt).slice(0, 10).map(([k, v]) => ({ name: k.slice(0, 10), value: v })), { label: 'Consents given per paradigm', yl: 'consents', W: 560 }));
    body.appendChild(btn('Download consent log (JSON)', () => { api.download('consent_log.json', JSON.stringify(log, null, 1), 'application/json'); api.emit('export:done', { kind: 'json' }); }, 'ghost'));
  } else body.appendChild(h('p', { class: 'note' }, 'No consents recorded yet. A consent screen appears before any task that records your responses.'));

  // Data
  body.appendChild(h('h3', null, 'Save, load and delete'));
  const status = h('p', { class: 'note', 'aria-live': 'polite' });
  body.appendChild(h('div', { class: 'row' },
    btn('Save settings', () => { sim.saveSettings(); api.emit('settings:changed', { what: 'all' }); status.textContent = 'Settings saved on this device.'; }, 'primary'),
    btn('Save game', () => { status.textContent = sim.store.save(sim.snapshot()) ? 'Game saved on this device.' : 'Browser storage unavailable — use Data Export to download a file.'; }),
    btn('Load game', () => { const snap = sim.store.load(); if (snap && sim.restore(snap)) { applyAccessibility(sim); status.textContent = 'Saved game loaded.'; } else status.textContent = 'No saved game found on this device.'; }),
    btn('Data Export', () => api.openPanel('export'), 'ghost'),
    btn('Delete all my data', async () => {
      const ok = await api.modal({ title: 'Delete all my data?', body: '<p>This permanently deletes, from this device: every dataset, your consent log, quiz answers, designs, mission progress, XP, badges, saved games, reflections, instructor edits and preferences. It cannot be undone.</p><p>Export a save file first if you might want it later.</p>', actions: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Delete everything', value: true }] });
      if (!ok) return;
      for (const k of Object.keys(sim.datasets)) delete sim.datasets[k];
      Object.assign(sim.state, { xp: 0, level: 1, badges: [], consentLog: [], quiz: {}, irb: {}, dilemmas: {}, clinic: {}, missions: {}, journey: {}, designs: [], paradigmsRun: {}, panelsOpened: {}, leaderboard: [], ethicsPenalty: 0, scorecard: { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0 } });
      sim.store.clear();
      try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('zehn.')) localStorage.removeItem(k); } } catch (e) { /* storage unavailable */ }
      try { sessionStorage.clear(); } catch (e) { /* storage unavailable */ }
      sim.bus.emit('state:restored', { deleted: true });
      status.textContent = 'All your data has been deleted from this device.';
      api.toast('All data deleted.');
    }, 'ghost')));
  body.appendChild(status);

  // Optional LLM
  body.appendChild(h('h3', null, 'Optional live AI mentor'));
  const ai = api.service('ai');
  const aiBox = h('div');
  body.appendChild(aiBox);
  if (ai && ai.renderSettings) ai.renderSettings(aiBox);
  else aiBox.appendChild(h('p', { class: 'note' }, 'RAAHI runs fully offline in this build. When the live mentor module is present, its API-key entry (kept for this browser session only) appears here.'));
  body.appendChild(h('div', { class: 'row' }, btn('AI in Psychology & Ethics', () => api.openPanel('aiethics'), 'ghost'), btn('Course Map', () => api.openPanel('course'), 'ghost')));
  applyAccessibility(sim);
}

module.exports = [
  { id: 'builder', render: builder },
  { id: 'export', render: exportPanel },
  { id: 'report', render: report },
  { id: 'cases', render: cases },
  { id: 'missions', render: missions },
  { id: 'quiz', render: quiz },
  { id: 'aiethics', render: aiethics },
  { id: 'present', render: present },
  { id: 'settings', render: settings },
];
