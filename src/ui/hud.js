'use strict';
/**
 * HUD (A6): zone, mode, week, APA tag, XP/level, session timer, RAAHI status light; mode bar (1–7),
 * zone banner, minimap, footnote, captions, interaction prompt, help sheet, participant launcher.
 */
const { h, btn, modal, toast } = require('./dom.js');
const layout = require('../world/layout.js');

const MODES = [
  ['walk', '1', 'Researcher Walk'], ['director', '2', 'Director View'], ['participant', '3', 'Participant'],
  ['clinic', '4', 'Clinic'], ['social', '5', 'Social Sim'], ['neuro', '6', 'Neuro Explorer'], ['tour', '7', 'Tour / Photo / Drone'],
];

class HUD {
  constructor(sim, root) {
    this.sim = sim;
    this.t0 = Date.now();
    const chip = (cls) => h('span', { class: 'hud-chip ' + cls });
    this.c = { zone: chip('zone'), mode: chip('mode'), week: chip('week'), apa: chip('apa'), xp: chip('xp'), time: chip('time'), ai: chip('ai') };
    this.top = h('div', { class: 'hud-top', role: 'status', 'aria-label': 'Status' }, ...Object.values(this.c),
      h('button', { type: 'button', class: 'hud-chip', style: { cursor: 'pointer', border: '0' }, onclick: () => this.help(), 'aria-label': 'Help and keys' }, '❔ Help'),
      h('button', { type: 'button', class: 'hud-chip', style: { cursor: 'pointer', border: '0' }, onclick: () => sim.services.ui.showCrisis(), 'aria-label': 'Support and crisis resources' }, '🤝 Support'));
    this.bottom = h('div', { class: 'hud-bottom', role: 'toolbar', 'aria-label': 'Modes' },
      MODES.map(([id, key, label]) => h('button', { type: 'button', class: 'modebtn', 'data-mode': id, 'aria-pressed': 'false', onclick: () => this.setMode(id) }, h('kbd', null, key), label)),
      h('button', { type: 'button', class: 'modebtn', onclick: () => sim.services.chat && sim.services.chat.toggle(), 'aria-label': 'Open RAAHI AI tutor' }, h('kbd', null, 'T'), 'RAAHI'),
      h('button', { type: 'button', class: 'modebtn', onclick: () => sim.services.journey && sim.services.journey.start('participant') }, h('kbd', null, 'J'), "Participant's Journey"),
      h('button', { type: 'button', class: 'modebtn', onclick: () => this.toggleNight() }, h('kbd', null, 'N'), 'Day/Night'),
      h('button', { type: 'button', class: 'modebtn', onclick: () => this.save() }, '💾 Save'));
    this.banner = h('div', { class: 'zone-banner', 'aria-live': 'polite', style: { opacity: 0 } });
    this.prompt = h('div', { class: 'prompt3d', hidden: true });
    this.cross = h('div', { class: 'crosshair', 'aria-hidden': 'true' });
    this.mini = h('canvas', { class: 'minimap', width: 336, height: 336, 'aria-label': 'Campus minimap', role: 'img' });
    this.foot = h('div', { class: 'footnote' }, 'Simulated institution • data stays on this device • for learning, not diagnosis');
    this.caption = h('div', { class: 'exp-caption', hidden: true, style: { top: 'auto', bottom: '110px', position: 'absolute', zIndex: 40 }, 'aria-live': 'polite' });
    root.append(this.top, this.bottom, this.banner, this.prompt, this.cross, this.mini, this.foot, this.caption);
    sim.bus.on('zone:enter', ({ zone }) => { sim.state.zone = zone; this.showBanner(zone); this.refresh(); });
    sim.bus.on('mode:change', ({ mode }) => { sim.state.mode = mode; this.refresh(); });
    sim.bus.on('week:set', () => this.refresh());
    sim.bus.on('xp:gain', () => this.refresh());
    sim.bus.on('level:up', ({ level }) => toast('Level up! You are now level ' + level));
    sim.bus.on('caption', ({ text }) => { if (!sim.settings.captions || !text) return; this.caption.hidden = false; this.caption.textContent = text; clearTimeout(this._capT); this._capT = setTimeout(() => { this.caption.hidden = true; }, 3500); });
    setInterval(() => this.tick(), 1000);
    this.refresh();
  }

  setMode(mode) {
    const sim = this.sim;
    if (sim.services.controls) sim.services.controls.setMode(mode);
    else sim.bus.emit('mode:change', { mode });
  }

  refresh() {
    const s = this.sim.state;
    const z = layout.ZONES[s.zone] || layout.ZONES.courtyard;
    const wk = this.sim.data.course.weeks[s.week - 1];
    this.c.zone.innerHTML = `📍 <b>${z.name}</b>` + (this.sim.settings.lang === 'ur' ? ` <span lang="ur">${z.ur}</span>` : '');
    const m = MODES.find((x) => x[0] === s.mode) || MODES[0];
    this.c.mode.innerHTML = `🎮 ${m[2]}`;
    this.c.week.innerHTML = `📅 Week <b>${s.week}</b>`;
    this.c.apa.innerHTML = `APA <b>${wk ? wk.apa.join(', ') : ''}</b> · ${wk ? wk.domain : ''}`;
    this.c.xp.innerHTML = `⭐ <b>${s.xp}</b> XP · L${s.level}`;
    const st = this.sim.services.ai && this.sim.services.ai.status ? this.sim.services.ai.status() : 'offline';
    this.c.ai.innerHTML = `<span class="light ${st === 'online' ? 'on' : 'off'}"></span>RAAHI ${st === 'online' ? 'online' : 'offline'}`;
    for (const b of this.bottom.querySelectorAll('[data-mode]')) b.setAttribute('aria-pressed', String(b.dataset.mode === s.mode));
  }

