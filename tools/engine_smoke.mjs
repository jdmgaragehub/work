// A3 engine smoke test: bundles three + src/engine/* + src/core/bus.js + a test scene into one HTML file,
// loads it in Playwright Chromium (SwiftShader) for each tier, and checks: zero console errors, a non-blank
// frame (pixel variance), every post-FX toggle on/off, time of day, emotion grade, DOF, experiment mode, modes.
// Usage: node tools/engine_smoke.mjs [outHtml]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || path.join(process.env.TMPDIR || '/tmp', 'engine_smoke.html');

const mods = ['src/core/bus.js', ...fs.readdirSync(path.join(root, 'src/engine')).filter((f) => f.endsWith('.js')).map((f) => 'src/engine/' + f)];
const TEST_MAIN = `
const THREE = require('three');
const { EventBus } = require('./core/bus.js');
const { Engine } = require('./engine/renderer.js');
const { Controls } = require('./engine/controls.js');
const { Input } = require('./engine/input.js');
const { makeSkinMaterial } = require('./engine/postfx.js');
const params = new URLSearchParams(location.search);
const sim = { bus: new EventBus(), state: { mode: 'walk', zone: 'courtyard', timeOfDay: 'day' }, services: {},
  settings: { quality: params.get('quality') || 'auto', reducedMotion: false, emotionGrade: true, mouseSens: 1, invertY: false,
    toggles: { taa: true, motionBlur: true, ssao: true, bloom: true, godrays: true, ssr: true, dof: true, lensflare: true, grain: true, vignette: true, chroma: true, autoExposure: true, volumetric: true, sss: true } } };
sim.services.input = new Input(sim);
const engine = new Engine(sim, document.getElementById('c'));
const controls = new Controls(sim, engine);
const S = engine.scene, M = engine.mats;
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), M.get('terrazzo')); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);
const colliders = [];
const box = (x, z, w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.get(mat)); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; S.add(m);
  colliders.push(new THREE.Box3().setFromObject(m)); return m; };
box(-6, -4, 4, 6, 4, 'brick'); box(6, -6, 3, 3, 3, 'plaster'); box(0, -14, 10, 8, 1, 'jaali'); box(10, 2, 2, 1, 2, 'wood'); box(-10, 4, 3, 2, 3, 'tiles');
const sph = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 24), makeSkinMaterial(THREE, {})); sph.position.set(0, 1.5, -2); sph.castShadow = true; S.add(sph);
const metal = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 120, 16), M.get('brass')); metal.position.set(3, 2, 0); S.add(metal);
const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), M.emissive(0xffcc88, 30)); lamp.position.set(-3, 4, 2); S.add(lamp);
const pl = new THREE.PointLight(0xffcc88, 30, 20); pl.position.copy(lamp.position); S.add(pl);
engine.addVolumetric({ position: new THREE.Vector3(-2, 7, -6), direction: new THREE.Vector3(0.3, -1, 0.4), angle: 0.25, range: 14, intensity: 1.5 });
const world = { colliders, interactables: [{ id: 'orb', zone: 'courtyard', pos: sph.position.clone(), radius: 4, label: 'orb', onUse() { window.__used = true; } }], zoneAt: () => 'courtyard' };
controls.setWorld(world);
controls.teleport({ pos: [0, 1.65, 9], yaw: 0, pitch: -0.05 });
engine.addUpdate((dt, t) => { metal.rotation.y = t; controls.update(dt); });
engine.start();
window.__smoke = { engine, controls, sim, THREE };
`;

