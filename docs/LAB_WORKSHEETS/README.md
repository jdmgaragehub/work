# ZEHN Lab Worksheets

Sixteen printable worksheets, one per week of the default course (see `docs/ARCHITECTURE.md` and the in-game Course Map). Each worksheet uses only ZEHN zone, mode, panel and paradigm IDs, and follows the same structure:

1. Title and tags (APA 3.0 outcome, domain, HEC course)
2. Learning outcomes
3. ZEHN tools: zone, mode, panels, paradigms, Statistics Workbench test
4. Hypothesis prompt
5. Step-by-step procedure in the game
6. Data table template
7. Analysis questions, including which Workbench statistic to run
8. APA-7 write-up prompt with a format example (simulated numbers, clearly labelled)
9. Ethics reflection question

## Index

| Week | Worksheet | APA | Domain | Panels | Paradigms | Workbench statistic | Mission |
|---|---|---|---|---|---|---|---|
| 1 | [Measuring the Mind: Donders' Subtraction Method](WEEK_01.md) | 1.3, 1.5 | CHI | `history`, `perspectives` | `hick_hyman` | Paired-samples *t* test (`t_paired`) | M01 "Curate the Museum" |
| 2 | [Design It, Defend It: Research Methods & the IRB](WEEK_02.md) | 2.2, 3.1 | Methods | `methods`, `irb`, `builder`, `stats` | `stroop` | Power analysis (`power`) | M02 "Pass the Board" |
| 3 | [Describe the Class: Descriptive Statistics & Correlation](WEEK_03.md) | 2.4 | Methods | `stats`, `export` | `go_nogo` | Pearson correlation (`corr`) | M03 "Describe the Class" |
| 4 | [Fire the Neuron: Threshold & Firing Rate](WEEK_04.md) | 1.1 | Bio | `bio` | n/a | Pearson correlation (`corr`) | M04 "Fire the Neuron" |
| 5 | [Map the Brain & the Sleeping Mind](WEEK_05.md) | 1.1 | Bio | `brain`, `sleep` | n/a | Paired-samples *t* test (`t_paired`) | M05 "Map the Brain" |
| 6 | [Find Your JND: Psychophysics & Signal Detection](WEEK_06.md) | 2.1, 2.4 | Cog | `sensation`, `sdt`, `illusions` | `jnd_staircase`, `sdt_yesno`, `muller_lyer` | Signal-detection indices (`sdt`) | M06 "Find Your JND" |
| 7 | [Spot the Gorilla: Attention & Interference](WEEK_07.md) | 2.1 | Cog | `attention` | `stroop`, `inattentional_blindness`, `visual_search` | Paired-samples *t* test (`t_paired`) | M07 "Spot the Gorilla" |
| 8 | [Shape the Agent: Conditioning & Schedules](WEEK_08.md) | 1.1 | Bio/Cog | `learning` | `classical_cond`, `operant_schedules`, `shaping` | One-way ANOVA (`anova`) | M08 "Shape the Agent" |
| 9 | [Palace of Loci: Memory & Eyewitness Testimony](WEEK_09.md) | 2.1, 1.4 | Cog | `memory`, `eyewitness` | `serial_position`, `memory_palace`, `misinformation` | One-way (repeated-measures) ANOVA (`anova`); paired *t* (`t_paired`) | M09 "Palace of Loci" |
| 10 | [Rotate & Reason: Mental Rotation & Problem Solving](WEEK_10.md) | 2.1 | Cog/IndDiff | `cognition`, `intelligence` | `mental_rotation`, `hanoi`, `wason` | Simple linear regression (`regression`) | M10 "Rotate & Reason" |
| 11 | [Code the Strange Situation: Observation & Inter-Rater Agreement](WEEK_11.md) | 1.2 | Dev | `development` | `conservation`, `false_belief` | Cohen's kappa (`kappa`) | M11 "Code the Strange Situation" |
| 12 | [Read the Face: Emotion Recognition & Stress](WEEK_12.md) | 1.1, 3.3 | Bio/Social | `emotion`, `health` | `face_recognition` | Paired-samples *t* test (`t_paired`) | M12 "Read the Face" |
| 13 | [Build a Reliable Scale: Personality & Psychometrics](WEEK_13.md) | 2.4, 1.2 | IndDiff | `personality`, `psychometrics`, `export` | `ipip_big5` | Cronbach's alpha (`alpha`) | M13 "Build a Reliable Scale" |
| 14 | [The Silent Crowd: Conformity & Cooperation](WEEK_14.md) | 1.1, 3.2 | Social | `social`, `io` | `asch`, `prisoners_dilemma` | Chi-square test of independence (`chi2`) | M14 "The Silent Crowd" |
| 15 | [First Session: Counselling Micro-Skills (Simulated Clients)](WEEK_15.md) | 4.1, 3.2 | IndDiff/Applied | `psychopathology`, `therapy`, `crosscultural`, `positive` | n/a | Cohen's kappa (`kappa`) | M15 "First Session" |
| 16 | [Replicate or Retract: Inferential Statistics & Open Science](WEEK_16.md) | 2.2, 4.2, 5.2 | Methods | `builder`, `replication`, `stats`, `report`, `aiethics`, `present` | `levels_processing` | Independent-samples *t* test (`t_ind`) | M16 "Replicate or Retract" |

## Notes for instructors

- Format examples show APA-7 layout only. Their numbers are invented and must not be cited as findings.
- Self-report tasks (e.g., IPIP Big Five, Week 13) are for learning only, not a diagnosis. Clinic work (Week 15) uses simulated clients only; ZEHN never screens or labels the player.
- Deception-based demonstrations (Weeks 7, 9 and 14) always end with a debrief and an option to delete data.
- Students who opt out of a content-warned module can complete the text-and-quiz path instead; the worksheet questions still apply.
- Worksheets print cleanly from any Markdown viewer or after conversion to PDF.
