// The DGX B200 (HGX B200) server's math, no three.js. Every number lives in SPEC (sources, 仮定 and 計算 in ../hgx/refs.md);
// the geometry, the console and the tests all read it from here. The NVL72 values of chapter 5 are read from
// ../nvl72-shared/kin.js, never copied. One input drives the page: time. A scene is a pure function of its own clock:
// fanAt / hopAt / wallAt / railsAt / hierAt / vs72At / powerAt / rackAt / airAt say where the moving things are and
// what the gauges read. The scene durations are STAGED TIME (made up for the eye); only the computed values (ms, A,
// CFM, L/分) exist in real time.
//
// Coordinates of the model (millimetres, in chassis.js): x across the front (right = +), y up from the floor, z front
// (+) to back (-).
import {gpuCount as nvGpuCount, ringMs as nvRingMs, SPEC as NV} from '../nvl72-shared/kin.js';

export {NV};
export const SPEC = {
  // 筐体（出典1、2）
  chassis: {u: 10, h: 444, w: 482.3, wSrc2: 482.2, d: 897.1, kg: 142.4},
  // GPU と NVLink（出典1、2、3、6）
  gpus: 8,
  gpu: {name: 'B200', hbmGB: 180, hbmTBs: 8, maxW: 1000, lowW: 800}, // 計算: 1,440 ÷ 8、64 ÷ 8
  hbm: {totalGB: 1440, totalTBs: 64},
  nvlink: {gen: 5, linksPerGpu: 18, gpuTBs: 1.8, linkGBs: 100, switches: 2, portsPerChip: 72, totalTBs: 14.4},
  // CPU とメモリ（出典1、2）
  cpu: {name: 'Xeon Platinum 8570', count: 2, cores: 56, ghz: 2.1, ghzMax: 4},
  mem: {TB: 2, dimms: 32, maxTB: 4},
  // ネットワーク（出典1、2、3、5）
  net: {cx7: 8, cx7Gbps: 400, osfp: 4, portsPerOsfp: 2, productTBs: 0.8, rails: 8, leafSwitch: 'Quantum QM9700'},
  // OSFP のポートと GPU の対応（出典1 の Network Modules の表）
  osfpGpu: {'1P1': 7, '1P2': 4, '2P1': 6, '2P2': 5, '3P1': 2, '3P2': 1, '4P1': 3, '4P2': 0},
  bf3: {count: 2, ports: 2, gbps: 400},
  storage: {m2: 2, m2TB: 1.92, u2: 8, u2TB: 3.84},
  // 電源（出典1、2、4b）
  power: {kw: 14.3, btuh: 48794, psus: 6, psuKW: 3.3, need: 5, vMin: 200, vMax: 240, ampsRated: 16},
  btuPerW: 3.412,
  // 空冷（出典1。空気の密度・比熱は 20 °C の値で仮定、熱は全部空気に行くと仮定）
  air: {cfm: 1550, rho: 1.2, cpKJ: 1.005, m3sPerCfm: 0.000471947, inletC: 35, tMinC: 10, tMaxC: 35, dTMin: 10, dTMax: 20},
  // 水と比べる（4.18 kJ/kg·K、1 L = 1 kg、温度差 10 K）
  water: {cpKJ: 4.18, dT: 10, kgPerL: 1},
  // 前面のファンモジュール（数は仮定。画面に数は出さない）
  fans: {rows: 2, cols: 6},
  // ラック（上限は仮定）
  rack: {u: 42, limits: [30, 40, 60], limitDefault: 30},
  U_MM: 44.45,
  // all-reduce（帯域だけの単純計算。2 段の方式は仮定）
  allreduce: {gradGB: 1, gpus: 72, inOneWayGBs: 900, outOneWayGBs: 50},
  // 場面の例（brief の指定）
  demo: {hopFrom: 0, hopTo: 5, wallGpu: 0, wallRail: 0},
};
export const U_MM = SPEC.U_MM;

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
export const hbmTotalGB = (s = SPEC) => s.gpus * s.gpu.hbmGB;
export const hbmTotalTBs = (s = SPEC) => s.gpus * s.gpu.hbmTBs;
/** GPU 側のリンク数: 8 × 18 = 144 */
export const gpuSidePorts = (s = SPEC) => s.gpus * s.nvlink.linksPerGpu;
/** スイッチ側のポート数: 2 × 72 = 144 */
export const switchSidePorts = (s = SPEC) => s.nvlink.switches * s.nvlink.portsPerChip;
/** GPU 1 個から各チップへ: 18 ÷ 2 = 9 本 */
export const linksPerChip = (s = SPEC) => s.nvlink.linksPerGpu / s.nvlink.switches;
/** 1 本のリンク GB/s（双方向）と片方向 */
export const linkGBs = (s = SPEC) => (s.nvlink.gpuTBs * 1000) / s.nvlink.linksPerGpu;
export const linkOneWayGBs = (s = SPEC) => linkGBs(s) / 2;
/** 8 個の NVLink の合計 TB/s: 8 × 1.8 */
export const nvlinkTotalTBs = (s = SPEC) => s.gpus * s.nvlink.gpuTBs;
/** ConnectX-7 の 400 Gb/s を双方向にした GB/s */
export const nicGBs = (s = SPEC) => (s.net.cx7Gbps * 2) / 8;
/** 箱の中と外の差: 1.8 TB/s ÷ 100 GB/s */
export const inOutRatio = (s = SPEC) => (s.nvlink.gpuTBs * 1000) / nicGBs(s);
/** ネットワークの帯域: 片方向 GB/s と双方向 TB/s（8 × 400 Gb/s） */
export const netOneWayGBs = (s = SPEC) => (s.net.cx7 * s.net.cx7Gbps) / 8;
export const netBothTBs = (s = SPEC) => (netOneWayGBs(s) * 2) / 1000;
/** 72 個で学習するとき、1 個から見て NVLink で届く相手と、その割合 */
export const inDomain = (s = SPEC) => s.gpus - 1;
export const others = (s = SPEC) => s.allreduce.gpus - 1;
export const inDomainFrac = (s = SPEC) => inDomain(s) / others(s);
export const boxesFor = (gpus = SPEC.allreduce.gpus, s = SPEC) => Math.ceil(gpus / s.gpus);
/** all-reduce 段1＋段3（箱の中）: 2 × 7/8 × G、片方向 900 GB/s */
export const inSentGB = (s = SPEC) => ((2 * (s.gpus - 1)) / s.gpus) * s.allreduce.gradGB;
export const inMs = (s = SPEC) => (inSentGB(s) / s.allreduce.inOneWayGBs) * 1000;
/** all-reduce 段2（箱の外、同じ番号の 9 個でリング）: 2 × 8/9 × (G ÷ 8)、片方向 50 GB/s */
export const outSentGB = (s = SPEC) => {
  const n = boxesFor(s.allreduce.gpus, s);
  return ((2 * (n - 1)) / n) * (s.allreduce.gradGB / s.gpus);
};
export const outMs = (s = SPEC) => (outSentGB(s) / s.allreduce.outOneWayGBs) * 1000;
/** 1 台から外へ出る量: 8 × 0.2222 */
export const boxOutGB = (s = SPEC) => s.gpus * outSentGB(s);
export const hierMs = (s = SPEC) => inMs(s) + outMs(s);
/** NVL72 のリング（../nvl72-shared/kin.js から読む）と、何倍か */
export const nvl72Ms = () => nvRingMs();
export const vsRatio = (s = SPEC) => hierMs(s) / nvl72Ms();
/** 電源: 5 台で使える kW、積んだ kW、1 台の kW と電流 */
export const usableKW = (s = SPEC) => s.power.need * s.power.psuKW;
export const installedKW = (s = SPEC) => s.power.psus * s.power.psuKW;
export const psuLoadKW = (s = SPEC) => s.power.kw / s.power.need;
export const psuAmps = (v = SPEC.power.vMin, s = SPEC) => (psuLoadKW(s) * 1000) / v;
/** 発熱の単位換算: BTU/h ÷ 3.412 = W */
export const heatW = (s = SPEC) => s.power.btuh / s.btuPerW;
/** 空冷: CFM → m³/s、風量と温度差（熱量 = 密度 × 比熱 × 風量 × 温度差） */
export const cfmToM3s = (cfm, s = SPEC) => cfm * s.air.m3sPerCfm;
export const airDT = (cfm = SPEC.air.cfm, s = SPEC) => (s.power.kw * 1000) / (s.air.rho * s.air.cpKJ * 1000 * cfmToM3s(cfm, s));
export const airM3s = (dT, s = SPEC) => (s.power.kw * 1000) / (s.air.rho * s.air.cpKJ * 1000 * dT);
export const airCfm = (dT, s = SPEC) => airM3s(dT, s) / s.air.m3sPerCfm;
/** 出典の 1,550 CFM での温度差（約 16.2 K）: スライダーの初期値 */
export const DT_SRC = airDT();
/** 水: kg/s と L/分（温度差 10 K）、空気との体積の比 */
export const waterKgS = (dT = SPEC.water.dT, s = SPEC) => s.power.kw / (s.water.cpKJ * dT);
export const waterLpm = (dT = SPEC.water.dT, s = SPEC) => (waterKgS(dT, s) * 60) / s.water.kgPerL;
export const airWaterRatio = (s = SPEC) => cfmToM3s(s.air.cfm, s) / (waterKgS(s.water.dT, s) / s.water.kgPerL / 1000);
/** 高さ: 10U × 44.45 mm */
export const heightMM = (s = SPEC) => s.chassis.u * s.U_MM;
/** ラックに何台: 場所（42U ÷ 10U）と電力（上限 ÷ 14.3 kW）の小さい方 */
export const perRackBySpace = (s = SPEC) => Math.floor(s.rack.u / s.chassis.u);
export const perRackOf = (limitKW, s = SPEC) => Math.min(perRackBySpace(s), Math.floor(limitKW / s.power.kw + 1e-9));
/** 72 個そろえると: 9 台の kW と U、ラックの本数 */
export const clusterKW = (s = SPEC) => boxesFor(s.allreduce.gpus, s) * s.power.kw;
export const clusterU = (s = SPEC) => boxesFor(s.allreduce.gpus, s) * s.chassis.u;
export const racksFor = (perRack, s = SPEC) => Math.ceil(boxesFor(s.allreduce.gpus, s) / perRack);
/** GPU 1 個あたりの電力 kW: DGX B200 と NVL72 */
export const kwPerGpu = (s = SPEC) => s.power.kw / s.gpus;
export const nvl72KwPerGpu = () => NV.power.rackKW / nvGpuCount();
/** ほかの合計 */
export const coreCount = (s = SPEC) => s.cpu.count * s.cpu.cores;
export const cacheTB = (s = SPEC) => s.storage.u2 * s.storage.u2TB;
export const dimmGB = (s = SPEC) => (s.mem.TB * 1024) / s.mem.dimms;

