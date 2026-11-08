// Compute sled 5 of server 1, the one that slides out (chapters 2 and 6), in sled-local millimetres: x across, y up
// from the sled's floor, z front (+450) to back (-450). All of it is 仮定 except the count (2 Trainium2 per sled, a
// report): a board, two Trainium2 packages under big finned heatsinks (air-cooled, as reported), a row of 5 fans behind
// the front grille, one network card per chip behind its EFA port (仮定), and at the back 4 NeuronLink connectors.
// The die count and the HBM stacks are not drawn (unconfirmed). Layers that lift in the exploded view (flow.js CL.lift):
// 天板, ヒートシンク, チップ, カード. update(look) poses it; nothing here keeps time.
import * as THREE from 'three';
import {CL, PULL, SLED} from './flow.js';

const V3 = THREE.Vector3;

export function buildSled(K) {
  const {mk, metal, bx, inst, tint, fade} = K;
  const root = new THREE.Group();
  const G = {base: new THREE.Group(), lid: new THREE.Group(), sinks: new THREE.Group(), chips: new THREE.Group(), io: new THREE.Group()};
  root.add(G.base, G.lid, G.sinks, G.chips, G.io);
  const M = {
    sled: mk('compute', metal('#767a81', 0.55, 0.4)),
    face: mk('compute', metal('#8a8e95', 0.5, 0.4)),
    lid: mk('sledLid', metal('#80848a', 0.55, 0.4)),
    grille: mk('compute', {color: '#26282b', roughness: 0.85}),
    cage: mk('compute', metal('#9aa0a7', 0.42, 0.65)),
    cage1: mk('sled1', metal('#9aa0a7', 0.42, 0.65)),
    mouth: mk('compute', {color: '#1f2124', roughness: 0.85}),
    handle: mk('compute', {color: '#2a2c30', roughness: 0.6}),
    pcb: mk('board', {color: '#56695d', roughness: 0.72}),
    sub: mk('chip', {color: '#5f6a5b', roughness: 0.65}),
    lidChip: mk('chip', metal('#8b9097', 0.42, 0.65)),
    chip1: mk('sled1', metal('#8b9097', 0.42, 0.65)),
    sink: mk('sink', metal('#a7adb3', 0.5, 0.55)),
    card: mk('io', {color: '#4d6155', roughness: 0.7}),
    card1: mk('sled1', {color: '#4d6155', roughness: 0.7}),
    nic: mk('io', metal('#8a9097', 0.45, 0.55)),
    fan: mk('fan', {color: '#34373c', roughness: 0.65}),
    hub: mk('fan', {color: '#4a4e54', roughness: 0.6}),
    conn: mk('conn', {color: '#2e3034', roughness: 0.7}),
  };
  const B = G.base;
  const W2 = SLED.w / 2;
  const ZF = CL.frontZ;
  const ZB = CL.backZ;
  const H = SLED.h;

  // ------------------------------------------------------------ the pan, walls, front panel (as the rack's instanced sleds)
  bx(B, M.sled, [-W2, W2], [0, 2], [ZB, ZF]);
  for (const sx of [-1, 1]) bx(B, M.sled, sx > 0 ? [W2 - 2, W2] : [-W2, -W2 + 2], [0, H - 2], [ZB, ZF]);
  bx(B, M.sled, [-W2, W2], [0, H - 2], [ZB, ZB + 2]);
  // the front panel, open behind the grille so the fans show from above
  bx(B, M.face, [-W2 - 3, W2 + 3], [0, 10], [ZF - 1, ZF + 2]);
  bx(B, M.face, [-W2 - 3, W2 + 3], [H - 10, H], [ZF - 1, ZF + 2]);
  bx(B, M.face, [-W2 - 3, -150], [10, H - 10], [ZF - 1, ZF + 2]);
  bx(B, M.face, [150, W2 + 3], [10, H - 10], [ZF - 1, ZF + 2]);
  const gr = [];
  for (const fx of CL.fanX) for (let j = 0; j < 7; j++) gr.push({p: [fx, 16 + j * 9, ZF + 1], s: [CL.fanS - 6, 2.2, 2]});
  inst(B, M.grille, gr, undefined, false);
  CL.nicX.forEach((x, i) => {
    bx(B, i === 0 ? M.cage1 : M.cage, [x - 15, x + 15], [21, 39], [ZF - 60, ZF + 5]);
    bx(B, M.mouth, [x - 12, x + 12], [24.5, 35.5], [ZF + 4.6, ZF + 5.4], false);
  });
  for (const x of [-213, 213]) bx(B, M.handle, [x - 4, x + 4], [18, 68], [ZF + 1, ZF + 11]);
  bx(B, M.pcb, [-200, 200], [2, CL.boardY], [-420, 200]);
  // the row of fans: a frame and a hub
  const fans = [];
  const hubs = [];
  for (const x of CL.fanX) {
    fans.push({p: [x, 34, CL.fanZ], s: [CL.fanS, 58, 38]});
    hubs.push({p: [x, 34, CL.fanZ + 19.5], s: [22, 22, 2]});
  }
  inst(B, M.fan, fans);
  inst(B, M.hub, hubs, undefined, false);
  // the back: 4 NeuronLink connectors
  CL.nlX.forEach((x) => bx(B, M.conn, [x - 23, x + 23], [H / 2 - 15, H / 2 + 15], [ZB - 28, ZB]));

  // ------------------------------------------------------------ chips: 2 Trainium2 packages (no dies or HBM drawn)
  const C0 = G.chips;
  CL.chipX.forEach((x, i) => {
    const s = CL.pkgS;
    bx(C0, M.sub, [x - s / 2, x + s / 2], [CL.boardY, CL.boardY + 2.4], [CL.chipZ - s / 2, CL.chipZ + s / 2]);
    bx(C0, i === 0 ? M.chip1 : M.lidChip, [x - CL.dieS / 2, x + CL.dieS / 2], [CL.boardY + 2.4, CL.chipY], [CL.chipZ - CL.dieS / 2, CL.chipZ + CL.dieS / 2]);
  });

  // ------------------------------------------------------------ heatsinks: a base and thin fins along the airflow (z)
  const S = G.sinks;
  const fins = [];
  CL.chipX.forEach((x) => {
    const {w, d, base, fin, fins: n} = CL.sink;
    bx(S, M.sink, [x - w / 2, x + w / 2], [CL.chipY, CL.chipY + base], [CL.chipZ - d / 2, CL.chipZ + d / 2]);
    for (let j = 0; j < n; j++) fins.push({p: [x - w / 2 + 3 + (j * (w - 6)) / (n - 1), CL.chipY + base + fin / 2, CL.chipZ], s: [1.6, fin, d]});
  });
  inst(S, M.sink, fins);

  // ------------------------------------------------------------ cards: one network card per chip (仮定)
  const IO = G.io;
  CL.nicX.forEach((x, i) => {
    bx(IO, i === 0 ? M.card1 : M.card, [x - 17, x + 17], [5, 7], [CL.nicZ - 60, CL.nicZ + 72]);
    bx(IO, M.nic, [x - 11, x + 11], [7, 14], [CL.nicZ - 20, CL.nicZ + 6]);
  });

  // ------------------------------------------------------------ the lid
  bx(G.lid, M.lid, [-W2, W2], [H - 2, H], [ZB, ZF - 2]);

  // ------------------------------------------------------------ anchors (sled-local; they ride with the layers)
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  pin('chip', C0, CL.chipX[1] + 30, CL.chipY, CL.chipZ + 30);
  pin('chip1', C0, CL.chipX[0], CL.chipY, CL.chipZ);
  pin('sink', S, CL.chipX[0] - 40, CL.chipY + CL.sink.base + CL.sink.fin, CL.chipZ - 40);
  pin('fan', B, CL.fanX[3], 63, CL.fanZ);
  pin('nic', IO, CL.nicX[1], 14, CL.nicZ - 8);
  pin('nic1', IO, CL.nicX[0], 14, CL.nicZ - 8);
  pin('nlBack', B, CL.nlX[2], H / 2 + 15, ZB - 14);
  pin('lid', G.lid, -130, H, 220);
  pin('port1', B, CL.nicX[0], 39, ZF + 5);

  /** look: {lifts: [pull, lid, sinks, chips, io], lidAway 0..1, hiSled: {chip1, nic1, port1} weights} */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0, 0];
    root.position.set(PULL.x, PULL.y0, SLED.zc + L[0] * SLED.pull);
    G.lid.position.y = CL.lift.lid * L[1];
    G.sinks.position.y = CL.lift.sinks * L[2];
    G.chips.position.y = CL.lift.chips * L[3];
    G.io.position.y = CL.lift.io * L[4];
    // the lifted lid turns see-through so the layers under it read from above; away (chapter 6) takes it out
    const away = look.lidAway ?? 0;
    fade(M.lid, (1 - 0.6 * Math.min(1, L[1] * 1.4)) * (1 - Math.min(1, away * 1.4)));
    G.lid.visible = away < 0.7;
    G.lid.position.y += 200 * away;
    const h = look.hiSled ?? {};
    tint(M.chip1, h.chip1 ?? 0);
    tint(M.card1, h.nic1 ?? 0);
    tint(M.cage1, h.port1 ?? 0);
  };
  return {root, update, anchors, G, M};
}
