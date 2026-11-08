// 部屋ツアー（room-web/app?data=v2）を 1920x1080・30 fps で録画し、teardown-out/room-silent.mp4 にする（縦動画の素材）。
//   node promo/rec_room.mjs [out.mp4] [--shots <dir>]   （--shots は場面ごとの静止画だけを撮って確かめる）
// アプリは performance.now と requestAnimationFrame で動くので、Playwright の page.clock で時計を止め、
// 1/30 秒ずつ進めては撮る（遅い PC でも動きの速さが実時間どおりになる）。画面は 1280x720・倍率 1.5 で、
// 文字を 1920x1080 そのままより 1.5 倍大きく撮る。静的サーバーは 127.0.0.1 の空きポート（room-web/shoot.mjs と同じ）。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/package.json'));
const {chromium} = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const shotsAt = args.indexOf('--shots');
const shots = shotsAt >= 0 ? args.splice(shotsAt, 2)[1] : null;
const out = args[0] ?? path.join(root, 'teardown-out/room-silent.mp4');
const FPS = 30, CW = 1280, CH = 720, DPR = 1.5;

const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp'};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'}); res.end(d);
  });
}).listen(0, '127.0.0.1');
await new Promise((ok) => server.once('listening', ok));
const base = `http://127.0.0.1:${server.address().port}/room-web/app/index.html`;
const url = `${base}?data=v2&mode=3d&station=cold-in&view=3d&tour=0&debug=1&yaw=-8`;

const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--use-angle=metal', '--enable-gpu']});
const ctx = await browser.newContext({viewport: {width: CW, height: CH}, deviceScaleFactor: DPR});
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.clock.install({time: 0});
const realSleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
const open = async (u) => {
  await page.goto(u);
  for (let k = 0; !(await page.evaluate(() => window.READY === true)); k++) {
    if (k > 3000) throw new Error('READY にならない: ' + errs.join(' | '));
    await page.clock.runFor(50); await realSleep(10);
  }
};
await open(url);

// --- 撮影 ---
let ff = null, frames = 0;
if (!shots) {
  ff = spawn('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], {stdio: ['pipe', 'inherit', 'inherit']});
} else fs.mkdirSync(shots, {recursive: true});
const marks = [];
const grab = async () => {
  await page.clock.runFor(1000 / FPS);
  if (ff) {
    const buf = await page.screenshot({type: 'jpeg', quality: 93});
    if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok));
  } else await realSleep(4);   // 静止画だけのときも、読み込みが実時間で進む余地を残す
  frames += 1;
};
const mark = async (label) => {
  const yp = await page.evaluate(() => [window.APP.world.view.yaw, window.APP.world.view.pitch].map((v) => +v.toFixed(1)));
  marks.push({t: +(frames / FPS).toFixed(2), label, yaw: yp[0], pitch: yp[1]});
  console.log(`${(frames / FPS).toFixed(2)} s  ${label}  yaw ${yp[0]} pitch ${yp[1]}`);
  if (shots) await page.screenshot({path: path.join(shots, `${String(marks.length).padStart(2, '0')}-${label}.png`)});
};
// sec 秒撮りながら、見る向きを yaw / pitch（度。null はそのまま）へなめらかに回す。yaw は近い回り方を選ぶ
const hold = async (sec, yaw1 = null, pitch1 = null) => {
  const [y0, p0] = await page.evaluate(() => [window.APP.world.view.yaw, window.APP.world.view.pitch]);
  const dy = yaw1 === null ? 0 : ((yaw1 - y0) % 360 + 540) % 360 - 180;
  const dp = pitch1 === null ? 0 : pitch1 - p0;
  const n = Math.round(sec * FPS);
  for (let i = 1; i <= n; i++) {
    const e = (i / n) * (i / n) * (3 - 2 * (i / n));
    if (dy || dp) await page.evaluate(([y, p]) => { window.APP.world.view.yaw = y; window.APP.world.view.pitch = p; }, [y0 + dy * e, p0 + dp * e]);
    await grab();
  }
};
// 地点まで歩かせ、写真に切り替わり終わるまで撮る
const walkTo = async (id, maxSec = 25) => {
  await page.evaluate((s) => { window.__arrived = null; (window.APP.walk ? window.APP.walk.walkTo(s) : window.APP.photo.go(s)).then((ok) => { window.__arrived = ok; }); }, id);
  for (let i = 0; i < maxSec * FPS; i++) {
    await grab();
    const got = await page.evaluate(() => window.__arrived);
    if (got === true) return;
    if (got === false) break;
  }
  const st = await page.evaluate(() => ({arrived: window.__arrived, live: window.LIVE, pos: window.APP.walk?.pos.toArray().map((v) => +v.toFixed(2))}));
  await page.screenshot({path: out.replace(/\.mp4$/, '') + `-walk-${id}.png`});
  console.log(JSON.stringify(st));
  throw new Error(`${id} に着かない`);
};
const clickTag = async (title) => {
  const box = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('#tags .tag')].find((e) => e.style.display !== 'none' && e.querySelector('b')?.textContent === t);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {x: r.x + r.width / 2, y: r.y + r.height / 2};
  }, title);
  if (!box) {
    const seen = await page.evaluate(() => [...document.querySelectorAll('#tags .tag')].filter((e) => e.style.display !== 'none').map((e) => e.querySelector('b').textContent));
    await page.screenshot({path: out.replace(/\.mp4$/, '') + '-notag.png'});
    throw new Error(`札が見えない: ${title}（見えている札: ${seen.join(', ')}）`);
  }
  await page.mouse.click(box.x, box.y);
};

// 筋書き: 冷たい通路の入口（3D）→ 歩いて GPU ラックの前（写真）→ 札のカード → 流れを見る（熱）→ 温かい通路 → CDU
await mark('cold-in-3d');
await hold(4.6, 8);
await mark('walk-cold-mid');
await walkTo('cold-mid');
await mark('photo-cold-mid');
await hold(4.5, 90, -14);
await mark('tags-cold-mid');
await hold(1.2);
await clickTag('計算トレイ');
await mark('card-tray');
await hold(4.0);
await page.click('#card .close');
await hold(0.5);
// 温かい通路は囲いの中で 3D では歩いて入れないので、ここからはアプリの「写真で見る」で地点を渡る
await open(`${base}?data=v2&mode=photo&station=net&tour=0&debug=1&yaw=150&pitch=0`);
await mark('photo-net');
await hold(1.0);
await walkTo('hot');
await mark('photo-hot');
await hold(1.0, 270, 2);
await page.click('#b-flows');
await mark('flows-heat');
await hold(5.0, 260, 2);
await mark('go-cdu');
await walkTo('cdu');
await mark('photo-cdu');
await hold(5.5, 2, 0);
await mark('end');

if (ff) { ff.stdin.end(); await new Promise((ok) => ff.on('close', ok)); }
fs.writeFileSync(shots ? path.join(shots, 'marks.json') : out.replace(/\.mp4$/, '.marks.json'), JSON.stringify({fps: FPS, marks}, null, 1));
console.log(`frames ${frames} (${(frames / FPS).toFixed(1)} s)  errors ${errs.length} ${errs.slice(0, 3).join(' | ')}`);
await browser.close(); server.close();
