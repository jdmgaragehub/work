'use strict';
/**
 * Game logic (A9) — PURE: no DOM, no THREE. Loaded directly by `node --test` (test/game.test.js).
 *
 *  Missions   matchWhere / matchObjective / newMissionState / applyEvent / missionProgress / isUnlocked
 *  XP         levelForXP / xpForLevel / levelProgress (same curve as sim.addXP: level = 1 + ⌊√(xp/120)⌋)
 *  Stats      newStats / tally(stats, event, payload) — counters the scorecard and badge rules read
 *  Badges     BADGES (rule badges) / evaluateBadges / badgeName
 *  Scorecard  computeScorecard(stats, state, data) → { g1..g5 } (0–100, APA Guidelines 3.0 goals)
 *  Grade      overallScore / gradeFor (A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, else F)
 *  Ethics     resolveDilemma / applyEthicsPenalty / judgeIRB / bestOption
 *  Director   pickDilemma / pickIRB / CONFOUNDS (Honours confound-spotting prompts) / canInterrupt
 *  Board      makeEntry / insertEntry / leaderboardFor (local leaderboard, by seed)
 *  Journey    JOURNEY_STEPS / anonymiseId / simulatedClass / classSummary
 */
const { Rng } = require('../core/rng.js');

// ------------------------------------------------------------------ events
/** Every bus event a mission objective may name (docs/ARCHITECTURE.md §3 + runner extras). */
const EVENT_CATALOGUE = [
  'panel:open', 'zone:enter', 'mode:change', 'exp:start', 'exp:complete', 'exp:withdrawn', 'trial:start', 'trial:end',
  'consent:given', 'debrief:shown', 'study:run', 'stats:test', 'irb:decision', 'dilemma:resolved', 'client:turn',
  'client:session:end', 'quiz:answer', 'tour:beat', 'journey:step', 'export:done', 'report:generated', 'replication:run',
  'builder:save', 'face:au', 'neuron:spike', 'glossary:lookup', 'crisis:detected', 'quality:change', 'mission:complete',
  'badge:earned', 'week:set',
];
/** Events the game itself emits; never fed back into mission/stat tallies (avoids loops). */
const SELF_EVENTS = new Set(['mission:complete', 'badge:earned', 'xp:gain', 'level:up', 'scorecard:update', 'missions:unlocked', 'state:restored']);

// ------------------------------------------------------------------ missions
function eq(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a === 'boolean' || typeof b === 'boolean') return String(a) === String(b);
  return String(a) === String(b);
}
/** Equality where-clause: every key in `where` must equal payload[key]. Empty/absent where matches all. */
function matchWhere(where, payload) {
  if (!where) return true;
  const p = payload || {};
  for (const k of Object.keys(where)) if (!eq(p[k], where[k])) return false;
  return true;
}
/**
 * Does `event`/`payload` advance `objective`? Bot (simulated) paradigm runs never count as the
 * player's own run unless the where-clause explicitly asks for `bot`.
 */
