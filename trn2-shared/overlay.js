// Chapters 3-7 drawn beside and over the racks, in the racks' millimetres (the group hangs under rack.root):
//   3  the torus diagram, one layer: 16 chips on a 4 × 4 grid, the straight links, the wrap-around arcs (x wrap above the
//      layer, y wrap below it), device 0's 4 neighbours (torus) and a bead relayed from 0 to 10 (hop)
//   4  the 3 other layers come in under it and the z rings join them (thin links); a bead goes 0 → 42 (6 hops)
//   5  the all-reduce on the 4 layers: 64 beads round one ring (flat), or round the layers' rings, the z rings and the
//      layers' rings again (hier)
//   6  the pulled sled's two streams: the dense NeuronLink one to the back, the sparse one out through the EFA port
//   7  the labels over the NVL72 silhouette and the two racks
// The diagram is a picture, not the real layout. Lines and beads are drawn over everything (no depth test).
// update(look) poses it; overlay(look, project) returns the HTML tags in screen pixels. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {coord, flatAt, FLAT_CYCLE, hierAt, INST, layerCycle, NVL, SPEC, torusAt, ULTRA, zRing, zringAt} from './kin.js';
import {along, diagramLinks, edgePath, EFA, flatBeads, hierBeads, hopPose, LAT, layerY, nlStubPath, nodeW, NV_AT, outBeads, outPath, pathLength, smooth, zringPose} from './flow.js';
import {PALE} from './rack.js';

