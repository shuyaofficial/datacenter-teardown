// TPU tray 9, the one that slides out (chapter 2), in tray-local millimetres: x across, y up from the tray's floor, z
// front (+500) to back (-500). One board with 4 Ironwood packages in a row (出典2 22枚目: 横1列), each with 2 compute dies
// and 8 HBM stacks; a cold plate on every package and a small one on its voltage regulator, fed in parallel from a supply
// header with a valve on every branch and drained into a return header (出典2: 並列・弁で流量); at the front edge the
// I/O panel with 18 OSFP cages (16 on the top side, 2 under: 出典2); under the board one PCIe Gen5 x16 per chip to the
// host tray below (出典2 14・22枚目). Layers that lift in the exploded view (flow.js TL.lift): 天板, コールドプレート,
// チップ, 前の I/O パネル. update(look) poses it; nothing here keeps time.
import * as THREE from 'three';
import {TL, TRAY, trayX, trayY} from './flow.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);

export function buildTray(K) {
  const {mk, metal, bx, inst, tint, fade} = K;
  const root = new THREE.Group();
  const G = {base: new THREE.Group(), lid: new THREE.Group(), plates: new THREE.Group(), chips: new THREE.Group(), io: new THREE.Group()};
  root.add(G.base, G.lid, G.plates, G.chips, G.io);
  const M = {
    tray: mk('tpu', metal('#767a81', 0.55, 0.4)),
    face: mk('tpuFace', metal('#878b92', 0.5, 0.4)),
    lid: mk('trayLid', metal('#80848a', 0.55, 0.4)),
    cage: mk('tpu', metal('#9ba1a8', 0.42, 0.65)),
    cage1: mk('tray1', metal('#9ba1a8', 0.42, 0.65)),
    mouth: mk('tpu', {color: '#1f2124', roughness: 0.85}),
    handle: mk('tpu', {color: '#2a2c30', roughness: 0.6}),
    pcb: mk('board', {color: '#55685c', roughness: 0.72}),
    sub: mk('chip', {color: '#5d6859', roughness: 0.65}),
    die: mk('chip', metal('#7d838b', 0.4, 0.7)),
    chip1: mk('tray1', metal('#7d838b', 0.4, 0.7)),
    hbm: mk('chip', {color: '#2c2e32', roughness: 0.6}),
    vr: mk('chip', {color: '#3a3d42', roughness: 0.6}),
    plate: mk('plate', metal('#a39888', 0.45, 0.6)),
    tube: mk('plate', {color: '#3b3d41', roughness: 0.55}),
    valve: mk('plate', metal('#8f959b', 0.45, 0.6)),
    pcie: mk('pcie', {color: '#2e3034', roughness: 0.7}),
    qd: mk('cool', metal('#a9aeb4', 0.4, 0.7)),
  };
  const B = G.base;
  const W2 = TRAY.w / 2;
  const ZF = TL.frontZ;
  const ZB = TL.backZ;
  const H = TRAY.h;

  // ------------------------------------------------------------ the pan, the side and back walls, the board, PCIe under it
  bx(B, M.tray, [-W2, W2], [0, 2], [ZB, ZF - 6]);
  for (const sx of [-1, 1]) bx(B, M.tray, sx > 0 ? [W2 - 2, W2] : [-W2, -W2 + 2], [0, H - 4], [ZB, ZF - 6]);
  bx(B, M.tray, [-W2, W2], [0, H - 4], [ZB, ZB + 2]);
  bx(B, M.pcb, [-W2 + 14, W2 - 14], [TL.board.y0, TL.board.y1], [TL.board.z0, TL.board.z1]);
  for (const x of TL.chipX) {
    bx(B, M.pcie, [x - 20, x + 20], [4, TL.board.y0], [TL.pcieZ - 15, TL.pcieZ + 15]);
    // the PCIe cable leaves through the back wall to the host tray
    bx(B, M.pcie, [x - 6, x + 6], [6, 12], [ZB - 20, TL.pcieZ - 15]);
  }
  const qq = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  inst(B, M.qd, TL.qdX.map((x) => ({p: [x, 40, ZB - 8], s: [9, 18, 9], q: qq})), CYL);
  // the voltage regulators behind every package
  for (const x of TL.chipX) bx(B, M.vr, [x - 36, x + 36], [TL.board.y1, TL.board.y1 + 6], [TL.vrZ - 10, TL.vrZ + 10]);

  // ------------------------------------------------------------ chips: 4 packages, 2 dies and 8 HBM stacks each
  const C0 = G.chips;
  const hb = [];
  TL.chipX.forEach((x, i) => {
    const s = TL.pkg;
    bx(C0, M.sub, [x - s / 2, x + s / 2], [TL.board.y1, TL.board.y1 + 3], [TL.chipZ - s / 2, TL.chipZ + s / 2]);
    for (const d of [-1, 1]) bx(C0, i === 0 ? M.chip1 : M.die, [x + d * 17 - 14, x + d * 17 + 14], [TL.board.y1 + 3, TL.chipY], [TL.chipZ - 28, TL.chipZ + 28]);
    for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) hb.push({p: [x + sx * 40, TL.chipY - 2.5, TL.chipZ - 30 + j * 20], s: [10, 5, 15]});
  });
  inst(C0, M.hbm, hb);

  // ------------------------------------------------------------ cold plates, the parallel tubes with a valve each
  const P = G.plates;
  TL.chipX.forEach((x) => {
    bx(P, M.plate, [x - 46, x + 46], [TL.chipY, TL.plateY], [TL.chipZ - 46, TL.chipZ + 46]);
    bx(P, M.plate, [x - 36, x + 36], [TL.board.y1 + 6, TL.board.y1 + 10], [TL.vrZ - 10, TL.vrZ + 10]);
  });
  const tubes = [];
  const tube = (a, b, r = 3.2) => {
    const d = new V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    tubes.push({p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: [r, len + r, r], q});
  };
  const y = TL.plateY + 3;
  const [hs, hr] = TL.hdrZ;
  // supply: quick-connect → header → a branch down every package (a valve on each); return: the other way round
  tube([TL.qdX[0], y, ZB + 6], [TL.qdX[0], y, hs]);
  tube([TL.qdX[0], y, hs], [TL.chipX[3] - 14, y, hs]);
  // the return runs 9 mm higher so it crosses over the supply header
  const y2 = y + 9;
  tube([TL.qdX[1], y2, ZB + 6], [TL.qdX[1], y2, hr]);
  tube([TL.qdX[1], y2, hr], [TL.chipX[3] + 14, y2, hr]);
  const valves = [];
  for (const x of TL.chipX) {
    tube([x - 14, y, hs], [x - 14, y, TL.chipZ - 20]);
    tube([x + 14, y2, hr], [x + 14, y2, TL.chipZ - 20]);
    tube([x + 14, y2, TL.chipZ - 20], [x + 14, y, TL.chipZ - 20]);
    valves.push({p: [x - 14, y, (hs + TL.chipZ) / 2 - 20], s: [14, 12, 18]});
  }
  inst(P, M.tube, tubes, CYL);
  inst(P, M.valve, valves);

  // ------------------------------------------------------------ the front I/O panel: face, 16 + 2 OSFP cages, handles
  const IO = G.io;
  bx(IO, M.face, [-W2 - 2, W2 + 2], [0, 2], [ZF - 4, ZF]);
  bx(IO, M.face, [-W2 - 2, W2 + 2], [48, H], [ZF - 4, ZF]);
  for (const sx of [-1, 1]) bx(IO, M.face, sx > 0 ? [W2 - 6, W2 + 2] : [-W2 - 2, -W2 + 6], [2, 48], [ZF - 4, ZF]);
  TL.osfpX.forEach((x, i) => {
    bx(IO, i === 0 ? M.cage1 : M.cage, [x - 12, x + 12], [TL.board.y1, TL.board.y1 + 22], [TL.osfpZ[0], TL.osfpZ[1]]);
    bx(IO, M.mouth, [x - 9, x + 9], [TL.board.y1 + 5, TL.board.y1 + 17], [TL.osfpZ[1], TL.osfpZ[1] + 0.8], false);
  });
  for (const x of TL.osfpBotX) bx(IO, M.cage, [x - 12, x + 12], [3, TL.board.y0 - 1], [TL.osfpZ[0], TL.osfpZ[1]]);
  for (const x of [-238, 238]) bx(IO, M.handle, [x - 4, x + 4], [48, 84], [ZF, ZF + 12]);

  // ------------------------------------------------------------ the lid
  bx(G.lid, M.lid, [-W2, W2], [H - 4, H], [ZB, ZF - 4]);

  // ------------------------------------------------------------ anchors (tray-local; they ride with the layers)
  const anchors = {};
  const pin = (key, obj, x, yy, z) => (anchors[key] = {obj, p: new V3(x, yy, z)});
  pin('chip', C0, TL.chipX[1] + 17, TL.chipY, TL.chipZ + 10);
  pin('chip1', C0, TL.chipX[0], TL.chipY, TL.chipZ);
  pin('hbm', C0, TL.chipX[2] + 40, TL.chipY, TL.chipZ + 20);
  pin('plate', P, TL.chipX[3] - 20, TL.plateY, TL.chipZ + 20);
  pin('valve', P, TL.chipX[2] - 14, y + 6, (hs + TL.chipZ) / 2 - 20);
  pin('osfp', IO, TL.osfpX[11], TL.board.y1 + 22, TL.osfpZ[1]);
  pin('pcie', B, TL.chipX[3] - 20, TL.board.y0, TL.pcieZ - 15);
  pin('board', B, -W2 + 40, TL.board.y1, TL.board.z1 - 120);
  pin('lid', G.lid, 120, H, -160);
  pin('qdTray', B, TL.qdX[0], 49, ZB - 8);

  const n = SPEC.demo.pullTray;
  /** look: {lifts: [pull, lid, plates, chips, io], hiTray: {chip1, osfp1, face} weights, hi: {plate}} */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0, 0];
    root.position.set(trayX(n), trayY(n), TRAY.zc + L[0] * TRAY.pull);
    G.lid.position.y = TL.lift.lid * L[1];
    G.plates.position.y = TL.lift.plates * L[2];
    G.chips.position.y = TL.lift.chips * L[3];
    G.io.position.y = TL.lift.io * L[4];
    // the lifted lid turns see-through so the layers under it read from above
    fade(M.lid, 1 - 0.62 * Math.min(1, L[1] * 1.4));
    const h = look.hiTray ?? {};
    tint(M.chip1, h.chip1 ?? 0);
    tint(M.cage1, h.osfp1 ?? 0);
    tint(M.face, h.face ?? 0);
    tint(M.lid, h.face ?? 0);
    const hi = look.hi ?? {};
    tint(M.plate, hi.plate ?? 0);
    tint(M.tube, (hi.plate ?? 0) * 0.6);
  };
  return {root, update, anchors, G, M};
}
