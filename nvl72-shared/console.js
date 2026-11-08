// The rack's console, laid out at 1600 x 900 like the switch's (switch-shared/console.js), all in Japanese: the title
// block on a paper strip; on the left the seven chapter buttons, the chapter's buttons (views / open-close / scenes) with
// the cooling slider, and the controls; on the right the gauges of the chapter (the rack, the tray, 1,296 = 1,296, the
// all-reduce bars, inside vs outside, the power, the coolant flow); along the bottom the chapter's explanation and the
// command to run on the real machine. update(s) redraws every live part from the frame's state; nothing here keeps time.
import {C, createChrome, MONO, SANS} from '../kit/ui.js';
import {
  busAmps,
  CHAPTERS,
  coreCount,
  flowKgS,
  flowLpm,
  gpuCount,
  gpuSidePorts,
  graceCount,
  hbmTotalGB,
  hbmTotalTBs,
  inOutRatio,
  IN_USE,
  installedKW,
  linkGBs,
  linkOneWayGBs,
  lpddrTotalGB,
  NEXT_GEN,
  nicGBs,
  NOTICE,
  rackTBs,
  ringMs,
  ringSentGB,
  SCENES,
  sharpMs,
  sharpSentGB,
  SPEC,
  switchChips,
  switchSidePorts,
  switchTrayTbps,
  usableKW,
} from './kin.js';

