// The switch, built from code in millimetres (the root is scaled by 0.001, so the scene is in metres): x along the
// front (right = the NM side), y up (0 = the underside), z from the back (-) to the front (+). 1U, 445 x 44 x 409 mm,
// a simplified Catalyst 9300-48P: no logo, no marking, no photo. Front: 48 RJ-45 (two rows of 24, a small gap every
// 12 columns; Gi1/0/1 is the top-left jack, Gi1/0/2 the bottom-left, as on the real box), USB-A, USB console, status
// LEDs, and the NM-8X (8 x SFP+) at the right end. Back: PSU bay 1 (715 W) and bay 2 (a blank), 3 fans, 2 StackWise
// ports, 2 StackPower, RJ-45 console, management port, SSD slot. Board: 6 PHYs in a row behind the jacks, the UADP ASIC
// (removable heatsink) in the middle, the x86 CPU + one DDR4 + the eUSB flash to one side, the VRMs and fans at the back.
// update(look) poses it from the page's state: nothing here keeps time. Numbers come from kin.js's SPEC.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
const W = SPEC.chassis.w; // 445
const H = SPEC.chassis.h; // 44
const D = SPEC.chassis.d; // 409
const X1 = W / 2;
const ZF = D / 2 - 0; // 204.5 front face
const T = 2; // front / rear panel thickness
const PY = 5.6; // the board's top face
const hash = (i) => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};

/** layout of everything (mm); the labels and the cameras read it too */
export const L = {
  colX: (i) => -174.5 + i * 13.2 + (i >= 12 ? 5 : 0), // 24 jack columns, a gap after 12
  rowY: [29, 15], // top row = odd ports
  hole: {w: 11.6, h: 9.4},
  nm: {x0: 152, x1: 214, y0: 3, y1: 41, cx: 183},
  asic: {x: -20, z: 45, s: 42},
  cpu: {x: 120, z: 45, s: 36},
  ddr: {x0: 72, x1: 168, z: -41},
  eusb: {x: 178, z: 45},
  phyZ: 118,
  fan: {xs: [-40, 2, 44], s: 40},
  psu: {x0: -216, x1: -141, z1: -34},
  lift: [
    [0, 125, 0], // 天板
    [0, 80, 0], // ヒートシンク
    [0, 40, 48], // NM（上へ・前へ）
    [0, 22, -60], // 電源（上へ・後ろへ）
  ],
};
/** the port n (1..48) on the front face: Gi1/0/1 top-left, Gi1/0/2 bottom-left */
export const portPos = (n) => ({x: L.colX(Math.floor((n - 1) / 2)), y: L.rowY[(n - 1) % 2], z: ZF});
/** the six PHYs sit in front of the ASIC, each under 4 jack columns (8 ports) */
export const phyX = (k) => [0, 1, 2, 3].reduce((a, j) => a + L.colX(k * 4 + j), 0) / 4;

// the wiring: port -> PHY (short), PHY -> ASIC (manhattan lanes), ASIC -> CPU, CPU -> DDR4, CPU -> eUSB (mm points on the board)
const LANE = [84, 91, 98, 98, 91, 84];
const ENTRY = [-17, -10, -3.5, 3.5, 10, 17];
export const TRACES = (() => {
  const out = {};
  for (let k = 0; k < SPEC.phy; k++) {
    const xp = phyX(k);
    const xa = L.asic.x + ENTRY[k];
    out[`port-phy-${k}`] = {sys: 'data', pts: [[xp, 168], [xp, L.phyZ + 8]]};
    out[`phy-asic-${k}`] = {sys: 'data', pts: [[xp, L.phyZ - 8], [xp, LANE[k]], [xa, LANE[k]], [xa, L.asic.z + L.asic.s / 2]]};
  }
  out['asic-cpu'] = {sys: 'ctrl', pts: [[L.asic.x + L.asic.s / 2, L.cpu.z], [L.cpu.x - L.cpu.s / 2, L.cpu.z]]};
  out['cpu-ddr'] = {sys: 'ctrl', pts: [[L.cpu.x, L.cpu.z - L.cpu.s / 2], [L.cpu.x, L.ddr.z + 3]]};
  out['cpu-eusb'] = {sys: 'ctrl', pts: [[L.cpu.x + L.cpu.s / 2, L.cpu.z], [L.eusb.x - 6, L.eusb.z]]};
  return out;
})();
/** the point u (0..1) of the way along a trace, as [x, z] in mm (Phase B's packets ride on this) */
export function tracePoint(key, u) {
  const pts = TRACES[key].pts;
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let d = Math.min(1, Math.max(0, u)) * lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
    }
    d -= lens[i];
  }
  return pts[0];
}

