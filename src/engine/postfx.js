'use strict';
/**
 * ZEHN hand-written post-processing chain (A3). No EffectComposer: every pass is a
 * ShaderMaterial drawn on one fullscreen triangle into a WebGLRenderTarget.
 *
 *   scene (HDR half-float + depth texture; UnsignedByte fallback when float RTs are unsupported)
 *   → SSR trace (High+, half res, only pixels of meshes flagged userData.ssr; mask via SSR layer)
 *   → TAA resolve (Ultra: Halton(2,3) jitter, depth reprojection, YCoCg variance clip)
 *   → camera motion blur (High+, never with reduced motion)
 *   → SSAO (half res, 16-tap hemisphere) + depth-aware bilateral blur
 *   → bright pass (soft knee, anti-firefly) → 2–3 level separable bloom pyramid
 *   → god-rays (radial, sky-masked by depth) · volumetric shafts (analytic cone ray-march, `engine.volumetric`)
 *   → 1×1 info pass (autofocus, sun occlusion, eye adaptation; ping-pong, log-space easing)
 *   → composite (SSR + AO + bloom + rays + shafts, lens flare, partial auto-exposure, ACES, look grade,
 *                emotion grade, chromatic aberration, vignette)
 *   → bokeh DOF (golden-angle gather, 22/36/48 samples by tier, CoC from depth; tour/photo)
 *   → final (FXAA 3.11-style + film grain)
 *
 * Each pass is gated by the tier flag (quality.settings[name]) AND sim.settings.toggles[name].
 * Also exports `makeSkinMaterial(THREE, opts)` — SSS approximation (wrap lighting + red-shifted
 * scatter + thin-part back-light transmission) for A4's humanoid skin.
 */
const THREE = require('three');

const SSR_LAYER = 5;

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const DEPTH_FN = `
float zLinear(float d, float n, float f){ float z = d * 2.0 - 1.0; return 2.0 * n * f / (f + n - z * (f - n)); }
vec3 zView(vec2 uv, float d, mat4 invProj){ vec4 v = invProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
vec3 zWorld(vec2 uv, float d, mat4 invVP){ vec4 v = invVP * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return v.xyz / v.w; }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
`;

const FRAG = {
  copy: `varying vec2 vUv; uniform sampler2D tDiffuse; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }`,

  bright: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uThreshold; uniform float uKnee;
void main(){
  vec3 a = texture2D(tDiffuse, vUv + uTexel * vec2(-0.5,-0.5)).rgb, b = texture2D(tDiffuse, vUv + uTexel * vec2(0.5,-0.5)).rgb;
  vec3 c = texture2D(tDiffuse, vUv + uTexel * vec2(-0.5,0.5)).rgb, d = texture2D(tDiffuse, vUv + uTexel * vec2(0.5,0.5)).rgb;
  // Karis average: weight each tap by 1/(1+luma) so single hot pixels cannot flicker.
  float wa = 1.0/(1.0+dot(a,vec3(0.2126,0.7152,0.0722))), wb = 1.0/(1.0+dot(b,vec3(0.2126,0.7152,0.0722)));
  float wc = 1.0/(1.0+dot(c,vec3(0.2126,0.7152,0.0722))), wd = 1.0/(1.0+dot(d,vec3(0.2126,0.7152,0.0722)));
  vec3 col = min((a*wa + b*wb + c*wc + d*wd) / (wa+wb+wc+wd), vec3(48.0));
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float s = clamp(l - uThreshold + uKnee, 0.0, 2.0 * uKnee); s = s * s / (4.0 * uKnee + 1e-5);
  gl_FragColor = vec4(col * max(s, l - uThreshold) / max(l, 1e-5), 1.0);
}`,

  blur: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uDir;
void main(){
  vec4 s = texture2D(tDiffuse, vUv) * 0.2270270270;
  s += (texture2D(tDiffuse, vUv + uDir * 1.3846153846) + texture2D(tDiffuse, vUv - uDir * 1.3846153846)) * 0.3162162162;
  s += (texture2D(tDiffuse, vUv + uDir * 3.2307692308) + texture2D(tDiffuse, vUv - uDir * 3.2307692308)) * 0.0702702703;
  gl_FragColor = s;
}`,

  rays: `varying vec2 vUv; uniform sampler2D tBright; uniform sampler2D tDepth; uniform vec2 uSun; uniform float uDensity; uniform float uDecay; uniform float uWeight; uniform float uVis;
${DEPTH_FN}
void main(){
  const int N = 40;
  vec2 dlt = (vUv - uSun) * (uDensity / float(N));
  vec2 uv = vUv + dlt * hash12(gl_FragCoord.xy);
  vec3 acc = vec3(0.0); float ill = 1.0;
  for (int i = 0; i < N; i++) {
    uv -= dlt; vec2 c = clamp(uv, 0.0, 1.0);
    float sky = step(0.99999, texture2D(tDepth, c).x);
    acc += (texture2D(tBright, c).rgb + vec3(0.06, 0.05, 0.04)) * sky * ill * uWeight;
    ill *= uDecay;
  }
  gl_FragColor = vec4(acc / float(N) * uVis, 1.0);
}`,

  ssao: `varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uProj; uniform mat4 uInvProj; uniform vec2 uTexel; uniform float uRadius; uniform float uIntensity; uniform float uMaxDist; uniform vec3 uKernel[16];
${DEPTH_FN}
vec3 vp(vec2 uv){ return zView(uv, texture2D(tDepth, uv).x, uInvProj); }
void main(){
  float d = texture2D(tDepth, vUv).x;
  if (d >= 0.99999) { gl_FragColor = vec4(1.0); return; }
  vec3 P = zView(vUv, d, uInvProj); float dist = -P.z;
  if (dist > uMaxDist) { gl_FragColor = vec4(1.0); return; }
  vec3 pr = vp(vUv + vec2(uTexel.x, 0.0)), pl = vp(vUv - vec2(uTexel.x, 0.0)), pu = vp(vUv + vec2(0.0, uTexel.y)), pd = vp(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy)); if (N.z < 0.0) N = -N;
  float a = hash12(gl_FragCoord.xy) * 6.2831853;
  vec3 rv = vec3(cos(a), sin(a), 0.0);
  vec3 T = normalize(rv - N * dot(rv, N)); vec3 B = cross(N, T); mat3 TBN = mat3(T, B, N);
  float rad = uRadius * (1.0 + dist * 0.01);
  float occ = 0.0;
  for (int i = 0; i < 16; i++) {
    vec3 S = P + TBN * uKernel[i] * rad;
    vec4 o = uProj * vec4(S, 1.0); vec2 suv = o.xy / o.w * 0.5 + 0.5;
    if (any(lessThan(suv, vec2(0.0))) || any(greaterThan(suv, vec2(1.0)))) continue;
    float sz = vp(suv).z;
    float range = smoothstep(0.0, 1.0, rad / max(1e-3, abs(P.z - sz)));
    occ += (sz >= S.z + 0.025 ? 1.0 : 0.0) * range;
  }
  float fade = 1.0 - smoothstep(uMaxDist * 0.6, uMaxDist, dist);
  gl_FragColor = vec4(clamp(1.0 - occ / 16.0 * uIntensity * fade, 0.0, 1.0));
}`,

  ssaoBlur: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 uTexel; uniform float uNear; uniform float uFar;
${DEPTH_FN}
void main(){
  float z0 = zLinear(texture2D(tDepth, vUv).x, uNear, uFar);
  float s = 0.0, w = 0.0;
  for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) {
    vec2 uv = vUv + vec2(float(x), float(y)) * uTexel;
    float z = zLinear(texture2D(tDepth, uv).x, uNear, uFar);
    float k = exp(-abs(z - z0) / (0.04 * z0 + 0.05)) * (1.0 - 0.12 * float(x * x + y * y) / 8.0);
    s += texture2D(tDiffuse, uv).r * k; w += k;
  }
  gl_FragColor = vec4(s / max(w, 1e-4));
}`,

  ssrMask: `uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear; uniform float uFar;
