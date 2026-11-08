// The server's console, laid out at 1600 x 900 like the rack's (nvl72-shared/console.js), all in Japanese: the title
// block on a paper strip; on the left the seven chapter buttons, the chapter's buttons (views / open-close / scenes)
// with the rack's power-limit slider and the air's temperature slider, and the controls; on the right the gauges of the
// chapter (the box, the two trays, 144 = 144, inside vs outside, the all-reduce bars, the power, the airflow); along the
// bottom the chapter's explanation and the command to run on the real machine. update(s) redraws every live part from
// the frame's state; nothing here keeps time.
import {C, createChrome, MONO, SANS} from '../kit/ui.js';
import {
  airCfm,
  airM3s,
  airWaterRatio,
  boxOutGB,
  cacheTB,
  CHAPTERS,
  clusterKW,
  clusterU,
  coreCount,
  dimmGB,
  DT_SRC,
  gpuSidePorts,
  hbmTotalGB,
  hbmTotalTBs,
  heatW,
  heightMM,
  hierMs,
  inDomain,
  inDomainFrac,
  inMs,
  inOutRatio,
  inSentGB,
  installedKW,
  kwPerGpu,
  LIQUID_NOTE,
  linkGBs,
  linkOneWayGBs,
  linksPerChip,
  NEXT_GEN,
  netOneWayGBs,
  nicGBs,
  NOTICE,
  nvl72KwPerGpu,
  nvl72Ms,
  nvlinkTotalTBs,
  others,
  outMs,
  outSentGB,
  perRackBySpace,
  perRackOf,
  psuAmps,
  psuLoadKW,
  racksFor,
  SCENES,
  SPEC,
  switchSidePorts,
  usableKW,
  vsRatio,
  waterLpm,
} from './kin.js';

