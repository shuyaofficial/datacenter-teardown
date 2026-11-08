// The rack, built from code in millimetres (the root is scaled by 0.001, so the scene is in metres): x across the front,
// y up from the floor, z front (+) to back (-). A simplified Ironwood TPU rack, 2,300 x 1,200 x 1,200 mm (仮定: Google
// gives no size), no logo, no photo. From the top (出典3 「Rack Subsystems」): drip pan, the 416 V AC input and the AC/DC
// rectifiers, the ToR switch and the rack-monitor tray, the optical patch panel, two columns of 8 pairs (TPU tray over
// host tray), the battery shelves at the bottom. Behind: a supply and a return manifold per column with a hose pair to
// every TPU tray, copper ICI bundles, the power line down the middle. In front: the fibre bundles from the OSFPs up to
// the patch panel and on out of the top.
// The same shapes repeat 16 times, so every repeated part is one InstancedMesh; tray 9 (SPEC.demo.pullTray) is the
// detailed one (tray.js) that slides out. update(look) poses it from the page's state: nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BACK, COLX, FIBRE, HOST, PAIR, RACK, rowY, SECT, sideOf, TL, TRAY, trayX, trayY, hostY} from './flow.js';
import {SPEC} from './kin.js';
import {buildTray} from './tray.js';

const V3 = THREE.Vector3;
const hash = (i) => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 18);

/** the shared builders: materials that remember their base colour, boxes by extent, instanced boxes */
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
  /** many boxes (or cylinders: geo) in one draw: [{p: centre, s: size, c?: brightness, q?: quaternion}] */
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