// ------------------------------------------------------------ the NVLink wiring (計算による解釈)
// link l (0..17) of GPU g (0..7) goes to chip floor(l / 9), port g × 9 + l mod 9: every chip port used once
export const linkTo = (g, l, s = SPEC) => {
  const per = linksPerChip(s);
  return {chip: Math.floor(l / per), port: g * per + (l % per)};
};
/** the chip a pair talks through (either would do; this spreads the pairs over both) */
export const chipFor = (a, b) => (a + b) % SPEC.nvlink.switches;
/** GPU a → GPU b: the nodes on the way and the switch chips passed */
export function route(a, b, s = SPEC) {
  const c = chipFor(a, b);
  const per = linksPerChip(s);
  const up = linkTo(a, c * per, s);
  const down = linkTo(b, c * per, s);
  return {nodes: [{gpu: a}, {chip: c, inPort: up.port, outPort: down.port}, {gpu: b}], chips: [c], hops: 1};
}
/** the OSFP port of GPU g: '4P2' for GPU 0 */
export const osfpOf = (g, s = SPEC) => Object.keys(s.osfpGpu).find((k) => s.osfpGpu[k] === g);

// ------------------------------------------------------------ scenes (staged time)
export const SCENES = {
  fan: {id: 'fan', name: '18 本のリンク', sub: 'GPU 0 → 9 本ずつ 2 個の NVSwitch へ', dur: 5.0},
  hop: {id: 'hop', name: 'GPU から GPU へ', sub: 'GPU 0 → NVSwitch 1 個 → GPU 5', dur: 4.0},
  wall: {id: 'wall', name: '9 個目の GPU', sub: 'ConnectX-7 → OSFP → リーフ（箱の外）', dur: 6},
  rails: {id: 'rails', name: '8 本のレール', sub: '9 台の同じ番号の GPU が同じリーフへ', dur: 4},
  hier: {id: 'hier', name: '2 段で集計', sub: '箱の中で集める → 外のリング → 箱の中で配る', dur: 9},
  vs72: {id: 'vs72', name: 'NVL72 と比べる', sub: '同じ 1 GB の集計を 2 本の棒で', dur: 4},
  power: {id: 'power', name: '電源', sub: '背面の電源 6 台 → 箱の中（5+1）', dur: 6},
  rack: {id: 'rack', name: 'ラックに何台', sub: '42U に場所は 4 台ぶん・電力で止まる', dur: 6},
  air: {id: 'air', name: '風の流れ', sub: '前面から吸って背面へ出す', dur: 6},
};
export const SCENE_IDS = Object.keys(SCENES);
export const sceneDuration = (scene) => SCENES[scene].dur;

