'use strict';
/**
 * Instanced crowd (A4): ONE InstancedMesh of smooth low-poly people (lathe torso, tapered two-segment legs,
 * arms, shaped head with eyes) animated in the vertex shader (walk / idle / sit / talk per instance), with
 * per-instance clothing from an everyday Pakistani palette: shalwar kameez in whites/creams/pastels, women's
 * kameez in jewel tones, dupattas and ajrak-red/indigo shawls, hijabs, white/Sindhi topis.
 * CPU side only steers agents (seek + separation along paths or inside bounds) and writes root matrices.
 *
 *   const crowd = createCrowd(THREE, { count, bounds:{minX,maxX,minZ,maxZ}, paths?:[[[x,z],...],...],
 *                                      seats?:[{x,z,yaw}], seed, tier, y? })
 *   scene.add(crowd.mesh)
 *   crowd.update(dt, t)
 *   crowd.agents[i] = { pos:Vector3, vel:Vector3, state:'walk'|'idle'|'sit'|'talk', target:Vector3|null, yaw, speed, data:{} }
 *   crowd.setBehaviour(fn(i, agent, dt) → true to skip default steering | null)
 *   crowd.setMark(i, '#hex'|null, strength)  // tint an agent (social-model visualisation)
 *   crowd.dispose()
 * Count is scaled by tier: low 0.4, medium 0.7, high 1, ultra 1.3.
 */
const TIER_SCALE = { low: 0.4, medium: 0.7, high: 1, ultra: 1.3 };
const LIMB = { BODY: 0, THIGH_L: 1, THIGH_R: 2, SHIN_L: 3, SHIN_R: 4, ARM_L: 5, ARM_R: 6, HEAD: 7 };
const PART = { ALWAYS: 0, HAIR: 1, HIJAB: 2, TOPI: 3, SHAWL: 4, SKIRT: 5 };
const SLOT = { FIXED: 0, A: 1, B: 2, C: 3, SKIN: 4, D: 5 };
const POSE = { walk: 0, idle: 1, sit: 2, talk: 3 };

const KAMEEZ_M = ['#f2efe6', '#e8dcc4', '#d9e4ea', '#c9d8c2', '#9fb6c8', '#6f7d5a', '#2b3a6b', '#b8a27a', '#f4f4f2', '#4a6a6a', '#8a8070', '#5a4a3a'];
const KAMEEZ_F = ['#9f1239', '#7a2232', '#0f766e', '#b45309', '#e9d2d6', '#6d28d9', '#1e3a8a', '#d8b04a', '#be185d', '#047857', '#f3e8d2', '#c2410c'];
const SHALWAR = ['#f2efe6', '#e8dcc4', '#d8d2c4', '#2f3440', '#f4f4f2', '#c8c0b0', '#1f2937'];
const SHAWLS = ['#8e1a2e', '#23317a', '#8e1a2e', '#1d2550', '#b03a2a', '#d9a21c', '#2f6b3a', '#f4e3c1', '#be185d'];
const HIJABS = ['#1e1b4b', '#7c2d12', '#334155', '#0f766e', '#9f1239', '#e7e5e4', '#57534e'];
const TOPI = ['#f8fafc', '#9b1b30', '#23317a', '#2a2a2a', '#f8fafc'];

