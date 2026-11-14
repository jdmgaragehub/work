'use strict';
/**
 * APA-7 number formatting (pure). Rules: statistics italicised by the UI (we return
 * plain text + an html variant); p reported exact to 3 decimals, "< .001" below; no leading
 * zero for quantities that cannot exceed 1 (p, r, α, η², power); df shown in parentheses.
 */
const noLead = (v, dp = 2) => { const s = Math.abs(v).toFixed(dp).replace(/^0\./, '.'); return (v < 0 ? '−' : '') + s; };
const num = (v, dp = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(dp);
function p(v) { if (v < 0.001) return '< .001'; return '= ' + noLead(v, 3); }
const dfStr = (df) => (Number.isInteger(df) ? String(df) : df.toFixed(2));
const apa = {
  t: (r) => `t(${dfStr(r.df)}) = ${num(r.t)}, p ${p(r.p)}` + (r.d != null ? `, d = ${num(r.d)}` : r.dz != null ? `, dz = ${num(r.dz)}` : ''),
  F: (r) => `F(${r.dfb}, ${r.dfw}) = ${num(r.F)}, p ${p(r.p)}, η² = ${noLead(r.eta2)}`,
  r: (r) => `r(${r.df}) = ${noLead(r.r)}, p ${p(r.p)}`,
  chi2: (r) => `χ²(${r.df}${r.N ? ', N = ' + r.N : ''}) = ${num(r.chi2)}, p ${p(r.p)}`,
  mean: (m, sd) => `M = ${num(m)}, SD = ${num(sd)}`,
  alpha: (a) => `α = ${noLead(a)}`,
  dprime: (d, c) => `d′ = ${num(d)}, c = ${num(c)}`,
  p, num, noLead,
};
/** Wrap statistic symbols in <i> for HTML display. */
function italicise(s) { return s.replace(/\b(t|F|r|p|d|dz|M|SD|N|n)(?=[\s(=<])/g, '<i>$1</i>').replace(/χ²/g, '<i>χ</i>²'); }
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
module.exports = { apa, italicise, esc, num, noLead };
