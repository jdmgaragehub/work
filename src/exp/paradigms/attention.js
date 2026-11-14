'use strict';
/**
 * Attention paradigms (A8): visual search, Posner cueing, attentional blink, dichotic listening,
 * inattentional blindness, change blindness. Contract: docs/EXPERIMENT_API.md.
 * Pure apart from drawing on a passed 2D context. All stimuli are original and procedural.
 * Bot effects marked "Simulated effect size" are teaching values, not results from a study.
 */
const S = require('../../psych/stats.js');
const { apa } = require('../../core/format.js');
const { drawRT, drawCorrect } = require('../../psych/participants.js');

const TAGS = { week: 7, panel: 'attention', zone: 'explab', apa: '2.1', domain: 'Cog', hec: 'S3 Cognitive Psychology' };

// ---------- shared helpers ----------
const text = (ctx, s, x, y, size = 32, color = '#111', weight = 700, align = 'center') => {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
};
const rrect = (ctx, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
const panel = (ctx, x, y, w, h, fill = 'rgba(255,255,255,0.85)', r = 14) => { ctx.fillStyle = fill; rrect(ctx, x, y, w, h, r); ctx.fill(); };
const avg = (xs) => (xs.length ? S.mean(xs) : NaN);
const fin = (v) => Number.isFinite(v);
const f0 = (v, unit = '') => (fin(v) ? v.toFixed(0) + unit : '—');
const pc = (v) => (fin(v) ? (100 * v).toFixed(0) + '%' : '—');
const isOk = (r) => String(r.correct) === '1';
const parts = (resp) => String(resp == null ? '' : resp).split('|');
const mainOf = (resp) => parts(resp)[0];
const rate = (rows, pred) => (rows.length ? rows.filter(pred).length / rows.length : NaN);
const field = (stim, key) => { const m = String(stim || '').match(new RegExp('(?:^|;)' + key + '=([^;]*)')); return m ? m[1] : ''; };
const setBot = (t, answer) => { if (t.followup) t.followup.botAnswer = answer; return answer; };
const rtOf = (rows) => rows.filter((r) => isOk(r) && r.rt_ms !== '' && fin(+r.rt_ms)).map((r) => +r.rt_ms);
const prompt = (ctx, W, H, lines, sub) => {
  panel(ctx, W * 0.14, H * 0.36, W * 0.72, H * 0.28, 'rgba(255,255,255,0.92)');
  lines.forEach((l, i) => text(ctx, l, W / 2, H * 0.44 + i * 34, i ? 22 : 28, i ? '#333' : '#111', i ? 600 : 800));
  if (sub) text(ctx, sub, W / 2, H * 0.6, 16, '#555', 500);
};

// =====================================================================================
// 1. Visual search — feature vs conjunction (Treisman & Gelade, fact F-TREISMAN)
// =====================================================================================
const VS_RED = '#C8312B', VS_GREEN = '#24885A', VS_SIZES = [4, 8, 16];
function vsBar(ctx, x, y, L, th, col, horiz) {
  ctx.save(); ctx.translate(x, y); if (horiz) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)'; rrect(ctx, -th / 2 + 2, -L / 2 + 2, th, L, th / 2); ctx.fill();
  ctx.fillStyle = col; rrect(ctx, -th / 2, -L / 2, th, L, th / 2); ctx.fill(); ctx.restore();
}
const visualSearch = Object.assign({}, TAGS, {
  id: 'visual_search', title: 'Feature vs conjunction search',
  purpose: 'To measure how search time grows with the number of items when the target differs by a single feature versus a conjunction of features.',
  instructions: '<p>Find the <b style="color:#C8312B">red vertical bar</b>. Press <kbd>J</kbd> if it is <b>present</b>, <kbd>F</kbd> if it is <b>absent</b>.</p><p>In <i>feature</i> displays every other bar is green. In <i>conjunction</i> displays the others are green verticals and red horizontals, so only the combination of colour and orientation identifies the target. Respond quickly but accurately.</p>',
  estimateMin: 5, practice: 4, fix: 500, iti: 400, timeout: 4000, background: '#c9ccd1',
  response: { type: 'key', keys: ['f', 'j'], labels: { f: 'absent', j: 'present' } },
  factRefs: ['F-TREISMAN'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 24 : 96);
    const cells = [];
    for (const type of ['feature', 'conjunction']) for (const size of VS_SIZES) for (const present of [true, false]) cells.push({ type, size, present });
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = cells[i % cells.length];
      const slots = rng.shuffle(Array.from({ length: 24 }, (_, k) => k)).slice(0, c.size);
      const items = slots.map((s, k) => {
        const col = s % 6, row = Math.floor(s / 6);
        const x = (col + 0.5) / 6 + rng.uniform(-0.035, 0.035), y = (row + 0.5) / 4 + rng.uniform(-0.05, 0.05);
        if (c.present && k === 0) return { x, y, red: true, horiz: false };
        if (c.type === 'feature') return { x, y, red: false, horiz: false };
        return k % 2 ? { x, y, red: true, horiz: true } : { x, y, red: false, horiz: false };
      });
      out.push({ condition: `${c.type}_${c.size}_${c.present ? 'present' : 'absent'}`, type: c.type, size: c.size, present: c.present, items,
        correctResponse: c.present ? 'j' : 'f', stimulus: `${c.type} n=${c.size} ${c.present ? 'present' : 'absent'}` });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H) {
    const aw = W * 0.72, ah = H * 0.66, ax = (W - aw) / 2, ay = (H - ah) / 2;
    panel(ctx, ax - 18, ay - 18, aw + 36, ah + 36, 'rgba(255,255,255,0.35)', 18);
    const L = Math.min(W, H) * 0.07;
    for (const it of t.items) vsBar(ctx, ax + it.x * aw, ay + it.y * ah, L, L * 0.3, it.red ? VS_RED : VS_GREEN, it.horiz);
    text(ctx, 'F = absent     J = present', W / 2, H - 28, 16, '#333', 600);
  },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    // Simulated effect size: flat slope for feature search, steep (and ~2× for absent) for conjunction search.
    const slope = t.type === 'feature' ? 1.5 : t.present ? 22 : 44;
    const { rt } = drawRT(p, rng, { mu: 470 + (t.present ? 0 : 60), effect: slope * t.size });
    const ok = drawCorrect(p, rng, t.type === 'conjunction' ? 0.4 + t.size * 0.04 : 0.1);
    return { response: ok ? t.correctResponse : (t.correctResponse === 'j' ? 'f' : 'j'), rt };
  },
  analyse(rows) {
    const series = [], stats = {}, lines = [];
    for (const type of ['feature', 'conjunction']) for (const pa of ['present', 'absent']) {
      const pts = VS_SIZES.map((n) => ({ x: n, y: avg(rtOf(rows.filter((r) => r.condition === `${type}_${n}_${pa}`))) })).filter((q) => fin(q.y));
      let slope = NaN;
      if (pts.length >= 2) { const reg = S.regression(pts.map((q) => q.x), pts.map((q) => q.y)); slope = reg.b; }
      stats[`${type}_${pa}_slope`] = slope;
      lines.push(`${type === 'feature' ? 'Feature' : 'Conjunction'} search, target ${pa}: slope ${fin(slope) ? slope.toFixed(1) : '—'} ms/item (RT ${pts.map((q) => q.x + ':' + q.y.toFixed(0)).join(', ') || '—'} ms)`);
      series.push({ name: `${type} ${pa}`, points: pts, dots: true, dash: pa === 'absent' });
    }
    const acc = rate(rows, isOk);
    lines.push(`Accuracy: ${pc(acc)}. Slopes come from a regression of mean correct RT on set size (4, 8, 16).`);
    lines.push('Flat feature slopes suggest parallel "pop-out"; steeper conjunction slopes suggest attention must bind features item by item (see fact F-TREISMAN).');
    stats.accuracy = acc;
    return { lines, stats, chart: (ch) => ch.line(series, { label: 'Search time by set size', xl: 'set size (items)', yl: 'mean correct RT (ms)' }) };
  },
});

