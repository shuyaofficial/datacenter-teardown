// node switch/kin.test.mjs — checks switch-shared/kin.js against the hand-worked numbers in switch/refs.md 「検算」.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  cellsOf,
  CHAPTERS,
  copp,
  CPU_LAYERS,
  descShare,
  fillMs,
  forwardMpps,
  hwOverCpu,
  LAYERS,
  layerAt,
  liftsAt,
  netInBytesPerMs,
  oneWayGbps,
  packetAt,
  poeDevices,
  poeFullW,
  puntAt,
  q1LimitB,
  queueAt,
  realOf,
  SCENE_IDS,
  SCENES,
  sceneDuration,
  serialUs,
  snapT,
  SPEC,
  STAGE_IDS,
  STAGES,
  switchingGbps,
} from '../switch-shared/kin.js';
import {activeOf, along, CONGEST, BLOCK, BOARD, boardPose, captionOf, congestBeads, HOLD, PRE, sceneClock, stormBeads, airDashes, AIR} from '../switch-shared/flow.js';
import {awayOf, beatsOf, DURATION, explodeEventsOf, sceneStartOf, sceneTAt, SCRIPT, stateAtScript} from '../switch-shared/script.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (±${tol})`);
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log(`ok  ${name}`);
};

test('交換容量: (48×1 + 8×10) = 128 Gbps 片方向 × 2 = 256 Gbps', () => {
  assert.equal(oneWayGbps(), 128);
  assert.equal(switchingGbps(), 256);
});

test('転送レート: 128e9 / 672 bit = 190.48 Mpps (±0.01)', () => {
  assert.equal((SPEC.frame.min + SPEC.frame.overhead) * 8, 672);
  near(forwardMpps(), 190.48, 0.01, 'Mpps');
});

test('直列化時間: 1518 B @1G = 12.304 µs, 64 B @1G = 0.672 µs, 1518 B @10G = 1.2304 µs', () => {
  near(serialUs(1518, 1), 12.304, 1e-9, '1518 B 1G');
  near(serialUs(64, 1), 0.672, 1e-9, '64 B 1G');
  near(serialUs(1518, 10), 1.2304, 1e-9, '1518 B 10G');
});

test('NIF の切れ端: 1518 B → 6 個（最後は 238 B）、64 B → 1 個', () => {
  const c = cellsOf(1518);
  assert.equal(c.length, 6);
  assert.deepEqual(c.slice(0, 5), [256, 256, 256, 256, 256]);
  assert.equal(c[5], 238);
  assert.equal(c.reduce((a, b) => a + b, 0), 1518);
  assert.deepEqual(cellsOf(64), [64]);
});

test('札と本体: 札は 64 B、本体の約 1/24（1518 / 64 = 23.7）', () => {
  assert.equal(SPEC.descB, 64);
  near(descShare(1518), 23.72, 0.01, '1518/64');
  assert.equal(Math.round(descShare(1518)), 24);
});

test('ハードと CPU の差: 190.48 Mpps / 19,000 pps ≈ 10,025 倍', () => {
  assert.equal(SPEC.punt.cpuTotalPps, 19000);
  assert.equal(Math.round(hwOverCpu()), 10025);
});

test('ARP の嵐: 10,000 pps が来るとキュー5 の 4,000 pps を超えた 6,000 pps を捨てる', () => {
  assert.equal(SPEC.punt.stormPps, 10000);
  const c = copp(10000, 5);
  assert.deepEqual([c.pass, c.drop, c.limit], [4000, 6000, 4000]);
  // the punt queue table of refs.md
  assert.deepEqual(
    SPEC.punt.queues.map((q) => [q.id, q.pps]),
    [[5, 4000], [4, 5500], [3, 750], [1, 2000], [2, 4000]],
  );
  // the storm scene's counters settle at the same numbers
  const p = puntAt('storm', 3);
  assert.deepEqual([p.offeredPps, p.passPps, p.dropPps], [10000, 4000, 6000]);
  near(p.offered - p.pass - p.drop, 0, 1e-6, 'conservation');
  near(p.offered, 10000 * (3 * SPEC.timeMap.stormRealPerSec - SPEC.punt.stormRamp / 2), 1e-6, 'cumulative arrivals');
});

