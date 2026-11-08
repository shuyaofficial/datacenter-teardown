// Where things are, no three.js (the tests read it in node): the rack's slots, the compute tray's parts, the routes of
// the NVLink bead (fan, hop), the ConnectX-7 route out of the rack, the power and the coolant paths, the ring diagram of
// chapter 4, and the caption line. Everything is a pure function of the scene's staged time; rack.js, tray.js and
// overlay.js only turn these numbers into meshes.
//
// World millimetres: x across the front (right = +), y up from the floor, z front (+) to back (-).
import {chipOf, FAN, fanAt, gpuOf, hopAt, HOP_LEGS, OUT, ringAt, SCENES, sceneDuration, seg, sharpAt, SPEC, U_MM} from './kin.js';

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

// ------------------------------------------------------------ the scene clock
/** a chapter press: the scene waits while the camera settles; a scene press starts at once */
export const PRE = 1.4;
/** after a scene ends it holds its last state this long, then starts again */
export const HOLD = 2.4;
/** the scenes that run without end (their clock is not wrapped) */
const ENDLESS = new Set(['out', 'power', 'cool']);
export function sceneClock(scene, since, pre = 0) {
  if (!scene) return 0;
  const s = Math.max(0, since - pre);
  if (ENDLESS.has(scene)) return s;
  return s % (sceneDuration(scene) + HOLD);
}

// ------------------------------------------------------------ the rack
export const RACK = {w: SPEC.rack.w, h: SPEC.rack.h, d: SPEC.rack.d, zf: SPEC.rack.d / 2, zb: -SPEC.rack.d / 2, top: 2186, units: 46, post: 40};
/** a tray in the rack: 440 wide, 1U less a hair, 900 deep, its front 40 mm behind the rack's front */
export const TRAY = {w: 440, h: 42, d: 900, zc: 44, pull: 980, slide: 420};
export const yOfU = (u) => RACK.top - u * U_MM; // the bottom of unit u (1 = the top unit)
/** every slot from the top: kind, number within its kind (1-based), unit, bottom y */
export const SLOTS = (() => {
  const out = [];
  let u = 1;
  const put = (kind, n) => {
    for (let i = 0; i < n; i++) out.push({kind, u: u++});
  };
  put('tor', SPEC.tor);
  put('blank', 3);
  for (const [kind, n] of SPEC.order) put(kind, n);
  while (u <= RACK.units) put('blank', 1);
  const seen = {};
  return out.map((s) => ({...s, n: (seen[s.kind] = (seen[s.kind] || 0) + 1), y0: yOfU(s.u) + 1}));
})();
export const slotOf = (kind, n) => SLOTS.find((s) => s.kind === kind && s.n === n);
/** the bottom y of compute tray n (1..18) and of switch tray n (1..9) */
export const computeY = (n) => slotOf('compute', n).y0;
export const switchY = (n) => slotOf('switch', n).y0;

// the compute tray's parts, tray-local mm: x across, y up from the tray's floor, z front (+450) to back (-450)
export const TL = {
  gpuX: [-158, -58, 58, 158],
  gpuZ: -150,
  gpuS: 76,
  graceX: [-108, 108],
  graceZ: 40,
  graceS: 56,
  board: {w: 206, z0: -400, z1: 150, y: 6},
  chipY: 10, // the packages' top
  plateY: 18, // the cold plates' top
  cx7X: [-190, -150, -110, -70],
  cx7Z: 330,
  bf3X: [-5, 45],
  bf3Z: 320,
  e1sX: [108, 138, 168, 198],
  fanX: Array.from({length: 8}, (_, i) => -175 + i * 50),
  fanZ: 225,
  nvlX: [-165, -95, 95, 165], // the NVLink connectors behind = the 4 cable cartridges
  qdX: [-200, 200], // the liquid quick-connects: supply left, return right
  backZ: -450,
  frontZ: 450,
  // the exploded view: how far each layer rises (mm)
  lift: {lid: 320, plates: 230, chips: 104, io: 44},
};
// the switch tray's NVSwitch chips (tray-local)
export const SL = {chipX: [-110, 110], chipZ: 150, chipS: 70};
// the back: cartridges, bus bar, manifolds (world)
export const BACK = {cartX: TL.nvlX, cartZ: -470, cartW: 52, cartD: 60, busX: 0, busZ: -470, busW: 44, busD: 16, manX: [-262, 262], manZ: -482, manR: 24};
/** world position of a tray-local point of compute tray n, pulled out by pull (0..1) */
export const trayWorld = (n, [x, y, z], pull = 0) => [x, computeY(n) + y, TRAY.zc + z + pull * TRAY.pull];
/** world position of a switch chip c (0..17), the trays slid forward by slide (0..1) */
export const chipWorld = (c, slide = 0) => {
  const {tray, side} = chipOf(c);
  return [SL.chipX[side], switchY(tray) + 22, TRAY.zc + SL.chipZ + slide * TRAY.slide];
};
/** the cartridge a link to chip c runs in: left chips use the left two, right chips the right two */
export const cartOf = (c) => {
  const {tray, side} = chipOf(c);
  return side * 2 + (tray % 2);
};

