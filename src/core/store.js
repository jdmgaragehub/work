'use strict';
/** Local persistence (G9). localStorage only; every access wrapped — the game runs without it. */
const KEY = 'zehn.save.v1';
function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
function save(snapshot) { return safe(() => { localStorage.setItem(KEY, JSON.stringify(snapshot)); return true; }, false); }
function load() { return safe(() => JSON.parse(localStorage.getItem(KEY) || 'null'), null); }
function clear() { return safe(() => { localStorage.removeItem(KEY); return true; }, false); }
function getPref(k, d) { return safe(() => { const v = localStorage.getItem('zehn.pref.' + k); return v == null ? d : JSON.parse(v); }, d); }
function setPref(k, v) { return safe(() => { localStorage.setItem('zehn.pref.' + k, JSON.stringify(v)); return true; }, false); }
module.exports = { save, load, clear, getPref, setPref, KEY };
