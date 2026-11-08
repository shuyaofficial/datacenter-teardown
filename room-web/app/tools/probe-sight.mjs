// 地点どうしの見通し（grid.clear）と、各地点が歩ける格子の上にあるかを表にする。印の札が出ない原因を探す用。
// node room-web/app/tools/probe-sight.mjs v2
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
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
await page.goto(`http://127.0.0.1:${server.address().port}/room-web/app/index.html?data=${set}&mode=3d&tour=0&view=3d&debug=1`);
await page.waitForFunction('window.READY === true && window.GRID', null, {timeout: 120000});
const out = await page.evaluate(() => {
  const {data} = window.APP, G = window.GRID;
  const rows = data.stations.map((s) => ({id: s.id, x: +s.v.x.toFixed(2), z: +s.v.z.toFixed(2), free: G.free(s.v.x, s.v.z)}));
  const pairs = [];
  for (const a of data.stations) for (const b of data.stations) if (a.id < b.id) pairs.push(`${a.id}-${b.id}: ${G.clear(a.v, b.v)}`);
  const {nx, nz, x0, z0, cell} = G.dims;
  const hits = [];
  window.APP.world.scene.traverse((o) => {
    if (!o.isMesh) return;
    const bb = new window.APP.THREE.Box3().setFromObject(o);
    for (const [x, y, z] of [[5.1, 1.0, 0.9], [3.0, 1.0, 0.75], [5.1, 1.0, 0.6]]) if (bb.containsPoint(new window.APP.THREE.Vector3(x, y, z))) hits.push(`${o.name}@${x},${z}: x${bb.min.x.toFixed(2)}..${bb.max.x.toFixed(2)} y${bb.min.y.toFixed(2)}..${bb.max.y.toFixed(2)} z${bb.min.z.toFixed(2)}..${bb.max.z.toFixed(2)}`);
  });
  return {hits, rows, pairs, nx, nz, x0, z0, cell, b: Array.from(G.blocked).join('')};
});
fs.writeFileSync(process.argv[3] || '/tmp/grid.json', JSON.stringify(out));
console.log(JSON.stringify({hits: out.hits, rows: out.rows}, null, 1));
await browser.close(); server.close();
