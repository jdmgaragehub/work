'use strict';
/**
 * Memory paradigms (A8): serial position, Brown–Peterson, levels of processing, DRM, misinformation,
 * 2-back, memory palace (method of loci). Contract: docs/EXPERIMENT_API.md.
 * Pure apart from drawing on a passed 2D context. All word lists and scenes are original.
 * Bot effects marked "Simulated effect size" are teaching values, not results from a study.
 */
const S = require('../../psych/stats.js');
const sdt = require('../../psych/sdt.js');
const PP = require('../../psych/psychophysics.js');
const { apa } = require('../../core/format.js');
const { drawRT, drawCorrect } = require('../../psych/participants.js');

const TAGS = { week: 9, panel: 'memory', zone: 'library', apa: '2.1', domain: 'Cog', hec: 'S3 Cognitive Psychology' };

// ---------- shared helpers ----------
const text = (ctx, s, x, y, size = 32, color = '#111', weight = 700, align = 'center') => {
  ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y);
};
const rrect = (ctx, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};
const panel = (ctx, x, y, w, h, fill = 'rgba(255,255,255,0.9)', r = 14) => { ctx.fillStyle = fill; rrect(ctx, x, y, w, h, r); ctx.fill(); };
const card = (ctx, W, H, word, sub, color = '#14213d') => {
  const w = Math.min(W * 0.6, 460), h = 150;
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; rrect(ctx, W / 2 - w / 2 + 4, H / 2 - h / 2 + 6, w, h, 18); ctx.fill();
  panel(ctx, W / 2 - w / 2, H / 2 - h / 2, w, h, '#fbf8f1', 18);
  text(ctx, word, W / 2, H / 2 + (sub ? -10 : 0), 54, color, 800);
  if (sub) text(ctx, sub, W / 2, H / 2 + 46, 16, '#666', 600);
};
const prompt = (ctx, W, H, lines) => {
  panel(ctx, W * 0.12, H * 0.34, W * 0.76, H * 0.3, 'rgba(255,255,255,0.94)');
  lines.forEach((l, i) => text(ctx, l, W / 2, H * 0.43 + i * 36, i ? 20 : 28, i ? '#333' : '#111', i ? 600 : 800));
};
const dots = (ctx, W, H, n, cur) => { for (let i = 0; i < n; i++) { ctx.fillStyle = i < cur ? '#2a6f97' : i === cur ? '#f4a261' : 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(W / 2 + (i - (n - 1) / 2) * 18, H * 0.82, 5, 0, Math.PI * 2); ctx.fill(); } };
const avg = (xs) => (xs.length ? S.mean(xs) : NaN);
const fin = (v) => Number.isFinite(v);
const f1 = (v) => (fin(v) ? v.toFixed(1) : '—');
const pc = (v) => (fin(v) ? (100 * v).toFixed(0) + '%' : '—');
const isOk = (r) => String(r.correct) === '1';
const parts = (resp) => String(resp == null ? '' : resp).split('|');
const mainOf = (resp) => parts(resp)[0];
const rate = (rows, pred) => (rows.length ? rows.filter(pred).length / rows.length : NaN);
const setBot = (t, a) => { if (t.followup) t.followup.botAnswer = a; return a; };
const uniq = (xs) => Array.from(new Set(xs));
/** Draw `k` items from a pool without repeats until the pool is used up, then recycle (only for very long runs). */
function dealer(rng, pool) { let deck = []; return () => { if (!deck.length) deck = rng.shuffle(pool.slice()); return deck.pop(); }; }

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
/** Score free recall: boolean per studied word (case-insensitive; one typo allowed for words ≥ 5 letters). */
function matchRecall(words, response) {
  const toks = String(response || '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const used = new Set();
  return words.map((w) => {
    w = w.toLowerCase();
    const i = toks.findIndex((t, k) => !used.has(k) && (t === w || (w.length >= 5 && lev(t, w) <= 1)));
    if (i >= 0) { used.add(i); return true; }
    return false;
  });
}
/** Inline seeded PRNG for labelled "Simulated data" class comparisons inside analyse (no rng module required). */
function prng(seed) {
  let a = seed >>> 0;
  const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { u, normal: (m, s) => m + s * Math.sqrt(-2 * Math.log(1 - u())) * Math.cos(2 * Math.PI * u()) };
}

// Original pool of common concrete English nouns.
const NOUNS = uniq(('apple river candle garden pillow window bottle ladder button carpet kitten rocket basket hammer jacket pencil wallet mirror guitar tomato rabbit bridge camera forest island lemon market needle onion parrot pocket saddle spider teapot tunnel violin wagon zipper anchor banana cactus dolphin engine feather glove helmet jungle kettle lantern magnet napkin orange peacock quilt radio sandal ticket umbrella valley walnut bucket cabin desert falcon giraffe harbour jigsaw lizard meadow oyster puppet rainbow statue tractor trumpet village whistle butter cherry crayon dragon eagle fence honey insect jelly lobster monkey notebook ocean pepper pumpkin robot salmon scooter shovel sofa tiger towel turtle wheel sugar mango cotton saucer blanket chimney compass curtain diamond fountain hammock ladle marble mitten paddle pebble planet ribbon slipper sponge thimble tulip vase whale brick drum flag fork frog grape horse lamp leaf mouse nail owl pear ring rope sock spoon star tent train truck').split(' '));

// =====================================================================================
// 1. Serial position free recall (fact F-GLANZER)
// =====================================================================================
const SP_LEN = 12, SP_ON = 1000;
const serialPosition = Object.assign({}, TAGS, {
  id: 'serial_position', title: 'Serial position free recall',
  purpose: 'To see how the position of a word in a list affects how likely you are to remember it (primacy and recency).',
  instructions: `<p>You will see lists of ${SP_LEN} words, one at a time (one per second). After each list, <b>type every word you remember</b>, in any order, separated by spaces, then press <kbd>Enter</kbd>.</p><p>Spelling does not need to be perfect.</p>`,
  estimateMin: 6, practice: 0, fix: 800, iti: 800, timeout: null, background: '#e9e4d8', animated: true,
  response: { type: 'text' },
  factRefs: ['F-GLANZER'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 6 : 8);
    const deal = dealer(rng, NOUNS);
    const out = [];
    for (let i = 0; i < n; i++) {
      const words = []; while (words.length < SP_LEN) { const w = deal(); if (!words.includes(w)) words.push(w); }
      out.push({ condition: 'immediate', words, dur: SP_LEN * SP_ON, prompt: 'Type all the words you remember, separated by spaces', stimulus: words.join(' ') });
    }
    return out;
  },
  draw(ctx, t, W, H, el) {
    const i = Math.floor(Math.max(0, el) / SP_ON), within = el - i * SP_ON;
    text(ctx, `List of ${SP_LEN} words — remember as many as you can`, W / 2, H * 0.12, 18, '#5b4a2f', 700);
    if (i < t.words.length && within < SP_ON * 0.82) card(ctx, W, H, t.words[i]);
    dots(ctx, W, H, t.words.length, Math.min(i, t.words.length));
  },
  drawMask(ctx, t, W, H) { prompt(ctx, W, H, ['Recall time', 'Type every word you remember, in any order']); },
  score() { return null; },
  simulate(p, t, rng) {
    // Simulated effect size: U-shaped recall — primacy (rehearsal) and recency (still in short-term memory).
    const L = t.words.length, bonus = p.ability * 0.05;
    const recalled = t.words.map((w, i) => ({ w, i })).filter(({ i }) => rng.chance(Math.min(0.97, 0.28 + bonus + 0.42 * Math.exp(-i / 1.6) + 0.6 * Math.exp(-(L - 1 - i) / 1.3))));
    const order = recalled.filter((r) => r.i >= L - 4).reverse().concat(recalled.filter((r) => r.i < L - 4));
    return { response: order.map((r) => r.w).join(' '), rt: t.dur + drawRT(p, rng, { mu: 9000 }).rt };
  },
  analyse(rows) {
    const lists = rows.filter((r) => r.stimulus).map((r) => matchRecall(String(r.stimulus).split(' '), r.response)).filter((l) => l.length === SP_LEN);
    if (!lists.length) return { lines: ['No lists completed yet.'], stats: {} };
    const sp = PP.serialPosition(lists);
    const total = avg(lists.map((l) => l.filter(Boolean).length));
    const lines = [
      `Lists: ${lists.length}. Mean words recalled per list: ${f1(total)} of ${SP_LEN}.`,
      `Primacy (positions 1–3): ${sp.primacy.toFixed(0)}%, middle (4–${SP_LEN - 3}): ${sp.middle.toFixed(0)}%, recency (last 3): ${sp.recency.toFixed(0)}%.`,
      'By position: ' + sp.pct.map((v, i) => `${i + 1}:${v.toFixed(0)}`).join(' '),
      'A U-shape — better recall at the start and end — is the serial-position effect. A filled delay before recall tends to remove the recency part (see fact F-GLANZER).',
    ];
    return { lines, stats: { pct: sp.pct, primacy: sp.primacy, middle: sp.middle, recency: sp.recency }, chart: (ch) => ch.serialPosition(sp.pct, { label: 'Your serial-position curve' }) };
  },
});

