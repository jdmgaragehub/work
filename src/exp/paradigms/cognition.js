'use strict';
/**
 * Cognition paradigms (A8, Panel 17 Cognition & Language): hanoi, wason, framing, anchoring.
 * Contract: docs/EXPERIMENT_API.md. All wording and stimuli are original; bot effects are "Simulated effect size".
 */
const S = require('../../psych/stats.js');
const { drawRT, drawCorrect } = require('../../psych/participants.js');

const TAGS = { week: 10, panel: 'cognition', zone: 'library', apa: '2.1', domain: 'Cog', hec: 'S3 Cognitive Psychology' };
const text = (ctx, s, x, y, size = 20, color = '#111', weight = 600, align = 'center') => { ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
function wrap(ctx, s, x, y, maxW, size = 20, color = '#111', weight = 500, align = 'center', lineH = 1.35) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  const words = String(s).split(/\s+/); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  lines.forEach((l, i) => text(ctx, l, x, y + i * size * lineH, size, color, weight, align));
  return y + lines.length * size * lineH;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(0) + '%' : '—');
const meanOr = (xs, d = NaN) => (xs.length ? S.mean(xs) : d);

// ---------------------------------------------------------------- Tower of Hanoi
const PEG_X = [0.22, 0.5, 0.78];
const DISC_COL = ['#E69F00', '#56B4E9', '#009E73', '#CC79A7', '#0072B2', '#D55E00'];
const optimal = (n) => Math.pow(2, n) - 1;

function hanoiAct(t, state, peg) {
  const h = state.hanoi;
  if (!h || h.solved) return null;
  if (h.held == null) {
    if (h.pegs[peg].length) { h.held = h.pegs[peg].pop(); h.from = peg; h.msg = ''; }
    return null;
  }
  const top = h.pegs[peg][h.pegs[peg].length - 1];
  if (top != null && top < h.held) { h.msg = 'A larger disc cannot go on a smaller one.'; return null; }
  h.pegs[peg].push(h.held);
  if (peg !== h.from) h.moves++;
  h.held = null; h.msg = '';
  if (h.pegs[2].length === t.discs) { h.solved = true; return { done: true, response: h.moves, correct: h.moves === optimal(t.discs) }; }
  return null;
}

