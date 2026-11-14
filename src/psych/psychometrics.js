'use strict';
/**
 * Psychometrics (Panel 23 / paradigm ipip_big5). Pure.
 *  Spearman–Brown  r′ = k·r / [1+(k−1)·r]
 *  Cronbach's α    α = [k/(k−1)]·[1 − Σσᵢ²/σ²ₓ]   (sample variances, matches R psych::alpha raw_alpha)
 *  Cohen's κ       κ = (pₒ − pₑ)/(1 − pₑ)
 *  SEM             SD·√(1−rₓₓ)
 */
const S = require('./stats.js');

function spearmanBrown(r, k) { return (k * r) / (1 + (k - 1) * r); }
/** Inverse: length factor needed to reach target reliability. */
function spearmanBrownK(r, target) { return (target * (1 - r)) / (r * (1 - target)); }

/** items: array of respondents, each an array of k item scores. */
function cronbachAlpha(matrix) {
  const k = matrix[0].length;
  let sumItemVar = 0;
  for (let j = 0; j < k; j++) sumItemVar += S.variance(matrix.map((row) => row[j]));
  const totals = matrix.map((row) => S.sum(row));
  const vt = S.variance(totals);
  return (k / (k - 1)) * (1 - sumItemVar / vt);
}

/** Alpha-if-item-deleted and corrected item–total correlations. */
function itemAnalysis(matrix) {
  const k = matrix[0].length;
  const out = [];
  for (let j = 0; j < k; j++) {
    const reduced = matrix.map((row) => row.filter((_, i) => i !== j));
    const rest = reduced.map((row) => S.sum(row));
    const item = matrix.map((row) => row[j]);
    out.push({ item: j, mean: S.mean(item), sd: S.sd(item), alphaIfDeleted: cronbachAlpha(reduced), rItemRest: S.pearson(item, rest).r });
  }
  return out;
}

/** Split-half (odd/even) with Spearman–Brown correction. */
function splitHalf(matrix) {
  const odd = matrix.map((row) => S.sum(row.filter((_, i) => i % 2 === 0)));
  const even = matrix.map((row) => S.sum(row.filter((_, i) => i % 2 === 1)));
  const r = S.pearson(odd, even).r;
  return { rHalf: r, rSB: spearmanBrown(r, 2) };
}

/** Cohen's κ from po/pe or from a square agreement table. */
function cohenKappa(po, pe) { return (po - pe) / (1 - pe); }
function kappaFromTable(table) {
  const k = table.length;
  const N = table.flat().reduce((a, b) => a + b, 0);
  let agree = 0;
  for (let i = 0; i < k; i++) agree += table[i][i];
  const po = agree / N;
  let pe = 0;
  for (let i = 0; i < k; i++) {
    const row = table[i].reduce((a, b) => a + b, 0);
    const col = table.reduce((a, r) => a + r[i], 0);
    pe += (row / N) * (col / N);
  }
  return { po, pe, kappa: cohenKappa(po, pe) };
}

/** Score IPIP Likert (1–5) responses; reverse-keyed items scored 6 − x. */
function scoreIPIP(items, responses) {
  const scales = {};
  items.forEach((it, i) => {
    const raw = responses[i];
    if (raw == null) return;
    const v = it.keyed === '-' ? 6 - raw : raw;
    (scales[it.scale] = scales[it.scale] || []).push(v);
  });
  const out = {};
  for (const k of Object.keys(scales)) out[k] = { sum: S.sum(scales[k]), mean: S.mean(scales[k]), n: scales[k].length };
  return out;
}

module.exports = { spearmanBrown, spearmanBrownK, cronbachAlpha, itemAnalysis, splitHalf, cohenKappa, kappaFromTable, scoreIPIP, sem: S.semMeasurement };
