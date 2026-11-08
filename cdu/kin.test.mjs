// node cdu/kin.test.mjs — checks cdu-shared/kin.js against the hand-worked numbers in cdu/refs.md 「検算」 1〜14, and the
// layout, the scenes and the tour against the brief.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ashraeClass,
  atdK,
  carryKw,
  CHAPTERS,
  cdusFor,
  cdusN1,
  coolitPerRackKw,
  coolitRacksByFlow,
  coolitRacksByKw,
  cpDropPct,
  designDT,
  dTFor,
  dTForLpmPerKw,
  failoverAt,
  fToC,
  fwsAt,
  fwsDT,
  fwsLossRate,
  fwsRecoverT,
  gaugesAt,
  hotEndK,
  hxProfile,
  hydraulicW,
  intEase,
  kgPerS,
  LAYERS,
  layerAt,
  leakAt,
  liftsAt,
  lmtdK,
  lpm,
  massRatio,
  NEXT_GEN,
  onePumpKw,
  podPerUnitKw,
  psiToBar,
  pumpEff,
  pumpPct,
  rackLiquidExact,
  rackLpm,
  racksAt,
  racksExact,
  racksPerCdu,
  SCENE_IDS,
  SCENES,
  snapT,
  SPEC,
  volRatio,
} from '../cdu-shared/kin.js';
import {along, captionOf, CDU, fwsLoop, HDR, HOLD, HX, hxBeads, leakPose, loopBeads, PARTS, PIPES, PORTS, PRE, PUMP, RACK, rackDrops, rackX, rowPipes, sampleLoop, sceneClock, shadeOf, tcsLoop, TIER_SHIFT} from '../cdu-shared/flow.js';
import {beatsOf, DURATION, explodeEventsOf, explodeOf, holdOf, sceneTAt, SCRIPT, stateAtScript} from '../cdu-shared/script.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`ok  ${name}`);
};
const nvlRefs = fs.readFileSync(new URL('../nvl72/refs.md', import.meta.url), 'utf8');
const refs = fs.readFileSync(new URL('./refs.md', import.meta.url), 'utf8');

// ------------------------------------------------------------ refs.md 「検算」
test('1 NVL72 の第7章と同じ: 120 kW・水・10 K → 2.871 kg/s・172.2 L/分、5 K → 344.5 L/分（nvl72/refs.md の 172・344）', () => {
  near(kgPerS(120, 10, 'water'), 2.871, 0.0005, 'kg/s');
  near(lpm(120, 10, 'water'), 172.2, 0.05, '10 K');
  near(lpm(120, 5, 'water'), 344.5, 0.05, '5 K');
  assert.ok(nvlRefs.includes('約 **172 L/分**') && nvlRefs.includes('344 L/分'), 'nvl72 の値');
  assert.equal(Math.round(lpm(SPEC.nvl72.rackKw, SPEC.nvl72.dT, 'water')), 172);
});

test('2 実際のラック 1 本: 115 kW・PG25・13.9 K → 123.2 L/分（出典9 の最大 130 L/分の内側）、130 L/分なら 13.2 K', () => {
  assert.equal(designDT(), 13.9);
  near(rackLpm(), 123.2, 0.05, 'rack');
  assert.ok(rackLpm() < SPEC.design.qctMaxLpm);
  near(dTFor(115, 130), 13.2, 0.05, 'dT at 130');
});

test('3 不凍液: 比熱 5.5% 下がる、質量 1.058 倍、体積 1.0375 倍、120 kW・10 K で 172.2 → 178.7 L/分', () => {
  near(cpDropPct(), 5.5, 0.05, 'cp');
  near(massRatio(), 1.058, 0.0005, 'mass');
  near(volRatio(), 1.0375, 0.00005, 'vol');
  near(lpm(120, 10, 'pg25'), 178.7, 0.05, 'pg25');
  near(lpm(120, 10, 'pg25') / lpm(120, 10, 'water'), volRatio(), 1e-12, 'ratio');
});

