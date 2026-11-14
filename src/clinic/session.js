'use strict';
/**
 * Clinic UI (A12) — service `sim.services.clinic`.
 *
 *   clinic.startSession(clientId?) → Promise<summary|null>
 *       client picker (respects sim.settings.contentWarnings) → full-screen counselling session with a
 *       SIMULATED, FICTIONAL client → end-of-session supervision report (print / download .md).
 *   clinic.startJourney() → Promise<boolean>
 *       "A Client's First Session" (simulated): waiting room → intake → consent & limits of
 *       confidentiality → session → referral information. Emits 'journey:step' {journey:'client', step}.
 *
 * Events: 'client:turn' {clientId, score, skill, step}, 'client:session:end' {clientId, score, max, pct, riskHandled, completed, textPath}.
 * Safety (docs/ETHICS_SAFETY.md): never diagnoses or screens the player, never claims to be therapy,
 * screeners appear only as totals for the fictional client, content warnings offer a text-and-quiz path.
 * Crisis phrases typed anywhere are handled by the global crisis watcher (A7, src/ai/crisis.js).
 */
const { h, btn, modal, toast, download, esc } = require('../ui/dom.js');
const face2d = require('../people/face2d.js');
const E = require('./engine.js');

const STYLE_ID = 'zehn-clinic-style';
const CSS = `
.modal.clinic-full { width: min(1180px, 100%); max-height: calc(100vh - 24px); padding: 14px 18px; }
.clinic-banner { background: var(--saffron); color: #1b1300; font-weight: 800; letter-spacing: .04em; text-align: center; padding: 6px 10px; border-radius: 8px; margin-bottom: 10px; }
.clinic-banner small { display: block; font-weight: 600; letter-spacing: 0; }
.clinic-grid { display: grid; grid-template-columns: minmax(240px, 320px) 1fr; gap: 16px; }
@media (max-width: 760px) { .clinic-grid { grid-template-columns: 1fr; } }
.clinic-portrait canvas { width: 100%; max-width: 320px; aspect-ratio: 300 / 330; border-radius: 12px; border: 1px solid var(--line); background: #2a2552; display: block; }
.clinic-who { font-weight: 700; margin: 6px 0 2px; }
.clinic-meta { color: var(--muted); font-size: .9em; }
.clinic-meter { margin-top: 8px; font-size: .85em; color: var(--muted); }
.clinic-bar { position: relative; height: 10px; background: rgba(255,255,255,.08); border-radius: 6px; margin: 3px 0 6px; overflow: hidden; }
.clinic-bar > i { position: absolute; top: 0; bottom: 0; background: var(--teal-hi); border-radius: 6px; transition: all .4s; }
.clinic-bar.val > i { background: var(--saffron); }
.clinic-screen { margin-top: 8px; padding: 8px; border: 1px dashed var(--line); border-radius: 8px; font-size: .85em; }
.clinic-utter { min-height: 4.5em; font-size: 1.12em; line-height: 1.45; padding: 12px 14px; background: var(--glass-2); border-radius: 12px; border: 1px solid var(--line); cursor: pointer; }
.clinic-opts { display: grid; gap: 8px; margin-top: 12px; }
.clinic-opts .btn { text-align: left; white-space: normal; line-height: 1.35; padding: 10px 12px; }
.clinic-opts .btn kbd { display: inline-block; min-width: 1.4em; text-align: center; margin-right: 8px; background: var(--indigo-3); border-radius: 4px; padding: 0 4px; }
.clinic-note { margin-top: 12px; padding: 10px 12px; border-left: 4px solid var(--teal-hi); background: rgba(15,118,110,.15); border-radius: 8px; }
.clinic-note.poor { border-left-color: var(--bad); background: rgba(159,18,57,.18); }
.clinic-tag { display: inline-block; font-size: .78em; padding: 1px 8px; border-radius: 99px; background: var(--indigo-3); margin-right: 6px; }
.clinic-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 10px; font-size: .9em; color: var(--muted); }
.clinic-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; max-height: 60vh; overflow-y: auto; padding: 2px; }
.clinic-card { text-align: left; white-space: normal; display: block; padding: 10px 12px; line-height: 1.35; }
.clinic-card b { display: block; }
.clinic-card .cw { display: inline-block; font-size: .75em; padding: 0 6px; margin: 4px 4px 0 0; border-radius: 99px; background: rgba(245,158,11,.25); color: var(--chalk); }
.clinic-card .fam { font-size: .8em; color: var(--teal-hi); text-transform: uppercase; letter-spacing: .05em; }
.clinic-report table { border-collapse: collapse; width: 100%; margin: 6px 0; }
.clinic-report td, .clinic-report th { border-bottom: 1px solid var(--line); padding: 4px 6px; text-align: left; }
.clinic-report h3 { margin: 12px 0 4px; font-size: 1.02em; }
.clinic-check label { display: block; padding: 6px 4px; }
`;

const CW_TOPIC_KEY = (t) => {
  const s = String(t).toLowerCase();
  if (/suicid/.test(s)) return 'suicide';
  if (/self.?harm/.test(s)) return 'self-harm';
  if (/abuse/.test(s)) return 'abuse';
  if (/trauma/.test(s)) return 'trauma';
  return s;
};
const VOWEL_VISEME = { a: 'A', e: 'E', i: 'E', y: 'E', o: 'O', u: 'U', m: 'M', b: 'M', p: 'M', f: 'F', v: 'F' };
const CONF_STATEMENTS = [
  { text: 'If I believe you are at serious risk of harming yourself, I may need to share information to keep you safe.', correct: true },
  { text: 'If someone else, such as a child or vulnerable adult, is at risk of harm or abuse (safeguarding), I must act and may share information.', correct: true },
  { text: 'If a court orders it or the law requires it, I may have to disclose information.', correct: true },
  { text: 'Everything you say here stays secret, no matter what.', correct: false },
  { text: 'Your family will be told what you say in each session.', correct: false },
  { text: 'Your employer or college can ask for your session notes and I will send them.', correct: false },
];

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  document.head.appendChild(h('style', { id: STYLE_ID }, CSS));
}

