'use strict';
/**
 * Guided tour (A9) — mode 7. ≥32 beats from src/data/tour.json ({id, week, zone, title, text, view, panel?}).
 *
 *   const tour = new Tour(sim)          // sim.services.tour
 *   tour.start(i = 0 | beatId)          // caption card + camera fly-over; emits 'tour:beat' {id}
 *   tour.next() / tour.prev() / tour.goto(i) / tour.exit()
 *   tour.setNarration(bool)             // sim.services.ai.voice.speak, else speechSynthesis
 *   tour.setAutoplay(bool)
 *   tour.togglePhoto(on?)               // photo mode (P): free camera + DOF via engine.setDOF, HUD hidden
 *   tour.active / tour.index / tour.photo
 *
 * Camera: world.focusTargets[zone][view] ({pos, target}) when A2 provides it, else a framing computed
 * from src/world/layout.js. All services are optional (guarded).
 */
const { h, btn, toast, anyModalOpen, download } = require('../ui/dom.js');
const layout = require('../world/layout.js');
const { injectCSS } = require('./scoring.js');

const CSS = `
.zg-tour{position:fixed;left:50%;bottom:64px;transform:translateX(-50%);width:min(680px,calc(100vw - 32px));z-index:60;background:var(--glass,rgba(20,18,50,.88));border:1px solid var(--line,#444);border-radius:14px;padding:12px 16px;box-shadow:0 10px 30px rgba(0,0,0,.4);backdrop-filter:blur(8px)}
.zg-tour h3{margin:2px 0 6px;font-size:1.1em;color:#fde68a}
.zg-tour p{margin:4px 0 8px;line-height:1.5}
.zg-tour .meta{font-size:.75em;color:var(--muted,#aaa);display:flex;gap:8px;flex-wrap:wrap}
.zg-tour .dots{display:flex;gap:3px;flex-wrap:wrap;margin:6px 0}
.zg-tour .dots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.18);display:block}
.zg-tour .dots i.on{background:#F59E0B}.zg-tour .dots i.seen{background:rgba(245,158,11,.45)}
.zg-photo-hud{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:61;background:rgba(0,0,0,.55);border-radius:10px;padding:6px 12px;font-size:.8em;display:flex;gap:8px;align-items:center}
body.zg-photo .hud-top,body.zg-photo .hud-bottom,body.zg-photo .rail,body.zg-photo .minimap,body.zg-photo .crosshair,body.zg-photo .zone-banner,body.zg-photo .footnote,body.zg-photo .chat,body.zg-photo .drawer,body.zg-photo .zg-tour,body.zg-photo .zg-jhud{display:none!important}
`;
const DEFAULT_DIST = { aerial: [0, 55, 70], front: [0, 6, 34], inside: [0, 2.2, 8], exhibit: [0, 1.8, 4] };

class Tour {
  constructor(sim, opts = {}) {
    this.sim = sim;
    this.beats = (sim.data.tour || []).slice();
    this.index = 0;
    this.active = false;
    this.photo = false;
    this.narrate = !!(sim.settings && sim.settings.tourNarration);
    this.autoplay = false;
    this.card = null;
    this._auto = null;
    this._lastToggle = 0;
    this.dof = { focus: 8, aperture: 0.6 };
    this._onKey = (e) => this.onKey(e);
    if (opts.bindKeys !== false && typeof window !== 'undefined') window.addEventListener('keydown', this._onKey);
  }

  get beat() { return this.beats[this.index]; }

  start(at = 0) {
    if (!this.beats.length) return false;
    injectCSS('zg-tour-css', CSS);
    const i = typeof at === 'string' ? Math.max(0, this.beats.findIndex((b) => b.id === at)) : at;
    if (!this.active) {
      this._prevMode = this.sim.state.mode;
      this.active = true;
      const c = this.sim.services.controls;
      if (c && c.setMode) try { c.setMode('tour'); } catch (e) { /* controls optional */ }
      this.sim.state.mode = 'tour';
      this.sim.bus.emit('tour:start', {});
    }
    this.goto(i);
    return true;
  }

  goto(i) {
    if (!this.active) return this.start(i);
    this.index = Math.max(0, Math.min(this.beats.length - 1, i));
    const b = this.beat;
    this._fly(b);
    this._card(b);
    this._speak(b);
    const st = this.sim.state;
    st.tourSeen = st.tourSeen || {};
    st.tourSeen[b.id] = true;
    this.sim.bus.emit('tour:beat', { id: b.id });
    clearTimeout(this._auto);
    if (this.autoplay) this._auto = setTimeout(() => (this.index < this.beats.length - 1 ? this.next() : this.exit()), Math.max(9000, b.text.length * 65));
    return b;
  }
  next() { return this.index < this.beats.length - 1 ? this.goto(this.index + 1) : this.exit(); }
  prev() { return this.goto(this.index - 1); }

