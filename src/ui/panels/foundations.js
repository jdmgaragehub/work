'use strict';
/**
 * Foundations rail panels (A6a): history, perspectives, methods, irb, stats.
 * Contract: docs/PANEL_API.md. All teaching text is original wording; study numbers appear only via
 * api.factLine(id); generated data is labelled with api.simLabel().
 */

/* ------------------------------------------------------------------ shared helpers */

/** Run a paradigm safely: always gives visible feedback (no dead buttons). */
function safeRun(api, id) {
  if (!api.paradigm(id)) { api.toast('Paradigm "' + id + '" is not loaded in this build.'); return; }
  try {
    const p = api.runParadigm(id);
    if (p && typeof p.catch === 'function') p.catch((e) => api.toast('Could not start ' + id + ': ' + e.message));
  } catch (e) { api.toast('Could not start ' + id + ': ' + e.message); }
}
function go(api, zone) {
  api.goZone(zone);
  api.toast('Heading to zone: ' + zone);
}
/** Row of action links: paradigms, zone, other panels. */
function links(api, { paradigms = [], zone = null, panels = [] }) {
  const row = api.h('div', { class: 'row', role: 'group', 'aria-label': 'Related activities' });
  for (const id of paradigms) {
    const spec = api.paradigm(id);
    row.appendChild(api.btn('▶ Run: ' + (spec ? spec.title : id), () => safeRun(api, id), 'primary'));
  }
  if (zone) row.appendChild(api.btn('Go to zone: ' + zone, () => go(api, zone), 'teal'));
  for (const p of panels) row.appendChild(api.btn('Open panel: ' + p, () => api.openPanel(p), 'ghost'));
  return row;
}
/** Glossary chips: click shows the definition and emits glossary:lookup. */
function glossChips(api, terms) {
  const out = api.h('p', { class: 'note', 'aria-live': 'polite' });
  const found = terms.map((t) => api.glossary(t)).filter(Boolean);
  if (!found.length) return api.h('div');
  const row = api.h('div', { class: 'row', role: 'group', 'aria-label': 'Glossary terms' },
    api.h('span', { class: 'note' }, 'Glossary:'),
    found.map((g) => api.btn(g.term, () => { out.innerHTML = '<b>' + api.esc(g.term) + '</b>: ' + api.esc(g.def); api.emit('glossary:lookup', { term: g.term }); }, 'ghost')));
  return api.h('div', null, row, out);
}
function factBlock(api, ids) { return api.h('div', { class: 'facts' }, ids.map((id) => api.factLine(id))); }
function paras(api, list) { return list.map((t) => api.h('p', { html: t })); }
const fmt = (v, dp = 2) => (Number.isFinite(v) ? (+v).toFixed(dp) : '—');
const apaHtml = (api, s) => api.format.italicise(api.esc(s));

/* ------------------------------------------------------------------ 2. HISTORY */

const TIMELINE = [
  { year: 1879, school: 'Structuralism', title: 'A laboratory for the mind', text: 'Wilhelm Wundt opens a laboratory in Leipzig devoted to experimental psychology. Trained observers report on their own sensations under controlled conditions, and psychology begins to separate from philosophy and physiology.', term: 'Wilhelm Wundt' },
  { year: 1890, school: 'Functionalism', title: 'What is the mind for?', text: 'William James publishes The Principles of Psychology. Rather than listing the parts of consciousness, he asks how mental life helps people adapt: habits, attention, emotion and the stream of thought.', term: 'William James' },
  { year: 1894, school: 'Functionalism', title: 'Opening the doors', text: 'Margaret Floy Washburn becomes the first woman awarded a PhD in psychology. Her work on animal minds, and Mary Whiton Calkins\'s on memory and the self, show early women shaping the field despite exclusion.', term: 'Margaret Floy Washburn' },
  { year: 1900, school: 'Psychoanalysis', title: 'The unconscious takes centre stage', text: 'Sigmund Freud\'s book on dream interpretation argues that hidden wishes and conflicts drive much of behaviour. Psychoanalysis grows mainly in clinics rather than laboratories, which later fuels debate about testability.', term: 'Sigmund Freud' },
  { year: 1905, school: 'Testing', title: 'Measuring individual differences', text: 'Alfred Binet and Théodore Simon publish a scale to identify children who need extra help at school. Mental testing becomes one of psychology\'s first large-scale applications, with lasting debates about fairness.', term: 'Psychology' },
  { year: 1912, school: 'Gestalt', title: 'The whole is different from the parts', text: 'Max Wertheimer studies apparent motion. Gestalt psychologists argue that perception is organised into wholes, challenging the idea that experience can be built from separate elements.', term: 'Gestalt psychology' },
  { year: 1913, school: 'Behaviourism', title: 'Only what can be observed', text: 'John B. Watson calls for a psychology of observable behaviour without introspection. Later, B. F. Skinner\'s operant work makes the experimental analysis of behaviour a dominant tradition for decades.', term: 'Behaviorism' },
  { year: 1951, school: 'Humanistic', title: 'The person as a whole', text: 'Carl Rogers describes client-centred therapy; Abraham Maslow writes about growth and self-actualisation. Humanistic psychology pushes back against both determinism of the unconscious and of reinforcement.', term: 'Humanistic psychology' },
  { year: 1956, school: 'Cognitive', title: 'The cognitive revolution', text: 'Work on memory limits, language and information processing, helped by early computers, brings internal mental processes back into scientific psychology.', term: 'Cognitive revolution', fact: 'F-MILLER56' },
  { year: 1967, school: 'Cognitive', title: 'Cognition gets a textbook', text: 'Ulric Neisser\'s book Cognitive Psychology gives the new field a name and a framework: perception, attention and memory as active, constructive processes.', term: 'Cognitive psychology' },
  { year: 1979, school: 'Ethics', title: 'Rules for research with people', text: 'After research scandals, the Belmont Report sets out respect for persons, beneficence and justice. Ethics review boards and informed consent become standard parts of the research process.', term: 'Belmont Report' },
  { year: 1998, school: 'Positive', title: 'Studying what goes right', text: 'Martin Seligman uses his APA presidency to launch positive psychology: the science of strengths, well-being and flourishing, alongside the study of disorder.', term: 'Positive psychology' },
  { year: 2010, school: 'Cultural', title: 'Who are our participants?', text: 'Researchers point out that most participants come from WEIRD societies, so many "universal" findings may not generalise. Cross-cultural and indigenous psychologies, including work in Pakistan, gain urgency.', term: 'WEIRD samples' },
  { year: 2015, school: 'Open science', title: 'The replication wake-up call', text: 'A large collaboration re-runs published experiments and finds that many effects are weaker or absent. Preregistration, open data and registered reports spread quickly.', term: 'Replication crisis', fact: 'F-OSC' },
  { year: 2023, school: 'Education', title: 'What graduates should be able to do', text: 'The APA releases version 3.0 of its guidelines for the undergraduate major, focusing on knowledge, scientific inquiry, ethics, communication and professional development.', term: 'Psychology', fact: 'F-APA' },
  { year: 2025, school: 'Education', title: 'Pakistan\'s revised BS curriculum', text: 'HEC notifies revised psychology curricula, which this course map follows week by week.', term: 'Psychology', fact: 'F-HEC1' },
];

const SCHOOLS = [
  { id: 'structuralism', name: 'Structuralism', q: 'What are the basic elements of conscious experience?', method: 'Trained introspection under controlled stimulus conditions', people: 'Wundt (voluntarism), Titchener', legacy: 'Made psychology experimental; reaction-time and psychophysics methods', critique: 'Introspective reports were unreliable and could not be checked between labs', term: 'Structuralism' },
  { id: 'functionalism', name: 'Functionalism', q: 'What is the mind for, and how does it help us adapt?', method: 'Observation, introspection, comparative and applied studies', people: 'James, Dewey, Angell', legacy: 'Opened educational, developmental and applied psychology', critique: 'Broad and loosely defined; few precise predictions', term: 'Functionalism' },
  { id: 'gestalt', name: 'Gestalt', q: 'How does perception organise parts into meaningful wholes?', method: 'Phenomenological demonstrations and perception experiments', people: 'Wertheimer, Köhler, Koffka', legacy: 'Grouping laws, figure–ground, insight in problem solving', critique: 'Describes organisation well but explains mechanisms less clearly', term: 'Gestalt psychology' },
  { id: 'psychoanalysis', name: 'Psychoanalysis', q: 'How do unconscious conflicts and early experience shape us?', method: 'Clinical case studies, free association, dream analysis', people: 'Freud, later Anna Freud, Klein, Erikson (psychodynamic)', legacy: 'Talking therapy; interest in unconscious processes and development', critique: 'Many claims are hard to falsify; small, unrepresentative case samples', term: 'Psychoanalysis' },
  { id: 'behaviourism', name: 'Behaviourism', q: 'How does the environment shape observable behaviour?', method: 'Controlled experiments, often with animals; reinforcement schedules', people: 'Watson, Pavlov, Skinner', legacy: 'Learning theory, behaviour therapy, rigorous measurement', critique: 'Ignored thought and biology; struggled with language and insight', term: 'Behaviorism' },
  { id: 'humanistic', name: 'Humanistic', q: 'How do people grow, choose and find meaning?', method: 'Client-centred interviews, self-report, case work', people: 'Rogers, Maslow', legacy: 'Counselling skills, core conditions, positive psychology roots', critique: 'Concepts such as self-actualisation are hard to measure', term: 'Humanistic psychology' },
  { id: 'cognitive', name: 'Cognitive', q: 'How is information perceived, stored, transformed and used?', method: 'Reaction-time experiments, computational models, neuroimaging', people: 'Neisser, Miller, Broadbent, Treisman', legacy: 'Memory, attention, language, CBT; the dominant framework today', critique: 'Lab tasks can lack ecological validity; computer metaphor has limits', term: 'Cognitive psychology' },
  { id: 'biological', name: 'Biological / neuroscience', q: 'How do genes, hormones and the brain produce behaviour?', method: 'Lesion studies, EEG/fMRI, genetics, pharmacology', people: 'Broca, Hebb, Sperry, many modern labs', legacy: 'Neuropsychology, psychopharmacology, behavioural genetics', critique: 'Risk of reductionism; brain images are often over-interpreted', term: 'Biological perspective' },
  { id: 'sociocultural', name: 'Sociocultural', q: 'How do culture, groups and social context shape the mind?', method: 'Cross-cultural comparison, field studies, ethnography', people: 'Vygotsky, cross-cultural and indigenous psychologists', legacy: 'Challenges WEIRD generalisation; culturally adapted interventions', critique: 'Culture is hard to define and operationalise; risk of stereotyping', term: 'Sociocultural perspective' },
];

