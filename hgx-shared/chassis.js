// The DGX B200, built from code in millimetres (the root is scaled by 0.001, so the scene is in metres): x across the
// front, y up from the floor, z front (+) to back (-). A simplified 10U box, 444 x 482.3 x 897.1 mm, no logo, no photo.
// Front: the bezel (it comes off), behind it 12 fan modules (2 x 6, 仮定), 8 U.2 bays, the power and ID buttons.
// Inside: the GPU tray (trays.js) above the motherboard tray (trays.js; the order is 仮定), the midplane between the
// motherboard tray and the front. Back: 6 power supplies, the motherboard tray's back panel (4 OSFP, BlueField-3 and
// management ports), the GPU tray's exhaust. update(look) poses it from the page's state: nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {CH, FRONT, GT, MB, MID, PSU} from './flow.js';
import {SPEC} from './kin.js';
import {buildGpuTray, buildMbTray} from './trays.js';

const V3 = THREE.Vector3;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);
const hash = (i) => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};

/** the shared builders (as nvl72-shared/rack.js): materials that remember their base colour, boxes by extent, instances */
export function makeKit(root) {
  const accent = new THREE.Color(C.accent);
  const reg = {};
  const mk = (sys, opts) => {
    const m = new THREE.MeshStandardMaterial({roughness: 0.6, metalness: 0, envMapIntensity: 0.55, ...opts});
    (reg[sys] ||= []).push(m);
    m.userData = {sys, base: m.color.clone()};
    return m;
  };
  const metal = (c, r = 0.5, m = 0.5) => ({color: c, roughness: r, metalness: m});
  const bx = (parent, mat, [x0, x1], [y0, y1], [z0, z1], cast = true) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const m4 = new THREE.Matrix4();
  const q0 = new THREE.Quaternion();
  const col = new THREE.Color();
  const inst = (parent, mat, list, geo = BOX, cast = true) => {
    const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
    list.forEach((o, i) => {
      m4.compose(new V3(...o.p), o.q ?? q0, new V3(...o.s));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.setScalar(o.c ?? 1));
    });
    im.count = list.length;
    im.castShadow = cast;
    im.receiveShadow = true;
    parent.add(im);
    return im;
  };
  const tint = (m, w) => m.color.copy(m.userData.base).lerp(accent, w);
  const fade = (m, o) => {
    if (Math.abs(m.opacity - o) < 1e-4) return;
    m.opacity = o;
    const tr = o < 0.999;
    if (m.transparent !== tr || m.depthWrite !== o > 0.5) {
      m.transparent = tr;
      m.depthWrite = o > 0.5;
      m.needsUpdate = true;
    }
  };
  return {mk, metal, bx, inst, tint, fade, reg, accent, root};
}