test('4 600 kW の CDU で何本: 5.22 → 5 本。8 本の列は 918.7 kW で 2 台、N+1 で 3 台。16 本に 3 台なら 1 台 918.7 kW', () => {
  near(racksExact(), 5.22, 0.005, 'exact');
  assert.equal(racksPerCdu(), 5);
  near(rackLiquidExact(), 114.84, 1e-9, '132 × 87%');
  near(SPEC.design.rowRacks * rackLiquidExact(), 918.72, 1e-6, '8 本');
  assert.equal(cdusFor(8), 2);
  assert.equal(cdusN1(8), 3);
  near(podPerUnitKw(), 918.72, 1e-6, 'pod');
});

test('5 CoolIT の「12 ラック」: 166.7 kW/本、kW で 17.4 本、流量で 17.2 本', () => {
  near(coolitPerRackKw(), 166.7, 0.05, 'per rack');
  near(coolitRacksByKw(), 17.4, 0.05, 'by kW');
  near(coolitRacksByFlow(), 17.2, 0.05, 'by flow');
});

test('6 ポンプの電力: Vertiv 2 台 1.5%・1 台 0.75%、CoolIT 0.61%、nVent 2.8%、どれも 3% 未満', () => {
  near(pumpPct(SPEC.pump.kw2, SPEC.cdu.kw), 1.5, 1e-9, '2 台');
  near(pumpPct(SPEC.pump.kw1, SPEC.cdu.kw), 0.75, 1e-9, '1 台');
  near(pumpPct(SPEC.others.coolit2000.powerKw, SPEC.others.coolit2000.kw), 0.61, 0.005, 'CoolIT');
  near(pumpPct(SPEC.others.nvent800.powerKw, SPEC.others.nvent800.kw), 2.8, 0.05, 'nVent');
  for (const [p, k] of [[9, 600], [12.24, 2000], [22.2, 800]]) assert.ok(pumpPct(p, k) < 3);
  assert.equal(SPEC.cdu.powerKw, SPEC.pump.kw2);
});

test('7 ポンプが液に与える力: 450 L/分 × 2.25 bar = 1,688 W、電気 4.5 kW の約 38%', () => {
  near(hydraulicW(450, 2.25), 1687.5, 1e-9, 'W');
  assert.equal(Math.round(hydraulicW(SPEC.pump.maxLpm1, SPEC.pump.bar1)), 1688);
  near(pumpEff() * 100, 37.5, 1e-9, '%');
  assert.equal(Math.round(pumpEff() * 100), 38);
});

test('8 1.5 L/分/kW: PG25 で 9.93 K、水で 9.57 K。Vertiv 900 ÷ 600 = 1.5、CoolIT 1.06 L/分/kW で 14.0 K', () => {
  near(dTForLpmPerKw(1.5, 'pg25'), 9.93, 0.005, 'pg25');
  near(dTForLpmPerKw(1.5, 'water'), 9.57, 0.005, 'water');
  near(SPEC.pump.maxLpm2 / SPEC.cdu.kw, 1.5, 1e-12, 'Vertiv');
  near(SPEC.others.coolit2000.lpm / SPEC.others.coolit2000.kw, 1.06, 0.005, 'CoolIT L/分/kW');
  near(dTFor(SPEC.others.coolit2000.kw, SPEC.others.coolit2000.lpm), 14.0, 0.05, 'CoolIT K');
});

test('9 冗長を取ると流量が半分: 1 台 450 L/分で 13.9 K → 420 kW、10 K → 302 kW。600 kW には 2 台同時が要る', () => {
  near(onePumpKw(), 420, 0.5, '13.9 K');
  near(onePumpKw(10), 302, 0.5, '10 K');
  assert.ok(onePumpKw() < SPEC.cdu.kw);
  assert.ok(carryKw(SPEC.pump.maxLpm2, designDT()) >= SPEC.cdu.kw);
  // 5 本（575 kW）の流量 616 L/分は 1 台の上限を超える
  assert.ok(5 * rackLpm() > SPEC.pump.maxLpm1);
});

