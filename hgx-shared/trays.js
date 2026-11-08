// The two trays of the DGX B200, in the chassis's millimetres (x across, y up from the floor, z front + to back -).
//   GPU tray: the HGX B200 board with 8 B200 (2 columns x 4, each under a tall air-cooled heatsink) and the 2 NVSwitch
//     chips between the columns (smaller heatsinks), and the lid over them. Layers that lift: 天板, ヒートシンク.
//   Motherboard tray: 2 Xeon under heatsinks with 16 DIMMs each (8 on each side), 8 ConnectX-7 boards behind the 4 OSFP
//     cages, 2 BlueField-3, 2 M.2 and an air baffle over the CPUs; it slides out of the back. Layers that lift: エアバッフル,
//     CPU のヒートシンク.
// The same shapes repeat (8 heatsinks of fins, 32 DIMMs), so they are instanced. update(look) poses both; nothing here
// keeps time.
import * as THREE from 'three';
import {dimmXs, GT, gpuXZ, MB, ML, nicOf} from './flow.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;

/** a heatsink's fins as instances: [{p, s}] standing on y0, fins along x */
const fins = (cx, cz, w, d, y0, y1, n, t = 1.6) => Array.from({length: n}, (_, i) => ({p: [cx - w / 2 + (w / (n - 1)) * i * 0.985 + 1, (y0 + y1) / 2, cz], s: [t, y1 - y0, d]}));

