// The switch's math, no three.js. Every number lives in SPEC (sources and 仮定 in ../switch/refs.md); the geometry, the
// console and the tests all read it from here. One input drives the page: time. A scene is a pure function of its own
// clock: packetAt(scene, t) says which of the 12 ASIC stages the frame is in and where its cells and its 64 B
// descriptor are; queueAt(ms, mult) is the egress queue; puntAt(scene, t) the CPU-queue counters. The stage durations
// are STAGED TIME (0.5-0.8 s a stage, made up for the eye); only `real` carries values that exist in real time.
//
// Coordinates of the model (millimetres, in chassis.js): x along the front (right = NM side), y up, z front (+) to back (-).

export const SPEC = {
  // 筐体（出典2 Table 18）
  chassis: {h: 44, w: 445, d: 409, kg: 7.59},
  rj45: 48, // 1G RJ-45（上下2段 × 24）
  rj45Rows: 2,
  rj45Cols: 24,
  rj45Rate: 1, // Gbps
  sfp: 8, // NM-8X の 10G SFP+（仮定）
  sfpRate: 10,
  psuW: 715, // PWR-C1-715WAC-P
  psuBays: 2,
  psuCount: 1,
  fans: 3,
  stackPorts: 2,
  stackPower: 2,
  poeBudgetW: 437, // 715 W 電源 1台
  poeDeviceW: 30, // PoE+ の上限
  // 基板（出典1。配置は仮定）
  phy: 6, // 仮定
  phyPorts: 8, // 1 PHY あたり 8 ポート（仮定）
  asic: {name: 'UADP 2.0', nm: 28, gbps: 160, mpps: 238, bufMB: 16, macTable: 32000, ipv4Direct: 32000, ipv4Lpm: 8000, ipv6Direct: 16000, ipv6Lpm: 4000, acl: 5000},
  cpu: {cores: 4, ghz: 1.8, ddr4GB: 8, ddr4Modules: 1, eusbGB: 16},
  // フレームとフレーム間隔
  frame: {min: 64, max: 1518, overhead: 20}, // 前置き＋フレーム間隔 20 B
  cellB: 256, // NIF の切れ端
  descB: 64, // 札（ディスクリプタ）
  // CPU に上がるパケット（出典3）
  punt: {
    cpuTotalPps: 19000,
    queues: [
      {id: 5, name: 'WK_CPU_Q_FORUS_ADDR_RESOLUTION', ja: 'ARP（自分宛て）', pps: 4000},
      {id: 4, name: 'WK_CPU_Q_ROUTING_CONTROL', ja: 'ルーティングプロトコル', pps: 5500},
      {id: 3, name: 'WK_CPU_Q_ICMP_GEN', ja: 'ICMP の生成', pps: 750},
      {id: 1, name: 'WK_CPU_Q_L2_CONTROL', ja: 'L2 制御', pps: 2000},
      {id: 2, name: 'WK_CPU_Q_FORUS_TRAFFIC', ja: '自分宛ての通信', pps: 4000},
    ],
    stormPps: 10000, // ARP の嵐
    stormRamp: 0.8, // 到着が 10,000 pps に立ち上がるまでの演出時間 s
  },
  // 混雑（出典4）
  queue: {
    q0: {hardMax: 100, softMax: 400},
    q1: {softMin: 150, softMax: 600},
    unitB: 256, // 仮定
    multDefault: 100,
    multMax: 1200,
    wtd: [80, 90, 100],
    inGbps: [1, 1], // Gi1/0/1, Gi1/0/2
    outGbps: 1, // Gi1/0/3
  },
  // 演出時間と実時間の換算（場面ごとに1か所）
  timeMap: {
    congestMsPerSec: 2, // 演出 1 秒 = 実時間 2 ms
    stormRealPerSec: 1, // 演出 1 秒 = 実時間 1 秒（pps をそのまま数える）
  },
  stageDur: 0.6, // 段 1つの演出時間 s（0.5-0.8）
  // 画面の例示値（refs.md に無い。説明用の仮置き）
  demo: {
    ttl0: 64,
    hostA: 'aaaa.aaaa.0001',
    hostB: 'bbbb.bbbb.0002',
    svi: 'cccc.cccc.0001',
    floodPorts: ['Gi1/0/2', 'Gi1/0/3', 'Gi1/0/4'], // 同じ VLAN の出口の例（数は説明用）
  },
};

