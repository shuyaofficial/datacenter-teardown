// 360° 写真と 3D の向きが合っているかを地点ごとに測る。
// node room-web/app/tools/check-align.mjs [stub|v2] [地点 id ...]
// 同じカメラで 3D と写真を描き、輪郭（明るさの勾配）の相関が最大になる回転のずれ δ を探す。
// δ ≈ 0 なら合っている。合っていなければ stations.json の yaw を yaw + δ にすると合う。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(path.join(process.env.HOME, '.claude/skills/teardown/package.json'));
const {chromium} = require('playwright');
const [set = 'stub', ...only] = process.argv.slice(2);
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
const base = `http://127.0.0.1:${server.address().port}/room-web/app/index.html`;
const browser = await chromium.launch({executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-angle=metal', '--enable-gpu']});
const page = await browser.newPage({viewport: {width: 960, height: 600}});
page.on('pageerror', (e) => console.error('pageerror', String(e)));
await page.goto(`${base}?data=${set}&mode=3d&tour=0&debug=1`);
await page.waitForFunction('window.READY === true', null, {timeout: 120000});
const ids = only.length ? only : await page.evaluate(() => window.APP.data.stations.map((s) => s.id));

for (const id of ids) {
  const r = await page.evaluate(async (sid) => {
    const {world, data, THREE} = window.APP;
    const s = data.byId.get(sid);
    const W = 240, H = 150;
    const rt = new THREE.WebGLRenderTarget(W, H);
    const cam = world.camera, ren = world.renderer;
    const keep = {pos: cam.position.clone(), aspect: cam.aspect, fov: cam.fov, yaw: world.view.yaw, pitch: world.view.pitch};
    await world.placePano(0, s);
    const sphere = world.panos[0];
    const baseRot = sphere.rotation.y;
    sphere.material.side = THREE.DoubleSide;   // 左右反転を試すと面の向きが裏返るため
    world.overlay.visible = false;
    cam.aspect = W / H; cam.fov = 70; cam.updateProjectionMatrix();
    const grab = () => {
      ren.setRenderTarget(rt); world.render(false); ren.setRenderTarget(null);
      const px = new Uint8Array(W * H * 4); ren.readRenderTargetPixels(rt, 0, 0, W, H, px);
      const lum = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) lum[i] = Math.sqrt(0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]);
      const g = new Float32Array(W * H);
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const i = y * W + x; g[i] = Math.hypot(lum[i + 1] - lum[i - 1], lum[i + W] - lum[i - W]);
      }
      return g;
    };
    const corr = (a, b) => {
      let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length;
      let ab = 0, aa = 0, bb = 0;
      for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; ab += x * y; aa += x * x; bb += y * y; }
      return ab / Math.sqrt(aa * bb + 1e-9);
    };
    // 4 方向（地点の yaw から 0, 90, 180, 270 度）・水平と少し下向きで比べる
    const views = [];
    for (const dy of [0, 90, 180, 270]) for (const p of [0, -20]) views.push([s.yaw + dy, p]);
    cam.position.copy(s.v);
    world.setPanoOpacity(0, 0);
    const ref = views.map(([y, p]) => { world.view.yaw = y; world.view.pitch = p; return grab(); });
    world.setPanoOpacity(0, 1);
    const score = (deg, mirror) => {
      sphere.scale.x = mirror ? -1 : 1;
      sphere.rotation.y = baseRot + THREE.MathUtils.degToRad(deg);
      return views.reduce((acc, [y, p], k) => { world.view.yaw = y; world.view.pitch = p; return acc + corr(ref[k], grab()); }, 0) / views.length;
    };
    const best = {d: 0, c: -2, mirror: false};
    for (const mirror of [false, true]) {
      for (let d = -180; d < 180; d += 4) { const c = score(d, mirror); if (c > best.c) Object.assign(best, {d, c, mirror}); }
    }
    for (const step of [1, 0.25]) {
      const c0 = best.d;
      for (let d = c0 - step * 4; d <= c0 + step * 4; d += step) { const c = score(d, best.mirror); if (c > best.c) Object.assign(best, {d, c}); }
    }
    const atZero = score(0, false);
    sphere.scale.x = 1; sphere.rotation.y = baseRot; sphere.material.side = THREE.FrontSide;
    world.setPanoOpacity(0, 0); world.overlay.visible = true;
    cam.aspect = keep.aspect; cam.fov = keep.fov; cam.updateProjectionMatrix(); cam.position.copy(keep.pos);
    world.view.yaw = keep.yaw; world.view.pitch = keep.pitch;
    rt.dispose();
    return {yaw: s.yaw, delta: ((best.d + 540) % 360) - 180, corr: best.c, mirror: best.mirror, corrAtZero: atZero};
  }, id);
  const ok = !r.mirror && Math.abs(r.delta) <= 1;
  const weak = r.corr < 0.3 ? '（相関が低い: 写真を撮った位置と pos が違うか、部屋が違う）' : '';
  console.log(`${ok && !weak ? 'ok  ' : 'NG  '}${id}: yaw ${r.yaw} → ずれ δ=${r.delta.toFixed(2)}° 相関 ${r.corr.toFixed(3)}（δ=0 で ${r.corrAtZero.toFixed(3)}）${r.mirror ? ' 左右反転' : ''}${weak}`);
}
await browser.close();
server.close();