test('10 熱交換器（向かい流れ）: 熱い端 6.7 K、冷たい端 2.8 K（ATD）、交差しない、対数平均 4.47 K', () => {
  assert.equal(hotEndK(), 6.7);
  assert.equal(atdK(), 2.8);
  near(lmtdK(), 4.47, 0.005, 'LMTD');
  const top = hxProfile(0);
  const bot = hxProfile(1);
  near(top.tcs, 53.9, 1e-9, 'tcs in');
  near(top.fws, 47.2, 1e-9, 'fws out');
  near(bot.tcs, 40.0, 1e-9, 'tcs out');
  near(bot.fws, 37.2, 1e-9, 'fws in');
  for (let x = 0; x <= 1; x += 0.05) assert.ok(hxProfile(x).diff >= 2.8 - 1e-9 && hxProfile(x).diff <= 6.7 + 1e-9, 'never cross');
  // the mean of the local difference along the plate is the LMTD
  let m = 0;
  const N = 2000;
  for (let k = 0; k < N; k++) m += hxProfile((k + 0.5) / N).diff / N;
  near(m, lmtdK(), 0.001, 'mean diff');
});

test('11 2 つの輪の熱は同じ: 114.84 kW を施設の水（水 10.0 K）で 164.8 L/分、冷却液（PG25 13.9 K）で 123.0 L/分', () => {
  assert.equal(fwsDT(), 10.0);
  near(lpm(rackLiquidExact(), fwsDT(), 'water'), 164.8, 0.05, 'FWS');
  near(lpm(rackLiquidExact(), designDT(), 'pg25'), 123.0, 0.05, 'TCS');
});

test('12 施設の水が止まったら（目安）: 800 ÷ (100 × 1.02 × 3.95) = 1.99 K/秒、10 K に約 5 秒', () => {
  near(fwsLossRate(), 1.99, 0.005, 'K/s');
  near(10 / fwsLossRate(), 5.0, 0.05, '10 K');
  const w = fwsAt(fwsRecoverT() - 1e-6);
  near(w.rise, 10, 1e-4, 'rises 10 K');
  near(w.secs, 10 / fwsLossRate(), 1e-4, 'in about 5 s');
  near(fwsAt(fwsRecoverT() + 5).tcsSupply, 40.0, 1e-9, 'back');
});

test('13 温度の換算: 104 °F = 40.00 ℃、129 °F = 53.89 ℃、99 °F = 37.22 ℃、117 °F = 47.22 ℃、35 psi = 2.41 bar', () => {
  near(fToC(104), 40.0, 0.005, '104');
  near(fToC(129), 53.89, 0.005, '129');
  near(fToC(99), 37.22, 0.005, '99');
  near(fToC(117), 47.22, 0.005, '117');
  near(psiToBar(35), 2.41, 0.005, 'psi');
  const {F, tcs, fws} = SPEC.design;
  assert.equal(Math.round(fToC(F.tcsSupply) * 10) / 10, tcs.supply);
  assert.equal(Math.round(fToC(F.tcsReturn) * 10) / 10, tcs.ret);
  assert.equal(Math.round(fToC(F.fwsSupply) * 10) / 10, fws.supply);
  assert.equal(Math.round(fToC(F.fwsReturn) * 10) / 10, fws.ret);
});

test('14 ASHRAE: 施設の水 37.2 ℃は W40、Vertiv の W45 の内側', () => {
  assert.equal(ashraeClass(SPEC.design.fws.supply), 'W40');
  const lim = Object.fromEntries(SPEC.ashrae);
  assert.ok(SPEC.design.fws.supply <= lim[SPEC.cdu.fwsClass]);
  assert.equal(ashraeClass(46), 'W+');
});