const three = fs.readFileSync(path.join(root, 'vendor/three.r160.raw.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'build/bundle.mjs'), 'utf8').match(/const loader = `([\s\S]*?)`;/)[1];
let defs = '';
for (const id of mods) defs += `/* ===== ${id} ===== */\n__def(${JSON.stringify(id)}, function (module, exports, require) {\n${fs.readFileSync(path.join(root, id), 'utf8')}\n});\n`;
defs += `__def('src/smoke_main.js', function (module, exports, require) {\n${TEST_MAIN}\n});\n`;
const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000}#c{width:100%;height:100%;display:block}</style></head>
<body><canvas id="c"></canvas><script>(function(){'use strict';\n${three}\n${loader}\n${defs}\n__require('', 'src/smoke_main.js');\n})();</script></body></html>`;
fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1048576).toFixed(2), 'MB');

if (process.env.BUILD_ONLY) process.exit(0);
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const TOGGLES = ['taa', 'motionBlur', 'ssao', 'bloom', 'godrays', 'ssr', 'dof', 'lensflare', 'grain', 'vignette', 'chroma', 'autoExposure', 'volumetric', 'sss', 'fxaa'];
let failed = 0;
const results = [];
const TIERS = (process.env.SMOKE_TIERS || 'low,medium,high,ultra').split(',');
for (const tier of TIERS) {
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /WebGL|GL_|shader|THREE/i.test(m.text()))) errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await page.goto('file://' + OUT + '?quality=' + tier);
  await page.waitForFunction(() => window.__smoke && window.__smoke.engine.frame > 5, null, { timeout: 60000 });
  await page.waitForTimeout(3000);
  const r = await page.evaluate(async (TOGGLES) => {
    const { engine, controls, sim } = window.__smoke;
    const wait = (ms) => new Promise((res) => setTimeout(res, ms));
    const variance = () => new Promise((res) => {
      const url = engine.screenshot(); const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = 96; c.height = 54; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 96, 54);
        const d = x.getImageData(0, 0, 96, 54).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; s += l; s2 += l * l; n++; }
        const m = s / n; res({ mean: +m.toFixed(1), var: +(s2 / n - m * m).toFixed(1) }); };
      img.onerror = () => res({ mean: 0, var: 0 }); img.src = url;
    });
    const out = { tier: engine.tier, stats: engine.stats, frame0: await variance(), toggles: {}, extra: {} };
    engine.setDOF({ focus: 0, aperture: 1.8 }); await wait(400); out.extra.dofPasses = engine.stats.passes.includes('dof');
    for (const t of TOGGLES) {
      engine.setToggle(t, false); await wait(250); const off = engine.stats.passes.slice(); const v = await variance();
      engine.setToggle(t, true); await wait(250); const on = engine.stats.passes.slice();
      out.toggles[t] = { onHas: on.includes(t), offHas: off.includes(t), var: v.var };
    }
    engine.setDOF(null);
    for (const tod of ['dusk', 'night', 'day']) { engine.setTimeOfDay(tod, true); await wait(400); out.extra[tod] = await variance(); }
    engine.setEmotionGrade({ valence: -0.6, arousal: 0.7 }); await wait(500); out.extra.emotion = engine.stats.passes.includes('emotionGrade'); engine.setEmotionGrade(null);
    for (const m of ['director', 'neuro', 'photo', 'drone', 'tour', 'clinic', 'walk']) { controls.setMode(m); await wait(150); }
    out.extra.modeOK = sim.state.mode === 'walk';
    await controls.flyTo([0, 8, 20], [0, 0, 0], 0.3); out.extra.flyTo = true;
    controls.teleport({ pos: [0, 1.65, 1], yaw: 0 }); out.extra.lookTarget = !!controls.lookTarget();
    const sd = engine.sky.sunDir; controls.teleport({ pos: [0, 1.65, 20], yaw: Math.atan2(-sd.x, -sd.z), pitch: Math.asin(sd.y) - 0.15 }); await wait(1200);
    out.extra.sunPasses = engine.stats.passes.filter((p) => p === 'godrays' || p === 'lensflare');
    const spin = engine.addUpdate((dt) => { controls.yaw += dt * 0.6; }); await wait(1500);
    out.extra.motionBlur = engine.stats.passes.includes('motionBlur'); spin();
    controls.teleport({ pos: [0, 1.65, 9], yaw: 0, pitch: -0.05 });
    engine.setExperimentMode(true); const f0 = engine.frame; await wait(300); out.extra.expPaused = engine.frame === f0; engine.setExperimentMode(false);
    sim.settings.reducedMotion = true; const spin2 = engine.addUpdate((dt) => { controls.yaw += dt * 0.6; }); const fr = engine.frame; await wait(1500);
    out.extra.reducedNoMB = engine.frame > fr + 1 && !engine.stats.passes.includes('motionBlur'); spin2(); sim.settings.reducedMotion = false;
    const t0 = engine.frame, ts = performance.now(); await wait(3000); out.fps = +((engine.frame - t0) / ((performance.now() - ts) / 1000)).toFixed(1);
    out.finalStats = engine.stats;
    return out;
  }, TOGGLES);
  const problems = [];
  if (errors.length) problems.push('console: ' + errors.slice(0, 5).join(' | '));
  if (r.tier !== tier) problems.push('tier ' + r.tier + ' != ' + tier);
  if (r.frame0.var < 20) problems.push('blank frame (var ' + r.frame0.var + ')');
  for (const [t, v] of Object.entries(r.toggles)) { if (v.offHas) problems.push('toggle ' + t + ' did not turn off'); if (v.var < 20) problems.push('blank with ' + t + ' off'); }
  for (const k of ['modeOK', 'flyTo', 'lookTarget', 'expPaused', 'reducedNoMB', 'emotion']) if (!r.extra[k]) problems.push('check failed: ' + k);
  const active = Object.entries(r.toggles).filter(([, v]) => v.onHas).map(([k]) => k);
  console.log(`\n[${tier}] fps=${r.fps} hdr=${r.stats.hdr} gpu="${r.stats.gpu}" draws=${r.stats.drawCalls} tris=${r.stats.triangles} frame mean/var=${r.frame0.mean}/${r.frame0.var}`);
  console.log(`  passes: ${r.finalStats.passes.join(',')}`);
  if ((tier === 'high' || tier === 'ultra') && !r.extra.motionBlur) problems.push('motion blur not active while turning');
  if (tier !== 'low' && r.extra.sunPasses.length < 2) problems.push('sun passes missing: ' + r.extra.sunPasses);
  console.log(`  sun-facing passes: ${r.extra.sunPasses}`);
  console.log(`  toggles active at tier: ${active.join(',')}  dof=${r.extra.dofPasses}  dusk/night var=${r.extra.dusk.var}/${r.extra.night.var}`);
  console.log(problems.length ? '  FAIL: ' + problems.join('\n        ') : '  OK');
  if (problems.length) failed++;
  results.push({ tier, fps: r.fps });
  await page.close();
}
await browser.close();
console.log('\nFPS:', results.map((x) => x.tier + '=' + x.fps).join(' '));
process.exit(failed ? 1 : 0);
