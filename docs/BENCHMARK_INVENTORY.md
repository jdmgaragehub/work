# Benchmark Inventory (Step 0)

Command: `grep -n "/\* ===== src/" reference/Hyderabad_Airport_PM_Simulator.html` → 97 module banners. three.js r160 occupies lines 2605–55675.

| # | Banner path | Lines | Purpose | ZEHN module that matches or beats it |
|---|---|---|---|---|
| 1 | `src/core/bus.js` | 55676–55727 | event bus | src/core/bus.js |
| 2 | `src/core/settings.js` | 55728–55820 | settings store | src/core/sim.js + src/core/store.js |
| 3 | `src/engine/postfx.js` | 55821–56968 | hand-written post-FX chain | src/engine/postfx.js (+SSR, volumetric, SSS) |
| 4 | `src/engine/quality.js` | 56969–57279 | quality tiers | src/engine/quality.js (+face budgets) |
| 5 | `src/engine/noise.js` | 57280–57407 | procedural noise | src/engine/textures.js |
| 6 | `src/engine/textures.js` | 57408–58392 | procedural textures | src/engine/textures.js |
| 7 | `src/engine/materials.js` | 58393–58959 | material library | src/engine/materials.js |
| 8 | `src/engine/renderer.js` | 58960–59230 | WebGL renderer + loop | src/engine/renderer.js (+experiment mode) |
| 9 | `src/engine/input.js` | 59231–59530 | input | src/engine/input.js |
| 10 | `src/engine/controls.js` | 59531–60029 | camera modes | src/engine/controls.js (9 camera modes) |
| 11 | `src/engine/audio.js` | 60030–61008 | procedural WebAudio | src/audio/audio.js (+dichotic, binaural) |
| 12 | `src/world/collision.js` | 61009–61266 | AABB collisions | src/world/campus.js colliders |
| 13 | `src/world/layout.js` | 61267–61445 | site layout | src/world/layout.js |
| 14 | `src/engine/sky.js` | 61446–62578 | sky + sun | src/engine/sky.js |
| 15 | `src/engine/weather.js` | 62579–63062 | weather | src/engine/sky.js (day/dusk/night moods) |
| 16 | `src/world/props.js` | 63063–64341 | props | src/world/campus.js + zones |
| 17 | `src/world/terrain.js` | 64342–64963 | terrain | src/world/campus.js |
| 18 | `src/world/airfield.js` | 64964–66067 | airfield | src/world/zones/explab.js (illusion rooms) |
| 19 | `src/world/terminal.js` | 66068–67065 | terminal building | src/world/zones/wundt.js, library.js |
| 20 | `src/world/tower.js` | 67066–67367 | control tower | src/world/zones/neuro.js (walk-through brain) |
| 21 | `src/world/landside.js` | 67368–67882 | landside | src/world/zones/mohalla.js |
| 22 | `src/world/city.js` | 67883–68216 | city backdrop | src/world/campus.js perimeter |
| 23 | `src/world/construction.js` | 68217–68621 | construction site | src/world/zones/learning.js, childdev.js |
| 24 | `src/world/aircraft.js` | 68622–69948 | aircraft | src/world/zones/sleep.js, clinic.js |
| 25 | `src/world/vehicles.js` | 69949–70887 | vehicles | src/world/zones/mohalla.js props |
| 26 | `src/world/traffic.js` | 70888–72006 | traffic sim | src/people/social.js + src/psych/socialmodels.js |
| 27 | `src/world/workers.js` | 72007–72359 | worker crowds | src/people/humanoid.js (FACS faces) |
| 28 | `src/world/passengers.js` | 72360–72817 | passenger crowds | src/people/crowd.js |
| 29 | `src/world/world.js` | 72818–73486 | world assembly | src/world/campus.js |
| 30 | `src/pm/model.js` | 73487–74397 | PM engine | src/psych/stats.js |
| 31 | `src/pm/cpm.js` | 74398–74767 | PM engine | src/psych/dist.js |
| 32 | `src/pm/evm.js` | 74768–74868 | PM engine | src/psych/psychometrics.js |
| 33 | `src/pm/risk.js` | 74869–74951 | PM engine | src/psych/sdt.js |
| 34 | `src/pm/quality.js` | 74952–75058 | PM engine | src/psych/psychophysics.js |
| 35 | `src/pm/comms.js` | 75059–75106 | PM engine | src/psych/learning.js |
| 36 | `src/pm/procurement.js` | 75107–75202 | PM engine | src/psych/neuron.js |
| 37 | `src/pm/change.js` | 75203–75259 | PM engine | src/psych/participants.js |
| 38 | `src/pm/agile.js` | 75260–75326 | PM engine | src/exp/core/timeline.js |
| 39 | `src/pm/montecarlo.js` | 75327–75732 | PM engine | src/exp/core/timing.js + panels/practice_b.js p-hacking sim |
| 40 | `src/pm/project.js` | 75733–77963 | PM engine | src/exp/runner.js + src/exp/registry.js (38 paradigms) |
| 41 | `src/pm/export.js` | 77964–78357 | PM engine | src/exp/core/timeline.js toCSV/codebook + panels/system.js export |
| 42 | `src/game/decisions.js` | 78358–79114 | decision events | src/data/dilemmas.json + irb.json + src/game/director.js |
| 43 | `src/game/missions.js` | 79115–79563 | missions | src/game/missions.js + missions.json |
| 44 | `src/game/scoring.js` | 79564–79817 | scoring | src/game/scoring.js + logic.js |
| 45 | `src/game/director.js` | 79818–80316 | GameDirector | src/game/director.js |
| 46 | `src/core/format.js` | 80317–80364 | formatting | src/core/format.js (APA-7) |
| 47 | `src/ai/rules.js` | 80365–81347 | AI rules | src/ai/engine.js (advice cards) |
| 48 | `src/data/glossary.json` | 81348–85108 | glossary | src/data/glossary.json |
| 49 | `src/ai/glossary.js` | 85109–85234 | glossary lookup | src/ai/engine.js |
| 50 | `src/data/facts.json` | 85235–85622 | facts | src/data/facts.json |
| 51 | `src/core/facts.js` | 85623–85659 | fact access | src/core/facts.js |
| 52 | `src/ai/intents.js` | 85660–86715 | intents | src/data/intents.json + src/ai/engine.js |
| 53 | `src/ai/llm.js` | 86716–87082 | LLM client | src/ai/llm.js |
| 54 | `src/ai/voice.js` | 87083–87237 | voice | src/ai/voice.js |
| 55 | `src/ai/mehran.js` | 87238–87569 | AI mentor persona | src/ai/mentor.js (RAAHI) + src/ai/crisis.js |
| 56 | `src/ui/dom.js` | 87570–88262 | DOM helpers | src/ui/dom.js |
| 57 | `src/ui/charts.js` | 88263–89371 | charts | src/ui/charts.js |
| 58 | `src/data/course.json` | 89372–89789 | course data | src/data/course.json |
| 59 | `src/ui/panels/course.js` | 89790–90008 | dashboard panel | src/ui/panels/course.js |
| 60 | `src/ui/charts2.js` | 90009–90357 | charts | src/ui/charts.js |
| 61 | `src/ui/panels/foundations.js` | 90358–90715 | dashboard panel | src/ui/panels/* (39 panels) |
| 62 | `src/ui/panels/lifecycle.js` | 90716–90934 | dashboard panel | src/ui/panels/* (39 panels) |
| 63 | `src/ui/panels/charter.js` | 90935–91232 | dashboard panel | src/ui/panels/* (39 panels) |
| 64 | `src/ui/panels/approach.js` | 91233–91484 | dashboard panel | src/ui/panels/* (39 panels) |
| 65 | `src/ui/panels/scope.js` | 91485–91740 | dashboard panel | src/ui/panels/* (39 panels) |
| 66 | `src/ui/panels/schedule.js` | 91741–92226 | dashboard panel | src/ui/panels/* (39 panels) |
| 67 | `src/ui/panels/cost.js` | 92227–92570 | dashboard panel | src/ui/panels/* (39 panels) |
| 68 | `src/ui/panels/quality.js` | 92571–92866 | dashboard panel | src/ui/panels/* (39 panels) |
| 69 | `src/ui/panels/risk.js` | 92867–93244 | dashboard panel | src/ui/panels/* (39 panels) |
| 70 | `src/ui/charts3.js` | 93245–93680 | charts | src/ui/charts.js |
| 71 | `src/ui/panels/procurement.js` | 93681–94067 | dashboard panel | src/ui/panels/* (39 panels) |
| 72 | `src/ui/panels/team.js` | 94068–94445 | dashboard panel | src/ui/panels/* (39 panels) |
| 73 | `src/ui/panels/stakeholders.js` | 94446–94689 | dashboard panel | src/ui/panels/* (39 panels) |
| 74 | `src/ui/panels/msproject.js` | 94690–94943 | dashboard panel | src/ui/panels/* (39 panels) |
| 75 | `src/ui/panels/control.js` | 94944–95178 | dashboard panel | src/ui/panels/* (39 panels) |
| 76 | `src/ui/panels/forecast.js` | 95179–95383 | dashboard panel | src/ui/panels/* (39 panels) |
| 77 | `src/ui/panels/agile.js` | 95384–95631 | dashboard panel | src/ui/panels/* (39 panels) |
| 78 | `src/ui/panels/aipm.js` | 95632–95858 | dashboard panel | src/ui/panels/* (39 panels) |
| 79 | `src/ui/panels/operations.js` | 95859–96048 | dashboard panel | src/ui/panels/* (39 panels) |
| 80 | `src/ui/panels/missions.js` | 96049–96223 | dashboard panel | src/ui/panels/* (39 panels) |
| 81 | `src/ui/panels/closing.js` | 96224–96507 | dashboard panel | src/ui/panels/* (39 panels) |
| 82 | `src/data/cases.json` | 96508–96566 | cases | src/data/cases.json |
| 83 | `src/ui/panels/cases.js` | 96567–96690 | dashboard panel | src/ui/panels/* (39 panels) |
| 84 | `src/data/quiz.json` | 96691–98780 | quiz | src/data/quiz.json |
| 85 | `src/ui/panels/assess.js` | 98781–99139 | dashboard panel | src/ui/panels/* (39 panels) |
| 86 | `src/ui/panels/present.js` | 99140–99469 | dashboard panel | src/ui/panels/* (39 panels) |
| 87 | `src/ui/storage.js` | 99470–99572 | save/load | src/core/store.js |
| 88 | `src/ui/panels/session.js` | 99573–100041 | dashboard panel | src/ui/panels/* (39 panels) |
| 89 | `src/ui/panels.js` | 100042–100489 | panel host | src/ui/panelhost.js |
| 90 | `src/ui/hud.js` | 100490–101978 | HUD | src/ui/hud.js |
| 91 | `src/ui/tour.js` | 101979–102403 | guided tour | src/game/tour.js |
| 92 | `src/ui/touch.js` | 102404–102611 | touch controls | src/engine/controls.js touch |
| 93 | `src/ui/chat.js` | 102612–103282 | chat UI | src/ui/chat.js |
| 94 | `src/ui/onboarding.js` | 103283–103577 | onboarding | src/ui/onboarding.js |
| 95 | `src/game/journey.js` | 103578–103833 | passenger journey | src/game/journey.js (12-step) + clinic journey |
| 96 | `src/world/cabin.js` | 103834–105552 | aircraft cabin | src/clinic/session.js |
| 97 | `src/main.js` | 105553–106431 | boot | src/main.js |
