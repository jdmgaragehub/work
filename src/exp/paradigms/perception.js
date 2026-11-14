'use strict';
/**
 * Perception, psychophysics & performance paradigms (A8, weeks 6 & 10):
 *  muller_lyer · ponzo · ames · jnd_staircase · magnitude_est · sdt_yesno · hick_hyman · fitts · mental_rotation
 * Contract: docs/EXPERIMENT_API.md. Pure apart from drawing on a passed 2D context (logical px).
 * All bot effects below are "Simulated effect size" values chosen for teaching, not study estimates.
 * Trial details needed by analyse() are encoded in `stimulus` ("key=value;key=value") so a CSV re-analyses.
 */
const S = require('../../psych/stats.js');
const SDT = require('../../psych/sdt.js');
const PP = require('../../psych/psychophysics.js');
const { apa } = require('../../core/format.js');
const { drawRT, drawCorrect } = require('../../psych/participants.js');

// ---------------------------------------------------------------- helpers
const text = (ctx, s, x, y, size = 20, color = '#111', weight = 600, align = 'center') => {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
};
const line = (ctx, x1, y1, x2, y2, color = '#111', w = 3) => { ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
const poly = (ctx, pts, fill, stroke, lw = 1) => {
  if (!pts.length) return;
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(); }
};
const circle = (ctx, x, y, r, fill, stroke, lw = 2) => { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
const rrect = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); };
const cycle = (items, n, rng) => { const out = []; for (let i = 0; i < n; i++) out.push(items[i % items.length]); return rng.shuffle(out); };
const combos = (a, b) => a.flatMap((x) => b.map((y) => [x, y]));
const enc = (o) => Object.keys(o).map((k) => `${k}=${o[k]}`).join(';');
const dec = (s) => { const o = {}; String(s || '').split(';').forEach((kv) => { const i = kv.indexOf('='); if (i > 0) { const v = kv.slice(i + 1); o[kv.slice(0, i)] = v !== '' && Number.isFinite(+v) ? +v : v; } }); return o; };
const fmt = (v, dp = 0) => (Number.isFinite(v) ? v.toFixed(dp) : '—');
const num = (v) => v !== '' && v != null && Number.isFinite(+v);
const isBot = (rows) => rows.some((r) => /^BOT/.test(String(r.pid)));
const botNote = (rows, what = 'effects') => (isBot(rows) ? [`Bot participant: these ${what} come from the model's Simulated effect size, not from real observers.`] : []);
const meanOr = (xs) => (xs.length ? S.mean(xs) : NaN);
const distinct = (xs) => new Set(xs.map((x) => +(+x).toFixed(6))).size;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const noData = (ch, label) => ch.bar([{ name: 'no data', value: 0 }], { label });
const TAGS6 = { week: 6, zone: 'explab', hec: 'S2 Experimental Psychology' };
const ILLUS = Object.assign({ panel: 'illusions', apa: '1.1', domain: 'Cog' }, TAGS6);
const SENS = Object.assign({ panel: 'sensation', apa: '2.1', domain: 'Cog' }, TAGS6);

/** Logistic PSE from proportions: regress logit(p′) on x, p′ = (k+0.5)/(n+1). Returns x at p = .5. */
function psePoint(xs, ks, ns) {
  const X = [], Y = [];
  xs.forEach((x, i) => { if (ns[i] > 0) { const p = (ks[i] + 0.5) / (ns[i] + 1); X.push(x); Y.push(Math.log(p / (1 - p))); } });
  if (distinct(X) < 2) return { pse: NaN, slope: NaN };
  const r = S.regression(X, Y);
  return { pse: r.b > 0 ? -r.a / r.b : NaN, slope: r.b };
}

// ---------------------------------------------------------------- 1. Müller-Lyer
function mlFigure(ctx, cx, y, len, kind, color) {
  const x1 = cx - len / 2, x2 = cx + len / 2, fx = 24, fy = 18;
  line(ctx, x1, y, x2, y, color, 4);
  for (const [x, o] of [[x1, -1], [x2, 1]]) {
    if (kind === 'fins-in') { line(ctx, x, y, x - o * fx, y - fy, color, 4); line(ctx, x, y, x - o * fx, y + fy, color, 4); }
    else if (kind === 'fins-out') { line(ctx, x, y, x + o * fx, y - fy, color, 4); line(ctx, x, y, x + o * fx, y + fy, color, 4); }
    else line(ctx, x, y - 10, x, y + 10, color, 4);
  }
}
const mullerLyer = Object.assign({
  id: 'muller_lyer', title: 'Müller-Lyer illusion (method of adjustment)',
  purpose: 'To measure how much arrow-like fins change the perceived length of a line, using the method of adjustment.',
  instructions: '<p>The <b>upper</b> figure is a line with fins. Adjust the <b>lower</b> plain line until it looks exactly as long as the upper shaft (ignore the fins).</p><p>Use the slider or <kbd>←</kbd>/<kbd>→</kbd> (hold <kbd>Shift</kbd> for big steps); press <kbd>Enter</kbd> to confirm.</p>',
  estimateMin: 4, practice: 1, fix: 400, iti: 400, timeout: null, background: '#eef1f5',
  response: { type: 'slider', slider: { min: 60, max: 380, step: 1, start: 200, label: 'Lower line length' } },
  factRefs: [],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 6 : 18);
    const conds = ['fins-in', 'fins-out', 'control'];
    return cycle(conds, n, rng).map((condition) => {
      const std = rng.pick([160, 200, 240]);
      const start = Math.round(std * rng.pick([0.65, 0.75, 1.25, 1.35]));
      return { condition, std, slider: { min: 60, max: 380, step: 1, start, label: 'Lower line length' }, stimulus: enc({ cond: condition, std, start }) };
    });
  },
  draw(ctx, t, W, H, el, state) {
    const s = Math.min(1, (W - 80) / 460);
    const v = state && Number.isFinite(state.sliderValue) ? state.sliderValue : t.slider.start;
    text(ctx, 'Match the lower line to the upper shaft', W / 2, H * 0.16, 20, '#334155', 600);
    mlFigure(ctx, W / 2, H * 0.38, t.std * s, t.condition, '#1e293b');
    mlFigure(ctx, W / 2, H * 0.62, v * s, 'plain', '#0072B2');
    text(ctx, '← shorter     longer →', W / 2, H * 0.78, 15, '#64748b', 500);
  },
  score() { return null; },
  simulate(p, t, rng) {
    const bias = t.condition === 'fins-out' ? 0.15 : t.condition === 'fins-in' ? -0.11 : 0; // Simulated effect size
    const noise = rng.normal(0, 0.035 * (1 - 0.15 * clamp(p.ability, -2, 2)));
    return { response: Math.round(clamp(t.std * (1 + bias + noise), 60, 380)), rt: drawRT(p, rng, { mu: 4200 }).rt };
  },
  analyse(rows) {
    const err = {};
    for (const r of rows) { if (!num(r.response)) continue; const d = dec(r.stimulus); (err[r.condition] = err[r.condition] || []).push(100 * (+r.response - d.std) / d.std); }
    const m = (c) => meanOr(err[c] || []);
    const fi = m('fins-in'), fo = m('fins-out'), co = m('control');
    const lines = [
      `PSE error (matched − true length, % of true): fins-in ${fmt(fi, 1)}%, fins-out ${fmt(fo, 1)}%, control ${fmt(co, 1)}%`,
      `Illusion magnitude (fins-out − fins-in): ${fmt(fo - fi, 1)} percentage points`,
      'Positive error = the shaft looked longer than it is. The control line shows your baseline matching accuracy.',
    ].concat(botNote(rows));
    return { lines, stats: { finsIn: fi, finsOut: fo, control: co, magnitude: fo - fi },
      chart: (ch) => ch.bar([{ name: 'fins-in', value: fi || 0 }, { name: 'control', value: co || 0 }, { name: 'fins-out', value: fo || 0 }], { label: 'Müller-Lyer: PSE error by condition', yl: '% error' }) };
  },
}, ILLUS);

