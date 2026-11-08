// PC の 3D モード: 一人称で歩く。地点に着いて 0.6 秒止まると、同じ位置・同じ向きの 360° 写真へ 0.5 秒で切り替える。
import * as THREE from 'three';
import {dirYaw} from './data.js';

const SPEED = 1.4, TURN = 90;            // m/s、度/s
const STILL = 0.6, FADE_IN = 0.5, FADE_OUT = 0.25, NEAR = 0.45;
const ease = (t) => t * t * (3 - 2 * t);
const wrap = (d) => ((d + 540) % 360) - 180;

function makeMarker(station) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.19, 0.235, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({color: 0x0f9fa8, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false,
      polygonOffset: true, polygonOffsetFactor: -2}));
  const hit = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({visible: false}));
  ring.renderOrder = 5;
  const g = new THREE.Group();
  g.add(ring, hit);
  g.position.set(station.v.x, 0.012, station.v.z);
  g.userData.station = station.id;
  return {group: g, hit};
}

function makeMarkLabel(station, onClick) {
  const el = document.createElement('button');
  el.type = 'button'; el.className = 'mark';
  el.innerHTML = '<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5.2" fill="none" stroke="#0f9fa8" stroke-width="2"/></svg>';
  el.append(document.createTextNode(station.title ?? station.id));
  el.addEventListener('click', (e) => { e.stopPropagation(); onClick(station.id); });
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
  document.getElementById('marks').append(el);
  return el;
}

