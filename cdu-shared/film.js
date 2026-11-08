// The CDU film: the CDU (cdu.js), the row (row.js) and the heat exchanger diagram (hx.js) in the studio (stage.js) under
// the Japanese console (console.js). The operator looks along the row and at the ports on the roof, opens the doors and
// slides the tiers out, follows the two loops and cuts the heat exchanger open, moves the temperature difference,
// switches the liquid, connects racks one by one, runs the pumps, fails a pump, leaks a drop, stops the facility water,
// and reads the touch panel and the BMS. A pure function of t: every pose comes from the script (script.js), kin.js and
// flow.js; the beads' travel is integrated once at load (TOUR_PHASE).
import {runSim} from 'teardown-kit/runtime.js';
import * as THREE from 'three';
import {makeCursor} from '../kit/cursor.js';
import {createConsole, SUB_NOTE} from './console.js';
import {captionOf, leakPose, PARTS} from './flow.js';
import {designDT, ease, failoverAt, flowAt, fwsAt, gaugesAt, leakAt, liftsAt, rackLpm, racksAt, RACKS, SCENES, seg, SPEC} from './kin.js';
import {DURATION, explodeEventsOf, holdOf, SCRIPT, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

export {DURATION, SCRIPT};
export const DEFAULTS = {duration: DURATION, fps: 60, theme: 'light', hud: {enabled: false, title: 'cdu', subtitle: ''}, director: {enabled: false}, watermark: ''};
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};
export const ss = (a, b, t) => smoother((t - a) / (b - a));