const legAt = (legs, t) => {
  let acc = 0;
  for (let i = 0; i < legs.length; i++) {
    if (t < acc + legs[i].dur || i === legs.length - 1) return {i, leg: legs[i], u: clamp((t - acc) / legs[i].dur, 0, 1), t0: acc};
    acc += legs[i].dur;
  }
  return {i: 0, leg: legs[0], u: 0, t0: 0};
};
// hop: the bead's legs (staged seconds). The bead reaches the NVSwitch at the end of 'up'.
export const HOP_LEGS = [
  {id: 'gpu', dur: 0.6, ja: 'GPU 0 が送り出す'},
  {id: 'up', dur: 1.0, ja: '基板の中の線で NVSwitch へ'},
  {id: 'chip', dur: 0.9, ja: 'NVSwitch が出口を選ぶ'},
  {id: 'down', dur: 1.0, ja: 'GPU 5 へ'},
  {id: 'arrive', dur: 0.5, ja: '届いた'},
];
const HOP_TOTAL = HOP_LEGS.reduce((a, l) => a + l.dur, 0);
export function hopAt(t, s = SPEC) {
  const tt = clamp(t, 0, HOP_TOTAL);
  const {i, leg, u} = legAt(HOP_LEGS, tt);
  const a = s.demo.hopFrom;
  const b = s.demo.hopTo;
  const r = route(a, b, s);
  const iChip = HOP_LEGS.findIndex((l) => l.id === 'chip');
  const hops = i > iChip || (i === iChip && u > 0.3) ? 1 : 0;
  return {leg: leg.id, legIndex: i, u, ja: leg.ja, a, b, chip: r.chips[0], hops, done: t >= HOP_TOTAL - 1e-9};
}
/** fan: how many of the 18 links are drawn (fractional while one grows) */
export const FAN = {start: 0.4, stagger: 0.2, grow: 0.6};
export function fanAt(t, s = SPEC) {
  const n = s.nvlink.linksPerGpu;
  const links = Array.from({length: n}, (_, l) => clamp((t - FAN.start - l * FAN.stagger) / FAN.grow, 0, 1));
  const lit = links.filter((k) => k >= 1).length;
  const per = linksPerChip(s);
  return {links, lit, from: s.demo.hopFrom, perChip: [Math.min(per, lit), Math.max(0, lit - per)]};
}
/** wall: beads per second on each side (NVLink carries 18 for every one that leaves the box) */
export const WALL = {perSecOut: 0.8, travelOut: 4.2, travelIn: 1.2};
export function wallAt(t, s = SPEC) {
  const r = inOutRatio(s);
  return {ratio: r, nvlinkTBs: s.nvlink.gpuTBs, nicGBs: nicGBs(s), perSecIn: WALL.perSecOut * r, perSecOut: WALL.perSecOut, t: Math.max(0, t)};
}
/** rails: the rail lines grow, then the 7 box-mates of GPU 0 light one by one */
export const RAILS = {grow: [0.2, 1.6], lit: [1.6, 3.2]};
export function railsAt(t, s = SPEC) {
  const k = seg(t, ...RAILS.grow);
  const lit = Math.floor(seg(t, ...RAILS.lit) * inDomain(s) + 1e-9);
  return {k, lit, inDomain: inDomain(s), others: others(s), frac: inDomainFrac(s)};
}
/** hier: 段1 箱の中で分けて集める → 段2 同じ番号どうしで外のリング → 段3 箱の中で配る */
export const HIER = {s1: [0, 2.5], s2: [2.5, 6.5], s3: [6.5, 9]};
export function hierAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const u1 = seg(tt, ...HIER.s1);
  const u2 = seg(tt, ...HIER.s2);
  const u3 = seg(tt, ...HIER.s3);
  const half = inSentGB(s) / 2;
  const sentInGB = half * (u1 + u3);
  const sentOutGB = outSentGB(s) * u2;
  const stage = tt < HIER.s1[1] ? 1 : tt < HIER.s2[1] ? 2 : tt < HIER.s3[1] ? 3 : 4;
  return {u1, u2, u3, stage, sentInGB, sentOutGB, sentGB: sentInGB + sentOutGB, outGB: s.gpus * sentOutGB, ms: (inMs(s) / 2) * (u1 + u3) + outMs(s) * u2, done: stage === 4};
}
/** vs72: both clocks run at the same rate; NVL72 is done first */
export const VS = {start: 0.4, msPerSec: 2.0};
export function vs72At(t, s = SPEC) {
  const run = Math.max(0, t - VS.start) * VS.msPerSec;
  const dgxMs = Math.min(hierMs(s), run);
  const nvMs = Math.min(nvl72Ms(), run);
  return {dgxMs, nvMs, dgxOutGB: boxOutGB(s) * (dgxMs / hierMs(s)), nvOutGB: 0, done: run >= hierMs(s), nvDone: run >= nvl72Ms()};
}
/** power: the load ramps in once (staged); 5 supplies share it, the 6th waits */
export const POWER = {ramp: 1.2};
export function powerAt(t, s = SPEC) {
  const k = ease(Math.max(0, t) / POWER.ramp);
  return {k, kw: s.power.kw * k, amps: psuAmps(s.power.vMin, s) * k, usableKW: usableKW(s), installedKW: installedKW(s), on: s.power.need, spare: s.power.psus - s.power.need};
}
/** rack: the boxes slide in one by one up to what the power allows; from = how many were in before the limit changed */
export const RACK_ANIM = {start: 0.3, each: 0.7, dur: 0.6};
export function rackAt(t, limitKW = SPEC.rack.limitDefault, from = 0, s = SPEC) {
  const n = perRackOf(limitKW, s);
  const slots = perRackBySpace(s);
  const tt = Math.max(0, t);
  const ins = Array.from({length: slots}, (_, i) => {
    if (i < Math.min(n, from)) return 1;
    if (i >= Math.max(n, from)) return 0;
    if (n > from) return ease((tt - RACK_ANIM.start - (i - from) * RACK_ANIM.each) / RACK_ANIM.dur);
    return 1 - ease((tt - RACK_ANIM.start - (from - 1 - i) * RACK_ANIM.each) / RACK_ANIM.dur);
  });
  const inside = ins.filter((v) => v >= 1 - 1e-9).length;
  return {n, slots, ins, inside, kw: n * s.power.kw, limitKW, done: ins.every((v, i) => (i < n ? v >= 1 - 1e-9 : v <= 1e-9))};
}
/** air: the airflow for a temperature difference (10..20 K); the outlet reading climbs once (staged) */
export const AIR = {ramp: 1.6};
export function airAt(t, dT = DT_SRC, s = SPEC) {
  const d = clamp(dT, s.air.dTMin, s.air.dTMax);
  const k = ease(Math.max(0, t) / AIR.ramp);
  return {dTSet: d, dT: d * k, k, m3s: airM3s(d, s), cfm: airCfm(d, s), speed: airCfm(d, s) / s.air.cfm, outletC: s.air.inletC + d, t: Math.max(0, t)};
}

