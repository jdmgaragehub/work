'use strict';
/**
 * Procedural humanoid (A4). Smooth lathe/capsule body on an Object3D "bone" hierarchy, culturally appropriate
 * clothing (shalwar kameez, kurta, dupatta, hijab, waistcoat, lab coat, sweater), a 3D ellipsoid head with
 * nose/ears and a FACS face painted by face2d.drawFace into a CanvasTexture projected on the front of the head.
 * No external assets, no likeness of any real person: looks are generated from `lookIndex`.
 *
 *   const p = createHumanoid(THREE, { lookIndex, height, outfit, gender, tier, name, bus|sim, voice, budget })
 *   p.group                       // add to the scene; feet at y = 0, facing +Z
 *   p.setEmotion('sadness', 0.8)  // EMFACS-style prototype from face2d.EMOTIONS (+ matching body language)
 *   p.setAUs({ 1: 0.5, 12: 1 })   // explicit AUs (merged over the emotion), ≥14 AUs (face2d.AUS)
 *   p.setGaze(vec3 | object3D | null)  // eyes + head/neck turn toward a world point (null = idle saccades)
 *   p.blink()                     // auto-blinks every ~2.5–6 s anyway
 *   p.setViseme('A'|'E'|'O'|'U'|'M'|'F'|'rest')
 *   p.speak(text, {rate, voice}) // visemes from syllable timing, speechSynthesis boundaries when present,
 *                                 // emits bus 'caption' {text, speaker}. Returns {duration, cancel()}
 *   p.setPose('idle'|'walk'|'sit'|'talk'|'slump'|'wave'|'point'|'kneel')
 *   p.posture = 0..1              // 0 upright .. 1 slumped
 *   p.walkSpeed                   // m/s implied by this person's gait (move the group at this speed when walking)
 *   p.update(dt, t, camera)       // animate; face redraw at tier rate (ultra/high 16 AUs ≤30 Hz within 12 m,
 *                                 // medium 8 AUs @10 Hz, low 4 AUs (6,12,4,15) @5 Hz)
 *   p.dispose()
 */
const face2d = require('./face2d.js');

const TIER_FACE = {
  ultra: { aus: null, hz: 30, tex: 256 },
  high: { aus: null, hz: 30, tex: 256 },
  medium: { aus: [1, 2, 4, 6, 12, 15, 25, 26], hz: 10, tex: 192 },
  low: { aus: [4, 6, 12, 15], hz: 5, tex: 128 },
};
const SEGS = { ultra: 20, high: 16, medium: 12, low: 8 };

const PAL = {
  kameezM: ['#f2efe6', '#e8dcc4', '#d9e4ea', '#c9d8c2', '#9fb6c8', '#6f7d5a', '#2b3a6b', '#b8a27a', '#4a6a6a', '#5a4a3a', '#ffffff', '#3b4252'],
  kameezF: ['#9f1239', '#7a2232', '#0f766e', '#b45309', '#e9d2d6', '#6d28d9', '#1e3a8a', '#d8b04a', '#be185d', '#047857', '#f3e8d2', '#7c3aed'],
  dupatta: ['#f4e3c1', '#8e1a2e', '#23317a', '#d9a21c', '#be185d', '#0f766e', '#f8fafc', '#fde68a'],
  hijab: ['#1e1b4b', '#7c2d12', '#334155', '#0f766e', '#9f1239', '#e7e5e4', '#57534e', '#312e81'],
  waistcoat: ['#1c1917', '#3f3f46', '#44403c', '#1e293b', '#4a3728', '#3b2f2f'],
  sweater: ['#7f1d1d', '#1e3a8a', '#365314', '#57534e', '#0c4a6e', '#78350f', '#4c1d95'],
  trousers: ['#1f2937', '#374151', '#3f3f46', '#1e3a5f', '#44403c', '#2d2a26'],
  shirt: ['#dbeafe', '#e0f2fe', '#f1f5f9', '#fef3c7', '#ede9fe'],
  shoes: ['#3a2a1c', '#1c1917', '#4a3020', '#2b2118', '#5b3a24'],
  topi: ['#f8fafc', '#9b1b30', '#23317a', '#2a2a2a'],
};
const OUTFITS = ['shalwar', 'kurta', 'dupatta', 'hijab', 'waistcoat', 'labcoat', 'sweater'];

const JOINTS = ['hips', 'spine', 'chest', 'neck', 'head', 'shL', 'elL', 'haL', 'shR', 'elR', 'haR', 'thL', 'knL', 'ftL', 'thR', 'knR', 'ftR'];

function hrng(seed) {
  let a = (seed * 2654435761) >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];

/* ------------------------------------------------------------- shared textures */
const _shared = { fabric: null, ajrak: null };
function fabricTex(T) {
  if (_shared.fabric) return _shared.fabric;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) { g.fillStyle = `rgba(0,0,0,${0.035 + 0.03 * ((y / 2) % 2)})`; g.fillRect(0, y, 128, 1); }
  for (let x = 0; x < 128; x += 2) { g.fillStyle = 'rgba(0,0,0,0.03)'; g.fillRect(x, 0, 1, 128); }
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},0.04)`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 1); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = T.SRGBColorSpace;
  _shared.fabric = t; return t;
}
/** Ajrak-style block print (madder red, indigo, white) — generic geometric motif. */
function ajrakTex(T) {
  if (_shared.ajrak) return _shared.ajrak;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8e1a2e'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const cx = x * 32 + 16, cy = y * 32 + 16;
    g.fillStyle = '#1d2550'; g.beginPath(); g.moveTo(cx, cy - 12); g.lineTo(cx + 12, cy); g.lineTo(cx, cy + 12); g.lineTo(cx - 12, cy); g.fill();
    g.fillStyle = '#f4ead8'; g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill();
    for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(cx + Math.cos(k * Math.PI / 2) * 8, cy + Math.sin(k * Math.PI / 2) * 8, 1.6, 0, Math.PI * 2); g.fill(); }
  }
  g.fillStyle = '#1b1410'; for (let x = 0; x < 128; x += 4) { g.fillRect(x, 0, 2, 3); g.fillRect(x, 125, 2, 3); }
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = T.SRGBColorSpace;
  _shared.ajrak = t; return t;
}

/* ------------------------------------------------------------- materials */
/** Skin: engine's makeSkinMaterial when available, else MeshStandard + wrap lighting + red-shifted scatter. */
function makeSkin(T, color, extra = {}) {
  try {
    const pf = require('../engine/postfx.js');
    if (pf && typeof pf.makeSkinMaterial === 'function') {
      const m = pf.makeSkinMaterial(Object.assign({ color }, extra));
      if (m && m.isMaterial) return m;
    }
  } catch (e) { /* engine not present: use the local SSS approximation */ }
  const m = new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.58, metalness: 0 }, extra));
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uWrap = { value: 0.5 };
    sh.uniforms.uScatter = { value: new T.Color(0.62, 0.2, 0.1) };
    sh.fragmentShader = 'uniform float uWrap;\nuniform vec3 uScatter;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      {
        // subsurface approximation: wrap lighting past the terminator, red-shifted (Jimenez-style cheap SSS)
        #if NUM_DIR_LIGHTS > 0
        for (int i = 0; i < NUM_DIR_LIGHTS; i++) {
          float nl = dot(normal, directionalLights[i].direction);
          float wrapD = max(0.0, (nl + uWrap) / (1.0 + uWrap)) - max(0.0, nl);
          reflectedLight.directDiffuse += wrapD * directionalLights[i].color * uScatter * material.diffuseColor;
        }
        #endif
        #if NUM_HEMI_LIGHTS > 0
        float rim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
        reflectedLight.indirectDiffuse += rim * 0.18 * uScatter * material.diffuseColor * hemisphereLights[0].skyColor;
        #endif
      }`);
  };
  m.customProgramCacheKey = () => 'zehn-skin-v1';
  return m;
}
function cloth(T, color, opts = {}) {
  const map = opts.pattern === 'ajrak' ? ajrakTex(T) : fabricTex(T);
  return new T.MeshStandardMaterial({ color: opts.pattern === 'ajrak' ? '#ffffff' : color, map, roughness: opts.roughness || 0.88, metalness: 0, side: opts.side || T.FrontSide });
}

