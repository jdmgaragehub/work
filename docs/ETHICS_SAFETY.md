# ZEHN — Ethics and Safety Specification (owned by A1, who holds a veto)

This document is binding on every agent. Gate **G14** tests it. If a feature
conflicts with this document, the feature changes.

Last reviewed: 2026-11-14. Helpline table verified-on date: **2026-11-14** (see §5).

## 1. Principles

1. **Simulated clients only.** No module diagnoses, screens, scores against clinical cut-offs or labels the *player*.
2. **Informed participation.** Every task that records the player's own data starts with consent and ends with a debrief.
3. **Choice without penalty.** Every content warning offers an opt-out that leads to an equivalent text-and-quiz path. Opting out never blocks progress, XP, badges or the certificate.
4. **Local-only data.** Player data stays on the device.
5. **Honesty about evidence.** Numbers come from `facts.json` with their verification and replication badges (see `docs/FACTS_AND_SOURCES.md`).

## 2. Informed consent (before every RT-recording task)

Shown as a participant-style information sheet before any paradigm that records the player's responses or reaction times, and in step 3 of "A Participant's Journey". It must state:

- **Purpose:** what the task demonstrates, in one or two sentences.
- **Duration:** the estimated minutes, computed from the timeline.
- **What is recorded:** responses, reaction times, accuracy, stimulus timing; no name, no audio and no camera.
- **Right to withdraw:** "You can stop at any time with Esc or the Withdraw button, without penalty. Withdrawing deletes this session's data unless you choose to keep it."
- **Data location:** "Your data never leaves this device. It is stored in this browser only and is exported only if you choose to export it."
- **Deception notice** (deception paradigms only): "Some details of this task will be explained only at the end. You will be told everything afterwards and can delete your data then."
- **Timing caveat:** "Browser reaction times include a fixed delay and some jitter (Bridges et al., 2020; fact F-TIME). Results are for learning, not research."

Buttons: **I agree, start** / **Not now**. Consent is logged in `sim.state.consentLog` (paradigm, timestamp), stored locally, and visible and deletable in Settings. The bus emits `consent:given`.

## 3. Debriefing (after every deception-based demo)

| Demo | What was concealed | Debrief must explain |
|---|---|---|
| Asch-style conformity (`asch`) | The other "participants" are scripted agents giving planned wrong answers on critical trials | The deception, why it was needed (honest answers under real group pressure), that conforming is common and not a personal failing, and Asch's finding that most responses stayed independent (F-ASCH, shown with a badge) |
| Misinformation / eyewitness (`misinformation`) | A post-event question contained misleading information | Which detail was planted, how memory reconstruction works (F-LP), and eyewitness reforms (F-WELLS) |
| Inattentional blindness (`inattentional_blindness`) | An unexpected event was staged in the plaza while the player counted | That missing it is normal (F-IB) and what attention research shows |
| Milgram obedience (**text-only critique case**, `CS-MILGRAM`) | No deception of the player: ZEHN never simulates the shock procedure | The debrief panel covers how Milgram's participants were deceived and debriefed, and the ethics critiques (F-BAUMRIND, must-verify) |
| Change blindness, DRM false memory, Wason, framing, anchoring | Not deceptive, but the "trick" is revealed | A short explanation of the effect, using the player's own data |

Every debrief:
- explains the deception, its purpose and the safeguards that would apply in a real study (APA Ethics Code 8.07 and 8.08 are referenced by code only);
- offers **Delete my data from this task**, which deletes immediately and emits `debrief:shown` with `{deleted:true}`;
- cannot be skipped before it has been displayed. Skipping the debrief in the IRB or Director modes triggers the GameDirector **ethics penalty**.

## 4. Content warnings and opt-out paths

Warnings appear before any module, case card, clinic session or dilemma tagged with one of these topics (`contentWarning` arrays in data files):

`suicide`, `self-harm`, `abuse`, `trauma`, `violence`, `obedience/shock`, `prison simulation`, `deception`, `animal distress`, `graphic injury`, `child distress`, `medical emergency`, `mental illness`, `stigma`.

The warning screen offers three choices:
1. **Continue.**
2. **Use the text-and-quiz version.** This gives the same learning objectives, missions credit and quiz set, without the scene, audio or role-play.
3. **Skip for now.** The module is marked "deferred", not failed.