function rngOf(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : [...String(seed == null ? 'crowd' : seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ------------------------------------------------------------- geometry */
function tag(T, g, limb, part, slot, color) {
  g = g.index ? g.toNonIndexed() : g;
  const n = g.attributes.position.count;
  const c = new T.Color(color || '#ffffff');
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
  g.setAttribute('color', new T.BufferAttribute(col, 3));
  g.setAttribute('aLimb', new T.BufferAttribute(new Float32Array(n).fill(limb), 1));
  g.setAttribute('aPart', new T.BufferAttribute(new Float32Array(n).fill(part), 1));
  g.setAttribute('aSlot', new T.BufferAttribute(new Float32Array(n).fill(slot), 1));
  return g;
}
function merge(T, parts) {
  const names = ['position', 'normal', 'color', 'aLimb', 'aPart', 'aSlot'];
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const out = new T.BufferGeometry();
  for (const name of names) {
    const size = parts[0].attributes[name].itemSize;
    const arr = new Float32Array(n * size);
    let o = 0;
    for (const p of parts) { arr.set(p.attributes[name].array, o); o += p.attributes[name].array.length; }
    out.setAttribute(name, new T.BufferAttribute(arr, size));
  }
  for (const p of parts) p.dispose();
  return out;
}
function lathe(T, prof, seg, depth = 1, phiStart = 0, phiLen = Math.PI * 2) {
  const g = new T.LatheGeometry(prof.map(([y, r]) => new T.Vector2(Math.max(1e-4, r), y)), seg, phiStart, phiLen);
  g.scale(1, 1, depth); g.computeVertexNormals(); return g;
}
function limb(T, r0, r1, top, bottom, x, seg) {
  const len = top - bottom;
  const g = lathe(T, [[-len - r1 * 0.6, 0], [-len - r1 * 0.45, r1 * 0.75], [-len, r1], [-len * 0.5, (r0 + r1) / 2 * 1.04], [0, r0], [r0 * 0.5, r0 * 0.7], [r0 * 0.6, 0]], seg);
  g.translate(x, top, 0); return g;
}
function ell(T, rx, ry, rz, x, y, z, seg = 8) { const g = new T.SphereGeometry(1, seg, Math.max(5, seg * 0.7 | 0)); g.scale(rx, ry, rz); g.translate(x, y, z); return g; }

function personGeometry(T, seg) {
  const P = [];
  const add = (g, limbId, part, slot, col) => P.push(tag(T, g, limbId, part, slot, col));
  // legs: thigh (hip 0.9 → knee 0.48), shin (knee → ankle 0.08), foot
  for (const s of [1, -1]) {
    const th = s > 0 ? LIMB.THIGH_L : LIMB.THIGH_R, sh = s > 0 ? LIMB.SHIN_L : LIMB.SHIN_R;
    add(limb(T, 0.088, 0.072, 0.9, 0.48, s * 0.09, seg), th, PART.ALWAYS, SLOT.B);
    add(limb(T, 0.07, 0.05, 0.48, 0.09, s * 0.09, seg), sh, PART.ALWAYS, SLOT.B);
    add(ell(T, 0.045, 0.035, 0.11, s * 0.09, 0.035, 0.045, 6), sh, PART.ALWAYS, SLOT.FIXED, '#3a2a1c');
  }
  // torso
  add(lathe(T, [[0.8, 0], [0.82, 0.13], [0.88, 0.16], [1.0, 0.152], [1.1, 0.145], [1.24, 0.17], [1.36, 0.18], [1.42, 0.16], [1.46, 0.1], [1.48, 0.05], [1.485, 0]], seg, 0.64), LIMB.BODY, PART.ALWAYS, SLOT.A);
  // kameez skirt with side slits (front/back panels)
  for (const side of [0, 1]) {
    const g = new T.CylinderGeometry(0.162, 0.21, 0.5, seg, 1, true, side ? Math.PI - 1.3 : -1.3, 2.6);
    g.translate(0, 0.73, 0); g.scale(1, 1, 0.72);
    const gi = g.toNonIndexed(); g.dispose();
    // double-sided: append flipped copy
    const back = gi.clone(); const pos = back.attributes.position.array, nor = back.attributes.normal.array;
    for (let i = 0; i < pos.length; i += 9) { for (let k = 0; k < 3; k++) { const a = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = a; } }
    for (let i = 0; i < nor.length; i += 9) { for (let k = 0; k < 3; k++) { const a = nor[i + 3 + k]; nor[i + 3 + k] = nor[i + 6 + k]; nor[i + 6 + k] = a; } }
    for (let i = 0; i < nor.length; i++) nor[i] = -nor[i];
    add(gi, LIMB.BODY, PART.SKIRT, SLOT.A); add(back, LIMB.BODY, PART.SKIRT, SLOT.A);
  }
  // shawl / dupatta over the shoulders + hanging ends
  add(lathe(T, [[1.22, 0.19], [1.32, 0.195], [1.4, 0.175], [1.45, 0.12], [1.47, 0.075]], seg, 0.72), LIMB.BODY, PART.SHAWL, SLOT.C);
  add(ell(T, 0.07, 0.25, 0.02, 0.1, 1.1, 0.115, 6), LIMB.BODY, PART.SHAWL, SLOT.C);
  // arms (shoulder pivot 1.42)
  for (const s of [1, -1]) {
    const a = s > 0 ? LIMB.ARM_L : LIMB.ARM_R;
    add(ell(T, 0.06, 0.06, 0.055, s * 0.185, 1.41, 0, 6), a, PART.ALWAYS, SLOT.A);
    add(limb(T, 0.05, 0.036, 1.41, 0.92, s * 0.19, seg), a, PART.ALWAYS, SLOT.A);
    add(limb(T, 0.032, 0.026, 0.94, 0.82, s * 0.19, 6), a, PART.ALWAYS, SLOT.SKIN);
    add(ell(T, 0.022, 0.06, 0.038, s * 0.19, 0.78, 0.005, 6), a, PART.ALWAYS, SLOT.SKIN);
  }
  // neck, head (jaw-shaped), eyes, brows, hair, hijab, topi
  add(limb(T, 0.048, 0.05, 1.56, 1.46, 0, seg), LIMB.HEAD, PART.ALWAYS, SLOT.SKIN);
  const head = new T.SphereGeometry(1, seg + 2, seg); const hp = head.attributes.position;
  for (let i = 0; i < hp.count; i++) { let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i); if (y < 0) { x *= 1 - 0.28 * y * y; z *= 1 - 0.1 * y * y; } hp.setXYZ(i, x, y, z); }
  head.scale(0.077, 0.106, 0.094); head.translate(0, 1.645, 0.012); head.computeVertexNormals();
  add(head, LIMB.HEAD, PART.ALWAYS, SLOT.SKIN);
  add(ell(T, 0.011, 0.022, 0.016, 0, 1.628, 0.103, 5), LIMB.HEAD, PART.ALWAYS, SLOT.SKIN);
  for (const s of [1, -1]) {
    add(ell(T, 0.011, 0.007, 0.006, s * 0.029, 1.652, 0.093, 6), LIMB.HEAD, PART.ALWAYS, SLOT.FIXED, '#1a1410');
    add(ell(T, 0.017, 0.004, 0.006, s * 0.03, 1.672, 0.092, 5), LIMB.HEAD, PART.ALWAYS, SLOT.FIXED, '#1a1410');
  }
  add(ell(T, 0.018, 0.004, 0.006, 0, 1.597, 0.092, 5), LIMB.HEAD, PART.ALWAYS, SLOT.FIXED, '#6b2a2a');
  const hair = new T.SphereGeometry(1, seg + 2, 8, 0, Math.PI * 2, 0, 1.2); hair.scale(0.083, 0.113, 0.1); hair.translate(0, 1.65, 0.006);
  add(hair, LIMB.HEAD, PART.HAIR, SLOT.FIXED, '#17110d');
  const hairB = new T.SphereGeometry(1, seg + 2, 8, Math.PI, Math.PI, 0, 1.9); hairB.scale(0.082, 0.112, 0.1); hairB.translate(0, 1.648, 0.006);
  add(hairB, LIMB.HEAD, PART.HAIR, SLOT.FIXED, '#17110d');
  const hij = new T.SphereGeometry(1, seg + 2, 10, Math.PI / 2 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.93); hij.scale(0.09, 0.118, 0.106); hij.translate(0, 1.648, 0.008);
  add(hij, LIMB.HEAD, PART.HIJAB, SLOT.D);
  const hijT = new T.SphereGeometry(1, 8, 4, Math.PI / 2 - 0.95, 1.9, 0, 0.66); hijT.scale(0.09, 0.118, 0.106); hijT.translate(0, 1.648, 0.008);
  add(hijT, LIMB.HEAD, PART.HIJAB, SLOT.D);
  add(lathe(T, [[1.3, 0.2], [1.38, 0.18], [1.45, 0.12], [1.52, 0.07]], seg, 0.78), LIMB.BODY, PART.HIJAB, SLOT.D);
  const topi = new T.CylinderGeometry(0.083, 0.086, 0.06, seg + 2); topi.scale(1, 1, 1.18); topi.translate(0, 1.73, 0.008);
  add(topi, LIMB.HEAD, PART.TOPI, SLOT.D);
  return merge(T, P);
}

/* ------------------------------------------------------------- material */
const VERT_PARS = /* glsl */`
attribute float aLimb;
attribute float aPart;
attribute float aSlot;
attribute vec4 aGait;   // x step rate (rad/s), y thigh amplitude, z phase, w pose (0 walk,1 idle,2 sit,3 talk)
attribute vec4 aStyle;  // x hijab, y topi, z shawl, w skirt
attribute vec3 aColA;   // kameez / top
attribute vec3 aColB;   // shalwar / trousers
attribute vec3 aColC;   // shawl / dupatta
attribute vec4 aColD;   // rgb headwear, a skin tone 0..1
attribute vec4 aMark;   // rgb tint, a strength
uniform float uCrowdTime;
varying vec4 vMark;
vec3 rotX(vec3 p, float py, float pz, float a) { float s = sin(a), c = cos(a); float y = p.y - py, z = p.z - pz; return vec3(p.x, py + y * c - z * s, pz + y * s + z * c); }
vec3 rotXn(vec3 n, float a) { float s = sin(a), c = cos(a); return vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c); }
void crowdAnim(inout vec3 p, inout vec3 n) {
  float pose = aGait.w;
  float t = uCrowdTime * aGait.x + aGait.z;
  float A = aGait.y;
  bool visible = true;
  if (aPart > 0.5 && aPart < 1.5) visible = aStyle.x < 0.5 && aStyle.y < 0.5 || (aStyle.x < 0.5 && aStyle.y > 0.5 && p.y < 1.72);
  else if (aPart > 1.5 && aPart < 2.5) visible = aStyle.x > 0.5;
  else if (aPart > 2.5 && aPart < 3.5) visible = aStyle.y > 0.5;
  else if (aPart > 3.5 && aPart < 4.5) visible = aStyle.z > 0.5;
  else if (aPart > 4.5) visible = aStyle.w > 0.5;
  if (!visible) { p = vec3(0.0, 1.0, 0.0); return; }
  float thL = 0.0, thR = 0.0, knL = 0.0, knR = 0.0, arL = 0.0, arR = 0.0, lean = 0.0, headX = 0.0, drop = 0.0;
  if (pose < 0.5) {               // walk
    float s = sin(t);
    thL = -A * s; thR = A * s;
    knL = 0.08 + 0.9 * pow(max(0.0, cos(t - 0.35)), 2.0);
    knR = 0.08 + 0.9 * pow(max(0.0, cos(t - 0.35 + 3.14159265)), 2.0);
    arL = A * 0.9 * s; arR = -A * 0.9 * s;
    float d = 0.82 * (1.0 - cos(A));
    drop = d * 0.7 - d * 0.45 * cos(2.0 * t);
    lean = 0.04;
  } else if (pose < 1.5) {        // idle: weight shift + breathing
    float w = sin(uCrowdTime * 0.42 + aGait.z);
    knL = 0.06 * max(0.0, w); knR = 0.06 * max(0.0, -w); thL = -0.5 * knL; thR = -0.5 * knR;
    arL = 0.03 * sin(uCrowdTime * 1.4 + aGait.z); arR = arL;
    headX = 0.03 * sin(uCrowdTime * 0.5 + aGait.z);
  } else if (pose < 2.5) {        // sit
    thL = -1.5; thR = -1.5; knL = 1.45; knR = 1.45; arL = -0.55; arR = -0.55; drop = 0.395; lean = 0.03;
  } else {                        // talk: gestures + nods
    float g = sin(uCrowdTime * 2.3 + aGait.z);
    arR = -0.55 - 0.25 * g; arL = -0.15 - 0.1 * sin(uCrowdTime * 1.3 + aGait.z);
    headX = 0.06 * sin(uCrowdTime * 3.1 + aGait.z);
  }
  // legs: shin rotates at the knee, then the whole leg at the hip
  if (aLimb > 2.5 && aLimb < 4.5) {
    float kn = aLimb < 3.5 ? knL : knR;
    p = rotX(p, 0.48, 0.0, kn); n = rotXn(n, kn);
  }
  if (aLimb > 0.5 && aLimb < 4.5) {
    float th = (aLimb == 1.0 || aLimb == 3.0) ? thL : thR;
    p = rotX(p, 0.9, 0.0, th); n = rotXn(n, th);
  }
  // kameez front panel follows the forward-most thigh, back panel the backward-most
  if (aPart > 4.5) {
    float f = p.z > 0.0 ? min(0.0, min(thL, thR)) * 0.92 : max(0.0, max(thL, thR)) * 0.85;
    p = rotX(p, 0.86, 0.0, f); n = rotXn(n, f);
  }
  if (aLimb > 4.5 && aLimb < 6.5) {
    float ar = aLimb < 5.5 ? arL : arR;
    float el = (pose > 1.5 && pose < 2.5) ? -0.0 : 0.0;
    p = rotX(p, 1.42, 0.0, ar + el); n = rotXn(n, ar + el);
  }
  if (aLimb > 6.5) { p = rotX(p, 1.5, 0.0, headX); n = rotXn(n, headX); }
  if ((aLimb < 0.5 || aLimb > 4.5) && p.y > 0.95 && lean != 0.0) { p = rotX(p, 0.95, 0.0, lean); n = rotXn(n, lean); }
  p.y -= drop;
}
`;

function crowdMaterial(T, time) {
  const m = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCrowdTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\n' + VERT_PARS)
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvec3 crowdP = position; crowdAnim(crowdP, objectNormal);')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = crowdP;')
      .replace('#include <color_vertex>', `#include <color_vertex>
        {
          vec3 skin = mix(vec3(0.6, 0.38, 0.24), vec3(0.3, 0.18, 0.1), aColD.a);
          if (aSlot > 0.5 && aSlot < 1.5) vColor.rgb = aColA;
          else if (aSlot > 1.5 && aSlot < 2.5) vColor.rgb = aColB;
          else if (aSlot > 2.5 && aSlot < 3.5) vColor.rgb = aColC;
          else if (aSlot > 3.5 && aSlot < 4.5) vColor.rgb = skin;
          else if (aSlot > 4.5) vColor.rgb = aColD.rgb;
          vMark = aMark;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vMark;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vMark.rgb, vMark.a);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vMark.rgb * vMark.a * 0.35;');
  };
  m.customProgramCacheKey = () => 'zehn-crowd-v1';
  return m;
}

/* ------------------------------------------------------------- crowd */
function normBounds(b) {
  if (!b) return { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  if (b.isBox3) return { minX: b.min.x, maxX: b.max.x, minZ: b.min.z, maxZ: b.max.z };
  if (Array.isArray(b.min)) return { minX: b.min[0], maxX: b.max[0], minZ: b.min[1], maxZ: b.max[1] };
  return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
}

function createCrowd(THREE_, opts = {}) {
  const T = THREE_ || require('three');
  const tier = TIER_SCALE[opts.tier] ? opts.tier : 'high';
  const count = Math.max(1, Math.round((opts.count == null ? 60 : opts.count) * TIER_SCALE[tier]));
  const rng = rngOf(opts.seed == null ? 'mohalla' : opts.seed);
  const bounds = normBounds(opts.bounds);
  const paths = (opts.paths || []).filter((p) => p && p.length >= 2);
  const seats = (opts.seats || []).map((s) => Object.assign({ taken: -1 }, s));
  const floorY = opts.y || 0;
  const seg = tier === 'low' ? 6 : tier === 'medium' ? 8 : 10;

  const geo = personGeometry(T, seg);
  const time = { value: 0 };
  const mat = crowdMaterial(T, time);
  const mesh = new T.InstancedMesh(geo, mat, count);
  mesh.name = 'crowd';
  mesh.frustumCulled = false;
  mesh.castShadow = tier !== 'low'; mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const mk = (size) => { const a = new T.InstancedBufferAttribute(new Float32Array(count * size), size); geo.setAttribute.bind(geo); return a; };
  const A = { gait: mk(4), style: mk(4), colA: mk(3), colB: mk(3), colC: mk(3), colD: mk(4), mark: mk(4) };
  geo.setAttribute('aGait', A.gait); geo.setAttribute('aStyle', A.style); geo.setAttribute('aColA', A.colA); geo.setAttribute('aColB', A.colB);
  geo.setAttribute('aColC', A.colC); geo.setAttribute('aColD', A.colD); geo.setAttribute('aMark', A.mark);
  A.gait.setUsage(T.DynamicDrawUsage); A.mark.setUsage(T.DynamicDrawUsage);
  const _c = new T.Color();
  const setCol = (attr, i, hex) => { _c.set(hex); attr.array[i * attr.itemSize] = _c.r; attr.array[i * attr.itemSize + 1] = _c.g; attr.array[i * attr.itemSize + 2] = _c.b; };
  const pick = (a) => a[Math.floor(rng() * a.length) % a.length];

  const randPoint = () => new T.Vector3(bounds.minX + rng() * (bounds.maxX - bounds.minX), floorY, bounds.minZ + rng() * (bounds.maxZ - bounds.minZ));
  const agents = [];
  for (let i = 0; i < count; i++) {
    const female = rng() < 0.45;
    const hijab = female && rng() < 0.45, shawl = !hijab && (female ? rng() < 0.85 : rng() < 0.3);
    const topi = !female && rng() < 0.3, skirt = rng() < 0.85;
    setCol(A.colA, i, female ? pick(KAMEEZ_F) : pick(KAMEEZ_M));
    setCol(A.colB, i, skirt ? (female ? pick(['#f3e8d2', '#1f2937', '#e7e5e4', '#f2efe6']) : pick(SHALWAR)) : pick(['#1f2937', '#374151', '#1e3a5f', '#44403c']));
    if (!female && skirt && rng() < 0.6) { A.colB.array[i * 3] = A.colA.array[i * 3]; A.colB.array[i * 3 + 1] = A.colA.array[i * 3 + 1]; A.colB.array[i * 3 + 2] = A.colA.array[i * 3 + 2]; }
    setCol(A.colC, i, pick(SHAWLS));
    setCol(A.colD, i, hijab ? pick(HIJABS) : pick(TOPI)); A.colD.array[i * 4 + 3] = rng();
    A.style.array.set([hijab ? 1 : 0, topi ? 1 : 0, shawl ? 1 : 0, skirt ? 1 : 0], i * 4);
    const amp = 0.3 + rng() * 0.16, cadence = 1.6 + rng() * 0.5;
    const scale = (female ? 0.92 : 0.99) + (rng() - 0.5) * 0.08;
    const speed = 2 * 0.82 * scale * Math.sin(amp) * cadence * 0.92;
    A.gait.array.set([cadence * Math.PI, amp, rng() * 20, POSE.walk], i * 4);
    let pos, target = null, pathIdx = -1, wp = 0, dir = 1;
    if (paths.length && rng() < 0.85) {
      pathIdx = i % paths.length; const p = paths[pathIdx]; wp = Math.floor(rng() * (p.length - 1));
      const f = rng(), a = p[wp], b = p[wp + 1];
      pos = new T.Vector3(a[0] + (b[0] - a[0]) * f + (rng() - 0.5) * 0.8, floorY, a[1] + (b[1] - a[1]) * f + (rng() - 0.5) * 0.8);
      wp = wp + 1; target = new T.Vector3(b[0], floorY, b[1]); dir = rng() < 0.5 ? 1 : -1;
      if (dir < 0) { wp = wp - 1; target.set(a[0], floorY, a[1]); }
    } else { pos = randPoint(); target = randPoint(); }
    const startIdle = rng() < 0.25;
    agents.push({ i, pos, vel: new T.Vector3(), state: startIdle ? 'idle' : 'walk', target, yaw: rng() * Math.PI * 2, speed, baseSpeed: speed, scale, female, wait: startIdle ? 2 + rng() * 6 : 0, pathIdx, wp, dir, seat: -1, data: {} });
  }

  let behaviour = null;
  const grid = new Map();
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _s = new T.Vector3(), _up = new T.Vector3(0, 1, 0), _d = new T.Vector3();

  function nextTarget(a) {
    if (a.pathIdx >= 0) {
      const p = paths[a.pathIdx];
      a.wp += a.dir;
      if (a.wp >= p.length || a.wp < 0) { a.dir = -a.dir; a.wp += 2 * a.dir; }
      a.wp = Math.max(0, Math.min(p.length - 1, a.wp));
      a.target = new T.Vector3(p[a.wp][0] + (rng() - 0.5) * 0.6, floorY, p[a.wp][1] + (rng() - 0.5) * 0.6);
    } else a.target = randPoint();
  }
  function arrive(a) {
    const r = rng();
    if (seats.length && r < 0.15) {
      const free = seats.filter((s) => s.taken < 0);
      if (free.length) { const s = free[Math.floor(rng() * free.length)]; s.taken = a.i; a.seat = seats.indexOf(s); a.target = new T.Vector3(s.x, floorY, s.z); a.state = 'walk'; a.data.toSeat = true; return; }
    }
    if (r < 0.45) { a.state = rng() < 0.35 ? 'talk' : 'idle'; a.wait = 2 + rng() * 7; a.vel.set(0, 0, 0); }
    nextTarget(a);
  }
  function cellKey(x, z) { return ((Math.floor(x) + 1000) * 4096 + (Math.floor(z) + 1000)) | 0; }

  function steer(a, dt) {
    if (a.state === 'sit') {
      a.wait -= dt;
      if (a.wait <= 0) { a.state = 'walk'; if (a.seat >= 0) { seats[a.seat].taken = -1; a.seat = -1; } nextTarget(a); }
      a.vel.set(0, 0, 0); return;
    }
    if (a.state === 'idle' || a.state === 'talk') { a.wait -= dt; a.vel.multiplyScalar(0.8); if (a.wait <= 0) a.state = 'walk'; return; }
    if (!a.target) nextTarget(a);
    _d.subVectors(a.target, a.pos); _d.y = 0;
    const dist = _d.length();
    if (dist < 0.35) {
      if (a.data.toSeat && a.seat >= 0) { a.data.toSeat = false; a.state = 'sit'; a.wait = 10 + rng() * 25; a.pos.copy(a.target); a.yaw = seats[a.seat].yaw || 0; a.vel.set(0, 0, 0); return; }
      arrive(a); return;
    }
    _d.multiplyScalar(a.speed / Math.max(dist, 1e-6));
    // separation
    const sx = a.pos.x, sz = a.pos.z;
    let px = 0, pz = 0;
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      const cell = grid.get(cellKey(sx + ox, sz + oz)); if (!cell) continue;
      for (const b of cell) {
        if (b === a) continue;
        const dx = sx - b.pos.x, dz = sz - b.pos.z, d2 = dx * dx + dz * dz;
        if (d2 < 0.6 && d2 > 1e-6) { const d = Math.sqrt(d2), f = (0.78 - d) / d; px += dx * f; pz += dz * f; }
      }
    }
    _d.x += px * 1.6; _d.z += pz * 1.6;
    a.vel.lerp(_d, 1 - Math.exp(-dt * 4));
  }

  function writeInstance(a) {
    const i = a.i;
    _q.setFromAxisAngle(_up, a.yaw); _s.setScalar(a.scale);
    _m.compose(a.pos, _q, _s); mesh.setMatrixAt(i, _m);
    const pose = POSE[a.state] != null ? POSE[a.state] : POSE.idle;
    A.gait.array[i * 4 + 3] = pose;
    if (pose === POSE.walk) { const v = a.vel.length(); A.gait.array[i * 4 + 1] = Math.min(0.48, Math.max(0.12, 0.3 + 0.16 * (v / Math.max(0.2, a.baseSpeed) - 0.5))); }
  }

  const crowd = {
    mesh, group: mesh, agents, count, tier, bounds,
    setBehaviour(fn) { behaviour = typeof fn === 'function' ? fn : null; return crowd; },
    setMark(i, color, strength = 0.65) {
      if (i < 0 || i >= count) return crowd;
      if (!color) A.mark.array.set([0, 0, 0, 0], i * 4);
      else { _c.set(color); A.mark.array.set([_c.r, _c.g, _c.b, strength], i * 4); }
      A.mark.needsUpdate = true; return crowd;
    },
    clearMarks() { A.mark.array.fill(0); A.mark.needsUpdate = true; return crowd; },
    update(dt, t) {
      dt = Math.min(0.1, Math.max(0, dt || 0));
      time.value = t != null ? t : time.value + dt;
      grid.clear();
      for (const a of agents) { const k = cellKey(a.pos.x, a.pos.z); let c = grid.get(k); if (!c) grid.set(k, (c = [])); c.push(a); }
      for (const a of agents) {
        const skip = behaviour ? behaviour(a.i, a, dt) === true : false;
        if (!skip) steer(a, dt);
        if (a.state === 'walk' || skip) {
          a.pos.x += a.vel.x * dt; a.pos.z += a.vel.z * dt;
          if (!skip) { a.pos.x = Math.max(bounds.minX, Math.min(bounds.maxX, a.pos.x)); a.pos.z = Math.max(bounds.minZ, Math.min(bounds.maxZ, a.pos.z)); }
        }
        const v2 = a.vel.x * a.vel.x + a.vel.z * a.vel.z;
        if (v2 > 0.01 && a.state !== 'sit') {
          const want = Math.atan2(a.vel.x, a.vel.z);
          let dy = want - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          a.yaw += dy * (1 - Math.exp(-dt * 6));
        } else if (a.faceTo) { const want = Math.atan2(a.faceTo.x - a.pos.x, a.faceTo.z - a.pos.z); let dy = want - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * (1 - Math.exp(-dt * 4)); }
        writeInstance(a);
      }
      mesh.instanceMatrix.needsUpdate = true; A.gait.needsUpdate = true;
    },
    dispose() {
      if (mesh.parent) mesh.parent.remove(mesh);
      geo.dispose(); mat.dispose(); if (mesh.dispose) mesh.dispose();
    },
  };
  crowd.update(0, 0);
  return crowd;
}

module.exports = { createCrowd, TIER_SCALE, POSE };