// ---------------------------------------------------------------- 2. Ponzo
const PONZO_D = [-0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15];
const ponzo = Object.assign({
  id: 'ponzo', title: 'Ponzo rails',
  purpose: 'To measure how converging "rails" bias length judgements of two identical-looking bars (point of subjective equality).',
  instructions: '<p>Two horizontal bars appear. Which one is <b>longer</b>? <kbd>F</kbd> = upper bar, <kbd>J</kbd> = lower bar. Sometimes rails are drawn behind the bars; judge the bars only.</p>',
  estimateMin: 4, practice: 2, fix: 400, iti: 400, timeout: 6000, background: '#f4efe6',
  response: { type: 'key', keys: ['f', 'j'], labels: { f: 'upper longer', j: 'lower longer' } },
  factRefs: [],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 14 : 56);
    return cycle(combos(['rails', 'no-rails'], PONZO_D), n, rng).map(([condition, delta]) => {
      const std = Math.round(rng.uniform(130, 170));
      return { condition, delta, std, correctResponse: delta > 0 ? 'j' : delta < 0 ? 'f' : null, stimulus: enc({ delta, std }) };
    });
  },
  draw(ctx, t, W, H) {
    const s = Math.min(1, (H - 60) / 520, (W - 40) / 520);
    const cx = W / 2, top = H / 2 - 230 * s, bot = H / 2 + 230 * s;
    if (t.condition === 'rails') {
      const ax = 34 * s, bx = 210 * s; // half-gap at top / bottom
      for (let i = 0; i < 12; i++) { // sleepers, compressed with distance
        const f = Math.pow(i / 11, 1.6), y = top + (bot - top) * f, hw = ax + (bx - ax) * f;
        line(ctx, cx - hw * 1.25, y, cx + hw * 1.25, y, '#b7a58a', 3 + 5 * f);
      }
      line(ctx, cx - ax, top, cx - bx, bot, '#5b4a3a', 6 * s + 1);
      line(ctx, cx + ax, top, cx + bx, bot, '#5b4a3a', 6 * s + 1);
    }
    const uy = H / 2 - 120 * s, ly = H / 2 + 150 * s, up = t.std * s, lo = t.std * (1 + t.delta) * s;
    ctx.fillStyle = '#D55E00'; ctx.fillRect(cx - up / 2, uy - 6, up, 12);
    ctx.fillStyle = '#D55E00'; ctx.fillRect(cx - lo / 2, ly - 6, lo, 12);
    text(ctx, 'F upper  ·  J lower', cx, H - 22, 15, '#57534e', 500);
  },
  score(t, r) { return t.correctResponse == null ? null : r === t.correctResponse; },
  simulate(p, t, rng) {
    const mag = t.condition === 'rails' ? 0.09 : 0; // Simulated effect size: upper bar looks 9% longer
    const sd = 0.04 * (1 - 0.15 * clamp(p.ability, -2, 2));
    const upper = (1 + mag) * (1 + rng.normal(0, sd)), lower = (1 + t.delta) * (1 + rng.normal(0, sd));
    const resp = rng.random() < p.lapse ? rng.pick(['f', 'j']) : lower > upper ? 'j' : 'f';
    return { response: resp, rt: drawRT(p, rng, { mu: 700, effect: -800 * Math.abs(t.delta) }).rt };
  },
  analyse(rows) {
    const out = {}, series = [];
    for (const cond of ['rails', 'no-rails']) {
      const ks = [], ns = [], pts = [];
      for (const d of PONZO_D) {
        const rr = rows.filter((r) => r.condition === cond && Math.abs(dec(r.stimulus).delta - d) < 1e-9 && (r.response === 'f' || r.response === 'j'));
        const k = rr.filter((r) => r.response === 'j').length;
        ks.push(k); ns.push(rr.length);
        if (rr.length) pts.push({ x: d * 100, y: k / rr.length });
      }
      out[cond] = psePoint(PONZO_D.map((d) => d * 100), ks, ns).pse;
      series.push({ name: cond, points: pts });
    }
    const shift = out.rails - out['no-rails'];
    const lines = [
      `PSE (lower-bar % difference judged equal): rails ${fmt(out.rails, 1)}%, no rails ${fmt(out['no-rails'], 1)}%`,
      `PSE shift caused by the rails: ${fmt(shift, 1)} percentage points (positive = upper bar looked longer)`,
      'PSE from a logistic fit to P("lower longer") across the seven true differences.',
    ].concat(botNote(rows));
    return { lines, stats: { pseRails: out.rails, pseNone: out['no-rails'], shift },
      chart: (ch) => ch.line(series, { label: 'Ponzo psychometric functions', xl: 'true difference, lower − upper (%)', yl: 'P(lower judged longer)', yr: [0, 1] }) };
  },
}, ILLUS);

