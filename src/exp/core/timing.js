'use strict';
/**
 * Timing-quality statistics (Gate G13). Pure.
 * Given rows with onset_req / onset_actual and the measured frame duration,
 * report median and 95th-percentile onset error (ms and frames), RT resolution,
 * and a histogram for docs/TEST_REPORT.md.
 */
const S = require('../../psych/stats.js');

function onsetErrors(rows) {
  return rows.filter((r) => r.onset_req !== '' && r.onset_actual !== '').map((r) => Number(r.onset_actual) - Number(r.onset_req));
}

/** Smallest positive difference among timestamps → empirical resolution. */
function resolution(values) {
  const v = Array.from(new Set(values.map(Number).filter(Number.isFinite))).sort((a, b) => a - b);
  let best = Infinity;
  for (let i = 1; i < v.length; i++) { const d = v[i] - v[i - 1]; if (d > 1e-9 && d < best) best = d; }
  return best;
}

function summarise(rows, frameMs) {
  const errs = onsetErrors(rows).map(Math.abs);
  if (!errs.length) return null;
  const med = S.median(errs), p95 = S.quantile(errs, 0.95);
  const hist = S.histogram(errs.map((e) => e / frameMs), 8, 0, 2);
  return {
    n: errs.length, frameMs,
    medianMs: med, p95Ms: p95, maxMs: Math.max(...errs),
    medianFrames: med / frameMs, p95Frames: p95 / frameMs,
    rtResolutionMs: resolution(rows.map((r) => r.rt_ms).filter((v) => v !== '')),
    pass: med / frameMs <= 1 && p95 / frameMs <= 2,
    histogram: hist,
  };
}

/** Estimate refresh interval from rAF timestamps (median diff). */
function frameDuration(stamps) {
  const d = [];
  for (let i = 1; i < stamps.length; i++) d.push(stamps[i] - stamps[i - 1]);
  return d.length ? S.median(d) : 16.67;
}

module.exports = { onsetErrors, resolution, summarise, frameDuration };