// =====================================================================================
// 2. Posner cueing (fact F-POSNER)
// =====================================================================================
const POS_SOA = 300, POS_CUE = 100;
function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a)); }
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#3b2a00'; ctx.stroke();
}
const posner = Object.assign({}, TAGS, {
  id: 'posner', title: 'Posner cueing',
  purpose: 'To measure how a cue that directs attention to one location speeds responses to targets there and slows responses elsewhere.',
  instructions: '<p>Keep your eyes on the centre. A cue appears — either an <b>arrow</b> at the centre or a <b>brief brightening</b> of one box — then a yellow star appears in one box.</p><p>Press <kbd>F</kbd> if the star is on the <b>left</b>, <kbd>J</kbd> if it is on the <b>right</b>. The cue is usually, but not always, right.</p>',
  estimateMin: 4, practice: 4, fix: 600, iti: 400, timeout: 2300, background: '#8f949b', animated: true,
  response: { type: 'key', keys: ['f', 'j'], labels: { f: 'left', j: 'right' } },
  factRefs: ['F-POSNER'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 20 : 80);
    const out = [];
    for (let i = 0; i < n; i++) {
      const cueType = i % 2 ? 'peripheral' : 'central';
      const valid = Math.floor(i / 2) % 5 !== 4; // 80% valid within each cue type
      const side = rng.chance(0.5) ? 'left' : 'right';
      const cueSide = valid ? side : side === 'left' ? 'right' : 'left';
      out.push({ condition: `${cueType}_${valid ? 'valid' : 'invalid'}`, cueType, valid, side, cueSide, soa: POS_SOA,
        correctResponse: side === 'left' ? 'f' : 'j', stimulus: `${cueType} cue ${cueSide}, target ${side}` });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H, el) {
    const s = Math.min(W, H) * 0.17, cy = H / 2;
    const xs = { left: W / 2 - W * 0.24, right: W / 2 + W * 0.24 };
    for (const k of ['left', 'right']) {
      const flash = t.cueType === 'peripheral' && t.cueSide === k && el < POS_CUE;
      ctx.lineWidth = flash ? 8 : 3; ctx.strokeStyle = flash ? '#ffffff' : '#2b2f36';
      ctx.fillStyle = flash ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';
      rrect(ctx, xs[k] - s / 2, cy - s / 2, s, s, 12); ctx.fill(); ctx.stroke();
    }
    if (t.cueType === 'central') {
      const d = t.cueSide === 'left' ? -1 : 1, L = s * 0.32;
      ctx.strokeStyle = '#111'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W / 2 - d * L, cy); ctx.lineTo(W / 2 + d * L, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(W / 2 + d * L - d * 16, cy - 14); ctx.lineTo(W / 2 + d * L, cy); ctx.lineTo(W / 2 + d * L - d * 16, cy + 14); ctx.stroke();
    } else text(ctx, '+', W / 2, cy, 40, '#111', 600);
    if (el >= POS_SOA) star(ctx, xs[t.side], cy, s * 0.3, '#F5B700');
  },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    // Simulated effect size: valid cues speed, invalid cues slow; peripheral cues a little stronger.
    const k = t.cueType === 'peripheral' ? 1.2 : 1;
    const effect = (t.valid ? -22 : 32) * k;
    const { rt } = drawRT(p, rng, { mu: 360, effect });
    const ok = drawCorrect(p, rng, t.valid ? -0.5 : 0.3);
    return { response: ok ? t.correctResponse : (t.correctResponse === 'f' ? 'j' : 'f'), rt: POS_SOA + rt };
  },
  analyse(rows) {
    const m = {}, stats = {}, lines = [];
    for (const c of ['central', 'peripheral']) for (const v of ['valid', 'invalid']) m[`${c}_${v}`] = avg(rtOf(rows.filter((r) => r.condition === `${c}_${v}`))) - POS_SOA;
    for (const c of ['central', 'peripheral']) {
      const eff = m[`${c}_invalid`] - m[`${c}_valid`];
      stats[c + '_validity'] = eff;
      lines.push(`${c === 'central' ? 'Central (arrow)' : 'Peripheral (flash)'} cue: valid ${f0(m[c + '_valid'])} ms, invalid ${f0(m[c + '_invalid'])} ms → validity effect ${f0(eff)} ms`);
    }
    const v = rtOf(rows.filter((r) => /_valid$/.test(r.condition))), iv = rtOf(rows.filter((r) => /_invalid$/.test(r.condition)));
    if (v.length > 2 && iv.length > 2) lines.push('Trial-level comparison, invalid vs valid (illustrative; trials are not independent participants): ' + apa.t(S.tIndependent(iv, v)));
    lines.push(`Accuracy: ${pc(rate(rows, isOk))}. RTs are measured from target onset (cue–target interval ${POS_SOA} ms). See fact F-POSNER.`);
    Object.assign(stats, m);
    const bars = Object.keys(m).map((k) => ({ name: k.replace('_', ' '), value: fin(m[k]) ? m[k] : 0 }));
    return { lines, stats, chart: (ch) => ch.bar(bars, { label: 'RT by cue type and validity', yl: 'ms from target' }) };
  },
});

