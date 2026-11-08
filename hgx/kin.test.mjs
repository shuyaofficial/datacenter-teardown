// node hgx/kin.test.mjs — checks hgx-shared/kin.js against the hand-worked numbers in hgx/refs.md 「検算」.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gpuCount as nvGpuCount, ringMs as nvRingMs, SPEC as NV} from '../nvl72-shared/kin.js';
import {
  airCfm,
  airDT,
  airM3s,
  airWaterRatio,
  bezelAt,
  boxOutGB,
  cacheTB,
  CHAPTERS,
  chipFor,
  cfmToM3s,
  clusterKW,
  clusterU,
  coreCount,
  DT_SRC,
  fanAt,
  gaugesAt,
  gpuSidePorts,
  hbmTotalGB,
  hbmTotalTBs,
  heatW,
  heightMM,
  hierAt,
  hierMs,
  hopAt,
  inDomain,
  inDomainFrac,
  inMs,
  inOutRatio,
  inSentGB,
  installedKW,
  kwPerGpu,
  LAYERS,
  layerAt,
  liftsAt,
  linkGBs,
  linksPerChip,
  linkTo,
  netBothTBs,
  netOneWayGBs,
  nicGBs,
  nvl72KwPerGpu,
  nvl72Ms,
  nvlinkTotalTBs,
  osfpOf,
  others,
  outMs,
  outSentGB,
  perRackBySpace,
  perRackOf,
  powerAt,
  psuAmps,
  psuLoadKW,
  rackAt,
  racksFor,
  railsAt,
  route,
  SCENE_IDS,
  SCENES,
  snapT,
  SPEC,
  switchSidePorts,
  usableKW,
  vs72At,
  vsRatio,
  waterLpm,
  airAt,
} from '../hgx-shared/kin.js';
import {captionOf, CH, dashes, DASH, dimmXs, fanPose, GT, hierBeads, hopLegs, HOLD, insidePath, MB, ML, MID, nicOf, PRE, powerPaths, PSU, sceneClock, wallBeads, wallPath} from '../hgx-shared/flow.js';
import {beatsOf, bezelEventsOf, DURATION, explodeEventsOf, explodeOf, holdOf, sceneTAt, SCRIPT, stateAtScript} from '../hgx-shared/script.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`ok  ${name}`);
};

// ------------------------------------------------------------ refs.md 「検算」
test('HBM の合計: 8 × 180 GB = 1,440 GB、8 × 8 TB/s = 64 TB/s（出典と合う）', () => {
  assert.equal(hbmTotalGB(), 1440);
  assert.equal(hbmTotalGB(), SPEC.hbm.totalGB);
  assert.equal(hbmTotalTBs(), 64);
  assert.equal(hbmTotalTBs(), SPEC.hbm.totalTBs);
});

test('ポートの数が合う: GPU 8 × 18 = 144、NVSwitch 2 × 72 = 144、1 チップへ 9 本', () => {
  assert.equal(gpuSidePorts(), 144);
  assert.equal(switchSidePorts(), 144);
  assert.equal(linksPerChip(), 9);
  // every chip port used exactly once
  const used = new Set();
  for (let g = 0; g < 8; g++)
    for (let l = 0; l < 18; l++) {
      const {chip, port} = linkTo(g, l);
      assert.ok(chip < 2 && port < 72);
      const key = `${chip}:${port}`;
      assert.ok(!used.has(key), `port ${key} twice`);
      used.add(key);
    }
  assert.equal(used.size, 144);
  for (let g = 0; g < 8; g++) for (const c of [0, 1]) assert.equal(Array.from({length: 18}, (_, l) => linkTo(g, l)).filter((x) => x.chip === c).length, 9);
});

test('NVLink の合計: 8 × 1.8 TB/s = 14.4 TB/s、1 本 100 GB/s', () => {
  near(nvlinkTotalTBs(), 14.4, 1e-9, 'total');
  near(nvlinkTotalTBs(), SPEC.nvlink.totalTBs, 1e-9, 'source');
  near(linkGBs(), 100, 1e-9, 'link');
});

