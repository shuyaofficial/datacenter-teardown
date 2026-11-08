// The rack film: the rack (rack.js, tray.js), the diagrams beside it (ocs.js) and the overlays (overlay.js) in the studio
// (stage.js) under the Japanese console (console.js). The operator looks at the rack and the 4×4×4 cube beside it, pulls
// TPU tray 9 out and lifts its layers, draws one chip's 6 lines, sends a bead corner to corner and round the wrap,
// turns the OCS's mirrors to reshape 4 cubes and swap in a spare, pulls back to the pod's 144 racks, sets the cube's way
// against NVL72's one switch, follows the ICI and the DCN out of a chip, and the current and the coolant through the
// rack. A pure function of t: every pose comes from the script (script.js), kin.js and flow.js.
import {runSim} from 'teardown-kit/runtime.js';
import * as THREE from 'three';
import {makeCursor} from '../kit/cursor.js';
import {createConsole, SUB_NOTE} from './console.js';
import {captionOf, CUBE} from './flow.js';
import {chipOfTray, gaugesAt, hopAt, liftsAt, neighbours, ocsAt, route, SCENES, sixAt, SPEC, swapAt, vsAt, wrapAt} from './kin.js';
import {DURATION, explodeEventsOf, holdOf, lookTargetOf, SCRIPT, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'tpu', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ views (metres, degrees); u = seconds since the view came on
export const VIEW_FN = {
  front: (u) => ({tx: 0, ty: 1.16, tz: 0, az: 24 + 0.35 * u, el: 9, d: 7.6, sx: 0, sy: -26}),
  cube: (u) => ({tx: 1.1, ty: 1.2, tz: 0, az: 22 + 0.3 * u, el: 16, d: 7.6, sx: 0, sy: -26}),
  open: (u) => ({tx: -0.3, ty: 1.2, tz: 0.9, az: 44 + 0.3 * u, el: 40, d: 3.3, sx: 0, sy: -24}),
  torus: (u) => ({tx: 2.2, ty: 1.1, tz: 0.05, az: 22 + 0.3 * u, el: 16, d: 4.1, sx: 0, sy: -24}),
  ocs: (u) => ({tx: 2.2, ty: 1.0, tz: 0, az: 16 + 0.25 * u, el: 26, d: 4.9, sx: 0, sy: -24}),
  pod: (u) => ({tx: 9.0, ty: 0.4, tz: -9.9, az: 28 + 0.4 * u, el: 40, d: 54, sx: 0, sy: -30}),
  vs: (u) => ({tx: 2.98, ty: 1.24, tz: 0, az: 12 + 0.15 * u, el: 8, d: 6.0, sx: 0, sy: -24}),
  out: (u) => ({tx: 1.35, ty: 1.4, tz: 0.2, az: -8 + 0.25 * u, el: 9, d: 7.4, sx: 0, sy: -26}),
  power: (u) => ({tx: 0, ty: 1.2, tz: -0.1, az: 154 + 0.3 * u, el: 10, d: 7.8, sx: 0, sy: -26}),
  cool: (u) => ({tx: -0.6, ty: 1.12, tz: -0.1, az: 198 - 0.3 * u, el: 12, d: 9.2, sx: 0, sy: -26}),
};
/** which camera a state looks through */
export const viewKeyOf = (sc) => {
  if (sc.chapter === 1) return sc.view === 'cube' ? 'cube' : 'front';
  if (sc.chapter === 4) return sc.scene === 'pod' ? 'pod' : 'ocs';
  if (sc.chapter === 7) return sc.scene === 'cool' ? 'cool' : 'power';
  return ['', '', 'open', 'torus', '', 'vs', 'out'][sc.chapter];
};
// [when the camera starts to move, view]. After a chapter press that sends the pulled tray back, the camera waits
// (holdOf) until the tray is in, so the two never move at once.
const CAMS = (() => {
  const out = [];
  let prev = 1;
  for (const e of SCRIPT) {
    const s = stateAtScript(e.t);
    const key = viewKeyOf(s);
    if (!out.length || out[out.length - 1][1] !== key) out.push([e.t + (e.chapter !== undefined ? holdOf(prev, e.chapter) : 0), key]);
    prev = s.chapter;
  }
  return out;
})();
// blend two cameras: the distance in log space, so a zoom reads as one move
export const blendCam = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + (((b.az - a.az + 540) % 360) - 180) * k : a[key] + (b[key] - a[key]) * k;
  o.d = Math.exp(Math.log(a.d) + (Math.log(b.d) - Math.log(a.d)) * k);
  return o;
};
export const camAt = (t) => {
  let i = 0;
  while (i < CAMS.length - 1 && CAMS[i + 1][0] <= t) i++;
  const cur = VIEW_FN[CAMS[i][1]](t - CAMS[i][0]);
  if (i > 0) {
    const k = ss(CAMS[i][0], CAMS[i][0] + 1.8, t);
    if (k < 1) return blendCam(VIEW_FN[CAMS[i - 1][1]](t - CAMS[i - 1][0]), cur, k);
  }
  return cur;
};
/** seconds of the last press that changes the camera (chapter / view / a scene with its own view), for the label fade */
export const lastChange = (t, script = SCRIPT) => {
  let c = 0;
  let key = 'front';
  for (const e of script) {
    if (e.t > t) break;
    const k = viewKeyOf(stateAtScript(e.t, script));
    if (e.chapter !== undefined || e.view !== undefined || k !== key) c = e.t;
    key = k;
  }
  return c;
};
/** the last chapter press at or before t, and the chapter before it */
export const lastChapter = (t, script = SCRIPT) => {
  let c = {t: 0, prev: 1, n: 1};
  for (const e of script) if (e.t <= t && e.chapter !== undefined) c = {t: e.t, prev: c.n, n: e.chapter};
  return c;
};
/** the last view press (or chapter press) at or before t, for the cube's fade in chapter 1 */
export const lastView = (t, script = SCRIPT) => {
  let c = 0;
  for (const e of script) if (e.t <= t && (e.view !== undefined || e.chapter !== undefined)) c = e.t;
  return c;
};
export const holdAt = (t, script = SCRIPT) => {
  const ch = lastChapter(t, script);
  return ch.t > 0 && ch.t === lastChange(t, script) ? holdOf(ch.prev, ch.n) : 0;
};
/** seconds after a press that the labels wait: the camera and the pull settle first (the pull takes longer in chapter 2) */
export const labelWait = (chapter, hold = 0) => (chapter === 2 ? 3.3 : 1.5) + hold;
const EVENTS = explodeEventsOf();

