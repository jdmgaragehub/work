# ZEHN — Architecture (owned by A0 Orchestrator)

ZEHN ships as **one offline HTML file**: `dist/ZEHN_Psychology_Lab_Simulator.html`.
Sources live in `src/` as small CommonJS-style modules. `build/bundle.mjs`
wraps every module in a function under a `/* ===== src/... ===== */` banner
(same convention as the benchmark), inlines three.js r160 (MIT header kept),
CSS and JSON, and resolves `require()` at runtime with a 20-line loader.
Pure-logic modules (`src/psych/*`, `src/exp/core/*`, `src/game/logic/*`,
`src/ai/engine.js`, `src/ai/crisis.js`) never touch the DOM or THREE, so
`node --test` loads them directly.

## 1. The shared `sim` object

```js
sim = {
  state:    { mode, zone, week, difficulty, role, xp, level, badges[], consentLog[], ... },
  rng:      mulberry32(seed)      // src/core/rng.js, ?seed= override
  clock:    { now(), speed (1|5|20), paused }
  bus:      EventBus              // on/off/once/emit
  data:     { facts, quiz, glossary, intents, dilemmas, irb, clients, cases, missions, tour, course, ipip, paradigms }
  settings: { quality, reducedMotion, photosafe, dyslexia, cbSafe, captions, lang, contentWarnings{}, toggles{} }
  datasets: { [paradigmId]: rows[] }   // trial rows, local only
}
```

## 2. Identifiers (all data files MUST use exactly these)

### Zones (`zone`)
| id | name |
|---|---|
| `courtyard` | Central Courtyard (neem trees, ajrak banners, jaali screens) |
| `wundt` | Wundt Hall — history museum |
| `explab` | Experimental Lab Wing — psychophysics, illusion rooms, attention cubicles, mental-rotation bench |
| `neuro` | Neuro Atrium — walk-through brain, neuron bridge, synapse chamber, split-brain table |
| `sleep` | Sleep & Consciousness Lab |
| `learning` | Learning Lab — Skinner boxes, Pavlov station, cumulative recorders, playroom |
| `childdev` | Child Development Suite — one-way mirror observation |
| `clinic` | Counselling & Clinic Centre |
| `mohalla` | Social Psychology Plaza / Mohalla street |
| `library` | Methods & Stats Library — IRB chamber, Statistics Workbench, poster hall |

### Modes (`mode`, keys 1–7)
`walk` (1 Researcher Walk), `director` (2), `participant` (3), `clinic` (4), `social` (5), `neuro` (6), `tour` (7: tour/photo/drone sub-modes)

### Panels (`panel`) — 39, six rail groups
| # | id | title | week | APA | domain | rail |
|---|---|---|---|---|---|---|
| 1 | `course` | Course Map | all | 1.2 | CHI | foundations |
| 2 | `history` | History & Schools | 1 | 1.3 | CHI | foundations |
| 3 | `perspectives` | Perspectives Lens | 1 | 1.5 | CHI | foundations |
| 4 | `methods` | Research Methods Lab | 2 | 2.2 | Methods | foundations |
| 5 | `irb` | Ethics Board (IRB) | 2 | 3.1 | Methods | foundations |
| 6 | `stats` | Statistics Workbench | 3,16 | 2.4 | Methods | foundations |
| 7 | `bio` | Biopsychology | 4 | 1.1 | Bio | brain |
| 8 | `brain` | Brain & Cases | 5 | 1.1 | Bio | brain |
| 9 | `sleep` | Consciousness & Sleep | 5 | 1.1 | Bio | brain |
| 10 | `sensation` | Sensation & Psychophysics | 6 | 2.1 | Cog | brain |
| 11 | `sdt` | Signal Detection | 6 | 2.4 | Cog | brain |
| 12 | `illusions` | Perception & Illusions | 6 | 1.1 | Cog | brain |
| 13 | `attention` | Attention Lab | 7 | 2.1 | Cog | brain |
| 14 | `learning` | Learning Lab | 8 | 1.1 | Bio/Cog | thinking |
| 15 | `memory` | Memory Lab | 9 | 2.1 | Cog | thinking |
| 16 | `eyewitness` | Eyewitness Room | 9 | 1.4 | Cog/Social | thinking |
| 17 | `cognition` | Cognition & Language | 10 | 2.1 | Cog | thinking |
| 18 | `intelligence` | Intelligence & Testing | 10 | 1.2 | IndDiff | thinking |
| 19 | `development` | Development | 11 | 1.2 | Dev | lifespan |
| 20 | `emotion` | Motivation & Emotion | 12 | 1.1 | Bio/Social | lifespan |
| 21 | `health` | Health & Stress | 12 | 3.3 | Bio | lifespan |
| 22 | `personality` | Personality | 13 | 1.2 | IndDiff | lifespan |
| 23 | `psychometrics` | Psychometrics | 13 | 2.4 | IndDiff | lifespan |
| 24 | `social` | Social Psychology | 14 | 1.1 | Social | practice |
| 25 | `io` | I-O Psychology | 14 | 1.4 | Social | practice |
| 26 | `psychopathology` | Psychopathology (Simulated) | 15 | 1.4 | IndDiff | practice |
| 27 | `therapy` | Therapies & Counselling | 15 | 4.1 | Applied | practice |
| 28 | `crosscultural` | Cross-Cultural & Indigenous | 15 | 3.2 | Social | practice |
| 29 | `positive` | Positive Psychology | 15 | 3.3 | Applied | practice |
| 30 | `replication` | Replication & Open Science | 16 | 2.2 | Methods | practice |
| 31 | `builder` | Experiment Builder | 2–16 | 2.2 | Methods | system |
| 32 | `export` | Data Export | all | 4.4 | Methods | system |
| 33 | `report` | APA Report Generator | 16 | 4.2 | Methods | system |
| 34 | `cases` | Case Studies | all | 1.4 | CHI | system |
| 35 | `missions` | Missions | all | 5.2 | — | system |
| 36 | `quiz` | Assessment & Quiz | all | 2.1 | — | system |
| 37 | `aiethics` | AI in Psychology & Ethics | 16 | 3.1 | CHI | system |
| 38 | `present` | Present & Report | 16 | 4.2 | — | system |
| 39 | `settings` | Session, Safety & Settings | — | 5.1 | — | system |

