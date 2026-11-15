'use strict';
/**
 * Counselling & Clinic Centre (zone 7) — A2 World. WORLD_API zone builder: module.exports = { id, build(kit) }.
 * Local coords, entrance toward +Z. Waiting room (chairs, water cooler, plants, privacy notices, "Simulation" sign,
 * reception), therapy room (two armchairs at an angle, side table, tissue box, soft lamp, clock), supervision room behind
 * a one-way window with a whiteboard, and a FACS face lab mirror wall with a simulated actor cycling expressions.
 * A simulated client sits in the therapy room. Interactables → sim.services.clinic.startSession()/startJourney(),
 * panels therapy / psychopathology / emotion, paradigm face_recognition. No real records; everything is simulated.
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


const ZONE = 'clinic';
const EXPRESSIONS = ['joy', 'surprise', 'sadness', 'fear', 'anger', 'disgust', 'contempt', 'neutral'];
const AU_CARDS = [
  ['AU1 + AU2', 'Inner + outer brow raiser', 'surprise'], ['AU4', 'Brow lowerer', 'anger, concentration'], ['AU6 + AU12', 'Cheek raiser + lip-corner puller', 'felt (Duchenne) smile'],
  ['AU15', 'Lip-corner depressor', 'sadness'], ['AU9', 'Nose wrinkler', 'disgust'], ['AU20', 'Lip stretcher', 'fear'],
];

function build(kit) {
  const H = makeHelpers(kit, ZONE);
  const { THREE, V3, box, cyl, paint, glow, glass, M, tag, sign, interact, light, lamp, root, wall } = H;
  const S = H.shell({ h: 5, skyZ: 10, skyD: 6, skyW: 12 });
  const anchor = (name, v) => { if (typeof kit.anchor === 'function') kit.anchor(name, v); };
  const steel = paint(0x2b2f3a, { roughness: 0.4, metalness: 0.8 });
  const PZ = 5, WX = -4, FX = 6, RH = S.H - 0.9;
  const clinic = () => H.services().clinic || {};

  // ---------------- partitions
  wall('x', PZ, -S.hw, S.hw, RH, 0.2, M.plaster(), [{ c: -10, w: 1.2, top: 2.3 }, { c: 1, w: 1.2, top: 2.3 }, { c: 12, w: 1.6, top: 2.3 }]);
  const wz0 = -12.5, wz1 = -5.5, sill = 0.9, top = 2.2;
  wall('z', WX, -S.hd, PZ, RH, 0.22, M.plaster(), [{ c: (wz0 + wz1) / 2, w: wz1 - wz0, sill, top, glass: false }]);
  H.collide(WX - 0.11, 0, wz0, WX + 0.11, RH, wz1);
  wall('z', FX, -S.hd, PZ, RH, 0.2, M.plaster(), []);
  box(S.W - 0.4, 0.12, S.hd + PZ, 0, RH + 0.06, (-S.hd + PZ) / 2, paint(0xf1ece2, { roughness: 0.95 }));
  // one-way window: mirror face toward the therapy room (−X), see-through tint toward supervision (+X)
  const ww = wz1 - wz0, wh = top - sill, wzc = (wz0 + wz1) / 2, wyc = (sill + top) / 2;
  const mirrorM = H.own(new THREE.MeshStandardMaterial({ color: 0xe6edf3, metalness: 1, roughness: 0.05, side: THREE.FrontSide }));
  const mir = new THREE.Mesh(H.own(new THREE.PlaneGeometry(ww, wh)), mirrorM); mir.position.set(WX - 0.08, wyc, wzc); mir.rotation.y = -Math.PI / 2; root.add(mir);
  const tint = new THREE.Mesh(H.own(new THREE.PlaneGeometry(ww, wh)), H.own(new THREE.MeshStandardMaterial({ color: 0x0b1220, transparent: true, opacity: 0.3, roughness: 0.1, depthWrite: false })));
  tint.position.set(WX + 0.08, wyc, wzc); tint.rotation.y = Math.PI / 2; root.add(tint);
  for (const y of [sill, top]) box(0.28, 0.05, ww + 0.1, WX, y, wzc, steel);

  // ---------------- furniture helpers
  function rot(x, z, ry, dx, dz) { const c = Math.cos(ry), s = Math.sin(ry); return [x + dx * c + dz * s, z - dx * s + dz * c]; }
  function armchair(x, z, ry, color) {
    const m = paint(color, { roughness: 0.95 }), legs = M.wood();
    const P = (dx, dy, dz, w, h, d, mm) => { const [px, pz] = rot(x, z, ry, dx, dz); box(w, h, d, px, dy, pz, mm || m, { ry }); };
    P(0, 0.32, 0.02, 0.8, 0.22, 0.75); P(0, 0.75, -0.33, 0.8, 0.7, 0.16); P(-0.38, 0.55, 0, 0.12, 0.3, 0.75); P(0.38, 0.55, 0, 0.12, 0.3, 0.75);
    P(0, 0.46, 0.05, 0.62, 0.08, 0.62, paint(0xf5f0e6, { roughness: 1 }));
    for (const [a, b] of [[-0.34, -0.32], [0.34, -0.32], [-0.34, 0.34], [0.34, 0.34]]) P(a, 0.1, b, 0.06, 0.2, 0.06, legs);
    H.collide(x - 0.5, 0, z - 0.5, x + 0.5, 0.95, z + 0.5);
  }
  const face = (from, to) => Math.atan2(to[0] - from[0], to[1] - from[1]);

  // ---------------- therapy room (x < WX)
  const room = { x0: -S.hw, x1: WX, z0: -S.hd, z1: PZ };
  box(5.2, 0.02, 3.8, -11, 0.015, -8.5, paint(0x7c3a5a, { roughness: 1 }), { shadow: false });
  const cli = [-12.4, -9.6], cou = [-9.6, -7.9];
  const ryCli = face(cli, [cou[0] + 0.7, cou[1] + 0.9]), ryCou = face(cou, [cli[0] + 0.9, cli[1] + 0.6]);
  armchair(cli[0], cli[1], ryCli, 0x0f766e); armchair(cou[0], cou[1], ryCou, 0x4338ca);
  // side table + tissue box + lamp
  const st = [-11.5, -7.4];
  cyl(0.3, 0.3, 0.04, st[0], 0.6, st[1], M.wood(), { seg: 20, collide: true }); cyl(0.04, 0.04, 0.58, st[0], 0.3, st[1], M.wood(), { seg: 8 });
  box(0.22, 0.11, 0.12, st[0] + 0.05, 0.68, st[1], paint(0xfbcfe8, { roughness: 0.8 })); box(0.08, 0.05, 0.05, st[0] + 0.05, 0.76, st[1], paint(0xffffff, { roughness: 1 }));
  cyl(0.12, 0.15, 1.5, -13.8, 0.75, -10.8, steel, { seg: 10 }); cyl(0.02, 0.02, 1.5, -13.8, 0.75, -10.8, steel, { seg: 6 });
  cyl(0.22, 0.32, 0.36, -13.8, 1.62, -10.8, paint(0xfff3d6, { emissive: 0xffb860, emissiveIntensity: 1.3, roughness: 0.9 }), { open: true, seg: 20 });
  // bookshelf, plant, wall clock, window
  box(2.4, 2.0, 0.4, -15.5, 1.0, -S.hd + 0.5, M.wood(), { collide: true });
  const bookC = [0x9f1239, 0x0f766e, 0xf59e0b, 0x312e81, 0x64748b];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 9; k++) box(0.08 + (k % 3) * 0.03, 0.32, 0.26, -16.5 + k * 0.24, 0.3 + r * 0.48, -S.hd + 0.55, paint(bookC[(k + r) % 5], { roughness: 0.8 }));
  const leaf = paint(0x2f7d4f, { roughness: 0.8 }), pot = paint(PAL.crimson, { roughness: 0.6 });
  cyl(0.32, 0.26, 0.55, -6, 0.28, -15.8, pot, { collide: true }); H.sphere(0.5, -6, 1.0, -15.8, leaf, { sy: 1.3, seg: 10 });
  const clk = H.canvas(256, 256);
  { const g = clk.g; g.fillStyle = '#f8fafc'; g.beginPath(); g.arc(128, 128, 124, 0, 7); g.fill(); g.strokeStyle = '#1e1b4b'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#1e1b4b'; for (let h = 0; h < 12; h++) { const a = (h / 12) * Math.PI * 2; g.fillRect(128 + Math.sin(a) * 100 - 4, 128 - Math.cos(a) * 100 - 4, 8, 8); } clk.tex.needsUpdate = true; }
  const clock = new THREE.Mesh(H.own(new THREE.CircleGeometry(0.28, 32)), H.own(new THREE.MeshStandardMaterial({ map: clk.tex, roughness: 0.6 })));
  clock.position.set(-7.0, 2.2, -S.hd + 0.27); root.add(clock);
  const hands = [0.18, 0.24].map((L, i) => { const h = new THREE.Mesh(H.own(new THREE.BoxGeometry(0.02, L, 0.01)), paint(i ? 0x9f1239 : 0x1e1b4b)); h.geometry.translate(0, L / 2, 0); h.position.set(-7.0, 2.2, -S.hd + 0.29); root.add(h); return h; });
  const view = H.canvas(512, 320);
  { const g = view.g, gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#fcd9a8'); gr.addColorStop(1, '#f5a97f'); g.fillStyle = gr; g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#2f7d4f'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(40 + i * 75, 250, 55, 0, 7); g.fill(); } g.fillStyle = '#a8553a'; g.fillRect(0, 280, 512, 40); view.tex.needsUpdate = true; }
  const win = new THREE.Mesh(H.own(new THREE.PlaneGeometry(2.4, 1.5)), H.own(new THREE.MeshBasicMaterial({ map: view.tex })));
  win.position.set(-S.hw + 0.27, 1.8, -7); win.rotation.y = Math.PI / 2; root.add(win);
  box(0.08, 1.6, 2.5, -S.hw + 0.25, 1.8, -7, steel);
  for (const dz of [-1.45, 1.45]) box(0.1, 2.3, 0.5, -S.hw + 0.4, 1.4, -7 + dz, paint(0xc2a27a, { roughness: 1 }));
  // simulated client (seated)
  const client = H.person({ lookIndex: 3, height: 1.7, name: 'Simulated client', outfit: 'kameez' }, 'sit');
  client.group.position.set(cli[0], 0, cli[1]); client.group.rotation.y = ryCli;
  try { if (client.setEmotion) client.setEmotion('sadness', 0.35); } catch (e) { /* noop */ }
  tag('Therapy room', 0.3, { pos: [-11, 3.1, -9] });
  interact('session', [cou[0] + 0.5, 1.0, cou[1] + 0.8], 2.2, 'Counsellor chair — start a simulated counselling session', () => {
    const c = clinic(); if (typeof c.startSession === 'function') c.startSession(); else H.openPanel('therapy');
  });
  interact('therapy', [-15.5, 1.2, -S.hd + 1.5], 1.8, 'Bookshelf — Therapies & Counselling', () => H.openPanel('therapy'));

  // ---------------- supervision room (WX < x < FX)
  box(2.4, 0.06, 1.1, 1, 0.75, -9, M.wood(), { collide: true });
  for (const dx of [-1.1, 1.1]) for (const dz of [-0.45, 0.45]) box(0.05, 0.72, 0.05, 1 + dx, 0.37, -9 + dz, steel);
  const chairM = paint(0x1f2a44, { roughness: 0.8 });
  for (const [x, z, ry] of [[0.2, -8.1, Math.PI], [1.8, -8.1, Math.PI], [0.2, -9.9, 0], [1.8, -9.9, 0], [-2.8, -9, Math.PI / 2]]) {
    box(0.48, 0.07, 0.48, x, 0.47, z, chairM, { collide: true }); const [bx, bz] = rot(x, z, ry, 0, -0.23); box(0.48, 0.5, 0.05, bx, 0.75, bz, chairM, { ry });
  }
  const wb = H.canvas(1024, 576);
  { const g = wb.g; g.fillStyle = '#fbfdff'; g.fillRect(0, 0, 1024, 576);
    g.fillStyle = '#1e3a8a'; g.font = `700 44px ${FONT}`; g.textBaseline = 'top'; g.fillText('Supervision notes (simulated)', 36, 26);
    g.font = `500 30px ${FONT}`; const lines = [['#0f766e', 'OARS: Open questions · Affirmations · Reflections · Summaries'], ['#9f1239', 'Reflect feeling before advising — avoid premature advice'],
      ['#1e3a8a', 'CBT ABC: Activating event → Belief → Consequence'], ['#b45309', 'Risk check every session · refer when out of scope'], ['#1e3a8a', 'Confidentiality & its limits explained at intake']];
    lines.forEach(([c, t], i) => { g.fillStyle = c; g.fillText('• ' + t, 40, 110 + i * 78); });
    g.strokeStyle = '#94a3b8'; g.lineWidth = 3; g.strokeRect(6, 6, 1012, 564); wb.tex.needsUpdate = true; }
  const board = new THREE.Mesh(H.own(new THREE.PlaneGeometry(3.2, 1.8)), H.own(new THREE.MeshStandardMaterial({ map: wb.tex, roughness: 0.3, emissive: 0xffffff, emissiveMap: wb.tex, emissiveIntensity: 0.15 })));
  board.position.set(1, 1.7, -S.hd + 0.28); root.add(board);
  box(3.3, 1.9, 0.05, 1, 1.7, -S.hd + 0.24, steel); box(3.0, 0.05, 0.1, 1, 0.78, -S.hd + 0.3, steel);
  tag('Supervision room', 0.28, { pos: [1, 3.3, -11] });
  tag('One-way window', 0.22, { pos: [WX + 0.3, 2.6, wzc] });
  interact('supervision', [0.5, 1.0, -6.8], 2.0, 'Supervision — Therapies & Counselling', () => H.openPanel('therapy'));

  // ---------------- FACS face lab (x > FX)
  const mirM = H.own(new THREE.MeshStandardMaterial({ color: 0xe6edf3, metalness: 1, roughness: 0.06 }));
  mirM.userData.ssr = true;
  for (let i = 0; i < 4; i++) {
    const x = FX + 1.8 + i * 2.6;
    const m = new THREE.Mesh(H.own(new THREE.PlaneGeometry(1.4, 1.6)), mirM); m.position.set(x, 1.75, -S.hd + 0.27); root.add(m);
    box(1.56, 1.76, 0.05, x, 1.75, -S.hd + 0.24, paint(0x1e1b4b, { roughness: 0.5 }));
    for (let b = 0; b < 5; b++) H.sphere(0.04, x - 0.6 + b * 0.3, 2.72, -S.hd + 0.3, glow(0xfff1d6, 2.2), { seg: 8 });
  }
  box(11.4, 0.05, 0.5, FX + 5.7, 0.9, -S.hd + 0.5, M.wood(), { collide: true });
  AU_CARDS.forEach(([au, name, use], i) => {
    const side = i < 3 ? 0 : 1;
    sign([{ t: au, size: 0.2, weight: 800, color: '#FCD34D' }, { t: name, size: 0.12, weight: 600 }, { t: 'often seen in: ' + use, size: 0.1, weight: 400, color: '#CBD5E1' }],
      1.3, 0.75, { pos: [FX + 0.27, 2.4 - (i % 3) * 0.85, -12 + side * 1.6 - 1.6], ry: Math.PI / 2, px: 220 });
  });
  const actor = H.person({ lookIndex: 8, height: 1.7, name: 'Simulated actor (FACS demo)', outfit: 'kameez' }, 'idle');
  actor.group.position.set(FX + 6, 0, -13.2); actor.group.rotation.y = 0;
  const exprCv = H.canvas(512, 160);
  const exprMesh = new THREE.Mesh(H.own(new THREE.PlaneGeometry(1.6, 0.5)), H.own(new THREE.MeshStandardMaterial({ map: exprCv.tex, emissive: 0xffffff, emissiveMap: exprCv.tex, emissiveIntensity: 0.8 })));
  exprMesh.position.set(FX + 6, 2.35, -12.2); root.add(exprMesh);
  const fst = { i: 0, t: 0 };
  function drawExpr() {
    const g = exprCv.g; g.fillStyle = 'rgba(30,27,75,0.95)'; g.fillRect(0, 0, 512, 160); g.fillStyle = CSS.saffron; g.fillRect(0, 0, 10, 160);
    g.fillStyle = '#94A3B8'; g.font = `500 22px ${FONT}`; g.textBaseline = 'top'; g.textAlign = 'left'; g.fillText('Posed expression (simulated actor)', 26, 14);
    g.fillStyle = CSS.chalk; g.font = `700 56px ${FONT}`; g.fillText(EXPRESSIONS[fst.i], 26, 58); exprCv.tex.needsUpdate = true;
  }
  drawExpr();
  tag('FACS face lab', 0.3, { pos: [FX + 6, 3.4, -10] });
  interact('facs', [FX + 6, 1.0, -10.6], 2.2, 'FACS face lab — facial-expression recognition', () => H.runParadigm('face_recognition', 'emotion'));
  interact('emotion', [FX + 1.2, 1.2, -12], 1.6, 'Action-unit cards — Motivation & Emotion', () => H.openPanel('emotion'));

  // ---------------- waiting room (z > PZ)
  const seat = paint(0x0f766e, { roughness: 0.9 });
  for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) {
    const x = -15 + k * 0.7, z = 9 + r * 2.4;
    box(0.55, 0.08, 0.5, x, 0.46, z, seat); box(0.55, 0.5, 0.06, x, 0.75, z - 0.24, seat); box(0.05, 0.44, 0.05, x, 0.22, z, steel);
  }
  H.collide(-15.4, 0, 8.6, -11.9, 1.0, 9.4); H.collide(-15.4, 0, 11.0, -11.9, 1.0, 11.8);
  box(0.36, 1.1, 0.36, -16.9, 0.55, 14.5, paint(0xe2e8f0, { roughness: 0.4 }), { collide: true });
  cyl(0.15, 0.15, 0.42, -16.9, 1.31, 14.5, glass(0x7dd3fc, 0.55), { seg: 16, shadow: false });
  box(0.06, 0.04, 0.06, -16.68, 0.9, 14.5, paint(0x1d4ed8));
  for (const [x, z] of [[-16.5, 16], [16.5, 16], [-3, 6.5], [3, 16], [-8.5, 6.5]]) { cyl(0.35, 0.28, 0.6, x, 0.3, z, pot, { collide: true }); H.sphere(0.5, x, 1.0, z, leaf, { sy: 1.3, seg: 10 }); }
  // reception + SIMULATION sign
  box(3.6, 1.05, 0.8, 8, 0.525, 11.5, M.wood(), { collide: true });
  box(3.7, 0.05, 0.9, 8, 1.07, 11.5, paint(PAL.saffron, { roughness: 0.4 }));
  box(0.35, 0.25, 0.04, 7.5, 1.25, 11.3, paint(0x111827));
  sign([{ t: 'SIMULATION', size: 0.42, weight: 800, color: '#FCD34D' }, { t: 'Teaching clinic · fictional clients · no real records', size: 0.18, weight: 500 }], 3.2, 0.8, { pos: [8, 2.3, 10.95], px: 200, glow: 0.7 });
  box(0.06, 0.8, 0.06, 6.6, 1.5, 10.95, steel); box(0.06, 0.8, 0.06, 9.4, 1.5, 10.95, steel);
  sign([{ t: 'Your privacy', size: 0.14, weight: 700 }, { t: 'This is a simulated clinic. Sessions are role-play with fictional clients. Nothing you type leaves this device.', size: 0.075, weight: 400, color: '#CBD5E1' }],
    2.4, 1.3, { pos: [-S.hw + 0.25, 1.8, 13], ry: Math.PI / 2, px: 200 });
  sign([{ t: 'Need support now?', size: 0.13, weight: 700 }, { t: 'If you are in distress, open “Session, Safety & Settings” for verified help options. This game is not a substitute for care.', size: 0.075, weight: 400, color: '#CBD5E1' }],
    2.4, 1.3, { pos: [-S.hw + 0.25, 1.8, 9.5], ry: Math.PI / 2, px: 200, band: '#0F766E' });
  sign([{ t: 'Psychopathology (simulated)', size: 0.12, weight: 700 }, { t: 'Disorders are described by patterns of distress and impairment. Labels describe experiences, not people.', size: 0.075, weight: 400, color: '#CBD5E1' }],
    2.6, 1.3, { pos: [S.hw - 0.25, 1.8, 11], ry: -Math.PI / 2, px: 200 });
  interact('journey', [8, 1.0, 12.7], 2.0, 'Reception — begin the client journey (simulated)', () => {
    const c = clinic(); if (typeof c.startJourney === 'function') c.startJourney(); else H.openPanel('therapy');
  });
  interact('psychopathology', [S.hw - 1.4, 1.2, 11], 1.8, 'Poster — Psychopathology (Simulated)', () => H.openPanel('psychopathology'));

  for (const [x, z] of [[-8, 12], [0, 12], [12, 15]]) lamp(x, S.H - 0.08, z, 2.0, 0.5);
  for (const [x, z] of [[1, -9], [12, -8], [12, -2]]) lamp(x, RH - 0.02, z, 2.0, 0.5);
  light(0xffc98a, 14, 9, -13.6, 1.9, -10.6, true);
  light(0xf1f5ff, 24, 12, 12, 3.4, -10);
  anchor('therapy', new V3(-11, 1.2, -8.6)); anchor('supervision', new V3(1, 1.4, -9)); anchor('facs', new V3(FX + 6, 1.6, -13)); anchor('waiting', new V3(0, 1.4, 11));
  H.flush(); H.buildHotspots();

  // ---------------- animation
  function update(dt, t) {
    dt = Math.min(dt || 0, 0.1);
    H.updateHotspots(t);
    // wall clock (real local time where available)
    const d = new Date(), hr = (d.getHours() % 12) + d.getMinutes() / 60, mn = d.getMinutes() + d.getSeconds() / 60;
    hands[0].rotation.z = -(hr / 12) * Math.PI * 2; hands[1].rotation.z = -(mn / 60) * Math.PI * 2;
    if (H.camDist() > 70) return;
    fst.t += dt;
    const hold = H.reduced() ? 6 : 3.5;
    if (fst.t > hold) {
      fst.t = 0; fst.i = (fst.i + 1) % EXPRESSIONS.length; drawExpr();
      try { if (actor.setEmotion) actor.setEmotion(EXPRESSIONS[fst.i], 0.85); } catch (e) { /* noop */ }
    }
    H.updatePeople(dt, t);
  }
  return { update, dispose: H.dispose };
}

module.exports = { id: ZONE, build };