// ------------------------------------------------------------ checks that refs.md 「検算」 spells out
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};

/** 交換容量 Gbps: (48×1 + 8×10) × 2（全二重） */
export const oneWayGbps = (spec = SPEC) => spec.rj45 * spec.rj45Rate + spec.sfp * spec.sfpRate;
export const switchingGbps = (spec = SPEC) => oneWayGbps(spec) * 2;
/** 転送レート Mpps: 一方向の Gbps / (最小フレーム＋20 B の bit 数) */
export const forwardMpps = (spec = SPEC) => (oneWayGbps(spec) * 1e9) / ((spec.frame.min + spec.frame.overhead) * 8) / 1e6;
/** 直列化時間 µs（線に乗る時間、前置き＋間隔 20 B を含む） */
export const serialUs = (bytes, gbps, spec = SPEC) => ((bytes + spec.frame.overhead) * 8) / (gbps * 1e9) * 1e6;
/** NIF の切れ端: [256, 256, ..., 最後] */
export const cellsOf = (bytes, spec = SPEC) => {
  const n = Math.ceil(bytes / spec.cellB);
  return Array.from({length: n}, (_, i) => (i < n - 1 ? spec.cellB : bytes - spec.cellB * (n - 1)));
};
/** 札は本体の何分の1か（1518 / 64 = 23.7） */
export const descShare = (bytes, spec = SPEC) => bytes / spec.descB;
/** ハードの速さ ÷ CPU が受けられる速さ */
export const hwOverCpu = (spec = SPEC) => (forwardMpps(spec) * 1e6) / spec.punt.cpuTotalPps;
export const puntQueue = (id, spec = SPEC) => spec.punt.queues.find((q) => q.id === id);
/** CoPP: 到着レートのうち上限を超えた分を CPU の手前で捨てる */
export const copp = (offeredPps, qid, spec = SPEC) => {
  const lim = puntQueue(qid, spec).pps;
  const pass = Math.min(offeredPps, lim);
  return {offered: offeredPps, pass, drop: offeredPps - pass, limit: lim};
};
/** Q1 の上限 B。mult 100〜1200（%）で比例して増える */
export const q1LimitB = (mult = SPEC.queue.multDefault, spec = SPEC) => (spec.queue.q1.softMax * spec.queue.unitB * mult) / spec.queue.multDefault;
export const q0LimitB = (mult = SPEC.queue.multDefault, spec = SPEC) => (spec.queue.q0.softMax * spec.queue.unitB * mult) / spec.queue.multDefault;
/** 溜まる速さ B/ms: 入 2 Gbps − 出 1 Gbps = 1 Gbps */
export const netInBytesPerMs = (spec = SPEC) => ((spec.queue.inGbps.reduce((a, b) => a + b, 0) - spec.queue.outGbps) * 1e9) / 8 / 1000;
/** 満杯までの実時間 ms */
export const fillMs = (mult = SPEC.queue.multDefault, spec = SPEC) => q1LimitB(mult, spec) / netInBytesPerMs(spec);
/** PoE: 予算に収まる機器の台数と、全ポートに載せたときの必要電力 W */
export const poeDevices = (spec = SPEC) => Math.floor(spec.poeBudgetW / spec.poeDeviceW);
export const poeFullW = (spec = SPEC) => spec.rj45 * spec.poeDeviceW;

/**
 * Egress queue Q1 at real time tMs for multiplier mult: bytes held, full or not, and what was thrown away from the tail
 * (the extra 1 Gbps keeps arriving after it is full).
 */
