// The GB200 NVL72 rack's math, no three.js. Every number lives in SPEC (sources, 仮定 and 計算 in ../nvl72/refs.md); the
// geometry, the console and the tests all read it from here. One input drives the page: time. A scene is a pure
// function of its own clock: hopAt / fanAt / ringAt / sharpAt / outAt / powerAt / coolAt say where the moving things are
// and what the gauges read. The scene durations are STAGED TIME (made up for the eye); only the computed values (ms,
// A, L/分) exist in real time.
//
// Coordinates of the model (millimetres, in rack.js): x across the front (right = +), y up from the floor, z front (+)
// to back (-).

export const SPEC = {
  // ラック（出典1、6、7）
  rack: {h: 2236, w: 600, d: 1068}, // 出典7
  computeTrays: 18,
  switchTrays: 9,
  tor: 2,
  powerShelves: 8,
  // 上から: 電源棚 4 → 計算トレイ 10 → スイッチトレイ 9 → 計算トレイ 8 → 電源棚 4（電源棚の位置は仮定）。TOR は最上段
  order: [
    ['power', 4],
    ['compute', 10],
    ['switch', 9],
    ['compute', 8],
    ['power', 4],
  ],
  cartridges: 4, // 背面のケーブルカートリッジ（縦に 4 本）
  copperWires: 5000, // 「5,000 本超」
  // 計算トレイ（出典1 1.2、出典4、出典5）
  tray: {superchips: 2, grace: 2, gpus: 4, cx7: 4, bf3: 2, e1s: 4},
  grace: {cores: 72, lpddrGB: 480, core: 'Arm Neoverse V2'},
  gpu: {name: 'B200', hbmGB: 186, hbmTBs: 8}, // 計算: スーパーチップ 372 GB・16 TB/s ÷ 2
  c2cGBs: 900, // NVLink-C2C（双方向）
  cx7Gbps: 400, // ConnectX-7 1 ポート 400G OSFP
  bf3: {ports: 2, gbps: 400},
  e1sTB: 3.84,
  m2TB: 1.92,
  // NVLink スイッチトレイと NVLink（出典1 1.3、出典5）
  nvlink: {gen: 5, linksPerGpu: 18, gpuTBs: 1.8, chipsPerTray: 2, portsPerChip: 72, rackTBs: 130},
  // 性能と記憶容量（出典4）
  perf: {fp4Sparse: 1440, fp4Dense: 720, fp8Sparse: 720, hbmTB: 13.4, hbmTBs: 576, lpddrTB: 17, cores: 2592},
  // all-reduce（帯域だけの単純計算。遅延は入れない）
  allreduce: {gradGB: 1, gpus: 72, oneWayGBs: 900},
  // 電源（出典1 1.4）
  power: {rackKW: 120, shelves: 8, psuPerShelf: 6, psuKW: 5.5, shelfInKW: 33, busV: 50, busVmax: 51, redundancy: 'N+N'},
  // 液冷の計算例（仮定: 全部の熱が液に行く、水の比熱 4.18 kJ/kg·K、1 L = 1 kg）
  cool: {cpKJ: 4.18, dTDefault: 10, dTMin: 5, dTMax: 20, kgPerL: 1},
  // 場面の例（brief の指定）
  demo: {hopFrom: {tray: 3, gpu: 1}, hopTo: {tray: 15, gpu: 3}, pullTray: 3},
};
export const U_MM = 44.45; // 1U

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
export const gpuCount = (s = SPEC) => s.computeTrays * s.tray.gpus;
export const graceCount = (s = SPEC) => s.computeTrays * s.tray.grace;
export const switchChips = (s = SPEC) => s.switchTrays * s.nvlink.chipsPerTray;
/** GPU 側のリンク数: 72 × 18 */
export const gpuSidePorts = (s = SPEC) => gpuCount(s) * s.nvlink.linksPerGpu;
/** スイッチ側のポート数: 9 × 2 × 72 */
export const switchSidePorts = (s = SPEC) => switchChips(s) * s.nvlink.portsPerChip;
/** 1 本のリンク GB/s（双方向）と片方向 */
export const linkGBs = (s = SPEC) => (s.nvlink.gpuTBs * 1000) / s.nvlink.linksPerGpu;
export const linkOneWayGBs = (s = SPEC) => linkGBs(s) / 2;
/** ラックの帯域 TB/s: 72 × 1.8 */
export const rackTBs = (s = SPEC) => gpuCount(s) * s.nvlink.gpuTBs;
/** スイッチトレイの帯域 Tb/s（片方向の合計）: 144 × 50 GB/s × 8 bit */
export const switchTrayTbps = (s = SPEC) => (s.nvlink.chipsPerTray * s.nvlink.portsPerChip * linkOneWayGBs(s) * 8) / 1000;
/** ConnectX-7 の 400 Gb/s を双方向にした GB/s */
export const nicGBs = (s = SPEC) => (s.cx7Gbps * 2) / 8;
/** ラックの中と外の差: 1.8 TB/s ÷ 100 GB/s */
export const inOutRatio = (s = SPEC) => (s.nvlink.gpuTBs * 1000) / nicGBs(s);
/** all-reduce: リングで GPU 1 個が送る量 GB = 2 (N−1) / N × G */
export const ringSentGB = (s = SPEC) => ((2 * (s.allreduce.gpus - 1)) / s.allreduce.gpus) * s.allreduce.gradGB;
export const ringMs = (s = SPEC) => (ringSentGB(s) / s.allreduce.oneWayGBs) * 1000;
/** SHARP: 1 個が送るのは G だけ */
export const sharpSentGB = (s = SPEC) => s.allreduce.gradGB;
export const sharpMs = (s = SPEC) => (sharpSentGB(s) / s.allreduce.oneWayGBs) * 1000;
/** ring の手数: 2 (N − 1) 回、隣へ G/N ずつ */
export const ringSteps = (s = SPEC) => 2 * (s.allreduce.gpus - 1);
/** 電源: 積んだ kW、N+N で使える kW、母線の電流 A */
export const installedKW = (s = SPEC) => s.power.shelves * s.power.psuPerShelf * s.power.psuKW;
export const usableKW = (s = SPEC) => installedKW(s) / 2;
export const busAmps = (s = SPEC) => (s.power.rackKW * 1000) / s.power.busV;
/** 液冷: kg/s = kW ÷ (比熱 × 温度差)、L/分 */
export const flowKgS = (dT = SPEC.cool.dTDefault, s = SPEC) => s.power.rackKW / (s.cool.cpKJ * dT);
export const flowLpm = (dT = SPEC.cool.dTDefault, s = SPEC) => (flowKgS(dT, s) * 60) / s.cool.kgPerL;
/** 記憶容量 */
export const hbmTotalGB = (s = SPEC) => gpuCount(s) * s.gpu.hbmGB;
export const hbmTotalTBs = (s = SPEC) => gpuCount(s) * s.gpu.hbmTBs;
export const lpddrTotalGB = (s = SPEC) => graceCount(s) * s.grace.lpddrGB;
export const coreCount = (s = SPEC) => graceCount(s) * s.grace.cores;

