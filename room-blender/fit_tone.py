# measure_view.py の実測から、ブラウザ用のトーン曲線（AgX 風: 内側の行列 → log2 の曲線 → 外側の行列）を当てはめ、tone.json を書く。
# python3 room-blender/fit_tone.py <viewcurve.json> <out tone.json>   （viewcurve.json.png も同じ場所に要る。scipy・PIL を使う）
import json, sys, numpy as np
from PIL import Image
from scipy.optimize import least_squares
src, dst = sys.argv[1], sys.argv[2]
J = json.load(open(src)); evs = np.array(J['evs']); cols = np.array(J['cols'])
im = np.asarray(Image.open(src + '.png').convert('RGB')).astype(float)[::-1] / 255   # Blender は下の行から保存する
gray = im[0, :, 0]
G = lambda e: np.interp(e, evs, gray, left=0, right=1)
C = np.concatenate([cols[j][None, :] * (2.0 ** evs)[:, None] for j in range(len(cols))])
D = np.concatenate([im[j] for j in range(len(cols))])
dec = lambda d: np.where(d <= 0.04045, d / 12.92, ((d + 0.055) / 1.055) ** 2.4)
enc = lambda l: np.where(l <= 0.0031308, l * 12.92, 1.055 * np.power(np.clip(l, 0, None), 1 / 2.4) - 0.055)
def unpack(p):
    A = p[:9].reshape(3, 3); B = p[9:].reshape(3, 3)
    return A / A.sum(axis=1, keepdims=True), B / B.sum(axis=1, keepdims=True)
def model(p):
    A, B = unpack(p)
    g = G(np.log2(np.clip(C @ A.T, 1e-10, None)))
    return np.clip(enc(np.clip(dec(g) @ B.T, 0, None)), 0, 1)
w = ((D.max(axis=1) > 0.02) & (D.min(axis=1) < 0.99)).astype(float)
r = least_squares(lambda p: ((model(p) - D) * w[:, None]).ravel(), np.concatenate([np.eye(3).ravel()] * 2))
A, B = unpack(r.x)
err = np.abs(model(r.x) - D)[w > 0]
e0, e1 = -9.0, 6.0
sel = (evs >= e0) & (evs <= e1); t = (evs[sel] - e0) / (e1 - e0)
c = np.polyfit(t, gray[sel], 9)
m3 = lambda M: 'mat3(' + ', '.join('%.6f' % M[rr][cc] for cc in range(3) for rr in range(3)) + ')'
h = '%.7f' % c[0]
for k in c[1:]:
    h = '(%s) * t + %.7f' % (h, k)
glsl = f"""vec3 CustomToneMapping( vec3 color ) {{
  const mat3 A = {m3(A)};
  const mat3 B = {m3(B)};
  vec3 x = max( A * max( color, vec3( 0.0 ) ), vec3( 1e-10 ) );
  vec3 tt = clamp( ( log2( x ) - vec3( {e0:.1f} ) ) / {e1 - e0:.1f}, 0.0, 1.0 );
  vec3 d;
  for ( int i = 0; i < 3; i ++ ) {{ float t = tt[ i ]; d[ i ] = {h}; }}
  d = clamp( d, 0.0, 1.0 );
  vec3 l = mix( d / 12.92, pow( ( d + 0.055 ) / 1.055, vec3( 2.4 ) ), step( vec3( 0.04045 ), d ) );
  return max( B * l, vec3( 0.0 ) );
}}"""
json.dump({'note': 'Blender 5.2 の AgX + "AgX - Medium High Contrast"、露出 -0.9 を実測した近似（平均誤差 %.4f、95%% 点 %.3f）。'
                   'three.js: renderer.toneMapping = THREE.CustomToneMapping、toneMappingExposure = 1、'
                   'ShaderChunk.tonemapping_pars_fragment の CustomToneMapping 関数をこの glsl に差し替える。入力は焼いた画像の値 × (1/scale)。'
                   % (err.mean(), np.percentile(err, 95)),
           'A_rows': A.round(6).tolist(), 'B_rows': B.round(6).tolist(),
           'curve': {'e0': e0, 'e1': e1, 'poly_high_first': [float('%.7f' % k) for k in c]}, 'glsl': glsl},
          open(dst, 'w'), ensure_ascii=False, indent=1)
print('WROTE', dst, 'mean err', round(err.mean(), 4))
