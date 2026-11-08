// 自動ツアー: データ → 電気 → 熱（room/brief.md の筋書き）。
// 放っておくと進み、どこかを押すと止まって操作を渡し、25 秒触らないと戻る。
// focus は札の id の候補（先にあるものを向く）。無ければ地点の yaw を向く。
const SCRIPT = Object.freeze([
  {station: 'cold-in', ch: 'data', focus: ['nvl72'], say: 'データ: 質問はネットワークを通って GPU ラックへ届きます'},
  {station: 'cold-mid', ch: 'data', focus: ['compute-tray', 'fiber'], say: 'データ: 計算トレイの前面から光ファイバが天井へ上がります'},
  {station: 'net', ch: 'data', focus: ['ib-switch', 'oob-switch'], say: 'データ: ネットワークラックのスイッチがラック同士をつなぎます'},
  {station: 'ceil', ch: 'power', focus: ['busway'], say: '電気: 天井のバスウェイから各ラックへ電気を下ろします'},
  {station: 'hot', ch: 'power', focus: ['busbar'], say: '電気: ラックの背面のバスバーが直流 約50 V を配ります'},
  {station: 'hot', ch: 'heat', focus: ['manifold'], say: '熱: 計算で出た熱は冷却液がマニホールドへ運びます'},
  {station: 'cdu', ch: 'heat', focus: ['cdu', 'phx'], say: '熱: CDU が冷却液の熱を施設の水へ移します'},
  {station: 'ceil', ch: 'heat', focus: ['fluid-cooler', 'tcs-pipes'], say: '熱: 温まった水は天井の配管から屋外の冷却器へ'},
]);
const DWELL = 7, IDLE = 25, FIRST = 3;

export function createTour({data, app, reduced, startOff}) {
  const steps = SCRIPT.filter((s) => data.byId.has(s.station));
  let state = startOff || reduced || steps.length === 0 ? 'off' : 'paused';   // running | paused | off
  let lastInput = performance.now() - (IDLE - FIRST) * 1000;
  let i = 0, token = 0;

  const sleep = (sec, my) => new Promise((ok) => {
    const t0 = performance.now();
    const tick = () => (my !== token || performance.now() - t0 >= sec * 1000 ? ok() : setTimeout(tick, 100));
    tick();
  });

  const run = async () => {
    const my = ++token;
    while (state === 'running' && my === token) {
      const step = steps[i % steps.length];
      app.caption(step.say, i % steps.length + 1, steps.length);
      app.setChapter(step.ch);
      if (app.station !== step.station) await app.goStation(step.station);
      if (my !== token) return;
      const tag = step.focus.map((id) => data.tags.find((t) => t.id === id && t.stations.includes(step.station))).find(Boolean);
      app.lookAt(tag ? tag.v : null, step.station);
      await sleep(DWELL, my);
      if (my !== token) return;
      i += 1;
    }
  };

  const start = () => { state = 'running'; app.changed(); run(); };
  const pause = () => { if (state === 'running') { state = 'paused'; token += 1; app.stopMotion(); app.changed(); } };
  const stop = () => { state = 'off'; token += 1; app.stopMotion(); app.changed(); };

  // 人の操作だけで止める（ツアー自身の動きは止めない）
  const onInput = (e) => {
    if (!e.isTrusted) return;
    if (e.target?.closest?.('#b-tour')) return;
    lastInput = performance.now();
    pause();
  };
  ['pointerdown', 'keydown', 'wheel'].forEach((t) => addEventListener(t, onInput, {capture: true, passive: true}));
  setInterval(() => {
    if (state === 'paused' && performance.now() - lastInput > IDLE * 1000) start();
  }, 500);

  return {
    get state() { return state; },
    toggle() { if (state === 'running') stop(); else { lastInput = performance.now(); start(); } },
    stop,
  };
}
