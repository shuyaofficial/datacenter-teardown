// 入口: 端末で見かたを選び、3D（PC）か写真（スマホ）を起動する。
// クエリ: data=stub|v2  mode=3d|photo  station=<id>  yaw=<度>  pitch=<度>
//         view=photo（3D で写真を出した状態から）／view=3d（最初に動くまで写真へ切り替えない）
//         walkto=<id>（そこまで歩かせ、写真に切り替わったら READY）  go=<id>（写真モードで次へ進んでから READY）
//         flows=data|power|heat|1  card=<tag id>  tour=0|1  ev=<露出>
//         refl=0（床の映り込みを切って比べる）  debug=1（tools/*.mjs が中を覗くための window.APP / GRID）
import * as THREE from 'three';
import {pickSet, loadData, dirYaw} from './data.js';
import {createWorld, findFloor} from './world.js';
import {buildGrid} from './grid.js';
import {createWalk3d} from './walk3d.js';
import {createPhoto} from './photo.js';
import {createTags} from './tags.js';
import {createFlows, CHAPTERS} from './flows.js';
import {createTour} from './tour.js';

const q = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const STATION_CHAPTER = {'cold-in': 'data', 'cold-mid': 'data', net: 'data', ceil: 'power', hot: 'heat', cdu: 'heat'};

const pickMode = () => {
  const m = q.get('mode');
  if (m === '3d' || m === 'photo') return m;
  return coarse && Math.min(screen.width, screen.height) < 820 ? 'photo' : '3d';
};
const layoutClass = () => (innerWidth < 700 || (coarse && Math.min(innerWidth, innerHeight) < 820) ? 'phone' : 'pc');
const frame = () => new Promise((ok) => requestAnimationFrame(() => ok()));
const until = async (fn, sec = 30) => {
  const t0 = performance.now();
  while (!fn()) { if (performance.now() - t0 > sec * 1000) throw new Error('待ち時間を超えました'); await frame(); }
};

function setLive(next) {
  const prev = window.LIVE;
  if (prev && Object.keys(next).every((k) => prev[k] === next[k])) return;
  window.LIVE = Object.freeze(next);
}

