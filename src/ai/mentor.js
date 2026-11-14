'use strict';
/**
 * RAAHI mentor service (A7, §7) — `sim.services.ai`.
 *
 *   mentor.ask(text, {source, onText}) → Promise<{text, cards, action, actions, offline, crisis?, simulation?, kind}>
 *   mentor.execute(action, {approved}) → boolean   (state-changing actions need approved:true — the chat's Approve button)
 *   mentor.status() → 'online' | 'offline' | 'off'
 *   mentor.renderSettings(container)                (Settings panel: enable toggle, API key, model, privacy notice)
 *
 * Safety order on EVERY text: crisis.detect first → crisis card + calm message + offer to pause, no lesson.
 * Then: live LLM (only if enabled, keyed, online) → on any error/timeout fall back to the offline engine (amber light).
 * A global watcher also runs crisis.detect on every text input/textarea in the document (§7 rail 3).
 */
const crisis = require('./crisis.js');
const { IntentEngine } = require('./engine.js');
const { LLMClient, MODELS, DEFAULT_MODEL, PRIVACY_NOTICE, STATE_CHANGING, currentPanel } = require('./llm.js');
const { Voice } = require('./voice.js');

const AUTO_CRISIS_COOLDOWN_MS = 60000;
const WATCH_DEBOUNCE_MS = 700;
const CARD_DEDUPE_MS = 15000;

const ACTION_LABEL = {
  openPanel: (a) => `Open ${a.arg}`, goZone: (a) => `Go to ${a.arg}`, setMode: (a) => `Switch to ${a.arg} mode`,
  startParadigm: (a) => `Start ${a.arg}`, showCrisis: () => 'Show support card', applyDesignFix: () => 'Apply fix', pauseGame: () => 'Pause the game',
};

class Mentor {
  constructor(sim, opts = {}) {
    this.sim = sim;
    this.engine = new IntentEngine({ intents: sim.data.intents, glossary: sim.data.glossary, facts: sim.data.facts });
    this.llm = new LLMClient(sim, { engine: this.engine, fetch: opts.fetch });
    this.voice = new Voice(sim);
    this.history = [];
    this.lastError = null;
    this.lastAutoCrisis = -Infinity;
    this.lastCardAt = -Infinity;
    this._status = null;
    if (opts.watch !== false) this.installCrisisWatcher();
    this._emitStatus();
  }

  // ---------------------------------------------------------------- status
  status() {
    if (!this.llm.isEnabled()) return 'off';
    if (this.lastError || !this.llm.online()) return 'offline';
    return 'online';
  }
  _emitStatus() {
    const s = this.status();
    if (s !== this._status) { this._status = s; try { this.sim.bus.emit('ai:status', { status: s, error: this.lastError }); } catch (e) { /* no bus */ } }
    const hud = this.sim.services && this.sim.services.ui && this.sim.services.ui.hud;
    if (hud && hud.refresh) try { hud.refresh(); } catch (e) { /* hud optional */ }
  }

  context() {
    const st = this.sim.state || {};
    const designs = Array.isArray(st.designs) ? st.designs : [];
    return { week: st.week, zone: st.zone, mode: st.mode, panel: currentPanel(this.sim), design: designs.length ? designs[designs.length - 1] : null };
  }

  // ---------------------------------------------------------------- crisis
  /** Calm supportive message; numbers come only from facts.json (F-H4), worded like factLine. */
  crisisMessage() {
    const f = this.sim.facts && this.sim.facts.get ? this.sim.facts.get('F-H4') : ((this.sim.data.facts || []).find((x) => x.id === 'F-H4') || null);
    const emergency = f ? `${f.claim.replace(/\.$/, '')}: ${f.value}${f.confidence === 'verified' ? '' : ' (figure under verification)'}.` : 'The emergency numbers are on the support card.';
    return [
      "I'm really glad you told me, and I'm sorry you're going through this.",
      "I'm RAAHI, an AI tutor, not a counsellor or therapist, so I can't give you the help you deserve myself. The support card with helplines is open on your screen.",
      `If you are in danger right now, please call emergency services. ${emergency} Hours may vary for the helplines on the card — please verify before calling.`,
      'Please also reach out to someone you trust nearby: a friend, family member, teacher or your university counsellor.',
      'Would you like me to pause the game?',
    ].join('\n');
  }

