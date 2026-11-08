// The CDU, built from code in CDU-local millimetres (flow.js CDU / PIPES / PARTS; the stage scales the world by 0.001):
// a simplified Vertiv CoolChip CDU 600, 2,000 x 600 x 1,200 mm, no logo, no photo. A dark cabinet on a plinth, two front
// doors (the 7-inch touch panel high on the left leaf), four 2.5-inch ports on the roof. Inside, from the top: the
// electrical panel (2 inverters, the control board, breakers) and the 10 L makeup tank; the brazed-plate heat exchanger
// (寸法は仮定) and the facility-side control valve; the two pumps side by side with their filters and check valves; the
// drip tray with the leak sensor on the floor. The places are 仮定 (the sources have no drawing).
// Also the shared builders (makeKit) and pipes as instanced cylinders. update(look) poses it; nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {CDU, COLORS, HX, leakPose, PARTS, PIPE_R, PIPES, PORTS, PUMP, TIER_SHIFT} from './flow.js';
import {SPEC} from './kin.js';

const V3 = THREE.Vector3;
export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 20);
const BALL = new THREE.SphereGeometry(1, 14, 10);
const UP = new V3(0, 1, 0);
export const hash = (i) => {
  const s = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
  return s - Math.floor(s);
};

/** the shared builders: materials that remember their base colour, boxes by extent, instanced boxes / cylinders */
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
  return {mk, metal, bx, inst, tint, fade, reg, accent};
}

/** a pipe along a polyline: cylinders for the runs and balls for the bends, as instance lists */
export function pipeParts(pts, r) {
  const cyl = [];
  const ball = [];
  for (let i = 1; i < pts.length; i++) {
    const a = new V3(...pts[i - 1]);
    const b = new V3(...pts[i]);
    const d = b.clone().sub(a);
    const len = d.length();
    if (len < 1e-6) continue;
    cyl.push({p: a.clone().add(b).multiplyScalar(0.5).toArray(), s: [r, len, r], q: new THREE.Quaternion().setFromUnitVectors(UP, d.normalize())});
    if (i < pts.length - 1) ball.push({p: pts[i], s: [r, r, r]});
  }
  return {cyl, ball};
}
export const addPipes = (K, parent, mat, lines, r) => {
  const cyl = [];
  const ball = [];
  for (const pts of lines) {
    const p = pipeParts(pts, r);
    cyl.push(...p.cyl);
    ball.push(...p.ball);
  }
  return {cyl: K.inst(parent, mat, cyl, CYL), ball: K.inst(parent, mat, ball, BALL)};
};
const qX = new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), Math.PI / 2); // a cylinder along z
const qZ = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.PI / 2); // a cylinder along x

