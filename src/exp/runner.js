'use strict';
/**
 * Experiment runner (A8) — DOM side of the timeline. Contract: docs/EXPERIMENT_API.md.
 *
 * Timing (§9, G13): the WebGL loop is paused (experiment mode); the stimulus is drawn on a
 * dedicated 2D canvas; onset is scheduled on requestAnimationFrame — the stimulus is drawn in
 * the first frame whose timestamp is within half a frame of the requested onset; onset_actual is
 * that rAF timestamp. Responses use KeyboardEvent/PointerEvent.timeStamp (same clock as
 * performance.now()). Each row logs requested vs actual onset and the error in frames.
 */
const { h, btn, modal, toast, download } = require('../ui/dom.js');
const T = require('./core/timeline.js');
const timing = require('./core/timing.js');
const P = require('../psych/participants.js');
const { Rng } = require('../core/rng.js');

const raf = () => new Promise((r) => requestAnimationFrame(r));

class Runner {
  constructor(sim) {
    this.sim = sim;
    this.active = null;
    this.frameMs = 16.67;
    this.lastTiming = null;
    this._measureFrames();
  }

  async _measureFrames() {
    const stamps = [];
    for (let i = 0; i < 31; i++) stamps.push(await raf());
    this.frameMs = timing.frameDuration(stamps);
  }

  spec(id) { return this.sim.registry.paradigms.get(id); }

  /** Pre-run gates: content warning, photosensitivity, consent. Returns {go, photosafe, altPath}. */
  async gates(spec, opts) {
    const sim = this.sim;
    if (opts.bot) return { go: true, photosafe: !!opts.photosafe };
    if (spec.contentWarning && spec.contentWarning.length) {
      const pref = spec.contentWarning.map((t) => sim.settings.contentWarnings[t] || 'ask');
      let choice = pref.includes('skip') ? 'alt' : null;
      if (!choice) {
        choice = await modal({
          title: 'Content note',
          body: `<p>This module touches on: <b>${spec.contentWarning.join(', ')}</b>.</p><p>You can continue, or take the equivalent <b>text-and-quiz path</b> — your progress is not blocked either way.</p><p class="note">Support is always available from Settings → Crisis resources.</p>`,
          actions: [{ label: 'Text-and-quiz path', value: 'alt' }, { label: 'Continue', value: 'go' }],
        });
      }
      if (choice === 'alt') return { go: false, altPath: true };
      if (choice !== 'go') return { go: false };
    }
    let photosafe = !!sim.settings.photosafe;
    if (spec.photosensitive && !photosafe) {
      const c = await modal({
        title: 'Photosensitivity warning',
        body: '<p>This task contains a <b>flicker</b> (capped at 3 flashes per second, reduced contrast — WCAG 2.3.1 "three flashes").</p><p>If you have photosensitive epilepsy or feel unwell with flicker, choose the <b>static alternative</b>.</p>',
        actions: [{ label: 'Static alternative', value: 'static' }, { label: 'Continue with flicker', value: 'flicker' }],
      });
      if (c == null) return { go: false };
      photosafe = c === 'static';
    }
    const est = Math.max(1, Math.round((spec.estimateMin || 3)));
    const ok = await modal({
      title: 'Informed consent — ' + spec.title,
      body: `<p><b>Purpose.</b> ${spec.purpose || 'To experience a classic psychology paradigm and see your own data.'}</p>
        <p><b>Duration.</b> About ${est} minute${est > 1 ? 's' : ''}.</p>
        <p><b>Your rights.</b> Participation is voluntary. You may withdraw at any time without penalty by pressing <kbd>Esc</kbd>; your data from this run is then discarded.</p>
        <p><b>Privacy.</b> Your data never leaves this device. Rows are stored locally under an anonymous id (${sim.state.pid}). Export happens only if you choose it.</p>
        <p class="note">For learning only — not a diagnosis or a test of ability. Browser reaction times include a fixed lag of tens of milliseconds and some jitter (Bridges et al., 2020), so they are fine for teaching, not for publishable research.</p>`,
      actions: [{ label: 'I do not consent', value: false, cls: 'ghost' }, { label: 'I consent', value: true }],
    });
    if (!ok) return { go: false };
    sim.state.consentLog.push({ paradigm: spec.id, at: new Date().toISOString() });
    sim.bus.emit('consent:given', { paradigm: spec.id });
    return { go: true, photosafe };
  }

