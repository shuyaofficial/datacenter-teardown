// Chapters 3-7 drawn over the box, in the chassis's millimetres (the group hangs under the chassis root):
//   3  the 18 links fanning out of GPU 0 to the 2 NVSwitch chips (fan) and the bead GPU 0 → NVSwitch → GPU 5 (hop)
//   4  the way out to the 9th GPU: the dense NVLink stream inside, the sparse one through OSFP4 P2 and the leaf (wall);
//      the 72 rail lines from every GPU marker to its leaf, rail 0 in the accent (rails)
//   5  the beads of the 2-stage all-reduce: around each box (NVLink), along the rails (InfiniBand)
//   6  dashes of current: the cords into the 5 working supplies and on into the box
//   7  dashes of air: pale in front, darker through the box, the full accent behind it
// The routes and beads are drawn over the box (no depth test): they live inside it. update(look) poses it;
// overlay(look, project) returns the HTML tags in screen pixels. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {airLanes, along, BARS, boxX, CL, GT, dashCount, dashes, fanPose, hierBeads, hopPose, leafX, markerW, NVR, pathLength, powerPaths, R42, railLine, slotY, wallBeads, wallNvPath, wallPath} from './flow.js';
import {hierMs, nvl72Ms, rackAt, SPEC, vs72At} from './kin.js';

const V3 = THREE.Vector3;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PALE = '#8fd0d4';
const MID = '#4fb7bd';
const INK = '#2f2c28';
const fx = (n, d) => Number(n).toFixed(d);

