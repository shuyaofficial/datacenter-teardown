// Where things are, no three.js (the tests read it in node): the rack's slots, the TPU tray's parts, the torus diagram
// beside the rack and the routes on it (six, hop, wrap), the 4 small cubes and the OCS of chapter 4, the pod's 144
// racks, the NVL72 ring of chapter 5, the way out of the pod (chapter 6), the power and the coolant paths (chapter 7)
// and the caption line. Everything is a pure function of the scene's staged time; rack.js, tray.js, ocs.js and
// overlay.js only turn these numbers into meshes.
//
// World millimetres: x across the front (right = +), y up from the floor, z front (+) to back (-).
// The torus diagram maps chip (x, y, z) to world x, -z (y goes back), y (z goes up): a tray (the same z) lies flat.
import {hopAt, ocsAt, OUT, rackSlotOf, route, SCENES, sceneDuration, sixAt, SPEC, swapAt, vsAt, wrapAt} from './kin.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

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
const ENDLESS = new Set(['out', 'power', 'cool', 'pod']);
export function sceneClock(scene, since, pre = 0) {
  if (!scene) return 0;
  const s = Math.max(0, since - pre);
  if (ENDLESS.has(scene)) return s;
  return s % (sceneDuration(scene) + HOLD);
}

// ------------------------------------------------------------ the rack (2,300 × 1,200 × 1,200 mm: 仮定)
export const RACK = {w: SPEC.rack.w, h: SPEC.rack.h, d: SPEC.rack.d, zf: SPEC.rack.d / 2, zb: -SPEC.rack.d / 2, post: 50, base: 70};
/** the two columns of trays */
export const COLX = [-290, 290];
/** a TPU tray: 500 wide, 100 high, 1,000 deep, its front 80 mm behind the rack's front */
export const TRAY = {w: 500, h: 100, d: 1000, zc: 20, pull: 860};
export const HOST = {h: 62};
/** a pair (host tray under, TPU tray over) every 180 mm from y 270 */
export const PAIR = {y0: 270, pitch: 180, trayDy: 72};
/** the sections from the bottom: battery, (the 8 rows), patch panel, ToR・monitor, rectifiers, drip pan, top cap */
export const SECT = {bbu: [86, 256], patch: [1716, 1836], tor: [1846, 1950], rect: [1962, 2136], drip: [2148, 2192], cap: [2236, 2300]};
export const rowY = (r) => PAIR.y0 + r * PAIR.pitch;
export const trayY = (n) => rowY(rackSlotOf(n).row) + PAIR.trayDy;
export const hostY = (n) => rowY(rackSlotOf(n).row);
export const trayX = (n) => COLX[rackSlotOf(n).col];
/** the outer side of a column: −1 left, +1 right */
export const sideOf = (n) => (rackSlotOf(n).col ? 1 : -1);

// the TPU tray's parts, tray-local mm: x across (left col: as is; the right column is the same tray), y up from the
// tray's floor, z front (+500) to back (-500)
export const TL = {
  chipX: [-195, -65, 65, 195],
  chipZ: 40,
  pkg: 96,
  board: {y0: 16, y1: 22, z0: -440, z1: 480},
  chipY: 32, // the packages' top
  plateY: 48, // the cold plates' top
  osfpX: Array.from({length: 16}, (_, i) => -225 + i * 30),
  osfpBotX: [-228, 228],
  osfpZ: [420, 503],
  pcieZ: -330,
  vrZ: -48,
  qdX: [-240, -180], // supply, return (outer side: the left column; mirrored on the right)
  hdrZ: [-110, -150], // the supply and the return headers
  frontZ: 500,
  backZ: -500,
  lift: {lid: 300, plates: 210, chips: 110, io: 44},
};
/** world position of a tray-local point of tray n, pulled out by pull (0..1); the right column is mirrored in x */
export const trayWorld = (n, [x, y, z], pull = 0) => [trayX(n) + (rackSlotOf(n).col ? -x : x), trayY(n) + y, TRAY.zc + z + pull * TRAY.pull];
export const hostWorld = (n, [x, y, z]) => [trayX(n) + (rackSlotOf(n).col ? -x : x), hostY(n) + y, TRAY.zc + z];

