# ZEHN — Licences and Copyright Register (owned by A1)

This file records the licence of every third-party component and item set in
`dist/ZEHN_Psychology_Lab_Simulator.html`, and the instruments that must never
ship. A1 holds a veto: content with no entry here does not ship.

Last reviewed: 2026-11-14.

## 1. Third-party code

| Component | Version | Licence | How it ships | Obligation |
|---|---|---|---|---|
| three.js | r160 (`vendor/three.r160.raw.js`) | MIT, © 2010-2023 three.js authors | Inlined by `build/bundle.mjs` into the single HTML file | Keep the full MIT notice as the first comment of the inlined block. The licence linter fails the build if the header is missing from `dist/`. |

No other runtime libraries, fonts, CDNs, images or audio files are bundled (§1 rule 6). ZEHN uses system fonts only.

## 2. Item sets and instruments

| Item set | Where | Licence / permission | Conditions in ZEHN |
|---|---|---|---|
| IPIP 50-item Big-Five Factor Markers (Goldberg 1992; IPIP) | `src/data/ipip.json` | Public domain: the IPIP items may be copied, edited, translated and used for any purpose without permission or fee (ipip.ori.org; facts F-IPIP, F-IPIP50) | The player may answer them. Show "for learning only, not a diagnosis" first. Responses stay on the device. Item wording must be re-diffed against ipip.ori.org before release (see the `verification` field). |
| PHQ-9 and GAD-7 (Pfizer; Spitzer, Kroenke, Williams and colleagues) | `src/data/clients.json` → `simulatedScreeners` | phqscreeners.com: "No permission required to reproduce, translate, display or distribute" (F-PHQ) | Used **only** for simulated clients. ZEHN ships **item scores only** (0-3 arrays) and the total/severity band, **no item text**. The player is never asked to complete either screener. |
| FACS action units (Ekman & Friesen 1978; Ekman, Friesen & Hager 2002) | `src/people/*`, face lab | The FACS manual is copyrighted | Only AU numbers and short descriptive names are used (e.g., "AU12 lip corner puller"), with original procedural faces. No manual text, images or scoring guidance is reproduced. |
| OpenStax *Psychology 2e* | Course skeleton (`course.json`, COURSE_MAPPING) | CC BY 4.0 (F-OSX) | Used as a chapter list only. **No text, figures or questions are copied.** Attribution line in the About panel: "Course structure follows the chapter order of OpenStax Psychology 2e (Rice University), CC BY 4.0." |
| APA Guidelines 3.0 outcome codes | Tags on screens | Citation of a public policy document | Only codes (e.g., "APA 2.4") and short paraphrased labels are used. |
| HEC 2025 course titles | Tags on screens | Public curriculum document | Course titles only. |
| Classic paradigms (Stroop, flanker, DRM-style lists, Wason-style cards, framing and anchoring problems, false-belief stories) | `src/exp/paradigms/*` | Paradigms are methods, not copyrighted text | All stimuli, word lists, stories and problem wording are **original**. Do not copy the published DRM lists, the "Asian disease" wording or the Sally-Anne script. |

## 3. Original content

All of the following are generated procedurally at runtime or written originally for ZEHN, and are released with the project:

- 3D meshes (campus, brain, props, humanoids, faces), textures, skies and illusion geometry;
- all audio (WebAudio synthesis, including dichotic and psychophysics tones);
- all stimuli: illusions, search displays, RSVP streams, matrices-*style* puzzles, inkblot-*style* symmetric blots, colour-vision demos;
- case-study summaries (`cases.json`, original, ≤300 words each), quiz items, glossary definitions, dilemmas, IRB proposals and simulated clients.

Required labels:
- inkblot-style blots: **"Original simulation, not a Rorschach plate"**;
- colour-vision demos: **"Not a clinical Ishihara test"**;
- reasoning puzzles: **"Original puzzle, not a Raven's item"**;
- disorder descriptions: original paraphrase plus **"See DSM-5-TR / ICD-11 for official criteria"**.

## 4. Banned instruments (never reproduce items, plates, stimuli, norms or scoring keys)

| Instrument | Rights holder (for reference) |
|---|---|
| WAIS / WISC (all editions) | Pearson |
| Stanford–Binet | Riverside Insights |
| MMPI (MMPI-2, MMPI-2-RF, MMPI-3) | University of Minnesota Press |
| Rorschach inkblots (plates and Exner/R-PAS scoring) | Hogrefe and others |
| TAT cards | Harvard University Press |
| BDI-II | Pearson |
| NEO-PI-R / NEO-PI-3 | PAR |
| MBTI | The Myers-Briggs Company |
| Raven's Progressive Matrices | Pearson |
| DSM-5-TR criteria text | American Psychiatric Association |
| ICD-11 criteria text (CDDR) | World Health Organization |
| Ishihara plates | Kanehara Trading |

Text may **name** these instruments when it discusses them (history, critique, test-bias discussion). It may not reproduce any of their content. RAAHI (§7) refuses requests to reproduce them.

## 5. How the licence linter enforces this (`test/licence.test.js`)

The linter runs in `npm test` (node, no browser). A11 owns the file and A1 approves changes. It must:

1. **Banned-content scan.** Load every `src/data/*.json` file and every paradigm stimulus module. For each item-text field (`q`, `options`, `text`, `client`, `stimulus`, `items[].text`, `summary` and similar), fail if:
   - the text contains a banned instrument name **and** looks like an item (for example a numbered item, a response scale or "rate how much…"), except in fields tagged `discussion: true`, `cases.json` and `glossary.json`, where names are allowed but item text is not;
   - it matches a deny-list of known protected item phrasings (for example DSM criterion-style "five (or more) of the following symptoms" or "A. Persistent…" lists). The deny-list lives in `test/fixtures/banned_phrases.json` (A1-maintained, phrases only, no items).
2. **PHQ/GAD scope.** Fail if any PHQ-9 or GAD-7 item text appears anywhere in `src/` or `dist/`, or if `simulatedScreeners` appears outside `clients.json`.
3. **IPIP scope.** `ipip.json` must contain `"license": "Public domain (IPIP)"` and exactly 50 items. Every item `scale` must be in `["E","A","C","N","O"]`.
4. **Required labels.** Modules that render inkblot-style, colour-vision or matrices-style stimuli must export the label strings in §3.
5. **three.js header.** `dist/ZEHN_Psychology_Lab_Simulator.html` must contain `three.js r160` and `The MIT License`, and `Copyright © 2010-2023 three.js authors`.
6. **No external assets.** Fail on any `http(s)://` URL in `src/` code that loads a script, stylesheet, font, image or audio file. Allowed exceptions: `https://api.anthropic.com/v1/messages` (opt-in LLM), and URLs inside `facts.json` / `cases.json` source fields, which are shown as text only.
7. **Facts linkage.** Every `factRef` in `cases.json` and `quiz.json` must resolve to an ID in `facts.json`. A fact whose `source` is `[instructor to add verified source]` must not be referenced by any non-instructor-editable item.

A failure blocks merge (Gate G14: "licence linter passes, 0 banned instrument content").
