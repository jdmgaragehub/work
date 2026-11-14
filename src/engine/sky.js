'use strict';
/**
 * Procedural sky + lighting rig (A3).
 *  - Sky dome: analytic single-scatter style gradient (Rayleigh zenith/horizon + Mie sun aureole),
 *    HDR sun disc (feeds bloom / god-rays / lens flare), lit moon disc with phase, procedural twinkling
 *    star field (hashed direction cells), drifting fbm clouds and a warm city glow on the horizon at night.
 *  - Lights: HemisphereLight + one shadow-casting DirectionalLight (sun by day, moon by night) whose
 *    shadow frustum follows the camera and is texel-snapped (no shimmering); soft PCF on medium+.
 *  - Moods: day / dusk / night, blended smoothly (≈2.5 s) — `setTimeOfDay(mood, instant?)`.
 *  - Fog: FogExp2 coloured from the horizon. IBL: PMREM of the sky-only scene on tiers with envMap,
 *    refreshed only when the mood changes.
 * The sky never writes depth, so depth == 1 marks open sky for god-rays and the info pass.
 */
const THREE = require('three');

const MOODS = {
  day:   { elev: 52, az: 145, sun: [1.0, 0.95, 0.88], sunI: 3.0, hemiSky: [0.62, 0.75, 1.0], hemiGround: [0.42, 0.36, 0.28], hemiI: 0.9, zenith: [0.16, 0.36, 0.82], horizon: [0.66, 0.78, 0.95], fog: [0.70, 0.79, 0.90], fogD: 0.0016, stars: 0, glow: 0, cloud: 0.55, moonI: 0, exposure: 1 },
  dusk:  { elev: 5, az: 250, sun: [1.0, 0.52, 0.26], sunI: 2.0, hemiSky: [1.0, 0.62, 0.45], hemiGround: [0.22, 0.16, 0.22], hemiI: 0.55, zenith: [0.13, 0.15, 0.38], horizon: [1.0, 0.52, 0.28], fog: [0.72, 0.52, 0.45], fogD: 0.0022, stars: 0.15, glow: 0.2, cloud: 0.7, moonI: 0, exposure: 1 },
  night: { elev: -18, az: 300, sun: [0.55, 0.66, 1.0], sunI: 0.38, hemiSky: [0.16, 0.22, 0.42], hemiGround: [0.04, 0.04, 0.07], hemiI: 0.32, zenith: [0.006, 0.01, 0.03], horizon: [0.03, 0.04, 0.08], fog: [0.04, 0.05, 0.09], fogD: 0.0026, stars: 1, glow: 1, cloud: 0.3, moonI: 1, exposure: 1 },
};
const KEYS_V = ['sun', 'hemiSky', 'hemiGround', 'zenith', 'horizon', 'fog'];
const KEYS_S = ['elev', 'az', 'sunI', 'hemiI', 'fogD', 'stars', 'glow', 'cloud', 'moonI'];

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
const SKY_FRAG = `varying vec3 vDir;
uniform vec3 uSun; uniform vec3 uMoon; uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uSunCol; uniform float uSunI; uniform float uStars; uniform float uGlow; uniform float uCloud; uniform float uMoonI; uniform float uTime; uniform float uTwinkle;
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5), b = fract(sin(dot(i + vec2(1,0), vec2(127.1, 311.7))) * 43758.5);
  float c = fract(sin(dot(i + vec2(0,1), vec2(127.1, 311.7))) * 43758.5), d = fract(sin(dot(i + vec2(1,1), vec2(127.1, 311.7))) * 43758.5);
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  float hz = pow(1.0 - max(y, 0.0), 4.0);
  vec3 col = mix(uZenith, uHorizon, hz);
  if (y < 0.0) col = mix(uHorizon, uHorizon * 0.35, clamp(-y * 4.0, 0.0, 1.0));
  float mu = dot(d, uSun);
  // Mie aureole (Henyey–Greenstein, g = 0.76) + Rayleigh (1 + mu^2) brightening.
  float g = 0.76; float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * mu, 1.5);
  float sunUp = smoothstep(-0.12, 0.05, uSun.y);
  col += uSunCol * (hg * 0.018 + (1.0 + mu * mu) * 0.03) * uSunI * sunUp * (0.4 + hz);
  col += uSunCol * smoothstep(0.9996, 0.99985, mu) * 40.0 * sunUp;          // HDR sun disc
  // Clouds (planar projection, wind drift)
  if (y > 0.0 && uCloud > 0.0) {
    vec2 cp = d.xz / (y + 0.12) * 1.6 + vec2(uTime * 0.008, uTime * 0.003);
    float c = smoothstep(0.48, 0.85, fbm(cp)) * uCloud * smoothstep(0.0, 0.18, y);
    vec3 cc = mix(uHorizon * 1.1, vec3(1.0), 0.5) * (0.6 + 0.6 * sunUp) + uSunCol * pow(max(mu, 0.0), 6.0) * uSunI * 0.4;
    col = mix(col, cc, c * 0.85);
  }
  // Stars + moon
  if (uStars > 0.0 && y > 0.0) {
    vec3 cell = floor(d * 220.0); float r = h3(cell);
    if (r > 0.9965) { vec3 cpos = (cell + 0.5 + (vec3(h3(cell + 1.3), h3(cell + 2.7), h3(cell + 4.1)) - 0.5) * 0.6) / 220.0;
      float s = smoothstep(0.0028, 0.0, length(d - normalize(cpos)));
      float tw = 1.0 - uTwinkle * 0.5 * (0.5 + 0.5 * sin(uTime * (2.0 + r * 30.0) + r * 100.0));
      col += vec3(0.8 + 0.2 * h3(cell + 9.0), 0.85, 1.0) * s * tw * uStars * 3.0 * smoothstep(0.0, 0.25, y); }
  }
  if (uMoonI > 0.0) {
    float md = dot(d, uMoon);
    if (md > 0.9993) { vec3 tx = normalize(cross(uMoon, vec3(0.0, 1.0, 0.0))); vec3 ty = cross(tx, uMoon);
      vec2 q = vec2(dot(d - uMoon, tx), dot(d - uMoon, ty)) / 0.0374;
      vec3 n = vec3(q, sqrt(max(0.0, 1.0 - dot(q, q))));
      float lit = clamp(dot(n, normalize(vec3(0.6, 0.15, 0.4))), 0.0, 1.0);
      float mare = 0.75 + 0.25 * n2(q * 4.0 + 3.0);
      col += vec3(1.0, 0.97, 0.9) * lit * mare * 4.0 * uMoonI * smoothstep(0.9993, 0.9995, md); }
    col += vec3(0.5, 0.6, 0.9) * pow(max(md, 0.0), 80.0) * 0.12 * uMoonI;
  }
  col += vec3(1.0, 0.55, 0.25) * uGlow * 0.06 * pow(1.0 - abs(y), 12.0);   // city glow
  gl_FragColor = vec4(col, 1.0);
}`;

