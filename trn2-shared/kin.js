// The Trn2 / Trn2 UltraServer math, no three.js. Every number lives in SPEC (sources, 報道, 仮定 and 計算 in
// ../trn2/refs.md); the geometry, the console and the tests all read it from here. The NVL72 values it is compared with
// are read from ../nvl72-shared/kin.js, never copied. One input drives the page: time. A scene is a pure function of its
// own clock: torusAt / hopAt / zringAt / flatAt / hierAt / outAt / compareAt say where the moving things are and what
// the gauges read. The scene durations are STAGED TIME (made up for the eye); only the computed values (ms) exist in
// real time, and even those are 目安 (bandwidth only, with assumptions).
//
// The torus: chips are numbered row-major on a 4 × 4 × 4 grid, coord(i) = [x, y, z] = [i % 4, ⌊i / 4⌋ % 4, ⌊i / 16⌋].
// One instance is the z = 0 layer (16 chips, 4 × 4 2D torus); the UltraServer joins the 4 instances' chips of the same
// (x, y) with a ring in z (a 3D torus).
import {
  gpuCount as nvGpuCount,
  inOutRatio as nvInOutRatio,
  ringMs as nvRingMs,
  route as nvRoute,
  sharpMs as nvSharpMs,
  SPEC as NV,
  switchChips as nvSwitchChips,
} from '../nvl72-shared/kin.js';

