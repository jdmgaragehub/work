'use strict';
/**
 * GameDirector (A9) — dilemma cards and the IRB chamber.
 *
 *   const director = new Director(sim)                 // sim.services.director
 *   director.presentDilemma(id?, {choice?, silent?})    // modal card, visible trade-offs, 3 options → result
 *   director.presentIRB(id?, {decision?, silent?})      // IRB hearing: approve / revise / reject → reasons + codes
 *   director.allDilemmas() / director.allIRB()          // [{id, title, ...seen}] for e2e
 *   director.resolveAllDilemmas({choice:'best'|'worst'|n}) / director.judgeAllIRB({policy:'correct'|'approve'})  // headless e2e sweeps
 *   director.setAuto(bool)                              // contextual scheduling on/off
 *
 * Passing `choice` / `decision` resolves without UI (used by tests and the A0 __zehnTest hooks).
 * Scheduling: after a player's exp:complete or a zone:enter, at most one card every `cooldownMs`
 * (default 4 min, first not before 90 s), never during an experiment, modal, tour, journey or
 * participant/photo mode. Auto-scheduling is off under automation (navigator.webdriver) unless
 * ?dilemmas=on; ?dilemmas=off disables it.
 * Difficulty: Foundation shows hints; Honours hides IRB risk lists and adds confound-spotting prompts.
 */
const L = require('./logic.js');
const { h, btn, modal, toast, anyModalOpen } = require('../ui/dom.js');
const { injectCSS } = require('./scoring.js');

const EFFECTS = [['rigour', 'Rigour'], ['ethics', 'Ethics'], ['time', 'Time'], ['welfare', 'Participant welfare']];
const CSS = `
.zg-dilemma .zg-opts{display:grid;gap:10px;margin-top:10px}
.zg-opt{background:rgba(255,255,255,.05);border:1px solid var(--line,#444);border-radius:12px;padding:10px 12px}
.zg-opt h4{margin:0 0 6px;font-size:.95em}
.zg-bars{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 14px;margin:6px 0 8px}
.zg-bar{display:grid;grid-template-columns:96px 1fr 26px;gap:6px;align-items:center;font-size:.76em}
.zg-track{position:relative;height:9px;background:rgba(255,255,255,.08);border-radius:5px}
.zg-track::after{content:'';position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:rgba(255,255,255,.4)}
.zg-fill{position:absolute;top:0;bottom:0;border-radius:5px}
.zg-fill.pos{left:50%;background:#009E73}.zg-fill.neg{right:50%;background:#D55E00}
body.cbsafe .zg-fill.pos{background:#56B4E9}body.cbsafe .zg-fill.neg{background:#E69F00}
.zg-irb dl{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:.9em}.zg-irb dt{color:#fde68a}
.zg-codes{display:flex;flex-wrap:wrap;gap:5px}
.zg-verdict{font-weight:700;font-size:1.1em}.zg-verdict.ok{color:var(--ok,#34d399)}.zg-verdict.bad{color:var(--warn,#f59e0b)}
`;
const KIND_LABEL = { irb: 'Ethics board', clinic: 'Clinic', social: 'Social', replication: 'Replication', research: 'Research', data: 'Data', forensic: 'Forensic', io: 'I-O' };
const DECISIONS = [['approve', 'Approve'], ['revise', 'Return for revision'], ['reject', 'Reject']];

class Director {
  constructor(sim) {
    this.sim = sim;
    this.cooldownMs = 240000;
    this.busy = false;
    this._timer = null;
    const st = sim.state;
    if (!st.dilemmas || typeof st.dilemmas !== 'object') st.dilemmas = {};
    if (!st.irb || typeof st.irb !== 'object') st.irb = {};
    const now = this._now();
    this.lastAt = now - this.cooldownMs + 90000; // first card no sooner than 90 s in
    this.auto = this._autoDefault();
    this.offs = [
      sim.bus.on('exp:complete', (p) => { if (!p.bot && !p.alt) this.consider('exp', { paradigm: p.paradigm }); }),
      sim.bus.on('zone:enter', (p) => this.consider('zone', { zone: p.zone })),
    ];
  }