// ------------------------------------------------------------ the operator's pointer
export function makeFilmCursor(ui) {
  const presses = [];
  for (const e of SCRIPT) {
    if (e.t <= 0) continue;
    if (e.chapter !== undefined) presses.push({t: e.t, spot: ui.spots[`c_${e.chapter}`]});
    else if (e.view !== undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.view}`]});
    if (e.scene && e.chapter === undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.scene}`]});
  }
  return makeCursor(presses, [[880, 560], [760, 480], [940, 540], [820, 520]]);
}

// ------------------------------------------------------------ the labels, per view, from the anchors
// side: 'l' / 'r' a column beside the model (rows ordered by the anchors' height), 'u' / 'd' a row above / below it,
// 'a' the nearer column
const LABELS = {
  front: [
    ['drip', '水受け', 'いちばん上', 'l'],
    ['rect', '整流器（AC/DC）', '416 V の交流を直流に', 'l'],
    ['tor', 'ToR スイッチ・監視トレイ', '左 ToR・右 ラックの監視', 'l'],
    ['hostTray', 'ホストトレイ × 16', 'VM 1 台 ＝ チップ 4 個', 'l'],
    ['bbu', '電池（BBU）', 'いちばん下', 'l'],
    ['patch', '光のパッチパネル', '外へ出る光 96 本', 'r'],
    ['fibreFront', '光ファイバの束', 'OSFP からパッチパネルへ', 'r'],
    ['tpuTray', 'TPU トレイ × 16', 'チップ 4 個・左右 2 列 × 8 段', 'r'],
  ],
  cube: [
    ['demoTray', 'TPU トレイ 1 枚', 'チップ 4 個（下から 5 段目）', 'l'],
    ['cubeTop', '4×4×4 の立方体', 'ラック 1 台 ＝ チップ 64 個', 'd'],
    ['cubeTile', '同じ z の 2×2', 'トレイ 1 枚ぶん（対応は仮定）', 'd'],
  ],
  open: [
    ['lid', '天板', '最初に持ち上がる', 'u'],
    ['plate', 'コールドプレート × 4', '電圧調整器にも小さい板', 'u'],
    ['valve', '弁 × 4', '枝ごとに流量を変える', 'u'],
    ['chip', 'Ironwood × 4', 'ダイ 2 個・HBM3E 192 GiB', 'd'],
    ['board', '基板', '4 個を 2×2 の輪に配線（推測）', 'd'],
    ['pcie', 'PCIe Gen5 x16 × 4', '基板の裏・ホストトレイへ', 'd'],
    ['osfp', 'OSFP × 18', '前の縁（表 16・裏 2）', 'd'],
  ],
  pod: [['podFar', 'TPU ラック 144 台', '1 台 ＝ 立方体 1 個', 'r']],
  out: [
    ['osfpFront', 'OSFP（前の縁）', 'ICI 片方向 600 GB/s・光で外へ', 'r'],
    ['nic', 'NIC（ホストトレイ）', 'チップあたり 100 Gb/s', 'r'],
    ['pod2', '別のポッド', 'Jupiter の向こう', 'r'],
  ],
  power: [
    ['acIn', '416 V 交流の入力', '上から入る', 'a'],
    ['rectBack', '整流器', '交流 → 直流', 'a'],
    ['bus', '各トレイへ', '配電の形は簡略', 'a'],
    ['bbuBack', '電池（BBU）', 'いちばん下', 'a'],
  ],
  cool: [
    ['manS', 'マニホールド（行き）', '淡い線・列ごとに 1 本', 'a'],
    ['manR', 'マニホールド（帰り）', '濃い線', 'a'],
    ['hose', '差し口', 'TPU トレイごとに 1 組', 'a'],
  ],
};
const VP = {x0: 350, x1: 1250, y0: 156, y1: 742};
const LH = 44; // a label's height: the name and the one-line spec
// text width in px: Japanese full width, ASCII about 0.58 em
const tw = (str, px) => [...str].reduce((a, ch) => a + (ch.charCodeAt(0) < 256 ? 0.58 : 1) * px, 0);
/** do segments p1-p2 and q1-q2 cross (strictly)? */
export const crosses = (p1, p2, q1, q2) => {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(q1, q2, p1);
  const d2 = d(q1, q2, p2);
  const d3 = d(p1, p2, q1);
  const d4 = d(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
const BB = new THREE.Box3();
const CORNER = new THREE.Vector3();
/** the model's extent on screen [minX, maxX, minY, maxY] */
function screenSpan(st, key) {
  let x0 = 1e9;
  let x1 = -1e9;
  let y0 = 1e9;
  let y1 = -1e9;
  const groups = key === 'open' ? [st.rack.tray.root] : key === 'cube' ? [st.rack.G.fixed, st.diag.cube] : key === 'pod' ? [st.diag.pod] : [st.rack.G.fixed, st.rack.tray.root];
  for (const g of groups) {
    BB.setFromObject(g);
    if (BB.isEmpty()) continue;
    for (const x of [BB.min.x, BB.max.x]) for (const y of [BB.min.y, BB.max.y]) for (const z of [BB.min.z, BB.max.z]) {
      const p = st.project(...CORNER.set(x, y, z).toArray());
      if (!p) continue;
      x0 = Math.min(x0, p[0]);
      x1 = Math.max(x1, p[0]);
      y0 = Math.min(y0, p[1]);
      y1 = Math.max(y1, p[1]);
    }
  }
  return [x0, x1, y0, y1];
}

export function makeLabels(st) {
  return (key, o) => {
    const list = LABELS[key];
    if (!list || o < 0.02) return [];
    const [mx0, mx1, my0, my1] = screenSpan(st, key);
    const mid = (mx0 + mx1) / 2;
    const pts = list
      .map(([a, name, sub, side]) => {
        const at = st.project(...st.rack.anchor(a).toArray());
        return {name, sub, at, side, w: Math.ceil(Math.max(tw(name, 16) + 40, tw(sub, 13) + 40))};
      })
      .filter((p) => p.at && p.at[0] > VP.x0 - 40 && p.at[0] < VP.x1 + 40 && p.at[1] > VP.y0 - 40 && p.at[1] < VP.y1 + 40)
      .map((p) => ({...p, side: p.side === 'a' ? (p.at[0] < mid ? 'l' : 'r') : p.side}));
    const out = [];
    for (const side of ['l', 'r']) {
      const grp = pts.filter((p) => p.side === side).sort((a, b) => a.at[1] - b.at[1]);
      if (!grp.length) continue;
      const wMax = Math.max(...grp.map((p) => p.w));
      const xCol = side === 'l' ? Math.max(VP.x0, Math.min(mx0 - 36 - wMax, VP.x1 - wMax)) : Math.min(VP.x1 - wMax, Math.max(mx1 + 36, VP.x0));
      const order = grp.map((_, i) => i);
      const layout = () => {
        const g = order.map((i) => grp[i]);
        const ys = g.map((p) => p.at[1] - LH / 2);
        for (let i = 1; i < ys.length; i++) ys[i] = Math.max(ys[i], ys[i - 1] + LH + 10);
        const over = ys[ys.length - 1] + LH - VP.y1;
        if (over > 0) for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], i === ys.length - 1 ? VP.y1 - LH : ys[i + 1] - LH - 10);
        for (let i = 0; i < ys.length; i++) ys[i] = Math.max(ys[i], i ? ys[i - 1] + LH + 10 : VP.y0);
        return g.map((p, i) => {
          const x = side === 'l' ? xCol + wMax - p.w : xCol;
          return {p, x, y: ys[i], end: [side === 'l' ? x + p.w : x, ys[i] + LH / 2]};
        });
      };
      let lay = layout();
      for (let it = 0; it < 30; it++) {
        let hit = null;
        for (let i = 0; i < lay.length && !hit; i++) for (let j = i + 1; j < lay.length && !hit; j++) if (crosses(lay[i].p.at, lay[i].end, lay[j].p.at, lay[j].end)) hit = [i, j];
        if (!hit) break;
        [order[hit[0]], order[hit[1]]] = [order[hit[1]], order[hit[0]]];
        lay = layout();
      }
      lay.forEach((c) => out.push({side, name: c.p.name, sub: c.p.sub, at: c.p.at, label: [c.x, c.y], end: c.end, o}));
    }
    const a0 = Math.max(VP.y0, my0 - 16 - LH);
    const b0 = Math.min(VP.y1 - LH, my1 + 16);
    for (const side of ['u', 'd']) {
      const grp = pts.filter((p) => p.side === side).sort((x, y) => x.at[0] - y.at[0]);
      if (!grp.length) continue;
      const order = grp.map((_, i) => i);
      const y = side === 'u' ? a0 : b0;
      const layout = () => {
        const g = order.map((i) => grp[i]);
        const xs = [];
        let prev = -1e9;
        for (const p of g) {
          prev = Math.max(p.at[0] - p.w / 2, prev + 14);
          xs.push(prev);
          prev += p.w;
        }
        let right = VP.x1;
        for (let i = g.length - 1; i >= 0; i--) {
          xs[i] = Math.min(xs[i], right - g[i].w);
          right = xs[i] - 14;
        }
        let left = VP.x0;
        for (let i = 0; i < g.length; i++) {
          xs[i] = Math.max(xs[i], left);
          left = xs[i] + g[i].w + 14;
        }
        return g.map((p, i) => {
          const ex = Math.min(xs[i] + p.w - 12, Math.max(xs[i] + 12, p.at[0]));
          return {p, x: xs[i], y, end: [ex, side === 'u' ? y + LH + 1 : y - 1]};
        });
      };
      let lay = layout();
      for (let it = 0; it < 30; it++) {
        let hit = null;
        for (let i = 0; i < lay.length && !hit; i++) for (let j = i + 1; j < lay.length && !hit; j++) if (crosses(lay[i].p.at, lay[i].end, lay[j].p.at, lay[j].end)) hit = [i, j];
        if (!hit) break;
        [order[hit[0]], order[hit[1]]] = [order[hit[1]], order[hit[0]]];
        lay = layout();
      }
      lay.forEach((c) => out.push({side, name: c.p.name, sub: c.p.sub, at: c.p.at, label: [c.x, c.y], end: c.end, o}));
    }
    const rank = {l: 0, u: 1, d: 2, r: 3};
    return out.sort((x, y) => rank[x.side] - rank[y.side] || x.label[1] - y.label[1] || x.label[0] - y.label[0]).map((c, i) => ({...c, n: i + 1}));
  };
}

