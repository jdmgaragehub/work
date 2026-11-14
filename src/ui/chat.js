'use strict';
/**
 * RAAHI chat dock (A7, §7): floating `.chat` panel. Header names RAAHI as an AI tutor (not a
 * psychologist or therapist) with a status light (green = live LLM, amber = offline). Urdu greeting,
 * message log, advice cards with Approve/Reject one-click actions, suggestion chips, voice toggle.
 * Keyboard: T opens (when not typing), Enter sends, Esc closes.
 */
const { h, btn, anyModalOpen } = require('./dom.js');

const CHIPS = [
  'What is the Stroop effect?',
  'Which test should I use?',
  'Critique my design',
  'How do I report a t-test in APA?',
  'Take me to the Memory Lab',
  'Where should I start?',
];

const isTyping = (el) => !!el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName || ''));

class ChatUI {
  constructor(sim, root) {
    this.sim = sim;
    this.root = root || document.body;
    this.busy = false;
    const ai = () => sim.services.ai;

    this.light = h('span', { class: 'light off', 'aria-hidden': 'true' });
    this.statusText = h('span', { class: 'note', style: { fontSize: '.75em' } }, 'offline');
    this.voiceBtn = h('button', { type: 'button', class: 'iconbtn', 'aria-pressed': 'false', title: 'Read replies aloud', 'aria-label': 'Read replies aloud', onclick: () => this.toggleVoice() }, '🔈');
    this.log = h('div', { class: 'log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation with RAAHI' });
    this.input = h('input', { type: 'text', 'aria-label': 'Message RAAHI', placeholder: 'Ask RAAHI… (Enter to send)', autocomplete: 'off', maxlength: '1000' });
    this.micBtn = h('button', { type: 'button', class: 'iconbtn', title: 'Speak your question', 'aria-label': 'Speak your question', onclick: () => this.listen() }, '🎤');
    this.form = h('form', { onsubmit: (e) => { e.preventDefault(); this.send(this.input.value); } },
      this.input, this.micBtn, h('button', { type: 'submit', class: 'btn primary', 'aria-label': 'Send' }, 'Send'));
    this.chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Suggestions', style: { display: 'flex', flexWrap: 'wrap', gap: '4px', padding: '0 8px 6px' } },
      CHIPS.map((c) => h('button', { type: 'button', class: 'btn ghost chip', style: { fontSize: '.75em', padding: '3px 8px' }, onclick: () => this.send(c) }, c)));

    this.el = h('section', { class: 'chat', hidden: true, role: 'dialog', 'aria-label': 'RAAHI AI tutor chat', 'aria-modal': 'false' },
      h('header', null,
        this.light,
        h('div', { style: { flex: 1, lineHeight: 1.2 } },
          h('strong', null, 'RAAHI — AI tutor (not a psychologist or therapist)'),
          h('div', null, h('span', { lang: 'ur', dir: 'rtl', style: { marginRight: '6px' } }, 'راہی'), this.statusText)),
        this.voiceBtn,
        h('button', { type: 'button', class: 'iconbtn', 'aria-label': 'Close chat (Esc)', onclick: () => this.close() }, '✕')),
      this.log, this.chips, this.form);
    this.root.appendChild(this.el);

    const sup = ai() && ai().voice ? ai().voice.supported() : { stt: false };
    if (!sup.stt) this.micBtn.hidden = true; // text fallback: the input box is always there

    this.greet();
    this.refreshStatus();
    sim.bus.on('ai:status', () => this.refreshStatus());
    sim.bus.on('ai:fallback', () => this.refreshStatus());