  _now() { return typeof performance !== 'undefined' ? performance.now() : Date.now(); }
  _autoDefault() {
    const p = this.sim.params && this.sim.params.get ? this.sim.params.get('dilemmas') : null;
    if (p === 'off') return false;
    if (p === 'on') return true;
    if (typeof navigator !== 'undefined' && navigator.webdriver) return false;
    return this.sim.settings.autoDilemmas !== false;
  }
  setAuto(on) { this.auto = !!on; this.sim.settings.autoDilemmas = !!on; if (this.sim.saveSettings) this.sim.saveSettings(); }
  get difficulty() { return this.sim.state.difficulty || 'bachelor'; }
  _rng() { const r = this.sim.rng; return r && r.random ? () => r.random() : Math.random; }

  /** Can a card appear right now? */
  canInterrupt() {
    const s = this.sim.services;
    return !this.busy && L.canInterrupt({
      now: this._now(), last: this.lastAt, cooldownMs: this.cooldownMs,
      experiment: !!(s.runner && s.runner.active), modal: anyModalOpen(), mode: this.sim.state.mode,
      journey: !!(s.journey && s.journey.active), tour: !!(s.tour && s.tour.active),
    }) && !(typeof document !== 'undefined' && document.hidden);
  }

  consider(reason, ctx = {}) {
    if (!this.auto || this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = null;
      if (!this.canInterrupt()) return;
      if (reason === 'zone' && ctx.zone === 'courtyard') return;
      let zone = ctx.zone || this.sim.state.zone;
      if (ctx.paradigm) { const sp = this.sim.registry.paradigms.get(ctx.paradigm); if (sp && sp.zone) zone = sp.zone; }
      // Library visits alternate between the IRB chamber and dilemma cards.
      if (zone === 'library' && this._rng()() < 0.4) this.presentIRB();
      else this.presentDilemma(null, { zone });
    }, reason === 'exp' ? 2500 : 4000);
  }

  // ---------------------------------------------------------------- dilemmas
  allDilemmas() { return this.sim.data.dilemmas.map((d) => ({ id: d.id, title: d.title, kind: d.kind, week: d.week, seen: !!this.sim.state.dilemmas[d.id] })); }
  allIRB() { return this.sim.data.irb.map((p) => ({ id: p.id, title: p.title, correct: p.correct, judged: !!this.sim.state.irb[p.id] })); }

  _tradeoffBars(effects) {
    return h('div', { class: 'zg-bars' }, EFFECTS.map(([k, label]) => {
      const v = (effects && effects[k]) || 0;
      const w = Math.min(50, (Math.abs(v) / 3) * 50);
      return h('div', { class: 'zg-bar', role: 'img', 'aria-label': `${label} ${v > 0 ? '+' : ''}${v}` },
        h('span', null, label), h('div', { class: 'zg-track' }, h('div', { class: 'zg-fill ' + (v >= 0 ? 'pos' : 'neg'), style: { width: w + '%' } })), h('b', null, (v > 0 ? '+' : '') + v));
    }));
  }

  async presentDilemma(id, opts = {}) {
    const sim = this.sim;
    const d = id ? sim.data.dilemmas.find((x) => x.id === id) : L.pickDilemma(sim.data.dilemmas, { week: sim.state.week || 16, zone: opts.zone || sim.state.zone, seen: sim.state.dilemmas, rng: this._rng() });
    if (!d) return null;
    const headless = opts.choice != null;
    let idx = opts.choice;
    this.busy = true;
    try {
      if (!headless) {
        injectCSS('zg-dir-css', CSS);
        const diff = this.difficulty;
        const body = h('div', { class: 'zg-dilemma' },
          h('div', { class: 'row' }, h('span', { class: 'tag' }, KIND_LABEL[d.kind] || d.kind), h('span', { class: 'tag' }, 'Week ' + d.week), h('span', { class: 'tag apa' }, 'APA ' + d.apa), h('span', { class: 'tag dom' }, d.domain)),
          h('p', null, d.text),
          diff === 'foundation' ? h('p', { class: 'note' }, 'Hint: weigh all four bars. The best choice protects participants without throwing away the science; an ethics penalty costs XP and lowers APA Goal 3.') : null,
          h('p', { class: 'note' }, 'Trade-offs: rigour · ethics · time · participant welfare (−3 … +3).'));
        const optsHost = h('div', { class: 'zg-opts' });
        body.appendChild(optsHost);
        idx = await modal({
          title: 'Dilemma — ' + d.title, body, cls: 'zg-dilemma-modal',
          actions: [{ label: 'Decide later', value: null, cls: 'ghost' }],
          onMount: (box, close) => {
            d.options.forEach((o, i) => optsHost.appendChild(h('div', { class: 'zg-opt' },
              h('h4', null, String.fromCharCode(65 + i) + '. ' + o.label), this._tradeoffBars(o.effects),
              btn('Choose ' + String.fromCharCode(65 + i), () => close(i), i === 0 ? 'teal' : '', { 'data-option': i }))));
          },
        });
        if (idx == null) { this.lastAt = this._now() - this.cooldownMs / 2; return null; }
      }
      const r = L.resolveDilemma(d, idx, this.difficulty);
      sim.state.dilemmas[d.id] = { option: idx, ethicsPenalty: r.ethicsPenalty, at: new Date().toISOString() };
      if (r.ethicsPenalty) this._penalise(d.title);
      else sim.addXP(r.xp, 'Dilemma: ' + d.title);
      this.lastAt = this._now();
      sim.bus.emit('dilemma:resolved', { id: d.id, option: idx, ethicsPenalty: r.ethicsPenalty });
      if (!headless && !opts.silent) {
        const best = d.options[r.best];
        await modal({
          title: r.ethicsPenalty ? 'Ethics penalty' : r.isBest ? 'Well judged' : 'Defensible — but not the best',
          body: h('div', null,
            h('p', { class: 'zg-verdict ' + (r.ethicsPenalty ? 'bad' : 'ok') }, r.ethicsPenalty ? `−${-r.xp} XP · APA Goal 3 −${L.ETHICS_G3_POINTS}` : `+${r.xp} XP`),
            h('p', null, d.options[idx].feedback),
            this._tradeoffBars(r.effects),
            !r.isBest ? h('p', { class: 'note' }, h('b', null, 'Strongest option: '), best.label + ' — ' + best.feedback) : null),
          actions: [{ label: 'Continue', value: true }],
        });
        if (this.difficulty === 'honours' && ['research', 'data', 'replication', 'irb'].includes(d.kind)) await this.confoundPrompt();
      }
      return r;
    } finally { this.busy = false; }
  }

  _penalise(why) {
    const sc = this.sim.services.scoring;
    if (sc && sc.penalise) return sc.penalise(why);
    const lost = L.applyEthicsPenalty(this.sim.state, this.difficulty);
    this.sim.bus.emit('xp:gain', { n: -lost, why: 'Ethics penalty: ' + why });
    return lost;
  }

  /** Honours: spot the confound. Returns true if correct. `answer` skips UI. */
  async confoundPrompt(answer) {
    const c = L.confoundPrompt(this._rng());
    let pick = answer;
    if (pick == null) {
      const order = c.options.map((_, i) => i);
      pick = await modal({ title: 'Honours — spot the confound', body: h('div', null, h('p', null, c.text), h('p', { class: 'note' }, 'What is the most serious threat to the conclusion?')), actions: [{ label: 'Skip', value: null, cls: 'ghost' }].concat(order.map((i) => ({ label: c.options[i], value: i }))) });
      if (pick == null) return false;
    }
    const ok = pick === c.answer;
    if (ok) this.sim.addXP(20, 'Spotted a confound');
    this.sim.bus.emit('confound:answer', { correct: ok });
    if (answer == null) toast((ok ? '✔ Correct — ' : '✘ Not quite — ') + c.explain, 7000);
    return ok;
  }

  // ---------------------------------------------------------------- IRB chamber
  async presentIRB(id, opts = {}) {
    const sim = this.sim;
    const p = id ? sim.data.irb.find((x) => x.id === id) : L.pickIRB(sim.data.irb, sim.state.irb, this._rng());
    if (!p) return null;
    const headless = opts.decision != null;
    let decision = opts.decision;
    this.busy = true;
    try {
      if (!headless) {
        injectCSS('zg-dir-css', CSS);
        const diff = this.difficulty;
        const risks = h('ul', null, p.risks.map((r) => h('li', null, r)));
        const body = h('div', { class: 'zg-irb' },
          h('p', { class: 'note' }, 'IRB chamber, Methods & Stats Library — the board is in session. You are the reviewing member. (Simulated proposal; IIBS is a simulated institution.)'),
          h('dl', null, h('dt', null, 'Proposal'), h('dd', null, p.title), h('dt', null, 'Design'), h('dd', null, p.design)),
          h('p', null, p.summary),
          diff === 'honours' ? h('details', null, h('summary', null, "Applicant's own risk statement"), risks) : h('div', null, h('b', null, 'Risks identified:'), risks),
          diff === 'foundation' ? h('p', { class: 'note' }, 'Checklist: informed consent · deception + debrief · vulnerable groups · confidentiality · risk vs benefit · right to withdraw.') : null,
          h('p', null, h('b', null, 'Your ruling?')));
        decision = await modal({ title: 'Ethics Board hearing — ' + p.id, body, cls: 'zg-irb-modal', actions: [{ label: 'Adjourn', value: null, cls: 'ghost' }].concat(DECISIONS.map(([v, label]) => ({ label, value: v, cls: v === 'reject' ? 'primary' : v === 'approve' ? 'teal' : '' }))) });
        if (decision == null) return null;
      }
      const r = L.judgeIRB(p, decision);
      sim.state.irb[p.id] = { decision, correct: r.correct, at: new Date().toISOString() };
      if (r.ethicsPenalty) this._penalise('approved an unethical proposal');
      sim.addXP(r.xp, 'IRB ruling ' + p.id);
      this.lastAt = this._now();
      sim.bus.emit('irb:decision', { id: p.id, decision, correct: r.correct });
      if (!headless && !opts.silent) {
        const label = (v) => (DECISIONS.find((x) => x[0] === v) || [v, v])[1];
        await modal({
          title: r.correct ? 'The board agrees' : 'The board rules differently',
          body: h('div', null,
            h('p', { class: 'zg-verdict ' + (r.correct ? 'ok' : 'bad') }, `Your ruling: ${label(decision)} · Board: ${label(p.correct)}` + (r.ethicsPenalty ? ' · ethics penalty' : '')),
            h('h4', null, 'Reasons'), h('ul', null, p.reasons.map((x) => h('li', null, x))),
            h('h4', null, 'Codes'), h('div', { class: 'zg-codes' }, p.codes.map((c) => h('span', { class: 'tag apa' }, c)))),
          actions: [{ label: 'Next proposal', value: 'next', cls: 'ghost' }, { label: 'Leave chamber', value: true }],
        }).then((v) => { if (v === 'next') setTimeout(() => this.presentIRB(), 0); });
      }
      return r;
    } finally { this.busy = false; }
  }

  // ---------------------------------------------------------------- e2e sweeps
  async resolveAllDilemmas({ choice = 'best' } = {}) {
    const out = [];
    for (const d of this.sim.data.dilemmas) {
      const i = typeof choice === 'number' ? Math.min(choice, d.options.length - 1) : choice === 'worst' ? Math.max(0, d.options.findIndex((o) => o.ethicsPenalty)) : L.bestOption(d);
      out.push(await this.presentDilemma(d.id, { choice: i, silent: true }));
    }
    return out;
  }
  async judgeAllIRB({ policy = 'correct' } = {}) {
    const out = [];
    for (const p of this.sim.data.irb) out.push(await this.presentIRB(p.id, { decision: policy === 'correct' ? p.correct : policy, silent: true }));
    return out;
  }

  dispose() { this.offs.forEach((f) => f()); if (this._timer) clearTimeout(this._timer); }
}

module.exports = { Director, GameDirector: Director };