/** t snapped for reduced motion: the bead jumps from leg to leg, the stages and the bars jump to their ends */
export function snapT(scene, t) {
  const tt = Math.max(0, t);
  if (scene === 'hop') return legAt(HOP_LEGS, tt).t0 + 1e-6;
  if (scene === 'fan') return FAN.start + Math.floor(Math.max(0, tt - FAN.start) / FAN.stagger) * FAN.stagger + FAN.grow;
  if (scene === 'hier') {
    for (const [, b] of [HIER.s3, HIER.s2, HIER.s1]) if (tt >= b) return b;
    return HIER.s1[1];
  }
  if (scene === 'rails' || scene === 'vs72') return Math.max(tt, SCENES[scene].dur);
  if (scene === 'rack') return Math.max(tt, 10);
  if (scene === 'power') return Math.max(tt, POWER.ramp);
  if (scene === 'air') return Math.max(tt, AIR.ramp);
  return tt;
}

/** every gauge value of a scene at staged time t (the console, LIVE.s and the tests read this) */
export function gaugesAt(scene, t, opts = {}, s = SPEC) {
  const out = {scene, hops: 0, links: 0, inDomain: 0, outRatio: 0, sentGB: 0, sentInGB: 0, sentOutGB: 0, outGB: 0, ms: 0, nvMs: 0, amps: 0, kw: 0, cfm: 0, dT: 0, perRack: 0, stage: 0};
  if (scene === 'hop') out.hops = hopAt(t, s).hops;
  if (scene === 'fan') out.links = fanAt(t, s).lit;
  if (scene === 'wall') out.outRatio = inOutRatio(s);
  if (scene === 'wall' || scene === 'rails') out.inDomain = inDomainFrac(s);
  if (scene === 'rails') out.links = railsAt(t, s).lit;
  if (scene === 'hier') {
    const h = hierAt(t, s);
    Object.assign(out, {sentGB: h.sentGB, sentInGB: h.sentInGB, sentOutGB: h.sentOutGB, outGB: h.outGB, ms: h.ms, stage: h.stage});
  }
  if (scene === 'vs72') {
    const v = vs72At(t, s);
    Object.assign(out, {ms: v.dgxMs, nvMs: v.nvMs, outGB: v.dgxOutGB});
  }
  if (scene === 'power') Object.assign(out, (({amps, kw}) => ({amps, kw}))(powerAt(t, s)));
  if (scene === 'rack') out.perRack = rackAt(t, opts.limit ?? s.rack.limitDefault, opts.from ?? 0, s).n;
  if (scene === 'air') {
    const a = airAt(t, opts.dT ?? DT_SRC, s);
    Object.assign(out, {cfm: a.cfm, dT: a.dT});
  }
  return out;
}