test('SPEC: refs.md の値（CDU・ポンプ・部品・冷却液）', () => {
  assert.deepEqual([SPEC.cdu.h, SPEC.cdu.w, SPEC.cdu.d, SPEC.cdu.dryKg, SPEC.cdu.wetKg, SPEC.cdu.kw], [2000, 600, 1200, 480, 550, 600]);
  assert.deepEqual([SPEC.pump.maxLpm1, SPEC.pump.bar1, SPEC.pump.maxLpm2, SPEC.pump.bar2, SPEC.pump.kw1, SPEC.pump.kw2], [450, 2.25, 900, 1.3, 4.5, 9.0]);
  assert.equal(SPEC.parts.makeupL, 10);
  assert.equal(SPEC.parts.levelSensors, 3);
  assert.equal(SPEC.parts.fwsFilterUm, 500);
  assert.deepEqual(SPEC.parts.tcsFilterUm, [25, 50]);
  assert.equal(Object.values(SPEC.parts.tempSensors).reduce((a, b) => a + b), 6);
  assert.equal(Object.values(SPEC.parts.pressureSensors).reduce((a, b) => a + b), 4);
  assert.equal(SPEC.parts.flowMeters, 2);
  assert.deepEqual([SPEC.fluid.pg25.cp, SPEC.fluid.pg25.rho, SPEC.fluid.pg25.freezeC, SPEC.fluid.water.cp], [3.95, 1.02, -10, 4.18]);
  // the room's CDU and temperatures are the same
  const room = fs.readFileSync(new URL('../room/refs.md', import.meta.url), 'utf8');
  assert.ok(room.includes('0.600 × 1.200 × 2.000') && room.includes('40.0 ℃') && room.includes('53.9 ℃') && room.includes('37.2 ℃') && room.includes('47.2 ℃'));
  assert.ok(room.includes('#7fcdd2') && room.includes('#0b6f75'));
});

// ------------------------------------------------------------ the layout
test('形: 部品は箱の中、配管は部品にめり込まない、ラック 5 本は CDU の右に並ぶ', () => {
  const inner = CDU.w / 2 - CDU.wall;
  // the HX, the pumps, the tank, the electrical panel inside the walls and under the roof
  assert.ok(HX.x1 < inner && PUMP.x[1] + PUMP.voluteR < inner + 1e-9 && PARTS.elec.x[1] < inner);
  assert.ok(PARTS.elec.y[1] < CDU.h - CDU.roof && PARTS.tank.y[1] < CDU.h - CDU.roof);
  assert.ok(PARTS.elec.z[1] < CDU.d / 2 - CDU.door.t);
  // every pipe point inside the box (or at the roof's ports)
  for (const p of Object.values(PIPES).flat()) {
    assert.ok(Math.abs(p[0]) + 28 <= inner + 1e-9, `x ${p}`);
    assert.ok(p[2] - 28 >= -CDU.d / 2 + CDU.wall && p[2] + 28 <= CDU.d / 2 - CDU.door.t, `z ${p}`);
  }
  // the pumps' pipes clear the HX and the HX nozzles meet the HX
  assert.equal(PIPES.tcsOut[0][1], HX.y0);
  assert.equal(PIPES.hxIn[PIPES.hxIn.length - 1][1], HX.y1);
  // the filter and the check valve on the same pump do not touch (radii vs. centre distance)
  assert.ok(Math.abs(-110 - -190) > PARTS.filter.r + PARTS.check.r);
  // the tank clears the risers at x = ±140
  assert.ok(140 - PARTS.tank.r > 28);
  // racks: next to each other, 20 mm apart, the first 20 mm right of the CDU
  assert.equal(rackX(0) - RACK.w / 2 - CDU.w / 2, 20);
  for (let i = 1; i < 5; i++) assert.equal(rackX(i) - rackX(i - 1), RACK.w + RACK.gap);
  // the fronts line up
  assert.equal(CDU.z + CDU.d / 2, RACK.d / 2);
  // ports on the roof map onto the headers
  const rp = rowPipes();
  assert.equal(rp.supply[0][2], HDR.sZ);
  assert.equal(rp.ret[2][2], HDR.rZ);
  assert.ok(HDR.sY > RACK.h && HDR.rY > HDR.sY, 'headers over the row');
  near((HDR.sY + HDR.rY) / 2 - RACK.h, SPEC.headerDropM * 1000, 60, '列の上 約 0.3 m');
  // the return header passes behind the supply drops, the supply header in front of the return drops
  const d = rackDrops(0);
  assert.ok(Math.abs(d.supply[3][2] - HDR.rZ) < 2 * HDR.r + 1 && d.supply[0][1] < HDR.rY - HDR.r, 'supply drop stops under the return header');
  assert.ok(Math.abs(d.ret[3][2] - HDR.sZ) > 2 * HDR.r, 'return drop clears the supply header');
  // the tiers come out of the front, the furthest first from the top
  assert.ok(TIER_SHIFT.top > TIER_SHIFT.mid && TIER_SHIFT.mid > TIER_SHIFT.bot);
  assert.ok(HX.z0 + TIER_SHIFT.mid > CDU.d / 2 - 200, 'the HX comes out to the doors');
});