// ---------------------------------------------------------------- 3. Ames room
// Normal room (peephole eye at origin, x right, y up, z away). The Ames room is the projective
// distortion P′ = P / (0.75 + x/12): every vertex slides along its own line of sight, so the
// peephole image is identical to a rectangular room, but the left back corner is twice as far.
const AR = { x0: -3, x1: 3, yF: -1.6, yC: 1.4, zN: 2.5, zB: 8 };
const amesMap = (p) => { const s = 1 / (0.75 + p[0] / 12); return [p[0] * s, p[1] * s, p[2] * s]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function lookAt(eye, target) {
  const f = norm(sub(target, eye)), r = norm(cross([0, 1, 0], f)), u = cross(f, r);
  return (p) => { const d = sub(p, eye), z = dot(d, f); return { x: dot(d, r) / z, y: -dot(d, u) / z, z }; };
}
function amesSurfaces() {
  const { x0, x1, yF, yC, zN, zB } = AR, tiles = [], N = 8;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const xa = x0 + (x1 - x0) * i / N, xb = x0 + (x1 - x0) * (i + 1) / N, za = zN + (zB - zN) * j / N, zb = zN + (zB - zN) * (j + 1) / N;
    tiles.push({ pts: [[xa, yF, za], [xb, yF, za], [xb, yF, zb], [xa, yF, zb]].map(amesMap), fill: (i + j) % 2 ? '#2f3a4a' : '#e8e2d4' });
  }
  const M = (arr) => arr.map(amesMap);
  return {
    tiles,
    back: M([[x0, yF, zB], [x1, yF, zB], [x1, yC, zB], [x0, yC, zB]]),
    left: M([[x0, yF, zN], [x0, yF, zB], [x0, yC, zB], [x0, yC, zN]]),
    right: M([[x1, yF, zN], [x1, yF, zB], [x1, yC, zB], [x1, yC, zN]]),
    ceil: M([[x0, yC, zN], [x1, yC, zN], [x1, yC, zB], [x0, yC, zB]]),
    windows: [[-2.2, -1.2], [1.2, 2.2]].map(([a, b]) => M([[a, -0.2, zB], [b, -0.2, zB], [b, 0.9, zB], [a, 0.9, zB]])),
    people: [[-2.4, yF, 7.4], [2.4, yF, 7.4]].map(amesMap),
  };
}
function drawPerson(ctx, x, yFoot, h, shirt) {
  const hip = yFoot - 0.47 * h, sh = yFoot - 0.8 * h, w = 0.26 * h;
  line(ctx, x - 0.06 * h, hip, x - 0.07 * h, yFoot, '#26303f', 0.08 * h);
  line(ctx, x + 0.06 * h, hip, x + 0.07 * h, yFoot, '#26303f', 0.08 * h);
  line(ctx, x - w / 2, sh + 0.03 * h, x - w / 2 - 0.04 * h, hip + 0.02 * h, shirt, 0.07 * h);
  line(ctx, x + w / 2, sh + 0.03 * h, x + w / 2 + 0.04 * h, hip + 0.02 * h, shirt, 0.07 * h);
  rrect(ctx, x - w / 2, sh, w, hip - sh + 0.04 * h, 0.06 * h); ctx.fillStyle = shirt; ctx.fill();
  circle(ctx, x, yFoot - 0.9 * h, 0.085 * h, '#b97a45');
  ctx.beginPath(); ctx.arc(x, yFoot - 0.91 * h, 0.088 * h, Math.PI, 0); ctx.fillStyle = '#2a1c14'; ctx.fill();
}
const AMES_SHIRTS = [['#0072B2', '#D55E00'], ['#009E73', '#CC79A7'], ['#E69F00', '#56B4E9']];
const ames = Object.assign({
  id: 'ames', title: 'Ames room size judgement',
  purpose: 'To experience how assuming a room is rectangular makes two similar people look very different in size, and how the effect shrinks once the true shape is revealed.',
  instructions: '<p>Two people stand in the back corners of a room. Judge <b>how many times taller the RIGHT person is than the LEFT person</b> (1.00 = same height).</p><p>First you look through the <b>peephole</b>; later the room is <b>revealed</b> from the side. Slider or <kbd>←</kbd>/<kbd>→</kbd>, <kbd>Enter</kbd> to confirm.</p>',
  estimateMin: 3, practice: 0, fix: 300, iti: 400, timeout: null, background: '#1d2430',
  response: { type: 'slider', slider: { min: 0.5, max: 3, step: 0.05, start: 1, label: 'Right ÷ left height' } },
  factRefs: [],
  buildTrials(rng, opts) {
    const n = Math.max(2, opts.trials || (opts.quick ? 8 : 16));
    const half = Math.ceil(n / 2), out = [];
    for (const [view, k] of [['peephole', half], ['revealed', n - half]]) {
      for (const t of cycle([0.9, 1, 1.1], k, rng)) {
        const shirts = rng.pick(AMES_SHIRTS);
        out.push({ condition: view, ratio: t, shirts, stimulus: enc({ view, ratio: t }) });
      }
    }
    return out; // peephole block first, then the reveal
  },
  draw(ctx, t, W, H, el, state) {
    const g = amesSurfaces(), vw = Math.min(W - 40, 660), vh = Math.min(H - 150, 420), vx = (W - vw) / 2, vy = 56;
    const v = state && Number.isFinite(state.sliderValue) ? state.sliderValue : 1;
    let P;
    if (t.condition === 'peephole') { const f = vw * 0.95; P = (p) => ({ x: W / 2 + f * p[0] / p[2], y: vy + vh * 0.5 - f * (p[1] + 0.1) / p[2] }); }
    else {
      const cam = lookAt([6, 4.5, -7], [-1, -1.2, 9]), all = [].concat(g.back, g.left, g.right, g.tiles[0].pts, g.tiles[g.tiles.length - 1].pts, [[0, 0, 0]]).map(cam);
      const xs = all.map((q) => q.x), ys = all.map((q) => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const sc = Math.min((vw - 40) / (x1 - x0), (vh - 40) / (y1 - y0));
      P = (p) => { const q = cam(p); return { x: vx + vw / 2 + (q.x - (x0 + x1) / 2) * sc, y: vy + vh / 2 + (q.y - (y0 + y1) / 2) * sc }; };
    }
    const pp = (arr) => arr.map(P);
    ctx.save(); rrect(ctx, vx, vy, vw, vh, t.condition === 'peephole' ? vh * 0.5 : 18); ctx.fillStyle = '#0f141c'; ctx.fill(); ctx.clip();
    if (t.condition === 'peephole') { poly(ctx, pp(g.ceil), '#d9d4c7'); poly(ctx, pp(g.left), '#b9a98c'); poly(ctx, pp(g.right), '#b9a98c'); }
    g.tiles.forEach((tl) => poly(ctx, pp(tl.pts), tl.fill));
    poly(ctx, pp(g.back), '#cdbf9f', '#6b5d45', 2);
    g.windows.forEach((w) => poly(ctx, pp(w), '#9fc7e8', '#f8fafc', 3));
    if (t.condition === 'revealed') poly(ctx, pp(g.left), 'rgba(185,169,140,0.92)', '#6b5d45', 2);
    // people (identical bodies; right one scaled by the true ratio)
    const hs = [1.7, 1.7 * t.ratio], scr = g.people.map((f, i) => ({ foot: P(f), head: P([f[0], f[1] + hs[i], f[2]]) }));
    if (t.condition === 'revealed') {
      const eye = P([0, 0, 0]);
      ctx.setLineDash([6, 6]); scr.forEach((s) => line(ctx, eye.x, eye.y, s.head.x, s.head.y, '#F0E442', 1.5)); ctx.setLineDash([]);
      circle(ctx, eye.x, eye.y, 7, '#F0E442'); text(ctx, 'peephole', eye.x, eye.y + 18, 13, '#F0E442', 600);
    }
    scr.forEach((s, i) => drawPerson(ctx, s.foot.x, s.foot.y, Math.hypot(s.head.x - s.foot.x, s.head.y - s.foot.y), t.shirts[i]));
    if (t.condition === 'revealed') poly(ctx, pp(g.right), 'rgba(185,169,140,0.25)', '#e2d6bd', 2);
    ctx.restore();
    text(ctx, t.condition === 'peephole' ? 'View through the peephole' : 'The room revealed: oblique side view', W / 2, 28, 19, '#e2e8f0', 700);
    text(ctx, `Right ÷ left height: ${v.toFixed(2)}×`, W / 2, vy + vh + 30, 22, '#F0E442', 700);
  },
  score() { return null; },
  simulate(p, t, rng) {
    const m = t.condition === 'peephole' ? 1.75 : 1.08; // Simulated effect size (multiplicative over-estimate)
    const v = t.ratio * m * Math.exp(rng.normal(0, 0.1));
    return { response: Math.round(clamp(v, 0.5, 3) * 20) / 20, rt: drawRT(p, rng, { mu: 3500 }).rt };
  },
  analyse(rows) {
    const g = {};
    for (const r of rows) { if (!num(r.response)) continue; const d = dec(r.stimulus); (g[r.condition] = g[r.condition] || []).push(+r.response / d.ratio); }
    const pe = meanOr(g.peephole || []), rv = meanOr(g.revealed || []);
    const lines = [
      `Mean rated ÷ true size ratio: peephole ${fmt(pe, 2)}×, revealed ${fmt(rv, 2)}×`,
      `Illusion magnitude (over-estimate of the right person): peephole ${fmt((pe - 1) * 100, 0)}%, revealed ${fmt((rv - 1) * 100, 0)}%`,
      'Through the peephole the room looks rectangular, so the farther (left) person is seen as small rather than distant.',
    ].concat(botNote(rows));
    return { lines, stats: { peephole: pe, revealed: rv },
      chart: (ch) => ch.bar([{ name: 'peephole', value: (pe - 1) * 100 || 0 }, { name: 'revealed', value: (rv - 1) * 100 || 0 }], { label: 'Ames room: illusion magnitude by view', yl: '% over-estimate' }) };
  },
}, ILLUS);

// ---------------------------------------------------------------- 4. JND staircase (Weber)
const JND_STD = [80, 160, 240];
const jndParams = (I) => ({ start: 0.2 * I, step: 0.04 * I, minStep: 0.01 * I, nDown: 2, floor: 0.5, ceiling: I, maxReversals: 10 });
const jnd = Object.assign({
  id: 'jnd_staircase', title: 'JND staircase (Weber)',
  purpose: 'To find your just-noticeable difference in line length at three standard lengths with an adaptive staircase, and test Weber\'s law.',
  instructions: '<p>Two lines appear. Which one is <b>longer</b>? <kbd>F</kbd> = left, <kbd>J</kbd> = right. The difference gets smaller as you get it right (2-down-1-up staircase), so many trials will feel like guesses — that is expected.</p>',
  estimateMin: 7, practice: 2, fix: 400, iti: 350, timeout: 4000, dur: 900, background: '#2b2f36',
  response: { type: 'key', keys: ['f', 'j'], labels: { f: 'left longer', j: 'right longer' } },
  factRefs: ['F-WEBER'],
  buildTrials(rng, opts) {
    const n = opts.practice ? 4 : opts.trials || (opts.quick ? 24 : 120);
    return cycle(JND_STD, n, rng).map((std) => ({ condition: 'std' + std, std, stimulus: enc({ std }) }));
  },
  init() { const stairs = {}; JND_STD.forEach((I) => { stairs['std' + I] = new PP.Staircase(jndParams(I)); }); return { stairs }; },
  prepare(t, state, rng) {
    const st = state.stairs && state.stairs[t.condition];
    t.delta = t.block === 'practice' || !st ? 0.3 * t.std : st.level;
    t.side = rng.chance(0.5) ? 'L' : 'R';
    t.jy = [rng.uniform(-40, 40), rng.uniform(-40, 40)];
    t.correctResponse = t.side === 'L' ? 'f' : 'j';
    t.stimulus = enc({ std: t.std, delta: +t.delta.toFixed(2), side: t.side });
  },
  update(state, t, res) { if (t.block !== 'practice' && state.stairs && state.stairs[t.condition]) state.stairs[t.condition].update(!!res.correct); },
  draw(ctx, t, W, H) {
    const s = Math.min(1, (W / 2 - 40) / 300), cmp = t.std + (t.delta || 0), jy = t.jy || [0, 0];
    const L = t.side === 'L' ? cmp : t.std, R = t.side === 'L' ? t.std : cmp;
    line(ctx, W * 0.27 - L * s / 2, H / 2 + jy[0], W * 0.27 + L * s / 2, H / 2 + jy[0], '#f5f5f4', 4);
    line(ctx, W * 0.73 - R * s / 2, H / 2 + jy[1], W * 0.73 + R * s / 2, H / 2 + jy[1], '#f5f5f4', 4);
  },
  drawMask(ctx, t, W, H) { text(ctx, 'F = left longer   ·   J = right longer', W / 2, H / 2, 20, '#cbd5e1', 600); },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    const k = 0.06 * Math.exp(-0.15 * clamp(p.ability, -2, 2)); // Simulated effect size (Weber fraction of the model observer)
    const cmp = t.std + (t.delta || 0);
    const a = t.std * (1 + rng.normal(0, k)), b = cmp * (1 + rng.normal(0, k));
    const pickCmp = rng.random() < p.lapse ? rng.chance(0.5) : b > a;
    const cmpKey = t.side === 'L' ? 'f' : 'j';
    return { response: pickCmp ? cmpKey : cmpKey === 'f' ? 'j' : 'f', rt: drawRT(p, rng, { mu: 620 }).rt };
  },
  analyse(rows) {
    // Replay the staircases from the rows (deterministic) so a re-loaded CSV gives the same thresholds.
    const pairs = [], series = [], perStd = [];
    for (const I of JND_STD) {
      const st = new PP.Staircase(jndParams(I)), rr = rows.filter((r) => r.condition === 'std' + I && r.correct !== '');
      const pts = [];
      rr.forEach((r, i) => { pts.push({ x: i + 1, y: dec(r.stimulus).delta }); st.update(String(r.correct) === '1'); });
      if (!rr.length) continue;
      const tail = pts.slice(Math.floor(pts.length / 2)).map((q) => q.y);
      const th = st.reversals.length >= 4 ? st.threshold() : meanOr(tail); // few reversals: mean level over the second half
      pairs.push({ I, jnd: th }); series.push({ name: `${I} px`, points: pts });
      perStd.push(`Standard ${I} px: JND ≈ ${fmt(th, 1)} px (ΔI/I = ${fmt(th / I, 3)}), ${st.reversals.length} reversals over ${rr.length} trials`);
    }
    const fit = pairs.length ? PP.fitWeber(pairs) : { k: NaN, kSlope: NaN };
    const lines = perStd.concat([
      `Weber fraction k (mean ΔI/I) = ${fmt(fit.k, 3)}; slope of JND on I through the origin = ${fmt(fit.kSlope, 3)}`,
      'Weber\'s law predicts a constant ΔI/I across the three standards. 2-down-1-up targets the 70.7%-correct point; threshold = mean of reversals after the first two (or of the last half of levels if there were fewer than four reversals).',
    ]).concat(botNote(rows, 'thresholds'));
    return { lines, stats: { k: fit.k, kSlope: fit.kSlope, pairs },
      chart: (ch) => (series.length ? ch.line(series, { label: 'Staircase tracks (difference per trial)', xl: 'trial at this standard', yl: 'Δ length (px)' }) : noData(ch, 'Staircase tracks')) };
  },
}, SENS);