export function createWalk3d({world, data, grid, onStation}) {
  const {camera, view} = world;
  const eye = data.stations[0].v.y;
  const pos = data.stations[0].v.clone();
  const keys = new Set();
  let path = null, pathTarget = null, still = 0;
  let photo = {state: 'off', t: 0, station: null, from: null};   // off | in | on | out
  let here = null;                                               // 近くの地点
  let onArrive = null;
  let hold = false;                                               // 最初に動くまで写真へ切り替えない（?view=3d）

  const markers = data.stations.map((s) => ({s, ...makeMarker(s), label: makeMarkLabel(s, (id) => walkTo(id))}));
  markers.forEach((m) => world.overlay.add(m.group));

  const walkTo = (id) => {
    const s = data.byId.get(id);
    if (!s) return Promise.resolve(false);
    if (photo.state === 'on' && photo.station === id) return Promise.resolve(true);
    const p = grid.path(pos, s.v);
    if (!p) return Promise.resolve(false);
    onArrive?.(false);
    path = p.slice(1); pathTarget = s;
    still = 0;
    return new Promise((ok) => { onArrive = ok; });
  };
  const placeAt = (id, yaw) => {
    const s = data.byId.get(id);
    if (!s) return;
    pos.copy(s.v); path = null;
    view.yaw = yaw ?? s.yaw;
  };
  const showPhotoNow = async (id) => {
    const s = data.byId.get(id);
    await world.placePano(0, s);
    pos.copy(s.v);
    photo = {state: 'on', t: 1, station: s.id, from: pos.clone()};
    world.setPanoOpacity(0, 1);
  };

  // --- 入力 ---
  const el = world.renderer.domElement;
  let drag = null;
  el.addEventListener('pointerdown', (e) => { drag = {x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY}; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (!drag) return;
    view.yaw += (e.clientX - drag.x) * 0.18;
    view.pitch = THREE.MathUtils.clamp(view.pitch + (e.clientY - drag.y) * 0.18, -75, 75);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  el.addEventListener('pointerup', (e) => {
    if (drag && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 5) pick(e);
    drag = null;
  });
  el.addEventListener('wheel', (e) => {
    camera.fov = THREE.MathUtils.clamp(camera.fov + e.deltaY * 0.03, 35, 75); camera.updateProjectionMatrix();
  }, {passive: true});
  const KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (KEYS.includes(k) && !e.metaKey && !e.ctrlKey) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  const ray = new THREE.Raycaster();
  const pick = (e) => {
    ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
    const hit = ray.intersectObjects(markers.map((m) => m.hit))[0];
    if (hit) walkTo(hit.object.parent.userData.station);
  };

  // --- 毎フレーム ---
  const fwd = new THREE.Vector3(), side = new THREE.Vector3(), mv = new THREE.Vector3();
  const update = (dt) => {
    const f = THREE.MathUtils.degToRad(view.yaw);
    fwd.set(Math.cos(f), 0, -Math.sin(f)); side.set(Math.sin(f), 0, Math.cos(f));
    mv.set(0, 0, 0);
    if (keys.has('w') || keys.has('arrowup')) mv.add(fwd);
    if (keys.has('s') || keys.has('arrowdown')) mv.sub(fwd);
    if (keys.has('d')) mv.add(side);
    if (keys.has('a')) mv.sub(side);
    if (keys.has('arrowleft')) view.yaw += TURN * dt;
    if (keys.has('arrowright')) view.yaw -= TURN * dt;
    let moved = false;
    if (mv.lengthSq() > 0) {
      path = null; pathTarget = null;
      const next = pos.clone().addScaledVector(mv.normalize(), SPEED * dt);
      const to = grid.slide(pos, next);
      moved = to.distanceToSquared(pos) > 1e-8;
      pos.copy(to);
    } else if (path?.length) {
      const target = path[0];
      const d = target.clone().sub(pos); d.y = 0;
      const dist = d.length();
      const step = SPEED * dt * Math.min(1, 0.35 + dist * 2);
      if (dist <= step) { pos.x = target.x; pos.z = target.z; path.shift(); } else pos.addScaledVector(d.normalize(), step);
      if (dist > 0.05 && !drag) view.yaw += wrap(dirYaw(d) - view.yaw) * Math.min(1, dt * 3);
      moved = true;
      if (!path.length) path = null;
    }
    pos.y = eye;

    // 近くの地点
    let best = null, bd = Infinity;
    for (const s of data.stations) { const d = Math.hypot(s.v.x - pos.x, s.v.z - pos.z); if (d < bd) { bd = d; best = s; } }
    const arrivedAt = bd < NEAR ? best : null;
    if (bd < 2.5) here = best;

    // 写真への切り替え
    if (moved) {
      still = 0; hold = false;
      if (photo.state === 'on' || photo.state === 'in') photo = {...photo, state: 'out', t: 0};
    } else still += dt;
    if (!moved && !hold && arrivedAt && still >= STILL && photo.state === 'off') {
      photo = {state: 'loading', t: 0, station: arrivedAt.id, from: pos.clone()};
      world.placePano(0, arrivedAt).then(() => { if (photo.state === 'loading') photo = {...photo, state: 'in'}; });
    }
    if (photo.state === 'in') {
      photo = {...photo, t: Math.min(1, photo.t + dt / FADE_IN)};
      const s = data.byId.get(photo.station);
      pos.lerpVectors(photo.from, s.v, ease(photo.t));
      world.setPanoOpacity(0, ease(photo.t));
      if (photo.t >= 1) {
        photo = {...photo, state: 'on'};
        onStation?.(s.id);
        if (pathTarget?.id === s.id || !pathTarget) { onArrive?.(true); onArrive = null; pathTarget = null; }
      }
    } else if (photo.state === 'out') {
      photo = {...photo, t: Math.min(1, photo.t + dt / FADE_OUT)};
      world.setPanoOpacity(0, 1 - photo.t);
      if (photo.t >= 1) photo = {state: 'off', t: 0, station: null, from: null};
    } else if (photo.state === 'loading' && moved) photo = {state: 'off', t: 0, station: null, from: null};
    camera.position.copy(pos);
    updateMarks();
  };

  const v = new THREE.Vector3(), camDir = new THREE.Vector3();
  const updateMarks = () => {
    camera.getWorldDirection(camDir);
    const showing = photo.state === 'on' || photo.state === 'in';
    for (const m of markers) {
      const atIt = Math.hypot(m.s.v.x - pos.x, m.s.v.z - pos.z) < NEAR;
      m.group.visible = !atIt;
      v.set(m.s.v.x, 0.3, m.s.v.z);
      const vis = !showing && !atIt && v.clone().sub(camera.position).dot(camDir) > 0.3 && grid.clear(pos, m.s.v);
      if (!vis) { m.label.style.display = 'none'; continue; }
      v.project(camera);
      const x = (v.x + 1) / 2 * innerWidth, y = (1 - v.y) / 2 * innerHeight;
      const ok = x > 30 && x < innerWidth - 30 && y > 60 && y < innerHeight - 60;
      m.label.style.display = ok ? '' : 'none';
      m.label.style.left = `${x}px`; m.label.style.top = `${y}px`;
    }
  };

  const stop = () => { path = null; pathTarget = null; onArrive?.(false); onArrive = null; };

  return {
    update, walkTo, placeAt, showPhotoNow, stop, pos,
    holdUntilMove() { hold = true; },
    get settling() {
      if (photo.state === 'in' || photo.state === 'out' || photo.state === 'loading') return true;
      return photo.state === 'off' && !hold && Boolean(path === null && data.stations.some((s) => Math.hypot(s.v.x - pos.x, s.v.z - pos.z) < NEAR));
    },
    get photoState() { return photo.state; },
    get photoStation() { return photo.state === 'on' ? photo.station : null; },
    get here() { return photo.station ?? here?.id ?? null; },
    get moving() { return Boolean(path) || keys.size > 0; },
  };
}
