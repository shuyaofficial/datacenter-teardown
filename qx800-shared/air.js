// Chapter 7's wind, in the box's millimetres (it hangs under the box's root): dashes in lanes from the front grille over
// the heat sinks to the fans and out of the back, pale at the front and full accent at the back (the air warms on the
// way). Their speed follows the watts (2,900 W → 7,000 W, airAt). update(look) poses it; nothing keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BOXG} from './box.js';
import {dashes, windPaths} from './flow.js';
import {AIR, airAt, SPEC} from './kin.js';

const V3 = THREE.Vector3;

export function buildAir(parent) {
  const root = new THREE.Group();
  parent.add(root);
  const paths = windPaths();
  const mk = (color) => {
    const im = new THREE.InstancedMesh(BOXG, new THREE.MeshBasicMaterial({color, toneMapped: false, transparent: true, opacity: 0.95, depthTest: false}), 1200);
    im.frustumCulled = false;
    im.renderOrder = 25;
    im.count = 0;
    root.add(im);
    return im;
  };
  const cold = mk('#8fd0d4');
  const warm = mk(C.accent);
  const m4 = new THREE.Matrix4();
  const qq = new THREE.Quaternion();
  const P = new V3();
  const S = new V3();
  const dir = new V3();
  const Z = new V3(0, 0, 1);
  const seg = (im, a, b, w) => {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 1) return;
    qq.setFromUnitVectors(Z, dir.normalize());
    m4.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), qq, S.set(w, w * 0.5, len));
    im.setMatrixAt(im.count++, m4);
  };
  const update = (look) => {
    cold.count = 0;
    warm.count = 0;
    root.visible = look.chapter === 7;
    if (!root.visible) return;
    const a = airAt(look.sceneT ?? 0);
    const T = look.T ?? 0;
    // the distance the air has moved: the base speed, plus the extra after the optics come in (the ramp's mid point)
    const st = look.sceneT ?? 0;
    const dist = look.reduced ? 0 : 150 * (T + (SPEC.power.maxW / SPEC.power.typW - 1) * Math.max(0, st - (AIR.ramp[0] + AIR.ramp[1]) / 2));
    void a;
    for (const p of paths) for (const d of dashes(p, 1, dist, 30, 80)) seg(d.a[2] > -60 ? cold : warm, d.a, d.b, 6);
    cold.instanceMatrix.needsUpdate = true;
    warm.instanceMatrix.needsUpdate = true;
  };
  return {root, update};
}
