// The auto tour's script, no three.js (the tests and the timeline check read it in node). SCRIPT is the operator's
// presses: a chapter button, a view / scene button. Everything that moves is a pure function of the clock these presses
// make; beatsOf() lists the moments timeline.json carries.
import {PRE, sceneClock} from './flow.js';
import {CHAPTERS, EXPLODE, LAYERS} from './kin.js';

export const SCRIPT = [
  // 1 外観: 前 → 後ろ、Catalyst と並べる（10 s）
  {t: 0, chapter: 1, view: 'front'},
  {t: 5, view: 'back'},
  // 2 天板を開けて分解（10 s）
  {t: 10, chapter: 2},
  // 3 経路は配られる: sweep → lookup（14 s）
  {t: 20, chapter: 3},
  {t: 28.4, scene: 'lookup'},
  // 4 捨てずに待つ: drop → credit → pfc（18 s）
  {t: 34, chapter: 4},
  {t: 40, scene: 'credit'},
  {t: 46.5, scene: 'pfc'},
  // 5 半分を上へ: fattree → ar（14 s）
  {t: 52, chapter: 5},
  {t: 59, scene: 'ar'},
  // 6 スイッチで集計: ring → sharp（12 s）
  {t: 66, chapter: 6},
  {t: 72.5, scene: 'sharp'},
  // 7 電力と風（8 s）
  {t: 78, chapter: 7},
  // 全景で締める
  {t: 86, chapter: 1, view: 'front'},
];
export const DURATION = 90;
export const DEFAULTS = {chapter: 1, view: 'front', scene: null};

/** where the four layers want to be in a chapter: [lid, heat, cpu, rear] */
export const explodeOf = (chapter) => (chapter === 2 ? [1, 1, 1, 1] : [0, 0, 0, 0]);
/** seconds after a chapter press that the camera waits while the layers go back down (bottom first), plus a beat */
export function holdOf(prev, next) {
  const a = explodeOf(prev);
  const b = explodeOf(next);
  let end = 0;
  a.forEach((v, k) => {
    if (b[k] < v - 1e-6) end = Math.max(end, (LAYERS.length - 1 - k) * EXPLODE.close.stagger + EXPLODE.close.dur * Math.max(0.35, v - b[k]));
  });
  return end > 0 ? Math.round((end + 0.1) * 100) / 100 : 0;
}
/** the chapter's look: the Catalyst's outline beside it (1), the lid see-through for the wind (7) */
export const lookTargetOf = (chapter) => ({ghost: chapter === 1 ? 1 : 0, lidSee: chapter === 7 ? 1 : 0});

/** the operator's state at t: chapter, view, scene (the last press of each) */
export function stateAtScript(t, script = SCRIPT) {
  const s = {...DEFAULTS};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      s.chapter = e.chapter;
      s.scene = CHAPTERS[e.chapter - 1].scenes?.[0] ?? null;
    }
    for (const k of ['view', 'scene']) if (e[k] !== undefined) s[k] = e[k];
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
/** the presses that move the layers: [{t, to: [4]}] for liftsAt */
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
  }
  return Object.fromEntries(Object.entries(out).sort((x, y) => x[1] - y[1]));
}
