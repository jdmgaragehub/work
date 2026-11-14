'use strict';
/**
 * RAAHI offline intent engine (A7, §7). PURE — no DOM, no network.
 *
 *   const eng = new IntentEngine({ intents, glossary, facts })
 *   eng.match(text, context)      → ranked [{id, category, score, matched, intent}]
 *   eng.lookup(term)              → glossary entry | null
 *   eng.glossaryQuery(text)       → {term, entry} | null   ("what is X", "define X", "X kya hai")
 *   eng.refusal(text)             → {kind, text, action?} | null (copyright, DSM text, diagnosis, therapy, compute-for-me)
 *   eng.respond(text, context)    → {text, cards, action, intentId, kind, crisis}
 *   adviseDesign(design)          → ranked advice cards [{id, severity, title, why, recommendation, impact, oneClickAction:{type, arg, label}}]
 *
 * Scoring (specificity): category priority (crisis > safety > nav > stats/design > ethics/method > concept > meta)
 * + matched-span length + extra patterns matched + current week / current panel boost.
 */
const crisis = require('./crisis.js');
const S = require('../psych/stats.js');
const { latinSquare } = require('../exp/core/timeline.js');
const { PANELS } = require('../ui/panels/meta.js'); // pure data (ids, titles)

const ZONES = [
  ['courtyard', 'central courtyard'], ['wundt', 'wundt hall'], ['explab', 'experimental lab wing'], ['neuro', 'neuro atrium'],
  ['sleep', 'sleep and consciousness lab'], ['learning', 'learning lab'], ['childdev', 'child development suite'],
  ['clinic', 'counselling and clinic centre'], ['mohalla', 'social psychology plaza mohalla'], ['library', 'methods and stats library'],
];
const NAV_RE = /^(?:please |can you |could you )?(?:open|show(?: me)?|launch|bring up|go to|take me to|navigate to|display|teleport (?:me )?to)\s+(?:the\s+)?(.+?)(?:\s+(?:panel|zone|room|please))?\s*[.!?]*$/i;

const PRIORITY = { crisis: 1000, safety: 80, nav: 60, stats: 50, design: 50, ethics: 46, method: 44, concept: 30, meta: 20 };
const SEV_RANK = { high: 3, medium: 2, low: 1 };