export function queueAt(tMs, mult = SPEC.queue.multDefault, spec = SPEC) {
  const t = Math.max(0, tMs);
  const rate = netInBytesPerMs(spec);
  const limit = q1LimitB(mult, spec);
  const tFull = limit / rate;
  const bytes = Math.min(limit, rate * t);
  const full = t >= tFull;
  const droppedB = full ? rate * (t - tFull) : 0;
  return {
    tMs: t,
    mult,
    bytes,
    limit,
    pct: bytes / limit,
    full,
    tFullMs: tFull,
    frames: Math.floor(bytes / spec.frame.max),
    droppedB,
    droppedFrames: Math.floor(droppedB / spec.frame.max),
    q0Limit: q0LimitB(mult, spec),
  };
}

// ------------------------------------------------------------ the 12 stages (refs.md 「ASIC の中のパケットの通り道」)
// key = where the stage sits in the ASIC drawing (Phase B's asic.js); ja = the one phrase on screen.
export const STAGES = [
  {n: 1, id: 'phy-in', abbr: 'PHY', ja: '電気信号をフレームに戻す', key: 'phy-in', what: '入口ポート → PHY。電気信号をフレームに戻して NIF へ'},
  {n: 2, id: 'nif', abbr: 'NIF', ja: '256 B の切れ端に分ける', key: 'nif', what: 'フレームを 256 バイトの切れ端に分ける。時刻印（1588）と省電力（EEE）も扱う'},
  {n: 3, id: 'macsec-in', abbr: 'MACsec', ja: '暗号を解く（使うときだけ）', key: 'macsec-in', what: '入口 MACsec。暗号を解く（使うときだけ）。固定遅延のカットスルー'},
  {n: 4, id: 'fifo-in', abbr: 'FIFO', ja: '切れ端を集めて PBC へ', key: 'fifo-in', what: '入口 FIFO。切れ端を集めて PBC へ流す'},
  {n: 5, id: 'ifc', abbr: 'IFC', ja: '横から覗いて検索し札を作る', key: 'ifc', what: 'FIFO→PBC の流れを横から覗いて検索（MAC 表・FIB・ACL・QoS）。結果を 64 バイトの札にして PBC に返す'},
  {n: 6, id: 'pbc', abbr: 'PBC', ja: '本体を置いておく', key: 'pbc', what: 'パケットバッファ。本体を置いておく場所。札を見て出口ポートと QoS を決める'},
  {n: 7, id: 'eqs', abbr: 'EQS', ja: '出口キューに並べる・複製', key: 'eqs', what: '出口キューに並べる・複製（フラッディング、マルチキャスト）・送り出す順を決める'},
  {n: 8, id: 'pbc-rwe', abbr: 'PBC→RWE', ja: '順番が来た本体を渡す', key: 'pbc-rwe', what: '順番が来た本体を書き換え部へ渡す'},
  {n: 9, id: 'efc-peek', abbr: 'EFC', ja: '流れを覗く（出口側）', key: 'efc', what: 'EFC（出口転送制御）。PBC→RWE の流れを覗く'},
  {n: 10, id: 'efc-lookup', abbr: 'EFC', ja: '出口側の検索で書き換えの札', key: 'efc', what: '出口側の検索（SPAN、再循環）をして書き換えの札を作る'},
  {n: 11, id: 'rwe', abbr: 'RWE', ja: '書き換え（MAC・TTL−1）', key: 'rwe', what: 'L3 なら宛先・送信元 MAC の付け替えと TTL−1。必要なら分割。出口 FIFO へ'},
  {n: 12, id: 'out', abbr: 'NIF→PHY', ja: '線に送り出す', key: 'out', what: '出口 MACsec → NIF → PHY → 出口ポート。暗号をかけ（使うときだけ）、線に送り出す'},
];
export const STAGE_IDS = STAGES.map((s) => s.id);
const SI = Object.fromEntries(STAGES.map((s, i) => [s.id, i]));

/** the software layers a punted frame climbs (refs.md CPU に上がるパケット) */
export const CPU_LAYERS = [
  {id: 'copp', ja: 'CoPP ポリサー', sub: 'ASIC の中・CPU の手前で上限をかける'},
  {id: 'kernel', ja: 'Linux カーネル', sub: '詳細は出典に無い'},
  {id: 'fed', ja: 'FED', sub: '転送エンジンのドライバ'},
  {id: 'pds', ja: 'PDS', sub: 'パケット受け渡し'},
  {id: 'iosd', ja: 'IOSd', sub: 'IOS の本体'},
];