  exit() {
    if (!this.active) return;
    this.active = false;
    clearTimeout(this._auto);
    this._stopSpeech();
    if (this.card) { this.card.remove(); this.card = null; }
    const c = this.sim.services.controls;
    const back = this._prevMode && this._prevMode !== 'tour' ? this._prevMode : 'walk';
    if (c && c.setMode) try { c.setMode(back); } catch (e) { /* optional */ }
    this.sim.state.mode = back;
    this.sim.bus.emit('tour:end', { seen: Object.keys(this.sim.state.tourSeen || {}).length });
  }

  /** Camera framing for a beat: world.focusTargets[zone][view] → {pos, target}, else computed from layout. */
  framing(b) {
    const w = this.sim.services.world;
    const ft = w && w.focusTargets && w.focusTargets[b.zone];
    const f = ft && (ft[b.view] || (ft.pos ? ft : null));
    if (f && f.pos) return { pos: f.pos, target: f.target || f.pos, from: 'world' };
    const z = layout.ZONES[b.zone] || layout.ZONES.courtyard;
    const [cx, , cz] = z.center;
    const d = DEFAULT_DIST[b.view] || DEFAULT_DIST.front;
    // Offset along the zone's entrance direction (toward the courtyard).
    const dirx = b.zone === 'courtyard' ? 0 : -cx / Math.hypot(cx, cz), dirz = b.zone === 'courtyard' ? 1 : -cz / Math.hypot(cx, cz);
    const pos = [cx + dirx * d[2], d[1], cz + dirz * d[2]];
    const target = [cx, b.view === 'aerial' ? 0 : b.view === 'front' ? 5 : 1.5, cz];
    return { pos, target, from: 'layout' };
  }

  _vec(a) {
    if (!Array.isArray(a)) return a;
    const e = this.sim.services.engine || this.sim.services.renderer;
    const V = e && e.camera && e.camera.position && e.camera.position.constructor;
    return V ? new V(a[0], a[1], a[2]) : { x: a[0], y: a[1], z: a[2] };
  }

  _fly(b) {
    const c = this.sim.services.controls;
    const f = this.framing(b);
    const sec = this.sim.settings.reducedMotion ? 0.01 : 2.4;
    if (c && c.flyTo) { try { c.flyTo(this._vec(f.pos), this._vec(f.target), sec); } catch (e) { /* controls optional */ } return f; }
    const w = this.sim.services.world;
    if (w && w.teleport && b.zone !== this.sim.state.zone) { try { w.teleport(b.zone); } catch (e) { /* optional */ } return f; }
    // No 3D world (e.g. text-only fallback): still record the visit.
    if (b.zone && this.sim.state.zone !== b.zone) { this.sim.state.zone = b.zone; this.sim.bus.emit('zone:enter', { zone: b.zone, via: 'tour' }); }
    return f;
  }

  _card(b) {
    if (this.card) this.card.remove();
    const n = this.beats.length;
    const seen = this.sim.state.tourSeen || {};
    const z = layout.ZONES[b.zone];
    const ui = this.sim.services.ui;
    this.card = h('section', { class: 'zg-tour', role: 'region', 'aria-label': 'Guided tour', 'aria-live': 'polite' },
      h('div', { class: 'meta' }, h('span', null, `Beat ${this.index + 1} / ${n}`), h('span', null, 'Week ' + b.week), h('span', null, z ? z.name : b.zone), h('span', null, b.view + ' view')),
      h('h3', null, b.title),
      h('p', null, b.text),
      h('div', { class: 'dots', 'aria-hidden': 'true' }, this.beats.map((x, i) => h('i', { class: i === this.index ? 'on' : seen[x.id] ? 'seen' : '' }))),
      h('div', { class: 'row' },
        btn('◀ Prev', () => this.prev(), 'ghost', { disabled: this.index === 0, 'aria-label': 'Previous beat' }),
        btn(this.index === n - 1 ? 'Finish' : 'Next ▶', () => this.next(), 'teal', { 'aria-label': 'Next beat' }),
        b.panel ? btn('Open ' + b.panel, () => { if (ui && ui.openPanel) ui.openPanel(b.panel); }, '', { 'data-panel': b.panel }) : null,
        btn(this.narrate ? '🔊 Narration on' : '🔈 Narration off', () => { this.setNarration(!this.narrate); this._card(this.beat); }, 'ghost', { 'aria-pressed': String(this.narrate) }),
        btn(this.autoplay ? '⏸ Auto' : '▶ Auto', () => { this.setAutoplay(!this.autoplay); this._card(this.beat); }, 'ghost', { 'aria-pressed': String(this.autoplay) }),
        btn('📷 Photo (P)', () => this.togglePhoto(), 'ghost'),
        btn('Exit tour', () => this.exit(), 'ghost')));
    document.body.appendChild(this.card);
  }