const norm = (t) => String(t == null ? '' : t).replace(/[‘’ʼ]/g, "'").replace(/\s+/g, ' ').trim();
/** Key for glossary comparison: lower, no possessive/apostrophes/punctuation, no leading article. */
const termKey = (t) => norm(t).toLowerCase().replace(/'s\b/g, '').replace(/['’`]/g, '').replace(/[-_/]/g, ' ')
  .replace(/[^\p{L}\p{N} ]/gu, '').replace(/^(the|a|an) /, '').replace(/\s+/g, ' ').trim();

function compile(src) { try { return new RegExp(src, 'iu'); } catch (e) { try { return new RegExp(src, 'i'); } catch (e2) { return null; } } }

// ---------------------------------------------------------------- refusal rules
const COPYRIGHT_TESTS = "(?:wais(?:-?iv|-?5)?|wisc(?:-?v|-?iv)?|wechsler|stanford[- ]binet|mmpi(?:-?2(?:-rf)?|-?3)?|minnesota multiphasic|rorschach|inkblots?|tat|thematic apperception|bdi(?:-?ii)?|beck depression inventory|neo[- ]?pi(?:-?r|-?3)?|neo[- ]ffi|mbti|myers[- ]briggs|raven'?s?(?: progressive)?(?: matrices)?|progressive matrices)";
const REQUEST = '(?:give|show|list|send|share|copy|reproduce|print|quote|write( out)?|tell me|what are|paste|provide|leak|let me (?:see|take)|take|administer|i want|need)';
const ITEMS = '(?:items?|questions?|plates?|cards?|stimul(?:i|us)|scoring(?: key| keys| manual)?|answer key|answers|norms tables?|manual|full test|the test|test itself|subtests? items)';
const REFUSALS = [
  { kind: 'copyright', res: [
    new RegExp(`\\b${REQUEST}\\b.{0,40}\\b${COPYRIGHT_TESTS}\\b.{0,30}\\b${ITEMS}\\b`, 'i'),
    new RegExp(`\\b${ITEMS}\\b.{0,20}\\b(?:of|from|for|in)\\b.{0,10}\\b${COPYRIGHT_TESTS}\\b`, 'i'),
    new RegExp(`\\b(?:take|do|give me|administer)\\b.{0,10}\\b(?:the )?${COPYRIGHT_TESTS}\\b`, 'i'),
    /\b(?:show|give)\b.{0,15}\b(?:rorschach|inkblot|tat) (?:plates?|cards?|images?|pictures?)\b/i,
  ], text: "I can't reproduce items, plates, stimuli or scoring keys from copyrighted tests (WAIS/WISC, Stanford–Binet, MMPI, Rorschach, TAT, BDI-II, NEO-PI-R, MBTI, Raven's). I can explain what the test measures, how it was built and validated, and its strengths and criticisms. For practice, ZEHN has public-domain IPIP items and original matrices-style puzzles.", action: { type: 'openPanel', arg: 'psychometrics' } },
  { kind: 'dsm', res: [
    /\b(?:give|list|copy|quote|show|tell|what are|paste|reproduce|write)\b.{0,30}\b(?:dsm(?:-?5(?:-?tr)?)?|icd(?:-?11|-?10)?)\b.{0,25}\b(?:criteria|criterion|text|checklist|symptoms list)\b/i,
    /\b(?:dsm(?:-?5(?:-?tr)?)?|icd(?:-?11)?)\b.{0,10}\bcriteria\b.{0,10}\b(?:for|of)\b/i,
    /\bdiagnostic criteria (?:for|of)\b/i,
  ], text: "I can't copy DSM-5-TR or ICD-11 criteria text. I can describe the condition in my own words for learning, using simulated cases, and point you to the official manuals for the actual criteria.", action: { type: 'openPanel', arg: 'psychopathology' } },
  { kind: 'coach', res: [
    /\b(?:compute|calculate|run|do|work out|solve|find|give me)\b.{0,30}\b(?:t[- ]?test|anova|chi[- ]?squared?|correlation|regression|alpha|kappa|p[- ]?value|d[- ]?prime|effect size|cohen'?s? d|stats|statistics|sd|standard deviation|mean)\b.{0,25}\bfor me\b/i,
    /\b(?:do|finish|solve|write) my (?:homework|assignment|worksheet|lab report|stats)\b/i,
    /\bjust (?:give|tell) me the (?:answer|p[- ]?value|result|number)s?\b/i,
  ], text: "Let's make sure you can do this in the exam too: try it yourself first in the Statistics Workbench. Enter your data, pick the test, and predict the direction of the effect before you press Compute. Tell me what you get and I'll check your reasoning and your APA write-up step by step.", action: { type: 'openPanel', arg: 'stats' } },
  { kind: 'diagnosis', res: [
    /\b(?:diagnose|assess|screen|evaluate|analy[sz]e)\b.{0,10}\b(?:me|myself)\b/i,
    /\btest me for\b/i,
    /\bdo i (?:have|suffer from)\b/i,
    /\bam i (?:depressed|bipolar|autistic|adhd|ocd|anxious|schizophrenic|psychotic|a psychopath|a narcissist|narcissistic|mentally ill|normal|crazy|okay mentally)\b/i,
    /\bwhat'?s wrong with me\b/i,
    /\bwhat (?:disorder|condition|mental illness) do i have\b/i,
    /\bmujhe kya (?:bimari|bemari|masla) hai\b/i,
  ], text: "I'm an AI tutor, not a psychologist or therapist, so I can't diagnose you, and ZEHN never screens or labels players. If something is worrying you, a qualified professional such as a university counsellor or psychologist is the right person to talk to. The crisis card in Settings lists support lines. I'm happy to explain the topic in general terms for your studies.", action: { type: 'openPanel', arg: 'settings' } },
  { kind: 'therapy', res: [
    /\b(?:be|act as|become|pretend to be)\b.{0,6}\b(?:my )?(?:therapist|psychologist|counsell?or|psychiatrist|doctor)\b/i,
    /\b(?:give|do) (?:me )?(?:therapy|counsell?ing|a therapy session)\b/i,
    /\b(?:treat|counsel) me\b/i,
  ], text: "I'm RAAHI, an AI tutor, not a psychologist or therapist, so I can't provide therapy or counselling for you. I can teach how therapies work and let you practise counselling micro-skills with simulated clients in the Clinic. For real support, please contact a qualified professional; the crisis card lists helplines.", action: { type: 'openPanel', arg: 'settings' } },
];

// ---------------------------------------------------------------- glossary queries
const GLOSS_Q = [
  /^(?:please )?(?:what(?:'s| is| are| does)|whats|wat is)\s+(?:the |a |an )?(?:meaning of |definition of |term )?(.+?)(?:\s+mean(?:s)?)?\s*[?.!]*$/i,
  /^(?:please )?(?:define|definition of|meaning of|explain|describe|tell me about|what do you mean by)\s+(?:the |a |an )?(.+?)\s*[?.!]*$/i,
  /^(.+?)\s+(?:kya|kia)\s+(?:hai|hota hai|hoti hai|hain|he)\s*[?.!]*$/i,
  /^(.+?)\s*[?]$/,
];

// ---------------------------------------------------------------- advice cards
const card = (id, severity, title, why, recommendation, impact, oneClickAction) => ({ id, severity, title, why, recommendation, impact, oneClickAction });

/** Count conditions from a tolerant design object. */
function conditionsOf(d) {
  if (Array.isArray(d.conditions)) return d.conditions.length;
  if (Array.isArray(d.ivs) && d.ivs.length) return d.ivs.reduce((k, iv) => k * Math.max(1, (iv.levels || []).length), 1);
  if (Array.isArray(d.levels)) return d.levels.length;
  return d.k || 0;
}
function isWithin(d) {
  if (typeof d.within === 'boolean') return d.within;
  if (d.designType) return /within|repeated/i.test(d.designType);
  if (Array.isArray(d.ivs) && d.ivs.length) return d.ivs.some((iv) => iv.within);
  return false;
}
const truthy = (v) => v === true || v === 'yes' || v === 1;
const isFalse = (v) => v === false || v === 'no' || v === 0 || v === 'none';

/**
 * adviseDesign(design) → ranked cards. Accepted fields (all optional):
 * {name, paradigm, within|designType|ivs[{name, levels[], within}], conditions[], counterbalance:'none'|'latin'|'random'|'reverse',
 *  n (total), nPerGroup, expectedD, alpha, deception, debrief, consent, recordsRT, randomAssignment, control,
 *  confounds[], blinding, manipulationCheck, practice, trialsPerCondition, attentionChecks, irbApproved}
 */
function adviseDesign(design) {
  const d = design || {};
  const cards = [];
  const k = conditionsOf(d);
  const within = isWithin(d);
  const groups = within ? 1 : Math.max(k, 2);
  const label = d.name || d.paradigm || 'your design';

  // 1. counterbalancing
  const cb = String(d.counterbalance == null ? 'none' : d.counterbalance).toLowerCase();
  if (within && k >= 2 && (cb === 'none' || cb === 'false' || cb === '')) {
    const rows = latinSquare(k).length;
    cards.push(card('counterbalance', 'high', `${label} is not counterbalanced`,
      `Every participant meets the ${k} conditions in the same order, so practice, fatigue and carry-over effects are confounded with the condition.`,
      `Use a balanced (Williams) Latin square so each condition appears in each serial position and follows every other condition equally often.`,
      `${rows} condition orders; assign participants in multiples of ${rows}.`,
      { type: 'applyDesignFix', arg: { counterbalance: 'latin' }, label: 'Add Latin square' }));
  }

  // 2. power / sample size
  const dExp = Math.abs(+d.expectedD || +d.effectSize || 0.5);
  const alpha = +d.alpha || 0.05;
  const nTotal = +d.n || (d.nPerGroup ? +d.nPerGroup * groups : 0);
  if (nTotal > 0) {
    let power, needTotal;
    if (within) {
      // paired design (normal approx.): power = Φ(dz·√n − z₁₋α/₂); equivalent to two-sample with n/2 → 2n
      power = S.powerTwoSample(dExp, nTotal * 2, alpha);
      needTotal = Math.ceil(S.nForPower(dExp, 0.8, alpha) / 2);
    } else {
      power = S.powerTwoSample(dExp, nTotal / groups, alpha);
      needTotal = S.nForPower(dExp, 0.8, alpha) * groups;
    }
    if (power < 0.8) {
      cards.push(card('power', power < 0.5 ? 'high' : 'medium', `Sample too small (power ≈ ${power.toFixed(2).replace(/^0/, '')})`,
        `With N = ${nTotal} and an expected effect of d = ${dExp.toFixed(2)} (α = ${alpha}), a real effect would be missed ${Math.round((1 - power) * 100)}% of the time, and significant results would overestimate the effect.`,
        `Run a power analysis before collecting data and aim for power ≥ .80${within ? '' : ' per group'}. Pre-register the target N.`,
        `Needed: N ≈ ${needTotal}${within ? '' : ` (${needTotal / groups} per group)`} for power .80 (normal approximation).`,
        { type: 'applyDesignFix', arg: { n: needTotal }, label: `Set N = ${needTotal}` }));
    }
  } else {
    cards.push(card('power-missing', 'medium', 'No sample size planned',
      'Without a planned N you cannot know whether the study can detect the effect you care about, and stopping when p < .05 inflates false positives.',
      'Decide N in advance with a power analysis (Statistics Workbench → Power).', 'Prevents optional stopping and underpowered results.',
      { type: 'openPanel', arg: 'stats', label: 'Open power calculator' }));
  }

  // 3. deception without debrief / consent
  if (truthy(d.deception) && !truthy(d.debrief)) {
    cards.push(card('debrief', 'high', 'Deception without a debrief',
      'Participants who are deceived must be told the truth as soon as possible, with the purpose explained and the chance to withdraw their data (APA Ethics Code 8.07, 8.08).',
      'Add a mandatory debriefing screen that explains the deception, its purpose and safeguards, and offers data deletion.',
      'Required for IRB approval; avoids the ethics penalty.',
      { type: 'applyDesignFix', arg: { debrief: true }, label: 'Add debrief' }));
  }
  if (isFalse(d.consent) || (d.consent == null && truthy(d.recordsRT))) {
    cards.push(card('consent', 'high', 'No informed-consent step',
      'Recording responses or reaction times needs informed consent: purpose, duration, what is recorded, the right to withdraw without penalty and where the data are stored.',
      'Add a participant-style consent screen before the first trial.', 'Required before any RT task (G14).',
      { type: 'applyDesignFix', arg: { consent: true }, label: 'Add consent screen' }));
  }

  // 4. confounds
  const confounds = Array.isArray(d.confounds) ? d.confounds.filter(Boolean) : [];
  for (const c of confounds) {
    cards.push(card('confound-' + termKey(c).replace(/ /g, '-'), 'high', `Possible confound: ${c}`,
      `"${c}" varies together with your independent variable, so any difference in the DV could be caused by it instead of the manipulation.`,
      `Hold "${c}" constant across conditions, or counterbalance/randomise it, or measure it and include it as a covariate.`,
      'Restores internal validity of the causal claim.',
      { type: 'applyDesignFix', arg: { controlVariable: c }, label: `Hold ${c} constant` }));
  }
  if (!within && k >= 2 && isFalse(d.randomAssignment)) {
    cards.push(card('random-assign', 'high', 'Groups are not randomly assigned',
      'Without random assignment, pre-existing differences between groups (selection effects) are confounded with the manipulation.',
      'Randomly assign participants to conditions (seeded, so it is reproducible).', 'Turns a quasi-experiment into a true experiment.',
      { type: 'applyDesignFix', arg: { randomAssignment: true }, label: 'Randomise assignment' }));
  }

  // 5. control condition
  if (isFalse(d.control)) {
    cards.push(card('control', 'medium', 'No control condition',
      'Without a control or baseline condition you cannot tell whether change is due to the manipulation, time, practice or expectation.',
      'Add a neutral/control condition (e.g., neutral Stroop trials, placebo, or wait-list).', 'Gives a baseline for the effect size.',
      { type: 'applyDesignFix', arg: { control: true }, label: 'Add control condition' }));
  }

  // 6. trials, practice, checks
  const tpc = +d.trialsPerCondition || 0;
  if (tpc > 0 && tpc < 10) {
    cards.push(card('trials', 'medium', `Only ${tpc} trials per condition`,
      'RT means from few trials are noisy and very sensitive to single slow responses.',
      'Use at least 20 trials per condition for RT measures (more for small effects).', 'Lower measurement error, higher power.',
      { type: 'applyDesignFix', arg: { trialsPerCondition: 20 }, label: 'Set 20 trials/condition' }));
  }
  if (isFalse(d.practice) || d.practice === 0) {
    cards.push(card('practice', 'low', 'No practice block',
      'The first trials mix learning the task with doing it, which adds noise to early condition means.',
      'Add a short practice block (6–10 trials) that is excluded from analysis.', 'Cleaner data from trial 1.',
      { type: 'applyDesignFix', arg: { practice: 8 }, label: 'Add 8 practice trials' }));
  }
  if (isFalse(d.blinding) && !within) {
    cards.push(card('blinding', 'low', 'Experimenter is not blind to condition',
      'Experimenter expectancy can leak into instructions or coding.',
      'Automate instructions or keep coders blind to condition.', 'Reduces experimenter bias.',
      { type: 'applyDesignFix', arg: { blinding: 'single' }, label: 'Make single-blind' }));
  }
  if (isFalse(d.manipulationCheck)) {
    cards.push(card('manip-check', 'low', 'No manipulation check',
      'A null result is hard to interpret if you cannot show the manipulation actually worked.',
      'Add a short manipulation-check question after the task.', 'Makes null results interpretable.',
      { type: 'applyDesignFix', arg: { manipulationCheck: true }, label: 'Add manipulation check' }));
  }
  if (isFalse(d.irbApproved)) {
    cards.push(card('irb', 'medium', 'Not yet reviewed by the ethics board',
      'Studies with human participants need ethics review before data collection.',
      'Submit the design to the IRB chamber for a decision.', 'Required before running real participants.',
      { type: 'openPanel', arg: 'irb', label: 'Open Ethics Board' }));
  }

  return cards.sort((a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity]);
}

// ---------------------------------------------------------------- engine
class IntentEngine {
  constructor(data = {}) {
    this.intents = [];
    this.glossary = Array.isArray(data.glossary) ? data.glossary : [];
    this.facts = Array.isArray(data.facts) ? data.facts : [];
    for (const it of (data.intents || [])) {
      const res = (it.patterns || []).map(compile).filter(Boolean);
      if (res.length) this.intents.push({ intent: it, res });
    }
    this.byId = new Map(this.intents.map((x) => [x.intent.id, x.intent]));
    this.gloss = new Map();
    for (const g of this.glossary) if (g && g.term) this.gloss.set(termKey(g.term), g);
  }

  get size() { return this.intents.length; }

  /** Generic "open X" / "take me to X" resolution against panel titles and zone names. */
  navTarget(text) {
    const m = NAV_RE.exec(norm(text));
    if (!m) return null;
    const q = termKey(m[1]).replace(/ and /g, ' ');
    if (!q) return null;
    const words = q.split(' ').filter((w) => w.length > 2);
    const scoreOf = (name) => { const n = termKey(name).replace(/&/g, ' '); if (n === q) return 100; return words.filter((w) => n.includes(w)).length; };
    let best = null;
    for (const p of PANELS) { const sc = Math.max(scoreOf(p.title), p.id === q ? 100 : 0); if (sc > 0 && (!best || sc > best.sc)) best = { sc, action: { type: 'openPanel', arg: p.id }, label: p.title }; }
    for (const [id, name] of ZONES) { const sc = Math.max(scoreOf(name), id === q ? 100 : 0) + (/^take me|^go to|^teleport|^navigate/i.test(norm(text)) ? 0.5 : 0); if (sc > 0.5 && (!best || sc > best.sc)) best = { sc, action: { type: 'goZone', arg: id }, label: name }; }
    return best;
  }

  /** Ranked intents for text. context = {week, panel, zone, mode}. */
  match(text, context = {}) {
    const t = norm(text);
    if (!t) return [];
    const out = [];
    const det = crisis.detect(t);
    if (det.crisis) {
      const want = { suicide: 'k_suicidal', 'self-harm': 'k_self_harm', abuse: 'k_abuse', 'harm-others': 'k_other_at_risk' }[det.category];
      const it = this.byId.get(want) || this.intents.map((x) => x.intent).find((i) => i.category === 'crisis')
        || { id: 'k_detector', category: 'crisis', answer: '', action: { type: 'showCrisis' } };
      out.push({ id: it.id, category: 'crisis', score: PRIORITY.crisis + 100, matched: det.matched, intent: it, detector: det });
    }
    for (const { intent, res } of this.intents) {
      let best = '', hits = 0;
      for (const re of res) { const m = re.exec(t); if (m) { hits++; if (m[0].length > best.length) best = m[0]; } }
      if (!hits) continue;
      if (out.length && out[0].id === intent.id) continue;
      let score = (PRIORITY[intent.category] || 25) + Math.min(best.trim().length, 40) * 1.5 + (hits - 1) * 6;
      if (context.week != null && intent.week != null && +intent.week === +context.week) score += 8;
      if (context.panel && intent.action && intent.action.type === 'openPanel' && intent.action.arg === context.panel) score += 6;
      if (context.zone && intent.action && intent.action.type === 'goZone' && intent.action.arg === context.zone) score += 3;
      out.push({ id: intent.id, category: intent.category, score, matched: best, intent });
    }
    if (!out.some((o) => o.category === 'nav')) {
      const nav = this.navTarget(t);
      if (nav) {
        const it = { id: 'nav_generic', category: 'nav', answer: `Opening ${nav.label}.`, action: nav.action };
        out.push({ id: it.id, category: 'nav', score: PRIORITY.nav + 10 + nav.sc, matched: t, intent: it });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }

  /** Glossary entry by term (case/possessive/hyphen-insensitive; simple plural; unique prefix). */
  lookup(term) {
    const k = termKey(term);
    if (!k) return null;
    if (this.gloss.has(k)) return this.gloss.get(k);
    const sing = k.replace(/(?:es|s)$/, '');
    if (this.gloss.has(sing)) return this.gloss.get(sing);
    for (const [gk, g] of this.gloss) if (gk.replace(/(?:es|s)$/, '') === sing) return g;
    // "stroop" → "stroop effect": a term starting with the query, if unique-ish (shortest wins)
    let bestG = null;
    for (const [gk, g] of this.gloss) if (k.length >= 4 && (gk.startsWith(k + ' ') || gk === k)) if (!bestG || gk.length < termKey(bestG.term).length) bestG = g;
    if (bestG) return bestG;
    // Urdu term
    for (const g of this.glossary) if (g.ur && norm(g.ur) === norm(term)) return g;
    return null;
  }

  /** Parse "what is X" / "define X" / "X kya hai" → glossary hit. */
  glossaryQuery(text) {
    const t = norm(text);
    for (let i = 0; i < GLOSS_Q.length; i++) {
      const re = GLOSS_Q[i];
      const m = re.exec(t);
      if (!m) continue;
      const term = m[1].replace(/\s+(?:in psychology|in stats|in statistics|please)$/i, '').trim();
      if (!term || term.split(' ').length > 6) continue;
      const entry = this.lookup(term);
      if (entry) return { term, entry, explicit: i < GLOSS_Q.length - 1 };
    }
    return null;
  }

  /** Words in text that are glossary terms (for "did you mean" fallbacks). */
  glossaryMentions(text, max = 3) {
    const k = ' ' + termKey(text) + ' ';
    const hits = [];
    for (const [gk, g] of this.gloss) if (gk.length >= 5 && k.includes(' ' + gk + ' ')) hits.push(g);
    return hits.sort((a, b) => b.term.length - a.term.length).slice(0, max);
  }

  refusal(text) {
    const t = norm(text);
    for (const r of REFUSALS) for (const re of r.res) if (re.test(t)) return { kind: r.kind, text: r.text, action: r.action };
    return null;
  }

  /**
   * Full offline response. context = {week, panel, zone, mode, design}.
   * Returns {text, cards, action, intentId, kind:'crisis'|'refusal'|'glossary'|'intent'|'advice'|'fallback', crisis}.
   */
  respond(text, context = {}) {
    const t = norm(text);
    const det = crisis.detect(t);
    if (det.crisis) {
      const top = this.match(t, context)[0];
      return { kind: 'crisis', crisis: det, intentId: top ? top.id : null, cards: [], action: { type: 'showCrisis' },
        text: (top && top.intent.answer) || "I'm really glad you told me. I'm an AI tutor, not a counsellor, so please reach out to the people and numbers on the crisis card now." };
    }
    const ref = this.refusal(t);
    if (ref) return { kind: 'refusal', refusal: ref.kind, text: ref.text, action: ref.action || null, cards: [], intentId: null, crisis: null };

    const ranked = this.match(t, context);
    const top = ranked[0];
    if (top && top.id === 'd_critique' && context.design) {
      const cards = adviseDesign(context.design);
      return { kind: 'advice', text: cards.length ? `I found ${cards.length} thing${cards.length > 1 ? 's' : ''} to check in your design, most important first.` : 'Your design covers the checks I know: counterbalancing, power, consent/debrief, confounds and controls. Nice work.', cards, action: null, intentId: top.id, crisis: null };
    }
    const g = this.glossaryQuery(t);
    const teach = top && ['concept', 'stats', 'design', 'method', 'ethics'].includes(top.category);
    if (g && (!top || teach || top.category === 'meta' || (g.explicit && top.category !== 'nav' && top.category !== 'safety'))) {
      const extra = teach && top.intent.answer && top.intent.answer.indexOf(g.entry.def) < 0 ? ' ' + top.intent.answer : '';
      return { kind: 'glossary', term: g.entry.term, text: `${g.entry.term}: ${g.entry.def}${extra}`, cards: [], action: teach ? top.intent.action || null : null, intentId: top ? top.id : null, crisis: null, ur: g.entry.ur || null };
    }
    if (top) return { kind: 'intent', text: top.intent.answer, cards: [], action: top.intent.action || null, intentId: top.id, category: top.category, crisis: null, alternatives: ranked.slice(1, 4).map((r) => r.id) };
    const mentions = this.glossaryMentions(t);
    if (mentions.length) return { kind: 'glossary', term: mentions[0].term, text: `${mentions[0].term}: ${mentions[0].def}`, cards: [], action: null, intentId: null, crisis: null };
    return { kind: 'fallback', cards: [], action: null, intentId: null, crisis: null,
      text: "I don't have that in my offline notes yet. Try asking 'what is …' for a glossary term, 'which test should I use', 'critique my design', or 'take me to the Memory Lab'." };
  }
}

module.exports = { IntentEngine, adviseDesign, REFUSALS, PRIORITY, termKey };
