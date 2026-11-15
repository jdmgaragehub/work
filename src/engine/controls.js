'use strict';
/**
 * Camera controls for every mode (A3). `new Controls(sim, engine)`, then `controls.setWorld(world)`.
 *
 * Modes: walk (FPS: pointer lock on canvas click, WASD/arrows, Shift run, C crouch, Space jump, AABB
 * collisions vs world.colliders, gravity onto floors/collider tops, step-up 0.45 m, head-bob unless reduced
 * motion) · participant / clinic / social (walk variants) · director (orbit: drag, wheel, WASD pans) ·
 * neuro (6-DoF fly, Space/C up/down, Q/E roll) · tour (scripted: flyTo beats; drag to look around) ·
 * photo (free cam + DOF; wheel = focus, [ ] = aperture) · drone (free fly above the campus, min 12 m).
 * Touch: virtual joystick (left 40 % of the screen) + drag-to-look (right), pinch = zoom in director.
 * API: setMode, teleport({pos, yaw, pitch}), flyTo(pos, target, sec) → Promise, lookTarget(), update(dt).
 * Emits 'mode:change' {mode, sub}, 'zone:enter' {zone} (when walking across a boundary), 'interact' {id}.
 */
const THREE = require('three');
const { Input } = require('./input.js');

const WALK_MODES = { walk: 1, participant: 1, clinic: 1, social: 1 };
const FLY_MODES = { neuro: 1, photo: 1, drone: 1 };
const MAIN_MODE = { photo: 'tour', drone: 'tour' };
const MODES = ['walk', 'director', 'participant', 'clinic', 'social', 'neuro', 'tour', 'photo', 'drone'];
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

class Controls {
  constructor(sim, engine) {
    this.sim = sim; this.engine = engine; this.camera = engine.camera;
    this.camera.rotation.order = 'YXZ';
    this.input = (sim.services && sim.services.input) || new Input(sim);
    this.dom = engine.renderer.domElement;
    this.world = null;
    this.mode = 'walk';
    this.pos = new THREE.Vector3(0, 1.65, 18);   // eye position
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; this.pitch = 0; this.roll = 0;
    this.eye = 1.65; this.crouchEye = 1.1; this.radius = 0.32; this.step = 0.45;
    this.grounded = true; this.crouch = 0; this.bob = 0; this.bobAmt = 0;
    this.orbit = { target: new THREE.Vector3(0, 0, 0), dist: 60, yaw: Math.PI * 0.25, pitch: 0.6 };
    this.flight = null;
    this.enabled = true;
    this.photo = { focus: 6, aperture: 1.8 };
    this.bounds = 230;
    this._zoneTimer = 0;
    this._look = { dx: 0, dy: 0 };
    this._drag = null;
    this.touch = { stick: null, look: null, mx: 0, my: 0, used: false, pinch: 0 };
    this._l = [];
    this._bindDom();
    this._offBus = sim.bus.on('input:action', (a) => this._onAction(a));
    this._apply();
  }

  /* ------------------------------------------------------------- wiring */
  setWorld(world) { this.world = world; }

  _on(el, ev, fn, opt) { el.addEventListener(ev, fn, opt); this._l.push([el, ev, fn, opt]); }

