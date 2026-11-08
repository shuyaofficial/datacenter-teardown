// node trn2/kin.test.mjs — checks trn2-shared/kin.js against the hand-worked numbers in trn2/refs.md 「検算」, the torus
// functions on every pair, the shape's fit, and the auto tour's script against trn2-film/timeline.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as NV from '../nvl72-shared/kin.js';
import {
  CHAPTERS,
  compareAt,
  COMPARE_ROWS,
  coord,
  efaGBs,
  efaPerChipGbps,
  flatAt,
  FLAT_CYCLE,
  flatSentGB,
  flatSteps,
  gaugesAt,
  chipHbmGB,
  hierAt,
  hierInnerGB,
  hierInnerMs,
  hierInterGB,
  hierInterMs,
  hierMs,
  hierSentGB,
  hopAt,
  hops,
  hopStats,
  indexOf,
  innerInterRatio,
  innerLinkGiBs,
  innerOutRatio,
  innerShare,
  inOutRatio,
  INST,
  instBf16TF,
  instEfaTbps,
  instFp8TF,
  instHbmGiB,
  instHbmTBs,
  interLinkGiBs,
  kindOf,
  layerCycle,
  linkCount,
  links,
  linkTotalGiBs,
  liftsAt,
  layerAt,
  LAYERS,
  neighbors,
  NOTICE,
  NVL,
  route,
  SCENES,
  snapT,
  SPEC,
  torusAt,
  ultraChips,
  ultraCores,
  ultraEfaTbps,
  ultraFp8TF,
  ultraHbmGiB,
  ultraHbmTB,
  ultraHbmTBs,
  ultraLinksByParts,
  ULTRA,
  zRing,
  zringAt,
} from '../trn2-shared/kin.js';
import {captionOf, CL, edgePath, HOLD, nodeW, PRE, PULL, RACK, RACK_X, sceneClock, SERVERS, SLED, SLOTS, backCables} from '../trn2-shared/flow.js';
import {beatsOf, DURATION, explodeEventsOf, explodeOf, holdOf, sceneTAt, SCRIPT, stateAtScript} from '../trn2-shared/script.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`ok  ${name}`);
};

// ------------------------------------------------------------ refs.md 「検算」
test('インスタンスの HBM: 16 × 96 GiB = 1,536 GiB、16 × 2.9 = 46.4 TB/s（出典2 と合う）', () => {
  assert.equal(instHbmGiB(), 1536);
  assert.equal(instHbmGiB(), SPEC.inst.hbmGiB);
  near(instHbmTBs(), 46.4, 1e-9, 'TB/s');
  near(instHbmTBs(), SPEC.inst.hbmTBs, 1e-9, 'source');
});

test('UltraServer: 4 × 16 = 64 個、6,144 GiB、185.6 TB/s、NeuronCore 512', () => {
  assert.equal(ultraChips(), 64);
  assert.equal(ultraChips(), SPEC.ultra.chips);
  assert.equal(ultraHbmGiB(), 6144);
  assert.equal(ultraHbmGiB(), SPEC.ultra.hbmGiB);
  near(ultraHbmTBs(), 185.6, 1e-9, 'TB/s');
  near(ultraHbmTBs(), SPEC.ultra.hbmTBs, 1e-9, 'source');
  assert.equal(ultraCores(), 512);
  assert.equal(ultraCores(), SPEC.ultra.cores);
});

test('計算性能: FP8 16 × 1,299 = 20,784 TFLOPS（20.8 PF）、64 × 1,299 = 83,136（83.2 PF）、BF16 16 × 667 = 10,672（10.7 PF）', () => {
  assert.equal(instFp8TF(), 20784);
  near(instFp8TF() / 1000, SPEC.inst.fp8PF, 0.05, 'inst PF');
  assert.equal(ultraFp8TF(), 83136);
  near(ultraFp8TF() / 1000, SPEC.ultra.fp8PF, 0.07, 'ultra PF');
  assert.equal(instBf16TF(), 10672);
  near(instBf16TF() / 1000, SPEC.inst.bf16PF, 0.05, 'BF16 PF');
});

