// The Q3400's console, laid out at 1600 x 900 like the switch's and the rack's (nvl72-shared/console.js), all in
// Japanese: the title block on a paper strip; on the left the seven chapter buttons, the chapter's buttons (views /
// open-close / scenes) and the controls; on the right the gauges of the chapter (the box against the Catalyst, the lanes
// and chips, the SM's sweep and an LFT, the drops and the credits, the fat tree's numbers and table 3, the all-reduce
// bars, the watts); along the bottom the chapter's explanation and the command to run on the real machine. update(s)
// redraws every live part from the frame's state; nothing here keeps time.
import {C, createChrome, MONO, SANS} from '../kit/ui.js';
import {
  bothWaysTbps,
  cageTbps,
  catSerialNs,
  CHAPTERS,
  chipCount,
  creditMaxB,
  diffPerCage,
  gpuLid,
  inFlightB,
  laneCount,
  lanesPerChip,
  leafDown,
  leafUp,
  lftPort,
  NEXT_GEN,
  NOTICE,
  perPair,
  perSpine,
  pktCredits,
  powerVsCat,
  ringMs,
  ringSentGB,
  rttNs,
  SCENES,
  serialNs,
  serialRatio,
  sharpMs,
  sharpSentGB,
  SPEC,
  suLeaves,
  suSpines,
  SWEEP_ORDER,
  switchingTbps,
  twoTierMax,
  twoTierSU,
  vsCatalyst,
  wattsPerPort,
} from './kin.js';