  _bindDom() {
    const dom = this.dom;
    try { dom.style.touchAction = 'none'; } catch (e) { /* ignore */ }
    // Pointer lock ONLY on a canvas click, only in modes that use it; Esc releases (browser default).
    this._on(dom, 'click', () => {
      if (!this.enabled || this.input.suspended || this.touch.used) return;
      if ((WALK_MODES[this.mode] || FLY_MODES[this.mode]) && document.pointerLockElement !== dom && dom.requestPointerLock) {
        try { const p = dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* unsupported */ }
      }
    });
    this._on(document, 'pointerlockchange', () => { this.locked = document.pointerLockElement === dom; this.sim.bus.emit('pointerlock', { locked: this.locked }); });
    this._on(document, 'mousemove', (e) => {
      if (!this.enabled || this.input.suspended) return;
      if (this.locked) { this._look.dx += e.movementX || 0; this._look.dy += e.movementY || 0; }
      else if (this._drag && this._drag.type === 'mouse') { this._look.dx += e.clientX - this._drag.x; this._look.dy += e.clientY - this._drag.y; this._drag.x = e.clientX; this._drag.y = e.clientY; }
    });
    this._on(dom, 'mousedown', (e) => { if (!this.locked) this._drag = { type: 'mouse', x: e.clientX, y: e.clientY, button: e.button }; });
    this._on(window, 'mouseup', () => { if (this._drag && this._drag.type === 'mouse') this._drag = null; });
    this._on(dom, 'contextmenu', (e) => { if (this.mode === 'director') e.preventDefault(); });
    this._on(dom, 'wheel', (e) => {
      if (!this.enabled || this.input.suspended) return;
      const d = Math.sign(e.deltaY);
      if (this.mode === 'director') this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (1 + d * 0.1), 4, 260);
      else if (this.mode === 'photo') { this.photo.focus = THREE.MathUtils.clamp(this.photo.focus * (1 - d * 0.08), 0.5, 200); this._syncDOF(); }
      else if (FLY_MODES[this.mode]) this.camera.fov = THREE.MathUtils.clamp(this.camera.fov + d * 2, 25, 90), this.camera.updateProjectionMatrix();
      e.preventDefault();
    }, { passive: false });
    // Touch (pointer events): joystick left, look right, pinch for director zoom.
    this._on(dom, 'pointerdown', (e) => {
      if (e.pointerType !== 'touch' || !this.enabled) return;
      this.touch.used = true;
      const w = window.innerWidth || dom.clientWidth;
      if (e.clientX < w * 0.4 && !this.touch.stick) { this.touch.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY }; this._showStick(e.clientX, e.clientY, 0, 0); }
      else if (!this.touch.look) this.touch.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      else this.touch.pinch = { id: e.pointerId, d: Math.hypot(e.clientX - this.touch.look.x, e.clientY - this.touch.look.y) };
    });
    this._on(dom, 'pointermove', (e) => {
      if (e.pointerType !== 'touch') return;
      const t = this.touch;
      if (t.stick && t.stick.id === e.pointerId) {
        let dx = e.clientX - t.stick.x0, dy = e.clientY - t.stick.y0; const l = Math.hypot(dx, dy), R = 55;
        if (l > R) { dx *= R / l; dy *= R / l; }
        t.mx = dx / R; t.my = dy / R; this._showStick(t.stick.x0, t.stick.y0, dx, dy);
      } else if (t.look && t.look.id === e.pointerId) {
        this._look.dx += (e.clientX - t.look.x) * 1.4; this._look.dy += (e.clientY - t.look.y) * 1.4; t.look.x = e.clientX; t.look.y = e.clientY;
      } else if (t.pinch && t.pinch.id === e.pointerId && t.look) {
        const d = Math.hypot(e.clientX - t.look.x, e.clientY - t.look.y);
        if (this.mode === 'director') this.orbit.dist = THREE.MathUtils.clamp(this.orbit.dist * (t.pinch.d / Math.max(1, d)), 4, 260);
        t.pinch.d = d;
      }
    });
    const end = (e) => {
      if (e.pointerType !== 'touch') return;
      const t = this.touch;
      if (t.stick && t.stick.id === e.pointerId) { t.stick = null; t.mx = t.my = 0; this._hideStick(); }
      if (t.look && t.look.id === e.pointerId) t.look = null;
      if (t.pinch && t.pinch.id === e.pointerId) t.pinch = 0;
    };
    this._on(dom, 'pointerup', end); this._on(dom, 'pointercancel', end);
  }

  _showStick(x, y, dx, dy) {
    if (!this._stickEl) {
      const base = document.createElement('div'), knob = document.createElement('div');
      base.setAttribute('aria-hidden', 'true');
      base.style.cssText = 'position:fixed;width:110px;height:110px;margin:-55px 0 0 -55px;border-radius:50%;border:2px solid rgba(248,250,252,.55);background:rgba(30,27,75,.35);pointer-events:none;z-index:40;';
      knob.style.cssText = 'position:absolute;left:30px;top:30px;width:50px;height:50px;border-radius:50%;background:rgba(245,158,11,.8);';
      base.appendChild(knob); document.body.appendChild(base); this._stickEl = base; this._knobEl = knob;
    }
    this._stickEl.style.display = 'block'; this._stickEl.style.left = x + 'px'; this._stickEl.style.top = y + 'px';
    this._knobEl.style.transform = `translate(${dx}px,${dy}px)`;
  }
  _hideStick() { if (this._stickEl) this._stickEl.style.display = 'none'; }

  _onAction(a) {
    if (!this.enabled) return;
    if (a.action === 'mode') this.setMode(a.mode);
    else if (a.action === 'photo') this.setMode(this.mode === 'photo' ? 'tour' : 'photo');
    else if (a.action === 'drone') this.setMode(this.mode === 'drone' ? 'walk' : 'drone');
    else if (a.action === 'use') { const it = this.lookTarget(); if (it) { this.sim.bus.emit('interact', { id: it.id, zone: it.zone }); if (typeof it.onUse === 'function') it.onUse(); } }
  }

  /* -------------------------------------------------------------- modes */
  setMode(mode) {
    if (MODES.indexOf(mode) < 0) return false;
    const prev = this.mode; if (prev === mode) return true;
    this.mode = mode; this.flight = null; this.vel.set(0, 0, 0); this.roll = 0;
    if (this.camera.fov !== 70) { this.camera.fov = 70; this.camera.updateProjectionMatrix(); }
    if (mode === 'director') {
      // Orbit around the point the camera was looking at.
      const fwd = this.camera.getWorldDirection(_v);
      const t = _v2.copy(this.camera.position).addScaledVector(fwd, 30); t.y = 0;
      this.orbit.target.copy(t); this.orbit.dist = Math.max(40, this.camera.position.distanceTo(t)); this.orbit.yaw = this.yaw; this.orbit.pitch = 0.65;
      if (this.locked && document.exitPointerLock) document.exitPointerLock();
    }
    if (mode === 'drone') { this.pos.y = Math.max(this.pos.y, 30); this.pitch = -0.35; }
    if (WALK_MODES[mode] && FLY_MODES[prev]) { this.pos.y = this._groundAt(this.pos.x, this.pos.z, 200) + this.eye; this.grounded = true; }
    if (WALK_MODES[mode] && prev === 'director') { this.pos.copy(this.camera.position); this.pos.y = this._groundAt(this.pos.x, this.pos.z, 200) + this.eye; }
    this._syncDOF();
    this.sim.state.mode = MAIN_MODE[mode] || mode;
    this.sim.state.subMode = mode;
    this.sim.bus.emit('mode:change', { mode: MAIN_MODE[mode] || mode, sub: mode });
    return true;
  }

  _syncDOF() {
    if (!this.engine.setDOF) return;
    if (this.mode === 'photo') this.engine.setDOF({ focus: this.photo.focus, aperture: this.photo.aperture });
    else if (this.mode === 'tour') this.engine.setDOF({ focus: 0, aperture: 1.2 });
    else this.engine.setDOF(null);
  }

  teleport(o) {
    o = o || {};
    const p = o.pos || [0, 1.65, 0];
    this.pos.set(p[0], p[1], p[2]);
    if (o.yaw != null) this.yaw = o.yaw;
    this.pitch = o.pitch || 0; this.vel.set(0, 0, 0); this.flight = null; this.grounded = false;
    if (this.mode === 'director') { this.orbit.target.set(p[0], 0, p[2]); this.orbit.yaw = this.yaw; }
    if (this.engine.postfx) this.engine.postfx.resetHistory();
    this._apply();
  }

  /** Smooth camera move (tour beats, zone framing). target = point to look at. Resolves on arrival. */
  flyTo(pos, target, sec) {
    const P = pos.isVector3 ? pos.clone() : new THREE.Vector3(pos[0], pos[1], pos[2]);
    const T = target ? (target.isVector3 ? target.clone() : new THREE.Vector3(target[0], target[1], target[2])) : null;
    const m = new THREE.Matrix4().lookAt(P, T || P.clone().add(this.camera.getWorldDirection(_v)), new THREE.Vector3(0, 1, 0));
    const q1 = new THREE.Quaternion().setFromRotationMatrix(m);
    const reduced = this.sim.settings && this.sim.settings.reducedMotion;
    const dur = reduced ? 0.001 : Math.max(0.05, sec == null ? 2 : sec);
    if (this.flight && this.flight.resolve) this.flight.resolve(false);
    return new Promise((resolve) => {
      this.flight = { p0: this.camera.position.clone(), q0: this.camera.quaternion.clone(), p1: P, q1, T, t: 0, dur, resolve };
    });
  }

  /** Nearest interactable in the view cone (cos > 0.8) within its own radius. Raycast-free. */
  lookTarget() {
    const w = this.world; if (!w || !w.interactables) return null;
    const cam = this.camera.position, fwd = this.camera.getWorldDirection(_v2);
    let best = null, bd = Infinity;
    for (const it of w.interactables) {
      if (!it || !it.pos) continue;
      const d = _v.copy(it.pos).sub(cam), dist = d.length(), r = it.radius || 2.5;
      if (dist > r + 0.8) continue;
      if (dist > 0.6 && d.dot(fwd) / dist < 0.8) continue;
      if (dist < bd) { bd = dist; best = it; }
    }
    return best;
  }

  /* ----------------------------------------------------------- collision */
  _colliders() { return (this.world && this.world.colliders) || []; }

  /** Highest walkable surface under (x,z) at or below `maxY` (feet + step). Ground plane = 0. */
  _groundAt(x, z, maxY) {
    let g = 0; const r = this.radius * 0.7;
    for (const b of this._colliders()) {
      if (x < b.min.x - r || x > b.max.x + r || z < b.min.z - r || z > b.max.z + r) continue;
      if (b.max.y <= maxY && b.max.y > g) g = b.max.y;
    }
    return g;
  }

  /** Push the body (feet..head) out of colliders on the XZ plane. */
  _collide(p, feet, head) {
    const r = this.radius;
    for (const b of this._colliders()) {
      if (b.max.y <= feet + this.step || b.min.y >= head) continue;
      const cx = THREE.MathUtils.clamp(p.x, b.min.x, b.max.x), cz = THREE.MathUtils.clamp(p.z, b.min.z, b.max.z);
      let dx = p.x - cx, dz = p.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2), push = r - d; p.x += dx / d * push; p.z += dz / d * push; }
      else { // centre inside the box: exit along the shallowest axis
        const ex = [p.x - b.min.x + r, b.max.x - p.x + r, p.z - b.min.z + r, b.max.z - p.z + r], i = ex.indexOf(Math.min.apply(null, ex));
        if (i === 0) p.x = b.min.x - r; else if (i === 1) p.x = b.max.x + r; else if (i === 2) p.z = b.min.z - r; else p.z = b.max.z + r;
      }
    }
  }

  /* -------------------------------------------------------------- update */
  _moveAxes() {
    const I = this.input; let f = 0, s = 0;
    if (I.any(['KeyW', 'ArrowUp'])) f += 1; if (I.any(['KeyS', 'ArrowDown'])) f -= 1;
    if (I.any(['KeyD', 'ArrowRight'])) s += 1; if (I.any(['KeyA', 'ArrowLeft'])) s -= 1;
    f -= this.touch.my; s += this.touch.mx;
    const l = Math.hypot(f, s); if (l > 1) { f /= l; s /= l; }
    return { f, s };
  }

  update(dt) {
    dt = Math.min(dt, 0.1);
    if (this.flight) { this._updateFlight(dt); return; }
    if (!this.enabled) { this._apply(); return; }
    const sens = 0.0022 * ((this.sim.settings && this.sim.settings.mouseSens) || 1);
    const inv = this.sim.settings && this.sim.settings.invertY ? -1 : 1;
    const lx = this._look.dx, ly = this._look.dy; this._look.dx = this._look.dy = 0;
    const m = this.mode;
    if (m === 'director') this._updateOrbit(dt, lx, ly, sens);
    else {
      const dragOK = this.locked || this._drag || this.touch.look;
      if (dragOK) { this.yaw -= lx * sens; this.pitch = THREE.MathUtils.clamp(this.pitch - ly * sens * inv, -1.45, 1.45); }
      if (m === 'tour') { /* scripted: look-around only */ }
      else if (FLY_MODES[m]) this._updateFly(dt);
      else this._updateWalk(dt);
    }
    this._apply();
    this._zoneTimer -= dt;
    if (this._zoneTimer <= 0 && this.world && typeof this.world.zoneAt === 'function') {
      this._zoneTimer = 0.3;
      let z = null; try { z = this.world.zoneAt(this.camera.position); } catch (e) { z = null; }
      if (z && z !== this.sim.state.zone) { this.sim.state.zone = z; this.sim.bus.emit('zone:enter', { zone: z }); }
    }
  }

  _updateWalk(dt) {
    const I = this.input, mv = this._moveAxes();
    const crouching = I.down('KeyC');
    this.crouch += ((crouching ? 1 : 0) - this.crouch) * Math.min(1, dt * 10);
    const run = I.any(['ShiftLeft', 'ShiftRight']) && !crouching;
    let speed = crouching ? 1.4 : run ? 6.5 : 3.2;
    if (this.mode === 'clinic') speed *= 0.7;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    const wx = (-sy * mv.f + cy * mv.s) * speed, wz = (-cy * mv.f - sy * mv.s) * speed;
    const k = Math.min(1, dt * (this.grounded ? 12 : 2));
    this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    const eye = this.eye + (this.crouchEye - this.eye) * this.crouch;
    let feet = this.pos.y - eye;
    if (this.grounded && I.pressed('Space')) { this.vel.y = 4.8; this.grounded = false; }
    this.vel.y -= 18 * dt;
    const np = _v.set(this.pos.x + this.vel.x * dt, feet + this.vel.y * dt, this.pos.z + this.vel.z * dt);
    this._collide(np, np.y, np.y + eye + 0.1);
    np.x = THREE.MathUtils.clamp(np.x, -this.bounds, this.bounds); np.z = THREE.MathUtils.clamp(np.z, -this.bounds, this.bounds);
    const g = this._groundAt(np.x, np.z, feet + this.step);
    if (np.y <= g) { np.y = g; this.vel.y = 0; this.grounded = true; } else if (np.y - g < 0.06 && this.vel.y <= 0) { np.y = g; this.vel.y = 0; this.grounded = true; } else this.grounded = false;
    feet = np.y;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const reduced = this.sim.settings && this.sim.settings.reducedMotion;
    this.bobAmt += (((this.grounded && hs > 0.5 && !reduced) ? Math.min(1, hs / 6) : 0) - this.bobAmt) * Math.min(1, dt * 8);
    this.bob += hs * dt * 2.1;
    this.pos.set(np.x, feet + eye, np.z);
  }

  _updateFly(dt) {
    const I = this.input, mv = this._moveAxes(), m = this.mode;
    const base = m === 'drone' ? 22 : m === 'neuro' ? 3.5 : 6;
    const speed = base * (I.any(['ShiftLeft', 'ShiftRight']) ? 3 : 1);
    const q = _q.setFromEuler(_e.set(this.pitch, this.yaw, this.roll, 'YXZ'));
    const fwd = _v.set(0, 0, -1).applyQuaternion(q), right = _v2.set(1, 0, 0).applyQuaternion(q);
    if (m === 'drone') { fwd.y = 0; fwd.normalize(); right.y = 0; right.normalize(); }
    let up = 0; if (I.down('Space')) up += 1; if (I.any(['KeyC', 'KeyZ'])) up -= 1;
    const target = new THREE.Vector3().addScaledVector(fwd, mv.f * speed).addScaledVector(right, mv.s * speed);
    target.y += up * speed * 0.7;
    this.vel.lerp(target, Math.min(1, dt * 4));
    this.pos.addScaledVector(this.vel, dt);
    if (m === 'neuro') { if (I.down('KeyQ')) this.roll += dt; if (I.down('KeyE')) this.roll -= dt; }
    if (m === 'drone') this.pos.y = THREE.MathUtils.clamp(this.pos.y, 12, 180);
    if (m === 'photo') this.pos.y = Math.max(this.pos.y, 0.3);
    if (m === 'photo') { if (I.pressed('BracketLeft')) { this.photo.aperture = Math.max(0.4, this.photo.aperture * 0.8); this._syncDOF(); } if (I.pressed('BracketRight')) { this.photo.aperture = Math.min(6, this.photo.aperture * 1.25); this._syncDOF(); } }
    const B = this.bounds * 1.3;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -B, B); this.pos.z = THREE.MathUtils.clamp(this.pos.z, -B, B);
  }

  _updateOrbit(dt, lx, ly, sens) {
    const o = this.orbit, I = this.input;
    if (this._drag || this.touch.look) {
      const pan = this._drag && this._drag.button === 2;
      if (pan) {
        const s = o.dist * 0.0016, sy = Math.sin(o.yaw), cy = Math.cos(o.yaw);
        o.target.x -= (cy * lx - sy * ly) * s; o.target.z -= (-sy * lx - cy * ly) * s;
      } else { o.yaw -= lx * sens * 1.4; o.pitch = THREE.MathUtils.clamp(o.pitch + ly * sens * 1.4, 0.08, 1.45); }
    }
    const mv = this._moveAxes(), sp = o.dist * 0.9 * dt, sy = Math.sin(o.yaw), cy = Math.cos(o.yaw);
    o.target.x += (-sy * mv.f + cy * mv.s) * sp; o.target.z += (-cy * mv.f - sy * mv.s) * sp;
    if (I.down('KeyQ')) o.yaw += dt; if (I.down('KeyE')) o.yaw -= dt;
    o.target.x = THREE.MathUtils.clamp(o.target.x, -this.bounds, this.bounds); o.target.z = THREE.MathUtils.clamp(o.target.z, -this.bounds, this.bounds);
  }

  _updateFlight(dt) {
    const f = this.flight; f.t += dt;
    const a = Math.min(1, f.t / f.dur), e = a < 0.5 ? 4 * a * a * a : 1 - Math.pow(-2 * a + 2, 3) / 2;
    this.camera.position.lerpVectors(f.p0, f.p1, e);
    // Gentle arc so long flights rise over buildings.
    this.camera.position.y += Math.sin(Math.PI * e) * Math.min(25, f.p0.distanceTo(f.p1) * 0.15);
    this.camera.quaternion.slerpQuaternions(f.q0, f.q1, e);
    this.camera.updateMatrixWorld();
    if (a >= 1) {
      this.flight = null;
      this.pos.copy(f.p1);
      _e.setFromQuaternion(f.q1, 'YXZ'); this.yaw = _e.y; this.pitch = _e.x;
      if (this.mode === 'director' && f.T) { this.orbit.target.copy(f.T); this.orbit.dist = f.p1.distanceTo(f.T); this.orbit.yaw = this.yaw; this.orbit.pitch = Math.max(0.08, -this.pitch); }
      f.resolve(true);
    }
  }

  _apply() {
    const c = this.camera;
    if (this.mode === 'director') {
      const o = this.orbit, cp = Math.cos(o.pitch);
      c.position.set(o.target.x + Math.sin(o.yaw) * cp * o.dist, o.target.y + Math.sin(o.pitch) * o.dist, o.target.z + Math.cos(o.yaw) * cp * o.dist);
      c.position.y = Math.max(c.position.y, 1.5);
      c.lookAt(o.target);
    } else {
      c.position.copy(this.pos);
      let bobY = 0, bobR = 0;
      if (this.bobAmt > 0.001) { bobY = Math.abs(Math.sin(this.bob * Math.PI)) * 0.045 * this.bobAmt; bobR = Math.sin(this.bob * Math.PI) * 0.004 * this.bobAmt; }
      c.position.y += bobY;
      c.rotation.set(this.pitch, this.yaw, this.roll + bobR, 'YXZ');
    }
    c.updateMatrixWorld();
  }

  dispose() {
    for (const [el, ev, fn, opt] of this._l) el.removeEventListener(ev, fn, opt);
    this._l = []; if (this._offBus) this._offBus();
    if (this._stickEl && this._stickEl.parentNode) this._stickEl.parentNode.removeChild(this._stickEl);
  }
}

module.exports = { Controls, MODES };
