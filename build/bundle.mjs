// ZEHN build — concatenates src/ modules into ONE offline HTML file.
// Each module is wrapped under a `/* ===== src/... ===== */` banner (benchmark convention),
// three.js r160 is inlined with its MIT header, CSS and JSON are inlined, and a tiny
// CommonJS-style loader resolves require() at runtime. Output: dist/ZEHN_Psychology_Lab_Simulator.html
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'src');
const OUT = path.join(root, 'dist', 'ZEHN_Psychology_Lab_Simulator.html');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out.sort();
}

const files = walk(SRC).filter((f) => /\.(js|json)$/.test(f) && !f.includes(`${path.sep}schemas${path.sep}`) && !/quiz_[ab]\.json$/.test(f));
const css = walk(path.join(SRC, 'styles')).filter((f) => f.endsWith('.css'));
const rel = (f) => path.relative(root, f).split(path.sep).join('/');
const safe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

let modules = '';
let count = 0;
for (const f of files) {
  const id = rel(f);
  let body = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.json')) {
    JSON.parse(body); // fail the build on invalid JSON
    body = 'module.exports = ' + body.trim() + ';';
  }
  modules += `/* ===== ${id} ===== */\n__def(${JSON.stringify(id)}, function (module, exports, require) {\n${safe(body)}\n});\n`;
  count++;
}

const three = fs.readFileSync(path.join(root, 'vendor', 'three.r160.raw.js'), 'utf8');
const loader = `
/* ===== ZEHN module loader ===== */
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
}
`;

let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
const cssText = css.map((f) => `/* ${rel(f)} */\n` + fs.readFileSync(f, 'utf8')).join('\n');
const buildInfo = { built: new Date().toISOString(), modules: count };
const js = `(function () {\n'use strict';\n${three}\n${loader}\n${modules}\nwindow.__ZEHN_BUILD__ = ${JSON.stringify(buildInfo)};\n__require('', 'src/main.js');\n})();`;
html = html.replace('/*__CSS__*/', () => cssText).replace('/*__JS__*/', () => js);
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);
const size = fs.statSync(OUT).size;
const lines = html.split('\n').length;
console.log(`built ${rel(OUT)} — ${(size / 1048576).toFixed(2)} MB, ${lines} lines, ${count} modules`);
if (size > 9 * 1048576) { console.error('FAIL: output exceeds 9 MB budget'); process.exit(1); }
