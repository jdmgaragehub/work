'use strict';
/**
 * Shared PBR material library (A3). `mats.get(name)` returns a cached material; clone it if you need
 * to tint per-object. Materials whose `userData.ssr` is true (terrazzo, marble, tiles, polished wood,
 * water) are picked up by Engine.refreshSSR() and receive screen-space reflections on High+.
 *
 *   names: brick, plaster, concrete, terrazzo, marble, tiles, wood, woodPolished, glass, metal, brass,
 *          fabric, carpet, grass, water, jaali, ajrak, chalkboard, screen, skin, paper, rubber, plastic,
 *          sandstone, indigo, crimson, teal, saffron, chalk
 *   mats.emissive(color, intensity) · mats.color(hex, opts) · mats.screen(texture) · mats.update(dt)
 */
const THREE = require('three');
const { makeSkinMaterial } = require('./postfx.js');

const PALETTE = { indigo: 0x1e1b4b, crimson: 0x9f1239, teal: 0x0f766e, saffron: 0xf59e0b, chalk: 0xf8fafc };

class MaterialLibrary {
  constructor(textures, quality) {
    this.tex = textures; this.quality = quality; this.cache = new Map(); this._time = 0; this._animated = [];
  }

  _tex(name, repeat) {
    const set = this.tex.get(name), out = {};
    for (const k of Object.keys(set)) {
      // Per-material clone so repeat can differ while the image stays shared.
      const t = set[k].clone(); t.repeat.set(repeat, repeat); t.needsUpdate = true; out[k] = t;
    }
    return out;
  }

  _std(name, texName, repeat, params, ssr) {
    const p = Object.assign({}, params);
    if (texName) Object.assign(p, this._tex(texName, repeat));
    if (p.normalMap && p.normalScale == null) p.normalScale = new THREE.Vector2(1, 1);
    const m = new THREE.MeshStandardMaterial(p);
    m.name = name; if (ssr) m.userData.ssr = ssr;
    return m;
  }

  _build(name) {
    switch (name) {
      case 'brick': return this._std(name, 'brick', 2, { roughness: 1, metalness: 0 });
      case 'plaster': return this._std(name, 'plaster', 2, { roughness: 1, metalness: 0, color: 0xf3ece0 });
      case 'concrete': return this._std(name, 'concrete', 3, { roughness: 1, metalness: 0 });
      case 'sandstone': return this._std(name, 'plaster', 2, { roughness: 1, metalness: 0, color: 0xd9b989 });
      case 'terrazzo': return this._std(name, 'terrazzo', 3, { roughness: 1, metalness: 0, envMapIntensity: 1.2 }, 1);
      case 'marble': return this._std(name, 'marble', 2, { roughness: 1, metalness: 0, envMapIntensity: 1.2 }, 1);
      case 'tiles': return this._std(name, 'tiles', 4, { roughness: 1, metalness: 0 }, 0.8);
      case 'wood': return this._std(name, 'wood', 1, { roughness: 1, metalness: 0 });
      case 'woodPolished': return this._std(name, 'wood', 2, { roughness: 0.55, metalness: 0, color: 0xc9a47c }, 0.6);
      case 'fabric': return this._std(name, 'fabric', 4, { roughness: 1, metalness: 0 });
      case 'carpet': return this._std(name, 'carpet', 1, { roughness: 1, metalness: 0 });
      case 'grass': return this._std(name, 'grass', 24, { roughness: 1, metalness: 0 });
      case 'chalkboard': return this._std(name, 'chalkboard', 1, { roughness: 1, metalness: 0 });
      case 'ajrak': { const m = this._std(name, 'ajrak', 1, { roughness: 1, metalness: 0, side: THREE.DoubleSide }); return m; }
      case 'jaali': {
        const m = this._std(name, 'jaali', 1, { roughness: 1, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5, transparent: false });
        return m;
      }
      case 'glass': return new THREE.MeshStandardMaterial({ name, color: 0xbfd8e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, envMapIntensity: 1.5, depthWrite: false });
      case 'metal': return new THREE.MeshStandardMaterial({ name, color: 0xb8bcc2, roughness: 0.32, metalness: 1 });
      case 'brass': return new THREE.MeshStandardMaterial({ name, color: 0xc9a227, roughness: 0.28, metalness: 1 });
      case 'rubber': return new THREE.MeshStandardMaterial({ name, color: 0x222222, roughness: 0.9, metalness: 0 });
      case 'plastic': return new THREE.MeshStandardMaterial({ name, color: 0xe5e7eb, roughness: 0.4, metalness: 0 });
      case 'paper': return new THREE.MeshStandardMaterial({ name, color: 0xf5f0e6, roughness: 0.95, metalness: 0, side: THREE.DoubleSide });
      case 'water': {
        const set = this._tex('plaster', 6);
        const m = new THREE.MeshStandardMaterial({ name, color: 0x1d5866, roughness: 0.06, metalness: 0.1, normalMap: set.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), transparent: true, opacity: 0.88, envMapIntensity: 1.6 });
        set.map.dispose(); set.roughnessMap.dispose();
        m.userData.ssr = 1; this._animated.push((t) => { m.normalMap.offset.set(t * 0.02, t * 0.013); });
        return m;
      }
      case 'screen': return this.emissive(0x9fd3ff, 1.6);
      case 'skin': return makeSkinMaterial(THREE, {});
      default:
        if (PALETTE[name] != null) return new THREE.MeshStandardMaterial({ name, color: PALETTE[name], roughness: 0.7, metalness: 0 });
        return null;
    }
  }

  get(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const m = this._build(name);
    if (!m) { console.warn('[materials] unknown material', name); return this.get('plaster'); }
    this.cache.set(name, m);
    return m;
  }

  /** Plain coloured standard material (cached by args). */
  color(hex, opts) {
    opts = opts || {};
    const key = 'c:' + hex + ':' + JSON.stringify(opts);
    if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshStandardMaterial(Object.assign({ color: hex, roughness: 0.7, metalness: 0 }, opts)));
    return this.cache.get(key);
  }

  /** HDR emissive (values > 1 feed bloom). */
  emissive(color, intensity) {
    const key = 'e:' + color + ':' + intensity;
    if (!this.cache.has(key)) this.cache.set(key, new THREE.MeshStandardMaterial({ color: 0x000000, emissive: color, emissiveIntensity: intensity == null ? 2 : intensity, roughness: 0.4 }));
    return this.cache.get(key);
  }

  /** Emissive screen showing a texture (e.g. a poster or a canvas the zone redraws). */
  screen(texture, intensity) {
    return new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: intensity == null ? 1.2 : intensity, roughness: 0.25 });
  }

  update(dt) { this._time += dt; for (const f of this._animated) f(this._time); }

  dispose() {
    for (const m of this.cache.values()) {
      for (const k of ['map', 'normalMap', 'roughnessMap', 'alphaMap', 'emissiveMap']) if (m[k] && m[k].dispose) m[k].dispose();
      m.dispose();
    }
    this.cache.clear(); this._animated = [];
  }
}

module.exports = { MaterialLibrary, PALETTE };