test('EFA: 16 × 200 Gb/s = 3.2 Tb/s、× 4 = 12.8 Tb/s、チップ 1 個 200 Gb/s（NVL72 の半分）', () => {
  near(instEfaTbps(), 3.2, 1e-9, 'inst');
  near(instEfaTbps(), SPEC.inst.efaTbps, 1e-9, 'inst source');
  near(ultraEfaTbps(), 12.8, 1e-9, 'ultra');
  near(ultraEfaTbps(), SPEC.ultra.efaTbps, 1e-9, 'ultra source');
  assert.equal(efaPerChipGbps(), 200);
  assert.equal(efaPerChipGbps(), SPEC.efa.gbpsPerChip);
  assert.equal(NVL.nicGbps, NV.SPEC.cx7Gbps);
  assert.equal(efaPerChipGbps() * 2, NVL.nicGbps);
});

test('NeuronLink の合計: 1,024 + 256 = 1,280 GiB/s（出典1 の 1.28 と合う）、1 本は中 256・間 128 GiB/s', () => {
  assert.equal(linkTotalGiBs(), 1280);
  near(linkTotalGiBs() / 1000, SPEC.chip.linkTBs, 1e-9, 'source');
  assert.equal(innerLinkGiBs(), 256);
  assert.equal(interLinkGiBs(), 128);
  assert.equal(innerInterRatio(), 4);
});

test('リンクの数: 中 16 × 4 ÷ 2 = 32 本、UltraServer 4 × 32 + 16 × 4 = 192 = 64 × 6 ÷ 2', () => {
  assert.equal(linkCount(INST), 32);
  assert.equal(linkCount(ULTRA), 192);
  assert.equal(ultraLinksByParts(), 192);
  assert.equal((64 * 6) / 2, 192);
  // every link once, and the kinds add up: 128 inside, 64 between
  const L = links(ULTRA);
  assert.equal(new Set(L.map((l) => `${l.a}-${l.b}`)).size, 192);
  assert.equal(L.filter((l) => l.dim === 2).length, 64);
});

test('トーラスの隣: デバイス 0 の隣は {1, 3, 4, 12}（neuron-ls の例）。全チップで 4 個／6 個、隣の関係は対称', () => {
  assert.deepEqual(neighbors(0, INST), [1, 3, 4, 12]);
  for (let i = 0; i < 16; i++) {
    const n = neighbors(i, INST);
    assert.equal(n.length, SPEC.inst.neighbors, `inst ${i}`);
    for (const j of n) assert.ok(neighbors(j, INST).includes(i), `sym ${i}-${j}`);
  }
  for (let i = 0; i < 64; i++) {
    const n = neighbors(i, ULTRA);
    assert.equal(n.length, SPEC.ultra.neighbors, `ultra ${i}`);
    for (const j of n) assert.ok(neighbors(j, ULTRA).includes(i), `sym ${i}-${j}`);
  }
  for (let i = 0; i < 64; i++) assert.equal(indexOf(coord(i)), i);
  assert.deepEqual(coord(42), [2, 2, 2]);
});

