'use strict';
/**
 * Procedural 2D FACS face (A4) for canvas stimuli, clinic portraits and Asch confederates.
 * Original drawing — not derived from any photographic set. Action units (Ekman & Friesen 1978, FACS):
 *  1 inner brow raiser · 2 outer brow raiser · 4 brow lowerer · 5 upper lid raiser · 6 cheek raiser
 *  7 lid tightener · 9 nose wrinkler · 10 upper lip raiser · 12 lip corner puller · 15 lip corner depressor
 *  17 chin raiser · 20 lip stretcher · 23 lip tightener · 25 lips part · 26 jaw drop · 43 eyes closed
 * plus gaze {x,y} in −1..1 and viseme (A, E, O, U, M, F, rest) for lip-sync.
 */
const AUS = [1, 2, 4, 5, 6, 7, 9, 10, 12, 15, 17, 20, 23, 25, 26, 43];
const AU_NAMES = { 1: 'Inner brow raiser', 2: 'Outer brow raiser', 4: 'Brow lowerer', 5: 'Upper lid raiser', 6: 'Cheek raiser', 7: 'Lid tightener', 9: 'Nose wrinkler', 10: 'Upper lip raiser', 12: 'Lip corner puller', 15: 'Lip corner depressor', 17: 'Chin raiser', 20: 'Lip stretcher', 23: 'Lip tightener', 25: 'Lips part', 26: 'Jaw drop', 43: 'Eyes closed' };

/** Prototypical AU combinations for basic emotions (EMFACS-style prototypes, intensities illustrative). */
const EMOTIONS = {
  neutral: {},
  happiness: { 6: 0.8, 12: 1, 25: 0.3 },
  sadness: { 1: 0.9, 4: 0.6, 15: 0.9, 17: 0.4 },
  surprise: { 1: 1, 2: 1, 5: 0.9, 25: 0.6, 26: 0.9 },
  fear: { 1: 0.9, 2: 0.6, 4: 0.6, 5: 1, 7: 0.3, 20: 0.9, 25: 0.6, 26: 0.3 },
  anger: { 4: 1, 5: 0.6, 7: 0.9, 23: 1, 17: 0.4 },
  disgust: { 9: 1, 10: 0.8, 15: 0.5, 17: 0.5, 4: 0.3 },
  contempt: { 12: 0.5, 14: 0.6, unilateral: 1 },
};
const VISEMES = { rest: { 25: 0, 26: 0 }, A: { 25: 1, 26: 0.8 }, E: { 25: 0.8, 20: 0.6, 26: 0.3 }, O: { 25: 0.8, 26: 0.6, 23: 0.5 }, U: { 25: 0.4, 23: 0.9 }, M: { 23: 0.6, 25: 0 }, F: { 25: 0.3, 10: 0.4 } };

const SKIN = ['#8d5524', '#a0662b', '#b97a45', '#c68642', '#d6a06b', '#e0ac69', '#7a4a22', '#5c3a1e'];
const HAIR = ['#1b1410', '#2a1c14', '#3b2a1e', '#4a4a4a', '#6b6b6b'];

function mix(aus, extra) { const o = Object.assign({}, aus); for (const k in extra) o[k] = Math.max(o[k] || 0, extra[k]); return o; }

/**
 * Draw a face centred at (x,y) with height `size`.
 * opts: {skin, hair, hijab, cap, beard, gaze:{x,y}, blink:0..1, viseme, label, glasses, age}
 */
