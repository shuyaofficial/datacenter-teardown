// Compute tray 3, the one that slides out (chapters 2 and 5), in tray-local millimetres: x across, y up from the tray's
// floor, z front (+450) to back (-450). Two GB200 superchip boards side by side (one Grace and two B200 on each), a cold
// plate on every Grace and B200 with thin tubes to the quick-connects at the back, 4 ConnectX-7 behind the 4 OSFP cages,
// 2 BlueField-3, 4 E1.S drives in the front slots, a row of small fans for the air-cooled parts, and at the back the 4
// NVLink connectors, the 2 liquid quick-connects and the bus-bar clip. Layers that lift in the exploded view (flow.js
// TL.lift): 天板, コールドプレート, チップ, カード. update(look) poses it; nothing here keeps time.
import * as THREE from 'three';
import {computeY, TL, TRAY} from './flow.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14);

export function buildTray(K) {
  const {mk, metal, bx, inst, tint, fade} = K;
  const root = new THREE.Group();
  const G = {base: new THREE.Group(), lid: new THREE.Group(), plates: new THREE.Group(), chips: new THREE.Group(), io: new THREE.Group()};
  root.add(G.base, G.lid, G.plates, G.chips, G.io);
  const M = {
    tray: mk('compute', metal('#757980', 0.55, 0.4)),
    face: mk('compute', metal('#8a8e95', 0.5, 0.4)),
    lid: mk('trayLid', metal('#80848a', 0.55, 0.4)),
    cage: mk('compute', metal('#9aa0a7', 0.42, 0.65)),
    cage1: mk('tray1', metal('#9aa0a7', 0.42, 0.65)),
    mouth: mk('compute', {color: '#1f2124', roughness: 0.85}),
    handle: mk('compute', {color: '#2a2c30', roughness: 0.6}),
    pcb: mk('board', {color: '#56695d', roughness: 0.72}),
    pcb2: mk('board', {color: '#4f6357', roughness: 0.72}),
    sub: mk('chip', {color: '#5f6a5b', roughness: 0.65}),
    die: mk('chip', metal('#7d838b', 0.4, 0.7)),
    gpu1: mk('tray1', metal('#7d838b', 0.4, 0.7)),
    hbm: mk('chip', {color: '#2c2e32', roughness: 0.6}),
    grace: mk('chip', metal('#868b92', 0.4, 0.7)),
    lpddr: mk('chip', {color: '#30333a', roughness: 0.6}),
    plate: mk('plate', metal('#a6998a', 0.45, 0.6)),
    tube: mk('plate', {color: '#3b3d41', roughness: 0.55}),
    card: mk('io', {color: '#4d6155', roughness: 0.7}),
    cx1: mk('tray1', {color: '#4d6155', roughness: 0.7}),
    nic: mk('io', metal('#8a9097', 0.45, 0.55)),
    drive: mk('io', metal('#8b9097', 0.5, 0.5)),
    fan: mk('fan', {color: '#34373c', roughness: 0.65}),
    conn: mk('conn', {color: '#2e3034', roughness: 0.7}),
    qd: mk('cool', metal('#a9aeb4', 0.4, 0.7)),
    clip: mk('bus', metal('#8f7a63', 0.45, 0.6)),
  };
  const B = G.base;
  const W2 = TRAY.w / 2;
  const ZF = TL.frontZ;
  const ZB = TL.backZ;
  const H = TRAY.h;

  // ------------------------------------------------------------ the pan, walls, front panel (same as the rack's instanced trays)
  bx(B, M.tray, [-W2, W2], [0, 2], [ZB, ZF]);
  for (const sx of [-1, 1]) bx(B, M.tray, sx > 0 ? [W2 - 2, W2] : [-W2, -W2 + 2], [0, H - 2], [ZB, ZF]);
  bx(B, M.tray, [-W2, W2], [0, H - 2], [ZB, ZB + 2]);
  bx(B, M.face, [-W2 - 3, W2 + 3], [0, H], [ZF - 1, ZF + 2]);
  TL.cx7X.forEach((x, i) => {
    bx(B, i === 0 ? M.cage1 : M.cage, [x - 15, x + 15], [12, 30], [ZF - 60, ZF + 5]);
    bx(B, M.mouth, [x - 12, x + 12], [15.5, 26.5], [ZF + 4.6, ZF + 5.4], false);
  });
  for (const x of TL.bf3X) for (const d of [-11, 11]) bx(B, M.mouth, [x + d - 8.5, x + d + 8.5], [16, 26], [ZF + 1.6, ZF + 2.4], false);
  for (const x of [-213, 213]) bx(B, M.handle, [x - 4, x + 4], [6, 36], [ZF + 1, ZF + 11]);
  // two superchip boards
  TL.graceX.forEach((cx, b) => bx(B, b ? M.pcb2 : M.pcb, [cx - TL.board.w / 2, cx + TL.board.w / 2], [2, TL.board.y], [TL.board.z0, TL.board.z1]));
  // a riser board for the NICs at the front
  bx(B, M.pcb2, [-205, 70], [2, 5], [260, 395]);
  // the row of small fans (air for the NICs and the drives)
  const fans = [];
  for (const x of TL.fanX) {
    fans.push({p: [x, 20, TL.fanZ], s: [40, 36, 26]});
  }
  inst(B, M.fan, fans);
  // the back: NVLink connectors, quick-connects, the bus clip
  for (const x of TL.nvlX) bx(B, M.conn, [x - 23, x + 23], [6, 36], [ZB - 28, ZB]);
  const qq = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  inst(B, M.qd, TL.qdX.map((x) => ({p: [x, 21, ZB - 12], s: [9, 24, 9], q: qq})), CYL);
  bx(B, M.clip, [-21, 5], [9, 33], [ZB - 60, ZB]);

  // ------------------------------------------------------------ chips: 2 Grace (with LPDDR5X), 4 B200 (with HBM stacks)
  const C0 = G.chips;
  TL.gpuX.forEach((x, i) => {
    const s = TL.gpuS;
    bx(C0, M.sub, [x - s / 2, x + s / 2], [TL.board.y, TL.board.y + 1.6], [TL.gpuZ - s / 2, TL.gpuZ + s / 2]);
    bx(C0, i === 0 ? M.gpu1 : M.die, [x - 22, x + 22], [TL.board.y + 1.6, TL.chipY], [TL.gpuZ - 28, TL.gpuZ + 28]);
    const hb = [];
    for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) hb.push({p: [x + sx * 30, TL.chipY - 1.2, TL.gpuZ - 24 + j * 16], s: [9, 2.4, 13]});
    inst(C0, M.hbm, hb);
  });
  TL.graceX.forEach((x) => {
    const s = TL.graceS;
    bx(C0, M.sub, [x - s / 2, x + s / 2], [TL.board.y, TL.board.y + 1.4], [TL.graceZ - s / 2, TL.graceZ + s / 2]);
    bx(C0, M.grace, [x - 18, x + 18], [TL.board.y + 1.4, TL.chipY - 0.6], [TL.graceZ - 18, TL.graceZ + 18]);
    const lp = [];
    for (let j = 0; j < 8; j++) lp.push({p: [x - 42 + (j % 4) * 28, TL.board.y + 1, TL.graceZ + (j < 4 ? -50 : 50)], s: [20, 2, 14]});
    inst(C0, M.lpddr, lp);
  });

  // ------------------------------------------------------------ cold plates and their tubes
  const P = G.plates;
  const pl = (x, z, s) => bx(P, M.plate, [x - s / 2, x + s / 2], [TL.chipY, TL.plateY], [z - s / 2, z + s / 2]);
  TL.gpuX.forEach((x) => pl(x, TL.gpuZ, 64));
  TL.graceX.forEach((x) => pl(x, TL.graceZ, 46));
  TL.cx7X.forEach((x) => bx(P, M.plate, [x - 12, x + 12], [16, 21], [TL.cx7Z - 20, TL.cx7Z + 20]));
  // tubes: from the supply quick-connect along the back, over the plates, back to the return
  const tubes = [];
  const tube = (a, b) => {
    const d = new V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = d.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), d.normalize());
    tubes.push({p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], s: [3.2, len, 3.2], q});
  };
  const y = TL.plateY + 3;
  const loop = [
    [TL.qdX[0], y, ZB + 6],
    [TL.qdX[0], y, TL.gpuZ - 70],
    [TL.gpuX[0], y, TL.gpuZ - 70],
    [TL.gpuX[0], y, TL.gpuZ],
    [TL.gpuX[1], y, TL.gpuZ],
    [TL.graceX[0], y, TL.graceZ],
    [TL.graceX[1], y, TL.graceZ],
    [TL.gpuX[2], y, TL.gpuZ],
    [TL.gpuX[3], y, TL.gpuZ],
    [TL.gpuX[3], y, TL.gpuZ - 70],
    [TL.qdX[1], y, TL.gpuZ - 70],
    [TL.qdX[1], y, ZB + 6],
  ];
  loop.slice(1).forEach((p, i) => tube(loop[i], p));
  // a branch to the ConnectX-7 plates
  tube([TL.graceX[0], y, TL.graceZ], [TL.graceX[0], y, TL.cx7Z]);
  tube([TL.graceX[0], y, TL.cx7Z], [TL.cx7X[0], y, TL.cx7Z]);
  inst(P, M.tube, tubes, CYL);

  // ------------------------------------------------------------ cards: ConnectX-7 × 4, BlueField-3 × 2, E1.S × 4
  const IO = G.io;
  TL.cx7X.forEach((x, i) => bx(IO, i === 0 ? M.cx1 : M.card, [x - 16, x + 16], [5, 7], [TL.cx7Z - 40, TL.cx7Z + 64]));
  TL.cx7X.forEach((x) => bx(IO, M.nic, [x - 10, x + 10], [7, 13], [TL.cx7Z - 16, TL.cx7Z + 16]));
  TL.bf3X.forEach((x) => {
    bx(IO, M.card, [x - 22, x + 22], [5, 7], [TL.bf3Z - 55, TL.bf3Z + 74]);
    bx(IO, M.nic, [x - 13, x + 13], [7, 15], [TL.bf3Z - 20, TL.bf3Z + 10]);
  });
  TL.e1sX.forEach((x, i) => bx(IO, M.drive, [x - 12, x + 12], [3, 39], [ZF - 150, ZF + 1.4 + (i % 2) * 0.01]));

  // ------------------------------------------------------------ the lid
  bx(G.lid, M.lid, [-W2, W2], [H - 2, H], [ZB, ZF - 2]);

  // ------------------------------------------------------------ anchors (tray-local; they ride with the layers)
  const anchors = {};
  const pin = (key, obj, x, yy, z) => (anchors[key] = {obj, p: new V3(x, yy, z)});
  pin('gpu', C0, TL.gpuX[1] + 12, TL.chipY, TL.gpuZ + 26);
  pin('gpu1', C0, TL.gpuX[0], TL.chipY, TL.gpuZ);
  pin('grace', C0, TL.graceX[1] - 10, TL.chipY - 0.6, TL.graceZ + 8);
  pin('plate', P, TL.gpuX[3] - 20, TL.plateY, TL.gpuZ - 20);
  pin('cx7', IO, TL.cx7X[2], 13, TL.cx7Z);
  pin('cx71', IO, TL.cx7X[0], 13, TL.cx7Z);
  pin('bf3', IO, TL.bf3X[1], 15, TL.bf3Z);
  pin('e1s', IO, TL.e1sX[2], 39, ZF - 70);
  pin('lid', G.lid, 120, H, -120);
  pin('fans', B, TL.fanX[6], 38, TL.fanZ);
  pin('osfp1', B, TL.cx7X[0], 30, ZF + 5);
  pin('nvlBack', B, TL.nvlX[0], 36, ZB - 28);
  pin('trayBoard', B, TL.graceX[0] - 60, TL.board.y, TL.board.z0 + 60);

  const yT = computeY(SPEC.demo.pullTray);
  /**
   * look: {lifts: [pull, lid, plates, chips, io], lidAway 0..1, hiTray: {gpu1, cx71, osfp1} weights, hi: {plate, ...}}
   */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0, 0];
    root.position.set(0, yT, TRAY.zc + L[0] * TRAY.pull);
    G.lid.position.y = TL.lift.lid * L[1];
    G.plates.position.y = TL.lift.plates * L[2];
    G.chips.position.y = TL.lift.chips * L[3];
    G.io.position.y = TL.lift.io * L[4];
    // the lifted lid turns see-through so the layers under it read from above; away (chapter 5) takes it out
    const away = look.lidAway ?? 0;
    fade(M.lid, (1 - 0.78 * Math.min(1, L[1] * 1.4)) * (1 - Math.min(1, away * 1.4)));
    G.lid.visible = away < 0.7;
    G.lid.position.y += 200 * away;
    const h = look.hiTray ?? {};
    tint(M.gpu1, h.gpu1 ?? 0);
    tint(M.cx1, h.cx71 ?? 0);
    tint(M.cage1, h.osfp1 ?? 0);
    const hi = look.hi ?? {};
    tint(M.plate, hi.plate ?? 0);
    tint(M.tube, (hi.plate ?? 0) * 0.6);
  };
  return {root, update, anchors, G, M};
}
