// The inside of the Q3400-RA (chapter 2), in the box's millimetres: one main board, 4 Quantum-3 chips 2 × 2 (the count
// is 計算 115.2 ÷ 28.8, the places are 仮定) under finned heat sinks that lift as one layer, the management CPU board at
// the front left (Intel i3-8100H and its memory) as the next layer, and one bundle from each chip to the cages' backs
// (the lanes inside a bundle and the way the chips are joined are not public, so neither is drawn). update(look) poses
// it; nothing keeps time.
import * as THREE from 'three';
import {BOX, bundlePaths} from './flow.js';

const V3 = THREE.Vector3;

export function buildBoard(K, body) {
  const {mk, metal, bx, inst} = K;
  const root = new THREE.Group();
  const G = {heat: new THREE.Group(), cpu: new THREE.Group()};
  root.add(G.heat, G.cpu);
  const M = {
    pcb: mk('board', {color: '#566a5e', roughness: 0.72}),
    sub: mk('chip', {color: '#5f6a5b', roughness: 0.65}),
    die: mk('chip', metal('#7f858c', 0.4, 0.7)),
    sinkBase: mk('sink', metal('#b2b7bc', 0.48, 0.6)),
    fin: mk('sink', metal('#bfc4c9', 0.5, 0.55)),
    cpuPcb: mk('cpu', {color: '#4f6357', roughness: 0.72}),
    cpuChip: mk('cpu', metal('#868b92', 0.42, 0.65)),
    dimm: mk('cpu', {color: '#30333a', roughness: 0.6}),
    bundle: mk('bundle', {color: '#2c2e33', roughness: 0.62}),
    tie: mk('bundle', metal('#8c9198', 0.5, 0.4)),
    duct: mk('board', metal('#6a6e74', 0.55, 0.35)),
  };
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  const {w2: W2, zf: ZF, zb: ZB} = BOX;
  const y0 = BOX.boardY;

  // the main board between the cages' backs and the fans
  bx(body, M.pcb, [-W2 + 4, W2 - 4], [y0 - 2.4, y0], [ZB + BOX.psuD + 4, ZF - BOX.cage.d - 2]);
  // a thin baffle beside the power columns (the air path is front to back)
  for (const sx of [-1, 1]) bx(body, M.duct, sx > 0 ? [BOX.psuX[1] - BOX.psuW / 2 - 4, BOX.psuX[1] - BOX.psuW / 2 - 2] : [BOX.psuX[0] + BOX.psuW / 2 + 2, BOX.psuX[0] + BOX.psuW / 2 + 4], [y0, 168], [ZB + 2, ZB + BOX.psuD]);

  // ------------------------------------------------------------ the chips (stay on the board) and their sinks (lift)
  const subs = [];
  const dies = [];
  const bases = [];
  const fins = [];
  BOX.chipZ.forEach((z, j) =>
    BOX.chipX.forEach((x, i) => {
      subs.push({p: [x, y0 + 1.5, z], s: [BOX.chipS + 14, 3, BOX.chipS + 14]});
      dies.push({p: [x, y0 + 4, z], s: [BOX.chipS, 2.6, BOX.chipS], c: 0.95 + 0.06 * (i + j)});
      bases.push({p: [x, y0 + 8, z], s: [BOX.sinkS, 6, BOX.sinkS]});
      // fins run front to back, with the wind
      for (let f = 0; f < 15; f++) fins.push({p: [x - BOX.sinkS / 2 + 4 + f * ((BOX.sinkS - 8) / 14), y0 + 11 + BOX.sinkH / 2, z], s: [1.6, BOX.sinkH, BOX.sinkS - 4], c: 0.96 + 0.06 * ((f + i) % 2)});
    }),
  );
  const IM = {};
  IM.sub = inst(body, M.sub, subs);
  IM.die = inst(body, M.die, dies);
  IM.base = inst(G.heat, M.sinkBase, bases);
  IM.fin = inst(G.heat, M.fin, fins);

  // ------------------------------------------------------------ the bundles: one per chip, flat, with a few ties
  const segs = [];
  const ties = [];
  const up = new V3(0, 1, 0);
  for (const pts of bundlePaths()) {
    for (let i = 1; i < pts.length; i++) {
      const a = new V3(...pts[i - 1]);
      const b = new V3(...pts[i]);
      const d = b.clone().sub(a);
      const len = d.length();
      if (len < 0.5) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d.normalize());
      segs.push({p: a.clone().add(b).multiplyScalar(0.5).toArray(), s: [16, 5, len + 16], q});
      if (len > 60) ties.push({p: a.clone().lerp(b, 0.5).toArray(), s: [19, 7, 4], q});
    }
  }
  void up;
  IM.bundle = inst(body, M.bundle, segs);
  IM.tie = inst(body, M.tie, ties);

  // ------------------------------------------------------------ the management CPU board (front left)
  const c = BOX.cpu;
  const cy = 14;
  bx(G.cpu, M.cpuPcb, [c.x0, c.x1], [cy, cy + 2], [c.z0, c.z1]);
  bx(G.cpu, M.cpuChip, [c.x0 + 14, c.x1 - 14], [cy + 2, cy + 6], [c.z1 - 64, c.z1 - 32]);
  bx(G.cpu, M.dimm, [c.x0 + 6, c.x1 - 6], [cy + 2, cy + 30], [c.z0 + 30, c.z0 + 34]);
  bx(G.cpu, M.dimm, [c.x0 + 6, c.x1 - 6], [cy + 2, cy + 30], [c.z0 + 40, c.z0 + 44]);
  // its standoffs stay on the main board
  for (const [x, z] of [[c.x0 + 5, c.z0 + 5], [c.x1 - 5, c.z0 + 5], [c.x0 + 5, c.z1 - 5], [c.x1 - 5, c.z1 - 5]]) bx(body, M.tie, [x - 2, x + 2], [y0, cy], [z - 2, z + 2], false);

  pin('chip', body, BOX.chipX[1] + BOX.chipS / 2, y0 + 5, BOX.chipZ[0] + BOX.chipS / 2);
  pin('chip2', body, BOX.chipX[0] - BOX.chipS / 2, y0 + 5, BOX.chipZ[1]);
  pin('sink', G.heat, BOX.chipX[1], y0 + 11 + BOX.sinkH, BOX.chipZ[1]);
  pin('cpu', G.cpu, (c.x0 + c.x1) / 2, cy + 6, c.z1 - 48);
  const bp = bundlePaths()[2];
  pin('bundle', body, (bp[0][0] + bp[1][0]) / 2, bp[0][1] + 3, (bp[0][2] + bp[1][2]) / 2);
  pin('psuIn', body, BOX.psuX[1], 168, ZB + BOX.psuD * 0.7);
  pin('fanIn', body, BOX.fanX[2], BOX.fanY[1] + BOX.fanS / 2, ZB + BOX.fanD);

  /** look: {lifts: [lid, heat, cpu, rear], hi} */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0];
    G.heat.position.y = L[1] * BOX.lift.heat;
    G.cpu.position.y = L[2] * BOX.lift.cpu;
  };
  return {root, update, anchors, M, IM, G};
}
