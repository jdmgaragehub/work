'use strict';
/**
 * Experiment core (A8) — jsPsych-style conventions, pure (no DOM, no THREE).
 * Timeline: trials → blocks → seeded randomisation, Latin-square counterbalancing,
 * practice blocks, attention checks. Data: one row per trial (schema below).
 */

const ROW_FIELDS = ['pid', 'session', 'paradigm', 'block', 'trial', 'condition', 'stimulus', 'onset_req', 'onset_actual', 'frames', 'rt_ms', 'response', 'correct', 'seed', 'ua_hash'];

const CODEBOOK = {
  pid: 'Anonymised participant id (P-xxxxxx, random per device; never a name)',
  session: 'Session id (date-free counter)',
  paradigm: 'Paradigm id (docs/ARCHITECTURE.md §2)',
  block: 'Block label (practice | main | check | phase name)',
  trial: 'Trial index within the run (1-based)',
  condition: 'Experimental condition label',
  stimulus: 'Stimulus description (text; no images stored)',
  onset_req: 'Requested stimulus onset, ms since run start (performance.now base)',
  onset_actual: 'Actual onset = requestAnimationFrame timestamp of the first frame showing the stimulus (ms)',
  frames: 'Onset error in frames: (onset_actual − onset_req) / frame duration',
  rt_ms: 'Response time in ms from actual onset to KeyboardEvent/PointerEvent.timeStamp (includes browser/OS lag; see Bridges et al. 2020)',
  response: 'Response given (key, choice, value or text)',
  correct: '1 correct, 0 incorrect, empty if not applicable',
  seed: 'Seed of the run (reproducible randomisation)',
  ua_hash: 'Short hash of the browser user-agent (device class only; not identifying)',
};

/** Balanced Latin square (Williams design) for n conditions. Row r gives the order for participant r. */
function latinSquare(n) {
  const rows = [];
  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      let v;
      if (c === 0) v = r;
      else if (c % 2 === 1) v = (r + Math.floor((c + 1) / 2)) % n;
      else v = (r - c / 2 + n) % n;
      row.push(v);
    }
    rows.push(row);
  }
  if (n % 2 === 1) { // odd n: append mirrored rows for full first-order balance
    for (let r = 0; r < n; r++) rows.push(rows[r].slice().reverse());
  }
  return rows;
}

/** Repeat each condition `reps` times and shuffle with constraint: no more than `maxRun` identical in a row. */
function balancedSequence(conditions, reps, rng, maxRun = 3) {
  const base = [];
  for (const c of conditions) for (let i = 0; i < reps; i++) base.push(c);
  for (let attempt = 0; attempt < 200; attempt++) {
    const s = rng.shuffle(base);
    let ok = true, run = 1;
    for (let i = 1; i < s.length && ok; i++) {
      run = JSON.stringify(s[i]) === JSON.stringify(s[i - 1]) ? run + 1 : 1;
      if (run > maxRun) ok = false;
    }
    if (ok) return s;
  }
  return rng.shuffle(base);
}

/**
 * Build a full timeline from a paradigm spec:
 *  spec.buildTrials(rng, opts) → array of trial objects {condition, stimulus, correctResponse?, ...}
 *  opts.practice (n practice trials), opts.attentionChecks (n), opts.quick (bot/e2e shortening)
 */
function buildTimeline(spec, rng, opts = {}) {
  const nPractice = typeof opts.practice === 'number' ? opts.practice : (spec.practice || 0);
  const mainOpts = Object.assign({}, opts); delete mainOpts.practice; // practice:true is reserved for the practice build
  const main = spec.buildTrials(rng, mainOpts).map((t) => Object.assign({ block: t.block || 'main' }, t));
  const out = [];
  if (nPractice > 0 && spec.buildTrials) {
    const prac = spec.buildTrials(rng.fork('practice'), Object.assign({}, opts, { practice: true })).slice(0, nPractice);
    for (const p of prac) out.push(Object.assign({}, p, { block: 'practice' }));
  }
  out.push(...main);
  const nChecks = opts.attentionChecks != null ? opts.attentionChecks : (spec.attentionCheck ? 1 : 0);
  for (let i = 0; i < nChecks && spec.attentionCheck; i++) {
    const at = Math.floor(rng.uniform(0.3, 0.9) * out.length);
    out.splice(at, 0, Object.assign({ block: 'check' }, spec.attentionCheck(rng)));
  }
  return out.map((t, i) => Object.assign(t, { index: i + 1 }));
}

function uaHash(ua) {
  let h = 2166136261;
  const s = String(ua || 'node');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).slice(0, 6);
}

function makeRow(base, trial, result) {
  return {
    pid: base.pid, session: base.session, paradigm: base.paradigm, block: trial.block, trial: trial.index,
    condition: trial.condition == null ? '' : String(trial.condition),
    stimulus: trial.stimulus == null ? '' : String(trial.stimulus),
    onset_req: round2(result.onset_req), onset_actual: round2(result.onset_actual),
    frames: round2(result.frames), rt_ms: result.rt_ms == null ? '' : round2(result.rt_ms),
    response: result.response == null ? '' : String(result.response),
    correct: result.correct == null ? '' : (result.correct ? 1 : 0),
    seed: base.seed, ua_hash: base.ua_hash,
  };
}
const round2 = (v) => (v == null || v === '' || !Number.isFinite(+v) ? '' : Math.round(v * 100) / 100);

function csvEscape(v) {
  const s = v == null ? '' : String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function toCSV(rows, fields = ROW_FIELDS) {
  return [fields.join(',')].concat(rows.map((r) => fields.map((f) => csvEscape(r[f])).join(','))).join('\n') + '\n';
}
function parseCSV(text) {
  const lines = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n') { row.push(cell); lines.push(row); row = []; cell = ''; } else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); lines.push(row); }
  const head = lines.shift();
  return lines.map((l) => Object.fromEntries(head.map((h, i) => [h, l[i]])));
}
function codebookMarkdown(paradigm) {
  return `# Codebook — ${paradigm}\n\n| field | meaning |\n|---|---|\n` + ROW_FIELDS.map((f) => `| ${f} | ${CODEBOOK[f]} |`).join('\n') + '\n';
}

/** Schema validation used by e2e (G9): all fields present, no NaN, numeric fields numeric, condition balance. */
function validateRows(rows, { expectBalanced = false, tolerance = 0.34 } = {}) {
  const errors = [];
  if (!rows.length) errors.push('no rows');
  rows.forEach((r, i) => {
    for (const f of ROW_FIELDS) if (!(f in r)) errors.push(`row ${i} missing ${f}`);
    for (const f of ['onset_req', 'onset_actual', 'frames', 'rt_ms']) {
      const v = r[f];
      if (v !== '' && v != null && !Number.isFinite(Number(v))) errors.push(`row ${i} ${f} NaN`);
    }
    if (String(r.rt_ms) === 'NaN') errors.push(`row ${i} rt NaN`);
  });
  if (expectBalanced) {
    const counts = {};
    for (const r of rows) if (r.block === 'main') counts[r.condition] = (counts[r.condition] || 0) + 1;
    const vals = Object.values(counts);
    if (vals.length > 1) {
      const mx = Math.max(...vals), mn = Math.min(...vals);
      if ((mx - mn) / mx > tolerance) errors.push(`condition imbalance ${JSON.stringify(counts)}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

module.exports = { ROW_FIELDS, CODEBOOK, latinSquare, balancedSequence, buildTimeline, uaHash, makeRow, toCSV, parseCSV, codebookMarkdown, validateRows };