// ------------------------------------------------------------ scenes
// A scene is a list of steps. {a: stage id} walks one ASIC stage; {c: layer id, d: +1 up / -1 back down} one CPU layer;
// {inj: true} the reply going back down into the ASIC. Each step lasts SPEC.stageDur unless `dur` says otherwise.
const walk = (...ids) => ids.map((a) => ({a}));
const ASIC_TO_IFC = ['phy-in', 'nif', 'macsec-in', 'fifo-in', 'ifc'];
const ASIC_TAIL = ['pbc', 'eqs', 'pbc-rwe', 'efc-peek', 'efc-lookup', 'rwe', 'out'];
const PUNT_UP = [{c: 'copp', d: 1, dur: 0.8}, {c: 'kernel', d: 1}, {c: 'fed', d: 1}, {c: 'pds', d: 1}, {c: 'iosd', d: 1, dur: 0.8}];
const PUNT_DOWN = [{c: 'pds', d: -1}, {c: 'fed', d: -1}, {c: 'kernel', d: -1}, {inj: true}];

export const SCENES = {
  l2: {
    id: 'l2',
    name: 'L2 でそのまま',
    sub: 'Gi1/0/1 → Gi1/0/2・同じ VLAN・MAC 既知',
    bytes: 1518,
    rateGbps: 1,
    from: 'Gi1/0/1',
    to: 'Gi1/0/2',
    steps: [...walk(...ASIC_TO_IFC, ...ASIC_TAIL)],
  },
  l3: {
    id: 'l3',
    name: 'L3 で VLAN をまたぐ',
    sub: 'VLAN10 → VLAN20（SVI）・RWE で書き換え',
    bytes: 1518,
    rateGbps: 1,
    from: 'Gi1/0/1',
    to: 'Gi1/0/2',
    l3: true,
    steps: [...walk(...ASIC_TO_IFC, ...ASIC_TAIL)],
  },
  flood: {
    id: 'flood',
    name: '宛先不明',
    sub: '未知ユニキャスト・EQS で VLAN の全ポートへ複製',
    bytes: 1518,
    rateGbps: 1,
    from: 'Gi1/0/1',
    to: null,
    flood: true,
    steps: [...walk(...ASIC_TO_IFC, ...ASIC_TAIL)],
  },
  arp: {
    id: 'arp',
    name: 'ARP が CPU へ',
    sub: 'IFC が自分宛てと判定 → キュー5 → CoPP → CPU',
    bytes: 64,
    rateGbps: 1,
    from: 'Gi1/0/1',
    to: null,
    punt: 5,
    steps: [...walk(...ASIC_TO_IFC), ...PUNT_UP, ...PUNT_DOWN, {a: 'out'}],
  },
  storm: {
    id: 'storm',
    name: 'ARP の嵐',
    sub: '10,000 pps 到着・4,000 pps 通過・6,000 pps を捨てる',
    bytes: 64,
    rateGbps: 1,
    from: 'Gi1/0/1',
    to: null,
    punt: 5,
    rate: true,
    steps: [...walk(...ASIC_TO_IFC), {c: 'copp', d: 1, dur: 3.2}],
  },
  ttl: {
    id: 'ttl',
    name: 'TTL 切れ',
    sub: 'ICMP を作る仕事はキュー3（750 pps）へ',
    bytes: 1518,
    rateGbps: 1,
    from: 'Gi1/0/1',
    to: null,
    punt: 3,
    ttl: 1,
    steps: [...walk(...ASIC_TO_IFC), ...PUNT_UP, ...PUNT_DOWN, {a: 'out'}],
  },
  congest: {
    id: 'congest',
    name: '2本 → 1本',
    sub: 'Gi1/0/1 と Gi1/0/2 から各 1 Gbps → Gi1/0/3',
    bytes: 1518,
    rateGbps: 1,
    from: 'Gi1/0/1+2',
    to: 'Gi1/0/3',
    queue: true,
    steps: [{a: 'eqs', dur: 8}],
  },
};
export const SCENE_IDS = Object.keys(SCENES);

