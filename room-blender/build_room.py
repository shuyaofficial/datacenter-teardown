# AI データホールの部屋（本番の大きさ）を作り、.blend と stations.json を書く。
# blender -b -P room-blender/build_room.py -- --blend teardown-out/room/v2/room.blend [--json teardown-out/room/v2/stations.json]
#        [--view cmp_cold-in --out x.png --samples 64 --res 960x540]   ← 試し描き（1枚）
# 座標: x は列に沿って、y は奥（+y が列A の背面＝温かい通路）、z は上。単位 m。数値の正本は room/refs.md。
# 形はすべてこのスクリプトとモジュール（rb_*.py）で作る。画像素材は使わない。同じ形のラックは同じメッシュを複製して置く。
import bpy, math, sys, os, json, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector
import rb_core, rb_mats, rb_parts as P, rb_room as R
from rb_core import place

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default
BLEND = arg('--blend', '')
JSON = arg('--json', '')
VIEW = arg('--view', '')
OUT = arg('--out', '')
SAMPLES = int(arg('--samples', '64'))
RES = [int(v) for v in arg('--res', '960x540').split('x')]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
random.seed(7)

M = rb_mats.build_materials([(R.CC, 0.6), (R.HC, 0.9), (-3.6, 0.8), (5.3, 0.8)])

# ---------------------------------------------------------------- 原型（同じ形は1つのメッシュ）
rng = random.Random(11)
nvl_me, nvl_ports = P.nvl72_body(M, rng)
nvl_cab = [P.nvl72_cables(M, nvl_ports, random.Random(s), 'nvl72_cab_' + n) for s, n in ((21, 'a'), (22, 'b'))]
net_me, net_ports = P.net_body(M, random.Random(31))
net_cab = [P.net_cables(M, net_ports, random.Random(s), 'net_cab_' + n) for s, n in ((41, 'a'), (42, 'b'))]
stor_me = P.storage_body(M, random.Random(51))
mgmt_me = P.mgmt_body(M, random.Random(61))
cdu_me, cdu_tops_local = P.cdu_body(M, random.Random(71))
door_closed = P.cdu_door(M, 'cdu_door_closed')
door_open = P.cdu_door(M, 'cdu_door_open', right=True)

BODY = {'nvl': nvl_me, 'net': net_me, 'stor': stor_me, 'mgmt': mgmt_me}
REP = {}   # 焼き込みで代表にする置き場所（メッシュ名 → 物体名）

def put_rack(row, i, kind):
    x = i * 0.6
    if row == 'A':
        loc, rotz, sc = (x, 0.0, 0.0), 0.0, (1, 1, 1)
    elif row == 'B':     # 温かい通路の中心で鏡に写す（背面同士が向き合う）
        loc, rotz, sc = (x, R.B_FRONT, 0.0), 0.0, (1, -1, 1)
    else:                # 列C: 列A を冷たい通路の中心で 180° 回したもの（並びも逆順になる）
        loc, rotz, sc = (R.L - x, R.C_FRONT, 0.0), math.pi, (1, 1, 1)
    name = '%s%02d_%s' % (row, i, kind)
    ob = place(name, BODY[kind], loc, rotz, sc)
    cab = None
    if kind == 'nvl':
        cab = nvl_cab[i % 2]
    elif kind == 'net':
        cab = net_cab[i % 2]
    if cab is not None:
        place(name + '_cab', cab, loc, rotz, sc)
    return ob

for row in ('A', 'B', 'C'):
    for i, kind in enumerate(R.ROW_A):
        put_rack(row, i, kind)
REP.update({'nvl72': 'A07_nvl', 'nvl72_cab_a': 'A06_nvl_cab', 'nvl72_cab_b': 'A07_nvl_cab', 'netrack': 'A02_net',
            'net_cab_a': 'A02_net_cab', 'net_cab_b': 'A03_net_cab', 'storrack': 'A00_stor', 'mgmtrack': 'A14_mgmt'})

# CDU 2 台（温かい通路の端、正面は -x）。CDU2 は扉を開ける
def cdu_world(loc_y, lx, ly, z):
    return (R.CDU_X + ly, loc_y - lx, z)