### Paradigms (`paradigm`) — 38 runnable
| id | title | week | panel | zone |
|---|---|---|---|---|
| `muller_lyer` | Müller-Lyer (method of adjustment) | 6 | illusions | explab |
| `ponzo` | Ponzo rails | 6 | illusions | explab |
| `ames` | Ames room size judgement | 6 | illusions | explab |
| `jnd_staircase` | JND staircase (Weber) | 6 | sensation | explab |
| `magnitude_est` | Magnitude estimation (Stevens) | 6 | sensation | explab |
| `sdt_yesno` | Yes/No signal detection with payoffs | 6 | sdt | explab |
| `stroop` | Stroop colour-word | 7 | attention | explab |
| `visual_search` | Feature vs conjunction search | 7 | attention | explab |
| `posner` | Posner cueing | 7 | attention | explab |
| `attn_blink` | Attentional blink (RSVP) | 7 | attention | explab |
| `dichotic` | Dichotic listening | 7 | attention | explab |
| `inattentional_blindness` | Inattentional blindness (3D plaza) | 7 | attention | mohalla |
| `change_blindness` | Change blindness (photosafe) | 7 | attention | explab |
| `serial_position` | Serial position free recall | 9 | memory | library |
| `brown_peterson` | Brown–Peterson distractor | 9 | memory | library |
| `levels_processing` | Levels of processing | 9 | memory | library |
| `drm` | DRM false memory | 9 | memory | library |
| `misinformation` | Misinformation (eyewitness) | 9 | eyewitness | mohalla |
| `nback` | n-back working memory | 9 | memory | library |
| `memory_palace` | Method of loci palace | 9 | memory | wundt |
| `classical_cond` | Classical conditioning (Rescorla–Wagner) | 8 | learning | learning |
| `operant_schedules` | Operant schedules FR/VR/FI/VI | 8 | learning | learning |
| `shaping` | Shaping by successive approximation | 8 | learning | learning |
| `mental_rotation` | Mental rotation (3D) | 10 | cognition | explab |
| `hanoi` | Tower of Hanoi | 10 | cognition | library |
| `wason` | Wason selection task | 10 | cognition | library |
| `framing` | Framing (original wording) | 10 | cognition | library |
| `anchoring` | Anchoring | 10 | cognition | library |
| `hick_hyman` | Hick–Hyman choice RT | 6 | sensation | explab |
| `fitts` | Fitts pointing | 6 | sensation | explab |
| `conservation` | Piaget conservation (observe/code) | 11 | development | childdev |
| `false_belief` | False-belief (original characters) | 11 | development | childdev |
| `asch` | Asch-style conformity (debriefed) | 14 | social | mohalla |
| `prisoners_dilemma` | Prisoner's dilemma tournament | 14 | social | mohalla |
| `ipip_big5` | IPIP Big Five + reliability | 13 | personality | library |
| `face_recognition` | Facial-expression recognition (FACS) | 12 | emotion | clinic |
| `flanker` | Eriksen flanker | 7 | attention | explab |
| `go_nogo` | Go/No-Go inhibition | 7 | attention | explab |

