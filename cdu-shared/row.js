// The row, in world millimetres: 5 NVL72-like racks (600 x 1,068 x 2,236 mm, nvl72/refs.md; only the outside and the
// manifolds, the inside stays closed) to the right of the CDU, the coolant headers over the row (列の上 約 0.3 m; the
// room's 3.25 m tier is lowered here) with a drop to each rack's supply and return manifold, the facility water pipes
// running into the wall toward the outdoor coolers, and a ghost sixth rack for chapter 4. The beads ride the two loops
// (flow.js): the coolant in the pale → deep teal, the facility water in light → dark grey; they are drawn over the
// model (no depth test) since they run inside pipes and racks. update(look) poses it; nothing here keeps time.
import * as THREE from 'three';
import {addPipes, BOX, hash} from './cdu.js';
import {CDU, COLORS, FWSP, fwsLoop, HDR, loopBeads, RACK, rackDrops, rackX, rowPipes, shadeOf, tcsLoop} from './flow.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
const BALL = new THREE.IcosahedronGeometry(1, 1);

export function buildRow(K) {
  const {mk, metal, bx, inst} = K;
  const root = new THREE.Group();
  const M = {
    frame: mk('rack', metal('#2d3034', 0.62, 0.3)),
    face: mk('rack', metal('#3c4045', 0.55, 0.35)),
    port: mk('rack', {color: '#16181b', roughness: 0.85}),
    led: mk('rack', {color: '#5f8f74', roughness: 0.5}),
    man: mk('pipe', metal('#a1a8ad', 0.45, 0.6)),
    steel: mk('pipe', metal('#a9afb4', 0.45, 0.6)),
    fws: mk('fws', metal('#9aa0a4', 0.5, 0.5)),
    wall: mk('wall', {color: '#cfd6da', roughness: 0.9}),
    hanger: mk('pipe', {color: '#6f767b', roughness: 0.6}),
  };
  const anchors = {};
  const pin = (key, x, y, z) => (anchors[key] = new V3(x, y, z));

  // ------------------------------------------------------------ racks
  const n = SPEC.rowRacks;
  const faces = [];
  const ports = [];
  const leds = [];
  const X2 = RACK.w / 2;
  const Z2 = RACK.d / 2;
  for (let i = 0; i < n; i++) {
    const xc = rackX(i);
    const g = new THREE.Group();
    g.position.x = xc;
    root.add(g);
    bx(g, M.frame, [-X2, X2], [0, 100], [-Z2, Z2 - 20]);
    for (const sx of [-1, 1]) bx(g, M.frame, sx > 0 ? [X2 - 16, X2] : [-X2, -X2 + 16], [100, RACK.h], [-Z2, Z2]);
    bx(g, M.frame, [-X2 + 16, X2 - 16], [RACK.h - 40, RACK.h], [-Z2, Z2]);
    bx(g, M.frame, [-X2 + 16, X2 - 16], [100, RACK.h - 40], [-Z2, -Z2 + 16]);
    bx(g, M.frame, [-X2 + 16, X2 - 16], [100, RACK.h - 40], [Z2 - 40, Z2 - 30]);
    // 1U faces from the top: trays, switch trays, power shelves (a simple stripe of 44 units)
    for (let u = 0; u < 44; u++) {
      const y = RACK.h - 90 - (u + 1) * 44.45;
      faces.push({p: [xc, y + 22, Z2 - 26], s: [520, 41, 8], c: 0.88 + 0.22 * hash(i * 61 + u)});
      if (u % 3 !== 2) for (const k of [0, 1, 2]) ports.push({p: [xc - 200 + k * 34, y + 22, Z2 - 21.5], s: [22, 12, 1]});
      if (u % 5 === 0) leds.push({p: [xc + 228, y + 30, Z2 - 21.5], s: [6, 4, 1]});
    }
    // the manifolds at the back (inside), the collars where the drops come in
    const d = rackDrops(i);
    for (const x of [d.xs, d.xr]) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), M.man);
      m.scale.set(24, RACK.h - 340, 24);
      m.position.set(x - xc, 300 + (RACK.h - 340) / 2 - 40, HDR.manZ);
      g.add(m);
    }
    pin(`rack${i}`, xc, RACK.h - 260, Z2 - 20);
    pin(`rackTop${i}`, xc, RACK.h + 10, 0);
  }
  inst(root, M.face, faces);
  inst(root, M.port, ports, BOX, false);
  inst(root, M.led, leds, BOX, false);

  // ------------------------------------------------------------ the ghost: a sixth rack that needs a second CDU
  const ghostMat = new THREE.MeshBasicMaterial({color: '#9aa4aa', transparent: true, opacity: 0.12, depthWrite: false});
  const ghost = new THREE.Group();
  ghost.position.set(rackX(n), RACK.h / 2, 0);
  const gb = new THREE.Mesh(BOX, ghostMat);
  gb.scale.set(RACK.w, RACK.h, RACK.d);
  ghost.add(gb);
  const edgeMat = new THREE.LineDashedMaterial({color: '#6f7a80', dashSize: 60, gapSize: 40, transparent: true, opacity: 0.8});
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(RACK.w, RACK.h, RACK.d)), edgeMat);
  edges.computeLineDistances();
  ghost.add(edges);
  ghost.visible = false;
  root.add(ghost);
  pin('ghost', rackX(n), RACK.h - 200, RACK.d / 2);

  // ------------------------------------------------------------ the pipes over the row
  const rp = rowPipes(n);
  const drops = [];
  for (let i = 0; i < n; i++) {
    const d = rackDrops(i);
    drops.push(d.supply, d.ret);
  }
  addPipes(K, root, M.steel, [rp.supply, rp.ret, ...drops], HDR.r);
  addPipes(K, root, M.fws, [rp.fwsS, rp.fwsR], HDR.r);
  // hangers from above every 1.2 m
  const hang = [];
  for (let x = 400; x < rackX(n - 1) + 300; x += 1240) for (const [y, z] of [[HDR.sY, HDR.sZ], [HDR.rY, HDR.rZ]]) hang.push({p: [x, (y + 3200) / 2, z], s: [6, 3200 - y, 6]});
  for (let x = -300; x > FWSP.wallX; x -= 600) for (const [y, z] of [[FWSP.sY, rp.fwsS[0][2]], [FWSP.rY, rp.fwsR[0][2]]]) hang.push({p: [x, (y + 3200) / 2, z], s: [6, 3200 - y, 6]});
  inst(root, M.hanger, hang, new THREE.CylinderGeometry(1, 1, 1, 6), false);
  pin('hdrS', rackX(2) + 180, HDR.sY, HDR.sZ + HDR.r);
  pin('hdrR', rackX(3) + 120, HDR.rY + HDR.r, HDR.rZ);
  pin('fwsPipe', -620, FWSP.sY, rp.fwsS[0][2] + HDR.r);
  // the wall the facility water goes through (to the outdoor coolers)
  bx(root, M.wall, [FWSP.wallX - 300, FWSP.wallX], [2300, 3200], [-900, -100]);
  pin('wall', FWSP.wallX - 150, 2300, -100);

  // ------------------------------------------------------------ the beads
  const loops = {A: Array.from({length: n}, (_, i) => tcsLoop(i, 'A')), B: Array.from({length: n}, (_, i) => tcsLoop(i, 'B'))};
  const fl = fwsLoop();
  const nT = loops.A.reduce((a, L) => a + Math.ceil(L.len / 200), 0) + 40;
  const nF = Math.ceil(fl.len / 200) + 10;
  const beadMat = (o) => new THREE.MeshBasicMaterial({color: '#ffffff', toneMapped: false, depthTest: false, depthWrite: false, transparent: true, opacity: o});
  const tcsB = new THREE.InstancedMesh(BALL, beadMat(1), nT);
  const fwsB = new THREE.InstancedMesh(BALL, beadMat(1), nF);
  for (const im of [tcsB, fwsB]) {
    im.frustumCulled = false;
    im.renderOrder = 20;
    im.count = 0;
    im.setColorAt(0, new THREE.Color());
    root.add(im);
  }
  const cS = {tcs: [new THREE.Color(COLORS.tcsS), new THREE.Color(COLORS.tcsR)], fws: [new THREE.Color(COLORS.fwsS), new THREE.Color(COLORS.fwsR)]};
  const col = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const S = new V3();
  const P = new V3();
  // where a bead is hidden: inside a rack (always: the racks stay closed), inside the CDU while its doors are shut, or
  // anywhere outside the CDU in the close-up views (only = 'cdu')
  const inRack = (p) => p[1] < RACK.h - 1 && Math.abs(p[2]) < RACK.d / 2 && p[0] > rackX(0) - RACK.w / 2 && p[0] < rackX(n - 1) + RACK.w / 2;
  const inCdu = (p) => Math.abs(p[0]) < CDU.w / 2 && p[1] < CDU.h + 60 && Math.abs(p[2] - CDU.z) < CDU.d / 2;
  let hide = () => false;
  const put = (im, kind, b, size, rise = 0) => {
    if (hide(b.p)) return;
    m4.compose(P.set(...b.p), q, S.setScalar(size));
    im.setMatrixAt(im.count, m4);
    im.setColorAt(im.count, col.copy(cS[kind][0]).lerp(cS[kind][1], shadeOf(kind, b.T + rise)));
    im.count++;
  };

  /**
   * look.beads: {tcs: opacity 0..1, fws: opacity, racks: how many racks get coolant, tcsPhase, fwsPhase (seconds of
   * travel), pump: 'A' | 'B', rise: K added to the coolant (fwsloss)}; look.ghost 0..1
   */
  const update = (look = {}) => {
    const b = look.beads ?? {};
    tcsB.count = 0;
    fwsB.count = 0;
    const shut = (look.lifts?.[0] ?? 0) < 0.5;
    hide = b.only === 'cdu' ? (p) => !inCdu(p) : (p) => inRack(p) || (shut && inCdu(p));
    const size = b.size ?? 30;
    if ((b.tcs ?? 0) > 0.02) {
      tcsB.material.opacity = b.tcs;
      const set = loops[b.pump === 'B' ? 'B' : 'A'];
      const nr = Math.min(n, b.racks ?? n);
      for (let i = 0; i < nr; i++) for (const bd of loopBeads(set[i], b.tcsPhase ?? 0, 1, i / n)) if (tcsB.count < nT) put(tcsB, 'tcs', bd, size, b.rise ?? 0);
    }
    if ((b.fws ?? 0) > 0.02) {
      fwsB.material.opacity = b.fws;
      for (const bd of loopBeads(fl, b.fwsPhase ?? 0)) if (fwsB.count < nF) put(fwsB, 'fws', bd, size);
    }
    for (const im of [tcsB, fwsB]) {
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    const gk = look.ghost ?? 0;
    ghost.visible = gk > 0.02;
    ghostMat.opacity = 0.12 * gk;
    edgeMat.opacity = 0.8 * gk;
  };
  const anchor = (key) => root.localToWorld(anchors[key].clone());
  return {root, update, anchor, anchors, loops, fl};
}