// =====================================================================================
// 3. Attentional blink — RSVP (fact F-RAYMOND)
// =====================================================================================
// Letters replace each other inside a constant frame (no full-field luminance flashes).
const AB_LET = 'BCDFGHJKLMNPRSTVZ'.split(''), AB_SOA = 100, AB_LAGS = [1, 2, 3, 5, 7], AB_LEN = 18;
const attnBlink = Object.assign({}, TAGS, {
  id: 'attn_blink', title: 'Attentional blink (RSVP)',
  purpose: 'To measure how detecting one target in a rapid letter stream briefly impairs detecting a second target shortly afterwards.',
  instructions: '<p>Letters flash rapidly in the centre (about 10 per second). One letter is <b style="color:#C62828">red</b> — remember it. Then decide whether a black <b>X</b> appeared <i>after</i> the red letter.</p><p>At the end press <kbd>Y</kbd> (X present) or <kbd>N</kbd> (no X), then pick the red letter.</p>',
  estimateMin: 5, practice: 2, fix: 600, iti: 600, timeout: 12000, background: '#b9bcc2', animated: true,
  response: { type: 'key', keys: ['y', 'n'], labels: { y: 'X present', n: 'no X' } },
  factRefs: ['F-RAYMOND'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 12 : 48);
    const conds = AB_LAGS.concat(['absent']);
    const out = [];
    for (let i = 0; i < n; i++) {
      const lag = conds[i % conds.length] === 'absent' ? 0 : conds[i % conds.length];
      const stream = [];
      for (let k = 0; k < AB_LEN; k++) { let L; do L = rng.pick(AB_LET); while (L === stream[k - 1] || L === stream[k - 2]); stream.push(L); }
      const t1pos = rng.int(4, 7), t1 = stream[t1pos];
      if (lag) stream[t1pos + lag] = 'X';
      const foils = rng.shuffle(AB_LET.filter((L) => L !== t1)).slice(0, 3);
      out.push({ condition: lag ? 'lag' + lag : 'absent', lag, stream, t1pos, t1, dur: AB_LEN * AB_SOA,
        correctResponse: lag ? 'y' : 'n', stimulus: `T1=${t1};T2=${lag ? 'lag' + lag : 'absent'}`,
        followup: { prompt: 'Which letter was RED?', choices: rng.shuffle([t1].concat(foils)) } });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H, el) {
    const s = Math.min(W, H) * 0.3;
    panel(ctx, W / 2 - s / 2, H / 2 - s / 2, s, s, '#d7d9dd', 20);
    const idx = Math.floor(Math.max(0, el) / AB_SOA);
    if (idx < t.stream.length) text(ctx, t.stream[idx], W / 2, H / 2 + 4, Math.round(s * 0.5), idx === t.t1pos ? '#C62828' : '#111', 800);
  },
  drawMask(ctx, t, W, H) { prompt(ctx, W, H, ['Was there an X after the red letter?', 'Y = yes     N = no'], 'Next you will pick which letter was red.'); },
  score(t, r) { return r == null ? false : mainOf(r) === t.correctResponse; },
  simulate(p, t, rng) {
    // Simulated effect size: lag-1 sparing, a dip at lags 2–3, recovery by lag 7.
    const pT2 = { 1: 0.78, 2: 0.42, 3: 0.48, 5: 0.72, 7: 0.86 };
    const t1ok = drawCorrect(p, rng, 0.2);
    const yes = t.lag ? rng.chance(t1ok ? pT2[t.lag] : 0.85) : rng.chance(0.06);
    setBot(t, t1ok ? t.t1 : rng.pick(t.followup.choices.filter((c) => c !== t.t1)));
    return { response: yes ? 'y' : 'n', rt: t.dur + drawRT(p, rng, { mu: 620 }).rt };
  },
  analyse(rows) {
    const hasFU = rows.some((r) => parts(r.response).length > 1);
    const t1ok = (r) => { const pr = parts(r.response); return pr.length > 1 ? pr[1] === field(r.stimulus, 'T1') : null; };
    const pts = [], stats = {};
    for (const lag of AB_LAGS) {
      const sub = rows.filter((r) => r.condition === 'lag' + lag && r.response !== '' && t1ok(r) !== false);
      const d = rate(sub, (r) => mainOf(r.response) === 'y');
      stats['lag' + lag] = d;
      if (fin(d)) pts.push({ x: lag, y: 100 * d });
    }
    const fa = rate(rows.filter((r) => r.condition === 'absent' && r.response !== ''), (r) => mainOf(r.response) === 'y');
    const t1acc = hasFU ? rate(rows.filter((r) => parts(r.response).length > 1), (r) => t1ok(r)) : NaN;
    stats.falseAlarm = fa; stats.t1Accuracy = t1acc;
    const lines = [
      `X detection ${hasFU ? 'given the red letter was correct (T2|T1)' : '(no red-letter answers recorded, all trials)'} by lag: ` + AB_LAGS.map((l) => `lag ${l} ${pc(stats['lag' + l])}`).join(', '),
      `False alarms (said "yes" with no X): ${pc(fa)}. Red-letter (T1) accuracy: ${pc(t1acc)}.`,
      'An "attentional blink" shows as a dip at lags 2–3 (about 200–300 ms) with recovery by lag 7; lag 1 is often spared (see fact F-RAYMOND).',
    ];
    return { lines, stats, chart: (ch) => ch.line([{ name: 'T2|T1 detection', points: pts, dots: true }, { name: 'false alarms', points: fin(fa) ? [{ x: 1, y: 100 * fa }, { x: 7, y: 100 * fa }] : [], dash: true }], { label: 'Attentional blink: X detection by lag', xl: 'lag (items after red letter, ×100 ms)', yl: '% detected', yr: [0, 100] }) };
  },
});

