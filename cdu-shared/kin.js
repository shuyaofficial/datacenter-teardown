// The CDU's math, no three.js. Every number lives in SPEC (sources, 仮定・計算・推測・未確認 in ../cdu/refs.md); the
// geometry, the console and the tests all read it from here. One input drives the page: time. A scene is a pure function
// of its own clock: flowAt / racksAt / failoverAt / leakAt / fwsAt say what moves and what the gauges read. The scene
// durations are STAGED TIME (made up for the eye); only the computed values (L/分・kW・K・秒) exist in real time.
//
// Coordinates of the model (millimetres, in cdu.js / row.js): x along the row (right = +), y up from the floor, z front
// (+) to back (-).

export const SPEC = {
  // CDU 1 台（手本: Vertiv CoolChip CDU 600。出典1、2、3）
  cdu: {
    h: 2000,
    w: 600,
    d: 1200,
    dryKg: 480,
    wetKg: 550,
    kw: 600,
    ratedAtdK: 4, // 600 kW は ATD 4 ℃のとき
    supplyCtlK: 1, // 冷却液の行きの温度の制御 ±1 ℃
    fwsClass: 'W45',
    powerKw: 9.0, // 名目
    volts: '400 V 50/60 Hz か 480 V 60 Hz',
    noiseDba: 55, // 3 m で 55 dBA 未満
    liters: {fws: 32.9, tcs: 48}, // 推測（出典3 の表の行ずれを読み直した値）
    portIn: 2.5, // 配管口 2.5 インチ（施設側 ×2、冷却液側 ×2）
    portOD: 64, // 外径 約 64 mm
    panelInch: 7,
    passwordLevels: 4,
    groupMax: 16, // 最大 16 台を 1 組に
  },
  // 中の部品（出典2。位置は仮定）
  parts: {
    hx: 1,
    hxMarginPct: 5,
    pumps: 2,
    tcsFilterUm: [25, 50],
    fwsFilterUm: 500,
    makeupL: 10,
    levelSensors: 3,
    controlValves: 1,
    tempSensors: {tcsSupply: 3, tcsReturn: 1, fwsSupply: 1, fwsReturn: 1},
    pressureSensors: {tcsSupply: 2, tcsReturn: 2},
    flowMeters: 2,
  },
  hxSize: {w: 300, h: 600, d: 250}, // 仮定（寸法は未確認）
  // ポンプ（出典2、3）
  pump: {maxLpm1: 450, bar1: 2.25, maxLpm2: 900, bar2: 1.3, kw1: 4.5, kw2: 9.0, mode: 'N+N', rotateDays: 7},
  // 実際の設計点（出典8、9）。温度は °F の値と、画面で使う ℃（0.1 に丸めた値）
  design: {
    F: {tcsSupply: 104, tcsReturn: 129, fwsSupply: 99, fwsReturn: 117},
    tcs: {supply: 40.0, ret: 53.9},
    fws: {supply: 37.2, ret: 47.2},
    rackKw: 132,
    liquidShare: 0.87,
    rackLiquidKw: 115, // 出典9 の 115 kW と 132 × 87% が合う
    airKw: 17,
    qctMaxLpm: 130,
    qctInMaxC: 45,
    qctOutMaxC: 65,
    storageMin: 5,
    upsKw: 200,
    podRacks: 16,
    podCdus: 3,
    rowRacks: 8, // 検算 4 の「8 本の列」
  },
  // 冷却液の性質（出典11、13、14。PG25 の比熱と密度は仮定）
  fluid: {
    water: {name: '水', cp: 4.18, rho: 1.0, freezeC: 0},
    pg25: {name: 'PG25', cp: 3.95, rho: 1.02, freezeC: -10, sg: [1.03, 1.036], muCold: 2.72, muWarm: 1.15},
  },
  // NVL72 の第7章の計算例（nvl72/refs.md: 120 kW を水で温度差 10 K）
  nvl72: {rackKw: 120, dT: 10},
  // OCP の推奨（出典7）
  ocp: {lpmPerKw: 1.5, atdK: 5, filterTcsUm: [25, 50], filterFwsUm: [150, 250], tempC: [17, 65], dewMarginK: 2},
  // ASHRAE の液冷クラス（施設の水の行きの上限 ℃。出典7 表1、出典12）
  ashrae: [
    ['W17', 17],
    ['W27', 27],
    ['W32', 32],
    ['W40', 40],
    ['W45', 45],
  ],
  // 他社の CDU（幅を見せるため。出典4、5、6、15）
  others: {
    coolit2000: {kw: 2000, lpm: 2125, psi: 35, powerKw: 12.24, atdK: 5, racks: 12},
    nvent800: {kw: 800, powerKw: 22.2, lpm: 1100, tcsL: 100, atdK: 6, reliefBar: 9.0},
    vertiv1350: {kw: 1350, powerKw: 20.5},
    vertiv2300: {kw: 2300, powerKw: 47.8},
    coolit3000: {kw: 3000, lpm: 4500, powerKw: 75},
    motivair: {kw: 2500},
  },
  gb300MaxKw: 142, // room/refs.md
  slider: {dTMin: 5, dTMax: 20}, // 仮定（教材の範囲）
  rowRacks: 5, // 画面の列: CDU 1 台 + ラック 5 本
  headerDropM: 0.3, // 列の上 0.3 m（部屋の 3.25 m から下げた）
  protocols: ['Modbus RTU（RS-485）', 'Modbus TCP', 'SNMP', 'BACnet IP/MSTP', 'Redfish', 'Web', 'NTP'],
};

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const easeInOut = (x) => {
  const u = clamp(x, 0, 1);
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
};
export const ease = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
/** u remapped from [a, b] to 0..1, clamped */
export const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
/** ∫0..t ease(seg(s, a, b)) ds, closed form (the pumps' turned angle under a smooth speed change) */
export const intEase = (t, a, b) => {
  if (t <= a) return 0;
  const w = b - a;
  if (t >= b) return w * 0.5 + (t - b);
  const u = (t - a) / w;
  return w * (u * u * u - (u * u * u * u) / 2);
};

