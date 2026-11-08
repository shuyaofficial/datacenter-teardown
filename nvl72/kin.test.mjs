// node nvl72/kin.test.mjs — checks nvl72-shared/kin.js against the hand-worked numbers in nvl72/refs.md 「検算」.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  busAmps,
  CHAPTERS,
  chipFor,
  chipOf,
  coolAt,
  coreCount,
  fanAt,
  flowKgS,
  flowLpm,
  gaugesAt,
  gpuCount,
  gpuIndex,
  gpuOf,
  gpuSidePorts,
  hbmTotalGB,
  hbmTotalTBs,
  hopAt,
  inOutRatio,
  installedKW,
  LAYERS,
  layerAt,
  liftsAt,
  linkGBs,
  linkOneWayGBs,
  linkTo,
  lpddrTotalGB,
  nicGBs,
  powerAt,
  rackTBs,
  ringAt,
  ringMs,
  ringSentGB,
  ringSteps,
  route,
  SCENE_IDS,
  SCENES,
  sharpAt,
  sharpMs,
  sharpSentGB,
  snapT,
  SPEC,
  switchChips,
  switchSidePorts,
  switchTrayTbps,
  usableKW,
} from '../nvl72-shared/kin.js';
import {along, captionOf, chipWorld, computeY, coolPaths, dashes, DASH, fanPose, hopLegs, HOLD, linkPath, outBeads, PRE, RACK, ringBeads, sceneClock, sharpBeads, SLOTS, switchY, TL, TRAY} from '../nvl72-shared/flow.js';
import {beatsOf, DURATION, explodeEventsOf, explodeOf, holdOf, sceneTAt, SCRIPT, stateAtScript} from '../nvl72-shared/script.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`ok  ${name}`);
};

// ------------------------------------------------------------ refs.md 「検算」
test('ポートの数が合う: GPU 72 × 18 = 1,296、スイッチ 9 × 2 × 72 = 1,296', () => {
  assert.equal(gpuCount(), 72);
  assert.equal(switchChips(), 18);
  assert.equal(gpuSidePorts(), 1296);
  assert.equal(switchSidePorts(), 1296);
});

test('ラックの帯域: 72 × 1.8 TB/s = 129.6 TB/s（出典の 130 TB/s と合う）', () => {
  near(rackTBs(), 129.6, 1e-9, 'rack');
  near(rackTBs(), SPEC.nvlink.rackTBs, 0.5, 'source');
  near(linkGBs(), 100, 1e-9, 'link');
  near(linkOneWayGBs(), 50, 1e-9, 'one way');
});

test('スイッチトレイの帯域: 144 ポート × 50 GB/s × 8 bit = 57.6 Tb/s', () => {
  assert.equal(SPEC.nvlink.chipsPerTray * SPEC.nvlink.portsPerChip, 144);
  near(switchTrayTbps(), 57.6, 1e-9, 'tray');
});

test('1 段で届く: 全 72 × 71 組で通るスイッチチップは 1 個、ポートは 1 本ずつ使われる', () => {
  // the wiring table: link l of GPU g → chip l, port g; every chip port used exactly once
  const used = new Set();
  for (let g = 0; g < 72; g++)
    for (let l = 0; l < 18; l++) {
      const {chip, port} = linkTo(g, l);
      const key = `${chip}:${port}`;
      assert.ok(!used.has(key), `port ${key} used twice`);
      used.add(key);
      assert.ok(port < SPEC.nvlink.portsPerChip && chip < 18);
    }
  assert.equal(used.size, 1296);
  let pairs = 0;
  for (let a = 0; a < 72; a++)
    for (let b = 0; b < 72; b++) {
      if (a === b) continue;
      const r = route(a, b);
      assert.equal(r.hops, 1);
      assert.equal(r.chips.length, 1);
      const c = r.chips[0];
      // both ends really hang on that chip: GPU a's link c and GPU b's link c
      assert.equal(linkTo(a, c).chip, c);
      assert.equal(linkTo(b, c).chip, c);
      assert.equal(r.nodes[1].inPort, a);
      assert.equal(r.nodes[1].outPort, b);
      pairs++;
    }
  assert.equal(pairs, 72 * 71);
});

test('ラックの中と外の差: 1.8 TB/s ÷ (400 Gb/s × 2 ÷ 8 = 100 GB/s) = 18 倍', () => {
  near(nicGBs(), 100, 1e-9, 'nic');
  near(inOutRatio(), 18, 1e-9, 'ratio');
});