function clientIndex(list, id) { const i = list.findIndex((c) => c.id === id); return i < 0 ? 0 : i; }

/** Deterministic portrait look for a client, consistent with gender and age. */
function clientLook(client, i) {
  const L = Object.assign({}, face2d.look(i + 3));
  if (client.gender === 'F') { L.beard = false; L.cap = null; if (!L.hijab && i % 2 === 0) L.hijab = ['#9F1239', '#1E1B4B', '#0F766E', '#7c2d12'][i % 4]; }
  else { L.hijab = null; L.beard = client.age >= 30 && i % 3 !== 0; }
  if (client.age >= 50) L.hair = '#8a8a8a';
  return L;
}

/** Markdown supervision report (also used for print). */
function reportMarkdown(client, s, transcript, scr) {
  const pctTxt = Math.round(Math.max(0, s.pct) * 100) + '%';
  const L = [];
  L.push(`# Supervision report — SIMULATION`, '', `> Fictional client in a teaching game. This is not therapy and not an assessment of you.`, '');
  L.push(`- **Client:** ${client.name}, ${client.age}, ${client.gender} — ${client.setting}`);
  L.push(`- **Presenting concern (simulated):** ${client.presenting}`);
  L.push(`- **Session:** ${s.turns} turn(s)${s.completed ? '' : ' (ended early)'} · micro-skill score ${s.total}/${s.max} (${pctTxt})`, '');
  L.push('## OARS counts', '', '| Open | Affirm | Reflect | Summarise |', '|---|---|---|---|', `| ${s.oars.open} | ${s.oars.affirm} | ${s.oars.reflect} | ${s.oars.summarise} |`, '');
  L.push("## Rogers' core conditions (estimated from your choices, 0–1)", '', `- Empathy: ${s.rogers.empathy}`, `- Unconditional positive regard: ${s.rogers.unconditionalRegard}`, `- Congruence: ${s.rogers.congruence}`, '');
  L.push('## Strengths', '', ...s.strengths.map((x) => '- ' + x), '', '## Growth areas', '', ...s.growth.map((x) => '- ' + x), '');
  L.push('## Risk handling', '', s.riskCase ? (s.riskHandled ? '- Risk case: you asked directly about risk and moved to safety planning / referral.' : s.riskAsked ? '- Risk case: you asked about risk, but no safety plan or referral followed.' : '- Risk case: the risk disclosure was not followed by a direct question about thoughts, plan and intent.') : '- No risk disclosure in this case.', '');
  L.push('## Supervisor note', '', client.supervision, '', '## Referral information', '', client.referral, '');
  if (scr && (scr.phq9 || scr.gad7)) {
    L.push('## Simulated screener totals (fictional client only)', '');
    if (scr.phq9) L.push(`- PHQ-9 total: ${scr.phq9.total}/${scr.phq9.max} (${scr.phq9.band} range)`);
    if (scr.gad7) L.push(`- GAD-7 total: ${scr.gad7.total}/${scr.gad7.max} (${scr.gad7.band} range)`);
    L.push('', `_${scr.note}_`, '');
  }
  L.push('## Transcript', '');
  for (const t of transcript) {
    L.push(`**${t.step}. Client:** ${t.client}`, '', `**Counsellor:** ${t.text}`, '', `_Supervisor (${E.SKILL_LABEL[t.skill] || t.skill}, ${t.score >= 0 ? '+' : ''}${t.score}):_ ${t.feedback}`, '');
  }
  L.push('---', 'ZEHN Clinic · simulated clients only · see DSM-5-TR / ICD-11 for official criteria. If anything here affected you personally, the crisis-resource card is in Settings.');
  return L.join('\n');
}

class Clinic {
  constructor(sim) {
    this.sim = sim;
    this.clients = (sim && sim.data && sim.data.clients) || [];
    this.active = null;
    if (sim && sim.state && !sim.state.clinic) sim.state.clinic = {};
    ensureStyle();
  }

  emit(name, payload) { try { this.sim.bus && this.sim.bus.emit(name, payload); } catch (e) { /* listeners must not break the session */ } }

  /** Content preference for a topic: 'ask' | 'show' | 'skip'. Default 'ask' (warnings on for every topic). */
  cwPref(topic) {
    const cw = this.sim.settings && this.sim.settings.contentWarnings;
    if (typeof cw === 'string') return cw;
    const k = CW_TOPIC_KEY(topic);
    return (cw && (cw[k] || cw[topic])) || 'ask';
  }
  isHidden(client) { return (client.contentWarning || []).some((t) => this.cwPref(t) === 'skip'); }

  client(id) { return this.clients.find((c) => c.id === id) || null; }

  /** Gentle starter client for the journey (adjustment/stress, no content warnings). */
  gentleClient() {
    return this.clients.find((c) => c.family === 'adjustment' && !(c.contentWarning || []).length)
      || this.clients.find((c) => c.family === 'stress' && !(c.contentWarning || []).length)
      || this.clients.find((c) => !(c.contentWarning || []).length) || this.clients[0];
  }

