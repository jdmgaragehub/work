'use strict';
/**
 * Sleep & Consciousness Lab (zone 4) — A2 World. WORLD_API zone builder: module.exports = { id, build(kit) }.
 * Local coords, entrance toward +Z. Lobby with a circadian clock sculpture; night bedroom with a simulated sleeper;
 * control room behind an observation window with a wall monitor showing a live procedural "simulated EEG"
 * (stage-specific waveforms: alpha, theta + vertex waves, spindles, K-complexes, delta, REM sawtooth + rapid eye
 * movements, EMG atonia) and a hypnogram that advances through a compressed night. Interactables → panel 'sleep'.
 */
// =============================================================================================
// Shared zone helpers (identical copy in neuro/sleep/learning/childdev/clinic so every zone file
// stays self-contained, per WORLD_API "one module per zone"). Indus Dusk palette, merged static
// geometry per material, world-scale UVs, chunked colliders (zones sit at 40° yaws, so long walls
// are split into ≤1.2 m AABBs that stay tight after rotation), canvas signs, billboards, hotspots,
// humanoid wrapper with a primitive fallback, tier-scaled light budget and full dispose().
// =============================================================================================
const PAL = { indigo: 0x1e1b4b, crimson: 0x9f1239, teal: 0x0f766e, saffron: 0xf59e0b, chalk: 0xf8fafc, ink: 0x0f0d2e };
const CSS = { indigo: '#1E1B4B', crimson: '#9F1239', teal: '#0F766E', saffron: '#F59E0B', chalk: '#F8FAFC' };
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Nastaliq Urdu", sans-serif';

