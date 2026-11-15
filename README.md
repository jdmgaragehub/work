# ZEHN (ذہن) — The Psychology Lab Simulator

A single-file, offline, 3D psychology teaching game for bachelor students. It is set at the **Indus Institute of Behavioural Sciences (IIBS), Hyderabad, Sindh — a simulated institution**.

Students can:
- run real timed experiments on themselves;
- study simulated participants and analyse the data with unit-tested statistics;
- take research proposals to an Ethics Board;
- counsel simulated clients;
- write an APA-style report.

The game is built to beat the reference benchmark, `reference/Hyderabad_Airport_PM_Simulator.html`, on every measurable axis. See `docs/BENCHMARK_PARITY.md`.

**Play:** open `dist/ZEHN_Psychology_Lab_Simulator.html` in Chrome, Edge or Firefox. It works from `file://` with no network. Data stays on the device.

## What's inside

| | ZEHN | Benchmark |
|---|---|---|
| Runnable paradigms (real timed tasks, consent, debrief, CSV) | **38** | 0 |
| Dashboard panels (6 rails, each tagged with APA 3.0 outcome, BPS domain and HEC course) | **39** | 25 |
| Quiz items (Bloom-tagged, ≥20 per week) | **336** | ≈142 |
| Glossary terms (150 with Urdu) | **868** | ≈317 |
| AI tutor intents (offline) + optional live LLM | **289** | ≈84 |
| Dilemmas + Ethics Board proposals | **62 + 17** | ≈38 |
| Simulated counselling clients (branching dialogue, FACS faces) | **26** | 0 |
| Missions (16 core + 7 elective tracks × 4) | **44** | — |
| Case studies with sources and replication badges | **19** | — |
| Tour beats | **34** | ≈21 |
| Modes | **7 + 2 journeys** | 5 + 1 |
| Facial action units, plus gaze, blink and visemes | **16** | 0 |
| Fact records (verified / must-verify / disputed) | **91** | — |

Exact counts are in `npm run count`.

## Build and test

```bash
npm test          # node --test: statistics vs SciPy goldens, paradigms, data schemas, licence linter, AI, clinic, game, audio, social models
npm run build     # → dist/ZEHN_Psychology_Lab_Simulator.html (single file, three.js r160 inlined with MIT header)
npm run e2e       # Playwright Chromium over file:// with network blocked (see docs/TEST_REPORT.md)
npm run count     # G3 minimums vs benchmark
```

No `npm install` is needed. The build and tests use only Node ≥ 20. e2e uses the preinstalled Playwright.

## Source layout

```
src/core      sim object, event bus, seeded RNG, persistence, facts, APA formatting
src/psych     statistics, distributions, psychometrics, SDT, psychophysics, learning, neurons, participants, social models (pure, node-tested)
src/exp       timeline/Latin square/CSV/timing core + DOM runner + 38 paradigm specs
src/engine    renderer, hand-written post-FX chain, quality tiers, procedural textures/materials/sky, camera modes, input
src/world     campus layout + 9 zone builders (illusion rooms in true 3D, marching-cubes brain, ...)
src/people    procedural humanoids with FACS faces, instanced crowds, Mohalla social simulation
src/clinic    counselling session engine + UI (simulated clients only)
src/ai        RAAHI: offline intent engine, crisis detector, optional Anthropic LLM, voice
src/game      missions, GameDirector (dilemmas/IRB), scoring/certificate, tour, Participant's Journey
src/audio     procedural WebAudio (ambience, dichotic tones, UI)
src/ui        shell, HUD, onboarding, crisis card, charts, 39 panels
src/data      facts, quiz, glossary, intents, dilemmas, irb, clients, cases, missions, tour, course, ipip
```

Contracts are in `docs/ARCHITECTURE.md`, `docs/EXPERIMENT_API.md`, `docs/PANEL_API.md` and `docs/WORLD_API.md`.

## Ethics, safety, licences

- Simulated clients only. ZEHN never diagnoses the player.
- Before any task that records reaction times, the player sees a consent screen. Every deception demo ends with a debrief.
- Sensitive topics carry content warnings with a text-only opt-out path.
- Flicker demos are photosafe.
- A crisis card is always reachable, and the AI tutor's crisis detector checks every text box.

See `docs/ETHICS_SAFETY.md` and `docs/LICENSES.md`. Copyrighted tests are banned (WAIS, MMPI, Rorschach, TAT, BDI-II, DSM text…). The licence linter in `test/licence.test.js` enforces this.

Every study number shown in the UI comes from `src/data/facts.json` with a verification badge. See `docs/FACTS_AND_SOURCES.md`.

**Honest limits:**
- Browser reaction times include a fixed lag and jitter (Bridges et al., 2020). Use them for teaching, not for publishable data.
- Some facts are still marked "must-verify".
- Helpline hours must be re-checked before deployment.