test('混雑: Q1 600 単位 × 256 B = 153,600 B、1 Gbps の差で 1.2288 ms で満杯', () => {
  assert.equal(q1LimitB(100), 153600);
  assert.equal(netInBytesPerMs(), 125000);
  near(fillMs(100), 1.2288, 1e-9, 'fill 100');
  const before = queueAt(1.2, 100);
  assert.equal(before.full, false);
  const at = queueAt(1.2288, 100);
  near(at.bytes, 153600, 1e-6, 'bytes at full');
  assert.equal(queueAt(1.3, 100).full, true);
});

test('混雑: 1518 B のフレームで 101 個、倍率 1200 では 1,843,200 B・14.7456 ms', () => {
  assert.equal(Math.floor(153600 / 1518), 101);
  assert.equal(queueAt(1.2288, 100).frames, 101);
  assert.equal(q1LimitB(1200), 1843200);
  near(fillMs(1200), 14.7456, 1e-9, 'fill 1200');
  near(queueAt(14.7456, 1200).bytes, 1843200, 1e-6, 'bytes 1200');
});

test('混雑: 満杯の後は末尾で捨てる（捨てた数が増え、溜まり量は上限のまま）', () => {
  const a = queueAt(2, 100);
  const b = queueAt(3, 100);
  assert.equal(a.bytes, 153600);
  assert.equal(b.bytes, 153600);
  assert.ok(b.droppedFrames > a.droppedFrames && a.droppedFrames > 0);
  near(a.droppedB, 125000 * (2 - 1.2288), 1e-6, 'dropped bytes');
  assert.equal(queueAt(0.5, 100).droppedFrames, 0);
});

test('PoE: 437 W で 30 W 機器は 14 台、48 ポート全部なら 1,440 W', () => {
  assert.equal(SPEC.poeBudgetW, 437);
  assert.equal(poeDevices(), 14);
  assert.equal(poeFullW(), 1440);
});

test('SPEC: refs.md の値（筐体・基板・ASIC・メモリ）', () => {
  assert.deepEqual([SPEC.chassis.h, SPEC.chassis.w, SPEC.chassis.d, SPEC.chassis.kg], [44, 445, 409, 7.59]);
  assert.deepEqual([SPEC.rj45, SPEC.sfp, SPEC.phy, SPEC.fans, SPEC.psuW], [48, 8, 6, 3, 715]);
  assert.deepEqual([SPEC.asic.gbps, SPEC.asic.mpps, SPEC.asic.bufMB, SPEC.asic.macTable, SPEC.asic.acl], [160, 238, 16, 32000, 5000]);
  assert.deepEqual([SPEC.cpu.cores, SPEC.cpu.ghz, SPEC.cpu.ddr4GB, SPEC.cpu.eusbGB], [4, 1.8, 8, 16]);
  assert.deepEqual([SPEC.queue.q1.softMax, SPEC.queue.q1.softMin, SPEC.queue.q0.softMax, SPEC.queue.q0.hardMax], [600, 150, 400, 100]);
  assert.deepEqual(SPEC.queue.wtd, [80, 90, 100]);
});