// ------------------------------------------------------------ refs.md 「検算」
const FL = (f, s = SPEC) => s.fluid[f] ?? s.fluid.pg25;
/** °F → ℃ */
export const fToC = (f) => ((f - 32) * 5) / 9;
/** psi → bar */
export const psiToBar = (p) => p * 0.0689476;
/** 質量流量 kg/s = kW ÷ (比熱 × 温度差) */
export const kgPerS = (kw, dT, fluid = 'pg25', s = SPEC) => kw / (FL(fluid, s).cp * dT);
/** 体積流量 L/分 = kW ÷ (比熱 × 密度 × 温度差) × 60 */
export const lpm = (kw, dT, fluid = 'pg25', s = SPEC) => (kw / (FL(fluid, s).cp * FL(fluid, s).rho * dT)) * 60;
/** 運べる熱 kW = L/分 ÷ 60 × 密度 × 比熱 × 温度差 */
export const carryKw = (l, dT, fluid = 'pg25', s = SPEC) => (l / 60) * FL(fluid, s).rho * FL(fluid, s).cp * dT;
/** その流量で運ぶときの温度差 K */
export const dTFor = (kw, l, fluid = 'pg25', s = SPEC) => kw / ((l / 60) * FL(fluid, s).rho * FL(fluid, s).cp);
/** ラック 1 本の流量 L/分（液の熱 115 kW） */
export const rackLpm = (dT = designDT(), fluid = 'pg25', s = SPEC) => lpm(s.design.rackLiquidKw, dT, fluid, s);
/** 冷却液の温度差 13.9 K、施設の水 10.0 K */
export const designDT = (s = SPEC) => Math.round((s.design.tcs.ret - s.design.tcs.supply) * 10) / 10;
export const fwsDT = (s = SPEC) => Math.round((s.design.fws.ret - s.design.fws.supply) * 10) / 10;
/** 比熱の下がり方（5.5%）、質量の流量の倍率（1.058）、体積の流量の倍率（1.0375） */
export const cpDropPct = (s = SPEC) => (1 - s.fluid.pg25.cp / s.fluid.water.cp) * 100;
export const massRatio = (s = SPEC) => s.fluid.water.cp / s.fluid.pg25.cp;
export const volRatio = (s = SPEC) => s.fluid.water.cp / (s.fluid.pg25.cp * s.fluid.pg25.rho);
/** 液の熱 132 kW × 87% = 114.84 kW */
export const rackLiquidExact = (s = SPEC) => s.design.rackKw * s.design.liquidShare;
/** 600 kW の CDU で何本（5.22 → 5） */
export const racksExact = (kw = SPEC.cdu.kw, s = SPEC) => kw / s.design.rackLiquidKw;
export const racksPerCdu = (kw = SPEC.cdu.kw, s = SPEC) => Math.floor(racksExact(kw, s));
/** n 本の列に要る 600 kW 機の台数と、N+1 にした台数 */
export const cdusFor = (n, unitKw = SPEC.cdu.kw, s = SPEC) => Math.ceil((n * rackLiquidExact(s)) / unitKw);
export const cdusN1 = (n, unitKw = SPEC.cdu.kw, s = SPEC) => cdusFor(n, unitKw, s) + 1;
/** RD109 の 1 ポッド: 16 本を動く 2 台で → 1 台あたりの kW */
export const podPerUnitKw = (s = SPEC) => (s.design.podRacks * rackLiquidExact(s)) / (s.design.podCdus - 1);
/** CoolIT の「12 ラック」: 1 本あたり kW、kW で数えた本数、流量で数えた本数 */
export const coolitPerRackKw = (s = SPEC) => s.others.coolit2000.kw / s.others.coolit2000.racks;
export const coolitRacksByKw = (s = SPEC) => s.others.coolit2000.kw / s.design.rackLiquidKw;
export const coolitRacksByFlow = (s = SPEC) => s.others.coolit2000.lpm / rackLpm(designDT(s), 'pg25', s);
/** ポンプの電力は冷やす熱の何 % か */
export const pumpPct = (powerKw, kw) => (powerKw / kw) * 100;
/** ポンプが液に与える力 W = 流量 m³/s × 圧力 Pa、電気との比 */
export const hydraulicW = (l, bar) => (l / 60000) * bar * 1e5;
export const pumpEff = (s = SPEC) => hydraulicW(s.pump.maxLpm1, s.pump.bar1) / (s.pump.kw1 * 1000);
/** 1.5 L/分/kW の流量で 1 kW を運ぶときの温度差 K */
export const dTForLpmPerKw = (lpk = SPEC.ocp.lpmPerKw, fluid = 'pg25', s = SPEC) => 1 / ((lpk / 60) * FL(fluid, s).rho * FL(fluid, s).cp);
/** ポンプ 1 台（450 L/分）で運べる熱 kW */
export const onePumpKw = (dT = designDT(), s = SPEC) => carryKw(s.pump.maxLpm1, dT, 'pg25', s);
/** 熱交換器: 熱い端・冷たい端（ATD）・対数平均温度差 */
export const hotEndK = (s = SPEC) => Math.round((s.design.tcs.ret - s.design.fws.ret) * 10) / 10;
export const atdK = (s = SPEC) => Math.round((s.design.tcs.supply - s.design.fws.supply) * 10) / 10;
export const lmtdK = (s = SPEC) => (hotEndK(s) - atdK(s)) / Math.log(hotEndK(s) / atdK(s));
/**
 * 向かい流れの温度の折れ線: x = 0 が熱い端（冷却液の入口・施設の水の出口）、1 が冷たい端。温度差は 6.7 K から 2.8 K へ
 * 指数で縮み、ここまでに渡した熱の割合 f = (1 − r^x) / (1 − r)（r = 2.8 / 6.7）で両方の温度が決まる
 */
