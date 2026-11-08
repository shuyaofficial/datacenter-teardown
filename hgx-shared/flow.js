// Where things are, no three.js (the tests read it in node): the chassis and its two trays, the GPU tray's parts, the
// NVLink routes (fan, hop), the way out through ConnectX-7 and the leaf (wall), the 9 boxes and 8 rails (rails, hier,
// vs72), the 42U rack, the power and the air paths, and the caption line. Everything is a pure function of the scene's
// staged time; chassis.js, trays.js, cluster.js and overlay.js only turn these numbers into meshes.
//
// World millimetres: x across the front (right = +), y up from the floor, z front (+) to back (-). The detailed DGX B200
// stands at the origin (box 0); the 8 others of chapters 4-5 stand to its right.
import {chipFor, FAN, fanAt, hierAt, HOP_LEGS, hopAt, linksPerChip, NV, osfpOf, railsAt, rackAt, SCENES, sceneDuration, SPEC, vs72At, WALL} from './kin.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (x) => {
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
const shift = (pts, dx) => pts.map(([x, y, z]) => [x + dx, y, z]);

// ------------------------------------------------------------ the scene clock
/** a chapter press: the scene waits while the camera settles; a scene press starts at once */
export const PRE = 1.4;
/** after a scene ends it holds its last state this long, then starts again */
export const HOLD = 2.4;
/** the scenes that run without end (their clock is not wrapped) */
const ENDLESS = new Set(['wall', 'power', 'rack', 'air']);
export function sceneClock(scene, since, pre = 0) {
  if (!scene) return 0;
  const s = Math.max(0, since - pre);
  if (ENDLESS.has(scene)) return s;
  return s % (sceneDuration(scene) + HOLD);
}

// ------------------------------------------------------------ the chassis (10U: 444 x 482.3 x 897.1 mm)
export const CH = {W: 445, Wear: SPEC.chassis.w, H: SPEC.chassis.h, D: SPEC.chassis.d, zF: SPEC.chassis.d / 2, zB: -SPEC.chassis.d / 2, face: 430, wall: 3};
/** the motherboard tray (pulled out of the back by pull × MB.pull) */
export const MB = {x: [-219, 219], y: [4, 128], z: [-446, 290], pull: 760};
/** the midplane between the motherboard tray and the front */
export const MID = {z: 299, y: [4, 196]};
/** the 6 power supplies at the back, PSU0 on the left seen from behind */
export const PSU = {y: [134, 196], z: [-446, -246], w: 68, x: (i) => 180 - 72 * i};
/** the GPU tray: the HGX B200 board with 8 B200 (2 columns x 4) and 2 NVSwitch chips between the columns */
export const GT = {
  board: {y: [200, 204], z: [-440, 340], x: [-212, 212]},
  gpuX: [-112, 112],
  gpuZ: [250, 100, -50, -200],
  pkg: 70,
  die: 42,
  sink: {w: 150, d: 136, y: [207, 384]},
  nvsX: 0,
  nvsZ: [100, -50],
  nvsS: 44,
  nvsSink: {s: 56, y: [207, 262]},
  top: 212, // the packages' top: the NVLink lines run just above
  lid: {y: [440, 444], z: [-446, 346]},
  lift: {lid: 250, sinks: 175},
};
/** the front: fan modules (2 x 6, 仮定), the U.2 bays, the buttons */
export const FRONT = {fanZ: [352, 428], fanRows: [[146, 290], [294, 438]], fanX: (i) => -182 + 72.8 * i, fanW: 70, u2Y: [16, 126], u2Z: [360, 428], u2X: (i) => -176 + 19 * i, u2W: 16, btnX: 172, btnY: [60, 92]};
/** the motherboard tray's parts (chassis coordinates with the tray in; the tray moves them all by its pull) */
export const ML = {
  osfpX: [135, 75, 15, -45], // OSFP1..4 on the back panel
  osfpY: [42, 98],
  portY: {P1: 82, P2: 58},
  bf3X: [-110, -168],
  mgmtX: [184, 205],
  cardZ: {P1: -300, P2: -380},
  card: {w: 44, d: 64, y: 14},
  bf3: {w: 50, z: [-430, -290]},
  cpuX: [-110, 110],
  cpuZ: 110,
  cpuSink: {w: 84, d: 100, y: [14, 96]},
  dimm: {y: [10, 44], z: [44, 176], t: 4, gap: 7.6, off: 46},
  m2X: [-28, 28],
  m2Z: -170,
  baffle: {y: [98, 104], z: [26, 204]},
  lift: {baffle: 170, cpuSinks: 95},
};
export const gpuXZ = (g) => [GT.gpuX[g < 4 ? 0 : 1], GT.gpuZ[g % 4]];
/** GPU g's top centre (box b) */
export const gpuW = (g, b = 0) => {
  const [x, z] = gpuXZ(g);
  return [boxX(b) + x, GT.top, z];
};
export const chipW = (c) => [GT.nvsX, GT.top, GT.nvsZ[c]];
/** the ConnectX-7 card and the OSFP port of GPU g (port 'nP1' / 'nP2') */
export const nicOf = (g) => {
  const key = osfpOf(g);
  const n = Number(key[0]);
  const p = key.slice(1);
  return {key, n, p, x: ML.osfpX[n - 1], y: ML.portY[p], cardZ: ML.cardZ[p]};
};
/** the DIMMs: 8 on each side of each CPU */
export const dimmXs = () => ML.cpuX.flatMap((cx) => [-1, 1].flatMap((s) => Array.from({length: 8}, (_, j) => cx + s * (ML.dimm.off + j * ML.dimm.gap))));