const V3 = THREE.Vector3;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const INK = '#2f2c28';
const W_IN = 14; // the inner (instance) links
const W_Z = 5; // the links between instances: a quarter of the bandwidth, drawn thinner

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
  const bag = (n, mat, order = 20) => {
    const im = new THREE.InstancedMesh(BOX, mat, n);
    im.frustumCulled = false;
    im.renderOrder = order;
    im.count = 0;
    root.add(im);
    return im;
  };
  const seg = (im, a, b, w) => {
    if (im.count >= im.instanceMatrix.count) return;
    dir.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const len = dir.length();
    if (len < 0.5) return;
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

  // ------------------------------------------------------------ lines and beads
  const lineFaint = bag(4000, basic(C.accent, {opacity: 0.3}), 20);
  const lineMid = bag(1500, basic(C.accent, {opacity: 0.55}), 20);
  const lineOn = bag(3000, basic(C.accent, {opacity: 1}), 21);
  const linePale = bag(1200, basic(PALE, {opacity: 1}), 21);
  const beadOn = bag(200, basic(C.accent, {opacity: 1}), 23);
  const beadInk = bag(200, basic(INK, {opacity: 1}), 22);

  // ------------------------------------------------------------ the diagram: 4 plates and 64 chips
  const diag = new THREE.Group();
  root.add(diag);
  const plateMat = std('#f4f6f7', {roughness: 0.85, transparent: true, opacity: 0.8, depthWrite: false});
  const plates = [0, 1, 2, 3].map(() => {
    const m = new THREE.Mesh(BOX, plateMat);
    const R = 2 * (1.5 * LAT.sp + LAT.out + 70);
    m.scale.set(R, 6, R);
    m.renderOrder = 5;
    diag.add(m);
    return m;
  });
  const nodeMat = std('#848c92');
  const nodes = new THREE.InstancedMesh(BOX, nodeMat, 64);
  nodes.castShadow = false;
  diag.add(nodes);
  const accent = new THREE.Color(C.accent);
  const nodeBase = nodeMat.color.clone();
  const white = new THREE.Color(1, 1, 1);
  const onCol = new THREE.Color(accent.r / nodeBase.r, accent.g / nodeBase.g, accent.b / nodeBase.b);
  for (let i = 0; i < 64; i++) nodes.setColorAt(i, white);
  const LINKS_I = diagramLinks(INST, 0);

  // ------------------------------------------------------------ 6: the EFA switch and its cable
  const efaG = new THREE.Group();
  root.add(efaG);
  const efaBox = new THREE.Mesh(BOX, std('#5d6167'));
  efaBox.scale.set(EFA.w, EFA.h, EFA.d);
  efaBox.position.set(...EFA.at);
  efaBox.castShadow = true;
  efaG.add(efaBox);
  const efaPorts = new THREE.InstancedMesh(BOX, std('#1f2124'), 16);
  for (let j = 0; j < 16; j++) {
    m4.compose(P.set(EFA.at[0] - 120 + (j % 8) * 34, EFA.at[1] - 12 + Math.floor(j / 8) * 24, EFA.at[2] + EFA.d / 2 + 1), tmpQ.identity(), S.set(24, 14, 2));
    efaPorts.setMatrixAt(j, m4);
  }
  efaG.add(efaPorts);
  const cable = new THREE.InstancedMesh(BOX, std('#8fa3a6', {roughness: 0.5}), 16);
  cable.count = 0;
  cable.frustumCulled = false;
  efaG.add(cable);

  const hide = (...ims) => ims.forEach((im) => (im.count = 0));
  let lastNodes = '';
  /** look: {chapter, scene, sceneT, lifts, diagramK, reduced} */
  const update = (look) => {
    hide(lineFaint, lineMid, lineOn, linePale, beadOn, beadInk, cable);
    const ch = look.chapter;
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const dk = look.diagramK ?? 0;
    diag.visible = dk > 0.01;
    // ------------------------------------------------------------ 3-5: the diagram
    if (diag.visible) {
      // how far the 3 lower layers are in: 0 in chapter 3, the scene's in 4, 1 in 5
      const lk = ch === 3 ? 0 : ch === 4 && sc === 'zring' ? zringAt(t).layersK : 1;
      const show = (z) => z === 0 || lk > 0.02;
      plateMat.opacity = 0.75 * dk;
      lineFaint.material.opacity = 0.3 * dk;
      plates.forEach((m, z) => {
        m.visible = show(z);
        m.position.set(LAT.x, layerY(z, lk) - 26, LAT.z);
      });
      // the lit chips
      let lit = [];
      if (ch === 3 && sc === 'torus') {
        const s = torusAt(t);
        lit = [0, ...(s.nbK > 0.5 ? s.nb : [])];
      } else if (ch === 3 && sc === 'hop') lit = hopPose(t).path.slice(0, hopPose(t).hops + 1);
      else if (ch === 4 && sc === 'zring') {
        const z = zringPose(t);
        lit = z.waiting ? [] : z.path.slice(0, z.hops + 1);
      }
      const key = `${lit.join()}|${lk.toFixed(3)}`;
      if (key !== lastNodes) {
        lastNodes = key;
        for (let i = 0; i < 64; i++) {
          const z = coord(i)[2];
          const p = nodeW(i, lk);
          const s = show(z) ? LAT.node : 0.001;
          m4.compose(P.set(p[0], p[1] - 8, p[2]), tmpQ.identity(), S.set(s, s * 0.32, s));
          nodes.setMatrixAt(i, m4);
          nodes.setColorAt(i, lit.includes(i) ? onCol : white);
        }
        nodes.instanceMatrix.needsUpdate = true;
        nodes.instanceColor.needsUpdate = true;
      }
      if (ch === 3) {
        const s = sc === 'torus' ? torusAt(t) : {gridK: 1, wrapK: 1, nbK: 0};
        // the torus: the grid and the arcs in a middle tone, then device 0's 4 links in the full accent
        for (const l of LINKS_I) polySeg(sc === 'torus' ? lineMid : lineFaint, l.pts, l.wrap ? s.wrapK : s.gridK, W_IN);
        if (sc === 'torus' && s.nbK > 0) for (const j of s.nb) polySeg(lineOn, edgePath(0, j, 0), s.nbK, W_IN + 6);
        if (sc === 'hop') {
          const h = hopPose(t);
          for (let k = 0; k < h.path.length - 1; k++) {
            const pts = edgePath(h.path[k], h.path[k + 1], 0);
            if (k < h.k || h.done) polySeg(lineOn, pts, 1, W_IN + 4);
            else if (k === h.k && t >= 0.5) polySeg(lineOn, pts, smooth(h.u), W_IN + 4);
          }
          bead(beadOn, h.p, 54);
        }
      } else {
        const links = diagramLinks(ULTRA, lk);
        for (const l of links) {
          if (l.dim === 2) continue;
          polySeg(lineFaint, l.pts, 1, W_IN);
        }
        const zk = ch === 4 && sc === 'zring' ? zringAt(t).ringsK : 1;
        for (const l of links) if (l.dim === 2) polySeg(ch === 4 ? linePale : lineFaint, l.pts, zk, W_Z);
        if (ch === 4 && sc === 'zring') {
          const z = zringPose(t);
          if (!z.waiting) {
            for (let k = 0; k < z.path.length - 1; k++) {
              const pts = edgePath(z.path[k], z.path[k + 1]);
              const w = coord(z.path[k])[2] !== coord(z.path[k + 1])[2] ? W_Z + 6 : W_IN + 4;
              if (k < z.k || z.done) polySeg(lineOn, pts, 1, w);
              else if (k === z.k) polySeg(lineOn, pts, smooth(z.u), w);
            }
            bead(beadOn, z.p, 54);
          }
        }
        if (ch === 5 && sc === 'flat') {
          // the one ring: its inner links and its 4 links between instances
          for (let i = 0; i < FLAT_CYCLE.length; i++) {
            const a = FLAT_CYCLE[i];
            const b = FLAT_CYCLE[(i + 1) % FLAT_CYCLE.length];
            const inter = coord(a)[2] !== coord(b)[2];
            polySeg(inter ? lineOn : linePale, edgePath(a, b), 1, inter ? W_Z + 3 : W_IN);
          }
          for (const b of flatBeads(t)) bead(b.gather ? beadOn : beadInk, b.p, 30);
        }
        if (ch === 5 && sc === 'hier') {
          const hb = hierBeads(t);
          if (hb.phase === 'in1' || hb.phase === 'in2' || hb.phase === 'done')
            for (let z = 0; z < 4; z++) {
              const cyc = layerCycle(z);
              for (let i = 0; i < 16; i++) polySeg(lineOn, edgePath(cyc[i], cyc[(i + 1) % 16]), 1, W_IN);
            }
          if (hb.phase === 'z') for (let i = 0; i < 16; i++) {
            const r = zRing(i);
            for (let j = 0; j < 4; j++) polySeg(lineOn, edgePath(r[j], r[(j + 1) % 4]), 1, W_Z + 3);
          }
          for (const b of hb.beads) bead(b.done ? beadOn : beadInk, b.p, b.small ? 18 : 30);
        }
      }
    }
    // ------------------------------------------------------------ 6
    efaG.visible = ch === 6;
    if (ch === 6) {
      const pull = look.lifts?.[0] ?? 1;
      const op = outPath(pull);
      for (let i = 5; i < op.length; i++) seg(cable, op[i - 1], op[i], 9);
      cable.instanceMatrix.needsUpdate = true;
      polySeg(lineFaint, op, 1, 6);
      const np = nlStubPath(pull);
      polySeg(lineFaint, np, 1, 6);
      const ob = outBeads(t);
      for (const b of ob.outs) bead(beadInk, along(op, b.u), 26);
      for (const b of ob.ins) bead(beadOn, along(np, b.u), 16);
    }
    done(lineFaint, lineMid, lineOn, linePale, beadOn, beadInk);
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
    const dk = look.diagramK ?? 0;
    if (dk > 0.6) {
      const lk = ch === 3 ? 0 : ch === 4 && sc === 'zring' ? zringAt(t).layersK : 1;
      const top = scr(project, [LAT.x, layerY(0, lk) + 40, LAT.z - 1.5 * LAT.sp - LAT.out - 70]);
      if (top) out.push({kind: 'note', x: top[0], y: top[1] - 6, h: 'c', v: 'b', o: 1, html: `${ch === 3 ? '1 台の 16 個' : '4 台・64 個'}を格子に並べた図（実際の並びではない）`});
      // chip numbers: every chip of the layer in chapter 3, the two ends of the route in chapter 4
      const nums = ch === 3 ? Array.from({length: 16}, (_, i) => i) : ch === 4 ? [SPEC.demo.zFrom, SPEC.demo.zTo] : [];
      for (const i of nums) {
        const p = nodeW(i, lk);
        const s = scr(project, [p[0] - LAT.node / 2 - 6, p[1] + 6, p[2] + LAT.node / 2]);
        if (s) out.push({kind: 'num', x: s[0], y: s[1], h: 'l', v: 'm', o: 1, on: ch === 4, html: `${i}`});
      }
      // the layers: which instance each is
      if (ch >= 4 && lk > 0.6)
        for (let z = 0; z < 4; z++) {
          const p = scr(project, [LAT.x - 1.5 * LAT.sp - LAT.out - 70, layerY(z, lk) - 20, LAT.z + 1.5 * LAT.sp]);
          if (p) out.push({kind: 'note', x: p[0] - 10, y: p[1], h: 'l', v: 'm', o: 1, html: `${z + 1} 台目`});
        }
      if (ch === 3 && sc === 'hop') {
        const h = hopPose(t);
        const a = scr(project, nodeW(h.path[0], 0));
        const b = scr(project, nodeW(h.path[h.path.length - 1], 0));
        if (a) out.push({kind: 'lbl', x: a[0] - 44, y: a[1], h: 'l', v: 'm', o: 1, on: h.hops === 0, html: '<b>デバイス 0</b><span>送り手</span>'});
        if (b) out.push({kind: 'lbl', x: b[0], y: b[1] + 24, h: 'c', v: 't', o: 1, on: h.done, html: `<b>デバイス 10</b><span>受け手・${h.done ? h.hops : '…'} 段</span>`});
      }
      if (ch === 5 && sc === 'flat') {
        // one of the ring's links between instances
        const i = FLAT_CYCLE.findIndex((a, k) => coord(a)[2] !== coord(FLAT_CYCLE[(k + 1) % 64])[2]);
        const m = along(edgePath(FLAT_CYCLE[i], FLAT_CYCLE[i + 1]), 0.5);
        const p = scr(project, m);
        if (p) out.push({kind: 'lbl', x: p[0] + 22, y: p[1], h: 'r', v: 'm', o: 1, on: true, html: '<b>細い「間」のリンク</b><span>輪はここも通る</span>'});
      }
    }
    if (ch === 6) {
      const pull = look.lifts?.[0] ?? 1;
      const np = nlStubPath(pull);
      const e = scr(project, [EFA.at[0], EFA.at[1] + EFA.h / 2, EFA.at[2]]);
      if (e) out.push({kind: 'lbl', x: e[0], y: e[1] - 8, h: 'c', v: 'b', o: 1, html: '<b>EFA のネットワーク（サーバーの外）</b><span>UltraServer どうしをつなぐ</span>'});
      const pn = scr(project, np[np.length - 1]);
      if (pn) out.push({kind: 'lbl', x: pn[0] - 14, y: pn[1], h: 'l', v: 'm', o: 1, on: true, html: `<b>NeuronLink ${SPEC.chip.linkTBs} TB/s</b><span>背面のコネクタへ（中＋間）</span>`});
    }
    if (ch === 7 && (look.nvK ?? 0) > 0.6) {
      const a = scr(project, [NV_AT.x, NVL.rack.h + 40, NV_AT.z]);
      const b = scr(project, [0, NVL.rack.h + 40, 0]);
      if (a) out.push({kind: 'lbl', x: a[0], y: a[1], h: 'c', v: 'b', o: 1, html: `<b>GB200 NVL72（簡略）</b><span>スイッチ ${NVL.switchChips} 個・液冷</span>`});
      if (b) out.push({kind: 'lbl', x: b[0], y: b[1], h: 'c', v: 'b', o: 1, on: true, html: '<b>Trn2 UltraServer（形は仮定）</b><span>スイッチ 0 個・空冷（報道）</span>'});
    }
    return out;
  };
  return {root, update, overlay};
}
export {flatAt, hierAt};