test('何段で届くか: 全組で 4 × 4 は最大 4・平均 32/15、4 × 4 × 4 は最大 6・平均 192/63。route の各段は隣どうし', () => {
  const a = hopStats(INST);
  assert.equal(a.pairs, 16 * 15);
  assert.equal(a.max, 4);
  near(a.mean, 32 / 15, 1e-12, 'inst mean');
  near(a.mean, 2.133, 0.0005, 'inst 2.133');
  const b = hopStats(ULTRA);
  assert.equal(b.pairs, 64 * 63);
  assert.equal(b.max, 6);
  near(b.mean, 192 / 63, 1e-12, 'ultra mean');
  near(b.mean, 3.048, 0.0005, 'ultra 3.048');
  for (const dims of [INST, ULTRA]) {
    const n = dims[0] * dims[1] * dims[2];
    for (let s = 0; s < n; s++)
      for (let t = 0; t < n; t++) {
        const r = route(s, t, dims);
        assert.equal(r[0], s);
        assert.equal(r[r.length - 1], t);
        for (let k = 1; k < r.length; k++) assert.ok(neighbors(r[k - 1], dims).includes(r[k]), `${s}→${t} step ${k}`);
      }
  }
  // the brief's examples: 0 → 10 in 4 (one of the farthest), 0 → 42 in 6; NVL72 is 1 for every pair
  assert.deepEqual(route(0, 10, INST), [0, 1, 2, 6, 10]);
  assert.equal(hops(0, 10, INST), 4);
  assert.deepEqual(route(0, 42), [0, 1, 2, 6, 10, 26, 42]);
  assert.equal(NVL.hops, 1);
  assert.equal(NVL.switchChips, 18);
});

test('中と外の差（仮定つき）: 1,280 ÷ 50 = 25.6 倍、中だけなら 20.5 倍。NVL72 の 18 倍より大きい', () => {
  assert.equal(efaGBs(), 50);
  near(inOutRatio(), 25.6, 1e-9, 'ratio');
  near(innerOutRatio(), 20.48, 1e-9, 'inner only');
  assert.equal(NVL.inOutRatio, 18);
  assert.ok(inOutRatio() > NVL.inOutRatio);
  assert.equal(kindOf('linkDirection'), '仮定');
});

test('all-reduce: 1 本の輪 2 × 63/64 = 1.969 GB、階層型 中 1.875 + 間 0.094 = 1.969 GB、95.2 % が中', () => {
  near(flatSentGB(), 1.969, 0.0005, 'flat');
  near(hierInnerGB(), 1.875, 1e-12, 'inner');
  near(hierInterGB(), 0.094, 0.0005, 'inter');
  near(hierSentGB(), flatSentGB(), 1e-12, 'same total');
  near(innerShare() * 100, 95.2, 0.05, 'share');
  assert.equal(flatSteps(), 126);
});

test('所要時間の目安（仮定: 中 512・間 128 GiB/s）: 3.411 + 0.682 = 4.093 ms。NVL72 はリング 2.191・SHARP 1.111 ms', () => {
  near(hierInnerMs(), 3.411, 0.0005, 'inner ms');
  near(hierInterMs(), 0.682, 0.0005, 'inter ms');
  near(hierMs(), 4.093, 0.0005, 'total ms');
  near(NVL.ringMs, 2.191, 0.0005, 'nvl ring');
  near(NVL.sharpMs, 1.111, 0.0005, 'nvl sharp');
});

test('UltraServer と NVL72 の大きさ: 64 対 72、HBM 6,144 GiB = 6.60 TB 対 13,392 GB、1 個 96 GiB = 103.1 GB 対 186 GB', () => {
  assert.equal(NVL.gpus, 72);
  near(ultraHbmTB(), 6.60, 0.005, 'TB');
  assert.equal(NV.hbmTotalGB(), 13392);
  near(chipHbmGB(), 103.1, 0.05, 'chip GB');
  assert.equal(NV.SPEC.gpu.hbmGB, 186);
});