const hanoi = Object.assign({
  id: 'hanoi', title: 'Tower of Hanoi',
  purpose: 'To experience planning and means–end problem solving, comparing your number of moves with the optimal 2ⁿ − 1.',
  instructions: '<p>Move the whole tower from the <b>left</b> peg to the <b>right</b> peg. Click a peg (or press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>) to pick up its top disc, then click another peg to drop it.</p><p>Rules: move one disc at a time, and never place a larger disc on a smaller one. Try to use as few moves as possible.</p>',
  estimateMin: 5, practice: 1, fix: 300, iti: 800, timeout: 300000, background: '#f8fafc', animated: true,
  response: { type: 'pointer', keys: ['1', '2', '3'] },
  buildTrials(rng, opts) {
    if (opts.practice === true) return [{ condition: '2disc', discs: 2, stimulus: '2 discs', correctResponse: optimal(2) }];
    const n = opts.trials || 4;
    return Array.from({ length: n }, (_, i) => { const d = i < Math.ceil(n / 2) ? 3 : 4; return { condition: d + 'disc', discs: d, stimulus: `${d} discs`, correctResponse: optimal(d) }; });
  },
  prepare(t, state) { state.hanoi = { pegs: [Array.from({ length: t.discs }, (_, i) => t.discs - i), [], []], held: null, from: 0, moves: 0, msg: '', solved: false }; },
  onPointer(t, x, y, state) {
    const W = state.W || 800;
    let best = 0; PEG_X.forEach((p, i) => { if (Math.abs(x - p * W) < Math.abs(x - PEG_X[best] * W)) best = i; });
    return hanoiAct(t, state, best);
  },
  onKey(t, k, state) { const i = ['1', '2', '3'].indexOf(k); return i < 0 ? null : hanoiAct(t, state, i); },
  draw(ctx, t, W, H, elapsed, state) {
    if (state) { state.W = W; state.H = H; }
    const h = (state && state.hanoi) || { pegs: [Array.from({ length: t.discs }, (_, i) => t.discs - i), [], []], held: null, moves: 0, msg: '' };
    const base = H * 0.72, pegH = H * 0.4, maxW = W * 0.24, dh = Math.min(34, pegH / (t.discs + 1));
    text(ctx, `Move the tower to the right peg — moves: ${h.moves}   (optimal: ${optimal(t.discs)})`, W / 2, 40, 20, '#111', 600);
    ctx.fillStyle = '#7c5e3c'; ctx.fillRect(W * 0.08, base, W * 0.84, 16);
    PEG_X.forEach((px, i) => {
      ctx.fillStyle = '#8b6b4a'; ctx.fillRect(px * W - 6, base - pegH, 12, pegH);
      text(ctx, String(i + 1), px * W, base + 40, 22, '#334155', 700);
      h.pegs[i].forEach((d, j) => {
        const w = maxW * (0.3 + 0.7 * d / t.discs);
        ctx.fillStyle = DISC_COL[(d - 1) % DISC_COL.length]; ctx.fillRect(px * W - w / 2, base - (j + 1) * dh, w, dh - 3);
      });
    });
    if (h.held != null) {
      const w = maxW * (0.3 + 0.7 * h.held / t.discs), px = PEG_X[h.from] * W;
      ctx.fillStyle = DISC_COL[(h.held - 1) % DISC_COL.length]; ctx.fillRect(px - w / 2, base - pegH - dh - 20, w, dh - 3);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.strokeRect(px - w / 2, base - pegH - dh - 20, w, dh - 3);
    }
    if (h.msg) text(ctx, h.msg, W / 2, H - 50, 18, '#9f1239', 600);
  },
  score(t, r) { return r == null ? false : +r === optimal(t.discs); },
  simulate(p, t, rng) {
    // Simulated solver: optimal path plus a seeded number of detour move-pairs (fewer for higher ability).
    const extraPairs = Math.max(0, Math.round(rng.normal((t.discs - 2) * 1.2 - p.ability, 1.2)));
    const moves = optimal(t.discs) + 2 * extraPairs;
    let rt = 0; for (let i = 0; i < moves; i++) rt += drawRT(p, rng, { mu: 1100 }).rt;
    return { response: moves, rt, correct: extraPairs === 0 };
  },
  analyse(rows) {
    const lines = [], series = [], opt = [];
    rows.forEach((r, i) => {
      const n = parseInt(r.stimulus, 10) || 3, m = r.response === '' ? NaN : +r.response, o = optimal(n);
      const sec = r.rt_ms === '' ? NaN : +r.rt_ms / 1000;
      lines.push(`Puzzle ${i + 1} (${n} discs): ${Number.isFinite(m) ? m + ' moves' : 'not solved'} vs optimal ${o}${Number.isFinite(m) ? ` — efficiency ${pct(o / m)}` : ''}${Number.isFinite(sec) && Number.isFinite(m) ? `, ${(sec / m).toFixed(1)} s per move` : ''}`);
      series.push({ x: i + 1, y: Number.isFinite(m) ? m : 0 }); opt.push({ x: i + 1, y: o });
    });
    const solvedOpt = rows.filter((r) => String(r.correct) === '1').length;
    lines.push(`Solved in the optimal number of moves: ${solvedOpt} of ${rows.length}. Optimal = 2ⁿ − 1 (7 for 3 discs, 15 for 4).`);
    return { lines, stats: { optimalSolutions: solvedOpt },
      chart: (ch) => ch.line([{ name: 'Your moves', points: series, dots: true }, { name: 'Optimal 2ⁿ−1', points: opt, dash: true }], { label: 'Tower of Hanoi: moves per puzzle', xl: 'puzzle', yl: 'moves' }) };
  },
}, TAGS);