test('ループ: 冷却液は閉じた輪で熱交換器 → ラック → ポンプ → 熱交換器、施設の水は壁から壁へ。2 つは同じ点を通らない', () => {
  for (const pump of ['A', 'B']) {
    const L = tcsLoop(2, pump);
    assert.ok(L.closed);
    assert.deepEqual(L.pts[0], L.pts[L.pts.length - 1]);
    // the temperature: supply 40.0 until the rack, return 53.9 after, back to 40 through the HX
    assert.ok(Math.min(...L.T) >= 40 - 1e-9 && Math.max(...L.T) <= 53.9 + 1e-9);
    // it passes the chosen pump's volute centre
    const x = pump === 'A' ? PUMP.x[0] : PUMP.x[1];
    assert.ok(L.pts.some((p) => p[0] === x && p[1] === PUMP.y), pump);
  }
  const F = fwsLoop();
  assert.ok(!F.closed);
  assert.ok(Math.min(...F.T) >= 37.2 - 1e-9 && Math.max(...F.T) <= 47.2 + 1e-9);
  // the two liquids never share a point: every TCS vertex is at least 40 mm from every FWS vertex
  const L = tcsLoop(0);
  for (const a of L.pts) for (const b of F.pts) assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= 40, `${a} / ${b}`);
  // beads move along; shade follows the temperature
  const b0 = loopBeads(L, 0);
  const b1 = loopBeads(L, 0.1);
  assert.equal(b0.length, b1.length);
  assert.notDeepEqual(b0[0].p, b1[0].p);
  assert.equal(shadeOf('tcs', 40), 0);
  assert.equal(shadeOf('tcs', 53.9), 1);
  assert.equal(shadeOf('fws', 37.2), 0);
  assert.equal(shadeOf('fws', 47.2), 1);
  near(sampleLoop(L, 0).T, 53.9, 0.5, 'HX inlet is hot');
});

test('熱交換器の図: 冷却液は下へ、施設の水は上へ（向かい流れ）', () => {
  const a = hxBeads(0);
  const b = hxBeads(0.2);
  assert.equal(a.length, 40);
  const tcs = a.findIndex((q) => q.kind === 'tcs' && q.y > 0 && q.y < 300);
  assert.ok(b[tcs].y < a[tcs].y, 'down');
  const fws = a.findIndex((q) => q.kind === 'fws' && q.y < 0 && q.y > -300);
  assert.ok(b[fws].y > a[fws].y, 'up');
});

// ------------------------------------------------------------ scenes
test('flow: 13.9 K で 123 L/分、7 K で約 245 L/分、スライダーは 5〜20 K、場面の頭で 0 から数え上がる', () => {
  near(gaugesAt('flow', 5).flowLpm, 123.2, 0.05, '13.9');
  near(gaugesAt('flow', 5, {dT: 7}).flowLpm, 244.6, 0.1, '7 K');
  near(gaugesAt('flow', 5, {dT: 2}).dT, 5, 1e-12, 'min');
  near(gaugesAt('flow', 5, {dT: 40}).dT, 20, 1e-12, 'max');
  assert.equal(gaugesAt('flow', 0).flowLpm, 0);
  near(gaugesAt('flow', 5, {dT: 6.95}).flowLpm / gaugesAt('flow', 5, {dT: 13.9}).flowLpm, 2, 1e-9, '半分で倍');
});

