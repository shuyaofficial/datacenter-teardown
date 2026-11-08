// The auto tour's script, no three.js (the tests and the timeline check read it in node). SCRIPT is the operator's
// presses: a chapter button, a view / scene button, the rack's power limit and the air's temperature difference.
// Everything that moves is a pure function of the clock these presses make; beatsOf() lists the moments timeline.json
// carries.
import {CHAPTERS, DT_SRC, EXPLODE, perRackOf, SPEC} from './kin.js';
import {PRE, sceneClock} from './flow.js';

export const SCRIPT = [
  // 1 外観: 前 → ベゼルを外す → 後ろ（10 s）
  {t: 0, chapter: 1, view: 'front'},
  {t: 3.5, view: 'bezel'},
  {t: 6.5, view: 'back'},
  // 2 2 段に分ける: マザーボードトレイを引き出して、天板 → ヒートシンク → エアバッフル → CPU のヒートシンクの順に浮く（12 s）
  {t: 10, chapter: 2},
  // 3 8 個が 1 つになる: fan → hop（12 s）
  {t: 22, chapter: 3},
  {t: 28, scene: 'hop'},
  // 4 8 で止まる: wall → rails（14 s）
  {t: 34, chapter: 4},
  {t: 41, scene: 'rails'},
  // 5 72 個で集計する: hier → vs72（16 s）
  {t: 48, chapter: 5},
  {t: 59, scene: 'vs72'},
  // 6 14.3 kW を運び込む: power → rack、上限 30 kW → 60 kW（10 s）
  {t: 64, chapter: 6},
  {t: 69, scene: 'rack'},
  {t: 72, limit: 60},
  // 7 風で冷やす: 出典の 1,550 CFM（16.2 K）→ 温度差 10 K（10 s）
  {t: 74, chapter: 7},
  {t: 79.5, dT: 10},
  // 全景で締める
  {t: 84, chapter: 1, view: 'front'},
];
export const DURATION = 88;
export const DEFAULTS = {chapter: 1, view: 'front', scene: null, dT: DT_SRC, limit: SPEC.rack.limitDefault, from: 0};

/** where the motherboard tray's five layers want to be in a chapter: [pull, lid, sinks, baffle, cpuSinks] */
export const explodeOf = (chapter) => (chapter === 2 ? [1, 1, 1, 1, 1] : [0, 0, 0, 0, 0]);
/** the bezel: off (1) except on the front view of chapter 1 */
export const bezelOf = (s) => (s.chapter === 1 && s.view === 'front' ? 0 : 1);
/** seconds after a chapter press that the camera (and the chapter's look) wait while the tray goes back */
export function holdOf(prev, next) {
  const a = explodeOf(prev);
  const b = explodeOf(next);
  let end = 0;
  a.forEach((v, k) => {
    if (b[k] < v - 1e-6) end = Math.max(end, EXPLODE.close.delay[k] + EXPLODE.close.dur[k] * Math.max(0.35, v - b[k]));
  });
  return end > 0 ? Math.round((end + 0.1) * 100) / 100 : 0;
}
/** the chapter's look: the side walls come off (2, 3), the lid and the heatsinks come off (3), the 8 other boxes and the leaves (4, 5) */
export const lookTargetOf = (chapter) => ({lidAway: chapter === 3 ? 1 : 0, ghost: chapter === 3 ? 1 : 0, sides: chapter === 2 || chapter === 3 ? 1 : 0, cluster: chapter === 4 || chapter === 5 ? 1 : 0});

/** the operator's state at t: chapter, view, scene, dT, limit (the last press of each) and from (boxes in before the limit) */
export function stateAtScript(t, script = SCRIPT) {
  const s = {...DEFAULTS};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) {
      s.chapter = e.chapter;
      s.scene = CHAPTERS[e.chapter - 1].scenes?.[0] ?? null;
      s.dT = DT_SRC;
      s.limit = SPEC.rack.limitDefault;
      s.from = 0;
    }
    if (e.scene === 'rack') s.from = 0;
    if (e.limit !== undefined) {
      s.from = perRackOf(s.limit);
      s.limit = e.limit;
    }
    for (const k of ['view', 'scene', 'dT']) if (e[k] !== undefined) s[k] = e[k];
  }
  return s;
}

/** the press that started the scene's clock at t: {t0, pre} (a chapter press waits PRE for the camera; a limit restarts the rack) */
export function sceneStartOf(t, script = SCRIPT) {
  let out = {t0: 0, pre: 0};
  for (const e of script) {
    if (e.t > t) break;
    if (e.chapter !== undefined) out = {t0: e.t, pre: PRE};
    else if (e.scene !== undefined || e.limit !== undefined) out = {t0: e.t, pre: 0};
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

/** the presses that move the motherboard tray: [{t, to: [5]}] for liftsAt */
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
/** the presses that move the bezel: [{t, to}] for bezelAt */
export function bezelEventsOf(script = SCRIPT) {
  const out = [];
  let cur = 0;
  for (const e of script) {
    if (e.chapter === undefined && e.view === undefined) continue;
    const to = bezelOf(stateAtScript(e.t, script));
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
    if (e.scene !== undefined && e.chapter === undefined) out[key(`scene_${e.scene}`)] = e.t;
    if (e.limit !== undefined) out[key(`limit_${e.limit}`)] = e.t;
    if (e.dT !== undefined) out[key(`dT_${e.dT}`)] = e.t;
  }
  return Object.fromEntries(Object.entries(out).sort((x, y) => x[1] - y[1]));
}