function matchObjective(objective, event, payload) {
  if (!objective || objective.event !== event) return false;
  const p = payload || {};
  if (p.bot && !(objective.where && 'bot' in objective.where)) return false;
  return matchWhere(objective.where, p);
}
function newMissionState(mission) { return { done: false, progress: mission.objectives.map(() => 0) }; }
/** Mutates `ms` (a {done, progress[]}). Returns { changed, completed }. */
function applyEvent(mission, ms, event, payload) {
  if (!ms || ms.done) return { changed: false, completed: false };
  let changed = false;
  mission.objectives.forEach((o, i) => {
    const need = o.count || 1;
    if ((ms.progress[i] || 0) < need && matchObjective(o, event, payload)) { ms.progress[i] = (ms.progress[i] || 0) + 1; changed = true; }
  });
  const completed = changed && mission.objectives.every((o, i) => (ms.progress[i] || 0) >= (o.count || 1));
  if (completed) ms.done = true;
  return { changed, completed };
}
/** Replay an event log [{event, payload}] → { done, progress[], fraction }. */
function missionProgress(mission, eventLog) {
  const ms = newMissionState(mission);
  for (const e of eventLog || []) { applyEvent(mission, ms, e.event, e.payload); if (ms.done) break; }
  return Object.assign(ms, { fraction: fraction(mission, ms) });
}
function fraction(mission, ms) {
  const parts = mission.objectives.map((o, i) => Math.min(1, ((ms && ms.progress[i]) || 0) / (o.count || 1)));
  return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0;
}
const isCore = (m) => (m.track || 'core') === 'core';
/** Core missions are always open; electives (unlockAfterWeek) open once every core mission up to that week is done. */
function isUnlocked(mission, missionsState, allMissions, override) {
  if (isCore(mission) || !mission.unlockAfterWeek) return true;
  if (override) return true;
  return allMissions.filter((m) => isCore(m) && m.week != null && m.week <= mission.unlockAfterWeek).every((m) => missionsState[m.id] && missionsState[m.id].done);
}
/** Validation helper for tests/CI: objectives must name catalogued events and positive counts. */
function validateMissions(missions) {
  const errs = [];
  const known = new Set(EVENT_CATALOGUE);
  for (const m of missions) {
    if (!m.id || !Array.isArray(m.objectives) || !m.objectives.length) errs.push(m.id + ': no objectives');
    for (const o of m.objectives || []) {
      if (!known.has(o.event)) errs.push(`${m.id}: unknown event ${o.event}`);
      if (!(Number.isInteger(o.count) && o.count >= 1)) errs.push(`${m.id}: bad count`);
      if (o.where && (typeof o.where !== 'object' || Array.isArray(o.where))) errs.push(`${m.id}: bad where`);
    }
    if (!(m.xp > 0)) errs.push(m.id + ': xp');
  }
  return errs;
}

// ------------------------------------------------------------------ XP
const XP_DIV = 120;
const levelForXP = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / XP_DIV));
const xpForLevel = (lvl) => XP_DIV * Math.pow(Math.max(0, lvl - 1), 2);
function levelProgress(xp) {
  const level = levelForXP(xp);
  const lo = xpForLevel(level), hi = xpForLevel(level + 1);
  return { level, xp, cur: xp - lo, need: hi - lo, next: hi, frac: hi > lo ? (xp - lo) / (hi - lo) : 0 };
}
const LEVEL_TITLES = ['Visitor', 'Participant', 'Research Assistant', 'Lab Member', 'Junior Researcher', 'Researcher', 'Senior Researcher', 'Principal Investigator', 'Professor', 'Emeritus'];
const levelTitle = (lvl) => LEVEL_TITLES[Math.min(LEVEL_TITLES.length - 1, Math.max(0, lvl - 1))];