cdu_tops = []
# CDU1 は左右を鏡に写して置く（外に出る側板が CDU2 と同じ側になり、共有の焼き込みが合う）
place('CDU1', cdu_me, (R.CDU_X, R.CDU1_Y - 0.6, 0), -math.pi / 2, (-1, 1, 1))
cdu_tops.append({k: (R.CDU_X + v[1], R.CDU1_Y - 0.6 + v[0], P.CDU_H + 0.15) for k, v in cdu_tops_local.items()})
place('CDU2', cdu_me, (R.CDU_X, R.CDU2_Y, 0), -math.pi / 2)
cdu_tops.append({k: cdu_world(R.CDU2_Y, v[0], v[1], P.CDU_H + 0.15) for k, v in cdu_tops_local.items()})
place('CDU1_door', door_closed, (R.CDU_X - 0.001, R.CDU1_Y - 0.002, 0.05), -math.pi / 2)
place('CDU2_door', door_open, (R.CDU_X - 0.001, R.CDU2_Y - 0.6 + 0.002, 0.05), math.radians(-90 + 178))   # ほぼ真横まで開く
REP['cdu'] = 'CDU2'

# ---------------------------------------------------------------- 部屋
place('floor_reflect', R.build_floor(M))
place('shell', R.build_shell(M))
lamps = []
place('luminaires', R.build_lights(M, lamps))
cont_me, glass_boxes = R.build_containment(M)
place('containment', cont_me)
svc = R.build_services(M, random.Random(81), R.nvl_x())
place('services_A', svc)
place('services_B', svc, (0, R.B_FRONT, 0), 0, (1, -1, 1))
place('services_C', svc, (R.L, R.C_FRONT, 0), math.pi)
REP['services'] = 'services_A'
cdu_pipes_me, fws_flows = R.build_cdu_pipes(M, cdu_tops)
place('cdu_pipes', cdu_pipes_me)
place('eroom', R.build_eroom(M, random.Random(91)))

# ガラス（Cycles の絵だけ。焼き込みと glb には入れない）
gm = rb_core.MB('glass', M, maxsize=256)
for b in glass_boxes:
    gm.box('glass', *b)
gm.box('glass', R.WALL_X1 + 0.09, R.WALL_X1 + 0.11, -1.0, 3.0, 0.95, 2.25)
gm.box('glass', R.EROOM_X1 + 0.09, R.EROOM_X1 + 0.11, -0.4, 3.4, 0.9, 2.9)
g = place('glass', gm.finish())
g['no_bake'] = 1

# ---------------------------------------------------------------- 光
LIGHT_K = float(arg('--light', '0.45'))
for k, (x, y, z, ln, w, pw) in enumerate(lamps):
    ld = bpy.data.lights.new('lamp%03d' % k, 'AREA'); ld.shape = 'RECTANGLE'; ld.size = ln; ld.size_y = w
    ld.energy = pw * LIGHT_K; ld.color = (1.0, 0.975, 0.94)
    ld.cycles.max_bounces = 8
    lo = bpy.data.objects.new('lamp%03d' % k, ld); lo.location = (x, y, z); scene.collection.objects.link(lo)
# CDU2 の中の保守灯（扉を開けたときに点く）
ld = bpy.data.lights.new('cdu_lamp', 'AREA'); ld.shape = 'RECTANGLE'; ld.size = 0.4; ld.size_y = 0.05; ld.energy = 22
lo = bpy.data.objects.new('cdu_lamp', ld); lo.location = (R.CDU_X + 0.05, R.CDU2_Y - 0.3, 1.94); scene.collection.objects.link(lo)
lo.rotation_euler = (0, 0, math.pi / 2)
# 電気室の面光源
for yy in (-0.5, 3.0):
    for k in range(3):
        xx = R.WALL_X1 + 0.8 + k * 1.9 + 0.6
        ld = bpy.data.lights.new('elamp', 'AREA'); ld.shape = 'RECTANGLE'; ld.size = 1.2; ld.size_y = 0.08; ld.energy = 35
        ld.color = (1.0, 0.98, 0.95)
        lo = bpy.data.objects.new('elamp', ld); lo.location = (xx, yy, 3.88); scene.collection.objects.link(lo)