  /**
   * Run a paradigm. opts: { bot, quick, seed, trials (override count), timeScale, photosafe, silent }
   * Resolves with { rows, summary, timing } (or null if withdrawn/declined).
   */
  async run(id, opts = {}) {
    const sim = this.sim;
    const spec = this.spec(id);
    if (!spec) throw new Error('unknown paradigm ' + id);
    if (this.active) { toast('An experiment is already running.'); return null; }
    const gate = await this.gates(spec, opts);
    if (!gate.go) {
      if (gate.altPath) this.altPath(spec);
      return null;
    }
    const seed = opts.seed || sim.seed + ':' + id + ':' + (sim.state.paradigmsRun[id] || 0);
    const rng = new Rng(seed);
    const quick = !!opts.quick || !!opts.bot;
    const timeScale = opts.timeScale || (quick ? 0.12 : 1);
    const bopts = { quick, photosafe: gate.photosafe, trials: opts.trials, bot: !!opts.bot };
    let trials = T.buildTimeline(spec, rng, Object.assign({ practice: quick ? Math.min(2, spec.practice || 0) : spec.practice || 0 }, bopts));
    if (opts.trials) trials = trials.slice(0, opts.trials);
    const state = spec.init ? spec.init(rng, bopts) : {};
    state.photosafe = gate.photosafe;
    const base = { pid: opts.bot ? 'BOT001' : sim.state.pid, session: sim.state.session, paradigm: id, seed, ua_hash: T.uaHash(navigator.userAgent) };
    const bot = opts.bot ? P.bot(new Rng(seed + ':bot')) : null;
    const botRng = new Rng(seed + ':botrt');

    if (!opts.bot && spec.instructions) {
      const go = await modal({ title: spec.title + ' — instructions', body: `<div>${spec.instructions}</div><p class="note">Press <kbd>Esc</kbd> at any time to withdraw.</p>`, actions: [{ label: 'Cancel', value: false, cls: 'ghost' }, { label: 'Start', value: true }] });
      if (!go) return null;
    }

    // ---- overlay
    const canvas = h('canvas', { 'aria-label': spec.title + ' stimulus display' });
    const bar = h('div', { class: 'exp-bar' }, h('span', null, spec.title), h('span', { class: 'exp-count' }, ''), h('span', null, 'Esc = withdraw'));
    const resp = h('div', { class: 'exp-resp' });
    const caption = h('div', { class: 'exp-caption', hidden: true });
    const overlay = h('div', { class: 'exp', role: 'application', 'aria-label': spec.title }, canvas, bar, resp, caption);
    document.body.appendChild(overlay);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = overlay.clientWidth, H = overlay.clientHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (sim.services.renderer) sim.services.renderer.setExperimentMode(true);
    if (sim.services.input) sim.services.input.suspend(true);

    const rows = [];
    let withdrawn = false;
    const run = { spec, rows, overlay, ctx, W, H, state, abort: null };
    this.active = run;
    sim.bus.emit('exp:start', { paradigm: id });

    const clear = (bg) => { ctx.fillStyle = bg || spec.background || '#808080'; ctx.fillRect(0, 0, W, H); };
    const fixation = () => { clear(); ctx.fillStyle = '#111'; ctx.font = '600 40px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', W / 2, H / 2); };
    const say = (txt) => { if (sim.settings.captions && txt) { caption.hidden = false; caption.textContent = txt; } else caption.hidden = true; };

