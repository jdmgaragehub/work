'use strict';
/**
 * Clinic dialogue engine and micro-skill scorer (A12). PURE: no DOM, no globals.
 *
 *   const e = new SessionEngine(client);   // client from src/data/clients.json (docs/ARCHITECTURE.md §5)
 *   e.node                                  // current node {client, emotion, options[]}
 *   e.choose(i) → {next, feedback, skill, score}
 *   e.done, e.transcript, e.summary(), e.affectAt(step)
 *
 * Everything here describes the *player's counselling choices* with a *fictional* client.
 * Nothing scores, screens or labels the player (docs/ETHICS_SAFETY.md §1, §7).
 * The rubric is documented in src/clinic/README.md.
 */

const MAX_TURNS = 10;
const SKILLS = ['open', 'closed', 'affirm', 'reflect-simple', 'reflect-complex', 'summarise', 'validate', 'psychoeducate', 'cbt-abc', 'advice-premature', 'judge', 'reassure-false', 'refer'];
const NODE_EMOTIONS = ['sad', 'fear', 'anger', 'neutral', 'joy', 'disgust', 'surprise', 'contempt'];
const FAMILIES = ['anxiety', 'depression', 'trauma', 'ocd', 'psychosis-spectrum', 'eating', 'substance', 'grief', 'adjustment', 'somatic', 'cultural', 'stress'];
/** Client-data emotion names → face2d.EMOTIONS keys. */
const FACE_EMOTION = { sad: 'sadness', fear: 'fear', anger: 'anger', neutral: 'neutral', joy: 'happiness', disgust: 'disgust', surprise: 'surprise', contempt: 'contempt' };

/** Human-readable skill labels for reports. */
const SKILL_LABEL = {
  open: 'Open question', closed: 'Closed question', affirm: 'Affirmation', 'reflect-simple': 'Simple reflection', 'reflect-complex': 'Complex reflection',
  summarise: 'Summary', validate: 'Validation', psychoeducate: 'Psychoeducation', 'cbt-abc': 'CBT ABC link', 'advice-premature': 'Premature advice',
  judge: 'Judgement', 'reassure-false': 'False reassurance', refer: 'Risk check / referral',
};

/**
 * Rogers' core conditions: weight of each skill on each condition (−1..1).
 * empathy = accurate understanding; unconditionalRegard = non-judgemental warmth;
 * congruence = genuineness/honesty (no promises you cannot keep, transparent about limits).
 */
const ROGERS_W = {
  open: { empathy: 0.4, unconditionalRegard: 0.3, congruence: 0.2 },
  closed: { empathy: 0, unconditionalRegard: 0, congruence: 0.1 },
  affirm: { empathy: 0.4, unconditionalRegard: 1, congruence: 0.5 },
  'reflect-simple': { empathy: 0.5, unconditionalRegard: 0.3, congruence: 0.3 },
  'reflect-complex': { empathy: 1, unconditionalRegard: 0.5, congruence: 0.4 },
  summarise: { empathy: 0.7, unconditionalRegard: 0.4, congruence: 0.6 },
  validate: { empathy: 0.8, unconditionalRegard: 1, congruence: 0.5 },
  psychoeducate: { empathy: 0.1, unconditionalRegard: 0.2, congruence: 0.5 },
  'cbt-abc': { empathy: 0.4, unconditionalRegard: 0.3, congruence: 0.5 },
  'advice-premature': { empathy: -0.5, unconditionalRegard: -0.4, congruence: -0.1 },
  judge: { empathy: -0.8, unconditionalRegard: -1, congruence: -0.4 },
  'reassure-false': { empathy: -0.6, unconditionalRegard: -0.1, congruence: -1 },
  refer: { empathy: 0.3, unconditionalRegard: 0.4, congruence: 1 },
};

