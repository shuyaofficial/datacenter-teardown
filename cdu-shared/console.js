// The CDU's console, laid out at 1600 x 900 like the rack's (nvl72-shared/console.js), all in Japanese: the title block
// on a paper strip; on the left the seven chapter buttons, the chapter's buttons (views / doors / scenes) with the
// temperature slider and the liquid toggle, and the controls; on the right the gauges of the chapter and one line in
// network words; along the bottom the chapter's explanation and where to read the values on the real machine (the touch
// panel and the BMS: a CDU has no CLI). Chapter 7 adds a mock of the touch panel's home screen and the lines to the BMS.
// update(s) redraws every live part from the frame's state; nothing here keeps time.
import {C, createChrome, SANS} from '../kit/ui.js';
import {COLORS} from './flow.js';
import {
  atdK,
  CHAPTERS,
  COOLIT_NOTE,
  designDT,
  dTForLpmPerKw,
  fwsLossRate,
  hotEndK,
  hydraulicW,
  lmtdK,
  lpm,
  NEXT_GEN,
  NOTICE,
  onePumpKw,
  pumpEff,
  pumpPct,
  rackLiquidExact,
  rackLpm,
  racksExact,
  SCENES,
  SPEC,
} from './kin.js';

export const subsOf = (n) => {
  const c = CHAPTERS[n - 1];
  if (c.subs) return c.subs;
  return c.scenes.map((id) => ({id, label: SCENES[id].name}));
};
export const SUB_NOTE = {
  row: '列の全景: CDU は列の端、ラック 5 本の横',
  ports: '天井側の配管口: 施設の水 2 本・冷却液 2 本',
  open: '扉を開け、上の段から順に前へずらす',
  close: '下の段から戻して、扉を閉じる',
  screen: '扉の 7 インチのタッチパネルのホーム（模した画面）',
  bms: '同じ値をビルの監視（BMS）へ',
};
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
.tg.lbl.alarm{border:1.5px solid ${C.accent};background:#fff}
.tg.lbl.alarm b{color:${C.accent}}
.tg.note{font:600 12px ${SANS};color:${C.sub};letter-spacing:.04em;padding:2px 8px;border-radius:4px;background:rgba(250,251,252,.9)}
.gr{position:absolute;left:1278px;width:280px;white-space:nowrap;display:flex;align-items:baseline;justify-content:space-between;font:500 12.5px ${SANS};color:${C.sub}}
.gr b{font:700 16px Inter,${SANS};color:${C.ink}}
.gr b small{font:500 11.5px ${SANS};color:${C.sub};margin-left:3px}
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
.scr{position:absolute;left:372px;top:172px;width:452px;height:292px;border-radius:10px;background:#24272a;box-shadow:0 3px 14px rgba(30,40,50,.25)}
.scr .d{position:absolute;left:14px;top:14px;right:14px;bottom:14px;border-radius:4px;background:#e9eef1;overflow:hidden}
.scr .hd{position:absolute;left:0;right:0;top:0;height:30px;background:#5a6a74;color:#fff;font:700 13px ${SANS};display:flex;align-items:center;justify-content:space-between;padding:0 12px;letter-spacing:.04em}
.scr .tl{position:absolute;width:196px;height:42px;border-radius:3px;background:#fff;border:1px solid #d3dbe0}
.scr .tl i{position:absolute;left:8px;top:4px;font:500 10.5px ${SANS};font-style:normal;color:${C.sub};white-space:nowrap}
.scr .tl b{position:absolute;left:8px;top:18px;font:700 15px Inter,${SANS};color:${C.ink};white-space:nowrap}
.scr .tl b small{font:500 11px ${SANS};color:${C.sub};margin-left:2px}
.scr .ft{position:absolute;left:10px;bottom:5px;font:500 10px ${SANS};color:${C.mute}}
.bms{position:absolute;left:372px;top:548px;width:452px;height:128px;border-radius:6px;background:${C.panel};border:1.5px solid ${C.ink}}
.bms b{position:absolute;left:14px;top:10px;font:700 15px ${SANS};color:${C.ink}}
.bms span{position:absolute;left:14px;top:36px;width:424px;font:500 12px/1.55 ${SANS};color:${C.sub}}
`;
const fx = (n, d) => Number(n).toFixed(d);
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const unit = (u, px = 14) => `<span style="font-size:${px}px;font-weight:500"> ${u}</span>`;
/** the slider's track in px (x of a temperature difference) */
export const SLIDER = {x0: 52, x1: 304, top: 560};
export const dTx = (dT) => SLIDER.x0 + ((dT - SPEC.slider.dTMin) / (SPEC.slider.dTMax - SPEC.slider.dTMin)) * (SLIDER.x1 - SLIDER.x0);
/** the touch panel's home screen (chapter 7): the design point of the row of 5 (575 kW) */
export function screenValues(s = SPEC) {
  const kw = s.rowRacks * s.design.rackLiquidKw;
  return {
    kw,
    tcsLpm: s.rowRacks * rackLpm(designDT(s), 'pg25', s),
    fwsLpm: lpm(kw, s.design.fws.ret - s.design.fws.supply, 'water', s),
  };
}

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
  add(`<svg style="position:absolute;left:46px;top:12px" width="58" height="68" viewBox="0 0 58 68"><rect x="14" y="2" width="30" height="64" rx="2" fill="none" stroke="#fff" stroke-width="3"/><path d="M20 12h18v8H20zM20 30h18v14H20z" fill="#fff"/><circle cx="23" cy="55" r="4" fill="none" stroke="#fff" stroke-width="2.4"/><circle cx="35" cy="55" r="4" fill="none" stroke="#fff" stroke-width="2.4"/><path d="M2 20h12M2 34h12M44 20h12M44 34h12" stroke="#fff" stroke-width="3"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:172px;top:16px;letter-spacing:.12em">ネットワーク機器のしくみ　04</div>`);
  add(`<div style="position:absolute;left:170px;top:34px;font:700 34px ${SANS};letter-spacing:.02em;line-height:1">液冷 CDU の分解 <span style="color:${C.accent};font-weight:400">/</span> <span style="font-size:24px">Vertiv CoolChip CDU 600 風・600 kW</span></div>`);
  add(`<div style="position:absolute;left:172px;top:76px;font:500 14px ${SANS};color:${C.sub};letter-spacing:.04em">冷却液の輪と施設の水の輪・熱交換器 ${SPEC.parts.hx}・ポンプ ${SPEC.parts.pumps}・GPU ラック ${SPEC.rowRacks} 本ぶん</div>`);
  add(`<div style="position:absolute;left:1036px;top:16px;width:540px;height:72px;background:${C.panel};border:1px solid ${C.line};border-radius:6px"></div>`);
  [['容量', `${SPEC.cdu.kw}`, 'kW'], ['ラック 1 本', `${fmt(rackLpm())}`, 'L/分'], ['ポンプの電気', `${fx(pumpPct(SPEC.pump.kw2, SPEC.cdu.kw), 1)}`, '%']].forEach(([k, v, u], i) => {
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

  // ------------------------------------------------------------ 02 the chapter's buttons, the slider, the liquid toggle
  panel(28, 418, 300, 228, '見せ方', '02');
  const subIds = {};
  CHAPTERS.forEach((c) => {
    subIds[c.n] = subsOf(c.n).map((sb, j) => {
      const b = add(`<div class="bt" style="left:44px;top:${454 + j * 36}px;width:268px;height:30px;display:none">${sb.label}</div>`);
      btn[`s_${sb.id}`] = b;
      return sb.id;
    });
  });
  btn.f_water = add(`<div class="bt" style="left:44px;top:564px;width:130px;height:30px;display:none">水</div>`);
  btn.f_pg25 = add(`<div class="bt" style="left:182px;top:564px;width:130px;height:30px;display:none">不凍液 PG25</div>`);
  const subNote = add(`<div style="position:absolute;left:44px;top:600px;width:268px;font:500 12px/1.35 ${SANS};color:${C.sub}"></div>`);
  const slider = add(`<div class="sl" style="top:${SLIDER.top}px;display:none"><div class="v"></div><div class="r">${SPEC.slider.dTMin}〜${SPEC.slider.dTMax} K</div><div class="t"></div><div class="k"></div></div>`);
  const slV = slider.querySelector('.v');
  const slK = slider.querySelector('.k');

  // ------------------------------------------------------------ 03 controls
  panel(28, 658, 300, 86, '操作', '03');
  add(`<div style="position:absolute;left:44px;top:688px;width:268px;font:500 12.5px/1.5 ${SANS};color:${C.sub};white-space:nowrap">ドラッグ: 回す　ホイール: 寄る　25 秒でツアーへ</div>`);

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
  const bar = (pg, y, w, color, x = 1278, tw = 278) => {
    put(pg, `<div class="trk" style="left:${x}px;top:${y}px;width:${tw}px"></div>`);
    return put(pg, `<div class="fil" style="left:${x}px;top:${y}px;width:${w}px;background:${color}"></div>`);
  };
  const D = SPEC.design;
  // 1 the CDU
  {
    const p = page(1);
    head(p, 144, 'CDU 1 台（出典の値）');
    const R = [
      ['容量', `${SPEC.cdu.kw}`, `kW（ATD ${SPEC.cdu.ratedAtdK} ℃）`],
      ['外形 高 × 幅 × 奥', `${fmt(SPEC.cdu.h)} × ${SPEC.cdu.w} × ${fmt(SPEC.cdu.d)}`, 'mm'],
      ['重さ 乾燥 / 満水', `${SPEC.cdu.dryKg} / ${SPEC.cdu.wetKg}`, 'kg'],
      ['冷却液', 'PG25 か処理水', ''],
      ['冷却液側の液の量', `${SPEC.cdu.liters.tcs}`, 'L（推測）'],
      ['配管口', `${SPEC.cdu.portIn} インチ × 4`, ''],
      ['消費電力（名目）', `${fx(SPEC.cdu.powerKw, 1)}`, 'kW'],
      ['電源', '400 / 480', 'V'],
      ['騒音（3 m）', `${SPEC.cdu.noiseDba} 未満`, 'dBA'],
      ['行きの温度の制御', `±${SPEC.cdu.supplyCtlK}`, '℃'],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 28, k, v, u));
    rule(p, 458);
    head(p, 468, '600 kW 機 1 台で何本（計算）');
    put(p, `<div class="big" style="top:488px">${Math.floor(racksExact())}<small>本（${fx(racksExact(), 2)}）</small></div>`);
    note(p, 530, `${SPEC.cdu.kw} ÷ ${D.rackLiquidKw} kW = ${fx(racksExact(), 2)}。ラック 1 本の液の熱 ${D.rackLiquidKw} kW は出典9 の値で、${D.rackKw} kW × ${Math.round(D.liquidShare * 100)}% = ${fx(rackLiquidExact(), 2)} kW とも合う。8 本の列（${fx(8 * rackLiquidExact(), 1)} kW）なら 2 台、N+1 で 3 台。`);
    note(p, 612, `列の上の配管は部屋の 3.25 m から下げて、列の上 約 ${SPEC.headerDropM} m に描いた。`);
  }
  // 2 the parts
  let openV;
  {
    const p = page(2);
    head(p, 144, '中の部品（出典2・配置は仮定）');
    const ts = SPEC.parts.tempSensors;
    const R = [
      ['熱交換器（板状）', `${SPEC.parts.hx}`, `台・余裕 ${SPEC.parts.hxMarginPct}%`],
      ['ポンプ（横置き多段）', `${SPEC.parts.pumps}`, '台・N+N'],
      ['冷却液のフィルタ', SPEC.parts.tcsFilterUm.join(' / '), `µm × ${SPEC.parts.pumps}`],
      ['施設側のフィルタ', `${SPEC.parts.fwsFilterUm}`, 'µm'],
      ['補給タンク', `${SPEC.parts.makeupL}`, `L・水位 ${SPEC.parts.levelSensors}`],
      ['施設側の制御弁', `${SPEC.parts.controlValves}`, ''],
      ['温度センサー', `${ts.tcsSupply + ts.tcsReturn + ts.fwsSupply + ts.fwsReturn}`, `（行き ×${ts.tcsSupply}）`],
      ['圧力センサー', `${SPEC.parts.pressureSensors.tcsSupply + SPEC.parts.pressureSensors.tcsReturn}`, '（2 重 × 2）'],
      ['流量計', `${SPEC.parts.flowMeters}`, ''],
      ['操作盤', `${SPEC.cdu.panelInch}`, 'インチ'],
    ];
    R.forEach(([k, v, u], i) => row(p, 172 + i * 28, k, v, u));
    rule(p, 458);
    note(p, 466, '熱交換器はステンレス（S304/S316）の板を銅でろう付け。パッキンが無く分解清掃は要らない。寸法は未確認で、幅 300 × 高さ 600 × 奥行 250 mm と仮定。<br>ポンプ・フィルタは動かしたまま 1 台ずつ保守できる。膨張タンクは Vertiv の資料に名前が無い（未確認）。');
    openV = row(p, 600, '扉と分解', '0', '%').querySelector('b');
  }
  // 3 the two loops
  {
    const p = page(3);
    head(p, 144, '冷却液（TCS）行き → 戻り');
    put(p, `<div class="big" style="top:164px;font-size:26px;color:${COLORS.tcsR}">${fx(D.tcs.supply, 1)} → ${fx(D.tcs.ret, 1)}<small>℃</small></div>`);
    head(p, 206, '施設の水（FWS）入る → 出る');
    put(p, `<div class="big" style="top:226px;font-size:26px;color:${COLORS.fwsR}">${fx(D.fws.supply, 1)} → ${fx(D.fws.ret, 1)}<small>℃</small></div>`);
    rule(p, 270);
    put(p, `<div class="gr" style="top:280px"><span>アプローチ温度（ATD）</span><b style="color:${C.accent}">${fx(atdK(), 1)}<small>K</small></b></div>`);
    row(p, 306, '熱い端', fx(hotEndK(), 1), 'K');
    row(p, 332, '対数平均温度差', fx(lmtdK(), 2), 'K');
    row(p, 358, 'ASHRAE のクラス', 'W40', `（Vertiv は ${SPEC.cdu.fwsClass} まで）`);
    note(p, 388, `${D.F.tcsSupply} °F = ${fx(D.tcs.supply, 1)} ℃、${D.F.tcsReturn} °F = ${fx(D.tcs.ret, 1)} ℃、${D.F.fwsSupply} °F = ${fx(D.fws.supply, 1)} ℃、${D.F.fwsReturn} °F = ${fx(D.fws.ret, 1)} ℃（出典8）。ATD = 冷却液の行き − 施設の水の行き。Vertiv の 600 kW は ATD 4 ℃の条件で、2.8 K で同じ容量が出るかは未確認。`);
    rule(p, 494);
    head(p, 502, '次の世代（脚注）');
    note(p, 520, NEXT_GEN.map((l) => `・${l}`).join('<br>'), 'font-size:10.5px;line-height:1.32');
  }
  // 4 flow x temperature difference
  const P4 = {};
  const CHT = {x: 1306, y: 336, w: 236, h: 110, max: 380};
  {
    const p = page(4);
    head(p, 144, `ラック 1 本の流量（液の熱 ${D.rackLiquidKw} kW）`);
    P4.lpm = put(p, `<div class="big" style="top:162px;font-size:36px"></div>`);
    P4.dT = row(p, 210, '温度差', '', 'K').querySelector('b');
    P4.fluid = row(p, 236, '液', '', '').querySelector('b');
    P4.calc = note(p, 262, '');
    // flow: the curve against the temperature difference, with NVL72's water example
    const fl = (P4.flowBox = put(p, `<div style="position:absolute;inset:0"></div>`));
    put(fl, `<div class="sm" style="position:absolute;left:1278px;top:290px;font-size:12px">温度差と流量（L/分）</div>`);
    const xs = (d) => ((d - SPEC.slider.dTMin) / (SPEC.slider.dTMax - SPEC.slider.dTMin)) * CHT.w;
    const ys = (l) => CHT.h - (l / CHT.max) * CHT.h;
    const curve = (kw, f) => {
      let s = '';
      for (let k = 0; k <= 60; k++) {
        const d = SPEC.slider.dTMin + (k / 60) * (SPEC.slider.dTMax - SPEC.slider.dTMin);
        s += `${k ? 'L' : 'M'}${xs(d).toFixed(1)} ${Math.max(0, ys(lpm(kw, d, f))).toFixed(1)}`;
      }
      return s;
    };
    const ax = `font-size="10.5" fill="${C.mute}" font-family="${SANS}"`;
    const nv = lpm(SPEC.nvl72.rackKw, SPEC.nvl72.dT, 'water');
    put(
      fl,
      `<svg style="position:absolute;left:${CHT.x}px;top:${CHT.y}px;overflow:visible" width="${CHT.w}" height="${CHT.h}">` +
        `<line x1="0" x2="${CHT.w}" y1="${CHT.h}" y2="${CHT.h}" stroke="${C.ink}"/><line x1="0" x2="0" y1="0" y2="${CHT.h}" stroke="${C.faint}"/>` +
        `<path d="${curve(SPEC.nvl72.rackKw, 'water')}" fill="none" stroke="${C.mute}" stroke-width="1.6" stroke-dasharray="4 3"/>` +
        `<path d="${curve(D.rackLiquidKw, 'pg25')}" fill="none" stroke="${C.accent}" stroke-width="2.2"/>` +
        `<circle cx="${xs(SPEC.nvl72.dT).toFixed(1)}" cy="${ys(nv).toFixed(1)}" r="3.5" fill="${C.mute}"/>` +
        `<text x="${(xs(SPEC.nvl72.dT) + 8).toFixed(1)}" y="${(ys(nv) - 6).toFixed(1)}" ${ax}>NVL72 の例 172</text>` +
        `<text x="0" y="${CHT.h + 14}" ${ax}>${SPEC.slider.dTMin} K</text><text x="${CHT.w}" y="${CHT.h + 14}" text-anchor="end" ${ax}>${SPEC.slider.dTMax} K</text>` +
        `<text x="-8" y="${ys(300) + 4}" text-anchor="end" ${ax}>300</text><text x="-8" y="${ys(100) + 4}" text-anchor="end" ${ax}>100</text>` +
        `</svg>`,
    );
    P4.dot = put(fl, `<svg style="position:absolute;left:${CHT.x}px;top:${CHT.y}px;overflow:visible" width="${CHT.w}" height="${CHT.h}"></svg>`);
    P4.dot._xs = xs;
    P4.dot._ys = ys;
    note(fl, 466, `実線: PG25・${D.rackLiquidKw} kW（この CDU の設計点）。点線: 水・${SPEC.nvl72.rackKw} kW（NVL72 のページの計算例、10 K で 172 L/分）。条件の違いで、食い違いではない。`);
    // glycol: water vs PG25 at the same heat and temperature difference
    const gl = (P4.glyBox = put(p, `<div style="position:absolute;inset:0;display:none"></div>`));
    head(gl, 296, '同じ熱・同じ温度差で');
    P4.gW = row(gl, 322, '水（4.18 kJ/kg·K）', '', 'L/分').querySelector('b');
    P4.gWb = bar(gl, 348, 0, C.mute);
    P4.gP = row(gl, 366, 'PG25（3.95・1.02 kg/L）', '', 'L/分').querySelector('b');
    P4.gPb = bar(gl, 392, 0, C.accent);
    row(gl, 414, '凍る温度 水 / PG25', `${SPEC.fluid.water.freezeC} / ${SPEC.fluid.pg25.freezeC}`, '℃');
    note(gl, 442, '比熱は 4.18 → 3.95 で 5.5% 小さい。質量の流量は 1.058 倍、体積では液が少し重いぶん差が縮んで 1.0375 倍（約 4%）。PG25 は水より粘るのでポンプの負担も増える（量は出さない）。');
    // racks: the 600 kW bar fills one rack at a time
    const rk = (P4.rackBox = put(p, `<div style="position:absolute;inset:0;display:none"></div>`));
    head(rk, 296, `CDU 1 台 ${SPEC.cdu.kw} kW の中身`);
    P4.rN = row(rk, 322, 'つないだラック', '', '本').querySelector('b');
    P4.rKw = row(rk, 348, '液の熱の合計', '', 'kW').querySelector('b');
    put(rk, `<div class="trk" style="left:1278px;top:378px;width:278px;height:16px"></div>`);
    P4.rSeg = [];
    for (let i = 0; i < SPEC.rowRacks; i++) P4.rSeg.push(put(rk, `<div class="fil" style="left:${1278 + (i * D.rackLiquidKw * 278) / SPEC.cdu.kw + 1}px;top:378px;height:16px;width:${(D.rackLiquidKw * 278) / SPEC.cdu.kw - 2}px;background:${C.accent};opacity:0"></div>`));
    note(rk, 402, `6 本目（${6 * D.rackLiquidKw} kW）は入らない → 2 台目の CDU。<br>${COOLIT_NOTE}（2,000 ÷ 12 = 166.7 kW/本で数える。115 kW なら 17.4 本）。画面では kW と L/分で比べる。`);
    rule(p, 548);
    note(p, 556, `OCP の推奨 ${SPEC.ocp.lpmPerKw} L/分/kW ＝ PG25 で温度差 ${fx(dTForLpmPerKw(), 2)} K（水 ${fx(dTForLpmPerKw(1.5, 'water'), 2)} K）。Vertiv 600 の最大 ${SPEC.pump.maxLpm2} L/分 ÷ ${SPEC.cdu.kw} kW = ${SPEC.ocp.lpmPerKw} でちょうど合う。`);
  }
  // 5 the pumps
  {
    const p = page(5);
    head(p, 144, 'ポンプの電気 ÷ 冷やす熱');
    put(p, `<div class="big" style="top:162px;font-size:38px;color:${C.accent}">${fx(pumpPct(SPEC.pump.kw2, SPEC.cdu.kw), 1)}<small>%</small></div>`);
    note(p, 210, `${fx(SPEC.pump.kw2, 1)} kW ÷ ${SPEC.cdu.kw} kW（2 台同時）`);
    const SC = 278 / 3;
    put(p, `<div class="trk" style="left:1278px;top:234px;width:278px"></div>`);
    put(p, `<div class="fil" style="left:1278px;top:234px;width:${1.5 * SC}px;background:${C.accent}"></div>`);
    const O = SPEC.others;
    const L = [
      ['CoolIT CHx2000', pumpPct(O.coolit2000.powerKw, O.coolit2000.kw)],
      ['Vertiv 600・1 台', pumpPct(SPEC.pump.kw1, SPEC.cdu.kw)],
      ['Vertiv 600・2 台', pumpPct(SPEC.pump.kw2, SPEC.cdu.kw)],
      ['CoolIT CHx3000', pumpPct(O.coolit3000.powerKw, O.coolit3000.kw)],
      ['nVent CDU800（定格）', pumpPct(O.nvent800.powerKw, O.nvent800.kw)],
    ];
    for (const [, v] of L) put(p, `<div style="position:absolute;left:${1278 + v * SC - 1}px;top:230px;width:2px;height:18px;background:${C.ink}"></div>`);
    put(p, `<div class="gs" style="top:250px;width:278px;display:flex;justify-content:space-between"><span>0</span><span>1%</span><span>2%</span><span>3%</span></div>`);
    L.forEach(([k, v], i) => row(p, 270 + i * 24, k, fx(v, 2), '%'));
    rule(p, 396);
    head(p, 404, 'ポンプの流量（最大）');
    row(p, 426, `1 台（${SPEC.pump.bar1} bar）`, `${SPEC.pump.maxLpm1}`, 'L/分');
    bar(p, 450, (278 * SPEC.pump.maxLpm1) / SPEC.pump.maxLpm2, C.ink);
    row(p, 466, `2 台同時（${SPEC.pump.bar2} bar）`, `${SPEC.pump.maxLpm2}`, 'L/分');
    bar(p, 490, 278, C.accent);
    rule(p, 512);
    note(p, 520, `液を押す力: ${SPEC.pump.maxLpm1} L/分 × ${SPEC.pump.bar1} bar = ${fmt(hydraulicW(SPEC.pump.maxLpm1, SPEC.pump.bar1))} W。電気 ${SPEC.pump.kw1} kW の約 ${Math.round(pumpEff() * 100)}%（ポンプ・モーター・インバータを合わせた効率の目安。計算）。<br>回転の速さはインバータで変え、差圧か流量を一定に保つ。`);
  }
  // 6 when it stops
  const P6 = {};
  {
    const p = page(6);
    head(p, 144, '運転中のポンプ');
    P6.pump = put(p, `<div class="big" style="top:162px;font-size:36px"></div>`);
    P6.lpm = row(p, 210, 'ポンプの流量', '', 'L/分').querySelector('b');
    head(p, 242, '冷却液の行きの温度');
    P6.temp = put(p, `<div class="big" style="top:260px;font-size:34px"></div>`);
    P6.alarm = put(p, `<div style="position:absolute;left:1278px;top:308px;width:278px;height:30px;box-sizing:border-box;border-radius:5px;border:1px solid ${C.line};display:flex;align-items:center;padding:0 10px;font:700 13px ${SANS};white-space:nowrap"></div>`);
    rule(p, 348);
    put(p, `<div class="gs" style="top:356px;font-size:11.5px;color:${C.ink}">1 台だけだと ${SPEC.pump.maxLpm1} L/分 → 温度差 ${designDT()} K で <b>${Math.round(onePumpKw())} kW</b>（10 K で ${Math.round(onePumpKw(10))} kW）しか運べない。</div>`);
    note(p, 392, `ラック 5 本（575 kW）は ${fmt(SPEC.rowRacks * rackLpm())} L/分で 1 台の上限を超えるので 2 台同時運転になり、そのとき待機は無い（計算。Vertiv は待機ありの容量を書いていない）。この場面は 1 台の上限 450 L/分で回る例。`);
    rule(p, 466);
    note(p, 474, `施設の水が止まると: ${SPEC.others.nvent800.kw} kW ÷（${SPEC.others.nvent800.tcsL} L × ${SPEC.fluid.pg25.rho} × ${SPEC.fluid.pg25.cp}）= ${fx(fwsLossRate(), 2)} K/秒、10 K に約 ${fx(10 / fwsLossRate(), 0)} 秒。nVent CDU800 の液だけで数えた下限の目安（配管とラックの液は数えない）。`);
    note(p, 548, `備え: 待機のポンプ（週 ${SPEC.pump.rotateDays === 7 ? 1 : ''} 回自動で交代）・UPS ${D.upsKw} kW・蓄熱タンク ${D.storageMin} 分（出典8）・受け皿の漏液センサー（警報だけ／警報して停止）。待機のポンプが立ち上がるまでの時間は未確認。`);
  }
  // 7 monitoring
  {
    const p = page(7);
    head(p, 144, '通信（出典2）');
    SPEC.protocols.forEach((pr, i) => put(p, `<div class="gr" style="top:${168 + i * 23}px"><span>・${pr}</span></div>`));
    note(p, 334, '2 重の Ethernet / RS-485。BACnet はゲートウェイ経由。');
    rule(p, 360);
    const R = [
      ['パスワード', `${SPEC.cdu.passwordLevels} 段階`],
      ['ログ', 'SD カード'],
      ['まとめて動かす', `最大 ${SPEC.cdu.groupMax} 台`],
      ['停電から戻ると', '前の速さ・開きへ'],
      ['露点（OCP）', `+${SPEC.ocp.dewMarginK} ℃以上`],
    ];
    R.forEach(([k, v], i) => row(p, 370 + i * 27, k, v));
    note(p, 510, '露点より冷たい液を流すと配管に水滴がつく。危ないときは行きの温度を自動で上げる（露点の上書き）。<br>レジスタ番号・OID は機種ごとの資料にあり、ここでは未確認。');
  }
  const netLine = add(`<div class="gs" style="top:658px;width:278px;font-size:11.5px;line-height:1.4;color:${C.sub}"></div>`);
  add(`<div class="sm" style="position:absolute;left:1278px;top:722px;font-size:11px;letter-spacing:.02em">動きは説明用に引き伸ばしています</div>`);

  // ------------------------------------------------------------ chapter 7: the touch panel's home screen and the BMS
  const SV = screenValues();
  const tile = (x, y, k, v, u = '') => `<div class="tl" style="left:${x}px;top:${y}px"><i>${k}</i><b>${v}${u ? `<small>${u}</small>` : ''}</b></div>`;
  const scr = add(
    `<div class="scr" style="display:none"><div class="d"><div class="hd"><span>CDU-1　ホーム</span><span>運転中・警報なし</span></div>` +
      tile(10, 40, 'TCS 行き / 戻り', `${fx(D.tcs.supply, 1)} / ${fx(D.tcs.ret, 1)}`, '℃') +
      tile(214, 40, 'TCS 流量（ラック 5 本）', fmt(SV.tcsLpm), 'L/分') +
      tile(10, 88, 'FWS 入る / 出る', `${fx(D.fws.supply, 1)} / ${fx(D.fws.ret, 1)}`, '℃') +
      tile(214, 88, 'FWS 流量（水・10 K）', fmt(SV.fwsLpm), 'L/分') +
      tile(10, 136, 'ポンプ', 'A・B 同時', '') +
      tile(214, 136, '熱量（目安）', fmt(SV.kw), 'kW') +
      tile(10, 184, '冷却弁の開度 / 差圧', '— / —', '') +
      tile(214, 184, '露点', '—', '') +
      `<div class="ft">— は機種と現場しだい（未確認）なので値を出さない。5 本は 1 台の上限 450 L/分を超えるので 2 台同時</div></div></div>`,
  );
  const scrSvg = add(`<svg style="position:absolute;inset:0;overflow:visible;display:none" width="1600" height="900"></svg>`);
  const bms = add(`<div class="bms" style="display:none"><b>BMS / DCIM（ビルの監視）</b><span>上の値すべてと部屋の温度・湿度・露点を読み、警報を受ける。リモートで起動・停止もできる（Modbus・BACnet・SNMP）。<br>ネットワークで言えば NMS。値を読みに行くのはポーリング。</span></div>`);

  // ------------------------------------------------------------ 05 the explanation band
  panel(28, 752, 1544, 120, '', '05');
  const bandT = add(`<div style="position:absolute;left:44px;top:760px;font:700 16px ${SANS};letter-spacing:.04em;white-space:nowrap"></div>`);
  const bandText = add(`<div style="position:absolute;left:44px;top:786px;width:880px;font:500 14px/1.62 ${SANS};color:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:944px;top:762px;width:1px;height:96px;background:${C.line}"></div>`);
  const labBox = add(`<div style="position:absolute;left:960px;top:760px;width:598px;font:500 12.5px/1.6 ${SANS};color:${C.ink}"></div>`);
  add(`<div class="sm" style="position:absolute;left:24px;top:876px;font-size:11px;letter-spacing:.04em;background:${C.bg};padding:1px 6px;border-radius:3px">${NOTICE}</div>`);
  const caption = add(`<div class="nvcap" style="display:none"></div>`);

  // ------------------------------------------------------------ callouts, tags, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const tagG = add(`<div style="position:absolute;inset:0"></div>`);
  const pointer = ui.late();
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, ui.centre(n)]));
  for (const d of [7, designDT(), SPEC.slider.dTMin, SPEC.slider.dTMax]) spots[`dT_${d}`] = [dTx(d), SLIDER.top + 33];
  spots.f_water = ui.centre(btn.f_water);
  spots.f_pg25 = ui.centre(btn.f_pg25);

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
        netLine.innerHTML = `<b style="color:${C.ink}">ネットワークで言えば</b>　${ch.net}`;
        labBox.innerHTML =
          `<span style="color:${C.mute};font-weight:700">実機で見るには</span>　<span style="color:${C.sub}">CDU に CLI は無い。操作盤か BMS で値を読む</span>` +
          `<br><b>${ch.lab.where}</b>: ${ch.lab.values}` +
          (ch.lab.design !== '—' ? `<br><span style="color:${C.sub}">この教材の設計点: ${ch.lab.design}</span>` : '');
      }
      const g = s.g ?? {};
      const isFlow = s.chapter === 4 && s.scene === 'flow';
      const isGly = s.chapter === 4 && s.scene === 'glycol';
      slider.style.display = isFlow ? 'block' : 'none';
      btn.f_water.style.display = isGly ? 'flex' : 'none';
      btn.f_pg25.style.display = isGly ? 'flex' : 'none';
      onBtn(btn.f_water, isGly && s.fluid === 'water');
      onBtn(btn.f_pg25, isGly && s.fluid !== 'water');
      for (const id of subIds[s.chapter]) onBtn(btn[`s_${id}`], !!s.lit?.[id]);
      subNote.textContent = s.note ?? '';
      subNote.style.top = isFlow || isGly ? '606px' : `${454 + subIds[s.chapter].length * 36 + 8}px`;
      // 2
      if (s.chapter === 2) openV.innerHTML = `${Math.round((s.open ?? 0) * 100)}<small>%</small>`;
      // 4
      if (s.chapter === 4) {
        const d = s.dT ?? designDT();
        const f = s.fluid ?? 'pg25';
        const show = s.scene === 'racks' ? rackLpm() : g.flowLpm ?? 0;
        P4.lpm.innerHTML = `${fmt(show)}<small>L/分</small>`;
        P4.dT.innerHTML = `${fx(s.scene === 'racks' ? designDT() : d, 1)}<small>K</small>`;
        P4.fluid.textContent = s.scene === 'glycol' && f === 'water' ? '水' : 'PG25';
        const cp = SPEC.fluid[s.scene === 'glycol' ? f : 'pg25'];
        P4.calc.textContent = `${D.rackLiquidKw} kW ÷ (${cp.cp} × ${cp.rho} × ${fx(s.scene === 'racks' ? designDT() : d, 1)} K) × 60`;
        P4.flowBox.style.display = s.scene === 'flow' ? 'block' : 'none';
        P4.glyBox.style.display = s.scene === 'glycol' ? 'block' : 'none';
        P4.rackBox.style.display = s.scene === 'racks' ? 'block' : 'none';
        if (s.scene === 'flow') P4.dot.innerHTML = `<circle cx="${P4.dot._xs(d).toFixed(1)}" cy="${P4.dot._ys(rackLpm(d)).toFixed(1)}" r="4.5" fill="#fff" stroke="${C.accent}" stroke-width="2.4"/>`;
        if (s.scene === 'glycol') {
          const w = rackLpm(designDT(), 'water');
          const pg = rackLpm(designDT(), 'pg25');
          P4.gW.innerHTML = `${fx(w, 1)}<small>L/分</small>`;
          P4.gP.innerHTML = `${fx(pg, 1)}<small>L/分</small>`;
          P4.gWb.style.width = `${(w / 140) * 278}px`;
          P4.gPb.style.width = `${(pg / 140) * 278}px`;
          P4.gWb.style.background = f === 'water' ? C.ink : C.faint;
          P4.gPb.style.background = f === 'water' ? C.faint : C.accent;
        }
        if (s.scene === 'racks') {
          P4.rN.innerHTML = `${g.racks ?? 0}<small>本</small>`;
          P4.rKw.innerHTML = `${fmt(g.kw ?? 0)} / ${SPEC.cdu.kw}<small>kW</small>`;
          P4.rSeg.forEach((e, i) => (e.style.opacity = i < (g.racks ?? 0) ? '1' : '0'));
        }
        slV.textContent = `温度差 ${fx(d, 1)} K`;
        slK.style.left = `${dTx(d) - 44}px`;
      }
      // 6
      if (s.chapter === 6) {
        const fail = s.scene === 'failover';
        P6.pump.innerHTML = `${g.activePump ?? 'A'}<small>${(g.activePump ?? 'A') === 'A' ? '（B は待機）' : '（A は故障・B が運転）'}</small>`;
        P6.lpm.innerHTML = fail ? `${fmt(g.flowLpm ?? 0)}<small>L/分</small>` : '—';
        P6.temp.innerHTML = `${fx(g.tcsSupply ?? D.tcs.supply, 1)}<small>℃</small>`;
        P6.temp.style.color = (g.tcsSupply ?? 40) > D.tcs.supply + 0.05 ? C.accent : C.ink;
        P6.alarm.textContent = g.alarm ? `警報: ${g.alarm}` : '警報なし';
        P6.alarm.style.borderColor = g.alarm ? C.accent : C.line;
        P6.alarm.style.color = g.alarm ? C.accent : C.sub;
      }
      // 7
      const s7 = s.chapter === 7 ? s.ch7 ?? {view: 'screen', o: 0} : null;
      scr.style.display = s7 && s7.o > 0.02 ? 'block' : 'none';
      scrSvg.style.display = scr.style.display;
      bms.style.display = s7 && s7.view === 'bms' && (s7.ob ?? s7.o) > 0.02 ? 'block' : 'none';
      if (s7) {
        const ob = (s7.ob ?? s7.o).toFixed(2);
        scr.style.opacity = s7.o.toFixed(2);
        bms.style.opacity = ob;
        let svg = '';
        if (s7.panel) svg += `<polyline points="${s7.panel[0].toFixed(1)},${s7.panel[1].toFixed(1)} 824,318" fill="none" stroke="${C.accent}" stroke-width="1.2" opacity="${s7.o.toFixed(2)}"/><circle cx="${s7.panel[0].toFixed(1)}" cy="${s7.panel[1].toFixed(1)}" r="3.2" fill="${C.accent}" opacity="${s7.o.toFixed(2)}"/>`;
        if (s7.view === 'bms')
          ['Modbus TCP', 'SNMP', 'BACnet IP', 'Redfish'].forEach((pr, i) => {
            const x = 420 + i * 112;
            svg += `<line x1="${x}" y1="466" x2="${x}" y2="546" stroke="${C.ink}" stroke-width="1.4" stroke-dasharray="5 4" opacity="${ob}"/><rect x="${x - 46}" y="494" width="92" height="20" rx="3" fill="${C.bg}" opacity="${ob}"/><text x="${x}" y="508" text-anchor="middle" font-size="12" font-weight="700" font-family="${SANS}" fill="${C.ink}" opacity="${ob}">${pr}</text>`;
          });
        scrSvg.innerHTML = svg;
      }
      caption.style.display = s.caption ? 'block' : 'none';
      caption.textContent = s.caption ?? '';
      // tags over the 3D (they sit beside the part, no leaders)
      const TX = {l: '0', c: '-50%', r: '-100%'};
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
  };
}
