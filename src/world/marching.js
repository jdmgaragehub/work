'use strict';
/**
 * Marching cubes (A2 World). Pure: no THREE, no DOM — node-tested in test/marching.test.js.
 *
 *   march(sdf, bounds, res, opts?) → { positions: Float32Array, normals: Float32Array, indices: Uint32Array }
 *
 *   sdf(x, y, z) → signed distance (negative inside). bounds = { min: [x,y,z], max: [x,y,z] }.
 *   res = cells per axis (number) or [nx, ny, nz]. opts.normals: 'gradient' (default, central differences
 *   on the sdf) | 'faces' (area-weighted face normals; no extra sdf calls).
 *
 * The 256-case triangle table is GENERATED at load time instead of typed in: for every corner
 * configuration we walk the six cube faces, emit one directed segment per run of inside corners
 * (ambiguous faces always separate the inside corners, so neighbouring cubes agree), chain the
 * segments into closed loops and fan-triangulate each loop. Because every face decision depends only
 * on that face's four corners, adjacent cubes produce identical boundaries → the mesh is watertight.
 * Vertices are shared through a global edge-id map, so the result is an indexed, closed 2-manifold
 * wherever the surface lies inside `bounds`.
 */

// corner c ↔ (x,y,z) = (c&1, c>>1&1, c>>2&1)
const EDGES = []; // [cornerA, cornerB, axis] with A < B
const EDGE_ID = {};
for (let c = 0; c < 8; c++) {
  for (let a = 0; a < 3; a++) {
    const bit = 1 << a;
    if (!(c & bit)) { EDGE_ID[c + ',' + (c | bit)] = EDGES.length; EDGES.push([c, c | bit, a]); }
  }
}
function edgeOf(a, b) { return a < b ? EDGE_ID[a + ',' + b] : EDGE_ID[b + ',' + a]; }

// Faces: four corners in counter-clockwise order seen from outside the cube.
const FACES = [];
for (let k = 0; k < 3; k++) {
  const u = (k + 1) % 3, v = (k + 2) % 3; // (u, v, k) is right-handed
  for (let s = 0; s < 2; s++) {
    const quad = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([iu, iv]) => (iu << u) | (iv << v) | (s << k));
    FACES.push(s === 1 ? quad : quad.slice().reverse());
  }
}

function buildTable() {
  const table = new Array(256);
  for (let m = 0; m < 256; m++) {
    const next = new Map();
    for (const f of FACES) {
      const ins = f.map((c) => (m >> c) & 1);
      const n = ins[0] + ins[1] + ins[2] + ins[3];
      if (n === 0 || n === 4) continue;
      for (let i = 0; i < 4; i++) {
        if (!ins[i] || ins[(i + 3) % 4]) continue; // i starts an inside run
        const entry = edgeOf(f[(i + 3) % 4], f[i]);
        let j = i;
        while (ins[(j + 1) % 4]) j = (j + 1) % 4;
        const exit = edgeOf(f[j], f[(j + 1) % 4]);
        next.set(exit, entry);
      }
    }
    const tris = [];
    const seen = new Set();
    for (const start of next.keys()) {
      if (seen.has(start)) continue;
      const loop = [];
      let e = start;
      while (!seen.has(e)) { seen.add(e); loop.push(e); e = next.get(e); }
      for (let i = 1; i + 1 < loop.length; i++) tris.push(loop[0], loop[i + 1], loop[i]);
    }
    table[m] = tris;
  }
  return table;
}
const TABLE = buildTable();