// ------------------------------------------------------------ chapter 4-5: the 9 boxes, the 8 leaves, the 42U rack, NVL72
export const CL = {pitch: 700, leafY: 960, leafZ: -650, leafW: 440, leafH: 44, leafD: 380, markY: 446, markS: 64};
export const boxX = (b) => b * CL.pitch;
export const leafX = (k) => CL.pitch / 2 + CL.pitch * k;
/** a GPU's marker on its box's lid (the rails diagram) */
export const markerW = (b, g) => {
  const [x, z] = gpuXZ(g);
  return [boxX(b) + x, CL.markY + 8, z];
};
/** the rail line from GPU g of box b to leaf g */
export const railLine = (b, g) => {
  const m = markerW(b, g);
  return [[m[0], m[1] + 8, m[2]], [leafX(g) + (b - 4) * 16, CL.leafY - CL.leafH / 2, CL.leafZ]];
};
export const R42 = {x: -2600, w: 600, d: 1070, base: 80, top: 80 + SPEC.rack.u * SPEC.U_MM, h: 80 + SPEC.rack.u * SPEC.U_MM + 70, slide: 1150};
export const slotY = (i) => R42.base + i * SPEC.chassis.u * SPEC.U_MM + 0.5;
export const NVR = {x: 6450, w: NV.rack.w, h: NV.rack.h, d: NV.rack.d};
export const BARS = {dgx: [boxX(4), 0, 980], nv: [NVR.x, 0, 980], s: 170, mmPerMs: 220};

