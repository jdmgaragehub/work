# ZEHN: The Psychology Lab Simulator — A Swarm Prompt for Claude Code That Beats the Airport PM Benchmark

The strongest design for your psychology game is a **fictional Pakistani university psychology campus where the player runs real, timed experiments on themselves and on simulated participants**. The game then analyses that data with unit-tested statistics and writes it up as an APA-style report. This works because "doing the experiment" is the one thing a psychology game can offer that a textbook cannot, and it maps cleanly onto the APA's five undergraduate goals and the HEC Pakistan 2025 BS Psychology scheme. The ready-to-paste prompt below keeps every section (§0–§12) of your SKY GATEWAY prompt and raises each benchmark number. It adds four things the airport game never needed: expressive procedural faces, millisecond-aware experiment timing, an ethics and safety layer, and a copyright rule for psychological tests.

## TL;DR

- **What to build:** "ZEHN" (ذہن, "mind"), set on a fictional campus labelled as simulated. The campus has 9 explorable zones and 7 modes plus a "Participant's Journey" mini-game. It ships ≥36 runnable paradigms, ≥34 dashboard panels, ≥320 quiz items, ≥420 glossary terms, ≥130 AI intents and ≥56 dilemmas. The benchmark had 142 quiz items, 317 glossary terms, 84 intents, 38 events, 25 panels and 5 modes.
- **What it teaches:** The skeleton is a 16-week "Introduction to Psychology + Experimental Lab" plan built on OpenStax Psychology 2e's 16 chapters. It is tagged to APA Guidelines 3.0 outcomes (1.1–5.6) and to the HEC 2025 course list (134 credit hours; Introduction to Psychology through Psychology & Emerging Technologies). A whole-degree module map covers all 8 semesters.
- **What makes it trustworthy:** A facts.json seeded with verified classic-study numbers, with caveats where the textbook story is wrong (e.g., Stanford Prison, ego depletion). There are 14 acceptance gates, including new ones for ethics and safety and for timing accuracy. Copyrighted tests (WAIS, MMPI, Rorschach, TAT, BDI-II, DSM text) are banned. Public-domain items (IPIP, PHQ-9/GAD-7) are allowed in simulated contexts only.

## Key Findings (research basis and design rationale)

**1. What bachelor students actually study.** The APA *Guidelines for the Undergraduate Psychology Major, Version 3.0* (2023) sets five goals:\[1\]
- Content Knowledge & Applications (1.1–1.5)
- Scientific Inquiry & Critical Thinking (2.1–2.4)
- Values in Psychological Science (3.1–3.3)
- Communication, Psychological Literacy & Technology Skills (4.1–4.4)\[2\]
- Personal & Professional Development (5.1–5.6)\[3\]

These 22 outcomes replace the PM course's CLOs.

HEC Pakistan notified revised Psychology curricula on 18 February 2025 (letter No. HEC/CD/NCRC/PSYC/2025/7162). The BS requires at least 134 credit hours, including 84 in the major (28 courses), a 3-credit internship of 6–8 weeks, a 3-credit capstone and seven optional specialisations. Semesters run 16–18 weeks.\[4\]

HEC's model sequence is:
- **Semester 1:** Introduction to Psychology; Schools & Perspectives
- **Semester 2:** Behavioral Neuroscience; Experimental Psychology (2-1 lab); Theories of Personality
- **Semester 3:** Social; Cognitive; I-O; Ethics in Psychology
- **Semester 4:** Psychological Testing; Developmental; Psychopathology; Environmental
- **Semester 5:** Cross-Cultural; Psychology of Gender; Sports; Clinical (2-1); Data Analysis
- **Semester 6:** Positive; Counseling (2-1); Academic Writing & Research Methods
- **Semester 7:** Forensic
- **Semester 8:** Psychology & Emerging Technologies; Capstone\[4\]

HEC also requires departments to maintain "testing and experimental laboratory" facilities.\[4\] A 3D virtual lab directly serves that requirement.

The UK BPS accreditation core areas are\[5\] biological, cognitive, developmental, social, individual differences, conceptual and historical issues, research methods, and an empirical project.\[5\] The game uses these as its "domain" tags. OpenStax *Psychology 2e* (CC BY 4.0) has 16 chapters, from Introduction to Psychology through Therapy and Treatment.\[6\]\[7\] It gives a legally reusable chapter skeleton.

**2. Which concepts make the best 3D mechanics.** I ranked candidate concepts on four criteria (each scored 1–5):
- **Interactivity:** does the player act, not just watch?
- **3D advantage:** is it better in 3D than on a 2D web page?
- **Measurability:** does it produce data the stats engine can analyse?
- **Curriculum weight:** how many APA outcomes and HEC courses does it touch?

