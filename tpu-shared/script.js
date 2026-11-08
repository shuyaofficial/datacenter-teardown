// The auto tour's script, no three.js (the tests and the timeline check read it in node). SCRIPT is the operator's
// presses: a chapter button, a view / scene button. Everything that moves is a pure function of the clock these presses
// make; beatsOf() lists the moments timeline.json carries. chapterPlanOf() hands a chapter's later scene presses to the
// live page, so a visitor's chapter press plays the chapter's scenes in the tour's order.
import {CHAPTERS, EXPLODE} from './kin.js';
import {PRE, sceneClock} from './flow.js';

export const SCRIPT = [
  // 1 外観: ラック全景 → 立方体が横に浮かぶ（10 s）
  {t: 0, chapter: 1, view: 'front'},
  {t: 5, view: 'cube'},
  // 2 トレイを引き出す: 引き出して、天板 → コールドプレート → チップ → OSFP・PCIe の順に浮く（12 s）
  {t: 10, chapter: 2},
  // 3 隣とだけつなぐ: six → hop → wrap（16 s）
  {t: 22, chapter: 3},
  {t: 26.2, scene: 'hop'},
  {t: 32, scene: 'wrap'},
  // 4 光でつなぎ替える: ocs → swap → ポッドの遠景（16 s）
  {t: 38, chapter: 4},
  {t: 43.4, scene: 'swap'},
  {t: 48, scene: 'pod'},
  // 5 NVL72 と比べる（12 s）
  {t: 54, chapter: 5},
  // 6 ポッドの外へ（8 s）
  {t: 66, chapter: 6},
  // 7 電気と液冷: power → cool（10 s）
  {t: 74, chapter: 7},
  {t: 79, scene: 'cool'},
  // 全景で締める
  {t: 84, chapter: 1, view: 'front'},
];
export const DURATION = 88;
export const DEFAULTS = {chapter: 1, view: 'front', scene: null};

/** where the pulled tray's five layers want to be in a chapter: [pull, lid, plates, chips, io] */
export const explodeOf = (chapter) => (chapter === 2 ? [1, 1, 1, 1, 1] : [0, 0, 0, 0, 0]);
/** seconds after a chapter press that the camera (and the chapter's look) wait while the pulled tray goes back: the
 * slowest layer that moves down (kin.js EXPLODE.close) plus a short beat, so the tray and the camera never move at once */
export function holdOf(prev, next) {
  const a = explodeOf(prev);
  const b = explodeOf(next);
  let end = 0;
  a.forEach((v, k) => {
    if (b[k] < v - 1e-6) end = Math.max(end, EXPLODE.close.delay[k] + EXPLODE.close.dur[k] * Math.max(0.35, v - b[k]));
  });
  return end > 0 ? Math.round((end + 0.1) * 100) / 100 : 0;
}
/** the chapter's look: the side panels come off (2-7) */
export const lookTargetOf = (chapter) => ({sides: chapter === 1 ? 0 : 1});

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

/** a chapter's later scene presses, seconds after its press in the tour: [{dt, scene}] */
export function chapterPlanOf(n, script = SCRIPT) {
  const i = script.findIndex((e) => e.chapter === n);
  if (i < 0) return [];
  const out = [];
  for (let j = i + 1; j < script.length && script[j].chapter === undefined; j++) if (script[j].scene) out.push({dt: Math.round((script[j].t - script[i].t) * 100) / 100, scene: script[j].scene});
  return out;
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
  }
  return Object.fromEntries(Object.entries(out).sort((x, y) => x[1] - y[1]));
}
