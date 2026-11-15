'use strict';
/**
 * Social Psychology Plaza — "Mohalla" street (zone 8). WORLD_API zone builder; local coords, entrance toward +Z.
 * Open-air street: shopfronts with awnings and bilingual signs, a road with auto-rickshaws, a bus stop, a chai
 * dhaba with charpais, market stalls with fruit crates, string lights (glow at dusk/night) and an ambient crowd
 * (kit.crowd.createCrowd when available). Staged demos — all labelled "simulated":
 *  - inattentional blindness: two teams pass a ball while a costumed mascot strolls through (paradigm
 *    inattentional_blindness; the crossing also starts on bus event 'mohalla:ib:start');
 *  - bystander emergency staging near the bus stop (panel social);
 *  - Asch room (paradigm asch), prisoner's-dilemma table (prisoners_dilemma), misinformation junction with a staged
 *    minor collision (misinformation; panel eyewitness).
 */
const id = 'mohalla';

const SHOPS = [
  ['Kitab Ghar', 'کتاب گھر', 0xe6c27a], ['Sabzi Wala', 'سبزی والا', 0x9cc5a1], ['Darzi', 'درزی', 0xd99a8b],
  ['Mobile Repair', 'موبائل مرمت', 0x8fb3c9], ['Dawakhana', 'دواخانہ', 0xeadfca], ['Kiryana Store', 'کریانہ اسٹور', 0xe39b6d],
];