    const onEsc = async (e) => {
      if (e.key !== 'Escape' || !this.active) return;
      e.preventDefault(); e.stopPropagation();
      if (opts.bot) return;
      run.paused = true;
      const w = await modal({ title: 'Withdraw?', body: '<p>Withdrawing ends the run and discards this run\'s data. There is no penalty.</p>', actions: [{ label: 'Keep going', value: false }, { label: 'Withdraw', value: true, cls: 'primary' }] });
      run.paused = false;
      if (w) { withdrawn = true; if (run.abort) run.abort(); }
    };
    window.addEventListener('keydown', onEsc, true);

    const runStart = performance.now();
    const waitMs = async (ms) => { const end = performance.now() + ms; while (performance.now() < end - this.frameMs / 2) { if (withdrawn) return; await raf(); while (run.paused) await raf(); } };

    try {
      for (let i = 0; i < trials.length && !withdrawn; i++) {
        const trial = trials[i];
        bar.querySelector('.exp-count').textContent = `${trial.block === 'practice' ? 'Practice' : 'Trial'} ${i + 1} / ${trials.length}`;
        if (spec.prepare) spec.prepare(trial, state, rng);
        sim.bus.emit('trial:start', { paradigm: id, trial: i + 1 });
        // fixation
        const fix = (trial.fix != null ? trial.fix : spec.fix != null ? spec.fix : 500) * timeScale;
        if (fix > 0) { fixation(); await raf(); }
        const fixStart = performance.now();
        const onsetReqAbs = fixStart + fix;
        // wait for the onset frame
        let ts = performance.now();
        while (true) { ts = await raf(); if (withdrawn) break; if (ts + this.frameMs / 2 >= onsetReqAbs) break; }
        if (withdrawn) break;
        clear(trial.background);
        spec.draw(ctx, trial, W, H, 0, state);
        const onsetAbs = ts;
        if (trial.audio && spec.audio && sim.services.audio && !opts.bot) spec.audio(trial, sim.services.audio, state);
        if (trial.caption) say(trial.caption); else caption.hidden = true;
        const result = await this.collect(run, trial, { onsetAbs, timeScale, bot, botRng, W, H, clear, sim, opts, withdrawnRef: () => withdrawn });
        if (withdrawn) break;
        let correct = result.correct != null ? result.correct : spec.score ? spec.score(trial, result.response, state) : null;
        if (trial.block === 'check' && spec.attentionCheck) correct = result.response === trial.correctResponse;
        const row = T.makeRow(base, trial, {
          onset_req: onsetReqAbs - runStart, onset_actual: onsetAbs - runStart, frames: (onsetAbs - onsetReqAbs) / this.frameMs,
          rt_ms: result.rt, response: result.response, correct,
        });
        rows.push(row);
        if (spec.update) spec.update(state, trial, Object.assign({ correct }, result), rng);
        sim.bus.emit('trial:end', { paradigm: id, trial: i + 1 });
        // practice feedback
        if (trial.block === 'practice' && correct != null && !opts.bot) {
          clear(); ctx.fillStyle = correct ? '#065f46' : '#9f1239'; ctx.font = '600 30px system-ui'; ctx.textAlign = 'center'; ctx.fillText(correct ? 'Correct' : 'Incorrect', W / 2, H / 2);
          await waitMs(500);
        }
        clear();
        await waitMs((trial.iti != null ? trial.iti : spec.iti != null ? spec.iti : 300) * timeScale);
      }
    } finally {
      window.removeEventListener('keydown', onEsc, true);
      overlay.remove();
      if (sim.services.renderer) sim.services.renderer.setExperimentMode(false);
      if (sim.services.input) sim.services.input.suspend(false);
      this.active = null;
    }
    if (withdrawn) { sim.bus.emit('exp:withdrawn', { paradigm: id }); toast('Withdrawn — this run\'s data was discarded.'); return null; }