// ------------------------------------------------------------ NVLink routes
/** GPU g (0..71) up to chip c: out of the back of its tray, into a cartridge, along it to the switch tray, in to the chip */
export function linkPath(g, c, slide = 0, pull = 0) {
  const {tray, gpu} = gpuOf(g);
  const yT = computeY(tray) + 26;
  const {tray: st} = chipOf(c);
  const yS = switchY(st) + 22;
  const cx = BACK.cartX[cartOf(c)];
  const gx = TL.gpuX[gpu - 1];
  const zg = TRAY.zc + TL.gpuZ + pull * TRAY.pull;
  const zBack = TRAY.zc + TL.backZ + 30;
  const zSw = TRAY.zc + TL.backZ + 30 + slide * TRAY.slide;
  const [chx, , chz] = chipWorld(c, slide);
  return [
    [gx, yT, zg],
    [gx, yT, zBack],
    [cx, yT, zBack],
    [cx, yT, BACK.cartZ],
    [cx, yS, BACK.cartZ],
    [cx, yS, zSw],
    [chx, yS, zSw],
    [chx, yS, chz],
  ];
}
/** the hop: GPU a → chip → GPU b, split into the legs of kin.js HOP_LEGS (point lists) */
export function hopLegs(a, b, c, slide = 0) {
  const A = linkPath(a, c, slide);
  const B = [...linkPath(b, c, slide)].reverse();
  return {
    gpu: [A[0], A[0]],
    back: A.slice(0, 4),
    down: A.slice(3, 5),
    tochip: A.slice(4),
    chip: [A[7], A[7]],
    fromchip: B.slice(0, 4),
    down2: B.slice(3, 5),
    in: B.slice(4),
    arrive: [B[7], B[7]],
  };
}
/** the hop bead's world position at staged t, and how much of the route is drawn behind it (0..1 per half) */
export function hopPose(t, slide = 0) {
  const h = hopAt(t);
  const legs = hopLegs(h.a, h.b, h.chip, slide);
  const p = along(legs[h.leg], ease(h.u));
  const i = h.legIndex;
  const iChip = HOP_LEGS.findIndex((l) => l.id === 'chip');
  return {...h, p, legs, firstDone: i >= iChip, secondShown: i > iChip};
}
/** fan: GPU 1 of tray 3 to each of the 18 chips; k = how much of each line is drawn */
export function fanPose(t, slide = 0) {
  const f = fanAt(t);
  return {...f, paths: f.links.map((k, c) => ({c, k, pts: linkPath(f.from, c, slide)}))};
}

// ------------------------------------------------------------ chapter 5: out of the rack
/** the outside switch (an InfiniBand leaf, drawn as a box in front of the rack) */
export const IB = {at: [-780, 2100, 1480], w: 300, h: 60, d: 220};
/** GPU 1 → ConnectX-7 1 → OSFP 1 → the cable → the IB switch (tray pulled by pull) */
export function outPath(pull = 1) {
  const n = SPEC.demo.pullTray;
  const W = (x, y, z) => trayWorld(n, [x, y, z], pull);
  const [ox, oy, oz] = W(TL.cx7X[0], 22, TL.frontZ + 4);
  return [W(TL.gpuX[0], 24, TL.gpuZ), W(TL.gpuX[0], 24, TL.cx7Z - 60), W(TL.cx7X[0], 24, TL.cx7Z - 60), W(TL.cx7X[0], 22, TL.cx7Z), [ox, oy, oz], [ox, oy, oz + 120], [IB.at[0] + 60, oy + 80, oz + 120], [IB.at[0] + 60, IB.at[1] - IB.h / 2, IB.at[2]]];
}
/** GPU 1 → its NVLink connector at the back of the pulled tray */
export function nvlStubPath(pull = 1) {
  const n = SPEC.demo.pullTray;
  const W = (x, y, z) => trayWorld(n, [x, y, z], pull);
  return [W(TL.gpuX[0], 24, TL.gpuZ), W(TL.gpuX[0], 24, TL.backZ + 40), W(TL.nvlX[0], 24, TL.backZ + 40), W(TL.nvlX[0], 24, TL.backZ - 4)];
}
/** beads on both: [{u}] along each path at staged t; the NVLink side carries ratio times as many */
export function outBeads(t) {
  const per = 1 / OUT.perSecOut;
  const outs = [];
  for (let k = Math.floor((t - OUT.travelOut) / per); k <= Math.floor(t / per); k++) {
    const s = t - k * per;
    if (s >= 0 && s <= OUT.travelOut) outs.push({k, u: s / OUT.travelOut});
  }
  const ratio = Math.round(SPEC.nvlink.gpuTBs * 1000 / ((SPEC.cx7Gbps * 2) / 8));
  const perIn = per / ratio;
  const ins = [];
  for (let k = Math.floor((t - OUT.travelIn) / perIn); k <= Math.floor(t / perIn); k++) {
    const s = t - k * perIn;
    if (s >= 0 && s <= OUT.travelIn) ins.push({k, u: s / OUT.travelIn});
  }
  return {outs, ins, ratio};
}

