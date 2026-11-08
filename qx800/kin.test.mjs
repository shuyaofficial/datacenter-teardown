// node qx800/kin.test.mjs — checks qx800-shared/kin.js against the hand-worked numbers in qx800/refs.md 「検算」, and the
// scenes, the layout and the tour's script against the brief.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  airAt,
  bothWaysTbps,
  cageTbps,
  catSerialNs,
  CHAPTERS,
  chipCount,
  CREDIT,
  creditAt,
  creditMaxB,
  creditsOf,
  diffPerCage,
  dropAt,
  fabricRoute,
  fattreeAt,
  gaugesAt,
  gpuLid,
  inFlightB,
  laneCount,
  lanesPerChip,
  laneTbps,
  leafDown,
  leafOf,
  leafUp,
  lftPort,
  liftsAt,
  lookupAt,
  nicOneWayGBs,
  perPair,
  perSpine,
  PFC,
  pfcAt,
  pfcHeadroomPk,
  pktCredits,
  powerVsCat,
  railGpus,
  ringAt,
  ringMs,
  ringSentGB,
  ringSteps,
  rttNs,
  SCENE_IDS,
  SCENES,
  serialNs,
  serialRatio,
  sharpAt,
  sharpMs,
  sharpSentGB,
  snapT,
  SPEC,
  suLeaves,
  suSpines,
  SWEEP_ORDER,
  sweepAt,
  sweepEnd,
  switchingTbps,
  twoTierMax,
  twoTierSU,
  upDownRatio,
  vsCatalyst,
  wattsPerPort,
} from '../qx800-shared/kin.js';
import {SPEC as CAT} from '../switch-shared/kin.js';
import {SPEC as NVL} from '../nvl72-shared/kin.js';
import {BOX, bundlePaths, downLinks, HOLD, PRE, sceneClock, upLinks, windPaths} from '../qx800-shared/flow.js';
import {beatsOf, DURATION, explodeEventsOf, holdOf, SCRIPT, sceneTAt, stateAtScript} from '../qx800-shared/script.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`ok  ${name}`);
};

// ------------------------------------------------------------ refs.md 「検算」
test('交換容量: 144 × 800 Gb/s = 115.2 Tb/s（片方向）、両方向 230.4 Tb/s', () => {
  near(switchingTbps(), 115.2, 1e-9, 'one way');
  near(bothWaysTbps(), 230.4, 1e-9, 'both');
});

test('レーン: 72 ケージ × 8 = 576、× 200 G = 115.2 Tb/s。1 ケージ 1.6 Tb/s', () => {
  assert.equal(laneCount(), 576);
  near(laneTbps(), 115.2, 1e-9, 'lanes');
  near(cageTbps(), 1.6, 1e-9, 'cage');
  assert.equal(SPEC.cages * SPEC.portsPerCage, SPEC.ports);
});

test('チップ: 115.2 ÷ 28.8 = 4 個、1 個 144 レーン × 200 G = 28.8 Tb/s', () => {
  assert.equal(chipCount(), 4);
  assert.equal(lanesPerChip(), 144);
  near((lanesPerChip() * SPEC.laneGbps) / 1000, SPEC.chipTbps, 1e-9, 'chip');
});

test('Catalyst 9300 との差: 230.4 Tb/s ÷ 256 Gb/s = 900 倍（Catalyst の値は switch-shared/kin.js から読む）', () => {
  assert.equal(SPEC.cat.switchingGbps, 256);
  near(vsCatalyst(), 900, 1e-9, 'x');
  assert.equal(SPEC.cat.macTable, 32000);
  near(SPEC.cat.fillMs, 1.2288, 1e-9, 'WTD');
  assert.deepEqual([SPEC.cat.h, SPEC.cat.w, SPEC.cat.d, SPEC.cat.kg], [CAT.chassis.h, CAT.chassis.w, CAT.chassis.d, CAT.chassis.kg]);
  assert.deepEqual([SPEC.cat.w, SPEC.cat.d, SPEC.cat.kg, SPEC.cat.psuW], [445, 409, 7.59, 715]);
});

