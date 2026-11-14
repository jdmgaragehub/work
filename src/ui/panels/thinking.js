'use strict';
/**
 * Thinking rail (A6b): Learning Lab, Memory Lab, Eyewitness Room, Cognition & Language, Intelligence & Testing.
 * Contract: docs/PANEL_API.md. All teaching text and examples are original. Study numbers appear only via
 * api.factLine(id). Every generated dataset is labelled (api.simLabel). No network, no external assets.
 */

// ------------------------------------------------------------------ shared helpers
const ZONE_NAMES = { learning: 'Learning Lab', library: 'Methods & Stats Library', wundt: 'Wundt Hall', explab: 'Experimental Lab Wing', mohalla: 'Mohalla street', clinic: 'Clinic', childdev: 'Child Development Suite', courtyard: 'Courtyard', neuro: 'Neuro Atrium', sleep: 'Sleep Lab' };

function kit(api) {
  const { h, btn } = api;
  const P = (html) => h('p', { html });
  const H3 = (t) => h('h3', null, t);
  const H4 = (t) => h('h4', null, t);
  const note = (html) => h('p', { class: 'note', html });
  const out = (txt) => h('div', { class: 'stat-out', role: 'status', 'aria-live': 'polite' }, txt || '');
  const card = (title, ...kids) => h('div', { class: 'card' }, title ? H4(title) : null, ...kids);
  const row = (...kids) => h('div', { class: 'row' }, ...kids);
  const paradigmTitle = (id) => { try { const p = api.paradigm(id); return p ? p.title : id.replace(/_/g, ' '); } catch (e) { return id.replace(/_/g, ' '); } };
  function runP(id, after) {
    if (!api.service('runner')) { api.toast('The experiment runner is not loaded in this view (paradigm: ' + id + ').'); return; }
    let known = true;
    try { known = !(api.sim.registry && api.sim.registry.paradigms) || !!api.paradigm(id); } catch (e) { known = true; }
    if (!known) { api.toast('Paradigm "' + id + '" is not installed in this build yet.'); return; }
    Promise.resolve().then(() => api.runParadigm(id)).then(() => { if (after) after(); }, (err) => api.toast('Could not start ' + id + ': ' + (err && err.message)));
  }
  const run = (id, label) => btn(label || '▶ Run ' + paradigmTitle(id), () => runP(id), 'primary');
  function goZ(z) {
    if (!api.service('world')) { api.toast('3D campus not loaded — destination: ' + (ZONE_NAMES[z] || z)); return; }
    api.goZone(z); api.toast('Heading to ' + (ZONE_NAMES[z] || z));
  }
  const zone = (z, label) => btn(label || 'Go to ' + (ZONE_NAMES[z] || z), () => goZ(z), 'teal');
  const panel = (id, label) => btn(label, () => api.openPanel(id), 'ghost');
  function gloss(...terms) {
    const outEl = note('');
    const r = row(h('span', { class: 'note' }, 'Glossary:'), ...terms.map((t) => btn(t, () => {
      const g = api.glossary(t);
      api.emit('glossary:lookup', { term: t });
      outEl.innerHTML = g ? `<b>${api.esc(g.term)}</b> — ${api.esc(g.def)}${g.ur ? ` <span lang="ur" dir="rtl">(${api.esc(g.ur)})</span>` : ''}` : `“${api.esc(t)}” is not in the glossary yet.`;
    }, 'ghost')));
    return h('div', null, r, outEl);
  }
  const facts = (...ids) => h('div', { class: 'facts' }, ids.map((id) => api.factLine(id)));
  const rows = (pid) => (api.sim.datasets[pid] || []).filter((r) => r.block !== 'practice');
  const isNum = (v) => v !== '' && v != null && Number.isFinite(+v);
  /** Generic own-results card: accuracy and mean RT per condition, from the player's own runs. */
  function ownResults(pid, { chart = true } = {}) {
    const box = h('div', { class: 'card' });
    const draw = () => {
      box.innerHTML = '';
      const rs = rows(pid);
      box.appendChild(H4('Your own results — ' + paradigmTitle(pid)));
      if (!rs.length) { box.appendChild(note('No runs yet. Run the paradigm and your own trial data (stored only in this browser) will be summarised here.')); box.appendChild(row(btn('▶ Run now', () => runP(pid, draw), 'primary'))); return; }
      const groups = {};
      for (const r of rs) (groups[r.condition || 'all'] = groups[r.condition || 'all'] || []).push(r);
      const tab = [];
      const bars = [];
      for (const [c, g] of Object.entries(groups)) {
        const sc = g.filter((r) => r.correct !== '' && r.correct != null);
        const acc = sc.length ? 100 * sc.filter((r) => String(r.correct) === '1').length / sc.length : NaN;
        const rts = g.map((r) => r.rt_ms).filter(isNum).map(Number);
        const mrt = rts.length ? api.stats.mean(rts) : NaN;
        tab.push([api.esc(c), g.length, Number.isFinite(acc) ? acc.toFixed(0) + '%' : '—', Number.isFinite(mrt) ? mrt.toFixed(0) + ' ms' : '—']);
        bars.push({ name: c.slice(0, 12), value: Number.isFinite(acc) ? +acc.toFixed(1) : Number.isFinite(mrt) ? +mrt.toFixed(0) : 0, metric: Number.isFinite(acc) ? 'acc' : 'rt' });
      }
      box.appendChild(row(h('span', { class: 'tag' }, 'Your own data'), h('span', { class: 'note' }, rs.length + ' trials, practice excluded')));
      box.appendChild(api.table(['Condition', 'Trials', '% correct', 'Mean RT'], tab));
      if (chart && bars.length) box.appendChild(api.charts.bar(bars, { label: `${paradigmTitle(pid)} — your results by condition`, yl: bars[0].metric === 'acc' ? '% correct' : 'mean RT (ms)' }));
      box.appendChild(row(btn('▶ Run again', () => runP(pid, draw)), btn('Open data export', () => api.openPanel('export'), 'ghost')));
    };
    draw();
    return box;
  }
  return { h, btn, P, H3, H4, note, out, card, row, run, runP, zone, goZ, panel, gloss, facts, rows, isNum, ownResults, paradigmTitle };
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
let seedCounter = 1;
const newRng = (api, tag) => new api.Rng('zehn-thinking-' + tag + '-' + (seedCounter++));

// ================================================================== 14 LEARNING
const learning = {
  id: 'learning',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Learning is a relatively lasting change in behaviour or knowledge that comes from experience. Two families of procedures dominate the laboratory. In <b>classical (Pavlovian) conditioning</b> the experimenter pairs a neutral cue with a biologically important event, and the cue comes to <i>elicit</i> an anticipatory response. In <b>operant (instrumental) conditioning</b> the consequences of a freely <i>emitted</i> action change how often that action happens again.'));
    body.appendChild(P('Modern accounts treat both as prediction learning: animals and people learn about events that are surprising, and stop learning once outcomes are predicted. That idea is captured by the Rescorla–Wagner model below and links learning to dopamine prediction-error signals studied in the Neuro Atrium.'));
    body.appendChild(api.table(['', 'Classical conditioning', 'Operant conditioning'], [
      ['What is paired', 'Stimulus with stimulus (CS → US)', 'Behaviour with consequence (R → outcome)'],
      ['Response', 'Elicited, often reflexive or emotional', 'Emitted, goal-directed'],
      ['Key terms', 'US, UR, CS, CR, acquisition, extinction, generalisation, discrimination', 'Reinforcement and punishment (positive = add, negative = remove), schedules, shaping'],
      ['Everyday example', 'The sound of the pressure-cooker whistle starts your stomach rumbling before lunch is served', 'A shopkeeper who gets a smile and repeat customers after rounding prices down keeps doing it'],
    ]));
    body.appendChild(K.gloss('Rescorla–Wagner model', 'Blocking', 'Classical conditioning', 'Operant conditioning', 'Shaping', 'Extinction'));

    // ---- Rescorla–Wagner
    body.appendChild(H3('Rescorla–Wagner model (interactive)'));
    body.appendChild(K.facts('F-RW'));
    body.appendChild(P('On every trial each present cue changes its associative strength <i>V</i> in proportion to the <b>prediction error</b>: the difference between what happened (λ if the US arrives, 0 if not) and what all present cues together predicted (Σ<i>V</i>). α is the salience of the cue, β the learning rate set by the US. Because the error is shared, a cue that is already a perfect predictor leaves nothing for a new cue to learn — that is <b>blocking</b>.'));
    const rw = { alpha: 0.3, beta: 0.4, lambda: 1, n: 20, demo: 'acqext' };
    const rwChart = h('div');
    const rwOut = out();
    const drawRW = () => {
      const L = api.learning;
      const trials = [];
      let series = [];
      let msg = '';
      if (rw.demo === 'acqext') {
        for (let i = 0; i < rw.n; i++) trials.push({ cues: ['CS'], us: true });
        for (let i = 0; i < rw.n; i++) trials.push({ cues: ['CS'], us: false });
        const r = L.rescorlaWagner(trials, { alpha: { CS: rw.alpha }, beta: rw.beta, lambda: rw.lambda });
        series = [{ name: 'V(CS)', points: r.history.map((x, i) => ({ x: i + 1, y: x.CS })), dots: false },
          { name: 'prediction error', points: r.history.map((x, i) => ({ x: i + 1, y: x.predictionError })), dash: true }];
        msg = `Acquisition trials 1–${rw.n} (CS→US), extinction trials ${rw.n + 1}–${2 * rw.n} (CS alone).\nV after acquisition = ${r.history[rw.n - 1].CS.toFixed(3)} (asymptote λ = ${rw.lambda}); V after extinction = ${r.V.CS.toFixed(3)}.\nNote: basic R–W treats extinction as unlearning, so it cannot explain spontaneous recovery or renewal.`;
      } else if (rw.demo === 'blocking') {
        for (let i = 0; i < rw.n; i++) trials.push({ cues: ['A'], us: true });
        for (let i = 0; i < rw.n; i++) trials.push({ cues: ['A', 'X'], us: true });
        const r = L.rescorlaWagner(trials, { beta: rw.beta, lambda: rw.lambda, defaultAlpha: rw.alpha });
        const ctrl = [];
        for (let i = 0; i < rw.n; i++) ctrl.push({ cues: ['B'], us: false });
        for (let i = 0; i < rw.n; i++) ctrl.push({ cues: ['B', 'X'], us: true });
        const c = L.rescorlaWagner(ctrl, { beta: rw.beta, lambda: rw.lambda, defaultAlpha: rw.alpha });
        series = [{ name: 'V(A) pre-trained', points: r.history.map((x, i) => ({ x: i + 1, y: x.A || 0 })) },
          { name: 'V(X) blocked', points: r.history.map((x, i) => ({ x: i + 1, y: x.X || 0 })) },
          { name: 'V(X) control', points: c.history.map((x, i) => ({ x: i + 1, y: x.X || 0 })), dash: true }];
        msg = `Phase 1: A→US. Phase 2: AX→US. Control group gets no A pre-training.\nFinal V(X): blocked group ${(r.V.X || 0).toFixed(3)} vs control ${(c.V.X || 0).toFixed(3)}.\nX is redundant when A already predicts the US, so it gains little strength.`;
      } else {
        for (let i = 0; i < 2 * rw.n; i++) trials.push({ cues: ['Loud', 'Faint'], us: true });
        const r = L.rescorlaWagner(trials, { alpha: { Loud: rw.alpha, Faint: rw.alpha / 4 }, beta: rw.beta, lambda: rw.lambda });
        series = [{ name: 'V(salient cue)', points: r.history.map((x, i) => ({ x: i + 1, y: x.Loud })) },
          { name: 'V(faint cue)', points: r.history.map((x, i) => ({ x: i + 1, y: x.Faint })) }];
        msg = `Overshadowing: two cues always presented together; the faint cue has one quarter of the salience.\nFinal V: salient ${r.V.Loud.toFixed(3)}, faint ${r.V.Faint.toFixed(3)}; together they share λ = ${rw.lambda}.`;
      }
      rwChart.innerHTML = '';
      rwChart.appendChild(api.charts.line(series, { label: 'Rescorla–Wagner associative strength by trial (model output)', xl: 'trial', yl: 'associative strength V' }));
      rwChart.appendChild(api.simLabel('Model simulation — not participant data'));
      rwOut.textContent = msg;
    };
    body.appendChild(card(null,
      row(api.select('Demonstration', [{ value: 'acqext', label: 'Acquisition → extinction' }, { value: 'blocking', label: 'Blocking (Kamin design)' }, { value: 'overshadow', label: 'Overshadowing' }], rw.demo, (v) => { rw.demo = v; drawRW(); })),
      h('div', { class: 'grid2' },
        api.slider('α (cue salience)', { min: 0.05, max: 1, step: 0.05, value: rw.alpha, onInput: (v) => { rw.alpha = v; drawRW(); } }),
        api.slider('β (US learning rate)', { min: 0.05, max: 1, step: 0.05, value: rw.beta, onInput: (v) => { rw.beta = v; drawRW(); } }),
        api.slider('λ (asymptote)', { min: 0.2, max: 1, step: 0.05, value: rw.lambda, onInput: (v) => { rw.lambda = v; drawRW(); } }),
        api.slider('Trials per phase', { min: 5, max: 40, step: 1, value: rw.n, onInput: (v) => { rw.n = v; drawRW(); } })),
      rwChart, rwOut,
      row(btn('Log this model run', () => { api.emit('study:run', { paradigm: 'classical_cond', n: 1 }); api.toast('Model run logged — try predicting the curve before you move a slider.'); }, 'ghost'), K.run('classical_cond'))));
    drawRW();

    // ---- schedules
    body.appendChild(H3('Schedules of reinforcement and cumulative records'));
    body.appendChild(P('A <b>schedule</b> is the rule that decides which responses earn reinforcement. <b>Ratio</b> schedules count responses (fixed FR or variable VR); <b>interval</b> schedules require time to pass before the next response pays (fixed FI or variable VI). A <b>cumulative record</b> plots the running total of responses against time, so the slope is the response rate and small tick marks show reinforcers. Teaching patterns to look for: steep, steady lines for VR; pause-then-run steps after each FR reinforcer; a “scallop” before each FI reinforcer; moderate, steady responding for VI.'));
    const sch = { type: 'FR', param: 10 };
    const schChart = h('div');
    const schOut = out();
    const drawSched = (user) => {
      const res = api.learning.simulateSchedule(sch.type, sch.param, newRng(api, 'sched'), { seconds: 300 });
      schChart.innerHTML = '';
      schChart.appendChild(api.charts.cumulative(res.record, res.reinforcers, { label: `Cumulative record — simulated agent on ${sch.type} ${sch.param}` }));
      schChart.appendChild(api.simLabel('Simulated agent'));
      schOut.textContent = `${sch.type} ${sch.param}${sch.type.endsWith('I') ? ' s' : ' responses'}: ${res.totalResponses} responses, ${res.reinforcers.length} reinforcers in 300 s; mean rate ${res.rate.toFixed(2)} responses/s.\nThe agent is a qualitative teaching model, not a real animal.`;
      if (user) api.emit('study:run', { paradigm: 'operant_schedules', n: 1 });
    };
    const cmpBox = h('div');
    const compareAll = () => {
      const rng = newRng(api, 'cmp');
      const bars = ['FR', 'VR', 'FI', 'VI'].map((t) => ({ name: t + ' ' + sch.param, value: +api.learning.simulateSchedule(t, sch.param, rng, { seconds: 300 }).rate.toFixed(2) }));
      cmpBox.innerHTML = '';
      cmpBox.appendChild(api.charts.bar(bars, { label: 'Response rate by schedule — simulated agent', yl: 'responses per second' }));
      cmpBox.appendChild(api.simLabel('Simulated agent'));
      api.emit('study:run', { paradigm: 'operant_schedules', n: 4 });
    };
    body.appendChild(card(null,
      row(api.select('Schedule', ['FR', 'VR', 'FI', 'VI'], sch.type, (v) => { sch.type = v; drawSched(true); }),
        api.slider('Parameter (responses for ratio, seconds for interval)', { min: 2, max: 40, step: 1, value: sch.param, onInput: (v) => { sch.param = v; } })),
      row(btn('Simulate agent', () => drawSched(true), 'primary'), btn('Compare all four schedules', compareAll), K.run('operant_schedules')),
      schChart, schOut, cmpBox));
    drawSched(false);

    // ---- shaping
    body.appendChild(H3('Shaping by successive approximation'));
    body.appendChild(P('Some behaviours never occur spontaneously, so they cannot be reinforced. In <b>shaping</b> the trainer reinforces any response that is a little closer to the target, then gradually raises the criterion. Raise it too fast and reinforcement stops (the behaviour extinguishes); raise it too slowly and training wastes time. The simulated learner below emits a behaviour value with some spread; responses at or above the criterion are reinforced and pull its typical behaviour upward.'));
    const sh = { state: { mean: 0, spread: 0.6 }, criterion: 0.3, hist: [], rng: newRng(api, 'shape') };
    const shChart = h('div');
    const shOut = out();
    const drawShape = () => {
      shChart.innerHTML = '';
      if (!sh.hist.length) { shChart.appendChild(note('Press “Run 20 trials” to start shaping.')); return; }
      shChart.appendChild(api.charts.line([
        { name: 'behaviour emitted', points: sh.hist.map((x, i) => ({ x: i + 1, y: x.behaviour })), dots: true },
        { name: 'criterion', points: sh.hist.map((x, i) => ({ x: i + 1, y: x.criterion })), dash: true },
        { name: 'typical behaviour', points: sh.hist.map((x, i) => ({ x: i + 1, y: x.mean })) }], { label: 'Shaping — simulated learner', xl: 'trial', yl: 'behaviour (arbitrary units)' }));
      shChart.appendChild(api.simLabel('Simulated learner'));
      const last = sh.hist.slice(-20);
      shOut.textContent = `Reinforced in last ${last.length} trials: ${last.filter((x) => x.reinforced).length}. Typical behaviour now ${sh.state.mean.toFixed(2)}; criterion ${sh.criterion.toFixed(2)}.`;
    };
    const step20 = () => { for (let i = 0; i < 20; i++) { const r = api.learning.shapingStep(sh.state, sh.criterion, sh.rng); sh.hist.push({ behaviour: r.behaviour, reinforced: r.reinforced, criterion: sh.criterion, mean: sh.state.mean }); } drawShape(); api.emit('study:run', { paradigm: 'shaping', n: 1 }); };
    body.appendChild(card(null,
      row(btn('Run 20 trials', step20, 'primary'), btn('Raise criterion +0.25', () => { sh.criterion += 0.25; api.toast('Criterion raised to ' + sh.criterion.toFixed(2)); drawShape(); }), btn('Raise criterion +1 (too fast?)', () => { sh.criterion += 1; api.toast('Big jump: watch reinforcement dry up'); drawShape(); }, 'ghost'),
        btn('Reset learner', () => { sh.state = { mean: 0, spread: 0.6 }; sh.criterion = 0.3; sh.hist = []; drawShape(); shOut.textContent = 'Learner reset.'; }, 'ghost'), K.run('shaping')),
      shChart, shOut));
    drawShape();

    body.appendChild(H3('Ethics and history'));
    body.appendChild(P('Early fear-conditioning work with an infant is now taught mainly as an ethics case: no informed consent from an independent guardian, no attempt at extinction before the child left, and later confusion about who the child was.'));
    body.appendChild(K.facts('F-LITTLEALBERT'));
    body.appendChild(K.facts('F-BOBO'));
    body.appendChild(H3('Your own runs'));
    body.appendChild(K.ownResults('classical_cond'));
    body.appendChild(K.ownResults('operant_schedules'));
    body.appendChild(row(K.zone('learning'), K.panel('cases', 'Case studies (Little Albert, Bobo doll)'), K.panel('brain', 'Brain & Cases'), K.panel('builder', 'Design a variant in the Builder')));
  },
};

