// Where things are, no three.js (the tests read it in node): the chassis' parts (BOX), the 1 SU fat tree diagram (FAB)
// with the SM's trips, the look-up's route and the AR beads, the three lanes of chapter 4 (LANES), the ring plate of
// chapter 6 (RING), the wind of chapter 7, and the caption line. Everything is a pure function of the scene's staged
// time; box.js, board.js, fabric.js, lanes.js and ring.js only turn these numbers into meshes.
//
// Millimetres. The chassis sits at the origin: x across the front (right = +), y up from the floor, z front (+) to back
// (-). The diagrams stand in their own places on the same floor, far enough apart that one never shows behind another.
import {airAt, arAt, catFloodAt, creditAt, dropAt, fattreeAt, LOOKUP, lookupAt, pfcAt, ringAt, SCENES, sceneDuration, sharpAt, SPEC, SWEEP_ORDER, sweepAt} from './kin.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
const fx = (n, d) => Number(n).toFixed(d);
const fmt = (n) => Math.round(n).toLocaleString('en-US');

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
/** dashes along a path at time T: [{a, b}]; speed 0 stops them (reduced motion) */
export function dashes(pts, T, speed, dash = 40, gap = 46) {
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

// ------------------------------------------------------------ the scene clock
/** a chapter press: the scene waits while the camera settles; a scene press starts at once */
export const PRE = 1.4;
/** after a scene ends it holds its last state this long, then starts again */
export const HOLD = 2.4;
const ENDLESS = new Set(['drop', 'credit', 'pfc', 'ar', 'air']);
export function sceneClock(scene, since, pre = 0) {
  if (!scene) return 0;
  const s = Math.max(0, since - pre);
  if (ENDLESS.has(scene)) return s;
  return s % (sceneDuration(scene) + HOLD);
}

// ------------------------------------------------------------ the chassis (box.js, board.js)
const W2 = SPEC.chassis.w / 2;
const H = SPEC.chassis.h;
const ZF = SPEC.chassis.d / 2;
export const BOX = (() => {
  const {sections, rows, cols} = SPEC.cageLayout;
  const x0 = -W2 + 47; // the management column takes the left 47 mm
  const x1 = W2 - 4;
  const gap = 8;
  const pitch = (x1 - x0 - gap * (sections - 1)) / (sections * cols);
  const cageX = [];
  for (let s = 0; s < sections; s++) for (let c = 0; c < cols; c++) cageX.push(x0 + s * (cols * pitch + gap) + (c + 0.5) * pitch);
  const rowY = Array.from({length: rows}, (_, r) => 36 + r * 35);
  return {
    w2: W2,
    h: H,
    zf: ZF,
    zb: -ZF,
    ear: (SPEC.rackW - SPEC.chassis.w) / 2,
    pitch,
    cageX, // 18 columns
    rowY, // 4 rows
    cage: {w: pitch - 1.4, h: 17, d: 96},
    mouth: {w: pitch - 4.2, h: 10.5},
    // the management column (left): LED, the UFM port (set apart), RJ-45 × 2, USB, reset
    mgX: -W2 + 22,
    ufmY: 132,
    rjY: [92, 70],
    usbY: 51,
    resetY: 38,
    ledY: 160,
    // the back: 4 + 4 power supplies in the side columns, 5 × 2 fans between them (仮定)
    psuX: [-W2 + 39, W2 - 39],
    psuW: 70,
    psuH: 41,
    psuY: [26, 68, 110, 152],
    psuD: 210,
    fanX: Array.from({length: 5}, (_, i) => -113.2 + i * 56.6),
    fanY: [52, 126],
    fanS: 54,
    fanD: 46,
    // inside: 4 chips 2 × 2 (仮定), the management CPU board at the front left, the board
    chipX: [-88, 88],
    chipZ: [150, -40],
    chipS: 62,
    sinkS: 112,
    sinkH: 78,
    boardY: 10,
    cpu: {x0: -W2 + 6, x1: -W2 + 66, z0: 170, z1: 318},
    // the exploded view: how far each layer rises (mm)
    lift: {lid: 330, lidBack: 330, heat: 190, cpu: 120, rear: 70},
  };
})();
/** the four bundles from the chips to the cages' backs (one per chip; the lanes inside are not public) */
export const bundlePaths = () => {
  const zc = ZF - BOX.cage.d - 6;
  const ends = [-150, -52, 52, 150];
  const out = [];
  BOX.chipZ.forEach((z, j) => BOX.chipX.forEach((x, i) => {
    const k = j * 2 + i;
    const ex = ends[[1, 2, 0, 3][k]];
    const y = BOX.boardY + 6 + j * 5;
    out.push([[x, y, z + (j ? BOX.sinkS / 2 : BOX.sinkS / 2) + 4], [x, y, zc - 40 - j * 18], [ex, y, zc - 20], [ex, y, zc]]);
  }));
  return out;
};
/** the wind through the chassis: lanes from the front grille over the sinks to the fans (chapter 7) */
export const windPaths = () => {
  const out = [];
  for (const y of [48, 100, 150]) for (const x of [-140, -50, 40, 130]) {
    const xb = clamp(x, -115, 115);
    out.push([[x, y, ZF + 80], [x, y, ZF - BOX.cage.d - 10], [x * 0.95, y, -100], [xb, y, -ZF + BOX.fanD + 10], [xb, y, -ZF - 140]]);
  }
  return out;
};

// ------------------------------------------------------------ the 1 SU fat tree diagram (fabric.js), local mm
export const FAB = {
  at: [6000, 0, 0],
  rs: 0.25, // racks: the NVL72's 600 × 2,236 × 1,068 scaled
  qs: 0.5, // switches: the Q3400's box scaled
  rackPitch: 250,
  leafY: 1000,
  spineY: 1500,
  spinePitch: 500,
  ufm: [-1200, 1500, 0],
  cat: {x: -1500, y: 500, hostY: 150},
};
export const rackBox = () => ({w: SPEC.nvl.rack.w * FAB.rs, h: SPEC.nvl.rack.h * FAB.rs, d: SPEC.nvl.rack.d * FAB.rs});
export const swBox = () => ({w: SPEC.chassis.w * FAB.qs, h: SPEC.chassis.h * FAB.qs, d: SPEC.chassis.d * FAB.qs});
export const rackX = (r) => (r - 3.5) * FAB.rackPitch;
export const leafX = (l) => (l - 3.5) * FAB.rackPitch;
export const spineX = (k) => (k - 1.5) * FAB.spinePitch;
/** the centre of a switch by id */
export const swPos = (id) => (id[0] === 'L' ? [leafX(Number(id.slice(1))), FAB.leafY, 0] : [spineX(Number(id.slice(1))), FAB.spineY, 0]);
/** the cables: rack r → the 4 leaves of its half (18 links each); leaf → every spine (18 links each) */
export const downLinks = () => {
  const out = [];
  for (let r = 0; r < 8; r++) for (let k = 0; k < 4; k++) out.push({rack: r, leaf: (r < 4 ? 0 : 4) + k, links: SPEC.nvl.trays});
  return out;
};
export const upLinks = () => {
  const out = [];
  for (let l = 0; l < 8; l++) for (let k = 0; k < 4; k++) out.push({leaf: l, spine: k, links: SPEC.ports / 2 / 4});
  return out;
};
const sh = () => swBox().h / 2;
/** the line of a down cable: from the rack's top to the leaf's bottom (spread a little along the box) */
export const downLine = (d) => {
  const rb = rackBox();
  const sp = d.leaf % 4;
  return [[rackX(d.rack) - 45 + sp * 30, rb.h, 0], [leafX(d.leaf) - 60 + (d.rack % 4) * 40, FAB.leafY - sh(), 0]];
};
export const upLine = (u) => [[leafX(u.leaf) - 60 + u.spine * 40, FAB.leafY + sh(), 0], [spineX(u.spine) - 90 + u.leaf * 25.7, FAB.spineY - sh(), 0]];
export const ufmLine = () => [[FAB.ufm[0] + 110, FAB.ufm[1], 0], [leafX(0) - 110, FAB.ufm[1], 0], [leafX(0) - 110, FAB.leafY + sh() * 0.4, 0]];
/** the SM's trip to switch i of SWEEP_ORDER: out of the UFM, along the cables (up through L0 for a spine, down again for a leaf) */
export function sweepPath(id) {
  const u = ufmLine();
  const l0 = swPos('L0');
  if (id === 'L0') return [...u, l0];
  const k = id[0] === 'S' ? Number(id.slice(1)) : (Number(id.slice(1)) * 3) % 4;
  const up = upLine({leaf: 0, spine: k});
  const sp = swPos(`S${k}`);
  if (id[0] === 'S') return [...u, l0, up[0], up[1], sp];
  const l = Number(id.slice(1));
  const dn = upLine({leaf: l, spine: k});
  return [...u, l0, up[0], up[1], sp, dn[1], dn[0], swPos(id)];
}
export function sweepPose(t) {
  const s = sweepAt(t);
  if (s.at < 0) return {...s, p: null, path: null};
  const path = sweepPath(s.id);
  return {...s, path, p: s.trip < 1 ? along(path, ease(s.trip)) : null};
}
/** the look-up's route: the GPU's port on its rack → leaf A → spine → leaf B → the GPU on rack 7 */
export function lookupPath() {
  const a = LOOKUP.from;
  const b = LOOKUP.to;
  const r = lookupAt(0).route.switches;
  const rb = rackBox();
  const dA = downLine({rack: a.rack, leaf: Number(r[0].slice(1))});
  const uA = upLine({leaf: Number(r[0].slice(1)), spine: Number(r[1].slice(1))});
  const uB = upLine({leaf: Number(r[2].slice(1)), spine: Number(r[1].slice(1))});
  const dB = downLine({rack: b.rack, leaf: Number(r[2].slice(1))});
  const ga = [rackX(a.rack), rb.h * 0.62, rb.d / 2 + 4];
  const gb = [rackX(b.rack), rb.h * 0.62, rb.d / 2 + 4];
  // legs: 0 up to leaf A, 1 at A, 2 to the spine, 3 at the spine, 4 to leaf B, 5 at B, 6 down to the GPU
  return [
    [ga, [ga[0], dA[0][1], 0], dA[0], dA[1], swPos(r[0])],
    [swPos(r[0]), swPos(r[0])],
    [swPos(r[0]), uA[0], uA[1], swPos(r[1])],
    [swPos(r[1]), swPos(r[1])],
    [swPos(r[1]), uB[1], uB[0], swPos(r[2])],
    [swPos(r[2]), swPos(r[2])],
    [swPos(r[2]), dB[1], dB[0], [gb[0], dB[0][1], 0], gb],
  ];
}
export function lookupPose(t) {
  const l = lookupAt(t);
  const legs = lookupPath();
  return {...l, legs, p: along(legs[l.leg], ease(l.u))};
}
/** the Catalyst beside it: hosts under it; the frame comes from host 0, floods to 1-3, host 2 answers */
export const catHostX = (i) => FAB.cat.x + (i - 1.5) * 105;
export function catFloodPose(t) {
  const f = catFloodAt(t);
  const top = FAB.cat.y - 11;
  const line = (i) => [[catHostX(i), FAB.cat.hostY + 30, 0], [catHostX(i), top, 0]];
  const beads = [];
  if (f.phase === 'in') beads.push({p: along(line(0), ease(f.in)), kind: 'in'});
  if (f.phase === 'flood') for (const i of [1, 2, 3]) beads.push({p: along([...line(i)].reverse(), ease(f.flood)), kind: 'flood'});
  if (f.phase === 'reply') beads.push({p: along(line(2), ease(f.reply)), kind: 'reply'});
  return {...f, beads, lines: [0, 1, 2, 3].map(line)};
}
/** AR: the beads from leaf 0 up its 4 exits */
export function arPose(t) {
  const a = arAt(t);
  return {...a, beads: a.beads.map((b) => ({...b, p: along(upLine({leaf: 0, spine: b.exit}), b.u)}))};
}

// ------------------------------------------------------------ chapter 4: the three lanes (lanes.js), local mm
export const LANES = {
  at: [-6000, 0, 0],
  y: {cat: 1700, ib: 1150, pfc: 600},
  senderX: -700,
  inX: -440, // where the wires enter the switch
  outX: 200,
  rxX: 520,
  dy: 95, // the two inputs above and below the lane's centre
  slot: 46, // one packet's slot in a buffer (8 × 8 blocks of 64 B)
};
export const laneOf = (scene) => (scene === 'drop' ? 'cat' : scene === 'credit' ? 'ib' : 'pfc');
/** the input wire of lane k (cat / ib / pfc), input i (0 top, 1 bottom) */
export const inWire = (k, i) => {
  const y = LANES.y[k] + (i ? -LANES.dy : LANES.dy);
  return [[LANES.senderX + 70, y, 0], [LANES.inX, y, 0]];
};
export const outWire = (k) => [[LANES.outX, LANES.y[k], 0], [LANES.rxX - 70, LANES.y[k], 0]];
/** visual beads on a steady stream (rate per second, travel seconds) at staged t; phase shifts one stream from another */
export const stream = (t, perSec, travel, phase = 0) => {
  const per = 1 / perSec;
  const out = [];
  for (let k = Math.floor((t - travel - phase) / per); k <= Math.floor((t - phase) / per); k++) {
    const u = (t - phase - k * per) / travel;
    if (u >= 0 && u <= 1 && k >= 0) out.push({k, u});
  }
  return out;
};
/** the Catalyst lane: beads in on both wires, out on one; after the queue is full the extra falls off its top */
export function catLanePose(t) {
  const d = dropAt(t);
  const ins = [0, 1].map((i) => stream(t, 2.5, 0.7, i * 0.2).map((b) => along(inWire('cat', i), b.u)));
  const outs = stream(t, 2.5, 0.8, 0.9).map((b) => along(outWire('cat'), b.u));
  // a falling bead for every second arriving bead once full (the counter uses the real numbers)
  const tFull = d.tFullMs / SPEC.cat.congestMsPerSec;
  const falls = stream(t, 2.5, 0.9, tFull).map((b) => ({u: b.u}));
  return {...d, ins, outs, falls};
}

// ------------------------------------------------------------ chapter 6: the ring plate (ring.js), local mm
export const RING = {at: [12000, 0, 0], cy: 950, r: 800, tick: 690, track: 640, leafR: 360, spineR: 130};
export const ringXY = (i, r, n = SPEC.allreduce.gpus) => {
  const a = Math.PI / 2 - (i / n) * Math.PI * 2;
  return [r * Math.cos(a), r * Math.sin(a)];
};
/** leaf l sits at the middle of its 72 GPUs on the ring; spine k at a small square in the middle */
export const ringLeafXY = (l) => ringXY(l * 72 + 36, RING.leafR);
export const ringSpineXY = (k) => [[-1, 1], [1, 1], [-1, -1], [1, -1]][k].map((v) => v * RING.spineR * 0.7);
/** ring beads: each GPU's chunk moves one place per step */
export function ringBeads(t) {
  const r = ringAt(t);
  const N = SPEC.allreduce.gpus;
  const pos = r.u * r.steps;
  return Array.from({length: N}, (_, i) => {
    const [x, y] = ringXY((i + pos) % N, RING.track);
    return {i, x, y, gather: r.phase === 'gather'};
  });
}
/** SHARP beads: GPU → leaf (ink), leaf → spine (ink, summed), spine → leaf → GPU (accent) */
export function sharpBeads(t) {
  const s = sharpAt(t);
  const N = SPEC.allreduce.gpus;
  const out = [];
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  const g = (i) => ringXY(i, RING.track);
  const lf = (i) => ringLeafXY(Math.floor(i / 72));
  if (s.phase === 'up') for (let i = 0; i < N; i++) out.push({p: mix(g(i), lf(i), ease(s.up)), back: false});
  if (s.phase === 'spine') for (let l = 0; l < 8; l++) for (let k = 0; k < 4; k++) out.push({p: mix(ringLeafXY(l), ringSpineXY(k), ease(s.spine)), back: false});
  if (s.phase === 'down') {
    const k = ease(s.down);
    for (let i = 0; i < N; i++) {
      const sp = ringSpineXY(Math.floor(i / 72) % 4);
      out.push({p: k < 0.4 ? mix(sp, lf(i), k / 0.4) : mix(lf(i), g(i), (k - 0.4) / 0.6), back: true});
    }
  }
  return {beads: out, phase: s.phase, leafK: s.phase === 'leaf' ? 1 : s.phase === 'up' ? clamp((s.up - 0.85) / 0.15, 0, 1) : 0, spineK: s.phase === 'spine' ? clamp((s.spine - 0.7) / 0.3, 0, 1) : 0};
}

// ------------------------------------------------------------ the caption line over the 3D view
export function captionOf(scene, t) {
  if (!scene) return '';
  switch (scene) {
    case 'sweep': {
      const s = sweepAt(t);
      if (s.at < 0) return 'UFM の SM が見回りを始める';
      if (s.done) return `${SWEEP_ORDER.length} 台すべての LFT を書いた。以後も ${SPEC.sm.sweepS} 秒ごとに見回る`;
      return s.trip < 1 ? `SM が ${s.id[0] === 'L' ? 'リーフ' : 'スパイン'} ${Number(s.id.slice(1)) + 1} を訪ねて LID を配る` : `LID ${s.per[SWEEP_ORDER.indexOf(s.id)].lid} のスイッチに LFT を 1 行ずつ書き込む（${s.swept} / ${SWEEP_ORDER.length} 台）`;
    }
    case 'lookup': {
      const l = lookupAt(t);
      if (l.at) return `${l.at[0] === 'L' ? 'リーフ' : 'スパイン'} ${Number(l.at.slice(1)) + 1}: 宛先 LID ${l.dst} の行を引いて、出口 ${l.rows[[0, 0, 0, 1, 1, 2, 2][l.leg]].port} へ`;
      if (l.done) return '届いた。どのスイッチも覚えずに表を引くだけ（スパインを通って 3 段）';
      return `宛先 LID ${l.dst} の札を付けたパケット`;
    }
    case 'drop': {
      const d = dropAt(t);
      return d.full ? `Catalyst: Q1 が満杯（${fmt(d.limit)} B）。あふれた分を末尾で捨てる（${fmt(d.drops)} 個）` : `Catalyst: 2 本 × 1 Gbps が 1 本へ。Q1 が溜まっていく（${fx(d.ms, 2)} ms）`;
    }
    case 'credit': {
      const c = creditAt(t);
      if (t < 0.7) return '受け手が先に「あと 4 パケット（256 クレジット）受け取れる」と知らせる';
      return c.waiting ? `クレジット ${c.credits}: 64 に足りないので送り手が待つ。捨てた数 0` : `クレジット ${c.credits}: 1 パケット 64 クレジットを使って送る`;
    }
    case 'pfc': {
      const p = pfcAt(t);
      if (p.msgs.some((m) => m.on)) return '溢れそうになって「止まれ」を送った。届くまでの間も粒は来る';
      if (p.paused) return p.over ? `止まるまでに線の上にいた粒が余裕の升目に入った（${p.over} 個）` : '止まっている。下がったら「再開」を送る';
      return '空きがあるうちは送り手は何も知らずに送り続ける';
    }
    case 'fattree': {
      const f = fattreeAt(t);
      return f.k > 0 ? 'リーフ 1: 下り 72 本（ラック 4 本 × 18）と上り 72 本（スパイン 4 台 × 18）が同じ太さ' : 'ラック 8 本（576 GPU）→ リーフ 8 台 → スパイン 4 台';
    }
    case 'ar': {
      const a = arAt(t);
      return a.picked ? '出口 2 が混んでいる。リーフはその場で空いた 3 本に分ける' : 'リーフ 1 から上への出口は 4 本（同じ距離）';
    }
    case 'ring': {
      const r = ringAt(t);
      return r.done ? `リング: GPU 1 個が ${fx(r.sentGB, 4)} GB 送った（${fmt(r.steps)} 回に分けて隣へ）` : r.phase === 'reduce' ? '前半: 隣へ渡しながら足していく（1/576 ずつ）' : '後半: 足し終わった分を輪に配る';
    }
    case 'sharp': {
      const s = sharpAt(t);
      if (s.phase === 'up') return '全員が 1 GB をリーフへ送る';
      if (s.phase === 'leaf') return 'リーフの中で 72 個分を足す（SHARP）';
      if (s.phase === 'spine') return 'リーフ 8 台の合計をスパインの中で足す';
      return '合計を 1 回で全員に返す。送ったのは 1 GB だけ';
    }
    case 'air': {
      const a = airAt(t);
      return a.optics ? `光モジュールを挿すと最大 ${fmt(SPEC.power.maxW)} W。ファンの風も強くなる` : `受動の銅ケーブルなら典型 ${fmt(SPEC.power.typW)} W。前から吸って後ろへ`;
    }
    default:
      return '';
  }
}
export {SCENES};
