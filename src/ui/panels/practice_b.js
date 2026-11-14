'use strict';
/**
 * Panels 27–30 (A6c, People & Practice rail): therapy, crosscultural, positive, replication.
 * Contract: docs/PANEL_API.md. Study numbers appear only through api.factLine / values parsed from facts.json;
 * anything generated here is labelled "Simulated data".
 */

// ------------------------------------------------------------------ shared helpers
const paras = (api, list) => list.map((t) => api.h('p', { html: t }));

/** Glossary chips: clicking shows the definition (and Urdu label when the language toggle is on). */
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

/** Fact lines; a fact whose source is still an instructor placeholder is shown as an editable gap, never as a number. */
function factLines(api, ids) {
  return ids.filter((id) => api.fact(id)).map((id) => {
    const f = api.fact(id);
    if (/instructor to add/i.test(f.source)) return api.h('p', { class: 'note' }, `[${id}] ${f.claim} — figure withheld until an instructor adds a verified source.`);
    return api.factLine(id);
  });
}

const toNum = (s) => parseFloat(String(s).replace(/[−–]/g, '-'));
/** Parse "x, 95% CI [lo, hi]" from a fact value string (numbers stay owned by facts.json). */
function parseCI(val) {
  const m = String(val).replace(/[−–]/g, '-').match(/(-?\d*\.?\d+)[^[\d-]*95% CI \[\s*(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)\s*\]/);
  return m ? { est: toNum(m[1]), lo: toNum(m[2]), hi: toNum(m[3]) } : null;
}
function parseOriginal(val) {
  const m = String(val).match(/(?:earlier[^=]*=|original)\s*(-?\d*\.?\d+)/);
  return m ? toNum(m[1]) : null;
}
const verified = (f) => f && (f.confidence === 'verified' || f.confidence === 'disputed');

function textarea(api, label, value, rows = 2) {
  const t = api.h('textarea', { 'aria-label': label, rows });
  t.value = value || '';
  return { el: api.h('label', { class: 'f' }, label, t), input: t };
}
function textInput(api, label, value) {
  const t = api.h('input', { type: 'text', 'aria-label': label, value: value || '' });
  return { el: api.h('label', { class: 'f' }, label, t), input: t };
}

// ------------------------------------------------------------------ 27 therapy
const SKILL_ITEMS = [
  { reply: '“What has been going through your mind since the result came out?”', skill: 'open', why: 'An open question invites the client to tell their story in their own words instead of answering yes/no.' },
  { reply: '“You have kept coming to every lab session even after a hard week — that takes real persistence.”', skill: 'affirm', why: 'An affirmation names a genuine strength or effort. It is specific, not empty praise.' },
  { reply: '“Part of you wonders whether one bad grade proves something about your ability, and part of you still wants this degree.”', skill: 'reflect', why: 'A complex reflection goes beyond the words to the meaning, here capturing ambivalence (two sides of the client\'s feelings).' },
  { reply: '“So far you have told me about the midterm, your father\'s suggestion, and a worry that you do not belong. Did I get that right?”', skill: 'summarise', why: 'A summary collects several things the client said and checks accuracy, which also shows you were listening.' },
  { reply: '“You should just ignore your father and study harder.”', skill: 'advice', why: 'Premature advice skips understanding, can damage the relationship with family, and takes the decision away from the client.' },
  { reply: '“Don\'t worry, everyone passes eventually.”', skill: 'reassure', why: 'False reassurance dismisses the feeling and promises something the counsellor cannot know.' },
];
const SKILL_LABELS = [
  { value: '', label: '— choose —' }, { value: 'open', label: 'Open question' }, { value: 'affirm', label: 'Affirmation' },
  { value: 'reflect', label: 'Reflection' }, { value: 'summarise', label: 'Summary' }, { value: 'advice', label: 'Premature advice' }, { value: 'reassure', label: 'False reassurance' },
];
const TR_EXAMPLE = {
  a: 'Late at night my supervisor sends a WhatsApp message: "Please see me tomorrow at 9 about your lab report."',
  b: 'I must have made a terrible mistake. She thinks I am careless and will report me to the department.',
  bRate: 85, emotion: 'Anxious, slightly ashamed', cRate: 80,
  c2: 'Could not sleep, reread the report five times, thought about skipping the meeting.',
  d: 'Evidence for: she did not say why. Evidence against: last time she asked to meet it was to offer me a TA post; she gave my previous report a good mark; supervisors often meet students to give feedback. Thinking error: jumping to conclusions (mind-reading).',
  e: 'I do not know what the meeting is about. It could be feedback, a small correction or something positive. If there is a mistake, I can fix it.',
  eRate: 35,
};

function therapy(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'What helps in counselling?'));
  body.append(...paras(api, [
    'Carl Rogers argued that people move towards growth when a helper offers three <b>core conditions</b>: <b>empathy</b> (accurately sensing the client\'s inner world and saying it back), <b>unconditional positive regard</b> (valuing the person even when not approving of every action) and <b>congruence</b> or genuineness (the helper is real, not hiding behind a professional mask). These conditions are now treated as part of the wider "therapeutic alliance" that matters in most forms of therapy.',
    '<b>OARS</b> is the basic toolkit from motivational interviewing: <b>O</b>pen questions, <b>A</b>ffirmations, <b>R</b>eflections and <b>S</b>ummaries. Reflections are the workhorse: a simple reflection repeats or rephrases, while a complex reflection adds meaning, feeling or ambivalence. Beginners tend to ask too many questions and give advice too early.',
    '<b>Cognitive-behavioural therapy (CBT)</b> links events, thoughts and reactions. In the <b>ABC</b> model an <b>A</b>ctivating event triggers <b>B</b>eliefs or automatic thoughts, which produce emotional and behavioural <b>C</b>onsequences. Ellis\'s extension adds <b>D</b>isputing the belief with evidence and <b>E</b>ffective new thinking. Beck\'s thought record turns this into a written exercise: rate how strongly you believe the thought and how intense the feeling is, then re-rate after weighing the evidence.',
    'In ZEHN you practise only with <b>fictional, simulated clients</b> in the Counselling Centre. ZEHN never assesses or treats you. Disorders are described in plain paraphrase; see DSM-5-TR / ICD-11 for official criteria.',
  ]));
  body.appendChild(glossRow(api, ['Empathy', 'Unconditional positive regard', 'Motivational interviewing', 'Cognitive-behavioral therapy (CBT)', 'ABC model (CBT)', 'Automatic thoughts']));

  // --- OARS classifier
  body.appendChild(h('h3', null, 'Micro-skill spotter (OARS and common traps)'));
  body.appendChild(h('p', null, h('b', null, 'Simulated client (fictional): '), '“Since I failed the stats midterm my father keeps saying I should switch to business. Maybe he is right — I am just not clever enough for psychology.”'));
  const picks = [];
  const rows = SKILL_ITEMS.map((it, i) => {
    const out = h('span', { class: 'note' });
    const sel = api.select('Reply ' + (i + 1) + ' skill', SKILL_LABELS, '', (v) => { picks[i] = v; out.textContent = ''; });
    return { node: h('div', { class: 'card' }, h('p', null, it.reply), sel, out), out };
  });
  rows.forEach((r) => body.appendChild(r.node));
  const skillRes = h('div', { 'aria-live': 'polite' });
  body.appendChild(btn('Check my labels', () => {
    let right = 0;
    SKILL_ITEMS.forEach((it, i) => {
      const ok = picks[i] === it.skill;
      if (ok) right++;
      rows[i].out.innerHTML = (ok ? '✔ Correct. ' : picks[i] ? '✘ Not quite. ' : '— Not answered. ') + api.esc(it.why);
    });
    skillRes.innerHTML = '';
    skillRes.appendChild(h('p', null, h('b', null, `You labelled ${right} of ${SKILL_ITEMS.length} replies correctly.`), ' Helpful skills (open, affirm, reflect, summarise) build the alliance; the last two are common beginner traps.'));
    if (right === SKILL_ITEMS.length) sim.addXP(20, 'OARS spotter');
  }, 'primary'));
  body.appendChild(skillRes);

  // --- session scoring explanation from the clinic's own rubric
  body.appendChild(h('h3', null, 'How clinic sessions are scored'));
  body.appendChild(h('p', null, 'Each counsellor reply in the Clinic is tagged with a micro-skill and a score from the supervision rubric. Reflections, validation and well-timed psychoeducation earn points; judging, false reassurance and premature advice lose points. Your session score is the sum across turns, and the supervisor note explains each choice. The chart below is computed from the rubric in the clinic\'s dialogue trees (game design, not research data).'));
  const skillScores = {};
  for (const c of sim.data.clients || []) for (const n of Object.values(c.nodes || {})) for (const o of n.options || []) {
    if (!o.skill || typeof o.score !== 'number') continue;
    (skillScores[o.skill] = skillScores[o.skill] || []).push(o.score);
  }
  const skillGroups = Object.entries(skillScores).map(([k, v]) => ({ name: k, value: +api.stats.mean(v).toFixed(2) })).sort((a, b) => b.value - a.value);
  if (skillGroups.length) {
    body.appendChild(api.charts.bar(skillGroups, { label: 'Mean rubric score per micro-skill across all clinic dialogue options', yl: 'mean score', W: 620 }));
    body.appendChild(api.table(['Micro-skill', 'Mean rubric score', 'Options tagged'], skillGroups.map((g) => [g.name, g.value.toFixed(2), skillScores[g.name].length])));
  }

  // --- thought record
  body.appendChild(h('h3', null, 'Interactive thought record (A-B-C-D-E)'));
  body.appendChild(h('p', { class: 'note' }, 'A learning exercise in the CBT format, not therapy and not an assessment. Use the original worked example or your own everyday situation (avoid anything distressing). Nothing leaves this device. If something here brings up difficult feelings, crisis resources are in Settings.'));
  const fA = textarea(api, 'A — Activating event (what happened, where, when?)', '', 2);
  const fB = textarea(api, 'B — Automatic thought / belief', '', 2);
  let bRate = 70, cRate = 70, eRate = 40;
  const sB = api.slider('Belief strength before (0–100)', { min: 0, max: 100, step: 5, value: bRate, onInput: (v) => { bRate = v; } });
  const fC = textInput(api, 'C — Emotion(s)', '');
  const sC = api.slider('Emotion intensity before (0–100)', { min: 0, max: 100, step: 5, value: cRate, onInput: (v) => { cRate = v; } });
  const fC2 = textarea(api, 'C — What did you do / feel in your body?', '', 2);
  const fD = textarea(api, 'D — Dispute: evidence for, evidence against, thinking error', '', 3);
  const fE = textarea(api, 'E — Effective, balanced thought', '', 2);
  const sE = api.slider('Emotion intensity after (0–100)', { min: 0, max: 100, step: 5, value: eRate, onInput: (v) => { eRate = v; } });
  const setSlider = (wrap, v) => { const inp = wrap.querySelector('input'); inp.value = v; inp.dispatchEvent(new Event('input')); };
  body.append(fA.el, fB.el, sB, fC.el, sC, fC2.el, fD.el, fE.el, sE);
  const trOut = h('div', { 'aria-live': 'polite' });
  const trMarkdown = () => `# Thought record (learning exercise)\n\n- **A — Event:** ${fA.input.value}\n- **B — Thought:** ${fB.input.value} (belief ${bRate}/100)\n- **C — Emotion:** ${fC.input.value} (intensity ${cRate}/100); behaviour/body: ${fC2.input.value}\n- **D — Dispute:** ${fD.input.value}\n- **E — Balanced thought:** ${fE.input.value} (intensity after ${eRate}/100)\n\n_For learning only — not therapy, not a diagnosis. Generated in ZEHN (simulated institution)._\n`;
  body.appendChild(h('div', { class: 'row' },
    btn('Fill worked example', () => {
      fA.input.value = TR_EXAMPLE.a; fB.input.value = TR_EXAMPLE.b; fC.input.value = TR_EXAMPLE.emotion; fC2.input.value = TR_EXAMPLE.c2; fD.input.value = TR_EXAMPLE.d; fE.input.value = TR_EXAMPLE.e;
      setSlider(sB, TR_EXAMPLE.bRate); setSlider(sC, TR_EXAMPLE.cRate); setSlider(sE, TR_EXAMPLE.eRate);
      api.toast('Worked example filled (fictional student).');
    }, 'ghost'),
    btn('Review my record', () => {
      trOut.innerHTML = '';
      const missing = [['A', fA], ['B', fB], ['D', fD], ['E', fE]].filter(([, f]) => !f.input.value.trim()).map(([k]) => k);
      if (missing.length) { trOut.appendChild(h('p', { class: 'note' }, 'Still empty: ' + missing.join(', ') + '. A thought record works best when every column is filled.')); return; }
      const tips = [];
      if (/\b(must|should|always|never|everyone|nobody)\b/i.test(fB.input.value)) tips.push('Your B column uses absolute words (must/always/never…). These often signal a rigid belief worth disputing.');
      if (!/against/i.test(fD.input.value)) tips.push('Try listing evidence <i>against</i> the thought explicitly in D.');
      if (fE.input.value.trim().length < 25) tips.push('A balanced thought is usually more than a slogan: include what is realistic and what you can do.');
      trOut.appendChild(h('p', null, `Emotion intensity: ${cRate} → ${eRate} (change ${eRate - cRate}). These are your own ratings in a practice exercise, not a score of you.`));
      trOut.appendChild(api.charts.bar([{ name: 'belief before', value: bRate }, { name: 'emotion before', value: cRate }, { name: 'emotion after', value: eRate }], { label: 'Thought-record ratings (your own practice ratings)', yl: '0–100', yr: [0, 100] }));
      for (const t of tips) trOut.appendChild(h('p', { class: 'note', html: t }));
      sim.addXP(15, 'Thought record');
    }, 'primary'),
    btn('Download record (.md)', () => { api.download('thought_record.md', trMarkdown(), 'text/markdown'); api.toast('Thought record saved as a file on your device.'); })));
  body.appendChild(trOut);

  // --- clinic links
  body.appendChild(h('h3', null, 'Practise with a simulated client'));
  const clients = sim.data.clients || [];
  let clientId = clients[0] ? clients[0].id : null;
  const cNote = h('p', { class: 'note' });
  const showClient = () => { const c = clients.find((x) => x.id === clientId); cNote.textContent = c ? `${c.presenting} ${c.contentWarning && c.contentWarning.length ? 'Content note: ' + c.contentWarning.join(', ') + '.' : ''}` : ''; };
  if (clients.length) {
    body.appendChild(api.select('Client', clients.map((c) => ({ value: c.id, label: `${c.id} — ${c.name} (${c.family})` })), clientId, (v) => { clientId = v; showClient(); }));
    showClient();
    body.appendChild(cNote);
  }
  body.appendChild(h('div', { class: 'row' },
    btn('Start a clinic session', () => {
      const clinic = api.service('clinic');
      if (clinic && clinic.startSession) clinic.startSession(clientId);
      else { api.goZone('clinic'); api.toast('Heading to the Counselling Centre — talk to a client there to begin.'); }
    }, 'primary'),
    btn('Go to the Counselling Centre', () => api.goZone('clinic'), 'teal'),
    btn('Open Psychopathology (Simulated)', () => api.openPanel('psychopathology'), 'ghost'),
    btn('Cross-cultural counselling', () => api.openPanel('crosscultural'), 'ghost')));
  body.append(...factLines(api, ['F-PHQ']));
}

