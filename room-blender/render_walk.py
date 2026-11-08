# 読み物ページの冒頭「スクロールで通路を歩く映像」の連番を Cycles で描く（縦長）。
# blender -b <room.blend> -P room-blender/render_walk.py -- --outdir <dir> [--frames 150] [--samples 24]
#         [--res 720x1280] [--only 0,75,149] [--lens 15]
# 道筋: 冷たい通路の入口 → 中ほど → ネットワークラックの前 → 列の端を回って温かい通路の扉の前。目の高さ 1.6 m。
# 座標は build_room.py と同じ（x は列に沿って、y は奥、z は上。単位 m）。描画の設定は .blend の値（AgX など）をそのまま使う。
import bpy, os, sys, math, time
from mathutils import Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:]
def arg(n, d): return argv[argv.index(n) + 1] if n in argv else d
OUTDIR = os.path.abspath(arg('--outdir', '.')); os.makedirs(OUTDIR, exist_ok=True)
FRAMES = int(arg('--frames', '150'))
SAMPLES = int(arg('--samples', '24'))
RES = [int(v) for v in arg('--res', '720x1280').split('x')]
ONLY = [int(v) for v in arg('--only', '').split(',') if v]
LENS = float(arg('--lens', '15'))
EYE = 1.6

# 要の地点: (位置 x, y, 向き yaw 度（0 = +x、反時計回り）, 見下ろし pitch 度, ここで一度止まるか, 区間のコマの重み)
KEYS = [
    (-0.9, -0.60, 2.0, -4.0, True, 0.0),     # 冷たい通路の入口。列の奥を見る
    (4.2, -0.62, 6.0, -5.0, False, 1.25),    # 中ほど（NVL72 の列の前）
    (7.7, -1.0, 74.0, 0.0, True, 1.0),     # ネットワークラックの前で右を向く
    (9.65, -0.35, 125.0, -3.0, False, 0.7),  # 列の端を回る
    (9.95, 2.12, 180.0, -3.0, True, 0.75),   # 温かい通路の扉の前（扉は x = 9.0）
]

def catmull(p0, p1, p2, p3, t):
    t2, t3 = t * t, t * t * t
    return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)

def ease(x, stop_a, stop_b):
    # 止まる地点の側だけ速度を 0 にする
    if stop_a and stop_b: return x * x * (3 - 2 * x)
    if stop_a: return x * x
    if stop_b: return 1 - (1 - x) ** 2
    return x

def pose(f):
    """コマ番号 → (位置, yaw, pitch)。区間ごとに重みでコマを割り振る"""
    w = [k[5] for k in KEYS[1:]]
    u = f / (FRAMES - 1) * sum(w)
    i = 0
    while i < len(w) - 1 and u > w[i]:
        u -= w[i]; i += 1
    x = ease(min(1.0, u / w[i]), KEYS[i][4], KEYS[i + 1][4])
    idx = [max(0, i - 1), i, i + 1, min(len(KEYS) - 1, i + 2)]
    vals = []
    for c in range(4):
        vals.append(catmull(*[KEYS[j][c] for j in idx], x))
    return Vector((vals[0], vals[1], EYE)), vals[2], vals[3]

sc = bpy.context.scene
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU 不可', e)
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
sc.cycles.use_adaptive_sampling = True
sc.render.use_persistent_data = True
sc.render.resolution_x, sc.render.resolution_y = RES
sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'PNG'

cd = bpy.data.cameras.new('walk'); cd.lens = LENS; cd.sensor_width = 36; cd.sensor_fit = 'AUTO'
cd.clip_start = 0.02; cd.clip_end = 300
co = bpy.data.objects.new('walk', cd); sc.collection.objects.link(co)
sc.camera = co

t0 = time.time()
frames = ONLY or list(range(FRAMES))
for n, f in enumerate(frames):
    pos, yaw, pitch = pose(f)
    co.location = pos
    # カメラは -Z を向く。(90° + pitch, 0, yaw - 90°) で水平に yaw の方角、pitch だけ上下
    co.rotation_euler = Euler((math.radians(90 + pitch), 0, math.radians(yaw - 90)), 'XYZ')
    sc.render.filepath = os.path.join(OUTDIR, 'f%03d.png' % f)
    bpy.ops.render.render(write_still=True)
    el = time.time() - t0
    print('WROTE %s  %d/%d  %.1fs  pos=(%.2f,%.2f) yaw=%.0f' % (sc.render.filepath, n + 1, len(frames), el, pos.x, pos.y, yaw), flush=True)
print('DONE %.1fs' % (time.time() - t0))