function drawFace(ctx, x, y, size, aus = {}, opts = {}) {
  const a = (k) => Math.max(0, Math.min(1, aus[k] || 0));
  const s = size / 200;
  const skin = opts.skin || SKIN[2];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // shoulders
  ctx.fillStyle = opts.shirt || '#0F766E';
  ctx.beginPath(); ctx.ellipse(0, 125, 92, 40, 0, Math.PI, 0); ctx.fill();
  // neck
  ctx.fillStyle = shade(skin, -0.12); ctx.fillRect(-20, 55, 40, 40);
  // hijab back / hair back
  if (opts.hijab) { ctx.fillStyle = opts.hijab; ctx.beginPath(); ctx.ellipse(0, 0, 80, 98, 0, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.moveTo(-78, 20); ctx.quadraticCurveTo(0, 150, 78, 20); ctx.fill(); }
  else { ctx.fillStyle = opts.hair || HAIR[0]; ctx.beginPath(); ctx.ellipse(0, -18, 70, 76, 0, Math.PI, 0); ctx.fill(); }
  // head
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.ellipse(0, 4, 62, 80 + a(26) * 6, 0, 0, Math.PI * 2); ctx.fill();
  // ears
  ctx.beginPath(); ctx.ellipse(-62, 6, 9, 16, 0, 0, Math.PI * 2); ctx.ellipse(62, 6, 9, 16, 0, 0, Math.PI * 2); ctx.fill();
  // hair front
  if (!opts.hijab) {
    ctx.fillStyle = opts.hair || HAIR[0];
    ctx.beginPath(); ctx.moveTo(-64, -10); ctx.quadraticCurveTo(-60, -84, 0, -80); ctx.quadraticCurveTo(60, -84, 64, -10); ctx.quadraticCurveTo(30, -58, -64, -10); ctx.fill();
  } else { ctx.fillStyle = opts.hijab; ctx.beginPath(); ctx.ellipse(0, -46, 66, 40, 0, Math.PI, 0); ctx.fill(); }
  if (opts.cap) { ctx.fillStyle = opts.cap; ctx.beginPath(); ctx.ellipse(0, -60, 58, 26, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(-58, -62, 116, 8); }
  // cheeks (AU6) blush
  if (a(6) > 0.05) { ctx.fillStyle = `rgba(200,80,80,${0.18 * a(6)})`; ctx.beginPath(); ctx.ellipse(-34, 22, 14, 8, 0, 0, Math.PI * 2); ctx.ellipse(34, 22, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); }
  // eyes
  const blink = Math.max(a(43), opts.blink || 0);
  const open = Math.max(0.05, (1 - blink) * (1 + 0.45 * a(5) - 0.45 * a(7) - 0.35 * a(6)));
  const gx = (opts.gaze && opts.gaze.x) || 0, gy = (opts.gaze && opts.gaze.y) || 0;
  for (const side of [-1, 1]) {
    const ex = side * 24, ey = -6;
    ctx.fillStyle = '#f8f5ef';
    ctx.beginPath(); ctx.ellipse(ex, ey, 13, 8 * open, 0, 0, Math.PI * 2); ctx.fill();
    if (open > 0.2) {
      ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, 13, 8 * open, 0, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#3b2414'; ctx.beginPath(); ctx.arc(ex + gx * 5, ey + gy * 3, 5.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0b0b0b'; ctx.beginPath(); ctx.arc(ex + gx * 5, ey + gy * 3, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + gx * 5 + 1.6, ey + gy * 3 - 1.6, 1.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = shade(skin, -0.45); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(ex, ey, 13, 8 * open, 0, Math.PI, 0); ctx.stroke();
    // lower lid raised by AU6/AU7
    if (a(6) + a(7) > 0.1) { ctx.beginPath(); ctx.moveTo(ex - 11, ey + 6 * open); ctx.quadraticCurveTo(ex, ey + 2 * open - 2 * a(6), ex + 11, ey + 6 * open); ctx.stroke(); }
  }
  // brows: AU1 inner up, AU2 outer up, AU4 lowered+together
  ctx.strokeStyle = opts.hair || HAIR[0]; ctx.lineWidth = 5;
  for (const side of [-1, 1]) {
    const innerY = -24 - 9 * a(1) + 8 * a(4), outerY = -24 - 9 * a(2) + 2 * a(4) + (aus.unilateral && side > 0 ? -2 : 0);
    const innerX = side * (12 - 4 * a(4)), outerX = side * 38;
    ctx.beginPath(); ctx.moveTo(innerX, innerY); ctx.quadraticCurveTo(side * 25, Math.min(innerY, outerY) - 4 + 3 * a(4), outerX, outerY); ctx.stroke();
  }
  if (a(4) > 0.3) { ctx.strokeStyle = shade(skin, -0.3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-3, -22); ctx.lineTo(-2, -12); ctx.moveTo(3, -22); ctx.lineTo(2, -12); ctx.stroke(); }
  // nose + AU9 wrinkles
  ctx.strokeStyle = shade(skin, -0.35); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(-2, -2); ctx.quadraticCurveTo(-9, 22, -8, 28); ctx.quadraticCurveTo(0, 33 - 2 * a(9), 9, 28); ctx.stroke();
  if (a(9) > 0.2) { ctx.lineWidth = 1.4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-8, 4 + i * 4); ctx.lineTo(8, 4 + i * 4); ctx.stroke(); } }
  // mouth
  const smile = a(12) - a(15);
  const stretch = a(20) * 8;
  const part = Math.max(a(25), a(26)) * (1 - a(23) * 0.7);
  const jaw = a(26) * 14;
  const w = 24 + stretch - a(23) * 5 + a(12) * 4;
  const my = 48 + jaw * 0.4 - a(17) * 3;
  const cornerY = my - smile * 9;
  const upLip = my - 3 - a(10) * 4;
  const unil = aus.unilateral ? 6 * a(14) : 0;
  ctx.fillStyle = '#5b1a1a';
  if (part > 0.05) {
    ctx.beginPath(); ctx.moveTo(-w, cornerY); ctx.quadraticCurveTo(0, upLip - 4, w, cornerY - unil);
    ctx.quadraticCurveTo(0, my + 6 + part * 16 + jaw, -w, cornerY); ctx.fill();
    if (a(12) > 0.4) { ctx.fillStyle = '#f1efe9'; ctx.beginPath(); ctx.moveTo(-w + 5, cornerY + 1); ctx.quadraticCurveTo(0, upLip, w - 5, cornerY + 1 - unil); ctx.quadraticCurveTo(0, upLip + 6, -w + 5, cornerY + 1); ctx.fill(); }
  }
  ctx.strokeStyle = '#7a2b2b'; ctx.lineWidth = 3.4;
  ctx.beginPath(); ctx.moveTo(-w, cornerY); ctx.quadraticCurveTo(0, my + smile * 8 + (part > 0.05 ? -6 : 0), w, cornerY - unil); ctx.stroke();
  if (part > 0.05) { ctx.beginPath(); ctx.moveTo(-w, cornerY); ctx.quadraticCurveTo(0, my + 6 + part * 16 + jaw, w, cornerY - unil); ctx.stroke(); }
  if (a(17) > 0.3) { ctx.strokeStyle = shade(skin, -0.25); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 74 + jaw * 0.5, 9, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke(); }
  if (opts.beard) { ctx.fillStyle = opts.hair || HAIR[0]; ctx.globalAlpha = 0.85; ctx.beginPath(); ctx.moveTo(-58, 20); ctx.quadraticCurveTo(-50, 96 + jaw, 0, 92 + jaw); ctx.quadraticCurveTo(50, 96 + jaw, 58, 20); ctx.quadraticCurveTo(30, 70, 0, 64); ctx.quadraticCurveTo(-30, 70, -58, 20); ctx.fill(); ctx.globalAlpha = 1; }
  if (opts.glasses) { ctx.strokeStyle = '#222'; ctx.lineWidth = 2.5; ctx.strokeRect(-40, -16, 30, 20); ctx.strokeRect(10, -16, 30, 20); ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(10, -8); ctx.stroke(); }
  ctx.restore();
  if (opts.label) { ctx.fillStyle = opts.labelColor || '#111'; ctx.font = `600 ${Math.max(11, size * 0.09)}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(opts.label, x, y + size * 0.72); }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + (amt < 0 ? c * amt : (255 - c) * amt))));
  return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Deterministic look for an agent index. */
function look(i) {
  return { skin: SKIN[(i * 3) % SKIN.length], hair: HAIR[i % HAIR.length], hijab: i % 4 === 1 ? ['#9F1239', '#1E1B4B', '#0F766E', '#7c2d12'][i % 4] : null, beard: i % 5 === 2, glasses: i % 6 === 3, shirt: ['#0F766E', '#1E1B4B', '#9F1239', '#b45309', '#334155'][i % 5], cap: i % 7 === 4 ? '#f8fafc' : null };
}

module.exports = { drawFace, AUS, AU_NAMES, EMOTIONS, VISEMES, mix, look, SKIN };
