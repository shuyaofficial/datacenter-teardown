// The auto tour's script, no three.js (the tests and the timeline check read it in node). SCRIPT is the operator's
// presses: a chapter button, a view / scene button, the cooling slider. Everything that moves is a pure function of the
// clock these presses make; beatsOf() lists the moments timeline.json carries.
import {CHAPTERS, SPEC} from './kin.js';
import {PRE, sceneClock} from './flow.js';

export const SCRIPT = [
  // 1 外観: 前 → 後ろ（10 s）
  {t: 0, chapter: 1, view: 'front'},
  {t: 5, view: 'back'},
  // 2 計算トレイを引き出す: 引き出して、天板 → コールドプレート → チップ → カードの順に浮く（12 s）
  {t: 10, chapter: 2},
  // 3 72 個が 1 つになる: fan → hop（14 s）
  {t: 22, chapter: 3},
  {t: 28.4, scene: 'hop'},
  // 4 学習 1 歩の集計: ring → sharp（16 s）
  {t: 36, chapter: 4},
  {t: 46, scene: 'sharp'},
  // 5 ラックの外へ（10 s）
  {t: 52, chapter: 5},
  // 6 120 kW を運び込む（8 s）
  {t: 62, chapter: 6},
  // 7 液で冷やす: 温度差 10 K → 5 K（10 s）
  {t: 70, chapter: 7},
  {t: 75, dT: 5},
  // 全景で締める
  {t: 80, chapter: 1, view: 'front'},
];
export const DURATION = 84;
export const DEFAULTS = {chapter: 1, view: 'front', scene: null, dT: SPEC.cool.dTDefault};

/** where the pulled tray's five layers want to be in a chapter: [pull, lid, plates, chips, io] */
export const explodeOf = (chapter) => (chapter === 2 ? [1, 1, 1, 1, 1] : chapter === 5 ? [1, 1, 0, 0, 0] : [0, 0, 0, 0, 0]);
/** the chapter's look: the switch trays slide forward and turn see-through (3), the side panels come off (2-7), the
 * lifted lid is taken away (5) */
export const lookTargetOf = (chapter) => ({slide: chapter === 3 ? 1 : 0, sides: chapter === 1 ? 0 : 1, lidAway: chapter === 5 ? 1 : 0});

/** the operator's state at t: chapter, view, scene, dT (the last press of each) */
export function stateAtScript(t, script = SCRIPT) {
  const s = {...DEFAULTS};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      s.chapter = e.chapter;
      s.scene = CHAPTERS[e.chapter - 1].scenes?.[0] ?? null;
      s.dT = SPEC.cool.dTDefault;
    }
    for (const k of ['view', 'scene', 'dT']) if (e[k] !== undefined) s[k] = e[k];
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

/** the presses that move the pulled tray: [{t, to: [5]}] for liftsAt */
export function explodeEventsOf(script = SCRIPT) {
  const out = [];
  let cur = '0,0,0,0,0';
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
  }
  return Object.fromEntries(Object.entries(out).sort((x, y) => x[1] - y[1]));
}
