'use strict';
/**
 * Paradigm exemplar (A8): Stroop + Eriksen flanker + Go/No-Go.
 * Contract: docs/EXPERIMENT_API.md. Pure apart from drawing on a passed 2D context.
 */
const S = require('../../psych/stats.js');
const { apa } = require('../../core/format.js');
const { drawRT, drawCorrect } = require('../../psych/participants.js');

const COLORS = [
  { name: 'RED', key: 'r', hex: '#D55E00' }, { name: 'GREEN', key: 'g', hex: '#009E73' },
  { name: 'BLUE', key: 'b', hex: '#0072B2' }, { name: 'YELLOW', key: 'y', hex: '#F0E442' },
];
const text = (ctx, s, x, y, size = 64, color = '#111', weight = 700) => { ctx.fillStyle = color; ctx.font = `${weight} ${size}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); };
const meanRT = (rows, cond) => { const v = rows.filter((r) => r.condition === cond && String(r.correct) === '1' && r.rt_ms !== '').map((r) => +r.rt_ms); return v.length ? S.mean(v) : NaN; };
const byPid = (rows, cond) => meanRT(rows, cond);

const stroop = {
  id: 'stroop', title: 'Stroop colour-word task', week: 7, panel: 'attention', zone: 'explab', apa: '2.1', domain: 'Cog', hec: 'S3 Cognitive Psychology',
  purpose: 'To experience interference between reading a word and naming its ink colour, and to measure the Stroop effect in your own reaction times.',
  instructions: '<p>Name the <b>ink colour</b>, ignore the word. Keys: <kbd>R</kbd> red, <kbd>G</kbd> green, <kbd>B</kbd> blue, <kbd>Y</kbd> yellow. Respond quickly and accurately.</p>',
  estimateMin: 3, practice: 4, fix: 500, iti: 400, timeout: 2500, background: '#9a9a9a',
  response: { type: 'key', keys: ['r', 'g', 'b', 'y'], labels: { r: 'red', g: 'green', b: 'blue', y: 'yellow' } },
  factRefs: ['F-STROOP'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 24 : 72);
    const conds = ['congruent', 'incongruent', 'neutral'];
    const out = [];
    for (let i = 0; i < n; i++) {
      const condition = conds[i % 3];
      const ink = rng.pick(COLORS);
      let word;
      if (condition === 'congruent') word = ink.name;
      else if (condition === 'incongruent') word = rng.pick(COLORS.filter((c) => c !== ink)).name;
      else word = rng.pick(['XXXX', 'CHAIR', 'TABLE', 'LAMP']);
      out.push({ condition, word, ink: ink.hex, inkName: ink.name, correctResponse: ink.key, stimulus: `${word}/${ink.name}` });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H) { text(ctx, t.word, W / 2, H / 2, 72, t.ink, 800); },
  score(t, r) { return r == null ? false : r === t.correctResponse; },
  simulate(p, t, rng) {
    const effect = t.condition === 'incongruent' ? 95 : t.condition === 'congruent' ? -20 : 0; // Simulated effect size
    const { rt } = drawRT(p, rng, { mu: 560, effect });
    const ok = drawCorrect(p, rng, t.condition === 'incongruent' ? 0.9 : 0);
    return { response: ok ? t.correctResponse : rng.pick(['r', 'g', 'b', 'y'].filter((k) => k !== t.correctResponse)), rt };
  },
  analyse(rows) {
    const c = byPid(rows, 'congruent'), i = byPid(rows, 'incongruent'), n = byPid(rows, 'neutral');
    const acc = S.mean(rows.map((r) => (String(r.correct) === '1' ? 1 : 0)));
    const lines = [`Mean correct RT — congruent ${c.toFixed(0)} ms, neutral ${n.toFixed(0)} ms, incongruent ${i.toFixed(0)} ms`, `Stroop interference (incongruent − congruent): ${(i - c).toFixed(0)} ms`, `Accuracy: ${(acc * 100).toFixed(1)}%`];
    const ci = rows.filter((r) => r.condition === 'incongruent' && String(r.correct) === '1').map((r) => +r.rt_ms);
    const cc = rows.filter((r) => r.condition === 'congruent' && String(r.correct) === '1').map((r) => +r.rt_ms);
    let test = null;
    if (ci.length > 2 && cc.length > 2) { test = S.tIndependent(ci, cc); lines.push('Trial-level comparison (illustrative, trials are not independent participants): ' + apa.t(test)); }
    return { lines, stats: { congruent: c, incongruent: i, neutral: n, interference: i - c, accuracy: acc },
      chart: (ch) => ch.bar([{ name: 'congruent', value: c || 0 }, { name: 'neutral', value: n || 0 }, { name: 'incongruent', value: i || 0 }], { label: 'Mean RT by condition', yl: 'ms' }) };
  },
};

const ARROWS = { left: '←', right: '→' };
const flanker = {
  id: 'flanker', title: 'Eriksen flanker task', week: 7, panel: 'attention', zone: 'explab', apa: '2.1', domain: 'Cog', hec: 'S3 Cognitive Psychology',
  purpose: 'To measure how much irrelevant flanking arrows slow your response to the central arrow (selective attention).',
  instructions: '<p>Respond to the <b>middle arrow</b> only. <kbd>F</kbd> = left, <kbd>J</kbd> = right.</p>',
  estimateMin: 3, practice: 4, fix: 400, iti: 350, timeout: 2000, background: '#9a9a9a',
  response: { type: 'key', keys: ['f', 'j'], labels: { f: 'left', j: 'right' } },
  factRefs: ['F-ERIKSEN'],
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 24 : 64);
    const out = [];
    for (let i = 0; i < n; i++) {
      const condition = ['congruent', 'incongruent', 'neutral'][i % 3];
      const dir = rng.chance(0.5) ? 'left' : 'right';
      const other = dir === 'left' ? 'right' : 'left';
      const fl = condition === 'congruent' ? ARROWS[dir] : condition === 'incongruent' ? ARROWS[other] : '—';
      out.push({ condition, display: `${fl}${fl}${ARROWS[dir]}${fl}${fl}`, correctResponse: dir === 'left' ? 'f' : 'j', stimulus: `${condition}:${dir}` });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H) { text(ctx, t.display.split('').join(' '), W / 2, H / 2, 64, '#111', 700); },
  score(t, r) { return r === t.correctResponse; },
  simulate(p, t, rng) {
    const { rt } = drawRT(p, rng, { mu: 470, effect: t.condition === 'incongruent' ? 60 : 0 });
    const ok = drawCorrect(p, rng, t.condition === 'incongruent' ? 0.8 : 0);
    return { response: ok ? t.correctResponse : (t.correctResponse === 'f' ? 'j' : 'f'), rt };
  },
  analyse(rows) {
    const c = meanRT(rows, 'congruent'), i = meanRT(rows, 'incongruent'), n = meanRT(rows, 'neutral');
    return { lines: [`Mean RT: congruent ${c.toFixed(0)} ms, neutral ${n.toFixed(0)} ms, incongruent ${i.toFixed(0)} ms`, `Flanker effect: ${(i - c).toFixed(0)} ms`], stats: { congruent: c, incongruent: i, effect: i - c },
      chart: (ch) => ch.bar([{ name: 'congruent', value: c || 0 }, { name: 'neutral', value: n || 0 }, { name: 'incongruent', value: i || 0 }], { label: 'Flanker RT', yl: 'ms' }) };
  },
};

const goNogo = {
  id: 'go_nogo', title: 'Go/No-Go inhibition', week: 7, panel: 'attention', zone: 'explab', apa: '2.1', domain: 'Cog', hec: 'S3 Cognitive Psychology',
  purpose: 'To measure response inhibition: pressing quickly for frequent "go" letters while withholding for a rare "no-go" letter.',
  instructions: '<p>Press <kbd>Space</kbd> for every letter <b>except X</b>. Do nothing when you see X.</p>',
  estimateMin: 3, practice: 4, fix: 300, iti: 300, timeout: 900, background: '#9a9a9a',
  response: { type: 'key', keys: ['space'], labels: { space: 'go' } },
  buildTrials(rng, opts) {
    const n = opts.trials || (opts.quick ? 30 : 80);
    const out = [];
    for (let i = 0; i < n; i++) {
      const nogo = i % 5 === 0;
      const letter = nogo ? 'X' : rng.pick(['A', 'K', 'M', 'P', 'R', 'T']);
      out.push({ condition: nogo ? 'nogo' : 'go', letter, stimulus: letter, correctResponse: nogo ? null : 'space' });
    }
    return rng.shuffle(out);
  },
  draw(ctx, t, W, H) { text(ctx, t.letter, W / 2, H / 2, 90, '#111', 800); },
  score(t, r) { return t.condition === 'go' ? r === 'space' : r == null; },
  simulate(p, t, rng) {
    if (t.condition === 'nogo') return rng.chance(0.18) ? { response: 'space', rt: drawRT(p, rng, { mu: 330 }).rt } : { response: null, rt: 1200 };
    return { response: 'space', rt: drawRT(p, rng, { mu: 360 }).rt };
  },
  analyse(rows) {
    const go = rows.filter((r) => r.condition === 'go'), ng = rows.filter((r) => r.condition === 'nogo');
    const comm = ng.length ? ng.filter((r) => r.response === 'space').length / ng.length : 0;
    const om = go.length ? go.filter((r) => r.response === '').length / go.length : 0;
    const rt = go.filter((r) => r.rt_ms !== '').map((r) => +r.rt_ms);
    return { lines: [`Commission errors (pressed on X): ${(comm * 100).toFixed(1)}%`, `Omission errors (missed go): ${(om * 100).toFixed(1)}%`, `Mean go RT: ${rt.length ? S.mean(rt).toFixed(0) : '—'} ms`], stats: { commission: comm, omission: om },
      chart: (ch) => ch.bar([{ name: 'commission %', value: comm * 100 }, { name: 'omission %', value: om * 100 }], { label: 'Go/No-Go errors', yl: '%' }) };
  },
};

module.exports = [stroop, flanker, goNogo];