test('SPEC: refs.md の値（チップ・インスタンス・UltraServer）と区分', () => {
  assert.deepEqual(SPEC.chip, {name: 'Trainium2', cores: 8, sramMBPerCore: 28, sramMiB: 224, hbmGiB: 96, hbmTBs: 2.9, fp8: 1299, bf16: 667, fp32: 181, linkTBs: 1.28, ccCores: 16});
  assert.equal(SPEC.chip.cores * SPEC.chip.sramMBPerCore, SPEC.chip.sramMiB);
  assert.equal(SPEC.inst.vcpu, SPEC.inst.cpuCores * 2);
  assert.equal(SPEC.inst.memGiB, 2048);
  assert.deepEqual(SPEC.inst.nvme, {n: 4, gb: 1900});
  assert.equal(SPEC.inst.ebsGbps, 80);
  assert.equal(SPEC.ultra.vcpu, 4 * SPEC.inst.vcpu);
  assert.equal(SPEC.ultra.memGiB, 4 * SPEC.inst.memGiB);
  assert.deepEqual(SPEC.rack, NV.SPEC.rack, 'the rack outline is NVL72 (仮定)');
  assert.equal(kindOf('shape'), '仮定');
  assert.equal(kindOf('sleds'), '報道');
  assert.equal(kindOf('cooling'), '報道');
  assert.equal(SPEC.server.compute * SPEC.server.chipsPerSled, SPEC.inst.chips);
  assert.match(NOTICE, /形は仮定/);
  assert.match(NOTICE, /Amazon\.com, Inc\./);
  assert.match(NOTICE, /Neuron/);
});

test('比較表: 6 行、NVL72 側は nvl72-shared/kin.js から。冷やし方は「空冷（報道。AWS は未公表）」', () => {
  assert.equal(COMPARE_ROWS.length, 6);
  assert.deepEqual(COMPARE_ROWS.map((r) => r.nv), [`${NV.switchChips()} 個`, '1 段（どの組も）', '液冷', `${NV.SPEC.cx7Gbps} Gb/s`, `GPU ${NV.gpuCount()}`, `${NV.SPEC.perf.hbmTB} TB`]);
  assert.deepEqual(COMPARE_ROWS.map((r) => r.tr), ['0 個', '最大 6 段（平均 3.05）', '空冷（報道。AWS は未公表）', '200 Gb/s', 'Trainium2 64', '6.6 TB']);
});

// ------------------------------------------------------------ the rings the all-reduce runs on
test('輪: 1 本の輪は 64 個を 1 回ずつ通り、隣どうしで閉じる。間をまたぐのは 4 本。各層の輪と z の輪も隣どうし', () => {
  assert.equal(new Set(FLAT_CYCLE).size, 64);
  let inter = 0;
  for (let i = 0; i < 64; i++) {
    const a = FLAT_CYCLE[i];
    const b = FLAT_CYCLE[(i + 1) % 64];
    assert.ok(neighbors(a).includes(b), `${a}-${b}`);
    if (coord(a)[2] !== coord(b)[2]) inter++;
  }
  assert.equal(inter, 4);
  for (let z = 0; z < 4; z++) {
    const c = layerCycle(z);
    assert.equal(new Set(c).size, 16);
    for (let i = 0; i < 16; i++) assert.ok(neighbors(c[i]).includes(c[(i + 1) % 16]) && coord(c[i])[2] === z);
  }
  for (let i = 0; i < 16; i++) {
    const r = zRing(i);
    for (let j = 0; j < 4; j++) assert.ok(neighbors(r[j]).includes(r[(j + 1) % 4]));
  }
});

// ------------------------------------------------------------ scenes
test('場面: torus は格子 → 回り込み → 0 の隣、hop は 1 段ずつ 4 段、zring は層 → z の輪 → 6 段', () => {
  assert.deepEqual(Object.keys(SCENES), ['torus', 'hop', 'zring', 'flat', 'hier', 'out', 'compare']);
  assert.equal(torusAt(0).gridK, 0);
  assert.equal(torusAt(SCENES.torus.dur).nbK, 1);
  assert.deepEqual(torusAt(4).nb, [1, 3, 4, 12]);
  let last = 0;
  for (let t = 0; t <= SCENES.hop.dur; t += 0.05) {
    const h = hopAt(t).hops;
    assert.ok(h === last || h === last + 1, 'one hop at a time');
    last = h;
  }
  assert.equal(hopAt(SCENES.hop.dur).hops, 4);
  assert.ok(hopAt(SCENES.hop.dur).done);
  assert.equal(zringAt(0).chips, 16);
  assert.equal(zringAt(3).chips, 64);
  assert.equal(zringAt(SCENES.zring.dur).hops, 6);
  assert.ok(zringAt(SCENES.zring.dur).done);
  assert.equal(gaugesAt('hop', 3).chips, 16);
  assert.equal(gaugesAt('torus', 0).hops, 0);
  assert.equal(gaugesAt('torus', SCENES.torus.dur).hops, 1, 'a neighbour is 1 hop');
});

