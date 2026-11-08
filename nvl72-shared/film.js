// The rack film: the rack (rack.js, tray.js) and the overlays (overlay.js) in the studio (stage.js) under the Japanese
// console (console.js). The operator looks at the front and the back, pulls compute tray 3 out and lifts its layers,
// fans the 18 links out of one GPU and sends a bead through one NVSwitch, runs the ring and the SHARP all-reduce on the
// ring diagram, compares NVLink with the ConnectX-7 way out, follows the current from the power shelves and the coolant
// through the manifolds. A pure function of t: every pose comes from the script (script.js), kin.js and flow.js.
import {runSim} from 'teardown-kit/runtime.js';
import * as THREE from 'three';
import {makeCursor} from '../kit/cursor.js';
import {createConsole, SUB_NOTE} from './console.js';
import {captionOf} from './flow.js';
import {fanAt, gaugesAt, hopAt, liftsAt, SCENES, SPEC} from './kin.js';
import {DURATION, explodeEventsOf, holdOf, lookTargetOf, SCRIPT, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'nvl72', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ views (metres, degrees); u = seconds since the view came on
export const VIEW_FN = {
  front: (u) => ({tx: 0, ty: 1.12, tz: 0, az: 24 + 0.35 * u, el: 9, d: 7.4, sx: 0, sy: -26}),
  back: (u) => ({tx: 0, ty: 1.12, tz: 0, az: 152 + 0.35 * u, el: 9, d: 7.4, sx: 0, sy: -26}),
  open: (u) => ({tx: 0.04, ty: 1.79, tz: 1.0, az: 34 + 0.3 * u, el: 22, d: 3.0, sx: 0, sy: -20}),
  nvlink: (u) => ({tx: 0.0, ty: 1.22, tz: 0.05, az: 46 + 0.25 * u, el: 16, d: 6.3, sx: 0, sy: -26}),
  ring: (u) => ({tx: -0.6, ty: 1.2, tz: 0.25, az: 8 + 0.2 * u, el: 5, d: 6.3, sx: 0, sy: -24}),
  out: (u) => ({tx: -0.3, ty: 1.78, tz: 1.05, az: 28 + 0.25 * u, el: 24, d: 4.0, sx: 0, sy: -30}),
  power: (u) => ({tx: 0, ty: 1.12, tz: -0.1, az: 148 + 0.3 * u, el: 9, d: 7.3, sx: 0, sy: -26}),
  cool: (u) => ({tx: 0, ty: 1.14, tz: -0.1, az: 198 - 0.3 * u, el: 11, d: 7.0, sx: 0, sy: -26}),
};
/** which camera a state looks through */
export const viewKeyOf = (sc) => (sc.chapter === 1 ? (sc.view === 'back' ? 'back' : 'front') : ['', '', 'open', 'nvlink', 'ring', 'out', 'power', 'cool'][sc.chapter]);
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
/** seconds of the last press that changes what is on screen (chapter / view), for the label fade */
export const lastChange = (t, script = SCRIPT) => {
  let c = 0;
  for (const e of script) if (e.t <= t && (e.chapter !== undefined || e.view !== undefined)) c = e.t;
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
  let v = SPEC.cool.dTDefault;
  let from = v;
  let t0 = -9;
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      v = from = SPEC.cool.dTDefault;
      t0 = -9;
    }
    if (e.dT !== undefined) {
      from = v;
      v = e.dT;
      t0 = e.t;
    }
  }
  return from + (v - from) * ss(t0, t0 + 0.8, t);
};
const EVENTS = explodeEventsOf();

// ------------------------------------------------------------ the operator's pointer
export function makeFilmCursor(ui) {
  const presses = [];
  for (const e of SCRIPT) {
    if (e.t <= 0) continue;
    if (e.chapter !== undefined) presses.push({t: e.t, spot: ui.spots[`c_${e.chapter}`]});
    else if (e.view !== undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.view}`]});
    if (e.scene && e.chapter === undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.scene}`]});
    if (e.dT !== undefined) presses.push({t: e.t, spot: ui.spots[`dT_${e.dT}`]});
  }
  return makeCursor(presses, [[880, 560], [760, 480], [940, 540], [820, 520]]);
}