// =====================================================================================
// 2. Brown–Peterson distractor task (facts F-BP, F-BP-RATES)
// =====================================================================================
const BP_CONS = 'BCDFGHJKLMNPQRSTVWXZ'.split(''), BP_SHOW = 1500, BP_DELAYS = [3, 9, 18];
const BP_BAD = ['BBC', 'CNN', 'FBI', 'DVD', 'PDF', 'KFC', 'NHS', 'USB', 'PTV', 'PSL', 'PTI', 'PML', 'GPS', 'HBO', 'NBC', 'CBS', 'MTV', 'LCD', 'DNA', 'RNA', 'BMW', 'TNT', 'SMS', 'JPG', 'PNG', 'GDP', 'CPR', 'KPK', 'HTML', 'LOL', 'XYZ', 'MRI', 'CCTV', 'NGO', 'VIP'];
const lettersOf = (s) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
const brownPeterson = Object.assign({}, TAGS, {
  id: 'brown_peterson', title: 'Brown–Peterson distractor',
  purpose: 'To measure how quickly a few letters are forgotten when rehearsal is blocked by a distracting counting task.',
  instructions: '<p>Three consonants appear briefly — remember them. Then a number appears: <b>count backwards by 3s out loud</b> from that number (e.g. 487, 484, 481…) until the screen asks for the letters.</p><p>Type the three letters in order and press <kbd>Enter</kbd>.</p>',
  estimateMin: 5, practice: 1, fix: 600, iti: 800, timeout: null, background: '#e3e8ee', animated: true,
  response: { type: 'text' },
  factRefs: ['F-BP', 'F-BP-RATES'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 6 : 15);
    const out = [];
    for (let i = 0; i < n; i++) {
      const delay = BP_DELAYS[i % 3];
      let tri;
      do tri = rng.shuffle(BP_CONS.slice()).slice(0, 3).join(''); while (BP_BAD.includes(tri));
      const start = rng.int(201, 989);
      out.push({ condition: 'delay_' + delay, delay, trigram: tri, start, dur: BP_SHOW + delay * 1000, correctResponse: tri,
        prompt: 'Type the three letters in order', stimulus: `${tri};start=${start};delay=${delay}s` });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H, el) {
    if (el < BP_SHOW) { text(ctx, 'Remember these letters', W / 2, H * 0.24, 20, '#334', 700); card(ctx, W, H, t.trigram.split('').join(' '), null, '#1d3557'); return; }
    const left = Math.max(0, t.dur - el) / (t.delay * 1000);
    text(ctx, 'Count backwards by 3s out loud from', W / 2, H * 0.26, 22, '#334', 700);
    card(ctx, W, H, String(t.start), 'e.g. ' + t.start + ', ' + (t.start - 3) + ', ' + (t.start - 6) + ' …', '#7f2b1c');
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(W / 2, H * 0.8, 26, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#2a6f97'; ctx.beginPath(); ctx.arc(W / 2, H * 0.8, 26, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * left); ctx.stroke();
  },
  drawMask(ctx, t, W, H) { prompt(ctx, W, H, ['Stop counting', 'Type the three letters in order']); },
  score(t, r) { return lettersOf(r) === t.trigram; },
  simulate(p, t, rng) {
    // Simulated effect size: steep forgetting over the first 18 s when rehearsal is prevented.
    const pr = { 3: 0.8, 9: 0.42, 18: 0.18 }[t.delay];
    let resp = t.trigram.split('');
    if (!rng.chance(Math.min(0.97, pr + p.ability * 0.04))) {
      const k = rng.int(0, 2); resp[k] = rng.pick(BP_CONS.filter((c) => !t.trigram.includes(c)));
      if (rng.chance(0.4)) resp = [resp[1], resp[0], resp[2]];
    }
    return { response: resp.join(''), rt: t.dur + drawRT(p, rng, { mu: 2200 }).rt };
  },
  analyse(rows) {
    const pts = [], ptsL = [], stats = {};
    for (const d of BP_DELAYS) {
      const sub = rows.filter((r) => r.condition === 'delay_' + d);
      const whole = rate(sub, isOk);
      const letters = avg(sub.map((r) => { const tri = String(r.stimulus).slice(0, 3), g = lettersOf(r.response); return [0, 1, 2].filter((k) => g[k] === tri[k]).length / 3; }));
      stats['delay_' + d] = whole; stats['letters_' + d] = letters;
      if (fin(whole)) pts.push({ x: d, y: 100 * whole });
      if (fin(letters)) ptsL.push({ x: d, y: 100 * letters });
    }
    const lines = [
      'Trigram recalled perfectly (in order): ' + BP_DELAYS.map((d) => `${d} s ${pc(stats['delay_' + d])}`).join(', '),
      'Letters in the correct position: ' + BP_DELAYS.map((d) => `${d} s ${pc(stats['letters_' + d])}`).join(', '),
      'Recall typically falls as the counting delay grows. Whether this reflects decay or interference from earlier trials is debated — compare facts F-BP and F-BP-RATES.',
    ];
    return { lines, stats, chart: (ch) => ch.line([{ name: 'whole trigram', points: pts, dots: true }, { name: 'letters in position', points: ptsL, dots: true, dash: true }], { label: 'Recall by distractor delay', xl: 'delay (s)', yl: '% correct', yr: [0, 100] }) };
  },
});

// =====================================================================================
// 3. Levels of processing (fact F-CRAIK) — incidental study, surprise recognition test
// =====================================================================================
// [word, category, rhymes-with]
const LOP = [
  ['cat', 'an animal', 'mat'], ['dog', 'an animal', 'fog'], ['bear', 'an animal', 'stair'], ['mouse', 'an animal', 'blouse'], ['fox', 'an animal', 'socks'],
  ['hen', 'an animal', 'ten'], ['snake', 'an animal', 'lake'], ['frog', 'an animal', 'jog'], ['bee', 'an animal', 'knee'], ['deer', 'an animal', 'clear'],
  ['whale', 'an animal', 'sail'], ['duck', 'an animal', 'luck'], ['goat', 'an animal', 'note'], ['crab', 'an animal', 'grab'],
  ['bread', 'a food', 'thread'], ['rice', 'a food', 'dice'], ['cheese', 'a food', 'breeze'], ['plum', 'a food', 'thumb'], ['pear', 'a food', 'square'],
  ['bean', 'a food', 'screen'], ['cake', 'a food', 'shake'], ['pie', 'a food', 'tie'], ['peach', 'a food', 'beach'], ['corn', 'a food', 'horn'], ['nut', 'a food', 'shut'], ['egg', 'a food', 'peg'],
  ['spoon', 'a household object', 'moon'], ['knife', 'a household object', 'life'], ['lamp', 'a household object', 'camp'], ['clock', 'a household object', 'dock'], ['bell', 'a household object', 'well'],
  ['brush', 'a household object', 'rush'], ['plate', 'a household object', 'gate'], ['cup', 'a household object', 'pup'], ['broom', 'a household object', 'room'], ['bowl', 'a household object', 'goal'], ['fan', 'a household object', 'van'],
  ['coat', 'an item of clothing', 'boat'], ['shoe', 'an item of clothing', 'glue'], ['shirt', 'an item of clothing', 'dirt'], ['glove', 'an item of clothing', 'dove'], ['belt', 'an item of clothing', 'felt'],
  ['cap', 'an item of clothing', 'map'], ['dress', 'an item of clothing', 'chess'], ['boot', 'an item of clothing', 'fruit'], ['sock', 'an item of clothing', 'lock'],
  ['tree', 'part of nature', 'sea'], ['stone', 'part of nature', 'phone'], ['leaf', 'part of nature', 'thief'], ['sand', 'part of nature', 'hand'], ['hill', 'part of nature', 'mill'],
  ['cloud', 'part of nature', 'loud'], ['rain', 'part of nature', 'train'], ['star', 'part of nature', 'car'], ['wave', 'part of nature', 'cave'], ['moss', 'part of nature', 'boss'],
];
const LOP_PRACTICE = [['ship', 'a vehicle', 'lip'], ['sofa', 'a household object', 'cola'], ['lion', 'an animal', 'iron']];
const LOP_LEVELS = ['structural', 'phonemic', 'semantic'];
const rhymeEnd = (w) => w.replace(/^[^aeiou]*/, '');
function lopQuestion(rng, e, level, yes) {
  const [w, cat, rh] = e;
  if (level === 'structural') return { q: 'Is the word written in CAPITAL letters?', shown: yes ? w.toUpperCase() : w };
  if (level === 'phonemic') {
    const no = rng.pick(LOP.map((x) => x[2]).filter((r) => rhymeEnd(r).slice(-2) !== rhymeEnd(w).slice(-2) && rhymeEnd(r).slice(-2) !== rhymeEnd(rh).slice(-2)));
    return { q: `Does the word rhyme with "${yes ? rh : no}"?`, shown: w };
  }
  const cats = uniq(LOP.map((x) => x[1]));
  return { q: `Is it ${yes ? cat : rng.pick(cats.filter((c) => c !== cat))}?`, shown: w };
}
const levelsProcessing = Object.assign({}, TAGS, {
  id: 'levels_processing', title: 'Levels of processing',
  purpose: 'To find out whether the kind of judgement you make about a word changes how well you remember it later.',
  instructions: '<p>Each screen shows a question and a word. Answer the question about the word: <kbd>Y</kbd> = yes, <kbd>N</kbd> = no. Respond quickly and accurately.</p><p>Some questions are about how the word looks, some about how it sounds, some about what it means.</p>',
  estimateMin: 6, practice: 2, fix: 400, iti: 400, timeout: 6000, background: '#e8eef2',
  response: { type: 'key', keys: ['y', 'n', 'f', 'j'], labels: { y: 'yes', n: 'no', f: 'new', j: 'old' } },
  factRefs: ['F-CRAIK'],
  deception: true,
  debrief: {
    deception: 'The first part was presented only as a set of quick questions about words. We did not tell you there would be a memory test for those words afterwards.',
    purpose: 'Keeping the test a surprise ("incidental learning") stops people from deliberately memorising every word, so differences in memory reflect the kind of processing each question demanded — structural, phonemic or semantic (see fact F-CRAIK).',
    safeguards: 'The omission was minimal and harmless, and it was revealed straight away. Your results are not a measure of your memory ability. You may delete this run’s data now.',
  },
  buildTrials(rng, opts) {
    if (opts.practice === true) {
      return LOP_PRACTICE.map((e, i) => { const level = LOP_LEVELS[i % 3], yes = i % 2 === 0, q = lopQuestion(rng, e, level, yes);
        return { block: 'practice', phase: 'study', condition: 'study_' + level, level, word: e[0], shown: q.shown, question: q.q, keys: ['y', 'n'], correctResponse: yes ? 'y' : 'n', stimulus: e[0] }; });
    }
    const want = opts.trials || (opts.quick ? 18 : 54);
    const k = Math.max(2, Math.min(Math.floor(LOP.length / 6), Math.ceil(want / 9)));
    const pool = rng.shuffle(LOP.slice());
    const studied = pool.slice(0, 3 * k), fresh = pool.slice(3 * k, 6 * k);
    const study = studied.map((e, i) => {
      const level = LOP_LEVELS[i % 3], yes = Math.floor(i / 3) % 2 === 0, q = lopQuestion(rng, e, level, yes);
      return { block: 'study', phase: 'study', condition: 'study_' + level, level, word: e[0], shown: q.shown, question: q.q, keys: ['y', 'n'], correctResponse: yes ? 'y' : 'n', stimulus: e[0] };
    });
    const test = studied.map((e, i) => ({ block: 'test', phase: 'test', condition: 'test_' + LOP_LEVELS[i % 3], word: e[0], keys: ['f', 'j'], correctResponse: 'j', stimulus: e[0], timeout: 5000 }))
      .concat(fresh.map((e) => ({ block: 'test', phase: 'test', condition: 'test_new', word: e[0], keys: ['f', 'j'], correctResponse: 'f', stimulus: e[0], timeout: 5000 })));
    const testOrder = rng.shuffle(test);
    testOrder[0].first = true;
    return rng.shuffle(study).concat(testOrder);
  },
  draw(ctx, t, W, H) {
    if (t.phase === 'study') {
      panel(ctx, W * 0.12, H * 0.16, W * 0.76, 64, 'rgba(255,255,255,0.92)', 12);
      text(ctx, t.question, W / 2, H * 0.16 + 32, 22, '#1d3557', 700);
      card(ctx, W, H, t.shown, null);
      text(ctx, 'Y = yes     N = no', W / 2, H * 0.82, 18, '#445', 600);
      return;
    }
    if (t.first) { panel(ctx, W * 0.18, H * 0.08, W * 0.64, 70, '#fff3d6', 12); text(ctx, 'Surprise memory test!', W / 2, H * 0.08 + 24, 24, '#7a4b00', 800); text(ctx, 'Did this word appear in the first part?', W / 2, H * 0.08 + 52, 16, '#7a4b00', 600); }
    card(ctx, W, H, t.word, 'Seen before?');
    text(ctx, 'J = old (seen before)     F = new', W / 2, H * 0.82, 18, '#445', 600);
  },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    if (t.phase === 'study') {
      const { rt } = drawRT(p, rng, { mu: 650, effect: t.level === 'structural' ? -60 : t.level === 'phonemic' ? 40 : 60 });
      return { response: drawCorrect(p, rng, 0) ? t.correctResponse : (t.correctResponse === 'y' ? 'n' : 'y'), rt };
    }
    // Simulated effect size: deeper (semantic) processing → more hits; new words → few false alarms.
    const pOld = { test_structural: 0.42, test_phonemic: 0.6, test_semantic: 0.82, test_new: 0.14 }[t.condition];
    return { response: rng.chance(pOld) ? 'j' : 'f', rt: drawRT(p, rng, { mu: 720 }).rt };
  },
  analyse(rows) {
    const test = rows.filter((r) => /^test_/.test(r.condition));
    const nw = test.filter((r) => r.condition === 'test_new');
    const fas = nw.filter((r) => r.response === 'j').length;
    const fa = nw.length ? fas / nw.length : NaN;
    const stats = { falseAlarm: fa }, lines = [], bars = [];
    for (const lv of LOP_LEVELS) {
      const sub = test.filter((r) => r.condition === 'test_' + lv);
      const hits = sub.filter((r) => r.response === 'j').length;
      const hr = sub.length ? hits / sub.length : NaN;
      const d = sub.length && nw.length ? sdt.fromCounts({ hits, misses: sub.length - hits, fas, crs: nw.length - fas }).dprime : NaN;
      stats[lv] = hr; stats[lv + '_dprime'] = d;
      lines.push(`${lv[0].toUpperCase() + lv.slice(1)} questions: hit rate ${pc(hr)}, d′ ${fin(d) ? d.toFixed(2) : '—'}`);
      bars.push({ name: lv, value: fin(hr) ? 100 * hr : 0 });
    }
    const studyAcc = rate(rows.filter((r) => /^study_/.test(r.condition)), isOk);
    lines.push(`False-alarm rate on new words: ${pc(fa)}. Orienting-question accuracy: ${pc(studyAcc)}.`);
    lines.push('Better memory after meaning-based (semantic) questions than after appearance or sound questions supports the depth-of-processing idea (see fact F-CRAIK).');
    bars.push({ name: 'new (FA)', value: fin(fa) ? 100 * fa : 0 });
    return { lines, stats, chart: (ch) => ch.bar(bars, { label: 'Recognition by level of processing', yl: '% "old"', yr: [0, 100] }) };
  },
});

