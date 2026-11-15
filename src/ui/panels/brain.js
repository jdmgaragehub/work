'use strict';
/**
 * Brain & Mind rail panels (A6a): bio, brain, sleep, sensation, sdt, illusions, attention.
 * Contract: docs/PANEL_API.md. Original teaching text; study numbers only via api.factLine(id);
 * generated data labelled with api.simLabel(); model curves labelled illustrative.
 */
const { safeRun, go, links, glossChips, factBlock, paras, fmt } = require('./foundations.js').helpers;

let anim = null; // motion-aftereffect animation handle (cancelled on close)
function stopAnim() { if (anim) { cancelAnimationFrame(anim.raf); anim = null; } }

/** Show the player's own results for paradigms via each spec's analyse(). */
function ownResults(api, ids) {
  const { h, sim } = api;
  const box = h('div');
  let any = false;
  for (const id of ids) {
    const rows = (sim.datasets && sim.datasets[id]) || [];
    const spec = api.paradigm(id);
    if (!rows.length || !spec) continue;
    any = true;
    const main = rows.filter((r) => r.block !== 'practice');
    let sum = null;
    try { sum = spec.analyse ? spec.analyse(main, {}) : null; } catch (e) { sum = { lines: ['Analysis unavailable: ' + e.message] }; }
    const card = h('div', { class: 'card' }, h('h4', null, `${spec.title} — your data (${main.length} trials)`));
    if (sum && sum.lines) card.append(...sum.lines.map((l) => h('p', { class: 'note', html: api.format.italicise(api.esc(l)) })));
    if (sum && sum.chart) { try { card.appendChild(sum.chart(api.charts)); } catch (e) { /* chart optional */ } }
    card.appendChild(api.btn('Analyse in Statistics Workbench', () => api.openPanel('stats'), 'ghost'));
    box.appendChild(card);
  }
  if (!any) box.appendChild(h('p', { class: 'note' }, 'No runs yet. Run a paradigm below as a participant and your own results will appear here.'));
  return box;
}
const svgEl = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstChild; };
const throttle = (fn, ms) => { let last = 0; return (...a) => { const t = Date.now(); if (t - last >= ms) { last = t; fn(...a); } }; };
const reduced = (api) => !!(api.sim.settings && (api.sim.settings.reducedMotion || api.sim.settings.photosafe));

/* ------------------------------------------------------------------ 7. BIOPSYCHOLOGY */

const NT = [
  ['Acetylcholine', 'Muscle contraction at the neuromuscular junction; attention, arousal and memory in the brain', 'Loss of cholinergic neurons in Alzheimer\'s disease', 'Nicotine (agonist at some receptors); curare (blocks muscle receptors)'],
  ['Dopamine', 'Reward prediction, motivation, movement control', 'Parkinson\'s disease (loss of dopamine neurons); implicated in psychosis and addiction', 'Cocaine and amphetamine raise synaptic dopamine; many antipsychotics block D2 receptors'],
  ['Serotonin', 'Mood, sleep, appetite, impulse control', 'Implicated in depression and anxiety (the "low serotonin" story is oversimplified)', 'SSRIs block reuptake; some hallucinogens act on serotonin receptors'],
  ['Norepinephrine (noradrenaline)', 'Arousal, alertness, the fight-or-flight response', 'Stress responses; mood disorders', 'Stimulants increase release; beta-blockers block peripheral receptors'],
  ['GABA', 'Main inhibitory transmitter: calms neural activity', 'Anxiety, seizures when inhibition is too weak', 'Benzodiazepines and alcohol enhance GABA-A receptors'],
  ['Glutamate', 'Main excitatory transmitter; learning and memory (long-term potentiation)', 'Excess can damage neurons (excitotoxicity) after stroke', 'Ketamine blocks NMDA glutamate receptors'],
  ['Endorphins', 'Natural pain relief and pleasure', 'Runner\'s "high"; pain regulation', 'Opioid drugs mimic them; naloxone blocks opioid receptors'],
];

function renderBio(body, api) {
  const { h, btn } = api;
  body.appendChild(h('h3', null, 'Neurons: the brain\'s signalling cells'));
  body.append(...paras(api, [
    'A neuron receives signals on its <b>dendrites</b>, integrates them in the <b>cell body</b>, and if the voltage at the <b>axon hillock</b> passes <b>threshold</b>, fires an <b>action potential</b> that travels down the axon to the terminals. At rest the inside is negative relative to the outside, maintained by ion gradients and the sodium–potassium pump.',
    'During an action potential, voltage-gated sodium channels open (depolarisation), then close while potassium channels open (repolarisation), followed by a brief overshoot (hyperpolarisation) and a <b>refractory period</b>. The spike is <b>all-or-none</b>: stimulus strength is coded by <b>firing rate</b>, not spike size.',
    'At the synapse, the spike releases <b>neurotransmitters</b> that bind to receptors on the next cell, making it more (EPSP) or less (IPSP) likely to fire. Drugs act as <b>agonists</b> (mimic or boost) or <b>antagonists</b> (block).',
    'Below are two models. The <b>leaky integrate-and-fire (LIF)</b> neuron is a simple "leaky bucket" that fires and resets at threshold. The <b>Hodgkin–Huxley (HH)</b> model describes the real ion-channel dynamics with four equations and reproduces the spike shape.',
  ]));

  // LIF
  body.appendChild(h('h3', null, 'Leaky integrate-and-fire simulator'));
  const lif = { I: 2, tau: 10 };
  const lifOut = h('div', { 'aria-live': 'polite' });
  const lifRun = () => {
    const r = api.neuron.lif({ I: lif.I, tau: lif.tau, ms: 200 });
    lifOut.innerHTML = '';
    lifOut.append(api.charts.trace(r.trace.filter((_, i) => i % 2 === 0).map((p) => ({ x: p.t, y: p.V })), { label: `LIF membrane potential, I = ${lif.I} nA, τ = ${lif.tau} ms (spikes drawn to +30 mV)`, yr: [-75, 35] }),
      h('p', null, `${r.spikes.length} spikes in 200 ms → firing rate ${fmt(r.rate, 0)} Hz. ${r.spikes.length ? '' : 'Below threshold: the voltage settles at rest + R·I without firing (rheobase not reached).'}`));
    if (r.spikes.length) api.emit('neuron:spike', { model: 'lif', n: r.spikes.length });
  };
  const lifT = throttle(lifRun, 150);
  body.append(api.slider('Input current I (nA)', { min: 0, max: 5, step: 0.1, value: lif.I, fmt: (v) => v.toFixed(1), onInput: (v) => { lif.I = v; lifT(); } }),
    api.slider('Membrane time constant τ (ms)', { min: 2, max: 40, step: 1, value: lif.tau, onInput: (v) => { lif.tau = v; lifT(); } }),
    h('div', { class: 'row' }, btn('Run LIF', lifRun, 'primary')), lifOut);
  lifRun();

  // HH
  body.appendChild(h('h3', null, 'Hodgkin–Huxley simulator'));
  const hh = { I: 10, mode: 'dc' };
  const hhOut = h('div', { 'aria-live': 'polite' });
  const hhRun = () => {
    const I = hh.mode === 'dc' ? hh.I : (t) => (t >= 10 && t < 11 ? hh.I * 4 : 0);
    const r = api.neuron.hh({ I, ms: 100, settle: 20 });
    hhOut.innerHTML = '';
    hhOut.append(api.charts.trace(r.trace.map((p) => ({ x: p.t, y: p.V })), { label: `HH membrane potential, ${hh.mode === 'dc' ? 'steady current ' + hh.I : '1-ms pulse of ' + (hh.I * 4)} µA/cm²`, yr: [-85, 50] }),
      api.charts.line([{ name: 'm (Na activation)', points: r.trace.map((p) => ({ x: p.t, y: p.m })) }, { name: 'h (Na inactivation)', points: r.trace.map((p) => ({ x: p.t, y: p.h })) }, { name: 'n (K activation)', points: r.trace.map((p) => ({ x: p.t, y: p.n })) }], { label: 'HH gating variables over time', xl: 'ms', yl: 'probability open', yr: [0, 1], H: 200 }),
      h('p', null, `${r.spikes.length} spike(s) in 100 ms. Watch m jump first (sodium rushes in), then h fall and n rise (sodium inactivates, potassium flows out) — that sequence shapes the spike and the refractory period.`));
    if (r.spikes.length) api.emit('neuron:spike', { model: 'hh', n: r.spikes.length });
  };
  const hhT = throttle(hhRun, 250);
  body.append(api.slider('Current amplitude (µA/cm²)', { min: 0, max: 20, step: 0.5, value: hh.I, fmt: (v) => v.toFixed(1), onInput: (v) => { hh.I = v; hhT(); } }),
    api.select('Stimulus', [{ value: 'dc', label: 'Steady (DC) current' }, { value: 'pulse', label: 'Brief 1-ms pulse (×4 amplitude)' }], hh.mode, (v) => { hh.mode = v; hhRun(); }),
    h('div', { class: 'row' }, btn('Run HH', hhRun, 'primary')), hhOut);
  hhRun();

  // f–I curve
  body.appendChild(h('h3', null, 'f–I curves: rate coding'));
  const fiOut = h('div', { 'aria-live': 'polite' });
  body.append(h('p', null, 'Stronger input produces faster firing, up to a ceiling set by the refractory period. This is how neurons code intensity. LIF currents are in nA; HH currents in µA/cm² — the two models use different units, so compare shapes, not numbers.'),
    btn('Compute f–I curves', () => {
      const lifC = Array.from({ length: 21 }, (_, i) => i * 0.25), hhC = Array.from({ length: 21 }, (_, i) => i);
      const a = api.neuron.fiCurve('lif', lifC), b = api.neuron.fiCurve('hh', hhC, { ms: 250, settle: 50, record: false });
      fiOut.innerHTML = '';
      fiOut.append(api.charts.line([{ name: 'LIF (I in nA × 4)', points: a.map((p) => ({ x: p.I * 4, y: p.rate })), dots: true }, { name: 'HH (I in µA/cm²)', points: b.map((p) => ({ x: p.I, y: p.rate })), dots: true }], { label: 'Firing rate as a function of input current (f–I curve)', xl: 'input current (model units)', yl: 'rate (Hz)' }),
        h('p', { class: 'note' }, 'Note the HH model\'s abrupt jump from silence to repetitive firing (a "type II" onset), versus the LIF neuron\'s gradual rise.'));
      api.emit('neuron:spike', { model: 'fi' });
    }, 'primary'), fiOut);

  body.appendChild(h('h3', null, 'Neurotransmitters (summary)'));
  body.appendChild(api.table(['Transmitter', 'Main roles', 'Clinical links', 'Drug examples'], NT.map((r) => r.map((c) => api.esc(c)))));
  body.appendChild(h('p', { class: 'note' }, 'Simplified overview for an introductory course; real transmitter systems have many receptor subtypes and interact.'));
  body.appendChild(factBlock(api, ['F-HH']));
  body.appendChild(glossChips(api, ['Neuron', 'Resting potential', 'Action potential', 'Threshold of excitation', 'Depolarization', 'Refractory period', 'All-or-none principle', 'Rate coding', 'Synapse', 'Neurotransmitter', 'Agonist', 'Antagonist', 'Reuptake', 'Hodgkin–Huxley model', 'Leaky integrate-and-fire model']));
  body.appendChild(links(api, { paradigms: ['hick_hyman', 'go_nogo'], zone: 'neuro', panels: ['brain', 'sleep'] }));
}