export const subsOf = (n) => {
  const c = CHAPTERS[n - 1];
  if (c.subs) return c.subs;
  return c.scenes.map((id) => ({id, label: SCENES[id].name}));
};
export const SUB_NOTE = {front: '前から: トレイの並びと前面のポート', back: '後ろから: カートリッジ・マニホールド・母線', open: '引き出して、上の層から順に浮かせる', close: '下の層から戻して、押し込む'};
const CSS = `
.bt[data-n]::before{content:attr(data-n);position:absolute;left:11px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;font:700 12px ${SANS};display:flex;align-items:center;justify-content:center;letter-spacing:0}
.bt[data-n]{padding-left:22px}
.call{padding:4px 9px 5px 6px;border-radius:5px;background:rgba(252,250,246,.94);border:1px solid ${C.line}}
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
.tg.note{font:600 12px ${SANS};color:${C.sub};letter-spacing:.04em;padding:2px 8px;border-radius:4px;background:rgba(252,250,246,.9)}
.gr{position:absolute;left:1278px;width:280px;white-space:nowrap;display:flex;align-items:baseline;justify-content:space-between;font:500 12.5px ${SANS};color:${C.sub}}
.gr b{font:700 17px Inter,${SANS};color:${C.ink}}
.gr b small{font:500 12px ${SANS};color:${C.sub};margin-left:3px}
.gs{position:absolute;left:1278px;width:280px;font:500 11px/1.45 ${SANS};color:${C.mute};white-space:normal}
.gh{position:absolute;left:1278px;font:700 13px ${SANS};color:${C.ink};letter-spacing:.04em;white-space:nowrap}
.gl{position:absolute;left:1278px;width:278px;height:1px;background:${C.line}}
.big{position:absolute;left:1278px;width:280px;white-space:nowrap;font:700 30px Inter,${SANS};color:${C.ink};letter-spacing:-.01em}
.big small{font:500 14px ${SANS};color:${C.sub};margin-left:4px;letter-spacing:0}
.trk{position:absolute;height:10px;border-radius:2px;background:#ebe2d4}
.fil{position:absolute;height:10px;border-radius:2px}
.nvcap{position:absolute;left:800px;top:110px;transform:translateX(-50%);max-width:880px;padding:5px 14px;border-radius:5px;background:rgba(252,250,246,.93);border:1px solid ${C.line};font:700 16px ${SANS};color:${C.ink};letter-spacing:.03em;white-space:nowrap}
.sl{position:absolute;left:44px;width:268px;height:46px}
.sl .t{position:absolute;left:8px;right:8px;top:30px;height:6px;border-radius:3px;background:#ebe2d4}
.sl .k{position:absolute;top:24px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:${C.accent};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.sl .v{position:absolute;left:0;top:0;font:700 13px ${SANS};color:${C.ink}}
.sl .r{position:absolute;right:0;top:2px;font:500 11px ${SANS};color:${C.mute}}
`;
const fx = (n, d) => Number(n).toFixed(d);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const unit = (u, px = 14) => `<span style="font-size:${px}px;font-weight:500"> ${u}</span>`;
/** the slider's track in px (x of a temperature difference) */
export const SLIDER = {x0: 52, x1: 304, y: 0};
export const dTx = (dT) => SLIDER.x0 + ((dT - SPEC.cool.dTMin) / (SPEC.cool.dTMax - SPEC.cool.dTMin)) * (SLIDER.x1 - SLIDER.x0);

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = createChrome(app);
  const {add, panel, onBtn} = ui;
  const btn = {};

  // ------------------------------------------------------------ header: a paper strip so the title never sits on the 3D
  add(`<div style="position:absolute;left:0;top:0;width:1600px;height:98px;background:rgba(239,233,223,.96);border-bottom:1px solid ${C.line}"></div>`);
  add(`<div style="position:absolute;left:0;top:0;width:150px;height:92px;background:${C.accent}"></div>`);
  add(`<svg style="position:absolute;left:52px;top:12px" width="46" height="68" viewBox="0 0 46 68"><rect x="4" y="2" width="38" height="64" rx="2" fill="none" stroke="#fff" stroke-width="3"/><path d="M10 9h26v4H10zM10 17h26v3H10zM10 23h26v3H10zM10 29h26v3H10zM10 36h26v3H10zM10 42h26v3H10zM10 48h26v3H10zM10 55h26v4H10z" fill="#fff"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:172px;top:16px;letter-spacing:.12em">ネットワーク機器のしくみ　02</div>`);
  add(`<div style="position:absolute;left:170px;top:34px;font:700 34px ${SANS};letter-spacing:.02em;line-height:1">GPU ラックの分解 <span style="color:${C.accent};font-weight:400">/</span> <span style="font-size:24px">GB200 NVL72 風・72 GPU</span></div>`);
  add(`<div style="position:absolute;left:172px;top:76px;font:500 14px ${SANS};color:${C.sub};letter-spacing:.04em">計算トレイ ${SPEC.computeTrays}・NVLink スイッチトレイ ${SPEC.switchTrays}・電源棚 ${SPEC.powerShelves}・液冷・約 ${SPEC.power.rackKW} kW</div>`);
  add(`<div style="position:absolute;left:1036px;top:16px;width:540px;height:72px;background:${C.panel};border:1px solid ${C.line};border-radius:6px"></div>`);
  [['GPU', String(gpuCount()), '個'], ['NVLink', String(SPEC.nvlink.rackTBs), 'TB/s'], ['消費電力', `約 ${SPEC.power.rackKW}`, 'kW']].forEach(([k, v, u], i) => {
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

  // ------------------------------------------------------------ 02 the chapter's buttons (and the cooling slider)
  panel(28, 418, 300, 176, '見せ方', '02');
  const subIds = {};
  CHAPTERS.forEach((c) => {
    subIds[c.n] = subsOf(c.n).map((sb, j) => {
      const b = add(`<div class="bt" style="left:44px;top:${454 + j * 36}px;width:268px;height:30px;display:none">${sb.label}</div>`);
      btn[`s_${sb.id}`] = b;
      return sb.id;
    });
  });
  const subNote = add(`<div style="position:absolute;left:44px;top:562px;width:268px;font:500 12px/1.35 ${SANS};color:${C.sub}"></div>`);
  const slider = add(`<div class="sl" style="top:496px;display:none"><div class="v"></div><div class="r">${SPEC.cool.dTMin}〜${SPEC.cool.dTMax} K</div><div class="t"></div><div class="k"></div></div>`);
  const slV = slider.querySelector('.v');
  const slK = slider.querySelector('.k');

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
  const note = (pg, y, t) => put(pg, `<div class="gs" style="top:${y}px">${t}</div>`);
  const rule = (pg, y) => put(pg, `<div class="gl" style="top:${y}px"></div>`);
  const bar = (pg, y, w, color) => {
    put(pg, `<div class="trk" style="left:1278px;top:${y}px;width:278px"></div>`);
    return put(pg, `<div class="fil" style="left:1278px;top:${y}px;width:${w}px;background:${color}"></div>`);
  };
  // 1 the rack
  {
    const p = page(1);
    head(p, 144, 'ラック全体（出典の値）');
    const R = [
      ['GPU（B200）', `${gpuCount()}`, '個'],
      ['Grace CPU', `${graceCount()}`, '個'],
      ['CPU コア', fmt(coreCount()), ''],
      ['HBM3e', `${SPEC.perf.hbmTB}`, 'TB'],
      ['HBM の帯域', `${SPEC.perf.hbmTBs}`, 'TB/s'],
      ['LPDDR5X', `${SPEC.perf.lpddrTB}`, 'TB'],
      ['FP4（疎 / 密）', `${fmt(SPEC.perf.fp4Sparse)} / ${SPEC.perf.fp4Dense}`, 'PFLOPS'],
      ['FP8（疎）', `${SPEC.perf.fp8Sparse}`, 'PFLOPS'],
      ['NVLink（ラック）', `${SPEC.nvlink.rackTBs}`, 'TB/s'],
      ['消費電力', `約 ${SPEC.power.rackKW}`, 'kW'],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 31, k, v, u));
    rule(p, 488);
    note(p, 498, `検算: HBM ${SPEC.computeTrays * 4} × ${SPEC.gpu.hbmGB} GB = ${fmt(hbmTotalGB())} GB、帯域 72 × ${SPEC.gpu.hbmTBs} TB/s = ${hbmTotalTBs()} TB/s、LPDDR5X 36 × ${SPEC.grace.lpddrGB} GB = ${fmt(lpddrTotalGB())} GB、コア 36 × ${SPEC.grace.cores} = ${fmt(coreCount())}。<br>LPDDR5X の帯域は出典の値が合わないので出さない。重さは NVIDIA の値が無いので描かない。`);
    rule(p, 582);
    head(p, 588, '実際に使われている所（脚注）');
    put(p, `<div class="gs" style="top:605px;font-size:10.5px;line-height:1.3">${IN_USE.map((l) => `・${l}`).join('<br>')}</div>`);
  }
  // 2 the tray
  let pullV;
  {
    const p = page(2);
    head(p, 144, '計算トレイ 1 台');
    const R = [
      ['GB200 スーパーチップ', `${SPEC.tray.superchips}`, '枚'],
      ['Grace CPU', `${SPEC.tray.grace}`, `× ${SPEC.grace.cores} コア`],
      ['LPDDR5X（Grace 1 個）', `${SPEC.grace.lpddrGB}`, 'GB'],
      ['B200 GPU', `${SPEC.tray.gpus}`, '個'],
      ['HBM3e（GPU 1 個）', `${SPEC.gpu.hbmGB} GB・${SPEC.gpu.hbmTBs}`, 'TB/s'],
      ['NVLink-C2C（双方向）', `${SPEC.c2cGBs}`, 'GB/s'],
      ['ConnectX-7', `${SPEC.tray.cx7} × ${SPEC.cx7Gbps}`, 'Gb/s'],
      ['BlueField-3', `${SPEC.tray.bf3} × ${SPEC.bf3.ports}`, 'ポート'],
      ['E1.S NVMe（RAID 0）', `${SPEC.tray.e1s} × ${SPEC.e1sTB}`, 'TB'],
      ['M.2（起動用）', `${SPEC.m2TB}`, 'TB'],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 31, k, v, u));
    rule(p, 488);
    note(p, 496, `B200 の ${SPEC.gpu.hbmGB} GB・${SPEC.gpu.hbmTBs} TB/s は、スーパーチップあたり 372 GB・16 TB/s を GPU 2 個で割った計算。<br>液で冷やす: Grace・B200・ConnectX-7。空冷: それ以外。`);
    pullV = row(p, 572, '引き出した量', '0', '%').querySelector('b');
  }
  // 3 NVLink
  let hopsV;
  let linksV;
  {
    const p = page(3);
    head(p, 144, 'NVLink のポートの数');
    put(p, `<div class="big" style="top:166px">${fmt(gpuSidePorts())} = ${fmt(switchSidePorts())}</div>`);
    note(p, 206, `GPU ${gpuCount()} × ${SPEC.nvlink.linksPerGpu} 本 ＝ スイッチ ${switchChips()} 個 × ${SPEC.nvlink.portsPerChip} ポート`);
    rule(p, 232);
    row(p, 242, '1 本のリンク（双方向）', `${fmt(linkGBs())}`, 'GB/s');
    row(p, 270, '片方向', `${fmt(linkOneWayGBs())}`, 'GB/s');
    row(p, 298, 'GPU 1 個（18 本）', `${SPEC.nvlink.gpuTBs}`, 'TB/s');
    row(p, 326, 'ラック（72 × 1.8）', `${fx(rackTBs(), 1)} ≈ ${SPEC.nvlink.rackTBs}`, 'TB/s');
    row(p, 354, 'スイッチトレイ（片方向の合計）', `${fx(switchTrayTbps(), 1)}`, 'Tb/s');
    rule(p, 386);
    linksV = row(p, 396, 'いま描いたリンク', '0 / 18', '本').querySelector('b');
    head(p, 432, '通ったスイッチの数');
    hopsV = put(p, `<div class="big" style="top:452px;font-size:40px">0<small>個</small></div>`);
    note(p, 502, 'どの GPU の組でも 1 個（72 × 71 組を検算）');
    rule(p, 600);
    head(p, 610, '次の世代（脚注）');
    note(p, 630, NEXT_GEN.map((l) => `・${l}`).join('<br>'));
  }
  // 4 all-reduce
  const AR = {};
  {
    const p = page(4);
    head(p, 144, '集計: 1 GB を 72 個で合計');
    const SC = 278 / 2.2; // px per GB, and per ms below (both 0..2.2)
    const grp = (y, title, unitS, ring, sharp, key) => {
      put(p, `<div class="sm" style="position:absolute;left:1278px;top:${y}px;font-size:12px">${title}</div>`);
      const cur = put(p, `<div style="position:absolute;left:1380px;top:${y - 4}px;width:176px;text-align:right;font:700 20px Inter,${SANS};white-space:nowrap"></div>`);
      const r = [];
      [['リング', ring], ['SHARP', sharp]].forEach(([k, v], i) => {
        const yy = y + 30 + i * 40;
        put(p, `<div style="position:absolute;left:1278px;top:${yy}px;width:120px;font:600 12px ${SANS};color:${C.sub}">${k}</div>`);
        put(p, `<div class="mo" style="position:absolute;left:1380px;top:${yy}px;width:176px;text-align:right;font-size:12px;color:${C.sub}">${fx(v, 3)} ${unitS}</div>`);
        put(p, `<div class="trk" style="left:1278px;top:${yy + 18}px;width:278px"></div>`);
        put(p, `<div style="position:absolute;left:${1278 + v * SC - 1}px;top:${yy + 15}px;width:2px;height:16px;background:${C.mute}"></div>`);
        r.push(put(p, `<div class="fil" style="left:1278px;top:${yy + 18}px;width:0;background:${C.ink}"></div>`));
      });
      AR[key] = {cur, r};
    };
    grp(176, '1 個が送った量', 'GB', ringSentGB(), sharpSentGB(), 'gb');
    grp(306, 'かかる時間（帯域だけ）', 'ms', ringMs(), sharpMs(), 'ms');
    rule(p, 436);
    note(p, 446, `リング: 2 × (72 − 1) / 72 × 1 GB = ${fx(ringSentGB(), 3)} GB を ${2 * 71} 回に分けて隣へ。<br>SHARP: 1 GB を送るだけ。足し算は NVSwitch の中。<br>時間 = 送る量 ÷ 片方向 ${SPEC.allreduce.oneWayGBs} GB/s。遅延を入れない単純計算。実測は all_reduce_perf の algbw・busbw で見る。`);
  }
  // 5 inside vs outside
  {
    const p = page(5);
    head(p, 144, 'GPU 1 個のラックの中と外');
    row(p, 176, 'NVLink（ラックの中）', `${SPEC.nvlink.gpuTBs}`, 'TB/s');
    bar(p, 204, 278, C.accent);
    row(p, 232, 'ConnectX-7（ラックの外）', `${fmt(nicGBs())}`, 'GB/s');
    bar(p, 260, 278 / inOutRatio(), C.ink);
    note(p, 278, `${SPEC.cx7Gbps} Gb/s × 2（双方向）÷ 8 = ${fmt(nicGBs())} GB/s`);
    put(p, `<div class="big" style="top:312px;font-size:40px">${fmt(inOutRatio())}<small>倍</small></div>`);
    note(p, 364, `${SPEC.nvlink.gpuTBs} TB/s ÷ ${fmt(nicGBs())} GB/s。だから一番よく話す GPU どうしをラックの中に置く。`);
    rule(p, 410);
    row(p, 420, '計算用', 'InfiniBand', '');
    note(p, 446, 'GPU 1 個に ConnectX-7 1 枚・レールに沿った fat tree');
    row(p, 482, 'ストレージ用', 'Ethernet', '');
    note(p, 508, 'BlueField-3 から RoCE');
  }
  // 6 power
  let ampsV;
  {
    const p = page(6);
    head(p, 144, '電力');
    const PX = 278 / 280;
    [['積んだ', installedKW(), `${SPEC.power.shelves} × ${SPEC.power.psuPerShelf} × ${SPEC.power.psuKW} kW`], ['使える（N+N）', usableKW(), '半分は予備'], ['消費', SPEC.power.rackKW, '約 120 kW・使える 132 kW に収まる']].forEach(([k, v, n], i) => {
      const y = 176 + i * 58;
      row(p, y, k, `${fmt(v)}`, 'kW');
      bar(p, y + 26, v * PX, i === 2 ? C.accent : C.ink);
      note(p, y + 38, n);
    });
    rule(p, 360);
    row(p, 370, '母線の電圧（直流）', `${SPEC.power.busV}〜${SPEC.power.busVmax}`, 'V');
    head(p, 404, '母線の電流');
    ampsV = put(p, `<div class="big" style="top:424px;font-size:40px">0<small>A</small></div>`);
    note(p, 474, `${SPEC.power.rackKW} kW ÷ ${SPEC.power.busV} V = ${fmt(busAmps())} A。太い銅の板で運ぶ（何本に分けるかは書かない）。`);
    note(p, 520, `電源棚 1 台: 空冷の ${SPEC.power.psuKW} kW 電源 × ${SPEC.power.psuPerShelf}、入力 ${SPEC.power.shelfInKW} kW`);
  }
  // 7 coolant
  let dTV;
  let lpmV;
  let kgV;
  let chartDot;
  const CHT = {x: 1306, y: 400, w: 236, h: 120};
  {
    const p = page(7);
    head(p, 144, '液冷の流量（計算例）');
    dTV = row(p, 176, '入口と出口の温度差', '10', 'K').querySelector('b');
    put(p, `<div class="sm" style="position:absolute;left:1278px;top:212px;font-size:12px">流量</div>`);
    lpmV = put(p, `<div class="big" style="top:228px;font-size:40px"></div>`);
    kgV = note(p, 280, '');
    rule(p, 316);
    put(p, `<div class="sm" style="position:absolute;left:1278px;top:326px;font-size:12px">温度差と流量（L/分）</div>`);
    // the curve: L/分 against K, 5..20; axis labels outside the plot so the dot never covers them
    const xs = (d) => ((d - SPEC.cool.dTMin) / (SPEC.cool.dTMax - SPEC.cool.dTMin)) * CHT.w;
    const ys = (l) => CHT.h - (l / 360) * CHT.h;
    let path = '';
    for (let k = 0; k <= 60; k++) {
      const d = SPEC.cool.dTMin + (k / 60) * (SPEC.cool.dTMax - SPEC.cool.dTMin);
      path += `${k ? 'L' : 'M'}${xs(d).toFixed(1)} ${ys(flowLpm(d)).toFixed(1)}`;
    }
    const ax = `font-size="10.5" fill="${C.mute}" font-family="${SANS}"`;
    put(
      p,
      `<svg style="position:absolute;left:${CHT.x}px;top:${CHT.y - 50}px;overflow:visible" width="${CHT.w}" height="${CHT.h + 50}"><g transform="translate(0,50)">` +
        `<line x1="0" x2="${CHT.w}" y1="${CHT.h}" y2="${CHT.h}" stroke="${C.ink}"/><line x1="0" x2="0" y1="0" y2="${CHT.h}" stroke="${C.faint}"/>` +
        `<path d="${path}" fill="none" stroke="${C.accent}" stroke-width="2.2"/>` +
        `<text x="0" y="${CHT.h + 14}" ${ax}>${SPEC.cool.dTMin} K</text><text x="${CHT.w}" y="${CHT.h + 14}" text-anchor="end" ${ax}>${SPEC.cool.dTMax} K</text>` +
        `<text x="-11" y="${ys(344.5) + 4}" text-anchor="end" ${ax}>344</text><text x="-11" y="${ys(172.25) + 4}" text-anchor="end" ${ax}>172</text>` +
        `</g></svg>`,
    );
    chartDot = put(p, `<svg style="position:absolute;left:${CHT.x}px;top:${CHT.y}px;overflow:visible" width="${CHT.w}" height="${CHT.h}"></svg>`);
    note(p, 548, `仮定: 熱が全部液に行く、水の比熱 ${SPEC.cool.cpKJ} kJ/kg·K、1 L = 1 kg。冷却液の温度・流量は NVIDIA の GB200 の文書に無い。`);
    note(p, 600, '空冷（灰色）: 電源棚・NIC の周り・記憶装置');
    chartDot._xs = xs;
    chartDot._ys = ys;
  }
  add(`<div class="sm" style="position:absolute;left:1278px;top:722px;font-size:11px;letter-spacing:.02em">動きは説明用に引き伸ばしています</div>`);

  // ------------------------------------------------------------ 05 the explanation band
  panel(28, 752, 1544, 120, '', '05');
  const bandT = add(`<div style="position:absolute;left:44px;top:760px;font:700 16px ${SANS};letter-spacing:.04em;white-space:nowrap"></div>`);
  const bandText = add(`<div style="position:absolute;left:44px;top:786px;width:880px;font:500 14px/1.62 ${SANS};color:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:944px;top:762px;width:1px;height:96px;background:${C.line}"></div>`);
  const labBox = add(`<div style="position:absolute;left:960px;top:762px;width:598px;font:500 12.5px/1.9 ${MONO};color:${C.ink};white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:24px;top:876px;font-size:11px;letter-spacing:.06em;background:${C.bg};padding:1px 6px;border-radius:3px">${NOTICE}</div>`);
  const caption = add(`<div class="nvcap" style="display:none"></div>`);

  // ------------------------------------------------------------ callouts, tags, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const tagG = add(`<div style="position:absolute;inset:0"></div>`);
  const pointer = ui.late();
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, ui.centre(n)]));
  // the slider's knob at 5 / 10 / 20 K, for the tour's cursor
  for (const d of [SPEC.cool.dTMin, SPEC.cool.dTDefault, SPEC.cool.dTMax]) spots[`dT_${d}`] = [dTx(d), 496 + 33];

  let lastCh = -1;
  return {
    btn,
    spots,
    subIds,
    slider,
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
          (ch.lab.length ? ch.lab.map((l) => `<br>${l.cmd}`).join('') + `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labWhat}（実機のみ）</span>` : `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labNote}</span>`);
        slider.style.display = s.chapter === 7 ? 'block' : 'none';
      }
      for (const id of subIds[s.chapter]) onBtn(btn[`s_${id}`], !!s.lit?.[id]);
      subNote.textContent = s.note ?? '';
      subNote.style.top = s.chapter === 7 ? '556px' : '562px';
      const g = s.g ?? {};
      // 2
      if (s.chapter === 2) pullV.innerHTML = `${Math.round((s.pull ?? 0) * 100)}<small>%</small>`;
      // 3
      if (s.chapter === 3) {
        hopsV.innerHTML = s.scene === 'hop' ? `${g.hops}<small>個</small>` : `<span style="font:600 15px ${SANS};color:${C.mute}">「GPU から GPU へ」で数える</span>`;
        hopsV.style.color = s.scene === 'hop' && g.hops ? C.accent : C.ink;
        linksV.innerHTML = `${s.scene === 'fan' ? g.links : 18} / 18<small>本</small>`;
      }
      // 4
      if (s.chapter === 4) {
        const SC = 278 / 2.2;
        const isRing = s.scene === 'ring';
        AR.gb.cur.innerHTML = `${fx(g.sentGB ?? 0, 3)}${unit('GB', 13)}`;
        AR.ms.cur.innerHTML = `${fx(g.ms ?? 0, 3)}${unit('ms', 13)}`;
        AR.gb.r[0].style.width = `${(isRing ? g.sentGB : ringSentGB()) * SC}px`;
        AR.gb.r[1].style.width = `${(isRing ? sharpSentGB() : g.sentGB) * SC}px`;
        AR.ms.r[0].style.width = `${(isRing ? g.ms : ringMs()) * SC}px`;
        AR.ms.r[1].style.width = `${(isRing ? sharpMs() : g.ms) * SC}px`;
        // the scene that runs is the ink bar; the other one is shown at its final value, faint
        for (const k of ['gb', 'ms']) {
          AR[k].r[0].style.background = isRing ? C.accent : C.faint;
          AR[k].r[1].style.background = isRing ? C.faint : C.accent;
        }
      }
      // 6
      if (s.chapter === 6) ampsV.innerHTML = `${fmt(g.amps ?? 0)}<small>A</small>`;
      // 7
      if (s.chapter === 7) {
        const d = s.dT ?? SPEC.cool.dTDefault;
        dTV.innerHTML = `${fx(d, 1)}<small>K</small>`;
        lpmV.innerHTML = `${fmt(flowLpm(d))}<small>L/分</small>`;
        kgV.textContent = `${SPEC.power.rackKW} kW ÷ (${SPEC.cool.cpKJ} × ${fx(d, 1)} K) = ${fx(flowKgS(d), 3)} kg/s`;
        chartDot.innerHTML = `<circle cx="${chartDot._xs(d).toFixed(1)}" cy="${chartDot._ys(flowLpm(d)).toFixed(1)}" r="4.5" fill="#fff" stroke="${C.accent}" stroke-width="2.4"/>`;
        slV.textContent = `温度差 ${fx(d, 1)} K`;
        slK.style.left = `${dTx(d) - 44}px`;
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