test('場面: flat は 1.969 GB へ、hier は中 → 間 → 中で同じ 1.969 GB・95.2 %・4.093 ms で止まる', () => {
  near(flatAt(SCENES.flat.dur).sentGB, flatSentGB(), 1e-12, 'flat end');
  assert.equal(flatAt(0).sentGB, 0);
  const e = hierAt(SCENES.hier.dur);
  assert.equal(e.phase, 'done');
  near(e.sentGB, hierSentGB(), 1e-12, 'hier end');
  near(e.innerShare, innerShare(), 1e-12, 'share end');
  near(e.ms, hierMs(), 1e-12, 'ms end');
  // during the first phase everything is inside; during the z phase only the 1/16 moves
  near(hierAt(1).innerShare, 1, 1e-12, 'first phase inside');
  assert.equal(hierAt(3).phase, 'z');
  near(hierAt(3.8).interGB, hierInterGB(), 1e-12, 'z done');
  assert.ok(hierAt(5).sentGB > hierAt(3).sentGB);
  const g = gaugesAt('hier', SCENES.hier.dur);
  near(g.innerGB + g.interGB, g.sentGB, 1e-12, 'parts');
  assert.equal(gaugesAt('flat', 1).innerShare, null);
  near(gaugesAt('out', 1).outRatio, 25.6, 1e-9, 'out');
  assert.equal(compareAt(100).lit, 6);
  assert.equal(compareAt(0).lit, 0);
});

test('reduced motion: 粒は段ごとに跳ぶ（hop の途中で止まらない）', () => {
  for (let t = 0; t < SCENES.hop.dur; t += 0.13) {
    const h = hopAt(snapT('hop', t));
    assert.ok(h.u < 1e-3 || h.done, `hop at ${t}`);
  }
  for (const t of [0.3, 2.7, 4.5, 7]) assert.ok([0, 2.6, 3.8, 6.4].includes(snapT('hier', t)));
});

test('分解: まず引き出し、上の層（天板 → ヒートシンク → チップ → カード）から浮く。戻すときは下から', () => {
  assert.deepEqual(LAYERS, ['pull', 'lid', 'sinks', 'chips', 'io']);
  const ev = [{t: 0, to: explodeOf(2)}];
  const L = (t) => liftsAt(ev, t).lifts;
  assert.ok(L(0.6)[0] > 0.2 && L(0.6)[1] === 0, 'the pull moves first');
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
  assert.deepEqual(B(9).map((v) => +v.toFixed(6)), [0, 0, 0, 0, 0]);
});

