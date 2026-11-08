// node tpu/kin.test.mjs — checks tpu-shared/kin.js against the hand-worked numbers in tpu/refs.md 「検算」, the torus
// routes over every pair, and the tour's script against tpu-film/timeline.json.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  allreduceIdealMs,
  allreduceOneAxisMs,
  allreduceSentGB,
  axisGBs,
  CHAPTERS,
  chipCount,
  chipEnds,
  chipKW,
  chipOfTray,
  copperLinks,
  cubeLinks,
  cubesInPod,
  diameter,
  FAILED,
  faceLinks,
  gaugesAt,
  hopAt,
  hopsBetween,
  iciDcnRatio,
  iciGBs,
  iciOneWayGBs,
  iciVsNvlink,
  innerLinks,
  jaxDevicesPerVm,
  LAYERS,
  layerAt,
  liftsAt,
  lineEnds,
  linkKind,
  linkVsNvlink,
  meanHops,
  neighbours,
  next8tEF,
  next8tPB,
  next8tVsIronwood,
  NVL,
  ocsAt,
  ocsPortsIronwood,
  ocsPortsV4,
  opticalLinks,
  pcbLinks,
  podFp8EF,
  podHbmGB,
  podHbmPBifGiB,
  podHbmPBs,
  podIciTbps,
  rackFp8PF,
  rackHbmGB,
  rackKW,
  rackSlotOf,
  route,
  scaleVsNvl,
  SCENE_IDS,
  SCENES,
  sixAt,
  snapT,
  SPEC,
  swapAt,
  trayOfChip,
  trayOutLinks,
  vsAt,
  wrapAt,
} from '../tpu-shared/kin.js';
import {SPEC as NV, gpuCount, hbmTotalGB, inOutRatio, linkGBs, ringMs} from '../nvl72-shared/kin.js';
import {along, captionOf, cubeXYZ, dashes, DASH, HOLD, miniCentres, MINI_AT, outBeads, PAIRS, PRE, sceneClock, trayX, trayY, TRAY, vPath, wrapPaths} from '../tpu-shared/flow.js';
import {beatsOf, chapterPlanOf, DURATION, explodeEventsOf, explodeOf, holdOf, sceneTAt, SCRIPT, stateAtScript} from '../tpu-shared/script.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`ok  ${name}`);
};

// ------------------------------------------------------------ refs.md 「検算」
test('ICI の合計: 6 × 200 = 1,200 GB/s、1 軸 400 GB/s、ポッド 9,216 × 9.6 = 88,473.6 Tb/s', () => {
  assert.equal(iciGBs(), 1200);
  near(iciGBs() / 1000, SPEC.ici.chipTBs, 1e-9, 'chip TB/s');
  assert.equal(axisGBs(), SPEC.ici.axisGBs);
  near(podIciTbps(), 88473.6, 1e-6, 'pod Tb/s');
  near(podIciTbps(), SPEC.pod.iciTbps, 1e-6, 'source');
  near(podIciTbps() / 8, SPEC.pod.iciTBs, 1e-6, 'pod TB/s');
});

test('立方体の線: 中 144 = 基板 64 + 銅 80、光 96、端 2 × 144 + 96 = 384 = 64 × 6', () => {
  assert.equal(chipCount(), 64);
  assert.equal(innerLinks(SPEC.cube.dims), 144);
  assert.equal(pcbLinks(), 64);
  assert.equal(copperLinks(), 80);
  assert.equal(opticalLinks(), 96);
  assert.equal(faceLinks([4, 4, 4]), SPEC.cube.faces * SPEC.cube.perFace);
  assert.equal(lineEnds(), 384);
  assert.equal(chipEnds(), 384);
  assert.deepEqual([pcbLinks(), copperLinks(), opticalLinks()], [SPEC.cube.pcb, SPEC.cube.copper, SPEC.cube.optical]);
});