test('all-reduce: リング 2 × 71 / 72 × 1 GB = 1.972 GB・2.191 ms、SHARP 1 GB・1.111 ms', () => {
  near(ringSentGB(), 1.972, 0.0005, 'ring GB');
  near(ringMs(), 2.191, 0.0005, 'ring ms');
  near(sharpSentGB(), 1, 1e-12, 'sharp GB');
  near(sharpMs(), 1.111, 0.0005, 'sharp ms');
  assert.equal(ringSteps(), 142);
});

test('電源: 8 × 6 × 5.5 = 264 kW、N+N で 132 kW、消費 120 kW は収まる', () => {
  near(installedKW(), 264, 1e-9, 'installed');
  near(usableKW(), 132, 1e-9, 'usable');
  assert.ok(SPEC.power.rackKW <= usableKW());
});

test('母線の電流: 120 kW ÷ 50 V = 2,400 A', () => {
  near(busAmps(), 2400, 1e-9, 'amps');
});

test('液冷の流量: 120 ÷ (4.18 × 10) = 2.871 kg/s・約 172 L/分、温度差 5 K で 344 L/分', () => {
  near(flowKgS(10), 2.871, 0.0005, 'kg/s');
  assert.equal(Math.round(flowLpm(10)), 172);
  assert.equal(Math.round(flowLpm(5)), 344);
  near(flowLpm(5), 2 * flowLpm(10), 1e-9, 'double');
  near(coolAt(0, 2).dT, 5, 1e-12, 'slider clamps to 5 K');
  near(coolAt(0, 40).dT, 20, 1e-12, 'slider clamps to 20 K');
});

test('記憶容量: HBM 13,392 GB・576 TB/s、LPDDR5X 17,280 GB、コア 2,592', () => {
  assert.equal(hbmTotalGB(), 13392);
  near(hbmTotalGB() / 1000, SPEC.perf.hbmTB, 0.01, 'HBM TB');
  assert.equal(hbmTotalTBs(), 576);
  assert.equal(hbmTotalTBs(), SPEC.perf.hbmTBs);
  assert.equal(lpddrTotalGB(), 17280);
  near(lpddrTotalGB() / 1000, SPEC.perf.lpddrTB, 0.3, 'LPDDR TB');
  assert.equal(coreCount(), 2592);
  assert.equal(coreCount(), SPEC.perf.cores);
});

test('SPEC: refs.md の値（ラック・トレイ・NIC・電源）', () => {
  assert.deepEqual(SPEC.rack, {h: 2236, w: 600, d: 1068});
  assert.equal(SPEC.computeTrays, 18);
  assert.equal(SPEC.switchTrays, 9);
  assert.equal(SPEC.tor, 2);
  assert.equal(SPEC.powerShelves, 8);
  assert.equal(SPEC.cartridges, 4);
  assert.deepEqual(SPEC.tray, {superchips: 2, grace: 2, gpus: 4, cx7: 4, bf3: 2, e1s: 4});
  assert.equal(SPEC.gpu.hbmGB, 372 / 2);
  assert.equal(SPEC.gpu.hbmTBs, 16 / 2);
  assert.equal(SPEC.c2cGBs, 900);
  assert.equal(SPEC.e1sTB, 3.84);
  assert.equal(SPEC.m2TB, 1.92);
  assert.equal(SPEC.power.shelfInKW, 33);
  assert.equal(SPEC.power.busV, 50);
  assert.deepEqual(SPEC.perf, {fp4Sparse: 1440, fp4Dense: 720, fp8Sparse: 720, hbmTB: 13.4, hbmTBs: 576, lpddrTB: 17, cores: 2592});
});

// ------------------------------------------------------------ the rack's layout
test('並び: 上から TOR 2 → 電源棚 4 → 計算 10 → スイッチ 9 → 計算 8 → 電源棚 4、高さに収まる', () => {
  const kinds = SLOTS.filter((s) => s.kind !== 'blank').map((s) => s.kind);
  const runs = [];
  for (const k of kinds) if (!runs.length || runs[runs.length - 1][0] !== k) runs.push([k, 1]);
  else runs[runs.length - 1][1]++;
  assert.deepEqual(runs, [['tor', 2], ['power', 4], ['compute', 10], ['switch', 9], ['compute', 8], ['power', 4]]);
  assert.ok(Math.min(...SLOTS.map((s) => s.y0)) > 100, 'above the plinth');
  assert.ok(Math.max(...SLOTS.map((s) => s.y0)) + 44.45 < RACK.h - 40, 'under the top cap');
  // compute trays 1..18 top to bottom, the switch trays between 10 and 11
  for (let n = 1; n < 18; n++) assert.ok(computeY(n) > computeY(n + 1));
  assert.ok(computeY(10) > switchY(1) && switchY(9) > computeY(11));
});