// ------------------------------------------------------------------ stats (counters)
function newStats() {
  return {
    events: {}, quizAnswered: 0, quizCorrect: 0, panels: {}, paradigms: {}, statsTests: {}, replications: 0, studies: 0,
    designs: 0, prereg: 0, irbJudged: 0, irbCorrect: 0, debriefs: 0, dilemmas: 0, dilemmasClean: 0, reports: 0,
    exports: {}, exportCount: 0, presentOpened: 0, clientSessions: 0, clientTurns: 0, tourBeats: {}, journeySteps: {},
    glossary: 0, zones: {}, consents: 0, missionsDone: 0,
  };
}
const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
/** Mutates `s`. Unknown events only bump s.events. */
function tally(s, event, payload) {
  const p = payload || {};
  if (SELF_EVENTS.has(event) && event !== 'mission:complete') return s;
  inc(s.events, event);
  switch (event) {
    case 'quiz:answer': s.quizAnswered++; if (p.correct) s.quizCorrect++; break;
    case 'panel:open': if (p.id) { inc(s.panels, p.id); if (p.id === 'present') s.presentOpened++; } break;
    case 'exp:complete': if (!p.bot && p.paradigm) inc(s.paradigms, p.paradigm); break;
    case 'stats:test': if (p.test) inc(s.statsTests, p.test); break;
    case 'replication:run': s.replications++; if (p.preregistered || p.prereg) s.prereg++; break;
    case 'study:run': s.studies++; break;
    case 'builder:save': s.designs++; if (p.preregistered || p.prereg || (p.design && (p.design.preregistered || p.design.prereg))) s.prereg++; break;
    case 'irb:decision': s.irbJudged++; if (p.correct) s.irbCorrect++; break;
    case 'debrief:shown': s.debriefs++; break;
    case 'dilemma:resolved': s.dilemmas++; if (!p.ethicsPenalty) s.dilemmasClean++; break;
    case 'report:generated': s.reports++; break;
    case 'export:done': s.exportCount++; if (p.kind) inc(s.exports, p.kind); break;
    case 'client:session:end': s.clientSessions++; break;
    case 'client:turn': s.clientTurns++; break;
    case 'tour:beat': if (p.id) inc(s.tourBeats, p.id); break;
    case 'journey:step': if (p.journey) s.journeySteps[p.journey] = Math.max(s.journeySteps[p.journey] || 0, p.step || 0); break;
    case 'glossary:lookup': s.glossary++; break;
    case 'zone:enter': if (p.zone) inc(s.zones, p.zone); break;
    case 'consent:given': s.consents++; break;
    case 'mission:complete': s.missionsDone++; break;
    default: break;
  }
  return s;
}
const nKeys = (o) => Object.keys(o || {}).length;