function build(kit) {
  const { THREE, act, sim } = kit; const U = kit.util; const PAL = U.PAL; const GB = U.GeoBuilder; const V3 = THREE.Vector3;
  const g = kit.group, D = kit.detail; const rng = kit.rng; const updaters = []; const offs = []; let crowd = null;
  const wood = new GB(), metal = new GB(), plaster = new GB(), fabric = new GB(), brick = new GB(), dark = new GB(), pave = new GB({ uvScale: 0.5 }), road = new GB(), jaali = new GB({ uvScale: 0.8 }), glass = new GB();
  const C = (h) => new THREE.Color(h);
  const lab = (text, x, y, z, ry, o) => { const m = kit.label3d(text, Object.assign({ size: 0.22, maxWidth: 3.6 }, o || {})); m.position.set(x, y, z); m.rotation.y = ry || 0; D.add(m); return m; };
  const add = (gb, mat, parent, opt) => { const m = gb.mesh(mat, opt); if (m) (parent || g).add(m); return m; };

  /* ---- ground: paving, road, kerbs */
  pave.box(40, 0.06, 32, 0, -0.05, 4, 0xffffff);
  road.box(40, 0.05, 5.5, 0, -0.04, -8.75, C(0x3b3a3f));
  for (let x = -18; x < 19; x += 4) road.box(2, 0.004, 0.15, x, 0.012, -8.75, C(0xf6eedd));
  brick.box(40, 0.16, 0.3, 0, 0, -5.9, PAL.brickDark); brick.box(40, 0.16, 0.3, 0, 0, -11.6, PAL.brickDark);
  pave.box(40, 0.1, 0.5, 0, -0.03, -11.95, 0xd8c8b0);
  for (const [x0, x1] of [[-14, -4], [4, 14]]) for (let x = x0; x <= x1; x += 2) road.box(0.5, 0.004, 3, x, 0.013, -2.2 + 0, C(0x9a8a76));

  /* ============================================================ SHOPFRONTS */
  SHOPS.forEach(([en, ur, col], i) => {
    const cx = -15 + i * 6, zf = -12.2, h = 7.2 + (i % 2) * 0.8;
    plaster.box(1.0, h, 0.4, cx - 2.5, 0, zf, C(col)); plaster.box(1.0, h, 0.4, cx + 2.5, 0, zf, C(col)); plaster.box(4.0, h - 3.2, 0.4, cx, 3.2, zf, C(col));
    plaster.box(6, h, 6.8, cx, 0, zf - 3.6, C(col).multiplyScalar(0.92));
    dark.box(4, 3.2, 0.1, cx, 0, zf - 1.4, C(0x2a2522)); metal.box(4.1, 1.1, 0.12, cx, 2.1, zf + 0.05, C(0x8c9096));
    for (let k = 0; k < 6; k++) metal.box(4.1, 0.03, 0.14, cx, 2.15 + k * 0.17, zf + 0.06, C(0x6b6f75));
    for (let k = 0; k < 6; k++) { const sc = k % 2 ? PAL.cream : [PAL.crimson, PAL.indigo, PAL.teal][i % 3]; fabric.boxC(0.68, 0.04, 1.6, cx - 2.04 + k * 0.68 + 0.34 - 0.0, 3.35, zf + 0.75, C(sc), -0.32, 0, 0); }
    plaster.box(6.1, 0.3, 0.6, cx, h, zf, C(0xf3ece0));
    // upper window + jaali balcony
    dark.box(1.6, 1.6, 0.05, cx, 4.4, zf + 0.22, C(0x1d2733)); glass.box(1.5, 1.5, 0.02, cx, 4.45, zf + 0.25, 0xffffff);
    wood.box(2.4, 0.12, 0.9, cx, 3.9, zf + 0.6, PAL.woodDark); jaali.box(2.4, 0.9, 0.06, cx, 4.02, zf + 1.02, 0xffffff);
    lab(`${en} · ${ur}`, cx, 3.75 + 0.1, zf + 0.26, 0, { size: 0.3, maxWidth: 3.8, bg: ['rgba(143,29,44,0.94)', 'rgba(38,52,107,0.94)', 'rgba(47,125,122,0.94)'][i % 3], border: '#f3e7cf' });
  });
  kit.addCollider([-18.2, 0, -12.6], [18.2, 3.5, -11.95]);
  // side buildings (left block, right block) + end walls
  plaster.box(3, 6.5, 9.5, -18.5, 0, -1.2, C(0xd9b989)); kit.addColliderBox(-18.5, 0, -1.2, 3, 3.5, 9.5);
  plaster.box(2.5, 6, 8, 18.75, 0, -1.8, C(0xc9d6c8)); kit.addColliderBox(18.75, 0, -1.8, 2.5, 3.5, 8);
  for (const [x, z] of [[-17, 1], [-17, -3], [17.5, 1], [17.5, -4]]) { dark.box(0.05, 1.4, 1.1, x + (x < 0 ? 0.03 : -0.03), 3.6, z, C(0x1d2733)); }
  plaster.box(3, 5.5, 6, -18.5, 0, 16.5, C(0xe39b6d)); kit.addColliderBox(-18.5, 0, 16.5, 3, 3.5, 6);
  plaster.box(2.5, 5, 5, 18.75, 0, 17, C(0x8fb3c9)); kit.addColliderBox(18.75, 0, 17, 2.5, 3.5, 5);

  /* ============================================================ ROAD PROPS: rickshaws + staged collision */
  const wheel = (x, z, r, axis, ry) => { const c = Math.cos(ry), s = Math.sin(ry); const ax = axis === 'x' ? [c * 0.08, -s * 0.08] : [s * 0.08, c * 0.08]; dark.rod([x - ax[0], r, z - ax[1]], [x + ax[0], r, z + ax[1]], r, C(0x18181b), 14); };
  const rickshaw = (x, z, ry, col) => {
    const c = Math.cos(ry), s = Math.sin(ry); const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    let [px, pz] = P(0, 0); metal.box(1.3, 0.7, 2.4, px, 0.3, pz, C(col), ry);
    [px, pz] = P(0, 0.2); fabric.box(1.35, 0.08, 2.2, px, 1.75, pz, C(0x1f2937), ry);
    for (const [lx, lz] of [[-0.62, 1.1], [0.62, 1.1], [-0.62, -0.9], [0.62, -0.9]]) { [px, pz] = P(lx, lz); metal.box(0.05, 1.05, 0.05, px, 0.95, pz, C(0x2b2a2e), ry); }
    [px, pz] = P(0, -0.3); fabric.box(1.1, 0.12, 0.6, px, 0.95, pz, C(0x8f1d2c), ry);
    [px, pz] = P(0, 1.35); metal.box(0.5, 0.3, 0.3, px, 0.55, pz, C(col), ry); [px, pz] = P(0, 1.55); metal.rod([px, 0.9, pz], [P(0, 1.35)[0], 1.25, P(0, 1.35)[1]], 0.03, PAL.charcoal);
    [px, pz] = P(0, 1.45); wheel(px, pz, 0.24, 'x', ry); [px, pz] = P(-0.62, -0.75); wheel(px, pz, 0.26, 'x', ry); [px, pz] = P(0.62, -0.75); wheel(px, pz, 0.26, 'x', ry);
    kit.addColliderBox(x, 0, z, 2.2, 1.8, 2.2);
  };
  rickshaw(4, -8.3, Math.PI / 2, 0x2f7d7a); rickshaw(9.5, -9.6, -Math.PI / 2 + 0.1, 0xe39b2d);
  const car = (x, z, ry, col) => {
    const c = Math.cos(ry), s = Math.sin(ry); const P = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    let [px, pz] = P(0, 0); metal.box(1.7, 0.65, 3.9, px, 0.3, pz, C(col), ry); [px, pz] = P(0, -0.2); metal.box(1.5, 0.55, 2.0, px, 0.95, pz, C(col), ry); glass.box(1.45, 0.45, 1.9, px, 1.0, pz, 0xffffff, ry);
    for (const [lx, lz] of [[-0.82, 1.25], [0.82, 1.25], [-0.82, -1.25], [0.82, -1.25]]) { [px, pz] = P(lx, lz); wheel(px, pz, 0.32, 'x', ry); }
    kit.addColliderBox(x, 0, z, 3.4, 1.4, 3.4);
  };
  car(-13, -9.2, Math.PI / 2, 0x8f1d2c); car(-9.4, -7.6, Math.PI / 2 + 0.55, 0xd8d0c2);
  for (let k = 0; k < 18; k++) glass.box(0.08 + rng.random() * 0.1, 0.01, 0.06 + rng.random() * 0.08, -11 + rng.uniform(-0.8, 0.8), 0.01, -8.2 + rng.uniform(-0.6, 0.6), 0xffffff, rng.random() * 3);
  for (const [x, z] of [[-14.8, -6.8], [-7.6, -6.6]]) { fabric.cone(0.2, 0.7, x, 0, z, C(0xe36a2d), 10); fabric.box(0.42, 0.04, 0.42, x, 0, z, C(0x2b2a2e)); }
  lab('Misinformation junction · staged minor collision (simulated)\nHow fast were the cars going when they ___ each other?', -11.2, 2.5, -5.6, 0, { size: 0.18, maxWidth: 5 });
  metal.box(0.1, 2.0, 0.1, -11.2, 0, -5.7, PAL.charcoal);
  kit.addInteractable({ id: 'misinformation', pos: [-11.2, 1.6, -4.4], radius: 2.4, label: 'Misinformation — eyewitness memory (run)', onUse: () => act.run('misinformation') });
  kit.addInteractable({ id: 'eyewitness_panel', pos: [-8, 1.6, -4.4], radius: 1.4, label: 'Eyewitness Room (panel)', onUse: () => act.panel('eyewitness') });

  /* ============================================================ BUS STOP + staged emergency */
  { const bx = 13.5, bz = -4.4;
    for (const [lx, lz] of [[-2, -0.7], [2, -0.7], [-2, 0.7], [2, 0.7]]) metal.box(0.08, 2.6, 0.08, bx + lx, 0, bz + lz, PAL.charcoal);
    metal.boxC(4.4, 0.08, 1.8, bx, 2.65, bz, C(0x26346b), 0.08, 0, 0); glass.box(4.0, 1.8, 0.04, bx, 0.6, bz + 0.72, 0xffffff);
    wood.box(3.2, 0.06, 0.45, bx, 0.45, bz + 0.45, PAL.wood); for (const lx of [-1.4, 1.4]) metal.box(0.05, 0.45, 0.4, bx + lx, 0, bz + 0.45, PAL.charcoal);
    metal.box(0.08, 3, 0.08, bx + 2.6, 0, bz - 0.8, PAL.charcoal);
    kit.addCollider([bx - 2.1, 0, bz + 0.6], [bx + 2.1, 2.6, bz + 0.8]); kit.addColliderBox(bx, 0, bz + 0.45, 3.2, 0.5, 0.45);
    lab('Bus Stop · بس اسٹاپ\nRoute 7 — simulated', bx + 2.6, 2.75, bz - 0.75, 0, { size: 0.16, maxWidth: 1.6, bg: 'rgba(38,52,107,0.95)' });
    U.figure(D, { abstract: true, color: 0x6b8e23, x: bx - 0.8, z: bz + 0.35, ry: Math.PI, pose: 'idle', name: 'Commuter' });
    U.figure(D, { abstract: true, color: 0x7a2e3a, x: bx + 1.0, z: bz - 0.1, ry: Math.PI - 0.4, pose: 'idle', name: 'Commuter' });
    const victim = U.figure(D, { abstract: true, x: 10.6, y: 0.2, z: -2.6, color: PAL.teal, accent: PAL.cream }); victim.obj.rotation.set(0, 0.3, Math.PI / 2);
    U.figure(D, { abstract: true, color: 0x26346b, x: 9.3, z: -1.6, ry: -2.2, pose: 'point', name: 'Bystander' });
    lab('Staged emergency · bystander demo (simulated)\nWho helps when many people are present?', 10.6, 1.6, -1.0, 0, { size: 0.15, maxWidth: 3.2 });
    kit.addInteractable({ id: 'bystander', pos: [10.6, 1.4, -0.6], radius: 2.4, label: 'Bystander effect — staged emergency (Social Psychology)', onUse: () => act.panel('social') });
  }

  /* ============================================================ CHAI DHABA */
  { const x0 = 11.5, x1 = 19.3, z0 = 4.5, z1 = 12;
    brick.box(0.3, 3.4, z1 - z0, x1, 0, (z0 + z1) / 2, 0xffffff); brick.box(x1 - x0, 3.4, 0.3, (x0 + x1) / 2, 0, z0, 0xffffff);
    metal.boxC(x1 - x0 + 0.6, 0.06, z1 - z0 + 0.6, (x0 + x1) / 2, 3.35, (z0 + z1) / 2, C(0x7a8088), 0, 0, 0.12);
    for (const [x, z] of [[x0, z1], [x0, z0 + 3.5]]) wood.box(0.15, 3.0, 0.15, x, 0, z, PAL.woodDark);
    wood.box(1.0, 1.0, 4.2, x1 - 1.0, 0, 7.6, PAL.wood); metal.sphere(0.28, x1 - 1.0, 1.28, 6.6, C(0xb8bcc2), 14, 0.8); metal.rod([x1 - 1.25, 1.28, 6.6], [x1 - 1.6, 1.45, 6.6], 0.03, C(0xb8bcc2));
    dark.cyl(0.22, 0.25, 0.25, x1 - 1.0, 1.0, 6.6, C(0x2b2a2e), 12);
    for (let k = 0; k < 6; k++) glass.cyl(0.035, 0.03, 0.08, x1 - 1.1 + (k % 3) * 0.12, 1.0, 8.4 + Math.floor(k / 3) * 0.12, 0xffffff, 8);
    kit.addCollider([x1 - 0.2, 0, z0], [x1 + 0.2, 3, z1]); kit.addCollider([x0, 0, z0 - 0.2], [x1, 3, z0 + 0.2]); kit.addColliderBox(x1 - 1.0, 0, 7.6, 1.0, 1.1, 4.2);
    const charpai = (x, z, ry) => { const c = Math.cos(ry), s = Math.sin(ry); wood.box(1.0, 0.08, 1.9, x, 0.38, z, PAL.woodDark, ry); fabric.box(0.9, 0.03, 1.8, x, 0.45, z, C(0xd9c7a0), ry); for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const lx = sx * 0.45, lz = sz * 0.9; wood.cyl(0.04, 0.05, 0.42, x + lx * c + lz * s, 0, z - lx * s + lz * c, PAL.woodDark, 8); } kit.addColliderBox(x, 0, z, 1.6, 0.5, 1.6); };
    charpai(13, 7, 0); charpai(15.2, 10.3, Math.PI / 2); charpai(9.4, 9.2, 0.2);
    for (const [x, z] of [[11.4, 6.5], [11.2, 10.8]]) { wood.cyl(0.3, 0.3, 0.04, x, 0.6, z, PAL.wood, 14); wood.cyl(0.04, 0.04, 0.6, x, 0, z, PAL.woodDark, 8); glass.cyl(0.035, 0.03, 0.08, x, 0.64, z, 0xffffff, 8); }
    U.figure(D, { lookIndex: 11, x: x1 - 1.9, z: 7.2, ry: -Math.PI / 2, pose: 'talk', name: 'Chai-wala' });
    lab('Chai Dhaba · چائے ڈھابہ', (x0 + x1) / 2, 3.05, z1 + 0.35, 0, { size: 0.32, maxWidth: 5, bg: 'rgba(143,29,44,0.95)', border: '#f3e7cf' });
  }

  /* ============================================================ MARKET STALLS + fruit crates */
  const fruit = [];
  const FRUITC = [[0xf2a51a, 0.065], [0xe36a2d, 0.055], [0xc0392b, 0.045], [0x7cb342, 0.04], [0x7e3b6b, 0.045], [0xf1d04b, 0.05]];
  [[-9.5, 1.6, 0x8f1d2c], [-5.2, 1.6, 0x2f7d7a], [-0.9, 1.6, 0xe39b2d]].forEach(([x, z, col], si) => {
    for (const [lx, lz] of [[-1.6, -0.9], [1.6, -0.9], [-1.6, 0.9], [1.6, 0.9]]) wood.box(0.08, 2.5, 0.08, x + lx, 0, z + lz, PAL.woodDark);
    for (let k = 0; k < 5; k++) fabric.boxC(0.66, 0.04, 2.2, x - 1.32 + k * 0.66, 2.55, z + 0.1, C(k % 2 ? PAL.cream : col), -0.14, 0, 0);
    wood.box(3.2, 0.06, 1.4, x, 0.8, z, PAL.wood); wood.box(3.0, 0.8, 0.05, x, 0, z - 0.65, PAL.woodDark);
    kit.addColliderBox(x, 0, z, 3.4, 0.9, 1.9);
    for (let c = 0; c < 4; c++) {
      const cx = x - 1.15 + c * 0.77, cz = z + 0.1; const [fc, fr] = FRUITC[(si * 2 + c) % FRUITC.length];
      wood.box(0.66, 0.22, 0.5, cx, 0.86, cz, C(0xb08a5a)); for (let k = 0; k < 3; k++) wood.box(0.66, 0.02, 0.02, cx, 0.9 + k * 0.07, cz + 0.25, C(0x8a6a40));
      for (let i = 0; i < 18; i++) fruit.push([cx + rng.uniform(-0.27, 0.27), 1.04 + rng.uniform(0, 0.07), cz + rng.uniform(-0.2, 0.2), fr * rng.uniform(0.85, 1.15), fc]);
    }
  });
  if (fruit.length) {
    const fm = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), U.track(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 })), fruit.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion();
    fruit.forEach((f, i) => { M.compose(new V3(f[0], f[1], f[2]), Q, new V3(f[3], f[3] * 0.92, f[3])); fm.setMatrixAt(i, M); fm.setColorAt(i, C(f[4]).offsetHSL(rng.uniform(-0.02, 0.02), 0, rng.uniform(-0.05, 0.05))); });
    fm.castShadow = true; fm.computeBoundingSphere(); D.add(fm);
  }
  lab('Bazaar · بازار', -5.2, 3.2, 2.7, 0, { size: 0.28 });

  /* ============================================================ ASCH ROOM */
  { const x0 = -19.6, x1 = -12.6, z0 = 4, z1 = 12.5, h = 3.6, dz0 = 7.6, dz1 = 9.0;
    plaster.box(x1 - x0, h, 0.25, (x0 + x1) / 2, 0, z0, C(0xbcd3cf)); plaster.box(x1 - x0, h, 0.25, (x0 + x1) / 2, 0, z1, C(0xbcd3cf));
    plaster.box(0.25, h, dz0 - z0, x1, 0, (z0 + dz0) / 2, C(0xbcd3cf)); plaster.box(0.25, h, z1 - dz1, x1, 0, (dz1 + z1) / 2, C(0xbcd3cf)); plaster.box(0.25, h - 2.4, dz1 - dz0, x1, 2.4, (dz0 + dz1) / 2, C(0xbcd3cf));
    plaster.box(x1 - x0 + 0.4, 0.25, z1 - z0 + 0.4, (x0 + x1) / 2, h, (z0 + z1) / 2, C(0xf3ece0));
    kit.addCollider([x0, 0, z0 - 0.15], [x1, 3, z0 + 0.15]); kit.addCollider([x0, 0, z1 - 0.15], [x1, 3, z1 + 0.15]);
    kit.addCollider([x1 - 0.15, 0, z0], [x1 + 0.15, 3, dz0]); kit.addCollider([x1 - 0.15, 0, dz1], [x1 + 0.15, 3, z1]);
    const tx = -16.6, tz = 8.25; wood.box(1.2, 0.06, 3.6, tx, 0.74, tz, PAL.wood); for (const sx of [-1, 1]) for (const sz of [-1, 1]) metal.box(0.05, 0.74, 0.05, tx + sx * 0.5, 0, tz + sz * 1.7, PAL.charcoal);
    kit.addColliderBox(tx, 0, tz, 1.2, 0.8, 3.6);
    for (let k = 0; k < 7; k++) { const side = k < 4 ? -1 : 1; const zz = tz - 1.4 + (k % 4) * 0.93 + (side > 0 ? 0.45 : 0); const cx = tx + side * 0.95; fabric.box(0.44, 0.08, 0.44, cx, 0.45, zz, PAL.indigo); fabric.box(0.06, 0.5, 0.44, cx + side * 0.2, 0.5, zz, PAL.indigo); metal.box(0.04, 0.45, 0.04, cx, 0, zz, PAL.charcoal); }
    const aschTex = U.canvasTex(1024, 512, (c) => { c.fillStyle = '#f6eedd'; c.fillRect(0, 0, 1024, 512); c.fillStyle = '#2b2a2e'; c.fillRect(470, 0, 8, 512); c.fillRect(170, 120, 14, 300); [[620, 260], [760, 300], [900, 210]].forEach(([x, hh], i) => { c.fillRect(x, 420 - hh, 14, hh); c.font = '700 48px Arial'; c.textAlign = 'center'; c.fillText('ABC'[i], x + 7, 480); }); c.font = '700 40px Arial'; c.textAlign = 'center'; c.fillText('Standard', 177, 480); });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), U.track(new THREE.MeshStandardMaterial({ map: aschTex, roughness: 0.8 }))); board.position.set(x0 + 0.16, 1.75, tz); board.rotation.y = Math.PI / 2; D.add(board);
    lab('Asch Room · conformity (debriefed)\nآش کمرہ', x1 + 0.15, 2.95, (dz0 + dz1) / 2, Math.PI / 2, { size: 0.2, maxWidth: 3 });
    kit.addInteractable({ id: 'asch', pos: [x1 + 0.9, 1.6, (dz0 + dz1) / 2], radius: 2, label: 'Asch-style conformity (run, debriefed)', onUse: () => act.run('asch') });
    kit.anchor('asch', [tx, 1.4, tz]);
  }

  /* ============================================================ PRISONER'S DILEMMA TABLE */
  { const x = 4.5, z = 13.5; wood.box(1.4, 0.06, 0.9, x, 0.74, z, PAL.wood); for (const sx of [-1, 1]) wood.box(0.08, 0.74, 0.8, x + sx * 0.6, 0, z, PAL.woodDark); fabric.box(0.04, 0.5, 0.9, x, 0.8, z, PAL.indigo);
    for (const sx of [-1, 1]) { fabric.box(0.44, 0.08, 0.44, x + sx * 1.05, 0.45, z, PAL.crimson); fabric.box(0.06, 0.5, 0.44, x + sx * 1.25, 0.5, z, PAL.crimson); }
    kit.addColliderBox(x, 0, z, 1.4, 0.8, 0.9);
    lab("Prisoner's Dilemma table\nCooperate or defect?", x, 1.75, z, 0, { size: 0.16, maxWidth: 2.4, doubleSide: true });
    kit.addInteractable({ id: 'prisoners_dilemma', pos: [x, 1.4, z + 1.3], radius: 1.8, label: "Prisoner's dilemma tournament (run)", onUse: () => act.run('prisoners_dilemma') });
  }

  /* ============================================================ INATTENTIONAL-BLINDNESS STAGING */
  const ibC = new V3(-4, 0, 10.5), ibR = 2.3; const players = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const white = i % 2 === 0; const f = U.figure(D, { abstract: true, x: ibC.x + Math.sin(a) * ibR, z: ibC.z + Math.cos(a) * ibR, ry: a + Math.PI, color: white ? 0xf3f0ea : 0x1f1f24, accent: white ? PAL.crimson : PAL.saffron, legs: 0x3a3a40 }); players.push(f.obj); }
  const ballMat = U.track(new THREE.MeshStandardMaterial({ color: 0xe36a2d, roughness: 0.6 }));
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), ballMat); ball.castShadow = true; D.add(ball);
  // mascot (original costumed figure, no real character)
  const mg = new GB(); const fur = C(0x3b3b3b), face = C(0x6b6b6b);
  mg.cyl(0.32, 0.38, 0.9, 0, 0.75, 0, fur, 14); mg.sphere(0.4, 0, 1.55, 0, fur, 14, 0.9); mg.sphere(0.28, 0, 1.95, 0.05, fur, 14); mg.sphere(0.16, 0, 1.9, 0.22, face, 12, 0.8);
  mg.sphere(0.08, -0.2, 2.18, 0, fur, 8); mg.sphere(0.08, 0.2, 2.18, 0, fur, 8);
  for (const sx of [-1, 1]) { mg.rod([sx * 0.38, 1.6, 0], [sx * 0.55, 0.95, 0.1], 0.12, fur, 10); mg.cyl(0.13, 0.15, 0.78, sx * 0.17, 0, 0, fur, 10); }
  const mascot = new THREE.Group(); const mm = mg.mesh(U.vc('fabric', { color: 0xffffff, roughness: 1 })); mascot.add(mm); mascot.visible = false; D.add(mascot);
  const ibPath = [new V3(-14, 0, 12.2), new V3(ibC.x, 0, ibC.z), new V3(8, 0, 9.4)];
  let ib = null; // {t}
  const startCrossing = () => { ib = { t: 0 }; mascot.visible = true; };
  updaters.push((dt, t) => {
    const ok = act.motionOK();
    // ball passes between white-shirt players (0,2,4)
    const seg = ok ? (t * 0.8) % 3 : 0, k = Math.floor(seg), f = seg - k; const a = players[(k * 2) % 6].position, b = players[((k + 1) * 2) % 6].position;
    ball.position.set(a.x + (b.x - a.x) * f, 1.2 + Math.sin(f * Math.PI) * 0.8, a.z + (b.z - a.z) * f);
    if (ib) {
      ib.t += dt; const T = 11;
      if (!ok) { mascot.position.copy(ibPath[1]); mascot.rotation.y = 0; if (ib.t > 5) { ib = null; mascot.visible = false; } return; }
      let p; if (ib.t < 4.5) p = ibPath[0].clone().lerp(ibPath[1], ib.t / 4.5); else if (ib.t < 6.5) p = ibPath[1].clone(); else p = ibPath[1].clone().lerp(ibPath[2], Math.min(1, (ib.t - 6.5) / 4.5));
      mascot.position.copy(p); mascot.position.y = ib.t < 4.5 || ib.t > 6.5 ? Math.abs(Math.sin(ib.t * 6)) * 0.05 : 0;
      mascot.rotation.y = ib.t > 4.5 && ib.t < 6.5 ? Math.sin(ib.t * 4) * 0.4 : Math.PI / 2 - 0.1;
      if (ib.t > T) { ib = null; mascot.visible = false; }
    }
  });
  lab('Count the passes made by the WHITE team\nInattentional-blindness demo (simulated)', ibC.x, 2.8, ibC.z + ibR + 1.2, 0, { size: 0.18, maxWidth: 4 });
  kit.addInteractable({ id: 'inattentional_blindness', pos: [ibC.x, 1.6, ibC.z + ibR + 2.4], radius: 2.6, label: 'Count the passes — inattentional blindness (run)', onUse: () => { startCrossing(); act.run('inattentional_blindness'); } });
  if (sim && sim.bus && sim.bus.on) for (const ev of ['mohalla:ib:start', 'ib:cross']) offs.push(sim.bus.on(ev, startCrossing));

  /* ============================================================ STRING LIGHTS */
  const bulbs = []; const xs = [-14, -7, 0, 7, 14];
  for (const x of xs) {
    for (const z of [-5.4, 18.2]) { metal.cyl(0.06, 0.09, 5.6, x, 0, z, PAL.charcoal, 8); kit.addColliderBox(x, 0, z, 0.25, 3, 0.25); }
    const A = new V3(x, 5.5, -5.4), B = new V3(x + (x === 0 ? 0 : 0), 5.5, 18.2), n = 26; let prevP = A;
    for (let i = 1; i <= n; i++) { const tt = i / n; const p = A.clone().lerp(B, tt); p.y -= Math.sin(tt * Math.PI) * 1.1; metal.rod(prevP, p, 0.008, PAL.charcoal, 4); if (i < n) bulbs.push([p.x, p.y - 0.08, p.z, [0xffd27a, 0xff8a65, 0xfff1d6, 0x9fd3ff][i % 4]]); prevP = p; }
  }
  const bulbMat = U.track(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 8, 6), bulbMat, bulbs.length);
  { const M = new THREE.Matrix4(); bulbs.forEach((b, i) => { M.makeTranslation(b[0], b[1], b[2]); bulbMesh.setMatrixAt(i, M); bulbMesh.setColorAt(i, C(b[3])); }); bulbMesh.computeBoundingSphere(); D.add(bulbMesh); }
  const setTimeOfDay = (tod) => { bulbMat.color.setScalar(tod === 'night' ? 3 : tod === 'dusk' ? 1.8 : 0.85); };
  setTimeOfDay((sim && sim.state && sim.state.timeOfDay) || 'day');

  /* ============================================================ ambient crowd */
  const crowdMod = kit.crowd;
  if (crowdMod && typeof crowdMod.createCrowd === 'function') {
    try {
      const count = { low: 10, medium: 18, high: 28, ultra: 36 }[kit.tier] || 18;
      crowd = crowdMod.createCrowd(THREE, { count, bounds: { minX: -16, maxX: 16, minZ: -5.2, maxZ: -3.0 }, paths: [[[-16, -4.2], [16, -4.2]], [[-12, 17], [9, 17]], [[8.5, -3], [8.5, 17]], [[-11.5, -3], [-11.5, 17]]], seed: 1408, tier: kit.tier });
      const obj = crowd && (crowd.group || crowd.mesh || crowd.object); if (obj) D.add(obj);
    } catch (e) { crowd = null; }
  }

  /* ---- meshes */
  add(pave, U.vc('tiles'), g, { cast: false }); add(road, U.vc('metal', { color: 0xffffff, metalness: 0, roughness: 0.92 }), g, { cast: false });
  add(brick, U.vc('brick')); add(plaster, U.vc('plaster')); add(wood, U.vc('wood')); add(metal, U.vc('metal', { color: 0xffffff, metalness: 0.5, roughness: 0.45 }));
  add(fabric, U.vc('fabric', { color: 0xffffff, side: THREE.DoubleSide })); add(dark, U.vc('metal', { color: 0xffffff, metalness: 0.1, roughness: 0.7 }));
  add(jaali, U.vc('jaali')); add(glass, U.vc('glass'), g, { cast: false });

  lab('Social Psychology Plaza — Mohalla · محلہ', 0, 4.2, 18.25, 0, { size: 0.34, maxWidth: 9, bg: 'rgba(38,52,107,0.95)' });
  kit.addInteractable({ id: 'social_panel', pos: [0, 1.6, 17.2], radius: 2.4, label: 'Social Psychology (panel)', onUse: () => act.panel('social') });
  kit.anchor('inside', [-4, 1.4, 10.5]); kit.anchor('insideCam', [6, 2.4, 16]); kit.anchor('exhibit', [-4, 1.4, 10.5]); kit.anchor('exhibitCam', [-4, 2.4, 16.5]);
  kit.anchor('bystander', [10.6, 0.5, -2.6]); kit.anchor('junction', [-11, 1, -8.4]); kit.anchor('dhaba', [14, 1.4, 8]);

  return {
    alwaysUpdate: false,
    update(dt, t) { for (const u of updaters) u(dt, t); if (crowd && crowd.update) crowd.update(dt, t); },
    setTimeOfDay, startCrossing,
    get crowd() { return crowd; },
    dispose() { for (const off of offs) if (typeof off === 'function') off(); if (crowd && crowd.dispose) crowd.dispose(); crowd = null; },
  };
}

module.exports = { id, build };