test('NVL72 と共通の値（NVLink 5・NVSwitch のポート・ConnectX-7）は nvl72/refs.md と同じ', () => {
  assert.equal(SPEC.nvlink.linksPerGpu, NV.nvlink.linksPerGpu);
  assert.equal(SPEC.nvlink.gpuTBs, NV.nvlink.gpuTBs);
  assert.equal(SPEC.nvlink.portsPerChip, NV.nvlink.portsPerChip);
  assert.equal(SPEC.net.cx7Gbps, NV.cx7Gbps);
});

test('1 段で届く: 8 × 7 = 56 組すべてで通る NVSwitch は 1 個', () => {
  let pairs = 0;
  for (let a = 0; a < 8; a++)
    for (let b = 0; b < 8; b++) {
      if (a === b) continue;
      const r = route(a, b);
      assert.equal(r.hops, 1);
      assert.equal(r.chips.length, 1);
      const c = r.chips[0];
      assert.equal(linkTo(a, c * 9).chip, c);
      assert.equal(linkTo(b, c * 9).chip, c);
      pairs++;
    }
  assert.equal(pairs, 56);
});

test('箱の中と外の差: 1.8 TB/s ÷ 100 GB/s = 18 倍（NVL72 と同じ比）', () => {
  near(nicGBs(), 100, 1e-9, 'nic');
  near(inOutRatio(), 18, 1e-9, 'ratio');
});

test('ネットワークの帯域: 8 × 400 Gb/s = 片方向 400 GB/s、双方向 0.8 TB/s（出典と合う）', () => {
  near(netOneWayGBs(), 400, 1e-9, 'one way');
  near(netBothTBs(), 0.8, 1e-12, 'both');
  near(netBothTBs(), SPEC.net.productTBs, 1e-12, 'source');
});

test('72 個のうち箱の中の相手: 7 / 71 = 9.9 %', () => {
  assert.equal(inDomain(), 7);
  assert.equal(others(), 71);
  near(inDomainFrac() * 100, 9.9, 0.05, 'percent');
});

test('all-reduce: 中 1.75 GB・1.944 ms、外 0.2222 GB・4.444 ms、1 台から外へ 1.778 GB、合計 6.389 ms', () => {
  near(inSentGB(), 1.75, 1e-12, 'in GB');
  near(inMs(), 1.944, 0.0005, 'in ms');
  near(outSentGB(), 0.2222, 0.00005, 'out GB');
  near(outMs(), 4.444, 0.0005, 'out ms');
  near(boxOutGB(), 1.778, 0.0005, 'box out');
  near(hierMs(), 6.389, 0.0005, 'total');
});

test('NVL72 のリング 2.191 ms は nvl72-shared/kin.js から読む（約 2.9 倍）', () => {
  near(nvl72Ms(), nvRingMs(), 1e-12, 'read from nvl72');
  near(nvl72Ms(), 2.191, 0.0005, 'value');
  near(vsRatio(), 2.9, 0.05, 'ratio');
  const v = vs72At(100);
  near(v.dgxMs, hierMs(), 1e-12, 'dgx bar');
  near(v.nvMs, nvl72Ms(), 1e-12, 'nvl72 bar');
  assert.equal(v.nvOutGB, 0);
  near(v.dgxOutGB, 1.778, 0.0005, 'out per box');
});

test('電源: 5 × 3.3 = 16.5 kW で 14.3 kW をまかない、積んだのは 6 × 3.3 = 19.8 kW', () => {
  near(usableKW(), 16.5, 1e-9, 'usable');
  near(installedKW(), 19.8, 1e-9, 'installed');
  assert.ok(SPEC.power.kw <= usableKW());
});

test('電源 1 台の電流: 14.3 ÷ 5 = 2.86 kW、200 V で 14.3 A（定格 16 A に収まる）', () => {
  near(psuLoadKW(), 2.86, 1e-9, 'kW');
  near(psuAmps(), 14.3, 1e-9, 'A');
  assert.ok(psuAmps() < SPEC.power.ampsRated);
});

test('発熱: 48,794 BTU/h ÷ 3.412 = 14,300 W', () => {
  near(heatW(), 14300, 1, 'W');
});

