// The rack's console, laid out at 1600 x 900 like the NVL72's (nvl72-shared/console.js), all in Japanese: the title
// block on a paper strip; on the left the seven chapter buttons, the chapter's buttons (views / open-close / scenes) and
// the controls; on the right the gauges of the chapter (the rack, the tray, 384 = 384 and the hops, the cubes and the
// slice's shape, the bars against NVL72, ICI against DCN, the power); along the bottom the chapter's explanation and the
// command to run on the real machine. update(s) redraws every live part from the frame's state; nothing here keeps time.
import {C, createChrome, MONO, SANS} from '../kit/ui.js';
import {
  axisGBs,
  CHAPTERS,
  chipCount,
  chipEnds,
  chipKW,
  copperLinks,
  diameter,
  iciDcnRatio,
  iciGBs,
  iciOneWayGBs,
  iciVsNvlink,
  IN_USE,
  innerLinks,
  jaxDevicesPerVm,
  lineEnds,
  linkVsNvlink,
  meanHops,
  NEXT_GEN,
  NOTICE,
  NVL,
  ocsPortsIronwood,
  ocsPortsV4,
  opticalLinks,
  pcbLinks,
  rackFp8PF,
  rackHbmGB,
  rackKW,
  scaleVsNvl,
  SCENES,
  SPEC,
  trayOutLinks,
} from './kin.js';
import {SHADE} from './overlay.js';

