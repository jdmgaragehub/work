# ZEHN Experiment API (A8) — paradigm modules

A paradigm module lives in `src/exp/paradigms/<group>.js` and `module.exports = [spec, spec, ...]`.
Modules are CommonJS (`require` / `module.exports`), `'use strict'`, ES2020, **no DOM globals, no THREE**
(they only draw on the 2D context passed in), so `node --test` can load them. Exemplar:
`src/exp/paradigms/attention_core.js` (stroop, flanker, go_nogo). The runner is `src/exp/runner.js` — read it.

Allowed requires: `../../psych/stats.js`, `../../psych/sdt.js`, `../../psych/psychophysics.js`,
`../../psych/learning.js`, `../../psych/psychometrics.js`, `../../psych/participants.js`
(`drawRT(p, rng, {mu, effect})`, `drawCorrect(p, rng, difficulty)`), `../../core/format.js` (`apa`),
`../../people/face2d.js` (`drawFace(ctx, x, y, size, aus, opts)` — FACS face; AU ids 1,2,4,5,6,7,9,10,12,15,17,20,23,25,26,43; values 0..1).

## Spec fields

| field | type | notes |
|---|---|---|
| `id` | string | exactly as in docs/ARCHITECTURE.md §2 paradigm table |
| `title, week, panel, zone, apa, domain, hec` | | tags from the table / §6.1 |
| `purpose` | string | 1 sentence, shown on consent screen |
| `instructions` | HTML string | keys/what to do |
| `estimateMin` | number | minutes |
| `practice` | int | number of practice trials (taken from `buildTrials(rng.fork, {practice:true})`) |
| `fix, iti, timeout, dur` | ms | defaults per trial; a trial may override with the same field names. `dur` = stimulus visible time (null → until response); `timeout` = response window from onset |
| `background` | css colour | canvas clear colour (default `#808080`) |
| `response` | object | `{type, keys?, labels?, choices?, slider?}` — see types below |
| `animated` | bool | if true `draw` is called every frame with `elapsed` (virtual ms since onset) |
| `buildTrials(rng, opts)` | → trial[] | **must honour `opts.trials`** (generate ≥ that many) and `opts.quick` (short version, 6–24 trials) and `opts.photosafe` |
| `init(rng, opts)` | → state | optional per-run state object |
| `prepare(trial, state, rng)` | | optional; called before each trial (adaptive staircases fill the trial here) |
| `update(state, trial, result, rng)` | | optional; after each trial (`result.correct`, `result.response`, `result.rt`) |
| `draw(ctx, trial, W, H, elapsed, state)` | | draw the stimulus (canvas already cleared to background). Logical px. |
| `drawMask(ctx, trial, W, H, state)` | | optional; drawn after `dur` expires |
| `score(trial, response, state)` | → bool/null | correctness |
| `simulate(p, trial, rng, state)` | → `{response, rt, correct?}` | bot/simulated participant (p from participants.js). Response format must equal what the human path produces. Effects here are **"Simulated effect size"** unless from a verified fact |
| `analyse(rows, state)` | → `{lines[], stats{}, chart?: (charts) => SVGElement}` | rows are CSV-style objects (strings/numbers; `correct` is 1/0/''; `rt_ms` number or ''). `charts` = src/ui/charts.js (bar, line, scatter, histogram, boxplot, roc, cumulative, serialPosition, forest, trace) |
| `deception` | bool | if true, **`debrief: {deception, purpose, safeguards}`** required — shown after the run with a delete-data option |
| `contentWarning` | string[] | topics (`obedience`, `trauma`, …) → opt-out text path (`textAlternative` HTML required) |
| `photosensitive` | bool | flicker ≤ 3 Hz; must have a static version when `opts.photosafe`/`state.photosafe` |
| `audio(trial, audio, state)` | | optional: play sounds via `audio.tone({freq, dur, pan, gain, type, when})`, `audio.noise({dur, pan, gain})` (A10). Not called in bot mode. Provide `trial.caption` text for captions |
| `onKey(trial, key, state, elapsed)` | | for `count` / `pointer` types |
| `onPointer(trial, x, y, state, elapsed)` | → `{done, response, correct?}` | for `pointer` type |
| `factRefs` | string[] | fact ids used in text (facts.json) |

## Trial object

Any fields you need, plus: `condition` (string, used for balance checks), `stimulus` (short text for CSV),
`correctResponse`, optional `fix/dur/iti/timeout/background/keys/choices/slider/responseType/prompt/caption/followup`.
`followup: {prompt, choices:[...], botAnswer?}` asks a second question after the main response (stored as `main|followup`).

## Response types (`response.type` or `trial.responseType`)

- `key` — `keys: ['f','j']` (lower-case; `'space'` for spacebar). Response = key string.
- `choice` — `choices: ['A','B'] | [{value,label}]`. Response = value. Keys 1–9 select.
- `multi` — multi-select choices + Submit. Response = selected values sorted, joined with `+`.
- `slider` — `slider: {min,max,step,start,label}`; arrows adjust; current value in `state.sliderValue` (draw it!). Response = number.
- `text` — free text (shown after `dur` if given; e.g. recall). Response = string.
- `count` — counts presses of `keys` during `dur`; `onKey` called per press. Response = count. Bot: `simulate` returns `{response: n}`.
- `pointer` — clicks on canvas → `onPointer`. Bot: `simulate` returns `{response, rt, correct}`.
- `none` — observe for `dur`, response null (e.g. watching an event).

## Rules
- Original stimuli only (no copyrighted test items). Word lists original. Faces procedural.
- Never claim real-study numbers in `analyse` unless via fact id; label generated group data "Simulated data".
- Flicker ≤ 3 Hz with reduced contrast; static alternative.
- Keep each module < 900 lines. Validate: `node -e "const a=require('./src/exp/paradigms/<file>.js'); ..."` and `node --test test/paradigms.test.js`.