/* ------------------------------------------------------------- geometry helpers */
/** Tapered limb: joint at y=0, extends down to y=-len; rounded caps. */
function limbGeo(T, r0, r1, len, seg) {
  const pts = [];
  const cap = 5;
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * Math.PI / 2; pts.push(new T.Vector2(Math.max(1e-4, r1 * Math.sin(a)), -len - r1 * 0.7 * Math.cos(a))); }
  for (let i = 1; i < 6; i++) { const f = i / 6; const r = r1 + (r0 - r1) * f + Math.sin(f * Math.PI) * (r0 + r1) * 0.06; pts.push(new T.Vector2(r, -len + len * f)); }
  for (let i = 0; i <= cap; i++) { const a = (i / cap) * Math.PI / 2; pts.push(new T.Vector2(Math.max(1e-4, r0 * Math.cos(a)), r0 * 0.7 * Math.sin(a))); }
  return new T.LatheGeometry(pts, seg);
}
/** Torso section from a [y, r] profile (bottom→top); elliptical cross-section via depth factor. */
function profileGeo(T, prof, depth, seg, phiStart = 0, phiLen = Math.PI * 2) {
  const pts = prof.map(([y, r]) => new T.Vector2(Math.max(1e-4, r), y));
  const g = new T.LatheGeometry(pts, seg, phiStart, phiLen);
  g.scale(1, 1, depth);
  g.computeVertexNormals();
  return g;
}
function ellipsoid(T, rx, ry, rz, seg) { const g = new T.SphereGeometry(1, seg, Math.max(6, seg * 0.75 | 0)); g.scale(rx, ry, rz); return g; }

/** Shape the unit head sphere: narrower jaw, flatter sides, slight forward chin. */
function shapeHead(g) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (y < 0) { const k = 1 - 0.28 * y * y; x *= k; z *= 1 - 0.12 * y * y; if (z > 0) z += 0.05 * -y * z; }
    if (y > 0.2 && z > 0) z *= 1 - 0.08 * (y - 0.2);
    p.setXYZ(i, x, y, z);
  }
}

/* ------------------------------------------------------------- look / outfit */
function resolveLook(o) {
  const i = o.lookIndex | 0;
  const r = hrng(i + 17);
  const face = Object.assign({}, face2d.look(i));
  const gender = o.gender || (face.hijab || i % 4 === 3 ? 'f' : 'm');
  if (gender === 'f') { face.beard = false; face.cap = null; } else face.hijab = null;
  let outfit = o.outfit;
  if (!outfit || OUTFITS.indexOf(outfit) < 0) {
    outfit = gender === 'm' ? ['shalwar', 'waistcoat', 'kurta', 'sweater', 'labcoat'][i % 5] : face.hijab ? 'hijab' : ['dupatta', 'dupatta', 'labcoat', 'sweater'][(i >> 2) % 4];
  }
  if (outfit === 'hijab' && !face.hijab) face.hijab = pick(PAL.hijab, r);
  if (outfit !== 'hijab' && gender === 'f') face.hijab = null;
  const c = {
    top: gender === 'm' ? pick(PAL.kameezM, r) : pick(PAL.kameezF, r),
    bottom: null, over: null, shoes: pick(PAL.shoes, r), shirt: pick(PAL.shirt, r),
  };
  if (outfit === 'shalwar' || outfit === 'waistcoat' || outfit === 'dupatta' || outfit === 'hijab') c.bottom = gender === 'm' ? c.top : pick(['#f3e8d2', '#1f2937', c.top, '#e7e5e4'], r);
  else c.bottom = pick(PAL.trousers, r);
  if (outfit === 'waistcoat') c.over = pick(PAL.waistcoat, r);
  if (outfit === 'dupatta') c.over = r() < 0.3 ? 'ajrak' : pick(PAL.dupatta, r);
  if (outfit === 'labcoat') { c.over = '#f5f5f2'; c.top = '#f5f5f2'; }
  if (outfit === 'sweater') c.top = pick(PAL.sweater, r);
  if (outfit === 'kurta') c.top = gender === 'm' ? pick(['#f2efe6', '#d9e4ea', '#b8a27a', '#4a6a6a', '#e8dcc4'], r) : pick(PAL.kameezF, r);
  if (outfit === 'hijab') c.over = face.hijab;
  if (face.cap) face.cap = pick(PAL.topi, r);
  if (o.colors) Object.assign(c, o.colors);
  face.shirt = c.top;
  // gait signature (stride, arm swing, cadence) varies by look
  const gait = {
    amp: 0.32 + r() * 0.16,          // thigh swing (rad)
    arm: 0.22 + r() * 0.34,          // arm swing (rad)
    cadence: 1.65 + r() * 0.45,      // steps per second
    bounce: 0.6 + r() * 0.8,
    sway: 0.5 + r() * 1,
    elbow: 0.1 + r() * 0.25,
    phase: r() * 10,
  };
  return { i, gender, outfit, face, colors: c, gait, rng: r };
}