test('STAGES: 12 段、白書の並び', () => {
  assert.equal(STAGES.length, 12);
  assert.deepEqual(STAGE_IDS, ['phy-in', 'nif', 'macsec-in', 'fifo-in', 'ifc', 'pbc', 'eqs', 'pbc-rwe', 'efc-peek', 'efc-lookup', 'rwe', 'out']);
  assert.deepEqual(STAGES.map((s) => s.n), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  for (const s of STAGES) assert.ok(s.abbr && s.ja && s.key, s.id);
});

test('場面: 7 つ、段の所要時間は 0.5〜0.8 s（storm の CoPP 保持と congest を除く）', () => {
  assert.deepEqual(SCENE_IDS, ['l2', 'l3', 'flood', 'arp', 'storm', 'ttl', 'congest']);
  for (const id of ['l2', 'l3', 'flood']) near(sceneDuration(id), 12 * SPEC.stageDur, 1e-9, id);
  assert.ok(SPEC.stageDur >= 0.5 && SPEC.stageDur <= 0.8);
});

test('packetAt: l2 は 12 段を順に通り、切れ端 6 個が NIF で分かれ、本体は PBC に残る', () => {
  const seen = [];
  for (let k = 0; k < 12; k++) seen.push(packetAt('l2', (k + 0.5) * SPEC.stageDur).stage);
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const nif = packetAt('l2', 1 * SPEC.stageDur + 0.99 * SPEC.stageDur);
  assert.equal(nif.cells.filter((c) => c.at === 'nif').length, 5);
  assert.equal(packetAt('l2', 2.5 * SPEC.stageDur).cells.length, 6);
  const eqs = packetAt('l2', 6.5 * SPEC.stageDur);
  assert.ok(eqs.cells.every((c) => c.at === 'pbc'), 'cells wait in the PBC at EQS');
  assert.equal(eqs.desc.at, 'eqs');
  assert.equal(packetAt('l2', 4.5 * SPEC.stageDur).desc.at, 'ifc');
  assert.equal(packetAt('l2', 0.1).desc.at, null);
  assert.equal(packetAt('l2', 100).done, true);
  assert.equal(packetAt('l2', 0.1).real.serialUs, 12.304);
  assert.equal(realOf('l2').cellCount, 6);
  assert.equal(realOf('l2').lastCellB, 238);
});

test('packetAt: l3 は RWE で MAC の付け替えと TTL−1', () => {
  const pre = packetAt('l3', 5.5 * SPEC.stageDur).rewrite;
  const post = packetAt('l3', 11.9 * SPEC.stageDur).rewrite;
  assert.equal(pre.applied, false);
  assert.equal(pre.ttl, SPEC.demo.ttl0);
  assert.equal(post.applied, true);
  assert.equal(post.ttl, SPEC.demo.ttl0 - 1);
  assert.equal(post.src, SPEC.demo.svi);
  assert.equal(post.dst, SPEC.demo.hostB);
  assert.equal(packetAt('l2', 5).rewrite, null);
});

test('packetAt: flood は EQS で出口の数だけ複製、arp / ttl は CPU の層を上がって降りる', () => {
  assert.equal(packetAt('flood', 6.5 * SPEC.stageDur).copies, SPEC.demo.floodPorts.length);
  assert.equal(packetAt('l2', 6.5 * SPEC.stageDur).copies, 1);
  const layers = [];
  const dur = sceneDuration('arp');
  for (let t = 0; t < dur; t += 0.05) {
    const p = packetAt('arp', t);
    if (p.phase === 'cpu' && p.cpuLayer !== layers[layers.length - 1]) layers.push(p.cpuLayer);
  }
  assert.deepEqual(layers, ['copp', 'kernel', 'fed', 'pds', 'iosd', 'pds', 'fed', 'kernel']);
  assert.deepEqual(CPU_LAYERS.map((l) => l.id), ['copp', 'kernel', 'fed', 'pds', 'iosd']);
  assert.equal(packetAt('arp', dur - 0.01).phase, 'asic');
  assert.deepEqual([puntAt('arp', 0).offered, puntAt('arp', dur).pass], [0, 1]);
  assert.equal(puntAt('ttl', sceneDuration('ttl')).limit, 750);
  assert.equal(puntAt('ttl', 0).queue, 3);
});

test('packetAt: congest は倍率ごとの満杯時間まで溜まり、real に溜まり量が載る', () => {
  const ms = (t) => t * SPEC.timeMap.congestMsPerSec;
  const tFull100 = 1.2288 / SPEC.timeMap.congestMsPerSec;
  near(packetAt('congest', tFull100, {mult: 100}).real.bytes, 153600, 1e-6, '100');
  const mid = packetAt('congest', tFull100, {mult: 1200});
  assert.ok(mid.real.bytes < 1843200 && mid.real.full === false);
  near(packetAt('congest', 14.7456 / SPEC.timeMap.congestMsPerSec, {mult: 1200}).real.bytes, 1843200, 1e-6, '1200');
  assert.ok(ms(sceneDuration('congest')) >= 14.7456, 'the scene is long enough to fill at ×1200');
});

test('純関数: 同じ入力は同じ出力（packetAt / queueAt / puntAt / liftsAt）', () => {
  for (const id of SCENE_IDS) for (const t of [0, 0.7, 3.3, 7.1]) assert.deepEqual(packetAt(id, t, {mult: 300}), packetAt(id, t, {mult: 300}), `${id} ${t}`);
  assert.deepEqual(queueAt(2.5, 700), queueAt(2.5, 700));
  assert.deepEqual(puntAt('storm', 1.7), puntAt('storm', 1.7));
  const ev = [{t: 1, to: 1}, {t: 6, to: 0}];
  assert.deepEqual(liftsAt(ev, 3.3), liftsAt(ev, 3.3));
  const t1 = snapT('l2', 3.1 * SPEC.stageDur);
  assert.equal(packetAt('l2', t1).stage, 3);
  assert.ok(packetAt('l2', t1).u < 1e-3, 'snapped to the start of the step');
});

test('分解: 上の層から 0.17 s ずつずらして持ち上がり、閉じるときは下から速い', () => {
  assert.deepEqual(LAYERS, ['cover', 'heat', 'nm', 'psu']);
  const open = [{t: 0, to: 1}];
  const start = LAYERS.map((_, k) => {
    for (let t = 0; t < 3; t += 0.005) if (layerAt(open, k, t) > 0.01) return t;
    return -1;
  });
  for (let k = 1; k < 4; k++) near(start[k] - start[k - 1], 0.17, 0.02, `stagger ${k}`);
  const all = liftsAt(open, 4);
  assert.deepEqual(all.lifts, [1, 1, 1, 1]);
  assert.equal(liftsAt(open, 0).explode, 0);
  const shut = [{t: 0, to: 1}, {t: 5, to: 0}];
  const closeStart = LAYERS.map((_, k) => {
    for (let t = 5; t < 8; t += 0.005) if (layerAt(shut, k, t) < 0.99) return t;
    return -1;
  });
  assert.ok(closeStart[3] < closeStart[0], 'the PSU leaves first when closing');
  let prev = -1;
  for (let t = 0; t <= 2; t += 0.1) {
    const e = liftsAt(open, t).explode;
    assert.ok(e >= prev - 1e-12, 'explode rises monotonically');
    prev = e;
  }
  assert.equal(liftsAt([{t: 1, to: 1}], 0.9, [0, 0, 0, 0], true).lifts[3], 0, 'before the press');
  assert.equal(liftsAt([{t: 1, to: 1}], 1.1, [0, 0, 0, 0], true).lifts[3], 1, 'instant (reduced motion) jumps');
});

test('章: 7 章、各章のラボのコマンドは refs.md の表と同じ', () => {
  assert.equal(CHAPTERS.length, 7);
  assert.deepEqual(CHAPTERS.map((c) => c.n), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(CHAPTERS[0].lab.map((l) => [l.cmd, l.iol]), [['show inventory', true], ['show version', true], ['show environment all', false]]);
  assert.equal(CHAPTERS[3].lab.length, 3);
  assert.equal(CHAPTERS[4].lab[0].cmd, 'show platform software fed switch active punt cpuq 5');
  assert.equal(CHAPTERS[6].lab[1].cmd, 'show power inline');
  for (const c of CHAPTERS) for (const id of c.scenes ?? []) assert.ok(SCENES[id], id);
});

test('ツアー: 章 1→7 を 60〜90 s で回り、timeline.json は台本と一致', () => {
  const tl = JSON.parse(fs.readFileSync(new URL('../switch-film/timeline.json', import.meta.url), 'utf8'));
  assert.equal(tl.duration, DURATION);
  assert.ok(DURATION >= 60 && DURATION <= 90, `duration ${DURATION}`);
  assert.deepEqual(tl.beats, beatsOf());
  const order = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.chapter);
  assert.deepEqual(order, [1, 2, 3, 4, 5, 6, 7, 1]);
  // the cover opens at chapter 2 and closes at 4 (from there the cover is taken away instead)
  assert.deepEqual(explodeEventsOf(), [{t: 8, to: 1}, {t: 26, to: 0}]);
  assert.deepEqual([awayOf(3), awayOf(4), awayOf(6), awayOf(7)], [[0, 0], [1, 1], [1, 1], [1, 0]]);
  // the chapter budgets of the brief (±2 s): 8, 10, 8, 20, 14, 14, 8
  const ts = SCRIPT.filter((e) => e.chapter !== undefined).map((e) => e.t);
  const lens = ts.slice(1).map((t, i) => t - ts[i]);
  [8, 10, 8, 20, 14, 14, 8].forEach((want, i) => assert.ok(Math.abs(lens[i] - want) <= 2, `chapter ${i + 1}: ${lens[i]} s`));
});

test('ツアー: 章 4 は l2 を 1 往復、l3 は RWE で書き換えた状態に寄る', () => {
  const c4 = SCRIPT.find((e) => e.chapter === 4).t;
  const l3 = SCRIPT.find((e) => e.scene === 'l3').t;
  const zoom = SCRIPT.find((e) => e.zoom === 'rwe').t;
  // l2 runs to its end before l3 is pressed
  assert.ok(l3 - c4 - PRE >= 12 * SPEC.stageDur, 'l2 finishes');
  assert.equal(stateAtScript(c4 + 1).scene, 'l2');
  assert.equal(sceneTAt(c4 + 1), 0, 'waits at the port while the camera settles');
  assert.ok(Math.abs(sceneTAt(c4 + PRE + 1) - 1) < 1e-9);
  // the camera reaches the RWE (1.8 s blend) before the RWE stage starts, and the rewrite is shown while zoomed
  const rweT = l3 + 10 * SPEC.stageDur;
  assert.ok(zoom + 1.8 <= rweT + 0.2, 'zoomed in time');
  const pk = packetAt('l3', sceneTAt(rweT + 0.5));
  assert.equal(pk.stageId, 'rwe');
  assert.equal(packetAt('l3', sceneTAt(SCRIPT.find((e) => e.chapter === 5).t - 0.1)).rewrite.ttl, 63);
});

test('ツアー: 章 5 は arp が IOSd まで上がって戻り、storm の計器が 10,000 / 4,000 / 6,000 に届く', () => {
  const c5 = SCRIPT.find((e) => e.chapter === 5).t;
  const storm = SCRIPT.find((e) => e.scene === 'storm').t;
  const c6 = SCRIPT.find((e) => e.chapter === 6).t;
  assert.ok(storm - c5 - PRE >= sceneDuration('arp'), 'arp finishes before the storm');
  const p = puntAt('storm', sceneTAt(c6 - 0.1));
  assert.deepEqual([p.offeredPps, p.passPps, p.dropPps], [10000, 4000, 6000]);
});

test('ツアー: 章 6 は倍率 100 で満杯（1.2288 ms）→ 1200 で 14.7456 ms に満杯', () => {
  const c6 = SCRIPT.find((e) => e.chapter === 6).t;
  const m = SCRIPT.find((e) => e.mult === 1200).t;
  const c7 = SCRIPT.find((e) => e.chapter === 7).t;
  const q100 = queueAt(sceneTAt(m - 0.1) * SPEC.timeMap.congestMsPerSec, stateAtScript(m - 0.1).mult);
  assert.equal(stateAtScript(m - 0.1).mult, 100);
  assert.equal(q100.full, true);
  assert.ok(q100.droppedFrames > 0);
  const q1200 = queueAt(sceneTAt(c7 - 0.1) * SPEC.timeMap.congestMsPerSec, stateAtScript(c7 - 0.1).mult);
  assert.equal(stateAtScript(c7 - 0.1).mult, 1200);
  assert.equal(q1200.full, true, 'fills at x1200 before chapter 7');
  near(q1200.limit, 1843200, 1e-6, 'limit 1200');
  assert.equal(stateAtScript(c6 + 0.1).mult, 100, 'a chapter press resets the multiplier');
  assert.deepEqual(sceneStartOf(m + 0.1), {t0: m, pre: 0});
});

test('scene clock: 章を押すと PRE だけ待ち、終わると HOLD だけ止まってから繰り返す', () => {
  assert.equal(sceneClock('l2', 0.5, PRE), 0);
  near(sceneClock('l2', PRE + 2, PRE), 2, 1e-9, 'running');
  const D = sceneDuration('l2');
  near(sceneClock('l2', D + 1), D + 1, 1e-9, 'holding');
  near(sceneClock('l2', D + HOLD + 0.5), 0.5, 1e-9, 'again');
  assert.equal(sceneClock(null, 5), 0);
});

test('along: 折れ線の長さで進む（3D と 2D）', () => {
  assert.deepEqual(along([[0, 0, 0], [10, 0, 0], [10, 10, 0]], 0.75), [10, 5, 0]);
  assert.deepEqual(along([[0, 0], [0, 4]], 0.5), [0, 2]);
  assert.deepEqual(along([[0, 0], [0, 4]], 2), [0, 4]);
});

test('拡大図: 12 個のブロック、各段に 1 つ以上、IFC は FIFO→PBC の横、EFC は PBC→RWE の横', () => {
  assert.equal(BOARD.blocks.length, 12);
  for (const s of STAGES) {
    const key = s.id.startsWith('efc') ? 'efc-peek' : s.id;
    const pk = {phase: 'asic', stageId: key, u: 0.9, done: false};
    if (s.id === 'pbc-rwe') assert.equal(activeOf(pk).flow, 'out');
    else assert.ok(activeOf(pk).blocks.length === 1, s.id);
  }
  for (const b of BOARD.blocks) assert.ok(b.abbr && b.ja, b.id);
  const ifc = BLOCK.ifc;
  assert.ok(ifc.x > BLOCK.fifo.x && ifc.x < BLOCK.pbc.x - BLOCK.pbc.w / 2 && ifc.z > BOARD.rowIn && ifc.z - ifc.d / 2 - BOARD.rowIn < 30, 'IFC beside the FIFO→PBC flow');
  const efc = BLOCK.efc;
  assert.ok(efc.x > BLOCK.rwe.x && efc.x < BLOCK.pbc.x - BLOCK.pbc.w / 2 && efc.z < BOARD.rowOut && BOARD.rowOut - efc.z - efc.d / 2 < 30, 'EFC beside the PBC→RWE flow');
  // no two blocks overlap on the plate
  const bs = BOARD.blocks;
  for (let i = 0; i < bs.length; i++)
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i];
      const b = bs[j];
      const ox = Math.abs(a.x - b.x) < (a.w + b.w) / 2;
      const oz = Math.abs(a.z - b.z) < (a.d + b.d) / 2;
      assert.ok(!(ox && oz), `${a.id} / ${b.id}`);
    }
});