// ------------------------------------------------------------ NVLink routes (chapter 3)
/** link l (0..17) of GPU 0: 9 to each chip, straight across the board, the two bundles never cross */
export function fanLinkPath(l) {
  const per = linksPerChip();
  const c = Math.floor(l / per);
  const j = l % per;
  const [gx, gz] = gpuXZ(SPEC.demo.hopFrom);
  const zs = c === 0 ? gz - 4 + j * 3.4 : gz - 32 + j * 3.4;
  const y = GT.top + 2;
  return [[gx + GT.pkg / 2, y, zs], [GT.nvsX - GT.nvsS / 2, y, GT.nvsZ[c] - 16 + j * 4]];
}
export function fanPose(t) {
  const f = fanAt(t);
  return {...f, paths: f.links.map((k, l) => ({l, c: Math.floor(l / linksPerChip()), k, pts: fanLinkPath(l)}))};
}
/** the hop: GPU a → chip → GPU b over the board */
export function hopLegs(a = SPEC.demo.hopFrom, b = SPEC.demo.hopTo) {
  const c = chipFor(a, b);
  const y = GT.top + 2;
  const [ax, az] = gpuXZ(a);
  const [bx, bz] = gpuXZ(b);
  const [cx, , cz] = chipW(c);
  const sa = Math.sign(cx - ax);
  const sb = Math.sign(bx - cx);
  const A = [[ax, y, az], [ax + (sa * GT.pkg) / 2, y, az - 10], [cx - (sa * GT.nvsS) / 2, y, cz + 6], [cx, y, cz]];
  const B = [[cx, y, cz], [cx + (sb * GT.nvsS) / 2, y, cz + 6], [bx - (sb * GT.pkg) / 2, y, bz - 10], [bx, y, bz]];
  return {c, A, B, gpu: [A[0], A[0]], up: A, chip: [A[3], A[3]], down: B, arrive: [B[3], B[3]]};
}
export function hopPose(t) {
  const h = hopAt(t);
  const legs = hopLegs(h.a, h.b);
  const p = along(legs[h.leg], ease(h.u));
  const iChip = HOP_LEGS.findIndex((l) => l.id === 'chip');
  return {...h, p, legs, firstDone: h.legIndex >= iChip, secondShown: h.legIndex > iChip};
}

// ------------------------------------------------------------ chapter 4: the wall
/** GPU g of box b down through the midplane to its ConnectX-7 and out of its OSFP port */
export function insidePath(g = SPEC.demo.wallGpu, b = 0) {
  const [gx, gz] = gpuXZ(g);
  const n = nicOf(g);
  const pts = [
    [gx, GT.top + 2, gz],
    [gx, GT.top + 2, MID.z + 16],
    [gx, 64, MID.z + 16],
    [gx, 64, MB.z[1] - 10],
    [n.x, 64, MB.z[1] - 10],
    [n.x, 64, n.cardZ + 40],
    [n.x, ML.card.y + 10, n.cardZ],
    [n.x, n.y, MB.z[0] + 6],
    [n.x, n.y, CH.zB - 1],
  ];
  return shift(pts, boxX(b));
}
/** the whole way to the 9th GPU: box 0 GPU 0 → OSFP4 P2 → the leaf of rail 0 → box 1 OSFP4 P2 → box 1 GPU 0 */
export function wallPath() {
  const g = SPEC.demo.wallGpu;
  const k = SPEC.demo.wallRail;
  const a = insidePath(g, 0);
  const b = [...insidePath(g, 1)].reverse();
  const yUp = CL.leafY - 100;
  const yL = CL.leafY - CL.leafH / 2;
  const [ax, ay] = a[a.length - 1];
  const [bx, by] = b[0];
  const lx0 = leafX(k) - 150;
  const lx1 = leafX(k) + 150;
  const cable = [
    [ax, ay, CL.leafZ],
    [ax, yUp, CL.leafZ],
    [lx0, yUp, CL.leafZ],
    [lx0, yL, CL.leafZ],
    [lx1, yL, CL.leafZ],
    [lx1, yUp, CL.leafZ],
    [bx, yUp, CL.leafZ],
    [bx, by, CL.leafZ],
  ];
  return {inA: a, cable, inB: b, all: [...a, ...cable, ...b], leaf: [leafX(k), yL, CL.leafZ], osfpA: a[a.length - 1], osfpB: b[0], cardA: a[6], cardB: b[b.length - 7]};
}
/** the NVLink side of the wall: GPU 0 → NVSwitch → GPU 5 in box 0 */
export const wallNvPath = () => {
  const h = hopLegs();
  return [...h.A, ...h.B.slice(1)];
};
/** beads on both at staged t: [{u}] along each path; the NVLink side carries ratio times as many */
export function wallBeads(t) {
  const per = 1 / WALL.perSecOut;
  const outs = [];
  for (let k = Math.floor((t - WALL.travelOut) / per); k <= Math.floor(t / per); k++) {
    const s = t - k * per;
    if (s >= 0 && s <= WALL.travelOut) outs.push({k, u: s / WALL.travelOut});
  }
  const ratio = Math.round((SPEC.nvlink.gpuTBs * 1000) / ((SPEC.net.cx7Gbps * 2) / 8));
  const perIn = per / ratio;
  const ins = [];
  for (let k = Math.floor((t - WALL.travelIn) / perIn); k <= Math.floor(t / perIn); k++) {
    const s = t - k * perIn;
    if (s >= 0 && s <= WALL.travelIn) ins.push({k, u: s / WALL.travelIn});
  }
  return {outs, ins, ratio};
}

