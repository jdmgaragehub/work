'use strict';
/**
 * Hand-written SVG charts (§8): histogram, boxplot, scatter (+regression), line (multi-series),
 * bar (grouped, with error bars), ROC, cumulative record, serial-position curve, hypnogram, forest plot.
 * Okabe–Ito colour-blind-safe palette. Every chart has role="img" + aria-label + <title>.
 */
const OI = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7', '#999999'];
const NS = 'http://www.w3.org/2000/svg';
const e = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function frame(W, H, label, inner) {
  const d = document.createElement('div');
  d.innerHTML = `<svg xmlns="${NS}" class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${e(label)}"><title>${e(label)}</title>${inner}</svg>`;
  return d.firstChild;
}
function nice(lo, hi) { if (lo === hi) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.06; return [lo - pad, hi + pad]; }
function ticks(lo, hi, n = 5) { const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n))); const err = (hi - lo) / n / step; const s = step * (err >= 7.5 ? 10 : err >= 3.5 ? 5 : err >= 1.5 ? 2 : 1); const out = []; for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(+v.toFixed(10)); return out; }
const fmt = (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 10 ? +v.toFixed(1) : +v.toFixed(2));

function axes(W, H, m, xr, yr, xl, yl, { xt, yt, xcat } = {}) {
  const sx = (v) => m.l + ((v - xr[0]) / (xr[1] - xr[0])) * (W - m.l - m.r);
  const sy = (v) => H - m.b - ((v - yr[0]) / (yr[1] - yr[0])) * (H - m.t - m.b);
  let s = `<g stroke="rgba(226,232,240,.35)" stroke-width="1"><line x1="${m.l}" y1="${H - m.b}" x2="${W - m.r}" y2="${H - m.b}"/><line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${H - m.b}"/></g>`;
  for (const v of yt || ticks(yr[0], yr[1])) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${sy(v)}" y2="${sy(v)}" stroke="rgba(226,232,240,.08)"/><text x="${m.l - 5}" y="${sy(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  if (xcat) xcat.forEach((c, i) => { s += `<text x="${sx(i)}" y="${H - m.b + 15}" text-anchor="middle">${e(c)}</text>`; });
  else for (const v of xt || ticks(xr[0], xr[1])) s += `<text x="${sx(v)}" y="${H - m.b + 15}" text-anchor="middle">${fmt(v)}</text>`;
  if (xl) s += `<text x="${(W + m.l - m.r) / 2}" y="${H - 4}" text-anchor="middle">${e(xl)}</text>`;
  if (yl) s += `<text transform="translate(12 ${(H - m.b + m.t) / 2}) rotate(-90)" text-anchor="middle">${e(yl)}</text>`;
  return { s, sx, sy };
}
const M = { l: 52, r: 14, t: 16, b: 38 };

function histogram(values, { bins = 12, label = 'Histogram', xl = '', W = 520, H = 240, color = OI[1], normal = false } = {}) {
  const lo = Math.min(...values), hi = Math.max(...values), w = (hi - lo) / bins || 1;
  const c = new Array(bins).fill(0); for (const v of values) c[Math.min(bins - 1, Math.floor((v - lo) / w))]++;
  const ymax = Math.max(...c) * 1.1;
  const a = axes(W, H, M, [lo, hi], [0, ymax], xl, 'count');
  let s = a.s;
  c.forEach((n, i) => { const x0 = a.sx(lo + i * w), x1 = a.sx(lo + (i + 1) * w); s += `<rect x="${x0 + 1}" y="${a.sy(n)}" width="${Math.max(1, x1 - x0 - 2)}" height="${a.sy(0) - a.sy(n)}" fill="${color}" opacity=".85"/>`; });
  if (normal && values.length > 2) {
    const m = values.reduce((p, q) => p + q, 0) / values.length; const sd = Math.sqrt(values.reduce((p, q) => p + (q - m) ** 2, 0) / (values.length - 1));
    let d = ''; for (let i = 0; i <= 60; i++) { const x = lo + (hi - lo) * i / 60; const y = values.length * w * Math.exp(-0.5 * ((x - m) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI)); d += (i ? 'L' : 'M') + a.sx(x) + ' ' + a.sy(y); }
    s += `<path d="${d}" fill="none" stroke="${OI[0]}" stroke-width="2"/>`;
  }
  return frame(W, H, label, s);
}

function scatter(xs, ys, { label = 'Scatter plot', xl = '', yl = '', W = 520, H = 260, line = null, groups = null } = {}) {
  const xr = nice(Math.min(...xs), Math.max(...xs)), yr = nice(Math.min(...ys), Math.max(...ys));
  const a = axes(W, H, M, xr, yr, xl, yl);
  let s = a.s;
  xs.forEach((x, i) => { s += `<circle cx="${a.sx(x)}" cy="${a.sy(ys[i])}" r="3.5" fill="${OI[groups ? groups[i] % 8 : 4]}" opacity=".85"/>`; });
  if (line) s += `<line x1="${a.sx(xr[0])}" y1="${a.sy(line.a + line.b * xr[0])}" x2="${a.sx(xr[1])}" y2="${a.sy(line.a + line.b * xr[1])}" stroke="${OI[5]}" stroke-width="2.2"/>`;
  return frame(W, H, label, s);
}

/** series: [{name, points:[{x,y}], color?, dash?}] */
function line(series, { label = 'Line chart', xl = '', yl = '', W = 520, H = 260, yr = null, xr = null, step = false, legend = true } = {}) {
  const all = series.flatMap((s) => s.points);
  if (!all.length) return frame(W, H, label, '<text x="20" y="30">No data yet</text>');
  const XR = xr || nice(Math.min(...all.map((p) => p.x)), Math.max(...all.map((p) => p.x)));
  const YR = yr || nice(Math.min(...all.map((p) => p.y)), Math.max(...all.map((p) => p.y)));
  const a = axes(W, H, M, XR, YR, xl, yl);
  let s = a.s;
  series.forEach((ser, k) => {
    const col = ser.color || OI[k % 8];
    let d = '';
    ser.points.forEach((p, i) => {
      if (step && i) d += `L${a.sx(p.x)} ${a.sy(ser.points[i - 1].y)}`;
      d += (i ? 'L' : 'M') + a.sx(p.x) + ' ' + a.sy(p.y);
    });
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.2" ${ser.dash ? 'stroke-dasharray="6 4"' : ''}/>`;
    if (ser.dots) ser.points.forEach((p) => { s += `<circle cx="${a.sx(p.x)}" cy="${a.sy(p.y)}" r="3" fill="${col}"/>`; });
    if (legend && series.length > 1) s += `<rect x="${W - M.r - 150}" y="${M.t + k * 15}" width="10" height="10" fill="${col}"/><text x="${W - M.r - 136}" y="${M.t + 9 + k * 15}">${e(ser.name)}</text>`;
  });
  return frame(W, H, label, s);
}

/** groups: [{name, value, err?}] */
function bar(groups, { label = 'Bar chart', yl = '', W = 520, H = 250, yr = null, colors = null } = {}) {
  const top = Math.max(...groups.map((g) => g.value + (g.err || 0)), 0);
  const bot = Math.min(...groups.map((g) => g.value - (g.err || 0)), 0);
  const YR = yr || [bot * 1.1, top * 1.12 || 1];
  const a = axes(W, H, M, [-0.5, groups.length - 0.5], YR, '', yl, { xcat: groups.map((g) => g.name) });
  let s = a.s;
  const bw = ((W - M.l - M.r) / groups.length) * 0.6;
  groups.forEach((g, i) => {
    const x = a.sx(i) - bw / 2, y0 = a.sy(0), y1 = a.sy(g.value);
    s += `<rect x="${x}" y="${Math.min(y0, y1)}" width="${bw}" height="${Math.abs(y1 - y0)}" fill="${(colors && colors[i]) || OI[i % 8]}"/>`;
    s += `<text x="${a.sx(i)}" y="${Math.min(y0, y1) - 4}" text-anchor="middle">${fmt(g.value)}</text>`;
    if (g.err) s += `<line x1="${a.sx(i)}" x2="${a.sx(i)}" y1="${a.sy(g.value - g.err)}" y2="${a.sy(g.value + g.err)}" stroke="#fff" stroke-width="1.5"/>`;
  });
  return frame(W, H, label, s);
}

function boxplot(groups, { label = 'Boxplot', yl = '', W = 520, H = 250 } = {}) {
  const q = (xs, p) => { const s = xs.slice().sort((x, y) => x - y); const hh = (s.length - 1) * p; const lo = Math.floor(hh); return s[lo] + (hh - lo) * ((s[Math.ceil(hh)]) - s[lo]); };
  const all = groups.flatMap((g) => g.values);
  const a = axes(W, H, M, [-0.5, groups.length - 0.5], nice(Math.min(...all), Math.max(...all)), '', yl, { xcat: groups.map((g) => g.name) });
  let s = a.s;
  const bw = ((W - M.l - M.r) / groups.length) * 0.4;
  groups.forEach((g, i) => {
    const q1 = q(g.values, 0.25), md = q(g.values, 0.5), q3 = q(g.values, 0.75), iqr = q3 - q1;
    const inn = g.values.filter((v) => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    const lo = Math.min(...inn), hi = Math.max(...inn), x = a.sx(i), col = OI[i % 8];
    s += `<line x1="${x}" x2="${x}" y1="${a.sy(lo)}" y2="${a.sy(hi)}" stroke="${col}"/><rect x="${x - bw / 2}" y="${a.sy(q3)}" width="${bw}" height="${a.sy(q1) - a.sy(q3)}" fill="${col}" fill-opacity=".35" stroke="${col}"/><line x1="${x - bw / 2}" x2="${x + bw / 2}" y1="${a.sy(md)}" y2="${a.sy(md)}" stroke="#fff" stroke-width="2"/>`;
    for (const v of g.values) if (v < lo || v > hi) s += `<circle cx="${x}" cy="${a.sy(v)}" r="3" fill="none" stroke="${col}"/>`;
  });
  return frame(W, H, label, s);
}

function roc(points, { label = 'ROC curve', W = 300, H = 300, empirical = [] } = {}) {
  const a = axes(W, H, { l: 44, r: 12, t: 12, b: 38 }, [0, 1], [0, 1], 'False-alarm rate', 'Hit rate', { xt: [0, 0.5, 1], yt: [0, 0.5, 1] });
  let s = a.s + `<line x1="${a.sx(0)}" y1="${a.sy(0)}" x2="${a.sx(1)}" y2="${a.sy(1)}" stroke="#999" stroke-dasharray="4 4"/>`;
  s += `<path d="${points.map((p, i) => (i ? 'L' : 'M') + a.sx(p.FA) + ' ' + a.sy(p.H)).join('')}" fill="none" stroke="${OI[0]}" stroke-width="2.2"/>`;
  for (const p of empirical) s += `<circle cx="${a.sx(p.FA)}" cy="${a.sy(p.H)}" r="5" fill="${OI[2]}"><title>${e(p.name || '')}</title></circle>`;
  return frame(W, H, label, s);
}

function cumulative(record, reinforcers, { label = 'Cumulative record', W = 520, H = 240 } = {}) {
  const pts = record.map((r) => ({ x: r.t, y: r.count }));
  const svg = line([{ name: 'responses', points: pts, color: OI[1] }], { label, xl: 'time (s)', yl: 'cumulative responses', W, H, step: true });
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const xr = nice(Math.min(...xs), Math.max(...xs)), yr = nice(Math.min(...ys), Math.max(...ys));
  const sx = (v) => M.l + ((v - xr[0]) / (xr[1] - xr[0])) * (W - M.l - M.r), sy = (v) => H - M.b - ((v - yr[0]) / (yr[1] - yr[0])) * (H - M.t - M.b);
  let ticksS = '';
  for (const r of reinforcers) ticksS += `<line x1="${sx(r.t)}" x2="${sx(r.t) + 5}" y1="${sy(r.count)}" y2="${sy(r.count) + 6}" stroke="${OI[5]}" stroke-width="2"/>`;
  svg.insertAdjacentHTML('beforeend', ticksS);
  return svg;
}

function serialPosition(pct, { label = 'Serial-position curve', W = 520, H = 240 } = {}) {
  return line([{ name: '% recalled', points: pct.map((y, i) => ({ x: i + 1, y })), dots: true }], { label, xl: 'serial position', yl: '% recalled', W, H, yr: [0, 100] });
}

/** stages: array of 'W','REM','N1','N2','N3' per epoch */
function hypnogram(stages, { label = 'Hypnogram (simulated EEG)', W = 520, H = 200, epochMin = 0.5 } = {}) {
  const lv = { W: 4, REM: 3, N1: 2, N2: 1, N3: 0 };
  const names = ['N3', 'N2', 'N1', 'REM', 'W'];
  const a = axes(W, H, { l: 46, r: 12, t: 12, b: 34 }, [0, stages.length * epochMin / 60], [-0.3, 4.3], 'hours', '', { yt: [] });
  let s = a.s;
  names.forEach((n, i) => { s += `<text x="40" y="${a.sy(i) + 4}" text-anchor="end">${n}</text>`; });
  let d = '';
  stages.forEach((st, i) => { const x0 = a.sx(i * epochMin / 60), x1 = a.sx((i + 1) * epochMin / 60), y = a.sy(lv[st]); d += (i ? 'L' : 'M') + x0 + ' ' + y + 'L' + x1 + ' ' + y; });
  s += `<path d="${d}" fill="none" stroke="${OI[1]}" stroke-width="2"/>`;
  stages.forEach((st, i) => { if (st === 'REM') s += `<rect x="${a.sx(i * epochMin / 60)}" y="${a.sy(3) - 3}" width="${a.sx((i + 1) * epochMin / 60) - a.sx(i * epochMin / 60)}" height="6" fill="${OI[5]}"/>`; });
  return frame(W, H, label, s);
}

/** rows: [{name, est, lo, hi, color?}] ; ref line at 0 */
function forest(rows, { label = 'Forest plot', xl = 'effect size (d)', W = 520, H = null } = {}) {
  const HH = H || 40 + rows.length * 26;
  const lo = Math.min(0, ...rows.map((r) => r.lo)), hi = Math.max(0, ...rows.map((r) => r.hi));
  const m = { l: 170, r: 16, t: 10, b: 34 };
  const sx = (v) => m.l + ((v - lo) / (hi - lo || 1)) * (W - m.l - m.r);
  let s = `<line x1="${sx(0)}" x2="${sx(0)}" y1="${m.t}" y2="${HH - m.b}" stroke="#999" stroke-dasharray="4 4"/>`;
  rows.forEach((r, i) => {
    const y = m.t + 14 + i * 26, col = r.color || OI[i % 8];
    s += `<text x="${m.l - 8}" y="${y + 4}" text-anchor="end">${e(r.name)}</text><line x1="${sx(r.lo)}" x2="${sx(r.hi)}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="2"/><rect x="${sx(r.est) - 5}" y="${y - 5}" width="10" height="10" fill="${col}"/>`;
  });
  for (const v of ticks(lo, hi, 5)) s += `<text x="${sx(v)}" y="${HH - m.b + 15}" text-anchor="middle">${fmt(v)}</text>`;
  s += `<text x="${(W + m.l) / 2}" y="${HH - 4}" text-anchor="middle">${e(xl)}</text>`;
  return frame(W, HH, label, s);
}

/** Tiny trace (EEG / membrane potential) */
function trace(points, { label = 'Trace', W = 520, H = 160, xl = 'ms', yl = 'mV', color = OI[2], yr = null } = {}) {
  return line([{ name: label, points, color }], { label, xl, yl, W, H, yr, legend: false });
}

module.exports = { OI, histogram, scatter, line, bar, boxplot, roc, cumulative, serialPosition, hypnogram, forest, trace };