// ---------------------------------------------------------------- Wason selection task
// Card values: P, notP, Q, notQ. Correct = P + notQ (cards that could falsify the rule).
const WASON = [
  { version: 'abstract', rule: 'If a card has a vowel on one side, then it has an even number on the other side.', cards: { P: 'A', notP: 'D', Q: '6', notQ: '3' } },
  { version: 'abstract', rule: 'If a card shows a circle on one side, then it is green on the other side.', cards: { P: 'circle', notP: 'triangle', Q: 'green', notQ: 'red' } },
  { version: 'abstract', rule: 'If a card has a letter from A to M on one side, then it has an odd number on the other side.', cards: { P: 'F', notP: 'T', Q: '7', notQ: '8' } },
  { version: 'social', rule: 'If a person is drinking chai at the canteen, they must have a canteen token.', cards: { P: 'Drinking chai', notP: 'Drinking water', Q: 'Has a token', notQ: 'No token' } },
  { version: 'social', rule: 'If a student keeps a library laptop overnight, they must have signed the register.', cards: { P: 'Kept laptop overnight', notP: 'Returned it same day', Q: 'Signed register', notQ: 'Did not sign' } },
  { version: 'social', rule: 'If someone rides a motorbike onto campus, they must be wearing a helmet.', cards: { P: 'Riding a motorbike', notP: 'Walking in', Q: 'Wearing a helmet', notQ: 'No helmet' } },
];
const CARD_FILL = { green: '#009E73', red: '#D55E00' };