// ------------------------------------------------------------ chapter 6 and 7: dashes along paths
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

/** the bus bar and the power paths: shelves → bus (down from the top four, up from the bottom four) → every tray */
export function powerPaths() {
  const shelves = SLOTS.filter((s) => s.kind === 'power');
  const trays = SLOTS.filter((s) => s.kind === 'compute' || s.kind === 'switch' || s.kind === 'tor');
  const yTop = Math.min(...shelves.filter((s) => s.n <= 4).map((s) => s.y0));
  const yBot = Math.max(...shelves.filter((s) => s.n > 4).map((s) => s.y0 + U_MM));
  const yMid = (computeY(10) + switchY(9)) / 2;
  const z = BACK.busZ;
  const zIn = TRAY.zc + TL.backZ - 2;
  return {
    feeds: shelves.map((s) => [[BACK.busX, s.y0 + 22, -300], [BACK.busX, s.y0 + 22, z + BACK.busD / 2]]),
    busDown: [[BACK.busX, yTop, z + BACK.busD / 2 + 2], [BACK.busX, yMid, z + BACK.busD / 2 + 2]],
    busUp: [[BACK.busX, yBot, z + BACK.busD / 2 + 2], [BACK.busX, yMid, z + BACK.busD / 2 + 2]],
    stubs: trays.filter((s) => s.kind !== 'tor').map((s) => [[BACK.busX - 8, s.y0 + 21, z], [BACK.busX - 8, s.y0 + 21, zIn]]),
  };
}
/** the coolant: up the supply manifold (left), into every liquid-cooled tray, out to the return (right), down */
export function coolPaths() {
  const trays = SLOTS.filter((s) => s.kind === 'compute' || s.kind === 'switch');
  const ys = trays.map((s) => s.y0 + 21);
  const [xl, xr] = BACK.manX;
  const z = BACK.manZ;
  const zIn = TRAY.zc + TL.backZ - 2;
  const lo = Math.min(...ys) - 160;
  const hi = Math.max(...ys) + 60;
  const n = SPEC.demo.pullTray;
  const W = (x, zz) => [x, computeY(n) + 24, TRAY.zc + zz];
  return {
    supply: [[xl, 0, z], [xl, hi, z]],
    ret: [[xr, hi, z], [xr, 0, z]],
    lo,
    supplyIn: ys.map((y) => [[xl, y, z], [TL.qdX[0], y, z], [TL.qdX[0], y, zIn]]),
    retOut: ys.map((y) => [[TL.qdX[1], y, zIn], [TL.qdX[1], y, z], [xr, y, z]]),
    // inside tray 3: the loop over the cold plates (drawn over the tray, it is hidden inside)
    loop: [
      W(TL.qdX[0], TL.backZ),
      W(TL.qdX[0], TL.gpuZ - 70),
      W(TL.gpuX[0], TL.gpuZ - 70),
      W(TL.gpuX[0], TL.gpuZ),
      W(TL.gpuX[1], TL.gpuZ),
      W(TL.graceX[0], TL.graceZ),
      W(TL.graceX[1], TL.graceZ),
      W(TL.gpuX[2], TL.gpuZ),
      W(TL.gpuX[3], TL.gpuZ),
      W(TL.gpuX[3], TL.gpuZ - 70),
      W(TL.qdX[1], TL.gpuZ - 70),
      W(TL.qdX[1], TL.backZ),
    ],
  };
}