export function hxProfile(x, s = SPEC) {
  const u = clamp(x, 0, 1);
  const r = atdK(s) / hotEndK(s);
  const f = (1 - Math.pow(r, u)) / (1 - r);
  const tcs = s.design.tcs.ret - (s.design.tcs.ret - s.design.tcs.supply) * f;
  const fws = s.design.fws.ret - (s.design.fws.ret - s.design.fws.supply) * f;
  return {tcs, fws, diff: tcs - fws, f};
}
/** 液 L に kW が入り続けたときの温度の上がり方 K/秒 */
export const heatRiseKs = (kw, liters, fluid = 'pg25', s = SPEC) => kw / (liters * FL(fluid, s).rho * FL(fluid, s).cp);
/** 施設の水が止まったときの目安（nVent CDU800 の冷却液 100 L に 800 kW。配管とラックの液を数えない下限） */
export const fwsLossRate = (s = SPEC) => heatRiseKs(s.others.nvent800.kw, s.others.nvent800.tcsL, 'pg25', s);
/** ASHRAE のクラス: 施設の水の行きの温度が入る一番低いクラス */
export const ashraeClass = (c, s = SPEC) => (s.ashrae.find(([, lim]) => c <= lim) ?? ['W+', Infinity])[0];

// ------------------------------------------------------------ scenes (staged time)
export const SCENES = {
  loops: {id: 'loops', name: '2つの輪', sub: '冷却液の輪と施設の水の輪。熱交換器で近づくが混ざらない', dur: 6},
  hx: {id: 'hx', name: '熱交換器の中', sub: '板が交互に冷却液・施設の水の通り道。向かい合って流れる', dur: 6},
  flow: {id: 'flow', name: '流量と温度差', sub: '温度差を動かすとラック 1 本の流量が変わる', dur: 6},
  glycol: {id: 'glycol', name: '水と不凍液', sub: '同じ熱・同じ温度差で、水と PG25 の流量を比べる', dur: 6},
  racks: {id: 'racks', name: '何本冷やせるか', sub: '600 kW の CDU にラックを 1 本ずつつなぐ', dur: 4.4},
  pumps: {id: 'pumps', name: 'ポンプの電力', sub: '2 台同時に回すと 900 L/分・9.0 kW', dur: 6},
  failover: {id: 'failover', name: 'ポンプが止まる', sub: '運転中のポンプが故障 → 待機のポンプが回り出す', dur: 4.5},
  leak: {id: 'leak', name: '漏れ', sub: '継手から 1 滴 → 受け皿のセンサー → 警報', dur: 4.5},
  fwsloss: {id: 'fwsloss', name: '施設の水が止まる', sub: '冷却液の温度が上がる → 蓄熱タンクと UPS', dur: 7},
};
export const SCENE_IDS = Object.keys(SCENES);
export const sceneDuration = (scene) => SCENES[scene].dur;
/** the scenes that run without end (their clock is not wrapped) */
export const ENDLESS = new Set(['loops', 'hx', 'flow', 'glycol', 'pumps']);