const stepDur = (s, spec = SPEC) => s.dur ?? spec.stageDur;
/** total staged length of a scene, seconds */
export const sceneDuration = (scene, spec = SPEC) => SCENES[scene].steps.reduce((a, s) => a + stepDur(s, spec), 0);
/** which step a staged time falls in: {i, step, u} (u 0..1 in the step); clamped at both ends */
function stepAt(scene, t, spec = SPEC) {
  const steps = SCENES[scene].steps;
  let acc = 0;
  for (let i = 0; i < steps.length; i++) {
    const d = stepDur(steps[i], spec);
    if (t < acc + d || i === steps.length - 1) return {i, step: steps[i], u: clamp((t - acc) / d, 0, 1), t0: acc};
    acc += d;
  }
  return {i: 0, step: steps[0], u: 0, t0: 0};
}
/** t snapped to the start of its step (+ a hair): the reduced-motion page jumps from stage to stage */
export function snapT(scene, t, spec = SPEC) {
  const {t0} = stepAt(scene, Math.max(0, t), spec);
  return t0 + 1e-6;
}

/** the lab numbers that exist in real time for a scene (serialisation, the cells, the descriptor) */
export function realOf(scene, spec = SPEC) {
  const sc = SCENES[scene];
  const cells = cellsOf(sc.bytes, spec);
  return {
    bytes: sc.bytes,
    rateGbps: sc.rateGbps,
    serialUs: serialUs(sc.bytes, sc.rateGbps, spec),
    cellCount: cells.length,
    lastCellB: cells[cells.length - 1],
    descB: spec.descB,
    descShare: descShare(sc.bytes, spec),
  };
}

/**
 * The frame at staged time t of a scene:
 * {scene, stage (0..11, the ASIC stage it is at or last passed), stageId, phase ('asic'|'cpu'|'inject'|'queue'),
 *  cpuLayer (CPU_LAYERS id or null), u (0..1 inside the step), step (index), cells: [{i, bytes, at}] with at one of
 *  'wire' | 'nif' | 'fifo' | 'pbc' | 'moving' | 'rwe' | 'out', desc: {at, u} (at: null|'ifc'|'pbc'|'eqs'|'efc'|'rwe'|'cpu'),
 *  copies (egress copies at EQS), rewrite (L3 fields) , real, done}
 */