test('拡大図: 札だけが IFC → PBC → EQS を回り、本体の切れ端 6 個はその間 PBC から動かない', () => {
  const D = SPEC.stageDur;
  const at = (k, u) => boardPose(packetAt('l2', (k + u) * D));
  // NIF: the frame splits into 6 cells (256 x 5 + 238), the last narrower
  const nif = at(1, 0.99);
  assert.equal(nif.cells.length, 6);
  assert.ok(nif.cells[5].w < nif.cells[0].w);
  // IFC writes the descriptor at the IFC; at PBC it goes down to the cells; at EQS it sits at the EQS
  assert.deepEqual([at(4, 0.9).tag.x, at(4, 0.9).tag.z], [BLOCK.ifc.x, BLOCK.ifc.z]);
  assert.equal(at(4, 0.1).tag, null, 'no descriptor before the IFC has looked');
  const eqs = at(6, 0.99);
  assert.deepEqual([eqs.tag.x, eqs.tag.z], [BLOCK.eqs.x, BLOCK.eqs.z]);
  // the cells do not move between the end of the PBC stage and the end of EQS
  const a = at(5, 0.99).cells.map((c) => [c.x, c.z]);
  for (const u of [0.0, 0.3, 0.6, 0.99]) assert.deepEqual(at(6, u).cells.map((c) => [c.x, c.z]), a, `EQS u=${u}`);
  for (const [x, z] of a) assert.ok(Math.abs(x - BLOCK.pbc.x) <= BLOCK.pbc.w / 2 && Math.abs(z - BLOCK.pbc.z) <= BLOCK.pbc.d / 2, 'inside the PBC');
  // then the body leaves for the RWE along the egress row; the descriptor stays at the EQS
  const rwe = at(10, 0.9);
  assert.ok(rwe.cells.every((c) => c.z === BOARD.rowOut));
  assert.ok(Math.abs(rwe.cells[0].x - BLOCK.rwe.x) < BLOCK.rwe.w);
  // the frame starts on the real board and ends on it
  assert.equal(at(0, 0.3).real, 'in');
  assert.equal(boardPose(packetAt('l2', 100)).real, 'out');
  // flood: the descriptor is copied at the EQS, to the 3 demo ports
  const f = boardPose(packetAt('flood', 6.9 * D));
  assert.equal(f.tag.copies, SPEC.demo.floodPorts.length);
});