// =====================================================================================
// 4. DRM false memory (facts F-DRM, F-DRM-RATE) — original associate lists
// =====================================================================================
const DRM_LISTS = [
  { theme: 'chai', lure: 'tea', words: ['cup', 'milk', 'sugar', 'ginger', 'kettle', 'cardamom', 'steam', 'stall', 'biscuit', 'brew', 'leaves', 'saucer'] },
  { theme: 'rain', lure: 'rain', words: ['umbrella', 'cloud', 'wet', 'storm', 'drizzle', 'puddle', 'monsoon', 'thunder', 'drops', 'soaked', 'grey', 'gutter'] },
  { theme: 'doctor', lure: 'doctor', words: ['nurse', 'hospital', 'clinic', 'stethoscope', 'patient', 'medicine', 'sick', 'surgeon', 'appointment', 'prescription', 'health', 'ward'] },
  { theme: 'school', lure: 'school', words: ['teacher', 'classroom', 'pupil', 'homework', 'lesson', 'desk', 'bell', 'uniform', 'exam', 'playground', 'timetable', 'principal'] },
  { theme: 'cricket', lure: 'cricket', words: ['bat', 'wicket', 'bowler', 'pitch', 'umpire', 'stumps', 'innings', 'over', 'boundary', 'fielder', 'crease', 'spin'] },
  { theme: 'mountain', lure: 'mountain', words: ['peak', 'climb', 'summit', 'valley', 'snow', 'hill', 'cliff', 'range', 'steep', 'trek', 'rock', 'glacier'] },
];
const DRM_UNREL = ['pencil', 'garden', 'button', 'violin', 'carpet', 'window', 'basket', 'candle', 'ladder', 'wallet', 'tunnel', 'pillow', 'marble', 'saddle', 'lemon', 'feather', 'mirror', 'parrot', 'zipper', 'anchor', 'magnet', 'napkin', 'ribbon', 'thimble', 'compass', 'lantern', 'walnut', 'jigsaw', 'tractor', 'whistle', 'pumpkin', 'scooter', 'slipper', 'sponge', 'turtle', 'hammock'];
const DRM_ON = 900, DRM_PICK = [0, 5, 9, 2, 7, 11, 3, 8, 1, 10];
const drm = Object.assign({}, TAGS, {
  id: 'drm', title: 'DRM false memory',
  purpose: 'To test whether studying lists of related words leads you to "remember" a related word that was never shown.',
  instructions: '<p><b>Study:</b> lists of words appear one at a time. Try to remember them all.</p><p><b>Test:</b> single words appear. Press <kbd>J</kbd> if the word was <b>in the lists</b> (old) or <kbd>F</kbd> if it was <b>not</b> (new).</p>',
  estimateMin: 5, practice: 0, fix: 500, iti: 400, timeout: 6000, background: '#efe9f4',
  response: { type: 'key', keys: ['f', 'j'], labels: { f: 'new', j: 'old' } },
  factRefs: ['F-DRM', 'F-DRM-RATE'],
  buildTrials(rng, opts) {
    const L = opts.quick && !opts.trials ? 3 : 6;
    const lists = rng.shuffle(DRM_LISTS.slice()).slice(0, L);
    let k = 3, u = 2;
    const want = opts.trials || 0;
    while (L + L * k + L + L * u < want && k < 10) { k++; if (u < 6) u++; }
    const study = lists.map((l, i) => ({ block: 'study', phase: 'study', responseType: 'none', animated: true, condition: 'study', words: rng.shuffle(l.words.slice()).slice(0, 12), dur: 12 * DRM_ON, timeout: null, stimulus: 'list:' + l.theme, listNo: i + 1 }));
    const test = [];
    const unrel = dealer(rng, DRM_UNREL);
    lists.forEach((l, i) => {
      const w = study[i].words;
      for (const j of DRM_PICK.slice(0, k)) test.push({ condition: 'studied', word: w[j], correctResponse: 'j' });
      test.push({ condition: 'lure', word: l.lure, correctResponse: 'f' });
      for (let j = 0; j < u; j++) test.push({ condition: 'unrelated', word: unrel(), correctResponse: 'f' });
    });
    const t2 = rng.shuffle(test).map((t) => Object.assign(t, { block: 'test', phase: 'test', stimulus: t.word }));
    if (t2.length) t2[0].first = true;
    return study.concat(t2);
  },
  draw(ctx, t, W, H, el) {
    if (t.phase === 'study') {
      const i = Math.floor(Math.max(0, el) / DRM_ON), within = el - i * DRM_ON;
      text(ctx, `Study list ${t.listNo} — remember every word`, W / 2, H * 0.12, 18, '#4a3a5c', 700);
      if (i < t.words.length && within < DRM_ON * 0.78) card(ctx, W, H, t.words[i], null, '#3c1f5c');
      dots(ctx, W, H, t.words.length, Math.min(i, t.words.length));
      return;
    }
    if (t.first) text(ctx, 'Memory test: was each word in the lists?', W / 2, H * 0.14, 22, '#4a3a5c', 800);
    card(ctx, W, H, t.word, 'In the lists?', '#3c1f5c');
    text(ctx, 'J = old (studied)     F = new', W / 2, H * 0.82, 18, '#445', 600);
  },
  score(t, r) { return t.phase === 'study' ? null : r === t.correctResponse; },
  simulate(p, t, rng) {
    if (t.phase === 'study') return { response: null, rt: null };
    // Simulated effect size: critical lures endorsed almost as often as studied words.
    const pOld = { studied: 0.74, lure: 0.62, unrelated: 0.1 }[t.condition];
    return { response: rng.chance(pOld) ? 'j' : 'f', rt: drawRT(p, rng, { mu: 760, effect: t.condition === 'lure' ? 60 : 0 }).rt };
  },
  analyse(rows) {
    const r3 = ['studied', 'lure', 'unrelated'].map((c) => ({ c, v: rate(rows.filter((r) => r.condition === c && r.response !== ''), (r) => r.response === 'j') }));
    const [st, lu, un] = r3.map((x) => x.v);
    const lines = [
      `"Old" responses — studied words (hits): ${pc(st)}; critical lures (never shown): ${pc(lu)}; unrelated new words: ${pc(un)}.`,
      fin(lu) && fin(un) ? `False-alarm rate to lures exceeds unrelated words by ${(100 * (lu - un)).toFixed(0)} percentage points.` : 'Not enough test answers to compare lures with unrelated words.',
      'Critical lures were: tea, rain, doctor, school, cricket, mountain. Each list was built from associates of its lure. Compare facts F-DRM and F-DRM-RATE.',
    ];
    return { lines, stats: { studied: st, lure: lu, unrelated: un }, chart: (ch) => ch.bar(r3.map((x) => ({ name: x.c, value: fin(x.v) ? 100 * x.v : 0 })), { label: 'Recognition: % judged "old"', yl: '% "old"', yr: [0, 100] }) };
  },
});

