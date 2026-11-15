'use strict';
/**
 * Wundt Hall — history-of-psychology museum (zone 1). WORLD_API zone builder; local coords, entrance toward +Z.
 * Timeline wall 1879 → now (text-only plaques in one canvas atlas, no likenesses of real people), abstract
 * sculptures for the schools (structuralism → neuroscience), a rotating "Perspectives Lens", the case-study
 * archive, a method-of-loci Memory Palace alcove and skylight light shafts (engine volumetrics when present).
 * Interactables → panels history / perspectives / cases / course; paradigm memory_palace.
 */
const id = 'wundt';

const TIMELINE = [
  ['Before 1879', 'Psychophysics', 'Weber (1834) finds just-noticeable differences grow with intensity; Fechner\'s Elemente der Psychophysik (1860) proposes S = k log I.'],
  ['1879', 'A laboratory in Leipzig', 'Wilhelm Wundt opens a laboratory for experimental psychology — the conventional founding date of the discipline.'],
  ['1885', 'Memory measured', 'Ebbinghaus publishes his savings studies of nonsense syllables: the first forgetting curve (single subject).'],
  ['1890', 'Functionalism', 'William James\'s The Principles of Psychology asks what the mind is for — habits, attention, the stream of consciousness.'],
  ['1892', 'A profession organises', 'The American Psychological Association is founded.'],
  ['1900', 'Psychoanalysis', 'Freud\'s The Interpretation of Dreams: unconscious motives and the talking cure. Influential, hard to test.'],
  ['1905', 'Mental testing', 'Binet and Simon publish a scale to identify children who need extra help at school.'],
  ['1912', 'Gestalt', 'Wertheimer\'s apparent-motion studies: the whole is perceived differently from the sum of its parts.'],
  ['1913', 'Behaviourism', 'Watson\'s manifesto: psychology as the prediction and control of observable behaviour.'],
  ['1938', 'Operant conditioning', 'Skinner\'s The Behavior of Organisms: consequences shape behaviour; schedules of reinforcement.'],
  ['1951–1954', 'Humanistic psychology', 'Rogers\'s client-centred therapy (1951) and Maslow\'s Motivation and Personality (1954) centre growth and meaning.'],
  ['1956', 'The cognitive revolution', 'Miller\'s "magical number seven, plus or minus two" and others treat the mind as an information processor.'],
  ['1967', 'Cognitive psychology named', 'Neisser\'s textbook Cognitive Psychology gives the new field its name.'],
  ['1971', 'Mental rotation', 'Shepard & Metzler: same/different decision time rises linearly with angular disparity.'],
  ['1974', 'Heuristics & memory', 'Tversky & Kahneman on anchoring and heuristics; Loftus & Palmer show leading questions alter recall.'],
  ['Early 1990s', 'Imaging the working brain', 'Functional MRI joins EEG and PET: cognitive neuroscience links tasks to brain activity.'],
  ['1998', 'Positive psychology', 'A movement to study strengths, well-being and flourishing, not only disorder.'],
  ['2015', 'The replication wake-up call', 'The Open Science Collaboration repeats 100 studies: 97% of originals vs 36% of replications significant.'],
  ['2025', 'Curricula renewed', 'HEC Pakistan notifies revised psychology curricula for the BS programme (Feb 2025).'],
  ['Now', 'Open, cultural, applied', 'Preregistration, open data, cross-cultural & indigenous psychology — and you, running studies in this lab.'],
];
const SCHOOLS = [
  ['Structuralism', 'Elements of experience', '#26346b'], ['Functionalism', 'What is the mind for?', '#2f7d7a'],
  ['Psychoanalysis', 'The unseen depths', '#8f1d2c'], ['Gestalt', 'Wholes before parts', '#e39b2d'],
  ['Behaviourism', 'Stimulus → response', '#5b3a22'], ['Humanistic', 'Growth & meaning', '#b0603f'],
  ['Cognitive', 'Mind as information', '#26346b'], ['Neuroscience', 'Brain & behaviour', '#2f7d7a'],
];
const LENS = [['Biological', 0x2f7d7a], ['Behavioural', 0x5b3a22], ['Cognitive', 0x26346b], ['Psychodynamic', 0x8f1d2c], ['Humanistic', 0xe39b2d], ['Evolutionary', 0x6b8e23], ['Sociocultural', 0xb0603f]];

