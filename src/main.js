'use strict';
/**
 * ZEHN boot (A0). Builds the shared sim, the DOM shell, the 3D engine + campus, and every service,
 * reporting REAL progress to the boot screen. Any optional subsystem that fails degrades gracefully
 * (the dashboard, experiments and clinic still work without WebGL).
 */
const { createSim } = require('./core/sim.js');
const { h, toast, modal } = require('./ui/dom.js');

const steps = [];
function progress(p, text) {
  window.__bootProgress = p;
  const fill = document.getElementById('boot-fill'), st = document.getElementById('boot-step'), bar = document.getElementById('boot-bar');
  if (fill) fill.style.width = Math.round(p * 100) + '%';
  if (bar) bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  if (st && text) st.textContent = text;
  steps.push(text);
}
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

function tryService(sim, name, fn) {
  try { const s = fn(); sim.services[name] = s; return s; } catch (err) { console.warn('[ZEHN] service ' + name + ' unavailable:', err); sim.services[name] = null; return null; }
}

async function boot() {
  progress(0.04, 'Growing dendrites…');
  const sim = createSim();
  window.ZEHN = sim;
  await frame();

  progress(0.1, 'Registering paradigms…');
  require('./exp/registry.js').register(sim);

  // ---- DOM shell
  const app = document.getElementById('app');
  const canvas = h('canvas', { id: 'scene', 'aria-label': '3D campus view. Use the left rail for dashboard panels; all content is also reachable without the 3D view.', tabindex: '0' });
  app.appendChild(canvas);
  const { PanelHost } = require('./ui/panelhost.js');
  const { HUD } = require('./ui/hud.js');
  const { showCrisis } = require('./ui/crisis.js');
  const panels = new PanelHost(sim, app);
  const hud = new HUD(sim, app);
  sim.services.ui = {
    openPanel: (id) => panels.open(id), closePanel: () => panels.close(), toast, modal, hud, panels,
    showCrisis: (opts) => showCrisis(sim, opts),
    setLang: (lang) => { sim.settings.lang = lang; document.documentElement.lang = lang === 'ur' ? 'ur' : 'en'; hud.refresh(); if (panels.current) panels.open(panels.current); sim.saveSettings(); },
  };
  applySettings(sim);
  sim.bus.on('settings:changed', () => applySettings(sim));
  await frame();

  progress(0.18, 'Seeding participants…');
  const { Runner } = require('./exp/runner.js');
  sim.services.runner = new Runner(sim);

  progress(0.24, 'Tuning the audio lab…');
  tryService(sim, 'audio', () => new (require('./audio/audio.js').AudioEngine)(sim));
  await frame();

  // ---- 3D engine + world
  progress(0.3, 'Compiling shaders…');
  let engine = null;
  try {
    const { Engine } = require('./engine/renderer.js');
    engine = new Engine(sim, canvas);
    sim.services.engine = engine; sim.services.renderer = engine;
  } catch (err) {
    console.warn('[ZEHN] WebGL unavailable — running in dashboard mode.', err);
    canvas.replaceWith(h('div', { id: 'scene', style: { background: 'radial-gradient(circle at 50% 40%, #312c7a, #13112e)' } }));
    toast('3D view unavailable on this device — dashboard mode. All panels, experiments and the clinic still work.', 6000);
  }
  await frame();
  if (engine) {
    progress(0.38, 'Raising Wundt Hall…');
    tryService(sim, 'input', () => new (require('./engine/input.js').Input)(sim));
    tryService(sim, 'controls', () => new (require('./engine/controls.js').Controls)(sim, engine));
    await frame();
    progress(0.5, 'Sculpting the Neuro Atrium (marching cubes)…');
    const world = tryService(sim, 'world', () => require('./world/campus.js').buildWorld(sim, engine));
    if (world && sim.services.controls) sim.services.controls.setWorld(world);
    // Drive camera controls every frame (movement, mouse look, collisions), then drop unread key edges.
    if (sim.services.controls) engine.addUpdate((dt) => { sim.services.controls.update(dt); if (sim.services.input) sim.services.input.endFrame(); });
    await frame();
    progress(0.66, 'Dressing the Mohalla crowd…');
  }

  progress(0.72, 'Waking RAAHI, your AI tutor…');
  tryService(sim, 'ai', () => new (require('./ai/mentor.js').Mentor)(sim));
  tryService(sim, 'chat', () => new (require('./ui/chat.js').ChatUI)(sim, app));
  progress(0.78, 'Opening the clinic (simulated clients)…');
  tryService(sim, 'clinic', () => new (require('./clinic/session.js').Clinic)(sim));
  progress(0.84, 'Convening the Ethics Board…');
  tryService(sim, 'scoring', () => new (require('./game/scoring.js').Scoring)(sim));
  tryService(sim, 'missions', () => new (require('./game/missions.js').Missions)(sim));
  tryService(sim, 'director', () => new (require('./game/director.js').Director)(sim));
  tryService(sim, 'tour', () => new (require('./game/tour.js').Tour)(sim));
  tryService(sim, 'journey', () => new (require('./game/journey.js').Journey)(sim));
  if (sim.services.world && sim.services.world.crowd) tryService(sim, 'social', () => require('./people/social.js').createSocialSim(sim, sim.services.world.crowd));
  await frame();

  progress(0.92, 'Preparing a fresh lab notebook…');
  // Always start fresh: progress is restored ONLY when the player presses Load (no auto-load, no autosave).
  wireModes(sim, hud);
  wireKeys(sim, hud, panels);
  installTestHooks(sim, panels);

  if (engine) {
    // HUD: interaction prompt + minimap (throttled)
    let acc = 0;
    engine.addUpdate((dt) => {
      acc += dt; if (acc < 0.15) return; acc = 0;
      const c = sim.services.controls;
      const it = c && c.lookTarget ? c.lookTarget() : null;
      hud.setPrompt(it && sim.state.mode !== 'director' ? `Press E — ${it.label}` : null);
      if (!hud.mini.hidden) hud.drawMinimap(engine.camera.position, c ? c.yaw : 0);
    });
  }
  progress(1, 'Ready.');
  if (engine) engine.start();
  if (sim.services.world) sim.services.world.teleport(sim.state.zone || 'courtyard');
  const b = document.getElementById('boot');
  if (b) b.classList.add('done');
  sim.bus.emit('boot:done', { steps });
  if (!sim.params.get('e2e')) {
    await require('./ui/onboarding.js').onboarding(sim);
    toast('Welcome to IIBS (simulated). Click the 3D view to look with the mouse, walk with W A S D (Shift = run), E to use. 1–7 modes, T for RAAHI, Esc frees the cursor.', 7000);
  }
}