export function buildCdu(K) {
  const {mk, metal, bx, inst} = K;
  const root = new THREE.Group();
  root.position.z = CDU.z;
  const M = {
    shell: mk('shell', metal('#4b5056', 0.6, 0.35)),
    plinth: mk('shell', {color: '#34373b', roughness: 0.8}),
    inside: mk('shell', {color: '#8a9196', roughness: 0.75}),
    door: mk('door', metal('#50555b', 0.58, 0.35)),
    grille: mk('door', {color: '#2c2f33', roughness: 0.85}),
    handle: mk('door', metal('#9aa0a5', 0.4, 0.6)),
    bezel: mk('panel', {color: '#24272a', roughness: 0.5}),
    display: new THREE.MeshBasicMaterial({color: '#a9bcc6', toneMapped: false}),
    steel: mk('pipe', metal('#a9afb4', 0.45, 0.6)),
    flange: mk('pipe', metal('#8f969b', 0.5, 0.55)),
    hxFrame: mk('hx', metal('#5f6f7c', 0.55, 0.4)),
    hxPlate: mk('hx', metal('#b8bec2', 0.42, 0.65)),
    rod: mk('hx', metal('#9aa1a6', 0.4, 0.7)),
    motor: mk('pump', metal('#4f6170', 0.55, 0.35)),
    volute: mk('pump', metal('#6b7378', 0.5, 0.45)),
    imp: mk('imp', {color: '#2b2f33', roughness: 0.6}),
    blade: mk('imp', metal('#a3aaaf', 0.4, 0.65)),
    skid: mk('pump', {color: '#33363a', roughness: 0.75}),
    filter: mk('filter', metal('#8e959a', 0.5, 0.5)),
    valve: mk('valve', metal('#7e868c', 0.5, 0.5)),
    lever: mk('valve', {color: '#3a3d41', roughness: 0.6}),
    tank: mk('tank', metal('#b7bdc1', 0.45, 0.6)),
    mark: mk('tank', {color: '#3a3d41', roughness: 0.6}),
    elec: mk('elec', {color: '#c9cdd0', roughness: 0.7}),
    breaker: mk('elec', {color: '#2b2e32', roughness: 0.7}),
    inv: mk('elec', metal('#5b6268', 0.55, 0.4)),
    board: mk('elec', {color: '#56695d', roughness: 0.72}),
    tray: mk('tray', metal('#8b9196', 0.5, 0.45)),
    sensor: mk('sensor', {color: '#3a3d41', roughness: 0.6}),
    probe: mk('probe', metal('#7b8389', 0.45, 0.55)),
    water: new THREE.MeshStandardMaterial({color: COLORS.tcsS, roughness: 0.15, metalness: 0, transparent: true, opacity: 0.85}),
  };
  const anchors = {};
  const pin = (key, obj, x, y, z) => (anchors[key] = {obj, p: new V3(x, y, z)});
  const G = {fixed: new THREE.Group(), top: new THREE.Group(), mid: new THREE.Group(), bot: new THREE.Group()};
  root.add(G.fixed, G.top, G.mid, G.bot);
  const F = G.fixed;
  const X = CDU.w / 2;
  const Z = CDU.d / 2;
  const T = CDU.wall;

  // ------------------------------------------------------------ the cabinet: plinth, walls, roof, back, inner floor
  bx(F, M.plinth, [-X, X], [0, CDU.plinth], [-Z, Z - 30]);
  for (const sx of [-1, 1]) bx(F, M.shell, sx > 0 ? [X - T, X] : [-X, -X + T], [CDU.plinth, CDU.h - CDU.roof], [-Z, Z]);
  bx(F, M.shell, [-X, X], [CDU.h - CDU.roof, CDU.h], [-Z, Z]);
  bx(F, M.inside, [-X + T, X - T], [CDU.plinth, CDU.h - CDU.roof], [-Z, -Z + T]);
  // the front frame around the doors
  bx(F, M.shell, [-X, X], [CDU.h - CDU.roof - 8, CDU.h - CDU.roof], [Z - 30, Z]);
  // the ports on the roof: a collar and a flange each
  const collars = [];
  const flanges = [];
  for (const [k, [x, z]] of Object.entries(PORTS).filter(([k]) => k !== 'r')) {
    collars.push({p: [x, CDU.h + 20, z], s: [PORTS.r + 6, 40, PORTS.r + 6]});
    flanges.push({p: [x, CDU.h + 44, z], s: [PORTS.r + 18, 10, PORTS.r + 18]});
    pin(`port_${k}`, F, x + (x > 0 ? 1 : -1) * (PORTS.r + 18), CDU.h + 44, z);
  }
  inst(F, M.flange, collars, CYL);
  inst(F, M.flange, flanges, CYL);

  // ------------------------------------------------------------ the doors (two leaves, hinged at the sides)
  const doors = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * X, 0, Z);
    root.add(pivot);
    // the leaf runs from the hinge (x = 0) toward the middle (x = -side * 298)
    const leaf = new THREE.Group();
    pivot.add(leaf);
    const w = X - 2;
    const xs = (a, b) => (side < 0 ? [a, b] : [-b, -a]);
    bx(leaf, M.door, xs(0, w), [CDU.door.y0, CDU.door.y1], [-CDU.door.t, 0]);
    bx(leaf, M.grille, xs(40, w - 40), [220, 760], [0, 2], false);
    bx(leaf, M.handle, xs(w - 34, w - 22), [1050, 1290], [0, 22]);
    if (side < 0) {
      const p = CDU.panel;
      bx(leaf, M.bezel, [p.x - p.w / 2, p.x + p.w / 2], [p.y - p.h / 2, p.y + p.h / 2], [0, 10]);
      const disp = new THREE.Mesh(new THREE.PlaneGeometry(p.dispW, p.dispH), M.display);
      disp.position.set(p.x, p.y, 10.6);
      leaf.add(disp);
      pin('panel', leaf, p.x, p.y, 11);
      pin('panelEdge', leaf, p.x + p.w / 2, p.y, 11);
    }
    doors.push({pivot, side});
  }
  pin('cduFront', F, -X + 40, 1300, Z);
  pin('cduTop', F, 0, CDU.h, Z - 120);
  pin('cdu', F, -X, 1100, Z - 200);

  // ------------------------------------------------------------ the pipes (fixed). The ends at the HX stop at its nozzles
  const trim = (pts, which, y) => pts.map((p, i) => ((which === 0 && i === 0) || (which === 1 && i === pts.length - 1) ? [p[0], y, p[2]] : p));
  addPipes(
    K,
    F,
    M.steel,
    [
      trim(PIPES.tcsOut, 0, HX.y0 - 40),
      PIPES.tcsIn,
      [PIPES.disA[1], PIPES.disA[2]],
      trim(PIPES.hxIn, 1, HX.y1 + 40),
      trim(PIPES.fwsIn, 1, HX.y0 - 40),
      trim(PIPES.fwsOut, 0, HX.y1 + 40),
      // the ports' short risers through the roof
      [[PORTS.tcsS[0], 2000, PORTS.tcsS[1]], [PORTS.tcsS[0], CDU.h - CDU.roof - 2, PORTS.tcsS[1]]],
    ],
    PIPE_R,
  );
  // the relief valve and the air vent on the coolant side; the 500 µm filter on the facility side
  {
    const {relief: r, vent: v, fwsFilter: f} = PARTS;
    inst(F, M.valve, [{p: [r.x + PIPE_R + 30, r.y, r.z], s: [18, 60, 18], q: qZ}, {p: [r.x + PIPE_R + 66, r.y, r.z], s: [26, 14, 26], q: qZ}, {p: [v.x - PIPE_R - 26, v.y, v.z], s: [15, 52, 15], q: qZ}, {p: [v.x - PIPE_R - 56, v.y + 10, v.z], s: [22, 40, 22]}], CYL);
    inst(F, M.filter, [{p: [f.x, (f.y[0] + f.y[1]) / 2, f.z], s: [f.r, f.y[1] - f.y[0], f.r]}, {p: [f.x, f.y[0] - 10, f.z], s: [f.r + 8, 12, f.r + 8]}, {p: [f.x, f.y[1] + 10, f.z], s: [f.r + 8, 12, f.r + 8]}], CYL);
    pin('relief', F, r.x + PIPE_R + 80, r.y, r.z);
    pin('vent', F, v.x - PIPE_R - 56, v.y + 30, v.z);
    pin('fwsFilter', F, f.x - f.r, (f.y[0] + f.y[1]) / 2, f.z);
  }
  // the sensors: 温度 6, 圧力 4, 流量計 2 (small probes and gauges on the pipes)
  {
    const pr = [];
    const add = (x, y, z, dir) => pr.push({p: [x + dir * (PIPE_R + 22), y, z], s: [9, 44, 9], q: qZ}, {p: [x + dir * (PIPE_R + 46), y, z], s: [15, 12, 15], q: qZ});
    for (const y of [1000, 1080, 1160]) add(140, y, -300, 1); // 冷却液の行き ×3
    add(140, 1320, -460, 1); // 冷却液の戻り
    add(-140, 1300, -300, -1); // 施設の水の行き
    add(-140, 1700, -460, -1); // 施設の水の戻り
    for (const y of [1240, 1400]) add(140, y, -300, 1); // 圧力: 冷却液の行き ×2
    for (const y of [1150, 1230]) add(140, y, -460, 1); // 圧力: 冷却液の戻り ×2
    inst(F, M.probe, pr, CYL, false);
    inst(F, M.flange, [{p: [140, 900, -300], s: [PIPE_R + 12, 90, PIPE_R + 12]}, {p: [-140, 940, -300], s: [PIPE_R + 12, 90, PIPE_R + 12]}], CYL);
    pin('sensors', F, 140 + PIPE_R + 52, 1080, -300);
  }

  // ------------------------------------------------------------ the drip tray and the leak sensor (floor)
  {
    const t = CDU.tray;
    bx(F, M.tray, [-t.x, t.x], [t.y, t.y + t.t], [t.z0, t.z1]);
    for (const sx of [-1, 1]) bx(F, M.tray, sx > 0 ? [t.x - 6, t.x] : [-t.x, -t.x + 6], [t.y + t.t, t.y + t.t + t.lip], [t.z0, t.z1]);
    bx(F, M.tray, [-t.x, t.x], [t.y + t.t, t.y + t.t + t.lip], [t.z1 - 6, t.z1]);
    const s = PARTS.sensor;
    bx(F, M.sensor, [s.x - 34, s.x + 34], [t.y + t.t, t.y + t.t + 14], [s.z - 16, s.z + 16]);
    pin('sensor', F, s.x + 34, t.y + t.t + 10, s.z);
    pin('tray', F, -t.x + 30, t.y + t.t + t.lip, t.z1);
  }
  const sensorLed = new THREE.MeshStandardMaterial({color: '#6d7479', roughness: 0.5});
  {
    const s = PARTS.sensor;
    const led = new THREE.Mesh(BOX, sensorLed);
    led.scale.set(12, 4, 12);
    led.position.set(s.x + 18, CDU.tray.y + CDU.tray.t + 16, s.z);
    F.add(led);
  }
  // the drop and the puddle (chapter 6, leak)
  const drop = new THREE.Mesh(BALL, M.water);
  drop.visible = false;
  F.add(drop);
  const puddle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 40), new THREE.MeshStandardMaterial({color: COLORS.tcsS, roughness: 0.1, transparent: true, opacity: 0.7, polygonOffset: true, polygonOffsetFactor: -2}));
  puddle.visible = false;
  F.add(puddle);

  // ------------------------------------------------------------ top tier: the electrical panel and the makeup tank
  {
    const e = PARTS.elec;
    bx(G.top, M.elec, e.x, e.y, e.z);
    const fz = e.z[1];
    // breakers in a row along the top, 2 inverters (finned), the control board
    const br = [];
    for (let i = 0; i < 12; i++) br.push({p: [e.x[0] + 40 + i * 40, e.y[1] - 50, fz + 6], s: [26, 56, 12], c: 0.9 + 0.2 * hash(i)});
    inst(G.top, M.breaker, br);
    const fins = [];
    for (const x of [-170, -10]) {
      bx(G.top, M.inv, [x - 70, x + 70], [e.y[0] + 30, e.y[0] + 250], [fz, fz + 30]);
      for (let k = 0; k < 9; k++) fins.push({p: [x - 56 + k * 14, e.y[0] + 140, fz + 38], s: [4, 190, 16]});
    }
    inst(G.top, M.inv, fins);
    bx(G.top, M.board, [110, 250], [e.y[0] + 40, e.y[0] + 240], [fz, fz + 6]);
    const chips = [];
    for (let k = 0; k < 6; k++) chips.push({p: [130 + (k % 3) * 46, e.y[0] + 90 + Math.floor(k / 3) * 90, fz + 9], s: [26, 30, 6], c: 0.8 + 0.3 * hash(k + 9)});
    inst(G.top, M.breaker, chips);
    pin('inv', G.top, -170, e.y[0] + 140, fz + 46);
    pin('elec', G.top, e.x[1], (e.y[0] + e.y[1]) / 2, fz);
    const tk = PARTS.tank;
    const tank = new THREE.Mesh(CYL, M.tank);
    tank.scale.set(tk.r, tk.y[1] - tk.y[0], tk.r);
    tank.position.set(tk.x, (tk.y[0] + tk.y[1]) / 2, tk.z);
    tank.castShadow = true;
    G.top.add(tank);
    // 3 level marks on the front, the cap, the feed to the coolant return
    inst(G.top, M.mark, [0, 1, 2].map((k) => ({p: [tk.x, tk.y[0] + 70 + k * 105, tk.z + tk.r + 1], s: [46, 6, 3]})));
    inst(G.top, M.flange, [{p: [tk.x, tk.y[1] + 12, tk.z], s: [40, 24, 40]}], CYL);
    inst(G.top, M.steel, [{p: [(tk.x + 112) / 2, tk.y[0] - 25, tk.z], s: [10, 112, 10], q: qZ}, {p: [tk.x, tk.y[0] - 12, tk.z], s: [10, 26, 10]}], CYL);
    pin('tank', G.top, tk.x + tk.r, (tk.y[0] + tk.y[1]) / 2 + 40, tk.z);
  }

  // ------------------------------------------------------------ middle tier: the heat exchanger and the control valve
  {
    const h = HX;
    const fw = 22; // the frame plates at both ends of the stack
    bx(G.mid, M.hxFrame, [h.x0, h.x0 + fw], [h.y0 - 20, h.y1 + 20], [h.z0 - 10, h.z1 + 10]);
    bx(G.mid, M.hxFrame, [h.x1 - fw, h.x1], [h.y0 - 20, h.y1 + 20], [h.z0 - 10, h.z1 + 10]);
    const plates = [];
    const n = h.plates;
    const pitch = (h.x1 - h.x0 - 2 * fw) / n;
    for (let k = 0; k < n; k++) plates.push({p: [h.x0 + fw + pitch * (k + 0.5), (h.y0 + h.y1) / 2, 0], s: [pitch * 0.72, h.y1 - h.y0, h.z1 - h.z0], c: 0.9 + 0.16 * hash(k * 3 + 1)});
    inst(G.mid, M.hxPlate, plates);
    // 4 tie rods along the stack
    const rods = [];
    for (const y of [h.y0 - 8, h.y1 + 8]) for (const z of [h.z0 - 4, h.z1 + 4]) rods.push({p: [0, y, z], s: [7, h.x1 - h.x0 + 40, 7], q: qZ});
    inst(G.mid, M.rod, rods, CYL);
    // nozzles: 冷却液 in at the top right, out at the bottom right; 施設の水 in at the bottom left, out at the top left
    const noz = [];
    for (const x of [h.nozX, -h.nozX]) for (const [y0, y1] of [[h.y1, h.y1 + 40], [h.y0 - 40, h.y0]]) noz.push({p: [x, (y0 + y1) / 2, 0], s: [PIPE_R, y1 - y0, PIPE_R]}, {p: [x, y0 === h.y1 ? h.y1 + 6 : h.y0 - 6, 0], s: [PIPE_R + 10, 12, PIPE_R + 10]});
    inst(G.mid, M.steel, noz, CYL);
    pin('hx', G.mid, h.x0, h.y1 - 140, h.z1 + 10);
    pin('hxFace', G.mid, 0, (h.y0 + h.y1) / 2, h.z1 + 10);
    const cv = PARTS.cv;
    inst(G.mid, M.valve, [{p: [cv.x, cv.y, cv.z], s: [52, 110, 52], q: qX}, {p: [cv.x, cv.y + 48, cv.z], s: [16, 40, 16]}], CYL);
    bx(G.mid, M.inv, [cv.x - 45, cv.x + 45], [cv.y + 66, cv.y + 156], [cv.z - 40, cv.z + 40]);
    pin('cv', G.mid, cv.x - 45, cv.y + 110, cv.z);
  }

  // ------------------------------------------------------------ bottom tier: two pumps, filters, check valves, the short pipes
  const impellers = [];
  {
    const P = PUMP;
    P.x.forEach((x, i) => {
      // skid and feet
      bx(G.bot, M.skid, [x - 130, x + 130], [CDU.tray.y + CDU.tray.t, P.skid[1]], [P.motor[0] - 20, P.volute[1] + 10]);
      bx(G.bot, M.skid, [x - 50, x + 50], [P.skid[1], P.y - P.motorR + 4], [P.motor[0] + 30, P.motor[1] - 40]);
      // motor with cooling rings and the fan cover at the back
      inst(G.bot, M.motor, [{p: [x, P.y, (P.motor[0] + P.motor[1]) / 2], s: [P.motorR, P.motor[1] - P.motor[0], P.motorR], q: qX}, {p: [x, P.y, P.motor[0] - 20], s: [P.motorR - 6, 40, P.motorR - 6], q: qX}], CYL);
      const rings = [];
      for (let k = 0; k < 7; k++) rings.push({p: [x, P.y, P.motor[0] + 40 + k * 46], s: [P.motorR + 5, 10, P.motorR + 5], q: qX});
      inst(G.bot, M.motor, rings, CYL);
      // the volute; its front is open so the impeller shows (a cutaway)
      inst(G.bot, M.volute, [{p: [x, P.y, (P.volute[0] + P.volute[1]) / 2], s: [P.voluteR, P.volute[1] - P.volute[0], P.voluteR], q: qX}], CYL);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(P.voluteR - 6, 7, 8, 40), M.volute);
      ring.position.set(x, P.y, P.volute[1] + 2);
      G.bot.add(ring);
      const imp = new THREE.Group();
      imp.position.set(x, P.y, P.volute[1] + 4);
      const disk = new THREE.Mesh(CYL, M.imp);
      disk.scale.set(P.voluteR - 14, 4, P.voluteR - 14);
      disk.quaternion.copy(qX);
      imp.add(disk);
      for (let k = 0; k < 6; k++) {
        const bl = new THREE.Mesh(BOX, M.blade);
        const a = (k / 6) * Math.PI * 2;
        bl.scale.set(76, 12, 8);
        bl.position.set(Math.cos(a) * 50, Math.sin(a) * 50, 4);
        bl.rotation.z = a + 0.5;
        imp.add(bl);
      }
      const hub = new THREE.Mesh(CYL, M.blade);
      hub.scale.set(20, 14, 20);
      hub.quaternion.copy(qX);
      hub.position.z = 6;
      imp.add(hub);
      G.bot.add(imp);
      impellers.push(imp);
      pin(i ? 'pumpB' : 'pumpA', G.bot, x + (i ? 1 : -1) * P.voluteR * 0.7, P.y + P.voluteR * 0.7, P.volute[1]);
      pin(i ? 'impB' : 'impA', G.bot, x, P.y - 40, P.volute[1] + 12);
      pin(i ? 'motorB' : 'motorA', G.bot, x + (i ? 1 : -1) * P.motorR, P.y, -60);
    });
    // the short vertical pipes: suction (with the filter and the isolation valve), discharge (with the check valve)
    // (they stop just under the fixed headers, so the tier slides out without touching them)
    const yHdrS = PIPES.sucA[0][1] - PIPE_R - 2;
    const yHdrD = PIPES.disA[1][1] - PIPE_R - 2;
    addPipes(
      K,
      G.bot,
      M.steel,
      [
        [[PIPES.sucA[0][0], yHdrS, PUMP.z], PIPES.sucA[1]],
        [[PIPES.sucB[0][0], yHdrS, PUMP.z], PIPES.sucB[1]],
        [PIPES.disA[0], [PIPES.disA[0][0], yHdrD, PUMP.z]],
        [PIPES.disB[0], [PIPES.disB[0][0], yHdrD, PUMP.z]],
      ],
      PIPE_R,
    );
    const f = PARTS.filter;
    const c = PARTS.check;
    const parts = [];
    const lev = [];
    for (const s of [-1, 1]) {
      const xs = s * 110;
      const xd = s * 190;
      parts.push({p: [xs, (f.y[0] + f.y[1]) / 2, PUMP.z], s: [f.r, f.y[1] - f.y[0], f.r]}, {p: [xs, f.y[1] + 6, PUMP.z], s: [f.r + 5, 12, f.r + 5]});
      parts.push({p: [xd, (c.y[0] + c.y[1]) / 2, PUMP.z], s: [c.r, c.y[1] - c.y[0], c.r]});
      lev.push({p: [xs, 588, PUMP.z + 52], s: [14, 14, 70]}, {p: [xd, 520, PUMP.z + 48], s: [12, 12, 60]});
    }
    inst(G.bot, M.filter, parts, CYL);
    inst(G.bot, M.lever, lev);
    pin('filterA', G.bot, -110 - f.r, (f.y[0] + f.y[1]) / 2, PUMP.z);
    pin('filterB', G.bot, 110 + f.r, (f.y[0] + f.y[1]) / 2, PUMP.z);
    pin('checkB', G.bot, 190 + c.r, (c.y[0] + c.y[1]) / 2, PUMP.z);
    pin('joint', F, 0, 620 - PIPE_R, 190);
  }

  // ------------------------------------------------------------ pose
  const W = new V3();
  /**
   * look: {lifts: [doors, top, mid, bot] 0..1, angA, angB (radians), leak (sceneT of the leak or -1), sensorOn}
   */
  const update = (look = {}) => {
    const L = look.lifts ?? [0, 0, 0, 0];
    const a = THREE.MathUtils.degToRad(CDU.door.open) * L[0];
    for (const d of doors) d.pivot.rotation.y = d.side < 0 ? -a : a;
    G.top.position.z = TIER_SHIFT.top * (L[1] ?? 0);
    G.mid.position.z = TIER_SHIFT.mid * (L[2] ?? 0);
    G.bot.position.z = TIER_SHIFT.bot * (L[3] ?? 0);
    impellers[0].rotation.z = -(look.angA ?? 0);
    impellers[1].rotation.z = -(look.angB ?? 0);
    const lt = look.leakT ?? -1;
    if (lt >= 0) {
      const p = leakPose(lt);
      drop.visible = p.dropS > 0.5;
      drop.position.set(...p.drop);
      drop.scale.set(p.dropS, p.dropS * (p.falling ? 1.5 : 1.2), p.dropS);
      puddle.visible = p.puddleR > 2;
      puddle.position.set(...p.puddleC);
      puddle.scale.set(p.puddleR, 1.2, p.puddleR * 0.72);
      sensorLed.color.set(p.sensor ? C.accent : '#6d7479');
    } else {
      drop.visible = false;
      puddle.visible = false;
      sensorLed.color.set('#6d7479');
    }
  };
  const anchor = (key) => {
    const an = anchors[key];
    an.obj.updateWorldMatrix(true, false);
    return an.obj.localToWorld(W.copy(an.p).clone());
  };
  return {root, update, anchor, anchors, M, G, doors, impellers};
}
export {SPEC};
