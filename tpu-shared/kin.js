// The Ironwood (TPU7x) rack's math, no three.js. Every number lives in SPEC (sources, 仮定・計算・推測・未確認 in
// ../tpu/refs.md); the geometry, the console and the tests all read it from here. The NVL72 values the comparison needs
// are read from ../nvl72-shared/kin.js (not copied). One input drives the page: time. A scene is a pure function of its
// own clock: sixAt / hopAt / wrapAt / ocsAt / swapAt / vsAt / outAt / powerAt say where the moving things are and what
// the gauges read. The scene durations are STAGED TIME (made up for the eye); only the computed values (ms) are real.
//
// Coordinates of the torus: chip (x, y, z), each 0..n-1 per axis. One tray = the 2 × 2 of x・y with the same z (仮定).
import {gpuCount as nvGpuCount, hbmTotalGB as nvHbmTotalGB, inOutRatio as nvInOutRatio, linkGBs as nvLinkGBs, ringMs as nvRingMs, SPEC as NV} from '../nvl72-shared/kin.js';

export const SPEC = {
  // ラック（出典3、出典2 23枚目）。寸法は仮定（Google は出していない）
  rack: {h: 2300, w: 1200, d: 1200},
  rows: 8, // 左右 2 列 × 8 段（写真から数えた推測）
  cols: 2,
  // チップ（出典1、2、6）
  chip: {dies: 2, tensorCores: 2, sparseCores: 4, hbmGiB: 192, hbmStacks: 8, hbmTBs: 7.37, hbmGBsTable: 7380, fp8TF: 4614, bf16TF: 2307, jaxDevices: 2},
  ici: {links: 6, linkGBs: 200, chipTBs: 1.2, axisGBs: 400, chipTbps: 9.6, serdesG: 112, serdesLanes: 8},
  dcnGbps: 100,
  pcie: 'Gen5 x16',
  // トレイ（出典2 22枚目、出典3）。トレイの中の 2×2 の輪は推測
  tray: {chips: 4, osfp: 18, osfpTop: 16, osfpBottom: 2, boardLinks: 4},
  host: {chips: 4, vcpu: 224, memGB: 960, numa: 2, vm: 'tpu7x-standard-4t'},
  // ラック = 立方体（出典3）
  cube: {dims: [4, 4, 4], trays: 16, hosts: 16, pcb: 64, copper: 80, optical: 96, faces: 6, perFace: 16},
  // ポッド（出典1〜6）。9,216 を 1 つのトーラスにした形は未確認、ホップの計算では 16×24×24 を仮定
  pod: {chips: 9216, cubes: 144, hbmPB: 1.77, fp8EF: 42.5, iciTbps: 88473.6, iciTBs: 11059.2, mwNear: 10, shape: [16, 24, 24], small: 256, askAbove: 2048},
  slices: [[2, 2, 1], [2, 2, 2], [2, 2, 4], [2, 4, 4], [4, 4, 4], [4, 4, 8], [4, 8, 8], [8, 8, 8], [8, 8, 16], [8, 16, 16]],
  // OCS（出典7 は TPU v4 の値。Ironwood の台数・ポート数は未確認）
  ocsV4: {cubes: 64, ports: 136, used: 128, spare: 8, units: 48, costPct: 5, powerPct: 3},
  // all-reduce（帯域だけの単純計算。仮定）
  allreduce: {gradGB: 1, dims: [4, 4, 4], linkOneWayGBs: 100},
  // 電源（出典3、6）
  power: {acV: 416, cappingMs: 15, highTdpMs: 100, throttleS: 120},
  // 次の世代（出典11、12）
  next8t: {chips: 9600, fp4PF: 12.6, hbmGB: 216, hbmGBs: 6528, sramMB: 128, podEF: 121, podPB: 2, iciX: 2},
  next8i: {hbmGB: 288, hbmGBs: 8601, fp4PF: 10.1, sramMB: 384, maxChips: 1152, chips: 1024, hopsTorus: 16, hopsBoardfly: 7, iciTbps: 19.2},
  // 場面の例（brief の指定）。引き出すのはトレイ 9 枚目（z = 2・x 0-1・y 0-1、下から 5 段目の左）、6 章はその右隣
  demo: {pullTray: 8, outTray: 9, six: [1, 1, 1], hopFrom: [0, 0, 0], hopTo: [2, 2, 2], wrapFrom: [0, 0, 0], wrapTo: [3, 0, 0]},
};