  // ---------------------------------------------------------------- picker
  pickClient() {
    ensureStyle();
    const st = this.sim.state.clinic || {};
    const visible = this.clients.filter((c) => !this.isHidden(c));
    const hidden = this.clients.filter((c) => this.isHidden(c));
    const families = ['all'].concat(E.FAMILIES.filter((f) => this.clients.some((c) => c.family === f)));
    return modal({
      title: 'Clinic — choose a simulated client',
      cls: 'clinic-full',
      actions: [{ label: 'Cancel', value: null }],
      body: h('div', null,
        h('div', { class: 'clinic-banner' }, 'SIMULATION — fictional clients', h('small', null, 'A counselling-skills practice game. Not therapy, and nothing here assesses you.')),
        h('p', { class: 'clinic-meta' }, 'Pick a client to practise micro-skills (OARS: open questions, affirmations, reflections, summaries). Use keys 1–3 to reply during the session.')),
      onMount: (box, close) => {
        const grid = h('div', { class: 'clinic-cards' });
        const render = (fam) => {
          grid.innerHTML = '';
          for (const c of visible.filter((x) => fam === 'all' || x.family === fam)) {
            const rec = st[c.id];
            grid.appendChild(btn(h('span', null,
              h('span', { class: 'fam' }, c.family), h('b', null, c.name), h('span', { class: 'clinic-meta' }, `${c.age}, ${c.gender} · ${c.setting.split(' - ')[0]}`),
              h('span', { style: { display: 'block', marginTop: '4px' } }, c.presenting.length > 150 ? c.presenting.slice(0, 147) + '…' : c.presenting),
              (c.contentWarning || []).map((w) => h('span', { class: 'cw', title: 'Content note' }, 'CN: ' + w)),
              rec && rec.completed ? h('span', { class: 'cw', style: { background: 'rgba(52,211,153,.25)' } }, `done ${rec.best}/${rec.max}`) : rec && rec.textPath ? h('span', { class: 'cw' }, 'text path done') : rec && rec.deferred ? h('span', { class: 'cw' }, 'deferred') : null),
            () => close(c.id), 'clinic-card', { 'aria-label': `${c.name}, ${c.family}` }));
          }
        };
        const sel = h('select', { 'aria-label': 'Filter by presenting family', onchange: () => render(sel.value) }, families.map((f) => h('option', { value: f }, f === 'all' ? 'All families' : f)));
        const acts = box.querySelector('.actions');
        box.insertBefore(h('label', { class: 'clinic-row' }, 'Family: ', sel), acts);
        box.insertBefore(grid, acts);
        if (hidden.length) {
          box.insertBefore(h('div', { class: 'clinic-row' },
            h('span', null, `${hidden.length} client(s) hidden by your content settings. Text-and-quiz versions (same learning goals and credit):`),
            hidden.map((c) => btn(`${c.name.replace(' (fictional)', '')} — text version`, () => close('text:' + c.id), 'ghost'))), acts);
        }
        render('all');
      },
    });
  }

  /** Content gate → 'session' | 'text' | null (cancelled / deferred). */
  async gate(client) {
    const cws = client.contentWarning || [];
    if (!cws.length) return 'session';
    if (this.isHidden(client)) {
      const v = await modal({ title: 'Text-and-quiz version', body: h('p', null, `Your content settings use the text-only path for: ${cws.join(', ')}. You can read this case and answer a short quiz instead. It gives the same learning goals, XP and mission credit.`),
        actions: [{ label: 'Cancel', value: null }, { label: 'Open the text version', value: 'text' }] });
      return v;
    }
    if (cws.every((t) => this.cwPref(t) === 'show')) return 'session';
    const v = await modal({
      title: 'Content note',
      body: h('div', null, h('p', null, h('b', null, 'This simulated session includes: '), cws.join(', '), '.'),
        h('p', null, 'The client is fictional. You can continue, use the text-and-quiz version (same learning goals and credit), or skip for now; skipping marks it "deferred", not failed.'),
        h('p', { class: 'clinic-meta' }, 'If this topic is close to home, the crisis-resource card is always in Settings.')),
      actions: [{ label: 'Skip for now', value: 'skip' }, { label: 'Text-and-quiz version', value: 'text' }, { label: 'Continue', value: 'session' }],
    });
    if (v === 'skip') {
      this.sim.state.clinic[client.id] = Object.assign({}, this.sim.state.clinic[client.id], { deferred: true });
      toast('Marked as deferred. You can return to this client any time.');
      return null;
    }
    return v;
  }

  // ---------------------------------------------------------------- entry
  async startSession(clientId, opts = {}) {
    if (this.active) { toast('A clinic session is already open.'); return null; }
    let id = clientId;
    if (!id) {
      id = await this.pickClient();
      if (!id) return null;
      if (String(id).startsWith('text:')) return this.textPath(this.client(id.slice(5)));
    }
    const client = this.client(id);
    if (!client) { toast('Unknown client ' + id); return null; }
    const how = opts.skipGate ? 'session' : await this.gate(client);
    if (how === 'text') return this.textPath(client);
    if (how !== 'session') return null;
    return this.runSession(client, opts);
  }

