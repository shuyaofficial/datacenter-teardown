// Where things are in chapters 4-7, no three.js (the tests read it in node). The magnified ASIC drawing (BOARD: 12
// blocks on a plate that floats above the real ASIC), where the frame's cells and its 64 B descriptor sit on it for a
// packetAt() state, the bead streams of the ARP storm and of the congested port, the airflow dashes, and the caption
// line. Everything is a pure function of the scene's staged time; asic.js only turns these numbers into meshes.
//
// BOARD coordinates are millimetres on the plate: x to the right, z toward the viewer (front), y up from the plate's top.
import {fillMs, packetAt, puntAt, queueAt, SCENES, sceneDuration, SPEC} from './kin.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};
/** u remapped from [a, b] to 0..1, clamped */
export const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);

// ------------------------------------------------------------ polylines
export const pathLength = (pts) => pts.slice(1).reduce((a, p, i) => a + Math.hypot(...p.map((v, k) => v - pts[i][k])), 0);
/** the point u (0..1) of the way along a polyline of [x, y, z] (or [x, z]) points, by length */
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
/** a chapter press: the frame waits at the port while the camera settles; a scene / multiplier press starts at once */
export const PRE = 1.4;
/** after a scene ends it holds its last state this long, then starts again (the live page loops; so does the film) */
export const HOLD = 2.8;
/** staged scene time for `since` seconds after the press that started it */
export function sceneClock(scene, since, pre = 0) {
  if (!scene) return 0;
  const s = Math.max(0, since - pre);
  const period = sceneDuration(scene) + HOLD;
  return s % period;
}

/**
 * How much the chapter-4 camera looks down at the ports (1) instead of the magnified drawing (0): low while the frame
 * waits at Gi1/0/1 and runs to the ASIC, up for the 12 stages, down again when it leaves through the egress port.
 */
export function portLook(scene, sceneT) {
  if (!scene || !SCENES[scene] || SCENES[scene].punt || SCENES[scene].queue) return 0;
  const sm = (a, b, x) => ease((x - a) / (b - a));
  const D = sceneDuration(scene);
  const outStart = D - SPEC.stageDur; // the 'out' step
  return Math.max(1 - sm(0.25, 1.15, sceneT), sm(outStart + 0.35, outStart + 1.0, sceneT));
}

