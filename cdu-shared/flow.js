// Where things are, no three.js (the tests read it in node): the row (the CDU at the left end, 5 racks), the pipes in the
// CDU and over the row, the two loops the beads ride (冷却液 TCS and 施設の水 FWS), the temperature shade of a bead, the
// heat exchanger diagram (chapter 3), the leak's drop, the scene clock and the caption line. Everything is a pure
// function of the scene's staged time; cdu.js, row.js and hx.js only turn these numbers into meshes.
//
// World millimetres: x along the row (right = +), y up from the floor, z front (+) to back (-). The CDU's own numbers
// (CDU-local) have the origin at the middle of its floor; world = local + (0, 0, CDU.z).
import {designDT, ENDLESS, fwsAt, hxProfile, leakAt, racksAt, rackLpm, SCENES, sceneDuration, SPEC} from './kin.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

// ------------------------------------------------------------ polylines
const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
export const pathLength = (pts) => pts.slice(1).reduce((a, p, i) => a + dist(pts[i], p), 0);
/** the point u (0..1) of the way along a polyline, by length */
export function along(pts, u) {
  const lens = pts.slice(1).map((p, i) => dist(pts[i], p));
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
export function sceneClock(scene, since, pre = 0) {
  if (!scene) return 0;
  const s = Math.max(0, since - pre);
  if (ENDLESS.has(scene)) return s;
  return s % (sceneDuration(scene) + HOLD);
}

// ------------------------------------------------------------ the CDU (CDU-local mm)
export const CDU = {
  w: SPEC.cdu.w,
  h: SPEC.cdu.h,
  d: SPEC.cdu.d,
  z: 1068 / 2 - SPEC.cdu.d / 2, // the CDU's front lines up with the racks' front (z = 534)
  wall: 16,
  plinth: 80,
  roof: 16,
  door: {t: 24, y0: 84, y1: 1976, open: 105}, // open angle in degrees
  panel: {x: 150, y: 1520, w: 196, h: 126, dispW: 155, dispH: 87}, // on the left leaf, leaf-local x from the hinge
  tray: {y: 80, t: 16, lip: 30, x: 284, z0: -584, z1: 584},
};
/** CDU-local → world */
export const W = (x, y, z) => [x, y, z + CDU.z];
// ports on the roof (CDU-local x, z): 冷却液 行き・戻り on the right, 施設の水 行き・戻り on the left
export const PORTS = {
  tcsS: [140, -300],
  tcsR: [140, -460],
  fwsS: [-140, -300],
  fwsR: [-140, -460],
  r: SPEC.cdu.portOD / 2,
};
// the heat exchanger (寸法は仮定): x -150..150, y 800..1400, z -125..125; the liquids pass through it 50 mm apart
export const HX = {x0: -SPEC.hxSize.w / 2, x1: SPEC.hxSize.w / 2, y0: 800, y1: 800 + SPEC.hxSize.h, z0: -SPEC.hxSize.d / 2, z1: SPEC.hxSize.d / 2, nozX: 90, inX: 25, plates: 44};
// the pumps: axis along z (前から保守できる向き), side by side; the volute (with the impeller seen through its open front)
// at the front, the motor behind
export const PUMP = {x: [-150, 150], y: 260, voluteR: 120, volute: [150, 228], motorR: 85, motor: [-250, 150], skid: [100, 140], sucOff: 40, topY: 373, z: 190};
export const PIPE_R = 28; // inside the CDU (外径 約 64 mm の配管口から少し細く描く)
// the pipes inside the CDU (CDU-local polylines)
export const PIPES = {
  tcsOut: [[HX.nozX, HX.y0, 0], [HX.nozX, 740, 0], [HX.nozX, 740, -300], [140, 740, -300], [140, 2000, -300]],
  tcsIn: [[140, 2000, -460], [140, 620, -460], [140, 620, 190], [-110, 620, 190]],
  sucA: [[-110, 620, 190], [-110, PUMP.topY, 190]],
  sucB: [[110, 620, 190], [110, PUMP.topY, 190]],
  disA: [[-190, PUMP.topY, 190], [-190, 700, 190], [190, 700, 190]],
  disB: [[190, PUMP.topY, 190], [190, 700, 190]],
  hxIn: [[190, 700, 190], [190, 1480, 190], [190, 1480, 0], [HX.nozX, 1480, 0], [HX.nozX, HX.y1, 0]],
  fwsIn: [[-140, 2000, -300], [-140, 740, -300], [-HX.nozX, 740, -300], [-HX.nozX, 740, 0], [-HX.nozX, HX.y0, 0]],
  fwsOut: [[-HX.nozX, HX.y1, 0], [-HX.nozX, 1480, 0], [-190, 1480, 0], [-190, 1480, -460], [-140, 1480, -460], [-140, 2000, -460]],
};
// the other parts (CDU-local), used by cdu.js and the labels
export const PARTS = {
  elec: {x: [-270, 270], y: [1600, 1950], z: [300, 540]},
  tank: {x: 0, z: -470, r: 95, y: [1560, 1910]}, // π × 0.095² × 0.35 ≈ 9.9 L（10 L）
  filter: {r: 42, y: [440, 570]}, // on each suction pipe
  check: {r: 34, y: [410, 470]}, // on each discharge pipe
  cv: {x: -190, y: 1480, z: -60}, // the facility-side control valve
  fwsFilter: {x: -140, z: -300, r: 50, y: [1650, 1800]}, // 500 µm
  relief: {x: 140, y: 1750, z: -460},
  vent: {x: 140, y: 1900, z: -300},
  sensor: {x: 0, z: 430}, // the leak sensor on the drip tray
};
/** the tiers that slide forward in chapter 2 (mm) */
export const TIER_SHIFT = {top: 940, mid: 760, bot: 330};
// the leak: a joint on the suction header between the pumps → the tray → the sensor
export const LEAK_AT = {joint: [0, 620 - PIPE_R, 190], floor: CDU.tray.y + CDU.tray.t + 1, puddleZ: [200, 360], puddleR: 130};
/** the drop and the puddle at staged t (CDU-local) */
export function leakPose(t) {
  const l = leakAt(t);
  const [x, y0, z] = LEAK_AT.joint;
  const y = y0 - 18 - (y0 - 18 - LEAK_AT.floor - 10) * l.fall;
  return {...l, drop: [x, y, z], dropS: l.puddle > 0 ? 0 : 6 + 6 * l.drop, puddleC: [x, LEAK_AT.floor, LEAK_AT.puddleZ[0] + (LEAK_AT.puddleZ[1] - LEAK_AT.puddleZ[0]) * l.puddle], puddleR: LEAK_AT.puddleR * l.puddle};
}

// ------------------------------------------------------------ the row (world mm)
export const RACK = {w: 600, d: 1068, h: 2236, gap: 20};
/** rack i's centre x (0..4 the row, 5 the ghost that needs a second CDU) */
export const rackX = (i) => CDU.w / 2 + RACK.gap + RACK.w / 2 + i * (RACK.w + RACK.gap);
// the coolant pipes over the row (列の上 約 0.3 m): supply and return headers, and the drop to each rack's manifolds
export const HDR = {sY: 2480, rY: 2620, sZ: W(0, 0, PORTS.tcsS[1])[2], rZ: W(0, 0, PORTS.tcsR[1])[2], jogY: 2400, manZ: -482, manOff: 262, manLo: 300, r: SPEC.cdu.portOD / 2};
// the facility water: up from the roof, along -x into the wall (to the outdoor coolers)
export const FWSP = {sY: 2760, rY: 2860, wallX: -1150};
/** the drops of rack i: supply (header → manifold top) and return (manifold top → header) */
export function rackDrops(i) {
  const xs = rackX(i) - HDR.manOff;
  const xr = rackX(i) + HDR.manOff;
  return {
    supply: [[xs, HDR.sY, HDR.sZ], [xs, HDR.jogY, HDR.sZ], [xs, HDR.jogY, HDR.manZ], [xs, RACK.h, HDR.manZ]],
    ret: [[xr, RACK.h, HDR.manZ], [xr, HDR.jogY, HDR.manZ], [xr, HDR.jogY, HDR.rZ], [xr, HDR.rY, HDR.rZ]],
    xs,
    xr,
  };
}
/** the header and riser polylines over the row (n racks) and the facility water pipes */
export function rowPipes(n = SPEC.rowRacks) {
  const [sx, , sz] = W(PORTS.tcsS[0], 0, PORTS.tcsS[1]);
  const [rx, , rz] = W(PORTS.tcsR[0], 0, PORTS.tcsR[1]);
  const [fsx, , fsz] = W(PORTS.fwsS[0], 0, PORTS.fwsS[1]);
  const [frx, , frz] = W(PORTS.fwsR[0], 0, PORTS.fwsR[1]);
  const last = rackDrops(n - 1);
  return {
    supply: [[sx, CDU.h, sz], [sx, HDR.sY, sz], [last.xs, HDR.sY, sz]],
    ret: [[last.xr, HDR.rY, rz], [rx, HDR.rY, rz], [rx, CDU.h, rz]],
    fwsS: [[FWSP.wallX, FWSP.sY, fsz], [fsx, FWSP.sY, fsz], [fsx, CDU.h, fsz]],
    fwsR: [[frx, CDU.h, frz], [frx, FWSP.rY, frz], [FWSP.wallX, FWSP.rY, frz]],
  };
}

// ------------------------------------------------------------ the two loops the beads ride
const TCS = SPEC.design.tcs;
const FWS = SPEC.design.fws;
/** the heat exchanger's pass for one liquid: down (TCS, hot → cold) or up (FWS, cold → warm), CDU-local, with temps */
function hxPass(kind) {
  const n = 8;
  const x = kind === 'tcs' ? HX.inX : -HX.inX;
  const out = [];
  for (let k = 0; k <= n; k++) {
    // k = 0 is the top (the hot end)
    const y = HX.y1 - 30 - ((HX.y1 - HX.y0 - 60) * k) / n;
    const p = hxProfile(k / n);
    out.push({p: W(x, y, 0), T: kind === 'tcs' ? p.tcs : p.fws});
  }
  return kind === 'tcs' ? out : out.reverse();
}
const vtx = (pts, T) => pts.map((p) => ({p, T}));
const loc = (pts) => pts.map((p) => W(...p));
const pumpRoute = (pump) =>
  pump === 'B'
    ? [[110, 620, 190], [110, PUMP.topY, 190], [PUMP.x[1], PUMP.y, 190], [190, PUMP.topY, 190], [190, 700, 190]]
    : [[-110, 620, 190], [-110, PUMP.topY, 190], [PUMP.x[0], PUMP.y, 190], [-190, PUMP.topY, 190], [-190, 700, 190], [190, 700, 190]];
/** the coolant loop through rack i (closed): HX → supply → rack i → return → pump → HX. Vertices carry the temperature. */
export function tcsLoop(i, pump = 'A') {
  const d = rackDrops(i);
  const rp = rowPipes();
  const v = [
    ...hxPass('tcs'),
    ...vtx(loc([[HX.nozX, HX.y0, 0], ...PIPES.tcsOut.slice(1)]), TCS.supply),
    ...vtx([rp.supply[1], [d.xs, HDR.sY, HDR.sZ], ...d.supply.slice(1), [d.xs, HDR.manLo, HDR.manZ]], TCS.supply),
    // through the rack: the coolant takes the rack's heat
    ...vtx([[d.xr, HDR.manLo, HDR.manZ], ...d.ret, [rp.ret[1][0], HDR.rY, HDR.rZ]], TCS.ret),
    ...vtx(loc([...PIPES.tcsIn.slice(0, 3), ...pumpRoute(pump), ...PIPES.hxIn.slice(1)]), TCS.ret),
  ];
  return makeLoop(v, true);
}
/** the facility water (open: from the wall back into the wall) */
export function fwsLoop() {
  const rp = rowPipes();
  const v = [...vtx([rp.fwsS[0], rp.fwsS[1], ...loc(PIPES.fwsIn)], FWS.supply), ...hxPass('fws'), ...vtx([...loc(PIPES.fwsOut), rp.fwsR[1], rp.fwsR[2]], FWS.ret)];
  return makeLoop(v, false);
}
/** vertices → {pts, T, cum, len}; dropping repeated points */
export function makeLoop(v, closed) {
  const pts = [];
  const T = [];
  for (const q of v) {
    if (pts.length && dist(pts[pts.length - 1], q.p) < 1e-6) {
      T[T.length - 1] = q.T;
      continue;
    }
    pts.push(q.p);
    T.push(q.T);
  }
  if (closed) {
    pts.push(pts[0]);
    T.push(T[0]);
  }
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k - 1], pts[k]));
  return {pts, T, cum, len: cum[cum.length - 1], closed};
}
/** the point s mm along a loop, and its temperature */
export function sampleLoop(L, s) {
  const d = clamp(s, 0, L.len);
  let lo = 0;
  let hi = L.cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (L.cum[m] <= d) lo = m;
    else hi = m;
  }
  const span = L.cum[hi] - L.cum[lo];
  const k = span > 0 ? (d - L.cum[lo]) / span : 0;
  return {p: L.pts[lo].map((v, j) => v + (L.pts[hi][j] - v) * k), T: L.T[lo] + (L.T[hi] - L.T[lo]) * k};
}
export const BEAD = {spacing: 240, speed: 520};
/** beads along a loop at time T (mm/s × k): [{p, T}]; phase shifts the set (racks share the CDU part) */
export function loopBeads(L, T, k = 1, phase = 0) {
  const n = Math.max(1, Math.floor(L.len / BEAD.spacing));
  const step = L.len / n;
  const off = (((T * BEAD.speed * k + phase * step) % L.len) + L.len) % L.len;
  const out = [];
  for (let j = 0; j < n; j++) out.push(sampleLoop(L, (off + j * step) % L.len));
  return out;
}
/** how dark a bead is (0 = the cold supply, 1 = the warm return): the coolant 40.0 → 53.9 ℃, the facility water 37.2 → 47.2 ℃ */
export const shadeOf = (kind, T) => (kind === 'tcs' ? clamp((T - TCS.supply) / (TCS.ret - TCS.supply), 0, 1) : clamp((T - FWS.supply) / (FWS.ret - FWS.supply), 0, 1));
export const COLORS = {tcsS: '#7fcdd2', tcsR: '#0b6f75', fwsS: '#e4e8eb', fwsR: '#3f474c'};