function wrap(g, text, maxW) { const out = []; let cur = ''; for (const w of text.split(' ')) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; } if (cur) out.push(cur); return out; }

function build(kit) {
  const { THREE, act } = kit; const U = kit.util; const PAL = U.PAL; const GB = U.GeoBuilder;
  const engine = kit.engine; const g = kit.group, D = kit.detail;
  const updaters = []; const vols = []; const owned = [];
  const sh = U.shell({ w: 36, d: 34, cz: -1, h: 9, roof: 'skylight', skipLeft: () => true, skipRight: () => true, door: 7 });
  const B = sh.bounds; // x -18..18, z -18..16

  const wood = new GB(), marble = new GB(), sculpt = new GB(), glass = new GB(), brass = new GB(), floorInlay = new GB({ uvScale: 0.25 });

  /* ---- timeline atlas: 20 plaques (5 × 4 tiles) */
  const COLS = 5, ROWS = 4, TW = 4096 / COLS, TH = 2048 / ROWS;
  const atlas = U.canvasTex(4096, 2048, (c) => {
    TIMELINE.forEach((e, i) => {
      const x = (i % COLS) * TW, y = Math.floor(i / COLS) * TH, pad = 34;
      c.fillStyle = '#f6eedd'; c.fillRect(x + 6, y + 6, TW - 12, TH - 12);
      c.fillStyle = i === 1 ? '#8f1d2c' : '#26346b'; c.fillRect(x + 6, y + 6, TW - 12, 96);
      c.strokeStyle = '#e39b2d'; c.lineWidth = 8; c.strokeRect(x + 10, y + 10, TW - 20, TH - 20);
      c.fillStyle = '#f6eedd'; c.font = '700 64px "Segoe UI", Arial, sans-serif'; c.textBaseline = 'middle'; c.fillText(e[0], x + pad, y + 56);
      c.fillStyle = '#26346b'; c.font = '700 46px "Segoe UI", Arial, sans-serif'; c.fillText(e[1], x + pad, y + 150);
      c.fillStyle = '#2b2a2e'; c.font = '400 34px "Segoe UI", Arial, sans-serif';
      wrap(c, e[2], TW - pad * 2).slice(0, 6).forEach((l, k) => c.fillText(l, x + pad, y + 214 + k * 44));
      c.fillStyle = '#8f1d2c'; c.font = 'italic 24px "Segoe UI", Arial, sans-serif'; c.fillText('Text plaque · no likeness depicted', x + pad, y + TH - 40);
    });
  });
  const plaqueMat = U.track(new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.6, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: 0.18 }));
  const plaques = new GB();
  const tileUV = (i) => { const u0 = (i % COLS) / COLS, v1 = 1 - Math.floor(i / COLS) / ROWS; return [[u0, v1 - 1 / ROWS], [u0 + 1 / COLS, v1 - 1 / ROWS], [u0 + 1 / COLS, v1], [u0, v1]]; };
  const PW = 1.9, PH = PW * (TH / TW), Y0 = 1.25;
  const slots = [];
  for (let k = 0; k < 6; k++) slots.push({ x: B.x0 + 0.42, z: 10 - k * 4.2, face: 'L' });
  for (let k = 0; k < 8; k++) slots.push({ x: -14.7 + k * 4.2, z: B.z0 + 0.42, face: 'B' });
  for (let k = 0; k < 6; k++) slots.push({ x: B.x1 - 0.42, z: -11 + k * 4.2, face: 'R' });
  slots.forEach((s, i) => {
    const uv = tileUV(i); let a, b, c, d;
    if (s.face === 'B') { a = [s.x - PW / 2, Y0, s.z]; b = [s.x + PW / 2, Y0, s.z]; c = [s.x + PW / 2, Y0 + PH, s.z]; d = [s.x - PW / 2, Y0 + PH, s.z]; brass.box(PW + 0.16, PH + 0.16, 0.05, s.x, Y0 - 0.08, s.z - 0.03, PAL.saffron); }
    else if (s.face === 'L') { a = [s.x, Y0, s.z + PW / 2]; b = [s.x, Y0, s.z - PW / 2]; c = [s.x, Y0 + PH, s.z - PW / 2]; d = [s.x, Y0 + PH, s.z + PW / 2]; brass.box(0.05, PH + 0.16, PW + 0.16, s.x - 0.03, Y0 - 0.08, s.z, PAL.saffron); }
    else { a = [s.x, Y0, s.z - PW / 2]; b = [s.x, Y0, s.z + PW / 2]; c = [s.x, Y0 + PH, s.z + PW / 2]; d = [s.x, Y0 + PH, s.z - PW / 2]; brass.box(0.05, PH + 0.16, PW + 0.16, s.x + 0.03, Y0 - 0.08, s.z, PAL.saffron); }
    plaques.quad(a, b, c, d, 0xffffff, uv);
  });
  // year band + floor timeline stripe from the door to the back wall
  brass.box(0.08, 0.06, 26, B.x0 + 0.4, Y0 + PH + 0.2, -1, PAL.saffron); brass.box(0.08, 0.06, 26, B.x1 - 0.4, Y0 + PH + 0.2, -1, PAL.saffron); brass.box(34, 0.06, 0.08, 0, Y0 + PH + 0.2, B.z0 + 0.4, PAL.saffron);
  floorInlay.box(0.5, 0.006, 30, 0, 0.012, 0, PAL.crimson);
  for (let z = -14; z <= 14; z += 2) floorInlay.box(1.4, 0.007, 0.12, 0, 0.013, z, PAL.saffron);

  /* ---- school sculptures on plinths (two rows) */
  const plin = []; for (let i = 0; i < 8; i++) plin.push({ x: i % 2 ? 6.5 : -6.5, z: 8 - Math.floor(i / 2) * 5 });
  const C = (hex) => new THREE.Color(hex);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S1 = new THREE.Vector3(1, 1, 1);
  const addGeo = (gb, geo, x, y, z, rx, ry, rz, col, s = 1) => { M.compose(new THREE.Vector3(x, y, z), Q.setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s)); gb.add(geo, M, col); geo.dispose(); };
  plin.forEach((p, i) => {
    marble.box(1.7, 1.0, 1.7, p.x, 0, p.z, PAL.marble); marble.box(1.9, 0.08, 1.9, p.x, 1.0, p.z, PAL.plaster);
    kit.addColliderBox(p.x, 0, p.z, 1.9, 1.1, 1.9);
    const y = 1.08, x = p.x, z = p.z;
    switch (i) {
      case 0: for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) for (let c = 0; c < 3; c++) if ((a + b + c) % 2 === 0) sculpt.box(0.22, 0.22, 0.22, x - 0.32 + a * 0.32, y + b * 0.32, z - 0.32 + c * 0.32, C(0x26346b)); // lattice of "elements"
        for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) sculpt.rod([x - 0.32 + a * 0.32, y, z - 0.32 + c * 0.32], [x - 0.32 + a * 0.32, y + 0.64, z - 0.32 + c * 0.32], 0.02, PAL.saffron); break;
      case 1: addGeo(sculpt, new THREE.TorusGeometry(0.42, 0.07, 10, 28), x - 0.22, y + 0.55, z, 0, 0.3, 0, C(0x2f7d7a)); addGeo(sculpt, new THREE.TorusGeometry(0.34, 0.07, 10, 28), x + 0.3, y + 0.62, z, Math.PI / 2, 0.3, 0, C(0xe39b2d));
        for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; sculpt.boxC(0.1, 0.12, 0.1, x - 0.22 + Math.cos(a) * 0.5, y + 0.55 + Math.sin(a) * 0.5, z, C(0x2f7d7a), 0, 0.3, a); } break;
      case 2: sculpt.cone(0.32, 0.5, x, y + 0.9, z, C(0xeff4f6), 7); addGeo(sculpt, new THREE.CylinderGeometry(0.65, 0.05, 0.9, 7), x, y, z, 0, 0, 0, C(0x8f1d2c)); glass.cyl(0.85, 0.85, 0.03, x, y + 0.88, z, 0xffffff, 24); break;
      case 3: for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2 + Math.PI / 2; const px = x + Math.cos(a) * 0.5, py = y + 0.6 + Math.sin(a) * 0.5; const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.08, 24, 1, false, 0, Math.PI * 5 / 3); addGeo(sculpt, geo, px, py, z, Math.PI / 2, 0, a + Math.PI + Math.PI / 6 + Math.PI / 2, C(0x2b2a2e)); }
        sculpt.box(0.06, 0.6, 0.06, x, y, z - 0.3, C(0xe39b2d)); break;
      case 4: sculpt.box(0.5, 0.45, 0.5, x - 0.35, y, z, C(0x5b3a22)); sculpt.boxC(0.05, 0.3, 0.05, x - 0.35, y + 0.55, z + 0.2, C(0xe39b2d), 0.5, 0, 0); sculpt.box(0.5, 0.06, 0.08, x + 0.08, y + 0.25, z, C(0xe39b2d)); sculpt.cone(0.09, 0.18, x + 0.38, y + 0.17, z, C(0xe39b2d), 4); sculpt.sphere(0.16, x + 0.55, y + 0.2, z, C(0x8f1d2c)); break;
      case 5: for (let k = 0; k < 9; k++) { const a = k * 0.75; sculpt.box(0.28, 0.08, 0.14, x + Math.cos(a) * 0.45, y + k * 0.1, z + Math.sin(a) * 0.45, C(0xb0603f), -a); } sculpt.sphere(0.12, x, y + 1.0, z, C(0xe39b2d)); sculpt.rod([x, y, z], [x, y + 0.95, z], 0.03, C(0x5b3a22)); break;
      case 6: [[0, 0.15], [0, 0.55], [0, 0.95]].forEach(([dx, dy], k) => { sculpt.box(0.5, 0.26, 0.3, x + dx, y + dy - 0.1, z, C([0x26346b, 0x2f7d7a, 0x8f1d2c][k])); }); sculpt.rod([x, y + 0.16, z + 0.17], [x, y + 0.45, z + 0.17], 0.03, PAL.saffron); sculpt.rod([x, y + 0.56, z + 0.17], [x, y + 0.85, z + 0.17], 0.03, PAL.saffron); addGeo(sculpt, new THREE.TorusGeometry(0.3, 0.025, 6, 20, Math.PI), x + 0.25, y + 0.55, z, 0, 0, -Math.PI / 2, C(0xe39b2d)); break;
      default: { sculpt.sphere(0.13, x, y + 0.5, z, C(0x2f7d7a)); const br = (sx, sy, sz, ex, ey, ez, depth) => { sculpt.rod([sx, sy, sz], [ex, ey, ez], 0.025 * depth, C(0xe39b2d)); if (depth > 1) for (let k = -1; k <= 1; k += 2) br(ex, ey, ez, ex + (ex - sx) * 0.6 + k * 0.12, ey + (ey - sy) * 0.6 + 0.08, ez + k * 0.1, depth - 1); };
        br(x, y + 0.5, z, x - 0.3, y + 0.8, z, 3); br(x, y + 0.5, z, x + 0.3, y + 0.8, z, 3); sculpt.rod([x, y + 0.5, z], [x, y + 0.05, z], 0.03, C(0xe39b2d)); }
    }
  });
  // school captions: one atlas (4×2)
  const capTex = U.canvasTex(2048, 512, (c) => {
    SCHOOLS.forEach((s, i) => { const x = (i % 4) * 512, y = Math.floor(i / 4) * 256; c.fillStyle = s[2]; c.fillRect(x + 4, y + 4, 504, 248); c.fillStyle = '#f6eedd'; c.textAlign = 'center'; c.font = '700 54px "Segoe UI", Arial'; c.fillText(s[0], x + 256, y + 105); c.font = '400 34px "Segoe UI", Arial'; c.fillText(s[1], x + 256, y + 175); });
  });
  const caps = new GB();
  plin.forEach((p, i) => { const u0 = (i % 4) / 4, v0 = 1 - (Math.floor(i / 4) + 1) / 2; const fz = p.z + 0.852, hw = 0.7; caps.quad([p.x - hw, 0.25, fz], [p.x + hw, 0.25, fz], [p.x + hw, 0.95, fz], [p.x - hw, 0.95, fz], 0xffffff, [[u0, v0], [u0 + 0.25, v0], [u0 + 0.25, v0 + 0.5], [u0, v0 + 0.5]]); });

  /* ---- Perspectives Lens (rotating ring of 7 arcs) */
  const lensGB = new GB(); const arc = (Math.PI * 2) / LENS.length;
  LENS.forEach((l, i) => { const geo = new THREE.TorusGeometry(2.0, 0.16, 10, 24, arc * 0.96); M.makeRotationZ(i * arc); lensGB.add(geo, M, new THREE.Color(l[1])); geo.dispose(); });
  { const geo = new THREE.TorusGeometry(1.1, 0.04, 6, 48); lensGB.add(geo, new THREE.Matrix4(), new THREE.Color(PAL.saffron)); geo.dispose(); }
  const lens = lensGB.mesh(U.vc('metal', { roughness: 0.35, metalness: 0.4 })); lens.matrixAutoUpdate = true; lens.position.set(0, 4.2, -9); D.add(lens);
  marble.cyl(0.5, 0.7, 0.5, 0, 0, -9, PAL.marble, 20); brass.rod([0, 0.5, -9], [0, 2.2, -9], 0.06, PAL.saffron); kit.addColliderBox(0, 0, -9, 1.4, 1, 1.4);
  const lensLab = kit.label3d('Perspectives Lens\nBiological · Behavioural · Cognitive · Psychodynamic · Humanistic · Evolutionary · Sociocultural', { size: 0.2, maxWidth: 4.6 }); lensLab.position.set(0, 1.3, -8.25); D.add(lensLab);
  updaters.push((dt) => { if (act.motionOK()) lens.rotation.z += dt * 0.15; });

  /* ---- case-study archive (front right) */
  for (let k = 0; k < 4; k++) { const x = 10 + k * 1.3; wood.box(1.2, 2.1, 0.7, x, 0, 13.5, PAL.woodDark); for (let d = 0; d < 4; d++) brass.box(0.3, 0.05, 0.04, x, 0.35 + d * 0.5, 13.13, PAL.saffron); }
  kit.addColliderBox(11.95, 0, 13.5, 5.3, 2.2, 0.8);
  const arch = kit.label3d('Case Archive\nClassic studies, later research & replication status', { size: 0.22, maxWidth: 4.2 }); arch.position.set(11.95, 2.6, 13.1); arch.rotation.y = Math.PI; D.add(arch);

  /* ---- Memory Palace alcove (front left): five loci */
  const lociCol = [0x8f1d2c, 0x26346b, 0xe39b2d, 0x2f7d7a, 0xb0603f];
  const loci = [[-15.5, 13], [-13, 10.5], [-15.5, 8], [-13, 5.5], [-15.5, 3]];
  floorInlay.box(5.4, 0.006, 11.5, -14.2, 0.012, 8, PAL.indigo);
  loci.forEach(([x, z], i) => {
    marble.cyl(0.4, 0.45, 0.9, x, 0, z, PAL.marble, 16); kit.addColliderBox(x, 0, z, 0.9, 1, 0.9);
    const y = 0.9, c = new THREE.Color(lociCol[i]);
    if (i === 0) sculpt.cyl(0.12, 0.2, 0.45, x, y, z, c, 12); // vase
    else if (i === 1) { sculpt.box(0.4, 0.08, 0.3, x, y, z, c); sculpt.box(0.4, 0.08, 0.3, x, y + 0.09, z, new THREE.Color(0xf6eedd)); } // book
    else if (i === 2) { sculpt.cyl(0.18, 0.18, 0.06, x, y + 0.2, z, c, 20); sculpt.box(0.03, 0.4, 0.03, x, y, z, new THREE.Color(0x2b2a2e)); } // clock
    else if (i === 3) { sculpt.box(0.3, 0.04, 0.3, x, y + 0.2, z, c); sculpt.box(0.3, 0.3, 0.04, x, y + 0.2, z - 0.13, c); for (const sx of [-1, 1]) for (const sz of [-1, 1]) sculpt.box(0.03, 0.2, 0.03, x + sx * 0.13, y, z + sz * 0.13, c); } // chair
    else { sculpt.cyl(0.05, 0.12, 0.35, x, y, z, c, 10); sculpt.sphere(0.14, x, y + 0.45, z, new THREE.Color(0xfff1c0)); } // lamp
    floorInlay.box(0.6, 0.007, 0.6, x + 0.9, 0.013, z, PAL.saffron);
  });
  const mp = kit.label3d('Memory Palace\nمحلِ یادداشت\nMethod of loci: place items along a familiar route', { size: 0.24, maxWidth: 3.6 }); mp.position.set(-14.2, 2.5, 15.4); mp.rotation.y = Math.PI; D.add(mp);
  wood.box(0.12, 0.12, 0.12, -14.2, 0, 15.4, PAL.woodDark);

  /* ---- benches + entrance lectern */
  for (const x of [-2.2, 2.2]) { wood.box(1.8, 0.45, 0.5, x, 0, 2, PAL.wood); kit.addColliderBox(x, 0, 2, 1.8, 0.5, 0.5); }
  wood.box(0.9, 1.1, 0.6, 3.2, 0, 12.5, PAL.woodDark); brass.boxC(0.95, 0.04, 0.65, 3.2, 1.15, 12.4, PAL.saffron, -0.35, 0, 0); kit.addColliderBox(3.2, 0, 12.5, 0.9, 1.2, 0.6);
  const welcome = kit.label3d('Wundt Hall · ونڈٹ ہال\nHistory of Psychology Museum — walk the timeline from 1879 to now', { size: 0.26, maxWidth: 6 }); welcome.position.set(0, 6.2, B.z0 + 0.45); D.add(welcome);

  /* ---- skylight shafts */
  const shaftPts = [[-6, -12], [6, -12], [0, -3], [-8, 4], [8, 4]];
  if (engine && typeof engine.addVolumetric === 'function') {
    for (const [x, z] of shaftPts) { const p = kit.toWorld([x + 1.5, 8.9, z - 1]); const q = kit.toWorld([x, 0, z]); vols.push(engine.addVolumetric({ position: p, direction: q.sub(p).normalize(), angle: 0.28, range: 11, color: 0xffe2b0, intensity: 0.9 })); }
  } else {
    const shaftMat = U.track(new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.07, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    const sg = new GB(); for (const [x, z] of shaftPts) { const geo = new THREE.CylinderGeometry(0.9, 1.8, 8.8, 16, 1, true); M.compose(new THREE.Vector3(x + 0.7, 4.4, z - 0.5), Q.setFromEuler(new THREE.Euler(-0.1, 0, 0.15)), S1); sg.add(geo, M, 0xffffff, true); geo.dispose(); }
    const sm = sg.mesh(shaftMat, { cast: false, receive: false }); D.add(sm);
  }

  /* ---- build meshes */
  const add = (gb, mat, parent, opt) => { const m = gb.mesh(mat, opt); if (m) (parent || g).add(m); return m; };
  add(plaques, plaqueMat, g, { cast: false }); add(brass, U.vc('metal', { color: 0xffffff, roughness: 0.3 })); add(wood, U.vc('wood')); add(marble, U.vc('marble'));
  add(sculpt, U.vc('marble', { roughness: 0.45 }), D); add(glass, U.vc('glass'), D, { cast: false }); add(floorInlay, U.vc('terrazzo'), g, { cast: false });
  if (capTex) add(caps, U.track(new THREE.MeshBasicMaterial({ map: capTex, toneMapped: false })), D, { cast: false });

  /* ---- interactables + anchors */
  kit.addInteractable({ id: 'timeline', pos: [0, 1.6, B.z0 + 2.2], radius: 3.2, label: 'Timeline 1879 → now (History & Schools)', onUse: () => act.panel('history') });
  kit.addInteractable({ id: 'timeline_start', pos: [B.x0 + 2, 1.6, 10], radius: 2.6, label: 'Before 1879: psychophysics', onUse: () => act.panel('history') });
  kit.addInteractable({ id: 'lens', pos: [0, 1.6, -7.6], radius: 2.8, label: 'Perspectives Lens', onUse: () => act.panel('perspectives') });
  kit.addInteractable({ id: 'schools', pos: [0, 1.6, 5], radius: 3, label: 'Schools of thought (dioramas)', onUse: () => act.panel('history') });
  kit.addInteractable({ id: 'cases', pos: [12, 1.6, 12], radius: 2.6, label: 'Case Archive', onUse: () => act.panel('cases') });
  kit.addInteractable({ id: 'memory_palace', pos: [-12.2, 1.6, 8], radius: 3, label: 'Memory Palace — method of loci (run)', onUse: () => act.run('memory_palace') });
  kit.addInteractable({ id: 'lectern', pos: [3.2, 1.4, 11.6], radius: 2, label: 'Course Map', onUse: () => act.panel('course') });
  kit.anchor('inside', [0, 2, -9]); kit.anchor('insideCam', [0, 2.6, 12]); kit.anchor('exhibit', [-6.5, 1.6, 3]); kit.anchor('memory', [-14.2, 1.4, 8]); kit.anchor('timeline', [0, 2, B.z0 + 0.5]);

  return {
    update(dt, t) { for (const u of updaters) u(dt, t); },
    dispose() { for (const v of vols) if (engine && engine.removeVolumetric) engine.removeVolumetric(v); vols.length = 0; for (const o of owned) if (o.dispose) o.dispose(); },
  };
}

module.exports = { id, build };
