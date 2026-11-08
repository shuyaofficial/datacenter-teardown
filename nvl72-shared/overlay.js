// Chapters 3-7 drawn over the rack, in the rack's millimetres (the group hangs under rack.root):
//   3  the 18 links fanning out of GPU 1 of tray 3 (fan) and the bead's route to GPU 3 of tray 15 through one NVSwitch (hop)
//   4  the ring diagram: a plate beside the rack with 72 GPUs on a circle, the ring's beads, SHARP's hub and spokes
//   5  the pulled tray's two streams: the dense NVLink one to the back, the sparse one out through the OSFP to the IB switch
//   6  dashes of current: power shelves → bus bar → every tray
//   7  dashes of coolant: up the supply manifold (pale accent) into every tray, back to the return (full accent), and the
//      loop over the cold plates of tray 3
// The routes and beads are drawn over the trays (no depth test): they live inside closed trays. update(look) poses it;
// overlay(look, project) returns the HTML tags in screen pixels. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {chipOf, SPEC} from './kin.js';
import {along, coolPaths, dashCount, dashes, fanPose, hopPose, IB, nvlStubPath, outBeads, outPath, pathLength, powerPaths, RING, ringBeads, ringXY, sharpBeads} from './flow.js';

const V3 = THREE.Vector3;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PALE = '#eea98c';
const INK = '#2f2c28';

