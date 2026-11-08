// ブラウザの表示を Blender の正解画像と同じ大きさで撮る。
// node room-web/shoot.mjs <page.html?query> <out.png> [1280x720]
// その場で 127.0.0.1 の空きポートに静的サーバーを立て、システムの Chrome（Metal）で開く。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/package.json'));
const {chromium} = require('playwright');
const [page0, out, size = '1280x720'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.png': 'image/png', '.webp': 'image/webp'};
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'content-type': types[path.extname(p)] || 'application/octet-stream'}); res.end(d);
  });
}).listen(0, '127.0.0.1');
await new Promise((ok) => server.once('listening', ok));
const url = `http://127.0.0.1:${server.address().port}/room-web/${page0}${page0.includes('?') ? '&' : '?'}w=${w}&h=${h}`;
const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu']});
const page = await browser.newPage({viewport: {width: w, height: h}});
const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(url);
await page.waitForFunction('window.READY === true', null, {timeout: 120000});
await page.screenshot({path: out});
console.log('shot', out, 'errors', errs.length, errs.slice(0, 3).join(' | '));
await browser.close(); server.close();