// ------------------------------------------------------------------ 28 crosscultural
const LENSES = [
  ['A student lets parents and an uncle help choose her degree.', 'Outsourcing a personal decision; may look like low autonomy.', 'Shared decision that honours family investment and keeps relationships in balance.'],
  ['A quiet student does not challenge the lecturer in class.', 'Disengaged or lacking confidence.', 'Showing respect for a senior; disagreement may be voiced privately instead.'],
  ['A newly married couple lives with the husband\'s parents.', 'Loss of independence for the couple.', 'Normal joint-family arrangement offering childcare, support and care for elders.'],
  ['A client describes sadness as heaviness in the chest and the heart "sinking".', 'Somatising — not "really" psychological.', 'A culturally common idiom of distress; the body language of emotion is meaningful and should be explored, not dismissed.'],
  ['A family first takes a distressed son to a religious healer.', 'Avoidance of real treatment.', 'Faith is a trusted source of coping and meaning; a counsellor can respect it and still offer referral alongside.'],
];
const BARRIERS = [
  { id: 'cost', label: 'Cost of sessions or medicine', w: -0.8 },
  { id: 'stigma', label: 'Stigma: "log kya kahenge?" (what will people say?)', w: -1.0 },
  { id: 'knowledge', label: 'Little knowledge of what counselling is', w: -0.7 },
  { id: 'distance', label: 'Long distance / travel time to a service', w: -0.6 },
  { id: 'gate', label: 'Family elders must agree before help is sought', w: -0.5 },
  { id: 'past', label: 'A bad earlier experience with treatment', w: -0.6 },
];
const FACILITATORS = [
  { id: 'trust', label: 'Trusts that services work', w: 0.9 },
  { id: 'serious', label: 'Recognises the problem as serious', w: 0.8 },
  { id: 'family', label: 'Family supports seeking help', w: 0.7 },
  { id: 'faith', label: 'Faith-sensitive counsellor available', w: 0.5 },
];
const logistic = (x) => 1 / (1 + Math.exp(-x));