// ------------------------------------------------------------ the exploded view (chapter 2)
// Layers: the motherboard tray slides out of the back, then from the top: the GPU tray's lid, the GPU heatsinks, the
// motherboard tray's air baffle, the Xeon heatsinks. Opening: the pull first, then the layers top first with a stagger.
// Closing: bottom layer first, fast, the pull last.
export const LAYERS = ['pull', 'lid', 'sinks', 'baffle', 'cpuSinks'];
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
/** the bezel (chapter 1): off = 1. Glides over BEZEL.dur after a press: [{t, to}] */
export const BEZEL = {dur: 1.1};
export function bezelAt(events, t, init = 0, instant = false) {
  let v = init;
  let sg = null;
  const at = (tt) => (sg ? sg.v0 + (sg.to - sg.v0) * easeInOut((tt - sg.t0) / (instant ? 1e-6 : BEZEL.dur)) : v);
  for (const e of events) {
    if (e.t > t) break;
    v = at(e.t);
    sg = {t0: e.t, v0: v, to: e.to};
  }
  return clamp(at(t), 0, 1);
}

// ------------------------------------------------------------ chapters (the console reads these)
// lab: refs.md 「実機で見るには」. Every command there is for the real machine only.
const LAB_POWER = {lab: [{cmd: 'sudo ipmitool sdr type "Power Supply"'}, {cmd: 'nvidia-smi -q -d POWER'}], labWhat: '電源 6 台の状態、GPU ごとの電力（上限 1,000 W）'};
export const CHAPTERS = [
  {
    n: 1,
    name: '外観',
    text: '高さ 444 × 幅 482.3 × 奥行 897.1 mm、10U の空冷サーバーに B200 GPU 8 個。前面のベゼルの奥にファンモジュールの列と U.2 の差し口、背面に 3.3 kW の電源 6 台と OSFP 4 個（1 個に 2 ポート）。重さは最大 142.4 kg。',
    ...LAB_POWER,
    subs: [{id: 'front', label: '前から'}, {id: 'bezel', label: 'ベゼルを外す'}, {id: 'back', label: '後ろから'}],
  },
  {
    n: 2,
    name: '2 段に分ける',
    text: '中は 2 段。HGX B200 の基板に B200 8 個と NVSwitch チップ 2 個が載る GPU トレイと、Xeon 2 個・DIMM 32 枚・ConnectX-7 8 枚・BlueField-3 2 枚が載るマザーボードトレイ。マザーボードトレイは後ろへ引き抜き、奥のミッドプレーンで GPU 側とつながる。',
    lab: [{cmd: 'nvidia-smi -q'}, {cmd: 'lscpu'}, {cmd: 'sudo dmidecode -t memory'}],
    labWhat: 'GPU 8 個、Xeon 2 個 112 コア、DIMM 32 枚',
    subs: [{id: 'open', label: '引き出して分解'}, {id: 'close', label: '戻す'}],
  },
  {
    n: 3,
    name: '8 個が 1 つになる',
    text: 'GPU 1 個の NVLink は 18 本。9 本ずつ 2 個の NVSwitch チップへ行き、GPU 側 8 × 18 = 144 本とスイッチ側 2 × 72 = 144 ポートがちょうど合う（つなぎ方は計算による解釈）。だから箱の中ならどの組もスイッチ 1 段・1.8 TB/s。8 個の合計は 14.4 TB/s。',
    lab: [{cmd: 'nvidia-smi topo -m'}, {cmd: 'nvidia-smi nvlink -s'}, {cmd: 'systemctl status nvidia-fabricmanager'}],
    labWhat: 'つながりとリンクの速さ（B200 での表示は未確認）',
    scenes: ['fan', 'hop'],
  },
  {
    n: 4,
    name: '8 で止まる',
    text: 'NVLink が届くのは箱の中の 8 個まで。9 個目の GPU へは PCIe → ConnectX-7 → 背面の OSFP → InfiniBand のリーフを通り、400 Gb/s（双方向 100 GB/s）で NVLink の 18 分の 1。72 個で学習すると、箱の中の相手は 71 個中 7 個（9.9 %）だけ。',
    lab: [{cmd: 'ibstat'}, {cmd: 'ibdev2netdev'}],
    labWhat: 'ConnectX-7 8 枚が 400 Gb/s、mlx5 と ibp の対応',
    scenes: ['wall', 'rails'],
  },
  {
    n: 5,
    name: '72 個で集計する',
    text: '1 GB の勾配を 72 個（9 台）で合計する。箱の中で分けて集め、同じ番号の GPU どうしで外のリング、箱の中で配る（2 段の方式は仮定）。GPU 1 個が送るのは中 1.75 GB・外 0.2222 GB で合計 6.389 ms。NVL72 は外へ 0 GB で 2.191 ms。帯域だけの計算。',
    lab: [{cmd: 'all_reduce_perf -b 1G -e 1G -g 8'}],
    labWhat: 'nccl-tests。1 台の中だけ → MPI で 9 台 72 プロセスの落ち方',
    scenes: ['hier', 'vs72'],
  },
  {
    n: 6,
    name: '14.3 kW を運び込む',
    text: '最大 約 14.3 kW。3.3 kW の電源 6 台のうち 5 台で 16.5 kW をまかない、6 台目は予備（5+1）。1 台あたり 2.86 kW、200 V で 14.3 A（定格 16 A）。ラックに何台置けるかは電力の上限で決まり、30 kW なら場所は 4 台ぶんあっても 2 台まで。',
    ...LAB_POWER,
    scenes: ['power', 'rack'],
  },
  {
    n: 7,
    name: '風で冷やす',
    text: '前面のファンが冷たい空気を吸い込み、GPU トレイとマザーボードトレイを抜けて背面へ出す。出典の 1,550 CFM（0.73 m³/s）で 14.3 kW を運ぶと空気は約 16 K 温まる。同じ熱を水なら温度差 10 K で 20.5 L/分。体積で約 2,140 倍の差が、NVL72 が液冷になった理由。',
    lab: [{cmd: 'sudo nvsm show fans'}, {cmd: 'nvidia-smi -q -d TEMPERATURE'}],
    labWhat: 'ファンの状態、GPU の温度',
    scenes: ['air'],
  },
];
export const chapterOf = (n) => CHAPTERS[clamp(Math.round(n) - 1, 0, CHAPTERS.length - 1)];
/** refs.md 「次の世代」の HGX B300 の 1 行だけ（Rubin NVL8 は値が揃わないので出さない） */
export const NEXT_GEN = ['HGX B300: GPU が Blackwell Ultra、メモリ 2.1 TB、ネットワーク 1.6 TB/s（GPU 1 個 800 Gb/s を双方向で数えた値）。NVLink は同じ 1.8 TB/s・8 個。'];
export const LIQUID_NOTE = '液冷の HGX B200 は他社のサーバーにある（refs.md 出典8）。DGX B200 は空冷。';
export const NOTICE = '非公式の教材。DGX B200 を模した簡略形状で、NVIDIA・DGX・HGX・NVLink・NVSwitch・Blackwell・ConnectX・BlueField は NVIDIA Corporation の商標、Intel・Xeon は Intel Corporation の商標。数値は refs.md の出典による';