test('空冷: 1,550 CFM = 0.7315 m³/s で 16.2 K、10 / 15 / 20 K なら 2,512 / 1,675 / 1,256 CFM', () => {
  near(cfmToM3s(1550), 0.7315, 0.00005, 'm3/s');
  near(airDT(1550), 16.2, 0.05, 'dT');
  near(DT_SRC, airDT(), 1e-12, 'slider start');
  near(airM3s(10), 1.186, 0.0005, '10 K m3/s');
  assert.equal(Math.round(airCfm(10)), 2512);
  assert.equal(Math.round(airCfm(15)), 1675);
  assert.equal(Math.round(airCfm(20)), 1256);
  assert.equal(Math.round(SPEC.air.inletC + DT_SRC), 51);
  near(airAt(0, 4).dTSet, 10, 1e-12, 'slider clamps to 10 K');
  near(airAt(0, 40).dTSet, 20, 1e-12, 'slider clamps to 20 K');
});

test('水と比べる: 14.3 kW を温度差 10 K で 20.5 L/分、体積で約 2,140 倍', () => {
  near(waterLpm(), 20.5, 0.05, 'L/min');
  near(airWaterRatio(), 2140, 10, 'ratio');
});

test('高さ: 10U × 44.45 mm = 444.5 mm（出典の 444 mm と合う）', () => {
  near(heightMM(), 444.5, 1e-9, 'mm');
  assert.ok(Math.abs(heightMM() - SPEC.chassis.h) < 1);
});

test('ラックに何台: 場所 4 台、30 / 40 / 60 kW → 2 / 2 / 4 台', () => {
  assert.equal(perRackBySpace(), 4);
  assert.deepEqual([30, 40, 60].map((l) => perRackOf(l)), [2, 2, 4]);
  near(perRackOf(30) * SPEC.power.kw, 28.6, 1e-9, '30 kW');
  near(perRackOf(60) * SPEC.power.kw, 57.2, 1e-9, '60 kW');
});

test('72 個そろえると: 9 台 128.7 kW・90U、ラック 3 本（30 kW なら 5 本）', () => {
  near(clusterKW(), 128.7, 1e-9, 'kW');
  assert.equal(clusterU(), 90);
  assert.equal(racksFor(perRackBySpace()), 3);
  assert.equal(racksFor(perRackOf(30)), 5);
});

test('GPU 1 個あたりの電力: DGX B200 1.79 kW、NVL72 1.67 kW（nvl72-shared/kin.js から）', () => {
  near(kwPerGpu(), 1.79, 0.005, 'dgx');
  near(nvl72KwPerGpu(), 1.67, 0.005, 'nvl72');
  near(nvl72KwPerGpu(), NV.power.rackKW / nvGpuCount(), 1e-12, 'read');
});

test('ほかの合計: CPU コア 112、キャッシュ 30.72 TB、DIMM 1 枚 64 GB', () => {
  assert.equal(coreCount(), 112);
  near(cacheTB(), 30.72, 1e-9, 'cache');
  assert.equal(dimmXs().length, 32);
});

test('SPEC: refs.md の値（筐体・CPU・ネットワーク・電源・空冷）', () => {
  assert.deepEqual(SPEC.chassis, {u: 10, h: 444, w: 482.3, wSrc2: 482.2, d: 897.1, kg: 142.4});
  assert.equal(SPEC.gpus, 8);
  assert.equal(SPEC.gpu.hbmGB * SPEC.gpus, 1440);
  assert.equal(SPEC.nvlink.switches, 2);
  assert.deepEqual(SPEC.cpu, {name: 'Xeon Platinum 8570', count: 2, cores: 56, ghz: 2.1, ghzMax: 4});
  assert.deepEqual(SPEC.mem, {TB: 2, dimms: 32, maxTB: 4});
  assert.equal(SPEC.net.cx7, 8);
  assert.equal(SPEC.net.osfp * SPEC.net.portsPerOsfp, SPEC.net.cx7);
  assert.equal(SPEC.bf3.count, 2);
  assert.deepEqual(SPEC.storage, {m2: 2, m2TB: 1.92, u2: 8, u2TB: 3.84});
  assert.deepEqual(SPEC.power, {kw: 14.3, btuh: 48794, psus: 6, psuKW: 3.3, need: 5, vMin: 200, vMax: 240, ampsRated: 16});
  assert.equal(SPEC.air.cfm, 1550);
  assert.deepEqual(SPEC.rack.limits, [30, 40, 60]);
});

