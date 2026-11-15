'use strict';
/**
 * Child Development Suite (zone 6) — A2 World. WORLD_API zone builder: module.exports = { id, build(kit) }.
 * Local coords, entrance toward +Z. Bright playroom (mats, toys, conservation table with pouring liquid / spreading
 * counters / clay ball↔sausage, false-belief puppet stage with ORIGINAL characters "Sitara" and "Moti"), a
 * simulated caregiver + child; a dim observation room behind a one-way mirror. Mirror trick: two single-sided planes —
 * a polished metal face toward the playroom (opaque from that side) and a dark tinted pane toward the observers
 * (the metal face is back-face culled from their side, so they see through). Interactables → paradigms
 * conservation / false_belief, panel 'development'.
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


const ZONE = 'childdev';

function build(kit) {
  const H = makeHelpers(kit, ZONE);
  const { THREE, V3, box, cyl, paint, glow, glass, M, tag, sign, interact, light, lamp, root, wall } = H;
  const S = H.shell({ h: 6, skyZ: -6, skyD: 8, skyW: 12 });
  const anchor = (name, v) => { if (typeof kit.anchor === 'function') kit.anchor(name, v); };
  const steel = paint(0x2b2f3a, { roughness: 0.4, metalness: 0.8 });
  const PZ = 5, MX = 3, mz0 = -14, mz1 = -3, sill = 0.85, top = 2.45;

  // ---------------- partitions + one-way mirror
  wall('x', PZ, -S.hw, S.hw, S.H - 1.1, 0.2, M.plaster(), [{ c: -8, w: 2.0, top: 2.4 }, { c: 10, w: 1.6, top: 2.3 }]);
  wall('z', MX, -S.hd, PZ, S.H - 1.1, 0.24, M.plaster(), [{ c: (mz0 + mz1) / 2, w: mz1 - mz0, sill, top, glass: false }]);
  H.collide(MX - 0.12, 0, mz0, MX + 0.12, S.H - 1.1, mz1);
  box(S.W - 0.4, 0.12, S.hd + PZ, 0, S.H - 1.1 + 0.06, (-S.hd + PZ) / 2, paint(0xece6dc, { roughness: 0.95 }));
  const mw = mz1 - mz0, mh = top - sill, mzc = (mz0 + mz1) / 2, myc = (sill + top) / 2;
  const mirrorM = H.own(new THREE.MeshStandardMaterial({ color: 0xe6edf3, metalness: 1.0, roughness: 0.04, side: THREE.FrontSide }));
  mirrorM.userData.ssr = true;
  const mirror = new THREE.Mesh(H.own(new THREE.PlaneGeometry(mw, mh)), mirrorM);
  mirror.position.set(MX - 0.07, myc, mzc); mirror.rotation.y = -Math.PI / 2; mirror.name = 'childdev:oneway-mirror-face'; root.add(mirror);
  const tintM = H.own(new THREE.MeshStandardMaterial({ color: 0x0b1220, transparent: true, opacity: 0.32, roughness: 0.1, metalness: 0.2, depthWrite: false, side: THREE.FrontSide }));
  const tint = new THREE.Mesh(H.own(new THREE.PlaneGeometry(mw, mh)), tintM);
  tint.position.set(MX + 0.07, myc, mzc); tint.rotation.y = Math.PI / 2; tint.name = 'childdev:oneway-mirror-glass'; root.add(tint);
  for (const y of [sill, top]) box(0.3, 0.06, mw + 0.1, MX, y, mzc, steel);
  for (const z of [mz0, mz1]) box(0.3, mh, 0.06, MX, myc, z, steel);

  // ---------------- playroom (x < MX)
  const matCols = [0x0f766e, 0xf59e0b, 0x9f1239, 0x6366f1, 0x22c55e, 0xf472b6];
  for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) box(1.95, 0.04, 1.95, -S.hw + 1.4 + i * 2, 0.02, -S.hd + 1.3 + j * 2, paint(matCols[(i * 3 + j) % 6], { roughness: 1 }), { shadow: false });
  box(4.0, 1.3, 0.45, -12, 0.65, -S.hd + 0.55, M.wood(), { collide: true });
  for (let k = 0; k < 14; k++) box(0.24, 0.24, 0.24, -13.6 + (k % 7) * 0.48, 1.45 + Math.floor(k / 7) * 0.26 - 0.13, -S.hd + 0.55, paint(matCols[k % 6], { roughness: 0.6 }));
  for (let k = 0; k < 10; k++) box(0.22, 0.22, 0.22, -15 + (k % 4) * 0.3, 0.15 + Math.floor(k / 4) * 0.23, -6 - (k % 3) * 0.2, paint(matCols[(k + 2) % 6], { roughness: 0.6 }), { ry: k * 0.3 });
  H.sphere(0.22, -9, 0.22, 1.5, paint(0xef4444, { roughness: 0.4 }));
  H.sphere(0.3, -15.5, 0.3, 2.0, paint(0x0ea5e9, { roughness: 0.4 }));
  // small rocking horse (original, primitive)
  box(0.9, 0.3, 0.25, -15, 0.55, -10, paint(0xf59e0b, { roughness: 0.6 })); H.sphere(0.17, -14.5, 0.85, -10, paint(0xf59e0b, { roughness: 0.6 }));
  cyl(0.6, 0.6, 0.06, -15, 0.12, -10, M.wood(), { rx: Math.PI / 2, seg: 24 });
  H.collide(-15.6, 0, -10.3, -14.3, 1.0, -9.7);

  // conservation table
  const TX = -6, TZ = -8.5, TY = 0.55;
  box(2.2, 0.06, 1.1, TX, TY, TZ, M.wood(), { collide: true });
  for (const dx of [-1, 1]) for (const dz of [-1, 1]) box(0.06, TY, 0.06, TX + dx * 1.0, TY / 2, TZ + dz * 0.48, M.wood());
  for (const dx of [-0.55, 0.55]) box(0.34, 0.04, 0.34, TX + dx * 2.0, 0.3, TZ + 1.0, paint(0x0f766e), { collide: true });
  const glassM = glass(0xe0f2fe, 0.22), liquidM = paint(0x14b8a6, { roughness: 0.2, transparent: true, opacity: 0.85 });
  const R1 = 0.09, R2 = 0.05, V0 = Math.PI * R1 * R1 * 0.12; // equal volume in each short glass
  const G = [{ x: TX - 0.6, r: R1, h: 0.2 }, { x: TX - 0.25, r: R1, h: 0.2 }, { x: TX + 0.15, r: R2, h: 0.4 }];
  const liquids = G.map((g) => {
    cyl(g.r, g.r * 0.92, g.h, g.x, TY + 0.03 + g.h / 2, TZ, glassM, { open: true, seg: 20, shadow: false });
    const m = new THREE.Mesh(H.own(new THREE.CylinderGeometry(g.r * 0.92, g.r * 0.88, 1, 20)), liquidM);
    m.position.set(g.x, TY + 0.03, TZ); root.add(m); return m;
  });
  const setLevel = (i, h) => { const m = liquids[i]; m.visible = h > 0.002; m.scale.y = Math.max(0.001, h); m.position.y = TY + 0.035 + h / 2; };
  // counters (number conservation)
  const counters = new THREE.InstancedMesh(H.own(new THREE.CylinderGeometry(0.03, 0.03, 0.015, 14)), paint(PAL.crimson, { roughness: 0.4 }), 12);
  root.add(counters);
  const clay = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.08, 18, 12)), paint(0xa855f7, { roughness: 0.7 })); clay.position.set(TX + 0.75, TY + 0.11, TZ - 0.2); root.add(clay);
  const clay2 = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.08, 18, 12)), paint(0xa855f7, { roughness: 0.7 })); clay2.position.set(TX + 0.75, TY + 0.11, TZ + 0.2); root.add(clay2);
  tag('Conservation table', 0.24, { pos: [TX, 1.65, TZ] });
  interact('conservation', [TX, 0.9, TZ + 1.6], 2.0, 'Conservation tasks — observe & code (Piaget)', () => H.runParadigm('conservation', 'development'));

  // false-belief puppet stage
  const FX = -12.5, FZ = -11.5;
  box(2.4, 0.9, 0.9, FX, 0.45, FZ, paint(0x1e1b4b, { roughness: 0.7 }), { collide: true });
  for (const dx of [-1.15, 1.15]) box(0.12, 1.4, 0.12, FX + dx, 1.6, FZ - 0.35, paint(PAL.crimson, { roughness: 0.6 }));
  box(2.42, 0.25, 0.14, FX, 2.4, FZ - 0.35, paint(PAL.crimson, { roughness: 0.6 }));
  box(2.3, 1.4, 0.04, FX, 1.6, FZ - 0.43, paint(0x312e81, { roughness: 1 }));
  sign([{ t: 'Where will Sitara look first?', size: 0.22, weight: 700, color: '#FCD34D' }], 2.0, 0.28, { pos: [FX, 2.4, FZ - 0.27], px: 220, border: false, band: false, top: 0.18 });
  const basket = new THREE.Mesh(H.own(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 16, 1, true)), paint(0xb45309, { roughness: 0.9, side: THREE.DoubleSide }));
  basket.position.set(FX - 0.55, 1.0, FZ); root.add(basket);
  box(0.3, 0.22, 0.3, FX + 0.55, 1.01, FZ, paint(0x0ea5e9, { roughness: 0.6 }));
  const marble = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.05, 14, 10)), paint(0xf43f5e, { roughness: 0.2, metalness: 0.2 })); root.add(marble);
  function puppet(color, headShape) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(H.own(new THREE.ConeGeometry(0.16, 0.45, 16)), paint(color, { roughness: 0.7 })); b.position.y = 0.22; g.add(b);
    const hgeo = headShape === 'star' ? new THREE.OctahedronGeometry(0.13, 0) : new THREE.SphereGeometry(0.12, 16, 12);
    const h = new THREE.Mesh(H.own(hgeo), paint(color === PAL.saffron ? 0xfde68a : 0x99f6e4, { roughness: 0.5 })); h.position.y = 0.56; g.add(h);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(H.own(new THREE.SphereGeometry(0.018, 8, 6)), paint(0x111111)); e.position.set(0.045 * s, 0.58, 0.1); g.add(e); }
    root.add(g); return g;
  }
  const sitara = puppet(PAL.saffron, 'star'), moti = puppet(PAL.teal, 'round');
  tag('Sitara', 0.16, { pos: [FX - 0.85, 2.0, FZ + 0.2], parent: root }); tag('Moti', 0.16, { pos: [FX + 0.85, 2.0, FZ + 0.2] });
  tag('False-belief puppet stage', 0.24, { pos: [FX, 2.85, FZ] });
  interact('falsebelief', [FX, 0.9, FZ + 1.5], 2.0, 'False-belief task (original characters)', () => H.runParadigm('false_belief', 'development'));

  // simulated caregiver + child
  const child = H.person({ lookIndex: 11, height: 1.05, name: 'Simulated child', outfit: 'kurta' }, 'idle');
  child.group.position.set(TX - 0.3, 0, TZ + 0.85); child.group.rotation.y = Math.PI;
  const carer = H.person({ lookIndex: 5, height: 1.64, name: 'Simulated caregiver', outfit: 'dupatta' }, 'sit');
  carer.group.position.set(TX + 1.6, 0, TZ + 1.2); carer.group.rotation.y = -2.2;
  box(0.5, 0.06, 0.5, TX + 1.6, 0.45, TZ + 1.2, M.wood(), { collide: true });
  for (const dx of [-0.22, 0.22]) for (const dz of [-0.22, 0.22]) box(0.04, 0.44, 0.04, TX + 1.6 + dx, 0.22, TZ + 1.2 + dz, steel);
  sign([{ t: 'Playroom', size: 0.16, weight: 700 }, { t: 'Families visiting the simulated suite play here. A one-way mirror lets trained observers code behaviour without interrupting.', size: 0.075, weight: 400, color: '#CBD5E1' }],
    2.8, 1.3, { pos: [-S.hw + 0.25, 1.8, -4], ry: Math.PI / 2, px: 200 });

  // ---------------- observation room (x > MX) — dimmer, so the mirror works
  box(S.hw - MX - 0.3, 0.02, S.hd + PZ - 0.4, (MX + S.hw) / 2, 0.012, (-S.hd + PZ) / 2, M.carpet(), { shadow: false });
  box(0.7, 0.06, 7.5, MX + 1.0, 0.76, mzc, M.wood(), { collide: true });
  for (const dz of [-3.5, 3.5]) box(0.6, 0.72, 0.06, MX + 1.0, 0.37, mzc + dz, steel);
  const chairM = paint(0x1f2a44, { roughness: 0.8 });
  for (const z of [-12, -9.5, -7, -4.5]) { box(0.5, 0.08, 0.5, MX + 1.8, 0.48, z, chairM, { collide: true }); box(0.06, 0.55, 0.48, MX + 2.05, 0.8, z, chairM); cyl(0.03, 0.03, 0.44, MX + 1.8, 0.22, z, steel, { seg: 8 }); }
  for (const z of [-11, -6]) { box(0.28, 0.02, 0.2, MX + 1.0, 0.8, z, paint(0x111827)); box(0.02, 0.18, 0.28, MX + 1.1, 0.9, z, paint(0x111827)); cyl(0.07, 0.07, 0.04, MX + 1.2, 0.81, z + 0.5, paint(0x111111), { rx: Math.PI / 2, seg: 12 }); }
  const coding = H.canvas(768, 1024);
  { const g = coding.g; g.fillStyle = '#fbf7ec'; g.fillRect(0, 0, 768, 1024); g.fillStyle = '#9F1239'; g.fillRect(0, 0, 768, 16);
    g.fillStyle = '#1E1B4B'; g.font = `700 40px ${FONT}`; g.textBaseline = 'top'; g.fillText('Observation coding sheet', 36, 40);
    g.font = `400 24px ${FONT}`; g.fillStyle = '#475569'; g.fillText('Simulated session · event sampling · 10 s intervals', 36, 96);
    const cols = ['Interval', 'Conserves?', 'Explains', 'Looks to', 'Points'];
    g.font = `600 22px ${FONT}`; cols.forEach((c, i) => g.fillText(c, 36 + i * 142, 150));
    g.strokeStyle = '#94A3B8';
    for (let r = 0; r < 16; r++) { const y = 186 + r * 48; g.beginPath(); g.moveTo(30, y); g.lineTo(738, y); g.stroke(); g.fillStyle = '#334155'; g.font = `400 20px ${FONT}`; g.fillText(String(r + 1), 50, y + 12);
      if (r < 6) { g.fillStyle = '#0F766E'; g.fillText(['no', 'no', 'yes', 'yes', 'no', 'yes'][r], 182, y + 12); g.fillText(['height', 'height', 'reversible', 'same amt', 'width', 'nothing added'][r], 324, y + 12); } }
    g.fillStyle = '#64748B'; g.font = `400 20px ${FONT}`; g.fillText('Inter-rater agreement is checked with Cohen’s kappa (Stats Workbench).', 36, 970);
    coding.tex.needsUpdate = true; }
  const cs = new THREE.Mesh(H.own(new THREE.PlaneGeometry(1.5, 2.0)), H.own(new THREE.MeshStandardMaterial({ map: coding.tex, roughness: 0.9, emissive: 0xffffff, emissiveMap: coding.tex, emissiveIntensity: 0.2 })));
  cs.position.set(S.hw - 0.26, 1.7, -9); cs.rotation.y = -Math.PI / 2; root.add(cs);
  sign([{ t: 'Observation room', size: 0.15, weight: 700 }, { t: 'Keep the lights low: the playroom side is brighter, so it sees a mirror and you see through. Speak softly.', size: 0.08, weight: 400, color: '#CBD5E1' }],
    2.6, 1.2, { pos: [S.hw - 0.26, 1.8, -3.5], ry: -Math.PI / 2, px: 200 });
  interact('observe', [MX + 2.6, 1.0, mzc], 2.4, 'One-way mirror observation — Development panel', () => H.openPanel('development'));
  tag('One-way mirror', 0.24, { pos: [MX + 0.2, 2.85, mzc] });

  // ---------------- lobby
  for (const x of [-11, 11]) { box(3.0, 0.08, 0.7, x, 0.46, 13.5, M.wood(), { collide: true }); box(2.8, 0.42, 0.6, x, 0.21, 13.5, paint(0x2a2440)); }
  const leaf = paint(0x2f7d4f, { roughness: 0.8 }), pot = paint(PAL.crimson, { roughness: 0.6 });
  for (const [x, z] of [[-16.5, 15.5], [16.5, 15.5], [-16.5, 6.5], [16.5, 6.5]]) { cyl(0.4, 0.34, 0.65, x, 0.33, z, pot, { collide: true }); H.sphere(0.55, x, 1.05, z, leaf, { sy: 1.25, seg: 10 }); }
  sign([{ t: 'Piaget’s stages (overview)', size: 0.11, weight: 700 }, { t: 'Sensorimotor (0–2) · Preoperational (2–7) · Concrete operational (7–11) · Formal operational (11+). Ages are approximate; later research shows earlier competence and cultural variation.', size: 0.07, weight: 400, color: '#CBD5E1' }],
    3.8, 1.6, { pos: [-S.hw + 0.25, 2.2, 11], ry: Math.PI / 2, px: 200 });
  sign([{ t: 'Theory of mind', size: 0.12, weight: 700 }, { t: 'Understanding that others can hold beliefs that differ from reality — tested with false-belief stories using puppets.', size: 0.075, weight: 400, color: '#CBD5E1' }],
    3.4, 1.4, { pos: [S.hw - 0.25, 2.2, 11], ry: -Math.PI / 2, px: 200 });
  for (const [x, z] of [[-8, 11], [8, 11], [0, 15]]) lamp(x, S.H - 0.08, z, 2.0, 0.5);
  for (const [x, z] of [[-12, -10], [-6, -8], [-10, -3], [-4, -13]]) lamp(x, S.H - 1.1 - 0.02, z, 2.4, 0.6, 0xfff7e6);
  light(0xfff3dc, 34, 16, -8, 3.8, -8, true);
  light(0xbfd4ff, 6, 8, 12, 3.6, -9);
  anchor('playroom', new V3(-8, 1.2, -8)); anchor('mirror', new V3(MX, 1.6, mzc)); anchor('observation', new V3(10, 1.4, -8));
  H.flush(); H.buildHotspots();

  // ---------------- animation
  const cm = new THREE.Matrix4();
  const st = { t: 0, f: 0 };
  setLevel(0, 0.12); setLevel(1, 0.12); setLevel(2, 0);
  function update(dt, t) {
    dt = Math.min(dt || 0, 0.1);
    H.updateHotspots(t);
    if (H.camDist() > 70) return;
    const rm = H.reduced();
    st.t += dt * (rm ? 0.6 : 1);
    // liquid: pour glass 2 → tall glass and back (volume conserved)
    const c = st.t % 10;
    let k = c < 2 ? 0 : c < 4 ? (c - 2) / 2 : c < 8 ? 1 : c < 9 ? 1 - (c - 8) : 0;
    k = Math.max(0, Math.min(1, k));
    const vB = V0 * (1 - k), vT = V0 * k;
    setLevel(1, vB / (Math.PI * (R1 * 0.92) ** 2)); setLevel(2, vT / (Math.PI * (R2 * 0.92) ** 2));
    // counters: one row spreads out (same number)
    const spread = 0.5 + 0.5 * Math.sin(st.t * 0.6);
    for (let i = 0; i < 12; i++) {
      const row = i < 6 ? 0 : 1, j = i % 6, gap = row ? 0.075 + 0.07 * spread : 0.075;
      cm.makeTranslation(TX - 0.4 + j * gap, TY + 0.04, TZ + 0.3 + row * 0.1); counters.setMatrixAt(i, cm);
    }
    counters.instanceMatrix.needsUpdate = true;
    // clay: ball ↔ sausage (same amount)
    const sx = 1 + 1.6 * Math.max(0, Math.sin(st.t * 0.5));
    clay2.scale.set(sx, 1 / Math.sqrt(sx), 1 / Math.sqrt(sx));
    // false-belief story, 14 s loop
    const f = st.t % 14;
    const basketP = new V3(FX - 0.55, 1.08, FZ), boxP = new V3(FX + 0.55, 1.15, FZ);
    const sAway = f > 3 && f < 9;
    sitara.position.set(FX - 0.85, sAway ? 0.9 - Math.min(1, (f - 3) * 2) * 0.6 + Math.max(0, (f - 8) * 2) * 0.6 : 0.9, FZ + 0.1);
    moti.position.set(FX + 0.85 - (f > 4.5 && f < 7.5 ? 0.6 * Math.sin(((f - 4.5) / 3) * Math.PI) : 0), 0.9, FZ + 0.1);
    if (f < 5) marble.position.copy(basketP);
    else if (f < 6.5) { const u = (f - 5) / 1.5; marble.position.lerpVectors(basketP, boxP, u); marble.position.y += Math.sin(u * Math.PI) * 0.35; }
    else marble.position.copy(boxP);
    sitara.rotation.y = f > 9.5 && f < 13 ? 0.6 : 0;
    H.updatePeople(dt, t);
  }
  return { update, dispose: H.dispose };
}

module.exports = { id: ZONE, build };