// ------------------------------------------------------------ the magnified ASIC drawing
// A U: the ingress row runs left to right along the back, into the PBC (the big store on the right), the egress row
// runs right to left along the front, back to the PHY. IFC sits beside the FIFO→PBC flow, EFC beside the PBC→RWE flow,
// EQS to the right of the PBC. The PHY is the separate chip on the board, drawn outside the ASIC's dashed outline.
const ROW_IN = -58;
const ROW_OUT = 58;
const B = (id, stage, x, z, w, d, h, abbr, ja, lab) => ({id, stage, x, z, w, d, h, abbr, ja, lab});
// the row's names alternate between two tiers so each phrase stays on one line
const ABOVE = (x, tier = 0) => ({x, z: ROW_IN - 19 - tier * 22, h: 'c', v: 'b'});
const BELOW = (x, tier = 0) => ({x, z: ROW_OUT + 16 + tier * 22, h: 'c', v: 't'});
export const BOARD = {
  // the plate: its local origin sits in the world (chassis mm) here, its top face at that y
  at: [-14, 86, -62],
  x0: -216,
  x1: 178,
  z0: -128,
  z1: 126,
  t: 3,
  asic: {x0: -182, x1: 172, z0: -118, z1: 118}, // the dashed outline: inside is the ASIC
  rowIn: ROW_IN,
  rowOut: ROW_OUT,
  // lab: where the label goes, [x, z] on the plate and its alignment: h l|c|r (text left of / centred on / right of the
  // point), v t|m|b (text below / centred / above the point). The ingress row is named behind it, the egress row in
  // front of it, IFC and EFC (between the rows, beside their flows) to their left.
  blocks: [
    B('phy', 'phy-in', -199, 0, 18, 140, 5, 'PHY', 'ASIC の外の別チップ', {x: -187, z: 0, h: 'r', v: 'm'}),
    B('nif', 'nif', -158, ROW_IN, 30, 24, 8, 'NIF', '256 B の切れ端に分ける', ABOVE(-158)),
    B('msi', 'macsec-in', -114, ROW_IN, 30, 24, 8, 'MACsec', '暗号を解く（使うときだけ）', ABOVE(-114, 1)),
    B('fifo', 'fifo-in', -70, ROW_IN, 30, 24, 8, 'FIFO', '切れ端を集めて PBC へ', ABOVE(-70)),
    B('ifc', 'ifc', -20, -24, 34, 22, 8, 'IFC', '横から覗いて検索し札を作る', {x: -41, z: -24, h: 'l', v: 'm'}),
    B('pbc', 'pbc', 62, 0, 84, 136, 5, 'PBC', '本体を置いておく', {x: 86, z: -74, h: 'c', v: 'b'}),
    B('eqs', 'eqs', 144, 0, 34, 48, 8, 'EQS', '出口キューに並べる・複製', {x: 144, z: 28, h: 'c', v: 't'}),
    B('efc', 'efc', 4, 24, 30, 22, 8, 'EFC', '流れを覗き書き換えの札', {x: -15, z: 24, h: 'l', v: 'm'}),
    B('rwe', 'rwe', -26, ROW_OUT, 30, 24, 8, 'RWE', '書き換え（MAC・TTL−1）', BELOW(-26, 1)),
    B('fifo2', 'out', -70, ROW_OUT, 30, 24, 8, 'FIFO', '出口 FIFO へ', BELOW(-70)),
    B('mso', 'out', -114, ROW_OUT, 30, 24, 8, 'MACsec', '暗号をかける（使うときだけ）', BELOW(-114, 1)),
    B('nif2', 'out', -158, ROW_OUT, 30, 24, 8, 'NIF', '線に送り出す', BELOW(-158)),
  ],
  // the flows drawn on the plate as thin strips: [x, z] polylines
  flows: {
    in: [[-190, ROW_IN], [20, ROW_IN]],
    out: [[20, ROW_OUT], [-190, ROW_OUT]],
    toEqs: [[104, 0], [127, 0]],
  },
};
export const BLOCK = Object.fromEntries(BOARD.blocks.map((b) => [b.id, b]));

/** the blocks that work for a packetAt() state (the accent goes on these); `flow` = the PBC→RWE strip */
export function activeOf(pk) {
  if (!pk) return {blocks: [], flow: null};
  if (pk.phase === 'cpu' || pk.phase === 'inject') return {blocks: [], flow: null};
  switch (pk.stageId) {
    case 'phy-in':
      return {blocks: pk.u > 0.7 ? ['phy'] : [], flow: null};
    case 'nif':
      return {blocks: ['nif'], flow: null};
    case 'macsec-in':
      return {blocks: ['msi'], flow: null};
    case 'fifo-in':
      return {blocks: ['fifo'], flow: null};
    case 'ifc':
      return {blocks: ['ifc'], flow: 'in'};
    case 'pbc':
      return {blocks: ['pbc'], flow: null};
    case 'eqs':
      return {blocks: ['eqs'], flow: pk.phase === 'queue' ? null : 'toEqs'};
    case 'pbc-rwe':
      return {blocks: [], flow: 'out'};
    case 'efc-peek':
    case 'efc-lookup':
      return {blocks: ['efc'], flow: 'out'};
    case 'rwe':
      return {blocks: ['rwe'], flow: null};
    case 'out': {
      const k = pk.done ? 4 : Math.min(3, Math.floor(pk.u / 0.2));
      return {blocks: [['fifo2', 'mso', 'nif2', 'phy'][Math.min(3, k)]], flow: null};
    }
    default:
      return {blocks: [], flow: null};
  }
}