test('線の種類を座標から数えても 64・80・96（輪の線 48 本 × 2 面）', () => {
  const L = cubeLinks();
  const n = (k) => L.filter((l) => l.kind === k).length;
  assert.equal(L.length, 64 * 6 / 2);
  assert.equal(n('board'), 64);
  assert.equal(n('copper'), 80);
  assert.equal(n('optical') * 2, 96);
  // board lines stay inside one tray, copper and optical lines join two
  for (const l of L) if (l.kind === 'board') assert.equal(trayOfChip(l.a), trayOfChip(l.b));
  for (const l of L) if (l.kind !== 'board') assert.notEqual(trayOfChip(l.a), trayOfChip(l.b));
});

test('トレイ: 外へ出る ICI 4 × 6 − 4 × 2 = 16、JAX のデバイス 4 × 2 = 8、16 枚が左右 2 列 × 8 段に重ならず入る', () => {
  assert.equal(trayOutLinks(), 16);
  assert.equal(jaxDevicesPerVm(), 8);
  const slots = new Set();
  for (let n = 0; n < 16; n++) {
    const {col, row} = rackSlotOf(n);
    slots.add(`${col},${row}`);
    for (let s = 0; s < 4; s++) assert.equal(trayOfChip(chipOfTray(n, s)), n);
    // a tray is one z and a 2×2 of x・y (仮定)
    const cs = [0, 1, 2, 3].map((s) => chipOfTray(n, s));
    assert.equal(new Set(cs.map((c) => c[2])).size, 1);
  }
  assert.equal(slots.size, 16);
  // the trays do not overlap in the rack
  for (let a = 0; a < 16; a++) for (let b = a + 1; b < 16; b++) if (trayX(a) === trayX(b)) assert.ok(Math.abs(trayY(a) - trayY(b)) >= TRAY.h, `trays ${a} ${b}`);
});

test('ホップ数: 4×4×4 = 6（平均 3.048）、8×8×16 = 16、8×16×16 = 20、16×24×24 = 32（平均 16.0）', () => {
  assert.equal(diameter([4, 4, 4]), 6);
  near(meanHops([4, 4, 4]), 3.048, 0.0005, 'mean 4x4x4');
  assert.equal(diameter([8, 8, 16]), 16);
  assert.equal(diameter([8, 16, 16]), 20);
  assert.equal(diameter([16, 24, 24]), 32);
  near(meanHops([16, 24, 24]), 16.0, 0.005, 'mean 9216');
  assert.equal(diameter(SPEC.pod.shape), 32);
});

test('トーラスの経路: 4×4×4 の 64 × 63 組すべてで最大 6・平均 3.048、1 歩ごとに 1 軸だけ ±1（輪で折り返す）', () => {
  const dims = [4, 4, 4];
  const all = [];
  for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) for (let z = 0; z < 4; z++) all.push([x, y, z]);
  let max = 0;
  let sum = 0;
  let pairs = 0;
  for (const a of all)
    for (const b of all) {
      if (a === b) continue;
      const r = route(a, b, dims);
      assert.deepEqual(r[0], a);
      assert.deepEqual(r[r.length - 1], b);
      for (let i = 1; i < r.length; i++) {
        const diff = r[i].map((v, k) => (v - r[i - 1][k] + dims[k]) % dims[k]);
        assert.equal(diff.filter((d) => d !== 0).length, 1, 'one axis per step');
        assert.ok(diff.every((d, k) => d === 0 || d === 1 || d === dims[k] - 1), '±1 with wrap');
        assert.ok(neighbours(r[i - 1], dims).some((n) => n.join() === r[i].join()), 'a neighbour');
      }
      const hops = r.length - 1;
      assert.equal(hops, hopsBetween(a, b, dims));
      max = Math.max(max, hops);
      sum += hops;
      pairs++;
    }
  assert.equal(pairs, 64 * 63);
  assert.equal(max, 6);
  near(sum / pairs, 3.048, 0.0005, 'mean');
});

test('トーラスの経路: 8×8×16 の全組で最大 16、どの経路も 1 歩ごとに 1 軸だけ ±1', () => {
  const dims = [8, 8, 16];
  const all = [];
  for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) for (let z = 0; z < 16; z++) all.push([x, y, z]);
  let max = 0;
  for (const a of all)
    for (const b of all) {
      if (a === b) continue;
      const r = route(a, b, dims);
      for (let i = 1; i < r.length; i++) {
        let changed = 0;
        for (let k = 0; k < 3; k++) {
          const d = (r[i][k] - r[i - 1][k] + dims[k]) % dims[k];
          if (d) {
            changed++;
            assert.ok(d === 1 || d === dims[k] - 1);
          }
        }
        assert.equal(changed, 1);
      }
      assert.deepEqual(r[r.length - 1], b);
      max = Math.max(max, r.length - 1);
    }
  assert.equal(max, 16);
});