function crosscultural(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Culture shapes minds — and the science of minds'));
  body.append(...paras(api, [
    '<b>Individualism</b> describes cultures that emphasise personal goals, independence and a self defined by unique traits; <b>collectivism</b> describes cultures that emphasise group goals, harmony and a self defined by relationships and roles. These are dimensions, not boxes: every society, family and person mixes both, and urban Pakistan today combines strong family ties with rising individual aspirations.',
    'In many Pakistani households the <b>joint family</b> (several generations under one roof) is the unit that makes decisions about education, marriage, money and health. This brings real protection — practical help, belonging, care of elders — but it can also mean that a young person\'s distress is filtered through family reputation (<i>izzat</i>) before anyone outside is consulted.',
    '<b>Help-seeking</b> often follows a pathway: family first, then religious or traditional healers and general doctors, and only later a psychologist or psychiatrist, if at all. Reviews of Pakistani research list stigma, cost, low mental-health literacy and distance among the barriers, and trust in services as a key facilitator. The evidence base itself is small and uneven, so be careful with any single local statistic.',
    '<b>Indigenous psychology</b> studies people using concepts that come from their own culture rather than importing every construct from elsewhere. <b>WEIRD</b> critique: much of psychology\'s evidence comes from Western, Educated, Industrialised, Rich and Democratic samples — often university students — yet is written up as if it described all humans. Before generalising a finding to Hyderabad or Peshawar, ask who was sampled.',
  ]));
  body.append(...factLines(api, ['F-MHL-PK', 'F-PK-ACCESS', 'F-BOND', 'F-AIN-XC']));
  body.appendChild(glossRow(api, ['Collectivism', 'Individualism', 'Indigenous psychology', 'WEIRD samples', 'Stigma']));

  body.appendChild(h('h3', null, 'Same behaviour, two lenses'));
  body.appendChild(h('p', { class: 'note' }, 'Decide which reading you find more convincing in context, then reveal both. There is no single correct answer; the point is to notice your default lens.'));
  for (const [beh, ind, col] of LENSES) {
    const out = h('div', { class: 'note', 'aria-live': 'polite' });
    body.appendChild(h('div', { class: 'card' }, h('p', null, h('b', null, beh)),
      h('div', { class: 'row' },
        btn('Show both readings', () => { out.innerHTML = `<b>Individualist reading:</b> ${api.esc(ind)}<br><b>Collectivist / local reading:</b> ${api.esc(col)}`; }, 'ghost')), out));
  }

  // --- help-seeking explorer (simulated teaching model)
  body.appendChild(h('h3', null, 'Help-seeking pathway explorer'));
  body.appendChild(h('p', null, 'A fictional young adult in Hyderabad has had low mood for two months. Tick the barriers and facilitators in their life. A ', h('b', null, 'simulated teaching model'), ' (weights invented to illustrate the idea, not estimated from data) shows how the chance of reaching a mental-health service shifts. ', api.simLabel('Simulated model')));
  const on = {};
  const box = (item) => h('label', { style: { display: 'block' } }, h('input', { type: 'checkbox', onchange: (e) => { on[item.id] = e.target.checked; draw(); } }), ' ' + item.label);
  body.appendChild(h('div', { class: 'grid2' },
    h('div', { class: 'card' }, h('h4', null, 'Barriers'), ...BARRIERS.map(box)),
    h('div', { class: 'card' }, h('h4', null, 'Facilitators'), ...FACILITATORS.map(box))));
  const hsOut = h('div', { 'aria-live': 'polite' });
  body.appendChild(hsOut);
  function draw() {
    const all = BARRIERS.concat(FACILITATORS);
    const x = -0.2 + all.reduce((s, it) => s + (on[it.id] ? it.w : 0), 0);
    const p = logistic(x);
    hsOut.innerHTML = '';
    hsOut.appendChild(h('p', null, h('b', null, `Modelled chance of reaching a service: ${(p * 100).toFixed(0)}%`), ' — ', api.simLabel()));
    const path = [];
    path.push('Talks to family');
    if (on.faith || !on.trust) path.push('Consults a religious or traditional healer');
    path.push('Sees a general doctor');
    if (p > 0.5) path.push('Referred to a psychologist / psychiatrist');
    else path.push('Stops seeking help for now');
    hsOut.appendChild(h('p', null, 'Likely pathway: ' + path.join(' → ')));
  }
  draw();
  body.appendChild(btn('Simulate 300 fictional people', () => {
    const rng = new api.Rng(sim.seed + ':helpseek');
    const byCount = {};
    for (let i = 0; i < 300; i++) {
      let x = -0.2, nb = 0;
      for (const b of BARRIERS) if (rng.chance(0.35)) { x += b.w; nb++; }
      for (const f of FACILITATORS) if (rng.chance(0.4)) x += f.w;
      const k = Math.min(nb, 4);
      byCount[k] = byCount[k] || { n: 0, reached: 0 };
      byCount[k].n++; if (rng.chance(logistic(x))) byCount[k].reached++;
    }
    const groups = Object.keys(byCount).sort().map((k) => ({ name: (k === '4' ? '4+' : k) + ' barriers', value: +(100 * byCount[k].reached / byCount[k].n).toFixed(1) }));
    hsOut.appendChild(api.charts.bar(groups, { label: 'Simulated data: % reaching a service by number of barriers (teaching model)', yl: '% reached', yr: [0, 100] }));
    hsOut.appendChild(api.simLabel());
  }, 'primary'));

  // --- instructor-editable local figure
  body.appendChild(h('h3', null, 'Local figure (instructor-editable)'));
  const saved = sim.store.getPref('xc.local', { stat: '', source: '' });
  const fS = textInput(api, 'Local statistic (e.g., treatment gap, faith-healer consultation rate)', saved.stat);
  const fSrc = textInput(api, 'Verified source (author, year, DOI)', saved.source);
  const locOut = h('p', { class: 'note', 'aria-live': 'polite' });
  const showLoc = (v) => { locOut.textContent = v.stat ? `Instructor-entered (not checked by ZEHN): ${v.stat} — ${v.source || 'source missing'}` : '[instructor to add verified source] — ZEHN deliberately shows no local number until one is entered.'; };
  showLoc(saved);
  body.append(fS.el, fSrc.el, btn('Save local figure', () => {
    const v = { stat: fS.input.value.trim(), source: fSrc.input.value.trim() };
    if (v.stat && !v.source) { api.toast('Please add a source before saving a figure.'); return; }
    sim.store.setPref('xc.local', v); showLoc(v); api.toast('Saved on this device.');
  }, 'ghost'), locOut);

  body.appendChild(h('div', { class: 'row' },
    btn('Run Asch-style conformity', () => api.runParadigm('asch'), 'primary'),
    btn('Go to the Mohalla', () => api.goZone('mohalla'), 'teal'),
    btn('Counsel a client (cultural)', () => {
      const c = (sim.data.clients || []).find((x) => x.family === 'cultural');
      const clinic = api.service('clinic');
      if (clinic && clinic.startSession && c) clinic.startSession(c.id); else { api.goZone('clinic'); api.toast('Heading to the Counselling Centre.'); }
    }),
    btn('Case: help-seeking and stigma', () => api.openPanel('cases'), 'ghost'),
    btn('Social Psychology', () => api.openPanel('social'), 'ghost')));
}