### Domain tags
`Bio`, `Cog`, `Dev`, `Social`, `IndDiff`, `CHI` (conceptual & historical issues), `Methods`, `Applied` (combos with `/`, e.g. `Bio/Cog`).

### APA 3.0 outcome tags
`1.1`–`1.5`, `2.1`–`2.4`, `3.1`–`3.3`, `4.1`–`4.4`, `5.1`–`5.6`.

### HEC course tags (model scheme, 2025)
`S1 Introduction to Psychology`, `S1 Schools & Perspectives`, `S2 Behavioral Neuroscience`,
`S2 Experimental Psychology`, `S2 Theories of Personality`, `S3 Social Psychology`,
`S3 Cognitive Psychology`, `S3 I-O Psychology`, `S3 Ethics in Psychology`,
`S4 Psychological Testing`, `S4 Developmental Psychology`, `S4 Psychopathology`,
`S4 Environmental Psychology`, `S5 Cross-Cultural Psychology`, `S5 Psychology of Gender`,
`S5 Sports Psychology`, `S5 Clinical Psychology`, `S5 Data Analysis`, `S6 Positive Psychology`,
`S6 Counseling Psychology`, `S6 Academic Writing & Research Methods`, `S7 Forensic Psychology`,
`S8 Psychology & Emerging Technologies`, `S8 Capstone`.

## 3. Bus events (catalogue)

| event | payload | emitted when |
|---|---|---|
| `panel:open` | `{id}` | dashboard panel opened |
| `zone:enter` | `{zone}` | player walks/teleports into a zone |
| `mode:change` | `{mode}` | mode key 1–7 |
| `exp:start` / `exp:complete` | `{paradigm, rows}` | paradigm run begins / ends |
| `trial:start` / `trial:end` | `{paradigm, trial}` | per trial |
| `consent:given` | `{paradigm}` | consent screen accepted |
| `debrief:shown` | `{paradigm}` | debrief displayed |
| `study:run` | `{paradigm, n}` | simulated-participant study run |
| `stats:test` | `{test}` | `t_ind`,`t_paired`,`anova`,`chi2`,`corr`,`regression`,`alpha`,`kappa`,`power`,`sdt` |
| `irb:decision` | `{id, decision, correct}` | IRB proposal judged |
| `dilemma:resolved` | `{id, option, ethicsPenalty}` | dilemma card answered |
| `client:turn` / `client:session:end` | `{clientId, score}` | clinic dialogue |
| `quiz:answer` | `{id, correct, week}` | quiz item answered |
| `tour:beat` | `{id}` | tour beat shown |
| `journey:step` | `{journey, step}` | journey step completed (`participant` / `client`) |
| `export:done` | `{kind}` | `csv`,`json`,`png`,`print`,`codebook` |
| `report:generated` | `{paradigm}` | APA report generated |
| `replication:run` | `{finding}` | replication simulator run |
| `builder:save` | `{design}` | experiment builder design saved |
| `face:au` | `{au}` | FACS AU slider changed |
| `neuron:spike` | `{model}` | neuron simulator spike |
| `glossary:lookup` | `{term}` | glossary lookup |
| `crisis:detected` | `{source}` | crisis detector fired |
| `quality:change` | `{tier}` | quality tier changed |
| `mission:complete` | `{id}` | mission done |
| `badge:earned` | `{id}` | badge |

## 4. Data file schemas (`src/data/*.json`; validated by `test/schemas.test.js`)

Common tags on content items: `week` (1–16 int), `apa` (string, e.g. "2.4"), `domain`, `hec`.

