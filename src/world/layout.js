'use strict';
/**
 * Campus layout (A0/A2). Y-up, metres. The Central Courtyard (60 × 60 m) sits at the origin;
 * nine zone buildings ring it at radius 78 m. Each zone owns a 40 × 40 m footprint centred on `center`
 * with its entrance facing the courtyard. `yaw` = direction the entrance faces (radians, 0 = +Z).
 */
const R = 78;
const ORDER = ['wundt', 'explab', 'neuro', 'sleep', 'learning', 'childdev', 'clinic', 'mohalla', 'library'];
const NAMES = {
  courtyard: ['Central Courtyard', 'مرکزی صحن'], wundt: ['Wundt Hall', 'ونڈٹ ہال'], explab: ['Experimental Lab Wing', 'تجرباتی لیب'],
  neuro: ['Neuro Atrium', 'نیورو ایٹریم'], sleep: ['Sleep & Consciousness Lab', 'نیند لیب'], learning: ['Learning Lab', 'سیکھنے کی لیب'],
  childdev: ['Child Development Suite', 'بچوں کی نشوونما'], clinic: ['Counselling & Clinic Centre', 'کلینک'], mohalla: ['Social Psychology Plaza — Mohalla', 'محلہ'],
  library: ['Methods & Stats Library', 'لائبریری'],
};
const ZONES = { courtyard: { id: 'courtyard', center: [0, 0, 0], yaw: 0, size: 60 } };
ORDER.forEach((id, i) => {
  const a = (i / ORDER.length) * Math.PI * 2; // wundt at north (−Z)
  const x = Math.sin(a) * R, z = -Math.cos(a) * R;
  ZONES[id] = { id, center: [x, 0, z], yaw: Math.atan2(-x, -z), size: 40 };
});
for (const id of Object.keys(ZONES)) { ZONES[id].name = NAMES[id][0]; ZONES[id].ur = NAMES[id][1]; }
/** Entry point: 24 m from centre toward the courtyard, facing the building. */
function entry(id) {
  const z = ZONES[id];
  if (id === 'courtyard') return { pos: [5, 1.65, 24], yaw: 0.2 };
  const [x, , zz] = z.center; const len = Math.hypot(x, zz);
  return { pos: [x - (x / len) * 24, 1.65, zz - (zz / len) * 24], yaw: Math.atan2(x, zz) + Math.PI };
}
function zoneAt(x, z) {
  let best = 'courtyard', bd = 34;
  for (const id of ORDER) { const c = ZONES[id].center; const d = Math.max(Math.abs(x - c[0]), Math.abs(z - c[2])); if (d < 26 && d < bd) { bd = d; best = id; } }
  return Math.max(Math.abs(x), Math.abs(z)) < 34 ? 'courtyard' : best;
}
module.exports = { ZONES, ORDER, NAMES, entry, zoneAt, RING_RADIUS: R };
