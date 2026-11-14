'use strict';
/**
 * Procedural texture library (A3). Every texture is drawn on a canvas at runtime — no assets.
 * Each entry returns { map, normalMap, roughnessMap, alphaMap? } derived from a shared height field
 * (normal map via Sobel on the height canvas, roughness from height + per-material bias). Cached by key.
 *
 *   tex.get('brick'|'jaali'|'ajrak'|'terrazzo'|'wood'|'marble'|'grass'|'plaster'|'tiles'|'carpet'|'chalkboard'|'concrete'|'fabric')
 *   tex.poster(text, opts) → CanvasTexture (title + body, Indus Dusk palette)
 *   tex.label(text, opts)  → CanvasTexture for signage
 */
const THREE = require('three');

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function canvas(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  return c;
}

/** Value-noise field (tileable) used for grain, mottling and wood rings. */
function noiseField(size, cells, seed) {
  const r = rng(seed), g = new Float32Array(cells * cells);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const out = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const fx = (x / size) * cells, fy = (y / size) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = g[(iy % cells) * cells + (ix % cells)], b = g[(iy % cells) * cells + ((ix + 1) % cells)];
    const c = g[((iy + 1) % cells) * cells + (ix % cells)], d = g[((iy + 1) % cells) * cells + ((ix + 1) % cells)];
    out[y * size + x] = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
  }
  return out;
}
function fbm(size, seed, oct) {
  const out = new Float32Array(size * size); let amp = 0.5, tot = 0;
  for (let o = 0; o < (oct || 4); o++) { const n = noiseField(size, 4 << o, seed + o * 101); for (let i = 0; i < out.length; i++) out[i] += n[i] * amp; tot += amp; amp *= 0.5; }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

/** Height (0..1 array) → tangent-space normal map canvas (Sobel). */
function normalFromHeight(h, size, strength) {
  const c = canvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  const H = (x, y) => h[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x - 1, y) + H(x - 1, y + 1));
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1)) - (H(x - 1, y - 1) + 2 * H(x, y - 1) + H(x + 1, y - 1));
    let nx = -dx * strength, ny = dy * strength, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const i = (y * size + x) * 4; d[i] = (nx * 0.5 + 0.5) * 255; d[i + 1] = (ny * 0.5 + 0.5) * 255; d[i + 2] = (nz * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0); return c;
}
function roughFromHeight(h, size, base, vary) {
  const c = canvas(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size), d = img.data;
  for (let i = 0; i < size * size; i++) { const v = Math.max(0, Math.min(1, base + (h[i] - 0.5) * vary)) * 255; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  ctx.putImageData(img, 0, 0); return c;
}
/** Read luminance of a drawn canvas back into a height array. */
function heightFromCanvas(c) {
  const s = c.width, d = c.getContext('2d').getImageData(0, 0, s, s).data, h = new Float32Array(s * s);
  for (let i = 0; i < h.length; i++) h[i] = (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) / 255;
  return h;
}

/* -------------------------------------------------------------- painters
 * Each painter: (ctx, size, r) → { height?: Float32Array, rough: [base, vary], normal: strength, alpha?: canvas }
 */
const PAINT = {
  brick(ctx, s, r) {
    const rows = 8, bh = s / rows, bw = s / 4, mortar = Math.max(2, s / 128);
    ctx.fillStyle = '#b9b0a2'; ctx.fillRect(0, 0, s, s);
    const hc = canvas(s, s), hx = hc.getContext('2d'); hx.fillStyle = '#222'; hx.fillRect(0, 0, s, s);
    for (let y = 0; y < rows; y++) for (let x = -1; x < 5; x++) {
      const ox = (y % 2) * bw / 2, X = x * bw + ox, Y = y * bh;
      const hue = 8 + r() * 14, lum = 34 + r() * 14;
      ctx.fillStyle = `hsl(${hue},${45 + r() * 15}%,${lum}%)`; ctx.fillRect(X + mortar, Y + mortar, bw - mortar * 2, bh - mortar * 2);
      for (let k = 0; k < 30; k++) { ctx.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '255,220,190'},${r() * 0.12})`; ctx.fillRect(X + r() * bw, Y + r() * bh, 2 + r() * 4, 1 + r() * 3); }
      hx.fillStyle = `rgb(${190 + r() * 50},0,0)`; hx.fillRect(X + mortar, Y + mortar, bw - mortar * 2, bh - mortar * 2);
    }
    return { height: heightFromCanvas(hc), rough: [0.86, 0.2], normal: 2.2 };
  },
  plaster(ctx, s, r) {
    const n = fbm(s, 11, 5), img = ctx.createImageData(s, s), d = img.data;
    for (let i = 0; i < n.length; i++) { const v = 222 + (n[i] - 0.5) * 38; d[i * 4] = v; d[i * 4 + 1] = v * 0.97; d[i * 4 + 2] = v * 0.9; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return { height: n, rough: [0.9, 0.15], normal: 1.2 };
  },
  concrete(ctx, s, r) {
    const n = fbm(s, 23, 5), img = ctx.createImageData(s, s), d = img.data;
    for (let i = 0; i < n.length; i++) { const v = 150 + (n[i] - 0.5) * 60 + (r() - 0.5) * 14; d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v * 0.97; d[i * 4 + 3] = 255; }
    ctx.putImageData(img, 0, 0);
    return { height: n, rough: [0.88, 0.25], normal: 1.6 };
  },
  terrazzo(ctx, s, r) {
    ctx.fillStyle = '#d8d1c4'; ctx.fillRect(0, 0, s, s);
    const cols = ['#9f1239', '#0f766e', '#1e1b4b', '#f59e0b', '#f8fafc', '#6b6257', '#3f3a35'];
    for (let i = 0; i < s * 1.6; i++) {
      ctx.fillStyle = cols[Math.floor(r() * cols.length)]; ctx.globalAlpha = 0.55 + r() * 0.45;
      ctx.beginPath(); const x = r() * s, y = r() * s, rr = 0.6 + r() * r() * s / 70;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; ctx.lineTo(x + Math.cos(a) * rr * (0.6 + r() * 0.6), y + Math.sin(a) * rr * (0.6 + r() * 0.6)); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return { height: fbm(s, 31, 3), rough: [0.18, 0.12], normal: 0.25 };
  },
  marble(ctx, s, r) {
    const n = fbm(s, 41, 6), img = ctx.createImageData(s, s), d = img.data;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = y * s + x, v = Math.abs(Math.sin((x / s * 6 + y / s * 2) * Math.PI + n[i] * 9));
      const vein = Math.pow(1 - v, 10), c = 236 - vein * 120 - (n[i] - 0.5) * 20;
      d[i * 4] = c; d[i * 4 + 1] = c * 0.98; d[i * 4 + 2] = c * 0.95; d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { height: n, rough: [0.12, 0.1], normal: 0.15 };
  },
  tiles(ctx, s, r) {
    const n = 4, t = s / n, g = Math.max(2, s / 170);
    ctx.fillStyle = '#7a7268'; ctx.fillRect(0, 0, s, s);
    const hc = canvas(s, s), hx = hc.getContext('2d'); hx.fillStyle = '#000'; hx.fillRect(0, 0, s, s);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const alt = (x + y) % 2; ctx.fillStyle = alt ? `hsl(174,${40 + r() * 10}%,${30 + r() * 4}%)` : `hsl(40,${20 + r() * 8}%,${86 + r() * 4}%)`;
      ctx.fillRect(x * t + g, y * t + g, t - 2 * g, t - 2 * g);
      ctx.strokeStyle = alt ? 'rgba(245,158,11,0.55)' : 'rgba(159,18,57,0.45)'; ctx.lineWidth = Math.max(1, s / 256);
      ctx.beginPath(); ctx.moveTo(x * t + t / 2, y * t + g * 4); ctx.lineTo(x * t + t - g * 4, y * t + t / 2); ctx.lineTo(x * t + t / 2, y * t + t - g * 4); ctx.lineTo(x * t + g * 4, y * t + t / 2); ctx.closePath(); ctx.stroke();
      hx.fillStyle = '#fff'; hx.fillRect(x * t + g, y * t + g, t - 2 * g, t - 2 * g);
    }
    return { height: heightFromCanvas(hc), rough: [0.22, 0.5], normal: 1.4 };
  },
  wood(ctx, s, r) {
    const n = fbm(s, 53, 4), img = ctx.createImageData(s, s), d = img.data, h = new Float32Array(s * s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = y * s + x, plank = Math.floor(x / (s / 6)), ring = Math.sin((y / s * 40 + n[i] * 8 + plank * 3.1) * Math.PI) * 0.5 + 0.5;
      const edge = (x % (s / 6)) < 2 ? 0.55 : 1, v = (0.55 + ring * 0.25 + (n[i] - 0.5) * 0.3) * edge;
      d[i * 4] = 150 * v + 20; d[i * 4 + 1] = 95 * v + 10; d[i * 4 + 2] = 55 * v + 5; d[i * 4 + 3] = 255; h[i] = ring * 0.4 + edge * 0.6;
    }
    ctx.putImageData(img, 0, 0);
    return { height: h, rough: [0.5, 0.3], normal: 1.0 };
  },
  grass(ctx, s, r) {
    ctx.fillStyle = '#3f6b2a'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < s * s / 30; i++) {
      const x = r() * s, y = r() * s, l = 2 + r() * s / 64;
      ctx.strokeStyle = `hsl(${80 + r() * 40},${35 + r() * 25}%,${18 + r() * 28}%)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 3, y - l); ctx.stroke();
    }
    return { rough: [0.95, 0.1], normal: 1.5 };
  },
  carpet(ctx, s, r) {
    ctx.fillStyle = '#5b1a2e'; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#d4a017'; ctx.lineWidth = s / 64; ctx.strokeRect(s * 0.06, s * 0.06, s * 0.88, s * 0.88);
    ctx.fillStyle = '#1e1b4b'; for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(s / 2, s / 2); ctx.rotate(k * Math.PI / 2); ctx.fillRect(-s * 0.05, -s * 0.38, s * 0.1, s * 0.2); ctx.restore(); }
    ctx.beginPath(); ctx.arc(s / 2, s / 2, s * 0.14, 0, Math.PI * 2); ctx.fillStyle = '#0f766e'; ctx.fill();
    const img = ctx.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const k = 0.85 + r() * 0.25; d[i] *= k; d[i + 1] *= k; d[i + 2] *= k; }
    ctx.putImageData(img, 0, 0);
    return { rough: [0.97, 0.05], normal: 0.8 };
  },
  fabric(ctx, s, r) {
    ctx.fillStyle = '#8a8580'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 2) { ctx.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.05})`; ctx.fillRect(0, y, s, 1); }
    for (let x = 0; x < s; x += 2) { ctx.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.05})`; ctx.fillRect(x, 0, 1, s); }
    return { rough: [0.92, 0.1], normal: 1.0 };
  },
  chalkboard(ctx, s, r) {
    ctx.fillStyle = '#1f3a2e'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 60; i++) { ctx.strokeStyle = `rgba(230,240,235,${r() * 0.07})`; ctx.lineWidth = 2 + r() * s / 30; ctx.beginPath(); const y = r() * s; ctx.moveTo(0, y); ctx.bezierCurveTo(s / 3, y + (r() - 0.5) * 40, s * 2 / 3, y + (r() - 0.5) * 40, s, y); ctx.stroke(); }
    return { rough: [0.9, 0.1], normal: 0.3 };
  },
  ajrak(ctx, s, r) {
    // Block-print grid: crimson ground, indigo/black medallions, white resist lines (ajrak, Sindh).
    ctx.fillStyle = '#8f1230'; ctx.fillRect(0, 0, s, s);
    const n = 4, t = s / n;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const cx = x * t + t / 2, cy = y * t + t / 2;
      ctx.fillStyle = '#1b1838'; ctx.beginPath();
      for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = k % 2 ? t * 0.22 : t * 0.4; ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#f3eee6'; ctx.lineWidth = Math.max(1, t / 40); ctx.beginPath(); ctx.arc(cx, cy, t * 0.15, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#9f1239'; ctx.beginPath(); ctx.arc(cx, cy, t * 0.09, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f3eee6'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(x * t + (k % 2) * t, y * t + (k >> 1) * t, t * 0.05, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.strokeStyle = '#1b1838'; ctx.lineWidth = Math.max(2, s / 90);
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, s); ctx.moveTo(0, i * t); ctx.lineTo(s, i * t); ctx.stroke(); }
    return { rough: [0.9, 0.05], normal: 0.6 };
  },
  jaali(ctx, s, r) {
    // Pierced stone screen: sandstone colour; alpha map has the geometric (8-point star) openings.
    ctx.fillStyle = '#c9a77c'; ctx.fillRect(0, 0, s, s);
    const n = fbm(s, 61, 3), img = ctx.getImageData(0, 0, s, s), d = img.data;
    for (let i = 0; i < n.length; i++) { const k = 0.85 + n[i] * 0.3; d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k; }
    ctx.putImageData(img, 0, 0);
    const a = canvas(s, s), ax = a.getContext('2d'); ax.fillStyle = '#fff'; ax.fillRect(0, 0, s, s); ax.fillStyle = '#000';
    const cells = 4, t = s / cells;
    for (let y = 0; y < cells; y++) for (let x = 0; x < cells; x++) {
      const cx = x * t + t / 2, cy = y * t + t / 2; ax.beginPath();
      for (let k = 0; k < 16; k++) { const ang = k / 16 * Math.PI * 2 + Math.PI / 16, rr = k % 2 ? t * 0.2 : t * 0.36; ax.lineTo(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr); }
      ax.closePath(); ax.fill();
      ax.beginPath(); ax.arc(x * t, y * t, t * 0.09, 0, Math.PI * 2); ax.fill();
    }
    const h = heightFromCanvas(a);
    return { height: h, rough: [0.85, 0.1], normal: 3.0, alpha: a };
  },
};

