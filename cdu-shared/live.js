// The CDU as a page you drive: the film's CDU, row, studio and console in real time (from nvl72-shared/live.js). Seven
// chapter buttons and the buttons of the chapter (views / doors / scenes), the temperature slider and the liquid toggle
// (chapter 4); an orbit you drag and a zoom on the wheel. Left alone it plays the film's script as an auto tour with the
// operator's cursor, looped; a click, drag, wheel or key hands control to the visitor, who takes over where the tour
// left off; 25 s of quiet hands it back. With prefers-reduced-motion there is no auto tour, the doors and tiers jump,
// the beads jump half a second at a time and the sequences from step to step. Without WebGL the page is a text version.
import {warmComposer} from 'teardown-kit/warm.js';
import {createConsole, SLIDER, subsOf} from './console.js';
import {beadSpeeds, blendCam, camAt, dTAt, holdAt, labelWait, lastChange, lastChapter, lookOf, makeConsoleFrame, makeFilmCursor, ss, TOUR_PHASE, VIEW_FN, viewKeyOf} from './film.js';
import {PRE, sceneClock} from './flow.js';
import {CHAPTERS, designDT, gaugesAt, liftsAt, NEXT_GEN, NOTICE, snapT, SPEC} from './kin.js';
import {DEFAULTS, DURATION, explodeEventsOf, explodeOf, holdOf, sceneStartOf, sceneTAt, stateAtScript, VIEW_SUBS} from './script.js';
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
.sl{pointer-events:auto;cursor:pointer;touch-action:none}
.tourchip{position:absolute;left:44px;top:710px;width:268px;box-sizing:border-box;display:flex;justify-content:center;align-items:center;gap:8px;height:26px;padding:0 10px;border:1px solid #dde3e6;border-radius:5px;background:rgba(250,251,252,.95);color:#1f2427;font:700 13px 'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;letter-spacing:.04em;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:7px;height:7px;border-radius:50%;background:#0f9fa8}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@media (prefers-reduced-motion:reduce){.tourchip.on i{animation:none}}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 13px/1.4 'Hiragino Sans','Noto Sans JP',sans-serif;color:#7d878d;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
.txt{max-width:900px;margin:0 auto;padding:28px 20px;font:500 15px/1.75 'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif;color:#1f2427}
.txt h1{font-size:26px;margin:0 0 4px}.txt h2{font-size:17px;margin:22px 0 4px}
.txt ul{padding-left:22px}.txt small{color:#7d878d}
`;

/** the version without WebGL: every chapter's text and where to read the values, the notice, the next generations */
function runText(app) {
  const style = document.createElement('style');
  style.textContent = CSS(0);
  document.head.appendChild(style);
  app.style.cssText = 'position:static!important;width:auto;height:auto;transform:none';
  const chapters = CHAPTERS.map(
    (c) => `<h2>${c.n}　${c.name}</h2><p>${c.text}</p><p><small>ネットワークで言えば: ${c.net}</small></p><div><small>実機で見るには（CDU に CLI は無い）: <b>${c.lab.where}</b> — ${c.lab.values}${c.lab.design !== '—' ? `（この教材の設計点: ${c.lab.design}）` : ''}</small></div>`,
  ).join('');
  const next = NEXT_GEN.map((l) => `<li>${l}</li>`).join('');
  app.innerHTML = `<div class="txt"><h1>液冷 CDU の分解</h1><small>WebGL が使えないため文字版を出しています。${NOTICE}。</small>${chapters}<h2>次の世代</h2><ul>${next}</ul></div>`;
  window.LIVE = {T: 0, tour: false, s: {chapter: 1, scene: '', open: 0, dT: designDT(), flowLpm: 0, fluid: 'pg25', racks: SPEC.rowRacks, pumpKw: SPEC.pump.kw1, pumpPct: 0.75, activePump: 1, activePumpName: 'A', tcsSupply: 40, tcsReturn: 53.9, fwsSupply: 37.2, fwsReturn: 47.2, atd: 2.8, alarm: ''}, text: true};
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

  // ------------------------------------------------------------ quality tiers (as the switch's and the rack's)
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
  let liftInit = [0, 0, 0, 0];
  let liveEvents = [];
  let exTarget = explodeOf(1);
  let sceneT0 = 0;
  let scenePre = 0;
  let chapterT0 = 0;
  let camHold = 0;
  let holdKey = 'row';
  let offPending = false;
  let changeT = -9;
  let tcsPhase = 0;
  let fwsPhase = 0;
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
  // the visitor takes over where the tour left off: its choices, the doors and tiers as they are right now
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
    changeT = T - 3;
    const st0 = sceneStartOf(cyc);
    sceneT0 = T - (cyc - st0.t0);
    scenePre = st0.pre;
    const ch = lastChapter(cyc);
    chapterT0 = T - (cyc - ch.t);
    camHold = reduced ? 0 : holdOf(ch.prev, ch.n);
    holdKey = viewKeyOf(stateAtScript(Math.max(0, ch.t - 1e-6)));
    offPending = false;
    tcsPhase = TOUR_PHASE.tcs(cyc);
    fwsPhase = TOUR_PHASE.fws(cyc);
  };
  const setExplode = (to) => {
    exTarget = to;
    liftInit = liftsAt(liveEvents, T, liftInit, reduced).lifts;
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
    camHold = reduced ? 0 : holdOf(V.chapter, n);
    holdKey = viewKeyOf(V);
    chapterT0 = T;
    V.chapter = n;
    V.scene = CHAPTERS[n - 1].scenes?.[0] ?? null;
    V.dT = designDT();
    V.fluid = 'pg25';
    if (VIEW_SUBS[n]) V.view = VIEW_SUBS[n][0];
    sceneT0 = T;
    scenePre = PRE;
    changeT = T;
    offPending = camHold > 0;
    if (!offPending) Object.assign(off, {az: 0, el: 0, k: 1});
    setExplode(explodeOf(n));
  };
  for (const c of CHAPTERS) ui.btn[`c_${c.n}`].addEventListener('click', () => goChapter(c.n));
  for (const c of CHAPTERS)
    for (const sb of subsOf(c.n)) {
      ui.btn[`s_${sb.id}`].addEventListener('click', () => {
        takeOver();
        pulse(`s_${sb.id}`);
        const id = sb.id;
        if (VIEW_SUBS[c.n]?.includes(id)) {
          V.view = id;
          changeT = T;
          Object.assign(off, {az: 0, el: 0, k: 1});
        } else if (id === 'open' || id === 'close') setExplode(id === 'open' ? explodeOf(2) : explodeOf(1));
        else {
          V.scene = id;
          sceneT0 = T;
          scenePre = 0;
          changeT = T;
        }
      });
    }
  for (const f of ['water', 'pg25'])
    ui.btn[`f_${f}`].addEventListener('click', () => {
      takeOver();
      pulse(`f_${f}`);
      V.fluid = f;
    });
  // the temperature slider: drag the knob (5-20 K)
  let sliding = false;
  const slideTo = (e) => {
    const r = ui.slider.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 268 + 44;
    V.dT = clamp(SPEC.slider.dTMin + ((x - SLIDER.x0) / (SLIDER.x1 - SLIDER.x0)) * (SPEC.slider.dTMax - SPEC.slider.dTMin), SPEC.slider.dTMin, SPEC.slider.dTMax);
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
    let labelAge;
    let chO;
    let sceneT;
    let chK;
    let dT;
    let clock;
    let phases;
    if (AP.on) {
      const cyc = (T - AP.t0) % DURATION;
      clock = cyc;
      sc = stateAtScript(cyc);
      lifts = liftsAt(EVENTS, cyc).lifts;
      tgt = camAt(cyc);
      const tc = lastChange(cyc);
      const ch = lastChapter(cyc);
      const hold = holdAt(cyc);
      const wait = labelWait(sc.chapter, tc === ch.t ? hold : 0);
      labelO = tc === 0 ? 1 : ss(tc + wait, tc + wait + 0.6, cyc);
      labelAge = cyc - tc - wait;
      chO = ch.t === 0 ? 1 : ss(ch.t + 1.5, ch.t + 2.1, cyc);
      cursor = tourCursor(cyc);
      sceneT = sceneTAt(cyc);
      chK = ch.t === 0 ? 1 : ss(ch.t + hold + 0.3, ch.t + hold + 1.5, cyc);
      dT = dTAt(cyc);
      phases = {tcsPhase: TOUR_PHASE.tcs(cyc), fwsPhase: TOUR_PHASE.fws(cyc)};
    } else {
      clock = T;
      sc = {...V};
      lifts = liftsAt(liveEvents, T, liftInit, reduced).lifts;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
      const hold = changeT === chapterT0 ? camHold : 0;
      const wait = labelWait(sc.chapter, hold);
      labelO = reduced ? 1 : ss(changeT + wait, changeT + wait + 0.6, T);
      labelAge = reduced ? 99 : T - changeT - wait;
      chO = reduced ? 1 : ss(chapterT0 + 1.5, chapterT0 + 2.1, T);
      sceneT = sc.scene ? sceneClock(sc.scene, T - sceneT0, scenePre) : 0;
      // reduced motion: the sequences jump from step to step
      if (reduced && sc.scene) sceneT = snapT(sc.scene, sceneT);
      chK = reduced ? 1 : ss(chapterT0 + camHold + 0.3, chapterT0 + camHold + 1.5, T);
      dT = V.dT;
      // the beads travel at the flow of the moment (integrated here; the tour's is integrated at load)
      const v = beadSpeeds(sc.scene, sceneT, {dT, fluid: sc.fluid});
      tcsPhase += dt * v.tcs;
      fwsPhase += dt * v.fws;
      phases = reduced ? {tcsPhase: Math.floor(tcsPhase / 0.5) * 0.5, fwsPhase: Math.floor(fwsPhase / 0.5) * 0.5} : {tcsPhase, fwsPhase};
    }
    const look = {...lookOf(sc, sceneT, chK, clock, {dT, ...phases}), lifts};
    // the visitor's camera waits for the tiers to be in, on the view it had
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
    frameConsole({sc, viewKey, labelO, labelAge, chO, exOpen, sceneT, dT, open: lifts[0], lifts, cursor, look});
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>自動ツアー中・クリックで操作できます' : '▶ ツアーに戻る';
    }
    const g = gaugesAt(sc.scene, sceneT, {dT, fluid: sc.fluid});
    // activePump is the pump's number (1 = A, 2 = B) so a watcher can see it change; activePumpName is 'A' | 'B'
    window.LIVE.s = {
      chapter: sc.chapter,
      scene: sc.scene ?? '',
      view: sc.view,
      open: lifts[0],
      lifts,
      dT: g.dT,
      flowLpm: g.flowLpm,
      fluid: g.fluid,
      racks: g.racks,
      pumpKw: g.pumpKw,
      pumpPct: g.pumpPct,
      activePump: g.activePump === 'B' ? 2 : 1,
      activePumpName: g.activePump,
      tcsSupply: g.tcsSupply,
      tcsReturn: g.tcsReturn,
      fwsSupply: g.fwsSupply,
      fwsReturn: g.fwsReturn,
      atd: g.atd,
      alarm: g.alarm,
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
