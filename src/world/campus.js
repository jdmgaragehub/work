'use strict';
/**
 * ZEHN campus (A2). Builds the fictional "Indus Institute of Behavioural Sciences (IIBS), Hyderabad, Sindh —
 * Simulated institution": ground, the shaded Central Courtyard (60 × 60 m: neem trees, ajrak banners, brick jaali
 * screens, benches, fountain), paths to the nine zones, perimeter wall + gate, bilingual signposts, lamp posts, and
 * one THREE.Group per zone (positioned at the zone centre, rotated by its yaw) handed to `zones/<id>.js`.build(kit).
 *
 * Contract: docs/WORLD_API.md (A2). Everything procedural; geometry is merged (GeoBuilder) or instanced so the whole
 * campus stays well under ~400 draw calls at Medium. `world.dispose()` frees everything this module created.
 */
const THREE = require('three');
const layout = require('./layout.js');

let RngClass = null;
try { RngClass = require('../core/rng.js').Rng; } catch (e) { RngClass = null; }
function makeRng(seed) {
  if (RngClass) return new RngClass(seed);
  let a = 0x9e3779b9; const s = String(seed); for (let i = 0; i < s.length; i++) a = Math.imul(a ^ s.charCodeAt(i), 0x01000193);
  const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { random: next, next, uniform: (x = 0, y = 1) => x + (y - x) * next(), int: (x, y) => x + Math.floor(next() * (y - x + 1)), chance: (p) => next() < p };
}
function tryRequire(fn) { try { return fn(); } catch (e) { return null; } }

/* ============================================================ palette ("Indus Dusk") */
const PAL = {
  brick: 0xb0603f, brickDark: 0x8a4630, plaster: 0xeadfca, terrazzo: 0xd8d0c2, saffron: 0xe39b2d, crimson: 0x8f1d2c,
  indigo: 0x26346b, teal: 0x2f7d7a, wood: 0x8a5a36, woodDark: 0x5b3a22, metal: 0x5d6168, marble: 0xefe9de, leaf: 0x4f6d2c,
  bark: 0x5a4636, cream: 0xf6eedd, charcoal: 0x2b2a2e,
};
const FALLBACK = {
  brick: { color: 0xb0603f, roughness: 0.92 }, plaster: { color: 0xeadfca, roughness: 0.95 }, terrazzo: { color: 0xd8d0c2, roughness: 0.35 },
  wood: { color: 0x8a5a36, roughness: 0.7 }, glass: { color: 0xa9cbd8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32 },
  metal: { color: 0x8c9096, roughness: 0.35, metalness: 0.85 }, fabric: { color: 0x6b3a4a, roughness: 1 }, grass: { color: 0x5f7f3a, roughness: 1 },
  water: { color: 0x2f6f80, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.82 }, marble: { color: 0xefe9de, roughness: 0.3 },
  tiles: { color: 0xc9b49a, roughness: 0.6 }, carpet: { color: 0x7a2e3a, roughness: 1 }, chalkboard: { color: 0x2f3b33, roughness: 0.9 },
  jaali: { color: 0xb0603f, roughness: 0.9, alphaTest: 0.5, side: THREE.DoubleSide }, ajrak: { color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide },
};

