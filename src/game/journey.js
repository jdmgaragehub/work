'use strict';
/**
 * Journeys (A9).
 *   const journey = new Journey(sim)          // sim.services.journey
 *   journey.start('participant', {auto?})     // "A Participant's Journey" — 12 first-person steps (§5.1)
 *   journey.start('client')                   // delegates to sim.services.clinic.startJourney()
 *   journey.active                            // 'participant' | null (the Director never interrupts a journey)
 *
 * Each completed step emits 'journey:step' {journey:'participant', step:n} and is tracked in
 * sim.state.journey.participant = {step, done, withdrawn}. `auto:true` walks every step without UI
 * (bot paradigm runs, default answers) for e2e. Leaving at any step discards this journey's rows.
 * Demographics are optional and never required; the signature image is kept in memory only.
 */
const L = require('./logic.js');
const { h, btn, modal, toast, download } = require('../ui/dom.js');
const charts = require('../ui/charts.js');
const { injectCSS } = require('./scoring.js');

const BLOCKS = [
  { id: 'stroop', title: 'Stroop colour-word', measure: 'stroop_ms' },
  { id: 'visual_search', title: 'Visual search', measure: 'search_slope' },
  { id: 'serial_position', title: 'Serial-position recall', measure: 'recall_pct' },
];
const MEASURES = { stroop_ms: ['Stroop interference', 'ms'], search_slope: ['Conjunction search slope', 'ms/item'], recall_pct: ['Free recall', '% words'] };
const INKS = [['RED', '#C8312B'], ['GREEN', '#1E8E3E'], ['BLUE', '#1F5FBF'], ['YELLOW', '#D4A106']];

const CSS = `
.zg-jhud{position:fixed;left:84px;top:64px;z-index:58;width:250px;background:var(--glass,rgba(20,18,50,.88));border:1px solid var(--line,#444);border-radius:12px;padding:8px 10px;font-size:.78em}
.zg-jhud h4{margin:0 0 4px;color:#fde68a;font-size:1em}
.zg-jhud ol{margin:0;padding-left:20px}.zg-jhud li{margin:2px 0;opacity:.6}
.zg-jhud li.cur{opacity:1;font-weight:700;color:#fde68a}.zg-jhud li.done{opacity:.9}.zg-jhud li.done::marker{color:#34d399}
.zg-poster{display:block;margin:0 auto;max-width:100%;border-radius:6px;box-shadow:0 6px 20px rgba(0,0,0,.4)}
.zg-sheet{background:#fffdf5;color:#1e1b4b;border-radius:8px;padding:12px 16px;max-height:46vh;overflow:auto;font-size:.9em}
.zg-sheet h4{margin:10px 0 4px}
.zg-sig{background:#fff;border:2px dashed #94a3b8;border-radius:8px;touch-action:none;cursor:crosshair;display:block;width:100%;max-width:480px;height:140px}
.zg-checks label{display:flex;gap:8px;align-items:flex-start;margin:5px 0;font-size:.9em}
.zg-stroop{font:800 54px system-ui,sans-serif;text-align:center;padding:26px 0;background:#9a9a9a;border-radius:10px;margin:8px 0;letter-spacing:.04em}
.zg-anon{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.zg-idcard{background:rgba(255,255,255,.06);border:1px solid var(--line,#444);border-radius:10px;padding:8px 10px;font-size:.86em}
.zg-idcard .gone{text-decoration:line-through;opacity:.45;transition:opacity .8s}
.zg-rowtable{max-height:260px;overflow:auto}
.zg-rowtable tr.you{background:rgba(245,158,11,.25);transition:transform .9s ease,opacity .9s ease}
.zg-rowtable tr.you.enter{transform:translateY(-40px);opacity:0}
.zg-rowtable tr.you.leave{opacity:0;transform:translateX(60px)}
body.reduced-motion .zg-rowtable tr.you{transition:none}
`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

class Journey {
  constructor(sim) {
    this.sim = sim;
    this.active = null;
    this.hud = null;
    if (!sim.state.journey || typeof sim.state.journey !== 'object') sim.state.journey = {};
  }

  steps() { return L.JOURNEY_STEPS.slice(); }