// cells ride above the blocks (the blocks are 8 mm tall), 2.5 mm apart once split
export const CELL = {w: 9, d: 7, h: 4.5, gap: 3, y: 10};
const cellW = (bytes) => (CELL.w * bytes) / SPEC.cellB;
/** x of cell i in a train whose head is at x = head, moving in direction dir (+1 right, -1 left); split = how many have split */
function trainX(cells, head, dir, split) {
  const out = [];
  let x = head;
  cells.forEach((c, i) => {
    const w = cellW(c.bytes);
    out.push(x - (dir * w) / 2);
    const g = i < split ? CELL.gap : 0.4;
    x -= dir * (w + g);
  });
  return out;
}
/** the descriptor's route on the plate: IFC → into the PBC (to the cells) → EQS */
export const TAG_ROUTE = [[-20, -24], [82, -36], [88, -6], [144, 0]];
/** where the head of the joined frame lands on the plate: its tail just clears the PHY block */
const HEAD0 = -199 + 9 + 3 + 6 * CELL.w;
/** the 6 slots in the PBC: two columns of three */
const pbcSlot = (i) => [BLOCK.pbc.x - 16 + (i % 2) * 22, -34 + Math.floor(i / 2) * 24];

/**
 * Where the frame is on the plate for a packetAt() state:
 * {real: null | 'in' (on the real board, 0..1 of the way from the port to the ASIC) | 'out' (from the ASIC to the port),
 *  realU, rise: null | 0..1 (rising from the ASIC to the plate / sinking back), cells: [{i, bytes, x, z, w, y, o}],
 *  tag: null | {x, z, o, copies, served}, peek: null | 'ifc' | 'efc', copies}
 * o = opacity. The descriptor never leaves IFC → PBC → EQS; the cells never leave the PBC until the EQS lets them.
 */