  // ---------------------------------------------------------------- text-and-quiz alternative
  async textPath(client) {
    if (!client) return null;
    const eng = new E.SessionEngine(client);
    const qs = [];
    while (!eng.done && qs.length < 3) { const n = eng.node; qs.push(n); eng.choose(E.bestIndex(n)); }
    const body = h('div', { class: 'clinic-report' },
      h('div', { class: 'clinic-banner' }, 'SIMULATION — fictional client · text version'),
      h('p', null, h('b', null, client.name), ` — ${client.age}, ${client.gender}, ${client.setting}`),
      h('p', null, h('b', null, 'Presenting (simulated): '), client.presenting),
      h('p', null, h('b', null, 'Background: '), client.background),
      h('p', null, h('b', null, 'Cultural note: '), client.culturalNote),
      h('h3', null, 'Quiz: which reply best fits?'),
      qs.map((n, qi) => h('fieldset', { class: 'clinic-check' }, h('legend', null, `${qi + 1}. Client: “${n.client}”`),
        n.options.map((o, oi) => h('label', null, h('input', { type: 'radio', name: `cq${qi}`, value: String(oi) }), ' ', o.text)))));
    const answers = await modal({ title: 'Clinic — text-and-quiz version', cls: 'clinic-full', body, dismissable: false,
      actions: [{ label: 'Submit answers', value: (box) => qs.map((_, qi) => { const r = box.querySelector(`input[name="cq${qi}"]:checked`); return r ? +r.value : -1; }) }] });
    let correct = 0;
    const fb = qs.map((n, qi) => {
      const b = E.bestIndex(n), a = answers ? answers[qi] : -1;
      if (a === b) correct++;
      const chosen = n.options[a];
      return h('li', null, h('b', null, a === b ? 'Best reply. ' : 'Better reply: '), n.options[b].text, h('br'), h('span', { class: 'clinic-meta' }, (chosen ? chosen.feedback : 'No answer selected.') + (a !== b ? ' Best: ' + n.options[b].feedback : '')));
    });
    await modal({ title: `Text version — ${correct}/${qs.length}`, cls: 'clinic-full',
      body: h('div', { class: 'clinic-report' }, h('ol', null, fb), h('h3', null, 'Supervisor note'), h('p', null, client.supervision), h('h3', null, 'Referral information'), h('p', null, client.referral)),
      actions: [{ label: 'Done', value: true }] });
    const prev = this.sim.state.clinic[client.id] || {};
    this.sim.state.clinic[client.id] = Object.assign({}, prev, { textPath: true, quiz: `${correct}/${qs.length}`, deferred: false, last: new Date().toISOString() });
    if (this.sim.addXP) this.sim.addXP(20 + 10 * correct, 'clinic-text:' + client.id);
    this.emit('client:session:end', { clientId: client.id, score: correct, max: qs.length, pct: qs.length ? correct / qs.length : 0, riskHandled: false, completed: true, textPath: true });
    return { clientId: client.id, textPath: true, correct, of: qs.length };
  }