# 屋外: 太陽と空
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 4.0; sun.angle = math.radians(1.0); sun.color = (1.0, 0.96, 0.9)
so = bpy.data.objects.new('sun', sun); so.rotation_euler = (math.radians(50), 0, math.radians(150)); scene.collection.objects.link(so)
w = bpy.data.worlds.new('sky'); w.use_nodes = True
bg = w.node_tree.nodes['Background']
grad = w.node_tree.nodes.new('ShaderNodeTexGradient'); grad.gradient_type = 'LINEAR'
mp = w.node_tree.nodes.new('ShaderNodeMapping'); mp.inputs['Rotation'].default_value = (0, -math.pi / 2, 0)
tc = w.node_tree.nodes.new('ShaderNodeTexCoord')
ramp = w.node_tree.nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (0.85, 0.88, 0.9, 1); ramp.color_ramp.elements[1].color = (0.32, 0.48, 0.75, 1)
L_ = w.node_tree.links
L_.new(tc.outputs['Generated'], mp.inputs['Vector']); L_.new(mp.outputs['Vector'], grad.inputs['Vector'])
L_.new(grad.outputs['Fac'], ramp.inputs['Fac']); L_.new(ramp.outputs['Color'], bg.inputs['Color'])
bg.inputs['Strength'].default_value = 2.5
scene.world = w

# ---------------------------------------------------------------- 地点と視点
STATIONS = [
    {'id': 'cold-in', 'pos': [-0.9, R.CC, 1.6], 'yaw': 0, 'next': ['cold-mid'], 'title': '冷たい通路の入口',
     'text': '列A（右）と隣の組の列C（左）が、正面を向かい合わせて並ぶ。ラックは前から冷たい空気を吸う。'
             '天井には電気（バスウェイ）・光ファイバのトレイ・冷却液の配管が3段に重なる。'},
    {'id': 'cold-mid', 'pos': [5.1, -0.9, 1.6], 'yaw': 90, 'next': ['cold-in', 'net'], 'title': 'GPU ラック（NVL72）の前',
     'text': '1本に計算トレイ 18 台（GPU 72 個）と NVLink スイッチトレイ 9 台。'
             '前面のポートから黄色い光ファイバが左の溝を上がり、天井のトレイでネットワークラックへ向かう。'},
    {'id': 'net', 'pos': [7.8, -0.9, 1.6], 'yaw': 90, 'next': ['cold-mid', 'hot'], 'title': 'ネットワークラックの前',
     'text': 'ラックとラックをつなぐ計算網のスイッチ（4U・800G 級）が縦に並ぶ。1台に光ファイバが百本以上刺さる。'
             '最上段は管理用の 1U スイッチ。'},
    {'id': 'hot', 'pos': [4.8, R.HC + 0.2, 1.6], 'yaw': 270, 'next': ['net', 'cdu'], 'title': '温かい通路（囲いの中）',
     'text': 'ラックの背面。左右の縦の管が冷却液のマニホールドで、青い継手が行き（約40℃）、赤い継手が戻り（約54℃）。'
             '中央の金属の帯がバスバー（直流 約50 V）、黒い縦の箱が NVLink の銅ケーブルのカートリッジ。'},
    {'id': 'cdu', 'pos': [9.4, 1.75, 1.6], 'yaw': 0, 'next': ['hot', 'ceil'], 'title': 'CDU（扉を開けたところ）',
     'text': 'ラックから戻った温かい冷却液を、板状の熱交換器で施設の水へ渡す。下の段に冗長のポンプ 2 台。'
             '上の口から冷却液の配管が天井へ上がり、各ラックの背面へ降りる。'},
    {'id': 'ceil', 'pos': [11.6, 0.6, 1.6], 'yaw': 0, 'next': ['cdu', 'cold-in'], 'title': '列の端（天井と窓）',
     'text': '天井の3段がここから列へ伸びる。窓の向こうは電気室（UPS の盤）で、バスウェイは壁を抜けてそこから来る。'
             'さらに奥の屋外の冷却器へ、施設の水の配管が抜けていく。'},
]

