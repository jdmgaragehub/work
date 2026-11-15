'use strict';
/**
 * Practice rail, part A (A6b): Social Psychology, I-O Psychology, Psychopathology (Simulated).
 * Contract: docs/PANEL_API.md. Original teaching text; study numbers only via api.factLine(id);
 * generated data labelled. Disorders: structure only, plain paraphrase, "see DSM-5-TR / ICD-11 for official
 * criteria". ZEHN never diagnoses the player.
 */
const { kit, newRng } = require('./thinking.js');

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const noLead = (v, dp = 2) => (Number.isFinite(v) ? (v < 0 ? '−' : '') + Math.abs(v).toFixed(dp).replace(/^0\./, '.') : '—');
const OFFICIAL = 'see DSM-5-TR / ICD-11 for official criteria';

// ================================================================== 24 SOCIAL
const STRATS = {
  allC: { name: 'Always cooperate', move: () => 'C' },
  allD: { name: 'Always defect', move: () => 'D' },
  tft: { name: 'Tit-for-tat', move: (mine, theirs) => (theirs.length ? theirs[theirs.length - 1] : 'C') },
  grim: { name: 'Grim trigger', move: (mine, theirs) => (theirs.includes('D') ? 'D' : 'C') },
  gtft: { name: 'Generous tit-for-tat', move: (mine, theirs, rng) => (theirs.length && theirs[theirs.length - 1] === 'D' && rng.random() > 0.3 ? 'D' : 'C') },
  rand: { name: 'Random', move: (mine, theirs, rng) => (rng.random() < 0.5 ? 'C' : 'D') },
};