/* ------------------------------------------------------------------ 8. BRAIN & CASES */

const REGIONS = {
  frontal: { name: 'Frontal lobe', fn: 'Planning, decision-making, working memory, self-control and voluntary movement (motor cortex at its rear edge). The prefrontal cortex matures into the mid-twenties.', damage: 'Impulsivity, poor planning, personality change (compare the Phineas Gage record).', term: 'Frontal lobe' },
  parietal: { name: 'Parietal lobe', fn: 'Touch and body sense (somatosensory cortex), spatial attention and integrating the senses.', damage: 'Right-parietal damage can cause neglect of the left side of space.', term: 'Parietal lobe' },
  temporal: { name: 'Temporal lobe', fn: 'Hearing, language comprehension (Wernicke\'s area, usually left), object and face recognition; inner structures support memory.', damage: 'Fluent but meaningless speech (Wernicke\'s aphasia); recognition problems.', term: 'Temporal lobe' },
  occipital: { name: 'Occipital lobe', fn: 'Primary and higher visual processing.', damage: 'Blindness in part of the visual field; specific visual deficits.', term: 'Occipital lobe' },
  cerebellum: { name: 'Cerebellum', fn: 'Coordination, balance, timing and motor learning; also some cognitive roles.', damage: 'Clumsy, poorly timed movements (ataxia).', term: 'Cerebellum' },
  brainstem: { name: 'Brainstem', fn: 'Medulla, pons and midbrain: breathing, heart rate, arousal (reticular formation), relaying signals.', damage: 'Can be life-threatening; disorders of consciousness.', term: 'Brainstem' },
  broca: { name: 'Broca\'s area', fn: 'Speech production and grammar (usually left frontal).', damage: 'Slow, effortful, telegraphic speech with relatively spared comprehension.', term: "Broca's area" },
  motor: { name: 'Motor cortex', fn: 'Sends commands for voluntary movement; body mapped in an upside-down "homunculus".', damage: 'Weakness or paralysis on the opposite side of the body.', term: 'Motor cortex' },
  hippocampus: { name: 'Hippocampus', fn: 'Forming new long-term declarative memories; spatial navigation.', damage: 'Anterograde amnesia (see H.M. below).', term: 'Hippocampus' },
  amygdala: { name: 'Amygdala', fn: 'Detecting threat and emotional significance; fear learning.', damage: 'Reduced fear responses and difficulty reading fear in faces.', term: 'Amygdala' },
  thalamus: { name: 'Thalamus', fn: 'Relay station for most senses on their way to the cortex; attention and arousal.', damage: 'Sensory loss; disturbances of consciousness.', term: 'Thalamus' },
  hypothalamus: { name: 'Hypothalamus', fn: 'Hunger, thirst, temperature, sexual behaviour; controls the pituitary; contains the circadian clock (SCN).', damage: 'Disrupted eating, temperature and sleep regulation.', term: 'Hypothalamus' },
  callosum: { name: 'Corpus callosum', fn: 'Thick band of fibres linking the two hemispheres.', damage: 'When cut (split-brain surgery), the hemispheres can be shown to process information separately.', term: 'Corpus callosum' },
  basal: { name: 'Basal ganglia', fn: 'Initiating and selecting movements; habit learning; reward.', damage: 'Parkinson\'s and Huntington\'s disease involve these circuits.', term: 'Basal ganglia' },
};
const SB_WORDS = ['KEY', 'CUP', 'PEN', 'RING', 'BALL', 'SPOON', 'COMB', 'BOOK'];