test('NVL72 と比べる: 1.2 ÷ 1.8 = 0.667 倍、1 本は 200 ÷ 100 = 2 倍、9,216 ÷ 72 = 128 倍、9,216 ÷ 64 = 144（NVL72 の値は nvl72 の SPEC から）', () => {
  assert.equal(NVL.gpus, gpuCount());
  assert.equal(NVL.links, NV.nvlink.linksPerGpu);
  assert.equal(NVL.linkGBs, linkGBs());
  near(iciVsNvlink(), 0.667, 0.0005, 'chip');
  assert.equal(linkVsNvlink(), 2);
  assert.equal(scaleVsNvl(), 128);
  assert.equal(cubesInPod(), 144);
  assert.equal(cubesInPod(), SPEC.pod.cubes);
  assert.equal(NVL.rackHbmGB, hbmTotalGB());
  assert.equal(NVL.inOut, inOutRatio());
  assert.equal(NVL.ringMs, ringMs());
});

test('ポッドの HBM 9,216 × 192 = 1,769,472 GB（1.77 PB）、GiB なら 1.90 PB。FP8 42.52 EFLOPS、HBM 帯域 68.0 PB/s', () => {
  assert.equal(podHbmGB(), 1769472);
  near(podHbmGB() / 1e6, SPEC.pod.hbmPB, 0.005, 'PB');
  near(podHbmPBifGiB(), 1.9, 0.005, 'GiB');
  near(podFp8EF(), 42.52, 0.005, 'EF');
  near(podFp8EF(), SPEC.pod.fp8EF, 0.05, 'source');
  near(podHbmPBs(), 68.0, 0.05, 'PB/s');
});

test('ラック 1 台: HBM 64 × 192 = 12,288 GB（NVL72 は 13,392 GB）、FP8 64 × 4.614 = 295.3 PFLOPS', () => {
  assert.equal(rackHbmGB(), 12288);
  assert.equal(NVL.rackHbmGB, 13392);
  near(rackFp8PF(), 295.3, 0.05, 'PF');
});

test('ICI と DCN: 片方向 600 GB/s = 4,800 Gb/s ÷ 100 = 48 倍（NVL72 は 18 倍）', () => {
  assert.equal(iciOneWayGBs(), 600);
  assert.equal(iciDcnRatio(), 48);
  assert.equal(NVL.inOut, 18);
  assert.equal(gaugesAt('out', 2).outRatio, 48);
});

test('OCS のポート: TPU v4 は 64 × 2 = 128 ≤ 136、Ironwood を同じ並べ方にすると 144 × 2 = 288 で足りない', () => {
  assert.equal(ocsPortsV4(), 128);
  assert.ok(ocsPortsV4() <= SPEC.ocsV4.ports);
  assert.equal(ocsPortsIronwood(), 288);
  assert.ok(ocsPortsIronwood() > SPEC.ocsV4.ports);
});

test('all-reduce: 1 チップが送る量 2 × 63/64 = 1.969 GB、1 軸ずつ 9.84 ms、3 軸の理想 3.28 ms、NVL72 2.191 ms', () => {
  near(allreduceSentGB(), 1.969, 0.0005, 'GB');
  near(allreduceSentGB(), (2 * 63) / 64, 1e-12, 'exact');
  near(allreduceOneAxisMs(), 9.84, 0.005, 'one axis');
  near(allreduceIdealMs(), 3.28, 0.005, 'ideal');
  near(NVL.ringMs, 2.191, 0.0005, 'NVL72');
});

test('電力（推測）: 10 MW ÷ 144 = 約 69 kW/ラック、÷ 9,216 = 約 1.09 kW/チップ', () => {
  near(rackKW(), 69.4, 0.05, 'rack');
  near(chipKW(), 1.09, 0.005, 'chip');
});