// ------------------------------------------------------------------ 29 positive
const ACTIVITIES = [
  { name: 'Watching a favourite drama with cousins', P: 1, E: 0, R: 1, M: 0, A: 0, lean: 'mostly hedonic' },
  { name: 'Volunteering at a flood-relief camp', P: 0, E: 1, R: 1, M: 1, A: 1, lean: 'mostly eudaimonic' },
  { name: 'Finishing a hard statistics assignment', P: 0, E: 1, R: 0, M: 0, A: 1, lean: 'mixed' },
  { name: 'Playing cricket in the street', P: 1, E: 1, R: 1, M: 0, A: 0, lean: 'mixed' },
  { name: 'Teaching a younger sibling to read', P: 1, E: 1, R: 1, M: 1, A: 1, lean: 'both' },
  { name: 'Scrolling social media late at night', P: 1, E: 0, R: 0, M: 0, A: 0, lean: 'hedonic (short-lived)' },
];
const PERMA_KEYS = [['P', 'Positive emotion'], ['E', 'Engagement'], ['R', 'Relationships'], ['M', 'Meaning'], ['A', 'Accomplishment']];
const LADDER = ['1 Anecdote / testimonial', '2 Cross-sectional correlation', '3 Longitudinal study', '4 Single randomised trial', '5 Preregistered randomised trial', '6 Meta-analysis / multi-lab replication'];
const CLAIMS = [
  { text: '“My cousin says writing a gratitude diary cured her exam stress.”', rung: 0 },
  { text: '“In one online survey, people reporting more gratitude also reported higher life satisfaction.”', rung: 1 },
  { text: '“Students were followed for a year; gratitude at the start predicted wellbeing at the end.”', rung: 2 },
  { text: '“One lab randomly assigned students to a gratitude diary or a neutral diary.”', rung: 3 },
  { text: '“A trial posted its hypotheses, sample size and analysis plan before collecting data.”', rung: 4 },
  { text: '“Many labs ran the same protocol and pooled their results, checking for publication bias.”', rung: 5 },
];