test('glycol: 同じ熱・同じ温度差で PG25 は水の 1.0375 倍、凍る温度 0 → −10 ℃', () => {
  near(gaugesAt('glycol', 5, {fluid: 'pg25'}).flowLpm / gaugesAt('glycol', 5, {fluid: 'water'}).flowLpm, 1.0375, 1e-4, 'ratio');
  assert.equal(SPEC.fluid.water.freezeC, 0);
  assert.equal(SPEC.fluid.pg25.freezeC, -10);
});

test('racks: 1 本ずつつながり 5 本目で 575 kW / 600 kW、そのあと「2 台目」', () => {
  assert.equal(racksAt(0).n, 0);
  assert.equal(racksAt(1).n, 2);
  const end = racksAt(SCENES.racks.dur);
  assert.equal(end.n, 5);
  assert.equal(end.kw, 575);
  assert.ok(end.fill <= 1 && end.fill > 0.95);
  assert.ok(end.ghost);
  assert.ok((end.n + 1) * SPEC.design.rackLiquidKw > SPEC.cdu.kw, '6 本目は入らない');
  for (let t = 0; t < 4; t += 0.1) assert.ok(racksAt(t + 0.1).n >= racksAt(t).n);
});

test('pumps: 2 台運転 9.0 kW・1.5%、ほかの場面は 1 台運転 4.5 kW・0.75%', () => {
  const g = gaugesAt('pumps', 2);
  assert.equal(g.pumpKw, 9);
  near(g.pumpPct, 1.5, 1e-9, '%');
  assert.equal(g.pumpB, 1);
  assert.equal(gaugesAt('loops', 2).pumpKw, 4.5);
  near(gaugesAt('loops', 2).pumpPct, 0.75, 1e-9, '1 台');
});

test('failover: A が故障 → B が回り出す。流量はいったん下がって 450 L/分に戻る。A の角度は止まる', () => {
  assert.equal(failoverAt(0).active, 'A');
  assert.equal(failoverAt(0.5).fault, false);
  assert.equal(failoverAt(1).fault, true);
  assert.equal(failoverAt(3).active, 'B');
  const lows = [];
  for (let t = 0; t <= 3; t += 0.05) lows.push(failoverAt(t).lpm);
  assert.ok(Math.min(...lows) < 0.5 * SPEC.pump.maxLpm1, 'dips');
  near(failoverAt(3).lpm, 450, 1e-9, 'back');
  near(failoverAt(3).kw, onePumpKw(), 1e-9, '420 kW');
  near(failoverAt(4).angA, failoverAt(3).angA, 1e-9, 'A stands still');
  assert.ok(failoverAt(4).angB > failoverAt(3).angB, 'B turns');
  near(intEase(2, 1, 1.5), 0.25 + 0.5, 1e-12, 'integral');
  assert.equal(gaugesAt('failover', 3).alarm, 'ポンプ A 故障');
});

test('leak: 落ちて、広がって、センサー → 警報 → 2 つの分かれ道', () => {
  assert.equal(leakAt(0).sensor, false);
  assert.ok(leakAt(2.4).sensor && !leakAt(2.4).alarm);
  assert.ok(leakAt(2.7).alarm);
  near(leakAt(4).branch, 1, 1e-9, 'branch');
  const p0 = leakPose(0.6);
  const p1 = leakPose(1.0);
  assert.ok(p1.drop[1] < p0.drop[1], 'falls');
  // the puddle reaches the sensor
  const end = leakPose(4);
  assert.ok(end.puddleC[2] + end.puddleR >= PARTS.sensor.z - 30);
  assert.ok(end.drop[1] >= CDU.tray.y, 'not under the tray');
  assert.equal(gaugesAt('leak', 3).alarm, '漏液');
});