test('字幕: 段ごとに 1 行、核心の言い方を含む', () => {
  const D = SPEC.stageDur;
  assert.match(captionOf('l2', packetAt('l2', 5.5 * D)), /本体 1518 B は PBC に置いたまま。動くのは 64 B の札だけ/);
  assert.match(captionOf('l2', packetAt('l2', 1.5 * D)), /256 × 5 \+ 238/);
  assert.match(captionOf('l3', packetAt('l3', 10.5 * D)), /TTL/);
  assert.match(captionOf('flood', packetAt('flood', 6.5 * D)), /仮置き/);
  assert.match(captionOf('congest', packetAt('congest', 3, {mult: 100})), /満杯/);
  assert.equal(captionOf(null, null), '');
});

test('嵐の粒: 1 粒 = 1,000 個、全速では 10 粒のうち 4 粒が CoPP を通り 6 粒が手前で止まる', () => {
  const p = puntAt('storm', 30);
  near(p.pass / p.offered, 0.4, 0.02, 'pass share of the counters');
  // beads 185-194 left the port in the 19th second (full rate); at t = 20.5 all ten are still drawn
  const win = stormBeads(20.5).filter((b) => b.i >= 185 && b.i < 195);
  assert.equal(win.length, 10);
  assert.equal(win.filter((b) => b.pass).length, 4);
  assert.ok(stormBeads(20.5).length < 48, 'only the beads on the way are drawn (fits the instanced mesh)');
  assert.ok(stormBeads(0.5).every((b) => b.pass), 'during the ramp below 4,000 pps every bead passes');
});