export function packetAt(scene, t, opts = {}, spec = SPEC) {
  const sc = SCENES[scene];
  const tt = Math.max(0, t);
  const {i: step, step: st, u} = stepAt(scene, tt, spec);
  const done = tt >= sceneDuration(scene, spec) - 1e-9;
  const cellB = cellsOf(sc.bytes, spec);
  const n = cellB.length;
  const out = {scene, step, u, done, stage: 0, stageId: STAGES[0].id, phase: 'asic', cpuLayer: null, cells: [], desc: {at: null, u: 0}, copies: 0, rewrite: null, real: realOf(scene, spec)};

  if (sc.queue) {
    const mult = opts.mult ?? spec.queue.multDefault;
    const ms = (tt * spec.timeMap.congestMsPerSec);
    out.stage = SI.eqs;
    out.stageId = 'eqs';
    out.phase = 'queue';
    out.u = clamp(ms / fillMs(mult, spec), 0, 1);
    out.desc = {at: 'eqs', u: out.u};
    out.real = {...out.real, ...queueAt(ms, mult, spec)};
    return out;
  }

  // the stage the frame is in; a punt step keeps the last ASIC stage (IFC) it came through
  let stage = st.a !== undefined ? SI[st.a] : SI.ifc;
  if (st.c !== undefined || st.inj) {
    // after the CPU the frame goes back to the egress side
    stage = st.inj ? SI.pbc : SI.ifc;
  }
  out.stage = stage;
  out.stageId = STAGES[stage].id;
  if (st.c !== undefined) {
    out.phase = 'cpu';
    out.cpuLayer = st.c;
    out.cpuDir = st.d;
  } else if (st.inj) {
    out.phase = 'inject';
  }

  const post = (name) => step >= sc.steps.findIndex((s) => s.a === name) && sc.steps.findIndex((s) => s.a === name) >= 0;
  const inAsic = st.a !== undefined;
  // cells: appear at the NIF, ride with the stages, sit in the PBC while only the descriptor moves, leave for the RWE
  const mk = (at, k = n) => cellB.map((bytes, i) => ({i, bytes, at: i < k ? at : 'wire'}));
  if (!inAsic) {
    // punted frame: its cells wait in the PBC; for a reply they are new cells
    out.cells = mk('pbc');
    out.desc = {at: 'cpu', u};
  } else {
    switch (st.a) {
      case 'phy-in':
        out.cells = cellB.map((bytes, i) => ({i, bytes, at: 'wire'}));
        break;
      case 'nif': {
        const k = Math.min(n, Math.floor(u * n + 1e-9) + (u >= 1 ? 0 : 0));
        out.cells = cellB.map((bytes, i) => ({i, bytes, at: i < k ? 'nif' : 'wire'}));
        break;
      }
      case 'macsec-in':
        out.cells = mk('nif');
        break;
      case 'fifo-in':
        out.cells = mk('fifo');
        break;
      case 'ifc':
        out.cells = mk('fifo');
        out.desc = {at: 'ifc', u};
        break;
      case 'pbc':
        out.cells = mk('pbc');
        out.desc = {at: 'pbc', u};
        break;
      case 'eqs':
        out.cells = mk('pbc');
        out.desc = {at: 'eqs', u};
        out.copies = sc.flood ? spec.demo.floodPorts.length : 1;
        break;
      case 'pbc-rwe': {
        const k = Math.min(n, Math.floor(u * n + 1e-9));
        out.cells = cellB.map((bytes, i) => ({i, bytes, at: i < k ? 'moving' : 'pbc'}));
        out.desc = {at: 'pbc', u};
        out.copies = sc.flood ? spec.demo.floodPorts.length : 1;
        break;
      }
      case 'efc-peek':
      case 'efc-lookup':
        out.cells = mk('moving');
        out.desc = {at: 'efc', u: st.a === 'efc-peek' ? u * 0.5 : 0.5 + u * 0.5};
        out.copies = sc.flood ? spec.demo.floodPorts.length : 1;
        break;
      case 'rwe':
        out.cells = mk('rwe');
        out.desc = {at: 'rwe', u};
        out.copies = sc.flood ? spec.demo.floodPorts.length : 1;
        break;
      case 'out':
        out.cells = mk('out');
        out.copies = sc.flood ? spec.demo.floodPorts.length : 1;
        break;
      default:
    }
  }
  void post;
  // L3: what the RWE rewrites (shown from the EFC on, applied at the RWE)
  if (sc.l3) {
    const d = spec.demo;
    const applied = stage > SI.rwe || (stage === SI.rwe && u > 0.5);
    out.rewrite = {
      applied,
      ttl: applied ? d.ttl0 - 1 : d.ttl0,
      dst: applied ? d.hostB : d.svi,
      src: applied ? d.svi : d.hostA,
    };
  }
  if (sc.ttl) out.ttl = sc.ttl;
  return out;
}

/**
 * The CPU-queue counters of a scene at staged time t. For the storm: ARP arrives at 10,000 pps (after a short ramp),
 * the CoPP lets 4,000 pps through and throws 6,000 pps away in front of the CPU. For the one-frame scenes (arp, ttl)
 * the counters are one frame, counted when the frame reaches the CoPP.
 */
