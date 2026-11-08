// Where things are, no three.js (the tests read it in node): the two racks' slots, the compute sled's parts, the back
// cables (the mesh inside a server and the Z ring between the four), the torus diagram beside the racks (one layer for
// chapter 3, four for chapters 4 and 5) with its links, wrap-around arcs and beads, the EFA route out of the pulled sled,
// and the caption line. Everything is a pure function of the scene's staged time; rack.js, sled.js and overlay.js only
// turn these numbers into meshes. Every shape here is 仮定 (AWS publishes no drawing).
//
// World millimetres: x across the front (right = +), y up from the floor, z front (+) to back (-).
import {
  coord,
  flatAt,
  FLAT_CYCLE,
  hierAt,
  hopAt,
  hopStats,
  INST,
  layerCycle,
  OUT,
  SCENES,
  sceneDuration,
  SPEC,
  U_MM,
  ULTRA,
  zRing,
  zringAt,
  inOutRatio,
  innerShare,
  flatSentGB,
  hierMs,
  compareAt,
  COMPARE_ROWS,
  torusAt,
} from './kin.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const smooth = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ polylines
export const pathLength = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(...p.map((v, k) => v - pts[i][k])), 0);
/** the point u (0..1) of the way along a polyline, by length */
export function along(pts, u) {
  const lens = pts.slice(1).map((p, i) => Math.hypot(...p.map((v, k) => v - pts[i][k])));
  let d = clamp(u, 0, 1) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? clamp(d / lens[i], 0, 1) : 0;
      return pts[i].map((v, j) => v + (pts[i + 1][j] - v) * k);
    }
    d -= lens[i];
  }
  return [...pts[0]];
}

// ------------------------------------------------------------ the scene clock
/** a chapter press: the scene waits while the camera settles; a scene press starts at once */
export const PRE = 1.4;
/** after a scene ends it holds its last state this long, then starts again */
export const HOLD = 2.4;
/** the scenes that run without end (their clock is not wrapped) */
const ENDLESS = new Set(['out', 'compare']);
export function sceneClock(scene, since, pre = 0) {
  if (!scene) return 0;
  const s = Math.max(0, since - pre);
  if (ENDLESS.has(scene)) return s;
  return s % (sceneDuration(scene) + HOLD);
}

// ------------------------------------------------------------ the two racks (仮定)
export const RACK = {w: SPEC.rack.w, h: SPEC.rack.h, d: SPEC.rack.d, zf: SPEC.rack.d / 2, zb: -SPEC.rack.d / 2, top: 2186, units: 46, post: 40};
export const RACK_X = [-360, 360];
/** a sled: 440 wide, 2U less a hair, 900 deep, its front 40 mm behind the rack's front */
export const SLED = {w: 440, h: SPEC.server.sledU * U_MM - 2, d: 900, zc: 44, pull: 980};
/** the bottom y of a sled whose top unit is u (1 = the rack's top unit) */
export const sledY = (u) => RACK.top - (u + SPEC.server.sledU - 1) * U_MM + 1;
/** the 4 servers: their rack and first unit. Numbered along the Z ring: A top → A bottom → B bottom → B top */
export const SERVERS = [
  {n: 1, rack: 0, u: 3},
  {n: 2, rack: 0, u: 25},
  {n: 3, rack: 1, u: 25},
  {n: 4, rack: 1, u: 3},
];
/** every sled: rack, server, kind, number within its kind in the server (1-based), top unit, bottom y, rack x */
export const SLOTS = SERVERS.flatMap((sv) => {
  const out = [];
  let u = sv.u;
  const seen = {};
  for (const [kind, n] of SPEC.server.order)
    for (let i = 0; i < n; i++) {
      seen[kind] = (seen[kind] || 0) + 1;
      out.push({rack: sv.rack, server: sv.n, kind, n: seen[kind], u, y0: sledY(u), x: RACK_X[sv.rack]});
      u += SPEC.server.sledU;
    }
  return out;
});
export const slotOf = (server, kind, n) => SLOTS.find((s) => s.server === server && s.kind === kind && s.n === n);
export const PULL = slotOf(SPEC.demo.pull.server, 'compute', SPEC.demo.pull.sled);