    this.onKey = (e) => {
      if (e.defaultPrevented) return;
      if ((e.key === 't' || e.key === 'T') && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target) && !anyModalOpen() && !(sim.services.runner && sim.services.runner.active)) {
        // T always OPENS (never toggles closed); stop the window-level key map from toggling it shut again.
        e.preventDefault(); e.stopPropagation(); this.open();
      } else if (e.key === 'Escape' && !this.el.hidden && this.el.contains(document.activeElement) && !anyModalOpen()) {
        e.preventDefault(); this.close();
      }
    };
    document.addEventListener('keydown', this.onKey);
  }

  greet() {
    this.addMsg('ai', null, h('span', null,
      h('span', { lang: 'ur', dir: 'rtl' }, 'السلام علیکم'), ' Assalam-o-alaikum! I\'m RAAHI (',
      h('span', { lang: 'ur', dir: 'rtl' }, 'راہی'), ', "fellow traveller"), your lab mentor. I\'m an AI tutor, not a psychologist or therapist. Ask me about concepts, statistics, your design, or where to go next.'));
  }

  refreshStatus() {
    const ai = this.sim.services.ai;
    const s = ai && ai.status ? ai.status() : 'off';
    this.light.className = 'light ' + (s === 'online' ? 'on' : 'off');
    this.statusText.textContent = s === 'online' ? 'live (LLM)' : s === 'offline' ? 'offline fallback' : 'offline';
    this.light.title = s === 'online' ? 'Live LLM mode' : 'Offline mode';
  }

  addMsg(who, text, node) {
    const m = h('div', { class: 'msg ' + (who === 'me' ? 'me' : 'ai') });
    if (node) m.appendChild(node); else m.textContent = text;
    this.log.appendChild(m);
    this.log.scrollTop = this.log.scrollHeight;
    return m;
  }

  /** Action button(s): state-changing → Approve / Reject; otherwise a single button. */
  actionRow(action) {
    const ai = this.sim.services.ai;
    const row = h('div', { class: 'row', style: { display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' } });
    const done = (txt) => { row.innerHTML = ''; row.appendChild(h('span', { class: 'note' }, txt)); };
    if (action.stateChanging) {
      row.appendChild(h('span', { class: 'note', style: { width: '100%' } }, (action.label || action.type) + ' — needs your approval:'));
      row.appendChild(btn('Approve', () => done(ai && ai.execute(action, { approved: true }) ? '✓ Approved: ' + (action.label || action.type) : 'Could not do that here.'), 'primary', { 'aria-label': 'Approve: ' + (action.label || action.type) }));
      row.appendChild(btn('Reject', () => done('✗ Rejected — nothing changed.'), 'ghost', { 'aria-label': 'Reject: ' + (action.label || action.type) }));
    } else {
      row.appendChild(btn(action.label || action.type, () => { if (!(ai && ai.execute(action))) done('Not available right now.'); }, 'ghost'));
    }
    return row;
  }

  renderCard(c) {
    const el = h('div', { class: 'msg ai advice sev-' + c.severity, role: 'article', 'aria-label': `${c.severity} priority: ${c.title}` },
      h('div', null, h('span', { class: 'tag' }, c.severity.toUpperCase()), ' ', h('strong', null, c.title)),
      h('p', { style: { margin: '4px 0' } }, h('b', null, 'Why: '), c.why),
      h('p', { style: { margin: '4px 0' } }, h('b', null, 'Do: '), c.recommendation),
      h('p', { class: 'note', style: { margin: '4px 0' } }, 'Impact: ' + c.impact));
    if (c.oneClickAction) {
      const a = Object.assign({ label: c.oneClickAction.label }, c.oneClickAction);
      a.stateChanging = this.sim.services.ai ? this.sim.services.ai.isStateChanging(a) : true;
      el.appendChild(this.actionRow(a));
    }
    this.log.appendChild(el);
  }

  async send(raw) {
    const text = String(raw || '').trim();
    if (!text || this.busy) return;
    this.input.value = '';
    this.addMsg('me', text);
    const ai = this.sim.services.ai;
    if (!ai) { this.addMsg('ai', 'RAAHI is not available right now.'); return; }
    this.busy = true; this.form.setAttribute('aria-busy', 'true');
    const bubble = this.addMsg('ai', '…');
    let streamed = '';
    try {
      const r = await ai.ask(text, { source: 'chat', onText: (t) => { streamed += t; bubble.textContent = streamed; this.log.scrollTop = this.log.scrollHeight; } });
      bubble.textContent = '';
      if (r.simulation) bubble.appendChild(h('div', { class: 'sim-label', role: 'note' }, 'SIMULATION — fictional client'));
      for (const [i, line] of String(r.text).split('\n').entries()) { if (i) bubble.appendChild(h('br')); bubble.appendChild(document.createTextNode(line)); }
      if (r.offline && ai.status() !== 'off') bubble.appendChild(h('div', { class: 'note', style: { fontSize: '.72em' } }, 'answered offline'));
      if (r.crisis) {
        bubble.classList.add('advice', 'sev-high');
        for (const a of r.actions || []) bubble.appendChild(this.actionRow(a));
      } else {
        for (const c of r.cards || []) this.renderCard(c);
        for (const a of r.actions || []) bubble.appendChild(this.actionRow(a));
      }
      if (ai.voice && ai.voice.enabled) ai.voice.speak(r.text); else this.sim.bus.emit('caption', { text: r.text.split('\n')[0], speaker: 'RAAHI' });
    } catch (err) {
      bubble.textContent = 'Sorry, something went wrong. Please try again.';
    } finally {
      this.busy = false; this.form.removeAttribute('aria-busy');
      this.log.scrollTop = this.log.scrollHeight;
      this.refreshStatus();
    }
  }

  toggleVoice() {
    const ai = this.sim.services.ai;
    if (!ai || !ai.voice) return;
    ai.voice.enabled = !ai.voice.enabled;
    if (!ai.voice.enabled) ai.voice.stop();
    this.voiceBtn.setAttribute('aria-pressed', String(ai.voice.enabled));
    this.voiceBtn.textContent = ai.voice.enabled ? '🔊' : '🔈';
  }

  listen() {
    const ai = this.sim.services.ai;
    const stop = ai && ai.voice ? ai.voice.listen({
      onResult: (t) => { this.input.value = t; this.send(t); },
      onError: () => { this.micBtn.textContent = '🎤'; this.input.placeholder = 'Voice unavailable — please type your question.'; this.input.focus(); },
      onEnd: () => { this.micBtn.textContent = '🎤'; },
    }) : null;
    if (!stop) { this.input.placeholder = 'Voice input is not supported here — please type.'; this.input.focus(); return; }
    this.micBtn.textContent = '⏺';
  }

  open() { this.el.hidden = false; this.refreshStatus(); setTimeout(() => this.input.focus(), 0); }
  close() { this.el.hidden = true; if (this.sim.services.ai && this.sim.services.ai.voice) this.sim.services.ai.voice.stop(); try { document.getElementById('scene') && document.getElementById('scene').focus(); } catch (e) { /* ignore */ } }
  toggle() { if (this.el.hidden) this.open(); else this.close(); }
  isOpen() { return !this.el.hidden; }
}

module.exports = { ChatUI };
