'use strict';
/**
 * Optional live LLM for RAAHI (A7, §7). OFF by default; never called unless the user enabled it
 * in Settings, pasted their own key and accepted the privacy notice.
 *
 *  - Anthropic Messages API from the browser: POST https://api.anthropic.com/v1/messages with
 *    x-api-key, anthropic-version: 2023-06-01, anthropic-dangerous-direct-browser-access: true.
 *  - Model is user-selectable (default claude-sonnet-5-5; options claude-opus-5-5, claude-haiku-5-5;
 *    IDs are must-verify per fact F-MODELS, so the field stays editable).
 *  - Streaming via SSE (content_block_delta / text_delta; tool_use via input_json_delta).
 *  - Key, enable flag and model live in sessionStorage ONLY (cleared when the tab closes).
 *  - Tools run LOCALLY with src/psych; anything that changes state is returned as a *proposed*
 *    action that the user must Approve in the chat (human-in-the-loop).
 *  - Any error/timeout throws; Mentor catches it and falls back to the offline engine (amber light).
 */
const S = require('../psych/stats.js');
const P = require('../psych/psychometrics.js');
const { apa } = require('../core/format.js');
const { adviseDesign } = require('./engine.js');

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (default)' },
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5' },
];
const DEFAULT_MODEL = MODELS[0].id;
const KEYS = { key: 'zehn.llm.key', enabled: 'zehn.llm.enabled', model: 'zehn.llm.model', ack: 'zehn.llm.privacyAck' };
const PRIVACY_NOTICE = "Turning this on sends your question, the current panel name, a summary of your dataset and selected facts to Anthropic's API using your key. Do not type personal or health information. Your key is kept in this tab's sessionStorage only (never localStorage, never exported) and is cleared when you close the tab.";
const TIMEOUT_MS = 30000;
const MAX_TOOL_ROUNDS = 4;

// ---------------------------------------------------------------- session storage (guarded)
function sess() { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch (e) { return null; } }
const sget = (k) => { try { const s = sess(); return s ? s.getItem(k) : null; } catch (e) { return null; } };
const sset = (k, v) => { try { const s = sess(); if (!s) return; if (v == null) s.removeItem(k); else s.setItem(k, v); } catch (e) { /* storage blocked */ } };

// ---------------------------------------------------------------- grounding snapshot
const STATE_CHANGING = new Set(['goZone', 'setMode', 'startParadigm', 'applyDesignFix', 'pauseGame']);
const num = (x) => (typeof x === 'number' ? x : parseFloat(x));

/** Summary of one paradigm's rows (no pid, no free text). */
function summariseRows(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const main = rows.filter((r) => r.block !== 'practice');
  const byCond = {};
  for (const r of main) {
    const c = r.condition == null ? 'all' : String(r.condition);
    (byCond[c] = byCond[c] || { n: 0, rts: [], correct: 0, scored: 0 }).n++;
    const rt = num(r.rt_ms); if (Number.isFinite(rt)) byCond[c].rts.push(rt);
    if (r.correct === 1 || r.correct === '1' || r.correct === true) { byCond[c].correct++; byCond[c].scored++; } else if (r.correct === 0 || r.correct === '0' || r.correct === false) byCond[c].scored++;
  }
  const conditions = {};
  for (const [c, v] of Object.entries(byCond)) {
    conditions[c] = { trials: v.n };
    if (v.rts.length) { conditions[c].meanRT = +S.mean(v.rts).toFixed(1); if (v.rts.length > 1) conditions[c].sdRT = +S.sd(v.rts).toFixed(1); conditions[c].medianRT = +S.median(v.rts).toFixed(1); }
    if (v.scored) conditions[c].accuracy = +(v.correct / v.scored).toFixed(3);
  }
  return { trials: main.length, practiceTrials: rows.length - main.length, conditions };
}

function currentPanel(sim) {
  const ui = sim.services && sim.services.ui;
  if (!ui) return null;
  return ui.current || (ui.panels && ui.panels.current) || (ui.host && ui.host.current) || (ui.panelHost && ui.panelHost.current) || null;
}