export function boardPose(pk) {
  const out = {real: null, realU: 0, rise: null, cells: [], tag: null, peek: null, copies: pk.copies || 1, joined: false};
  if (!pk || pk.phase === 'queue') return out;
  const n = pk.cells.length;
  const cells = pk.cells.map((c) => ({i: c.i, bytes: c.bytes, w: cellW(c.bytes)}));
  const put = (xs, z, o = 1) => cells.map((c, i) => ({...c, x: xs[i], z, y: CELL.y, o}));
  const u = pk.u;
  const id = pk.stageId;
  const inA = pk.phase === 'asic';
  if (!inA) return out; // the CPU chapter draws its own path
  if (id === 'phy-in') {
    if (u < 0.62) {
      out.real = 'in';
      out.realU = u / 0.62;
    } else {
      out.rise = seg(u, 0.62, 1);
      // the joined frame lands just right of the PHY block
      out.cells = put(trainX(cells, HEAD0, 1, 0), ROW_IN, 1);
      out.joined = true;
    }
    return out;
  }
  if (id === 'nif') {
    const head = lerp(HEAD0, BLOCK.nif.x + 40, ease(seg(u, 0, 0.5)));
    // cell i splits off at u = (i + 1) / n: the same count as packetAt's
    const k = pk.cells.filter((c) => c.at === 'nif').length;
    out.cells = put(trainX(cells, head, 1, k), ROW_IN);
    out.joined = k === 0;
    return out;
  }
  if (id === 'macsec-in') {
    out.cells = put(trainX(cells, lerp(BLOCK.nif.x + 40, BLOCK.msi.x + 40, ease(u)), 1, n), ROW_IN);
    return out;
  }
  if (id === 'fifo-in') {
    out.cells = put(trainX(cells, lerp(BLOCK.msi.x + 40, BLOCK.fifo.x + 40, ease(u)), 1, n), ROW_IN);
    return out;
  }
  if (id === 'ifc') {
    // the train flows from the FIFO into the PBC; the IFC looks at it from the side and writes the 64 B descriptor
    const head = lerp(BLOCK.fifo.x + 40, BLOCK.pbc.x - 14, ease(u));
    out.cells = put(trainX(cells, head, 1, n), ROW_IN);
    out.peek = 'ifc';
    const born = seg(u, 0.35, 0.75);
    if (born > 0) out.tag = {x: BLOCK.ifc.x, z: BLOCK.ifc.z, o: born, copies: 1, served: false};
    return out;
  }
  // from here on the cells sit in the PBC until the EQS lets them out
  const restXZ = (i) => pbcSlot(i);
  const fromTrain = trainX(cells, BLOCK.pbc.x - 14, 1, n);
  if (id === 'pbc') {
    const k = ease(seg(u, 0, 0.55));
    out.cells = cells.map((c, i) => {
      const [sx, sz] = restXZ(i);
      return {...c, x: lerp(fromTrain[i], sx, k), z: lerp(ROW_IN, sz, k), y: CELL.y - 4 * k, o: 1};
    });
    // the descriptor goes from the IFC down into the PBC, to the cells
    const p = along(TAG_ROUTE.slice(0, 2), ease(seg(u, 0.1, 0.95)));
    out.tag = {x: p[0], z: p[1], o: 1, copies: 1, served: false};
    return out;
  }
  const sitting = () => cells.map((c, i) => ({...c, x: restXZ(i)[0], z: restXZ(i)[1], y: CELL.y - 4, o: 1}));
  const atEqs = {x: BLOCK.eqs.x, z: BLOCK.eqs.z};
  if (id === 'eqs') {
    out.cells = sitting();
    const m = ease(seg(u, 0, 0.6));
    const p = along(TAG_ROUTE.slice(1), m);
    const copies = pk.copies > 1 ? (u < 0.65 ? 1 : pk.copies) : 1;
    out.tag = {x: p[0], z: p[1], o: 1, copies, copyK: seg(u, 0.65, 0.95), served: false};
    return out;
  }
  // the EQS calls the frame: the cells leave the PBC for the RWE one by one
  const egressTrain = (head, split = n) => trainX(cells, head, -1, split);
  const tagServed = (o) => ({x: atEqs.x, z: atEqs.z, o, copies: pk.copies, copyK: 1, served: true});
  if (id === 'pbc-rwe') {
    const startX = BLOCK.pbc.x - 30;
    const train = egressTrain(startX);
    out.cells = cells.map((c, i) => {
      const k = ease(seg(u * n - i * 0.55, 0, 1.6));
      const [sx, sz] = restXZ(i);
      return {...c, x: lerp(sx, train[i], k), z: lerp(sz, ROW_OUT, k), y: lerp(CELL.y - 4, CELL.y, k), o: 1};
    });
    out.tag = tagServed(1 - 0.5 * u);
    return out;
  }
  if (id === 'efc-peek' || id === 'efc-lookup') {
    const v = id === 'efc-peek' ? u * 0.5 : 0.5 + u * 0.5;
    out.cells = put(egressTrain(lerp(BLOCK.pbc.x - 30, BLOCK.rwe.x + 28, ease(v))), ROW_OUT);
    out.peek = 'efc';
    out.tag = tagServed(0.5 * (1 - v));
    return out;
  }
  if (id === 'rwe') {
    out.cells = put(egressTrain(lerp(BLOCK.rwe.x + 28, BLOCK.rwe.x - 2, ease(seg(u, 0, 0.5)))), ROW_OUT);
    return out;
  }
  if (id === 'out') {
    // RWE → FIFO → MACsec → NIF on the plate, joined again at the PHY, then down to the real board and out of the port
    if (u < 0.7) {
      const head = lerp(BLOCK.rwe.x - 2, BLOCK.phy.x + 12, ease(seg(u, 0, 0.62)));
      const join = seg(u, 0.5, 0.66);
      out.cells = put(egressTrain(head, join > 0.5 ? 0 : n), ROW_OUT);
      out.joined = join > 0.5;
    } else if (u < 0.82 && !pk.done) {
      out.rise = 1 - seg(u, 0.7, 0.82);
      out.cells = put(egressTrain(BLOCK.phy.x + 12, 0), ROW_OUT, 1 - seg(u, 0.7, 0.82));
      out.joined = true;
    } else {
      out.real = 'out';
      out.realU = pk.done ? 1 : seg(u, 0.82, 1);
    }
    return out;
  }
  return out;
}