// ------------------------------------------------------------ the shape (仮定)
test('並び: ラック 2 本にサーバー 2 台ずつ、1 台は 計算 4 → ホスト → スイッチ 2 → 計算 4、スレッド 44 枚が高さに収まる', () => {
  assert.equal(SLOTS.length, 44);
  assert.equal(SLOTS.filter((s) => s.kind === 'compute').length, 32);
  assert.equal(SERVERS.length, 4);
  for (const sv of SERVERS) {
    const kinds = SLOTS.filter((s) => s.server === sv.n).map((s) => s.kind);
    assert.deepEqual(kinds, ['compute', 'compute', 'compute', 'compute', 'host', 'switch', 'switch', 'compute', 'compute', 'compute', 'compute']);
  }
  for (const r of [0, 1]) {
    const ys = SLOTS.filter((s) => s.rack === r).map((s) => s.y0).sort((a, b) => a - b);
    assert.ok(ys[0] > 100, 'above the plinth');
    assert.ok(ys[ys.length - 1] + SLED.h <= RACK.top + 1, 'under the top unit');
    for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= SLED.h, 'no overlap');
  }
  assert.ok(SLED.w < RACK.w - 2 * RACK.post);
  assert.ok(SLED.zc + SLED.d / 2 <= RACK.zf && SLED.zc - SLED.d / 2 >= RACK.zb);
  assert.ok(SLED.zc - SLED.d / 2 + SLED.pull >= RACK.zf, 'the pulled sled clears the rack');
  assert.ok(RACK_X[1] - RACK_X[0] >= RACK.w, 'the racks do not overlap');
  assert.equal(PULL.kind, 'compute');
  // the parts inside the sled stay inside its walls and under its lid
  for (const x of [...CL.chipX.map((x) => Math.abs(x) + CL.sink.w / 2), ...CL.nicX.map((x) => Math.abs(x) + 17), ...CL.fanX.map((x) => Math.abs(x) + CL.fanS / 2)]) assert.ok(x < SLED.w / 2 - 2, `x ${x}`);
  assert.ok(CL.chipY + CL.sink.base + CL.sink.fin < SLED.h - 2, 'the heatsink under the lid');
  // the exploded layers do not pass through each other: sinks lifted clear of the lifted chips
  assert.ok(CL.chipY + CL.lift.sinks > CL.chipY + CL.lift.chips, 'sinks above chips');
  assert.ok(CL.lift.lid + SLED.h > CL.chipY + CL.sink.base + CL.sink.fin + CL.lift.sinks, 'lid above sinks');
});

test('背面のケーブル: 網の目は同じサーバーの中、Z は同じスレッド番号どうしで 1-2・2-3・3-4・4-1', () => {
  const c = backCables();
  assert.equal(c.filter((x) => x.kind === 'z').length, 4 * SPEC.server.compute);
  for (const x of c) for (const p of x.pts) assert.ok(p[2] > RACK.zb - 80 && p[2] < SLED.zc - SLED.d / 2, 'behind the sleds');
});

test('図: 隣どうしの線は直線、x の回り込みは層の上の弧、y の回り込みは層の外を回る、z の回り込みは列の横', () => {
  const p = edgePath(0, 1);
  assert.equal(p.length, 2);
  const x = edgePath(3, 0);
  assert.ok(Math.max(...x.map((q) => q[1])) > nodeW(0)[1] + 100, 'x wrap above');
  const y = edgePath(12, 0);
  const half = 1.5 * 250;
  assert.ok(Math.max(...y.map((q) => Math.abs(q[2] - nodeW(5)[2] - 125))) > half, 'y wrap outside');
  const z = edgePath(48, 0);
  assert.equal(z.length, 4);
  // the floors in their places, 0 on top
  for (let i = 0; i < 64; i++) assert.ok(nodeW(i)[1] <= nodeW(i % 16)[1]);
});

// ------------------------------------------------------------ chapters and the tour
test('章: 7 章、ラボのコマンドは refs.md の表にある（1 章は無し）。場面は brief のとおり', () => {
  assert.equal(CHAPTERS.length, 7);
  const refs = fs.readFileSync(new URL('./refs.md', import.meta.url), 'utf8');
  for (const c of CHAPTERS) for (const l of c.lab) assert.ok(refs.includes(l.cmd), `${c.n}: ${l.cmd}`);
  assert.equal(CHAPTERS[0].lab.length, 0);
  assert.deepEqual(CHAPTERS.map((c) => c.scenes ?? null), [null, null, ['torus', 'hop'], ['zring'], ['flat', 'hier'], ['out'], ['compare']]);
  for (const c of CHAPTERS) assert.ok(!/青|黄/.test(c.text) || c.n === 1, 'colours only named, chapter 1');
});

