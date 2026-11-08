// The two racks, built from code in millimetres (the root is scaled by 0.001, so the scene is in metres): x across the
// front, y up from the floor, z front (+) to back (-). The whole shape is 仮定 (AWS publishes no drawing): two racks of
// the NVL72's outline, two Trn2 servers in each, a server = 8 compute sleds + 1 host sled + 2 switch sleds (the count
// from a report, the order and the 2U height assumed). Behind the sleds the NeuronLink cables: the mesh inside every
// server and the Z ring that joins the four (down the racks and across behind them). In front, the EFA cables.
// The same shapes repeat 44 times, so every repeated part is one InstancedMesh; compute sled 5 of server 1 is the
// detailed one (sled.js) that slides out. Chapter 7 adds a plain NVL72 silhouette beside them. update(look) poses it.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {backCables, CL, efaCables, NV_AT, PULL, RACK, RACK_X, SERVERS, SLED, SLOTS, mirror} from './flow.js';
import {NVL, SPEC, U_MM} from './kin.js';
import {buildSled} from './sled.js';

const V3 = THREE.Vector3;
const hash = (i) => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
export const PALE = '#8fd0d4';

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
  /** a polyline as cylinders: pushes {p, s, q} entries into list */
  const UP = new V3(0, 1, 0);
  const tube = (list, pts, r) => {
    for (let i = 1; i < pts.length; i++) {
      const a = new V3(...pts[i - 1]);
      const b = new V3(...pts[i]);
      const d = b.clone().sub(a);
      const len = d.length();
      if (len < 0.5) continue;
      const q = new THREE.Quaternion().setFromUnitVectors(UP, d.normalize());
      list.push({p: a.clone().add(b).multiplyScalar(0.5).toArray(), s: [r, len + r, r], q});
    }
  };
  const tint = (m, w, to = accent) => m.color.copy(m.userData.base).lerp(to, w);
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
  return {mk, metal, bx, inst, tube, tint, fade, reg, accent, root};
}