/** the one-line caption over the 3D view for a scene state (chapters 4-6) */
export function captionOf(scene, pk) {
  if (!scene || !pk) return '';
  const sc = SCENES[scene];
  const fp = SPEC.demo.floodPorts;
  if (sc.queue) {
    const q = pk.real;
    return q.full ? `Q1 が満杯（${q.limit.toLocaleString('en-US')} B）。あふれた分を末尾から捨てている` : `入 2 Gbps − 出 1 Gbps = 1 Gbps ずつ Q1 に溜まる`;
  }
  if (pk.phase === 'cpu') {
    if (pk.cpuLayer === 'copp') return `CoPP がキュー${sc.punt}の上限（${puntRateOf(sc.punt).toLocaleString('en-US')} pps）を確かめて CPU へ通す`;
    return pk.cpuDir > 0 ? 'CPU の中を上がる: カーネル → FED → PDS → IOSd' : sc.ttl ? 'IOSd が ICMP（時間超過）を作り、下へ戻す' : 'IOSd が ARP 応答を作り、下へ戻す';
  }
  if (pk.phase === 'inject') return '応答を ASIC にインジェクトする（逆向き）';
  if (sc.rate) return `ARP の嵐: ${SPEC.punt.stormPps.toLocaleString('en-US')} pps のうち CoPP は ${puntRateOf(sc.punt).toLocaleString('en-US')} pps だけ通し、残りは CPU の手前で捨てる`;
  if (sc.punt) {
    if (pk.stageId === 'out') return sc.ttl ? 'ICMP を Gi1/0/1 へ送り返す' : 'ARP 応答を Gi1/0/1 へ送り返す';
    if (pk.stageId === 'ifc') return sc.ttl ? 'IFC が TTL 1 を見つけた: 転送できないので CPU へ（キュー3）' : 'IFC が自分宛ての ARP と判定: CPU へ（キュー5）';
    return `Gi1/0/1 から ${sc.bytes} B が入る`;
  }
  switch (pk.stageId) {
    case 'phy-in':
      return `Gi1/0/1 から ${sc.bytes} B のフレームが入る`;
    case 'nif':
      return `NIF で 256 B の切れ端 ${pk.real.cellCount} 個に分ける（256 × ${pk.real.cellCount - 1} + ${pk.real.lastCellB}）`;
    case 'macsec-in':
    case 'fifo-in':
      return '切れ端は FIFO に集まり、PBC へ流れる';
    case 'ifc':
      return 'IFC が流れを横から覗いて検索し、64 B の札を作る';
    case 'pbc':
      return `本体 ${sc.bytes} B は PBC に置いたまま。動くのは 64 B の札だけ`;
    case 'eqs':
      return sc.flood ? `EQS が札を出口の数（${fp.length}・仮置き）だけ複製する。本体は PBC のまま` : '札だけが EQS の出口キューに並ぶ。本体は PBC のまま';
    case 'pbc-rwe':
      return '順番が来たので、本体を PBC から読み出す';
    case 'efc-peek':
    case 'efc-lookup':
      return 'EFC が流れを覗き、出口側の検索をする';
    case 'rwe':
      return sc.l3 ? 'RWE で MAC を付け替え、TTL を 1 減らす' : 'RWE: 同じ VLAN の L2 なので書き換えない';
    case 'out':
      return sc.flood ? `${fp.join('・')} へ送り出す（${fp.length} ポートは説明用の仮置き）` : `出口の NIF から ${sc.to} へ送り出す`;
    default:
      return '';
  }
}
const puntRateOf = (qid) => SPEC.punt.queues.find((q) => q.id === qid).pps;

// ------------------------------------------------------------ the ARP storm: beads, each one = 1,000 frames
export const STORM = {perBead: 1000, travel: 1.1, stopFade: 0.9, climb: 0.9};
/** staged time when cumulative arrivals reach `frames` (inverse of puntAt's ramp) */
export function stormEmitT(frames, spec = SPEC) {
  const R = spec.punt.stormPps;
  const ramp = spec.punt.stormRamp;
  const realT = frames <= (R * ramp) / 2 ? Math.sqrt((2 * ramp * frames) / R) : ramp + (frames - (R * ramp) / 2) / R;
  return realT / spec.timeMap.stormRealPerSec;
}
/**
 * The storm's beads at staged time t: [{i, pass, s}] with s = seconds since the bead left the port. A bead passes the
 * CoPP when the queue's pass counter ticks over a whole bead at its arrival; the rest stop at the gate and fade.
 */