// ================================================================== 15 MEMORY
const memory = {
  id: 'memory',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Memory is not one store but a set of systems that <b>encode</b>, <b>store</b> and <b>retrieve</b> information. Three influential frameworks frame this lab:'));
    body.appendChild(api.table(['Model', 'Core idea', 'What it explains well', 'Main criticism'], [
      ['Multi-store (Atkinson & Shiffrin)', 'Information flows from sensory registers to a short-term store and, through rehearsal, to a long-term store', 'Separate primacy and recency effects; amnesic patients with intact short-term span', 'Too linear; rehearsal alone does not guarantee learning; short-term memory is not a single box'],
      ['Working memory (Baddeley & Hitch)', 'A limited workspace: central executive controlling a phonological loop, a visuospatial sketchpad and an episodic buffer', 'Dual-task interference, word-length and articulatory-suppression effects', 'The central executive is hard to specify and test'],
      ['Levels of processing (Craik & Lockhart)', 'Deeper, meaning-based encoding leaves a more durable trace than shallow (visual or sound) encoding', 'Why “what does it mean?” beats “is it in capitals?”', 'Depth is hard to measure independently of the memory it predicts (circularity)'],
    ]));
    body.appendChild(K.facts('F-CRAIK', 'F-MILLER56', 'F-COW'));
    body.appendChild(K.gloss('Encoding', 'Encoding specificity principle', 'Working memory', 'Chunking', 'Serial position effect', 'False memory'));

    // ---- chunking
    body.appendChild(H3('Chunking tool'));
    body.appendChild(P('Capacity limits are counted in <b>chunks</b>, not raw items. Letters that form a familiar unit — an acronym you already know — collapse into one chunk. Type a letter string and see how known units shrink the load.'));
    const KNOWN = ['NADRA', 'WAPDA', 'CNIC', 'HEC', 'PTV', 'PSL', 'APA', 'PIA', 'BBC', 'DNA', 'IQ', 'GPA', 'SMS', 'ATM', 'UN', 'PDF', 'USB', 'LUMS', 'FAST', 'WHO', 'REM', 'EEG', 'MRI'];
    const chOut = out();
    const chIn = h('input', { type: 'text', value: 'PSLHECPTVAPACNIC', 'aria-label': 'Letter string to chunk', maxlength: 40 });
    const chunk = () => {
      const s = chIn.value.toUpperCase().replace(/[^A-Z]/g, '');
      const parts = [];
      let i = 0;
      while (i < s.length) {
        const k = KNOWN.filter((w) => s.startsWith(w, i)).sort((a, b) => b.length - a.length)[0];
        if (k) { parts.push(k); i += k.length; } else { parts.push(s[i]); i++; }
      }
      chOut.textContent = `${s.length} letters → ${parts.length} chunks: ${parts.join(' · ')}\n${parts.length <= 5 ? 'Within a comfortable working-memory load.' : 'Probably above a comfortable load — look for more familiar units.'} (Known units are a small built-in list.)`;
    };
    body.appendChild(card(null, row(h('label', { class: 'f' }, 'Letters', chIn), btn('Chunk it', chunk, 'primary')), chOut));
    chunk();

    // ---- serial position model
    body.appendChild(H3('Serial-position curve: an illustrative two-store model'));
    body.appendChild(P('In free recall, the first items (<b>primacy</b>) and last items (<b>recency</b>) are recalled best. A classic two-store reading: early items get extra rehearsal and reach long-term memory; the last items are still in short-term memory at test. A filled delay (for example counting backwards) removes recency but leaves primacy — a dissociation that supports separate mechanisms.'));
    body.appendChild(K.facts('F-GLANZER'));
    const sp = { L: 12, reh: 0.6, delay: 0 };
    const spChart = h('div');
    const drawSP = () => {
      const pct = [];
      for (let i = 1; i <= sp.L; i++) {
        const ltm = 0.18 + sp.reh * 0.5 * Math.exp(-(i - 1) / 2.2);
        const stm = Math.exp(-(sp.L - i) / 2.3) * Math.exp(-sp.delay / 7);
        pct.push(+(100 * clamp(ltm + (1 - ltm) * stm, 0, 1)).toFixed(1));
      }
      spChart.innerHTML = '';
      spChart.appendChild(api.charts.serialPosition(pct, { label: `Illustrative two-store model: list of ${sp.L}, filled delay ${sp.delay} s` }));
      spChart.appendChild(api.simLabel('Illustrative model — not data'));
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('List length', { min: 6, max: 20, step: 1, value: sp.L, onInput: (v) => { sp.L = v; drawSP(); } }),
      api.slider('Rehearsal of early items', { min: 0, max: 1, step: 0.05, value: sp.reh, onInput: (v) => { sp.reh = v; drawSP(); } }),
      api.slider('Filled delay before recall (s)', { min: 0, max: 30, step: 1, value: sp.delay, onInput: (v) => { sp.delay = v; drawSP(); } })),
    spChart, row(K.run('serial_position'))));
    drawSP();

    body.appendChild(H3('Brown–Peterson: forgetting over seconds'));
    body.appendChild(P('Participants see a short consonant trigram, then count backwards to block rehearsal, then recall. Recall falls quickly over a few seconds. Early accounts blamed <b>decay</b>; later work showed that the first trial is recalled well and performance worsens over trials, pointing to <b>proactive interference</b> from earlier items.'));
    body.appendChild(K.facts('F-BP', 'F-BP-RATES'));
    body.appendChild(row(K.run('brown_peterson'), K.run('levels_processing')));

    // ---- DRM demo
    body.appendChild(H3('False memory: a mini DRM demo (original list)'));
    body.appendChild(P('In the DRM paradigm people study lists of words that are all associates of one word that is never shown — the <b>critical lure</b>. Many later “remember” the lure, often with confidence. Try a short original list.'));
    body.appendChild(K.facts('F-DRM', 'F-DRM-RATE'));
    const STUDY = ['kettle', 'milk', 'sugar', 'cup', 'leaves', 'steam', 'biscuit', 'dhaba', 'pour', 'morning', 'kahwa', 'mug'];
    const TEST = [['milk', 'old'], ['bicycle', 'new'], ['chai', 'lure'], ['steam', 'old'], ['river', 'new'], ['cup', 'old'], ['pencil', 'new'], ['kettle', 'old']];
    const drmBox = h('div');
    const drmOut = out();
    const drmStudy = () => {
      drmBox.innerHTML = '';
      drmOut.textContent = '';
      drmBox.appendChild(h('p', { style: { fontSize: '1.2em', letterSpacing: '0.04em' } }, STUDY.join(' · ')));
      drmBox.appendChild(note('Read the list once, slowly. Then press “Hide and test”.'));
    };
    const drmTest = () => {
      drmBox.innerHTML = '';
      const boxes = TEST.map(([w]) => h('input', { type: 'checkbox', 'aria-label': 'I studied ' + w }));
      drmBox.appendChild(note('Tick every word you saw in the list.'));
      drmBox.appendChild(h('div', { class: 'row' }, TEST.map(([w], i) => h('label', { class: 'pill' }, boxes[i], ' ' + w))));
      drmBox.appendChild(btn('Score my memory', () => {
        let hits = 0, fa = 0; let lure = false;
        TEST.forEach(([, kind], i) => { if (boxes[i].checked) { if (kind === 'old') hits++; else if (kind === 'lure') lure = true; else fa++; } });
        drmOut.textContent = `Studied words recognised: ${hits}/4. Unrelated new words ticked: ${fa}/3. Critical lure “chai”: ${lure ? 'ticked — a false memory! It was never shown.' : 'not ticked — well resisted.'}\nWhy it happens: studying associates activates the lure’s meaning (gist), and at test the feeling of familiarity is misattributed to the list (a source-monitoring error).`;
        api.emit('glossary:lookup', { term: 'False memory' });
      }, 'primary'));
    };
    body.appendChild(card(null, row(btn('Show study list', drmStudy, 'primary'), btn('Hide and test', drmTest), K.run('drm')), drmBox, drmOut));

    body.appendChild(H3('Working memory under load: n-back'));
    body.appendChild(P('In an <b>n-back</b> task you respond when the current item matches the one <i>n</i> steps back. Raising <i>n</i> loads updating and maintenance in working memory: accuracy drops and responses slow. It is a good test of the central executive but a poor “brain-training” tool — gains on n-back rarely transfer to unrelated abilities.'));
    body.appendChild(row(K.run('nback')));
    body.appendChild(H3('Method of loci (memory palace)'));
    body.appendChild(P('Place vivid images of the items along a familiar route — your home, a walk through the Courtyard — and later “walk” the route to retrieve them. The method works because it combines imagery, spatial memory and a built-in retrieval plan. In ZEHN you can build your palace inside Wundt Hall.'));
    body.appendChild(row(K.run('memory_palace'), K.zone('wundt')));
    body.appendChild(H3('Forgetting and amnesia'));
    body.appendChild(K.facts('F-EBB', 'F-EBB-REP', 'F-HM'));

    body.appendChild(H3('Your own results'));
    // Serial-position special case: plot recall by position when rows carry it.
    const spRows = K.rows('serial_position');
    const posOf = (r) => { if (K.isNum(r.position)) return +r.position; if (K.isNum(r.serial_pos)) return +r.serial_pos; const m = /pos(?:ition)?\s*[=:_]?\s*(\d+)/i.exec(String(r.stimulus) + ' ' + String(r.condition)); return m ? +m[1] : null; };
    const withPos = spRows.filter((r) => posOf(r) != null && r.correct !== '');
    if (withPos.length) {
      const maxP = Math.max(...withPos.map(posOf));
      const pct = [];
      for (let p = 1; p <= maxP; p++) { const g = withPos.filter((r) => posOf(r) === p); pct.push(g.length ? 100 * g.filter((r) => String(r.correct) === '1').length / g.length : 0); }
      body.appendChild(card('Your serial-position curve', api.charts.serialPosition(pct, { label: 'Your serial-position curve (own data)' }), h('span', { class: 'tag' }, 'Your own data')));
    }
    for (const pid of ['serial_position', 'brown_peterson', 'levels_processing', 'drm', 'nback', 'memory_palace']) body.appendChild(K.ownResults(pid));
    body.appendChild(row(K.zone('library'), K.panel('eyewitness', 'Eyewitness Room'), K.panel('cases', 'Case: H.M. and memory systems'), K.panel('stats', 'Analyse in the Workbench')));
  },
};