function renderBrain(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Mapping the brain'));
  body.append(...paras(api, [
    'The cerebral cortex is divided into four lobes in each hemisphere, with deeper structures (limbic system, thalamus, basal ganglia) and the brainstem and cerebellum below. Functions are <b>localised</b> but never isolated: complex abilities rely on networks.',
    'Evidence comes from <b>lesion studies</b> (what is lost after damage), recording (EEG, ERP), imaging (fMRI, PET) and stimulation (TMS). Each method trades off <b>temporal</b> against <b>spatial</b> precision. Click a region on the map (front of the brain is on the left) or use the buttons.',
  ]));
  const info = h('div', { class: 'card', 'aria-live': 'polite' });
  const showR = (k) => {
    const R = REGIONS[k]; info.innerHTML = '';
    info.append(h('h4', null, R.name), h('p', null, h('b', null, 'Functions: '), R.fn), h('p', null, h('b', null, 'After damage: '), R.damage));
    const g = api.glossary(R.term); if (g) { info.append(h('p', { class: 'note' }, g.term + ': ' + g.def)); api.emit('glossary:lookup', { term: g.term }); }
    map.querySelectorAll('[data-r]').forEach((el) => el.setAttribute('stroke-width', el.dataset.r === k ? '4' : '1.5'));
  };
  const map = svgEl(`<svg class="chart" viewBox="0 0 420 270" role="img" aria-label="Lateral view of the left hemisphere; front on the left. Click a region."><title>Brain map, lateral view</title>
    <path data-r="frontal" d="M60,150 C40,90 90,30 170,28 L200,30 L190,150 L120,160 Z" fill="#E69F00" fill-opacity=".55" stroke="#fff"/>
    <path data-r="motor" d="M200,30 L218,32 L206,150 L190,150 Z" fill="#D55E00" fill-opacity=".7" stroke="#fff"/>
    <path data-r="parietal" d="M218,32 C280,35 330,60 340,110 L270,130 L206,150 Z" fill="#56B4E9" fill-opacity=".55" stroke="#fff"/>
    <path data-r="occipital" d="M340,110 C365,135 360,170 335,190 L290,180 L270,130 Z" fill="#009E73" fill-opacity=".55" stroke="#fff"/>
    <path data-r="temporal" d="M120,160 L206,150 L270,130 L290,180 C250,215 160,215 115,190 Z" fill="#CC79A7" fill-opacity=".55" stroke="#fff"/>
    <path data-r="broca" d="M118,140 L160,136 L165,158 L122,162 Z" fill="#F0E442" fill-opacity=".8" stroke="#fff"/>
    <path data-r="cerebellum" d="M270,200 C300,190 340,195 335,225 C320,245 280,240 265,225 Z" fill="#0072B2" fill-opacity=".7" stroke="#fff"/>
    <path data-r="brainstem" d="M225,195 L255,195 L260,262 L232,262 Z" fill="#999" fill-opacity=".8" stroke="#fff"/>
    <text x="110" y="95">Frontal</text><text x="255" y="90">Parietal</text><text x="300" y="160">Occip.</text><text x="175" y="185">Temporal</text><text x="275" y="222">Cereb.</text><text x="120" y="153" font-size="10">Broca</text><text x="196" y="22">Motor</text><text x="262" y="258">Stem</text></svg>`);
  map.querySelectorAll('[data-r]').forEach((el) => { el.style.cursor = 'pointer'; el.addEventListener('click', () => showR(el.dataset.r)); });
  body.append(map, h('div', { class: 'row', role: 'group', 'aria-label': 'Brain regions' }, Object.entries(REGIONS).map(([k, R]) => btn(R.name, () => showR(k), 'ghost'))), info);
  showR('frontal');

  // Split-brain
  body.appendChild(h('h3', null, 'Split-brain: divided visual field'));
  body.append(...paras(api, [
    'Each hemisphere receives input from the <b>opposite</b> visual field. In most people speech is produced by the left hemisphere. When the <b>corpus callosum</b> has been cut, a word flashed to the <b>right</b> visual field reaches the speaking left hemisphere and can be named; a word flashed to the <b>left</b> visual field reaches only the right hemisphere: the patient says they saw nothing, yet the left hand (controlled by the right hemisphere) can pick out the matching object by touch.',
    'The flash is brief so the eyes cannot move to bring the word to the centre. This is a simulated patient illustrating the classic Sperry–Gazzaniga findings; it is not real data.',
  ]));
  const st = { field: 'left', word: 'KEY', cut: true };
  const log = [];
  const screen = h('div', { style: { background: '#0b1020', borderRadius: '10px', height: '110px', position: 'relative', margin: '6px 0' }, role: 'img', 'aria-label': 'Divided visual field screen' },
    h('div', { style: { position: 'absolute', left: '50%', top: '40px', transform: 'translateX(-50%)', fontSize: '24px', color: '#fff' } }, '+'));
  const wordEl = h('div', { style: { position: 'absolute', top: '38px', fontSize: '26px', fontWeight: '800', color: '#fde68a', visibility: 'hidden' } }, '');
  screen.appendChild(wordEl);
  const report = h('div', { class: 'card', 'aria-live': 'polite' });
  const chartHost = h('div');
  const drawLog = () => {
    chartHost.innerHTML = '';
    if (!log.length) return;
    const pct = (f, k) => { const L = log.filter((x) => x.field === f && x.cut === st.cut); return L.length ? 100 * L.filter((x) => x[k]).length / L.length : 0; };
    chartHost.append(api.simLabel(), api.charts.bar([{ name: 'LVF: says it', value: pct('left', 'verbal') }, { name: 'LVF: left hand', value: pct('left', 'hand') }, { name: 'RVF: says it', value: pct('right', 'verbal') }, { name: 'RVF: left hand', value: pct('right', 'hand') }], { label: `Simulated patient (${st.cut ? 'callosum cut' : 'intact'}): % correct by visual field and response`, yl: '% correct', yr: [0, 110] }),
      h('p', { class: 'note' }, `${log.filter((x) => x.cut === st.cut).length} trials in this condition.`));
  };
  const flash = () => {
    const word = st.word === 'random' ? SB_WORDS[Math.floor(Math.random() * SB_WORDS.length)] : st.word;
    wordEl.textContent = word;
    wordEl.style.left = st.field === 'left' ? '18%' : '68%';
    wordEl.style.visibility = 'visible';
    report.innerHTML = ''; report.append(h('p', null, 'Fixate the cross…'));
    setTimeout(() => {
      wordEl.style.visibility = 'hidden';
      const toLeftHemi = st.field === 'right';
      const verbal = !st.cut || toLeftHemi, hand = !st.cut || !toLeftHemi;
      const guess = SB_WORDS.filter((w) => w !== word)[Math.floor(Math.random() * (SB_WORDS.length - 1))];
      log.push({ field: st.field, cut: st.cut, verbal, hand });
      report.innerHTML = '';
      report.append(h('h4', null, `Word shown: ${word} in the ${st.field} visual field → ${toLeftHemi ? 'left' : 'right'} hemisphere`),
        h('p', null, h('b', null, 'Patient says: '), verbal ? `"I saw the word ${word}."` : '"I didn\'t see anything… maybe a flash?"'),
        h('p', null, h('b', null, 'Left hand, reaching behind a screen, picks up: '), hand ? `the ${word.toLowerCase()} ✓` : `a ${guess.toLowerCase()} (chance guess)`),
        h('p', { class: 'note' }, st.cut ? (toLeftHemi ? 'The verbal left hemisphere saw it; the right hemisphere (left hand) did not.' : 'Only the non-verbal right hemisphere saw it: it can act on the word but cannot report it in speech. Asked why the hand chose that object, patients often invent a plausible reason (confabulation).') : 'With an intact corpus callosum the information is shared, so both responses are correct.'), api.simLabel());
      drawLog();
    }, 180);
  };
  body.append(h('div', { class: 'row' },
    api.select('Visual field', [{ value: 'left', label: 'Left visual field (LVF)' }, { value: 'right', label: 'Right visual field (RVF)' }], st.field, (v) => { st.field = v; }),
    api.select('Word', ['random'].concat(SB_WORDS), st.word, (v) => { st.word = v; }),
    api.select('Corpus callosum', [{ value: 'cut', label: 'Cut (split-brain patient)' }, { value: 'intact', label: 'Intact (control)' }], 'cut', (v) => { st.cut = v === 'cut'; drawLog(); })),
  btn('Flash word (180 ms)', flash, 'primary'), screen, report, chartHost);

  // Lesion cases
  body.appendChild(h('h3', null, 'Lesion case cards'));
  const cases = (sim.data.cases || []).filter((c) => c.id === 'CS-HM' || c.id === 'CS-GAGE');
  body.appendChild(h('div', { class: 'grid2' }, cases.map((c) => {
    const more = h('div', { hidden: true }, h('p', null, h('b', null, 'What later research says: '), c.laterResearch), ...(c.factRefs || []).map((id) => api.factLine(id)));
    return h('div', { class: 'card' }, h('h4', null, c.title), h('p', null, h('span', { class: 'pill' }, c.years), h('span', { class: 'pill' }, 'Replication / record: ' + c.replication)), h('p', null, c.summary),
      h('div', { class: 'row' }, btn('Later research & sources', () => { more.hidden = !more.hidden; }, 'ghost'), btn('Open Case Studies', () => api.openPanel('cases'), 'ghost')), more);
  })));
  body.appendChild(h('h3', null, 'Methods for studying the brain'));
  body.appendChild(api.table(['Method', 'What it measures', 'Timing precision', 'Spatial precision'], [
    ['Lesion / case study', 'Behaviour after damage', '—', 'Depends on imaging of the damage'], ['EEG / ERP', 'Electrical activity at the scalp', 'Excellent (milliseconds)', 'Poor'],
    ['fMRI', 'Blood-oxygen changes linked to activity', 'Moderate (seconds)', 'Good (millimetres)'], ['PET', 'Uptake of a radioactive tracer', 'Poor', 'Moderate'], ['TMS', 'Temporarily disrupts a region (causal test)', 'Good', 'Moderate'],
  ]));
  body.appendChild(factBlock(api, ['F-HM', 'F-GAGE']));
  body.appendChild(glossChips(api, ['Cerebral cortex', 'Frontal lobe', 'Prefrontal cortex', 'Parietal lobe', 'Temporal lobe', 'Occipital lobe', 'Corpus callosum', 'Split-brain', 'Lateralization', 'Hippocampus', 'Amygdala', 'Lesion study', 'Phineas Gage', 'Functional MRI (fMRI)', 'Electroencephalography (EEG)']));
  body.appendChild(links(api, { paradigms: ['serial_position', 'memory_palace'], zone: 'neuro', panels: ['bio', 'cases'] }));
}

/* ------------------------------------------------------------------ 9. SLEEP */

/** Illustrative hypnogram model (0.5-min epochs). Exported for tests. */
function simulateNight(rng, { hours = 8, pressure = 0.5, disrupt = 0.01 } = {}) {
  const total = Math.round(hours * 120), st = [];
  const lat = Math.max(4, Math.round(rng.normal(36 - 24 * pressure, 6)));
  for (let i = 0; i < lat && st.length < total; i++) st.push('W');
  for (let k = 0; st.length < total; k++) {
    const len = Math.max(120, Math.round(rng.normal(180, 18)));
    const n3 = Math.max(0, Math.round(len * Math.max(0, 0.38 - 0.11 * k) * (0.6 + 0.8 * pressure)));
    const rem = Math.round(len * Math.min(0.45, 0.07 + 0.09 * k));
    const n1 = Math.round(len * 0.05), n2 = Math.max(0, len - n3 - rem - n1);
    const seq = [['N1', n1], ['N2', Math.ceil(n2 / 2)], ['N3', n3], ['N2', Math.floor(n2 / 2)], ['REM', rem]];
    for (const [s, n] of seq) for (let i = 0; i < n && st.length < total; i++) {
      if (rng.random() < disrupt) { const w = 1 + Math.floor(rng.random() * 4); for (let j = 0; j < w && st.length < total; j++) st.push('W'); }
      if (st.length < total) st.push(s);
    }
  }
  return st.slice(0, total);
}
function eegWave(stage, rng) {
  const pts = [];
  for (let i = 0; i < 300; i++) {
    const t = i / 100, n = rng.normal(0, 1);
    let v;
    if (stage === 'W') v = 18 * Math.sin(2 * Math.PI * 10 * t) + 6 * Math.sin(2 * Math.PI * 22 * t + 1) + 4 * n;
    else if (stage === 'N1') v = 28 * Math.sin(2 * Math.PI * 5.5 * t) + 6 * Math.sin(2 * Math.PI * 9 * t) + 5 * n;
    else if (stage === 'N2') { v = 25 * Math.sin(2 * Math.PI * 5 * t) + 5 * n; if (t > 0.8 && t < 1.5) v += 22 * Math.sin(2 * Math.PI * 13 * t) * Math.sin(Math.PI * (t - 0.8) / 0.7); if (t > 2.0 && t < 2.6) v += -110 * Math.sin(Math.PI * (t - 2.0) / 0.3) * (t < 2.3 ? 1 : -0.6); }
    else if (stage === 'N3') v = 85 * Math.sin(2 * Math.PI * 1.4 * t) + 30 * Math.sin(2 * Math.PI * 0.8 * t + 2) + 6 * n;
    else v = 14 * Math.sin(2 * Math.PI * 6 * t) + 12 * (((3 * t) % 1) - 0.5) + 6 * Math.sin(2 * Math.PI * 18 * t) + 4 * n;
    pts.push({ x: t, y: v });
  }
  return pts;
}
const STAGE_TEXT = {
  W: ['Wake (relaxed, eyes closed)', 'Alpha rhythm (8–12 Hz) dominates when relaxed with eyes closed; faster, low-amplitude beta when alert.'],
  N1: ['N1 — light sleep', 'Transition stage: alpha fades into slower theta waves; slow rolling eye movements; easy to wake; brief hypnic jerks.'],
  N2: ['N2 — stable light sleep', 'Theta background with <b>sleep spindles</b> (short bursts of fast waves) and <b>K-complexes</b> (large single waves). Most of the night is spent here.'],
  N3: ['N3 — slow-wave sleep', 'High-amplitude, slow <b>delta</b> waves. Hardest to wake from; concentrated in the first half of the night and increased after sleep loss.'],
  REM: ['REM sleep', 'Low-amplitude, mixed-frequency EEG resembling wake, rapid eye movements, and near-paralysis of skeletal muscles. Vivid dreams are most often reported on waking from REM. REM periods lengthen towards morning.'],
};