def cam(name, pos, look, lens=18.0):
    cd = bpy.data.cameras.new(name); cd.lens = lens; cd.sensor_width = 36; cd.clip_start = 0.02; cd.clip_end = 300
    co = bpy.data.objects.new(name, cd); scene.collection.objects.link(co)
    co.location = pos
    co.rotation_euler = (Vector(look) - Vector(pos)).to_track_quat('-Z', 'Y').to_euler()
    return co

VIEWS = {
    # 比較用（地点ごと。上: Cycles、下: ブラウザ）
    'cmp_cold-in': ((-0.9, R.CC, 1.6), (9.0, R.CC + 0.15, 1.35), 18),
    'cmp_cold-mid': ((5.1, -0.9, 1.6), (4.7, 0.0, 1.3), 18),
    'cmp_net': ((7.8, -0.9, 1.6), (7.95, 0.0, 1.5), 18),
    'cmp_hot': ((4.8, R.HC + 0.2, 1.6), (4.45, 1.0, 1.45), 16),
    'cmp_cdu': ((9.4, 1.75, 1.6), (10.8, 1.8, 1.05), 16),
    'cmp_ceil': ((11.6, 0.6, 1.6), (6.0, 0.9, 3.4), 18),
    # 説明ページの静止画
    'still_overview': ((-0.6, R.CC - 0.05, 1.75), (9.0, R.CC + 0.15, 1.3), 22),
    'still_nvl72-front': ((4.45, -0.78, 1.42), (5.3, 0.0, 1.22), 30),
    'still_network': ((7.15, -0.85, 1.55), (8.0, 0.0, 1.7), 24),
    'still_hot-aisle': ((2.2, R.HC + 0.3, 1.65), (7.2, 1.15, 1.45), 20),
    'still_cdu-inside': ((9.1, 1.82, 1.1), (10.6, 1.8, 0.85), 17),
    'still_ceiling': ((8.8, R.CC, 1.4), (2.0, 0.2, 3.3), 18),
    'still_window': ((11.2, 0.95, 1.6), (20.0, 1.4, 1.55), 26),
    'still_row-above': ((-2.3, R.CC - 0.4, 3.35), (6.0, 0.3, 0.7), 20),
}
for name, (pos, look, lens) in VIEWS.items():
    cam(name, pos, look, lens)
scene.camera = bpy.data.objects['cmp_cold-in']
scene['stations'] = json.dumps([{'id': s['id'], 'pos': s['pos'], 'yaw': s['yaw']} for s in STATIONS])
scene['bake_rep'] = json.dumps(REP)

# ---------------------------------------------------------------- 描画の設定
def setup_render(sc, samples, res):
    sc.render.engine = 'CYCLES'
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'; prefs.get_devices()
        for d in prefs.devices: d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('GPU 不可', e)
    sc.cycles.samples = samples
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 8; sc.cycles.glossy_bounces = 4; sc.cycles.transmission_bounces = 8
    sc.cycles.sample_clamp_indirect = 8.0
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.exposure = -0.9
    try: sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception: pass
    sc.render.image_settings.file_format = 'PNG'
setup_render(scene, SAMPLES, RES)

# ---------------------------------------------------------------- stations.json（flows は部屋の実際の座標から）
def v3(p):
    return [round(float(c), 3) for c in p]