export function buildOverlay(rack) {
  const root = new THREE.Group();
  rack.root.add(root);
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({color, toneMapped: false, depthTest: false, depthWrite: false, transparent: true, ...extra});
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: 0.65, metalness: 0, envMapIntensity: 0.5, ...extra});
  const tmpQ = new THREE.Quaternion();
  const UP = new V3(0, 1, 0);
  const dir = new V3();
  const m4 = new THREE.Matrix4();
  const S = new V3();
  const P = new V3();
  /** an instanced bag of segments (thin boxes from a to b) or beads, drawn over everything */
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
    if (len < 0.5) return;
    tmpQ.setFromUnitVectors(UP, dir.normalize());
    m4.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), tmpQ, S.set(w, len + w, w));
    im.setMatrixAt(im.count++, m4);
  };
  const bead = (im, p, s) => {
    m4.compose(P.set(p[0], p[1], p[2]), tmpQ.identity(), S.set(s, s, s));
    im.setMatrixAt(im.count++, m4);
  };
  /** the first k (0..1) of a polyline as segments */
  const polySeg = (im, pts, k, w) => {
    if (k <= 0) return;
    const len = pathLength(pts);
    let left = len * Math.min(1, k);
    for (let i = 1; i < pts.length && left > 0; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (l <= left) seg(im, a, b, w);
      else seg(im, a, a.map((v, j) => v + ((b[j] - v) * left) / l), w);
      left -= l;
    }
  };
  const done = (...ims) => ims.forEach((im) => (im.instanceMatrix.needsUpdate = true));

  // ------------------------------------------------------------ 3: routes and beads
  const lineFaint = bag(200, basic(C.accent, {opacity: 0.32}), 20);
  const lineOn = bag(200, basic(C.accent, {opacity: 1}), 21);
  const beadOn = bag(400, basic(C.accent, {opacity: 1}), 23);
  const beadInk = bag(80, basic(INK, {opacity: 1}), 22);
  const marks = bag(8, basic(INK, {opacity: 0.9}), 22);

  // ------------------------------------------------------------ 4: the ring diagram
  const ring = new THREE.Group();
  ring.position.set(...RING.c);
  root.add(ring);
  const plateMat = std('#f7f3ec', {roughness: 0.85, transparent: true});
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(RING.r + 120, RING.r + 120, 12, 72), plateMat);
  plate.rotation.x = Math.PI / 2;
  plate.position.z = -14;
  plate.castShadow = true;
  ring.add(plate);
  const trackMat = std('#cfc5b5', {transparent: true});
  const track = new THREE.Mesh(new THREE.TorusGeometry(RING.track, 4, 6, 144), trackMat);
  ring.add(track);
  const gpuMat = std('#8f887c', {transparent: true});
  const gpus = new THREE.InstancedMesh(BOX, gpuMat, SPEC.allreduce.gpus);
  for (let i = 0; i < SPEC.allreduce.gpus; i++) {
    const [x, y] = ringXY(i);
    m4.compose(P.set(x, y, 0), tmpQ.setFromAxisAngle(new V3(0, 0, 1), Math.atan2(y, x)), S.set(RING.gpuS, RING.gpuS * 0.7, 14));
    gpus.setMatrixAt(i, m4);
  }
  ring.add(gpus);
  const hubMat = std('#a39a8c', {transparent: true});
  const hub = new THREE.Mesh(BOX, hubMat);
  hub.scale.set(RING.hubS, RING.hubS * 0.62, 30);
  ring.add(hub);
  const hubBase = hubMat.color.clone();
  const spokeMat = std('#d8cfc1', {transparent: true});
  const spokes = new THREE.InstancedMesh(BOX, spokeMat, SPEC.allreduce.gpus);
  for (let i = 0; i < SPEC.allreduce.gpus; i++) {
    const [x, y] = ringXY(i, (RING.r + RING.hubS * 0.4) / 2);
    const l = RING.r - RING.hubS * 0.4;
    m4.compose(P.set(x, y, -3), tmpQ.setFromAxisAngle(new V3(0, 0, 1), Math.atan2(y, x) + Math.PI / 2), S.set(3, l, 3));
    spokes.setMatrixAt(i, m4);
  }
  ring.add(spokes);
  const ringBead = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({color: INK, toneMapped: false}), SPEC.allreduce.gpus);
  const ringBeadAcc = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({color: C.accent, toneMapped: false}), SPEC.allreduce.gpus);
  ring.add(ringBead, ringBeadAcc);
  const ringMats = [plateMat, trackMat, gpuMat, hubMat, spokeMat, ringBead.material, ringBeadAcc.material];
  ringMats.forEach((m) => (m.transparent = true));

  // ------------------------------------------------------------ 5: the outside switch and its cable
  const ibG = new THREE.Group();
  root.add(ibG);
  const ibMat = std('#5d6167');
  const ibBox = new THREE.Mesh(BOX, ibMat);
  ibBox.scale.set(IB.w, IB.h, IB.d);
  ibBox.position.set(...IB.at);
  ibBox.castShadow = true;
  ibG.add(ibBox);
  const ibPorts = new THREE.InstancedMesh(BOX, std('#1f2124'), 16);
  for (let j = 0; j < 16; j++) {
    m4.compose(P.set(IB.at[0] - 120 + (j % 8) * 34, IB.at[1] - 12 + Math.floor(j / 8) * 24, IB.at[2] + IB.d / 2 + 1), tmpQ.identity(), S.set(24, 14, 2));
    ibPorts.setMatrixAt(j, m4);
  }
  ibG.add(ibPorts);
  const cable = new THREE.InstancedMesh(BOX, std('#3a3c40', {roughness: 0.5}), 16);
  cable.count = 0;
  cable.frustumCulled = false;
  ibG.add(cable);

  // ------------------------------------------------------------ 6, 7: dashes
  const PP = powerPaths();
  const CP = coolPaths();
  const nPow = [...PP.feeds, PP.busDown, PP.busUp, ...PP.stubs].reduce((a, p) => a + dashCount(p), 0);
  const nCool = [CP.supply, CP.ret, ...CP.supplyIn, ...CP.retOut, CP.loop].reduce((a, p) => a + dashCount(p, 30, 40), 0);
  const dashAcc = bag(nPow + nCool, basic(C.accent, {opacity: 1}), 22);
  const dashPale = bag(nCool, basic(PALE, {opacity: 1}), 21);

  const hide = (...ims) => ims.forEach((im) => (im.count = 0));
  /**
   * look: {chapter, scene, sceneT, T, slide, lifts, dT, ringK (the diagram's fade), reduced}
   */
  const update = (look) => {
    hide(lineFaint, lineOn, beadOn, beadInk, marks, dashAcc, dashPale, cable);
    const ch = look.chapter;
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const slide = look.slide ?? 0;
    // 3 (once tray 3 is back in the rack: the routes start inside it)
    const inRack = (look.lifts?.[0] ?? 0) < 0.02;
    if (ch === 3 && sc === 'fan' && inRack) {
      const f = fanPose(t, slide);
      for (const p of f.paths) {
        polySeg(lineFaint, p.pts, 1, 6);
        polySeg(lineOn, p.pts, p.k, 9);
      }
      bead(marks, f.paths[0].pts[0], 40);
    }
    if (ch === 3 && sc === 'hop' && inRack) {
      const h = hopPose(t, slide);
      const A = [...h.legs.back, ...h.legs.down.slice(1), ...h.legs.tochip.slice(1)];
      const Bp = [...h.legs.fromchip, ...h.legs.down2.slice(1), ...h.legs.in.slice(1)];
      polySeg(lineFaint, A, 1, 6);
      polySeg(lineFaint, Bp, 1, 6);
      // the drawn part follows the bead
      const iA = ['gpu', 'back', 'down', 'tochip'].indexOf(h.leg);
      if (h.firstDone) polySeg(lineOn, A, 1, 10);
      else if (iA >= 1) {
        const pre = ['back', 'down', 'tochip'].slice(0, iA - 1).reduce((a, k) => a + pathLength(h.legs[k]), 0);
        polySeg(lineOn, A, (pre + pathLength(h.legs[h.leg]) * smooth(h.u)) / pathLength(A), 10);
      }
      if (h.secondShown) {
        const iB = ['fromchip', 'down2', 'in', 'arrive'].indexOf(h.leg);
        const pre = ['fromchip', 'down2', 'in'].slice(0, Math.min(3, iB)).reduce((a, k) => a + pathLength(h.legs[k]), 0);
        const cur = iB < 3 ? pathLength(h.legs[h.leg]) * smooth(h.u) : 0;
        polySeg(lineOn, Bp, (pre + cur) / pathLength(Bp), 10);
      }
      bead(beadOn, h.p, 46);
      bead(marks, A[0], 40);
      bead(marks, Bp[Bp.length - 1], 40);
    }
    // 4
    const rk = look.ringK ?? 0;
    ring.visible = rk > 0.01;
    if (ring.visible) {
      ringMats.forEach((m) => (m.opacity = rk));
      plateMat.opacity = rk * 0.96;
      ring.scale.setScalar(0.92 + 0.08 * rk);
      ringBead.count = 0;
      ringBeadAcc.count = 0;
      const isSharp = sc === 'sharp';
      spokes.visible = isSharp;
      hub.visible = isSharp;
      if (sc === 'ring') {
        for (const b of ringBeads(t)) {
          m4.compose(P.set(b.x, b.y, 16), tmpQ.identity(), S.setScalar(RING.bead));
          const im = b.gather ? ringBeadAcc : ringBead;
          im.setMatrixAt(im.count++, m4);
        }
      } else if (isSharp) {
        const sb = sharpBeads(t);
        for (const b of sb.beads) {
          m4.compose(P.set(b.x, b.y, 16), tmpQ.identity(), S.setScalar(RING.bead * 0.9));
          const im = b.back ? ringBeadAcc : ringBead;
          im.setMatrixAt(im.count++, m4);
        }
        hubMat.color.copy(hubBase).lerp(rack.K.accent, sb.hubK);
      }
      ringBead.instanceMatrix.needsUpdate = true;
      ringBeadAcc.instanceMatrix.needsUpdate = true;
    }
    // 5
    const ok5 = ch === 5;
    ibG.visible = ok5;
    if (ok5) {
      const pull = look.lifts?.[0] ?? 1;
      const op = outPath(pull);
      // the cable from the OSFP to the IB switch
      for (let i = 5; i < op.length; i++) seg(cable, op[i - 1], op[i], 9);
      cable.instanceMatrix.needsUpdate = true;
      polySeg(lineFaint, op, 1, 6);
      const np = nvlStubPath(pull);
      polySeg(lineFaint, np, 1, 6);
      const ob = outBeads(t);
      for (const b of ob.outs) bead(beadInk, along(op, b.u), 26);
      for (const b of ob.ins) bead(beadOn, along(np, b.u), 18);
    }
    // 6
    const T = look.T ?? 0;
    const sp = look.reduced ? 0 : 1;
    if (ch === 6) {
      const k = look.powerK ?? 1;
      if (k > 0.02) {
        for (const p of [...PP.feeds, PP.busDown, PP.busUp, ...PP.stubs]) for (const d of dashes(p, T, 260 * sp)) seg(dashAcc, d.a, d.b, 12);
      }
    }
    // 7
    if (ch === 7) {
      const v = 200 * (look.flowK ?? 1) * sp;
      for (const p of [CP.supply, ...CP.supplyIn]) for (const d of dashes(p, T, v, 30, 40)) seg(dashPale, d.a, d.b, 12);
      for (const p of [CP.ret, ...CP.retOut]) for (const d of dashes(p, T, v, 30, 40)) seg(dashAcc, d.a, d.b, 12);
      // the loop in tray 3: the first half still cold (pale), the second half warmed (full)
      const half = Math.floor(CP.loop.length / 2);
      for (const d of dashes(CP.loop.slice(0, half + 1), T, v, 30, 40)) seg(dashPale, d.a, d.b, 10);
      for (const d of dashes(CP.loop.slice(half), T, v, 30, 40)) seg(dashAcc, d.a, d.b, 10);
    }
    done(lineFaint, lineOn, beadOn, beadInk, marks, dashAcc, dashPale);
  };

  // ------------------------------------------------------------ tags in screen pixels
  const W = new V3();
  const scr = (project, p) => {
    W.set(...p);
    root.localToWorld(W);
    return project(W.x, W.y, W.z);
  };
  const scrRing = (project, x, y, z = 20) => {
    W.set(x, y, z);
    ring.localToWorld(W);
    return project(W.x, W.y, W.z);
  };
  /** tags: [{x, y, h, v, html, o, kind, on}] */
  const overlay = (look, project) => {
    const out = [];
    root.updateWorldMatrix(true, true);
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const inRack = (look.lifts?.[0] ?? 0) < 0.02;
    if (look.chapter === 3 && sc === 'hop' && inRack) {
      const h = hopPose(t, look.slide ?? 0);
      const a = scr(project, h.legs.back[0]);
      const b = scr(project, h.legs.in[h.legs.in.length - 1]);
      if (a) out.push({kind: 'lbl', x: a[0] - 16, y: a[1], h: 'l', v: 'm', o: 1, on: !h.secondShown, html: '<b>GPU 1（計算トレイ 3）</b><span>送り手</span>'});
      if (b) out.push({kind: 'lbl', x: b[0] - 16, y: b[1], h: 'l', v: 'm', o: 1, on: h.done || h.leg === 'arrive', html: '<b>GPU 3（計算トレイ 15）</b><span>受け手</span>'});
      const c = chipOf(h.chip);
      const pc = scr(project, h.legs.chip[0]);
      if (pc) out.push({kind: 'lbl', x: pc[0] - 22, y: pc[1] + 6, h: 'l', v: 't', o: 1, on: h.leg === 'chip', html: `<b>NVSwitch（スイッチトレイ ${c.tray}・${c.side ? '右' : '左'}）</b><span>通ったスイッチ ${h.hops} 個</span>`});
    }
    if (look.chapter === 3 && sc === 'fan' && inRack) {
      const f = fanPose(t, look.slide ?? 0);
      const a = scr(project, f.paths[0].pts[0]);
      if (a) out.push({kind: 'lbl', x: a[0] - 16, y: a[1], h: 'l', v: 'm', o: 1, on: true, html: `<b>GPU 1（計算トレイ 3）</b><span>リンク ${f.lit} / 18 本</span>`});
    }
    if ((look.ringK ?? 0) > 0.6) {
      const top = scrRing(project, 0, RING.r + 135);
      if (top) out.push({kind: 'note', x: top[0], y: top[1], h: 'c', v: 'b', o: 1, html: 'GPU 72 個を輪に並べた図（実際の並びではない）'});
      // under the plate: what the centre box is (SHARP) and what the two bead colours mean
      const lb = scrRing(project, 0, -RING.r - 135);
      const key = sc === 'ring' ? '<b>黒: 足している途中　<i style="font-style:normal;color:#e3562a">色: 足し終わった分</i></b><span>隣へ 1/72 ずつ、142 回</span>' : '<b>中央: NVSwitch × 18（1 つにまとめて描く）</b><span>黒: 送る 1 GB　色: 中で足して返す合計</span>';
      if (lb) out.push({kind: 'lbl', x: lb[0], y: lb[1], h: 'c', v: 't', o: 1, on: sc === 'sharp', html: key});
    }
    if (look.chapter === 5) {
      const pull = look.lifts?.[0] ?? 1;
      const op = outPath(pull);
      const np = nvlStubPath(pull);
      const ib = scr(project, [IB.at[0], IB.at[1] + IB.h / 2, IB.at[2]]);
      if (ib) out.push({kind: 'lbl', x: ib[0], y: ib[1] - 8, h: 'c', v: 'b', o: 1, html: '<b>InfiniBand スイッチ（ラックの外）</b><span>レールに沿った fat tree</span>'});
      const pn = scr(project, np[np.length - 1]);
      if (pn) out.push({kind: 'lbl', x: pn[0] - 14, y: pn[1], h: 'l', v: 'm', o: 1, on: true, html: `<b>NVLink 1.8 TB/s</b><span>背面のコネクタ → カートリッジ</span>`});
    }
    return out;
  };
  return {root, update, overlay, ring};
}
const smooth = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};