function renderSleep(body, api) {
  const { h, btn } = api;
  body.appendChild(h('h3', null, 'Consciousness and sleep'));
  body.append(...paras(api, [
    '<b>Consciousness</b> is our awareness of ourselves and the world. It varies across a day: alert wakefulness, drowsiness, sleep, and altered states from meditation, hypnosis or drugs. Sleep is not "switching off": the brain cycles through distinct stages measured by <b>polysomnography</b> (EEG, eye movements, muscle tone).',
    'Two processes regulate sleep. <b>Sleep pressure</b> (process S) builds the longer we are awake and dissipates during sleep; adenosine accumulation is one contributor, which caffeine blocks. The <b>circadian clock</b> (process C) in the suprachiasmatic nucleus of the hypothalamus is reset mainly by light and signals night via <b>melatonin</b>.',
    'A typical night cycles through N1 → N2 → N3 → N2 → REM several times. Early cycles are rich in slow-wave sleep; later cycles contain more REM.',
  ]));

  // Hypnogram
  body.appendChild(h('h3', null, 'Hypnogram generator'));
  const hp = { hours: 8, pressure: 0.5, disrupt: 0.01, seed: 7 };
  const hypOut = h('div', { 'aria-live': 'polite' });
  const gen = () => {
    const stages = simulateNight(new api.Rng(hp.seed), hp);
    const count = (s) => stages.filter((x) => x === s).length;
    const sleepEp = stages.length - count('W');
    hypOut.innerHTML = '';
    hypOut.append(api.simLabel('Simulated night (illustrative model)'), api.charts.hypnogram(stages, { label: `Hypnogram of a simulated ${hp.hours}-hour night` }),
      api.table(['Stage', 'Minutes', '% of sleep'], ['W', 'N1', 'N2', 'N3', 'REM'].map((s) => [s, fmt(count(s) / 2, 0), s === 'W' ? '—' : fmt(100 * count(s) / Math.max(1, sleepEp), 0) + '%'])),
      h('p', { class: 'note' }, `Sleep efficiency ${fmt(100 * sleepEp / stages.length, 0)}%. Model parameters are illustrative, not clinical norms.`));
  };
  body.append(api.slider('Time in bed (hours)', { min: 4, max: 10, step: 0.5, value: hp.hours, fmt: (v) => v.toFixed(1), onInput: (v) => { hp.hours = v; gen(); } }),
    api.slider('Sleep pressure (prior wake / sleep debt)', { min: 0, max: 1, step: 0.05, value: hp.pressure, fmt: (v) => v.toFixed(2), onInput: (v) => { hp.pressure = v; gen(); } }),
    api.slider('Disruption (noise, apnoea-like arousals)', { min: 0, max: 0.06, step: 0.005, value: hp.disrupt, fmt: (v) => v.toFixed(3), onInput: (v) => { hp.disrupt = v; gen(); } }),
    h('div', { class: 'row' }, btn('Generate another night', () => { hp.seed++; gen(); }, 'primary')), hypOut);
  gen();

  // EEG by stage
  body.appendChild(h('h3', null, 'EEG by stage'));
  const eegOut = h('div', { 'aria-live': 'polite' });
  const showStage = (s) => {
    eegOut.innerHTML = '';
    eegOut.append(h('h4', null, STAGE_TEXT[s][0]), h('p', { html: STAGE_TEXT[s][1] }), api.charts.trace(eegWave(s, new api.Rng(s.length * 31)), { label: `Synthetic EEG, ${STAGE_TEXT[s][0]} (illustrative waveform)`, xl: 's', yl: 'µV', color: '#56B4E9', yr: [-150, 150] }), api.simLabel('Synthetic waveform'));
  };
  body.append(h('div', { class: 'row', role: 'group', 'aria-label': 'Sleep stages' }, ['W', 'N1', 'N2', 'N3', 'REM'].map((s) => btn(s, () => showStage(s), 'ghost'))), eegOut);
  showStage('N2');

  // Circadian sim
  body.appendChild(h('h3', null, 'Circadian & sleep-pressure simulator'));
  body.appendChild(h('p', null, 'A simplified two-process model. Evening light (for example, phone screens) delays the clock; caffeine masks sleep pressure for several hours. The curve shows predicted sleepiness over two days; bedtime is easiest when sleepiness is high.'));
  const cz = { wake: 7, bed: 23, light: 0, cafDose: 0, cafTime: 16 };
  const czOut = h('div', { 'aria-live': 'polite' });
  const circ = () => {
    const shift = cz.light * 0.6; // illustrative phase delay (h) per hour of evening light
    const pts = { S: [], C: [], Z: [] };
    let S = 0.3;
    for (let i = 0; i <= 48 * 4; i++) {
      const t = i / 4, hod = t % 24;
      const asleep = cz.bed > cz.wake ? (hod >= cz.bed || hod < cz.wake) : (hod >= cz.bed && hod < cz.wake);
      S = asleep ? S * Math.exp(-0.25 / 4.2) : 1 - (1 - S) * Math.exp(-0.25 / 18.2);
      const C = 0.25 * Math.cos(2 * Math.PI * (t - 17 - shift) / 24);
      let caf = 0;
      for (const day of [0, 24]) { const dt = t - (cz.cafTime + day); if (dt >= 0) caf += cz.cafDose * 0.12 * Math.pow(0.5, dt / 5); }
      pts.S.push({ x: t, y: S }); pts.C.push({ x: t, y: C }); pts.Z.push({ x: t, y: S - C - caf });
    }
    const atBed = pts.Z[Math.round((24 + cz.bed) * 4)] || pts.Z[pts.Z.length - 1];
    czOut.innerHTML = '';
    czOut.append(api.charts.line([{ name: 'Sleep pressure S', points: pts.S }, { name: 'Circadian alerting C', points: pts.C, dash: true }, { name: 'Net sleepiness', points: pts.Z }], { label: 'Illustrative two-process model over 48 hours', xl: 'hours from midnight', yl: 'arbitrary units' }),
      h('p', null, `Net sleepiness at bedtime (day 2): ${fmt(atBed.y)} (arbitrary units). ${cz.light > 1 || cz.cafDose > 1 ? 'Light and/or caffeine are lowering sleepiness at bedtime — expect longer sleep-onset latency.' : 'Sleepiness is near its natural level at bedtime.'}`),
      api.simLabel('Illustrative model'));
  };
  body.append(api.slider('Wake time (h)', { min: 4, max: 11, step: 0.5, value: cz.wake, onInput: (v) => { cz.wake = v; circ(); } }),
    api.slider('Bedtime (h)', { min: 20, max: 23.5, step: 0.5, value: cz.bed, onInput: (v) => { cz.bed = v; circ(); } }),
    api.slider('Bright light / screen use in the evening (h)', { min: 0, max: 4, step: 0.5, value: cz.light, onInput: (v) => { cz.light = v; circ(); } }),
    api.slider('Caffeine (cups)', { min: 0, max: 4, step: 1, value: cz.cafDose, onInput: (v) => { cz.cafDose = v; circ(); } }),
    api.slider('Caffeine time (h)', { min: 6, max: 22, step: 1, value: cz.cafTime, onInput: (v) => { cz.cafTime = v; circ(); } }), czOut);
  circ();
  body.appendChild(factBlock(api, ['F-SLEEP', 'F-CIRC', 'F-CLOCK']));
  body.appendChild(glossChips(api, ['Consciousness', 'Circadian rhythm', 'Suprachiasmatic nucleus', 'Melatonin', 'NREM sleep', 'REM sleep', 'Slow-wave sleep', 'Sleep spindle', 'K-complex', 'Hypnogram', 'Polysomnography', 'Insomnia', 'Sleep apnea', 'Sleep deprivation', 'Activation-synthesis hypothesis']));
  body.appendChild(links(api, { paradigms: ['go_nogo', 'nback'], zone: 'sleep', panels: ['bio', 'health'] }));
}

/* ------------------------------------------------------------------ 10. SENSATION */

function stevensPresets(api) {
  const f = api.fact('F-STEVENS'); const v = f ? String(f.value) : '';
  const grab = (re) => { const m = v.match(re); return m ? +m[1] : null; };
  return [['Brightness', grab(/Brightness\s+([\d.]+)/i)], ['Loudness', grab(/loudness\s+([\d.]+)/i)], ['Visual length', grab(/length\s+([\d.]+)/i)], ['Electric shock', grab(/shock\s+([\d.]+)/i)]].filter((p) => p[1] != null);
}

