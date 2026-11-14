'use strict';
/**
 * Neuron simulators (Panel 7, Neuro Atrium neuron bridge). Pure.
 *
 * Leaky integrate-and-fire:
 *   τₘ·dV/dt = −(V − V_rest) + R·I;  spike when V ≥ V_th → V_reset; absolute refractory period.
 *
 * Hodgkin–Huxley (1952), modern convention (rest ≈ −65 mV):
 *   C·dV/dt = I − ḡNa·m³h(V−E_Na) − ḡK·n⁴(V−E_K) − ḡL(V−E_L)
 *   C = 1 µF/cm², ḡNa = 120, ḡK = 36, ḡL = 0.3 mS/cm², E_Na = 50, E_K = −77, E_L = −54.4 mV
 *   RK4, dt ≤ 0.025 ms.
 */

function lif({ I = 2, ms = 200, dt = 0.1, tau = 10, R = 10, vRest = -65, vTh = -50, vReset = -70, refractory = 2 } = {}) {
  let V = vRest, ref = 0;
  const trace = [], spikes = [];
  for (let t = 0; t <= ms; t += dt) {
    if (ref > 0) { ref -= dt; V = vReset; } else {
      V += (dt / tau) * (-(V - vRest) + R * I);
      if (V >= vTh) { spikes.push(t); trace.push({ t, V: 30 }); V = vReset; ref = refractory; continue; }
    }
    trace.push({ t, V });
  }
  return { trace, spikes, rate: (spikes.length / ms) * 1000 };
}

function fiCurve(model, currents, opts = {}) {
  return currents.map((I) => ({ I, rate: (model === 'hh' ? hh(Object.assign({}, opts, { I })) : lif(Object.assign({}, opts, { I }))).rate }));
}

const HH = { C: 1, gNa: 120, gK: 36, gL: 0.3, ENa: 50, EK: -77, EL: -54.4 };

function rates(V) {
  const am = Math.abs(V + 40) < 1e-7 ? 1 : (0.1 * (V + 40)) / (1 - Math.exp(-(V + 40) / 10));
  const bm = 4 * Math.exp(-(V + 65) / 18);
  const ah = 0.07 * Math.exp(-(V + 65) / 20);
  const bh = 1 / (1 + Math.exp(-(V + 35) / 10));
  const an = Math.abs(V + 55) < 1e-7 ? 0.1 : (0.01 * (V + 55)) / (1 - Math.exp(-(V + 55) / 10));
  const bn = 0.125 * Math.exp(-(V + 65) / 80);
  return { am, bm, ah, bh, an, bn };
}

function derivs(s, I, p) {
  const [V, m, h, n] = s;
  const r = rates(V);
  const INa = p.gNa * m * m * m * h * (V - p.ENa);
  const IK = p.gK * n * n * n * n * (V - p.EK);
  const IL = p.gL * (V - p.EL);
  return [(I - INa - IK - IL) / p.C, r.am * (1 - m) - r.bm * m, r.ah * (1 - h) - r.bh * h, r.an * (1 - n) - r.bn * n];
}

function steady(V) {
  const r = rates(V);
  return [V, r.am / (r.am + r.bm), r.ah / (r.ah + r.bh), r.an / (r.an + r.bn)];
}

/**
 * Hodgkin–Huxley with RK4. `I` may be a number (DC, µA/cm²) or function(t).
 * Spikes counted on upward crossing of 0 mV. Rate computed after `settle` ms.
 */
function hh({ I = 10, ms = 200, dt = 0.025, settle = 50, params = {}, record = true } = {}) {
  const p = Object.assign({}, HH, params);
  let s = steady(-65);
  const trace = [], spikes = [];
  const iFn = typeof I === 'function' ? I : () => I;
  let prevV = s[0];
  for (let t = 0; t <= ms; t += dt) {
    const i0 = iFn(t);
    const k1 = derivs(s, i0, p);
    const s2 = s.map((v, j) => v + (dt / 2) * k1[j]);
    const k2 = derivs(s2, iFn(t + dt / 2), p);
    const s3 = s.map((v, j) => v + (dt / 2) * k2[j]);
    const k3 = derivs(s3, iFn(t + dt / 2), p);
    const s4 = s.map((v, j) => v + dt * k3[j]);
    const k4 = derivs(s4, iFn(t + dt), p);
    s = s.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
    if (prevV < 0 && s[0] >= 0) spikes.push(t);
    prevV = s[0];
    if (record && Math.round(t / dt) % 4 === 0) trace.push({ t, V: s[0], m: s[1], h: s[2], n: s[3] });
  }
  const late = spikes.filter((t) => t >= settle);
  return { trace, spikes, rate: (late.length / (ms - settle)) * 1000 };
}

/** Lowest DC current (µA/cm²) producing repetitive firing, by bisection. */
function hhRheobase({ lo = 0, hi = 20, ms = 300 } = {}) {
  const fires = (I) => hh({ I, ms, record: false }).spikes.filter((t) => t > 100).length >= 2;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (fires(mid)) hi = mid; else lo = mid; }
  return hi;
}

module.exports = { lif, hh, fiCurve, hhRheobase, HH, steady };