// ------------------------------------------------------------------ badges
/** Rule badges (mission badges come from missions.json `badge`). `test(stats, state)`. */
const BADGES = [
  { id: 'debrief_champion', name: 'Debrief Champion', desc: 'Saw 5 debriefs through to the end.', test: (s) => s.debriefs >= 5 },
  { id: 'preregistered', name: 'Preregistered', desc: 'Saved a preregistered design or replication.', test: (s) => s.prereg >= 1 },
  { id: 'replicator', name: 'Replicator', desc: 'Ran 3 replication simulations.', test: (s) => s.replications >= 3 },
  { id: 'first_data', name: 'First Data', desc: 'Completed your first paradigm as a participant.', test: (s) => nKeys(s.paradigms) >= 1 },
  { id: 'paradigm_collector', name: 'Paradigm Collector', desc: 'Ran 12 different paradigms.', test: (s) => nKeys(s.paradigms) >= 12 },
  { id: 'clean_record', name: 'Clean Record', desc: 'Resolved 10 dilemmas without an ethics penalty.', test: (s) => s.dilemmasClean >= 10 },
  { id: 'board_member', name: 'Board Member', desc: 'Judged 10 IRB proposals correctly.', test: (s) => s.irbCorrect >= 10 },
  { id: 'statistician', name: 'Statistician', desc: 'Used 6 different statistical tests.', test: (s) => nKeys(s.statsTests) >= 6 },
  { id: 'tour_guide', name: 'Tour Guide', desc: 'Saw 32 tour beats.', test: (s) => nKeys(s.tourBeats) >= 32 },
  { id: 'participant_journey', name: 'Thank You, Participant', desc: "Finished A Participant's Journey.", test: (s) => (s.journeySteps.participant || 0) >= 12 },
  { id: 'quiz_scholar', name: 'Quiz Scholar', desc: 'Answered 100 quiz items correctly.', test: (s) => s.quizCorrect >= 100 },
  { id: 'communicator', name: 'Communicator', desc: 'Generated 3 APA reports.', test: (s) => s.reports >= 3 },
];
function evaluateBadges(stats, state, have) {
  const got = new Set(have || []);
  return BADGES.filter((b) => !got.has(b.id) && b.test(stats, state || {})).map((b) => b.id);
}
function badgeName(id, missions) {
  const b = BADGES.find((x) => x.id === id);
  if (b) return b.name;
  return String(id).split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// ------------------------------------------------------------------ scorecard / grade
const GOALS = {
  g1: 'Content Knowledge & Applications',
  g2: 'Scientific Inquiry & Critical Thinking',
  g3: 'Values in Psychological Science',
  g4: 'Communication, Literacy & Technology',
  g5: 'Personal & Professional Development',
};
/** Targets that earn full marks on a goal. Documented so instructors can see how the score is built. */
const TARGETS = { quizCorrect: 120, panels: 30, paradigms: 24, statsTests: 8, replications: 3, studies: 6, designs: 3, irbCorrect: 10, debriefs: 6, dilemmasClean: 12, reports: 4, exportKinds: 4, exports: 8, coreMissions: 16, electives: 8, journeySteps: 12, clientSessions: 4, tourBeats: 32 };
const ETHICS_G3_POINTS = 8; // each ethics penalty removes 8 points from g3
const r01 = (v, t) => Math.max(0, Math.min(1, (v || 0) / t));
const pct = (x) => Math.round(Math.max(0, Math.min(100, x * 100)));
function computeScorecard(s, state, data) {
  const st = state || {};
  const missions = (data && data.missions) || [];
  const ms = st.missions || {};
  const coreDone = missions.filter((m) => isCore(m) && ms[m.id] && ms[m.id].done).length;
  const elecDone = missions.filter((m) => !isCore(m) && ms[m.id] && ms[m.id].done).length;
  const acc = s.quizAnswered ? s.quizCorrect / s.quizAnswered : 0;
  const g1 = 0.55 * r01(s.quizCorrect, TARGETS.quizCorrect) + 0.15 * (s.quizAnswered >= 10 ? acc : 0) + 0.30 * r01(nKeys(s.panels), TARGETS.panels);
  const g2 = 0.35 * r01(nKeys(s.paradigms), TARGETS.paradigms) + 0.25 * r01(nKeys(s.statsTests), TARGETS.statsTests) + 0.2 * r01(s.replications, TARGETS.replications) + 0.1 * r01(s.studies, TARGETS.studies) + 0.1 * r01(s.designs, TARGETS.designs);
  const irbAcc = s.irbJudged ? s.irbCorrect / s.irbJudged : 0;
  const g3raw = 0.35 * r01(s.irbCorrect, TARGETS.irbCorrect) + 0.1 * (s.irbJudged >= 3 ? irbAcc : 0) + 0.25 * r01(s.debriefs, TARGETS.debriefs) + 0.3 * r01(s.dilemmasClean, TARGETS.dilemmasClean);
  const g3 = Math.max(0, pct(g3raw) - ETHICS_G3_POINTS * (st.ethicsPenalty || 0));
  const g4 = 0.4 * r01(s.reports, TARGETS.reports) + 0.25 * r01(nKeys(s.exports), TARGETS.exportKinds) + 0.15 * r01(s.exportCount, TARGETS.exports) + 0.2 * (s.presentOpened > 0 ? 1 : 0);
  const journey = Math.max(s.journeySteps.participant || 0, 0) + Math.min(5, s.journeySteps.client || 0) * (12 / 5);
  const g5 = 0.45 * r01(coreDone, TARGETS.coreMissions) + 0.15 * r01(elecDone, TARGETS.electives) + 0.15 * r01(journey, TARGETS.journeySteps * 2) + 0.15 * r01(s.clientSessions, TARGETS.clientSessions) + 0.1 * r01(nKeys(s.tourBeats), TARGETS.tourBeats);
  return { g1: pct(g1), g2: pct(g2), g3, g4: pct(g4), g5: pct(g5) };
}
function overallScore(sc) { const k = ['g1', 'g2', 'g3', 'g4', 'g5']; return Math.round((k.reduce((a, g) => a + (sc[g] || 0), 0) / 5) * 10) / 10; }
const GRADE_BANDS = [['A', 85], ['B', 70], ['C', 55], ['D', 40], ['F', -Infinity]];
function gradeFor(score) { for (const [g, min] of GRADE_BANDS) if (score >= min) return g; return 'F'; }

// ------------------------------------------------------------------ ethics
const PENALTY_XP = { foundation: 20, bachelor: 30, honours: 45 };
const DILEMMA_XP = 25;
/** Best option = no ethics penalty, then highest ethics + welfare, then rigour, then fewest time costs. */
function bestOption(d) {
  let best = 0, bs = -Infinity;
  d.options.forEach((o, i) => {
    const e = o.effects || {};
    const sc = (o.ethicsPenalty ? -100 : 0) + 3 * (e.ethics || 0) + 2 * (e.welfare || 0) + (e.rigour || 0) + 0.1 * (e.time || 0);
    if (sc > bs) { bs = sc; best = i; }
  });
  return best;
}
/** Outcome of choosing option `idx` (pure). */
function resolveDilemma(d, idx, difficulty) {
  const o = d.options[idx];
  if (!o) throw new Error('bad option ' + idx);
  const best = bestOption(d);
  const penalty = !!o.ethicsPenalty;
  const xp = penalty ? -(PENALTY_XP[difficulty] || PENALTY_XP.bachelor) : DILEMMA_XP + (idx === best ? 15 : 0);
  return { id: d.id, option: idx, ethicsPenalty: penalty, xp, best, isBest: idx === best, effects: Object.assign({ rigour: 0, ethics: 0, time: 0, welfare: 0 }, o.effects), feedback: o.feedback };
}
/** Mutates state: counts the penalty, removes XP (never below 0), lowers g3. Returns XP removed. */
function applyEthicsPenalty(state, difficulty, amount) {
  const n = amount != null ? amount : (PENALTY_XP[difficulty] || PENALTY_XP.bachelor);
  state.ethicsPenalty = (state.ethicsPenalty || 0) + 1;
  const before = state.xp || 0;
  state.xp = Math.max(0, before - n);
  if (state.scorecard) state.scorecard.g3 = Math.max(0, (state.scorecard.g3 || 0) - ETHICS_G3_POINTS);
  return before - state.xp;
}
/** IRB judgement. Approving a proposal that should be rejected is an ethics breach. */
function judgeIRB(proposal, decision) {
  const correct = decision === proposal.correct;
  const ethicsPenalty = decision === 'approve' && proposal.correct === 'reject';
  return { id: proposal.id, decision, correct, ethicsPenalty, xp: correct ? 40 : 5 };
}

// ------------------------------------------------------------------ director scheduling
const ZONE_KINDS = {
  library: ['irb', 'research', 'data', 'replication'], explab: ['research', 'data', 'replication'], clinic: ['clinic'],
  mohalla: ['social', 'forensic', 'io'], childdev: ['research', 'irb'], learning: ['research', 'irb'], neuro: ['research', 'data'],
  sleep: ['research', 'irb'], wundt: ['research', 'replication'], courtyard: [],
};
/**
 * Choose the next dilemma: unseen first; prefer weeks ≤ current week and kinds matching the zone.
 * Every dilemma stays reachable: once the "fitting" pool is exhausted, any unseen one is used,
 * and once all are seen the least-recently seen comes back.
 */
function pickDilemma(dilemmas, { week = 16, zone = null, seen = {}, rng = Math.random } = {}) {
  const r = typeof rng === 'function' ? rng : () => rng.random();
  const unseen = dilemmas.filter((d) => !seen[d.id]);
  const kinds = ZONE_KINDS[zone] || [];
  const pools = [
    unseen.filter((d) => d.week <= week && kinds.includes(d.kind)),
    unseen.filter((d) => d.week <= week),
    unseen,
  ];
  for (const p of pools) if (p.length) return p[Math.floor(r() * p.length) % p.length];
  if (!dilemmas.length) return null;
  const at = (d) => (seen[d.id] && seen[d.id].at) || '';
  return dilemmas.slice().sort((a, b) => String(at(a)).localeCompare(String(at(b))))[0];
}
/** Next IRB proposal: unjudged → judged incorrectly → oldest. */
function pickIRB(proposals, judged = {}, rng = Math.random) {
  const r = typeof rng === 'function' ? rng : () => rng.random();
  const a = proposals.filter((p) => !judged[p.id]);
  const b = proposals.filter((p) => judged[p.id] && !judged[p.id].correct);
  for (const p of [a, b]) if (p.length) return p[Math.floor(r() * p.length) % p.length];
  return proposals.length ? proposals.slice().sort((x, y) => String(judged[x.id].at || '').localeCompare(String(judged[y.id].at || '')))[0] : null;
}
/** Director may interrupt only when nothing else holds the player. */
function canInterrupt({ now, last = -Infinity, cooldownMs = 240000, experiment = false, modal = false, mode = 'walk', journey = false, tour = false }) {
  if (experiment || modal || journey || tour) return false;
  if (mode === 'tour' || mode === 'photo' || mode === 'participant') return false;
  return now - last >= cooldownMs;
}
/** Honours-level confound-spotting prompts (original items). `answer` indexes `options`. */
const CONFOUNDS = [
  { text: 'All Stroop participants did the congruent block first, then the incongruent block. Incongruent RTs were faster than expected.', options: ['Order / practice effects', 'Demand characteristics', 'Regression to the mean'], answer: 0, explain: 'Without counterbalancing, practice makes later blocks faster and hides interference. Counterbalance or interleave conditions.' },
  { text: 'Volunteers for a "memory booster app" study recalled more words than non-volunteers who did not use the app.', options: ['Selection bias (self-selection)', 'Ceiling effect', 'Experimenter fatigue'], answer: 0, explain: 'People who volunteer may already be more motivated. Random assignment to app vs control removes this confound.' },
  { text: 'The experimenter who knew the hypothesis scored the children\'s drawings for "creativity".', options: ['Floor effect', 'Experimenter expectancy (unblinded coding)', 'Order effect'], answer: 1, explain: 'Coders should be blind to condition; check inter-rater agreement (kappa).' },
  { text: 'Morning-session students got the caffeine drink; afternoon-session students got water. Caffeine improved vigilance.', options: ['Time of day confounded with condition', 'Social desirability', 'Practice effect'], answer: 0, explain: 'Session time co-varies with condition (circadian alertness). Randomise within sessions.' },
  { text: 'Participants told "this task measures intelligence" tried harder in the treatment group only.', options: ['Demand characteristics / unequal instructions', 'Attrition', 'Ceiling effect'], answer: 0, explain: 'Instructions must be identical across conditions, or the instruction itself is a second manipulation.' },
  { text: 'Half the control group dropped out of a 6-week stress course; those who stayed reported low stress.', options: ['Differential attrition', 'Counterbalancing', 'Anchoring'], answer: 0, explain: 'If dropout differs by condition, the remaining groups are no longer equivalent. Report CONSORT-style flow and use intention-to-treat.' },
  { text: 'A recall test used 10 easy words; both groups scored 9.8/10, so "the training had no effect".', options: ['Ceiling effect', 'Selection bias', 'Experimenter expectancy'], answer: 0, explain: 'When everyone scores near maximum the measure cannot show a difference. Use a harder or longer list.' },
  { text: 'Students who chose the front rows got higher grades, so sitting in front "causes" learning.', options: ['Third variable (motivation)', 'Practice effect', 'Floor effect'], answer: 0, explain: 'Correlation, not causation: motivation could drive both seat choice and grades.' },
];
function confoundPrompt(rng = Math.random) { const r = typeof rng === 'function' ? rng : () => rng.random(); return CONFOUNDS[Math.floor(r() * CONFOUNDS.length) % CONFOUNDS.length]; }

// ------------------------------------------------------------------ leaderboard
function makeEntry({ name, seed, xp = 0, score = 0, grade, level, date }) {
  const clean = String(name || 'Anonymous').replace(/[<>&"']/g, '').trim().slice(0, 32) || 'Anonymous';
  return { name: clean, seed: String(seed), xp: Math.round(xp), score: Math.round(score * 10) / 10, grade: grade || gradeFor(score), level: level || levelForXP(xp), date: date || new Date().toISOString() };
}
const cmpEntry = (a, b) => (b.score - a.score) || (b.xp - a.xp) || String(a.date).localeCompare(String(b.date));
/** Returns a new list: entry inserted, sorted (score ↓, XP ↓, earlier date first), capped at `max` per seed. */
function insertEntry(list, entry, max = 20) {
  const all = (list || []).concat([entry]);
  const bySeed = {};
  for (const e of all.sort(cmpEntry)) { (bySeed[e.seed] = bySeed[e.seed] || []).push(e); }
  return Object.values(bySeed).flatMap((arr) => arr.slice(0, max)).sort(cmpEntry);
}
function leaderboardFor(list, seed) { return (list || []).filter((e) => e.seed === String(seed)).sort(cmpEntry).map((e, i) => Object.assign({ rank: i + 1 }, e)); }

// ------------------------------------------------------------------ participant journey
const JOURNEY_STEPS = [
  { n: 1, id: 'poster', title: 'See a recruitment poster' },
  { n: 2, id: 'info', title: 'Read the information sheet' },
  { n: 3, id: 'consent', title: 'Give informed consent (signature pad)' },
  { n: 4, id: 'demographics', title: 'Demographics (optional, skippable)' },
  { n: 5, id: 'practice', title: 'Practice block' },
  { n: 6, id: 'blocks', title: 'Experimental blocks: Stroop → visual search → serial-position recall' },
  { n: 7, id: 'check', title: 'Manipulation check' },
  { n: 8, id: 'debrief', title: 'Debrief' },
  { n: 9, id: 'withdraw', title: 'Withdrawal option' },
  { n: 10, id: 'row', title: 'Your data becomes an anonymised row' },
  { n: 11, id: 'group', title: 'Group results (Statistics Workbench)' },
  { n: 12, id: 'certificate', title: 'Participation certificate' },
];
/** Non-reversible short code for display (FNV-1a); the real pid is never shown in the dataset row. */
function anonymiseId(pid, salt = 'zehn') {
  let h = 0x811c9dc5; const s = salt + ':' + pid;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return 'S-' + (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
}
/** Simulated class (labelled "Simulated data" in the UI): Stroop interference, search slope, recall. */
function simulatedClass(seed, n = 29) {
  const rng = new Rng(String(seed) + ':class');
  return Array.from({ length: n }, (_, i) => ({
    id: anonymiseId('class' + i, String(seed)),
    stroop_ms: Math.round(rng.normal(95, 35)),
    search_slope: Math.round(rng.normal(22, 8) * 10) / 10,
    recall_pct: Math.round(Math.max(10, Math.min(100, rng.normal(55, 12)))),
    simulated: true,
  }));
}
function classSummary(rows) {
  const keys = ['stroop_ms', 'search_slope', 'recall_pct'];
  const out = {};
  for (const k of keys) {
    const v = rows.map((r) => r[k]).filter((x) => typeof x === 'number' && Number.isFinite(x));
    const m = v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
    const sd = v.length > 1 ? Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1)) : 0;
    out[k] = { mean: m, sd, n: v.length, se: v.length ? sd / Math.sqrt(v.length) : 0 };
  }
  return out;
}

module.exports = {
  EVENT_CATALOGUE, SELF_EVENTS, matchWhere, matchObjective, newMissionState, applyEvent, missionProgress, fraction, isCore, isUnlocked, validateMissions,
  levelForXP, xpForLevel, levelProgress, levelTitle,
  newStats, tally, BADGES, evaluateBadges, badgeName,
  GOALS, TARGETS, ETHICS_G3_POINTS, computeScorecard, overallScore, GRADE_BANDS, gradeFor,
  PENALTY_XP, DILEMMA_XP, bestOption, resolveDilemma, applyEthicsPenalty, judgeIRB,
  ZONE_KINDS, pickDilemma, pickIRB, canInterrupt, CONFOUNDS, confoundPrompt,
  makeEntry, insertEntry, leaderboardFor,
  JOURNEY_STEPS, anonymiseId, simulatedClass, classSummary,
};