test('混雑の粒: 満杯の前は全部入り、満杯の後は Gi1/0/2 の分を末尾で捨てる', () => {
  const early = congestBeads(0.2, 100);
  const arrive = (b) => b.k / CONGEST.perSec;
  assert.ok(early.ins.filter((b) => arrive(b) < early.fullAtS).every((b) => !b.drop), 'before full nothing is dropped');
  assert.ok(early.ins.filter((b) => arrive(b) > early.fullAtS).some((b) => b.drop), 'after full the Gi1/0/2 beads are');
  const late = congestBeads(4, 100);
  assert.ok(late.ins.some((b) => b.drop && b.port === 2));
  assert.ok(late.ins.every((b) => !(b.drop && b.port === 1)));
  near(late.fullAtS, 1.2288 / SPEC.timeMap.congestMsPerSec, 1e-9, 'full at');
  const c1200 = congestBeads(4, 1200);
  assert.ok(c1200.ins.every((b) => !b.drop), 'x1200 is not full at 8 ms');
});

test('風の破線: 前から後ろへ流れ、速さ 0 なら止まる', () => {
  const path = [[0, 10, 200], [0, 10, -200]];
  const a = airDashes(path, 0);
  const b = airDashes(path, 0.2);
  assert.ok(a.length > 10);
  // a dash moves toward the back (−z) as time goes on
  near(a[1].a[2] - b[1].a[2], AIR.speed * 0.2, 1e-6, 'moves back');
  assert.deepEqual(airDashes(path, 0, 0), airDashes(path, 5, 0), 'speed 0 stands still');
});

console.log(`\n${count} tests passed`);
