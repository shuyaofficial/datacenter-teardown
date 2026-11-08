// The switch film: the chassis (chassis.js) in its studio (stage.js) under the Japanese console (console.js). The
// operator looks at the front and the back, presses 蓋を開ける (cover, heatsink, NM, PSU lift one after another from the
// top layer down), splits the board into the data plane and the control plane, follows one frame through the 12 stages
// of the magnified ASIC (asic.js), punts an ARP to the CPU, fills the egress queue of Gi1/0/3 and shows the air and the
// PoE budget. A pure function of t: every pose comes from the script (script.js), kin.js and flow.js.
import {runSim} from 'teardown-kit/runtime.js';
import * as THREE from 'three';
import {makeCursor} from '../kit/cursor.js';
import {createConsole, SUB_NOTE} from './console.js';
import {liftsAt, packetAt, puntAt, queueAt, SCENES, SPEC, STAGE_IDS} from './kin.js';

const STAGE_IFC = STAGE_IDS.indexOf('ifc');
import {captionOf, portLook} from './flow.js';
import {awayOf, DURATION, explodeEventsOf, SCRIPT, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'switch', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ views (metres, degrees); u = seconds since the view came on
export const VIEW_FN = {
  front: (u) => ({tx: 0.0, ty: 0.012, tz: 0.01, az: 28 + 0.5 * u, el: 24, d: 1.4, sx: 0, sy: -10}),
  back: (u) => ({tx: 0.0, ty: 0.012, tz: -0.01, az: 152 + 0.5 * u, el: 24, d: 1.4, sx: 0, sy: -10}),
  open: (u) => ({tx: 0.0, ty: 0.05, tz: 0.0, az: 22 + 0.5 * u, el: 44, d: 2.2, sx: 0, sy: -2}),
  planeD: (u) => ({tx: 0.0, ty: 0.03, tz: 0.01, az: 16 + 0.4 * u, el: 58, d: 2.15, sx: 0, sy: -4}),
  planeC: (u) => ({tx: 0.04, ty: 0.03, tz: 0.0, az: 24 + 0.4 * u, el: 58, d: 2.15, sx: 0, sy: -4}),
  // chapter 4: the magnified drawing, or (while the frame enters and leaves) the ports, the PHYs and the real ASIC
  asic: (u, x = {}) => {
    const hi = {tx: -0.034, ty: 0.06, tz: -0.03, az: -1 + 0.2 * u, el: 52, d: 0.84, sx: 0, sy: 4};
    const lo = {tx: -0.105, ty: 0.012, tz: 0.13, az: 12 + 0.2 * u, el: 28, d: 0.56, sx: 0, sy: -4};
    const w = portLook(x.scene, x.sceneT ?? 0);
    return w <= 0 ? hi : blendCam(hi, lo, w);
  },
  rwe: (u) => ({tx: -0.045, ty: 0.08, tz: 0.03, az: -3 + 0.2 * u, el: 54, d: 0.46, sx: 0, sy: 0}),
  punt: (u) => ({tx: 0.05, ty: 0.042, tz: 0.045, az: 3 + 0.2 * u, el: 22, d: 0.6, sx: 0, sy: -14}),
  congest: (u) => ({tx: -0.085, ty: 0.04, tz: 0.11, az: -10 + 0.2 * u, el: 24, d: 0.6, sx: 0, sy: -16}),
  side: (u) => ({tx: 0.0, ty: 0.02, tz: 0.0, az: 74 + 0.3 * u, el: 28, d: 1.2, sx: 30, sy: 24}),
  whole: (u) => ({tx: 0.0, ty: 0.012, tz: 0.01, az: 24 + 0.4 * u, el: 30, d: 1.35, sx: 70, sy: 50}),
};
/** which camera a state looks through */
export const viewKeyOf = (sc) => {
  if (sc.chapter === 1) return sc.view === 'back' ? 'back' : 'front';
  if (sc.chapter === 2) return 'open';
  if (sc.chapter === 3) return sc.plane === 'ctrl' ? 'planeC' : 'planeD';
  if (sc.chapter === 4) return sc.zoom === 'rwe' ? 'rwe' : 'asic';
  if (sc.chapter === 5) return 'punt';
  if (sc.chapter === 6) return 'congest';
  return sc.sub7 === 'poe' ? 'whole' : 'side';
};
const CAMS = (() => {
  const out = [];
  for (const e of SCRIPT) {
    const key = viewKeyOf(stateAtScript(e.t));
    if (!out.length || out[out.length - 1][1] !== key) out.push([e.t, key]);
  }
  return out;
})();
// blend two cameras: the distance in log space, so a zoom reads as one move
export const blendCam = (a, b, k) => {
  const o = {};
  for (const key in b) o[key] = key === 'az' ? a.az + ((((b.az - a.az + 540) % 360) - 180) * k) : a[key] + (b[key] - a[key]) * k;
  o.d = Math.exp(Math.log(a.d) + (Math.log(b.d) - Math.log(a.d)) * k);
  return o;
};
export const camAt = (t) => {
  let i = 0;
  while (i < CAMS.length - 1 && CAMS[i + 1][0] <= t) i++;
  const x = {scene: stateAtScript(t).scene, sceneT: sceneTAt(t)};
  const cur = VIEW_FN[CAMS[i][1]](t - CAMS[i][0], x);
  if (i > 0) {
    const k = ss(CAMS[i][0], CAMS[i][0] + 1.8, t);
    if (k < 1) return blendCam(VIEW_FN[CAMS[i - 1][1]](t - CAMS[i - 1][0], x), cur, k);
  }
  return cur;
};
/** seconds of the last press that changes what is on screen (chapter / view / plane), for fades */
export const lastChange = (t, script = SCRIPT) => {
  let c = 0;
  for (const e of script) if (e.t <= t && (e.chapter !== undefined || e.view !== undefined || e.plane !== undefined || e.zoom !== undefined || e.sub7 !== undefined)) c = e.t;
  return c;
};
/** the last chapter press at or before t, and the chapter before it */
export const lastChapter = (t, script = SCRIPT) => {
  let c = {t: 0, prev: 1, n: 1};
  for (const e of script) if (e.t <= t && e.chapter !== undefined) c = {t: e.t, prev: c.n, n: e.chapter};
  return c;
};
/** [cover, heatsink] away for chapter n entered from chapter prev, k = 0..1 since the press: what was away stays away */
export const awayAt = (n, prev, k) => {
  const a = awayOf(n);
  const b = awayOf(prev);
  return a.map((v, i) => (v && b[i] ? 1 : v * k));
};
/** the overlays' fade-ins for chapter n, k = 0..1 since the chapter press */
export const looksOf = (n, sub7, k) => ({boardK: n === 4 ? k : 0, puntK: n === 5 ? k : 0, queueK: n === 6 ? k : 0, airK: n === 7 && sub7 !== 'poe' ? k : 0, fanK: n === 7 && sub7 !== 'poe' ? k : 0});
const EVENTS = explodeEventsOf();

// ------------------------------------------------------------ the operator's pointer
export function makeFilmCursor(ui) {
  const presses = [];
  for (const e of SCRIPT) {
    if (e.t <= 0) continue;
    if (e.chapter !== undefined) presses.push({t: e.t, spot: ui.spots[`c_${e.chapter}`]});
    else if (e.view !== undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.view}`]});
    if (e.plane) presses.push({t: e.t, spot: ui.spots[`s_${e.plane}`]});
    if (e.scene) presses.push({t: e.t, spot: ui.spots[`s_${e.scene}`]});
    if (e.mult) presses.push({t: e.t, spot: ui.spots[`s_m${e.mult}`]});
    if (e.sub7) presses.push({t: e.t, spot: ui.spots[`s_${e.sub7}`]});
  }
  return makeCursor(presses, [[880, 560], [760, 480], [940, 540], [820, 520]]);
}

// ------------------------------------------------------------ the labels, per view, from the chassis' anchors
const LABELS = {
  front: [
    ['rj45', 'RJ-45 × 48', '1G PoE+・上下 2 段 × 24', 'u'],
    ['gi1', 'Gi1/0/1 と Gi1/0/2', '上段左端が 1、その下が 2', 'u'],
    ['cover', '筐体 1U', '445 × 44 × 409 mm・7.59 kg', 'u'],
    ['nm', 'ネットワークモジュール', 'NM-8X・10G SFP+ × 8', 'd'],
    ['usb', 'USB-A / USB コンソール', '前面の左端', 'd'],
    ['led', '状態 LED', '色だけ（光らせない）', 'd'],
  ],
  back: [
    ['psu', '電源 PWR-C1-715WAC-P', '715 W・80 PLUS Platinum', 'u'],
    ['blank', '電源ベイ 2', '空き（蓋）', 'u'],
    ['fans', 'ファン × 3', '可変速・N+1', 'u'],
    ['stack', 'スタックポート × 2', '複数台をつなぐ', 'd'],
    ['stackpwr', 'StackPower × 2', '電源の融通', 'd'],
    ['console', 'RJ-45 コンソール', '管理ポートはその右', 'd'],
    ['ssd', 'SSD スロット', '背面の右下', 'd'],
  ],
  open: [
    ['cover', '天板', '最初に持ち上がる', 'u'],
    ['heat', 'ヒートシンク', 'ASIC の熱を逃がす', 'u'],
    ['asic', 'UADP 2.0 ASIC', '28 nm・160 Gbps', 'u'],
    ['psuOpen', '電源 715 W', '後ろへ抜ける', 'u'],
    ['phy', 'PHY × 6', '8 ポートに 1 個（仮定）', 'd'],
    ['cpu', 'x86 CPU', '4 コア 1.8 GHz（仮定）', 'd'],
    ['ddr', 'DDR4 × 1', '8 GB', 'd'],
    ['eusb', 'eUSB フラッシュ', '16 GB', 'd'],
    ['nmOpen', 'NM-8X', '前へ抜ける', 'd'],
  ],
  planeD: [
    ['asic', 'UADP 2.0 ASIC', '検索・キュー・書き換え', 'u'],
    ['trPhyAsic', 'PHY → ASIC の配線', '6 本', 'u'],
    ['phy', 'PHY × 6', '電気信号をフレームに戻す', 'd'],
    ['trPortPhy', 'ポート → PHY', '短い配線', 'd'],
    ['rj45', 'RJ-45 ジャック', 'フレームはここから入る', 'd'],
  ],
  planeC: [
    ['asic', 'ASIC', 'ここに表を書き込む', 'u'],
    ['cpu', 'x86 CPU', 'IOS XE が動く', 'u'],
    ['ddr', 'DDR4 × 1', '8 GB', 'u'],
    ['trAsicCpu', 'ASIC → CPU の配線', '方式は非公表', 'd'],
    ['eusb', 'eUSB フラッシュ', '16 GB・OS を置く', 'd'],
  ],
  side: [
    ['nmSide', '吸気', '前面と側面から', 'u'],
    ['fansSide', 'ファン × 3', '可変速・1 基止まっても N+1', 'u'],
  ],
};
const VP = {x0: 350, x1: 1250, y0: 106, y1: 742};
const LH = 44; // a label's height: the name and the one-line spec
// text width in px: Japanese full width, ASCII about 0.58 em
const tw = (str, px) => [...str].reduce((a, ch) => a + (ch.charCodeAt(0) < 256 ? 0.58 : 1) * px, 0);
const BB = new THREE.Box3();
/** do segments p1-p2 and q1-q2 cross (strictly)? */
export const crosses = (p1, p2, q1, q2) => {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const d1 = d(q1, q2, p1);
  const d2 = d(q1, q2, p2);
  const d3 = d(p1, p2, q1);
  const d4 = d(p1, p2, q2);
  return d1 * d2 < 0 && d3 * d4 < 0;
};
const CORNER = new THREE.Vector3();
/** the model's extent on screen [minY, maxY], lifted layers included: each layer's own box, so the corners stay tight */
function screenSpan(st) {
  let lo = 1e9;
  let hi = -1e9;
  for (const g of st.chassis.root.children) {
    if (g === st.asic.root || !g.visible) continue;
    BB.setFromObject(g);
    if (BB.isEmpty()) continue;
    for (const x of [BB.min.x, BB.max.x]) for (const y of [BB.min.y, BB.max.y]) for (const z of [BB.min.z, BB.max.z]) {
      const p = st.project(...CORNER.set(x, y, z).toArray());
      if (!p) continue;
      lo = Math.min(lo, p[1]);
      hi = Math.max(hi, p[1]);
    }
  }
  return [lo, hi];
}

export function makeLabels(st) {
  return (key, o) => {
    const list = LABELS[key];
    if (!list || o < 0.02) return [];
    const [minY, maxY] = screenSpan(st);
    // rows of labels above and below the model, never over it: the first tier hugs the model, the second steps away
    let a0 = minY - 14 - LH;
    let a1 = a0 - LH - 8;
    if (a1 < VP.y0) [a0, a1] = [VP.y0 + LH + 8, VP.y0];
    let b0 = maxY + 16;
    let b1 = b0 + LH + 8;
    if (b1 + LH > VP.y1) [b0, b1] = [VP.y1 - 2 * LH - 8, VP.y1 - LH];
    const pts = list
      .map(([a, name, sub, side], i) => ({n: i + 1, side, name, sub, at: st.project(...st.chassis.anchor(a).toArray()), w: Math.ceil(Math.max(tw(name, 16) + 28, tw(sub, 13) + 26))}))
      .filter((p) => p.at);
    const out = [];
    for (const side of ['u', 'd']) {
      const grp = pts.filter((p) => p.side === side).sort((x, y) => x.at[0] - y.at[0]);
      // one tier left to right; if it does not fit between the panels, alternate two tiers
      const place = (g) => {
        const xs = [];
        let prev = -1e9;
        for (const p of g) {
          prev = Math.max(p.at[0] - 22, prev + 16);
          xs.push(prev);
          prev += p.w;
        }
        let right = VP.x1;
        for (let i = g.length - 1; i >= 0; i--) {
          xs[i] = Math.min(xs[i], right - g[i].w);
          right = xs[i] - 16;
        }
        let left = VP.x0;
        for (let i = 0; i < g.length; i++) {
          xs[i] = Math.max(xs[i], left);
          left = xs[i] + g[i].w + 16;
        }
        return xs;
      };
      // slots go left to right in the order of the anchors' x; any two leaders that still cross (anchors at different
      // heights) swap slots until none do
      const order = grp.map((_, i) => i);
      const layout = () => {
        const g = order.map((i) => grp[i]);
        if (g.reduce((a, p) => a + p.w + 16, 0) <= VP.x1 - VP.x0) {
          const xs = place(g);
          return g.map((p, i) => ({p, x: xs[i], tier: 0}));
        }
        const a = g.filter((_, i) => i % 2 === 0);
        const b = g.filter((_, i) => i % 2 === 1);
        const xa = place(a);
        const xb = place(b);
        return g.map((p, i) => ({p, x: i % 2 ? xb[(i - 1) / 2] : xa[i / 2], tier: i % 2}));
      };
      const yOf = (tier) => (side === 'u' ? (tier ? a1 : a0) : tier ? b1 : b0);
      const end = (c) => [c.x + 9, side === 'u' ? yOf(c.tier) + 41 : yOf(c.tier) - 2];
      let lay = layout();
      for (let it = 0; it < 40; it++) {
        let hit = null;
        for (let i = 0; i < lay.length && !hit; i++)
          for (let j = i + 1; j < lay.length && !hit; j++) if (crosses(lay[i].p.at, end(lay[i]), lay[j].p.at, end(lay[j]))) hit = [i, j];
        if (!hit) break;
        [order[hit[0]], order[hit[1]]] = [order[hit[1]], order[hit[0]]];
        lay = layout();
      }
      lay.forEach((c) => out.push({side, name: c.p.name, sub: c.p.sub, at: c.p.at, label: [c.x, yOf(c.tier)], w: c.p.w, o, up: side === 'u'}));
    }
    // numbered left to right, the row above the model first, then the row below
    return [...out.filter((c) => c.up), ...out.filter((c) => !c.up)].map((c, i) => ({...c, n: i + 1}));
  };
}

// ------------------------------------------------------------ what the console shows
/** the chapter's buttons that are lit */
export function litOf(sc, sub7, exTarget) {
  const lit = {};
  if (sc.chapter === 1) lit[sc.view] = true;
  else if (sc.chapter === 2) lit[exTarget ? 'open' : 'close'] = true;
  else if (sc.chapter === 3) {
    if (sc.plane) lit[sc.plane] = true;
  } else if (sc.chapter === 6) {
    lit.congest = true;
    lit[`m${sc.mult}`] = true;
  } else if (sc.chapter === 7) lit[sub7 ?? sc.sub7 ?? 'air'] = true;
  else if (sc.scene) lit[sc.scene] = true;
  return lit;
}
/** the gauges of a scene at staged time sceneT; the chapters without a scene read the first scene at rest */
export function gaugesOf(scene, sceneT, mult) {
  if (!scene) return {stage: -1, packet: null, punt: null, queue: queueAt(0, mult)};
  const packet = packetAt(scene, sceneT, {mult});
  const punt = puntAt(scene, sceneT);
  const queue = SCENES[scene].queue ? queueAt(sceneT * SPEC.timeMap.congestMsPerSec, mult) : queueAt(0, mult);
  // in the CPU (or on the way back down) no ASIC stage is working
  // the storm is a stream, not one frame: the stage that matters is the IFC that classifies the ARP for the CPU
  const stage = packet.phase === 'cpu' || packet.phase === 'inject' ? -1 : SCENES[scene].rate ? STAGE_IFC : packet.stage;
  return {stage, packet, punt: punt.queue ? punt : null, queue};
}

/** draws the console from the frame's state: s = {sc, viewKey, labelO, exTarget, sceneT, sub7, cursor, look} */
export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const sc = s.sc;
    const scene = sc.chapter >= 4 ? sc.scene : null;
    const g = gaugesOf(scene, s.sceneT ?? 0, sc.mult);
    const lit = litOf(sc, s.sub7, s.exTarget);
    const look = s.look ?? {};
    ui.update({
      chapter: sc.chapter,
      lit,
      note: SUB_NOTE[Object.keys(lit).find((k) => SUB_NOTE[k]) ?? ''] ?? (sc.scene ? SCENES[sc.scene].sub : ''),
      scene,
      mult: sc.mult,
      sub7: s.sub7,
      ...g,
      caption: captionOf(scene, g.packet),
      tags: st.asic.overlay({...look, chapter: sc.chapter, scene, pk: g.packet, punt: g.punt, sceneT: s.sceneT ?? 0, mult: sc.mult}, st.project),
      callouts: labels(s.viewKey, s.labelO),
      cursor: s.cursor,
    });
  };
}

/** what the 3D overlays need for a state: the packet, the fades, the airflow speed */
export function lookOf(sc, sceneT, chK, prevChapter, T, reduced = false) {
  const scene = sc.chapter >= 4 ? sc.scene : null;
  const pk = scene ? packetAt(scene, sceneT, {mult: sc.mult}) : null;
  return {
    chapter: sc.chapter,
    scene,
    pk,
    sceneT,
    mult: sc.mult,
    sub7: sc.sub7,
    T,
    airSpeed: reduced ? 0 : undefined,
    away: awayAt(sc.chapter, prevChapter, chK),
    ...looksOf(sc.chapter, sc.sub7, chK),
    // the magnified drawing opens while the frame is inside the ASIC and folds back into it while the camera looks at
    // the ports (held open when zoomed to the RWE)
    boardK: sc.chapter === 4 ? chK * (sc.zoom === 'rwe' ? 1 : 1 - portLook(scene, sceneT)) : 0,
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
    window.SW = st;
    return {
      resize,
      render(t) {
        const sc = stateAtScript(t);
        const {lifts} = liftsAt(EVENTS, t);
        const cam = camAt(t);
        const tc = lastChange(t);
        const ch = lastChapter(t);
        const viewKey = viewKeyOf(sc);
        const planeK = sc.plane ? ss(tc, tc + 0.7, t) : 0;
        const sceneT = sceneTAt(t);
        const look = lookOf(sc, sceneT, ch.t === 0 ? 1 : ss(ch.t + 0.5, ch.t + 1.7, t), ch.prev, t);
        st.frame({...look, lifts, T: t, plane: sc.plane, planeK}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        // the labels wait for the camera and the lifts to settle
        const labelO = t < 0.01 ? 1 : ss(tc + (sc.chapter === 2 ? 1.9 : 1.3), tc + (sc.chapter === 2 ? 2.5 : 1.9), t);
        frame({sc, viewKey, labelO: tc === 0 ? 1 : labelO, exTarget: sc.chapter >= 2 ? 1 : 0, sceneT, sub7: sc.sub7, cursor: cursorAt(t), look});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