// the compute sled's parts, sled-local mm: x across, y up from the sled's floor, z front (+450) to back (-450)
export const CL = {
  chipX: [-110, 110],
  chipZ: -60,
  pkgS: 120,
  dieS: 84,
  boardY: 4,
  chipY: 12, // the package's lid top
  sink: {w: 140, d: 190, base: 6, fin: 58, fins: 15},
  fanX: [-120, -60, 0, 60, 120],
  fanZ: 250,
  fanS: 54,
  nicX: [-172, 172], // one network card per chip (仮定), its EFA port in the front
  nicZ: 370,
  nlX: [-150, -90, 90, 150], // the NeuronLink connectors at the back: mesh, mesh, Z (same rack), Z (other rack)
  backZ: -450,
  frontZ: 450,
  lift: {lid: 380, sinks: 250, chips: 118, io: 48},
};
/** world position of a sled-local point of the pulled sled, pulled out by pull (0..1) */
export const sledWorld = ([x, y, z], pull = 0) => [PULL.x + x, PULL.y0 + y, SLED.zc + z + pull * SLED.pull];

// ------------------------------------------------------------ the back cables (仮定: the drawing of a mesh, not a wiring plan)
const BACK = {conn: SLED.zc + CL.backZ - 28, zMesh: -452, zZ: -466, zH: -572};
export const mirror = (rack) => (rack === 0 ? 1 : -1);
const connAt = (s, cx) => [s.x + mirror(s.rack) * cx, s.y0 + SLED.h / 2, BACK.conn];
/** the mesh inside every server and the Z ring between them: [{pts, kind: 'mesh' | 'z'}] */
export function backCables() {
  const out = [];
  for (const sv of SERVERS) {
    const sl = SLOTS.filter((s) => s.server === sv.n && s.kind === 'compute');
    const sx = mirror(sv.rack);
    // the chain sled k ↔ k + 1, the skip k ↔ k + 2, the wrap 1 ↔ 8
    for (let k = 0; k < sl.length - 1; k++) {
      const a = connAt(sl[k], CL.nlX[0]);
      const b = connAt(sl[k + 1], CL.nlX[0]);
      out.push({kind: 'mesh', pts: [a, [a[0], a[1], BACK.zMesh], [b[0], b[1], BACK.zMesh], b]});
    }
    for (let k = 0; k < sl.length - 2; k += 1) {
      const a = connAt(sl[k], CL.nlX[1]);
      const b = connAt(sl[k + 2], CL.nlX[1]);
      const x = a[0] + sx * (k % 2 ? 14 : -14);
      out.push({kind: 'mesh', pts: [a, [x, a[1], BACK.zMesh - 8], [x, b[1], BACK.zMesh - 8], b]});
    }
    const a = connAt(sl[0], CL.nlX[1]);
    const b = connAt(sl[sl.length - 1], CL.nlX[1]);
    const xw = sv.rack === 0 ? a[0] + 34 : a[0] - 34;
    out.push({kind: 'mesh', pts: [a, [xw, a[1], BACK.zMesh - 20], [xw, b[1], BACK.zMesh - 20], b]});
  }
  // Z: 1 ↔ 2 and 3 ↔ 4 down the racks, 2 ↔ 3 and 4 ↔ 1 across behind them (the same sled number = the same chips)
  const pair = (p, q, vertical) => {
    for (let k = 1; k <= SPEC.server.compute; k++) {
      const s = slotOf(p, 'compute', k);
      const t = slotOf(q, 'compute', k);
      if (vertical) {
        const a = connAt(s, CL.nlX[2]);
        const b = connAt(t, CL.nlX[2]);
        const x = a[0] + mirror(s.rack) * (k - 4.5) * 5;
        out.push({kind: 'z', pts: [a, [x, a[1], BACK.zZ], [x, b[1], BACK.zZ], b]});
      } else {
        const a = connAt(s, CL.nlX[3]);
        const b = connAt(t, CL.nlX[3]);
        const z = BACK.zH - (k - 4.5) * 5;
        out.push({kind: 'z', pts: [a, [a[0], a[1], z], [b[0], b[1], z], b]});
      }
    }
  };
  pair(1, 2, true);
  pair(3, 4, true);
  pair(2, 3, false);
  pair(4, 1, false);
  return out;
}
/** the EFA cables at the front: every compute sled's 2 ports into a bundle at the rack's sides, down to the floor */
export function efaCables() {
  const out = [];
  const zc = SLED.zc + CL.frontZ + 30;
  for (const s of SLOTS.filter((q) => q.kind === 'compute')) {
    if (s === PULL) continue;
    for (const nx of CL.nicX) {
      const y = s.y0 + 30;
      const xb = s.x + Math.sign(nx) * 238;
      out.push([[s.x + nx, y, SLED.zc + CL.frontZ + 4], [s.x + nx, y, zc], [xb, y, zc]]);
    }
  }
  for (const x of RACK_X) for (const sx of [-1, 1]) out.push([[x + sx * 238, sledY(3) + 40, zc], [x + sx * 238, 120, zc]]);
  return out;
}