// =====================================================================================
// 4. Dichotic listening (fact F-CHERRY). Audio via A10: audio.tone({freq, dur, pan, gain, type, when}) —
//    dur and when in milliseconds (when = offset from the call).
// =====================================================================================
const DL_N = 8, DL_IOI = 350, DL_TONE = 160, DL_FREQS = [392, 440, 494, 523, 587, 659];
const earName = (e) => (e === 'left' ? 'LEFT' : 'RIGHT');
const dichotic = Object.assign({}, TAGS, {
  id: 'dichotic', title: 'Dichotic listening',
  purpose: 'To experience selective listening: attending to one ear while a competing sound plays in the other, and testing what you pick up from the unattended ear.',
  instructions: '<p><b>Use headphones.</b> Two different tone sequences play at the same time, one in each ear. The screen shows which ear to <b>attend</b> to.</p><p>Listen for a short, high <b>chirp</b> in the attended ear. Afterwards press <kbd>Y</kbd> (chirp in attended ear) or <kbd>N</kbd> (no chirp there), then say whether you heard a chirp in the <i>other</i> ear.</p><p class="note">With captions on, a caption describes the sounds playing. The task itself depends on hearing; if you cannot use audio, you can still read about the method and results.</p>',
  estimateMin: 4, practice: 2, fix: 600, iti: 700, timeout: 12000, background: '#a9b4bf', animated: true,
  response: { type: 'key', keys: ['y', 'n'], labels: { y: 'chirp in attended ear', n: 'no chirp there' } },
  factRefs: ['F-CHERRY'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 10 : 30);
    const pattern = ['attended', 'attended', 'unattended', 'unattended', 'absent'];
    const out = [];
    for (let i = 0; i < n; i++) {
      const ear = i % 2 ? 'left' : 'right', target = pattern[i % 5];
      const seq = () => Array.from({ length: DL_N }, () => rng.pick(DL_FREQS));
      const pos = rng.int(2, DL_N - 2);
      out.push({ condition: 'target_' + target, ear, target, pos, left: seq(), right: seq(), audio: true, dur: DL_N * DL_IOI + 300,
        correctResponse: target === 'attended' ? 'y' : 'n', stimulus: `attend=${ear};target=${target};pos=${pos}`,
        caption: `[Audio] Two different sequences of soft tones play at once, one in each ear. Attend to your ${ear} ear and listen for a short high chirp.`,
        followup: { prompt: 'Did you hear a chirp in the OTHER (unattended) ear?', choices: ['Yes', 'No'] } });
    }
    return rng.shuffle(out);
  },
  audio(t, audio) {
    const earPan = t.ear === 'left' ? -1 : 1;
    const chirpPan = t.target === 'attended' ? earPan : t.target === 'unattended' ? -earPan : 0;
    for (const side of ['left', 'right']) {
      const pan = side === 'left' ? -1 : 1, offset = side === 'left' ? 0 : DL_IOI / 2;
      t[side].forEach((freq, i) => {
        const when = offset + i * DL_IOI;
        if (chirpPan === pan && i === t.pos) {
          audio.tone({ freq: 1700, dur: 45, pan, gain: 0.22, type: 'sine', when });
          audio.tone({ freq: 2300, dur: 55, pan, gain: 0.22, type: 'sine', when: when + 45 });
        } else audio.tone({ freq, dur: DL_TONE, pan, gain: 0.2, type: 'triangle', when });
      });
    }
  },
  draw(ctx, t, W, H, el) {
    const cx = W / 2, cy = H * 0.5, R = Math.min(W, H) * 0.16;
    // head
    ctx.fillStyle = '#c98e64'; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.82, R, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2d1f17'; ctx.beginPath(); ctx.ellipse(cx, cy - R * 0.55, R * 0.8, R * 0.5, 0, Math.PI, Math.PI * 2); ctx.fill();
    // headband
    ctx.strokeStyle = '#30343b'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(cx, cy, R * 1.08, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    for (const side of ['left', 'right']) {
      const d = side === 'left' ? -1 : 1, att = side === t.ear;
      const x = cx + d * R * 0.98;
      if (att) { ctx.fillStyle = 'rgba(245,158,11,0.35)'; ctx.beginPath(); ctx.arc(x, cy, R * 0.55, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = att ? '#F59E0B' : '#5b6170'; rrect(ctx, x - R * 0.22, cy - R * 0.38, R * 0.44, R * 0.76, 12); ctx.fill();
      // equaliser bars: same schedule both ears (does not reveal the chirp)
      const offset = side === 'left' ? 0 : DL_IOI / 2;
      const i = Math.floor((el - offset) / DL_IOI), within = (el - offset) - i * DL_IOI;
      const on = el >= offset && i >= 0 && i < DL_N && within < DL_TONE;
      for (let b = 0; b < 4; b++) {
        const h = on ? R * (0.25 + 0.35 * Math.abs(Math.sin(b * 1.7 + i))) : R * 0.08;
        ctx.fillStyle = att ? '#7c4a03' : '#9aa1ad';
        const bx = x + d * (R * 0.4 + b * 12);
        ctx.fillRect(bx - 4, cy - h / 2, 8, h);
      }
    }
    // cue
    const ax = cx + (t.ear === 'left' ? -1 : 1) * R * 2.1;
    text(ctx, t.ear === 'left' ? '◀' : '▶', ax, cy, 54, '#b45309', 800);
    panel(ctx, cx - 190, H * 0.14 - 26, 380, 52, 'rgba(255,255,255,0.9)', 12);
    text(ctx, `Attend to your ${earName(t.ear)} ear`, cx, H * 0.14, 26, '#111', 800);
    text(ctx, el < t.dur ? 'Listening…' : '', cx, H * 0.82, 18, '#333', 600);
  },
  drawMask(ctx, t, W, H) { prompt(ctx, W, H, [`Chirp in your ${earName(t.ear)} (attended) ear?`, 'Y = yes     N = no']); },
  score(t, r) { return r == null ? false : mainOf(r) === t.correctResponse; },
  simulate(p, t, rng) {
    // Simulated effect size: good detection in the attended ear, little awareness of the unattended ear.
    const yes = rng.chance(t.target === 'attended' ? 0.86 : t.target === 'unattended' ? 0.12 : 0.06);
    setBot(t, rng.chance(t.target === 'unattended' ? 0.3 : 0.08) ? 'Yes' : 'No');
    return { response: yes ? 'y' : 'n', rt: t.dur + drawRT(p, rng, { mu: 650 }).rt };
  },
  analyse(rows) {
    const by = (c) => rows.filter((r) => r.condition === 'target_' + c && r.response !== '');
    const att = rate(by('attended'), (r) => mainOf(r.response) === 'y');
    const intr = rate(by('unattended'), (r) => mainOf(r.response) === 'y');
    const fa = rate(by('absent'), (r) => mainOf(r.response) === 'y');
    const unatt = by('unattended').filter((r) => parts(r.response).length > 1);
    const una = rate(unatt, (r) => parts(r.response)[1] === 'Yes');
    const lines = [
      `Attended ear — chirp detected: ${pc(att)}`,
      `Unattended ear — chirp reported in the other-ear question: ${unatt.length ? pc(una) : '— (no follow-up answers recorded)'}`,
      `Unattended chirps wrongly reported as attended-ear: ${pc(intr)}; false alarms with no chirp: ${pc(fa)}`,
      'Little is picked up from the unattended channel when attention is focused on the other ear (see fact F-CHERRY).',
    ];
    return { lines, stats: { attended: att, unattended: una, intrusion: intr, falseAlarm: fa },
      chart: (ch) => ch.bar([{ name: 'attended', value: fin(att) ? 100 * att : 0 }, { name: 'unattended', value: fin(una) ? 100 * una : 0 }, { name: 'false alarm', value: fin(fa) ? 100 * fa : 0 }], { label: 'Chirp detection by ear', yl: '% detected', yr: [0, 100] }) };
  },
});

// =====================================================================================
// 5. Inattentional blindness — plaza ball game with an unexpected tiger-costume walker (fact F-IB)
// =====================================================================================
const IB_DUR = 10000, IB_FLIGHT = 600;
const SKINS = ['#8d5a3b', '#c68a5e', '#a86f48', '#e0ac82', '#6f4429', '#b77c55'];
function ibPos(pl, ms) { const s = ms / 1000; return { x: pl.hx + pl.ax * Math.sin(pl.wx * s + pl.ph), y: pl.hy + pl.ay * Math.sin(pl.wy * s + pl.ph * 1.7) }; }
function ibBall(team, players, ms) {
  let holder = team.first, flying = null;
  for (const ps of team.passes) {
    if (ps.t0 > ms) break;
    if (ms < ps.t0 + IB_FLIGHT) { flying = ps; break; }
    holder = ps.to;
  }
  const hand = (i) => { const q = ibPos(players[i], ms); return { x: q.x + 0.018, y: q.y - 0.06 }; };
  if (!flying) return hand(holder);
  const a = hand(flying.from), b = hand(flying.to), u = (ms - flying.t0) / IB_FLIGHT;
  return { x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - 0.08 * Math.sin(Math.PI * u) };
}
function person(ctx, x, y, h, shirt, skin, step, outline) {
  const sw = Math.sin(step) * h * 0.08;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = h * 0.07;
  ctx.beginPath(); ctx.moveTo(x - h * 0.05, y - h * 0.38); ctx.lineTo(x - h * 0.06 + sw, y); ctx.moveTo(x + h * 0.05, y - h * 0.38); ctx.lineTo(x + h * 0.06 - sw, y); ctx.stroke();
  ctx.strokeStyle = skin; ctx.lineWidth = h * 0.055;
  ctx.beginPath(); ctx.moveTo(x - h * 0.12, y - h * 0.72); ctx.lineTo(x - h * 0.2, y - h * 0.48 - sw * 0.5); ctx.moveTo(x + h * 0.12, y - h * 0.72); ctx.lineTo(x + h * 0.2, y - h * 0.82); ctx.stroke();
  ctx.fillStyle = shirt; rrect(ctx, x - h * 0.14, y - h * 0.78, h * 0.28, h * 0.44, h * 0.08); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = outline; ctx.stroke();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y - h * 0.88, h * 0.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f1a17'; ctx.beginPath(); ctx.arc(x, y - h * 0.9, h * 0.1, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
}
function tiger(ctx, x, y, h, step, wave) {
  const sw = Math.sin(step) * h * 0.08, O = '#F28C28', K = '#1d1d1d';
  ctx.lineCap = 'round'; ctx.strokeStyle = O; ctx.lineWidth = h * 0.09;
  ctx.beginPath(); ctx.moveTo(x - h * 0.06, y - h * 0.38); ctx.lineTo(x - h * 0.07 + sw, y); ctx.moveTo(x + h * 0.06, y - h * 0.38); ctx.lineTo(x + h * 0.07 - sw, y); ctx.stroke();
  ctx.lineWidth = h * 0.035; ctx.beginPath(); ctx.moveTo(x + h * 0.14, y - h * 0.42); ctx.quadraticCurveTo(x + h * 0.38, y - h * 0.4, x + h * 0.32, y - h * 0.64); ctx.stroke();
  ctx.lineWidth = h * 0.075; ctx.beginPath(); ctx.moveTo(x - h * 0.14, y - h * 0.72); ctx.lineTo(x - h * 0.22, y - h * 0.46); ctx.moveTo(x + h * 0.14, y - h * 0.72);
  ctx.lineTo(x + h * 0.24, y - h * (wave ? 1.0 + 0.06 * Math.sin(step * 3) : 0.48)); ctx.stroke();
  ctx.fillStyle = O; rrect(ctx, x - h * 0.17, y - h * 0.8, h * 0.34, h * 0.48, h * 0.1); ctx.fill();
  ctx.strokeStyle = K; ctx.lineWidth = h * 0.025;
  for (let i = 0; i < 4; i++) { const yy = y - h * (0.74 - i * 0.1); ctx.beginPath(); ctx.moveTo(x - h * 0.16, yy); ctx.quadraticCurveTo(x - h * 0.05, yy + h * 0.03, x - h * 0.02, yy); ctx.moveTo(x + h * 0.16, yy); ctx.quadraticCurveTo(x + h * 0.05, yy + h * 0.03, x + h * 0.02, yy); ctx.stroke(); }
  ctx.fillStyle = '#fff7e6'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.6, h * 0.07, h * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  const hy = y - h * 0.93;
  ctx.fillStyle = O; for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(x + d * h * 0.1, hy - h * 0.1, h * 0.045, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, hy, h * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff7e6'; ctx.beginPath(); ctx.ellipse(x, hy + h * 0.05, h * 0.08, h * 0.055, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = K; for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(x + d * h * 0.05, hy - h * 0.025, h * 0.018, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.arc(x, hy + h * 0.03, h * 0.02, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = h * 0.018; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + d * h * 0.06, hy - h * 0.12); ctx.lineTo(x + d * h * 0.03, hy - h * 0.07); ctx.stroke(); }
}
function ibFigureX(ms) {
  if (ms < 3000 || ms > 8800) return null;
  if (ms < 5200) return 1.08 - (0.58 * (ms - 3000)) / 2200;
  if (ms < 6200) return 0.5;
  return 0.5 - (0.58 * (ms - 6200)) / 2600;
}
const inattentionalBlindness = Object.assign({}, TAGS, {
  id: 'inattentional_blindness', title: 'Inattentional blindness (plaza)', zone: 'mohalla',
  purpose: 'To see how closely you can follow a demanding counting task in a busy plaza scene.',
  instructions: '<p>Two teams pass a ball around in a plaza. One team wears <b>white</b> shirts, the other <b>black</b>.</p><p>Silently <b>count the passes made by the WHITE team</b> (ignore the black team). After each clip, type your count and press <kbd>Enter</kbd>. Sometimes you will be asked an extra question.</p>',
  estimateMin: 3, practice: 0, fix: 600, iti: 800, timeout: null, background: '#d8cfc0', animated: true,
  response: { type: 'text' },
  factRefs: ['F-IB'],
  deception: true,
  debrief: {
    deception: 'The instructions asked you only to count passes. They did not mention that on one clip a person in a bright tiger costume would walk right through the middle of the plaza and wave. We withheld this so we could test whether you would notice it.',
    purpose: 'This demonstrates inattentional blindness: when attention is absorbed by a demanding task, an unexpected object in plain view can go unnoticed. Compare the classic finding recorded in fact F-IB.',
    safeguards: 'Missing the figure says nothing about your eyesight, intelligence or carefulness — it is a normal property of selective attention. The deception was minimal and harmless, it was revealed immediately, and you may delete this run’s data now (APA Ethics Code 8.07, 8.08).',
  },
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 4 : 5);
    const out = [];
    for (let i = 0; i < n; i++) {
      const kind = i < 2 ? 'baseline' : i === 2 ? 'critical' : i % 2 ? 'aware' : 'baseline';
      const players = [];
      for (let k = 0; k < 6; k++) {
        const team = k < 3 ? 'white' : 'black';
        players.push({ team, hx: 0.14 + ((k * 0.37 + rng.uniform(0, 0.1)) % 0.72), hy: 0.32 + (k % 3) * 0.2 + rng.uniform(-0.05, 0.05), ax: rng.uniform(0.05, 0.11), ay: rng.uniform(0.03, 0.07),
          wx: rng.uniform(0.5, 1.1), wy: rng.uniform(0.6, 1.2), ph: rng.uniform(0, 6.28), skin: rng.pick(SKINS) });
      }
      const teams = {};
      for (const [team, idx] of [['white', [0, 1, 2]], ['black', [3, 4, 5]]]) {
        let holder = idx[0], tt = rng.uniform(400, 1100);
        const passes = [];
        while (tt < IB_DUR - 1000) { const to = rng.pick(idx.filter((j) => j !== holder)); passes.push({ t0: tt, from: holder, to }); holder = to; tt += rng.uniform(950, 1800); }
        teams[team] = { first: idx[0], passes };
      }
      const fig = kind === 'critical' || kind === 'aware';
      const passes = teams.white.passes.length;
      const t = { condition: kind, players, teams, figure: fig, passes, dur: IB_DUR, correctResponse: String(passes),
        prompt: 'How many passes did the WHITE team make?', stimulus: `clip${i + 1};passes=${passes};figure=${fig ? 'tiger' : 'none'}` };
      if (fig) t.followup = { prompt: 'Did you notice anything unusual in that clip?', choices: ['Yes', 'No'] };
      out.push(t);
    }
    return out;
  },
  draw(ctx, t, W, H, el) {
    const ms = Math.max(0, Math.min(IB_DUR, el));
    // back wall with arches
    ctx.fillStyle = '#c4ae8d'; ctx.fillRect(0, 0, W, H * 0.24);
    ctx.fillStyle = '#9c8466';
    for (let i = 0; i < 7; i++) { const ax = (i + 0.5) * (W / 7); rrect(ctx, ax - W * 0.035, H * 0.07, W * 0.07, H * 0.17, W * 0.035); ctx.fill(); }
    ctx.fillStyle = '#b39a77'; ctx.fillRect(0, H * 0.235, W, H * 0.015);
    ctx.strokeStyle = 'rgba(120,100,80,0.25)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { ctx.beginPath(); ctx.moveTo(W / 2 + (i - 6) * W * 0.04, H * 0.25); ctx.lineTo(W / 2 + (i - 6) * W * 0.16, H); ctx.stroke(); }
    for (let j = 0; j < 6; j++) { const yy = H * 0.25 + (H * 0.75) * Math.pow(j / 6, 1.4); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
    const X = (x) => W * 0.06 + x * W * 0.88, Y = (y) => H * 0.22 + y * H * 0.72;
    const ents = t.players.map((pl, i) => { const q = ibPos(pl, ms); return { y: q.y, fn: () => { const hh = H * 0.26 * (0.8 + 0.35 * q.y); const white = pl.team === 'white'; person(ctx, X(q.x), Y(q.y), hh, white ? '#fbfbf8' : '#17171b', pl.skin, ms / 160 + i, white ? '#8a8a8a' : '#000'); } }; });
    const fx = t.figure ? ibFigureX(ms) : null;
    if (fx != null) ents.push({ y: 0.55, fn: () => tiger(ctx, X(fx), Y(0.55), H * 0.26 * (0.8 + 0.35 * 0.55), ms < 5200 || ms > 6200 ? ms / 170 : 0, ms >= 5200 && ms <= 6200) });
    ents.sort((a, b) => a.y - b.y).forEach((e) => e.fn());
    for (const team of ['white', 'black']) {
      const b = ibBall(t.teams[team], t.players, ms);
      ctx.fillStyle = '#c0571b'; ctx.beginPath(); ctx.arc(X(b.x), Y(b.y), H * 0.016, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#4a1f08'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    text(ctx, 'Count the WHITE team’s passes', W / 2, H * 0.035, 18, '#3a2c1c', 700);
  },
  drawMask(ctx, t, W, H) { ctx.fillStyle = 'rgba(40,30,20,0.35)'; ctx.fillRect(0, 0, W, H); prompt(ctx, W, H, ['How many passes did the WHITE team make?', 'Type a number and press Enter']); },
  score(t, r) { const v = parseInt(mainOf(r).replace(/[^0-9]/g, ''), 10); return fin(v) ? v === t.passes : false; },
  simulate(p, t, rng) {
    // Simulated effect size: roughly half miss the figure while counting; nearly all notice once aware.
    const err = rng.chance(0.6) ? 0 : rng.pick([-2, -1, -1, 1]);
    if (t.followup) setBot(t, rng.chance(t.condition === 'critical' ? 0.45 : 0.92) ? 'Yes' : 'No');
    return { response: String(Math.max(0, t.passes + err)), rt: t.dur + drawRT(p, rng, { mu: 2200 }).rt };
  },
  analyse(rows) {
    const counted = rows.filter((r) => r.response !== '');
    const absErr = counted.map((r) => { const v = parseInt(mainOf(r.response).replace(/[^0-9]/g, ''), 10); const tr = +field(r.stimulus, 'passes'); return fin(v) && fin(tr) ? Math.abs(v - tr) : NaN; }).filter(fin);
    const noticed = (c) => { const sub = rows.filter((r) => r.condition === c && parts(r.response).length > 1); return { n: sub.length, p: rate(sub, (r) => parts(r.response)[1] === 'Yes') }; };
    const crit = noticed('critical'), aware = noticed('aware');
    const lines = [
      `Counting: ${pc(rate(rows, isOk))} of clips exactly right; mean absolute error ${fin(avg(absErr)) ? avg(absErr).toFixed(2) : '—'} passes.`,
      crit.n ? `Critical clip (first appearance of the tiger-costume walker): noticed ${crit.n === 1 ? (crit.p ? 'YES' : 'NO') : pc(crit.p)}` : 'Critical clip: no "anything unusual?" answer recorded.',
      aware.n ? `Later clips (after the question had alerted you): noticed ${pc(aware.p)}` : 'Later clips: no answers recorded.',
      'Whatever you saw is normal: an engaging task can make an unexpected event invisible. Compare the classic result in fact F-IB.',
    ];
    return { lines, stats: { countAccuracy: rate(rows, isOk), noticedCritical: crit.p, noticedAware: aware.p },
      chart: (ch) => ch.bar([{ name: 'critical clip', value: fin(crit.p) ? 100 * crit.p : 0 }, { name: 'after alert', value: fin(aware.p) ? 100 * aware.p : 0 }], { label: 'Noticed the unexpected figure', yl: '% "Yes"', yr: [0, 100] }) };
  },
});

// =====================================================================================
// 6. Change blindness — flicker 280 ms image / 60 ms grey blank (≈2.9 transitions per s), photosafe static version
// =====================================================================================
const CB_IMG = 280, CB_BLANK = 60, CB_CYCLE = 2 * (CB_IMG + CB_BLANK), CB_GREY = '#8c8c8c';
const CB_PAL = ['#b5524a', '#4f7fae', '#d1a54a', '#6f9a5a', '#8a6aa8', '#c97f3c', '#5f8f95'];
const CB = {
  sun: { label: 'Sun', x: 0.86, y: 0.16, s: 0.06, draw(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, s, 0, Math.PI * 2); c.fill(); c.strokeStyle = col; c.lineWidth = s * 0.15; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; c.beginPath(); c.moveTo(x + Math.cos(a) * s * 1.3, y + Math.sin(a) * s * 1.3); c.lineTo(x + Math.cos(a) * s * 1.7, y + Math.sin(a) * s * 1.7); c.stroke(); } } },
  cloud: { label: 'Cloud', x: 0.3, y: 0.15, s: 0.05, draw(c, x, y, s, col) { c.fillStyle = col; for (const [dx, dy, r] of [[-1.2, 0.2, 0.8], [0, -0.2, 1.1], [1.2, 0.2, 0.8]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); c.fill(); } } },
  kite: { label: 'Kite', x: 0.6, y: 0.2, s: 0.05, draw(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y); c.lineTo(x, y + s * 1.2); c.lineTo(x - s * 0.7, y); c.closePath(); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y + s * 1.2); c.quadraticCurveTo(x + s, y + s * 2.4, x - s * 0.3, y + s * 3.4); c.stroke(); } },
  bird: { label: 'Bird', x: 0.74, y: 0.3, s: 0.03, draw(c, x, y, s, col) { c.strokeStyle = col; c.lineWidth = s * 0.35; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s * 1.4, y - s * 0.4); c.quadraticCurveTo(x - s * 0.6, y - s, x, y); c.quadraticCurveTo(x + s * 0.6, y - s, x + s * 1.4, y - s * 0.4); c.stroke(); } },
  house: { label: 'House', x: 0.2, y: 0.56, s: 0.1, draw(c, x, y, s, col) { c.fillStyle = col; c.fillRect(x - s, y - s * 0.6, s * 2, s * 1.4); c.fillStyle = '#6d4c41'; c.beginPath(); c.moveTo(x - s * 1.2, y - s * 0.6); c.lineTo(x, y - s * 1.5); c.lineTo(x + s * 1.2, y - s * 0.6); c.closePath(); c.fill(); c.fillStyle = '#5a4636'; c.fillRect(x - s * 0.22, y + s * 0.2, s * 0.44, s * 0.6); c.fillStyle = '#dfe8ea'; c.fillRect(x + s * 0.4, y - s * 0.3, s * 0.4, s * 0.35); c.fillRect(x - s * 0.8, y - s * 0.3, s * 0.4, s * 0.35); } },
  tree: { label: 'Tree', x: 0.44, y: 0.5, s: 0.08, draw(c, x, y, s, col) { c.fillStyle = '#7a5a3c'; c.fillRect(x - s * 0.15, y, s * 0.3, s * 1.2); c.fillStyle = col; c.beginPath(); c.arc(x, y - s * 0.2, s * 0.8, 0, Math.PI * 2); c.arc(x - s * 0.5, y + s * 0.15, s * 0.55, 0, Math.PI * 2); c.arc(x + s * 0.5, y + s * 0.15, s * 0.55, 0, Math.PI * 2); c.fill(); } },
  lamp: { label: 'Street lamp', x: 0.62, y: 0.55, s: 0.09, draw(c, x, y, s, col) { c.fillStyle = '#44484f'; c.fillRect(x - s * 0.06, y - s, s * 0.12, s * 2); c.fillStyle = col; rrect(c, x - s * 0.25, y - s * 1.3, s * 0.5, s * 0.35, s * 0.1); c.fill(); } },
  bench: { label: 'Bench', x: 0.78, y: 0.72, s: 0.07, draw(c, x, y, s, col) { c.fillStyle = col; c.fillRect(x - s * 1.2, y - s * 0.5, s * 2.4, s * 0.25); c.fillRect(x - s * 1.2, y - s * 0.05, s * 2.4, s * 0.22); c.fillStyle = '#3e3e44'; c.fillRect(x - s, y + s * 0.15, s * 0.15, s * 0.5); c.fillRect(x + s * 0.85, y + s * 0.15, s * 0.15, s * 0.5); } },
  car: { label: 'Car', x: 0.42, y: 0.83, s: 0.07, draw(c, x, y, s, col) { c.fillStyle = col; rrect(c, x - s * 1.6, y - s * 0.45, s * 3.2, s * 0.7, s * 0.2); c.fill(); rrect(c, x - s * 0.9, y - s * 0.95, s * 1.7, s * 0.6, s * 0.25); c.fill(); c.fillStyle = '#d8e4ea'; c.fillRect(x - s * 0.7, y - s * 0.85, s * 0.6, s * 0.4); c.fillRect(x + s * 0.05, y - s * 0.85, s * 0.6, s * 0.4); c.fillStyle = '#23252a'; for (const d of [-1, 1]) { c.beginPath(); c.arc(x + d * s, y + s * 0.3, s * 0.3, 0, Math.PI * 2); c.fill(); } } },
  dog: { label: 'Dog', x: 0.14, y: 0.86, s: 0.04, draw(c, x, y, s, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, s * 1.3, s * 0.65, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x + s * 1.3, y - s * 0.6, s * 0.55, 0, Math.PI * 2); c.fill(); c.fillRect(x - s, y, s * 0.3, s * 1.1); c.fillRect(x + s * 0.7, y, s * 0.3, s * 1.1); c.strokeStyle = col; c.lineWidth = s * 0.25; c.beginPath(); c.moveTo(x - s * 1.2, y - s * 0.2); c.lineTo(x - s * 1.8, y - s * 0.9); c.stroke(); } },
};
const CB_KEYS = Object.keys(CB), CB_TYPES = ['colour', 'presence', 'position'];
function cbScene(ctx, t, x0, y0, w, h, version) {
  const sky = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.62);
  sky.addColorStop(0, '#9fb7c6'); sky.addColorStop(1, '#c3cfd3');
  ctx.fillStyle = sky; ctx.fillRect(x0, y0, w, h * 0.62);
  ctx.fillStyle = '#93a67f'; ctx.fillRect(x0, y0 + h * 0.62, w, h * 0.38);
  ctx.fillStyle = '#b9ad94'; ctx.beginPath(); ctx.moveTo(x0 + w * 0.5, y0 + h * 0.62); ctx.lineTo(x0 + w * 0.62, y0 + h * 0.62); ctx.lineTo(x0 + w * 0.9, y0 + h); ctx.lineTo(x0 + w * 0.3, y0 + h); ctx.closePath(); ctx.fill();
  const u = Math.min(w, h * 1.6);
  for (const o of t.objects) {
    const isT = version === 'B' && o.key === t.target;
    if (isT && t.change === 'presence') continue;
    const x = x0 + (isT && t.change === 'position' ? o.xB : o.x) * w, y = y0 + o.y * h;
    CB[o.key].draw(ctx, x, y, CB[o.key].s * u, isT && t.change === 'colour' ? o.colB : o.col);
  }
}
const changeBlindness = Object.assign({}, TAGS, {
  id: 'change_blindness', title: 'Change blindness (photosafe)',
  purpose: 'To measure how long it takes to spot a change between two versions of a scene when a brief blank hides the moment of change.',
  instructions: '<p>Two versions of a street scene alternate, separated by a brief grey blank. One object differs between them (its colour, its position, or whether it is there at all).</p><p>As soon as you spot the change, press the number key (<kbd>1</kbd>–<kbd>4</kbd>) or click the button naming the object that changes.</p><p class="note">Flicker: about 2.9 image changes per second at reduced contrast (below the WCAG three-flash limit, fact F-WCAG). In photosafe mode both versions are shown side by side with no flicker.</p>',
  estimateMin: 4, practice: 1, fix: 500, iti: 600, timeout: 45000, background: CB_GREY, animated: true, photosensitive: true,
  response: { type: 'choice' },
  factRefs: ['F-WCAG'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 6 : 15);
    const mode = opts.photosafe ? 'static' : 'flicker';
    const out = [];
    for (let i = 0; i < n; i++) {
      const change = CB_TYPES[i % 3];
      const target = rng.pick(change === 'position' ? CB_KEYS.filter((k) => !['sun', 'cloud'].includes(k)) : CB_KEYS);
      const objects = CB_KEYS.map((key) => {
        const col = key === 'sun' ? rng.pick(['#e8c25a', '#e3a94e']) : key === 'cloud' ? rng.pick(['#eef1f3', '#dfe3e6']) : rng.pick(CB_PAL);
        const x = CB[key].x + rng.uniform(-0.025, 0.025);
        return { key, x, y: CB[key].y + rng.uniform(-0.02, 0.02), col, colB: rng.pick(CB_PAL.filter((c) => c !== col)), xB: x + (x > 0.5 ? -1 : 1) * rng.uniform(0.07, 0.1) };
      });
      const others = rng.shuffle(CB_KEYS.filter((k) => k !== target)).slice(0, 3);
      const choices = rng.shuffle([target].concat(others)).map((k) => ({ value: k, label: CB[k].label }));
      out.push({ condition: change, change, target, objects, choices, photosafe: !!opts.photosafe, correctResponse: target, stimulus: `${target}:${change}:${mode}` });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H, el, state) {
    const safe = !!((state && state.photosafe) || t.photosafe);
    if (safe) {
      const w = W * 0.44, h = Math.min(H * 0.62, w * 0.66), y0 = H * 0.1;
      [['A', W * 0.04], ['B', W * 0.52]].forEach(([v, x0]) => { cbScene(ctx, t, x0, y0, w, h, v); text(ctx, 'Version ' + v, x0 + w / 2, y0 + h + 22, 18, '#111', 700); });
      text(ctx, 'Static (photosafe) view — which object differs?', W / 2, H * 0.05, 18, '#111', 700);
      return;
    }
    const w = W * 0.8, h = Math.min(H * 0.72, w * 0.62), x0 = (W - w) / 2, y0 = H * 0.06;
    const ph = ((el % CB_CYCLE) + CB_CYCLE) % CB_CYCLE;
    if (ph < CB_IMG) cbScene(ctx, t, x0, y0, w, h, 'A');
    else if (ph >= CB_IMG + CB_BLANK && ph < 2 * CB_IMG + CB_BLANK) cbScene(ctx, t, x0, y0, w, h, 'B');
    else { ctx.fillStyle = CB_GREY; ctx.fillRect(x0, y0, w, h); }
  },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng, state) {
    // Simulated effect size: presence changes found fastest, position changes slowest; static view faster.
    const safe = !!((state && state.photosafe) || t.photosafe);
    const base = (safe ? 2600 : 5200) + (t.change === 'presence' ? -1200 : t.change === 'position' ? 900 : 0);
    const rt = Math.max(900, base + rng.exponential(2200) + p.speed * 5);
    const ok = drawCorrect(p, rng, 0.6);
    return { response: ok ? t.target : rng.pick(t.choices.map((c) => c.value).filter((v) => v !== t.target)), rt };
  },
  analyse(rows) {
    const acc = rate(rows, isOk);
    const mode = rows.length ? (String(rows[0].stimulus).split(':')[2] || '—') : '—';
    const med = (xs) => (xs.length ? S.quantile(xs, 0.5) : NaN);
    const by = CB_TYPES.map((c) => ({ name: c, value: med(rtOf(rows.filter((r) => r.condition === c))) / 1000 }));
    const lines = [
      `Mode: ${mode}. Correct object identified on ${pc(acc)} of scenes.`,
      'Median time to detect (correct trials): ' + by.map((b) => `${b.name} ${fin(b.value) ? b.value.toFixed(1) + ' s' : '—'}`).join(', '),
      'Changes that would be obvious side by side can take seconds to find when a blank masks the moment of change, because spotting them needs focused attention on the right object.',
    ];
    return { lines, stats: { accuracy: acc, mode }, chart: (ch) => ch.bar(by.map((b) => ({ name: b.name, value: fin(b.value) ? b.value : 0 })), { label: 'Time to detect the change', yl: 'seconds (median)' }) };
  },
});

module.exports = [visualSearch, posner, attnBlink, dichotic, inattentionalBlindness, changeBlindness];