// ------------------------------------------------------------ views (metres, degrees); u = seconds since the view came on
export const VIEW_FN = {
  row: (u) => ({tx: 1.25, ty: 1.4, tz: 0, az: -24 + 0.25 * u, el: 9, d: 12.6, sx: 0, sy: -24}),
  ports: (u) => ({tx: 0, ty: 1.95, tz: -0.35, az: -32 + 0.4 * u, el: 28, d: 4.3, sx: 0, sy: -16}),
  open: (u) => ({tx: 0.04, ty: 1.04, tz: 0.78, az: -30 + 0.3 * u, el: 9, d: 5.7, sx: 0, sy: -24}),
  loops: (u) => ({tx: 0.25, ty: 1.55, tz: 0.2, az: -14 + 0.2 * u, el: 8, d: 8.6, sx: 0, sy: -24}),
  hx: (u) => ({tx: -0.26, ty: 1.19, tz: 1.56, az: 0.15 * u, el: 3, d: 3.05, sx: 0, sy: -18}),
  row4: (u) => ({tx: 1.85, ty: 1.35, tz: 0, az: -16 + 0.2 * u, el: 11, d: 10.6, sx: 0, sy: -24}),
  pumps: (u) => ({tx: 0, ty: 0.36, tz: 0.28, az: 2 + 0.3 * u, el: 14, d: 2.4, sx: 0, sy: -20}),
  fail: (u) => ({tx: 0, ty: 0.36, tz: 0.28, az: -4 + 0.2 * u, el: 12, d: 2.4, sx: 0, sy: -20}),
  leak: (u) => ({tx: 0, ty: 0.3, tz: 0.32, az: 6 + 0.2 * u, el: 30, d: 1.95, sx: 0, sy: -20}),
  fws: (u) => ({tx: -0.55, ty: 1.85, tz: 0.1, az: -8 + 0.2 * u, el: 4, d: 7.4, sx: 0, sy: -6}),
  screen: (u) => ({tx: -0.15, ty: 1.52, tz: 0.545, az: 16 + 0.15 * u, el: 4, d: 1.55, sx: 300, sy: -20}),
  bms: (u) => ({tx: -0.08, ty: 1.2, tz: 0.2, az: 24 + 0.15 * u, el: 6, d: 4.0, sx: 320, sy: -20}),
};
/** which camera a state looks through */
export function viewKeyOf(sc) {
  if (sc.chapter === 1) return sc.view === 'ports' ? 'ports' : 'row';
  if (sc.chapter === 2) return 'open';
  if (sc.chapter === 3) return sc.scene === 'hx' ? 'hx' : 'loops';
  if (sc.chapter === 4) return 'row4';
  if (sc.chapter === 5) return 'pumps';
  if (sc.chapter === 6) return sc.scene === 'leak' ? 'leak' : sc.scene === 'fwsloss' ? 'fws' : 'fail';
  return sc.view === 'bms' ? 'bms' : 'screen';
}
// [when the camera starts to move, view]. After a chapter press that sends the tiers back, the camera waits (holdOf).
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
/** seconds of the last press that changes what is on screen (chapter / view / scene), for the label fade */
export const lastChange = (t, script = SCRIPT) => {
  let c = 0;
  for (const e of script) if (e.t <= t && (e.chapter !== undefined || e.view !== undefined || e.scene !== undefined)) c = e.t;
  return c;
};
/** the last chapter press at or before t, and the chapter before it */
export const lastChapter = (t, script = SCRIPT) => {
  let c = {t: 0, prev: 1, n: 1};
  for (const e of script) if (e.t <= t && e.chapter !== undefined) c = {t: e.t, prev: c.n, n: e.chapter};
  return c;
};
export const holdAt = (t, script = SCRIPT) => {
  const ch = lastChapter(t, script);
  return ch.t > 0 ? holdOf(ch.prev, ch.n) : 0;
};
/** seconds after a press that the labels wait: the camera and the doors settle first (the tiers take longer in chapter 2) */
export const labelWait = (chapter, hold = 0) => (chapter === 2 ? 2.4 : 1.5) + hold;
/** the temperature difference at t: it glides to a new value over 0.8 s after the slider press */
export const dTAt = (t, script = SCRIPT) => {
  let v = designDT();
  let from = v;
  let t0 = -9;
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      v = from = designDT();
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

// ------------------------------------------------------------ how fast the beads go (1 = the design flow)
/** the coolant's and the facility water's speed in a scene at staged t */
export function beadSpeeds(scene, t, opts = {}) {
  let tcs = 1;
  let fws = 1;
  if (scene === 'flow' || scene === 'glycol') {
    const f = flowAt(t, opts.dT ?? designDT(), opts.fluid ?? 'pg25');
    tcs = f.lpm / rackLpm();
  }
  if (scene === 'failover') tcs = failoverAt(t).frac;
  if (scene === 'fwsloss') fws = fwsAt(t).flow;
  return {tcs, fws};
}
/** the tour's bead travel, integrated once at load: phase(t) = ∫ speed dt */
export const TOUR_PHASE = (() => {
  const dt = 1 / 30;
  const n = Math.ceil(DURATION / dt) + 2;
  const tcs = new Float32Array(n);
  const fws = new Float32Array(n);
  for (let i = 1; i < n; i++) {
    const t = (i - 0.5) * dt;
    const sc = stateAtScript(t);
    const v = beadSpeeds(sc.scene, sceneTAt(t), {dT: dTAt(t), fluid: sc.fluid});
    tcs[i] = tcs[i - 1] + v.tcs * dt;
    fws[i] = fws[i - 1] + v.fws * dt;
  }
  const at = (arr, t) => {
    const x = Math.min(n - 1.001, Math.max(0, t / dt));
    const i = Math.floor(x);
    return arr[i] + (arr[i + 1] - arr[i]) * (x - i);
  };
  return {tcs: (t) => at(tcs, t), fws: (t) => at(fws, t)};
})();

// ------------------------------------------------------------ the operator's pointer
export function makeFilmCursor(ui) {
  const presses = [];
  for (const e of SCRIPT) {
    if (e.t <= 0) continue;
    if (e.chapter !== undefined) presses.push({t: e.t, spot: ui.spots[`c_${e.chapter}`]});
    else if (e.view !== undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.view}`]});
    if (e.scene && e.chapter === undefined) presses.push({t: e.t, spot: ui.spots[`s_${e.scene}`]});
    if (e.dT !== undefined) presses.push({t: e.t, spot: ui.spots[`dT_${e.dT}`]});
    if (e.fluid !== undefined) presses.push({t: e.t, spot: ui.spots[`f_${e.fluid}`]});
  }
  return makeCursor(presses, [[880, 560], [760, 480], [940, 540], [820, 520]]);
}

// ------------------------------------------------------------ the labels, per view, from the anchors
// side: 'l' / 'r' a column beside the model (rows ordered by the anchors' height), 'a' = the nearer side
const LABELS = {
  row: [
    ['cdu', 'CDU（600 kW 機）', '2,000 × 600 × 1,200 mm・満水 550 kg', 'l'],
    ['wall', '屋外の冷却器へ', '施設の水の輪（灰色）', 'l'],
    ['hdrR', '冷却液の配管', '列の上 約 0.3 m', 'r'],
    ['rack4', 'GPU ラック × 5', 'NVL72・115 kW ずつ', 'r'],
  ],
  ports: [
    ['port_fwsS', '施設の水 行き', '2.5 インチ・37.2 ℃で入る', 'l'],
    ['port_fwsR', '施設の水 戻り', '47.2 ℃で出る', 'l'],
    ['port_tcsS', '冷却液 行き', '2.5 インチ・40.0 ℃で出る', 'r'],
    ['port_tcsR', '冷却液 戻り', '53.9 ℃で戻る', 'r'],
  ],
  // the order is the order they appear in (熱交換器 → ポンプ → 補給タンク → ...)
  open: [
    ['hx', '熱交換器', 'ステンレス板・銅ろう付け', 'l'],
    ['pumpB', 'ポンプ × 2', '横置き多段・N+N', 'r'],
    ['tank', '補給タンク', 'ステンレス 10 L・水位 3', 'r'],
    ['filterA', 'フィルタ × 2', '25 / 50 µm・動かしたまま掃除', 'l'],
    ['cv', '制御弁（施設側）', '施設の水の量を絞る', 'l'],
    ['panel', '操作盤', '7 インチのタッチパネル', 'l'],
    ['elec', '電気盤', 'インバータ 2・制御基板', 'r'],
  ],
  loops: [['hxFace', '熱交換器', '板 1 枚をはさんで熱だけ渡す', 'l']],
  pumps: [
    ['impA', '羽根車（断面）', 'インバータで速さを変える', 'l'],
    ['filterB', 'フィルタ', 'ポンプごと・25 / 50 µm', 'r'],
    ['checkB', '逆止弁', '止まったポンプへ逆流させない', 'r'],
  ],
  leak: [['tray', '受け皿', 'CDU の床全体', 'l']],
  fws: [['hxFace', '熱交換器', 'ここで熱を施設の水へ渡す', 'r']],
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
const ROWBOX = [[-1.45, 3.42], [0, 2.9], [-0.67, 0.53]];
/** the model's extent on screen [minX, maxX, minY, maxY] */
function screenSpan(st, key, lifts) {
  const big = key === 'row' || key === 'loops' || key === 'row4';
  const front = 0.534 + (key === 'open' ? 0.9 * Math.max(lifts?.[1] ?? 0, lifts?.[0] ?? 0) : 0.3 * (lifts?.[0] ?? 0));
  const B = big ? ROWBOX : [[-0.38, 0.38], [0, 2.06], [-0.67, front]];
  let x0 = 1e9;
  let x1 = -1e9;
  let y0 = 1e9;
  let y1 = -1e9;
  for (const x of B[0]) for (const y of B[1]) for (const z of B[2]) {
    const p = st.project(x, y, z);
    if (!p) continue;
    x0 = Math.min(x0, p[0]);
    x1 = Math.max(x1, p[0]);
    y0 = Math.min(y0, p[1]);
    y1 = Math.max(y1, p[1]);
  }
  return [x0, x1, y0, y1];
}

/** labels(key, o, lifts, oOf): o is the fade; oOf(i), when given, is label i's own fade (one after another) */
export function makeLabels(st) {
  return (key, o, lifts, oOf = null) => {
    const list = LABELS[key];
    if (!list || o <= 0) return [];
    const [mx0, mx1] = screenSpan(st, key, lifts);
    const mid = (mx0 + mx1) / 2;
    const pts = list
      .map(([a, name, sub, side], i) => {
        const at = st.project(...st.anchor(a).toArray());
        return {name, sub, at, side, i, w: Math.ceil(Math.max(tw(name, 16) + 40, tw(sub, 13) + 40))};
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
      lay.forEach((c) => out.push({side, name: c.p.name, sub: c.p.sub, at: c.p.at, label: [c.x, c.y], end: c.end, i: c.p.i}));
    }
    const rank = {l: 0, r: 1};
    return out
      .sort((x, y) => rank[x.side] - rank[y.side] || x.label[1] - y.label[1])
      .map((c, n) => ({...c, n: n + 1, o: oOf ? oOf(c.i) : Math.min(1, o)}));
  };
}

// ------------------------------------------------------------ tags over the 3D (no leaders)
export function tagsOf(look, st) {
  const out = [];
  const P = (key) => st.project(...st.anchor(key).toArray());
  const push = (p, o) => p && out.push({...o, x: p[0] + (o.dx ?? 0), y: p[1] + (o.dy ?? 0), o: o.o ?? 1});
  const sc = look.scene;
  const t = look.sceneT ?? 0;
  const k = look.tagK ?? 1;
  const D = SPEC.design;
  if (look.chapter === 3 && sc === 'loops') {
    push(P('fwsPipe'), {kind: 'note', h: 'c', v: 'b', dy: -14, o: k, html: `施設の水 ${D.fws.supply.toFixed(1)} → ${D.fws.ret.toFixed(1)} ℃（灰色）`});
  }
  if (look.chapter === 4 && sc === 'racks') {
    const r = racksAt(t);
    for (let i = 0; i < SPEC.rowRacks; i++) {
      const o = ease(seg(t, RACKS.first + i * RACKS.step, RACKS.first + i * RACKS.step + 0.3));
      push(P(`rackTop${i}`), {kind: 'lbl', h: 'c', v: 'b', dy: -60, o: o * k, on: i === r.n - 1 && !r.ghost, html: `<b>${i + 1} 本目</b><span>${D.rackLiquidKw * (i + 1)} kW</span>`});
    }
    push(P('ghost'), {kind: 'lbl', h: 'c', v: 'b', dy: -30, o: (look.ghost ?? 0) * k, on: true, html: '<b>6 本目: 2 台目の CDU が要る</b><span>690 kW は 600 kW に入らない</span>'});
  }
  if (look.chapter === 6 && sc === 'failover') {
    const f = failoverAt(t);
    push(P('pumpA'), {kind: f.fault ? 'lbl alarm' : 'lbl', h: 'r', v: 'b', dx: -10, dy: -10, o: k, html: f.fault ? '<b>ポンプ A: 故障</b><span>止まっていく</span>' : '<b>ポンプ A: 運転</b><span>N+N の運転側</span>'});
    push(P('pumpB'), {kind: 'lbl', h: 'l', v: 'b', dx: 10, dy: -10, o: k, on: f.b >= 0.5, html: f.b >= 0.5 ? '<b>ポンプ B: 運転</b><span>待機から引き継いだ</span>' : '<b>ポンプ B: 待機</b><span>止まって待つ</span>'});
  }
  if (look.chapter === 6 && sc === 'leak') {
    const l = leakAt(t);
    push(P('joint'), {kind: 'note', h: 'l', v: 'b', dx: 18, dy: -6, o: k * (1 - ease(seg(t, 2.6, 3.0))), html: '継手から 1 滴'});
    if (l.sensor) push(P('sensor'), {kind: 'lbl alarm', h: 'l', v: 'm', dx: 16, o: k, html: '<b>漏液センサー: 反応</b><span>操作盤と BMS に警報</span>'});
    const sp = P('sensor');
    if (sp && l.branch > 0) {
      push([sp[0] + 200, sp[1] - 110], {kind: 'lbl', h: 'l', v: 'b', o: l.branch * k, html: '<b>① 警報だけ</b><span>運転を続けて知らせる</span>'});
      push([sp[0] + 200, sp[1] - 52], {kind: 'lbl', h: 'l', v: 'b', o: l.branch * k, html: '<b>② 警報して停止</b><span>ポンプを止める（客が設定で選ぶ）</span>'});
    }
  }
  if (look.chapter === 6 && sc === 'fwsloss') {
    const w = fwsAt(t);
    if (w.stopped) push(P('fwsPipe'), {kind: 'lbl alarm', h: 'c', v: 'b', dy: -16, o: k, html: '<b>施設の水が止まった</b><span>灰色の粒が止まる</span>'});
    if (w.rescue) {
      const wp = P('wall');
      if (wp) {
        push([wp[0] + 30, wp[1] + 10], {kind: 'lbl', h: 'l', v: 't', o: k, on: true, html: `<b>蓄熱タンク: ${D.storageMin} 分冷やし続ける</b><span>冷たい水をためておく（出典8）</span>`});
        push([wp[0] + 30, wp[1] + 64], {kind: 'lbl', h: 'l', v: 't', o: k, on: true, html: `<b>UPS ${D.upsKw} kW</b><span>CDU と施設のポンプを回し続ける</span>`});
      }
    }
  }
  if (look.chapter === 3 && sc === 'hx') out.push(...st.hx.tags(look, st.project));
  return out;
}

// ------------------------------------------------------------ what the console shows
/** the chapter's buttons that are lit */
export function litOf(sc, exOpen) {
  const lit = {};
  if (sc.chapter === 1 || sc.chapter === 7) lit[sc.view] = true;
  else if (sc.chapter === 2) lit[exOpen ? 'open' : 'close'] = true;
  else if (sc.scene) lit[sc.scene] = true;
  return lit;
}

/** draws the console from the frame's state: s = {sc, viewKey, labelO, labelAge, chO, exOpen, sceneT, dT, open, lifts, cursor, look} */
export function makeConsoleFrame(ui, st) {
  const labels = makeLabels(st);
  return (s) => {
    const sc = s.sc;
    const scene = sc.scene;
    const g = gaugesAt(scene, s.sceneT ?? 0, {dT: s.dT, fluid: sc.fluid});
    const lit = litOf(sc, s.exOpen);
    const panelP = sc.chapter === 7 ? st.project(...st.anchor('panel').toArray()) : null;
    ui.update({
      chapter: sc.chapter,
      lit,
      note: SUB_NOTE[Object.keys(lit).find((k) => SUB_NOTE[k]) ?? ''] ?? (scene ? SCENES[scene].sub : ''),
      scene,
      g,
      dT: s.dT,
      fluid: sc.fluid,
      open: s.open,
      caption: s.labelO > 0.5 || sc.chapter >= 3 ? captionOf(scene, s.sceneT ?? 0, {dT: s.dT, fluid: sc.fluid}) : '',
      tags: tagsOf({...s.look, viewKey: s.viewKey, tagK: s.labelO}, st),
      // chapter 2: the labels come in one after another (熱交換器 → ポンプ → 補給タンク → ...), 0.45 s apart
      callouts: labels(s.viewKey, s.labelO, s.lifts, s.viewKey === 'open' ? (i) => (s.labelO <= 0 ? 0 : ss(i * 0.45, i * 0.45 + 0.6, s.labelAge ?? 99)) : null),
      ch7: sc.chapter === 7 ? {view: sc.view, o: s.chO, ob: s.labelO, panel: panelP} : null,
      cursor: s.cursor,
    });
  };
}

/** the look of a frame: what the CDU, the row and the diagram show. chK = 0..1 since the chapter press */
export function lookOf(sc, sceneT, chK, T, extra = {}) {
  const ch = sc.chapter;
  const scene = sc.scene;
  const g = gaugesAt(scene, sceneT, {dT: extra.dT, fluid: sc.fluid});
  const op = {1: [0.5, 0.5], 2: [0, 0], 3: [1, 1], 4: [1, 0.35], 5: [1, 0.35], 6: [1, 0.35], 7: [0.35, 0.35]}[ch];
  let [tcsO, fwsO] = op;
  if (ch === 3 && scene === 'hx') tcsO = fwsO = 0;
  if (ch === 1 && sc.view === 'ports') tcsO = fwsO = 0;
  if (ch === 6 && scene === 'leak') [tcsO, fwsO] = [0.35, 0.2];
  if (ch === 6 && scene === 'fwsloss') [tcsO, fwsO] = [0.7, 1];
  const w = scene === 'fwsloss' ? fwsAt(sceneT) : null;
  return {
    chapter: ch,
    scene,
    sceneT,
    T,
    angA: g.angA,
    angB: g.angB,
    leakT: scene === 'leak' ? sceneT : -1,
    ghost: scene === 'racks' ? ease(seg(sceneT, RACKS.ghost, RACKS.ghost + 0.4)) : 0,
    hxK: ch === 3 && scene === 'hx' ? ease(sceneT / 0.6) * chK : 0,
    hxT: scene === 'hx' ? sceneT : 0,
    beads: {
      tcs: tcsO * chK,
      fws: fwsO * chK,
      racks: scene === 'racks' ? racksAt(sceneT).n : SPEC.rowRacks,
      tcsPhase: extra.tcsPhase ?? 0,
      fwsPhase: extra.fwsPhase ?? 0,
      pump: scene === 'failover' ? g.activePump : 'A',
      rise: w ? w.rise : 0,
      only: ch === 5 || (ch === 6 && scene !== 'fwsloss') ? 'cdu' : null,
      size: ch === 5 || (ch === 6 && scene !== 'fwsloss') ? 14 : 30,
    },
  };
}
export {leakPose, PARTS};

export function makeFilm() {
  return async ({canvas, capture}) => {
    const st = createStage({canvas});
    const resize = () => st.resize(1600, 900, capture ? devicePixelRatio || 1 : Math.min(devicePixelRatio || 1, 2));
    resize();
    const ui = createConsole(document.getElementById('app'));
    const cursorAt = makeFilmCursor(ui);
    const frame = makeConsoleFrame(ui, st);
    window.CDU = st;
    return {
      resize,
      render(t) {
        const sc = stateAtScript(t);
        const {lifts, open} = liftsAt(EVENTS, t);
        const cam = camAt(t);
        const tc = lastChange(t);
        const ch = lastChapter(t);
        const viewKey = viewKeyOf(sc);
        const sceneT = sceneTAt(t);
        const dT = dTAt(t);
        const hold = holdAt(t);
        const chK = ch.t === 0 ? 1 : ss(ch.t + hold + 0.3, ch.t + hold + 1.5, t);
        const look = {...lookOf(sc, sceneT, chK, t, {dT, tcsPhase: TOUR_PHASE.tcs(t), fwsPhase: TOUR_PHASE.fws(t)}), lifts};
        st.frame(look, {...cam, az: cam.az * D2R, el: cam.el * D2R});
        const wait = labelWait(sc.chapter, tc === ch.t ? hold : 0);
        const labelO = tc === 0 ? 1 : ss(tc + wait, tc + wait + 0.6, t);
        const chO = ch.t === 0 ? 1 : ss(ch.t + 1.5, ch.t + 2.1, t);
        frame({sc, viewKey, labelO, labelAge: t - tc - wait, chO, exOpen: sc.chapter === 2, sceneT, dT, open, lifts, cursor: cursorAt(t), look});
        return {};
      },
    };
  };
}

export const run = () => runSim(DEFAULTS, makeFilm());
