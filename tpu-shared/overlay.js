// Lines and beads, in the rack's millimetres (the group hangs under rack.root). Only the lines of the scene on screen
// are drawn (a torus or an OCS with every line on would be a hairball):
//   1  the cube's 64 board lines (each tray's 2 × 2 ring)
//   3  six: the 6 lines of one chip; hop: the route corner to corner; wrap: the 3-hop way (faint) and the optical way
//      out of −X, through the OCS, in through +X. The kind of a line reads from its shade: board dark, copper middle,
//      optical light; the part in use is the accent
//   4  the optical paths cube → OCS rank → cube that the mirrors set (the old ones draw back, the new ones grow)
//   5  the NVL72 way (GPU → switch → GPU) and the cube's way (0,0,0) → (2,2,2)
//   6  the dense ICI stream to the OSFP and up the fibres, the sparse DCN one through the host and its NIC to Jupiter
//   7  dashes of current (416 V AC pale, DC full) and of coolant (supply pale, return full)
// Lines on the diagrams are depth-tested (they are 3D drawings); routes inside the rack are drawn over everything.
// update(look) poses it; overlay(look, project) returns the HTML tags in screen pixels. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {cubeLinks, FAILED, linkKind, SPEC} from './kin.js';
import {along, CDU, coolPaths, CUBE, cubeXYZ, dashCount, dashes, dcnPath, hopPose, iciPath, JUP, MINI, miniCentres, NVR, OCS3, OCS4, outBeads, PAIRS, pathLength, powerPaths, rankY, RANKS, sixPose, vPath, vsPose, wrapPose} from './flow.js';

const V3 = THREE.Vector3;
const BOX = new THREE.BoxGeometry(1, 1, 1);
const PALE = '#8fd0d4';
const INK = '#2f2c28';
export const SHADE = {board: '#353c41', copper: '#7f898f', optical: '#b4bec4'};
const W = {board: 11, copper: 9, optical: 9};
const ease = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * (3 - 2 * u);
};

