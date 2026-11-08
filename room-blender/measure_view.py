# Blender の表示変換（AgX + Medium High Contrast、露出 -0.9）を実測して、ブラウザ用の曲線を当てはめる材料を作る。
# blender -b -P room-blender/measure_view.py -- <out.json>
# 直線の値（灰色と、実物の色を何段かの明るさで）を画像にして、表示変換をかけて保存し、読み戻す。
import bpy, sys, json, os, numpy as np
out = sys.argv[sys.argv.index('--') + 1]
sc = bpy.context.scene
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look = 'AgX - Medium High Contrast'
sc.view_settings.exposure = -0.9
sc.display_settings.display_device = 'sRGB'
cols = [(1, 1, 1), (0.50, 0.33, 0.02), (0.07, 0.32, 0.34), (0.30, 0.255, 0.185), (0.4, 0.03, 0.02), (0.02, 0.09, 0.36), (0.2, 0.45, 1.0), (0.15, 1.0, 0.3)]
evs = np.linspace(-14, 8, 512)
W, H = len(evs), len(cols)
px = np.zeros((H, W, 4), np.float32)
for j, c in enumerate(cols):
    for i, e in enumerate(evs):
        px[j, i, :3] = np.array(c) * (2.0 ** e); px[j, i, 3] = 1
img = bpy.data.images.new('ramp', W, H, float_buffer=True)
img.pixels.foreach_set(px.ravel())
p = os.path.abspath(out + '.png')
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_depth = '16'
img.save_render(p, scene=sc)
r = bpy.data.images.load(p); a = np.empty(W * H * 4, np.float32); r.pixels.foreach_get(a)
a = a.reshape(H, W, 4)
json.dump({'evs': evs.tolist(), 'cols': cols, 'display': a[:, :, :3].tolist()}, open(out, 'w'))
print('WROTE', out)