/** flow / glycol: the gauge counts up once when the scene starts, then holds the flow of the slider and the liquid */
export const FLOW = {ramp: 0.8};
export function flowAt(t, dT = designDT(), fluid = 'pg25', s = SPEC) {
  const d = clamp(dT, s.slider.dTMin, s.slider.dTMax);
  const k = ease(Math.max(0, t) / FLOW.ramp);
  const full = rackLpm(d, fluid, s);
  return {dT: d, fluid, k, lpm: full * k, full, kgS: kgPerS(s.design.rackLiquidKw, d, fluid, s), speed: full / rackLpm(designDT(s), 'pg25', s)};
}
/** racks: one rack joins every 0.6 s; the fifth fills the 600 kW bar; then the sixth asks for a second CDU */
export const RACKS = {first: 0.3, step: 0.6, ghost: 3.3};
export function racksAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const n = tt < RACKS.first ? 0 : Math.min(s.rowRacks, Math.floor((tt - RACKS.first) / RACKS.step + 1e-9) + 1);
  const kw = n * s.design.rackLiquidKw;
  return {n, kw, fill: kw / s.cdu.kw, ghost: tt >= RACKS.ghost, lpm: n * rackLpm(designDT(s), 'pg25', s)};
}
/** failover: pump A fails, spins down; pump B (standby) spins up; the flow dips and comes back (the dip is staged) */
export const FAIL = {fault: 0.8, aDown: [0.8, 1.6], bUp: [1.2, 2.2], spin: 9};
export function failoverAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const a = 1 - ease(seg(tt, ...FAIL.aDown));
  const b = ease(seg(tt, ...FAIL.bUp));
  const frac = Math.min(1, a + b);
  return {
    fault: tt >= FAIL.fault,
    a,
    b,
    // turned angles (radians) from the closed-form integral of the speeds
    angA: FAIL.spin * (tt - intEase(tt, ...FAIL.aDown)),
    angB: FAIL.spin * intEase(tt, ...FAIL.bUp),
    frac,
    active: b >= 0.5 ? 'B' : 'A',
    lpm: s.pump.maxLpm1 * frac,
    kw: onePumpKw(designDT(s), s) * frac,
  };
}
/** leak: a drop forms at a joint, falls into the drip tray, spreads to the sensor; the alarm, then the two choices */
export const LEAK = {form: [0, 0.5], fall: [0.5, 1.1], spread: [1.1, 2.3], sensor: 2.3, alarm: 2.6, branch: 3.0};
export function leakAt(t) {
  const tt = Math.max(0, t);
  return {
    drop: ease(seg(tt, ...LEAK.form)),
    fall: seg(tt, ...LEAK.fall) ** 2,
    falling: tt >= LEAK.fall[0] && tt < LEAK.fall[1],
    puddle: ease(seg(tt, ...LEAK.spread)),
    sensor: tt >= LEAK.sensor,
    alarm: tt >= LEAK.alarm,
    branch: ease(seg(tt, LEAK.branch, LEAK.branch + 0.5)),
  };
}
/** fwsloss: the facility water stops; the coolant warms at about 2 K/s (目安) for 10 K; storage and UPS bring it back */
export const FWSL = {stop: 0.5, riseK: 10, back: 1.2};
export const fwsRecoverT = (s = SPEC) => FWSL.stop + FWSL.riseK / fwsLossRate(s);
export function fwsAt(t, s = SPEC) {
  const tt = Math.max(0, t);
  const rate = fwsLossRate(s);
  const rec = fwsRecoverT(s);
  const rise = tt < FWSL.stop ? 0 : tt < rec ? (tt - FWSL.stop) * rate : FWSL.riseK * (1 - ease((tt - rec) / FWSL.back));
  const flow = tt < FWSL.stop ? 1 : tt < rec ? 0 : ease(seg(tt, rec, rec + 0.5));
  return {rate, rise, flow, stopped: tt >= FWSL.stop && tt < rec, rescue: tt >= rec, tcsSupply: s.design.tcs.supply + rise, tcsReturn: s.design.tcs.ret + rise, secs: Math.max(0, Math.min(tt, rec) - FWSL.stop)};
}
/** pumps: both turn (two pumps at once for the full 900 L/分) */
export const SPIN = 9; // rad per staged second (made up for the eye)