function renderSensation(body, api) {
  const { h, btn } = api;
  const PP = api.psychophysics;
  body.appendChild(h('h3', null, 'Sensation and psychophysics'));
  body.append(...paras(api, [
    '<b>Sensation</b> is the detection of physical energy by receptors (<b>transduction</b>); <b>perception</b> is its interpretation. <b>Psychophysics</b> measures the lawful relation between stimulus intensity and experience.',
    'The <b>absolute threshold</b> is the weakest stimulus detected half the time; the <b>difference threshold</b> or <b>JND</b> is the smallest detectable change. <b>Weber\'s law</b> says the JND is a constant fraction of the standard (ΔI/I = k). <b>Fechner</b> derived that sensation grows with the logarithm of intensity; <b>Stevens</b> found, using magnitude estimation, that sensation follows a power function whose exponent differs across senses.',
    'Thresholds are measured with the method of limits, constant stimuli, adjustment, or adaptive <b>staircases</b>, which concentrate trials near threshold. Signal detection theory (next panel) separates sensitivity from response bias.',
  ]));

  // Laws explorer
  body.appendChild(h('h3', null, 'Laws explorer'));
  const L = { k: 0.08, fk: 1, a: 1 };
  const lawsOut = h('div', { 'aria-live': 'polite' });
  const presets = stevensPresets(api);
  const drawLaws = () => {
    const Is = Array.from({ length: 40 }, (_, i) => 10 + i * 10);
    lawsOut.innerHTML = '';
    lawsOut.append(
      api.charts.line([{ name: `JND (k = ${L.k.toFixed(2)})`, points: Is.map((I) => ({ x: I, y: L.k * I })) }], { label: 'Weber\'s law: the JND grows in proportion to the standard', xl: 'standard intensity I', yl: 'ΔI (JND)' }),
      api.charts.line([{ name: 'Fechner S = k·ln(I/I₀)', points: Is.map((I) => ({ x: I, y: PP.fechner(I, 10, L.fk) })) }], { label: 'Fechner\'s law: equal ratios give equal sensation steps', xl: 'intensity I (I₀ = 10)', yl: 'sensation S' }),
      api.charts.line(presets.map(([n, a]) => ({ name: `${n} (a = ${a})`, points: Array.from({ length: 30 }, (_, i) => ({ x: (i + 1) / 3, y: PP.stevens((i + 1) / 3, 1, a) })) })).concat([{ name: `your a = ${L.a.toFixed(2)}`, points: Array.from({ length: 30 }, (_, i) => ({ x: (i + 1) / 3, y: PP.stevens((i + 1) / 3, 1, L.a) })), dash: true }]), { label: 'Stevens\' power law ψ = φᵃ for published exponents (from the fact line) and your exponent', xl: 'stimulus magnitude φ', yl: 'sensation ψ', yr: [0, 12] }),
      h('p', { class: 'note' }, 'Exponents below 1 compress (doubling energy less than doubles sensation); above 1 expand. On log–log axes each power function becomes a straight line whose slope is the exponent.'));
  };
  body.append(api.slider('Weber fraction k', { min: 0.01, max: 0.3, step: 0.01, value: L.k, fmt: (v) => v.toFixed(2), onInput: (v) => { L.k = v; drawLaws(); } }),
    api.slider('Fechner constant k', { min: 0.2, max: 3, step: 0.1, value: L.fk, fmt: (v) => v.toFixed(1), onInput: (v) => { L.fk = v; drawLaws(); } }),
    api.slider('Stevens exponent a', { min: 0.2, max: 3.5, step: 0.05, value: L.a, fmt: (v) => v.toFixed(2), onInput: (v) => { L.a = v; drawLaws(); } }), lawsOut);
  drawLaws();

  // Staircase demo
  body.appendChild(h('h3', null, 'Staircase demo: find your JND for line length'));
  body.appendChild(h('p', null, 'Two lines are shown; one is longer by the current staircase step. Choose the longer one. Two correct answers in a row make it harder; one error makes it easier (2-down-1-up), so the staircase homes in on about 71% correct. Not a timed measurement.'));
  const STD = 200;
  let sc = null, cmpSide = 'left';
  const stage = h('div');
  const scOut = h('div', { 'aria-live': 'polite' });
  const newStair = () => { sc = new PP.Staircase({ start: 40, step: 8, minStep: 2, nDown: 2, floor: 1, ceiling: 120, maxReversals: 8 }); };
  const drawStim = () => {
    cmpSide = Math.random() < 0.5 ? 'left' : 'right';
    const lenL = cmpSide === 'left' ? STD + sc.level : STD, lenR = cmpSide === 'right' ? STD + sc.level : STD;
    stage.innerHTML = '';
    stage.appendChild(svgEl(`<svg class="chart" viewBox="0 0 560 80" role="img" aria-label="Two horizontal lines to compare"><title>Two lines to compare</title><line x1="${140 - lenL / 2}" x2="${140 + lenL / 2}" y1="40" y2="40" stroke="#e2e8f0" stroke-width="4"/><line x1="${420 - lenR / 2}" x2="${420 + lenR / 2}" y1="${40 + (Math.random() * 10 - 5)}" y2="${40}" stroke="#e2e8f0" stroke-width="4"/></svg>`));
  };
  const drawStairChart = (title) => {
    scOut.innerHTML = '';
    if (!sc || !sc.history.length) return;
    const pts = sc.history.map((x, i) => ({ x: i + 1, y: x.level }));
    scOut.append(api.charts.line([{ name: 'step size (px)', points: pts, dots: true }], { label: title, xl: 'trial', yl: 'length difference (px)', yr: [0, 50] }),
      h('p', null, `Trials ${sc.history.length}, reversals ${sc.reversals.length}/8. ${sc.done ? `Threshold ≈ ${fmt(sc.threshold(), 1)} px → Weber fraction ≈ ${fmt(sc.threshold() / STD, 3)}.` : 'Keep going until 8 reversals.'}`));
  };
  const answer = (side) => {
    if (!sc) newStair();
    if (sc.done) { api.toast('Staircase finished. Press "New staircase" to start again.'); return; }
    sc.update(side === cmpSide);
    drawStairChart('Your staircase (2-down-1-up)');
    if (!sc.done) drawStim(); else { stage.innerHTML = ''; stage.append(h('p', null, 'Done! Your estimate is above.')); api.sim.addXP(10, 'Completed a JND staircase'); }
  };
  newStair(); drawStim();
  let trueThr = 8;
  body.append(stage, h('div', { class: 'row' }, btn('◀ Left is longer', () => answer('left'), 'primary'), btn('Right is longer ▶', () => answer('right'), 'primary'), btn('New staircase', () => { newStair(); drawStim(); scOut.innerHTML = ''; }, 'ghost')),
    api.slider('Simulated observer\'s true threshold (px)', { min: 2, max: 30, step: 1, value: trueThr, onInput: (v) => { trueThr = v; } }),
    btn('Run simulated observer (80 trials)', () => {
      newStair();
      const rng = new api.Rng(Date.now() % 100000);
      for (let i = 0; i < 80 && !sc.done; i++) { const pc = 0.5 + 0.5 * (1 - Math.exp(-Math.pow(sc.level / trueThr, 2))); sc.update(rng.random() < pc); }
      drawStairChart(`Simulated observer staircase (true threshold ${trueThr} px)`); scOut.prepend(api.simLabel());
      drawStim();
    }, 'ghost'), scOut);

  body.appendChild(h('h3', null, 'Your psychophysics results'));
  body.appendChild(ownResults(api, ['jnd_staircase', 'magnitude_est', 'hick_hyman', 'fitts']));
  body.appendChild(factBlock(api, ['F-WEBER', 'F-FECHNER', 'F-STEVENS', 'F-HICK', 'F-FITTS']));
  body.appendChild(glossChips(api, ['Sensation', 'Perception', 'Transduction', 'Psychophysics', 'Absolute threshold', 'Difference threshold', 'Just-noticeable difference (JND)', "Weber's law", "Fechner's law", "Stevens' power law", 'Staircase procedure', 'Method of constant stimuli', 'Psychometric function', 'Sensory adaptation', 'Hick–Hyman law', "Fitts's law"]));
  body.appendChild(links(api, { paradigms: ['jnd_staircase', 'magnitude_est', 'hick_hyman', 'fitts'], zone: 'explab', panels: ['sdt', 'illusions'] }));
}

/* ------------------------------------------------------------------ 11. SDT */

/** Hit and false-alarm rates for criterion c (equal-variance model). Exported for tests. */
function sdtRates(d, c) {
  const D = require('../../psych/dist.js');
  const lam = d / 2 + c;
  return { H: 1 - D.normCdf(lam - d), FA: 1 - D.normCdf(lam), lam, beta: Math.exp(d * c) };
}