function renderHistory(body, api) {
  const { h, btn } = api;
  body.appendChild(h('h3', null, 'From philosophy to science'));
  body.append(...paras(api, [
    'Questions about mind and behaviour are ancient. Philosophers argued about whether knowledge is inborn or learned, and scholars such as Ibn al-Haytham ran careful experiments on vision centuries before psychology had a name. What changed in the late nineteenth century was <b>method</b>: psychologists began to measure experience and behaviour under controlled conditions.',
    'Each "school" below asked a different core question and chose methods to match. Schools rarely vanished; they were absorbed. Modern psychology is <b>eclectic</b>, borrowing the best tools from many traditions, and is increasingly asking whether its findings hold beyond Western samples.',
    'Use the slider or the year buttons to move through the timeline. Researchers are named in text only; no portraits are shown.',
  ]));

  // Timeline SVG (static overview) + interactive selector
  const W = 520, H = 70, x0 = 20, x1 = 500, y = 34;
  const yr0 = 1870, yr1 = 2030;
  const sx = (yr) => x0 + ((yr - yr0) / (yr1 - yr0)) * (x1 - x0);
  const svgHost = h('div');
  const drawSvg = (sel) => {
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Timeline of psychology from 1879 to today"><title>Timeline of psychology from 1879 to today</title>`;
    s += `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="rgba(226,232,240,.5)" stroke-width="2"/>`;
    for (let d = 1880; d <= 2020; d += 20) s += `<text x="${sx(d)}" y="${H - 6}" text-anchor="middle">${d}</text>`;
    TIMELINE.forEach((e, i) => { s += `<circle cx="${sx(e.year)}" cy="${y}" r="${i === sel ? 7 : 4}" fill="${i === sel ? '#E69F00' : '#56B4E9'}" stroke="#fff" stroke-width="${i === sel ? 2 : 0}"/>`; });
    const e = TIMELINE[sel];
    s += `<text x="${Math.min(W - 60, Math.max(60, sx(e.year)))}" y="16" text-anchor="middle" font-weight="700">${e.year}: ${api.esc(e.title)}</text></svg>`;
    svgHost.innerHTML = s;
  };
  const card = h('div', { class: 'card', 'aria-live': 'polite' });
  let cur = 0;
  const show = (i) => {
    cur = Math.max(0, Math.min(TIMELINE.length - 1, i));
    const e = TIMELINE[cur];
    drawSvg(cur);
    card.innerHTML = '';
    const g = api.glossary(e.term);
    card.append(h('h4', null, `${e.year} — ${e.title}`), h('span', { class: 'pill' }, e.school), h('p', null, e.text),
      g ? h('p', { class: 'note' }, h('b', null, g.term + ': '), g.def) : null,
      e.fact ? api.factLine(e.fact) : null);
    slider.querySelector('input').value = cur;
    slider.querySelector('output').textContent = String(e.year);
    if (g) api.emit('glossary:lookup', { term: g.term });
  };
  const slider = api.slider('Move through time', { min: 0, max: TIMELINE.length - 1, step: 1, value: 0, fmt: (i) => TIMELINE[i].year, onInput: (i) => show(i) });
  body.append(svgHost, slider,
    h('div', { class: 'row' }, btn('◀ Earlier', () => show(cur - 1), 'ghost'), btn('Later ▶', () => show(cur + 1), 'ghost'),
      ...TIMELINE.map((e, i) => btn(String(e.year), () => show(i), 'ghost', { 'aria-label': `${e.year}: ${e.title}` }))),
    card);
  show(0);

  // School comparison
  body.appendChild(h('h3', null, 'Compare two schools'));
  body.appendChild(h('p', null, 'Pick two schools to compare side by side. Notice how the question each one asked determined the method it trusted.'));
  let a = 'structuralism', b = 'behaviourism';
  const cmp = h('div');
  const drawCmp = () => {
    const A = SCHOOLS.find((s) => s.id === a), B = SCHOOLS.find((s) => s.id === b);
    cmp.innerHTML = '';
    cmp.appendChild(api.table(['', api.esc(A.name), api.esc(B.name)], [
      ['Core question', api.esc(A.q), api.esc(B.q)], ['Preferred method', api.esc(A.method), api.esc(B.method)],
      ['Key figures', api.esc(A.people), api.esc(B.people)], ['Legacy today', api.esc(A.legacy), api.esc(B.legacy)], ['Main criticism', api.esc(A.critique), api.esc(B.critique)],
    ]));
  };
  const opts = SCHOOLS.map((s) => ({ value: s.id, label: s.name }));
  body.append(h('div', { class: 'row' }, api.select('School A', opts, a, (v) => { a = v; drawCmp(); }), api.select('School B', opts, b, (v) => { b = v; drawCmp(); })), cmp);
  drawCmp();

  body.appendChild(h('h3', null, 'School cards'));
  body.appendChild(h('div', { class: 'grid2' }, SCHOOLS.map((s) => h('div', { class: 'card' }, h('h4', null, s.name), h('p', null, h('i', null, s.q)), h('p', { class: 'note' }, 'Method: ' + s.method), h('p', { class: 'note' }, 'Criticism: ' + s.critique),
    btn('Define "' + s.term + '"', () => { const g = api.glossary(s.term); api.toast(g ? g.term + ': ' + g.def : s.name); api.emit('glossary:lookup', { term: s.term }); }, 'ghost')))));

  // Quick check
  body.appendChild(h('h3', null, 'Quick check: which school?'));
  const QS = [
    { q: 'A researcher asks trained observers to describe the exact qualities of a tone.', a: 'structuralism' },
    { q: 'A researcher reinforces lever pressing and records the rate of responding.', a: 'behaviourism' },
    { q: 'A therapist listens for wishes hidden in a client\'s dreams.', a: 'psychoanalysis' },
    { q: 'A lab models memory as stages of encoding, storage and retrieval.', a: 'cognitive' },
    { q: 'Students see dots moving together and perceive one moving shape.', a: 'gestalt' },
  ];
  const qOut = h('p', { 'aria-live': 'polite' });
  let qi = 0, score = 0;
  const qBox = h('div', { class: 'card' });
  const drawQ = () => {
    qBox.innerHTML = '';
    const it = QS[qi % QS.length];
    qBox.append(h('p', null, it.q), h('div', { class: 'row' }, SCHOOLS.slice(0, 7).map((s) => btn(s.name, () => {
      const ok = s.id === it.a; if (ok) score++;
      qOut.textContent = (ok ? 'Correct — ' : 'Not quite — the best answer is ' + SCHOOLS.find((x) => x.id === it.a).name + '. ') + `Score ${score}/${qi + 1}.`;
      qi++; drawQ();
    }, 'ghost'))));
  };
  drawQ();
  body.append(qBox, qOut);

  body.appendChild(factBlock(api, ['F-APA', 'F-OSC']));
  body.appendChild(glossChips(api, ['Structuralism', 'Introspection', 'Functionalism', 'Gestalt psychology', 'Psychoanalysis', 'Behaviorism', 'Humanistic psychology', 'Cognitive revolution', 'Zeitgeist', 'Ibn al-Haytham', 'Mary Whiton Calkins', 'Eclectic approach', 'Indigenous psychology']));
  body.appendChild(links(api, { paradigms: ['stroop', 'memory_palace'], zone: 'wundt', panels: ['perspectives', 'cases'] }));
}

/* ------------------------------------------------------------------ 3. PERSPECTIVES */

const LENSES = [
  { id: 'biological', name: 'Biological', level: 1, term: 'Biological perspective' },
  { id: 'evolutionary', name: 'Evolutionary', level: 2, term: 'Evolutionary psychology' },
  { id: 'psychodynamic', name: 'Psychodynamic', level: 3, term: 'Psychoanalysis' },
  { id: 'behavioural', name: 'Behavioural', level: 3, term: 'Behaviorism' },
  { id: 'cognitive', name: 'Cognitive', level: 3, term: 'Cognitive psychology' },
  { id: 'humanistic', name: 'Humanistic', level: 4, term: 'Humanistic psychology' },
  { id: 'sociocultural', name: 'Sociocultural', level: 5, term: 'Sociocultural perspective' },
];
const BEHAVIOURS = {
  exam: {
    name: 'Exam anxiety before a semester final',
    lens: {
      biological: ['Threat activates the sympathetic nervous system and stress hormones: racing heart, sweaty palms, shallow breathing.', 'Heart-rate or cortisol measures; twin and temperament studies.', 'Slow breathing, sleep and exercise to calm arousal; medication only under medical care.'],
      evolutionary: ['A fast alarm system helped ancestors avoid danger; an exam triggers the same ancient threat response though nothing physically dangerous is present.', 'Comparisons across species and cultures; mismatch arguments.', 'Reframe arousal as preparation rather than danger.'],
      psychodynamic: ['Fear of failure may echo earlier experiences of harsh judgement, with the exam standing in for disapproval from important figures.', 'Clinical interviews and case material.', 'Exploring the meaning of success and failure in talking therapy.'],
      behavioural: ['Anxiety was learned: past bad exams (unconditioned distress) were paired with exam halls. Avoiding revision brings short-term relief, which reinforces avoidance.', 'Observe avoidance behaviour; conditioning experiments.', 'Gradual exposure (mock exams), reinforcing small study steps.'],
      cognitive: ['Catastrophic thoughts ("If I fail, my life is over") and worry use up working memory that the exam itself needs.', 'Thought records, questionnaires, working-memory tasks under pressure.', 'Challenge distorted thoughts; practise retrieval so knowledge feels secure.'],
      humanistic: ['When self-worth depends on grades (conditions of worth), each exam threatens the whole self.', 'Self-report and client-centred interviews.', 'Unconditional positive regard; separating worth as a person from a mark.'],
      sociocultural: ['Family expectations, competition for limited university seats and the status of particular careers raise the stakes; norms about discussing stress shape help-seeking.', 'Cross-cultural surveys, interviews with families and teachers.', 'Peer study groups, culturally sensitive counselling, talking with family about pressure.'],
    },
  },
  procrastination: {
    name: 'Putting off an assignment until the night before',
    lens: {
      biological: ['Impulse control depends on frontal-lobe systems that compete with reward systems favouring immediate pleasures; sleep loss weakens control further.', 'Neuroimaging during delay-discounting tasks.', 'Regular sleep; reduce tempting cues near the desk.'],
      evolutionary: ['In uncertain environments, grabbing immediate rewards could pay off; distant deadlines feel less real to a mind tuned to the present.', 'Cross-species delay-discounting comparisons.', 'Make future rewards concrete and near (mini-deadlines).'],
      psychodynamic: ['Delay may protect a fragile self-image: if I never really try, failure does not prove I am inadequate.', 'Case interviews exploring fears of evaluation.', 'Exploring perfectionism and fear of judgement.'],
      behavioural: ['Phone scrolling is reinforced immediately; the reward for studying is weeks away. Behaviour follows the nearer reinforcer.', 'Track time use; manipulate reward timing.', 'Reward each 25-minute work block; remove distractor cues.'],
      cognitive: ['Planning fallacy: people underestimate how long tasks take; vague goals give no clear first step.', 'Compare predicted versus actual completion times.', 'Break tasks into specific "if–then" plans.'],
      humanistic: ['A task that feels meaningless or imposed fails to engage intrinsic motivation.', 'Self-report on autonomy and meaning.', 'Connect the assignment to personal goals and values.'],
      sociocultural: ['Group norms ("everyone starts late"), family duties and shared devices or rooms shape when study can happen.', 'Surveys across student groups and living arrangements.', 'Study partners and shared accountability.'],
    },
  },
  helping: {
    name: 'Helping a stranger who has fallen in a busy bazaar',
    lens: {
      biological: ['Empathy involves brain systems that respond both to our own pain and to others\'; hormones linked to bonding may increase approach.', 'Physiological responses while watching others in distress.', 'Not usually an intervention target.'],
      evolutionary: ['Helping kin spreads shared genes; helping non-kin can pay through reciprocity and reputation.', 'Kin versus non-kin comparisons; game-theory models.', 'Highlight reputation and reciprocity in community campaigns.'],
      psychodynamic: ['Helping may satisfy internalised ideals (the superego) or ease guilt.', 'Clinical interpretation.', 'Rarely used here.'],
      behavioural: ['People who were praised for helping in the past help more; observing helpful models also teaches the behaviour.', 'Modelling experiments; reinforcement histories.', 'Model and reward prosocial behaviour in schools.'],
      cognitive: ['Bystanders must notice, interpret the event as an emergency, take responsibility and decide how to help; a crowd can diffuse responsibility.', 'Bystander experiments manipulating group size.', 'Teach people to name a specific person: "You, please call Rescue 1122".'],
      humanistic: ['Helping expresses personal values and authentic concern for others.', 'Interviews about meaning and values.', 'Encourage reflection on the kind of person one wants to be.'],
      sociocultural: ['Norms of hospitality and religious duty, and whether the stranger is seen as part of "us", affect who helps.', 'Cross-cultural field experiments.', 'Community norms campaigns.'],
    },
  },
};