test('トレイ: 幅 440 がラックの 600 に、奥行 900 が 1,068 に収まり、引き出すとラックの外に全部出る', () => {
  assert.ok(TRAY.w < RACK.w - 2 * RACK.post);
  assert.ok(TRAY.zc + TRAY.d / 2 <= RACK.zf && TRAY.zc - TRAY.d / 2 >= RACK.zb);
  assert.ok(TRAY.zc - TRAY.d / 2 + TRAY.pull >= RACK.zf, 'the pulled tray clears the rack');
  // the parts inside the tray stay inside its walls
  for (const x of [...TL.gpuX, ...TL.graceX, ...TL.cx7X, ...TL.bf3X, ...TL.e1sX]) assert.ok(Math.abs(x) + 12 < TRAY.w / 2);
});

test('経路: GPU からスイッチチップへの線はトレイの背面からカートリッジを通ってチップで終わる', () => {
  for (let c = 0; c < 18; c++) {
    const p = linkPath(gpuIndex(3, 1), c, 1);
    const end = p[p.length - 1];
    const w = chipWorld(c, 1);
    assert.deepEqual(end, w);
    assert.equal(p[3][2], p[4][2], 'runs along the cartridge');
    assert.equal(chipOf(c).tray, Math.floor(c / 2) + 1);
  }
  const h = hopAt(0);
  const legs = hopLegs(h.a, h.b, h.chip);
  assert.deepEqual(legs.tochip[legs.tochip.length - 1], legs.fromchip[0], 'the hop turns at the chip');
});

// ------------------------------------------------------------ scenes
test('hop: トレイ 3 の GPU 1 → トレイ 15 の GPU 3、チップに着くまで 0、通ったあと 1', () => {
  const a = hopAt(0);
  assert.deepEqual(gpuOf(a.a), {tray: 3, gpu: 1});
  assert.deepEqual(gpuOf(a.b), {tray: 15, gpu: 3});
  assert.equal(a.hops, 0);
  assert.equal(a.chip, chipFor(a.a, a.b));
  assert.equal(hopAt(2.5).hops, 0);
  assert.equal(hopAt(SCENES.hop.dur).hops, 1);
  assert.ok(hopAt(SCENES.hop.dur).done);
  // every leg of the bead follows on
  let prev = -1;
  for (let t = 0; t <= SCENES.hop.dur; t += 0.05) {
    const i = hopAt(t).legIndex;
    assert.ok(i >= prev);
    prev = i;
  }
});

test('fan: 18 本が順に伸びて、最後はすべてのチップへ', () => {
  assert.equal(fanAt(0).lit, 0);
  assert.equal(fanAt(SCENES.fan.dur).lit, 18);
  const f = fanPose(SCENES.fan.dur);
  assert.equal(new Set(f.paths.map((p) => p.c)).size, 18);
  for (let t = 0; t < SCENES.fan.dur; t += 0.1) assert.ok(fanAt(t + 0.1).lit >= fanAt(t).lit);
});

test('ring: 送った量が 1.972 GB、時間が 2.191 ms に向かって増え、そこで止まる', () => {
  assert.equal(ringAt(0).sentGB, 0);
  near(ringAt(SCENES.ring.dur).sentGB, 1.972, 0.0005, 'end');
  near(ringAt(SCENES.ring.dur + 5).ms, 2.191, 0.0005, 'held');
  for (let t = 0; t < SCENES.ring.dur; t += 0.2) assert.ok(ringAt(t + 0.2).sentGB > ringAt(t).sentGB);
  assert.equal(ringAt(SCENES.ring.dur * 0.25).phase, 'reduce');
  assert.equal(ringAt(SCENES.ring.dur * 0.75).phase, 'gather');
  assert.equal(ringBeads(1).length, 72);
});

test('sharp: 送った量は 1 GB で止まり、時間は 1.111 ms まで', () => {
  assert.equal(sharpAt(0).sentGB, 0);
  near(sharpAt(2.4).sentGB, 1, 1e-12, 'after up');
  near(sharpAt(4).sentGB, 1, 1e-12, 'stays at 1 GB while it comes back');
  near(sharpAt(10).ms, 1.111, 0.0005, 'ms');
  assert.equal(sharpAt(2.8).phase, 'sum');
  assert.equal(sharpBeads(1).beads.length, 72);
  assert.equal(sharpBeads(2.8).beads.length, 0, 'the switch is adding');
});

