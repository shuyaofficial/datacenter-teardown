// The switch as a page you drive: the film's chassis, studio and console in real time. Seven chapter buttons and the
// buttons of the chapter (front / back, open / close, data plane / control plane, the scenes, the Q1 multiplier); an
// orbit you drag and a zoom on the wheel. Left alone it plays the film's script as an auto tour with the operator's
// cursor, looped; a click, drag, wheel or key hands control to the visitor, who takes over where the tour left
// off; 25 s of quiet hands it back. With prefers-reduced-motion there is no auto tour, the lift jumps and the packet
// jumps from stage to stage. Without WebGL the page is a text version: the chapters and the 12 stages.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, subsOf} from './console.js';
import {blendCam, camAt, gaugesOf, lastChange, lastChapter, lookOf, makeConsoleFrame, makeFilmCursor, ss, VIEW_FN, viewKeyOf} from './film.js';
import {PRE, sceneClock} from './flow.js';
import {CHAPTERS, liftsAt, SCENES, snapT, STAGES} from './kin.js';
import {DEFAULTS, DURATION, explodeEventsOf, explodeOf, sceneStartOf, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const EVENTS = explodeEventsOf();

const CSS = (top) => `
html,body{overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:${top}px;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.tourchip{position:absolute;left:840px;top:40px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;height:28px;padding:0 14px;border:1px solid #e6ddcf;border-radius:5px;background:rgba(252,250,246,.95);color:#262420;font:700 13px 'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;letter-spacing:.04em;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:7px;height:7px;border-radius:50%;background:#e3562a}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@media (prefers-reduced-motion:reduce){.tourchip.on i{animation:none}}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 13px/1.4 'Hiragino Sans','Noto Sans JP',sans-serif;color:#8f8577;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
.txt{max-width:900px;margin:0 auto;padding:28px 20px;font:500 15px/1.75 'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;color:#262420}
.txt h1{font-size:26px;margin:0 0 4px}.txt h2{font-size:17px;margin:22px 0 4px}.txt code{font:12.5px 'JetBrains Mono',monospace;color:#5f584e}
.txt ol{padding-left:22px}.txt small{color:#8f8577}
`;

/** the version without WebGL: every chapter's text and command, then the 12 stages */
function runText(app) {
  const style = document.createElement('style');
  style.textContent = CSS(0);
  document.head.appendChild(style);
  app.style.cssText = 'position:static!important;width:auto;height:auto;transform:none';
  const chapters = CHAPTERS.map(
    (c) =>
      `<h2>${c.n}　${c.name}</h2><p>${c.text}</p>` + c.lab.map((l) => `<div><code>${l.cmd}</code> <small>${l.iol ? 'IOL で出る' : '実機のみ'}</small></div>`).join(''),
  ).join('');
  const stages = STAGES.map((s) => `<li><b>${s.abbr}</b>　${s.what}</li>`).join('');
  app.innerHTML = `<div class="txt"><h1>スイッチの分解</h1><small>WebGL が使えないため文字版を出しています。非公式の教材です。Catalyst 9300-48P を模した簡略形状で、Cisco・Catalyst は Cisco Systems, Inc. の商標です。寸法と数値は refs.md の出典によります。</small>${chapters}<h2>ASIC の中の 12 段</h2><ol>${stages}</ol></div>`;
  window.LIVE = {T: 0, tour: false, s: {chapter: 1, scene: '', stage: -1, explode: 0, queueBytes: 0, cpuPass: 0, cpuDrop: 0}, text: true};
}

export function runLive() {
  const top = Number(document.body.dataset.top || 0);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  let st;
  try {
    st = createStage({canvas});
  } catch (e) {
    canvas.remove();
    runText(app);
    return;
  }
  const style = document.createElement('style');
  style.textContent = CSS(top);
  document.head.appendChild(style);
  const ui = createConsole(app);
  const tourCursor = makeFilmCursor(ui);
  const frameConsole = makeConsoleFrame(ui, st);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ------------------------------------------------------------ quality tiers
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    const h = innerHeight - top;
    scale = Math.min(innerWidth / W, h / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(h - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...q} = TIERS[tier];
    st.setQuality(q);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const turn = document.createElement('div');
  turn.className = 'turn';
  turn.textContent = '横向きにすると操作盤がすべて見えます';
  document.body.appendChild(turn);

  // ------------------------------------------------------------ state: the visitor's choices
  let T = 0;
  const V = {...DEFAULTS};
  let exTarget = 0;
  let liftInit = [0, 0, 0, 0];
  let liveEvents = [];
  let sceneT0 = 0;
  let scenePre = 0;
  let chapterT0 = 0;
  let prevChapter = 1;
  let planeT0 = -9;
  let changeT = -9; // when the view last changed, for the label fade
  const off = {az: 0, el: 0, k: 1};
  let cam = null;
  let ring = {t: -9, x: 0, y: 0};
  const pulse = (k) => {
    const sp = ui.spots[k];
    if (sp) ring = {t: T, x: sp[0], y: sp[1]};
  };

  // ------------------------------------------------------------ the tour
  const AP = {on: !reduced, t0: 0};
  let lastInput = 0;
  const startTour = () => {
    AP.on = true;
    AP.t0 = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
    cam = null;
  };
  // the visitor takes over where the tour left off: its choices, and the lifts as they are right now
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    Object.assign(V, stateAtScript(cyc));
    exTarget = explodeOf(V.chapter);
    liftInit = liftsAt(EVENTS, cyc).lifts;
    liveEvents = [{t: T, to: exTarget}];
    planeT0 = T - 1;
    changeT = T - 3;
    // the scene keeps running from where the tour had it
    const st0 = sceneStartOf(cyc);
    sceneT0 = T - (cyc - st0.t0);
    scenePre = st0.pre;
    const ch = lastChapter(cyc);
    chapterT0 = T - (cyc - ch.t);
    prevChapter = ch.prev;
  };
  const setExplode = (to) => {
    exTarget = to;
    const cur = liftsAt(liveEvents, T, liftInit, reduced).lifts;
    liftInit = cur;
    liveEvents = [{t: T, to}];
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ controls
  const goChapter = (n) => {
    takeOver();
    pulse(`c_${n}`);
    prevChapter = V.chapter;
    chapterT0 = T;
    V.chapter = n;
    V.plane = null;
    V.zoom = null;
    V.sub7 = 'air';
    V.mult = 100;
    V.scene = CHAPTERS[n - 1].scenes?.[0] ?? null;
    if (n === 1) V.view = 'front';
    sceneT0 = T;
    scenePre = PRE;
    changeT = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
    setExplode(explodeOf(n));
  };
  for (const c of CHAPTERS) ui.btn[`c_${c.n}`].addEventListener('click', () => goChapter(c.n));
  for (const c of CHAPTERS)
    for (const sb of subsOf(c.n)) {
      ui.btn[`s_${sb.id}`].addEventListener('click', () => {
        takeOver();
        pulse(`s_${sb.id}`);
        const id = sb.id;
        if (id === 'front' || id === 'back') {
          V.view = id;
          changeT = T;
        } else if (id === 'open' || id === 'close') setExplode(id === 'open' ? 1 : 0);
        else if (id === 'data' || id === 'ctrl') {
          V.plane = V.plane === id ? null : id;
          planeT0 = T;
          changeT = T;
        } else if (id === 'air' || id === 'poe') {
          V.sub7 = id;
          changeT = T;
        } else if (/^m\d+$/.test(id)) {
          V.mult = Number(id.slice(1));
          sceneT0 = T;
          scenePre = 0;
        } else if (SCENES[id]) {
          V.scene = id;
          V.zoom = null;
          sceneT0 = T;
          scenePre = 0;
        }
      });
    }
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^[1-7]$/.test(e.key)) {
      goChapter(Number(e.key));
      e.preventDefault();
    }
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -25, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.35, 2.5);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ the frame
  if (AP.on) startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  window.LIVE = {
    st,
    startTour,
    takeOver,
    s: null,
    get tier() {
      return tier;
    },
    get T() {
      return T;
    },
    get tour() {
      return AP.on;
    },
    get V() {
      return V;
    },
  };
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }
    if (!AP.on && T - lastInput > IDLE && !reduced) startTour();

    let sc;
    let lifts;
    let tgt = null;
    let cursor;
    let labelO;
    let planeK;
    let sceneT;
    let chK;
    let prevCh;
    if (AP.on) {
      const cyc = (T - AP.t0) % DURATION;
      sc = stateAtScript(cyc);
      lifts = liftsAt(EVENTS, cyc).lifts;
      tgt = camAt(cyc);
      const tc = lastChange(cyc);
      labelO = tc === 0 ? 1 : ss(tc + (sc.chapter === 2 ? 1.9 : 1.3), tc + (sc.chapter === 2 ? 2.5 : 1.9), cyc);
      planeK = sc.plane ? ss(tc, tc + 0.7, cyc) : 0;
      cursor = tourCursor(cyc);
      sceneT = sceneTAt(cyc);
      const ch = lastChapter(cyc);
      chK = ch.t === 0 ? 1 : ss(ch.t + 0.5, ch.t + 1.7, cyc);
      prevCh = ch.prev;
    } else {
      sc = {...V};
      lifts = liftsAt(liveEvents, T, liftInit, reduced).lifts;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      labelO = ss(changeT + (sc.chapter === 2 ? 1.9 : 1.3), changeT + (sc.chapter === 2 ? 2.5 : 1.9), T);
      planeK = sc.plane ? (reduced ? 1 : ss(planeT0, planeT0 + 0.7, T)) : 0;
      sceneT = sc.chapter >= 4 ? sceneClock(sc.scene, T - sceneT0, scenePre) : 0;
      // reduced motion: the packet jumps from stage to stage (the storm and the queue still count up)
      if (reduced && sc.scene && !SCENES[sc.scene].rate && !SCENES[sc.scene].queue) sceneT = snapT(sc.scene, sceneT);
      chK = reduced ? 1 : ss(chapterT0 + 0.5, chapterT0 + 1.7, T);
      prevCh = prevChapter;
    }
    const look = lookOf(sc, sceneT, chK, prevCh, T, reduced);
    const viewKey = viewKeyOf(sc);
    if (!tgt) {
      tgt = {...VIEW_FN[viewKey](0, {scene: sc.scene, sceneT})};
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -20, 89);
      tgt.d *= off.k;
    }
    if (!cam) cam = {...tgt};
    const k = reduced ? 1 : 1 - Math.exp(-dt / (AP.on ? 0.12 : 0.35));
    const az = cam.az + wrap(tgt.az - cam.az) * k;
    cam = {...blendCam(cam, tgt, k), az};
    st.frame({...look, lifts, T, plane: sc.plane, planeK}, {...cam, az: cam.az * D2R, el: cam.el * D2R});
    const exTargetNow = AP.on ? explodeOf(sc.chapter) : exTarget;
    frameConsole({sc, viewKey, labelO, exTarget: exTargetNow, sceneT, sub7: sc.sub7, cursor, look});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>自動ツアー中・クリックで操作できます' : '▶ ツアーに戻る';
    }
    const g = gaugesOf(sc.chapter >= 4 ? sc.scene : null, sceneT, sc.mult);
    window.LIVE.s = {
      chapter: sc.chapter,
      scene: sc.chapter >= 4 && sc.scene ? sc.scene : '',
      view: sc.view,
      plane: sc.plane ?? '',
      stage: g.stage,
      explode: lifts.reduce((a, b) => a + b, 0) / lifts.length,
      lifts,
      queueBytes: g.queue.bytes,
      cpuPass: g.punt ? g.punt.pass : 0,
      cpuDrop: g.punt ? g.punt.drop : 0,
      mult: sc.mult,
    };
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  // every shader compiles at once off the main thread before the first frame (kit/warm.js)
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
}
