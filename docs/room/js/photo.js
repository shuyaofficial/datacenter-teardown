// 写真モード: 地点の 360° 写真を見回し、床の矢印で次の地点へ（前へ寄りながら 0.6 秒で切り替え）。
import * as THREE from 'three';
import {dirYaw} from './data.js';

const GO_TIME = 0.6, SETTLE = 0.35, ZOOM = 0.68;
const ease = (t) => t * t * (3 - 2 * t);
const wrap = (d) => ((d + 540) % 360) - 180;
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="#0f9fa8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

export function createPhoto({world, data, onStation}) {
  const {camera, view} = world;
  const baseFov = () => (innerWidth < innerHeight ? 90 : 65);
  camera.fov = baseFov(); camera.updateProjectionMatrix();
  let station = data.stations[0];
  let zoom = 1;                            // ホイール・ピンチ
  let anim = null;                         // {to, t, yaw0, yaw1, phase}
  const arrows = new Map();

  const setFov = (k) => { camera.fov = THREE.MathUtils.clamp(baseFov() * zoom * k, 25, 95); camera.updateProjectionMatrix(); };
  addEventListener('resize', () => setFov(1));

  // 同じ方角（20 度以内）に複数あるときは近い地点だけ（遠い地点へはそこを経由して行ける）
  const forwardIds = () => {
    const near = (data.neighbors.get(station.id) ?? [])
      .map((id) => { const d = data.byId.get(id).v.clone().sub(station.v); d.y = 0; return {id, dist: d.length(), yaw: dirYaw(d)}; })
      .sort((a, b) => a.dist - b.dist);
    return near.filter((a, i) => !near.slice(0, i).some((b) => Math.abs(wrap(a.yaw - b.yaw)) < 20)).map((a) => a.id);
  };
  const buildArrows = () => {
    arrows.forEach((a) => a.el.remove()); arrows.clear();
    for (const id of forwardIds()) {
      const s = data.byId.get(id);
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'go';
      el.innerHTML = `<span class="ring">${ARROW}</span>`;
      const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = s.title ?? s.id;
      el.append(lbl);
      el.setAttribute('aria-label', `${s.title ?? s.id}へ進む`);
      el.addEventListener('click', (e) => { e.stopPropagation(); go(id); });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      document.getElementById('marks').append(el);
      arrows.set(id, {el, s});
    }
  };

  const show = async (id, yaw) => {
    station = data.byId.get(id) ?? station;
    await world.placePano(0, station);
    world.setPanoOpacity(0, 1); world.setPanoOpacity(1, 0);
    camera.position.copy(station.v);
    if (yaw !== undefined) view.yaw = yaw;
    buildArrows();
    onStation?.(station.id);
  };

  // 次の地点へ: その方角を向き、寄りながら次の写真を重ねる
  let resolveGo = null;
  const go = async (id) => {
    if (anim) return false;
    const to = data.byId.get(id);
    if (!to) return false;
    await world.placePano(1, to);
    const dir = to.v.clone().sub(station.v); dir.y = 0;
    const yaw1 = view.quat ? null : view.yaw + wrap(dirYaw(dir) - view.yaw);
    anim = {to, t: 0, yaw0: view.yaw, yaw1, pitch0: view.pitch, phase: 'go'};
    arrows.forEach((a) => { a.el.style.display = 'none'; });
    return new Promise((ok) => { resolveGo = ok; });
  };

  const update = (dt) => {
    if (anim?.phase === 'go') {
      anim.t = Math.min(1, anim.t + dt / GO_TIME);
      const e = ease(anim.t);
      if (anim.yaw1 !== null) {
        const turn = ease(Math.min(1, anim.t / 0.5));
        view.yaw = anim.yaw0 + (anim.yaw1 - anim.yaw0) * turn;
        view.pitch = anim.pitch0 * (1 - turn);
      }
      setFov(1 - (1 - ZOOM) * e);
      world.setPanoOpacity(1, ease(THREE.MathUtils.clamp((anim.t - 0.35) / 0.65, 0, 1)));
      camera.position.lerpVectors(station.v, anim.to.v, e);
      if (anim.t >= 1) {
        const to = anim.to;
        anim = {phase: 'settle', t: 0};
        show(to.id).then(() => { resolveGo?.(true); resolveGo = null; });
      }
    } else if (anim?.phase === 'settle') {
      anim.t = Math.min(1, anim.t + dt / SETTLE);
      setFov(ZOOM + (1 - ZOOM) * ease(anim.t));
      if (anim.t >= 1) anim = null;
    }
    placeArrows();
  };

  const p = new THREE.Vector3(), q = new THREE.Vector3(), camDir = new THREE.Vector3();
  const toScreen = (v) => { const s = v.clone().project(camera); return [(s.x + 1) / 2 * innerWidth, (1 - s.y) / 2 * innerHeight]; };
  const placeArrows = () => {
    if (anim) return;
    camera.getWorldDirection(camDir);
    for (const {el, s} of arrows.values()) {
      const dir = s.v.clone().sub(station.v); dir.y = 0;
      const dist = dir.length(); dir.normalize();
      // 写真の床の上、その地点の方角に置く
      p.copy(station.v).addScaledVector(dir, THREE.MathUtils.clamp(dist, 3, 6)); p.y = 0;
      if (p.clone().sub(camera.position).dot(camDir) <= 0.05) { el.style.display = 'none'; continue; }
      q.copy(p).addScaledVector(dir, 0.6);
      const [x, y0] = toScreen(p), [x2, y2] = toScreen(q);
      // 下の説明の板に潜らないよう、板の上で止める
      const info = document.getElementById('info').getBoundingClientRect();
      const y = Math.min(y0, info.top - 56);
      const inside = x > 30 && x < innerWidth - 30 && y > 90 && y0 < innerHeight + 200;
      el.style.display = inside ? '' : 'none';
      el.style.left = `${x}px`; el.style.top = `${y}px`;
      el.querySelector('svg').style.transform = `rotate(${Math.atan2(y2 - y0, x2 - x)}rad)`;
    }
  };

  // --- 入力: 指でなぞる・ホイール・ピンチ ---
  const el = world.renderer.domElement;
  const pts = new Map();
  let pinch0 = null;
  el.addEventListener('pointerdown', (e) => { pts.set(e.pointerId, {x: e.clientX, y: e.clientY}); el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    const prev = pts.get(e.pointerId);
    if (!prev || anim) return;
    if (pts.size === 2) {
      pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0) { zoom = THREE.MathUtils.clamp(pinch0.zoom * pinch0.d / d, 0.4, 1.15); setFov(1); } else pinch0 = {d, zoom};
      return;
    }
    const k = camera.fov / innerHeight;           // 指の下の写真がそのまま付いてくる速さ
    view.yaw += (e.clientX - prev.x) * k;
    if (view.quat) gyro.nudge((e.clientX - prev.x) * k);
    view.pitch = THREE.MathUtils.clamp(view.pitch + (e.clientY - prev.y) * k, -80, 80);
    pts.set(e.pointerId, {x: e.clientX, y: e.clientY});
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', (e) => { zoom = THREE.MathUtils.clamp(zoom * Math.exp(e.deltaY * 0.001), 0.4, 1.15); setFov(1); }, {passive: true});

  const gyro = createGyro(view);
  return {update, show, go, gyro, get station() { return station.id; }, get busy() { return Boolean(anim); }};
}

// 傾けて見回す。iOS は押したときに許可を求める。
function createGyro(view) {
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  const back = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));   // 端末の背面を前へ
  const zee = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
  let offset = null, on = false;
  const onOrient = (ev) => {
    if (ev.alpha === null) return;
    const r = THREE.MathUtils.degToRad;
    e.set(r(ev.beta), r(ev.alpha), -r(ev.gamma), 'YXZ');
    q.setFromEuler(e).multiply(back);
    const orient = r(screen.orientation?.angle ?? window.orientation ?? 0);
    q.multiply(new THREE.Quaternion().setFromAxisAngle(zee, -orient));
    if (offset === null) {
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
      offset = view.yaw - dirYaw(f);
    }
    view.quat = new THREE.Quaternion().setFromAxisAngle(up, THREE.MathUtils.degToRad(offset)).multiply(q);
  };
  return {
    get on() { return on; },
    async toggle() {
      if (on) {
        removeEventListener('deviceorientation', onOrient);
        if (view.quat) {
          const f = new THREE.Vector3(0, 0, -1).applyQuaternion(view.quat);
          view.yaw = dirYaw(f); view.pitch = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(f.y, -1, 1)));
        }
        view.quat = null; on = false; return false;
      }
      const DOE = window.DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === 'function') {
        const res = await DOE.requestPermission();
        if (res !== 'granted') return false;
      }
      offset = null; on = true;
      addEventListener('deviceorientation', onOrient);
      return true;
    },
    nudge(d) { if (offset !== null) offset += d; },
  };
}