  // ---------------------------------------------------------------- live session
  runSession(client, opts = {}) {
    ensureStyle();
    const sim = this.sim;
    const eng = new E.SessionEngine(client);
    const scr = E.screenerTotals(client);
    const reduced = !!(sim.settings && sim.settings.reducedMotion);
    const look = clientLook(client, clientIndex(this.clients, client.id));
    const gradeOn = () => !!(sim.settings && sim.settings.emotionGrade && sim.services && sim.services.engine && sim.services.engine.setEmotionGrade);
    const setGrade = (a) => { try { if (gradeOn()) sim.services.engine.setEmotionGrade(a); } catch (e) { /* engine optional */ } };
    let honours = sim.state && sim.state.difficulty === 'honours';
    const hiddenNotes = [];

    // animation state
    const anim = { aus: {}, gaze: { x: 0, y: 0 }, gazeT: { x: 0, y: 0 }, nextGaze: 0, blinkAt: 1.5, blinkStart: -1, emotion: 'neutral', typing: null, viseme: 'rest', raf: 0, last: 0, t: 0, alive: true };

    // DOM
    const canvas = h('canvas', { width: 600, height: 660, 'aria-label': `Animated portrait of ${client.name}, a simulated client`, role: 'img' });
    const ctx = canvas.getContext ? canvas.getContext('2d') : null;
    const valBar = h('i'), aroBar = h('i');
    const affectTxt = h('span');
    const utter = h('div', { class: 'clinic-utter', 'aria-live': 'polite', title: 'Click to show the full reply' });
    const optsBox = h('div', { class: 'clinic-opts', role: 'group', 'aria-label': 'Your reply options' });
    const noteBox = h('div', { 'aria-live': 'polite' });
    const stepTxt = h('span');
    const honoursBox = h('input', { type: 'checkbox', checked: honours, onchange: () => { honours = honoursBox.checked; } });

    const screenerEl = (scr.phq9 || scr.gad7) ? h('div', { class: 'clinic-screen' },
      h('b', null, 'Simulated screener totals'), h('br'),
      scr.phq9 ? h('span', null, `PHQ-9: ${scr.phq9.total}/${scr.phq9.max} (${scr.phq9.band} range)`, h('br')) : null,
      scr.gad7 ? h('span', null, `GAD-7: ${scr.gad7.total}/${scr.gad7.max} (${scr.gad7.band} range)`, h('br')) : null,
      h('span', { class: 'clinic-meta' }, scr.note)) : null;

    const body = h('div', null,
      h('div', { class: 'clinic-banner', role: 'note' }, 'SIMULATION — fictional client', h('small', null, 'Counselling-skills practice. Not therapy. Nothing here assesses or diagnoses you.')),
      h('div', { class: 'clinic-grid' },
        h('div', { class: 'clinic-portrait' }, canvas,
          h('div', { class: 'clinic-who' }, client.name),
          h('div', { class: 'clinic-meta' }, `${client.age}, ${client.gender} · ${client.family} · ${client.setting}`),
          h('div', { class: 'clinic-meter', role: 'group', 'aria-label': 'Simulated client affect' },
            'Client mood (simulated) — valence', h('div', { class: 'clinic-bar val' }, valBar), 'arousal', h('div', { class: 'clinic-bar' }, aroBar), affectTxt),
          screenerEl,
          h('details', { class: 'clinic-meta', style: { marginTop: '8px' } }, h('summary', null, 'Intake notes (simulated)'),
            h('p', null, client.presenting), h('p', null, client.background), h('p', null, client.culturalNote))),
        h('div', null,
          h('div', { class: 'clinic-row', style: { marginTop: 0 } }, stepTxt,
            h('label', null, honoursBox, ' Honours: hide supervisor notes until the end')),
          utter, optsBox, noteBox,
          h('p', { class: 'clinic-meta', style: { marginTop: '10px' } }, 'Keys 1–3 reply · Enter continues · click the client text to skip typing.'))));

    const updateMeter = () => {
      const a = eng.affectAt(eng.step);
      const v = a.valence;
      valBar.style.left = (v < 0 ? 50 + 50 * v : 50) + '%';
      valBar.style.width = Math.abs(50 * v) + '%';
      aroBar.style.left = '0%'; aroBar.style.width = (100 * a.arousal) + '%';
      affectTxt.textContent = `valence ${v.toFixed(2)}, arousal ${a.arousal.toFixed(2)}`;
      setGrade({ valence: a.valence, arousal: a.arousal });
    };

    let closeFn = null;
    let phase = 'typing'; // typing | choose | note | done
    let opts3 = [];

    const finishTyping = () => { if (anim.typing) { anim.typing.i = anim.typing.text.length; utter.textContent = anim.typing.text; anim.typing = null; anim.viseme = 'rest'; } if (phase === 'typing') { phase = 'choose'; enableOptions(true); } };
    utter.addEventListener('click', finishTyping);
    const enableOptions = (on) => { for (const b of opts3) b.disabled = !on; if (on && opts3[0]) try { opts3[0].focus(); } catch (e) { /* focus optional */ } };

    const showNode = () => {
      const n = eng.node;
      if (!n) return finish();
      stepTxt.textContent = `Turn ${eng.step + 1}`;
      anim.emotion = E.FACE_EMOTION[n.emotion] || 'neutral';
      noteBox.innerHTML = '';
      optsBox.innerHTML = '';
      opts3 = n.options.map((o, i) => btn(h('span', null, h('kbd', null, String(i + 1)), o.text), () => pick(i), '', { 'aria-label': `Reply ${i + 1}: ${o.text}` }));
      opts3.forEach((b) => optsBox.appendChild(b));
      phase = 'typing';
      enableOptions(false);
      if (reduced) { anim.typing = null; utter.textContent = n.client; phase = 'choose'; enableOptions(true); }
      else { utter.textContent = ''; anim.typing = { text: n.client, i: 0, acc: 0 }; }
    };

    const pick = (i) => {
      if (phase === 'typing') finishTyping();
      if (phase !== 'choose' || !eng.node || !eng.node.options[i]) return;
      const r = eng.choose(i);
      phase = 'note';
      opts3.forEach((b, j) => { b.disabled = true; if (j === i) b.classList.add('primary'); });
      this.emit('client:turn', { clientId: client.id, score: r.score, skill: r.skill, step: eng.step });
      updateMeter();
      if (eng.node) anim.emotion = E.FACE_EMOTION[eng.node.emotion] || anim.emotion;
      const tag = h('span', { class: 'clinic-tag' }, E.SKILL_LABEL[r.skill] || r.skill);
      const sc = h('span', { class: 'clinic-tag' }, (r.score >= 0 ? '+' : '') + r.score);
      if (honours) {
        hiddenNotes.push(r);
        noteBox.appendChild(h('div', { class: 'clinic-note' }, h('span', { class: 'clinic-meta' }, 'Supervisor note recorded — shown in the end-of-session report (Honours).')));
        setTimeout(() => { if (anim.alive && phase === 'note') advance(); }, reduced ? 200 : 700);
      } else {
        noteBox.appendChild(h('div', { class: 'clinic-note' + (r.score < 0 ? ' poor' : '') }, h('div', null, h('b', null, 'Supervisor: '), tag, sc), h('p', { style: { margin: '6px 0' } }, r.feedback),
          btn(eng.done ? 'See supervision report (Enter)' : 'Continue (Enter)', () => advance(), 'primary')));
        const b = noteBox.querySelector('button'); if (b) try { b.focus(); } catch (e) { /* ok */ }
      }
    };
    const advance = () => { if (phase !== 'note') return; if (eng.done) finish(); else showNode(); };
    const finish = () => { phase = 'done'; if (closeFn) closeFn('finished'); };

    const onKey = (e) => {
      if (!anim.alive) return;
      const tg = e.target && e.target.tagName;
      if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
      if (/^[1-3]$/.test(e.key)) { e.preventDefault(); pick(+e.key - 1); return; }
      if ((e.key === 'Enter' || e.key === ' ') && tg !== 'BUTTON') {
        if (phase === 'typing') { e.preventDefault(); finishTyping(); } else if (phase === 'note') { e.preventDefault(); advance(); }
      }
    };
    document.addEventListener('keydown', onKey);

    // ---- portrait animation
    const draw = (now) => {
      if (!anim.alive) return;
      const dt = Math.min(0.1, anim.last ? (now - anim.last) / 1000 : 0.016);
      anim.last = now; anim.t += dt;
      const a = eng.affectAt(eng.step);
      // typing + visemes
      if (anim.typing) {
        const ty = anim.typing;
        ty.acc += dt * 1000;
        const per = 32;
        while (ty.acc >= per && ty.i < ty.text.length) { ty.acc -= per; ty.i++; }
        utter.textContent = ty.text.slice(0, ty.i);
        const ch = (ty.text[ty.i - 1] || ' ').toLowerCase();
        anim.viseme = VOWEL_VISEME[ch] || (/[a-z]/.test(ch) ? (ty.i % 2 ? 'E' : 'rest') : 'rest');
        if (ty.i >= ty.text.length) { anim.typing = null; anim.viseme = 'rest'; if (phase === 'typing') { phase = 'choose'; enableOptions(true); } }
      }
      // emotion blend (intensity rises with distress/arousal)
      const proto = face2d.EMOTIONS[anim.emotion] || {};
      const intensity = 0.55 + 0.45 * Math.max(Math.abs(a.valence), a.arousal);
      const k = Math.min(1, dt * (reduced ? 6 : 2.5));
      const keys = new Set(Object.keys(proto).concat(Object.keys(anim.aus)));
      for (const au of keys) {
        if (au === 'unilateral') { anim.aus.unilateral = proto.unilateral || 0; continue; }
        const target = (proto[au] || 0) * intensity;
        anim.aus[au] = (anim.aus[au] || 0) + (target - (anim.aus[au] || 0)) * k;
      }
      // gaze: averted when distressed, otherwise toward the counsellor with small saccades
      const distressed = a.valence < -0.35 || anim.emotion === 'sadness' || anim.emotion === 'fear';
      if (anim.t >= anim.nextGaze) {
        const glance = Math.random() < (distressed ? 0.3 : 0.85);
        anim.gazeT = glance ? { x: (Math.random() - 0.5) * 0.25, y: (Math.random() - 0.5) * 0.15 } : { x: (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.4), y: 0.4 + Math.random() * 0.4 };
        if (anim.typing && !distressed) anim.gazeT = { x: 0, y: 0 };
        anim.nextGaze = anim.t + 1.2 + Math.random() * 2.2;
      }
      const gk = Math.min(1, dt * 8);
      anim.gaze.x += (anim.gazeT.x - anim.gaze.x) * gk; anim.gaze.y += (anim.gazeT.y - anim.gaze.y) * gk;
      // natural blinking (faster when aroused)
      let blink = 0;
      if (anim.blinkStart < 0 && anim.t >= anim.blinkAt) anim.blinkStart = anim.t;
      if (anim.blinkStart >= 0) {
        const p = (anim.t - anim.blinkStart) / 0.16;
        if (p >= 1) { anim.blinkStart = -1; anim.blinkAt = anim.t + (Math.random() < 0.15 ? 0.25 : 2 + Math.random() * 4 * (1 - 0.5 * a.arousal)); } else blink = p < 0.5 ? p * 2 : (1 - p) * 2;
      }
      if (ctx) {
        const W = canvas.width, H = canvas.height;
        ctx.clearRect(0, 0, W, H);
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#3a3470'); g.addColorStop(1, '#1e1b4b');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(245,158,11,.10)'; ctx.fillRect(W * 0.68, H * 0.08, W * 0.22, H * 0.3); // window light
        const breathe = reduced ? 0 : Math.sin(anim.t * (1.4 + a.arousal)) * 2;
        const aus = anim.viseme !== 'rest' ? face2d.mix(anim.aus, face2d.VISEMES[anim.viseme]) : anim.aus;
        face2d.drawFace(ctx, W / 2, H * 0.47 + breathe, H * 0.66, aus, Object.assign({}, look, { gaze: anim.gaze, blink }));
        ctx.fillStyle = 'rgba(245,158,11,.9)'; ctx.font = '700 22px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        ctx.fillText('SIMULATION', 14, 12);
      }
      anim.raf = requestAnimationFrame(draw);
    };

    this.active = client.id;
    const p = modal({
      title: `Clinic session — ${client.name}`, cls: 'clinic-full', body, dismissable: false,
      actions: [{ label: 'End session', value: 'end', cls: '' }],
      onMount: (box, close) => { closeFn = close; updateMeter(); showNode(); anim.raf = requestAnimationFrame(draw); },
    });
    return p.then((how) => {
      anim.alive = false;
      cancelAnimationFrame(anim.raf);
      document.removeEventListener('keydown', onKey);
      setGrade(null);
      this.active = null;
      return this.endSession(client, eng, scr, how === 'finished' || eng.done, opts);
    });
  }