export function buildGpuTray(K) {
  const {mk, metal, bx, inst} = K;
  const root = new THREE.Group();
  const G = {base: new THREE.Group(), lid: new THREE.Group(), sinks: new THREE.Group()};
  root.add(G.base, G.lid, G.sinks);
  const M = {
    board: mk('board', {color: '#55685c', roughness: 0.72}),
    sub: mk('chip', {color: '#5f6a5b', roughness: 0.65}),
    hbm: mk('chip', {color: '#2c2e32', roughness: 0.6}),
    gpu: Array.from({length: SPEC.gpus}, () => mk('gpu', metal('#7d838b', 0.4, 0.7))),
    nvs: Array.from({length: SPEC.nvlink.switches}, () => mk('nvs', metal('#6f7a6c', 0.45, 0.55))),
    sinkBase: mk('sink', metal('#a7adb3', 0.45, 0.6)),
    fin: mk('sink', metal('#b7bcc1', 0.48, 0.55)),
    lid: mk('lid', metal('#80848a', 0.55, 0.4)),
    conn: mk('conn', {color: '#2e3034', roughness: 0.7}),
  };
  const B = G.base;
  const {board} = GT;
  bx(B, M.board, board.x, board.y, board.z);
  // the board's edge connectors toward the midplane, and the power blocks
  bx(B, M.conn, [-180, 180], [board.y[1], board.y[1] + 10], [board.z[1] - 18, board.z[1] - 4]);
  const hb = [];
  for (let g = 0; g < SPEC.gpus; g++) {
    const [x, z] = gpuXZ(g);
    const h = GT.pkg / 2;
    bx(B, M.sub, [x - h, x + h], [board.y[1], board.y[1] + 1.5], [z - h, z + h]);
    bx(B, M.gpu[g], [x - GT.die / 2, x + GT.die / 2], [board.y[1] + 1.5, GT.sink.y[0]], [z - GT.die / 2, z + GT.die / 2]);
    for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) hb.push({p: [x + sx * 28, board.y[1] + 2.2, z - 24 + j * 16], s: [9, 1.6, 13]});
  }
  inst(B, M.hbm, hb);
  GT.nvsZ.forEach((z, c) => {
    const s = GT.nvsS;
    bx(B, M.sub, [GT.nvsX - s / 2 - 6, GT.nvsX + s / 2 + 6], [board.y[1], board.y[1] + 1.5], [z - s / 2 - 6, z + s / 2 + 6]);
    bx(B, M.nvs[c], [GT.nvsX - s / 2, GT.nvsX + s / 2], [board.y[1] + 1.5, GT.nvsSink.y[0]], [z - s / 2, z + s / 2]);
  });

  // ------------------------------------------------------------ heatsinks (they lift and turn see-through)
  const S = G.sinks;
  const base = [];
  let fl = [];
  for (let g = 0; g < SPEC.gpus; g++) {
    const [x, z] = gpuXZ(g);
    const y0 = GT.sink.y[0];
    base.push({p: [x, y0 + 4, z], s: [GT.sink.w, 8, GT.sink.d], c: 0.95 + 0.06 * ((g * 7) % 3)});
    fl = fl.concat(fins(x, z, GT.sink.w - 4, GT.sink.d - 6, y0 + 8, GT.sink.y[1], 22));
  }
  GT.nvsZ.forEach((z) => {
    base.push({p: [GT.nvsX, GT.nvsSink.y[0] + 3, z], s: [GT.nvsSink.s, 6, GT.nvsSink.s]});
    fl = fl.concat(fins(GT.nvsX, z, GT.nvsSink.s - 4, GT.nvsSink.s - 4, GT.nvsSink.y[0] + 6, GT.nvsSink.y[1], 9));
  });
  inst(S, M.sinkBase, base);
  inst(S, M.fin, fl);

  // ------------------------------------------------------------ the lid
  bx(G.lid, M.lid, [-219, 219], GT.lid.y, GT.lid.z);

  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  const [g1x, g1z] = gpuXZ(3);
  pin('gpu', B, g1x, board.y[1] + 4, g1z);
  pin('gpuSink', S, gpuXZ(6)[0], GT.sink.y[1], gpuXZ(6)[1]);
  pin('nvs', B, GT.nvsX, board.y[1] + 4, GT.nvsZ[1]);
  pin('lid', G.lid, 120, GT.lid.y[1], -200);
  pin('board', B, 200, board.y[1], 330);

  /** look: {lifts: [pull, lid, sinks, ...], lidAway 0..1, ghost 0..1, hiGpu: {g: w}, hiNvs: {c: w}} */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0, 0];
    G.lid.position.y = GT.lift.lid * L[1];
    G.sinks.position.y = GT.lift.sinks * L[2];
    const away = look.lidAway ?? 0;
    K.fade(M.lid, (1 - 0.78 * Math.min(1, L[1] * 1.4)) * (1 - Math.min(1, away * 1.4)));
    G.lid.visible = away < 0.7;
    G.lid.position.y += 200 * away;
    const ghost = look.ghost ?? 0;
    // lifted (chapter 2): see-through; chapter 3: taken off so the packages show
    const sinkO = Math.min(1 - 0.55 * Math.min(1, L[2] * 1.4), 1 - Math.min(1, ghost * 1.25));
    K.fade(M.sinkBase, sinkO);
    K.fade(M.fin, sinkO);
    G.sinks.visible = sinkO > 0.02;
    G.sinks.position.y += 260 * ghost;
    const hg = look.hiGpu ?? {};
    M.gpu.forEach((m, g) => K.tint(m, hg[g] ?? 0));
    const hn = look.hiNvs ?? {};
    M.nvs.forEach((m, c) => K.tint(m, hn[c] ?? 0));
  };
  return {root, G, M, update, anchors};
}