function march(sdf, bounds, res, opts) {
  const o = opts || {};
  const [nx, ny, nz] = Array.isArray(res) ? res : [res, res, res];
  const min = bounds.min, max = bounds.max;
  const sx = (max[0] - min[0]) / nx, sy = (max[1] - min[1]) / ny, sz = (max[2] - min[2]) / nz;
  const px = nx + 1, py = ny + 1, pz = nz + 1;
  const field = new Float32Array(px * py * pz);
  for (let k = 0, q = 0; k < pz; k++) {
    const z = min[2] + k * sz;
    for (let j = 0; j < py; j++) {
      const y = min[1] + j * sy;
      for (let i = 0; i < px; i++, q++) field[q] = sdf(min[0] + i * sx, y, z);
    }
  }
  const edgeVert = new Int32Array(px * py * pz * 3).fill(-1);
  const pos = [], idx = [];
  const cornerOff = [];
  for (let c = 0; c < 8; c++) cornerOff.push((c & 1) + ((c >> 1) & 1) * px + ((c >> 2) & 1) * px * py);
  const vals = new Float64Array(8);

  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const base = (k * py + j) * px + i;
        let m = 0;
        for (let c = 0; c < 8; c++) { const v = field[base + cornerOff[c]]; vals[c] = v; if (v < 0) m |= 1 << c; }
        if (m === 0 || m === 255) continue;
        const tris = TABLE[m];
        for (let t = 0; t < tris.length; t++) {
          const e = EDGES[tris[t]];
          const a = e[0], b = e[1], axis = e[2];
          const key = (base + cornerOff[a]) * 3 + axis;
          let vi = edgeVert[key];
          if (vi < 0) {
            const va = vals[a], vb = vals[b];
            let f = va / (va - vb);
            if (!(f >= 0)) f = 0; else if (f > 1) f = 1;
            const ax = i + (a & 1), ay = j + ((a >> 1) & 1), az = k + ((a >> 2) & 1);
            const p = [min[0] + ax * sx, min[1] + ay * sy, min[2] + az * sz];
            p[axis] += f * [sx, sy, sz][axis];
            vi = pos.length / 3;
            pos.push(p[0], p[1], p[2]);
            edgeVert[key] = vi;
          }
          idx.push(vi);
        }
      }
    }
  }

  const positions = new Float32Array(pos);
  const indices = new Uint32Array(idx);
  const normals = new Float32Array(positions.length);
  if (o.normals === 'faces') {
    for (let t = 0; t < indices.length; t += 3) {
      const a = indices[t] * 3, b = indices[t + 1] * 3, c = indices[t + 2] * 3;
      const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
      const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
      const nx_ = uy * vz - uz * vy, ny_ = uz * vx - ux * vz, nz_ = ux * vy - uy * vx;
      for (const q of [a, b, c]) { normals[q] += nx_; normals[q + 1] += ny_; normals[q + 2] += nz_; }
    }
  } else {
    const h = 0.5 * Math.min(sx, sy, sz);
    for (let q = 0; q < positions.length; q += 3) {
      const x = positions[q], y = positions[q + 1], z = positions[q + 2];
      normals[q] = sdf(x + h, y, z) - sdf(x - h, y, z);
      normals[q + 1] = sdf(x, y + h, z) - sdf(x, y - h, z);
      normals[q + 2] = sdf(x, y, z + h) - sdf(x, y, z - h);
    }
  }
  for (let q = 0; q < normals.length; q += 3) {
    const l = Math.hypot(normals[q], normals[q + 1], normals[q + 2]) || 1;
    normals[q] /= l; normals[q + 1] /= l; normals[q + 2] /= l;
  }
  return { positions, normals, indices };
}

/** SDF helpers shared by procedural sculptures (pure maths). */
const sd = {
  sphere: (x, y, z, r) => Math.hypot(x, y, z) - r,
  ellipsoid(x, y, z, rx, ry, rz) { // Inigo Quilez bound-corrected approximation
    const k0 = Math.hypot(x / rx, y / ry, z / rz);
    const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
    return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(rx, ry, rz);
  },
  capsule(x, y, z, ax, ay, az, bx, by, bz, r) {
    const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
    const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz)));
    return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - r;
  },
  box(x, y, z, bx, by, bz) {
    const qx = Math.abs(x) - bx, qy = Math.abs(y) - by, qz = Math.abs(z) - bz;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
  },
  smin(a, b, k) { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; },
};

module.exports = { march, sd, _table: TABLE, _edges: EDGES };