// ------------------------------------------------------------ the NVLink wiring (計算による解釈: link l of a GPU → chip l)
/** GPU の通し番号 0..71（計算トレイ 1..18、トレイの中の GPU 1..4） */
export const gpuIndex = (tray, gpu, s = SPEC) => (tray - 1) * s.tray.gpus + (gpu - 1);
export const gpuOf = (i, s = SPEC) => ({tray: Math.floor(i / s.tray.gpus) + 1, gpu: (i % s.tray.gpus) + 1});
/** link l (0..17) of GPU g (0..71) goes to chip l, port g */
export const linkTo = (g, l) => ({chip: l, port: g});
/** chip c (0..17) sits in switch tray floor(c / 2) + 1, left (0) or right (1) */
export const chipOf = (c, s = SPEC) => ({tray: Math.floor(c / s.nvlink.chipsPerTray) + 1, side: c % s.nvlink.chipsPerTray});
/** the chip a pair talks through (any of the 18 would do; this picks one so the pairs spread over all chips) */
export const chipFor = (a, b, s = SPEC) => (a + b) % s.nvlink.linksPerGpu;
/** GPU a → GPU b: the nodes on the way [gpu a, chip, gpu b] and the switch chips passed */
export function route(a, b, s = SPEC) {
  const c = chipFor(a, b, s);
  const up = linkTo(a, c);
  const down = linkTo(b, c);
  return {nodes: [{gpu: a}, {chip: c, inPort: up.port, outPort: down.port}, {gpu: b}], chips: [c], hops: 1};
}