function renderSDT(body, api) {
  const { h, btn, sim } = api;
  body.appendChild(h('h3', null, 'Signal detection theory'));
  body.append(...paras(api, [
    'In a detection task, every trial produces internal evidence that varies from trial to trial. On <b>noise</b> trials the evidence comes from one distribution; on <b>signal</b> trials it is shifted upward. The observer says "yes" when evidence exceeds a <b>criterion</b>.',
    '<b>Sensitivity d′</b> is the distance between the two distributions in SD units: d′ = z(H) − z(FA). <b>Criterion c</b> is response bias: c = −½[z(H) + z(FA)]; positive c is conservative (fewer yeses), negative is liberal. Two observers can have the same hit rate but very different sensitivity.',
    'Payoffs and base rates should move the criterion, not sensitivity. The <b>ROC curve</b> plots hits against false alarms as the criterion shifts; one curve = one d′. This is why radiologists, airport screeners and eyewitness procedures are evaluated with SDT.',
  ]));
  const s = { d: 1.5, c: 0 };
  const view = h('div', { 'aria-live': 'polite' });
  const emitT = throttle(() => api.emit('stats:test', { test: 'sdt' }), 1500);
  const draw = () => {
    const r = sdtRates(s.d, s.c);
    const D = api.dist;
    const xs = Array.from({ length: 121 }, (_, i) => -4 + i * (8 + s.d) / 120);
    view.innerHTML = '';
    view.append(api.charts.line([{ name: 'Noise', points: xs.map((x) => ({ x, y: D.normPdf(x) })) }, { name: 'Signal + noise', points: xs.map((x) => ({ x, y: D.normPdf(x - s.d) })) }, { name: 'Criterion', points: [{ x: r.lam, y: 0 }, { x: r.lam, y: 0.45 }], dash: true, color: '#D55E00' }], { label: `Noise and signal distributions, d′ = ${s.d.toFixed(2)}, criterion at ${fmt(r.lam)}`, xl: 'internal evidence', yl: 'density', yr: [0, 0.45] }),
      api.table(['Hit rate', 'Miss rate', 'False-alarm rate', 'Correct-rejection rate', 'd′', 'c', 'β'], [[fmt(r.H, 3), fmt(1 - r.H, 3), fmt(r.FA, 3), fmt(1 - r.FA, 3), fmt(s.d), fmt(s.c), fmt(r.beta)]]),
      api.charts.roc(api.sdt.rocCurve(s.d), { label: `ROC for d′ = ${s.d.toFixed(2)} (AUC = ${fmt(api.sdt.auc(s.d), 3)}); dot = current criterion`, empirical: [{ FA: r.FA, H: r.H, name: 'current criterion' }] }));
  };
  body.append(api.slider('Sensitivity d′', { min: 0, max: 4, step: 0.05, value: s.d, fmt: (v) => v.toFixed(2), onInput: (v) => { s.d = v; draw(); emitT(); } }),
    api.slider('Criterion c (negative = liberal)', { min: -2, max: 2, step: 0.05, value: s.c, fmt: (v) => v.toFixed(2), onInput: (v) => { s.c = v; draw(); emitT(); } }), view);
  draw();

  // Payoffs
  body.appendChild(h('h3', null, 'Payoffs and the optimal criterion'));
  const pay = { p: 0.5, hit: 1, miss: 1, cr: 1, fa: 1 };
  const payOut = h('p', { 'aria-live': 'polite' });
  const num = (label, k) => h('label', { class: 'f' }, label, h('input', { type: 'number', step: 'any', min: 0, value: pay[k], 'aria-label': label, oninput: (e) => { pay[k] = Math.max(0, +e.target.value); } }));
  body.append(h('p', null, 'An ideal observer sets β* = [P(noise)/P(signal)] × [(value of CR + cost of FA) / (value of hit + cost of miss)]. In the equal-variance model the matching criterion is c* = ln(β*) / d′.'),
    h('div', { class: 'row' }, num('P(signal)', 'p'), num('Value of hit', 'hit'), num('Cost of miss', 'miss'), num('Value of correct rejection', 'cr'), num('Cost of false alarm', 'fa')),
    btn('Compute optimal β and move criterion', () => {
      if (!(pay.p > 0 && pay.p < 1)) { payOut.textContent = 'P(signal) must be between 0 and 1.'; return; }
      const b = api.sdt.optimalBeta(pay.p, pay); const c = s.d > 0 ? Math.log(b) / s.d : 0;
      s.c = Math.max(-2, Math.min(2, c)); draw();
      const r = sdtRates(s.d, s.c);
      const ev = pay.p * (r.H * pay.hit - (1 - r.H) * pay.miss) + (1 - pay.p) * ((1 - r.FA) * pay.cr - r.FA * pay.fa);
      payOut.textContent = `Optimal β* = ${fmt(b, 3)} → c* = ${fmt(c)} at d′ = ${fmt(s.d)}. Expected payoff per trial = ${fmt(ev, 3)}. (Slider shows the criterion; the c slider handle itself is not moved.)`;
      api.emit('stats:test', { test: 'sdt' });
    }, 'primary'), payOut);

  // Counts calculator
  body.appendChild(h('h3', null, 'From counts to d′'));
  const cnt = { hits: 42, misses: 8, fas: 10, crs: 40 };
  const cOut = h('div', { 'aria-live': 'polite' });
  const cin = (label, k) => h('label', { class: 'f' }, label, h('input', { type: 'number', min: 0, step: 1, value: cnt[k], 'aria-label': label, oninput: (e) => { cnt[k] = Math.max(0, Math.round(+e.target.value)); } }));
  body.append(h('div', { class: 'row' }, cin('Hits', 'hits'), cin('Misses', 'misses'), cin('False alarms', 'fas'), cin('Correct rejections', 'crs')),
    btn('Compute d′ and c', () => {
      if (!(cnt.hits + cnt.misses) || !(cnt.fas + cnt.crs)) { cOut.textContent = 'Need at least one signal and one noise trial.'; return; }
      const r = api.sdt.fromCounts(cnt);
      cOut.innerHTML = '';
      cOut.append(h('p', { class: 'apa-out', html: api.format.italicise(api.esc(`H = ${fmt(r.H, 3)}, FA = ${fmt(r.FA, 3)}; ${api.apa.dprime(r.dprime, r.c)}, β = ${fmt(r.beta)}`)) }), r.corrected ? h('p', { class: 'note' }, 'Log-linear correction applied because a rate was 0 or 1 (see the fact line below).') : null);
      api.emit('stats:test', { test: 'sdt' });
    }, 'primary'), cOut);

  // Own data
  body.appendChild(h('h3', null, 'Your sdt_yesno data'));
  const own = h('div');
  const rows = ((sim.datasets && sim.datasets.sdt_yesno) || []).filter((r) => r.block !== 'practice' && (r.response === 'y' || r.response === 'n'));
  if (rows.length) {
    const conds = Array.from(new Set(rows.map((r) => r.condition)));
    const res = conds.map((cd) => {
      const R = rows.filter((r) => r.condition === cd), sig = R.filter((r) => r.stimulus === 'signal'), noi = R.filter((r) => r.stimulus !== 'signal');
      const c = { hits: sig.filter((r) => r.response === 'y').length, misses: sig.filter((r) => r.response === 'n').length, fas: noi.filter((r) => r.response === 'y').length, crs: noi.filter((r) => r.response === 'n').length };
      return Object.assign({ name: cd }, c, (c.hits + c.misses && c.fas + c.crs) ? api.sdt.fromCounts(c) : {});
    }).filter((r) => Number.isFinite(r.dprime));
    if (res.length) {
      const md = api.stats.mean(res.map((r) => r.dprime));
      own.append(api.table(['Payoff condition', 'Hits', 'Misses', 'FAs', 'CRs', 'd′', 'c'], res.map((r) => [api.esc(r.name), r.hits, r.misses, r.fas, r.crs, fmt(r.dprime), fmt(r.c)])),
        api.charts.roc(api.sdt.rocCurve(md), { label: 'Your payoff conditions on one iso-sensitivity ROC curve', empirical: res.map((r) => ({ FA: r.FA, H: r.H, name: r.name })) }),
        h('p', { class: 'note' }, 'If payoffs worked as theory predicts, c should differ across conditions while d′ stays roughly constant.'));
      api.emit('stats:test', { test: 'sdt' });
    } else own.append(h('p', { class: 'note' }, 'Not enough signal and noise trials yet.'));
  } else own.append(h('p', { class: 'note' }, 'No sdt_yesno runs yet.'));
  body.appendChild(own);
  body.appendChild(factBlock(api, ['F-HAUTUS']));
  body.appendChild(glossChips(api, ['Signal detection theory', 'Hit', 'False alarm', 'Miss', 'Correct rejection', 'd prime (d′)', 'Criterion (c)', 'ROC curve', 'Absolute threshold']));
  body.appendChild(links(api, { paradigms: ['sdt_yesno', 'jnd_staircase'], zone: 'explab', panels: ['sensation', 'eyewitness'] }));
}

/* ------------------------------------------------------------------ 12. ILLUSIONS */

function penroseSVG() {
  const n = 8, s = 20, R = ([a, b]) => [n - a - b, a];
  const P1 = [[0, 0], [n - 1, 0], [n - 2, 1], [2, 1], [2, n - 4], [1, n - 3], [1, 1], [0, 1]], P2 = P1.map(R), P3 = P2.map(R);
  const xy = ([a, b]) => `${(10 + (a + b / 2) * s).toFixed(1)},${(10 + (n - b) * s * Math.sqrt(3) / 2).toFixed(1)}`;
  return `<svg class="chart" viewBox="0 0 180 160" role="img" aria-label="Impossible triangle drawn from three bars"><title>Impossible (Penrose-style) triangle, procedurally drawn</title>${[P1, P2, P3].map((P, i) => `<polygon points="${P.map(xy).join(' ')}" fill="${['#E69F00', '#56B4E9', '#009E73'][i]}" stroke="#111" stroke-width="1.2"/>`).join('')}</svg>`;
}
const ML = (y, len, fins) => { const x0 = 160 - len / 2, x1 = 160 + len / 2, f = fins === 'out' ? -1 : 1; return `<line x1="${x0}" x2="${x1}" y1="${y}" y2="${y}" stroke="#e2e8f0" stroke-width="3"/><path d="M${x0 + 18 * f},${y - 14} L${x0},${y} L${x0 + 18 * f},${y + 14} M${x1 - 18 * f},${y - 14} L${x1},${y} L${x1 - 18 * f},${y + 14}" stroke="#e2e8f0" stroke-width="3" fill="none"/>`; };