test('OSFP のポートと GPU の対応: 8 ポートが GPU 0〜7 に 1 個ずつ、GPU 0 は OSFP4 P2', () => {
  assert.deepEqual(Object.values(SPEC.osfpGpu).sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.equal(osfpOf(0), '4P2');
  assert.equal(SPEC.osfpGpu['1P1'], 7);
  assert.equal(nicOf(0).n, 4);
  assert.equal(nicOf(0).p, 'P2');
});

// ------------------------------------------------------------ the box's layout
test('筐体: 部品は壁の中、2 段は重ならない、マザーボードトレイは引き出すと背面より外へ出る', () => {
  near(CH.D, 897.1, 1e-9, 'depth');
  assert.ok(MB.y[1] < PSU.y[0] && PSU.y[1] < GT.board.y[0], 'tray, supplies, GPU board from the floor up');
  assert.ok(GT.sink.y[1] < GT.lid.y[0], 'heatsinks under the lid');
  assert.ok(GT.lid.y[1] <= CH.H);
  assert.ok(MB.z[1] < MID.z && MB.z[0] >= CH.zB, 'the tray stops at the midplane');
  assert.ok(MB.z[1] - MB.pull < CH.zB, 'pulled, the tray clears the back');
  for (const x of [...GT.gpuX.map((x) => Math.abs(x) + GT.sink.w / 2), ...dimmXs().map(Math.abs)]) assert.ok(x < CH.W / 2 - CH.wall);
  // the NVSwitch heatsinks fit between the GPU heatsink columns
  assert.ok(GT.nvsSink.s / 2 < Math.abs(GT.gpuX[0]) - GT.sink.w / 2);
  // DIMMs clear the CPU heatsinks
  for (const cx of ML.cpuX) for (const x of dimmXs()) if (Math.abs(x - cx) < 120) assert.ok(Math.abs(x - cx) > ML.cpuSink.w / 2);
});

test('経路: fan の 2 束は交差せず、hop はチップで折り返し、wall は OSFP4 P2 を通って隣の箱へ', () => {
  const f = fanPose(10);
  assert.equal(f.paths.length, 18);
  const ends = [0, 1].map((c) => f.paths.filter((p) => p.c === c));
  assert.equal(ends[0].length, 9);
  // bundle to chip 1 starts and ends at lower z than the bundle to chip 0
  assert.ok(Math.max(...ends[1].map((p) => p.pts[0][2])) < Math.min(...ends[0].map((p) => p.pts[0][2])));
  assert.ok(Math.max(...ends[1].map((p) => p.pts[1][2])) < Math.min(...ends[0].map((p) => p.pts[1][2])));
  const h = hopLegs();
  assert.equal(h.c, chipFor(0, 5));
  assert.deepEqual(h.A[h.A.length - 1], h.B[0]);
  const w = wallPath();
  const ins = insidePath(0, 0);
  assert.equal(ins[ins.length - 1][0], ML.osfpX[3]);
  assert.equal(ins[ins.length - 1][1], ML.portY.P2);
  assert.ok(Math.max(...w.cable.map((p) => p[1])) > CH.H, 'the cable goes up to the leaf');
  assert.ok(w.inB[w.inB.length - 1][0] > CH.W, 'it ends in the next box');
});

// ------------------------------------------------------------ scenes
test('fan: 18 本が順に伸びて、9 本ずつ 2 個のチップへ', () => {
  assert.equal(fanAt(0).lit, 0);
  assert.equal(fanAt(SCENES.fan.dur).lit, 18);
  assert.deepEqual(fanAt(SCENES.fan.dur).perChip, [9, 9]);
  for (let t = 0; t < SCENES.fan.dur; t += 0.1) assert.ok(fanAt(t + 0.1).lit >= fanAt(t).lit);
});

test('hop: GPU 0 → GPU 5、チップに着くまで 0、通ったあと 1', () => {
  assert.equal(hopAt(0).a, 0);
  assert.equal(hopAt(0).b, 5);
  assert.equal(hopAt(0).hops, 0);
  assert.equal(hopAt(SCENES.hop.dur).hops, 1);
  assert.ok(hopAt(SCENES.hop.dur).done);
  let prev = -1;
  for (let t = 0; t <= SCENES.hop.dur; t += 0.05) {
    const i = hopAt(t).legIndex;
    assert.ok(i >= prev);
    prev = i;
  }
});

test('wall: NVLink 側の粒は外へ出る粒の 18 倍、計器は 18 倍と 7/71', () => {
  const b = wallBeads(20);
  assert.equal(b.ratio, 18);
  near(b.ins.length / b.outs.length, 18 * (1.2 / 4.2), 2, 'beads on the way');
  assert.equal(gaugesAt('wall', 3).outRatio, 18);
  near(gaugesAt('wall', 3).inDomain, 7 / 71, 1e-12, 'in domain');
});

test('rails: 線が伸びてから 7 個が明るくなる', () => {
  assert.equal(railsAt(0).lit, 0);
  assert.equal(railsAt(SCENES.rails.dur).lit, 7);
  assert.equal(railsAt(SCENES.rails.dur).k, 1);
});

test('hier: 段 1 → 2 → 3 で送った量が 1.75 + 0.2222 GB に、時間が 6.389 ms に向かって増える', () => {
  assert.equal(hierAt(0).sentGB, 0);
  assert.equal(hierAt(1).stage, 1);
  assert.equal(hierAt(4).stage, 2);
  assert.equal(hierAt(8).stage, 3);
  for (let t = 0; t < SCENES.hier.dur; t += 0.2) assert.ok(hierAt(t + 0.2).sentGB > hierAt(t).sentGB);
  const e = hierAt(SCENES.hier.dur + 1);
  near(e.sentInGB, 1.75, 1e-12, 'in');
  near(e.sentOutGB, 0.2222, 0.00005, 'out');
  near(e.outGB, 1.778, 0.0005, 'box');
  near(e.ms, 6.389, 0.0005, 'ms');
  near(hierAt(2.5).sentOutGB, 0, 1e-12, 'no outside traffic in stage 1');
  assert.equal(hierBeads(1).ins.length, 72);
  assert.equal(hierBeads(4).outs.length, 72);
});

test('power: 1 台 14.3 A に立ち上がる。rack: 上限を 30 → 60 kW にすると 2 台から 4 台へ', () => {
  assert.equal(powerAt(0).amps, 0);
  near(powerAt(5).amps, 14.3, 1e-9, 'amps');
  near(gaugesAt('power', 5).amps, 14.3, 1e-9, 'gauge');
  const r30 = rackAt(10, 30, 0);
  assert.deepEqual(r30.ins, [1, 1, 0, 0]);
  assert.ok(r30.done);
  const r60 = rackAt(0.2, 60, 2);
  assert.deepEqual(r60.ins.slice(0, 2), [1, 1], 'the boxes in stay in');
  assert.deepEqual(rackAt(10, 60, 2).ins, [1, 1, 1, 1]);
  assert.deepEqual(rackAt(10, 30, 4).ins, [1, 1, 0, 0], 'a lower limit takes boxes out');
  assert.equal(gaugesAt('rack', 3, {limit: 40}).perRack, 2);
});

test('air: 出口の温度差は 0 から設定値へ立ち上がる（live-check が dT の上昇を見る）', () => {
  assert.equal(airAt(0).dT, 0);
  near(airAt(5).dT, DT_SRC, 1e-12, 'held');
  near(gaugesAt('air', 5, {dT: 10}).cfm, airCfm(10), 1e-9, 'cfm');
  for (let t = 0; t < 1.6; t += 0.1) assert.ok(airAt(t + 0.1).dT > airAt(t).dT);
  const p = powerPaths();
  assert.equal(p.on.length, 5);
  assert.equal(p.spare.length, 1);
  const path = [[0, 0, 0], [0, 1000, 0]];
  near(dashes(path, 0.1)[1].a[1] - dashes(path, 0)[1].a[1], DASH.speed * 0.1, 1e-6, 'dashes move');
  assert.deepEqual(dashes(path, 0, 0), dashes(path, 4, 0), 'speed 0 stands still');
});

test('純関数: 同じ入力は同じ出力', () => {
  for (const sc of SCENE_IDS) for (const t of [0, 1.3, 4.7]) assert.deepEqual(gaugesAt(sc, t), gaugesAt(sc, t));
  assert.deepEqual(hierBeads(3.3), hierBeads(3.3));
});

test('reduced motion: snapT は段の頭や終わりに跳ぶ', () => {
  assert.equal(hopAt(snapT('hop', 1.0)).legIndex, hopAt(1.0).legIndex);
  assert.equal(snapT('hier', 3), 2.5);
  assert.equal(snapT('hier', 7), 6.5);
  assert.ok(vs72At(snapT('vs72', 0)).done);
});

// ------------------------------------------------------------ the exploded view, the bezel
test('分解: まず引き出し、上の層（天板 → ヒートシンク → エアバッフル → CPU のヒートシンク）から浮く。戻すときは下から', () => {
  assert.deepEqual(LAYERS, ['pull', 'lid', 'sinks', 'baffle', 'cpuSinks']);
  const ev = [{t: 0, to: explodeOf(2)}];
  const L = (t) => liftsAt(ev, t).lifts;
  assert.ok(L(0.6)[0] > 0.2 && L(0.6)[1] === 0, 'the pull moves first');
  const start = (k) => {
    for (let t = 0; t < 5; t += 0.01) if (layerAt(ev, k, t) > 0.01) return t;
    return 99;
  };
  for (let k = 1; k < 4; k++) assert.ok(start(k) < start(k + 1), `layer ${k} before ${k + 1}`);
  assert.deepEqual(L(5).map((v) => +v.toFixed(6)), [1, 1, 1, 1, 1]);
  const back = [...ev, {t: 5, to: explodeOf(1)}];
  const B = (t) => liftsAt(back, t).lifts;
  assert.ok(B(5.3)[4] < B(5.3)[1], 'closing: the bottom layer first');
  assert.ok(B(5.3)[0] === 1, 'the tray goes in last');
  assert.deepEqual(B(9).map((v) => +v.toFixed(6)), [0, 0, 0, 0, 0]);
});

test('ベゼル: 前からでは付いていて、「ベゼルを外す」で外れ、締めの全景で戻る', () => {
  const ev = bezelEventsOf();
  assert.equal(bezelAt(ev, 1), 0);
  assert.equal(bezelAt(ev, 6), 1);
  assert.equal(bezelAt(ev, DURATION - 0.5), 0);
});

// ------------------------------------------------------------ chapters and the tour
test('章: 7 章、ラボのコマンドは refs.md の表と同じ', () => {
  assert.equal(CHAPTERS.length, 7);
  const refs = fs.readFileSync(new URL('./refs.md', import.meta.url), 'utf8');
  for (const c of CHAPTERS) {
    assert.ok(c.lab.length > 0, `${c.n} has a command`);
    for (const l of c.lab) assert.ok(refs.includes(l.cmd), `${c.n}: ${l.cmd}`);
  }
  assert.deepEqual(CHAPTERS[2].scenes, ['fan', 'hop']);
  assert.deepEqual(CHAPTERS[3].scenes, ['wall', 'rails']);
  assert.deepEqual(CHAPTERS[4].scenes, ['hier', 'vs72']);
  assert.deepEqual(CHAPTERS[5].scenes, ['power', 'rack']);
  assert.deepEqual(CHAPTERS[6].scenes, ['air']);
  // the screen never says which tray is on top (仮定)
  for (const c of CHAPTERS) assert.ok(!/上が GPU|GPU トレイが上|下がマザーボード/.test(c.text));
});

test('ツアー: 70〜90 s、章 1→7→1、10・12・12・14・16・10・10 s、timeline.json は台本と一致', () => {
  assert.ok(DURATION >= 70 && DURATION <= 90);
  const ch = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.chapter);
  assert.deepEqual(ch, [1, 2, 3, 4, 5, 6, 7, 1]);
  const tl = JSON.parse(fs.readFileSync(new URL('../hgx-film/timeline.json', import.meta.url), 'utf8'));
  assert.equal(tl.duration, DURATION);
  assert.deepEqual(tl.beats, beatsOf());
  const at = Object.fromEntries(SCRIPT.filter((e) => e.chapter !== undefined && e.t < DURATION - 5).map((e) => [e.chapter, e.t]));
  const end = SCRIPT[SCRIPT.length - 1].t;
  assert.deepEqual([at[2] - at[1], at[3] - at[2], at[4] - at[3], at[5] - at[4], at[6] - at[5], at[7] - at[6], end - at[7]], [10, 12, 12, 14, 16, 10, 10]);
});