function applySettings(sim) {
  const s = sim.settings, cl = document.body.classList;
  cl.toggle('reduced-motion', !!s.reducedMotion); cl.toggle('dyslexia', !!s.dyslexia); cl.toggle('cbsafe', !!s.cbSafe); cl.toggle('conference', !!s.conference);
  document.documentElement.style.setProperty('--ui-scale', String(s.uiScale || 1));
}

/** Mode side effects (zones/launchers). Camera behaviour lives in Controls. */
function wireModes(sim, hud) {
  sim.bus.on('mode:change', ({ mode }) => {
    const w = sim.services.world;
    if (mode === 'participant') hud.launcher();
    if (mode === 'clinic') { if (w) w.teleport('clinic'); toast('Clinic mode — walk to the therapy room or press E at the desk to meet a simulated client.'); if (sim.services.clinic && !sim.params.get('e2e')) sim.services.clinic.startSession(); }
    if (mode === 'social') { if (w) w.teleport('mohalla'); sim.services.ui.openPanel('social'); }
    if (mode === 'neuro') { if (w) w.teleport('neuro'); sim.services.ui.openPanel('bio'); }
    if (mode === 'tour' && sim.services.tour && !sim.params.get('e2e')) sim.services.tour.start();
  });
}

function wireKeys(sim, hud, panels) {
  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (sim.services.runner && sim.services.runner.active) return;
    if (require('./ui/dom.js').anyModalOpen()) return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= '7') hud.setMode(require('./ui/hud.js').MODES[+k - 1][0]);
    else if (k === 't' && sim.services.chat) { e.preventDefault(); sim.services.chat.toggle(); }
    else if (k === 'j' && sim.services.journey) sim.services.journey.start('participant');
    else if (k === 'n') hud.toggleNight();
    else if (k === 'm') hud.mini.hidden = !hud.mini.hidden;
    else if (k === 'f1' || k === '?') { e.preventDefault(); hud.help(); }
    else if (k === 'escape' && panels.current) panels.close();
  });
}

/** Hooks used by e2e/run.mjs (also handy for instructors in the console). */
function installTestHooks(sim, panels) {
  window.__zehnTest = {
    sim,
    panels: () => require('./ui/panels/meta.js').PANELS.map((p) => p.id),
    openPanel: (id) => panels.open(id),
    closePanel: () => panels.close(),
    paradigms: () => Array.from(sim.registry.paradigms.keys()),
    run: (id, opts) => sim.services.runner.run(id, Object.assign({ bot: true }, opts || {})),
    timing: (n, id) => sim.services.runner.timingTest(n, id),
    teleport: (z) => sim.services.world && sim.services.world.teleport(z),
    setMode: (m) => sim.services.controls ? sim.services.controls.setMode(m) : sim.bus.emit('mode:change', { mode: m }),
    crisis: (text) => sim.services.ai ? sim.services.ai.ask(text, { source: 'e2e' }) : null,
    save: () => sim.store.save(sim.snapshot()),
    load: () => sim.restore(sim.store.load()),
    snapshot: () => sim.snapshot(),
    services: () => Object.fromEntries(Object.entries(sim.services).map(([k, v]) => [k, !!v])),
    engineStats: () => sim.services.engine && sim.services.engine.stats,
    setQuality: (t) => sim.services.engine && sim.services.engine.setQuality(t),
    setTime: (t) => { sim.state.timeOfDay = t; if (sim.services.engine) sim.services.engine.setTimeOfDay(t); if (sim.services.world && sim.services.world.setTimeOfDay) sim.services.world.setTimeOfDay(t); },
  };
}

boot().catch((err) => {
  console.error(err);
  const e = document.getElementById('boot-error');
  if (e) { e.hidden = false; e.textContent = 'ZEHN could not start: ' + (err && err.message) + '\nTry Chrome, Edge or Firefox with WebGL 2.'; }
});