/** t snapped for reduced motion: beads jump half a second at a time, the sequences from step to step */
export function snapT(scene, t) {
  const tt = Math.max(0, t);
  if (ENDLESS.has(scene)) return Math.floor(tt / 0.5) * 0.5;
  const steps = {
    racks: [0, ...Array.from({length: 5}, (_, i) => RACKS.first + i * RACKS.step), RACKS.ghost],
    failover: [0, FAIL.fault, FAIL.bUp[1]],
    leak: [0, LEAK.fall[0], LEAK.spread[0], LEAK.spread[1], LEAK.alarm, LEAK.branch + 0.5],
    fwsloss: [0, FWSL.stop, FWSL.stop + 2.5, fwsRecoverT(), fwsRecoverT() + FWSL.back],
  }[scene];
  if (!steps) return tt;
  let v = 0;
  for (const x of steps) if (tt >= x) v = x;
  return v;
}

/** every gauge value of a scene at staged t (the console, LIVE.s and the tests read this). opts: {dT, fluid} */
export function gaugesAt(scene, t, opts = {}, s = SPEC) {
  const dT = opts.dT ?? designDT(s);
  const fluid = opts.fluid ?? 'pg25';
  const out = {
    scene,
    dT,
    fluid,
    flowLpm: 0,
    racks: s.rowRacks,
    kw: s.rowRacks * s.design.rackLiquidKw,
    pumpKw: s.pump.kw1,
    pumpPct: pumpPct(s.pump.kw1, s.cdu.kw),
    activePump: 'A',
    pumpA: 1,
    pumpB: 0,
    angA: SPIN * Math.max(0, t),
    angB: 0,
    tcsSupply: s.design.tcs.supply,
    tcsReturn: s.design.tcs.ret,
    fwsSupply: s.design.fws.supply,
    fwsReturn: s.design.fws.ret,
    fwsFlow: 1,
    atd: atdK(s),
    alarm: '',
  };
  if (scene === 'flow' || scene === 'glycol') {
    const f = flowAt(t, dT, fluid, s);
    out.flowLpm = f.lpm;
    out.dT = f.dT;
  }
  if (scene === 'racks') {
    const r = racksAt(t, s);
    Object.assign(out, {racks: r.n, kw: r.kw, flowLpm: r.lpm});
  }
  if (scene === 'pumps') Object.assign(out, {pumpKw: s.pump.kw2, pumpPct: pumpPct(s.pump.kw2, s.cdu.kw), pumpB: 1, angB: SPIN * Math.max(0, t) + 0.5});
  if (scene === 'failover') {
    const f = failoverAt(t, s);
    Object.assign(out, {activePump: f.active, pumpA: f.a, pumpB: f.b, angA: f.angA, angB: f.angB, flowLpm: f.lpm, alarm: f.fault ? 'ポンプ A 故障' : ''});
  }
  if (scene === 'leak') out.alarm = leakAt(t).sensor ? '漏液' : '';
  if (scene === 'fwsloss') {
    const w = fwsAt(t, s);
    Object.assign(out, {tcsSupply: w.tcsSupply, tcsReturn: w.tcsReturn, fwsFlow: w.flow, atd: w.tcsSupply - s.design.fws.supply, alarm: w.stopped ? '施設の水 流量低下' : ''});
  }
  return out;
}