// the back: manifolds per column (supply outer, return inner), copper bundles, the power line down the middle
export const BACK = {
  manS: {x: 530, z: -530},
  manR: {x: 470, z: -570},
  manR0: 18,
  manY: [250, 1720],
  cuX: 60, // copper bundles at COLX ± 60
  cuZ: -522,
  busX: 0,
  busZ: -566,
  trayBackZ: TRAY.zc - TRAY.d / 2, // -480
};
/** the fibre bundles from the trays' OSFPs up the front to the patch panel and on out of the top: in the gaps beside
 * the trays' columns, so a tray slides out between them */
export const FIBRE = {x: [-552, -27, 27, 552], z: 540, r: 8};

// ------------------------------------------------------------ the torus diagram (chapters 1, 3, 5)
export const CUBE = {c: [2200, 1250, 0], cVs: [3800, 1250, 0], S: 200, node: 40};
export const cubeXYZ = ([x, y, z], c = CUBE.c, S = CUBE.S) => [c[0] + (x - 1.5) * S, c[1] + (z - 1.5) * S, c[2] - (y - 1.5) * S];
/** the small OCS under the cube for the wrap (one box: the X rank) */
export const OCS3 = {c: [2200, 640, 300], w: 300, h: 150, d: 150};
/** six: the 6 lines from the demo chip, each drawn k of the way */
export function sixPose(t, c = CUBE.c) {
  const f = sixAt(t);
  const a = cubeXYZ(f.from, c);
  return {...f, a, lines: f.links.map((l) => ({...l, pts: [a, cubeXYZ(l.b, c)]}))};
}
/** hop: the route as world points, the bead's point at staged t */
export function hopPose(t, c = CUBE.c) {
  const h = hopAt(t);
  const pts = h.path.map((p) => cubeXYZ(p, c));
  const n = pts.length - 1;
  const ease = (x) => x * x * (3 - 2 * x);
  const k = h.legIndex === 0 ? 0 : h.legIndex > n ? n : h.legIndex - 1 + ease(h.u);
  const i = Math.min(n - 1, Math.floor(k));
  const p = pts[i].map((v, j) => v + (pts[i + 1][j] - v) * (k - i));
  return {...h, pts, k, p};
}
/** wrap: the 3-hop way through the cube (ghost), and the optical way: out of −X, the OCS, in through +X */
export function wrapPaths(c = CUBE.c) {
  const a = cubeXYZ(SPEC.demo.wrapFrom, c);
  const b = cubeXYZ(SPEC.demo.wrapTo, c);
  const ghost = route(SPEC.demo.wrapFrom, [3, 0, 0], [8, 4, 4]).map((p) => cubeXYZ(p, c));
  const oy = OCS3.c[1];
  const ox0 = OCS3.c[0] - OCS3.w / 2;
  const ox1 = OCS3.c[0] + OCS3.w / 2;
  const zz = a[2];
  const out = [a, [a[0] - 160, a[1], zz], [a[0] - 160, oy, zz], [ox0, oy, zz]];
  const mid = [[ox0, oy, zz], [OCS3.c[0], oy + 30, zz], [ox1, oy, zz]];
  const inn = [[ox1, oy, zz], [b[0] + 160, oy, zz], [b[0] + 160, b[1], zz], b];
  return {a, b, ghost, out, mid, inn};
}
export function wrapPose(t, c = CUBE.c) {
  const w = wrapAt(t);
  const P = wrapPaths(c);
  const ease = (x) => x * x * (3 - 2 * x);
  const path = w.leg === 'out' ? P.out : w.leg === 'ocs' ? P.mid : w.leg === 'in' ? P.inn : null;
  const p = path ? along(path, ease(w.u)) : w.leg === 'arrive' ? P.b : P.a;
  return {...w, ...P, p};
}

// ------------------------------------------------------------ chapter 4: 4 small cubes, a spare, the OCS, the pod
export const MINI = {s: 56, box: 230, node: 22};
/** the cubes' centres: a column along the long axis (4×4×16, the long axis up) and a 2 × 2 slab (8×8×4) */
export const MINI_AT = {
  column: [0, 1, 2, 3].map((k) => [1950, 560 + k * 290, 0]),
  flat: [0, 1, 2, 3].map((k) => [1800 + (k % 2) * 300, 1050, 170 - Math.floor(k / 2) * 340]),
  spare: [1420, 700, 330],
};
export const OCS4 = {c: [2750, 1050, 0], w: 280, h: 840, d: 280, mirrors: 8};
/** the ranks of the OCS, top to bottom: X, Y, Z (出典2 5枚目の X・Y・Z の段。台数は未確認なので数を描かない) */
export const RANKS = ['X', 'Y', 'Z'];
export const rankY = (axis) => OCS4.c[1] + (1 - RANKS.indexOf(axis)) * (OCS4.h / 3);
/** world direction of a face: axis X → +x, Y → −z, Z → +y */
const DIR = {X: [1, 0, 0], Y: [0, 0, -1], Z: [0, 1, 0]};
/** the cube pairs the OCS joins in each arrangement: [a, b, axis] (a's + face to b's − face; a 2-long axis joins the
 * same pair both ways, drawn once). In the column the X and Y faces close on themselves (not drawn) */