function positive(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Wellbeing: feeling good and functioning well'));
  body.append(...paras(api, [
    'Positive psychology studies what makes life go well, not only what goes wrong. Two traditions run through it. The <b>hedonic</b> view equates wellbeing with pleasure and satisfaction — often measured as subjective wellbeing: life satisfaction plus frequent positive and infrequent negative emotions. The <b>eudaimonic</b> view, rooted in Aristotle, emphasises living in line with one\'s values and potential: purpose, growth, autonomy, mastery and positive relationships (as in Ryff\'s model of psychological wellbeing).',
    'Seligman\'s <b>PERMA</b> model lists five building blocks: <b>P</b>ositive emotion, <b>E</b>ngagement (absorption or "flow"), <b>R</b>elationships, <b>M</b>eaning and <b>A</b>ccomplishment. Peterson and Seligman\'s Values in Action project classified <b>character strengths</b> (such as kindness, curiosity, perseverance) under broad virtues, encouraging people to use their top strengths in new ways.',
    'The field has been criticised for over-selling: some popular claims rested on small studies, and a widely cited mathematical "positivity ratio" was later shown to be unfounded. Cultural fit matters too — in many collectivist settings wellbeing is tied to family harmony and religious meaning more than to individual happiness. Judge positive-psychology claims with the same evidence ladder you use everywhere else.',
  ]));

  body.appendChild(h('h3', null, 'Activity → wellbeing model mapper'));
  body.appendChild(h('p', { class: 'note' }, 'A discussion starter: the mappings are arguable. Pick an activity, see which PERMA elements it may feed, then argue with it in class.'));
  const mapOut = h('div', { 'aria-live': 'polite' });
  const showAct = (name) => {
    const a = ACTIVITIES.find((x) => x.name === name) || ACTIVITIES[0];
    mapOut.innerHTML = '';
    mapOut.appendChild(api.table(['PERMA element', 'Fed by this activity?'], PERMA_KEYS.map(([k, label]) => [label, a[k] ? '✔ yes' : '— not much'])));
    mapOut.appendChild(h('p', null, 'Hedonic vs eudaimonic leaning: ', h('b', null, a.lean)));
    mapOut.appendChild(api.charts.bar(PERMA_KEYS.map(([k, label]) => ({ name: label.split(' ')[0], value: a[k] })), { label: 'PERMA elements touched by: ' + a.name, yl: 'touched (1) or not (0)', yr: [0, 1.2] }));
  };
  body.appendChild(api.select('Activity', ACTIVITIES.map((a) => a.name), ACTIVITIES[0].name, showAct));
  body.appendChild(mapOut);
  showAct(ACTIVITIES[0].name);

  // --- gratitude exercise (reflective, never scored)
  body.appendChild(h('h3', null, 'Three good things (reflective exercise)'));
  body.appendChild(h('p', { class: 'note' }, 'Write three things that went well recently and why. This is a reflection, not a test: ZEHN never scores or interprets your entries, and they stay on this device.'));
  const g1 = textInput(api, 'Good thing 1 — and why it happened', '');
  const g2 = textInput(api, 'Good thing 2 — and why it happened', '');
  const g3 = textInput(api, 'Good thing 3 — and why it happened', '');
  body.append(g1.el, g2.el, g3.el);
  const gOut = h('div', { 'aria-live': 'polite' });
  const showJournal = () => {
    const j = sim.store.getPref('gratitude', []);
    gOut.innerHTML = '';
    if (!j.length) { gOut.appendChild(h('p', { class: 'note' }, 'No entries saved yet.')); return; }
    const byDay = {};
    for (const e of j) byDay[e.day] = (byDay[e.day] || 0) + e.items.length;
    const days = Object.keys(byDay).sort();
    gOut.appendChild(h('p', null, `${j.length} reflection(s) saved on this device.`));
    if (days.length > 1) gOut.appendChild(api.charts.line([{ name: 'items written', points: days.map((d, i) => ({ x: i + 1, y: byDay[d] })), dots: true }], { label: 'Your reflection entries per day (a count of entries, not a wellbeing score)', xl: 'day number', yl: 'items' }));
    else gOut.appendChild(api.charts.bar([{ name: days[0], value: byDay[days[0]] }], { label: 'Items written today (a count, not a score)', yl: 'items' }));
    gOut.appendChild(h('ul', null, j.slice(-3).reverse().flatMap((e) => e.items.map((t) => h('li', null, `${e.day}: ${t}`)))));
  };
  body.appendChild(h('div', { class: 'row' },
    btn('Save reflection', () => {
      const items = [g1, g2, g3].map((f) => f.input.value.trim()).filter(Boolean);
      if (!items.length) { api.toast('Write at least one good thing first.'); return; }
      const j = sim.store.getPref('gratitude', []);
      j.push({ day: new Date().toISOString().slice(0, 10), items });
      sim.store.setPref('gratitude', j.slice(-60));
      [g1, g2, g3].forEach((f) => { f.input.value = ''; });
      showJournal(); sim.addXP(10, 'Reflection');
    }, 'primary'),
    btn('Clear my reflections', () => { sim.store.setPref('gratitude', []); showJournal(); api.toast('Reflections deleted from this device.'); }, 'ghost')));
  body.appendChild(gOut);
  showJournal();

  // --- evidence-quality ladder
  body.appendChild(h('h3', null, 'Evidence-quality ladder'));
  body.appendChild(h('p', null, 'Place each claim on the ladder. Higher rungs control more alternative explanations and flexible analysis; even the top rung can be wrong, so look for replication badges.'));
  const ladderPick = [];
  const ladderOut = CLAIMS.map(() => h('span', { class: 'note' }));
  CLAIMS.forEach((c, i) => body.appendChild(h('div', { class: 'card' }, h('p', null, c.text),
    api.select('Rung for claim ' + (i + 1), [{ value: '', label: '— choose rung —' }].concat(LADDER.map((l, k) => ({ value: k, label: l }))), '', (v) => { ladderPick[i] = v === '' ? null : +v; }), ladderOut[i])));
  const ladRes = h('p', { 'aria-live': 'polite' });
  body.appendChild(btn('Check ladder', () => {
    let right = 0;
    CLAIMS.forEach((c, i) => { const ok = ladderPick[i] === c.rung; if (ok) right++; ladderOut[i].textContent = ok ? '✔ ' + LADDER[c.rung] : '✘ Best fit: ' + LADDER[c.rung]; });
    ladRes.textContent = `${right} / ${CLAIMS.length} placed on the best-fitting rung.`;
  }, 'primary'));
  body.appendChild(ladRes);

  body.appendChild(h('h4', null, 'Replication badges in ZEHN\'s fact base'));
  const counts = {};
  for (const f of sim.facts.all()) if (f.replication && f.replication !== 'n/a') counts[f.replication] = (counts[f.replication] || 0) + 1;
  const order = ['robust', 'mixed', 'contested', 'failed'].filter((k) => counts[k]);
  if (order.length) body.appendChild(api.charts.bar(order.map((k) => ({ name: k, value: counts[k] })), { label: 'Facts in facts.json by replication status', yl: 'number of facts' }));
  body.append(...factLines(api, ['F-POWERPOSE', 'F-FACEFB', 'F-FACEFB2']));
  body.appendChild(glossRow(api, ['Replication', 'Effect size', 'Publication bias']));
  body.appendChild(h('div', { class: 'row' },
    btn('Open Replication & Open Science', () => api.openPanel('replication'), 'primary'),
    btn('Health & Stress', () => api.openPanel('health'), 'ghost'),
    btn('Go to the Courtyard', () => api.goZone('courtyard'), 'teal')));
}