- **facts.json** — `[{id, claim, value, unit, source, doi_or_url, retrieved, confidence: "verified"|"must-verify"|"disputed", replication: "robust"|"mixed"|"failed"|"contested"|"n/a", caveat}]`
- **quiz.json** — `[{id:"Q07-012", week, topic, bloom:"remember"|"understand"|"apply"|"analyse"|"evaluate"|"create", q, options:[4 strings], answer:0-3, explain, apa, domain, hec, factRef?}]` — ≥320, ≥20/week, ≥30% apply+analyse.
- **glossary.json** — `[{term, def, week, domain, ur?}]` — ≥420; `ur` (Urdu) on ≥100 terms.
- **intents.json** — `[{id, category:"concept"|"nav"|"stats"|"design"|"ethics"|"safety"|"crisis"|"meta"|"method", patterns:[regex source strings, case-insensitive], answer, action?:{type:"openPanel"|"goZone"|"setMode"|"startParadigm"|"showCrisis", arg}, week?, apa?}` — ≥130.
- **dilemmas.json** — `[{id, week, kind:"irb"|"clinic"|"social"|"replication"|"research"|"data"|"forensic"|"io", title, text, options:[{label, effects:{rigour, ethics, time, welfare}, ethicsPenalty:bool, feedback}], apa, domain}]` — ≥56. Effects are integers −3..+3.
- **irb.json** — `[{id, title, summary, design, risks:[...], correct:"approve"|"revise"|"reject", reasons:[...], codes:[e.g. "APA 8.02", "Belmont: Respect for persons"]}]` — ≥15.
- **clients.json** — see `src/clinic/README` in §5 below — ≥20.
- **cases.json** — `[{id, title, years, summary (≤300 words, original), laterResearch, replication, factRefs:[ids], sources:[{cite, doi_or_url}], contentWarning?:[topics], instructorEditable?:bool, apa, domain, week}]` — ≥14.
- **missions.json** — `[{id, week|null, track?:"core"|"clinical"|..., title, brief, objectives:[{text, event, where?:{key:value}, count}], xp, badge?, apa}]` — ≥16 core + 7×4 elective.
- **tour.json** — `[{id:"T01", week, zone, title, text, view:"aerial"|"front"|"inside"|"exhibit", panel?}]` — ≥32.
- **course.json** — 16 weeks (A0).
- **ipip.json** — IPIP 50-item Big-Five markers (public domain).

## 5. Clinic client schema (`clients.json`)

```json
{ "id":"C01", "name":"(fictional)", "age":24, "gender":"F", "setting":"Hyderabad (simulated)",
  "family":"anxiety|depression|trauma|ocd|psychosis-spectrum|eating|substance|grief|adjustment|somatic|cultural|stress",
  "presenting":"...", "background":"...", "culturalNote":"...", "contentWarning":["..."],
  "affect":{"valence":-0.4,"arousal":0.6},
  "simulatedScreeners":{"phq9":[0-3 x9] | null, "gad7":[0-3 x7] | null},
  "start":"n1",
  "nodes":{ "n1":{"client":"utterance","emotion":"sad|fear|anger|neutral|joy|disgust|surprise|contempt","options":[
      {"text":"counsellor reply","skill":"open|closed|affirm|reflect-simple|reflect-complex|summarise|validate|psychoeducate|cbt-abc|advice-premature|judge|reassure-false|refer","score":-2..3,"next":"n2"|null,"feedback":"supervisor note"} ]}},
  "supervision":"...", "referral":"..." }
```

## 6. Module map

| dir | owner | contents |
|---|---|---|
| `src/core` | A0 | bus, rng, store, facts, format, loader |
| `src/psych` | A5 | stats, distributions, psychometrics, sdt, psychophysics, learning, neuron, participants |
| `src/exp/core` | A8 | timeline, randomise, latin square, timing, csv |
| `src/exp/paradigms` | A8 | one module per paradigm (registry) |
| `src/engine` | A3 | renderer, postfx, quality, textures, materials, sky, controls, input |
| `src/world` | A2 | campus layout, zones, illusion rooms, brain, colliders |
| `src/people` | A4 | humanoid + FACS face, crowd, gaze, blink, visemes |
| `src/clinic` | A12 | dialogue engine, micro-skill scorer |
| `src/ai` | A7 | intent engine, crisis detector, LLM client, voice |
| `src/game` | A9 | missions, director, scoring, tour, journey |
| `src/audio` | A10 | procedural WebAudio |
| `src/ui` | A6 | shell, HUD, panels, charts |

## 7. Experiment-mode timing

During a timed trial the WebGL loop is paused (`sim.renderer.experimentMode = true`), the stimulus is drawn on a dedicated 2D canvas layer, onset is scheduled on `requestAnimationFrame`, onset/response timestamps use `performance.now()` and `KeyboardEvent.timeStamp`. Each row logs `onset_req`, `onset_actual`, `frames`.
