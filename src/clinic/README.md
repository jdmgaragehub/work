# Clinic (A12): design note

The Clinic lets students practise counselling micro-skills with **fictional, simulated clients**
(`src/data/clients.json`, schema in `docs/ARCHITECTURE.md` §5). It is a skills-practice game. It is not
therapy, and it never assesses the player.

| File | Role |
|---|---|
| `engine.js` | Pure dialogue engine and micro-skill scorer (no DOM). `SessionEngine`, `validateClients`, `screenerTotals`. |
| `session.js` | `Clinic(sim)` service (`sim.services.clinic`): client picker, content gate, animated session, supervision report, and the "A Client's First Session" journey. |
| `test/clinic.test.js` | Schema validity, every path ends within 10 turns, best > worst, risk-handling logic, purity. |

## Micro-skill scoring rubric

Every reply option carries a `skill` tag and an authored `score` from −2 to +3.

| Score | Typical skills | Meaning |
|---|---|---|
| +3 | complex reflection, validation, well-timed summary, direct risk question, collaborative referral | Moves the session forward with accurate empathy or safety |
| +2 | open question, affirmation, rupture repair | Good, client-centred |
| +1 | simple reflection, early psychoeducation | Accurate but surface-level |
| 0 | closed question, flat reflection | Neutral; narrows the conversation |
| −1 / −2 | premature advice, false reassurance, judgement | Breaks the alliance or closes a topic |

The session report shows the following:

- **Total / max.** `max` is the best achievable path total, computed by dynamic programming over the dialogue graph.
- **OARS counts:** open questions, affirmations, reflections (simple plus complex) and summaries.
- **Rogers' core conditions (0–1), estimated from your choices.** Each skill has a weight from −1 to 1 on empathy, unconditional positive regard and congruence (`ROGERS_W`). A positive weight is scaled by option quality (`(score+1)/4`, clamped 0.25–1). A negative weight counts in full. The mean is mapped from −1..1 to 0..1. False reassurance lowers congruence (a promise you cannot keep). Judgement lowers regard.
- **Strengths and growth areas.** These are rule-based sentences built from the skill counts, rupture repair (a positive reply at an `r*` node) and risk handling.
- **Affect.** The simulated client's valence and arousal start at `client.affect`. Each reply moves them: valence `+0.07·score` (an extra −0.04 when the score is negative); arousal `−0.03·score` for good replies and `+0.1·|score|` for poor ones. The values drive the face, the affect meter and the optional emotion grade.

## Safety design

- **Simulation framing everywhere.** A permanent "SIMULATION — fictional client" banner appears in the picker, the session, the report and every journey step. Every client name carries "(fictional)". The canvas portrait is procedural (`face2d`), with "SIMULATION" painted into it.
- **No player assessment.** The player never answers a screener. PHQ-9/GAD-7 appear only as **totals for the fictional client** (no item text), with the note "simulated screener scores for a fictional client; screeners are not diagnoses". The report rates counselling *choices*, never the person.
- **Content warnings.** The gate follows `sim.settings.contentWarnings` (a per-topic object or a global string; topics without a setting default to `ask`).
  - `skip` hides the client in the picker and offers the **text-and-quiz version**, which gives the same XP and session-end credit.
  - `ask` shows a content note with three choices: Continue, Text-and-quiz version, or Skip for now. Skip marks the client "deferred", not failed.
- **Risk handling.** A *risk client* has a `suicide` or `self-harm` warning, or contains a direct risk-assessment option. `riskHandled` is true only when the counsellor:
  1. chooses the direct risk question (a `refer` option that asks about ending life or harm);
  2. then later chooses a safety-plan or referral option (a `summarise` or `refer` option scoring at least 2, with safety, crisis or referral content).
  
  A missed risk question is always listed as a growth area. `validateClients` fails a risk client that has no direct risk-assessment option.
- **Crisis resources.** The report and the referral step link to the crisis-resource card (`sim.services.ui.showCrisis`). The Clinic has no free-text input. The global crisis watcher (A7, `src/ai/crisis.js`) covers text typed anywhere else.
- **Comfort and accessibility.**
  - Reduced motion shows the client's text instantly, with a calmer face blend and no breathing motion.
  - Keys 1–3 choose a reply. Enter continues.
  - `engine.setEmotionGrade` is called only when `sim.settings.emotionGrade` is on, and it is cleared when the session closes.
- **Honours difficulty.** Supervisor notes are hidden during the session and shown in the end-of-session report. The player can switch this with a checkbox.
- **Events:**
  - `client:turn` `{clientId, score, skill, step}`
  - `client:session:end` `{clientId, score, max, pct, riskHandled, completed, textPath}`
  - `journey:step` `{journey:'client', step:1..5}`
  - `journey:complete`

  Progress is stored in `sim.state.clinic[clientId]`.
