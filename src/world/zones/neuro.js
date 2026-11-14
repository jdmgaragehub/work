'use strict';
/**
 * Neuro Atrium (zone 3) — A2 World. WORLD_API zone builder: module.exports = { id, build(kit) }.
 * Local coords, entrance toward +Z, 40 × 40 m footprint. Contents:
 *  - 12 m walk-through brain: brain SDF (lobes, temporal lobes, cerebellum folia, brainstem, sulci/gyri) →
 *    our own marching cubes (src/world/marching.js) once per resolution (tier) and cached; hollow cortex shell
 *    with a walk-in slot + central chamber; vertex-coloured textbook regions with a per-vertex glow attribute.
 *  - Function selector (cycles 7 functions + overview) lighting relevant regions, tracts and labels.
 *  - Neural-firing particles along tract curves (one Points draw call).
 *  - Neuron bridge (walkable deck over a giant myelinated axon; saltatory action-potential glow → neuron:spike, panel bio).
 *  - Synapse chamber (vesicles dock/fuse, transmitter crosses the cleft, receptors light) → panel bio.
 *  - Split-brain demo table (divided visual field screens, simulated participant) → panel brain.
 * All neuro interactables switch controls to 'neuro' mode. Everything is labelled as a simulated exhibit.
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


// =============================================================================================
// Neuro Atrium
// =============================================================================================
const { march, sd } = require('../marching.js');

const ZONE = 'neuro';
const BRAIN_C = [0, 3.9, -4.5];      // local centre of the sculpture
const SHELL_T = 0.6;                  // cortex shell thickness (m) — the inside is a walkable hollow
const RES = { low: 56, medium: 78, high: 98, ultra: 118 };
const BRAIN_CACHE = {};               // res → { positions, normals, indices, region, inner }

// region ids (labels follow glossary.json vocabulary)
const R = {
  frontal: 0, motor: 1, somato: 2, parietal: 3, temporal: 4, occipital: 5, visual: 6, cerebellum: 7, brainstem: 8,
  broca: 9, wernicke: 10, hippocampus: 11, amygdala: 12, thalamus: 13, callosum: 14,
};
const REGION_INFO = [
  ['Frontal lobe', 0x5b6cc9], ['Motor cortex', 0xe07a5f], ['Somatosensory cortex', 0xf2cc8f], ['Parietal lobe', 0x2fa190],
  ['Temporal lobe', 0xc2577e], ['Occipital lobe', 0x8e6cc0], ['Visual cortex', 0xb794f4], ['Cerebellum', 0xd9a441],
  ['Brainstem', 0x9c8c7a], ["Broca's area", 0xf59e0b], ["Wernicke's area", 0x22b8cf], ['Hippocampus', 0x7dd3fc],
  ['Amygdala', 0xf43f5e], ['Thalamus', 0x84cc16], ['Corpus callosum', 0xf8fafc],
];
const FUNCS = [
  { id: 'overview', name: 'Overview — all regions', regions: null, note: 'Each colour is a textbook region. Real functions depend on networks of regions working together.' },
  { id: 'language production', name: 'Language production', regions: [R.broca, R.motor, R.wernicke], note: "Broca's area (usually left frontal) helps plan speech; the motor cortex moves lips and tongue; the arcuate pathway links it with Wernicke's area." },
  { id: 'vision', name: 'Vision', regions: [R.occipital, R.visual, R.thalamus], note: 'Signals from the eyes relay through the thalamus to the visual cortex at the back of the occipital lobe.' },
  { id: 'memory formation', name: 'Memory formation', regions: [R.hippocampus, R.temporal], note: 'The hippocampus (medial temporal lobe) helps form new long-term declarative memories.' },
  { id: 'fear', name: 'Fear', regions: [R.amygdala, R.thalamus, R.frontal], note: 'The amygdala detects threat quickly; frontal regions help regulate the response.' },
  { id: 'movement', name: 'Movement', regions: [R.motor, R.cerebellum, R.brainstem], note: 'Motor cortex plans voluntary movement; the cerebellum coordinates timing; pathways run down through the brainstem.' },
  { id: 'touch', name: 'Touch', regions: [R.somato, R.thalamus, R.parietal], note: 'Touch signals relay via the thalamus to the somatosensory cortex just behind the central sulcus.' },
  { id: 'balance', name: 'Balance', regions: [R.cerebellum, R.brainstem], note: 'The cerebellum and brainstem combine inner-ear and body-position signals to keep you upright.' },
];

// ---------- brain signed-distance field (brain-relative coords: +x = left hemisphere, +z = anterior) ----------
function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function hemiD(x, y, z) {
  const hx = Math.abs(x);
  const w = 2.45 + 0.14 * Math.max(0, -z / 5.7);
  return Math.max(sd.ellipsoid(hx - 2.42, y, z, w, 3.25, 5.7), -(y + 2.75));
}
function temporalD(x, y, z) { return sd.ellipsoid(Math.abs(x) - 3.35, y + 1.7, z - 0.4, 1.45, 1.25, 2.9); }
function centralZ(y) { return -0.2 - 0.38 * Math.max(y, 0); }
function cerebrumD(x, y, z) {
  let d = sd.smin(hemiD(x, y, z), temporalD(x, y, z), 0.7);
  if (d > 0.8) return d;
  const hx = Math.abs(x);
  // lateral (Sylvian) fissure and central sulcus grooves
  const dl = sd.capsule(hx, y, z, 4.35, -0.75, 2.5, 4.15, 0.25, -1.9, 0);
  d += 0.38 * Math.exp(-(dl * dl) / 0.07);
  const dz = z - centralZ(y);
  d += 0.26 * Math.exp(-(dz * dz) / 0.035) * smoothstep(-0.8, 0.1, y);
  // gyri: winding ridge lines along the zero-sets of a warped trigonometric field
  const n = Math.sin(2.5 * x + 1.4 * Math.sin(1.3 * z + 0.3)) + Math.sin(2.7 * y + 1.3 * Math.sin(1.6 * x)) + Math.sin(2.3 * z + 1.2 * Math.sin(1.5 * y + 0.7));
  d += 0.16 * (1 - smoothstep(0, 0.5, Math.abs(n)));
  return d;
}
function cerebellumD(x, y, z) {
  const d = sd.ellipsoid(x, y + 2.35, z + 4.3, 2.85, 1.38, 1.75);
  if (d > 0.5) return d;
  return d + 0.05 * Math.sin((y * 0.9 - z * 0.35) * 12) + 0.12 * Math.exp(-(x * x) / 0.08); // folia + vermis notch
}
function brainstemD(x, y, z) {
  return sd.smin(sd.capsule(x, y, z, 0, -0.8, -1.7, 0, -4.6, -2.6, 0.68), sd.ellipsoid(x, y + 2.5, z + 1.75, 0.95, 0.9, 0.85), 0.4);
}
function outerD(x, y, z) { return sd.smin(Math.min(cerebrumD(x, y, z), cerebellumD(x, y, z)), brainstemD(x, y, z), 0.45); }
function brainSDF(x, y, z) {
  const o = outerD(x, y, z);
  const shell = Math.max(o, -(o + SHELL_T));
  // walk-in tunnel (front → central chamber) and the chamber itself, in brain-relative coords
  const tunnel = sd.box(x, y + 2.9, z - 4.6, 1.15, 2.0, 3.7) - 0.4;
  const chamber = sd.sphere(x, y + 2.0, z - 0.9, 1.8);
  return Math.max(shell, -Math.min(tunnel, chamber));
}
function classify(x, y, z) {
  const dCr = cerebrumD(x, y, z), dCb = cerebellumD(x, y, z), dBs = brainstemD(x, y, z);
  if (dBs < dCr - 0.05 && dBs < dCb) return R.brainstem;
  if (dCb < dCr) return R.cerebellum;
  const zc = centralZ(y);
  if (temporalD(x, y, z) < hemiD(x, y, z) + 0.15 && y < -0.45) {
    if (x > 0 && z < -0.6 && z > -2.7 && y > -2.0) return R.wernicke;
    return R.temporal;
  }
  if (z > zc + 0.85) {
    if (x > 2.85 && y < 0.6 && y > -1.4 && z > zc + 1.0 && z < zc + 2.9) return R.broca;
    return R.frontal;
  }
  if (z > zc) return y > -0.9 ? R.motor : R.frontal;
  if (z > zc - 0.85 && y > -0.9) return R.somato;
  if (z > -3.4 - 0.15 * y) return R.parietal;
  if (z < -4.85 || (Math.abs(x) < 1.0 && z < -3.7)) return R.visual;
  return R.occipital;
}
function buildBrainData(res) {
  if (BRAIN_CACHE[res]) return BRAIN_CACHE[res];
  const min = [-5.0, 0.02 - BRAIN_C[1], -6.4], max = [5.0, 3.75, 6.1];
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
  const n = (a) => Math.max(8, Math.round((res * (max[a] - min[a])) / span));
  const m = march(brainSDF, { min, max }, [n(0), n(1), n(2)]);
  const V = m.positions.length / 3;
  const region = new Uint8Array(V), inner = new Uint8Array(V);
  for (let i = 0; i < V; i++) {
    const x = m.positions[i * 3], y = m.positions[i * 3 + 1], z = m.positions[i * 3 + 2];
    region[i] = classify(x, y, z);
    inner[i] = outerD(x, y, z) < -SHELL_T * 0.5 ? 1 : 0;
  }
  BRAIN_CACHE[res] = Object.assign(m, { region, inner });
  return BRAIN_CACHE[res];
}

function build(kit) {
  const H = makeHelpers(kit, ZONE);
  const { THREE, V3, box, cyl, paint, glow, glass, M, tag, sign, interact, light, lamp, root } = H;
  const S = H.shell({ h: 12, roof: 'glass', doorW: 5 });
  const C = (x, y, z) => new V3(x + BRAIN_C[0], y + BRAIN_C[1], z + BRAIN_C[2]);
  const anchor = (name, v) => { if (typeof kit.anchor === 'function') kit.anchor(name, v); };
  const state = { fn: 0, glowTarget: 0.18, glow: 0.18 };

  function toNeuroMode() {
    const c = H.services().controls;
    const mode = H.sim.state && H.sim.state.mode;
    if (c && typeof c.setMode === 'function' && mode !== 'neuro') c.setMode('neuro');
  }

  // ------------------------------------------------------------------ brain sculpture
  const data = buildBrainData(RES[H.tier] || RES.medium);
  const V = data.positions.length / 3;
  const pos = new Float32Array(V * 3), col = new Float32Array(V * 3), glowA = new Float32Array(V);
  const tmpC = new THREE.Color();
  for (let i = 0; i < V; i++) {
    pos[i * 3] = data.positions[i * 3] + BRAIN_C[0]; pos[i * 3 + 1] = data.positions[i * 3 + 1] + BRAIN_C[1]; pos[i * 3 + 2] = data.positions[i * 3 + 2] + BRAIN_C[2];
    tmpC.setHex(REGION_INFO[data.region[i]][1]);
    if (data.inner[i]) tmpC.lerp(new THREE.Color(0x3a2340), 0.55);
    col[i * 3] = tmpC.r; col[i * 3 + 1] = tmpC.g; col[i * 3 + 2] = tmpC.b;
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  bg.setAttribute('normal', new THREE.BufferAttribute(data.normals, 3));
  bg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  bg.setAttribute('glow', new THREE.BufferAttribute(glowA, 1));
  bg.setIndex(new THREE.BufferAttribute(data.indices, 1));
  bg.computeBoundingSphere();
  const uGlow = { value: 0.18 };
  const brainMat = H.own(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, emissive: 0x000000 }));
  brainMat.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = uGlow;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGlow;\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow * uGlow;');
  };
  brainMat.customProgramCacheKey = () => 'zehn-brain-glow';
  const brain = new THREE.Mesh(bg, brainMat);
  brain.castShadow = true; brain.receiveShadow = true; brain.name = 'neuro:brain';
  root.add(brain);

  // region centroids (outer surface; left/right separately) → label anchors and tract endpoints
  const cent = {};
  for (let i = 0; i < V; i++) {
    if (data.inner[i]) continue;
    const r = data.region[i], side = data.positions[i * 3] >= 0 ? 'L' : 'R';
    const k = r + side;
    const c = cent[k] || (cent[k] = { x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 0, n: 0 });
    c.x += data.positions[i * 3]; c.y += data.positions[i * 3 + 1]; c.z += data.positions[i * 3 + 2];
    c.nx += data.normals[i * 3]; c.ny += data.normals[i * 3 + 1]; c.nz += data.normals[i * 3 + 2]; c.n++;
  }
  const centroid = (r, side, fb) => {
    const c = cent[r + side];
    if (!c || !c.n) return { p: new V3(fb[0], fb[1], fb[2]), n: new V3(0, 1, 0) };
    return { p: new V3(c.x / c.n, c.y / c.n, c.z / c.n), n: new V3(c.nx, c.ny, c.nz).normalize() };
  };

  // ---- inner structures (separate meshes so they can glow on their own)
  const inner = {};
  function innerMat(r) { return H.own(new THREE.MeshStandardMaterial({ color: REGION_INFO[r][1], roughness: 0.4, emissive: REGION_INFO[r][1], emissiveIntensity: 0.15 })); }
  function tube(points, radius, matl, scaleX) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => C(p[0], p[1], p[2])));
    const g = H.own(new THREE.TubeGeometry(curve, 48, radius, 12, false));
    const mesh = new THREE.Mesh(g, matl);
    if (scaleX) { g.translate(-BRAIN_C[0], 0, 0); mesh.scale.x = scaleX; mesh.position.x = BRAIN_C[0]; }
    mesh.castShadow = true; root.add(mesh);
    return mesh;
  }
  inner[R.callosum] = innerMat(R.callosum);
  tube([[0, 0.7, 2.3], [0, 1.45, 1.1], [0, 1.65, -0.8], [0, 1.45, -2.4], [0, 0.85, -2.95]], 0.3, inner[R.callosum], 4.2);
  inner[R.thalamus] = innerMat(R.thalamus);
  inner[R.hippocampus] = innerMat(R.hippocampus);
  inner[R.amygdala] = innerMat(R.amygdala);
  const ellG = H.own(new THREE.SphereGeometry(1, 24, 16));
  for (const s of [1, -1]) {
    const th = new THREE.Mesh(ellG, inner[R.thalamus]); th.position.copy(C(0.62 * s, -0.1, -0.6)); th.scale.set(0.55, 0.48, 0.92); th.castShadow = true; root.add(th);
    const am = new THREE.Mesh(ellG, inner[R.amygdala]); am.position.copy(C(1.85 * s, -1.5, 1.4)); am.scale.set(0.4, 0.36, 0.46); root.add(am);
    tube([[1.88 * s, -1.4, 0.95], [1.95 * s, -1.25, -0.3], [1.7 * s, -0.85, -1.5], [1.2 * s, -0.2, -2.25]], 0.27, inner[R.hippocampus]);
  }

  // ---- plinth with the walk-in slot
  const shape = new THREE.Shape();
  const ex = 4.3, ez = 5.4, slot = 1.7, th0 = Math.acos(slot / ex);
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const th = th0 + (-Math.PI - 2 * th0) * (i / steps);
    const x = ex * Math.cos(th), z = ez * Math.sin(th);
    if (i === 0) shape.moveTo(x, -z); else shape.lineTo(x, -z);
  }
  shape.lineTo(-slot, 1.0); shape.lineTo(slot, 1.0); shape.closePath();
  const pg = new THREE.ExtrudeGeometry(shape, { depth: 1.0, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 6 });
  pg.rotateX(-Math.PI / 2);
  H.add(pg, paint(0x2a2440, { roughness: 0.55, metalness: 0.1 }), { x: BRAIN_C[0], y: 0, z: BRAIN_C[2] });
  // colliders: rasterised plinth footprint (keeps walkers in the slot, blocks the brain body up to 3 m)
  for (let x = -ex; x < ex; x += 0.9) for (let z = -ez; z < ez; z += 0.9) {
    const cx = x + 0.45, cz = z + 0.45;
    if ((cx * cx) / (ex * ex) + (cz * cz) / (ez * ez) > 1) continue;
    if (Math.abs(cx) < slot + 0.2 && cz > -1.0) continue;
    H.collide(BRAIN_C[0] + x, 0, BRAIN_C[2] + z, BRAIN_C[0] + x + 0.9, 3.0, BRAIN_C[2] + z + 0.9);
  }
  // glowing floor guide inside the slot
  box(0.08, 0.02, 4.6, -1.35, 0.02, BRAIN_C[2] + 3.4, glow(PAL.teal, 1.2), { shadow: false });
  box(0.08, 0.02, 4.6, 1.35, 0.02, BRAIN_C[2] + 3.4, glow(PAL.teal, 1.2), { shadow: false });

  // ---- labels + leader lines
  const labels = [];
  const lineP = [];
  function addLabel(r, at, off) {
    const p = at.clone().add(off);
    const s = tag(REGION_INFO[r][0], 0.34, { pos: [p.x, p.y, p.z], accent: '#' + REGION_INFO[r][1].toString(16).padStart(6, '0') });
    labels.push({ r, s });
    lineP.push(at.x, at.y, at.z, p.x, p.y - 0.15, p.z);
  }
  const surfLabel = (r, side, fb, dist) => {
    const c = centroid(r, side, fb);
    const at = c.p.clone().add(new V3(BRAIN_C[0], BRAIN_C[1], BRAIN_C[2]));
    addLabel(r, at, c.n.clone().multiplyScalar(dist || 1.3).add(new V3(0, 0.3, 0)));
  };
  surfLabel(R.frontal, 'L', [2.4, 1.5, 3.5]); surfLabel(R.motor, 'R', [-2.4, 2.4, -0.6], 1.2); surfLabel(R.somato, 'L', [2.4, 2.4, -1.4], 1.2);
  surfLabel(R.parietal, 'R', [-2.4, 2.0, -2.8]); surfLabel(R.temporal, 'R', [-4.0, -1.8, 0.4]); surfLabel(R.occipital, 'L', [2.2, 0.5, -4.6]);
  surfLabel(R.visual, 'R', [-0.8, 0.3, -5.6], 1.0); surfLabel(R.cerebellum, 'L', [1.6, -2.4, -5.2]); surfLabel(R.brainstem, 'R', [-0.6, -2.6, -2.3], 1.6);
  surfLabel(R.broca, 'L', [4.4, -0.3, 1.6], 1.4); surfLabel(R.wernicke, 'L', [4.3, -1.2, -1.6], 1.4);
  addLabel(R.callosum, C(0, 1.7, 0.2), new V3(0, 0.6, 0));
  addLabel(R.thalamus, C(0.62, -0.1, -0.6), new V3(0, -0.85, 0.6));
  addLabel(R.hippocampus, C(1.9, -1.2, -0.4), new V3(-0.6, -0.55, 0.4));
  addLabel(R.amygdala, C(-1.85, -1.5, 1.4), new V3(0.5, -0.45, 0.3));
  const leaderG = H.own(new THREE.BufferGeometry());
  leaderG.setAttribute('position', new THREE.Float32BufferAttribute(lineP, 3));
  root.add(new THREE.LineSegments(leaderG, H.own(new THREE.LineBasicMaterial({ color: 0xfcd34d, transparent: true, opacity: 0.55 }))));

  // ---- tracts + firing particles
  const P = (r, side, fb) => centroid(r, side, fb).p.clone().multiplyScalar(0.82);
  const thalL = new V3(0.62, -0.1, -0.6), thalR = new V3(-0.62, -0.1, -0.6), bsLow = new V3(0, -3.3, -2.3), bsMid = new V3(0, -1.6, -1.65);
  const tractDefs = [];
  for (const [s, side] of [[1, 'L'], [-1, 'R']]) {
    const thal = s > 0 ? thalL : thalR;
    tractDefs.push({ fns: ['movement'], color: 0xe07a5f, pts: [P(R.motor, side, [2.0 * s, 2.6, -0.6]), new V3(1.0 * s, 0.4, -0.7), new V3(0.4 * s, -1.4, -1.6), bsLow] });
    tractDefs.push({ fns: ['touch'], color: 0xf2cc8f, pts: [bsLow, bsMid, thal, P(R.somato, side, [2.0 * s, 2.5, -1.4])] });
    tractDefs.push({ fns: ['vision'], color: 0xb794f4, pts: [thal, new V3(1.5 * s, -0.4, -2.6), new V3(1.1 * s, -0.1, -4.2), P(R.visual, side, [0.8 * s, 0.2, -5.4])] });
    tractDefs.push({ fns: ['memory formation'], color: 0x7dd3fc, pts: [new V3(1.88 * s, -1.4, 0.95), new V3(1.7 * s, -0.85, -1.5), new V3(0.7 * s, 0.6, -1.6), new V3(0.3 * s, 0.75, -0.3), new V3(0.25 * s, -0.1, 0.6)] });
    tractDefs.push({ fns: ['fear'], color: 0xf43f5e, pts: [new V3(1.85 * s, -1.5, 1.4), new V3(1.1 * s, -0.9, 0.6), thal] });
    tractDefs.push({ fns: ['fear'], color: 0xf43f5e, pts: [new V3(1.85 * s, -1.5, 1.4), new V3(1.4 * s, -0.9, 2.4), new V3(1.5 * s, -0.6, 3.9)] });
    tractDefs.push({ fns: ['balance', 'movement'], color: 0xd9a441, pts: [new V3(1.6 * s, -2.3, -4.1), new V3(0.6 * s, -2.2, -2.5), bsMid, thal] });
    tractDefs.push({ fns: ['balance'], color: 0x9c8c7a, pts: [new V3(0, -3.0, -2.1), new V3(0.8 * s, -2.6, -3.2), new V3(1.8 * s, -2.1, -4.3)] });
  }
  tractDefs.push({ fns: ['language production'], color: 0xf59e0b, pts: [P(R.broca, 'L', [3.6, -0.3, 1.4]), new V3(3.3, 0.9, -0.6), new V3(3.2, 0.2, -2.0), P(R.wernicke, 'L', [3.6, -1.2, -1.6])] });
  for (const z of [1.4, -0.6, -2.2]) tractDefs.push({ fns: ['language production', 'touch', 'vision', 'movement'], color: 0xf8fafc, pts: [new V3(2.6, 1.7, z), new V3(0, 1.75 + 0.1 * z, z), new V3(-2.6, 1.7, z)] });
  const LUT = 48;
  const tracts = tractDefs.map((t) => {
    const curve = new THREE.CatmullRomCurve3(t.pts.map((p) => p.clone().add(new V3(BRAIN_C[0], BRAIN_C[1], BRAIN_C[2]))));
    const pts = curve.getSpacedPoints(LUT);
    return { fns: t.fns, color: new THREE.Color(t.color), lut: pts };
  });
  const tractLines = [];
  for (const tr of tracts) for (let i = 0; i < LUT; i++) tractLines.push(tr.lut[i].x, tr.lut[i].y, tr.lut[i].z, tr.lut[i + 1].x, tr.lut[i + 1].y, tr.lut[i + 1].z);
  const tlG = H.own(new THREE.BufferGeometry());
  tlG.setAttribute('position', new THREE.Float32BufferAttribute(tractLines, 3));
  const tlM = H.own(new THREE.LineBasicMaterial({ color: 0x9ad8ff, transparent: true, opacity: 0.18, depthWrite: false }));
  root.add(new THREE.LineSegments(tlG, tlM));

  const NP = [260, 520, 900, 1400][H.T];
  const ppos = new Float32Array(NP * 3), pcol = new Float32Array(NP * 3);
  const parts = [];
  for (let i = 0; i < NP; i++) parts.push({ tr: i % tracts.length, u: H.rnd(), sp: H.rr(0.18, 0.4), jit: H.rr(-0.06, 0.06) });
  const pG = H.own(new THREE.BufferGeometry());
  pG.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  pG.setAttribute('color', new THREE.BufferAttribute(pcol, 3));
  pG.boundingSphere = new THREE.Sphere(C(0, 0, 0), 9);
  const dot = H.canvas(64, 64);
  const grd = dot.g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,255,255,0.6)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  dot.g.fillStyle = grd; dot.g.fillRect(0, 0, 64, 64); dot.tex.needsUpdate = true;
  const pM = H.own(new THREE.PointsMaterial({ size: 0.2, map: dot.tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  const points = new THREE.Points(pG, pM);
  points.frustumCulled = false;
  root.add(points);

  // ---- function selector console
  const conX = 5.2, conZ = 5.2;
  box(1.6, 1.0, 0.7, conX, 0.5, conZ, paint(0x2a2440, { roughness: 0.5 }), { collide: true });
  box(1.62, 0.05, 0.72, conX, 1.02, conZ, paint(PAL.saffron, { roughness: 0.4 }), { shadow: false });
  const scr = H.canvas(768, 480);
  const scrM = H.own(new THREE.MeshStandardMaterial({ map: scr.tex, emissive: 0xffffff, emissiveMap: scr.tex, emissiveIntensity: 0.9, roughness: 0.3 }));
  const scrMesh = new THREE.Mesh(H.own(new THREE.PlaneGeometry(1.5, 0.94)), scrM);
  scrMesh.position.set(conX, 1.62, conZ - 0.12); scrMesh.rotation.x = -0.32;
  root.add(scrMesh);
  box(0.12, 0.6, 0.12, conX, 1.25, conZ - 0.2, M.metal());
  function drawConsole() {
    const g = scr.g, W = scr.w, Hh = scr.h, f = FUNCS[state.fn];
    g.fillStyle = '#14123a'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = CSS.crimson; g.fillRect(0, 0, W, 14);
    g.fillStyle = '#FCD34D'; g.font = `600 30px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'top';
    g.fillText('BRAIN FUNCTION SELECTOR · simulated exhibit', 28, 32);
    g.fillStyle = CSS.chalk; g.font = `700 58px ${FONT}`; g.fillText(f.name, 28, 82);
    g.font = `400 27px ${FONT}`; g.fillStyle = '#CBD5E1';
    let y = 164;
    for (const ln of H.wrap(g, f.note, W - 56)) { g.fillText(ln, 28, y); y += 34; }
    y += 10;
    const regs = f.regions || REGION_INFO.map((_, i) => i);
    let x = 28;
    g.font = `600 22px ${FONT}`;
    for (const r of regs) {
      const label = REGION_INFO[r][0], w = g.measureText(label).width + 44;
      if (x + w > W - 20) { x = 28; y += 40; }
      g.fillStyle = '#' + REGION_INFO[r][1].toString(16).padStart(6, '0'); g.fillRect(x, y + 6, 18, 18);
      g.fillStyle = CSS.chalk; g.fillText(label, x + 26, y + 3); x += w;
    }
    g.fillStyle = '#94A3B8'; g.font = `400 22px ${FONT}`; g.fillText(`Press E to cycle (${state.fn + 1}/${FUNCS.length}) · simplified teaching model`, 28, Hh - 40);
    scr.tex.needsUpdate = true;
  }
  function applyFunction() {
    const f = FUNCS[state.fn];
    const set = f.regions ? new Set(f.regions) : null;
    for (let i = 0; i < V; i++) glowA[i] = set ? (set.has(data.region[i]) ? (data.inner[i] ? 0.6 : 1) : 0) : 1;
    bg.attributes.glow.needsUpdate = true;
    for (const r of [R.callosum, R.thalamus, R.hippocampus, R.amygdala]) inner[r].emissiveIntensity = !set ? 0.25 : set.has(r) ? 1.6 : 0.05;
    for (const L of labels) L.s.material.opacity = !set || set.has(L.r) ? 1 : 0.3;
    for (const tr of tracts) tr.active = !set || tr.fns.includes(f.id);
    state.glowTarget = set ? 1 : 0.18;
    drawConsole();
  }
  applyFunction();
  interact('selector', [conX, 1.2, conZ + 0.4], 2.2, 'Brain function selector — cycle functions', () => {
    state.fn = (state.fn + 1) % FUNCS.length;
    applyFunction();
    H.emit('glossary:lookup', { term: (FUNCS[state.fn].regions ? REGION_INFO[FUNCS[state.fn].regions[0]][0] : 'Cerebral cortex') });
    toNeuroMode();
  });
  interact('brain', [0, 1.2, BRAIN_C[2] + 6.6], 2.4, 'Walk-through brain — open Brain & Cases', () => { H.openPanel('brain'); toNeuroMode(); });
  sign([{ t: 'Walk-through Brain', size: 0.2, weight: 700 }, { t: 'A 12 m sculpted model. Enter the slot to stand beneath the thalamus and corpus callosum. Colours mark textbook regions; functions are simplified.', size: 0.085, weight: 400, color: '#CBD5E1' }],
    2.4, 1.3, { pos: [-4.6, 1.5, 4.6], ry: 0.35, px: 220 });
  box(0.1, 1.4, 0.1, -4.6, 0.7, 4.55, M.metal());

  // ------------------------------------------------------------------ neuron bridge (left wing)
  const NX = -12, deckY = 1.05, dz0 = -9.5, dz1 = 7.0, axY = 0.5;
  const deckGlass = glass(0xbfe9ff, 0.22);
  box(2.2, 0.06, dz1 - dz0, NX, deckY - 0.03, (dz0 + dz1) / 2, deckGlass, { shadow: false });
  H.collide(NX - 1.1, 0, dz0, NX + 1.1, deckY, dz1);
  const steel = paint(0x2b2f3a, { roughness: 0.4, metalness: 0.8 });
  for (const sx of [-1, 1]) box(0.12, 0.18, dz1 - dz0, NX + sx * 1.08, deckY - 0.08, (dz0 + dz1) / 2, steel);
  for (let z = dz0 + 0.4; z <= dz1; z += 3.2) for (const sx of [-1, 1]) box(0.1, deckY - 0.1, 0.1, NX + sx * 1.05, (deckY - 0.1) / 2, z, steel);
  // stairs on +X side at both ends
  for (const zc of [dz1 - 1.0, dz0 + 1.0]) {
    for (let s = 1; s <= 6; s++) {
      const h = 0.15 * s, x0 = NX + 1.1 + (6 - s) * 0.35;
      box(0.35, h, 2.0, x0 + 0.175, h / 2, zc, H.M.stone(), { collide: true });
    }
  }
  // railings: full on −X, +X except the stair openings
  const railM = glass(0xd6f1ff, 0.18);
  const rail = (x, za, zb) => {
    box(0.04, 0.9, zb - za, x, deckY + 0.45, (za + zb) / 2, railM, { shadow: false });
    box(0.07, 0.06, zb - za, x, deckY + 0.93, (za + zb) / 2, steel);
    H.collide(x - 0.06, deckY, za, x + 0.06, deckY + 1.0, zb);
  };
  rail(NX - 1.1, dz0, dz1); rail(NX + 1.1, dz0 + 2.0, dz1 - 2.0);
  for (const z of [dz0, dz1]) { box(2.2, 0.06, 0.07, NX, deckY + 0.93, z, steel); H.collide(NX - 1.1, deckY, z - 0.06, NX + 1.1, deckY + 1.0, z + 0.06); }

  // soma + dendrites
  const somaC = new V3(NX, 1.95, 10.7);
  const somaG = H.own(new THREE.IcosahedronGeometry(1.5, H.T >= 2 ? 5 : 3));
  { const p = somaG.attributes.position; const v = new V3();
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.06 * Math.sin(v.x * 3.1 + 1) * Math.sin(v.y * 2.7) * Math.sin(v.z * 3.3 + 2); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y, v.z); }
    somaG.computeVertexNormals(); }
  const somaM = H.own(new THREE.MeshStandardMaterial({ color: 0xb05a9a, roughness: 0.45, emissive: 0xff5fb8, emissiveIntensity: 0.12 }));
  const soma = new THREE.Mesh(somaG, somaM); soma.position.copy(somaC); soma.castShadow = true; root.add(soma);
  H.collide(NX - 1.5, 0, 9.2, NX + 1.5, 3.4, 12.2);
  const dendM = paint(0xa04f8c, { roughness: 0.55 });
  const dendG = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3, el = H.rr(-0.4, 0.9);
    const dir = new V3(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el) * 0.8 + 0.35).normalize();
    if (dir.z < -0.3) dir.z = Math.abs(dir.z);
    const p0 = somaC.clone().addScaledVector(dir, 1.35), p1 = somaC.clone().addScaledVector(dir, 2.6).add(new V3(H.rr(-0.4, 0.4), H.rr(0, 0.5), H.rr(-0.4, 0.4)));
    const p2 = somaC.clone().addScaledVector(dir, 3.5).add(new V3(H.rr(-0.6, 0.6), H.rr(0, 0.8), H.rr(-0.3, 0.6)));
    p1.y = Math.max(p1.y, 0.4); p2.y = Math.max(p2.y, 0.3);
    dendG.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), 16, 0.16, 8, false));
    for (let b = 0; b < 2; b++) {
      const q = p2.clone().add(new V3(H.rr(-1.2, 1.2), H.rr(-0.3, 1.0), H.rr(-0.2, 1.2))); q.y = Math.max(q.y, 0.25);
      dendG.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([p1.clone().lerp(p2, 0.6), q]), 8, 0.08, 6, false));
    }
  }
  for (const g of dendG) H.add(g, dendM);
  // hillock + axon + myelin + nodes
  const hill = new THREE.CylinderGeometry(0.3, 0.75, 1.0, 20); hill.rotateX(-Math.PI / 2);
  H.add(hill, paint(0xc06aa6, { roughness: 0.45 }), { x: NX, y: 1.2, z: 9.0 });
  const axon0 = 8.6, axon1 = -10.9;
  const axonCurve = new THREE.CatmullRomCurve3([new V3(NX, 1.2, 8.55), new V3(NX, 0.7, 8.0), new V3(NX, axY, 7.0), new V3(NX, axY, axon1)]);
  H.add(new THREE.TubeGeometry(axonCurve, 64, 0.27, 12, false), paint(0xd88fb0, { roughness: 0.4, emissive: 0x7a2a5a, emissiveIntensity: 0.2 }));
  const nSeg = 8, segLen = (7.0 - axon1) / nSeg, sheathL = segLen - 0.45;
  const myG = H.own(new THREE.CapsuleGeometry(0.43, sheathL - 0.86, 6, 18)); myG.rotateX(Math.PI / 2);
  const myelin = new THREE.InstancedMesh(myG, paint(0xf1e6cf, { roughness: 0.5 }), nSeg);
  const nodeG = H.own(new THREE.CylinderGeometry(0.33, 0.33, 0.3, 20)); nodeG.rotateX(Math.PI / 2);
  const nodeM = H.own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const nodes = new THREE.InstancedMesh(nodeG, nodeM, nSeg + 1);
  const nodeZ = [];
  const mm = new THREE.Matrix4();
  for (let i = 0; i < nSeg; i++) { mm.makeTranslation(NX, axY, 7.0 - segLen * (i + 0.5)); myelin.setMatrixAt(i, mm); }
  for (let i = 0; i <= nSeg; i++) { const z = 7.0 - segLen * i; nodeZ.push(z); mm.makeTranslation(NX, axY, z); nodes.setMatrixAt(i, mm); nodes.setColorAt(i, new THREE.Color(0.08, 0.45, 0.5)); }
  myelin.castShadow = true; root.add(myelin, nodes);
  // terminals
  const termM = H.own(new THREE.MeshStandardMaterial({ color: 0xd88fb0, roughness: 0.4, emissive: 0xffb347, emissiveIntensity: 0.1 }));
  for (const [dx, dy] of [[-0.6, 0.35], [0, 0.6], [0.6, 0.25]]) {
    const end = new V3(NX + dx * 1.6, axY + dy, -11.75);
    H.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new V3(NX, axY, axon1 + 0.1), new V3(NX + dx * 0.8, axY + dy * 0.5, -11.3), end]), 12, 0.12, 8, false), paint(0xd88fb0, { roughness: 0.4 }));
    const b = new THREE.Mesh(ellG, termM); b.position.copy(end); b.scale.setScalar(0.24); root.add(b);
  }
  const spikeG = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.55, 16, 12)), H.own(new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })));
  root.add(spikeG);
  tag('Soma (cell body)', 0.32, { pos: [NX, 4.0, 10.7] });
  tag('Dendrites', 0.3, { pos: [NX + 2.6, 3.7, 12.6] });
  tag('Axon hillock', 0.28, { pos: [NX + 1.3, 2.3, 8.7] });
  tag('Myelin sheath', 0.28, { pos: [NX - 1.9, 1.3, 2.0] });
  tag('Node of Ranvier', 0.28, { pos: [NX - 1.9, 1.3, nodeZ[4]] });
  tag('Axon terminals', 0.28, { pos: [NX + 1.6, 1.8, -11.3] });
  tag('Neuron Bridge — walk the axon', 0.36, { pos: [NX, 2.9, 6.0] });
  const spike = { t0: -99, auto: 6 };
  interact('neuron', [NX + 1.6, 1.0, 7.4], 2.4, 'Neuron bridge — fire an action potential', () => {
    spike.t0 = state.time; H.emit('neuron:spike', { model: 'bridge' }); H.openPanel('bio'); toNeuroMode();
  });

  // ------------------------------------------------------------------ synapse chamber (back-left)
  const sx0 = -17.6, sx1 = -7.6, sz0 = -16.8, sz1 = -12.3;
  const cg = glass(0xa7f3d0, 0.14);
  H.wall('x', sz1, sx0, sx1, 4.2, 0.08, steel, [{ c: (sx0 - 9.4) / 2 + 0.0, w: (-9.4 - sx0) - 0.2, sill: 0.08, top: 3.9, glassMat: cg }, { c: -8.5, w: 1.6, top: 2.6 }]);
  H.wall('z', sx1, sz0, sz1, 4.2, 0.08, steel, [{ c: (sz0 + sz1) / 2, w: (sz1 - sz0) - 0.3, sill: 0.08, top: 3.9, glassMat: cg }]);
  box(sx1 - sx0, 0.12, sz1 - sz0, (sx0 + sx1) / 2, 4.26, (sz0 + sz1) / 2, paint(0x1b2a2e, { roughness: 0.6 }));
  box(sx1 - sx0 - 0.3, 0.02, sz1 - sz0 - 0.3, (sx0 + sx1) / 2, 0.02, (sz0 + sz1) / 2, paint(0x0f2e2b, { roughness: 0.3 }), { shadow: false });
  const synC = new V3(-13.4, 0, -14.6);
  const boutonM = H.own(new THREE.MeshStandardMaterial({ color: 0xe9a8c9, roughness: 0.35, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide, emissive: 0x6d2050, emissiveIntensity: 0.25 }));
  const bouton = new THREE.Mesh(H.own(new THREE.SphereGeometry(1.35, 40, 24)), boutonM);
  bouton.position.set(synC.x, 3.2, synC.z); bouton.scale.y = 0.95; root.add(bouton);
  H.add(new THREE.CylinderGeometry(0.35, 0.5, 1.2, 16), paint(0xd88fb0, { roughness: 0.4 }), { x: synC.x, y: 4.4, z: synC.z });
  const mito = new THREE.Mesh(H.own(new THREE.CapsuleGeometry(0.16, 0.6, 4, 10)), paint(0xf97316, { roughness: 0.5, emissive: 0x7c2d12, emissiveIntensity: 0.3 }));
  mito.position.set(synC.x + 0.5, 3.6, synC.z - 0.2); mito.rotation.z = 1.1; root.add(mito);
  const postM = paint(0x8b5cf6, { roughness: 0.45, emissive: 0x2e1065, emissiveIntensity: 0.3 });
  H.add(new THREE.SphereGeometry(1, 40, 20), postM, { x: synC.x, y: 0.62, z: synC.z, sx: 1.7, sy: 0.68, sz: 1.7 });
  H.collide(synC.x - 1.6, 0, synC.z - 1.6, synC.x + 1.6, 1.25, synC.z + 1.6);
  const NR = 26;
  const recG = H.own(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 8));
  const recM = H.own(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const receptors = new THREE.InstancedMesh(recG, recM, NR);
  const recPos = [];
  for (let i = 0; i < NR; i++) {
    const a = i * 2.39996, r = 0.25 + 1.0 * Math.sqrt((i + 0.5) / NR);
    const x = synC.x + Math.cos(a) * r, z = synC.z + Math.sin(a) * r;
    const yy = 0.62 + 0.68 * Math.sqrt(Math.max(0, 1 - (r / 1.7) ** 2)) + 0.06;
    recPos.push(new V3(x, yy, z)); mm.makeTranslation(x, yy, z); receptors.setMatrixAt(i, mm); receptors.setColorAt(i, new THREE.Color(0.2, 0.75, 0.6));
  }
  root.add(receptors);
  const recGlow = new Float32Array(NR);
  const NV = 34;
  const vesG = H.own(new THREE.SphereGeometry(0.13, 12, 8));
  const vesicles = new THREE.InstancedMesh(vesG, paint(0xfde68a, { roughness: 0.3, emissive: 0xf59e0b, emissiveIntensity: 0.35 }), NV);
  const ves = [];
  for (let i = 0; i < NV; i++) {
    const v = new V3(H.rr(-0.8, 0.8), H.rr(-0.5, 0.7), H.rr(-0.8, 0.8)); if (v.length() > 0.95) v.setLength(0.95);
    ves.push({ home: v.clone(), p: v.clone().add(new V3(synC.x, 3.2, synC.z)), state: 0, t: 0, ph: H.rr(0, 6) });
  }
  root.add(vesicles);
  const NT = [120, 200, 300, 400][H.T];
  const ntPos = new Float32Array(NT * 3), ntCol = new Float32Array(NT * 3);
  const nts = [];
  for (let i = 0; i < NT; i++) { nts.push({ live: false, p: new V3(), v: new V3(), age: 0, rec: -1 }); ntPos[i * 3 + 1] = -50; }
  const ntG = H.own(new THREE.BufferGeometry());
  ntG.setAttribute('position', new THREE.BufferAttribute(ntPos, 3));
  ntG.setAttribute('color', new THREE.BufferAttribute(ntCol, 3));
  const ntPts = new THREE.Points(ntG, H.own(new THREE.PointsMaterial({ size: 0.11, map: dot.tex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  ntPts.frustumCulled = false; root.add(ntPts);
  tag('Presynaptic terminal', 0.26, { pos: [synC.x - 1.9, 3.9, synC.z + 1.2] });
  tag('Synaptic vesicles', 0.24, { pos: [synC.x + 1.7, 3.4, synC.z + 1.3] });
  tag('Synaptic cleft', 0.26, { pos: [synC.x + 2.2, 1.6, synC.z + 1.5] });
  tag('Receptors (postsynaptic)', 0.24, { pos: [synC.x - 2.0, 1.2, synC.z + 1.6] });
  tag('Synapse Chamber', 0.34, { pos: [-12.6, 4.7, sz1 + 0.3] });
  const syn = { next: 1.5, burst: 0 };
  function release(n) {
    let k = 0;
    for (const v of ves) { if (k >= n) break; if (v.state === 0) { v.state = 1; v.t = 0; k++; } }
  }
  interact('synapse', [-9.6, 1.0, -13.4], 2.4, 'Synapse chamber — release neurotransmitter', () => { release(6); H.openPanel('bio'); toNeuroMode(); });

  // ------------------------------------------------------------------ split-brain demo table (right wing)
  const SX = 11.5, SZ = -3.5;
  box(2.8, 0.06, 1.2, SX, 0.76, SZ, M.wood(), { collide: true });
  for (const dx of [-1.3, 1.3]) for (const dz of [-0.5, 0.5]) box(0.06, 0.73, 0.06, SX + dx, 0.37, SZ + dz, steel);
  box(0.04, 0.55, 1.1, SX, 1.07, SZ, paint(0x1e1b4b, { roughness: 0.7 }));
  box(2.8, 0.5, 0.05, SX, 1.0, SZ - 0.62, paint(0x3b1d2e, { roughness: 1 }));
  box(0.18, 0.12, 0.18, SX, 0.85, SZ + 0.35, paint(0x111111, { roughness: 0.5 }));
  cyl(0.02, 0.02, 0.3, SX, 1.0, SZ + 0.35, steel, { seg: 8 });
  const split = H.canvas(1024, 384);
  const splitM = H.own(new THREE.MeshStandardMaterial({ map: split.tex, emissive: 0xffffff, emissiveMap: split.tex, emissiveIntensity: 0.85, roughness: 0.3 }));
  const splitMesh = new THREE.Mesh(H.own(new THREE.PlaneGeometry(2.7, 1.0)), splitM);
  splitMesh.position.set(SX, 1.75, SZ - 0.55); root.add(splitMesh);
  box(2.86, 1.08, 0.06, SX, 1.75, SZ - 0.6, paint(0x111827, { roughness: 0.4 }));
  box(0.08, 0.95, 0.08, SX, 0.95 + 0.27, SZ - 0.64, steel);
  const caption = H.canvas(1024, 256);
  const capMesh = new THREE.Mesh(H.own(new THREE.PlaneGeometry(2.4, 0.6)), H.own(new THREE.MeshStandardMaterial({ map: caption.tex, emissive: 0xffffff, emissiveMap: caption.tex, emissiveIntensity: 0.6 })));
  capMesh.position.set(SX + 3.2, 1.6, SZ - 0.8); capMesh.rotation.y = -0.5; root.add(capMesh);
  box(0.08, 1.3, 0.08, SX + 3.2, 0.65, SZ - 0.85, steel);
  const TRIALS = [['cup', 'key'], ['apple', 'pen'], ['ball', 'book'], ['spoon', 'comb']];
  const splitState = { i: 0 };
  function drawSplit() {
    const [lw, rw] = TRIALS[splitState.i];
    const g = split.g, W = split.w, Hh = split.h;
    g.fillStyle = '#0b1020'; g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#1e293b'; g.fillRect(W / 2 - 2, 0, 4, Hh);
    g.fillStyle = CSS.chalk; g.font = `700 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', W / 2, Hh / 2);
    g.font = `700 72px ${FONT}`; g.fillStyle = '#C4B5FD'; g.fillText(lw.toUpperCase(), W * 0.25, Hh / 2);
    g.fillStyle = '#7DD3FC'; g.fillText(rw.toUpperCase(), W * 0.75, Hh / 2);
    g.font = `500 22px ${FONT}`; g.fillStyle = '#94A3B8';
    g.fillText('LEFT visual field → RIGHT hemisphere', W * 0.25, 34); g.fillText('RIGHT visual field → LEFT hemisphere', W * 0.75, 34);
    g.fillText('Split-brain demonstration · simulated participant', W / 2, Hh - 26);
    split.tex.needsUpdate = true;
    const c = caption.g, CW = caption.w, CH = caption.h;
    c.fillStyle = 'rgba(30,27,75,0.95)'; c.fillRect(0, 0, CW, CH); c.fillStyle = CSS.saffron; c.fillRect(0, 0, 12, CH);
    c.textAlign = 'left'; c.textBaseline = 'top'; c.fillStyle = CSS.chalk; c.font = `700 32px ${FONT}`;
    c.fillText(`Says: “${rw}”  (left hemisphere can name it)`, 34, 26);
    c.fillText(`Left hand picks the ${lw} by touch`, 34, 80);
    c.fillStyle = '#CBD5E1'; c.font = `400 24px ${FONT}`;
    c.fillText('…but cannot say what was seen on the left. Corpus callosum cut = no transfer.', 34, 140);
    c.fillText('Teaching illustration; simulated, not a real patient.', 34, 186);
    caption.tex.needsUpdate = true;
  }
  drawSplit();
  const participant = H.person({ lookIndex: 4, height: 1.66, name: 'Simulated participant', outfit: 'kameez' }, 'sit');
  participant.group.position.set(SX, 0, SZ + 1.05); participant.group.rotation.y = Math.PI;
  box(0.55, 0.06, 0.55, SX, 0.46, SZ + 1.05, M.wood(), { collide: true });
  box(0.55, 0.6, 0.06, SX, 0.78, SZ + 1.32, M.wood());
  for (const dx of [-0.24, 0.24]) for (const dz of [-0.24, 0.24]) box(0.04, 0.44, 0.04, SX + dx, 0.22, SZ + 1.05 + dz, steel);
  tag('Split-brain table', 0.34, { pos: [SX, 2.65, SZ - 0.6] });
  interact('splitbrain', [SX + 1.6, 1.0, SZ + 0.9], 2.2, 'Split-brain demo — next trial / open Brain & Cases', () => {
    splitState.i = (splitState.i + 1) % TRIALS.length; drawSplit(); H.openPanel('brain'); toNeuroMode();
  });

  // ------------------------------------------------------------------ dressing: benches, planters, posters, lights
  for (const [x, z, ry] of [[6.5, 10.5, 0], [-6.5, 10.5, 0], [14.5, 8, Math.PI / 2], [14.5, -10, Math.PI / 2]]) {
    box(2.2, 0.08, 0.6, x, 0.45, z, M.wood(), { ry, collide: true });
    box(2.0, 0.42, 0.5, x, 0.21, z, paint(0x2a2440), { ry });
  }
  const leaf = paint(0x2f7d4f, { roughness: 0.8 }), pot = paint(PAL.crimson, { roughness: 0.6 });
  for (const [x, z] of [[16.5, 15.5], [-16.5, 15.5], [16.5, -15.5], [3.5, 15.5], [-3.5, 15.5]]) {
    cyl(0.45, 0.38, 0.7, x, 0.35, z, pot, { collide: true });
    H.sphere(0.6, x, 1.15, z, leaf, { sy: 1.2, seg: 10 });
  }
  sign([{ t: 'NEURO ATRIUM', size: 0.16, weight: 800, color: '#FCD34D' }, { t: 'Simulated teaching exhibit', size: 0.085, color: '#CBD5E1', weight: 500 },
    { t: '• Walk-through brain   • Neuron bridge   • Synapse chamber   • Split-brain table', size: 0.075, weight: 500, align: 'left' },
    { t: 'Press 6 for Neuro mode (fly inside the brain). Regions & functions are simplified for teaching.', size: 0.07, weight: 400, align: 'left', color: '#CBD5E1' }],
    4.6, 1.9, { pos: [S.hw - 0.25, 2.3, 8], ry: -Math.PI / 2, px: 200 });
  sign([{ t: 'Neural firing (simulated)', size: 0.13, weight: 700 }, { t: 'Glowing particles travel along simplified pathways: motor (corticospinal), touch, visual radiation, fornix, arcuate, callosal and cerebellar routes.', size: 0.08, weight: 400, color: '#CBD5E1' }],
    3.4, 1.5, { pos: [S.hw - 0.25, 2.3, -10], ry: -Math.PI / 2, px: 200 });
  for (const [x, z] of [[-12, 0], [12, 0], [0, 12], [12, -12], [-3, -14]]) lamp(x, S.H - 0.2, z, 2.4, 0.4);
  light(0xff8ad1, 30, 9, BRAIN_C[0], BRAIN_C[1] + 0.6, BRAIN_C[2] + 0.8, true);
  light(0xffd9a0, 40, 16, -12, 5.5, 0);

  anchor('brain', C(0, 0, 0)); anchor('selector', new V3(conX, 1.6, conZ)); anchor('neuron', new V3(NX, 1.5, 0));
  anchor('synapse', synC.clone().setY(2.0)); anchor('splitbrain', new V3(SX, 1.4, SZ));

  H.flush();
  H.buildHotspots();

  // ------------------------------------------------------------------ animation
  const col3 = new THREE.Color();
  const vesMat = new THREE.Matrix4(), vesQ = new THREE.Quaternion(), vesS = new V3(1, 1, 1);
  state.time = 0;
  let accCanvas = 0;
  function update(dt, t) {
    dt = Math.min(dt || 0, 0.1);
    state.time = t;
    const rm = H.reduced();
    const far = H.camDist() > 75;
    H.updateHotspots(t);
    // glow pulse
    state.glow += (state.glowTarget - state.glow) * Math.min(1, dt * 3);
    uGlow.value = state.glow * (rm || state.glowTarget < 0.5 ? 1 : 0.8 + 0.25 * Math.sin(t * 3));
    if (far) return;
    // tract particles
    const speedK = rm ? 0.25 : 1;
    for (let i = 0; i < NP; i++) {
      const p = parts[i], tr = tracts[p.tr];
      p.u += dt * p.sp * speedK * (tr.active ? 1.6 : 0.6) * (24 / LUT) * 2;
      if (p.u >= 1) p.u -= 1;
      const f = p.u * LUT, k = Math.floor(f), a = f - k, A = tr.lut[k], B = tr.lut[Math.min(LUT, k + 1)];
      ppos[i * 3] = A.x + (B.x - A.x) * a + p.jit; ppos[i * 3 + 1] = A.y + (B.y - A.y) * a + p.jit; ppos[i * 3 + 2] = A.z + (B.z - A.z) * a - p.jit;
      const b = tr.active ? 2.2 : 0.35;
      pcol[i * 3] = tr.color.r * b; pcol[i * 3 + 1] = tr.color.g * b; pcol[i * 3 + 2] = tr.color.b * b;
    }
    pG.attributes.position.needsUpdate = true; pG.attributes.color.needsUpdate = true;
    // action potential: soma flash → saltatory node-to-node glow → terminals → synapse release
    if (t - spike.t0 > 9 && t - spike.auto > 9) { spike.auto = t; spike.t0 = t; }
    const st = t - spike.t0, hop = rm ? 0.45 : 0.22;
    somaM.emissiveIntensity = 0.12 + 1.4 * Math.exp(-Math.max(0, st) * 3) * (st >= 0 ? 1 : 0);
    let hot = -1;
    for (let i = 0; i <= nSeg; i++) {
      const dtI = st - 0.3 - i * hop;
      const e = dtI >= 0 ? Math.exp(-dtI * 3.5) : 0;
      if (dtI >= 0 && dtI < hop) hot = i;
      col3.setRGB(0.08 + 3.2 * e, 0.45 + 2.4 * e, 0.5 + 0.6 * e);
      nodes.setColorAt(i, col3);
    }
    nodes.instanceColor.needsUpdate = true;
    if (hot >= 0) { spikeG.position.set(NX, axY, nodeZ[hot]); spikeG.material.opacity = 0.55; } else spikeG.material.opacity = Math.max(0, spikeG.material.opacity - dt * 2);
    const tEnd = 0.3 + (nSeg + 1) * hop;
    termM.emissiveIntensity = 0.1 + 2.0 * (st > tEnd && st < tEnd + 1.5 ? Math.exp(-(st - tEnd) * 2.5) : 0);
    if (st > tEnd && !spike.released) { spike.released = true; release(4); }
    if (st < tEnd) spike.released = false;
    // synapse chamber
    syn.next -= dt;
    if (syn.next <= 0) { syn.next = rm ? 5 : 2.8; release(2); }
    for (let i = 0; i < NV; i++) {
      const v = ves[i];
      if (v.state === 0) {
        const w = rm ? 0 : 0.05;
        v.p.set(synC.x + v.home.x + Math.sin(t * 0.7 + v.ph) * w, 3.2 + v.home.y + Math.cos(t * 0.9 + v.ph) * w, synC.z + v.home.z);
        vesS.setScalar(1);
      } else if (v.state === 1) { // dock
        v.t += dt;
        const target = new V3(synC.x + v.home.x * 0.5, 2.0, synC.z + v.home.z * 0.5);
        v.p.lerp(target, Math.min(1, dt * 2.2));
        vesS.setScalar(1);
        if (v.p.distanceTo(target) < 0.05 || v.t > 2) { v.state = 2; v.t = 0; }
      } else { // fuse + emit
        v.t += dt;
        vesS.setScalar(Math.max(0.01, 1 - v.t * 2));
        if (v.t < dt * 1.5) {
          let n = 0;
          for (const q of nts) { if (n >= 14) break; if (!q.live) { q.live = true; q.age = 0; q.rec = -1; q.p.copy(v.p); q.v.set(H.rr(-0.25, 0.25), H.rr(-0.45, -0.2), H.rr(-0.25, 0.25)); n++; } }
        }
        if (v.t > 1.6) { v.state = 0; v.t = 0; }
      }
      vesMat.compose(v.p, vesQ, vesS); vesicles.setMatrixAt(i, vesMat);
    }
    vesicles.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < NT; i++) {
      const q = nts[i];
      if (q.live) {
        q.age += dt;
        if (q.rec < 0) {
          q.p.addScaledVector(q.v, dt);
          if (!rm) { q.p.x += (H.rnd() - 0.5) * dt * 0.6; q.p.z += (H.rnd() - 0.5) * dt * 0.6; }
          if (q.p.y < 1.42) {
            let best = -1, bd = 0.35;
            for (let r = 0; r < NR; r++) { const d = Math.hypot(recPos[r].x - q.p.x, recPos[r].z - q.p.z); if (d < bd) { bd = d; best = r; } }
            if (best >= 0) { q.rec = best; q.p.copy(recPos[best]).setY(recPos[best].y + 0.1); recGlow[best] = 1; } else q.v.y = Math.abs(q.v.y) * 0.3;
          }
        }
        if (q.age > 3.2) q.live = false;
        const fade = q.live ? Math.min(1, 3.2 - q.age) : 0;
        ntPos[i * 3] = q.p.x; ntPos[i * 3 + 1] = q.live ? q.p.y : -50; ntPos[i * 3 + 2] = q.p.z;
        ntCol[i * 3] = 0.4 * fade; ntCol[i * 3 + 1] = 1.6 * fade; ntCol[i * 3 + 2] = 1.2 * fade;
      }
    }
    ntG.attributes.position.needsUpdate = true; ntG.attributes.color.needsUpdate = true;
    for (let r = 0; r < NR; r++) {
      recGlow[r] = Math.max(0, recGlow[r] - dt * 0.9);
      const g = recGlow[r];
      col3.setRGB(0.2 + 2.5 * g, 0.75 + 1.6 * g, 0.6 + 0.4 * g); receptors.setColorAt(r, col3);
    }
    receptors.instanceColor.needsUpdate = true;
    accCanvas += dt;
    H.updatePeople(dt, t);
  }

  return { update, dispose: H.dispose, selectFunction(id) { const i = FUNCS.findIndex((f) => f.id === id); if (i >= 0) { state.fn = i; applyFunction(); } }, functions: FUNCS.map((f) => f.id) };
}

module.exports = { id: ZONE, build, FUNCS, _brainSDF: brainSDF, _classify: classify, _buildBrainData: buildBrainData };