function renderPerspectives(body, api) {
  const { h, btn } = api;
  body.appendChild(h('h3', null, 'One behaviour, seven lenses'));
  body.append(...paras(api, [
    'A <b>perspective</b> is a set of assumptions about what causes behaviour and which evidence counts. None of them is "the right one": each zooms in on a different level of analysis, from molecules to societies.',
    'Choose a behaviour, then switch between lens cards. For each lens you will see its explanation, the kind of evidence it would collect, and the intervention it would suggest. The <b>biopsychosocial</b> view combines several lenses, which is how most modern psychologists actually work.',
  ]));
  let beh = 'exam', lens = 'biological';
  const seen = new Set();
  const out = h('div', { class: 'card', 'aria-live': 'polite' });
  const lensRow = h('div', { class: 'row', role: 'tablist', 'aria-label': 'Perspective lenses' });
  const chartHost = h('div');
  const drawChart = () => {
    chartHost.innerHTML = '';
    chartHost.appendChild(api.charts.bar(LENSES.map((l) => ({ name: l.name.slice(0, 6), value: l.level })), {
      label: 'Typical level of analysis per perspective (1 = molecular/brain, 5 = culture). Lenses you have opened are shown in orange.', yl: 'level', yr: [0, 5.5],
      colors: LENSES.map((l) => (seen.has(beh + ':' + l.id) ? '#E69F00' : '#56B4E9')),
    }));
    chartHost.appendChild(h('p', { class: 'note' }, `Lenses explored for this behaviour: ${LENSES.filter((l) => seen.has(beh + ':' + l.id)).map((l) => l.name).join(', ') || 'none yet'} (${LENSES.filter((l) => seen.has(beh + ':' + l.id)).length}/7). Levels are a teaching simplification.`));
  };
  const draw = () => {
    const L = LENSES.find((x) => x.id === lens), d = BEHAVIOURS[beh].lens[lens];
    seen.add(beh + ':' + lens);
    out.innerHTML = '';
    out.append(h('h4', null, `${L.name} lens — ${BEHAVIOURS[beh].name}`), h('p', null, h('b', null, 'Explanation: '), d[0]), h('p', null, h('b', null, 'Evidence it would collect: '), d[1]), h('p', null, h('b', null, 'Suggested intervention: '), d[2]));
    const g = api.glossary(L.term); if (g) out.appendChild(h('p', { class: 'note' }, g.term + ': ' + g.def));
    for (const b of lensRow.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.lens === lens));
    drawChart();
  };
  for (const L of LENSES) { const b = btn(L.name, () => { lens = L.id; draw(); }, 'ghost', { 'data-lens': L.id, role: 'tab' }); lensRow.appendChild(b); }
  body.append(api.select('Behaviour', Object.entries(BEHAVIOURS).map(([k, v]) => ({ value: k, label: v.name })), beh, (v) => { beh = v; draw(); }), lensRow, out, chartHost);
  const bps = h('div', { class: 'card', hidden: true });
  body.append(h('div', { class: 'row' }, btn('Combine: biopsychosocial summary', () => {
    const d = BEHAVIOURS[beh].lens;
    bps.hidden = false; bps.innerHTML = '';
    bps.append(h('h4', null, 'Biopsychosocial synthesis — ' + BEHAVIOURS[beh].name), h('p', null, h('b', null, 'Bio: '), d.biological[0]), h('p', null, h('b', null, 'Psycho: '), d.cognitive[0] + ' ' + d.behavioural[0]), h('p', null, h('b', null, 'Social: '), d.sociocultural[0]),
      h('p', { class: 'note' }, 'A good explanation names causes at several levels and shows how they interact (for example, catastrophic thoughts raise arousal, which narrows attention, which confirms the thought).'));
  }, 'primary'), btn('Compare all seven in a table', () => {
    const d = BEHAVIOURS[beh].lens;
    api.modal({ title: 'Seven perspectives: ' + BEHAVIOURS[beh].name, body: api.table(['Lens', 'Explanation', 'Intervention'], LENSES.map((L) => [L.name, api.esc(d[L.id][0]), api.esc(d[L.id][2])])) });
    LENSES.forEach((L) => seen.add(beh + ':' + L.id)); drawChart();
  }, 'ghost')), bps);
  draw();

  // Lens quiz
  body.appendChild(h('h3', null, 'Spot the lens'));
  const LQ = [
    { s: '"Her low mood follows a drop in serotonin-related activity."', a: 'biological' },
    { s: '"He keeps skipping class because staying in bed is immediately rewarding."', a: 'behavioural' },
    { s: '"Fear of snakes exists because ancestors who avoided them survived."', a: 'evolutionary' },
    { s: '"She interprets every ambiguous message as criticism."', a: 'cognitive' },
    { s: '"In joint families, decisions about therapy involve elders."', a: 'sociocultural' },
    { s: '"He needs acceptance without conditions to grow."', a: 'humanistic' },
    { s: '"A forgotten childhood conflict resurfaces as a slip of the tongue."', a: 'psychodynamic' },
  ];
  let qi = 0, sc = 0;
  const qb = h('div', { class: 'card' }), qo = h('p', { 'aria-live': 'polite' });
  const dq = () => {
    const it = LQ[qi % LQ.length]; qb.innerHTML = '';
    qb.append(h('p', null, it.s), h('div', { class: 'row' }, LENSES.map((L) => btn(L.name, () => { const ok = L.id === it.a; if (ok) sc++; qo.textContent = (ok ? 'Correct. ' : 'The best fit is ' + LENSES.find((x) => x.id === it.a).name + '. ') + `Score ${sc}/${qi + 1}.`; qi++; dq(); }, 'ghost'))));
  };
  dq();
  body.append(qb, qo);
  body.appendChild(factBlock(api, ['F-BPS']));
  body.appendChild(glossChips(api, ['Biological perspective', 'Evolutionary psychology', 'Psychoanalysis', 'Behaviorism', 'Cognitive psychology', 'Humanistic psychology', 'Sociocultural perspective', 'Nature–nurture debate', 'Eclectic approach', 'WEIRD samples']));
  body.appendChild(links(api, { paradigms: ['stroop', 'classical_cond'], zone: 'wundt', panels: ['history', 'crosscultural'] }));
}

/* ------------------------------------------------------------------ 4. METHODS */

const CONFOUNDS = [
  { s: 'To test whether caffeine improves memory, the coffee group is tested at 9 am and the decaf group at 4 pm.', o: ['Time of day', 'Sample size', 'Operational definition of memory', 'No confound'], c: 0, why: 'Time of day changes along with the IV, so alertness differences could explain any result.', fix: 'Test both groups at the same times, or randomise testing times across groups.' },
  { s: 'Ms Ayesha teaches her class with a new flipped method; Mr Bilal teaches his class the usual way. Exam scores are compared.', o: ['Teacher (and class) differences', 'Demand characteristics', 'Order effects', 'No confound'], c: 0, why: 'Teacher skill and class make-up vary with the method, so the method effect cannot be isolated.', fix: 'Have each teacher use both methods with randomly assigned sections.' },
  { s: 'Every participant learns words in silence first and with music second; recall is better in silence.', o: ['Order / fatigue effects', 'Random sampling', 'Experimenter expectancy', 'No confound'], c: 0, why: 'Music always came second, so fatigue or interference from the first list could cause poorer recall.', fix: 'Counterbalance the order (half silence-first, half music-first).' },
  { s: 'Students choose whether to join a mindfulness programme; joiners later report less stress than non-joiners.', o: ['Self-selection (no random assignment)', 'Ceiling effect', 'Counterbalancing', 'No confound'], c: 0, why: 'People who volunteer may already be more motivated or less stressed.', fix: 'Randomly assign volunteers to programme or wait-list.' },
  { s: 'The researcher who knows the hypothesis scores creativity essays from both groups.', o: ['Experimenter expectancy bias', 'Regression to the mean', 'Order effects', 'No confound'], c: 0, why: 'Expectations can subtly shift subjective scoring.', fix: 'Use blind raters and check inter-rater reliability.' },
  { s: 'The app group is told "this app reduces stress"; the control group is told nothing and uses no app.', o: ['Placebo / demand characteristics', 'Sampling error only', 'Floor effect', 'No confound'], c: 0, why: 'Expectation alone could lower reported stress.', fix: 'Give controls a credible placebo app with the same instructions.' },
  { s: 'Sleep-deprived participants are tested in a noisy room; rested participants in a quiet room.', o: ['Testing environment', 'Small effect size', 'Between-subjects design', 'No confound'], c: 0, why: 'Noise varies with sleep condition, so either could cause poorer performance.', fix: 'Hold the environment constant across conditions.' },
  { s: 'Participants are randomly assigned to two font conditions, tested in the same room, by a blind experimenter, with identical instructions.', o: ['Font colour', 'Experimenter expectancy', 'Order effects', 'No obvious confound'], c: 3, why: 'Random assignment, constant conditions and blinding control the main threats.', fix: 'Still preregister and check a manipulation check.' },
];