// ------------------------------------------------------------ what the console shows
/** the chapter's buttons that are lit */
export function litOf(sc, exOpen) {
  const lit = {};
  if (sc.chapter === 1) lit[sc.view] = true;
  else if (sc.chapter === 2) lit[exOpen ? 'open' : 'close'] = true;
  else if (sc.scene) lit[sc.scene] = true;
  return lit;
}

/** draws the console from the frame's state: s = {sc, viewKey, labelO, exOpen, sceneT, pull, cursor, look} */
export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const sc = s.sc;
    const scene = sc.scene;
    const g = gaugesAt(scene, s.sceneT ?? 0);
    const lit = litOf(sc, s.exOpen);
    ui.update({
      chapter: sc.chapter,
      lit,
      note: SUB_NOTE[Object.keys(lit).find((k) => SUB_NOTE[k]) ?? ''] ?? (scene ? SCENES[scene].sub : ''),
      scene,
      g,
      pull: s.pull,
      caption: s.labelO > 0.5 || sc.chapter >= 3 ? captionOf(scene, s.sceneT ?? 0) : '',
      tags: st.over.overlay(s.look, st.project),
      callouts: labels(s.viewKey, s.labelO),
      cursor: s.cursor,
    });
  };
}

const idx = (c) => c[0] * 16 + c[1] * 4 + c[2];
const ALL = Array.from({length: 64}, (_, i) => i);
/** the chips in the accent and the faint ones, per scene */
function nodesOf(ch, scene, t, view) {
  if (ch === 1 && view === 'cube') return {lit: [0, 1, 2, 3].map((s) => idx(chipOfTray(SPEC.demo.pullTray, s))), dim: []};
  if (ch === 3 && scene === 'six') {
    const f = sixAt(t);
    const on = [idx(f.from), ...f.links.filter((l) => l.k >= 1).map((l) => idx(l.b))];
    const keep = [idx(f.from), ...neighbours(f.from).map(idx)];
    return {lit: on, dim: ALL.filter((i) => !keep.includes(i))};
  }
  if (ch === 3 && scene === 'hop') {
    const h = hopAt(t);
    const on = h.path.slice(0, h.hops + 1).map(idx);
    return {lit: on, dim: ALL.filter((i) => !h.path.map(idx).includes(i))};
  }
  if (ch === 3 && scene === 'wrap') {
    const w = wrapAt(t);
    const row = route(SPEC.demo.wrapFrom, [3, 0, 0], [8, 4, 4]).map(idx);
    return {lit: w.hops ? [row[0], row[3]] : [row[0]], dim: ALL.filter((i) => !row.includes(i))};
  }
  if (ch === 5 && scene === 'vs') {
    const v = vsAt(t);
    return {lit: v.iw.slice(0, v.iwHops + 1).map(idx), dim: ALL.filter((i) => !v.iw.map(idx).includes(i))};
  }
  return {lit: [], dim: []};
}