// ------------------------------------------------------------ scenes (staged time)
export const SCENES = {
  fan: {id: 'fan', name: '18 本のリンク', sub: 'GPU 1 個 → 18 個のスイッチチップへ 1 本ずつ', dur: 5.0},
  hop: {id: 'hop', name: 'GPU から GPU へ', sub: 'トレイ 3 の GPU 1 → トレイ 15 の GPU 3・スイッチ 1 段', dur: 7.0},
  ring: {id: 'ring', name: 'リングで集計', sub: '72 個が輪になって隣へ順に渡す', dur: 8},
  sharp: {id: 'sharp', name: 'スイッチで集計', sub: '全員が 1 GB をスイッチへ・中で足して 1 回で返す', dur: 6},
  out: {id: 'out', name: 'ラックの外へ', sub: 'GPU → ConnectX-7 → 前面の OSFP → InfiniBand', dur: 6},
  power: {id: 'power', name: '電源', sub: '電源棚 8 台 → 母線 50 V → 各トレイ', dur: 6},
  cool: {id: 'cool', name: '液冷', sub: 'マニホールド → コールドプレート → 戻り', dur: 6},
};
export const SCENE_IDS = Object.keys(SCENES);
export const sceneDuration = (scene) => SCENES[scene].dur;

// hop: the bead's legs (staged seconds). The bead reaches the switch chip at the end of 'tochip'.
export const HOP_LEGS = [
  {id: 'gpu', dur: 0.6, ja: 'GPU 1 が送り出す'},
  {id: 'back', dur: 0.8, ja: '背面のコネクタへ'},
  {id: 'down', dur: 0.9, ja: 'ケーブルカートリッジを下る'},
  {id: 'tochip', dur: 0.8, ja: 'スイッチトレイの NVSwitch へ'},
  {id: 'chip', dur: 0.9, ja: 'NVSwitch が出口を選ぶ'},
  {id: 'fromchip', dur: 0.8, ja: '背面へ戻る'},
  {id: 'down2', dur: 0.9, ja: 'カートリッジを下る'},
  {id: 'in', dur: 0.8, ja: 'トレイ 15 の GPU 3 へ'},
  {id: 'arrive', dur: 0.5, ja: '届いた'},
];
const legAt = (legs, t) => {
  let acc = 0;
  for (let i = 0; i < legs.length; i++) {
    if (t < acc + legs[i].dur || i === legs.length - 1) return {i, leg: legs[i], u: clamp((t - acc) / legs[i].dur, 0, 1), t0: acc};
    acc += legs[i].dur;
  }
  return {i: 0, leg: legs[0], u: 0, t0: 0};
};
const HOP_TOTAL = HOP_LEGS.reduce((a, l) => a + l.dur, 0);
/** the bead's progress along the 3 parts of the route (0..1 each): GPU → chip, at chip, chip → GPU; hops = chips passed */
export function hopAt(t, s = SPEC) {
  const tt = clamp(t, 0, HOP_TOTAL);
  const {i, leg, u} = legAt(HOP_LEGS, tt);
  const a = gpuIndex(s.demo.hopFrom.tray, s.demo.hopFrom.gpu, s);
  const b = gpuIndex(s.demo.hopTo.tray, s.demo.hopTo.gpu, s);
  const r = route(a, b, s);
  // u along the whole route: legs 0-3 = first half, 4 = at the chip, 5-8 = second half
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
  return {links, lit, from: gpuIndex(s.demo.hopFrom.tray, s.demo.hopFrom.gpu, s)};
}
/** ring all-reduce: u 0..1 through the 2 (N−1) steps; sent GB and the ms it takes (bandwidth only) */
export function ringAt(t, s = SPEC) {
  const u = clamp(t / SCENES.ring.dur, 0, 1);
  const steps = ringSteps(s);
  const step = Math.min(steps, Math.floor(u * steps + 1e-9));
  return {u, step, steps, phase: step < steps / 2 ? 'reduce' : 'gather', sentGB: ringSentGB(s) * u, ms: ringMs(s) * u, done: u >= 1};
}
/** SHARP: up (everyone sends 1 GB to the switch), sum in the switch, down (one return) */
export const SHARP_PH = {up: [0, 2.4], sum: [2.4, 3.2], down: [3.2, 5.2]};
export function sharpAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const up = seg(tt, ...SHARP_PH.up);
  const sum = seg(tt, ...SHARP_PH.sum);
  const down = seg(tt, ...SHARP_PH.down);
  const phase = tt < SHARP_PH.up[1] ? 'up' : tt < SHARP_PH.sum[1] ? 'sum' : tt < SHARP_PH.down[1] ? 'down' : 'done';
  // sending and receiving overlap in the real switch; the staged up / down only separate them for the eye
  const all = seg(tt, SHARP_PH.up[0], SHARP_PH.down[1]);
  return {up, sum, down, phase, sentGB: sharpSentGB(s) * up, ms: sharpMs(s) * all, done: phase === 'done'};
}
/** out: beads per second on each side (the NVLink side carries 18 for every one that leaves the rack) */
export const OUT = {perSecOut: 1.1, travelOut: 2.6, travelIn: 1.0};
export function outAt(t, s = SPEC) {
  const r = inOutRatio(s);
  return {ratio: r, nvlinkTBs: s.nvlink.gpuTBs, nicGBs: nicGBs(s), perSecIn: OUT.perSecOut * r, perSecOut: OUT.perSecOut, t: Math.max(0, t)};
}
/** power: the current ramps in once (staged), then the bus carries the full 2,400 A */
export const POWER = {ramp: 1.2};
export function powerAt(t, s = SPEC) {
  const k = ease(Math.max(0, t) / POWER.ramp);
  return {k, kw: s.power.rackKW * k, amps: busAmps(s) * k, installedKW: installedKW(s), usableKW: usableKW(s), loadKW: s.power.rackKW};
}
/** cool: flow for a temperature difference (5..20 K) */
export function coolAt(t, dT = SPEC.cool.dTDefault, s = SPEC) {
  const d = clamp(dT, s.cool.dTMin, s.cool.dTMax);
  return {dT: d, kgS: flowKgS(d, s), lpm: flowLpm(d, s), speed: flowLpm(d, s) / flowLpm(s.cool.dTDefault, s), t: Math.max(0, t)};
}

