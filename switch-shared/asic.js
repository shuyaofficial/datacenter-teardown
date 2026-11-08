// Chapters 4-7 drawn over the chassis, in the chassis' millimetres (the group hangs under chassis.root):
//   4  the magnified ASIC: a plate floating above the real ASIC with the 12 blocks of the pipeline (flow.js BOARD), the
//      frame's 6 cells (ink) and its 64 B descriptor (the accent); the frame reaches it along the real trace from Gi1/0/1.
//   5  the punt: the CoPP gate in the ASIC, the ASIC→CPU trace, four see-through plates above the CPU (kernel, FED, PDS,
//      IOSd); the storm's beads, the ones the CoPP throws away stop at the gate.
//   6  the egress queues Q0 / Q1 of Gi1/0/3 standing over the ASIC, beads in from Gi1/0/1 and Gi1/0/2, out to Gi1/0/3.
//   7  thin dashes of air front → back, the 14 ports a 437 W budget can give 30 W.
// update(look) poses it from the frame's state; overlay(look, project) returns the HTML tags (block names, chips,
// cards) in screen pixels. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {CPU_LAYERS, poeDevices, SPEC} from './kin.js';
import {L, phyX, portPos, TRACES} from './chassis.js';
import {activeOf, airCount, airDashes, along, BLOCK, BOARD, boardPose, CELL, CONGEST, congestBeads, STORM, stormBeads, TAG_ROUTE} from './flow.js';

const V3 = THREE.Vector3;
const PY = 5.6;
const ZF = SPEC.chassis.d / 2;
const ACC = new THREE.Color(C.accent);
const INK = '#2f2c28';
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const seg = (u, a, b) => clamp((u - a) / (b - a), 0, 1);
const ease = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * (3 - 2 * u);
};

// ------------------------------------------------------------ paths on the real board (chassis mm)
const ASIC_C = [L.asic.x, PY + 4, L.asic.z];
const LANE0 = TRACES['phy-asic-0'].pts;
/** port n → jack → PHY 0 → its lane → the ASIC's centre; dx shifts the lane so in and out read as two lanes */
export const pathIn = (n, dx = -1.6) => {
  const p = portPos(n);
  const y = PY + 1.6;
  const xp = phyX(0) + dx;
  return [[p.x, p.y, ZF + 3], [p.x, y + 2, ZF - 30], [xp, y, 168], [xp, y, LANE0[1][1] + dx], [LANE0[2][0] + dx, y, LANE0[2][1] + dx], [LANE0[3][0] + dx, y, LANE0[3][1]], ASIC_C];
};
export const pathOut = (n) => [...pathIn(n, 1.6)].reverse();
const GATE_X = -4;
const PLATE_Y = [40, 58, 76, 94];
const CPU_C = [L.cpu.x, PY + 13, L.cpu.z];
const AC = TRACES['asic-cpu'].pts;
const toGate = [ASIC_C, [GATE_X - 7, PY + 4, L.asic.z]];
const gateToCpu = [[GATE_X - 7, PY + 4, L.asic.z], [AC[0][0], PY + 1.6, AC[0][1]], [AC[1][0], PY + 1.6, AC[1][1]], CPU_C, [L.cpu.x, PLATE_Y[0], L.cpu.z]];
// the egress queues of Gi1/0/3 stand over the ASIC
const QCOL = {x: [L.asic.x - 22, L.asic.x + 14], z: L.asic.z, y0: 24, h: 72, s: 18};
const Q_TOP = [QCOL.x[1], QCOL.y0 + QCOL.h + 6, QCOL.z];
const qIn = (n) => [...pathIn(n, n === 1 ? -2.4 : -0.6), [QCOL.x[1] + 18, PY + 4, QCOL.z], [QCOL.x[1] + 18, Q_TOP[1], QCOL.z], Q_TOP];
const qOut = [[QCOL.x[1], QCOL.y0 - 2, QCOL.z], [QCOL.x[1], PY + 4, QCOL.z], ...pathOut(3).slice(1)];
// air: front (and the NM side) → over the board → out through the fans and the PSU
const AIR_PATHS = (() => {
  const out = [];
  const fx = L.fan.xs;
  [[-150, 14], [-60, 30], [40, 14], [120, 30], [-100, 24], [80, 22]].forEach(([x0, y], i) => {
    const x1 = fx[i % 3];
    out.push([[x0, y, ZF + 26], [x0, y, 120], [x1, y + (i % 2 ? -4 : 4), -150], [x1, y + (i % 2 ? -4 : 4), -ZF - 30]]);
  });
  out.push([[-178, 22, ZF + 26], [-178, 22, -ZF - 30]]);
  out.push([[SPEC.chassis.w / 2 + 34, 20, 70], [180, 20, 40], [90, 26, -70], [fx[2], 26, -150], [fx[2], 26, -ZF - 30]]);
  return out;
})();