export function puntAt(scene, t, spec = SPEC) {
  const sc = SCENES[scene];
  if (!sc.punt) return {queue: null, limit: 0, offeredPps: 0, passPps: 0, dropPps: 0, offered: 0, pass: 0, drop: 0, cpuTotalPps: spec.punt.cpuTotalPps};
  const q = puntQueue(sc.punt, spec);
  const base = {queue: q.id, queueName: q.name, limit: q.pps, cpuTotalPps: spec.punt.cpuTotalPps};
  const tt = Math.max(0, t);
  if (sc.rate) {
    const R = spec.punt.stormPps;
    const ramp = spec.punt.stormRamp;
    const real = tt * spec.timeMap.stormRealPerSec;
    const rate = (x) => R * clamp(x / ramp, 0, 1);
    // cumulative frames: closed form of the integral of the ramp, and of min(ramp, limit)
    const cumOff = real < ramp ? (R * real * real) / (2 * ramp) : (R * ramp) / 2 + R * (real - ramp);
    const s1 = (q.pps / R) * ramp; // the ramp reaches the limit here
    const cumPass = real <= s1 ? (R * real * real) / (2 * ramp) : (R * s1 * s1) / (2 * ramp) + q.pps * (real - s1);
    const off = rate(real);
    const c = copp(off, sc.punt, spec);
    return {...base, offeredPps: c.offered, passPps: c.pass, dropPps: c.drop, offered: cumOff, pass: cumPass, drop: cumOff - cumPass};
  }
  // one frame: counted from the first CPU step on
  const {i, step} = stepAt(scene, tt, spec);
  const reached = step.c !== undefined || sc.steps.slice(0, i).some((s) => s.c !== undefined);
  const k = reached ? 1 : 0;
  return {...base, offeredPps: k, passPps: k, dropPps: 0, offered: k, pass: k, drop: 0};
}