function makeHelpers(kit, zoneId) {
  const THREE = kit.THREE || require('three');
  const V3 = THREE.Vector3;
  const sim = kit.sim || {};
  const tier = kit.tier || 'medium';
  const tierN = ({ low: 0, medium: 1, high: 2, ultra: 3 })[tier];
  const T = tierN == null ? 1 : tierN;
  const root = new THREE.Group();
  root.name = 'zone:' + zoneId;
  (kit.group || new THREE.Group()).add(root);
  const owned = [];
  const own = (o) => { owned.push(o); return o; };
  const fbCache = new Map();
  const updaters = [];

  // ---------- seeded local rng (deterministic layout regardless of sim.rng consumption) ----------
  let seed = 0x9e3779b9 ^ zoneId.split('').reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
  function rnd() { seed = (seed + 0x6d2b79f5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  const rr = (a, b) => a + (b - a) * rnd();

  // ---------- materials ----------
  function lib(name) { try { return kit.mats && typeof kit.mats.get === 'function' ? kit.mats.get(name) || null : null; } catch (e) { return null; } }
  /** Library material by name, else a cached MeshStandardMaterial fallback. */
  function mat(name, fallback) {
    const m = lib(name);
    if (m) return m;
    if (!fbCache.has(name)) fbCache.set(name, own(new THREE.MeshStandardMaterial(Object.assign({ color: 0xcccccc, roughness: 0.85, metalness: 0 }, fallback || {}))));
    return fbCache.get(name);
  }
  /** Own, cached, tinted material (never a shared library instance, so tints never leak). */
  function paint(color, o) {
    o = o || {};
    const key = 'p:' + color + ':' + JSON.stringify(o);
    if (!fbCache.has(key)) fbCache.set(key, own(new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, o))));
    return fbCache.get(key);
  }
  function glow(color, intensity) { return paint(color, { emissive: color, emissiveIntensity: intensity == null ? 1.6 : intensity, roughness: 0.6 }); }
  function glass(color, opacity) {
    return paint(color == null ? 0xbfe3ff : color, { transparent: true, opacity: opacity == null ? 0.16 : opacity, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide });
  }
  const M = {
    brick: () => mat('brick', { color: 0xa8553a, roughness: 0.9 }),
    plaster: () => mat('plaster', { color: 0xe9e1d3, roughness: 0.95 }),
    terrazzo: () => mat('terrazzo', { color: 0xd8d2c4, roughness: 0.35 }),
    wood: () => mat('wood', { color: 0x8a5a36, roughness: 0.6 }),
    metal: () => mat('metal', { color: 0x9aa3ad, roughness: 0.35, metalness: 0.85 }),
    fabric: () => mat('fabric', { color: 0x4b4f8a, roughness: 1 }),
    carpet: () => mat('carpet', { color: 0x5a3550, roughness: 1 }),
    stone: () => paint(0x6b6259, { roughness: 0.8 }),
  };

  // ---------- merged static geometry ----------
  const batches = new Map();
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new V3(), _s = new V3();
  /** Queue a geometry (consumed) into the per-material batch. o: {x,y,z,rx,ry,rz,sx,sy,sz,shadow,uv:'world'} */
  function add(geom, material, o) {
    o = o || {};
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0); _q.setFromEuler(_e);
    _p.set(o.x || 0, o.y || 0, o.z || 0); _s.set(o.sx || 1, o.sy || 1, o.sz || 1);
    _m.compose(_p, _q, _s);
    if (geom.index === null) geom = indexed(geom);
    geom.applyMatrix4(_m);
    if (o.uv === 'world') worldUV(geom, o.uvScale || 0.5);
    const shadow = o.shadow !== false;
    const key = material.uuid + (shadow ? ':s' : ':n');
    let b = batches.get(key);
    if (!b) batches.set(key, (b = { material, geos: [], shadow }));
    b.geos.push(geom);
  }
  function indexed(g) {
    const n = g.attributes.position.count;
    const idx = new (n > 65535 ? Uint32Array : Uint16Array)(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    return g;
  }
  function worldUV(g, s) {
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    if (!uv || !n) return;
    for (let i = 0; i < p.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
      if (ax >= ay && ax >= az) uv.setXY(i, p.getZ(i) * s, p.getY(i) * s);
      else if (ay >= az) uv.setXY(i, p.getX(i) * s, p.getZ(i) * s);
      else uv.setXY(i, p.getX(i) * s, p.getY(i) * s);
    }
  }
  function merge(geos) {
    let nv = 0, ni = 0;
    for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    const idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni);
    let vo = 0, io = 0;
    for (const g of geos) {
      const p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        pos[(vo + i) * 3] = p.getX(i); pos[(vo + i) * 3 + 1] = p.getY(i); pos[(vo + i) * 3 + 2] = p.getZ(i);
        if (n) { nor[(vo + i) * 3] = n.getX(i); nor[(vo + i) * 3 + 1] = n.getY(i); nor[(vo + i) * 3 + 2] = n.getZ(i); }
        if (t) { uv[(vo + i) * 2] = t.getX(i); uv[(vo + i) * 2 + 1] = t.getY(i); }
      }
      const a = g.index.array;
      for (let i = 0; i < a.length; i++) idx[io++] = a[i] + vo;
      vo += p.count;
      g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
  /** Turn queued batches into one mesh per material. Call once at the end of build. */
  function flush() {
    for (const b of batches.values()) {
      if (!b.geos.length) continue;
      const mesh = new THREE.Mesh(merge(b.geos), b.material);
      mesh.castShadow = b.shadow && !b.material.transparent;
      mesh.receiveShadow = !b.material.transparent;
      mesh.matrixAutoUpdate = false; mesh.updateMatrix();
      root.add(mesh);
    }
    batches.clear();
  }

  // ---------- colliders ----------
  function collide(x0, y0, z0, x1, y1, z1) {
    if (typeof kit.addCollider !== 'function') return;
    const lx = x1 - x0, lz = z1 - z0;
    const nx = Math.max(1, Math.ceil(lx / 1.2)), nz = Math.max(1, Math.ceil(lz / 1.2));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      kit.addCollider(new V3(x0 + (lx * i) / nx, y0, z0 + (lz * j) / nz), new V3(x0 + (lx * (i + 1)) / nx, y1, z0 + (lz * (j + 1)) / nz));
    }
  }
  /** Axis-aligned box (centre x,y,z). o: {ry, collide, shadow, uv} — collide ignores ry (use for small yaw only). */
  function box(w, h, d, x, y, z, material, o) {
    o = o || {};
    add(new THREE.BoxGeometry(w, h, d), material, { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, shadow: o.shadow, uv: o.uv === false ? null : 'world', uvScale: o.uvScale });
    if (o.collide) {
      const c = Math.abs(Math.cos(o.ry || 0)), s = Math.abs(Math.sin(o.ry || 0));
      const hw = (w * c + d * s) / 2, hd = (w * s + d * c) / 2;
      collide(x - hw, y - h / 2, z - hd, x + hw, y + h / 2, z + hd);
    }
  }
  function cyl(rt, rb, h, x, y, z, material, o) {
    o = o || {};
    add(new THREE.CylinderGeometry(rt, rb, h, o.seg || 20, 1, !!o.open), material, { x, y, z, rx: o.rx, ry: o.ry, rz: o.rz, shadow: o.shadow });
    if (o.collide) collide(x - rb, y - h / 2, z - rb, x + rb, y + h / 2, z + rb);
  }
  function sphere(r, x, y, z, material, o) {
    o = o || {};
    add(new THREE.SphereGeometry(r, o.seg || 18, Math.max(8, (o.seg || 18) >> 1)), material, { x, y, z, sx: o.sx, sy: o.sy, sz: o.sz, rx: o.rx, ry: o.ry, rz: o.rz, shadow: o.shadow });
  }

  /**
   * Wall running along X (at z) or along Z (at x). gaps: [{c, w, top?, sill?, glass?}] measured along the wall.
   * Door: sill 0 (open below top). Window: sill > 0 with optional glass pane. Colliders: full height except door openings.
   */
  function wall(axis, at, from, to, h, t, material, gaps, o) {
    o = o || {};
    gaps = (gaps || []).slice().sort((a, b) => a.c - b.c);
    const seg = (a, b, y0, y1, m, solid) => {
      if (b - a < 1e-3 || y1 - y0 < 1e-3) return;
      const c = (a + b) / 2, L = b - a, H = y1 - y0, yc = (y0 + y1) / 2;
      if (axis === 'x') box(L, H, t, c, yc, at, m, { collide: solid, shadow: o.shadow });
      else box(t, H, L, at, yc, c, m, { collide: solid, shadow: o.shadow });
    };
    let cur = from;
    for (const g of gaps) {
      const a = g.c - g.w / 2, b = g.c + g.w / 2;
      seg(cur, a, 0, h, material, true);
      const sill = g.sill || 0, top = g.top == null ? Math.min(h, 2.4) : g.top;
      if (sill > 0) seg(a, b, 0, sill, material, true);
      seg(a, b, top, h, material, true);
      if (sill > 0 && g.glass !== false) {
        seg(a, b, sill, top, g.glassMat || glass(), false);
        if (axis === 'x') collide(a, 0, at - t / 2, b, h, at + t / 2); else collide(at - t / 2, 0, a, at + t / 2, h, b);
        // mullion frame
        const fm = M.metal();
        if (axis === 'x') { box(b - a, 0.05, t + 0.04, (a + b) / 2, top - 0.02, at, fm); box(b - a, 0.05, t + 0.04, (a + b) / 2, sill + 0.02, at, fm); }
        else { box(t + 0.04, 0.05, b - a, at, top - 0.02, (a + b) / 2, fm); box(t + 0.04, 0.05, b - a, at, sill + 0.02, (a + b) / 2, fm); }
      }
      cur = b;
    }
    seg(cur, to, 0, h, material, true);
  }

  // ---------- canvas textures, signs, billboards ----------
  function canvas(w, h) {
    let c = null;
    if (typeof document !== 'undefined' && document.createElement) c = document.createElement('canvas');
    else if (typeof OffscreenCanvas !== 'undefined') c = new OffscreenCanvas(w, h);
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const tex = own(new THREE.CanvasTexture(c));
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = T >= 2 ? 8 : 2;
    return { c, g, tex, w, h };
  }
  function wrap(g, text, maxW) {
    const out = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const word of para.split(' ')) {
        const tryL = line ? line + ' ' + word : word;
        if (g.measureText(tryL).width > maxW && line) { out.push(line); line = word; } else line = tryL;
      }
      out.push(line);
    }
    return out;
  }
  /** Poster / sign plane. lines: [{t, size, color, weight, align}] or a string. */
  function sign(lines, w, h, o) {
    o = o || {};
    const px = o.px || 256;
    const cv = canvas(Math.round(w * px), Math.round(h * px));
    const g = cv.g, W = cv.w, H = cv.h;
    g.fillStyle = o.bg || 'rgba(30,27,75,0.92)'; g.fillRect(0, 0, W, H);
    if (o.border !== false) { g.strokeStyle = o.border || CSS.saffron; g.lineWidth = Math.max(4, W * 0.008); g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth); }
    if (o.band !== false) { g.fillStyle = o.band || CSS.crimson; g.fillRect(0, 0, W, Math.max(6, H * 0.04)); }
    if (typeof lines === 'string') lines = [{ t: lines }];
    let y = H * (o.top == null ? 0.12 : o.top);
    for (const L of lines) {
      const size = Math.round((L.size || 0.09) * H);
      g.font = `${L.weight || 600} ${size}px ${FONT}`;
      g.fillStyle = L.color || CSS.chalk;
      g.textAlign = L.align || o.align || 'center';
      g.textBaseline = 'top';
      const x = g.textAlign === 'left' ? W * 0.06 : g.textAlign === 'right' ? W * 0.94 : W / 2;
      if (L.dir) g.direction = L.dir;
      for (const ln of wrap(g, L.t, W * 0.88)) { g.fillText(ln, x, y); y += size * 1.22; }
      g.direction = 'ltr';
      y += size * (L.gap == null ? 0.25 : L.gap);
    }
    cv.tex.needsUpdate = true;
    const m = own(new THREE.MeshStandardMaterial({ map: cv.tex, roughness: 0.6, emissive: 0xffffff, emissiveMap: cv.tex, emissiveIntensity: o.glow == null ? 0.35 : o.glow, transparent: !!o.transparent }));
    const mesh = new THREE.Mesh(own(new THREE.PlaneGeometry(w, h)), m);
    if (o.pos) mesh.position.set(o.pos[0], o.pos[1], o.pos[2]);
    if (o.ry) mesh.rotation.y = o.ry;
    root.add(mesh);
    return mesh;
  }
  /** Billboard label (sprite), height in metres. */
  function tag(text, height, o) {
    o = o || {};
    const fs = 64, padX = 28;
    const probe = canvas(8, 8);
    probe.g.font = `700 ${fs}px ${FONT}`;
    const tw = Math.ceil(probe.g.measureText(text).width);
    probe.tex.dispose();
    const cv = canvas(tw + padX * 2, Math.round(fs * 1.6));
    const g = cv.g;
    g.fillStyle = o.bg || 'rgba(30,27,75,0.86)';
    const r = 18; g.beginPath();
    if (g.roundRect) g.roundRect(0, 0, cv.w, cv.h, r); else g.rect(0, 0, cv.w, cv.h);
    g.fill();
    g.fillStyle = o.accent || CSS.saffron; g.fillRect(0, 0, 10, cv.h);
    g.font = `700 ${fs}px ${FONT}`; g.fillStyle = o.color || CSS.chalk; g.textBaseline = 'middle'; g.textAlign = 'center';
    g.fillText(text, cv.w / 2 + 5, cv.h / 2 + 2);
    cv.tex.needsUpdate = true;
    const sm = own(new THREE.SpriteMaterial({ map: cv.tex, transparent: true, depthWrite: false, depthTest: o.depthTest !== false, toneMapped: false }));
    const s = new THREE.Sprite(sm);
    s.scale.set((height * cv.w) / cv.h, height, 1);
    if (o.pos) s.position.set(o.pos[0], o.pos[1], o.pos[2]);
    s.renderOrder = 5;
    (o.parent || root).add(s);
    return s;
  }

  // ---------- lights (tier budget: 1 point light on low/medium, 2 on high/ultra) ----------
  let lightCount = 0;
  function light(color, intensity, distance, x, y, z, essential) {
    const budget = T >= 2 ? 2 : 1;
    if (lightCount >= budget && !essential) return null;
    lightCount++;
    const l = new THREE.PointLight(color, intensity, distance, 2);
    l.position.set(x, y, z); l.castShadow = false;
    root.add(l);
    return l;
  }
  /** Emissive ceiling panel (merged, no real light). */
  function lamp(x, y, z, w, d, color) { box(w || 1.2, 0.05, d || 0.6, x, y, z, glow(color || 0xfff1d6, 1.4), { shadow: false }); }

  // ---------- services ----------
  const services = () => (sim && sim.services) || {};
  const reduced = () => !!(sim.settings && sim.settings.reducedMotion);
  function openPanel(id) { const ui = services().ui; if (ui && typeof ui.openPanel === 'function') ui.openPanel(id); }
  function runParadigm(id, panelFallback) {
    const r = services().runner;
    if (r && typeof r.run === 'function') r.run(id); else if (panelFallback) openPanel(panelFallback);
  }
  function emit(ev, payload) { if (sim.bus && typeof sim.bus.emit === 'function') sim.bus.emit(ev, payload); }
  function toast(msg) { const ui = services().ui; if (ui && typeof ui.toast === 'function') { try { ui.toast(msg); } catch (e) { /* noop */ } } }

  // ---------- interactables + hotspot markers ----------
  const hotspots = [];
  function interact(id, pos, radius, label, onUse, o) {
    o = o || {};
    if (typeof kit.addInteractable === 'function') {
      kit.addInteractable({
        id: zoneId + '.' + id, zone: zoneId, pos: new V3(pos[0], pos[1], pos[2]), radius: radius || 2, label,
        onUse: () => { try { onUse(); } catch (e) { if (typeof console !== 'undefined') console.warn('[zehn]', zoneId, id, e); } },
      });
    }
    if (o.marker !== false) hotspots.push(new V3(pos[0], (o.markerY != null ? o.markerY : pos[1] + 0.55), pos[2]));
  }
  let hotMesh = null;
  function buildHotspots() {
    if (!hotspots.length) return;
    const g = own(new THREE.OctahedronGeometry(0.09, 0));
    const m = own(new THREE.MeshBasicMaterial({ color: new THREE.Color(PAL.saffron).multiplyScalar(2.2), toneMapped: false }));
    hotMesh = new THREE.InstancedMesh(g, m, hotspots.length);
    hotMesh.frustumCulled = false;
    root.add(hotMesh);
  }
  const _hm = new THREE.Matrix4(), _hq = new THREE.Quaternion(), _hs = new V3(1, 1.4, 1), _hp = new V3(), _up = new V3(0, 1, 0);
  function updateHotspots(t) {
    if (!hotMesh) return;
    const rm = reduced();
    for (let i = 0; i < hotspots.length; i++) {
      _hp.copy(hotspots[i]); if (!rm) _hp.y += Math.sin(t * 2 + i) * 0.05;
      _hq.setFromAxisAngle(_up, rm ? 0 : t * 1.5 + i);
      _hm.compose(_hp, _hq, _hs); hotMesh.setMatrixAt(i, _hm);
    }
    hotMesh.instanceMatrix.needsUpdate = true;
  }

  // ---------- proximity (skip expensive canvas/particle work when the camera is far away) ----------
  const _cw = new V3(), _gw = new V3();
  function camDist() {
    const cam = kit.engine && kit.engine.camera;
    if (!cam) return 0;
    cam.getWorldPosition(_cw); root.getWorldPosition(_gw);
    return Math.hypot(_cw.x - _gw.x, _cw.z - _gw.z);
  }
  function cameraLocal(out) {
    const cam = kit.engine && kit.engine.camera;
    if (!cam) return null;
    cam.getWorldPosition(out); root.worldToLocal(out); return out;
  }

  // ---------- people ----------
  function simplePerson(o) {
    const h = o.height || 1.7, s = h / 1.7;
    const g = new THREE.Group();
    const skin = paint(o.skin || 0xb07a55, { roughness: 0.7 }), cloth = paint(o.color || PAL.teal, { roughness: 0.9 }), cloth2 = paint(o.color2 || 0x2b2a4a, { roughness: 0.9 });
    const body = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.2 * s, 0.55 * s, 4, 10)), cloth); body.position.y = 1.15 * s;
    const head = new THREE.Mesh(own(new THREE.SphereGeometry(0.12 * s, 16, 12)), skin); head.position.y = 1.58 * s;
    const legs = new THREE.Group(); legs.position.y = 0.8 * s;
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.075 * s, 0.6 * s, 4, 8)), cloth2); l.position.set(0.1 * s * sx, -0.4 * s, 0); legs.add(l); }
    const arms = [];
    for (const sx of [-1, 1]) { const a = new THREE.Mesh(own(new THREE.CapsuleGeometry(0.06 * s, 0.5 * s, 4, 8)), cloth); a.position.set(0.27 * s * sx, 1.15 * s, 0); g.add(a); arms.push(a); }
    g.add(body, head, legs);
    g.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
    let pose = 'idle';
    return {
      group: g, simple: true,
      setPose(p) {
        pose = p;
        const sit = p === 'sit' || p === 'slump';
        legs.rotation.x = sit ? -Math.PI / 2 : 0; legs.position.y = sit ? 0.45 * s : 0.8 * s; legs.position.z = 0;
        body.position.y = sit ? 0.78 * s : 1.15 * s; head.position.y = sit ? 1.22 * s : 1.58 * s;
        for (const a of arms) a.position.y = sit ? 0.8 * s : 1.15 * s;
        body.rotation.x = p === 'slump' ? 0.25 : 0;
      },
      update(dt, t) { if (pose !== 'sit' && pose !== 'slump') head.position.y = 1.58 * s + Math.sin(t * 1.3) * 0.004; },
      setGaze() {}, setEmotion() {}, setAUs() {}, blink() {}, speak() {}, setViseme() {}, dispose() {},
    };
  }
  const people = [];
  function person(o, pose) {
    o = o || {};
    let p = null;
    try {
      const P = kit.people;
      const fn = P && (P.createHumanoid || (P.default && P.default.createHumanoid));
      if (typeof fn === 'function') p = fn(THREE, Object.assign({ tier }, o));
    } catch (e) { p = null; }
    if (!p || !p.group) p = simplePerson(o);
    try { if (pose && p.setPose) p.setPose(pose); } catch (e) { /* noop */ }
    p._ok = true;
    people.push(p);
    root.add(p.group);
    return p;
  }
  function updatePeople(dt, t) {
    const cam = kit.engine && kit.engine.camera;
    for (const p of people) {
      if (!p._ok || !p.update) continue;
      try { p.update(dt, t, cam); } catch (e) { p._ok = false; }
    }
  }

  // ---------- building shell ----------
  /**
   * Standard 36 × 34 m pavilion: terrazzo floor, brick outer skin + plaster inner skin, clerestory glazing,
   * crimson cornice, roof (solid with skylight | glass atrium), +Z entrance with canopy and bilingual sign.
   */
  function shell(o) {
    const W = o.w || 36, D = o.d || 34, H = o.h || 6, hw = W / 2, hd = D / 2, t = 0.35;
    const doorW = o.doorW || 4.4, doorH = o.doorH || 3.4;
    const L = require('../layout.js');
    const meta = (L.ZONES && L.ZONES[zoneId]) || { name: zoneId, ur: '' };
    // floor + porch
    box(W + 0.7, 0.1, D + 0.7, 0, -0.045, 0, o.floor || M.terrazzo(), { shadow: false, uvScale: 0.25 });
    box(doorW + 5, 0.14, 3.6, 0, -0.04, hd + 2, M.stone(), { shadow: false });
    // walls: outer brick (with door gap) + inner plaster skin; clerestory band
    const band = H - 1.1;
    const outer = o.outerMat || M.brick(), inner = o.innerMat || M.plaster();
    const clere = (axis, at, from, to) => wall(axis, at, from, to, H, t, outer, [{ c: (from + to) / 2, w: (to - from) - 2.4, sill: band - 0.9, top: band, glassMat: glass(0x9fd0ff, 0.22) }]);
    clere('x', -hd, -hw - t / 2, hw + t / 2);
    clere('z', -hw, -hd, hd);
    clere('z', hw, -hd, hd);
    wall('x', hd, -hw - t / 2, hw + t / 2, H, t, outer, [{ c: 0, w: doorW, top: doorH }]);
    // inner plaster skin up to the clerestory sill (no colliders: outer skin already collides)
    const skin = 0.06, ih = band - 0.9;
    box(W - 0.1, ih, skin, 0, ih / 2, -hd + t / 2 + skin / 2, inner, { shadow: false });
    box(skin, ih, D - 0.1, -hw + t / 2 + skin / 2, ih / 2, 0, inner, { shadow: false });
    box(skin, ih, D - 0.1, hw - t / 2 - skin / 2, ih / 2, 0, inner, { shadow: false });
    const fw = (W - doorW) / 2;
    box(fw, ih, skin, -hw + fw / 2, ih / 2, hd - t / 2 - skin / 2, inner, { shadow: false });
    box(fw, ih, skin, hw - fw / 2, ih / 2, hd - t / 2 - skin / 2, inner, { shadow: false });
    // plinth + cornice + saffron string course
    const crim = paint(PAL.crimson, { roughness: 0.6 }), saff = paint(PAL.saffron, { roughness: 0.5 }), dark = paint(0x2a2440, { roughness: 0.8 });
    for (const [w, d, x, z] of [[W + 0.9, 0.5, 0, -hd], [0.5, D + 0.9, -hw, 0], [0.5, D + 0.9, hw, 0]]) {
      box(w, 0.45, d, x, H - 0.22, z, crim); box(w + 0.02, 0.4, d + 0.02, x, 0.2, z, dark, { shadow: false });
      box(w + 0.03, 0.08, d + 0.03, x, band - 0.95, z, saff, { shadow: false });
    }
    for (const sx of [-1, 1]) {
      const w = fw + 0.45, x = sx * (doorW / 2 + w / 2) - sx * 0.0;
      box(w, 0.45, 0.5, x, H - 0.22, hd, crim); box(w, 0.4, 0.52, x, 0.2, hd, dark, { shadow: false });
      box(w, 0.08, 0.53, x, band - 0.95, hd, saff, { shadow: false });
    }
    box(doorW + 0.1, 0.45, 0.5, 0, H - 0.22, hd, crim);
    // door frame
    const fm = M.metal();
    box(0.14, doorH, 0.5, -doorW / 2, doorH / 2, hd, fm); box(0.14, doorH, 0.5, doorW / 2, doorH / 2, hd, fm); box(doorW + 0.28, 0.14, 0.5, 0, doorH, hd, fm);
    // canopy + columns + sign
    const cz = hd + 1.9;
    box(doorW + 4.2, 0.22, 3.6, 0, doorH + 0.7, cz, dark);
    box(doorW + 4.3, 0.08, 3.7, 0, doorH + 0.58, cz, saff, { shadow: false });
    for (const sx of [-1, 1]) cyl(0.14, 0.16, doorH + 0.6, sx * (doorW / 2 + 1.6), (doorH + 0.6) / 2, hd + 3.4, fm, { collide: true, seg: 14 });
    lamp(0, doorH + 0.57, cz, 2.2, 0.5, 0xffe2b0);
    sign([{ t: meta.name, size: 0.34, weight: 700 }, { t: meta.ur || '', size: 0.26, color: '#FCD34D', dir: 'rtl' }], 7.5, 1.25,
      { pos: [0, doorH + 1.35, hd + 0.27], top: 0.1, glow: 0.6, px: 180 });
    // roof
    const rt = 0.3, ry = H + rt / 2;
    if (o.roof === 'glass') {
      const ribs = paint(0x2b2f3a, { roughness: 0.4, metalness: 0.8 });
      box(W + 0.7, 0.04, D + 0.7, 0, H + 0.02, 0, glass(0xcfe8ff, 0.12), { shadow: false });
      for (let x = -hw; x <= hw + 0.01; x += W / 8) box(0.18, 0.4, D + 0.7, x, H + 0.1, 0, ribs);
      for (let z = -hd; z <= hd + 0.01; z += D / 6) box(W + 0.7, 0.3, 0.14, 0, H + 0.12, z, ribs);
    } else {
      const sw = o.skyW || W * 0.42, sd = o.skyD || D * 0.36, sz = o.skyZ || -2;
      const rm = paint(0xd9d2c6, { roughness: 0.95 });
      box(W + 0.7, rt, (sz - sd / 2) - (-hd - 0.35), 0, ry, (-hd - 0.35 + sz - sd / 2) / 2, rm);
      box(W + 0.7, rt, (hd + 0.35) - (sz + sd / 2), 0, ry, (hd + 0.35 + sz + sd / 2) / 2, rm);
      box((W + 0.7 - sw) / 2, rt, sd, -(sw / 2 + (W + 0.7 - sw) / 4), ry, sz, rm);
      box((W + 0.7 - sw) / 2, rt, sd, (sw / 2 + (W + 0.7 - sw) / 4), ry, sz, rm);
      box(sw, 0.04, sd, 0, H + 0.24, sz, glass(0xd8ecff, 0.14), { shadow: false });
      for (let x = -sw / 2; x <= sw / 2 + 0.01; x += sw / 5) box(0.08, 0.2, sd, x, H + 0.2, sz, fm);
      // parapet
      box(W + 0.7, 0.5, 0.25, 0, H + 0.5, -hd - 0.22, crim); box(W + 0.7, 0.5, 0.25, 0, H + 0.5, hd + 0.22, crim);
      box(0.25, 0.5, D + 0.7, -hw - 0.22, H + 0.5, 0, crim); box(0.25, 0.5, D + 0.7, hw + 0.22, H + 0.5, 0, crim);
    }
    return { W, D, H, hw, hd, t, doorW, band };
  }

  function dispose() {
    for (const p of people) { try { if (p.dispose) p.dispose(); } catch (e) { /* noop */ } }
    root.traverse((o) => { if (o.geometry && o.geometry.dispose) o.geometry.dispose(); });
    for (const o of owned) { try { o.dispose(); } catch (e) { /* noop */ } }
    if (root.parent) root.parent.remove(root);
  }

  return {
    THREE, V3, sim, tier, T, root, own, rnd, rr, mat, paint, glow, glass, M, add, box, cyl, sphere, wall, collide, flush,
    canvas, sign, tag, wrap, light, lamp, openPanel, runParadigm, emit, toast, reduced, interact, buildHotspots, updateHotspots,
    camDist, cameraLocal, person, updatePeople, shell, dispose, updaters, services,
  };
}
// ============================ end shared zone helpers ============================