// ------------------------------------------------------------------ 30 replication
function phackSim(api, o) {
  const rng = new api.Rng(o.seed);
  const S = api.stats;
  const honest = [], hacked = [];
  let hs = 0, ks = 0;
  const nMax = o.optional ? o.nMax : o.nStart;
  for (let s = 0; s < o.studies; s++) {
    const gen = () => { const c = rng.normal(); return Array.from({ length: o.dvs }, () => Math.sqrt(o.r) * c + Math.sqrt(1 - o.r) * rng.normal()); };
    const A = [], B = [];
    for (let i = 0; i < nMax; i++) { A.push(gen()); B.push(gen()); }
    const p0 = S.tIndependent(A.slice(0, o.nStart).map((r) => r[0]), B.slice(0, o.nStart).map((r) => r[0])).p;
    honest.push(p0); if (p0 < o.alpha) hs++;
    let best = 1, found = false;
    for (let n = o.nStart; n <= nMax && !found; n += o.step) {
      for (let d = 0; d < o.dvs; d++) {
        const p = S.tIndependent(A.slice(0, n).map((r) => r[d]), B.slice(0, n).map((r) => r[d])).p;
        if (p < best) best = p;
        if (p < o.alpha) { found = true; break; }
      }
    }
    hacked.push(best); if (found) ks++;
  }
  return { honest, hacked, fprHonest: hs / o.studies, fprHacked: ks / o.studies };
}