test('TPU 8t: 9,600 × 12.6 = 121 EFLOPS、9,600 × 216 GB = 2.07 PB、121 ÷ 42.5 = 2.85 倍', () => {
  near(next8tEF(), 121, 0.05, 'EF');
  near(next8tEF(), SPEC.next8t.podEF, 0.05, 'source');
  near(next8tPB(), 2.07, 0.005, 'PB');
  near(next8tVsIronwood(), 2.85, 0.005, 'x');
  assert.equal(SPEC.next8i.hopsBoardfly, 7);
});

// ------------------------------------------------------------ scenes
test('six: (1,1,1) から 6 本、行き先はすべて隣（基板 2・銅 4）', () => {
  const f = sixAt(99);
  assert.equal(f.lit, 6);
  assert.equal(sixAt(0).lit, 0);
  for (const l of f.links) assert.equal(hopsBetween(f.from, l.b), 1);
  assert.equal(f.links.filter((l) => l.kind === 'board').length, 2);
  assert.equal(f.links.filter((l) => l.kind === 'copper').length, 4);
  assert.equal(gaugesAt('six', 99).links, 6);
});

test('hop: (0,0,0) → (2,2,2) は 6 回、計器は 0 → 6 と単調に増える。線は 基板・銅・基板・銅・銅・銅', () => {
  const h = hopAt(99);
  assert.equal(h.hops, 6);
  assert.ok(h.done);
  assert.equal(hopAt(0).hops, 0);
  let prev = 0;
  for (let t = 0; t <= SCENES.hop.dur; t += 0.05) {
    const v = gaugesAt('hop', t).hops;
    assert.ok(v >= prev && v - prev <= 1);
    prev = v;
  }
  assert.deepEqual(h.path.slice(1).map((p, i) => linkKind(h.path[i], p)), ['board', 'copper', 'board', 'copper', 'copper', 'copper']);
});

test('wrap: (0,0,0) → (3,0,0) は中を通ると 3 回、光で折り返すと 1 回。経路は −X の面から出て +X の面から入る', () => {
  const w = wrapAt(99);
  assert.equal(w.naive, 3);
  assert.equal(w.hops, 1);
  assert.equal(w.path.length - 1, 1);
  assert.equal(linkKind(SPEC.demo.wrapFrom, SPEC.demo.wrapTo), 'optical');
  assert.equal(wrapAt(0.5).hops, 0);
  const P = wrapPaths();
  assert.ok(P.out[1][0] < P.a[0], 'out of −X');
  assert.ok(P.inn[P.inn.length - 2][0] > P.b[0], 'in through +X');
  assert.equal(P.ghost.length - 1, 3);
});

test('ocs: 立方体 4 個が 4×4×16（最大 12）→ 8×8×4（最大 10）。鏡が回ってから立方体が動く', () => {
  assert.equal(ocsAt(0).shape, '4x4x16');
  assert.equal(ocsAt(0).maxHops, 12);
  assert.equal(ocsAt(99).shape, '8x8x4');
  assert.equal(ocsAt(99).maxHops, 10);
  assert.equal(ocsAt(1.0).move, 0, 'the cubes wait for the mirrors');
  assert.ok(ocsAt(1.0).tilt > 0);
  assert.equal(gaugesAt('ocs', 0).cubes, 4);
  // the column stacks the cubes along the long axis; the slab is 2 × 2
  assert.deepEqual(miniCentres(0).slice(0, 4), MINI_AT.column);
  assert.deepEqual(miniCentres(1).slice(0, 4), MINI_AT.flat);
  assert.equal(PAIRS.column.length, 4);
  const v = vPath(miniCentres(1), PAIRS.flat[0], 0);
  assert.equal(v.length, 5);
});

test('swap: 鏡が回り切ったら swapped、予備が入っても形は 8×8×4', () => {
  assert.equal(swapAt(0).swapped, false);
  assert.equal(swapAt(99).swapped, true);
  assert.equal(swapAt(99).shape, '8x8x4');
  assert.equal(gaugesAt('swap', 99).swapped, true);
  assert.ok(PAIRS.swapped.some((p) => p.includes(4)), 'the spare joins');
  assert.ok(!PAIRS.swapped.some((p) => p.includes(FAILED)), 'the failed cube is out');
  assert.equal(PAIRS.flat.filter((p) => p.includes(FAILED)).length, PAIRS.swapped.filter((p) => p.includes(4)).length, 'the spare takes every path of the failed cube');
});