  setNarration(on) { this.narrate = !!on; this.sim.settings.tourNarration = this.narrate; if (!on) this._stopSpeech(); else if (this.active) this._speak(this.beat); }
  setAutoplay(on) { this.autoplay = !!on; if (on && this.active) this.goto(this.index); else clearTimeout(this._auto); }

  _speak(b) {
    this._stopSpeech();
    if (!this.narrate || !b || this.sim.settings.audio === false) return;
    const text = b.title + '. ' + b.text;
    const ai = this.sim.services.ai;
    const v = ai && ai.voice;
    try {
      if (v && typeof v.speak === 'function') { v.speak(text); return; }
      if (typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined') {
        const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.volume = this.sim.settings.volume == null ? 0.8 : this.sim.settings.volume;
        speechSynthesis.speak(u);
      }
    } catch (e) { /* narration is optional */ }
  }
  _stopSpeech() {
    try {
      const v = this.sim.services.ai && this.sim.services.ai.voice;
      if (v && typeof v.stop === 'function') v.stop();
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    } catch (e) { /* optional */ }
  }

  // ---------------------------------------------------------------- photo mode
  togglePhoto(on) {
    const want = on == null ? !this.photo : !!on;
    if (want === this.photo) return this.photo;
    const eng = this.sim.services.engine || this.sim.services.renderer;
    const c = this.sim.services.controls;
    injectCSS('zg-tour-css', CSS);
    this.photo = want;
    if (want) {
      this._photoPrevMode = this.sim.state.mode;
      if (c && c.setMode) try { c.setMode('photo'); } catch (e) { /* optional */ }
      if (eng && eng.setDOF && this.sim.settings.toggles.dof !== false) try { eng.setDOF(Object.assign({}, this.dof)); } catch (e) { /* optional */ }
      document.body.classList.add('zg-photo');
      this.photoHud = h('div', { class: 'zg-photo-hud', role: 'toolbar', 'aria-label': 'Photo mode' },
        h('b', null, 'Photo mode'), h('span', { class: 'note' }, '[ / ] focus · - / = aperture'),
        btn('Snap', () => this.snap(), 'teal'), btn('Exit (P)', () => this.togglePhoto(false), 'ghost'));
      document.body.appendChild(this.photoHud);
    } else {
      if (eng && eng.setDOF) try { eng.setDOF(null); } catch (e) { /* optional */ }
      const back = this.active ? 'tour' : (this._photoPrevMode && this._photoPrevMode !== 'photo' ? this._photoPrevMode : 'walk');
      if (c && c.setMode) try { c.setMode(back); } catch (e) { /* optional */ }
      document.body.classList.remove('zg-photo');
      if (this.photoHud) { this.photoHud.remove(); this.photoHud = null; }
    }
    this.sim.bus.emit('photo:toggle', { on: want });
    return want;
  }

  adjustDOF(dFocus = 0, dAperture = 0) {
    this.dof.focus = Math.max(0.5, Math.min(120, this.dof.focus * Math.pow(1.15, dFocus)));
    this.dof.aperture = Math.max(0.05, Math.min(3, this.dof.aperture + 0.1 * dAperture));
    const eng = this.sim.services.engine || this.sim.services.renderer;
    if (this.photo && eng && eng.setDOF) try { eng.setDOF(Object.assign({}, this.dof)); } catch (e) { /* optional */ }
    return Object.assign({}, this.dof);
  }

  snap() {
    const eng = this.sim.services.engine || this.sim.services.renderer;
    if (!eng || !eng.screenshot) { toast('Screenshot needs the 3D engine.'); return null; }
    try {
      const url = eng.screenshot();
      const bin = atob(url.split(',')[1]); const u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      const r = download(`zehn_photo_${Date.now()}.png`, new Blob([u], { type: 'image/png' }), 'image/png');
      this.sim.bus.emit('export:done', { kind: 'png' });
      return r;
    } catch (e) { toast('Screenshot failed.'); return null; }
  }

  onKey(e) {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    const runner = this.sim.services.runner;
    if (runner && runner.active) return;
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey && !anyModalOpen()) {
      const now = Date.now(); if (now - this._lastToggle < 200) return; // input.js may also route P here
      this._lastToggle = now; this.togglePhoto(); return;
    }
    if (this.photo) {
      if (e.key === '[') this.adjustDOF(-1, 0); else if (e.key === ']') this.adjustDOF(1, 0);
      else if (e.key === '-') this.adjustDOF(0, -1); else if (e.key === '=') this.adjustDOF(0, 1);
      else if (e.key === 'Escape') this.togglePhoto(false);
      return;
    }
    if (!this.active || anyModalOpen()) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); this.next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); this.prev(); }
    else if (e.key === 'Escape') { e.preventDefault(); this.exit(); }
  }

  dispose() { this.exit(); this.togglePhoto(false); if (typeof window !== 'undefined') window.removeEventListener('keydown', this._onKey); }
}

module.exports = { Tour };
