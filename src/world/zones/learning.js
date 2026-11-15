'use strict';
/**
 * Learning Lab (zone 5) — A2 World. WORLD_API zone builder: module.exports = { id, build(kit) }.
 * Local coords, entrance toward +Z. Four glass operant chambers ("Skinner boxes") with original low-poly cartoon
 * rat/pigeon agents responding on FR/VR/FI/VI schedules from src/psych/learning.js simulateSchedule (seeded), each
 * with a live cumulative-record paper roll (CanvasTexture); a Pavlov bell station (bell + light, Rescorla–Wagner
 * conditioningCurve drives the salivation meter); a shaping arena (shapingStep); and an observational-learning
 * playroom with an ORIGINAL inflatable roly-poly toy ("Lattoo", Bobo-style but not the original design).
 * Interactables → paradigms operant_schedules / classical_cond / shaping, panel 'learning'. Animal behaviour is simulated.
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
    box(doorW + 5, 0.14, 3.0, 0, -0.04, hd + 1.6, M.stone(), { shadow: false });
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
    const cz = hd + 1.55;
    box(doorW + 4.2, 0.22, 3.0, 0, doorH + 0.7, cz, dark);
    box(doorW + 4.3, 0.08, 3.1, 0, doorH + 0.58, cz, saff, { shadow: false });
    for (const sx of [-1, 1]) cyl(0.14, 0.16, doorH + 0.6, sx * (doorW / 2 + 1.6), (doorH + 0.6) / 2, hd + 2.8, fm, { collide: true, seg: 14 });
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


const ZONE = 'learning';
let LM = null, RngC = null;
try { LM = require('../../psych/learning.js'); } catch (e) { LM = null; }
try { RngC = require('../../core/rng.js').Rng; } catch (e) { RngC = null; }

function localRng(seed) {
  if (RngC) return new RngC(seed);
  let s = seed >>> 0;
  const random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { random, normal: (m, sd) => m + sd * (random() + random() + random() - 1.5) * 1.41 };
}
/** Response + reinforcer event times for a schedule (seeded). */
function scheduleEvents(type, param, seed, seconds) {
  const rng = localRng(seed);
  let sim = null;
  if (LM && LM.simulateSchedule) { try { sim = LM.simulateSchedule(type, param, rng, { seconds }); } catch (e) { sim = null; } }
  const resp = [], rf = [];
  if (sim) {
    for (let k = 1; k < sim.record.length; k++) {
      const n = sim.record[k].count - sim.record[k - 1].count, t0 = sim.record[k - 1].t;
      for (let j = 0; j < n; j++) resp.push(t0 + (j + 0.5) / n);
    }
    for (const r of sim.reinforcers) rf.push(r.t);
  } else { // fallback: constant-rate FR-style responder
    let c = 0;
    for (let t = 0; t < seconds; t += 0.5) { resp.push(t); if (++c % param === 0) rf.push(t); }
  }
  return { resp, rf, total: resp.length };
}