function renderMethods(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'From question to design'));
  body.append(...paras(api, [
    'An <b>experiment</b> manipulates an <b>independent variable (IV)</b> and measures its effect on a <b>dependent variable (DV)</b>, while holding everything else constant. Because only the IV changes, a difference in the DV can be attributed to it: this is <b>internal validity</b>.',
    'Abstract ideas such as "stress" or "attention" must be <b>operationalised</b>: turned into measurable procedures (for example, "number of errors on a Stroop task in 2 minutes"). Good operational definitions are specific, reliable and plausibly valid.',
    'In a <b>between-subjects</b> design, different people do each condition, so <b>random assignment</b> is needed to balance individual differences. In a <b>within-subjects</b> design, everyone does every condition, which is more powerful but invites <b>order effects</b> (practice, fatigue, carry-over); <b>counterbalancing</b> spreads these evenly.',
    'A <b>confound</b> is any variable that changes along with the IV. Correlational and quasi-experimental studies cannot rule out confounds as well, so they support weaker causal claims.',
  ]));

  // Research design builder
  body.appendChild(h('h3', null, 'Research Design Builder'));
  const d = { question: 'Does background music reduce recall of word lists?', iv: 'Background sound', levels: 'silence, instrumental music, lyrical music', dv: 'Words recalled', operational: 'Number of words correctly written down in 90 s after studying a 20-word list', design: 'within', n: 30 };
  const field = (label, key, type = 'text') => {
    const inp = h(type === 'area' ? 'textarea' : 'input', { type: type === 'area' ? null : type, value: d[key], 'aria-label': label, oninput: () => { d[key] = type === 'number' ? +inp.value : inp.value; update(); } });
    if (type === 'area') inp.value = d[key];
    return h('label', { class: 'f' }, label, inp);
  };
  const summary = h('div', { class: 'card', 'aria-live': 'polite' });
  const cbHost = h('div');
  const levelsOf = () => d.levels.split(',').map((s) => s.trim()).filter(Boolean);
  const update = () => {
    const L = levelsOf(), k = L.length, warn = [];
    if (k < 2) warn.push('An IV needs at least two levels (conditions).');
    if (!d.dv.trim()) warn.push('Name the DV.');
    if (d.operational.trim().length < 15) warn.push('Operationalise the DV: say exactly how and when it is measured.');
    if (!/\d|count|number|time|ms|score|rating|percent|errors?/i.test(d.operational)) warn.push('Your operational definition does not mention a measurable unit (count, time, rating…).');
    const perCell = d.design === 'between' ? Math.floor(d.n / Math.max(1, k)) : d.n;
    if (perCell < 20) warn.push(`Only ${perCell} observations per condition: check power in the Statistics Workbench.`);
    summary.innerHTML = '';
    summary.append(h('h4', null, 'Design summary'),
      h('p', null, `${k}-level ${d.design === 'between' ? 'between-subjects' : 'within-subjects'} design. IV: ${d.iv} (${L.join(' / ')}). DV: ${d.dv}, measured as: ${d.operational}.`),
      h('p', null, d.design === 'between' ? `With N = ${d.n}, about ${perCell} people per condition after random assignment.` : `Each of the N = ${d.n} participants completes all ${k} conditions; order must be counterbalanced.`),
      warn.length ? h('ul', null, warn.map((w) => h('li', null, '⚠ ' + w))) : h('p', null, '✓ No structural problems detected. Now hunt for confounds below.'));
    cbHost.innerHTML = '';
    if (d.design === 'within' && k >= 2 && k <= 8) {
      const sq = api.timeline.latinSquare(k);
      const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
      const col = api.charts.OI;
      cbHost.append(h('p', null, `Balanced Latin square (Williams design) for ${k} conditions: ${sq.length} orders instead of ${fact(k)} for complete counterbalancing. Each condition appears once in every serial position${k % 2 === 0 ? ' and follows every other condition equally often' : ''}. Participant i gets row ((i − 1) mod ${sq.length}) + 1.`),
        api.table(['Order', ...L.map((_, i) => 'Position ' + (i + 1))], sq.map((row, r) => ['Row ' + (r + 1), ...row.map((c) => h('span', { style: { background: col[c % 8], color: '#111', padding: '1px 6px', borderRadius: '4px' } }, `${String.fromCharCode(65 + c)}: ${L[c]}`))])),
        api.charts.bar(L.map((name, c) => ({ name: String.fromCharCode(65 + c), value: sq.reduce((s, row) => s + row.indexOf(c) + 1, 0) / sq.length })), { label: 'Mean serial position of each condition across Latin-square rows (equal bars = position balanced)', yl: 'mean position', yr: [0, k + 0.5] }));
    } else if (d.design === 'within') cbHost.append(h('p', { class: 'note' }, 'Enter 2–8 levels to see a counterbalancing scheme.'));
    else cbHost.append(h('p', { class: 'note' }, 'Between-subjects: no counterbalancing needed, but random assignment is essential (see demo below).'));
  };
  body.append(h('div', { class: 'grid2' }, field('Research question', 'question'), field('Independent variable (IV)', 'iv'), field('IV levels (comma-separated)', 'levels'), field('Dependent variable (DV)', 'dv'),
    field('Operational definition of the DV', 'operational', 'area'), h('div', null, api.select('Design', [{ value: 'within', label: 'Within-subjects (repeated measures)' }, { value: 'between', label: 'Between-subjects (independent groups)' }], d.design, (v) => { d.design = v; update(); }), field('Planned N', 'n', 'number'))),
  summary, cbHost,
  h('div', { class: 'row' }, btn('Save design', () => {
    const design = Object.assign({}, d, { levels: levelsOf(), counterbalance: d.design === 'within' ? 'latin-square' : 'random-assignment', savedAt: new Date().toISOString() });
    sim.state.designs = sim.state.designs || [];
    sim.state.designs.push(design);
    api.emit('builder:save', { design });
    sim.addXP(20, 'Saved a research design');
    api.toast(`Design saved (${sim.state.designs.length} saved). Submit it to the Ethics Board next.`);
  }, 'primary'), btn('Export design (JSON)', () => { api.download('zehn_design.json', JSON.stringify(Object.assign({}, d, { levels: levelsOf() }), null, 2), 'application/json'); api.emit('export:done', { kind: 'json' }); }, 'ghost'),
  btn('Open Experiment Builder', () => api.openPanel('builder'), 'ghost'), btn('Submit to Ethics Board', () => api.openPanel('irb'), 'ghost')));
  update();

  // Random assignment demo
  body.appendChild(h('h3', null, 'Random assignment demo'));
  body.append(h('p', null, 'Each simulated volunteer has a hidden "ability" score. Random assignment does not guarantee identical groups, but it makes differences unsystematic and smaller as N grows. Compare it with assigning by sign-up order, where keen (more able) volunteers sign up first.'), api.simLabel());
  let nRA = 40, seed = 101;
  const raOut = h('div', { 'aria-live': 'polite' });
  const assign = (method) => {
    const rng = new api.Rng(seed++);
    const people = api.participants.cohort(rng, nRA);
    let order = method === 'random' ? rng.shuffle(people) : people.slice().sort((a, b) => (b.ability + rng.normal(0, 0.5)) - (a.ability + rng.normal(0, 0.5)));
    const A = order.slice(0, Math.floor(nRA / 2)).map((p) => p.ability), B = order.slice(Math.floor(nRA / 2)).map((p) => p.ability);
    // sampling distribution of the difference under random assignment
    const diffs = [];
    for (let i = 0; i < 300; i++) { const sh = rng.shuffle(people); const a = sh.slice(0, Math.floor(nRA / 2)).map((p) => p.ability), b = sh.slice(Math.floor(nRA / 2)).map((p) => p.ability); diffs.push(api.stats.mean(a) - api.stats.mean(b)); }
    const dA = api.stats.describe(A), dB = api.stats.describe(B);
    raOut.innerHTML = '';
    raOut.append(api.simLabel(), h('p', null, `${method === 'random' ? 'Random assignment' : 'Sign-up order (first half → Group A)'}: Group A mean ability ${fmt(dA.mean)}, Group B ${fmt(dB.mean)}; difference ${fmt(dA.mean - dB.mean)} SD units.`),
      api.charts.bar([{ name: 'Group A', value: dA.mean, err: dA.sem }, { name: 'Group B', value: dB.mean, err: dB.sem }], { label: 'Baseline ability by group (mean ± SE), simulated', yl: 'ability (z)' }),
      api.charts.histogram(diffs, { bins: 20, label: `Differences between group means over 300 random re-assignments of N = ${nRA} (simulated)`, xl: 'A − B ability difference' }),
      h('p', { class: 'note' }, `Under random assignment, 95% of differences fall within ±${fmt(1.96 * api.stats.sd(diffs))}. ${method === 'random' ? '' : 'The sign-up method produced a systematic gap: a confound.'} Increase N and watch the spread shrink.`));
  };
  body.append(api.slider('Number of volunteers', { min: 10, max: 300, step: 10, value: nRA, onInput: (v) => { nRA = v; } }),
    h('div', { class: 'row' }, btn('Assign randomly', () => assign('random'), 'primary'), btn('Assign by sign-up order', () => assign('signup'), 'ghost')), raOut);

  // Confound spotter
  body.appendChild(h('h3', null, 'Confound spotter'));
  let ci = 0, cs = 0, answered = 0;
  const cBox = h('div', { class: 'card' }), cOut = h('div', { 'aria-live': 'polite' });
  const drawC = () => {
    const it = CONFOUNDS[ci % CONFOUNDS.length]; cBox.innerHTML = '';
    cBox.append(h('h4', null, `Scenario ${(ci % CONFOUNDS.length) + 1} of ${CONFOUNDS.length}`), h('p', null, it.s), h('div', { class: 'row' }, it.o.map((o, k) => btn(o, () => {
      const ok = k === it.c; answered++; if (ok) cs++;
      cOut.innerHTML = '';
      cOut.append(h('p', null, h('b', null, ok ? '✓ Correct. ' : '✗ Not quite. The main problem: ' + it.o[it.c] + '. '), it.why), h('p', null, h('b', null, 'Fix: '), it.fix), h('p', { class: 'note' }, `Score: ${cs}/${answered}`));
      if (ok) sim.addXP(5, 'Spotted a confound');
    }, 'ghost'))), btn('Next scenario ▶', () => { ci++; cOut.innerHTML = ''; drawC(); }, ''));
  };
  drawC();
  body.append(cBox, cOut);

  body.appendChild(h('h3', null, 'Research strategies at a glance'));
  body.appendChild(api.table(['Strategy', 'What it tells you', 'Main limitation'], [
    ['Case study', 'Rich detail on a rare person or event', 'May not generalise'], ['Naturalistic observation', 'Behaviour in real settings', 'Observer effects; no control'],
    ['Survey', 'Attitudes from many people quickly', 'Self-report and sampling bias'], ['Correlational', 'Whether variables go together and how strongly', 'No causal conclusion (third variables, direction)'],
    ['Quasi-experiment', 'Group comparisons where assignment is impossible', 'Pre-existing differences'], ['True experiment', 'Cause and effect', 'Artificiality; ethics limits what can be manipulated'],
  ]));
  body.appendChild(factBlock(api, ['F-TIME', 'F-OSC']));
  body.appendChild(glossChips(api, ['Independent variable', 'Dependent variable', 'Operational definition', 'Confounding variable', 'Random assignment', 'Random sampling', 'Within-subjects design', 'Between-subjects design', 'Counterbalancing', 'Latin square', 'Order effects', 'Demand characteristics', 'Double-blind study', 'Internal validity', 'External validity']));
  body.appendChild(links(api, { paradigms: ['stroop', 'visual_search'], zone: 'library', panels: ['builder', 'irb', 'stats'] }));
}

/* ------------------------------------------------------------------ 5. IRB */

const CODE_TEXT = {
  'APA 2.01': 'Boundaries of competence — work only within the limits of your training, supervision and experience.',
  'APA 3.04': 'Avoiding harm — take reasonable steps to prevent foreseeable harm to participants and others.',
  'APA 3.05': 'Multiple relationships — avoid dual roles (e.g. teacher and researcher) that could impair judgement or exploit.',
  'APA 3.10': 'Informed consent (general) — explain in understandable language; for those who cannot consent, seek assent plus permission from an authorised person.',
  'APA 4.01': 'Maintaining confidentiality — protect information obtained from participants.',
  'APA 4.04': 'Minimising intrusions on privacy — collect and share only what the purpose needs.',
  'APA 4.05': 'Disclosures — share confidential information only with consent or where legally required or permitted.',
  'APA 8.01': 'Institutional approval — obtain approval before starting and follow the approved protocol.',
  'APA 8.02': 'Informed consent to research — tell people the purpose, duration, procedures, their right to decline or withdraw and its consequences, foreseeable risks, benefits, limits of confidentiality, incentives and whom to contact.',
  'APA 8.03': 'Consent for recording voices and images — obtain permission before recording, except in naturalistic public observation or when deception requires later consent.',
  'APA 8.04': 'Students, clients and subordinates as participants — protect them from adverse consequences of declining or withdrawing; offer fair alternatives to course credit.',
  'APA 8.05': 'Dispensing with consent — allowed only where research is unlikely to cause distress or harm (e.g. anonymous questionnaires, naturalistic observation) or is permitted by law or regulation.',
  'APA 8.06': 'Inducements — avoid excessive or inappropriate incentives that could coerce participation.',
  'APA 8.07': 'Deception in research — use only when justified by significant value and no effective non-deceptive alternative exists; never deceive about things likely to cause pain or severe distress; explain the deception as early as feasible and allow withdrawal of data.',
  'APA 8.08': 'Debriefing — promptly give participants information about the nature, results and conclusions of the study, correct misconceptions, and reduce any harm discovered.',
  'Belmont: Respect for persons': 'Respect for persons — treat people as autonomous agents who decide for themselves, and give extra protection to those with reduced autonomy (children, people in custody, people with impaired capacity). In practice: informed, voluntary consent.',
  'Belmont: Beneficence': 'Beneficence — do not harm; maximise possible benefits and minimise possible risks. In practice: a systematic risk–benefit assessment.',
  'Belmont: Justice': 'Justice — share the burdens and benefits of research fairly; do not recruit people just because they are easy to reach or vulnerable. In practice: fair selection of participants.',
};

