'use strict';
/**
 * Methods & Stats Library (zone 9). WORLD_API zone builder; local coords, entrance toward +Z.
 * Book stacks (instanced books), the Ethics Board (IRB) chamber with a semicircular bench (→ director.presentIRB),
 * the Statistics Workbench (→ panel stats), a data sculpture — a 3D histogram that rebuilds from sim.datasets
 * on use — the poster-presentation hall (→ panels present / report), study carrels and "problems & tests" tables
 * (Tower of Hanoi, Wason cards, anchoring wheel, framing & IPIP kiosks).
 */
const id = 'library';

const POSTERS = [
  'Stroop interference in bilingual readers', 'Sleep duration and n-back accuracy', 'Anchoring in price estimates', 'Serial position after a 30-s distractor',
  'Group size and conformity: a replication', 'Change blindness and driving expertise', 'Working-memory span across a semester', 'Framing effects in health messages',
  'Colour constancy under coloured light', 'Big Five reliability by scale', 'Mental-rotation slopes: depth vs picture plane', 'Leading questions and speed estimates',
];

function build(kit) {
  const { THREE, act, sim } = kit; const U = kit.util; const PAL = U.PAL; const GB = U.GeoBuilder;
  const g = kit.group, D = kit.detail; const rng = kit.rng; const updaters = [];
  U.shell({ w: 36, d: 36, cz: 0, h: 8, roof: 'skylight', skipBack: () => true, floorMat: 'terrazzo' });
  const wood = new GB(), metal = new GB(), fabric = new GB(), marble = new GB(), dark = new GB(), carpet = new GB({ uvScale: 0.5 }), jaali = new GB({ uvScale: 0.6 });
  const C = (h) => new THREE.Color(h);
  const lab = (text, x, y, z, ry, o) => { const m = kit.label3d(text, Object.assign({ size: 0.2, maxWidth: 3 }, o || {})); m.position.set(x, y, z); m.rotation.y = ry || 0; D.add(m); return m; };
  const add = (gb, mat, parent, opt) => { const m = gb.mesh(mat, opt); if (m) (parent || g).add(m); return m; };
  const rot = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  const table = (x, z, w, d, h = 0.76, ry = 0) => { wood.box(w, 0.06, d, x, h - 0.06, z, PAL.wood, ry); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [px, pz] = rot(x, z, ry, sx * (w / 2 - 0.08), sz * (d / 2 - 0.08)); metal.box(0.05, h - 0.06, 0.05, px, 0, pz, PAL.charcoal, ry); } };
  const chair = (x, z, ry, col = PAL.crimson) => { const [bx, bz] = rot(x, z, ry, 0, -0.21); fabric.box(0.46, 0.08, 0.46, x, 0.45, z, col, ry); fabric.box(0.46, 0.55, 0.06, bx, 0.5, bz, col, ry); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const [px, pz] = rot(x, z, ry, sx * 0.19, sz * 0.19); metal.box(0.03, 0.45, 0.03, px, 0, pz, PAL.charcoal, ry); } };

  /* ============================================================ BOOK STACKS (instanced books) */
  const BOOKC = [0x8f1d2c, 0x26346b, 0x2f7d7a, 0xe39b2d, 0x5b3a22, 0xe8dcc0, 0x55602e, 0x6b3a4a, 0x1f2937];
  const books = []; const dens = { low: 0.45, medium: 0.75, high: 1, ultra: 1 }[kit.tier] || 0.75;
  const unit = (x, z, ry, sides) => { // 2.2 m wide, 2.4 m tall, 0.5 deep
    wood.box(2.2, 2.4, 0.04, x, 0, z, PAL.woodDark, ry);
    for (const sx of [-1, 1]) { const [px, pz] = rot(x, z, ry, sx * 1.1, 0); wood.box(0.05, 2.45, 0.52, px, 0, pz, PAL.woodDark, ry); }
    for (let s = 0; s < 5; s++) {
      const y = 0.08 + s * 0.46; const [px, pz] = rot(x, z, ry, 0, 0); wood.box(2.2, 0.035, 0.52, px, y, pz, PAL.wood, ry);
      for (const side of sides) {
        let lx = -1.05;
        while (lx < 1.0) {
          const bw = 0.025 + rng.random() * 0.035; if (rng.random() > dens) { lx += bw + 0.01; continue; }
          const bh = 0.24 + rng.random() * 0.14, bd = 0.17 + rng.random() * 0.05;
          const [bx, bz] = rot(x, z, ry, lx + bw / 2, side * (0.03 + bd / 2));
          books.push([bx, y + 0.035 + bh / 2, bz, bw, bh, bd, ry, BOOKC[Math.floor(rng.random() * BOOKC.length)]]); lx += bw + 0.004;
        }
      }
    }
  };
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 3; k++) { const x = sx * (16 - k * 2.3) - sx * 0; unit(x, -17.45, 0, [1]); }
    for (const z of [-13.6, -10.2]) for (let k = 0; k < 3; k++) unit(sx * (16 - k * 2.3), z, 0, [-1, 1]);
    for (const z of [-17.45, -13.6, -10.2]) kit.addCollider([Math.min(sx * 17.2, sx * 10.7), 0, z - 0.3], [Math.max(sx * 17.2, sx * 10.7), 2.5, z + 0.3]);
  }
  if (books.length) {
    const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), U.vc('fabric', { color: 0xffffff, roughness: 0.8 }).clone(), books.length);
    bm.material.vertexColors = false; U.track(bm.material);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
    books.forEach((b, i) => { M.compose(new THREE.Vector3(b[0], b[1], b[2]), Q.setFromEuler(E.set(0, b[6], 0)), new THREE.Vector3(b[3], b[4], b[5])); bm.setMatrixAt(i, M); bm.setColorAt(i, C(b[7])); });
    bm.castShadow = false; bm.receiveShadow = true; bm.computeBoundingSphere(); D.add(bm);
  }
  lab('Research Methods stacks', -13.7, 2.9, -9.9, 0, { size: 0.2 }); lab('Replication & Open Science stacks', 13.7, 2.9, -9.9, 0, { size: 0.2 });
  kit.addInteractable({ id: 'methods_stacks', pos: [-13.7, 1.5, -8.6], radius: 2.6, label: 'Research Methods Lab (panel)', onUse: () => act.panel('methods') });
  kit.addInteractable({ id: 'replication_stacks', pos: [13.7, 1.5, -8.6], radius: 2.6, label: 'Replication & Open Science (panel)', onUse: () => act.panel('replication') });

  /* ============================================================ IRB CHAMBER */
  const icx = 0, icz = -16.4, R = 4.6;
  marble.cyl(6.6, 6.6, 0.3, icx, 0, icz, PAL.marble, 40);
  carpet.cyl(5.2, 5.2, 0.31, icx, 0, icz, PAL.crimson, 40);
  kit.addCollider([icx - 6.6, 0, icz - 1.5], [icx + 6.6, 0.3, icz + 6.6]);
  const NSEG = 14, a0 = -1.35, a1 = 1.35; let prev = null;
  for (let i = 0; i <= NSEG; i++) {
    const a = a0 + (a1 - a0) * (i / NSEG); const x = icx + Math.sin(a) * R, z = icz + Math.cos(a) * R * -0.0 + Math.cos(a) * R;
    if (i < NSEG) { const am = a0 + (a1 - a0) * ((i + 0.5) / NSEG); const xm = icx + Math.sin(am) * R, zm = icz + Math.cos(am) * R; const L = 2 * R * Math.sin((a1 - a0) / NSEG / 2) + 0.04; wood.box(L, 0.95, 0.12, xm, 0.3, zm, PAL.woodDark, am); wood.box(L + 0.02, 0.05, 0.6, xm - Math.sin(am) * 0.25, 1.25, zm - Math.cos(am) * 0.25, PAL.wood, am); }
    if (prev) kit.addLineCollider(prev[0], prev[1], x, z, 0.3, 1.3, 0); prev = [x, z];
  }
  for (let i = 0; i < 7; i++) { const a = -1.1 + i * (2.2 / 6); const x = icx + Math.sin(a) * (R - 0.95), z = icz + Math.cos(a) * (R - 0.95); fabric.box(0.55, 0.1, 0.55, x, 0.78, z, PAL.indigo, a); fabric.box(0.55, 0.85, 0.08, x - Math.sin(a) * 0.27, 0.8, z - Math.cos(a) * 0.27, PAL.indigo, a); }
  // presenter podium (faces the bench)
  wood.box(0.8, 1.15, 0.55, 0, 0, -8.6, PAL.woodDark); metal.boxC(0.85, 0.04, 0.6, 0, 1.2, -8.66, PAL.saffron, 0.3, 0, 0); kit.addColliderBox(0, 0, -8.6, 0.8, 1.2, 0.55);
  // jaali screens enclosing the chamber sides + ajrak backdrop
  for (const sx of [-1, 1]) { jaali.box(0.12, 3, 7.5, sx * 7.8, 0, -13.9, 0xffffff); kit.addCollider([sx * 7.8 - 0.1, 0, -17.6], [sx * 7.8 + 0.1, 3, -10.2]); marble.box(0.3, 0.2, 7.7, sx * 7.8, 3, -13.9, PAL.marble); }
  { const bd = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.4), kit.mats.get('ajrak')); bd.position.set(0, 3.1, -17.75); D.add(bd); }
  lab('Ethics Board (IRB) · اخلاقیات بورڈ\nRespect for persons · Beneficence · Justice', 0, 5.4, -17.7, 0, { size: 0.3, maxWidth: 8 });
  kit.addInteractable({ id: 'irb', pos: [0, 1.6, -7.6], radius: 2.4, label: 'Present a proposal to the Ethics Board (IRB)', onUse: () => act.irb() });

  /* ============================================================ STATISTICS WORKBENCH */
  const scrTex = U.canvasTex(1536, 320, (c) => {
    c.fillStyle = '#0f1424'; c.fillRect(0, 0, 1536, 320);
    c.strokeStyle = '#e39b2d'; c.lineWidth = 4; c.beginPath(); for (let x = 20; x < 492; x++) { const t = (x - 256) / 70; c.lineTo(x, 280 - Math.exp(-t * t / 2) * 220); } c.stroke(); // normal curve
    c.fillStyle = '#2f7d7a'; for (let i = 0; i < 60; i++) { const x = 552 + i * 7, y = 270 - i * 3 - Math.sin(i * 1.7) * 30; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); } c.strokeStyle = '#f6eedd'; c.beginPath(); c.moveTo(552, 270); c.lineTo(980, 90); c.stroke(); // scatter + fit
    c.fillStyle = '#f6eedd'; c.font = '600 30px monospace'; ['t(38) = 2.41', 'p = .021', 'd = 0.76', "α = .84", 'F(2,57) = 5.3'].forEach((s, i) => c.fillText(s, 1060, 60 + i * 52));
  });
  table(12.5, -3, 5, 0.9); for (const k of [-1, 0, 1]) { metal.box(0.08, 0.3, 0.08, 12.5 + k * 1.6, 0.76, -3.2, PAL.charcoal); dark.box(1.4, 0.82, 0.05, 12.5 + k * 1.6, 1.02, -3.25, 0x111111); }
  if (scrTex) { const sg = new GB(); [-1, 0, 1].forEach((k, i) => { const x = 12.5 + k * 1.6, z = -3.22; sg.quad([x - 0.66, 1.06, z], [x + 0.66, 1.06, z], [x + 0.66, 1.8, z], [x - 0.66, 1.8, z], 0xffffff, [[i / 3, 0], [(i + 1) / 3, 0], [(i + 1) / 3, 1], [i / 3, 1]]); }); add(sg, U.track(new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })), D, { cast: false }); }
  for (const k of [-1, 0, 1]) chair(12.5 + k * 1.6, -2, Math.PI, PAL.teal);
  kit.addColliderBox(12.5, 0, -3, 5, 0.8, 0.9);
  lab('Statistics Workbench · شماریات', 12.5, 2.4, -3.3, 0, { size: 0.24 });
  kit.addInteractable({ id: 'stats', pos: [12.5, 1.5, -1.2], radius: 2.8, label: 'Statistics Workbench (panel)', onUse: () => act.panel('stats') });
  wood.box(0.9, 1.1, 0.6, 16.4, 0, 0.5, PAL.woodDark); kit.addColliderBox(16.4, 0, 0.5, 0.9, 1.2, 0.6); lab('Data Export · Experiment Builder', 16.4, 1.55, 0.82, 0, { size: 0.12, maxWidth: 1.4 });
  kit.addInteractable({ id: 'export', pos: [16.4, 1.4, 1.4], radius: 1.3, label: 'Data Export (panel)', onUse: () => act.panel('export') });
  kit.addInteractable({ id: 'builder', pos: [15.2, 1.4, 1.4], radius: 1.2, label: 'Experiment Builder (panel)', onUse: () => act.panel('builder') });

  /* ============================================================ DATA SCULPTURE (3D histogram) */
  const NB = 16, BW = 0.17, MAXH = 2.4;
  marble.cyl(1.7, 1.8, 0.6, 0, 0, -2.5, PAL.marble, 32); kit.addColliderBox(0, 0, -2.5, 3.4, 0.7, 3.4);
  const barMat = U.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1, emissive: 0x2a1405, emissiveIntensity: 0.25 }));
  const bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), barMat, NB); bars.castShadow = true; D.add(bars);
  const cur = new Float32Array(NB).fill(0.05), tgt = new Float32Array(NB).fill(0.05);
  const bM = new THREE.Matrix4();
  const setBars = () => { for (let i = 0; i < NB; i++) { const x = -1.35 + i * (2.7 / (NB - 1)); bM.compose(new THREE.Vector3(x, 0.6 + cur[i] / 2, -2.5), new THREE.Quaternion(), new THREE.Vector3(BW, Math.max(0.02, cur[i]), 0.9)); bars.setMatrixAt(i, bM); bars.setColorAt(i, new THREE.Color().setHSL(0.08 + 0.55 * (i / NB), 0.65, 0.5)); } bars.instanceMatrix.needsUpdate = true; if (bars.instanceColor) bars.instanceColor.needsUpdate = true; };
  setBars(); bars.computeBoundingSphere();
  const histLab = lab('Data Sculpture\nUse to rebuild from your data', 0, 3.6, -2.5, 0, { size: 0.2, billboard: true, maxWidth: 3.4 });
  const NUMF = ['rt', 'rt_ms', 'RT', 'response_time', 'latency', 'estimate', 'value', 'response', 'score', 'error', 'accuracy', 'correct'];
  function rebuild() {
    const ds = (sim && sim.datasets) || {}; let best = null, bestN = 0;
    for (const k of Object.keys(ds)) { const rows = Array.isArray(ds[k]) ? ds[k] : (ds[k] && Array.isArray(ds[k].rows) ? ds[k].rows : null); if (rows && rows.length > bestN) { best = k; bestN = rows.length; } }
    let vals = [], title;
    if (best) {
      const rows = Array.isArray(ds[best]) ? ds[best] : ds[best].rows; const r0 = rows.find((r) => r && typeof r === 'object') || {};
      const field = NUMF.find((f) => typeof r0[f] === 'number') || Object.keys(r0).find((k) => typeof r0[k] === 'number' && !/^(trial|block|onset|frames|id|t)/i.test(k));
      if (field) { vals = rows.map((r) => Number(r && r[field])).filter((v) => Number.isFinite(v)); title = `${best} · ${field} (n = ${vals.length})`; }
    }
    if (vals.length < 3) { vals = []; for (let i = 0; i < 400; i++) { let s = 0; for (let k = 0; k < 6; k++) s += rng.random(); vals.push(450 + (s - 3) * 120); } title = 'Simulated RT sample (n = 400) — run a paradigm to see your own data'; }
    let mn = Infinity, mx = -Infinity; for (const v of vals) { if (v < mn) mn = v; if (v > mx) mx = v; } if (mx - mn < 1e-9) mx = mn + 1;
    const cnt = new Array(NB).fill(0); for (const v of vals) cnt[Math.min(NB - 1, Math.floor((v - mn) / (mx - mn) * NB))]++;
    const top = Math.max(...cnt); for (let i = 0; i < NB; i++) tgt[i] = 0.05 + (cnt[i] / top) * MAXH;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length; const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, vals.length - 1));
    const txt = `Data Sculpture\n${title}\nM = ${mean.toFixed(1)}, SD = ${sd.toFixed(1)}, range ${mn.toFixed(0)}–${mx.toFixed(0)}`;
    if (histLab.userData.setText) histLab.userData.setText(txt);
    if (!act.motionOK()) { cur.set(tgt); setBars(); }
    return txt;
  }
  rebuild();
  updaters.push((dt) => { let ch = false; for (let i = 0; i < NB; i++) { const d = tgt[i] - cur[i]; if (Math.abs(d) > 1e-3) { cur[i] += d * Math.min(1, dt * 3); ch = true; } } if (ch) setBars(); });
  kit.addInteractable({ id: 'data_sculpture', pos: [0, 1.5, -0.3], radius: 2.6, label: 'Rebuild the data sculpture from your data', onUse: () => { const t = rebuild(); act.toast(t.split('\n').slice(1).join(' · ')); } });

  /* ============================================================ CARRELS (memory paradigms) */
  const CAR = [['serial_position', 'Serial position'], ['brown_peterson', 'Brown–Peterson'], ['levels_processing', 'Levels of processing'], ['drm', 'DRM false memory'], ['nback', 'n-back']];
  const scr = new GB();
  CAR.forEach(([pid, name], i) => {
    const z = -5.5 + i * 3, x = -16.9;
    wood.box(0.75, 0.05, 1.8, x, 0.74, z, PAL.wood); wood.box(0.75, 1.3, 0.05, x, 0, z - 0.9, PAL.woodDark); wood.box(0.75, 1.3, 0.05, x, 0, z + 0.9, PAL.woodDark); wood.box(0.05, 0.6, 1.8, x - 0.38, 0.79, z, PAL.woodDark);
    dark.boxC(0.02, 0.24, 0.36, x - 0.12, 0.9, z, 0x111111, 0, 0, 0.35); scr.boxC(0.005, 0.2, 0.32, x - 0.105, 0.9, z, C([0x1e3a8a, 0x3a1622, 0x16323a, 0x2b2112, 0x1f3326][i]), 0, 0, 0.35);
    metal.rod([x - 0.25, 0.77, z + 0.6], [x - 0.1, 1.15, z + 0.55], 0.015, PAL.charcoal); metal.cone(0.09, 0.12, x - 0.06, 1.08, z + 0.55, PAL.saffron, 10);
    chair(x + 0.8, z, -Math.PI / 2, PAL.crimson); kit.addCollider([x - 0.4, 0, z - 0.95], [x + 0.4, 1.35, z + 0.95]);
    lab(name, x - 0.36, 1.6, z, Math.PI / 2, { size: 0.13, maxWidth: 1.6 });
    kit.addInteractable({ id: pid, pos: [x + 1.1, 1.4, z], radius: 1.4, label: name + ' (run)', onUse: () => act.run(pid) });
  });
  lab('Memory carrels · Memory Lab', -16.4, 2.6, 7.4, Math.PI / 2, { size: 0.2 });
  kit.addInteractable({ id: 'memory_panel', pos: [-15, 1.5, 8.4], radius: 1.6, label: 'Memory Lab (panel)', onUse: () => act.panel('memory') });

  /* ============================================================ PROBLEMS & TESTS */
  // Tower of Hanoi
  table(-6.5, 6, 2.2, 1.1); kit.addColliderBox(-6.5, 0, 6, 2.2, 0.8, 1.1);
  for (let p = 0; p < 3; p++) { wood.cyl(0.03, 0.03, 0.6, -7.2 + p * 0.7, 0.76, 6, PAL.woodDark, 8); }
  wood.box(2.0, 0.05, 0.4, -6.5, 0.76, 6, PAL.wood);
  for (let k = 0; k < 5; k++) marble.cyl(0.26 - k * 0.04, 0.26 - k * 0.04, 0.07, -7.2, 0.81 + k * 0.07, 6, C([0x8f1d2c, 0xe39b2d, 0x2f7d7a, 0x26346b, 0xb0603f][k]), 20);
  lab('Tower of Hanoi', -6.5, 1.8, 6.6, 0, { size: 0.15 });
  kit.addInteractable({ id: 'hanoi', pos: [-6.5, 1.4, 7.3], radius: 1.5, label: 'Tower of Hanoi (run)', onUse: () => act.run('hanoi') });
  // Wason cards
  table(-2.5, 6, 2.2, 1.1); kit.addColliderBox(-2.5, 0, 6, 2.2, 0.8, 1.1);
  const cardTex = U.canvasTex(1024, 384, (c) => { ['E', 'K', '4', '7'].forEach((s, i) => { c.fillStyle = '#f6eedd'; c.fillRect(i * 256 + 8, 8, 240, 368); c.strokeStyle = '#26346b'; c.lineWidth = 10; c.strokeRect(i * 256 + 14, 14, 228, 356); c.fillStyle = i < 2 ? '#8f1d2c' : '#26346b'; c.font = '700 180px "Segoe UI", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, i * 256 + 128, 200); }); });
  if (cardTex) { const cg = new GB(); for (let i = 0; i < 4; i++) { const x = -3.25 + i * 0.5, z = 6.05; cg.quad([x - 0.18, 0.78, z + 0.12], [x + 0.18, 0.78, z + 0.12], [x + 0.18, 1.2, z - 0.05], [x - 0.18, 1.2, z - 0.05], 0xffffff, [[i / 4, 0], [(i + 1) / 4, 0], [(i + 1) / 4, 1], [i / 4, 1]]); } add(cg, U.track(new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.7, side: THREE.DoubleSide })), D, { cast: false }); }
  lab('Wason selection task\n"If a card has a vowel on one side, it has an even number on the other"', -2.5, 1.85, 6.7, 0, { size: 0.12, maxWidth: 2.6 });
  kit.addInteractable({ id: 'wason', pos: [-2.5, 1.4, 7.3], radius: 1.5, label: 'Wason selection task (run)', onUse: () => act.run('wason') });
  // Anchoring wheel
  const wheelTex = U.canvasTex(512, 512, (c) => { c.translate(256, 256); for (let i = 0; i < 20; i++) { c.fillStyle = i % 2 ? '#8f1d2c' : '#26346b'; if (i % 5 === 0) c.fillStyle = '#e39b2d'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 250, (i / 20) * Math.PI * 2, ((i + 1) / 20) * Math.PI * 2); c.fill(); c.save(); c.rotate(((i + 0.5) / 20) * Math.PI * 2); c.fillStyle = '#f6eedd'; c.font = '700 28px Arial'; c.textAlign = 'right'; c.fillText(String(i * 5), 235, 10); c.restore(); } c.fillStyle = '#f6eedd'; c.beginPath(); c.arc(0, 0, 26, 0, 7); c.fill(); });
  const wheel = new THREE.Mesh(new THREE.CircleGeometry(0.75, 48), U.track(new THREE.MeshStandardMaterial({ map: wheelTex, roughness: 0.5 }))); wheel.position.set(-6.5, 1.55, 11); D.add(wheel);
  metal.box(0.12, 0.8, 0.12, -6.5, 0, 10.95, PAL.charcoal); metal.box(0.6, 0.05, 0.4, -6.5, 0, 10.95, PAL.charcoal); metal.cone(0.06, 0.18, -6.5, 2.3, 11.02, PAL.saffron, 3); kit.addColliderBox(-6.5, 0, 10.95, 0.6, 1.2, 0.4);
  let spin = 0; updaters.push((dt) => { if (spin > 0) { wheel.rotation.z += spin * dt; spin = Math.max(0, spin - dt * 2.5); } });
  lab('Anchoring wheel', -6.5, 0.55, 11.2, 0, { size: 0.13 });
  kit.addInteractable({ id: 'anchoring', pos: [-6.5, 1.4, 12.2], radius: 1.5, label: 'Anchoring (run)', onUse: () => { if (act.motionOK()) spin = 9 + rng.random() * 5; act.run('anchoring'); } });
  // kiosks: framing, IPIP
  const kiosk = (x, z, name, pid, col) => { metal.box(0.14, 1.05, 0.14, x, 0, z, PAL.charcoal); dark.boxC(0.7, 0.46, 0.06, x, 1.3, z + 0.05, 0x111111, -0.35, 0, 0); scr.boxC(0.62, 0.38, 0.01, x, 1.31, z + 0.09, C(col), -0.35, 0, 0); kit.addColliderBox(x, 0, z, 0.5, 1.4, 0.5); lab(name, x, 1.8, z, 0, { size: 0.12, maxWidth: 1.6 }); kit.addInteractable({ id: pid, pos: [x, 1.4, z + 0.9], radius: 1.2, label: name + ' (run)', onUse: () => act.run(pid) }); };
  kiosk(-2.5, 11, 'Framing (original wording)', 'framing', 0x2b2112); kiosk(1.2, 11, 'IPIP Big Five', 'ipip_big5', 0x1e3a8a);
  lab('Problems & Tests · Cognition & Personality', -4.5, 3.0, 4.6, 0, { size: 0.22, maxWidth: 5 });
  kit.addInteractable({ id: 'cognition_panel', pos: [-4.5, 1.5, 9], radius: 1.6, label: 'Cognition & Language (panel)', onUse: () => act.panel('cognition') });
  kit.addInteractable({ id: 'personality_panel', pos: [2.4, 1.4, 12], radius: 1.2, label: 'Personality / Psychometrics (panel)', onUse: () => act.panel('personality') });

  /* ============================================================ POSTER HALL */
  const TW = 512, TH = 680;
  const posterTex = U.canvasTex(2048, 2048, (c) => {
    POSTERS.forEach((t, i) => {
      const x = (i % 4) * TW, y = Math.floor(i / 4) * TH; c.fillStyle = '#fbf6ec'; c.fillRect(x + 4, y + 4, TW - 8, TH - 8);
      c.fillStyle = ['#26346b', '#8f1d2c', '#2f7d7a'][i % 3]; c.fillRect(x + 4, y + 4, TW - 8, 120);
      c.fillStyle = '#fff'; c.font = '700 30px "Segoe UI", Arial'; let line = '', ly = y + 50; for (const w of t.split(' ')) { const tt = line ? line + ' ' + w : w; if (c.measureText(tt).width > TW - 50) { c.fillText(line, x + 22, ly); line = w; ly += 36; } else line = tt; } c.fillText(line, x + 22, ly);
      c.fillStyle = '#c9bfae'; for (let k = 0; k < 7; k++) c.fillRect(x + 22, y + 150 + k * 22, (k % 3 === 2 ? 150 : 210), 10);
      for (let k = 0; k < 7; k++) c.fillRect(x + 270, y + 150 + k * 22, 210, 10);
      const gx = x + 40, gy = y + 560; c.strokeStyle = '#2b2a2e'; c.lineWidth = 3; c.beginPath(); c.moveTo(gx, gy - 240); c.lineTo(gx, gy); c.lineTo(gx + 430, gy); c.stroke();
      if (i % 2) { for (let k = 0; k < 5; k++) { const h = 60 + ((i * 37 + k * 53) % 170); c.fillStyle = ['#e39b2d', '#2f7d7a'][k % 2]; c.fillRect(gx + 20 + k * 82, gy - h, 56, h); } }
      else { c.fillStyle = '#26346b'; for (let k = 0; k < 40; k++) { const px = gx + 15 + ((k * 97 + i * 13) % 400), py = gy - 20 - ((px - gx) * 0.4 + ((k * 61) % 90)); c.beginPath(); c.arc(px, py, 5, 0, 7); c.fill(); } }
      c.fillStyle = '#8f1d2c'; c.font = 'italic 22px "Segoe UI", Arial'; c.fillText('Simulated data · IIBS poster session', x + 22, y + TH - 30);
    });
  });
  const pq = new GB(); let pi = 0;
  for (const rz of [8, 13]) for (const bx of [8.6, 12, 15.4]) {
    metal.box(0.08, 2.4, 0.08, bx - 1.3, 0, rz, PAL.charcoal); metal.box(0.08, 2.4, 0.08, bx + 1.3, 0, rz, PAL.charcoal); wood.box(2.6, 1.9, 0.06, bx, 0.45, rz, PAL.plaster);
    kit.addCollider([bx - 1.35, 0, rz - 0.1], [bx + 1.35, 2.4, rz + 0.1]);
    for (const sd of [1, -1]) {
      const i = pi++ % POSTERS.length; const u0 = (i % 4) / 4, v1 = 1 - Math.floor(i / 4) * (TH / 2048), v0 = v1 - TH / 2048; const z = rz + sd * 0.035, hw = 0.62, y0 = 0.6, y1 = 0.6 + 1.64;
      for (const off of [-0.63, 0.63]) { const xa = bx + off - hw * sd * 0.98, xb = bx + off + hw * sd * 0.98; pq.quad([xa, y0, z], [xb, y0, z], [xb, y1, z], [xa, y1, z], 0xffffff, [[u0, v0], [u0 + 0.25, v0], [u0 + 0.25, v1], [u0, v1]]); }
    }
  }
  if (posterTex) add(pq, U.track(new THREE.MeshStandardMaterial({ map: posterTex, roughness: 0.75 })), D, { cast: false });
  lab('Poster Hall · Present & Report', 12, 3.2, 10.5, 0, { size: 0.26, maxWidth: 5 });
  kit.addInteractable({ id: 'present', pos: [12, 1.5, 9.6], radius: 2.6, label: 'Present & Report (panel)', onUse: () => act.panel('present') });
  kit.addInteractable({ id: 'report', pos: [12, 1.5, 14.6], radius: 2.6, label: 'APA Report Generator (panel)', onUse: () => act.panel('report') });

  /* ============================================================ circulation desk + reading tables */
  for (let k = 0; k < 7; k++) { const a = -0.9 + k * 0.3; wood.box(0.75, 1.05, 0.6, -8 + Math.sin(a) * 2.2, 0, 14.5 - Math.cos(a) * 2.2 + 2.2, PAL.woodDark, a); }
  kit.addColliderBox(-8, 0, 14.4, 4, 1.1, 1.4);
  lab('Methods & Stats Library · لائبریری', -8, 2.0, 15.5, 0, { size: 0.24, maxWidth: 4 });
  for (const [x, z] of [[4, 0.5], [4, 3.5]]) { table(x, z, 2.4, 1.2); kit.addColliderBox(x, 0, z, 2.4, 0.8, 1.2); chair(x - 0.6, z - 0.9, 0, PAL.indigo); chair(x + 0.6, z + 0.9, Math.PI, PAL.indigo); metal.cyl(0.08, 0.12, 0.05, x, 0.76, z, PAL.saffron, 10); }
  carpet.box(9, 0.01, 6, 3, 0.012, 2, PAL.indigo);

  /* ---- meshes */
  add(wood, U.vc('wood')); add(metal, U.vc('metal', { color: 0xffffff })); add(fabric, U.vc('fabric', { color: 0xffffff })); add(marble, U.vc('marble'));
  add(carpet, U.vc('carpet', { color: 0xffffff }), g, { cast: false }); add(jaali, U.vc('jaali')); add(dark, U.vc('metal', { color: 0xffffff, metalness: 0.2, roughness: 0.6 }));
  add(scr, U.track(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })), D, { cast: false });

  kit.anchor('inside', [0, 1.6, -14]); kit.anchor('insideCam', [0, 2.6, -4]); kit.anchor('exhibit', [0, 1.6, -2.5]); kit.anchor('exhibitCam', [3.5, 2.4, 1.5]);
  kit.anchor('irb', [0, 1.6, -15]); kit.anchor('workbench', [12.5, 1.3, -3]); kit.anchor('posters', [12, 1.5, 10.5]); kit.anchor('dataSculpture', [0, 1.8, -2.5]);

  return {
    update(dt, t) { for (const u of updaters) u(dt, t); },
    rebuildHistogram: rebuild,
    dispose() { /* freed by world.dispose() */ },
  };
}

module.exports = { id, build };