/** facts subset: helplines + model ids + facts whose claim shares words with the question (≤14). */
function factsSubset(sim, question) {
  const all = (sim.data && sim.data.facts) || [];
  const words = String(question || '').toLowerCase().match(/[a-z]{5,}/g) || [];
  const scored = [];
  for (const f of all) {
    if (/^F-H\d|^F-MODELS$/.test(f.id)) continue;
    const hay = (f.claim + ' ' + f.id).toLowerCase();
    const s = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (s) scored.push([s, f]);
  }
  scored.sort((a, b) => b[0] - a[0]);
  const pick = scored.slice(0, 10).map((x) => x[1]).concat(all.filter((f) => /^F-H[1-6]$|^F-MODELS$/.test(f.id)));
  return pick.map((f) => ({ id: f.id, claim: f.claim, value: f.value, unit: f.unit, confidence: f.confidence, replication: f.replication, caveat: f.caveat, source: f.source }));
}

/** Grounding snapshot. Excludes consent logs, IPIP answers, journal/free text, pid. */
function buildSnapshot(sim, question) {
  const st = sim.state || {};
  const datasets = {};
  for (const [k, rows] of Object.entries(sim.datasets || {})) { if (k === 'ipip_big5') continue; const s = summariseRows(rows); if (s) datasets[k] = s; }
  const designs = Array.isArray(st.designs) && st.designs.length ? st.designs[st.designs.length - 1] : null;
  return {
    panel: currentPanel(sim), zone: st.zone, mode: st.mode, week: st.week, difficulty: st.difficulty,
    datasetSummary: datasets, currentDesign: designs, facts: factsSubset(sim, question),
    note: 'Simulated institution; datasets are the learner\'s own practice runs or simulated participants.',
  };
}

function systemPrompt(snapshot) {
  return [
    'You are RAAHI (راہی, "fellow traveller"), the AI lab mentor inside ZEHN, an offline psychology teaching game for BS Psychology students in Pakistan.',
    'Always present yourself as "an AI tutor, not a psychologist or therapist". You may greet in Urdu (e.g., "Assalam-o-alaikum") but answer in clear, simple English unless asked otherwise.',
    'Hard rules:',
    '1. Never act as a therapist for the real user, never diagnose, screen or label the user, never give medication or treatment advice. Redirect personal concerns to a qualified professional and the crisis card.',
    '2. If the user\'s message suggests suicide, self-harm, abuse, or danger to anyone, call the flag_crisis tool immediately and reply only with a short, calm, supportive message pointing to the crisis card and emergency numbers. Do not continue the lesson.',
    '3. Only use numbers that appear in the SNAPSHOT below or in tool results. If a number is not there, say "not in my data". Never invent study results, dates, sample sizes or percentages. Mention when a fact is "must-verify" or has mixed/failed replication.',
    '4. Never reproduce items, plates, stimuli or scoring keys of copyrighted tests (WAIS/WISC, Stanford–Binet, MMPI, Rorschach, TAT, BDI-II, NEO-PI-R, MBTI, Raven\'s) or DSM-5-TR/ICD-11 criteria text. Paraphrase and refer to the official manuals.',
    '5. Coach before computing: when a student asks you to compute something for an assignment, first ask them to try it in the Statistics Workbench, then check their reasoning. Use tools to verify, and report statistics in APA 7 style.',
    '6. roleplay_simulated_client is only allowed when the snapshot zone is "clinic" or mode is "clinic", and only for fictional clients from the game data. Label any role-play as SIMULATION.',
    '7. Anything that changes the game state (moving zones, changing mode, starting a task, editing a design, pausing) must be requested with propose_action; the user will Approve or Reject it. Never claim it is done.',
    'Keep answers short (under 150 words), friendly and Socratic.',
    'SNAPSHOT (JSON):',
    JSON.stringify(snapshot),
  ].join('\n');
}