// ------------------------------------------------------------ chapter 5: the beads of the 2-stage all-reduce
/** the 8 GPUs of a box in a loop: column 0 front to back, column 1 back to front */
export const LOOP = [0, 1, 2, 3, 7, 6, 5, 4];
const loopPts = (b) => [...LOOP, LOOP[0]].map((g) => markerW(b, g).map((v, i) => (i === 1 ? v + 14 : v)));
/** hier at staged t: in-box beads (stages 1 and 3, 7 steps around the loop) and rail beads (stage 2, 16 steps on the ring of 9) */
export function hierBeads(t) {
  const h = hierAt(t);
  const boxes = SPEC.allreduce.gpus / SPEC.gpus;
  const ins = [];
  const outs = [];
  const uIn = h.stage === 1 ? h.u1 : h.stage === 3 ? h.u3 : -1;
  if (uIn >= 0) {
    for (let b = 0; b < boxes; b++) {
      const pts = loopPts(b);
      for (let i = 0; i < SPEC.gpus; i++) ins.push(along(pts, ((i + uIn * (SPEC.gpus - 1)) % SPEC.gpus) / SPEC.gpus));
    }
  }
  if (h.stage === 2) {
    const steps = 2 * (boxes - 1);
    const pos = h.u2 * steps;
    const s = Math.min(steps - 1, Math.floor(pos));
    const f = ease(pos - s);
    for (let g = 0; g < SPEC.gpus; g++)
      for (let b = 0; b < boxes; b++) {
        const b1 = (b + s) % boxes;
        const b2 = (b1 + 1) % boxes;
        const l1 = railLine(b1, g);
        const l2 = railLine(b2, g);
        outs.push(along([l1[0], l1[1], l2[1], l2[0]], f));
      }
  }
  return {ins, outs, stage: h.stage};
}

// ------------------------------------------------------------ chapter 6: power, dashes along paths
export const DASH = {dash: 40, gap: 46, speed: 260};
/** dashes along a path at time T: [{a, b}] (world points); speed 0 stops them (reduced motion) */
export function dashes(pts, T, speed = DASH.speed, dash = DASH.dash, gap = DASH.gap) {
  const len = pathLength(pts);
  const step = dash + gap;
  const off = (((T * speed) % step) + step) % step;
  const out = [];
  for (let s = off - step; s < len; s += step) {
    const a = Math.max(0, s);
    const b = Math.min(len, s + dash);
    if (b - a < 2) continue;
    out.push({a: along(pts, a / len), b: along(pts, b / len)});
  }
  return out;
}
export const dashCount = (pts, dash = DASH.dash, gap = DASH.gap) => Math.ceil(pathLength(pts) / (dash + gap)) + 2;
/** the cords into the 6 supplies, on into the box; the trunk up to the GPU tray and down to the motherboard tray */
export function powerPaths() {
  const y = (PSU.y[0] + PSU.y[1]) / 2;
  const zIn = PSU.z[1] - 6;
  const feeds = Array.from({length: SPEC.power.psus}, (_, i) => {
    const x = PSU.x(i);
    return [[x, y, CH.zB - 220], [x, y, zIn]];
  });
  // the 5 working supplies feed one bar across the box, then up to the GPU tray and down to the motherboard tray
  const zBus = zIn + 20;
  return {feeds, on: feeds.slice(0, SPEC.power.need), spare: feeds.slice(SPEC.power.need), bus: [[PSU.x(0), y, zBus], [PSU.x(SPEC.power.need - 1), y, zBus]], up: [[0, y, zBus], [0, 330, zBus]], down: [[0, y, zBus], [0, 66, zBus]]};
}
/** the air: lanes from in front of the box to behind it, through the GPU tray and the motherboard tray; each lane in
 * three parts (cold, warming, warm) */