// ------------------------------------------------------------ the layered lift of the cover (chapter 2)
// Layers from the top: 天板, ヒートシンク, NM, 電源. Opening goes top first with a stagger; closing goes bottom first, faster.
export const LAYERS = ['cover', 'heat', 'nm', 'psu'];
export const EXPLODE = {open: {stagger: 0.17, dur: 0.9}, close: {stagger: 0.06, dur: 0.5}};
export const easeInOut = (x) => {
  const u = clamp(x, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};

/** one layer's lift (0..1) at time t from a list of {t, to: 0|1} presses; `init` is the lift before the first press */
export function layerAt(events, k, t, init = 0, instant = false) {
  let v = init;
  let seg = null; // {t0, v0, to, delay, dur}
  const at = (tt) => {
    if (!seg) return v;
    const span = seg.dur * Math.abs(seg.to - seg.v0);
    const u = span <= 0 ? 1 : (tt - seg.t0 - seg.delay) / span;
    return seg.v0 + (seg.to - seg.v0) * easeInOut(u);
  };
  for (const e of events) {
    if (e.t > t) break;
    v = at(e.t);
    const opening = e.to > v;
    const P = opening ? EXPLODE.open : EXPLODE.close;
    const rank = opening ? k : LAYERS.length - 1 - k;
    seg = {t0: e.t, v0: v, to: e.to, delay: instant ? 0 : rank * P.stagger, dur: instant ? 1e-6 : P.dur};
  }
  return clamp(at(t), 0, 1);
}
/** all four lifts at t, and their mean (the page's `explode`) */
export function liftsAt(events, t, init = [0, 0, 0, 0], instant = false) {
  const lifts = LAYERS.map((_, k) => layerAt(events, k, t, init[k] ?? 0, instant));
  return {lifts, explode: lifts.reduce((a, b) => a + b, 0) / lifts.length};
}

// ------------------------------------------------------------ chapters (the console reads these)
export const CHAPTERS = [
  {
    n: 1,
    name: '外観',
    text: '1U・445 × 44 × 409 mm・7.59 kg。前面は 1G RJ-45 が上下 2 段 × 24 の 48 ポートと、右端の NM-8X（10G SFP+ × 8）。背面は電源ベイ 2（715 W が 1 台、もう 1 つは空き）、ファン 3、スタック系のポートが並ぶ。会社のフロアで PC や電話をつなぐ種類のスイッチで、AI の GPU どうしをつなぐ所には使わない。',
    lab: [
      {cmd: 'show inventory', iol: true},
      {cmd: 'show version', iol: true},
      {cmd: 'show environment all', iol: false},
    ],
    subs: [{id: 'front', label: '前面'}, {id: 'back', label: '背面'}],
  },
  {
    n: 2,
    name: '蓋を開ける',
    text: '天板、ヒートシンク、NM、電源の順に上の層から外れる。中は 1 枚の基板で、前面の後ろに PHY が 6 個、中央に UADP 2.0 ASIC、片側に x86 CPU と DDR4 1 枚と eUSB フラッシュ、後ろ寄りに電源とファン。',
    lab: [
      {cmd: 'show platform', iol: false},
      {cmd: 'show platform software status control-processor brief', iol: false},
    ],
    subs: [{id: 'open', label: '層を外す'}, {id: 'close', label: '閉じる'}],
  },
  {
    n: 3,
    name: '役割分担',
    text: 'フレームを運ぶのはデータプレーン（PHY → ASIC とその配線）。CPU とメモリ・フラッシュのコントロールプレーンは、表を作り、制御プロトコルを話し、ASIC に書き込む側。普段のフレームは CPU を通らない。',
    lab: [{cmd: 'show platform software fed switch active ifm mappings', iol: false}],
    subs: [{id: 'data', label: 'データプレーン'}, {id: 'ctrl', label: 'コントロールプレーン'}],
  },
  {
    n: 4,
    name: 'パケットの一生',
    text: 'フレームは NIF で 256 B の切れ端に分かれ、本体は PBC に置かれたまま、64 B の札だけが検索（IFC）と出口キュー（EQS）を回る。順番が来たら本体が RWE を通って出る。',
    lab: [
      {cmd: 'show mac address-table', iol: true},
      {cmd: 'show ip cef <宛先> detail', iol: true},
      {cmd: 'show platform software fed switch active matm macTable vlan <n>', iol: false},
    ],
    scenes: ['l2', 'l3', 'flood'],
  },
  {
    n: 5,
    name: 'CPU に上がるとき',
    text: 'CPU に上がるのは自分宛て・制御・例外だけ。ハード 190.48 Mpps に対して CPU は約 19,000 pps、約 1 万分の 1。だから CoPP がキューごとに上限をかけ、超えた分は CPU の手前で捨てる。',
    lab: [
      {cmd: 'show platform software fed switch active punt cpuq 5', iol: false},
      {cmd: 'show platform hardware fed switch active qos queue stats internal cpu policer', iol: false},
      {cmd: 'show policy-map control-plane', iol: false},
    ],
    iolAlt: 'IOL では show ip traffic と show arp で代わりに見る',
    scenes: ['arp', 'storm', 'ttl'],
  },
  {
    n: 6,
    name: '混んだとき',
    text: 'Gi1/0/1 と Gi1/0/2 から各 1 Gbps が 1 本の 1 Gbps に集まると、Q1 の 153,600 B は 1.2288 ms で満杯になり、以後は末尾から捨てる。倍率 1200 にすると 14.7456 ms まで耐える。',
    lab: [
      {cmd: 'show platform hardware fed switch active qos queue stats interface Gi1/0/3', iol: false},
      {cmd: 'show policy-map interface Gi1/0/3', iol: false},
    ],
    iolAlt: 'IOL では show interfaces Gi0/3 の output drops',
    scenes: ['congest'],
    mults: [100, 1200],
  },
  {
    n: 7,
    name: '冷却と電力',
    text: '風は前面と側面から入り背面へ抜ける。ファン 3 基は可変速で、1 基止まっても残りが回転を上げる（N+1）。PoE 予算は 715 W 電源 1 台で 437 W、30 W の機器は 14 台まで。',
    lab: [
      {cmd: 'show environment all', iol: false},
      {cmd: 'show power inline', iol: false},
    ],
    subs: [{id: 'air', label: '冷却の風'}, {id: 'poe', label: '電力 (PoE)'}],
  },
];
export const chapterOf = (n) => CHAPTERS[clamp(Math.round(n) - 1, 0, CHAPTERS.length - 1)];