const social = {
  id: 'social',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Social psychology studies how people’s thoughts, feelings and behaviour are shaped by the real or imagined presence of others. Its classic findings show the <b>power of the situation</b>: ordinary people conform, obey, stay passive in emergencies or change their attitudes under social pressures they barely notice. Its modern lessons are equally about <b>method</b>: several famous studies are now taught as ethics cases, and some headline effects shrank under replication.'));
    body.appendChild(K.gloss('Conformity', 'Asch conformity experiment', 'Bystander effect', 'Diffusion of responsibility', 'Cognitive dissonance', 'Fundamental attribution error'));

    // ---- Asch
    body.appendChild(H3('Conformity'));
    body.appendChild(P('In line-judgement studies, a participant answers after a group of confederates who unanimously give an obviously wrong answer. Many participants go along at least sometimes. Two kinds of influence are distinguished: <b>normative</b> (wanting to fit in) and <b>informational</b> (assuming the group knows better). A single dissenter sharply reduces conformity; private responding reduces it too. Cross-cultural syntheses suggest conformity tends to be higher in more collectivist societies and has changed over time.'));
    body.appendChild(K.facts('F-ASCH', 'F-BOND'));
    const as = { k: 5, dissent: false, n: 40 };
    const asChart = h('div');
    const asOut = out();
    const runAsch = (user) => {
      const rng = newRng(api, 'asch');
      const people = api.participants.cohort(rng, as.n);
      const sizes = [1, 2, 3, 4, 5, 6, 8, 10, 12];
      const rate = (k) => { let c = 0; for (const p of people) { const pull = p.conformity * (1 - Math.exp(-k / 1.6)) * (as.dissent ? 0.3 : 1); for (let t = 0; t < 12; t++) if (rng.random() < pull) c++; } return 100 * c / (people.length * 12); };
      const pts = sizes.map((k) => ({ x: k, y: rate(k) }));
      asChart.innerHTML = '';
      asChart.appendChild(api.charts.line([{ name: as.dissent ? 'with one dissenter' : 'unanimous majority', points: pts, dots: true }], { label: 'Conformity by majority size — illustrative model of simulated participants', xl: 'majority size', yl: '% conforming trials', yr: [0, 100] }));
      asChart.appendChild(api.simLabel('Simulated participants — illustrative model, not Asch’s data'));
      const at = pts.find((p) => p.x >= as.k) || pts[pts.length - 1];
      asOut.textContent = `${as.n} simulated participants × 12 critical trials. Majority of ${at.x}: ${at.y.toFixed(1)}% of trials conformed${as.dissent ? ' (one ally present)' : ''}. Pattern: rises with the first few confederates, then levels off; an ally cuts it sharply.`;
      if (user) api.emit('study:run', { paradigm: 'asch', n: as.n });
    };
    const dBox = h('input', { type: 'checkbox', 'aria-label': 'One confederate dissents', onchange: () => { as.dissent = dBox.checked; runAsch(true); } });
    body.appendChild(card(null, api.slider('Majority size highlighted', { min: 1, max: 12, step: 1, value: as.k, onInput: (v) => { as.k = v; } }), h('label', { class: 'pill' }, dBox, ' One confederate gives the correct answer (ally)'),
      row(btn('Simulate conformity curve', () => runAsch(true), 'primary'), K.run('asch')), asChart, asOut));
    runAsch(false);

    // ---- bystander
    body.appendChild(H3('The bystander effect'));
    body.appendChild(P('People are less likely to help — or slower to help — when others are present. Latané and Darley described five steps that must all succeed: <b>notice</b> the event, <b>interpret</b> it as an emergency, <b>take responsibility</b>, <b>know how</b> to help, and <b>decide</b> to act. Each additional bystander can break a step through diffusion of responsibility, pluralistic ignorance (everyone looks calm, so it must be fine) and fear of embarrassment. The well-known story of a murder with dozens of passive witnesses turned out to be largely inaccurate.'));
    body.appendChild(K.facts('F-BYS', 'F-BYS-MID', 'F-GENOVESE'));
    const by = { p1: 0.8, gamma: 0.8 };
    const byChart = h('div');
    const drawBy = () => {
      const ns = [1, 2, 3, 4, 5, 6, 8, 10, 15, 20];
      const ind = ns.map((n) => ({ x: n, y: by.p1 / Math.pow(n, by.gamma) }));
      const any = ns.map((n) => ({ x: n, y: 1 - Math.pow(1 - by.p1 / Math.pow(n, by.gamma), n) }));
      byChart.innerHTML = '';
      byChart.appendChild(api.charts.line([{ name: 'P(a given bystander helps)', points: ind, dots: true }, { name: 'P(at least one helps)', points: any, dash: true }], { label: 'Diffusion-of-responsibility model (illustrative)', xl: 'number of bystanders', yl: 'probability', yr: [0, 1] }));
      byChart.appendChild(api.simLabel('Illustrative model — not data'));
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Help probability when alone', { min: 0.1, max: 1, step: 0.05, value: by.p1, onInput: (v) => { by.p1 = v; drawBy(); } }),
      api.slider('Strength of diffusion', { min: 0, max: 2, step: 0.1, value: by.gamma, onInput: (v) => { by.gamma = v; drawBy(); } })), byChart,
    note('With weak diffusion, more bystanders make help for the victim more likely overall; with strong diffusion, even the chance that anyone helps can fall. Practical lesson: point to one person — “You, in the blue shirt, call 1122.”')));
    drawBy();

    // ---- dissonance & FAE
    body.appendChild(H3('Cognitive dissonance'));
    body.appendChild(P('Holding two inconsistent cognitions — “I said the task was fun” and “the task was boring” — creates discomfort that people reduce by changing an attitude, adding justifications or trivialising the conflict. The classic twist: a <i>small</i> reward for lying produced more attitude change than a large one, because a large reward is itself sufficient justification.'));
    body.appendChild(K.facts('F-FC'));
    body.appendChild(H3('The fundamental attribution error'));
    body.appendChild(P('When explaining <i>other</i> people’s behaviour we over-weight personality and under-weight the situation; for our own behaviour we notice the situation more (actor–observer difference). The bias appears weaker in many collectivist cultures, where situational and relational explanations come more naturally.'));
    const fae = { first: null };
    const faeOut = out();
    const faeBox = h('div');
    const drawFae = (reveal) => {
      faeBox.innerHTML = '';
      faeBox.appendChild(h('p', null, 'A rickshaw driver cuts across two lanes, nearly hits you, and does not stop.'));
      if (reveal) faeBox.appendChild(h('p', null, h('b', null, 'New information: '), 'his young son, bleeding from a cut, is in the back; he is racing to the hospital.'));
      faeBox.appendChild(api.slider('How much was this due to his character (vs the situation)?', { min: 0, max: 100, step: 5, value: 50, fmt: (v) => v + '% character', onInput: (v) => {
        if (!reveal) { fae.first = v; faeOut.textContent = `First judgement: ${v}% character. Now reveal the situation.`; } else faeOut.textContent = `Before: ${fae.first == null ? '—' : fae.first + '%'} character; after: ${v}%. The behaviour did not change — only what you knew about the situation. Observers rarely get this second piece of information.`;
      } }));
    };
    body.appendChild(card(null, faeBox, row(btn('Reveal the situation', () => drawFae(true), 'primary'), btn('Start again', () => { fae.first = null; faeOut.textContent = ''; drawFae(false); }, 'ghost')), faeOut));
    drawFae(false);

    // ---- prisoner's dilemma
    body.appendChild(H3('Prisoner’s dilemma payoff explorer'));
    body.appendChild(P('Two players each choose to cooperate (C) or defect (D). The payoffs are a dilemma when <b>T &gt; R &gt; P &gt; S</b> (temptation, reward, punishment, sucker’s payoff): defecting is better for you whatever the other does, yet both are worse off if both defect. In repeated play, reciprocity can sustain cooperation — the “shadow of the future”. Run a round-robin tournament of simple strategies.'));
    const pd = { T: 5, R: 3, P: 1, S: 0, rounds: 50 };
    const pdOut = out();
    const pdChart = h('div');
    const tourney = () => {
      if (!(pd.T > pd.R && pd.R > pd.P && pd.P > pd.S)) { pdOut.textContent = `Not a prisoner’s dilemma: need T > R > P > S (now T=${pd.T}, R=${pd.R}, P=${pd.P}, S=${pd.S}).`; pdChart.innerHTML = ''; return; }
      const rng = newRng(api, 'pd');
      const keys = Object.keys(STRATS);
      const tot = Object.fromEntries(keys.map((k) => [k, 0]));
      const pay = (a, b) => (a === 'C' ? (b === 'C' ? pd.R : pd.S) : (b === 'C' ? pd.T : pd.P));
      for (let i = 0; i < keys.length; i++) for (let j = i; j < keys.length; j++) {
        const ha = [], hb = [];
        for (let r = 0; r < pd.rounds; r++) {
          const a = STRATS[keys[i]].move(ha, hb, rng), b = STRATS[keys[j]].move(hb, ha, rng);
          ha.push(a); hb.push(b);
          tot[keys[i]] += pay(a, b); if (i !== j) tot[keys[j]] += pay(b, a);
        }
      }
      const res = keys.map((k) => ({ name: STRATS[k].name.replace('Generous ', 'Gen. ').slice(0, 14), value: +(tot[k] / (keys.length * pd.rounds)).toFixed(2), k })).sort((a, b) => b.value - a.value);
      pdChart.innerHTML = '';
      pdChart.appendChild(api.charts.bar(res, { label: `Round-robin tournament: mean payoff per round (${pd.rounds} rounds per match)`, yl: 'mean payoff per round' }));
      pdChart.appendChild(api.simLabel('Simulated strategies'));
      pdOut.textContent = `Winner: ${STRATS[res[0].k].name}. ${pd.rounds < 5 ? 'Very short games favour defection.' : 'Reciprocating strategies usually do well when games are long and they meet each other.'}\n2R ${2 * pd.R > pd.T + pd.S ? '>' : '≤'} T + S: ${2 * pd.R > pd.T + pd.S ? 'mutual cooperation beats taking turns exploiting.' : 'alternating exploitation pays as well as cooperating — a weaker dilemma.'}`;
      api.emit('study:run', { paradigm: 'prisoners_dilemma', n: keys.length });
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      ...['T', 'R', 'P', 'S'].map((k) => api.slider({ T: 'T temptation', R: 'R reward', P: 'P punishment', S: 'S sucker' }[k], { min: 0, max: 10, step: 1, value: pd[k], onInput: (v) => { pd[k] = v; } })),
      api.slider('Rounds per match', { min: 1, max: 200, step: 1, value: pd.rounds, onInput: (v) => { pd.rounds = v; } })),
    row(btn('Run tournament', tourney, 'primary'), K.run('prisoners_dilemma')), pdChart, pdOut));

    // ---- ethics cases
    body.appendChild(H3('Obedience and the prison study: ethics and critique cases'));
    body.appendChild(note('Content note: these cases involve simulated electric shocks, extreme distress, deception and degrading treatment. Read the summaries in the Case Studies panel; ZEHN does not re-enact them.'));
    body.appendChild(card('Milgram’s obedience studies',
      h('p', null, 'Participants believed they were giving increasingly strong shocks to a learner when an experimenter told them to continue. Many continued to the end of the scale, but obedience varied enormously across the many variations Milgram ran — falling when the experimenter was absent or peers refused. Archival work shows experimenters improvised prods and that many participants doubted the cover story.'),
      K.facts('F-MIL', 'F-MIL-META', 'F-BURGER', 'F-MILLER09', 'F-BAUMRIND'),
      note('Ethics questions: Was the distress justified by the knowledge gained? Was the right to withdraw real? How did a later partial replication stop at a lower point to protect participants?')));
    body.appendChild(card('The Stanford Prison Experiment',
      h('p', null, 'Students randomly assigned as “guards” and “prisoners” in a mock prison were said to slip spontaneously into cruel roles. Re-examination of the archives shows guards were coached toward harshness, the lead researcher acted as prison superintendent, and some participants were performing. It is now taught chiefly as a case in demand characteristics, researcher role conflict and ethics — not as proof that situations alone make people cruel.'),
      K.facts('F-SPE'),
      note('Ethics questions: Can a researcher also be the authority figure? When should a study be stopped, and by whom?')));
    body.appendChild(row(K.panel('cases', 'Case Studies (Milgram, SPE, Asch, seizure study)'), K.panel('irb', 'Ethics Board (IRB)'), btn('Discuss: showing obedience footage', () => { const d = api.service('director'); if (d && d.presentDilemma) d.presentDilemma('DL29'); else api.openPanel('irb'); })));

    body.appendChild(H3('Into the Mohalla'));
    body.appendChild(P('The Mohalla street is a social-psychology sandbox: crowds, queues, a staged emergency and conformity tasks, all with debriefs.'));
    body.appendChild(row(K.zone('mohalla'), btn('Launch social simulation', () => {
      const s = api.service('social');
      if (s && typeof s.start === 'function') s.start();
      else if (s && typeof s.open === 'function') s.open();
      else { api.setMode('social'); K.goZ('mohalla'); api.toast('Social mode (key 5) in the Mohalla.'); }
    }, 'primary'), K.run('asch'), K.run('prisoners_dilemma')));
    body.appendChild(K.ownResults('asch'));
    body.appendChild(K.ownResults('prisoners_dilemma'));
  },
};