  async start(kind = 'participant', opts = {}) {
    const sim = this.sim;
    if (kind === 'client') {
      const c = sim.services.clinic;
      if (c && typeof c.startJourney === 'function') return c.startJourney(opts);
      toast('The Counselling & Clinic Centre is not available.');
      return null;
    }
    if (kind !== 'participant') throw new Error('unknown journey ' + kind);
    if (this.active) { toast('A journey is already in progress.'); return null; }
    injectCSS('zg-journey-css', CSS);
    this.active = 'participant';
    this.auto = !!opts.auto;
    this.ctx = { results: {}, rows: [], measures: {}, demographics: null, withdrawn: false, check: null, practice: [] };
    sim.state.journey.participant = { step: 0, done: false, startedAt: new Date().toISOString() };
    sim.bus.emit('journey:start', { journey: 'participant' });
    this._hud(1);
    const steps = [this.poster, this.infoSheet, this.consent, this.demographics, this.practice, this.blocks, this.manipulationCheck, this.debrief, this.withdrawal, this.anonymisedRow, this.groupResults, this.certificate];
    let n = 0;
    try {
      for (n = 1; n <= 12; n++) {
        this._hud(n);
        const ok = await steps[n - 1].call(this);
        if (ok === false) { this._leave(n); return { completed: false, step: n }; }
        this._done(n);
      }
      sim.state.journey.participant.done = true;
      sim.addXP(150, "A Participant's Journey");
      toast("🎓 A Participant's Journey complete — thank you for taking part.");
      sim.bus.emit('journey:complete', { journey: 'participant' });
      return { completed: true, measures: Object.assign({}, this.ctx.measures), withdrawn: this.ctx.withdrawn };
    } finally {
      this.active = null;
      if (this.hud) { const hd = this.hud; this.hud = null; setTimeout(() => hd.remove(), this.auto ? 0 : 2500); }
    }
  }

  _done(n) {
    const j = this.sim.state.journey.participant;
    j.step = n;
    this.sim.bus.emit('journey:step', { journey: 'participant', step: n });
    this._hud(n + 1);
  }

  _leave(n) {
    this._deleteRows();
    this.sim.state.journey.participant.withdrawn = true;
    this.sim.bus.emit('journey:abort', { journey: 'participant', step: n });
    toast('You left the study. Any data from this journey was discarded — no penalty.');
  }

  _deleteRows() {
    const set = new Set(this.ctx.rows.map((x) => x.row));
    for (const key of new Set(this.ctx.rows.map((x) => x.key))) {
      if (Array.isArray(this.sim.datasets[key])) this.sim.datasets[key] = this.sim.datasets[key].filter((r) => !set.has(r));
    }
    if (this.sim.datasets.participant_journey) this.sim.datasets.participant_journey = this.sim.datasets.participant_journey.filter((r) => r.simulated);
    this.ctx.rows = [];
  }

  _hud(cur) {
    if (this.auto && typeof document === 'undefined') return;
    if (!this.hud) {
      this.hud = h('aside', { class: 'zg-jhud', role: 'status', 'aria-live': 'polite', 'aria-label': "A Participant's Journey progress" });
      document.body.appendChild(this.hud);
    }
    this.hud.innerHTML = '';
    this.hud.appendChild(h('h4', null, `A Participant's Journey — step ${Math.min(cur, 12)}/12`));
    this.hud.appendChild(h('ol', null, L.JOURNEY_STEPS.map((s) => h('li', { class: s.n < cur ? 'done' : s.n === cur ? 'cur' : '' }, s.title))));
  }

  /** Modal with in-body controls; `mount(box, close)` wires them. Auto mode returns autoValue. */
  _ask(cfg, autoValue) {
    if (this.auto) return Promise.resolve(typeof autoValue === 'function' ? autoValue() : autoValue);
    return modal(Object.assign({ dismissable: false }, cfg));
  }
  _leaveAction() { return { label: 'Leave the study', value: false, cls: 'ghost' }; }