// ---------------------------------------------------------------- 5. Magnitude estimation (Stevens)
const MAG_PHI = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const magnitude = Object.assign({
  id: 'magnitude_est', title: 'Magnitude estimation (Stevens)',
  purpose: 'To estimate the size of circles relative to a standard called 100 and fit a power function to your judgements.',
  instructions: '<p>The grey circle on the left is the <b>modulus</b>; its size is <b>100</b>. Give the blue circle a number that matches how big it looks relative to 100 (twice as big → 200, half → 50). Slider or arrows, <kbd>Enter</kbd> to confirm.</p>',
  estimateMin: 4, practice: 1, fix: 350, iti: 350, timeout: null, background: '#f1f5f9',
  response: { type: 'slider', slider: { min: 0, max: 300, step: 1, start: 100, label: 'Size (modulus = 100)' } },
  factRefs: ['F-STEVENS'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 12 : 32);
    return cycle(MAG_PHI, n, rng).map((phi) => ({ condition: 'area' + phi, phi, stimulus: enc({ area: phi }) }));
  },
  draw(ctx, t, W, H, el, state) {
    const s = Math.min(1, (W - 60) / 600, (H - 140) / 260), r0 = 46 * s;
    const v = state && Number.isFinite(state.sliderValue) ? state.sliderValue : 100;
    circle(ctx, W * 0.25, H * 0.46, r0, '#94a3b8', '#475569', 2);
    text(ctx, '100', W * 0.25, H * 0.46, 18, '#0f172a', 700);
    text(ctx, 'modulus', W * 0.25, H * 0.46 + r0 + 22, 15, '#475569', 500);
    circle(ctx, W * 0.64, H * 0.46, r0 * Math.sqrt(t.phi), '#0072B2', '#0b3a5c', 2);
    text(ctx, `Your estimate: ${Math.round(v)}`, W / 2, H * 0.88, 22, '#0f172a', 700);
  },
  score() { return null; },
  simulate(p, t, rng) {
    const a = 0.75 + rng.normal(0, 0.03); // Simulated exponent (model observer)
    return { response: Math.round(clamp(100 * Math.pow(t.phi, a) * Math.exp(rng.normal(0, 0.12)), 1, 300)), rt: drawRT(p, rng, { mu: 2600 }).rt };
  },
  analyse(rows) {
    const phis = [], psis = [];
    for (const r of rows) if (num(r.response) && +r.response > 0) { phis.push(dec(r.stimulus).area); psis.push(+r.response); }
    const ok = distinct(phis) >= 2;
    const fit = ok ? PP.fitStevens(phis, psis) : { a: NaN, k: NaN, r2: NaN };
    const label = isBot(rows) ? 'Simulated exponent' : 'Your exponent';
    const lines = [
      `${label} a = ${fmt(fit.a, 2)} (ψ = k·φᵃ, fitted by log–log regression; k = ${fmt(fit.k, 1)}, R² = ${fmt(fit.r2, 2)})`,
      `a < 1 means response compression: doubling the area less than doubles the judged size. ${phis.length} usable judgements (zeros excluded).`,
    ].concat(botNote(rows, 'judgements'));
    return { lines, stats: fit,
      chart: (ch) => (ok ? ch.scatter(phis.map(Math.log), psis.map(Math.log), { label: 'Stevens power law (log–log)', xl: 'ln area (modulus = 0)', yl: 'ln estimate', line: { a: Math.log(fit.k), b: fit.a } }) : noData(ch, 'Stevens power law')) };
  },
}, SENS);

