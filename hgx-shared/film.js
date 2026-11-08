// The server film: the DGX B200 (chassis.js, trays.js), what stands around it (cluster.js) and the overlays (overlay.js)
// in the studio (stage.js) under the Japanese console (console.js). The operator looks at the front, takes the bezel off
// and goes round the back, pulls the motherboard tray out and lifts the layers, fans the 18 links of GPU 0 out to the two
// NVSwitch chips and sends a bead through one, runs into the wall at the 9th GPU, lines up 9 boxes on 8 rails, runs the
// 2-stage all-reduce and races it against NVL72, follows the current from the 6 supplies, fills a 42U rack until the
// power runs out, and blows air through the box. A pure function of t: every pose comes from the script (script.js),
// kin.js and flow.js.
import {runSim} from 'teardown-kit/runtime.js';
import * as THREE from 'three';
import {makeCursor} from '../kit/cursor.js';
import {createConsole, SUB_NOTE} from './console.js';
import {captionOf} from './flow.js';
import {airAt, bezelAt, DT_SRC, fanAt, gaugesAt, hopAt, liftsAt, rackAt, railsAt, SCENES, SPEC, vs72At} from './kin.js';
import {bezelEventsOf, DURATION, explodeEventsOf, holdOf, lookTargetOf, SCRIPT, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'hgx', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ views (metres, degrees); u = seconds since the view came on
export const VIEW_FN = {
  front: (u) => ({tx: 0, ty: 0.22, tz: 0, az: 28 + 0.4 * u, el: 14, d: 3.0, sx: 60, sy: -26}),
  bezel: (u) => ({tx: 0, ty: 0.22, tz: 0.12, az: 20 + 0.4 * u, el: 11, d: 2.6, sx: 60, sy: -26}),
  back: (u) => ({tx: 0, ty: 0.2, tz: -0.1, az: 166 + 0.3 * u, el: 12, d: 2.8, sx: 0, sy: -26}),
  open: (u) => ({tx: 0.0, ty: 0.3, tz: -0.42, az: 116 + 0.3 * u, el: 40, d: 4.5, sx: 0, sy: -6}),
  nvlink: (u) => ({tx: 0, ty: 0.21, tz: -0.04, az: 10 + 0.2 * u, el: 68, d: 2.45, sx: 0, sy: -14}),
  wall: (u) => ({tx: 0.35, ty: 0.46, tz: -0.25, az: 10 + 0.2 * u, el: 20, d: 4.6, sx: 0, sy: -12}),
  rails: (u) => ({tx: 2.3, ty: 0.32, tz: -0.25, az: -26 + 0.15 * u, el: 27, d: 12.6, sx: -10, sy: -14}),
  vs72: (u) => ({tx: 3.1, ty: 0.9, tz: 0, az: 0.15 * u, el: 10, d: 14.8, sx: -40, sy: -20}),
  power: (u) => ({tx: 0, ty: 0.2, tz: -0.3, az: 160 + 0.3 * u, el: 16, d: 2.5, sx: 0, sy: -26}),
  rack: (u) => ({tx: -2.6, ty: 1.02, tz: 0.15, az: 26 + 0.2 * u, el: 9, d: 7.6, sx: 0, sy: -14}),
  air: (u) => ({tx: 0, ty: 0.22, tz: -0.04, az: 72 - 0.3 * u, el: 15, d: 3.5, sx: 30, sy: -26}),
};
/** which camera a state looks through */
export const viewKeyOf = (sc) => {
  switch (sc.chapter) {
    case 1:
      return sc.view === 'back' ? 'back' : sc.view === 'bezel' ? 'bezel' : 'front';
    case 2:
      return 'open';
    case 3:
      return 'nvlink';
    case 4:
      return sc.scene === 'rails' ? 'rails' : 'wall';
    case 5:
      return sc.scene === 'vs72' ? 'vs72' : 'rails';
    case 6:
      return sc.scene === 'rack' ? 'rack' : 'power';
    default:
      return 'air';
  }
};
// [when the camera starts to move, view]. After a chapter press that sends the tray back, the camera waits (holdOf).
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
  let key = viewKeyOf(stateAtScript(0, script));
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
/** how long the camera is holding at t (the tray is still going back after the last chapter press) */
export const holdAt = (t, script = SCRIPT) => {
  const ch = lastChapter(t, script);
  return ch.t > 0 && ch.t === lastChange(t, script) ? holdOf(ch.prev, ch.n) : 0;
};
/** seconds after a press that the labels wait: the camera and the pull settle first (the pull takes longer in chapter 2) */
export const labelWait = (chapter, hold = 0) => (chapter === 2 ? 3.3 : 1.5) + hold;
/** the temperature difference at t: it glides to a new value over 0.8 s after the slider press */
export const dTAt = (t, script = SCRIPT) => {
  let v = DT_SRC;
  let from = v;
  let t0 = -9;
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      v = from = DT_SRC;
      t0 = -9;
    }
    if (e.dT !== undefined) {
      from = from + (v - from) * ss(t0, t0 + 0.8, e.t);
      v = e.dT;
      t0 = e.t;
    }
  }
  return from + (v - from) * ss(t0, t0 + 0.8, t);
};
const EVENTS = explodeEventsOf();
const BEZ = bezelEventsOf();