export function buildOverlay(rack) {
  const root = new THREE.Group();
  rack.root.add(root);
  const basic = (color, extra = {}) => new THREE.MeshBasicMaterial({color, toneMapped: false, depthTest: false, depthWrite: false, transparent: true, ...extra});
  const flat = (color) => new THREE.MeshBasicMaterial({color, toneMapped: false});
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
    m4.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), tmpQ, S.set(w, len + w * 0.6, w));
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
  const done = (...ims) => ims.forEach((im) => (im.instanceMatrix.needsUpdate = true));

  // ------------------------------------------------------------ the bags
  // on the diagrams (depth-tested): one per kind, the accent, the faint ghost, beads
  const kind = {board: bag(80, flat(SHADE.board), 10), copper: bag(40, flat(SHADE.copper), 10), optical: bag(60, flat(SHADE.optical), 10)};
  const dOn = bag(80, flat(C.accent), 11);
  const dGhost = bag(20, flat('#d5dce0'), 10);
  const dBead = bag(4, flat(C.accent), 12);
  // over the rack (no depth test)
  const lineFaint = bag(40, basic(C.accent, {opacity: 0.32}), 20);
  const lineInk = bag(40, basic(INK, {opacity: 0.5}), 20);
  const beadOn = bag(200, basic(C.accent, {opacity: 1}), 23);
  const beadInk = bag(20, basic(INK, {opacity: 1}), 22);
  const PP = powerPaths();
  const CP = coolPaths();
  const powerList = [PP.down, PP.bbu, ...PP.stubs];
  const coolS = [CP.feed, CP.feed2, ...CP.supply, ...CP.supplyIn, ...CP.branches.map((b) => b.sup)];
  const coolR = [...CP.ret, ...CP.retOut, CP.back2, CP.back, ...CP.branches.map((b) => b.ret)];
  const nPow = [PP.ac, ...powerList].reduce((a, p) => a + dashCount(p), 0);
  const nCool = [...coolS, ...coolR].reduce((a, p) => a + dashCount(p, 30, 40), 0);
  const dashAcc = bag(nPow + nCool, basic(C.accent, {opacity: 1}), 22);
  const dashPale = bag(nPow + nCool, basic(PALE, {opacity: 1}), 21);
  const BOARD = cubeLinks().filter((l) => l.kind === 'board');

  const hide = (...ims) => ims.forEach((im) => (im.count = 0));
  const ALL = [kind.board, kind.copper, kind.optical, dOn, dGhost, dBead, lineFaint, lineInk, beadOn, beadInk, dashAcc, dashPale];
  /** look: {chapter, scene, sceneT, T, cubeK, cubeC, ocs: ocsAt(), swap: swapAt(), reduced} */
  const update = (look) => {
    hide(...ALL);
    const ch = look.chapter;
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const c = look.cubeC ?? CUBE.c;
    const showCube = (look.cubeK ?? 0) > 0.6;
    // 1: the trays' board lines
    if (ch === 1 && showCube) for (const l of BOARD) seg(kind.board, cubeXYZ(l.a, c), cubeXYZ(l.b, c), W.board * 0.8);
    // 3
    if (ch === 3 && showCube && sc === 'six') {
      const f = sixPose(t, c);
      for (const l of f.lines) polySeg(kind[l.kind], l.pts, l.k, W[l.kind] + 3);
    }
    if (ch === 3 && showCube && sc === 'hop') {
      const h = hopPose(t, c);
      for (let i = 0; i < h.pts.length - 1; i++) seg(kind[linkKind(h.path[i], h.path[i + 1])], h.pts[i], h.pts[i + 1], W.board);
      polySeg(dOn, h.pts, h.k / (h.pts.length - 1), 17);
      if (!h.done) bead(dBead, h.p, 62);
    }
    if (ch === 3 && showCube && sc === 'wrap') {
      const w = wrapPose(t, c);
      polySeg(dGhost, w.ghost, ease(w.ghostK), 9);
      const opt = [...w.out, ...w.mid.slice(1), ...w.inn.slice(1)];
      if (w.legIndex >= 1) {
        polySeg(kind.optical, opt, 1, 11);
        const legs = ['out', 'ocs', 'in'];
        const iL = legs.indexOf(w.leg);
        const pre = [w.out, w.mid, w.inn].slice(0, iL < 0 ? 3 : iL).reduce((a, p) => a + pathLength(p), 0);
        const cur = iL >= 0 ? pathLength([w.out, w.mid, w.inn][iL]) * ease(w.u) : 0;
        polySeg(dOn, opt, (pre + cur) / pathLength(opt), 17);
      }
      if (!w.done && w.legIndex >= 1) bead(dBead, w.p, 62);
    }
    // 4: the optical paths the OCS sets
    if (ch === 4 && (sc === 'ocs' || sc === 'swap') && (look.minisK ?? 0) > 0.6) {
      if (sc === 'ocs') {
        const o = look.ocs;
        const cs = miniCentres(o.move);
        PAIRS.column.forEach((p, i) => polySeg(o.tilt > 0 ? kind.optical : dOn, vPath(cs, p, i), 1 - o.tilt, 10));
        PAIRS.flat.forEach((p, i) => polySeg(dOn, vPath(cs, p, i), o.tilt, 12));
      } else {
        const s = look.swap;
        const cs = miniCentres(1);
        PAIRS.flat.forEach((p, i) => {
          const hit = p[0] === FAILED || p[1] === FAILED;
          if (!hit) polySeg(dOn, vPath(cs, p, i), 1, 12);
          else polySeg(s.fail > 0.5 ? kind.optical : dOn, vPath(cs, p, i), 1 - s.tilt, 10);
        });
        PAIRS.swapped.forEach((p, i) => {
          if (p[0] === 4 || p[1] === 4) polySeg(dOn, vPath(cs, p, i), s.join, 12);
        });
      }
    }
    // 5
    if (ch === 5 && sc === 'vs' && showCube) {
      const v = vsPose(t);
      for (let i = 0; i < v.pts.length - 1; i++) seg(kind[linkKind(v.iw[i], v.iw[i + 1])], v.pts[i], v.pts[i + 1], W.board);
      polySeg(dOn, v.pts, v.iwU, 17);
      seg(kind.copper, v.nv[0], v.nv[1], 8);
      seg(kind.copper, v.nv[1], v.nv[2], 8);
      polySeg(dOn, v.nv, v.nvU, 14);
      if (!v.done) {
        bead(dBead, v.iwP, 62);
        if (v.nvU < 1) bead(dBead, v.nvP, 46);
      }
    }
    // 6
    if (ch === 6) {
      const ip = iciPath();
      const dp = dcnPath();
      polySeg(lineFaint, ip, 1, 8);
      polySeg(lineInk, dp, 1, 12);
      const ob = outBeads(t);
      for (const b of ob.outs) bead(beadInk, along(dp, b.u), 40);
      for (const b of ob.ins) bead(beadOn, along(ip, b.u), 20);
    }
    // 7
    const T = look.T ?? 0;
    const sp = look.reduced ? 0 : 1;
    if (ch === 7 && sc === 'power') {
      const k = look.powerK ?? 1;
      if (k > 0.02) {
        for (const d of dashes(PP.ac, T, 260 * sp)) seg(dashPale, d.a, d.b, 14);
        for (const p of powerList) for (const d of dashes(p, T, 260 * sp)) seg(dashAcc, d.a, d.b, 12);
      }
    }
    if (ch === 7 && sc === 'cool') {
      const v = 200 * sp;
      for (const p of coolS) for (const d of dashes(p, T, v, 30, 40)) seg(dashPale, d.a, d.b, 12);
      for (const p of coolR) for (const d of dashes(p, T, v, 30, 40)) seg(dashAcc, d.a, d.b, 12);
    }
    done(...ALL);
  };

  // ------------------------------------------------------------ tags in screen pixels
  const Wv = new V3();
  const scr = (project, p) => {
    Wv.set(...p);
    root.localToWorld(Wv);
    return project(Wv.x, Wv.y, Wv.z);
  };
  const lbl = (out, p, html, h = 'l', v = 'm', on = false, dx = -16, dy = 0) => p && out.push({kind: 'lbl', x: p[0] + dx, y: p[1] + dy, h, v, o: 1, on, html});
  const note = (out, p, html, h = 'c', v = 't') => p && out.push({kind: 'note', x: p[0], y: p[1], h, v, o: 1, html});
  const xyz = (c) => `(${c.join(',')})`;
  const KJ = {board: '基板の配線', copper: '銅ケーブル', optical: '光'};
  /** tags: [{x, y, h, v, html, o, kind, on}] */
  const overlay = (look, project) => {
    const out = [];
    root.updateWorldMatrix(true, true);
    const sc = look.scene;
    const t = look.sceneT ?? 0;
    const c = look.cubeC ?? CUBE.c;
    const ch = look.chapter;
    const ready = (look.cubeK ?? 0) > 0.9;
    const legend = () => note(out, scr(project, [c[0], c[1] - 2 * CUBE.S - 60, c[2] + 1.5 * CUBE.S]), `<span style="color:${SHADE.board}">━ 基板の配線</span>　<span style="color:${SHADE.copper}">━ 銅ケーブル</span>　<span style="color:#98a3a9">━ 光（OCS 経由）</span>`);
    if (ch === 3 && ready && sc === 'six') {
      const f = sixPose(t, c);
      lbl(out, scr(project, f.a), `<b>チップ ${xyz(f.from)}</b><span>線 ${f.lit} / 6 本・行き先は隣だけ</span>`, 'r', 'b', true, 18, -14);
      legend();
    }
    if (ch === 3 && ready && sc === 'hop') {
      const h = hopPose(t, c);
      lbl(out, scr(project, h.pts[0]), `<b>${xyz(h.path[0])}</b><span>送り手</span>`, 'l', 'm', !h.done && h.hops === 0);
      lbl(out, scr(project, h.pts[h.pts.length - 1]), `<b>${xyz(h.path[h.path.length - 1])}</b><span>${h.done ? '6 回で届いた' : '受け手'}</span>`, 'r', 'm', h.done || h.leg === 'arrive', 18);
      legend();
    }
    if (ch === 3 && ready && sc === 'wrap') {
      const w = wrapPose(t, c);
      lbl(out, scr(project, w.a), `<b>${xyz(SPEC.demo.wrapFrom)}</b><span>−X の端</span>`, 'r', 'b', false, -18, -16);
      lbl(out, scr(project, w.b), `<b>${xyz(SPEC.demo.wrapTo)}</b><span>${w.hops ? '光で 1 回' : '+X の端'}</span>`, 'l', 'b', w.hops > 0, 18, -16);
      lbl(out, scr(project, [OCS3.c[0], OCS3.c[1] - OCS3.h / 2, OCS3.c[2]]), `<b>OCS（X の段）</b><span>鏡で折り返す・パケットは読まない</span>`, 'c', 't', w.leg === 'ocs', 0, 10);
      const g = scr(project, cubeXYZ([1.5, 0, 0], c));
      if (g && w.ghostK > 0.5) note(out, [g[0], g[1] - 40], '中を通ると 3 回', 'c', 'b');
    }
    if (ch === 4 && (sc === 'ocs' || sc === 'swap') && (look.minisK ?? 0) > 0.9) {
      RANKS.forEach((a) => lbl(out, scr(project, [OCS4.c[0] + OCS4.w / 2, rankY(a), OCS4.c[2] + OCS4.d / 2]), `<b>${a} の段</b>`, 'r', 'm', false, 14));
      lbl(out, scr(project, [OCS4.c[0], OCS4.c[1] - OCS4.h / 2, OCS4.c[2]]), '<b>OCS（光の回線スイッチ）</b><span>鏡の向きで面と面をつなぐ</span>', 'c', 't', (look.ocs?.phase ?? look.swap?.phase) === 'tilt', 0, 10);
      if (sc === 'swap') {
        const cs = miniCentres(1);
        const s = look.swap;
        lbl(out, scr(project, [cs[FAILED][0], cs[FAILED][1] - MINI.box / 2, cs[FAILED][2] + MINI.box / 2]), '<b>壊れた立方体</b><span>光の道から外す</span>', 'c', 't', s.phase === 'fail', 0, 10);
        lbl(out, scr(project, [cs[4][0], cs[4][1] + MINI.box / 2, cs[4][2]]), `<b>予備の立方体</b><span>${s.swapped ? '差し替えた' : '待機中'}</span>`, 'c', 'b', s.phase === 'join', 0, -10);
      } else {
        const o = look.ocs;
        const cs = miniCentres(o.move);
        const top = o.move < 0.5 ? cs[3] : [(cs[2][0] + cs[3][0]) / 2, cs[2][1], cs[2][2]];
        lbl(out, scr(project, [top[0], top[1] + MINI.box / 2 + 40, top[2] - MINI.box / 2]), `<b>${o.move < 0.5 ? '4×4×16（細長い）' : '8×8×4（平たい）'}</b><span>立方体 4 個・256 チップ</span>`, 'c', 'b', o.phase === 'done', 0, -10);
      }
    }
    if (ch === 5 && sc === 'vs' && ready) {
      const v = vsPose(t);
      note(out, scr(project, [NVR.c[0], NVR.c[1] + 640, 0]), 'NVL72: GPU 72 個とスイッチ（NVSwitch 18 個を 1 つに描く）', 'c', 'b');
      note(out, scr(project, [c[0], c[1] + 2 * CUBE.S + 40, c[2]]), 'Ironwood: 立方体 1 個（64 チップ）', 'c', 'b');
      lbl(out, scr(project, [NVR.c[0], NVR.c[1] - 640, 0]), `<b>スイッチ ${v.nvHops} 段</b><span>どの組でも 1 段・72 個まで</span>`, 'c', 't', v.nvU >= 1, 0, 8);
      lbl(out, scr(project, [c[0], c[1] - 2 * CUBE.S - 30, c[2] + 1.5 * CUBE.S]), `<b>隣へ ${v.iwHops} 回</b><span>${v.done ? 'いちばん遠い相手まで 6 回' : `いま: ${KJ[linkKind(v.iw[Math.min(5, v.iwHops)], v.iw[Math.min(6, v.iwHops + 1)])] ?? ''}`}</span>`, 'c', 't', v.done, 0, 8);
    }
    if (ch === 7 && sc === 'cool') lbl(out, scr(project, [CDU.at[0], CDU.h + 40, CDU.at[2]]), '<b>CDU ラック</b><span>冷却液を配る・台数は未確認</span>', 'c', 'b', false, 0, -6);
    if (ch === 6) {
      lbl(out, scr(project, [JUP.at[0], JUP.at[1] - JUP.h / 2, JUP.at[2] + JUP.d / 2]), '<b>DCN（チップあたり 100 Gb/s）</b><span>ホストの NIC から Jupiter へ</span>', 'c', 't', false, 0, 12);
    }
    return out;
  };
  return {root, update, overlay};
}