test('fwsloss: 冷却液の行きが 40.0 → 50.0 ℃へ 1 秒に約 2 K、蓄熱と UPS で戻る', () => {
  near(gaugesAt('fwsloss', 0).tcsSupply, 40, 1e-9, 'start');
  const mid = fwsAt(2.5);
  near(mid.tcsSupply - 40, 2 * fwsLossRate(), 1e-9, '2 s');
  assert.equal(mid.flow, 0);
  assert.ok(fwsAt(fwsRecoverT() + 0.1).rescue);
  assert.equal(gaugesAt('fwsloss', 2).alarm, '施設の水 流量低下');
});

test('純関数: 同じ入力は同じ出力', () => {
  for (const sc of SCENE_IDS) for (const t of [0, 1.3, 4.7]) assert.deepEqual(gaugesAt(sc, t), gaugesAt(sc, t));
  assert.deepEqual(loopBeads(tcsLoop(1), 3.3), loopBeads(tcsLoop(1), 3.3));
});

test('reduced motion: snapT は段の頭に跳ぶ', () => {
  assert.equal(snapT('loops', 1.2), 1.0);
  assert.equal(snapT('failover', 1.0), 0.8);
  assert.equal(snapT('leak', 2.0), 1.1);
  assert.equal(racksAt(snapT('racks', 1.2)).n, racksAt(1.2).n);
});

test('along: 折れ線の長さで進む', () => {
  assert.deepEqual(along([[0, 0, 0], [10, 0, 0], [10, 10, 0]], 0.75), [10, 5, 0]);
});

test('扉と段: 扉が先に開き、上段 → 中段 → 下段の順にずれる。戻すときは下から、扉は最後', () => {
  assert.deepEqual(LAYERS, ['doors', 'top', 'mid', 'bot']);
  const ev = [{t: 0, to: explodeOf(2)}];
  const L = (t) => liftsAt(ev, t).lifts;
  assert.ok(L(0.5)[0] > 0.2 && L(0.5)[1] === 0, 'the doors first');
  const start = (k) => {
    for (let t = 0; t < 5; t += 0.01) if (layerAt(ev, k, t) > 0.01) return t;
    return 99;
  };
  for (let k = 1; k < 3; k++) assert.ok(start(k) < start(k + 1));
  assert.deepEqual(L(5).map((v) => +v.toFixed(6)), [1, 1, 1, 1]);
  const back = [...ev, {t: 5, to: explodeOf(1)}];
  const B = (t) => liftsAt(back, t).lifts;
  assert.ok(B(5.3)[3] < B(5.3)[1], 'closing: the bottom first');
  assert.ok(B(5.3)[0] === 1, 'the doors last');
  assert.deepEqual(B(9).map((v) => +v.toFixed(6)), [0, 0, 0, 0]);
});

// ------------------------------------------------------------ chapters and the tour
test('章: 7 章、「実機で見るには」は refs.md の表と同じ、脚注は「次の世代」の 3 行', () => {
  assert.equal(CHAPTERS.length, 7);
  for (const c of CHAPTERS) {
    assert.ok(refs.includes(c.lab.where), `${c.n}: ${c.lab.where}`);
    assert.ok(refs.includes(c.lab.values), `${c.n}: ${c.lab.values}`);
    assert.ok(c.text.length <= 190, `${c.n}: text is ${c.text.length} chars`);
  }
  assert.deepEqual(CHAPTERS[2].scenes, ['loops', 'hx']);
  assert.deepEqual(CHAPTERS[3].scenes, ['flow', 'glycol', 'racks']);
  assert.deepEqual(CHAPTERS[5].scenes, ['failover', 'leak', 'fwsloss']);
  assert.equal(NEXT_GEN.length, 3);
  // the chapter buttons and the scene buttons never share a label (the live check clicks by exact text)
  const labels = [...CHAPTERS.map((c) => c.name), ...SCENE_IDS.map((s) => SCENES[s].name), ...CHAPTERS.flatMap((c) => (c.subs ?? []).map((s) => s.label))];
  assert.equal(new Set(labels).size, labels.length);
});