test('リーフ 1 台: 下り 72 ＋ 上り 72 = 144、1:1、GPU 72 個', () => {
  assert.equal(leafDown(), 72);
  assert.equal(leafUp(), 72);
  assert.equal(leafDown() + leafUp(), SPEC.ports);
  assert.equal(upDownRatio(), 1);
});

test('1 SU: 576 ÷ 72 = リーフ 8 台、4 レール × 2、1 レール 8 × 18 = 144 = 2 × 72（NVL72 の値は nvl72-shared/kin.js から読む）', () => {
  assert.equal(suLeaves(), 8);
  assert.equal(SPEC.su.rails * SPEC.su.leavesPerRail, 8);
  assert.equal(SPEC.nvl.trays, NVL.computeTrays);
  assert.equal(SPEC.nvl.gpusPerTray, NVL.tray.gpus);
  assert.equal(SPEC.su.racks * SPEC.nvl.trays * SPEC.nvl.gpusPerTray, SPEC.su.gpus);
  assert.equal(railGpus(), 144);
  assert.equal(railGpus(), 2 * leafDown());
});

test('表3: スパイン 1 台に 144・128・128・128 本、1 組 9・4・2・1 本。1 SU は 4 台（計算）', () => {
  assert.deepEqual(SPEC.table3.map((r) => perSpine(r)), [144, 128, 128, 128]);
  assert.deepEqual(SPEC.table3.map((r) => perPair(r)), [9, 4, 2, 1]);
  for (const r of SPEC.table3) assert.ok(perSpine(r) <= SPEC.ports);
  assert.deepEqual(SPEC.table3.map((r) => [r.su, r.leaves, r.spines]), [[2, 16, 8], [4, 32, 18], [8, 64, 36], [16, 128, 72]]);
  assert.equal(suSpines(), 4);
});

test('2 層の上限: 144 × 72 = 10,368 GPU = 18 SU（出典1 と一致）、RA は 16 SU', () => {
  assert.equal(twoTierMax(), 10368);
  assert.equal(twoTierMax(), SPEC.su.nicMax);
  assert.equal(twoTierSU(), 18);
  assert.equal(SPEC.su.twoTierSU * SPEC.su.gpus, 9216);
});

test('線に乗る時間: 4,096 B を 800 Gb/s で 40.96 ns、Catalyst の 1,518 B（1 Gbps）12.304 µs の約 300 分の 1', () => {
  near(serialNs(), 40.96, 1e-9, 'ns');
  near(catSerialNs(), 12304, 1e-6, 'cat');
  assert.equal(Math.round(serialRatio()), 300);
});

test('クレジット: 4,096 B = 64、上限 2,048 クレジット = 131,072 B（128 KB）', () => {
  assert.equal(creditsOf(4096), 64);
  assert.equal(pktCredits(), 64);
  assert.equal(creditMaxB(), 131072);
  assert.equal(creditMaxB() / 1024, 128);
});

test('往復のあいだに線の上にいる量: 銅 2 m で 20 ns・2,000 B（約 32 クレジット）、光 100 m で 1 µs・100,000 B', () => {
  assert.equal(rttNs(2), 20);
  near(inFlightB(2), 2000, 1e-9, 'copper');
  assert.equal(Math.ceil(inFlightB(2) / SPEC.credit.blockB), 32);
  assert.equal(rttNs(100), 1000);
  near(inFlightB(100), 100000, 1e-6, 'optic');
});

test('ポートあたりの電力: 2,900 ÷ 144 = 20.1 W、7,000 ÷ 144 = 48.6 W、差 4,100 ÷ 72 = 56.9 W', () => {
  near(wattsPerPort(SPEC.power.typW), 20.1, 0.05, 'typ');
  near(wattsPerPort(SPEC.power.maxW), 48.6, 0.05, 'max');
  near(diffPerCage(), 56.9, 0.05, 'diff');
});