export function buildChassis() {
  const root = new THREE.Group();
  root.scale.setScalar(0.001);
  const reg = {};
  const accent = new THREE.Color(C.accent);
  const mk = (sys, opts, acc = false) => {
    const m = new THREE.MeshStandardMaterial({roughness: 0.62, metalness: 0, envMapIntensity: 0.55, ...opts});
    (reg[sys] ||= []).push(m);
    m.userData = {sys, base: m.color.clone(), acc, op0: 1};
    return m;
  };
  const metal = (c, r = 0.5, m = 0.55) => ({color: c, roughness: r, metalness: m});
  const M = {
    cover: mk('shell', metal('#b6b9bd')),
    tray: mk('shell', metal('#a2a6ab', 0.55, 0.5)),
    panel: mk('shell', metal('#c4c7cb', 0.5, 0.45)),
    slot: mk('shell', {color: '#2a2c30', roughness: 0.8}),
    rear: mk('shell', metal('#b7bbc0')),
    dark: mk('shell', {color: '#2c2e32', roughness: 0.75}),
    blank: mk('shell', metal('#aeb2b7', 0.55, 0.45)),
    led: mk('shell', {color: '#ffffff', roughness: 0.5}),
    pcb: mk('board', {color: '#5b7260', roughness: 0.72}),
    pcb2: mk('board', {color: '#52695a', roughness: 0.72}),
    pcbNm: mk('board', {color: '#566e66', roughness: 0.72}),
    stand: mk('board', metal('#b9a76f', 0.5, 0.6)),
    jack: mk('data', metal('#9096a0', 0.45, 0.6)),
    contact: mk('data', metal('#b79f68', 0.4, 0.7)),
    inset: mk('data', {color: '#25272b', roughness: 0.85}),
    phy: mk('data', {color: '#303338', roughness: 0.6}, true),
    asicSub: mk('data', {color: '#6d7867', roughness: 0.65}, true),
    asicLid: mk('data', metal('#a7adb5', 0.35, 0.8), true),
    heat: mk('data', metal('#9ba1a9', 0.42, 0.65)),
    trData: mk('data', {color: '#bba974', roughness: 0.5, metalness: 0.3}, true),
    trCtrl: mk('ctrl', {color: '#bba974', roughness: 0.5, metalness: 0.3}, true),
    cpu: mk('ctrl', {color: '#6d7867', roughness: 0.65}, true),
    cpuLid: mk('ctrl', metal('#a7adb5', 0.35, 0.8), true),
    cpuSink: mk('ctrl', metal('#80858d', 0.5, 0.6)),
    ddr: mk('ctrl', {color: '#4f6a5a', roughness: 0.7}),
    ddrChip: mk('ctrl', {color: '#2d2f34', roughness: 0.6}, true),
    ddrSock: mk('ctrl', {color: '#2c2e32', roughness: 0.8}),
    eusb: mk('ctrl', {color: '#34373c', roughness: 0.6}, true),
    nmFace: mk('data', metal('#bfc2c6', 0.5, 0.45)),
    nmCage: mk('data', metal('#8d939b', 0.45, 0.6)),
    psu: mk('power', metal('#8a9097', 0.5, 0.5)),
    psuTop: mk('power', metal('#9ea3a9', 0.55, 0.4)),
    handle: mk('power', {color: '#3a3d42', roughness: 0.6}),
    psuLed: mk('power', {color: '#62a07a', roughness: 0.5}),
    fanFrame: mk('power', {color: '#2f3237', roughness: 0.65}),
    fanBlade: mk('power', {color: '#4b4f56', roughness: 0.6}),
    cap: mk('power', {color: '#41566c', roughness: 0.55}),
    coil: mk('power', {color: '#2a2c30', roughness: 0.7}),
  };
  const all = [];
  const add = (parent, mesh, cast = true) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    all.push(mesh);
    return mesh;
  };
  const BOX = new THREE.BoxGeometry(1, 1, 1);
  const bx = (parent, mat, [x0, x1], [y0, y1], [z0, z1], cast = true) => {
    const m = add(parent, new THREE.Mesh(BOX, mat), cast);
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return m;
  };
  const cylY = (parent, mat, r, x, y0, y1, z, seg = 20) => {
    const m = add(parent, new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), mat));
    m.position.set(x, (y0 + y1) / 2, z);
    return m;
  };
  /** a plate in the xy plane from zA to zB with rectangular holes [x0, x1, y0, y1] */
  const plateZ = (parent, mat, [x0, x1], [y0, y1], zA, zB, holes = []) => {
    const sh = new THREE.Shape();
    sh.moveTo(x0, y0);
    sh.lineTo(x1, y0);
    sh.lineTo(x1, y1);
    sh.lineTo(x0, y1);
    sh.closePath();
    for (const [a, b, c, d] of holes) {
      const p = new THREE.Path();
      p.moveTo(a, c);
      p.lineTo(a, d);
      p.lineTo(b, d);
      p.lineTo(b, c);
      p.closePath();
      sh.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(sh, {depth: zB - zA, bevelEnabled: false});
    g.translate(0, 0, zA);
    return add(parent, new THREE.Mesh(g, mat));
  };
  /** many boxes in one draw: [{p: [x, y, z] centre, s: [w, h, d], c?: colour multiplier}] */
  const inst = (parent, mat, list) => {
    const im = new THREE.InstancedMesh(BOX, mat, list.length);
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    list.forEach((o, i) => {
      m4.compose(new V3(...o.p), new THREE.Quaternion(), new V3(...o.s));
      im.setMatrixAt(i, m4);
      im.setColorAt(i, col.setScalar(o.c ?? 1));
    });
    im.castShadow = true;
    im.receiveShadow = true;
    parent.add(im);
    all.push(im);
    return im;
  };
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});

  // groups: what stays, and the four layers that lift
  const G = {fixed: new THREE.Group(), cover: new THREE.Group(), heat: new THREE.Group(), nm: new THREE.Group(), psu: new THREE.Group(), fans: []};
  root.add(G.fixed, G.cover, G.heat, G.nm, G.psu);
  const F = G.fixed;

  // ------------------------------------------------------------ the tray, the front and the rear panels
  const wallOut = X1 - 1.2; // the tray's walls, 1.2 thick; the cover's flanges wrap them from outside
  bx(F, M.tray, [-wallOut, wallOut], [0, 1.2], [-ZF + T, ZF - T]);
  for (const s of [-1, 1]) bx(F, M.tray, s > 0 ? [wallOut - 1.2, wallOut] : [-wallOut, -wallOut + 1.2], [0, 42.8], [-ZF + T, ZF - T]);
  // front panel: 48 jack holes, the NM bay, USB-A, the console port
  const holes = [];
  for (let n = 1; n <= SPEC.rj45; n++) {
    const p = portPos(n);
    holes.push([p.x - L.hole.w / 2, p.x + L.hole.w / 2, p.y - L.hole.h / 2, p.y + L.hole.h / 2]);
  }
  holes.push([L.nm.x0, L.nm.x1, L.nm.y0, L.nm.y1], [-211, -197, 19, 25], [-192, -183, 20.4, 23.6]);
  plateZ(F, M.panel, [-X1, X1], [0, H], ZF - T, ZF, holes);
  // the jacks seen through the holes: a dark inset, a gold contact bar
  const insets = [];
  const bars = [];
  for (let n = 1; n <= SPEC.rj45; n++) {
    const p = portPos(n);
    insets.push({p: [p.x, p.y, ZF - 1.3], s: [L.hole.w - 0.5, L.hole.h - 0.5, 1.6]});
    bars.push({p: [p.x, p.y - L.hole.h / 2 + 2, ZF - 0.55], s: [7.5, 0.7, 0.5]});
  }
  insets.push({p: [-204, 22, ZF - 1.3], s: [13.5, 5.5, 1.6]}, {p: [-187.5, 22, ZF - 1.3], s: [8.5, 3.1, 1.6]});
  inst(F, M.inset, insets);
  inst(F, M.contact, bars);
  // jack cages on the board: one per column, a little different in tone
  inst(F, M.jack, Array.from({length: SPEC.rj45Cols}, (_, i) => ({p: [L.colX(i), (PY + 35.4) / 2, (168 + ZF - T) / 2], s: [12.4, 35.4 - PY, ZF - T - 168], c: 0.94 + 0.1 * hash(i)})));
  // status LEDs above each jack: colour only, not lit
  const ledList = [];
  const ledCol = [];
  for (let n = 1; n <= SPEC.rj45; n++) {
    const p = portPos(n);
    ledList.push({p: [p.x - 3.2, p.y + (n % 2 ? 7.2 : 7.0), ZF + 0.1], s: [2.2, 1.5, 0.6]});
    ledCol.push(n % 9 === 0 ? '#c79a4a' : n % 13 === 0 ? '#6d7076' : '#5fa57a');
  }
  for (let i = 0; i < 5; i++) {
    ledList.push({p: [-210 + i * 3.4, 38, ZF + 0.1], s: [2.2, 1.5, 0.6]});
    ledCol.push(i === 3 ? '#c79a4a' : '#5fa57a');
  }
  const leds = inst(F, M.led, ledList);
  ledCol.forEach((c, i) => leds.setColorAt(i, new THREE.Color(c)));
  leds.instanceColor.needsUpdate = true;
  // rear panel: PSU bay 1 and the fans are holes; bay 2 is a blank cover; the rest are ports
  const fanHoles = L.fan.xs.map((x) => [x - 19, x + 19, 3, 41]);
  plateZ(F, M.rear, [-X1, X1], [0, H], -ZF, -ZF + T, [[L.psu.x0 - 1, L.psu.x1 + 1, 1.5, 42.5], ...fanHoles]);
  bx(F, M.blank, [-138, -64], [1.5, 42.5], [-ZF - 0.6, -ZF]);
  const port = (x0, x1, y0, y1) => {
    bx(F, M.rear, [x0 - 0.5, x1 + 0.5], [y0 - 0.5, y1 + 0.5], [-ZF - 0.5, -ZF]);
    bx(F, M.slot, [x0, x1], [y0, y1], [-ZF - 0.9, -ZF - 0.4]);
  };
  port(76, 110, 25, 38); // StackWise x2
  port(114, 148, 25, 38);
  port(156, 178, 25, 38); // StackPower x2
  port(182, 204, 25, 38);
  port(79, 92, 6, 18); // RJ-45 console
  port(98, 111, 6, 18); // management
  port(124, 156, 8, 16); // SSD slot

  // ------------------------------------------------------------ the board
  const pcb = (mat, xs, zs) => bx(F, mat, xs, [PY - 1.6, PY], zs);
  pcb(M.pcb, [-210, 210], [-30, 190]);
  pcb(M.pcb2, [-136, 210], [-190, -30]);
  const stands = [[-205, -25], [205, -25], [-205, 185], [205, 185], [-130, -185], [205, -185], [0, 100], [0, -100]];
  inst(F, M.stand, stands.map(([x, z]) => ({p: [x, (1.2 + PY - 1.6) / 2, z], s: [4, PY - 1.6 - 1.2, 4]})));
  // PHYs, six of them, one per 8 ports
  for (let k = 0; k < SPEC.phy; k++) bx(F, M.phy, [phyX(k) - 8, phyX(k) + 8], [PY, PY + 2.2], [L.phyZ - 8, L.phyZ + 8]);
  // the wiring: thin flat bands, the corners filled by extending each band half a width
  const TW = 1.8;
  for (const [key, tr] of Object.entries(TRACES)) {
    const mat = tr.sys === 'data' ? M.trData : M.trCtrl;
    const grp = new THREE.Group();
    F.add(grp);
    tr.pts.slice(1).forEach(([x, z], i) => {
      const [px, pz] = tr.pts[i];
      bx(grp, mat, [Math.min(px, x) - TW / 2, Math.max(px, x) + TW / 2], [PY, PY + 0.3], [Math.min(pz, z) - TW / 2, Math.max(pz, z) + TW / 2], false);
    });
    grp.name = key;
  }
  // the ASIC: substrate, lid, a few decoupling caps
  const A = L.asic;
  bx(F, M.asicSub, [A.x - A.s / 2, A.x + A.s / 2], [PY, PY + 1.4], [A.z - A.s / 2, A.z + A.s / 2]);
  bx(F, M.asicLid, [A.x - 12, A.x + 12], [PY + 1.4, PY + 2.6], [A.z - 12, A.z + 12]);
  inst(F, M.coil, Array.from({length: 18}, (_, i) => ({p: [A.x - 26 + (i % 9) * 6.5, PY + 0.5, A.z + (i < 9 ? -28 : 28) + (hash(i) - 0.5) * 2], s: [1.6, 1, 0.9]})));
  // the CPU with its low heatsink, one DDR4 module in a socket, the eUSB flash
  const P = L.cpu;
  bx(F, M.cpu, [P.x - P.s / 2, P.x + P.s / 2], [PY, PY + 1.2], [P.z - P.s / 2, P.z + P.s / 2]);
  bx(F, M.cpuLid, [P.x - 13, P.x + 13], [PY + 1.2, PY + 2.8], [P.z - 13, P.z + 13]);
  bx(F, M.cpuSink, [P.x - 17, P.x + 17], [PY + 2.8, PY + 4.6], [P.z - 17, P.z + 17]);
  inst(F, M.cpuSink, Array.from({length: 9}, (_, i) => ({p: [P.x - 16 + i * 4, PY + 4.6 + 4, P.z], s: [1.2, 8, 34]})));
  bx(F, M.ddrSock, [L.ddr.x0 - 2, L.ddr.x1 + 2], [PY, PY + 4.5], [L.ddr.z - 3, L.ddr.z + 3]);
  bx(F, M.ddr, [L.ddr.x0, L.ddr.x1], [PY + 4.5, PY + 4.5 + 31], [L.ddr.z - 0.6, L.ddr.z + 0.6]);
  inst(
    F,
    M.ddrChip,
    Array.from({length: 8}, (_, i) => ({p: [L.ddr.x0 + 14 + (i % 4) * 22, PY + 4.5 + 17, L.ddr.z + (i < 4 ? 1.4 : -1.4)], s: [14, 11, 0.9]})),
  );
  bx(F, M.eusb, [L.eusb.x - 6, L.eusb.x + 6], [PY, PY + 1.8], [L.eusb.z - 8.5, L.eusb.z + 8.5]);
  // the VRMs at the back: coils and capacitors
  inst(F, M.coil, Array.from({length: 6}, (_, i) => ({p: [-55 + i * 22, PY + 3, -110], s: [12, 6, 12]})));
  const capsG = new THREE.Group();
  F.add(capsG);
  for (let i = 0; i < 7; i++) cylY(capsG, M.cap, 4.2, -62 + i * 20, PY, PY + 12, -128, 18);

  // ------------------------------------------------------------ the cover (layer 1): top plate, side flanges, vents
  const C0 = G.cover;
  bx(C0, M.cover, [-X1, X1], [42.8, H], [-ZF + T, ZF - T]);
  for (const s of [-1, 1]) bx(C0, M.cover, s > 0 ? [wallOut, X1] : [-X1, -wallOut], [32, 44], [-ZF + T, ZF - T]);
  const slots = [];
  for (const cx of [-20, 120]) for (let i = 0; i < 12; i++) for (let j = 0; j < 5; j++) slots.push({p: [cx - 22 + i * 4, H + 0.05, 8 + (cx > 0 ? 8 : 0) + j * 14], s: [1.6, 0.2, 9]});
  inst(C0, M.dark, slots);

  // ------------------------------------------------------------ the ASIC's heatsink (layer 2): base and 17 fins
  const HS = G.heat;
  bx(HS, M.heat, [A.x - 24, A.x + 24], [PY + 2.6, PY + 5.6], [A.z - 24, A.z + 24]);
  inst(HS, M.heat, Array.from({length: 17}, (_, i) => ({p: [A.x - 22.4 + i * 2.8, PY + 5.6 + 11, A.z], s: [1.2, 22, 48]})));
  bx(HS, M.handle, [A.x - 30, A.x + 30], [PY + 5.6 + 22, PY + 5.6 + 24], [A.z - 1, A.z + 1]);

  // ------------------------------------------------------------ the NM-8X (layer 3): faceplate, 8 SFP+ cages, card
  const N = G.nm;
  const sfpX = (j) => L.nm.cx + (j - 1.5) * 12.6;
  const sfpY = [29, 14];
  const sfpHoles = [];
  for (const y of sfpY) for (let j = 0; j < 4; j++) sfpHoles.push([sfpX(j) - 5.7, sfpX(j) + 5.7, y - 4, y + 4]);
  plateZ(N, M.nmFace, [L.nm.x0 + 0.4, L.nm.x1 - 0.4], [L.nm.y0 + 0.4, L.nm.y1 - 0.4], ZF - T, ZF + 0.4, sfpHoles);
  const cages = [];
  for (const y of sfpY) for (let j = 0; j < 4; j++) cages.push({p: [sfpX(j), y, ZF - T - 25], s: [12, 9.4, 50]});
  inst(N, M.nmCage, cages);
  inst(
    N,
    M.inset,
    sfpHoles.map(([a, b, c, d]) => ({p: [(a + b) / 2, (c + d) / 2, ZF - 0.6], s: [b - a - 0.4, d - c - 0.4, 1.2]})),
  );
  bx(N, M.pcbNm, [L.nm.x0 + 3, L.nm.x1 - 3], [20.6, 22.2], [ZF - T - 100, ZF - T]);

  // ------------------------------------------------------------ PSU bay 1 (layer 4): the 715 W module
  const PS = G.psu;
  const PX = L.psu;
  bx(PS, M.psu, [PX.x0, PX.x1], [2, 42], [PX.z1, -ZF + T]);
  bx(PS, M.psuTop, [PX.x0, PX.x1], [2, 42], [-ZF - 0.6, -ZF + T]);
  bx(PS, M.handle, [PX.x0 + 8, PX.x1 - 8], [30, 35], [-ZF - 4, -ZF - 0.6]);
  inst(PS, M.dark, Array.from({length: 7}, (_, i) => ({p: [PX.x0 + 10 + i * 9.5, 15, -ZF - 0.7], s: [5, 2.2, 0.4]})));
  bx(PS, M.psuLed, [PX.x1 - 12, PX.x1 - 8], [37, 39], [-ZF - 0.9, -ZF - 0.5]);

  // ------------------------------------------------------------ the 3 fans at the back (they spin)
  L.fan.xs.forEach((x) => {
    const g = new THREE.Group();
    g.position.set(x, 22, -ZF + 14);
    F.add(g);
    const s = L.fan.s;
    for (const [dx, dy, w, h] of [[0, s / 2 - 0.9, s, 1.8], [0, -s / 2 + 0.9, s, 1.8], [s / 2 - 0.9, 0, 1.8, s], [-s / 2 + 0.9, 0, 1.8, s]]) bx(g, M.fanFrame, [dx - w / 2, dx + w / 2], [dy - h / 2, dy + h / 2], [-14, 14]);
    const rotor = new THREE.Group();
    g.add(rotor);
    const hub = add(rotor, new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 6, 24), M.fanFrame));
    hub.rotation.x = Math.PI / 2;
    for (let b = 0; b < 7; b++) {
      const arm = new THREE.Group();
      arm.rotation.z = (b / 7) * Math.PI * 2;
      rotor.add(arm);
      const blade = bx(arm, M.fanBlade, [4, 17.5], [-2.6, 2.6], [-0.6, 0.6]);
      blade.rotation.x = 0.5;
    }
    G.fans.push(rotor);
    bx(g, M.fanFrame, [-0.6, 0.6], [-s / 2, s / 2], [-14, -13]);
    bx(g, M.fanFrame, [-s / 2, s / 2], [-0.6, 0.6], [-14, -13]);
  });

  // ------------------------------------------------------------ anchors: where a label's leader lands
  const colMid = L.colX(6);
  pin('rj45', F, colMid, 35, ZF);
  pin('gi1', F, portPos(1).x, portPos(1).y + 4.8, ZF);
  pin('gi2', F, portPos(2).x, portPos(2).y - 4.8, ZF);
  pin('nm', F, L.nm.cx, 41, ZF);
  pin('nmOpen', N, L.nm.cx, 41, ZF + 0.4);
  pin('usb', F, -204, 25, ZF);
  pin('led', F, -202, 38.8, ZF);
  pin('psu', F, (PX.x0 + PX.x1) / 2, 42.5, -ZF);
  pin('psuOpen', PS, (PX.x0 + PX.x1) / 2, 42, -ZF - 0.6);
  pin('blank', F, -101, 42.5, -ZF - 0.6);
  pin('fans', F, L.fan.xs[1], 42, -ZF);
  pin('stack', F, 93, 38.5, -ZF - 0.9);
  pin('stackpwr', F, 180, 38.5, -ZF - 0.9);
  pin('console', F, 85.5, 18.5, -ZF - 0.5);
  pin('mgmt', F, 104.5, 18.5, -ZF - 0.5);
  pin('ssd', F, 140, 16.5, -ZF - 0.5);
  pin('cover', C0, 70, H, -10);
  pin('heat', HS, A.x + 20, PY + 5.6 + 22, A.z - 20);
  pin('asic', F, A.x - 21, PY + 1.4, A.z + 10);
  pin('phy', F, phyX(2), PY + 2.2, L.phyZ - 4);
  pin('cpu', F, P.x - 17, PY + 4.6, P.z - 14);
  pin('ddr', F, L.ddr.x1 - 6, PY + 4.5 + 31, L.ddr.z);
  pin('eusb', F, L.eusb.x, PY + 1.8, L.eusb.z - 8);
  pin('vrm', F, 0, PY + 6, -110);
  pin('trAsicCpu', F, 52, PY + 0.3, L.cpu.z);
  pin('trPhyAsic', F, phyX(4), PY + 0.3, LANE[4]);
  pin('trPortPhy', F, phyX(1), PY + 0.3, 150);
  pin('nmSide', F, X1, 30, 70);
  pin('fansSide', F, L.fan.xs[2], 42, -ZF + 14);

  // ------------------------------------------------------------ pose
  const lerpC = new THREE.Color();
  const ghostNow = {};
  // a material's opacity = its ghost (the other plane) x its own fade (the lifted cover turns see-through)
  const refresh = (m) => {
    const o = (1 - 0.88 * (m.userData.gk ?? 0)) * (m.userData.fade ?? 1);
    if (Math.abs(m.opacity - o) < 1e-4) return;
    m.opacity = o;
    const tr = o < 0.999;
    if (m.transparent !== tr || m.depthWrite !== o > 0.5) {
      m.transparent = tr;
      m.depthWrite = o > 0.5;
      m.needsUpdate = true;
    }
  };
  const setGhost = (sys, k) => {
    if (Math.abs((ghostNow[sys] ?? 0) - k) < 1e-3) return;
    ghostNow[sys] = k;
    for (const m of reg[sys]) {
      m.userData.gk = k;
      refresh(m);
    }
  };
  const tint = (m, w) => m.color.copy(lerpC.copy(m.userData.base).lerp(accent, w));
  const layers = [C0, HS, N, PS];
  /**
   * look: {lifts: [cover, heatsink, NM, PSU] 0..1, T: seconds (the fans turn), plane: null | 'data' | 'ctrl', planeK: 0..1}
   */
  const update = (look = {}) => {
    const lifts = look.lifts ?? [0, 0, 0, 0];
    layers.forEach((g, i) => g.position.set(L.lift[i][0] * lifts[i], L.lift[i][1] * lifts[i], L.lift[i][2] * lifts[i]));
    // chapter 7: the fans are what works
    const fk = look.fanK ?? 0;
    tint(M.fanFrame, 0.55 * fk);
    tint(M.fanBlade, 0.7 * fk);
    // the lifted cover turns see-through, so the board under it still reads from an oblique camera
    const cv = 1 - 0.8 * Math.min(1, lifts[0] * 1.6);
    for (const m of [M.cover]) {
      m.userData.fade = cv;
      refresh(m);
    }
    // chapters 4-7 take the cover (and in 4-6 the heatsink) away: it rises out of the view and is gone
    // (the cover fades out where it is; the heatsink lifts a little and is gone)
    const away = look.away ?? [0, 0];
    M.cover.userData.fade = cv * (1 - Math.min(1, away[0] * 1.6));
    refresh(M.cover);
    C0.visible = away[0] < 0.6;
    HS.position.y += 40 * away[1];
    HS.visible = away[1] < 0.35;
    G.fans.forEach((f, i) => (f.rotation.z = -(look.T ?? 0) * (7 + i * 0.3)));
    const plane = look.plane ?? null;
    const k = plane ? (look.planeK ?? 1) : 0;
    // the chosen side takes the accent on its working parts; every other system ghosts so the chosen one reads in place
    for (const sys of Object.keys(reg)) {
      setGhost(sys, sys === plane ? 0 : k);
      for (const m of reg[sys]) if (m.userData.acc) tint(m, sys === plane ? 0.78 * k : 0);
    }
  };
  /** an anchor in world metres (follows the lifted layers) */
  const anchor = (key) => {
    const a = anchors[key];
    a.obj.updateWorldMatrix(true, false);
    return a.obj.localToWorld(a.p.clone());
  };
  return {root, update, anchor, anchors, M, reg, all, G, L, TRACES};
}
export {V3};
