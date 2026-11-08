// The 1 SU fat tree as boxes (chapters 3 and 5), in its own millimetres (flow.js FAB): 8 NVL72 racks (the rack's
// 600 × 2,236 × 1,068 scaled, a thin box), 8 leaves and 4 spines (the Q3400's box scaled), the UFM box with the SM, and
// the cables (one line per 18 links). Every switch carries its LFT as 6 bars on its face that fill as the SM writes them.
// Beside it, in grey, a small Catalyst with 4 hosts: the flooded frame and the reply it learns from. The beads (the SM's
// trip, the looked-up packet, the AR split) are drawn over everything. update(look) poses it; overlay(look, project)
// returns the HTML tags. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BOXG} from './box.js';
import {arPose, catFloodPose, catHostX, downLine, downLinks, FAB, leafX, lookupPose, rackBox, rackX, spineX, sweepPose, swBox, swPos, ufmLine, upLine, upLinks} from './flow.js';
import {AR, fattreeAt, LOOKUP, SPEC, SWEEP, SWEEP_ORDER, SWITCHES, switchLid} from './kin.js';

const V3 = THREE.Vector3;
const PALE = '#8fd0d4';
const INK = '#2f3336';
const GREY = '#9aa3a8';

export function buildFabric() {
  const root = new THREE.Group();
  root.position.set(FAB.at[0] / 1000, FAB.at[1] / 1000, FAB.at[2] / 1000);
  root.scale.setScalar(0.001);
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.62, metalness: 0.15, envMapIntensity: 0.55, ...extra});
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({color, toneMapped: false, ...extra});
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const S = new V3();
  const P = new V3();
  const UP = new V3(0, 1, 0);
  const dir = new V3();
  const col = new THREE.Color();
  const put = (im, i, p, s, qq = q.identity()) => {
    m4.compose(P.set(...p), qq, S.set(...s));
    im.setMatrixAt(i, m4);
  };
  const fixed = (mat, n, cast = true) => {
    const im = new THREE.InstancedMesh(BOXG, mat, n);
    im.castShadow = cast;
    im.receiveShadow = true;
    root.add(im);
    return im;
  };
  /** an instanced bag of segments or beads, refilled every frame */
  const bag = (n, mat, order = 20) => {
    const im = new THREE.InstancedMesh(BOXG, mat, n);
    im.frustumCulled = false;
    im.renderOrder = order;
    im.count = 0;
    root.add(im);
    return im;
  };
  const segTo = (im, a, b, w, d = w) => {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 0.5) return;
    const qq = new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize());
    m4.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), qq, S.set(w, len + w * 0.5, d));
    im.setMatrixAt(im.count++, m4);
  };
  const bead = (im, p, s) => {
    m4.compose(P.set(p[0], p[1], p[2] + 20), q.identity(), S.set(s, s, s));
    im.setMatrixAt(im.count++, m4);
  };

  // ------------------------------------------------------------ racks, switches, the UFM box
  const rb = rackBox();
  const sb = swBox();
  const racks = fixed(std('#55595f'), 8);
  const rackFace = fixed(std('#6b7076', {roughness: 0.7}), 8 * SPEC.nvl.trays, false);
  for (let r = 0; r < 8; r++) {
    put(racks, r, [rackX(r), rb.h / 2, 0], [rb.w, rb.h, rb.d]);
    racks.setColorAt(r, col.setScalar(0.95 + 0.04 * (r % 3)));
    for (let t = 0; t < SPEC.nvl.trays; t++) put(rackFace, r * SPEC.nvl.trays + t, [rackX(r), rb.h * 0.22 + t * ((rb.h * 0.7) / SPEC.nvl.trays), rb.d / 2 + 1], [rb.w - 24, 9, 2]);
  }
  const swMat = std('#4a4e54', {metalness: 0.3});
  const sws = fixed(swMat, SWITCHES.length);
  const swFace = fixed(std('#a3a9b0', {metalness: 0.5, roughness: 0.45}), SWITCHES.length * 3, false);
  SWITCHES.forEach((s, i) => {
    const p = swPos(s.id);
    put(sws, i, p, [sb.w, sb.h, sb.d]);
    sws.setColorAt(i, col.setScalar(0.94 + 0.05 * (i % 3)));
    // the three cage sections on the face, a light strip each (the bars of the LFT sit over the middle one)
    for (let k = 0; k < 3; k++) put(swFace, i * 3 + k, [p[0] - 70 + k * 70, p[1] - sb.h / 2 + 8, sb.d / 2 + 1], [60, 10, 2]);
  });
  // the LFT bars: 6 per switch, empty → written (pale) → the row being looked up (accent)
  const ROWS = SWEEP.rows;
  const lft = new THREE.InstancedMesh(BOXG, basic('#ffffff'), SWITCHES.length * ROWS);
  lft.renderOrder = 5;
  root.add(lft);
  SWITCHES.forEach((s, i) => {
    const p = swPos(s.id);
    for (let r = 0; r < ROWS; r++) put(lft, i * ROWS + r, [p[0] + 10, p[1] + sb.h / 2 - 11 - r * 9.2, sb.d / 2 + 2.5], [150, 6.4, 1.5]);
  });
  const ufm = new THREE.Mesh(BOXG, std('#a6abb1', {metalness: 0.4}));
  ufm.scale.set(220, 44, 300);
  ufm.position.set(...FAB.ufm);
  ufm.castShadow = true;
  root.add(ufm);
  const ufmStand = new THREE.Mesh(BOXG, std('#6b7076'));
  ufmStand.scale.set(40, FAB.ufm[1] - 22, 40);
  ufmStand.position.set(FAB.ufm[0], (FAB.ufm[1] - 22) / 2, -60);
  root.add(ufmStand);
  // stands under the leaves and spines (the diagram floats; thin posts keep it on the floor)
  const posts = fixed(std('#b9c1c6'), SWITCHES.length);
  SWITCHES.forEach((s, i) => {
    const p = swPos(s.id);
    put(posts, i, [p[0], (p[1] - sb.h / 2) / 2, -sb.d / 2 + 30], [12, p[1] - sb.h / 2, 12]);
  });

  // ------------------------------------------------------------ cables
  const DL = downLinks();
  const UL = upLinks();
  const cables = bag(DL.length + UL.length + 4, std(GREY, {metalness: 0}), 1);
  const over = {depthTest: false, depthWrite: false, transparent: true};
  const cablesOn = bag(40, basic(C.accent, over), 21);
  const beadOn = bag(64, basic(C.accent, over), 23);
  const beadInk = bag(40, basic(INK, over), 22);
  const busy = bag(12, basic(INK, over), 22);

  // ------------------------------------------------------------ the Catalyst beside it (grey only)
  const catG = new THREE.Group();
  root.add(catG);
  const cs = 0.8;
  const catBox = new THREE.Mesh(BOXG, std('#8d959a'));
  catBox.scale.set(SPEC.cat.w * cs, SPEC.cat.h * cs, SPEC.cat.d * cs);
  catBox.position.set(FAB.cat.x, FAB.cat.y, 0);
  catBox.castShadow = true;
  catG.add(catBox);
  const hosts = new THREE.InstancedMesh(BOXG, std('#a9b0b5'), 4);
  for (let i = 0; i < 4; i++) put(hosts, i, [catHostX(i), FAB.cat.hostY, 0], [74, 70, 80]);
  catG.add(hosts);
  const catLines = new THREE.InstancedMesh(BOXG, std('#b9c1c6'), 4);
  for (let i = 0; i < 4; i++) put(catLines, i, [catHostX(i), (FAB.cat.hostY + 30 + FAB.cat.y - 11) / 2, 0], [5, FAB.cat.y - 11 - FAB.cat.hostY - 30, 5]);
  catG.add(catLines);
  // its MAC table: 2 rows over the box; the second appears when the reply is learned
  const macRows = new THREE.InstancedMesh(BOXG, basic('#ffffff'), 2);
  for (let r = 0; r < 2; r++) put(macRows, r, [FAB.cat.x, FAB.cat.y + 50 + r * 16, 0], [260, 11, 3]);
  catG.add(macRows);
  const catBead = bag(4, basic('#5d666b', over), 22);
  catG.add(catBead);

  const cE = new THREE.Color('#3a3d42');
  const cW = new THREE.Color(PALE);
  const cA = new THREE.Color(C.accent);
  const cM0 = new THREE.Color('#c3cacf');
  const cM1 = new THREE.Color('#6d767c');
  /**
   * look: {chapter, scene, sceneT, fabK (0..1 shown)}
   */
  const update = (look) => {
    const ch = look.chapter;
    root.visible = ch === 3 || ch === 5;
    if (!root.visible) return;
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    for (const im of [cables, cablesOn, beadOn, beadInk, busy, catBead]) im.count = 0;
    // the LFT bars
    const rowsOf = {};
    if (sc === 'sweep') for (const p of sweepPose(t).per) rowsOf[p.id] = p.rows;
    else for (const id of SWEEP_ORDER) rowsOf[id] = ROWS;
    const lk = sc === 'lookup' ? lookupPose(t) : null;
    SWITCHES.forEach((s, i) => {
      for (let r = 0; r < ROWS; r++) {
        const hit = lk && lk.at === s.id && r === 2;
        lft.setColorAt(i * ROWS + r, hit ? cA : r < (rowsOf[s.id] ?? 0) ? cW : cE);
      }
    });
    lft.instanceColor.needsUpdate = true;
    // cables: grey; chapter 5 lights leaf 0's 4 down and 4 up at the same width
    const ft = sc === 'fattree' ? fattreeAt(t) : null;
    const lit = (leaf) => (ft && ft.k > 0.02 && leaf === ft.leaf) || sc === 'ar';
    for (const d of DL) {
      if (lit(d.leaf) && d.leaf === 0) segTo(cablesOn, ...downLine(d), 9);
      else segTo(cables, ...downLine(d), 5);
    }
    for (const u of UL) {
      if (lit(u.leaf) && u.leaf === 0 && !(sc === 'ar' && u.spine === AR.busy)) segTo(cablesOn, ...upLine(u), 9);
      else segTo(cables, ...upLine(u), 5);
    }
    const ul = ufmLine();
    for (let i = 1; i < ul.length; i++) (sc === 'sweep' ? segTo(cablesOn, ul[i - 1], ul[i], 7) : segTo(cables, ul[i - 1], ul[i], 5));
    // beads
    if (sc === 'sweep') {
      const sp = sweepPose(t);
      if (sp.p) bead(beadOn, sp.p, 46);
    }
    if (lk) {
      bead(beadOn, lk.p, 46);
      // the route behind it, faint
      for (const leg of lk.legs) for (let i = 1; i < leg.length; i++) segTo(cablesOn, leg[i - 1], leg[i], 4);
    }
    if (sc === 'ar') {
      const a = arPose(t);
      for (const b of a.beads) bead(beadOn, b.p, 40);
      // the busy exit: a queue standing at the leaf's top
      const [a0] = upLine({leaf: 0, spine: AR.busy});
      for (let k = 0; k < 6; k++) put(busy, busy.count++, [a0[0] + 26, a0[1] + 16 + k * 20, 30], [22, 16, 16]);
    }
    // the Catalyst beside the look-up
    catG.visible = sc === 'lookup' || sc === 'sweep';
    if (catG.visible) {
      const cf = catFloodPose(sc === 'lookup' ? t : 0);
      for (const b of cf.beads) bead(catBead, b.p, 36);
      macRows.setColorAt(0, cM1);
      macRows.setColorAt(1, cf.learned ? cM1 : cM0);
      macRows.instanceColor.needsUpdate = true;
    }
    for (const im of [cables, cablesOn, beadOn, beadInk, busy, catBead]) im.instanceMatrix.needsUpdate = true;
  };

  // ------------------------------------------------------------ tags in screen pixels
  const W = new V3();
  const scr = (project, p) => {
    W.set(...p);
    root.localToWorld(W);
    return project(W.x, W.y, W.z);
  };
  /** tags: [{x, y, h, v, html, o, kind, on}] */
  const overlay = (look, project) => {
    const out = [];
    if (!root.visible) return out;
    root.updateWorldMatrix(true, true);
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const o = look.tagO ?? 1;
    const p = (pt) => scr(project, pt);
    const tag = (pt, html, h = 'c', v = 'b', kind = 'lbl', on = false) => {
      const s = p(pt);
      if (s) out.push({kind, x: s[0], y: s[1], h, v, o, on, html});
    };
    tag([leafX(7) + 125, FAB.leafY, 0], 'リーフ × 8', 'r', 'm', 'note');
    tag([spineX(3) + 125, FAB.spineY, 0], 'スパイン × 4（計算）', 'r', 'm', 'note');
    tag([rackX(7) + 90, rb.h * 0.5, 0], 'NVL72 × 8', 'r', 'm', 'note');
    if (sc === 'sweep' || sc === 'lookup') {
      tag([FAB.ufm[0] - 40, FAB.ufm[1] + 40, 0], `<b>UFM（SM）</b><span>${SPEC.sm.sweepS} 秒ごとに見回る</span>`, 'c', 'b', 'lbl', sc === 'sweep');
      const per = sc === 'sweep' ? sweepPose(t).per : SWEEP_ORDER.map((id) => ({id, lid: switchLid(id)}));
      for (const s of per) if (s.lid) tag([swPos(s.id)[0], swPos(s.id)[1] - swBox().h / 2 - 6, swBox().d / 2], `LID ${s.lid}`, 'c', 't', 'note');
      const cf = catFloodPose(sc === 'lookup' ? t : 0);
      tag([FAB.cat.x, FAB.cat.y + 80, 0], `<b>Catalyst（比べる相手）</b><span>${cf.phase === 'flood' ? '知らない宛先: 全ポートへ流す' : cf.phase === 'reply' ? '返事の送信元 MAC を覚える' : cf.learned ? 'MAC 表に 1 行増えた（覚えた）' : '送信元 MAC を覚える'}</span>`, 'c', 'b');
    }
    if (sc === 'lookup') {
      const lk = lookupPose(t);
      tag([lk.p[0] + 40, lk.p[1], lk.p[2]], `<b>宛先 LID ${lk.dst}</b>`, 'r', 'm', 'lbl', true);
      const a = p([rackX(LOOKUP.from.rack), rb.h * 0.62, rb.d / 2]);
      if (a) out.push({kind: 'note', x: a[0], y: a[1] + 14, h: 'c', v: 't', o, html: 'GPU（ラック 2）'});
      const b = p([rackX(LOOKUP.to.rack), rb.h * 0.62, rb.d / 2]);
      if (b) out.push({kind: 'note', x: b[0], y: b[1] + 14, h: 'c', v: 't', o, html: 'GPU（ラック 7）'});
    }
    if (sc === 'fattree' && fattreeAt(t).k > 0.5) {
      const d = downLine({rack: 1, leaf: 0});
      tag([(d[0][0] + d[1][0]) / 2 - 30, (d[0][1] + d[1][1]) / 2, 0], '<b>下り 72</b><span>ラック 4 本 × 18</span>', 'r', 'm', 'lbl', true);
      const u = upLine({leaf: 0, spine: 0});
      tag([(u[0][0] + u[1][0]) / 2 - 30, (u[0][1] + u[1][1]) / 2, 0], '<b>上り 72</b><span>スパイン 4 台 × 18</span>', 'r', 'm', 'lbl', true);
    }
    if (sc === 'ar') {
      const [a0] = upLine({leaf: 0, spine: AR.busy});
      tag([a0[0] + 50, a0[1] + 140, 0], '<b>混んだ出口</b><span>ここを避ける</span>', 'c', 'b', 'lbl', false);
    }
    return out;
  };
  return {root, update, overlay};
}
