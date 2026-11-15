// ZEHN end-to-end verification (A11) — Playwright Chromium over file://, network blocked.
// Usage: node e2e/run.mjs [--soak=600] [--quick] [--timing=500]
// Writes e2e/out/report.json and screenshots in e2e/out/*.png (deviceScaleFactor 1).
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const T = require('../src/exp/core/timeline.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(root, 'e2e', 'out');
fs.mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith('--' + k)); if (!a) return d; const v = a.split('=')[1]; return v == null ? true : v; };
const SOAK = +arg('soak', 0), QUICK = !!arg('quick', false), TIMING_N = +arg('timing', 500);
const FILE = pathToFileURL(path.join(root, 'dist', 'ZEHN_Psychology_Lab_Simulator.html')).href;
const report = { started: new Date().toISOString(), url: FILE, consoleErrors: [], pageErrors: [], network: [], sections: {} };
const log = (...a) => console.log('[e2e]', ...a);
const section = (name, data) => { report.sections[name] = data; fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); };

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, acceptDownloads: true });
// G8: offline — block every non-file request
await context.route('**/*', (route) => { const u = route.request().url(); if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) return route.continue(); report.network.push(u); return route.abort(); });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
page.on('pageerror', (e) => report.pageErrors.push(String(e && e.stack || e)));
const lastLogs = []; page.on('console', (m) => { lastLogs.push(m.type() + ': ' + m.text().slice(0, 240)); if (lastLogs.length > 30) lastLogs.shift(); });
page.on('crash', () => { report.crash = { at: new Date().toISOString(), lastLogs: lastLogs.slice() }; fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1)); console.log('[e2e] PAGE CRASH', lastLogs.slice(-12).join('\n')); });
page.on('download', async (d) => { report.downloads = (report.downloads || 0) + 1; await d.cancel().catch(() => {}); });

async function load(q = '') {
  await page.goto(FILE + '?e2e=1&seed=e2e-2026' + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__zehnTest && document.getElementById('boot').classList.contains('done'), null, { timeout: 180000 });
}
/** Close any modal/experiment overlay. */
async function settle(max = 12) {
  for (let i = 0; i < max; i++) {
    const st = await page.evaluate(() => ({ modal: document.querySelectorAll('.modal-back').length, exp: !!document.querySelector('.exp') }));
    if (!st.modal && !st.exp) return;
    if (st.modal) {
      const handled = await page.evaluate(() => {
        const backs = document.querySelectorAll('.modal-back'); const top = backs[backs.length - 1];
        const btns = Array.from(top.querySelectorAll('.actions button'));
        const pref = btns.find((b) => /withdraw|keep my data|close|done|cancel|not consent|use defaults|keep going|text-and-quiz|resume|mark as studied/i.test(b.textContent)) || btns[0];
        if (pref) { pref.click(); return true; } return false;
      });
      if (!handled) await page.keyboard.press('Escape');
    } else if (st.exp) await page.keyboard.press('Escape');
    await page.waitForTimeout(120);
  }
}
const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 120000 }).catch((e) => log('shot failed', name, e.message.split('\n')[0]));

log('loading', FILE);
const t0 = Date.now();
await load('&quality=low');
section('boot', { ms: Date.now() - t0, services: await page.evaluate(() => window.__zehnTest.services()), build: await page.evaluate(() => window.__ZEHN_BUILD__) });
await settle();
await shot('00_boot_courtyard');

// ---- modes & zones
const modes = ['walk', 'director', 'participant', 'clinic', 'social', 'neuro', 'tour'];
const modeRes = {};
for (const m of modes) { await page.evaluate((x) => window.__zehnTest.setMode(x), m); await page.waitForTimeout(600); await settle(); await shot('mode_' + m); modeRes[m] = await page.evaluate(() => window.__zehnTest.sim.state.mode); }
await page.evaluate(() => window.__zehnTest.setMode('walk'));
const zones = ['courtyard', 'wundt', 'explab', 'neuro', 'sleep', 'learning', 'childdev', 'clinic', 'mohalla', 'library'];
const zoneRes = {};
for (const z of zones) { await page.evaluate((x) => window.__zehnTest.teleport(x), z); await page.waitForTimeout(500); await settle(); zoneRes[z] = await page.evaluate(() => window.__zehnTest.sim.state.zone); await shot('zone_' + z); }
for (const t of ['day', 'dusk', 'night']) { await page.evaluate((x) => window.__zehnTest.setTime(x), t); await page.evaluate(() => window.__zehnTest.teleport('courtyard')); await page.waitForTimeout(600); await shot('time_' + t); }
await page.evaluate(() => window.__zehnTest.setTime('day'));
section('modes_zones', { modes: modeRes, zones: zoneRes });
log('modes/zones ok');