    const tsum = timing.summarise(rows, this.frameMs);
    this.lastTiming = tsum;
    const key = opts.bot ? id + ':bot' : id;
    sim.datasets[key] = (sim.datasets[key] || []).concat(rows);
    sim.state.paradigmsRun[id] = (sim.state.paradigmsRun[id] || 0) + 1;
    let summary = null;
    try { summary = spec.analyse ? spec.analyse(rows.filter((r) => r.block !== 'practice'), state) : null; } catch (err) { summary = { lines: ['Analysis unavailable for this run: ' + err.message] }; }
    sim.bus.emit('exp:complete', { paradigm: id, rows: rows.length, bot: !!opts.bot });
    if (!opts.bot) sim.addXP(60, 'Ran ' + spec.title);
    if (!opts.silent && !opts.bot) await this.results(spec, rows, summary, tsum);
    if (spec.deception) {
      if (opts.bot) sim.bus.emit('debrief:shown', { paradigm: id });
      else await this.debrief(spec, key);
    }
    return { rows, summary, timing: tsum };
  }

  /** Collect one response according to spec.response.type. */
  collect(run, trial, ctx0) {
    const { spec, ctx, W, H, state } = run;
    const { onsetAbs, timeScale, bot, botRng, opts } = ctx0;
    const rtype = trial.responseType || (spec.response && spec.response.type) || 'key';
    const respHost = run.overlay.querySelector('.exp-resp');
    respHost.innerHTML = '';
    return new Promise((resolve) => {
      let done = false, rafId = 0;
      const timers = [];
      const listeners = [];
      const listen = (target, ev, fn, cap) => { target.addEventListener(ev, fn, cap); listeners.push([target, ev, fn, cap]); };
      const finish = (res) => {
        if (done) return; done = true;
        cancelAnimationFrame(rafId); timers.forEach(clearTimeout);
        listeners.forEach(([t, e, f, c]) => t.removeEventListener(e, f, c));
        respHost.innerHTML = '';
        if (trial.followup && res.response != null && !res.skipFollowup) {
          this.followup(run, trial, bot, botRng, timeScale).then((fu) => resolve(Object.assign(res, { response: res.response + '|' + fu })));
        } else resolve(res);
      };
      run.abort = () => finish({ response: null, rt: null });
      // animation & stimulus offset
      const durMs = trial.dur != null ? trial.dur * timeScale : (spec.dur != null ? spec.dur * timeScale : null);
      const animate = (ts) => {
        if (done) return;
        const el = ts - onsetAbs;
        if (spec.animated || trial.animated || rtype === 'slider' || rtype === 'count' || rtype === 'pointer') {
          ctx0.clear(trial.background);
          if (durMs == null || el < durMs || rtype === 'slider' || rtype === 'pointer') spec.draw(ctx, trial, W, H, el / timeScale, state);
          else if (spec.drawMask) spec.drawMask(ctx, trial, W, H, state);
        } else if (durMs != null && el >= durMs && !run._offset) {
          run._offset = true; ctx0.clear(trial.background); if (spec.drawMask) spec.drawMask(ctx, trial, W, H, state);
        }
        rafId = requestAnimationFrame(animate);
      };
      run._offset = false;
      rafId = requestAnimationFrame(animate);
      const timeout = trial.timeout != null ? trial.timeout : spec.timeout;
      const keys = (trial.keys || (spec.response && spec.response.keys) || []).map((k) => k.toLowerCase());

      if (rtype === 'key') {
        listen(window, 'keydown', (e) => {
          const k = (e.key === ' ' ? 'space' : e.key).toLowerCase();
          if (!keys.includes(k) || e.repeat) return;
          e.preventDefault();
          finish({ response: k, rt: e.timeStamp - onsetAbs });
        }, true);
        // touch/mouse fallback buttons (same timestamp path)
        const labels = (spec.response && spec.response.labels) || {};
        for (const k of keys) respHost.appendChild(h('button', { type: 'button', class: 'btn', onpointerdown: (e) => { e.preventDefault(); finish({ response: k, rt: e.timeStamp - onsetAbs }); } }, `${k === 'space' ? 'Space' : k.toUpperCase()}${labels[k] ? ' — ' + labels[k] : ''}`));
      } else if (rtype === 'choice' || rtype === 'multi') {
        const choices = trial.choices || spec.response.choices || [];
        const picked = new Set();
        choices.forEach((c, i) => {
          const v = typeof c === 'object' ? c.value : c, lab = typeof c === 'object' ? c.label : c;
          const b = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onpointerdown: (e) => {
            e.preventDefault();
            if (rtype === 'choice') finish({ response: v, rt: e.timeStamp - onsetAbs });
            else { if (picked.has(v)) picked.delete(v); else picked.add(v); b.setAttribute('aria-pressed', String(picked.has(v))); b.style.outline = picked.has(v) ? '3px solid #F59E0B' : ''; }
          } }, (i < 9 ? (i + 1) + '. ' : '') + lab);
          respHost.appendChild(b);
        });
        if (rtype === 'multi') respHost.appendChild(h('button', { type: 'button', class: 'btn primary', onpointerdown: (e) => { e.preventDefault(); finish({ response: Array.from(picked).sort().join('+'), rt: e.timeStamp - onsetAbs }); } }, 'Submit'));
        listen(window, 'keydown', (e) => {
          const n = parseInt(e.key, 10);
          if (n >= 1 && n <= choices.length) {
            const c = choices[n - 1]; const v = typeof c === 'object' ? c.value : c;
            if (rtype === 'choice') finish({ response: v, rt: e.timeStamp - onsetAbs });
            else { if (picked.has(v)) picked.delete(v); else picked.add(v); respHost.children[n - 1].setAttribute('aria-pressed', String(picked.has(v))); respHost.children[n - 1].style.outline = picked.has(v) ? '3px solid #F59E0B' : ''; }
          } else if (rtype === 'multi' && e.key === 'Enter') finish({ response: Array.from(picked).sort().join('+'), rt: e.timeStamp - onsetAbs });
        }, true);
      } else if (rtype === 'slider') {
        const sl = trial.slider || spec.response.slider;
        state.sliderValue = sl.start != null ? sl.start : (sl.min + sl.max) / 2;
        const inp = h('input', { type: 'range', min: sl.min, max: sl.max, step: sl.step || 1, value: state.sliderValue, 'aria-label': sl.label || 'Adjust', style: { width: 'min(420px, 80vw)' }, oninput: () => { state.sliderValue = +inp.value; } });
        respHost.appendChild(h('span', { style: { color: '#111' } }, sl.label || 'Adjust'));
        respHost.appendChild(inp);
        respHost.appendChild(h('button', { type: 'button', class: 'btn primary', onpointerdown: (e) => { e.preventDefault(); finish({ response: state.sliderValue, rt: e.timeStamp - onsetAbs }); } }, 'Confirm (Enter)'));
        listen(window, 'keydown', (e) => {
          const step = (sl.step || 1) * (e.shiftKey ? 5 : 1);
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { state.sliderValue = Math.min(sl.max, state.sliderValue + step); inp.value = state.sliderValue; e.preventDefault(); }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { state.sliderValue = Math.max(sl.min, state.sliderValue - step); inp.value = state.sliderValue; e.preventDefault(); }
          if (e.key === 'Enter') finish({ response: state.sliderValue, rt: e.timeStamp - onsetAbs });
        }, true);
      } else if (rtype === 'text') {
        const inp = h('input', { type: 'text', 'aria-label': trial.prompt || 'Your answer', placeholder: trial.prompt || 'Type your answer', autocomplete: 'off' });
        const submit = (e) => finish({ response: inp.value.trim(), rt: e.timeStamp - onsetAbs });
        respHost.appendChild(inp);
        respHost.appendChild(h('button', { type: 'button', class: 'btn primary', onpointerdown: (e) => { e.preventDefault(); submit(e); } }, 'Submit'));
        listen(inp, 'keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') submit(e); });
        const showAfter = durMs || 0;
        respHost.style.visibility = showAfter ? 'hidden' : 'visible';
        timers.push(setTimeout(() => { respHost.style.visibility = 'visible'; if (!bot) inp.focus(); }, showAfter));
      } else if (rtype === 'count') {
        state.count = 0;
        listen(window, 'keydown', (e) => {
          const k = (e.key === ' ' ? 'space' : e.key).toLowerCase();
          if (!keys.includes(k) || e.repeat) return;
          e.preventDefault(); state.count++;
          if (spec.onKey) spec.onKey(trial, k, state, (e.timeStamp - onsetAbs) / timeScale);
        }, true);
        respHost.appendChild(h('button', { type: 'button', class: 'btn', onpointerdown: (e) => { e.preventDefault(); state.count++; if (spec.onKey) spec.onKey(trial, keys[0], state, (e.timeStamp - onsetAbs) / timeScale); } }, 'Press (Space)'));
        timers.push(setTimeout(() => finish({ response: state.count, rt: null }), durMs || 5000));
      } else if (rtype === 'pointer') {
        const cv = ctx.canvas;
        listen(cv, 'pointerdown', (e) => {
          const r = cv.getBoundingClientRect();
          const out = spec.onPointer(trial, e.clientX - r.left, e.clientY - r.top, state, (e.timeStamp - onsetAbs) / timeScale);
          if (out && out.done) finish({ response: out.response, rt: e.timeStamp - onsetAbs, correct: out.correct });
        });
        if (keys.length) listen(window, 'keydown', (e) => {
          const k = e.key.toLowerCase(); if (!keys.includes(k)) return;
          const out = spec.onKey ? spec.onKey(trial, k, state, (e.timeStamp - onsetAbs) / timeScale) : null;
          if (out && out.done) finish({ response: out.response, rt: e.timeStamp - onsetAbs, correct: out.correct });
        }, true);
      } else if (rtype === 'none') {
        timers.push(setTimeout(() => finish({ response: null, rt: null }), durMs || 1000));
      }
      if (timeout != null && rtype !== 'count' && rtype !== 'none') timers.push(setTimeout(() => finish({ response: null, rt: null, skipFollowup: true }), timeout * timeScale));

      // ---- bot participant: seeded ex-Gaussian RTs through the same event path
      if (bot) {
        const s = spec.simulate(bot, trial, botRng, state) || {};
        const rt = Math.max(8, (s.rt != null ? s.rt : 500) * timeScale);
        const wait = rtype === 'count' || rtype === 'none' ? null : (rtype === 'text' && durMs ? durMs + rt : rt);
        if (rtype === 'count') { state.count = s.response || 0; if (spec.onBotCount) spec.onBotCount(trial, state, s); }
        else if (wait != null) timers.push(setTimeout(() => {
          if (done) return;
          if (rtype === 'key' && s.response != null) window.dispatchEvent(new KeyboardEvent('keydown', { key: s.response === 'space' ? ' ' : s.response, bubbles: true }));
          else finish({ response: s.response, rt: performance.now() - onsetAbs, correct: s.correct });
          if (rtype === 'key' && s.response == null) { /* let timeout fire */ }
        }, wait));
      }
    });
  }

  followup(run, trial, bot, botRng, timeScale) {
    const host = run.overlay.querySelector('.exp-resp');
    const { ctx, W, H } = run;
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#111'; ctx.font = '600 24px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(trial.followup.prompt, W / 2, H / 2 - 40);
    return new Promise((resolve) => {
      host.innerHTML = '';
      const choose = (v) => { host.innerHTML = ''; resolve(v); };
      trial.followup.choices.forEach((c) => host.appendChild(btn(String(c), () => choose(c))));
      if (bot) setTimeout(() => choose(trial.followup.botAnswer != null ? trial.followup.botAnswer : trial.followup.choices[botRng.int(0, trial.followup.choices.length - 1)]), 30 * timeScale + 5);
    });
  }

  async results(spec, rows, summary, tsum) {
    const charts = require('../ui/charts.js');
    const body = h('div');
    if (summary && summary.lines) body.appendChild(h('div', { class: 'stat-out' }, summary.lines.join('\n')));
    if (summary && summary.chart) { try { const c = summary.chart(charts); if (c) body.appendChild(c); } catch (e) { /* chart optional */ } }
    if (summary && summary.simulatedNote !== false) body.appendChild(h('p', { class: 'note' }, 'Your own data. Group comparisons elsewhere use simulated participants and are labelled "Simulated data".'));
    if (tsum) body.appendChild(h('p', { class: 'note' }, `Timing quality: median onset error ${tsum.medianFrames.toFixed(2)} frames, 95th pct ${tsum.p95Frames.toFixed(2)} frames (frame ≈ ${tsum.frameMs.toFixed(1)} ms). Browser RTs include a fixed lag (Bridges et al., 2020).`));
    const a = await modal({ title: spec.title + ' — your results', body, actions: [{ label: 'Download CSV', value: 'csv', cls: 'teal' }, { label: 'Done', value: 'done' }] });
    if (a === 'csv') { download(`zehn_${spec.id}.csv`, T.toCSV(rows), 'text/csv'); this.sim.bus.emit('export:done', { kind: 'csv' }); }
  }

  async debrief(spec, key) {
    const sim = this.sim;
    sim.bus.emit('debrief:shown', { paradigm: spec.id });
    const del = await modal({
      title: 'Debriefing — ' + spec.title,
      body: `<p><b>What really happened.</b> ${spec.debrief.deception}</p><p><b>Why.</b> ${spec.debrief.purpose}</p><p><b>Safeguards.</b> ${spec.debrief.safeguards || 'Deception in research is permitted only when the question cannot be answered otherwise, the risk is minimal, and participants are debriefed promptly (APA Ethics Code 8.07, 8.08).'}</p><p>You may withdraw your data now. Either choice is fine.</p>`,
      actions: [{ label: 'Delete my data from this run', value: true, cls: 'ghost' }, { label: 'Keep my data', value: false }],
      dismissable: false,
    });
    if (del) { delete sim.datasets[key]; toast('Data deleted.'); }
    sim.addXP(20, 'Debriefed');
  }

  /** Opt-out path: equivalent text-and-quiz content (progress not blocked). */
  async altPath(spec) {
    const sim = this.sim;
    const qs = sim.data.quiz.filter((q) => q.week === spec.week).slice(0, 3);
    const body = h('div', null, h('p', { html: spec.textAlternative || spec.purpose || '' }));
    qs.forEach((q, i) => body.appendChild(h('div', { class: 'card' }, h('p', null, h('b', null, `${i + 1}. `), q.q), h('p', { class: 'note' }, 'Answer: ' + q.options[q.answer] + ' — ' + q.explain))));
    await modal({ title: spec.title + ' — text-and-quiz path', body, actions: [{ label: 'Mark as studied', value: true }] });
    sim.bus.emit('exp:complete', { paradigm: spec.id, rows: 0, alt: true });
    sim.addXP(40, 'Studied ' + spec.title);
  }

  /** G13 harness: N bot trials of a simple-onset task; returns timing summary. */
  async timingTest(n = 500, paradigm = 'stroop') {
    const res = await this.run(paradigm, { bot: true, trials: n, timeScale: 0.1, silent: true });
    return Object.assign({ frameMs: this.frameMs }, res.timing, { rows: res.rows.length });
  }
}

module.exports = { Runner };