test('all-reduce: リング 2 × 575 / 576 × 1 GB = 1.9965 GB・19.97 ms、SHARP 1 GB・10 ms', () => {
  near(nicOneWayGBs(), 100, 1e-9, 'nic');
  near(ringSentGB(), 1.9965, 0.00005, 'ring GB');
  near(ringMs(), 19.97, 0.005, 'ring ms');
  near(sharpSentGB(), 1, 1e-12, 'sharp GB');
  near(sharpMs(), 10, 1e-9, 'sharp ms');
  assert.equal(ringSteps(), 1150);
});

test('Catalyst 9300 との大きさ: 1U・7.59 kg・715 W に対して 4U・60 kg・最大 7,000 W（電力 9.8 倍）', () => {
  assert.equal(SPEC.chassis.units, 4);
  assert.equal(SPEC.chassis.kg, 60);
  near(powerVsCat(), 9.8, 0.05, 'power');
});

test('SPEC: refs.md の値（筐体・ポート・電源・SM・SHARP）', () => {
  assert.deepEqual(SPEC.chassis, {h: 177.8, w: 438, d: 850, kg: 60, units: 4});
  assert.equal(SPEC.ports, 144);
  assert.equal(SPEC.cages, 72);
  assert.equal(SPEC.psus, 8);
  assert.equal(SPEC.fans, 10);
  assert.equal(SPEC.mtu, 4096);
  assert.deepEqual(SPEC.power, {typW: 2900, maxW: 7000, psuV: '200–240', psuA: 10});
  assert.equal(SPEC.sm.sweepS, 10);
  assert.equal(SPEC.sm.lmc, 0);
  assert.equal(SPEC.sm.routing, 'ar_updn');
  assert.equal(SPEC.credit.blockB, 64);
  assert.deepEqual(SPEC.sharp, {gen: 4, tflops: 14.4, vsPrev: 9});
  assert.equal(SPEC.cpu.name, 'Intel i3-8100H');
  assert.equal(SPEC.dBA, 78.4);
  assert.deepEqual(SPEC.tempC, [0, 35]);
});

// ------------------------------------------------------------ the scenes
test('credit: どの時刻でも drops === 0、受け口は 4 パケットを超えない、送り手は 64 クレジット無しには送らない', () => {
  for (let t = 0; t <= 40; t += 0.05) {
    const c = creditAt(t);
    assert.equal(c.drops, 0);
    assert.equal(gaugesAt('credit', t).drops, 0);
    assert.ok(c.inBuf <= CREDIT.bufPk, `buffer ${c.inBuf} at ${t}`);
    assert.ok(c.credits >= 0, `credits ${c.credits} at ${t}`);
    assert.ok(c.credits <= CREDIT.bufPk * pktCredits());
  }
  // the receiver tells first: no credits and nothing sent before the first notice arrives
  assert.equal(creditAt(CREDIT.wire - 0.01).credits, 0);
  assert.equal(creditAt(CREDIT.wire - 0.01).sent, 0);
  assert.ok(creditAt(CREDIT.wire + 0.01).sent >= 1);
  // congested: the sender ends up waiting, and the wait grows
  assert.ok(creditAt(8).waiting);
  assert.ok(creditAt(8).waitNs > creditAt(4).waitNs);
});

test('drop: Catalyst は満杯（1.2288 ms）から捨て始め、drops > 0 になる', () => {
  assert.equal(dropAt(0.5).drops, 0);
  const tFull = SPEC.cat.fillMs / SPEC.cat.congestMsPerSec;
  assert.ok(!dropAt(tFull - 0.01).full);
  assert.ok(dropAt(tFull + 0.01).full);
  assert.ok(dropAt(3).drops > 0);
  assert.ok(gaugesAt('drop', 3).drops > 0);
  assert.ok(dropAt(6).drops > dropAt(3).drops);
});

test('pfc: 「止まれ」が出て、余裕（線の上の分）に入り、捨てない', () => {
  assert.equal(pfcHeadroomPk(), Math.ceil((2 * PFC.wire) / PFC.sendDur) + 1);
  let paused = false;
  let over = 0;
  for (let t = 0; t <= 30; t += 0.05) {
    const p = pfcAt(t);
    paused ||= p.paused;
    over = Math.max(over, p.over);
    assert.equal(p.drops, 0, `pfc drop at ${t}`);
    assert.ok(p.inBuf <= p.bufPk);
  }
  assert.ok(paused, 'the pause arrives');
  assert.ok(over > 0, 'the headroom is used');
});