test('ツアー: fan は描き切ってから hop、hop は着いてから章 4、hier は終わってから vs72、vs72 は終わってから章 6', () => {
  const hopPress = SCRIPT.find((e) => e.scene === 'hop').t;
  assert.equal(fanAt(sceneTAt(hopPress - 0.01)).lit, 18);
  assert.ok(hopAt(sceneTAt(SCRIPT.find((e) => e.chapter === 4).t - 0.01)).done);
  assert.ok(hierAt(sceneTAt(SCRIPT.find((e) => e.scene === 'vs72').t - 0.01)).done);
  assert.ok(vs72At(sceneTAt(SCRIPT.find((e) => e.chapter === 6).t - 0.01)).done);
  // the limit press comes after the first 2 boxes are in; the 60 kW state keeps them and adds 2
  const limT = SCRIPT.find((e) => e.limit !== undefined).t;
  const before = stateAtScript(limT - 0.01);
  assert.ok(rackAt(sceneTAt(limT - 0.01), before.limit, before.from).done);
  const after = stateAtScript(limT + 0.01);
  assert.deepEqual([after.limit, after.from], [60, 2]);
  assert.equal(stateAtScript(80).dT, 10);
  assert.deepEqual(explodeEventsOf().map((e) => e.t), [10, 22]);
});