// ---- panels: open every panel, press every button
const panelIds = await page.evaluate(() => window.__zehnTest.panels());
const panelRes = {};
for (const id of panelIds) {
  await settle();
  await page.evaluate((x) => window.__zehnTest.openPanel(x), id);
  await page.waitForTimeout(150);
  const tags = await page.evaluate(() => Array.from(document.querySelectorAll('.drawer .tags .tag')).map((t) => t.textContent));
  let pressed = 0, dead = [];
  const n = await page.evaluate(() => document.querySelectorAll('.drawer .body button').length);
  for (let i = 0; i < Math.min(n, QUICK ? 12 : 80); i++) {
    const res = await page.evaluate(async (k) => {
      const bs = document.querySelectorAll('.drawer .body button'); const b = bs[k]; if (!b || b.disabled) return { skip: true };
      const label = b.textContent.trim().slice(0, 40);
      if (/delete all|clear all|reset everything/i.test(label)) return { skip: true, label };
      let mut = 0; const mo = new MutationObserver((r) => { mut += r.length; }); mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
      const ev0 = window.__zehnTest.sim.bus.log.length, dl0 = window.__lastDownload;
      b.click(); await new Promise((r) => setTimeout(r, 60)); mo.disconnect();
      return { label, live: mut > 0 || window.__zehnTest.sim.bus.log.length > ev0 || window.__lastDownload !== dl0 };
    }, i);
    if (res.skip) continue;
    pressed++; if (!res.live) dead.push(res.label);
    await settle();
    const still = await page.evaluate((x) => !document.querySelector('.drawer').hidden && window.__zehnTest.sim.services.ui.panels.current === x, id);
    if (!still) await page.evaluate((x) => window.__zehnTest.openPanel(x), id);
  }
  panelRes[id] = { tags, buttons: n, pressed, dead };
  if (['stats', 'emotion', 'bio', 'replication', 'sdt'].includes(id)) await shot('panel_' + id);
}
await page.evaluate(() => window.__zehnTest.closePanel());
section('panels', panelRes);
log('panels ok', panelIds.length);

// ---- all paradigms headless with bot participant + CSV schema validation
const pids = await page.evaluate(() => window.__zehnTest.paradigms());
const parRes = {};
for (const id of pids) {
  await settle();
  const r = await page.evaluate(async (x) => { try { const out = await window.__zehnTest.run(x, { bot: true, quick: true }); return { rows: out ? out.rows : null, lines: out && out.summary ? out.summary.lines : null }; } catch (e) { return { error: String(e && e.stack || e) }; } }, id);
  await settle();
  if (r.error || !r.rows) { parRes[id] = { ok: false, error: r.error || 'no rows' }; continue; }
  const back = T.parseCSV(T.toCSV(r.rows));
  const v = T.validateRows(back);
  parRes[id] = { ok: v.ok, n: r.rows.length, errors: v.errors.slice(0, 5), summary: (r.lines || []).slice(0, 2) };
}
section('paradigms', parRes);
log('paradigms', Object.values(parRes).filter((x) => x.ok).length, '/', pids.length);

// ---- dilemmas + IRB
const dil = await page.evaluate(async () => {
  const d = window.__zehnTest.sim.services.director; if (!d) return { error: 'no director' };
  const out = {};
  const r1 = await d.resolveAllDilemmas(); const r2 = await d.judgeAllIRB();
  out.dilemmas = Array.isArray(r1) ? r1.length : r1; out.irb = Array.isArray(r2) ? r2.length : r2;
  out.resolvedEvents = window.__zehnTest.sim.bus.log.filter((e) => e.event === 'dilemma:resolved').length;
  out.irbEvents = window.__zehnTest.sim.bus.log.filter((e) => e.event === 'irb:decision').length;
  return out;
}).catch((e) => ({ error: String(e) }));
await settle();
section('dilemmas_irb', dil);
log('dilemmas', JSON.stringify(dil));

// ---- clinic: one full session
const clin = await page.evaluate(async () => {
  const c = window.__zehnTest.sim.services.clinic; if (!c) return { error: 'no clinic' };
  let ended = false; const off = window.__zehnTest.sim.bus.on('client:session:end', () => { ended = true; });
  const p = c.startSession(window.__zehnTest.sim.data.clients[0].id);
  for (let i = 0; i < 60 && !ended; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const opt = document.querySelector('[data-clinic-option]') || Array.from(document.querySelectorAll('.modal-back:last-child button')).find((b) => /^1[.)]/.test(b.textContent.trim()));
    if (opt) opt.click(); else { const b = document.querySelector('.modal-back:last-child .actions button'); if (b && !ended) b.click(); }
  }
  off(); return { ended };
}).catch((e) => ({ error: String(e) }));
await shot('clinic_session');
await settle(20);
section('clinic', clin);
log('clinic', JSON.stringify(clin));