/** the look of a chapter, chK = 0..1 since the chapter press, viewK since the last view press */
export function lookOf(sc, sceneT, chK, prevChapter, T, extra = {}) {
  const a = lookTargetOf(prevChapter);
  const b = lookTargetOf(sc.chapter);
  const scene = sc.scene;
  const ch = sc.chapter;
  const viewK = extra.viewK ?? 1;
  const o = scene === 'ocs' ? ocsAt(sceneT) : null;
  const s = scene === 'swap' ? swapAt(sceneT) : null;
  const v = scene === 'vs' ? vsAt(sceneT) : null;
  const w = scene === 'wrap' ? wrapAt(sceneT) : null;
  const n = nodesOf(ch, scene, sceneT, sc.view);
  const in4 = ch === 4 && (scene === 'ocs' || scene === 'swap');
  return {
    chapter: ch,
    scene,
    sceneT,
    T,
    reduced: !!extra.reduced,
    sides: a.sides + (b.sides - a.sides) * chK,
    cubeK: ch === 1 ? (sc.view === 'cube' ? viewK : 0) : ch === 3 || ch === 5 ? chK : 0,
    cubeC: ch === 5 ? CUBE.cVs : CUBE.c,
    tileK: ch === 1 ? 1 : 0,
    tileHi: ch === 1 ? SPEC.demo.pullTray : -1,
    lit: n.lit,
    dim: n.dim,
    ocs3K: ch === 3 && scene === 'wrap' ? chK : 0,
    ocs3Tilt: w && w.leg === 'ocs' ? Math.sin(Math.PI * w.u) : 0,
    minisK: in4 ? chK : 0,
    move: o ? o.move : 1,
    failK: s ? s.fail : 0,
    spareK: s ? 1 : 0,
    mirrorsFrom: s ? 'flat' : 'column',
    mirrorsTo: s ? 'swapped' : 'flat',
    mirrorK: o ? o.tilt : s ? s.tilt : 0,
    ocs: o,
    swap: s,
    podK: ch === 4 && scene === 'pod' ? ss(0.2, 1.4, sceneT) : 0,
    ringK: ch === 5 ? chK : 0,
    hubK: v ? Math.max(0, 1 - Math.abs(v.nvU - 0.5) * 5) : 0,
    outK: ch === 6 ? 1 : 0,
    cduK: ch === 7 && scene === 'cool' ? 1 : 0,
    powerK: 1,
    hi: {
      power: ch === 7 && scene === 'power' ? 0.35 * chK : 0,
      bus: ch === 7 && scene === 'power' ? 0.75 * chK : 0,
      bbu: ch === 7 && scene === 'power' ? 0.35 * chK : 0,
      manS: ch === 7 && scene === 'cool' ? 0.3 : 0,
      manR: ch === 7 && scene === 'cool' ? 0.65 : 0,
      plate: ch === 7 && scene === 'cool' ? 0.5 : 0,
      pcie: ch === 6 ? 0.5 * chK : 0,
    },
    hiTray: ch === 1 && sc.view === 'cube' ? {face: 0.55 * viewK} : {},
  };
}

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeFilmCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.TPU = st;
    return {
      resize,
      render(t) {
        const sc = stateAtScript(t);
        const {lifts, pull} = liftsAt(EVENTS, t);
        const cam = camAt(t);
        const tc = lastChange(t);
        const ch = lastChapter(t);
        const viewKey = viewKeyOf(sc);
        const sceneT = sceneTAt(t);
        const hold = holdAt(t);
        const tv = lastView(t);
        const chK = ch.t === 0 ? 1 : ss(ch.t + hold + 0.3, ch.t + hold + 1.5, t);
        const look = {...lookOf(sc, sceneT, chK, ch.prev, t, {viewK: tv === 0 && sc.view !== 'cube' ? 1 : ss(tv + 0.3, tv + 1.5, t)}), lifts};
        st.frame(look, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const wait = labelWait(sc.chapter, hold);
        const labelO = tc === 0 ? 1 : ss(tc + wait, tc + wait + 0.6, t);
        frame({sc, viewKey, labelO, exOpen: sc.chapter === 2, sceneT, pull, cursor: cursorAt(t), look});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
