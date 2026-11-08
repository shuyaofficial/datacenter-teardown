// The Q3400-RA, built from code in millimetres (the root is scaled by 0.001, so the scene is in metres): x across the
// front, y up from the floor, z front (+) to back (-). A simplified 4U box, 438 × 177.8 × 850 mm, no logo, no photo.
// Front: 72 OSFP cages in 3 sections × 4 rows × 6 columns (仮定) and a management column set apart on the left (the
// UFM port, RJ-45 × 2, USB, reset, LED). Back: 4 + 4 power supplies in the side columns and 5 × 2 fans between them
// (仮定). Inside (board.js): 4 Quantum-3 chips under heat sinks, the management CPU board, one bundle per chip to the
// cages. Beside it, the Catalyst 9300's outline in grey lines (chapter 1). update(look) poses it; nothing keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {buildBoard} from './board.js';
import {BOX} from './flow.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
export const hash = (i) => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};
export const BOXG = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 24);

/** the shared builders: materials that remember their base colour, boxes by extent, instanced boxes (as the rack's) */
export function makeKit() {
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
    const m = new THREE.Mesh(BOXG, mat);
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
  const inst = (parent, mat, list, geo = BOXG, cast = true) => {
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
  return {mk, metal, bx, inst, tint, fade, reg, accent};
}

export function buildBox() {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const K = makeKit();
  const {mk, metal, bx, inst} = K;
  const M = {
    body: mk('body', metal('#4a4e54', 0.55, 0.35)),
    face: mk('front', metal('#3a3d42', 0.6, 0.3)),
    grille: mk('front', {color: '#1d1f22', roughness: 0.85}),
    cage: mk('cage', metal('#a3a9b0', 0.42, 0.65)),
    mouth: mk('cage', {color: '#141518', roughness: 0.85}),
    ufm: mk('ufm', metal('#a3a9b0', 0.42, 0.65)),
    rj: mk('mgmt', {color: '#16171a', roughness: 0.8}),
    usb: mk('mgmt', metal('#9aa0a7', 0.45, 0.6)),
    led: mk('mgmt', {color: '#6aa37f', roughness: 0.5}),
    ear: mk('body', metal('#55595f', 0.5, 0.4)),
    lid: mk('lid', metal('#52565c', 0.55, 0.35)),
    psu: mk('psu', metal('#8c9198', 0.5, 0.4)),
    psuFace: mk('psu', metal('#9ea3a9', 0.5, 0.35)),
    vent: mk('psu', {color: '#25272a', roughness: 0.85}),
    handle: mk('psu', {color: '#2a2c30', roughness: 0.6}),
    fanBox: mk('fan', metal('#3d4045', 0.55, 0.3)),
    fanBlade: mk('fan', {color: '#26282c', roughness: 0.7}),
    hub: mk('fan', metal('#6c7076', 0.5, 0.4)),
  };
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  const G = {body: new THREE.Group(), lid: new THREE.Group(), rear: new THREE.Group(), ghost: new THREE.Group()};
  root.add(G.body, G.lid, G.rear, G.ghost);
  const B = G.body;
  const {w2: W2, h: H, zf: ZF, zb: ZB} = BOX;

  // ------------------------------------------------------------ the pan, the side walls, the front panel, the ears
  bx(B, M.body, [-W2, W2], [0, 3], [ZB, ZF]);
  for (const sx of [-1, 1]) bx(B, M.body, sx > 0 ? [W2 - 2, W2] : [-W2, -W2 + 2], [3, H - 2], [ZB, ZF]);
  bx(B, M.face, [-W2, W2], [0, H], [ZF - 3, ZF]);
  for (const sx of [-1, 1]) {
    const x = sx * W2;
    bx(B, M.ear, sx > 0 ? [x, x + BOX.ear] : [x - BOX.ear, x], [2, H - 2], [ZF - 3, ZF]);
    bx(B, M.ear, sx > 0 ? [x, x + 2] : [x - 2, x], [2, H - 2], [ZF - 40, ZF - 3]);
  }
  // the cages: 18 columns × 4 rows, the mouths, and the dark grille between the rows (the air comes in there)
  const cages = [];
  const mouths = [];
  const grille = [];
  BOX.cageX.forEach((x, c) =>
    BOX.rowY.forEach((y, r) => {
      cages.push({p: [x, y, ZF - BOX.cage.d / 2 + 1.6], s: [BOX.cage.w, BOX.cage.h, BOX.cage.d], c: 0.94 + 0.1 * hash(c * 5 + r)});
      mouths.push({p: [x, y, ZF + 1.7], s: [BOX.mouth.w, BOX.mouth.h, 0.6]});
    }),
  );
  const gx0 = BOX.cageX[0] - BOX.pitch / 2;
  const gx1 = BOX.cageX[BOX.cageX.length - 1] + BOX.pitch / 2;
  for (const y of [...BOX.rowY.map((v) => v + 17.5), BOX.rowY[0] - 17.5]) grille.push({p: [(gx0 + gx1) / 2, y, ZF + 0.3], s: [gx1 - gx0, 8, 0.8]});
  const IM = {};
  IM.cage = inst(B, M.cage, cages);
  IM.mouth = inst(B, M.mouth, mouths, BOXG, false);
  IM.grille = inst(B, M.grille, grille, BOXG, false);
  // the management column: set apart from the sections by a strip of bare panel
  const mx = BOX.mgX;
  bx(B, M.ufm, [mx - BOX.cage.w / 2, mx + BOX.cage.w / 2], [BOX.ufmY - BOX.cage.h / 2, BOX.ufmY + BOX.cage.h / 2], [ZF - 60, ZF + 1.6]);
  bx(B, M.mouth, [mx - BOX.mouth.w / 2, mx + BOX.mouth.w / 2], [BOX.ufmY - BOX.mouth.h / 2, BOX.ufmY + BOX.mouth.h / 2], [ZF + 1.4, ZF + 2], false);
  for (const y of BOX.rjY) bx(B, M.rj, [mx - 8, mx + 8], [y - 7, y + 7], [ZF - 20, ZF + 1], false);
  bx(B, M.usb, [mx - 6, mx + 6], [BOX.usbY - 2.6, BOX.usbY + 2.6], [ZF - 10, ZF + 0.8], false);
  bx(B, M.rj, [mx - 2, mx + 2], [BOX.resetY - 2, BOX.resetY + 2], [ZF - 2, ZF + 0.6], false);
  bx(B, M.led, [mx - 9, mx - 4], [BOX.ledY - 2, BOX.ledY + 2], [ZF - 1, ZF + 0.8], false);
  bx(B, M.led, [mx + 4, mx + 9], [BOX.ledY - 2, BOX.ledY + 2], [ZF - 1, ZF + 0.8], false);

  // ------------------------------------------------------------ the back: power supplies and fans (they lift together)
  const R = G.rear;
  const psus = [];
  const psuFaces = [];
  const vents = [];
  const handles = [];
  BOX.psuX.forEach((x, side) =>
    BOX.psuY.forEach((y, j) => {
      const k = side * 4 + j;
      psus.push({p: [x, y, ZB + BOX.psuD / 2], s: [BOX.psuW, BOX.psuH - 1.5, BOX.psuD], c: 0.95 + 0.1 * hash(k + 3)});
      psuFaces.push({p: [x, y, ZB - 1], s: [BOX.psuW, BOX.psuH - 1.5, 2], c: 0.95 + 0.1 * hash(k + 9)});
      vents.push({p: [x - 8, y, ZB - 2.3], s: [44, BOX.psuH - 14, 0.8]});
      handles.push({p: [x + 26, y, ZB - 6], s: [5, BOX.psuH - 16, 10]});
    }),
  );
  IM.psu = inst(R, M.psu, psus);
  IM.psuFace = inst(R, M.psuFace, psuFaces);
  IM.vent = inst(R, M.vent, vents, BOXG, false);
  IM.handle = inst(R, M.handle, handles);
  const fans = [];
  const blades = [];
  const hubs = [];
  const cylZ = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2);
  BOX.fanX.forEach((x, i) =>
    BOX.fanY.forEach((y, j) => {
      fans.push({p: [x, y, ZB + BOX.fanD / 2], s: [BOX.fanS, BOX.fanS, BOX.fanD], c: 0.94 + 0.12 * hash(i * 2 + j)});
      blades.push({p: [x, y, ZB - 0.4], s: [BOX.fanS * 0.44, 1, BOX.fanS * 0.44], q: cylZ});
      hubs.push({p: [x, y, ZB - 1.2], s: [BOX.fanS * 0.14, 1.2, BOX.fanS * 0.14], q: cylZ});
    }),
  );
  IM.fan = inst(R, M.fanBox, fans);
  IM.blade = inst(R, M.fanBlade, blades, CYL, false);
  IM.hub = inst(R, M.hub, hubs, CYL, false);
  // the rear panel strip that holds them (fixed)
  bx(B, M.body, [BOX.psuX[0] + BOX.psuW / 2, BOX.fanX[0] - BOX.fanS / 2], [3, H - 2], [ZB, ZB + 2]);
  bx(B, M.body, [BOX.fanX[4] + BOX.fanS / 2, BOX.psuX[1] - BOX.psuW / 2], [3, H - 2], [ZB, ZB + 2]);

  // ------------------------------------------------------------ the lid
  bx(G.lid, M.lid, [-W2, W2], [H - 2, H], [ZB, ZF - 3]);

  // ------------------------------------------------------------ inside
  const board = buildBoard(K, B);
  root.add(board.root);

  // ------------------------------------------------------------ the Catalyst 9300's outline (grey, no inside), fronts aligned
  const cat = SPEC.cat;
  const gx = -W2 - 70 - cat.w / 2;
  const ghostMat = new THREE.LineBasicMaterial({color: '#7d878d', transparent: true, opacity: 0.85});
  const ghost = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(cat.w, cat.h, cat.d)), ghostMat);
  ghost.position.set(gx, cat.h / 2, ZF - cat.d / 2);
  G.ghost.add(ghost);
  const ghostFill = new THREE.Mesh(BOXG, new THREE.MeshBasicMaterial({color: '#9aa3a8', transparent: true, opacity: 0.12, depthWrite: false}));
  ghostFill.scale.set(cat.w, cat.h, cat.d);
  ghostFill.position.copy(ghost.position);
  G.ghost.add(ghostFill);

  // ------------------------------------------------------------ anchors: where a label's leader lands
  const midRow = (BOX.rowY[1] + BOX.rowY[2]) / 2;
  pin('cages', B, BOX.cageX[9], BOX.rowY[3] + 9.5, ZF + 2);
  pin('cagesLo', B, BOX.cageX[15], BOX.rowY[0], ZF + 2);
  pin('ufm', B, mx, BOX.ufmY, ZF + 2);
  pin('rj45', B, mx, BOX.rjY[0], ZF + 1);
  pin('usb', B, mx, BOX.usbY, ZF + 1);
  pin('grille', B, BOX.cageX[4], midRow, ZF + 1);
  pin('cat', G.ghost, gx + cat.w * 0.25, cat.h, ZF);
  pin('ear', B, W2 + BOX.ear / 2, H - 20, ZF);
  pin('psu', R, BOX.psuX[0], BOX.psuY[3], ZB - 2);
  pin('psuR', R, BOX.psuX[1], BOX.psuY[0], ZB - 2);
  pin('fan', R, BOX.fanX[1], BOX.fanY[1], ZB - 2);
  pin('lid', G.lid, -W2 * 0.4, H, -ZF * 0.3);
  pin('psuOpen', R, BOX.psuX[1], BOX.psuY[3] + BOX.psuH / 2, ZB + BOX.psuD * 0.55);
  pin('fanOpen', R, BOX.fanX[3], BOX.fanY[1] + BOX.fanS / 2, ZB + BOX.fanD / 2);
  pin('intake', B, BOX.cageX[12], BOX.rowY[2] + 17.5, ZF + 1);
  pin('exhaust', R, BOX.fanX[3], BOX.fanY[0], ZB - 2);
  for (const [k, a] of Object.entries(board.anchors)) anchors[k] = a;

  // ------------------------------------------------------------ pose
  /** look: {lifts: [lid, heat, cpu, rear], ghost 0..1, lidSee 0..1, hi: {sys: weight}} */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0];
    G.lid.position.y = L[0] * BOX.lift.lid;
    // the lid also goes back, so the camera looks into the box past it
    G.lid.position.z = -L[0] * BOX.lift.lidBack;
    G.rear.position.y = L[3] * BOX.lift.rear;
    board.update(look);
    const g = look.ghost ?? 0;
    G.ghost.visible = g > 0.01;
    ghostMat.opacity = 0.85 * g;
    ghostFill.material.opacity = 0.12 * g;
    // the wind needs the inside: the lid turns see-through in chapter 7
    K.fade(M.lid, 1 - 0.82 * (look.lidSee ?? 0));
    const hi = look.hi ?? {};
    for (const sys of ['cage', 'ufm', 'fan', 'psu', 'chip', 'bundle']) for (const m of K.reg[sys] ?? []) K.tint(m, hi[sys] ?? 0);
  };
  /** an anchor in world metres (follows the lifted parts) */
  const anchor = (key) => {
    const a = anchors[key];
    a.obj.updateWorldMatrix(true, false);
    return a.obj.localToWorld(a.p.clone());
  };
  return {root, update, anchor, anchors, M, K, G, IM, board};
}