  /** Record results, emit events, then show the supervision report. */
  async endSession(client, eng, scr, completed, opts = {}) {
    const sim = this.sim;
    const s = eng.summary();
    s.completed = completed;
    const prev = sim.state.clinic[client.id] || {};
    sim.state.clinic[client.id] = Object.assign({}, prev, {
      completed: completed || !!prev.completed, deferred: false, sessions: (prev.sessions || 0) + 1,
      best: Math.max(prev.best == null ? -Infinity : prev.best, s.total), max: s.max, last: new Date().toISOString(),
      riskHandled: s.riskHandled || !!prev.riskHandled, oars: s.oars,
    });
    if (completed && sim.addXP) sim.addXP(Math.max(10, Math.round(20 + 40 * Math.max(0, s.pct)) + (s.riskHandled ? 15 : 0)), 'clinic:' + client.id);
    this.emit('client:session:end', { clientId: client.id, score: s.total, max: s.max, pct: s.pct, riskHandled: s.riskHandled, completed, textPath: false });
    if (!opts.noReport) await this.showReport(client, s, eng.transcript, scr);
    return s;
  }

  showReport(client, s, transcript, scr) {
    const md = reportMarkdown(client, s, transcript, scr);
    const fileBase = `ZEHN_clinic_${client.id}_supervision`;
    const bar = (v) => h('div', { class: 'clinic-bar' }, h('i', { style: { left: '0%', width: Math.round(v * 100) + '%' } }));
    const riskLine = s.riskCase
      ? (s.riskHandled ? 'Risk case — handled: you asked directly about risk and moved to a safety plan / referral.' : s.riskAsked ? 'Risk case — partly handled: you asked about risk, but no safety plan or referral followed.' : 'Risk case — not handled: the disclosure was not followed by a direct question about thoughts, plan and intent.')
      : 'No risk disclosure in this case.';
    const printIt = () => {
      const html = `<!doctype html><meta charset="utf-8"><title>${esc(fileBase)}</title><style>body{font:14px/1.5 system-ui,sans-serif;max-width:760px;margin:24px auto;color:#111}pre{white-space:pre-wrap;font:inherit}</style><pre>${esc(md)}</pre>`;
      let w = null;
      try { w = window.open('', '_blank'); } catch (e) { w = null; }
      if (w && w.document) { w.document.write(html); w.document.close(); w.focus(); w.print(); } else window.print();
    };
    const crisisBtn = this.sim.services && this.sim.services.ui && this.sim.services.ui.showCrisis
      ? btn('Crisis-resource card', () => this.sim.services.ui.showCrisis('clinic-report'), 'ghost') : null;
    const body = h('div', { class: 'clinic-report' },
      h('div', { class: 'clinic-banner' }, 'SIMULATION — supervision report', h('small', null, 'Feedback on counselling micro-skills with a fictional client. Not an assessment of you.')),
      h('p', null, h('b', null, `${client.name}`), ` · ${s.turns} turn(s)${s.completed ? '' : ' (ended early)'} · micro-skill score `, h('b', null, `${s.total}/${s.max}`)),
      h('h3', null, 'OARS counts'),
      h('table', null, h('tr', null, ['Open', 'Affirm', 'Reflect', 'Summarise'].map((x) => h('th', null, x))), h('tr', null, [s.oars.open, s.oars.affirm, s.oars.reflect, s.oars.summarise].map((x) => h('td', null, String(x))))),
      h('h3', null, "Rogers' core conditions (estimated from your choices)"),
      [['Empathy', s.rogers.empathy], ['Unconditional positive regard', s.rogers.unconditionalRegard], ['Congruence', s.rogers.congruence]].map(([l, v]) => h('div', null, `${l}: ${v.toFixed(2)}`, bar(v))),
      h('h3', null, 'Strengths'), h('ul', null, s.strengths.map((x) => h('li', null, x))),
      h('h3', null, 'Growth areas'), h('ul', null, s.growth.map((x) => h('li', null, x))),
      h('h3', null, 'Risk handling'), h('p', null, riskLine),
      h('h3', null, 'Supervisor note'), h('p', null, client.supervision),
      h('h3', null, 'Referral information'), h('p', null, client.referral),
      (scr.phq9 || scr.gad7) ? h('p', { class: 'clinic-meta' }, [scr.phq9 ? `PHQ-9 ${scr.phq9.total}/27` : null, scr.gad7 ? `GAD-7 ${scr.gad7.total}/21` : null].filter(Boolean).join(' · ') + ' — ' + scr.note) : null,
      h('details', null, h('summary', null, `Transcript with supervisor notes (${transcript.length})`),
        h('ol', null, transcript.map((t) => h('li', null, h('div', null, h('b', null, 'Client: '), t.client), h('div', null, h('b', null, 'You: '), t.text),
          h('div', { class: 'clinic-meta' }, `${E.SKILL_LABEL[t.skill] || t.skill} (${t.score >= 0 ? '+' : ''}${t.score}) — ${t.feedback}`))))),
      h('div', { class: 'clinic-row' },
        btn('Download .md', () => download(fileBase + '.md', md, 'text/markdown'), ''),
        btn('Print', printIt, ''), crisisBtn),
      h('p', { class: 'clinic-meta' }, 'Simulated clients only. See DSM-5-TR / ICD-11 for official criteria. If anything here affected you personally, the crisis-resource card is always in Settings.'));
    return modal({ title: 'Supervision report', cls: 'clinic-full', body, actions: [{ label: 'Done', value: true }] });
  }