async function boot() {
  const mode = pickMode();
  document.body.classList.add(layoutClass(), `mode-${mode}`);
  addEventListener('resize', () => {
    document.body.classList.remove('phone', 'pc'); document.body.classList.add(layoutClass());
  });
  const data = await loadData(pickSet(q));
  const ev = Number.isFinite(+q.get('ev')) && q.get('ev') !== null ? +q.get('ev') : -0.9;
  const world = await createWorld({data, ev, dpr: Math.min(devicePixelRatio, 2), photoOnly: mode === 'photo'});
  const startId = data.byId.has(q.get('station')) ? q.get('station') : data.stations[0].id;
  const start = data.byId.get(startId);
  world.view.yaw = q.has('yaw') ? +q.get('yaw') : start.yaw;
  world.view.pitch = q.has('pitch') ? +q.get('pitch') : (mode === 'photo' && innerWidth < innerHeight ? -8 : 0);

  let ctl, walk = null, photo = null, flows = null, tour = null, tags = null, lastInfo = null;
  const station = () => (walk ? walk.here : photo?.station ?? null);
  if (mode === '3d') {
    const glb = await world.ensureGlb();
    const grid = buildGrid(glb, findFloor(glb));
    if (q.has('debug')) window.GRID = grid;
    if (q.get('refl') === '0' && world.reflector) world.reflector.visible = false;   // 比較用
    walk = createWalk3d({world, data, grid, onStation: () => changed()});
    walk.placeAt(startId, world.view.yaw);
    if (q.get('view') === 'photo') await walk.showPhotoNow(startId);
    if (q.get('view') === '3d') walk.holdUntilMove();
    ctl = walk;
  } else {
    photo = createPhoto({world, data, onStation: () => changed()});
    await photo.show(startId);
    ctl = photo;
  }
  if (q.has('debug')) window.APP = {world, data, THREE, get walk() { return walk; }, get photo() { return photo; }, get flows() { return flows; }};
  tags = createTags(data, world.camera);

  // --- 流れ ---
  const setChapter = async (ch) => {
    if (ch && !flows) { await world.ensureGlb(); flows = flows ?? createFlows(world, data, {reduced}); }
    flows?.setChapter(ch);
    $('b-flows').setAttribute('aria-pressed', String(Boolean(ch)));
    $('chapters').hidden = !ch;
    document.body.classList.toggle('chap', Boolean(ch));
    $('chapters').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ch === ch)));
    changed();
  };
  const defaultChapter = () => STATION_CHAPTER[station()] ?? 'heat';

  // --- 見る向きをゆっくり変える（ツアー用） ---
  let look = null;
  const lookAt = (v, sid) => {
    const s = data.byId.get(sid);
    if (world.view.quat || !s) return;
    let yaw = s.yaw, pitch = 0;
    if (v) {
      const d = v.clone().sub(s.v);
      yaw = dirYaw(d); pitch = THREE.MathUtils.radToDeg(Math.atan2(d.y, Math.hypot(d.x, d.z)));
      pitch = THREE.MathUtils.clamp(pitch * 0.85, -40, 40);
    }
    const y0 = world.view.yaw;
    look = {t: 0, y0, y1: y0 + ((yaw - y0 + 540) % 360) - 180, p0: world.view.pitch, p1: pitch};
  };
  const stepLook = (dt) => {
    if (!look) return;
    look.t = Math.min(1, look.t + dt / 1.8);
    const e = look.t * look.t * (3 - 2 * look.t);
    world.view.yaw = look.y0 + (look.y1 - look.y0) * e;
    world.view.pitch = look.p0 + (look.p1 - look.p0) * e;
    if (look.t >= 1) look = null;
  };

  const goStation = async (id) => (walk ? walk.walkTo(id) : photo.go(id));
  tour = createTour({
    data, reduced, startOff: q.get('tour') === '0',
    app: {
      get station() { return walk ? walk.photoStation : photo.station; },
      goStation, setChapter, lookAt,
      caption: (text, k, n) => { $('tour-text').textContent = `自動ツアー ${k} / ${n}　${text}`; },
      stopMotion: () => { look = null; walk?.stop(); },
      changed: () => changed(),
    },
  });

  // --- 画面の部品 ---
  function changed() {
    const sid = station();
    if (sid && sid !== lastInfo) {
      const s = data.byId.get(sid);
      const k = data.stations.indexOf(s) + 1;
      $('kicker').textContent = `AI データホール　地点 ${k} / ${data.stations.length}`;
      $('st-title').textContent = s.title ?? s.id;
      $('st-text').textContent = s.text ?? '';
      lastInfo = sid;
    }
    $('tourbar').hidden = tour?.state !== 'running';
    $('b-tour').setAttribute('aria-pressed', String(tour?.state === 'running'));
    setLive({mode, station: sid, tour: tour?.state ?? 'off', flows: flows?.chapter ?? false, set: data.set,
      photo: walk ? walk.photoState === 'on' : true});
  }
  $(`m-${mode}`).setAttribute('aria-pressed', 'true');
  $('info').addEventListener('click', () => $('info').classList.toggle('open'));
  ['3d', 'photo'].forEach((m) => $(`m-${m}`).addEventListener('click', () => {
    if (m === mode) return;
    const nq = new URLSearchParams(location.search);
    nq.set('mode', m); if (station()) nq.set('station', station());
    ['view', 'walkto', 'go', 'yaw', 'pitch', 'w', 'h'].forEach((k) => nq.delete(k));
    location.search = nq.toString();
  }));
  $('b-flows').addEventListener('click', () => setChapter(flows?.chapter ? null : defaultChapter()));
  $('chapters').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => setChapter(b.dataset.ch)));
  $('b-tour').addEventListener('click', () => tour.toggle());
  if (mode === 'photo' && coarse && 'DeviceOrientationEvent' in window) {
    const g = $('b-gyro'); g.hidden = false;
    g.addEventListener('click', async () => {
      try { g.setAttribute('aria-pressed', String(await photo.gyro.toggle())); } catch { g.setAttribute('aria-pressed', 'false'); }
    });
  }
  $('hint').textContent = mode === '3d'
    ? 'W A S D・矢印キーで歩く　ドラッグで見回す　床の印を押すとそこへ歩く'
    : 'ドラッグで見回す　ホイールで寄る　床の矢印で次の地点へ';

  // --- 毎フレーム ---
  const timer = new THREE.Timer();
  const loop = () => {
    timer.update(); const dt = Math.min(timer.getDelta(), 0.05);
    stepLook(dt);
    ctl.update(dt);
    flows?.update(dt);
    world.render(Boolean(flows?.visible));
    const busy = photo?.busy || (walk && walk.photoState === 'in');
    tags.update(station(), busy || (walk && walk.moving));
    changed();
    requestAnimationFrame(loop);
  };
  loop();

  // --- クエリで状態をそろえてから READY ---
  if (CHAPTERS[q.get('flows')]) await setChapter(q.get('flows'));
  else if (q.get('flows') === '1') await setChapter(defaultChapter());
  if (q.get('walkto') && walk) {
    if (!(await walk.walkTo(q.get('walkto')))) throw new Error(`${q.get('walkto')} へ歩けません`);
  }
  if (q.get('go') && photo) await photo.go(q.get('go'));
  if (q.get('card')) tags.open(q.get('card'));
  if (q.get('tour') === '1') tour.toggle();
  await until(() => !photo?.busy && !walk?.settling);
  for (let k = 0; k < 6; k++) await frame();
  $('fade').classList.add('out');
  await new Promise((ok) => setTimeout(ok, 450));
  window.READY = true;
}

boot().catch((e) => {
  console.error(e);
  const box = $('err');
  box.textContent = `表示できませんでした: ${e.message}`;
  box.hidden = false;
  $('fade').classList.add('out');
});