// ---------------------------------------------------------------- tools (executed locally)
const arr = { type: 'array', items: { type: 'number' } };
const TOOLS = [
  { name: 'get_dataset', description: 'Summary (trials, mean/SD/median RT, accuracy per condition) of the learner\'s local dataset for one paradigm, or list available paradigms if none given.', input_schema: { type: 'object', properties: { paradigm: { type: 'string' } } } },
  { name: 'run_t_test', description: 'Run a t-test locally. Either give arrays a and b, or a paradigm with two condition labels (uses rt_ms).', input_schema: { type: 'object', properties: { a: arr, b: arr, paradigm: { type: 'string' }, condA: { type: 'string' }, condB: { type: 'string' }, paired: { type: 'boolean' }, welch: { type: 'boolean' } } } },
  { name: 'run_anova', description: 'One-way ANOVA locally on groups (array of number arrays) or on rt_ms by condition for a paradigm.', input_schema: { type: 'object', properties: { groups: { type: 'array', items: arr }, paradigm: { type: 'string' } } } },
  { name: 'compute_alpha', description: "Cronbach's alpha for a respondents × items matrix.", input_schema: { type: 'object', properties: { matrix: { type: 'array', items: arr } }, required: ['matrix'] } },
  { name: 'explain_concept', description: 'Look up a term in the ZEHN glossary (868 terms).', input_schema: { type: 'object', properties: { term: { type: 'string' } }, required: ['term'] } },
  { name: 'critique_design', description: 'Ranked design advice cards (counterbalancing, power, confounds, consent/debrief, controls) for a design object, or the current design if omitted.', input_schema: { type: 'object', properties: { design: { type: 'object' } } } },
  { name: 'check_ethics', description: 'Ethics-only checks (consent, debrief after deception, IRB review) for a design object or the current design.', input_schema: { type: 'object', properties: { design: { type: 'object' } } } },
  { name: 'draft_apa_results', description: 'Format a statistics result as an APA 7 sentence fragment. kind: t | F | r | chi2 | alpha.', input_schema: { type: 'object', properties: { kind: { type: 'string', enum: ['t', 'F', 'r', 'chi2', 'alpha'] }, result: { type: 'object' } }, required: ['kind', 'result'] } },
  { name: 'roleplay_simulated_client', description: 'Get a fictional client\'s opening line and profile from the game data (Clinic only).', input_schema: { type: 'object', properties: { clientId: { type: 'string' } }, required: ['clientId'] } },
  { name: 'propose_action', description: 'Propose a state-changing action for the user to Approve/Reject. type: openPanel | goZone | setMode | startParadigm | applyDesignFix | pauseGame.', input_schema: { type: 'object', properties: { type: { type: 'string', enum: ['openPanel', 'goZone', 'setMode', 'startParadigm', 'applyDesignFix', 'pauseGame'] }, arg: {}, label: { type: 'string' }, reason: { type: 'string' } }, required: ['type'] } },
  { name: 'flag_crisis', description: 'Call when the user may be at risk (suicide, self-harm, abuse, harm to others). Shows the crisis card.', input_schema: { type: 'object', properties: { category: { type: 'string', enum: ['suicide', 'self-harm', 'abuse', 'harm-others'] } }, required: ['category'] } },
];

function rtsBy(sim, paradigm, cond) {
  const rows = (sim.datasets || {})[paradigm] || [];
  return rows.filter((r) => r.block !== 'practice' && String(r.condition) === String(cond)).map((r) => num(r.rt_ms)).filter(Number.isFinite);
}