/** the NVL72 side of the comparison, read from nvl72-shared/kin.js */
export const NVL = {
  gpus: nvGpuCount(),
  links: NV.nvlink.linksPerGpu,
  gpuTBs: NV.nvlink.gpuTBs,
  linkGBs: nvLinkGBs(),
  hbmGB: NV.gpu.hbmGB,
  hbmTBs: NV.gpu.hbmTBs,
  rackHbmGB: nvHbmTotalGB(),
  inOut: nvInOutRatio(),
  ringMs: nvRingMs(),
  nicGbps: NV.cx7Gbps,
  hops: 1,
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const easeInOut = (x) => {
  const u = clamp(x, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
const ease = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
/** u remapped from [a, b] to 0..1, clamped */
export const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

// ------------------------------------------------------------ checks that refs.md 「検算」 spells out
export const chipCount = (s = SPEC) => s.cube.dims.reduce((a, b) => a * b, 1);
export const iciGBs = (s = SPEC) => s.ici.links * s.ici.linkGBs;
export const axisGBs = (s = SPEC) => 2 * s.ici.linkGBs;
export const chipTbps = (s = SPEC) => (iciGBs(s) * 8) / 1000;
export const podIciTbps = (s = SPEC) => s.pod.chips * chipTbps(s);
/** the lines inside an a×b×c grid (no wrap) */
export const innerLinks = ([a, b, c]) => (a - 1) * b * c + a * (b - 1) * c + a * b * (c - 1);
/** the lines out of the 6 faces */
export const faceLinks = ([a, b, c]) => 2 * (b * c + a * c + a * b);
export const pcbLinks = (s = SPEC) => s.cube.trays * s.tray.boardLinks;
export const copperLinks = (s = SPEC) => innerLinks(s.cube.dims) - pcbLinks(s);
export const opticalLinks = (s = SPEC) => faceLinks(s.cube.dims);
/** the ends of all lines: 2 × inside + faces, and 64 chips × 6 */
export const lineEnds = (s = SPEC) => 2 * innerLinks(s.cube.dims) + opticalLinks(s);
export const chipEnds = (s = SPEC) => chipCount(s) * s.ici.links;
/** ICI out of one tray: 4 × 6 − 4 × 2 */
export const trayOutLinks = (s = SPEC) => s.tray.chips * s.ici.links - s.tray.boardLinks * 2;
export const jaxDevicesPerVm = (s = SPEC) => s.host.chips * s.chip.jaxDevices;
export const iciVsNvlink = (s = SPEC) => s.ici.chipTBs / NVL.gpuTBs;
export const linkVsNvlink = (s = SPEC) => s.ici.linkGBs / NVL.linkGBs;
export const scaleVsNvl = (s = SPEC) => s.pod.chips / NVL.gpus;
export const cubesInPod = (s = SPEC) => s.pod.chips / chipCount(s);
export const podHbmGB = (s = SPEC) => s.pod.chips * s.chip.hbmGiB;
export const podHbmPBifGiB = (s = SPEC) => (s.pod.chips * s.chip.hbmGiB * 2 ** 30) / 1e15;
export const podFp8EF = (s = SPEC) => (s.pod.chips * s.chip.fp8TF) / 1e6;
export const podHbmPBs = (s = SPEC) => (s.pod.chips * s.chip.hbmGBsTable) / 1e6;
export const rackHbmGB = (s = SPEC) => chipCount(s) * s.chip.hbmGiB;
export const rackFp8PF = (s = SPEC) => (chipCount(s) * s.chip.fp8TF) / 1000;
/** ICI one way (3 axes × 2 links × 100 GB/s) in Gb/s against the DCN's 100 Gb/s (DCN taken as one way: 仮定) */
export const iciOneWayGBs = (s = SPEC) => iciGBs(s) / 2;
export const iciDcnRatio = (s = SPEC) => (iciOneWayGBs(s) * 8) / s.dcnGbps;
export const ocsPortsV4 = (s = SPEC) => s.ocsV4.cubes * 2;
export const ocsPortsIronwood = (s = SPEC) => s.pod.cubes * 2;
/** all-reduce of G over a×b×c, one axis after another: 2 × Σ (n−1)/(n·prev) × G = 2 × 63/64 G on 4×4×4 */
export function allreduceSentGB(s = SPEC) {
  let left = 1;
  let sent = 0;
  for (const n of s.allreduce.dims) {
    left /= n;
    sent += left * (n - 1);
  }
  return 2 * sent * s.allreduce.gradGB;
}
export const allreduceOneAxisMs = (s = SPEC) => (allreduceSentGB(s) / (2 * s.allreduce.linkOneWayGBs)) * 1000;
export const allreduceIdealMs = (s = SPEC) => (allreduceSentGB(s) / iciOneWayGBs(s)) * 1000;
export const rackKW = (s = SPEC) => (s.pod.mwNear * 1000) / s.pod.cubes;
export const chipKW = (s = SPEC) => (s.pod.mwNear * 1000) / s.pod.chips;
export const next8tEF = (s = SPEC) => (s.next8t.chips * s.next8t.fp4PF) / 1000;
export const next8tPB = (s = SPEC) => (s.next8t.chips * s.next8t.hbmGB) / 1e6;
export const next8tVsIronwood = (s = SPEC) => s.next8t.podEF / s.pod.fp8EF;

// ------------------------------------------------------------ the torus
export const mod = (a, n) => ((a % n) + n) % n;
export const shapeName = (d) => d.join('x');
/** the signed steps a → b on a ring of n, the short way (a tie goes +) */
export const stepsOn = (a, b, n) => {
  const d = mod(b - a, n);
  return d <= n / 2 ? d : d - n;
};
/** chip a → chip b: X first, then Y, then Z, each the short way round. The path includes both ends */
export function route(a, b, dims = SPEC.cube.dims) {
  const cur = [...a];
  const path = [[...cur]];
  for (let k = 0; k < 3; k++) {
    const s = stepsOn(a[k], b[k], dims[k]);
    for (let i = 0; i < Math.abs(s); i++) {
      cur[k] = mod(cur[k] + Math.sign(s), dims[k]);
      path.push([...cur]);
    }
  }
  return path;
}
export const hopsBetween = (a, b, dims = SPEC.cube.dims) => a.reduce((acc, v, k) => acc + Math.abs(stepsOn(v, b[k], dims[k])), 0);
/** the torus' diameter: the sum of the half sides */
export const diameter = (dims) => dims.reduce((a, n) => a + Math.floor(n / 2), 0);
/** the mean hops to every other chip (self left out) */
export function meanHops(dims) {
  const N = dims.reduce((a, b) => a * b, 1);
  const perAxis = dims.map((n) => Array.from({length: n}, (_, d) => Math.min(d, n - d)).reduce((a, b) => a + b, 0) / n);
  return (perAxis.reduce((a, b) => a + b, 0) * N) / (N - 1);
}
/** the 6 neighbours of a chip: [-x, +x, -y, +y, -z, +z] */
export const neighbours = (c, dims = SPEC.cube.dims) => [0, 1, 2].flatMap((k) => [-1, 1].map((d) => c.map((v, j) => (j === k ? mod(v + d, dims[k]) : v))));
/** the kind of the line a–b inside one rack: through the faces and the OCS (wrap) → optical; another z → copper;
 * the same 2×2 block of the same z → board (the tray); else copper */
export function linkKind(a, b) {
  const k = [0, 1, 2].find((j) => a[j] !== b[j]);
  if (Math.abs(a[k] - b[k]) > 1) return 'optical';
  if (k === 2) return 'copper';
  return Math.floor(a[0] / 2) === Math.floor(b[0] / 2) && Math.floor(a[1] / 2) === Math.floor(b[1] / 2) ? 'board' : 'copper';
}
/** every line of one cube as a 4×4×4 torus: [{a, b, kind}] (a wrap line counts once, it uses one fibre on each face) */
export function cubeLinks(dims = SPEC.cube.dims) {
  const out = [];
  for (let x = 0; x < dims[0]; x++)
    for (let y = 0; y < dims[1]; y++)
      for (let z = 0; z < dims[2]; z++)
        for (let k = 0; k < 3; k++) {
          const a = [x, y, z];
          const b = a.map((v, j) => (j === k ? mod(v + 1, dims[k]) : v));
          out.push({a, b, kind: linkKind(a, b)});
        }
  return out;
}
/** tray 0..15 of a chip: z × 4 + y-half × 2 + x-half; the slot 0..3 along the tray's row of chips */
export const trayOfChip = ([x, y, z]) => z * 4 + Math.floor(y / 2) * 2 + Math.floor(x / 2);
export const SLOT_XY = [[0, 0], [1, 0], [1, 1], [0, 1]]; // the slot order is the tray's 2×2 ring
export const slotOfChip = ([x, y]) => SLOT_XY.findIndex(([a, b]) => a === x % 2 && b === y % 2);
export const chipOfTray = (n, slot) => {
  const z = Math.floor(n / 4);
  const yb = Math.floor((n % 4) / 2);
  const xb = n % 2;
  return [xb * 2 + SLOT_XY[slot][0], yb * 2 + SLOT_XY[slot][1], z];
};
/** the rack slot of tray n: column (0 left, 1 right) and row from the bottom (0..7) */
export const rackSlotOf = (n) => ({col: n % 2, row: Math.floor(n / 4) * 2 + Math.floor((n % 4) / 2)});

// ------------------------------------------------------------ scenes (staged time)
const legAt = (legs, t) => {
  let acc = 0;
  for (let i = 0; i < legs.length; i++) {
    if (t < acc + legs[i].dur || i === legs.length - 1) return {i, leg: legs[i], u: clamp((t - acc) / legs[i].dur, 0, 1), t0: acc};
    acc += legs[i].dur;
  }
  return {i: 0, leg: legs[0], u: 0, t0: 0};
};
const total = (legs) => legs.reduce((a, l) => a + l.dur, 0);

/** six: the 6 lines grow one after another */
export const SIX = {start: 0.1, stagger: 0.22, grow: 0.4};
export function sixAt(t, s = SPEC) {
  const c = s.demo.six;
  const nb = neighbours(c);
  const links = nb.map((b, i) => ({b, kind: linkKind(c, b), k: clamp((t - SIX.start - i * SIX.stagger) / SIX.grow, 0, 1)}));
  return {from: c, links, lit: links.filter((l) => l.k >= 1).length};
}
const SIX_DUR = SIX.start + 5 * SIX.stagger + SIX.grow;

/** hop: (0,0,0) → (2,2,2), 6 links. A hop counts once the bead is over the middle of its link */
export const HOP = {depart: 0.2, leg: 0.65, arrive: 0.6};
export const HOP_LEGS = [{id: 'depart', dur: HOP.depart}, ...Array.from({length: 6}, (_, i) => ({id: `h${i + 1}`, dur: HOP.leg})), {id: 'arrive', dur: HOP.arrive}];
const HOP_TOTAL = total(HOP_LEGS);
export function hopAt(t, s = SPEC) {
  const path = route(s.demo.hopFrom, s.demo.hopTo);
  const {i, leg, u} = legAt(HOP_LEGS, clamp(t, 0, HOP_TOTAL));
  const n = path.length - 1;
  const passed = i === 0 ? 0 : i > n ? n : i - 1 + (u >= 0.5 ? 1 : 0);
  const k = i >= 1 && i <= n ? i - 1 : -1; // the link the bead is on
  return {path, leg: leg.id, legIndex: i, u, link: k, kind: k >= 0 ? linkKind(path[k], path[k + 1]) : null, hops: passed, done: t >= HOP_TOTAL - 1e-9};
}

/** wrap: (0,0,0) → (3,0,0). First the 3-hop way inside the cube is drawn faint, then the bead goes out of the −X face,
 * through the OCS, in through the +X face: 1 hop */
export const WRAP_LEGS = [
  {id: 'ghost', dur: 1.1, ja: '中を通ると 3 回…'},
  {id: 'out', dur: 0.8, ja: '−X の面から光で外へ'},
  {id: 'ocs', dur: 0.4, ja: 'OCS の鏡で折り返す'},
  {id: 'in', dur: 0.8, ja: '+X の面から入る'},
  {id: 'arrive', dur: 0.5, ja: '届いた: 1 回'},
];
const WRAP_TOTAL = total(WRAP_LEGS);
export function wrapAt(t, s = SPEC) {
  const {i, leg, u} = legAt(WRAP_LEGS, clamp(t, 0, WRAP_TOTAL));
  const iIn = WRAP_LEGS.findIndex((l) => l.id === 'in');
  return {leg: leg.id, legIndex: i, u, ja: leg.ja, ghostK: i === 0 ? u : 1, hops: i >= iIn ? 1 : 0, naive: Math.abs(s.demo.wrapTo[0] - s.demo.wrapFrom[0]), path: route(s.demo.wrapFrom, s.demo.wrapTo), done: t >= WRAP_TOTAL - 1e-9};
}

/** ocs: 4 cubes in a column (4×4×16) → the mirrors turn → the cubes take their new places (8×8×4) */
export const OCS_PH = {line: [0, 0.5], tilt: [0.5, 1.4], move: [1.4, 2.7], settle: [2.7, 3.0]};
export const SHAPES = {column: [4, 4, 16], flat: [8, 8, 4]};
export function ocsAt(t) {
  const tilt = seg(t, ...OCS_PH.tilt);
  const move = seg(t, ...OCS_PH.move);
  const phase = t < OCS_PH.line[1] ? 'line' : t < OCS_PH.tilt[1] ? 'tilt' : t < OCS_PH.move[1] ? 'move' : 'done';
  const dims = move < 0.5 ? SHAPES.column : SHAPES.flat;
  return {phase, tilt, move: easeInOut(move), dims, shape: shapeName(dims), maxHops: diameter(dims), cubes: 4, done: t >= OCS_PH.settle[1]};
}
/** swap: cube 4 fails → the mirrors take its light off → the spare joins; swapped once the mirrors have turned */
export const SWAP_PH = {fail: [0, 0.5], tilt: [0.5, 1.3], join: [1.3, 2.2]};
export const FAILED = 1; // the cube that goes grey (flat place 1,0: the front right)
export function swapAt(t) {
  const fail = seg(t, ...SWAP_PH.fail);
  const tilt = seg(t, ...SWAP_PH.tilt);
  const join = seg(t, ...SWAP_PH.join);
  const phase = t < SWAP_PH.fail[1] ? 'fail' : t < SWAP_PH.tilt[1] ? 'tilt' : t < SWAP_PH.join[1] ? 'join' : 'done';
  return {phase, fail, tilt, join, swapped: t >= SWAP_PH.tilt[1], dims: SHAPES.flat, shape: shapeName(SHAPES.flat), maxHops: diameter(SHAPES.flat), cubes: 4, done: t >= SWAP_PH.join[1]};
}

/** vs: the same "farthest partner": NVL72 GPU → NVSwitch → GPU (1 hop), Ironwood (0,0,0) → (2,2,2) (6 hops), one hop
 * every VS.leg staged seconds on both sides */
export const VS = {depart: 0.3, leg: 0.6, arrive: 0.5};
export function vsAt(t, s = SPEC) {
  const tt = Math.max(0, t - VS.depart);
  const iw = route(s.demo.hopFrom, s.demo.hopTo);
  const n = iw.length - 1;
  const iwU = clamp(tt / (n * VS.leg), 0, 1);
  const nvU = clamp(tt / (2 * VS.leg), 0, 1); // up to the switch and down again: 2 legs, 1 switch
  return {iw, iwU, nvU, iwHops: Math.min(n, Math.floor(tt / VS.leg + 0.5)), nvHops: nvU >= 0.5 ? 1 : 0, done: t >= VS.depart + n * VS.leg + VS.arrive};
}
const VS_TOTAL = VS.depart + 6 * VS.leg + VS.arrive;

/** out: beads per second on each side; the ICI side carries 48 for every one that goes out to the DCN */
export const OUT = {perSecOut: 0.9, travelOut: 3.0, travelIn: 0.9};
export function outAt(t, s = SPEC) {
  return {ratio: iciDcnRatio(s), iciGBs: iciOneWayGBs(s), dcnGbps: s.dcnGbps, t: Math.max(0, t)};
}
/** power: the current ramps in once (staged) */
export const POWER = {ramp: 1.2};
export function powerAt(t, s = SPEC) {
  const k = ease(Math.max(0, t) / POWER.ramp);
  return {k, podMW: s.pod.mwNear, rackKW: rackKW(s), chipKW: chipKW(s)};
}
export const coolAt = (t) => ({t: Math.max(0, t)});

export const SCENES = {
  six: {id: 'six', name: '6 本の線', sub: 'チップ 1 個から上下・左右・前後の隣へ 1 本ずつ', dur: SIX_DUR},
  hop: {id: 'hop', name: '角から角へ', sub: '(0,0,0) → (2,2,2)・隣から隣へ 6 回', dur: HOP_TOTAL},
  wrap: {id: 'wrap', name: '端と端の輪', sub: '(0,0,0) → (3,0,0) は光で折り返して 1 回', dur: WRAP_TOTAL},
  ocs: {id: 'ocs', name: '光の道をつなぎ替える', sub: '立方体 4 個: 4×4×16 → 8×8×4', dur: OCS_PH.settle[1]},
  swap: {id: 'swap', name: '壊れた立方体を外す', sub: '光の道を予備の立方体へつなぎ直す', dur: SWAP_PH.join[1]},
  pod: {id: 'pod', name: 'ポッド 144 個', sub: '立方体 144 個・9,216 チップ', dur: 2},
  vs: {id: 'vs', name: 'いちばん遠い相手まで', sub: 'NVL72: スイッチ 1 段・Ironwood: 隣へ 6 回', dur: VS_TOTAL},
  out: {id: 'out', name: 'ポッドの外へ', sub: 'チップ → ホスト → NIC → Jupiter → 別のポッド', dur: 6},
  power: {id: 'power', name: '電気', sub: '416 V 交流 → 整流器 → 各トレイ・下に電池', dur: 5},
  cool: {id: 'cool', name: '液冷', sub: 'マニホールド → 4 チップへ並列 → CDU へ戻る', dur: 5},
};
export const SCENE_IDS = Object.keys(SCENES);
export const sceneDuration = (scene) => SCENES[scene].dur;

/** t snapped for reduced motion: the beads jump from leg to leg, the cubes from phase to phase */
export function snapT(scene, t) {
  const tt = Math.max(0, t);
  if (scene === 'hop') return legAt(HOP_LEGS, tt).t0 + 1e-6;
  if (scene === 'wrap') return legAt(WRAP_LEGS, tt).t0 + 1e-6;
  if (scene === 'six') return SIX.start + Math.floor(Math.max(0, tt - SIX.start) / SIX.stagger) * SIX.stagger + SIX.grow;
  if (scene === 'vs') return VS.depart + Math.floor(Math.max(0, tt - VS.depart) / VS.leg) * VS.leg + 1e-6;
  const phases = scene === 'ocs' ? OCS_PH : scene === 'swap' ? SWAP_PH : null;
  if (phases) {
    const ends = Object.values(phases).map((p) => p[1]).sort((a, b) => b - a);
    for (const e of ends) if (tt >= e) return e;
    return 0;
  }
  return tt;
}

/** every gauge value of a scene at staged time t (the console, LIVE.s and the tests read this) */
export function gaugesAt(scene, t, s = SPEC) {
  const cube = s.cube.dims;
  const out = {scene, hops: 0, maxHops: diameter(cube), shape: shapeName(cube), cubes: 1, swapped: false, outRatio: iciDcnRatio(s), links: 0, nvHops: 0};
  if (scene === 'six') out.links = sixAt(t, s).lit;
  if (scene === 'hop') out.hops = hopAt(t, s).hops;
  if (scene === 'wrap') out.hops = wrapAt(t, s).hops;
  if (scene === 'ocs') Object.assign(out, (({shape, maxHops, cubes}) => ({shape, maxHops, cubes}))(ocsAt(t)));
  if (scene === 'swap') Object.assign(out, (({shape, maxHops, cubes, swapped}) => ({shape, maxHops, cubes, swapped}))(swapAt(t)));
  if (scene === 'pod') Object.assign(out, {cubes: s.pod.cubes, shape: shapeName(s.pod.shape), maxHops: diameter(s.pod.shape)});
  if (scene === 'vs') {
    const v = vsAt(t, s);
    out.hops = v.iwHops;
    out.nvHops = v.nvHops;
  }
  return out;
}

// ------------------------------------------------------------ the pulled tray's layers (chapter 2)
// Layers: the pull out of the rack, then from the top 天板, コールドプレート, チップ, OSFP・PCIe (the board's edge parts).
// Opening: the pull first, then the layers top first with a stagger. Closing: bottom layer first, fast, the pull last.
export const LAYERS = ['pull', 'lid', 'plates', 'chips', 'io'];
export const EXPLODE = {
  open: {delay: [0, 1.15, 1.32, 1.49, 1.66], dur: [1.2, 0.9, 0.9, 0.9, 0.9]},
  close: {delay: [0.5, 0.18, 0.12, 0.06, 0], dur: [0.9, 0.5, 0.5, 0.5, 0.5]},
};
/** one layer's value (0..1) at t from presses [{t, to: [5 targets]}]; init = the values before the first press */
export function layerAt(events, k, t, init = 0, instant = false) {
  let v = init;
  let sg = null;
  const at = (tt) => {
    if (!sg) return v;
    const span = sg.dur * Math.max(0.35, Math.abs(sg.to - sg.v0));
    const u = span <= 0 ? 1 : (tt - sg.t0 - sg.delay) / span;
    return sg.v0 + (sg.to - sg.v0) * easeInOut(u);
  };
  for (const e of events) {
    if (e.t > t) break;
    v = at(e.t);
    const to = e.to[k];
    const P = to > v ? EXPLODE.open : EXPLODE.close;
    sg = {t0: e.t, v0: v, to, delay: instant || Math.abs(to - v) < 1e-6 ? 0 : P.delay[k], dur: instant ? 1e-6 : P.dur[k]};
  }
  return clamp(at(t), 0, 1);
}
export function liftsAt(events, t, init = [0, 0, 0, 0, 0], instant = false) {
  const lifts = LAYERS.map((_, k) => layerAt(events, k, t, init[k] ?? 0, instant));
  return {lifts, pull: lifts[0]};
}

// ------------------------------------------------------------ chapters (the console reads these)
// lab: refs.md 「実機で見るには」. Every command there is for the real machine only (Cloud の実機。費用がかかる).
export const CHAPTERS = [
  {
    n: 1,
    name: '外観',
    text: 'ラック 1 台に TPU トレイ 16 枚（チップ 4 個ずつ）とホストトレイ 16 枚。チップ 64 個がそのまま 4×4×4 の立方体 1 個になる。上から水受け、416 V 交流の整流器、ToR スイッチと監視トレイ、光のパッチパネル、トレイが左右 2 列 × 8 段、いちばん下に電池。寸法は公開されていないので形は仮定。',
    lab: [{cmd: 'gcloud compute tpus accelerator-types list --zone=<ZONE>'}],
    labWhat: 'そのゾーンで使える TPU の種類',
    subs: [{id: 'front', label: 'ラック全景'}, {id: 'cube', label: '立方体と並べる'}],
  },
  {
    n: 2,
    name: 'トレイを引き出す',
    text: 'TPU トレイ 1 枚にチップ 4 個が横 1 列。どのチップにもコールドプレートが載り、細い配管で並列に液が入る。前の縁に OSFP が 18 個、基板の裏にチップごとの PCIe Gen5 x16 でホストトレイへ。4 個は基板の配線で 2×2 の輪（推測）になり、トレイの外へ出る ICI は 4 × 6 − 4 × 2 = 16 本。',
    lab: [{cmd: 'python3 -c "import jax; print(jax.device_count(), jax.devices()[0].device_kind)"'}],
    labWhat: '4 チップの VM でデバイスが 8 個（チップ 1 個がダイ 2 個）',
    subs: [{id: 'open', label: '引き出して分解'}, {id: 'close', label: '戻す'}],
  },
  {
    n: 3,
    name: '隣とだけつなぐ',
    text: 'チップ 1 個の ICI は 6 本で、行き先は上下・左右・前後の隣のチップだけ。間にスイッチは無く、遠くへは隣から隣へ渡す。ラック 1 台の線は基板 64・銅 80・光 96 本で、端の数 2 × 144 + 96 = 384 は 64 個 × 6 本とぴったり合う。端と端は光で折り返して輪（トーラス）になる。',
    lab: [{cmd: 'python3 -c "import jax; [print(d.id, d.coords, d.core_on_chip) for d in jax.devices()]"'}],
    labWhat: '各デバイスのトーラス上の座標（coords は公式の API 文書に無い・未確認）',
    scenes: ['six', 'hop', 'wrap'],
  },
  {
    n: 4,
    name: '光でつなぎ替える',
    text: '立方体の 6 つの面から出る 96 本の光は OCS（光の回線スイッチ）に入る。OCS は鏡の向きで「どの面とどの面をつなぐか」を決めるだけで、パケットは読まない。同じ立方体から 4×4×16 も 8×8×4 も作れ、壊れた立方体は光の道から外して予備に差し替える。ポッドは立方体 144 個・9,216 チップ。',
    lab: [{cmd: 'gcloud compute tpus tpu-vm describe <NAME> --zone=<ZONE>'}],
    labWhat: 'スライスの種類と形、ホストの一覧（出力の項目名は未確認）',
    scenes: ['ocs', 'swap', 'pod'],
  },
  {
    n: 5,
    name: 'NVL72 と比べる',
    text: 'NVL72 は 72 個のどの組もスイッチ 1 段で届くが、1 つの領域は 72 個まで。Ironwood はスイッチを使わないぶん 1 つの領域が 9,216 個（128 倍）になるが、遠い相手へは隣から隣へ渡す: 立方体 1 個で 6 回、1,024 個で 16 回。線は 6 本 対 18 本で合計 1.2 対 1.8 TB/s、1 本は 200 対 100 GB/s で 2 倍太い。',
    lab: [],
    labNote: 'この章のコマンドは無い（座標は 3 章、形は 4 章のコマンドで見る）',
    scenes: ['vs'],
  },
  {
    n: 6,
    name: 'ポッドの外へ',
    text: 'ポッドの中の計算は ICI で運ぶ。ポッドどうしの計算とデータの出し入れは、チップ → PCIe → ホスト → NIC からデータセンターのネットワーク（Jupiter）へ出る。DCN はチップ 1 個に 100 Gb/s。ICI の片方向 600 GB/s はその 48 倍（DCN を片方向と仮定）。NVL72 のラックの中と外の差は 18 倍。',
    lab: [{cmd: 'gcloud compute tpus tpu-vm ssh <NAME> --zone=<ZONE> --worker=all --command="hostname"'}],
    labWhat: '1 つのスライスが何台のホストにまたがるか',
    scenes: ['out'],
  },
  {
    n: 7,
    name: '電気と液冷',
    text: '電気は上から 416 V の交流で入り、整流器で直流にして各トレイへ。いちばん下に電池。ポッド全体で 10 MW 近く、ラックあたりは 144 で割って約 69 kW（推測）。液は背面のマニホールドから各トレイの 4 チップと電圧調整器へ並列に入り、弁で流量を変えて CDU のラックへ戻る。熱は液と空気の両方で出る。',
    lab: [],
    labNote: '利用者からは見えない（Google のデータセンターの中）',
    scenes: ['power', 'cool'],
  },
];
export const chapterOf = (n) => CHAPTERS[clamp(Math.round(n) - 1, 0, CHAPTERS.length - 1)];
/** refs.md 「実際に使われている所」（1 章の脚注）。出典にあることだけ */
export const IN_USE = [
  'Anthropic: 2025-10-23、Google Cloud の TPU を最大 100 万個まで使い、2026 年に 1 GW を大きく超える計算能力を立ち上げると発表。発表文は Ironwood を名指し。TPU・Trainium・NVIDIA の GPU の 3 つを使う。',
  'Google: 液冷を GW 規模で運用、2020 年から全体の稼働率 約 99.999%。',
];
/** refs.md 「次の世代」（画面の脚注） */
export const NEXT_GEN = [
  'TPU 8t（学習用）: 3D トーラスのまま 1 ポッド 9,600 チップ、ICI は Ironwood の 2 倍。',
  'TPU 8i（推論用）: トーラスをやめて Boardfly。1,024 チップで最大ホップ 16 → 7。',
];
export const NOTICE = '非公式の教材。Google の TPU Ironwood を模した簡略形状で、寸法は仮定。Google・Cloud TPU・TPU・Ironwood・Jupiter は Google LLC の商標、NVIDIA・NVLink は NVIDIA Corporation の商標。数値は refs.md の出典による';