  // ---------------------------------------------------------------- 1 poster
  async poster() {
    const w = this.sim.services.world;
    if (w && w.teleport && !this.auto) try { w.teleport('explab'); } catch (e) { /* optional */ }
    const c = this._posterCanvas();
    return this._ask({
      title: 'Step 1 — A poster on the noticeboard',
      body: h('div', null, c, h('p', { class: 'note' }, 'You are walking past the Experimental Lab Wing noticeboard. (IIBS is a simulated institution.)')),
      actions: [{ label: 'Not today', value: false, cls: 'ghost' }, { label: 'Tear off a tab and sign up', value: true }],
    }, true);
  }
  _posterCanvas() {
    const c = h('canvas', { class: 'zg-poster', width: 420, height: 540, role: 'img', 'aria-label': 'Recruitment poster: Participants wanted — How fast is your mind? 15 minutes, Experimental Lab Wing.' });
    const g = c.getContext && c.getContext('2d');
    if (!g) return c;
    g.fillStyle = '#fef3c7'; g.fillRect(0, 0, 420, 540);
    g.fillStyle = '#B91C1C'; g.fillRect(0, 0, 420, 92);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 34px system-ui, sans-serif'; g.fillText('PARTICIPANTS WANTED', 210, 58);
    g.fillStyle = '#1E1B4B'; g.font = '700 30px Georgia, serif'; g.fillText('How fast is your mind?', 210, 145);
    g.font = '18px system-ui, sans-serif';
    ['Three short computer tasks', 'About 15 minutes · adults 18+', 'Experimental Lab Wing, Room 2', 'You can stop at any time', 'Approved by the IIBS Ethics Board', '(simulated ref. IRB-SIM-07)'].forEach((t, i) => g.fillText(t, 210, 200 + i * 32));
    g.font = 'italic 14px system-ui'; g.fillText('IIBS is a simulated institution in a teaching game.', 210, 410);
    for (let i = 0; i < 7; i++) {
      const x = 12 + i * 57;
      g.setLineDash([4, 4]); g.strokeStyle = '#64748b'; g.strokeRect(x, 430, 54, 104); g.setLineDash([]);
      g.save(); g.translate(x + 32, 525); g.rotate(-Math.PI / 2); g.fillStyle = '#1E1B4B'; g.font = '12px system-ui'; g.textAlign = 'left'; g.fillText('Mind study · Lab 2', 0, 0); g.restore();
    }
    return c;
  }

  // ---------------------------------------------------------------- 2 information sheet
  async infoSheet() {
    const sheet = h('div', { class: 'zg-sheet', tabindex: '0', 'aria-label': 'Participant information sheet' },
      h('h4', null, 'Study title'), h('p', null, 'How fast is your mind? Reaction-time and memory tasks.'),
      h('h4', null, 'What will happen?'), h('p', null, 'A short practice, then three computer tasks: naming ink colours, finding a target among distractors, and recalling a list of words. Then a few questions.'),
      h('h4', null, 'How long?'), h('p', null, 'About 15 minutes.'),
      h('h4', null, 'Risks and benefits'), h('p', null, 'Minimal risk: some people find speeded tasks mildly frustrating. You will see your own data and learn how these classic effects work.'),
      h('h4', null, 'Is it voluntary?'), h('p', null, 'Yes. You may stop at any time, without giving a reason and without penalty. You can also withdraw your data after the debrief.'),
      h('h4', null, 'What happens to my data?'), h('p', null, `Your responses stay on this device under an anonymous code (not your name). Group results are shown alongside simulated classmates. Nothing is uploaded.`),
      h('h4', null, 'Some details are withheld'), h('p', null, 'To avoid influencing your responses, the exact purpose will be explained fully at the end (debrief).'),
      h('h4', null, 'Contact'), h('p', null, 'Lab supervisor (fictional): Dr. N. Memon, Experimental Lab Wing. Ethics Board (simulated).'));
    const chk = h('input', { type: 'checkbox', id: 'zg-read' });
    const go = btn('Continue to consent', () => {}, 'primary', { disabled: true });
    chk.addEventListener('change', () => { go.disabled = !chk.checked; });
    return this._ask({
      title: 'Step 2 — Participant information sheet',
      body: h('div', null, sheet, h('label', { class: 'row' }, chk, ' I have read and understood the information sheet.'), h('div', { class: 'row' }, go)),
      actions: [this._leaveAction()],
      onMount: (box, close) => { go.onclick = () => close(true); },
    }, true);
  }

