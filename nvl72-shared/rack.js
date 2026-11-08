// The rack, built from code in millimetres (the root is scaled by 0.001, so the scene is in metres): x across the front,
// y up from the floor, z front (+) to back (-). A simplified GB200 NVL72: 2,236 x 600 x 1,068 mm, no logo, no photo.
// From the top: 2 TOR switches, blanks, 4 power shelves, compute trays 1-10, NVLink switch trays 1-9, compute trays
// 11-18, 4 power shelves (their place is 仮定). Behind the trays: 4 cable cartridges, the bus bar in the middle, the
// supply manifold on the left and the return on the right, a hose pair to every liquid-cooled tray.
// The same shapes repeat 27 times, so every repeated part is one InstancedMesh; compute tray 3 is the detailed one
// (tray.js) that slides out. update(look) poses it from the page's state: nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BACK, RACK, SL, SLOTS, TL, TRAY} from './flow.js';
import {chipOf, SPEC, U_MM} from './kin.js';
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
    frame: mk('frame', metal('#5d6066', 0.55, 0.45)),
    base: mk('frame', {color: '#45474c', roughness: 0.8}),
    side: mk('side', metal('#6e7278', 0.6, 0.35)),
    blank: mk('frame', metal('#666a70', 0.6, 0.4)),
    tray: mk('compute', metal('#757980', 0.55, 0.4)),
    trayFace: mk('compute', metal('#8a8e95', 0.5, 0.4)),
    cage: mk('compute', metal('#9aa0a7', 0.42, 0.65)),
    mouth: mk('compute', {color: '#1f2124', roughness: 0.85}),
    drive: mk('compute', metal('#8b9097', 0.5, 0.5)),
    handle: mk('compute', {color: '#2a2c30', roughness: 0.6}),
    swTray: mk('switch', metal('#70747a', 0.55, 0.4)),
    swFace: mk('switch', metal('#7b7f86', 0.5, 0.4)),
    swLid: mk('switchLid', metal('#787c82', 0.55, 0.4)),
    swPan: mk('switchLid', metal('#6a6e74', 0.55, 0.4)),
    swChip: mk('switchChip', {color: '#6c7568', roughness: 0.6}),
    swPlate: mk('switchChip', metal('#a39684', 0.45, 0.6)),
    psu: mk('power', metal('#8c9198', 0.5, 0.4)),
    psuFace: mk('power', metal('#a0a5ab', 0.5, 0.35)),
    vent: mk('power', {color: '#25272a', roughness: 0.85}),
    led: mk('power', {color: '#6aa37f', roughness: 0.5}),
    tor: mk('tor', metal('#72767c', 0.55, 0.4)),
    port: mk('tor', {color: '#1f2124', roughness: 0.85}),
    cart: mk('cart', {color: '#57544f', roughness: 0.7}),
    band: mk('cart', metal('#8d7a62', 0.5, 0.55)),
    conn: mk('conn', {color: '#2e3034', roughness: 0.7}),
    bus: mk('bus', metal('#a68c70', 0.42, 0.7)),
    clip: mk('bus', metal('#8f7a63', 0.45, 0.6)),
    manS: mk('manS', metal('#8f969d', 0.4, 0.6)),
    manR: mk('manR', metal('#8f969d', 0.4, 0.6)),
    hoseS: mk('manS', {color: '#3b3d41', roughness: 0.6}),
    hoseR: mk('manR', {color: '#3b3d41', roughness: 0.6}),
    qd: mk('cool', metal('#a9aeb4', 0.4, 0.7)),
  };
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});

  const G = {fixed: new THREE.Group(), sides: new THREE.Group(), switches: new THREE.Group()};
  root.add(G.fixed, G.sides, G.switches);
  const F = G.fixed;
  const X1 = RACK.w / 2;
  const ZF = RACK.zf;
  const P = RACK.post;
  const yBase = 100;

  // ------------------------------------------------------------ the frame: plinth, 4 posts, top cap, rails
  bx(F, M.base, [-X1, X1], [0, yBase], [-ZF, ZF]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(F, M.frame, sx > 0 ? [X1 - P, X1] : [-X1, -X1 + P], [yBase, RACK.h - 40], sz > 0 ? [ZF - P, ZF] : [-ZF, -ZF + P]);
  bx(F, M.frame, [-X1, X1], [RACK.h - 40, RACK.h], [-ZF, ZF]);
  // the mounting rails the trays hang on (front and back, both sides)
  for (const sx of [-1, 1]) for (const z of [ZF - 46, -ZF + 70]) bx(F, M.frame, [sx * 230 - 6, sx * 230 + 6].sort((a, b) => a - b), [yBase, RACK.top], [z - 6, z + 6]);
  // side panels (they come off from chapter 2 on)
  for (const sx of [-1, 1]) bx(G.sides, M.side, sx > 0 ? [X1, X1 + 4] : [-X1 - 4, -X1], [yBase, RACK.h - 40], [-ZF + P, ZF - P]);

  // ------------------------------------------------------------ the slots
  const zFront = TRAY.zc + TRAY.d / 2; // 494
  const lists = {tray: [], face: [], cage: [], mouth: [], drive: [], handle: [], conn: [], qd: [], clip: [], swTray: [], swFace: [], swLid: [], swPan: [], swChip: [], swPlate: [], psu: [], psuFace: [], vent: [], led: [], tor: [], port: [], blank: [], hoseS: [], hoseR: []};
  const cylZ = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  const cylX = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.PI / 2);
  const zBack = TRAY.zc - TRAY.d / 2; // -406
  /** the back of a tray: 4 NVLink connectors, the two quick-connects, the bus clip, the two hoses to the manifolds */
  const trayBack = (y0, k, onlyHoses = false) => {
    if (!onlyHoses) for (const x of TL.nvlX) lists.conn.push({p: [x, y0 + 21, zBack - 14], s: [46, 30, 28], c: 0.95 + 0.1 * hash(k + x)});
    if (!onlyHoses) lists.clip.push({p: [BACK.busX - 8, y0 + 21, zBack - 30], s: [26, 24, 60]});
    TL.qdX.forEach((x, i) => {
      if (!onlyHoses) lists.qd.push({p: [x, y0 + 21, zBack - 12], s: [9, 24, 9], q: cylZ});
      const xm = BACK.manX[i];
      const len = Math.abs(xm - x);
      (i ? lists.hoseR : lists.hoseS).push({p: [(x + xm) / 2, y0 + 21, BACK.manZ], s: [7, len, 7], q: cylX});
      (i ? lists.hoseR : lists.hoseS).push({p: [x, y0 + 21, (zBack - 24 + BACK.manZ) / 2], s: [7, Math.abs(zBack - 24 - BACK.manZ), 7], q: cylZ});
    });
  };
  /** the front of a compute tray (the detailed tray 3 builds the same in tray.js) */
  const computeFront = (y0, k) => {
    for (const x of TL.cx7X) {
      lists.cage.push({p: [x, y0 + 21, zFront + 1], s: [30, 18, 8], c: 0.96 + 0.08 * hash(k * 7 + x)});
      lists.mouth.push({p: [x, y0 + 21, zFront + 5.2], s: [24, 11, 1]});
    }
    for (const x of TL.bf3X) for (const d of [-11, 11]) lists.mouth.push({p: [x + d, y0 + 21, zFront + 1.2], s: [17, 10, 2]});
    for (const x of TL.e1sX) lists.drive.push({p: [x, y0 + 21, zFront + 1], s: [24, 34, 3], c: 0.93 + 0.12 * hash(k * 3 + x)});
    for (const x of [-213, 213]) lists.handle.push({p: [x, y0 + 21, zFront + 6], s: [8, 30, 10]});
  };
  SLOTS.forEach((s, k) => {
    const y0 = s.y0;
    const shade = 0.95 + 0.1 * hash(k + 1);
    if (s.kind === 'compute') {
      if (s.n === SPEC.demo.pullTray) {
        trayBack(y0, k, true); // the hoses stay with the rack; the tray itself is tray.js
        return;
      }
      lists.tray.push({p: [0, y0 + TRAY.h / 2, TRAY.zc], s: [TRAY.w, TRAY.h, TRAY.d], c: shade});
      lists.face.push({p: [0, y0 + TRAY.h / 2, zFront + 0.5], s: [TRAY.w + 6, TRAY.h, 3], c: shade});
      computeFront(y0, k);
      trayBack(y0, k);
    } else if (s.kind === 'switch') {
      // open trays (pan, walls, lid): the lid and the pan turn see-through in chapter 3 so the chips show
      lists.swPan.push({p: [0, y0 + 1.5, TRAY.zc], s: [TRAY.w, 3, TRAY.d], c: shade});
      lists.swLid.push({p: [0, y0 + TRAY.h - 1, TRAY.zc], s: [TRAY.w, 2, TRAY.d], c: shade});
      for (const sx of [-1, 1]) lists.swLid.push({p: [sx * (TRAY.w / 2 - 1.5), y0 + TRAY.h / 2, TRAY.zc], s: [3, TRAY.h, TRAY.d], c: shade});
      lists.swFace.push({p: [0, y0 + TRAY.h / 2, zFront + 0.5], s: [TRAY.w + 6, TRAY.h, 3], c: shade});
      for (let j = 0; j < 2; j++) lists.port.push({p: [-170 + j * 22, y0 + 21, zFront + 2.2], s: [14, 10, 1]});
      for (const x of [-213, 213]) lists.handle.push({p: [x, y0 + 21, zFront + 6], s: [8, 30, 10]});
      for (let side = 0; side < 2; side++) {
        lists.swChip.push({p: [SL.chipX[side], y0 + 6, TRAY.zc + SL.chipZ], s: [SL.chipS, 4, SL.chipS]});
        lists.swPlate.push({p: [SL.chipX[side], y0 + 13, TRAY.zc + SL.chipZ], s: [SL.chipS + 14, 10, SL.chipS + 14]});
      }
    } else if (s.kind === 'power') {
      lists.psu.push({p: [0, y0 + TRAY.h / 2, 94], s: [TRAY.w, TRAY.h, 800], c: shade});
      for (let j = 0; j < SPEC.power.psuPerShelf; j++) {
        const x = -183 + j * 73.2;
        lists.psuFace.push({p: [x, y0 + 21, zFront + 1], s: [70, 38, 3], c: 0.95 + 0.1 * hash(k * 11 + j)});
        lists.vent.push({p: [x - 10, y0 + 21, zFront + 2.7], s: [36, 26, 0.8]});
        lists.led.push({p: [x + 24, y0 + 30, zFront + 2.7], s: [5, 3, 0.8]});
        // the shelf's fans at the back: it is air-cooled
        lists.vent.push({p: [x, y0 + 21, 94 - 400 - 0.8], s: [56, 34, 1.2]});
      }
      lists.clip.push({p: [BACK.busX, y0 + 21, (-306 + BACK.busZ + BACK.busD / 2) / 2], s: [40, 26, -306 - BACK.busZ - BACK.busD / 2]});
    } else if (s.kind === 'tor') {
      lists.tor.push({p: [0, y0 + TRAY.h / 2, 194], s: [TRAY.w, TRAY.h, 600], c: shade});
      for (let j = 0; j < 24; j++) for (let r = 0; r < 2; r++) lists.port.push({p: [-180 + j * 13.6 + (j >= 12 ? 8 : 0), y0 + 12 + r * 16, zFront + 0.2], s: [11, 9, 1]});
    } else {
      lists.blank.push({p: [0, y0 + U_MM / 2 - 0.5, zFront + 2], s: [TRAY.w + 6, U_MM - 1.5, 3], c: shade});
    }
  });
  // the switch trays' backs ride with the slide
  const swBack = {conn: [], qd: [], clip: []};
  SLOTS.filter((s) => s.kind === 'switch').forEach((s, k) => {
    const save = {conn: lists.conn, qd: lists.qd, clip: lists.clip, hoseS: lists.hoseS, hoseR: lists.hoseR};
    lists.conn = swBack.conn;
    lists.qd = swBack.qd;
    lists.clip = swBack.clip;
    trayBack(s.y0, 100 + k);
    Object.assign(lists, {conn: save.conn, qd: save.qd, clip: save.clip});
  });
  const IM = {};
  IM.tray = inst(F, M.tray, lists.tray);
  IM.face = inst(F, M.trayFace, lists.face);
  IM.cage = inst(F, M.cage, lists.cage);
  IM.mouth = inst(F, M.mouth, lists.mouth);
  IM.drive = inst(F, M.drive, lists.drive);
  IM.conn = inst(F, M.conn, lists.conn);
  IM.qd = inst(F, M.qd, lists.qd, CYL);
  IM.clip = inst(F, M.clip, lists.clip);
  IM.hoseS = inst(F, M.hoseS, lists.hoseS, CYL);
  IM.hoseR = inst(F, M.hoseR, lists.hoseR, CYL);
  IM.psu = inst(F, M.psu, lists.psu);
  IM.psuFace = inst(F, M.psuFace, lists.psuFace);
  IM.vent = inst(F, M.vent, lists.vent, BOX, false);
  IM.led = inst(F, M.led, lists.led, BOX, false);
  IM.tor = inst(F, M.tor, lists.tor);
  IM.port = inst(F, M.port, lists.port, BOX, false);
  IM.blank = inst(F, M.blank, lists.blank);
  // the switch trays (they slide together): handles of the compute trays stay in F
  const swHandles = lists.handle.filter((h) => SLOTS.some((s) => s.kind === 'switch' && Math.abs(s.y0 + 21 - h.p[1]) < 1));
  IM.handle = inst(F, M.handle, lists.handle.filter((h) => !swHandles.includes(h)));
  const SW = G.switches;
  IM.swPan = inst(SW, M.swPan, lists.swPan);
  IM.swLid = inst(SW, M.swLid, lists.swLid);
  IM.swFace = inst(SW, M.swFace, lists.swFace);
  IM.swHandle = inst(SW, M.handle, swHandles);
  IM.swChip = inst(SW, M.swChip, lists.swChip);
  IM.swPlate = inst(SW, M.swPlate, lists.swPlate);
  IM.swConn = inst(SW, M.conn, swBack.conn);
  IM.swQd = inst(SW, M.qd, swBack.qd, CYL);
  IM.swClip = inst(SW, M.clip, swBack.clip);

  // ------------------------------------------------------------ the back: cartridges, bus bar, manifolds
  const comp = SLOTS.filter((s) => s.kind === 'compute' || s.kind === 'switch');
  const yLo = Math.min(...comp.map((s) => s.y0)) - 10;
  const yHi = Math.max(...comp.map((s) => s.y0)) + TRAY.h + 10;
  const bands = [];
  BACK.cartX.forEach((x, i) => {
    bx(F, M.cart, [x - BACK.cartW / 2, x + BACK.cartW / 2], [yLo, yHi], [BACK.cartZ - BACK.cartD / 2, BACK.cartZ + BACK.cartD / 2]);
    // bundled copper: thin vertical bands on the back and the sides
    for (let j = 0; j < 7; j++) bands.push({p: [x - BACK.cartW / 2 + 5 + j * 7, (yLo + yHi) / 2, BACK.cartZ - BACK.cartD / 2 - 1.5], s: [4.2, yHi - yLo - 20, 3], c: 0.86 + 0.24 * hash(i * 7 + j)});
    for (const sx of [-1, 1]) bands.push({p: [x + sx * (BACK.cartW / 2 + 1), (yLo + yHi) / 2, BACK.cartZ], s: [2, yHi - yLo - 20, BACK.cartD - 12], c: 0.8});
    // clamps every few units
    for (let y = yLo + 60; y < yHi - 30; y += 180) bands.push({p: [x, y, BACK.cartZ], s: [BACK.cartW + 6, 10, BACK.cartD + 6], c: 0.55});
  });
  IM.band = inst(F, M.band, bands);
  const shelves = SLOTS.filter((s) => s.kind === 'power');
  const busLo = Math.min(...shelves.map((s) => s.y0));
  const busHi = Math.max(...shelves.map((s) => s.y0)) + TRAY.h;
  bx(F, M.bus, [BACK.busX - BACK.busW / 2, BACK.busX + BACK.busW / 2], [busLo, busHi], [BACK.busZ - BACK.busD / 2, BACK.busZ + BACK.busD / 2]);
  const manLo = 200;
  const manHi = yHi + 80;
  BACK.manX.forEach((x, i) => {
    const m = new THREE.Mesh(CYL, i ? M.manR : M.manS);
    m.scale.set(BACK.manR, manHi - manLo, BACK.manR);
    m.position.set(x, (manLo + manHi) / 2, BACK.manZ);
    m.castShadow = true;
    m.receiveShadow = true;
    F.add(m);
    // the feed pipes leave through the floor
    const f = new THREE.Mesh(CYL, i ? M.manR : M.manS);
    f.scale.set(BACK.manR * 0.8, manLo, BACK.manR * 0.8);
    f.position.set(x, manLo / 2, BACK.manZ);
    F.add(f);
  });
  // the detailed compute tray
  const tray = buildTray(K);
  root.add(tray.root);

  // ------------------------------------------------------------ anchors: where a label's leader lands
  const cY = (n) => SLOTS.find((s) => s.kind === 'compute' && s.n === n).y0;
  const sY = (n) => SLOTS.find((s) => s.kind === 'switch' && s.n === n).y0;
  const pY = (n) => SLOTS.find((s) => s.kind === 'power' && s.n === n).y0;
  const torY = SLOTS.find((s) => s.kind === 'tor' && s.n === 1).y0;
  pin('tor', F, 120, torY + 30, zFront + 1);
  pin('psTop', F, -110, pY(2) + 30, zFront + 3);
  pin('psBot', F, -110, pY(7) + 30, zFront + 3);
  pin('compute', F, 40, cY(6) + 21, zFront + 2);
  pin('computeLo', F, 40, cY(14) + 21, zFront + 2);
  pin('switch', SW, 40, sY(5) + 21, zFront + 2);
  pin('osfp', F, TL.cx7X[1], cY(8) + 21, zFront + 5);
  pin('e1sFront', F, TL.e1sX[2], cY(12) + 38, zFront + 3);
  pin('rackTop', F, 0, RACK.h, ZF - 120);
  pin('cart', F, BACK.cartX[0], (yLo + yHi) / 2 + 200, BACK.cartZ - BACK.cartD / 2 - 3);
  pin('cart2', F, BACK.cartX[3], (yLo + yHi) / 2 - 300, BACK.cartZ - BACK.cartD / 2 - 3);
  pin('bus', F, BACK.busX, busHi - 80, BACK.busZ - BACK.busD / 2);
  pin('busMid', F, BACK.busX, (cY(10) + sY(1)) / 2, BACK.busZ - BACK.busD / 2);
  pin('manS', F, BACK.manX[0], yHi - 120, BACK.manZ - BACK.manR);
  pin('manR', F, BACK.manX[1], yHi - 260, BACK.manZ - BACK.manR);
  pin('hose', F, (TL.qdX[0] + BACK.manX[0]) / 2, cY(5) + 21, BACK.manZ - 4);
  pin('psBack', F, 90, pY(3) + 30, -306 - 2);
  pin('psBackLo', F, 90, pY(6) + 30, -306 - 2);
  pin('psFan', F, -120, pY(2) + 32, -306 - 2);
  pin('psFanLo', F, -120, pY(7) + 32, -306 - 2);
  pin('conn', F, TL.nvlX[2], cY(4) + 36, zBack - 28);
  pin('chipTop', SW, SL.chipX[1], sY(1) + 18, TRAY.zc + SL.chipZ);
  pin('switchFace', SW, -100, sY(3) + 21, zFront + 2);
  pin('swBack', SW, 0, sY(5) + 10, zBack);
  for (const [k, a] of Object.entries(tray.anchors)) anchors[k] = a;

  // ------------------------------------------------------------ pose
  const tint = K.tint;
  const fade = K.fade;
  const colA = new THREE.Color();
  let lastChip = '';
  /**
   * look: {lifts: [pull, lid, plates, chips, io], slide 0..1, sides 0..1 (taken off), lidAway 0..1, hi: {sys: weight},
   *        chip: the switch chip in the accent (-1 none), ghostSw 0..1}
   */
  const update = (look = {}) => {
    tray.update(look);
    const slide = look.slide ?? 0;
    SW.position.z = slide * TRAY.slide;
    const sides = look.sides ?? 0;
    G.sides.visible = sides < 0.98;
    fade(M.side, 1 - sides);
    // chapter 3: the switch trays' lids and pans turn see-through, the chips stay
    const gs = look.ghostSw ?? 0;
    fade(M.swLid, 1 - 0.85 * gs);
    fade(M.swPan, 1 - 0.7 * gs);
    const hi = look.hi ?? {};
    for (const sys of ['power', 'bus', 'manS', 'manR', 'cart', 'switchChip', 'compute', 'conn', 'cool']) for (const m of K.reg[sys] ?? []) tint(m, hi[sys] ?? 0);
    // the liquid parts in chapter 7: the supply side in a pale accent, the return in the full accent
    const chip = look.chip ?? -1;
    const lit = look.chipsLit ?? 0;
    if (`${chip},${lit}` !== lastChip) {
      lastChip = `${chip},${lit}`;
      const over = (base) => colA.setRGB(K.accent.r / base.r, K.accent.g / base.g, K.accent.b / base.b);
      for (let c = 0; c < 18; c++) {
        const on = c === chip || c < lit;
        IM.swChip.setColorAt(c, on ? over(M.swChip.userData.base) : colA.setScalar(1));
        IM.swPlate.setColorAt(c, on ? over(M.swPlate.userData.base) : colA.setScalar(1));
      }
      IM.swChip.instanceColor.needsUpdate = true;
      IM.swPlate.instanceColor.needsUpdate = true;
    }
  };
  /** an anchor in world metres (follows the slid and pulled parts) */
  const anchor = (key) => {
    const a = anchors[key];
    a.obj.updateWorldMatrix(true, false);
    return a.obj.localToWorld(a.p.clone());
  };
  return {root, update, anchor, anchors, M, K, G, IM, tray, chipOf};
}
export {V3};
