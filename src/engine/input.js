'use strict';
/**
 * Keyboard input + keymap (A3). `new Input(sim)`; read `input.down(code)`, `input.pressed(code)` (edge, once).
 * `input.suspend(true)` while the experiment runner or a modal owns the keyboard (Escape still passes).
 *
 * Keymap → `sim.bus.emit('input:action', { action, ... })`:
 *   1–7 mode (walk, director, participant, clinic, social, neuro, tour) · E use · Tab panels · T talk (RAAHI)
 *   M map · F1 help · P photo · N day/night cycle · Esc escape · F drone · H HUD · F12/PrintScreen screenshot
 */
const MODE_KEYS = { Digit1: 'walk', Digit2: 'director', Digit3: 'participant', Digit4: 'clinic', Digit5: 'social', Digit6: 'neuro', Digit7: 'tour' };
const ACTION_KEYS = { KeyE: 'use', Tab: 'panels', KeyT: 'talk', KeyM: 'map', F1: 'help', KeyP: 'photo', KeyN: 'daynight', Escape: 'escape', KeyF: 'drone', KeyH: 'hud' };
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'KeyC', 'Space', 'KeyQ', 'KeyZ'];

function isTextTarget(t) {
  if (!t) return false;
  const tag = (t.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || !!t.isContentEditable;
}

class Input {
  constructor(sim) {
    this.sim = sim;
    this.keys = new Set();
    this._pressed = new Set();
    this.suspended = false;
    this.enabled = true;
    this._l = [];
    const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); this._l.push([el, ev, fn, opt]); };
    on(window, 'keydown', (e) => this._down(e));
    on(window, 'keyup', (e) => { this.keys.delete(e.code); });
    on(window, 'blur', () => this.keys.clear());
    on(document, 'visibilitychange', () => { if (document.hidden) this.keys.clear(); });
  }

  _down(e) {
    if (!this.enabled) return;
    if (isTextTarget(e.target) && e.code !== 'Escape') return;
    if (this.suspended && e.code !== 'Escape') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    if (!this.keys.has(code)) this._pressed.add(code);
    this.keys.add(code);
    if (MOVE_KEYS.includes(code) || code === 'Tab' || code === 'F1') e.preventDefault();
    if (e.repeat) return;
    const bus = this.sim && this.sim.bus;
    if (!bus) return;
    if (MODE_KEYS[code]) bus.emit('input:action', { action: 'mode', mode: MODE_KEYS[code], key: code });
    else if (ACTION_KEYS[code]) bus.emit('input:action', { action: ACTION_KEYS[code], key: code });
  }

  /** Is a key held? (KeyboardEvent.code) */
  down(code) { return !this.suspended && this.keys.has(code); }
  any(codes) { for (const c of codes) if (this.down(c)) return true; return false; }
  /** True once per physical press. */
  pressed(code) { if (this.suspended) return false; const p = this._pressed.has(code); this._pressed.delete(code); return p; }
  /** Call at the end of a frame to drop unread edges. */
  endFrame() { this._pressed.clear(); }

  /** Suspend game input (experiment runner, modals). Clears held keys so nothing "sticks". */
  suspend(on) {
    this.suspended = on === undefined ? true : !!on;
    this.keys.clear(); this._pressed.clear();
    if (this.sim && this.sim.bus) this.sim.bus.emit('input:suspend', { suspended: this.suspended });
  }

  dispose() { for (const [el, ev, fn, opt] of this._l) el.removeEventListener(ev, fn, opt); this._l = []; }
}

module.exports = { Input, MODE_KEYS, ACTION_KEYS };