export const subsOf = (n) => {
  const c = CHAPTERS[n - 1];
  if (c.subs) return c.subs;
  return c.scenes.map((id) => ({id, label: SCENES[id].name}));
};
export const SUB_NOTE = {front: 'ラック全景: 上から下へ部品の並び', cube: 'ラックの横に 4×4×4 の立方体を並べる', open: '引き出して、上の層から順に浮かせる', close: '下の層から戻して、押し込む'};
const CSS = `
.bt[data-n]::before{content:attr(data-n);position:absolute;left:11px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;font:700 12px ${SANS};display:flex;align-items:center;justify-content:center;letter-spacing:0}
.bt[data-n]{padding-left:22px}
.call{padding:4px 9px 5px 6px;border-radius:5px;background:rgba(250,251,252,.94);border:1px solid ${C.line}}
.call b{text-shadow:none}
.call span{text-shadow:none}
.call b i.nb{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${C.accent};color:#fff;font:700 11px ${SANS};font-style:normal;flex:none}
.call.n b{gap:6px}
.call.n span{margin-left:24px}
.tg{position:absolute;white-space:nowrap;line-height:1.25}
.tg.lbl{padding:4px 8px;border-radius:5px;background:${C.panel};border:1px solid ${C.line}}
.tg.lbl b{display:block;font:700 13px ${SANS};color:${C.ink}}
.tg.lbl span{display:block;font:500 11.5px ${SANS};color:${C.sub}}
.tg.lbl.on{border-color:${C.accent}}
.tg.lbl.on b{color:${C.accent}}
.tg.note{font:600 12px ${SANS};color:${C.sub};letter-spacing:.04em;padding:2px 8px;border-radius:4px;background:rgba(250,251,252,.9)}
.gr{position:absolute;left:1278px;width:280px;white-space:nowrap;display:flex;align-items:baseline;justify-content:space-between;font:500 12.5px ${SANS};color:${C.sub}}
.gr b{font:700 17px Inter,${SANS};color:${C.ink}}
.gr b small{font:500 12px ${SANS};color:${C.sub};margin-left:3px}
.gs{position:absolute;left:1278px;width:280px;font:500 11px/1.45 ${SANS};color:${C.mute};white-space:normal}
.gh{position:absolute;left:1278px;font:700 13px ${SANS};color:${C.ink};letter-spacing:.04em;white-space:nowrap}
.gl{position:absolute;left:1278px;width:278px;height:1px;background:${C.line}}
.big{position:absolute;left:1278px;width:280px;white-space:nowrap;font:700 30px Inter,${SANS};color:${C.ink};letter-spacing:-.01em}
.big small{font:500 14px ${SANS};color:${C.sub};margin-left:4px;letter-spacing:0}
.trk{position:absolute;height:9px;border-radius:2px;background:#e1e7ea}
.fil{position:absolute;height:9px;border-radius:2px}
.bl{position:absolute;left:1278px;width:120px;font:600 11.5px ${SANS};color:${C.sub};white-space:nowrap}
.bv{position:absolute;left:1400px;width:156px;text-align:right;font:700 12.5px Inter,${SANS};color:${C.ink};white-space:nowrap}
.nvcap{position:absolute;left:800px;top:110px;transform:translateX(-50%);max-width:880px;padding:5px 14px;border-radius:5px;background:rgba(250,251,252,.93);border:1px solid ${C.line};font:700 16px ${SANS};color:${C.ink};letter-spacing:.03em;white-space:nowrap}
`;
const fx = (n, d) => Number(n).toFixed(d);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const unit = (u, px = 14) => `<span style="font-size:${px}px;font-weight:500"> ${u}</span>`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = createChrome(app);
  const {add, panel, onBtn} = ui;
  const btn = {};

  // ------------------------------------------------------------ header: a paper strip so the title never sits on the 3D
  add(`<div style="position:absolute;left:0;top:0;width:1600px;height:98px;background:rgba(238,241,243,.96);border-bottom:1px solid ${C.line}"></div>`);
  add(`<div style="position:absolute;left:0;top:0;width:150px;height:92px;background:${C.accent}"></div>`);
  // a cube of 3 × 3 dots on 3 faces (a hint of the torus), drawn in white
  add(`<svg style="position:absolute;left:41px;top:12px" width="68" height="68" viewBox="0 0 68 68"><g fill="none" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"><path d="M34 6 60 19 60 49 34 62 8 49 8 19Z"/><path d="M8 19 34 32 60 19M34 32V62"/></g><g fill="#fff"><circle cx="34" cy="13" r="2.6"/><circle cx="47" cy="19.5" r="2.6"/><circle cx="21" cy="19.5" r="2.6"/><circle cx="34" cy="26" r="2.6"/><circle cx="16" cy="32" r="2.6"/><circle cx="16" cy="45" r="2.6"/><circle cx="25" cy="50" r="2.6"/><circle cx="52" cy="32" r="2.6"/><circle cx="52" cy="45" r="2.6"/><circle cx="43" cy="50" r="2.6"/></g></svg>`);
  add(`<div class="sm" style="position:absolute;left:172px;top:16px;letter-spacing:.12em">ネットワーク機器のしくみ　07</div>`);
  add(`<div style="position:absolute;left:170px;top:34px;font:700 34px ${SANS};letter-spacing:.02em;line-height:1">TPU ポッドの分解 <span style="color:${C.accent};font-weight:400">/</span> <span style="font-size:24px">Ironwood 風・ラック 1 台 ＝ 64 チップ</span></div>`);
  add(`<div style="position:absolute;left:172px;top:76px;font:500 14px ${SANS};color:${C.sub};letter-spacing:.04em">TPU トレイ ${SPEC.cube.trays}・ホストトレイ ${SPEC.cube.hosts}・3D トーラス・光の回線スイッチ（OCS）・液冷</div>`);
  add(`<div style="position:absolute;left:1036px;top:16px;width:540px;height:72px;background:${C.panel};border:1px solid ${C.line};border-radius:6px"></div>`);
  [['チップ（ラック 1 台）', String(chipCount()), '個'], ['ICI（1 チップ）', String(SPEC.ici.chipTBs), 'TB/s'], ['ポッド', fmt(SPEC.pod.chips), 'チップ']].forEach(([k, v, u], i) => {
    const x = 1060 + i * 172;
    if (i) add(`<div style="position:absolute;left:${x - 14}px;top:30px;width:1px;height:44px;background:${C.faint}"></div>`);
    add(`<div class="sm" style="position:absolute;left:${x}px;top:28px">${k}</div>`);
    add(`<div style="position:absolute;left:${x}px;top:48px;font:700 22px ${SANS};white-space:nowrap">${v}${unit(u, 13)}</div>`);
  });

  // ------------------------------------------------------------ 01 chapters
  panel(28, 108, 300, 296, '章', '01');
  CHAPTERS.forEach((c, i) => {
    btn[`c_${c.n}`] = add(`<div class="bt" data-n="${c.n}" style="left:44px;top:${146 + i * 36}px;width:268px;height:30px;justify-content:flex-start;padding-left:42px">${c.name}</div>`);
  });

  // ------------------------------------------------------------ 02 the chapter's buttons
  panel(28, 418, 300, 176, '見せ方', '02');
  const subIds = {};
  CHAPTERS.forEach((c) => {
    subIds[c.n] = subsOf(c.n).map((sb, j) => {
      const b = add(`<div class="bt" style="left:44px;top:${454 + j * 36}px;width:268px;height:30px;display:none">${sb.label}</div>`);
      btn[`s_${sb.id}`] = b;
      return sb.id;
    });
  });
  const subNote = add(`<div style="position:absolute;left:44px;top:564px;width:268px;font:500 12px/1.35 ${SANS};color:${C.sub};white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>`);

  // ------------------------------------------------------------ 03 controls
  panel(28, 608, 300, 132, '操作', '03');
  add(`<div style="position:absolute;left:44px;top:640px;width:268px;font:500 13px/1.6 ${SANS};color:${C.sub}">ドラッグ: 回す　ホイール: 寄る<br>どれかの章を押すと自動ツアーを止める<br>25 秒そのままだとツアーに戻る</div>`);

  // ------------------------------------------------------------ 04 gauges: one page per chapter
  panel(1262, 108, 310, 632, '計器', '04');
  const pages = {};
  const page = (n) => (pages[n] = add(`<div style="position:absolute;inset:0;display:none"></div>`));
  const put = (pg, h) => {
    const d = document.createElement('div');
    d.innerHTML = h.trim();
    const n = d.firstElementChild;
    pg.appendChild(n);
    return n;
  };
  const head = (pg, y, t) => put(pg, `<div class="gh" style="top:${y}px">${t}</div>`);
  const row = (pg, y, k, v, u = '') => put(pg, `<div class="gr" style="top:${y}px"><span>${k}</span><b>${v}${u ? `<small>${u}</small>` : ''}</b></div>`);
  const note = (pg, y, t, extra = '') => put(pg, `<div class="gs" style="top:${y}px;${extra}">${t}</div>`);
  const rule = (pg, y) => put(pg, `<div class="gl" style="top:${y}px"></div>`);
  /** a labelled bar: name on the left, the value on the right, the bar under them */
  const bar = (pg, y, k, v, w, color) => {
    put(pg, `<div class="bl" style="top:${y}px">${k}</div>`);
    const val = put(pg, `<div class="bv" style="top:${y - 1}px">${v}</div>`);
    put(pg, `<div class="trk" style="left:1278px;top:${y + 17}px;width:278px"></div>`);
    const f = put(pg, `<div class="fil" style="left:1278px;top:${y + 17}px;width:${Math.max(2, w)}px;background:${color}"></div>`);
    return {val, f};
  };
  // 1 the rack
  {
    const p = page(1);
    head(p, 144, 'ラック 1 台（出典の値）');
    const R = [
      ['Ironwood チップ', `${chipCount()}`, '個'],
      ['TPU トレイ', `${SPEC.cube.trays}`, `枚 × ${SPEC.tray.chips} チップ`],
      ['ホスト（VM 1 台 = 4 チップ）', `${SPEC.cube.hosts}`, '台'],
      ['HBM3E（1 チップ）', `${SPEC.chip.hbmGiB}`, 'GiB'],
      ['HBM の帯域（1 チップ）', `${SPEC.chip.hbmTBs}`, 'TB/s'],
      ['FP8（1 チップ・ピーク）', fmt(SPEC.chip.fp8TF), 'TFLOPS'],
      ['ICI（1 チップ・双方向）', `${SPEC.ici.chipTBs}`, 'TB/s'],
      ['ラックの HBM（計算）', fmt(rackHbmGB()), 'GB'],
      ['ラックの FP8（計算）', fx(rackFp8PF(), 1), 'PFLOPS'],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 31, k, v, u));
    rule(p, 456);
    note(p, 464, `検算: ${chipCount()} × ${SPEC.chip.hbmGiB} = ${fmt(rackHbmGB())}、${chipCount()} × ${fx(SPEC.chip.fp8TF / 1000, 3)} = ${fx(rackFp8PF(), 1)} PFLOPS。FP8 は密か疎か書かれていないので、NVL72 と計算性能は比べない。寸法は未確認（形は仮定）。`);
    rule(p, 540);
    head(p, 548, '実際に使われている所（脚注）');
    put(p, `<div class="gs" style="top:566px;font-size:10.5px;line-height:1.32">${IN_USE.map((l) => `・${l}`).join('<br>')}</div>`);
  }
  // 2 the tray
  let pullV;
  {
    const p = page(2);
    head(p, 144, 'TPU トレイ 1 枚');
    const R = [
      ['Ironwood チップ', `${SPEC.tray.chips}`, '個'],
      ['チップ 1 個の中', `ダイ ${SPEC.chip.dies}`, `・HBM ${SPEC.chip.hbmStacks} 積み`],
      ['OSFP（表 / 裏）', `${SPEC.tray.osfp}`, `= ${SPEC.tray.osfpTop} + ${SPEC.tray.osfpBottom}`],
      ['トレイの中の線（推測）', `${SPEC.tray.boardLinks}`, '本・2×2 の輪'],
      ['外へ出る ICI', `${trayOutLinks()}`, '本'],
      ['ホストへ', `PCIe ${SPEC.pcie}`, `× ${SPEC.tray.chips}`],
      ['JAX のデバイス（VM 1 台）', `${jaxDevicesPerVm()}`, '個'],
      ['ホスト VM', `${SPEC.host.vcpu} vCPU`, `・${SPEC.host.memGB} GB`],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 31, k, v, u));
    rule(p, 424);
    note(p, 432, `外へ出る ICI: ${SPEC.tray.chips} × ${SPEC.ici.links} − ${SPEC.tray.boardLinks} × 2 = ${trayOutLinks()} 本。<br>液で冷やす: 4 チップと電圧調整器（並列・弁で流量を変える）。<br>裏の OSFP 2 個の用途は未確認。`);
    pullV = row(p, 520, '引き出した量', '0', '%').querySelector('b');
  }
  // 3 the torus
  let hopsV;
  let linksV;
  {
    const p = page(3);
    head(p, 144, '線の端の数（ラック 1 台）');
    put(p, `<div class="big" style="top:166px">${lineEnds()} = ${chipEnds()}</div>`);
    note(p, 206, `端: 2 × ${innerLinks(SPEC.cube.dims)} + ${opticalLinks()} ＝ チップ ${chipCount()} × ${SPEC.ici.links} 本`);
    rule(p, 232);
    [['基板の配線', pcbLinks(), SHADE.board], ['銅ケーブル', copperLinks(), SHADE.copper], ['光（面から外へ）', opticalLinks(), '#98a3a9']].forEach(([k, v, c], i) => {
      const r = row(p, 242 + i * 28, k, `${v}`, '本');
      r.querySelector('span').innerHTML = `<i style="display:inline-block;width:16px;height:4px;background:${c};vertical-align:middle;margin-right:6px"></i>${k}`;
    });
    rule(p, 330);
    row(p, 340, `1 本（双方向）× ${SPEC.ici.links}`, `${SPEC.ici.linkGBs} × ${SPEC.ici.links} = ${fx(iciGBs() / 1000, 1)}`, 'TB/s');
    row(p, 368, '1 軸（2 本）', `${axisGBs()}`, 'GB/s');
    linksV = row(p, 396, 'いま描いた線', '0 / 6', '本').querySelector('b');
    head(p, 432, 'ホップ数（隣へ渡った回数）');
    hopsV = put(p, `<div class="big" style="top:452px;font-size:40px">0<small>回</small></div>`);
    note(p, 502, `いちばん遠い相手まで ${diameter(SPEC.cube.dims)} 回、平均 ${fx(meanHops(SPEC.cube.dims), 3)} 回（64 × 63 組を検算）`);
  }
  // 4 the OCS
  const G4 = {};
  {
    const p = page(4);
    head(p, 144, '光でつないだスライス');
    G4.cubes = put(p, `<div class="big" style="top:166px;font-size:36px">4<small>個の立方体</small></div>`);
    G4.shape = row(p, 214, 'スライスの形', '4x4x16').querySelector('b');
    G4.max = row(p, 242, 'いちばん遠い相手まで', '12', '回').querySelector('b');
    G4.swap = row(p, 270, '予備に差し替え', 'まだ').querySelector('b');
    rule(p, 302);
    head(p, 312, '形と最大ホップ（各辺の半分の和）');
    [[[4, 4, 4], ''], [[4, 4, 16], ''], [[8, 8, 4], ''], [[8, 8, 16], '1,024'], [[8, 16, 16], '2,048'], [SPEC.pod.shape, '9,216（形は仮定）']].forEach(([d, n], i) => {
      const r = row(p, 336 + i * 24, `${d.join('×')}${n ? `　${n}` : ''}`, `${diameter(d)}`, '回');
      r.dataset.shape = d.join('x');
      G4[`r_${d.join('x')}`] = r;
    });
    rule(p, 486);
    note(p, 494, `OCS の台数とポート数は未確認。TPU v4 は ${SPEC.ocsV4.cubes} 立方体 × 2 = ${ocsPortsV4()} ポート ≤ ${SPEC.ocsV4.ports}。同じ並べ方なら Ironwood は ${SPEC.pod.cubes} × 2 = ${ocsPortsIronwood()} で足りない（推測の根拠）。`);
    rule(p, 572);
    head(p, 580, '次の世代（脚注）');
    note(p, 598, NEXT_GEN.map((l) => `・${l}`).join('<br>'), 'font-size:10.5px;line-height:1.35');
  }
  // 5 against NVL72
  const G5 = {};
  {
    const p = page(5);
    head(p, 144, 'NVL72 と Ironwood');
    const PX = 278;
    let y = 170;
    put(p, `<div class="gs" style="top:${y}px;color:${C.sub};font-weight:600">いちばん遠い相手までのホップ</div>`);
    y += 18;
    G5.nv = bar(p, y, 'NVL72（72 個）', `${NVL.hops}`, (PX * NVL.hops) / 32, C.ink);
    y += 32;
    const ds = [[[4, 4, 4], '立方体（64）'], [[8, 8, 16], '1,024 個'], [SPEC.pod.shape, '9,216 個（仮定）']];
    ds.forEach(([d, k], i) => {
      const b = bar(p, y, `Ironwood ${k}`, `${diameter(d)}`, (PX * diameter(d)) / 32, i ? C.faint : C.accent);
      if (!i) G5.iw = b;
      y += 32;
    });
    rule(p, y + 4);
    y += 12;
    const pairs = [
      ['1 つの領域', `${NVL.gpus} 対 ${fmt(SPEC.pod.chips)}`, NVL.gpus / SPEC.pod.chips, 1, `${fmt(scaleVsNvl())} 倍`],
      ['1 チップの線（双方向）', `${NVL.gpuTBs} 対 ${SPEC.ici.chipTBs} TB/s`, 1, iciVsNvlink(), `${fx(iciVsNvlink(), 3)} 倍`],
      ['1 本の太さ', `${NVL.linkGBs} 対 ${SPEC.ici.linkGBs} GB/s`, NVL.linkGBs / SPEC.ici.linkGBs, 1, `${fx(linkVsNvlink(), 0)} 倍`],
      ['ラックの HBM', `${fx(NVL.rackHbmGB / 1000, 1)} 対 ${fx(rackHbmGB() / 1000, 1)} TB`, 1, rackHbmGB() / NVL.rackHbmGB, ''],
    ];
    for (const [k, v, a, b, r] of pairs) {
      put(p, `<div class="bl" style="top:${y}px;width:150px">${k}</div>`);
      put(p, `<div class="bv" style="top:${y - 1}px;left:1430px;width:126px">${v}</div>`);
      put(p, `<div class="trk" style="left:1278px;top:${y + 18}px;width:278px;height:6px"></div>`);
      put(p, `<div class="fil" style="left:1278px;top:${y + 18}px;width:${Math.max(2, 278 * a)}px;height:6px;background:${C.ink}"></div>`);
      put(p, `<div class="trk" style="left:1278px;top:${y + 26}px;width:278px;height:6px"></div>`);
      put(p, `<div class="fil" style="left:1278px;top:${y + 26}px;width:${Math.max(2, 278 * b)}px;height:6px;background:${C.accent}"></div>`);
      if (r) put(p, `<div class="gs" style="top:${y + 34}px;left:1278px;width:278px;text-align:right">Ironwood は ${r}</div>`);
      y += r ? 54 : 42;
    }
    note(p, y, `黒: NVL72（${NVL.links} 本 × ${NVL.linkGBs} GB/s）　色: Ironwood（${SPEC.ici.links} 本 × ${SPEC.ici.linkGBs} GB/s）。NVL72 の値は nvl72 の SPEC から読む。`);
  }
  // 6 out of the pod
  {
    const p = page(6);
    head(p, 144, 'チップ 1 個のポッドの中と外');
    bar(p, 176, 'ICI（片方向）', `${fmt(iciOneWayGBs())} GB/s`, 278, C.accent);
    bar(p, 214, 'DCN', `${SPEC.dcnGbps} Gb/s`, 278 / iciDcnRatio(), C.ink);
    note(p, 248, `${fmt(iciOneWayGBs())} GB/s × 8 = ${fmt(iciOneWayGBs() * 8)} Gb/s ÷ ${SPEC.dcnGbps} Gb/s（DCN を片方向と仮定）`);
    put(p, `<div class="big" style="top:288px;font-size:40px">${fmt(iciDcnRatio())}<small>倍</small></div>`);
    rule(p, 346);
    bar(p, 356, 'NVL72 の中と外', `${fmt(NVL.inOut)} 倍`, (278 * NVL.inOut) / iciDcnRatio(), C.faint);
    note(p, 392, 'NVL72: NVLink 1.8 TB/s ÷ ConnectX-7 100 GB/s（双方向どうし）');
    rule(p, 432);
    row(p, 442, 'ポッドの中の計算', 'ICI', '');
    row(p, 470, 'ポッドどうし・データ', 'DCN', '');
    note(p, 498, 'DCN: ホストの NIC からデータセンターのネットワーク（Jupiter）へ。Jupiter が多数のポッドを結ぶ（出典5）。');
  }
  // 7 power and cooling
  {
    const p = page(7);
    head(p, 144, '電気');
    row(p, 172, '入力', `${SPEC.power.acV} V`, '交流');
    row(p, 200, 'ポッド全体（出典）', `${SPEC.pod.mwNear} MW`, '近く');
    row(p, 228, 'ラック 1 台（推測）', `約 ${fmt(rackKW())}`, 'kW');
    row(p, 256, 'チップ 1 個あたり（推測）', `約 ${fx(chipKW(), 2)}`, 'kW');
    note(p, 284, `推測: ${SPEC.pod.mwNear} MW ÷ ${SPEC.pod.cubes} ラック、÷ ${fmt(SPEC.pod.chips)} チップ。OCS・CDU・ホストを含むかは書かれていない。<br>電力の頭打ちは ${SPEC.power.cappingMs} ms 未満で効く（出典3）。`);
    rule(p, 360);
    head(p, 370, '液冷');
    row(p, 398, '流量・温度', '公開されていない', '');
    row(p, 426, '流量の調節', '弁', '');
    row(p, 454, '熱の出口', '液と空気', '');
    note(p, 482, '行き（淡い線）と帰り（濃い線）は同じ色の濃淡で分ける。流れの速さは説明用で、実際の流量ではない。');
  }
  add(`<div class="sm" style="position:absolute;left:1278px;top:722px;font-size:11px;letter-spacing:.02em">動きは説明用に引き伸ばしています</div>`);

  // ------------------------------------------------------------ 05 the explanation band
  panel(28, 752, 1544, 120, '', '05');
  const bandT = add(`<div style="position:absolute;left:44px;top:760px;font:700 16px ${SANS};letter-spacing:.04em;white-space:nowrap"></div>`);
  const bandText = add(`<div style="position:absolute;left:44px;top:786px;width:880px;font:500 13.5px/1.6 ${SANS};color:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:944px;top:762px;width:1px;height:96px;background:${C.line}"></div>`);
  const labBox = add(`<div style="position:absolute;left:960px;top:762px;width:598px;font:500 11px/1.9 ${MONO};color:${C.ink};white-space:nowrap;letter-spacing:-.01em"></div>`);
  add(`<div class="sm" style="position:absolute;left:24px;top:876px;font-size:10.5px;letter-spacing:.02em;background:${C.bg};padding:1px 6px;border-radius:3px">${NOTICE}</div>`);
  const caption = add(`<div class="nvcap" style="display:none"></div>`);

  // ------------------------------------------------------------ callouts, tags, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const tagG = add(`<div style="position:absolute;inset:0"></div>`);
  const pointer = ui.late();
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, ui.centre(n)]));

  let lastCh = -1;
  return {
    btn,
    spots,
    subIds,
    root: ui.root,
    update(s) {
      const ch = CHAPTERS[s.chapter - 1];
      if (s.chapter !== lastCh) {
        lastCh = s.chapter;
        for (const c of CHAPTERS) onBtn(btn[`c_${c.n}`], c.n === s.chapter);
        for (const n of Object.keys(subIds)) for (const id of subIds[n]) btn[`s_${id}`].style.display = Number(n) === s.chapter ? 'flex' : 'none';
        for (const [n, pg] of Object.entries(pages)) pg.style.display = Number(n) === s.chapter ? 'block' : 'none';
        bandT.textContent = `${ch.n}　${ch.name}`;
        bandText.textContent = ch.text;
        labBox.innerHTML =
          `<span style="color:${C.mute};font-family:${SANS};font-weight:700">実機で見るには</span>` +
          (ch.lab.length ? ch.lab.map((l) => `<br>${l.cmd.replace(/</g, '&lt;')}`).join('') + `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labWhat}（Cloud の実機のみ）</span>` : `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labNote}</span>`);
      }
      for (const id of subIds[s.chapter]) onBtn(btn[`s_${id}`], !!s.lit?.[id]);
      subNote.textContent = s.note ?? '';
      const g = s.g ?? {};
      if (s.chapter === 2) pullV.innerHTML = `${Math.round((s.pull ?? 0) * 100)}<small>%</small>`;
      if (s.chapter === 3) {
        const counts = s.scene === 'hop' || s.scene === 'wrap';
        hopsV.innerHTML = counts ? `${g.hops}<small>回</small>` : `<span style="font:600 15px ${SANS};color:${C.mute}">「角から角へ」で数える</span>`;
        hopsV.style.color = counts && g.hops ? C.accent : C.ink;
        linksV.innerHTML = `${s.scene === 'six' ? g.links : 6} / 6<small>本</small>`;
      }
      if (s.chapter === 4) {
        G4.cubes.innerHTML = `${fmt(g.cubes)}<small>個の立方体${g.cubes > 4 ? `（${fmt(g.cubes * chipCount())} チップ）` : `（${g.cubes * chipCount()} チップ）`}</small>`;
        G4.shape.textContent = g.shape.replace(/x/g, '×') + (s.scene === 'pod' ? '（仮定）' : '');
        G4.max.innerHTML = `${g.maxHops}<small>回</small>`;
        G4.swap.textContent = s.scene === 'swap' ? (g.swapped ? '済み' : 'まだ') : '—';
        G4.swap.style.color = g.swapped ? C.accent : C.ink;
        for (const k of Object.keys(G4)) if (k.startsWith('r_')) G4[k].querySelector('b').style.color = k === `r_${g.shape}` ? C.accent : C.ink;
      }
      if (s.chapter === 5) {
        G5.nv.val.textContent = `${g.nvHops ?? 0} / ${NVL.hops}`;
        G5.iw.val.textContent = `${g.hops ?? 0} / ${diameter(SPEC.cube.dims)}`;
        G5.iw.f.style.width = `${Math.max(2, (278 * (g.hops ?? 0)) / 32)}px`;
        G5.nv.f.style.width = `${Math.max(2, (278 * (g.nvHops ?? 0)) / 32)}px`;
      }
      caption.style.display = s.caption ? 'block' : 'none';
      caption.textContent = s.caption ?? '';
      // tags over the 3D (they sit beside the part, no leaders)
      const TX = {l: '-100%', c: '-50%', r: '0'};
      const TY = {t: '0', m: '-50%', b: '-100%'};
      tagG.innerHTML = (s.tags ?? [])
        .filter((t) => t.o > 0.02 && t.x > 340 && t.x < 1260 && t.y < 742 && t.y > 140)
        .map((t) => `<div class="tg ${t.kind}${t.on ? ' on' : ''}" style="left:${t.x.toFixed(1)}px;top:${t.y.toFixed(1)}px;transform:translate(${TX[t.h]},${TY[t.v]});opacity:${t.o.toFixed(2)}">${t.html}</div>`)
        .join('');
      // callouts: a numbered dot, the name, the one-line spec, a thin leader to the part
      let lh = '';
      let ch2 = '';
      for (const c of s.callouts ?? []) {
        if (c.o < 0.02) continue;
        const [ax, ay] = c.at;
        const [ex, ey] = c.end;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${C.accent}" stroke-width="1.2" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3.2" fill="${C.accent}" opacity="${c.o.toFixed(2)}"/>`;
        ch2 += `<div class="call n" style="left:${c.label[0].toFixed(1)}px;top:${c.label[1].toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i class="nb">${c.n}</i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch2;
      pointer(s.cursor);
    },
    pointer,
    MONO,
  };
}
