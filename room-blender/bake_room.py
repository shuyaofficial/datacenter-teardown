# 部屋の .blend を読み、メッシュ（原型）ごとに Cycles の照明（Combined）を1枚の画像に焼き、glb に出す。
# blender -b <room.blend> -P room-blender/bake_room.py -- <out.glb> [--samples 128] [--only nvl72,floor_reflect] [--imgdir <dir>] [--quality 88]
# - UV は build_room.py の時点で作ってある（rb_core.MB）。画像の大きさは mesh['atlas']。
# - 同じメッシュを複製したラックは、代表の1本（scene['bake_rep']）で焼き、全員が同じ画像を使う。
# - 床（floor_reflect）は映り込み（glossy）を除いて焼く。映り込みはブラウザ側で足す。
# - ガラス（no_bake）・光・カメラは glb に入れない。
# ブラウザ側は照明の計算をせず、焼いた画像をそのまま貼る（MeshBasicMaterial）。値は 1/SCALE 倍で保存する。
import bpy, os, sys, json, time
import numpy as np

argv = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(argv[0])
def arg(n, d): return argv[argv.index(n) + 1] if n in argv else d
SAMPLES = int(arg('--samples', '128'))
ONLY = [v for v in arg('--only', '').split(',') if v]
IMGDIR = os.path.abspath(arg('--imgdir', os.path.join(os.path.dirname(OUT), 'bake-img')))
QUALITY = int(arg('--quality', '88'))
SCALE = 0.5
NO_GLOSSY = {'floor_reflect'}
os.makedirs(IMGDIR, exist_ok=True)

sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES
try:
    pr = bpy.context.preferences.addons['cycles'].preferences; pr.compute_device_type = 'METAL'; pr.get_devices()
    for d in pr.devices: d.use = True
    sc.cycles.device = 'GPU'
except Exception as e:
    print('GPU 不可', e)
sc.render.bake.margin = 6
sc.render.bake.margin_type = 'EXTEND'
rep = json.loads(sc.get('bake_rep', '{}'))

# 焼く対象: メッシュごとに代表の物体
targets = {}
for ob in bpy.data.objects:
    if ob.type != 'MESH' or ob.get('no_bake'):
        continue
    me = ob.data
    if me.name not in targets:
        targets[me.name] = ob
for mname, oname in rep.items():
    if mname in targets and oname in bpy.data.objects:
        targets[mname] = bpy.data.objects[oname]

def lin_to_srgb8(px):
    lin = np.clip(px * SCALE, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)

img_nodes = {}
def bake_one(mname, ob):
    me = ob.data
    S = int(me.get('atlas', 1024))
    path = os.path.join(IMGDIR, mname + '.png')
    if ONLY and mname not in ONLY:
        if os.path.exists(path):
            return path
        print('SKIP（画像なし）', mname)
        return None
    img = bpy.data.images.new('bake_' + mname, S, S, float_buffer=True)
    for m in me.materials:
        nt = m.node_tree
        tn = img_nodes.get(m.name)
        if tn is None:
            tn = nt.nodes.new('ShaderNodeTexImage'); img_nodes[m.name] = tn
        tn.image = img
        nt.nodes.active = tn
    me.uv_layers.active = me.uv_layers['bake']
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    b = sc.render.bake
    b.use_pass_direct = b.use_pass_indirect = True
    b.use_pass_diffuse = b.use_pass_emit = b.use_pass_transmission = True
    b.use_pass_glossy = mname not in NO_GLOSSY
    t0 = time.time()
    bpy.ops.object.bake(type='COMBINED')
    px = np.empty(S * S * 4, dtype=np.float32); img.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    px[:, :3] = lin_to_srgb8(px[:, :3]); px[:, 3] = 1
    out = bpy.data.images.new('png_' + mname, S, S)
    out.pixels.foreach_set(px.ravel())
    out.filepath_raw = path; out.file_format = 'PNG'; out.save()
    bpy.data.images.remove(out); bpy.data.images.remove(img)
    print('BAKED %s %d px %.0f s' % (mname, S, time.time() - t0), flush=True)
    return path

T0 = time.time()
paths = {}
for mname, ob in sorted(targets.items(), key=lambda kv: -int(kv[1].data.get('atlas', 0))):
    paths[mname] = bake_one(mname, ob)
print('BAKE TOTAL %.0f s' % (time.time() - T0))

# glTF 用: 材質を「焼いた画像1枚」に置き換え、焼かない物を消す
for ob in list(bpy.data.objects):
    if ob.type in ('LIGHT', 'CAMERA') or ob.get('no_bake'):
        bpy.data.objects.remove(ob)
for mname, p in paths.items():
    me = bpy.data.meshes[mname]
    m = bpy.data.materials.new('baked_' + mname); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    t = nt.nodes.new('ShaderNodeTexImage')
    if p:
        t.image = bpy.data.images.load(p)
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    me.materials.clear(); me.materials.append(m)
    me.polygons.foreach_set('material_index', np.zeros(len(me.polygons), dtype=np.int32))
    for u in [u for u in me.uv_layers if u.name != 'bake']:
        me.uv_layers.remove(u)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_draco_mesh_compression_enable=True,
                          export_draco_mesh_compression_level=7, export_draco_position_quantization=16,
                          export_draco_texcoord_quantization=16, export_normals=False, export_cameras=False,
                          export_lights=False, export_image_format='WEBP', export_image_quality=QUALITY,
                          export_apply=False)
print('GLB', OUT, os.path.getsize(OUT))
