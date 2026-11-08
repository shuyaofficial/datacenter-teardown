// 読み物ページ（teardown-out/room/read-site = room-read/build.sh の出力）をスマホ幅で撮る。縦動画（make_vertical_read.py）の素材。
//   node promo/shoot_read.mjs [outDir] [枚数]   → <outDir>/read-scroll-NNN.png（ページの頭から通路の途中まで一定の歩幅でスクロールした連番）・read-loops.png（液冷の2つの輪の節）
// 画面は 360x640・倍率 3（1080x1920）。明るい配色で撮る。静的サーバーは 127.0.0.1 の空きポート（room-web/shoot.mjs と同じ）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/package.json'));
const {chromium} = require('playwright');
const proj = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(proj, 'teardown-out/room/read-site');
const outDir = process.argv[2] ?? path.join(proj, 'teardown-out/read-shots');
const SHOTS = Number(process.argv[3] ?? 108);
const WALK_PART = 0.5;   // 通路の節をどこまで進めるか（0〜1）
fs.mkdirSync(outDir, {recursive: true});

const types = {'.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml'};
const server = http.createServer((req, res) => {
  let p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'}); res.end(d);
  });
}).listen(0, '127.0.0.1');
await new Promise((ok) => server.once('listening', ok));

const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal']});
const ctx = await browser.newContext({viewport: {width: 360, height: 640}, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'light'});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/`, {waitUntil: 'networkidle'});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(800);
// ページの頭から通路の途中まで、一定の歩幅でスクロールしては撮る（高画質の連番が読み込まれるのを待つ）
const [top, span] = await page.evaluate(() => {
  const w = document.getElementById('walk');
  return [w.offsetTop, w.offsetHeight - innerHeight];
});
const end = Math.round(top + span * WALK_PART);
for (let i = 0; i < SHOTS; i++) {
  const p = i / (SHOTS - 1);
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(end * p * p * (3 - 2 * p)));
  await page.waitForTimeout(140);
  await page.screenshot({path: path.join(outDir, `read-scroll-${String(i).padStart(3, '0')}.png`)});
}

// 液冷の2つの輪: 図のある節を、見出しから図の下までまとめて1枚に
const loops = await page.evaluate(() => {
  const s = document.querySelector('.loops').closest('section');
  s.scrollIntoView();
  const r = s.getBoundingClientRect();
  return {y: r.top + scrollY, h: r.height};
});
await page.waitForTimeout(600);
await page.screenshot({path: path.join(outDir, 'read-loops.png'), fullPage: true, clip: {x: 0, y: loops.y, width: 360, height: loops.h}});
console.log(`scroll ${SHOTS} shots to ${end} px, loops section ${Math.round(loops.h)} px tall, errors ${errs.length} ${errs.slice(0, 2).join(' | ')}`);
await browser.close(); server.close();