export function buildChassis() {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const K = makeKit(root);
  const {mk, metal, bx, inst} = K;
  const M = {
    shell: mk('shell', metal('#6e7278', 0.58, 0.4)),
    side: mk('side', metal('#6e7278', 0.58, 0.4)),
    floor: mk('shell', metal('#5d6066', 0.6, 0.4)),
    ear: mk('shell', metal('#7c8087', 0.5, 0.45)),
    mid: mk('board', {color: '#4f6357', roughness: 0.72}),
    vent: mk('shell', {color: '#26282b', roughness: 0.85}),
    fanBox: mk('fans', metal('#3f4247', 0.6, 0.3)),
    fanRing: mk('fans', {color: '#2a2c30', roughness: 0.7}),
    fanHub: mk('fans', metal('#62666c', 0.5, 0.4)),
    u2: mk('u2', metal('#8b9097', 0.5, 0.5)),
    u2Tab: mk('u2', {color: '#2c2e32', roughness: 0.6}),
    btn: mk('btn', {color: '#2c2e32', roughness: 0.5}),
    led: mk('btn', {color: '#6aa37f', roughness: 0.5}),
    bezel: mk('bezel', metal('#c6cacd', 0.5, 0.35)),
    bezelMesh: mk('bezel', {color: '#33363a', roughness: 0.8}),
    psu: mk('psu', metal('#8c9198', 0.5, 0.4)),
    psuSpare: mk('psuSpare', metal('#8c9198', 0.5, 0.4)),
    psuFace: mk('psuFace', {color: '#2a2c30', roughness: 0.8}),
    cord: mk('psuFace', {color: '#1f2124', roughness: 0.6}),
  };
  const G = {fixed: new THREE.Group(), bezel: new THREE.Group(), sides: new THREE.Group()};
  root.add(G.fixed, G.bezel, G.sides);
  const F = G.fixed;
  const W2 = CH.W / 2;
  const t = CH.wall;

  // ------------------------------------------------------------ the shell: floor, sides, ears, the strip over the fans
  bx(F, M.floor, [-W2, W2], [0, MB.y[0]], [CH.zB, CH.face]);
  // the side walls come off in chapters 2-3 so the trays show
  for (const sx of [-1, 1]) bx(G.sides, M.side, sx > 0 ? [W2 - t, W2] : [-W2, -W2 + t], [0, CH.H - 4], [CH.zB, CH.face]);
  for (const sx of [-1, 1]) bx(F, M.ear, sx > 0 ? [W2, CH.Wear / 2] : [-CH.Wear / 2, -W2], [0, CH.H], [CH.face - 6, CH.face]);
  bx(F, M.shell, [-W2, W2], [CH.H - 4, CH.H], [GT.lid.z[1], CH.face]);
  // the shelf the GPU tray stands on, the midplane, the exhaust grille at the back of the GPU tray
  bx(F, M.floor, [-W2 + t, W2 - t], [PSU.y[1] + 1, GT.board.y[0]], [CH.zB, MID.z - 4]);
  bx(F, M.mid, [-W2 + t, W2 - t], MID.y, [MID.z - 3, MID.z + 3]);
  bx(F, M.shell, [-W2, W2], [GT.board.y[0], CH.H - 4], [CH.zB, CH.zB + 3]);
  const grille = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 14; c++) grille.push({p: [-W2 + 22 + c * 30.5, 214 + r * 24.5, CH.zB - 0.6], s: [24, 18, 1.2]});
  inst(F, M.vent, grille, BOX, false);

  // ------------------------------------------------------------ the front: fans, U.2, buttons, a vent
  const fanBoxes = [];
  const rings = [];
  const hubs = [];
  const qz = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  let k = 0;
  for (const [ya, yb] of FRONT.fanRows)
    for (let i = 0; i < SPEC.fans.cols; i++) {
      const x = FRONT.fanX(i);
      const yc = (ya + yb) / 2;
      fanBoxes.push({p: [x, yc, (FRONT.fanZ[0] + FRONT.fanZ[1]) / 2], s: [FRONT.fanW, yb - ya - 4, FRONT.fanZ[1] - FRONT.fanZ[0]], c: 0.94 + 0.12 * hash(k++)});
      for (const dy of [-34, 34]) {
        rings.push({p: [x, yc + dy, FRONT.fanZ[1] + 0.6], s: [30, 1.4, 30], q: qz});
        hubs.push({p: [x, yc + dy, FRONT.fanZ[1] + 1.2], s: [10, 1.6, 10], q: qz});
      }
    }
  inst(F, M.fanBox, fanBoxes);
  inst(F, M.fanRing, rings, CYL, false);
  inst(F, M.fanHub, hubs, CYL, false);
  const u2 = [];
  const tabs = [];
  for (let i = 0; i < SPEC.storage.u2; i++) {
    const x = FRONT.u2X(i);
    u2.push({p: [x, (FRONT.u2Y[0] + FRONT.u2Y[1]) / 2, (FRONT.u2Z[0] + FRONT.u2Z[1]) / 2], s: [FRONT.u2W, FRONT.u2Y[1] - FRONT.u2Y[0], FRONT.u2Z[1] - FRONT.u2Z[0]], c: 0.93 + 0.12 * hash(i + 40)});
    tabs.push({p: [x, FRONT.u2Y[1] - 16, FRONT.u2Z[1] + 2], s: [FRONT.u2W - 4, 22, 4]});
  }
  inst(F, M.u2, u2);
  inst(F, M.u2Tab, tabs);
  bx(F, M.shell, [-W2 + t, W2 - t], [MB.y[0], FRONT.u2Y[0]], [MID.z + 3, CH.face]);
  bx(F, M.shell, [-W2 + t, W2 - t], [FRONT.u2Y[1], FRONT.fanRows[0][0]], [MID.z + 3, CH.face]);
  bx(F, M.vent, [-14, 140], [FRONT.u2Y[0] + 6, FRONT.u2Y[1] - 6], [FRONT.u2Z[0], CH.face - 1]);
  bx(F, M.shell, [148, W2 - t], [FRONT.u2Y[0], FRONT.u2Y[1]], [FRONT.u2Z[0], CH.face - 1]);
  for (const y of FRONT.btnY) bx(F, M.btn, [FRONT.btnX - 7, FRONT.btnX + 7], [y - 7, y + 7], [CH.face - 1, CH.face + 3]);
  bx(F, M.led, [FRONT.btnX + 14, FRONT.btnX + 20], [FRONT.btnY[0] - 2, FRONT.btnY[0] + 2], [CH.face - 1, CH.face + 1]);

  // ------------------------------------------------------------ the bezel (comes off in chapter 1)
  const BZ = G.bezel;
  const z0 = CH.face + 2;
  const z1 = CH.zF;
  bx(BZ, M.bezelMesh, [-W2 + 8, W2 - 8], [8, CH.H - 8], [z0, z1 - 3]);
  for (const [xa, xb, ya, yb] of [[-W2, W2, 0, 14], [-W2, W2, CH.H - 14, CH.H], [-W2, -W2 + 16, 0, CH.H], [W2 - 16, W2, 0, CH.H]]) bx(BZ, M.bezel, [xa, xb], [ya, yb], [z0, z1]);
  const holes = [];
  for (let r = 0; r < 16; r++) for (let c = 0; c < 18; c++) holes.push({p: [-W2 + 34 + c * 22.4 + (r % 2) * 11, 30 + r * 24.6, z1 - 2.4], s: [12, 12, 1]});
  inst(BZ, M.bezel, holes, BOX, false);

  // ------------------------------------------------------------ the back: 6 power supplies with their cords
  for (let i = 0; i < SPEC.power.psus; i++) {
    const x = PSU.x(i);
    const mat = i < SPEC.power.need ? M.psu : M.psuSpare;
    bx(F, mat, [x - PSU.w / 2, x + PSU.w / 2], [PSU.y[0], PSU.y[1]], PSU.z);
    bx(F, M.psuFace, [x - 26, x + 12], [PSU.y[0] + 10, PSU.y[1] - 10], [CH.zB - 1, CH.zB]);
    bx(F, M.cord, [x + 16, x + 30], [PSU.y[0] + 22, PSU.y[0] + 40], [CH.zB - 14, CH.zB]);
    bx(F, M.led, [x + 18, x + 26], [PSU.y[1] - 12, PSU.y[1] - 8], [CH.zB - 1, CH.zB]);
  }

  // ------------------------------------------------------------ the trays
  const gpu = buildGpuTray(K);
  const mb = buildMbTray(K);
  root.add(gpu.root, mb.root);

  // ------------------------------------------------------------ anchors: where a label's leader lands
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  pin('bezel', BZ, -120, 300, z1);
  pin('chassisTop', F, 120, CH.H, 200);
  pin('ear', F, -CH.Wear / 2 + 4, 380, CH.face);
  pin('btn', F, FRONT.btnX, FRONT.btnY[1], CH.face + 3);
  pin('fans', F, FRONT.fanX(4), FRONT.fanRows[1][1] - 40, FRONT.fanZ[1]);
  pin('u2', F, FRONT.u2X(2), FRONT.u2Y[1] - 30, FRONT.u2Z[1] + 4);
  pin('psu', F, PSU.x(1), PSU.y[1] - 6, CH.zB);
  pin('psuSpare', F, PSU.x(5), PSU.y[1] - 6, CH.zB);
  pin('psuOn', F, PSU.x(2), PSU.y[1] - 6, CH.zB);
  pin('exhaust', F, -100, 380, CH.zB - 1);
  pin('mid', F, 180, 150, MID.z);
  for (const [kk, a] of Object.entries(gpu.anchors)) anchors[kk] = a;
  for (const [kk, a] of Object.entries(mb.anchors)) anchors[kk] = a;

  /**
   * look: {lifts: [pull, lid, sinks, baffle, cpuSinks], bezel 0..1 (off), lidAway, ghost, hi: {psu, fans, nic0, osfp4},
   *        hiGpu: {g: w}, hiNvs: {c: w}}
   */
  const update = (look = {}) => {
    gpu.update(look);
    mb.update(look);
    const bz = look.bezel ?? 0;
    BZ.position.z = 260 * bz;
    BZ.visible = bz < 0.98;
    K.fade(M.bezel, 1 - bz);
    K.fade(M.bezelMesh, 1 - bz);
    const sides = look.sides ?? 0;
    G.sides.visible = sides < 0.98;
    K.fade(M.side, 1 - sides);
    const hi = look.hi ?? {};
    K.tint(M.psu, hi.psu ?? 0);
    for (const m of K.reg.fans) K.tint(m, hi.fans ?? 0);
  };
  /** an anchor in world metres (follows the pulled tray and the lifted layers) */
  const anchor = (key) => {
    const a = anchors[key];
    a.obj.updateWorldMatrix(true, false);
    return a.obj.localToWorld(a.p.clone());
  };
  return {root, update, anchor, anchors, M, K, G, gpu, mb};
}
export {V3};
