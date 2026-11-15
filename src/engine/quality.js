'use strict';
/**
 * Adaptive quality manager (A3).
 *
 *  - Starting tier from the GPU string (WEBGL_debug_renderer_info) + device hints.
 *  - `?quality=low|medium|high|ultra` (or sim.settings.quality) pins the tier.
 *  - Rolling frame-time re-tier with hysteresis; NEVER auto-promotes into Ultra.
 *  - Per-feature overrides (`override(key, value)`) survive tier changes.
 *  - Per-tier world/people budgets, incl. faces: budget.faceAUs 16/16/8/4, budget.faceUpdateHz.
 */

const TIER_ORDER = ['low', 'medium', 'high', 'ultra'];

// Render features per tier. Each post pass is ALSO gated by sim.settings.toggles[name].
const TIERS = {
  low: {
    label: 'Low', pixelRatio: 0.75, shadows: true, shadowMapSize: 1024, shadowSoft: false, shadowRadius: 40,
    hdr: true, fxaa: true, taa: false, motionBlur: false, ssao: false, bloom: true, bloomLevels: 2, godrays: false,
    ssr: false, volumetric: false, dof: true, dofSamples: 22, lensflare: false, grain: false, vignette: true, chroma: false,
    autoExposure: true, sss: false, anisotropy: 2, textureSize: 256, viewDistance: 420, envMap: false, stars: 600,
  },
  medium: {
    label: 'Medium', pixelRatio: 1.0, shadows: true, shadowMapSize: 2048, shadowSoft: true, shadowRadius: 55,
    hdr: true, fxaa: true, taa: false, motionBlur: false, ssao: true, bloom: true, bloomLevels: 3, godrays: true,
    ssr: false, volumetric: true, dof: true, dofSamples: 22, lensflare: true, grain: true, vignette: true, chroma: true,
    autoExposure: true, sss: true, anisotropy: 4, textureSize: 512, viewDistance: 600, envMap: true, stars: 1400,
  },
  high: {
    label: 'High', pixelRatio: 1.5, shadows: true, shadowMapSize: 2048, shadowSoft: true, shadowRadius: 70,
    hdr: true, fxaa: true, taa: false, motionBlur: true, ssao: true, bloom: true, bloomLevels: 3, godrays: true,
    ssr: true, volumetric: true, dof: true, dofSamples: 36, lensflare: true, grain: true, vignette: true, chroma: true,
    autoExposure: true, sss: true, anisotropy: 8, textureSize: 1024, viewDistance: 800, envMap: true, stars: 2400,
  },
  ultra: {
    label: 'Ultra', pixelRatio: 2.0, shadows: true, shadowMapSize: 4096, shadowSoft: true, shadowRadius: 90,
    hdr: true, fxaa: false, taa: true, motionBlur: true, ssao: true, bloom: true, bloomLevels: 3, godrays: true,
    ssr: true, volumetric: true, dof: true, dofSamples: 48, lensflare: true, grain: true, vignette: true, chroma: true,
    autoExposure: true, sss: true, anisotropy: 16, textureSize: 1024, viewDistance: 1000, envMap: true, stars: 3600,
  },
};

// World / people budgets read by builders (A2, A4) at build time.
const BUDGETS = {
  low:    { faceAUs: 4,  faceUpdateHz: 8,  faceTexSize: 128, crowdCount: 40,  humanoids: 6,  trees: 24,  particles: 300,  lights: 4,  brainResolution: 32, morphs: false, eyeShader: false },
  medium: { faceAUs: 8,  faceUpdateHz: 15, faceTexSize: 256, crowdCount: 90,  humanoids: 12, trees: 48,  particles: 900,  lights: 8,  brainResolution: 48, morphs: false, eyeShader: false },
  high:   { faceAUs: 16, faceUpdateHz: 30, faceTexSize: 512, crowdCount: 160, humanoids: 20, trees: 80,  particles: 2000, lights: 12, brainResolution: 64, morphs: true,  eyeShader: true },
  ultra:  { faceAUs: 16, faceUpdateHz: 60, faceTexSize: 512, crowdCount: 240, humanoids: 32, trees: 120, particles: 4000, lights: 16, brainResolution: 80, morphs: true,  eyeShader: true },
};

function gpuString(renderer) {
  try {
    const gl = renderer.getContext();
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    if (dbg) return String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '');
    return String(gl.getParameter(gl.RENDERER) || '');
  } catch (e) { return ''; }
}