/* ============================================================ procedural fallback textures */
function hasDOM() { return typeof document !== 'undefined' && !!document.createElement; }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function drawFallback(name) {
  if (!hasDOM()) return null;
  const S = 256; const c = canvas(S, S); const g = c.getContext('2d');
  if (name === 'brick') {
    g.fillStyle = '#cdb9a0'; g.fillRect(0, 0, S, S);
    const rows = 16, cols = 6, bh = S / rows, bw = S / cols;
    for (let r = 0; r < rows; r++) for (let k = -1; k < cols; k++) {
      const x = k * bw + (r % 2 ? bw / 2 : 0); const v = 0.85 + ((r * 7 + k * 13) % 9) / 40;
      g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(232 * v)},${Math.round(222 * v)})`; g.fillRect(x + 1.5, r * bh + 1.5, bw - 3, bh - 3);
    }
  } else if (name === 'terrazzo') {
    g.fillStyle = '#f2ede4'; g.fillRect(0, 0, S, S);
    const cols = ['#b9a58c', '#8f8170', '#d79b54', '#6f7f8f', '#a24f3e', '#ffffff'];
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 900; i++) { g.fillStyle = cols[i % cols.length]; const r = 0.6 + rnd() * 2.6; g.beginPath(); g.arc(rnd() * S, rnd() * S, r, 0, 7); g.fill(); }
  } else if (name === 'jaali') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'destination-out';
    const n = 4, cs = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const cx = i * cs + cs / 2, cy = j * cs + cs / 2; g.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const rr = k % 2 ? cs * 0.2 : cs * 0.42; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.beginPath(); g.arc(i * cs, j * cs, cs * 0.09, 0, 7); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  } else if (name === 'ajrak') {
    g.fillStyle = '#8f1d2c'; g.fillRect(0, 0, S, S); const n = 4, cs = S / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const cx = i * cs + cs / 2, cy = j * cs + cs / 2;
      g.fillStyle = '#1f2a5c'; g.beginPath(); g.moveTo(cx, cy - cs * 0.46); g.lineTo(cx + cs * 0.46, cy); g.lineTo(cx, cy + cs * 0.46); g.lineTo(cx - cs * 0.46, cy); g.fill();
      g.fillStyle = '#f3e7cf'; g.beginPath();
      for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const rr = k % 2 ? cs * 0.1 : cs * 0.26; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(cx, cy, cs * 0.06, 0, 7); g.fill();
      g.fillStyle = '#f3e7cf'; g.beginPath(); g.arc(i * cs, j * cs, cs * 0.05, 0, 7); g.fill();
    }
    g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, S - 3, S - 3);
  } else if (name === 'grass') {
    g.fillStyle = '#7f9a52'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 2500; i++) { const v = 90 + ((i * 37) % 70); g.fillStyle = `rgba(${v - 40},${v + 30},${v - 60},0.35)`; g.fillRect((i * 97) % S, (i * 61 + i * i) % S, 2, 3); }
  } else if (name === 'tiles') {
    g.fillStyle = '#b8a48a'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#e2d3bb' : '#d4c2a5'; g.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
  } else return null;
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/* ============================================================ GeoBuilder (merged, vertex-coloured, metre UVs) */
const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _n3 = new THREE.Matrix3(), _c = new THREE.Color();
const UNIT = new Map();
function unit(key, make) { let g = UNIT.get(key); if (!g) { g = make(); UNIT.set(key, g); } return g; }
const uBox = () => unit('box', () => new THREE.BoxGeometry(1, 1, 1));
const uCyl = (seg = 12) => unit('cyl' + seg, () => new THREE.CylinderGeometry(0.5, 0.5, 1, seg, 1));
const uCone = (seg = 12) => unit('cone' + seg, () => new THREE.CylinderGeometry(0, 0.5, 1, seg, 1));
const uSph = (seg = 12) => unit('sph' + seg, () => new THREE.SphereGeometry(0.5, seg, Math.max(6, seg >> 1)));

class GeoBuilder {
  constructor(opt = {}) { this.p = []; this.n = []; this.c = []; this.u = []; this.uvScale = opt.uvScale == null ? 0.5 : opt.uvScale; this.T = null; }
  get count() { return this.p.length / 3; }
  /** Set a transform applied to all following primitives (sub-assembly frame). */
  at(x = 0, y = 0, z = 0, ry = 0) { this.T = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)); return this; }
  reset() { this.T = null; return this; }
  _push(x, y, z, nx, ny, nz, u, v, col) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.u.push(u, v); this.c.push(col.r, col.g, col.b); }
  _wuv(x, y, z, nx, ny, nz) {
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), k = this.uvScale;
    if (ay >= ax && ay >= az) return [x * k, z * k]; if (ax >= az) return [z * k, y * k]; return [x * k, y * k];
  }
  add(geo, matrix, color = 0xffffff, keepUV = false) {
    const M = this.T ? _m2.multiplyMatrices(this.T, matrix) : matrix;
    const P = geo.attributes.position, N = geo.attributes.normal, U = geo.attributes.uv, I = geo.index;
    _n3.getNormalMatrix(M); const col = color && color.isColor ? color.clone() : new THREE.Color(color);
    const cnt = I ? I.count : P.count;
    for (let i = 0; i < cnt; i++) {
      const j = I ? I.getX(i) : i;
      _v.fromBufferAttribute(P, j).applyMatrix4(M);
      if (N) _w.fromBufferAttribute(N, j).applyMatrix3(_n3).normalize(); else _w.set(0, 1, 0);
      const uv = keepUV && U ? [U.getX(j), U.getY(j)] : this._wuv(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z);
      this._push(_v.x, _v.y, _v.z, _w.x, _w.y, _w.z, uv[0], uv[1], col);
    }
    return this;
  }
  /** Box with its BASE at y, optional yaw. */
  box(w, h, d, x, y, z, color, ry = 0) { _q.setFromEuler(_e.set(0, ry, 0)); _m.compose(_p.set(x, y + h / 2, z), _q, _s.set(w, h, d)); return this.add(uBox(), _m, color); }
  /** Box centred at (x,y,z) with full rotation. */
  boxC(w, h, d, x, y, z, color, rx = 0, ry = 0, rz = 0) { _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')); _m.compose(_p.set(x, y, z), _q, _s.set(w, h, d)); return this.add(uBox(), _m, color); }
  /** Cylinder (or frustum when rTop != rBot) with base at y. */
  cyl(rTop, rBot, h, x, y, z, color, seg = 12) {
    if (Math.abs(rTop - rBot) < 1e-6) { _m.compose(_p.set(x, y + h / 2, z), _q.identity(), _s.set(rBot * 2, h, rBot * 2)); return this.add(uCyl(seg), _m, color); }
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg, 1); _m.makeTranslation(x, y + h / 2, z); this.add(g, _m, color); g.dispose(); return this;
  }
  cone(r, h, x, y, z, color, seg = 12) { _m.compose(_p.set(x, y + h / 2, z), _q.identity(), _s.set(r * 2, h, r * 2)); return this.add(uCone(seg), _m, color); }
  sphere(r, x, y, z, color, seg = 12, sy = 1) { _m.compose(_p.set(x, y, z), _q.identity(), _s.set(r * 2, r * 2 * sy, r * 2)); return this.add(uSph(seg), _m, color); }
  /** Square-section beam between two points. */
  beam(a, b, w, color, h) {
    const A = Array.isArray(a) ? new THREE.Vector3(...a) : a, B = Array.isArray(b) ? new THREE.Vector3(...b) : b;
    const d = new THREE.Vector3().subVectors(B, A); const L = d.length(); if (L < 1e-6) return this;
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.multiplyScalar(1 / L));
    _m.compose(_p.addVectors(A, B).multiplyScalar(0.5), _q, _s.set(w, L, h == null ? w : h)); return this.add(uBox(), _m, color);
  }
  /** Round rod between two points. */
  rod(a, b, r, color, seg = 8) {
    const A = Array.isArray(a) ? new THREE.Vector3(...a) : a, B = Array.isArray(b) ? new THREE.Vector3(...b) : b;
    const d = new THREE.Vector3().subVectors(B, A); const L = d.length(); if (L < 1e-6) return this;
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.multiplyScalar(1 / L));
    _m.compose(_p.addVectors(A, B).multiplyScalar(0.5), _q, _s.set(r * 2, L, r * 2)); return this.add(uCyl(seg), _m, color);
  }
  /** Triangle with explicit (or world) UVs. Points are arrays or Vector3 (in the builder frame). */
  tri(a, b, c, color, uva, uvb, uvc) {
    const P = [a, b, c].map((q) => { const v = Array.isArray(q) ? new THREE.Vector3(q[0], q[1], q[2]) : q.clone(); return this.T ? v.applyMatrix4(this.T) : v; });
    const n = new THREE.Vector3().subVectors(P[1], P[0]).cross(new THREE.Vector3().subVectors(P[2], P[0])).normalize();
    const col = new THREE.Color(color); const uvs = [uva, uvb, uvc];
    for (let i = 0; i < 3; i++) { const uv = uvs[i] || this._wuv(P[i].x, P[i].y, P[i].z, n.x, n.y, n.z); this._push(P[i].x, P[i].y, P[i].z, n.x, n.y, n.z, uv[0], uv[1], col); }
    return this;
  }
  /** Quad a-b-c-d (counter-clockwise seen from the front). */
  quad(a, b, c, d, color, uvs) { const U = uvs || [null, null, null, null]; this.tri(a, b, c, color, U[0], U[1], U[2]); return this.tri(a, c, d, color, U[0], U[2], U[3]); }
  /** Convex hexahedron from 8 corners (0-3 bottom ring, 4-7 top ring). Faces auto-oriented outward. */
  hexa(C, color) {
    const V = C.map((q) => (Array.isArray(q) ? new THREE.Vector3(...q) : q));
    const ctr = V.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / 8);
    const F = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    for (const f of F) {
      const [a, b, c, d] = f.map((i) => V[i]);
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const fc = new THREE.Vector3().add(a).add(b).add(c).add(d).multiplyScalar(0.25).sub(ctr);
      if (n.dot(fc) >= 0) this.quad(a, b, c, d, color); else this.quad(a, d, c, b, color);
    }
    return this;
  }
  geometry() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
  /** Build a static mesh (or null when empty). */
  mesh(material, opt = {}) {
    const g = this.geometry(); if (!g) return null;
    const m = new THREE.Mesh(g, material); m.castShadow = opt.cast !== false; m.receiveShadow = opt.receive !== false;
    m.matrixAutoUpdate = false; m.updateMatrix(); if (opt.name) m.name = opt.name; return m;
  }
}

/* ============================================================ world */
function buildWorld(sim, engine) {
  sim = sim || { bus: { on() { return () => {}; }, emit() {} }, settings: {}, state: {}, services: {}, datasets: {} };
  sim.services = sim.services || {}; sim.settings = sim.settings || {}; sim.state = sim.state || {};
  const scene = (engine && engine.scene) || new THREE.Scene();
  const tier = (engine && engine.tier) || 'medium';
  const TIERF = { low: 0.5, medium: 0.8, high: 1, ultra: 1.2 }[tier] || 0.8;
  const root = new THREE.Group(); root.name = 'ZEHN.campus'; scene.add(root);
  const ownedMats = new Set(); const ownedTex = new Set(); const updaters = []; const nightMats = []; const people = []; const offs = [];

  /* ---------- materials / textures (engine library with local fallback) */
  let lib = (engine && (engine.mats || engine.materials)) || sim.services.mats || null;
  if (!lib || typeof lib.get !== 'function') {
    const M = tryRequire(() => require('../engine/materials.js'));
    if (M) {
      if (typeof M.get === 'function') lib = M;
      else if (M.mats && typeof M.mats.get === 'function') lib = M.mats;
      else if (typeof M.createMaterials === 'function') lib = tryRequire(() => M.createMaterials(THREE, engine, sim));
      else if (typeof M.MaterialLibrary === 'function') lib = tryRequire(() => new M.MaterialLibrary(THREE, engine, sim));
    }
  }
  let texLib = (engine && (engine.tex || engine.textures)) || null;
  if (!texLib) texLib = tryRequire(() => require('../engine/textures.js'));
  const fbCache = new Map();
  function fallbackMat(name) {
    if (fbCache.has(name)) return fbCache.get(name);
    const spec = Object.assign({ color: 0xcccccc, roughness: 0.8 }, FALLBACK[name] || {});
    const m = new THREE.MeshStandardMaterial(spec);
    const tex = drawFallback(name === 'jaali' ? 'jaali' : name);
    if (tex) {
      ownedTex.add(tex);
      if (name === 'jaali') { m.alphaMap = tex; m.alphaTest = 0.5; } else m.map = tex;
      if (name === 'brick' || name === 'terrazzo' || name === 'grass' || name === 'tiles' || name === 'ajrak') m.color.set(0xffffff);
      if (name === 'brick') m.color.set(0xd88a66);
    }
    m.name = 'fallback:' + name; ownedMats.add(m); fbCache.set(name, m); return m;
  }
  const mats = {
    get(name) {
      let m; try { m = lib && lib.get(name); } catch (e) { m = null; }
      return m || fallbackMat(name);
    },
  };
  const vcCache = new Map();
  /** Vertex-coloured variant of a library material (for merged GeoBuilder meshes). */
  function vc(name, extra) {
    const key = name + (extra ? JSON.stringify(extra) : '');
    if (vcCache.has(key)) return vcCache.get(key);
    const base = mats.get(name); const m = base.clone(); m.vertexColors = true;
    if (extra) for (const k of Object.keys(extra)) { if (k === 'color' || k === 'emissive') m[k] = new THREE.Color(extra[k]); else m[k] = extra[k]; }
    m.needsUpdate = true; ownedMats.add(m); vcCache.set(key, m); return m;
  }
  function stdMat(spec) { const m = new THREE.MeshStandardMaterial(spec); ownedMats.add(m); return m; }
  function basicMat(spec) { const m = new THREE.MeshBasicMaterial(spec); ownedMats.add(m); return m; }
  function canvasTex(w, h, draw, opt = {}) {
    if (!hasDOM()) return null;
    const c = canvas(w, h); const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = opt.srgb === false ? THREE.NoColorSpace : THREE.SRGBColorSpace; t.anisotropy = 4;
    if (opt.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    ownedTex.add(t); return t;
  }
  /** Register a material whose emissive intensity follows time of day. */
  function nightGlow(mat, levels) { nightMats.push({ mat, levels: Object.assign({ day: 0.15, dusk: 0.9, night: 2.2 }, levels || {}) }); return mat; }

  /* ---------- label3d: canvas text plane */
  const URF = '"Noto Nastaliq Urdu","Jameel Noori Nastaleeq","Noto Naskh Arabic","Segoe UI","Tahoma",serif';
  const ENF = '"Segoe UI","Noto Sans","Helvetica Neue",Arial,sans-serif';
  const isRTL = (s) => /[؀-ۿ]/.test(s);
  function drawLabel(text, o) {
    const fp = o.fontPx || 64; const pad = o.pad == null ? Math.round(fp * 0.45) : o.pad;
    const raw = String(text).split('\n'); const lines = [];
    const meas = canvas(8, 8).getContext('2d');
    raw.forEach((l, i) => {
      const size = Math.round((i === 0 || raw.length === 1 || o.uniform ? 1 : (o.subScale || 0.66)) * fp);
      const font = `${i === 0 && o.bold !== false ? '700' : '500'} ${size}px ${isRTL(l) ? URF : ENF}`;
      meas.font = font;
      if (o.wrapPx) {
        let cur = '';
        for (const word of l.split(' ')) { const tst = cur ? cur + ' ' + word : word; if (meas.measureText(tst).width > o.wrapPx && cur) { lines.push({ t: cur, font, size }); cur = word; } else cur = tst; }
        lines.push({ t: cur, font, size });
      } else lines.push({ t: l, font, size });
    });
    let W = 0; for (const L of lines) { meas.font = L.font; L.w = meas.measureText(L.t).width; W = Math.max(W, L.w); }
    W = Math.min(4096, Math.ceil((o.minWidthPx ? Math.max(o.minWidthPx, W) : W) + pad * 2));
    const H = Math.ceil(lines.reduce((s, L) => s + L.size * (isRTL(L.t) ? 1.55 : 1.25), 0) + pad * 2);
    const c = canvas(W, H); const g = c.getContext('2d');
    if (o.bg !== 'none') {
      g.fillStyle = o.bg || 'rgba(24,20,38,0.88)'; const r = Math.min(24, pad);
      g.beginPath(); g.moveTo(r, 0); g.arcTo(W, 0, W, H, r); g.arcTo(W, H, 0, H, r); g.arcTo(0, H, 0, 0, r); g.arcTo(0, 0, W, 0, r); g.fill();
      if (o.border !== false) { g.strokeStyle = o.border || '#e39b2d'; g.lineWidth = Math.max(3, fp * 0.07); g.stroke(); }
    }
    let y = pad;
    for (const L of lines) {
      const lh = L.size * (isRTL(L.t) ? 1.55 : 1.25); g.font = L.font; g.textBaseline = 'middle';
      g.fillStyle = L === lines[0] ? (o.color || '#f6eedd') : (o.subColor || o.color || '#e9dcc0');
      const al = o.align || 'center'; g.direction = isRTL(L.t) ? 'rtl' : 'ltr'; g.textAlign = al === 'center' ? 'center' : (isRTL(L.t) ? 'right' : (al === 'left' ? 'left' : 'right'));
      const x = al === 'center' ? W / 2 : (g.textAlign === 'left' ? pad : W - pad);
      g.fillText(L.t, x, y + lh / 2); y += lh;
    }
    return { c, W, H, fp };
  }
  function label3d(text, o = {}) {
    const mat = basicMat({ transparent: true, side: o.doubleSide ? THREE.DoubleSide : THREE.FrontSide, depthWrite: o.bg !== 'none', toneMapped: false, fog: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.name = 'label:' + String(text).split('\n')[0].slice(0, 32);
    mesh.castShadow = false; mesh.receiveShadow = false;
    const set = (t) => {
      if (!hasDOM()) return;
      const d = drawLabel(t, o); const tex = new THREE.CanvasTexture(d.c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      if (mat.map) { ownedTex.delete(mat.map); mat.map.dispose(); }
      mat.map = tex; ownedTex.add(tex); mat.needsUpdate = true;
      const mpp = (o.size || 0.25) / d.fp; let w = d.W * mpp, h = d.H * mpp;
      if (o.maxWidth && w > o.maxWidth) { h *= o.maxWidth / w; w = o.maxWidth; }
      mesh.geometry.dispose(); mesh.geometry = new THREE.PlaneGeometry(w, h); mesh.userData.w = w; mesh.userData.h = h;
    };
    set(text); mesh.userData.setText = set; mesh.userData.text = text;
    if (o.billboard) mesh.onBeforeRender = (r, s, cam) => { mesh.quaternion.copy(cam.quaternion); };
    return mesh;
  }

  /* ---------- world object */
  const world = {
    root, zones: {}, colliders: [], interactables: [], focusTargets: {}, minimap: [], handles: {}, layout,
    GeoBuilder, PAL, label3d, mats, timeOfDay: sim.state.timeOfDay || 'day',
  };
  sim.services.world = sim.services.world || world;
  const camera = () => (engine && engine.camera) || null;

  /* ---------- shared actions */
  const act = {
    toast(msg) { const ui = sim.services.ui; if (ui && ui.toast) ui.toast(msg); else if (typeof console !== 'undefined') console.info('[ZEHN]', msg); },
    panel(id) { const ui = sim.services.ui; if (ui && ui.openPanel) ui.openPanel(id); else act.toast('Panel “' + id + '” is not available yet.'); },
    run(pid) { const r = sim.services.runner; if (r && r.run) r.run(pid); else act.toast('Paradigm “' + pid + '” is not available yet.'); },
    irb() { const d = sim.services.director; if (d && d.presentIRB) d.presentIRB(); else act.panel('irb'); },
    motionOK() { return !sim.settings.photosafe && !sim.settings.reducedMotion; },
  };

  /* ---------- collider helpers */
  const CHUNK = 1.2;
  function pushWorldBox(group, min, max) {
    const b = new THREE.Box3(); const pts = [];
    for (let i = 0; i < 8; i++) pts.push(new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(group.matrixWorld));
    b.setFromPoints(pts); world.colliders.push(b); return b;
  }
  function addColliderIn(group, axisAligned, min, max) {
    const mn = Array.isArray(min) ? new THREE.Vector3(...min) : min.clone(), mx = Array.isArray(max) ? new THREE.Vector3(...max) : max.clone();
    if (axisAligned) return [pushWorldBox(group, mn, mx)];
    const nx = Math.max(1, Math.ceil((mx.x - mn.x) / CHUNK)), nz = Math.max(1, Math.ceil((mx.z - mn.z) / CHUNK)); const out = [];
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      out.push(pushWorldBox(group, new THREE.Vector3(mn.x + (mx.x - mn.x) * i / nx, mn.y, mn.z + (mx.z - mn.z) * k / nz),
        new THREE.Vector3(mn.x + (mx.x - mn.x) * (i + 1) / nx, mx.y, mn.z + (mx.z - mn.z) * (k + 1) / nz)));
    }
    return out;
  }
  /** Collider along an arbitrary local line (diagonal walls): chunked boxes. */
  function lineCollider(group, axisAligned, x1, z1, x2, z2, t, h, y0 = 0) {
    const L = Math.hypot(x2 - x1, z2 - z1); const n = Math.max(1, Math.ceil(L / 0.8)); const out = [];
    for (let i = 0; i < n; i++) {
      const a = i / n, b = (i + 1) / n; const ax = x1 + (x2 - x1) * a, az = z1 + (z2 - z1) * a, bx = x1 + (x2 - x1) * b, bz = z1 + (z2 - z1) * b;
      out.push(...addColliderIn(group, true, [Math.min(ax, bx) - t / 2, y0, Math.min(az, bz) - t / 2], [Math.max(ax, bx) + t / 2, y0 + h, Math.max(az, bz) + t / 2]));
    }
    return out;
  }

  /* ---------- figures (humanoid if available, else an abstract mannequin) */
  const humanoidMod = tryRequire(() => require('../people/humanoid.js'));
  const crowdMod = tryRequire(() => require('../people/crowd.js'));
  function mannequin(o = {}) {
    const g = new THREE.Group(); const h = o.height || 1.7; const s = h / 1.7;
    const gb = new GeoBuilder(); const body = o.color || PAL.indigo, skin = o.skin || 0xb08463, acc = o.accent || PAL.saffron;
    gb.cyl(0.07 * s, 0.08 * s, 0.82 * s, -0.1 * s, 0, 0, o.legs || PAL.charcoal, 8); gb.cyl(0.07 * s, 0.08 * s, 0.82 * s, 0.1 * s, 0, 0, o.legs || PAL.charcoal, 8);
    gb.cyl(0.17 * s, 0.22 * s, 0.62 * s, 0, 0.8 * s, 0, body, 12); gb.cyl(0.25 * s, 0.17 * s, 0.25 * s, 0, 0.82 * s, 0, body, 12);
    gb.sphere(0.2 * s, 0, 1.38 * s, 0, body, 12, 0.6);
    gb.rod([-0.22 * s, 1.36 * s, 0], [-0.27 * s, 0.86 * s, 0.05 * s], 0.05 * s, body); gb.rod([0.22 * s, 1.36 * s, 0], [0.27 * s, 0.86 * s, 0.05 * s], 0.05 * s, body);
    gb.cyl(0.05 * s, 0.05 * s, 0.1 * s, 0, 1.44 * s, 0, skin, 8); gb.sphere(0.115 * s, 0, 1.6 * s, 0, skin, 14, 1.15);
    gb.box(0.36 * s, 0.05 * s, 0.03 * s, 0, 1.12 * s, 0.17 * s, acc);
    const m = gb.mesh(vc('fabric', { color: 0xffffff })); g.add(m); g.userData.abstract = true; return g;
  }
  function figure(parent, o = {}) {
    let person = null;
    if (!o.abstract && humanoidMod && typeof humanoidMod.createHumanoid === 'function') {
      person = tryRequire(() => humanoidMod.createHumanoid(THREE, { lookIndex: o.lookIndex || 0, height: o.height || 1.7, outfit: o.outfit, tier, name: o.name }));
    }
    let obj;
    if (person && person.group) { obj = person.group; if (o.pose && person.setPose) tryRequire(() => person.setPose(o.pose)); people.push({ person, obj }); } else obj = mannequin(o);
    obj.position.set(o.x || 0, o.y || 0, o.z || 0); obj.rotation.y = o.ry || 0; parent.add(obj);
    return { obj, person };
  }

  /* ---------- shell: a building envelope in zone-local coords (entrance on +Z) */
  function makeShell(kit, o = {}) {
    const w = o.w || 36, d = o.d || 36, h = o.h || 8, cz = o.cz || 0, door = o.door || 6, doorH = o.doorH || 4.2, t = 0.35;
    const brick = new GeoBuilder({ uvScale: 0.5 }), plaster = new GeoBuilder(), floor = new GeoBuilder({ uvScale: 0.25 }), glass = new GeoBuilder(), trim = new GeoBuilder(), wood = new GeoBuilder();
    const x0 = -w / 2, x1 = w / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    floor.box(w, 0.12, d, 0, -0.11, cz, o.floorColor || 0xffffff);
    if (o.floorInlay !== false) { // saffron & indigo inlay border
      floor.box(w - 3, 0.005, 0.25, 0, 0.012, z0 + 1.5, PAL.saffron); floor.box(w - 3, 0.005, 0.25, 0, 0.012, z1 - 1.5, PAL.saffron);
      floor.box(0.25, 0.005, d - 3, x0 + 1.5, 0.012, cz, PAL.saffron); floor.box(0.25, 0.005, d - 3, x1 - 1.5, 0.012, cz, PAL.saffron);
    }
    const winStep = o.winStep || 6, winW = o.winW || 3.2, sill = 1.1, head = Math.min(h - 1.2, 3.6);
    function run(ax, az, bx, bz, openings) {
      const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, ry = Math.atan2(-dz, dx);
      const nx = -dz, nz = dx; // inward normal for runs listed clockwise
      const piece = (s0, s1, y0, y1) => {
        if (s1 - s0 < 0.02 || y1 - y0 < 0.02) return;
        const mid = (s0 + s1) / 2, cx = ax + dx * mid, czz = az + dz * mid;
        brick.box(s1 - s0, y1 - y0, t, cx - nx * 0.04, y0, czz - nz * 0.04, 0xffffff, ry);
        plaster.box(s1 - s0, y1 - y0, 0.04, cx + nx * (t / 2 + 0.02), y0, czz + nz * (t / 2 + 0.02), o.innerColor || 0xffffff, ry);
        if (y0 < 2.2) {
          const ex = Math.abs(dx) > 0.5 ? (s1 - s0) / 2 : t / 2 + 0.05, ez = Math.abs(dx) > 0.5 ? t / 2 + 0.05 : (s1 - s0) / 2;
          kit.addCollider([cx - ex, 0, czz - ez], [cx + ex, Math.min(y1, 3), czz + ez]);
        }
      };
      const ops = (openings || []).slice().sort((p, q) => p.c - q.c); let s = 0;
      for (const op of ops) {
        const a = op.c - op.w / 2, b = op.c + op.w / 2; piece(s, a, 0, h); piece(a, b, 0, op.y0); piece(a, b, op.y1, h);
        if (op.glass) { const mid = op.c, cx = ax + dx * mid, czz = az + dz * mid; glass.box(op.w, op.y1 - op.y0, 0.04, cx, op.y0, czz, 0xffffff, ry); trim.box(op.w + 0.2, 0.08, t + 0.12, cx, op.y0 - 0.08, czz, PAL.marble, ry); for (let m = 1; m < Math.round(op.w / 1.1); m++) trim.box(0.06, op.y1 - op.y0, 0.1, cx + dx * (-op.w / 2 + m * op.w / Math.round(op.w / 1.1)), op.y0, czz + dz * (-op.w / 2 + m * op.w / Math.round(op.w / 1.1)), PAL.woodDark, ry); }
        s = b;
      }
      piece(s, L, 0, h);
    }
    const winOps = (L, skip) => { if (o.windows === false) return []; const out = []; const n = Math.floor((L - 4) / winStep); const start = (L - (n - 1) * winStep) / 2; for (let i = 0; i < n; i++) { const c = start + i * winStep; if (skip && skip(c)) continue; out.push({ c, w: winW, y0: sill, y1: head, glass: true }); } return out; };
    // clockwise seen from above starting at front-left: front (x0→x1 at z1) has the door
    const frontOps = [{ c: w / 2, w: door, y0: doorH, y1: doorH + 0.001 }].concat(o.frontWindows === false ? [] : winOps(w, (c) => Math.abs(c - w / 2) < door / 2 + winW / 2 + 0.6));
    frontOps[0].y0 = doorH; frontOps[0].y1 = doorH; // door: no lower piece
    run(x0, z1, x1, z1, frontOps.map((op, i) => (i === 0 ? { c: op.c, w: op.w, y0: 0, y1: doorH } : op)));
    run(x1, z1, x1, z0, winOps(d, o.skipRight));
    run(x1, z0, x0, z0, o.backWindows === false ? [] : winOps(w, o.skipBack));
    run(x0, z0, x0, z1, winOps(d, o.skipLeft));
    // plinth + cornice bands (exterior)
    trim.box(w + 0.5, 0.45, 0.12, 0, 0, z1 + 0.2, PAL.brickDark); trim.box(w + 0.5, 0.45, 0.12, 0, 0, z0 - 0.2, PAL.brickDark);
    trim.box(0.12, 0.45, d + 0.5, x0 - 0.2, 0, cz, PAL.brickDark); trim.box(0.12, 0.45, d + 0.5, x1 + 0.2, 0, cz, PAL.brickDark);
    trim.box(w + 0.8, 0.35, d + 0.8, 0, h, cz, PAL.plaster); // roof edge slab ring (top band)
    // roof
    const band = o.roofBand || 4.5;
    if (o.roof === 'solid') trim.box(w, 0.3, d, 0, h - 0.3, cz, PAL.plaster);
    else {
      trim.box(w, 0.3, band, 0, h - 0.3, z0 + band / 2, PAL.plaster); trim.box(w, 0.3, band, 0, h - 0.3, z1 - band / 2, PAL.plaster);
      trim.box(band, 0.3, d - band * 2, x0 + band / 2, h - 0.3, cz, PAL.plaster); trim.box(band, 0.3, d - band * 2, x1 - band / 2, h - 0.3, cz, PAL.plaster);
      for (let x = x0 + band + 3; x < x1 - band; x += 3) wood.box(0.25, 0.5, d - band * 2, x, h - 0.5, cz, PAL.woodDark);
      glass.box(w - band * 2, 0.04, d - band * 2, 0, h + 0.05, cz, 0xffffff);
    }
    // parapet
    brick.box(w + 0.8, 0.9, 0.3, 0, h + 0.35, z1 + 0.25); brick.box(w + 0.8, 0.9, 0.3, 0, h + 0.35, z0 - 0.25);
    brick.box(0.3, 0.9, d + 0.8, x0 - 0.25, h + 0.35, cz); brick.box(0.3, 0.9, d + 0.8, x1 + 0.25, h + 0.35, cz);
    // entrance canopy, columns, door frame
    trim.box(door + 5, 0.3, 3.2, 0, doorH + 0.5, z1 + 1.6, PAL.marble);
    for (const sx of [-1, 1]) { trim.cyl(0.22, 0.26, doorH + 0.5, sx * (door / 2 + 2), 0, z1 + 2.8, PAL.marble, 14); }
    wood.box(0.25, doorH, t + 0.2, -door / 2, 0, z1, PAL.woodDark); wood.box(0.25, doorH, t + 0.2, door / 2, 0, z1, PAL.woodDark); wood.box(door + 0.5, 0.3, t + 0.2, 0, doorH, z1, PAL.woodDark);
    floor.box(door + 4, 0.18, 3.4, 0, -0.04, z1 + 1.7, PAL.terrazzo);
    // interior light strips (glow at night)
    const lights = new GeoBuilder();
    for (const zz of [z0 + band / 2, z1 - band / 2]) lights.box(w - band * 2, 0.06, 0.35, 0, h - 0.38, zz, 0xffffff);
    const add = (gb, mat, opt) => { const m = gb.mesh(mat, opt); if (m) kit.group.add(m); return m; };
    const out = {
      brick: add(brick, vc('brick')), plaster: add(plaster, vc('plaster')), floor: add(floor, vc(o.floorMat || 'terrazzo'), { cast: false }),
      glass: add(glass, vc('glass'), { cast: false }), trim: add(trim, vc('marble')), wood: add(wood, vc('wood')),
      lights: add(lights, nightGlow(stdMat({ color: 0xfff2dc, emissive: 0xffd9a0, emissiveIntensity: 0.4 }), { day: 0.4, dusk: 1.2, night: 2.0 }), { cast: false }),
    };
    if (out.floor) { out.floor.userData.ssr = true; out.floor.userData.floor = true; }
    // ajrak frieze above the canopy
    const fr = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, 0.7), mats.get('ajrak')); fr.position.set(0, h - 0.9, z1 + 0.2); kit.group.add(fr);
    if (o.title !== false) {
      const nm = layout.NAMES[kit.id] || [kit.id, ''];
      const lab = label3d(nm[0] + '\n' + nm[1], { size: 0.62, bg: 'rgba(38,52,107,0.92)', maxWidth: w * 0.6 }); lab.position.set(0, doorH + 1.9, z1 + 0.24); kit.group.add(lab);
    }
    out.bounds = { x0, x1, z0, z1, h }; return out;
  }

  /* ---------- kit factory */
  function makeKit(id, group, detail, axisAligned) {
    const zone = world.zones[id];
    const kit = {
      THREE, sim, engine, group, detail, id, zone, mats, tex: texLib, tier, layout, PAL,
      rng: makeRng('iibs-' + id + '-' + (sim.seed || 'zehn')),
      people: humanoidMod, crowd: crowdMod,
      addCollider(min, max) { return addColliderIn(group, axisAligned, min, max); },
      addColliderBox(x, y, z, w, h, d) { return addColliderIn(group, axisAligned, [x - w / 2, y, z - d / 2], [x + w / 2, y + h, z + d / 2]); },
      addLineCollider(x1, z1, x2, z2, t = 0.3, h = 3, y0 = 0) { return lineCollider(group, axisAligned, x1, z1, x2, z2, t, h, y0); },
      addInteractable(it) {
        const lp = Array.isArray(it.pos) ? new THREE.Vector3(...it.pos) : (it.pos ? it.pos.clone() : new THREE.Vector3());
        const wp = lp.clone().applyMatrix4(group.matrixWorld);
        const rec = { id: (it.id && it.id.indexOf(':') >= 0) ? it.id : id + ':' + (it.id || ('i' + world.interactables.length)), zone: id, pos: wp, radius: it.radius || 2, label: it.label || it.id, onUse: it.onUse || (() => {}), kind: it.kind, ref: it.ref };
        world.interactables.push(rec); return rec;
      },
      anchor(name, local) { const v = (Array.isArray(local) ? new THREE.Vector3(...local) : local.clone()).applyMatrix4(group.matrixWorld); zone.anchors[name] = v; return v; },
      label3d,
      toWorld(local) { return (Array.isArray(local) ? new THREE.Vector3(...local) : local.clone()).applyMatrix4(group.matrixWorld); },
      worldYaw(localYaw) { return zone.yaw + (localYaw || 0); },
      /** Teleport the player to a local pose (yaw 0 = looking toward local −Z). */
      teleportLocal(local, localYaw) {
        const p = kit.toWorld(local); const yaw = kit.worldYaw(localYaw);
        const c = sim.services.controls;
        if (c && c.teleport) c.teleport({ pos: [p.x, p.y, p.z], yaw });
        else { const cam = camera(); if (cam) { cam.position.copy(p); cam.rotation.set(0, yaw, 0, 'YXZ'); } }
      },
      act,
      util: { GeoBuilder, vc, stdMat, basicMat, canvasTex, nightGlow, figure, mannequin, shell: (o) => makeShell(kit, o), PAL, motionOK: act.motionOK, track(m) { ownedMats.add(m); return m; }, trackTex(t) { ownedTex.add(t); return t; } },
    };
    return kit;
  }

  /* ---------- zones list + groups */
  world.zones.courtyard = { id: 'courtyard', name: layout.NAMES.courtyard[0], ur: layout.NAMES.courtyard[1], center: new THREE.Vector3(0, 0, 0), yaw: 0, anchors: {} };
  world.minimap.push({ id: 'courtyard', x: 0, z: 0, name: layout.NAMES.courtyard[0], ur: layout.NAMES.courtyard[1] });
  for (const id of layout.ORDER) {
    const Z = layout.ZONES[id];
    world.zones[id] = { id, name: Z.name, ur: Z.ur, center: new THREE.Vector3(...Z.center), yaw: Z.yaw, anchors: {} };
    world.minimap.push({ id, x: Z.center[0], z: Z.center[2], name: Z.name, ur: Z.ur });
  }

  /* ============================================================ courtyard & grounds */
  const cyKit = makeKit('courtyard', root, root, true);
  buildGrounds(cyKit);

  function buildGrounds(kit) {
    const rng = makeRng('iibs-grounds');
    const G = root;
    // --- ground disc
    const groundGeo = new THREE.CircleGeometry(320, 96); groundGeo.rotateX(-Math.PI / 2);
    const uv = groundGeo.attributes.uv; const pos = groundGeo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 0.25, pos.getZ(i) * 0.25);
    const ground = new THREE.Mesh(groundGeo, mats.get('grass')); ground.position.y = -0.03; ground.receiveShadow = true; ground.name = 'ground'; ground.userData.floor = true;
    G.add(ground);

    const terr = new GeoBuilder({ uvScale: 0.25 }), brick = new GeoBuilder(), pave = new GeoBuilder({ uvScale: 0.5 }), metal = new GeoBuilder(), wood = new GeoBuilder();
    const marble = new GeoBuilder(), jaali = new GeoBuilder({ uvScale: 0.6 }), ajrak = new GeoBuilder(), bark = new GeoBuilder();
    // --- plaza
    terr.box(60, 0.08, 60, 0, -0.07, 0, 0xffffff);
    for (let r = 0; r < 3; r++) { // concentric inlay rings around the fountain
      const R = 7 + r * 3.2; const n = 48;
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; terr.box(0.35, 0.004, R * Math.PI * 2 / n + 0.05, Math.sin(a) * R, 0.011, Math.cos(a) * R, r === 1 ? PAL.indigo : PAL.saffron, a + Math.PI / 2); }
    }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; terr.box(0.3, 0.004, 9, Math.sin(a) * 11.5, 0.012, Math.cos(a) * 11.5, PAL.crimson, a); }
    terr.box(61, 0.1, 1.2, 0, -0.06, 30.4, PAL.brickDark); terr.box(61, 0.1, 1.2, 0, -0.06, -30.4, PAL.brickDark);
    terr.box(1.2, 0.1, 61, 30.4, -0.06, 0, PAL.brickDark); terr.box(1.2, 0.1, 61, -30.4, -0.06, 0, PAL.brickDark);

    // --- paths
    const pathEnds = [];
    for (const id of layout.ORDER) {
      const c = layout.ZONES[id].center; const L = Math.hypot(c[0], c[2]); const dx = c[0] / L, dz = c[2] / L;
      const r0 = 30 / Math.max(Math.abs(dx), Math.abs(dz)), r1 = L - 19.5; const len = r1 - r0, mid = (r0 + r1) / 2, ry = Math.atan2(dx, dz);
      pave.box(5, 0.06, len, dx * mid, -0.05, dz * mid, 0xffffff, ry);
      brick.box(0.3, 0.12, len, dx * mid + Math.cos(ry) * 2.65, -0.06, dz * mid - Math.sin(ry) * 2.65, PAL.brickDark, ry);
      brick.box(0.3, 0.12, len, dx * mid - Math.cos(ry) * 2.65, -0.06, dz * mid + Math.sin(ry) * 2.65, PAL.brickDark, ry);
      pathEnds.push({ id, dx, dz, r0, r1, ry });
    }
    // gate avenue (south, +Z)
    pave.box(7, 0.06, 86, 0, -0.05, 73, 0xffffff); brick.box(0.3, 0.12, 86, 3.65, -0.06, 73, PAL.brickDark); brick.box(0.3, 0.12, 86, -3.65, -0.06, 73, PAL.brickDark);
    pathEnds.push({ id: 'gate', dx: 0, dz: 1, r0: 30, r1: 116, ry: 0 });
    // ring promenade linking the zone fronts
    const RR = 54; const segs = 72;
    for (let i = 0; i < segs; i++) { const a0 = (i / segs) * Math.PI * 2, a1 = ((i + 1) / segs) * Math.PI * 2, am = (a0 + a1) / 2; pave.box(3.2, 0.055, RR * (a1 - a0) + 0.1, Math.sin(am) * RR, -0.052, -Math.cos(am) * RR, 0xe8d8c0, -am); }
    const onPath = (x, z, margin) => {
      for (const p of pathEnds) { const t = x * p.dx + z * p.dz; if (t > p.r0 - 2 && t < p.r1 + 2) { const off = Math.abs(-x * p.dz + z * p.dx); if (off < margin + (p.id === 'gate' ? 3.5 : 2.5)) return true; } }
      const r = Math.hypot(x, z); return Math.abs(r - RR) < margin + 1.6;
    };
    const inZone = (x, z, m) => layout.ORDER.some((id) => { const c = layout.ZONES[id].center; return Math.max(Math.abs(x - c[0]), Math.abs(z - c[2])) < 21 + m && Math.hypot(x - c[0], z - c[2]) < 29 + m; });

    // --- seat walls around the plaza edge with gaps at paths
    const gaps = { N: [], S: [], E: [], W: [] };
    for (const p of pathEnds) { const ax = Math.abs(p.dx), az = Math.abs(p.dz); const t = 30 / Math.max(ax, az); if (az >= ax) gaps[p.dz < 0 ? 'N' : 'S'].push(p.dx * t); else gaps[p.dx > 0 ? 'E' : 'W'].push(p.dz * t); }
    const side = (key, fixed, horiz) => {
      const gs = gaps[key].slice().sort((a, b) => a - b); let s = -29.5;
      const seg = (a, b) => { if (b - a < 0.6) return; const m = (a + b) / 2, L = b - a; if (horiz) { brick.box(L, 0.5, 0.6, m, 0, fixed, 0xffffff); marble.box(L, 0.06, 0.7, m, 0.5, fixed, PAL.marble); kit.addCollider([a, 0, fixed - 0.3], [b, 0.6, fixed + 0.3]); } else { brick.box(0.6, 0.5, L, fixed, 0, m, 0xffffff); marble.box(0.7, 0.06, L, fixed, 0.5, m, PAL.marble); kit.addCollider([fixed - 0.3, 0, a], [fixed + 0.3, 0.6, b]); } };
      for (const g of gs) { seg(s, g - 3.6); s = g + 3.6; } seg(s, 29.5);
    };
    side('N', -29.6, true); side('S', 29.6, true); side('E', 29.6, false); side('W', -29.6, false);

    // --- jaali screens: L-shaped corner screens framed by brick piers
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = sx * 25, cz = sz * 25;
      for (const along of ['x', 'z']) {
        for (let k = 0; k < 2; k++) {
          const off = 1.8 + k * 3.1; const x = along === 'x' ? cx - sx * off : cx, z = along === 'z' ? cz - sz * off : cz;
          if (along === 'x') { jaali.box(2.9, 2.5, 0.12, x, 0.35, z, 0xffffff); kit.addCollider([x - 1.5, 0, z - 0.15], [x + 1.5, 2.8, z + 0.15]); } else { jaali.box(0.12, 2.5, 2.9, x, 0.35, z, 0xffffff); kit.addCollider([x - 0.15, 0, z - 1.5], [x + 0.15, 2.8, z + 1.5]); }
        }
        for (let k = 0; k < 3; k++) { const off = 0.25 + k * 3.1; const x = along === 'x' ? cx - sx * off : cx, z = along === 'z' ? cz - sz * off : cz; brick.box(0.5, 3.1, 0.5, x, 0, z); marble.box(0.62, 0.12, 0.62, x, 3.1, z, PAL.marble); }
        if (along === 'x') brick.box(6.6, 0.35, 0.3, cx - sx * 3.35, 0, cz); else brick.box(0.3, 0.35, 6.6, cx, 0, cz - sz * 3.35);
        if (along === 'x') brick.box(6.6, 0.25, 0.3, cx - sx * 3.35, 2.85, cz); else brick.box(0.3, 0.25, 6.6, cx, 2.85, cz - sz * 3.35);
      }
    }

    // --- fountain
    const FR = 4.4;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; const L = 2 * FR * Math.tan(Math.PI / 8) + 0.05; brick.box(L, 0.55, 0.55, Math.sin(a) * FR, 0, Math.cos(a) * FR, 0xffffff, a); marble.box(L + 0.1, 0.08, 0.7, Math.sin(a) * FR, 0.55, Math.cos(a) * FR, PAL.marble, a); }
    marble.cyl(0.9, 1.1, 0.5, 0, 0, 0, PAL.marble, 20); marble.cyl(0.32, 0.45, 1.3, 0, 0.5, 0, PAL.marble, 16); marble.cyl(1.5, 0.35, 0.3, 0, 1.6, 0, PAL.marble, 24);
    marble.cyl(0.18, 0.25, 0.7, 0, 1.9, 0, PAL.marble, 12); marble.cyl(0.8, 0.2, 0.22, 0, 2.55, 0, PAL.marble, 20); marble.sphere(0.16, 0, 2.95, 0, PAL.saffron, 12);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; terr.box(0.9, 0.006, 0.9, Math.sin(a) * 5.4, 0.013, Math.cos(a) * 5.4, PAL.indigo, a + Math.PI / 4); }
    kit.addCollider([-4.8, 0, -4.8], [4.8, 0.7, 4.8]);
    const waterGeo = new THREE.CircleGeometry(FR - 0.15, 8); waterGeo.rotateX(-Math.PI / 2); waterGeo.rotateY(Math.PI / 8);
    const water = new THREE.Mesh(waterGeo, mats.get('water')); water.position.y = 0.42; water.receiveShadow = true; G.add(water);
    const bowl = new THREE.Mesh(new THREE.CircleGeometry(1.35, 24).rotateX(-Math.PI / 2), mats.get('water')); bowl.position.y = 1.86; G.add(bowl);
    const jetMat = stdMat({ color: 0xcfeaf2, transparent: true, opacity: 0.45, roughness: 0.05, emissive: 0x5f8fa0, emissiveIntensity: 0.25, depthWrite: false });
    const jets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.06, 1, 6, 1, true), jetMat, 9); jets.castShadow = false;
    const jetBase = [];
    for (let i = 0; i < 9; i++) { const a = (i / 8) * Math.PI * 2; const r = i === 8 ? 0 : 2.6; jetBase.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, h: i === 8 ? 1.2 : 1.1, y: i === 8 ? 3.05 : 0.42, ph: i * 0.7 }); }
    G.add(jets);
    const _jm = new THREE.Matrix4();
    const setJets = (t) => { for (let i = 0; i < 9; i++) { const j = jetBase[i]; const hh = j.h * (act.motionOK() ? 0.85 + 0.15 * Math.sin(t * 2.2 + j.ph) : 1); _jm.compose(_p.set(j.x, j.y + hh / 2, j.z), _q.identity(), _s.set(1, hh, 1)); jets.setMatrixAt(i, _jm); } jets.instanceMatrix.needsUpdate = true; };
    setJets(0); updaters.push((dt, t) => setJets(t));
    const fLight = new THREE.PointLight(0xffc27a, 0, 26, 1.6); fLight.position.set(0, 4, 0); G.add(fLight);
    world._fountainLight = fLight;

    // --- benches
    const bench = (x, z, ry) => {
      const c = Math.cos(ry), s = Math.sin(ry); const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
      for (let k = 0; k < 3; k++) { const [px, pz] = P(0, -0.15 + k * 0.16); wood.box(1.9, 0.05, 0.13, px, 0.44, pz, PAL.wood, ry); }
      for (let k = 0; k < 2; k++) { const [px, pz] = P(0, -0.27); wood.box(1.9, 0.11, 0.04, px, 0.62 + k * 0.17, pz, PAL.wood, ry); }
      for (const lx of [-0.8, 0.8]) { const [px, pz] = P(lx, 0); metal.box(0.06, 0.44, 0.5, px, 0, pz, PAL.metal, ry); const [bx, bz] = P(lx, -0.27); metal.box(0.05, 0.5, 0.05, bx, 0.44, bz, PAL.metal, ry); }
      const ex = Math.abs(c) * 1 + Math.abs(s) * 0.3, ez = Math.abs(s) * 1 + Math.abs(c) * 0.3; kit.addCollider([x - ex, 0, z - ez], [x + ex, 0.9, z + ez]);
    };
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; bench(Math.sin(a) * 8.6, Math.cos(a) * 8.6, a + Math.PI); }

    // --- neem trees (instanced leaf clusters) + planters
    const trees = [];
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; trees.push({ x: Math.sin(a) * 18.5, z: Math.cos(a) * 18.5, s: 1.05, planter: true }); }
    for (const [x, z] of [[-14, 25], [14, 25], [-25, 13], [25, 13], [-25, -13], [25, -13], [-14, -25], [14, -25]]) trees.push({ x, z, s: 0.85, planter: true });
    let tries = 0; const want = Math.round(46 * TIERF);
    while (trees.length < 16 + want && tries++ < 4000) {
      const a = rng.uniform(0, Math.PI * 2), r = rng.uniform(34, 111); const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (Math.max(Math.abs(x), Math.abs(z)) < 33 || onPath(x, z, 2.5) || inZone(x, z, 3)) continue;
      if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
      trees.push({ x, z, s: rng.uniform(0.8, 1.25), planter: false });
    }
    for (let i = 0; i < Math.round(28 * TIERF); i++) { const a = rng.uniform(0, Math.PI * 2), r = rng.uniform(124, 160); trees.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, s: rng.uniform(1.1, 1.6), planter: false, outer: true }); }
    const blob = new THREE.IcosahedronGeometry(1, 1); { const p = blob.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.3 * Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); } blob.computeVertexNormals(); }
    const perTree = tier === 'low' ? 14 : 24;
    const leafMat = stdMat({ color: 0xffffff, roughness: 0.92, metalness: 0, flatShading: true });
    const leaves = new THREE.InstancedMesh(blob, leafMat, trees.length * perTree); leaves.castShadow = true; leaves.receiveShadow = true;
    let li = 0; const lc = new THREE.Color();
    for (const t of trees) {
      const s = t.s, th = 3.4 * s;
      bark.cyl(0.18 * s, 0.3 * s, th, t.x, 0, t.z, PAL.bark, 9);
      const nb = 4; const tops = [];
      for (let b = 0; b < nb; b++) { const a = (b / nb) * Math.PI * 2 + rng.uniform(-0.4, 0.4); const tx = t.x + Math.sin(a) * 1.6 * s, tz = t.z + Math.cos(a) * 1.6 * s, ty = th + 1.6 * s; bark.rod([t.x, th - 0.4 * s, t.z], [tx, ty, tz], 0.12 * s, PAL.bark, 6); tops.push([tx, ty, tz]); }
      for (let k = 0; k < perTree; k++) {
        const a = rng.uniform(0, Math.PI * 2), rr = Math.sqrt(rng.random()) * 3.3 * s, y = th + 1.3 * s + rng.uniform(0, 2.6 * s) * (1 - (rr / (3.6 * s)) * 0.5);
        const sc = rng.uniform(0.9, 1.5) * s; _m.compose(_p.set(t.x + Math.sin(a) * rr, y, t.z + Math.cos(a) * rr), _q.setFromEuler(_e.set(0, rng.uniform(0, 6.28), 0)), _s.set(sc, sc, sc));
        leaves.setMatrixAt(li, _m); lc.setHSL(0.24 + rng.uniform(-0.03, 0.03), 0.45 + rng.uniform(-0.08, 0.08), 0.24 + rng.uniform(-0.05, 0.06)); leaves.setColorAt(li, lc); li++;
      }
      if (t.planter) { brick.cyl(1.25, 1.35, 0.55, t.x, 0, t.z, 0xffffff, 16); marble.cyl(1.4, 1.4, 0.07, t.x, 0.55, t.z, PAL.marble, 16); kit.addCollider([t.x - 1.3, 0, t.z - 1.3], [t.x + 1.3, 0.62, t.z + 1.3]); }
      else if (!t.outer) kit.addCollider([t.x - 0.35, 0, t.z - 0.35], [t.x + 0.35, 3, t.z + 0.35]);
    }
    leaves.count = li; leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true; leaves.computeBoundingSphere(); G.add(leaves);

    // --- ajrak banners on poles around the plaza
    const banners = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2 + Math.PI / 16; banners.push([Math.sin(a) * 27, Math.cos(a) * 27, a]); }
    for (const [x, z, a] of banners) {
      metal.cyl(0.06, 0.08, 6.2, x, 0, z, PAL.metal, 8); metal.sphere(0.12, x, 6.25, z, PAL.saffron, 8);
      const nx = Math.cos(a), nz = -Math.sin(a); // banner plane tangent to ring
      metal.rod([x, 5.9, z], [x + nx * 1.3, 5.9, z + nz * 1.3], 0.025, PAL.metal);
      const p0 = [x + nx * 0.1, 2.6, z + nz * 0.1], p1 = [x + nx * 1.25, 2.6, z + nz * 1.25], p2 = [x + nx * 1.25, 5.85, z + nz * 1.25], p3 = [x + nx * 0.1, 5.85, z + nz * 0.1];
      ajrak.quad(p0, p1, p2, p3, 0xffffff, [[0, 0], [1, 0], [1, 2.6], [0, 2.6]]);
      ajrak.quad(p1, p0, p3, p2, 0xffffff, [[1, 0], [0, 0], [0, 2.6], [1, 2.6]]);
      ajrak.quad([p0[0], 2.3, p0[2]], [p1[0], 2.3, p1[2]], p1, p0, 0xffffff, [[0, 0.05], [1, 0.05], [1, 0.12], [0, 0.12]]);
      kit.addCollider([x - 0.15, 0, z - 0.15], [x + 0.15, 3, z + 0.15]);
    }

    // --- lamp posts (heads instanced, emissive at dusk/night)
    const lampPos = [];
    for (const p of pathEnds) {
      for (let r = p.r0 + 5; r < p.r1 - 2; r += 11) { const sideK = (Math.round(r / 11) % 2) ? 1 : -1; const off = p.id === 'gate' ? 4.4 : 3.4; lampPos.push([p.dx * r + p.dz * off * sideK, p.dz * r - p.dx * off * sideK]); }
    }
    for (const [x, z] of [[-29, -29], [29, -29], [-29, 29], [29, 29], [-12, 0], [12, 0], [0, -12], [0, 12]]) lampPos.push([x, z]);
    for (const [x, z] of lampPos) { metal.cyl(0.07, 0.11, 4.1, x, 0, z, PAL.charcoal, 8); metal.cyl(0.16, 0.2, 0.3, x, 0, z, PAL.charcoal, 8); metal.cyl(0.2, 0.1, 0.12, x, 4.55, z, PAL.charcoal, 8); kit.addCollider([x - 0.15, 0, z - 0.15], [x + 0.15, 3, z + 0.15]); }
    const lampMat = nightGlow(stdMat({ color: 0xfff1d6, emissive: 0xffb04a, emissiveIntensity: 0.1, roughness: 0.4 }), { day: 0.05, dusk: 1.6, night: 3.2 });
    const lampGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.5, 8);
    const lamps = new THREE.InstancedMesh(lampGeo, lampMat, lampPos.length); lamps.castShadow = false;
    lampPos.forEach(([x, z], i) => { _m.makeTranslation(x, 4.33, z); lamps.setMatrixAt(i, _m); }); lamps.computeBoundingSphere(); G.add(lamps);
    world._lampMat = lampMat;

    // --- perimeter wall with gate gap (south) + pillars
    const WR = 116, gateHalf = Math.asin(7.2 / WR); const wsegs = 240;
    for (let i = 0; i < wsegs; i++) {
      const a0 = (i / wsegs) * Math.PI * 2, a1 = ((i + 1) / wsegs) * Math.PI * 2, am = (a0 + a1) / 2; // a measured from +Z
      if (Math.abs(am - Math.PI) < gateHalf) continue;
      const x = Math.sin(am) * WR, z = Math.cos(am) * WR, L = WR * (a1 - a0) + 0.05;
      brick.box(L, 2.9, 0.45, x, 0, z, 0xffffff, am + Math.PI / 2 - Math.PI / 2 + 0); // tangent orientation
      marble.box(L, 0.12, 0.6, x, 2.9, z, PAL.plaster, am);
      if (i % 6 === 0) { brick.box(0.9, 3.4, 0.9, x, 0, z, PAL.brickDark, am); marble.box(1.05, 0.15, 1.05, x, 3.4, z, PAL.plaster, am); }
      kit.addCollider([x - 1.6, 0, z - 1.6].map((v, k) => (k === 1 ? 0 : v)), [x + 1.6, 3, z + 1.6]);
    }
    // gate: pillars + lintel
    for (const sx of [-1, 1]) { brick.box(2.2, 6.4, 2.2, sx * 7.4, 0, WR, 0xffffff); marble.box(2.6, 0.3, 2.6, sx * 7.4, 6.4, WR, PAL.marble); marble.cone(0.9, 1.2, sx * 7.4, 6.7, WR, PAL.saffron, 4); kit.addCollider([sx * 7.4 - 1.1, 0, WR - 1.1], [sx * 7.4 + 1.1, 6.4, WR + 1.1]); }
    brick.box(17, 1.5, 1.4, 0, 5.0, WR, 0xffffff); marble.box(17.4, 0.18, 1.6, 0, 6.5, WR, PAL.marble);
    const ajG = new GeoBuilder(); ajrak.quad([-6.3, 4.6, WR + 0.72], [6.3, 4.6, WR + 0.72], [6.3, 5.0, WR + 0.72], [-6.3, 5.0, WR + 0.72], 0xffffff, [[0, 0], [12, 0], [12, 0.4], [0, 0.4]]);
    ajrak.quad([6.3, 4.6, WR - 0.72], [-6.3, 4.6, WR - 0.72], [-6.3, 5.0, WR - 0.72], [6.3, 5.0, WR - 0.72], 0xffffff, [[0, 0], [12, 0], [12, 0.4], [0, 0.4]]);
    void ajG;
    const signTxt = 'INDUS INSTITUTE OF BEHAVIOURAL SCIENCES (IIBS)\nانڈس انسٹیٹیوٹ آف بیہیویئرل سائنسز\nHyderabad, Sindh — Simulated institution';
    const gOut = label3d(signTxt, { size: 0.42, maxWidth: 15, bg: 'rgba(38,52,107,0.95)' }); gOut.position.set(0, 5.75, WR + 0.73); G.add(gOut);
    const gIn = label3d(signTxt, { size: 0.42, maxWidth: 15, bg: 'rgba(38,52,107,0.95)' }); gIn.position.set(0, 5.75, WR - 0.73); gIn.rotation.y = Math.PI; G.add(gIn);
    const notice = label3d('Simulated institution\nA fictional campus built for teaching psychology.\nNo real people, places or records are depicted.', { size: 0.26, maxWidth: 3.6, bg: 'rgba(24,20,38,0.9)' });
    notice.position.set(5.2, 1.7, 108); notice.rotation.y = Math.PI; G.add(notice);
    metal.box(0.12, 1.2, 0.12, 3.6, 0, 108, PAL.charcoal); metal.box(0.12, 1.2, 0.12, 6.8, 0, 108, PAL.charcoal); kit.addCollider([3.4, 0, 107.8], [7, 2.3, 108.2]);

    // --- signposts at each path mouth (English + Urdu), facing the courtyard
    for (const p of pathEnds) {
      if (p.id === 'gate') continue;
      const r = p.r0 + 1.6; const ox = p.dz * 3.6, oz = -p.dx * 3.6; const x = p.dx * r + ox, z = p.dz * r + oz;
      wood.box(0.16, 3.0, 0.16, x, 0, z, PAL.woodDark); metal.sphere(0.1, x, 3.05, z, PAL.saffron, 8);
      const nm = layout.NAMES[p.id];
      const lab = label3d(nm[0] + '\n' + nm[1], { size: 0.3, maxWidth: 3.2, bg: 'rgba(143,29,44,0.94)', border: '#f3e7cf' });
      lab.position.set(x - p.dx * 0.1, 2.2, z - p.dz * 0.1); lab.rotation.y = Math.atan2(-p.dx, -p.dz); G.add(lab);
      const back = label3d('Central Courtyard\nمرکزی صحن', { size: 0.26, maxWidth: 2.6, bg: 'rgba(38,52,107,0.94)', border: '#f3e7cf' });
      back.position.set(x + p.dx * 0.1, 2.2, z + p.dz * 0.1); back.rotation.y = Math.atan2(p.dx, p.dz); G.add(back);
      kit.addCollider([x - 0.2, 0, z - 0.2], [x + 0.2, 2.5, z + 0.2]);
    }

    // --- campus map board near the gate avenue
    const mapTex = canvasTex(1024, 1024, (g, W, H) => {
      g.fillStyle = '#f3e7cf'; g.fillRect(0, 0, W, H); g.strokeStyle = '#8f1d2c'; g.lineWidth = 14; g.strokeRect(7, 7, W - 14, H - 14);
      const S = W / 260, cx = W / 2, cy = H / 2 - 20;
      g.fillStyle = '#c9d6a8'; g.beginPath(); g.arc(cx, cy, 116 * S, 0, 7); g.fill(); g.fillStyle = '#e6dccb'; g.fillRect(cx - 30 * S, cy - 30 * S, 60 * S, 60 * S);
      g.font = '700 30px ' + ENF; g.textAlign = 'center'; g.fillStyle = '#26346b'; g.fillText('IIBS CAMPUS MAP · Simulated institution', cx, 52);
      for (const id of layout.ORDER) { const c = layout.ZONES[id].center; g.fillStyle = '#b0603f'; g.fillRect(cx + c[0] * S - 20 * S, cy + c[2] * S - 20 * S, 40 * S, 40 * S); g.fillStyle = '#fff'; g.font = '700 22px ' + ENF; const nm = layout.NAMES[id][0].split(' — ')[0]; g.fillText(nm.length > 18 ? nm.slice(0, 17) + '…' : nm, cx + c[0] * S, cy + c[2] * S + 6); }
      g.fillStyle = '#2f6f80'; g.beginPath(); g.arc(cx, cy, 5 * S, 0, 7); g.fill(); g.fillStyle = '#8f1d2c'; g.beginPath(); g.arc(cx, cy + 30 * S, 9, 0, 7); g.fill();
      g.font = '600 24px ' + ENF; g.fillStyle = '#26346b'; g.fillText('● You are here', cx, cy + 30 * S + 40); g.fillText('Gate ↓', cx, H - 40);
    });
    if (mapTex) {
      const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), basicMat({ map: mapTex, toneMapped: false })); board.position.set(-6, 1.75, 34.6); G.add(board);
      wood.box(2.7, 2.75, 0.12, -6, 0.45, 34.52, PAL.woodDark); kit.addCollider([-7.4, 0, 34.3], [-4.6, 3, 34.8]);
    }

    // --- build merged meshes
    const add = (gb, mat, opt) => { const m = gb.mesh(mat, opt); if (m) G.add(m); return m; };
    const plaza = add(terr, vc('terrazzo'), { cast: false }); if (plaza) { plaza.userData.ssr = true; plaza.userData.floor = true; }
    add(pave, vc('tiles'), { cast: false }); add(brick, vc('brick')); add(metal, vc('metal')); add(wood, vc('wood')); add(marble, vc('marble'));
    add(jaali, vc('jaali')); add(ajrak, vc('ajrak', { side: THREE.DoubleSide }), { cast: true }); add(bark, vc('wood', { roughness: 0.95 }));

    kit.zone.anchors.fountain = new THREE.Vector3(0, 1.5, 0); kit.zone.anchors.gate = new THREE.Vector3(0, 4, WR);
    kit.zone.anchors.exhibit = new THREE.Vector3(0, 1.6, 0); kit.zone.anchors.inside = new THREE.Vector3(0, 1.5, 0);
    kit.addInteractable({ id: 'courtyard:map', pos: [-6, 1.6, 34], radius: 2.5, label: 'Campus map', onUse: () => act.panel('course') });
    kit.addInteractable({ id: 'courtyard:fountain', pos: [0, 1.2, 5], radius: 3, label: 'Fountain — course map & missions', onUse: () => act.panel('missions') });
  }

  /* ============================================================ zones */
  const ZONE_PANEL = { wundt: 'history', explab: 'illusions', neuro: 'brain', sleep: 'sleep', learning: 'learning', childdev: 'development', clinic: 'therapy', mohalla: 'social', library: 'methods' };
  for (const id of layout.ORDER) {
    const Z = world.zones[id];
    const group = new THREE.Group(); group.name = 'zone:' + id; group.position.copy(Z.center); group.rotation.y = Z.yaw; root.add(group);
    const detail = new THREE.Group(); detail.name = 'detail:' + id; group.add(detail);
    group.updateMatrixWorld(true);
    const axisAligned = Math.abs(Math.sin(2 * Z.yaw)) < 1e-4;
    const kit = makeKit(id, group, detail, axisAligned);
    Z.group = group; Z.detail = detail;
    // entrance monolith (EN + UR) beside the path end
    {
      const gb = new GeoBuilder(); gb.box(1.2, 2.6, 0.5, 6.5, 0, 22.5, PAL.brickDark); gb.box(1.35, 0.12, 0.62, 6.5, 2.6, 22.5, PAL.marble);
      const m = gb.mesh(vc('brick')); group.add(m);
      const nm = layout.NAMES[id]; const lab = label3d(nm[0] + '\n' + nm[1], { size: 0.2, maxWidth: 1.1, bg: 'rgba(38,52,107,0.95)' }); lab.position.set(6.5, 1.7, 22.76); group.add(lab);
      kit.addCollider([5.9, 0, 22.2], [7.1, 2.7, 22.8]);
    }
    let handle = null;
    try {
      const mod = require(`./zones/${id}.js`);
      if (!mod || typeof mod.build !== 'function') throw new Error('zone module has no build()');
      handle = mod.build(kit) || {};
    } catch (err) {
      if (typeof console !== 'undefined' && !/cannot resolve|Cannot find module/i.test(String(err && err.message))) console.warn('[ZEHN] zone ' + id + ' failed, placeholder used:', err);
      // clear partial build, then a placeholder building
      for (let i = group.children.length - 1; i >= 0; i--) { const ch = group.children[i]; if (ch !== detail && !/^label:/.test(ch.name) && ch.type !== 'Mesh') group.remove(ch); }
      handle = buildPlaceholder(kit, ZONE_PANEL[id]);
    }
    world.handles[id] = handle;
  }

  function buildPlaceholder(kit, panelId) {
    const sh = makeShell(kit, { w: 30, d: 26, cz: -2, h: 7, roof: 'solid' });
    const nm = layout.NAMES[kit.id];
    const lab = label3d(nm[0] + '\n' + nm[1] + '\nExhibits being installed — open the panel instead', { size: 0.34, maxWidth: 9, bg: 'rgba(24,20,38,0.9)' });
    lab.position.set(0, 2.2, 11.3); kit.group.add(lab);
    kit.anchor('inside', [0, 1.6, -2]); kit.anchor('exhibit', [0, 2, 11]);
    kit.addInteractable({ id: 'placeholder', pos: [0, 1.5, 12], radius: 3, label: nm[0] + ' — open panel', onUse: () => act.panel(panelId || 'course') });
    void sh; return { placeholder: true };
  }

  /* ---------- focus targets for tour beats */
  function computeFocus() {
    world.focusTargets.courtyard = {
      pos: new THREE.Vector3(0, 7, 44), target: new THREE.Vector3(0, 2, 0),
      aerial: { pos: new THREE.Vector3(0, 78, 105), target: new THREE.Vector3(0, 0, 0) },
      front: { pos: new THREE.Vector3(0, 7, 44), target: new THREE.Vector3(0, 2, 0) },
      inside: { pos: new THREE.Vector3(10, 1.8, 14), target: new THREE.Vector3(0, 1.6, 0) },
      exhibit: { pos: new THREE.Vector3(0, 2.4, 10), target: new THREE.Vector3(0, 1.6, 0) },
    };
    for (const id of layout.ORDER) {
      const Z = world.zones[id]; const g = Z.group; const L = (v) => new THREE.Vector3(...v).applyMatrix4(g.matrixWorld);
      const front = { pos: L([0, 6, 44]), target: L([0, 4, 6]) };
      const aerial = { pos: L([0, 48, 62]), target: L([0, 0, 0]) };
      const inT = Z.anchors.inside || L([0, 1.6, -4]);
      const inside = { pos: Z.anchors.insideCam || L([0, 2.4, 14]), target: inT };
      const exT = Z.anchors.exhibit || L([0, 1.6, 0]);
      const toward = new THREE.Vector3().subVectors(L([0, 0, 30]), exT).setY(0).normalize();
      const exhibit = { pos: Z.anchors.exhibitCam || exT.clone().addScaledVector(toward, 4.5).add(new THREE.Vector3(0, 0.6, 0)), target: exT };
      world.focusTargets[id] = { pos: front.pos, target: front.target, front, aerial, inside, exhibit };
    }
  }
  computeFocus();

  /* ---------- zone tracking / teleport */
  let curZone = sim.state.zone || null;
  function setZone(id, force) {
    if (!id || (id === curZone && !force)) return;
    curZone = id; sim.state.zone = id; world.currentZone = id;
    sim.bus && sim.bus.emit && sim.bus.emit('zone:enter', { zone: id });
  }
  world.zoneAt = (pos) => (pos ? layout.zoneAt(pos.x, pos.z) : 'courtyard');
  world.teleport = (zoneId) => {
    if (!world.zones[zoneId]) return false;
    const e = layout.entry(zoneId); const yaw = zoneId === 'courtyard' ? 0 : e.yaw;
    const c = sim.services.controls;
    if (c && c.teleport) c.teleport({ pos: e.pos.slice(), yaw });
    else { const cam = camera(); if (cam) { cam.position.set(e.pos[0], e.pos[1], e.pos[2]); cam.rotation.set(0, yaw, 0, 'YXZ'); } }
    setZone(zoneId, true); return true;
  };

  /* ---------- time of day */
  world.setTimeOfDay = (tod) => {
    const t = tod === 'night' || tod === 'dusk' ? tod : 'day'; world.timeOfDay = t; sim.state.timeOfDay = t;
    for (const n of nightMats) { n.mat.emissiveIntensity = n.levels[t]; }
    if (world._fountainLight) world._fountainLight.intensity = t === 'night' ? 30 : t === 'dusk' ? 10 : 0;
    for (const id of Object.keys(world.handles)) { const h = world.handles[id]; if (h && typeof h.setTimeOfDay === 'function') { try { h.setTimeOfDay(t); } catch (e) { /* zone error must not break */ } } }
  };
  world.setTimeOfDay(world.timeOfDay);
  if (sim.bus && sim.bus.on) {
    for (const ev of ['timeofday:change', 'time:change', 'tod:change']) offs.push(sim.bus.on(ev, (p) => world.setTimeOfDay((p && (p.t || p.tod || p.timeOfDay)) || p)));
  }

  /* ---------- update loop */
  let lastT = -1; const _cp = new THREE.Vector3();
  world.update = (dt, t) => {
    if (t === lastT) return; lastT = t; dt = Math.min(dt || 0.016, 0.1); t = t || 0;
    const cam = camera();
    if (cam) {
      cam.getWorldPosition(_cp); setZone(layout.zoneAt(_cp.x, _cp.z));
      for (const id of layout.ORDER) { const Z = world.zones[id]; if (Z.detail) { const d = Math.hypot(_cp.x - Z.center.x, _cp.z - Z.center.z); Z.detail.visible = d < (tier === 'low' ? 70 : 95); } }
    }
    for (const u of updaters) { try { u(dt, t); } catch (e) { /* keep running */ } }
    for (const id of layout.ORDER) {
      const h = world.handles[id]; if (!h || typeof h.update !== 'function') continue;
      const Z = world.zones[id]; if (cam && Z.detail && !Z.detail.visible && !h.alwaysUpdate) continue;
      try { h.update(dt, t); } catch (e) { if (!h._warned && typeof console !== 'undefined') { h._warned = true; console.warn('[ZEHN] zone update', id, e); } }
    }
    for (const p of people) { if (p.person.update) { try { p.person.update(dt, t, cam); } catch (e) { /* ignore */ } } }
  };
  if (engine && typeof engine.addUpdate === 'function') engine.addUpdate((dt, t) => world.update(dt, t));

  /* ---------- dispose */
  world.dispose = () => {
    for (const off of offs) { if (typeof off === 'function') off(); }
    for (const id of Object.keys(world.handles)) { const h = world.handles[id]; if (h && typeof h.dispose === 'function') { try { h.dispose(); } catch (e) { /* ignore */ } } }
    for (const p of people) { if (p.person.dispose) tryRequire(() => p.person.dispose()); }
    root.traverse((o) => { if (o.geometry && !UNIT_GEOS.has(o.geometry)) o.geometry.dispose(); });
    for (const m of ownedMats) m.dispose(); for (const t of ownedTex) t.dispose();
    scene.remove(root); world.colliders.length = 0; world.interactables.length = 0;
    if (sim.services.world === world) sim.services.world = null;
  };
  const UNIT_GEOS = new Set(UNIT.values());

  // initial zone
  if (!sim.state.zone) sim.state.zone = 'courtyard';
  world.stats = () => { let meshes = 0, inst = 0; root.traverse((o) => { if (o.isInstancedMesh) inst++; else if (o.isMesh) meshes++; }); return { meshes, instanced: inst, colliders: world.colliders.length, interactables: world.interactables.length }; };
  return world;
}

module.exports = { buildWorld, GeoBuilder, PAL };