/** t snapped for reduced motion: the bead jumps from leg to leg, the ring from eighth to eighth, SHARP from phase to phase */
export function snapT(scene, t) {
  const tt = Math.max(0, t);
  if (scene === 'hop') return legAt(HOP_LEGS, tt).t0 + 1e-6;
  if (scene === 'ring') return Math.floor((tt / SCENES.ring.dur) * 8 + 1e-9) * (SCENES.ring.dur / 8);
  if (scene === 'sharp') {
    for (const [a, b] of [SHARP_PH.down, SHARP_PH.sum, SHARP_PH.up]) if (tt >= b) return b;
    return 0;
  }
  if (scene === 'fan') return FAN.start + Math.floor(Math.max(0, tt - FAN.start) / FAN.stagger) * FAN.stagger + FAN.grow;
  return tt;
}

/** every gauge value of a scene at staged time t (the console, LIVE.s and the tests read this) */
export function gaugesAt(scene, t, opts = {}, s = SPEC) {
  const out = {scene, hops: 0, sentGB: 0, ms: 0, outRatio: inOutRatio(s), amps: 0, flowLpm: flowLpm(opts.dT ?? s.cool.dTDefault, s), dT: opts.dT ?? s.cool.dTDefault, links: 0};
  if (scene === 'hop') out.hops = hopAt(t, s).hops;
  if (scene === 'fan') out.links = fanAt(t, s).lit;
  if (scene === 'ring') Object.assign(out, (({sentGB, ms}) => ({sentGB, ms}))(ringAt(t, s)));
  if (scene === 'sharp') Object.assign(out, (({sentGB, ms}) => ({sentGB, ms}))(sharpAt(t, s)));
  if (scene === 'power') out.amps = powerAt(t, s).amps;
  return out;
}

