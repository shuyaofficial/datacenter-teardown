// The auto tour's script, no three.js (the tests and the timeline check read it in node). SCRIPT is the operator's
// presses: a chapter button, a view / scene button. Everything that moves is a pure function of the clock these
// presses make; beatsOf() lists the moments timeline.json carries.
import {CHAPTERS, EXPLODE} from './kin.js';
import {PRE, sceneClock} from './flow.js';

export const SCRIPT = [
  // 1 外観: 前 → 後ろ（10 s）
  {t: 0, chapter: 1, view: 'front'},
  {t: 5, view: 'back'},
  // 2 計算スレッドを引き出して分解（12 s）
  {t: 10, chapter: 2},
  // 3 torus → hop（12 s）
  {t: 22, chapter: 3},
  {t: 28.4, scene: 'hop'},
  // 4 zring（12 s）
  {t: 34, chapter: 4},
  // 5 flat → hier（16 s）
  {t: 46, chapter: 5},
  {t: 54.6, scene: 'hier'},
  // 6 out（10 s）
  {t: 62, chapter: 6},
  // 7 compare（12 s）
  {t: 72, chapter: 7},
  // 全景で締める
  {t: 84, chapter: 1, view: 'front'},
];
export const DURATION = 88;
export const DEFAULTS = {chapter: 1, view: 'front', scene: null};

/** where the pulled sled's five layers want to be in a chapter: [pull, lid, sinks, chips, io] */
export const explodeOf = (chapter) => (chapter === 2 ? [1, 1, 1, 1, 1] : chapter === 6 ? [1, 1, 1, 0, 0] : [0, 0, 0, 0, 0]);
/** seconds after a chapter press that the camera waits while the pulled sled goes back (the slowest layer that moves
 * down plus a short beat), so the sled and the camera never move at once */
export function holdOf(prev, next) {
  const a = explodeOf(prev);
  const b = explodeOf(next);
  let end = 0;
  a.forEach((v, k) => {
    if (b[k] < v - 1e-6) end = Math.max(end, EXPLODE.close.delay[k] + EXPLODE.close.dur[k] * Math.max(0.35, v - b[k]));
  });
  return end > 0 ? Math.round((end + 0.1) * 100) / 100 : 0;
}
/** the chapter's look: the side panels come off (2-6), the lifted lid is taken away and the heatsinks stay up so the chip shows (6), the diagram (3-5), the NVL72
 * silhouette (7) */
export const lookTargetOf = (chapter) => ({
  sides: chapter === 1 || chapter === 7 ? 0 : 1,
  lidAway: chapter === 6 ? 1 : 0,
  diagram: chapter >= 3 && chapter <= 5 ? 1 : 0,
  nv: chapter === 7 ? 1 : 0,
});

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

/** the presses that move the pulled sled: [{t, to: [5]}] for liftsAt */
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