export const PAIRS = {
  column: [[0, 1, 'Z'], [1, 2, 'Z'], [2, 3, 'Z'], [3, 0, 'Z']],
  flat: [[0, 1, 'X'], [2, 3, 'X'], [0, 2, 'Y'], [1, 3, 'Y']],
  swapped: [[0, 4, 'X'], [2, 3, 'X'], [0, 2, 'Y'], [4, 3, 'Y']],
};
/** the cubes' centres at a mix of the column (0) and the slab (1); cube 4 is the spare */
export const miniCentres = (move) => [...MINI_AT.column.map((p, k) => p.map((v, j) => v + (MINI_AT.flat[k][j] - v) * move)), MINI_AT.spare];
/** an optical path a → OCS rank → b: out of a's + face, into the rank's port, out again to b's − face */
export function vPath(centres, [a, b, axis], slot) {
  const d = DIR[axis];
  const h = MINI.box / 2;
  const fa = centres[a].map((v, j) => v + d[j] * h);
  const fb = centres[b].map((v, j) => v - d[j] * h);
  const port = [OCS4.c[0] - OCS4.w / 2, rankY(axis), -96 + slot * 64];
  return [fa, fa.map((v, j) => v + d[j] * 50), port, fb.map((v, j) => v - d[j] * 50), fb];
}
/** the mirrors' tilt (radians) for an arrangement: a fixed pattern per arrangement, so a change turns every mirror */
export const mirrorAngles = (key) => Array.from({length: 3 * OCS4.mirrors}, (_, i) => (key === 'column' ? 0.35 : key === 'flat' ? -0.3 : 0.12) * Math.sin(i * 1.7 + (key === 'swapped' ? 2.1 : 0.4)));
export const POD = {pitch: 1800, n: 12};
/** the 144 racks of the pod (this rack is (0, 0)) */
export const podRacks = () => Array.from({length: POD.n * POD.n}, (_, k) => [(k % POD.n) * POD.pitch, 0, -Math.floor(k / POD.n) * POD.pitch]);

// ------------------------------------------------------------ chapter 5: the NVL72 ring beside the cube
export const NVR = {c: [2150, 1250, 0], r: 470, plate: 590, gpuS: 30, hubS: 170, from: 0, to: 36};
export const nvRingXY = (i, r = NVR.r) => {
  const a = Math.PI / 2 - (i / 72) * Math.PI * 2;
  return [r * Math.cos(a), r * Math.sin(a)];
};
export function vsPose(t) {
  const v = vsAt(t);
  const pts = v.iw.map((p) => cubeXYZ(p, CUBE.cVs));
  const [ax, ay] = nvRingXY(NVR.from, NVR.r - 30);
  const [bx, by] = nvRingXY(NVR.to, NVR.r - 30);
  const nv = [[NVR.c[0] + ax, NVR.c[1] + ay, 40], [NVR.c[0], NVR.c[1], 40], [NVR.c[0] + bx, NVR.c[1] + by, 40]];
  return {...v, pts, nv, iwP: along(pts, v.iwU), nvP: along(nv, v.nvU)};
}