test('sweep: 12 台を 1 台ずつ訪ね、表を書き終えた数が 0 → 12 と増える（場面の長さの中で）', () => {
  assert.equal(sweepAt(0).swept, 0);
  let prev = 0;
  for (let t = 0; t <= SCENES.sweep.dur; t += 0.05) {
    const s = sweepAt(t).swept;
    assert.ok(s >= prev);
    prev = s;
  }
  assert.equal(sweepAt(SCENES.sweep.dur).swept, SWEEP_ORDER.length);
  assert.ok(sweepEnd() <= SCENES.sweep.dur);
  assert.equal(new Set(SWEEP_ORDER).size, 12);
});

test('lookup: レール 1 のラック 2 → ラック 7 はリーフ A → スパイン → リーフ B の 3 段、LFT の出口が実際の行き先と合う', () => {
  const l = lookupAt(0);
  assert.equal(l.route.hops, 3);
  const [la, sp, lb] = l.route.switches;
  assert.equal(la, 'L0');
  assert.equal(lb, 'L4');
  const up = lftPort(0, 6, 9, 1);
  assert.ok(up.up && up.port > 72 && up.port <= 144);
  assert.equal(sp, `S${up.spine}`);
  const down = lftPort(4, 6, 9, 1);
  assert.ok(!down.up && down.port >= 1 && down.port <= 72);
  assert.ok(lookupAt(10).done);
  // same leaf: 1 hop
  assert.equal(fabricRoute({rack: 0, tray: 1, gpu: 2}, {rack: 3, tray: 7, gpu: 2}).hops, 1);
});

test('LFT: 各リーフで、自分の 72 個は下りの 1..72 に 1 つずつ、他は上りの 73..144', () => {
  for (let leaf = 0; leaf < 8; leaf++) {
    const down = new Set();
    let up = 0;
    for (let rack = 0; rack < 8; rack++) for (let tray = 1; tray <= 18; tray++) for (let gpu = 1; gpu <= 4; gpu++) {
      const r = lftPort(leaf, rack, tray, gpu);
      if (r.up) {
        assert.ok(r.port > 72 && r.port <= 144);
        up++;
      } else {
        assert.equal(leafOf(rack, gpu), leaf);
        assert.ok(r.port >= 1 && r.port <= 72);
        down.add(r.port);
      }
    }
    assert.equal(down.size, 72);
    assert.equal(up, 576 - 72);
  }
  // LIDs are all different
  const lids = new Set();
  for (let rack = 0; rack < 8; rack++) for (let tray = 1; tray <= 18; tray++) for (let gpu = 1; gpu <= 4; gpu++) lids.add(gpuLid(rack, tray, gpu));
  assert.equal(lids.size, 576);
  assert.ok(Math.min(...lids) > SWEEP_ORDER.length);
});

test('fattree の線: ラック → リーフは 8 × 4 本（各 18）、リーフ → スパインは 8 × 4 本（各 18）。リーフ 1 台の下り 72 = 上り 72', () => {
  const d = downLinks();
  const u = upLinks();
  assert.equal(d.length, 32);
  assert.equal(u.length, 32);
  for (let l = 0; l < 8; l++) {
    assert.equal(d.filter((x) => x.leaf === l).reduce((a, x) => a + x.links, 0), 72);
    assert.equal(u.filter((x) => x.leaf === l).reduce((a, x) => a + x.links, 0), 72);
  }
  assert.equal(fattreeAt(0).upRatio, 0);
  assert.equal(fattreeAt(3).upRatio, 1);
});