// ---- crisis detector path (30 phrases)
const phrases = (() => { try { const s = fs.readFileSync(path.join(root, 'test', 'crisis.test.js'), 'utf8'); const m = s.match(/CRISIS\s*=\s*\[([\s\S]*?)\];/); return m ? eval('[' + m[1] + ']') : []; } catch (e) { return []; } })();
const crisisRes = { n: phrases.length, shown: 0, misses: [] };
for (const ph of phrases.slice(0, 30)) {
  await settle();
  const shown = await page.evaluate(async (t) => { await window.__zehnTest.crisis(t); await new Promise((r) => setTimeout(r, 80)); return !!document.querySelector('.modal.crisis'); }, ph);
  if (shown) crisisRes.shown++; else crisisRes.misses.push(ph);
}
await settle();
section('crisis', crisisRes);
log('crisis', crisisRes.shown, '/', crisisRes.n);

// ---- save / load / export
const persist = await page.evaluate(() => {
  const z = window.__zehnTest; z.sim.state.xp += 7; const xp = z.sim.state.xp;
  const ok = z.save(); z.sim.state.xp = 0; z.load();
  const csv = require ? null : null;
  return { saved: ok, restored: z.sim.state.xp === xp, datasets: Object.keys(z.sim.datasets).length };
});
section('persistence', persist);

// ---- FPS per tier + timing (G7, G13)
const tiers = ['low', 'medium', 'high', 'ultra'];
const perf = {};
for (const tier of tiers) {
  await page.evaluate((t) => { window.__zehnTest.setQuality(t); window.__zehnTest.teleport('courtyard'); }, tier);
  await page.waitForTimeout(2500);
  const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(f); }));
  const stats = await page.evaluate(() => window.__zehnTest.engineStats());
  await shot('tier_' + tier);
  const timing = TIMING_N ? await page.evaluate(async (n) => { const r = await window.__zehnTest.timing(n, 'stroop'); delete r.rows; return r; }, QUICK ? 120 : TIMING_N) : null;
  await settle();
  perf[tier] = { rafFps: fps, engine: stats, timing };
  log('tier', tier, 'fps', fps.toFixed(1), timing ? `onset median ${timing.medianFrames.toFixed(2)}f p95 ${timing.p95Frames.toFixed(2)}f` : '');
}
await page.evaluate(() => window.__zehnTest.setQuality('low'));
section('performance', perf);

// ---- soak (G6)
if (SOAK > 0) {
  log('soak', SOAK, 's');
  const heap = async () => page.evaluate(() => (performance.memory ? performance.memory.usedJSHeapSize : 0));
  const cdp = await context.newCDPSession(page);
  const gc = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); };
  await gc(); const h0 = await heap(); const samples = [];
  const end = Date.now() + SOAK * 1000; let i = 0;
  while (Date.now() < end) {
    const z = zones[i % zones.length]; i++;
    await page.evaluate((x) => { window.__zehnTest.teleport(x); window.__zehnTest.setMode(['walk', 'director'][Math.floor(Math.random() * 2)]); }, z);
    await page.evaluate(async () => { const s = window.__zehnTest.sim.services.social; if (s && s.run) s.run('bystander', { n: 5 }); });
    await page.waitForTimeout(4000);
    if (i % 10 === 0) { await gc(); samples.push(await heap()); }
  }
  await gc(); const h1 = await heap();
  section('soak', { seconds: SOAK, heapStart: h0, heapEnd: h1, growthPct: h0 ? (100 * (h1 - h0)) / h0 : null, samples });
  log('soak heap growth %', h0 ? ((100 * (h1 - h0)) / h0).toFixed(2) : 'n/a');
}

report.finished = new Date().toISOString();
report.summary = {
  consoleErrors: report.consoleErrors.length, pageErrors: report.pageErrors.length, blockedNetwork: report.network.length,
  panels: Object.keys(panelRes).length, deadButtons: Object.values(panelRes).reduce((a, p) => a + p.dead.length, 0),
  panelsWithAllTags: Object.values(panelRes).filter((p) => p.tags.length >= 4).length,
  paradigmsOk: Object.values(parRes).filter((x) => x.ok).length, paradigms: pids.length,
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 1));
log('SUMMARY', JSON.stringify(report.summary));
if (report.consoleErrors.length || report.pageErrors.length) log('errors:', [...report.pageErrors, ...report.consoleErrors].slice(0, 10).join('\n'));
await browser.close();
process.exitCode = report.summary.consoleErrors + report.summary.pageErrors === 0 && report.summary.paradigmsOk === report.summary.paradigms ? 0 : 1;