  tick() {
    const sec = Math.floor((Date.now() - this.t0) / 1000);
    this.c.time.textContent = `⏱ ${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    if (sec % 5 === 0) this.refresh();
  }

  showBanner(zone) {
    const z = layout.ZONES[zone]; if (!z) return;
    this.banner.innerHTML = `${z.name}<small lang="ur" dir="rtl">${z.ur}</small><small>Simulated institution — IIBS</small>`;
    this.banner.style.opacity = 1;
    clearTimeout(this._bt); this._bt = setTimeout(() => { this.banner.style.opacity = 0; }, 2600);
  }

  setPrompt(text) { if (!text) { this.prompt.hidden = true; return; } this.prompt.hidden = false; this.prompt.textContent = text; }

  drawMinimap(player, yaw) {
    const c = this.mini, g = c.getContext('2d'), W = c.width, H = c.height, sc = W / 240;
    g.clearRect(0, 0, W, H);
    const P = (x, z) => [W / 2 + x * sc, H / 2 + z * sc];
    g.fillStyle = 'rgba(15,118,110,.35)'; const [cx, cz] = P(-30, -30); g.fillRect(cx, cz, 60 * sc, 60 * sc);
    g.font = '600 15px system-ui'; g.textAlign = 'center';
    for (const id of layout.ORDER) {
      const zc = layout.ZONES[id].center; const [x, y] = P(zc[0], zc[2]);
      g.fillStyle = this.sim.state.zone === id ? '#F59E0B' : 'rgba(165,180,252,.55)'; g.fillRect(x - 20 * sc / 2, y - 20 * sc / 2, 20 * sc, 20 * sc);
      g.fillStyle = '#F8FAFC'; g.fillText(layout.ZONES[id].name.split(/[ &—]/)[0], x, y + 26);
    }
    if (player) { const [x, y] = P(player.x, player.z); g.fillStyle = '#fb7185'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); g.strokeStyle = '#fb7185'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.sin(yaw) * 18, y - Math.cos(yaw) * 18); g.stroke(); }
  }

  toggleNight() {
    const sim = this.sim;
    sim.state.timeOfDay = sim.state.timeOfDay === 'night' ? 'day' : sim.state.timeOfDay === 'day' ? 'dusk' : 'night';
    if (sim.services.engine) sim.services.engine.setTimeOfDay(sim.state.timeOfDay);
    if (sim.services.world && sim.services.world.setTimeOfDay) sim.services.world.setTimeOfDay(sim.state.timeOfDay);
    toast('Time of day: ' + sim.state.timeOfDay);
    sim.bus.emit('time:change', { t: sim.state.timeOfDay });
  }

  save() {
    const ok = this.sim.store.save(this.sim.snapshot());
    toast(ok ? 'Progress saved on this device.' : 'Could not save (storage unavailable).');
    this.sim.bus.emit('save:done', { ok });
  }

  help() {
    modal({
      title: 'Keys & help',
      body: `<table class="t"><tr><th>Key</th><th>Action</th></tr>
        <tr><td>1–7</td><td>Modes: Walk · Director · Participant · Clinic · Social Sim · Neuro · Tour/Photo/Drone</td></tr>
        <tr><td>W A S D / arrows</td><td>Move (Shift run). Click the 3D view to look with the mouse; Esc releases</td></tr>
        <tr><td>E</td><td>Use exhibit / start paradigm when a prompt is shown</td></tr>
        <tr><td>T</td><td>Talk to RAAHI (AI tutor)</td></tr><tr><td>J</td><td>A Participant's Journey</td></tr>
        <tr><td>N</td><td>Day / dusk / night</td></tr><tr><td>P</td><td>Photo mode (in Tour)</td></tr><tr><td>M</td><td>Toggle minimap</td></tr>
        <tr><td>Esc</td><td>Close panel / withdraw from an experiment</td></tr></table>
        <p>Panels on the left are grouped by week. Every panel shows its APA 3.0 outcome, BPS domain and HEC course tags.</p>
        <p class="note">Simulated institution. Generated numbers are labelled "Simulated data". Study facts carry verification and replication badges.</p>`,
    });
  }

  async launcher() {
    const sim = this.sim;
    const list = Array.from(sim.registry.paradigms.values()).sort((a, b) => a.week - b.week);
    const body = h('div', null, h('p', null, 'Participant Mode: do real timed tasks and get your own data, graphs and a debrief. ', btn("Start A Participant's Journey (12 steps)", () => { close(); sim.services.journey && sim.services.journey.start('participant'); }, 'primary')),
      h('div', { class: 'grid2' }, list.map((p) => h('div', { class: 'card' }, h('h4', null, p.title), h('p', { class: 'note' }, `Week ${p.week} · APA ${p.apa} · ${p.domain}${p.deception ? ' · includes debrief' : ''}`), btn('Run', () => { close(); sim.services.runner.run(p.id); }, 'teal')))));
    let close = () => {};
    await modal({ title: 'Participant Mode — choose a paradigm', body, onMount: (_, c) => { close = () => c(null); } });
  }
}

module.exports = { HUD, MODES };