// ------------------------------------------------------------ chapter 3: the heat exchanger diagram (a plate in front of the CDU)
export const HXD = {c: [-260, 1190, 1560], w: 1360, h: 1000, n: 8, chanW: 52, plateW: 10, x0: -610, y0: -380, y1: 380, chartX0: 40, chartW: 520, tMin: 35, tMax: 56};
/** channel k's x centre and its liquid (even = 冷却液, odd = 施設の水) */
export const hxChannel = (k) => ({x: HXD.x0 + HXD.plateW + HXD.chanW / 2 + k * (HXD.chanW + HXD.plateW), kind: k % 2 ? 'fws' : 'tcs'});
/** y on the diagram for a place along the plate (0 = the top = the hot end) */
export const hxY = (x) => HXD.y1 - (HXD.y1 - HXD.y0) * x;
/** x on the chart for a temperature */
export const hxTX = (c) => HXD.chartX0 + ((c - HXD.tMin) / (HXD.tMax - HXD.tMin)) * HXD.chartW;
/** beads in the channels at staged t: the coolant goes down, the facility water up */
export function hxBeads(t, k = 1) {
  const out = [];
  const per = 5;
  for (let c = 0; c < HXD.n; c++) {
    const ch = hxChannel(c);
    for (let j = 0; j < per; j++) {
      const u = (((t * 0.16 * k + j / per + c * 0.07) % 1) + 1) % 1;
      const x = ch.kind === 'tcs' ? u : 1 - u;
      const p = hxProfile(x);
      out.push({x: ch.x, y: hxY(x), kind: ch.kind, T: ch.kind === 'tcs' ? p.tcs : p.fws});
    }
  }
  return out;
}

