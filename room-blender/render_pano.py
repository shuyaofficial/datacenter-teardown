# 部屋の .blend を読み、1点から 360° のパノラマ（正距円筒）を Cycles で描く。スマホの「見回し」用。
# blender -b <room.blend> -P room-blender/render_pano.py -- <out.png> <x> <y> [--res 4096x2048] [--samples 64]
import bpy, math, os, sys
argv = sys.argv[sys.argv.index('--') + 1:]
out, x, y = os.path.abspath(argv[0]), float(argv[1]), float(argv[2])
def arg(n, d): return argv[argv.index(n) + 1] if n in argv else d
w, h = map(int, arg('--res', '4096x2048').split('x'))
sc = bpy.context.scene
cam = sc.camera
cam.data.type = 'PANO'
cam.data.panorama_type = 'EQUIRECTANGULAR'
cam.location = (x, y, 1.6)
cam.rotation_euler = (math.pi / 2, 0, -math.pi / 2)   # 画像の中央が +x（通路の奥）
sc.render.resolution_x, sc.render.resolution_y = w, h
sc.cycles.samples = int(arg('--samples', '64'))
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('WROTE', out)