// ================================================================== 16 EYEWITNESS
// Pool of procedural faces for the lineup tool (male-presenting to match the description).
const POOL = [
  { beard: true, glasses: true, skin: 3, hair: 0 }, // suspect
  { beard: false, glasses: false, skin: 5, hair: 3 }, { beard: false, glasses: false, skin: 0, hair: 1 }, { beard: false, glasses: true, skin: 6, hair: 4 },
  { beard: false, glasses: false, skin: 4, hair: 2 }, { beard: false, glasses: false, skin: 7, hair: 0 }, { beard: true, glasses: true, skin: 2, hair: 0 },
  { beard: true, glasses: true, skin: 3, hair: 1 }, { beard: true, glasses: false, skin: 4, hair: 0 }, { beard: true, glasses: true, skin: 2, hair: 2 },
  { beard: false, glasses: true, skin: 3, hair: 0 }, { beard: true, glasses: true, skin: 4, hair: 1 }, { beard: true, glasses: false, skin: 1, hair: 3 },
];
const SHIRTS = ['#0F766E', '#1E1B4B', '#9F1239', '#b45309', '#334155', '#4d7c0f'];

const eyewitness = {
  id: 'eyewitness',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Eyewitness memory is <b>reconstructive</b>: each act of remembering rebuilds the event from fragments plus expectations, and information met after the event can be blended in. Questions, conversations with other witnesses and news reports are all chances for this <b>misinformation effect</b>.'));
    body.appendChild(P('Researchers divide influences into <b>estimator variables</b> (lighting, distance, stress, weapon focus, cross-race effect — the justice system cannot change them, only estimate their impact) and <b>system variables</b> (how questions are asked and how lineups are built and run — these can be reformed). Most practical advice targets system variables.'));
    body.appendChild(K.facts('F-LP'));
    body.appendChild(K.gloss('Misinformation effect', 'Reconstructive memory', 'Source monitoring', 'Lineup'));

    // ---- leading question checker
    body.appendChild(H3('Leading-question checker'));
    body.appendChild(P('Type a question you might ask a witness. The checker flags features that can plant information: emotionally loaded verbs, presupposing “the” for things not yet mentioned, tag questions that suggest the answer, and forced choices.'));
    const qIn = h('textarea', { rows: 2, 'aria-label': 'Question to a witness', style: { width: '100%' } }, 'How fast was the rickshaw going when it smashed into the car? Did you see the broken glass, didn\'t you?');
    const qOut = out();
    const checkQ = () => {
      const q = qIn.value;
      const flags = [];
      const loaded = q.match(/\b(smash\w*|crash\w*|slam\w*|ram\w*|attack\w*|speed\w*|violent\w*|thug|criminal|culprit)\b/gi);
      if (loaded) flags.push('Loaded wording: “' + [...new Set(loaded.map((w) => w.toLowerCase()))].join('”, “') + '”. Use neutral verbs such as “hit” or “made contact”, or ask the witness to describe it in their own words.');
      const pre = q.match(/\bthe (broken|knife|gun|weapon|blood|glass|scar|tattoo|car|bag)\b/gi);
      if (pre) flags.push('Presupposition: “' + pre.join('”, “') + '” assumes the thing existed. Prefer “Did you see any …?”');
      if (/,\s*(didn't|didn’t|wasn't|wasn’t|isn't|isn’t|weren't|weren’t|did|was) (you|he|she|it|they)\s*\?/i.test(q)) flags.push('Tag question (“…, didn’t you?”) signals the expected answer.');
      if (/\bor\b/i.test(q) && /\?/.test(q)) flags.push('Possible forced choice (“A or B?”) — the true answer may be neither.');
      if (/^\s*(how fast|how many|what colou?r)/i.test(q) && !flags.length) flags.push('Specific estimate request — acceptable, but follow free recall first.');
      qOut.textContent = flags.length ? flags.map((f, i) => `${i + 1}. ${f}`).join('\n') : 'No leading features detected. Best practice: begin with open free recall (“Tell me everything you remember”), then ask neutral follow-ups.';
    };
    body.appendChild(card(null, qIn, row(btn('Check my question', checkQ, 'primary'), K.run('misinformation'))), qOut);
    checkQ();

    // ---- lineup fairness tool
    body.appendChild(H3('Lineup fairness tool (mock-witness method)'));
    body.appendChild(P('A lineup is only a fair test of memory if the suspect does not stand out. A practical check is the <b>mock-witness</b> method: people who never saw the crime receive only the witness’s verbal description and are asked to pick the person who fits it best. If the lineup is fair, their picks spread across all members; if the suspect is the only one matching the description, mock witnesses find him easily — and so might a real witness who is guessing.'));
    body.appendChild(P('Two summary numbers: <b>functional size</b> = number of mock witnesses ÷ number who chose the suspect (in a perfectly fair six-person lineup it approaches six); <b>effective size</b> = 1 ÷ Σ<i>p</i>² across members, where <i>p</i> is each member’s share of picks — it counts how many members are “really in play”. Both are compared with the <b>nominal size</b> (here six).'));
    body.appendChild(card('Witness description', h('p', null, '“A young man, dark hair, with a full beard and glasses, medium-brown complexion.”'), note('Face 0 is the police suspect. Choose five fillers from the pool. The default set is deliberately poor.')));
    const lu = { fillers: [1, 2, 3, 4, 5], N: 40, order: [0, 1, 2, 3, 4, 5] };
    const faceCanvas = (i, size = 84) => {
      const c = h('canvas', { width: size, height: Math.round(size * 1.2), 'aria-hidden': 'true' });
      const ctx = c.getContext && c.getContext('2d');
      if (ctx) {
        const f = POOL[i];
        ctx.fillStyle = '#e2e8f0'; ctx.fillRect(0, 0, c.width, c.height);
        api.face2d.drawFace(ctx, size / 2, size * 0.5, size * 0.85, {}, { skin: api.face2d.SKIN[f.skin], hair: ['#1b1410', '#2a1c14', '#3b2a1e', '#4a4a4a', '#6b6b6b'][f.hair], beard: f.beard, glasses: f.glasses, shirt: SHIRTS[i % SHIRTS.length] });
      }
      return c;
    };
    const desc = (f) => `${f.beard ? 'beard' : 'no beard'}, ${f.glasses ? 'glasses' : 'no glasses'}, skin tone ${f.skin + 1}/8`;
    const poolBox = h('div', { class: 'row' });
    const lineupBox = h('div', { class: 'row' });
    const luOut = out();
    const luChart = h('div');
    const drawPool = () => {
      poolBox.innerHTML = '';
      for (let i = 1; i < POOL.length; i++) {
        const on = lu.fillers.includes(i);
        poolBox.appendChild(h('button', { type: 'button', class: 'btn ' + (on ? 'primary' : 'ghost'), 'aria-pressed': String(on), title: desc(POOL[i]), onclick: () => {
          if (on) lu.fillers = lu.fillers.filter((x) => x !== i);
          else if (lu.fillers.length < 5) lu.fillers.push(i);
          else { api.toast('A six-person lineup has five fillers — remove one first.'); return; }
          drawPool(); drawLineup();
        } }, faceCanvas(i, 56), h('span', null, `#${i}${on ? ' ✓' : ''}`)));
      }
    };
    const drawLineup = () => {
      lineupBox.innerHTML = '';
      const members = [0].concat(lu.fillers);
      lu.order = lu.order.filter((x) => x < members.length);
      while (lu.order.length < members.length) lu.order.push(lu.order.length);
      lu.order.forEach((m, pos) => {
        const idx = members[m];
        lineupBox.appendChild(h('figure', { style: { margin: '2px', textAlign: 'center' } }, faceCanvas(idx), h('figcaption', { class: 'note' }, `Position ${pos + 1}${idx === 0 ? ' (suspect)' : ''}`)));
      });
      luOut.textContent = `${members.length}/6 members. ${members.length < 6 ? 'Pick ' + (6 - members.length) + ' more filler(s).' : 'Ready — run the mock-witness test.'}`;
    };
    const mockTest = () => {
      const members = [0].concat(lu.fillers);
      if (members.length < 6) { api.toast('Choose five fillers first.'); return; }
      const rng = newRng(api, 'mock');
      const target = POOL[0];
      const counts = new Array(6).fill(0);
      for (let w = 0; w < lu.N; w++) {
        let best = -Infinity, pick = 0;
        lu.order.forEach((m, pos) => {
          const f = POOL[members[m]];
          const fit = (f.beard === target.beard ? 1.3 : 0) + (f.glasses === target.glasses ? 1.0 : 0) + (1 - Math.min(1, Math.abs(f.skin - target.skin) / 3)) * 0.9 + (f.hair <= 1 ? 0.3 : 0);
          const u = fit - 0.55 * Math.log(-Math.log(Math.max(1e-9, rng.random())));
          if (u > best) { best = u; pick = pos; }
        });
        counts[pick]++;
      }
      const suspectPos = lu.order.indexOf(0);
      const sCount = counts[suspectPos];
      const ps = counts.map((c) => c / lu.N);
      const eff = 1 / ps.reduce((a, p) => a + p * p, 0);
      const fsz = sCount ? lu.N / sCount : Infinity;
      luChart.innerHTML = '';
      luChart.appendChild(api.charts.bar(counts.map((c, pos) => ({ name: `P${pos + 1}${pos === suspectPos ? ' (S)' : ''}`, value: c })), { label: `Mock-witness choices across lineup positions (N = ${lu.N})`, yl: 'mock witnesses choosing' }));
      luChart.appendChild(api.simLabel('Simulated mock witnesses'));
      const verdict = fsz >= 4 ? 'Reasonably fair: the suspect does not stand out from the description alone.' : fsz >= 2.5 ? 'Questionable: the suspect is chosen more than a fair share — improve the fillers.' : 'Biased: the description alone points to the suspect. A real identification from this lineup would carry little weight.';
      luOut.textContent = `Suspect (position ${suspectPos + 1}) chosen by ${sCount}/${lu.N} mock witnesses (fair share ≈ ${(lu.N / 6).toFixed(1)}).\nFunctional size = ${Number.isFinite(fsz) ? fsz.toFixed(2) : 'undefined (suspect never chosen)'}; effective size = ${eff.toFixed(2)}; nominal size = 6.\n${verdict}\nMock witnesses are simulated agents that pick whoever best fits the description, with random noise.`;
      api.emit('study:run', { paradigm: 'misinformation', n: lu.N });
    };
    body.appendChild(card('Filler pool (click to add/remove)', poolBox));
    body.appendChild(card('Your lineup', lineupBox,
      api.slider('Mock witnesses', { min: 10, max: 100, step: 5, value: lu.N, onInput: (v) => { lu.N = v; } }),
      row(btn('Run mock-witness test', mockTest, 'primary'), btn('Shuffle positions', () => { lu.order = newRng(api, 'shuf').shuffle(lu.order); drawLineup(); api.toast('Positions shuffled — suspect position should be random.'); }),
        btn('Load a better filler set', () => { lu.fillers = [6, 7, 9, 11, 8]; drawPool(); drawLineup(); api.toast('Fillers now match the description.'); }, 'ghost')),
      luOut, luChart));
    drawPool(); drawLineup();

    // ---- procedures
    body.appendChild(H3('How the lineup is run matters too'));
    body.appendChild(api.table(['Procedure', 'What it is', 'Why it helps'], [
      ['Double-blind administration', 'The officer running the lineup does not know who the suspect is (or uses a shuffled photo-folder method)', 'Removes unintended cues — nods, pauses, “take your time with number three”'],
      ['Unbiased instructions', 'Tell the witness the culprit may or may not be present and that the investigation continues either way', 'Reduces pressure to pick someone when the culprit is absent'],
      ['Description-matched fillers', 'Every filler fits the witness’s description', 'Stops the suspect standing out (the tool above)'],
      ['Immediate confidence record', 'Write down the witness’s confidence, in their words, at the first identification', 'Initial confidence is informative; later confidence inflates after feedback'],
      ['Simultaneous vs sequential', 'All faces at once, or one at a time with a yes/no decision for each', 'Sequential discourages “relative judgement” (picking the closest), but can also lower correct identifications; the evidence is debated'],
      ['One identification procedure', 'Avoid repeating the same suspect across lineups or show-ups', 'Repeated exposure makes the suspect familiar for the wrong reason'],
    ]));
    body.appendChild(K.facts('F-WELLS', 'F-NAS2014'));
    const SAFE = ['Double-blind administrator', 'Unbiased “may or may not be present” instruction', 'Fillers matched to the description', 'One suspect per lineup', 'Confidence recorded immediately', 'Whole procedure video-recorded'];
    const ticks = SAFE.map((s) => h('input', { type: 'checkbox', 'aria-label': s }));
    const audOut = out();
    body.appendChild(card('Procedure audit (simulated police station)', h('div', null, SAFE.map((s, i) => h('label', { class: 'pill' }, ticks[i], ' ' + s))),
      row(btn('Audit this procedure', () => { const n = ticks.filter((t) => t.checked).length; const miss = SAFE.filter((_, i) => !ticks[i].checked); audOut.textContent = `${n}/${SAFE.length} safeguards in place.` + (miss.length ? '\nMissing: ' + miss.join('; ') + '.\nA defence lawyer or expert could challenge the identification on these points.' : '\nAll recommended safeguards are present.'); }, 'primary')), audOut));

    body.appendChild(H3('Forensic links'));
    body.appendChild(P('Eyewitness research feeds directly into forensic psychology (HEC S7): expert testimony, police training and wrongful-conviction reviews. In the Mohalla you can witness a staged event and then be questioned — the run ends with a full debrief.'));
    body.appendChild(K.ownResults('misinformation'));
    body.appendChild(row(K.zone('mohalla'), K.run('misinformation'), K.panel('cases', 'Case: leading questions and eyewitness reform'), K.panel('memory', 'Memory Lab')));
  },
};