xn = R.nvl_x()[4]            # 流れを描く NVL72（列A の 5 本目、x = 4.8）
mid_tray = [p for p in nvl_ports['osfp']][4 * 6 + 1]
cdu2 = cdu_tops[1]
man_top = P.NH + 0.085
flows = [
    {'id': 'tcs-supply', 'kind': 'liquid-cold', 'label': 'IT 側の冷却液（行き 40.0 ℃）', 'path': [v3(p) for p in [
        cdu2['tcs_supply'], (cdu2['tcs_supply'][0], cdu2['tcs_supply'][1], 3.55), (cdu2['tcs_supply'][0], R.SUP_Y, 3.55), (cdu2['tcs_supply'][0], R.SUP_Y, R.PIPE_Z),
        (xn + R.MAN_IN, R.SUP_Y, R.PIPE_Z), (xn + R.MAN_IN, R.SUP_Y, 2.66), (xn + R.MAN_IN, (R.SUP_Y + P.ND - 0.05) / 2, P.NH + 0.2),
        (xn + R.MAN_IN, P.ND - 0.05, man_top), (xn + R.MAN_IN, P.ND - 0.05, 0.45)]]},
    {'id': 'tcs-return', 'kind': 'liquid-warm', 'label': 'IT 側の冷却液（戻り 53.9 ℃）', 'path': [v3(p) for p in [
        (xn + 0.6 - R.MAN_IN, P.ND - 0.05, 0.45), (xn + 0.6 - R.MAN_IN, P.ND - 0.05, man_top), (xn + 0.6 - R.MAN_IN, (R.RET_Y + P.ND - 0.05) / 2, P.NH + 0.2),
        (xn + 0.6 - R.MAN_IN, R.RET_Y, 2.66), (xn + 0.6 - R.MAN_IN, R.RET_Y, R.PIPE_Z), (R.CDU_X - 0.15, R.RET_Y, R.PIPE_Z),
        (R.CDU_X - 0.15, R.RET_Y, 3.40), (R.CDU_X - 0.15, cdu2['tcs_return'][1], 3.40), (R.CDU_X - 0.15, cdu2['tcs_return'][1], 2.45),
        (cdu2['tcs_return'][0], cdu2['tcs_return'][1], 2.45), cdu2['tcs_return']]]},
    {'id': 'fws-supply', 'kind': 'liquid-cold', 'label': '施設の水（CDU へ 37.2 ℃）', 'path': [v3(p) for p in fws_flows['fws_supply'] + [cdu2['fws_supply']]]},
    {'id': 'fws-return', 'kind': 'liquid-warm', 'label': '施設の水（屋外へ 47.2 ℃）', 'path': [v3(p) for p in [cdu2['fws_return']] + fws_flows['fws_return']]},
]
px, py, pz = mid_tray
xnet = 12 * 0.6
qp = [p for p in net_ports['osfp'] if p[0] < 0.25][40]
flows.append({'id': 'data', 'kind': 'data', 'label': 'GPU 計算網（光ファイバ）', 'path': [v3(p) for p in [
    (xn + px, py, pz), (xn + px, py - 0.05, pz - 0.03), (xn + 0.034, -0.03, pz - 0.02), (xn + 0.034, -0.03, P.NH),
    (xn + 0.08, 0.15, 2.6), (xn + 0.15, 0.4, 2.76), (xnet + 0.2, 0.4, 2.76), (xnet + 0.08, 0.15, 2.6), (xnet + 0.034, -0.04, P.OH),
    (xnet + 0.034, -0.04, qp[2] - 0.02), (xnet + qp[0], qp[1] - 0.04, qp[2] - 0.02), (xnet + qp[0], qp[1], qp[2])]]})
ups = (R.WALL_X1 + 1.6, -1.6, 2.06)
flows.append({'id': 'power', 'kind': 'power', 'label': '電気（UPS → バスウェイ → ラックのバスバー）', 'path': [v3(p) for p in [
    ups, (ups[0], ups[1], 3.8), (R.WALL_X1 + 1.33, 0.85, 3.8), (R.WALL_X1 + 1.33, 0.85, 2.485), (R.WALL_X1 - 0.3, 0.85, 2.485),
    (xn + 0.37, 0.85, 2.485), (xn + 0.37, 0.85, 2.29), (xn + 0.37, P.ND - 0.1, P.NH + 0.06), (xn + 0.3, P.ND - 0.1, P.NH - 0.3),
    (xn + 0.3, P.ND - 0.041, 1.6), (xn + 0.3, P.ND - 0.041, 0.6)]]})