export const subsOf = (n) => {
  const c = CHAPTERS[n - 1];
  if (c.subs) return c.subs;
  return c.scenes.map((id) => ({id, label: SCENES[id].name}));
};
export const SUB_NOTE = {front: '前から: ベゼルを付けた姿', bezel: 'ベゼルを外す: ファンモジュールと U.2', back: '後ろから: 電源 6 台・OSFP 4 個', open: '後ろへ引き出して、上の層から順に浮かせる', close: '下の層から戻して、押し込む'};
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
.trk{position:absolute;height:10px;border-radius:2px;background:#e1e7ea}
.fil{position:absolute;height:10px;border-radius:2px}
.nvcap{position:absolute;left:800px;top:110px;transform:translateX(-50%);max-width:880px;padding:5px 14px;border-radius:5px;background:rgba(250,251,252,.93);border:1px solid ${C.line};font:700 16px ${SANS};color:${C.ink};letter-spacing:.03em;white-space:nowrap}
.sl{position:absolute;left:44px;width:268px;height:46px}
.sl .t{position:absolute;left:8px;right:8px;top:30px;height:6px;border-radius:3px;background:#e1e7ea}
.sl .k{position:absolute;top:24px;width:18px;height:18px;margin-left:-9px;border-radius:50%;background:${C.accent};border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.25)}
.sl .v{position:absolute;left:0;top:0;font:700 13px ${SANS};color:${C.ink}}
.sl .r{position:absolute;right:0;top:2px;font:500 11px ${SANS};color:${C.mute}}
.sl .tk{position:absolute;top:28px;width:2px;height:10px;margin-left:-1px;background:${C.faint}}
`;
const fx = (n, d) => Number(n).toFixed(d);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const unit = (u, px = 14) => `<span style="font-size:${px}px;font-weight:500"> ${u}</span>`;
/** the sliders' track in px: the air's temperature difference (10..20 K) and the rack's power limit (30..60 kW) */
export const SLIDER = {x0: 52, x1: 304};
export const dTx = (dT) => SLIDER.x0 + ((dT - SPEC.air.dTMin) / (SPEC.air.dTMax - SPEC.air.dTMin)) * (SLIDER.x1 - SLIDER.x0);
const LIM = SPEC.rack.limits;
export const limX = (kw) => SLIDER.x0 + ((kw - LIM[0]) / (LIM[LIM.length - 1] - LIM[0])) * (SLIDER.x1 - SLIDER.x0);
/** the slider tops (page px): the air's under 1 scene button, the rack's under 2 */
export const SL_TOP = {dT: 496, limit: 532};
/** the commands packed two to a line when they fit */
export const labLines = (lab, max = 64) => {
  const out = [];
  for (const l of lab) {
    const last = out[out.length - 1];
    if (last && last.length + 3 + l.cmd.length <= max) out[out.length - 1] = `${last} / ${l.cmd}`;
    else out.push(l.cmd);
  }
  return out;
};
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

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
  add(`<svg style="position:absolute;left:43px;top:20px" width="64" height="52" viewBox="0 0 64 52"><rect x="2" y="2" width="60" height="48" rx="2" fill="none" stroke="#fff" stroke-width="3"/><path d="M8 30h48v3H8z" fill="#fff"/><g fill="none" stroke="#fff" stroke-width="2"><circle cx="15" cy="16" r="6"/><circle cx="32" cy="16" r="6"/><circle cx="49" cy="16" r="6"/></g><path d="M10 39h6v5h-6zM19 39h6v5h-6zM28 39h6v5h-6zM37 39h6v5h-6z" fill="#fff"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:172px;top:16px;letter-spacing:.12em">ネットワーク機器のしくみ　05</div>`);
  add(`<div style="position:absolute;left:170px;top:34px;font:700 34px ${SANS};letter-spacing:.02em;line-height:1">GPU サーバーの分解 <span style="color:${C.accent};font-weight:400">/</span> <span style="font-size:24px">DGX B200 風・8 GPU</span></div>`);
  add(`<div style="position:absolute;left:172px;top:76px;font:500 14px ${SANS};color:${C.sub};letter-spacing:.04em">HGX B200 の基板・GPU トレイとマザーボードトレイ・空冷・約 ${SPEC.power.kw} kW</div>`);
  add(`<div style="position:absolute;left:1036px;top:16px;width:540px;height:72px;background:${C.panel};border:1px solid ${C.line};border-radius:6px"></div>`);
  [['GPU', String(SPEC.gpus), '個'], ['NVLink', String(SPEC.nvlink.totalTBs), 'TB/s'], ['消費電力', `約 ${SPEC.power.kw}`, 'kW']].forEach(([k, v, u], i) => {
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

  // ------------------------------------------------------------ 02 the chapter's buttons (and the two sliders)
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
  const slider = add(`<div class="sl" style="top:${SL_TOP.dT}px;display:none"><div class="v"></div><div class="r">${SPEC.air.dTMin}〜${SPEC.air.dTMax} K</div><div class="t"></div><div class="k"></div></div>`);
  const slV = slider.querySelector('.v');
  const slK = slider.querySelector('.k');
  const ticks = LIM.map((kw) => `<div class="tk" style="left:${limX(kw) - 44}px"></div>`).join('');
  const limSlider = add(`<div class="sl" style="top:${SL_TOP.limit}px;display:none"><div class="v"></div><div class="r">${LIM.join(' / ')} kW</div><div class="t"></div>${ticks}<div class="k"></div></div>`);
  const lmV = limSlider.querySelector('.v');
  const lmK = limSlider.querySelector('.k');

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
  const bar = (pg, y, w, color) => {
    put(pg, `<div class="trk" style="left:1278px;top:${y}px;width:278px"></div>`);
    return put(pg, `<div class="fil" style="left:1278px;top:${y}px;width:${w}px;background:${color}"></div>`);
  };
  // 1 the box
  {
    const p = page(1);
    head(p, 144, 'DGX B200 1 台（出典の値）');
    const R = [
      ['GPU（B200）', `${SPEC.gpus}`, '個'],
      ['HBM3e', `${fmt(SPEC.hbm.totalGB)} GB・${SPEC.hbm.totalTBs}`, 'TB/s'],
      ['NVLink（8 個の合計）', `${SPEC.nvlink.totalTBs}`, 'TB/s'],
      ['Xeon Platinum 8570', `${SPEC.cpu.count} × ${SPEC.cpu.cores}`, 'コア'],
      ['メモリ（DIMM 32 枚）', `${SPEC.mem.TB}`, 'TB'],
      ['ネットワーク（製品の表記）', `${SPEC.net.productTBs}`, 'TB/s'],
      ['キャッシュ U.2 NVMe', `${SPEC.storage.u2} × ${SPEC.storage.u2TB}`, 'TB'],
      ['OS M.2 NVMe（RAID 1）', `${SPEC.storage.m2} × ${SPEC.storage.m2TB}`, 'TB'],
      ['消費電力', `約 ${SPEC.power.kw}`, 'kW'],
      ['重さ', `最大 ${SPEC.chassis.kg}`, 'kg'],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 30, k, v, u));
    rule(p, 476);
    note(p, 486, `検算: 高さ ${SPEC.chassis.u}U × ${SPEC.U_MM} mm = ${fx(heightMM(), 1)} mm（出典 ${SPEC.chassis.h} mm）。HBM ${SPEC.gpus} × ${SPEC.gpu.hbmGB} GB = ${fmt(hbmTotalGB())} GB、${SPEC.gpus} × ${SPEC.gpu.hbmTBs} = ${hbmTotalTBs()} TB/s。キャッシュ ${SPEC.storage.u2} × ${SPEC.storage.u2TB} = ${fx(cacheTB(), 2)} TB。CPU コア ${coreCount()}。`);
    note(p, 566, `幅は出典1 の ${SPEC.chassis.w} mm（耳を含む最大。出典2 は ${SPEC.chassis.wSrc2} mm）。前面のファンの数は NVIDIA が書いていないので出さない。`);
  }
  // 2 the two trays
  let pullV;
  {
    const p = page(2);
    head(p, 144, 'GPU トレイ（HGX B200 の基板）');
    [
      ['B200 GPU', `${SPEC.gpus}`, '個'],
      ['HBM3e（GPU 1 個）', `${SPEC.gpu.hbmGB} GB・${SPEC.gpu.hbmTBs}`, 'TB/s'],
      ['NVSwitch チップ', `${SPEC.nvlink.switches}`, '個'],
      ['GPU 1 個の電力', `最大 ${fmt(SPEC.gpu.maxW)}`, 'W'],
    ].forEach(([k, v, u], i) => row(p, 170 + i * 28, k, v, u));
    head(p, 290, 'マザーボードトレイ');
    [
      ['Xeon Platinum 8570', `${SPEC.cpu.count} × ${SPEC.cpu.cores}`, 'コア'],
      ['クロック', `${SPEC.cpu.ghz}（最大 ${SPEC.cpu.ghzMax}）`, 'GHz'],
      ['DIMM', `${SPEC.mem.dimms} × ${dimmGB()}`, 'GB'],
      ['ConnectX-7', `${SPEC.net.cx7} × ${SPEC.net.cx7Gbps}`, 'Gb/s'],
      ['BlueField-3', `${SPEC.bf3.count} × ${SPEC.bf3.gbps}`, 'Gb/s'],
      ['M.2（OS）', `${SPEC.storage.m2} × ${SPEC.storage.m2TB}`, 'TB'],
    ].forEach(([k, v, u], i) => row(p, 316 + i * 28, k, v, u));
    rule(p, 492);
    note(p, 500, `${SPEC.gpu.hbmGB} GB・${SPEC.gpu.hbmTBs} TB/s は ${fmt(SPEC.hbm.totalGB)} GB・${SPEC.hbm.totalTBs} TB/s を 8 で割った計算。NVL72 の B200 は 186 GB（同じ B200 でも製品ごとに表記が違う）。DIMM 1 枚 ${dimmGB()} GB は 2 TB ÷ 32。描いた 2 段の上下の並びは仮定。CPU と GPU は PCIe Gen5 でつながる。`);
    pullV = row(p, 640, '引き出した量', '0', '%').querySelector('b');
  }
  // 3 NVLink
  let hopsV;
  let linksV;
  {
    const p = page(3);
    head(p, 144, 'NVLink のポートの数');
    put(p, `<div class="big" style="top:166px">${gpuSidePorts()} = ${switchSidePorts()}</div>`);
    note(p, 206, `GPU ${SPEC.gpus} × ${SPEC.nvlink.linksPerGpu} 本 ＝ NVSwitch ${SPEC.nvlink.switches} × ${SPEC.nvlink.portsPerChip} ポート（各 ${linksPerChip()} 本）`);
    rule(p, 232);
    row(p, 242, '1 本のリンク（双方向）', `${fmt(linkGBs())}`, 'GB/s');
    row(p, 270, '片方向', `${fmt(linkOneWayGBs())}`, 'GB/s');
    row(p, 298, 'GPU 1 個（18 本）', `${SPEC.nvlink.gpuTBs}`, 'TB/s');
    row(p, 326, '8 個の合計（8 × 1.8）', `${fx(nvlinkTotalTBs(), 1)}`, 'TB/s');
    rule(p, 358);
    linksV = row(p, 368, 'いま描いたリンク', '0 / 18', '本').querySelector('b');
    head(p, 404, '通ったスイッチの数');
    hopsV = put(p, `<div class="big" style="top:424px;font-size:40px">0<small>個</small></div>`);
    note(p, 474, 'どの GPU の組でも 1 個（8 × 7 = 56 組を検算）。チップのポート数 72 は NVL72 のスイッチと同じとみなした値（HGX B200 では未確認）。');
    rule(p, 590);
    head(p, 600, '次の世代（脚注）');
    note(p, 620, NEXT_GEN.map((l) => `・${l}`).join('<br>'));
  }
  // 4 inside vs outside
  {
    const p = page(4);
    head(p, 144, 'GPU 1 個の箱の中と外');
    row(p, 176, 'NVLink（箱の中）', `${SPEC.nvlink.gpuTBs}`, 'TB/s');
    bar(p, 204, 278, C.accent);
    row(p, 226, 'ConnectX-7（箱の外）', `${fmt(nicGBs())}`, 'GB/s');
    bar(p, 254, 278 / inOutRatio(), C.ink);
    note(p, 270, `${SPEC.net.cx7Gbps} Gb/s × 2（双方向）÷ 8 = ${fmt(nicGBs())} GB/s`);
    put(p, `<div class="big" style="top:296px;font-size:40px">${fmt(inOutRatio())}<small>倍</small></div>`);
    rule(p, 352);
    head(p, 362, '72 個で学習すると、箱の中の相手');
    put(p, `<div class="big" style="top:382px;font-size:40px">${inDomain()} / ${others()}<small>= ${fx(inDomainFrac() * 100, 1)} %</small></div>`);
    note(p, 434, `1 個から見たほかの ${others()} 個のうち NVLink で届く数。NVL72 なら ${others()} / ${others()} = 100 %。`);
    rule(p, 474);
    row(p, 484, 'ネットワーク（ConnectX-7 × 8）', `${SPEC.net.productTBs}`, 'TB/s');
    note(p, 510, `${SPEC.net.cx7} × ${SPEC.net.cx7Gbps} Gb/s = 片方向 ${fmt(netOneWayGBs())} GB/s、双方向で ${fmt(netOneWayGBs() * 2)} GB/s（製品の表記と合う）`);
    row(p, 552, 'レール（リーフ）', `${SPEC.net.rails}`, '本');
    note(p, 578, 'GPU の番号ごとに別のリーフ（出典5c の 1 SU = 32 台・リーフ 8 台からの解釈）。リーフは Quantum QM9700。');
  }
  // 5 all-reduce
  const AR = {};
  {
    const p = page(5);
    head(p, 144, '集計: 1 GB を 72 個（9 台）で合計');
    const GB = 278 / 2;
    const MS = 278 / 7;
    const cur = (y) => put(p, `<div style="position:absolute;left:1400px;top:${y - 4}px;width:156px;text-align:right;font:700 20px Inter,${SANS};white-space:nowrap"></div>`);
    const sm = (y, t) => put(p, `<div class="sm" style="position:absolute;left:1278px;top:${y}px;font-size:12px">${t}</div>`);
    const line = (y, k, v) => {
      put(p, `<div style="position:absolute;left:1278px;top:${y}px;width:200px;white-space:nowrap;font:600 12px ${SANS};color:${C.sub}">${k}</div>`);
      put(p, `<div class="mo" style="position:absolute;left:1456px;top:${y}px;width:100px;text-align:right;font-size:12px;color:${C.sub}">${v}</div>`);
      put(p, `<div class="trk" style="left:1278px;top:${y + 18}px;width:278px"></div>`);
      return put(p, `<div class="fil" style="left:1278px;top:${y + 18}px;width:0"></div>`);
    };
    sm(176, 'GPU 1 個が送った量');
    AR.sent = cur(176);
    AR.inB = line(202, '箱の中（NVLink）', `${fx(inSentGB(), 3)} GB`);
    AR.outB = line(236, '箱の外（InfiniBand）', `${fx(outSentGB(), 4)} GB`);
    sm(278, '1 台から外へ出た量');
    AR.box = cur(278);
    AR.boxB = line(302, 'DGX B200（NVL72 は 0 GB）', `${fx(boxOutGB(), 3)} GB`);
    rule(p, 344);
    sm(354, 'かかる時間（帯域だけ）');
    AR.ms = cur(354);
    AR.dgxB = line(380, 'DGX B200 × 9', `${fx(hierMs(), 3)} ms`);
    AR.nvB = line(414, 'NVL72（リング）', `${fx(nvl72Ms(), 3)} ms`);
    AR.scale = {GB, MS};
    rule(p, 456);
    note(p, 464, `段 1・3（箱の中）: 2 × 7/8 × 1 GB = ${fx(inSentGB(), 2)} GB ÷ 900 GB/s = ${fx(inMs(), 3)} ms。<br>段 2（外のリング）: 2 × 8/9 × 1/8 GB = ${fx(outSentGB(), 4)} GB ÷ 50 GB/s = ${fx(outMs(), 3)} ms。<br>合計 ${fx(hierMs(), 3)} ms は NVL72 の約 ${fx(vsRatio(), 1)} 倍。GPU 1 個の外への速さ（400 Gb/s）はどちらも同じで、違うのは NVLink で届く範囲。2 段の方式は仮定、遅延は入れない。NVL72 の値は nvl72-shared/kin.js から読む。`);
  }
  // 6 power and the rack
  let ampsV;
  let perV;
  {
    const p = page(6);
    head(p, 144, '電力');
    const PX = 278 / 20;
    [['消費（最大）', SPEC.power.kw, '約 14.3 kW'], ['5 台で使える', usableKW(), `${SPEC.power.need} × ${SPEC.power.psuKW} kW・6 台目は予備（5+1）`], ['積んだ 6 台', installedKW(), `${SPEC.power.psus} × ${SPEC.power.psuKW} kW`]].forEach(([k, v, n], i) => {
      const y = 170 + i * 54;
      row(p, y, k, fx(v, 1), 'kW');
      bar(p, y + 24, v * PX, i === 0 ? C.accent : C.ink);
      note(p, y + 36, n);
    });
    rule(p, 334);
    head(p, 342, `電源 1 台の電流（${SPEC.power.vMin} V）`);
    ampsV = put(p, `<div class="big" style="top:360px;font-size:36px">0<small>A</small></div>`);
    note(p, 404, `${SPEC.power.kw} kW ÷ ${SPEC.power.need} 台 = ${fx(psuLoadKW(), 2)} kW ÷ ${SPEC.power.vMin} V = ${fx(psuAmps(), 1)} A（定格 ${SPEC.power.ampsRated} A）。4 台以下なら GPU を ${SPEC.gpu.lowW} W に絞る。`);
    rule(p, 452);
    head(p, 460, 'ラックに何台（上限は仮定）');
    perV = put(p, `<div class="big" style="top:478px;font-size:36px">0<small>台</small></div>`);
    note(p, 522, `場所は 42U ÷ 10U = ${perRackBySpace()} 台。${LIM.map((l) => `${l} kW → ${perRackOf(l)} 台`).join('、')}。`);
    note(p, 556, `72 個そろえると 9 台で ${fx(clusterKW(), 1)} kW・${clusterU()}U（場所だけなら 42U ラック ${racksFor(perRackBySpace())} 本、30 kW なら ${racksFor(perRackOf(30))} 本）。NVL72 は 1 ラック 120 kW。`);
    note(p, 606, `GPU 1 個あたり: DGX B200 ${fx(kwPerGpu(), 2)} kW、NVL72 ${fx(nvl72KwPerGpu(), 2)} kW。発熱 ${fmt(SPEC.power.btuh)} BTU/h ÷ ${SPEC.btuPerW} = 約 ${fmt(Math.round(heatW() / 100) * 100)} W。`);
  }
  // 7 air
  let dTV;
  let cfmV;
  let m3V;
  let outV;
  let chartDot;
  const CHT = {x: 1312, y: 400, w: 230, h: 96};
  {
    const p = page(7);
    head(p, 144, '空冷の風量（計算例）');
    dTV = row(p, 172, '入口と出口の温度差（スライダー）', '16.2', 'K').querySelector('b');
    put(p, `<div class="sm" style="position:absolute;left:1278px;top:204px;font-size:12px">風量</div>`);
    cfmV = put(p, `<div class="big" style="top:220px;font-size:36px"></div>`);
    m3V = note(p, 264, '');
    outV = row(p, 288, '出口の空気が温まった量（いま）', '0', 'K').querySelector('b');
    rule(p, 318);
    put(p, `<div class="sm" style="position:absolute;left:1278px;top:326px;font-size:12px">温度差と風量（CFM）</div>`);
    const xs = (d) => ((d - SPEC.air.dTMin) / (SPEC.air.dTMax - SPEC.air.dTMin)) * CHT.w;
    const ys = (c) => CHT.h - (c / 2800) * CHT.h;
    let path = '';
    for (let k = 0; k <= 60; k++) {
      const d = SPEC.air.dTMin + (k / 60) * (SPEC.air.dTMax - SPEC.air.dTMin);
      path += `${k ? 'L' : 'M'}${xs(d).toFixed(1)} ${ys(airCfm(d)).toFixed(1)}`;
    }
    const ax = `font-size="10.5" fill="${C.mute}" font-family="${SANS}"`;
    put(
      p,
      `<svg style="position:absolute;left:${CHT.x}px;top:${CHT.y - 50}px;overflow:visible" width="${CHT.w}" height="${CHT.h + 50}"><g transform="translate(0,50)">` +
        `<line x1="0" x2="${CHT.w}" y1="${CHT.h}" y2="${CHT.h}" stroke="${C.ink}"/><line x1="0" x2="0" y1="0" y2="${CHT.h}" stroke="${C.faint}"/>` +
        `<path d="${path}" fill="none" stroke="${C.accent}" stroke-width="2.2"/>` +
        `<line x1="${xs(DT_SRC).toFixed(1)}" x2="${xs(DT_SRC).toFixed(1)}" y1="${ys(SPEC.air.cfm).toFixed(1)}" y2="${CHT.h}" stroke="${C.faint}" stroke-dasharray="3 3"/>` +
        `<text x="${xs(DT_SRC).toFixed(1)}" y="${CHT.h + 14}" text-anchor="middle" ${ax}>出典 ${fx(DT_SRC, 1)} K</text>` +
        `<text x="0" y="${CHT.h + 14}" ${ax}>${SPEC.air.dTMin} K</text><text x="${CHT.w}" y="${CHT.h + 14}" text-anchor="end" ${ax}>${SPEC.air.dTMax} K</text>` +
        `<text x="-8" y="${ys(airCfm(10)) + 4}" text-anchor="end" ${ax}>${fmt(airCfm(10))}</text><text x="-8" y="${ys(airCfm(20)) + 4}" text-anchor="end" ${ax}>${fmt(airCfm(20))}</text>` +
        `</g></svg>`,
    );
    chartDot = put(p, `<svg style="position:absolute;left:${CHT.x}px;top:${CHT.y}px;overflow:visible" width="${CHT.w}" height="${CHT.h}"></svg>`);
    chartDot._xs = xs;
    chartDot._ys = ys;
    note(p, 520, `仮定: 空気 ${SPEC.air.rho} kg/m³・${SPEC.air.cpKJ} kJ/kg·K（20 °C）、熱は全部空気へ。入口 ${SPEC.air.inletC} °C なら出口は約 ${fx(SPEC.air.inletC + DT_SRC, 0)} °C。`);
    rule(p, 566);
    row(p, 574, `水なら（温度差 ${SPEC.water.dT} K）`, fx(waterLpm(), 1), 'L/分');
    note(p, 600, `空気 ${fx(airM3s(DT_SRC), 2)} m³/s は水の約 ${fmt(Math.round(airWaterRatio() / 10) * 10)} 倍の体積。NVL72 は 120 kW を 172 L/分の液で運ぶ。`);
    note(p, 644, LIQUID_NOTE, 'font-size:10.5px');
  }
  add(`<div class="sm" style="position:absolute;left:1278px;top:722px;font-size:11px;letter-spacing:.02em">動きは説明用に引き伸ばしています</div>`);

  // ------------------------------------------------------------ 05 the explanation band
  panel(28, 752, 1544, 120, '', '05');
  const bandT = add(`<div style="position:absolute;left:44px;top:760px;font:700 16px ${SANS};letter-spacing:.04em;white-space:nowrap"></div>`);
  const bandText = add(`<div style="position:absolute;left:44px;top:786px;width:880px;font:500 14px/1.62 ${SANS};color:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:944px;top:762px;width:1px;height:96px;background:${C.line}"></div>`);
  const labBox = add(`<div style="position:absolute;left:960px;top:762px;width:598px;font:500 12.5px/1.9 ${MONO};color:${C.ink};white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:24px;top:876px;font-size:11px;letter-spacing:.04em;background:${C.bg};padding:1px 6px;border-radius:3px">${NOTICE}</div>`);
  const caption = add(`<div class="nvcap" style="display:none"></div>`);

  // ------------------------------------------------------------ callouts, tags, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const tagG = add(`<div style="position:absolute;inset:0"></div>`);
  const pointer = ui.late();
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, ui.centre(n)]));
  for (const d of [SPEC.air.dTMin, 15, SPEC.air.dTMax]) spots[`dT_${d}`] = [dTx(d), SL_TOP.dT + 33];
  for (const l of LIM) spots[`lim_${l}`] = [limX(l), SL_TOP.limit + 33];

  let lastCh = -1;
  return {
    btn,
    spots,
    subIds,
    slider,
    limSlider,
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
        labBox.innerHTML = `<span style="color:${C.mute};font-family:${SANS};font-weight:700">実機で見るには</span>` + labLines(ch.lab).map((l) => `<br>${esc(l)}`).join('') + `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labWhat}（実機のみ）</span>`;
        slider.style.display = s.chapter === 7 ? 'block' : 'none';
      }
      limSlider.style.display = s.chapter === 6 && s.scene === 'rack' ? 'block' : 'none';
      for (const id of subIds[s.chapter]) onBtn(btn[`s_${id}`], !!s.lit?.[id]);
      subNote.textContent = s.note ?? '';
      subNote.style.top = s.chapter === 7 ? '556px' : s.chapter === 6 ? '580px' : '562px';
      subNote.style.display = s.chapter === 6 && s.scene === 'rack' ? 'none' : 'block';
      const g = s.g ?? {};
      if (s.chapter === 2) pullV.innerHTML = `${Math.round((s.pull ?? 0) * 100)}<small>%</small>`;
      if (s.chapter === 3) {
        hopsV.innerHTML = s.scene === 'hop' ? `${g.hops}<small>個</small>` : `<span style="font:600 15px ${SANS};color:${C.mute}">「GPU から GPU へ」で数える</span>`;
        hopsV.style.color = s.scene === 'hop' && g.hops ? C.accent : C.ink;
        linksV.innerHTML = `${s.scene === 'fan' ? g.links : 18} / 18<small>本</small>`;
      }
      if (s.chapter === 5) {
        const {GB, MS} = AR.scale;
        const isHier = s.scene === 'hier';
        const sent = isHier ? g.sentGB : inSentGB() + outSentGB();
        AR.sent.innerHTML = `${fx(sent, 3)}${unit('GB', 13)}`;
        AR.inB.style.width = `${(isHier ? g.sentInGB : inSentGB()) * GB}px`;
        AR.outB.style.width = `${(isHier ? g.sentOutGB : outSentGB()) * GB}px`;
        AR.box.innerHTML = `${fx(g.outGB, 3)}${unit('GB', 13)}`;
        AR.boxB.style.width = `${g.outGB * GB}px`;
        AR.ms.innerHTML = `${fx(g.ms, 3)}${unit('ms', 13)}`;
        AR.dgxB.style.width = `${g.ms * MS}px`;
        AR.nvB.style.width = `${(isHier ? nvl72Ms() : g.nvMs) * MS}px`;
        AR.inB.style.background = C.accent;
        AR.outB.style.background = C.ink;
        AR.boxB.style.background = C.ink;
        AR.dgxB.style.background = C.ink;
        AR.nvB.style.background = isHier ? C.faint : C.accent;
      }
      if (s.chapter === 6) {
        ampsV.innerHTML = s.scene === 'power' ? `${fx(g.amps ?? 0, 1)}<small>A</small>` : `${fx(psuAmps(), 1)}<small>A</small>`;
        const n = perRackOf(s.limit ?? SPEC.rack.limitDefault);
        perV.innerHTML = `${n}<small>台（上限 ${s.limit ?? SPEC.rack.limitDefault} kW・${fx(n * SPEC.power.kw, 1)} kW）</small>`;
        perV.style.color = s.scene === 'rack' ? C.accent : C.ink;
        const lim = s.limit ?? SPEC.rack.limitDefault;
        lmV.textContent = `上限 ${lim} kW（仮定）`;
        lmK.style.left = `${limX(lim) - 44}px`;
      }
      if (s.chapter === 7) {
        const d = s.dT ?? DT_SRC;
        dTV.innerHTML = `${fx(d, 1)}<small>K</small>`;
        cfmV.innerHTML = `${fmt(airCfm(d))}<small>CFM</small>`;
        m3V.textContent = `14.3 kW ÷ (1.2 × 1.005 × ${fx(d, 1)} K) = ${fx(airM3s(d), 3)} m³/s`;
        outV.innerHTML = `${fx(g.dT ?? 0, 1)}<small>K</small>`;
        chartDot.innerHTML = `<circle cx="${chartDot._xs(d).toFixed(1)}" cy="${chartDot._ys(airCfm(d)).toFixed(1)}" r="4.5" fill="#fff" stroke="${C.accent}" stroke-width="2.4"/>`;
        slV.textContent = `温度差 ${fx(d, 1)} K`;
        slK.style.left = `${dTx(d) - 44}px`;
      }
      caption.style.display = s.caption ? 'block' : 'none';
      caption.textContent = s.caption ?? '';
      const TX = {l: '-100%', c: '-50%', r: '0'};
      const TY = {t: '0', m: '-50%', b: '-100%'};
      tagG.innerHTML = (s.tags ?? [])
        .filter((t) => t.o > 0.02 && t.x > 340 && t.x < 1260 && t.y < 742 && t.y > 140)
        .map((t) => `<div class="tg ${t.kind}${t.on ? ' on' : ''}" style="left:${t.x.toFixed(1)}px;top:${t.y.toFixed(1)}px;transform:translate(${TX[t.h]},${TY[t.v]});opacity:${t.o.toFixed(2)}">${t.html}</div>`)
        .join('');
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