/* ------------------------------------------------------------- viseme timeline from text */
function syllableVisemes(word) {
  const w = word.toLowerCase();
  if (!/[a-z]/.test(w)) { // non-Latin script: alternate open shapes per ~2 characters
    const out = []; const n = Math.max(1, Math.round([...w].length / 2));
    for (let k = 0; k < n; k++) out.push({ pre: null, v: ['A', 'E', 'O', 'A', 'U'][(w.charCodeAt(k) || k) % 5] });
    return out;
  }
  const out = [];
  const re = /([^aeiouy]*)([aeiouy]+)/g;
  let m;
  while ((m = re.exec(w))) {
    const cons = m[1], vow = m[2];
    let pre = null;
    if (/[mbp]$/.test(cons)) pre = 'M'; else if (/[fv]$/.test(cons)) pre = 'F';
    const v0 = vow[0];
    const v = v0 === 'a' ? 'A' : v0 === 'o' ? 'O' : v0 === 'u' ? 'U' : 'E';
    out.push({ pre, v });
  }
  if (out.length > 1 && /e$/.test(w) && !/[aeiouy]e$/.test(w.slice(0, -1) + 'e') && w.length > 3) out.pop(); // silent final e
  if (!out.length) out.push({ pre: /[mbp]/.test(w) ? 'M' : null, v: 'E' });
  if (/[mbp]$/.test(w)) out.push({ pre: null, v: 'M', short: true });
  return out;
}
function buildTimeline(text, rate) {
  const tokens = text.split(/(\s+)/).filter((s) => s.trim());
  const tl = [], words = [];
  let t = 0.05, char = 0;
  const syl = 0.2 / rate;
  for (const tok of tokens) {
    const idx = text.indexOf(tok, char); char = idx >= 0 ? idx + tok.length : char;
    words.push({ t, char: idx });
    for (const s of syllableVisemes(tok.replace(/[^\p{L}\p{N}']/gu, '') || tok)) {
      const d = s.short ? syl * 0.4 : syl;
      if (s.pre) { tl.push({ t0: t, t1: t + d * 0.3, v: s.pre }); tl.push({ t0: t + d * 0.3, t1: t + d, v: s.v }); } else tl.push({ t0: t, t1: t + d * 0.85, v: s.v });
      t += d;
    }
    t += /[.!?؟۔]$/.test(tok) ? 0.38 / rate : /[,;:،]$/.test(tok) ? 0.2 / rate : 0.05 / rate;
  }
  return { tl, words, duration: t + 0.1 };
}

/* ------------------------------------------------------------- the humanoid */
function createHumanoid(THREE_, opts = {}) {
  const T = THREE_ || require('three');
  const tier = TIER_FACE[opts.tier] ? opts.tier : 'high';
  const seg = SEGS[tier];
  const L = resolveLook(opts);
  const female = L.gender === 'f';
  const height = opts.height || (female ? 1.6 : 1.73) + ((L.i * 7919) % 11 - 5) * 0.01;
  const sc = height / 1.75;
  const bus = opts.bus || (opts.sim && opts.sim.bus) || null;
  const fb = Object.assign({}, TIER_FACE[tier], opts.budget ? { hz: opts.budget.faceUpdateHz || TIER_FACE[tier].hz, tex: Math.min(256, opts.budget.faceTexSize || TIER_FACE[tier].tex) } : {});
  if (opts.budget && opts.budget.faceAUs) fb.aus = opts.budget.faceAUs >= 16 ? null : opts.budget.faceAUs >= 8 ? TIER_FACE.medium.aus : TIER_FACE.low.aus;

  const group = new T.Group();
  group.name = opts.name || 'person';
  const disposables = [];
  const G = (g) => { disposables.push(g); return g; };
  const M = (m) => { disposables.push(m); return m; };

  // materials
  const skinHex = L.face.skin;
  const skinMat = M(makeSkin(T, skinHex));
  const topMat = M(cloth(T, L.colors.top));
  const bottomMat = M(cloth(T, L.colors.bottom));
  const shoeMat = M(new T.MeshStandardMaterial({ color: L.colors.shoes, roughness: 0.55 }));
  const hairMat = M(new T.MeshStandardMaterial({ color: L.face.hair, roughness: 0.75 }));
  const panelMat = M(cloth(T, L.colors.top, { side: T.DoubleSide }));

  // bones
  const B = {};
  const bone = (name, parent, x, y, z) => { const o = new T.Object3D(); o.name = name; o.position.set(x * sc, y * sc, z * sc); parent.add(o); B[name] = o; return o; };
  bone('hips', group, 0, 0.92, 0);
  bone('spine', B.hips, 0, 0.08, 0);
  bone('chest', B.spine, 0, 0.22, 0);
  bone('neck', B.chest, 0, 0.25, -0.01);
  bone('head', B.neck, 0, 0.09, 0.01);
  const shX = female ? 0.165 : 0.185;
  bone('shL', B.chest, shX, 0.2, -0.005); bone('elL', B.shL, 0, -0.29, 0); bone('haL', B.elL, 0, -0.25, 0);
  bone('shR', B.chest, -shX, 0.2, -0.005); bone('elR', B.shR, 0, -0.29, 0); bone('haR', B.elR, 0, -0.25, 0);
  B.shL.rotation.order = B.shR.rotation.order = 'YXZ';
  const hipX = female ? 0.09 : 0.092;
  bone('thL', B.hips, hipX, -0.02, 0); bone('knL', B.thL, 0, -0.41, 0); bone('ftL', B.knL, 0, -0.41, 0);
  bone('thR', B.hips, -hipX, -0.02, 0); bone('knR', B.thR, 0, -0.41, 0); bone('ftR', B.knR, 0, -0.41, 0);
  const rest = {}; for (const j of JOINTS) rest[j] = B[j].position.clone();

  const meshes = [];
  const add = (parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
    const m = new T.Mesh(G(geo), mat);
    m.position.set(x * sc, y * sc, z * sc); m.rotation.set(rx, ry, rz); m.scale.setScalar(sc);
    m.castShadow = true; m.receiveShadow = true;
    parent.add(m); meshes.push(m); return m;
  };

  const outfit = L.outfit;
  const tunic = { shalwar: 0.56, waistcoat: 0.56, dupatta: 0.6, hijab: 0.66, kurta: 0.4, labcoat: 0.62, sweater: 0 }[outfit];
  const baggy = outfit === 'shalwar' || outfit === 'waistcoat' || outfit === 'dupatta' || outfit === 'hijab';

  // ---- torso
  const W = female ? { hip: 0.172, waist: 0.128, chest: 0.158, sh: 0.17 } : { hip: 0.158, waist: 0.145, chest: 0.178, sh: 0.188 };
  const pelvisMat = tunic ? topMat : bottomMat;
  add(B.hips, profileGeo(T, [[-0.11, 0], [-0.1, W.hip * 0.6], [-0.07, W.hip * 0.95], [-0.02, W.hip], [0.05, W.hip * 0.97], [0.12, W.waist * 1.02]], 0.7, seg), pelvisMat);
  const chestMesh = new T.Group(); B.chest.add(chestMesh);
  add(B.spine, profileGeo(T, [[-0.05, W.waist * 1.02], [0.06, W.waist], [0.16, (W.waist + W.chest) / 2], [0.25, W.chest * 0.98]], 0.68, seg), topMat);
  add(chestMesh, profileGeo(T, [[-0.06, W.chest * 0.97], [0.04, W.chest], [0.12, W.chest * 1.02], [0.18, W.sh], [0.225, W.sh * 0.88], [0.255, 0.1], [0.27, 0.055], [0.275, 0]], 0.62, seg), topMat);
  if (female) {
    for (const s of [-1, 1]) add(chestMesh, ellipsoid(T, 0.062, 0.058, 0.05, seg), topMat, s * 0.062, 0.075, 0.072);
  }
  // collar
  add(B.chest, new T.TorusGeometry(0.058, 0.012, 6, seg), outfit === 'sweater' ? M(cloth(T, '#f8fafc')) : topMat, 0, 0.255, -0.005, Math.PI / 2 + 0.25, 0, 0);
  // ---- neck & head
  add(B.neck, limbGeo(T, 0.05, 0.052, 0.1, seg), skinMat, 0, 0.1, 0);
  const HR = { x: 0.077, y: 0.106, z: 0.094 };
  const HC = { y: 0.088, z: 0.012 };
  const headGeo = new T.SphereGeometry(1, seg + 8, seg + 4); shapeHead(headGeo); headGeo.scale(HR.x, HR.y, HR.z); headGeo.computeVertexNormals();
  add(B.head, headGeo, skinMat, 0, HC.y, HC.z);
  // ears, nose
  for (const s of [-1, 1]) add(B.head, ellipsoid(T, 0.012, 0.03, 0.02, 8), skinMat, s * HR.x * 0.97, HC.y - 0.004, HC.z - 0.006, 0, s * 0.3, 0);
  const noseY = HC.y - 11 * (HR.y / 80);
  add(B.head, ellipsoid(T, 0.0105, 0.024, 0.016, 10), skinMat, 0, noseY + 0.004, HC.z + HR.z * 0.93, -0.32, 0, 0);
  add(B.head, ellipsoid(T, 0.015, 0.009, 0.011, 8), skinMat, 0, noseY - 0.012, HC.z + HR.z * 0.92);

  // ---- face patch: CanvasTexture drawn by face2d, planar-projected on the front of the head
  const texSize = fb.tex;
  let faceCanvas = null, faceCtx = null, faceTex = null, faceMesh = null;
  if (typeof document !== 'undefined') {
    faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = texSize;
    faceCtx = faceCanvas.getContext('2d');
    faceTex = new T.CanvasTexture(faceCanvas); faceTex.colorSpace = T.SRGBColorSpace; faceTex.anisotropy = 4;
    disposables.push(faceTex);
    const fg = new T.SphereGeometry(1, 28, 24, Math.PI / 2 - 1.2, 2.4, 0.28, 2.5);
    shapeHead(fg); fg.scale(HR.x * 1.006, HR.y * 1.006, HR.z * 1.006); fg.computeVertexNormals();
    const pos = fg.attributes.position, uv = fg.attributes.uv;
    const kx = HR.x / 62, ky = HR.y / 80; // face2d units → metres (head ellipse 62×80 units)
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + pos.getX(i) / kx / 210, 0.5 + (pos.getY(i) / ky) / 210);
    uv.needsUpdate = true;
    const faceMat = M(makeSkin(T, '#ffffff', { map: faceTex, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    faceMesh = add(B.head, fg, faceMat, 0, HC.y, HC.z);
    faceMesh.castShadow = false;
  }

  // ---- hair / headwear
  const hairBase = (thetaBack) => {
    const top = new T.SphereGeometry(1, seg + 4, 10, 0, Math.PI * 2, 0, 1.12); shapeHead(top); top.scale(HR.x * 1.07, HR.y * 1.06, HR.z * 1.07);
    add(B.head, top, hairMat, 0, HC.y + 0.004, HC.z - 0.004);
    const back = new T.SphereGeometry(1, seg + 4, 12, Math.PI, Math.PI, 0, thetaBack); shapeHead(back); back.scale(HR.x * 1.06, HR.y * 1.05, HR.z * 1.08);
    add(B.head, back, hairMat, 0, HC.y + 0.002, HC.z - 0.006);
  };
  if (outfit === 'hijab') {
    const hijMat = M(cloth(T, L.colors.over, { side: T.DoubleSide, roughness: 0.92 }));
    const sx = HR.x * 1.16, sy = HR.y * 1.1, sz = HR.z * 1.14;
    const pieces = [
      new T.SphereGeometry(1, seg + 4, 14, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.94),
      new T.SphereGeometry(1, 12, 6, Math.PI / 2 - 0.95, 1.9, 0, 0.66),
      new T.SphereGeometry(1, 12, 6, Math.PI / 2 - 0.95, 1.9, 2.58, Math.PI * 0.94 - 2.58),
    ];
    for (const g of pieces) { shapeHead(g); g.scale(sx, sy, sz); g.computeVertexNormals(); add(B.head, g, hijMat, 0, HC.y + 0.004, HC.z - 0.004); }
    add(B.chest, profileGeo(T, [[0.07, 0.205], [0.14, 0.2], [0.2, 0.17], [0.26, 0.11], [0.31, 0.075], [0.36, 0.07]], 0.78, seg), hijMat, 0, 0, -0.005);
  } else {
    hairBase(female ? 2.25 : 1.85);
    if (female) {
      add(B.head, new T.CylinderGeometry(0.075, 0.085, 0.2, seg, 1, true, Math.PI - 1.25, 2.5), M(new T.MeshStandardMaterial({ color: L.face.hair, roughness: 0.75, side: T.DoubleSide })), 0, HC.y - 0.12, HC.z - 0.012);
    }
    if (L.face.cap) add(B.head, new T.CylinderGeometry(HR.x * 1.08, HR.x * 1.1, 0.062, seg + 4, 1), M(cloth(T, L.face.cap)), 0, HC.y + HR.y * 0.74, HC.z - 0.004).scale.set(sc, sc, sc * HR.z / HR.x);
  }

  // ---- arms
  const sleeveMat = topMat;
  for (const s of ['L', 'R']) {
    add(B['sh' + s], ellipsoid(T, 0.058, 0.06, 0.055, seg), sleeveMat, 0, -0.01, 0);
    add(B['sh' + s], limbGeo(T, female ? 0.046 : 0.052, female ? 0.037 : 0.042, 0.28, seg), sleeveMat);
    const sleeveEnd = outfit === 'kurta' && L.i % 3 === 0 ? 0.12 : 0.23;
    add(B['el' + s], limbGeo(T, female ? 0.037 : 0.042, female ? 0.03 : 0.035, sleeveEnd, seg), sleeveMat);
    add(B['el' + s], limbGeo(T, 0.031, 0.026, 0.24, seg), skinMat);
    const sd = s === 'L' ? 1 : -1;
    add(B['ha' + s], ellipsoid(T, 0.022, 0.07, 0.04, seg), skinMat, 0, -0.06, 0.005);
    add(B['ha' + s], ellipsoid(T, 0.012, 0.035, 0.013, 8), skinMat, -sd * 0.006, -0.035, 0.035, 0.4, 0, 0);
  }
  // ---- legs
  for (const s of ['L', 'R']) {
    if (baggy) {
      add(B['th' + s], limbGeo(T, 0.1, 0.085, 0.41, seg), bottomMat);
      add(B['kn' + s], limbGeo(T, 0.085, 0.06, 0.37, seg), bottomMat);
      add(B['kn' + s], new T.CylinderGeometry(0.045, 0.047, 0.04, seg), bottomMat, 0, -0.38, 0);
    } else {
      add(B['th' + s], limbGeo(T, female ? 0.085 : 0.08, 0.06, 0.41, seg), bottomMat);
      add(B['kn' + s], limbGeo(T, 0.058, 0.047, 0.39, seg), bottomMat);
    }
    add(B['ft' + s], ellipsoid(T, 0.046, 0.036, 0.115, seg), shoeMat, 0, -0.04, 0.05);
  }
  // ---- tunic panels (kameez/kurta/labcoat) with side slits; front/back follow the thighs
  const panels = [];
  if (tunic) {
    const pm = outfit === 'labcoat' ? M(cloth(T, '#f5f5f2', { side: T.DoubleSide })) : panelMat;
    for (const side of [0, 1]) {
      const piv = new T.Object3D(); piv.position.set(0, 0.06 * sc, 0); B.hips.add(piv);
      const g = new T.CylinderGeometry(W.hip * 1.04, W.hip * 1.28 + tunic * 0.06, tunic, seg, 1, true, side ? Math.PI - 1.3 : -1.3, 2.6);
      g.translate(0, -tunic / 2, 0); g.scale(1, 1, 0.74);
      add(piv, g, pm);
      panels.push({ piv, front: side === 0 });
    }
  }
  // ---- overlays: waistcoat, lab coat front, dupatta
  if (outfit === 'waistcoat') {
    const wm = M(cloth(T, L.colors.over, { side: T.DoubleSide, roughness: 0.7 }));
    add(B.chest, profileGeo(T, [[-0.06, W.chest * 1.04], [0.04, W.chest * 1.05], [0.12, W.chest * 1.07], [0.18, W.sh * 1.0], [0.235, 0.12], [0.255, 0.07]], 0.66, seg, 0.32, Math.PI * 2 - 0.64), wm);
    add(B.spine, profileGeo(T, [[-0.07, W.waist * 1.1], [0.06, W.waist * 1.06], [0.16, (W.waist + W.chest) / 2 * 1.05], [0.25, W.chest * 1.04]], 0.7, seg, 0.32, Math.PI * 2 - 0.64), wm);
    for (let k = 0; k < 3; k++) add(B.spine, new T.SphereGeometry(0.006, 6, 4), M(new T.MeshStandardMaterial({ color: '#d4af37', metalness: 0.6, roughness: 0.4 })), 0.04, 0.02 + k * 0.08, W.waist * 0.72 + 0.006);
  }
  if (outfit === 'labcoat') {
    const shirtM = M(cloth(T, L.colors.shirt));
    add(B.chest, new T.PlaneGeometry(0.075, 0.2), shirtM, 0, 0.13, W.chest * 0.62 + 0.004, -0.12, 0, 0);
    add(B.chest, new T.PlaneGeometry(0.022, 0.17), M(cloth(T, pick(['#1e3a8a', '#7f1d1d', '#334155'], L.rng))), 0, 0.12, W.chest * 0.62 + 0.007, -0.12, 0, 0);
    add(B.chest, new T.BoxGeometry(0.06, 0.005, 0.01), M(new T.MeshStandardMaterial({ color: '#334155' })), 0.09, 0.06, W.chest * 0.62);
  }
  if (outfit === 'dupatta') {
    const dm = M(cloth(T, L.colors.over === 'ajrak' ? '#ffffff' : L.colors.over, { pattern: L.colors.over === 'ajrak' ? 'ajrak' : null, side: T.DoubleSide, roughness: 0.95 }));
    const drape = new T.TorusGeometry(0.15, 0.022, 6, seg * 2, Math.PI * 1.25); drape.rotateZ(-Math.PI * 0.125 - Math.PI / 2); drape.rotateX(Math.PI / 2 - 0.35); drape.scale(1, 1, 0.7);
    add(B.chest, drape, dm, 0, 0.2, -0.03);
    for (const s of [-1, 1]) add(B.chest, new T.PlaneGeometry(0.17, 0.62), dm, s * 0.09, -0.08, -W.chest * 0.62 - 0.012, 0.06, Math.PI, s * 0.06);
  }

  /* ---------------------------------------------------------------- state */
  const st = {
    pose: 'idle', prevPose: 'idle', blendT: 1, posture: 0, t: 0,
    emotion: 'neutral', intensity: 0, explicitAUs: {}, auCur: {}, viseme: 'rest',
    gaze: null, gazeEye: { x: 0, y: 0 }, sacc: { x: 0, y: 0, next: 0 }, headTurn: { y: 0, x: 0 },
    blink: 0, blinkT: -1, nextBlink: 1 + L.rng() * 3,
    walkPhase: L.gait.phase, speech: null, faceAcc: 1, faceSig: '', faceDirty: true,
  };
  const g8 = L.gait;
  const legLen = 0.82 * sc;
  const walkSpeed = 2 * legLen * Math.sin(g8.amp) * g8.cadence * (opts.speed || 1) * 0.92;

  /* ---------------------------------------------------------------- poses */
  function blank() { const P = { root: [0, 0, 0] }; for (const j of JOINTS) P[j] = [0, 0, 0]; return P; }
  function base(P, t) {
    const br = Math.sin(t * Math.PI * 2 * 0.23 + g8.phase);
    P.shL[2] = 0.07; P.shR[2] = -0.07; P.elL[0] = -0.1 - g8.elbow * 0.3; P.elR[0] = -0.1 - g8.elbow * 0.3;
    P.chest[0] = -0.02 - 0.012 * br; P.shL[0] = 0.02 * br; P.shR[0] = 0.02 * br;
    P.haL[2] = -0.05; P.haR[2] = 0.05;
    return br;
  }
  function idle(P, t) {
    base(P, t);
    const w = Math.sin(t * 0.42 + g8.phase), w2 = Math.sin(t * 0.17 + g8.phase * 2);
    P.root[0] = 0.016 * w * sc; P.hips[2] = 0.035 * w; P.spine[2] = -0.025 * w; P.chest[2] = -0.012 * w;
    P.thL[2] = -0.035 * w; P.thR[2] = -0.035 * w;
    P.knL[0] = 0.07 * Math.max(0, w); P.thL[0] = -0.035 * Math.max(0, w); P.knR[0] = 0.07 * Math.max(0, -w); P.thR[0] = -0.035 * Math.max(0, -w);
    P.ftL[0] = -0.035 * Math.max(0, w); P.ftR[0] = -0.035 * Math.max(0, -w);
    P.root[1] = -0.004 * Math.abs(w) * sc;
    P.head[1] = 0.06 * w2; P.head[0] = 0.02 * Math.sin(t * 0.5 + 1.3);
  }
  function walk(P, t) {
    base(P, t);
    const ph = st.walkPhase, s = Math.sin(ph), c = Math.cos(ph);
    const A = g8.amp;
    P.thL[0] = -A * s; P.thR[0] = A * s;
    P.knL[0] = 0.08 + 0.95 * Math.pow(Math.max(0, Math.cos(ph - 0.35)), 2);
    P.knR[0] = 0.08 + 0.95 * Math.pow(Math.max(0, Math.cos(ph - 0.35 + Math.PI)), 2);
    P.ftL[0] = -0.25 * Math.max(0, -Math.sin(ph + 0.5)) + 0.15 * Math.max(0, s) - P.knL[0] * 0.25;
    P.ftR[0] = -0.25 * Math.max(0, Math.sin(ph + 0.5)) - 0.15 * Math.max(0, s) - P.knR[0] * 0.25;
    const drop = legLen * (1 - Math.cos(A));
    P.root[1] = (-drop * 0.7 + drop * 0.45 * Math.cos(2 * ph) * g8.bounce);
    P.root[0] = 0.012 * s * g8.sway * sc;
    P.hips[1] = -0.07 * s; P.hips[2] = 0.03 * s * g8.sway;
    P.chest[1] = 0.1 * s; P.spine[0] = 0.04; P.head[1] = -0.04 * s; P.neck[0] = -0.02;
    P.shL[0] = g8.arm * s; P.shR[0] = -g8.arm * s;
    P.elL[0] = -(0.12 + g8.elbow * 0.5 + 0.3 * Math.max(0, -s) * g8.arm * 2);
    P.elR[0] = -(0.12 + g8.elbow * 0.5 + 0.3 * Math.max(0, s) * g8.arm * 2);
    P.shL[2] = 0.09; P.shR[2] = -0.09;
    void c;
  }
  function sit(P, t) {
    base(P, t);
    const seatH = opts.seatHeight || 0.46;
    P.root[1] = seatH + 0.075 * sc - 0.92 * sc; P.root[2] = -0.06 * sc;
    P.thL[0] = -1.5; P.thR[0] = -1.5; P.thL[2] = 0.07; P.thR[2] = -0.07;
    P.knL[0] = 1.45; P.knR[0] = 1.45; P.ftL[0] = 0.05; P.ftR[0] = 0.05;
    P.spine[0] = 0.04; P.chest[0] += 0.02;
    P.shL[0] = -0.42; P.shR[0] = -0.42; P.elL[0] = -0.75; P.elR[0] = -0.75; P.shL[2] = 0.12; P.shR[2] = -0.12;
    P.haL[0] = 0.1; P.haR[0] = 0.1;
    P.head[1] = 0.05 * Math.sin(t * 0.21 + g8.phase);
  }
  function talk(P, t) {
    idle(P, t);
    const sp = st.speech ? 1 : 0.35;
    const g1 = Math.sin(t * 2.3 + g8.phase), g2 = Math.sin(t * 1.3 + 0.7), en = speechEnergy();
    P.shR[0] = -0.3 - 0.18 * g1 * sp - 0.1 * en; P.elR[0] = -1.05 - 0.25 * g2 * sp; P.shR[2] = -0.16; P.haR[1] = 0.3 * g1;
    P.shL[0] = -0.12 - 0.1 * g2 * sp; P.elL[0] = -0.65 - 0.2 * g1 * sp; P.shL[2] = 0.14;
    P.head[0] += 0.05 * Math.sin(t * 3.3) * en; P.head[2] = 0.04 * Math.sin(t * 0.7);
  }
  function slump(P, t) {
    idle(P, t);
    P.shL[0] = -0.12; P.shR[0] = -0.12; P.shL[2] = 0.02; P.shR[2] = -0.02; P.elL[0] = -0.3; P.elR[0] = -0.3;
    P.head[0] += 0.25; P.root[1] -= 0.01 * sc;
  }
  function wave(P, t) {
    idle(P, t);
    P.shR[2] = -2.35; P.shR[0] = -0.25; P.elR[2] = -0.75 + 0.38 * Math.sin(t * 7.5); P.elR[0] = -0.1; P.haR[2] = -0.1;
    P.head[2] = 0.05;
  }
  function point(P, t) {
    idle(P, t);
    let yaw = -0.15, pitch = 0;
    const tp = gazeWorld();
    if (tp) {
      group.updateWorldMatrix(true, false);
      _v.copy(tp); group.worldToLocal(_v); _v.x -= B.shR.position.x; _v.y -= 1.42 * sc;
      yaw = clamp(Math.atan2(_v.x, _v.z), -1.4, 0.7); pitch = clamp(Math.atan2(_v.y, Math.hypot(_v.x, _v.z)), -0.6, 0.8);
    }
    P.shR[0] = -Math.PI / 2 - pitch; P.shR[1] = yaw; P.shR[2] = 0; P.elR[0] = -0.06; P.haR[0] = -0.1;
    P.chest[1] = yaw * 0.25;
  }
  function kneel(P, t) {
    base(P, t);
    P.root[1] = -0.42 * sc; P.root[2] = 0.05 * sc;
    P.thL[0] = -1.45; P.knL[0] = 1.5; P.ftL[0] = 0;
    P.thR[0] = 0.08; P.knR[0] = 1.5; P.ftR[0] = -0.75;
    P.spine[0] = 0.08; P.shR[0] = -0.8; P.elR[0] = -0.5; P.shL[0] = -0.2; P.elL[0] = -0.5;
    P.head[0] = 0.15;
  }
  const POSES = { idle, walk, sit, talk, slump, wave, point, kneel };

  /* ---------------------------------------------------------------- face */
  function speechEnergy() { const v = face2d.VISEMES[st.viseme] || {}; return Math.max(v[25] || 0, v[26] || 0); }
  function targetAUs() {
    const e = face2d.EMOTIONS[st.emotion] || {};
    const out = {};
    for (const k in e) if (k !== 'unilateral') out[k] = e[k] * st.intensity;
    for (const k in st.explicitAUs) out[k] = Math.max(out[k] || 0, st.explicitAUs[k]);
    const v = face2d.VISEMES[st.viseme];
    if (v && st.viseme !== 'rest') {
      for (const k in v) out[k] = k === '25' || k === '26' ? Math.max(out[k] || 0, v[k]) : Math.max((out[k] || 0) * 0.5, v[k]);
      if (st.viseme === 'M') { out[25] = 0; out[26] = 0; }
    }
    return out;
  }
  function drawFace() {
    if (!faceCtx) return;
    const aus = {};
    const allow = fb.aus;
    for (const k in st.auCur) if (!allow || allow.indexOf(+k) >= 0) aus[k] = st.auCur[k];
    if ((face2d.EMOTIONS[st.emotion] || {}).unilateral && st.intensity > 0) aus.unilateral = 1;
    const s = texSize / 210;
    faceCtx.clearRect(0, 0, texSize, texSize);
    face2d.drawFace(faceCtx, texSize / 2, texSize / 2 - 4 * s, 200 * s, aus, Object.assign({}, L.face, { gaze: st.gazeEye, blink: st.blink }));
    faceTex.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- gaze */
  const _v = new T.Vector3(), _v2 = new T.Vector3();
  function gazeWorld() {
    const g = st.gaze;
    if (!g) return null;
    if (g.isObject3D) { g.getWorldPosition(_v2); return _v2; }
    if (g.isVector3) return g;
    if (Array.isArray(g)) return _v2.set(g[0], g[1], g[2]);
    return null;
  }

  /* ---------------------------------------------------------------- speech */
  function cancelSpeech() {
    if (st.speech && st.speech.utter && typeof window !== 'undefined' && window.speechSynthesis) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    st.speech = null; st.viseme = 'rest';
  }

  /* ---------------------------------------------------------------- API */
  const person = {
    group, bones: B, name: group.name, look: L, height, walkSpeed, tier,
    get posture() { return st.posture; },
    set posture(v) { st.posture = clamp(+v || 0, 0, 1); },
    get pose() { return st.pose; },
    get emotion() { return { name: st.emotion, intensity: st.intensity }; },
    get speaking() { return !!st.speech; },
    setAUs(aus) { st.explicitAUs = Object.assign({}, aus || {}); st.faceDirty = true; return person; },
    setEmotion(name, intensity = 1) { st.emotion = face2d.EMOTIONS[name] ? name : 'neutral'; st.intensity = clamp(intensity, 0, 1); st.faceDirty = true; return person; },
    setGaze(target) { st.gaze = target || null; return person; },
    blink() { st.blinkT = 0; return person; },
    setViseme(v) { st.viseme = face2d.VISEMES[v] ? v : 'rest'; return person; },
    setPose(p) { if (!POSES[p] || p === st.pose) return person; st.prevPose = st.pose; st.pose = p; st.blendT = 0; return person; },
    setPosture(v) { person.posture = v; return person; },
    speak(text, o = {}) {
      cancelSpeech();
      text = String(text || '').trim();
      if (!text) return { duration: 0, cancel() {} };
      const rate = o.rate || opts.speechRate || 1;
      const tl = buildTimeline(text, rate);
      const sp = { text, tl: tl.tl, words: tl.words, duration: tl.duration, start: st.t, utter: null, idx: 0 };
      st.speech = sp;
      if (bus) bus.emit('caption', { text, speaker: opts.name || null });
      const wantVoice = o.voice !== undefined ? o.voice : opts.voice !== false;
      if (wantVoice && typeof window !== 'undefined' && window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function') {
        try {
          const u = new window.SpeechSynthesisUtterance(text);
          u.rate = rate; u.pitch = female ? 1.15 : 0.9; u.lang = o.lang || opts.lang || 'en-US';
          if (opts.volume != null) u.volume = opts.volume;
          u.onboundary = (ev) => {
            if (st.speech !== sp || (ev.name && ev.name !== 'word')) return;
            let k = 0; while (k + 1 < sp.words.length && sp.words[k + 1].char <= ev.charIndex) k++;
            sp.start = st.t - sp.words[k].t; // resync the viseme clock to the spoken word
          };
          u.onend = () => { if (st.speech === sp) { sp.ended = true; } };
          sp.utter = u;
          window.speechSynthesis.speak(u);
        } catch (e) { sp.utter = null; }
      }
      return { duration: tl.duration / 1, cancel: () => { if (st.speech === sp) cancelSpeech(); } };
    },
    stopSpeaking() { cancelSpeech(); return person; },
    update(dt, t, camera) {
      dt = clamp(dt || 0, 0, 0.1);
      st.t += dt;
      const tt = t != null ? t : st.t;
      // --- speech visemes
      if (st.speech) {
        const sp = st.speech, et = st.t - sp.start;
        while (sp.idx < sp.tl.length && sp.tl[sp.idx].t1 < et) sp.idx++;
        const cur = sp.tl[sp.idx];
        st.viseme = cur && et >= cur.t0 ? cur.v : 'rest';
        if (et > sp.duration + (sp.utter && !sp.ended ? 3 : 0) || (sp.ended && et > 0.2 && sp.idx >= sp.tl.length)) { st.speech = null; st.viseme = 'rest'; }
      }
      // --- blink
      st.nextBlink -= dt;
      if (st.nextBlink <= 0 && st.blinkT < 0) { st.blinkT = 0; st.nextBlink = 2.2 + L.rng() * 3.8 - (st.emotion === 'fear' ? 1 : 0); if (L.rng() < 0.12) st.nextBlink = 0.35; }
      if (st.blinkT >= 0) { st.blinkT += dt; const b = st.blinkT / 0.16; st.blink = b < 0.5 ? b * 2 : Math.max(0, 2 - b * 2); if (b >= 1) { st.blinkT = -1; st.blink = 0; } }
      // --- pose & posture
      if (st.pose === 'walk') st.walkPhase += dt * g8.cadence * Math.PI * (opts.speed || 1);
      st.blendT = Math.min(1, st.blendT + dt / 0.35);
      const P = blank(); POSES[st.pose](P, tt);
      if (st.blendT < 1) {
        const Q = blank(); POSES[st.prevPose](Q, tt);
        const w = st.blendT * st.blendT * (3 - 2 * st.blendT);
        for (const k in P) for (let a = 0; a < 3; a++) P[k][a] = Q[k][a] + (P[k][a] - Q[k][a]) * w;
      }
      // body language from emotion + posture slider
      const I = st.intensity, emo = st.emotion;
      let pst = st.posture;
      if (st.pose === 'slump') pst = Math.max(pst, 0.85);
      if (emo === 'sadness') pst = Math.max(pst, pst + 0.45 * I);
      pst = clamp(pst, 0, 1);
      P.spine[0] += 0.2 * pst; P.chest[0] += 0.26 * pst; P.neck[0] += 0.2 * pst; P.head[0] += 0.08 * pst;
      P.shL[0] -= 0.14 * pst; P.shR[0] -= 0.14 * pst; P.shL[2] -= 0.04 * pst; P.shR[2] += 0.04 * pst; P.root[1] -= 0.025 * pst * sc;
      if (emo === 'sadness') P.head[0] += 0.12 * I;
      if (emo === 'anger') { P.chest[0] -= 0.06 * I; P.neck[0] += 0.08 * I; P.head[0] -= 0.04 * I; }
      if (emo === 'fear') { P.shL[2] -= 0.05 * I; P.shR[2] += 0.05 * I; P.neck[0] -= 0.05 * I; P.chest[0] += 0.05 * I; P.head[0] += 0.05 * I; }
      if (emo === 'happiness') { P.chest[0] -= 0.04 * I; P.head[0] -= 0.04 * I; P.head[2] += 0.04 * I * Math.sin(tt * 0.9); }
      if (emo === 'surprise') { P.head[0] -= 0.08 * I; P.chest[0] -= 0.03 * I; }
      if (emo === 'disgust') { P.head[1] += 0.12 * I; P.head[0] -= 0.04 * I; }
      if (emo === 'contempt') { P.head[0] -= 0.07 * I; P.head[2] += 0.06 * I; }
      // --- gaze: head/neck turn + eyes
      const tp = gazeWorld();
      let wantYaw = 0, wantPitch = 0;
      if (tp) {
        group.updateWorldMatrix(true, false);
        _v.copy(tp); group.worldToLocal(_v); _v.y -= 1.62 * sc + P.root[1];
        wantYaw = Math.atan2(_v.x, _v.z); wantPitch = Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
        if (Math.abs(wantYaw) > 2.4) { wantYaw = 0; wantPitch = 0; }
      }
      const turnY = clamp(wantYaw, -1.05, 1.05), turnX = clamp(wantPitch, -0.5, 0.45);
      const kk = 1 - Math.exp(-dt * 5);
      st.headTurn.y += (turnY - st.headTurn.y) * kk; st.headTurn.x += (turnX - st.headTurn.x) * kk;
      P.neck[1] += st.headTurn.y * 0.4; P.head[1] += st.headTurn.y * 0.6;
      P.neck[0] -= st.headTurn.x * 0.4; P.head[0] -= st.headTurn.x * 0.6;
      if (st.sacc.next <= tt) { st.sacc.next = tt + 0.6 + L.rng() * 2.2; st.sacc.x = (L.rng() - 0.5) * (tp ? 0.15 : 0.6); st.sacc.y = (L.rng() - 0.5) * (tp ? 0.1 : 0.35); }
      let ex = st.sacc.x, ey = st.sacc.y;
      if (tp) { ex += (wantYaw - st.headTurn.y) / 0.5; ey -= (wantPitch - st.headTurn.x) / 0.45; }
      if (emo === 'sadness') ey += 0.35 * I;
      ex = clamp(ex, -1, 1); ey = clamp(ey, -1, 1);
      if (Math.abs(ex - st.gazeEye.x) > 0.5 && st.blinkT < 0 && L.rng() < 0.3) st.blinkT = 0; // gaze-shift blink
      st.gazeEye.x += (ex - st.gazeEye.x) * (1 - Math.exp(-dt * 25)); st.gazeEye.y += (ey - st.gazeEye.y) * (1 - Math.exp(-dt * 25));
      // --- apply to bones
      for (const j of JOINTS) B[j].rotation.set(P[j][0], P[j][1], P[j][2]);
      B.hips.position.set(rest.hips.x + P.root[0], rest.hips.y + P.root[1], rest.hips.z + P.root[2]);
      const br = Math.sin(tt * Math.PI * 2 * 0.23 + g8.phase);
      chestMesh.scale.set(1 + 0.012 * br, 1 + 0.008 * br, 1 + 0.02 * br);
      for (const pn of panels) {
        const f = Math.min(P.thL[0], P.thR[0]), b = Math.max(P.thL[0], P.thR[0]);
        pn.piv.rotation.x = pn.front ? Math.min(0, f) * 0.92 : Math.max(0, b) * 0.85 + (st.pose === 'sit' ? 0.05 : 0);
      }
      // --- face AUs (smoothed) and redraw at tier rate
      const tgt = targetAUs();
      let sig = '';
      const ka = 1 - Math.exp(-dt * 12);
      for (const k of face2d.AUS.concat([14])) {
        const c = st.auCur[k] || 0, g = tgt[k] || 0;
        const n = Math.abs(g - c) < 0.003 ? g : c + (g - c) * ka;
        if (n) st.auCur[k] = n; else delete st.auCur[k];
        sig += (n * 40 | 0) + ',';
      }
      sig += (st.gazeEye.x * 20 | 0) + ',' + (st.gazeEye.y * 20 | 0) + ',' + (st.blink * 10 | 0) + st.emotion;
      let hz = fb.hz;
      if (camera && camera.position) {
        const d = camera.position.distanceTo(group.getWorldPosition(_v));
        if (d > 40) hz = 0; else if (d > 12) hz = Math.min(hz, 4);
      }
      st.faceAcc += dt;
      if (hz > 0 && st.faceAcc >= 1 / hz && (sig !== st.faceSig || st.faceDirty)) { st.faceAcc = 0; st.faceSig = sig; st.faceDirty = false; drawFace(); }
    },
    dispose() {
      cancelSpeech();
      if (group.parent) group.parent.remove(group);
      for (const d of disposables) if (d && d.dispose) d.dispose();
      disposables.length = 0;
    },
  };
  drawFace();
  return person;
}

module.exports = { createHumanoid, OUTFITS, buildTimeline, syllableVisemes, TIER_FACE };
