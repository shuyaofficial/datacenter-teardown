// 歩ける所の地図: glb の三角形のうち腰〜頭の高さに掛かるものを真上から 5 cm 格子に塗り、
// 体の半径ぶん太らせる。床より外も塞ぐ。歩行の当たり判定と、地点への道探し（A*）に使う。
import * as THREE from 'three';

const CELL = 0.05;
const Y_LO = 0.12, Y_HI = 2.0;      // この高さに掛かる物にぶつかる
const RADIUS = 0.2;

export function buildGrid(root, floor) {
  const fb = new THREE.Box3().setFromObject(floor ?? root);   // 床が無ければ全体の外形
  const x0 = fb.min.x, z0 = fb.min.z;
  const nx = Math.ceil((fb.max.x - x0) / CELL), nz = Math.ceil((fb.max.z - z0) / CELL);
  const solid = new Uint8Array(nx * nz);
  const mark = (ix, iz) => { if (ix >= 0 && iz >= 0 && ix < nx && iz < nz) solid[iz * nx + ix] = 1; };
  const cx = (x) => Math.floor((x - x0) / CELL), cz = (z) => Math.floor((z - z0) / CELL);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const seg = (p, q) => {
    const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / (CELL * 0.5)) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; mark(cx(p.x + (q.x - p.x) * t), cz(p.z + (q.z - p.z) * t)); }
  };
  const inTri = (px, pz) => {
    const d1 = (px - b.x) * (a.z - b.z) - (a.x - b.x) * (pz - b.z);
    const d2 = (px - c.x) * (b.z - c.z) - (b.x - c.x) * (pz - c.z);
    const d3 = (px - a.x) * (c.z - a.z) - (c.x - a.x) * (pz - a.z);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  root.traverse((o) => {
    if (!o.isMesh || o === floor) return;
    const pos = o.geometry.attributes.position, idx = o.geometry.index;
    const m = o.matrixWorld;
    const nTri = (idx ? idx.count : pos.count) / 3;
    for (let t = 0; t < nTri; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3;
      a.fromBufferAttribute(pos, i0).applyMatrix4(m);
      b.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 1) : t * 3 + 1).applyMatrix4(m);
      c.fromBufferAttribute(pos, idx ? idx.getX(t * 3 + 2) : t * 3 + 2).applyMatrix4(m);
      if (Math.max(a.y, b.y, c.y) < Y_LO || Math.min(a.y, b.y, c.y) > Y_HI) continue;
      const ix0 = cx(Math.min(a.x, b.x, c.x)), ix1 = cx(Math.max(a.x, b.x, c.x));
      const iz0 = cz(Math.min(a.z, b.z, c.z)), iz1 = cz(Math.max(a.z, b.z, c.z));
      if (ix1 - ix0 <= 1 && iz1 - iz0 <= 1) {
        for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) mark(ix, iz);
        continue;
      }
      seg(a, b); seg(b, c); seg(c, a);           // 縦の面は真上から見ると線になる
      // 真上から見て面積の無い三角形（縦の面）は辺だけで足りる。中を塗ると、斜めの縦の面が囲み全体を塞いでしまう
      if (Math.abs((b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z)) < 1e-6) continue;
      for (let iz = iz0; iz <= iz1; iz++) {
        for (let ix = ix0; ix <= ix1; ix++) {
          if (inTri(x0 + (ix + 0.5) * CELL, z0 + (iz + 0.5) * CELL)) mark(ix, iz);
        }
      }
    }
  });
  // 体の半径ぶん太らせる（床の縁も壁とみなす）
  const r = Math.ceil(RADIUS / CELL);
  const blocked = new Uint8Array(nx * nz);
  for (let iz = 0; iz < nz; iz++) {
    for (let ix = 0; ix < nx; ix++) {
      if (ix < r || iz < r || ix >= nx - r || iz >= nz - r) { blocked[iz * nx + ix] = 1; continue; }
      if (!solid[iz * nx + ix]) continue;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz > r * r) continue;
          const jx = ix + dx, jz = iz + dz;
          if (jx >= 0 && jz >= 0 && jx < nx && jz < nz) blocked[jz * nx + jx] = 1;
        }
      }
    }
  }
  return makeGrid({x0, z0, nx, nz, blocked, solid});
}

