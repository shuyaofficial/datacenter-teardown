// The Trn2 console, laid out at 1600 x 900 like the NVL72's (nvl72-shared/console.js), all in Japanese: the title block
// on a paper strip; on the left the seven chapter buttons, the chapter's buttons (views / open-close / scenes) and the
// controls; on the right the gauges of the chapter (the UltraServer, the chip, the 4 × 4 torus, the 4 × 4 × 4 torus,
// the all-reduce bars, inside vs outside, the comparison with NVL72); along the bottom the chapter's explanation and
// the command to run on a real Trn2. update(s) redraws every live part from the frame's state; nothing here keeps time.
import {C, createChrome, MONO, SANS} from '../kit/ui.js';
import {
  CHAPTERS,
  COMPARE_ROWS,
  efaGBs,
  efaPerChipGbps,
  flatSentGB,
  hierInnerGB,
  hierInterGB,
  hierInterMs,
  hierInnerMs,
  hierMs,
  hopStats,
  innerInterRatio,
  innerLinkGiBs,
  innerOutRatio,
  innerShare,
  inOutRatio,
  instEfaTbps,
  INST,
  linkCount,
  NEXT_GEN,
  NOTICE,
  NVL,
  RAINIER,
  SCENES,
  SPEC,
  ultraChips,
  ultraCores,
  ultraEfaTbps,
  ultraFp8TF,
  ultraHbmGiB,
  ultraHbmTBs,
  ultraLinksByParts,
  ULTRA,
} from './kin.js';