  // ---------------------------------------------------------------- journey
  async startJourney() {
    ensureStyle();
    const sim = this.sim;
    const client = this.gentleClient();
    const step = (n) => this.emit('journey:step', { journey: 'client', step: n });
    const banner = (t) => h('div', { class: 'clinic-banner' }, 'SIMULATION — fictional client', h('small', null, t));

    // 1. waiting room
    step(1);
    let v = await modal({ title: "A Client's First Session — 1/5 Waiting room", cls: 'clinic-full',
      body: h('div', null, banner('A walk-through of a first counselling appointment, from the counsellor\'s side.'),
        h('p', null, `The simulated clinic waiting room is quiet: a water cooler, a rack of leaflets in Urdu and English, a ceiling fan. ${client.name.replace(' (fictional)', '')} sits near the door, checking a phone and glancing at the reception desk.`),
        h('p', null, 'First impressions matter. A calm greeting, your name and role, and a clear idea of how long the session lasts help a nervous client settle.'),
        h('p', { class: 'clinic-meta' }, 'You play a trainee counsellor. The client is fictional; nothing here is therapy or assesses you.')),
      actions: [{ label: 'Leave journey', value: null }, { label: 'Go to intake', value: true }] });
    if (!v) return false;

    // 2. intake form
    step(2);
    const scr = E.screenerTotals(client);
    const row = (k, val) => h('tr', null, h('th', null, k), h('td', null, val));
    v = await modal({ title: "A Client's First Session — 2/5 Intake form", cls: 'clinic-full',
      body: h('div', { class: 'clinic-report' }, banner('Read the simulated intake form before you meet the client.'),
        h('table', null,
          row('Name', client.name), row('Age / gender', `${client.age} / ${client.gender}`), row('Setting', client.setting),
          row('Presenting concern', client.presenting), row('Background', client.background), row('Cultural note', client.culturalNote),
          scr.phq9 ? row('Simulated PHQ-9 total', `${scr.phq9.total}/27`) : null, scr.gad7 ? row('Simulated GAD-7 total', `${scr.gad7.total}/21`) : null),
        (scr.phq9 || scr.gad7) ? h('p', { class: 'clinic-meta' }, scr.note) : null),
      actions: [{ label: 'Leave journey', value: null }, { label: 'I have read the intake', value: true }] });
    if (!v) return false;

    // 3. consent & limits of confidentiality
    step(3);
    let tries = 0, passed = false;
    while (!passed) {
      const order = CONF_STATEMENTS.map((s, i) => i);
      const sel = await modal({ title: "A Client's First Session — 3/5 Consent and confidentiality", cls: 'clinic-full', dismissable: false,
        body: h('div', { class: 'clinic-check' }, banner('Explain consent and the limits of confidentiality before the session starts.'),
          h('p', null, 'Before counselling begins, the client should know what the sessions are for, that they can stop at any time, how notes are kept, and when confidentiality has limits.'),
          h('p', null, h('b', null, 'Tick every statement that is a correct limit of confidentiality to explain to the client:')),
          order.map((i) => h('label', null, h('input', { type: 'checkbox', name: 'conf', value: String(i) }), ' ', CONF_STATEMENTS[i].text))),
        actions: [{ label: 'Leave journey', value: null }, { label: 'Check', value: (box) => Array.from(box.querySelectorAll('input[name="conf"]:checked')).map((x) => +x.value) }] });
      if (sel == null) return false;
      tries++;
      const ok = CONF_STATEMENTS.every((s, i) => s.correct === sel.includes(i));
      if (ok) { passed = true; toast('Correct: risk of harm, safeguarding and legal requirements are the limits to explain.'); break; }
      const missed = CONF_STATEMENTS.filter((s, i) => s.correct && !sel.includes(i)).length;
      const wrong = CONF_STATEMENTS.filter((s, i) => !s.correct && sel.includes(i)).length;
      if (tries >= 2) {
        await modal({ title: 'The limits of confidentiality', body: h('div', null, h('p', null, 'Confidentiality is the default, with three limits to explain at the start:'),
          h('ul', null, CONF_STATEMENTS.filter((s) => s.correct).map((s) => h('li', null, s.text))),
          h('p', null, 'Promising total secrecy is a promise you may not be able to keep; sharing with family or an employer needs the client\'s consent.')),
        actions: [{ label: 'Continue to the session', value: true }] });
        passed = true;
      } else {
        await modal({ title: 'Not quite', body: h('p', null, `${missed ? `You missed ${missed} correct limit(s). ` : ''}${wrong ? `${wrong} ticked statement(s) are not limits of confidentiality. ` : ''}Think about harm to the client, harm to others, and the law.`), actions: [{ label: 'Try again', value: true }] });
      }
    }

    // 4. session
    step(4);
    const summary = await this.startSession(client.id, { skipGate: true, journey: true });

    // 5. referral information
    step(5);
    await modal({ title: "A Client's First Session — 5/5 Referral information", cls: 'clinic-full',
      body: h('div', { class: 'clinic-report' }, banner('Ending well: next steps and referral.'),
        h('h3', null, `Referral plan for ${client.name}`), h('p', null, client.referral),
        h('h3', null, 'Why referral information matters'),
        h('ul', null,
          h('li', null, 'Counsellors work within their competence and refer on when a client needs assessment or treatment they cannot provide.'),
          h('li', null, 'Referral is collaborative: explain why, check the client\'s worries, and keep the relationship going.'),
          h('li', null, 'Every client leaves knowing how to reach crisis services. In ZEHN these are on the crisis-resource card in Settings (hours may vary — verify before calling).')),
        summary && summary.total != null ? h('p', { class: 'clinic-meta' }, `Your session micro-skill score: ${summary.total}/${summary.max}.`) : null,
        this.sim.services && this.sim.services.ui && this.sim.services.ui.showCrisis ? btn('Open the crisis-resource card', () => this.sim.services.ui.showCrisis('clinic-journey'), 'ghost') : null),
      actions: [{ label: 'Finish journey', value: true }] });
    sim.state.journey = sim.state.journey || {};
    sim.state.journey.client = { done: true, at: new Date().toISOString(), clientId: client.id };
    if (sim.addXP) sim.addXP(50, 'journey:client');
    this.emit('journey:complete', { journey: 'client' });
    return true;
  }
}

module.exports = { Clinic, reportMarkdown, clientLook, CONF_STATEMENTS };
