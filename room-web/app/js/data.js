// stations.json を読み、座標の変換と URL の解決をまとめる。
// 契約: teardown-out/room/<set>/stations.json（room/brief.md「2つの作業の受け渡し」）
import * as THREE from 'three';

const meta = (name, fallback) => document.querySelector(`meta[name="${name}"]`)?.content ?? fallback;
export const DATA_ROOT = meta('data-root', '../../teardown-out/room/');
export const LINK_BASE = meta('link-base', '../../docs/');

// Blender の z 上 (x, y, z) → three の y 上 (x, z, -y)
export const toV = ([x, y, z]) => new THREE.Vector3(x, z, -y);
// Blender の方角（度。0 = +x、+y へ回るほど増える）→ three の水平方向
export const yawDir = (deg) => {
  const t = THREE.MathUtils.degToRad(deg);
  return new THREE.Vector3(Math.cos(t), 0, -Math.sin(t));
};
// three の水平ベクトル → Blender の方角（度）
export const dirYaw = (v) => THREE.MathUtils.radToDeg(Math.atan2(-v.z, v.x));

// ?data=v2 / ?data=stub。無ければ <meta name="data-set">（build-site.sh が v2 か stub を書く）。
export function pickSet(q) {
  const want = q.get('data') || meta('data-set', 'stub');
  if (!/^[\w-]+$/.test(want)) throw new Error(`data の指定が不正です: ${want}`);
  return want;
}

const isNum3 = (a) => Array.isArray(a) && a.length === 3 && a.every(Number.isFinite);

function validate(d) {
  const bad = (m) => { throw new Error(`stations.json: ${m}`); };
  if (!Number.isFinite(d.scale) || d.scale <= 0) bad('scale が数でない');
  if (!Array.isArray(d.stations) || d.stations.length === 0) bad('stations が空');
  const ids = new Set();
  for (const s of d.stations) {
    if (!s.id || ids.has(s.id)) bad(`station id が空か重複: ${s.id}`);
    ids.add(s.id);
    if (!isNum3(s.pos)) bad(`${s.id}.pos`);
    if (!Number.isFinite(s.yaw)) bad(`${s.id}.yaw`);
    if (typeof s.pano !== 'string') bad(`${s.id}.pano`);
  }
  for (const t of d.tags ?? []) if (!isNum3(t.at)) bad(`tag ${t.id}.at`);
  for (const f of d.flows ?? []) {
    if (!Array.isArray(f.path) || f.path.length < 2 || !f.path.every(isNum3)) bad(`flow ${f.id}.path`);
  }
}

export async function loadData(set) {
  const base = `${DATA_ROOT}${set}/`;
  const res = await fetch(`${base}stations.json`);
  if (!res.ok) throw new Error(`${base}stations.json を読めません（${res.status}）`);
  const d = await res.json();
  validate(d);
  const stations = d.stations.map((s) => Object.freeze({
    ...s,
    next: s.next ?? [],
    v: toV(s.pos),
    panoUrl: new URL(s.pano, new URL(base, location.href)).href,
  }));
  const byId = new Map(stations.map((s) => [s.id, s]));
  // 戻る方向も歩けるように、next の逆向きも隣として持つ
  const neighbors = new Map(stations.map((s) => [s.id, new Set(s.next.filter((n) => byId.has(n)))]));
  for (const s of stations) for (const n of s.next) neighbors.get(n)?.add(s.id);
  return Object.freeze({
    set, base, scale: d.scale,
    tone: d.tone ?? null,   // Blender の AgX に合わせた曲線（無ければ three 標準の AgX）
    glbUrl: `${base}room.glb`,
    stations, byId,
    neighbors: new Map([...neighbors].map(([k, v]) => [k, [...v]])),
    tags: (d.tags ?? []).map((t) => Object.freeze({...t, v: toV(t.at), stations: t.stations ?? []})),
    flows: (d.flows ?? []).map((f) => Object.freeze({...f, points: f.path.map(toV)})),
  });
}

export const linkUrl = (link) => (/^(https?:)?\/\//.test(link) ? link : LINK_BASE + link);
