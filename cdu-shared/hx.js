// Chapter 3's diagram: the heat exchanger cut open, on a plate that floats in front of the CDU (world mm, flow.js HXD).
// Left: the plate pack as 8 channels between 9 stainless plates; even channels carry the coolant (it goes down, hot →
// cold), odd ones the facility water (up, cold → warm). Right: the temperature of both along the plate, sharing the
// height with the channels, so the gap between the two lines is the local difference: 6.7 K at the hot end (top),
// 2.8 K at the cold end (bottom, the ATD). The lines never cross. update(look) poses it; tags(look, project) returns the
// HTML tags in screen pixels. Nothing here keeps time.
import * as THREE from 'three';
import {C} from '../kit/ui.js';
import {BOX} from './cdu.js';
import {COLORS, hxBeads, hxChannel, HXD, hxTX, hxY, shadeOf} from './flow.js';
import {ease, hxProfile, SPEC} from './kin.js';

const V3 = THREE.Vector3;
const BALL = new THREE.IcosahedronGeometry(1, 1);

export function buildHx() {
  const root = new THREE.Group();
  root.position.set(...HXD.c);
  root.visible = false;
  const mats = [];
  const basic = (color, o = 1) => {
    const m = new THREE.MeshBasicMaterial({color, toneMapped: false, transparent: true, opacity: o});
    m.userData.o = o;
    mats.push(m);
    return m;
  };
  const std = (color, extra = {}) => {
    const m = new THREE.MeshStandardMaterial({color, roughness: 0.8, metalness: 0, envMapIntensity: 0.5, transparent: true, ...extra});
    m.userData.o = 1;
    mats.push(m);
    return m;
  };
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const S = new V3();
  const P = new V3();
  const col = new THREE.Color();
  const box = (mat, x, y, z, w, h, d) => {
    const m = new THREE.Mesh(BOX, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };
  // the plate it all sits on
  const base = box(std('#f4f6f7'), 0, 0, -12, HXD.w, HXD.h, 14);
  base.castShadow = true;
  // channels: cells coloured by temperature (lighter than the beads)
  const cells = new THREE.InstancedMesh(BOX, basic('#ffffff'), HXD.n * 16);
  const white = new THREE.Color('#ffffff');
  const cS = {tcs: [new THREE.Color(COLORS.tcsS), new THREE.Color(COLORS.tcsR)], fws: [new THREE.Color(COLORS.fwsS), new THREE.Color(COLORS.fwsR)]};
  const shade = (kind, T, light = 0) => col.copy(cS[kind][0]).lerp(cS[kind][1], shadeOf(kind, T)).lerp(white, light);
  let k = 0;
  const H = HXD.y1 - HXD.y0;
  for (let c = 0; c < HXD.n; c++) {
    const ch = hxChannel(c);
    for (let j = 0; j < 16; j++) {
      const x = (j + 0.5) / 16;
      const p = hxProfile(x);
      m4.compose(P.set(ch.x, hxY(x), 0), q, S.set(HXD.chanW, H / 16 + 0.5, 4));
      cells.setMatrixAt(k, m4);
      cells.setColorAt(k, shade(ch.kind, ch.kind === 'tcs' ? p.tcs : p.fws, 0.62));
      k++;
    }
  }
  root.add(cells);
  // the stainless plates between the channels, and the frame plates at both ends
  const plateMat = std('#8f989e', {metalness: 0.5, roughness: 0.45});
  for (let c = 0; c <= HXD.n; c++) {
    const x = HXD.x0 + HXD.plateW / 2 + c * (HXD.chanW + HXD.plateW);
    box(c === 0 || c === HXD.n ? std('#5f6f7c') : plateMat, x, 0, 4, c === 0 || c === HXD.n ? 18 : HXD.plateW, H + 40, 14);
  }
  // the chart: axes, the two lines, the brackets at the ends
  const ink = basic(C.ink, 0.85);
  box(ink, HXD.chartX0 - 20, 0, 2, 3, H + 20, 2);
  box(ink, HXD.chartX0 + HXD.chartW / 2 - 10, HXD.y0 - 50, 2, HXD.chartW + 20, 3, 2);
  const lineT = new THREE.InstancedMesh(BOX, basic(COLORS.tcsR), 64);
  const lineF = new THREE.InstancedMesh(BOX, basic(COLORS.fwsR), 64);
  const brk = new THREE.InstancedMesh(BOX, basic(C.accent), 6);
  for (const im of [lineT, lineF, brk]) {
    im.count = 0;
    im.frustumCulled = false;
    root.add(im);
  }
  const segTo = (im, a, b, w) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return;
    m4.compose(P.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 6), q.setFromAxisAngle(new V3(0, 0, 1), Math.atan2(dy, dx)), S.set(len + w, w, 3));
    im.setMatrixAt(im.count++, m4);
  };
  const beads = new THREE.InstancedMesh(BALL, basic('#ffffff'), HXD.n * 5);
  beads.frustumCulled = false;
  beads.setColorAt(0, col);
  root.add(beads);

  /** look: {hxK 0..1 (shown), hxT (scene seconds), reduced} */
  const update = (look = {}) => {
    const v = look.hxK ?? 0;
    root.visible = v > 0.01;
    if (!root.visible) return;
    for (const m of mats) m.opacity = m.userData.o * v;
    root.scale.setScalar(0.94 + 0.06 * v);
    const t = look.hxT ?? 0;
    // the chart draws itself top to bottom in the first 2 s
    const ck = ease(t / 2);
    lineT.count = 0;
    lineF.count = 0;
    brk.count = 0;
    const N = 40;
    const upto = Math.round(N * ck);
    for (let j = 0; j < upto; j++) {
      const a = hxProfile(j / N);
      const b = hxProfile((j + 1) / N);
      segTo(lineT, [hxTX(a.tcs), hxY(j / N)], [hxTX(b.tcs), hxY((j + 1) / N)], 7);
      segTo(lineF, [hxTX(a.fws), hxY(j / N)], [hxTX(b.fws), hxY((j + 1) / N)], 7);
    }
    if (ck > 0.05) segTo(brk, [hxTX(SPEC.design.fws.ret), HXD.y1 + 34], [hxTX(SPEC.design.tcs.ret), HXD.y1 + 34], 5);
    if (ck > 0.98) segTo(brk, [hxTX(SPEC.design.fws.supply), HXD.y0 - 26], [hxTX(SPEC.design.tcs.supply), HXD.y0 - 26], 5);
    for (const im of [lineT, lineF, brk]) im.instanceMatrix.needsUpdate = true;
    beads.count = 0;
    for (const b of hxBeads(t)) {
      m4.compose(P.set(b.x, b.y, 10), q.identity(), S.setScalar(15));
      beads.setMatrixAt(beads.count, m4);
      beads.setColorAt(beads.count, shade(b.kind, b.T));
      beads.count++;
    }
    beads.instanceMatrix.needsUpdate = true;
    beads.instanceColor.needsUpdate = true;
  };

  const W = new V3();
  const at = (project, x, y) => {
    W.set(x, y, 12);
    root.localToWorld(W);
    return project(W.x, W.y, W.z);
  };
  /** tags: [{x, y, h, v, html, o, kind, on}] */
  const tags = (look, project) => {
    const v = look.hxK ?? 0;
    if (v < 0.6) return [];
    root.updateWorldMatrix(true, true);
    const ck = ease((look.hxT ?? 0) / 2);
    const out = [];
    const D = SPEC.design;
    const push = (p, o) => p && out.push({...o, x: p[0] + (o.dx ?? 0), y: p[1] + (o.dy ?? 0), o: o.o ?? 1});
    const cx = HXD.x0 + (HXD.n * (HXD.chanW + HXD.plateW)) / 2;
    push(at(project, cx, HXD.y1 + 30), {kind: 'lbl', h: 'c', v: 'b', html: '<b>板の断面（8 本の通り道）</b><span>冷却液は下へ・施設の水は上へ</span>'});
    push(at(project, cx, HXD.y0 - 30), {kind: 'note', h: 'c', v: 't', html: '板 1 枚で隔てる。液は行き来しない'});
    push(at(project, HXD.chartX0 + HXD.chartW / 2, HXD.y0 - 70), {kind: 'note', h: 'c', v: 't', html: '温度（℃）→'});
    if (ck > 0.05) {
      push(at(project, (hxTX(D.fws.ret) + hxTX(D.tcs.ret)) / 2, HXD.y1 + 40), {kind: 'lbl', h: 'c', v: 'b', on: true, html: `<b>熱い端 ${(D.tcs.ret - D.fws.ret).toFixed(1)} K</b>`});
      push(at(project, hxTX(D.tcs.ret), HXD.y1 - 10), {kind: 'note', h: 'l', v: 't', dx: 12, html: `冷却液 ${D.tcs.ret.toFixed(1)} ℃`});
      push(at(project, hxTX(D.fws.ret), HXD.y1 - 10), {kind: 'note', h: 'r', v: 't', dx: -12, html: `施設の水 ${D.fws.ret.toFixed(1)} ℃`});
    }
    if (ck > 0.98) {
      push(at(project, (hxTX(D.fws.supply) + hxTX(D.tcs.supply)) / 2, HXD.y0 - 20), {kind: 'lbl', h: 'l', v: 't', dx: 60, on: true, html: `<b>冷たい端 ${(D.tcs.supply - D.fws.supply).toFixed(1)} K（ATD）</b>`});
      push(at(project, hxTX(D.tcs.supply), HXD.y0 + 20), {kind: 'note', h: 'l', v: 'b', dx: 12, html: `冷却液 ${D.tcs.supply.toFixed(1)} ℃`});
      push(at(project, hxTX(D.fws.supply), HXD.y0 + 20), {kind: 'note', h: 'r', v: 'b', dx: -8, html: `${D.fws.supply.toFixed(1)} ℃`});
    }
    return out;
  };
  return {root, update, tags};
}