| Rank | Concept cluster | Why it wins in 3D | Score /20 |
|---|---|---|---|
| 1 | Psychophysics, illusions and signal detection (Ames room, Ponzo, Müller-Lyer, JND staircases, d′) | Real 3D geometry *is* the stimulus; produces clean data for Weber/SDT maths | 19 |
| 2 | Attention (Stroop, visual search, Posner cueing, inattentional blindness in a live 3D plaza) | Player's own RTs; the "gorilla" event can happen in the world itself | 19 |
| 3 | Research methods, statistics and replication (design → ethics → run → analyse → replicate) | Ties every other room together; the core of APA Goal 2 | 19 |
| 4 | Memory (method-of-loci palace, serial position, DRM, eyewitness misinformation using a staged 3D event) | Spatial memory is native to 3D; eyewitness demo uses a real scene | 18 |
| 5 | Learning (Skinner-box lab, schedules with live cumulative records, Rescorla–Wagner, shaping) | Agents learn in real time; the player shapes them | 18 |
| 6 | Mental rotation (Shepard–Metzler using true 3D objects) | Impossible to do well in 2D; linear RT–angle data | 17 |
| 7 | Biopsychology (walk-through brain, neuron with LIF/HH spikes, synapse, split-brain, sleep EEG) | Spatial anatomy and animation | 17 |
| 8 | Social psychology (Asch room, bystander street scene, prisoner's dilemma, dissonance) with ethics framing | Crowds of expressive agents; ethics debriefs | 17 |
| 9 | Counselling micro-skills with simulated clients (OARS, reflections, CBT ABC) | Requires believable faces and branching dialogue | 16 |
| 10 | Development (conservation, A-not-B, false-belief, Strange Situation behind a one-way mirror) | Observation-room staging; coding behaviour | 16 |
| 11 | Psychometrics (reliability, validity, norms, SEM) with IPIP items | Numeric engine; less spatial, so it lives in panels | 15 |
| 12 | Motivation and emotion (FACS faces, Yerkes–Dodson, emotion theories) | Needs the new face system; illustrative curves only | 14 |

**3. Verified classic-study facts and replication status.**
- **Open Science Collaboration (2015, *Science* 349:aac4716):** replicated 100 studies from three psychology journals. In the paper's words, "Replication effects were half the magnitude of original effects"; 97% of the originals were significant but only 36% of the replications were, and 39% of effects were subjectively rated as having replicated.\[8\]
- **Hagger et al. (2016):** a 23-lab Registered Replication Report (N = 2,141) found ego depletion at d = 0.04, 95% CI [−0.07, 0.15].\[9\]
- **Le Texier (2019, *American Psychologist* 74(7):823–839):** used the Stanford Prison Experiment archives and interviews with 15 participants. He documented guard instructions, demand characteristics and biased data collection. Zimbardo and Haney published a reply in 2020.\[10\]\[11\]
- **Milgram (1963):** 26 of 40 men (65%) went to 450 V. That is one condition, not a universal rate.\[12\]
- **Simons and Chabris (1999):** across 192 observers, 46% failed to notice the unexpected event, and only 44% noticed the gorilla specifically.\[13\]\[14\]
- **Loftus and Palmer (1974):** "smashed" produced a mean speed estimate of 40.8 mph versus 34.0 mph for "hit". A week later, 32% of the "smashed" group reported nonexistent broken glass versus 14% of the "hit" group.\[15\]\[16\]
- **Darley and Latané (1968):** 85% of participants who believed they were alone reported the seizure, versus 31% of those who believed four others were listening.\[17\]
- **Festinger and Carlsmith (1959):** participants paid $1 rated the boring task +1.35, versus −0.05 for those paid $20 and −0.45 for the control group.\[18\]
- **Cowan (2001, *Behavioral and Brain Sciences* 24:87–114):** noted that "Miller (1956) summarized evidence that people can remember about seven chunks" but concluded that "a single, central capacity limit averaging about four chunks is implicated" (3–5).\[8\]\[19\]\[20\]

The prompt also lists every number I could not verify. Agent A1 must confirm those before they ship.

**4. Timing in browsers is good enough for teaching, but not perfect.** Bridges et al.'s (2020, *PeerJ* 8:e9414) timing mega-study compared 10 packages:\[8\]
- jsPsych and Testable showed 3.2–8.4 ms inter-trial variability (from the paper's results; the abstract does not state this range).\[21\]
- Per the abstract, "most of the packages achieved precision at least under 10 ms in all browsers, with PsychoPy achieving a precision under 3.5 ms in all".\[8\]
- The abstract calls audio-visual synchrony "the least precise aspect of the browser-based experiments".\[8\]

So the game must measure and report its own stimulus-onset jitter (Gate G13), and must never claim lab-grade precision.

**5. Licensing.**
- The IPIP is a public-domain pool of more than 3,000 items and 250+ scales that anyone may copy, edit or translate.\[22\]\[23\]
- PHQ-9/GAD-7 forms state "no permission required to reproduce, translate, display or distribute."\[24\]
- Commercial instruments (WAIS/WISC, MMPI, Rorschach, TAT, BDI-II) and DSM-5-TR criteria text must never be reproduced. The prompt enforces this.

**6. Pakistan helplines.** Verification found conflicts, so the prompt ships them with a "verify before shipping" flag:
- **Umang (0311-7786264):** listed by WHO EMRO for Pakistan. Umang's own social media says 24/7, but one directory says 3 pm–11 pm, and Umang's website was down when checked.\[25\]\[26\]\[27\]\[28\]
- **Taskeen (0316-8275336):** phone line Mon–Sat 11 am–11 pm per Taskeen's site.\[29\]
- **Rozan (0304-111-1741):** hours range from Mon–Fri 9–5 to longer, depending on the source.\[25\]\[30\]\[31\]
- **Emergency:** 1122 / 112 (mobile) ambulance, 15 police, 115 Edhi ambulance.\[26\]\[32\]
- **International fallback:** Find A Helpline (findahelpline.com), which IASP links to.

## Caveats

- Model IDs "claude-sonnet-5-5 / claude-opus-5-5 / claude-haiku-5-5" are copied from your original prompt. A1 must confirm the exact IDs against Anthropic's current model list before shipping.
- Several famous numbers were not verified first-hand in this research. They are marked "must be verified by A1" inside the prompt. Examples: Asch's 75% vs 74% "conformed at least once", Ainsworth's 70/15/15 split and its sample size, Darley and Latané's middle condition (62% vs 64%), Stroop, Shepard–Metzler slopes, Bandura and Harlow details, and Stevens exponents.\[33\]\[34\]\[35\]\[36\]\[37\]\[38\]
- Browser reaction times carry a fixed lag of tens of milliseconds and some jitter.\[39\] The game is for teaching and demonstration, not publishable research data.
- The game must never diagnose the player. All clinical content uses simulated clients only.

---

## THE SWARM PROMPT — copy everything between BEGIN and END into Claude Code

**BEGIN PROMPT**

ultrathink

# MISSION: "ZEHN — The Psychology Lab Simulator" (ذہن) — 3D Psychology Simulation & Gamification Game (Three.js, single-file HTML, offline)

You are the **Lead Architect & Orchestrator of a multi-agent engineering swarm**. This is a looping, self-verifying task: **Plan → Build → Verify → Critique → Fix**, repeated until every acceptance gate in §12 passes. You never declare "done" early. If a session ends, you resume from `PROGRESS.md`.

**The product:** one self-contained offline HTML file. It is a 3D psychology campus where bachelor psychology students:
1. explore theory in interactive 3D;
2. **run real timed experiments on themselves**;
3. run studies on simulated participants;
4. analyse the data with exact, unit-tested statistics;
5. pass an ethics board;
6. counsel simulated clients;
7. write and present an APA-style report.

It must clearly **exceed** the benchmark game (§0.1) on every measurable axis.

### §0 Input files

- `reference/Hyderabad_Airport_PM_Simulator.html` — about 4.0 MB, about 106,430 lines. This is the **minimum floor**: everything it does, ZEHN must match or beat.
- `reference/SKY_GATEWAY_PROMPT.md` — the airport swarm prompt whose structure this prompt mirrors.
- `reference/COURSE_OUTLINE.txt` — **optional**. If present, it overrides the default course plan in §6. Parse its weeks, topics and CLOs, and map them onto APA 3.0 outcomes. If it is absent, use the default 16-week plan in §6 and the degree map in §6.2.

**Step 0 (mandatory, before any code):** run
`grep -n "/\* ===== src/" reference/Hyderabad_Airport_PM_Simulator.html`.
Write `docs/BENCHMARK_INVENTORY.md`. For every benchmark module, list its banner path, line range, purpose, and the ZEHN module that will match or beat it.

#### §0.1 Benchmark baseline (what the airport game shipped — the floor)

- **Build:** one HTML file, 4.0 MB, about 106k lines. three.js r160 inlined with its MIT header kept. About 97 modules concatenated under `/* ===== src/... ===== */` banners.
- **Boot:** CSS light-sweep animation, real progress bar with step text, a "simulated" footnote, reduced-motion fallback.
- **Modes and journey:** 5 modes — Inspector (first-person), Manager (orbit), Tour, Drone, and Operations (unlocks at handover). Plus a 10-step first-person passenger-journey mini-game with a procedural boarding pass and aircraft cabin.
- **Post-processing:** hand-written, no EffectComposer. The chain is:
  1. HDR → TAA (Halton jitter, depth reprojection, YCoCg clamp; Ultra)
  2. camera motion blur (High+)
  3. half-res SSAO + blur
  4. bright pass → 3-level gaussian bloom
  5. radial god-rays
  6. 1×1 info pass (autofocus, sun occlusion, eye adaptation)
  7. composite: ACES, partial auto-exposure, heat shimmer, lens flare, grade, chromatic aberration, vignette, grain
  8. bokeh DOF (22/36/48 samples by tier) for Tour/Photo

  Every pass is gated by quality tier **and** a user toggle.
- **Quality tiers:** low/medium/high/ultra, picked from the GPU string. Re-tiered from rolling frame time, but never auto-promoted to Ultra. Supports `?quality=` override, per-feature overrides and per-tier world budgets.
- **Crowds:** one InstancedMesh per crowd, with box-limb people animated in the vertex shader (walk/work/sit/idle) and culturally specific clothing. **Weakness: no faces, no expressions, no gaze, no body language.**
- **Panels:** 25 dashboard panels in 5 rail groups, each tagged with week, CLO and domain.
- **Content:** about 142 quiz questions, about 317 glossary terms, about 38 decision events, about 84 AI intent patterns, about 21 tour beats.
- **Systems:**
  - Monte Carlo in a Web Worker; MSPDI/CSV export
  - seeded mulberry32 RNG
  - pure-logic modules tested with `node --test`
  - GameDirector with an ethics penalty
  - XP, badges, levels, scorecard, certificate, local leaderboard
  - English + Urdu label toggle

#### §0.2 Where psychology must go beyond the benchmark

1. **People must be believable.** Procedural humanoids need faces with FACS action units, gaze, blinking, posture, gait variety and lip-sync. Psychology is about people, so box-figures fail.
2. **The player is a participant.** Real timed tasks record the player's own RTs and accuracy, with measured timing quality (§5.3, G13).
3. **Every claim is evidence-graded.** Each finding carries a replication status: robust / mixed / failed / contested.
4. **There is an ethics and safety layer.** It covers consent, debriefing, content warnings, a crisis card, no diagnosis of the player, and local-only data.
5. **Research is a full cycle.** Design → IRB → run → analyse → APA write-up → peer review → replication.
6. **Copyright-clean assessment.** Use only IPIP, permitted free screeners, or original simulated items.
7. **Two depths of curriculum.** A 16-week intro/lab course *and* a whole-degree module map (HEC 2025 + APA 3.0 + BPS domains).

### §1 Non-negotiable rules

1. **Benchmark floor.** `docs/BENCHMARK_PARITY.md` lists every benchmark feature with "ZEHN equivalent + evidence": a file path and a screenshot or test name. Any regression fails G1.
2. **Course traceability.** Every course week maps to ≥1 panel, ≥1 3D mechanic, ≥1 mission, a quiz set and a tour beat. Every screen shows an **APA 3.0 outcome tag** (e.g., "APA 2.4"), a **domain tag** (BPS: Bio / Cog / Dev / Social / IndDiff / CHI / Methods) and an **HEC course tag** (e.g., "HEC S2 Experimental Psychology").
3. **Zero hallucination.**
   - All factual claims (study results, dates, sample sizes, percentages) live in `src/data/facts.json` as `{id, claim, value, unit, source, doi_or_url, retrieved, confidence: "verified"|"must-verify"|"disputed", replication: "robust"|"mixed"|"failed"|"contested", caveat}`.
   - The UI only states facts from that file.
   - Anything invented is visibly labelled **"Simulated data"**.
   - No real logos. No real living individuals portrayed as characters. Historical researchers may be **named in text** only, never rendered as 3D likenesses.
   - Formulas are exact and unit-tested (§5.3).
4. **Ethics and safety (A1 holds a veto).**
   - **Simulated clients only.** No module ever diagnoses, screens or labels the *player*.
   - Any self-report questionnaire the player answers (e.g., IPIP Big Five) shows "for learning only, not a diagnosis". Mental-health screeners (PHQ-9/GAD-7) appear **only** scored on simulated clients, never on the player.
   - **Content warnings** with an opt-out before modules on suicide, self-harm, abuse, trauma, obedience/shock or prison simulations. Opting out unlocks an equivalent text-and-quiz path, so progress is not blocked.
   - **Informed-consent screen** (participant-style) before any task that records the player's RTs. It states purpose, duration, right to withdraw at any time without penalty, and "your data never leaves this device".
   - **Debriefing screen** after every deception-based demo (Asch, Milgram, misinformation, inattentional blindness). It explains the deception, its purpose and the ethical safeguards, and offers to delete the data.
   - **Crisis-resource card,** always reachable from the Settings rail and auto-shown by the AI agent's crisis detector (§7). It lists the numbers in §2.1 F-H1–F-H6 with "hours may vary — verify" text.
   - **Photosensitivity warning** before any flicker/flash demo. Flashing is capped at 3 Hz with luminance changes limited, per WCAG 2.3.1 "three flashes" guidance. Flicker demos have a static alternative.
   - Data stays in `localStorage`/IndexedDB. Exports are user-initiated files only. **No network calls** except the optional LLM (§7).
5. **Copyright for tests.**
   - **Never** reproduce items, plates, stimuli or scoring keys from WAIS/WISC, Stanford–Binet, MMPI, Rorschach inkblots, TAT cards, BDI-II, NEO-PI-R, MBTI, Raven's matrices, or copyrighted DSM-5-TR/ICD-11 criteria text.
   - **Allowed:**
     - IPIP items (public domain)\[22\]\[40\]
     - PHQ-9 / GAD-7 (free to reproduce per phqscreeners.com), applied to simulated clients only\[41\]
     - original procedurally generated stimuli: illusions, matrices-*style* puzzles you invent, inkblot-*style* symmetric procedural blots labelled "original simulation, not a Rorschach plate"
     - colour-vision demos that are procedurally generated and labelled "not a clinical Ishihara test"
   - Disorders are described in **original paraphrase** with "see DSM-5-TR / ICD-11 for official criteria".
   - A1 records the licence for every item set in `docs/LICENSES.md`.
6. **Single-file, offline-first.** Must work over `file://`. No CDN, no web fonts, no external images or audio: all textures, sounds and meshes are procedural. three.js is inlined with its licence header kept.
7. **No placeholders.** No dead buttons, no "coming soon", no lorem ipsum. Every control does something testable.
8. **Never declare done** until G1–G14 pass with evidence in `docs/TEST_REPORT.md`.

### §2 Grounded scenario

**Setting (simulated): "Indus Institute of Behavioural Sciences (IIBS)", Hyderabad, Sindh** — a fictional department labelled "Simulated institution" on the boot screen and in the footer. The setting continues the user's Hyderabad context. Real places are mentioned only as facts in facts.json. Nine zones are connected by a shaded courtyard with neem trees, ajrak-patterned banners and brick jaali screens:

1. **Wundt Hall** — history-of-psychology museum. Timeline from 1879 to now; dioramas of schools (structuralism → neuroscience); figures shown as plaques, never likenesses.
2. **Experimental Lab Wing** — psychophysics booth, illusion rooms (a true Ames room, Ponzo corridor, forced-perspective hall, impossible-object gallery), attention cubicles, the mental-rotation bench.
3. **Neuro Atrium** — a 12 m walk-through brain with lobes and structures that light up, a neuron bridge (action-potential simulator), a synapse chamber, a split-brain demo table.
4. **Sleep & Consciousness Lab** — bed, live procedural EEG with sleep stages and a hypnogram, circadian clock.
5. **Learning Lab** — Skinner boxes with procedural animal agents, a Pavlov bell station, live cumulative recorders, an observational-learning playroom (a cartoon "Bobo-style" toy, original design).
6. **Child Development Suite** — observation room behind a one-way mirror (Strange Situation, conservation, A-not-B, false-belief).
7. **Counselling & Clinic Centre** — waiting room, therapy room, supervision room.
8. **Social Psychology Plaza / "Mohalla" street** — a crowd simulation with a bus stop, chai dhaba, market and a staged emergency for the bystander demo.
9. **Methods & Stats Library** — Ethics Board (IRB) chamber, Statistics Workbench, poster-presentation hall.

#### §2.1 Verified facts (seed `facts.json`; A1 re-checks every entry before release)

| ID | Claim | Value | Source | Status |
|---|---|---|---|---|
| F-APA | APA Guidelines for the Undergraduate Psychology Major v3.0 (2023): 5 goals; outcomes 1.1–1.5, 2.1–2.4, 3.1–3.3, 4.1–4.4, 5.1–5.6\[2\] | 22 outcomes | apa.org/about/policy/undergraduate-psychology-major.pdf | verified |
| F-HEC1 | HEC revised Psychology curricula notified 18 Feb 2025 (No. HEC/CD/NCRC/PSYC/2025/7162)\[4\] | BS min 134 CH; 84 CH major (28 courses); internship 3 CH (6–8 wks); capstone 3 CH; 7 specialisations\[4\] | hec.gov.pk RevisedCurricula 2024-2025/Psychology.pdf | verified |
| F-HEC2 | HEC semester length | 16–18 weeks incl. 1–2 exam weeks\[4\] | same | verified |
| F-BPS | BPS accreditation core areas | Biological, cognitive, developmental, social, individual differences, conceptual & historical, research methods + empirical project | BPS 2019 standards (as summarised in PMC7617501) | verified\[42\] |
| F-OSX | OpenStax Psychology 2e licence and length | CC BY 4.0; 16 chapters | openstax.org | verified\[7\] |
| F-OSC | Open Science Collaboration 2015, *Science* 349:aac4716, DOI 10.1126/science.aac4716 | 100 replications; 97% originals significant vs 36% replications; "Replication effects were half the magnitude of original effects"; 47% of original effect sizes inside the replication 95% CI; 39% subjectively rated as replicated\[8\] | Science 2015 (PubMed abstract) | verified |
| F-EGO | Hagger et al. 2016 ego-depletion RRR, *Perspect. Psychol. Sci.* 11(4):546–573 | 23 labs, N = 2,141, d = 0.04, 95% CI [−0.07, 0.15] (earlier meta-analysis d = 0.62)\[9\]\[43\] | DOI 10.1177/1745691616652873 | verified; replication: failed |
| F-SPE | Le Texier 2019 "Debunking the Stanford Prison Experiment", *Am Psychol* 74(7):823–839, DOI 10.1037/amp0000401, PMID 31380664\[11\] | Archives + interviews with 15 participants; guards received instructions; demand characteristics; biased data collection. Zimbardo & Haney replied in 2020\[10\]\[11\] | PubMed | verified; contested |
| F-MIL | Milgram 1963, *J Abnorm Soc Psychol*, DOI 10.1037/h0040525 | 26/40 (65%) to 450 V; none stopped before 300 V; one condition only\[44\] | Milgram 1963 | verified. Cross-condition average (secondary source: 43.6% over 21 conditions): **must be verified by A1**\[45\] |
| F-ASCH | Asch conformity (1951/1956) | ≈37% of critical-trial responses conformed (12 critical trials); ≈75% conformed at least once (some sources say 74%)\[36\]\[46\] | textbook summaries | **must be verified by A1** against Asch 1956 |
| F-IB | Simons & Chabris 1999, *Perception* 28:1059–1074 | N = 192; 46% failed to notice; gorilla noticed 44% vs umbrella woman 65%; easy 64% vs hard 45% noticed\[14\]\[47\] | original paper | verified; robust |
| F-LP | Loftus & Palmer 1974, *JVLVB* 13:585–589 | Mean mph: smashed 40.8, collided 39.3, bumped 38.1, hit 34.0, contacted 31.8. Broken glass "yes": smashed 16/50 (32%), hit 7/50 (14%), control 6/50\[16\]\[48\]\[49\] | original paper | verified |
| F-BYS | Darley & Latané 1968 seizure study | 72 NYU students; reported before end of fit: alone 85%, with 4 others 31%; middle condition 62% or 64% (sources conflict)\[17\]\[37\]\[38\] | secondary summaries | 85%/31% verified across sources; middle value **must be verified by A1** |
| F-FC | Festinger & Carlsmith 1959, *J Abnorm Soc Psychol* 58:203–210, DOI 10.1037/h0041593 | Enjoyment (−5..+5): $1 +1.35, $20 −0.05, control −0.45; 20 per analysed condition | original paper | verified\[50\]\[51\] |
| F-COW | Cowan 2001, *Behav Brain Sci* 24:87–114, DOI 10.1017/S0140525X01003922 | "A single, central capacity limit averaging about four chunks" (3–5), vs Miller 1956 "about seven chunks" (*Psychol Rev* 63:81–97)\[8\] | PubMed abstract | verified\[19\]\[20\] |
| F-TIME | Bridges et al. 2020, *PeerJ* 8:e9414, DOI 10.7717/peerj.9414 | Abstract: "most of the packages achieved precision at least under 10 ms in all browsers, with PsychoPy achieving a precision under 3.5 ms in all"; audio-visual synchrony "the least precise aspect". Paper results: jsPsych/Testable 3.2–8.4 ms inter-trial variability\[8\]\[21\] | PMC7512138 | verified |
| F-IPIP | International Personality Item Pool | >3,000 items, >250 scales, public domain, free to copy/edit/translate\[23\] | ipip.ori.org (Goldberg et al. 2006) | verified |
| F-PHQ | PHQ-9 / GAD-7 | "No permission required to reproduce, translate, display or distribute"\[24\] | phqscreeners.com | verified |
| F-AIN | Ainsworth Strange Situation (Ainsworth et al. 1978) | Commonly quoted 70% secure / 15% avoidant / 15% resistant; sample size quoted variously (26 families / 100 / 106). Disorganised type added later (Main & Solomon 1990) | textbook summaries | **must be verified by A1**\[33\]\[34\]\[52\] |
| F-H1 | Umang Pakistan helpline | 0311-7786264; listed by WHO EMRO; hours conflict (24/7 per Umang social media vs 3–11 pm per worldhotlines.org); Umang says it does not handle active attempts → emergency services\[25\]\[26\]\[27\]\[53\] | emro.who.int/mhps/suicide.html | verify before shipping |
| F-H2 | Taskeen helpline | 0316-8275336; phone Mon–Sat 11 am–11 pm; chatbot 24/7\[29\]\[54\] | taskeen.org | verify before shipping |
| F-H3 | Rozan Counselling Helpline | 0304-111-1741; hours vary by source (most: Mon–Fri ~9 am–5 pm)\[25\]\[55\]\[56\] | rozan.org; findahelpline.com | verify before shipping |
| F-H4 | Emergency numbers, Pakistan | Ambulance 1122 (112 from mobile); Police 15; Edhi ambulance 115\[26\]\[57\] | WHO EMRO; PCSW Punjab | verify before shipping |
| F-H5 | 1166 Sehat Tahaffuz "Humraaz" (launched Apr 2023)\[58\] | Federal health line; connects callers to counsellors/hospitals (referral, not counselling)\[59\] | Ministry of NHSR brief | verify before shipping |
| F-H6 | International fallback | Find A Helpline (findahelpline.com; linked by IASP); Befrienders Worldwide | findahelpline.com | verify before shipping |

**Must be verified by A1 before any UI use** (add to facts.json as `must-verify`; the UI shows them only after verification or with a "figure under verification" badge):
- Stroop (1935) original interference values
- Ebbinghaus (1885) savings data points
- Shepard & Metzler (1971) RT slope and intercept
- Bandura, Ross & Ross (1961) sample and design
- Harlow (1958) procedure details
- Yerkes & Dodson (1908): the original was mice and discrimination difficulty; the modern inverted-U is a later generalisation
- Stevens exponents (e.g., brightness ≈ 0.33, electric shock ≈ 3.5)
- power-posing replication status (Ranehill et al. 2015)
- facial-feedback replication status (Wagenmakers et al. 2016 RRR; Coles et al. 2022)
- Sherif robbers cave critiques
- Kitty Genovese reporting inaccuracies
- H.M. (Henry Molaison) and Phineas Gage case details

### §3 Swarm organisation

| Agent | Role | Owns |
|---|---|---|
| **A0 Orchestrator** | Plans, sequences, merges, runs the loop, keeps PROGRESS.md | `PROGRESS.md`, `docs/ARCHITECTURE.md` |
| **A1 Research, Fact-Check & Ethics Reviewer (VETO)** | Verifies every fact/citation, replication status, licences, ethics/safety copy, helplines | `src/data/facts.json`, `docs/FACTS_AND_SOURCES.md`, `docs/LICENSES.md`, `docs/ETHICS_SAFETY.md` |
| **A2 World & Campus** | 9 zones, layout, colliders, props, illusion rooms in real geometry | `src/world/*` |
| **A3 Rendering & Graphics** | Post-FX chain ≥ benchmark, quality tiers, procedural PBR, IBL, sky, lighting moods | `src/engine/*` |
| **A4 Characters & Faces** | Procedural humanoids, FACS morph targets, gaze, blink, gait, posture, lip-sync, crowds | `src/people/*` |
| **A5 Psych Engine** | Statistics, psychometrics, SDT, psychophysics, learning models, neuron sim, agent participant model (pure JS, node-tested) | `src/psych/*`, `test/*` |
| **A6 UI/UX & Dashboard** | ≥34 panels, HUD, charts, onboarding, accessibility, Urdu labels | `src/ui/*`, `src/styles/*` |
| **A7 AI Lab Mentor "RAAHI"** | Offline intent engine + optional LLM, tools, guardrails, voice | `src/ai/*` |
| **A8 Experiments & Paradigms** | jsPsych-style timeline runner, ≥36 paradigms, timing instrumentation, CSV/JSON export | `src/exp/*` |
| **A9 Gamification, Tour & Assessment** | Missions, dilemmas, quiz bank, XP/badges, scorecard, certificate, tour | `src/game/*`, `src/data/quiz.json` |
| **A10 Audio** | Procedural WebAudio: ambience, UI, dichotic listening (hard-panned L/R), binaural cues, tones for psychophysics | `src/audio/*` |
| **A11 QA, Performance & Accessibility** | Playwright e2e, bot participant, FPS, soak, a11y, timing gate | `e2e/*`, `docs/TEST_REPORT.md` |
| **A12 Clinical & Counselling Simulation Designer** | ≥20 simulated client cases, branching dialogue, micro-skill scoring, supervision feedback | `src/clinic/*`, `src/data/clients.json` |

**Protocol**
- `docs/ARCHITECTURE.md` defines one shared `sim` object (`sim.state`, `sim.rng`, `sim.clock`, `sim.bus`, `sim.data`, `sim.settings`).
- Events flow through `sim.bus.on/emit`, e.g. `trial:start`, `trial:end`, `exp:complete`, `irb:decision`, `client:turn`, `crisis:detected`, `quality:change`.
- JSON schemas for every data file live in `src/data/schemas/`.
- Modules in `src/psych/` and `src/exp/core/` must not touch the DOM or THREE.
- **A1 and A11 review every merge.** A1 can block any content for factual, ethical or licensing reasons.

### §4 3D world and graphics

1. **Parity chain (mandatory):** reproduce every benchmark pass with the same tier gating and user toggles — HDR, TAA, motion blur, SSAO, bloom, god-rays, info pass, ACES composite, lens effects, bokeh DOF. Add:
   - screen-space reflections on the lab's polished floors (High+)
   - volumetric light shafts in Wundt Hall
   - subsurface-scattering approximation for skin (wrap lighting + red-shifted scatter term)
2. **Psychology-specific visuals:**
   - **Neuro Atrium brain:** procedurally sculpted lobes (signed-distance field → marching cubes at build time, cached), with labelled structures. Selecting a function (e.g., "language production") lights the relevant regions. Neural firing particles travel along tracts. Labels are in the textbook-level anatomy vocabulary from glossary.json.
   - **Illusion rooms built in true 3D:** the Ames room has a trapezoid geometry correct from a single peephole camera, and leaving the peephole reveals the trick. Ponzo rails, Müller-Lyer, a Necker cube that flips under a gaze cue, an impossible triangle that resolves when walked around, a hollow-face mask, colour constancy under coloured lighting, and a motion aftereffect spiral (static alternative available).
   - **Eye-tracking-style heatmaps:** mouse or gaze proxy over visual-search displays, rendered as a GPU accumulation texture.
   - **Emotion-tinted lighting:** in counselling scenes, a subtle grade follows the client's simulated affect (valence/arousal). Off by default for accessibility.
   - **Sleep-lab EEG:** procedural waveforms per stage (alpha, theta, spindles, K-complexes, delta, REM sawtooth), labelled "simulated EEG".
3. **Quality tiers:** same rules as the benchmark (GPU string → tier, rolling re-tier, never auto-Ultra, `?quality=`, per-feature overrides). Per-tier budgets include faces: Ultra uses full morph set + eye shaders, Low uses 4 key AUs.
4. **Performance targets:** ≥60 fps at High on a discrete GPU at 1080p; ≥30 fps at Medium on an integrated GPU. During **timed trials** the renderer enters "experiment mode": the post-FX chain drops to the minimum, the scene freezes, and the stimulus is drawn in a dedicated canvas layer to minimise frame jitter (see G13).

### §5 Game modes and systems

#### §5.1 Modes (number keys 1–7)

| Key | Mode | What the player does |
|---|---|---|
| 1 | **Researcher Walk** (first-person) | Explore zones, open exhibits, start paradigms |
| 2 | **Director View** (orbit) | Design studies, place simulated participants, view live data overlays |
| 3 | **Participant Mode** | Do real timed tasks; get your own data, graphs and a debrief |
| 4 | **Clinic** | Counselling sessions with simulated clients (branching dialogue + FACS faces) |
| 5 | **Social Sim** (Mohalla) | Crowd agents follow social-psychology models (conformity, bystander, cooperation) |
| 6 | **Neuro Explorer** | Fly through the brain; run neuron and synapse sims |
| 7 | **Tour / Photo / Drone** | ≥32-beat guided tour; DOF photo mode; free drone |

**Mini-journey (beats the passenger journey): "A Participant's Journey" — 12 first-person steps**
1. See a recruitment poster
2. Read the information sheet
3. Give informed consent (signature pad)
4. Collect demographics (optional, skippable)
5. Practice block
6. Experimental blocks (Stroop → visual search → serial-position recall)
7. Manipulation check
8. Debrief (a deception reveal if applicable)
9. Withdrawal option
10. Watch your data become an anonymised row in the lab dataset
11. See the group results on the Statistics Workbench
12. Receive a participation certificate

A second journey, "A Client's First Session" (simulated), walks the waiting room → intake → consent and confidentiality limits → session → referral information.

#### §5.2 Dashboard panels (≥34; 6 rail groups)

| # | Panel | Required content | Week | APA | Domain |
|---|---|---|---|---|---|
| 1 | Course Map | Week grid, progress, links to zones/missions | all | 1.2 | CHI |
| 2 | History & Schools | Interactive timeline 1879→now, school comparison cards | 1 | 1.3 | CHI |
| 3 | Perspectives Lens | Same behaviour explained by 7 perspectives | 1 | 1.5 | CHI |
| 4 | Research Methods Lab | Design builder: IV/DV, operationalisation, between/within, counterbalancing, confounds | 2 | 2.2 | Methods |
| 5 | Ethics Board (IRB) | Review ≥15 proposals: approve/revise/reject with APA Code & Belmont reasons | 2 | 3.1 | Methods |
| 6 | Statistics Workbench | Descriptives, z, t, ANOVA, χ², r, regression, effect sizes, power | 3,16 | 2.4 | Methods |
| 7 | Biopsychology | Neuron/AP simulator, neurotransmitter table, brain map | 4 | 1.1 | Bio |
| 8 | Brain & Cases | Split-brain demo, lesion cases (A1-verified text) | 5 | 1.1 | Bio |
| 9 | Consciousness & Sleep | Hypnogram, EEG, circadian sim | 5 | 1.1 | Bio |
| 10 | Sensation & Psychophysics | Thresholds, staircases, Weber/Fechner/Stevens fits | 6 | 2.1 | Cog |
| 11 | Signal Detection | ROC, d′, c, payoff manipulation | 6 | 2.4 | Cog |
| 12 | Perception & Illusions | Illusion rooms, depth cues, constancy | 6 | 1.1 | Cog |
| 13 | Attention Lab | Stroop, search slopes, Posner, attentional blink, dichotic listening, IB | 7 | 2.1 | Cog |
| 14 | Learning Lab | Classical/operant, schedules, cumulative records, R–W fit | 8 | 1.1 | Bio/Cog |
| 15 | Memory Lab | Serial position, Brown–Peterson, levels of processing, DRM, n-back, memory palace | 9 | 2.1 | Cog |
| 16 | Eyewitness Room | Misinformation demo + debrief + lineup fairness | 9 | 1.4 | Cog/Social |
| 17 | Cognition & Language | Heuristics/biases, framing, anchoring, Wason, Tower of Hanoi, mental rotation | 10 | 2.1 | Cog |
| 18 | Intelligence & Testing | Theories, Flynn effect (verified), test-bias discussion, *original* puzzles only | 10 | 1.2 | IndDiff |
| 19 | Development | Piaget tasks, ToM, attachment coding, Erikson, Kohlberg dilemmas | 11 | 1.2 | Dev |
| 20 | Motivation & Emotion | FACS face lab, emotion theories comparator, Yerkes–Dodson (illustrative) | 12 | 1.1 | Bio/Social |
| 21 | Health & Stress | HPA-axis sim, coping, biopsychosocial model | 12 | 3.3 | Bio |
| 22 | Personality | IPIP Big Five (learning only), trait vs social-cognitive, projective-test critique | 13 | 1.2 | IndDiff |
| 23 | Psychometrics | Reliability (test-retest, α, κ, split-half + Spearman–Brown), validity types, norms, SEM | 13 | 2.4 | IndDiff |
| 24 | Social Psychology | Asch, bystander, dissonance, FAE, PD/game theory, Milgram & SPE as ethics/critique cases | 14 | 1.1 | Social |
| 25 | I-O Psychology | Selection validity, job analysis, motivation, safety culture | 14 | 1.4 | Social |
| 26 | Psychopathology (Simulated) | Diathesis-stress, biopsychosocial, DSM-5-TR/ICD-11 *structure* only, stigma | 15 | 1.4 | IndDiff |
| 27 | Therapies & Counselling | Rogers' core conditions, OARS, CBT ABC/thought record, session scoring | 15 | 4.1 | Applied |
| 28 | Cross-Cultural & Indigenous | Collectivism, joint families, help-seeking, stigma in Pakistan (A1-verified) | 15 | 3.2 | Social |
| 29 | Positive Psychology | Wellbeing models, strengths, evidence quality | 15 | 3.3 | Applied |
| 30 | Replication & Open Science | OSC 2015, RRRs, p-hacking simulator, preregistration builder | 16 | 2.2 | Methods |
| 31 | Experiment Builder | Timeline editor (trials, blocks, randomisation, counterbalancing) | 2–16 | 2.2 | Methods |
| 32 | Data Export | CSV/JSON per paradigm, codebook, anonymisation | all | 4.4 | Methods |
| 33 | APA Report Generator | Title page → Abstract → Method → Results (APA-7 formatted stats) → Discussion | 16 | 4.2 | Methods |
| 34 | Case Studies | ≥14 cited cases (§5.5) | all | 1.4 | CHI |
| 35 | Missions | ≥16 missions with progress | all | 5.2 | — |
| 36 | Assessment & Quiz | ≥320 items, adaptive practice, item analysis | all | 2.1 | — |
| 37 | AI in Psychology & Ethics | LLM limits, chatbot-therapy risks, bias, privacy | 16 | 3.1 | CHI |
| 38 | Present & Report | Presenter mode, poster export (PNG), slide outline | 16 | 4.2 | — |
| 39 | Session, Safety & Settings | Consent log, data deletion, crisis card, accessibility, language | — | 5.1 | — |

**Rail groups:**
- **Foundations** (wk 1–3)
- **Brain & Mind** (wk 4–7)
- **Learning & Thinking** (wk 8–10)
- **Lifespan & Self** (wk 11–13)
- **People & Practice** (wk 14–16)
- **System**

#### §5.3 Engine formulas (exact; `node --test` with golden values)

A5 implements each formula below in `src/psych/`, with a JSDoc citation, and writes ≥3 tests per formula. Golden values must come from R or SciPy runs pasted into `test/golden/*.json` (record the command), or from the textbook example cited.

| Formula | Canonical form | Required test |
|---|---|---|
| Mean, SD | x̄ = Σx/n; sample s = √[Σ(x−x̄)²/(n−1)]; population σ = √[Σ(x−μ)²/N] | both variants on the same data |
| z, T, deviation IQ | z = (x−μ)/σ; T = 50 + 10z; IQ-style = 100 + 15z | x=130, μ=100, σ=15 → z=2.00, T=70 |
| Normal CDF / percentile | Φ(z) via erf (Abramowitz & Stegun 7.1.26 or better); percentile = 100·Φ(z) | Φ(2.00)=0.97725 |
| Inverse normal | Acklam or Wichura AS241 | Φ⁻¹(0.975)=1.95996 |
| SEM, CI | SEM = SD·√(1−rₓₓ); CI = X ± z·SEM | SD=15, r=.91 → SEM=4.5 |
| Spearman–Brown | r′ = k·r / [1+(k−1)·r] | r=.60, k=2 → .75 |
| Cronbach's α | α = [k/(k−1)]·[1 − Σσᵢ²/σ²ₓ] | golden from R `psych::alpha` |
| Cohen's κ | κ = (pₒ − pₑ)/(1 − pₑ) | pₒ=.80, pₑ=.50 → .60 |
| Pearson r | r = Σ(x−x̄)(y−ȳ)/√[Σ(x−x̄)²·Σ(y−ȳ)²] | perfect line → 1.0 |
| Simple regression | b = r·(s_y/s_x); a = ȳ − b·x̄; R² = r² | golden from R `lm` |
| Independent t | t = (x̄₁−x̄₂)/[s_p√(1/n₁+1/n₂)], s_p² = [(n₁−1)s₁²+(n₂−1)s₂²]/(n₁+n₂−2); df = n₁+n₂−2; Welch as option | p from regularised incomplete beta; t=2.228, df=10 → p≈.050 two-tailed |
| Paired t | t = d̄/(s_d/√n), df = n−1 | golden |
| One-way ANOVA | F = MS_between/MS_within; η² = SS_between/SS_total | F(2,27)=3.354 → p≈.050 |
| χ² | χ² = Σ(O−E)²/E; GOF df = k−1; independence E = (row·col)/N, df = (r−1)(c−1) | χ²=3.841, df=1 → p≈.050 |
| Cohen's d | d = (M₁−M₂)/s_pooled (paired: d_z = d̄/s_d) | golden |
| Power (two-sample, normal approx.) | power ≈ Φ(d·√(n/2) − z₁₋α/₂) | d=0.5, n=64/group → ≈.80 |
| Signal detection | d′ = z(H) − z(FA); c = −½[z(H)+z(FA)]; log-linear correction for 0/1 rates: (hits+0.5)/(signal trials+1) (Hautus 1995) | H=.84, FA=.16 → d′≈1.99, c≈0 |
| Weber | ΔI/I = k | fit from staircase data |
| Fechner | S = k·ln(I/I₀) | monotonic test |
| Stevens | ψ = k·φᵃ (exponents from facts.json, must-verify) | log–log slope = a |
| Rescorla–Wagner | ΔV_X = α_X·β·(λ − ΣV); V ← V + ΔV | blocking emerges; acquisition asymptotes at λ |
| Ebbinghaus savings | savings % = 100·(OL − RL)/OL; retention model R = e^(−t/S) labelled "model" | OL=20, RL=8 → 60% |
| Hick–Hyman | RT = a + b·log₂(n+1) | linear in log₂(n+1) |
| Fitts | MT = a + b·log₂(2D/W) (Fitts 1954); Shannon form log₂(D/W+1) (MacKenzie 1992) as option | ID computation |
| Serial position | % recall per position; primacy = mean(pos 1–3); recency = mean(last 3) | synthetic U-curve |
| Mental rotation | RT = a + b·angle; report slope (ms/deg) | linear fit |
| Leaky integrate-and-fire | τₘ·dV/dt = −(V−V_rest) + R·I; spike when V ≥ V_th → V_reset; refractory period | f–I curve monotonic |
| Hodgkin–Huxley (Ultra/advanced) | C·dV/dt = I − g_Na·m³h(V−E_Na) − g_K·n⁴(V−E_K) − g_L(V−E_L); C=1 μF/cm², ḡ_Na=120, ḡ_K=36, ḡ_L=0.3 mS/cm², E_Na=50, E_K=−77, E_L=−54.4 mV; RK4 at dt ≤ 0.025 ms | spike threshold ≈ 6–7 µA/cm² DC; matches reference trace |
| Kappa/Pearson p-values, F, t, χ² CDFs | regularised incomplete beta/gamma (continued fractions) | compare vs R at 10 points each |

**Simulated participants.** Each agent has latent traits (ability, speed, noise σ, lapse rate, Big Five vector) drawn from seeded distributions. RT = ex-Gaussian(μ, σ, τ) + condition effect. Effects are parameterised from facts.json where verified, and otherwise labelled "Simulated effect size".

#### §5.4 Minimums (each must beat the benchmark; G3 counts them automatically)

| Item | Benchmark | ZEHN minimum | Why this number |
|---|---|---|---|
| Runnable paradigms | 0 | **≥36** | ≥2 per week for 16 weeks + 4 capstone paradigms |
| Dashboard panels | 25 | **≥34** (39 listed) | one per HEC core course + methods tools |
| Quiz questions | ≈142 | **≥320** | 20 per week × 16, Bloom-tagged (≥30% apply/analyse) |
| Glossary terms | ≈317 | **≥420** | intro-text key terms across 16 chapters + methods/stats |
| AI intents | ≈84 | **≥130** | ≥8 per week + safety/crisis + navigation |
| Tour beats | ≈21 | **≥32** | 2 per week |
| Decision events / dilemmas | ≈38 | **≥56** | IRB, clinic, social and replication dilemmas |
| Simulated client cases | 0 | **≥20** | 2 per major diagnostic family + 4 culturally specific |
| Missions | n/a | **≥16** | one per week |
| Case studies with sources | n/a | **≥14** | classic + critique pairs |
| Modes | 5 | **7 + 2 journeys** | |
| Expressive face AUs | 0 | **≥14 AUs + gaze + blink + visemes** | |

**Paradigm list (minimum 36):**
1–6. Müller-Lyer, Ponzo, Ames room, JND staircase (Weber), magnitude estimation (Stevens), yes/no SDT with payoffs
7–12. Stroop, feature vs conjunction search, Posner cueing, attentional blink (RSVP), dichotic listening, inattentional blindness (3D plaza)
13. Change blindness (flicker, with photosafe alternative)
14–20. Serial position, Brown–Peterson, levels of processing, DRM false memory, misinformation (eyewitness), n-back, memory palace
21–23. Classical conditioning (acquisition/extinction/spontaneous recovery), operant schedules FR/VR/FI/VI, shaping
24–28. Mental rotation (3D), Tower of Hanoi, Wason selection, framing (Asian-disease-style, original wording), anchoring
29–30. Hick–Hyman choice RT, Fitts pointing
31–32. Piaget conservation (observe/code), false-belief (Sally–Anne-style, original characters)
33. Asch-style conformity with agent confederates (debriefed)
34. Prisoner's dilemma tournament
35. IPIP Big Five + reliability analysis on class data
36. Facial-expression recognition with procedural FACS faces

#### §5.5 Case studies (anti-hallucination protocol)

- Each case is an **original ≤300-word summary** with source + DOI from facts.json, a "What later research says" box, and a replication badge.
- Required pairs: Milgram ↔ ethics critiques and Burger 2009 partial replication (Burger used a "150-volt solution" and, per Miller's 2009 commentary in *American Psychologist* 64(1):20–27, DOI 10.1037/a0014407, reported "a high base rate of obedience, comparable to that observed by Stanley Milgram"; A1 must verify Burger's own figures);\[8\] SPE ↔ Le Texier 2019; Little Albert ↔ ethics; Phineas Gage ↔ myth vs record; H.M. ↔ memory systems; Genovese ↔ reporting inaccuracies; ego depletion ↔ RRR 2016; power posing ↔ failed replication; Bobo doll; Harlow; Strange Situation ↔ cross-cultural variation; Loftus ↔ eyewitness reforms; OSC 2015; one Pakistan-relevant mental-health stigma case built from A1-verified literature, or an instructor-editable card.
- If a fact cannot be verified, the card becomes **instructor-editable** with the empty field visibly marked. Never invent.

#### §5.6 Gameplay loop and gamification

**Semester campaign: "Run a Research Programme."** Each week:
1. **Learn:** tour beat + exhibit.
2. **Experience:** do the paradigm as a participant.
3. **Design:** a variant in the Experiment Builder.
4. **Ethics:** submit to the IRB. The board can return "revise" with reasons.
5. **Run:** N simulated participants (individual differences + noise), optionally plus yourself.
6. **Analyse:** in the Workbench. The AI mentor critiques but never computes for you until you try.
7. **Write:** APA results paragraph (auto-formatted stats, e.g., *t*(38) = 2.41, *p* = .021, *d* = 0.76).
8. **Peer review:** a rubric-based critique of a simulated peer's flawed report.
9. **Replicate:** run a preregistered replication, with an honest outcome drawn from facts.json's replication status.

**Systems:**
- Sim clock ×1/×5/×20 for agent studies.
- Seeded RNG (`?seed=`).
- Difficulty levels: Foundation / Bachelor / Honours. Higher levels hide hints and add confounds to spot.
- Dilemma cards show visible trade-offs: rigour vs ethics vs time vs participant welfare. The GameDirector applies an **ethics penalty** for unethical choices (e.g., skipping debrief).
- XP, badges (e.g., "Debrief Champion", "Preregistered", "Replicator"), levels, and a scorecard mapped to the 5 APA goals.
- Grade, plus a printable certificate (canvas → PNG/print CSS).
- Local leaderboard by seed.
- Feedback "juice" respects reduced motion.

### §6 Course traceability

#### §6.1 Default 16-week "Introduction to Psychology + Experimental Lab"

Write `docs/COURSE_MAPPING.md` and an in-game Course Map. Override from COURSE_OUTLINE.txt if supplied.

| Wk | Topic (OpenStax 2e ch.) | Panels | 3D mechanic | Mission | Quiz set | Tour beat | APA | Domain | HEC course |
|---|---|---|---|---|---|---|---|---|---|
| 1 | History, schools, perspectives (1) | 2,3 | Wundt Hall timeline walk | "Curate the Museum" | Q01 | T01–02 | 1.3,1.5 | CHI | S1 Schools & Perspectives |
| 2 | Research methods & ethics (2) | 4,5,31 | IRB chamber hearings | "Pass the Board" | Q02 | T03–04 | 2.2,3.1 | Methods | S3 Ethics; S6 Res. Methods |
| 3 | Descriptive stats, normal curve, correlation | 6 | Data-sculpture histograms in 3D | "Describe the Class" | Q03 | T05–06 | 2.4 | Methods | S5 Data Analysis |
| 4 | Neurons, AP, synapse (3) | 7 | Neuron bridge + synapse chamber | "Fire the Neuron" | Q04 | T07–08 | 1.1 | Bio | S2 Behavioral Neuroscience |
| 5 | Brain, split-brain; consciousness & sleep (3,4) | 8,9 | Brain fly-through; sleep lab night | "Map the Brain" | Q05 | T09–10 | 1.1 | Bio | S2 Behavioral Neuroscience |
| 6 | Sensation, perception, psychophysics, SDT (5) | 10,11,12 | Ames room, staircase booth | "Find Your JND" | Q06 | T11–12 | 2.1,2.4 | Cog | S2 Experimental Psych (lab) |
| 7 | Attention | 13 | Plaza IB event; search cubicles | "Spot the Gorilla" | Q07 | T13–14 | 2.1 | Cog | S3 Cognitive |
| 8 | Learning (6) | 14 | Skinner-box lab, cumulative recorder | "Shape the Agent" | Q08 | T15–16 | 1.1 | Bio/Cog | S2 Experimental Psych |
| 9 | Memory (8) | 15,16 | Memory palace; eyewitness street | "Palace of Loci" | Q09 | T17–18 | 2.1,1.4 | Cog | S3 Cognitive |
| 10 | Thinking, language, intelligence (7) | 17,18 | 3D mental-rotation bench; Hanoi | "Rotate & Reason" | Q10 | T19–20 | 2.1 | Cog/IndDiff | S3 Cognitive |
| 11 | Lifespan development (9) | 19 | One-way-mirror suite | "Code the Strange Situation" | Q11 | T21–22 | 1.2 | Dev | S4 Developmental |
| 12 | Motivation, emotion, stress & health (10,14) | 20,21 | FACS face lab; HPA sim | "Read the Face" | Q12 | T23–24 | 1.1,3.3 | Bio/Social | S6 Positive; Health elective |
| 13 | Personality & testing (11) | 22,23 | Test-construction studio | "Build a Reliable Scale" | Q13 | T25–26 | 2.4,1.2 | IndDiff | S2 Personality; S4 Psych Testing |
| 14 | Social & I-O (12,13) | 24,25 | Mohalla crowd sim; Asch room | "The Silent Crowd" | Q14 | T27–28 | 1.1,3.2 | Social | S3 Social; S3 I-O |
| 15 | Disorders, therapy, counselling, culture (15,16) | 26–29 | Clinic sessions | "First Session" | Q15 | T29–30 | 4.1,3.2 | IndDiff/Applied | S4 Psychopathology; S5 Clinical; S6 Counseling; S5 Cross-Cultural |
| 16 | Inferential stats, replication, open science, capstone | 6,30,33,37,38 | Poster hall defence | "Replicate or Retract" | Q16 | T31–32 | 2.2,4.2,5.2 | Methods | S5 Data Analysis; S8 Emerging Tech; Capstone |

#### §6.2 Whole-degree module map (HEC 2025 model scheme → ZEHN zones)

| Semester | HEC major courses | ZEHN coverage |
|---|---|---|
| 1 | Introduction to Psychology; Schools & Perspectives | Wundt Hall, all intro panels |
| 2 | Behavioral Neuroscience; Experimental Psychology (2-1); Theories of Personality | Neuro Atrium, Experimental Wing, Personality panel |
| 3 | Social; Cognitive; I-O; Ethics in Psychology | Mohalla, attention/memory/cognition labs, IRB |
| 4 | Psychological Testing; Developmental; Psychopathology; Environmental | Psychometrics studio, Child Suite, Clinic (simulated), campus-environment demos (crowding, noise, green space — A1 to source) |
| 5 | Cross-Cultural; Psychology of Gender; Sports; Clinical (2-1); Data Analysis | Cross-cultural panel, Yerkes–Dodson/sports arousal demo (illustrative), Clinic, Workbench |
| 6 | Positive; Counseling (2-1); Academic Writing & Research Methods | Positive panel, OARS/CBT sessions, APA Report Generator |
| 7 | Forensic; electives | Eyewitness Room, lineup fairness, interrogation-ethics dilemmas |
| 8 | Psychology & Emerging Technologies; electives; Capstone | AI-in-Psychology panel, capstone research programme |

Specialisation streams (Clinical, Cognitive Neuroscience, Developmental, Educational, Forensic, Health, I-O) each get a 4-mission "elective track" unlocked after week 16.

### §7 AI Lab Mentor "RAAHI" (راہی, "fellow traveller")

**Persona:** a friendly senior lab mentor. Always introduces itself as **an AI tutor, not a psychologist or therapist**. Bilingual-ready (English, with Urdu greeting phrases).

**Offline engine (always on):**
- ≥130 intent patterns covering concepts, navigation, stats help, design critique, ethics, safety and crisis.
- ≥420-term glossary.
- Ranked advice cards `{severity, title, why, recommendation, impact, oneClickAction}`, e.g. "Your Stroop design is not counterbalanced → one-click: add Latin square."

**Optional live LLM:**
- The user pastes their own Anthropic API key. It is stored in **sessionStorage only**, with a privacy notice.
- Browser call to `https://api.anthropic.com/v1/messages` with header `anthropic-dangerous-direct-browser-access: true`.
- Model is configurable: default `claude-sonnet-5-5`, options `claude-opus-5-5` and `claude-haiku-5-5`. A1 confirms the IDs.
- Streaming responses.
- **Grounding snapshot:** current panel, dataset summary and facts.json subset, with the instruction "only use numbers from the snapshot; say 'not in my data' otherwise".
- **Safe tools:** `get_dataset`, `run_t_test`, `run_anova`, `compute_alpha`, `explain_concept`, `critique_design`, `check_ethics`, `draft_apa_results`, `roleplay_simulated_client`.
- **Human-in-the-loop:** any state change (e.g., applying a design fix) shows Approve/Reject.
- **Automatic offline fallback,** with an amber status light.

**Hard safety rails:**
1. Never acts as a therapist for the real user. Never diagnoses the user.
2. `roleplay_simulated_client` only plays fictional clients from clients.json, inside the Clinic, with a visible "Simulation" banner.
3. **Crisis detector** (offline regex + LLM classification when online) for self-harm, suicide or abuse disclosures in *any* text box. It stops the conversation flow, shows the crisis card (F-H1–F-H6), and offers to pause the game.
4. Refuses to reproduce copyrighted test items or DSM criteria text.

**Voice:** `speechSynthesis` for narration (drives lip-sync visemes); `webkitSpeechRecognition` optional, with a text fallback.

### §8 UI/UX direction

- **Identity:** "Indus Dusk" palette:
  - deep indigo `#1E1B4B` (base)
  - ajrak crimson `#9F1239` (accent)
  - Indus teal `#0F766E` (data)
  - saffron `#F59E0B` (highlight)
  - chalk `#F8FAFC` (text)

  Glassmorphism panels with ≥4.5:1 text contrast. System fonts only.
- **Boot screen:** a procedural neuron network that fires along the real loading progress (step text: "Growing dendrites… compiling shaders… seeding participants…"). Footer: "Simulated institution • data stays on this device". Reduced-motion fallback.
- **Onboarding (60 s):**
  - role: Student / Instructor
  - difficulty
  - seed
  - accessibility quick-set (reduced motion, dyslexia-friendly spacing + font fallback, colour-blind-safe palette, captions, photosensitive-safe mode)
  - content-warning preferences
- **HUD:** zone, mode, week, APA tag, XP, timer, RAAHI status light.
- **Charts:** hand-written SVG/canvas (histogram, boxplot, scatter + regression line, ROC, cumulative record, serial-position curve, hypnogram, forest plot for replications). Okabe–Ito colour-blind-safe palette.
- **Responsive:** includes a projector **Conference mode** (large type, high contrast).
- **Input:** full keyboard map, visible focus rings, ARIA roles/labels, captions for all audio.
- **Language:** Urdu label toggle (stretch: Urdu glossary for the top 100 terms, RTL-safe layout).

### §9 Engineering and build

- **Source tree:** `src/{engine, world, people, psych, exp, clinic, ai, game, audio, ui, data, styles}`, `main.js`.
- **Build:** `build/bundle.mjs` concatenates modules with `/* ===== src/... ===== */` banners and inlines three.js + CSS + JSON.
- **Scripts:**
  - `npm run build`
  - `npm test` (node, no browser: psych, exp/core, game logic, schemas, facts.json validator, licence linter that greps for banned instrument names in item text)
  - `npm run e2e` (Playwright, Chromium preinstalled)
- **Code rules:** ES2020, `'use strict'`. Dispose all GPU resources on zone change. Web Workers for agent studies and Monte-Carlo power simulations.
- **Size:** ≤9 MB output.

**Experiment runner (A8), modelled on jsPsych conventions:**
- **Timeline:** trials → blocks → randomisation (seeded), counterbalancing (Latin square), practice blocks, attention checks.
- **Timing:**
  - Stimulus onset is aligned to `requestAnimationFrame`.
  - Timestamps come from `performance.now()`.
  - Responses are taken from `keydown` `event.timeStamp`.
  - Each trial logs requested vs. actual onset and frame count.
- **Data:** one row per trial `{pid, session, paradigm, block, trial, condition, stimulus, onset_req, onset_actual, rt_ms, response, correct, seed, ua_hash}`. Export CSV/JSON + codebook. Anonymised IDs only.

### §10 The loop

**READ PROGRESS → PLAN → BUILD → VERIFY → CRITIQUE → FIX → UPDATE PROGRESS**

VERIFY = `npm test && npm run build && npm run e2e`. The e2e run must:
1. Load over `file://` with 0 console errors.
2. Visit every mode and zone.
3. Open every panel and press every button.
4. **Run all ≥36 paradigms headlessly with a scripted "bot participant"** (seeded RTs, ex-Gaussian), then validate each exported CSV against its schema (row counts, no NaN, condition balance).
5. Run a 10-minute agent-study soak.
6. Trigger every dilemma and IRB case.
7. Complete one full clinic session and the crisis-detector path (test phrase → crisis card shown).
8. Save, load and export.
9. Take screenshots per mode, day/night, at deviceScaleFactor 1.
10. Log FPS per tier.
11. Measure stimulus-onset jitter over 500 trials.

**Order of work:**
1. Inventory/parity docs
2. Architecture + data schemas + facts.json
3. psych engine + tests
4. experiment runner + timing harness
5. campus shell
6. characters/faces
7. panels
8. paradigms (in week order)
9. clinic
10. social sim
11. AI mentor
12. gamification/tour
13. audio
14. post-FX parity
15. accessibility pass
16. docs

### §11 Final deliverables

- `dist/ZEHN_Psychology_Lab_Simulator.html`
- `docs/PRESENTER_GUIDE.md` — 7-minute and 15-minute demo scripts
- `docs/INSTRUCTOR_GUIDE.md` — how to map to a syllabus, edit case cards, set seeds, run class data collection ethically
- `docs/LAB_WORKSHEETS/` — 16 printable worksheets with hypotheses, procedure, data table, analysis questions, APA write-up prompt
- `docs/COURSE_MAPPING.md`
- `docs/BENCHMARK_PARITY.md`
- `docs/FACTS_AND_SOURCES.md`
- `docs/LICENSES.md`
- `docs/ETHICS_SAFETY.md`
- `docs/TEST_REPORT.md` — screenshots, FPS table, timing-jitter histogram
- `README.md`
- A final **honest summary**: what passed, what is "must-verify", and known limits (e.g., browser RT lag).

### §12 Acceptance gates

| Gate | Pass condition |
|---|---|
| G1 Benchmark parity | Every BENCHMARK_INVENTORY item matched or beaten, with evidence |
| G2 Course coverage | 16/16 weeks fully mapped; every screen shows APA + domain + HEC tags |
| G3 Minimums | Auto-count script meets every §5.4 number |
| G4 Formula correctness | All §5.3 tests pass; p-values within 1e-4 of R/SciPy goldens |
| G5 Facts | Every UI claim resolves to facts.json; 0 unverified facts shown without badge |
| G6 Stability | 0 console errors; 10-min soak with heap growth <10% |
| G7 Performance | ≥60 fps High (discrete, 1080p); ≥30 fps Medium (integrated) |
| G8 Offline | Works from `file://` with network disabled (except opt-in LLM) |
| G9 Persistence & export | Save/load round-trip; CSV/JSON/PNG/print exports validate |
| G10 UX polish | No dead controls; WCAG AA contrast; keyboard-complete; reduced motion honoured |
| G11 Visual quality | Faces show ≥14 AUs; screenshots reviewed per mode/time of day; post-FX parity |
| G12 Docs | All §11 deliverables present and accurate |
| **G13 Timing accuracy** | Over 500 bot trials per tier: median onset error ≤ 1 frame, 95th percentile ≤ 2 frames; RT logging resolution ≤ 1 ms; results and jitter histogram reported in TEST_REPORT. UI states that browser RTs include a fixed lag (Bridges et al. 2020) |
| **G14 Ethics & safety** | Consent before every RT task; debrief after every deception demo; content warnings + opt-out paths; crisis detector passes 30 test phrases with 0 false negatives; no player diagnosis anywhere; licence linter passes (0 banned instrument content); helplines marked verified-on date |

**END PROMPT**

## Sources

1. [A New Roadmap to Facilitate Career Success for Your Students: APA Guidelines for the Undergraduate](https://www.psichi.org/page/301EyeFall25Bui)
2. [Learning Outcomes](https://www.plu.edu/psychology/home/learning-outcomes/)
3. [APA Guidelines for the Undergraduate Psychology Major: Version 3.0](https://www.apa.org/ed/precollege/undergrad/guidelines-psychology-major.pdf)
4. <https://www.hec.gov.pk/english/services/universities/RevisedCurricula/Documents/2024-2025/Psychology.pdf>
5. [A Delphi Study to Strengthen Research-Methods Training in Undergraduate Psychology Programs - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC7617501/)
6. [Psychology : 2e](https://hdl.loc.gov/loc.gdc/gdcebookspublic.2021387747)
7. [Introductory Psychology 2e (OpenStax)](<https://socialsci.libretexts.org/Bookshelves/Psychology/Introductory_Psychology/Introductory_Psychology_2e_(OpenStax)>)
8. PubMed
9. [A multilab preregistered replication of the ego-depletion effect - Utrecht University](https://research-portal.uu.nl/en/publications/a-multilab-preregistered-replication-of-the-ego-depletion-effect/)
10. [Debunking the Stanford Prison Experiment : American Psychologist](https://www.ovid.com/journals/ampsy/abstract/10.1037/amp0000401~debunking-the-stanford-prison-experiment?redirectionsource=fulltextview)
11. [Debunking the Stanford Prison Experiment - PubMed](https://pubmed.ncbi.nlm.nih.gov/31380664/)
12. [Milgram Experiment: Aim, Method, Results, Ethics, Variations](https://www.structural-learning.com/post/stanley-milgram-experiment)
13. [Forensic psychology: Week 3: 1.1](https://www.open.edu/openlearn/mod/oucontent/view.php?id=68094&section=1.1)
14. [sustained inattentional blindness for dynamic events](<http://wexler.free.fr/library/files/simons%20(1999)%20gorillas%20in%20our%20midst.%20sustained%20inattentional%20blindness%20for%20dynamic%20events.pdf>)
15. [Loftus. Reconstruction of Automobile Destruction](http://www.garysturt.free-online.co.uk/loftus.htm)
16. [Suggestibility: How a Single Word Can Reshape a Memory](https://psychology.com/biases/suggestibility)
17. [The bystander effect: why crowds freeze, and when they actually help · Psychology World](https://apa.nefarius.co/blog/bystander-effect)
18. [Festinger & Carlsmith Cognitive dissonance consequences of forced compliance](https://www.age-of-the-sage.org/psychology/social/festinger_carlsmith_cognitive_dissonance.html)
19. [Nelson Cowan, The magical number 4 in short-term memory: A reconsideration of mental storage capacity - PhilPapers](https://philpapers.org/rec/COWTMN)
20. [The magical number 4 in short-term memory: A reconsideration of mental storage capacity](https://www.mendeley.com/catalogue/c50bc807-00ae-37ca-a8e8-55104ff7c648/)
21. [PeerJ The timing mega-study: comparing a range of experiment generators, both lab-based and online](https://peerj.com/articles/9414/)
22. [A Computational Framework for Interpretable Text-Based Personality Assessment from Social Media](https://arxiv.org/pdf/2510.02811)
23. [IPIP: International Personality Item Pool Guide — CASRAI](https://casrai.org/guides/ipip)
24. [PATIENT HEALTH QUESTIONNAIRE-9 (PHQ-9)](https://ilpqc.org/wp-content/uploads/2025/05/L8.-PHQ-9-and-GAD-7-screening-tools.pdf)
25. [Pakistan: emergency numbers and crisis hotlines](https://worldhotlines.org/country/pk)
26. [Mental health and psychosocial support platform - suicide](https://www.emro.who.int/mhps/suicide.html)
27. [Umang (@PakistanUmang) / X](https://x.com/pakistanumang)
28. [Index of /](https://www.umang.com.pk/)
29. [Find Help](https://taskeen.org/website_fd0b73f2/seek-help/)
30. [Rozan Counselling Helpline - Rozan](https://rozan.org/rozan-counselling-helpline/)
31. [Helpline Numbers: All Emergency Contacts in One Place - Islamabad Business Directory](https://islamabad.org.pk/helpline-numbers-pakistan-emergency-contacts/)
32. [Helplines](https://okara.punjab.gov.pk/helplines)
33. [ainsworth Flashcards and Study Sets](https://quizlet.com/subject/ainsworth/)
34. [Mary Ainsworth Strange Situation Experiment](https://www.simplypsychology.org/mary-ainsworth.html)
35. [Milgram Experiment: Why 65% Obeyed to the End (2026)](https://yukaichou.com/behavioral-analysis/milgram-obedience-experiment-authority-compliance/)
36. [Asch conformity experiments](https://en.wikipedia.org/wiki/Asch_conformity_experiments)
37. [Two Key Studies of Bystanderism](https://www.savemyexams.com/dp/psychology/ib/17/hl/revision-notes/human-relationships/social-responsibility-bystanderism-and-prosocial-behaviour/two-key-studies-of-bystanderism/)
38. [Who were Latane and Darley? AP® Psychology Bystander Effect Review](https://www.albert.io/blog/latane-and-darley-ap-psychology-bystander-effect-review/)
39. [Assessing effect sizes, variability, and power in the on-line study of language production](https://arxiv.org/pdf/2403.15459)
40. [The International Personality Item Pool](https://link.springer.com/rwe/10.1007/978-3-319-28099-8_1230-1)
41. [Patient Health Questionnaire (PHQ) Screeners. Free Download](https://www.phqscreeners.com/select-screener)
42. [Appendix A](https://explore.bps.org.uk/content/report-guideline/bpsrep.2024.rep176/back-matter/bpsrep.2024.rep176.9)
43. [A multilab preregistered replication of the ego- depletion effect](https://www.diva-portal.org/smash/get/diva2:1293233/FULLTEXT01.pdf)
44. [Milgram Experiment: Procedure, Results & Legacy](https://ipsychology.net/milgram-experiment/)
45. [Milgram Obedience Experiments: What The Yale Archives Actually Show](https://atticusli.com/replication-crisis/milgram-obedience/)
46. [Psychology Study Guide: Social Psychology Concepts & Experiments](https://www.pearson.com/channels/psychology/study-guides/social-psychology-conformity-obedience-attribution-and-bystander)
47. [sustained inattentional blindness for dynamic events](https://labs.wsu.edu/attention-perception-performance/documents/2016/05/simons_chabris_99.pdf/)
48. [Loftus and Palmer (1974). Reconstruction of automobile destruction:](https://resource.download.wjec.co.uk/vtc/2020-21/el20-21_25-4a/wjec/loftus_and_palmer.pdf)
49. [Loftus and Palmer (1974) - Eyewitness Testimony - Psychology A Level](https://psychologyalevel.com/loftus-and-palmer-1974-eyewitness-testimony/)
50. [Cognitive Dissonance: A Robust Theory That Got Oversold Into A Theory Of Everything](https://atticusli.com/replication-crisis/cognitive-dissonance/)
51. [The Experiment Where One Dollar Beat Twenty — Cognitive Dissonance and Sixty Years of Rebuttal — TT Lab Blog](https://ttlab.hopto.org/blog/psych-papers/cognitive-dissonance-festinger?lang=en)
52. [Ainsworth’s ‘Strange Situation’](https://www.tutor2u.net/psychology/reference/ainsworths-strange-situation)
53. [CONTACT US](https://www.umang.com.pk/contact-us/)
54. [A call to action: Combating suicide stigma, promoting mental health in Pakistan](https://tribune.com.pk/story/2501993/a-call-to-action-combating-suicide-stigma-promoting-mental-health-in-pakistan)
55. [COVID-19 - Rozan](https://rozan.org/covid-19/)
56. [Pakistan helplines and hotlines](https://findahelpline.com/countries/pk)
57. [Important Helplines](https://pcsw.punjab.gov.pk/important_helplines)
58. [The Sehat Tahaffuz Helpline - 1166](https://www.epi.gov.pk/wp-content/uploads/2025/01/1166-ProjectBrief.pdf)
59. [Suicide Hotlines and Crisis Lines in Pakistan](https://www.therapyroute.com/article/suicide-hotlines-and-crisis-lines-in-pakistan-by-therapyroute)