function renderIRB(body, api) {
  const { h, btn, sim } = api;
  const P = sim.data.irb || [];
  sim.state.irb = sim.state.irb || {};
  body.appendChild(h('h3', null, 'You are on the Ethics Board'));
  body.append(...paras(api, [
    'Before research with people begins, an <b>Institutional Review Board (IRB)</b> or ethics committee checks that the study respects participants. Members ask: Is consent truly informed and voluntary? Are risks minimised and justified by benefits? Are vulnerable groups protected? Is deception necessary, and is there a full debrief? Are data kept confidential?',
    'Review each proposal and decide: <b>Approve</b> (ethical as written), <b>Revise</b> (fixable problems) or <b>Reject</b> (harm or rights violations that cannot be fixed by small changes). Then compare your decision with the board\'s, including the APA Ethics Code standards and Belmont principles involved. Your first decision on each proposal is recorded.',
  ]));
  let idx = Math.max(0, P.findIndex((p) => !sim.state.irb[p.id]));
  const scoreEl = h('p', { 'aria-live': 'polite' });
  const card = h('div', { class: 'card' });
  const chartHost = h('div');
  const tableHost = h('div');
  const decided = () => P.filter((p) => sim.state.irb[p.id]);
  const drawScore = () => {
    const d = decided(), ok = d.filter((p) => sim.state.irb[p.id].correct).length;
    scoreEl.textContent = `Reviewed ${d.length}/${P.length} · agreement with the board ${ok}/${d.length || 0}${d.length ? ' (' + Math.round(100 * ok / d.length) + '%)' : ''}.`;
    chartHost.innerHTML = '';
    const cats = ['approve', 'revise', 'reject'];
    if (d.length) chartHost.appendChild(api.charts.bar(cats.map((c) => ({ name: c, value: d.filter((p) => sim.state.irb[p.id].decision === c).length })).concat(cats.map((c) => ({ name: 'board ' + c, value: d.filter((p) => p.correct === c).length }))), { label: 'Your decisions versus the board\'s, for proposals you have reviewed', yl: 'proposals', colors: ['#E69F00', '#E69F00', '#E69F00', '#56B4E9', '#56B4E9', '#56B4E9'] }));
    tableHost.innerHTML = '';
    tableHost.appendChild(api.table(['#', 'Proposal', 'Your decision', 'Board'], P.map((p, i) => {
      const r = sim.state.irb[p.id];
      return [p.id, h('button', { type: 'button', class: 'btn ghost', onclick: () => { idx = i; draw(); } }, p.title), r ? `${r.decision} ${r.correct ? '✓' : '✗'}` : '—', r ? p.correct : '(hidden)'];
    })));
  };
  const feedback = (p, decision, practice) => {
    const ok = decision === p.correct;
    return h('div', null,
      h('p', null, h('b', null, ok ? '✓ You agree with the board: ' : '✗ The board decided: '), p.correct.toUpperCase() + (practice ? ' (practice attempt; your first decision stays recorded)' : '')),
      h('p', null, h('b', null, 'Reasons:')), h('ul', null, p.reasons.map((r) => h('li', null, r))),
      h('p', null, h('b', null, 'Standards involved:')), h('ul', null, p.codes.map((c) => h('li', null, h('b', null, c + ': '), CODE_TEXT[c] ? CODE_TEXT[c].replace(/^[^—]*— /, '') : 'See the APA Ethics Code.'))));
  };
  const draw = () => {
    const p = P[idx]; card.innerHTML = '';
    if (!p) { card.textContent = 'No proposals loaded.'; return; }
    const rec = sim.state.irb[p.id];
    const fb = h('div', { 'aria-live': 'polite' });
    const decide = (decision) => {
      const correct = decision === p.correct;
      fb.innerHTML = '';
      if (!sim.state.irb[p.id]) {
        sim.state.irb[p.id] = { decision, correct, at: new Date().toISOString() };
        api.emit('irb:decision', { id: p.id, decision, correct });
        if (correct) sim.addXP(25, 'IRB decision matched the board');
        fb.appendChild(feedback(p, decision, false));
        drawScore();
      } else fb.appendChild(feedback(p, decision, true));
    };
    card.append(h('h4', null, `${p.id} — ${p.title}`), h('p', null, h('span', { class: 'pill' }, p.design)), h('p', null, p.summary),
      h('p', null, h('b', null, 'Risks noted by the applicants: '), p.risks.join('; ')),
      h('div', { class: 'row' }, btn('Approve', () => decide('approve'), 'teal'), btn('Revise', () => decide('revise'), ''), btn('Reject', () => decide('reject'), 'ghost')),
      h('div', { class: 'row' }, btn('◀ Previous', () => { idx = (idx - 1 + P.length) % P.length; draw(); }, 'ghost'), btn('Next ▶', () => { idx = (idx + 1) % P.length; draw(); }, 'ghost'),
        btn('Next unreviewed', () => { const j = P.findIndex((q) => !sim.state.irb[q.id]); if (j < 0) api.toast('All proposals reviewed. Use Previous/Next to revisit.'); else { idx = j; draw(); } }, 'ghost'),
        api.service('director') ? btn('Hold hearing in the IRB chamber', () => { api.service('director').presentIRB(p.id); }, 'ghost') : null),
      fb);
    if (rec) { fb.append(h('p', { class: 'note' }, `Recorded decision: ${rec.decision}. You can choose again for practice.`), feedback(p, rec.decision, false)); }
  };
  body.append(scoreEl, card, chartHost);
  draw(); drawScore();

  body.appendChild(h('h3', null, 'Key standards (paraphrased)'));
  body.appendChild(api.table(['Standard', 'What it requires (paraphrase, not the official text)'], ['APA 8.02', 'APA 8.07', 'APA 8.08'].map((c) => [c, api.esc(CODE_TEXT[c].replace(/^[^—]*— /, ''))])));
  body.appendChild(h('div', { class: 'grid2' }, ['Belmont: Respect for persons', 'Belmont: Beneficence', 'Belmont: Justice'].map((c) => h('div', { class: 'card' }, h('h4', null, c.replace('Belmont: ', '')), h('p', null, CODE_TEXT[c].replace(/^[^—]*— /, ''))))));
  body.appendChild(h('p', { class: 'note' }, 'For exact wording, consult the APA Ethical Principles of Psychologists and Code of Conduct and the Belmont Report. Proposals are simulated teaching cases.'));
  body.appendChild(h('h3', null, 'All proposals'));
  body.appendChild(tableHost);
  body.appendChild(factBlock(api, ['F-MIL', 'F-BAUMRIND', 'F-BURGER', 'F-SPE']));
  body.appendChild(glossChips(api, ['Institutional Review Board (IRB)', 'Informed consent', 'Deception', 'Debriefing', 'Confidentiality', 'Anonymity', 'Right to withdraw', 'Vulnerable populations', 'Minimal risk', 'Belmont Report', 'Respect for persons', 'Beneficence', 'Justice (research ethics)', 'APA Ethics Code']));
  body.appendChild(links(api, { paradigms: ['asch', 'misinformation'], zone: 'library', panels: ['methods', 'cases', 'aiethics'] }));
}

/* ------------------------------------------------------------------ 6. STATS */

const TOOLS = [
  { id: 'describe', label: 'Descriptives + histogram/boxplot' },
  { id: 'z', label: 'z / T / IQ-style converter' },
  { id: 't_ind', label: 'Independent t (Student / Welch)' },
  { id: 't_paired', label: 'Paired t' },
  { id: 't_one', label: 'One-sample t' },
  { id: 'anova', label: 'One-way ANOVA' },
  { id: 'chi2_gof', label: 'χ² goodness of fit' },
  { id: 'chi2_ind', label: 'χ² test of independence' },
  { id: 'corr', label: 'Pearson r' },
  { id: 'regression', label: 'Simple regression' },
  { id: 'd', label: 'Cohen\'s d (from summary statistics)' },
  { id: 'power', label: 'Power and sample size' },
  { id: 'ci', label: 'Confidence interval for a mean' },
];

/** Simulated class dataset (labelled Simulated data; effects are invented). */
function simClass(api, n, seed) {
  const rng = new api.Rng(seed);
  const people = api.participants.cohort(rng, n);
  const cols = { group: [], year: [], residence: [], study_place: [], study_hours: [], exam_score: [], anxiety: [], rt_congruent: [], rt_incongruent: [], extraversion: [], neuroticism: [] };
  const order = rng.shuffle(people.map((_, i) => i));
  people.forEach((p, i) => {
    const grp = order.indexOf(i) < n / 2 ? 'control' : 'training';
    const yr = ['Y1', 'Y2', 'Y3'][i % 3];
    const res = rng.chance(0.45) ? 'hostel' : 'day scholar';
    const place = res === 'hostel' ? rng.pick(['library', 'library', 'room', 'cafe']) : rng.pick(['library', 'home', 'home', 'cafe']);
    const hrs = Math.max(0, rng.normal(10 + 2.5 * p.ability, 3));
    const exam = Math.min(100, Math.max(0, 58 + 5 * p.ability + 0.9 * (hrs - 10) + (grp === 'training' ? 4 : 0) + rng.normal(0, 7)));
    const anx = Math.max(10, Math.min(80, 30 + 6 * (p.big5.N - 3) + (yr === 'Y1' ? 5 : yr === 'Y3' ? 2 : 0) + rng.normal(0, 7)));
    let c = 0, inc = 0;
    for (let k = 0; k < 16; k++) { c += api.participants.drawRT(p, rng, { mu: 560 }).rt; inc += api.participants.drawRT(p, rng, { mu: 560, effect: 70 }).rt; }
    cols.group.push(grp); cols.year.push(yr); cols.residence.push(res); cols.study_place.push(place);
    cols.study_hours.push(+hrs.toFixed(1)); cols.exam_score.push(+exam.toFixed(1)); cols.anxiety.push(+anx.toFixed(1));
    cols.rt_congruent.push(Math.round(c / 16)); cols.rt_incongruent.push(Math.round(inc / 16));
    cols.extraversion.push(+p.big5.E.toFixed(2)); cols.neuroticism.push(+p.big5.N.toFixed(2));
  });
  return makeDataset(`Simulated class (N = ${n}, seed ${seed})`, true, cols);
}
function makeDataset(name, simulated, raw) {
  const cols = {};
  for (const [k, vals] of Object.entries(raw)) {
    const nonEmpty = vals.filter((v) => v !== '' && v != null);
    const isNum = nonEmpty.length > 0 && nonEmpty.every((v) => v !== true && v !== false && Number.isFinite(+v));
    cols[k] = { type: isNum ? 'num' : 'cat', values: isNum ? vals.map((v) => (v === '' || v == null ? NaN : +v)) : vals.map((v) => (v == null ? '' : String(v))) };
  }
  const n = Math.max(0, ...Object.values(raw).map((v) => v.length));
  return { name, simulated, cols, n };
}
function fromRows(id, rows) {
  const fields = ['condition', 'block', 'trial', 'rt_ms', 'response', 'correct', 'stimulus', 'pid'];
  const main = rows.filter((r) => r.block !== 'practice');
  const raw = {};
  for (const f of fields) if (main.some((r) => r[f] !== undefined && r[f] !== '')) raw[f] = main.map((r) => (r[f] === undefined ? '' : r[f]));
  return makeDataset(`Your ${id} data (${main.length} trials)`, false, raw);
}
/** Parse pasted text: CSV with header, or a plain list of numbers. Exported for tests. */
function parsePasted(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const lines = t.split(/\r?\n/).filter((l) => l.trim());
  const sep = lines[0].includes(',') ? ',' : lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : null;
  const first = sep ? lines[0].split(sep).map((s) => s.trim()) : [lines[0].trim()];
  const header = first.some((c) => c !== '' && !Number.isFinite(+c));
  if (!header) {
    const nums = t.split(/[\s,;\t]+/).filter(Boolean).map(Number).filter(Number.isFinite);
    return nums.length ? { x: nums } : null;
  }
  const raw = {};
  first.forEach((hname, j) => { raw[hname || 'col' + (j + 1)] = lines.slice(1).map((l) => { const c = (sep ? l.split(sep) : [l])[j]; return c == null ? '' : c.trim().replace(/^"|"$/g, ''); }); });
  return raw;
}
/** Tolerance check for try-first mode. Exported for tests. */
function withinTol(guess, truth, tol) { return Number.isFinite(guess) && Math.abs(guess - truth) <= tol; }
const tolFor = (truth) => Math.max(0.02, Math.abs(truth) * 0.02);