// ================================================================== 25 I-O
const io = {
  id: 'io',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Industrial-organisational (I-O) psychology applies psychological science to work: selecting and training people, designing jobs, motivating and leading, and keeping workplaces safe and fair. Its three traditional areas are <b>personnel</b> psychology (job analysis, selection, appraisal), <b>organisational</b> psychology (motivation, leadership, teams, culture) and <b>human factors</b> (designing tools and systems around human capabilities).'));
    body.appendChild(K.gloss('Job analysis', 'Predictive validity', 'Goal-setting theory', 'Expectancy theory', 'Organizational culture'));

    // ---- selection utility
    body.appendChild(H3('Selection validity calculator'));
    body.appendChild(P('A selection test is useful when its scores correlate with later job performance (the <b>validity coefficient</b>, <i>r</i>). If you hire only the top scorers, the expected performance of the people hired — in standard-deviation units above the applicant average — is <i>r</i> × (average standardised test score of those selected). That average depends on the <b>selection ratio</b> (hired ÷ applicants): the choosier you can be, the higher it is. Multiply by the money value of one SD of performance (SD<sub>y</sub>) to estimate the gain per hire per year, then subtract testing costs. This is the logic of classic utility analysis.'));
    const sel = { r: 0.4, sr: 0.2, sdy: 300000, hires: 10, cost: 1500 };
    const selOut = out();
    const selChart = h('div');
    const drawSel = (user) => {
      const zc = api.dist.normInv(1 - sel.sr);
      const zbar = api.dist.normPdf(zc) / sel.sr;
      const gainSD = sel.r * zbar;
      const applicants = Math.round(sel.hires / sel.sr);
      const gain = gainSD * sel.sdy * sel.hires - applicants * sel.cost;
      selOut.textContent = `Selection ratio ${(100 * sel.sr).toFixed(0)}% → hired people average z = ${zbar.toFixed(2)} on the test.\nExpected performance gain per hire = ${sel.r.toFixed(2)} × ${zbar.toFixed(2)} = ${gainSD.toFixed(2)} SD.\nWith SDy = Rs ${sel.sdy.toLocaleString('en')}, ${sel.hires} hires from ${applicants} applicants, testing Rs ${sel.cost.toLocaleString('en')} each: net gain ≈ Rs ${Math.round(gain).toLocaleString('en')} in the first year.\nAll values are hypothetical inputs you choose.`;
      selChart.innerHTML = '';
      const rs = Array.from({ length: 15 }, (_, i) => i * 0.05);
      selChart.appendChild(api.charts.line([0.1, 0.3, 0.6].map((s) => ({ name: `selection ratio ${s * 100}%`, points: rs.map((r) => ({ x: r, y: r * api.dist.normPdf(api.dist.normInv(1 - s)) / s })) })), { label: 'Expected performance gain of hires (SD units) by validity and selection ratio', xl: 'validity coefficient r', yl: 'gain (SD units)' }));
      if (user) api.emit('stats:test', { test: 'regression' });
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Validity coefficient r', { min: 0, max: 0.7, step: 0.01, value: sel.r, onInput: (v) => { sel.r = v; drawSel(true); } }),
      api.slider('Selection ratio', { min: 0.05, max: 0.95, step: 0.05, value: sel.sr, fmt: (v) => (100 * v).toFixed(0) + '%', onInput: (v) => { sel.sr = v; drawSel(true); } }),
      api.slider('SDy (Rs per year)', { min: 50000, max: 1000000, step: 50000, value: sel.sdy, onInput: (v) => { sel.sdy = v; drawSel(true); } }),
      api.slider('Number hired', { min: 1, max: 100, step: 1, value: sel.hires, onInput: (v) => { sel.hires = v; drawSel(true); } }),
      api.slider('Testing cost per applicant (Rs)', { min: 0, max: 10000, step: 500, value: sel.cost, onInput: (v) => { sel.cost = v; drawSel(true); } })), selChart, selOut,
    note('Caveats: a valid test can still have adverse impact on some groups; structured interviews and work samples often combine well with ability tests; and an unreliable criterion (vague supervisor ratings) caps observed validity.')));
    drawSel(false);

    // ---- job analysis builder
    body.appendChild(H3('Job analysis builder'));
    body.appendChild(P('Job analysis is the systematic study of what a job involves (<b>task-oriented</b>) and what a person needs to do it (<b>worker-oriented</b>: knowledge, skills, abilities and other characteristics, KSAOs). It is the foundation for valid selection tests, training needs and fair appraisal. Methods include interviews with job holders, observation, questionnaires and the critical-incident technique (collecting examples of especially good and poor performance).'));
    const jTitle = h('input', { type: 'text', value: '', 'aria-label': 'Job title', placeholder: 'Job title' });
    const jTasks = h('textarea', { rows: 4, 'aria-label': 'Tasks, one per line', style: { width: '100%' }, placeholder: 'Tasks, one per line' });
    const jKsao = h('textarea', { rows: 4, 'aria-label': 'KSAOs, one per line', style: { width: '100%' }, placeholder: 'KSAOs, one per line' });
    const jMeth = {};
    const METHODS = ['Interviews with job holders', 'Observation', 'Questionnaire', 'Critical incidents', 'Work diaries', 'Subject-matter expert panel'];
    const jOut = out();
    const spec = () => ({ title: jTitle.value.trim(), tasks: jTasks.value.split('\n').map((s) => s.trim()).filter(Boolean), ksaos: jKsao.value.split('\n').map((s) => s.trim()).filter(Boolean), methods: METHODS.filter((m) => jMeth[m] && jMeth[m].checked) });
    body.appendChild(card(null, h('label', { class: 'f' }, 'Job title', jTitle), h('div', { class: 'grid2' }, h('label', { class: 'f' }, 'Tasks', jTasks), h('label', { class: 'f' }, 'KSAOs', jKsao)),
      h('div', null, METHODS.map((m) => { jMeth[m] = h('input', { type: 'checkbox', 'aria-label': m }); return h('label', { class: 'pill' }, jMeth[m], ' ' + m); })),
      row(btn('Load example: research assistant (simulated)', () => {
        jTitle.value = 'Research assistant, university psychology lab (simulated)';
        jTasks.value = 'Recruit and consent participants\nRun computer-based experiments\nClean and code data\nMaintain lab equipment and booking\nDraft method sections';
        jKsao.value = 'Knowledge of research ethics\nSkill with spreadsheets and statistics software\nAttention to detail\nClear Urdu and English communication\nReliability and punctuality';
        ['Interviews with job holders', 'Critical incidents'].forEach((m) => { jMeth[m].checked = true; });
        jOut.textContent = 'Example loaded.';
      }, 'ghost'),
      btn('Build specification', () => {
        const s = spec();
        if (!s.title || !s.tasks.length) { jOut.textContent = 'Add a job title and at least one task.'; return; }
        jOut.textContent = `JOB: ${s.title}\nTasks (${s.tasks.length}):\n  - ${s.tasks.join('\n  - ')}\nKSAOs (${s.ksaos.length}):\n  - ${s.ksaos.join('\n  - ') || '(none yet)'}\nMethods: ${s.methods.join(', ') || '(none chosen)'}\n` +
          (s.methods.length < 2 ? 'Tip: combine at least two methods to cross-check.\n' : '') + (s.ksaos.length < s.tasks.length ? 'Tip: each task should map to at least one KSAO — this mapping justifies your selection tests.' : 'Next: choose a selection method for each KSAO (test, work sample, structured interview).');
      }, 'primary'),
      btn('Download JSON', () => { api.download('zehn_job_analysis.json', JSON.stringify(spec(), null, 2), 'application/json'); api.emit('export:done', { kind: 'json' }); api.toast('Job analysis downloaded.'); })), jOut));

    // ---- motivation
    body.appendChild(H3('Work motivation'));
    body.appendChild(api.table(['Theory', 'Core claim', 'Practical use'], [
      ['Goal-setting (Locke & Latham)', 'Specific, challenging, accepted goals with feedback raise performance more than “do your best”', 'Clear targets, progress feedback; watch for narrow focus or unethical shortcuts'],
      ['Expectancy / VIE (Vroom)', 'Motivation = expectancy (effort → performance) × instrumentality (performance → outcome) × valence (value of outcome)', 'Fix the weakest link: training, credible rewards, rewards people value'],
      ['Equity (Adams)', 'People compare their outcome/input ratio with others; perceived unfairness motivates restoring balance', 'Transparent pay and promotion; procedural justice'],
      ['Self-determination', 'Autonomy, competence and relatedness sustain intrinsic motivation', 'Choice, skill growth, supportive teams'],
      ['Job characteristics (Hackman & Oldham)', 'Skill variety, task identity, task significance, autonomy and feedback create meaningful, motivating work', 'Job enrichment and redesign'],
    ]));
    const ve = { E: 0.7, I: 0.5, V: 0.8, sv: 4, ti: 4, ts: 5, au: 3, fb: 3 };
    const veOut = out();
    const drawVE = () => {
      const mf = ve.E * ve.I * ve.V;
      const mps = ((ve.sv + ve.ti + ve.ts) / 3) * ve.au * ve.fb;
      const weakest = [['expectancy', ve.E], ['instrumentality', ve.I], ['valence', ve.V]].sort((a, b) => a[1] - b[1])[0][0];
      veOut.textContent = `Expectancy theory: force = ${ve.E.toFixed(2)} × ${ve.I.toFixed(2)} × ${ve.V.toFixed(2)} = ${mf.toFixed(3)} (weakest link: ${weakest}). One zero makes the product zero.\nMotivating potential score = ((SV ${ve.sv} + TI ${ve.ti} + TS ${ve.ts}) / 3) × autonomy ${ve.au} × feedback ${ve.fb} = ${mps.toFixed(1)} (range 1–343).`;
    };
    body.appendChild(card('Motivation calculators', h('div', { class: 'grid2' },
      ...[['E', 'Expectancy'], ['I', 'Instrumentality'], ['V', 'Valence']].map(([k, l]) => api.slider(l, { min: 0, max: 1, step: 0.05, value: ve[k], onInput: (v) => { ve[k] = v; drawVE(); } })),
      ...[['sv', 'Skill variety'], ['ti', 'Task identity'], ['ts', 'Task significance'], ['au', 'Autonomy'], ['fb', 'Feedback']].map(([k, l]) => api.slider(l + ' (1–7)', { min: 1, max: 7, step: 1, value: ve[k], onInput: (v) => { ve[k] = v; drawVE(); } }))), veOut));
    drawVE();

    // ---- safety culture
    body.appendChild(H3('Safety culture'));
    body.appendChild(P('Accidents rarely have a single cause. In the “Swiss-cheese” view, hazards pass through aligned holes in several layers of defence — design, procedures, supervision, individual actions. A strong <b>safety culture</b> is one where people report near-misses without fear, leaders visibly prioritise safety over speed, and errors are treated as information. A <b>just culture</b> separates honest mistakes (learn and redesign) from reckless choices (accountability).'));
    const SAFE = ['Near-misses can be reported anonymously', 'Supervisors act on reports within a week', 'Production targets never override stop-work authority', 'Protective equipment fits and is provided free', 'Training is in the workers’ own language', 'Incidents are analysed for system causes, not just blame'];
    const sTicks = SAFE.map((s) => h('input', { type: 'checkbox', 'aria-label': s }));
    const sOut = out();
    body.appendChild(card('Audit a simulated garment workshop', h('div', null, SAFE.map((s, i) => h('label', { class: 'pill' }, sTicks[i], ' ' + s))),
      row(btn('Score this site', () => { const n = sTicks.filter((t) => t.checked).length; sOut.textContent = `${n}/${SAFE.length} indicators present — ${n >= 5 ? 'a generative, learning culture' : n >= 3 ? 'a calculative culture: systems exist but are not trusted' : 'a pathological or reactive culture: hazards will stay hidden'}.\nMissing: ${SAFE.filter((_, i) => !sTicks[i].checked).join('; ') || 'none'}.`; }, 'primary')), sOut));
    const ioDil = (api.sim.data.dilemmas || []).filter((d) => d.kind === 'io');
    body.appendChild(row(K.panel('psychometrics', 'Validity & reliability'), K.panel('social', 'Social Psychology'), K.zone('library'),
      ioDil.length ? btn('Workplace dilemma: ' + ioDil[0].title, () => { const d = api.service('director'); if (d && d.presentDilemma) d.presentDilemma(ioDil[0].id); else api.modal({ title: ioDil[0].title, body: api.h('p', null, ioDil[0].text) }); }) : null));
  },
};