/** Execute one tool locally. ctx = {sim, engine, actions[], onCrisis}. Returns JSON-able result. */
function executeTool(name, input, ctx) {
  const sim = ctx.sim; const inp = input || {};
  const design = () => inp.design || (sim.state && Array.isArray(sim.state.designs) && sim.state.designs[sim.state.designs.length - 1]) || null;
  switch (name) {
    case 'get_dataset': {
      if (!inp.paradigm) return { available: Object.keys(sim.datasets || {}).filter((k) => k !== 'ipip_big5') };
      if (inp.paradigm === 'ipip_big5') return { error: 'Personal questionnaire answers are never shared.' };
      return summariseRows((sim.datasets || {})[inp.paradigm]) || { error: 'not in my data' };
    }
    case 'run_t_test': {
      let a = inp.a, b = inp.b;
      if ((!a || !b) && inp.paradigm) { a = rtsBy(sim, inp.paradigm, inp.condA); b = rtsBy(sim, inp.paradigm, inp.condB); }
      if (!Array.isArray(a) || !Array.isArray(b) || a.length < 2 || b.length < 2) return { error: 'need at least two values per group' };
      const r = inp.paired ? S.tPaired(a.slice(0, Math.min(a.length, b.length)), b.slice(0, Math.min(a.length, b.length))) : S.tIndependent(a, b, { welch: !!inp.welch });
      return Object.assign({ test: inp.paired ? 'paired' : (inp.welch ? 'welch' : 'independent'), apa: apa.t(r) }, r);
    }
    case 'run_anova': {
      let groups = inp.groups;
      if (!groups && inp.paradigm) {
        const conds = Array.from(new Set(((sim.datasets || {})[inp.paradigm] || []).filter((r) => r.block !== 'practice').map((r) => String(r.condition))));
        groups = conds.map((c) => rtsBy(sim, inp.paradigm, c)).filter((g) => g.length > 1);
      }
      if (!Array.isArray(groups) || groups.length < 2) return { error: 'need at least two groups' };
      const r = S.anova1(groups);
      return Object.assign({ apa: apa.F(r) }, r);
    }
    case 'compute_alpha': {
      const m = inp.matrix;
      if (!Array.isArray(m) || m.length < 2 || !Array.isArray(m[0]) || m[0].length < 2) return { error: 'need a respondents × items matrix (≥2 × ≥2)' };
      const a = P.cronbachAlpha(m);
      return { alpha: a, apa: apa.alpha(a), items: m[0].length, respondents: m.length };
    }
    case 'explain_concept': {
      const g = ctx.engine && ctx.engine.lookup(inp.term);
      return g ? { term: g.term, definition: g.def, week: g.week, domain: g.domain, ur: g.ur || null } : { error: 'not in my glossary' };
    }
    case 'critique_design': { const d = design(); return d ? { cards: adviseDesign(d) } : { error: 'no design available' }; }
    case 'check_ethics': {
      const d = design(); if (!d) return { error: 'no design available' };
      return { cards: adviseDesign(d).filter((c) => ['consent', 'debrief', 'irb'].includes(c.id)) };
    }
    case 'draft_apa_results': {
      const f = apa[inp.kind]; if (!f) return { error: 'unknown kind' };
      try { return { text: inp.kind === 'alpha' ? f(num(inp.result.alpha)) : f(inp.result) }; } catch (e) { return { error: 'result is missing fields' }; }
    }
    case 'roleplay_simulated_client': {
      const st = sim.state || {};
      if (st.zone !== 'clinic' && st.mode !== 'clinic') return { error: 'Role-play is only available inside the Clinic (zone or mode "clinic").' };
      const c = ((sim.data && sim.data.clients) || []).find((x) => x.id === inp.clientId);
      if (!c) return { error: 'Only fictional clients from the game data can be role-played.', available: ((sim.data && sim.data.clients) || []).map((x) => x.id) };
      ctx.simulation = true;
      const node = c.nodes && c.nodes[c.start];
      return { banner: 'SIMULATION — fictional client', id: c.id, name: c.name, age: c.age, presenting: c.presenting, culturalNote: c.culturalNote, opening: node ? node.client : '', contentWarning: c.contentWarning || [] };
    }
    case 'propose_action': {
      const a = { type: inp.type, arg: inp.arg, label: inp.label || null, reason: inp.reason || null, stateChanging: STATE_CHANGING.has(inp.type), proposedBy: 'llm' };
      ctx.actions.push(a);
      return { status: 'pending user approval' };
    }
    case 'flag_crisis': { ctx.crisis = inp.category || 'suicide'; if (ctx.onCrisis) ctx.onCrisis(ctx.crisis); return { status: 'crisis card shown' }; }
    default: return { error: 'unknown tool' };
  }
}

// ---------------------------------------------------------------- SSE streaming
/** Parse an SSE byte stream; calls onEvent(type, data). */
async function readSSE(body, onEvent) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.search(/\r?\n\r?\n/)) >= 0) {
      const chunk = buf.slice(0, idx); buf = buf.slice(idx).replace(/^\r?\n\r?\n/, '');
      let ev = 'message'; const data = [];
      for (const line of chunk.split(/\r?\n/)) { if (line.startsWith('event:')) ev = line.slice(6).trim(); else if (line.startsWith('data:')) data.push(line.slice(5).trimStart()); }
      if (!data.length) continue;
      let parsed; try { parsed = JSON.parse(data.join('\n')); } catch (e) { continue; }
      onEvent(parsed.type || ev, parsed);
    }
  }
}

class LLMClient {
  constructor(sim, opts = {}) {
    this.sim = sim;
    this.engine = opts.engine || null;
    this.fetch = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    this.timeoutMs = opts.timeoutMs || TIMEOUT_MS;
  }
  // settings (sessionStorage only)
  hasKey() { return !!sget(KEYS.key); }
  setKey(k) { sset(KEYS.key, k ? String(k).trim() : null); }
  clearKey() { sset(KEYS.key, null); sset(KEYS.enabled, null); }
  isEnabled() { return sget(KEYS.enabled) === '1' && this.hasKey() && sget(KEYS.ack) === '1'; }
  setEnabled(on) { sset(KEYS.enabled, on ? '1' : null); }
  privacyAcknowledged() { return sget(KEYS.ack) === '1'; }
  acknowledgePrivacy(on) { sset(KEYS.ack, on ? '1' : null); }
  getModel() { return sget(KEYS.model) || DEFAULT_MODEL; }
  setModel(m) { sset(KEYS.model, m && String(m).trim() ? String(m).trim() : null); }
  online() { try { return typeof navigator === 'undefined' || navigator.onLine !== false; } catch (e) { return true; } }
  ready() { return this.isEnabled() && !!this.fetch && this.online(); }