function renderStats(body, api) {
  const { h, btn, sim, stats: S } = api;
  body.appendChild(h('h3', null, 'Statistics Workbench'));
  body.append(...paras(api, [
    '<b>Descriptive statistics</b> summarise a sample (centre, spread, shape). <b>Inferential statistics</b> ask whether a pattern is larger than we would expect from sampling error alone, assuming the null hypothesis is true. The <i>p</i>-value is that probability; it is <b>not</b> the probability that the hypothesis is true.',
    'Always report an <b>effect size</b> (Cohen\'s <i>d</i>, <i>r</i>, η²) and, ideally, a <b>confidence interval</b>: significance depends heavily on sample size, effect size does not. <b>Power</b> is the probability of detecting an effect of a given size; underpowered studies produce unreliable, often exaggerated results.',
    'Choose a data source, then a tool. In <b>Try first</b> mode you enter your own hand-computed value before the Workbench reveals the answer, and you are told whether you are within tolerance. The AI mentor follows the same rule: it critiques but never computes for you until you have tried.',
  ]));

  // ---- data source
  const ownIds = Object.keys(sim.datasets || {}).filter((k) => !k.endsWith(':bot') && (sim.datasets[k] || []).length);
  let srcKey = ownIds.length ? 'own:' + ownIds[0] : 'sim';
  let simN = 40, simSeed = 2025, pasted = '';
  let ds = null;
  const srcInfo = h('div', { class: 'card', 'aria-live': 'polite' });
  const srcExtra = h('div');
  const pasteArea = h('textarea', { 'aria-label': 'Paste CSV with a header row, or a list of numbers', placeholder: 'group,score\nA,12\nA,15\nB,9\n… or just: 12 15 9 11 14', oninput: () => { pasted = pasteArea.value; } });
  const loadSource = () => {
    srcExtra.innerHTML = '';
    if (srcKey === 'sim') {
      ds = simClass(api, simN, simSeed);
      srcExtra.append(api.slider('Class size N', { min: 10, max: 200, step: 2, value: simN, onInput: (v) => { simN = v; } }),
        h('div', { class: 'row' }, btn('Generate new sample', () => { simSeed++; loadSource(); }, 'ghost'), btn('Apply N', () => loadSource(), 'ghost'),
          btn('Download sample as CSV', () => { const keys = Object.keys(ds.cols); api.download('zehn_simulated_class.csv', [keys.join(',')].concat(Array.from({ length: ds.n }, (_, i) => keys.map((k) => ds.cols[k].values[i]).join(','))).join('\n'), 'text/csv'); api.emit('export:done', { kind: 'csv' }); }, 'ghost')));
    } else if (srcKey === 'paste') {
      pasteArea.value = pasted;
      srcExtra.append(pasteArea, btn('Load pasted data', () => { const raw = parsePasted(pasted); if (!raw) { api.toast('Nothing numeric to load.'); return; } ds = makeDataset('Pasted data', false, raw); drawInfo(); drawTool(); }, 'primary'));
      if (!ds || ds.name !== 'Pasted data') { const raw = parsePasted(pasted); ds = raw ? makeDataset('Pasted data', false, raw) : null; }
    } else {
      const id = srcKey.slice(4);
      ds = fromRows(id, sim.datasets[id] || []);
    }
    drawInfo(); drawTool();
  };
  const drawInfo = () => {
    srcInfo.innerHTML = '';
    if (!ds) { srcInfo.append(h('p', null, 'No data loaded yet. Paste numbers above and press "Load pasted data".')); return; }
    srcInfo.append(h('h4', null, ds.name), ds.simulated ? api.simLabel() : null, ds.simulated ? h('span', { class: 'note' }, 'Simulated effect sizes: generated by the participant model, not real findings.') : null,
      h('p', { class: 'note' }, `${ds.n} rows. Columns: ` + Object.entries(ds.cols).map(([k, c]) => `${k} (${c.type === 'num' ? 'numeric' : 'categorical'})`).join(', ')));
  };
  const srcOpts = [{ value: 'sim', label: 'Simulated class dataset' }, { value: 'paste', label: 'Paste CSV / numbers' }].concat(ownIds.map((id) => ({ value: 'own:' + id, label: 'My data: ' + ((api.paradigm(id) || {}).title || id) })));
  body.append(h('h3', null, '1 · Data source'), api.select('Data source', srcOpts, srcKey, (v) => { srcKey = v; loadSource(); }), srcExtra, srcInfo);
  if (!ownIds.length) body.append(h('p', { class: 'note' }, 'Run a paradigm as a participant to analyse your own data here. ', btn('Run Stroop', () => safeRun(api, 'stroop'), 'ghost')));

  // ---- tool
  let tool = 't_ind', tryFirst = true;
  const toolArea = h('div');
  const tf = h('input', { type: 'checkbox', checked: true, 'aria-label': 'Try first mode', onchange: () => { tryFirst = tf.checked; } });
  body.append(h('h3', null, '2 · Tool'), h('div', { class: 'row' }, api.select('Analysis', TOOLS.map((t) => ({ value: t.id, label: t.label })), tool, (v) => { tool = v; drawTool(); }),
    h('label', { class: 'row' }, tf, 'Try first (enter my own value before the answer)')), toolArea);

  const numCols = () => (ds ? Object.keys(ds.cols).filter((k) => ds.cols[k].type === 'num') : []);
  const catCols = () => (ds ? Object.keys(ds.cols).filter((k) => ds.cols[k].type === 'cat' || (ds.cols[k].type === 'num' && new Set(ds.cols[k].values.filter(Number.isFinite)).size <= 8)) : []);
  const pick = (list, pref) => pref.find((p) => list.includes(p)) || list[0];
  const colSel = (label, list, val, set) => api.select(label, list.length ? list : ['(none)'], val, set);
  const levelsOf = (c) => Array.from(new Set(ds.cols[c].values.map(String).filter((v) => v !== '' && v !== 'NaN')));
  const numVals = (c) => ds.cols[c].values.filter(Number.isFinite);
  const groupVals = (dv, g, lvl) => ds.cols[dv].values.filter((v, i) => String(ds.cols[g].values[i]) === lvl && Number.isFinite(v));

  /** Try-first gate: emits stats:test immediately, reveals render() after an attempt (or at once if Try first is off). */
  const present = (out, { test, key, truth, hint, render }) => {
    out.innerHTML = '';
    api.emit('stats:test', { test });
    const reveal = () => { out.querySelectorAll('.reveal').forEach((n) => n.remove()); const box = h('div', { class: 'reveal' }); box.append(...render()); out.appendChild(box); };
    if (!tryFirst || !Number.isFinite(truth)) { reveal(); return; }
    const tol = tolFor(truth);
    let attempts = 0;
    const inp = h('input', { type: 'number', step: 'any', 'aria-label': 'Your value for ' + key });
    const fb = h('p', { 'aria-live': 'polite' });
    out.append(h('div', { class: 'card' }, h('p', null, h('b', null, 'Try first: '), `compute ${key} yourself and enter it (tolerance ±${fmt(tol, 3)}).`), h('p', { class: 'note', html: hint }),
      h('div', { class: 'row' }, inp, btn('Check my value', () => {
        const g = parseFloat(inp.value);
        if (!Number.isFinite(g)) { fb.textContent = 'Enter a number first.'; return; }
        attempts++;
        if (withinTol(g, truth, tol)) { fb.textContent = `✓ Within tolerance. Well done — revealing the full output.`; sim.addXP(10, 'Computed a statistic by hand'); reveal(); } else fb.textContent = `✗ Not within tolerance (attempt ${attempts}). Re-check your working, then try again or reveal the answer.`;
      }, 'primary'), btn('Reveal answer', () => { if (!attempts) { fb.textContent = 'Have one go first (or untick "Try first").'; return; } fb.textContent = `The value was ${fmt(truth, 3)}.`; reveal(); }, 'ghost')), fb));
  };
  const apaP = (s) => h('p', { class: 'apa-out', html: apaHtml(api, s) });
  const ctrl = h('div'), out = h('div', { 'aria-live': 'polite' });

  function drawTool() {
    toolArea.innerHTML = ''; ctrl.innerHTML = ''; out.innerHTML = '';
    toolArea.append(ctrl, out);
    const T = TOOLS.find((t) => t.id === tool);
    const needsData = !['z', 'd', 'power', 'chi2_gof', 'chi2_ind'].includes(tool);
    if (needsData && (!ds || !numCols().length)) { ctrl.append(h('p', null, 'This tool needs a dataset with at least one numeric column.')); return; }
    const N = numCols(), C = catCols();
    const run = (fn) => btn('Run ' + T.label, () => { try { fn(); } catch (e) { out.innerHTML = ''; out.append(h('p', null, 'Cannot compute: ' + e.message)); } }, 'primary');

    if (tool === 'describe') {
      let v = pick(N, ['exam_score', 'rt_ms', 'x']), g = '(none)';
      ctrl.append(h('div', { class: 'row' }, colSel('Variable', N, v, (x) => { v = x; }), api.select('Split by (optional)', ['(none)'].concat(C), g, (x) => { g = x; })), run(() => {
        const xs = numVals(v); if (xs.length < 2) throw new Error('need at least 2 values');
        const D = S.describe(xs);
        present(out, { test: 'describe', key: 'the mean', truth: D.mean, hint: 'M = Σx / n', render: () => {
          const groups = g !== '(none)' ? levelsOf(g).slice(0, 8).map((l) => ({ name: l, values: groupVals(v, g, l) })).filter((q) => q.values.length) : [{ name: v, values: xs }];
          return [ds.simulated ? api.simLabel() : null,
            api.table(['n', 'M', 'SD (sample)', 'σ (population)', 'Median', 'Q1–Q3', 'Min–Max', 'Skew', 'SE'], [[D.n, fmt(D.mean), fmt(D.sd), fmt(D.sdPop), fmt(D.median), `${fmt(D.q1)}–${fmt(D.q3)}`, `${fmt(D.min)}–${fmt(D.max)}`, fmt(D.skew), fmt(D.sem)]]),
            apaP(api.apa.mean(D.mean, D.sd) + ` (n = ${D.n})`),
            api.charts.histogram(xs, { bins: Math.min(20, Math.max(5, Math.round(Math.sqrt(xs.length)))), label: `Histogram of ${v} with fitted normal curve`, xl: v, normal: true }),
            api.charts.boxplot(groups, { label: `Boxplot of ${v}${g !== '(none)' ? ' by ' + g : ''}`, yl: v }),
            h('p', { class: 'note' }, `Tukey outliers (beyond 1.5 × IQR): ${S.outliers(xs).length}. ${Math.abs(D.skew) > 1 ? 'Strong skew: consider the median and a transformation.' : 'Skew is modest.'}`)];
        } });
      }));
    } else if (tool === 'z') {
      let x = 130, mu = 100, sigma = 15;
      const numIn = (label, val, set) => h('label', { class: 'f' }, label, h('input', { type: 'number', step: 'any', value: val, 'aria-label': label, oninput: (e) => set(+e.target.value) }));
      ctrl.append(h('p', null, 'z tells you how many standard deviations a score lies from the mean. T-scores (mean 50, SD 10) and IQ-style scores (mean 100, SD 15) are linear rescalings of z.'),
        h('div', { class: 'row' }, numIn('Raw score x', x, (v) => { x = v; }), numIn('Mean μ', mu, (v) => { mu = v; }), numIn('SD σ', sigma, (v) => { sigma = v; })), run(() => {
          if (!(sigma > 0)) throw new Error('σ must be positive');
          const z = S.z(x, mu, sigma);
          present(out, { test: 'z', key: 'z', truth: z, hint: 'z = (x − μ) / σ', render: () => {
            const pts = []; for (let i = 0; i <= 120; i++) { const zz = -4 + i / 15; pts.push({ x: zz, y: api.dist.normPdf(zz) }); }
            const zc = Math.max(-4, Math.min(4, z));
            const area = pts.filter((p) => p.x <= zc).flatMap((p) => [{ x: p.x, y: 0 }, { x: p.x, y: p.y }]);
            return [api.table(['z', 'T-score', 'IQ-style', 'Percentile'], [[fmt(z), fmt(S.tScore(z), 1), fmt(S.iqScore(z), 1), fmt(S.percentile(z), 1) + '%']]),
              api.charts.line([{ name: 'normal curve', points: pts, color: '#56B4E9' }, { name: 'area below z (shaded hatching)', points: area, color: 'rgba(230,159,0,.45)' }, { name: 'your score', points: [{ x: zc, y: 0 }, { x: zc, y: api.dist.normPdf(zc) }], color: '#D55E00' }], { label: `Standard normal curve; area left of z = ${fmt(z)} is ${fmt(S.percentile(z), 1)}%`, xl: 'z', yl: 'density', xr: [-4, 4], yr: [0, 0.45] }),
              h('p', null, `A score of ${x} is ${fmt(Math.abs(z))} SD ${z >= 0 ? 'above' : 'below'} the mean, higher than about ${fmt(S.percentile(z), 0)}% of a normal population.`)];
          } });
        }));
    } else if (tool === 't_ind' || tool === 'anova') {
      let dv = pick(N, tool === 'anova' ? ['anxiety', 'rt_ms'] : ['exam_score', 'rt_ms']), g = pick(C, tool === 'anova' ? ['year', 'condition'] : ['group', 'condition']);
      let welch = false, la = null, lb = null;
      const lvlHost = h('div', { class: 'row' });
      const drawLv = () => {
        lvlHost.innerHTML = '';
        if (tool !== 't_ind' || !g || !ds.cols[g]) return;
        const L = levelsOf(g); la = L[0]; lb = L[1];
        lvlHost.append(api.select('Group 1', L, la, (v) => { la = v; }), api.select('Group 2', L, lb, (v) => { lb = v; }),
          h('label', { class: 'row' }, h('input', { type: 'checkbox', 'aria-label': 'Welch correction', onchange: (e) => { welch = e.target.checked; } }), 'Welch (unequal variances)'));
      };
      ctrl.append(h('div', { class: 'row' }, colSel('Dependent variable', N, dv, (v) => { dv = v; }), colSel('Grouping variable', C, g, (v) => { g = v; drawLv(); })), lvlHost);
      drawLv();
      ctrl.append(run(() => {
        if (!C.length) throw new Error('no grouping variable');
        if (tool === 't_ind') {
          const a = groupVals(dv, g, la), b = groupVals(dv, g, lb);
          if (la === lb || a.length < 2 || b.length < 2) throw new Error('choose two different groups with at least 2 values each');
          const r = S.tIndependent(a, b, { welch });
          present(out, { test: 't_ind', key: 't', truth: r.t, hint: welch ? 't = (M₁ − M₂) / √(s₁²/n₁ + s₂²/n₂)' : 't = (M₁ − M₂) / [s<sub>p</sub>√(1/n₁ + 1/n₂)], s<sub>p</sub>² = [(n₁−1)s₁² + (n₂−1)s₂²] / (n₁+n₂−2)', render: () => [ds.simulated ? api.simLabel() : null,
            api.table(['Group', 'n', 'M', 'SD'], [[api.esc(la), r.n1, fmt(r.m1), fmt(r.sd1)], [api.esc(lb), r.n2, fmt(r.m2), fmt(r.sd2)]]),
            apaP(`${welch ? 'Welch\'s' : 'An independent-samples'} t test compared ${dv} between ${la} (${api.apa.mean(r.m1, r.sd1)}) and ${lb} (${api.apa.mean(r.m2, r.sd2)}), ${api.apa.t(r)}.`),
            api.charts.bar([{ name: la, value: r.m1, err: r.sd1 / Math.sqrt(r.n1) }, { name: lb, value: r.m2, err: r.sd2 / Math.sqrt(r.n2) }], { label: `Mean ${dv} by group (± SE)`, yl: dv }),
            api.charts.boxplot([{ name: la, values: a }, { name: lb, values: b }], { label: `Distribution of ${dv} by group`, yl: dv }),
            h('p', { class: 'note' }, `Cohen's d = ${fmt(r.d)} (pooled SD ${fmt(r.sp)}). Post-hoc power is not meaningful; plan power before collecting data.`)] });
        } else {
          const L = levelsOf(g).slice(0, 8), groups = L.map((l) => groupVals(dv, g, l)).filter((x) => x.length >= 2);
          if (groups.length < 2) throw new Error('need at least two groups with 2+ values');
          const r = S.anova1(groups);
          const Lk = L.filter((l) => groupVals(dv, g, l).length >= 2);
          present(out, { test: 'anova', key: 'F', truth: r.F, hint: 'F = MS<sub>between</sub> / MS<sub>within</sub>; MS = SS / df', render: () => [ds.simulated ? api.simLabel() : null,
            api.table(['Source', 'SS', 'df', 'MS', 'F', 'p'], [['Between', fmt(r.ssb), r.dfb, fmt(r.msb), fmt(r.F), api.apa.p(r.p)], ['Within', fmt(r.ssw), r.dfw, fmt(r.msw), '', ''], ['Total', fmt(r.sst), r.dfb + r.dfw, '', '', '']]),
            apaP(`A one-way ANOVA showed ${r.p < 0.05 ? 'a significant' : 'no significant'} effect of ${g} on ${dv}, ${api.apa.F(r)}.`),
            api.charts.bar(Lk.map((l, i) => ({ name: l, value: r.means[i], err: S.sd(groups[i]) / Math.sqrt(groups[i].length) })), { label: `Mean ${dv} by ${g} (± SE)`, yl: dv }),
            h('p', { class: 'note' }, 'A significant F says the means are not all equal; follow-up (post-hoc) comparisons with a correction such as Bonferroni identify which differ.')] });
        }
      }));
    } else if (tool === 't_paired' || tool === 'corr' || tool === 'regression') {
      let a = pick(N, tool === 't_paired' ? ['rt_congruent', 'rt_ms'] : ['study_hours', 'trial']), b = pick(N.filter((x) => x !== a), tool === 't_paired' ? ['rt_incongruent'] : ['exam_score', 'rt_ms']) || a;
      ctrl.append(h('div', { class: 'row' }, colSel(tool === 't_paired' ? 'Condition 1' : 'X (predictor)', N, a, (v) => { a = v; }), colSel(tool === 't_paired' ? 'Condition 2' : 'Y (outcome)', N, b, (v) => { b = v; })), run(() => {
        const xa = [], xb = [];
        ds.cols[a].values.forEach((v, i) => { const w = ds.cols[b].values[i]; if (Number.isFinite(v) && Number.isFinite(w)) { xa.push(v); xb.push(w); } });
        if (xa.length < 3) throw new Error('need at least 3 complete pairs');
        if (tool === 't_paired') {
          const r = S.tPaired(xa, xb), da = S.describe(xa), db = S.describe(xb);
          present(out, { test: 't_paired', key: 't', truth: r.t, hint: 't = d̄ / (s<sub>d</sub> / √n), where d = score₁ − score₂', render: () => [ds.simulated ? api.simLabel() : null,
            apaP(`A paired-samples t test compared ${a} (${api.apa.mean(da.mean, da.sd)}) with ${b} (${api.apa.mean(db.mean, db.sd)}), ${api.apa.t(r)}. Mean difference = ${fmt(r.meanDiff)}.`),
            api.charts.bar([{ name: a, value: da.mean, err: da.sem }, { name: b, value: db.mean, err: db.sem }], { label: 'Condition means (± SE)', yl: 'value' }),
            api.charts.histogram(xa.map((v, i) => v - xb[i]), { label: `Difference scores (${a} − ${b})`, xl: 'difference', bins: 12 })] });
        } else if (tool === 'corr') {
          const r = S.pearson(xa, xb), reg = S.regression(xa, xb);
          present(out, { test: 'corr', key: 'r', truth: r.r, hint: 'r = Σ(x − x̄)(y − ȳ) / √[Σ(x − x̄)² · Σ(y − ȳ)²]', render: () => [ds.simulated ? api.simLabel() : null,
            apaP(`${a} and ${b} were ${r.p < 0.05 ? 'significantly' : 'not significantly'} correlated, ${api.apa.r(r)}, r² = ${fmt(r.r * r.r)}.`),
            api.charts.scatter(xa, xb, { label: `Scatterplot of ${b} against ${a} with least-squares line`, xl: a, yl: b, line: { a: reg.a, b: reg.b } }),
            h('p', { class: 'note' }, 'Correlation is not causation: consider third variables and direction. r² is the proportion of variance shared.')] });
        } else {
          const reg = S.regression(xa, xb);
          present(out, { test: 'regression', key: 'the slope b', truth: reg.b, hint: 'b = r · (s<sub>y</sub> / s<sub>x</sub>); a = ȳ − b·x̄', render: () => [ds.simulated ? api.simLabel() : null,
            api.table(['Intercept a', 'Slope b', 'SE(b)', 'R²'], [[fmt(reg.a), fmt(reg.b, 3), fmt(reg.seB, 3), fmt(reg.r2, 3)]]),
            apaP(`${a} predicted ${b}, b = ${api.apa.num(reg.b, 3)}, t(${reg.df}) = ${api.apa.num(reg.t)}, p ${api.apa.p(reg.p)}, R² = ${api.apa.noLead(reg.r2)}.`),
            h('p', null, `Equation: ŷ = ${fmt(reg.a)} + ${fmt(reg.b, 3)} × ${a}. Predicted ${b} at ${a} = ${fmt(S.mean(xa))}: ${fmt(reg.predict(S.mean(xa)))}.`),
            api.charts.scatter(xa, xb, { label: `Regression of ${b} on ${a}`, xl: a, yl: b, line: { a: reg.a, b: reg.b } })] });
        }
      }));
    } else if (tool === 't_one' || tool === 'ci') {
      let v = pick(N, ['exam_score', 'rt_ms', 'x']), mu0 = 0, level = 0.95;
      ctrl.append(h('div', { class: 'row' }, colSel('Variable', N, v, (x) => { v = x; }),
        tool === 't_one' ? h('label', { class: 'f' }, 'Test value μ₀', h('input', { type: 'number', step: 'any', value: mu0, 'aria-label': 'Test value', oninput: (e) => { mu0 = +e.target.value; } })) : api.select('Confidence level', [{ value: 0.9, label: '90%' }, { value: 0.95, label: '95%' }, { value: 0.99, label: '99%' }], level, (x) => { level = +x; })),
      run(() => {
        const xs = numVals(v); if (xs.length < 2) throw new Error('need at least 2 values');
        const D = S.describe(xs);
        if (tool === 't_one') {
          const r = S.tOne(xs, mu0);
          present(out, { test: 't_one', key: 't', truth: r.t, hint: 't = (M − μ₀) / (s / √n)', render: () => [ds.simulated ? api.simLabel() : null,
            apaP(`The mean ${v} (${api.apa.mean(D.mean, D.sd)}) was compared with ${mu0}, ${api.apa.t(r)}.`),
            api.charts.histogram(xs, { label: `${v} with the test value ${mu0} in mind`, xl: v, normal: true })] });
        } else {
          const c = S.ciMean(xs, level);
          present(out, { test: 'ci', key: 'the lower bound', truth: c.lo, hint: 'CI = M ± t<sub>crit</sub> · s/√n, with df = n − 1', render: () => [ds.simulated ? api.simLabel() : null,
            apaP(`M = ${api.apa.num(c.mean)}, ${Math.round(level * 100)}% CI [${api.apa.num(c.lo)}, ${api.apa.num(c.hi)}], SE = ${api.apa.num(c.se)}.`),
            api.charts.forest([0.9, 0.95, 0.99].map((lv) => { const q = S.ciMean(xs, lv); return { name: `${Math.round(lv * 100)}% CI`, est: q.mean, lo: q.lo, hi: q.hi }; }), { label: `Confidence intervals for the mean of ${v}`, xl: v }),
            h('p', { class: 'note' }, 'Interpretation: the procedure captures the true mean in the stated percentage of repeated samples. Higher confidence means a wider interval.')] });
        }
      }));
    } else if (tool === 'chi2_gof' || tool === 'chi2_ind') {
      const manual = h('textarea', { 'aria-label': 'Manual counts', placeholder: tool === 'chi2_gof' ? 'Observed counts, e.g. 18 25 17' : 'Rows separated by ; e.g. 12 20 ; 25 8' });
      let c1 = pick(C, tool === 'chi2_gof' ? ['study_place', 'response'] : ['residence', 'condition']), c2 = pick(C.filter((x) => x !== c1), ['study_place', 'response', 'correct']);
      const sel = ds && C.length ? h('div', { class: 'row' }, colSel('Variable 1', C, c1, (v) => { c1 = v; }), tool === 'chi2_ind' ? colSel('Variable 2', C, c2, (v) => { c2 = v; }) : null) : h('p', { class: 'note' }, 'No categorical columns in this dataset: enter counts manually.');
      ctrl.append(sel, h('p', { class: 'note' }, 'Or type counts manually (used if filled):'), manual, run(() => {
        const txt = manual.value.trim();
        if (tool === 'chi2_gof') {
          let labels, obs;
          if (txt) { obs = txt.split(/[\s,;]+/).map(Number).filter(Number.isFinite); labels = obs.map((_, i) => 'cat ' + (i + 1)); } else { if (!c1) throw new Error('no data'); labels = levelsOf(c1); obs = labels.map((l) => ds.cols[c1].values.filter((v) => String(v) === l).length); }
          if (obs.length < 2) throw new Error('need at least 2 categories');
          const r = S.chi2Gof(obs);
          present(out, { test: 'chi2', key: 'χ²', truth: r.chi2, hint: 'χ² = Σ (O − E)² / E, with E = N / k for equal expected frequencies', render: () => [
            api.table(['Category', 'Observed', 'Expected'], labels.map((l, i) => [api.esc(l), obs[i], fmt(r.expected[i])])),
            apaP(`A chi-square goodness-of-fit test against equal frequencies: ${api.apa.chi2(Object.assign({ N: S.sum(obs) }, r))}.`),
            api.charts.bar(labels.map((l, i) => ({ name: l, value: obs[i] })), { label: 'Observed counts per category (expected under H₀ shown in the table)', yl: 'count' })] });
        } else {
          let table, rl, cl;
          if (txt) { table = txt.split(';').map((row) => row.trim().split(/[\s,]+/).map(Number).filter(Number.isFinite)).filter((r) => r.length); rl = table.map((_, i) => 'row ' + (i + 1)); cl = table[0].map((_, j) => 'col ' + (j + 1)); } else {
            if (!c1 || !c2 || c1 === c2) throw new Error('choose two different categorical variables');
            rl = levelsOf(c1); cl = levelsOf(c2);
            table = rl.map((a) => cl.map((b) => ds.cols[c1].values.filter((v, i) => String(v) === a && String(ds.cols[c2].values[i]) === b).length));
          }
          if (table.length < 2 || table[0].length < 2 || table.some((r) => r.length !== table[0].length)) throw new Error('need a rectangular table of at least 2 × 2');
          const r = S.chi2Independence(table);
          present(out, { test: 'chi2', key: 'χ²', truth: r.chi2, hint: 'E = (row total × column total) / N; χ² = Σ (O − E)² / E; df = (r − 1)(c − 1)', render: () => [ds && ds.simulated && !txt ? api.simLabel() : null,
            api.table([''].concat(cl.map(api.esc)), table.map((row, i) => [api.esc(rl[i])].concat(row.map((o, j) => `${o} <span class="note">(E ${fmt(r.expected[i][j], 1)})</span>`)))),
            apaP(`A chi-square test of independence: ${api.apa.chi2(r)}, Cramér's V = ${api.apa.noLead(r.cramersV)}.`),
            r.expected.flat().some((e) => e < 5) ? h('p', { class: 'note' }, '⚠ Some expected counts are below 5; the χ² approximation may be poor.') : null,
            api.charts.bar(rl.flatMap((a, i) => cl.map((b, j) => ({ name: `${a.slice(0, 6)}/${b.slice(0, 6)}`, value: table[i][j] }))), { label: 'Observed counts per cell', yl: 'count' })] });
        }
      }));
    } else if (tool === 'd') {
      const v = { m1: 72, s1: 10, n1: 30, m2: 66, s2: 11, n2: 30 };
      const inp = (k, label) => h('label', { class: 'f' }, label, h('input', { type: 'number', step: 'any', value: v[k], 'aria-label': label, oninput: (e) => { v[k] = +e.target.value; } }));
      ctrl.append(h('div', { class: 'row' }, inp('m1', 'M₁'), inp('s1', 'SD₁'), inp('n1', 'n₁'), inp('m2', 'M₂'), inp('s2', 'SD₂'), inp('n2', 'n₂')), run(() => {
        const sp = Math.sqrt(((v.n1 - 1) * v.s1 ** 2 + (v.n2 - 1) * v.s2 ** 2) / (v.n1 + v.n2 - 2));
        if (!(sp > 0)) throw new Error('SDs and ns must be positive');
        const d = (v.m1 - v.m2) / sp;
        present(out, { test: 'cohen_d', key: 'd', truth: d, hint: 'd = (M₁ − M₂) / s<sub>pooled</sub>', render: () => {
          const pts1 = [], pts2 = []; for (let i = 0; i <= 100; i++) { const x = -4 + i * (8 + Math.abs(d)) / 100; pts1.push({ x, y: api.dist.normPdf(x) }); pts2.push({ x, y: api.dist.normPdf(x - d) }); }
          return [apaP(`d = ${api.apa.num(d)} (pooled SD = ${api.apa.num(sp)})`),
            h('p', null, `The group means differ by ${fmt(Math.abs(d))} pooled standard deviations. Overlap of the two normal curves: about ${fmt(200 * api.dist.normCdf(-Math.abs(d) / 2), 0)}%. Common benchmarks (Cohen) call 0.2 small, 0.5 medium and 0.8 large, but context matters more than labels.`),
            api.charts.line([{ name: 'Group 2', points: pts1 }, { name: 'Group 1', points: pts2 }], { label: `Two normal distributions separated by d = ${fmt(d)}`, xl: 'standardised score', yl: 'density' })];
        } });
      }));
    } else if (tool === 'power') {
      let d = 0.5, n = 64, alpha = 0.05, target = 0.8;
      ctrl.append(h('p', null, 'Two-sample power, normal approximation: power ≈ Φ(d·√(n/2) − z₁₋α/₂).'),
        api.slider('Effect size d', { min: 0.1, max: 1.5, step: 0.05, value: d, fmt: (x) => x.toFixed(2), onInput: (x) => { d = x; } }),
        api.slider('n per group', { min: 5, max: 400, step: 1, value: n, onInput: (x) => { n = x; } }),
        api.slider('Target power (for n-for-power)', { min: 0.5, max: 0.99, step: 0.01, value: target, fmt: (x) => x.toFixed(2), onInput: (x) => { target = x; } }),
        api.select('α', [{ value: 0.05, label: '.05' }, { value: 0.01, label: '.01' }, { value: 0.1, label: '.10' }], alpha, (x) => { alpha = +x; }),
        run(() => {
          const pw = S.powerTwoSample(d, n, alpha), need = S.nForPower(d, target, alpha);
          present(out, { test: 'power', key: 'power (0–1)', truth: pw, hint: 'power = Φ(d·√(n/2) − z<sub>1−α/2</sub>); z<sub>.975</sub> ≈ 1.96', render: () => {
            const series = [0.2, 0.5, 0.8].concat(d).map((dd, k) => ({ name: (k === 3 ? 'your d = ' : 'd = ') + dd.toFixed(2), points: Array.from({ length: 40 }, (_, i) => { const nn = 5 + i * 10; return { x: nn, y: S.powerTwoSample(dd, nn, alpha) }; }), dash: k === 3 }));
            return [api.table(['d', 'n / group', 'α', 'Power', `n / group for power ${target.toFixed(2)}`], [[fmt(d), n, alpha, api.apa.noLead(pw, 3), need]]),
              h('p', null, pw < 0.8 ? `Underpowered: with ${n} per group you would miss a true effect of d = ${fmt(d)} about ${Math.round(100 * (1 - pw))}% of the time.` : 'Adequate power for this assumed effect size.'),
              api.charts.line(series, { label: `Power curves by sample size (α = ${alpha})`, xl: 'n per group', yl: 'power', yr: [0, 1] })];
          } });
        }));
    }
  }
  loadSource();

  body.appendChild(h('h3', null, 'Why this matters'));
  body.appendChild(factBlock(api, ['F-OSC', 'F-EGO', 'F-HAUTUS']));
  body.appendChild(glossChips(api, ['Mean', 'Standard deviation', 'z-score', 'Normal distribution', 'p-value', 'Statistical significance', 'Type I error', 'Type II error', 'Effect size', "Cohen's d", 'Statistical power', 'Confidence interval', 't-test', 'Analysis of variance (ANOVA)', 'Chi-square test', "Pearson's r", 'Regression line', 'Degrees of freedom']));
  body.appendChild(links(api, { paradigms: ['stroop', 'ipip_big5'], zone: 'library', panels: ['report', 'replication', 'export'] }));
}

module.exports = [
  { id: 'history', render: renderHistory },
  { id: 'perspectives', render: renderPerspectives },
  { id: 'methods', render: renderMethods },
  { id: 'irb', render: renderIRB },
  { id: 'stats', render: renderStats },
];
module.exports.helpers = { parsePasted, withinTol, tolFor, makeDataset, fromRows, CONFOUNDS, TIMELINE, CODE_TEXT, safeRun, go, links, glossChips, factBlock, paras, fmt, apaHtml };
