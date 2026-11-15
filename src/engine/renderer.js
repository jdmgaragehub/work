'use strict';
/**
 * Engine (A3): WebGL context, scene, camera, frame loop, quality tiers and the post chain.
 *
 *   const engine = new Engine(sim, canvas);
 *   engine.scene / engine.camera (fov 70) / engine.renderer / engine.tier / engine.mats / engine.tex / engine.sky
 *   engine.addUpdate(fn(dt, t)) → remove()   ·  engine.start()  ·  engine.stop()
 *   engine.setExperimentMode(bool)           ·  engine.setQuality('auto'|tier)  ·  engine.setToggle(name, bool)
 *   engine.setTimeOfDay('day'|'dusk'|'night') ·  engine.screenshot() → PNG dataURL  ·  engine.stats
 *   engine.setEmotionGrade({valence, arousal}|null)  ·  engine.setDOF({focus, aperture}|null)
 *   engine.volumetric: [{ position, direction, angle, range, color, intensity, enabled }] (addVolumetric(opts))
 *   engine.refreshSSR() — re-scan the scene for materials/meshes flagged userData.ssr (also every 2 s)
 *
 * Environment hooks without extra wiring: `scene.userData.interiorAt(pos) → bool` (world) blends the
 * interior look. Emits 'quality:change' {tier}, 'time:change' {time}, 'engine:experiment' {on}.
 */
const THREE = require('three');
const { QualityManager, TIERS, BUDGETS } = require('./quality.js');
const { PostFX, SSR_LAYER, SSS_UNIFORM } = require('./postfx.js');
const { TextureLibrary } = require('./textures.js');
const { MaterialLibrary } = require('./materials.js');
const { Sky } = require('./sky.js');

const MOOD_CYCLE = ['day', 'dusk', 'night'];