${DEPTH_FN}
void main(){
  float sd = texture2D(tDepth, gl_FragCoord.xy / uRes).x;
  float a = zLinear(gl_FragCoord.z, uNear, uFar), b = zLinear(sd, uNear, uFar);
  if (a > b + 0.02 * b + 0.05) discard;
  gl_FragColor = vec4(1.0);
}`,

  ssr: `varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tMask; uniform mat4 uProj; uniform mat4 uInvProj; uniform vec2 uTexel; uniform float uMaxDist; uniform float uThick;
${DEPTH_FN}
vec3 vp(vec2 uv){ return zView(uv, texture2D(tDepth, uv).x, uInvProj); }
vec2 proj(vec3 p){ vec4 c = uProj * vec4(p, 1.0); return c.xy / c.w * 0.5 + 0.5; }
void main(){
  if (texture2D(tMask, vUv).r < 0.5) { gl_FragColor = vec4(0.0); return; }
  float d = texture2D(tDepth, vUv).x;
  vec3 P = zView(vUv, d, uInvProj);
  vec3 pr = vp(vUv + vec2(uTexel.x, 0.0)), pl = vp(vUv - vec2(uTexel.x, 0.0)), pu = vp(vUv + vec2(0.0, uTexel.y)), pd = vp(vUv - vec2(0.0, uTexel.y));
  vec3 dx = abs(pr.z - P.z) < abs(P.z - pl.z) ? pr - P : P - pl;
  vec3 dy = abs(pu.z - P.z) < abs(P.z - pd.z) ? pu - P : P - pd;
  vec3 N = normalize(cross(dx, dy)); if (dot(N, P) > 0.0) N = -N;
  vec3 V = normalize(P); vec3 R = normalize(reflect(V, N));
  if (R.z > 0.2 && -P.z < 2.0) { gl_FragColor = vec4(0.0); return; }
  const int STEPS = 40;
  float stepLen = uMaxDist / float(STEPS);
  float t = stepLen * (0.5 + hash12(gl_FragCoord.xy));
  vec2 hit = vec2(-1.0); vec3 Q;
  for (int i = 0; i < STEPS; i++) {
    Q = P + R * t; vec2 uv = proj(Q);
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 || Q.z > -0.05) break;
    float sz = vp(uv).z;
    float diff = sz - Q.z;
    if (diff > 0.0 && diff < uThick + t * 0.04) {
      float lo = t - stepLen, hi = t;
      for (int j = 0; j < 5; j++) { float m = 0.5 * (lo + hi); vec3 M = P + R * m; vec2 mu = proj(M); if (vp(mu).z - M.z > 0.0) hi = m; else lo = m; }
      hit = proj(P + R * hi); t = hi; break;
    }
    t += stepLen * (1.0 + float(i) * 0.04);
  }
  if (hit.x < 0.0) { gl_FragColor = vec4(0.0); return; }
  vec2 e = smoothstep(vec2(0.0), vec2(0.12), hit) * smoothstep(vec2(0.0), vec2(0.12), 1.0 - hit);
  float fres = 0.12 + 0.88 * pow(1.0 - max(dot(-V, N), 0.0), 4.0);
  float w = e.x * e.y * (1.0 - smoothstep(uMaxDist * 0.5, uMaxDist, t)) * fres;
  gl_FragColor = vec4(min(texture2D(tColor, hit).rgb, vec3(16.0)) * w, w);
}`,

  vol: `varying vec2 vUv; uniform sampler2D tDepth; uniform mat4 uInvVP; uniform vec3 uCam; uniform float uTime; uniform float uDensity; uniform int uCount;
uniform vec3 uLPos[4]; uniform vec3 uLDir[4]; uniform vec3 uLCol[4]; uniform vec3 uLCone[4];
${DEPTH_FN}
float noise3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float n = dot(i, vec3(1.0, 57.0, 113.0));
  vec4 a = fract(sin(vec4(n, n+1.0, n+57.0, n+58.0)) * 43758.5453), b = fract(sin(vec4(n+113.0, n+114.0, n+170.0, n+171.0)) * 43758.5453);
  vec4 m = mix(a, b, f.z); vec2 m2 = mix(m.xy, m.zw, f.y); return mix(m2.x, m2.y, f.x); }
void main(){
  float d = texture2D(tDepth, vUv).x;
  vec3 W = zWorld(vUv, min(d, 0.9999), uInvVP);
  vec3 rd = W - uCam; float L = min(length(rd), 60.0); rd = normalize(rd);
  const int STEPS = 28;
  float ds = L / float(STEPS);
  float t = ds * hash12(gl_FragCoord.xy + fract(uTime) * 61.0);
  vec3 acc = vec3(0.0);
  for (int i = 0; i < STEPS; i++) {
    vec3 p = uCam + rd * t;
    float dust = 0.55 + 0.45 * noise3(p * 1.7 + vec3(0.0, uTime * 0.15, uTime * 0.07));
    for (int k = 0; k < 4; k++) {
      if (k >= uCount) break;
      vec3 v = p - uLPos[k]; float dl = length(v);
      float c = dot(v / max(dl, 1e-3), uLDir[k]);
      float cone = smoothstep(uLCone[k].x, mix(uLCone[k].x, 1.0, 0.35), c);
      float fall = 1.0 - smoothstep(uLCone[k].y * 0.4, uLCone[k].y, dl);
      // Henyey-Greenstein-ish forward scatter toward the viewer.
      float g = 0.45; float mu = dot(-rd, uLDir[k]);
      float hg = (1.0 - g*g) / pow(1.0 + g*g - 2.0*g*mu, 1.5) * 0.08;
      acc += uLCol[k] * cone * fall * dust * (0.6 + hg);
    }
    t += ds;
  }
  gl_FragColor = vec4(acc * ds * uDensity, 1.0);
}`,

  taa: `varying vec2 vUv; uniform sampler2D tCur; uniform sampler2D tHist; uniform sampler2D tDepth; uniform mat4 uInvVP; uniform mat4 uPrevVP; uniform vec2 uTexel; uniform float uReset;
${DEPTH_FN}
vec3 toY(vec3 c){ return vec3(0.25*c.r+0.5*c.g+0.25*c.b, 0.5*c.r-0.5*c.b, -0.25*c.r+0.5*c.g-0.25*c.b); }
vec3 fromY(vec3 c){ return vec3(c.x+c.y-c.z, c.x+c.z, c.x-c.y-c.z); }
vec3 tm(vec3 c){ return c / (1.0 + max(c.r, max(c.g, c.b))); }
vec3 itm(vec3 c){ return c / max(1e-4, 1.0 - max(c.r, max(c.g, c.b))); }
void main(){
  vec3 cur = toY(tm(texture2D(tCur, vUv).rgb));
  vec3 m1 = cur, m2 = cur * cur, mn = cur, mx = cur;
  for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) {
    if (x == 0 && y == 0) continue;
    vec3 s = toY(tm(texture2D(tCur, vUv + vec2(float(x), float(y)) * uTexel).rgb));
    m1 += s; m2 += s * s; mn = min(mn, s); mx = max(mx, s);
  }
  vec3 mu = m1 / 9.0, sg = sqrt(max(m2 / 9.0 - mu * mu, 0.0));
  mn = max(mn, mu - sg * 1.25); mx = min(mx, mu + sg * 1.25);
  float d = texture2D(tDepth, vUv).x;
  vec4 pc = uPrevVP * vec4(zWorld(vUv, d, uInvVP), 1.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  float valid = all(greaterThan(puv, vec2(0.0))) && all(lessThan(puv, vec2(1.0))) ? 1.0 : 0.0;
  vec3 hist = clamp(toY(tm(texture2D(tHist, puv).rgb)), mn, mx);
  float motion = length((puv - vUv) / uTexel);
  float a = max(mix(0.08, 0.3, clamp(motion / 8.0, 0.0, 1.0)), max(1.0 - valid, uReset));
  gl_FragColor = vec4(itm(fromY(mix(hist, cur, a))), 1.0);
}`,

  motion: `varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; uniform mat4 uInvVP; uniform mat4 uPrevVP; uniform float uScale; uniform float uMaxPx; uniform vec2 uRes;
