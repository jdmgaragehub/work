'use strict';
/**
 * RAAHI voice (A7, §7): speechSynthesis narration that drives captions and lip-sync visemes,
 * plus optional webkitSpeechRecognition with a text fallback. All local to the browser.
 *
 *   voice.speak(text)        emits sim.bus 'caption' {text} and timed 'viseme' {v} events ('A','E','O','U','M','F','rest')
 *   voice.stop()
 *   voice.listen({onResult, onError, onEnd}) → stop() | null (null = unsupported → use the text box)
 *   voice.supported()        → {tts, stt}
 *   textToVisemes(text, msPerChar) → [{v, t}]  (pure)
 */

const VIS = [
  [/[mbp]/, 'M'], [/[fv]/, 'F'], [/[ao]/, 'A'], [/[eiy]/, 'E'], [/[uw]/, 'U'], [/[o]/, 'O'],
];
function charViseme(ch) {
  const c = ch.toLowerCase();
  if (c === 'o') return 'O';
  for (const [re, v] of VIS) if (re.test(c)) return v;
  return /[a-z]/.test(c) ? 'E' : 'rest';
}

/** Pure: approximate viseme timeline from text (≈ msPerChar per character, merged runs). */
function textToVisemes(text, msPerChar = 62) {
  const out = []; let t = 0; let last = null;
  for (const ch of String(text || '')) {
    const v = /\s|[.,;:!?]/.test(ch) ? 'rest' : charViseme(ch);
    if (v !== last) { out.push({ v, t: Math.round(t) }); last = v; }
    t += /[.,;:!?]/.test(ch) ? msPerChar * 3 : msPerChar;
  }
  out.push({ v: 'rest', t: Math.round(t) });
  return out;
}

class Voice {
  constructor(sim) {
    this.sim = sim;
    this.enabled = false;
    this.timers = [];
    this.rec = null;
  }
  supported() {
    const g = typeof window !== 'undefined' ? window : {};
    return { tts: !!(g.speechSynthesis && g.SpeechSynthesisUtterance), stt: !!(g.SpeechRecognition || g.webkitSpeechRecognition) };
  }
  _emit(ev, p) { try { this.sim.bus.emit(ev, p); } catch (e) { /* bus missing */ } }
  _clear() { for (const id of this.timers) clearTimeout(id); this.timers = []; }

  /** Speak text (captions always emitted, even when TTS is unavailable or voice is off). */
  speak(text, opts = {}) {
    const clean = String(text || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (!clean) return;
    this._emit('caption', { text: clean, speaker: 'RAAHI' });
    if (!this.enabled && !opts.force) return;
    this.stop();
    const rate = opts.rate || 1;
    const vis = textToVisemes(clean, 62 / rate);
    const { tts } = this.supported();
    const runVisemes = () => { for (const { v, t } of vis) this.timers.push(setTimeout(() => this._emit('viseme', { v }), t)); };
    if (!tts) { runVisemes(); return; }
    try {
      const u = new window.SpeechSynthesisUtterance(clean);
      u.rate = rate; u.lang = opts.lang || (this.sim.settings && this.sim.settings.lang === 'ur' ? 'ur-PK' : 'en-GB');
      const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
      const pick = voices.find((v) => v.lang === u.lang) || voices.find((v) => v.lang && v.lang.startsWith(u.lang.slice(0, 2)));
      if (pick) u.voice = pick;
      let usedBoundary = false;
      u.onstart = () => { this._emit('voice:start', {}); this.timers.push(setTimeout(() => { if (!usedBoundary) runVisemes(); }, 250)); };
      u.onboundary = (e) => {
        if (e.name && e.name !== 'word') return;
        usedBoundary = true;
        const word = clean.slice(e.charIndex).split(/\s/)[0] || '';
        this._clear();
        for (const { v, t } of textToVisemes(word, 62 / rate)) this.timers.push(setTimeout(() => this._emit('viseme', { v }), t));
      };
      u.onend = u.onerror = () => { this._clear(); this._emit('viseme', { v: 'rest' }); this._emit('voice:end', {}); };
      window.speechSynthesis.speak(u);
    } catch (e) { runVisemes(); }
  }

  stop() {
    this._clear();
    try { if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    this._emit('viseme', { v: 'rest' });
  }

  /** Start one-shot speech recognition. Returns a stop function, or null if unsupported (use text input). */
  listen({ onResult, onError, onEnd } = {}) {
    const R = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!R) return null;
    try {
      const rec = new R();
      rec.lang = this.sim.settings && this.sim.settings.lang === 'ur' ? 'ur-PK' : 'en-US';
      rec.interimResults = false; rec.maxAlternatives = 1; rec.continuous = false;
      rec.onresult = (e) => { const r = e.results && e.results[0] && e.results[0][0]; if (r && onResult) onResult(r.transcript); };
      rec.onerror = (e) => { if (onError) onError(e.error || 'speech error'); };
      rec.onend = () => { this.rec = null; if (onEnd) onEnd(); };
      rec.start();
      this.rec = rec;
      return () => { try { rec.stop(); } catch (e) { /* already stopped */ } };
    } catch (e) { if (onError) onError(e.message); return null; }
  }
}

module.exports = { Voice, textToVisemes };
