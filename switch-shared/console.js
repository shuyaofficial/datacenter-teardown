// The switch's console, laid out at 1600 x 900, all in Japanese: the title block; on the left the seven chapter buttons,
// the buttons of the chapter (views / planes / scenes / multipliers) and the controls; on the right the gauges (the
// 12 ASIC stages with the current one in the accent, the cells and the descriptor, the real serialisation time, the CPU
// queue counters, the Q1 bar and its graph in real milliseconds); along the bottom the chapter's explanation and the
// lab command with whether IOL shows it. update(s) redraws every live part from the frame's state; nothing here keeps time.
import {C, createChrome, MONO, SANS} from '../kit/ui.js';
import {CHAPTERS, fillMs, forwardMpps, poeDevices, poeFullW, q1LimitB, queueAt, SCENES, SPEC, STAGES, switchingGbps} from './kin.js';

export const subsOf = (n) => {
  const c = CHAPTERS[n - 1];
  if (c.subs) return c.subs;
  return [...c.scenes.map((id) => ({id, label: SCENES[id].name})), ...(c.mults ?? []).map((m) => ({id: `m${m}`, label: `倍率 ${m}`}))];
};
export const SUB_NOTE = {front: '前面 3/4: ポートと NM', back: '背面 3/4: 電源・ファン・スタック', open: '天板・ヒートシンク・NM・電源の順に外れる', close: '下の層から速く戻る', data: 'ASIC + PHY + 配線を強調', ctrl: 'CPU + メモリ + フラッシュを強調', air: '前面と側面から吸って背面へ', poe: '437 W 予算と 30 W 機器 14 台'};
const CSS = `
.bt[data-n]::before{content:attr(data-n);position:absolute;left:11px;top:50%;transform:translateY(-50%);width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;font:700 12px ${SANS};display:flex;align-items:center;justify-content:center;letter-spacing:0}
.bt[data-n]{padding-left:22px}
.call b i.nb{display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${C.accent};color:#fff;font:700 11px ${SANS};font-style:normal;flex:none}
.call.n b{gap:6px}
.call.n span{margin-left:24px}
.tg{position:absolute;white-space:nowrap;line-height:1.25}
.tg.blk b{display:block;font:700 13px ${SANS};color:${C.ink};letter-spacing:.02em}
.tg.blk span{display:block;font:500 11.5px/1.3 ${SANS};color:${C.sub};white-space:nowrap}
.tg.blk.on b{color:${C.accent}}
.tg.blk.on span{color:${C.ink}}
.tg.lbl{padding:4px 8px;border-radius:5px;background:${C.panel};border:1px solid ${C.line}}
.tg.lbl b{display:block;font:700 13px ${SANS};color:${C.ink}}
.tg.lbl span{display:block;font:500 11.5px ${SANS};color:${C.sub}}
.tg.lbl.on{border-color:${C.accent}}
.tg.lbl.on b{color:${C.accent}}
.tg.note{font:600 12px ${SANS};color:${C.mute};letter-spacing:.04em}
.tg.port{font:700 13px ${SANS};color:${C.ink};text-shadow:0 0 4px ${C.bg},0 0 8px ${C.bg}}
.tg.port span{font:500 11.5px ${SANS};color:${C.sub};margin-left:5px}
.tg.chip{padding:2px 7px;border-radius:4px;background:#fff;border:1.5px solid ${C.accent};color:${C.accent};font:700 12px ${SANS}}
.tg.body{padding:2px 7px;border-radius:4px;background:${C.ink};color:#fff;font:700 12px ${SANS}}
.tg.card{padding:8px 11px;border-radius:6px;background:${C.panel};border:1px solid ${C.line};box-shadow:0 2px 10px rgba(110,90,60,.1);font:500 12px/1.65 ${MONO};color:${C.ink}}
.tg.card b{display:block;font:700 13px ${SANS};margin-bottom:2px}
.tg.card i{display:inline-block;width:76px;font:500 11.5px ${SANS};font-style:normal;color:${C.sub}}
.tg.card em{font-style:normal;font-weight:700;color:${C.accent}}
.tg.card .nt{font:500 11px ${SANS};color:${C.mute}}
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

  // ------------------------------------------------------------ header
  add(`<div style="position:absolute;left:0;top:0;width:150px;height:92px;background:${C.accent}"></div>`);
  add(`<svg style="position:absolute;left:38px;top:22px" width="74" height="50" viewBox="0 0 74 50"><rect x="3" y="12" width="68" height="26" rx="2" fill="none" stroke="#fff" stroke-width="3"/><path d="M9 20h4v10H9zM16 20h4v10h-4zM23 20h4v10h-4zM30 20h4v10h-4zM37 20h4v10h-4zM44 20h4v10h-4zM51 20h4v10h-4z" fill="#fff"/><rect x="59" y="19" width="8" height="12" fill="none" stroke="#fff" stroke-width="2"/></svg>`);
  add(`<div class="sm" style="position:absolute;left:172px;top:16px;letter-spacing:.12em">ネットワーク機器のしくみ　01</div>`);
  add(`<div style="position:absolute;left:170px;top:34px;font:700 34px ${SANS};letter-spacing:.02em;line-height:1">スイッチの分解 <span style="color:${C.accent};font-weight:400">/</span> <span style="font-size:24px">1U・48 ポート PoE+</span></div>`);
  add(`<div style="position:absolute;left:172px;top:76px;font:500 14px ${SANS};color:${C.sub};letter-spacing:.04em">UADP 2.0 ASIC 1 個・PHY ${SPEC.phy} 個・x86 ${SPEC.cpu.cores} コア ${SPEC.cpu.ghz} GHz・DDR4 ${SPEC.cpu.ddr4GB} GB・電源 ${SPEC.psuW} W</div>`);
  add(`<div style="position:absolute;left:1036px;top:16px;width:540px;height:72px;background:${C.panel};border:1px solid ${C.line};border-radius:6px"></div>`);
  [['交換容量', fx(switchingGbps(), 0), 'Gbps'], ['転送レート', fx(forwardMpps(), 2), 'Mpps'], ['重さ', fx(SPEC.chassis.kg, 2), 'kg']].forEach(([k, v, u], i) => {
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
  const subNote = add(`<div style="position:absolute;left:44px;top:562px;width:268px;font:500 12px/1.35 ${SANS};color:${C.sub}"></div>`);

  // ------------------------------------------------------------ 03 controls
  panel(28, 608, 300, 132, '操作', '03');
  add(`<div style="position:absolute;left:44px;top:642px;width:268px;font:500 13px/1.75 ${SANS};color:${C.sub}">ドラッグ: 回す　ホイール: 寄る<br>どれかの章を押すと自動ツアーを止める<br>25 秒そのままだとツアーに戻る</div>`);

  // ------------------------------------------------------------ 04 gauges
  panel(1262, 108, 310, 632, '計器', '04');
  const sm = (x, y, t, extra = '') => add(`<div class="sm" style="position:absolute;left:${x}px;top:${y}px;font-size:12px;${extra}">${t}</div>`);
  sm(1278, 142, 'ASIC の段（いま通っているところ）');
  const rows = STAGES.map((s, i) => {
    const y = 162 + i * 19.5;
    const bg = add(`<div style="position:absolute;left:1274px;top:${y}px;width:282px;height:18.5px;border-radius:3px"></div>`);
    const txt = add(`<div style="position:absolute;left:1280px;top:${y + 1}px;width:272px;height:16px;white-space:nowrap;font:600 12.5px/16px ${SANS}"><span class="mo" style="display:inline-block;width:20px;font-size:11px">${s.n}</span><span class="mo" style="display:inline-block;width:70px;font-size:11.5px;font-weight:700">${s.abbr}</span><span style="font-weight:500;font-size:12px">${s.ja}</span></div>`);
    return {bg, txt};
  });
  sm(1278, 398, '動きは説明用に引き伸ばしています', 'font-size:11px;letter-spacing:.02em');
  add(`<div style="position:absolute;left:1278px;top:420px;width:278px;height:1px;background:${C.line}"></div>`);
  const cellMain = add(`<div style="position:absolute;left:1278px;top:428px;width:280px;font:700 21px ${SANS};white-space:nowrap"></div>`);
  const cellSub = add(`<div class="mo" style="position:absolute;left:1278px;top:458px;width:280px;font-size:12px;color:${C.sub};white-space:nowrap"></div>`);
  const descLine = add(`<div class="mo" style="position:absolute;left:1278px;top:478px;width:280px;font-size:12px;color:${C.sub};white-space:nowrap"></div>`);
  const serLine = add(`<div class="mo" style="position:absolute;left:1278px;top:498px;width:280px;font-size:12px;color:${C.ink};white-space:nowrap"></div>`);
  add(`<div style="position:absolute;left:1278px;top:524px;width:278px;height:1px;background:${C.line}"></div>`);
  // CPU queue counters
  sm(1278, 532, 'CPU キュー（CoPP の手前）');
  const qName = add(`<div class="mo" style="position:absolute;left:1380px;top:533px;width:176px;text-align:right;font-size:11px;color:${C.sub};white-space:nowrap"></div>`);
  const cpuCols = ['到着', '通過', '捨て'].map((k, i) => {
    const x = 1278 + i * 94;
    sm(x, 552, k, 'font-size:11px');
    return add(`<div style="position:absolute;left:${x}px;top:566px;width:92px;font:700 18px Inter,${SANS};white-space:nowrap"></div>`);
  });
  const cpuLim = add(`<div class="mo" style="position:absolute;left:1278px;top:592px;width:280px;font-size:11px;color:${C.sub};white-space:nowrap"></div>`);
  add(`<div style="position:absolute;left:1278px;top:612px;width:278px;height:1px;background:${C.line}"></div>`);
  // Q1
  sm(1278, 618, 'Q1 の溜まり量');
  const q1Main = add(`<div style="position:absolute;left:1380px;top:615px;width:176px;text-align:right;font:700 15px Inter,${SANS};white-space:nowrap"></div>`);
  add(`<div style="position:absolute;left:1278px;top:638px;width:278px;height:9px;border-radius:2px;background:#ebe2d4"></div>`);
  const q1Bar = add(`<div style="position:absolute;left:1278px;top:638px;height:9px;border-radius:2px;background:${C.ink}"></div>`);
  const q1Sub = add(`<div class="mo" style="position:absolute;left:1278px;top:650px;width:280px;font-size:11px;color:${C.sub};white-space:nowrap"></div>`);
  const CH = {x: 1280, y: 678, w: 252, h: 44};
  const chart = add(`<svg style="position:absolute;left:${CH.x}px;top:${CH.y}px;overflow:visible" width="${CH.w}" height="${CH.h}"></svg>`);

  // ------------------------------------------------------------ 05 the explanation band
  panel(28, 752, 1544, 120, '', '05');
  const bandT = add(`<div style="position:absolute;left:44px;top:760px;font:700 16px ${SANS};letter-spacing:.04em;white-space:nowrap"></div>`);
  const bandText = add(`<div style="position:absolute;left:44px;top:786px;width:880px;font:500 14px/1.62 ${SANS};color:${C.ink}"></div>`);
  add(`<div style="position:absolute;left:944px;top:762px;width:1px;height:96px;background:${C.line}"></div>`);
  const labBox = add(`<div style="position:absolute;left:960px;top:762px;width:598px;font:500 12px/1.9 ${MONO};color:${C.ink};white-space:nowrap"></div>`);
  add(`<div class="sm" style="position:absolute;left:24px;top:876px;font-size:11px;letter-spacing:.06em;background:${C.bg};padding:1px 6px;border-radius:3px">非公式の教材。Catalyst 9300-48P を模した簡略形状で、Cisco・Catalyst は Cisco Systems, Inc. の商標。数値は refs.md の出典による</div>`);
  // the caption over the 3D view: what is happening right now (chapters 4-6)
  const caption = add(`<div style="position:absolute;left:350px;top:112px;width:900px;text-align:center;font:700 17px ${SANS};color:${C.ink};letter-spacing:.03em;white-space:nowrap;text-shadow:0 0 6px ${C.bg},0 0 12px ${C.bg}"></div>`);
  // chapter 7: the PoE budget
  const poe = add(`<div class="cp" style="left:362px;top:118px;width:372px;height:170px;display:none"></div>`);
  {
    const B = SPEC.poeBudgetW;
    const n = poeDevices();
    const full = poeFullW();
    const W0 = 340;
    const seg = Array.from({length: n}, (_, i) => `<div style="position:absolute;left:${(i * SPEC.poeDeviceW * W0) / B}px;top:0;width:${(SPEC.poeDeviceW * W0) / B - 2}px;height:16px;background:${C.accent};border-radius:1px"></div>`).join('');
    poe.innerHTML =
      `<div class="ph" style="left:14px;top:12px"><i></i>PoE の予算（${SPEC.psuW} W 電源 1 台）</div>` +
      `<div style="position:absolute;left:16px;top:44px;font:700 22px ${SANS}">${B}<span style="font-size:13px;font-weight:500"> W</span><span style="font:500 13px ${SANS};color:${C.sub};margin-left:10px">${SPEC.poeDeviceW} W の機器は <b style="color:${C.accent};font-size:17px">${n}</b> 台まで（${B} ÷ ${SPEC.poeDeviceW} = ${(B / SPEC.poeDeviceW).toFixed(2)}）</span></div>` +
      `<div style="position:absolute;left:16px;top:80px;width:${W0}px;height:16px;background:#ebe2d4;border-radius:2px">${seg}</div>` +
      `<div style="position:absolute;left:16px;top:100px;font:500 11px ${SANS};color:${C.mute}">1 マス = ${SPEC.poeDeviceW} W・残り ${B - n * SPEC.poeDeviceW} W</div>` +
      `<div style="position:absolute;left:16px;top:124px;width:${W0}px;height:8px;background:#ebe2d4;border-radius:2px"><div style="width:${((B / full) * W0).toFixed(1)}px;height:8px;background:${C.ink};border-radius:2px"></div></div>` +
      `<div style="position:absolute;left:16px;top:138px;font:500 12px ${SANS};color:${C.sub}">48 ポート全部に ${SPEC.poeDeviceW} W なら <b style="color:${C.ink}">${full.toLocaleString('en-US')} W</b> 要る（予算はその ${Math.round((B / full) * 100)}%）</div>`;
  }

  // ------------------------------------------------------------ callouts, the pointer
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const tagG = add(`<div style="position:absolute;inset:0"></div>`);
  const pointer = ui.late();
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, ui.centre(n)]));

  // Q1's graph: bytes against real milliseconds, 0-16 ms
  const MS_MAX = 16;
  const xOf = (ms) => (ms / MS_MAX) * CH.w;
  const q1Chart = (mult, q) => {
    const lim = q1LimitB(mult);
    const yOf = (b) => CH.h - 4 - (b / lim) * (CH.h - 12);
    let p = '';
    for (let k = 0; k <= 64; k++) {
      const ms = (k / 64) * MS_MAX;
      p += `${k ? 'L' : 'M'}${xOf(ms).toFixed(1)} ${yOf(queueAt(ms, mult).bytes).toFixed(1)}`;
    }
    const tf = fillMs(mult);
    const now = Math.min(MS_MAX, q.tMs);
    const clip = (d) => `<clipPath id="qc"><rect x="0" y="0" width="${xOf(now).toFixed(1)}" height="${CH.h}"/></clipPath>${d}`;
    return (
      `<line x1="0" x2="${CH.w}" y1="${yOf(lim).toFixed(1)}" y2="${yOf(lim).toFixed(1)}" stroke="${C.mute}" stroke-dasharray="4 4"/>` +
      `<line x1="0" x2="${CH.w}" y1="${CH.h - 4}" y2="${CH.h - 4}" stroke="${C.ink}"/>` +
      `<path d="${p}" fill="none" stroke="${C.faint}" stroke-width="2"/>` +
      clip(`<path d="${p}" fill="none" stroke="${C.accent}" stroke-width="2.4" clip-path="url(#qc)"/>`) +
      `<line x1="${xOf(tf).toFixed(1)}" x2="${xOf(tf).toFixed(1)}" y1="${yOf(lim).toFixed(1)}" y2="${CH.h - 4}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="2 3"/>` +
      `<circle cx="${xOf(now).toFixed(1)}" cy="${yOf(q.bytes).toFixed(1)}" r="4" fill="#fff" stroke="${C.accent}" stroke-width="2.2"/>` +
      `<text x="0" y="${CH.h + 11}" font-size="10" fill="${C.mute}" font-family="${SANS}">0 ms</text><text x="${CH.w}" y="${CH.h + 11}" text-anchor="end" font-size="10" fill="${C.mute}" font-family="${SANS}">${MS_MAX} ms（実時間）</text>` +
      `<text x="${Math.min(CH.w - 70, xOf(tf) + 4).toFixed(1)}" y="${(yOf(lim) + 14).toFixed(1)}" font-size="10" fill="${C.sub}" font-family="${SANS}">満杯 ${fx(tf, 4)} ms</text>`
    );
  };

  return {
    btn,
    spots,
    subIds,
    root: ui.root,
    update(s) {
      const ch = CHAPTERS[s.chapter - 1];
      for (const c of CHAPTERS) onBtn(btn[`c_${c.n}`], c.n === s.chapter);
      for (const n of Object.keys(subIds)) for (const id of subIds[n]) btn[`s_${id}`].style.display = Number(n) === s.chapter ? 'flex' : 'none';
      for (const id of subIds[s.chapter]) onBtn(btn[`s_${id}`], !!s.lit?.[id]);
      subNote.textContent = s.note ?? '';
      // 04 gauges: the stage list
      rows.forEach((r, i) => {
        const on = i === s.stage;
        r.bg.style.background = on ? C.accent : 'transparent';
        r.txt.style.color = on ? '#fff' : C.ink;
        r.txt.style.opacity = s.stage < 0 ? 0.62 : on ? 1 : 0.72;
      });
      const sc = SCENES[s.scene ?? 'l2'];
      const pk = s.packet;
      const nCell = Math.ceil(sc.bytes / SPEC.cellB);
      const lastB = sc.bytes - SPEC.cellB * (nCell - 1);
      cellMain.innerHTML = `${sc.bytes}${unit('B')} → 切れ端 ${nCell}${unit('個')}`;
      cellSub.textContent = nCell > 1 ? `256 B × ${nCell - 1} + ${lastB} B` : `${sc.bytes} B が 1 個`;
      const where = { ifc: 'IFC', pbc: 'PBC', eqs: 'EQS', efc: 'EFC', rwe: 'RWE', cpu: 'CPU' };
      descLine.textContent = `札 ${SPEC.descB} B（本体の 1/${fx(sc.bytes / SPEC.descB, 1)}）　位置: ${pk?.desc?.at ? where[pk.desc.at] : '—'}`;
      const ser = (sc.bytes + SPEC.frame.overhead) * 8 / (sc.rateGbps * 1e9) * 1e6;
      serLine.textContent = `線に乗る時間 ${fx(ser, 3)} µs（${sc.rateGbps} Gbps）`;
      // CPU queue counters
      const pu = s.punt;
      if (pu && pu.queue) {
        qName.textContent = `Q${pu.queue}・上限 ${fmt(pu.limit)} pps`;
        const rate = s.scene === 'storm';
        const v = rate ? [pu.offeredPps, pu.passPps, pu.dropPps] : [pu.offered, pu.pass, pu.drop];
        cpuCols.forEach((n, i) => (n.innerHTML = `${fmt(v[i])}${unit(rate ? 'pps' : '個', 11)}`));
        cpuCols[2].style.color = pu.drop > 0 ? C.accent : C.ink;
        cpuLim.textContent = `CPU 全体 約 ${fmt(pu.cpuTotalPps)} pps（ハードの約 1/${fmt((forwardMpps() * 1e6) / pu.cpuTotalPps)}）`;
      } else {
        qName.textContent = '';
        cpuCols.forEach((n) => ((n.innerHTML = `<span style="color:${C.mute}">—</span>`), (n.style.color = C.ink)));
        cpuLim.textContent = `CPU 全体 約 ${fmt(SPEC.punt.cpuTotalPps)} pps（ハードの約 1/${fmt((forwardMpps() * 1e6) / SPEC.punt.cpuTotalPps)}）`;
      }
      // Q1
      const q = s.queue ?? queueAt(0, s.mult ?? 100);
      const mult = s.mult ?? 100;
      q1Main.innerHTML = `${fmt(q.bytes)}${unit('B', 11)}`;
      q1Bar.style.width = `${(q.pct * 278).toFixed(1)}px`;
      q1Bar.style.background = q.full ? C.accent : C.ink;
      q1Sub.textContent = `上限 ${fmt(q.limit)} B（倍率 ${mult}）・捨て ${fmt(q.droppedFrames)} 個`;
      chart.innerHTML = q1Chart(mult, q);
      // 05 band
      bandT.textContent = `${ch.n}　${ch.name}`;
      bandText.textContent = ch.text;
      labBox.innerHTML =
        `<span style="color:${C.mute};font-family:${SANS};font-weight:700">ラボで</span>` +
        ch.lab.map((l) => `<br><span style="display:inline-block;width:52px;color:${l.iol ? C.ok : C.mute};font-family:${SANS};font-weight:700">${l.iol ? 'IOL' : '実機'}</span>${l.cmd}`).join('') +
        (ch.iolAlt ? `<br><span style="color:${C.sub};font-family:${SANS}">${ch.iolAlt}</span>` : '');
      caption.textContent = s.caption ?? '';
      poe.style.display = s.chapter === 7 ? 'block' : 'none';
      // tags over the 3D: block names, the descriptor's and the body's chips, cards (no leaders: they sit beside the part)
      const TX = {l: '-100%', c: '-50%', r: '0'};
      const TY = {t: '0', m: '-50%', b: '-100%'};
      tagG.innerHTML = (s.tags ?? [])
        // nothing under the caption line (112-140) or outside the view between the panels
        .filter((g) => g.o > 0.02 && g.x > 340 && g.x < 1260 && g.y < 742 && g.y - (g.v === 'b' ? 34 : g.v === 'm' ? 16 : 0) > 146)
        .map((g) => `<div class="tg ${g.kind}${g.on ? ' on' : ''}" style="left:${g.x.toFixed(1)}px;top:${g.y.toFixed(1)}px;transform:translate(${TX[g.h]},${TY[g.v]});opacity:${g.o.toFixed(2)};text-align:${g.h === 'l' ? 'right' : g.h === 'r' ? 'left' : 'center'}${g.w ? `;max-width:${g.w}px;white-space:normal` : ''}">${g.html}</div>`)
        .join('');
      // callouts: a numbered dot, the name, the one-line spec, a thin leader to the part
      let lh = '';
      let ch2 = '';
      for (const c of s.callouts ?? []) {
        if (c.o < 0.02) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const ex = lx + 9;
        const ey = c.up ? ly + 41 : ly - 2;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${C.accent}" stroke-width="1" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3" fill="${C.accent}" opacity="${c.o.toFixed(2)}"/>`;
        ch2 += `<div class="call n" style="left:${lx.toFixed(1)}px;top:${(ly - 1).toFixed(1)}px;opacity:${c.o.toFixed(2)}"><b><i class="nb">${c.n}</i>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch2;
      pointer(s.cursor);
    },
    pointer,
    MONO,
  };
}
