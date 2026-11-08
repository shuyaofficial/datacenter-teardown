// 操作の通し確認（受け入れ基準のうち、画像では見えないもの）。
// node room-web/app/tools/smoke.mjs [stub|v2]
// コンソールのエラー（favicon の 404 を除く）、LIVE、キーで歩いて壁を抜けない、床の印で歩いて写真へ、
// 写真モードの矢印、自動ツアー（自動で始まる・押すと止まる・25 秒で戻る・reduced-motion では始まらない）、
// 横はみ出しと文字の切れを見る。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/package.json'));
const {chromium} = require('playwright');
const set = process.argv[2] || 'stub';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp'};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'}); res.end(d);
  });
}).listen(0, '127.0.0.1');
await new Promise((ok) => server.once('listening', ok));
const base = `http://127.0.0.1:${server.address().port}/room-web/app/index.html?data=${set}`;
const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu']});

let fails = 0;
const check = (name, ok, extra = '') => { if (!ok) fails += 1; console.log(`${ok ? 'ok  ' : 'NG  '}${name}${extra ? `  ${extra}` : ''}`); };

async function open(query, {w = 1440, h = 900, reduced = false} = {}) {
  const page = await browser.newPage({viewport: {width: w, height: h}, reducedMotion: reduced ? 'reduce' : 'no-preference'});
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text() + ' @ ' + (m.location()?.url ?? '')); });
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) errs.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${base}&${query}`);
  await page.waitForFunction('window.READY === true', null, {timeout: 120000});
  return {page, errs: () => errs.filter((e) => !/favicon\.ico/.test(e) && !/^Failed to load resource: .*404.* @ .*favicon/.test(e))};
}
const layoutIssues = (page) => page.evaluate(() => {
  const out = [];
  if (document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth) out.push('横はみ出し');
  for (const el of document.querySelectorAll('button, .tag, #info, #card, #note, .mark, .go .lbl')) {
    if (el.getClientRects().length === 0 || getComputedStyle(el).visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 0.5 || r.left < -0.5) out.push(`画面外: ${el.id || el.className} ${el.textContent.trim().slice(0, 12)}`);
    if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== 'auto') out.push(`文字の切れ: ${el.id || el.className} ${el.textContent.trim().slice(0, 12)}`);
  }
  const panels = ['info', 'tools', 'chapters', 'hint', 'note', 'card', 'tourbar'].map((id) => document.getElementById(id))
    .filter((e) => e && !e.hidden && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => e.getBoundingClientRect());
  for (const t of document.querySelectorAll('.tag, .go, .mark')) {
    if (t.style.display === 'none' || !t.getClientRects().length) continue;
    const r = t.getBoundingClientRect();
    if (panels.some((p) => r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top)) out.push(`札が板の下: ${t.textContent.trim().slice(0, 12)}`);
  }
  return out;
});
const live = (page) => page.evaluate(() => window.LIVE);

// 1) PC 3D: キーで歩く・壁を抜けない
{
  const {page, errs} = await open('mode=3d&tour=0&view=3d&debug=1');
  const L = await live(page);
  check('LIVE の形', L && L.mode === '3d' && 'station' in L && 'tour' in L && 'flows' in L, JSON.stringify(L));
  const p0 = await page.evaluate(() => window.APP.walk.pos.toArray());
  // GPU が混んでコマ数が落ちても判定がぶれないよう、長めに押す（1 コマの進みは上限で切ってある）
  await page.keyboard.down('w'); await page.waitForTimeout(3000); await page.keyboard.up('w');
  const p1 = await page.evaluate(() => window.APP.walk.pos.toArray());
  check('W で前へ進む', Math.hypot(p1[0] - p0[0], p1[2] - p0[2]) > 1.0, `${p0.map((v) => v.toFixed(2))} → ${p1.map((v) => v.toFixed(2))}`);
  // 横（ラックの列）へ 4 秒押し続ける
  await page.keyboard.down('a'); await page.waitForTimeout(4000); await page.keyboard.up('a');
  const p2 = await page.evaluate(() => window.APP.walk.pos.toArray());
  const inFree = await page.evaluate(([x, , z]) => window.GRID.free(x, z), p2);
  check('壁・ラックに入らない（A を 4 秒）', inFree && Math.abs(p2[2] - p1[2]) < 0.6, `z ${p1[2].toFixed(2)} → ${p2[2].toFixed(2)}`);
  check('3D 横はみ出し・文字の切れなし', (await layoutIssues(page)).length === 0, (await layoutIssues(page)).join(' / '));
  check('3D コンソールのエラー 0', errs().length === 0, errs().join(' | '));
  await page.close();
}

// 2) PC 3D: 床の印を押す → 歩く → 0.6 秒止まって写真へ
{
  // 次の地点の方角は部屋ごとに違うので、4方向を順に見て印を探す
  let page, errs, target = null;
  for (const yaw of [0, 90, 180, 270]) {
    ({page, errs} = await open(`mode=3d&tour=0&view=3d&debug=1&yaw=${yaw}&pitch=-25`));
    target = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.mark')].filter((e) => e.style.display !== 'none');
      return els.length ? {text: els[0].textContent, r: els[0].getBoundingClientRect().toJSON()} : null;
    });
    if (target) break;
    await page.close();
  }
  check('床の印が見える', Boolean(target), target?.text);
  if (target) {
    await page.mouse.click(target.r.x + target.r.width / 2, target.r.y + target.r.height / 2);
    await page.waitForFunction('window.LIVE && window.LIVE.photo === true', null, {timeout: 20000}).catch(() => {});
    const L = await live(page);
    check('印の地点まで歩いて写真に切り替わる', L.photo === true, JSON.stringify(L));
    const yawBefore = await page.evaluate(() => window.APP.world.view.yaw);
    await page.keyboard.down('s'); await page.waitForTimeout(500); await page.keyboard.up('s');
    await page.waitForTimeout(400);
    check('動き出すと 3D へ戻る', (await live(page)).photo === false);
    const yawAfter = await page.evaluate(() => window.APP.world.view.yaw);
    check('切り替えで向きが変わらない', Math.abs(yawAfter - yawBefore) < 0.01, `${yawBefore.toFixed(2)} / ${yawAfter.toFixed(2)}`);
  }
  check('歩行 コンソールのエラー 0', errs().length === 0, errs().join(' | '));
  await page.close();
}

// 3) 写真モード（スマホ）: 矢印で次の地点へ
{
  const {page, errs} = await open('mode=photo&tour=0', {w: 390, h: 844});
  const s0 = (await live(page)).station;
  const go = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.go')].find((e) => e.style.display !== 'none');
    return el ? el.getBoundingClientRect().toJSON() : null;
  });
  check('次の地点への矢印が見える', Boolean(go));
  if (go) {
    await page.mouse.click(go.x + 26, go.y + 26);
    await page.waitForTimeout(1500);
    const s1 = (await live(page)).station;
    check('矢印で次の地点へ移る', s1 && s1 !== s0, `${s0} → ${s1}`);
  }
  await page.click('#b-flows'); await page.waitForTimeout(800);
  check('写真モードで流れを出せる', Boolean((await live(page)).flows), String((await live(page)).flows));
  check('スマホ 横はみ出し・文字の切れなし', (await layoutIssues(page)).length === 0, (await layoutIssues(page)).join(' / '));
  check('写真 コンソールのエラー 0', errs().length === 0, errs().join(' | '));
  await page.close();
}

// 4) 自動ツアー: 放っておくと始まる → 押すと止まる → 25 秒で戻る
{
  const {page, errs} = await open('mode=photo', {w: 390, h: 844});
  await page.waitForFunction('window.LIVE.tour === "running"', null, {timeout: 10000}).catch(() => {});
  check('放っておくとツアーが始まる', (await live(page)).tour === 'running');
  await page.waitForTimeout(2500);
  await page.mouse.click(200, 300);
  await page.waitForTimeout(300);
  check('押すと止まる', (await live(page)).tour === 'paused', (await live(page)).tour);
  await page.waitForFunction('window.LIVE.tour === "running"', null, {timeout: 30000}).catch(() => {});
  check('25 秒触らないと戻る', (await live(page)).tour === 'running');
  check('ツアー コンソールのエラー 0', errs().length === 0, errs().join(' | '));
  await page.close();
}
{
  const {page, errs} = await open('mode=3d&tour=1&view=3d');
  await page.waitForFunction('window.LIVE.photo === true', null, {timeout: 20000}).catch(() => {});
  const a = await live(page);
  await page.waitForFunction((s) => window.LIVE.station !== s && window.LIVE.photo === true, a.station, {timeout: 30000}).catch(() => {});
  const b = await live(page);
  check('3D のツアーが歩いて写真に切り替え、次の地点へ進む', a.photo && b.photo && a.station !== b.station && b.flows, `${a.station} → ${b.station} 流れ ${b.flows}`);
  check('3D ツアー コンソールのエラー 0', errs().length === 0, errs().join(' | '));
  await page.close();
}
{
  const {page} = await open('mode=3d', {reduced: true});
  await page.waitForTimeout(4500);
  check('reduced-motion では自動で始まらない', (await live(page)).tour === 'off', (await live(page)).tour);
  await page.close();
}

await browser.close();
server.close();
console.log(fails ? `${fails} 件 NG` : 'すべて ok');
process.exit(fails ? 1 : 0);