// =====================================================================================
// 5. Misinformation / leading questions (fact F-LP) — deception with debrief
// =====================================================================================
const MI_DUR = 8500, MI_HIT = 4000;
const MI_CAR = [{ name: 'Blue', hex: '#2f6db5' }, { name: 'Red', hex: '#c0392b' }, { name: 'White', hex: '#eef0f2' }, { name: 'Silver', hex: '#a7adb5' }];
function miCar(ctx, x, y, s, col, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rrect(ctx, -s * 0.95 + 3, -s * 0.45 + 4, s * 1.9, s * 0.9, s * 0.2); ctx.fill();
  ctx.fillStyle = col; rrect(ctx, -s * 0.95, -s * 0.45, s * 1.9, s * 0.9, s * 0.22); ctx.fill(); ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#2b3a4a'; rrect(ctx, s * 0.15, -s * 0.36, s * 0.38, s * 0.72, s * 0.1); ctx.fill(); rrect(ctx, -s * 0.62, -s * 0.33, s * 0.3, s * 0.66, s * 0.1); ctx.fill();
  ctx.fillStyle = '#fff3b0'; ctx.fillRect(s * 0.85, -s * 0.36, s * 0.08, s * 0.16); ctx.fillRect(s * 0.85, s * 0.2, s * 0.08, s * 0.16);
  ctx.restore();
}
function miRickshaw(ctx, x, y, s, ang) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang || 0);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.moveTo(-s * 0.4 + 3, -s * 0.85 + 4); ctx.lineTo(s * 0.4 + 3, -s * 0.85 + 4); ctx.lineTo(s * 0.5 + 3, s * 0.7 + 4); ctx.lineTo(-s * 0.5 + 3, s * 0.7 + 4); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1e8a4c'; ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.9); ctx.lineTo(s * 0.18, -s * 0.9); ctx.lineTo(s * 0.48, s * 0.1); ctx.lineTo(s * 0.48, s * 0.72); ctx.lineTo(-s * 0.48, s * 0.72); ctx.lineTo(-s * 0.48, s * 0.1); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#123'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#f2c230'; rrect(ctx, -s * 0.42, -s * 0.2, s * 0.84, s * 0.85, s * 0.12); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#222'; ctx.fillRect(-s * 0.06, -s * 1.02, s * 0.12, s * 0.18);
  ctx.restore();
}
function miPerson(ctx, x, y, s, shirt, wave) {
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(x, y, s * 0.32, s * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8d5a3b'; ctx.beginPath(); ctx.arc(x, y, s * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1f1a17'; ctx.beginPath(); ctx.arc(x, y - s * 0.02, s * 0.11, 0, Math.PI * 2); ctx.fill();
  if (wave) { ctx.strokeStyle = '#8d5a3b'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + s * 0.25, y); ctx.lineTo(x + s * 0.45, y - s * (0.3 + 0.1 * Math.sin(wave))); ctx.stroke(); }
}
function miScene(ctx, t, W, H, el) {
  const cx = W / 2, cy = H * 0.5, rw = Math.min(W, H) * 0.16, s = rw * 0.42;
  ctx.fillStyle = '#c9c0ae'; ctx.fillRect(0, 0, W, H);
  // blocks: shops with awnings, a tea stall and trees at the corners
  const blocks = [[0, 0, cx - rw, cy - rw], [cx + rw, 0, W, cy - rw], [0, cy + rw, cx - rw, H], [cx + rw, cy + rw, W, H]];
  const aw = ['#d9534f', '#3b8bba', '#e8a33d', '#5aa469'];
  blocks.forEach(([x0, y0, x1, y1], i) => {
    ctx.fillStyle = '#d8c6a5'; ctx.fillRect(x0 + 10, y0 + 10, x1 - x0 - 20, y1 - y0 - 20);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? aw[i] : '#f4ede0'; const xs = x0 + 18 + (k * (x1 - x0 - 36)) / 4; ctx.fillRect(xs, i < 2 ? y1 - 34 : y0 + 12, (x1 - x0 - 36) / 4, 22); }
    ctx.fillStyle = '#4f8a3c'; ctx.beginPath(); ctx.arc(i % 2 ? x0 + 40 : x1 - 40, i < 2 ? y0 + 50 : y1 - 50, 22, 0, Math.PI * 2); ctx.fill();
  });
  text(ctx, 'CHAI', cx - rw - 70, cy - rw - 58, 14, '#5b3b1d', 800);
  ctx.fillStyle = '#5a5d63'; ctx.fillRect(0, cy - rw, W, rw * 2); ctx.fillRect(cx - rw, 0, rw * 2, H);
  ctx.strokeStyle = '#e9e3c9'; ctx.lineWidth = 3; ctx.setLineDash([18, 14]);
  ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(cx - rw, cy); ctx.moveTo(cx + rw, cy); ctx.lineTo(W, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - rw); ctx.moveTo(cx, cy + rw); ctx.lineTo(cx, H); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = '#f4f4f0'; for (let k = 0; k < 6; k++) ctx.fillRect(cx - rw - 26, cy - rw + 6 + k * (rw * 2 - 12) / 6, 18, (rw * 2 - 12) / 12);
  // vehicles: car east-bound in the lower lane, rickshaw from the south (or north) heading for the junction
  const u = Math.min(1, el / MI_HIT), ease = 1 - Math.pow(1 - u, 1.4);
  const after = Math.max(0, el - MI_HIT);
  const nudge = Math.min(1, after / 400);
  const carX = -s * 2 + (cx - s * 1.1 + s * 2) * ease + nudge * s * 0.18, carY = cy + rw * 0.45;
  const dir = t.from === 'south' ? 1 : -1;
  const rickY0 = t.from === 'south' ? H + s * 2 : -s * 2, rickY1 = carY + dir * s * 0.95;
  const rickY = rickY0 + (rickY1 - rickY0) * ease;
  miCar(ctx, carX, carY, s, t.carHex, nudge * 0.12);
  miRickshaw(ctx, cx - s * 0.05, rickY, s, (t.from === 'south' ? 0 : Math.PI) - nudge * 0.25);
  if (after > 0 && after < 900) { // small dust puff, no debris
    ctx.fillStyle = `rgba(230,220,200,${0.6 * (1 - after / 900)})`;
    for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(cx - s * 0.2 + Math.cos(k) * s * 0.4 * (1 + after / 500), carY + dir * s * 0.5 + Math.sin(k * 2) * s * 0.3, s * 0.18, 0, Math.PI * 2); ctx.fill(); }
  }
  if (after > 1300) { miPerson(ctx, carX - s * 0.2, carY - s * 0.9, s, '#5d6d7e', after / 140); miPerson(ctx, cx + s * 0.9, rickY1 + dir * s * 0.2, s, '#b9770e', after / 120 + 1); }
}
const misinformation = Object.assign({}, TAGS, {
  id: 'misinformation', title: 'Misinformation (eyewitness)', panel: 'eyewitness', zone: 'mohalla', apa: '1.4', domain: 'Cog/Social',
  purpose: 'To see how accurately you can report details of a short traffic event you witness.',
  instructions: '<p>Watch a short animated clip of a minor traffic incident at a junction (nobody is hurt). Then answer a few questions about what you saw, as accurately as you can.</p>',
  estimateMin: 3, practice: 0, fix: 600, iti: 600, timeout: null, background: '#c9c0ae',
  response: { type: 'choice' },
  factRefs: ['F-LP'],
  deception: true,
  debrief: {
    deception: 'The speed question was worded differently for different participants: some were asked how fast the vehicles were going when they "smashed into" each other, others when they "hit" each other. You were randomly given one wording. There was no broken glass in the clip.',
    purpose: 'This tests whether a leading question can change both an estimate (speed) and memory for a detail that never happened (broken glass). It is why investigators are trained to ask neutral, open questions. Compare the classic finding recorded in fact F-LP.',
    safeguards: 'The wording difference was minor and harmless and is revealed now. Being influenced by a question is a normal property of memory, not a personal failing. You may delete this run’s data now.',
  },
  buildTrials(rng, opts) {
    const verb = rng.chance(0.5) ? 'smashed' : 'hit';
    const phrase = verb === 'smashed' ? 'smashed into' : 'hit';
    const eps = Math.max(1, Math.ceil((opts.trials || 4) / 4));
    const out = [];
    for (let e = 0; e < eps; e++) {
      const car = MI_CAR[(e + rng.int(0, 3)) % 4], from = rng.chance(0.5) ? 'south' : 'north';
      const base = { condition: verb, carHex: car.hex, carName: car.name, from, episode: e + 1 };
      out.push(Object.assign({ phase: 'event', responseType: 'none', animated: true, dur: MI_DUR, stimulus: `event${e + 1};car=${car.name};from=${from}`, caption: '[Animation] A car and a motorbike-rickshaw meet at a junction and bump; both stop and the drivers get out. No one is hurt.' }, base));
      out.push(Object.assign({ phase: 'q', question: 'What colour was the car?', choices: MI_CAR.map((c) => c.name), correctResponse: car.name, stimulus: `q:colour;ep=${e + 1}` }, base));
      out.push(Object.assign({ phase: 'speed', responseType: 'slider', slider: { min: 0, max: 120, step: 1, start: 50, label: 'Speed estimate (km/h)' },
        question: `About how fast were the vehicles going when they ${phrase} each other?`, stimulus: `q:speed;verb=${verb};ep=${e + 1}`,
        followup: { prompt: 'Did you see any broken glass?', choices: ['Yes', 'No'] } }, base));
      const dirs = [{ value: 'south', label: 'From the bottom of the screen' }, { value: 'north', label: 'From the top of the screen' }, { value: 'west', label: 'From the left' }, { value: 'east', label: 'From the right' }];
      out.push(Object.assign({ phase: 'q', question: 'Where did the rickshaw come from?', choices: dirs, correctResponse: from, stimulus: `q:direction;ep=${e + 1}` }, base));
    }
    return out;
  },
  draw(ctx, t, W, H, el, state) {
    if (t.phase === 'event') { miScene(ctx, t, W, H, el); return; }
    ctx.fillStyle = '#ece6da'; ctx.fillRect(0, 0, W, H);
    panel(ctx, W * 0.08, H * 0.2, W * 0.84, 80, '#fffdf8', 14);
    text(ctx, t.question, W / 2, H * 0.2 + 40, t.question.length > 60 ? 19 : 23, '#1d2b3a', 700);
    if (t.phase === 'speed') {
      const v = state && fin(state.sliderValue) ? state.sliderValue : t.slider.start;
      text(ctx, `${Math.round(v)} km/h`, W / 2, H * 0.52, 64, '#14365c', 800);
      const x0 = W * 0.2, x1 = W * 0.8, yy = H * 0.66;
      ctx.strokeStyle = '#9aa4ae'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke();
      const px = x0 + (x1 - x0) * (v - t.slider.min) / (t.slider.max - t.slider.min);
      ctx.strokeStyle = '#2a6f97'; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(px, yy); ctx.stroke();
      ctx.fillStyle = '#2a6f97'; ctx.beginPath(); ctx.arc(px, yy, 12, 0, Math.PI * 2); ctx.fill();
      text(ctx, 'Use ← → (Shift for ×5), then Enter', W / 2, H * 0.74, 16, '#555', 600);
    }
  },
  score(t, r) { return t.correctResponse != null ? r === t.correctResponse : null; },
  simulate(p, t, rng) {
    if (t.phase === 'event') return { response: null, rt: null };
    if (t.phase === 'q') return { response: drawCorrect(p, rng, 0.5) ? t.correctResponse : rng.pick(t.choices.map((c) => (typeof c === 'object' ? c.value : c)).filter((v) => v !== t.correctResponse)), rt: drawRT(p, rng, { mu: 2200 }).rt };
    // Simulated effect size: "smashed" raises speed estimates and false "broken glass" reports.
    const smashed = t.condition === 'smashed';
    const v = Math.max(5, Math.min(120, Math.round(rng.normal(38 + (smashed ? 9 : 0), 9))));
    setBot(t, rng.chance(smashed ? 0.3 : 0.12) ? 'Yes' : 'No');
    return { response: v, rt: drawRT(p, rng, { mu: 3500 }).rt };
  },
  analyse(rows) {
    const sp = rows.filter((r) => /^q:speed/.test(r.stimulus) && r.response !== '');
    const own = {};
    for (const v of ['smashed', 'hit']) {
      const sub = sp.filter((r) => r.condition === v);
      const est = sub.map((r) => parseFloat(mainOf(r.response))).filter(fin);
      const fu = sub.filter((r) => parts(r.response).length > 1);
      own[v] = { n: sub.length, mean: avg(est), glass: fu.length ? rate(fu, (r) => parts(r.response)[1] === 'Yes') : NaN };
    }
    const mine = sp.length ? sp[0].condition : '';
    const lines = [];
    if (mine) lines.push(`Your question used the verb "${mine === 'smashed' ? 'smashed into' : 'hit'}". Your speed estimate: ${f1(own[mine].mean)} km/h; broken glass reported: ${fin(own[mine].glass) ? (own[mine].glass >= 0.5 ? 'Yes' : 'No') : '— (not recorded)'}.`);
    else lines.push('No speed answer recorded.');
    const filler = rows.filter((r) => /^q:(colour|direction)/.test(r.stimulus));
    lines.push(`Detail questions (car colour, rickshaw direction) correct: ${pc(rate(filler, isOk))}. There was no broken glass in the clip.`);
    // Labelled class comparison: Simulated data, Simulated effect size.
    const g = prng(20251114), cls = { smashed: [], hit: [] }, glass = { smashed: 0, hit: 0 }, N = 30;
    for (const v of ['smashed', 'hit']) for (let i = 0; i < N; i++) { cls[v].push(Math.max(5, Math.min(120, g.normal(38 + (v === 'smashed' ? 9 : 0), 9)))); if (g.u() < (v === 'smashed' ? 0.3 : 0.12)) glass[v]++; }
    const tt = S.tIndependent(cls.smashed, cls.hit);
    const chi = S.chi2Independence([[glass.smashed, N - glass.smashed], [glass.hit, N - glass.hit]]);
    lines.push(`Simulated data (simulated class, n = ${N} per wording; Simulated effect size): "smashed into" M = ${S.mean(cls.smashed).toFixed(1)} km/h vs "hit" M = ${S.mean(cls.hit).toFixed(1)} km/h, ${apa.t(tt)}; broken glass "Yes" ${glass.smashed}/${N} vs ${glass.hit}/${N}, ${apa.chi2(chi)}.`);
    lines.push('For the original study’s figures see fact F-LP. Leading wording can shift estimates and even create memories of details that were never there.');
    const bars = [{ name: 'sim: smashed', value: S.mean(cls.smashed) }, { name: 'sim: hit', value: S.mean(cls.hit) }];
    if (mine && fin(own[mine].mean)) bars.push({ name: 'you (' + mine + ')', value: own[mine].mean });
    return { lines, stats: { own, simulated: { smashed: S.mean(cls.smashed), hit: S.mean(cls.hit), t: tt.t, p: tt.p, glass } },
      chart: (ch) => ch.bar(bars, { label: 'Speed estimates by verb (Simulated data + you)', yl: 'km/h' }) };
  },
});

