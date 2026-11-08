// Chapter 6's plate, standing in its own place (flow.js RING): 576 GPUs on a circle (a drawing, not their real places),
// the ring all-reduce's beads moving one place a step, and for SHARP the 8 leaves on an inner circle and the 4 spines in
// the middle, where the sums are made. Ink beads carry what a GPU sends, accent beads the sum coming back.
// update(look) poses it; overlay(look, project) returns the HTML tags. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BOXG} from './box.js';
import {RING, ringBeads, ringLeafXY, ringSpineXY, ringXY, sharpBeads} from './flow.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
const INK = '#2f3336';

export function buildRing() {
  const root = new THREE.Group();
  root.position.set(RING.at[0] / 1000, RING.at[1] / 1000, RING.at[2] / 1000);
  root.scale.setScalar(0.001);
  const g = new THREE.Group();
  g.position.y = RING.cy;
  root.add(g);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.75, metalness: 0.05, envMapIntensity: 0.5, ...extra});
  const basic = (color) => new THREE.MeshBasicMaterial({color, toneMapped: false});
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const S = new V3();
  const P = new V3();
  const N = SPEC.allreduce.gpus;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(RING.r + 60, RING.r + 60, 14, 96), std('#f3f5f6'));
  plate.rotation.x = Math.PI / 2;
  plate.position.z = -16;
  plate.castShadow = true;
  g.add(plate);
  const stand = new THREE.Mesh(BOXG, std('#c3cacf'));
  stand.scale.set(60, RING.cy - RING.r, 60);
  stand.position.set(0, -(RING.r + RING.cy) / 2 - 30, -40);
  g.add(stand);
  const ticks = new THREE.InstancedMesh(BOXG, std('#848c92'), N);
  for (let i = 0; i < N; i++) {
    const [x, y] = ringXY(i, RING.tick);
    m4.compose(P.set(x, y, 0), q.setFromAxisAngle(new V3(0, 0, 1), Math.atan2(y, x)), S.set(30, 5, 10));
    ticks.setMatrixAt(i, m4);
  }
  g.add(ticks);
  const track = new THREE.Mesh(new THREE.TorusGeometry(RING.track, 3, 6, 192), std('#c7cfd4'));
  g.add(track);
  // SHARP's switches: 8 leaves, 4 spines, their links
  const sw = new THREE.InstancedMesh(BOXG, std('#5d6167'), 12);
  for (let l = 0; l < 8; l++) {
    const [x, y] = ringLeafXY(l);
    m4.compose(P.set(x, y, 8), q.identity(), S.set(110, 46, 30));
    sw.setMatrixAt(l, m4);
  }
  for (let k = 0; k < 4; k++) {
    const [x, y] = ringSpineXY(k);
    m4.compose(P.set(x, y, 8), q.identity(), S.set(96, 40, 30));
    sw.setMatrixAt(8 + k, m4);
  }
  g.add(sw);
  const links = new THREE.InstancedMesh(BOXG, std('#c3cacf'), 32);
  let n = 0;
  for (let l = 0; l < 8; l++) for (let k = 0; k < 4; k++) {
    const a = ringLeafXY(l);
    const b = ringSpineXY(k);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    m4.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, -2), q.setFromAxisAngle(new V3(0, 0, 1), Math.atan2(b[1] - a[1], b[0] - a[0])), S.set(len, 3, 3));
    links.setMatrixAt(n++, m4);
  }
  g.add(links);
  const beadInk = new THREE.InstancedMesh(BOXG, basic(INK), N);
  const beadAcc = new THREE.InstancedMesh(BOXG, basic(C.accent), N);
  for (const im of [beadInk, beadAcc]) {
    im.frustumCulled = false;
    g.add(im);
  }
  const swCol = new THREE.Color();
  const base = new THREE.Color('#5d6167');
  const acc = new THREE.Color(C.accent);

  const update = (look) => {
    root.visible = look.chapter === 6;
    if (!root.visible) return;
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    beadInk.count = 0;
    beadAcc.count = 0;
    const isSharp = sc === 'sharp';
    sw.visible = isSharp;
    links.visible = isSharp;
    const put = (im, x, y, s) => {
      m4.compose(P.set(x, y, 24), q.identity(), S.setScalar(s));
      im.setMatrixAt(im.count++, m4);
    };
    if (sc === 'ring') for (const b of ringBeads(t)) put(b.gather ? beadAcc : beadInk, b.x, b.y, 10);
    if (isSharp) {
      const sb = sharpBeads(t);
      for (const b of sb.beads) put(b.back ? beadAcc : beadInk, b.p[0], b.p[1], 18);
      for (let i = 0; i < 12; i++) sw.setColorAt(i, swCol.copy(base).lerp(acc, i < 8 ? sb.leafK : sb.spineK).multiply(new THREE.Color(1 / base.r, 1 / base.g, 1 / base.b)));
      sw.instanceColor.needsUpdate = true;
    }
    beadInk.instanceMatrix.needsUpdate = true;
    beadAcc.instanceMatrix.needsUpdate = true;
  };
  const W = new V3();
  const overlay = (look, project) => {
    const out = [];
    if (!root.visible) return out;
    root.updateWorldMatrix(true, true);
    const o = look.tagO ?? 1;
    const at = (x, y) => {
      W.set(x, y, 30);
      g.localToWorld(W);
      return project(W.x, W.y, W.z);
    };
    const lb = at(0, -RING.r - 90);
    const key = look.scene === 'ring' ? '<b>黒: 足している途中　<i style="font-style:normal;color:#0f9fa8">色: 足し終わった分</i></b><span>隣へ 1/576 ずつ、1,150 回・GPU 576 個を輪に並べた図（実際の並びではない）</span>' : '<b>内側: リーフ 8 台　中央: スパイン 4 台</b><span>黒: 送る 1 GB　色: 中で足して返す合計・並びは図のための簡略</span>';
    if (lb) out.push({kind: 'lbl', x: lb[0], y: lb[1], h: 'c', v: 't', o, on: look.scene === 'sharp', html: key});
    return out;
  };
  return {root, update, overlay};
}