sw_z = [z0 for k, z0, z1 in P.nvl72_slots() if k == 'sw']
TAGS = [
    {'id': 'nvl72', 'at': [xn + 0.3, -0.02, 2.05], 'stations': ['cold-in', 'cold-mid'], 'title': 'GPU ラック（NVL72）', 'line': '72 GPU・約120 kW',
     'card': '1本で GPU 72 個が1つの NVLink の網になる。8本で1組（約 1.2 MW）。重さは機器込みで約 1.4 t。', 'link': 'nvl72-live.html'},
    {'id': 'compute-tray', 'at': v3((xn + 0.35, -0.02, pz)), 'stations': ['cold-mid'], 'title': '計算トレイ', 'line': '1U・GPU 4・Grace 2',
     'card': '上に 10 台、下に 8 台。前面に計算網のポート（OSFP ×4）とストレージ・管理用のポート。GPU と CPU は水で冷やす。', 'link': 'nvl72-live.html'},
    {'id': 'nvswitch', 'at': v3((xn + 0.3, -0.02, sw_z[4])), 'stations': ['cold-mid'], 'title': 'NVLink スイッチトレイ', 'line': '9 台・ラックの中だけをつなぐ',
     'card': '72 個の GPU を全部つなぐ。ラックの中は光ではなく、背面の銅ケーブルでつなぐ。'},
    {'id': 'power-shelf', 'at': v3((xn + 0.3, -0.02, P.nvl72_slots()[7][1])), 'stations': ['cold-mid'], 'title': '電源棚', 'line': '8 台・交流 → 直流 約50 V',
     'card': '上下に 4 台ずつ。1 台 33 kW。天井のバスウェイから交流を受け、背面のバスバーで各トレイへ直流を配る。'},
    {'id': 'fiber', 'at': [xn + 0.034, -0.04, 1.4], 'stations': ['cold-mid', 'net'], 'title': '光ファイバ', 'line': '黄＝シングルモード・水色＝マルチモード',
     'card': 'トレイのポートから左の溝へ寄せて上がり、天井の黄色いトレイを通ってネットワークラックへ向かう。'},
    {'id': 'ib-switch', 'at': v3((xnet + 0.3, -0.03, P.net_slots()[0][2][2] - 0.1)), 'stations': ['net', 'cold-in'], 'title': '計算網のスイッチ', 'line': '4U・800G ×144（Quantum-X800 級）',
     'card': 'GPU どうしがラックをまたいで話す網。レールごとに分けたスイッチを、計算ラックの両側のネットワークラックに置く。'},
    {'id': 'oob-switch', 'at': v3((xnet + 0.3, -0.03, P.OH - 0.09)), 'stations': ['net'], 'title': '管理用スイッチ', 'line': '1U・1G ×48',
     'card': '機器の管理ポート（BMC など）だけをつなぐ別の網。利用者の通信とは物理的に分ける。', 'link': 'switch-live.html'},
    {'id': 'storage', 'at': [0.6, -0.02, 2.1], 'stations': ['cold-in'], 'title': 'ストレージラック', 'line': 'NVMe ドライブの並ぶ前面',
     'card': '学習の途中経過（チェックポイント）を書き込む先。計算網とは別のイーサネットでつなぐ。'},
    {'id': 'mgmt', 'at': [14 * 0.6 + 0.3, -0.02, 2.1], 'stations': ['cold-in'], 'title': '管理ラック', 'line': '1U サーバー（制御ノード）',
     'card': 'クラスタ全体を動かす制御ノードと網の管理装置。'},
    {'id': 'manifold', 'at': [xn + R.MAN_IN, P.ND - 0.05, 1.3], 'stations': ['hot'], 'title': '液冷のマニホールド', 'line': '行き 40.0 ℃・戻り 53.9 ℃',
     'card': '左が行き（青い継手）、右が戻り（赤い継手）。各トレイへホースで分ける。熱の 87% は水で、13% は空気で運ぶ。'},
    {'id': 'busbar', 'at': [xn + 0.3, P.ND - 0.04, 1.0], 'stations': ['hot'], 'title': 'バスバー', 'line': '直流 約50 V・1,400 A',
     'card': '電源棚が作った直流を、ラックの中央の金属の帯で各トレイへ配る。'},
    {'id': 'nvlink-cartridge', 'at': [xn + 0.17, P.ND - 0.03, 1.35], 'stations': ['hot'], 'title': 'NVLink の銅ケーブル', 'line': 'カートリッジ ×4・5,000 本超',
     'card': 'トレイを差し込むと背面でこの束にかみ合う。ラックの中の GPU どうしをつなぐ。'},
    {'id': 'containment', 'at': [R.L / 2, R.HC, R.CONT_Z], 'stations': ['hot', 'cold-in'], 'title': '温かい通路の囲い', 'line': '幅 1.83 m',
     'card': '空気で運ぶ残りの熱（約 13%）を部屋に漏らさず、天井のダクトから空調へ戻す。'},
    {'id': 'cdu', 'at': [R.CDU_X + 0.6, R.CDU2_Y - 0.3, P.CDU_H + 0.05], 'stations': ['cdu', 'ceil'], 'title': 'CDU', 'line': '600 kW 級・液対液',
     'card': 'ラック側の冷却液と施設の水を混ぜずに熱だけ渡す箱。1 台で NVL72 約 5 本分。'},
    {'id': 'phx', 'at': [R.CDU_X + 0.65, R.CDU2_Y - 0.28, 1.0], 'stations': ['cdu'], 'title': '板状の熱交換器', 'line': '温 53.9 ℃ → 40.0 ℃',
     'card': '薄い金属板が何十枚も重なり、板の両側を2つの水が交互に流れる。'},
    {'id': 'pumps', 'at': [R.CDU_X + 0.3, R.CDU2_Y - 0.25, 0.3], 'stations': ['cdu'], 'title': 'ポンプ ×2', 'line': '冗長（片方が止まっても回る）',
     'card': 'ラックへ冷却液を押し出す。CDU とポンプは UPS につなぎ、停電でも止めない。'},
    {'id': 'busway', 'at': [6.0, 0.85, 2.48], 'stations': ['ceil', 'cold-in'], 'title': 'バスウェイ', 'line': '2,000 A 級・差し込み口から各ラックへ',
     'card': 'ラック 1 本に 60 A の回路 8 本。通電したまま差し込み口を足せる。'},
    {'id': 'fiber-tray', 'at': [6.0, 0.4, 2.8], 'stations': ['ceil', 'cold-in'], 'title': 'ファイバのトレイ', 'line': '黄色いワイヤーメッシュ',
     'card': 'AI の部屋は普通のデータセンターの約 10 倍の光ファイバを使う。'},
    {'id': 'tcs-pipes', 'at': [6.0, R.SUP_Y, R.PIPE_Z + 0.1], 'stations': ['ceil', 'hot'], 'title': '冷却液の配管', 'line': '行き 40.0 ℃・戻り 53.9 ℃',
     'card': 'CDU から列の上を走り、各 NVL72 の背面へ降りる。ステンレス管、外径 約 0.18 m。'},
    {'id': 'ups', 'at': [R.WALL_X1 + 2.5, -1.6, 2.1], 'stations': ['ceil'], 'title': '電気室（UPS）', 'line': '部屋の外',
     'card': '停電の数分を電池でつなぐ。主配電盤と UPS は部屋の外に置き、バスウェイで送る。'},
    {'id': 'fluid-cooler', 'at': [R.EROOM_X1 + 17.0, 0.4, 3.0], 'stations': ['ceil'], 'title': '屋外の冷却器', 'line': '施設の水 47.2 ℃ → 37.2 ℃',
     'card': 'フルードクーラー。上のファンで外気に熱を捨てる。水温が高いので冷凍機は要らない。'},
]

def write_json(path):
    out = {'scale': 0.5, 'axes': 'blender z-up (x 列に沿って, y 奥, z 上)。three では (x, z, -y)',
           'pano_rule': '正距円筒 4096x2048。画像の中央が yaw の方角（度。0 = +x、90 = +y、上から見て反時計回り）。'
                        '画像の左半分はその方角から左（反時計回り）側。上端が真上。',
           'stations': [dict(s, pano='pano/%s.webp' % s['id']) for s in STATIONS], 'tags': TAGS, 'flows': flows}
    tone = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'tone.json')
    if os.path.exists(tone):      # 焼いた glb を Cycles と同じ見え方にする表示変換（measure_view.py → fit_tone.py）
        out['tone'] = json.load(open(tone))
    for s in out['stations']:
        s['pos'] = v3(s['pos'])
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print('WROTE', path)

if JSON:
    write_json(JSON)
if BLEND:
    os.makedirs(os.path.dirname(os.path.abspath(BLEND)), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(BLEND))
    print('SAVED', BLEND)
if VIEW and OUT:
    scene.camera = bpy.data.objects[VIEW]
    scene.render.filepath = os.path.abspath(OUT)
    bpy.ops.render.render(write_still=True)
    print('WROTE', OUT)