test('out: NVLink 側の粒は外へ出る粒の 18 倍', () => {
  const b = outBeads(10);
  assert.equal(b.ratio, 18);
  near(b.ins.length / b.outs.length, 18 * (1.0 / 2.6), 1.6, 'beads on the way, per travel time');
  assert.equal(gaugesAt('out', 3).outRatio, 18);
});

test('power: 母線の電流は 2,400 A に立ち上がる', () => {
  assert.equal(powerAt(0).amps, 0);
  near(powerAt(5).amps, 2400, 1e-9, 'amps');
  near(gaugesAt('power', 5).amps, 2400, 1e-9, 'gauge');
});

test('cool: 行きは上へ、帰りは下へ。トレイ 27 台に 1 組ずつ', () => {
  const p = coolPaths();
  assert.equal(p.supplyIn.length, 27);
  assert.equal(p.retOut.length, 27);
  assert.ok(p.supply[1][1] > p.supply[0][1], 'supply rises');
  assert.ok(p.ret[1][1] < p.ret[0][1], 'return falls');
  const path = [[0, 0, 0], [0, 1000, 0]];
  const a = dashes(path, 0);
  const b = dashes(path, 0.1);
  near(b[1].a[1] - a[1].a[1], DASH.speed * 0.1, 1e-6, 'dashes move');
  assert.deepEqual(dashes(path, 0, 0), dashes(path, 4, 0), 'speed 0 stands still');
});

test('純関数: 同じ入力は同じ出力', () => {
  for (const sc of SCENE_IDS) for (const t of [0, 1.3, 4.7]) assert.deepEqual(gaugesAt(sc, t), gaugesAt(sc, t));
  assert.deepEqual(hopAt(3.3), hopAt(3.3));
  assert.deepEqual(ringBeads(2.2), ringBeads(2.2));
});

test('reduced motion: snapT は段の頭に跳ぶ', () => {
  assert.ok(snapT('hop', 1.0) <= 1.0);
  assert.equal(hopAt(snapT('hop', 1.0)).legIndex, hopAt(1.0).legIndex);
  assert.equal(snapT('ring', 1.1), snapT('ring', 1.9));
  assert.equal(snapT('sharp', 3.0), 2.4);
});

test('along: 折れ線の長さで進む', () => {
  assert.deepEqual(along([[0, 0, 0], [10, 0, 0], [10, 10, 0]], 0.75), [10, 5, 0]);
});

// ------------------------------------------------------------ the pulled tray
test('引き出し: まず引き出し、上の層（天板 → コールドプレート → チップ → カード）から浮く。戻すときは下から', () => {
  assert.deepEqual(LAYERS, ['pull', 'lid', 'plates', 'chips', 'io']);
  const ev = [{t: 0, to: explodeOf(2)}];
  const L = (t) => liftsAt(ev, t).lifts;
  assert.ok(L(0.6)[0] > 0.2 && L(0.6)[1] === 0, 'the pull moves first');
  // each layer starts after the one above it
  for (let k = 1; k < 4; k++) {
    const start = (kk) => {
      for (let t = 0; t < 5; t += 0.01) if (layerAt(ev, kk, t) > 0.01) return t;
      return 99;
    };
    assert.ok(start(k) < start(k + 1), `layer ${k} before ${k + 1}`);
  }
  assert.deepEqual(L(5).map((v) => +v.toFixed(6)), [1, 1, 1, 1, 1]);
  const back = [...ev, {t: 5, to: explodeOf(1)}];
  const B = (t) => liftsAt(back, t).lifts;
  assert.ok(B(5.3)[4] < B(5.3)[1], 'closing: the bottom layer first');
  assert.ok(B(5.3)[0] === 1, 'the tray goes in last');
  assert.deepEqual(B(9).map((v) => +v.toFixed(6)), [0, 0, 0, 0, 0]);
});

// ------------------------------------------------------------ chapters and the tour
test('章: 7 章、ラボのコマンドは refs.md の表と同じ（1 章は表に無い）', () => {
  assert.equal(CHAPTERS.length, 7);
  const refs = fs.readFileSync(new URL('./refs.md', import.meta.url), 'utf8');
  for (const c of CHAPTERS) for (const l of c.lab) assert.ok(refs.includes(l.cmd.replace(/\|/g, '\\|')), `${c.n}: ${l.cmd}`);
  assert.equal(CHAPTERS[0].lab.length, 0);
  assert.deepEqual(CHAPTERS[2].scenes, ['fan', 'hop']);
  assert.deepEqual(CHAPTERS[3].scenes, ['ring', 'sharp']);
});