// ------------------------------------------------------------ the torus diagram (chapters 3-5): a picture, not the real layout
export const LAT = {x: -2300, z: 260, sp: 250, floorY: [2050, 1560, 1070, 580], node: 86, arch: 150, out: 82, zOut: 64};
/** a layer's y as the 3 others come in (k = 0: all on top of layer 0, k = 1: in their places) */
export const layerY = (z, k = 1) => LAT.floorY[0] + (LAT.floorY[z] - LAT.floorY[0]) * k;
/** chip i's place in the diagram */
export const nodeW = (i, k = 1) => {
  const [x, y, z] = coord(i, ULTRA);
  return [LAT.x + (x - 1.5) * LAT.sp, layerY(z, k), LAT.z + (y - 1.5) * LAT.sp];
};
const HALF = 1.5 * LAT.sp;
/** the drawn path of the link a → b: straight between neighbours; the x wrap an arch above the layer; the y wrap a loop
 * round the side of the layer, in its plane (columns 0, 1 round the left, 2, 3 round the right, nested so they never
 * cross); the z wrap a path down the side of the column */
export function edgePath(a, b, k = 1) {
  const ca = coord(a);
  const cb = coord(b);
  const pa = nodeW(a, k);
  const pb = nodeW(b, k);
  const dim = ca.findIndex((v, j) => v !== cb[j]);
  if (Math.abs(ca[dim] - cb[dim]) <= 1) return [pa, pb];
  if (dim === 0) {
    const N = 14;
    const s = ca[0] > cb[0] ? 1 : -1;
    const R = HALF + LAT.out;
    const pts = [pa];
    for (let i = 0; i <= N; i++) {
      const th = (i / N) * Math.PI;
      pts.push([LAT.x + s * R * Math.cos(th), pa[1] + LAT.arch * Math.sin(th), pa[2]]);
    }
    pts.push(pb);
    return pts;
  }
  if (dim === 1) {
    const col = ca[0];
    const side = col < 2 ? -1 : 1;
    const R = HALF + 46 + 30 * (col < 2 ? col : 3 - col);
    const zs = ca[1] > cb[1] ? 1 : -1; // out past the edge a sits on (+1: a is the front, y = 3)
    const y = pa[1] + 2;
    return [pa, [pa[0], y, LAT.z + zs * R], [LAT.x + side * R, y, LAT.z + zs * R], [LAT.x + side * R, y, LAT.z - zs * R], [pb[0], y, LAT.z - zs * R], pb];
  }
  // z wrap: out to the side of the column, along it, back in
  const x = pa[0] + LAT.zOut;
  return [pa, [x, pa[1], pa[2]], [x, pb[1], pb[2]], pb];
}
/** every link of the diagram: [{a, b, dim, wrap, pts}] for the instance (dims 4 × 4 × 1) or the UltraServer */
export function diagramLinks(dims = ULTRA, k = 1) {
  const out = [];
  const n = dims[0] * dims[1] * dims[2];
  for (let i = 0; i < n; i++) {
    const c = coord(i);
    for (let d = 0; d < 3; d++) {
      if (dims[d] < 2) continue;
      const cc = [...c];
      cc[d] = (cc[d] + 1) % dims[d];
      const j = cc[0] + 4 * (cc[1] + 4 * cc[2]);
      out.push({a: i, b: j, dim: d, wrap: cc[d] === 0, pts: edgePath(i, j, k)});
    }
  }
  return out;
}
/** a bead on its route at staged t: the point, and how much of the route is behind it */
export function beadOn(path, kEdge, u, k = 1) {
  const pts = edgePath(path[kEdge], path[kEdge + 1], k);
  return along(pts, smooth(u));
}
export const hopPose = (t) => {
  const h = hopAt(t);
  return {...h, p: beadOn(h.path, h.k, h.u)};
};
export const zringPose = (t) => {
  const z = zringAt(t);
  return {...z, p: beadOn(z.path, z.k, z.u)};
};
/** the flat ring's 64 beads: chunk j sits at place (j + step) of the ring and slides one link per step */
export function flatBeads(t) {
  const f = flatAt(t);
  const pos = f.u * f.steps;
  const base = Math.min(f.steps - 1, Math.floor(pos));
  const frac = f.done ? 1 : smooth(pos - base);
  const N = FLAT_CYCLE.length;
  return Array.from({length: N}, (_, j) => {
    const a = FLAT_CYCLE[(j + base) % N];
    const b = FLAT_CYCLE[(j + base + 1) % N];
    return {j, p: along(edgePath(a, b), frac), gather: f.phase === 'gather', inter: coord(a)[2] !== coord(b)[2]};
  });
}
/** the hierarchical beads: the layers' rings (15 steps), the z rings (6 steps), the layers' rings again (15 steps) */
export function hierBeads(t) {
  const h = hierAt(t);
  const out = [];
  if (h.phase === 'in1' || h.phase === 'in2') {
    const u = h.phase === 'in1' ? h.p1 : h.p3;
    const pos = u * 15;
    const base = Math.min(14, Math.floor(pos));
    const frac = smooth(pos - base);
    for (let z = 0; z < 4; z++) {
      const cyc = layerCycle(z);
      for (let j = 0; j < 16; j++) out.push({p: along(edgePath(cyc[(j + base) % 16], cyc[(j + base + 1) % 16]), frac), done: h.phase === 'in2', small: false});
    }
  } else if (h.phase === 'z') {
    const pos = h.p2 * 6;
    const base = Math.min(5, Math.floor(pos));
    const frac = smooth(pos - base);
    for (let i = 0; i < 16; i++) {
      const ring = zRing(i);
      for (let j = 0; j < 4; j++) out.push({p: along(edgePath(ring[(j + base) % 4], ring[(j + base + 1) % 4]), frac), done: false, small: true});
    }
  }
  return {beads: out, phase: h.phase};
}