Preferences are set during onboarding (per topic) and can be changed any time in Settings. Default: warnings **on** for every topic.

Mapping of current case cards (`src/data/cases.json`):

| Case | Warnings |
|---|---|
| CS-MILGRAM | obedience/shock, deception, distress |
| CS-SPE | prison simulation, abuse, humiliation |
| CS-ALBERT | child distress, trauma |
| CS-GAGE | graphic injury |
| CS-HM | neurosurgery, illness |
| CS-GENOVESE | violence, murder |
| CS-BOBO | aggression |
| CS-HARLOW | animal distress, maternal separation |
| CS-ASCH, CS-DISSONANCE | deception |
| CS-SEIZURE | medical emergency, deception |
| CS-ROBBERS | deception, child participants |
| CS-PK-STIGMA | mental illness, stigma |

## 5. Crisis-resource card

**Always reachable** from the Settings rail (one click from any screen; keyboard shortcut shown in the HUD help). **Auto-shown** when the crisis detector fires (§8).

Card text (fixed; only the helpline table comes from `facts.json`):

> **If you are in danger or might act on thoughts of harming yourself, call emergency services now.**
> ZEHN is a learning game. It cannot help in an emergency and it does not read or send what you type anywhere.
> Talking to someone you trust (a friend, family member, teacher or university counsellor) can help.

| Service | Number | Notes (from facts.json) | Fact |
|---|---|---|---|
| Emergency: Police | 15 | Nationwide | F-H4 |
| Emergency: Rescue / ambulance | 1122 | Provincial service; coverage varies. 112 from mobile may not work reliably | F-H4 |
| Edhi ambulance | 115 | Private foundation, nationwide | F-H4 |
| Umang mental-health helpline | 0311-7786264 | Hours reported inconsistently (24/7 vs evenings vs weekdays). Not for active suicide attempts: use 115/1122 | F-H1 |
| Taskeen helpline | 0316-8275336 | Hours reported inconsistently (e.g., Mon–Sat 11 am–11 pm) | F-H2 |
| Rozan Counselling Helpline | 0304-111-1741 | Rozan's own pages show different schedules (10 am–8 pm daily vs weekdays 9–5) | F-H3 |
| Sehat Tahaffuz (federal health line) | 1166 | Referral line; ask whether the "Humraaz" mental-health option is available | F-H5 |
| Outside Pakistan | findahelpline.com | International directory linked by IASP; also Befrienders Worldwide | F-H6 |

Required footer on the card: **"Hours may vary — verify before calling. Numbers last checked 2026-11-14."**

Status: every helpline row is `must-verify`. The numbers were consistent across sources, but no line's hours could be confirmed on the organisation's own site. **Before each release**, A1 (or the instructor) must phone or check each organisation's website and update `facts.json`, including its `retrieved` date. The card shows that date automatically.

Card actions: **Pause the game** (stops audio and timers and dims the scene), **Return**. No action sends data anywhere.

## 6. Photosensitivity

- WCAG 2.x SC 2.3.1 (fact F-WCAG): no content may flash **more than three times in any one-second period** unless it is below the general and red flash thresholds.
- **ZEHN cap:** every flicker, flash, RSVP-mask or change-blindness alternation is limited to **≤3 Hz**. Saturated-red flashes are not allowed. Large-area luminance alternation is kept small. Attentional-blink RSVP streams change items without full-field luminance flashes: they keep a constant background and similar item luminance.
- A **photosensitivity warning** appears before any demo with flicker, motion aftereffect spirals or rapid alternation.
- **Photosafe mode** (onboarding and Settings) replaces each such demo with a **static alternative**: side-by-side change-blindness images, a still spiral with explanation, and a slowed RSVP with an explanation of the timing.
- `prefers-reduced-motion` turns photosafe mode and reduced motion on by default.
- QA (A11) asserts in e2e that no paradigm schedules more than 3 luminance reversals per second.

## 7. No player diagnosis

