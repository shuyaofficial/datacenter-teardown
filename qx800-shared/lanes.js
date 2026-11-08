// Chapter 4's three lanes, one above the other, in their own millimetres (flow.js LANES). Each is the same picture: two
// senders, two input wires into a switch, one output wire. Top: the Catalyst (grey) with its egress queue Q1 that fills
// and drops from the tail. Middle: InfiniBand with an input buffer of 4 packet slots (8 × 8 blocks of 64 B each) per
// input and the credits flying back to the sender. Bottom: Ethernet with PFC: 3 slots up to the 「止まれ」 line and a
// headroom behind it. The lane the scene is about is lit; the other two sit behind a pale veil. update(look) poses it;
// overlay(look, project) returns the HTML tags. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BOXG} from './box.js';
import {along, catLanePose, inWire, LANES, laneOf, outWire} from './flow.js';
import {CREDIT, creditAt, PFC, pfcAt, pktCredits} from './kin.js';

const V3 = THREE.Vector3;
const INK = '#2f3336';
const PALE = '#8fd0d4';
const K3 = ['cat', 'ib', 'pfc'];

export function buildLanes() {
  const root = new THREE.Group();
  root.position.set(LANES.at[0] / 1000, LANES.at[1] / 1000, LANES.at[2] / 1000);
  root.scale.setScalar(0.001);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.62, metalness: 0.12, envMapIntensity: 0.55, ...extra});
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({color, toneMapped: false, ...extra});
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const S = new V3();
  const P = new V3();
  const put = (im, p, s, qq = q.identity()) => {
    m4.compose(P.set(...p), qq, S.set(...s));
    im.setMatrixAt(im.count++, m4);
  };
  const bag = (n, mat, order = 0, cast = false) => {
    const im = new THREE.InstancedMesh(BOXG, mat, n);
    im.frustumCulled = false;
    im.renderOrder = order;
    im.count = 0;
    im.castShadow = cast;
    im.receiveShadow = true;
    root.add(im);
    return im;
  };
  const box = (mat, p, s, cast = true) => {
    const m = new THREE.Mesh(BOXG, mat);
    m.scale.set(...s);
    m.position.set(...p);
    m.castShadow = cast;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const L = LANES;
  const SL = L.slot;
  const BUFR = -32; // the buffers' right edge (the output side)
  const diamond = new THREE.Quaternion().setFromAxisAngle(new V3(0, 0, 1), Math.PI / 4);

  // ------------------------------------------------------------ the fixed parts of every lane
  const sender = std('#8b9298');
  const swPlate = std('#e8ecee', {roughness: 0.85, metalness: 0});
  const wire = std('#b4bcc1', {metalness: 0});
  const swEdge = std('#6b7076');
  for (const k of K3) {
    const y = L.y[k];
    for (const i of [0, 1]) box(sender, [L.senderX, y + (i ? -L.dy : L.dy), 0], [140, 70, 110]);
    box(sender, [L.rxX, y, 0], [140, 70, 110]);
    // the switch: a pale plate standing behind its buffers, an edge frame
    const cx = (L.inX + L.outX) / 2;
    box(swPlate, [cx, y, -40], [L.outX - L.inX + 40, 2 * L.dy + 150, 12]);
    box(swEdge, [cx, y + L.dy + 75, -40], [L.outX - L.inX + 40, 6, 20], false);
    box(swEdge, [cx, y - L.dy - 75, -40], [L.outX - L.inX + 40, 6, 20], false);
    for (const i of [0, 1]) {
      const [a, b] = inWire(k, i);
      box(wire, [(a[0] + b[0]) / 2, a[1], 0], [b[0] - a[0], 5, 5], false);
    }
    const [a, b] = outWire(k);
    box(wire, [(a[0] + b[0]) / 2, a[1], 0], [b[0] - a[0], 5, 5], false);
    // the joins inside the switch: from each input's buffer to the output
    for (const i of [0, 1]) {
      const yi = y + (i ? -L.dy : L.dy);
      box(wire, [L.outX - 40, (yi + y) / 2, 0], [5, Math.abs(yi - y), 5], false);
      box(wire, [(L.inX + L.outX - 40) / 2, yi, 0], [L.outX - 40 - L.inX, 5, 5], false);
    }
    box(wire, [L.outX - 20, y, 0], [40, 5, 5], false);
  }
  // Catalyst: the queue column's frame (grey)
  const QH = 2 * L.dy + 60;
  const qx = L.outX - 110;
  const catFrame = std('#7d878d');
  for (const sx of [-1, 1]) box(catFrame, [qx + sx * 38, L.y.cat, 6], [4, QH, 4], false);
  box(catFrame, [qx, L.y.cat - QH / 2, 6], [80, 4, 4], false);
  const qFill = box(std('#6d767c'), [qx, L.y.cat - QH / 2, 0], [70, 1, 40], false);

  // ------------------------------------------------------------ the buffers: 64 blocks a packet slot
  const CELL = SL / 8;
  // IB: 2 inputs × 4 slots × 64 blocks; PFC: 2 × (3 + headroom) slots × 64
  const hr = 5;
  const nIb = 2 * CREDIT.bufPk * 64;
  const nPfc = 2 * (PFC.xoff + hr) * 64;
  const cells = new THREE.InstancedMesh(BOXG, basic('#ffffff'), nIb + nPfc);
  cells.renderOrder = 4;
  root.add(cells);
  const cellAt = [];
  // slot 0 is next to the output (right); the PFC lane's slots 3.. are the headroom, to the left of the 「止まれ」 line
  const slotX = (s) => BUFR - (s + 1) * SL;
  cells.count = 0;
  for (const [k, n] of [['ib', CREDIT.bufPk], ['pfc', PFC.xoff + hr]]) {
    for (const i of [0, 1]) {
      const yi = L.y[k] + (i ? -L.dy : L.dy);
      for (let s = 0; s < n; s++) {
        const x0 = slotX(s);
        for (let c = 0; c < 64; c++) {
          cellAt.push({k, i, s});
          put(cells, [x0 + ((c % 8) + 0.5) * CELL, yi - SL / 2 + (Math.floor(c / 8) + 0.5) * CELL, 3], [CELL - 1.1, CELL - 1.1, 2]);
        }
      }
    }
  }
  // the PFC 「止まれ」 line between slot 2 and the headroom
  const xoffLines = [0, 1].map((i) => box(basic(INK), [BUFR - PFC.xoff * SL, L.y.pfc + (i ? -L.dy : L.dy), 6], [3, SL + 22, 3], false));
  void xoffLines;

  // ------------------------------------------------------------ the moving parts
  const pkInk = bag(60, basic(INK), 22);
  const pkGrey = bag(60, basic('#5d666b'), 22);
  const tok = bag(30, basic(C.accent), 23);
  const msg = bag(8, basic(INK), 23);
  // the veils over the lanes that are not the scene's
  const veilMat = new THREE.MeshBasicMaterial({color: C.bg, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false});
  const veils = Object.fromEntries(K3.map((k) => [k, box(veilMat, [0, L.y[k], 120], [1900, 2 * L.dy + 200, 2], false)]));
  Object.values(veils).forEach((v) => (v.renderOrder = 30));

  const cEmpty = new THREE.Color('#d3dadf');
  const cHead = new THREE.Color('#bfe3e5');
  const cFull = new THREE.Color(INK);
  const cAcc = new THREE.Color(C.accent);
  const cPale = new THREE.Color(PALE);
  /** look: {chapter, scene, sceneT} */
  const update = (look) => {
    root.visible = look.chapter === 4;
    if (!root.visible) return;
    const t = look.sceneT ?? 0;
    const focus = laneOf(look.scene);
    for (const k of K3) veils[k].visible = k !== focus;
    for (const im of [pkInk, pkGrey, tok, msg]) im.count = 0;
    // Catalyst
    const cl = catLanePose(t);
    qFill.scale.y = Math.max(1, QH * cl.pct);
    qFill.position.y = L.y.cat - QH / 2 + (QH * cl.pct) / 2;
    for (const ps of cl.ins) for (const p of ps) put(pkGrey, p, [30, 18, 18]);
    for (const p of cl.outs) put(pkGrey, p, [30, 18, 18]);
    for (const f of cl.falls) put(pkGrey, [qx + 30 + f.u * 70, L.y.cat + QH / 2 + 10 - f.u * f.u * 380, 20], [26, 16, 16]);
    // IB: the same for both inputs
    const cr = creditAt(t);
    const pf = pfcAt(t);
    cellAt.forEach((c, j) => {
      let colr = cEmpty;
      if (c.k === 'ib') colr = c.s < cr.inBuf ? cFull : cEmpty;
      else colr = c.s < pf.inBuf ? (c.s >= PFC.xoff ? cAcc : cFull) : c.s >= PFC.xoff ? cHead : cEmpty;
      cells.setColorAt(j, colr);
    });
    cells.instanceColor.needsUpdate = true;
    for (const i of [0, 1]) {
      const w = inWire('ib', i);
      for (const b of cr.onWire) put(pkInk, along(w, b.u), [30, 18, 18]);
      // credits fly back just above the wire
      for (const tk of cr.tokens) {
        const p = along([...w].reverse(), tk.u);
        put(tok, [p[0], p[1] + 20, 8], tk.init ? [22, 22, 8] : [15, 15, 8], diamond);
      }
      const wp = inWire('pfc', i);
      for (const b of pf.onWire) put(pkInk, along(wp, b.u), [30, 18, 18]);
      for (const m of pf.msgs) {
        const p = along([...wp].reverse(), m.u);
        put(msg, [p[0], p[1] + 22, 8], m.on ? [26, 20, 8] : [16, 16, 8]);
      }
    }
    for (const im of [pkInk, pkGrey, tok, msg]) im.instanceMatrix.needsUpdate = true;
    void cPale;
  };

  // ------------------------------------------------------------ tags in screen pixels
  const W = new V3();
  const overlay = (look, project) => {
    const out = [];
    if (!root.visible) return out;
    root.updateWorldMatrix(true, true);
    const t = look.sceneT ?? 0;
    const focus = laneOf(look.scene);
    const o = look.tagO ?? 1;
    const tag = (pt, html, h = 'c', v = 'b', kind = 'lbl', on = false) => {
      W.set(...pt);
      root.localToWorld(W);
      const s = project(W.x, W.y, W.z);
      if (s) out.push({kind, x: s[0], y: s[1], h, v, o, on, html});
    };
    const cr = creditAt(t);
    const pf = pfcAt(t);
    const cl = catLanePose(t);
    const top = (k) => L.y[k] + L.dy + 80;
    if (focus === 'cat') {
      tag([L.senderX, top('cat'), 0], '<b>Gi1/0/1・Gi1/0/2</b><span>各 1 Gbps</span>');
      tag([qx, top('cat') + 10, 0], `<b>Q1（出口キュー）</b><span>${cl.full ? '満杯・末尾で捨てる' : '溜まっていく'}</span>`, 'c', 'b', 'lbl', false);
      tag([L.rxX, top('cat') - 60, 0], '<b>Gi1/0/3</b><span>1 Gbps</span>');
    }
    if (focus === 'ib') {
      tag([L.senderX, top('ib'), 0], `<b>送り手のクレジット ${cr.credits}</b><span>${cr.waiting ? '64 に足りない → 待つ' : '1 パケット = 64'}</span>`, 'c', 'b', 'lbl', cr.waiting);
      tag([BUFR - 2 * SL, top('ib'), 0], `<b>受け口 ${cr.inBuf} / ${CREDIT.bufPk} パケット</b><span>升目 1 つ = 64 B（説明用に 4 パケット分）</span>`);
      tag([L.rxX, top('ib') - 60, 0], '<b>出口</b><span>2 本で 1 本を分ける</span>');
    }
    if (focus === 'pfc') {
      tag([L.senderX, top('pfc'), 0], `<b>送り手</b><span>${pf.paused ? '止まっている' : '送り続ける'}</span>`, 'c', 'b', 'lbl', pf.paused);
      tag([BUFR - (PFC.xoff + hr / 2) * SL, top('pfc'), 0], `<b>余裕（ヘッドルーム）</b><span>線の上にいた分が入る</span>`, 'c', 'b', 'lbl', pf.over > 0);
      tag([BUFR - PFC.xoff * SL, L.y.pfc - L.dy - 40, 0], '「止まれ」の線', 'c', 't', 'note');
    }
    void pktCredits;
    return out;
  };
  return {root, update, overlay};
}