test('ring / sharp: 送った量は 1.9965 GB と 1 GB で止まる', () => {
  near(ringAt(SCENES.ring.dur).sentGB, ringSentGB(), 1e-9, 'ring end');
  near(sharpAt(10).sentGB, 1, 1e-12, 'sharp end');
  near(sharpAt(10).ms, 10, 1e-9, 'sharp ms');
  assert.ok(ringAt(1).sentGB < ringAt(2).sentGB);
});

test('air: 典型 2,900 W から最大 7,000 W へ', () => {
  assert.equal(airAt(0).watts, 2900);
  assert.equal(airAt(10).watts, 7000);
  assert.ok(airAt(4).watts > 2900 && airAt(4).watts < 7000);
});

test('snapT (reduced motion): 段ごとに跳ぶ値を返し、場面の範囲を出ない', () => {
  for (const sc of SCENE_IDS) for (let t = 0; t < 12; t += 0.37) {
    const s = snapT(sc, t);
    assert.ok(Number.isFinite(s) && s >= 0, `${sc} ${t}`);
  }
});

// ------------------------------------------------------------ the layout
test('前面: 18 列 × 4 段 = 72 ケージが幅 438 mm に収まり、重ならない。管理の列は区画から離れている', () => {
  assert.equal(BOX.cageX.length * BOX.rowY.length, SPEC.cages);
  for (let i = 1; i < BOX.cageX.length; i++) assert.ok(BOX.cageX[i] - BOX.cageX[i - 1] >= BOX.cage.w);
  assert.ok(BOX.cageX[0] - BOX.cage.w / 2 > BOX.mgX + BOX.cage.w / 2 + 3, 'set apart');
  assert.ok(BOX.cageX[BOX.cageX.length - 1] + BOX.cage.w / 2 < BOX.w2);
  for (let r = 1; r < BOX.rowY.length; r++) assert.ok(BOX.rowY[r] - BOX.rowY[r - 1] >= BOX.cage.h);
  assert.ok(BOX.rowY[3] + BOX.cage.h / 2 < BOX.h - 3 && BOX.rowY[0] - BOX.cage.h / 2 > 3);
});

test('背面: 電源 8 と ファン 10 が幅と高さに収まり、重ならない', () => {
  assert.equal(BOX.psuX.length * BOX.psuY.length, SPEC.psus);
  assert.equal(BOX.fanX.length * BOX.fanY.length, SPEC.fans);
  assert.ok(BOX.psuX[1] + BOX.psuW / 2 <= BOX.w2 && BOX.psuX[0] - BOX.psuW / 2 >= -BOX.w2);
  assert.ok(BOX.fanX[0] - BOX.fanS / 2 > BOX.psuX[0] + BOX.psuW / 2, 'fans clear the left PSUs');
  assert.ok(BOX.fanX[4] + BOX.fanS / 2 < BOX.psuX[1] - BOX.psuW / 2, 'fans clear the right PSUs');
  assert.ok(BOX.psuY[3] + BOX.psuH / 2 < BOX.h && BOX.psuY[0] - BOX.psuH / 2 > 0);
  assert.ok(BOX.fanY[1] + BOX.fanS / 2 < BOX.h && BOX.fanY[0] - BOX.fanS / 2 > 0);
});

test('天板の中: チップ 4 個とヒートシンクが重ならず、ケージ・電源・管理 CPU の基板に当たらない。持ち上げても天板の下', () => {
  assert.equal(BOX.chipX.length * BOX.chipZ.length, chipCount());
  assert.ok(BOX.chipX[1] - BOX.chipX[0] > BOX.sinkS);
  assert.ok(BOX.chipZ[0] - BOX.chipZ[1] > BOX.sinkS);
  assert.ok(BOX.chipZ[0] + BOX.sinkS / 2 < BOX.zf - BOX.cage.d, 'sinks behind the cages');
  assert.ok(BOX.chipZ[1] - BOX.sinkS / 2 > BOX.zb + BOX.psuD, 'sinks in front of the supplies');
  assert.ok(BOX.cpu.x1 < BOX.chipX[0] - BOX.sinkS / 2, 'CPU board beside the sinks');
  assert.ok(BOX.cpu.z1 < BOX.zf - BOX.cage.d, 'CPU board behind the cages');
  assert.ok(BOX.boardY + 11 + BOX.sinkH < BOX.h - 2, 'the sinks fit under the lid');
  assert.ok(BOX.boardY + 11 + BOX.sinkH + BOX.lift.heat < BOX.h + BOX.lift.lid, 'lifted sinks stay under the lifted lid');
  assert.equal(bundlePaths().length, chipCount());
  for (const p of bundlePaths()) assert.ok(p.every(([x, y]) => Math.abs(x) < BOX.w2 && y > 0 && y < BOX.h));
  assert.ok(windPaths().length > 0);
});

