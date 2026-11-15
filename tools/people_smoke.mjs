// People smoke test (A4): bundles three.js + face2d + humanoid/crowd/social into a scratch HTML (same loader as
// build/bundle.mjs), renders 6 humanoids (emotions/poses/outfits) + an instanced crowd in headless Chromium,
// asserts zero console errors and saves screenshots.
// Usage: node tools/people_smoke.mjs [outDir]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = process.argv[2] || '/tmp/claude-0/-home-user-work/0a4c4a0f-d7ad-5a2c-972c-07759120136b/scratchpad';
fs.mkdirSync(outDir, { recursive: true });
const OUT = path.join(outDir, 'people_smoke.html');

const mods = ['src/people/face2d.js', 'src/people/humanoid.js', 'src/people/crowd.js', 'src/people/social.js', 'src/psych/socialmodels.js'];
for (const opt of ['src/engine/postfx.js']) if (fs.existsSync(path.join(root, opt))) mods.push(opt);
const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
let modules = '';
for (const id of mods) modules += `/* ===== ${id} ===== */\n__def(${JSON.stringify(id)}, function (module, exports, require) {\n${safe(fs.readFileSync(path.join(root, id), 'utf8'))}\n});\n`;
const three = fs.readFileSync(path.join(root, 'vendor', 'three.r160.raw.js'), 'utf8');
const loader = `
const __defs = Object.create(null), __cache = Object.create(null);
function __def(id, fn) { __defs[id] = fn; }
function __resolve(from, req) {
  if (req === 'three') return 'three';
  let parts = req.startsWith('.') ? from.split('/').slice(0, -1).concat(req.split('/')) : req.split('/');
  const out = [];
  for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.' && p !== '') out.push(p); }
  const base = out.join('/');
  for (const c of [base, base + '.js', base + '.json', base + '/index.js']) if (__defs[c]) return c;
  throw new Error('ZEHN loader: cannot resolve ' + req + ' from ' + from);
}
function __require(from, req) {
  const id = __resolve(from, req);
  if (id === 'three') return __THREE;
  if (__cache[id]) return __cache[id].exports;
  const module = { exports: {} };
  __cache[id] = module;
  __defs[id](module, module.exports, (r) => __require(id, r));
  return module.exports;
}`;

