'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { march, sd, _table } = require('../src/world/marching.js');

function closedness(indices) {
  // every directed edge (a→b) must be matched by exactly one (b→a): closed, consistently oriented 2-manifold
  const dir = new Map();
  for (let t = 0; t < indices.length; t += 3) {
    for (let e = 0; e < 3; e++) {
      const a = indices[t + e], b = indices[t + ((e + 1) % 3)];
      const k = a + ',' + b;
      dir.set(k, (dir.get(k) || 0) + 1);
    }
  }
  let bad = 0;
  for (const [k, n] of dir) { const [a, b] = k.split(','); if (n !== 1 || dir.get(b + ',' + a) !== 1) bad++; }
  return { bad, edges: dir.size / 2 };
}

function signedVolume(pos, idx) {
  let v = 0;
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    v += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
      - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
      + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
  }
  return v;
}

test('generated table: every case has a multiple of 3 entries, empty for 0 and 255', () => {
  assert.equal(_table.length, 256);
  assert.equal(_table[0].length, 0);
  assert.equal(_table[255].length, 0);
  for (const t of _table) assert.equal(t.length % 3, 0);
  assert.equal(_table[1].length, 3); // single corner → one triangle
});

test('sphere SDF gives a closed, outward-oriented mesh with the expected bounding box', () => {
  const r = 1, res = 24;
  const m = march((x, y, z) => sd.sphere(x - 0.1, y, z + 0.05, r), { min: [-1.5, -1.5, -1.5], max: [1.5, 1.5, 1.5] }, res);
  assert.ok(m.indices.length > 300, 'has triangles');
  assert.equal(m.indices.length % 3, 0);
  const { bad, edges } = closedness(m.indices);
  assert.equal(bad, 0, 'no boundary or non-manifold edges');
  const V = m.positions.length / 3, F = m.indices.length / 3;
  assert.equal(V - edges + F, 2, 'Euler characteristic of a sphere');
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < m.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], m.positions[i + a]); hi[a] = Math.max(hi[a], m.positions[i + a]); }
  const cell = 3 / res, c = [0.1, 0, -0.05];
  for (let a = 0; a < 3; a++) {
    assert.ok(Math.abs(lo[a] - (c[a] - r)) < cell, `min[${a}] ${lo[a]}`);
    assert.ok(Math.abs(hi[a] - (c[a] + r)) < cell, `max[${a}] ${hi[a]}`);
  }
  const vol = signedVolume(m.positions, m.indices);
  assert.ok(Math.abs(vol - (4 / 3) * Math.PI) / ((4 / 3) * Math.PI) < 0.05, `volume ${vol}`);
  let outward = 0;
  for (let i = 0; i < m.positions.length; i += 3) {
    const d = (m.positions[i] - c[0]) * m.normals[i] + (m.positions[i + 1] - c[1]) * m.normals[i + 1] + (m.positions[i + 2] - c[2]) * m.normals[i + 2];
    if (d > 0) outward++;
  }
  assert.equal(outward, V, 'gradient normals point outward');
});

test('ambiguous fields (two touching spheres, noisy blob) stay watertight', () => {
  const two = (x, y, z) => Math.min(sd.sphere(x - 0.52, y, z, 0.5), sd.sphere(x + 0.52, y, z, 0.5));
  const noisy = (x, y, z) => sd.sphere(x, y, z, 1) + 0.15 * Math.sin(7 * x) * Math.sin(6 * y + 1) * Math.sin(5 * z + 2);
  for (const f of [two, noisy]) {
    const m = march(f, { min: [-1.6, -1.6, -1.6], max: [1.6, 1.6, 1.6] }, [19, 23, 21], { normals: 'faces' });
    assert.equal(closedness(m.indices).bad, 0);
    assert.ok(signedVolume(m.positions, m.indices) > 0, 'outward orientation');
  }
});