// ------------------------------------------------------------ chapter 6: out of the pod
export const JUP = {at: [1550, 1750, 900], w: 560, h: 90, d: 300};
export const POD2 = {at: [7400, 0, -15000], w: 1200, h: 2300, d: 1200};
/** chip 1 of tray 10 (the right neighbour of the pulled one) → its OSFP at the front → the fibre bundle up to the patch panel (ICI) */
export function iciPath() {
  const n = SPEC.demo.outTray;
  const W = (x, y, z) => trayWorld(n, [x, y, z]);
  const fx = sideOf(n) > 0 ? FIBRE.x[3] : FIBRE.x[0];
  const top = W(TL.chipX[0], TL.chipY + 4, TL.chipZ);
  const cage = W(TL.osfpX[0], 36, TL.osfpZ[1]);
  return [top, W(TL.chipX[0], 36, TL.osfpZ[0]), W(TL.osfpX[0], 36, TL.osfpZ[0]), cage, [fx, cage[1], FIBRE.z], [fx, SECT.patch[0] + 60, FIBRE.z]];
}
/** chip 1 → PCIe under the board → down the back to the host tray → its NIC at the front → Jupiter → another pod */
export function dcnPath() {
  const n = SPEC.demo.outTray;
  const W = (x, y, z) => trayWorld(n, [x, y, z]);
  const H = (x, y, z) => hostWorld(n, [x, y, z]);
  const nic = H(-200, HOST.h / 2, TL.frontZ + 4);
  return [
    W(TL.chipX[0], TL.chipY + 4, TL.chipZ),
    W(TL.chipX[0], 10, TL.pcieZ),
    W(TL.chipX[0], 10, TL.backZ - 30),
    H(TL.chipX[0], HOST.h / 2, TL.backZ - 30),
    H(-200, HOST.h / 2, TL.backZ + 120),
    nic,
    [nic[0], nic[1], nic[2] + 200],
    [JUP.at[0] - 120, nic[1], nic[2] + 200],
    [JUP.at[0] - 120, JUP.at[1] - JUP.h / 2, JUP.at[2]],
    [JUP.at[0] + 120, JUP.at[1] - JUP.h / 2, JUP.at[2]],
    [JUP.at[0] + JUP.w / 2 + 60, JUP.at[1], JUP.at[2]],
    [POD2.at[0], POD2.h + 40, POD2.at[2] + POD2.d / 2],
  ];
}
/** beads on both: [{u}] along each path at staged t; the ICI side carries ratio times as many */
export function outBeads(t) {
  const per = 1 / OUT.perSecOut;
  const outs = [];
  for (let k = Math.floor((t - OUT.travelOut) / per); k <= Math.floor(t / per); k++) {
    const s = t - k * per;
    if (s >= 0 && s <= OUT.travelOut) outs.push({k, u: s / OUT.travelOut});
  }
  const ratio = Math.round(((SPEC.ici.links * SPEC.ici.linkGBs) / 2) * 8 / SPEC.dcnGbps);
  const perIn = per / ratio;
  const ins = [];
  for (let k = Math.floor((t - OUT.travelIn) / perIn); k <= Math.floor(t / perIn); k++) {
    const s = t - k * perIn;
    if (s >= 0 && s <= OUT.travelIn) ins.push({k, u: s / OUT.travelIn});
  }
  return {outs, ins, ratio};
}

// ------------------------------------------------------------ chapter 7: dashes along paths
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

const TRAYS = Array.from({length: SPEC.cube.trays}, (_, n) => n);
/** 416 V AC down from above into the rectifiers; DC down the back to every pair; the battery up into the same line */
export function powerPaths() {
  const z = BACK.busZ;
  return {
    ac: [[-300, 2560, -300], [-300, SECT.rect[1] + 2, -300]],
    down: [[0, SECT.rect[0] + 40, BACK.trayBackZ - 4], [0, SECT.rect[0] + 40, z], [0, rowY(0) + 60, z]],
    bbu: [[0, (SECT.bbu[0] + SECT.bbu[1]) / 2, BACK.trayBackZ - 4], [0, (SECT.bbu[0] + SECT.bbu[1]) / 2, z], [0, rowY(0) + 60, z]],
    stubs: TRAYS.map((n) => [[0, trayY(n) + 50, z], [trayX(n) * 0.62, trayY(n) + 50, z], [trayX(n) * 0.62, trayY(n) + 50, BACK.trayBackZ - 2]]),
  };
}
/** the CDU rack beside this one (its count is 未確認: one box stands for it) */
export const CDU = {at: [-2600, 0, 200], w: 600, h: 2000, d: 1000};
/** the coolant: CDU → under the floor → up the supply manifolds → every TPU tray → the return manifolds → CDU */
export function coolPaths() {
  const yF = 130;
  const S = BACK.manS;
  const R = BACK.manR;
  const zIn = BACK.trayBackZ - 2;
  const n = SPEC.demo.pullTray;
  const W = (x, zz, y = TL.plateY + 3) => trayWorld(n, [x, y, zz]);
  const branches = TL.chipX.map((cx) => ({
    sup: [W(TL.qdX[0], TL.backZ), W(TL.qdX[0], TL.hdrZ[0]), W(cx - 14, TL.hdrZ[0]), W(cx - 14, TL.chipZ)],
    ret: [W(cx + 14, TL.chipZ), W(cx + 14, TL.hdrZ[1]), W(TL.qdX[1], TL.hdrZ[1]), W(TL.qdX[1], TL.backZ)],
  }));
  return {
    feed: [[CDU.at[0] + CDU.w / 2, yF, S.z], [-S.x, yF, S.z], [-S.x, BACK.manY[0], S.z]],
    feed2: [[-S.x, yF, S.z], [S.x, yF, S.z], [S.x, BACK.manY[0], S.z]],
    supply: [-1, 1].map((sx) => [[sx * S.x, BACK.manY[0], S.z], [sx * S.x, BACK.manY[1], S.z]]),
    ret: [-1, 1].map((sx) => [[sx * R.x, BACK.manY[1], R.z], [sx * R.x, BACK.manY[0], R.z]]),
    back2: [[R.x, BACK.manY[0], R.z], [R.x, yF - 30, R.z], [-R.x, yF - 30, R.z]],
    back: [[-R.x, BACK.manY[0], R.z], [-R.x, yF - 30, R.z], [CDU.at[0] + CDU.w / 2, yF - 30, R.z]],
    supplyIn: TRAYS.map((k) => {
      const sx = sideOf(k);
      const y = trayY(k) + 40;
      return [[sx * S.x, y, S.z], [sx * S.x, y, zIn]];
    }),
    retOut: TRAYS.map((k) => {
      const sx = sideOf(k);
      const y = trayY(k) + 40;
      return [[sx * R.x, y, zIn], [sx * R.x, y, R.z]];
    }),
    branches,
  };
}