test('ツアー: 70〜90 s、章 1→7→1、timeline.json は台本と一致', () => {
  assert.ok(DURATION >= 70 && DURATION <= 90);
  const ch = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.chapter);
  assert.deepEqual(ch, [1, 2, 3, 4, 5, 6, 7, 1]);
  const tl = JSON.parse(fs.readFileSync(new URL('../cdu-film/timeline.json', import.meta.url), 'utf8'));
  assert.equal(tl.duration, DURATION);
  assert.deepEqual(tl.beats, beatsOf());
  const at = Object.fromEntries(SCRIPT.filter((e) => e.chapter !== undefined && e.t < DURATION - 5).map((e) => [e.chapter, e.t]));
  // the brief's lengths 10, 12, 14, 16, 6, 16, 8 s; chapter 6 takes 18 s so fwsloss can rise 10 K at about 2 K/s
  assert.deepEqual([at[2] - at[1], at[3] - at[2], at[4] - at[3], at[5] - at[4], at[6] - at[5], at[7] - at[6]], [10, 12, 14, 16, 6, 18]);
});

test('ツアー: 7 K で約 245 L/分、水に切り替えて戻す、5 本目で棒が埋まる、B が引き継いでから漏れ、10 K 上がってから章 7', () => {
  const g = (t) => gaugesAt(stateAtScript(t).scene, sceneTAt(t), {dT: stateAtScript(t).dT, fluid: stateAtScript(t).fluid});
  near(g(41).flowLpm, 244.6, 0.1, '7 K');
  assert.equal(stateAtScript(45).fluid, 'water');
  assert.equal(stateAtScript(47).fluid, 'pg25');
  assert.equal(g(51.9).racks, 5);
  assert.equal(g(63.4).activePump, 'B');
  assert.ok(g(68.9).alarm === '漏液');
  near(g(75.9).tcsSupply, 40, 0.05, 'back to 40 before chapter 7');
  const maxT = Math.max(...Array.from({length: 70}, (_, i) => g(69 + i * 0.1).tcsSupply));
  near(maxT, 50, 0.2, 'rose 10 K');
  assert.deepEqual(explodeEventsOf().map((e) => e.t), [10, 22, 36, 52, 76]);
});

test('ツアー: 段が戻る章の切り替えは、戻り切るまでカメラが待つ（holdOf）', () => {
  assert.equal(holdOf(1, 2), 0);
  const h = holdOf(2, 3);
  assert.ok(h > 0);
  const ev = [{t: 0, to: explodeOf(2)}, {t: 100, to: explodeOf(3)}];
  const at = liftsAt(ev, 100 + h).lifts;
  for (let k = 1; k < 4; k++) near(at[k], 0, 1e-9, `tier ${k}`);
  near(at[0], 1, 1e-9, 'doors stay open');
});

test('scene clock: 章を押すと PRE だけ待ち、終わると HOLD だけ止まってから繰り返す', () => {
  assert.equal(sceneClock('failover', 1.0, PRE), 0);
  near(sceneClock('leak', PRE + 3, PRE), 3, 1e-9, 'runs');
  near(sceneClock('leak', SCENES.leak.dur + HOLD + 0.5), 0.5, 1e-9, 'loops');
  near(sceneClock('loops', 100), 100, 1e-9, 'endless');
});

test('字幕: 場面ごとに 1 行、核心の言い方を含む', () => {
  assert.match(captionOf('loops', 1), /混ざ|戻る/);
  assert.match(captionOf('hx', 1), /2\.8 K/);
  assert.match(captionOf('flow', 1, {dT: 13.9}), /123 L\/分/);
  assert.match(captionOf('glycol', 1, {fluid: 'pg25'}), /1\.0375/);
  assert.match(captionOf('racks', 4), /2 台目/);
  assert.match(captionOf('pumps', 1), /1\.5%/);
  assert.match(captionOf('failover', 1.5), /待機の B/);
  assert.match(captionOf('leak', 2.8), /警報/);
  assert.match(captionOf('fwsloss', 2), /約 2\.0 K/);
});

console.log(`\n${count} tests passed`);
