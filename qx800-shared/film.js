// The Q3400 film: the box (box.js, board.js), the diagrams (fabric.js, lanes.js, ring.js) and the wind (air.js) in the
// studio (stage.js) under the Japanese console (console.js). The operator looks at the front beside the Catalyst's
// outline and at the back, lifts the lid and the layers, watches the SM hand out the tables and a packet look one up,
// compares the Catalyst's tail drop with InfiniBand's credits and Ethernet's PFC, lights one leaf's 72 down and 72 up,
// lets the leaf route around a busy exit, runs the ring and the SHARP all-reduce, and follows the wind through the box.
// A pure function of t: every pose comes from the script (script.js), kin.js and flow.js.
import {runSim} from 'teardown-kit/runtime.js';
import * as THREE from 'three';
import {makeCursor} from '../kit/cursor.js';
import {createConsole, SUB_NOTE} from './console.js';
import {captionOf} from './flow.js';
import {gaugesAt, liftsAt, SCENES} from './kin.js';
import {DURATION, explodeEventsOf, holdOf, lookTargetOf, SCRIPT, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'qx800', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ views (metres, degrees); u = seconds since the view came on
export const VIEW_FN = {
  front: (u) => ({tx: -0.25, ty: 0.12, tz: 0.15, az: 20 + 0.3 * u, el: 15, d: 2.35, sx: 0, sy: -30}),
  back: (u) => ({tx: 0, ty: 0.1, tz: -0.1, az: 152 + 0.3 * u, el: 15, d: 2.0, sx: 0, sy: -30}),
  open: (u) => ({tx: 0, ty: 0.2, tz: -0.1, az: 30 + 0.25 * u, el: 34, d: 2.85, sx: 0, sy: -24}),
  fabric: (u) => ({tx: 5.68, ty: 0.84, tz: 0, az: -3 + 0.1 * u, el: 5, d: 5.8, sx: 0, sy: -26}),
  fabric5: (u) => ({tx: 5.92, ty: 0.86, tz: 0, az: 5 - 0.1 * u, el: 6, d: 5.0, sx: 0, sy: -26}),
  drop: (u) => ({tx: -6.09, ty: 1.7, tz: 0, az: 3 + 0.1 * u, el: 4, d: 2.9, sx: 0, sy: -26}),
  credit: (u) => ({tx: -6.09, ty: 1.15, tz: 0, az: 3 + 0.1 * u, el: 4, d: 2.9, sx: 0, sy: -26}),
  pfc: (u) => ({tx: -6.09, ty: 0.6, tz: 0, az: 3 + 0.1 * u, el: 6, d: 2.9, sx: 0, sy: -26}),
  ring: (u) => ({tx: 12, ty: 0.95, tz: 0, az: 5 + 0.12 * u, el: 4, d: 5.4, sx: 0, sy: -26}),
  air: (u) => ({tx: 0, ty: 0.1, tz: 0, az: 56 + 0.25 * u, el: 32, d: 2.1, sx: 0, sy: -24}),
};
/** which camera a state looks through */
export const viewKeyOf = (sc) => {
  if (sc.chapter === 1) return sc.view === 'back' ? 'back' : 'front';
  if (sc.chapter === 4) return sc.scene ?? 'drop';
  return ['', '', 'open', 'fabric', '', 'fabric5', 'ring', 'air'][sc.chapter];
};
// [when the camera starts to move, view]. After a chapter press that closes the box, the camera waits (holdOf).
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
// blend two cameras: the distance in log space, so a zoom reads as one move. A move between two places far apart (the
// box and a diagram) cuts at the middle instead of flying across the floor.
const far = (a, b) => Math.hypot(a.tx - b.tx, a.tz - b.tz) > 3;
export const blendCam = (a, b, k) => {
  if (far(a, b)) return k > 0 ? {...b} : {...a};
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
/** seconds of the last press that changes what is on screen (chapter / view / a chapter 4 lane), for the label fade */
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
/** how long the camera is holding at t (the layers are still going down after the last chapter press) */
export const holdAt = (t, script = SCRIPT) => {
  const ch = lastChapter(t, script);
  return ch.t > 0 && ch.t === lastChange(t, script) ? holdOf(ch.prev, ch.n) : 0;
};
/** seconds after a press that the labels wait: the camera and the lift settle first (the lift takes longer in chapter 2) */
export const labelWait = (chapter, hold = 0) => (chapter === 2 ? 2.2 : 1.5) + hold;
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
  return makeCursor(presses, [[880, 600], [760, 560], [940, 620], [820, 580]]);
}

// ------------------------------------------------------------ the labels, per view, from the box's anchors
// side: 'l' / 'r' a column beside the model (rows ordered by the anchors' height), 'u' / 'd' a row above / below it
const LABELS = {
  front: [
    ['cat', 'Catalyst 9300 の外形', '1U・445 × 409 mm（灰色の線）', 'u'],
    ['cages', 'OSFP ケージ × 72', '1 ケージに 800G × 2・3 区画', 'u'],
    ['ufm', 'UFM 専用ポート', 'OSFP 400G・少し離して置く', 'd'],
    ['rj45', 'RJ-45 × 2・USB', '管理 Ethernet・コンソール', 'd'],
    ['cagesLo', '4 段 × 6 列 × 3 区画', '並びは仮定', 'd'],
  ],
  back: [
    ['psu', '電源 × 8', '左右に 4 台ずつ（並びは仮定）', 'u'],
    ['fan', 'ファン × 10', '5 × 2（並びは仮定）', 'u'],
    ['exhaust', '排気', '電源の側へ出す', 'd'],
  ],
  open: [
    ['lid', '天板', '最初に持ち上がる', 'u'],
    ['sink', 'ヒートシンク × 4', 'フィンは風の向き', 'u'],
    ['cpu', '管理用 CPU の基板', 'i3-8100H・NVOS', 'l'],
    ['chip', 'Quantum-3 × 4', '計算 115.2 ÷ 28.8・並びは仮定', 'r'],
    ['bundle', '配線の束 × 4', 'チップ → ケージ・つなぎ方は非公表', 'd'],
    ['psuOpen', '電源 × 8', '交流 200–240 V', 'r'],
    ['fanOpen', 'ファン × 10', '前から後ろへ風を通す', 'r'],
  ],
  air: [
    ['intake', '吸気（前・ポートの側）', '淡い色: 冷たい空気', 'l'],
    ['exhaust', '排気（後ろ・電源の側）', '濃い色: 温まった空気', 'r'],
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
/** the model's extent on screen [minX, maxX, minY, maxY] (the box, and the Catalyst's outline in the front view) */
function screenSpan(st, key) {
  let x0 = 1e9;
  let x1 = -1e9;
  let y0 = 1e9;
  let y1 = -1e9;
  const G = st.box.G;
  const groups = key === 'front' ? [G.body, G.lid, G.rear, G.ghost] : [G.body, G.lid, G.rear];
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
    const pts = list
      .map(([a, name, sub, side]) => {
        const at = st.project(...st.box.anchor(a).toArray());
        return {name, sub, at, side, w: Math.ceil(Math.max(tw(name, 16) + 40, tw(sub, 13) + 40))};
      })
      .filter((p) => p.at && p.at[0] > VP.x0 - 40 && p.at[0] < VP.x1 + 40 && p.at[1] > VP.y0 - 40 && p.at[1] < VP.y1 + 40);
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
/** draws the console from the frame's state: s = {sc, viewKey, labelO, exOpen, sceneT, lift, cursor, look} */
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
      lift: s.lift,
      caption: sc.chapter >= 3 ? captionOf(scene, s.sceneT ?? 0) : '',
      tags: st.overlay({...s.look, tagO: s.labelO}),
      callouts: labels(s.viewKey, s.labelO),
      cursor: s.cursor,
    });
  };
}
/** the look of a chapter, k = 0..1 since the chapter press, from the chapter before */
export function lookOf(sc, sceneT, chK, prevChapter, T, extra = {}) {
  const a = lookTargetOf(prevChapter);
  const b = lookTargetOf(sc.chapter);
  const mix = (key) => a[key] + (b[key] - a[key]) * chK;
  const ch = sc.chapter;
  return {
    chapter: ch,
    scene: sc.scene,
    sceneT,
    T,
    reduced: !!extra.reduced,
    ghost: mix('ghost'),
    lidSee: mix('lidSee'),
    hi: {
      cage: ch === 1 && sc.view !== 'back' ? 0.18 * chK : 0,
      ufm: ch === 1 && sc.view !== 'back' ? 0.6 * chK : 0,
      chip: ch === 2 ? 0.55 * chK : 0,
      fan: ch === 7 ? 0.35 * chK : 0,
    },
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
    window.QX = st;
    return {
      resize,
      render(t) {
        const sc = stateAtScript(t);
        const {lifts} = liftsAt(EVENTS, t);
        const cam = camAt(t);
        const tc = lastChange(t);
        const ch = lastChapter(t);
        const viewKey = viewKeyOf(sc);
        const sceneT = sceneTAt(t);
        const hold = holdAt(t);
        const look = {...lookOf(sc, sceneT, ch.t === 0 ? 1 : ss(ch.t + hold + 0.3, ch.t + hold + 1.5, t), ch.prev, t), lifts};
        st.frame(look, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const wait = labelWait(sc.chapter, hold);
        const labelO = tc === 0 ? 1 : ss(tc + wait, tc + wait + 0.6, t);
        frame({sc, viewKey, labelO, exOpen: sc.chapter === 2, sceneT, lift: lifts[0], cursor: cursorAt(t), look});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