// ------------------------------------------------------------ the caption line over the 3D view
export function captionOf(scene, t) {
  if (!scene) return '';
  switch (scene) {
    case 'six': {
      const f = sixAt(t);
      return f.lit < 6 ? `チップ 1 個から隣のチップへ線が伸びる（${f.lit} / 6）` : '6 本とも行き先は隣のチップ。間にスイッチは無い';
    }
    case 'hop': {
      const h = hopAt(t);
      if (h.done || h.leg === 'arrive') return '(2,2,2) に届いた: 隣から隣へ 6 回。これが立方体でいちばん遠い相手';
      if (h.leg === 'depart') return '(0,0,0) から (2,2,2) へ: X → Y → Z の順に短い向きで回る';
      return `${h.hops} 回目まで渡った（いまの線: ${{board: '基板の配線', copper: '銅ケーブル', optical: '光'}[h.kind]}）`;
    }
    case 'wrap': {
      const w = wrapAt(t);
      return w.leg === 'arrive' || w.done ? '(3,0,0) に届いた: 光で折り返すので 3 回ではなく 1 回。端と端がつながって輪になる' : w.ja;
    }
    case 'ocs': {
      const o = ocsAt(t).phase;
      if (o === 'line') return '立方体 4 個を縦につないだ 4×4×16（細長い形）';
      if (o === 'tilt') return 'OCS の鏡が向きを変える: どの面とどの面をつなぐかが変わる';
      if (o === 'move') return 'つながる相手が変わり、同じ 4 個が 8×8×4（平たい形）になる';
      return '8×8×4 になった。ケーブルは 1 本も差し替えていない';
    }
    case 'swap': {
      const s = swapAt(t);
      if (s.phase === 'fail') return '立方体 1 個が壊れた（灰色）';
      if (s.phase === 'tilt') return 'OCS が壊れた立方体の光の道を外し、予備の立方体へ向ける';
      return '予備が入って輪がまた閉じる。スライスの形は 8×8×4 のまま';
    }
    case 'pod':
      return 'ポッド: TPU ラック 144 台 ＝ 立方体 144 個 ＝ 9,216 チップ（OCS・CDU のラックは台数が未確認なので描かない）';
    case 'vs': {
      const v = vsAt(t);
      return v.done ? 'いちばん遠い相手まで: NVL72 はスイッチ 1 段、Ironwood の立方体は隣へ 6 回' : `NVL72: スイッチ ${v.nvHops} 段　Ironwood: 隣へ ${v.iwHops} 回`;
    }
    case 'out':
      return '同じ時間に運べる量: ICI（片方向）は DCN の 48 倍（DCN の 100 Gb/s を片方向と仮定）';
    case 'power':
      return `416 V 交流（淡い線）→ 整流器 → 直流（濃い線）で各トレイへ。下の電池も同じ線につながる`;
    case 'cool':
      return '行き（淡い線）はマニホールドから 4 チップへ並列に、帰り（濃い線）は温まって CDU へ戻る';
    default:
      return '';
  }
}
export {SCENES};