export function buildOverlay(box) {
  const root = new THREE.Group();
  box.root.add(root);
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({color, toneMapped: false, depthTest: false, depthWrite: false, transparent: true, ...extra});
  const tmpQ = new THREE.Quaternion();
  const UP = new V3(0, 1, 0);
  const dir = new V3();
  const m4 = new THREE.Matrix4();
  const S = new V3();
  const P = new V3();
  const bag = (n, mat, order = 20) => {
    const im = new THREE.InstancedMesh(BOX, mat, n);
    im.frustumCulled = false;
    im.renderOrder = order;
    im.count = 0;
    root.add(im);
    return im;
  };
  const seg = (im, a, b, w) => {
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 0.5 || im.count >= im.instanceMatrix.count) return;
    tmpQ.setFromUnitVectors(UP, dir.normalize());
    m4.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), tmpQ, S.set(w, len + w, w));
    im.setMatrixAt(im.count++, m4);
  };
  const bead = (im, p, s) => {
    if (im.count >= im.instanceMatrix.count) return;
    m4.compose(P.set(p[0], p[1], p[2]), tmpQ.identity(), S.set(s, s, s));
    im.setMatrixAt(im.count++, m4);
  };
  /** the first k (0..1) of a polyline as segments */
  const polySeg = (im, pts, k, w) => {
    if (k <= 0) return;
    let left = pathLength(pts) * Math.min(1, k);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (l <= left) seg(im, a, b, w);
      else seg(im, a, a.map((v, j) => v + ((b[j] - v) * left) / l), w);
      left -= l;
    }
  };
  const lineFaint = bag(400, basic(C.accent, {opacity: 0.3}), 20);
  const lineGrey = bag(400, basic('#7d878d', {opacity: 0.35}), 20);
  const lineOn = bag(200, basic(C.accent, {opacity: 1}), 21);
  const lineInk = bag(60, basic(INK, {opacity: 0.75}), 21);
  const beadOn = bag(200, basic(C.accent, {opacity: 1}), 23);
  const beadInk = bag(120, basic(INK, {opacity: 1}), 22);
  const marks = bag(8, basic(INK, {opacity: 0.9}), 22);
  const PP = powerPaths();
  const AL = airLanes();
  const nPow = [...PP.feeds, PP.bus, PP.up, PP.down].reduce((a, p) => a + dashCount(p), 0);
  const nAir = AL.reduce((a, l) => a + l.parts.reduce((b, p) => b + dashCount(p), 0), 0);
  const dashAcc = bag(nPow + nAir, basic(C.accent, {opacity: 1}), 22);
  const dashMid = bag(nAir, basic(MID, {opacity: 1}), 21);
  const dashPale = bag(nAir, basic(PALE, {opacity: 1}), 21);
  const WP = wallPath();
  const WN = wallNvPath();

  const hide = (...ims) => ims.forEach((im) => (im.count = 0));
  const ALL = [lineFaint, lineGrey, lineOn, lineInk, beadOn, beadInk, marks, dashAcc, dashMid, dashPale];
  /** look: {chapter, scene, sceneT, T, lifts, reduced, airSpeed} */
  const update = (look) => {
    hide(...ALL);
    const ch = look.chapter;
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const inBox = (look.lifts?.[0] ?? 0) < 0.02;
    if (ch === 3 && sc === 'fan' && inBox) {
      const f = fanPose(t);
      for (const p of f.paths) {
        polySeg(lineFaint, p.pts, 1, 2.2);
        polySeg(lineOn, p.pts, p.k, 3);
      }
      bead(marks, f.paths[0].pts[0], 14);
    }
    if (ch === 3 && sc === 'hop' && inBox) {
      const h = hopPose(t);
      polySeg(lineFaint, h.legs.A, 1, 2.5);
      polySeg(lineFaint, h.legs.B, 1, 2.5);
      if (h.firstDone) polySeg(lineOn, h.legs.A, 1, 4);
      else if (h.leg === 'up') polySeg(lineOn, h.legs.A, smooth(h.u), 4);
      if (h.secondShown) polySeg(lineOn, h.legs.B, h.leg === 'down' ? smooth(h.u) : 1, 4);
      bead(beadOn, h.p, 16);
      bead(marks, h.legs.A[0], 12);
      bead(marks, h.legs.B[h.legs.B.length - 1], 12);
    }
    if (ch === 4 && sc === 'wall' && inBox) {
      polySeg(lineFaint, WP.all, 1, 4);
      for (let i = 1; i < WP.cable.length; i++) seg(lineInk, WP.cable[i - 1], WP.cable[i], 7);
      polySeg(lineFaint, WN, 1, 3);
      const wb = wallBeads(t);
      for (const b of wb.outs) bead(beadInk, along(WP.all, b.u), 20);
      for (const b of wb.ins) bead(beadOn, along(WN, b.u), 10);
    }
    const railsOn = (ch === 4 && sc === 'rails') || ch === 5;
    if (railsOn && (look.cluster ?? 0) > 0.3) {
      const k = look.railK ?? 1;
      for (let b = 0; b < SPEC.allreduce.gpus / SPEC.gpus; b++)
        for (let g = 0; g < SPEC.gpus; g++) {
          const L = railLine(b, g);
          if (g === SPEC.demo.wallRail && sc === 'rails') polySeg(lineOn, L, k, 4);
          else polySeg(lineGrey, L, sc === 'rails' ? k : 1, 2.5);
        }
      if (sc === 'hier') {
        const hb = hierBeads(t);
        for (const p of hb.ins) bead(beadOn, p, 50);
        for (const p of hb.outs) bead(beadInk, p, 50);
      }
    }
    const T = look.T ?? 0;
    const sp = look.reduced ? 0 : 1;
    if (ch === 6 && sc === 'power') {
      const k = look.powerK ?? 1;
      if (k > 0.02) for (const p of [...PP.on, PP.bus, PP.up, PP.down]) for (const d of dashes(p, T, 220 * sp)) seg(dashAcc, d.a, d.b, 7);
      for (const p of PP.spare) polySeg(lineGrey, p, 1, 3);
    }
    if (ch === 7) {
      const v = 260 * (look.airSpeed ?? 1) * sp;
      for (const l of AL) {
        const w = 7;
        for (const d of dashes(l.parts[0], T, v, 50, 70)) seg(dashPale, d.a, d.b, w);
        for (const d of dashes(l.parts[1], T, v, 50, 70)) seg(dashMid, d.a, d.b, w);
        for (const d of dashes(l.parts[2], T, v, 50, 70)) seg(dashAcc, d.a, d.b, w);
      }
    }
    ALL.forEach((im) => (im.instanceMatrix.needsUpdate = true));
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
    root.updateWorldMatrix(true, true);
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const ch = look.chapter;
    const inBox = (look.lifts?.[0] ?? 0) < 0.02;
    const tag = (p, dx, dy, h, v, html, on = false, kind = 'lbl') => {
      const a = scr(project, p);
      if (a) out.push({kind, x: a[0] + dx, y: a[1] + dy, h, v, o: 1, on, html});
    };
    if (ch === 3 && sc === 'fan' && inBox) {
      const f = fanPose(t);
      // beside the board, on the row of what they name
      const y = GT.top;
      tag([GT.board.x[0] - 10, y, GT.gpuZ[0]], -8, 0, 'l', 'm', `<b>GPU 0</b><span>リンク ${f.lit} / 18 本</span>`, true);
      [0, 1].forEach((c) => tag([GT.board.x[1] + 10, y, GT.nvsZ[c]], 8, 0, 'r', 'm', `<b>NVSwitch ${c}</b><span>GPU 0 から ${f.perChip[c]} / 9 本</span>`, f.perChip[c] > 0));
    }
    if (ch === 3 && sc === 'hop' && inBox) {
      const h = hopPose(t);
      const y = GT.top;
      const zb = h.legs.B[h.legs.B.length - 1][2];
      tag([GT.board.x[0] - 10, y, h.legs.A[0][2]], -8, 0, 'l', 'm', '<b>GPU 0</b><span>送り手</span>', !h.secondShown);
      tag([GT.board.x[1] + 10, y, zb], 8, 0, 'r', 'm', '<b>GPU 5</b><span>受け手</span>', h.done || h.leg === 'arrive');
      tag([GT.board.x[1] + 10, y, GT.nvsZ[h.chip]], 8, 0, 'r', 'm', `<b>NVSwitch ${h.chip}</b><span>通ったスイッチ ${h.hops} 個</span>`, h.leg === 'chip');
    }
    if (ch === 4 && sc === 'wall' && inBox) {
      // beside the things they name, outside the boxes
      tag([leafX(0) + CL.leafW / 2 + 10, CL.leafY, CL.leafZ], 10, 0, 'r', 'm', '<b>InfiniBand のリーフ（レール 0）</b><span>GPU 0 の OSFP4 P2 から・400 Gb/s</span>');
      tag([boxX(1) + 240, GT.top, WP.inB[WP.inB.length - 1][2]], 12, 0, 'r', 'm', '<b>隣の DGX B200 の GPU 0</b><span>9 個目の GPU・ConnectX-7 経由</span>');
      tag([-240, GT.top, GT.nvsZ[0]], -44, 0, 'l', 'm', '<b>NVLink 1.8 TB/s</b><span>GPU 0 → GPU 5（箱の中）</span>', true);
    }
    if (((ch === 4 && sc === 'rails') || ch === 5) && (look.cluster ?? 0) > 0.6 && sc !== 'vs72') {
      tag([leafX(0), CL.leafY + CL.leafH / 2, CL.leafZ], 0, -30, 'c', 'b', '<b>リーフ × 8</b><span>レール 0〜7（GPU の番号ごと）</span>');
      if (sc === 'rails') tag([-260, CL.markY, GT.gpuZ[1]], -16, 0, 'l', 'm', '<b>1 台目の 8 個</b><span>NVLink で届くのは 7 個</span>', true);
    }
    if (ch === 5 && sc === 'vs72' && (look.nvK ?? 0) > 0.6) {
      const v = vs72At(t);
      const hD = Math.max(1, v.dgxMs * BARS.mmPerMs);
      const hN = Math.max(1, v.nvMs * BARS.mmPerMs);
      tag([BARS.dgx[0], hD, BARS.dgx[2]], 0, -12, 'c', 'b', `<b>DGX B200 × 9　${fx(v.dgxMs, 3)} ms</b><span>外へ ${fx(v.dgxOutGB, 3)} GB / 台</span>`, false);
      // over the NVL72 rack (its bar is short and stands in front of it)
      tag([NVR.x, NVR.h, 0], 0, -10, 'c', 'b', `<b>GB200 NVL72　${fx(v.nvMs, 3)} ms</b><span>外へ 0 GB（72 個が全部ラックの中）</span>`, true);
    }
    if (ch === 6 && sc === 'rack' && (look.rackK ?? 0) > 0.6) {
      const r = rackAt(t, look.limit, look.from);
      if (r.n < r.slots) tag([R42.x + R42.w / 2, slotY(r.n) + 222, 0], 24, 0, 'r', 'm', `<b>空き ${r.slots - r.n} 台ぶん</b><span>場所はあるが電力が足りない</span>`, true);
      tag([R42.x, R42.h, 0], 0, -10, 'c', 'b', `<b>42U ラック・上限 ${look.limit} kW（仮定）</b><span>${r.n} 台 × 14.3 kW = ${fx(r.kw, 1)} kW</span>`);
    }
    return out;
  };
  return {root, update, overlay};
}
const smooth = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
export {hierMs, nvl72Ms};