  // ---------------------------------------------------------------- 3 consent + signature pad
  async consent() {
    const sim = this.sim;
    const statements = ['I have read the information sheet and had the chance to ask questions.', 'I understand that taking part is voluntary and I can stop at any time without penalty.', 'I understand my data are stored anonymously on this device and I can withdraw them after the debrief.', 'I am 18 or over and agree to take part.'];
    const checks = statements.map((s) => { const c = h('input', { type: 'checkbox' }); return { c, el: h('label', null, c, h('span', null, s)) }; });
    const pad = h('canvas', { class: 'zg-sig', width: 480, height: 140, 'aria-label': 'Signature pad: draw your signature with mouse, finger or pen' });
    const typed = h('input', { type: 'text', placeholder: 'or type your initials', 'aria-label': 'Initials (alternative to drawing)', maxlength: 6 });
    const sign = btn('I consent — sign', () => {}, 'primary', { disabled: true });
    let ink = 0;
    const update = () => { sign.disabled = !(checks.every((x) => x.c.checked) && (ink > 60 || typed.value.trim().length >= 2)); };
    checks.forEach((x) => x.c.addEventListener('change', update));
    typed.addEventListener('input', update);
    this._signaturePad(pad, (d) => { ink += d; update(); }, () => { ink = 0; update(); });
    const clear = btn('Clear signature', () => { const g = pad.getContext('2d'); g.clearRect(0, 0, pad.width, pad.height); ink = 0; update(); }, 'ghost');
    const ok = await this._ask({
      title: 'Step 3 — Informed consent',
      body: h('div', null, h('div', { class: 'zg-checks' }, checks.map((x) => x.el)), h('p', { class: 'note' }, 'Sign below. The signature is used only on this screen and is not saved.'), pad, h('div', { class: 'row' }, typed, clear), h('div', { class: 'row' }, sign)),
      actions: [{ label: 'I do not consent', value: false, cls: 'ghost' }],
      onMount: (box, close) => { sign.onclick = () => close(true); },
    }, true);
    if (!ok) return false;
    sim.state.consentLog.push({ paradigm: 'journey:participant', at: new Date().toISOString(), signed: true });
    sim.bus.emit('consent:given', { paradigm: 'journey' });
    return true;
  }
  _signaturePad(canvas, onInk, onReset) {
    const g = canvas.getContext && canvas.getContext('2d');
    if (!g) return;
    let last = null;
    const pt = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left) / Math.max(1, r.width)) * canvas.width, ((e.clientY - r.top) / Math.max(1, r.height)) * canvas.height]; };
    canvas.addEventListener('pointerdown', (e) => { last = pt(e); try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } e.preventDefault(); });
    canvas.addEventListener('pointermove', (e) => {
      if (!last) return;
      const p = pt(e);
      g.strokeStyle = '#1E1B4B'; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke();
      onInk(Math.hypot(p[0] - last[0], p[1] - last[1])); last = p;
    });
    const up = () => { last = null; };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointerleave', up); canvas.addEventListener('pointercancel', up);
    void onReset;
  }

  // ---------------------------------------------------------------- 4 demographics (optional)
  async demographics() {
    const age = h('select', { 'aria-label': 'Age band (optional)' }, ['Prefer not to say', '18–20', '21–24', '25–29', '30–39', '40 or over'].map((x) => h('option', { value: x }, x)));
    const gender = h('select', { 'aria-label': 'Gender (optional)' }, ['Prefer not to say', 'Woman', 'Man', 'Non-binary / another identity'].map((x) => h('option', { value: x }, x)));
    const res = await this._ask({
      title: 'Step 4 — About you (optional)',
      body: h('div', null, h('p', null, 'These questions are optional. Skipping them changes nothing. Researchers collect only what the question needs — here, just enough to describe the sample.'),
        h('div', { class: 'row' }, h('label', { class: 'f' }, 'Age band', age), h('label', { class: 'f' }, 'Gender', gender))),
      actions: [{ label: 'Skip', value: 'skip', cls: 'ghost' }, { label: 'Save and continue', value: 'save' }],
    }, 'skip');
    this.ctx.demographics = res === 'save' ? { ageBand: age.value, gender: gender.value } : null;
    this.sim.bus.emit('journey:demographics', { provided: !!this.ctx.demographics });
    return true;
  }

  // ---------------------------------------------------------------- 5 practice block
  async practice() {
    if (this.auto) { this.ctx.practice = [{ correct: true }, { correct: true }, { correct: false }, { correct: true }]; return true; }
    const rng = this.sim.rng && this.sim.rng.fork ? this.sim.rng.fork('journey-practice') : null;
    const pick = (a) => a[Math.floor((rng ? rng.random() : Math.random()) * a.length)];
    const ok = await modal({ title: 'Step 5 — Practice block', body: '<p>Four practice trials. Click the <b>ink colour</b> of the word, ignoring what the word says. Practice responses are not recorded.</p>', actions: [this._leaveAction(), { label: 'Start practice', value: true }], dismissable: false });
    if (!ok) return false;
    for (let t = 0; t < 4; t++) {
      const word = pick(INKS)[0];
      const ink = t % 2 ? pick(INKS.filter((x) => x[0] !== word)) : INKS.find((x) => x[0] === word);
      const stim = h('div', { class: 'zg-stroop', style: { color: ink[1] } }, word);
      const t0 = performance.now();
      const ans = await modal({ title: `Practice ${t + 1} of 4`, body: stim, actions: INKS.map(([name, col]) => ({ label: name.charAt(0) + name.slice(1).toLowerCase(), value: name, attrs: { style: `border-left:6px solid ${col}` } })), dismissable: false, cls: 'zg-practice' });
      const correct = ans === ink[0];
      this.ctx.practice.push({ correct, rt: Math.round(performance.now() - t0) });
      toast(correct ? '✔ Correct — the ink was ' + ink[0].toLowerCase() : '✘ The ink was ' + ink[0].toLowerCase() + ' (the word said ' + word.toLowerCase() + ')', 1800);
    }
    return true;
  }

  // ---------------------------------------------------------------- 6 experimental blocks
  async blocks() {
    const sim = this.sim;
    const runner = sim.services.runner;
    for (let i = 0; i < BLOCKS.length; i++) {
      const b = BLOCKS[i];
      const spec = sim.registry && sim.registry.paradigms && sim.registry.paradigms.get(b.id);
      const go = await this._ask({ title: `Step 6 — Block ${i + 1} of 3: ${b.title}`, body: `<p>${spec && spec.purpose ? spec.purpose : 'Next task.'}</p><p class="note">The task has its own instructions. You can still withdraw with <kbd>Esc</kbd>.</p>`, actions: [this._leaveAction(), { label: 'Skip this block', value: 'skip', cls: 'ghost' }, { label: 'Start block', value: 'go' }] }, 'go');
      if (go === false) return false;
      let res = null;
      if (go === 'go' && runner && spec) {
        const opts = this.auto ? { bot: true, quick: true, trials: 12, silent: true, timeScale: 0.05, journeyConsent: true } : { silent: true, journeyConsent: true };
        try { res = await runner.run(b.id, opts); } catch (e) { res = null; }
        if (res && res.rows) {
          const key = this.auto ? b.id + ':bot' : b.id;
          res.rows.forEach((row) => this.ctx.rows.push({ key, row }));
        }
      }
      this.ctx.results[b.id] = res;
      const v = measure(b.id, res);
      if (fin(v)) this.ctx.measures[b.measure] = v;
      else {
        // Paradigm unavailable/skipped: a clearly labelled simulated stand-in keeps the journey going.
        const stand = L.simulatedClass(sim.seed + ':you:' + sim.state.pid, 1)[0];
        this.ctx.measures[b.measure] = stand[b.measure];
        this.ctx.simulatedStandIn = (this.ctx.simulatedStandIn || []).concat(b.measure);
      }
    }
    return true;
  }

  // ---------------------------------------------------------------- 7 manipulation check
  async manipulationCheck() {
    const opts = ['The ink colour of the word', 'What the word said', 'Where the word appeared'];
    const ans = await this._ask({
      title: 'Step 7 — Manipulation check',
      body: '<p>In the colour-word task, what were you asked to respond to?</p><p class="note">Researchers ask this to confirm the instructions (the manipulation) worked as intended.</p>',
      actions: opts.map((o, i) => ({ label: o, value: i })),
    }, 0);
    this.ctx.check = ans === 0;
    if (!this.auto) toast(this.ctx.check ? '✔ Right — instructions understood.' : 'The task asked for the ink colour. Participants who fail a check are often excluded (pre-registered rule).', 4000);
    return true;
  }

  // ---------------------------------------------------------------- 8 debrief
  async debrief() {
    const m = this.ctx.measures;
    const body = h('div', null,
      h('p', null, h('b', null, 'What the study was really about. '), 'The poster asked "How fast is your mind?" — but speed itself was not the point. We measured three classic effects: ',
        h('b', null, 'Stroop interference'), ' (reading is automatic and slows colour naming), ', h('b', null, 'search slopes'), ' (conjunction targets need serial attention), and ', h('b', null, 'serial position'), ' (primacy and recency in free recall).'),
      h('p', null, h('b', null, 'Why the cover story? '), 'If you had known we wanted interference, you might have tried to read less, which changes the effect. This mild withholding is allowed only when the risk is minimal and you are debriefed promptly (APA Ethics Code 8.07, 8.08).'),
      h('p', null, h('b', null, 'Your results: '), `Stroop interference ${fin(m.stroop_ms) ? Math.round(m.stroop_ms) + ' ms' : '—'}, conjunction search slope ${fin(m.search_slope) ? m.search_slope.toFixed(1) + ' ms/item' : '—'}, recall ${fin(m.recall_pct) ? Math.round(m.recall_pct) + '%' : '—'}.`),
      this.ctx.simulatedStandIn ? h('p', { class: 'note' }, 'Some blocks were skipped or unavailable; a simulated stand-in value (labelled) was used for: ' + this.ctx.simulatedStandIn.join(', ') + '.') : null,
      h('p', { class: 'note' }, 'Browser reaction times carry a lag of tens of milliseconds; fine for learning, not a test of ability or a diagnosis.'));
    await this._ask({ title: 'Step 8 — Debrief', body, actions: [{ label: 'I understand', value: true }] }, true);
    this.sim.bus.emit('debrief:shown', { paradigm: 'journey' });
    return true;
  }

  // ---------------------------------------------------------------- 9 withdrawal option
  async withdrawal() {
    const res = await this._ask({
      title: 'Step 9 — Your right to withdraw',
      body: '<p>Now that you know the full purpose, you may withdraw your data. Your rows from this journey will be deleted from this device. You still receive your certificate — there is no penalty either way.</p>',
      actions: [{ label: 'Withdraw my data', value: 'withdraw', cls: 'ghost' }, { label: 'Keep my data', value: 'keep' }],
    }, 'keep');
    if (res === 'withdraw') {
      this._deleteRows();
      this.ctx.withdrawn = true;
      this.sim.state.journey.participant.withdrawn = true;
      this.sim.bus.emit('journey:withdraw', { journey: 'participant' });
      if (!this.auto) toast('Your data from this journey were deleted.');
    }
    return true;
  }

  // ---------------------------------------------------------------- 10 anonymised row
  _classRows() { return L.simulatedClass(this.sim.seed, 29); }
  _yourRow() {
    const m = this.ctx.measures;
    return { id: L.anonymiseId(this.sim.state.pid, String(this.sim.seed)), stroop_ms: fin(m.stroop_ms) ? Math.round(m.stroop_ms) : null, search_slope: fin(m.search_slope) ? Math.round(m.search_slope * 10) / 10 : null, recall_pct: fin(m.recall_pct) ? Math.round(m.recall_pct) : null, simulated: false };
  }
  async anonymisedRow() {
    const sim = this.sim;
    const cls = this._classRows();
    const you = this._yourRow();
    const dataset = cls.map((r) => Object.assign({ source: 'Simulated data' }, r));
    if (!this.ctx.withdrawn) dataset.push(Object.assign({ source: 'You' }, you));
    sim.datasets.participant_journey = dataset;
    if (this.auto) return true;
    const demo = this.ctx.demographics;
    const idFields = [['Anonymous code', sim.state.pid], ['Signature', 'on consent form (not saved)'], ['Age band', demo ? demo.ageBand : '—'], ['Gender', demo ? demo.gender : '—'], ['Device', 'this browser']];
    const card = h('div', { class: 'zg-idcard' }, h('b', null, 'Your record'), h('ul', null, idFields.map(([k, v]) => h('li', { class: 'idf' }, `${k}: ${v}`))));
    const head = ['id', 'source', 'stroop_ms', 'search_slope', 'recall_pct'];
    const tbody = h('tbody', null, cls.slice(-8).map((r) => h('tr', null, [r.id, h('span', { class: 'sim-label' }, 'Simulated'), r.stroop_ms, r.search_slope, r.recall_pct].map((c) => h('td', null, c)))));
    const tbl = h('div', { class: 'zg-rowtable' }, h('table', { class: 't' }, h('thead', null, h('tr', null, head.map((x) => h('th', null, x)))), tbody));
    const status = h('p', { class: 'note', 'aria-live': 'polite' }, 'Removing identifying details…');
    const body = h('div', null, h('p', null, 'Watch your data become one anonymised row in the lab dataset (last rows shown; ', h('span', { class: 'sim-label' }, 'Simulated data'), ' for classmates).'), h('div', { class: 'zg-anon' }, card, tbl), status);
    const animate = async () => {
      const rm = sim.settings.reducedMotion;
      await sleep(rm ? 0 : 700);
      card.querySelectorAll('.idf').forEach((li, i) => { if (i > 0) li.classList.add('gone'); });
      await sleep(rm ? 0 : 700);
      if (this.ctx.withdrawn) { status.textContent = 'You withdrew: no row is added. The dataset holds only the simulated class.'; return; }
      card.querySelector('.idf').textContent = `Anonymous code: ${sim.state.pid} → ${you.id}`;
      status.textContent = `Your identity is replaced by a one-way code (${you.id}); only the numbers move on.`;
      const tr = h('tr', { class: 'you enter' }, [you.id, h('b', null, 'You'), you.stroop_ms, you.search_slope, you.recall_pct].map((c) => h('td', null, c == null ? '—' : c)));
      tbody.appendChild(tr);
      requestAnimationFrame(() => requestAnimationFrame(() => tr.classList.remove('enter')));
      tbl.scrollTop = tbl.scrollHeight;
    };
    await modal({ title: 'Step 10 — Your data becomes an anonymised row', body, actions: [{ label: 'See the group results', value: true }], dismissable: false, onMount: () => { animate(); } });
    return true;
  }

  // ---------------------------------------------------------------- 11 group results
  async groupResults() {
    const cls = this._classRows();
    const sum = L.classSummary(cls);
    const you = this._yourRow();
    this.ctx.summary = sum;
    if (this.auto) return true;
    const grid = h('div', { class: 'grid2' });
    for (const k of Object.keys(MEASURES)) {
      const [label, unit] = MEASURES[k];
      const groups = [{ name: 'Class (simulated)', value: Math.round(sum[k].mean * 10) / 10, err: sum[k].se * 1.96 }];
      if (!this.ctx.withdrawn && fin(you[k])) groups.push({ name: 'You', value: you[k] });
      let chart = null;
      try { chart = charts.bar(groups, { label: `${label}: you vs simulated class`, yl: unit, W: 300, H: 200 }); } catch (e) { chart = h('p', null, groups.map((g) => `${g.name}: ${g.value}`).join(' · ')); }
      const z = !this.ctx.withdrawn && fin(you[k]) && sum[k].sd > 0 ? (you[k] - sum[k].mean) / sum[k].sd : null;
      grid.appendChild(h('div', { class: 'card' }, h('h4', null, label), chart, h('p', { class: 'note' }, `Class M = ${sum[k].mean.toFixed(1)}, SD = ${sum[k].sd.toFixed(1)}, n = ${sum[k].n} (simulated; error bar = 95% CI)` + (z != null ? ` · you: z = ${z.toFixed(2)}` : ''))));
    }
    const ui = this.sim.services.ui;
    const body = h('div', null, h('p', null, h('span', { class: 'sim-label' }, 'Simulated data'), ' Your row next to a simulated class of 29. Individual differences are normal; a single run is noisy.'), grid,
      h('div', { class: 'row' }, btn('Open in Statistics Workbench', () => { if (ui && ui.openPanel) ui.openPanel('stats'); }, 'teal')));
    await modal({ title: 'Step 11 — Group results', body, actions: [{ label: 'Collect my certificate', value: true }], dismissable: false });
    return true;
  }

  // ---------------------------------------------------------------- 12 participation certificate
  certificateCanvas(date) {
    const sim = this.sim;
    const W = 1200, H = 820;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fffdf5'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#0F766E'; g.lineWidth = 12; g.strokeRect(24, 24, W - 48, H - 48);
    g.strokeStyle = '#F59E0B'; g.lineWidth = 3; g.strokeRect(44, 44, W - 88, H - 88);
    g.textAlign = 'center'; g.fillStyle = '#1E1B4B';
    g.font = '600 22px system-ui, sans-serif'; g.fillText('ZEHN — The Psychology Lab Simulator · Experimental Lab Wing', W / 2, 115);
    g.font = '700 60px Georgia, serif'; g.fillText('Certificate of Participation', W / 2, 210);
    g.font = '24px Georgia, serif'; g.fillText('Thank you, participant', W / 2, 275);
    g.font = '700 46px ui-monospace, Menlo, monospace'; g.fillStyle = '#B91C1C'; g.fillText(L.anonymiseId(sim.state.pid, String(sim.seed)), W / 2, 345);
    g.fillStyle = '#1E1B4B'; g.font = '22px Georgia, serif';
    g.fillText('for taking part in "How fast is your mind?" — Stroop, visual search and serial-position recall —', W / 2, 410);
    g.fillText('and for completing every step from informed consent to debrief.', W / 2, 444);
    g.font = '20px system-ui, sans-serif';
    g.fillText(this.ctx.withdrawn ? 'You exercised your right to withdraw your data. Participation still counts.' : 'Your anonymised row now sits in the (simulated) class dataset.', W / 2, 510);
    g.fillText(`Date: ${date || new Date().toISOString().slice(0, 10)} · Seed: ${sim.seed}`, W / 2, 560);
    g.font = '16px system-ui, sans-serif'; g.fillStyle = '#475569';
    g.fillText('Simulated institution — IIBS. For learning only; this is not a record of research participation.', W / 2, 700);
    return c;
  }
  async certificate() {
    const sim = this.sim;
    if (this.auto) { sim.state.journey.participant.certificate = true; return true; }
    const c = this.certificateCanvas();
    c.style.width = '100%'; c.style.borderRadius = '8px';
    const dl = () => {
      const save = (blob) => { download('zehn_participation_certificate.png', blob, 'image/png'); sim.bus.emit('export:done', { kind: 'png' }); };
      if (c.toBlob) c.toBlob((b) => b && save(b), 'image/png');
    };
    const printIt = () => { try { require('./scoring.js').printCanvas(c); sim.bus.emit('export:done', { kind: 'print' }); } catch (e) { /* print optional */ } };
    await modal({ title: 'Step 12 — Your participation certificate', body: h('div', null, c, h('div', { class: 'row' }, btn('Download PNG', dl, 'teal'), btn('Print', printIt, 'ghost'))), actions: [{ label: 'Finish the journey', value: true }], dismissable: false });
    sim.state.journey.participant.certificate = true;
    return true;
  }
}

/** Extract the block's headline measure from a runner result (stats if present, else rows). */
function measure(id, res) {
  if (!res) return NaN;
  const st = (res.summary && res.summary.stats) || {};
  const rows = (res.rows || []).filter((r) => r.block !== 'practice');
  const ok = (r) => String(r.correct) === '1' || r.correct === true;
  if (id === 'stroop') {
    if (fin(st.interference)) return st.interference;
    const rt = (c) => mean(rows.filter((r) => r.condition === c && ok(r)).map((r) => +r.rt_ms).filter(fin));
    return rt('incongruent') - rt('congruent');
  }
  if (id === 'visual_search') {
    const v = [st.conjunction_present_slope, st.conjunction_absent_slope].filter(fin);
    if (v.length) return mean(v);
    return NaN;
  }
  if (id === 'serial_position') {
    for (const k of ['recall_pct', 'recallPct', 'overall', 'recall', 'meanRecall', 'accuracy']) if (fin(st[k])) return st[k] <= 1 ? st[k] * 100 : st[k];
    if (rows.length) return 100 * mean(rows.map((r) => (ok(r) ? 1 : 0)));
  }
  return NaN;
}

module.exports = { Journey, measure, BLOCKS };