// ================================================================== 26 PSYCHOPATHOLOGY
const DSM_FAMILIES = ['Neurodevelopmental', 'Schizophrenia spectrum and other psychotic', 'Bipolar and related', 'Depressive', 'Anxiety', 'Obsessive-compulsive and related', 'Trauma- and stressor-related', 'Dissociative', 'Somatic symptom and related', 'Feeding and eating', 'Elimination', 'Sleep–wake', 'Sexual dysfunctions', 'Gender dysphoria', 'Disruptive, impulse-control and conduct', 'Substance-related and addictive', 'Neurocognitive', 'Personality', 'Paraphilic', 'Other conditions that may be a focus of clinical attention'];
const FAMILY_MAP = { anxiety: 'Anxiety', depression: 'Depressive', trauma: 'Trauma- and stressor-related', ocd: 'Obsessive-compulsive and related', 'psychosis-spectrum': 'Schizophrenia spectrum and other psychotic', eating: 'Feeding and eating', substance: 'Substance-related and addictive', grief: 'Trauma- and stressor-related', adjustment: 'Trauma- and stressor-related', somatic: 'Somatic symptom and related', stress: 'Trauma- and stressor-related', cultural: 'Other conditions that may be a focus of clinical attention' };
const STIGMA_WORDS = [
  [/\b(crazy|insane|nutter|psycho|lunatic|mental case|madman|pagal|paagal)\b/gi, 'person with a mental-health condition / person who is struggling'],
  [/\bcommitted suicide\b/gi, 'died by suicide'],
  [/\b(a|an|the)\s+(schizophrenic|depressive|anorexic|bipolar|addict|alcoholic)\b/gi, 'person with … (person-first language)'],
  [/\bsuffer(s|ing)? from\b/gi, 'has / lives with / experiences'],
  [/\b(so ocd|i'?m so ocd|bit ocd)\b/gi, 'very particular / likes things tidy (OCD is a serious condition)'],
  [/\bjust (stressed|sad|lazy|weak)\b/gi, 'having a hard time (avoid minimising)'],
];

const psychopathology = {
  id: 'psychopathology',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(h('div', { class: 'card', role: 'note' }, h('p', null, h('b', null, 'This panel never diagnoses you. '), 'All clients here are fictional and simulated. Learning about conditions often makes students recognise themselves in descriptions (“medical students’ disease”) — that is normal and is not a diagnosis. If something here affects you, talk to someone you trust or use the support options.'),
      row(btn('Support & helplines', () => { const ui = api.service('ui'); if (ui && ui.showCrisis) ui.showCrisis(); else api.openPanel('settings'); }, 'primary'))));
    body.appendChild(P('<b>Psychopathology</b> is the study of psychological distress and dysfunction. No single rule separates “disorder” from ordinary difficulty. Textbooks combine several ideas: experiences that are <b>distressing</b> to the person, that <b>impair</b> everyday functioning, that are <b>statistically unusual</b> or depart from cultural norms, and sometimes that pose <b>danger</b>. Each idea alone fails (rare talents are unusual; grief is distressing), so clinicians judge them together, in cultural context.'));
    body.appendChild(K.gloss('Diathesis–stress model', 'Biopsychosocial model', 'Stigma', 'Comorbidity', 'Etiology'));

    // ---- diathesis-stress
    body.appendChild(H3('Diathesis–stress model (interactive)'));
    body.appendChild(P('A <b>diathesis</b> is a vulnerability — genetic, biological, early-life or cognitive (such as a habit of self-blame). Difficulties emerge when vulnerability and <b>stress</b> together exceed a threshold. High vulnerability needs little stress; low vulnerability needs a lot. <b>Protective</b> factors (support, coping skills, access to care) raise the threshold. A newer “differential susceptibility” view adds that some sensitive people do especially <i>well</i> in supportive environments.'));
    const ds = { vul: 0.5, stress: 0.5, prot: 0.3 };
    const dsChart = h('div');
    const dsOut = out();
    const risk = (v, s, p) => 1 / (1 + Math.exp(-(8 * (0.6 * v + 0.6 * s - 0.55 - 0.45 * p))));
    const drawDS = () => {
      const xs = Array.from({ length: 21 }, (_, i) => i / 20);
      dsChart.innerHTML = '';
      dsChart.appendChild(api.charts.line([
        { name: 'low vulnerability', points: xs.map((s) => ({ x: s, y: risk(0.15, s, ds.prot) })) },
        { name: 'medium vulnerability', points: xs.map((s) => ({ x: s, y: risk(0.5, s, ds.prot) })) },
        { name: 'high vulnerability', points: xs.map((s) => ({ x: s, y: risk(0.85, s, ds.prot) })) },
        { name: 'this simulated person', points: [{ x: ds.stress, y: 0 }, { x: ds.stress, y: risk(ds.vul, ds.stress, ds.prot) }], dash: true }],
      { label: 'Illustrative diathesis–stress model: likelihood of difficulties by stress level', xl: 'life stress (low → high)', yl: 'likelihood (illustrative)', yr: [0, 1], xr: [0, 1] }));
      dsChart.appendChild(api.simLabel('Illustrative model — not risk data; never use it to judge a real person'));
      dsOut.textContent = `Simulated person: vulnerability ${ds.vul.toFixed(2)}, stress ${ds.stress.toFixed(2)}, protection ${ds.prot.toFixed(2)} → illustrative likelihood ${(100 * risk(ds.vul, ds.stress, ds.prot)).toFixed(0)}%. Raise protection and watch every curve shift right.`;
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Vulnerability (diathesis)', { min: 0, max: 1, step: 0.05, value: ds.vul, onInput: (v) => { ds.vul = v; drawDS(); } }),
      api.slider('Current stress', { min: 0, max: 1, step: 0.05, value: ds.stress, onInput: (v) => { ds.stress = v; drawDS(); } }),
      api.slider('Protective factors', { min: 0, max: 1, step: 0.05, value: ds.prot, onInput: (v) => { ds.prot = v; drawDS(); } })), dsChart, dsOut));
    drawDS();

    // ---- simulated client formulation
    body.appendChild(H3('Biopsychosocial formulation of a simulated client'));
    body.appendChild(P('A formulation is a working explanation of <i>this</i> person’s difficulties — how biological, psychological and social factors came together — that guides help. It is a hypothesis to revise, not a label. Choose a fictional client, read the vignette and build the 5 Ps.'));
    const clients = (api.sim.data.clients || []);
    const cf = { id: clients.length ? clients[0].id : null, shown: false };
    const cfBox = h('div');
    const cfOut = out();
    const cells = {};
    const P5 = ['Presenting', 'Predisposing', 'Precipitating', 'Perpetuating', 'Protective'];
    const drawClient = () => {
      cfBox.innerHTML = ''; cfOut.textContent = '';
      const c = clients.find((x) => x.id === cf.id);
      if (!c) { cfBox.appendChild(note('No simulated clients are loaded.')); return; }
      cfBox.appendChild(api.simLabel('Fictional, simulated client'));
      if (c.contentWarning && c.contentWarning.length && !cf.shown) {
        cfBox.appendChild(note('Content note: this vignette mentions ' + c.contentWarning.join(', ') + '.'));
        cfBox.appendChild(row(btn('Show the vignette', () => { cf.shown = true; drawClient(); }, 'primary'), btn('Choose another client', () => { const i = clients.indexOf(c); cf.id = clients[(i + 1) % clients.length].id; cf.shown = false; drawClient(); }, 'ghost')));
        return;
      }
      cfBox.appendChild(h('h4', null, `${c.name}, ${c.age} — ${c.setting}`));
      cfBox.appendChild(h('p', null, h('b', null, 'Presenting: '), c.presenting));
      cfBox.appendChild(h('p', null, h('b', null, 'Background: '), c.background));
      cfBox.appendChild(h('p', null, h('b', null, 'Cultural note: '), c.culturalNote));
      const scr = c.simulatedScreeners || {};
      const items = [];
      if (Array.isArray(scr.phq9)) items.push({ name: 'PHQ-9 total', value: scr.phq9.reduce((a, b) => a + b, 0) });
      if (Array.isArray(scr.gad7)) items.push({ name: 'GAD-7 total', value: scr.gad7.reduce((a, b) => a + b, 0) });
      if (items.length) {
        cfBox.appendChild(api.charts.bar(items, { label: 'Simulated screener totals for this fictional client', yl: 'total score' }));
        cfBox.appendChild(note('Simulated screener scores. A screener flags who might need a fuller assessment; it is not a diagnosis.'));
        cfBox.appendChild(K.facts('F-PHQ'));
      }
      cfBox.appendChild(api.table(['', 'Biological', 'Psychological', 'Social / cultural'], P5.map((p) => [p, ...['bio', 'psy', 'soc'].map((d) => { const ta = h('textarea', { rows: 2, style: { width: '100%' }, 'aria-label': `${p} ${d} factors` }); cells[p + d] = ta; return ta; })])));
      cfBox.appendChild(row(
        btn('Compare with supervisor note', () => {
          const filled = Object.values(cells).filter((t) => t.value.trim()).length;
          cfOut.textContent = `You filled ${filled}/15 cells.${filled < 6 ? ' Try to cover all three domains and include protective factors.' : ''}\nSupervisor note (simulated): ${c.supervision}\nFor structure only: a clinician might look in the "${FAMILY_MAP[c.family] || 'Other'}" chapter family for further assessment — ${OFFICIAL}. This is a learning exercise, not a diagnosis.`;
        }, 'primary'),
        btn('Practise a session with this client', () => { const cl = api.service('clinic'); if (cl && cl.startSession) cl.startSession(c.id); else { K.goZ('clinic'); } }),
        btn('Download formulation', () => { const o = { client: c.id, note: 'Simulated client — learning exercise', cells: {} }; for (const k of Object.keys(cells)) o.cells[k] = cells[k].value.trim(); api.download(`zehn_formulation_${c.id}.json`, JSON.stringify(o, null, 2), 'application/json'); api.emit('export:done', { kind: 'json' }); api.toast('Formulation downloaded.'); }, 'ghost')));
    };
    body.appendChild(card(null, clients.length ? api.select('Simulated client', clients.map((c) => ({ value: c.id, label: `${c.id} ${c.name}` })), cf.id, (v) => { cf.id = v; cf.shown = false; drawClient(); }) : null, cfBox, cfOut));
    drawClient();

    // ---- classification structure
    body.appendChild(H3('Classification systems: structure only'));
    body.appendChild(P('Two systems organise diagnoses worldwide. The <b>DSM-5-TR</b> (American Psychiatric Association) is a manual in three sections: the basics of use, the diagnostic chapters with criteria and codes, and a section of emerging measures and models — including a cultural formulation interview and an alternative, dimensional model of personality functioning. The <b>ICD-11</b> (World Health Organization) covers all of health; mental, behavioural and neurodevelopmental disorders form one chapter, with sleep–wake disorders and conditions related to sexual health in chapters of their own. ICD-11 gives clinical descriptions with essential features and is free to consult; both systems are converging but still differ in places.'));
    body.appendChild(P('Both group conditions into <b>families</b>, arranged roughly along the lifespan (neurodevelopmental conditions first, neurocognitive later). Criticisms include categories with fuzzy boundaries, high comorbidity, cultural bias and the risk of turning ordinary suffering into disorder; dimensional and transdiagnostic approaches try to answer these. ZEHN deliberately does not reproduce diagnostic criteria — ' + OFFICIAL + '.'));
    body.appendChild(h('div', { class: 'row' }, DSM_FAMILIES.map((f) => h('span', { class: 'pill' }, f))));
    body.appendChild(note('Chapter-family names only (DSM-5-TR organisation). No criteria are shown; ' + OFFICIAL + '.'));

    // ---- stigma
    body.appendChild(H3('Stigma'));
    body.appendChild(P('Stigma has layers: <b>public stigma</b> (stereotypes and discrimination by others), <b>self-stigma</b> (accepting those stereotypes about yourself) and <b>structural stigma</b> (laws, budgets and institutions that disadvantage people). In Pakistan, low mental-health literacy, cost, distance and fear of family shame delay help-seeking; many people first consult religious or faith healers, which can be a source of comfort but sometimes delays effective care. What reduces stigma best is contact with people who have lived experience, accurate information and respectful language.'));
    body.appendChild(K.facts('F-MHL-PK', 'F-PK-ACCESS', 'F-PK-FAITH'));
    const lIn = h('textarea', { rows: 2, style: { width: '100%' }, 'aria-label': 'Sentence to check for stigmatising language' }, 'My cousin is a schizophrenic and acts crazy; my uncle committed suicide last year.');
    const lOut = out();
    body.appendChild(card('Respectful-language checker', lIn, row(btn('Check language', () => {
      const s = lIn.value;
      const found = [];
      for (const [re, alt] of STIGMA_WORDS) { const m = s.match(re); if (m) found.push(`“${[...new Set(m.map((x) => x.toLowerCase()))].join('”, “')}” → ${alt}`); }
      lOut.textContent = found.length ? found.join('\n') + '\nPerson-first language describes a condition a person has, not who they are.' : 'No common stigmatising terms found. (The checker only knows a short list — judgement still matters.)';
      api.emit('glossary:lookup', { term: 'Stigma' });
    }, 'primary')), lOut));
    body.appendChild(row(K.zone('clinic'), K.panel('therapy', 'Therapies & Counselling'), K.panel('crosscultural', 'Cross-cultural & stigma in Pakistan'), K.panel('cases', 'Case: help-seeking and stigma'),
      btn('Client journey', () => { const j = api.service('journey'); if (j && j.start) j.start('client'); else K.goZ('clinic'); }, 'ghost')));
  },
};

module.exports = [social, io, psychopathology];
