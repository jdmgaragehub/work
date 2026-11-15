# Instructor Guide

## 1. Map ZEHN to your syllabus

- The default plan is a 16-week *Introduction to Psychology + Experimental Lab* course (see `docs/COURSE_MAPPING.md`). It follows the 16 chapters of OpenStax *Psychology 2e* and tags each week with APA 3.0 outcomes and HEC 2025 courses.
- To change it, edit `src/data/course.json` (weeks, topics, panels, paradigms, APA tags) and run `npm run build`. The Course Map, the HUD tags and the week ordering of missions all read from this file.
- The whole-degree map (semesters 1–8) and seven elective tracks cover later HEC courses: Forensic, Clinical, I-O and others.

## 2. Weekly lab routine

Each week has a worksheet in `docs/LAB_WORKSHEETS/WEEK_XX.md`. Each worksheet covers the hypothesis, procedure in ZEHN, data table, analysis questions, APA write-up prompt and an ethics reflection.

The suggested loop follows the game's campaign:

1. Learn: tour beat and exhibit.
2. Experience: take part in the paradigm.
3. Design a variant in the Experiment Builder.
4. Submit it to the Ethics Board.
5. Run simulated participants.
6. Analyse it in the Statistics Workbench.
7. Write it up in the APA Report Generator.
8. Peer review.
9. Run a replication.

## 3. Seeds and class data

- **Seeds:** a seed (onboarding, Settings, or `?seed=` in the URL) fixes every simulated participant and randomisation. Give the whole class one seed for comparable results, or a different seed per group for a "many labs" replication exercise.
- **Collecting class data ethically:**
  - Students export their own CSV (Data Export panel). Rows carry an anonymous id (`P-xxxxxx`) and a short device-class hash, never a name.
  - Collect exports voluntarily. Tell students they can withdraw, and that browser reaction times are for teaching only.
  - Merge the CSVs. They share one schema; the codebook is downloadable.
- **Simulated data:** generated data is always labelled "Simulated data". Effect sizes in the simulations are teaching values unless the UI cites a verified fact.

## 4. Edit case cards and facts

- **Case cards:** `src/data/cases.json`. Cards marked `instructorEditable` can also be edited in the game (Case Studies panel); edits are saved locally.
- **Facts:** `src/data/facts.json`. Set `confidence` to `verified` only after you have checked the primary source. The UI shows "figure under verification" for anything else. `docs/FACTS_AND_SOURCES.md` lists what is still open.
- **Helplines (F-H1…F-H6):** re-check numbers and hours before each term and update `retrieved`.

## 5. Difficulty and assessment

- **Difficulty levels:**
  - Foundation: hints on.
  - Bachelor: standard.
  - Honours: supervisor notes hidden until the end of each clinic session, plus confound-spotting prompts.
- **Quiz bank:** 336 items, at least 20 per week. Over 30% are at the apply/analyse level. The quiz panel includes item analysis on a simulated class.
- **Scorecard:** maps activity to the five APA goals. The grade bands are in `src/game/logic.js` (`TARGETS`); adjust them to your rubric.
- **Certificates:** print or export as PNG.

## 6. Safety and duty of care

- **No diagnosis:** ZEHN never diagnoses players. Mental-health screeners appear only as scores for fictional clients.
- **Content warnings:** they cover suicide, self-harm, abuse, trauma, obedience/shock and prison simulations. Students can opt out to a text-and-quiz path without losing progress.
- **Crisis support:** the crisis card is always available. Brief students on local support services. RAAHI's optional LLM sends text only when a student enables it with their own key.