// ------------------------------------------------------------ the caption line over the 3D view
const fx = (n, d) => Number(n).toFixed(d);
export function captionOf(scene, t, opts = {}) {
  if (!scene) return '';
  switch (scene) {
    case 'loops':
      return '淡い→濃い青緑が冷却液、灰色が施設の水。熱交換器で近づくが、それぞれの輪へ戻る';
    case 'hx':
      return '板 1 枚をはさんで向かい合って流れる。熱い端で 6.7 K、冷たい端で 2.8 K まで近づく';
    case 'flow':
      return `温度差 ${fx(opts.dT ?? designDT(), 1)} K → ラック 1 本に ${Math.round(rackLpm(opts.dT ?? designDT(), opts.fluid ?? 'pg25'))} L/分`;
    case 'glycol':
      return opts.fluid === 'water' ? `水: ${Math.round(rackLpm(opts.dT ?? designDT(), 'water'))} L/分。0 ℃で凍る` : `PG25: ${Math.round(rackLpm(opts.dT ?? designDT(), 'pg25'))} L/分（水の 1.0375 倍）。−10 ℃まで凍らない`;
    case 'racks': {
      const r = racksAt(t);
      return r.ghost ? '5 本で 575 kW。6 本目は 2 台目の CDU が要る' : `ラック ${r.n} 本 = ${r.n * SPEC.design.rackLiquidKw} kW / 600 kW`;
    }
    case 'pumps':
      return '2 台同時に回して 900 L/分・9.0 kW。冷やす熱 600 kW の 1.5%';
    case 'failover': {
      const f = t;
      return f < 0.8 ? 'ポンプ A が運転、B は待機（N+N）' : f < 2.2 ? 'A が故障 → 待機の B が回り出す（流量の下がり方は説明用）' : 'B が運転を引き継いだ。週 1 回の自動の交代でも同じ切り替えをする';
    }
    case 'leak': {
      const l = leakAt(t);
      return !l.sensor ? '継手から 1 滴。受け皿へ落ちる' : !l.alarm ? '受け皿の漏液センサーが反応' : '操作盤に警報。止めるか続けるかは客が設定で選ぶ';
    }
    case 'fwsloss': {
      const w = fwsAt(t);
      return w.stopped ? `施設の水が止まった: 冷却液の行き ${fx(w.tcsSupply, 1)} ℃（1 秒に約 ${fx(w.rate, 1)} K・目安）` : w.rescue ? '蓄熱タンクで 5 分冷やし続け、CDU と施設のポンプは UPS で回り続ける' : '施設の水が熱を屋外へ運んでいる';
    }
    default:
      return '';
  }
}
export {SCENES};