export function buildMbTray(K) {
  const {mk, metal, bx, inst} = K;
  const root = new THREE.Group();
  const G = {base: new THREE.Group(), baffle: new THREE.Group(), cpuSinks: new THREE.Group()};
  root.add(G.base, G.baffle, G.cpuSinks);
  const M = {
    pan: mk('mb', metal('#757980', 0.55, 0.4)),
    panel: mk('mb', metal('#8a8e95', 0.5, 0.4)),
    board: mk('board', {color: '#4f6357', roughness: 0.72}),
    sock: mk('chip', {color: '#3a3d42', roughness: 0.6}),
    ihs: mk('cpu', metal('#9aa0a6', 0.4, 0.7)),
    sinkBase: mk('cpuSink', metal('#a7adb3', 0.45, 0.6)),
    fin: mk('cpuSink', metal('#b7bcc1', 0.48, 0.55)),
    dimm: mk('dimm', {color: '#3f4a44', roughness: 0.65}),
    dimmChip: mk('dimm', {color: '#26282c', roughness: 0.6}),
    card: mk('io', {color: '#4d6155', roughness: 0.7}),
    card0: mk('nic0', {color: '#4d6155', roughness: 0.7}),
    nic: mk('io', metal('#8a9097', 0.45, 0.55)),
    bf3: mk('io', {color: '#46594e', roughness: 0.7}),
    m2: mk('io', {color: '#2f3236', roughness: 0.6}),
    cage: mk('osfp', metal('#9aa0a7', 0.42, 0.65)),
    cage4: mk('osfp4', metal('#9aa0a7', 0.42, 0.65)),
    mouth: mk('osfp', {color: '#1f2124', roughness: 0.85}),
    handle: mk('mb', {color: '#2a2c30', roughness: 0.6}),
    baffle: mk('baffle', {color: '#3a3d41', roughness: 0.8}),
    conn: mk('conn', {color: '#2e3034', roughness: 0.7}),
  };
  const B = G.base;
  const [x0, x1] = MB.x;
  const [zb, zf] = MB.z;
  const y0 = MB.y[0];
  bx(B, M.pan, [x0, x1], [y0, y0 + 2], [zb, zf]);
  for (const sx of [-1, 1]) bx(B, M.pan, sx > 0 ? [x1 - 2, x1] : [x0, x0 + 2], [y0, 44], [zb, zf]);
  bx(B, M.board, [x0 + 4, x1 - 4], [y0 + 2, y0 + 4], [zb + 6, zf - 4]);
  // the connectors into the midplane at the front of the tray
  bx(B, M.conn, [-170, 170], [y0 + 4, 64], [zf - 10, zf]);
  // the back panel: OSFP cages, BlueField-3 ports, management ports, the handle
  bx(B, M.panel, [x0, x1], MB.y, [zb, zb + 3]);
  ML.osfpX.forEach((x, i) => {
    bx(B, i === 3 ? M.cage4 : M.cage, [x - 21, x + 21], ML.osfpY, [zb - 3, zb + 50]);
    for (const p of ['P1', 'P2']) bx(B, M.mouth, [x - 15, x + 15], [ML.portY[p] - 7, ML.portY[p] + 7], [zb - 3.6, zb - 3]);
  });
  for (const x of ML.bf3X) for (const d of [-12, 12]) bx(B, M.mouth, [x + d - 9, x + d + 9], [64, 76], [zb - 1.2, zb]);
  for (const x of ML.mgmtX) bx(B, M.mouth, [x - 8, x + 8], [64, 78], [zb - 1.2, zb]);
  bx(B, M.handle, [-150, 150], [108, 118], [zb - 16, zb - 8]);
  for (const x of [-150, 150]) bx(B, M.handle, [x - 6, x + 6], [104, 120], [zb - 16, zb]);
  // ConnectX-7 × 8: one board per OSFP port, behind its cage
  for (let n = 1; n <= 4; n++)
    for (const p of ['P1', 'P2']) {
      const x = ML.osfpX[n - 1];
      const z = ML.cardZ[p];
      const isG0 = nicOf(SPEC.demo.wallGpu).key === `${n}${p}`;
      bx(B, isG0 ? M.card0 : M.card, [x - ML.card.w / 2, x + ML.card.w / 2], [ML.card.y, ML.card.y + 2], [z - ML.card.d / 2, z + ML.card.d / 2]);
      bx(B, M.nic, [x - 10, x + 10], [ML.card.y + 2, ML.card.y + 9], [z - 10, z + 10]);
    }
  // BlueField-3 × 2
  for (const x of ML.bf3X) {
    bx(B, M.bf3, [x - ML.bf3.w / 2, x + ML.bf3.w / 2], [18, 20], ML.bf3.z);
    bx(B, M.nic, [x - 14, x + 14], [20, 30], [-370, -340]);
  }
  // M.2 × 2
  for (const x of ML.m2X) bx(B, M.m2, [x - 11, x + 11], [y0 + 4, y0 + 6.5], [ML.m2Z - 40, ML.m2Z + 40]);
  // Xeon × 2: socket, lid
  for (const x of ML.cpuX) {
    bx(B, M.sock, [x - 39, x + 39], [y0 + 4, 10], [ML.cpuZ - 31, ML.cpuZ + 31]);
    bx(B, M.ihs, [x - 26, x + 26], [10, ML.cpuSink.y[0]], [ML.cpuZ - 22, ML.cpuZ + 22]);
  }
  // DIMM × 32
  const dl = [];
  const dc = [];
  const dz = (ML.dimm.z[0] + ML.dimm.z[1]) / 2;
  const dd = ML.dimm.z[1] - ML.dimm.z[0];
  dimmXs().forEach((x, i) => {
    dl.push({p: [x, (ML.dimm.y[0] + ML.dimm.y[1]) / 2, dz], s: [1.4, ML.dimm.y[1] - ML.dimm.y[0], dd], c: 0.94 + 0.08 * ((i * 5) % 3) / 2});
    for (let j = 0; j < 4; j++) dc.push({p: [x, 30, dz - 48 + j * 32], s: [ML.dimm.t, 9, 14]});
  });
  inst(B, M.dimm, dl);
  inst(B, M.dimmChip, dc);

  // ------------------------------------------------------------ CPU heatsinks, the air baffle
  const sb = [];
  let fl = [];
  for (const x of ML.cpuX) {
    sb.push({p: [x, ML.cpuSink.y[0] + 4, ML.cpuZ], s: [ML.cpuSink.w, 8, ML.cpuSink.d]});
    fl = fl.concat(fins(x, ML.cpuZ, ML.cpuSink.w - 4, ML.cpuSink.d - 4, ML.cpuSink.y[0] + 8, ML.cpuSink.y[1], 16));
  }
  inst(G.cpuSinks, M.sinkBase, sb);
  inst(G.cpuSinks, M.fin, fl);
  bx(G.baffle, M.baffle, [x0 + 3, x1 - 3], ML.baffle.y, ML.baffle.z);
  for (const sx of [-1, 1]) bx(G.baffle, M.baffle, sx > 0 ? [x1 - 6, x1 - 3] : [x0 + 3, x0 + 6], [48, ML.baffle.y[1]], ML.baffle.z);

  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  pin('cpu', B, ML.cpuX[1], 14, ML.cpuZ + 10);
  pin('dimm', B, dimmXs()[3], ML.dimm.y[1], ML.dimm.z[0] + 20);
  pin('cx7', B, ML.osfpX[1], ML.card.y + 9, ML.cardZ.P1);
  pin('bf3', B, ML.bf3X[0], 30, -355);
  pin('baffle', G.baffle, 150, ML.baffle.y[1], 120);
  pin('m2', B, ML.m2X[1], y0 + 6.5, ML.m2Z);
  pin('osfp', B, ML.osfpX[1], ML.osfpY[1], zb - 3);
  pin('osfp4', B, ML.osfpX[3], ML.portY.P2, zb - 3.6);
  pin('bf3Port', B, ML.bf3X[1], 76, zb - 1.2);
  pin('mgmt', B, ML.mgmtX[0], 78, zb - 1.2);
  pin('mbHandle', B, 60, 118, zb - 16);
  const n0 = nicOf(SPEC.demo.wallGpu);
  pin('nic0', B, n0.x, ML.card.y + 9, n0.cardZ);

  /** look: {lifts: [pull, lid, sinks, baffle, cpuSinks], hi: {nic0, osfp4}} */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0, 0];
    root.position.z = -MB.pull * L[0];
    G.baffle.position.y = ML.lift.baffle * L[3];
    G.cpuSinks.position.y = ML.lift.cpuSinks * L[4];
    K.fade(M.baffle, 1 - 0.6 * Math.min(1, L[3] * 1.4));
    const hi = look.hi ?? {};
    K.tint(M.card0, hi.nic0 ?? 0);
    K.tint(M.cage4, hi.osfp4 ?? 0);
  };
  return {root, G, M, update, anchors};
}
