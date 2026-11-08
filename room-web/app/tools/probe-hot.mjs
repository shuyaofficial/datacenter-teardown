// 3D の入口から温かい通路（扉の付いた囲いの中）の地点へ向かわせ、写真に切り替わるかを見る
// node room-web/app/tools/probe-hot.mjs v2
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import {createRequire} from 'node:module'; import {fileURLToPath} from 'node:url';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/package.json'));
const {chromium} = require('playwright');
const set = process.argv[2] || 'v2';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.webp': 'image/webp'};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); return res.end(); } res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'}); res.end(d); });
}).listen(0, '127.0.0.1');
await new Promise((ok) => server.once('listening', ok));
const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal']});
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
await page.goto(`http://127.0.0.1:${server.address().port}/room-web/app/index.html?data=${set}&mode=3d&tour=0&view=3d&debug=1`);
await page.waitForFunction('window.READY === true', null, {timeout: 120000});
const ok = await page.evaluate(() => window.APP.walk.walkTo('hot'));
await page.waitForTimeout(1500);
console.log(JSON.stringify({ok, live: await page.evaluate(() => window.LIVE), errs}));
await browser.close(); server.close();