/** GPU string + device hints → tier. Pure function (exported for tests). */
function tierFromGpu(gpu, nav) {
  nav = nav || {};
  const g = String(gpu || '').toLowerCase();
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '');
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || 4;
  if (/swiftshader|llvmpipe|software|microsoft basic|softpipe/.test(g)) return 'low';
  if (mobile) return /apple a1[6-9]|apple m[1-9]|adreno.*7[3-9]\d|mali-g7[1-9]/.test(g) ? 'medium' : 'low';
  if (/rtx [2-5]0[6-9]0|rtx [3-5]0[7-9]0|rtx 40|rtx 50|radeon rx [6-9][7-9]00|apple m[2-9] (pro|max|ultra)/.test(g)) return 'high';
  if (/rtx|gtx 1[06][6-8]0|radeon rx|apple m[1-9]|arc a[57]|arc b|quadro|geforce/.test(g)) return 'high';
  if (/intel.*(uhd|hd graphics)|mali|adreno|powervr/.test(g)) return 'low';
  if (/iris|vega|radeon|intel arc/.test(g)) return 'medium';
  return cores >= 8 && mem >= 8 ? 'high' : 'medium';
}

function readParam(name) {
  try { return new URLSearchParams(location.search).get(name); } catch (e) { return null; }
}

class QualityManager {
  /** @param renderer THREE.WebGLRenderer  @param opts { forced, settingsQuality } */
  constructor(renderer, opts) {
    opts = opts || {};
    this.renderer = renderer;
    this.gpu = gpuString(renderer);
    this.detected = tierFromGpu(this.gpu, typeof navigator !== 'undefined' ? navigator : {});
    let forced = readParam('quality');
    if (!TIERS[forced]) forced = opts.forced && TIERS[opts.forced] ? opts.forced : null;
    this.forcedByUrl = !!(readParam('quality') && TIERS[readParam('quality')]);
    this.tier = forced || this.detected;
    this.auto = !forced;
    this.overrides = {};
    this.settings = Object.assign({}, TIERS[this.tier]);
    this.budget = Object.assign({}, BUDGETS[this.tier]);
    this.samples = new Float32Array(120);
    this.n = 0; this.i = 0;
    this.cooldown = 4;
    this.fps = 60; this.frameMs = 16.7;
    this.listeners = new Set();
    this.maxAnisotropy = renderer.capabilities && renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1;
  }

  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of Array.from(this.listeners)) { try { fn(this.settings, this.tier); } catch (e) { console.warn('[quality] listener', e); } } }

  get anisotropy() { return Math.max(1, Math.min(this.settings.anisotropy, this.maxAnisotropy)); }
  get pixelRatio() { const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1; return Math.min(dpr, this.settings.pixelRatio); }

  /** Tier flag for a feature (post pass gating uses this AND the user toggle). */
  has(name) { return !!this.settings[name]; }

  setTier(tier, opts) {
    opts = opts || {};
    if (tier === 'auto') { this.auto = true; this.cooldown = 4; this.n = 0; return false; }
    if (!TIERS[tier]) return false;
    if (!opts.auto) this.auto = false;
    if (tier === this.tier) return false;
    this.tier = tier;
    this.settings = Object.assign({}, TIERS[tier], this.overrides);
    this.budget = Object.assign({}, BUDGETS[tier]);
    this.cooldown = 5; this.n = 0;
    this._emit();
    return true;
  }

  override(key, value) {
    if (!(key in TIERS.ultra)) return false;
    if (value === undefined) delete this.overrides[key]; else this.overrides[key] = value;
    this.settings[key] = value === undefined ? TIERS[this.tier][key] : value;
    this._emit();
    return true;
  }

  clearOverrides() { this.overrides = {}; this.settings = Object.assign({}, TIERS[this.tier]); this._emit(); }

  /** Per-frame. Returns true when the tier changed. `paused` skips sampling (experiment mode, hidden tab). */
  update(dt, paused) {
    if (paused) return false;
    const d = Math.min(Math.max(dt, 1e-4), 0.25);
    this.samples[this.i] = d; this.i = (this.i + 1) % this.samples.length; this.n = Math.min(this.n + 1, this.samples.length);
    let s = 0; for (let k = 0; k < this.n; k++) s += this.samples[k];
    this.fps = this.n / Math.max(1e-4, s); this.frameMs = 1000 / Math.max(1, this.fps);
    if (this.cooldown > 0) { this.cooldown -= d; return false; }
    if (!this.auto || this.n < this.samples.length) return false;
    const idx = TIER_ORDER.indexOf(this.tier);
    if (this.fps < 28 && idx > 0) return this.setTier(TIER_ORDER[idx - 1], { auto: true });
    // Promote only with lots of headroom, and never into ultra.
    if (this.fps > 85 && idx < 2) return this.setTier(TIER_ORDER[idx + 1], { auto: true });
    return false;
  }
}

module.exports = { TIERS, BUDGETS, TIER_ORDER, QualityManager, tierFromGpu };