// 最小ヒープ（[優先度, 値]）
function heapPush(h, item) {
  h.push(item);
  for (let i = h.length - 1; i > 0;) {
    const p = (i - 1) >> 1;
    if (h[p][0] <= h[i][0]) break;
    [h[p], h[i]] = [h[i], h[p]]; i = p;
  }
}
function heapPop(h) {
  const top = h[0], last = h.pop();
  if (h.length) {
    h[0] = last;
    for (let i = 0; ;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < h.length && h[l][0] < h[m][0]) m = l;
      if (r < h.length && h[r][0] < h[m][0]) m = r;
      if (m === i) break;
      [h[m], h[i]] = [h[i], h[m]]; i = m;
    }
  }
  return top;
}

function makeGrid({x0, z0, nx, nz, blocked, solid}) {
  const ix = (x) => Math.floor((x - x0) / CELL), iz = (z) => Math.floor((z - z0) / CELL);
  const freeCell = (i, j) => i >= 0 && j >= 0 && i < nx && j < nz && !blocked[j * nx + i];
  const free = (x, z) => freeCell(ix(x), iz(z));
  const center = (i, j) => [x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL];

  // 壁に沿って滑る: 進めなければ x・z を別々に試す
  const slide = (from, to) => {
    if (free(to.x, to.z)) return to.clone();
    if (free(to.x, from.z)) return new THREE.Vector3(to.x, from.y, from.z);
    if (free(from.x, to.z)) return new THREE.Vector3(from.x, from.y, to.z);
    return from.clone();
  };

  const sight = (p, q, ok = free) => {
    const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / (CELL * 0.5)) + 1;
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      if (!ok(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)) return false;
    }
    return true;
  };
  // 目線の見通しは体の太さと関係ないので、太らせる前の障害物で見る
  const seeThrough = (x, z) => { const i = ix(x), j = iz(z); return i >= 0 && j >= 0 && i < nx && j < nz && !solid[j * nx + i]; };

  // 近い空きマスを探す（地点が太らせた壁に掛かっていても歩けるように）
  const nearestFree = (i, j) => {
    for (let r = 0; r < 20; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) === r && freeCell(i + di, j + dj)) return [i + di, j + dj];
      }
    }
    return null;
  };

  // A*（8 近傍）→ 見通しで間引いた折れ線（three の xz）
  const path = (from, to) => {
    const s = nearestFree(ix(from.x), iz(from.z)), g = nearestFree(ix(to.x), iz(to.z));
    if (!s || !g) return null;
    const N = nx * nz, key = (i, j) => j * nx + i;
    const gScore = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
    const open = [[0, key(...s)]]; gScore[key(...s)] = 0;
    const h = (k) => Math.hypot(k % nx - g[0], Math.floor(k / nx) - g[1]);
    const goal = key(...g);
    const closed = new Uint8Array(N);
    while (open.length) {
      const [, cur] = heapPop(open);
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const ci = cur % nx, cj = Math.floor(cur / nx);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = ci + di, nj = cj + dj;
        if (!freeCell(ni, nj) || (di && dj && (!freeCell(ci + di, cj) || !freeCell(ci, cj + dj)))) continue;
        const nk = key(ni, nj), cost = gScore[cur] + (di && dj ? Math.SQRT2 : 1);
        if (cost < gScore[nk]) { gScore[nk] = cost; prev[nk] = cur; heapPush(open, [cost + h(nk), nk]); }
      }
    }
    if (prev[goal] < 0 && goal !== key(...s)) return null;
    const cells = [];
    for (let k = goal; k >= 0; k = prev[k]) cells.unshift(center(k % nx, Math.floor(k / nx)));
    const pts = [[from.x, from.z]];
    let anchor = pts[0];
    for (let k = 1; k < cells.length; k++) {
      if (!sight(anchor, cells[k])) { anchor = cells[k - 1]; pts.push(anchor); }
    }
    pts.push([to.x, to.z]);
    return pts.map(([x, z]) => new THREE.Vector3(x, from.y, z));
  };

  // 見通し: 地点は太らせた壁に掛かっていることがあるので、道探しと同じく両端を近い空きマスへずらしてから見る
  // 地点はラックの前面の出っ張りのすき間に掛かることがあるので、両端の 0.45 m は調べない（札を出すかの判定用）
  const END = 0.45;
  const clear = (p, q) => {
    const L = Math.hypot(q.x - p.x, q.z - p.z);
    if (L <= END * 2) return true;
    const t0 = END / L, t1 = 1 - END / L;
    return sight([p.x + (q.x - p.x) * t0, p.z + (q.z - p.z) * t0], [p.x + (q.x - p.x) * t1, p.z + (q.z - p.z) * t1], seeThrough);
  };
  return Object.freeze({free, slide, path, clear, dims: {x0, z0, nx, nz, cell: CELL}, blocked});
}