// ------------------------------------------------------------ chapter 6: out of the server
/** the EFA switch outside (a box in front of the racks, to the left) */
export const EFA = {at: [-1080, 1800, 1560], w: 300, h: 60, d: 220};
/** chip 1 → its network card → the EFA port → the cable → the EFA switch (sled pulled by pull) */
export function outPath(pull = 1) {
  const W = (x, y, z) => sledWorld([x, y, z], pull);
  const [ox, oy, oz] = W(CL.nicX[0], 30, CL.frontZ + 5);
  return [
    W(CL.chipX[0], 26, CL.chipZ),
    W(CL.chipX[0], 26, 300),
    W(CL.nicX[0], 26, 300),
    W(CL.nicX[0], 26, CL.nicZ),
    [ox, oy, oz],
    [ox, oy, oz + 120],
    [EFA.at[0] + 60, oy + 80, oz + 120],
    [EFA.at[0] + 60, EFA.at[1] - EFA.h / 2, EFA.at[2]],
  ];
}
/** chip 1 → its NeuronLink connector at the back of the pulled sled */
export function nlStubPath(pull = 1) {
  const W = (x, y, z) => sledWorld([x, y, z], pull);
  return [W(CL.chipX[0], 26, CL.chipZ), W(CL.chipX[0], 26, CL.backZ + 50), W(CL.nlX[0], 26, CL.backZ + 50), W(CL.nlX[0], 26, CL.backZ - 4)];
}
/** beads on both: [{u}] along each path at staged t; the NeuronLink side carries ratio times as many */
export function outBeads(t) {
  const per = 1 / OUT.perSecOut;
  const outs = [];
  for (let k = Math.floor((t - OUT.travelOut) / per); k <= Math.floor(t / per); k++) {
    const s = t - k * per;
    if (s >= 0 && s <= OUT.travelOut) outs.push({k, u: s / OUT.travelOut});
  }
  const ratio = inOutRatio();
  const perIn = per / ratio;
  const ins = [];
  for (let k = Math.floor((t - OUT.travelIn) / perIn); k <= Math.floor(t / perIn); k++) {
    const s = t - k * perIn;
    if (s >= 0 && s <= OUT.travelIn) ins.push({k, u: s / OUT.travelIn});
  }
  return {outs, ins, ratio};
}