export const SPEC = {
  // チップ: Trainium2 1 個（出典1、3）
  chip: {name: 'Trainium2', cores: 8, sramMBPerCore: 28, sramMiB: 224, hbmGiB: 96, hbmTBs: 2.9, fp8: 1299, bf16: 667, fp32: 181, linkTBs: 1.28, ccCores: 16},
  // インスタンス: trn2.48xlarge／trn2u.48xlarge（出典2、6、7、8）
  inst: {
    chips: 16,
    dims: [4, 4, 1],
    neighbors: 4,
    innerGiBs: 1024, // NeuronLink（インスタンスの中）／チップ
    hbmGiB: 1536,
    hbmTBs: 46.4,
    fp8PF: 20.8,
    bf16PF: 10.7,
    nics: 16,
    nicGbps: 200,
    efaTbps: 3.2,
    vcpu: 192,
    cpuCores: 96,
    cpu: 'Intel Xeon Sapphire Rapids',
    memGiB: 2048,
    nvme: {n: 4, gb: 1900},
    ebsGbps: 80,
  },
  // UltraServer: trn2u.48xlarge × 4（出典2、4、6、11）
  ultra: {instances: 4, chips: 64, cores: 512, dims: [4, 4, 4], neighbors: 6, interGiBs: 256, hbmGiB: 6144, hbmTBs: 185.6, fp8PF: 83.2, efaTbps: 12.8, vcpu: 768, memGiB: 8192},
  // 筐体（報道 出典18 のスレッドの数。並びと高さは仮定）。上から 計算 4 → ホスト → スイッチ 2 → 計算 4（仮定）
  server: {
    compute: 8,
    host: 1,
    switch: 2,
    chipsPerSled: 2,
    sledU: 2, // 仮定
    order: [
      ['compute', 4],
      ['host', 1],
      ['switch', 2],
      ['compute', 4],
    ],
  },
  // ラック（仮定）: 外形は NVL72 と比べやすいよう同じ寸法を流用。UltraServer は 2 本のラックに 2 台ずつ（報道 出典17）
  rack: {...NV.rack},
  racks: 2,
  serversPerRack: 2,
  // EFA（出典6、7）: チップ 1 個 200 Gb/s（カードとチップの 1 対 1 は計算による解釈）
  efa: {gbpsPerChip: 200},
  // all-reduce（帯域だけの単純計算。遅延は入れない。仮定: 送り出しは各リンクの片方向 = 中 512・間 128 GiB/s）
  allreduce: {gradGB: 1, chips: 64, innerOneWayGiBs: 512, interOneWayGiBs: 128},
  // Project Rainier（出典11。公式の値だけ）
  rainier: {chips: 500000, claudeChips: 1000000},
  // 場面の例（brief の指定）
  demo: {hopFrom: 0, hopTo: 10, zFrom: 0, zTo: 42, pull: {server: 1, sled: 5}},
  // 区分: 画面の注記に「報道」「仮定」を出すため（refs.md の表の区分）
  kind: {
    chip: {k: '一次', src: [1, 3]},
    inst: {k: '一次', src: [2, 6, 7, 8]},
    ultra: {k: '一次', src: [2, 4, 6]},
    neighbors: {k: '一次', src: [4, 5]},
    linkWidth: {k: '計算', note: '1,024 ÷ 4 本。リンクの太さが同じという仮定'},
    nicPerChip: {k: '計算', note: 'カード 16 枚とチップ 16 個の 1 対 1 は解釈'},
    sleds: {k: '報道', src: [18]},
    racks: {k: '報道', src: [17]},
    cooling: {k: '報道', src: [17], note: 'AWS は公表していない'},
    shape: {k: '仮定', note: 'AWS は寸法も並びも公表していない'},
    linkDirection: {k: '仮定', note: 'NeuronLink の値は両方向の合計とみなす。片方向なら比は倍'},
    allreduceMs: {k: '仮定', note: '帯域だけの目安。送り出しは各リンクの片方向'},
    rainier: {k: '一次', src: [11]},
  },
};
export const kindOf = (key) => SPEC.kind[key]?.k ?? '';
export const GIB = 1.073741824; // GB per GiB
export const U_MM = 44.45; // 1U

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const easeInOut = (x) => {
  const u = clamp(x, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
/** u remapped from [a, b] to 0..1, clamped */
export const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

// ------------------------------------------------------------ checks that refs.md 「検算」 spells out
export const instHbmGiB = (s = SPEC) => s.inst.chips * s.chip.hbmGiB;
export const instHbmTBs = (s = SPEC) => s.inst.chips * s.chip.hbmTBs;
export const ultraChips = (s = SPEC) => s.ultra.instances * s.inst.chips;
export const ultraHbmGiB = (s = SPEC) => ultraChips(s) * s.chip.hbmGiB;
export const ultraHbmTBs = (s = SPEC) => ultraChips(s) * s.chip.hbmTBs;
export const ultraCores = (s = SPEC) => ultraChips(s) * s.chip.cores;
export const instFp8TF = (s = SPEC) => s.inst.chips * s.chip.fp8;
export const ultraFp8TF = (s = SPEC) => ultraChips(s) * s.chip.fp8;
export const instBf16TF = (s = SPEC) => s.inst.chips * s.chip.bf16;
export const instEfaTbps = (s = SPEC) => (s.inst.nics * s.inst.nicGbps) / 1000;
export const ultraEfaTbps = (s = SPEC) => instEfaTbps(s) * s.ultra.instances;
/** チップ 1 個の外への帯域 Gb/s: 3.2 Tb/s ÷ 16 */
export const efaPerChipGbps = (s = SPEC) => (instEfaTbps(s) * 1000) / s.inst.chips;
/** NeuronLink の合計 GiB/s: 中 1,024 + 間 256 = 1,280（出典1 の 1.28 TB/s） */
export const linkTotalGiBs = (s = SPEC) => s.inst.innerGiBs + s.ultra.interGiBs;
/** 1 本のリンク: 中 1,024 ÷ 4 = 256、間 256 ÷ 2 = 128 GiB/s */
export const innerLinkGiBs = (s = SPEC) => s.inst.innerGiBs / s.inst.neighbors;
export const interLinkGiBs = (s = SPEC) => s.ultra.interGiBs / (s.ultra.neighbors - s.inst.neighbors);
/** EFA を両方向にした GB/s: 200 × 2 ÷ 8 = 50 */
export const efaGBs = (s = SPEC) => (s.efa.gbpsPerChip * 2) / 8;
/** 中と外の差（仮定: NeuronLink は両方向の合計、GiB と GB の差は無視）: 1,280 ÷ 50 = 25.6、中だけなら 1,024 ÷ 50 */
export const inOutRatio = (s = SPEC) => (s.chip.linkTBs * 1000) / efaGBs(s);
export const innerOutRatio = (s = SPEC) => s.inst.innerGiBs / efaGBs(s);
/** 中と間の太さの比: 1,024 ÷ 256 */
export const innerInterRatio = (s = SPEC) => s.inst.innerGiBs / s.ultra.interGiBs;
/** チップ 1 個の HBM を GB で（96 GiB = 103.1 GB）、UltraServer の HBM を TB で（6,144 GiB = 6.60 TB） */
export const chipHbmGB = (s = SPEC) => s.chip.hbmGiB * GIB;
export const ultraHbmTB = (s = SPEC) => (ultraHbmGiB(s) * GIB) / 1000;

// ------------------------------------------------------------ the torus
export const INST = SPEC.inst.dims;
export const ULTRA = SPEC.ultra.dims;
const size = (dims) => dims.reduce((a, b) => a * b, 1);
/** chip i's [x, y, z], row-major */
export const coord = (i, dims = ULTRA) => [i % dims[0], Math.floor(i / dims[0]) % dims[1], Math.floor(i / (dims[0] * dims[1])) % dims[2]];
export const indexOf = ([x, y, z], dims = ULTRA) => x + dims[0] * (y + dims[1] * z);
/** the direct neighbours: ±1 in every dimension longer than 1, wrapping round at the ends */
export function neighbors(i, dims = ULTRA) {
  const c = coord(i, dims);
  const out = new Set();
  dims.forEach((n, d) => {
    if (n < 2) return;
    for (const s of [1, -1]) {
      const cc = [...c];
      cc[d] = (cc[d] + s + n) % n;
      out.add(indexOf(cc, dims));
    }
  });
  return [...out].sort((a, b) => a - b);
}
/** every link once: [{a, b, dim, wrap}] (dim 2 = between instances) */
export function links(dims = ULTRA) {
  const out = [];
  for (let i = 0; i < size(dims); i++)
    for (const j of neighbors(i, dims)) {
      if (j <= i) continue;
      const a = coord(i, dims);
      const b = coord(j, dims);
      const dim = a.findIndex((v, k) => v !== b[k]);
      out.push({a: i, b: j, dim, wrap: Math.abs(a[dim] - b[dim]) > 1});
    }
  return out;
}
/** dimension-order route a → b: x first, then y, then z, each the short way round (a tie goes +) */
export function route(a, b, dims = ULTRA) {
  const path = [a];
  const c = coord(a, dims);
  const t = coord(b, dims);
  dims.forEach((n, d) => {
    const fwd = (t[d] - c[d] + n) % n;
    const step = fwd <= n / 2 ? 1 : -1;
    const k = step > 0 ? fwd : n - fwd;
    for (let s = 0; s < k; s++) {
      c[d] = (c[d] + step + n) % n;
      path.push(indexOf(c, dims));
    }
  });
  return path;
}
export const hops = (a, b, dims = ULTRA) => route(a, b, dims).length - 1;
/** the longest and the mean route over every ordered pair a ≠ b */
export function hopStats(dims = ULTRA) {
  const n = size(dims);
  let max = 0;
  let sum = 0;
  for (let a = 0; a < n; a++)
    for (let b = 0; b < n; b++) {
      if (a === b) continue;
      const h = hops(a, b, dims);
      max = Math.max(max, h);
      sum += h;
    }
  return {max, mean: sum / (n * (n - 1)), pairs: n * (n - 1)};
}
export const linkCount = (dims = ULTRA) => links(dims).length;
/** UltraServer の数え方 2 つ: 4 台 × 32 本 + Z のリング（16 列 × 4 本） */
export const ultraLinksByParts = (s = SPEC) => s.ultra.instances * linkCount(INST) + s.inst.chips * s.ultra.instances;

// ------------------------------------------------------------ all-reduce (1 GB over 64 chips, bandwidth only)
/** 1 本の輪: 2 (N − 1) / N × G */
export const flatSentGB = (s = SPEC) => ((2 * (s.allreduce.chips - 1)) / s.allreduce.chips) * s.allreduce.gradGB;
export const flatSteps = (s = SPEC) => 2 * (s.allreduce.chips - 1);
/** 階層型: 中で 2 × 15/16、間で 2 × 3/4 × 1/16 */
export const hierInnerGB = (s = SPEC) => ((2 * (s.inst.chips - 1)) / s.inst.chips) * s.allreduce.gradGB;
export const hierInterGB = (s = SPEC) => ((2 * (s.ultra.instances - 1)) / s.ultra.instances) * (s.allreduce.gradGB / s.inst.chips);
export const hierSentGB = (s = SPEC) => hierInnerGB(s) + hierInterGB(s);
export const innerShare = (s = SPEC) => hierInnerGB(s) / hierSentGB(s);
/** 所要時間の目安 ms（仮定: 中 512・間 128 GiB/s を片方向で使う） */
export const hierInnerMs = (s = SPEC) => (hierInnerGB(s) / (s.allreduce.innerOneWayGiBs * GIB)) * 1000;
export const hierInterMs = (s = SPEC) => (hierInterGB(s) / (s.allreduce.interOneWayGiBs * GIB)) * 1000;
export const hierMs = (s = SPEC) => hierInnerMs(s) + hierInterMs(s);

// ------------------------------------------------------------ NVL72, read from its own kin.js
export const NVL = {
  gpus: nvGpuCount(),
  switchChips: nvSwitchChips(),
  hops: nvRoute(0, 1).hops,
  ringMs: nvRingMs(),
  sharpMs: nvSharpMs(),
  inOutRatio: nvInOutRatio(),
  nicGbps: NV.cx7Gbps,
  hbmTB: NV.perf.hbmTB,
  rackKW: NV.power.rackKW,
  rack: NV.rack,
};

// ------------------------------------------------------------ the rings the all-reduce runs on
/** a closed 16-cycle through one layer: row 0 left to right, row 1 back, ... (ends next to its start through the wrap) */
export const layerCycle = (z, rev = false) => {
  const out = [];
  for (let y = 0; y < 4; y++) for (let k = 0; k < 4; k++) out.push(indexOf([y % 2 ? 3 - k : k, y, z]));
  return rev ? out.reverse() : out;
};
/** one ring through all 64: the layers' snakes joined by the z links (4 of its 64 links go between instances) */
export const FLAT_CYCLE = [0, 1, 2, 3].flatMap((z) => layerCycle(z, z % 2 === 1));
/** chip i's z ring: the 4 chips of the same (x, y) */
export const zRing = (i) => [0, 1, 2, 3].map((z) => indexOf([...coord(i).slice(0, 2), z]));

// ------------------------------------------------------------ scenes (staged time)
export const SCENES = {
  torus: {id: 'torus', name: '4 × 4 の網の目', sub: '1 台の 16 個・端は反対側へ回り込む', dur: 4.6},
  hop: {id: 'hop', name: 'チップからチップへ', sub: 'デバイス 0 → 10・隣から隣へ中継して 4 段', dur: 5.4},
  zring: {id: 'zring', name: '4 台を重ねる', sub: '同じ座標の 4 個をリングで結ぶ → 4 × 4 × 4', dur: 8.6},
  flat: {id: 'flat', name: '64 個を 1 本の輪で', sub: '1 本の輪を回す・細い「間」のリンクもまたぐ', dur: 7.0},
  hier: {id: 'hier', name: '階層型で集計', sub: '中で集計 → 間で集計 → 中で配り直す', dur: 6.4},
  out: {id: 'out', name: '外へ（EFA）', sub: 'チップ → ネットワークカード → 外の EFA', dur: 6},
  compare: {id: 'compare', name: 'NVL72 と並べる', sub: '行ごとに点灯して読む', dur: 7.4},
};
export const SCENE_IDS = Object.keys(SCENES);
export const sceneDuration = (scene) => SCENES[scene].dur;

/** torus: the 4 × 4 links draw, then the wrap-around arcs, then device 0's 4 neighbours light */
export const TORUS = {grid: [0, 1.4], wrap: [1.2, 2.6], nb: [2.8, 3.4]};
export function torusAt(t) {
  return {gridK: seg(t, ...TORUS.grid), wrapK: seg(t, ...TORUS.wrap), nbK: seg(t, ...TORUS.nb), nb: neighbors(SPEC.demo.hopFrom, INST)};
}
/** a bead along a route: start, one leg per hop, arrive */
const beadAlong = (path, t, t0, per) => {
  const n = path.length - 1;
  const x = clamp((t - t0) / per, 0, n);
  const k = Math.min(n - 1, Math.floor(x));
  const u = x - k;
  const done = t >= t0 + n * per;
  return {path, k: Math.max(0, k), u: done ? 1 : u, hops: done ? n : Math.floor(x + 1e-9), done};
};
export const HOP = {t0: 0.5, per: 1.0};
export function hopAt(t, s = SPEC) {
  const path = route(s.demo.hopFrom, s.demo.hopTo, INST);
  return beadAlong(path, t, HOP.t0, HOP.per);
}
/** zring: the 3 other layers come in, the z rings draw, then a bead goes the farthest way (6 hops) */
export const ZRING = {layers: [0, 1.8], rings: [1.8, 3.4], t0: 3.7, per: 0.72};
export function zringAt(t, s = SPEC) {
  const path = route(s.demo.zFrom, s.demo.zTo, ULTRA);
  const b = t >= ZRING.t0 ? beadAlong(path, t, ZRING.t0, ZRING.per) : {path, k: 0, u: 0, hops: 0, done: false, waiting: true};
  const layersK = seg(t, ...ZRING.layers);
  return {...b, layersK, ringsK: seg(t, ...ZRING.rings), chips: Math.round(SPEC.inst.chips + (ultraChips() - SPEC.inst.chips) * layersK)};
}
/** flat: u 0..1 through the 2 (N − 1) steps */
export function flatAt(t, s = SPEC) {
  const u = clamp(t / SCENES.flat.dur, 0, 1);
  const steps = flatSteps(s);
  const step = Math.min(steps, Math.floor(u * steps + 1e-9));
  return {u, step, steps, phase: step < steps / 2 ? 'reduce' : 'gather', sentGB: flatSentGB(s) * u, done: u >= 1};
}
/** hier: inside (reduce-scatter, 15 steps) → between (all-reduce of 1/16, 6 steps) → inside (all-gather, 15 steps) */
export const HIER_PH = {in1: [0, 2.6], z: [2.6, 3.8], in2: [3.8, 6.4]};
export function hierAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const p1 = seg(tt, ...HIER_PH.in1);
  const p2 = seg(tt, ...HIER_PH.z);
  const p3 = seg(tt, ...HIER_PH.in2);
  const phase = tt < HIER_PH.in1[1] ? 'in1' : tt < HIER_PH.z[1] ? 'z' : tt < HIER_PH.in2[1] ? 'in2' : 'done';
  const inner = (hierInnerGB(s) / 2) * (p1 + p3);
  const inter = hierInterGB(s) * p2;
  const sent = inner + inter;
  const ms = (hierInnerMs(s) / 2) * (p1 + p3) + hierInterMs(s) * p2;
  return {p1, p2, p3, phase, innerGB: inner, interGB: inter, sentGB: sent, ms, innerShare: sent > 0 ? inner / sent : 1, done: phase === 'done'};
}
/** out: beads per second on each side (the NeuronLink side carries 25.6 for every one that leaves) */
export const OUT = {perSecOut: 1.0, travelOut: 2.6, travelIn: 1.0};
export function outAt(t, s = SPEC) {
  const r = inOutRatio(s);
  return {ratio: r, perSecIn: OUT.perSecOut * r, perSecOut: OUT.perSecOut, t: Math.max(0, t)};
}
/** compare: the rows light one by one */
export const COMPARE = {t0: 0.3, per: 1.1};
export const COMPARE_ROWS = [
  {k: 'スイッチのチップ', nv: `${NVL.switchChips} 個`, tr: '0 個'},
  {k: '何段で届くか', nv: `${NVL.hops} 段（どの組も）`, tr: `最大 ${hopStats(ULTRA).max} 段（平均 ${(Math.round(hopStats(ULTRA).mean * 100) / 100).toFixed(2)}）`},
  {k: '冷やし方', nv: '液冷', tr: '空冷（報道。AWS は未公表）'},
  {k: '外へ（1 個あたり）', nv: `${NVL.nicGbps} Gb/s`, tr: `${efaPerChipGbps()} Gb/s`},
  {k: 'チップの数', nv: `GPU ${NVL.gpus}`, tr: `Trainium2 ${ultraChips()}`},
  {k: 'HBM の合計', nv: `${NVL.hbmTB} TB`, tr: `${ultraHbmTB().toFixed(1)} TB`},
];
export function compareAt(t) {
  const lit = clamp(Math.floor((t - COMPARE.t0) / COMPARE.per) + 1, 0, COMPARE_ROWS.length);
  return {lit, k: clamp((t - COMPARE.t0) / COMPARE.per - (lit - 1), 0, 1)};
}

/** t snapped for reduced motion: the bead jumps from chip to chip, the rings from eighth to eighth, the phases whole */
export function snapT(scene, t) {
  const tt = Math.max(0, t);
  const step = (t0, per) => (tt < t0 ? 0 : t0 + Math.floor((tt - t0) / per + 1e-9) * per + 1e-6);
  if (scene === 'hop') return step(HOP.t0, HOP.per);
  if (scene === 'zring') return tt < ZRING.t0 ? (tt < ZRING.rings[1] ? ZRING.layers[1] : ZRING.rings[1]) : step(ZRING.t0, ZRING.per);
  if (scene === 'torus') return tt < TORUS.wrap[1] ? TORUS.wrap[1] : TORUS.nb[1];
  if (scene === 'flat') return Math.floor((tt / SCENES.flat.dur) * 8 + 1e-9) * (SCENES.flat.dur / 8);
  if (scene === 'hier') {
    for (const [, b] of [HIER_PH.in2, HIER_PH.z, HIER_PH.in1]) if (tt >= b) return b;
    return 0;
  }
  if (scene === 'compare') return step(COMPARE.t0, COMPARE.per);
  return tt;
}

/** every gauge value of a scene at staged time t (the console, LIVE.s and the tests read this) */
export function gaugesAt(scene, t, s = SPEC) {
  const out = {scene, hops: 0, sentGB: 0, ms: 0, innerShare: null, innerGB: 0, interGB: 0, outRatio: inOutRatio(s), chips: ultraChips(s), rows: 0};
  if (scene === 'torus' || scene === 'hop') out.chips = s.inst.chips;
  // torus: once device 0's neighbours are lit, a neighbour is 1 hop away
  if (scene === 'torus') out.hops = torusAt(t).nbK >= 1 ? 1 : 0;
  if (scene === 'hop') out.hops = hopAt(t, s).hops;
  if (scene === 'zring') Object.assign(out, (({hops: h, chips}) => ({hops: h, chips}))(zringAt(t, s)));
  if (scene === 'flat') out.sentGB = flatAt(t, s).sentGB;
  if (scene === 'hier') Object.assign(out, (({sentGB, ms, innerShare: sh, innerGB, interGB}) => ({sentGB, ms, innerShare: sh, innerGB, interGB}))(hierAt(t, s)));
  if (scene === 'compare') out.rows = compareAt(t).lit;
  return out;
}

// ------------------------------------------------------------ the pulled sled's layers (chapter 2)
// Layers: the pull out of the rack, then from the top 天板, ヒートシンク, チップ, カード.
// Opening: the pull first, then the layers top first with a stagger. Closing: bottom layer first, fast, the pull last.
export const LAYERS = ['pull', 'lid', 'sinks', 'chips', 'io'];
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
/** all five at t */
export function liftsAt(events, t, init = [0, 0, 0, 0, 0], instant = false) {
  const lifts = LAYERS.map((_, k) => layerAt(events, k, t, init[k] ?? 0, instant));
  return {lifts, pull: lifts[0]};
}

// ------------------------------------------------------------ chapters (the console reads these)
const fmt = (n) => Math.round(n).toLocaleString('en-US');
// lab: refs.md 「実機で見るには」. Every command there is for a real Trn2 only.
export const CHAPTERS = [
  {
    n: 1,
    name: '外観',
    text: `形は仮定（AWS は寸法も並びも公表していない）。UltraServer の 4 台を 2 本のラックに 2 台ずつ置いた（報道）。1 台は計算スレッド 8 枚（Trainium2 を 2 個ずつ）、ホストのスレッド 1 枚、スイッチのスレッド 2 枚（報道）。背面の NeuronLink のケーブルが、サーバーの中の網の目と 4 台をまたぐ Z のリングをつくる。`,
    lab: [],
    labNote: '外観を見るコマンドは無い（2 章から）',
    subs: [{id: 'front', label: '前から'}, {id: 'back', label: '後ろから'}],
  },
  {
    n: 2,
    name: 'サーバーを引き出す',
    text: `計算スレッド 1 枚に Trainium2 が 2 個（報道）。チップ 1 個に NeuronCore ${SPEC.chip.cores} 個、HBM ${SPEC.chip.hbmGiB} GiB・${SPEC.chip.hbmTBs} TB/s、FP8 ${fmt(SPEC.chip.fp8)} TFLOPS（密）。大きなヒートシンクにファンで風を当てて冷やす（報道。AWS は未公表）。ホストは Xeon（Sapphire Rapids）${SPEC.inst.vcpu} vCPU・2 TiB。`,
    lab: [{cmd: 'neuron-ls'}],
    labWhat: 'チップごとの NeuronCore・メモリ・隣・NUMA',
    subs: [{id: 'open', label: '引き出して分解'}, {id: 'close', label: '戻す'}],
  },
  {
    n: 3,
    name: '16 個を網の目に',
    text: `1 台の 16 個は 4 × 4 のトーラス。上下左右の 4 個と直結し、端は反対側へ回り込む。リンクは 16 × 4 ÷ 2 = ${linkCount(INST)} 本で、スイッチのチップは 0 個。そのかわり遠い相手へは隣から隣へ中継し、最大 ${hopStats(INST).max} 段・平均 ${hopStats(INST).mean.toFixed(2)} 段（NVL72 はどの組もスイッチ ${NVL.hops} 段）。`,
    lab: [{cmd: 'neuron-ls --topology'}],
    labWhat: '隣どうしのつながりの図（回り込みも描く）',
    scenes: ['torus', 'hop'],
  },
  {
    n: 4,
    name: '4 台で 64 個に',
    text: `4 台の同じ座標のチップをリングでつなぐと 4 × 4 × 4 の 3D トーラス。隣は ${SPEC.ultra.neighbors} 個、リンクは ${linkCount(ULTRA)} 本、最大 ${hopStats(ULTRA).max} 段・平均 ${hopStats(ULTRA).mean.toFixed(2)} 段。チップ 1 個の帯域は中（インスタンスの中）が ${fmt(SPEC.inst.innerGiBs)} GiB/s、間が ${SPEC.ultra.interGiBs} GiB/s で、中が ${innerInterRatio()} 倍太い。`,
    lab: [{cmd: 'neuron-ls --topology'}],
    labWhat: 'UltraServer の各インスタンスで。間の見え方は未確認',
    scenes: ['zring'],
  },
  {
    n: 5,
    name: '学習 1 歩の集計',
    text: `1 GB の勾配を 64 個で合計する（all-reduce）。1 本の輪でも階層型でも、チップ 1 個が送るのは ${flatSentGB().toFixed(3)} GB で同じ。階層型は中で集計 → 間で集計 → 中で配り直すので、${(innerShare() * 100).toFixed(1)} % が太い「中」に載る。所要時間は帯域だけの目安で ${hierMs().toFixed(3)} ms（仮定つき）。`,
    lab: [{cmd: 'nccom-test -r 64 allr'}],
    labWhat: '実測の algbw と busbw。2 台は refs.md の例',
    scenes: ['flat', 'hier'],
  },
  {
    n: 6,
    name: '外へ（EFA）',
    text: `サーバーの外へはネットワークカード ${SPEC.inst.nics} 枚 × ${SPEC.inst.nicGbps} Gb/s = ${instEfaTbps()} Tb/s（EFAv3）。チップ 1 個に 1 枚とみると ${efaPerChipGbps()} Gb/s で、NVL72 の GPU 1 個（${NVL.nicGbps} Gb/s）の半分。NeuronLink ${SPEC.chip.linkTBs} TB/s との差は ${inOutRatio().toFixed(1)} 倍（仮定つき。NVL72 は ${fmt(NVL.inOutRatio)} 倍）。`,
    lab: [{cmd: 'fi_info -p efa'}],
    labWhat: 'EFA の provider が見えるか',
    scenes: ['out'],
  },
  {
    n: 7,
    name: '何を選んだか',
    text: `NVIDIA はスイッチ ${NVL.switchChips} 個で 72 個をどれも 1 段につなぎ、液で冷やす。AWS はスイッチを置かずにチップどうしを直結し、遠い相手へは中継する。だから一番よく話す相手を近くに置く。冷やし方は空冷（報道。AWS は未公表）。次の世代 Trn3 はスイッチ 1 段（NeuronSwitch）へ移った。`,
    lab: [{cmd: 'neuron-top'}, {cmd: 'neuron-monitor'}],
    labWhat: '使用率とメモリ。電力・温度は出ない',
    scenes: ['compare'],
  },
];
export const chapterOf = (n) => CHAPTERS[clamp(Math.round(n) - 1, 0, CHAPTERS.length - 1)];
/** refs.md 「Project Rainier と Anthropic」（1 章の脚注） */
export const RAINIER = `Project Rainier: Trainium2 約 ${fmt(SPEC.rainier.chips / 10000)} 万個が米国の複数のデータセンターで稼働。Claude は年末までに ${fmt(SPEC.rainier.claudeChips / 10000)} 万個超に載る見込み（実績ではない）。`;
/** refs.md 「次の世代」（7 章の脚注） */
export const NEXT_GEN = [
  'Trainium3（2025-12-02 発表、3 nm）: チップ 1 個 FP8 2.52 PFLOPS、HBM3e 144 GB・4.9 TB/s。Trn3 UltraServer は最大 144 チップ、HBM 20.7 TB。NeuronLink-v4 は 2.56 TB/s／チップ。',
  'チップどうしは NeuronSwitch-v1（全対全のスイッチ）でつなぎ、帯域は Trn2 UltraServer の 2 倍。「スイッチを置かないトーラス」から「スイッチ 1 段」へ移った。',
];
export const NOTICE = '非公式の教材。AWS Trainium2・Trn2 UltraServer を模した簡略形状（形は仮定）。AWS・Amazon・Amazon EC2・Trainium・Neuron は Amazon.com, Inc. またはその関連会社の商標。NVIDIA・GB200・NVLink は NVIDIA Corporation の商標。数値は refs.md の出典による';