// =====================================================================================
// 6. n-back (2-back letters)
// =====================================================================================
const NB_LET = 'BDFHKMRT'.split('');
const nback = Object.assign({}, TAGS, {
  id: 'nback', title: 'n-back working memory',
  purpose: 'To measure working-memory updating: detecting when a letter matches the one shown two steps earlier.',
  instructions: '<p>Letters appear one at a time. Press <kbd>J</kbd> whenever the letter is the <b>same as the one two letters back</b> (2-back). Otherwise do nothing.</p><p>Example: B · K · <b>B</b> ← press J.</p>',
  estimateMin: 4, practice: 0, fix: 300, iti: 200, timeout: 2500, dur: 500, background: '#e6ecf3',
  response: { type: 'key', keys: ['j'], labels: { j: 'match (2-back)' } },
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 24 : 60);
    const seq = [], out = [];
    for (let i = 0; i < n; i++) {
      let L, match = false;
      if (i >= 2 && rng.chance(0.3)) { L = seq[i - 2]; match = true; } else { do L = rng.pick(NB_LET); while (i >= 2 && L === seq[i - 2]); }
      seq.push(L);
      out.push({ condition: i < 2 ? 'filler' : match ? 'target' : 'nontarget', letter: L, pos: i + 1, correctResponse: match ? 'j' : null, stimulus: L });
    }
    return out;
  },
  draw(ctx, t, W, H) {
    text(ctx, '2-back: press J if this letter matches the one two before', W / 2, H * 0.14, 18, '#334', 600);
    const s = Math.min(W, H) * 0.28;
    ctx.fillStyle = 'rgba(0,0,0,0.12)'; rrect(ctx, W / 2 - s / 2 + 4, H / 2 - s / 2 + 6, s, s, 22); ctx.fill();
    panel(ctx, W / 2 - s / 2, H / 2 - s / 2, s, s, '#ffffff', 22);
    text(ctx, t.letter, W / 2, H / 2 + 4, Math.round(s * 0.55), '#1d3557', 800);
  },
  score(t, r) { return t.condition === 'target' ? r === 'j' : r == null; },
  simulate(p, t, rng) {
    // Simulated effect size: ~80% hits, ~8% false alarms.
    const press = t.condition === 'target' ? drawCorrect(p, rng, 1.1) : rng.chance(0.08);
    return press ? { response: 'j', rt: drawRT(p, rng, { mu: 560 }).rt } : { response: null, rt: null };
  },
  analyse(rows) {
    const tg = rows.filter((r) => r.condition === 'target'), nt = rows.filter((r) => r.condition === 'nontarget');
    const hits = tg.filter((r) => r.response === 'j').length, fas = nt.filter((r) => r.response === 'j').length;
    if (!tg.length || !nt.length) return { lines: ['Not enough trials to compute d′.'], stats: {} };
    const res = sdt.fromCounts({ hits, misses: tg.length - hits, fas, crs: nt.length - fas });
    const rt = tg.filter((r) => r.response === 'j' && r.rt_ms !== '').map((r) => +r.rt_ms);
    const lines = [
      `Hits ${hits}/${tg.length} (${pc(hits / tg.length)}), false alarms ${fas}/${nt.length} (${pc(fas / nt.length)}).`,
      `Sensitivity: ${apa.dprime(res.dprime, res.c)}${res.corrected ? ' (log-linear correction applied for extreme rates)' : ''}.`,
      `Mean hit RT: ${rt.length ? S.mean(rt).toFixed(0) + ' ms' : '—'}. d′ separates how well you discriminate matches from how willing you are to press.`,
    ];
    return { lines, stats: { hits, fas, dprime: res.dprime, c: res.c, H: res.H, FA: res.FA },
      chart: (ch) => ch.bar([{ name: 'hit rate', value: 100 * hits / tg.length }, { name: 'false-alarm rate', value: 100 * fas / nt.length }], { label: `2-back: d′ = ${res.dprime.toFixed(2)}`, yl: '%', yr: [0, 100] }) };
  },
});

