// Builds docs/TEST_REPORT.md from e2e/out/report.json, `node --test` output and the G3 count (A11).
// Usage: node tools/report.mjs   (run after `npm run e2e`; reruns unit tests and count itself)
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const R = JSON.parse(fs.readFileSync(path.join(root, 'e2e/out/report.json'), 'utf8'));
const unit = (() => { try { return execSync('node --test test/*.test.js 2>&1', { encoding: 'utf8', shell: '/bin/bash' }); } catch (e) { return e.stdout || String(e); } })();
const num = (k) => { const m = unit.match(new RegExp('^# ' + k + ' (\\d+)', 'm')); return m ? +m[1] : 0; };
const count = (() => { try { return execSync('node tools/count.mjs', { encoding: 'utf8' }); } catch (e) { return e.stdout || ''; } })();
const S = R.sections || {};
const pass = (b) => (b ? '✅ PASS' : '❌ FAIL');

let md = `# ZEHN — Test Report\n\nGenerated ${new Date().toISOString()} by \`node tools/report.mjs\` from \`e2e/out/report.json\` (e2e started ${R.started}).\nEnvironment: headless Chromium (Playwright) with **SwiftShader software WebGL** (no GPU), file:// URL, all network requests blocked except file:/data:/blob:.\n\n`;

md += `## Unit tests (\`npm test\`)\n\n${num('pass')} passed, ${num('fail')} failed (${num('tests')} tests). Statistics are compared with SciPy goldens (\`tools/golden.py\`, \`test/golden/*.json\`) at ≤ 1e-8 tolerance (gate G4 requires 1e-4).\n\n`;
md += `## G3 — Minimums (\`npm run count\`)\n\n${count.trim()}\n\n`;

const sum = R.summary || {};
md += `## End-to-end summary\n\n| Check | Result |\n|---|---|\n`;
md += `| Boot | ${S.boot ? S.boot.ms + ' ms; services: ' + Object.entries(S.boot.services || {}).map(([k, v]) => k + (v ? '✓' : '✗')).join(' ') : 'n/a'} |\n`;
md += `| Console errors / page errors | ${sum.consoleErrors} / ${sum.pageErrors} |\n`;
md += `| Blocked network requests (offline, G8) | ${sum.blockedNetwork} |\n`;
md += `| Page crash | ${R.crash ? 'YES at ' + R.crash.at : 'none'} |\n`;
md += `| WASD walk + mouse look | ${S.movement ? (S.movement.ok ? 'OK' : 'FAIL') + ` (walked ${S.movement.walkedMetres.toFixed(2)} m, look Δ ${S.movement.lookChangedRad.toFixed(2)} rad)` : 'n/a'} |\n`;
md += `| Modes visited | ${S.modes_zones ? Object.keys(S.modes_zones.modes).length : 0} / 7 |\n`;
md += `| Zones visited | ${S.modes_zones ? Object.entries(S.modes_zones.zones).filter(([k, v]) => k === v).length : 0} / 10 |\n`;
md += `| Panels opened (with APA+domain+HEC+week tags) | ${sum.panels} (${sum.panelsWithAllTags} with 4 tags) |\n`;
md += `| Buttons pressed / dead buttons | ${Object.values(S.panels || {}).reduce((a, p) => a + p.pressed, 0)} / ${sum.deadButtons} |\n`;
md += `| Paradigms run by bot + CSV schema valid | ${sum.paradigmsOk} / ${sum.paradigms} |\n`;
md += `| Dilemmas / IRB resolved | ${S.dilemmas_irb ? `${S.dilemmas_irb.dilemmas} / ${S.dilemmas_irb.irb} (events ${S.dilemmas_irb.resolvedEvents} / ${S.dilemmas_irb.irbEvents})` : 'n/a'} |\n`;
md += `| Clinic full session | ${S.clinic ? (S.clinic.ended ? 'completed' : JSON.stringify(S.clinic)) : 'n/a'} |\n`;
md += `| Crisis phrases → crisis card (G14) | ${S.crisis ? `${S.crisis.shown} / ${Math.min(30, S.crisis.n)}` : 'n/a'} |\n`;
md += `| Save/load round-trip (G9) | ${S.persistence ? (S.persistence.saved && S.persistence.restored ? 'OK' : JSON.stringify(S.persistence)) : 'n/a'} |\n`;
md += `| Downloads triggered (CSV/JSON/PNG/MD) | ${R.downloads || 0} |\n\n`;