export function airLanes() {
  const lanes = [];
  for (const y of [255, 390, 66]) for (const x of [-120, 120]) lanes.push({x, y, gpu: y > 200});
  const zs = [CH.zF + 320, 300, -300, CH.zB - 380];
  return lanes.map((l) => ({...l, parts: [0, 1, 2].map((k) => [[l.x, l.y, zs[k]], [l.x, l.y, zs[k + 1]]])}));
}

// ------------------------------------------------------------ the caption line over the 3D view
const fx = (n, d) => Number(n).toFixed(d);
export function captionOf(scene, t, opts = {}) {
  if (!scene) return '';
  const S = SPEC;
  switch (scene) {
    case 'fan': {
      const f = fanAt(t);
      return f.lit < 18 ? `GPU 0 から 18 本のリンク（${f.lit} / 18）。9 本ずつ 2 個の NVSwitch へ` : '18 本 = 9 本 × 2 個。どの GPU も同じ 2 個のチップにつながる';
    }
    case 'hop': {
      const h = hopAt(t);
      if (h.leg === 'chip') return `NVSwitch ${h.chip} が出口のポートを選ぶ。通ったスイッチは 1 個`;
      if (h.done || h.leg === 'arrive') return 'GPU 5 に届いた。箱の中ならどの組でもスイッチ 1 段';
      return h.ja;
    }
    case 'wall':
      return `9 個目の GPU へは NVLink が届かない。同じ時間に運べる量は NVLink が ${Math.round((S.nvlink.gpuTBs * 1000) / ((S.net.cx7Gbps * 2) / 8))} 倍`;
    case 'rails': {
      const r = railsAt(t);
      return r.lit < r.inDomain ? '9 台の同じ番号の GPU が同じリーフへ（8 本のレール）' : `NVLink で届くのは 71 個中 ${r.inDomain} 個（${fx(r.frac * 100, 1)} %）だけ`;
    }
    case 'hier': {
      const h = hierAt(t);
      if (h.stage === 1) return '段 1: 箱の中で 8 等分して集める（NVLink）';
      if (h.stage === 2) return '段 2: 同じ番号の GPU 9 個で外のリング（InfiniBand）';
      if (h.stage === 3) return '段 3: 箱の中で配る（NVLink）';
      return `GPU 1 個が送ったのは 中 ${fx(h.sentInGB, 2)} GB・外 ${fx(h.sentOutGB, 4)} GB、合計 ${fx(h.ms, 3)} ms`;
    }
    case 'vs72': {
      const v = vs72At(t);
      return v.done ? `NVL72 は ${fx(v.nvMs, 3)} ms、DGX B200 × 9 は ${fx(v.dgxMs, 3)} ms。違うのは NVLink で届く範囲` : '同じ 1 GB の集計。時計は同じ速さで進める';
    }
    case 'power':
      return `電源 5 台で ${fx(S.power.need * S.power.psuKW, 1)} kW、6 台目は予備（5+1）`;
    case 'rack': {
      const r = rackAt(t, opts.limit ?? S.rack.limitDefault, opts.from ?? 0);
      return `上限 ${opts.limit ?? S.rack.limitDefault} kW（仮定）: 場所は ${r.slots} 台ぶん、電力で ${r.n} 台まで`;
    }
    case 'air':
      return `前（淡い）から吸って後ろ（濃い）へ。温度差 ${fx(opts.dT ?? 16.2, 1)} K`;
    default:
      return '';
  }
}
export {SCENES, FAN};