// =====================================================================================
// 7. Memory palace — rote rehearsal vs method of loci on a campus route
// =====================================================================================
const LOCI = [
  { name: 'main gate', x: 0.08, y: 0.82 }, { name: 'fountain', x: 0.2, y: 0.62 }, { name: 'library steps', x: 0.14, y: 0.36 }, { name: 'notice board', x: 0.3, y: 0.18 },
  { name: 'canteen', x: 0.46, y: 0.3 }, { name: 'banyan tree', x: 0.52, y: 0.56 }, { name: 'lecture hall', x: 0.66, y: 0.76 }, { name: 'cricket ground', x: 0.8, y: 0.56 },
  { name: 'bus stop', x: 0.76, y: 0.28 }, { name: 'clock tower', x: 0.92, y: 0.14 },
];
const MP_NOUNS = uniq(('elephant trumpet umbrella pineapple bicycle telescope sandcastle teapot lantern parachute balloon violin pumpkin rocket anchor carpet dragon helmet kettle ladder mango mirror parrot penguin pillow saddle scooter snowman statue tractor turtle whistle zebra camel candle crown drum feather guitar hammer igloo jacket kite lemon magnet necklace onion owl peacock robot sofa spider tiger tomato wagon wallet').split(' '));
const MP_ON = 2500;
function mpMap(ctx, W, H, cur, word) {
  const x0 = W * 0.06, y0 = H * 0.12, w = W * 0.88, h = H * 0.7;
  panel(ctx, x0, y0, w, h, '#cfe3c1', 18);
  const P = LOCI.map((l) => ({ x: x0 + l.x * w, y: y0 + l.y * h }));
  ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); P.forEach((p, i) => { if (!i) ctx.moveTo(p.x, p.y); else { const q = P[i - 1]; ctx.quadraticCurveTo((p.x + q.x) / 2 + (i % 2 ? 20 : -20), (p.y + q.y) / 2, p.x, p.y); } }); ctx.stroke();
  ctx.strokeStyle = '#b9a77f'; ctx.lineWidth = 2; ctx.setLineDash([6, 8]); ctx.stroke(); ctx.setLineDash([]);
  P.forEach((p, i) => {
    const on = i === cur;
    ctx.fillStyle = on ? '#f4a261' : '#2a6f97'; ctx.beginPath(); ctx.arc(p.x, p.y, on ? 17 : 13, 0, Math.PI * 2); ctx.fill();
    text(ctx, String(i + 1), p.x, p.y + 1, on ? 15 : 12, '#fff', 800);
    text(ctx, LOCI[i].name, p.x, p.y + 26, 12, '#24412a', 700);
  });
  if (cur >= 0 && cur < P.length && word) {
    const p = P[cur], bw = Math.max(140, word.length * 16 + 40), bx = Math.min(x0 + w - bw - 8, Math.max(x0 + 8, p.x - bw / 2)), by = p.y - 74 < y0 ? p.y + 36 : p.y - 74;
    panel(ctx, bx, by, bw, 40, '#fffdf5', 10); ctx.strokeStyle = '#f4a261'; ctx.lineWidth = 2; rrect(ctx, bx, by, bw, 40, 10); ctx.stroke();
    text(ctx, word.toUpperCase(), bx + bw / 2, by + 21, 20, '#7a3b0c', 800);
  }
}
const memoryPalace = Object.assign({}, TAGS, {
  id: 'memory_palace', title: 'Method of loci palace', zone: 'wundt',
  purpose: 'To compare remembering a list by simple repetition with placing each item at a familiar location along a route (method of loci).',
  instructions: '<p>You will study two lists of 10 words, each shown for 2.5 seconds.</p><ul><li><b>Rote list:</b> silently repeat each word to yourself.</li><li><b>Loci list:</b> each word appears at the next stop on a campus walk (main gate → fountain → … → clock tower). Make a vivid mental picture of the object <i>at</i> that place.</li></ul><p>After each list, type all the words you remember (any order), separated by spaces.</p>',
  estimateMin: 4, practice: 0, fix: 600, iti: 800, timeout: null, background: '#eef2ea', animated: true,
  response: { type: 'text' },
  buildTrials(rng, opts) {
    const rounds = Math.max(1, Math.ceil((opts.trials || 4) / 4));
    const first = rng.chance(0.5) ? 'rote' : 'loci';
    const order = first === 'rote' ? ['rote', 'loci'] : ['loci', 'rote'];
    const deal = dealer(rng, MP_NOUNS), out = [];
    for (let r = 0; r < rounds; r++) for (const strat of order) {
      const words = []; while (words.length < 10) { const w = deal(); if (!words.includes(w)) words.push(w); }
      out.push({ block: 'study', phase: 'study', responseType: 'none', condition: strat, words, dur: 10 * MP_ON, stimulus: words.join(' ') });
      out.push({ block: 'recall', phase: 'recall', condition: strat, words, prompt: 'Type the words you remember, separated by spaces', stimulus: words.join(' ') });
    }
    return out;
  },
  draw(ctx, t, W, H, el) {
    const loci = t.condition === 'loci';
    if (t.phase === 'recall') {
      if (loci) { mpMap(ctx, W, H, -1, null); text(ctx, 'Walk the route in your mind and type the words you placed there', W / 2, H * 0.06, 18, '#24412a', 700); }
      else prompt(ctx, W, H, ['Recall time', 'Type the words you remember, in any order']);
      return;
    }
    const i = Math.floor(Math.max(0, el) / MP_ON), within = el - i * MP_ON, show = i < 10 && within < MP_ON * 0.88;
    if (loci) {
      text(ctx, 'METHOD OF LOCI — picture each object at this stop', W / 2, H * 0.06, 18, '#24412a', 800);
      mpMap(ctx, W, H, Math.min(i, 9), show ? t.words[i] : null);
      if (show) text(ctx, `Imagine the ${t.words[i]} at the ${LOCI[i].name}`, W / 2, H * 0.89, 18, '#333', 600);
    } else {
      text(ctx, 'ROTE — silently repeat each word', W / 2, H * 0.12, 18, '#334', 800);
      if (show) card(ctx, W, H, t.words[i], 'repeat it to yourself');
      dots(ctx, W, H, 10, Math.min(i, 10));
    }
  },
  score() { return null; },
  simulate(p, t, rng) {
    if (t.phase === 'study') return { response: null, rt: null };
    // Simulated effect size: loci improves recall over rote rehearsal.
    const pr = (t.condition === 'loci' ? 0.7 : 0.45) + p.ability * 0.05;
    const got = t.words.filter(() => rng.chance(Math.max(0.05, Math.min(0.97, pr))));
    return { response: got.join(' '), rt: drawRT(p, rng, { mu: 12000 }).rt };
  },
  analyse(rows) {
    const rec = rows.filter((r) => r.block === 'recall');
    const by = {};
    for (const s of ['rote', 'loci']) by[s] = rec.filter((r) => r.condition === s).map((r) => { const m = matchRecall(String(r.stimulus).split(' '), r.response); return m.filter(Boolean).length / m.length; });
    const mR = avg(by.rote), mL = avg(by.loci);
    const lines = [
      `Rote rehearsal: ${pc(mR)} of words recalled (${by.rote.length} list${by.rote.length === 1 ? '' : 's'}).`,
      `Method of loci: ${pc(mL)} of words recalled (${by.loci.length} list${by.loci.length === 1 ? '' : 's'}).`,
      fin(mR) && fin(mL) ? `Difference (loci − rote): ${(100 * (mL - mR)).toFixed(0)} percentage points. One person and two lists cannot establish a causal effect — order and list difficulty also vary; pool class data to test it.` : 'Complete both lists to compare strategies.',
      'Linking items to an imagined route gives each item a distinctive visual image plus an ordered set of retrieval cues.',
    ];
    return { lines, stats: { rote: mR, loci: mL }, chart: (ch) => ch.bar([{ name: 'rote', value: fin(mR) ? 100 * mR : 0 }, { name: 'method of loci', value: fin(mL) ? 100 * mL : 0 }], { label: 'Recall by strategy', yl: '% recalled', yr: [0, 100] }) };
  },
});

module.exports = [serialPosition, brownPeterson, levelsProcessing, drm, misinformation, nback, memoryPalace];