  _crisis(source, category, { dedupe = false } = {}) {
    try { this.sim.bus.emit('crisis:detected', { source, category }); } catch (e) { /* no bus */ }
    const now = Date.now();
    if (dedupe && now - this.lastCardAt < CARD_DEDUPE_MS) return; // card already on screen (e.g., watcher fired while typing)
    this.lastCardAt = now;
    const ui = this.sim.services && this.sim.services.ui;
    if (ui && ui.showCrisis) try { ui.showCrisis({ source }); } catch (e) { /* ui optional */ }
  }

  crisisResult(source, det) {
    this._crisis(source, det && det.category, { dedupe: true });
    return {
      kind: 'crisis', crisis: det || { crisis: true }, offline: true, cards: [],
      text: this.crisisMessage(),
      action: { type: 'pauseGame', label: 'Pause the game', stateChanging: true },
      actions: [{ type: 'pauseGame', label: 'Pause the game', stateChanging: true }, { type: 'showCrisis', label: 'Show support card again', stateChanging: false }],
    };
  }

  /** Global watcher: any text input/textarea/contenteditable in the document (debounced; auto-card once per 60 s). */
  installCrisisWatcher(doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d || d.__zehnCrisisWatcher) return;
    d.__zehnCrisisWatcher = true;
    const timers = new WeakMap();
    const check = (el) => {
      const text = el.isContentEditable ? el.textContent : el.value;
      if (!text || text.length < 3) return;
      const det = crisis.detect(text);
      if (!det.crisis) return;
      const now = Date.now();
      if (now - this.lastAutoCrisis < AUTO_CRISIS_COOLDOWN_MS) return;
      this.lastAutoCrisis = now;
      this._crisis('textbox:' + (el.id || el.name || el.getAttribute('aria-label') || el.tagName.toLowerCase()), det.category);
    };
    const handler = (e) => {
      const el = e.target;
      if (!el || !el.tagName) return;
      const tag = el.tagName.toLowerCase();
      const isText = (tag === 'textarea') || el.isContentEditable || (tag === 'input' && /^(text|search|)$/i.test(el.type || 'text'));
      if (!isText || el.type === 'password' || el.dataset.noCrisisWatch === '1') return;
      clearTimeout(timers.get(el));
      timers.set(el, setTimeout(() => check(el), e.type === 'change' ? 0 : WATCH_DEBOUNCE_MS));
    };
    d.addEventListener('input', handler, true);
    d.addEventListener('change', handler, true);
  }

  // ---------------------------------------------------------------- ask
  _decorate(action) {
    if (!action || !action.type) return null;
    const a = Object.assign({}, action);
    a.stateChanging = STATE_CHANGING.has(a.type);
    if (!a.label) a.label = (ACTION_LABEL[a.type] || (() => a.type))(a);
    return a;
  }

  async ask(text, opts = {}) {
    const source = opts.source || 'chat';
    const q = String(text == null ? '' : text).trim();
    // 1) crisis first, always
    const det = crisis.detect(q);
    if (det.crisis) {
      this.lastAutoCrisis = Date.now(); // the global watcher should not pop the card a second time
      return this.crisisResult(source, det);
    }
    if (!q) return { kind: 'fallback', text: 'Ask me anything about the course, your data or your design.', cards: [], action: null, actions: [], offline: true };
    // 2) live LLM (optional)
    if (this.llm.ready()) {
      try {
        let crisisCat = null;
        const r = await this.llm.ask(q, { onText: opts.onText, history: this.history, onCrisis: (c) => { crisisCat = c; } });
        this.lastError = null; this._emitStatus();
        if (crisisCat || r.crisis) return this.crisisResult(source + ':llm', { crisis: true, category: crisisCat || r.crisis, matched: null });
        this.history.push({ role: 'user', content: q }, { role: 'assistant', content: r.text });
        if (this.history.length > 16) this.history.splice(0, this.history.length - 16);
        const actions = r.actions.map((a) => this._decorate(a)).filter(Boolean);
        const cards = [];
        for (const t of r.toolLog) if (t.output && Array.isArray(t.output.cards)) cards.push(...t.output.cards);
        return { kind: 'llm', text: r.text, cards, action: actions[0] || null, actions, offline: false, simulation: r.simulation };
      } catch (err) {
        this.lastError = (err && err.message) || 'LLM error';
        this._emitStatus();
        try { this.sim.bus.emit('ai:fallback', { reason: this.lastError }); } catch (e) { /* ignore */ }
      }
    }
    // 3) offline engine
    const r = this.engine.respond(q, this.context());
    if (r.kind === 'crisis') return this.crisisResult(source, r.crisis);
    if (r.kind === 'glossary' && r.term) try { this.sim.bus.emit('glossary:lookup', { term: r.term }); } catch (e) { /* ignore */ }
    const action = this._decorate(r.action);
    const prefix = this.llm.isEnabled() && this.lastError ? '(Live mode unavailable — answering offline.) ' : '';
    return { kind: r.kind, text: prefix + r.text, cards: r.cards || [], action, actions: action ? [action] : [], offline: true, intentId: r.intentId };
  }

  // ---------------------------------------------------------------- actions
  isStateChanging(action) { return !!action && STATE_CHANGING.has(action.type); }

  /** Execute an action via sim.services. State-changing actions require {approved:true} (Approve click). */
  execute(action, { approved = false } = {}) {
    if (!action || !action.type) return false;
    if (this.isStateChanging(action) && !approved) return false;
    const sv = this.sim.services || {};
    try {
      switch (action.type) {
        case 'openPanel': if (sv.ui && sv.ui.openPanel) { sv.ui.openPanel(action.arg); return true; } return false;
        case 'showCrisis': this._crisis('mentor', null); return true;
        case 'goZone': if (sv.world && sv.world.teleport) { sv.world.teleport(action.arg); return true; } return false;
        case 'setMode': if (sv.controls && sv.controls.setMode) { sv.controls.setMode(action.arg); return true; } return false;
        case 'startParadigm': if (sv.runner && sv.runner.run) { sv.runner.run(action.arg); return true; } return false; // runner shows consent itself
        case 'applyDesignFix': {
          const st = this.sim.state; if (!Array.isArray(st.designs) || !st.designs.length) return false;
          const d = st.designs[st.designs.length - 1];
          const fix = action.arg || {};
          if (fix.controlVariable) { d.controlled = (d.controlled || []).concat([fix.controlVariable]); d.confounds = (d.confounds || []).filter((c) => c !== fix.controlVariable); } else Object.assign(d, fix);
          this.sim.bus.emit('builder:save', { design: d });
          return true;
        }
        case 'pauseGame': {
          this.sim.clock.paused = true;
          if (sv.engine && sv.engine.setExperimentMode) sv.engine.setExperimentMode(true);
          if (sv.audio && sv.audio.setMuted) try { sv.audio.setMuted(true); } catch (e) { /* optional */ }
          if (typeof document !== 'undefined') document.body.classList.add('paused');
          const resume = () => { this.sim.clock.paused = false; if (sv.engine && sv.engine.setExperimentMode) sv.engine.setExperimentMode(false); if (sv.audio && sv.audio.setMuted) try { sv.audio.setMuted(false); } catch (e) { /* optional */ } if (typeof document !== 'undefined') document.body.classList.remove('paused'); };
          if (sv.ui && sv.ui.modal) sv.ui.modal({ title: 'Game paused', body: '<p>Take all the time you need. The support card stays available from the Support button and Settings.</p>', actions: [{ label: 'Resume', value: true }] }).then(resume);
          return true;
        }
        default: return false;
      }
    } catch (e) { return false; }
  }

  // ---------------------------------------------------------------- settings UI
  renderSettings(container) {
    const { h, btn, toast } = require('../ui/dom.js');
    const llm = this.llm;
    const statusEl = h('span', { class: 'note', role: 'status', 'aria-live': 'polite' });
    const light = h('span', { class: 'light', 'aria-hidden': 'true' });
    const refresh = () => {
      const s = this.status();
      light.className = 'light ' + (s === 'online' ? 'on' : 'off');
      statusEl.textContent = s === 'online' ? `Live mode on (${llm.getModel()}).` : s === 'offline' ? `Live mode enabled but unavailable${this.lastError ? ' (' + this.lastError + ')' : ''}: answering offline.` : 'Live mode off: RAAHI answers fully offline.';
      enable.checked = llm.isEnabled();
      ack.checked = llm.privacyAcknowledged();
      keyNote.textContent = llm.hasKey() ? 'A key is stored for this tab only.' : 'No key stored.';
    };
    const ack = h('input', { type: 'checkbox', id: 'raahi-ack', onchange: () => { llm.acknowledgePrivacy(ack.checked); if (!ack.checked) llm.setEnabled(false); this.lastError = null; this._emitStatus(); refresh(); } });
    const keyIn = h('input', { type: 'password', id: 'raahi-key', autocomplete: 'off', spellcheck: false, placeholder: 'sk-ant-…', 'aria-label': 'Anthropic API key (kept in this tab only)', 'data-no-crisis-watch': '1' });
    const keyNote = h('span', { class: 'note' });
    const enable = h('input', { type: 'checkbox', id: 'raahi-enable', onchange: () => {
      if (enable.checked && (!llm.hasKey() || !llm.privacyAcknowledged())) { enable.checked = false; toast('Paste a key and accept the privacy notice first.'); return; }
      llm.setEnabled(enable.checked); this.lastError = null; this._emitStatus(); refresh();
    } });
    const modelIn = h('input', { type: 'text', id: 'raahi-model', list: 'raahi-models', value: llm.getModel(), 'aria-label': 'Model ID', 'data-no-crisis-watch': '1', onchange: () => { llm.setModel(modelIn.value || DEFAULT_MODEL); refresh(); } });
    const dl = h('datalist', { id: 'raahi-models' }, MODELS.map((m) => h('option', { value: m.id }, m.label)));
    const modelSel = h('select', { 'aria-label': 'Choose a model', onchange: () => { modelIn.value = modelSel.value; llm.setModel(modelSel.value); refresh(); } },
      MODELS.map((m) => h('option', { value: m.id, selected: m.id === llm.getModel() }, m.label)));
    container.appendChild(h('section', { class: 'raahi-settings', 'aria-label': 'RAAHI live mode settings' },
      h('h3', null, light, 'RAAHI live mode (optional)'),
      h('p', { class: 'note' }, 'RAAHI is an AI tutor, not a psychologist or therapist. It works fully offline by default. Live mode uses your own Anthropic API key.'),
      h('p', { class: 'fact', role: 'note' }, h('b', null, 'Privacy notice: '), PRIVACY_NOTICE),
      h('label', { class: 'f', for: 'raahi-ack' }, ack, ' I have read the privacy notice'),
      h('label', { class: 'f', for: 'raahi-key' }, 'API key ', keyIn),
      h('div', { class: 'row' },
        btn('Save key for this tab', () => { if (!keyIn.value.trim()) { toast('Paste a key first.'); return; } llm.setKey(keyIn.value); keyIn.value = ''; this.lastError = null; this._emitStatus(); refresh(); toast('Key stored in sessionStorage for this tab only.'); }, 'primary'),
        btn('Forget key', () => { llm.clearKey(); keyIn.value = ''; this._emitStatus(); refresh(); toast('Key removed. Live mode is off.'); }, 'ghost'),
        keyNote),
      h('label', { class: 'f' }, 'Model ', modelSel),
      h('label', { class: 'f', for: 'raahi-model' }, 'Model ID (editable) ', modelIn, dl),
      h('p', { class: 'note' }, 'Verify model IDs: they are listed as "must-verify" (fact F-MODELS). If a call fails, RAAHI falls back to offline answers and the light turns amber.'),
      h('label', { class: 'f', for: 'raahi-enable' }, enable, ' Enable live mode'),
      h('label', { class: 'f' }, h('input', { type: 'checkbox', checked: this.voice.enabled, onchange: (e) => { this.voice.enabled = e.target.checked; if (!e.target.checked) this.voice.stop(); } }), ' Read RAAHI\'s replies aloud (speech synthesis, on this device)'),
      statusEl));
    refresh();
    return container;
  }
}

module.exports = { Mentor };