const wason = Object.assign({
  id: 'wason', title: 'Wason selection task',
  purpose: 'To test how you check a conditional rule, comparing abstract cards with a familiar social rule.',
  instructions: '<p>Each card has information on <b>both</b> sides; you see only one side. Select <b>every</b> card you would need to turn over to find out whether the rule is being broken — and no others. Use keys <kbd>1</kbd>–<kbd>4</kbd> or click, then <b>Submit</b> (<kbd>Enter</kbd>).</p>',
  estimateMin: 3, practice: 0, fix: 300, iti: 600, timeout: null, background: '#f8fafc',
  response: { type: 'multi' },
  factRefs: ['F-WASON'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 6 : 6);
    const order = rng.shuffle(WASON.map((_, i) => i));
    const out = [];
    for (let i = 0; i < n; i++) {
      const it = WASON[order[i % order.length]];
      const vals = rng.shuffle(['P', 'notP', 'Q', 'notQ']);
      out.push({ condition: it.version, rule: it.rule, faces: vals.map((v) => it.cards[v]), choices: vals.map((v, k) => ({ value: v, label: `Card ${k + 1}: ${it.cards[v]}` })), correctResponse: 'P+notQ', stimulus: `${it.version}:${it.rule.slice(0, 40)}${i >= WASON.length ? ' (repeat)' : ''}` });
    }
    return out;
  },
  draw(ctx, t, W, H) {
    text(ctx, 'Rule:', W / 2, 50, 18, '#334155', 700);
    wrap(ctx, `"${t.rule}"`, W / 2, 84, W * 0.8, 22, '#111', 600);
    const cw = Math.min(150, W * 0.18), ch = cw * 1.4, gap = cw * 0.25, x0 = W / 2 - (4 * cw + 3 * gap) / 2, y0 = H * 0.36;
    t.faces.forEach((f, k) => {
      const x = x0 + k * (cw + gap);
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y0, cw, ch); ctx.strokeStyle = '#334155'; ctx.lineWidth = 2; ctx.strokeRect(x, y0, cw, ch);
      if (f === 'circle') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + cw / 2, y0 + ch / 2, cw * 0.28, 0, Math.PI * 2); ctx.fill(); }
      else if (f === 'triangle') { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(x + cw / 2, y0 + ch * 0.28); ctx.lineTo(x + cw * 0.78, y0 + ch * 0.68); ctx.lineTo(x + cw * 0.22, y0 + ch * 0.68); ctx.closePath(); ctx.fill(); }
      else if (CARD_FILL[f]) { ctx.fillStyle = CARD_FILL[f]; ctx.fillRect(x + 10, y0 + 10, cw - 20, ch - 20); }
      else wrap(ctx, f, x + cw / 2, y0 + ch / 2 - (f.length > 8 ? 14 : 0), cw - 14, f.length > 8 ? 17 : 40, '#111', 700);
      text(ctx, String(k + 1), x + cw / 2, y0 + ch + 24, 20, '#334155', 700);
    });
  },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    // Simulated effect size: the familiar social version is answered correctly more often than the abstract one.
    const ok = drawCorrect(p, rng, t.condition === 'social' ? 1.6 : 4.2);
    const resp = ok ? 'P+notQ' : rng.pick(['P+Q', 'P+Q', 'P', 'P+Q+notQ', 'P+Q+notP+notQ']);
    const sorted = resp.split('+').sort().join('+');
    return { response: sorted, rt: drawRT(p, rng, { mu: 9000, effect: t.condition === 'social' ? -2500 : 0 }).rt };
  },
  analyse(rows) {
    const acc = (v) => meanOr(rows.filter((r) => r.condition === v).map((r) => (String(r.correct) === '1' ? 1 : 0)));
    const a = acc('abstract'), s = acc('social');
    const counts = {}; rows.forEach((r) => { const k = r.response || '(none)'; counts[k] = (counts[k] || 0) + 1; });
    const top = Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${k.replace(/notP/g, 'not-P').replace(/notQ/g, 'not-Q')} ×${v}`).join(', ');
    const match = rows.filter((r) => r.response === 'P+Q').length;
    const lines = [
      `Correct (P and not-Q only): abstract ${pct(a)}, familiar social rule ${pct(s)}`,
      `Your most common selections: ${top || '—'}`,
      `"P and Q" (confirmation / matching pattern) chosen ${match} time(s).`,
      'Logic: only P (could hide not-Q) and not-Q (could hide P) can falsify "if P then Q".',
    ];
    return { lines, stats: { abstract: a, social: s },
      chart: (ch) => ch.bar([{ name: 'abstract', value: (a || 0) * 100 }, { name: 'social rule', value: (s || 0) * 100 }], { label: 'Wason: % correct by version', yl: '%', yr: [0, 100] }) };
  },
}, TAGS);

// ---------------------------------------------------------------- Framing
// Original scenarios: sure option always saves exactly 1/3 of N; risky option 1/3 chance all saved, 2/3 none (equal expected value).
const FRAMES = [
  { key: 'outbreak', intro: 'A new respiratory virus is expected to affect 600 people in a district. Health officers must choose one of two response programmes.', N: 600, unit: 'people', save: 'will be saved', lose: 'will die' },
  { key: 'factory', intro: 'A textile mill is in trouble and 600 workers could lose their jobs. The owners must choose one of two rescue plans.', N: 600, unit: 'jobs', save: 'will be kept', lose: 'will be lost' },
  { key: 'flood', intro: 'A river is rising and 300 homes in a village are at risk of flooding. The district must choose one of two flood plans.', N: 300, unit: 'homes', save: 'will be protected', lose: 'will be flooded' },
  { key: 'crop', intro: 'A fungus threatens 900 acres of wheat. The farmers’ cooperative must choose one of two treatment plans.', N: 900, unit: 'acres', save: 'will be saved', lose: 'will be lost' },
  { key: 'server', intro: 'A university server crashed holding 300 student project files. IT must choose one of two recovery methods.', N: 300, unit: 'files', save: 'will be recovered', lose: 'will be lost' },
  { key: 'water', intro: 'A heatwave threatens the water supply of 600 households. The town must choose one of two supply plans.', N: 600, unit: 'households', save: 'will keep water', lose: 'will lose water' },
];
function frameOptions(sc, frame) {
  const third = sc.N / 3;
  if (frame === 'gain') return { sure: `${third} ${sc.unit} ${sc.save}.`, risky: `There is a 1/3 chance that all ${sc.N} ${sc.unit} ${sc.save}, and a 2/3 chance that none ${sc.save}.` };
  return { sure: `${sc.N - third} ${sc.unit} ${sc.lose}.`, risky: `There is a 1/3 chance that no ${sc.unit} ${sc.lose}, and a 2/3 chance that all ${sc.N} ${sc.lose}.` };
}

const framing = Object.assign({
  id: 'framing', title: 'Framing (original wording)',
  purpose: 'To see whether describing the same outcomes as gains (lives saved) or losses (lives lost) shifts your preference between a sure and a risky option.',
  instructions: '<p>Read each short scenario and choose the plan you prefer (keys <kbd>1</kbd>/<kbd>2</kbd> or click). There are no right answers — in every scenario both plans have the <b>same expected outcome</b>.</p>',
  estimateMin: 3, practice: 0, fix: 300, iti: 600, timeout: null, background: '#f8fafc',
  response: { type: 'choice' },
  factRefs: ['F-TK81'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 6 : 6);
    const first = rng.chance(0.5) ? 'gain' : 'loss'; // frame assignment by seed, then balanced alternation
    const order = [0].concat(rng.shuffle([1, 2, 3, 4, 5]));
    return Array.from({ length: n }, (_, i) => {
      const sc = FRAMES[order[i % order.length]];
      const frame = (i % 2 === 0) === (first === 'gain') ? 'gain' : 'loss';
      const o = frameOptions(sc, frame);
      const sureFirst = rng.chance(0.5);
      const opts2 = sureFirst ? [['sure', o.sure], ['risky', o.risky]] : [['risky', o.risky], ['sure', o.sure]];
      return { condition: frame, intro: sc.intro, options: opts2.map((x) => x[1]), choices: opts2.map((x, k) => ({ value: x[0], label: `Plan ${k + 1}` })), stimulus: `${sc.key}:${frame}${i >= FRAMES.length ? ':repeat' : ''}` };
    });
  },
  draw(ctx, t, W, H) {
    let y = wrap(ctx, t.intro, W / 2, 70, W * 0.78, 22, '#111', 600);
    y += 30;
    t.options.forEach((o, k) => {
      ctx.fillStyle = '#e2e8f0'; ctx.fillRect(W * 0.1, y - 22, W * 0.8, 96);
      text(ctx, `Plan ${k + 1}`, W * 0.13, y, 20, '#0F766E', 800, 'left');
      wrap(ctx, `If Plan ${k + 1} is adopted, ${o.charAt(0).toLowerCase() + o.slice(1)}`, W / 2, y + 30, W * 0.72, 19, '#111', 500);
      y += 120;
    });
    text(ctx, 'Which plan do you prefer?', W / 2, y + 10, 20, '#334155', 600);
  },
  score() { return null; },
  simulate(p, t, rng) {
    const pr = t.condition === 'loss' ? 0.68 : 0.3; // Simulated effect size
    return { response: rng.random() < pr ? 'risky' : 'sure', rt: drawRT(p, rng, { mu: 6500 }).rt };
  },
  analyse(rows) {
    const risky = (f) => meanOr(rows.filter((r) => r.condition === f && r.response !== '').map((r) => (r.response === 'risky' ? 1 : 0)));
    const g = risky('gain'), l = risky('loss');
    const lines = [
      `% risky choice — gain frame: ${pct(g)}, loss frame: ${pct(l)}`,
      Number.isFinite(g) && Number.isFinite(l) ? `Framing shift (loss − gain): ${((l - g) * 100).toFixed(0)} percentage points${l > g ? ' — more risk-seeking when outcomes were described as losses' : ''}.` : 'Framing shift: needs both frames.',
      'Classic pattern (F-TK81): risk aversion for gains, risk seeking for losses — even though each pair of plans is equivalent in expected value.',
      'Your own data come from only a few within-person choices; the classic design compares separate groups.',
    ];
    return { lines, stats: { gain: g, loss: l },
      chart: (ch) => ch.bar([{ name: 'gain frame', value: (g || 0) * 100 }, { name: 'loss frame', value: (l || 0) * 100 }], { label: 'Framing: % risky choice', yl: '%', yr: [0, 100] }) };
  },
}, TAGS);

// ---------------------------------------------------------------- Anchoring
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ANCHOR_ITEMS = [
  { kind: 'jar', label: 'jar', unit: 'beads', q: 'beads in this jar', truth: 340, max: 1500, step: 10 },
  { kind: 'bridge', label: 'bridge', unit: 'metres', q: 'metres long is this bridge', truth: 260, max: 1200, step: 10 },
  { kind: 'jar', label: 'jar2', unit: 'beads', q: 'beads in this jar', truth: 520, max: 1500, step: 10 },
  { kind: 'bridge', label: 'bridge2', unit: 'metres', q: 'metres long is this bridge', truth: 410, max: 1200, step: 10 },
];

function drawJar(ctx, cx, cy, count, seed) {
  const w = 200, h = 260;
  ctx.fillStyle = 'rgba(200,230,255,0.35)'; ctx.strokeStyle = '#64748b'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx - w / 2, cy - h / 2); ctx.lineTo(cx - w / 2, cy + h / 2 - 20); ctx.quadraticCurveTo(cx - w / 2, cy + h / 2, cx - w / 2 + 20, cy + h / 2); ctx.lineTo(cx + w / 2 - 20, cy + h / 2); ctx.quadraticCurveTo(cx + w / 2, cy + h / 2, cx + w / 2, cy + h / 2 - 20); ctx.lineTo(cx + w / 2, cy - h / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#94a3b8'; ctx.fillRect(cx - w / 2 - 8, cy - h / 2 - 18, w + 16, 18);
  const r = mulberry(seed), cols = ['#D55E00', '#0072B2', '#009E73', '#E69F00', '#CC79A7'];
  const per = Math.max(8, Math.round(Math.sqrt(count * 0.62))), rad = Math.min(6, (w - 12) / per / 2);
  for (let i = 0; i < count; i++) {
    const col = i % per, row = Math.floor(i / per);
    const x = cx - w / 2 + 8 + rad + col * (w - 16 - 2 * rad) / Math.max(1, per - 1) + (r() - 0.5) * 3;
    const y = cy + h / 2 - 6 - rad - row * rad * 1.75 + (r() - 0.5) * 3;
    ctx.fillStyle = cols[Math.floor(r() * cols.length)]; ctx.beginPath(); ctx.arc(x, Math.max(cy - h / 2 + rad, y), rad, 0, Math.PI * 2); ctx.fill();
  }
}
function drawBridge(ctx, W, cy, length) {
  const x0 = W * 0.1, x1 = W * 0.9;
  ctx.fillStyle = '#7dd3fc'; ctx.fillRect(x0, cy + 30, x1 - x0, 60);
  ctx.fillStyle = '#475569'; ctx.fillRect(x0, cy, x1 - x0, 14);
  const spans = 4; ctx.strokeStyle = '#334155'; ctx.lineWidth = 3;
  for (let i = 0; i <= spans; i++) { const x = x0 + (i / spans) * (x1 - x0); ctx.fillStyle = '#64748b'; ctx.fillRect(x - 6, cy + 14, 12, 76); }
  for (let i = 0; i < spans; i++) { const a = x0 + (i / spans) * (x1 - x0), b = x0 + ((i + 1) / spans) * (x1 - x0); ctx.beginPath(); ctx.moveTo(a, cy); ctx.quadraticCurveTo((a + b) / 2, cy - 50, b, cy); ctx.stroke(); }
  // scale reference: a 12-metre bus drawn to scale
  const bw = (12 / length) * (x1 - x0); ctx.fillStyle = '#b45309'; ctx.fillRect(x0 + 20, cy - 16, Math.max(3, bw), 14);
  text(ctx, 'bus = 12 m', x0 + 20 + Math.max(3, bw) / 2, cy - 30, 13, '#7c2d12', 600);
}

const anchoring = Object.assign({
  id: 'anchoring', title: 'Anchoring',
  purpose: 'To see whether an arbitrary number in a comparison question pulls your next numerical estimate toward it.',
  instructions: '<p>For each picture you first answer a quick comparison question (more or fewer?), then give your <b>best estimate</b> with the slider (arrow keys, <kbd>Shift</kbd> for bigger steps, <kbd>Enter</kbd> to confirm). The comparison numbers are arbitrary — they carry no information.</p>',
  estimateMin: 3, practice: 0, fix: 300, iti: 500, timeout: null, background: '#f8fafc',
  response: { type: 'choice', choices: [{ value: 'more', label: 'More' }, { value: 'fewer', label: 'Fewer' }] },
  buildTrials(rng, opts) {
    const nItems = Math.max(2, Math.ceil((opts.trials || (opts.quick ? 6 : 8)) / 2));
    const firstHigh = rng.chance(0.5);
    const out = [];
    for (let i = 0; i < nItems; i++) {
      const it = ANCHOR_ITEMS[i % ANCHOR_ITEMS.length];
      const truth = it.truth + (i >= ANCHOR_ITEMS.length ? rng.int(-6, 6) * 10 : 0);
      const cond = (i % 2 === 0) === firstHigh ? 'high' : 'low';
      const anchor = Math.round((cond === 'high' ? truth * 2.4 : truth * 0.3) / 10) * 10;
      const seed = 1000 + i * 77;
      const what = it.kind === 'jar' ? `beads in this jar` : 'metres long';
      out.push({ condition: cond, kind: it.kind, truth, anchor, seed, phase: 'compare', prompt: it.kind === 'jar' ? `Are there more or fewer than ${anchor} beads in this jar?` : `Is this bridge more or fewer than ${anchor} metres long?`, correctResponse: truth > anchor ? 'more' : 'fewer', stimulus: `compare:${it.label}:anchor=${anchor}` });
      out.push({ condition: cond, kind: it.kind, truth, anchor, seed, phase: 'estimate', responseType: 'slider', slider: { min: 0, max: it.max, step: it.step, start: 0, label: `Estimate: how many ${what}?` }, prompt: `Your best estimate: how many ${what}?`, stimulus: `estimate:${it.label}:true=${truth}:anchor=${anchor}` });
    }
    return out;
  },
  draw(ctx, t, W, H, elapsed, state) {
    if (t.kind === 'jar') drawJar(ctx, W / 2, H * 0.48, t.truth, t.seed); else drawBridge(ctx, W, H * 0.45, t.truth);
    wrap(ctx, t.prompt, W / 2, 40, W * 0.85, 22, '#111', 700);
    if (t.phase === 'estimate') { const v = state && state.sliderValue != null ? state.sliderValue : t.slider.start; text(ctx, `Your estimate: ${v} ${t.kind === 'jar' ? 'beads' : 'm'}`, W / 2, H - 60, 26, '#0F766E', 800); }
  },
  score(t, r) { return t.phase === 'compare' ? r === t.correctResponse : null; },
  simulate(p, t, rng) {
    if (t.phase === 'compare') return { response: drawCorrect(p, rng, 0.5) ? t.correctResponse : (t.correctResponse === 'more' ? 'fewer' : 'more'), rt: drawRT(p, rng, { mu: 2200 }).rt };
    // Simulated effect size: log-estimate pulled 30% of the way toward the anchor.
    const raw = Math.log(t.truth) + rng.normal(0, 0.25);
    const est = Math.exp(0.7 * raw + 0.3 * Math.log(Math.max(1, t.anchor)));
    const v = clamp(Math.round(est / t.slider.step) * t.slider.step, t.slider.min, t.slider.max);
    return { response: v, rt: drawRT(p, rng, { mu: 4500 }).rt };
  },
  analyse(rows) {
    const est = rows.filter((r) => /^estimate:/.test(r.stimulus) && r.response !== '').map((r) => { const truth = +((/true=(\d+)/.exec(r.stimulus) || [])[1]) || 1; return { cond: r.condition, v: +r.response, ratio: +r.response / truth, truth, anchor: +((/anchor=(\d+)/.exec(r.stimulus) || [])[1]) || 0, item: r.stimulus.split(':')[1] }; });
    const m = (c) => meanOr(est.filter((e) => e.cond === c).map((e) => e.ratio));
    const hi = m('high'), lo = m('low');
    const comp = rows.filter((r) => /^compare:/.test(r.stimulus));
    const lines = est.map((e) => `${e.item}: estimate ${e.v} (true ${e.truth}; ${e.cond} anchor ${e.anchor})`);
    lines.push(`Mean estimate as % of the true value — after HIGH anchors: ${pct(hi)}, after LOW anchors: ${pct(lo)}`);
    if (Number.isFinite(hi) && Number.isFinite(lo)) lines.push(hi > lo ? 'Your estimates moved toward the anchors (anchoring effect).' : 'No anchoring effect in your estimates this time — few items, so this is noisy.');
    lines.push(`Comparison questions answered correctly: ${comp.filter((r) => String(r.correct) === '1').length} of ${comp.length}`);
    return { lines, stats: { high: hi, low: lo },
      chart: (ch) => ch.bar([{ name: 'low anchor', value: (lo || 0) * 100 }, { name: 'high anchor', value: (hi || 0) * 100 }], { label: 'Anchoring: mean estimate (% of true value)', yl: '% of true' }) };
  },
}, TAGS);

module.exports = [hanoi, wason, framing, anchoring];