function renderIllusions(body, api) {
  const { h, btn } = api;
  stopAnim();
  body.appendChild(h('h3', null, 'Perception is an inference'));
  body.append(...paras(api, [
    'The image on the retina is flat, small and ambiguous, yet we see a stable three-dimensional world. Perception combines <b>bottom-up</b> sensory data with <b>top-down</b> knowledge and assumptions (light comes from above, rooms are rectangular, faces are convex). <b>Illusions</b> are not failures so much as windows onto these normally helpful assumptions.',
    '<b>Depth cues</b> include binocular disparity and convergence, and monocular cues such as linear perspective, relative size, occlusion, texture gradient, shading and motion parallax. <b>Perceptual constancies</b> keep size, shape, lightness and colour stable despite changing retinal input. All figures here are original procedural drawings.',
  ]));
  const cards = h('div', { class: 'grid2' });
  const card = (title, fig, text, extra) => h('div', { class: 'card' }, h('h4', null, title), fig, h('p', null, text), extra || null);

  // Müller-Lyer with adjustment
  let mlLen = 160;
  const mlHost = h('div');
  const drawML = () => { mlHost.innerHTML = ''; mlHost.appendChild(svgEl(`<svg class="chart" viewBox="0 0 320 120" role="img" aria-label="Müller-Lyer figure with adjustable lower line"><title>Müller-Lyer figure</title>${ML(35, 160, 'in')}${ML(90, mlLen, 'out')}</svg>`)); };
  drawML();
  const mlRes = h('p', { class: 'note', 'aria-live': 'polite' });
  cards.append(card('Müller-Lyer', mlHost, 'Two lines differ only in their fins. One account: inward fins resemble the near corner of a building, outward fins a far corner, so size scaling is misapplied.',
    h('div', null, api.slider('Adjust the lower line until it looks equal', { min: 100, max: 220, step: 1, value: mlLen, onInput: (v) => { mlLen = v; drawML(); } }),
      btn('Check my match', () => { mlRes.textContent = `Your lower line is ${mlLen} px vs a 160 px upper line: error ${fmt(100 * (mlLen - 160) / 160, 1)}%. A negative error means the fins-out line looked longer to you.`; }, 'ghost'), mlRes,
      h('div', { class: 'row' }, btn('Run full paradigm', () => safeRun(api, 'muller_lyer'), 'primary')))));
  // Ponzo
  cards.append(card('Ponzo', svgEl(`<svg class="chart" viewBox="0 0 320 160" role="img" aria-label="Ponzo figure: two equal bars between converging rails"><title>Ponzo figure</title><line x1="110" y1="155" x2="155" y2="5" stroke="#999" stroke-width="3"/><line x1="210" y1="155" x2="165" y2="5" stroke="#999" stroke-width="3"/>${[20, 50, 80, 110, 140].map((y) => `<line x1="${110 + (155 - y) * 0.3 - 6}" x2="${210 - (155 - y) * 0.3 + 6}" y1="${y}" y2="${y}" stroke="#555"/>`).join('')}<rect x="125" y="35" width="70" height="7" fill="#E69F00"/><rect x="125" y="120" width="70" height="7" fill="#E69F00"/></svg>`),
    'The two orange bars are identical. Converging lines signal distance, so the upper bar is "seen" as farther away and therefore larger (size–distance scaling).', h('div', { class: 'row' }, btn('Run Ponzo paradigm', () => safeRun(api, 'ponzo'), 'primary'))));
  // Ames
  cards.append(card('Ames room', svgEl(`<svg class="chart" viewBox="0 0 320 160" role="img" aria-label="Floor plan of an Ames room: the left corner is much farther from the peephole"><title>Ames room floor plan (top view)</title><polygon points="40,20 280,70 280,140 40,140" fill="none" stroke="#e2e8f0" stroke-width="2"/><circle cx="160" cy="152" r="5" fill="#E69F00"/><text x="168" y="156">peephole</text><circle cx="50" cy="32" r="8" fill="#56B4E9"/><circle cx="268" cy="78" r="8" fill="#56B4E9"/><text x="30" y="16">far corner</text><text x="230" y="64">near corner</text><line x1="160" y1="152" x2="50" y2="32" stroke="#999" stroke-dasharray="4 3"/><line x1="160" y1="152" x2="268" y2="78" stroke="#999" stroke-dasharray="4 3"/></svg>`),
    'The room is trapezoidal but built so that, from the peephole, it projects the same image as a rectangular room. Assuming a normal room, we attribute the different image sizes of two people to their height rather than their distance.', h('div', { class: 'row' }, btn('Run Ames paradigm', () => safeRun(api, 'ames'), 'primary'))));
  // Necker
  let neckerFront = 0;
  const nkHost = h('div');
  const drawNk = () => {
    const front = neckerFront ? [[60, 60], [140, 60], [140, 140], [60, 140]] : [[100, 25], [180, 25], [180, 105], [100, 105]];
    nkHost.innerHTML = '';
    nkHost.appendChild(svgEl(`<svg class="chart" viewBox="0 0 240 170" role="img" aria-label="Necker cube; shaded face shows the current interpretation"><title>Necker cube</title><polygon points="${front.map((p) => p.join(',')).join(' ')}" fill="#56B4E9" fill-opacity=".35"/><g stroke="#e2e8f0" stroke-width="2" fill="none"><rect x="60" y="60" width="80" height="80"/><rect x="100" y="25" width="80" height="80"/><line x1="60" y1="60" x2="100" y2="25"/><line x1="140" y1="60" x2="180" y2="25"/><line x1="60" y1="140" x2="100" y2="105"/><line x1="140" y1="140" x2="180" y2="105"/></g></svg>`));
  };
  drawNk();
  cards.append(card('Necker cube', nkHost, 'A line drawing with two equally good 3D readings. Perception flips between them; you cannot see both at once, showing that the brain commits to one hypothesis at a time.', btn('Flip the interpretation', () => { neckerFront = 1 - neckerFront; drawNk(); }, 'ghost')));
  // Impossible triangle
  cards.append(card('Impossible triangle', svgEl(penroseSVG()), 'Each corner is a valid 3D joint, but the whole cannot exist. Local depth interpretations are made quickly and are not checked for global consistency.', btn('Explain how it is drawn', () => api.modal({ title: 'Impossible triangle', body: '<p>Three identical bent bars are drawn on a triangular grid and rotated by 120°. At each corner one bar is drawn in front of the next, which can only happen if each bar is both nearer and farther than its neighbour. Artists such as M. C. Escher built whole scenes from such locally plausible, globally impossible joints.</p>' }), 'ghost')));
  // Hollow face / light from above
  const shade = (id, top) => `<defs><radialGradient id="${id}" cx="50%" cy="${top ? '30%' : '70%'}" r="65%"><stop offset="0" stop-color="#f8fafc"/><stop offset="1" stop-color="#334155"/></radialGradient></defs>`;
  let flipped = false;
  const hfHost = h('div');
  const drawHF = () => { hfHost.innerHTML = ''; hfHost.appendChild(svgEl(`<svg class="chart" viewBox="0 0 320 120" role="img" aria-label="Two shaded discs: lit from above looks like a bump, lit from below looks like a dent"><title>Shape from shading</title>${shade('zg1', !flipped)}${shade('zg2', flipped)}<circle cx="90" cy="60" r="42" fill="url(#zg1)"/><circle cx="230" cy="60" r="42" fill="url(#zg2)"/><text x="90" y="116" text-anchor="middle">A</text><text x="230" y="116" text-anchor="middle">B</text></svg>`)); };
  drawHF();
  cards.append(card('Hollow face & shape from shading', hfHost, 'The visual system assumes light comes from above and that faces are convex. Disc A (bright on top) looks like a bump, disc B like a dent; turn the page upside down and they swap. The same convexity prior makes the inside of a mask look like a normal face turning to follow you.', btn('Swap the lighting', () => { flipped = !flipped; drawHF(); }, 'ghost')));
  // Colour constancy / lightness
  let bgOn = true;
  const ccHost = h('div');
  const drawCC = () => { ccHost.innerHTML = ''; ccHost.appendChild(svgEl(`<svg class="chart" viewBox="0 0 320 120" role="img" aria-label="Two identical grey squares on ${bgOn ? 'dark and light backgrounds' : 'a neutral background'}"><title>Simultaneous lightness contrast</title><rect x="10" y="10" width="140" height="100" fill="${bgOn ? '#111827' : '#6b7280'}"/><rect x="170" y="10" width="140" height="100" fill="${bgOn ? '#e5e7eb' : '#6b7280'}"/><rect x="55" y="35" width="50" height="50" fill="#808080"/><rect x="215" y="35" width="50" height="50" fill="#808080"/></svg>`)); };
  drawCC();
  cards.append(card('Lightness & colour constancy', ccHost, 'The two inner squares are physically the same grey. The visual system judges surfaces relative to their surroundings, discounting the illumination. This usually keeps colours stable from sunlight to tube-light, but here it misleads.', btn('Toggle the backgrounds', () => { bgOn = !bgOn; drawCC(); }, 'ghost')));
  // Motion aftereffect
  const maeHost = h('div');
  const spiral = () => { let d = ''; for (let i = 0; i <= 360; i++) { const a = i / 18, r = 2 + i * 0.22; d += (i ? 'L' : 'M') + (80 + r * Math.cos(a)).toFixed(1) + ' ' + (80 + r * Math.sin(a)).toFixed(1); } return `<svg viewBox="0 0 160 160" width="160" height="160" role="img" aria-label="Spiral"><title>Spiral</title><path d="${d}" stroke="#E69F00" stroke-width="5" fill="none"/></svg>`; };
  const maeNote = h('p', { class: 'note', 'aria-live': 'polite' });
  const maeStatic = () => { maeHost.innerHTML = ''; maeHost.appendChild(svgEl(spiral())); };
  maeStatic();
  const maeRun = () => {
    if (reduced(api)) { maeNote.textContent = 'Photosafe / reduced-motion is on, so the spiral stays still. Static alternative: stare at a waterfall or a scrolling page for 30 s, then look at a still surface — it appears to drift the opposite way.'; return; }
    stopAnim();
    const el = maeHost.querySelector('svg');
    const t0 = performance.now();
    maeNote.textContent = 'Fixate the centre for 20 s… (smooth rotation, no flashing)';
    const step = (t) => {
      const s = (t - t0) / 1000;
      if (s >= 20) { el.style.transform = ''; maeNote.textContent = 'Stop! Keep looking at the still spiral (or a wall): it seems to rotate the other way. Direction-selective neurons adapted to the motion, so their opponents briefly win.'; anim = null; return; }
      el.style.transform = `rotate(${(s * 90) % 360}deg)`;
      anim = { raf: requestAnimationFrame(step) };
    };
    anim = { raf: requestAnimationFrame(step) };
  };
  cards.append(card('Motion aftereffect', maeHost, 'After prolonged viewing of motion in one direction, a stationary scene appears to move the opposite way.', h('div', null, h('div', { class: 'row' }, btn('Start 20-s adaptation', maeRun, 'primary'), btn('Stop', () => { stopAnim(); maeStatic(); maeNote.textContent = 'Stopped.'; }, 'ghost')), maeNote)));
  // Depth cues
  cards.append(card('Depth cues', svgEl(`<svg class="chart" viewBox="0 0 320 150" role="img" aria-label="Scene showing linear perspective, relative size, occlusion and texture gradient"><title>Monocular depth cues</title><polygon points="0,150 320,150 190,40 130,40" fill="#334155"/>${[0, 1, 2, 3, 4, 5].map((i) => { const y = 150 - i * i * 3.6; return `<line x1="${160 - (y - 40) * 1.45}" x2="${160 + (y - 40) * 1.45}" y1="${y}" y2="${y}" stroke="#64748b"/>`; }).join('')}<circle cx="80" cy="115" r="22" fill="#56B4E9"/><circle cx="175" cy="58" r="8" fill="#56B4E9"/><rect x="230" y="70" width="40" height="40" fill="#009E73"/><rect x="250" y="85" width="40" height="40" fill="#E69F00"/></svg>`),
    'Linear perspective (converging road), texture gradient (lines get denser), relative size (the far disc is smaller) and occlusion (orange covers green, so it is nearer) all signal depth from one eye.',
    btn('List all depth cues', () => api.modal({ title: 'Depth cues', body: api.table(['Cue', 'Type', 'How it works'], [['Binocular disparity', 'Binocular', 'Each eye sees a slightly different view; the difference grows for near objects'], ['Convergence', 'Binocular', 'Eyes turn inward more for near objects'], ['Linear perspective', 'Monocular', 'Parallel lines converge with distance'], ['Relative size', 'Monocular', 'Smaller image of a familiar object = farther'], ['Occlusion', 'Monocular', 'Nearer objects block farther ones'], ['Texture gradient', 'Monocular', 'Texture becomes finer with distance'], ['Shading', 'Monocular', 'Light-from-above assumption gives shape'], ['Motion parallax', 'Monocular (dynamic)', 'Near objects move faster across the view when you move']]) }), 'ghost')));
  body.appendChild(cards);
  body.appendChild(h('h3', null, 'Your illusion results'));
  body.appendChild(ownResults(api, ['muller_lyer', 'ponzo', 'ames']));
  body.appendChild(factBlock(api, ['F-WCAG']));
  body.appendChild(glossChips(api, ['Perception', 'Bottom-up processing', 'Top-down processing', 'Perceptual set', 'Optical illusion', 'Müller-Lyer illusion', 'Ponzo illusion', 'Ames room', 'Depth perception', 'Binocular disparity', 'Monocular cues', 'Perceptual constancy', 'Size constancy', 'Figure–ground', 'Gestalt principles']));
  body.appendChild(links(api, { paradigms: ['muller_lyer', 'ponzo', 'ames'], zone: 'explab', panels: ['sensation', 'attention'] }));
}

