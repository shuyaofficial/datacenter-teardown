# 部屋の .blend から、透視の絵（比較・静止画）と 360° の絵（地点ごと）を Cycles で描く。
# blender -b <room.blend> -P room-blender/render_views.py -- --outdir <dir> [--views cmp_cold-in,still_overview] [--panos cold-in,hot]
#         [--samples 128] [--res 1600x900] [--pano-res 4096x2048] [--cams <cams.json>]
# 360° の向き: 画像の中央が地点の yaw（度。0 = +x、反時計回り）。stations.json の pano_rule と同じ。
import bpy, os, sys, json, math
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
def arg(n, d): return argv[argv.index(n) + 1] if n in argv else d
OUTDIR = os.path.abspath(arg('--outdir', '.')); os.makedirs(OUTDIR, exist_ok=True)
VIEWS = [v for v in arg('--views', '').split(',') if v]
PANOS = [v for v in arg('--panos', '').split(',') if v]
SAMPLES = int(arg('--samples', '128'))
RES = [int(v) for v in arg('--res', '1600x900').split('x')]
PRES = [int(v) for v in arg('--pano-res', '4096x2048').split('x')]
CAMS = arg('--cams', '')
sc = bpy.context.scene
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU 不可', e)
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True

def cam_json(ob):
    m = ob.matrix_world
    return {'pos': list(m.translation), 'look': list(m @ Vector((0, 0, -1))), 'up': list(m.to_3x3() @ Vector((0, 1, 0))),
            'fov_h': math.degrees(ob.data.angle_x), 'scale': 0.5}

if CAMS:
    allc = {o.name: cam_json(o) for o in bpy.data.objects if o.type == 'CAMERA' and o.name.startswith(('cmp_', 'still_'))}
    with open(CAMS, 'w') as f:
        json.dump(allc, f, indent=1)
    print('WROTE', CAMS)

for v in VIEWS:
    sc.camera = bpy.data.objects[v]
    sc.render.resolution_x, sc.render.resolution_y = RES
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = os.path.join(OUTDIR, v + '.png')
    bpy.ops.render.render(write_still=True)
    print('WROTE', sc.render.filepath)

if PANOS:
    st = {s['id']: s for s in json.loads(sc['stations'])}
    cd = bpy.data.cameras.new('pano'); cd.type = 'PANO'
    try:
        cd.panorama_type = 'EQUIRECTANGULAR'
    except Exception:
        cd.cycles.panorama_type = 'EQUIRECTANGULAR'
    cd.clip_start = 0.02
    co = bpy.data.objects.new('pano', cd); sc.collection.objects.link(co)
    for pid in PANOS:
        s = st[pid]
        co.location = s['pos']
        # (90°, 0, yaw - 90°) で画像の中央が yaw の方角を向く
        co.rotation_euler = (math.pi / 2, 0, math.radians(s['yaw']) - math.pi / 2)
        sc.camera = co
        sc.render.resolution_x, sc.render.resolution_y = PRES
        sc.render.image_settings.file_format = 'PNG'
        sc.render.filepath = os.path.join(OUTDIR, 'pano_' + pid + '.png')
        bpy.ops.render.render(write_still=True)
        print('WROTE', sc.render.filepath)
