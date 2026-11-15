# ZEHN — PROGRESS (A0 loop log)

Loop: READ PROGRESS → PLAN → BUILD → VERIFY → CRITIQUE → FIX → UPDATE PROGRESS. Status at the end of the swarm run.

## Gate status (§12)

| Gate | Status | Evidence |
|---|---|---|
| G1 Benchmark parity | PASS, with G7 caveat | docs/BENCHMARK_PARITY.md (29 rows), docs/BENCHMARK_INVENTORY.md (97 modules mapped) |
| G2 Course coverage | PASS | 16/16 weeks in docs/COURSE_MAPPING.md; test `data.test.js › course`; e2e: 39/39 panel headers carry APA + domain + HEC + week tags |
| G3 Minimums | PASS | `npm run count` (every row ✅) |
| G4 Formula correctness | PASS | 50 psych tests vs SciPy goldens at ≤ 1e-8 (gate requires 1e-4) |
| G5 Facts | PASS, with caveat | facts.json: 91 records (64 verified, 26 must-verify, 1 disputed); UI shows numbers only via `factLine()` with badges. Caveat: some typed conventions (Cohen's 0.2/0.5/0.8, 2-down-1-up ≈ 71%, α = .05) appear as textbook conventions, not study results |
| G6 Stability | PASS | e2e: 0 console/page errors; 10-min soak, heap growth after GC 0.00% (< 10%) |
| G7 Performance | NOT VERIFIABLE HERE | Only SwiftShader (CPU software GL) is available: 0.6–8 fps headless. Needs measurement on a discrete and an integrated GPU |
| G8 Offline | PASS | e2e blocks all non-file requests: 0 attempted; three.js inlined; no CDN/fonts/assets |
| G9 Persistence & export | PASS | manual Save/Load (no autosave, fresh start by default), JSON save import/export, CSV/JSON/codebook/PNG/MD/print exports; e2e save/load round-trip |
| G10 UX polish | PASS (automated part) | e2e pressed every panel button: 0 dead controls; keyboard map, focus rings, ARIA labels, reduced motion, dyslexia, colour-blind and conference modes. WCAG contrast not machine-audited |
| G11 Visual quality | PARTIAL | 16 AUs + gaze + blink + visemes; post-FX parity; screenshots per mode, zone and time of day in docs/screenshots. Human visual review still needed |
| G12 Docs | PASS | README, PRESENTER_GUIDE, INSTRUCTOR_GUIDE, 16 LAB_WORKSHEETS, COURSE_MAPPING, BENCHMARK_PARITY, FACTS_AND_SOURCES, LICENSES, ETHICS_SAFETY, TEST_REPORT |
| G13 Timing accuracy | PASS (headless) | 500 bot trials per tier: median onset error ≈ 0.3 frames, p95 ≈ 0.33 frames, RT resolution < 1 ms; UI states the Bridges et al. (2020) lag |
| G14 Ethics & safety | PASS | consent before every RT task; debrief after deception demos (Asch, misinformation, inattentional blindness, levels-of-processing surprise test); content warnings with text-only paths; crisis detector 45/45 unit phrases, e2e 30/30 cards shown; licence linter passes; helplines carry retrieved dates and "verify" caveats |

## Fixed after user testing
- WASD and mouse look did nothing: `controls.update()` was never registered in the frame loop. Fixed, and covered by an e2e regression check.
- Autosave and auto-load removed. The game always starts fresh. Use 💾 Save and 📂 Load (HUD) or Settings.

## Known limits / must-verify
- Browser RTs include a fixed lag and jitter. They are for teaching, not publishable data.
- Before shipping, re-check the must-verify facts (Asch, Stroop original values, Shepard–Metzler slope, Ainsworth split (disputed), helpline hours, IPIP wording (partially verified), model IDs).
- G7 FPS on real GPUs is unmeasured.
- Hands on humanoids are simple ellipsoids.