// ------------------------------------------------------------ the pulled tray's layers (chapter 2)
// Layers: the pull out of the rack, then from the top 天板, コールドプレート, チップ (Grace・B200), カード (CX7・BF3・E1.S).
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
    // a layer that does not move does not wait
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
// lab: refs.md 「実機で見るには」. Every command there is for the real machine only.
export const CHAPTERS = [
  {
    n: 1,
    name: '外観',
    text: '高さ 2,236 × 幅 600 × 奥行 1,068 mm のラックに、1U の計算トレイ 18 台と NVLink スイッチトレイ 9 台、電源棚 8 台、管理用の TOR スイッチ 2 台。背面には銅線のケーブルカートリッジ 4 本、液冷のマニホールド、母線が縦に走り、トレイは差し込むだけでつながる。',
    lab: [],
    labNote: '外観を見るコマンドは無い（2 章から）',
    subs: [{id: 'front', label: '前から'}, {id: 'back', label: '後ろから'}],
  },
  {
    n: 2,
    name: '計算トレイを引き出す',
    text: '計算トレイ 1 台に GB200 スーパーチップが 2 枚。1 枚の基板に Grace CPU 1 個と B200 GPU 2 個が載り、CPU と GPU は NVLink-C2C 900 GB/s で結ばれる。GPU 1 個に ConnectX-7 が 1 枚、ほかに BlueField-3 が 2 枚、E1.S が 4 本。',
    lab: [{cmd: 'nvidia-smi -q'}, {cmd: 'nvidia-smi topo -m'}],
    labWhat: 'GPU と CPU・NIC のつながり',
    subs: [{id: 'open', label: '引き出して分解'}, {id: 'close', label: '戻す'}],
  },
  {
    n: 3,
    name: '72 個が 1 つになる',
    text: 'GPU 1 個の 18 本のリンクは 18 個の NVSwitch チップに 1 本ずつ行き、どのチップも 72 個の GPU に 1 本ずつつながる。だからどの GPU からどの GPU へもスイッチ 1 段。GPU 側 72 × 18 = 1,296 本、スイッチ側 18 × 72 = 1,296 ポートでぴったり合う。',
    lab: [{cmd: 'nvidia-smi nvlink -s'}, {cmd: 'nvidia-smi -q | grep -i fabric'}],
    labWhat: 'リンクごとの速さ、NVLink の領域への参加',
    scenes: ['fan', 'hop'],
  },
  {
    n: 4,
    name: '学習 1 歩の集計',
    text: '学習の 1 歩ごとに 1 GB の勾配を 72 個で合計する（all-reduce）。リング方式は隣へ順に渡すので GPU 1 個が 1.972 GB 送って 2.191 ms。スイッチの中で足す SHARP なら 1 GB だけで 1.111 ms。帯域だけの単純計算で、遅延は入れていない。',
    lab: [{cmd: 'all_reduce_perf -b 1G -e 1G -g 1'}],
    labWhat: 'nccl-tests を MPI で 72 プロセス。algbw・busbw',
    scenes: ['ring', 'sharp'],
  },
  {
    n: 5,
    name: 'ラックの外へ',
    text: 'ラックの外へは GPU 1 個に ConnectX-7 が 1 枚、400 Gb/s の InfiniBand。双方向で 100 GB/s は NVLink の 1.8 TB/s の 18 分の 1。だから一番よく話す GPU どうしをラックの中に置き、外はレールに沿った fat tree でつなぐ。',
    lab: [{cmd: 'ibstat'}, {cmd: 'ibv_devinfo'}],
    labWhat: 'ConnectX-7 の速さ（400 Gb/s）とポートの状態',
    scenes: ['out'],
  },
  {
    n: 6,
    name: '120 kW を運び込む',
    text: '電源棚 8 台に 5.5 kW の電源が 6 台ずつ、積んだのは 264 kW。N+N の冗長なので使えるのは半分の 132 kW で、消費 約 120 kW が収まる。直流 50 V を母線で配るので電流は 120 kW ÷ 50 V = 2,400 A。だから太い銅の板で運ぶ。',
    lab: [{cmd: 'ipmitool sensor'}, {cmd: 'nvidia-smi -q -d POWER,TEMPERATURE'}],
    labWhat: '消費電力と温度',
    scenes: ['power'],
  },
  {
    n: 7,
    name: '液で冷やす',
    text: '冷たい液が背面のマニホールドから各トレイのコールドプレート（Grace・B200・ConnectX-7・NVSwitch）へ入り、温まって戻る。120 kW を温度差 10 K で運ぶと約 172 L/分（熱が全部液に行くと仮定）。電源棚や NIC の周り、記憶装置はファンの空冷。',
    lab: [{cmd: 'ipmitool sensor'}, {cmd: 'nvidia-smi -q -d POWER,TEMPERATURE'}],
    labWhat: '消費電力と温度',
    scenes: ['cool'],
  },
];
export const chapterOf = (n) => CHAPTERS[clamp(Math.round(n) - 1, 0, CHAPTERS.length - 1)];
/** refs.md 「次の世代」（画面の脚注） */
export const NEXT_GEN = [
  'GB300 NVL72: GPU が Blackwell Ultra、HBM3e はラックで 20 TB、NIC は ConnectX-8（GPU 1 個に 800 Gb/s）。NVLink は同じ 130 TB/s。',
  'Vera Rubin NVL72: HBM4、NVLink 6 でラック 216 TB/s（GPU 1 個 3 TB/s）、CPU は Vera。',
];
export const NOTICE = '非公式の教材。GB200 NVL72 を模した簡略形状で、NVIDIA・GB200・NVLink・Grace・Blackwell・ConnectX・BlueField は NVIDIA Corporation の商標。数値は refs.md の出典による';
