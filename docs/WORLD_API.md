# ZEHN World, Engine, People & Services API

All modules: CommonJS (`require`/`module.exports`), `'use strict'`, ES2020. THREE is `require('three')` (three.js r160,
inlined by the bundler; WebGL2). No network, no external assets: every texture/mesh/sound is procedural.
Coordinates: Y-up, metres. Layout: `src/world/layout.js` (zone centres, `entry(id)`, `zoneAt(x,z)`).
The shared `sim` object: docs/ARCHITECTURE.md §1 (`sim.bus`, `sim.state`, `sim.settings`, `sim.services`, `sim.rng`).
Benchmark to beat for visuals/engine: `reference/Hyderabad_Airport_PM_Simulator.html` (modules under `/* ===== src/engine/... ===== */`).

## A3 Engine — `src/engine/`
`renderer.js` → `class Engine`:
```
new Engine(sim, canvas)          // WebGLRenderer (antialias off when TAA), sRGB, ACES via post chain, shadows (PCF soft)
engine.scene, engine.camera (PerspectiveCamera fov 70), engine.renderer, engine.tier ('low'|'medium'|'high'|'ultra')
engine.addUpdate(fn(dt, t))      // per-frame callbacks (world, people, controls)
engine.start()                   // rAF loop; computes rolling frame time; emits 'quality:change'
engine.setExperimentMode(bool)   // pause rendering loop work + post chain to minimum (runner calls this)
engine.setQuality(tier)          // 'auto' or tier; persists in sim.settings.quality
engine.setToggle(name, bool)     // post-FX feature toggles in sim.settings.toggles
engine.setTimeOfDay('day'|'dusk'|'night')
engine.screenshot() → dataURL     // PNG of current frame
engine.stats → { fps, frameMs, drawCalls, triangles, tier }
engine.setEmotionGrade({valence, arousal}|null) // subtle colour grade for counselling scenes (off unless sim.settings.emotionGrade)
engine.setDOF({focus, aperture}|null)           // bokeh for tour/photo
```
`quality.js`: GPU string → tier (WEBGL_debug_renderer_info), `?quality=` override, rolling re-tier from frame time, never auto-promote to ultra, per-feature overrides, per-tier budgets incl. faces (`budget.faceAUs`: 16 ultra/high, 8 medium, 4 low; `budget.faceUpdateHz`).
`postfx.js`: hand-written chain (no EffectComposer) ≥ benchmark: HDR → TAA (Halton, reprojection, YCoCg clamp; ultra) → motion blur (high+) → half-res SSAO + blur → bright pass → 3-level bloom → god-rays → 1×1 info pass (autofocus, eye adaptation) → composite (ACES, auto-exposure, lens flare, grade, chromatic aberration, vignette, grain) → bokeh DOF (22/36/48 samples) ; plus SSR on polished floors (high+, material flag `userData.ssr`), volumetric shafts (Wundt Hall; `engine.volumetric` light list), SSS approximation for skin (wrap lighting + red-shifted scatter in the humanoid skin material). Each pass gated by tier AND `sim.settings.toggles[name]`.
`textures.js`: procedural CanvasTextures (brick, jaali screen alpha, ajrak block-print, terrazzo, wood, marble, grass, plaster, tiles, carpet, chalkboard, poster text) with normal/roughness maps; cached.
`materials.js`: material library `mats.get(name)` (brick, plaster, terrazzo (ssr), wood, glass, metal, fabric, grass, water, emissive screens…).
`sky.js`: procedural sky dome, sun/moon, hemisphere + directional light with shadows, day/dusk/night moods, stars.
`controls.js` → `class Controls(sim, engine)`: modes `walk` (pointer-lock FPS, WASD/arrows, Shift run, C crouch, collisions vs `world.colliders` AABBs, gravity on floors), `director` (orbit), `participant` (walk + launcher), `clinic`, `social`, `neuro` (6-DoF fly inside brain), `tour` (scripted camera beats), `photo` (free cam + DOF), `drone` (free fly above campus). API: `setMode(mode)`, `teleport({pos:[x,y,z], yaw})`, `flyTo(pos, target, sec)`, `update(dt)`, `lookTarget()` (raycast-free: nearest interactable in view cone within its radius). Emits `mode:change`. Touch support: virtual joystick + drag look.
`input.js`: keyboard state, `suspend(bool)` (runner/modals), keymap (1–7 modes, E use, Tab panels, T talk to RAAHI, M map, F1 help, P photo, N day/night).