// ------------------------------------------------------------ the door and the tiers (chapter 2)
// Layers: the doors, then the tiers slide forward from the top: 上段（電気盤・補給タンク）, 中段（熱交換器・制御弁）,
// 下段（ポンプ・フィルタ）. Opening: the doors first, then the tiers top first with a stagger. Closing: bottom first.
export const LAYERS = ['doors', 'top', 'mid', 'bot'];
export const EXPLODE = {
  open: {delay: [0, 0.9, 1.1, 1.3], dur: [1.0, 0.9, 0.9, 0.9]},
  close: {delay: [0.6, 0.12, 0.06, 0], dur: [0.9, 0.5, 0.5, 0.5]},
};
/** one layer's value (0..1) at t from presses [{t, to: [4 targets]}]; init = the values before the first press */
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
export function liftsAt(events, t, init = [0, 0, 0, 0], instant = false) {
  const lifts = LAYERS.map((_, k) => layerAt(events, k, t, init[k] ?? 0, instant));
  return {lifts, open: lifts[0]};
}

// ------------------------------------------------------------ chapters (the console reads these)
// lab: refs.md 「実機で見るには」 (the touch panel and the BMS; a CDU has no CLI). net: one line in network words.
export const CHAPTERS = [
  {
    n: 1,
    name: '外観と置き場所',
    text: 'CDU は列の端に立つ冷蔵庫ほどの箱（高さ 2,000 × 幅 600 × 奥行 1,200 mm、満水 550 kg）。ラックへ回る冷却液の輪と、建物の外へ回る施設の水の輪のあいだに立ち、熱だけを受け渡す。600 kW 機 1 台でラック 5 本ぶん。',
    net: '2 つの L2 ドメインをつなぐルーター。フレーム（液）は通さず、中身（熱）だけ渡す。',
    lab: {where: 'タッチパネルのホーム', values: '運転状態（運転・停止・待機）、運転モード、警報の有無、A/B の IP アドレス', design: '運転'},
    subs: [{id: 'row', label: '列の全景'}, {id: 'ports', label: '天井側の配管口'}],
  },
  {
    n: 2,
    name: '扉を開ける',
    text: '前の扉を開けると、上段に電気盤と補給タンク（10 L）、中段に板状の熱交換器と施設側の制御弁、下段にポンプ 2 台とフィルタ、床に漏液の受け皿。部品の数は出典の文章どおり、配置は出典に図が無いので仮定。',
    net: 'ファンや電源を前から抜き差しできるスイッチと同じ: 止めずに 1 台ずつ保守する。',
    lab: {where: '状態画面・診断画面', values: 'ポンプごとの電流・電圧・周波数・電力、総運転時間、フィルタの差圧', design: '—'},
    subs: [{id: 'open', label: '扉を開けて分解'}, {id: 'close', label: '閉じる'}],
  },
  {
    n: 3,
    name: '2つの輪は混ざらない',
    text: '冷却液（TCS）は 40.0 ℃で出て 53.9 ℃で戻る。施設の水（FWS）は 37.2 ℃で入り 47.2 ℃で出る。2 つは熱交換器の板 1 枚をはさんで向かい合って流れ、液は 1 滴も行き来しない。冷たい端で 2.8 K まで近づくので、施設の水はぬるい 37 ℃で足りる。',
    net: 'VLAN 間のルーティング: ブロードキャスト（液）は越えず、必要なもの（熱）だけ越える。',
    lab: {where: 'ホーム', values: 'TCS 行き・戻りの温度、FWS 行き・戻りの温度、冷却弁の開度', design: '40.0 / 53.9 ℃、37.2 / 47.2 ℃'},
    scenes: ['loops', 'hx'],
  },
  {
    n: 4,
    name: '流量 × 温度差',
    text: '運べる熱 ＝ 流量 × 比熱 × 温度差。ラック 1 本の液の熱 115 kW を温度差 13.9 K で運ぶと毎分 123 L。温度差を半分にすると流量は倍。凍らない液（PG25）は比熱が 5.5% 小さく、体積で約 4% 多く流す。600 kW の CDU 1 台でラック 5 本。',
    net: '帯域 ＝ 1 回に運ぶ量 × 回数。1 回の量（温度差）を減らすと回数（流量）が増える。',
    lab: {where: 'ホーム', values: 'TCS 流量、FWS 流量、熱量 kW（戻りの温度から出す目安）', design: '123 L/分・115 kW（1本ぶん）'},
    scenes: ['flow', 'glycol', 'racks'],
  },
  {
    n: 5,
    name: 'ポンプの力',
    text: 'ポンプ 2 台を同時に回すと最大 900 L/分で 9.0 kW。冷やす熱 600 kW の 1.5% で済む（他社も 0.61〜2.8%）。1 台なら 450 L/分・4.5 kW。電気の約 38% が液を押す力になる（計算。メーカーは効率を書いていない）。',
    net: '制御プレーンの負荷に近い: 運ぶ量に比べて小さいが、止まると全部止まる。',
    lab: {where: 'ホーム・状態画面', values: 'ポンプの速さの指令、TCS の差圧、インバータの電力', design: '1台 4.5 kW'},
    scenes: ['pumps'],
  },
  {
    n: 6,
    name: '止まったら',
    text: 'ポンプは 2 台で、ふだんは 1 台が待機（N+N）。ただし 1 台では最大 450 L/分で、温度差 13.9 K なら 420 kW しか運べない。施設の水が止まると液は 1 秒に約 2 K 上がる（目安）。だから待機ポンプ・UPS・5 分の蓄熱・漏液検知（警報か停止）を重ねる。',
    net: 'N+N のポンプ＝HSRP の Active/Standby。待機は帯域（流量）を足さない。',
    lab: {where: '警報画面・BMS', values: '流量・圧力・温度の警報、インバータ故障、漏液、通信断、フィルタの詰まり。補給タンクの水位', design: '—'},
    scenes: ['failover', 'leak', 'fwsloss'],
  },
  {
    n: 7,
    name: '監視する',
    text: 'CDU は CLI を持たない。値は扉の 7 インチのタッチパネルか、ビルの監視（BMS）・DCIM から Modbus / SNMP / BACnet / Redfish で読む。最大 16 台を 1 組にまとめ、1 台が親になって台数と冗長を決める。',
    net: 'BMS は NMS、Modbus・SNMP の読み取りはポーリング。レジスタ番号や OID は機種ごと（未確認）。',
    lab: {where: 'BMS / DCIM', values: '上の値すべて。部屋の温度・湿度・露点。リモートの起動・停止（Modbus・BACnet・SNMP）', design: '—'},
    subs: [{id: 'screen', label: '操作盤の画面'}, {id: 'bms', label: 'BMS へ'}],
  },
];
export const chapterOf = (n) => CHAPTERS[clamp(Math.round(n) - 1, 0, CHAPTERS.length - 1)];
/** refs.md 「次の世代」（第 3 章の計器の下の脚注） */
export const NEXT_GEN = [
  'NVIDIA Rubin: 冷却液の行き 最大 45 ℃、チップを通ると約 55 ℃。100% 液冷でファンなし。冷却液は水 75%＋PG 25%。',
  'CoolIT CHx3000: 3 MW（ATD 3 ℃）、4,500 L/分、50 psi、消費 75 kW、190 kW のラックを 18 本。1.5 L/分/kW・2.5%（計算）。',
  'Motivair MCDU-70: 2.5 MW、6 台を 4+2 で並べて 10 MW（報道）。',
];
export const COOLIT_NOTE = 'CoolIT は 2 MW 機で GB300 を 12 本と数える。数え方は会社ごとに違う';
export const NOTICE =
  '非公式の教材。Vertiv CoolChip CDU を手本にした簡略形状で、各社の製品そのものではない。Vertiv は Vertiv Holdings の商標、CoolIT・nVent・Motivair・NVIDIA・Modbus・BACnet なども各社の商標。数値は refs.md の出典による';