// ---------------------------------------------------------------- 6. Yes/No SDT with payoffs
const PAYOFF = { liberal: { hit: 3, fa: 1 }, neutral: { hit: 2, fa: 2 }, conservative: { hit: 1, fa: 3 } };
const PAY_COL = { liberal: '#009E73', neutral: '#0072B2', conservative: '#D55E00' };
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noisePatch(ctx, W, H, seed, amp) {
  const N = 48, c = Math.max(2, Math.floor(Math.min(6, (Math.min(W, H) * 0.56) / N))), size = N * c, x0 = Math.round(W / 2 - size / 2), y0 = Math.round(H / 2 - size / 2 + 10);
  const rnd = mulberry(seed), sig = 3.6;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const dx = i - N / 2 + 0.5, dy = j - N / 2 + 0.5;
    const v = clamp(0.5 + (rnd() - 0.5) * 0.46 + amp * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig)), 0, 1), g = Math.round(v * 255);
    ctx.fillStyle = `rgb(${g},${g},${g})`; ctx.fillRect(x0 + i * c, y0 + j * c, c, c);
  }
  ctx.strokeStyle = '#1f2937'; ctx.lineWidth = 2; ctx.strokeRect(x0 - 1, y0 - 1, size + 2, size + 2);
  return { y0, size };
}
function payoffBanner(ctx, t, W, state) {
  const p = PAYOFF[t.condition];
  text(ctx, `${t.condition.toUpperCase()} payoff:  Hit +${p.hit}   ·   False alarm −${p.fa}`, W / 2, 30, 20, PAY_COL[t.condition], 800);
  text(ctx, `Points: ${(state && state.points) || 0}`, W / 2, 56, 15, '#334155', 600);
}
const sdtYesNo = Object.assign({
  id: 'sdt_yesno', title: 'Yes/No signal detection with payoffs', panel: 'sdt', apa: '2.4',
  purpose: 'To separate sensitivity (d′) from response bias (c) by detecting a faint blob in visual noise under different payoffs.',
  instructions: '<p>A patch of visual noise flashes. Was there a faint <b>light blob in the centre</b>? <kbd>Y</kbd> = yes, <kbd>N</kbd> = no.</p><p>The <b>payoff</b> at the top changes between blocks: sometimes hits pay more, sometimes false alarms cost more. Try to earn as many points as you can.</p>',
  estimateMin: 6, practice: 3, fix: 500, iti: 350, timeout: 3500, dur: 500, background: '#cbd5e1',
  response: { type: 'key', keys: ['y', 'n'], labels: { y: 'yes, target', n: 'no target' } },
  factRefs: ['F-HAUTUS'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 24 : 120);
    const order = rng.shuffle(['liberal', 'neutral', 'conservative']), out = [];
    order.forEach((cond, b) => {
      const k = Math.floor(n / 3) + (b < n % 3 ? 1 : 0);
      for (const sig of cycle([true, false], k, rng)) out.push({ condition: cond, signal: sig, seed: rng.int(1, 2 ** 30), correctResponse: sig ? 'y' : 'n', stimulus: sig ? 'signal' : 'noise' });
    });
    return out;
  },
  init() { return { points: 0 }; },
  draw(ctx, t, W, H, el, state) { payoffBanner(ctx, t, W, state); noisePatch(ctx, W, H, t.seed, t.signal ? 0.17 : 0); },
  drawMask(ctx, t, W, H, state) {
    payoffBanner(ctx, t, W, state);
    const g = noisePatch(ctx, W, H, t.seed ^ 0x5bd1e995, 0);
    text(ctx, 'Target present?   Y = yes   ·   N = no', W / 2, g.y0 + g.size + 28, 18, '#0f172a', 700);
  },
  score(t, r) { return t.signal ? r === 'y' : r === 'n'; },
  update(state, t, res) {
    if (t.block === 'practice') return;
    const p = PAYOFF[t.condition];
    if (t.signal && res.response === 'y') state.points = (state.points || 0) + p.hit;
    else if (!t.signal && res.response === 'y') state.points = (state.points || 0) - p.fa;
  },
  simulate(p, t, rng) {
    const d = 1.4 + 0.25 * clamp(p.ability, -2, 2); // Simulated effect size (model sensitivity)
    const crit = { liberal: 0.25, neutral: 0.7, conservative: 1.25 }[t.condition]; // Simulated criterion placement
    const x = rng.normal(t.signal ? d : 0, 1);
    return { response: x > crit ? 'y' : 'n', rt: drawRT(p, rng, { mu: 560, effect: Math.abs(x - crit) < 0.5 ? 120 : 0 }).rt };
  },
  analyse(rows) {
    const res = [], lines = [];
    for (const cond of ['liberal', 'neutral', 'conservative']) {
      const rr = rows.filter((r) => r.condition === cond && (r.response === 'y' || r.response === 'n'));
      const c = { hits: 0, misses: 0, fas: 0, crs: 0 };
      rr.forEach((r) => { const sig = r.stimulus === 'signal', y = r.response === 'y'; if (sig) c[y ? 'hits' : 'misses']++; else c[y ? 'fas' : 'crs']++; });
      if (!(c.hits + c.misses) || !(c.fas + c.crs)) continue;
      const o = SDT.fromCounts(c);
      const beta = SDT.optimalBeta(0.5, { hit: PAYOFF[cond].hit, miss: 0, cr: 0, fa: PAYOFF[cond].fa });
      res.push(Object.assign({ name: cond }, o));
      lines.push(`${cond}: H = ${apa.noLead(o.H)}, FA = ${apa.noLead(o.FA)} → ${apa.dprime(o.dprime, o.c)}${o.corrected ? ' (log-linear corrected)' : ''}; optimal β for this payoff = ${beta.toFixed(2)}`);
    }
    if (!res.length) lines.push('Not enough responses in any payoff condition to compute d′.');
    const md = res.length ? S.mean(res.map((r) => r.dprime)) : NaN;
    lines.push(`Mean d′ = ${fmt(md, 2)}. Sensitivity should stay roughly constant across payoffs while c shifts (negative c = liberal, positive c = conservative).`);
    return { lines: lines.concat(botNote(rows, 'detection rates')), stats: { conditions: res, meanD: md },
      chart: (ch) => ch.roc(SDT.rocCurve(Number.isFinite(md) ? md : 1), { label: 'ROC: payoff conditions on one iso-sensitivity curve', empirical: res.map((r) => ({ FA: r.FA, H: r.H, name: r.name })) }) };
  },
}, TAGS6, { domain: 'Cog' });