// ------------------------------------------------------------ the labels, per view, from the rack's anchors
// side: 'l' / 'r' a column beside the model (rows ordered by the anchors' height), 'u' / 'd' a row above / below it
const LABELS = {
  front: [
    ['tor', 'TOR スイッチ × 2', '管理用・最上段', 'l'],
    ['psTop', '電源棚 × 8', '上下に 4 台ずつ（位置は仮定）', 'l'],
    ['compute', '計算トレイ × 18', '1U・GPU 4 個ずつ', 'l'],
    ['switch', 'NVLink スイッチトレイ × 9', '1U・NVSwitch 2 個ずつ', 'l'],
    ['rackTop', 'ラック', '2,236 × 600 × 1,068 mm', 'r'],
    ['osfp', 'OSFP × 4（トレイごと）', 'ConnectX-7・400 Gb/s', 'r'],
    ['e1sFront', 'E1.S × 4（トレイごと）', 'NVMe 3.84 TB', 'r'],
  ],
  back: [
    ['cart', 'ケーブルカートリッジ × 4', '銅線 5,000 本超・光に変換しない', 'a'],
    ['bus', '母線（バスバー）', '直流 50 V', 'a'],
    ['manS', 'マニホールド（行き）', '冷たい液', 'a'],
    ['manR', 'マニホールド（帰り）', '温まった液', 'a'],
    ['conn', '背面のコネクタ', '差し込むだけでつながる', 'a'],
    ['psBackTop', '電源棚（背面）', '上段の 1 台・空冷のファン', 'a'],
  ],
  open: [
    ['lid', '天板', '最初に持ち上がる', 'u'],
    ['plate', 'コールドプレート', 'Grace・B200・ConnectX-7', 'u'],
    ['gpu', 'B200 GPU × 4', 'HBM3e 186 GB・8 TB/s', 'u'],
    ['grace', 'Grace CPU × 2', '72 コア・LPDDR5X 480 GB', 'd'],
    ['cx7', 'ConnectX-7 × 4', '400G OSFP・GPU 1 個に 1 枚', 'd'],
    ['bf3', 'BlueField-3 × 2', '400G × 2・ストレージと管理', 'd'],
    ['e1s', 'E1.S NVMe × 4', '3.84 TB・RAID 0 のキャッシュ', 'd'],
  ],
  nvlink: [
    ['cart', 'ケーブルカートリッジ', '銅線で直結（光に変換しない）', 'a'],
    ['switchFace', 'スイッチトレイ × 9', '前へ少し出して中を見せる', 'a'],
  ],
  out: [
    ['gpu1', 'B200 GPU 1', 'ここから送る', 'd'],
    ['cx71', 'ConnectX-7（1 枚目）', 'GPU 1 個に 1 枚', 'd'],
    ['osfp1', '前面の OSFP', '400 Gb/s・双方向で 100 GB/s', 'd'],
  ],
  power: [
    ['psBack', '電源棚 × 4（上）', `${SPEC.power.psuKW} kW × ${SPEC.power.psuPerShelf}・空冷`, 'a'],
    ['psBackLo', '電源棚 × 4（下）', '位置は仮定', 'a'],
    ['bus', '母線（バスバー）', `直流 ${SPEC.power.busV} V`, 'a'],
    ['busMid', '各トレイへ', '差し込むだけでつながる', 'a'],
  ],
  cool: [
    ['manS', 'マニホールド（行き）', '淡い線・冷たい液', 'r'],
    ['hose', '差し口', '各トレイへ 1 組', 'r'],
    ['psFan', '空冷: 電源棚 × 4（上）', 'ファンで冷やす（灰色）', 'r'],
    ['psFanLo', '空冷: 電源棚 × 4（下）', '液は通らない', 'r'],
    ['manR', 'マニホールド（帰り）', '濃い線・温まった液', 'l'],
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
/** the model's extent on screen [minX, maxX, minY, maxY] (the rack and the pulled tray, the overlays left out) */
function screenSpan(st, key) {
  let x0 = 1e9;
  let x1 = -1e9;
  let y0 = 1e9;
  let y1 = -1e9;
  const groups = key === 'open' || key === 'out' ? [st.rack.tray.root] : [st.rack.G.fixed, st.rack.tray.root];
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
    // columns: beside the model, rows in the order of the anchors' height, pushed apart, then swapped while leaders cross
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
        if (over > 0) for (let i = ys.length - 1; i >= 0; i--) ys[i] = Math.min(ys[i], (i === ys.length - 1 ? VP.y1 - LH : ys[i + 1] - LH - 10));
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
    // rows above and below (the flat pulled tray): one tier left to right in the order of the anchors' x
    let a0 = Math.max(VP.y0, my0 - 16 - LH);
    let b0 = Math.min(VP.y1 - LH, my1 + 16);
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
    // numbered: the left column, the row above, the row below, the right column
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
    const g = gaugesAt(scene, s.sceneT ?? 0, {dT: s.dT});
    const lit = litOf(sc, s.exOpen);
    ui.update({
      chapter: sc.chapter,
      lit,
      note: SUB_NOTE[Object.keys(lit).find((k) => SUB_NOTE[k]) ?? ''] ?? (scene ? SCENES[scene].sub : ''),
      scene,
      g,
      dT: s.dT,
      pull: s.pull,
      caption: s.labelO > 0.5 || sc.chapter >= 3 ? captionOf(scene, s.sceneT ?? 0, {dT: s.dT}) : '',
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
  // the lid goes with the tray (chKTray, no hold); everything else waits for the tray to be in (chK)
  const mix = (key) => a[key] + (b[key] - a[key]) * (key === 'lidAway' ? extra.chKTray ?? chK : chK);
  const scene = sc.scene;
  const ch = sc.chapter;
  const hopChip = scene === 'hop' ? hopAt(sceneT).chip : -1;
  const fanLit = scene === 'fan' ? fanAt(sceneT).lit : 0;
  return {
    chapter: ch,
    scene,
    sceneT,
    T,
    dT: extra.dT ?? SPEC.cool.dTDefault,
    reduced: !!extra.reduced,
    slide: mix('slide'),
    ghostSw: mix('slide'),
    sides: mix('sides'),
    lidAway: mix('lidAway'),
    ringK: ch === 4 ? chK : 0,
    flowK: ch === 7 ? (extra.dT ? (10 / extra.dT) : 1) : 1,
    // the chips in the accent: the one the hop goes through, or every chip a fan line has reached
    chip: ch === 3 ? hopChip : -1,
    chipsLit: ch === 3 ? fanLit : 0,
    hi: {
      power: ch === 6 ? 0.35 * chK : 0,
      bus: ch === 6 ? 0.75 * chK : 0,
      manS: ch === 7 ? 0.3 * chK : 0,
      manR: ch === 7 ? 0.65 * chK : 0,
      cart: ch === 3 ? 0.4 * chK : 0,
      plate: ch === 7 ? 0.5 * chK : 0,
    },
    hiTray: ch === 5 ? {gpu1: 0.7 * chK, cx71: 0.7 * chK, osfp1: 0.8 * chK} : {},
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
    window.NV = st;
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
        const look = {...lookOf(sc, sceneT, ch.t === 0 ? 1 : ss(ch.t + hold + 0.3, ch.t + hold + 1.5, t), ch.prev, t, {dT, chKTray: ch.t === 0 ? 1 : ss(ch.t + 0.3, ch.t + 1.5, t)}), lifts};
        st.frame(look, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        // the labels wait for the camera and the pull to settle
        const wait = labelWait(sc.chapter, hold);
        const labelO = tc === 0 ? 1 : ss(tc + wait, tc + wait + 0.6, t);
        frame({sc, viewKey, labelO, exOpen: sc.chapter === 2, sceneT, dT, pull, cursor: cursorAt(t), look});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