function build(kit) {
  const H = makeHelpers(kit, ZONE);
  const { THREE, V3, box, cyl, paint, glow, glass, M, tag, sign, interact, light, lamp, root, wall } = H;
  const S = H.shell({ h: 6, skyZ: -3, skyD: 8, skyW: 14 });
  const anchor = (name, v) => { if (typeof kit.anchor === 'function') kit.anchor(name, v); };
  const steel = paint(0x2b2f3a, { roughness: 0.4, metalness: 0.8 });
  const SESSION = 600;
  const anims = [];

  // ---------------- original cartoon agents
  function makeRat(scale) {
    const g = new THREE.Group();
    const fur = paint(0xe7e5e4, { roughness: 0.9 }), pink = paint(0xf9a8d4, { roughness: 0.7 }), ink = paint(0x111111, { roughness: 0.3 });
    const body = new THREE.Mesh(H.own(new THREE.SphereGeometry(1, 14, 10)), fur); body.scale.set(0.13, 0.1, 0.2); body.position.set(0, 0.11, 0);
    const front = new THREE.Group(); front.position.set(0, 0.12, 0.12); g.add(body, front);
    const head = new THREE.Mesh(H.own(new THREE.ConeGeometry(0.075, 0.18, 10)), fur); head.rotation.x = Math.PI / 2; head.position.set(0, 0.03, 0.1); front.add(head);
    const nose = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.018, 8, 6)), pink); nose.position.set(0, 0.03, 0.19); front.add(nose);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.035, 8, 6)), pink); ear.scale.set(1, 1, 0.35); ear.position.set(0.045 * s, 0.09, 0.05); front.add(ear);
      const eye = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.012, 6, 5)), ink); eye.position.set(0.035 * s, 0.055, 0.12); front.add(eye);
      const paw = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.022, 6, 5)), pink); paw.position.set(0.05 * s, -0.08, 0.07); front.add(paw);
    }
    const tail = new THREE.Mesh(H.own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(0, 0.08, -0.18), new V3(0.05, 0.03, -0.32), new V3(-0.04, 0.02, -0.45)]), 10, 0.01, 5, false)), pink);
    g.add(tail);
    g.scale.setScalar(scale || 1);
    return { g, front, kind: 'rat' };
  }
  function makePigeon(scale) {
    const g = new THREE.Group();
    const grey = paint(0x94a3b8, { roughness: 0.8 }), dark = paint(0x475569, { roughness: 0.8 }), neck = paint(0x14b8a6, { roughness: 0.4, metalness: 0.3 }), beakM = paint(0xf59e0b, { roughness: 0.5 }), ink = paint(0x111111);
    const body = new THREE.Mesh(H.own(new THREE.SphereGeometry(1, 14, 10)), grey); body.scale.set(0.11, 0.11, 0.17); body.position.set(0, 0.17, 0); g.add(body);
    for (const s of [-1, 1]) { const w = new THREE.Mesh(H.own(new THREE.SphereGeometry(1, 10, 8)), dark); w.scale.set(0.03, 0.08, 0.15); w.position.set(0.1 * s, 0.18, -0.03); g.add(w);
      const leg = new THREE.Mesh(H.own(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 5)), beakM); leg.position.set(0.04 * s, 0.04, 0.02); g.add(leg); }
    const tail = new THREE.Mesh(H.own(new THREE.BoxGeometry(0.1, 0.02, 0.12)), dark); tail.position.set(0, 0.15, -0.19); tail.rotation.x = 0.3; g.add(tail);
    const front = new THREE.Group(); front.position.set(0, 0.24, 0.1); g.add(front);
    const ring = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.06, 10, 8)), neck); ring.position.set(0, 0.0, 0.0); front.add(ring);
    const head = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.055, 12, 10)), grey); head.position.set(0, 0.07, 0.04); front.add(head);
    const beak = new THREE.Mesh(H.own(new THREE.ConeGeometry(0.015, 0.05, 6)), beakM); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.065, 0.11); front.add(beak);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.01, 6, 5)), ink); e.position.set(0.04 * s, 0.085, 0.07); front.add(e); }
    g.scale.setScalar(scale || 1);
    return { g, front, kind: 'pigeon' };
  }

  // ---------------- operant chambers (back-left bench)
  const BZ = -12.2, benchY = 0.9;
  box(14.2, 0.08, 1.3, -9.6, benchY - 0.04, BZ, M.wood(), { collide: true });
  box(14.0, benchY - 0.08, 1.2, -9.6, (benchY - 0.08) / 2, BZ, paint(0x2a2440, { roughness: 0.7 }), { collide: true });
  const SCHED = [
    { type: 'FR', param: 10, label: 'FR-10', animal: 'rat' }, { type: 'VR', param: 10, label: 'VR-10', animal: 'rat' },
    { type: 'FI', param: 30, label: 'FI-30 s', animal: 'pigeon' }, { type: 'VI', param: 30, label: 'VI-30 s', animal: 'pigeon' },
  ];
  const chambers = [];
  const bw = 1.15, bh = 0.8, bd = 0.85;
  SCHED.forEach((sc, i) => {
    const x = -15.4 + i * 3.6, y0 = benchY, z = BZ;
    // glass shell + floor grid + steel frame
    box(bw, 0.03, bd, x, y0 + 0.015, z, paint(0x334155, { roughness: 0.5, metalness: 0.5 }));
    for (const [w, h, d, dx, dy, dz] of [[bw, bh, 0.01, 0, bh / 2, bd / 2], [0.01, bh, bd, -bw / 2, bh / 2, 0], [0.01, bh, bd, bw / 2, bh / 2, 0], [bw, 0.01, bd, 0, bh, 0]])
      box(w, h, d, x + dx, y0 + dy, z + dz, glass(0xdbeafe, 0.14), { shadow: false });
    box(bw, bh, 0.04, x, y0 + bh / 2, z - bd / 2, paint(0x1f2937, { roughness: 0.6 }));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(0.025, bh, 0.025, x + dx * bw / 2, y0 + bh / 2, z + dz * bd / 2, steel);
    // manipulandum (lever or key), cue light, food hopper
    const lever = new THREE.Group(); lever.position.set(x - 0.2, y0 + 0.22, z - bd / 2 + 0.03); root.add(lever);
    const lm = new THREE.Mesh(H.own(new THREE.BoxGeometry(0.12, 0.02, 0.12)), M.metal()); lm.position.z = 0.06; lever.add(lm);
    const isKey = sc.animal === 'pigeon';
    if (isKey) { lever.position.y = y0 + 0.42; lm.scale.set(0.6, 3, 0.15); }
    const cue = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.035, 10, 8)), H.own(new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xffd27a, emissiveIntensity: 0.2 })));
    cue.position.set(x - 0.2, y0 + 0.6, z - bd / 2 + 0.04); root.add(cue);
    box(0.16, 0.12, 0.06, x + 0.25, y0 + 0.1, z - bd / 2 + 0.05, paint(0x64748b, { metalness: 0.6, roughness: 0.4 }));
    const hopLight = new THREE.Mesh(H.own(new THREE.BoxGeometry(0.12, 0.06, 0.01)), H.own(new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x7cff9e, emissiveIntensity: 0 })));
    hopLight.position.set(x + 0.25, y0 + 0.1, z - bd / 2 + 0.085); root.add(hopLight);
    const pellet = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.018, 6, 5)), paint(0x92400e)); pellet.position.set(x + 0.25, y0 + 0.05, z - bd / 2 + 0.1); pellet.visible = false; root.add(pellet);
    // agent
    const A = isKey ? makePigeon(1.25) : makeRat(1.25);
    A.g.position.set(x - 0.05, y0 + 0.03, z + 0.05); A.g.rotation.y = Math.PI; root.add(A.g);
    // cumulative recorder: drum + paper roll
    const rx = x + 1.25;
    cyl(0.09, 0.09, 0.62, rx, y0 + 0.62, z + 0.05, steel, { rz: Math.PI / 2, seg: 16 });
    cyl(0.09, 0.09, 0.62, rx, y0 + 0.08, z + 0.05, steel, { rz: Math.PI / 2, seg: 16 });
    box(0.66, 0.6, 0.1, rx, y0 + 0.35, z - 0.08, paint(0x1f2937));
    const cv = H.canvas(512, 448);
    const paper = new THREE.Mesh(H.own(new THREE.PlaneGeometry(0.6, 0.525)), H.own(new THREE.MeshStandardMaterial({ map: cv.tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: cv.tex, emissiveIntensity: 0.25 })));
    paper.position.set(rx, y0 + 0.35, z + 0.15); paper.rotation.x = -0.12; root.add(paper);
    tag(`${sc.label} · ${isKey ? 'pigeon' : 'rat'} (simulated)`, 0.17, { pos: [x, y0 + bh + 0.3, z] });
    const ev = scheduleEvents(sc.type, sc.param, 1000 + i * 7, SESSION);
    const ch = { sc, x, z, lever, lm, isKey, cue, hopLight, pellet, A, cv, ev, ri: 0, fi: 0, press: 0, eat: 0, count: 0, lastX: 0, lastY: 0, offset: i * 37, lastT: -1, resetBase: 0 };
    chambers.push(ch);
    resetPaper(ch);
    interact('skinner' + (i + 1), [x, 1.1, z + 1.2], 1.6, `Operant chamber ${sc.label} — run operant schedules`, () => H.runParadigm('operant_schedules', 'learning'));
  });
  function resetPaper(ch) {
    const g = ch.cv.g, W = ch.cv.w, Hh = ch.cv.h;
    g.fillStyle = '#fbf7ec'; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = 'rgba(15,118,110,0.25)'; g.lineWidth = 1;
    for (let x = 0; x <= W; x += 32) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x, Hh); g.stroke(); }
    for (let y = 40; y <= Hh; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.fillStyle = '#1e1b4b'; g.font = `700 26px ${FONT}`; g.textBaseline = 'top'; g.textAlign = 'left';
    g.fillText(`Cumulative record · ${ch.sc.label}`, 10, 6);
    g.fillStyle = '#9f1239'; g.font = `500 18px ${FONT}`; g.textAlign = 'right'; g.fillText('simulated', W - 10, 10);
    ch.lastX = 0; ch.lastY = Hh - 2; ch.resetBase = 0; ch.cv.tex.needsUpdate = true;
  }
  const PEN_MAX = 120; // responses per pen excursion before reset
  function penStep(ch, t, count, reinforced) {
    const g = ch.cv.g, W = ch.cv.w, Hh = ch.cv.h, top = 44;
    const x = (t / SESSION) * W;
    let rel = count - ch.resetBase;
    if (rel > PEN_MAX) { ch.resetBase = count; rel = 0; g.strokeStyle = '#94a3b8'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, ch.lastY); g.lineTo(x, Hh - 2); g.stroke(); ch.lastY = Hh - 2; }
    const y = Hh - 2 - (rel / PEN_MAX) * (Hh - top - 4);
    g.strokeStyle = '#1e1b4b'; g.lineWidth = 2; g.beginPath(); g.moveTo(ch.lastX, ch.lastY); g.lineTo(x, y); g.stroke();
    if (reinforced) { g.strokeStyle = '#9f1239'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 6, y + 8); g.stroke(); }
    ch.lastX = x; ch.lastY = y;
  }

  // ---------------- Pavlov bell station (original cartoon dog)
  const PX = -12.5, PZ = -3.5;
  box(2.6, 0.4, 2.0, PX, 0.2, PZ, paint(0x2a2440, { roughness: 0.6 }), { collide: true });
  box(2.62, 0.05, 2.02, PX, 0.41, PZ, paint(PAL.saffron, { roughness: 0.4 }), { shadow: false });
  const dog = new THREE.Group(); dog.position.set(PX - 0.2, 0.43, PZ + 0.1); root.add(dog);
  { const fur = paint(0xc08a4e, { roughness: 0.9 }), dark = paint(0x6b4423, { roughness: 0.9 }), ink = paint(0x111111, { roughness: 0.3 });
    const add = (geo, m, p, s, r) => { const o = new THREE.Mesh(H.own(geo), m); o.position.set(...p); if (s) o.scale.set(...s); if (r) o.rotation.set(...r); o.castShadow = true; dog.add(o); return o; };
    add(new THREE.SphereGeometry(1, 14, 10), fur, [0, 0.32, -0.05], [0.22, 0.3, 0.28]);
    for (const s of [-1, 1]) { add(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 8), fur, [0.09 * s, 0.15, 0.14]); add(new THREE.SphereGeometry(1, 10, 8), fur, [0.15 * s, 0.1, -0.12], [0.08, 0.1, 0.16]); }
    dog.userData.head = new THREE.Group(); dog.userData.head.position.set(0, 0.62, 0.1); dog.add(dog.userData.head);
    const hd = dog.userData.head, addH = (geo, m, p, s, r) => { const o = new THREE.Mesh(H.own(geo), m); o.position.set(...p); if (s) o.scale.set(...s); if (r) o.rotation.set(...r); hd.add(o); return o; };
    addH(new THREE.SphereGeometry(0.15, 14, 10), fur, [0, 0, 0]);
    addH(new THREE.SphereGeometry(1, 10, 8), paint(0xe2c39b, { roughness: 0.9 }), [0, -0.04, 0.13], [0.08, 0.065, 0.1]);
    addH(new THREE.SphereGeometry(0.03, 8, 6), ink, [0, -0.01, 0.23]);
    for (const s of [-1, 1]) { addH(new THREE.SphereGeometry(1, 8, 6), dark, [0.13 * s, -0.03, -0.01], [0.04, 0.13, 0.08], [0, 0, 0.25 * s]); addH(new THREE.SphereGeometry(0.022, 8, 6), ink, [0.06 * s, 0.05, 0.12]); }
    add(new THREE.CylinderGeometry(0.02, 0.012, 0.25, 6), dark, [0, 0.25, -0.33], null, [-0.8, 0, 0]);
  }
  const bowl = new THREE.Mesh(H.own(new THREE.CylinderGeometry(0.14, 0.1, 0.07, 18)), M.metal()); bowl.position.set(PX - 0.2, 0.47, PZ + 0.55); root.add(bowl);
  const food = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.1, 10, 6)), paint(0x92400e)); food.scale.y = 0.4; food.position.set(PX - 0.2, 0.5, PZ + 0.55); food.visible = false; root.add(food);
  box(0.08, 2.2, 0.08, PX + 0.9, 1.5, PZ - 0.7, steel); box(0.9, 0.06, 0.06, PX + 0.5, 2.55, PZ - 0.7, steel);
  const bell = new THREE.Group(); bell.position.set(PX + 0.15, 2.5, PZ - 0.7); root.add(bell);
  { const pts = [[0, 0], [0.04, 0], [0.06, -0.06], [0.12, -0.2], [0.16, -0.3], [0.17, -0.32], [0, -0.32]].map(([a, b]) => new THREE.Vector2(a, b));
    const bm = new THREE.Mesh(H.own(new THREE.LatheGeometry(pts, 24)), paint(0xd4a017, { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide })); bm.castShadow = true; bell.add(bm); }
  const bulbM = H.own(new THREE.MeshStandardMaterial({ color: 0xfff7d6, emissive: 0xffd27a, emissiveIntensity: 0.1 }));
  const bulb = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.1, 14, 10)), bulbM); bulb.position.set(PX + 0.75, 2.3, PZ - 0.45); root.add(bulb);
  const drips = new THREE.InstancedMesh(H.own(new THREE.SphereGeometry(0.018, 6, 5)), glass(0xbfe9ff, 0.7), 8); root.add(drips);
  const dripS = Array.from({ length: 8 }, () => ({ y: -1, v: 0 }));
  const meter = H.canvas(512, 320);
  const meterMesh = new THREE.Mesh(H.own(new THREE.PlaneGeometry(1.4, 0.875)), H.own(new THREE.MeshStandardMaterial({ map: meter.tex, emissive: 0xffffff, emissiveMap: meter.tex, emissiveIntensity: 0.8 })));
  meterMesh.position.set(PX + 1.75, 1.45, PZ + 0.2); meterMesh.rotation.y = -0.5; root.add(meterMesh);
  box(0.06, 1.0, 0.06, PX + 1.75, 0.5, PZ + 0.18, steel);
  let curve = null;
  try { curve = LM && LM.conditioningCurve ? LM.conditioningCurve({ acq: 16, ext: 14 }) : null; } catch (e) { curve = null; }
  if (!curve) { curve = []; let v = 0; for (let i = 0; i < 30; i++) { v += (i < 16 ? 1 - v : -v) * 0.2; curve.push({ trial: i + 1, V: v, phase: i < 16 ? 'acquisition' : 'extinction' }); } }
  const pav = { trial: 0, tt: 0 };
  function drawMeter() {
    const g = meter.g, W = meter.w, Hh = meter.h;
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, Hh); g.fillStyle = CSS.crimson; g.fillRect(0, 0, W, 6);
    g.fillStyle = '#FCD34D'; g.font = `700 24px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('Conditioned response (model)', 16, 14);
    const c = curve[pav.trial];
    g.fillStyle = '#CBD5E1'; g.font = `400 18px ${FONT}`; g.fillText(`Trial ${c.trial} · ${c.phase} · Rescorla–Wagner V = ${c.V.toFixed(2)}`, 16, 46);
    const x0 = 30, y0 = Hh - 30, w = W - 60, h = Hh - 110;
    g.strokeStyle = '#475569'; g.beginPath(); g.moveTo(x0, y0 - h); g.lineTo(x0, y0); g.lineTo(x0 + w, y0); g.stroke();
    g.strokeStyle = '#5EEAD4'; g.lineWidth = 3; g.beginPath();
    for (let i = 0; i <= pav.trial; i++) { const x = x0 + (w * i) / (curve.length - 1), y = y0 - h * Math.max(0, Math.min(1, curve[i].V)); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#64748B'; g.font = `400 15px ${FONT}`; g.fillText('bell + light (CS) → food (US) in acquisition; CS alone in extinction', 16, Hh - 24);
    meter.tex.needsUpdate = true;
  }
  drawMeter();
  tag('Pavlov bell station (simulated dog)', 0.24, { pos: [PX, 3.0, PZ] });
  interact('pavlov', [PX + 0.6, 1.0, PZ + 1.6], 2.0, 'Pavlov station — run classical conditioning', () => H.runParadigm('classical_cond', 'learning'));

  // ---------------- shaping arena
  const SX = -5.2, SZ = -3.5;
  box(2.4, 0.7, 2.4, SX, 0.35, SZ, paint(0x2a2440, { roughness: 0.6 }), { collide: true });
  cyl(0.95, 0.95, 0.35, SX, 0.88, SZ, glass(0xdbeafe, 0.18), { open: true, seg: 32, shadow: false });
  cyl(0.95, 0.95, 0.02, SX, 0.71, SZ, paint(0x334155, { metalness: 0.4, roughness: 0.5 }), { seg: 32 });
  const sRat = makeRat(1.6); sRat.g.position.set(SX, 0.72, SZ); root.add(sRat.g);
  box(0.05, 1.2, 0.05, SX + 0.75, 1.3, SZ - 0.4, steel);
  const crit = new THREE.Mesh(H.own(new THREE.TorusGeometry(0.12, 0.012, 6, 24)), glow(PAL.saffron, 2)); crit.rotation.x = Math.PI / 2; root.add(crit);
  const shapeLight = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.05, 10, 8)), H.own(new THREE.MeshStandardMaterial({ color: 0x111, emissive: 0x7cff9e, emissiveIntensity: 0 })));
  shapeLight.position.set(SX + 0.75, 1.95, SZ - 0.4); root.add(shapeLight);
  const shp = { st: { mean: 0.08, spread: 0.12 }, crit: 0.15, wins: 0, timer: 0, beh: 0, rf: false, rng: localRng(77), hist: [] };
  const shCv = H.canvas(512, 256);
  const shMesh = new THREE.Mesh(H.own(new THREE.PlaneGeometry(1.2, 0.6)), H.own(new THREE.MeshStandardMaterial({ map: shCv.tex, emissive: 0xffffff, emissiveMap: shCv.tex, emissiveIntensity: 0.8 })));
  shMesh.position.set(SX, 1.9, SZ - 1.25); root.add(shMesh); box(0.05, 1.6, 0.05, SX, 0.8, SZ - 1.27, steel);
  function drawShaping() {
    const g = shCv.g, W = shCv.w, Hh = shCv.h;
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#FCD34D'; g.font = `700 22px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('Shaping: reinforce successive approximations (rearing height)', 12, 8);
    const bw2 = (W - 24) / 40;
    shp.hist.forEach((h, i) => { g.fillStyle = h.rf ? '#5EEAD4' : '#475569'; const bh2 = Math.max(2, h.b * 170); g.fillRect(12 + i * bw2, Hh - 20 - bh2, bw2 - 2, bh2); });
    g.strokeStyle = '#F59E0B'; g.setLineDash && g.setLineDash([6, 4]); g.beginPath(); g.moveTo(12, Hh - 20 - shp.crit * 170); g.lineTo(W - 12, Hh - 20 - shp.crit * 170); g.stroke(); g.setLineDash && g.setLineDash([]);
    shCv.tex.needsUpdate = true;
  }
  drawShaping();
  tag('Shaping arena', 0.26, { pos: [SX, 2.45, SZ - 1.25] });
  interact('shaping', [SX, 1.0, SZ + 1.7], 2.0, 'Shaping arena — run shaping by successive approximation', () => H.runParadigm('shaping', 'learning'));

  // ---------------- observational-learning playroom (right, glass-walled)
  const RX0 = 3.2, RZ1 = -5.5;
  wall('z', RX0, -S.hd, RZ1, 3.2, 0.1, steel, [{ c: (-S.hd + RZ1) / 2, w: (RZ1 + S.hd) - 0.4, sill: 0.15, top: 3.0, glassMat: glass(0xe0f2fe, 0.14) }]);
  wall('x', RZ1, RX0, S.hw, 3.2, 0.1, steel, [{ c: 6.5, w: 1.8, top: 2.4 }, { c: (8 + S.hw) / 2, w: S.hw - 8 - 0.3, sill: 0.15, top: 3.0, glassMat: glass(0xe0f2fe, 0.14) }]);
  box(S.hw - RX0, 0.1, S.hd + RZ1, (RX0 + S.hw) / 2, 3.25, (-S.hd + RZ1) / 2, paint(0xf1ece2, { roughness: 0.9 }));
  const matCols = [0x0f766e, 0xf59e0b, 0x9f1239, 0x6366f1, 0x22c55e];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) box(1.95, 0.04, 1.95, RX0 + 1.4 + i * 2, 0.02, -S.hd + 1.4 + j * 2, paint(matCols[(i + j) % 5], { roughness: 1 }), { shadow: false });
  // toy shelf + blocks + ball
  box(3.0, 1.2, 0.45, 15.8, 0.6, -16.4, M.wood(), { collide: true });
  for (let k = 0; k < 9; k++) box(0.22, 0.22, 0.22, 14.6 + (k % 5) * 0.32, 1.32 + Math.floor(k / 5) * 0.23, -16.35, paint(matCols[k % 5], { roughness: 0.6 }));
  H.sphere(0.25, 12.5, 0.25, -9, paint(0xef4444, { roughness: 0.4 }));
  // "Lattoo" — original inflatable roly-poly toy (two copies: model's and child's)
  function makeToy(scale) {
    const g = new THREE.Group(), pivot = new THREE.Group(); g.add(pivot);
    const skin = H.canvas(512, 256);
    { const c = skin.g; c.fillStyle = '#0F766E'; c.fillRect(0, 0, 512, 256); c.fillStyle = '#F59E0B';
      for (let y = 18; y < 256; y += 40) for (let x = (y / 40) % 2 ? 30 : 10; x < 512; x += 44) { c.beginPath(); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, r = k % 2 ? 6 : 13; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.fill(); }
      c.fillStyle = '#9F1239'; c.fillRect(0, 196, 512, 22); skin.tex.needsUpdate = true; }
    const sm = H.own(new THREE.MeshStandardMaterial({ map: skin.tex, roughness: 0.35, metalness: 0.0 }));
    const base = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.42, 24, 16)), sm); base.position.y = 0.42; pivot.add(base);
    const top = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.3, 24, 16)), sm); top.position.y = 0.95; top.scale.y = 1.15; pivot.add(top);
    const face = H.canvas(256, 256);
    { const c = face.g; c.fillStyle = '#FDE68A'; c.beginPath(); c.arc(128, 128, 120, 0, 7); c.fill();
      c.fillStyle = '#1E1B4B'; for (const x of [88, 168]) { c.beginPath(); c.ellipse(x, 110, 20, 28, 0, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 6, 100, 7, 0, 7); c.fill(); c.fillStyle = '#1E1B4B'; }
      c.strokeStyle = '#9F1239'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.arc(128, 150, 40, 0.2, Math.PI - 0.2); c.stroke();
      c.fillStyle = 'rgba(244,114,182,0.6)'; for (const x of [62, 194]) { c.beginPath(); c.arc(x, 160, 16, 0, 7); c.fill(); } face.tex.needsUpdate = true; }
    const fm = new THREE.Mesh(H.own(new THREE.CircleGeometry(0.2, 32)), H.own(new THREE.MeshStandardMaterial({ map: face.tex, roughness: 0.4, transparent: true })));
    fm.position.set(0, 0.98, 0.3); fm.rotation.x = -0.1; pivot.add(fm);
    const hat = new THREE.Mesh(H.own(new THREE.ConeGeometry(0.12, 0.25, 16)), paint(PAL.crimson, { roughness: 0.5 })); hat.position.y = 1.4; pivot.add(hat);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(scale);
    return { g, pivot, th: 0, w: 0, ax: 1 };
  }
  const toyA = makeToy(1.0), toyB = makeToy(0.8);
  toyA.g.position.set(8.5, 0.04, -11); toyB.g.position.set(13.2, 0.04, -12.6); root.add(toyA.g, toyB.g);
  H.collide(8.0, 0, -11.5, 9.0, 1.5, -10.5); H.collide(12.8, 0, -13.0, 13.6, 1.2, -12.2);
  const model = H.person({ lookIndex: 6, height: 1.72, name: 'Simulated adult model', outfit: 'kameez' }, 'idle');
  model.group.position.set(8.5, 0, -9.7); model.group.rotation.y = Math.PI;
  const child = H.person({ lookIndex: 9, height: 1.08, name: 'Simulated child', outfit: 'kurta' }, 'idle');
  child.group.position.set(12.4, 0, -11.4); child.group.rotation.y = 2.4;
  sign([{ t: 'Observational learning', size: 0.13, weight: 700 }, { t: 'Watching a model: attention → retention → reproduction → motivation. The child copies the push a moment later.', size: 0.075, weight: 400, color: '#CBD5E1' },
    { t: 'Original "Lattoo" roly-poly toy · simulated people', size: 0.06, color: '#FCD34D', weight: 500 }], 3.0, 1.35, { pos: [RX0 - 0.08, 1.9, -9], ry: -Math.PI / 2, px: 200 });
  interact('playroom', [6.5, 1.0, RZ1 + 1.2], 2.2, 'Observational-learning playroom — Learning Lab panel', () => { H.openPanel('learning'); toyA.w += 2.4; });
  const play = { t: 0 };

  // ---------------- dressing
  sign([{ t: 'LEARNING LAB', size: 0.16, weight: 800, color: '#FCD34D' }, { t: 'Classical conditioning · Operant schedules · Shaping · Observational learning', size: 0.08, weight: 500 },
    { t: 'All animals are original cartoon simulations driven by teaching models — no animal data.', size: 0.065, weight: 400, color: '#CBD5E1' }], 4.4, 1.6, { pos: [-S.hw + 0.25, 2.3, 9], ry: Math.PI / 2, px: 200 });
  sign([{ t: 'Reading a cumulative record', size: 0.12, weight: 700 }, { t: 'Steeper line = faster responding. Ticks mark reinforcers. FR: pause then run; VR: steep and steady; FI: scallops; VI: moderate, steady.', size: 0.075, weight: 400, color: '#CBD5E1' }],
    3.6, 1.6, { pos: [-9.6, 2.6, -S.hd + 0.33], px: 200 });
  for (const x of [-8, 8]) { box(3.0, 0.08, 0.7, x, 0.46, 12.5, M.wood(), { collide: true }); box(2.8, 0.42, 0.6, x, 0.21, 12.5, paint(0x2a2440)); }
  const leaf = paint(0x2f7d4f, { roughness: 0.8 }), pot = paint(PAL.crimson, { roughness: 0.6 });
  for (const [x, z] of [[-16.5, 15.5], [16.5, 15.5], [16.5, 2], [-2, 15.5], [2, 15.5]]) { cyl(0.4, 0.34, 0.65, x, 0.33, z, pot, { collide: true }); H.sphere(0.55, x, 1.05, z, leaf, { sy: 1.25, seg: 10 }); }
  for (const [x, z] of [[-9.6, -12], [-9, -3], [10, -11], [0, 8], [10, 4]]) lamp(x, (x > RX0 && z < RZ1 ? 3.18 : S.H - 0.08), z, 2.2, 0.5);
  light(0xfff1d6, 30, 16, -9, 3.6, -8, true);
  light(0xffe7c2, 22, 12, 10, 2.9, -11);
  anchor('skinner', new V3(-9.6, 1.4, BZ)); anchor('pavlov', new V3(PX, 1.4, PZ)); anchor('shaping', new V3(SX, 1.2, SZ)); anchor('playroom', new V3(10, 1.2, -11));
  H.flush(); H.buildHotspots();

  // ---------------- animation
  const dm = new THREE.Matrix4();
  let recAcc = 0;
  function update(dt, t) {
    dt = Math.min(dt || 0, 0.1);
    H.updateHotspots(t);
    const rm = H.reduced();
    if (H.camDist() > 70) return;
    // operant chambers
    let paperDirty = false;
    for (const ch of chambers) {
      const ts = (t + ch.offset) % SESSION;
      if (ts < ch.lastT) { ch.ri = 0; ch.fi = 0; ch.count = 0; resetPaper(ch); }
      ch.lastT = ts;
      let pressed = false;
      while (ch.ri < ch.ev.resp.length && ch.ev.resp[ch.ri] <= ts) { ch.ri++; ch.count++; pressed = true; }
      let reinf = false;
      while (ch.fi < ch.ev.rf.length && ch.ev.rf[ch.fi] <= ts) { ch.fi++; reinf = true; }
      if (pressed || reinf) { penStep(ch, ts, ch.count, reinf); paperDirty = true; ch.dirty = true; }
      if (pressed) ch.press = 0.16;
      if (reinf) ch.eat = rm ? 0.8 : 1.4;
      ch.press = Math.max(0, ch.press - dt); ch.eat = Math.max(0, ch.eat - dt);
      const p = ch.press > 0 ? Math.sin((ch.press / 0.16) * Math.PI) : 0;
      if (ch.isKey) { ch.lm.position.z = 0.06 - 0.01 * p; ch.A.front.rotation.x = 0.5 * p; ch.A.front.position.z = 0.1 + 0.04 * p; }
      else { ch.lever.rotation.x = 0.35 * p; ch.A.front.position.y = 0.12 + 0.05 * p; ch.A.front.rotation.x = -0.3 * p; }
      ch.hopLight.material.emissiveIntensity = ch.eat > 0 ? 2.5 : 0;
      ch.pellet.visible = ch.eat > 0.3;
      ch.cue.material.emissiveIntensity = ch.eat > 0 ? 0.2 : 1.6;
      ch.A.g.rotation.y = Math.PI + (ch.eat > 0 ? -0.5 : 0);
      if (ch.eat > 0 && !rm) ch.A.front.rotation.x = 0.25 + 0.15 * Math.sin(t * 18);
    }
    recAcc += dt;
    if (paperDirty && recAcc > 0.1) { recAcc = 0; for (const ch of chambers) if (ch.dirty) { ch.cv.tex.needsUpdate = true; ch.dirty = false; } }
    // Pavlov: 5 s trials — bell+light at 0.5 s, food at 1.4 s (acquisition only), salivation ∝ V
    pav.tt += dt;
    const ph = pav.tt;
    const c = curve[pav.trial], acq = /acq/.test(c.phase);
    const cs = ph > 0.5 && ph < 2.2;
    bell.rotation.z = cs && !rm ? 0.35 * Math.sin(ph * 22) : 0;
    bulbM.emissiveIntensity = cs ? 2.5 : 0.1;
    food.visible = acq && ph > 1.4 && ph < 3.6;
    dog.userData.head.rotation.x = (cs || food.visible ? 0.25 : 0) + (rm ? 0 : 0.03 * Math.sin(t * 2));
    const saliva = Math.max(0, Math.min(1, c.V)) * (cs ? 1 : 0) + (food.visible ? 0.6 : 0);
    for (let i = 0; i < 8; i++) {
      const d = dripS[i];
      if (d.y < 0 && H.rnd() < saliva * dt * 3) { d.y = 0.62; d.v = 0; }
      if (d.y >= 0) { d.v += 9.8 * dt * (rm ? 0.4 : 1); d.y -= d.v * dt; if (d.y < 0.47) d.y = -1; }
      dm.makeTranslation(PX - 0.2 + (i % 2 ? 0.02 : -0.02), d.y >= 0 ? 0.43 + d.y : -10, PZ + 0.55); drips.setMatrixAt(i, dm);
    }
    drips.instanceMatrix.needsUpdate = true;
    if (ph > 5) { pav.tt = 0; pav.trial = (pav.trial + 1) % curve.length; drawMeter(); }
    // shaping: one approximation every 1.6 s
    shp.timer += dt;
    if (shp.timer > (rm ? 2.4 : 1.6)) {
      shp.timer = 0;
      let r = null;
      try { r = LM && LM.shapingStep ? LM.shapingStep(shp.st, shp.crit, shp.rng) : null; } catch (e) { r = null; }
      if (!r) { const b = shp.st.mean + (shp.rng.random() - 0.5) * 0.3; r = { behaviour: b, reinforced: b >= shp.crit }; if (r.reinforced) shp.st.mean += 0.05; }
      shp.beh = Math.max(0, Math.min(1, r.behaviour)); shp.rf = r.reinforced;
      if (r.reinforced && ++shp.wins >= 3) { shp.wins = 0; shp.crit = Math.min(0.95, shp.crit + 0.06); }
      if (shp.crit >= 0.95 && shp.st.mean > 0.95) { shp.st = { mean: 0.08, spread: 0.12 }; shp.crit = 0.15; shp.hist.length = 0; }
      shp.hist.push({ b: shp.beh, rf: shp.rf }); if (shp.hist.length > 40) shp.hist.shift();
      drawShaping();
    }
    const rear = shp.beh * Math.min(1, shp.timer * 4) * (1 - Math.max(0, shp.timer - 1.0));
    sRat.g.rotation.x = -rear * 1.1; sRat.g.position.y = 0.72 + rear * 0.08;
    crit.position.set(SX + 0.75, 0.75 + shp.crit * 1.1, SZ - 0.4);
    shapeLight.material.emissiveIntensity = shp.rf && shp.timer < 0.8 ? 2.5 : 0;
    // playroom: model pushes the toy, child copies ~2 s later
    play.t += dt;
    const cyc = play.t % 9;
    if (cyc < dt) { toyA.w += rm ? 0.8 : 2.2; try { model.setPose && model.setPose('point'); } catch (e) { /* noop */ } }
    if (Math.abs(cyc - 2.5) < dt / 2 + 1e-6 || (cyc >= 2.5 && cyc - dt < 2.5)) { toyB.w += rm ? 0.6 : 1.8; try { child.setPose && child.setPose('point'); } catch (e) { /* noop */ } }
    if (Math.abs(cyc - 4.5) < dt) { try { model.setPose && model.setPose('idle'); child.setPose && child.setPose('idle'); } catch (e) { /* noop */ } }
    for (const toy of [toyA, toyB]) {
      toy.w += (-18 * toy.th - 1.6 * toy.w) * dt; toy.th += toy.w * dt;
      toy.th = Math.max(-0.9, Math.min(0.9, toy.th));
      toy.pivot.rotation.z = toy.th; toy.pivot.position.x = -toy.th * 0.42 * 0.5;
    }
    H.updatePeople(dt, t);
  }
  return { update, dispose: H.dispose };
}

module.exports = { id: ZONE, build, _scheduleEvents: scheduleEvents };