test('pod: 立方体 144 個、形は 16×24×24（仮定）で最大 32', () => {
  const g = gaugesAt('pod', 1);
  assert.equal(g.cubes, 144);
  assert.equal(g.shape, '16x24x24');
  assert.equal(g.maxHops, 32);
});

test('vs: NVL72 はスイッチ 1 段、Ironwood は 6 回で同じ相手に届く', () => {
  const v = vsAt(99);
  assert.equal(v.nvHops, 1);
  assert.equal(v.iwHops, 6);
  assert.ok(v.done);
  assert.equal(vsAt(0).iwHops, 0);
});

test('out: ICI 側の粒は DCN 側の 48 倍', () => {
  const b = outBeads(10);
  assert.equal(b.ratio, 48);
  assert.ok(b.ins.length > 10 * b.outs.length);
});

test('dashes: 速さ 0 なら止まる', () => {
  const path = [[0, 0, 0], [0, 1000, 0]];
  near(dashes(path, 0.1)[1].a[1] - dashes(path, 0)[1].a[1], DASH.speed * 0.1, 1e-6, 'moves');
  assert.deepEqual(dashes(path, 0, 0), dashes(path, 4, 0));
});

test('純関数: 同じ入力は同じ出力', () => {
  for (const sc of SCENE_IDS) for (const t of [0, 1.3, 4.7]) assert.deepEqual(gaugesAt(sc, t), gaugesAt(sc, t));
  assert.deepEqual(hopAt(3.3), hopAt(3.3));
});

test('reduced motion: snapT は段の頭に跳ぶ', () => {
  assert.ok(snapT('hop', 1.0) <= 1.0);
  assert.equal(hopAt(snapT('hop', 1.0)).legIndex, hopAt(1.0).legIndex);
  assert.equal(snapT('ocs', 1.0), 0.5);
  assert.equal(snapT('swap', 2.0), 1.3);
});

test('along と cubeXYZ: 折れ線の長さで進む、チップの z は上へ', () => {
  assert.deepEqual(along([[0, 0, 0], [10, 0, 0], [10, 10, 0]], 0.75), [10, 5, 0]);
  assert.ok(cubeXYZ([0, 0, 3])[1] > cubeXYZ([0, 0, 0])[1]);
});

// ------------------------------------------------------------ the pulled tray
test('引き出し: まず引き出し、上の層から浮く。戻すときは下から', () => {
  assert.deepEqual(LAYERS, ['pull', 'lid', 'plates', 'chips', 'io']);
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
  assert.ok(B(5.3)[0] === 1, 'the tray goes in last');
  assert.deepEqual(B(9).map((v) => +v.toFixed(6)), [0, 0, 0, 0, 0]);
});

// ------------------------------------------------------------ chapters and the tour
test('章: 7 章、ラボのコマンドは refs.md の表と同じ。見えない章は「利用者からは見えない」', () => {
  assert.equal(CHAPTERS.length, 7);
  const refs = fs.readFileSync(new URL('./refs.md', import.meta.url), 'utf8');
  for (const c of CHAPTERS) for (const l of c.lab) assert.ok(refs.includes(l.cmd), `${c.n}: ${l.cmd}`);
  assert.match(CHAPTERS[6].labNote, /利用者からは見えない/);
  assert.deepEqual(CHAPTERS[2].scenes, ['six', 'hop', 'wrap']);
  assert.deepEqual(CHAPTERS[3].scenes, ['ocs', 'swap', 'pod']);
});

test('ツアー: 75〜90 s、章 1→7→1、各章の長さは brief どおり、timeline.json は台本と一致', () => {
  assert.ok(DURATION >= 75 && DURATION <= 90);
  const ch = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.chapter);
  assert.deepEqual(ch, [1, 2, 3, 4, 5, 6, 7, 1]);
  const tl = JSON.parse(fs.readFileSync(new URL('../tpu-film/timeline.json', import.meta.url), 'utf8'));
  assert.equal(tl.duration, DURATION);
  assert.deepEqual(tl.beats, beatsOf());
  const at = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.t);
  assert.deepEqual(at.slice(1).map((t, i) => t - at[i]), [10, 12, 16, 16, 12, 8, 10]);
});