class TextureLibrary {
  constructor(quality) {
    this.quality = quality; this.cache = new Map(); this.list = Object.keys(PAINT);
  }
  get size() { return (this.quality && this.quality.settings.textureSize) || 512; }
  get anisotropy() { return (this.quality && this.quality.anisotropy) || 1; }

  _wrap(c, srgb) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = this.anisotropy;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** { map, normalMap, roughnessMap, alphaMap? } for a named procedural surface. */
  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const p = PAINT[name];
    if (!p) throw new Error('textures: unknown ' + name);
    const s = this.size, c = canvas(s, s), ctx = c.getContext('2d'), r = rng(name.length * 977 + name.charCodeAt(0) * 31);
    const res = p(ctx, s, r);
    const h = res.height || heightFromCanvas(c);
    const set = {
      map: this._wrap(c, true),
      normalMap: this._wrap(normalFromHeight(h, s, res.normal || 1), false),
      roughnessMap: this._wrap(roughFromHeight(h, s, res.rough[0], res.rough[1]), false),
    };
    if (res.alpha) set.alphaMap = this._wrap(res.alpha, false);
    this.cache.set(name, set);
    return set;
  }

  /** Poster / exhibit card with wrapped text. opts: { title, w, h, bg, fg, accent, font } */
  poster(text, opts) {
    opts = opts || {};
    const key = 'poster:' + text + ':' + JSON.stringify(opts);
    if (this.cache.has(key)) return this.cache.get(key);
    const w = opts.w || 512, h = opts.h || 720, c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = opts.bg || '#1e1b4b'; x.fillRect(0, 0, w, h);
    x.fillStyle = opts.accent || '#9f1239'; x.fillRect(0, 0, w, h * 0.012); x.fillRect(0, h * 0.988, w, h * 0.012);
    x.fillStyle = opts.fg || '#f8fafc';
    let y = h * 0.1;
    if (opts.title) { x.font = `bold ${Math.round(w / 13)}px system-ui, sans-serif`; y = wrapText(x, opts.title, w * 0.08, y, w * 0.84, w / 11); y += w / 22; x.fillStyle = opts.accent2 || '#f59e0b'; x.fillRect(w * 0.08, y - w / 28, w * 0.2, 4); x.fillStyle = opts.fg || '#f8fafc'; }
    x.font = `${Math.round(w / 24)}px system-ui, sans-serif`;
    wrapText(x, text, w * 0.08, y + w / 20, w * 0.84, w / 17);
    const t = this._wrap(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    this.cache.set(key, t); return t;
  }

  /** Single-line label texture (signage). */
  label(text, opts) {
    opts = opts || {};
    const key = 'label:' + text + ':' + JSON.stringify(opts);
    if (this.cache.has(key)) return this.cache.get(key);
    const h = opts.h || 128, c = canvas(1, 1), x = c.getContext('2d');
    const font = `${opts.bold === false ? '' : 'bold '}${Math.round(h * 0.56)}px system-ui, sans-serif`;
    x.font = font; const w = Math.max(64, Math.ceil(x.measureText(text).width + h * 0.6));
    c.width = w; c.height = h; x.font = font;
    if (opts.bg !== null) { x.fillStyle = opts.bg || 'rgba(30,27,75,0.92)'; x.fillRect(0, 0, w, h); }
    x.fillStyle = opts.fg || '#f8fafc'; x.textBaseline = 'middle'; x.textAlign = 'center'; x.fillText(text, w / 2, h / 2);
    const t = this._wrap(c, true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.userData.aspect = w / h;
    this.cache.set(key, t); return t;
  }

  applyAnisotropy() {
    const a = this.anisotropy;
    for (const v of this.cache.values()) for (const t of (v.isTexture ? [v] : Object.values(v))) if (t && t.anisotropy !== a) { t.anisotropy = a; t.needsUpdate = true; }
  }

  dispose() {
    for (const v of this.cache.values()) for (const t of (v.isTexture ? [v] : Object.values(v))) if (t && t.dispose) t.dispose();
    this.cache.clear();
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { ctx.fillText(line, x, y); line = word; y += lh; } else line = test;
    }
    if (line) { ctx.fillText(line, x, y); y += lh; }
  }
  return y;
}

module.exports = { TextureLibrary, noiseField, fbm, normalFromHeight };