test('ツアー: トレイが戻る章の切り替えは、戻り切るまでカメラが待つ（holdOf）', () => {
  assert.equal(holdOf(1, 2), 0);
  const hold = holdOf(2, 3);
  assert.ok(hold > 0);
  const ev = [{t: 0, to: explodeOf(2)}, {t: 100, to: explodeOf(3)}];
  liftsAt(ev, 100 + hold).lifts.forEach((v) => near(v, 0, 1e-9, 'back in'));
});

test('scene clock: 章を押すと PRE だけ待ち、終わると HOLD だけ止まってから繰り返す', () => {
  assert.equal(sceneClock('hop', 1.0, PRE), 0);
  near(sceneClock('hier', PRE + 3, PRE), 3, 1e-9, 'runs');
  near(sceneClock('hier', SCENES.hier.dur + HOLD + 0.5), 0.5, 1e-9, 'loops');
  near(sceneClock('air', 100), 100, 1e-9, 'endless');
});

test('字幕: 場面ごとに 1 行、核心の言い方を含む', () => {
  assert.match(captionOf('fan', 5), /9 本 × 2/);
  assert.match(captionOf('hop', 2), /スイッチは 1 個/);
  assert.match(captionOf('wall', 1), /18 倍/);
  assert.match(captionOf('rails', 4), /7 個（9\.9 %）/);
  assert.match(captionOf('hier', 10), /6\.389 ms/);
  assert.match(captionOf('vs72', 4), /2\.191 ms/);
  assert.match(captionOf('power', 1), /16\.5 kW/);
  assert.match(captionOf('rack', 5, {limit: 30}), /2 台まで/);
  assert.match(captionOf('air', 1, {dT: 16.2}), /16\.2 K/);
});

console.log(`\n${count} tests passed`);