// ------------------------------------------------------------ chapter 4: the ring diagram (a plate beside the rack)
export const RING = {c: [-1240, 1250, 520], r: 600, gpuS: 34, hubS: 220, bead: 22, track: 548};
/** GPU i's place on the ring: [x, y] relative to the centre, clockwise from the top */
export const ringXY = (i, r = RING.r) => {
  const a = Math.PI / 2 - (i / SPEC.allreduce.gpus) * Math.PI * 2;
  return [r * Math.cos(a), r * Math.sin(a)];
};
/** the ring's beads at staged t: each GPU's chunk moves one place per step, 2 (N−1) steps in all */
export function ringBeads(t) {
  const r = ringAt(t);
  const N = SPEC.allreduce.gpus;
  const pos = r.u * r.steps;
  return Array.from({length: N}, (_, i) => {
    const [x, y] = ringXY((i + pos) % N, RING.track);
    return {i, x, y, gather: r.phase === 'gather'};
  });
}
/** SHARP's beads at staged t: rf = how far out (1 = at the GPU, 0 = at the hub) */
export function sharpBeads(t) {
  const s = sharpAt(t);
  const N = SPEC.allreduce.gpus;
  const out = [];
  const hubR = RING.hubS * 0.62;
  for (let i = 0; i < N; i++) {
    const [ux, uy] = ringXY(i, 1);
    if (s.phase === 'up') {
      const rf = RING.track - (RING.track - hubR) * ease(s.up);
      out.push({i, x: ux * rf, y: uy * rf, back: false});
    } else if (s.phase === 'down') {
      const rf = hubR + (RING.track - hubR) * ease(s.down);
      out.push({i, x: ux * rf, y: uy * rf, back: true});
    }
  }
  return {beads: out, phase: s.phase, hubK: s.phase === 'sum' ? 1 : s.phase === 'up' ? seg(s.up, 0.85, 1) : s.phase === 'down' ? 1 - seg(s.down, 0, 0.3) : 0};
}

// ------------------------------------------------------------ the caption line over the 3D view
const fx = (n, d) => Number(n).toFixed(d);
export function captionOf(scene, t, opts = {}) {
  if (!scene) return '';
  const S = SPEC;
  switch (scene) {
    case 'fan': {
      const f = fanAt(t);
      return f.lit < 18 ? `GPU 1 個から 18 本のリンクが 18 個のスイッチチップへ（${f.lit} / 18）` : '18 本すべてが別々のチップへ。どのチップも 72 個の GPU に 1 本ずつ';
    }
    case 'hop': {
      const h = hopAt(t);
      const c = chipOf(h.chip);
      if (h.leg === 'chip') return `スイッチトレイ ${c.tray} の NVSwitch（${c.side ? '右' : '左'}）が出口のポートを選ぶ。通ったスイッチは 1 個`;
      if (h.done || h.leg === 'arrive') return 'トレイ 15 の GPU 3 に届いた。どの組でもスイッチ 1 段';
      return h.ja;
    }
    case 'ring': {
      const r = ringAt(t);
      return r.done ? `リング: GPU 1 個が ${fx(r.sentGB, 3)} GB 送った（${r.steps} 回に分けて隣へ）` : r.phase === 'reduce' ? '前半: 隣へ渡しながら足していく（1/72 ずつ）' : '後半: 足し終わった分を輪に配る';
    }
    case 'sharp': {
      const s = sharpAt(t);
      if (s.phase === 'up') return '全員が 1 GB をスイッチへ送る';
      if (s.phase === 'sum') return 'NVSwitch の中で 72 個分を足す（SHARP）';
      return 'スイッチが合計を 1 回で全員に返す。送ったのは 1 GB だけ';
    }
    case 'out':
      return `同じ時間に運べる量: NVLink は ConnectX-7 の ${Math.round((S.nvlink.gpuTBs * 1000) / ((S.cx7Gbps * 2) / 8))} 倍`;
    case 'power':
      return `電源棚 8 台 → 母線（直流 ${S.power.busV} V）→ 各トレイ`;
    case 'cool':
      return `行き（淡い線）はマニホールドから各トレイへ、帰り（濃い線）は温まって戻る。温度差 ${fx(opts.dT ?? S.cool.dTDefault, 0)} K`;
    default:
      return '';
  }
}
export {SCENES, FAN};