// ================================================================== 17 COGNITION
const cognition = {
  id: 'cognition',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Thinking often relies on <b>heuristics</b> — fast mental shortcuts that are usually good enough but produce systematic <b>biases</b> in predictable situations. Dual-process accounts contrast fast, automatic, intuitive processing with slow, effortful, rule-based reasoning; most real decisions mix both.'));
    body.appendChild(P('Problem solving can be described as a search through a <b>problem space</b> from a start state to a goal using operators (legal moves). Strategies include algorithms (guaranteed but slow), means–end analysis (reduce the biggest difference first) and working backwards. Language and thought interact too: the words and frames we use shape what options seem natural.'));
    body.appendChild(K.gloss('Heuristic', 'Availability heuristic', 'Representativeness heuristic', 'Anchoring', 'Framing effect', 'Confirmation bias'));

    // ---- heuristics explorer
    body.appendChild(H3('Heuristics & biases explorer'));
    const HEUR = {
      availability: { name: 'Availability', text: 'We judge how common or likely something is by how easily examples come to mind. Vivid, recent or heavily reported events feel more frequent than they are.', ex: 'After a week of headlines about a bus accident on the motorway, Hamid tells his mother that road travel is now far more dangerous than last month — although nothing about the overall accident rate has changed.' },
      representativeness: { name: 'Representativeness', text: 'We judge probability by resemblance to a prototype, and neglect base rates and sample size. The conjunction fallacy is a famous symptom: a detailed story feels more likely than a simpler one that contains it.', ex: 'Sana is quiet, loves poetry and keeps a diary. People rate “Sana is an engineering student who writes poetry” as more likely than “Sana is an engineering student” — but the first is a subset of the second.' },
      anchoring: { name: 'Anchoring', text: 'A number seen first — even an irrelevant one — pulls later estimates toward it, because we adjust from it insufficiently.', ex: 'A cloth seller opens at a very high price. Even after bargaining hard, the buyer pays more than if the first price had been modest.' },
      framing: { name: 'Framing', text: 'Logically equivalent options described as gains or as losses lead to different choices: people tend to avoid risk for gains and seek risk to avoid losses.', ex: 'A clinic says a procedure has a “90% success rate” rather than a “10% failure rate”, and more patients agree to it.' },
    };
    const hBox = h('div');
    const showH = (k) => { const x = HEUR[k]; hBox.innerHTML = ''; hBox.appendChild(card(x.name + ' heuristic', h('p', null, x.text), h('p', null, h('b', null, 'Original example: '), x.ex))); };
    body.appendChild(row(...Object.keys(HEUR).map((k) => btn(HEUR[k].name, () => showH(k)))));
    body.appendChild(hBox);
    showH('availability');
    const SPOT = [
      ['A student assumes a tall, sporty new classmate must be on the cricket team, ignoring that very few students are.', 'representativeness'],
      ['Asked whether a laptop costs more or less than a figure that was just mentioned, shoppers’ own price guesses cluster near that figure.', 'anchoring'],
      ['After seeing a news story about a dengue death in her street, Rabia over-estimates how many people in the city get dengue.', 'availability'],
      ['A loan offer described as “keep 80% of your savings safe” is preferred to one that “loses 20% of your savings”.', 'framing'],
      ['A man thinks five heads in a row means tails is now “due” on the next coin toss.', 'representativeness'],
      ['Shoppers asked about the last digits of their phone number before bidding make higher bids when those digits are high.', 'anchoring'],
    ];
    let spotI = 0, spotScore = 0, spotN = 0;
    const spotQ = h('p');
    const spotOut = out();
    const drawSpot = () => { spotQ.textContent = `Scenario ${spotI + 1}/${SPOT.length}: ${SPOT[spotI][0]}`; };
    body.appendChild(card('Spot the heuristic', spotQ, row(...Object.keys(HEUR).map((k) => btn(HEUR[k].name, () => {
      const ok = SPOT[spotI][1] === k; spotN++; if (ok) spotScore++;
      spotOut.textContent = (ok ? 'Correct — ' : 'Not quite — this is ' + HEUR[SPOT[spotI][1]].name + '. ') + `Score ${spotScore}/${spotN}.`;
      spotI = (spotI + 1) % SPOT.length; drawSpot();
    }))), spotOut));
    drawSpot();

    // ---- base-rate (Bayes) calculator
    body.appendChild(H3('Base-rate neglect: a natural-frequency calculator'));
    body.appendChild(P('Representativeness makes us ignore <b>base rates</b>. Suppose a screening question flags a rare problem. Even a “good” test produces many false alarms when the condition is rare. Move the sliders and read the result as counts out of 1,000 people — the format that makes Bayes’ rule intuitive.'));
    const by = { base: 0.02, sens: 0.9, fpr: 0.1 };
    const byOut = out();
    const byChart = h('div');
    const drawBayes = () => {
      const N = 1000, pos = N * by.base, tp = pos * by.sens, fp = (N - pos) * by.fpr, ppv = tp / (tp + fp);
      byOut.textContent = `Of 1,000 hypothetical people: ${pos.toFixed(0)} have the condition; ${tp.toFixed(0)} of them test positive.\nOf the ${(N - pos).toFixed(0)} without it, ${fp.toFixed(0)} also test positive.\nP(condition | positive) = ${tp.toFixed(0)} / (${tp.toFixed(0)} + ${fp.toFixed(0)}) = ${(100 * ppv).toFixed(1)}%.`;
      byChart.innerHTML = '';
      byChart.appendChild(api.charts.bar([{ name: 'true positives', value: +tp.toFixed(1) }, { name: 'false positives', value: +fp.toFixed(1) }], { label: 'Positive results out of 1,000 hypothetical people', yl: 'people', colors: ['#009E73', '#D55E00'] }));
    };
    body.appendChild(card(null, h('div', { class: 'grid2' },
      api.slider('Base rate', { min: 0.005, max: 0.5, step: 0.005, value: by.base, fmt: (v) => (100 * v).toFixed(1) + '%', onInput: (v) => { by.base = v; drawBayes(); } }),
      api.slider('Sensitivity (hit rate)', { min: 0.5, max: 1, step: 0.01, value: by.sens, fmt: (v) => (100 * v).toFixed(0) + '%', onInput: (v) => { by.sens = v; drawBayes(); } }),
      api.slider('False-positive rate', { min: 0.01, max: 0.5, step: 0.01, value: by.fpr, fmt: (v) => (100 * v).toFixed(0) + '%', onInput: (v) => { by.fpr = v; drawBayes(); } })), byChart, byOut, note('Hypothetical numbers you choose — not data about any real test.')));
    drawBayes();

    // ---- framing
    body.appendChild(H3('Framing (original problem)'));
    body.appendChild(K.facts('F-TK81', 'F-TK74'));
    const fr = { frame: 'gain', tally: { gain: { sure: 0, risky: 0 }, loss: { sure: 0, risky: 0 } } };
    const frText = h('div');
    const frOut = out();
    const frChart = h('div');
    const drawFrame = () => {
      frText.innerHTML = '';
      frText.appendChild(h('p', null, 'Floodwater threatens 600 homes in a low-lying district. Two plans are possible:'));
      frText.appendChild(fr.frame === 'gain'
        ? h('ul', null, h('li', null, 'Plan 1: 200 homes will be saved.'), h('li', null, 'Plan 2: a one-in-three chance that all 600 homes are saved and a two-in-three chance that none are saved.'))
        : h('ul', null, h('li', null, 'Plan 1: 400 homes will be lost.'), h('li', null, 'Plan 2: a one-in-three chance that no homes are lost and a two-in-three chance that all 600 are lost.')));
      frText.appendChild(note(`You are seeing the ${fr.frame.toUpperCase()} frame. Both frames describe identical outcomes (expected value: 200 homes saved for either plan).`));
    };
    const choose = (opt) => {
      fr.tally[fr.frame][opt]++;
      const t = fr.tally;
      frOut.textContent = `You chose ${opt === 'sure' ? 'the sure plan' : 'the risky plan'} in the ${fr.frame} frame. Your tally — gain: ${t.gain.sure} sure / ${t.gain.risky} risky; loss: ${t.loss.sure} sure / ${t.loss.risky} risky.\nPrediction from prospect theory: sure option preferred in the gain frame, risky option in the loss frame.`;
      frChart.innerHTML = '';
      frChart.appendChild(api.charts.bar([{ name: 'gain: sure', value: t.gain.sure }, { name: 'gain: risky', value: t.gain.risky }, { name: 'loss: sure', value: t.loss.sure }, { name: 'loss: risky', value: t.loss.risky }], { label: 'Your framing choices', yl: 'times chosen' }));
      fr.frame = fr.frame === 'gain' ? 'loss' : 'gain';
      drawFrame();
    };
    body.appendChild(card(null, frText, row(btn('Choose Plan 1 (sure)', () => choose('sure'), 'primary'), btn('Choose Plan 2 (risky)', () => choose('risky'), 'primary'), btn('Switch frame', () => { fr.frame = fr.frame === 'gain' ? 'loss' : 'gain'; drawFrame(); }, 'ghost')), frOut, frChart,
      row(K.run('framing'), K.run('anchoring'))));
    drawFrame();

    // ---- Wason
    body.appendChild(H3('Wason selection task (original cards)'));
    body.appendChild(K.facts('F-WASON'));
    const WAS = {
      abstract: { rule: 'If a card has a vowel on one side, then it has an even number on the other side.', cards: ['A', 'M', '4', '9'], correct: [0, 3], why: 'Only A (could hide an odd number) and 9 (could hide a vowel) can break the rule. Turning 4 is a confirmation trap: whatever is behind it, the rule survives.' },
      social: { rule: 'If a student is using the computer lab after 10 pm, they must have a signed late-pass.', cards: ['In lab after 10 pm', 'In lab at 4 pm', 'Has late-pass', 'No late-pass'], correct: [0, 3], why: 'Check the after-10 pm student (do they have a pass?) and the student without a pass (were they there after 10?). People find this version much easier — a key clue for theories of reasoning (permission schemas, cheater detection).' },
    };
    let wv = 'abstract';
    const wSel = new Set();
    const wBox = h('div');
    const wOut = out();
    const drawW = () => {
      const w = WAS[wv];
      wBox.innerHTML = '';
      wBox.appendChild(h('p', null, h('b', null, 'Rule: '), w.rule));
      wBox.appendChild(note('Which cards must you turn over to test whether the rule is being broken? Click to select.'));
      wBox.appendChild(row(...w.cards.map((c, i) => h('button', { type: 'button', class: 'btn ' + (wSel.has(i) ? 'primary' : ''), 'aria-pressed': String(wSel.has(i)), onclick: () => { if (wSel.has(i)) wSel.delete(i); else wSel.add(i); drawW(); } }, c))));
    };
    body.appendChild(card(null, wBox, row(btn('Check my selection', () => {
      const w = WAS[wv];
      const ok = wSel.size === w.correct.length && w.correct.every((i) => wSel.has(i));
      wOut.textContent = (ok ? 'Correct! ' : 'Not quite. ') + w.why;
    }, 'primary'), btn('Switch version (abstract / social)', () => { wv = wv === 'abstract' ? 'social' : 'abstract'; wSel.clear(); wOut.textContent = ''; drawW(); }), K.run('wason')), wOut));
    drawW();

    // ---- Hanoi
    body.appendChild(H3('Tower of Hanoi: optimal-move calculator'));
    body.appendChild(P('To move a tower of <i>n</i> discs you must first move the <i>n</i>−1 discs above the largest out of the way, move the largest, then rebuild the <i>n</i>−1 tower on top. That recursion gives the minimum number of moves <b>2<sup>n</sup> − 1</b>: each extra disc doubles the work plus one. It is a classic test of planning and of goal–subgoal structure.'));
    const hn = { n: 4 };
    const hnOut = out();
    const hnChart = h('div');
    const solve = (n, from, to, via, acc) => { if (n === 0) return; solve(n - 1, from, via, to, acc); acc.push(`disc ${n}: ${from}→${to}`); solve(n - 1, via, to, from, acc); };
    const drawH = () => {
      const m = Math.pow(2, hn.n) - 1;
      const secs = m;
      const human = secs < 120 ? secs + ' s' : secs < 7200 ? (secs / 60).toFixed(1) + ' min' : secs < 172800 ? (secs / 3600).toFixed(1) + ' h' : secs < 3.2e7 * 2 ? (secs / 86400).toFixed(1) + ' days' : (secs / 3.156e7).toFixed(1) + ' years';
      let seq = '';
      if (hn.n <= 5) { const acc = []; solve(hn.n, 'L', 'R', 'M', acc); seq = '\nOptimal sequence: ' + acc.join(', '); }
      hnOut.textContent = `n = ${hn.n} discs → minimum moves 2^${hn.n} − 1 = ${m.toLocaleString('en')}.\nAt one move per second: ${human}.${seq}`;
      hnChart.innerHTML = '';
      const maxN = Math.max(3, Math.min(hn.n, 12));
      hnChart.appendChild(api.charts.line([{ name: 'minimum moves', points: Array.from({ length: maxN }, (_, i) => ({ x: i + 1, y: Math.pow(2, i + 1) - 1 })), dots: true }], { label: 'Minimum moves grow exponentially with the number of discs', xl: 'discs (n)', yl: 'minimum moves' }));
    };
    body.appendChild(card(null, api.slider('Discs', { min: 1, max: 30, step: 1, value: hn.n, onInput: (v) => { hn.n = v; drawH(); } }), hnOut, hnChart, row(K.run('hanoi'))));
    drawH();

    // ---- mental rotation
    body.appendChild(H3('Mental rotation'));
    body.appendChild(P('When people decide whether two block figures are the same object or mirror images, response time rises roughly linearly with the angle between them — as if an internal image were rotated at a steady rate. This was early evidence that mental images preserve spatial structure. Run the paradigm at the Experimental Lab Wing bench and your own slope appears below.'));
    body.appendChild(K.facts('F-SM71', 'F-SM71-SLOPE'));
    const mrRows = K.rows('mental_rotation').filter((r) => r.condition === 'same' && String(r.correct) === '1' && K.isNum(r.rt_ms));
    const angleOf = (r) => { const m = /angle=(-?\d+(\.\d+)?)/.exec(String(r.stimulus)); return m ? +m[1] : null; };
    const mr = mrRows.filter((r) => angleOf(r) != null);
    if (mr.length >= 3) {
      const xs = mr.map(angleOf), ys = mr.map((r) => +r.rt_ms);
      const reg = api.stats.regression(xs, ys);
      const a = reg.a != null ? reg.a : reg.intercept, b = reg.b != null ? reg.b : reg.slope;
      body.appendChild(card('Your mental-rotation data', api.charts.scatter(xs, ys, { label: 'Your RT by rotation angle (correct “same” trials)', xl: 'angle (degrees)', yl: 'RT (ms)', line: Number.isFinite(a) && Number.isFinite(b) ? { a, b } : null }), h('span', { class: 'tag' }, 'Your own data'),
        note(Number.isFinite(b) ? `Your slope: ${b.toFixed(2)} ms per degree.` : 'Not enough spread in angles to fit a line yet.')));
    } else body.appendChild(note('No mental-rotation data yet — run the paradigm to plot your own slope.'));
    body.appendChild(row(K.run('mental_rotation'), K.zone('explab'), K.zone('library')));
    body.appendChild(H3('Your own results'));
    for (const pid of ['framing', 'anchoring', 'wason', 'hanoi']) body.appendChild(K.ownResults(pid));
    body.appendChild(row(K.panel('sdt', 'Signal Detection (decisions under uncertainty)'), K.panel('stats', 'Statistics Workbench')));
  },
};