${DEPTH_FN}
void main(){
  float d = texture2D(tDepth, vUv).x;
  vec4 pc = uPrevVP * vec4(zWorld(vUv, d, uInvVP), 1.0);
  vec2 vel = (vUv - (pc.xy / pc.w * 0.5 + 0.5)) * uScale;
  float len = length(vel * uRes);
  vec3 c = texture2D(tColor, vUv).rgb;
  if (len < 0.75) { gl_FragColor = vec4(c, 1.0); return; }
  if (len > uMaxPx) vel *= uMaxPx / len;
  vec3 acc = c; float j = hash12(gl_FragCoord.xy) - 0.5;
  for (int i = 1; i < 12; i++) acc += texture2D(tColor, clamp(vUv + vel * ((float(i) + j) / 11.0 - 0.5), 0.001, 0.999)).rgb;
  gl_FragColor = vec4(acc / 12.0, 1.0);
}`,

  lum: `varying vec2 vUv; uniform sampler2D tDiffuse;
void main(){ float l = dot(texture2D(tDiffuse, vUv).rgb, vec3(0.2126, 0.7152, 0.0722));
  // Centre-weighted metering (matrix metering style).
  float w = 1.0 - 0.6 * length(vUv - 0.5);
  gl_FragColor = vec4(log(clamp(l, 1e-4, 64.0)) * w, w, 0.0, 1.0); }`,

  info: `varying vec2 vUv; uniform sampler2D tDepth; uniform sampler2D tPrev; uniform sampler2D tLum; uniform vec2 uSun; uniform float uNear; uniform float uFar; uniform float uManual; uniform float uBlend; uniform float uPrimed;
${DEPTH_FN}
void main(){
  float f = 1e6;
  for (int i = 0; i < 9; i++) {
    vec2 o = vec2(float(i - (i / 3) * 3) - 1.0, float(i / 3) - 1.0) * vec2(0.03, 0.04);
    f = min(f, zLinear(texture2D(tDepth, vec2(0.5) + o).x, uNear, uFar));
  }
  if (uManual > 0.0) f = uManual;
  float vis = 0.0;
  for (int y = -2; y <= 2; y++) for (int x = -2; x <= 2; x++) {
    vec2 p = uSun + vec2(float(x), float(y)) * 0.007;
    float inside = all(greaterThan(p, vec2(0.0))) && all(lessThan(p, vec2(1.0))) ? 1.0 : 0.0;
    vis += inside * step(0.99999, texture2D(tDepth, clamp(p, 0.0, 1.0)).x);
  }
  vis /= 25.0;
  vec2 ls = vec2(0.0);
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) ls += texture2D(tLum, (vec2(float(x), float(y)) + 0.5) / 8.0).rg;
  float lum = exp(ls.x / max(ls.y, 1e-3));
  vec4 prev = texture2D(tPrev, vec2(0.5));
  vec4 now = vec4(f, vis, lum, 1.0);
  if (uPrimed < 0.5) { gl_FragColor = now; return; }
  float lf = mix(log(max(prev.x, 0.05)), log(max(now.x, 0.05)), uBlend);
  float adaptK = now.z > prev.z ? uBlend * 0.6 : uBlend * 0.3; // brighten faster than darken (photopic/scotopic asymmetry)
  gl_FragColor = vec4(exp(lf), mix(prev.y, now.y, min(1.0, uBlend * 2.0)), exp(mix(log(max(prev.z,1e-4)), log(max(now.z,1e-4)), adaptK)), 1.0);
}`,

  composite: `varying vec2 vUv;
uniform sampler2D tColor; uniform sampler2D tAO; uniform sampler2D tB1; uniform sampler2D tB2; uniform sampler2D tB3; uniform sampler2D tRays; uniform sampler2D tVol; uniform sampler2D tSSR; uniform sampler2D tInfo;
uniform float uAO; uniform float uBloom; uniform float uRays; uniform float uVol; uniform float uSSR; uniform float uExposure; uniform float uAuto; uniform float uKey;
uniform float uVignette; uniform float uChroma; uniform float uGrain; uniform float uTime; uniform float uFlare; uniform vec2 uSun; uniform vec3 uFlareCol; uniform vec2 uRes;
uniform vec3 uLift; uniform vec3 uGain; uniform vec3 uTint; uniform float uSat; uniform float uContrast; uniform vec3 uEmo; uniform float uFade;
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 aces(vec3 x){ // Hill's fitted ACES (RRT+ODT), sRGB primaries
  const mat3 I = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 O = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  x = I * x; vec3 a = x * (x + 0.0245786) - 0.000090537; vec3 b = x * (0.983729 * x + 0.4329510) + 0.238081;
  return clamp(O * (a / b), 0.0, 1.0); }
float ring(vec2 p, vec2 c, float r, float s){ return smoothstep(r, r * (1.0 - s), length(p - c)); }
vec3 flare(vec2 uv, float asp){
  vec2 A = vec2(asp, 1.0), s = uSun, dir = vec2(0.5) - s, p = uv * A; vec3 c = vec3(0.0);
  c += vec3(0.30, 0.50, 1.00) * ring(p, (s + dir * 0.40) * A, 0.030, 0.6) * 0.25;
  c += vec3(1.00, 0.70, 0.30) * ring(p, (s + dir * 0.75) * A, 0.016, 0.4) * 0.35;
  c += vec3(0.50, 1.00, 0.60) * ring(p, (s + dir * 1.20) * A, 0.055, 0.7) * 0.12;
  c += vec3(1.00, 0.45, 0.70) * ring(p, (s + dir * 1.50) * A, 0.025, 0.3) * 0.20;
  c += vec3(0.40, 0.70, 1.00) * ring(p, (s + dir * 1.95) * A, 0.100, 0.85) * 0.08;
  float r = length((uv - 0.5) * A);
  c += vec3(0.9, 0.75, 1.0) * smoothstep(0.05, 0.0, abs(r - 0.42)) * max(0.0, dot(normalize((uv - 0.5) * A + 1e-5), normalize(-dir * A + 1e-5))) * 0.08;
  vec2 dv = (uv - s) * A; float an = atan(dv.y, dv.x);
  c += uFlareCol * exp(-abs(dv.y) * 240.0) * exp(-abs(dv.x) * 3.0) * 0.35;           // anamorphic streak
  c += uFlareCol * exp(-length(dv) * 20.0) * (0.35 + 0.25 * pow(abs(cos(an * 3.0)), 24.0)); // glare + 6-point starburst
  return c; }