// ---------------------------------------------------------------- 7. Hick–Hyman
const HICK_KEYS = ['a', 's', 'd', 'f', 'j', 'k', 'l', ';'];
const HICK_SET = { 1: ['f'], 2: ['f', 'j'], 4: ['d', 'f', 'j', 'k'], 8: HICK_KEYS };
const hick = Object.assign({
  id: 'hick_hyman', title: 'Hick–Hyman choice RT',
  purpose: 'To measure how your choice reaction time grows with the number of equally likely alternatives (information in bits).',
  instructions: '<p>Lamps appear in a row, each with its key: <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> <kbd>F</kbd> &nbsp; <kbd>J</kbd> <kbd>K</kbd> <kbd>L</kbd> <kbd>;</kbd>. When a lamp lights up, press its key as fast as you can. Blocks use 1, 2, 4 or 8 lamps.</p>',
  estimateMin: 5, practice: 4, fix: 600, iti: 300, timeout: 2500, background: '#111827',
  response: { type: 'key', keys: HICK_KEYS, labels: { a: '1', s: '2', d: '3', f: '4', j: '5', k: '6', l: '7', ';': '8' } },
  factRefs: ['F-HICK'],
  buildTrials(rng, opts) {
    const n = opts.practice ? 6 : opts.trials || (opts.quick ? 24 : 96);
    const sizes = opts.practice ? [2, 4] : rng.shuffle([1, 2, 4, 8]), out = [];
    sizes.forEach((sz, b) => {
      const k = Math.floor(n / sizes.length) + (b < n % sizes.length ? 1 : 0);
      for (const key of cycle(HICK_SET[sz], k, rng)) out.push({ condition: 'n' + sz, n: sz, lit: key, keys: HICK_SET[sz], correctResponse: key, fix: rng.int(450, 950), stimulus: enc({ n: sz, light: key }) });
    });
    return out;
  },
  draw(ctx, t, W, H) {
    const sp = Math.min(84, (W - 80) / 8.6), r = sp * 0.32;
    HICK_KEYS.forEach((k, i) => {
      const x = W / 2 + (i - 3.5) * sp + (i < 4 ? -sp * 0.3 : sp * 0.3), y = H / 2;
      if (!t.keys.includes(k)) { circle(ctx, x, y, r * 0.6, null, '#1f2937', 2); return; }
      if (k === t.lit) { circle(ctx, x, y, r * 1.7, 'rgba(240,228,66,0.18)'); circle(ctx, x, y, r, '#F0E442', '#fff7ae', 3); }
      else circle(ctx, x, y, r, '#374151', '#6b7280', 2);
      text(ctx, k === ';' ? ';' : k.toUpperCase(), x, y + r + 22, 18, '#cbd5e1', 700);
    });
    text(ctx, `${t.n} alternative${t.n > 1 ? 's' : ''}`, W / 2, H / 2 - sp * 1.3, 16, '#94a3b8', 500);
  },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    const { rt } = drawRT(p, rng, { mu: 190 + 145 * Math.log2(t.n + 1) }); // Simulated effect size (ms per bit)
    const ok = drawCorrect(p, rng, 0.35 * Math.log2(t.n));
    return { response: ok ? t.correctResponse : rng.pick(t.keys.length > 1 ? t.keys.filter((k) => k !== t.correctResponse) : t.keys), rt };
  },
  analyse(rows) {
    const ns = [], rts = [], tbl = [];
    for (const n of [1, 2, 4, 8]) {
      const v = rows.filter((r) => r.condition === 'n' + n && String(r.correct) === '1' && num(r.rt_ms)).map((r) => +r.rt_ms);
      const all = rows.filter((r) => r.condition === 'n' + n);
      if (!all.length) continue;
      const m = meanOr(v);
      if (Number.isFinite(m)) { ns.push(n); rts.push(m); }
      tbl.push(`n = ${n} (${PP.hickBits(n).toFixed(2)} bits): mean correct RT ${fmt(m)} ms, accuracy ${fmt(100 * v.length / all.length, 0)}%`);
    }
    const ok = ns.length >= 2, fit = ok ? PP.fitHick(ns, rts) : { a: NaN, b: NaN, r2: NaN };
    const lines = tbl.concat([ok ? `Hick–Hyman fit: RT = ${fmt(fit.a)} + ${fmt(fit.b)}·log₂(n+1) ms; slope ${fmt(fit.b)} ms/bit, R² = ${fmt(fit.r2, 2)}` : 'Need at least two set sizes with correct trials to fit the slope.']).concat(botNote(rows));
    return { lines, stats: fit,
      chart: (ch) => (ok ? ch.scatter(ns.map(PP.hickBits), rts, { label: 'Hick–Hyman: RT vs information', xl: 'log₂(n+1) bits', yl: 'mean RT (ms)', line: { a: fit.a, b: fit.b } }) : noData(ch, 'Hick–Hyman')) };
  },
}, SENS);

