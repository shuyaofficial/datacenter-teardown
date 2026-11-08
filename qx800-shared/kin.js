// The Quantum-X800 Q3400-RA's math, no three.js. Every number lives in SPEC (sources, 仮定, 計算 and 食い違い in
// ../qx800/refs.md); the geometry, the console and the tests all read it from here. One input drives the page: time. A
// scene is a pure function of its own clock: sweepAt / lookupAt / dropAt / creditAt / pfcAt / fattreeAt / arAt / ringAt /
// sharpAt / airAt say where the moving things are and what the gauges read. The scene durations are STAGED TIME (made
// up for the eye); only the computed values (ns, ms, W) exist in real time.
//
// The two machines it is compared with are read from their own kin.js, not copied: the Catalyst 9300 (1本目) and the
// GB200 NVL72 rack (2本目, for the rack's size and its 18 trays × 4 GPUs).
//
// Coordinates of the model (millimetres, in box.js): x across the front (right = +), y up from the floor, z front (+) to
// back (-).
import {fillMs as catFillMs, queueAt as catQueueAt, serialUs as catSerialUs, SPEC as CAT, switchingGbps as catSwitchingGbps} from '../switch-shared/kin.js';
import {SPEC as NVL} from '../nvl72-shared/kin.js';

export const SPEC = {
  name: 'Q3400-RA',
  // 筐体（出典2b、2a、2c、2d、出典1）
  chassis: {h: 177.8, w: 438, d: 850, kg: 60, units: 4},
  rackW: 482.6, // 19 インチの耳
  ports: 144,
  portGbps: 800,
  cages: 72,
  portsPerCage: 2,
  cageLayout: {sections: 3, rows: 4, cols: 6}, // 仮定
  ufmPortGbps: 400, // UFM 専用の帯域内管理ポート（OSFP）
  psus: 8,
  fans: 10,
  cpu: {name: 'Intel i3-8100H', cores: 4, ghz: 3, os: 'NVOS'},
  tempC: [0, 35],
  dBA: 78.4,
  // チップと帯域（出典1、2a、出典5、出典10）
  laneGbps: 200,
  lanesPerPort: 4,
  chipName: 'Quantum-3',
  chipTbps: 28.8, // 出典5（Q3450-LD の 1 チップ）
  mtu: 4096, // 出典16
  // 消費電力（出典2b）
  power: {typW: 2900, maxW: 7000, psuV: '200–240', psuA: 10},
  // SM と経路（出典13、14）
  sm: {sweepS: 10, lmc: 0, priorities: [0, 15], routing: 'ar_updn'},
  // クレジット（出典11。2014 年の値）
  credit: {blockB: 64, maxCredits: 2048},
  // 線の上の量（仮定: 光が 1 m を 5 ns で進む）
  wire: {nsPerM: 5, copperM: 2, opticM: 100},
  // SHARP（出典1、3）
  sharp: {gen: 4, tflops: 14.4, vsPrev: 9},
  // 網の組み方（出典6 表3、出典1）
  su: {racks: 8, gpus: 576, rails: 4, leavesPerRail: 2, twoTierSU: 16, nicMax: 10368},
  table3: [
    {su: 2, leaves: 16, spines: 8},
    {su: 4, leaves: 32, spines: 18},
    {su: 8, leaves: 64, spines: 36},
    {su: 16, leaves: 128, spines: 72},
  ],
  // all-reduce（帯域だけの単純計算。遅延と NVLink は入れない＝仮定）
  allreduce: {gradGB: 1, gpus: 576, oneWayGBs: 100},
  // 比べる相手の Catalyst 9300（switch-shared/kin.js から読む。写さない）
  cat: {
    h: CAT.chassis.h,
    w: CAT.chassis.w,
    d: CAT.chassis.d,
    kg: CAT.chassis.kg,
    units: 1,
    psuW: CAT.psuW,
    macTable: CAT.asic.macTable,
    switchingGbps: catSwitchingGbps(),
    fillMs: catFillMs(),
    frameB: CAT.frame.max,
    rateGbps: CAT.queue.outGbps,
    congestMsPerSec: CAT.timeMap.congestMsPerSec,
  },
  // NVL72 のラック（nvl72-shared/kin.js から読む）
  nvl: {rack: NVL.rack, trays: NVL.computeTrays, gpusPerTray: NVL.tray.gpus},
  // 次の世代（脚注）
  next: {name: 'Q3450-LD', maxKW: 4.3},
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const easeInOut = (x) => {
  const u = clamp(x, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
/** u remapped from [a, b] to 0..1, clamped */
export const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

// ------------------------------------------------------------ checks that refs.md 「検算」 spells out
/** 交換容量 Tb/s（片方向の合計）と両方向 */
export const switchingTbps = (s = SPEC) => (s.ports * s.portGbps) / 1000;
export const bothWaysTbps = (s = SPEC) => switchingTbps(s) * 2;
/** レーン: 72 ケージ × 8 = 576、× 200 G */
export const lanesPerCage = (s = SPEC) => s.portsPerCage * s.lanesPerPort;
export const laneCount = (s = SPEC) => s.cages * lanesPerCage(s);
export const laneTbps = (s = SPEC) => (laneCount(s) * s.laneGbps) / 1000;
export const cageTbps = (s = SPEC) => (lanesPerCage(s) * s.laneGbps) / 1000;
/** チップの数（計算）と 1 個のレーン */
export const chipCount = (s = SPEC) => Math.round(switchingTbps(s) / s.chipTbps);
export const lanesPerChip = (s = SPEC) => laneCount(s) / chipCount(s);
/** Catalyst 9300 と同じ数え方（両方向）で何倍か */
export const vsCatalyst = (s = SPEC) => (bothWaysTbps(s) * 1000) / s.cat.switchingGbps;
/** リーフ 1 台: 下り 72・上り 72 */
export const leafDown = (s = SPEC) => s.ports / 2;
export const leafUp = (s = SPEC) => s.ports - leafDown(s);
export const upDownRatio = (s = SPEC) => leafUp(s) / leafDown(s);
/** 1 SU のリーフ: 576 ÷ 72 */
export const suLeaves = (s = SPEC) => s.su.gpus / leafDown(s);
export const railGpus = (s = SPEC) => s.su.racks * s.nvl.trays;
/** スパイン 1 台に何本（表3 の各行）と、リーフ 1 台とスパイン 1 台のあいだの本数 */
export const perSpine = (row, s = SPEC) => (row.leaves * leafUp(s)) / row.spines;
export const perPair = (row, s = SPEC) => leafUp(s) / row.spines;
/** 1 SU だけのときのスパイン（計算）: 8 × 72 ÷ 144 */
export const suSpines = (s = SPEC) => (suLeaves(s) * leafUp(s)) / s.ports;
/** 2 層の上限: スパイン 1 台で結べるリーフ 144 台 × 72 */
export const twoTierMax = (s = SPEC) => s.ports * leafDown(s);
export const twoTierSU = (s = SPEC) => twoTierMax(s) / s.su.gpus;
/** 線に乗る時間 ns（見出しなどの上乗せは入れない）と、Catalyst の 1,518 B を 1 Gbps で */
export const serialNs = (bytes = SPEC.mtu, gbps = SPEC.portGbps) => (bytes * 8) / gbps;
export const catSerialNs = (s = SPEC) => catSerialUs(s.cat.frameB, s.cat.rateGbps) * 1000;
export const serialRatio = (s = SPEC) => catSerialNs(s) / serialNs(s.mtu, s.portGbps);
/** クレジット: 4,096 B = 64、上限 2,048 クレジット = 131,072 B */
export const creditsOf = (bytes, s = SPEC) => Math.ceil(bytes / s.credit.blockB);
export const creditMaxB = (s = SPEC) => s.credit.maxCredits * s.credit.blockB;
/** 往復のあいだに線の上にいる量 B: 800 Gb/s × 往復 */
export const rttNs = (m, s = SPEC) => 2 * m * s.wire.nsPerM;
export const inFlightB = (m, s = SPEC) => (s.portGbps * rttNs(m, s)) / 8;
/** ポートあたりの電力と、典型と最大の差をケージで割った値（光モジュールの分と読む＝推測） */
export const wattsPerPort = (w, s = SPEC) => w / s.ports;
export const diffPerCage = (s = SPEC) => (s.power.maxW - s.power.typW) / s.cages;
export const powerVsCat = (s = SPEC) => s.power.maxW / s.cat.psuW;
/** all-reduce: リングで GPU 1 個が送る量 GB = 2 (N−1) / N × G、時間 ms */
export const ringSentGB = (s = SPEC) => ((2 * (s.allreduce.gpus - 1)) / s.allreduce.gpus) * s.allreduce.gradGB;
export const ringMs = (s = SPEC) => (ringSentGB(s) / s.allreduce.oneWayGBs) * 1000;
export const sharpSentGB = (s = SPEC) => s.allreduce.gradGB;
export const sharpMs = (s = SPEC) => (sharpSentGB(s) / s.allreduce.oneWayGBs) * 1000;
/** GPU 1 個の口: 800 Gb/s を片方向 GB/s に */
export const nicOneWayGBs = (s = SPEC) => s.portGbps / 8;

// ------------------------------------------------------------ the 1 SU fabric (計算と仮定)
// Leaves 0..7: rail r (0..3) and half h (0: racks 1-4 = A, 1: racks 5-8 = B) → leaf h * 4 + r. Spines 0..3. The SM sits
// in a UFM box on leaf 0's UFM port (仮定).
export const SWITCHES = (() => {
  const out = [];
  for (let l = 0; l < 8; l++) out.push({id: `L${l}`, kind: 'leaf', i: l, rail: (l % 4) + 1, half: l < 4 ? 'A' : 'B'});
  for (let k = 0; k < 4; k++) out.push({id: `S${k}`, kind: 'spine', i: k});
  return out;
})();
/** the leaf a GPU's port goes to: rack 0..7, the GPU's number in its tray 1..4 */
export const leafOf = (rack, gpuInTray) => (rack < 4 ? 0 : 4) + (gpuInTray - 1);
/** the order the SM visits the switches: the leaf with the UFM, the spines, the other leaves (breadth first) */
export const SWEEP_ORDER = ['L0', 'S0', 'S1', 'S2', 'S3', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
/** LIDs: the SM numbers the switches in the order it finds them, then the GPUs' ports (rack, tray, GPU) */
export const switchLid = (id) => SWEEP_ORDER.indexOf(id) + 1;
export const gpuLid = (rack, tray, gpu, s = SPEC) => SWEEP_ORDER.length + 1 + rack * s.nvl.trays * s.nvl.gpusPerTray + (tray - 1) * s.nvl.gpusPerTray + (gpu - 1);
/** leaf l's LFT for a GPU LID: its own down port (1..72) or an up port (73..144) toward spine k; minhop picks the spine
 * with the fewest routes, which spreads destinations round robin over the 4 spines */
export function lftPort(leaf, rack, tray, gpu, s = SPEC) {
  const l = leafOf(rack, gpu);
  if (l === leaf) return {port: (rack % 4) * s.nvl.trays + tray, up: false, spine: -1};
  const spine = (rack * s.nvl.trays + tray) % 4;
  return {port: leafDown(s) + spine * (leafUp(s) / 4) + 1 + ((rack * s.nvl.trays + tray) % (leafUp(s) / 4)), up: true, spine};
}
/** a route through the fabric between two GPU ports: the switches passed */
export function fabricRoute(a, b, s = SPEC) {
  const la = leafOf(a.rack, a.gpu);
  const lb = leafOf(b.rack, b.gpu);
  if (la === lb) return {switches: [`L${la}`], hops: 1};
  const {spine} = lftPort(la, b.rack, b.tray, b.gpu, s);
  // a different rail needs the GPU's own NVLink first (not drawn); here both ends are on the same rail
  return {switches: [`L${la}`, `S${spine}`, `L${lb}`], hops: 3};
}

// ------------------------------------------------------------ scenes (staged time)
export const SCENES = {
  sweep: {id: 'sweep', name: 'SM の見回り', sub: 'UFM の SM が 1 台ずつ訪ねて LID と表を配る', dur: 7.2},
  lookup: {id: 'lookup', name: '表を引く', sub: '宛先 LID → LFT の 1 行 → その出口へ', dur: 6.0},
  drop: {id: 'drop', name: 'Catalyst は捨てる', sub: '2 本 → 1 本・列が満杯になると末尾で捨てる', dur: 8},
  credit: {id: 'credit', name: 'IB は待つ', sub: '受け口の空き（クレジット）の分だけ送る', dur: 9},
  pfc: {id: 'pfc', name: 'Ethernet の PFC', sub: '溢れそうになってから「止まれ」', dur: 9},
  fattree: {id: 'fattree', name: '1 SU のファットツリー', sub: 'リーフ 1 台: 下り 72・上り 72', dur: 6},
  ar: {id: 'ar', name: '適応ルーティング', sub: '混んだ出口を避けて空いた出口へ', dur: 7},
  ring: {id: 'ring', name: 'リングで集計', sub: '576 個が輪になって順に渡す', dur: 5},
  sharp: {id: 'sharp', name: 'スイッチで集計', sub: 'リーフとスパインの中で足して 1 回で返す', dur: 6},
  air: {id: 'air', name: '電力と風', sub: '前から吸って後ろへ・ファン 10・電源 8', dur: 8},
};
export const SCENE_IDS = Object.keys(SCENES);
export const sceneDuration = (scene) => SCENES[scene].dur;

// sweep: each switch takes a trip (the SM's packet runs to it) then a write (its LFT fills row by row)
export const SWEEP = {start: 0.3, trip: 0.25, write: 0.3, rows: 6};
const SWEEP_STEP = SWEEP.trip + SWEEP.write;
export function sweepAt(t) {
  const tt = Math.max(0, t - SWEEP.start);
  const n = SWEEP_ORDER.length;
  const k = Math.min(n - 1, Math.floor(tt / SWEEP_STEP));
  const u = tt - k * SWEEP_STEP;
  const trip = clamp(u / SWEEP.trip, 0, 1);
  const write = clamp((u - SWEEP.trip) / SWEEP.write, 0, 1);
  // per switch: lid given (visited), rows written 0..rows
  const per = SWEEP_ORDER.map((id, i) => {
    if (t < SWEEP.start || i > k) return {id, lid: 0, rows: 0};
    if (i < k) return {id, lid: switchLid(id), rows: SWEEP.rows};
    return {id, lid: trip >= 1 ? switchLid(id) : 0, rows: Math.floor(write * SWEEP.rows + 1e-9)};
  });
  const swept = per.filter((p) => p.rows >= SWEEP.rows).length;
  return {at: t < SWEEP.start ? -1 : k, id: SWEEP_ORDER[k], trip, write, per, swept, done: swept === n};
}
export const sweepEnd = () => SWEEP.start + SWEEP_ORDER.length * SWEEP_STEP;

// lookup: GPU (rack 2, tray 5, GPU 1) → GPU (rack 7, tray 9, GPU 1), both on rail 1: leaf A → spine → leaf B
export const LOOKUP = {from: {rack: 1, tray: 5, gpu: 1}, to: {rack: 6, tray: 9, gpu: 1}, legs: [0.7, 0.55, 0.8, 0.55, 0.8, 0.55, 0.7], start: 0.2};
export function lookupAt(t, s = SPEC) {
  const r = fabricRoute(LOOKUP.from, LOOKUP.to, s);
  const tt = Math.max(0, t - LOOKUP.start);
  let acc = 0;
  let i = 0;
  for (; i < LOOKUP.legs.length - 1 && tt >= acc + LOOKUP.legs[i]; i++) acc += LOOKUP.legs[i];
  const u = clamp((tt - acc) / LOOKUP.legs[i], 0, 1);
  // legs: up to leaf, at leaf, to spine, at spine, to leaf, at leaf, down to the GPU; odd legs are the table look-ups
  const at = i % 2 === 1 ? r.switches[(i - 1) / 2] : null;
  const passed = Math.min(r.switches.length, Math.floor((i + (u >= 1 ? 1 : 0)) / 2));
  const dst = gpuLid(LOOKUP.to.rack, LOOKUP.to.tray, LOOKUP.to.gpu, s);
  const rows = r.switches.map((id) => (id.startsWith('L') ? lftPort(Number(id.slice(1)), LOOKUP.to.rack, LOOKUP.to.tray, LOOKUP.to.gpu, s) : {port: leafOf(LOOKUP.to.rack, LOOKUP.to.gpu) * (leafUp(s) / 4) + 1, up: false, spine: -1}));
  return {leg: i, u, at, passed, dst, route: r, rows, done: tt >= LOOKUP.legs.reduce((a, b) => a + b, 0)};
}
/** the Catalyst beside it (grey): a frame to an unknown MAC is flooded to every port, the reply teaches the table */
export const CATFLOOD = {in: [0.2, 1.0], flood: [1.0, 2.0], reply: [2.4, 3.4], learn: 3.4};
export function catFloodAt(t) {
  return {
    in: seg(t, ...CATFLOOD.in),
    flood: seg(t, ...CATFLOOD.flood),
    reply: seg(t, ...CATFLOOD.reply),
    learned: t >= CATFLOOD.learn,
    phase: t < CATFLOOD.flood[0] ? 'in' : t < CATFLOOD.reply[0] ? 'flood' : t < CATFLOOD.learn ? 'reply' : 'learned',
  };
}

// drop: the Catalyst's Q1 (switch-shared queueAt, the same 2 ms per staged second as its scene congest)
export function dropAt(t, s = SPEC) {
  const ms = Math.max(0, t) * s.cat.congestMsPerSec;
  const q = catQueueAt(ms);
  return {ms, pct: q.pct, bytes: q.bytes, limit: q.limit, full: q.full, drops: q.droppedFrames, tFullMs: q.tFullMs};
}

// credit: one input link of the switch (the other is the same). The sender may start a packet only with 64 credits in
// hand; the receiver's input buffer (4 packets, 仮定・説明用) drains at half the line rate (2 inputs share 1 output);
// every packet that leaves the buffer sends its 64 credits back. At link-up the receiver first tells the sender its free
// space (the first credits arrive one wire time after the start).
export const CREDIT = {bufPk: 4, sendDur: 0.4, wire: 0.7, drain: 0.8};
export const pktCredits = (s = SPEC) => creditsOf(s.mtu, s);
/** the event list of the credit link up to staged t: packets [{s (send), a (arrive), f (leave)}], credit returns */
function creditEvents(t, s = SPEC) {
  const C = pktCredits(s);
  const pk = [];
  const returns = [{at: CREDIT.wire, n: CREDIT.bufPk * C, from: 0, init: true}];
  let free = CREDIT.wire; // the sender has data from link-up on
  let lastF = -1e9;
  for (let k = 0; k < 400; k++) {
    // credits in hand at time x: returns arrived by x minus packets started before x
    const have = (x) => returns.filter((r) => r.at <= x + 1e-9).reduce((a, r) => a + r.n, 0) - pk.length * C;
    let st = free;
    if (have(st) < C) {
      const next = returns.filter((r) => r.at > st + 1e-9).sort((a, b) => a.at - b.at);
      let found = null;
      for (const r of next) if (have(r.at) >= C) {
        found = r.at;
        break;
      }
      if (found === null) break;
      st = found;
    }
    if (st > t + 1) break;
    const a = st + CREDIT.wire;
    const f = Math.max(a, lastF) + CREDIT.drain;
    lastF = f;
    pk.push({s: st, a, f, wait: st - free});
    returns.push({at: f + CREDIT.wire, n: C, from: f});
    free = st + CREDIT.sendDur;
  }
  return {pk, returns};
}
export function creditAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const C = pktCredits(s);
  const {pk, returns} = creditEvents(tt, s);
  const got = returns.filter((r) => r.at <= tt).reduce((a, r) => a + r.n, 0);
  const sent = pk.filter((p) => p.s <= tt);
  const credits = got - sent.length * C;
  const inBuf = pk.filter((p) => p.a <= tt && p.f > tt).length;
  const onWire = pk.filter((p) => p.s <= tt && p.a > tt).map((p) => ({u: (tt - p.s) / CREDIT.wire}));
  const tokens = returns.filter((r) => !r.init && r.from <= tt && r.at > tt).map((r) => ({u: (tt - r.from) / CREDIT.wire}));
  const initTok = tt < CREDIT.wire ? [{u: tt / CREDIT.wire, init: true}] : [];
  // the sender waits while it has data and fewer than 64 credits: the staged wait, in real time (1 packet time = 40.96 ns)
  const waitS = sent.reduce((a, p) => a + Math.max(0, Math.min(p.s, tt) - (p.s - p.wait)), 0) + (() => {
    const next = pk.find((p) => p.s > tt);
    if (!next) return 0;
    return Math.max(0, tt - (next.s - next.wait));
  })();
  const waitNs = (waitS / CREDIT.sendDur) * serialNs(s.mtu, s.portGbps);
  return {credits, inBuf, bufPk: CREDIT.bufPk, sent: sent.length, onWire, tokens: [...initTok, ...tokens], waiting: credits < C && tt > CREDIT.wire, waitNs, drops: 0, out: pk.filter((p) => p.f <= tt).length};
}

// pfc: the same link with Ethernet's PAUSE. The sender sends whenever it is not paused; when the buffer reaches XOFF the
// receiver sends 「止まれ」, which takes a wire time to arrive; what was on the wire and the packet being sent land in the
// headroom. Below XON it sends 「再開」. Headroom = what can be on the wire in a round trip (計算).
export const PFC = {xoff: 3, xon: 1, sendDur: CREDIT.sendDur, wire: CREDIT.wire, drain: 1.2};
export const pfcHeadroomPk = () => Math.ceil((2 * PFC.wire) / PFC.sendDur) + 1;
function pfcEvents(t) {
  const pk = [];
  const pauses = []; // {sent, at, on: true (pause) | false (resume)}
  let free = 0;
  let lastF = -1e9;
  let paused = false;
  let pauseSentAt = null;
  for (let k = 0; k < 400; k++) {
    let st = free;
    // a pause that has arrived stops the sender until the resume arrives
    const active = (x) => {
      let on = false;
      for (const p of pauses) if (p.at <= x + 1e-9) on = p.on;
      return on;
    };
    if (active(st)) {
      const res = pauses.find((p) => !p.on && p.at > st);
      if (!res) {
        // the resume comes when the buffer falls to XON: computed below once packets drain
        const occAt = (x) => pk.filter((p) => p.a <= x + 1e-9 && p.f > x + 1e-9).length;
        const leaves = pk.map((p) => p.f).filter((f) => f > st).sort((a, b) => a - b);
        let resAt = null;
        for (const f of leaves) if (occAt(f) <= PFC.xon) {
          resAt = f;
          break;
        }
        if (resAt === null) break;
        pauses.push({sent: resAt, at: resAt + PFC.wire, on: false});
        paused = false;
        st = resAt + PFC.wire;
      } else st = res.at;
    }
    if (st > t + 1) break;
    const a = st + PFC.wire;
    const f = Math.max(a, lastF) + PFC.drain;
    lastF = f;
    pk.push({s: st, a, f});
    free = st + PFC.sendDur;
    // the receiver checks its level when this packet arrives
    const occ = pk.filter((p) => p.a <= a + 1e-9 && p.f > a + 1e-9).length;
    const lastPause = pauses[pauses.length - 1];
    if (occ >= PFC.xoff && (!lastPause || !lastPause.on)) {
      pauses.push({sent: a, at: a + PFC.wire, on: true});
      pauseSentAt = a;
    }
  }
  void paused;
  void pauseSentAt;
  return {pk, pauses};
}
export function pfcAt(t) {
  const tt = Math.max(0, t);
  const {pk, pauses} = pfcEvents(tt);
  const inBuf = pk.filter((p) => p.a <= tt && p.f > tt).length;
  const peak = pk.filter((p) => p.a <= tt).reduce((m, p) => Math.max(m, pk.filter((q) => q.a <= p.a + 1e-9 && q.f > p.a + 1e-9).length), 0);
  const onWire = pk.filter((p) => p.s <= tt && p.a > tt).map((p) => ({u: (tt - p.s) / PFC.wire}));
  const msgs = pauses.filter((p) => p.sent <= tt && p.at > tt).map((p) => ({u: (tt - p.sent) / PFC.wire, on: p.on}));
  let paused = false;
  for (const p of pauses) if (p.at <= tt) paused = p.on;
  const headroom = pfcHeadroomPk();
  const over = Math.max(0, inBuf - PFC.xoff);
  return {inBuf, peak, onWire, msgs, paused, headroom, over, bufPk: PFC.xoff + headroom, drops: Math.max(0, peak - (PFC.xoff + headroom)), sent: pk.filter((p) => p.s <= tt).length};
}

// fattree: the leaf is picked at 1.0 s; its 72 down and 72 up light at the same width
export const FATTREE = {pick: 1.0, leaf: 0};
export function fattreeAt(t, s = SPEC) {
  const k = seg(t, FATTREE.pick, FATTREE.pick + 0.8);
  return {k, leaf: FATTREE.leaf, down: leafDown(s), up: leafUp(s), upRatio: k > 0 ? upDownRatio(s) : 0};
}
// ar: leaf 0's four exits up; exit 1 is busy (仮定の例), the beads split over the other three
export const AR = {leaf: 0, busy: 1, perSec: 3.2, travel: 1.1, pick: 0.8};
export function arAt(t) {
  const tt = Math.max(0, t);
  const per = 1 / AR.perSec;
  const beads = [];
  for (let k = Math.max(0, Math.floor((tt - AR.travel) / per)); k <= Math.floor(tt / per); k++) {
    const st = k * per;
    const u = (tt - st) / AR.travel;
    if (u < 0 || u > 1) continue;
    // before the switch has seen the busy exit it uses all four in turn; afterwards only the free three
    const free = [0, 1, 2, 3].filter((e) => e !== AR.busy);
    const exit = st < AR.pick ? k % 4 : free[k % 3];
    beads.push({k, u, exit});
  }
  const used = [0, 0, 0, 0];
  for (let k = 0; k <= Math.floor(tt / per); k++) {
    const st = k * per;
    used[st < AR.pick ? k % 4 : [0, 2, 3][k % 3]]++;
  }
  return {beads, busy: AR.busy, used, picked: tt >= AR.pick};
}

/** ring all-reduce: u 0..1 through the 2 (N−1) steps; sent GB and the ms it takes (bandwidth only) */
export const ringSteps = (s = SPEC) => 2 * (s.allreduce.gpus - 1);
export function ringAt(t, s = SPEC) {
  const u = clamp(t / SCENES.ring.dur, 0, 1);
  const steps = ringSteps(s);
  const step = Math.min(steps, Math.floor(u * steps + 1e-9));
  return {u, step, steps, phase: step < steps / 2 ? 'reduce' : 'gather', sentGB: ringSentGB(s) * u, ms: ringMs(s) * u, done: u >= 1};
}
/** SHARP: up to the leaves, sum, up to the spines, sum, down once */
export const SHARP_PH = {up: [0, 1.4], leaf: [1.4, 2.0], spine: [2.0, 2.9], down: [2.9, 4.6]};
export function sharpAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const ph = tt < SHARP_PH.up[1] ? 'up' : tt < SHARP_PH.leaf[1] ? 'leaf' : tt < SHARP_PH.spine[1] ? 'spine' : tt < SHARP_PH.down[1] ? 'down' : 'done';
  const all = seg(tt, SHARP_PH.up[0], SHARP_PH.down[1]);
  return {phase: ph, up: seg(tt, ...SHARP_PH.up), leaf: seg(tt, ...SHARP_PH.leaf), spine: seg(tt, ...SHARP_PH.spine), down: seg(tt, ...SHARP_PH.down), sentGB: sharpSentGB(s) * seg(tt, ...SHARP_PH.up), ms: sharpMs(s) * all, done: ph === 'done'};
}

// air: copper (typical) first, then the optics come in (maximum)
export const AIR = {copper: [0, 3.2], ramp: [3.2, 4.6]};
export function airAt(t, s = SPEC) {
  const k = easeInOut(seg(t, ...AIR.ramp));
  const watts = s.power.typW + (s.power.maxW - s.power.typW) * k;
  return {k, watts, perPort: wattsPerPort(watts, s), optics: k > 0.5, speed: watts / s.power.typW};
}

/** t snapped for reduced motion: the sweep from switch to switch, the beads from step to step */
export function snapT(scene, t) {
  const tt = Math.max(0, t);
  if (scene === 'sweep') return tt < SWEEP.start ? 0 : SWEEP.start + Math.floor((tt - SWEEP.start) / SWEEP_STEP) * SWEEP_STEP + SWEEP_STEP - 1e-6;
  if (scene === 'lookup') {
    let acc = LOOKUP.start;
    for (const d of LOOKUP.legs) {
      if (tt < acc + d) return acc + d * 0.5;
      acc += d;
    }
    return acc;
  }
  if (scene === 'ring') return Math.floor((tt / SCENES.ring.dur) * 8 + 1e-9) * (SCENES.ring.dur / 8);
  if (scene === 'sharp') {
    for (const [, b] of [SHARP_PH.down, SHARP_PH.spine, SHARP_PH.leaf, SHARP_PH.up].map((x) => x)) if (tt >= b) return b;
    return 0;
  }
  if (scene === 'credit' || scene === 'pfc' || scene === 'drop') return Math.floor(tt / 0.4) * 0.4;
  return tt;
}

/** every gauge value of a scene at staged t (the console, LIVE.s and the tests read this) */
export function gaugesAt(scene, t, s = SPEC) {
  const out = {scene, swept: 0, credits: 0, drops: 0, catDrops: 0, waitNs: 0, upRatio: 0, sentGB: 0, ms: 0, watts: 0};
  // chapter 4: the Catalyst lane runs under every scene of the chapter (behind a veil when it is not the focus)
  if (scene === 'drop' || scene === 'credit' || scene === 'pfc') out.catDrops = dropAt(t, s).drops;
  if (scene === 'sweep') out.swept = sweepAt(t).swept;
  if (scene === 'lookup') out.swept = SWEEP_ORDER.length;
  if (scene === 'drop') {
    out.drops = dropAt(t, s).drops;
    // the IB lane under it carries the same load and keeps its credits
    out.credits = creditAt(t, s).credits;
  }
  if (scene === 'credit') {
    const c = creditAt(t, s);
    Object.assign(out, {credits: c.credits, drops: c.drops, waitNs: c.waitNs});
  }
  if (scene === 'pfc') {
    out.drops = pfcAt(t).drops;
    out.credits = creditAt(t, s).credits;
  }
  if (scene === 'fattree') out.upRatio = fattreeAt(t, s).upRatio;
  if (scene === 'ar') out.upRatio = upDownRatio(s);
  if (scene === 'ring') Object.assign(out, (({sentGB, ms}) => ({sentGB, ms}))(ringAt(t, s)));
  if (scene === 'sharp') Object.assign(out, (({sentGB, ms}) => ({sentGB, ms}))(sharpAt(t, s)));
  if (scene === 'air') out.watts = airAt(t, s).watts;
  return out;
}

// ------------------------------------------------------------ the layered lift of the lid (chapter 2)
// Layers from the top: 天板, ヒートシンク, 管理用 CPU の基板, 電源とファン. Opening goes top first with a stagger; closing
// goes bottom first, faster (as the switch's).
export const LAYERS = ['lid', 'heat', 'cpu', 'rear'];
export const EXPLODE = {open: {stagger: 0.17, dur: 0.9}, close: {stagger: 0.06, dur: 0.5}};
/** one layer's lift (0..1) at time t from presses [{t, to: [4 targets]}]; init = the values before the first press */
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
    const opening = to > v;
    const P = opening ? EXPLODE.open : EXPLODE.close;
    const rank = opening ? k : LAYERS.length - 1 - k;
    sg = {t0: e.t, v0: v, to, delay: instant || Math.abs(to - v) < 1e-6 ? 0 : rank * P.stagger, dur: instant ? 1e-6 : P.dur};
  }
  return clamp(at(t), 0, 1);
}
export function liftsAt(events, t, init = [0, 0, 0, 0], instant = false) {
  const lifts = LAYERS.map((_, k) => layerAt(events, k, t, init[k] ?? 0, instant));
  return {lifts, lift: lifts[0]};
}