void main(){
  vec2 uv = vUv, fc = uv - 0.5; vec3 col;
  if (uChroma > 0.0) { float k = uChroma * 0.009 * dot(fc, fc);
    col = vec3(texture2D(tColor, uv + fc * k).r, texture2D(tColor, uv).g, texture2D(tColor, uv - fc * k).b);
  } else col = texture2D(tColor, uv).rgb;
  if (uSSR > 0.0) { vec4 r = texture2D(tSSR, uv); col = col * (1.0 - r.a * uSSR * 0.35) + r.rgb * uSSR; }
  if (uAO > 0.0) col *= mix(1.0, texture2D(tAO, uv).r, uAO);
  if (uBloom > 0.0) col += (texture2D(tB1, uv).rgb * 0.55 + texture2D(tB2, uv).rgb * 0.75 + texture2D(tB3, uv).rgb * 0.9) * uBloom;
  if (uRays > 0.0) col += texture2D(tRays, uv).rgb * uRays;
  if (uVol > 0.0) col += texture2D(tVol, uv).rgb * uVol;
  vec4 info = texture2D(tInfo, vec2(0.5));
  if (uFlare > 0.0) col += flare(uv, uRes.x / uRes.y) * uFlare * info.y;
  float adapt = clamp(pow(uKey / max(info.z, 1e-4), 0.6), 0.5, 3.5);
  col *= uExposure * mix(1.0, adapt, uAuto) * uTint;
  // Emotion grade (counselling scenes): valence → white balance warm/cool, arousal → saturation/contrast.
  col *= mix(vec3(1.0), vec3(1.0 + 0.10 * uEmo.x, 1.0 + 0.02 * uEmo.x, 1.0 - 0.10 * uEmo.x), uEmo.z);
  col = aces(col);
  col = col * uGain + uLift;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float sat = uSat * (1.0 + uEmo.z * (0.18 * uEmo.y + 0.10 * uEmo.x));
  col = mix(vec3(l), col, sat);
  col = clamp((col - 0.18) * (uContrast * (1.0 + 0.08 * uEmo.y * uEmo.z)) + 0.18, 0.0, 1.0);
  float rr = length(fc * vec2(uRes.x / uRes.y, 1.0));
  col *= 1.0 - (uVignette + 0.10 * max(0.0, uEmo.y) * uEmo.z) * smoothstep(0.35, 1.05, rr);
  if (uGrain > 0.0) col += (h(gl_FragCoord.xy + fract(uTime) * 173.0) - 0.5) * uGrain * (1.0 - 0.7 * l);
  col = clamp(col * uFade, 0.0, 1.0);
  col = mix(col * 12.92, 1.055 * pow(max(col, vec3(1e-5)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), col));
  gl_FragColor = vec4(col, 1.0);
}`,

  coc: `varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tInfo; uniform float uNear; uniform float uFar; uniform float uAperture; uniform float uFocus;
${DEPTH_FN}
void main(){
  float focus = uFocus > 0.0 ? uFocus : texture2D(tInfo, vec2(0.5)).x;
  float z = zLinear(texture2D(tDepth, vUv).x, uNear, uFar);
  gl_FragColor = vec4(texture2D(tColor, vUv).rgb, clamp((z - focus) / max(z, 1e-3) * uAperture, -1.0, 1.0));
}`,

  bokeh: `varying vec2 vUv; uniform sampler2D tCoc; uniform vec2 uTexel; uniform float uMaxR;
void main(){
  vec4 c0 = texture2D(tCoc, vUv); vec3 acc = c0.rgb; float ws = 1.0;
  for (int i = 1; i < DOF_SAMPLES; i++) {
    float fi = float(i), r = sqrt((fi + 0.5) / float(DOF_SAMPLES)), th = fi * 2.39996323;
    vec2 o = vec2(cos(th), sin(th)) * r * uMaxR;
    vec4 s = texture2D(tCoc, vUv + o * uTexel);
    float w = smoothstep(r * uMaxR - 1.0, r * uMaxR + 0.5, abs(s.a) * uMaxR);
    w *= (s.a < c0.a - 0.15 && c0.a > 0.0) ? 0.2 : 1.0;
    float lb = dot(s.rgb, vec3(0.333)); w *= 1.0 + 2.0 * smoothstep(0.7, 1.0, lb); // bright highlights bloom into discs
    acc += s.rgb * w; ws += w;
  }
  gl_FragColor = vec4(acc / ws, abs(c0.a));
}`,

  dof: `varying vec2 vUv; uniform sampler2D tColor; uniform sampler2D tBlur; uniform sampler2D tDepth; uniform sampler2D tInfo; uniform float uNear; uniform float uFar; uniform float uAperture; uniform float uFocus;
${DEPTH_FN}
void main(){
  float focus = uFocus > 0.0 ? uFocus : texture2D(tInfo, vec2(0.5)).x;
  float z = zLinear(texture2D(tDepth, vUv).x, uNear, uFar);
  float coc = abs(clamp((z - focus) / max(z, 1e-3) * uAperture, -1.0, 1.0));
  vec4 b = texture2D(tBlur, vUv);
  gl_FragColor = vec4(mix(texture2D(tColor, vUv).rgb, b.rgb, smoothstep(0.05, 0.3, max(coc, b.a * 0.85))), 1.0);
}`,

  final: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uTexel; uniform float uFxaa; uniform float uGrain; uniform float uTime;
float L(vec3 c){ return dot(c, vec3(0.299, 0.587, 0.114)); }
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main(){
  vec3 m = texture2D(tDiffuse, vUv).rgb; vec3 o = m;
  if (uFxaa > 0.5) {
    float nw = L(texture2D(tDiffuse, vUv + vec2(-1.0, -1.0) * uTexel).rgb), ne = L(texture2D(tDiffuse, vUv + vec2(1.0, -1.0) * uTexel).rgb);
    float sw = L(texture2D(tDiffuse, vUv + vec2(-1.0, 1.0) * uTexel).rgb), se = L(texture2D(tDiffuse, vUv + vec2(1.0, 1.0) * uTexel).rgb);
    float lm = L(m), mn = min(lm, min(min(nw, ne), min(sw, se))), mx = max(lm, max(max(nw, ne), max(sw, se)));
    if (mx - mn > max(0.0312, mx * 0.125)) {
      vec2 dir = vec2(-((nw + ne) - (sw + se)), (nw + sw) - (ne + se));
      float red = max((nw + ne + sw + se) * 0.03125, 1.0 / 128.0);
      dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), vec2(-8.0), vec2(8.0)) * uTexel;
      vec3 a = 0.5 * (texture2D(tDiffuse, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 b = a * 0.5 + 0.25 * (texture2D(tDiffuse, vUv - dir * 0.5).rgb + texture2D(tDiffuse, vUv + dir * 0.5).rgb);
      float lb = L(b); o = (lb < mn || lb > mx) ? a : b;
    }
  }
  if (uGrain > 0.0) o += (h(gl_FragCoord.xy + fract(uTime) * 173.0) - 0.5) * uGrain * (1.0 - 0.7 * L(o));
  gl_FragColor = vec4(o, 1.0);
}`,
};

/* ---------------------------------------------------------------- looks */
const LOOKS = {
  day:      { exposure: 1.0,  key: 0.30, vignette: 0.26, grain: 0.025, chroma: 0.25, sat: 1.12, contrast: 1.08, lift: [0.004, 0.002, 0.0], gain: [1.04, 1.0, 0.95], tint: [1, 1, 1], bloom: 0.42, rays: 0.45, ao: 0.85, flare: 0.5, vol: 1.0, ssr: 0.9 },
  dusk:     { exposure: 1.06, key: 0.26, vignette: 0.34, grain: 0.03,  chroma: 0.25, sat: 1.18, contrast: 1.1,  lift: [0.014, 0.004, 0.0], gain: [1.1, 0.98, 0.86], tint: [1, 1, 1], bloom: 0.6, rays: 0.75, ao: 0.8, flare: 0.75, vol: 1.2, ssr: 1.0 },
  night:    { exposure: 1.3,  key: 0.16, vignette: 0.4,  grain: 0.035, chroma: 0.3,  sat: 0.9,  contrast: 1.1,  lift: [0.0, 0.004, 0.014], gain: [0.93, 0.98, 1.1], tint: [1, 1, 1], bloom: 0.85, rays: 0.15, ao: 0.6, flare: 0.25, vol: 1.4, ssr: 1.0 },
  interior: { exposure: 1.15, key: 0.24, vignette: 0.38, grain: 0.03,  chroma: 0.15, sat: 1.02, contrast: 1.05, lift: [0.006, 0.005, 0.006], gain: [1.03, 0.99, 0.95], tint: [1, 1, 1], bloom: 0.45, rays: 0.2, ao: 1.0, flare: 0.1, vol: 1.3, ssr: 1.0 },
  photo:    { exposure: 1.04, key: 0.28, vignette: 0.46, grain: 0.02,  chroma: 0.35, sat: 1.15, contrast: 1.12, lift: [0.004, 0.002, 0.0], gain: [1.05, 1.0, 0.95], tint: [1, 1, 1], bloom: 0.55, rays: 0.55, ao: 0.9, flare: 0.7, vol: 1.1, ssr: 1.0 },
};
const SCAL = ['exposure', 'key', 'vignette', 'grain', 'chroma', 'sat', 'contrast', 'bloom', 'rays', 'ao', 'flare', 'vol', 'ssr'];
const VEC = ['lift', 'gain', 'tint'];
const cloneLook = (l) => { const o = {}; for (const k of SCAL) o[k] = l[k]; for (const k of VEC) o[k] = l[k].slice(); return o; };

