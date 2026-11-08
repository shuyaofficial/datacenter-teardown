// The auto tour's script, no three.js (the tests and the timeline check read it in node). SCRIPT is the operator's
// presses: a chapter button, a view / plane / scene / multiplier button, the zoom to the RWE. Everything that moves is
// a pure function of the clock these presses make; beatsOf() lists the moments timeline.json carries.
import {CHAPTERS} from './kin.js';
import {PRE, sceneClock} from './flow.js';

export const SCRIPT = [
  // 1 外観: 前面 3/4 → 背面 3/4（8 s）
  {t: 0, chapter: 1, view: 'front'},
  {t: 4, view: 'back'},
  // 2 蓋を開ける: 天板 → ヒートシンク → NM → 電源（10 s）
  {t: 8, chapter: 2},
  // 3 役割分担: データプレーン → コントロールプレーン（8 s）
  {t: 18, chapter: 3},
  {t: 19.2, plane: 'data'},
  {t: 22.6, plane: 'ctrl'},
  // 4 パケットの一生: l2 を 1 往復 → l3 の書き換えに寄る（20 s）
  {t: 26, chapter: 4},
  {t: 36.2, scene: 'l3'},
  {t: 40.6, zoom: 'rwe'},
  // 5 CPU に上がるとき: arp → storm の計器（16 s）
  {t: 46, chapter: 5},
  {t: 57.2, scene: 'storm'},
  // 6 混んだとき: 倍率 100 で満杯 → 1200 に切り替え（13.4 s）
  {t: 62, chapter: 6},
  {t: 66.8, mult: 1200},
  // 7 冷却と電力: 横から風 → 全景で PoE（8 s）
  {t: 75.4, chapter: 7},
  {t: 80.2, sub7: 'poe'},
  // 一周して外観に戻る（閉じながら）
  {t: 84.2, chapter: 1, view: 'front'},
];
export const DURATION = 86.4;
export const DEFAULTS = {chapter: 1, view: 'front', plane: null, scene: null, mult: 100, sub7: 'air', zoom: null};

/** where the chapter's explode wants to be: open for 2-3; from 4 on the NM and the PSU go back in and the cover (and in
 * 4-6 the heatsink) is taken away instead, so the board reads without the lifted parts in the way */
export const explodeOf = (chapter) => (chapter >= 2 && chapter <= 3 ? 1 : 0);
/** [cover, heatsink] taken away: the cover from chapter 4 on, the heatsink in 4-6 (the stage board, the punt, the queues) */
export const awayOf = (chapter) => [chapter >= 4 ? 1 : 0, chapter >= 4 && chapter <= 6 ? 1 : 0];

/** the operator's state at t: chapter, view, plane, scene, mult, sub7, zoom (the last press of each) */
export function stateAtScript(t, script = SCRIPT) {
  const s = {...DEFAULTS};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      s.chapter = e.chapter;
      s.plane = null;
      s.zoom = null;
      s.sub7 = 'air';
      s.mult = 100;
      s.scene = CHAPTERS[e.chapter - 1].scenes?.[0] ?? null;
    }
    if (e.scene !== undefined) s.zoom = null;
    for (const k of ['view', 'plane', 'scene', 'mult', 'sub7', 'zoom']) if (e[k] !== undefined) s[k] = e[k];
  }
  return s;
}

/** the press that started the scene's clock at t: {t0, pre} (a chapter press waits PRE for the camera) */
export function sceneStartOf(t, script = SCRIPT) {
  let out = {t0: 0, pre: 0};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) out = {t0: e.t, pre: PRE};
    else if (e.scene !== undefined || e.mult !== undefined) out = {t0: e.t, pre: 0};
  }
  return out;
}
/** the scene's staged time at film time t */
export function sceneTAt(t, script = SCRIPT) {
  const s = stateAtScript(t, script);
  if (!s.scene || s.chapter < 4) return 0;
  const {t0, pre} = sceneStartOf(t, script);
  return sceneClock(s.scene, t - t0, pre);
}

/** the presses that open / close the cover: [{t, to}] for liftsAt */
export function explodeEventsOf(script = SCRIPT) {
  const out = [];
  let cur = 0;
  for (const e of script) {
    const to = e.explode ?? (e.chapter !== undefined ? explodeOf(e.chapter) : cur);
    if (to !== cur) {
      out.push({t: e.t, to});
      cur = to;
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
    if (e.plane !== undefined) out[key(`plane_${e.plane}`)] = e.t;
    if (e.scene !== undefined && e.chapter === undefined) out[key(`scene_${e.scene}`)] = e.t;
    if (e.mult !== undefined) out[key(`mult_${e.mult}`)] = e.t;
    if (e.sub7 !== undefined) out[key(`sub7_${e.sub7}`)] = e.t;
    if (e.zoom !== undefined) out[key(`zoom_${e.zoom}`)] = e.t;
    if (e.explode !== undefined && e.chapter === undefined) out[key(`explode_${e.explode}`)] = e.t;
  }
  return Object.fromEntries(Object.entries(out).sort((x, y) => x[1] - y[1]));
}