// ------------------------------------------------------------ chapter 7: the NVL72 silhouette (its size from nvl72's SPEC via kin)
export const NV_AT = {x: -1420, z: 0};

// ------------------------------------------------------------ the caption line over the 3D view
const fx = (n, d) => Number(n).toFixed(d);
export function captionOf(scene, t) {
  if (!scene) return '';
  switch (scene) {
    case 'torus': {
      const s = torusAt(t);
      if (s.nbK > 0.5) return 'デバイス 0 の隣は 1・3・4・12（neuron-ls の例と同じ）。3 と 12 は回り込みの隣';
      if (s.wrapK > 0.2) return '端のチップは反対側の端へ回り込む（外側の弧）';
      return '1 台の 16 個を 4 × 4 の格子に並べた図。上下左右の隣と直結';
    }
    case 'hop': {
      const h = hopAt(t);
      if (h.done) return `デバイス 10 に届いた。隣から隣へ中継して ${h.hops} 段（1 台の中で最遠）`;
      if (h.hops === 0 && t < 0.5) return 'デバイス 0 が送り出す。スイッチは無い';
      return `隣のチップが受け取って次へ渡す（${h.hops} 段目まで）`;
    }
    case 'zring': {
      const z = zringAt(t);
      if (z.waiting && z.ringsK < 0.05) return '同じ形の 4 台を重ねる';
      if (z.waiting) return '同じ座標の 4 個をリングで結ぶ（細い「間」のリンク）→ 4 × 4 × 4';
      if (z.done) return `最遠は ${z.hops} 段: x に 2、y に 2、z に 2`;
      return `デバイス 0 → 42: x → y → z の順に近い向きへ（${z.hops} 段目まで）`;
    }
    case 'flat': {
      const f = flatAt(t);
      return f.done ? `1 本の輪: チップ 1 個が ${fx(f.sentGB, 3)} GB 送った（${f.steps} 回に分けて隣へ）` : '64 個を 1 本の輪で回す。輪は細い「間」のリンクも通る';
    }
    case 'hier': {
      const h = hierAt(t);
      if (h.phase === 'in1') return '1. 中で集計: 4 台がそれぞれ 16 個の輪で足す（太いリンク）';
      if (h.phase === 'z') return '2. 間で集計: 1/16 ずつに減った分だけを 4 台の間で足す（細いリンク）';
      return `3. 中で配り直す。送った量は同じ ${fx(flatSentGB(), 3)} GB、うち ${fx(innerShare() * 100, 1)} % が中`;
    }
    case 'out':
      return `同じ時間に運べる量: NeuronLink は EFA の ${fx(inOutRatio(), 1)} 倍（仮定つき）`;
    case 'compare': {
      const c = compareAt(t);
      const r = COMPARE_ROWS[Math.max(0, c.lit - 1)];
      return c.lit ? `${r.k}: NVL72 ${r.nv} ／ Trn2 UltraServer ${r.tr}` : 'NVL72 と Trn2 UltraServer を並べる';
    }
    default:
      return '';
  }
}
export {SCENES, hopStats, INST, hierMs};
