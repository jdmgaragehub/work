'use strict';
/**
 * Scoring (A9) — XP/levels, badges, APA-goal scorecard, grade, certificate, local leaderboard.
 *
 *   const scoring = new Scoring(sim)      // sim.services.scoring
 *   scoring.award(id)                     // badge (idempotent) → 'badge:earned' {id}
 *   scoring.scorecard() / grade() / overall()
 *   scoring.certificate(name) → canvas    // drawn on a 2D canvas (PNG download + print view)
 *   scoring.downloadCertificate(name) / printCertificate(name)
 *   scoring.submitLeaderboard(name) / leaderboard()
 *   scoring.renderSummary(container)      // used by the Missions / Quiz / Settings panels
 *
 * Counters live in sim.state.gameStats (saved with the snapshot). Rules: src/game/logic.js.
 */
const L = require('./logic.js');
const { h, btn, toast, modal, download } = require('../ui/dom.js');

const LB_KEY = 'zehn.leaderboard.v1';
const HOT = new Set(['trial:start', 'trial:end', 'face:au', 'neuron:spike', 'client:turn', 'quality:change', 'mission:progress', 'photo:toggle']);
const GOAL_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#CC79A7', '#0072B2'];

function injectCSS(id, css) {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s);
}
const CSS = `
.zg-goal{display:grid;grid-template-columns:minmax(150px,1.2fr) 3fr 44px;gap:8px;align-items:center;margin:4px 0;font-size:.86em}
.zg-goal .progress{height:10px}
.zg-badges{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.zg-badge{border:1px solid var(--saffron,#F59E0B);color:#fde68a;border-radius:999px;padding:2px 9px;font-size:.78em}
.zg-badge.locked{opacity:.4;border-style:dashed;color:inherit}
.zg-grade{font-size:2.2em;font-weight:800;color:#fde68a;line-height:1}
.zg-cert-img{width:100%;border-radius:8px;background:#fffdf5}
@media print{body.zg-printing>*:not(.zg-print-area){display:none!important}body.zg-printing{background:#fff!important}.zg-print-area img{width:100%;}}
`;