- The IPIP Big Five (`src/data/ipip.json`) is the **only** questionnaire the player answers. It is preceded by: **"For learning only, not a diagnosis. Personality scores describe tendencies, are not good or bad, and can change. Your answers stay on this device."** Results show percentile-style bars against **simulated class data**, never clinical labels.
- PHQ-9 and GAD-7 scores appear **only** for simulated clients in the Clinic, under a visible **"Simulation"** banner. No item text is shipped (`docs/LICENSES.md`).
- No module infers mood, risk, personality disorder, IQ or any condition from the player's RTs, accuracy, text or face. Facial-expression recognition uses procedural faces only and never uses the camera.
- Psychopathology content uses original paraphrase plus "See DSM-5-TR / ICD-11 for official criteria".

## 8. AI mentor (RAAHI) guardrails

1. RAAHI introduces itself as **"an AI tutor, not a psychologist or therapist."**
2. It never acts as a therapist for the real user, never diagnoses the user, and never gives treatment advice. Requests for personal help get the crisis card plus encouragement to contact a trusted person or a professional.
3. `roleplay_simulated_client` runs only inside the Clinic, only with clients from `clients.json`, and only under a visible "Simulation" banner.
4. **Crisis detector** (`src/ai/crisis.js`): an offline regex set (plus LLM classification when online) scans **every** free-text box for self-harm, suicide or abuse disclosures, in English and romanised Urdu. On a match it stops the conversation flow, shows the crisis card, offers to pause, and emits `crisis:detected`. G14 requires 30 test phrases with **0 false negatives**. False positives are acceptable.
5. It answers only with numbers from the grounding snapshot. Otherwise it says "not in my data".
6. It refuses to reproduce copyrighted test items or DSM/ICD criteria text.
7. Any state change it proposes needs the user to click **Approve**.

## 9. Data and privacy

- All player data (`sim.datasets`, consent log, settings, IPIP answers) stays in `localStorage` / IndexedDB on the device.
- **No network calls** except the optional LLM, which is off by default.
- Exports (CSV/JSON/PNG/print) happen only when the user clicks to export. IDs are anonymised (random pid; `ua_hash` is a one-way hash).
- Settings → **Delete all my data** wipes every ZEHN key, after a confirmation.
- Class data collection by instructors: students export their own files voluntarily. The Instructor Guide tells instructors to get local ethics approval and to never collect names with the data.

### LLM privacy

- The user pastes their own Anthropic API key. It is held in **`sessionStorage` only**: never `localStorage`, never exported, and cleared when the tab closes.
- Privacy notice before first use: "Turning this on sends your question, the current panel name, a summary of your dataset and selected facts to Anthropic's API using your key. Do not type personal or health information."
- The grounding snapshot excludes consent logs, IPIP answers and free-text journal fields.
- Model IDs (fact F-MODELS) are `must-verify`, so the model field stays user-editable.

## 10. Deception demos: full list

| Paradigm / case | Type | Consent notice | Debrief | Data deletion offered |
|---|---|---|---|---|
| `asch` | Confederate agents | Yes (deception notice) | Yes, mandatory | Yes |
| `misinformation` | Misleading post-event question | Yes (deception notice) | Yes, mandatory | Yes |
| `inattentional_blindness` | Unannounced event | Yes (deception notice) | Yes, mandatory | Yes |
| Milgram (`CS-MILGRAM`) | **Text-only critique case: no simulation** | n/a | Ethics panel on the card | n/a |
| Stanford Prison (`CS-SPE`) | Text-only critique case | n/a | n/a | n/a |

No other paradigm may use deception without A1 sign-off and an entry in this table.

## 11. IRB / dilemma content

IRB proposals and dilemmas reference the APA Ethics Code by **section number** and the Belmont principles by name. They do not quote copyrighted code text at length. Skipping a debrief, consent or data protection always carries `ethicsPenalty: true`.

## 12. A1 review checklist (every merge)

- [ ] Every number traces to a `factRef`; must-verify facts carry badges.
- [ ] New content tagged with `contentWarning` where needed; opt-out path exists.
- [ ] Consent before RT tasks; debrief after deception.
- [ ] No player diagnosis; screeners only on simulated clients.
- [ ] Flicker ≤3 Hz; static alternative present.
- [ ] No banned instrument content; licence linter green.
- [ ] Helpline card shows the verified-on date and "Hours may vary — verify before calling".