export function buildRack() {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const K = makeKit(root);
  const {mk, metal, bx, inst} = K;
  const M = {
    frame: mk('frame', metal('#5b5f64', 0.55, 0.45)),
    base: mk('frame', {color: '#45474c', roughness: 0.8}),
    side: mk('side', metal('#6c7076', 0.6, 0.35)),
    drip: mk('frame', metal('#7d8288', 0.5, 0.45)),
    tray: mk('tpu', metal('#767a81', 0.55, 0.4)),
    trayFace: mk('tpu', metal('#878b92', 0.5, 0.4)),
    cage: mk('tpu', metal('#9ba1a8', 0.42, 0.65)),
    mouth: mk('tpu', {color: '#1f2124', roughness: 0.85}),
    handle: mk('frame', {color: '#2a2c30', roughness: 0.6}),
    host: mk('host', metal('#6f737a', 0.55, 0.4)),
    hostFace: mk('host', metal('#7f838a', 0.5, 0.4)),
    vent: mk('host', {color: '#2a2c30', roughness: 0.85}),
    led: mk('host', {color: '#6aa37f', roughness: 0.5}),
    rect: mk('power', metal('#8b9097', 0.5, 0.4)),
    rectFace: mk('power', metal('#9fa4aa', 0.5, 0.35)),
    bbu: mk('bbu', metal('#7a7f86', 0.55, 0.4)),
    bbuFace: mk('bbu', metal('#8e939a', 0.5, 0.4)),
    tor: mk('tor', metal('#70747a', 0.55, 0.4)),
    port: mk('tor', {color: '#1f2124', roughness: 0.85}),
    patch: mk('patch', metal('#7b8086', 0.5, 0.4)),
    lc: mk('patch', {color: '#c9c3b4', roughness: 0.6}),
    fibre: mk('fibre', {color: '#d3cfc4', roughness: 0.7}),
    copper: mk('copper', {color: '#4a4c50', roughness: 0.65}),
    clamp: mk('copper', metal('#8c8f94', 0.5, 0.5)),
    bus: mk('bus', metal('#9b8a76', 0.45, 0.6)),
    manS: mk('manS', metal('#8f969d', 0.4, 0.6)),
    manR: mk('manR', metal('#8f969d', 0.4, 0.6)),
    hoseS: mk('manS', {color: '#3b3d41', roughness: 0.6}),
    hoseR: mk('manR', {color: '#3b3d41', roughness: 0.6}),
    qd: mk('cool', metal('#a9aeb4', 0.4, 0.7)),
    pcie: mk('pcie', {color: '#34363a', roughness: 0.6}),
  };
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  const G = {fixed: new THREE.Group(), sides: new THREE.Group()};
  root.add(G.fixed, G.sides);
  const F = G.fixed;
  const X1 = RACK.w / 2;
  const ZF = RACK.zf;
  const P = RACK.post;
  const yTop = SECT.cap[0];

  // ------------------------------------------------------------ the frame: plinth, 4 posts, top cap, side panels
  bx(F, M.base, [-X1, X1], [0, RACK.base], [-ZF, ZF]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(F, M.frame, sx > 0 ? [X1 - P, X1] : [-X1, -X1 + P], [RACK.base, yTop], sz > 0 ? [ZF - P, ZF] : [-ZF, -ZF + P]);
  bx(F, M.frame, [-X1, X1], [yTop, RACK.h], [-ZF, ZF]);
  // a middle post between the columns, front and back (the trays hang on it)
  for (const z of [ZF - 70, -ZF + 90]) bx(F, M.frame, [-14, 14], [RACK.base, yTop], [z - 10, z + 10]);
  for (const sx of [-1, 1]) bx(G.sides, M.side, sx > 0 ? [X1, X1 + 4] : [-X1 - 4, -X1], [RACK.base, yTop], [-ZF + P, ZF - P]);

  // ------------------------------------------------------------ the shelves across the full width
  const W1 = X1 - P - 4; // 546
  const zFront = TRAY.zc + TRAY.d / 2; // 520
  const ports = [];
  const faces = [];
  // drip pan (a shallow tray with a lip)
  const DZ = ZF - P - 24;
  bx(F, M.drip, [-W1, W1], [SECT.drip[0], SECT.drip[0] + 8], [-DZ, DZ]);
  for (const sz of [-1, 1]) bx(F, M.drip, [-W1, W1], [SECT.drip[0], SECT.drip[1]], sz > 0 ? [DZ - 6, DZ] : [-DZ, -DZ + 6]);
  // rectifiers: a shelf with 6 modules
  bx(F, M.rect, [-W1, W1], [SECT.rect[0], SECT.rect[1]], [-420, 500]);
  for (let j = 0; j < 6; j++) {
    const x = -W1 + 20 + j * ((2 * W1 - 40) / 6) + (2 * W1 - 40) / 12;
    faces.push({m: M.rectFace, p: [x, (SECT.rect[0] + SECT.rect[1]) / 2, 502], s: [168, SECT.rect[1] - SECT.rect[0] - 14, 4], c: 0.95 + 0.1 * hash(j + 3)});
    ports.push({m: M.vent, p: [x - 30, (SECT.rect[0] + SECT.rect[1]) / 2, 505], s: [80, 110, 1]});
    ports.push({m: M.led, p: [x + 55, SECT.rect[1] - 30, 505], s: [8, 5, 1]});
  }
  // the AC input on top of the rectifiers (cables up out of the top)
  for (const x of [-300, -260]) bx(F, M.copper, [x - 12, x + 12], [SECT.rect[1], RACK.h + 260], [-312, -288]);
  // ToR (left) and the rack-monitor tray (right)
  bx(F, M.tor, [-W1, -8], [SECT.tor[0], SECT.tor[1]], [-300, 500]);
  bx(F, M.tor, [8, W1], [SECT.tor[0], SECT.tor[1] - 40], [-300, 500]);
  for (let j = 0; j < 24; j++) for (let r = 0; r < 2; r++) ports.push({m: M.port, p: [-520 + j * 20.5, SECT.tor[0] + 32 + r * 36, 502], s: [16, 14, 2]});
  for (let j = 0; j < 4; j++) ports.push({m: M.led, p: [60 + j * 30, SECT.tor[0] + 32, 502], s: [10, 6, 2]});
  // optical patch panel
  bx(F, M.patch, [-W1, W1], [SECT.patch[0], SECT.patch[1]], [300, 500]);
  for (let j = 0; j < 32; j++) for (let r = 0; r < 3; r++) ports.push({m: M.lc, p: [-500 + j * 32.3, SECT.patch[0] + 28 + r * 32, 502], s: [14, 18, 4]});
  // battery shelves (BBU), two
  for (const sx of [-1, 1]) {
    bx(F, M.bbu, sx > 0 ? [8, W1] : [-W1, -8], [SECT.bbu[0], SECT.bbu[1]], [-420, 500]);
    for (let j = 0; j < 3; j++) faces.push({m: M.bbuFace, p: [sx * (90 + j * 170), (SECT.bbu[0] + SECT.bbu[1]) / 2, 502], s: [156, SECT.bbu[1] - SECT.bbu[0] - 16, 4], c: 0.95 + 0.1 * hash(j * 5 + sx)});
  }

  // ------------------------------------------------------------ the 16 pairs: host tray under, TPU tray over
  const L = {tray: [], face: [], cage: [], mouth: [], handle: [], host: [], hostFace: [], vent: [], nic: [], led: [], qd: [], hoseS: [], hoseR: [], pcie: []};
  const cylZ = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  const zBack = BACK.trayBackZ;
  for (let n = 0; n < SPEC.cube.trays; n++) {
    const x0 = trayX(n);
    const sx = sideOf(n);
    const y0 = trayY(n);
    const yh = hostY(n);
    const shade = 0.94 + 0.12 * hash(n + 1);
    // the host tray (air in front: vents, a NIC with two ports, a status light)
    L.host.push({p: [x0, yh + HOST.h / 2, TRAY.zc - 40], s: [TRAY.w, HOST.h, TRAY.d - 80], c: shade});
    L.hostFace.push({p: [x0, yh + HOST.h / 2, zFront - 40 + 1.5], s: [TRAY.w + 4, HOST.h, 3], c: shade});
    for (let j = 0; j < 5; j++) L.vent.push({p: [x0 + 30 + j * 44, yh + HOST.h / 2, zFront - 40 + 3.4], s: [34, 36, 1]});
    for (const d of [-14, 14]) L.nic.push({p: [x0 - 200 + d, yh + HOST.h / 2, zFront - 40 + 3.4], s: [22, 14, 1.2]});
    L.led.push({p: [x0 - 140, yh + HOST.h / 2 + 12, zFront - 40 + 3.4], s: [7, 5, 1]});
    // PCIe from the TPU tray down to the host at the back
    L.pcie.push({p: [x0 + sx * -100, (y0 + yh + HOST.h) / 2 + 10, zBack - 18], s: [60, y0 - yh, 14]});
    // the hoses: TPU tray back → the manifolds of its column
    [BACK.manS, BACK.manR].forEach((m, i) => {
      const qx = x0 + sx * Math.abs(TL.qdX[i]); // the quick-connects sit on the column's outer side
      const yy = y0 + 40;
      (i ? L.hoseR : L.hoseS).push({p: [qx, yy, (zBack - 10 + m.z) / 2], s: [7, Math.abs(zBack - 10 - m.z), 7], q: cylZ});
      L.qd.push({p: [qx, yy, zBack - 8], s: [9, 18, 9], q: cylZ});
    });
    if (n === SPEC.demo.pullTray) continue; // the detailed tray: tray.js
    L.tray.push({p: [x0, y0 + TRAY.h / 2, TRAY.zc], s: [TRAY.w, TRAY.h, TRAY.d], c: shade});
    L.face.push({p: [x0, y0 + TRAY.h / 2, zFront + 1.5], s: [TRAY.w + 4, TRAY.h, 3], c: shade});
    for (const x of TL.osfpX) {
      L.cage.push({p: [x0 + x, y0 + 33, zFront + 4], s: [24, 22, 6], c: 0.96 + 0.08 * hash(n * 7 + x)});
      L.mouth.push({p: [x0 + x, y0 + 33, zFront + 7.2], s: [18, 11, 1]});
    }
    for (const x of TL.osfpBotX) L.cage.push({p: [x0 + x, y0 + 9, zFront + 4], s: [24, 14, 6]});
    for (const x of [-238, 238]) L.handle.push({p: [x0 + x, y0 + 64, zFront + 8], s: [8, 40, 12]});
  }
  const IM = {};
  IM.tray = inst(F, M.tray, L.tray);
  IM.face = inst(F, M.trayFace, L.face);
  IM.cage = inst(F, M.cage, L.cage);
  IM.mouth = inst(F, M.mouth, L.mouth, BOX, false);
  IM.handle = inst(F, M.handle, L.handle);
  IM.host = inst(F, M.host, L.host);
  IM.hostFace = inst(F, M.hostFace, L.hostFace);
  IM.vent = inst(F, M.vent, L.vent, BOX, false);
  IM.nic = inst(F, M.port, L.nic, BOX, false);
  IM.led = inst(F, M.led, L.led, BOX, false);
  IM.qd = inst(F, M.qd, L.qd, CYL);
  IM.hoseS = inst(F, M.hoseS, L.hoseS, CYL);
  IM.hoseR = inst(F, M.hoseR, L.hoseR, CYL);
  IM.pcie = inst(F, M.pcie, L.pcie);
  // shelf faces and ports (grouped by material)
  const byMat = new Map();
  for (const o of [...faces, ...ports]) (byMat.get(o.m) ?? byMat.set(o.m, []).get(o.m)).push(o);
  for (const [m, list] of byMat) inst(F, m, list, BOX, false);

  // ------------------------------------------------------------ the back: manifolds, copper ICI, the power line
  for (const sx of [-1, 1])
    [BACK.manS, BACK.manR].forEach((m, i) => {
      const pipe = new THREE.Mesh(CYL, i ? M.manR : M.manS);
      pipe.scale.set(BACK.manR0, BACK.manY[1] - BACK.manY[0], BACK.manR0);
      pipe.position.set(sx * m.x, (BACK.manY[0] + BACK.manY[1]) / 2, m.z);
      pipe.castShadow = true;
      F.add(pipe);
      const f = new THREE.Mesh(CYL, i ? M.manR : M.manS);
      f.scale.set(BACK.manR0 * 0.8, BACK.manY[0], BACK.manR0 * 0.8);
      f.position.set(sx * m.x, BACK.manY[0] / 2, m.z);
      F.add(f);
    });
  const cu = [];
  const yLo = rowY(0) + PAIR.trayDy;
  const yHi = trayY(15) + TRAY.h;
  for (const x0 of COLX)
    for (const d of [-1, 1]) {
      const x = x0 + d * BACK.cuX;
      cu.push({p: [x, (yLo + yHi) / 2, BACK.cuZ], s: [36, yHi - yLo, 26], c: 0.9 + 0.2 * hash(x)});
    }
  // jumpers between the columns (x 1 ↔ 2) at every row, and short loops between the rows of a column (z, y)
  for (let r = 0; r < SPEC.rows; r++) cu.push({p: [0, rowY(r) + PAIR.trayDy + 70, BACK.cuZ - 4], s: [2 * (COLX[1] - BACK.cuX) - 36, 12, 12], c: 0.85 + 0.2 * hash(r + 9)});
  IM.copper = inst(F, M.copper, cu);
  const clamps = [];
  for (const x0 of COLX) for (const d of [-1, 1]) for (let y = yLo + 80; y < yHi - 40; y += 220) clamps.push({p: [x0 + d * BACK.cuX, y, BACK.cuZ], s: [44, 10, 32]});
  IM.clamp = inst(F, M.clamp, clamps);
  bx(F, M.bus, [BACK.busX - 15, BACK.busX + 15], [SECT.bbu[0] + 40, SECT.rect[0] + 60], [BACK.busZ - 8, BACK.busZ + 8]);

  // ------------------------------------------------------------ fibres: OSFPs → up the front → patch panel → out of the top
  const fib = [];
  for (const x of FIBRE.x) fib.push({p: [x, (yLo + SECT.patch[0]) / 2, FIBRE.z], s: [FIBRE.r, SECT.patch[0] - yLo, FIBRE.r]});
  for (const x of [FIBRE.x[0], FIBRE.x[3]]) fib.push({p: [x, (SECT.patch[1] + RACK.h + 240) / 2, FIBRE.z], s: [FIBRE.r, RACK.h + 240 - SECT.patch[1], FIBRE.r]});
  IM.fibre = inst(F, M.fibre, fib, CYL);

  // the detailed TPU tray
  const tray = buildTray(K);
  root.add(tray.root);

  // ------------------------------------------------------------ anchors: where a label's leader lands
  const n0 = SPEC.demo.pullTray;
  pin('drip', F, -300, SECT.drip[1], ZF - 120);
  pin('rect', F, 120, SECT.rect[0] + 40, 505);
  pin('acIn', F, -280, SECT.rect[1] + 120, -300);
  pin('tor', F, -300, SECT.tor[0] + 50, 504);
  pin('patch', F, 230, SECT.patch[0] + 60, 506);
  pin('tpuTray', F, COLX[1] + 120, trayY(13) + 36, zFront + 8);
  pin('hostTray', F, COLX[0] + 60, hostY(14) + HOST.h / 2, zFront - 36);
  pin('bbu', F, -260, SECT.bbu[0] + 60, 504);
  pin('fibreFront', F, FIBRE.x[3], trayY(11) + 50, FIBRE.z + FIBRE.r);
  pin('fibreTop', F, FIBRE.x[3], RACK.h + 160, FIBRE.z);
  pin('demoTray', F, trayX(n0) + 140, trayY(n0) + 50, zFront + 4);
  const n1 = SPEC.demo.outTray; // the right column: mirrored
  pin('nic', F, trayX(n1) + 200, hostY(n1) + HOST.h / 2, zFront - 36);
  pin('osfpFront', F, trayX(n1) - TL.osfpX[3], trayY(n1) + 36, zFront + 8);
  pin('manS', F, -BACK.manS.x, BACK.manY[1] - 120, BACK.manS.z - BACK.manR0);
  pin('manR', F, BACK.manR.x, BACK.manY[1] - 300, BACK.manR.z - BACK.manR0);
  pin('hose', F, COLX[1] + 240, trayY(9) + 40, BACK.trayBackZ - 20);
  pin('copper', F, COLX[0] + BACK.cuX, trayY(10), BACK.cuZ - 14);
  pin('bus', F, BACK.busX, rowY(3) + 40, BACK.busZ - 8);
  pin('rectBack', F, 200, SECT.rect[0] + 80, -420);
  pin('bbuBack', F, 200, SECT.bbu[0] + 80, -420);
  pin('pcieBack', F, COLX[0] + 100, hostY(6) + 80, zBack - 26);
  for (const [k, a] of Object.entries(tray.anchors)) anchors[k] = a;

  // ------------------------------------------------------------ pose
  /** look: {lifts: [pull, lid, plates, chips, io], sides 0..1 (taken off), hi: {sys: weight}, hiTray: {...}} */
  const update = (look = {}) => {
    tray.update(look);
    const sides = look.sides ?? 0;
    G.sides.visible = sides < 0.98;
    K.fade(M.side, 1 - sides);
    const hi = look.hi ?? {};
    for (const sys of ['power', 'bus', 'bbu', 'manS', 'manR', 'cool', 'copper', 'fibre', 'patch', 'host', 'pcie']) for (const m of K.reg[sys] ?? []) K.tint(m, hi[sys] ?? 0);
  };
  /** an anchor in world metres (follows the pulled parts) */
  const anchor = (key) => {
    const a = anchors[key];
    a.obj.updateWorldMatrix(true, false);
    return a.obj.localToWorld(a.p.clone());
  };
  return {root, update, anchor, anchors, pin, M, K, G, IM, tray};
}
export {V3};