export const subsOf = (n) => {
  const c = CHAPTERS[n - 1];
  if (c.subs) return c.subs;
  return c.scenes.map((id) => ({id, label: SCENES[id].name}));
};
export const SUB_NOTE = {front: '前から: ケージ 72・UFM のポート・左に Catalyst 9300 の外形', back: '後ろから: 電源 8・ファン 10', open: '天板を外し、上の層から順に浮かせる', close: '下の層から戻して、天板を閉じる'};
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
.tg.note{font:600 11.5px ${SANS};color:${C.sub};letter-spacing:.02em;padding:1px 6px;border-radius:4px;background:rgba(250,251,252,.9)}
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
.tb{position:absolute;left:1278px;width:280px;border-collapse:collapse;font:500 12px ${SANS};color:${C.sub}}
.tb td,.tb th{padding:2px 4px;border-bottom:1px solid ${C.line};text-align:right;white-space:nowrap}
.tb th{font-weight:700;color:${C.ink};font-size:11.5px}
.tb td:first-child,.tb th:first-child{text-align:left}
.tb tr.on td{color:${C.accent};font-weight:700}
.qxcap{position:absolute;left:800px;top:110px;transform:translateX(-50%);max-width:880px;padding:5px 14px;border-radius:5px;background:rgba(250,251,252,.93);border:1px solid ${C.line};font:700 16px ${SANS};color:${C.ink};letter-spacing:.03em;white-space:nowrap}
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
  add(`<svg style="position:absolute;left:33px;top:22px" width="84" height="48" viewBox="0 0 84 48"><rect x="2" y="2" width="80" height="44" rx="2" fill="none" stroke="#fff" stroke-width="3"/><path d="M14 9h4v5h-4zM20 9h4v5h-4zM26 9h4v5h-4zM36 9h4v5h-4zM42 9h4v5h-4zM48 9h4v5h-4zM58 9h4v5h-4zM64 9h4v5h-4zM70 9h4v5h-4zM14 17h4v5h-4zM20 17h4v5h-4zM26 17h4v5h-4zM36 17h4v5h-4zM42 17h4v5h-4zM48 17h4v5h-4zM58 17h4v5h-4zM64 17h4v5h-4zM70 17h4v5h-4zM14 25h4v5h-4zM20 25h4v5h-4zM26 25h4v5h-4zM36 25h4v5h-4zM42 25h4v5h-4zM48 25h4v5h-4zM58 25h4v5h-4zM64 25h4v5h-4zM70 25h4v5h-4zM14 33h4v5h-4zM20 33h4v5h-4zM26 33h4v5h-4zM36 33h4v5h-4zM42 33h4v5h-4zM48 33h4v5h-4zM58 33h4v5h-4zM64 33h4v5h-4zM70 33h4v5h-4zM6 10h4v4H6z" fill="#fff"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:172px;top:16px;letter-spacing:.12em">ネットワーク機器のしくみ　03</div>`);
  add(`<div style="position:absolute;left:170px;top:34px;font:700 34px ${SANS};letter-spacing:.02em;line-height:1">AI の網のスイッチ <span style="color:${C.accent};font-weight:400">/</span> <span style="font-size:24px">Quantum-X800 Q3400-RA 風・144 ポート</span></div>`);
  add(`<div style="position:absolute;left:172px;top:76px;font:500 14px ${SANS};color:${C.sub};letter-spacing:.04em">4U・OSFP ケージ ${SPEC.cages}（800G × ${SPEC.ports}）・${SPEC.chipName} × ${chipCount()}（計算）・空冷・InfiniBand XDR</div>`);
  add(`<div style="position:absolute;left:1036px;top:16px;width:540px;height:72px;background:${C.panel};border:1px solid ${C.line};border-radius:6px"></div>`);
  [['交換容量', fx(switchingTbps(), 1), 'Tb/s'], ['Catalyst 9300 の', fmt(vsCatalyst()), '倍'], ['消費電力（最大）', fmt(SPEC.power.maxW), 'W']].forEach(([k, v, u], i) => {
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
  const subNote = add(`<div style="position:absolute;left:44px;top:564px;width:268px;font:500 12px/1.35 ${SANS};color:${C.sub}"></div>`);

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
  const cat = SPEC.cat;
  // 1 the box against the Catalyst
  {
    const p = page(1);
    head(p, 144, '交換容量（片方向の合計）');
    put(p, `<div class="big" style="top:164px">${fx(switchingTbps(), 1)}<small>Tb/s</small></div>`);
    note(p, 204, `${SPEC.ports} ポート × ${SPEC.portGbps} Gb/s。両方向で数えると ${fx(bothWaysTbps(), 1)} Tb/s`);
    rule(p, 232);
    head(p, 242, 'Catalyst 9300 と同じ数え方（両方向）で');
    put(p, `<div class="big" style="top:262px;font-size:40px">${fmt(vsCatalyst())}<small>倍</small></div>`);
    note(p, 314, `${fx(bothWaysTbps(), 1)} Tb/s ÷ ${cat.switchingGbps} Gb/s`);
    rule(p, 340);
    put(p, `<table class="tb" style="top:350px"><tr><th></th><th>Catalyst 9300</th><th>Q3400-RA</th></tr>` +
      [['高さ', `${cat.units}U・${cat.h} mm`, `${SPEC.chassis.units}U・${SPEC.chassis.h} mm`], ['幅 × 奥行', `${cat.w} × ${cat.d}`, `${SPEC.chassis.w} × ${SPEC.chassis.d}`], ['重さ', `${cat.kg} kg`, `${SPEC.chassis.kg} kg`], ['ポート', '1G × 48 ほか', `800G × ${SPEC.ports}`], ['電力', `${cat.psuW} W`, `最大 ${fmt(SPEC.power.maxW)} W`], ['宛先の表', `MAC ${fmt(cat.macTable)}`, 'SM が配る LFT']].map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('') +
      `</table>`);
    note(p, 540, `電力は ${fx(powerVsCat(), 1)} 倍。前面の OSFP 1 ケージに 800G のポートが 2 つ（${SPEC.cages} ケージで ${SPEC.ports} ポート）。ケージの並び（3 区画 × 4 段 × 6 列）と背面の並びは仮定。`);
    note(p, 600, `管理: CPU ${SPEC.cpu.name}（${SPEC.cpu.cores} コア ${SPEC.cpu.ghz} GHz）・OS は ${SPEC.cpu.os}。動作温度 ${SPEC.tempC[0]}〜${SPEC.tempC[1]} ℃・騒音 ${SPEC.dBA} dBA。`);
  }
  // 2 inside: lanes and chips
  let liftV;
  {
    const p = page(2);
    head(p, 144, 'ポートとレーン');
    row(p, 172, '1 ポート', `${SPEC.laneGbps} G × ${SPEC.lanesPerPort}`, 'レーン');
    row(p, 200, '1 ケージ（2 ポート）', `${SPEC.portsPerCage * SPEC.lanesPerPort} レーン・${fx(cageTbps(), 1)}`, 'Tb/s');
    put(p, `<div class="big" style="top:232px">${laneCount()}<small>レーン</small></div>`);
    note(p, 272, `${SPEC.cages} ケージ × 8 レーン × ${SPEC.laneGbps} G = ${fx(switchingTbps(), 1)} Tb/s`);
    rule(p, 300);
    head(p, 310, `${SPEC.chipName} のチップ`);
    put(p, `<div class="big" style="top:330px;font-size:40px">${chipCount()}<small>個（計算）</small></div>`);
    note(p, 382, `${fx(switchingTbps(), 1)} ÷ ${SPEC.chipTbps} Tb/s（同じ 144 ポートの Q3450-LD は 1 個 ${SPEC.chipTbps} Tb/s が 4 個）。1 個 ${lanesPerChip()} レーン。Q3400-RA の数そのものは NVIDIA の文書に無い。`);
    note(p, 444, 'チップどうしのつなぎ方は非公表。配線は束 1 本ずつで描き、レーンの割り当ては描かない。ポートからポートへの遅延も数値の公表が無い。');
    rule(p, 500);
    liftV = row(p, 510, '天板の持ち上げ', '0', '%').querySelector('b');
    note(p, 540, `MTU ${fmt(SPEC.mtu)} B（IB のポートの既定値）。管理用 CPU ${SPEC.cpu.name}・${SPEC.cpu.os}`);
  }
  // 3 the SM
  let sweptV;
  let lftRows;
  {
    const p = page(3);
    head(p, 144, 'LFT を書き終えたスイッチ');
    sweptV = put(p, `<div class="big" style="top:164px;font-size:40px">0<small>/ ${SWEEP_ORDER.length} 台</small></div>`);
    row(p, 216, '見回り（sweep）', `${SPEC.sm.sweepS}`, '秒ごと');
    row(p, 242, 'LMC（既定）', `${SPEC.sm.lmc}`, '経路 1 本');
    row(p, 268, 'XDR で使える方式', SPEC.sm.routing, '');
    rule(p, 298);
    head(p, 306, 'リーフ 1 の LFT（一部）');
    const L = (rack, tray, gpu) => ({lid: gpuLid(rack, tray, gpu), ...lftPort(0, rack, tray, gpu)});
    const rows = [L(0, 1, 1), L(1, 5, 1), L(3, 18, 1), L(4, 1, 1), L(6, 9, 1), L(7, 18, 1)];
    lftRows = put(p, `<table class="tb" style="top:326px"><tr><th>宛先 LID</th><th>出口ポート</th><th></th></tr>${rows.map((r) => `<tr><td>${r.lid}</td><td>${r.port}</td><td>${r.up ? `上り（スパイン ${r.spine + 1}）` : '下り'}</td></tr>`).join('')}</table>`);
    note(p, 486, 'LID は SM が見つけた順にスイッチ、次に GPU のポートへ（説明用の番号）。');
    rule(p, 520);
    head(p, 530, 'Catalyst 9300（比べる相手）');
    row(p, 554, 'MAC 表', fmt(cat.macTable), '件');
    note(p, 580, '届いたフレームの送信元 MAC を自分で覚える。知らない宛先は同じ VLAN の全ポートへ流す。IB のスイッチは自分では覚えず、SM が書いた表を引くだけ。');
  }
  // 4 drop / credit / pfc
  const G4 = {};
  {
    const p = page(4);
    head(p, 144, '捨てた数');
    G4.cat = row(p, 170, 'Catalyst（Q1 の末尾）', '0', '個').querySelector('b');
    G4.ib = row(p, 196, 'InfiniBand（クレジット）', '0', '個').querySelector('b');
    G4.pfc = row(p, 222, 'Ethernet + PFC（余裕が足りれば）', '0', '個').querySelector('b');
    note(p, 248, `Catalyst: 2 本 × 1 Gbps が 1 本へ。Q1 は ${fx(cat.fillMs, 4)} ms で満杯（1本目と同じ数）`);
    rule(p, 276);
    head(p, 284, 'IB の送り手が持つクレジット');
    G4.cr = put(p, `<div class="big" style="top:304px">0<small>クレジット</small></div>`);
    G4.wait = row(p, 344, '待った時間（実時間に換算）', '0', 'ns').querySelector('b');
    row(p, 370, '1 ブロック = 1 クレジット', `${SPEC.credit.blockB}`, 'B');
    row(p, 396, `${fmt(SPEC.mtu)} B のパケット`, `${pktCredits()}`, 'クレジット');
    row(p, 422, `上限 ${fmt(SPEC.credit.maxCredits)} クレジット`, fmt(creditMaxB()), 'B');
    note(p, 446, '上限は 2014 年の資料の値（XDR の値は未確認）。受け口は説明用に 4 パケット分で描いた。');
    rule(p, 482);
    head(p, 490, '往復のあいだに線の上にいる量（PFC の余裕）');
    row(p, 514, `銅 ${SPEC.wire.copperM} m（往復 ${rttNs(SPEC.wire.copperM)} ns）`, fmt(inFlightB(SPEC.wire.copperM)), 'B');
    row(p, 540, `光 ${SPEC.wire.opticM} m（往復 ${fmt(rttNs(SPEC.wire.opticM))} ns）`, fmt(inFlightB(SPEC.wire.opticM)), 'B');
    note(p, 566, `仮定: 光は 1 m を ${SPEC.wire.nsPerM} ns。${fmt(SPEC.mtu)} B が線に乗る時間 ${fx(serialNs(), 2)} ns は、Catalyst の 1,518 B（1 Gbps）${fx(catSerialNs() / 1000, 3)} µs の約 ${fmt(serialRatio())} 分の 1。`);
  }
  // 5 the fat tree
  let ratioV;
  {
    const p = page(5);
    head(p, 144, 'リーフ 1 台の 144 ポート');
    put(p, `<div class="big" style="top:164px">下り ${leafDown()} : 上り ${leafUp()}</div>`);
    ratioV = row(p, 204, '上り ÷ 下り', '—', '').querySelector('b');
    note(p, 230, `上りと下りが同じ本数なので詰まらない（1:1）。1 台で GPU ${leafDown()} 個（4 本のラックの同じレールから）`);
    rule(p, 262);
    row(p, 272, '1 SU（NVL72 × 8 = 576 GPU）', `リーフ ${suLeaves()}`, '台');
    row(p, 298, '1 SU だけのスパイン（計算）', `${suSpines()}`, '台');
    head(p, 330, '表3: スパイン 1 台に何本');
    put(p, `<table class="tb" style="top:350px"><tr><th>SU</th><th>リーフ</th><th>スパイン</th><th>1 台に</th><th>1 組</th></tr>${SPEC.table3.map((r) => `<tr><td>${r.su}</td><td>${r.leaves}</td><td>${r.spines}</td><td>${perSpine(r)} 本</td><td>${perPair(r)} 本</td></tr>`).join('')}</table>`);
    note(p, 470, `どれも「リーフ × ${leafUp()} 本 ÷ スパイン」が ${SPEC.ports} ポートに収まる。`);
    rule(p, 502);
    row(p, 512, '2 層の上限', fmt(twoTierMax()), 'GPU');
    note(p, 538, `スパイン 1 台の ${SPEC.ports} ポートでリーフ ${SPEC.ports} 台 × ${leafDown()} = ${fmt(twoTierMax())}（${twoTierSU()} SU）。RA は ${SPEC.su.twoTierSU} SU（9,216 GPU）で止める。`);
    note(p, 592, '適応ルーティング: 同じ距離の出口が複数あるとき、スイッチがその場で空いた方を選ぶ（選び方の細部は未確認）。');
  }
  // 6 all-reduce
  const AR = {};
  {
    const p = page(6);
    head(p, 144, '集計: 1 GB を 576 個で合計');
    const grp = (y, title, unitS, ring, sharp, key, scale, d) => {
      put(p, `<div class="sm" style="position:absolute;left:1278px;top:${y}px;font-size:12px">${title}</div>`);
      const cur = put(p, `<div style="position:absolute;left:1380px;top:${y - 4}px;width:176px;text-align:right;font:700 20px Inter,${SANS};white-space:nowrap"></div>`);
      const r = [];
      [['リング', ring], ['SHARP', sharp]].forEach(([k, v], i) => {
        const yy = y + 30 + i * 40;
        put(p, `<div style="position:absolute;left:1278px;top:${yy}px;width:120px;font:600 12px ${SANS};color:${C.sub}">${k}</div>`);
        put(p, `<div class="mo" style="position:absolute;left:1380px;top:${yy}px;width:176px;text-align:right;font-size:12px;color:${C.sub}">${fx(v, d)} ${unitS}</div>`);
        put(p, `<div class="trk" style="left:1278px;top:${yy + 18}px;width:278px"></div>`);
        put(p, `<div style="position:absolute;left:${1278 + v * scale - 1}px;top:${yy + 15}px;width:2px;height:16px;background:${C.mute}"></div>`);
        r.push(put(p, `<div class="fil" style="left:1278px;top:${yy + 18}px;width:0;background:${C.ink}"></div>`));
      });
      AR[key] = {cur, r, scale, d};
    };
    grp(176, '1 個が送った量', 'GB', ringSentGB(), sharpSentGB(), 'gb', 278 / 2.2, 4);
    grp(306, 'かかる時間（帯域だけ）', 'ms', ringMs(), sharpMs(), 'ms', 278 / 22, 2);
    rule(p, 436);
    note(p, 446, `リング: 2 × (576 − 1) / 576 × 1 GB = ${fx(ringSentGB(), 4)} GB を 1,150 回に分けて隣へ。<br>SHARP: 1 GB を送るだけ。足し算はリーフとスパインの中。<br>時間 = 送る量 ÷ 片方向 ${SPEC.allreduce.oneWayGBs} GB/s（800 Gb/s）。遅延と NVLink を入れない単純計算。`);
    rule(p, 540);
    row(p, 550, `SHARPv${SPEC.sharp.gen} の計算能力`, `${SPEC.sharp.tflops}`, 'TFLOPS');
    note(p, 576, `前の世代の ${SPEC.sharp.vsPrev} 倍（NVIDIA の発表）。FP8、ReduceScatter・ScatterGather が増えた。`);
  }
  // 7 power and air
  let wattsV;
  let perPortV;
  {
    const p = page(7);
    head(p, 144, 'いまの消費電力');
    wattsV = put(p, `<div class="big" style="top:164px;font-size:40px">0<small>W</small></div>`);
    perPortV = row(p, 216, 'ポートあたり', '0', 'W').querySelector('b');
    rule(p, 246);
    const PX = 278 / SPEC.power.maxW;
    [['典型（受動の銅ケーブル）', SPEC.power.typW, C.ink], ['最大（光モジュール）', SPEC.power.maxW, C.accent]].forEach(([k, v, colr], i) => {
      const y = 256 + i * 56;
      row(p, y, k, fmt(v), 'W');
      bar(p, y + 26, v * PX, colr);
      note(p, y + 38, `ポートあたり ${fx(wattsPerPort(v), 1)} W`);
    });
    rule(p, 372);
    note(p, 382, `差 ${fmt(SPEC.power.maxW - SPEC.power.typW)} W ÷ ${SPEC.cages} ケージ = ${fx(diffPerCage(), 1)} W。この差の大半は光モジュールの電力と読める（推測）。`);
    row(p, 430, 'ファン / 電源', `${SPEC.fans} / ${SPEC.psus}`, '台');
    note(p, 456, `電源は交流 ${SPEC.power.psuV} V・${SPEC.power.psuA} A。冗長の方式は未確認。風は前（ポート側）から吸って後ろ（電源側）へ。`);
    rule(p, 600);
    head(p, 608, '次の世代（脚注）');
    note(p, 628, NEXT_GEN);
  }
  add(`<div class="sm" style="position:absolute;left:1278px;top:722px;font-size:11px;letter-spacing:.02em">動きは説明用に引き伸ばしています</div>`);

  // ------------------------------------------------------------ 05 the explanation band
  panel(28, 752, 1544, 120, '', '05');
  const bandT = add(`<div style="position:absolute;left:44px;top:760px;font:700 16px ${SANS};letter-spacing:.04em;white-space:nowrap"></div>`);
  const bandText = add(`<div style="position:absolute;left:44px;top:786px;width:880px;font:500 14px/1.62 ${SANS};color:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:944px;top:762px;width:1px;height:96px;background:${C.line}"></div>`);
  const labBox = add(`<div style="position:absolute;left:960px;top:762px;width:598px;font:500 12px/1.75 ${MONO};color:${C.ink};white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:24px;top:876px;font-size:11px;letter-spacing:.02em;background:${C.bg};padding:1px 6px;border-radius:3px">${NOTICE}</div>`);
  const caption = add(`<div class="qxcap" style="display:none"></div>`);

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
        labBox.innerHTML = `<span style="color:${C.mute};font-family:${SANS};font-weight:700">実機で見るには</span>` + ch.lab.map((l) => `<br>${l.cmd}`).join('') + `<br><span style="color:${C.sub};font-family:${SANS}">${ch.labWhat}（実機のみ）</span>`;
        // chapter 3 has four commands: two to a line
        if (ch.lab.length > 3) labBox.innerHTML = `<span style="color:${C.mute};font-family:${SANS};font-weight:700">実機で見るには</span><br>${ch.lab.slice(0, 3).map((l) => l.cmd).join(' / ')}<br>${ch.lab.slice(3).map((l) => l.cmd).join(' / ')}<br><span style="color:${C.sub};font-family:${SANS}">${ch.labWhat}（実機のみ）</span>`;
      }
      for (const id of subIds[s.chapter]) onBtn(btn[`s_${id}`], !!s.lit?.[id]);
      subNote.textContent = s.note ?? '';
      subNote.style.top = `${454 + subIds[s.chapter].length * 36 + 4}px`;
      const g = s.g ?? {};
      if (s.chapter === 2) liftV.innerHTML = `${Math.round((s.lift ?? 0) * 100)}<small>%</small>`;
      if (s.chapter === 3) {
        sweptV.innerHTML = `${g.swept ?? 0}<small>/ ${SWEEP_ORDER.length} 台</small>`;
        sweptV.style.color = s.scene === 'sweep' && g.swept < SWEEP_ORDER.length ? C.accent : C.ink;
        const on = s.scene === 'lookup' ? 5 : -1;
        lftRows.querySelectorAll('tr').forEach((tr, i) => tr.classList.toggle('on', i === on));
      }
      if (s.chapter === 4) {
        G4.cat.innerHTML = `${fmt(g.catDrops ?? 0)}<small>個</small>`;
        G4.ib.innerHTML = `0<small>個</small>`;
        G4.pfc.innerHTML = `${fmt(s.scene === 'pfc' ? g.drops : 0)}<small>個</small>`;
        G4.cr.innerHTML = `${fmt(g.credits ?? 0)}<small>クレジット</small>`;
        G4.cr.style.color = s.scene === 'credit' ? C.accent : C.ink;
        G4.wait.innerHTML = `${fx(g.waitNs ?? 0, 0)}<small>ns</small>`;
      }
      if (s.chapter === 5) ratioV.innerHTML = g.upRatio ? `${fx(g.upRatio, 2)}<small>（1:1）</small>` : `<span style="font:600 13px ${SANS};color:${C.mute}">リーフを選ぶと出る</span>`;
      if (s.chapter === 6) {
        const isRing = s.scene === 'ring';
        AR.gb.cur.innerHTML = `${fx(g.sentGB ?? 0, 4)}${unit('GB', 13)}`;
        AR.ms.cur.innerHTML = `${fx(g.ms ?? 0, 2)}${unit('ms', 13)}`;
        AR.gb.r[0].style.width = `${(isRing ? g.sentGB : ringSentGB()) * AR.gb.scale}px`;
        AR.gb.r[1].style.width = `${(isRing ? sharpSentGB() : g.sentGB) * AR.gb.scale}px`;
        AR.ms.r[0].style.width = `${(isRing ? g.ms : ringMs()) * AR.ms.scale}px`;
        AR.ms.r[1].style.width = `${(isRing ? sharpMs() : g.ms) * AR.ms.scale}px`;
        for (const k of ['gb', 'ms']) {
          AR[k].r[0].style.background = isRing ? C.accent : C.faint;
          AR[k].r[1].style.background = isRing ? C.faint : C.accent;
        }
      }
      if (s.chapter === 7) {
        wattsV.innerHTML = `${fmt(g.watts ?? 0)}<small>W</small>`;
        perPortV.innerHTML = `${fx(wattsPerPort(g.watts ?? 0), 1)}<small>W</small>`;
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