export function buildRack() {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const K = makeKit(root);
  const {mk, metal, bx, inst, tube} = K;
  const M = {
    frame: mk('frame', metal('#5d6066', 0.55, 0.45)),
    base: mk('frame', {color: '#45474c', roughness: 0.8}),
    side: mk('side', metal('#6e7278', 0.6, 0.35)),
    blank: mk('frame', metal('#666a70', 0.6, 0.4)),
    sled: mk('compute', metal('#767a81', 0.55, 0.4)),
    face: mk('compute', metal('#8a8e95', 0.5, 0.4)),
    grille: mk('compute', {color: '#26282b', roughness: 0.85}),
    cage: mk('efaPort', metal('#9aa0a7', 0.42, 0.65)),
    mouth: mk('compute', {color: '#1f2124', roughness: 0.85}),
    handle: mk('compute', {color: '#2a2c30', roughness: 0.6}),
    host: mk('host', metal('#7f8389', 0.55, 0.4)),
    hostFace: mk('host', metal('#979ba1', 0.5, 0.35)),
    sw: mk('switch', metal('#6f737a', 0.55, 0.4)),
    swFace: mk('switch', metal('#7d8188', 0.5, 0.4)),
    port: mk('switch', {color: '#1f2124', roughness: 0.85}),
    conn: mk('conn', {color: '#2e3034', roughness: 0.7}),
    mesh: mk('nl', {color: '#4c5357', roughness: 0.55}),
    zc: mk('nlz', {color: '#4c5357', roughness: 0.55}),
    efa: mk('efa', {color: '#7c858a', roughness: 0.55}),
    led: mk('compute', {color: '#6aa37f', roughness: 0.5}),
  };
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});

  const G = {fixed: new THREE.Group(), sides: new THREE.Group(), nv: new THREE.Group()};
  root.add(G.fixed, G.sides, G.nv);
  const F = G.fixed;
  const X1 = RACK.w / 2;
  const ZF = RACK.zf;
  const P = RACK.post;
  const yBase = 100;

  // ------------------------------------------------------------ two frames: plinth, 4 posts, top cap, rails, side panels
  for (const cx of RACK_X) {
    bx(F, M.base, [cx - X1, cx + X1], [0, yBase], [-ZF, ZF]);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(F, M.frame, sx > 0 ? [cx + X1 - P, cx + X1] : [cx - X1, cx - X1 + P], [yBase, RACK.h - 40], sz > 0 ? [ZF - P, ZF] : [-ZF, -ZF + P]);
    bx(F, M.frame, [cx - X1, cx + X1], [RACK.h - 40, RACK.h], [-ZF, ZF]);
    for (const sx of [-1, 1]) for (const z of [ZF - 46, -ZF + 70]) bx(F, M.frame, [cx + sx * 230 - 6, cx + sx * 230 + 6].sort((a, b) => a - b), [yBase, RACK.top], [z - 6, z + 6]);
    for (const sx of [-1, 1]) bx(G.sides, M.side, sx > 0 ? [cx + X1, cx + X1 + 4] : [cx - X1 - 4, cx - X1], [yBase, RACK.h - 40], [-ZF + P, ZF - P]);
  }

  // ------------------------------------------------------------ the sleds
  const zFront = SLED.zc + SLED.d / 2; // 494
  const zBack = SLED.zc - SLED.d / 2; // -406
  const H = SLED.h;
  const L = {sled: [], face: [], grille: [], cage: [], mouth: [], handle: [], conn: [], host: [], hostFace: [], sw: [], swFace: [], port: [], blank: [], led: []};
  const sledServer = [];
  SLOTS.forEach((s, k) => {
    const y0 = s.y0;
    const shade = 0.95 + 0.1 * hash(k + 1);
    const yc = y0 + H / 2;
    for (const x of [-213, 213]) L.handle.push({p: [s.x + x, yc, zFront + 6], s: [8, 50, 10]});
    if (s.kind === 'compute') {
      if (s === PULL) {
        L.handle.length -= 2; // the detailed sled has its own
        return;
      }
      L.sled.push({p: [s.x, yc, SLED.zc], s: [SLED.w, H, SLED.d], c: shade});
      sledServer.push(s.server);
      L.face.push({p: [s.x, yc, zFront + 0.5], s: [SLED.w + 6, H, 3], c: shade});
      // the fans' intake grille, the 2 EFA ports, a status light
      for (const fx of CL.fanX) L.grille.push({p: [s.x + fx, yc, zFront + 2.2], s: [CL.fanS - 6, H - 22, 1]});
      for (const nx of CL.nicX) {
        L.cage.push({p: [s.x + nx, y0 + 30, zFront + 1], s: [30, 18, 8], c: 0.96 + 0.08 * hash(k * 7 + nx)});
        L.mouth.push({p: [s.x + nx, y0 + 30, zFront + 5.2], s: [24, 11, 1]});
      }
      L.led.push({p: [s.x - 172, y0 + 66, zFront + 2.4], s: [6, 4, 1]});
      for (const cx of CL.nlX) L.conn.push({p: [s.x + mirror(s.rack) * cx, yc, zBack - 14], s: [46, 30, 28], c: 0.95 + 0.1 * hash(k + cx)});
    } else if (s.kind === 'host') {
      L.host.push({p: [s.x, yc, SLED.zc], s: [SLED.w, H, SLED.d], c: shade});
      L.hostFace.push({p: [s.x, yc, zFront + 0.5], s: [SLED.w + 6, H, 3], c: shade});
      for (let j = 0; j < 4; j++) L.grille.push({p: [s.x - 150 + j * 62, yc + 8, zFront + 2.2], s: [50, 40, 1]});
      for (let j = 0; j < 4; j++) L.port.push({p: [s.x + 110 + j * 22, y0 + 20, zFront + 2.2], s: [14, 10, 1]});
    } else {
      L.sw.push({p: [s.x, yc, SLED.zc], s: [SLED.w, H, SLED.d], c: shade});
      L.swFace.push({p: [s.x, yc, zFront + 0.5], s: [SLED.w + 6, H, 3], c: shade});
      for (let j = 0; j < 12; j++) for (let r = 0; r < 2; r++) L.port.push({p: [s.x - 170 + j * 24, y0 + 28 + r * 22, zFront + 2.2], s: [18, 13, 1]});
    }
  });
  // blanks: the 2 units on top of each rack
  RACK_X.forEach((x, r) => {
    for (let u = 1; u <= 2; u++) L.blank.push({p: [x, RACK.top - u * U_MM + U_MM / 2, zFront + 2], s: [SLED.w + 6, U_MM - 1.5, 3], c: 0.96 + 0.06 * hash(r * 3 + u)});
  });
  const IM = {};
  IM.sled = inst(F, M.sled, L.sled);
  IM.face = inst(F, M.face, L.face);
  IM.grille = inst(F, M.grille, L.grille, BOX, false);
  IM.cage = inst(F, M.cage, L.cage);
  IM.mouth = inst(F, M.mouth, L.mouth, BOX, false);
  IM.handle = inst(F, M.handle, L.handle);
  IM.conn = inst(F, M.conn, L.conn);
  IM.host = inst(F, M.host, L.host);
  IM.hostFace = inst(F, M.hostFace, L.hostFace);
  IM.sw = inst(F, M.sw, L.sw);
  IM.swFace = inst(F, M.swFace, L.swFace);
  IM.port = inst(F, M.port, L.port, BOX, false);
  IM.blank = inst(F, M.blank, L.blank);
  IM.led = inst(F, M.led, L.led, BOX, false);

  // ------------------------------------------------------------ cables: the NeuronLink mesh and Z ring behind, EFA in front
  const cab = {mesh: [], z: [], efa: []};
  for (const c of backCables()) tube(cab[c.kind], c.pts, c.kind === 'z' ? 6 : 7);
  for (const pts of efaCables()) tube(cab.efa, pts, pts.length === 2 ? 22 : 5);
  IM.mesh = inst(F, M.mesh, cab.mesh, CYL);
  IM.zc = inst(F, M.zc, cab.z, CYL);
  IM.efa = inst(F, M.efa, cab.efa, CYL);

  // ------------------------------------------------------------ the detailed compute sled
  const sled = buildSled(K);
  root.add(sled.root);

  // ------------------------------------------------------------ chapter 7: a plain NVL72 silhouette (its size from nvl72's SPEC)
  const nvMat = new THREE.MeshStandardMaterial({color: '#9aa1a6', roughness: 0.8, metalness: 0, transparent: true, opacity: 0, depthWrite: false});
  const nvLine = new THREE.MeshStandardMaterial({color: '#7a8187', roughness: 0.8, transparent: true, opacity: 0, depthWrite: false});
  {
    const {w, h, d} = NVL.rack;
    const nb = new THREE.Mesh(BOX, nvMat);
    nb.scale.set(w, h, d);
    nb.position.set(NV_AT.x, h / 2, NV_AT.z);
    G.nv.add(nb);
    // its 27 trays as faint lines on the front, and the liquid manifolds behind
    const lines = [];
    for (let i = 0; i < 37; i++) lines.push({p: [NV_AT.x, 300 + i * 46, NV_AT.z + d / 2 + 1], s: [w - 120, 6, 2]});
    inst(G.nv, nvLine, lines, BOX, false);
  }
  G.nv.visible = false;

  // ------------------------------------------------------------ anchors: where a label's leader lands
  const sl = (server, kind, n) => SLOTS.find((s) => s.server === server && s.kind === kind && s.n === n);
  const yc = (s) => s.y0 + H / 2;
  pin('rackTop', F, RACK_X[1], RACK.h, ZF - 120);
  pin('server1', F, RACK_X[0] + 60, yc(sl(1, 'compute', 2)), zFront + 3);
  pin('server2', F, RACK_X[0] + 60, yc(sl(2, 'compute', 6)), zFront + 3);
  pin('compute', F, RACK_X[1] + 30, yc(sl(4, 'compute', 3)), zFront + 3);
  pin('host', F, RACK_X[1] - 60, yc(sl(4, 'host', 1)) + 8, zFront + 3);
  pin('switch', F, RACK_X[1] + 20, yc(sl(4, 'switch', 1)), zFront + 3);
  pin('efa', F, RACK_X[1] + CL.nicX[1], sl(3, 'compute', 3).y0 + 30, zFront + 6);
  pin('mesh', F, RACK_X[0] + CL.nlX[0] - 50, yc(sl(2, 'compute', 6)), -470);
  pin('zcab', F, 0, yc(sl(3, 'compute', 6)), -575);
  pin('zv', F, RACK_X[1] - CL.nlX[2], yc(sl(4, 'host', 1)), -470);
  pin('conn', F, RACK_X[0] + CL.nlX[3], yc(sl(1, 'compute', 2)), zBack - 28);
  pin('hostPull', F, RACK_X[0] - 80, yc(sl(1, 'host', 1)) + 10, zFront + 3);
  pin('nv', G.nv, NV_AT.x, NVL.rack.h, NV_AT.z + NVL.rack.d / 2);
  pin('trn', F, RACK_X[0], RACK.h, ZF);
  for (const [k, a] of Object.entries(sled.anchors)) anchors[k] = a;

  // ------------------------------------------------------------ pose
  const {tint, fade} = K;
  const pale = new THREE.Color(PALE);
  const col = new THREE.Color();
  let lastSv = '';
  /**
   * look: {lifts, sides 0..1 (taken off), lidAway, hi: {nl, nlz, efa, host, efaPort}, servers: [4 weights], nvK 0..1}
   */
  const update = (look = {}) => {
    sled.update(look);
    const sides = look.sides ?? 0;
    G.sides.visible = sides < 0.98;
    fade(M.side, 1 - sides);
    const hi = look.hi ?? {};
    tint(M.mesh, hi.nl ?? 0);
    tint(M.zc, hi.nlz ?? 0, pale);
    tint(M.efa, hi.efa ?? 0, pale);
    tint(M.cage, hi.efaPort ?? 0);
    for (const m of [M.host, M.hostFace]) tint(m, hi.host ?? 0);
    // the servers in the accent, one weight each (chapter 3: server 1; chapter 4: all four)
    const sv = (look.servers ?? [0, 0, 0, 0]).map((v) => v.toFixed(2)).join();
    if (sv !== lastSv) {
      lastSv = sv;
      const w = look.servers ?? [0, 0, 0, 0];
      sledServer.forEach((n, i) => {
        const base = M.sled.userData.base;
        col.copy(base).lerp(K.accent, w[n - 1] * 0.55);
        IM.sled.setColorAt(i, col.setRGB(col.r / base.r, col.g / base.g, col.b / base.b));
        IM.face.setColorAt(i, col);
      });
      IM.sled.instanceColor.needsUpdate = true;
      IM.face.instanceColor.needsUpdate = true;
    }
    const nvK = look.nvK ?? 0;
    G.nv.visible = nvK > 0.01;
    nvMat.opacity = 0.55 * nvK;
    nvLine.opacity = 0.7 * nvK;
  };
  /** an anchor in world metres (follows the pulled parts) */
  const anchor = (key) => {
    const a = anchors[key];
    a.obj.updateWorldMatrix(true, false);
    return a.obj.localToWorld(a.p.clone());
  };
  return {root, update, anchor, anchors, M, K, G, IM, sled, SERVERS};
}
export {V3};