const ZONE = 'sleep';
const STAGES = { W: 0, REM: 1, N1: 2, N2: 3, N3: 4 };
const STAGE_NAME = ['Wake', 'REM sleep', 'NREM stage N1', 'NREM stage N2', 'NREM stage N3'];
const STAGE_NOTE = [
  'Relaxed wake, eyes closed: alpha rhythm (8–12 Hz), strongest over the back of the head; high chin muscle tone.',
  'REM: low-voltage mixed EEG with sawtooth waves, rapid eye movements and near-absent chin muscle tone (atonia).',
  'N1: alpha fades into theta (4–7 Hz); slow rolling eye movements; occasional vertex sharp waves.',
  'N2: theta background with sleep spindles (≈12–14 Hz bursts) and K-complexes (large biphasic waves).',
  'N3: slow-wave sleep — high-amplitude delta waves (≈0.5–2 Hz); hardest stage to wake from.',
];
// compressed teaching night: [stage, minutes]. Cycles ≈ 90 min, N3 early, REM lengthening toward morning.
const NIGHT = [['W', 12], ['N1', 6], ['N2', 22], ['N3', 34], ['N2', 10], ['REM', 10], ['N2', 26], ['N3', 24], ['N2', 14], ['REM', 18],
  ['N1', 3], ['N2', 34], ['N3', 8], ['N2', 18], ['REM', 26], ['W', 2], ['N2', 36], ['REM', 32], ['N1', 4], ['N2', 22], ['REM', 30], ['W', 15]];