  async _stream(body, signal, onText) {
    const res = await this.fetch(API_URL, {
      method: 'POST', signal,
      headers: { 'content-type': 'application/json', 'x-api-key': sget(KEYS.key) || '', 'anthropic-version': API_VERSION, 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(Object.assign({ stream: true }, body)),
    });
    if (!res.ok || !res.body) { let msg = 'HTTP ' + res.status; try { const j = await res.json(); if (j && j.error) msg += ': ' + j.error.message; } catch (e) { /* no body */ } throw new Error(msg); }
    const blocks = []; let stop = null; let err = null;
    await readSSE(res.body, (type, d) => {
      if (type === 'content_block_start') {
        const b = Object.assign({}, d.content_block);
        if (b.type === 'tool_use') { b._json = ''; b.input = {}; }
        if (b.type === 'text') b.text = b.text || '';
        blocks[d.index] = b;
      } else if (type === 'content_block_delta') {
        const b = blocks[d.index]; if (!b) return;
        if (d.delta.type === 'text_delta') { b.text += d.delta.text; if (onText) onText(d.delta.text); } else if (d.delta.type === 'input_json_delta') b._json += d.delta.partial_json;
      } else if (type === 'content_block_stop') {
        const b = blocks[d.index]; if (b && b.type === 'tool_use') { try { b.input = b._json ? JSON.parse(b._json) : {}; } catch (e) { b.input = {}; } delete b._json; }
      } else if (type === 'message_delta') { if (d.delta && d.delta.stop_reason) stop = d.delta.stop_reason; } else if (type === 'error') err = (d.error && d.error.message) || 'stream error';
    });
    if (err) throw new Error(err);
    return { blocks: blocks.filter(Boolean).filter((b) => b.type === 'text' || b.type === 'tool_use'), stop };
  }

  /**
   * ask(question, {onText, history, onCrisis}) → {text, actions, crisis, simulation, toolLog}
   * Throws on any error/timeout (caller falls back offline).
   */
  async ask(question, opts = {}) {
    if (!this.ready()) throw new Error('LLM not enabled');
    const snapshot = buildSnapshot(this.sim, question);
    const messages = (opts.history || []).slice(-8).concat([{ role: 'user', content: String(question) }]);
    const ctx = { sim: this.sim, engine: this.engine, actions: [], crisis: null, simulation: false, onCrisis: opts.onCrisis };
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl && ctrl.abort(), this.timeoutMs);
    const toolLog = []; let text = '';
    try {
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const { blocks, stop } = await this._stream({ model: this.getModel(), max_tokens: 1024, system: systemPrompt(snapshot), tools: TOOLS, messages }, ctrl && ctrl.signal, (t) => { text += t; if (opts.onText) opts.onText(t); });
        const uses = blocks.filter((b) => b.type === 'tool_use');
        if (stop !== 'tool_use' || !uses.length) break;
        messages.push({ role: 'assistant', content: blocks });
        const results = uses.map((u) => {
          let out; try { out = executeTool(u.name, u.input, ctx); } catch (e) { out = { error: e.message }; }
          toolLog.push({ name: u.name, input: u.input, output: out });
          return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out) };
        });
        messages.push({ role: 'user', content: results });
        if (ctx.crisis) break; // stop the flow; mentor shows the crisis message
        if (text && !/\s$/.test(text)) { text += '\n'; if (opts.onText) opts.onText('\n'); }
      }
    } finally { clearTimeout(timer); }
    if (!text.trim() && !ctx.crisis) throw new Error('empty response');
    return { text: text.trim(), actions: ctx.actions, crisis: ctx.crisis, simulation: ctx.simulation, toolLog };
  }
}

module.exports = { LLMClient, currentPanel, MODELS, DEFAULT_MODEL, API_URL, API_VERSION, PRIVACY_NOTICE, TOOLS, STATE_CHANGING, buildSnapshot, systemPrompt, executeTool, summariseRows, readSSE };