const RISK_ASK_RE = /(ending|end) your life|kill(ing)? yourself|harm(ing)? yourself|harm yourself or anyone|suicid|thoughts? of (dying|death)/i;
const SAFETY_RE = /safety plan|\bsafe\b|crisis|emergency|psychiatr|doctor|refer|helpline|who you('ll| will| can) (tell|wake|reach|contact)|if (those|the) (thoughts|feelings) (get|become) stronger/i;
const RISK_TOPICS = ['suicide', 'self-harm'];

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const r2 = (x) => Math.round(x * 100) / 100;

/** An option that asks the client directly about suicide/self-harm/harm to others. */
function isRiskAsk(opt) { return !!opt && opt.skill === 'refer' && RISK_ASK_RE.test(opt.text || ''); }
/** An option that plans safety or makes a concrete referral (well-scored summary/referral). */
function isSafetyPlan(opt) { return !!opt && (opt.skill === 'refer' || opt.skill === 'summarise') && (opt.score | 0) >= 2 && SAFETY_RE.test(opt.text || ''); }

/** A risk client either carries a suicide/self-harm warning or contains a direct risk-assessment option. */
function isRiskClient(client) {
  if (!client) return false;
  if ((client.contentWarning || []).some((w) => RISK_TOPICS.includes(String(w).toLowerCase()))) return true;
  return Object.values(client.nodes || {}).some((n) => (n.options || []).some(isRiskAsk));
}

/** Index of the highest-scoring option (first on ties). */
function bestIndex(node) { let b = 0; node.options.forEach((o, i) => { if (o.score > node.options[b].score) b = i; }); return b; }
/** Index of the lowest-scoring option (first on ties). */
function worstIndex(node) { let b = 0; node.options.forEach((o, i) => { if (o.score < node.options[b].score) b = i; }); return b; }

/** Maximum achievable total from a node (DAG; guarded against cycles). */
function maxFrom(client, id, memo = {}, stack = new Set()) {
  if (id == null || !client.nodes[id]) return 0;
  if (id in memo) return memo[id];
  if (stack.has(id)) return 0;
  stack.add(id);
  let best = -Infinity;
  for (const o of client.nodes[id].options) best = Math.max(best, o.score + maxFrom(client, o.next, memo, stack));
  stack.delete(id);
  memo[id] = best === -Infinity ? 0 : best;
  return memo[id];
}

/** Simulated screener totals for the fictional client (item text is never shipped). */
function screenerTotals(client) {
  const s = (client && client.simulatedScreeners) || {};
  const sum = (a) => (Array.isArray(a) ? a.reduce((x, y) => x + y, 0) : null);
  const phq = sum(s.phq9), gad = sum(s.gad7);
  const phqBand = (t) => (t <= 4 ? 'minimal' : t <= 9 ? 'mild' : t <= 14 ? 'moderate' : t <= 19 ? 'moderately severe' : 'severe');
  const gadBand = (t) => (t <= 4 ? 'minimal' : t <= 9 ? 'mild' : t <= 14 ? 'moderate' : 'severe');
  return {
    phq9: phq == null ? null : { total: phq, max: 27, band: phqBand(phq) },
    gad7: gad == null ? null : { total: gad, max: 21, band: gadBand(gad) },
    note: 'Simulated screener scores for a fictional client; screeners are not diagnoses.',
  };
}

class SessionEngine {
  constructor(client) {
    if (!client || !client.nodes || !client.nodes[client.start]) throw new Error('SessionEngine: invalid client ' + (client && client.id));
    this.client = client;
    this.nodeId = client.start;
    this.transcript = [];
    this.done = false;
    this.riskCase = isRiskClient(client);
    this._max = maxFrom(client, client.start);
    const a = client.affect || { valence: 0, arousal: 0.5 };
    this._affect = [{ valence: clamp(+a.valence || 0, -1, 1), arousal: clamp(+a.arousal || 0, 0, 1) }];
  }

  get node() { return this.done ? null : this.client.nodes[this.nodeId] || null; }
  get step() { return this.transcript.length; }

  /** Pick option `optionIndex` (0-based) at the current node. */
  choose(optionIndex) {
    if (this.done) throw new Error('Session finished');
    const node = this.node;
    const opt = node.options[optionIndex];
    if (!opt) throw new Error('No option ' + optionIndex);
    const prev = this._affect[this._affect.length - 1];
    const sc = opt.score | 0;
    // Good replies settle the client (valence up, arousal toward calm); poor replies hurt and agitate.
    const valence = clamp(prev.valence + 0.07 * sc - (sc < 0 ? 0.04 : 0), -1, 1);
    const arousal = clamp(prev.arousal + (sc < 0 ? 0.1 * -sc : -0.03 * sc) + (node.emotion === 'fear' || node.emotion === 'anger' ? 0.02 : 0), 0, 1);
    const affect = { valence: r2(valence), arousal: r2(arousal) };
    this._affect.push(affect);
    this.transcript.push({
      step: this.transcript.length + 1, nodeId: this.nodeId, client: node.client, emotion: node.emotion,
      optionIndex, text: opt.text, skill: opt.skill, score: sc, feedback: opt.feedback, riskAsk: isRiskAsk(opt), safetyPlan: isSafetyPlan(opt), affect,
    });
    const next = opt.next != null && this.client.nodes[opt.next] ? opt.next : null;
    this.nodeId = next;
    if (next == null || this.transcript.length >= MAX_TURNS) this.done = true;
    return { next, feedback: opt.feedback, skill: opt.skill, score: sc };
  }

  /** Simulated client affect after `step` replies (0 = arrival). Clamped to the last step. */
  affectAt(step) {
    const i = clamp(Math.floor(step == null ? this._affect.length - 1 : step), 0, this._affect.length - 1);
    return Object.assign({}, this._affect[i]);
  }

  summary() {
    const t = this.transcript;
    const total = t.reduce((s, x) => s + x.score, 0);
    const bySkill = {};
    for (const k of SKILLS) bySkill[k] = 0;
    for (const x of t) bySkill[x.skill] = (bySkill[x.skill] || 0) + 1;
    bySkill.reflect = bySkill['reflect-simple'] + bySkill['reflect-complex']; // aggregate for OARS convenience
    const oars = { open: bySkill.open, affirm: bySkill.affirm, reflect: bySkill.reflect, summarise: bySkill.summarise };

    const acc = { empathy: 0, unconditionalRegard: 0, congruence: 0 };
    for (const x of t) {
      const w = ROGERS_W[x.skill] || {};
      const quality = clamp((x.score + 1) / 4, 0.25, 1); // a 0-scored "refer" earns less than a 3-scored one
      for (const k in acc) { const v = w[k] || 0; acc[k] += v > 0 ? v * quality : v; }
    }
    const n = Math.max(1, t.length);
    const rogers = {};
    for (const k in acc) rogers[k] = r2(clamp(0.5 + 0.5 * (acc[k] / n), 0, 1));

    const askIdx = t.findIndex((x) => x.riskAsk);
    const riskAsked = askIdx >= 0;
    const safetyPlanned = riskAsked && t.slice(askIdx + 1).some((x) => x.safetyPlan);
    const riskHandled = this.riskCase && riskAsked && safetyPlanned;
    const missedRisk = this.riskCase && !riskAsked;

    const strengths = [], growth = [];
    if (bySkill.open) strengths.push(`Used ${bySkill.open} open question(s) to invite the client's own story.`);
    if (bySkill['reflect-complex']) strengths.push(`Offered ${bySkill['reflect-complex']} complex reflection(s), naming feeling or meaning beneath the words (accurate empathy).`);
    if (bySkill.affirm) strengths.push('Affirmed genuine strengths and effort, building the alliance.');
    if (bySkill.validate) strengths.push('Validated the client\'s experience without judgement.');
    if (bySkill.summarise) strengths.push('Summarised to check understanding and pull threads together.');
    if (t.some((x) => /^r\d/.test(x.nodeId) && x.score > 0)) strengths.push('Repaired a rupture by owning a misstep and returning to empathy.');
    if (riskHandled) strengths.push('Asked directly about risk, then moved to safety planning and referral.');
    if (bySkill.judge) growth.push(`Judgement appeared ${bySkill.judge} time(s): it breaks unconditional positive regard and shuts down disclosure.`);
    if (bySkill['reassure-false']) growth.push(`False reassurance appeared ${bySkill['reassure-false']} time(s): promises you cannot keep reduce congruence and close the topic.`);
    if (bySkill['advice-premature']) growth.push('Advice came before understanding; explore first, then plan together.');
    if (bySkill.closed >= 3) growth.push('Many closed questions; swap some for open questions or reflections.');
    if (!bySkill['reflect-complex'] && bySkill['reflect-simple']) growth.push('Reflections stayed at surface level; try adding the feeling or meaning.');
    if (!bySkill.summarise && t.length >= 4) growth.push('No summary offered; a summary near the end checks understanding and sets next steps.');
    if (missedRisk) growth.push('A risk disclosure was not followed by a direct question about thoughts, plan and intent. Always ask calmly and directly.');
    else if (this.riskCase && riskAsked && !safetyPlanned) growth.push('Risk was asked about but no safety plan or referral followed.');
    if (!strengths.length) strengths.push('You stayed with the client to the end of the session.');
    if (!growth.length) growth.push('Keep practising: try a different client family to stretch the same skills.');

    return {
      clientId: this.client.id, turns: t.length, completed: this.done,
      total, max: this._max, pct: this._max > 0 ? r2(clamp(total / this._max, -1, 1)) : 0,
      bySkill, oars, rogers, strengths, growth,
      riskCase: this.riskCase, riskAsked, safetyPlanned, riskHandled,
      affectStart: this.affectAt(0), affectEnd: this.affectAt(t.length),
    };
  }
}

/**
 * Validate a list of clients against docs/ARCHITECTURE.md §5.
 * Checks fields, enums, score ranges, links, cycles and that every path ends within MAX_TURNS.
 * → {ok, errors:[string], count}
 */
function validateClients(list) {
  const errors = [];
  const err = (id, m) => errors.push(`${id}: ${m}`);
  if (!Array.isArray(list)) return { ok: false, errors: ['clients is not an array'], count: 0 };
  const ids = new Set();
  for (const c of list) {
    const id = (c && c.id) || '?';
    if (ids.has(id)) err(id, 'duplicate id');
    ids.add(id);
    for (const k of ['id', 'name', 'presenting', 'background', 'start', 'supervision', 'referral', 'family']) if (typeof c[k] !== 'string' || !c[k]) err(id, 'missing ' + k);
    if (!/fictional/i.test(c.name || '')) err(id, 'name must be marked (fictional)');
    if (typeof c.age !== 'number') err(id, 'age not a number');
    if (!FAMILIES.includes(c.family)) err(id, 'unknown family ' + c.family);
    if (!Array.isArray(c.contentWarning)) err(id, 'contentWarning must be an array');
    if (!c.affect || typeof c.affect.valence !== 'number' || typeof c.affect.arousal !== 'number') err(id, 'affect missing');
    const s = c.simulatedScreeners;
    if (!s) err(id, 'simulatedScreeners missing');
    else {
      for (const [k, len] of [['phq9', 9], ['gad7', 7]]) {
        const a = s[k];
        if (a == null) continue;
        if (!Array.isArray(a) || a.length !== len || a.some((v) => !Number.isInteger(v) || v < 0 || v > 3)) err(id, `${k} must be ${len} integers 0-3 or null`);
      }
    }
    const nodes = c.nodes || {};
    if (!nodes[c.start]) { err(id, 'start node missing'); continue; }
    for (const [nid, n] of Object.entries(nodes)) {
      if (typeof n.client !== 'string' || !n.client) err(id, nid + ' empty utterance');
      if (!NODE_EMOTIONS.includes(n.emotion)) err(id, nid + ' bad emotion ' + n.emotion);
      if (!Array.isArray(n.options) || n.options.length < 2 || n.options.length > 3) { err(id, nid + ' needs 2-3 options'); continue; }
      n.options.forEach((o, i) => {
        if (!SKILLS.includes(o.skill)) err(id, `${nid}[${i}] bad skill ${o.skill}`);
        if (!Number.isInteger(o.score) || o.score < -2 || o.score > 3) err(id, `${nid}[${i}] score out of -2..3`);
        if (o.next != null && !nodes[o.next]) err(id, `${nid}[${i}] dangling next ${o.next}`);
        if (!o.text || !o.feedback) err(id, `${nid}[${i}] missing text/feedback`);
      });
    }
    // every path terminates within MAX_TURNS, no cycles
    const longest = (nid, stack) => {
      if (nid == null) return 0;
      if (stack.includes(nid)) { err(id, 'cycle via ' + stack.concat(nid).join('>')); return Infinity; }
      const n = nodes[nid];
      if (!n || !Array.isArray(n.options)) return 0;
      let m = 0;
      for (const o of n.options) { m = Math.max(m, 1 + longest(o.next, stack.concat(nid))); if (m === Infinity) break; }
      return m;
    };
    const L = longest(c.start, []);
    if (L > MAX_TURNS) err(id, `path longer than ${MAX_TURNS} turns (${L})`);
    // reachability
    const seen = new Set(); const q = [c.start];
    while (q.length) { const x = q.pop(); if (x == null || seen.has(x) || !nodes[x]) continue; seen.add(x); for (const o of nodes[x].options || []) q.push(o.next); }
    for (const nid of Object.keys(nodes)) if (!seen.has(nid)) err(id, nid + ' unreachable');
    if (isRiskClient(c) && !Object.values(nodes).some((n) => (n.options || []).some(isRiskAsk))) err(id, 'risk client has no direct risk-assessment option');
  }
  return { ok: errors.length === 0, errors, count: list.length };
}

module.exports = {
  SessionEngine, validateClients, isRiskClient, isRiskAsk, isSafetyPlan, bestIndex, worstIndex, maxFrom, screenerTotals,
  MAX_TURNS, SKILLS, SKILL_LABEL, NODE_EMOTIONS, FACE_EMOTION, FAMILIES, ROGERS_W,
};