test('ツアー: 70〜90 s、章 1→7→1、timeline.json は台本と一致', () => {
  assert.ok(DURATION >= 70 && DURATION <= 90);
  const ch = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.chapter);
  assert.deepEqual(ch, [1, 2, 3, 4, 5, 6, 7, 1]);
  const tl = JSON.parse(fs.readFileSync(new URL('../nvl72-film/timeline.json', import.meta.url), 'utf8'));
  assert.equal(tl.duration, DURATION);
  assert.deepEqual(tl.beats, beatsOf());
  // the brief's lengths: 10, 12, 14, 16, 10, 8, 10 s
  const at = Object.fromEntries(SCRIPT.filter((e) => e.chapter !== undefined && e.t < DURATION - 5).map((e) => [e.chapter, e.t]));
  assert.deepEqual([at[2] - at[1], at[3] - at[2], at[4] - at[3], at[5] - at[4], at[6] - at[5], at[7] - at[6]], [10, 12, 14, 16, 10, 8]);
  assert.equal(80 - at[7], 10);
});

test('ツアー: fan は描き切ってから hop、hop は着いてから章 4、ring は 1.972 GB に届いてから sharp', () => {
  const hopPress = SCRIPT.find((e) => e.scene === 'hop').t;
  assert.equal(fanAt(sceneTAt(hopPress - 0.01)).lit, 18);
  const ch4 = SCRIPT.find((e) => e.chapter === 4).t;
  assert.ok(hopAt(sceneTAt(ch4 - 0.01)).done);
  const sharpPress = SCRIPT.find((e) => e.scene === 'sharp').t;
  near(ringAt(sceneTAt(sharpPress - 0.01)).sentGB, 1.972, 0.0005, 'ring done');
  near(sharpAt(sceneTAt(SCRIPT.find((e) => e.chapter === 5).t - 0.01)).sentGB, 1, 1e-9, 'sharp done');
  assert.equal(stateAtScript(76).dT, 5);
  assert.deepEqual(explodeEventsOf().map((e) => e.t), [10, 22, 52, 62]);
});

test('ツアー: トレイが戻る章の切り替えは、戻り切るまでカメラが待つ（holdOf）', () => {
  assert.equal(holdOf(1, 2), 0, 'pulling out does not wait');
  assert.equal(holdOf(3, 4), 0, 'no tray, no wait');
  // 2 → 3 and 5 → 6: every layer is back within the hold
  for (const [a, b] of [[2, 3], [5, 6], [2, 5]]) {
    const hold = holdOf(a, b);
    assert.ok(hold > 0, `${a}→${b}`);
    const ev = [{t: 0, to: explodeOf(a)}, {t: 100, to: explodeOf(b)}];
    const at = (t) => liftsAt(ev, t, [0, 0, 0, 0, 0]).lifts;
    const lo = at(99.9);
    const hi = at(100 + hold);
    explodeOf(a).forEach((v, k) => {
      if (explodeOf(b)[k] < v) near(hi[k], explodeOf(b)[k], 1e-9, `layer ${k} back at ${a}→${b}`);
      assert.ok(lo[k] >= hi[k] - 1e-9 || explodeOf(b)[k] >= v);
    });
  }
  // the tour's camera starts after the hold, the next press is later than that
  const ts = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.t);
  assert.ok(ts[3] - ts[2] > holdOf(2, 3) + 1.8 && ts[6] - ts[5] > holdOf(5, 6) + 1.8);
});

test('scene clock: 章を押すと PRE だけ待ち、終わると HOLD だけ止まってから繰り返す', () => {
  assert.equal(sceneClock('hop', 1.0, PRE), 0);
  near(sceneClock('ring', PRE + 3, PRE), 3, 1e-9, 'runs');
  near(sceneClock('ring', SCENES.ring.dur + HOLD + 0.5), 0.5, 1e-9, 'loops');
  near(sceneClock('cool', 100), 100, 1e-9, 'endless');
});

test('字幕: 場面ごとに 1 行、核心の言い方を含む', () => {
  assert.match(captionOf('fan', 5), /18 本/);
  assert.match(captionOf('hop', 3.4), /スイッチは 1 個/);
  assert.match(captionOf('ring', 8), /1\.972 GB/);
  assert.match(captionOf('sharp', 4), /1 GB だけ/);
  assert.match(captionOf('out', 1), /18 倍/);
  assert.match(captionOf('power', 1), /50 V/);
  assert.match(captionOf('cool', 1, {dT: 10}), /10 K/);
});

console.log(`\n${count} tests passed`);