if (S.panels) {
  const dead = Object.entries(S.panels).filter(([, p]) => p.dead.length);
  md += `### Dead-button audit\n\n${dead.length ? dead.map(([k, p]) => `- ${k}: ${p.dead.join('; ')}`).join('\n') : 'No dead buttons detected (every click changed the DOM, emitted a bus event or produced a download).'}\n\n`;
}
if (S.paradigms) {
  md += `### Paradigms (bot participant, quick mode)\n\n| Paradigm | Rows | Schema | First result line |\n|---|---|---|---|\n`;
  for (const [k, v] of Object.entries(S.paradigms)) md += `| ${k} | ${v.n || 0} | ${v.ok ? 'valid' : 'INVALID ' + (v.error || v.errors.join('; ')).slice(0, 80)} | ${(v.summary || [''])[0].replace(/\|/g, '/').slice(0, 90)} |\n`;
  md += '\n';
}
if (S.performance) {
  md += `## G7 / G13 — Performance and timing per tier\n\nMeasured in headless Chromium on **SwiftShader (CPU software rasteriser)**, 1280×720. These FPS figures are a lower bound and are NOT representative of a discrete or integrated GPU; G7 (≥60 fps High on a discrete GPU, ≥30 fps Medium integrated) cannot be verified in this environment and must be measured on real hardware.\n\n| Tier | rAF fps | engine fps | draw calls | triangles | onset median (frames) | onset p95 (frames) | RT resolution (ms) | G13 |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const [t, v] of Object.entries(S.performance)) {
    const tm = v.timing || {}; const e = v.engine || {};
    md += `| ${t} | ${(v.rafFps || 0).toFixed(1)} | ${e.fps != null ? e.fps.toFixed(1) : '—'} | ${e.drawCalls ?? '—'} | ${e.triangles ?? '—'} | ${tm.medianFrames != null ? tm.medianFrames.toFixed(2) : '—'} | ${tm.p95Frames != null ? tm.p95Frames.toFixed(2) : '—'} | ${tm.rtResolutionMs != null ? (+tm.rtResolutionMs).toFixed(3) : '—'} | ${tm.n ? pass(tm.pass && tm.rtResolutionMs <= 1) + ` (n=${tm.n})` : '—'} |\n`;
  }
  const anyT = Object.values(S.performance).find((v) => v.timing && v.timing.histogram);
  if (anyT) {
    const h = anyT.timing.histogram;
    md += `\n### Onset-error histogram (|onset_actual − onset_req| in frames, tier ${Object.keys(S.performance).find((k) => S.performance[k] === anyT)})\n\n\`\`\`\n`;
    const max = Math.max(...h.counts, 1);
    h.counts.forEach((c, i) => { md += `${h.edges[i].toFixed(2)}–${h.edges[i + 1].toFixed(2)} f | ${'█'.repeat(Math.round((40 * c) / max))} ${c}\n`; });
    md += '```\n\nThe UI states on every consent and results screen that browser RTs include a fixed lag of tens of milliseconds (Bridges et al., 2020, *PeerJ* 8:e9414).\n\n';
  }
}
if (S.soak) md += `## G6 — Soak\n\n${S.soak.seconds} s cycling zones/modes and social-model runs; JS heap ${(S.soak.heapStart / 1e6).toFixed(1)} → ${(S.soak.heapEnd / 1e6).toFixed(1)} MB after forced GC (growth ${S.soak.growthPct != null ? S.soak.growthPct.toFixed(2) : 'n/a'}%; gate < 10%: ${pass(S.soak.growthPct != null && S.soak.growthPct < 10)}).\n\n`;
const shots = fs.existsSync(path.join(root, 'e2e/out')) ? fs.readdirSync(path.join(root, 'e2e/out')).filter((f) => f.endsWith('.png')).sort() : [];
md += `## Screenshots\n\n${shots.length} screenshots at deviceScaleFactor 1 in \`docs/screenshots/\` (copied from e2e/out): ${shots.join(', ')}.\n\n`;
if (shots.length) { fs.mkdirSync(path.join(root, 'docs/screenshots'), { recursive: true }); for (const s of shots) fs.copyFileSync(path.join(root, 'e2e/out', s), path.join(root, 'docs/screenshots', s)); md += shots.filter((s) => /^(00|mode_|time_|zone_wundt|zone_explab|zone_neuro|zone_mohalla|panel_emotion|clinic)/.test(s)).map((s) => `![${s}](screenshots/${s})`).join('\n') + '\n\n'; }
if ((R.consoleErrors || []).length || (R.pageErrors || []).length) md += `## Errors captured\n\n\`\`\`\n${[...(R.pageErrors || []), ...(R.consoleErrors || [])].slice(0, 30).join('\n')}\n\`\`\`\n`;
fs.writeFileSync(path.join(root, 'docs/TEST_REPORT.md'), md);
console.log('docs/TEST_REPORT.md written');