function readLB() { try { const v = JSON.parse(localStorage.getItem(LB_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function writeLB(list) { try { localStorage.setItem(LB_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } }

class Scoring {
  constructor(sim) {
    this.sim = sim;
    this._ensure();
    this.offs = [
      sim.bus.on('*', (p, e) => this.onEvent(e, p)),
      sim.bus.on('state:restored', () => { this._ensure(); this.recompute(); }),
    ];
    this.recompute();
  }

  _ensure() {
    const st = this.sim.state;
    if (!st.gameStats || !st.gameStats.events) st.gameStats = Object.assign(L.newStats(), st.gameStats || {});
    if (!Array.isArray(st.badges)) st.badges = [];
    if (!st.scorecard) st.scorecard = { g1: 0, g2: 0, g3: 0, g4: 0, g5: 0 };
  }

  get stats() { return this.sim.state.gameStats; }

  onEvent(event, payload) {
    if (L.SELF_EVENTS.has(event) && event !== 'mission:complete') return;
    L.tally(this.stats, event, payload);
    if (HOT.has(event)) return; // high-frequency events never change the scorecard
    this.recompute();
    for (const id of L.evaluateBadges(this.stats, this.sim.state, this.sim.state.badges)) this.award(id);
  }

  recompute() {
    const st = this.sim.state;
    const sc = L.computeScorecard(this.stats, st, this.sim.data);
    const changed = ['g1', 'g2', 'g3', 'g4', 'g5'].some((g) => st.scorecard[g] !== sc[g]);
    Object.assign(st.scorecard, sc);
    st.grade = L.gradeFor(L.overallScore(sc));
    if (changed) this.sim.bus.emit('scorecard:update', { scorecard: Object.assign({}, sc), grade: st.grade });
    return sc;
  }

  scorecard() { return Object.assign({}, this.recompute()); }
  overall() { return L.overallScore(this.scorecard()); }
  grade() { return L.gradeFor(this.overall()); }
  badgeName(id) { return L.badgeName(id, this.sim.data.missions); }

  /** Award a badge once. Returns true if newly earned. */
  award(id, why) {
    const st = this.sim.state;
    if (!id || st.badges.includes(id)) return false;
    st.badges.push(id);
    this.sim.bus.emit('badge:earned', { id });
    try { toast('🏅 Badge earned: ' + this.badgeName(id) + (why ? ' — ' + why : '')); } catch (e) { /* no DOM */ }
    if (this.sim.services.audio && this.sim.services.audio.ui) try { this.sim.services.audio.ui('badge'); } catch (e) { /* optional */ }
    return true;
  }

  /** Remove XP for an ethics breach (never below 0) and log the penalty. */
  penalise(why) {
    const st = this.sim.state;
    const lost = L.applyEthicsPenalty(st, st.difficulty);
    this.sim.bus.emit('xp:gain', { n: -lost, why: 'Ethics penalty' + (why ? ': ' + why : '') });
    this.recompute();
    return lost;
  }

  // ---------------------------------------------------------------- leaderboard
  leaderboard(seed) { return L.leaderboardFor(readLB(), seed == null ? this.sim.seed : seed); }
  submitLeaderboard(name) {
    const st = this.sim.state;
    const e = L.makeEntry({ name, seed: this.sim.seed, xp: st.xp, score: this.overall(), level: st.level });
    const list = L.insertEntry(readLB(), e);
    writeLB(list);
    st.leaderboard = L.leaderboardFor(list, this.sim.seed);
    this.sim.bus.emit('leaderboard:submit', { name: e.name });
    return e;
  }
  clearLeaderboard() { writeLB(readLB().filter((e) => e.seed !== String(this.sim.seed))); this.sim.state.leaderboard = []; }

  // ---------------------------------------------------------------- certificate
  certificate(name, opts = {}) {
    const st = this.sim.state;
    const sc = this.scorecard();
    const total = L.overallScore(sc);
    const grade = L.gradeFor(total);
    const W = 1400, H = 990;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fffdf5'; g.fillRect(0, 0, W, H);
    // ajrak-style border
    g.strokeStyle = '#1E1B4B'; g.lineWidth = 14; g.strokeRect(28, 28, W - 56, H - 56);
    g.strokeStyle = '#B91C1C'; g.lineWidth = 3; g.strokeRect(50, 50, W - 100, H - 100);
    for (let x = 70; x < W - 70; x += 36) { g.fillStyle = (x / 36) % 2 < 1 ? '#B91C1C' : '#1E1B4B'; g.beginPath(); g.arc(x, 66, 5, 0, Math.PI * 2); g.arc(x, H - 66, 5, 0, Math.PI * 2); g.fill(); }
    g.textAlign = 'center'; g.fillStyle = '#1E1B4B';
    g.font = '700 30px Georgia, serif'; g.fillText('ZEHN — The Psychology Lab Simulator', W / 2, 140);
    g.font = '600 20px system-ui, sans-serif'; g.fillStyle = '#7c2d12'; g.fillText('Simulated institution — IIBS · for learning only, not an academic award', W / 2, 175);
    g.fillStyle = '#1E1B4B'; g.font = '700 64px Georgia, serif'; g.fillText(opts.title || 'Certificate of Achievement', W / 2, 265);
    g.font = '24px Georgia, serif'; g.fillText('This certifies that', W / 2, 320);
    g.font = 'italic 700 58px Georgia, serif'; g.fillStyle = '#B91C1C'; g.fillText(String(name || 'Anonymous researcher').slice(0, 40), W / 2, 395);
    g.strokeStyle = '#1E1B4B'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(W / 2 - 330, 415); g.lineTo(W / 2 + 330, 415); g.stroke();
    g.fillStyle = '#1E1B4B'; g.font = '24px Georgia, serif';
    g.fillText(`completed the 16-week research programme in ZEHN at level ${st.level} (${L.levelTitle(st.level)}) with ${st.xp} XP.`, W / 2, 460);
    // grade seal
    g.save(); g.translate(W - 230, 330); g.fillStyle = '#F59E0B'; g.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2, r = i % 2 ? 78 : 92; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.fill(); g.fillStyle = '#1E1B4B'; g.font = '800 70px Georgia, serif'; g.textBaseline = 'middle'; g.fillText(grade, 0, -4);
    g.font = '600 16px system-ui'; g.fillText(total.toFixed(1) + ' / 100', 0, 46); g.restore();
    g.textBaseline = 'alphabetic';
    // APA goal bars
    const keys = ['g1', 'g2', 'g3', 'g4', 'g5'];
    g.textAlign = 'left'; g.font = '700 22px system-ui, sans-serif'; g.fillText('APA Guidelines 3.0 goals (scorecard)', 170, 525);
    keys.forEach((k, i) => {
      const y = 560 + i * 52;
      g.font = '18px system-ui, sans-serif'; g.fillStyle = '#1E1B4B'; g.fillText(`Goal ${i + 1}. ${L.GOALS[k]}`, 170, y + 17);
      g.fillStyle = '#e7e5e4'; g.fillRect(640, y, 520, 24);
      g.fillStyle = GOAL_COLORS[i]; g.fillRect(640, y, 5.2 * sc[k], 24);
      g.fillStyle = '#1E1B4B'; g.font = '700 18px system-ui'; g.fillText(String(sc[k]), 1175, y + 19);
    });
    g.textAlign = 'center'; g.font = '18px system-ui, sans-serif'; g.fillStyle = '#334155';
    const date = opts.date || new Date().toISOString().slice(0, 10);
    g.fillText(`Badges: ${st.badges.length} · Ethics penalties: ${st.ethicsPenalty || 0} · Difficulty: ${st.difficulty} · Seed: ${this.sim.seed} · Date: ${date}`, W / 2, 855);
    g.font = '15px system-ui, sans-serif'; g.fillText('Generated offline on this device. IIBS is a simulated institution in a teaching game; this certificate carries no credit.', W / 2, 885);
    return c;
  }

  _pngBlob(canvas) {
    return new Promise((res) => {
      if (canvas.toBlob) canvas.toBlob((b) => res(b || dataURLBlob(canvas.toDataURL('image/png'))), 'image/png');
      else res(dataURLBlob(canvas.toDataURL('image/png')));
    });
  }

  async downloadCertificate(name) {
    const c = this.certificate(name);
    const blob = await this._pngBlob(c);
    const r = download(`zehn_certificate_${String(this.sim.seed).replace(/[^\w-]/g, '')}.png`, blob, 'image/png');
    this.sim.bus.emit('export:done', { kind: 'png' });
    return r;
  }

  printCertificate(name) { printCanvas(this.certificate(name)); this.sim.bus.emit('export:done', { kind: 'print' }); }

  /** Name-entry dialog → preview → PNG / print. */
  async certificateDialog() {
    injectCSS('zg-css', CSS);
    const input = h('input', { type: 'text', placeholder: 'Name to print (optional)', 'aria-label': 'Name on certificate', maxlength: 40, value: this.sim.state.certName || '' });
    const preview = h('img', { class: 'zg-cert-img', alt: 'Certificate preview' });
    const refresh = () => { this.sim.state.certName = input.value; preview.src = this.certificate(input.value).toDataURL('image/png'); };
    input.addEventListener('input', refresh);
    refresh();
    const body = h('div', null, h('label', { class: 'f' }, 'Name', input), preview, h('p', { class: 'note' }, 'Your name is used only on this device. "IIBS" is a simulated institution.'));
    const act = await modal({ title: 'Certificate', body, actions: [{ label: 'Close', value: null, cls: 'ghost' }, { label: 'Print', value: 'print' }, { label: 'Download PNG', value: 'png' }] });
    if (act === 'png') await this.downloadCertificate(input.value);
    if (act === 'print') this.printCertificate(input.value);
    return act;
  }

  // ---------------------------------------------------------------- summary panel
  renderSummary(container) {
    injectCSS('zg-css', CSS);
    const sim = this.sim, st = sim.state;
    const sc = this.scorecard();
    const total = L.overallScore(sc);
    const lp = L.levelProgress(st.xp);
    const wrap = h('div', { class: 'zg-summary' });
    wrap.appendChild(h('div', { class: 'row' },
      h('div', { class: 'zg-grade', 'aria-label': 'Grade ' + L.gradeFor(total) }, L.gradeFor(total)),
      h('div', null, h('div', null, h('b', null, `Level ${lp.level} — ${L.levelTitle(lp.level)}`), ` · ${st.xp} XP · overall ${total.toFixed(1)}/100`),
        h('div', { class: 'progress', role: 'progressbar', 'aria-label': 'Progress to next level', 'aria-valuenow': Math.round(lp.frac * 100), 'aria-valuemin': 0, 'aria-valuemax': 100, style: { width: '260px' } }, h('i', { style: { width: Math.round(lp.frac * 100) + '%' } })),
        h('div', { class: 'note' }, `${lp.next - st.xp} XP to level ${lp.level + 1}. Ethics penalties: ${st.ethicsPenalty || 0}. Difficulty: ${st.difficulty}.`))));
    wrap.appendChild(h('h3', null, 'Scorecard — APA Guidelines 3.0 goals'));
    ['g1', 'g2', 'g3', 'g4', 'g5'].forEach((k, i) => wrap.appendChild(h('div', { class: 'zg-goal' },
      h('span', null, `${i + 1}. ${L.GOALS[k]}`),
      h('div', { class: 'progress', role: 'progressbar', 'aria-label': L.GOALS[k], 'aria-valuenow': sc[k], 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: { width: sc[k] + '%', background: GOAL_COLORS[i] } })),
      h('b', null, String(sc[k])))));
    wrap.appendChild(h('p', { class: 'note' }, 'Grade bands: A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, F below. Goal 1 = quiz + panels; Goal 2 = paradigms, statistics, replications; Goal 3 = IRB, debriefs, dilemmas (−' + L.ETHICS_G3_POINTS + ' per ethics penalty); Goal 4 = reports, exports, presenting; Goal 5 = missions, journeys, clinic, tour.'));
    wrap.appendChild(h('h3', null, `Badges (${st.badges.length})`));
    const bw = h('div', { class: 'zg-badges' });
    const missionBadges = sim.data.missions.filter((m) => m.badge).map((m) => ({ id: m.badge, desc: 'Mission ' + m.id + ': ' + m.title }));
    const all = L.BADGES.map((b) => ({ id: b.id, desc: b.desc })).concat(missionBadges.filter((m) => !L.BADGES.some((b) => b.id === m.id)));
    for (const b of all) { const have = st.badges.includes(b.id); bw.appendChild(h('span', { class: 'zg-badge' + (have ? '' : ' locked'), title: b.desc }, (have ? '🏅 ' : '') + this.badgeName(b.id))); }
    wrap.appendChild(bw);
    wrap.appendChild(h('h3', null, 'Local leaderboard — seed ' + sim.seed));
    const lbHost = h('div');
    const drawLB = () => {
      lbHost.innerHTML = '';
      const rows = this.leaderboard();
      if (!rows.length) { lbHost.appendChild(h('p', { class: 'note' }, 'No entries yet for this seed. Entries stay on this device.')); return; }
      const t = h('table', { class: 't' }, h('thead', null, h('tr', null, ['#', 'Name', 'Score', 'Grade', 'XP', 'Date'].map((x) => h('th', null, x)))),
        h('tbody', null, rows.map((e) => h('tr', null, [e.rank, e.name, e.score.toFixed(1), e.grade, e.xp, String(e.date).slice(0, 10)].map((x) => h('td', null, String(x)))))));
      lbHost.appendChild(t);
    };
    drawLB();
    wrap.appendChild(lbHost);
    const nameIn = h('input', { type: 'text', placeholder: 'Name or nickname', 'aria-label': 'Leaderboard name', maxlength: 32, value: st.certName || '' });
    wrap.appendChild(h('div', { class: 'row' }, nameIn,
      btn('Submit score', () => { this.submitLeaderboard(nameIn.value); drawLB(); toast('Saved to the local leaderboard.'); }, 'teal'),
      btn('Clear this seed', () => { this.clearLeaderboard(); drawLB(); }, 'ghost'),
      btn('Certificate…', () => this.certificateDialog(), 'primary')));
    if (container) container.appendChild(wrap);
    return wrap;
  }

  dispose() { this.offs.forEach((f) => f()); }
}

function dataURLBlob(url) {
  const [head, b64] = url.split(',');
  const bin = atob(b64); const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type: (head.match(/data:([^;]+)/) || [])[1] || 'image/png' });
}

/** Print a canvas via a print-only container (print CSS hides everything else). */
function printCanvas(canvas) {
  injectCSS('zg-css', CSS);
  const area = h('div', { class: 'zg-print-area' }, h('img', { src: canvas.toDataURL('image/png'), alt: 'Certificate' }));
  document.body.appendChild(area);
  document.body.classList.add('zg-printing');
  const done = () => { document.body.classList.remove('zg-printing'); area.remove(); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  try { window.print(); } catch (e) { /* print unavailable */ }
  setTimeout(done, 1500);
}

module.exports = { Scoring, printCanvas, injectCSS, dataURLBlob };