export function buildAsic(chassis) {
  const root = new THREE.Group();
  chassis.root.add(root);
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.6, metalness: 0, envMapIntensity: 0.5, ...extra});
  const box = (parent, mat, [w, h, d], [x, y, z]) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const tintable = (base, extra) => {
    const m = std(base, extra);
    m.userData.base = m.color.clone();
    return m;
  };
  const tint = (m, w) => m.color.copy(m.userData.base).lerp(ACC, w);
  const lineMat = (color, opacity = 1, dashed = false) =>
    dashed ? new THREE.LineDashedMaterial({color, dashSize: 4, gapSize: 3, transparent: true, opacity}) : new THREE.LineBasicMaterial({color, transparent: true, opacity});
  const lines = (parent, mat, pairs) => {
    const g = new THREE.BufferGeometry().setFromPoints(pairs.flat().map((p) => new V3(...p)));
    const l = new THREE.LineSegments(g, mat);
    if (mat.isLineDashedMaterial) l.computeLineDistances();
    parent.add(l);
    return l;
  };

  // ------------------------------------------------------------ 4: the magnified ASIC
  const board = new THREE.Group();
  root.add(board);
  const plateMat = std('#f7f3ec', {roughness: 0.85});
  box(board, plateMat, [BOARD.x1 - BOARD.x0, BOARD.t, BOARD.z1 - BOARD.z0], [(BOARD.x0 + BOARD.x1) / 2, -BOARD.t / 2, (BOARD.z0 + BOARD.z1) / 2]);
  const A = BOARD.asic;
  const outlineMat = lineMat(C.mute, 0.9, true);
  lines(board, outlineMat, [[[A.x0, 0.3, A.z0], [A.x1, 0.3, A.z0]], [[A.x1, 0.3, A.z0], [A.x1, 0.3, A.z1]], [[A.x1, 0.3, A.z1], [A.x0, 0.3, A.z1]], [[A.x0, 0.3, A.z1], [A.x0, 0.3, A.z0]]]);
  const blockMat = {};
  for (const b of BOARD.blocks) {
    blockMat[b.id] = tintable(b.id === 'phy' ? '#aaa397' : '#cbc2b3');
    box(board, blockMat[b.id], [b.w, b.h, b.d], [b.x, b.h / 2, b.z]);
  }
  const flowMat = {};
  for (const [k, pts] of Object.entries(BOARD.flows)) {
    flowMat[k] = tintable('#c7bcaa');
    pts.slice(1).forEach(([x, z], i) => {
      const [px, pz] = pts[i];
      box(board, flowMat[k], [Math.abs(x - px) + 2.4, 0.8, Math.abs(z - pz) + 2.4], [(x + px) / 2, 0.4, (z + pz) / 2]);
    });
  }
  // arrowheads on the flows: small wedges pointing along
  const wedge = new THREE.ConeGeometry(3.2, 7, 3);
  const arrow = (mat, x, z, dir) => {
    const m = new THREE.Mesh(wedge, mat);
    m.rotation.set(0, 0, dir > 0 ? -Math.PI / 2 : Math.PI / 2);
    m.position.set(x, 1.2, z);
    m.scale.set(1, 1, 0.35);
    board.add(m);
  };
  arrow(flowMat.in, 12, BOARD.rowIn, 1);
  arrow(flowMat.out, BLOCK.rwe.x + 22, BOARD.rowOut, -1);
  arrow(flowMat.toEqs, 120, 0, 1);
  // the peek lines: IFC and EFC look at the flow beside them
  const peekMat = lineMat(C.accent, 1);
  const peekIfc = lines(board, peekMat, [[[BLOCK.ifc.x, 4, BLOCK.ifc.z - 11], [BLOCK.ifc.x, 4, BOARD.rowIn + 4]]]);
  const peekEfc = lines(board, peekMat, [[[BLOCK.efc.x, 4, BLOCK.efc.z + 11], [BLOCK.efc.x, 4, BOARD.rowOut - 4]]]);
  // the descriptor's route, dashed in the accent while it travels
  const routeMat = lineMat(C.accent, 0.9, true);
  const route = lines(board, routeMat, TAG_ROUTE.slice(1).map(([x, z], i) => [[TAG_ROUTE[i][0], 9.5, TAG_ROUTE[i][1]], [x, 9.5, z]]));
  route.visible = false;
  // cells: 3 trains (a flood sends copies), 6 cells each; the descriptor tags: 3 copies
  const cellMat = std(INK, {roughness: 0.55, transparent: true});
  const cells = Array.from({length: 18}, () => box(board, cellMat, [CELL.w, CELL.h, CELL.d], [0, -50, 0]));
  const tagMat = std(C.accent, {roughness: 0.5, transparent: true});
  const tagEdge = new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true});
  const tags = Array.from({length: 3}, () => {
    const g = new THREE.Group();
    box(g, tagEdge, [14.6, 3, 11.6], [0, 1.5, 0]);
    box(g, tagMat, [13, 4, 10], [0, 2, 0]);
    board.add(g);
    return g;
  });
  // the magnifier: dashed lines from the real ASIC's corners to the outline's corners
  const magMat = lineMat(C.mute, 0.8, true);
  const magGeo = new THREE.BufferGeometry().setFromPoints(Array.from({length: 8}, () => new V3()));
  const mag = new THREE.LineSegments(magGeo, magMat);
  root.add(mag);
  // the frame on the real board: one bead per egress copy
  const beadMat = std(INK, {roughness: 0.5});
  const beads = Array.from({length: 3}, () => box(root, beadMat, [12, 5, 9], [0, -50, 0]));
  const riseBead = box(root, beadMat, [12, 5, 9], [0, -50, 0]);
  // the ports that work right now get an accent outline around the jack
  const ringMat = new THREE.MeshBasicMaterial({color: C.accent});
  const rings = Array.from({length: 4}, () => {
    const g = new THREE.Group();
    const w = L.hole.w + 2.4;
    const h = L.hole.h + 2.4;
    box(g, ringMat, [w, 1.1, 0.8], [0, h / 2, 0]);
    box(g, ringMat, [w, 1.1, 0.8], [0, -h / 2, 0]);
    box(g, ringMat, [1.1, h, 0.8], [w / 2, 0, 0]);
    box(g, ringMat, [1.1, h, 0.8], [-w / 2, 0, 0]);
    g.visible = false;
    root.add(g);
    return g;
  });
  const ringOn = (list) =>
    rings.forEach((g, i) => {
      g.visible = i < list.length;
      if (g.visible) {
        const p = portPos(list[i]);
        g.position.set(p.x, p.y, ZF + 0.5);
      }
    });

  // ------------------------------------------------------------ 5: CoPP gate, the plates above the CPU, the punt bead
  const punt = new THREE.Group();
  root.add(punt);
  const gateMat = tintable('#7d7468');
  const gz = L.asic.z;
  box(punt, gateMat, [3, 16, 3], [GATE_X, PY + 8, gz - 12]);
  box(punt, gateMat, [3, 16, 3], [GATE_X, PY + 8, gz + 12]);
  box(punt, gateMat, [3, 3, 27], [GATE_X, PY + 16, gz]);
  const plateMats = PLATE_Y.map(() => {
    const m = tintable('#f3ede2', {transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.7});
    return m;
  });
  const plates = PLATE_Y.map((y, i) => box(punt, plateMats[i], [64, 1.6, 64], [L.cpu.x, y, L.cpu.z]));
  const edgeMat = lineMat(C.sub, 0.85);
  PLATE_Y.forEach((y) => lines(punt, edgeMat, [[[L.cpu.x - 32, y + 0.8, L.cpu.z - 32], [L.cpu.x + 32, y + 0.8, L.cpu.z - 32]], [[L.cpu.x + 32, y + 0.8, L.cpu.z - 32], [L.cpu.x + 32, y + 0.8, L.cpu.z + 32]], [[L.cpu.x + 32, y + 0.8, L.cpu.z + 32], [L.cpu.x - 32, y + 0.8, L.cpu.z + 32]], [[L.cpu.x - 32, y + 0.8, L.cpu.z + 32], [L.cpu.x - 32, y + 0.8, L.cpu.z - 32]]]));
  lines(punt, lineMat(C.mute, 0.7, true), [[[L.cpu.x, PY + 18, L.cpu.z], [L.cpu.x, PLATE_Y[3], L.cpu.z]]]);
  const puntBead = box(root, beadMat, [10, 5, 8], [0, -50, 0]);
  const stormMat = std(INK, {roughness: 0.5, transparent: true, depthWrite: false});
  const STORM_N = 48;
  const stormIm = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 3.6, 6), stormMat, STORM_N);
  stormIm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  root.add(stormIm);
  const stormDrop = new THREE.InstancedMesh(new THREE.BoxGeometry(6, 3.6, 6), std('#6f675c', {transparent: true, opacity: 0.85, depthWrite: false}), STORM_N);
  root.add(stormDrop);

  // ------------------------------------------------------------ 6: Q0 / Q1 of Gi1/0/3
  const queue = new THREE.Group();
  root.add(queue);
  const glass = std('#fbf8f2', {transparent: true, opacity: 0.16, depthWrite: false});
  const qFillMat = tintable(INK);
  const qFill = [];
  QCOL.x.forEach((x, i) => {
    box(queue, glass, [QCOL.s, QCOL.h, QCOL.s], [x, QCOL.y0 + QCOL.h / 2, QCOL.z]);
    const s = QCOL.s / 2;
    const y0 = QCOL.y0;
    const y1 = QCOL.y0 + QCOL.h;
    const e = [];
    for (const [a, b] of [[-s, -s], [s, -s], [s, s], [-s, s]]) e.push([[x + a, y0, QCOL.z + b], [x + a, y1, QCOL.z + b]]);
    for (const y of [y0, y1]) e.push([[x - s, y, QCOL.z - s], [x + s, y, QCOL.z - s]], [[x + s, y, QCOL.z - s], [x + s, y, QCOL.z + s]], [[x + s, y, QCOL.z + s], [x - s, y, QCOL.z + s]], [[x - s, y, QCOL.z + s], [x - s, y, QCOL.z - s]]);
    lines(queue, edgeMat, e);
    qFill.push(box(queue, i ? qFillMat : std(INK), [QCOL.s - 3, 1, QCOL.s - 3], [x, QCOL.y0, QCOL.z]));
  });
  const CQ_N = 64;
  const qBeads = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 4.5, 8), std(INK, {roughness: 0.5}), CQ_N);
  const qDrop = new THREE.InstancedMesh(new THREE.BoxGeometry(8, 4.5, 8), std('#6f675c', {transparent: true, opacity: 0.85, depthWrite: false}), 24);
  root.add(qBeads, qDrop);

  // ------------------------------------------------------------ 7: air and PoE
  const AIR_N = AIR_PATHS.reduce((a, p) => a + airCount(p), 0);
  const airMat = new THREE.MeshBasicMaterial({color: '#6a7480', transparent: true, opacity: 0.85});
  const airIm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), airMat, AIR_N);
  airIm.frustumCulled = false;
  root.add(airIm);
  const plugs = new THREE.InstancedMesh(new THREE.BoxGeometry(9.6, 7.4, 6), std(C.accent, {roughness: 0.55}), poeDevices());
  {
    const m4 = new THREE.Matrix4();
    for (let n = 1; n <= poeDevices(); n++) {
      const p = portPos(n);
      plugs.setMatrixAt(n - 1, m4.makeTranslation(p.x, p.y, ZF + 3));
    }
  }
  root.add(plugs);

  // ------------------------------------------------------------ pose
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new V3();
  const hide = (im) => (im.count = 0);
  // the board grows out of the ASIC: it slides from the ASIC's centre to BOARD.at while its scale goes 0.1 → 1
  const boardOrigin = (k) => ASIC_C.map((v, i) => v + (BOARD.at[i] - v) * k);
  const boardWorld = (x, y, z, k) => {
    const s = 0.1 + 0.9 * k;
    const o = boardOrigin(k);
    return [o[0] + x * s, o[1] + y * s, o[2] + z * s];
  };
  const place = (mesh, p) => mesh.position.set(p[0], p[1], p[2]);
  const off = (mesh) => mesh.position.set(0, -500, 0);
  let last = {};

  /**
   * look: {chapter, scene, pk (packetAt), sceneT, mult, boardK (0..1, the drawing grows out of the ASIC), puntK, queueK,
   *        airK, sub7, T, airSpeed}
   */
  const update = (look) => {
    const pk = look.pk;
    // ---------------- 4
    const bk = look.boardK ?? 0;
    board.visible = bk > 0.01;
    mag.visible = bk > 0.3;
    const s = 0.1 + 0.9 * bk;
    board.scale.setScalar(s);
    const bw = boardWorld(0, 0, 0, bk);
    board.position.set(...bw);
    magMat.opacity = 0.8 * seg(bk, 0.3, 1);
    {
      const a = L.asic;
      const h = a.s / 2;
      const real = [[a.x - h, PY + 1.4, a.z - h], [a.x + h, PY + 1.4, a.z - h], [a.x + h, PY + 1.4, a.z + h], [a.x - h, PY + 1.4, a.z + h]];
      const up = [[A.x0, 0, A.z0], [A.x1, 0, A.z0], [A.x1, 0, A.z1], [A.x0, 0, A.z1]].map(([x, y, z]) => boardWorld(x, y, z, bk));
      const pos = magGeo.attributes.position;
      real.forEach((p, i) => {
        pos.setXYZ(i * 2, ...p);
        pos.setXYZ(i * 2 + 1, ...up[i]);
      });
      pos.needsUpdate = true;
      mag.computeLineDistances();
    }
    const boardScene = look.chapter === 4 && pk && pk.phase !== 'queue';
    const bp = boardScene ? boardPose(pk) : null;
    const act = boardScene ? activeOf(pk) : {blocks: [], flow: null};
    for (const b of BOARD.blocks) tint(blockMat[b.id], act.blocks.includes(b.id) ? (b.w * b.d > 2000 ? 0.32 : 0.62) : 0);
    for (const k of Object.keys(flowMat)) tint(flowMat[k], act.flow === k ? 0.85 : 0);
    peekIfc.visible = bp?.peek === 'ifc';
    peekEfc.visible = bp?.peek === 'efc';
    const copies = bp ? bp.copies : 1;
    const egressSide = pk && ['pbc-rwe', 'efc-peek', 'efc-lookup', 'rwe', 'out'].includes(pk.stageId);
    cells.forEach((m, j) => {
      const copy = Math.floor(j / 6);
      const c = bp?.cells[j % 6];
      const show = c && (copy === 0 || (egressSide && copy < copies));
      if (!show) return off(m);
      m.scale.set(c.w, CELL.h, CELL.d);
      m.position.set(c.x, c.y + CELL.h / 2 + copy * 6.5, c.z);
    });
    cellMat.opacity = bp?.cells[0]?.o ?? 1;
    tags.forEach((g, j) => {
      const t = bp?.tag;
      if (!t || j >= (t.copies ?? 1)) return (g.visible = false);
      g.visible = true;
      const dz = t.copies > 1 ? (j - (t.copies - 1) / 2) * 14 * (t.copyK ?? 1) : 0;
      g.position.set(t.x, BLOCK.eqs.h * 0 + 9, t.z + dz);
      if (Math.abs(t.x - BLOCK.eqs.x) < 1 && Math.abs(t.z - BLOCK.eqs.z) < 1) g.position.y = BLOCK.eqs.h + 0.5;
      else if (t.x === BLOCK.ifc.x && t.z === BLOCK.ifc.z) g.position.y = BLOCK.ifc.h + 0.5;
      const sc2 = t.served ? 0.8 : 1;
      g.scale.setScalar(sc2);
    });
    tagMat.opacity = bp?.tag ? clamp(bp.tag.o, 0, 1) : 1;
    route.visible = !!bp?.tag && !bp.tag.served && ['ifc', 'pbc', 'eqs'].includes(pk.stageId);
    tagEdge.opacity = tagMat.opacity;
    // the frame on the real board, and its climb to the plate
    beads.forEach(off);
    off(riseBead);
    if (bp?.real) {
      const ports = SPEC.demo.floodPorts.map((p) => Number(p.split('/').pop()));
      const n = bp.real === 'out' ? (pk.copies > 1 ? ports.length : 1) : 1;
      for (let j = 0; j < n; j++) {
        const path = bp.real === 'in' ? pathIn(1) : pathOut(pk.copies > 1 ? ports[j] : 2);
        place(beads[j], along(path, ease(bp.realU)));
      }
    }
    if (bp && bp.rise !== null && bp.rise !== undefined) {
      const top = boardWorld(BLOCK.phy.x + 6, CELL.y, bp.real === 'out' ? BOARD.rowOut : pk.stageId === 'out' ? BOARD.rowOut : BOARD.rowIn, bk);
      const k = pk.stageId === 'out' ? 1 - bp.rise : bp.rise;
      place(riseBead, ASIC_C.map((v, i) => v + (top[i] - v) * ease(k)));
      riseBead.visible = k < 0.98;
    }
    riseBead.visible = riseBead.position.y > -100;
    {
      const flood = SPEC.demo.floodPorts.map((p) => Number(p.split('/').pop()));
      let list = [];
      if (look.chapter === 4 && bp) {
        if (bp.real === 'in' || (pk.stageId === 'phy-in' && !bp.real && pk.u < 0.7)) list = [1];
        else if (bp.real === 'out') list = pk.copies > 1 ? flood : [2];
      } else if (look.chapter === 5 && pk && pk.phase === 'asic' && (pk.stageId === 'phy-in' || pk.stageId === 'out' || look.scene === 'storm')) list = [1];
      else if (look.chapter === 6 && pk) list = [1, 2, 3];
      ringOn(list);
    }

    // ---------------- 5
    const pK = look.puntK ?? 0;
    punt.visible = pK > 0.01;
    const isPunt = look.chapter === 5 && pk;
    const layer = isPunt && pk.phase === 'cpu' ? pk.cpuLayer : null;
    tint(gateMat, isPunt && (layer === 'copp' || look.scene === 'storm') ? 0.85 : 0);
    const li = ['kernel', 'fed', 'pds', 'iosd'];
    plateMats.forEach((m, i) => {
      tint(m, layer === li[i] ? 0.7 : 0);
      m.opacity = (layer === li[i] ? 0.75 : 0.3) * pK;
    });
    void plates;
    off(puntBead);
    if (isPunt && look.scene !== 'storm') place(puntBead, puntPos(pk));
    // storm beads
    if (isPunt && look.scene === 'storm') {
      let a = 0;
      let d = 0;
      for (const b of stormBeads(look.sceneT)) {
        const pIn = pathIn(1);
        if (b.s <= STORM.travel) {
          const p = along([...pIn, ...toGate.slice(1)], b.s / STORM.travel);
          if (a < STORM_N) stormIm.setMatrixAt(a++, m4.compose(new V3(...p), q, sc.setScalar(1)));
        } else if (b.pass) {
          const u = (b.s - STORM.travel) / STORM.climb;
          if (u <= 1 && a < STORM_N) stormIm.setMatrixAt(a++, m4.compose(new V3(...along(gateToCpu, u)), q, sc.setScalar(1)));
        } else {
          const u = (b.s - STORM.travel) / STORM.stopFade;
          // stopped in front of the gate: a short queue that fades
          if (u <= 1 && d < STORM_N) stormDrop.setMatrixAt(d++, m4.compose(new V3(GATE_X - 6 - (b.i % 4) * 6.5, PY + 4 + (b.i % 2) * 4.2, L.asic.z + ((b.i % 3) - 1) * 6.5), q, sc.setScalar(1 - 0.35 * u)));
        }
      }
      stormIm.count = a;
      stormDrop.count = d;
      stormIm.instanceMatrix.needsUpdate = true;
      stormDrop.instanceMatrix.needsUpdate = true;
    } else {
      hide(stormIm);
      hide(stormDrop);
    }

    // ---------------- 6
    const qK = look.queueK ?? 0;
    queue.visible = qK > 0.01;
    if (look.chapter === 6 && pk && pk.phase === 'queue') {
      const qq = pk.real;
      const h = Math.max(0.6, qq.pct * (QCOL.h - 2));
      qFill[1].scale.y = h;
      qFill[1].position.y = QCOL.y0 + 1 + h / 2;
      tint(qFillMat, qq.full ? 0.9 : 0);
      qFill[0].scale.y = 0.6;
      qFill[0].position.y = QCOL.y0 + 1.3;
      const cb = congestBeads(look.sceneT, look.mult);
      let a = 0;
      let d = 0;
      for (const b of cb.ins) {
        const u = Math.min(1, b.s / CONGEST.travel);
        if (u < 1 && a < CQ_N) qBeads.setMatrixAt(a++, m4.compose(new V3(...along(qIn(b.port), u)), q, sc.setScalar(1)));
        else if (b.drop && d < 24) {
          const v = (b.s - CONGEST.travel) / CONGEST.dropFade;
          qDrop.setMatrixAt(d++, m4.compose(new V3(Q_TOP[0] + 12 + v * 14, Q_TOP[1] + 2 - v * v * 46, Q_TOP[2] + 4), q, sc.setScalar(1 - 0.4 * v)));
        }
      }
      for (const b of cb.outs) if (a < CQ_N) qBeads.setMatrixAt(a++, m4.compose(new V3(...along(qOut, b.s / CONGEST.outTravel)), q, sc.setScalar(1)));
      qBeads.count = a;
      qDrop.count = d;
      qBeads.instanceMatrix.needsUpdate = true;
      qDrop.instanceMatrix.needsUpdate = true;
    } else {
      hide(qBeads);
      hide(qDrop);
    }

    // ---------------- 7
    const aK = look.airK ?? 0;
    if (aK > 0.01) {
      let i = 0;
      const up = new V3(0, 0, 1);
      const dir = new V3();
      for (const p of AIR_PATHS)
        for (const {a, b} of airDashes(p, look.T ?? 0, look.airSpeed)) {
          dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
          const len = dir.length();
          q.setFromUnitVectors(up, dir.normalize());
          m4.compose(new V3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), q, sc.set(1.3, 1.3, len));
          if (i < AIR_N) airIm.setMatrixAt(i++, m4);
        }
      airIm.count = i;
      airIm.instanceMatrix.needsUpdate = true;
      airMat.opacity = 0.85 * aK;
    } else hide(airIm);
    plugs.visible = look.chapter === 7 && look.sub7 === 'poe';
    q.identity();
    last = {look, bp, bk};
  };

  /** the punted frame on its way: ASIC → CoPP gate → trace → CPU → up the plates, back down, injected, out of the port */
  function puntPos(pk) {
    const u = pk.u;
    if (pk.phase === 'asic') {
      if (pk.stageId === 'phy-in') return along(pathIn(1), ease(u));
      if (pk.stageId === 'out') return along(pathOut(1), ease(u));
      return ASIC_C;
    }
    if (pk.phase === 'inject') return along([...gateToCpu].reverse(), ease(u));
    const L4 = ['kernel', 'fed', 'pds', 'iosd'];
    const y = (id) => PLATE_Y[L4.indexOf(id)] + 3;
    const cx = L.cpu.x;
    const cz = L.cpu.z;
    if (pk.cpuLayer === 'copp') return along([...toGate, gateToCpu[1]], ease(u));
    if (pk.cpuDir > 0) {
      if (pk.cpuLayer === 'kernel') return along([...gateToCpu.slice(1, 4), [cx, y('kernel'), cz]], ease(u));
      const prev = L4[L4.indexOf(pk.cpuLayer) - 1];
      return [cx, y(prev) + (y(pk.cpuLayer) - y(prev)) * ease(u), cz];
    }
    const prev = L4[L4.indexOf(pk.cpuLayer) + 1];
    return [cx + 6, y(prev) + (y(pk.cpuLayer) - y(prev)) * ease(u), cz];
  }

  // ------------------------------------------------------------ the HTML over it
  const W = new V3();
  const scr = (project, p) => {
    W.set(...p);
    root.localToWorld(W);
    return project(W.x, W.y, W.z);
  };
  const scrBoard = (project, x, y, z) => {
    W.set(x, y, z);
    board.localToWorld(W);
    return project(W.x, W.y, W.z);
  };
  /**
   * tags: [{x, y, h, v, html, w, o, kind}] in screen px. kind 'blk' (a block's name), 'chip' (a moving marker), 'card'.
   */
  const overlay = (look, project) => {
    const out = [];
    root.updateWorldMatrix(true, true);
    const pk = look.pk;
    const bk = look.boardK ?? 0;
    if (bk > 0.92) {
      const o = seg(bk, 0.92, 1);
      const act = look.chapter === 4 && pk ? activeOf(pk) : {blocks: []};
      for (const b of BOARD.blocks) {
        const p = scrBoard(project, b.lab.x, b.h * 0 + 0.5, b.lab.z);
        if (!p) continue;
        const on = act.blocks.includes(b.id);
        out.push({kind: 'blk', x: p[0], y: p[1], h: b.lab.h, v: b.lab.v, w: 190, o, on, html: `<b>${b.abbr}</b><span>${b.ja}</span>`});
      }
      const pA = scrBoard(project, A.x1 - 2, 0.5, A.z0 + 2);
      if (pA) out.push({kind: 'note', x: pA[0], y: pA[1] - 6, h: 'l', v: 'b', o, html: 'UADP 2.0 ASIC の中（拡大図）'});
      const bp = last.bp;
      if (look.chapter === 4 && bp) {
        const sc0 = look.scene;
        // the descriptor's chip rides over it; the body's chip sits in front of the PBC while the cells wait there
        if (bp.tag && bp.tag.o > 0.2) {
          const p = scrBoard(project, bp.tag.x, 12, bp.tag.z - (bp.tag.copies > 1 ? 14 : 0));
          if (p) out.push({kind: 'chip', x: p[0], y: p[1] - 10, h: 'c', v: 'b', o: bp.tag.served ? 0.55 : 1, html: bp.tag.copies > 1 && bp.tag.copyK > 0.5 ? `札 64 B × ${bp.tag.copies}` : '札 64 B'});
        }
        const inPbc = ['pbc', 'eqs'].includes(pk.stageId) || (pk.stageId === 'pbc-rwe' && pk.u < 0.25);
        if (inPbc && bp.cells.length) {
          const p = scrBoard(project, BLOCK.pbc.x, 0.5, BLOCK.pbc.z + BLOCK.pbc.d / 2 + 4);
          if (p) out.push({kind: 'body', x: p[0], y: p[1], h: 'c', v: 't', o: 1, html: `本体 ${pk.real.bytes} B（切れ端 ${pk.real.cellCount}）は動かない`});
        }
        if (bp.cells.length && ['nif', 'macsec-in', 'fifo-in'].includes(pk.stageId)) {
          const mid = (bp.cells[0].x + bp.cells[bp.cells.length - 1].x) / 2;
          const p = scrBoard(project, mid, 0.5, bp.cells[0].z + 15);
          if (p) out.push({kind: 'body', x: p[0], y: p[1], h: 'c', v: 't', o: 1, html: pk.stageId === 'nif' && pk.u < 0.4 ? `${pk.real.bytes} B` : `切れ端 ${pk.real.cellCount} 個`});
        }
        if (sc0 === 'flood' && egressOf(pk) && pk.copies > 1) {
          const c0 = bp.cells[0];
          if (c0) {
            const p = scrBoard(project, c0.x, 30, c0.z);
            if (p) out.push({kind: 'body', x: p[0], y: p[1], h: 'c', v: 'b', o: 1, html: `× ${pk.copies}（出口の数は仮置き）`});
          }
        }
        if (pk.rewrite && ['efc-lookup', 'rwe', 'out'].includes(pk.stageId) || (pk.rewrite && pk.done)) {
          const p = scrBoard(project, BLOCK.rwe.x - 30, 0.5, BOARD.z1 - 2);
          const r = pk.rewrite;
          const d = SPEC.demo;
          const row = (k, a, b) => `<div><i>${k}</i>${r.applied ? `${a} → <em>${b}</em>` : a}</div>`;
          if (p)
            out.push({kind: 'card', x: p[0], y: p[1] + 12, h: 'c', v: 't', o: 1, html: `<b>RWE の書き換え（VLAN10 → VLAN20）</b>` + row('宛先 MAC', d.svi, d.hostB) + row('送信元 MAC', d.hostA, d.svi) + row('TTL', String(d.ttl0), String(d.ttl0 - 1))});
        }
      }
    }
    // ports on the real board: Gi1/0/1 and Gi1/0/2 named to the left of the front, the others under the front edge
    if (look.chapter === 4 || look.chapter === 6) {
      const ports = look.chapter === 6 ? [[1, '入口'], [2, '入口'], [3, '出口']] : look.scene === 'flood' ? [[1, '入口'], [2, '出口'], [3, '出口'], [4, '出口']] : [[1, '入口'], [2, '出口']];
      ports.forEach(([n, role]) => {
        const pp = portPos(n);
        const left = n <= 2;
        const p = left ? scr(project, [pp.x - 8, pp.y, ZF + 2]) : scr(project, [pp.x, 0, ZF + 2]);
        if (!p) return;
        const top = n % 2 === 1;
        if (left) out.push({kind: 'port', x: p[0] - 6, y: p[1] + (top ? -2 : 2), h: 'l', v: top ? 'b' : 't', o: 1, html: `Gi1/0/${n}<span>${role}</span>`});
        else out.push({kind: 'port', x: p[0] + (n - 3) * 74, y: p[1] + 8, h: 'c', v: 't', o: 1, html: `Gi1/0/${n}<span>${role}（${top ? '上段' : '下段'}）</span>`});
      });
    }
    // 7: the ports the PoE budget can feed
    if (look.chapter === 7 && look.sub7 === 'poe') {
      const n = poeDevices();
      const pp = portPos(2);
      const p = scr(project, [pp.x, 0, ZF + 2]);
      if (p) out.push({kind: 'lbl', x: p[0] - 30, y: p[1] + 16, h: 'c', v: 't', o: 1, on: true, html: `<b>Gi1/0/1〜${n} に 30 W</b><span>${SPEC.poeDeviceW} W × ${n} = ${SPEC.poeDeviceW * n} W（予算 ${SPEC.poeBudgetW} W）</span>`});
    }
    // 5: the plates' names to their right, the gate's numbers
    if ((look.puntK ?? 0) > 0.6) {
      const LA = CPU_LAYERS.filter((l) => l.id !== 'copp');
      const layer = pk && pk.phase === 'cpu' ? pk.cpuLayer : null;
      LA.forEach((l, i) => {
        const p = scr(project, [L.cpu.x - 34, PLATE_Y[i], L.cpu.z + 32]);
        if (p) out.push({kind: 'lbl', x: p[0] - 10, y: p[1], h: 'l', v: 'm', o: 1, on: layer === l.id, html: `<b>${l.ja}</b><span>${l.sub}</span>`});
      });
      // the parts on the board: the gate, the link (its method is not published), the CPU
      const q = SPEC.punt.queues.find((x) => x.id === (look.scene === 'ttl' ? 3 : 5));
      const pg = scr(project, [GATE_X, PY + 2, L.asic.z + 24]);
      if (pg && look.scene !== 'storm') out.push({kind: 'lbl', x: pg[0], y: pg[1] + 6, h: 'c', v: 't', o: 1, on: layer === 'copp', html: `<b>CoPP ポリサー</b><span>キュー${q.id}・上限 ${fmt(q.pps)} pps</span>`});
      const pl = scr(project, [58, PY, L.asic.z + 12]);
      if (pl) out.push({kind: 'lbl', x: pl[0], y: pl[1] + 6, h: 'c', v: 't', o: 1, html: `<b>ASIC → CPU の配線</b><span>方式は非公表</span>`});
      const pc = scr(project, [L.cpu.x + 22, PY + 3, L.cpu.z + 22]);
      if (pc) out.push({kind: 'lbl', x: pc[0], y: pc[1] + 6, h: 'c', v: 't', o: 1, html: `<b>x86 CPU</b><span>約 ${fmt(SPEC.punt.cpuTotalPps)} pps まで</span>`});
      if (look.scene === 'storm' && pk) {
        const pu = look.punt;
        const p = scr(project, [GATE_X, PY + 16, L.asic.z - 10]);
        const pd = scr(project, [GATE_X - 18, PY + 2, L.asic.z + 14]);
        if (pd && pu) out.push({kind: 'chip', x: pd[0], y: pd[1] + 8, h: 'c', v: 't', o: 1, html: `ここで止める ${fmt(pu.dropPps)} pps`});
        if (p && pu) out.push({kind: 'card', x: p[0], y: p[1] - 16, h: 'c', v: 'b', o: 1, html: `<b>CoPP（キュー5）</b><div><i>到着</i>${fmt(pu.offeredPps)} pps</div><div><i>通過</i>${fmt(pu.passPps)} pps</div><div><i>捨て</i><em>${fmt(pu.dropPps)} pps</em></div><div class="nt">1 粒 = 1,000 個</div>`});
      }
      if (pk && pk.phase !== 'asic' && look.scene !== 'storm') {
        const p = scr(project, puntPos(pk));
        const down = pk.phase === 'inject' || (pk.phase === 'cpu' && pk.cpuDir < 0);
        const name = look.scene === 'ttl' ? (down ? 'ICMP 時間超過' : `${pk.real.bytes} B・TTL 1`) : down ? 'ARP 応答' : 'ARP 要求';
        if (p) out.push({kind: 'chip', x: p[0] - 12, y: p[1], h: 'l', v: 'm', o: 1, html: name});
      }
    }
    // 6: the queues' names
    if ((look.queueK ?? 0) > 0.6 && pk && pk.phase === 'queue') {
      const qq = pk.real;
      const p0 = scr(project, [QCOL.x[0] - QCOL.s / 2, QCOL.y0 + QCOL.h * 0.75, QCOL.z]);
      const p1 = scr(project, [QCOL.x[1] + QCOL.s / 2, QCOL.y0 + QCOL.h * 0.45, QCOL.z]);
      if (p0) out.push({kind: 'lbl', x: p0[0] - 10, y: p0[1], h: 'l', v: 'm', o: 1, html: `<b>Q0</b><span>優先・制御用　空き</span>`});
      if (p1) out.push({kind: 'lbl', x: p1[0] + 34, y: p1[1], h: 'r', v: 'm', o: 1, on: qq.full, html: `<b>Q1　${fmt(qq.bytes)} B</b><span>上限 ${fmt(qq.limit)} B・倍率 ${qq.mult}</span>`});
      const pt = scr(project, [QCOL.x[0], QCOL.y0 + QCOL.h + 4, Q_TOP[2]]);
      if (pt) out.push({kind: 'lbl', x: pt[0] - 30, y: pt[1] - 10, h: 'c', v: 'b', o: 1, html: '<b>Gi1/0/3 の出口キュー</b><span>ASIC の中にある</span>'});
      if (qq.full) {
        const pd = scr(project, [Q_TOP[0] + 14, Q_TOP[1] + 6, Q_TOP[2]]);
        if (pd) out.push({kind: 'chip', x: pd[0] + 12, y: pd[1], h: 'r', v: 'b', o: 1, html: `末尾で捨て ${fmt(qq.droppedFrames)} 個`});
      }
    }
    return out;
  };
  // anchors for the callouts with leaders (chassis.anchor reads them)
  const pinA = (key, p) => (chassis.anchors[key] = {obj: root, p: new V3(...p)});
  pinA('gate', [GATE_X, PY + 14.2, L.asic.z + 6]);
  pinA('link', [62, PY + 0.4, L.asic.z]);
  pinA('cpuTop', [L.cpu.x - 30, PY + 4.6, L.cpu.z + 16]);
  pinA('asicQ', [L.asic.x - 18, PY + 1.4, L.asic.z + 18]);
  return {root, update, overlay, board};
}
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const egressOf = (pk) => ['pbc-rwe', 'efc-peek', 'efc-lookup', 'rwe', 'out'].includes(pk.stageId);