// ---------------------------------------------------------------- 8. Fitts pointing
const FITTS_D = [120, 240, 400], FITTS_W = [20, 40, 80];
function fittsLayout(t, W, H) {
  const s = Math.min(1, (W - 100) / 520, (H - 120) / 300), dir = t.dir || 1;
  return { s, sx: W / 2 - dir * t.D * s / 2, tx: W / 2 + dir * t.D * s / 2, y: H / 2 + 20, w: t.W * s, h: 170 * s, r: Math.max(14, 18 * s) };
}
const fitts = Object.assign({
  id: 'fitts', title: 'Fitts pointing',
  purpose: 'To measure how movement time grows with the difficulty of a pointing movement (distance relative to target width).',
  instructions: '<p>Click the blue <b>START</b> dot, then click the orange <b>target bar</b> as quickly and accurately as you can. Movement time is measured from your START click to your target click. Use a mouse, trackpad or finger.</p>',
  estimateMin: 4, practice: 2, fix: 300, iti: 300, timeout: 10000, background: '#e9edf2',
  response: { type: 'pointer' },
  factRefs: ['F-FITTS'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 18 : 54);
    return cycle(combos(FITTS_D, FITTS_W), n, rng).map(([D, w]) => ({ condition: `D${D}_W${w}`, D, W: w, dir: rng.chance(0.5) ? 1 : -1, stimulus: enc({ D, W: w, ID: +PP.fittsID(D, w).toFixed(2) }) }));
  },
  init() { return { fStart: null }; },
  prepare(t, state) { state.fStart = null; state.fLayout = null; },
  draw(ctx, t, W, H, el, state) {
    const L = fittsLayout(t, W, H), started = state && state.fStart != null;
    if (state) state.fLayout = L;
    ctx.fillStyle = started ? '#E69F00' : '#f3c98b';
    rrect(ctx, L.tx - L.w / 2, L.y - L.h / 2, L.w, L.h, Math.min(6, L.w / 3)); ctx.fill();
    ctx.strokeStyle = '#9a5b00'; ctx.lineWidth = 2; ctx.stroke();
    circle(ctx, L.sx, L.y, L.r, started ? '#009E73' : '#0072B2', '#0b3a5c', 2);
    text(ctx, 'START', L.sx, L.y + L.r + 18, 14, '#0b3a5c', 700);
    text(ctx, started ? 'Now click the orange bar!' : 'Click START, then the orange bar', W / 2, 40, 20, '#1e293b', 700);
  },
  onPointer(t, x, y, state, elapsed) {
    const L = state.fLayout; if (!L) return null;
    if (state.fStart == null) { if (Math.hypot(x - L.sx, y - L.y) <= L.r + 8) state.fStart = elapsed; return null; }
    const hit = Math.abs(x - L.tx) <= L.w / 2 && Math.abs(y - L.y) <= L.h / 2;
    return { done: true, response: Math.round(elapsed - state.fStart), correct: hit };
  },
  score() { return null; },
  simulate(p, t, rng) {
    const ID = PP.fittsID(t.D, t.W);
    const mt = Math.max(80, 110 + 125 * ID + rng.normal(0, 35) + p.speed * 0.5); // Simulated effect size (ms per bit)
    const react = drawRT(p, rng, { mu: 380 }).rt;
    return { response: Math.round(mt), rt: react + mt, correct: drawCorrect(p, rng, 0.15 * ID - 0.3) };
  },
  analyse(rows) {
    const Ds = [], Ws = [], MTs = [], tbl = [];
    for (const [D, w] of combos(FITTS_D, FITTS_W)) {
      const all = rows.filter((r) => r.condition === `D${D}_W${w}` && num(r.response));
      const ok = all.filter((r) => String(r.correct) === '1').map((r) => +r.response);
      if (!all.length) continue;
      const m = meanOr(ok);
      if (Number.isFinite(m)) { Ds.push(D); Ws.push(w); MTs.push(m); }
      tbl.push(`D ${D} · W ${w} · ID ${PP.fittsID(D, w).toFixed(2)} bits → MT ${fmt(m)} ms (${ok.length}/${all.length} hits)`);
    }
    const ok = distinct(Ds.map((d, i) => PP.fittsID(d, Ws[i]))) >= 2;
    const fit = ok ? PP.fitFitts(Ds, Ws, MTs) : { a: NaN, b: NaN, r2: NaN, throughput: NaN };
    const lines = ['ID table (ID = log₂(2D/W)):'].concat(tbl, [ok ? `Fitts fit: MT = ${fmt(fit.a)} + ${fmt(fit.b)}·ID ms; R² = ${fmt(fit.r2, 2)}; 1/b ≈ ${fmt(fit.throughput, 1)} bits/s` : 'Need at least two difficulty levels with hits to fit Fitts\' law.']).concat(botNote(rows));
    const ids = Ds.map((d, i) => PP.fittsID(d, Ws[i]));
    return { lines, stats: fit,
      chart: (ch) => (ok ? ch.scatter(ids, MTs, { label: 'Fitts: movement time vs index of difficulty', xl: 'ID (bits)', yl: 'MT (ms)', line: { a: fit.a, b: fit.b } }) : noData(ch, 'Fitts')) };
  },
}, SENS);