function v3(a) { return new THREE.Vector3(a[0], a[1], a[2]); }
function dirFrom(elevDeg, azDeg, out) {
  const e = THREE.MathUtils.degToRad(elevDeg), a = THREE.MathUtils.degToRad(azDeg);
  return out.set(Math.cos(e) * Math.sin(a), Math.sin(e), -Math.cos(e) * Math.cos(a)).normalize();
}

class Sky {
  constructor(engine) {
    this.engine = engine; this.scene = engine.scene; this.renderer = engine.renderer; this.quality = engine.quality;
    this.mood = 'day';
    this.cur = this._copy(MOODS.day); this.target = this._copy(MOODS.day);
    this.sunDir = new THREE.Vector3(); this.moonDir = new THREE.Vector3();
    this.state = { night: 0, golden: 0, dayFactor: 1, sunAbove: 1 };
    this.uniforms = {
      uSun: { value: new THREE.Vector3(0, 1, 0) }, uMoon: { value: new THREE.Vector3(0, 1, 0) }, uZenith: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunCol: { value: new THREE.Color() }, uSunI: { value: 1 }, uStars: { value: 0 }, uGlow: { value: 0 }, uCloud: { value: 0.5 }, uMoonI: { value: 0 }, uTime: { value: 0 }, uTwinkle: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, depthTest: true, fog: false });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    this.dome.frustumCulled = false; this.dome.renderOrder = -1000; this.dome.name = 'sky';
    this.scene.add(this.dome);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); this.scene.add(this.hemi);
    this.light = new THREE.DirectionalLight(0xffffff, 3);
    this.light.castShadow = true; this.light.shadow.bias = -0.0004; this.light.shadow.normalBias = 0.03;
    this.scene.add(this.light); this.scene.add(this.light.target);
    this.scene.fog = new THREE.FogExp2(0xbcd2e8, 0.0016);
    this._pmrem = null; this._envRT = null; this._envDirty = true; this._envTimer = 0;
    this.applyQuality();
    this._apply(0);
  }

  _copy(m) { const o = {}; for (const k of KEYS_S) o[k] = m[k]; for (const k of KEYS_V) o[k] = m[k].slice(); return o; }

  applyQuality() {
    const s = this.quality.settings, sh = this.light.shadow;
    const size = s.shadowMapSize || 1024;
    if (sh.mapSize.x !== size) { sh.mapSize.set(size, size); if (sh.map) { sh.map.dispose(); sh.map = null; } }
    const R = s.shadowRadius || 50, c = sh.camera;
    c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 600; c.updateProjectionMatrix();
    sh.radius = s.shadowSoft ? 3 : 1;
    this.light.castShadow = !!s.shadows;
    this.dome.scale.setScalar((s.viewDistance || 600) * 0.92);
    this._envDirty = true;
    if (!s.envMap) this._clearEnv();
  }

  setTimeOfDay(mood, instant) {
    if (!MOODS[mood]) return false;
    this.mood = mood; this.target = this._copy(MOODS[mood]);
    if (instant) this.cur = this._copy(MOODS[mood]);
    this._envDirty = true; this._envTimer = instant ? 0 : 2.6;
    return true;
  }

  _apply(dt) {
    const k = dt <= 0 ? 1 : 1 - Math.exp(-dt * 1.8), c = this.cur, t = this.target;
    for (const key of KEYS_S) c[key] += (t[key] - c[key]) * k;
    for (const key of KEYS_V) for (let i = 0; i < 3; i++) c[key][i] += (t[key][i] - c[key][i]) * k;
    // Sun keeps its own path; at night the shadow light follows the moon.
    dirFrom(c.elev, c.az, this.sunDir);
    dirFrom(38, c.az + 160, this.moonDir);
    const night = THREE.MathUtils.clamp(c.moonI, 0, 1);
    const golden = THREE.MathUtils.clamp(1 - Math.abs(c.elev - 6) / 20, 0, 1) * (1 - night);
    this.state.night = night; this.state.golden = golden; this.state.dayFactor = 1 - night; this.state.sunAbove = THREE.MathUtils.clamp(this.sunDir.y * 6 + 0.3, 0, 1);
    const u = this.uniforms;
    u.uSun.value.copy(this.sunDir); u.uMoon.value.copy(this.moonDir);
    u.uZenith.value.setRGB(c.zenith[0], c.zenith[1], c.zenith[2]); u.uHorizon.value.setRGB(c.horizon[0], c.horizon[1], c.horizon[2]);
    u.uSunCol.value.setRGB(c.sun[0], c.sun[1], c.sun[2]); u.uSunI.value = c.sunI * (1 - night);
    u.uStars.value = c.stars; u.uGlow.value = c.glow; u.uCloud.value = c.cloud; u.uMoonI.value = c.moonI;
    this.hemi.color.setRGB(c.hemiSky[0], c.hemiSky[1], c.hemiSky[2]); this.hemi.groundColor.setRGB(c.hemiGround[0], c.hemiGround[1], c.hemiGround[2]); this.hemi.intensity = c.hemiI;
    this.light.color.setRGB(c.sun[0], c.sun[1], c.sun[2]); this.light.intensity = c.sunI;
    this.lightDir = night > 0.5 ? this.moonDir : this.sunDir;
    if (this.scene.fog) { this.scene.fog.color.setRGB(c.fog[0], c.fog[1], c.fog[2]); this.scene.fog.density = c.fogD; }
  }

  /** Per frame: blend mood, follow camera, fit + snap the shadow frustum, refresh IBL when needed. */
  update(dt, t, camera) {
    this._apply(dt);
    const reduced = this.engine.sim && this.engine.sim.settings && this.engine.sim.settings.reducedMotion;
    this.uniforms.uTime.value = reduced ? 0 : t; this.uniforms.uTwinkle.value = reduced ? 0 : 1;
    this.dome.position.copy(camera.position);
    const R = this.light.shadow.camera.right;
    const fwd = camera.getWorldDirection(this._tmp || (this._tmp = new THREE.Vector3()));
    fwd.y = 0; if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, -1); fwd.normalize();
    const center = this._c || (this._c = new THREE.Vector3());
    center.copy(camera.position).addScaledVector(fwd, R * 0.45); center.y = 0;
    // Texel snapping in light space keeps shadow edges stable while walking.
    const texel = (2 * R) / this.light.shadow.mapSize.x;
    const ld = this.lightDir, m = this._lm || (this._lm = new THREE.Matrix4()), inv = this._li || (this._li = new THREE.Matrix4());
    m.lookAt(new THREE.Vector3(0, 0, 0), ld.clone().negate(), new THREE.Vector3(0, 1, 0)); inv.copy(m).invert();
    center.applyMatrix4(inv); center.x = Math.round(center.x / texel) * texel; center.y = Math.round(center.y / texel) * texel; center.applyMatrix4(m);
    this.light.target.position.copy(center);
    this.light.position.copy(center).addScaledVector(ld, 300);
    this.light.target.updateMatrixWorld();
    if (this._envTimer > 0) this._envTimer -= dt;
    if (this._envDirty && this._envTimer <= 0 && this.quality.settings.envMap) this._refreshEnv();
  }

  _refreshEnv() {
    this._envDirty = false;
    try {
      if (!this._pmrem) this._pmrem = new THREE.PMREMGenerator(this.renderer);
      const s = new THREE.Scene();
      const dome = new THREE.Mesh(this.dome.geometry, this.dome.material); dome.scale.setScalar(100); s.add(dome);
      const sunI = this.uniforms.uSunI.value; this.uniforms.uSunI.value = Math.min(sunI, 1.2); // avoid fireflies in IBL
      const rt = this._pmrem.fromScene(s, 0.02, 0.1, 400);
      this.uniforms.uSunI.value = sunI;
      if (this._envRT) this._envRT.dispose();
      this._envRT = rt; this.scene.environment = rt.texture;
    } catch (e) { console.warn('[sky] env map unavailable', e && e.message); this.quality.settings.envMap = false; }
  }

  _clearEnv() { if (this._envRT) { this._envRT.dispose(); this._envRT = null; } this.scene.environment = null; }

  dispose() {
    this._clearEnv(); if (this._pmrem) this._pmrem.dispose();
    this.dome.geometry.dispose(); this.dome.material.dispose();
    this.scene.remove(this.dome, this.hemi, this.light, this.light.target);
    if (this.light.shadow.map) this.light.shadow.map.dispose();
  }
}

module.exports = { Sky, MOODS };