// ------------------------------------------------------------ chapters (the console reads these)
// lab: refs.md 「実機で見るには」. Every command there is for the real machine only.
export const CHAPTERS = [
  {
    n: 1,
    name: '外観',
    text: '4U・438 × 177.8 × 850 mm・60 kg。前面に OSFP ケージ 72（1 ケージに 800G が 2 ポート、計 144）と、少し離して UFM 専用のポート。背面に電源 8・ファン 10。左の灰色の線は Catalyst 9300（1U）の外形。',
    lab: [{cmd: 'nv show platform'}, {cmd: 'nv show platform environment fan'}, {cmd: 'nv show platform environment psu'}],
    labWhat: '型番、ファン 10 台の回転、電源 8 台の電力',
    subs: [{id: 'front', label: '前から'}, {id: 'back', label: '後ろから'}],
  },
  {
    n: 2,
    name: '天板を開ける',
    text: '天板、ヒートシンク、管理用 CPU の基板、電源とファンの順に上の層から浮く。中には Quantum-3 のチップが 4 個（115.2 ÷ 28.8 の計算。並びは仮定）。チップからケージへの配線は束で描き、レーンの割り当てとチップどうしのつなぎ方は非公表。',
    lab: [{cmd: 'nv show platform'}],
    labWhat: 'スイッチのチップと CPU の情報（中身の細部は版で違う）',
    subs: [{id: 'open', label: '層を外す'}, {id: 'close', label: '閉じる'}],
  },
  {
    n: 3,
    name: '経路は配られる',
    text: 'Catalyst は届いたフレームの送信元 MAC を覚え、知らない宛先は全ポートに流す。IB のスイッチは自分では覚えない。網に 1 つの SM（UFM）が見回って LID を配り、全スイッチの LFT（宛先 LID → 出口ポート）を書き込む。スイッチは表を引くだけ。',
    lab: [{cmd: 'sminfo'}, {cmd: 'ibswitches'}, {cmd: 'ibnetdiscover'}, {cmd: 'ibroute <スイッチの LID>'}],
    labWhat: '主の SM、スイッチの一覧、網の地図、SM が書いた LFT',
    scenes: ['sweep', 'lookup'],
  },
  {
    n: 4,
    name: '捨てずに待つ',
    text: 'Catalyst は列が満杯になると末尾で捨てる。IB は受け手が「あと何ブロック（64 B）受け取れるか」を先に知らせ、送り手はその範囲でしか送らないので、混んでも捨てずに待つ。Ethernet の PFC は溢れそうになってから「止まれ」と言うので、線の上にいる分を受ける余裕が要る。',
    lab: [{cmd: 'perfquery -x <LID> <ポート>'}, {cmd: 'ibqueryerrors'}],
    labWhat: 'PortXmitWait（待った時間の数）とエラーの数。捨てた数ではなく待った数が増える',
    scenes: ['drop', 'credit', 'pfc'],
  },
  {
    n: 5,
    name: '半分を上へ',
    text: '144 ポートのうち 72 を GPU へ、72 をスパインへ（1:1）。GPU 576 個（NVL72 8 本＝1 SU）はリーフ 8 台（4 レール × 2）。スパイン 4 台は表に無い計算値。同じリーフの中なら 1 段、それ以外はスパインを通って 3 段。',
    lab: [{cmd: 'ibnetdiscover'}, {cmd: 'ibdiagnet'}],
    labWhat: 'リーフとスパインのつながり、経路の点検',
    scenes: ['fattree', 'ar'],
  },
  {
    n: 6,
    name: 'スイッチで集計',
    text: '1 GB の勾配を 576 個で合計する。リングは隣へ順に渡すので GPU 1 個が 1.9965 GB 送って 19.97 ms。SHARP はリーフとスパインの中で足すので 1 GB を送るだけで 10 ms。帯域だけの単純計算で、遅延と NVLink は入れていない。',
    lab: [{cmd: 'all_reduce_perf -b 1G -e 1G'}],
    labWhat: 'nccl-tests。SHARP の有無を切り替えて busbw を比べる',
    scenes: ['ring', 'sharp'],
  },
  {
    n: 7,
    name: '電力と風',
    text: '前（ポートの側）から吸って後ろ（電源の側）へ出す。ファン 10 台・電源 8 台。受動の銅ケーブルなら典型 2,900 W、光モジュールを挿すと最大 7,000 W。差の 4,100 W の大半は光モジュールの分と読める（推測）。',
    lab: [{cmd: 'nv show platform environment temperature'}, {cmd: 'nv show platform environment psu'}],
    labWhat: '温度と電力',
    scenes: ['air'],
  },
];
export const chapterOf = (n) => CHAPTERS[clamp(Math.round(n) - 1, 0, CHAPTERS.length - 1)];
/** refs.md 「次の世代」（第 7 章の脚注） */
export const NEXT_GEN = 'Q3450-LD: 同じ 144 × 800G を、光をチップの横に載せた CPO と液冷で。差し込み式の光モジュールが無くなる。最大 4.3 kW。';
export const NOTICE = '非公式の教材。Quantum-X800 Q3400-RA を模した簡略形状で、NVIDIA・Quantum・ConnectX・SHARP・UFM は NVIDIA Corporation の商標。Catalyst は Cisco Systems の商標。数値は refs.md の出典による';