// ---------------------------------------------------------------- 9. Mental rotation (original cube figures)
/** Original 10-cube chiral arm figures, Shepard–Metzler style: arms of [axis, sign, length]. */
const MR_SHAPES = {
  A: [[0, 1, 3], [1, 1, 3], [2, 1, 2], [1, 1, 1]],
  B: [[0, 1, 2], [2, 1, 3], [1, 1, 2], [0, 1, 2]],
  C: [[1, 1, 2], [0, 1, 3], [2, -1, 3], [1, 1, 1]],
};
const MR_ANG = [0, 30, 60, 90, 120, 150, 180];
const MR_CACHE = {};
function mrCubes(name) {
  if (MR_CACHE[name]) return MR_CACHE[name];
  const cells = [[0, 0, 0]]; let p = [0, 0, 0];
  for (const [ax, sg, len] of MR_SHAPES[name]) for (let i = 0; i < len; i++) { p = p.slice(); p[ax] += sg; cells.push(p); }
  const c = [0, 1, 2].map((k) => S.mean(cells.map((q) => q[k])));
  return (MR_CACHE[name] = cells.map((q) => [q[0] - c[0], q[1] - c[1], q[2] - c[2]]));
}
const rotY = (a) => (v) => [v[0] * Math.cos(a) + v[2] * Math.sin(a), v[1], -v[0] * Math.sin(a) + v[2] * Math.cos(a)];
const rotX = (a) => (v) => [v[0], v[1] * Math.cos(a) - v[2] * Math.sin(a), v[1] * Math.sin(a) + v[2] * Math.cos(a)];
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** Draw a polycube: own 3D→2D projection (weak perspective), back-face culling, painter's sort, Lambert shading. */
function drawCubeFigure(ctx, cells, mirror, yaw, cx, cy, u, base) {
  const occ = new Set(cells.map((c) => c.join(',')));
  const R = (v) => rotX(-0.55)(rotY(base + yaw)(mirror ? [-v[0], v[1], v[2]] : v));
  const light = norm([-0.45, 0.65, 0.6]), faces = [];
  for (const c of cells) {
    for (const d of DIRS) {
      if (occ.has([c[0] + d[0], c[1] + d[1], c[2] + d[2]].join(','))) continue;
      const ax = d.findIndex((q) => q !== 0), o = [0, 1, 2].filter((k) => k !== ax), corners = [];
      for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const v = c.slice(); v[ax] += d[ax] * 0.5; v[o[0]] += a * 0.5; v[o[1]] += b * 0.5; corners.push(R(v)); }
      const N = R(d); // reflection + rotation are orthogonal, so the normal maps like a point
      if (N[2] <= 0.001) continue; // viewer looks along −z: keep faces whose normal points to the viewer (+z)
      faces.push({ pts: corners, z: S.mean(corners.map((q) => q[2])), shade: 0.55 + 0.45 * Math.max(0, dot(N, light)) });
    }
  }
  faces.sort((a, b) => a.z - b.z);
  for (const f of faces) {
    const pts = f.pts.map((q) => { const k = 1 + q[2] * 0.04; return { x: cx + q[0] * u * k, y: cy - q[1] * u * k }; });
    const r = Math.round(95 * f.shade), g = Math.round(150 * f.shade), b = Math.round(230 * f.shade);
    poly(ctx, pts, `rgb(${r},${g},${b})`, '#0b1320', 1.6);
  }
}
const mentalRotation = {
  id: 'mental_rotation', title: 'Mental rotation (3D)', week: 10, panel: 'cognition', zone: 'explab', apa: '2.1', domain: 'Cog', hec: 'S3 Cognitive Psychology',
  purpose: 'To measure how long it takes to decide whether two 3D block figures are the same object, as a function of the angle between them.',
  instructions: '<p>Two block figures appear. Can the right one be <b>rotated</b> to match the left one? <kbd>F</kbd> = same object, <kbd>J</kbd> = different (mirror image). Be fast but accurate.</p>',
  estimateMin: 6, practice: 2, fix: 600, iti: 500, timeout: 8000, background: '#eef2f7',
  response: { type: 'key', keys: ['f', 'j'], labels: { f: 'same', j: 'different' } },
  factRefs: ['F-SM71'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 14 : 56);
    return cycle(combos(['same', 'mirror'], MR_ANG), n, rng).map(([condition, angle]) => {
      const shape = rng.pick(Object.keys(MR_SHAPES));
      return { condition, angle, shape, base: rng.uniform(0, Math.PI * 2), correctResponse: condition === 'same' ? 'f' : 'j', stimulus: enc({ angle, shape }) };
    });
  },
  draw(ctx, t, W, H) {
    const u = Math.min(W * 0.42, H * 0.72) / 6, cells = mrCubes(t.shape);
    drawCubeFigure(ctx, cells, false, 0, W * 0.29, H * 0.5, u, t.base);
    drawCubeFigure(ctx, cells, t.condition === 'mirror', (t.angle * Math.PI) / 180, W * 0.71, H * 0.5, u, t.base);
    line(ctx, W / 2, H * 0.2, W / 2, H * 0.8, '#cbd5e1', 2);
    text(ctx, 'F = same   ·   J = different', W / 2, H - 28, 16, '#475569', 600);
  },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    const effect = t.condition === 'same' ? 6.5 * t.angle : 350 + 3 * t.angle; // Simulated effect size (ms/deg)
    const { rt } = drawRT(p, rng, { mu: 1100, effect });
    const ok = drawCorrect(p, rng, t.angle / 150 - 0.3);
    return { response: ok ? t.correctResponse : t.correctResponse === 'f' ? 'j' : 'f', rt };
  },
  analyse(rows) {
    const same = rows.filter((r) => r.condition === 'same' && String(r.correct) === '1' && num(r.rt_ms));
    const angs = same.map((r) => dec(r.stimulus).angle), rts = same.map((r) => +r.rt_ms);
    const ok = distinct(angs) >= 2, fit = ok ? PP.fitRotation(angs, rts) : { intercept: NaN, slope: NaN, r2: NaN };
    const acc = (c) => { const v = rows.filter((r) => r.condition === c && r.correct !== ''); return v.length ? 100 * v.filter((r) => String(r.correct) === '1').length / v.length : NaN; };
    const lines = [
      ok ? `"Same" trials: RT = ${fmt(fit.intercept)} + ${fmt(fit.slope, 2)}·angle ms (slope ${fmt(fit.slope, 2)} ms/deg ≈ ${fmt(1000 / fit.slope, 0)} deg/s, R² = ${fmt(fit.r2, 2)})` : 'Need correct "same" trials at two or more angles to fit the rotation slope.',
      `Accuracy: same ${fmt(acc('same'), 0)}%, mirror ${fmt(acc('mirror'), 0)}%`,
      'A roughly linear rise of RT with angle suggests an analogue, rotation-like mental process.',
    ].concat(botNote(rows));
    return { lines, stats: fit,
      chart: (ch) => (ok ? ch.scatter(angs, rts, { label: 'Mental rotation: RT by angular disparity', xl: 'angle (deg)', yl: 'RT (ms)', line: { a: fit.intercept, b: fit.slope } }) : noData(ch, 'Mental rotation')) };
  },
};

module.exports = [mullerLyer, ponzo, ames, jnd, magnitude, sdtYesNo, hick, fitts, mentalRotation];
