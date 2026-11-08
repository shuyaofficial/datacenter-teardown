// The shapes beside the rack, in the rack's millimetres (the groups hang under rack.root):
//   1, 3, 5  the 4×4×4 torus diagram: 64 chips as small blocks, the 16 trays as flat tiles under their 2 × 2 (仮定)
//   3        the small OCS box under the cube the wrap goes through
//   4        4 small cubes and a spare, the OCS with its X・Y・Z ranks and rows of mirrors that turn (the count of OCS
//            units is 未確認, so no number is drawn), and the pod's 144 racks as a far view
//   5        the NVL72 ring: 72 GPUs on a circle round one box that stands for the 18 NVSwitch chips
//   6        the Jupiter switch outside the rack and another pod
//   7        the CDU rack beside this one
// Lines and beads on these are overlay.js. update(look) poses them; nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {CDU, CUBE, cubeXYZ, JUP, MINI, miniCentres, mirrorAngles, NVR, nvRingXY, OCS3, OCS4, POD, POD2, podRacks, rankY, RANKS} from './flow.js';
import {chipOfTray, FAILED, SPEC} from './kin.js';

const V3 = THREE.Vector3;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const NODE = '#545d64';
const FAINT = '#cdd4d8';

export function buildDiagrams(rack) {
  const root = new THREE.Group();
  rack.root.add(root);
  const {pin} = rack;
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.7, metalness: 0, envMapIntensity: 0.5, ...extra});
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const P = new V3();
  const S = new V3();
  const col = new THREE.Color();
  const accent = new THREE.Color(C.accent);
  const fadeAll = (mats, o) =>
    mats.forEach((m) => {
      const base = m.userData.op ?? 1;
      m.opacity = base * o;
      const tr = m.opacity < 0.999;
      if (m.transparent !== tr) {
        m.transparent = tr;
        m.needsUpdate = true;
      }
      m.depthWrite = m.opacity > 0.5;
    });

  // ------------------------------------------------------------ the 4×4×4 cube
  const cube = new THREE.Group();
  root.add(cube);
  const nodeMat = std('#ffffff');
  const nodes = new THREE.InstancedMesh(BOX, nodeMat, 64);
  const NODES = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) NODES.push([x, y, z]);
  NODES.forEach((c, i) => {
    m4.compose(P.set(...cubeXYZ(c, [0, 0, 0])), q.identity(), S.setScalar(CUBE.node));
    nodes.setMatrixAt(i, m4);
    nodes.setColorAt(i, col.set(NODE));
  });
  nodes.castShadow = true;
  cube.add(nodes);
  const tileMat = std('#dfe5e8', {transparent: true, opacity: 0.85});
  tileMat.userData.op = 0.85;
  const tiles = new THREE.InstancedMesh(BOX, tileMat, 16);
  for (let n = 0; n < 16; n++) {
    const cs = [0, 1, 2, 3].map((s) => cubeXYZ(chipOfTray(n, s), [0, 0, 0]));
    const cx = cs.reduce((a, p) => a + p[0], 0) / 4;
    const cz = cs.reduce((a, p) => a + p[2], 0) / 4;
    m4.compose(P.set(cx, cs[0][1] - CUBE.node / 2 - 5, cz), q.identity(), S.set(CUBE.S + 110, 6, CUBE.S + 110));
    tiles.setMatrixAt(n, m4);
    tiles.setColorAt(n, col.setScalar(1));
  }
  cube.add(tiles);
  const cubeMats = [nodeMat, tileMat];
  // an invisible box over the whole cube: the film's label layout measures the model's extent from it
  const hull = new THREE.MeshBasicMaterial({visible: false});
  const extent = (parent, [w, h, d], p = [0, 0, 0]) => {
    const m = new THREE.Mesh(BOX, hull);
    m.scale.set(w, h, d);
    m.position.set(...p);
    parent.add(m);
  };
  extent(cube, [3 * CUBE.S + 340, 3 * CUBE.S + 80, 3 * CUBE.S + 340]);
  const idx = (c) => c[0] * 16 + c[1] * 4 + c[2];

  // ------------------------------------------------------------ the wrap's OCS (chapter 3)
  const box = (parent, mat, [w, h, d], p) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(w, h, d);
    m.position.set(...p);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const ocsMat = std('#6c7177', {roughness: 0.55, metalness: 0.3});
  const mirrorMat = std('#c9d0d4', {roughness: 0.3, metalness: 0.6});
  const ocs3 = new THREE.Group();
  root.add(ocs3);
  box(ocs3, ocsMat, [OCS3.w, OCS3.h, OCS3.d], OCS3.c);
  const m3 = new THREE.InstancedMesh(BOX, mirrorMat, 6);
  ocs3.add(m3);

  // ------------------------------------------------------------ chapter 4: small cubes, spare, the OCS, the pod
  const minis = new THREE.Group();
  root.add(minis);
  const shellMat = std('#dfe6ea', {transparent: true, opacity: 0.3});
  shellMat.userData.op = 0.3;
  const shells = new THREE.InstancedMesh(BOX, shellMat, 5);
  shells.frustumCulled = false;
  const miniMat = std('#ffffff');
  const miniNodes = new THREE.InstancedMesh(BOX, miniMat, 5 * 64);
  miniNodes.frustumCulled = false;
  miniNodes.castShadow = true;
  minis.add(miniNodes, shells);
  const ocs4 = new THREE.Group();
  root.add(ocs4);
  box(ocs4, ocsMat, [OCS4.w, OCS4.h, OCS4.d], OCS4.c);
  const rankMat = std('#5a5e63');
  for (let r = 1; r < 3; r++) box(ocs4, rankMat, [OCS4.w + 6, 8, OCS4.d + 6], [OCS4.c[0], OCS4.c[1] + OCS4.h / 2 - (r * OCS4.h) / 3, OCS4.c[2]]);
  const mirrors = new THREE.InstancedMesh(BOX, mirrorMat, 3 * OCS4.mirrors);
  mirrors.frustumCulled = false;
  ocs4.add(mirrors);
  const podMat = std('#6f747a', {transparent: true, roughness: 0.6, metalness: 0.2});
  const podTop = std('#9aa1a7', {transparent: true});
  const racks = podRacks().slice(1);
  const pod = new THREE.Group();
  root.add(pod);
  const podIm = new THREE.InstancedMesh(BOX, podMat, racks.length);
  const podCap = new THREE.InstancedMesh(BOX, podTop, racks.length);
  racks.forEach((p, i) => {
    m4.compose(P.set(p[0], SPEC.rack.h / 2, p[2]), q.identity(), S.set(SPEC.rack.w, SPEC.rack.h, SPEC.rack.d));
    podIm.setMatrixAt(i, m4);
    podIm.setColorAt(i, col.setScalar(0.9 + 0.2 * Math.abs(Math.sin(i * 3.7))));
    m4.compose(P.set(p[0], SPEC.rack.h + 4, p[2]), q.identity(), S.set(SPEC.rack.w - 80, 8, SPEC.rack.d - 80));
    podCap.setMatrixAt(i, m4);
  });
  pod.add(podIm, podCap);
  extent(pod, [POD.n * POD.pitch, SPEC.rack.h, POD.n * POD.pitch], [((POD.n - 1) * POD.pitch) / 2, SPEC.rack.h / 2, (-(POD.n - 1) * POD.pitch) / 2]);

  // ------------------------------------------------------------ chapter 5: the NVL72 ring
  const ring = new THREE.Group();
  ring.position.set(...NVR.c);
  root.add(ring);
  const plateMat = std('#f3f5f6', {transparent: true, roughness: 0.85});
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(NVR.plate, NVR.plate, 12, 72), plateMat);
  plate.rotation.x = Math.PI / 2;
  plate.position.z = -14;
  ring.add(plate);
  const gpuMat = std('#848c92', {transparent: true});
  const gpus = new THREE.InstancedMesh(BOX, gpuMat, 72);
  for (let i = 0; i < 72; i++) {
    const [x, y] = nvRingXY(i);
    m4.compose(P.set(x, y, 0), q.setFromAxisAngle(new V3(0, 0, 1), Math.atan2(y, x)), S.set(NVR.gpuS, NVR.gpuS * 0.7, 14));
    gpus.setMatrixAt(i, m4);
  }
  ring.add(gpus);
  const hubMat = std('#8e979d', {transparent: true});
  const hub = box(ring, hubMat, [NVR.hubS, NVR.hubS * 0.62, 30], [0, 0, 0]);
  const spokeMat = std('#d3d9dd', {transparent: true});
  const spokes = new THREE.InstancedMesh(BOX, spokeMat, 72);
  for (let i = 0; i < 72; i++) {
    const [x, y] = nvRingXY(i, (NVR.r + NVR.hubS * 0.4) / 2);
    m4.compose(P.set(x, y, -3), q.setFromAxisAngle(new V3(0, 0, 1), Math.atan2(y, x) + Math.PI / 2), S.set(3, NVR.r - NVR.hubS * 0.4, 3));
    spokes.setMatrixAt(i, m4);
  }
  ring.add(spokes);
  const ringMats = [plateMat, gpuMat, hubMat, spokeMat];

  // ------------------------------------------------------------ chapter 6: Jupiter and another pod; 7: the CDU
  const out = new THREE.Group();
  root.add(out);
  const darkMat = std('#5d6167', {roughness: 0.6, metalness: 0.25});
  box(out, darkMat, [JUP.w, JUP.h, JUP.d], JUP.at);
  const jp = [];
  for (let j = 0; j < 24; j++) jp.push([JUP.at[0] - 220 + (j % 12) * 40, JUP.at[1] - 16 + Math.floor(j / 12) * 30, JUP.at[2] + JUP.d / 2 + 1]);
  const jPorts = new THREE.InstancedMesh(BOX, std('#1f2124'), jp.length);
  jp.forEach((p, i) => {
    m4.compose(P.set(...p), q.identity(), S.set(26, 14, 2));
    jPorts.setMatrixAt(i, m4);
  });
  out.add(jPorts);
  box(out, darkMat, [POD2.w, POD2.h, POD2.d], [POD2.at[0], POD2.h / 2, POD2.at[2]]);
  box(out, std('#7b8187'), [POD2.w - 120, POD2.h - 300, 6], [POD2.at[0], POD2.h / 2, POD2.at[2] + POD2.d / 2 + 3]);
  const cdu = new THREE.Group();
  root.add(cdu);
  box(cdu, std('#727780', {roughness: 0.55, metalness: 0.3}), [CDU.w, CDU.h, CDU.d], [CDU.at[0], CDU.h / 2, CDU.at[2]]);
  box(cdu, std('#868b92'), [CDU.w - 80, CDU.h - 200, 6], [CDU.at[0], CDU.h / 2, CDU.at[2] - CDU.d / 2 - 3]);
  box(cdu, std('#868b92'), [CDU.w - 80, CDU.h - 200, 6], [CDU.at[0], CDU.h / 2, CDU.at[2] + CDU.d / 2 + 3]);

  // ------------------------------------------------------------ anchors (the overlay's tags and the film's labels)
  pin('cubeTop', cube, ...cubeXYZ([3, 0, 3], [0, 0, 0]));
  pin('cubeTile', cube, ...cubeXYZ(chipOfTray(SPEC.demo.pullTray, 1), [0, 0, 0]));
  pin('ocs3', ocs3, OCS3.c[0] + OCS3.w / 2, OCS3.c[1], OCS3.c[2]);
  pin('ocs4', ocs4, OCS4.c[0] + OCS4.w / 2, OCS4.c[1] + OCS4.h / 2 - 60, OCS4.c[2]);
  pin('spare', minis, 1420, 700 - MINI.box / 2, 330);
  pin('podFar', pod, ...racks[POD.n * 6 + 5]);
  pin('cdu', cdu, CDU.at[0], CDU.h - 200, CDU.at[2] - CDU.d / 2);
  pin('jupiter', out, JUP.at[0], JUP.at[1] + JUP.h / 2, JUP.at[2]);
  pin('pod2', out, POD2.at[0] + POD2.w / 4, POD2.h - 500, POD2.at[2] + POD2.d / 2 + 6);

  // ------------------------------------------------------------ pose
  let lastNodes = '';
  /**
   * look: {chapter, scene, cubeK, cubeC [x, y, z], tileK, lit: [chip idx] in the accent, dim: [chip idx], ocs3K, minisK,
   *        move, failK, mirrorsFrom, mirrorsTo, mirrorK, spareK, podK, ringK, outK, cduK}
   */
  const update = (look) => {
    const ck = look.cubeK ?? 0;
    cube.visible = ck > 0.01;
    if (cube.visible) {
      cube.position.set(...(look.cubeC ?? CUBE.c));
      fadeAll(cubeMats, ck);
      tiles.visible = (look.tileK ?? 0) > 0.01;
      tileMat.opacity = 0.85 * (look.tileK ?? 0) * ck;
      const key = `${(look.lit ?? []).join()}|${(look.dim ?? []).join()}|${look.tileHi ?? -1}`;
      if (key !== lastNodes) {
        lastNodes = key;
        NODES.forEach((c, i) => nodes.setColorAt(i, col.set(look.dim?.includes(i) ? FAINT : NODE)));
        for (const i of look.lit ?? []) nodes.setColorAt(i, accent);
        nodes.instanceColor.needsUpdate = true;
        for (let n = 0; n < 16; n++) tiles.setColorAt(n, n === look.tileHi ? col.copy(accent).lerp(new THREE.Color('#ffffff'), 0.55) : col.setScalar(1));
        tiles.instanceColor.needsUpdate = true;
      }
    }
    // the wrap's OCS: 6 mirrors, the middle pair turned while the bead is in it
    ocs3.visible = (look.ocs3K ?? 0) > 0.01;
    if (ocs3.visible) {
      for (let i = 0; i < 6; i++) {
        const a = i === 2 || i === 3 ? (look.ocs3Tilt ?? 0) * 0.5 : 0.15 * Math.sin(i * 2.1);
        m4.compose(P.set(OCS3.c[0] - 100 + i * 40, OCS3.c[1], OCS3.c[2] + OCS3.d / 2 + 4), q.setFromAxisAngle(new V3(0, 1, 0), a), S.set(26, 70, 3));
        m3.setMatrixAt(i, m4);
      }
      m3.instanceMatrix.needsUpdate = true;
    }
    // small cubes
    const mk = look.minisK ?? 0;
    minis.visible = mk > 0.01;
    ocs4.visible = minis.visible;
    if (minis.visible) {
      fadeAll([shellMat, miniMat], mk);
      const cs = miniCentres(look.move ?? 0);
      let k = 0;
      cs.forEach((c, j) => {
        const isSpare = j === 4;
        const show = !isSpare || (look.spareK ?? 0) > 0.01;
        m4.compose(P.set(...c), q.identity(), S.setScalar(show ? MINI.box : 0.001));
        shells.setMatrixAt(j, m4);
        const failed = j === FAILED ? look.failK ?? 0 : 0;
        shells.setColorAt(j, col.setScalar(1 - 0.5 * failed));
        for (let x = 0; x < 4; x++)
          for (let y = 0; y < 4; y++)
            for (let z = 0; z < 4; z++) {
              m4.compose(P.set(c[0] + (x - 1.5) * MINI.s, c[1] + (z - 1.5) * MINI.s, c[2] - (y - 1.5) * MINI.s), q.identity(), S.setScalar(show ? MINI.node : 0.001));
              miniNodes.setMatrixAt(k, m4);
              miniNodes.setColorAt(k, col.set(NODE).lerp(new THREE.Color(FAINT), failed));
              k++;
            }
      });
      shells.instanceMatrix.needsUpdate = true;
      shells.instanceColor.needsUpdate = true;
      miniNodes.instanceMatrix.needsUpdate = true;
      miniNodes.instanceColor.needsUpdate = true;
      const A = mirrorAngles(look.mirrorsFrom ?? 'column');
      const B = mirrorAngles(look.mirrorsTo ?? 'column');
      const t = look.mirrorK ?? 0;
      RANKS.forEach((axis, r) => {
        for (let i = 0; i < OCS4.mirrors; i++) {
          const j = r * OCS4.mirrors + i;
          m4.compose(P.set(OCS4.c[0] - 105 + i * 30, rankY(axis), OCS4.c[2] + OCS4.d / 2 + 6), q.setFromAxisAngle(new V3(0, 1, 0), A[j] + (B[j] - A[j]) * t), S.set(22, 120, 3));
          mirrors.setMatrixAt(j, m4);
        }
      });
      mirrors.instanceMatrix.needsUpdate = true;
    }
    // the pod
    const pk = look.podK ?? 0;
    pod.visible = pk > 0.01;
    if (pod.visible) {
      podMat.opacity = pk;
      podTop.opacity = pk;
      podMat.transparent = podTop.transparent = pk < 0.999;
      podMat.depthWrite = podTop.depthWrite = pk > 0.5;
    }
    const rk = look.ringK ?? 0;
    ring.visible = rk > 0.01;
    if (ring.visible) {
      ringMats.forEach((m) => (m.opacity = rk));
      hubMat.color.set('#8e979d').lerp(accent, look.hubK ?? 0);
    }
    out.visible = (look.outK ?? 0) > 0.01;
    cdu.visible = (look.cduK ?? 0) > 0.01;
  };
  return {root, update, cube, minis, ocs4, pod, ring, idx, NODES};
}