// ------------------------------------------------------------ the operator's pointer
export function makeFilmCursor(ui) {
  const presses = [];
  for (const e of SCRIPT) {
    if (e.t <= 0) continue;
    if (e.chapter !== undefined) presses.push({t: e.t, spot: ui.spots[`c_${e.chapter}`]});
    else if (e.view !== undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.view}`]});
    if (e.scene && e.chapter === undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.scene}`]});
    if (e.dT !== undefined) presses.push({t: e.t, spot: ui.spots[`dT_${e.dT}`]});
    if (e.limit !== undefined) presses.push({t: e.t, spot: ui.spots[`lim_${e.limit}`]});
  }
  return makeCursor(presses, [[880, 560], [760, 480], [940, 540], [820, 520]]);
}

// ------------------------------------------------------------ the labels, per view, from the box's anchors
// side: 'l' / 'r' a column beside the model (rows ordered by the anchors' height), 'u' / 'd' a row above / below it,
// 'a' the side the anchor is on
const LABELS = {
  front: [
    ['bezel', 'ベゼル', '外すとファンと U.2 が見える', 'l'],
    ['chassisTop', 'DGX B200（10U）', '444 × 482.3 × 897.1 mm・最大 142.4 kg', 'u'],
  ],
  bezel: [
    ['fans', 'ファンモジュール', '1 個にファン 2 つ・30 秒以内に交換', 'u'],
    ['u2', 'U.2 NVMe × 8', '3.84 TB・RAID 0 のキャッシュ', 'l'],
    ['btn', '電源・ID ボタン', '故障 LED も前面', 'd'],
  ],
  back: [
    ['psu', '電源 × 6（PSU0〜5）', `${SPEC.power.psuKW} kW・5+1 の冗長`, 'a'],
    ['exhaust', 'GPU トレイの排気口', '温まった空気が出る', 'a'],
    ['osfp', 'OSFP × 4', '1 個に 2 ポート・ConnectX-7 へ', 'a'],
    ['bf3Port', 'BlueField-3 のポート', 'QSFP112・ストレージと管理', 'a'],
    ['mgmt', '管理ポート', 'BMC 1 GbE・10 GbE', 'a'],
    ['mbHandle', 'マザーボードトレイ', '後ろへ引き抜く', 'a'],
  ],
  open: [
    ['lid', '天板', '最初に持ち上がる', 'u'],
    ['gpu', 'B200 × 8', 'HBM3e 180 GB・8 TB/s', 'u'],
    ['nvs', 'NVSwitch チップ × 2', '基板の中ほど', 'u'],
    ['cpu', 'Xeon Platinum 8570 × 2', '56 コア・2.1 GHz', 'd'],
    ['dimm', 'DIMM × 32', '64 GB・合計 2 TB', 'd'],
    ['cx7', 'ConnectX-7 × 8', '400 Gb/s・GPU 1 個に 1 枚', 'd'],
    ['bf3', 'BlueField-3 × 2', '400 Gb/s・ストレージと管理', 'd'],
  ],
  nvlink: [['board', 'HGX B200 の基板', 'ヒートシンクを外して見せる', 'r']],
  power: [
    ['psuOn', '電源 × 5（PSU0〜4）', `${SPEC.power.psuKW} kW × 5 = ${SPEC.power.need * SPEC.power.psuKW} kW`, 'a'],
    ['psuSpare', 'PSU5（6 台目）', '予備・1 台壊れても止まらない', 'a'],
  ],
  air: [
    ['fans', 'ファンモジュール（前面）', '冷たい空気を吸う', 'a'],
    ['exhaust', '背面の排気口', '温まった空気が出る', 'a'],
  ],
};
const VP = {x0: 350, x1: 1250, y0: 156, y1: 742};
const LH = 44;
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
/** the model's extent on screen [minX, maxX, minY, maxY] (the box and its trays, the overlays left out) */
function screenSpan(st) {
  let x0 = 1e9;
  let x1 = -1e9;
  let y0 = 1e9;
  let y1 = -1e9;
  for (const g of [st.box.G.fixed, st.box.gpu.root, st.box.mb.root]) {
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
    const [mx0, mx1, my0, my1] = screenSpan(st);
    const mid = (mx0 + mx1) / 2;
    const pts = list
      .map(([a, name, sub, side]) => {
        const at = st.project(...st.box.anchor(a).toArray());
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

/** draws the console from the frame's state: s = {sc, viewKey, labelO, exOpen, sceneT, dT, pull, cursor, look} */
export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const sc = s.sc;
    const scene = sc.scene;
    const opts = {dT: s.dT, limit: sc.limit, from: sc.from};
    const g = gaugesAt(scene, s.sceneT ?? 0, opts);
    const lit = litOf(sc, s.exOpen);
    ui.update({
      chapter: sc.chapter,
      lit,
      note: SUB_NOTE[Object.keys(lit).find((k) => SUB_NOTE[k]) ?? ''] ?? (scene ? SCENES[scene].sub : ''),
      scene,
      g,
      dT: s.dT,
      limit: sc.limit,
      pull: s.pull,
      caption: s.labelO > 0.5 || sc.chapter >= 3 ? captionOf(scene, s.sceneT ?? 0, opts) : '',
      tags: st.over.overlay(s.look, st.project),
      callouts: labels(s.viewKey, s.labelO),
      cursor: s.cursor,
    });
  };
}

/** the look of a chapter, k = 0..1 since the chapter press, from the chapter before */
export function lookOf(sc, sceneT, chK, prevChapter, T, extra = {}) {
  const a = lookTargetOf(prevChapter);
  const b = lookTargetOf(sc.chapter);
  const mix = (key) => a[key] + (b[key] - a[key]) * (key === 'lidAway' ? extra.chKTray ?? chK : chK);
  const scene = sc.scene;
  const ch = sc.chapter;
  const t = sceneT;
  const hiGpu = {};
  const hiNvs = {};
  const hi = {};
  if (ch === 3 && scene === 'fan') {
    const f = fanAt(t);
    hiGpu[SPEC.demo.hopFrom] = 0.8;
    f.perChip.forEach((n, c) => (hiNvs[c] = n > 0 ? 0.85 : 0));
  }
  if (ch === 3 && scene === 'hop') {
    const h = hopAt(t);
    hiGpu[h.a] = 0.8;
    if (h.legIndex >= 2) hiNvs[h.chip] = 0.85;
    if (h.legIndex >= 4 || h.done) hiGpu[h.b] = 0.8;
  }
  if (ch === 4 && scene === 'wall') {
    hiGpu[SPEC.demo.wallGpu] = 0.8;
    hi.nic0 = 0.8 * chK;
    hi.osfp4 = 0.8 * chK;
  }
  if (ch === 6 && scene === 'power') hi.psu = 0.45 * chK;
  if (ch === 7) hi.fans = 0.3 * chK;
  const cl = mix('cluster');
  const air = airAt(t, extra.dT ?? DT_SRC);
  return {
    chapter: ch,
    scene,
    sceneT,
    T,
    dT: extra.dT ?? DT_SRC,
    limit: sc.limit ?? SPEC.rack.limitDefault,
    from: sc.from ?? 0,
    reduced: !!extra.reduced,
    bezel: extra.bezel ?? 0,
    lidAway: mix('lidAway'),
    ghost: mix('ghost'),
    sides: mix('sides'),
    cluster: cl,
    boxes: scene === 'wall' ? 1 : 8,
    allLeaves: scene !== 'wall',
    leaf0: ch === 4 && scene === 'wall' ? 0.6 : 0,
    markers: scene === 'rails' || scene === 'hier' || scene === 'vs72',
    markLit: scene === 'rails' ? railsAt(t).lit : 0,
    railK: scene === 'rails' ? railsAt(t).k : 1,
    nvK: ch === 5 && scene === 'vs72' ? chK : 0,
    bars: scene === 'vs72' ? (({dgxMs, nvMs}) => ({dgx: dgxMs, nv: nvMs}))(vs72At(t)) : {dgx: 0, nv: 0},
    rackK: ch === 6 && scene === 'rack' ? chK : 0,
    rack: rackAt(t, sc.limit ?? SPEC.rack.limitDefault, sc.from ?? 0),
    airSpeed: air.speed,
    powerK: 1,
    hi,
    hiGpu,
    hiNvs,
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
    window.HGX = st;
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
        const dT = dTAt(t);
        const hold = holdAt(t);
        const bezel = bezelAt(BEZ, t);
        const look = {...lookOf(sc, sceneT, ch.t === 0 ? 1 : ss(ch.t + hold + 0.3, ch.t + hold + 1.5, t), ch.prev, t, {dT, bezel, chKTray: ch.t === 0 ? 1 : ss(ch.t + 0.3, ch.t + 1.5, t)}), lifts};
        st.frame(look, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const wait = labelWait(sc.chapter, hold);
        const labelO = tc === 0 ? 1 : ss(tc + wait, tc + wait + 0.6, t);
        frame({sc, viewKey, labelO, exOpen: sc.chapter === 2, sceneT, dT, pull, cursor: cursorAt(t), look});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
