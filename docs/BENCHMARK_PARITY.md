# Benchmark Parity (G1)

The benchmark is `reference/Hyderabad_Airport_PM_Simulator.html`. Every benchmark feature (§0.1, and the 97 modules in `docs/BENCHMARK_INVENTORY.md`) is listed below with its ZEHN equivalent and the evidence for it.

Evidence types:
- **file**: the source path.
- **test**: a `node --test` name, or a section of `e2e/run.mjs` (results in `docs/TEST_REPORT.md`).
- **shot**: a screenshot in `docs/screenshots/`.

| # | Benchmark feature | ZEHN equivalent (≥ benchmark) | Evidence |
|---|---|---|---|
| 1 | Single HTML file, ~4.0 MB, ~106k lines, three.js r160 inlined with MIT header | Single HTML file, ≈4.0 MB (budget ≤ 9 MB), three.js r160 inlined with its MIT header, ~95 modules under `/* ===== src/... ===== */` banners | file `build/bundle.mjs`; test `licence.test.js › three.js MIT header kept`; `npm run build` output |
| 2 | Boot: CSS light sweep, real progress bar with step text, "simulated" footnote, reduced-motion fallback | Procedural neuron network that fires along the **real** loading progress; step text ("Growing dendrites… compiling shaders… seeding participants…"); footer "Simulated institution • data stays on this device"; reduced-motion fallback | file `src/index.html`, `src/main.js` `progress()`; shot `00_boot_courtyard.png` |
| 3 | 5 modes (Inspector FP, Manager orbit, Tour, Drone, Operations) | **7 modes**: Researcher Walk, Director View, Participant, Clinic, Social Sim, Neuro Explorer, Tour/Photo/Drone (keys 1–7) | file `src/engine/controls.js`, `src/ui/hud.js`; e2e `modes_zones`; shots `mode_*.png` |
| 4 | 10-step passenger journey + procedural boarding pass + cabin | **12-step "A Participant's Journey"** (consent signature pad, blocks, debrief, withdrawal, anonymised row, certificate) **plus** the 5-step "A Client's First Session" journey | file `src/game/journey.js`, `src/clinic/session.js`; test `game.test.js`, `clinic.test.js` |
| 5 | Hand-written post chain: HDR → TAA → motion blur → SSAO → bloom → god-rays → info pass → ACES composite → bokeh DOF | The same chain, written by hand with tier gating and per-feature toggles, **plus** SSR on polished floors (high+), volumetric shafts (Wundt Hall) and skin SSS | file `src/engine/postfx.js`, `src/engine/quality.js`; Settings panel toggles; e2e `performance` (`engineStats().passes`) |
| 6 | Quality tiers from GPU string, rolling re-tier, never auto-Ultra, `?quality=`, per-feature overrides, per-tier world budgets | Same rules, **plus face budgets** (16/8/4 AUs, face update rate) and experiment mode (post chain at minimum during timed trials) | file `src/engine/quality.js`, `src/exp/runner.js`; e2e per-tier run |
| 7 | Crowds: instanced box-limb people, vertex-shader animation, cultural clothing; **no faces** | One InstancedMesh crowd per area with vertex-shader walk/sit/idle/talk and Pakistani everyday clothing, **plus** full humanoids with **16 FACS AUs, gaze, blinking, visemes/lip-sync, 8 poses, posture, gait variety** | file `src/people/crowd.js`, `src/people/humanoid.js`, `src/people/face2d.js`; `npm run count` (AUs = 16); shots `panel_emotion.png`, `clinic_session.png` |
| 8 | 25 dashboard panels in 5 rail groups, tagged week/CLO/domain | **39 panels in 6 rail groups**, each header tagged with **APA 3.0 outcome + BPS domain + HEC course + week** | file `src/ui/panels/meta.js`, `src/ui/panelhost.js`; e2e `panels` (tag check, every button pressed) |
| 9 | ~142 quiz items | **336** (≥20 per week; 50% at apply/analyse) | test `data.test.js › quiz`; `npm run count` |
| 10 | ~317 glossary terms | **868** (150 with Urdu) | test `data.test.js › glossary` |
| 11 | ~38 decision events | **62 dilemmas + 17 IRB proposals** with visible trade-offs and an ethics penalty | test `data.test.js`, `game.test.js`; e2e `dilemmas_irb` |
| 12 | ~84 AI intents | **289 intents**, ranked matching, glossary lookup, advice cards with one-click Approve/Reject, refusals | test `ai.test.js`; file `src/ai/engine.js` |
| 13 | ~21 tour beats | **34** | test `data.test.js`; file `src/game/tour.js` |
| 14 | Monte Carlo in a Web Worker; MSPDI/CSV export | Seeded p-hacking and replication simulators, simulated-cohort studies, per-paradigm **CSV/JSON + codebook** export, APA report `.md`/`.html`, poster PNG, certificate PNG | file `src/ui/panels/practice_b.js`, `system.js`, `src/exp/core/timeline.js`; test `exp_core.test.js › CSV round-trip` |
| 15 | Seeded mulberry32 RNG | Seeded mulberry32 (`?seed=`), forked streams per paradigm/bot | file `src/core/rng.js`; test `psych.test.js › mulberry32 deterministic` |
| 16 | Pure-logic modules tested with `node --test` | **188 node tests**: statistics against SciPy goldens (≤ 1e-8), all 38 paradigms headless, data schemas, licence linter, crisis detector, AI, clinic, game, audio, social models, marching cubes | `npm test` |
| 17 | GameDirector with ethics penalty | GameDirector schedules dilemmas in context and applies an ethics penalty (XP and APA goal 3) | file `src/game/director.js`, `logic.js`; test `game.test.js › penalty` |
| 18 | XP, badges, levels, scorecard, certificate, local leaderboard | All of these, with the scorecard mapped to the **5 APA goals**, a grade, a printable certificate (PNG/print) and a leaderboard per seed | file `src/game/scoring.js` |
| 19 | English + Urdu label toggle | Urdu labels on zones, panels, the HUD and signposts, Urdu glossary for 150 terms, `lang="ur"` RTL-safe spans | file `src/ui/hud.js`, `layout.js`, Settings panel |
| 20 | AI mentor persona + optional LLM + voice | RAAHI: offline engine always on; optional Anthropic LLM (key in sessionStorage only, streaming, grounding snapshot, local tools, Approve/Reject); voice with visemes; **crisis detector on every text box** | file `src/ai/*`, `src/ui/chat.js`; test `crisis.test.js` (45/45 phrases, 0 false negatives); e2e `crisis` |
| 21 | Onboarding | 60 s onboarding: role, difficulty, seed, accessibility quick-set, content-warning preferences | file `src/ui/onboarding.js` |
| 22 | Touch controls | Virtual joystick and drag-to-look; buttons for experiment responses | file `src/engine/controls.js`, `src/exp/runner.js` |
| 23 | Save / load | Manual Save and Load buttons (HUD + Settings; the game always starts fresh unless you press Load — no autosave), JSON save-game export/import, delete-all | file `src/core/store.js`, `system.js`; e2e `persistence` |
| 24 | Procedural textures, materials, sky, weather | Procedural brick/jaali/ajrak/terrazzo/wood/marble textures; material library; sky with day/dusk/night moods | file `src/engine/textures.js`, `materials.js`, `sky.js`; shots `time_day/dusk/night.png` |
| 25 | Airport world (terminal, airfield, tower, city, construction, aircraft, vehicles, traffic) | 9-zone campus plus courtyard: illusion rooms in **true 3D** (Ames room correct from the peephole), a walk-through **marching-cubes brain**, a sleep lab with live EEG, Skinner boxes with live cumulative records, a one-way-mirror child suite, the clinic, the Mohalla street with crowd and social models, and the library with an IRB chamber | file `src/world/*`; test `marching.test.js`; shots `zone_*.png` |
| 26 | — (not in benchmark) | **38 runnable paradigms** with consent, debrief, content warnings, rAF-aligned onset timing and timing-quality reports (G13) | file `src/exp/*`; test `paradigms.test.js`; e2e `paradigms`, `performance.timing` |
| 27 | — | **26 simulated counselling clients** with branching dialogue, micro-skill scoring and supervision reports | file `src/clinic/*`, `src/data/clients.json`; test `clinic.test.js` |
| 28 | — | Ethics and safety layer: consent, debriefing, content warnings with text-only paths, crisis card, photosafe mode, no diagnosis of the player | `docs/ETHICS_SAFETY.md`; test `licence.test.js`, `crisis.test.js` |
| 29 | — | Facts with verification and replication badges (91 records) | file `src/data/facts.json`, `src/core/facts.js`; test `data.test.js › facts` |

No benchmark feature regresses: each benchmark row is matched or exceeded. One known limit is performance (benchmark rows 5–6). The ZEHN post chain meets the benchmark in features, but the frame rate on real GPUs (G7) could not be measured here, because only a software rasteriser (SwiftShader) was available. See `docs/TEST_REPORT.md`.