function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }

function ssaoKernel() {
  const out = []; let s = 7;
  const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 16; i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 0.9 + 0.1).normalize();
    const t = i / 16; v.multiplyScalar(0.1 + 0.9 * t * t); out.push(v);
  }
  return out;
}

/** Detects the best renderable HDR type once per renderer. */
function detectHdrType(renderer) {
  const ext = renderer.extensions;
  const isGL2 = renderer.capabilities.isWebGL2;
  try {
    if (isGL2 && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'))) return THREE.HalfFloatType;
    if (!isGL2 && ext.has('OES_texture_half_float') && ext.has('EXT_color_buffer_half_float')) return THREE.HalfFloatType;
  } catch (e) { /* fall through */ }
  return THREE.UnsignedByteType;
}

class PostFX {
  constructor(renderer, quality, sim) {
    this.renderer = renderer; this.quality = quality; this.sim = sim;
    this.hdrType = detectHdrType(renderer);
    this.hdr = this.hdrType !== THREE.UnsignedByteType;
    this.width = 1; this.height = 1; this.frame = 0;
    this.reducedMotion = false; this.minimal = false;
    this.dofOn = false; this.focus = 0; this.aperture = 1.6;
    this.emotion = { valence: 0, arousal: 0, amount: 0, target: 0 };
    this.look = cloneLook(LOOKS.day); this._lookTarget = cloneLook(LOOKS.day);
    this.lastPasses = [];
    this.ssrCount = 0;
    this._prevVP = new THREE.Matrix4(); this._vp = new THREE.Matrix4(); this._invVP = new THREE.Matrix4(); this._jVP = new THREE.Matrix4();
    this._prevPos = new THREE.Vector3(); this._prevQuat = new THREE.Quaternion(); this._hasPrev = false; this._histValid = false;
    this.jitter = new THREE.Vector2(); this._infoIdx = 0; this._infoPrimed = false;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo, null); this.quad.frustumCulled = false; this.scene.add(this.quad);
    const tex = (arr, type) => { const t = new THREE.DataTexture(arr, 1, 1, THREE.RGBAFormat, type); t.needsUpdate = true; return t; };
    this._black = tex(new Uint8Array([0, 0, 0, 0]), THREE.UnsignedByteType);
    this._white = tex(new Uint8Array([255, 255, 255, 255]), THREE.UnsignedByteType);
    this._infoFallback = tex(new Float32Array([8, 0, 0.3, 1]), THREE.FloatType);
    this._buildMaterials();
    this._rts = {};
  }

  /* ---------------------------------------------------------------- gating */
  /** Effective on/off = tier flag AND user toggle (missing toggle = on). */
  isActive(name) {
    if (this.minimal) return false;
    const s = this.quality.settings;
    const tg = (this.sim && this.sim.settings && this.sim.settings.toggles) || {};
    const user = tg[name] !== false;
    switch (name) {
      case 'motionBlur': return !!(s.motionBlur && user && !this.reducedMotion);
      case 'dof': return !!(s.dof && user && this.dofOn);
      case 'autoExposure': return !!(s.autoExposure && user && this.hdr);
      case 'taa': case 'ssao': case 'ssr': case 'volumetric': case 'godrays': return !!(s[name] && user && this.depthOK);
      default: return !!(s[name] && user);
    }
  }

  _mat(frag, uniforms, defines) {
    return new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, defines: defines || {}, depthTest: false, depthWrite: false });
  }

  _buildMaterials() {
    if (this.m) for (const k in this.m) this.m[k].dispose();
    const V2 = () => ({ value: new THREE.Vector2() }), M4 = () => ({ value: new THREE.Matrix4() }), T = () => ({ value: null }), F = (v) => ({ value: v });
    const dofSamples = this.quality.settings.dofSamples || 22;
    const lp = () => ({ value: [0, 1, 2, 3].map(() => new THREE.Vector3()) });
    this.m = {
      copy: this._mat(FRAG.copy, { tDiffuse: T() }),
      bright: this._mat(FRAG.bright, { tDiffuse: T(), uTexel: V2(), uThreshold: F(1.0), uKnee: F(0.6) }),
      blur: this._mat(FRAG.blur, { tDiffuse: T(), uDir: V2() }),
      rays: this._mat(FRAG.rays, { tBright: T(), tDepth: T(), uSun: V2(), uDensity: F(0.92), uDecay: F(0.955), uWeight: F(0.9), uVis: F(0) }),
      ssao: this._mat(FRAG.ssao, { tDepth: T(), uProj: M4(), uInvProj: M4(), uTexel: V2(), uRadius: F(0.6), uIntensity: F(1.1), uMaxDist: F(160), uKernel: { value: ssaoKernel() } }),
      ssaoBlur: this._mat(FRAG.ssaoBlur, { tDiffuse: T(), tDepth: T(), uTexel: V2(), uNear: F(0.1), uFar: F(1000) }),
      ssr: this._mat(FRAG.ssr, { tColor: T(), tDepth: T(), tMask: T(), uProj: M4(), uInvProj: M4(), uTexel: V2(), uMaxDist: F(24), uThick: F(0.35) }),
      vol: this._mat(FRAG.vol, { tDepth: T(), uInvVP: M4(), uCam: { value: new THREE.Vector3() }, uTime: F(0), uDensity: F(0.06), uCount: F(0), uLPos: lp(), uLDir: lp(), uLCol: lp(), uLCone: lp() }),
      taa: this._mat(FRAG.taa, { tCur: T(), tHist: T(), tDepth: T(), uInvVP: M4(), uPrevVP: M4(), uTexel: V2(), uReset: F(1) }),
      motion: this._mat(FRAG.motion, { tColor: T(), tDepth: T(), uInvVP: M4(), uPrevVP: M4(), uScale: F(0.5), uMaxPx: F(24), uRes: V2() }),
      lum: this._mat(FRAG.lum, { tDiffuse: T() }),
      info: this._mat(FRAG.info, { tDepth: T(), tPrev: T(), tLum: T(), uSun: V2(), uNear: F(0.1), uFar: F(1000), uManual: F(0), uBlend: F(0.1), uPrimed: F(0) }),
      composite: this._mat(FRAG.composite, {
        tColor: T(), tAO: T(), tB1: T(), tB2: T(), tB3: T(), tRays: T(), tVol: T(), tSSR: T(), tInfo: T(),
        uAO: F(0), uBloom: F(0), uRays: F(0), uVol: F(0), uSSR: F(0), uExposure: F(1), uAuto: F(1), uKey: F(0.3),
        uVignette: F(0.3), uChroma: F(0), uGrain: F(0), uTime: F(0), uFlare: F(0), uSun: V2(), uFlareCol: { value: new THREE.Color(1, 0.86, 0.66) }, uRes: V2(),
        uLift: { value: new THREE.Vector3() }, uGain: { value: new THREE.Vector3(1, 1, 1) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
        uSat: F(1.1), uContrast: F(1.05), uEmo: { value: new THREE.Vector3() }, uFade: F(1),
      }),
      coc: this._mat(FRAG.coc, { tColor: T(), tDepth: T(), tInfo: T(), uNear: F(0.1), uFar: F(1000), uAperture: F(1.6), uFocus: F(0) }),
      bokeh: this._mat(FRAG.bokeh, { tCoc: T(), uTexel: V2(), uMaxR: F(9) }, { DOF_SAMPLES: dofSamples }),
      dof: this._mat(FRAG.dof, { tColor: T(), tBlur: T(), tDepth: T(), tInfo: T(), uNear: F(0.1), uFar: F(1000), uAperture: F(1.6), uFocus: F(0) }),
      final: this._mat(FRAG.final, { tDiffuse: T(), uTexel: V2(), uFxaa: F(1), uGrain: F(0), uTime: F(0) }),
    };
    this.ssrMaskMat = this.ssrMaskMat || new THREE.ShaderMaterial({
      vertexShader: 'void main(){ gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FRAG.ssrMask, uniforms: { tDepth: { value: null }, uRes: { value: new THREE.Vector2() }, uNear: { value: 0.1 }, uFar: { value: 1000 } },
    });
    this._dofSamples = dofSamples;
  }

  /** Rebuild render targets; called on resize and on tier change. Disposes the old ones. */
  setSize(w, h) {
    this.width = Math.max(1, Math.floor(w)); this.height = Math.max(1, Math.floor(h));
    if ((this.quality.settings.dofSamples || 22) !== this._dofSamples) this._buildMaterials();
    this._disposeRTs();
    const s = this.quality.settings, W = this.width, H = this.height;
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    const type = this.hdrType;
    const mk = (x, y, o) => {
      o = o || {};
      const rt = new THREE.WebGLRenderTarget(Math.max(1, x), Math.max(1, y), {
        type: o.type || type, format: THREE.RGBAFormat, depthBuffer: !!o.depth, stencilBuffer: false,
        minFilter: o.nearest ? THREE.NearestFilter : THREE.LinearFilter, magFilter: o.nearest ? THREE.NearestFilter : THREE.LinearFilter, generateMipmaps: false,
      });
      if (o.depth) { const dt = new THREE.DepthTexture(x, y); dt.type = THREE.UnsignedIntType; dt.format = THREE.DepthFormat; dt.minFilter = dt.magFilter = THREE.NearestFilter; rt.depthTexture = dt; }
      return rt;
    };
    const r = {};
    r.scene = mk(W, H, { depth: true });
    this.depthOK = true;
    r.bright = mk(hw, hh);
    const lv = [[4, 'b1'], [8, 'b2'], [16, 'b3']];
    for (const [div, k] of lv) { r[k] = mk(Math.ceil(W / div), Math.ceil(H / div)); r[k + 't'] = mk(Math.ceil(W / div), Math.ceil(H / div)); }
    r.rays = mk(hw, hh);
    if (this.hdr) { r.lum = mk(64, 64); r.info0 = mk(1, 1, { nearest: true }); r.info1 = mk(1, 1, { nearest: true }); }
    if (s.ssao) { r.ao = mk(hw, hh, { type: THREE.UnsignedByteType }); r.aoBlur = mk(hw, hh, { type: THREE.UnsignedByteType }); }
    if (s.ssr) { r.ssrMask = mk(W, H, { type: THREE.UnsignedByteType, nearest: true }); r.ssr = mk(hw, hh); }
    if (s.volumetric) { r.vol = mk(hw, hh); r.volT = mk(hw, hh); }
    if (s.taa) { r.taa0 = mk(W, H); r.taa1 = mk(W, H); }
    if (s.motionBlur) r.motion = mk(W, H);
    r.ldrA = mk(W, H, { type: THREE.UnsignedByteType });
    if (s.dof) { r.coc = mk(hw, hh, { type: THREE.UnsignedByteType }); r.bokeh = mk(hw, hh, { type: THREE.UnsignedByteType }); r.ldrB = mk(W, H, { type: THREE.UnsignedByteType }); }
    this._rts = r;
    this._histValid = false; this._infoPrimed = false;
    const m = this.m;
    m.ssao.uniforms.uTexel.value.set(1 / hw, 1 / hh); m.ssaoBlur.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    m.ssr.uniforms.uTexel.value.set(1 / W, 1 / H);
    m.taa.uniforms.uTexel.value.set(1 / W, 1 / H);
    m.motion.uniforms.uRes.value.set(W, H);
    m.composite.uniforms.uRes.value.set(W, H);
    m.final.uniforms.uTexel.value.set(1 / W, 1 / H);
    m.bokeh.uniforms.uTexel.value.set(1 / hw, 1 / hh);
    m.bright.uniforms.uTexel.value.set(1 / W, 1 / H);
    this.ssrMaskMat.uniforms.uRes.value.set(W, H);
  }

  get sceneRT() { return this._rts.scene; }

  _disposeRTs() { for (const k in this._rts) if (this._rts[k]) this._rts[k].dispose(); this._rts = {}; }

  /** Sub-pixel jitter (in pixels) for this frame, or (0,0) when TAA is inactive. */
  nextJitter() {
    if (!this.isActive('taa') || !this._rts.taa0) return this.jitter.set(0, 0);
    const i = (this.frame % 16) + 1;
    return this.jitter.set(halton(i, 2) - 0.5, halton(i, 3) - 0.5);
  }

  resetHistory() { this._histValid = false; this._hasPrev = false; }

  /** Mood blend: env = { night, golden, interior, photo } in 0..1. */
  setEnvironment(env) {
    const t = cloneLook(LOOKS.day);
    const mix = (src, a) => {
      if (!(a > 0)) return;
      for (const k of SCAL) t[k] += (src[k] - t[k]) * a;
      for (const k of VEC) for (let i = 0; i < 3; i++) t[k][i] += (src[k][i] - t[k][i]) * a;
    };
    mix(LOOKS.dusk, (env.golden || 0) * (1 - (env.night || 0)));
    mix(LOOKS.night, env.night || 0);
    mix(LOOKS.interior, env.interior || 0);
    mix(LOOKS.photo, env.photo || 0);
    this._lookTarget = t;
  }

  _blendLook(dt) {
    const k = 1 - Math.exp(-dt * 2.5), c = this.look, t = this._lookTarget;
    for (const key of SCAL) c[key] += (t[key] - c[key]) * k;
    for (const key of VEC) for (let i = 0; i < 3; i++) c[key][i] += (t[key][i] - c[key][i]) * k;
    const e = this.emotion; e.amount += (e.target - e.amount) * Math.min(1, dt * 1.5);
  }

  _blit(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target || null);
    this.renderer.render(this.scene, this.camera);
  }

  /** Renders SSR-flagged meshes (camera layer SSR_LAYER) as a depth-tested mask. */
  _ssrMask(scene, camera) {
    const r = this._rts, mm = this.ssrMaskMat.uniforms;
    mm.tDepth.value = r.scene.depthTexture; mm.uNear.value = camera.near; mm.uFar.value = camera.far;
    const prevMask = camera.layers.mask, prevOverride = scene.overrideMaterial, prevBg = scene.background, prevFog = scene.fog;
    camera.layers.set(SSR_LAYER);
    scene.overrideMaterial = this.ssrMaskMat; scene.background = null; scene.fog = null;
    const rr = this.renderer, prevClear = rr.getClearAlpha(); const cc = new THREE.Color(); rr.getClearColor(cc);
    rr.setClearColor(0x000000, 0);
    rr.setRenderTarget(r.ssrMask); rr.clear(true, true, false);
    const sm = rr.shadowMap.autoUpdate; rr.shadowMap.autoUpdate = false;
    rr.render(scene, camera);
    rr.shadowMap.autoUpdate = sm;
    rr.setClearColor(cc, prevClear);
    camera.layers.mask = prevMask; scene.overrideMaterial = prevOverride; scene.background = prevBg; scene.fog = prevFog;
  }

  /**
   * Runs the chain over `sceneRT`. ctx = { scene, camera, time, dt, unjittered, sunScreen, sunVis, volumetric[] }.
   */
  render(ctx) {
    const r = this._rts, m = this.m, cam = ctx.camera, dt = Math.max(1 / 240, Math.min(0.25, ctx.dt || 1 / 60));
    const passes = [];
    this.frame++;
    this._blendLook(dt);
    const look = this.look, cu = m.composite.uniforms;
    const depth = r.scene.depthTexture, near = cam.near, far = cam.far;
    this._vp.multiplyMatrices(ctx.unjittered || cam.projectionMatrix, cam.matrixWorldInverse);
    this._jVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this._invVP.copy(this._jVP).invert();
    const moved = this._hasPrev ? cam.position.distanceTo(this._prevPos) : 0;
    const turned = this._hasPrev ? 2 * Math.acos(Math.min(1, Math.abs(cam.quaternion.dot(this._prevQuat)))) : 0;
    if (this._hasPrev && (moved > 8 || turned > 0.7)) this._histValid = false; // camera cut / teleport
    const cut = !this._histValid;
    let color = r.scene.texture;

    // SSR trace (needs the pre-TAA HDR color + depth; result added in the composite)
    let ssrOn = false;
    if (this.isActive('ssr') && r.ssr && this.ssrCount > 0 && ctx.scene) {
      this._ssrMask(ctx.scene, cam);
      const u = m.ssr.uniforms;
      u.tColor.value = color; u.tDepth.value = depth; u.tMask.value = r.ssrMask.texture;
      u.uProj.value.copy(cam.projectionMatrix); u.uInvProj.value.copy(cam.projectionMatrixInverse);
      this._blit(m.ssr, r.ssr); ssrOn = true; passes.push('ssr');
    }

    // TAA
    if (this.isActive('taa') && r.taa0) {
      const src = this.frame % 2 ? r.taa0 : r.taa1, dst = this.frame % 2 ? r.taa1 : r.taa0, u = m.taa.uniforms;
      u.tCur.value = color; u.tHist.value = src.texture; u.tDepth.value = depth;
      u.uInvVP.value.copy(this._invVP); u.uPrevVP.value.copy(this._hasPrev ? this._prevVP : this._vp); u.uReset.value = cut ? 1 : 0;
      this._blit(m.taa, dst); color = dst.texture; passes.push('taa');
    }
    this._histValid = true;

    // Info: autofocus, sun occlusion, eye adaptation
    let info = this._infoFallback;
    if (this.hdr && r.lum) {
      m.lum.uniforms.tDiffuse.value = color; this._blit(m.lum, r.lum);
      const prev = this._infoIdx ? r.info1 : r.info0, next = this._infoIdx ? r.info0 : r.info1; this._infoIdx ^= 1;
      const u = m.info.uniforms;
      u.tDepth.value = depth; u.tPrev.value = prev.texture; u.tLum.value = r.lum.texture;
      if (ctx.sunScreen) u.uSun.value.copy(ctx.sunScreen);
      u.uNear.value = near; u.uFar.value = far; u.uManual.value = this.focus; u.uPrimed.value = this._infoPrimed ? 1 : 0;
      u.uBlend.value = cut ? 1 : Math.min(1, dt * 5);
      this._blit(m.info, next); this._infoPrimed = true; info = next.texture; passes.push('info');
    } else {
      this._infoFallback.image.data[0] = this.focus || 8; this._infoFallback.image.data[1] = ctx.sunVis ? 1 : 0; this._infoFallback.needsUpdate = true;
    }

    // Camera motion blur (1/120 s shutter); off with reduced motion.
    if (this.isActive('motionBlur') && r.motion && this._hasPrev && !cut && (moved > 0.002 || turned > 0.0005)) {
      const u = m.motion.uniforms;
      u.tColor.value = color; u.tDepth.value = depth; u.uInvVP.value.copy(this._invVP); u.uPrevVP.value.copy(this._prevVP);
      u.uScale.value = Math.min(1.0, (1 / 120) / dt); u.uMaxPx.value = Math.max(10, this.height * 0.035);
      this._blit(m.motion, r.motion); color = r.motion.texture; passes.push('motionBlur');
    }

    // SSAO (half res) + bilateral blur
    if (this.isActive('ssao') && r.ao) {
      const u = m.ssao.uniforms;
      u.tDepth.value = depth; u.uProj.value.copy(cam.projectionMatrix); u.uInvProj.value.copy(cam.projectionMatrixInverse);
      this._blit(m.ssao, r.ao);
      const b = m.ssaoBlur.uniforms; b.tDiffuse.value = r.ao.texture; b.tDepth.value = depth; b.uNear.value = near; b.uFar.value = far;
      this._blit(m.ssaoBlur, r.aoBlur);
      cu.tAO.value = r.aoBlur.texture; cu.uAO.value = look.ao; passes.push('ssao');
    } else { cu.tAO.value = this._white; cu.uAO.value = 0; }

    // Bright pass → bloom pyramid
    const bloom = this.isActive('bloom');
    const rays = this.isActive('godrays') && ctx.sunScreen && ctx.sunVis > 0.001;
    if (bloom || rays) {
      m.bright.uniforms.tDiffuse.value = color; m.bright.uniforms.uThreshold.value = this.hdr ? 1.0 : 0.8;
      this._blit(m.bright, r.bright);
    }
    const levels = Math.max(1, Math.min(3, this.quality.settings.bloomLevels || 3));
    if (bloom) {
      const u = m.blur.uniforms; let src = r.bright.texture;
      const keys = ['b1', 'b2', 'b3'];
      for (let i = 0; i < levels; i++) {
        const a = r[keys[i]], t = r[keys[i] + 't'];
        u.tDiffuse.value = src; u.uDir.value.set(1 / a.width, 0); this._blit(m.blur, t);
        u.tDiffuse.value = t.texture; u.uDir.value.set(0, 1 / a.height); this._blit(m.blur, a);
        src = a.texture;
      }
      cu.tB1.value = r.b1.texture; cu.tB2.value = levels > 1 ? r.b2.texture : this._black; cu.tB3.value = levels > 2 ? r.b3.texture : this._black;
      cu.uBloom.value = look.bloom; passes.push('bloom');
    } else { cu.tB1.value = cu.tB2.value = cu.tB3.value = this._black; cu.uBloom.value = 0; }

    // God rays
    if (rays) {
      const u = m.rays.uniforms; u.tBright.value = r.bright.texture; u.tDepth.value = depth; u.uSun.value.copy(ctx.sunScreen); u.uVis.value = ctx.sunVis;
      this._blit(m.rays, r.rays); cu.tRays.value = r.rays.texture; cu.uRays.value = look.rays; passes.push('godrays');
    } else { cu.tRays.value = this._black; cu.uRays.value = 0; }

    // Volumetric light shafts (engine.volumetric)
    const vlist = (ctx.volumetric || []).filter((l) => l && l.enabled !== false && l.intensity > 0);
    if (this.isActive('volumetric') && r.vol && vlist.length) {
      vlist.sort((a, b) => a.position.distanceToSquared(cam.position) - b.position.distanceToSquared(cam.position));
      const u = m.vol.uniforms, n = Math.min(4, vlist.length);
      for (let i = 0; i < n; i++) {
        const l = vlist[i];
        u.uLPos.value[i].copy(l.position); u.uLDir.value[i].copy(l.direction).normalize();
        const c = l.color || { r: 1, g: 0.9, b: 0.75 };
        u.uLCol.value[i].set(c.r * l.intensity, c.g * l.intensity, c.b * l.intensity);
        u.uLCone.value[i].set(Math.cos(l.angle || 0.35), l.range || 20, 0);
      }
      u.uCount.value = n; u.tDepth.value = depth; u.uInvVP.value.copy(this._invVP); u.uCam.value.copy(cam.position); u.uTime.value = ctx.time;
      this._blit(m.vol, r.vol);
      const b = m.blur.uniforms;
      b.tDiffuse.value = r.vol.texture; b.uDir.value.set(1 / r.vol.width, 0); this._blit(m.blur, r.volT);
      b.tDiffuse.value = r.volT.texture; b.uDir.value.set(0, 1 / r.vol.height); this._blit(m.blur, r.vol);
      cu.tVol.value = r.vol.texture; cu.uVol.value = look.vol; passes.push('volumetric');
    } else { cu.tVol.value = this._black; cu.uVol.value = 0; }

    cu.tSSR.value = ssrOn ? r.ssr.texture : this._black; cu.uSSR.value = ssrOn ? look.ssr : 0;

    // Composite
    const dofOn = this.isActive('dof') && r.coc;
    const fxaa = this.isActive('fxaa') && !this.isActive('taa');
    const grain = this.isActive('grain') ? look.grain : 0;
    const needFinal = fxaa || grain > 0 || dofOn;
    cu.tColor.value = color; cu.tInfo.value = info; cu.uTime.value = ctx.time;
    cu.uExposure.value = look.exposure; cu.uKey.value = look.key; cu.uAuto.value = this.isActive('autoExposure') ? 1 : 0;
    cu.uVignette.value = this.isActive('vignette') ? look.vignette : 0;
    cu.uChroma.value = this.isActive('chroma') ? look.chroma : 0;
    cu.uSat.value = look.sat; cu.uContrast.value = look.contrast;
    cu.uLift.value.fromArray(look.lift); cu.uGain.value.fromArray(look.gain); cu.uTint.value.fromArray(look.tint);
    cu.uFlare.value = this.isActive('lensflare') && ctx.sunScreen ? look.flare * (ctx.sunVis || 0) : 0;
    if (ctx.sunScreen) cu.uSun.value.copy(ctx.sunScreen);
    const e = this.emotion; cu.uEmo.value.set(e.valence, e.arousal, e.amount);
    cu.uGrain.value = needFinal ? 0 : grain;
    cu.uFade.value = ctx.fade == null ? 1 : ctx.fade;
    if (cu.uFlare.value > 0) passes.push('lensflare');
    if (cu.uAuto.value) passes.push('autoExposure');
    if (e.amount > 0.01) passes.push('emotionGrade');
    this._blit(m.composite, needFinal ? r.ldrA : null);
    passes.push('composite');
    let ldr = r.ldrA.texture;

    // Bokeh DOF (on the graded LDR image)
    if (dofOn) {
      for (const mat of [m.coc, m.dof]) {
        const u = mat.uniforms; u.tDepth.value = depth; u.tInfo.value = info; u.uNear.value = near; u.uFar.value = far; u.uAperture.value = this.aperture; u.uFocus.value = this.focus;
      }
      m.coc.uniforms.tColor.value = ldr; this._blit(m.coc, r.coc);
      m.bokeh.uniforms.tCoc.value = r.coc.texture; m.bokeh.uniforms.uMaxR.value = Math.max(4, Math.min(14, this.height / 80));
      this._blit(m.bokeh, r.bokeh);
      m.dof.uniforms.tColor.value = ldr; m.dof.uniforms.tBlur.value = r.bokeh.texture;
      this._blit(m.dof, r.ldrB); ldr = r.ldrB.texture; passes.push('dof');
    }

    if (needFinal) {
      const u = m.final.uniforms; u.tDiffuse.value = ldr; u.uFxaa.value = fxaa ? 1 : 0; u.uGrain.value = grain; u.uTime.value = ctx.time;
      this._blit(m.final, null);
      if (fxaa) passes.push('fxaa');
      if (grain > 0) passes.push('grain');
    }
    if (cu.uVignette.value > 0) passes.push('vignette');
    if (cu.uChroma.value > 0) passes.push('chroma');

    this._prevVP.copy(this._vp); this._prevPos.copy(cam.position); this._prevQuat.copy(cam.quaternion); this._hasPrev = true;
    this.lastPasses = passes;
  }

  /** Minimal path for experiment mode: tonemap + output only. */
  renderMinimal(ctx) {
    const cu = this.m.composite.uniforms;
    cu.tColor.value = this._rts.scene.texture; cu.tInfo.value = this._infoFallback;
    cu.tAO.value = this._white; cu.tB1.value = cu.tB2.value = cu.tB3.value = cu.tRays.value = cu.tVol.value = cu.tSSR.value = this._black;
    cu.uAO.value = cu.uBloom.value = cu.uRays.value = cu.uVol.value = cu.uSSR.value = cu.uFlare.value = cu.uGrain.value = cu.uChroma.value = 0;
    cu.uAuto.value = 0; cu.uFade.value = 1; cu.uTime.value = ctx.time || 0;
    this._blit(this.m.composite, null);
    this.lastPasses = ['composite'];
  }

  dispose() {
    this._disposeRTs();
    for (const k in this.m) this.m[k].dispose();
    this.ssrMaskMat.dispose(); this.quad.geometry.dispose();
    this._black.dispose(); this._white.dispose(); this._infoFallback.dispose();
  }
}