## A2 World — `src/world/`
`campus.js` → `buildWorld(sim, engine)` returns:
```
world.zones[id] = { id, name, center: THREE.Vector3, yaw, anchors: { name: Vector3 } }
world.colliders: THREE.Box3[]                 // static AABBs for walking
world.interactables: [{ id, zone, pos: Vector3, radius, label, onUse() }]
world.teleport(zoneId)                        // uses layout.entry + controls.teleport; emits zone:enter
world.zoneAt(pos) → id ; world.update(dt, t) ; world.setTimeOfDay(t)
world.focusTargets: { [zone]: { pos, target } } // camera framings for tour beats ('aerial','front','inside','exhibit')
```
Zone builders `src/world/zones/<id>.js` → `module.exports = { id, build(kit) }` returning `{ update?(dt, t), dispose?() }`.
`kit = { THREE, sim, engine, group /* THREE.Group already positioned at the zone centre & rotated by yaw: build in LOCAL coords, entrance toward +Z */, mats, tex, rng, tier, addCollider(minVec3, maxVec3) /* local coords */, addInteractable({id, pos /* local */, radius, label, onUse}), anchor(name, localVec3), people: require('../people/humanoid.js'), crowd: require('../people/crowd.js'), label3d(text, opts) → Mesh (canvas text sprite/plane) }`.
Interactables typically call `sim.services.ui.openPanel(id)`, `sim.services.runner.run(paradigmId)`, `sim.services.clinic.startSession()`, `sim.services.director.presentIRB()`.

## A4 People — `src/people/`
`humanoid.js` → `createHumanoid(THREE, { lookIndex, height, outfit, tier, name }) → person`:
`person.group` (Object3D), `person.setAUs({1:0..1,...})`, `person.setEmotion(name, intensity)`, `person.setGaze(Vector3|null)`, `person.blink()` (auto blinks ~every 3–5 s), `person.setViseme('A'|'E'|'O'|'U'|'M'|'F'|'rest')`, `person.speak(text)` (drives visemes from text timing; uses speechSynthesis when available), `person.setPose('idle'|'walk'|'sit'|'talk'|'slump'|'wave'|'point'|'kneel')`, `person.posture` (0 upright .. 1 slumped), `person.update(dt, t, camera)`, `person.dispose()`.
Face = procedural head mesh with a CanvasTexture face drawn by `src/people/face2d.js` (≥14 AUs + gaze + blink + visemes), updated at tier-dependent Hz; skin material with SSS wrap term. Gait variety (stride, arm swing, speed per lookIndex).
`crowd.js` → `createCrowd(THREE, { count, bounds, paths?, seed, tier }) → crowd` (one InstancedMesh, vertex-shader animated walk/sit/idle, culturally appropriate clothing colours: shalwar kameez, ajrak shawls, dupattas, caps), `crowd.update(dt, t)`, `crowd.setBehaviour(fn(i, agent))`, `crowd.agents` (positions/velocities for social models), `crowd.dispose()`.
`social.js` → Mohalla social models for mode 5: `createSocialSim(sim, crowd, opts)` with conformity (Asch-style majority pull), bystander (diffusion of responsibility: help probability falls with N present — teaching model, parameters labelled "Simulated"), cooperation (iterated PD agents). Emits `study:run`.

## Services registry (`sim.services`, set in src/main.js)
`ui` (PanelHost + HUD: `openPanel(id)`, `closePanel()`, `showCrisis()`, `toast`, `modal`), `runner` (src/exp/runner.js), `engine`/`renderer` (Engine), `controls`, `input`, `world`, `audio` (A10), `ai` (A7), `clinic` (A12), `director`, `missions`, `scoring`, `tour`, `journey` (A9).