test('ツアー: 70〜90 s、章 1→7→1、長さは 10・12・12・12・16・10・12 s、timeline.json は台本と一致', () => {
  assert.ok(DURATION >= 70 && DURATION <= 90);
  const ch = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.chapter);
  assert.deepEqual(ch, [1, 2, 3, 4, 5, 6, 7, 1]);
  const tl = JSON.parse(fs.readFileSync(new URL('../trn2-film/timeline.json', import.meta.url), 'utf8'));
  assert.equal(tl.duration, DURATION);
  assert.deepEqual(tl.beats, beatsOf());
  const ts = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.t);
  assert.deepEqual(ts.slice(1).map((t, i) => t - ts[i]), [10, 12, 12, 12, 16, 10, 12]);
});

test('ツアー: torus は終わってから hop、hop は着いてから章 4、zring は 6 段に届いてから章 5、flat は 1.969 GB から hier', () => {
  const hopPress = SCRIPT.find((e) => e.scene === 'hop').t;
  assert.equal(torusAt(sceneTAt(hopPress - 0.01)).nbK, 1);
  const at = (n) => SCRIPT.find((e) => e.chapter === n).t;
  assert.ok(hopAt(sceneTAt(at(4) - 0.01)).done);
  assert.ok(zringAt(sceneTAt(at(5) - 0.01)).done);
  const hierPress = SCRIPT.find((e) => e.scene === 'hier').t;
  near(flatAt(sceneTAt(hierPress - 0.01)).sentGB, 1.969, 0.0005, 'flat done');
  assert.ok(hierAt(sceneTAt(at(6) - 0.01)).done);
  assert.equal(compareAt(sceneTAt(SCRIPT[SCRIPT.length - 1].t - 0.01)).lit, 6);
  assert.deepEqual(explodeEventsOf().map((e) => e.t), [10, 22, 62, 72]);
  assert.equal(stateAtScript(30).scene, 'hop');
});

test('ツアー: スレッドが戻る章の切り替えは、戻り切るまでカメラが待つ（holdOf）', () => {
  assert.equal(holdOf(1, 2), 0);
  for (const [a, b] of [[2, 3], [6, 7]]) {
    const hold = holdOf(a, b);
    assert.ok(hold > 0, `${a}→${b}`);
    const ev = [{t: 0, to: explodeOf(a)}, {t: 100, to: explodeOf(b)}];
    const hi = liftsAt(ev, 100 + hold, [0, 0, 0, 0, 0]).lifts;
    hi.forEach((v, k) => near(v, explodeOf(b)[k], 1e-9, `layer ${k} back at ${a}→${b}`));
  }
});

test('scene clock: 章を押すと PRE だけ待ち、終わると HOLD だけ止まってから繰り返す', () => {
  assert.equal(sceneClock('hop', 1.0, PRE), 0);
  near(sceneClock('flat', PRE + 3, PRE), 3, 1e-9, 'runs');
  near(sceneClock('flat', SCENES.flat.dur + HOLD + 0.5), 0.5, 1e-9, 'loops');
  near(sceneClock('out', 100), 100, 1e-9, 'endless');
});

test('字幕: 場面ごとに 1 行、核心の言い方を含む', () => {
  assert.match(captionOf('torus', 4), /1・3・4・12/);
  assert.match(captionOf('hop', 5.3), /4 段/);
  assert.match(captionOf('zring', 8.5), /6 段/);
  assert.match(captionOf('flat', 7), /1\.969 GB/);
  assert.match(captionOf('hier', 5), /95\.2 %/);
  assert.match(captionOf('out', 1), /25\.6 倍/);
  assert.match(captionOf('compare', 100), /HBM/);
});

console.log(`\n${count} tests passed`);