/* ------------------------------------------------------------------ SSS skin */
// Shared strength uniform: Engine sets it to 0 when the tier or the `sss` toggle disables it.
const SSS_UNIFORM = { value: 1 };

/**
 * Skin material with a subsurface-scattering approximation for A4's humanoids.
 * opts: { color, roughness, scatterColor, wrap, transmission, map, normalMap, name }
 * Adds per light: (wrap-lit − lambert) band near the terminator tinted with a red-shifted scatter
 * colour, plus thin-part back-lighting (ears, nose) — strength follows SSS_UNIFORM.
 */
function makeSkinMaterial(THREE_, opts) {
  const T = THREE_ || THREE; opts = opts || {};
  const mat = new T.MeshStandardMaterial({
    color: opts.color != null ? opts.color : 0xc68e6a, roughness: opts.roughness != null ? opts.roughness : 0.55, metalness: 0,
    map: opts.map || null, normalMap: opts.normalMap || null,
  });
  mat.name = opts.name || 'skin';
  const sc = new T.Color(opts.scatterColor != null ? opts.scatterColor : 0xd2452a);
  const uni = { uSSS: SSS_UNIFORM, uScatter: { value: new T.Vector3(sc.r, sc.g, sc.b) }, uWrap: { value: opts.wrap != null ? opts.wrap : 0.55 }, uTrans: { value: opts.transmission != null ? opts.transmission : 0.35 } };
  mat.userData.sss = uni;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uni);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSSS; uniform vec3 uScatter; uniform float uWrap; uniform float uTrans;\n'
        + 'vec3 zSSS(vec3 L, vec3 C, vec3 N, vec3 V, vec3 dc){ float nl = dot(N, L); float w = max(0.0, (nl + uWrap) / (1.0 + uWrap));\n'
        + '  float band = max(0.0, w - max(nl, 0.0)); float tr = pow(clamp(dot(V, -normalize(L + N * 0.35)), 0.0, 1.0), 4.0) * uTrans;\n'
        + '  return C * dc * uScatter * (band * 0.9 + tr); }')
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nif (uSSS > 0.0) { vec3 zs = vec3(0.0);\n'
        + '#if NUM_DIR_LIGHTS > 0\n for (int i = 0; i < NUM_DIR_LIGHTS; i++) zs += zSSS(directionalLights[i].direction, directionalLights[i].color, geometryNormal, geometryViewDir, material.diffuseColor);\n#endif\n'
        + '#if NUM_POINT_LIGHTS > 0\n for (int i = 0; i < NUM_POINT_LIGHTS; i++) { vec3 lv = pointLights[i].position - geometryPosition; float ld = length(lv);\n'
        + '  zs += zSSS(lv / max(ld, 1e-4), pointLights[i].color * getDistanceAttenuation(ld, pointLights[i].distance, pointLights[i].decay), geometryNormal, geometryViewDir, material.diffuseColor); }\n#endif\n'
        + ' reflectedLight.directDiffuse += zs * uSSS;\n'
        + ' reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.06, 0.98, 0.95), uSSS); }');
  };
  mat.customProgramCacheKey = () => 'zehn-skin-sss';
  return mat;
}

module.exports = { PostFX, LOOKS, SSR_LAYER, SSS_UNIFORM, makeSkinMaterial, detectHdrType };