/* ------------------------------------------------------------------ 13. ATTENTION */

const ATT = [
  { id: 'stroop', name: 'Stroop', fact: 'F-STROOP', text: 'Name the ink colour of colour words. Reading is so automatic that an incongruent word slows colour naming: evidence that attention cannot fully switch off well-practised processes.' },
  { id: 'visual_search', name: 'Visual search', fact: 'F-TREISMAN', text: 'A target defined by one feature "pops out" regardless of the number of distractors; a conjunction target requires serial, attentive search, so RT rises with set size (feature-integration theory).' },
  { id: 'posner', name: 'Posner cueing', fact: 'F-POSNER', text: 'A cue directs attention to a location. Valid cues speed responses and invalid cues slow them, showing covert orienting without eye movements.' },
  { id: 'attn_blink', name: 'Attentional blink', fact: 'F-RAYMOND', text: 'In a rapid stream, a second target shortly after the first is often missed: attention is temporarily occupied consolidating the first.' },
  { id: 'dichotic', name: 'Dichotic listening', fact: 'F-CHERRY', text: 'Different messages go to each ear; shadowing one leaves little memory for the other, though salient information (your name) can break through.' },
  { id: 'inattentional_blindness', name: 'Inattentional blindness', fact: 'F-IB', text: 'People focused on a demanding task can fail to notice an unexpected, clearly visible object. A debrief follows because the task involves mild deception.' },
  { id: 'change_blindness', name: 'Change blindness', fact: null, text: 'Large changes go unnoticed when a brief blank or disruption masks the motion signal. A photosafe version replaces the flicker with a slow fade.' },
  { id: 'flanker', name: 'Flanker', fact: 'F-ERIKSEN', text: 'Irrelevant arrows next to a target slow responses when they point the other way: spatial attention has a limited "spotlight" width.' },
];

function renderAttention(body, api) {
  const { h, btn } = api;
  body.appendChild(h('h3', null, 'Attention: selecting what matters'));
  body.append(...paras(api, [
    '<b>Attention</b> is the selection of some information for further processing at the expense of other information. <b>Selective</b> attention filters, <b>divided</b> attention shares limited resources across tasks, and <b>sustained</b> attention keeps focus over time.',
    'Early models placed a <b>filter</b> before meaning is analysed; evidence that meaningful but unattended information sometimes gets through led to <b>attenuation</b> and <b>late-selection</b> theories, and to <b>load theory</b>: how much is processed depends on how demanding the main task is. <b>Feature-integration theory</b> says attention "glues" features into objects.',
    'Blindness to unexpected objects and to changes shows that we see far less than we think: attention, not the eye alone, determines conscious experience.',
  ]));
  body.appendChild(h('div', { class: 'grid2' }, ATT.map((a) => h('div', { class: 'card' }, h('h4', null, a.name), h('p', null, a.text), a.fact ? api.factLine(a.fact) : null,
    h('div', { class: 'row' }, btn('▶ Run ' + a.name, () => safeRun(api, a.id), 'primary'), a.id === 'inattentional_blindness' ? btn('Go to plaza', () => go(api, 'mohalla'), 'teal') : null)))));

  // Search slope simulator
  body.appendChild(h('h3', null, 'Search-slope simulator'));
  body.appendChild(h('p', null, 'Simulate a class doing feature and conjunction search. Choose the per-item cost for each search type; the simulator draws ex-Gaussian RTs for each participant and fits a line to RT versus set size. Slopes near zero indicate parallel "pop-out"; steep slopes indicate serial search.'));
  const ss = { feat: 2, conj: 25, n: 20, seed: 11 };
  const ssOut = h('div', { 'aria-live': 'polite' });
  const runSS = () => {
    const rng = new api.Rng(ss.seed++);
    const people = api.participants.cohort(rng, ss.n), sizes = [4, 8, 16, 24];
    const mean = (slope, k) => api.stats.mean(people.map((p) => { let t = 0; for (let i = 0; i < 10; i++) t += api.participants.drawRT(p, rng, { mu: 450, effect: slope * k }).rt; return t / 10; }));
    const F = sizes.map((k) => mean(ss.feat, k)), C = sizes.map((k) => mean(ss.conj, k));
    const fF = api.stats.regression(sizes, F), fC = api.stats.regression(sizes, C);
    ssOut.innerHTML = '';
    ssOut.append(api.simLabel(), api.charts.line([{ name: 'Feature search', points: sizes.map((x, i) => ({ x, y: F[i] })), dots: true }, { name: 'Conjunction search', points: sizes.map((x, i) => ({ x, y: C[i] })), dots: true }], { label: `Mean RT by set size, ${ss.n} simulated participants`, xl: 'set size', yl: 'RT (ms)' }),
      api.table(['Search type', 'Fitted slope (ms/item)', 'Intercept (ms)', 'R²'], [['Feature', fmt(fF.b, 1), fmt(fF.a, 0), fmt(fF.r2, 3)], ['Conjunction', fmt(fC.b, 1), fmt(fC.a, 0), fmt(fC.r2, 3)]]),
      h('p', { class: 'note' }, 'Simulated effect sizes: the slopes are whatever you set, plus noise. Run the real paradigm to measure your own.'));
    api.emit('stats:test', { test: 'regression' });
  };
  body.append(api.slider('Feature search cost (ms/item)', { min: 0, max: 15, step: 1, value: ss.feat, onInput: (v) => { ss.feat = v; } }),
    api.slider('Conjunction search cost (ms/item)', { min: 5, max: 60, step: 1, value: ss.conj, onInput: (v) => { ss.conj = v; } }),
    api.slider('Simulated participants', { min: 5, max: 60, step: 1, value: ss.n, onInput: (v) => { ss.n = v; } }),
    btn('Simulate search study', runSS, 'primary'), ssOut);
  runSS();

  body.appendChild(h('h3', null, 'Your attention results'));
  body.appendChild(ownResults(api, ['stroop', 'visual_search', 'posner', 'attn_blink', 'dichotic', 'inattentional_blindness', 'change_blindness', 'flanker', 'go_nogo']));
  body.appendChild(factBlock(api, ['F-TIME']));
  body.appendChild(glossChips(api, ['Attention', 'Selective attention', 'Divided attention', 'Filter model', 'Attenuation theory', 'Late-selection theory', 'Load theory', 'Feature integration theory', 'Inattentional blindness', 'Change blindness', 'Attentional blink', 'Posner cueing task', 'Stroop effect', 'Dichotic listening', 'Automaticity']));
  body.appendChild(links(api, { paradigms: ['stroop', 'visual_search', 'go_nogo'], zone: 'explab', panels: ['illusions', 'stats'] }));
}

module.exports = [
  { id: 'bio', render: renderBio },
  { id: 'brain', render: renderBrain },
  { id: 'sleep', render: renderSleep },
  { id: 'sensation', render: renderSensation },
  { id: 'sdt', render: renderSDT },
  { id: 'illusions', render: renderIllusions, onClose: stopAnim },
  { id: 'attention', render: renderAttention },
];
module.exports.helpers = { simulateNight, sdtRates, eegWave, stevensPresets };