export function stormBeads(t, spec = SPEC) {
  const out = [];
  const last = Math.floor(puntAt('storm', t, spec).offered / STORM.perBead);
  for (let i = 1; i <= last; i++) {
    const te = stormEmitT(i * STORM.perBead, spec);
    const s = t - te;
    if (s > STORM.travel + STORM.climb + STORM.stopFade) continue;
    const passNow = Math.floor(puntAt('storm', te, spec).pass / STORM.perBead + 1e-9);
    const passPrev = Math.floor(puntAt('storm', stormEmitT((i - 1) * STORM.perBead, spec), spec).pass / STORM.perBead + 1e-9);
    out.push({i, pass: passNow > passPrev || i === 1, s});
  }
  return out;
}

// ------------------------------------------------------------ the congested port: beads in from Gi1/0/1 and Gi1/0/2, out to Gi1/0/3
export const CONGEST = {perSec: 4, travel: 1.4, outTravel: 1.2, dropFade: 1.1};
/**
 * In-beads [{port: 1|2, k, s (seconds on the way), drop}] and out-beads [{k, s}] at staged time t, multiplier mult.
 * The stream is already flowing when the scene starts (the first beads reach the queue at t = 0). A bead that arrives
 * when Q1 is full is thrown away from the tail: every second one, since 2 Gbps come in and 1 Gbps goes out.
 */
export function congestBeads(t, mult = SPEC.queue.multDefault, spec = SPEC) {
  const P = CONGEST.perSec;
  const ins = [];
  const outs = [];
  const k1 = Math.floor((t + CONGEST.travel) * P);
  for (let k = Math.max(0, k1 - Math.ceil((CONGEST.travel + CONGEST.dropFade) * P) - 1); k <= k1; k++) {
    const arrive = k / P; // reaches the queue at this staged time
    const s = t - (arrive - CONGEST.travel);
    if (s < 0) continue;
    for (const port of [1, 2]) {
      const full = queueAt(Math.max(0, arrive) * spec.timeMap.congestMsPerSec, mult, spec).full;
      const drop = full && port === 2;
      if (s > CONGEST.travel + (drop ? CONGEST.dropFade : 0.05)) continue;
      ins.push({port, k, s, drop});
    }
  }
  // the egress drains at 1 Gbps from the moment the first bead arrives
  const kOut = Math.floor(t * P);
  for (let k = Math.max(0, kOut - Math.ceil(CONGEST.outTravel * P) - 1); k <= kOut; k++) {
    const s = t - k / P;
    if (s >= 0 && s <= CONGEST.outTravel) outs.push({k, s});
  }
  return {ins, outs, fullAtS: fillMs(mult, spec) / spec.timeMap.congestMsPerSec};
}

// ------------------------------------------------------------ chapter 7: airflow dashes and the PoE budget
export const AIR = {dash: 9, gap: 9, speed: 26};
/** the dashes along one path at time T: [{a: [x,y,z], b: [x,y,z]}]; speed 0 stops them (reduced motion) */
export function airDashes(pts, T, speed = AIR.speed) {
  const len = pathLength(pts);
  const step = AIR.dash + AIR.gap;
  const off = (((T * speed) % step) + step) % step;
  const out = [];
  for (let s = off - step; s < len; s += step) {
    const a = Math.max(0, s);
    const b = Math.min(len, s + AIR.dash);
    if (b - a < 0.5) continue;
    out.push({a: along(pts, a / len), b: along(pts, b / len)});
  }
  return out;
}
export const airCount = (pts) => Math.ceil(pathLength(pts) / (AIR.dash + AIR.gap)) + 2;