const scene = `
const THREE = __THREE;
const { createHumanoid } = __require('', 'src/people/humanoid.js');
const { createCrowd } = __require('', 'src/people/crowd.js');
const { createSocialSim } = __require('', 'src/people/social.js');
const events = [];
const bus = { emit(e, p) { events.push([e, p]); } };
const view = new URLSearchParams(location.search).get('view') || 'wide';
const W = 1280, H = 720;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);
const sc = new THREE.Scene();
sc.background = new THREE.Color('#bcd3e6'); sc.fog = new THREE.Fog('#bcd3e6', 25, 70);
sc.add(new THREE.HemisphereLight('#dfeaf5', '#6b5a48', 1.1));
const sun = new THREE.DirectionalLight('#fff3df', 2.4); sun.position.set(6, 10, 8); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12 }); sc.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: '#b7a58a', roughness: 0.95 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
const bench = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.46, 0.5), new THREE.MeshStandardMaterial({ color: '#7a5230' }));
const cam = new THREE.PerspectiveCamera(view === 'faces' ? 30 : 50, W / H, 0.05, 200);
const specs = [
  { lookIndex: 0, outfit: 'shalwar', emotion: 'happiness', pose: 'talk', name: 'A' },
  { lookIndex: 1, outfit: 'hijab', emotion: 'sadness', pose: 'idle', name: 'B' },
  { lookIndex: 2, outfit: 'waistcoat', emotion: 'surprise', pose: 'wave', name: 'C' },
  { lookIndex: 3, outfit: 'dupatta', emotion: 'fear', pose: 'idle', name: 'D' },
  { lookIndex: 4, outfit: 'labcoat', emotion: 'anger', pose: 'point', name: 'E' },
  { lookIndex: 5, outfit: 'sweater', emotion: 'disgust', pose: 'sit', name: 'F', gender: 'f' },
];
const people = specs.map((s, k) => {
  const p = createHumanoid(THREE, { lookIndex: s.lookIndex, outfit: s.outfit, gender: s.gender, tier: 'high', name: s.name, bus, voice: false });
  p.group.position.set((k - 2.5) * 1.15, 0, 0);
  p.setEmotion(s.emotion, 1); p.setPose(s.pose);
  sc.add(p.group);
  return p;
});
bench.position.set(people[5].group.position.x, 0.23, -0.12); sc.add(bench);
people[5].group.position.z = 0.05;
people[0].speak('Assalam o alaikum, welcome to the mohalla lab.');
const camTarget = new THREE.Object3D(); sc.add(camTarget);
people[1].setGaze(camTarget); people[2].setGaze(camTarget); people[3].setGaze(people[2].group.position.clone().setY(1.6));
people[4].setGaze(new THREE.Vector3(-6, 1.2, 6));
people[1].posture = 0.6;
const crowd = createCrowd(THREE, { count: 70, bounds: { minX: -14, maxX: 14, minZ: -16, maxZ: -4 }, paths: [[[-14, -6], [14, -6]], [[-12, -12], [0, -9], [12, -14]]], seats: [{ x: -4, z: -5, yaw: Math.PI }, { x: -3.3, z: -5, yaw: Math.PI }], seed: 7, tier: 'high' });
sc.add(crowd.mesh);
const social = createSocialSim({ bus }, crowd, { stage: { x: 6, z: -11 } });
const r1 = social.run('bystander', { n: 5 });
const r2 = social.run('cooperation', {});
const r3 = social.run('conformity', { majority: 6 });
if (view === 'faces') { cam.position.set(-1.2, 1.45, 1.7); cam.lookAt(-1.2, 1.4, 0); }
else if (view === 'face1') { cam.position.set(people[0].group.position.x + 0.15, 1.62, 0.75); cam.lookAt(people[0].group.position.x, 1.6, 0); }
else if (view === 'face4') { cam.position.set(people[3].group.position.x - 0.1, 1.5, 0.9); cam.lookAt(people[3].group.position.x, 1.45, 0); }
else if (view === 'crowd') { cam.position.set(0, 2.2, 3.5); cam.lookAt(0, 1.2, -8); }
else { cam.position.set(0, 1.6, 5.2); cam.lookAt(0, 1.0, 0); }
camTarget.position.copy(cam.position);
let t = 0;
const steps = 150;
for (let f = 0; f < steps; f++) {
  const dt = 1 / 30; t += dt;
  for (const p of people) p.update(dt, t, cam);
  crowd.update(dt, t); social.update(dt, t);
}
renderer.render(sc, cam);
window.__smoke = { ok: true, events: events.map((e) => e[0]), bystander: r1.helpedPct, coop: r2.ranking, conf: r3.conformityRate, tris: renderer.info.render.triangles, calls: renderer.info.render.calls, speed: people.map((p) => +p.walkSpeed.toFixed(2)) };
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><title>people smoke</title><style>body{margin:0;background:#000}</style></head><body>
<script>(function(){'use strict';
${three}
${loader}
${modules}
try {
${scene}
} catch (e) { console.error('SMOKE FAIL', e && e.stack || e); window.__smoke = { ok: false, error: String(e && e.stack || e) }; }
})();</script></body></html>`;
fs.writeFileSync(OUT, html);
console.log('wrote', OUT, (html.length / 1048576).toFixed(2), 'MB');

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch (e) { console.error('playwright not available:', e.message); process.exit(2); }
const browser = await playwright.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let failures = 0;
for (const view of ['wide', 'faces', 'face1', 'face4', 'crowd']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('file://' + OUT + '?view=' + view);
  await page.waitForFunction(() => window.__smoke, null, { timeout: 120000 });
  const res = await page.evaluate(() => window.__smoke);
  const png = path.join(outDir, `people_smoke_${view}.png`);
  await page.screenshot({ path: png });
  console.log(view, JSON.stringify(res), 'errors:', errors.length, '→', png);
  if (errors.length || !res.ok) { failures++; console.error(errors.slice(0, 5).join('\n')); }
  await page.close();
}
await browser.close();
if (failures) { console.error('FAIL: console errors'); process.exit(1); }
console.log('PASS: 0 console errors');