function replication(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Why did so many findings fail to replicate?'));
  body.append(...paras(api, [
    'In 2015 the Open Science Collaboration repeated 100 published psychology studies with high-powered, pre-planned designs. Far fewer replications than originals were statistically significant, and replication effects were on average much smaller. Large <b>Registered Replication Reports</b> (RRRs), in which many labs run one agreed protocol, then tested famous effects such as ego depletion and facial feedback, with sobering results.',
    'Causes include <b>low statistical power</b> (small samples give noisy, inflated estimates), <b>publication bias</b> (journals favour p < .05), and <b>researcher degrees of freedom</b>: measuring many outcomes and reporting the one that "worked", adding participants until p dips below .05 (optional stopping), flexible exclusions, and inventing the hypothesis after seeing the results (HARKing). Each choice can be innocent; together they inflate false positives far above the nominal α.',
    'Reforms: <b>preregistration</b> and Registered Reports (the plan is fixed, or even peer-reviewed, before data exist), open data and materials, power analysis, multi-lab replications, and reporting effect sizes with confidence intervals. A failed replication does not prove the original authors cheated; it updates how confident we should be.',
  ]));
  body.append(...factLines(api, ['F-OSC', 'F-EGO', 'F-FACEFB', 'F-POWERPOSE']));

  // OSC bar (parsed from the fact)
  const osc = api.fact('F-OSC');
  if (verified(osc)) {
    const m = String(osc.value).match(/(\d+(?:\.\d+)?)% of originals significant vs (\d+(?:\.\d+)?)% of replications/);
    if (m) body.appendChild(api.charts.bar([{ name: 'originals', value: +m[1] }, { name: 'replications', value: +m[2] }], { label: 'OSC 2015: % of studies with p < .05 (values from fact F-OSC)', yl: '% significant', yr: [0, 100] }));
  }
  // forest plots built only from fact values
  const forestFor = (id, label, xl) => {
    const f = api.fact(id);
    if (!verified(f)) return null;
    const ci = parseCI(f.value), orig = parseOriginal(f.value);
    if (!ci) return null;
    const rows = [];
    if (orig != null) rows.push({ name: 'Original estimate*', est: orig, lo: orig, hi: orig, color: '#E69F00' });
    rows.push({ name: 'Multi-lab replication', est: ci.est, lo: ci.lo, hi: ci.hi, color: '#56B4E9' });
    return h('div', null, api.charts.forest(rows, { label, xl }), h('p', { class: 'note' }, `Values parsed from fact ${id}. *No confidence interval for the original is stored in facts.json, so it is drawn as a point. Dashed line = zero effect.`));
  };
  const f1 = forestFor('F-EGO', 'Ego depletion: earlier estimate vs 23-lab RRR (from fact F-EGO)', "effect size (Cohen's d)");
  const f2 = forestFor('F-FACEFB', 'Facial feedback: original vs 17-lab RRR (from fact F-FACEFB)', 'rating difference (10-point scale)');
  if (f1 || f2) body.appendChild(h('h3', null, 'Forest plots: original vs replication'));
  if (f1) body.appendChild(f1);
  if (f2) body.appendChild(f2);

  // Power check using the fact values
  const ego = api.fact('F-EGO');
  if (verified(ego)) {
    const ci = parseCI(ego.value), orig = parseOriginal(ego.value);
    if (ci && orig) {
      const pOut = h('div', { 'aria-live': 'polite' });
      body.appendChild(h('h4', null, 'Power check'));
      body.appendChild(h('p', null, 'How many participants per group would you need for 80% power (α = .05, two-tailed) if the true effect were the earlier estimate, versus the replication estimate?'));
      body.appendChild(btn('Compute sample sizes', () => {
        const a = api.stats.nForPower(orig, 0.8, 0.05), b = api.stats.nForPower(Math.max(Math.abs(ci.est), 0.01), 0.8, 0.05);
        pOut.innerHTML = '';
        pOut.appendChild(api.table(['Assumed true effect', 'n per group for 80% power'], [[`earlier estimate (d = ${orig})`, a], [`RRR estimate (d = ${ci.est})`, Number.isFinite(b) ? b.toLocaleString() : 'more than 100,000']]));
        pOut.appendChild(h('p', { class: 'note' }, 'Normal-approximation power formula from the Statistics Workbench. Small original studies planned around an inflated effect are badly underpowered for the real one.'));
        api.emit('stats:test', { test: 'power' });
      }, 'teal'));
      body.appendChild(pOut);
    }
  }

  // --- p-hacking simulator
  body.appendChild(h('h3', null, 'p-hacking simulator'));
  body.appendChild(h('p', null, 'Every simulated study below has ', h('b', null, 'no true effect'), ' (both groups drawn from the same population). An honest analyst tests one pre-chosen outcome at a fixed n. A hacking analyst tests several correlated outcomes and/or peeks at the data, adding participants until something is significant. ', api.simLabel()));
  const o = { nStart: 20, nMax: 60, step: 10, dvs: 5, r: 0.5, alpha: 0.05, studies: 400, optional: true, seed: sim.seed + ':phack' };
  body.append(
    api.slider('Starting n per group', { min: 10, max: 50, step: 5, value: o.nStart, onInput: (v) => { o.nStart = v; } }),
    api.slider('Number of outcome measures (DVs)', { min: 1, max: 10, step: 1, value: o.dvs, onInput: (v) => { o.dvs = v; } }),
    api.slider('Correlation between DVs', { min: 0, max: 0.9, step: 0.1, value: o.r, onInput: (v) => { o.r = v; }, fmt: (v) => v.toFixed(1) }),
    api.slider('Maximum n per group (optional stopping)', { min: 20, max: 120, step: 10, value: o.nMax, onInput: (v) => { o.nMax = v; } }),
    api.slider('Simulated studies', { min: 100, max: 1000, step: 100, value: o.studies, onInput: (v) => { o.studies = v; } }),
    api.select('Nominal α', ['0.05', '0.01', '0.005'], '0.05', (v) => { o.alpha = +v; }),
    h('label', null, h('input', { type: 'checkbox', checked: true, onchange: (e) => { o.optional = e.target.checked; } }), ' Optional stopping (peek after every 10 per group)'));
  const phOut = h('div', { 'aria-live': 'polite' });
  body.appendChild(btn('Run simulation', () => {
    const cfg = Object.assign({}, o, { nMax: Math.max(o.nMax, o.nStart) });
    const r = phackSim(api, cfg);
    phOut.innerHTML = '';
    phOut.appendChild(h('p', null, h('b', null, `False-positive rate — honest: ${(r.fprHonest * 100).toFixed(1)}%; hacked: ${(r.fprHacked * 100).toFixed(1)}%; nominal α: ${(cfg.alpha * 100).toFixed(1)}%.`), ' ', api.simLabel()));
    phOut.appendChild(api.charts.bar([{ name: 'nominal α', value: cfg.alpha * 100 }, { name: 'honest', value: +(r.fprHonest * 100).toFixed(1) }, { name: 'hacked', value: +(r.fprHacked * 100).toFixed(1) }], { label: 'Simulated data: false-positive rate under a true null', yl: '% of studies "significant"' }));
    phOut.appendChild(api.charts.histogram(r.honest, { bins: 20, label: 'Simulated data: p-values from honest analyses (flat under the null)', xl: 'p-value' }));
    phOut.appendChild(api.charts.histogram(r.hacked, { bins: 20, label: 'Simulated data: reported p-values after p-hacking (piled up just below α)', xl: 'p-value', color: '#D55E00' }));
    phOut.appendChild(h('p', { class: 'note' }, `Seed ${cfg.seed}; ${cfg.studies} studies; ${cfg.dvs} DV(s), r = ${cfg.r.toFixed(1)}; n ${cfg.nStart}${cfg.optional ? '→' + cfg.nMax : ''} per group. Under a true null, honest p-values are uniform, so about α of studies are false positives.`));
    api.emit('replication:run', { finding: 'p-hacking-simulator' });
    api.emit('stats:test', { test: 't_ind' });
    sim.addXP(25, 'p-hacking simulator');
  }, 'primary'));
  body.appendChild(phOut);

  // --- preregistration builder
  body.appendChild(h('h3', null, 'Preregistration builder'));
  body.appendChild(h('p', null, 'Write your plan before you collect data. The sample size comes from a power analysis; the file you download is your time-stamped commitment.'));
  const paradigms = api.paradigms();
  const pr = { d: 0.5, power: 0.8, alpha: 0.05, test: 'Independent-samples t test (two-tailed)', paradigm: paradigms[0] ? paradigms[0].id : '' };
  const fT = textInput(api, 'Study title', 'Does the Stroop effect replicate in our class?');
  const fH = textarea(api, 'Hypotheses (directional, testable)', 'H1: Mean correct RT will be longer on incongruent than congruent trials.', 2);
  const fIV = textInput(api, 'Independent variable(s) and levels', 'Trial type: congruent vs incongruent (within participants)');
  const fDV = textInput(api, 'Primary dependent variable (only one!)', 'Mean RT on correct trials (ms)');
  const nOut = h('p', { 'aria-live': 'polite' });
  const updN = () => { const n = api.stats.nForPower(pr.d, pr.power, pr.alpha); pr.n = n; nOut.innerHTML = `<b>Planned n per group: ${Number.isFinite(n) ? n : 'more than 100,000'}</b> (d = ${pr.d.toFixed(2)}, power ${pr.power}, α = ${pr.alpha}).`; };
  const exclusions = { attn: true, fast: true, slow: true, incomplete: true, acc: false };
  const EXCL = [['attn', 'Failed any attention-check trial'], ['fast', 'RTs under 150 ms (anticipations)'], ['slow', 'RTs more than 2.5 SD above the participant\'s mean'], ['incomplete', 'Did not finish the task'], ['acc', 'Overall accuracy below 70%']];
  const fStop = textInput(api, 'Stopping rule', 'Stop at the planned n; no interim analyses.');
  const fOther = textarea(api, 'Secondary / exploratory analyses (will be labelled exploratory)', 'Accuracy by condition (exploratory).', 2);
  if (paradigms.length) body.appendChild(api.select('Paradigm', paradigms.map((p) => ({ value: p.id, label: p.title })), pr.paradigm, (v) => { pr.paradigm = v; }));
  body.append(fT.el, fH.el, fIV.el, fDV.el,
    api.slider('Smallest effect of interest (d)', { min: 0.1, max: 1.2, step: 0.05, value: pr.d, onInput: (v) => { pr.d = v; updN(); }, fmt: (v) => v.toFixed(2) }),
    api.select('Target power', ['0.8', '0.9', '0.95'], '0.8', (v) => { pr.power = +v; updN(); }),
    api.select('α', ['0.05', '0.01', '0.005'], '0.05', (v) => { pr.alpha = +v; updN(); }),
    nOut,
    api.select('Confirmatory test', ['Independent-samples t test (two-tailed)', 'Paired-samples t test (two-tailed)', 'One-way ANOVA', 'Chi-square test of independence', 'Pearson correlation'], pr.test, (v) => { pr.test = v; }),
    h('fieldset', null, h('legend', null, 'Exclusion rules (decided in advance)'), ...EXCL.map(([k, l]) => h('label', { style: { display: 'block' } }, h('input', { type: 'checkbox', checked: exclusions[k], onchange: (e) => { exclusions[k] = e.target.checked; } }), ' ' + l))),
    fStop.el, fOther.el);
  updN();
  const prOut = h('div', { 'aria-live': 'polite' });
  const prMd = () => `# Preregistration — ${fT.input.value}\n\nDate: ${new Date().toISOString().slice(0, 10)}  \nResearcher id: ${sim.state.pid} (anonymous)  \nInstitution: Indus Institute of Behavioural Sciences (simulated institution)\n${pr.paradigm ? `Paradigm: ${pr.paradigm}\n` : ''}\n## 1. Hypotheses\n${fH.input.value}\n\n## 2. Variables\n- IV: ${fIV.input.value}\n- Primary DV: ${fDV.input.value}\n\n## 3. Sample size\nPower analysis (two-sample normal approximation): smallest effect of interest d = ${pr.d.toFixed(2)}, power = ${pr.power}, α = ${pr.alpha} → **n = ${pr.n} per group**.\n\n## 4. Confirmatory analysis\n${pr.test}. Report effect size with 95% CI.\n\n## 5. Exclusion rules\n${EXCL.filter(([k]) => exclusions[k]).map(([, l]) => '- ' + l).join('\n') || '- none'}\n\n## 6. Stopping rule\n${fStop.input.value}\n\n## 7. Exploratory analyses\n${fOther.input.value}\n\n_Anything not listed above will be reported as exploratory._\n`;
  body.appendChild(h('div', { class: 'row' },
    btn('Save preregistration', () => {
      const design = { kind: 'prereg', title: fT.input.value, paradigm: pr.paradigm, d: pr.d, power: pr.power, alpha: pr.alpha, n: pr.n, test: pr.test, exclusions: Object.keys(exclusions).filter((k) => exclusions[k]), savedAt: new Date().toISOString() };
      sim.state.designs.push(design);
      api.emit('builder:save', { design });
      api.emit('replication:run', { finding: 'preregistration' });
      api.emit('stats:test', { test: 'power' });
      if (!sim.state.badges.includes('preregistered')) { sim.state.badges.push('preregistered'); api.emit('badge:earned', { id: 'preregistered' }); }
      sim.addXP(40, 'Preregistration');
      prOut.innerHTML = '';
      prOut.appendChild(h('pre', { class: 'stat-out' }, prMd()));
      api.toast('Preregistration saved to your designs.');
    }, 'primary'),
    btn('Download preregistration (.md)', () => { api.download('preregistration.md', prMd(), 'text/markdown'); api.emit('export:done', { kind: 'md' }); }),
    btn('Open Experiment Builder', () => api.openPanel('builder'), 'ghost'),
    btn('Statistics Workbench', () => api.openPanel('stats'), 'ghost'),
    btn('Go to the Library', () => api.goZone('library'), 'teal')));
  body.appendChild(prOut);
  body.appendChild(glossRow(api, ['Replication crisis', 'Direct replication', 'Conceptual replication', 'p-hacking', 'Preregistration', 'Publication bias', 'Effect size']));
}

module.exports = [
  { id: 'therapy', render: therapy },
  { id: 'crosscultural', render: crosscultural },
  { id: 'positive', render: positive },
  { id: 'replication', render: replication },
];