export const subsOf = (n) => {
  const c = CHAPTERS[n - 1];
  if (c.subs) return c.subs;
  return c.scenes.map((id) => ({id, label: SCENES[id].name}));
};
export const SUB_NOTE = {front: '前から: スレッドの並びと EFA のポート', back: '後ろから: NeuronLink の網の目と Z のリング', open: '引き出して、上の層から順に浮かせる', close: '下の層から戻して、押し込む'};
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
.tg.num{font:700 11px Inter,${SANS};color:${C.sub};padding:0 4px;border-radius:3px;background:rgba(250,251,252,.85)}
.tg.num.on{color:${C.accent}}
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
.kd{display:inline-block;margin-left:6px;padding:0 5px;border-radius:3px;border:1px solid ${C.faint};font:600 10.5px ${SANS};color:${C.sub};vertical-align:1px}
.nvcap{position:absolute;left:800px;top:110px;transform:translateX(-50%);max-width:880px;padding:5px 14px;border-radius:5px;background:rgba(250,251,252,.93);border:1px solid ${C.line};font:700 16px ${SANS};color:${C.ink};letter-spacing:.03em;white-space:nowrap}
.cmp{position:absolute;left:1278px;width:280px}
.cmp .k{font:500 11.5px ${SANS};color:${C.mute}}
.cmp .v{display:flex;justify-content:space-between;gap:8px;white-space:nowrap;font:700 12.5px ${SANS};color:${C.faint}}
.cmp.on .v{color:${C.sub}}
.cmp.on .v b{color:${C.accent}}
`;
const fx = (n, d) => Number(n).toFixed(d);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const unit = (u, px = 14) => `<span style="font-size:${px}px;font-weight:500"> ${u}</span>`;
const kd = (k) => `<span class="kd">${k}</span>`;

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = createChrome(app);
  const {add, panel, onBtn} = ui;
  const btn = {};
  const hs = hopStats(INST);
  const hu = hopStats(ULTRA);

  // ------------------------------------------------------------ header: a paper strip so the title never sits on the 3D
  add(`<div style="position:absolute;left:0;top:0;width:1600px;height:98px;background:rgba(238,241,243,.96);border-bottom:1px solid ${C.line}"></div>`);
  add(`<div style="position:absolute;left:0;top:0;width:150px;height:92px;background:${C.accent}"></div>`);
  {
    // the icon: a 4 × 4 grid with its wrap-around arcs
    let g = '';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) g += `<rect x="${9 + i * 14}" y="${9 + j * 14}" width="8" height="8" fill="#fff"/>`;
    for (let i = 0; i < 4; i++) g += `<path d="M${13 + i * 14} 13v42M13 ${13 + i * 14}h42" stroke="#fff" stroke-width="1.6"/>`;
    add(`<svg style="position:absolute;left:40px;top:12px" width="70" height="70" viewBox="0 0 68 68">${g}<path d="M55 13 Q66 34 55 55" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M13 55 Q34 66 55 55" fill="none" stroke="#fff" stroke-width="1.6"/></svg>`);
  }
  add(`<div class="sm" style="position:absolute;left:172px;top:16px;letter-spacing:.12em">ネットワーク機器のしくみ　06</div>`);
  add(`<div style="position:absolute;left:170px;top:34px;font:700 34px ${SANS};letter-spacing:.02em;line-height:1">AI チップサーバーの分解 <span style="color:${C.accent};font-weight:400">/</span> <span style="font-size:24px">Trn2 UltraServer 風・${ultraChips()} チップ</span></div>`);
  add(`<div style="position:absolute;left:172px;top:76px;font:500 14px ${SANS};color:${C.sub};letter-spacing:.04em">Trn2 サーバー ${SPEC.ultra.instances} 台・ラック ${SPEC.racks} 本（報道）・形は仮定（AWS 未公表）</div>`);
  add(`<div style="position:absolute;left:1036px;top:16px;width:540px;height:72px;background:${C.panel};border:1px solid ${C.line};border-radius:6px"></div>`);
  [['チップ', String(ultraChips()), '個'], ['スイッチのチップ', '0', '個'], ['冷やし方', '空冷', '（報道）']].forEach(([k, v, u], i) => {
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
  const subNote = add(`<div style="position:absolute;left:44px;top:540px;width:268px;font:500 12px/1.35 ${SANS};color:${C.sub}"></div>`);

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
  const tick = (pg, y, x, label, left = false) => {
    put(pg, `<div style="position:absolute;left:${x - 1}px;top:${y - 4}px;width:2px;height:18px;background:${C.mute}"></div>`);
    if (label) put(pg, `<div style="position:absolute;left:${left ? x - 4 : x}px;top:${y + 15}px;transform:translateX(${left ? '0' : '-50%'});font:500 10.5px ${SANS};color:${C.mute};white-space:nowrap">${label}</div>`);
  };
  // 1 the UltraServer
  {
    const p = page(1);
    head(p, 144, 'UltraServer 全体（出典の値）');
    const R = [
      ['Trainium2', `${ultraChips()}`, '個'],
      ['NeuronCore', `${ultraCores()}`, '個'],
      ['HBM', fmt(ultraHbmGiB()), 'GiB'],
      ['HBM の帯域', fx(ultraHbmTBs(), 1), 'TB/s'],
      ['FP8（密）', `${SPEC.ultra.fp8PF}`, 'PFLOPS'],
      ['EFA（4 台の合計）', `${ultraEfaTbps()}`, 'Tb/s'],
      ['vCPU', `${SPEC.ultra.vcpu}`, ''],
      ['ホストのメモリ', fmt(SPEC.ultra.memGiB), 'GiB'],
      ['スイッチのチップ', '0', '個'],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 30, k, v, u));
    rule(p, 446);
    note(p, 454, `検算: HBM 64 × ${SPEC.chip.hbmGiB} GiB = ${fmt(ultraHbmGiB())} GiB、帯域 64 × ${SPEC.chip.hbmTBs} = ${fx(ultraHbmTBs(), 1)} TB/s、FP8 64 × ${fmt(SPEC.chip.fp8)} = ${fmt(ultraFp8TF())} TFLOPS ≈ ${SPEC.ultra.fp8PF} PF。`);
    rule(p, 512);
    head(p, 520, `形は仮定 ${kd('仮定')}`);
    note(p, 542, 'AWS は寸法・並び・ラックの数を公表していない。ラック 2 本とスレッドの数は報道。外形は NVL72 のラックを流用した。');
    rule(p, 600);
    head(p, 608, '実際に使われている所（脚注）');
    note(p, 628, RAINIER);
  }
  // 2 the sled and the chip
  let pullV;
  {
    const p = page(2);
    head(p, 144, `Trainium2 1 個 ${kd('一次')}`);
    const R = [
      ['NeuronCore-v3', `${SPEC.chip.cores}`, '個'],
      ['SRAM（28 MB × 8）', `${SPEC.chip.sramMiB}`, 'MiB'],
      ['HBM', `${SPEC.chip.hbmGiB} GiB・${SPEC.chip.hbmTBs}`, 'TB/s'],
      ['FP8（密）', fmt(SPEC.chip.fp8), 'TFLOPS'],
      ['BF16（密）', `${SPEC.chip.bf16}`, 'TFLOPS'],
      ['FP32', `${SPEC.chip.fp32}`, 'TFLOPS'],
      ['NeuronLink-v3', `${SPEC.chip.linkTBs}`, 'TB/s'],
      ['集団通信の回路 CC-Core', `${SPEC.chip.ccCores}`, '個'],
    ];
    R.forEach(([k, v, u], i) => row(p, 170 + i * 27, k, v, u));
    rule(p, 392);
    head(p, 400, `スレッドとホスト ${kd('報道')}`);
    row(p, 424, '計算スレッド（1 台）', `${SPEC.server.compute} × ${SPEC.server.chipsPerSled}`, '個');
    row(p, 451, 'ホスト CPU（Sapphire Rapids）', `${SPEC.inst.vcpu}`, 'vCPU');
    row(p, 478, 'ホストのメモリ', '2', 'TiB');
    note(p, 506, '冷やし方は空冷（報道。AWS は未公表）。ダイの数・HBM の積み数・消費電力は未公表なので描かない。CPU とメモリは一次。');
    pullV = row(p, 572, '引き出した量', '0', '%').querySelector('b');
  }
  // 3 the 4 × 4 torus
  let hopsV;
  {
    const p = page(3);
    head(p, 144, 'つなぎ方（1 台・16 個）');
    row(p, 170, '隣（直結）', `${SPEC.inst.neighbors}`, '個');
    row(p, 197, 'リンク（16 × 4 ÷ 2）', `${linkCount(INST)}`, '本');
    put(p, `<div class="gr" style="top:224px"><span>スイッチのチップ</span><b style="color:${C.accent}">0<small>個</small></b></div>`);
    row(p, 251, 'チップ 1 個（中）', fmt(SPEC.inst.innerGiBs), 'GiB/s');
    row(p, 278, `1 本のリンク ${kd('計算')}`, `${innerLinkGiBs()}`, 'GiB/s');
    rule(p, 310);
    head(p, 320, '通った段数');
    hopsV = put(p, `<div class="big" style="top:340px;font-size:40px">0<small>段</small></div>`);
    note(p, 392, `最大 ${hs.max} 段・平均 ${fx(hs.mean, 2)} 段（16 × 15 組を検算）`);
    rule(p, 424);
    head(p, 434, '比べる相手: NVL72');
    // a GPU, one switch, a GPU
    put(
      p,
      `<svg style="position:absolute;left:1282px;top:458px" width="270" height="56" viewBox="0 0 270 56"><rect x="2" y="20" width="22" height="16" fill="${C.mute}"/><rect x="246" y="20" width="22" height="16" fill="${C.mute}"/><rect x="102" y="14" width="66" height="28" fill="none" stroke="${C.mute}" stroke-width="2"/><path d="M24 28H102M168 28H246" stroke="${C.mute}" stroke-width="1.6"/><text x="135" y="33" text-anchor="middle" font-size="11" fill="${C.sub}" font-family="${SANS}">NVSwitch</text></svg>`,
    );
    note(p, 516, `GPU → スイッチ ${NVL.hops} 段 → GPU。どの組でも ${NVL.hops} 段（スイッチのチップ ${NVL.switchChips} 個）。Trn2 はスイッチを置かず、遠い相手へは隣が中継する。`);
    note(p, 600, '実機の neuron-ls の例: デバイス 0 の隣は 12, 3, 4, 1。行優先の 4 × 4 に回り込みを入れると一致する（計算による解釈）。');
  }
  // 4 the 4 × 4 × 4 torus
  let chipsV;
  let hops4V;
  {
    const p = page(4);
    head(p, 144, 'UltraServer（4 台）');
    chipsV = row(p, 170, 'チップ', '16', '個').querySelector('b');
    row(p, 197, '隣（XY に 4・Z に 2）', `${SPEC.ultra.neighbors}`, '個');
    row(p, 224, 'リンク', `${linkCount(ULTRA)}`, '本');
    note(p, 248, `4 台 × ${linkCount(INST)} 本 + Z のリング 16 列 × 4 本 = ${ultraLinksByParts()} = 64 × 6 ÷ 2`);
    rule(p, 280);
    head(p, 290, 'チップ 1 個の帯域');
    row(p, 314, '中（インスタンスの中）', fmt(SPEC.inst.innerGiBs), 'GiB/s');
    bar(p, 340, 278, C.accent);
    row(p, 358, '間（4 台の間）', `${SPEC.ultra.interGiBs}`, 'GiB/s');
    bar(p, 384, 278 / innerInterRatio(), '#8fd0d4');
    note(p, 400, `中が ${innerInterRatio()} 倍太い。図では間のリンクを細い線で描く。`);
    rule(p, 430);
    head(p, 440, '通った段数');
    hops4V = put(p, `<div class="big" style="top:460px;font-size:40px">0<small>段</small></div>`);
    note(p, 512, `最大 ${hu.max} 段・平均 ${fx(hu.mean, 2)} 段（64 × 63 組を検算）。NVL72 はどの組も ${NVL.hops} 段。`);
  }
  // 5 all-reduce
  const AR = {};
  {
    const p = page(5);
    head(p, 144, '集計: 1 GB を 64 個で合計');
    put(p, `<div class="sm" style="position:absolute;left:1278px;top:170px;font-size:12px">チップ 1 個が送った量</div>`);
    AR.gb = put(p, `<div class="big" style="top:186px"></div>`);
    const SC = 278 / 2.2;
    [['1 本の輪', 238], ['階層型', 286]].forEach(([k, y], i) => {
      put(p, `<div style="position:absolute;left:1278px;top:${y}px;font:600 12px ${SANS};color:${C.sub}">${k}</div>`);
      put(p, `<div class="mo" style="position:absolute;left:1380px;top:${y}px;width:176px;text-align:right;font-size:12px;color:${C.sub}">${i ? `中 ${fx(hierInnerGB(), 3)}＋間 ${fx(hierInterGB(), 3)}` : `${fx(flatSentGB(), 3)} GB`}</div>`);
      put(p, `<div class="trk" style="left:1278px;top:${y + 18}px;width:278px"></div>`);
    });
    AR.flat = put(p, `<div class="fil" style="left:1278px;top:256px;width:0"></div>`);
    AR.hin = put(p, `<div class="fil" style="left:1278px;top:304px;width:0"></div>`);
    AR.hz = put(p, `<div class="fil" style="left:1278px;top:304px;width:0;background:#8fd0d4"></div>`);
    AR.SC = SC;
    AR.share = row(p, 326, '太い「中」に載った割合', '—', '').querySelector('b');
    rule(p, 356);
    head(p, 366, `所要時間の目安 ${kd('仮定')}`);
    AR.ms = put(p, `<div class="big" style="top:388px"></div>`);
    const MS = 278 / 5;
    put(p, `<div class="trk" style="left:1278px;top:432px;width:278px"></div>`);
    AR.msBar = put(p, `<div class="fil" style="left:1278px;top:432px;width:0;background:${C.accent}"></div>`);
    tick(p, 432, 1278 + NVL.sharpMs * MS, `NVL72 SHARP ${fx(NVL.sharpMs, 3)}`);
    tick(p, 432, 1278 + NVL.ringMs * MS, '');
    put(p, `<div style="position:absolute;left:${1278 + NVL.ringMs * MS + 6}px;top:446px;font:500 10.5px ${SANS};color:${C.mute};white-space:nowrap">リング ${fx(NVL.ringMs, 3)}</div>`);
    AR.MS = MS;
    note(p, 470, `階層型: 中 ${fx(hierInnerGB(), 3)} GB ÷ 512 GiB/s = ${fx(hierInnerMs(), 3)} ms ＋ 間 ${fx(hierInterGB(), 3)} GB ÷ 128 GiB/s = ${fx(hierInterMs(), 3)} ms。片方向で送ると仮定、遅延は入れない。`);
    AR.flatNote = note(p, 530, '1 本の輪は細い「間」のリンクも通るので、そこの速さにそろう（refs.md に時間の計算は無いので出さない）。');
    note(p, 600, '実測は nccom-test の algbw・busbw で見る。busbw = 2 × (r − 1) / r × algbw。');
  }
  // 6 inside vs outside
  {
    const p = page(6);
    head(p, 144, 'チップ 1 個の中と外');
    row(p, 170, 'NeuronLink（中＋間）', `${SPEC.chip.linkTBs}`, 'TB/s');
    bar(p, 196, 278, C.accent);
    row(p, 214, 'EFA（外）', `${fmt(efaGBs())}`, 'GB/s');
    bar(p, 240, 278 / inOutRatio(), C.ink);
    tick(p, 240, 1278 + 278 / NVL.inOutRatio, `↑ NVL72 の比（1/${fmt(NVL.inOutRatio)}）`, true);
    note(p, 276, `${efaPerChipGbps()} Gb/s × 2（双方向）÷ 8 = ${fmt(efaGBs())} GB/s`);
    put(p, `<div class="big" style="top:300px;font-size:40px">${fx(inOutRatio(), 1)}<small>倍 ${kd('仮定つき')}</small></div>`);
    row(p, 352, 'NVL72（GPU 1 個）', `${fmt(NVL.inOutRatio)}`, '倍');
    row(p, 378, '中だけなら（1,024 ÷ 50）', fx(innerOutRatio(), 1), '倍');
    rule(p, 408);
    row(p, 418, 'EFA（チップ 1 個）', `${efaPerChipGbps()}`, 'Gb/s');
    row(p, 444, 'EFA（1 台・16 枚）', `${instEfaTbps()}`, 'Tb/s');
    row(p, 470, 'EFA（UltraServer）', `${ultraEfaTbps()}`, 'Tb/s');
    row(p, 496, 'NVL72（GPU 1 個）', `${NVL.nicGbps}`, 'Gb/s');
    note(p, 526, 'カード 16 枚とチップ 16 個の 1 対 1 は枚数からの解釈。');
    rule(p, 590);
    note(p, 600, '脚注: NeuronLink の値の向きは未公表。両方向の合計と仮定した。片方向なら倍。GiB と GB の差は無視した。');
  }
  // 7 the comparison
  const CMP = [];
  {
    const p = page(7);
    head(p, 144, 'NVL72 と Trn2 UltraServer');
    put(p, `<div class="cmp" style="top:168px"><div class="v" style="color:${C.mute};font-size:11px"><span>NVL72</span><span>Trn2 UltraServer</span></div></div>`);
    COMPARE_ROWS.forEach((r, i) => {
      CMP.push(put(p, `<div class="cmp" style="top:${190 + i * 46}px"><div class="k">${r.k}</div><div class="v"><span>${r.nv}</span><b>${r.tr}</b></div></div>`));
    });
    rule(p, 470);
    head(p, 480, '次の世代（脚注）');
    note(p, 500, NEXT_GEN.map((l) => `・${l}`).join('<br>'));
  }
  add(`<div class="sm" style="position:absolute;left:1278px;top:722px;font-size:11px;letter-spacing:.02em">動きは説明用に引き伸ばしています</div>`);

  // ------------------------------------------------------------ 05 the explanation band
  panel(28, 752, 1544, 120, '', '05');
  const bandT = add(`<div style="position:absolute;left:44px;top:760px;font:700 16px ${SANS};letter-spacing:.04em;white-space:nowrap"></div>`);
  const bandText = add(`<div style="position:absolute;left:44px;top:784px;width:890px;font:500 13.5px/1.6 ${SANS};color:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:944px;top:762px;width:1px;height:96px;background:${C.line}"></div>`);
  const labBox = add(`<div style="position:absolute;left:960px;top:762px;width:598px;font:500 12.5px/1.9 ${MONO};color:${C.ink};white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:24px;top:877px;font-size:10.5px;letter-spacing:0;background:${C.bg};padding:1px 6px;border-radius:3px">${NOTICE}</div>`);
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
          (ch.lab.length ? ch.lab.map((l) => `<br>${l.cmd}`).join('') + `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labWhat}（Trn2 の実機のみ）</span>` : `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labNote}</span>`);
      }
      for (const id of subIds[s.chapter]) onBtn(btn[`s_${id}`], !!s.lit?.[id]);
      subNote.textContent = s.note ?? '';
      subNote.style.top = `${454 + subIds[s.chapter].length * 36 + 10}px`;
      const g = s.g ?? {};
      if (s.chapter === 2) pullV.innerHTML = `${Math.round((s.pull ?? 0) * 100)}<small>%</small>`;
      if (s.chapter === 3) {
        hopsV.innerHTML = s.scene === 'hop' ? `${g.hops}<small>段</small>` : g.hops ? `${g.hops}<small>段（隣へは）</small>` : `<span style="font:600 15px ${SANS};color:${C.mute}">「チップからチップへ」で数える</span>`;
        hopsV.style.color = s.scene === 'hop' && g.hops ? C.accent : C.ink;
      }
      if (s.chapter === 4) {
        chipsV.innerHTML = `${g.chips}<small>個</small>`;
        hops4V.innerHTML = `${g.hops}<small>段</small>`;
        hops4V.style.color = g.hops ? C.accent : C.ink;
      }
      if (s.chapter === 5) {
        const isFlat = s.scene === 'flat';
        AR.gb.innerHTML = `${fx(g.sentGB ?? 0, 3)}<small>GB</small>`;
        AR.flat.style.width = `${(isFlat ? g.sentGB : flatSentGB()) * AR.SC}px`;
        AR.flat.style.background = isFlat ? C.accent : C.faint;
        AR.hin.style.width = `${(isFlat ? hierInnerGB() : g.innerGB) * AR.SC}px`;
        AR.hz.style.left = `${1278 + (isFlat ? hierInnerGB() : g.innerGB) * AR.SC}px`;
        AR.hz.style.width = `${(isFlat ? hierInterGB() : g.interGB) * AR.SC}px`;
        AR.hin.style.background = isFlat ? C.faint : C.accent;
        AR.hz.style.background = isFlat ? '#e1e7ea' : '#8fd0d4';
        AR.share.innerHTML = isFlat ? `<span style="font:500 12px ${SANS};color:${C.mute}">分けない（1 本の輪）</span>` : `${fx((g.innerShare ?? 1) * 100, 1)}<small>%</small>`;
        AR.ms.innerHTML = isFlat ? `<span style="font:600 15px ${SANS};color:${C.mute}">階層型で ${fx(hierMs(), 3)} ms</span>` : `${fx(g.ms ?? 0, 3)}<small>ms</small>`;
        AR.msBar.style.width = `${(isFlat ? hierMs() : g.ms) * AR.MS}px`;
        AR.msBar.style.background = isFlat ? C.faint : C.accent;
      }
      if (s.chapter === 7) CMP.forEach((n, i) => n.classList.toggle('on', i < (g.rows ?? 0)));
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
export {innerShare};