// ================================================================== 18 INTELLIGENCE
const SHAPES = ['circle', 'square', 'triangle'];
const FILLS = ['outline', 'solid', 'dotted'];
function shapeSVG(cell, size = 64) {
  const n = cell.count, r = size / 9;
  let s = '';
  for (let i = 0; i < n; i++) {
    const cx = size * (i + 1) / (n + 1), cy = size / 2;
    const fill = cell.fill === 'solid' ? '#e2e8f0' : 'none';
    const stroke = '#e2e8f0';
    if (cell.shape === 'circle') s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    else if (cell.shape === 'square') s += `<rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    else s += `<polygon points="${cx},${cy - r * 1.15} ${cx - r * 1.1},${cy + r * 0.85} ${cx + r * 1.1},${cy + r * 0.85}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    if (cell.fill === 'dotted') s += `<circle cx="${cx}" cy="${cy + (cell.shape === 'triangle' ? r * 0.2 : 0)}" r="${r / 3.5}" fill="${stroke}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="${n} ${cell.fill} ${cell.shape}${n > 1 ? 's' : ''}"><rect x="1" y="1" width="${size - 2}" height="${size - 2}" fill="rgba(0,0,0,.25)" stroke="rgba(226,232,240,.3)"/>${s}</svg>`;
}
function makePuzzle(rng) {
  const rules = rng.shuffle(['row', 'col', 'latin']);
  const permS = rng.shuffle([0, 1, 2]), permF = rng.shuffle([0, 1, 2]), permC = rng.shuffle([0, 1, 2]);
  const val = (rule, r, c) => (rule === 'row' ? r : rule === 'col' ? c : (r + c) % 3);
  const cell = (r, c) => ({ shape: SHAPES[permS[val(rules[0], r, c)]], fill: FILLS[permF[val(rules[1], r, c)]], count: 1 + permC[val(rules[2], r, c)] });
  const grid = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) grid.push(cell(r, c));
  const answer = grid[8];
  const key = (x) => x.shape + x.fill + x.count;
  const opts = [answer];
  const seen = new Set([key(answer)]);
  let guard = 0;
  while (opts.length < 6 && guard++ < 200) {
    const d = Object.assign({}, answer);
    const which = rng.int(0, 2);
    if (which === 0 || rng.random() < 0.3) d.shape = rng.pick(SHAPES);
    if (which === 1 || rng.random() < 0.3) d.fill = rng.pick(FILLS);
    if (which === 2 || rng.random() < 0.3) d.count = rng.int(1, 3);
    if (!seen.has(key(d))) { seen.add(key(d)); opts.push(d); }
  }
  const shuffled = rng.shuffle(opts);
  const word = { row: 'changes down the rows (same across each row)', col: 'changes across the columns (same down each column)', latin: 'follows a diagonal pattern — each value appears once in every row and every column' };
  return { grid, options: shuffled, correct: shuffled.indexOf(answer), explain: `Shape ${word[rules[0]]}. Fill ${word[rules[1]]}. Number of shapes ${word[rules[2]]}.` };
}

const intelligence = {
  id: 'intelligence',
  render(body, api) {
    const K = kit(api);
    const { h, btn, P, H3, note, out, card, row } = K;
    body.appendChild(P('Intelligence is usually defined as the ability to learn from experience, reason, solve novel problems and adapt to the environment. A central empirical observation is the <b>positive manifold</b>: people who do well on one kind of cognitive test tend to do well on others. Theories differ in whether they emphasise this common factor or the distinct abilities beneath it.'));
    body.appendChild(api.table(['Theory', 'Original summary', 'Strength', 'Criticism'], [
      ['General factor <i>g</i> (Spearman)', 'One general ability shared by all cognitive tasks, plus task-specific factors', 'Explains the positive manifold; g predicts educational outcomes', 'Says little about how abilities differ or develop'],
      ['Multiple intelligences (Gardner)', 'Several relatively independent intelligences (e.g., linguistic, spatial, musical, interpersonal)', 'Widens what schools value; popular with teachers', 'Weak psychometric support; some “intelligences” look like talents or personality'],
      ['Triarchic theory (Sternberg)', 'Analytical, creative and practical abilities working together; success in one’s own context', 'Highlights practical, real-world problem solving', 'Practical-intelligence measures overlap with g and are hard to standardise'],
      ['Cattell–Horn–Carroll (CHC)', 'A hierarchy: g at the top, broad abilities in the middle (e.g., fluid reasoning Gf, crystallised knowledge Gc, processing speed, working memory), narrow abilities below', 'Integrates decades of factor analysis; guides most modern test batteries', 'Complex; the status of g at the apex is still debated'],
    ]));
    body.appendChild(K.gloss('Intelligence', 'Fluid intelligence', 'Crystallized intelligence', 'Flynn effect', 'Standardization', 'Norms'));

    body.appendChild(H3('The Flynn effect'));
    body.appendChild(P('Average scores on many intelligence tests rose across the twentieth century, so tests must be re-normed regularly or older norms will overestimate people’s standing. Proposed causes include better nutrition and health, more schooling, smaller families and more abstract everyday environments; some recent cohorts in a few countries show a slowdown or reversal.'));
    body.appendChild(K.facts('F-FLYNN', 'F-FLYNN87'));

    // ---- test bias / DIF
    body.appendChild(H3('Test bias: fairness is more than equal averages'));
    body.appendChild(P('Group differences in average scores do not by themselves prove a test is biased, and equal averages do not prove it is fair. Psychometricians look for <b>measurement bias</b> — an item behaves differently for groups of the <i>same</i> ability, called differential item functioning (DIF) — and <b>predictive bias</b>, where the same score predicts a criterion such as grades differently across groups. Translation, unfamiliar content (an item about snowfall for students in Sindh), test-taking experience and testing language can all create bias. Adapting a test for Pakistan needs careful translation, back-translation, local pilot testing and local norms.'));
    const dif = { bias: 0.8 };
    const difChart = h('div');
    const drawDIF = () => {
      const pts = (shift) => Array.from({ length: 41 }, (_, i) => { const th = -3 + i * 0.15; return { x: +th.toFixed(2), y: 1 / (1 + Math.exp(-1.7 * (th - shift))) }; });
      difChart.innerHTML = '';
      difChart.appendChild(api.charts.line([{ name: 'Group A', points: pts(0) }, { name: 'Group B', points: pts(dif.bias), dash: true }], { label: 'Item characteristic curves for two groups (illustrative)', xl: 'ability (z)', yl: 'P(correct)', yr: [0, 1] }));
      difChart.appendChild(api.simLabel('Illustrative model'));
    };
    body.appendChild(card('Differential item functioning (DIF) demo', api.slider('Extra difficulty for Group B at equal ability', { min: 0, max: 2, step: 0.1, value: dif.bias, onInput: (v) => { dif.bias = v; drawDIF(); } }), difChart,
      note('If the two curves separate, people of equal ability have different chances of passing the item — evidence the item measures something extra (language, culture) for one group. A fair item has overlapping curves.')));
    drawDIF();

    // ---- original puzzles
    body.appendChild(H3('Original matrix-style puzzles'));
    body.appendChild(note('Each puzzle is an <b>original puzzle</b>, generated procedurally in your browser from three simple rules. These are not items from any published test (and not Raven’s matrices); they are for practice and discussion only, with no norms and no score interpretation.'));
    const pz = { cur: null, rng: newRng(api, 'puzzle'), right: 0, tried: 0 };
    const pzBox = h('div');
    const pzOut = out();
    const drawPz = () => {
      pz.cur = makePuzzle(pz.rng);
      pzBox.innerHTML = '';
      const gridEl = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 66px)', gap: '4px' }, role: 'group', 'aria-label': '3 by 3 pattern with the last cell missing' });
      pz.cur.grid.forEach((c, i) => gridEl.appendChild(h('div', { html: i === 8 ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="missing cell"><rect x="1" y="1" width="62" height="62" fill="none" stroke="#F59E0B" stroke-dasharray="4 3"/><text x="32" y="40" text-anchor="middle" font-size="24" fill="#F59E0B">?</text></svg>' : shapeSVG(c) })));
      pzBox.appendChild(h('span', { class: 'tag' }, 'original puzzle'));
      pzBox.appendChild(gridEl);
      pzBox.appendChild(note('Which option completes the pattern?'));
      pzBox.appendChild(row(...pz.cur.options.map((o, i) => h('button', { type: 'button', class: 'btn ghost', 'aria-label': 'Option ' + 'ABCDEF'[i], onclick: () => {
        pz.tried++; const ok = i === pz.cur.correct; if (ok) pz.right++;
        pzOut.textContent = `${ok ? 'Correct.' : 'Not this one — the answer was option ' + 'ABCDEF'[pz.cur.correct] + '.'} ${pz.cur.explain}\nSession: ${pz.right}/${pz.tried} (practice only; no norms, not an IQ score).`;
      } }, h('span', { html: shapeSVG(o, 48) }), ' ' + 'ABCDEF'[i]))));
      pzOut.textContent = '';
    };
    body.appendChild(card(null, pzBox, row(btn('New original puzzle', drawPz, 'primary')), pzOut));
    drawPz();

    // ---- IQ converter
    body.appendChild(H3('Score converter: IQ ↔ z ↔ T ↔ percentile'));
    body.appendChild(P('Deviation IQs are standard scores on a scale with mean 100 and SD 15; <i>T</i>-scores use mean 50 and SD 10; <i>z</i> uses mean 0 and SD 1. A percentile rank is the percentage of the norm group scoring below a given score. Conversions assume a normal distribution in the norm group.'));
    const cv = { scale: 'iq', value: 115 };
    const cvIn = h('input', { type: 'number', value: cv.value, step: 'any', 'aria-label': 'Score value' });
    const cvOut = out();
    const cvChart = h('div');
    const convert = (user) => {
      const v = +cvIn.value;
      if (!Number.isFinite(v)) { cvOut.textContent = 'Enter a number.'; return; }
      let z;
      if (cv.scale === 'iq') z = (v - 100) / 15; else if (cv.scale === 't') z = (v - 50) / 10; else if (cv.scale === 'z') z = v;
      else { if (v <= 0 || v >= 100) { cvOut.textContent = 'Percentile must be between 0 and 100 (exclusive).'; return; } z = api.dist.normInv(v / 100); }
      z = clamp(z, -4, 4);
      const iq = api.stats.iqScore(z), t = api.stats.tScore(z), pr = api.stats.percentile(z);
      cvOut.textContent = `z = ${z.toFixed(2)}   IQ = ${iq.toFixed(1)}   T = ${t.toFixed(1)}   percentile rank = ${pr.toFixed(1)}\nAbout ${pr.toFixed(1)}% of the norm group would score below this. Remember every score has measurement error (see Psychometrics: SEM).`;
      const curve = [], area = [];
      for (let i = 0; i <= 120; i++) { const zz = -4 + i * (8 / 120); const y = api.dist.normPdf(zz); curve.push({ x: +(100 + 15 * zz).toFixed(2), y }); if (zz <= z) area.push({ x: +(100 + 15 * zz).toFixed(2), y }); }
      area.push({ x: +iq.toFixed(2), y: api.dist.normPdf(z) }, { x: +iq.toFixed(2), y: 0 });
      cvChart.innerHTML = '';
      cvChart.appendChild(api.charts.line([{ name: 'normal curve', points: curve }, { name: 'area below score', points: area, dash: true }], { label: `Normal curve on the IQ scale; score ${iq.toFixed(0)} at percentile ${pr.toFixed(0)}`, xl: 'IQ scale (mean 100, SD 15)', yl: 'density' }));
      if (user === true) api.emit('stats:test', { test: 'z' });
    };
    body.appendChild(card(null, row(api.select('Scale', [{ value: 'iq', label: 'IQ' }, { value: 'z', label: 'z-score' }, { value: 't', label: 'T-score' }, { value: 'pct', label: 'Percentile' }], cv.scale, (v) => { cv.scale = v; convert(true); }), h('label', { class: 'f' }, 'Value', cvIn), btn('Convert', () => convert(true), 'primary')), cvOut, cvChart));
    convert();

    body.appendChild(H3('Ethics of testing'));
    body.appendChild(P('Intelligence tests are protected professional instruments: only trained, qualified people should administer and interpret them, and real items must never be posted or shared. Scores describe current performance under particular conditions; they are not fixed measures of worth, and should never be used alone for high-stakes decisions about a person.'));
    body.appendChild(row(K.panel('psychometrics', 'Psychometrics (reliability, validity, norms)'), K.panel('crosscultural', 'Cross-cultural testing issues'), K.panel('quiz', 'Quiz yourself'), K.zone('library')));
  },
};

module.exports = [learning, memory, eyewitness, cognition, intelligence];