const NIGHT_START_H = 23; // 23:00
const NIGHT_MIN = NIGHT.reduce((s, x) => s + x[1], 0);
const MIN_PER_SEC = 1; // one night-minute per real second (~7 min loop)

/** Procedural EEG generator (simulated, illustrative waveforms). Units ≈ µV. Deterministic per seed. */
function makeEEG(seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const lp = [0, 0, 0, 0], lp2 = [0, 0, 0, 0];
  const ev = { spindle: -9, kc: -9, saw: -9, rem: -9, remDir: 1, blink: -9, vertex: -9, twitch: -9, nextSpindle: 2, nextKc: 4, nextSaw: 1, nextRem: 0.5, nextBlink: 1, nextVertex: 3, nextTwitch: 2 };
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6, rnd() * 6];
  function noise(ch, k) { lp[ch] += (rnd() * 2 - 1 - lp[ch]) * k; lp2[ch] += (lp[ch] - lp2[ch]) * 0.3; return lp2[ch]; }
  const g = (x, w) => Math.exp(-(x * x) / (w * w));
  /** One sample per channel at time t (s) for stage st. Returns [C3, O1, EOG, EMG]. */
  return function sample(t, st) {
    const out = [0, 0, 0, 0];
    // schedule events
    if (st === STAGES.N2) {
      if (t > ev.nextSpindle) { ev.spindle = t; ev.nextSpindle = t + 3 + rnd() * 5; }
      if (t > ev.nextKc) { ev.kc = t; ev.nextKc = t + 5 + rnd() * 8; }
    }
    if (st === STAGES.REM) {
      if (t > ev.nextSaw) { ev.saw = t; ev.nextSaw = t + 3 + rnd() * 4; }
      if (t > ev.nextRem) { ev.rem = t; ev.remDir = rnd() < 0.5 ? -1 : 1; ev.nextRem = t + 0.4 + rnd() * 1.6; }
      if (t > ev.nextTwitch) { ev.twitch = t; ev.nextTwitch = t + 2 + rnd() * 6; }
    }
    if (st === STAGES.W && t > ev.nextBlink) { ev.blink = t; ev.nextBlink = t + 2.5 + rnd() * 4; }
    if (st === STAGES.N1 && t > ev.nextVertex) { ev.vertex = t; ev.nextVertex = t + 4 + rnd() * 6; }
    const n0 = noise(0, 0.5), n1 = noise(1, 0.5), n2 = noise(2, 0.08), n3 = noise(3, 0.95);
    let c3 = 0, o1 = 0, eog = 0, emg = 0;
    if (st === STAGES.W) {
      const env = 0.65 + 0.35 * Math.sin(t * 2 * Math.PI * 0.25 + ph[0]);
      const a = Math.sin(2 * Math.PI * 10 * t + ph[1]);
      c3 = 16 * env * a + 5 * Math.sin(2 * Math.PI * 21 * t) + 8 * n0;
      o1 = 34 * env * a + 5 * Math.sin(2 * Math.PI * 19 * t + 1) + 8 * n1;
      const bt = t - ev.blink; eog = 10 * n2 + (bt >= 0 && bt < 0.5 ? 140 * Math.sin(Math.PI * bt / 0.5) : 0);
      emg = 26 * n3;
    } else if (st === STAGES.N1) {
      const th = Math.sin(2 * Math.PI * 5.5 * t + ph[2]) + 0.5 * Math.sin(2 * Math.PI * 4.2 * t);
      const vt = t - ev.vertex;
      c3 = 18 * th + 12 * n0 + (vt >= 0 && vt < 0.4 ? -70 * g(vt - 0.12, 0.05) + 25 * g(vt - 0.25, 0.06) : 0);
      o1 = 15 * th + 6 * Math.sin(2 * Math.PI * 9 * t) * 0.6 + 12 * n1;
      eog = 45 * Math.sin(2 * Math.PI * 0.25 * t + ph[3]) + 6 * n2;
      emg = 12 * n3;
    } else if (st === STAGES.N2) {
      const th = Math.sin(2 * Math.PI * 5 * t + ph[2]) + 0.6 * Math.sin(2 * Math.PI * 3.3 * t + 1);
      const sp = t - ev.spindle, spEnv = sp >= 0 && sp < 1.0 ? Math.sin(Math.PI * sp / 1.0) ** 2 : 0;
      const kc = t - ev.kc, kcw = kc >= 0 && kc < 1.0 ? -95 * g(kc - 0.18, 0.09) + 65 * g(kc - 0.5, 0.16) : 0;
      c3 = 20 * th + 14 * n0 + 28 * spEnv * Math.sin(2 * Math.PI * 13 * t) + kcw;
      o1 = 15 * th + 12 * n1 + 14 * spEnv * Math.sin(2 * Math.PI * 13 * t) + 0.6 * kcw;
      eog = 6 * n2 + 0.3 * kcw;
      emg = 7 * n3;
    } else if (st === STAGES.N3) {
      const d = Math.sin(2 * Math.PI * 0.9 * t + ph[0]) + 0.55 * Math.sin(2 * Math.PI * 1.6 * t + ph[1]) + 0.3 * Math.sin(2 * Math.PI * 0.6 * t);
      c3 = 62 * d + 10 * n0;
      o1 = 48 * d + 10 * n1;
      eog = 0.25 * c3 + 5 * n2; // frontal delta leaks into EOG
      emg = 5 * n3;
    } else { // REM
      const sw = t - ev.saw;
      const sawOn = sw >= 0 && sw < 1.6;
      const tri = (x) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;
      c3 = 11 * Math.sin(2 * Math.PI * 6 * t + ph[2]) + 7 * Math.sin(2 * Math.PI * 9.5 * t) + 10 * n0 + (sawOn ? 30 * tri(3 * t) * Math.sin(Math.PI * sw / 1.6) : 0);
      o1 = 9 * Math.sin(2 * Math.PI * 7 * t) + 10 * n1;
      const rt = t - ev.rem;
      eog = 8 * n2 + (rt >= 0 && rt < 0.6 ? ev.remDir * 110 * (1 - Math.exp(-rt / 0.03)) * Math.exp(-rt / 0.35) : 0);
      const tw = t - ev.twitch;
      emg = 1.5 * n3 + (tw >= 0 && tw < 0.12 ? 30 * (rnd() * 2 - 1) : 0);
    }
    out[0] = c3; out[1] = o1; out[2] = eog; out[3] = emg;
    return out;
  };
}
function stageAt(min) {
  let acc = 0;
  for (let i = 0; i < NIGHT.length; i++) { acc += NIGHT[i][1]; if (min < acc) return { st: STAGES[NIGHT[i][0]], idx: i }; }
  return { st: STAGES.W, idx: NIGHT.length - 1 };
}