test('ツアー: six は描き切ってから hop、hop は着いてから wrap、ocs が済んでから swap、swap が済んでから pod', () => {
  const press = (id) => SCRIPT.find((e) => e.scene === id).t;
  assert.equal(sixAt(sceneTAt(press('hop') - 0.01)).lit, 6);
  assert.ok(hopAt(sceneTAt(press('wrap') - 0.01)).done);
  assert.ok(wrapAt(sceneTAt(SCRIPT.find((e) => e.chapter === 4).t - 0.01)).done);
  assert.ok(ocsAt(sceneTAt(press('swap') - 0.01)).done);
  assert.ok(swapAt(sceneTAt(press('pod') - 0.01)).done);
  assert.ok(SCRIPT.find((e) => e.chapter === 5).t + PRE + SCENES.vs.dur < SCRIPT.find((e) => e.chapter === 6).t, 'vs runs to the end once');
  assert.ok(vsAt(SCENES.vs.dur).done);
  assert.deepEqual(explodeEventsOf().map((e) => e.t), [10, 22]);
  assert.equal(stateAtScript(6).view, 'cube');
});

test('live: 章を押すとその章の場面がツアーと同じ順に進む。hops は 6 s、swapped は 8 s までに上がる', () => {
  assert.deepEqual(chapterPlanOf(3).map((p) => p.scene), ['hop', 'wrap']);
  assert.deepEqual(chapterPlanOf(4).map((p) => p.scene), ['swap', 'pod']);
  // hops: the hop press after the chapter press, then the first link's middle
  const hop = chapterPlanOf(3)[0].dt;
  let t = 0;
  while (hopAt(t).hops === 0) t += 0.01;
  assert.ok(hop + t < 6 - 1, `hops rises at ${hop + t} s`);
  const swap = chapterPlanOf(4)[0].dt;
  let u = 0;
  while (!swapAt(u).swapped) u += 0.01;
  assert.ok(swap + u < 8 - 1, `swapped at ${swap + u} s`);
  // the chapter's first scene is done before the next press
  assert.ok(sixAt(hop - PRE).lit === 6);
  assert.ok(ocsAt(swap - PRE).done);
});

test('ツアー: トレイが戻る章の切り替えは、戻り切るまでカメラが待つ（holdOf）', () => {
  assert.equal(holdOf(1, 2), 0);
  const hold = holdOf(2, 3);
  assert.ok(hold > 0);
  const ev = [{t: 0, to: explodeOf(2)}, {t: 100, to: explodeOf(3)}];
  const hi = liftsAt(ev, 100 + hold, [0, 0, 0, 0, 0]).lifts;
  hi.forEach((v) => near(v, 0, 1e-9, 'back in'));
});

test('scene clock: 章を押すと PRE だけ待ち、終わると HOLD だけ止まってから繰り返す', () => {
  assert.equal(sceneClock('hop', 1.0, PRE), 0);
  near(sceneClock('hop', SCENES.hop.dur + HOLD + 0.5), 0.5, 1e-9, 'loops');
  near(sceneClock('cool', 100), 100, 1e-9, 'endless');
});

test('字幕: 場面ごとに 1 行、核心の言い方を含む', () => {
  assert.match(captionOf('six', 9), /スイッチは無い/);
  assert.match(captionOf('hop', 9), /6 回/);
  assert.match(captionOf('wrap', 9), /3 回ではなく 1 回/);
  assert.match(captionOf('ocs', 9), /8×8×4/);
  assert.match(captionOf('swap', 9), /予備/);
  assert.match(captionOf('pod', 1), /9,216/);
  assert.match(captionOf('vs', 9), /スイッチ 1 段/);
  assert.match(captionOf('out', 1), /48 倍/);
  assert.match(captionOf('power', 1), /416 V/);
  assert.match(captionOf('cool', 1), /CDU/);
});

console.log(`\n${count} tests passed`);
