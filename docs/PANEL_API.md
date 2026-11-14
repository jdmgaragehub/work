# ZEHN Panel API (A6)

Panels are dashboard drawers opened from the left rails. Metadata (title, week, APA, domain, HEC, rail, icon) lives in
`src/ui/panels/meta.js` and the host (`src/ui/panelhost.js`) renders the header with APA + domain + HEC + week tags (G2).
A panel module is a CommonJS file in `src/ui/panels/` exporting an array: `module.exports = [{ id, render(body, api), onClose?() }, ...]`.
`render` fills `body` (an empty `<div class="body">`). Exemplar: `src/ui/panels/course.js`. All modules are listed in
`src/ui/panels/index.js` (A0 owns it).

## `api` (see `buildApi` in src/ui/panelhost.js)
- DOM: `h(tag, attrs, ...kids)`, `btn(label, onClick, cls)` (`cls`: '', 'primary', 'teal', 'ghost'), `modal({title, body, actions})→Promise`, `toast(text)`, `download(name, text, mime)`, `table(headers, rows)`, `slider(label, {min,max,step,value,onInput,fmt})`, `select(label, options, value, onChange)`, `esc`.
- Charts: `api.charts.{histogram, scatter, line, bar, boxplot, roc, cumulative, serialPosition, hypnogram, forest, trace}` → SVG element (see src/ui/charts.js signatures).
- Maths (pure, unit-tested): `api.stats` (describe, tIndependent, tPaired, tOne, anova1, chi2Gof, chi2Independence, pearson, regression, powerTwoSample, nForPower, semMeasurement, ciScore, ciMean, histogram, z, tScore, iqScore, percentile…), `api.dist`, `api.psychometrics`, `api.sdt`, `api.psychophysics`, `api.learning`, `api.neuron` (lif, hh, fiCurve), `api.participants` (cohort, drawRT, drawCorrect), `api.Rng`, `api.timeline` (toCSV, codebookMarkdown, latinSquare, validateRows).
- Formatting: `api.apa.t(res)`, `.F`, `.r`, `.chi2`, `.mean(m, sd)`, `.alpha`, `.dprime`; `api.format.italicise(str)` for HTML.
- Facts (zero-hallucination rule): `api.factLine(id)` renders claim + value + verified/must-verify badge + replication badge + source. **Never type study numbers into panel text**; use `factLine(id)` or `fact(id).value`. Unverified facts show "figure under verification". `api.simLabel()` → "Simulated data" tag; use it beside any generated data.
- Navigation: `api.openPanel(id)`, `api.runParadigm(id, opts)` (consent etc. handled by the runner), `api.paradigms()`, `api.paradigm(id)`, `api.goZone(zone)`, `api.setMode(mode)`, `api.emit(event, payload)` (bus events from ARCHITECTURE §3), `api.glossary(term)`, `api.service(name)`.
- State: `api.sim.state` (week, xp, quiz, irb, missions, paradigmsRun…), `api.sim.datasets[paradigmId]` (rows of the player's own runs), `api.sim.data.{facts, quiz, glossary, intents, dilemmas, irb, clients, cases, missions, tour, course, ipip}`, `api.sim.settings`, `api.sim.addXP(n, why)`.
- Services (may be null in tests — guard with `api.service('x') && …`): `ui` (showCrisis(), setLang()), `runner`, `world` (teleport(zone), setTimeOfDay(t)), `renderer` (setQuality(tier), setToggle(name, bool), screenshot()), `controls` (setMode), `audio`, `ai` (ask(text)), `clinic` (startSession(clientId)), `director` (presentDilemma(id), presentIRB(id)), `missions`, `scoring` (scorecard(), certificate()), `tour` (start()), `journey` (start('participant'|'client')).

## Rules
1. **No dead controls** (G10): every button does something observable (renders output, opens something, emits an event).
2. Every interactive maths tool emits the matching bus event (e.g. `stats:test {test:'t_ind'}`, `neuron:spike`, `face:au {au}`, `replication:run`, `builder:save`, `report:generated`, `export:done {kind}`).
3. Content must be original wording; numbers only via facts; generated data labelled "Simulated data"; disorders in plain paraphrase + "see DSM-5-TR / ICD-11 for official criteria"; never diagnose the player; IPIP "for learning only, not a diagnosis".
4. Accessible: buttons have text; charts have labels; no colour-only meaning; keep contrast.
5. Each panel should include: short teaching text (2–6 paragraphs, original), at least one interactive tool, at least one chart where data exist, links (`btn`) to its paradigms (`runParadigm`) and zone (`goZone`), and relevant `factLine`s / glossary terms.
6. No `fetch`, no network, no external assets. `'use strict'`, ES2020.
