// What stands around the detailed DGX B200 in chapters 4-6, all simplified boxes (millimetres, under the chassis root):
//   4-5  8 more DGX B200 to its right (9 boxes = 72 GPUs), 8 InfiniBand leaf switches behind and above them (one per
//        rail), a marker for every GPU on the boxes' lids (grey, the 7 NVLink can reach in the accent, the sender in ink)
//   5    an NVL72 rack (2,236 x 600 x 1,068 mm, nvl72/refs.md) to the right and the two bars of the comparison
//   6    a 42U rack with 4 slots of 10U: the boxes the power allows slide in, the slots it does not stay as outlines
// update(look) poses it; nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BARS, boxX, CH, CL, FRONT, leafX, markerW, NVR, R42, slotY} from './flow.js';
import {NV, SPEC} from './kin.js';

const V3 = THREE.Vector3;

export function buildCluster(K, parent) {
  const {mk, metal, bx, inst} = K;
  const root = new THREE.Group();
  parent.add(root);
  const M = {
    body: mk('cl', metal('#6e7278', 0.58, 0.4)),
    face: mk('cl', metal('#8a8e95', 0.5, 0.4)),
    fan: mk('cl', {color: '#2f3236', roughness: 0.8}),
    leaf: mk('cl', metal('#5d6167', 0.55, 0.4)),
    leaf0: mk('leaf0', metal('#5d6167', 0.55, 0.4)),
    port: mk('cl', {color: '#1f2124', roughness: 0.85}),
    mark: mk('mark', {color: '#a3abb1', roughness: 0.6}),
    markOn: mk('mark', {color: C.accent, roughness: 0.6}),
    markInk: mk('mark', {color: C.ink, roughness: 0.6}),
    rack: mk('rack', metal('#5d6066', 0.55, 0.45)),
    rbody: mk('rack', metal('#6e7278', 0.58, 0.4)),
    rface: mk('rack', metal('#8a8e95', 0.5, 0.4)),
    rfan: mk('rack', {color: '#2f3236', roughness: 0.8}),
    ghost: mk('ghost', {color: '#b9c2c7', roughness: 0.8}),
    nv: mk('nv', metal('#5d6066', 0.55, 0.45)),
    nvFace: mk('nv', metal('#7d8188', 0.5, 0.4)),
    nvLine: mk('nv', {color: '#3a3d41', roughness: 0.8}),
    barDgx: mk('bar', {color: C.ink, roughness: 0.7}),
    barNv: mk('bar', {color: C.accent, roughness: 0.7}),
  };
  for (const m of [M.ghost]) K.fade(m, 0.35);
  const W2 = CH.W / 2;
  const zc = (CH.zF + CH.zB) / 2;
  /** a simplified DGX B200: body, front face, the fan grid; its own group so it can slide */
  const simpleBox = (p, mats) => {
    const g = new THREE.Group();
    bx(g, mats.body, [-W2, W2], [0, CH.H], [CH.zB, CH.face]);
    bx(g, mats.face, [-W2, W2], [0, CH.H], [CH.face, CH.zF]);
    const fl = [];
    for (const [ya, yb] of FRONT.fanRows) for (let i = 0; i < SPEC.fans.cols; i++) fl.push({p: [FRONT.fanX(i), (ya + yb) / 2, CH.zF + 0.6], s: [FRONT.fanW - 12, yb - ya - 18, 1]});
    inst(g, mats.fan, fl, undefined, false);
    if (p) g.position.set(...p);
    return g;
  };

  // ------------------------------------------------------------ 4-5: the 8 other boxes, the leaves, the markers
  const G4 = new THREE.Group();
  root.add(G4);
  const boxes = [];
  for (let b = 1; b < SPEC.allreduce.gpus / SPEC.gpus; b++) {
    const g = simpleBox([boxX(b), 0, 0], M);
    G4.add(g);
    boxes.push(g);
  }
  const leaves = [];
  for (let k = 0; k < SPEC.net.rails; k++) {
    const g = new THREE.Group();
    bx(g, k === SPEC.demo.wallRail ? M.leaf0 : M.leaf, [-CL.leafW / 2, CL.leafW / 2], [-CL.leafH / 2, CL.leafH / 2], [-CL.leafD / 2, CL.leafD / 2]);
    const pl = [];
    for (let j = 0; j < 16; j++) pl.push({p: [-180 + j * 24, 0, CL.leafD / 2 + 0.6], s: [16, 12, 1]});
    inst(g, M.port, pl, undefined, false);
    g.position.set(leafX(k), CL.leafY, CL.leafZ);
    G4.add(g);
    leaves.push(g);
  }
  const nMark = SPEC.allreduce.gpus;
  const mk3 = (mat) => {
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, nMark);
    im.count = 0;
    im.castShadow = true;
    im.receiveShadow = true;
    G4.add(im);
    return im;
  };
  const marks = {grey: mk3(M.mark), on: mk3(M.markOn), ink: mk3(M.markInk)};
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const S = new V3(CL.markS, 12, CL.markS);

  // ------------------------------------------------------------ 5: NVL72 and the bars
  const G5 = new THREE.Group();
  root.add(G5);
  bx(G5, M.nv, [NVR.x - NVR.w / 2, NVR.x + NVR.w / 2], [0, NVR.h], [-NVR.d / 2, NVR.d / 2 - 6]);
  bx(G5, M.nvFace, [NVR.x - NVR.w / 2 + 40, NVR.x + NVR.w / 2 - 40], [140, NVR.h - 140], [NVR.d / 2 - 6, NVR.d / 2]);
  const lines = [];
  const trays = NV.computeTrays + NV.switchTrays + NV.powerShelves + NV.tor;
  for (let i = 0; i < trays; i++) lines.push({p: [NVR.x, 260 + i * 44.45, NVR.d / 2 + 0.8], s: [NVR.w - 100, 3, 1.2]});
  inst(G5, M.nvLine, lines, undefined, false);
  const bar = (mat, [x, , z]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
    m.position.set(x, 0, z);
    m.castShadow = true;
    G5.add(m);
    return m;
  };
  const bars = {dgx: bar(M.barDgx, BARS.dgx), nv: bar(M.barNv, BARS.nv)};

  // ------------------------------------------------------------ 6: the 42U rack
  const G6 = new THREE.Group();
  root.add(G6);
  const RW = R42.w / 2;
  const RD = R42.d / 2;
  bx(G6, M.rack, [R42.x - RW, R42.x + RW], [0, R42.base - 10], [-RD, RD]);
  bx(G6, M.rack, [R42.x - RW, R42.x + RW], [R42.h - 60, R42.h], [-RD, RD]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(G6, M.rack, sx > 0 ? [R42.x + RW - 36, R42.x + RW] : [R42.x - RW, R42.x - RW + 36], [R42.base - 10, R42.h - 60], sz > 0 ? [RD - 36, RD] : [-RD, -RD + 36]);
  // the U marks on the front rails, every 10U
  const um = [];
  for (let i = 0; i <= 4; i++) for (const sx of [-1, 1]) um.push({p: [R42.x + sx * (RW - 50), slotY(i) - 0.5, RD - 30], s: [24, 3, 4]});
  inst(G6, M.rfan, um, undefined, false);
  const rackBoxes = [];
  const ghosts = [];
  const RM = {body: M.rbody, face: M.rface, fan: M.rfan};
  for (let i = 0; i < 4; i++) {
    const g = simpleBox(null, RM);
    G6.add(g);
    rackBoxes.push(g);
    const gh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), M.ghost);
    gh.scale.set(CH.W - 8, CH.H - 8, CH.zF - CH.zB - 8);
    gh.position.set(R42.x, slotY(i) + CH.H / 2, zc);
    G6.add(gh);
    ghosts.push(gh);
  }

  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  pin('nvTop', G5, NVR.x, NVR.h, 0);
  pin('rackTop', G6, R42.x, R42.h, 0);

  const all = Object.values(M).filter((m) => m !== M.ghost);
  /**
   * look: {cluster 0..1, scene, boxes (how many of the 8 to show), rails: {k, lit}, nvK 0..1, bars: {dgx, nv} (ms),
   *        rackK 0..1, rack: {ins: [4], n}}
   */
  const update = (look = {}) => {
    const ck = look.cluster ?? 0;
    G4.visible = ck > 0.01;
    if (G4.visible) {
      const nb = look.boxes ?? 8;
      boxes.forEach((g, i) => (g.visible = i < nb));
      leaves.forEach((g, k) => (g.visible = look.allLeaves || k === SPEC.demo.wallRail));
      for (const m of [M.body, M.face, M.fan, M.leaf, M.leaf0, M.port, M.mark, M.markOn, M.markInk]) K.fade(m, ck);
      K.tint(M.leaf0, look.leaf0 ?? 0);
      for (const im of Object.values(marks)) im.count = 0;
      if (look.markers) {
        const lit = look.markLit ?? 0;
        for (let b = 0; b < SPEC.allreduce.gpus / SPEC.gpus; b++)
          for (let g = 0; g < SPEC.gpus; g++) {
            const im = b === 0 && g === SPEC.demo.hopFrom ? marks.ink : b === 0 && g <= lit ? marks.on : marks.grey;
            m4.compose(new V3(...markerW(b, g)).setY(CL.markY + 6), q0, S);
            im.setMatrixAt(im.count++, m4);
          }
        for (const im of Object.values(marks)) im.instanceMatrix.needsUpdate = true;
      }
    }
    const nk = look.nvK ?? 0;
    G5.visible = nk > 0.01;
    if (G5.visible) {
      for (const m of [M.nv, M.nvFace, M.nvLine, M.barDgx, M.barNv]) K.fade(m, nk);
      const b = look.bars ?? {dgx: 0, nv: 0};
      for (const [key, ms] of Object.entries(b)) {
        const h = Math.max(1, ms * BARS.mmPerMs);
        bars[key].scale.set(BARS.s, h, BARS.s);
        bars[key].position.y = h / 2;
      }
    }
    const rk = look.rackK ?? 0;
    G6.visible = rk > 0.01;
    if (G6.visible) {
      for (const m of [M.rack, M.rbody, M.rface, M.rfan]) K.fade(m, rk);
      K.fade(M.ghost, 0.35 * rk);
      const r = look.rack ?? {ins: [0, 0, 0, 0], n: 0};
      rackBoxes.forEach((g, i) => {
        const v = r.ins[i] ?? 0;
        g.visible = v > 0.001;
        g.position.set(R42.x, slotY(i), (1 - v) * R42.slide);
        ghosts[i].visible = i >= r.n;
      });
    }
  };
  return {root, update, anchors, all, M};
}