function build(kit) {
  const H = makeHelpers(kit, ZONE);
  const { THREE, V3, box, cyl, paint, glow, glass, M, tag, sign, interact, light, lamp, root, wall } = H;
  const S = H.shell({ h: 6, skyZ: 9, skyD: 6, skyW: 12 });
  const anchor = (name, v) => { if (typeof kit.anchor === 'function') kit.anchor(name, v); };
  const steel = paint(0x2b2f3a, { roughness: 0.4, metalness: 0.8 });
  const PZ = 4.5; // lobby / rooms partition

  // ---------------- partitions
  wall('x', PZ, -S.hw, S.hw, S.H - 1.1, 0.2, M.plaster(), [{ c: -9, w: 1.8, top: 2.4 }, { c: 9, w: 1.8, top: 2.4 }, { c: 0, w: 3.2, sill: 1.0, top: 2.2, glassMat: glass(0xcfe8ff, 0.2) }]);
  wall('z', 0, -S.hd, PZ, S.H - 1.1, 0.2, M.plaster(), [{ c: -8, w: 7, sill: 1.0, top: 2.2, glassMat: glass(0x1a2238, 0.45) }]);
  box(S.W - 0.4, 0.12, S.hd + PZ, 0, S.H - 1.1 + 0.06, (-S.hd + PZ) / 2, paint(0xd9d2c6, { roughness: 0.95 })); // rooms' lowered ceiling (night bedroom)

  // ---------------- bedroom (x < 0)
  box(17.6, 0.02, S.hd + PZ - 0.4, -9, 0.012, (-S.hd + PZ) / 2, M.carpet(), { shadow: false });
  const BX = -9, BZ = -14.4;
  box(1.9, 0.35, 2.3, BX, 0.32, BZ, M.wood(), { collide: true });
  box(1.8, 0.24, 2.15, BX, 0.62, BZ, paint(0xf1eee6, { roughness: 0.95 }));
  box(2.0, 1.25, 0.12, BX, 0.62, BZ - 1.16, M.wood());
  box(1.9, 0.08, 0.14, BX, 1.28, BZ - 1.16, paint(PAL.crimson, { roughness: 0.6 }));
  box(1.2, 0.14, 0.42, BX, 0.81, BZ - 0.8, paint(0xfafaf9, { roughness: 1 }));
  for (const sx of [-1, 1]) {
    box(0.55, 0.55, 0.45, BX + sx * 1.35, 0.275, BZ - 0.85, M.wood(), { collide: true });
  }
  // amplifier box + bedside lamp
  box(0.34, 0.12, 0.24, BX + 1.35, 0.62, BZ - 0.85, paint(0x1f2937, { roughness: 0.5 }));
  box(0.05, 0.02, 0.02, BX + 1.3, 0.69, BZ - 0.74, glow(0x22c55e, 2));
  cyl(0.05, 0.09, 0.32, BX - 1.35, 0.71, BZ - 0.85, steel, { seg: 12 });
  const shade = paint(0xffe4b5, { emissive: 0xffb860, emissiveIntensity: 1.2, roughness: 0.8 });
  cyl(0.14, 0.2, 0.22, BX - 1.35, 0.98, BZ - 0.85, shade, { seg: 16, open: true });
  // night window with curtains on the left wall
  const night = H.canvas(512, 384);
  { const g = night.g; const gr = g.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#0b0a24'); gr.addColorStop(1, '#2a1f4f'); g.fillStyle = gr; g.fillRect(0, 0, 512, 384);
    g.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { const x = H.rnd() * 512, y = H.rnd() * 300, r = H.rnd() * 1.6 + 0.3; g.globalAlpha = 0.4 + H.rnd() * 0.6; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.fillStyle = '#fef3c7'; g.beginPath(); g.arc(380, 90, 34, 0, 7); g.fill(); g.fillStyle = '#0b0a24'; g.beginPath(); g.arc(395, 80, 30, 0, 7); g.fill();
    g.fillStyle = '#120f2b'; for (let x = 0; x < 512; x += 36) { const h = 40 + H.rnd() * 70; g.fillRect(x, 384 - h, 30, h); }
    g.fillStyle = '#F59E0B'; for (let i = 0; i < 25; i++) g.fillRect(H.rnd() * 500, 384 - H.rnd() * 60, 4, 5);
    night.tex.needsUpdate = true; }
  const win = new THREE.Mesh(H.own(new THREE.PlaneGeometry(2.6, 1.8)), H.own(new THREE.MeshBasicMaterial({ map: night.tex })));
  win.position.set(-S.hw + 0.27, 1.9, -9.5); win.rotation.y = Math.PI / 2; root.add(win);
  box(0.08, 1.95, 2.75, -S.hw + 0.26, 1.9, -9.5, steel);
  const curtain = paint(0x5b2a6e, { roughness: 1 });
  for (const dz of [-1.75, 1.75]) for (let k = 0; k < 4; k++) cyl(0.09, 0.09, 2.6, -S.hw + 0.42, 1.55, -9.5 + dz + (k - 1.5) * 0.17, curtain, { seg: 8 });
  box(0.05, 0.05, 4.4, -S.hw + 0.45, 2.88, -9.5, steel);
  // rug, chair, IR camera
  box(3.2, 0.02, 2.2, BX, 0.03, BZ + 2.4, paint(0x7c2d4f, { roughness: 1 }), { shadow: false });
  box(0.3, 0.18, 0.22, -0.5, 2.6, -16.4, paint(0x111827)); H.sphere(0.06, -0.5, 2.6, -16.27, glow(0xef4444, 1.5), { seg: 8 });
  // the sleeper (humanoid lying on the back; primitive fallback inside person())
  const sleeper = H.person({ lookIndex: 2, height: 1.68, name: 'Simulated sleeper', outfit: 'shalwar' }, 'idle');
  sleeper.group.rotation.x = -Math.PI / 2;
  sleeper.group.position.set(BX, 0.82, BZ + 1.0);
  try { if (sleeper.setAUs) sleeper.setAUs({ 43: 1 }); } catch (e) { /* noop */ }
  const blanket = new THREE.Mesh(H.own(new THREE.BoxGeometry(1.86, 0.2, 1.55)), paint(PAL.indigo, { roughness: 1 }));
  blanket.position.set(BX, 0.86, BZ + 0.38); blanket.castShadow = true; root.add(blanket);
  const ajrak = H.canvas(256, 256);
  { const g = ajrak.g; g.fillStyle = '#7f1d1d'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#1e1b4b';
    for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) { g.beginPath(); g.arc(x + 16, y + 16, 9, 0, 7); g.fill(); }
    g.fillStyle = '#f8fafc'; for (let y = 0; y < 256; y += 32) for (let x = 0; x < 256; x += 32) g.fillRect(x + 14, y + 14, 4, 4);
    ajrak.tex.wrapS = ajrak.tex.wrapT = THREE.RepeatWrapping; ajrak.tex.repeat.set(3, 2); ajrak.tex.needsUpdate = true; }
  const band = new THREE.Mesh(H.own(new THREE.BoxGeometry(1.9, 0.205, 0.4)), H.own(new THREE.MeshStandardMaterial({ map: ajrak.tex, roughness: 1 })));
  band.position.set(BX, 0.86, BZ + 1.0); root.add(band);
  // electrode leads
  const leadPts = (dx) => new THREE.CatmullRomCurve3([new V3(BX + 1.25, 0.66, BZ - 0.8), new V3(BX + 0.9, 0.95, BZ - 0.9), new V3(BX + 0.25 + dx, 1.02, BZ - 0.72)]);
  for (const dx of [-0.12, 0, 0.1]) H.add(new THREE.TubeGeometry(leadPts(dx), 12, 0.008, 4, false), paint(0x38bdf8, { roughness: 0.5 }), { shadow: false });
  tag('Simulated sleeper (EEG, EOG, EMG leads)', 0.24, { pos: [BX, 1.9, BZ] });
  interact('bed', [BX + 1.9, 1.0, BZ + 1.5], 2.2, 'Sleeper — explore sleep stages (Consciousness & Sleep)', () => H.openPanel('sleep'));

  // ---------------- control room (x > 0)
  const DX = 1.4;
  box(0.9, 0.06, 7.4, DX + 0.15, 0.76, -8, M.wood(), { collide: true });
  for (const dz of [-3.5, 3.5]) box(0.8, 0.72, 0.06, DX + 0.15, 0.37, -8 + dz, steel);
  const chairM = paint(0x1f2a44, { roughness: 0.8 });
  for (const z of [-10, -6]) { box(0.5, 0.08, 0.5, DX + 1.0, 0.48, z, chairM, { collide: true }); box(0.06, 0.55, 0.48, DX + 1.25, 0.8, z, chairM); cyl(0.03, 0.03, 0.44, DX + 1.0, 0.22, z, steel, { seg: 8 }); }
  // equipment rack with LEDs
  box(0.8, 2.0, 0.7, 16.9, 1.0, 2.6, paint(0x111827, { roughness: 0.5 }), { collide: true });
  const leds = [];
  for (let i = 0; i < 12; i++) leds.push(new V3(16.48, 0.3 + i * 0.15, 2.4 + (i % 3) * 0.1));
  const ledMesh = new THREE.InstancedMesh(H.own(new THREE.BoxGeometry(0.02, 0.03, 0.05)), H.own(new THREE.MeshBasicMaterial({ color: 0xffffff })), leds.length);
  leds.forEach((p, i) => { ledMesh.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); ledMesh.setColorAt(i, new THREE.Color(0.2, 1.6, 0.6)); });
  root.add(ledMesh);

  // wall monitor: simulated EEG + hypnogram
  const EW = 1600, EH = 900;
  const eeg = H.canvas(EW, EH);
  const scrM = H.own(new THREE.MeshStandardMaterial({ map: eeg.tex, emissive: 0xffffff, emissiveMap: eeg.tex, emissiveIntensity: 0.95, roughness: 0.25 }));
  const MW = 8.6, MH = MW * EH / EW;
  const mon = new THREE.Mesh(H.own(new THREE.PlaneGeometry(MW, MH)), scrM);
  mon.position.set(9.4, 2.55, -S.hd + 0.33); root.add(mon);
  box(MW + 0.2, MH + 0.2, 0.12, 9.4, 2.55, -S.hd + 0.24, paint(0x0b0f19, { roughness: 0.4 }));
  // desk monitors share the same texture
  for (const [z, ry] of [[-9.2, Math.PI / 2], [-6.8, Math.PI / 2]]) {
    const dm = new THREE.Mesh(H.own(new THREE.PlaneGeometry(1.0, 0.56)), scrM);
    dm.position.set(DX + 0.1, 1.15, z); dm.rotation.y = ry; root.add(dm);
    box(0.05, 0.62, 1.06, DX + 0.07, 1.15, z, paint(0x0b0f19)); box(0.06, 0.3, 0.06, DX + 0.12, 0.9, z, steel);
  }
  tag('Wall monitor — simulated EEG', 0.3, { pos: [9.4, 5.0, -S.hd + 0.6] });

  const FS = 100, WIN = 10, N = FS * WIN;
  const CH = ['C3–A2  EEG', 'O1–A2  EEG', 'EOG  (eyes)', 'EMG  (chin)'];
  const GAIN = [0.9, 0.9, 0.55, 1.4];
  const bufs = CH.map(() => new Float32Array(N));
  const gen = makeEEG(20251114);
  const st = { simT: 0, head: 0, nightMin: 0, lastStage: -1, redraw: 0, hyp: null };

  function drawEEG() {
    const g = eeg.g;
    const { st: stage, idx } = stageAt(st.nightMin);
    g.fillStyle = '#060b16'; g.fillRect(0, 0, EW, EH);
    // header
    g.fillStyle = '#0f1a2e'; g.fillRect(0, 0, EW, 92);
    g.fillStyle = CSS.crimson; g.fillRect(0, 0, EW, 8);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = '#FCD34D'; g.font = `700 34px ${FONT}`; g.fillText('SIMULATED EEG', 28, 48);
    g.fillStyle = '#94A3B8'; g.font = `400 22px ${FONT}`; g.fillText('procedural teaching waveforms · not real recordings', 290, 50);
    const clockMin = NIGHT_START_H * 60 + st.nightMin;
    const hh = Math.floor(clockMin / 60) % 24, mm = Math.floor(clockMin % 60);
    g.textAlign = 'right'; g.fillStyle = CSS.chalk; g.font = `700 34px ${FONT}`;
    g.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, EW - 28, 48);
    g.fillStyle = stage === STAGES.REM ? '#F87171' : stage === STAGES.N3 ? '#818CF8' : '#5EEAD4';
    g.font = `700 32px ${FONT}`; g.fillText(STAGE_NAME[stage], EW - 150, 48);
    // traces
    const top = 110, chH = 125, x0 = 220, xw = EW - x0 - 30;
    g.font = `600 22px ${FONT}`; g.textAlign = 'left';
    for (let c = 0; c < 4; c++) {
      const yc = top + chH * c + chH / 2;
      g.fillStyle = 'rgba(148,163,184,0.08)'; g.fillRect(x0, yc - chH / 2 + 6, xw, chH - 12);
      g.fillStyle = '#CBD5E1'; g.fillText(CH[c], 24, yc);
      g.strokeStyle = 'rgba(148,163,184,0.18)'; g.lineWidth = 1;
      g.beginPath(); for (let s = 0; s <= WIN; s++) { const x = x0 + (xw * s) / WIN; g.moveTo(x, yc - chH / 2 + 6); g.lineTo(x, yc + chH / 2 - 6); } g.stroke();
      g.strokeStyle = ['#5EEAD4', '#A5B4FC', '#FCD34D', '#F9A8D4'][c]; g.lineWidth = 2;
      g.beginPath();
      const b = bufs[c], k = GAIN[c], step = Math.max(1, Math.round(N / xw));
      for (let i = 0; i < N; i += step) {
        const x = x0 + (xw * i) / N, y = yc - Math.max(-chH * 0.48, Math.min(chH * 0.48, b[i] * k));
        if (i === 0 || i === st.head + step || (i > st.head && i - step <= st.head)) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    const hx = x0 + (xw * st.head) / N;
    g.fillStyle = '#060b16'; g.fillRect(hx + 2, top, 26, chH * 4);
    g.fillStyle = 'rgba(245,158,11,0.7)'; g.fillRect(hx, top, 2, chH * 4);
    g.fillStyle = '#64748B'; g.font = `400 18px ${FONT}`; g.fillText('1 s / division', x0, top + chH * 4 + 4);
    // stage note
    g.fillStyle = '#E2E8F0'; g.font = `400 22px ${FONT}`;
    g.fillText(STAGE_NOTE[stage], 28, top + chH * 4 + 34);
    // hypnogram
    const hy0 = 680, hh2 = 170, hxw = EW - 300, hx0 = 220;
    g.fillStyle = '#0f1a2e'; g.fillRect(0, hy0 - 22, EW, EH - hy0 + 22);
    g.fillStyle = '#FCD34D'; g.font = `700 24px ${FONT}`; g.fillText('HYPNOGRAM', 28, hy0 + 2);
    const lv = ['W', 'REM', 'N1', 'N2', 'N3'];
    g.font = `500 18px ${FONT}`; g.fillStyle = '#94A3B8';
    for (let i = 0; i < 5; i++) g.fillText(lv[i], hx0 - 50, hy0 + 20 + (i * hh2) / 4.6);
    const yOf = (s) => hy0 + 20 + (s * hh2) / 4.6;
    let acc = 0; g.lineWidth = 3;
    for (let i = 0; i <= idx; i++) {
      const s = STAGES[NIGHT[i][0]];
      const a = acc, bnd = Math.min(acc + NIGHT[i][1], st.nightMin);
      const xa = hx0 + (hxw * a) / NIGHT_MIN, xb = hx0 + (hxw * bnd) / NIGHT_MIN;
      g.strokeStyle = s === STAGES.REM ? '#F87171' : '#5EEAD4'; g.lineWidth = s === STAGES.REM ? 6 : 3;
      g.beginPath(); g.moveTo(xa, yOf(s)); g.lineTo(xb, yOf(s)); g.stroke();
      if (i > 0) { const ps = STAGES[NIGHT[i - 1][0]]; g.strokeStyle = 'rgba(94,234,212,0.6)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xa, yOf(ps)); g.lineTo(xa, yOf(s)); g.stroke(); }
      acc += NIGHT[i][1];
    }
    for (let h = 0; h <= Math.floor(NIGHT_MIN / 60); h++) {
      const x = hx0 + (hxw * h * 60) / NIGHT_MIN;
      g.fillStyle = '#64748B'; g.fillRect(x, hy0 + 14, 1, hh2 - 10);
      g.fillText(`${String((NIGHT_START_H + h) % 24).padStart(2, '0')}:00`, x - 22, EH - 18);
    }
    const cx = hx0 + (hxw * st.nightMin) / NIGHT_MIN;
    g.fillStyle = '#F59E0B'; g.fillRect(cx - 1, hy0 + 10, 3, hh2);
    eeg.tex.needsUpdate = true;
  }

  // ---------------- lobby: circadian clock sculpture
  const CX = 0, CZ = 10.8, CY = 2.7, CR = 1.7;
  cyl(1.2, 1.35, 0.5, CX, 0.25, CZ, paint(0x2a2440, { roughness: 0.6 }), { collide: true, seg: 32 });
  box(0.25, CY - 0.5, 0.25, CX, (CY + 0.5) / 2 - 0.2, CZ, steel);
  const ring = new THREE.Mesh(H.own(new THREE.TorusGeometry(CR, 0.09, 12, 72)), paint(PAL.saffron, { roughness: 0.3, metalness: 0.6 }));
  ring.position.set(CX, CY, CZ); ring.castShadow = true; root.add(ring);
  const dial = H.canvas(1024, 1024);
  { const g = dial.g, c = 512, r = 500;
    g.fillStyle = '#0b0a24'; g.beginPath(); g.arc(c, c, r, 0, 7); g.fill();
    // angle convention: 24:00 at top, clockwise; a(h) = h/24·2π − π/2
    const a = (h) => (h / 24) * Math.PI * 2 - Math.PI / 2;
    const arc = (h0, h1, col, rr0, rr1) => { g.fillStyle = col; g.beginPath(); g.arc(c, c, rr1, a(h0), a(h1)); g.arc(c, c, rr0, a(h1), a(h0), true); g.closePath(); g.fill(); };
    arc(6, 18, '#F59E0B', 330, 470); arc(18, 30, '#312E81', 330, 470);
    arc(21, 31, 'rgba(167,139,250,0.85)', 250, 320); // melatonin (evening → early morning)
    g.fillStyle = CSS.chalk; g.font = `700 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const h of [0, 6, 12, 18]) { const ang = a(h); g.fillText(h === 0 ? '24' : String(h).padStart(2, '0'), c + Math.cos(ang) * 400, c + Math.sin(ang) * 400); }
    g.strokeStyle = '#F8FAFC'; g.lineWidth = 4;
    for (let h = 0; h < 24; h++) { const ang = a(h); g.beginPath(); g.moveTo(c + Math.cos(ang) * 470, c + Math.sin(ang) * 470); g.lineTo(c + Math.cos(ang) * (h % 6 ? 450 : 430), c + Math.sin(ang) * (h % 6 ? 450 : 430)); g.stroke(); }
    g.font = `600 30px ${FONT}`; g.fillStyle = '#DDD6FE'; g.fillText('melatonin ↑', c - 170, c - 140);
    g.fillStyle = '#FCD34D'; g.fillText('light / alertness', c + 150, c + 160);
    g.fillStyle = CSS.chalk; g.font = `700 44px ${FONT}`; g.fillText('CIRCADIAN', c, c - 30); g.font = `500 32px ${FONT}`; g.fillText('≈ 24-hour rhythm', c, c + 22);
    g.fillStyle = '#94A3B8'; g.font = `400 24px ${FONT}`; g.fillText('simplified teaching dial', c, c + 70);
    dial.tex.needsUpdate = true; }
  const dialM = H.own(new THREE.MeshStandardMaterial({ map: dial.tex, emissive: 0xffffff, emissiveMap: dial.tex, emissiveIntensity: 0.55, roughness: 0.5, side: THREE.DoubleSide }));
  const dialMesh = new THREE.Mesh(H.own(new THREE.CircleGeometry(CR - 0.08, 64)), dialM);
  dialMesh.position.set(CX, CY, CZ + 0.02); root.add(dialMesh);
  const hand = new THREE.Group(); hand.position.set(CX, CY, CZ + 0.08); root.add(hand);
  const handMesh = new THREE.Mesh(H.own(new THREE.BoxGeometry(0.06, CR * 0.9, 0.03)), glow(PAL.chalk, 1.2)); handMesh.position.y = CR * 0.45; hand.add(handMesh);
  const sun = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.22, 20, 14)), glow(PAL.saffron, 2.4));
  const moon = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.17, 20, 14)), glow(0xc7d2fe, 1.4));
  root.add(sun, moon);
  tag('Circadian clock', 0.36, { pos: [CX, CY + CR + 0.6, CZ] });
  interact('clock', [CX, 1.0, CZ + 1.9], 2.4, 'Circadian clock — Consciousness & Sleep', () => H.openPanel('sleep'));
  interact('monitor', [9.4, 1.0, -S.hd + 2.6], 3.0, 'Simulated EEG & hypnogram — Consciousness & Sleep', () => H.openPanel('sleep'));

  // lobby dressing
  for (const x of [-11, 11]) { box(3.0, 0.08, 0.7, x, 0.46, 13.5, M.wood(), { collide: true }); box(2.8, 0.42, 0.6, x, 0.21, 13.5, paint(0x2a2440)); }
  const leaf = paint(0x2f7d4f, { roughness: 0.8 }), pot = paint(PAL.crimson, { roughness: 0.6 });
  for (const [x, z] of [[-16.5, 15.5], [16.5, 15.5], [-16.5, 6], [16.5, 6]]) { cyl(0.4, 0.34, 0.65, x, 0.33, z, pot, { collide: true }); H.sphere(0.55, x, 1.05, z, leaf, { sy: 1.25, seg: 10 }); }
  sign([{ t: 'Sleep stages', size: 0.13, weight: 700 }, { t: 'A night cycles roughly every 90 minutes through N1 → N2 → N3 → REM. Deep N3 dominates early; REM periods lengthen toward morning.', size: 0.075, weight: 400, color: '#CBD5E1' },
    { t: 'The monitor and hypnogram are a simulated, compressed night (1 s ≈ 1 min).', size: 0.065, weight: 400, color: '#FCD34D' }], 3.6, 1.7, { pos: [-S.hw + 0.25, 2.2, 10.5], ry: Math.PI / 2, px: 200 });
  sign([{ t: 'Consciousness', size: 0.13, weight: 700 }, { t: 'Awareness of ourselves and our surroundings varies with sleep, attention, drugs and hypnosis. EEG shows brain rhythms, not thoughts.', size: 0.075, weight: 400, color: '#CBD5E1' }],
    3.6, 1.5, { pos: [S.hw - 0.25, 2.2, 10.5], ry: -Math.PI / 2, px: 200 });
  for (const [x, z] of [[-8, 11], [8, 11], [0, 15], [9, -5], [9, -12]]) lamp(x, (z > PZ ? S.H : S.H - 1.1) - 0.08, z, 2.0, 0.5);
  light(0xffb070, 10, 7, BX - 1.3, 1.6, BZ - 0.3, true);
  light(0xcfe0ff, 28, 14, 9, 3.6, -8);
  anchor('bed', new V3(BX, 1, BZ)); anchor('monitor', new V3(9.4, 2.5, -S.hd + 0.4)); anchor('clock', new V3(CX, CY, CZ));
  H.flush(); H.buildHotspots();

  // ---------------- animation
  let acc = 0, ledT = 0;
  function update(dt, t) {
    dt = Math.min(dt || 0, 0.1);
    H.updateHotspots(t);
    const rm = H.reduced();
    st.nightMin = (st.nightMin + dt * MIN_PER_SEC) % NIGHT_MIN;
    const { st: stage } = stageAt(st.nightMin);
    // clock hand + sun/moon (simulated clock time)
    const clockH = (NIGHT_START_H + st.nightMin / 60) % 24;
    const ang = -(clockH / 24) * Math.PI * 2; // 24:00 at top, clockwise as seen from +Z
    hand.rotation.z = ang;
    const ra = Math.PI / 2 + ang, rs = CR + 0.35;
    sun.position.set(CX + Math.cos(ra + Math.PI) * rs, CY + Math.sin(ra + Math.PI) * rs, CZ);
    moon.position.set(CX + Math.cos(ra) * rs, CY + Math.sin(ra) * rs, CZ);
    // breathing (slow, regular in N3; irregular in REM)
    const br = stage === STAGES.N3 ? 0.23 : stage === STAGES.REM ? 0.32 + 0.08 * Math.sin(t * 0.7) : 0.27;
    const amp = rm ? 0.015 : 0.04;
    blanket.scale.y = 1 + amp * Math.sin(t * 2 * Math.PI * br);
    band.scale.y = blanket.scale.y;
    if (H.camDist() > 70) return;
    // generate EEG samples at FS
    const n = Math.min(FS, Math.round((st.simT + dt) * FS) - Math.round(st.simT * FS));
    for (let i = 0; i < n; i++) {
      const tt = st.simT + i / FS;
      const v = gen(tt, stage);
      st.head = (st.head + 1) % N;
      for (let c = 0; c < 4; c++) bufs[c][st.head] = v[c];
    }
    st.simT += dt;
    acc += dt;
    if (acc > (rm ? 0.2 : 1 / 15)) { acc = 0; drawEEG(); }
    ledT += dt;
    if (ledT > 0.25) { ledT = 0; for (let i = 0; i < leds.length; i++) { const on = H.rnd() > 0.35; ledMesh.setColorAt(i, on ? new THREE.Color(0.2, 1.6, 0.6) : new THREE.Color(0.05, 0.2, 0.1)); } ledMesh.instanceColor.needsUpdate = true; }
    if (stage !== st.lastStage) { st.lastStage = stage; }
    if (!sleeper.simple && (t % 1) < dt) { try { sleeper.setAUs && sleeper.setAUs({ 43: 1 }); } catch (e) { /* noop */ } }
    H.updatePeople(dt, t);
  }
  drawEEG();
  return { update, dispose: H.dispose };
}

module.exports = { id: ZONE, build, _makeEEG: makeEEG, _stageAt: stageAt, NIGHT };
