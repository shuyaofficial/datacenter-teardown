// The server as a page you drive: the film's box, studio and console in real time (from nvl72-shared/live.js). Seven
// chapter buttons and the buttons of the chapter (front / bezel / back, pull out / push in, the scenes), the rack's
// power-limit slider and the air's temperature slider; an orbit you drag and a zoom on the wheel. Left alone it plays
// the film's script as an auto tour with the operator's cursor, looped; a click, drag, wheel or key hands control to the
// visitor, who takes over where the tour left off; 25 s of quiet hands it back. With prefers-reduced-motion there is no
// auto tour, the tray jumps, the beads jump from step to step and the dashes stand still. Without WebGL the page is a
// text version: the chapters and their commands.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, SLIDER, subsOf} from './console.js';
import {blendCam, camAt, dTAt, holdAt, labelWait, lastChange, lastChapter, lookOf, makeConsoleFrame, makeFilmCursor, ss, VIEW_FN, viewKeyOf} from './film.js';
import {PRE, sceneClock} from './flow.js';
import {bezelAt, CHAPTERS, DT_SRC, gaugesAt, liftsAt, LIQUID_NOTE, NEXT_GEN, NOTICE, perRackOf, rackAt, snapT, SPEC} from './kin.js';
import {bezelEventsOf, bezelOf, DEFAULTS, DURATION, explodeEventsOf, explodeOf, holdOf, sceneStartOf, sceneTAt, stateAtScript} from './script.js';
import {createStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const EVENTS = explodeEventsOf();
const BEZ = bezelEventsOf();

const CSS = (top) => `
html,body{overflow:hidden}
#app{position:absolute!important;inset:auto!important;left:0;top:${top}px;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab}
#gl.drag{cursor:grabbing}
.bt{pointer-events:auto;cursor:pointer}
.bt:hover{filter:brightness(.96)}
.sl{pointer-events:auto;cursor:pointer;touch-action:none}
.tourchip{position:absolute;left:44px;top:704px;width:268px;box-sizing:border-box;display:flex;justify-content:center;align-items:center;gap:8px;height:28px;padding:0 10px;border:1px solid #dde3e6;border-radius:5px;background:rgba(250,251,252,.95);color:#1f2427;font:700 13px 'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;letter-spacing:.04em;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:7px;height:7px;border-radius:50%;background:#0f9fa8}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@media (prefers-reduced-motion:reduce){.tourchip.on i{animation:none}}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 13px/1.4 'Hiragino Sans','Noto Sans JP',sans-serif;color:#7d878d;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
.txt{max-width:900px;margin:0 auto;padding:28px 20px;font:500 15px/1.75 'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;color:#1f2427}
.txt h1{font-size:26px;margin:0 0 4px}.txt h2{font-size:17px;margin:22px 0 4px}.txt code{font:12.5px 'JetBrains Mono',monospace;color:#5f584e}
.txt ul{padding-left:22px}.txt small{color:#7d878d}
`;

/** the version without WebGL: every chapter's text and command, the notice, the next generation */
function runText(app) {
  const style = document.createElement('style');
  style.textContent = CSS(0);
  document.head.appendChild(style);
  app.style.cssText = 'position:static!important;width:auto;height:auto;transform:none';
  const chapters = CHAPTERS.map(
    (c) => `<h2>${c.n}　${c.name}</h2><p>${c.text}</p>` + c.lab.map((l) => `<div><code>${l.cmd.replace(/</g, '&lt;')}</code></div>`).join('') + `<small>${c.labWhat}（実機のみ）</small>`,
  ).join('');
  const next = NEXT_GEN.map((l) => `<li>${l}</li>`).join('');
  app.innerHTML = `<div class="txt"><h1>GPU サーバーの分解（DGX B200 風）</h1><small>WebGL が使えないため文字版を出しています。${NOTICE}。</small>${chapters}<h2>次の世代</h2><ul>${next}</ul><p><small>${LIQUID_NOTE}</small></p></div>`;
  window.LIVE = {T: 0, tour: false, s: {chapter: 1, scene: '', pull: 0, hops: 0, inDomain: 0, outRatio: 0, sentGB: 0, outGB: 0, ms: 0, amps: 0, cfm: 0, dT: 0, perRack: 0}, text: true};
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

  // ------------------------------------------------------------ quality tiers (as the switch's)
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
  let exTarget = explodeOf(1);
  let liftInit = [0, 0, 0, 0, 0];
  let liveEvents = [];
  let bezInit = 0;
  let bezEvents = [];
  let sceneT0 = 0;
  let scenePre = 0;
  let chapterT0 = 0;
  let prevChapter = 1;
  // after a chapter press that sends the pulled tray back, the camera holds on the old view for camHold seconds
  let camHold = 0;
  let holdKey = 'front';
  let offPending = false;
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
  // the visitor takes over where the tour left off: its choices, the tray as it is right now
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const cyc = (T - AP.t0) % DURATION;
    Object.assign(V, stateAtScript(cyc));
    V.dT = dTAt(cyc);
    exTarget = explodeOf(V.chapter);
    liftInit = liftsAt(EVENTS, cyc).lifts;
    liveEvents = [{t: T, to: exTarget}];
    bezInit = bezelAt(BEZ, cyc);
    bezEvents = [{t: T, to: bezelOf(V)}];
    changeT = T - 3;
    const st0 = sceneStartOf(cyc);
    sceneT0 = T - (cyc - st0.t0);
    scenePre = st0.pre;
    const ch = lastChapter(cyc);
    chapterT0 = T - (cyc - ch.t);
    prevChapter = ch.prev;
    camHold = reduced ? 0 : holdOf(ch.prev, ch.n);
    holdKey = viewKeyOf(stateAtScript(Math.max(0, ch.t - 1e-6)));
    offPending = false;
  };
  const setExplode = (to) => {
    exTarget = to;
    const cur = liftsAt(liveEvents, T, liftInit, reduced).lifts;
    liftInit = cur;
    liveEvents = [{t: T, to}];
  };
  const setBezel = () => {
    bezInit = bezelAt(bezEvents, T, bezInit, reduced);
    bezEvents = [{t: T, to: bezelOf(V)}];
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
    camHold = reduced ? 0 : holdOf(V.chapter, n);
    holdKey = viewKeyOf(V);
    prevChapter = V.chapter;
    chapterT0 = T;
    V.chapter = n;
    V.scene = CHAPTERS[n - 1].scenes?.[0] ?? null;
    V.dT = DT_SRC;
    V.limit = SPEC.rack.limitDefault;
    V.from = 0;
    if (n === 1) V.view = 'front';
    sceneT0 = T;
    scenePre = PRE;
    changeT = T;
    offPending = camHold > 0;
    if (!offPending) Object.assign(off, {az: 0, el: 0, k: 1});
    setExplode(explodeOf(n));
    setBezel();
  };
  for (const c of CHAPTERS) ui.btn[`c_${c.n}`].addEventListener('click', () => goChapter(c.n));
  for (const c of CHAPTERS)
    for (const sb of subsOf(c.n)) {
      ui.btn[`s_${sb.id}`].addEventListener('click', () => {
        takeOver();
        pulse(`s_${sb.id}`);
        const id = sb.id;
        if (id === 'front' || id === 'bezel' || id === 'back') {
          V.view = id;
          changeT = T;
          setBezel();
        } else if (id === 'open' || id === 'close') setExplode(id === 'open' ? explodeOf(2) : explodeOf(1));
        else {
          if (viewKeyOf({...V, scene: id}) !== viewKeyOf(V)) changeT = T;
          V.scene = id;
          V.from = 0;
          sceneT0 = T;
          scenePre = 0;
        }
      });
    }
  // the air slider: drag the knob (10-20 K)
  let sliding = false;
  const slideTo = (e) => {
    const r = ui.slider.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 268 + 44;
    V.dT = clamp(SPEC.air.dTMin + ((x - SLIDER.x0) / (SLIDER.x1 - SLIDER.x0)) * (SPEC.air.dTMax - SPEC.air.dTMin), SPEC.air.dTMin, SPEC.air.dTMax);
  };
  ui.slider.addEventListener('pointerdown', (e) => {
    takeOver();
    sliding = true;
    ui.slider.setPointerCapture(e.pointerId);
    slideTo(e);
  });
  ui.slider.addEventListener('pointermove', (e) => {
    if (!sliding) return;
    lastInput = T;
    slideTo(e);
  });
  ui.slider.addEventListener('pointerup', () => (sliding = false));
  // the rack's power-limit slider: 30 / 40 / 60 kW (仮定), it snaps to the nearest; the boxes in stay, the rest slide
  let limiting = false;
  const LIM = SPEC.rack.limits;
  const limitTo = (e) => {
    const r = ui.limSlider.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 268 + 44;
    const kw = LIM[0] + ((x - SLIDER.x0) / (SLIDER.x1 - SLIDER.x0)) * (LIM[LIM.length - 1] - LIM[0]);
    const next = LIM.reduce((a, b) => (Math.abs(b - kw) < Math.abs(a - kw) ? b : a));
    if (next === V.limit) return;
    const now = rackAt(sceneClock('rack', T - sceneT0, scenePre), V.limit, V.from);
    V.from = Math.round(now.ins.reduce((a, b) => a + b, 0));
    V.limit = next;
    sceneT0 = T;
    scenePre = 0;
  };
  ui.limSlider.addEventListener('pointerdown', (e) => {
    takeOver();
    limiting = true;
    ui.limSlider.setPointerCapture(e.pointerId);
    limitTo(e);
  });
  ui.limSlider.addEventListener('pointermove', (e) => {
    if (!limiting) return;
    lastInput = T;
    limitTo(e);
  });
  ui.limSlider.addEventListener('pointerup', () => (limiting = false));
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
    let sceneT;
    let chK;
    let chKTray;
    let prevCh;
    let dT;
    let clock;
    let bezel;
    if (AP.on) {
      const cyc = (T - AP.t0) % DURATION;
      clock = cyc;
      sc = stateAtScript(cyc);
      lifts = liftsAt(EVENTS, cyc).lifts;
      tgt = camAt(cyc);
      const tc = lastChange(cyc);
      const hold = holdAt(cyc);
      const wait = labelWait(sc.chapter, hold);
      labelO = tc === 0 ? 1 : ss(tc + wait, tc + wait + 0.6, cyc);
      cursor = tourCursor(cyc);
      sceneT = sceneTAt(cyc);
      const ch = lastChapter(cyc);
      chK = ch.t === 0 ? 1 : ss(ch.t + hold + 0.3, ch.t + hold + 1.5, cyc);
      chKTray = ch.t === 0 ? 1 : ss(ch.t + 0.3, ch.t + 1.5, cyc);
      prevCh = ch.prev;
      dT = dTAt(cyc);
      bezel = bezelAt(BEZ, cyc);
    } else {
      clock = T;
      sc = {...V};
      lifts = liftsAt(liveEvents, T, liftInit, reduced).lifts;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      const hold = changeT === chapterT0 ? camHold : 0;
      const wait = labelWait(sc.chapter, hold);
      labelO = reduced ? 1 : ss(changeT + wait, changeT + wait + 0.6, T);
      sceneT = sc.scene ? sceneClock(sc.scene, T - sceneT0, scenePre) : 0;
      // reduced motion: the beads jump from step to step
      if (reduced && sc.scene) sceneT = snapT(sc.scene, sceneT);
      chK = reduced ? 1 : ss(chapterT0 + camHold + 0.3, chapterT0 + camHold + 1.5, T);
      chKTray = reduced ? 1 : ss(chapterT0 + 0.3, chapterT0 + 1.5, T);
      prevCh = prevChapter;
      dT = V.dT;
      bezel = bezelAt(bezEvents, T, bezInit, reduced);
    }
    const look = {...lookOf(sc, sceneT, chK, prevCh, clock, {dT, reduced, chKTray, bezel}), lifts};
    // the visitor's camera waits for the tray to be in, on the view it had
    const holding = !AP.on && T - chapterT0 < camHold;
    if (offPending && !holding) {
      offPending = false;
      Object.assign(off, {az: 0, el: 0, k: 1});
    }
    const viewKey = holding ? holdKey : viewKeyOf(sc);
    if (!tgt) {
      tgt = {...VIEW_FN[viewKey](0)};
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -20, 89);
      tgt.d *= off.k;
    }
    if (!cam) cam = {...tgt};
    const k = reduced ? 1 : 1 - Math.exp(-dt / (AP.on ? 0.12 : 0.35));
    const az = cam.az + wrap(tgt.az - cam.az) * k;
    cam = {...blendCam(cam, tgt, k), az};
    st.frame(look, {...cam, az: cam.az * D2R, el: cam.el * D2R});
    const exOpen = AP.on ? sc.chapter === 2 : exTarget[1] > 0.5 && sc.chapter === 2;
    frameConsole({sc, viewKey, labelO, exOpen, sceneT, dT, pull: lifts[0], cursor, look});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>自動ツアー中・クリックで操作できます' : '▶ ツアーに戻る';
    }
    const g = gaugesAt(sc.scene, sceneT, {dT, limit: sc.limit, from: sc.from});
    window.LIVE.s = {
      chapter: sc.chapter,
      scene: sc.scene ?? '',
      view: sc.view,
      pull: lifts[0],
      lifts,
      hops: g.hops,
      links: g.links,
      inDomain: g.inDomain,
      outRatio: g.outRatio,
      sentGB: g.sentGB,
      outGB: g.outGB,
      ms: g.ms,
      amps: g.amps,
      cfm: g.cfm,
      dT: g.dT,
      dTSet: dT,
      limit: sc.limit,
      perRack: g.perRack,
    };
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    requestAnimationFrame(frame);
  };
  // every shader compiles at once before the first frame (kit/warm.js)
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => requestAnimationFrame(frame));
}