class Engine {
  constructor(sim, canvas) {
    this.sim = sim; this.canvas = canvas;
    sim.settings = sim.settings || {}; sim.settings.toggles = sim.settings.toggles || {};
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: false, alpha: false, stencil: false, depth: true, powerPreference: 'high-performance',
      preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false,
    });
    const r = this.renderer;
    r.setClearColor(0x000000, 1); r.autoClear = false;
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.NoToneMapping; // tonemapped in the composite
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;

    const forced = sim.settings.quality && sim.settings.quality !== 'auto' ? sim.settings.quality : null;
    this.quality = new QualityManager(r, { forced });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, this.quality.settings.viewDistance);
    this.camera.position.set(0, 1.65, 18);
    this.camera.layers.enable(0);
    this.postfx = new PostFX(r, this.quality, sim);
    this.tex = new TextureLibrary(this.quality);
    this.mats = new MaterialLibrary(this.tex, this.quality);
    this.sky = new Sky(this);
    this.volumetric = [];
    this._updates = [];
    this.experimentMode = false;
    this.running = false; this.frame = 0; this.time = 0; this.lastDt = 1 / 60;
    this._interior = 0; this._sunScreen = new THREE.Vector2(0.5, 0.5); this._sunVis = 0;
    this._unjittered = new THREE.Matrix4(); this._tmp = new THREE.Vector3();
    this._scene = { calls: 0, triangles: 0 };
    this._ssrTimer = 0; this._errCount = 0; this.contextLost = false;
    if (!sim.renderer) sim.renderer = this;

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize, { passive: true });
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(this._onResize); this._ro.observe(canvas); }
    this._onLost = (e) => { e.preventDefault(); this.contextLost = true; };
    this._onRestored = () => { this.contextLost = false; this.postfx.resetHistory(); this.resize(); };
    canvas.addEventListener('webglcontextlost', this._onLost, false);
    canvas.addEventListener('webglcontextrestored', this._onRestored, false);
    this._offs = [];
    if (sim.bus) {
      this._offs.push(sim.bus.on('input:action', (a) => {
        if (a.action === 'daynight') this.setTimeOfDay(MOOD_CYCLE[(MOOD_CYCLE.indexOf(this.sky.mood) + 1) % 3]);
      }));
    }
    this.quality.onChange(() => this._applyQuality());
    this._applyQuality(true);
    this.setTimeOfDay((sim.state && sim.state.timeOfDay) || 'day', true);
  }

  get tier() { return this.quality.tier; }
  get budget() { return this.quality.budget; }
  /** Alias for A2 kit: engine.materials === engine.mats */
  get materials() { return this.mats; }

  /* --------------------------------------------------------------- setup */
  _applyQuality(initial) {
    const s = this.quality.settings, r = this.renderer;
    r.shadowMap.enabled = !!s.shadows;
    r.shadowMap.type = s.shadowSoft ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    r.shadowMap.autoUpdate = this.quality.tier !== 'low';
    this.camera.far = s.viewDistance; this.camera.updateProjectionMatrix();
    this.sky.applyQuality();
    this.tex.applyAnisotropy();
    // Program defines depend on shadow type: force material recompile on tier change.
    if (!initial) this.scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    this.resize();
    if (!initial && this.sim.bus) this.sim.bus.emit('quality:change', { tier: this.quality.tier });
  }

  resize() {
    const c = this.canvas;
    const w = Math.max(1, c.clientWidth || window.innerWidth || 1), h = Math.max(1, c.clientHeight || window.innerHeight || 1);
    const pr = this.quality.pixelRatio;
    if (this._size && this._size.w === w && this._size.h === h && this._size.pr === pr && this._size.tier === this.tier) return;
    this._size = { w, h, pr, tier: this.tier };
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.postfx.setSize(Math.floor(w * pr), Math.floor(h * pr)); // disposes + rebuilds all RTs
  }

  addUpdate(fn) { this._updates.push(fn); return () => { const i = this._updates.indexOf(fn); if (i >= 0) this._updates.splice(i, 1); }; }

  addVolumetric(o) {
    const l = {
      position: o.position ? o.position.clone() : new THREE.Vector3(), direction: (o.direction ? o.direction.clone() : new THREE.Vector3(0, -1, 0)).normalize(),
      angle: o.angle || 0.3, range: o.range || 18, color: new THREE.Color(o.color != null ? o.color : 0xffe2b0), intensity: o.intensity == null ? 1 : o.intensity, enabled: true,
    };
    this.volumetric.push(l);
    return l;
  }
  removeVolumetric(l) { const i = this.volumetric.indexOf(l); if (i >= 0) this.volumetric.splice(i, 1); }

  /* ------------------------------------------------------------- public */
  setQuality(tier) {
    if (tier !== 'auto' && !TIERS[tier]) return false;
    this.sim.settings.quality = tier;
    if (this.sim.saveSettings) this.sim.saveSettings();
    if (tier === 'auto') { this.quality.setTier('auto'); return true; } // re-tiers from frame time, never into ultra
    this.quality.setTier(tier);
    return true;
  }

  setToggle(name, on) {
    this.sim.settings.toggles[name] = !!on;
    if (this.sim.saveSettings) this.sim.saveSettings();
    if (name === 'taa') this.postfx.resetHistory();
    if (this.sim.bus) this.sim.bus.emit('settings:toggle', { name, on: !!on });
    return true;
  }

  setTimeOfDay(mood, instant) {
    if (!this.sky.setTimeOfDay(mood, instant)) return false;
    if (this.sim.state) this.sim.state.timeOfDay = mood;
    if (this.sim.bus) this.sim.bus.emit('time:change', { time: mood });
    return true;
  }

  setEmotionGrade(g) {
    const e = this.postfx.emotion;
    if (!g || !this.sim.settings.emotionGrade) { e.target = 0; return; }
    e.valence = THREE.MathUtils.clamp(+g.valence || 0, -1, 1); e.arousal = THREE.MathUtils.clamp(+g.arousal || 0, -1, 1); e.target = 1;
  }

  setDOF(o) {
    const p = this.postfx;
    if (!o) { p.dofOn = false; p.focus = 0; return; }
    p.dofOn = true; p.focus = Math.max(0, +o.focus || 0); p.aperture = THREE.MathUtils.clamp(o.aperture == null ? 1.6 : +o.aperture, 0.2, 8);
  }

  setExperimentMode(on) {
    this.experimentMode = !!on; this.postfx.minimal = !!on;
    if (!on) { this.postfx.resetHistory(); this._last = performance.now(); }
    if (this.sim.bus) this.sim.bus.emit('engine:experiment', { on: !!on });
  }

  refreshSSR() {
    let n = 0;
    this.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      const flag = (o.userData && o.userData.ssr) || (m && m.userData && m.userData.ssr);
      if (flag) { o.layers.enable(SSR_LAYER); n++; } else if (o.layers.isEnabled(SSR_LAYER)) o.layers.disable(SSR_LAYER);
    });
    this.postfx.ssrCount = n;
    return n;
  }

  warmup() { try { this.renderer.compile(this.scene, this.camera); } catch (e) { /* optimisation only */ } }

  /* ---------------------------------------------------------------- loop */
  start() {
    if (this.running) return;
    this.running = true; this._last = performance.now();
    const loop = (now) => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(loop);
      this.tick(now);
    };
    this._raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; if (this._raf) cancelAnimationFrame(this._raf); }

  tick(now) {
    now = now == null ? performance.now() : now;
    const raw = Math.max(0, (now - (this._last || now)) / 1000), dt = Math.min(0.1, raw); this._last = now;
    this.lastDt = dt || 1 / 60;
    if (this.experimentMode || this.contextLost || (typeof document !== 'undefined' && document.hidden)) return;
    this.time += dt; this.frame++;
    this.quality.update(raw || 1 / 60); // unclamped: fps stat must reflect real frame time
    for (let i = 0; i < this._updates.length; i++) {
      try { this._updates[i](dt, this.time); } catch (e) { if (this._errCount++ < 5) console.error('[engine] update failed', e); }
    }
    this.render(dt);
  }

  _environment() {
    const ud = this.scene.userData || {};
    let interior = 0;
    if (typeof ud.interiorAt === 'function') { try { interior = ud.interiorAt(this.camera.position) ? 1 : 0; } catch (e) { interior = 0; } }
    this._interior += (interior - this._interior) * Math.min(1, this.lastDt * 3);
    const st = this.sky.state;
    this.postfx.setEnvironment({ night: st.night, golden: st.golden, interior: this._interior, photo: this.postfx.dofOn && this.postfx.focus > 0 ? 1 : 0 });
    // Sun in screen space for god-rays / lens flare / info pass.
    const cam = this.camera, p = this._tmp.copy(this.sky.sunDir).multiplyScalar(500).add(cam.position).project(cam);
    this._sunScreen.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    const onScreen = p.z < 1 ? THREE.MathUtils.clamp(1 - (Math.max(Math.abs(p.x), Math.abs(p.y)) - 0.85) / 0.6, 0, 1) : 0;
    this._sunVis = onScreen * st.sunAbove * (1 - st.night) * (1 - this._interior);
  }

  render(dt) {
    if (this.contextLost) return;
    dt = dt == null ? this.lastDt : dt;
    const s = this.sim.settings, tg = s.toggles || {};
    const pf = this.postfx;
    pf.reducedMotion = !!s.reducedMotion;
    SSS_UNIFORM.value = this.quality.settings.sss && tg.sss !== false ? 1 : 0;
    this.sky.update(dt, this.time, this.camera);
    this.mats.update(dt);
    this._ssrTimer -= dt;
    if (this._ssrTimer <= 0) { this._ssrTimer = 2; this.refreshSSR(); }
    // Low tier: shadows refresh every 3rd frame.
    if (!this.renderer.shadowMap.autoUpdate) this.renderer.shadowMap.needsUpdate = this.frame % 3 === 0;
    this._environment();
    const cam = this.camera;
    cam.updateMatrixWorld();
    this._unjittered.copy(cam.projectionMatrix);
    const j = this.experimentMode ? { x: 0, y: 0 } : pf.nextJitter();
    const jittered = j.x !== 0 || j.y !== 0;
    if (jittered) cam.setViewOffset(pf.width, pf.height, j.x, j.y, pf.width, pf.height);
    const r = this.renderer;
    r.setRenderTarget(pf.sceneRT); r.clear(true, true, false);
    r.render(this.scene, cam);
    this._scene.calls = r.info.render.calls; this._scene.triangles = r.info.render.triangles;
    const ctx = { scene: this.scene, camera: cam, time: this.time, dt, unjittered: this._unjittered, sunScreen: this._sunScreen, sunVis: this._sunVis, volumetric: this.volumetric };
    if (this.experimentMode) pf.renderMinimal(ctx); else pf.render(ctx);
    if (jittered) cam.clearViewOffset();
    r.setRenderTarget(null);
  }

  /** PNG of the current view: renders a fresh frame and reads it back in the same task. */
  screenshot() {
    try { this.render(0); return this.canvas.toDataURL('image/png'); } catch (e) { console.warn('[engine] screenshot failed', e); return null; }
  }

  get stats() {
    const info = this.renderer.info;
    return {
      fps: Math.round(this.quality.fps * 10) / 10, frameMs: Math.round(this.quality.frameMs * 100) / 100,
      drawCalls: this._scene.calls, triangles: this._scene.triangles, tier: this.quality.tier, auto: this.quality.auto,
      passes: this.postfx.lastPasses.slice(), hdr: this.postfx.hdr, gpu: this.quality.gpu,
      width: this.postfx.width, height: this.postfx.height, geometries: info.memory.geometries, textures: info.memory.textures,
      programs: info.programs ? info.programs.length : 0, experimentMode: this.experimentMode,
    };
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this._onResize);
    if (this._ro) this._ro.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this._onLost);
    this.canvas.removeEventListener('webglcontextrestored', this._onRestored);
    for (const off of this._offs) off();
    this.sky.dispose(); this.postfx.dispose(); this.mats.dispose(); this.tex.dispose();
    this.renderer.dispose();
  }
}

module.exports = { Engine, TIERS, BUDGETS };