// ------------------------------------------------------------ the script and the timeline
test('台本: 80〜90 秒、章 1→7→1、章 4 は drop → credit → pfc、各章の長さが依頼書のとおり', () => {
  assert.ok(DURATION >= 80 && DURATION <= 90);
  const chs = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.chapter);
  assert.deepEqual(chs, [1, 2, 3, 4, 5, 6, 7, 1]);
  const at = (t) => stateAtScript(t);
  assert.equal(at(36).scene, 'drop');
  assert.equal(at(41).scene, 'credit');
  assert.equal(at(47).scene, 'pfc');
  assert.equal(at(25).scene, 'sweep');
  assert.equal(at(30).scene, 'lookup');
  assert.equal(at(55).scene, 'fattree');
  assert.equal(at(60).scene, 'ar');
  assert.equal(at(70).scene, 'ring');
  assert.equal(at(75).scene, 'sharp');
  assert.equal(at(80).scene, 'air');
  const ct = Object.fromEntries(SCRIPT.filter((e) => e.chapter !== undefined).map((e) => [e.chapter, e.t]));
  const lens = [ct[2] - 0, ct[3] - ct[2], ct[4] - ct[3], ct[5] - ct[4], ct[6] - ct[5], ct[7] - ct[6]];
  assert.deepEqual(lens, [10, 10, 14, 18, 14, 12]);
  // the sweep finishes inside its window, the ring reaches its end before SHARP
  assert.ok(sceneTAt(28.39) >= sweepEnd());
  assert.ok(sceneTAt(72.49) >= SCENES.ring.dur - 0.01);
  assert.equal(sceneClock('sweep', PRE + SCENES.sweep.dur + HOLD + 0.1, PRE) < 0.2, true);
});

test('timeline.json: 台本の拍と一致', () => {
  const tl = JSON.parse(fs.readFileSync(new URL('../qx800-film/timeline.json', import.meta.url)));
  assert.equal(tl.duration, DURATION);
  assert.deepEqual(tl.beats, beatsOf());
});

test('分解: 2 章で 4 層とも 1 へ、閉じると 0 へ。開くのは上の層から、閉じるのは下の層から', () => {
  const ev = explodeEventsOf();
  assert.deepEqual(ev.map((e) => e.t), [10, 20]);
  const open = liftsAt(ev, 19).lifts;
  assert.ok(open.every((v) => v > 0.999));
  const shut = liftsAt(ev, 22).lifts;
  assert.ok(shut.every((v) => v < 1e-6));
  // opening order: the lid first
  const a = liftsAt(ev, 10.3).lifts;
  assert.ok(a[0] > a[1] && a[1] >= a[2] && a[2] >= a[3]);
  // closing order: the bottom layer first
  const b = liftsAt(ev, 20.2).lifts;
  assert.ok(b[3] <= b[2] && b[2] <= b[1] && b[1] <= b[0]);
  assert.ok(holdOf(2, 3) > 0 && holdOf(3, 4) === 0);
});

test('章: 7 つ、名前・説明・実機のコマンドがあり、場面は SCENES にある', () => {
  assert.equal(CHAPTERS.length, 7);
  for (const c of CHAPTERS) {
    assert.ok(c.name && c.text && c.lab.length && c.labWhat);
    for (const s of c.scenes ?? []) assert.ok(SCENES[s], s);
  }
  assert.deepEqual(CHAPTERS[3].scenes, ['drop', 'credit', 'pfc']);
});

console.log(`\n${count} tests passed`);
