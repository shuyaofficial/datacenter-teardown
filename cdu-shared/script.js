// The auto tour's script, no three.js (the tests and the timeline check read it in node). SCRIPT is the operator's
// presses: a chapter button, a view / scene button, the temperature slider and the liquid toggle. Everything that moves
// is a pure function of the clock these presses make; beatsOf() lists the moments timeline.json carries.
import {CHAPTERS, designDT, EXPLODE} from './kin.js';
import {PRE, sceneClock} from './flow.js';

export const SCRIPT = [
  // 1 外観と置き場所: 列の全景 → 天井側の配管口（10 s）
  {t: 0, chapter: 1, view: 'row'},
  {t: 5, view: 'ports'},
  // 2 扉を開ける: 扉が開き、上段・中段・下段が前へずれる。注記は 熱交換器 → ポンプ → 補給タンク の順（12 s）
  {t: 10, chapter: 2},
  // 3 2つの輪は混ざらない: loops → hx（14 s）
  {t: 22, chapter: 3},
  {t: 29, scene: 'hx'},
  // 4 流量 × 温度差: 13.9 → 7 K → 13.9 K、水に切り替えて戻す、ラックを 1 本ずつ（16 s）
  {t: 36, chapter: 4},
  {t: 39, dT: 7},
  {t: 41.5, dT: 13.9},
  {t: 43.5, scene: 'glycol'},
  {t: 44.8, fluid: 'water'},
  {t: 46.3, fluid: 'pg25'},
  {t: 47.6, scene: 'racks'},
  // 5 ポンプの力（6 s）
  {t: 52, chapter: 5},
  // 6 止まったら: failover → leak → fwsloss（18 s）
  {t: 58, chapter: 6},
  {t: 63.5, scene: 'leak'},
  {t: 69, scene: 'fwsloss'},
  // 7 監視する: 操作盤の画面 → BMS へ（8 s）
  {t: 76, chapter: 7, view: 'screen'},
  {t: 80, view: 'bms'},
  // 全景で締める
  {t: 84, chapter: 1, view: 'row'},
];
export const DURATION = 88;
export const DEFAULTS = {chapter: 1, view: 'row', scene: null, dT: designDT(), fluid: 'pg25'};
/** the chapters whose buttons are views (not scenes, not the doors) and their first view */
export const VIEW_SUBS = {1: ['row', 'ports'], 7: ['screen', 'bms']};

/** where the doors and the three tiers want to be in a chapter: [doors, top, mid, bot] */
export const explodeOf = (chapter) => (chapter === 2 ? [1, 1, 1, 1] : chapter === 3 || chapter === 5 || chapter === 6 ? [1, 0, 0, 0] : [0, 0, 0, 0]);
/** seconds after a chapter press that the camera waits while the tiers (and the doors) go back: the slowest layer that
 * moves back plus a short beat, so the parts and the camera never move at once */
export function holdOf(prev, next) {
  const a = explodeOf(prev);
  const b = explodeOf(next);
  let end = 0;
  a.forEach((v, k) => {
    if (k > 0 && b[k] < v - 1e-6) end = Math.max(end, EXPLODE.close.delay[k] + EXPLODE.close.dur[k] * Math.max(0.35, v - b[k]));
  });
  return end > 0 ? Math.round((end + 0.1) * 100) / 100 : 0;
}

/** the operator's state at t: chapter, view, scene, dT, fluid (the last press of each) */
export function stateAtScript(t, script = SCRIPT) {
  const s = {...DEFAULTS};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      s.chapter = e.chapter;
      s.scene = CHAPTERS[e.chapter - 1].scenes?.[0] ?? null;
      s.dT = designDT();
      s.fluid = 'pg25';
      if (VIEW_SUBS[e.chapter]) s.view = VIEW_SUBS[e.chapter][0];
    }
    for (const k of ['view', 'scene', 'dT', 'fluid']) if (e[k] !== undefined) s[k] = e[k];
  }
  return s;
}

/** the press that started the scene's clock at t: {t0, pre} (a chapter press waits PRE for the camera) */
export function sceneStartOf(t, script = SCRIPT) {
  let out = {t0: 0, pre: 0};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) out = {t0: e.t, pre: PRE};
    else if (e.scene !== undefined) out = {t0: e.t, pre: 0};
  }
  return out;
}
/** the scene's staged time at film time t */
export function sceneTAt(t, script = SCRIPT) {
  const s = stateAtScript(t, script);
  if (!s.scene) return 0;
  const {t0, pre} = sceneStartOf(t, script);
  return sceneClock(s.scene, t - t0, pre);
}

/** the presses that move the doors and the tiers: [{t, to: [4]}] for liftsAt */
export function explodeEventsOf(script = SCRIPT) {
  const out = [];
  let cur = '0,0,0,0';
  for (const e of script) {
    if (e.chapter === undefined) continue;
    const to = explodeOf(e.chapter);
    if (to.join() !== cur) {
      out.push({t: e.t, to});
      cur = to.join();
    }
  }
  return out;
}

/** the moments the timeline carries: every press, named by what it does */
export function beatsOf(script = SCRIPT) {
  const out = {};
  const n = {};
  const key = (k) => {
    n[k] = (n[k] || 0) + 1;
    return n[k] > 1 ? `${k}${n[k]}` : k;
  };
  for (const e of script) {
    if (e.t <= 0) continue;
    if (e.chapter !== undefined) out[key(`chapter${e.chapter}`)] = e.t;
    if (e.view !== undefined && e.chapter === undefined) out[key(`view_${e.view}`)] = e.t;
    if (e.scene !== undefined && e.chapter === undefined) out[key(`scene_${e.scene}`)] = e.t;
    if (e.dT !== undefined) out[key(`dT_${e.dT}`)] = e.t;
    if (e.fluid !== undefined) out[key(`fluid_${e.fluid}`)] = e.t;
  }
  return Object.fromEntries(Object.entries(out).sort((x, y) => x[1] - y[1]));
}
