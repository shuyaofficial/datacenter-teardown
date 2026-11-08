# 材質（ノードの式だけで作る。画像素材は使わない）。
# 板ごとの揺らぎは面の属性 'rnd'（rb_core.MB が箱ごとに入れる乱数）で、明るさと荒さを少しずらす。
# 色は実物に寄せて彩度を落とす。値は直線（scene linear）。
import bpy


class G:
    """ノードを短く書くための薄い包み。"""

    def __init__(self, m):
        self.nt = m.node_tree; self.N = self.nt.nodes; self.L = self.nt.links
        self.bsdf = self.N['Principled BSDF']
        self._tc = None

    def n(self, t, **kw):
        nd = self.N.new(t)
        for k, v in kw.items():
            if k.startswith('_'):
                setattr(nd, k[1:], v)
            else:
                nd.inputs[k].default_value = v
        return nd

    def link(self, a, b):
        self.L.new(a, b)

    def tc(self):
        if self._tc is None:
            self._tc = self.N.new('ShaderNodeTexCoord')
        return self._tc

    def math(self, op, a, b=None, clamp=False):
        m = self.N.new('ShaderNodeMath'); m.operation = op; m.use_clamp = clamp
        for i, x in enumerate((a, b)):
            if x is None:
                continue
            if isinstance(x, (int, float)):
                m.inputs[i].default_value = x
            else:
                self.link(x, m.inputs[i])
        return m.outputs[0]

    def mix(self, fac, a, b):
        m = self.N.new('ShaderNodeMix'); m.data_type = 'RGBA'
        for sock, x in ((m.inputs['Factor'], fac), (m.inputs['A'], a), (m.inputs['B'], b)):
            if isinstance(x, (int, float)):
                sock.default_value = x
            elif isinstance(x, tuple):
                sock.default_value = (*x[:3], 1)
            else:
                self.link(x, sock)
        return m.outputs['Result']

    def maprange(self, v, a, b, c=0.0, d=1.0, smooth=False):
        m = self.N.new('ShaderNodeMapRange')
        if smooth:
            m.interpolation_type = 'SMOOTHSTEP'
        m.inputs['From Min'].default_value = a; m.inputs['From Max'].default_value = b
        m.inputs['To Min'].default_value = c; m.inputs['To Max'].default_value = d
        self.link(v, m.inputs['Value'])
        return m.outputs['Result']

    def noise(self, scale, detail=4, rough=0.5, vec=None, coord='Object'):
        nz = self.n('ShaderNodeTexNoise', Scale=scale, Detail=detail, Roughness=rough)
        self.link(vec if vec is not None else self.tc().outputs[coord], nz.inputs['Vector'])
        return nz.outputs['Fac']

    def sep(self, coord='Object'):
        s = self.N.new('ShaderNodeSeparateXYZ'); self.link(self.tc().outputs[coord], s.inputs['Vector'])
        return s

    def comb(self, x, y, z=0.0):
        c = self.N.new('ShaderNodeCombineXYZ')
        for i, v in enumerate((x, y, z)):
            if isinstance(v, (int, float)):
                c.inputs[i].default_value = v
            else:
                self.link(v, c.inputs[i])
        return c.outputs[0]

    def bump(self, h, strength, dist=0.001, normal=None):
        b = self.n('ShaderNodeBump', Strength=strength, Distance=dist)
        self.link(h, b.inputs['Height'])
        if normal is not None:
            self.link(normal, b.inputs['Normal'])
        return b.outputs['Normal']

    def rnd(self):
        a = self.N.new('ShaderNodeAttribute'); a.attribute_name = 'rnd'; a.attribute_type = 'GEOMETRY'
        return a.outputs['Fac']


def mat(name, base, rough=0.5, metal=0.0, var=0.12, rvar=0.15, emit=None, estr=0.0, coat=0.0, coat_r=0.08,
        grain=0.0, grain_scale=600.0, mottle=0.0, mottle_scale=4.0, spec=0.5):
    """一般の材質。var: 板ごとの明るさの揺らぎ、grain: 細かい凹凸、mottle: 大きなむら。"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    g = G(m); b = g.bsdf
    b.inputs['Base Color'].default_value = (*base, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Specular IOR Level'].default_value = spec
    if coat:
        b.inputs['Coat Weight'].default_value = coat; b.inputs['Coat Roughness'].default_value = coat_r
    if emit:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = estr
    col = (*base, 1)
    if var or mottle:
        f = g.rnd()
        k = g.maprange(f, 0, 1, 1 - var, 1 + var)
        if mottle:
            mn = g.noise(mottle_scale, 6, 0.6)
            k = g.math('MULTIPLY', k, g.maprange(mn, 0.3, 0.7, 1 - mottle, 1 + mottle))
        cm = g.N.new('ShaderNodeVectorMath'); cm.operation = 'SCALE'
        cm.inputs[0].default_value = base; g.link(k, cm.inputs['Scale'])
        g.link(cm.outputs[0], b.inputs['Base Color'])
        r = g.maprange(f, 0, 1, rough * (1 - rvar), min(1.0, rough * (1 + rvar)))
        g.link(r, b.inputs['Roughness'])
    if grain:
        g.link(g.bump(g.noise(grain_scale, 2, 0.5), grain, 0.0003), b.inputs['Normal'])
    return m


def perforated(name, base, hole_scale, rough=0.4, metal=0.8, hole_r=0.32, plane='xz', var=0.08, hex_=True):
    """パンチングメタル: 平面（既定は正面の x-z）に丸穴の格子。穴の奥は暗い。"""
    m = mat(name, base, rough, metal, var=var)
    g = G(m); b = g.bsdf
    s = g.sep()
    a, c = {'xz': ('X', 'Z'), 'yz': ('Y', 'Z'), 'xy': ('X', 'Y')}[plane]
    u = g.math('MULTIPLY', s.outputs[a], hole_scale); v = g.math('MULTIPLY', s.outputs[c], hole_scale * (1.1547 if hex_ else 1))
    if hex_:
        # 1行おきに半ピッチずらす（千鳥）
        row = g.math('FLOOR', v)
        off = g.math('MULTIPLY', g.math('MODULO', row, 2.0), 0.5)
        u = g.math('ADD', u, off)
    fu = g.math('SUBTRACT', g.math('FRACT', u), 0.5); fv = g.math('SUBTRACT', g.math('FRACT', v), 0.5)
    if hex_:
        fv = g.math('MULTIPLY', fv, 0.866)
    d = g.math('SQRT', g.math('ADD', g.math('MULTIPLY', fu, fu), g.math('MULTIPLY', fv, fv)))
    solid = g.maprange(d, hole_r - 0.03, hole_r + 0.03, 0.0, 1.0)   # 0 = 穴, 1 = 地
    base_link = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else (*base, 1)
    col = g.mix(solid, (0.0015, 0.0015, 0.0016), base_link)
    g.link(col, b.inputs['Base Color'])
    g.link(g.maprange(solid, 0, 1, 0.9, rough), b.inputs['Roughness'])
    g.link(g.maprange(solid, 0, 1, 0.0, metal), b.inputs['Metallic'])
    g.link(g.bump(solid, 0.5, 0.0008), b.inputs['Normal'])
    return m


def striped(name, base, period, width, dark, plane_axis='X', rough=0.5, metal=0.0, var=0.1):
    """一定間隔の筋（パネルの継ぎ目・溝）。"""
    m = mat(name, base, rough, metal, var=var)
    g = G(m); b = g.bsdf
    s = g.sep()
    f = g.math('FRACT', g.math('DIVIDE', s.outputs[plane_axis], period))
    dist = g.math('MULTIPLY', g.math('ABSOLUTE', g.math('SUBTRACT', f, 0.5)), period)   # 継ぎ目からの距離
    line = g.maprange(dist, period / 2 - width, period / 2 - width * 0.4, 0.0, 1.0)     # 1 = 継ぎ目
    base_link = b.inputs['Base Color'].links[0].from_socket if b.inputs['Base Color'].links else (*base, 1)
    g.link(g.mix(line, base_link, dark), b.inputs['Base Color'])
    g.link(g.bump(g.math('SUBTRACT', 1.0, line), 0.3, 0.002), b.inputs['Normal'])
    return m


def concrete(name, aisles, base=(0.235, 0.232, 0.225)):
    """磨いたコンクリートの床。aisles: [(y 中心, 幅の半分)] の通路で、真ん中ほど擦れて艶が落ち、靴とキャスターの跡がつく。"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    g = G(m); b = g.bsdf
    s = g.sep()
    # こての跡（大きなむら）と骨材の点
    big = g.noise(0.35, 8, 0.62)
    mid = g.noise(2.2, 6, 0.55)
    col = g.mix(g.maprange(big, 0.3, 0.7, 0, 1), (base[0] * 0.82, base[1] * 0.82, base[2] * 0.8), (base[0] * 1.12, base[1] * 1.11, base[2] * 1.09))
    col = g.mix(g.maprange(mid, 0.35, 0.65, 0, 0.35), col, (base[0] * 0.9, base[1] * 0.9, base[2] * 0.88))
    vor = g.n('ShaderNodeTexVoronoi', Scale=180.0); g.link(g.tc().outputs['Object'], vor.inputs['Vector'])
    spk = g.maprange(vor.outputs['Distance'], 0.0, 0.12, 1.0, 0.0)
    col = g.mix(g.math('MULTIPLY', spk, 0.25), col, (base[0] * 0.6, base[1] * 0.6, base[2] * 0.58))
    # 通路の真ん中の擦れ
    wear = None
    for yc, hw in aisles:
        dy = g.math('ABSOLUTE', g.math('SUBTRACT', s.outputs['Y'], yc))
        w = g.maprange(dy, hw * 0.15, hw * 0.75, 1.0, 0.0, smooth=True)
        wear = w if wear is None else g.math('MAXIMUM', wear, w)
    wn = g.noise(1.4, 5, 0.6)
    wear = g.math('MULTIPLY', wear, g.maprange(wn, 0.3, 0.7, 0.4, 1.0))
    # キャスターと靴の跡: x 方向に引き伸ばした細い筋
    stretch = g.comb(g.math('MULTIPLY', s.outputs['X'], 0.25), g.math('MULTIPLY', s.outputs['Y'], 9.0), 0.0)
    sc = g.noise(3.0, 3, 0.5, vec=stretch)
    scuff = g.math('MULTIPLY', g.maprange(sc, 0.62, 0.72, 0.0, 1.0), wear)
    col = g.mix(g.math('MULTIPLY', scuff, 0.5), col, (0.05, 0.048, 0.045))
    col = g.mix(g.math('MULTIPLY', wear, 0.18), col, (base[0] * 0.78, base[1] * 0.77, base[2] * 0.75))
    # 目地（6 m 格子の切り込み）
    def joint(axis, period):
        f = g.math('FRACT', g.math('DIVIDE', s.outputs[axis], period))
        dd = g.math('MULTIPLY', g.math('ABSOLUTE', g.math('SUBTRACT', f, 0.5)), period)
        return g.maprange(dd, period / 2 - 0.004, period / 2 - 0.002, 0.0, 1.0)
    jt = g.math('MAXIMUM', joint('X', 6.0), joint('Y', 6.0))
    col = g.mix(g.math('MULTIPLY', jt, 0.85), col, (0.02, 0.02, 0.02))
    g.link(col, b.inputs['Base Color'])
    r = g.maprange(g.noise(5.0, 4, 0.5), 0.3, 0.7, 0.10, 0.22)
    r = g.math('ADD', r, g.math('MULTIPLY', wear, 0.22))
    g.link(r, b.inputs['Roughness'])
    g.link(g.bump(g.noise(260, 2, 0.5), 0.04, 0.0002), b.inputs['Normal'])
    b.inputs['Specular IOR Level'].default_value = 0.55
    return m


def smudged(name, base, rough, z0, z1, metal=0.1):
    """取っ手の高さ（z0..z1、物体の座標）だけ手の脂で少し暗く艶が出る板。"""
    m = mat(name, base, rough, metal, var=0.08)
    g = G(m); b = g.bsdf
    s = g.sep()
    band = g.math('MULTIPLY', g.maprange(s.outputs['Z'], z0 - 0.25, z0, 0, 1, smooth=True), g.maprange(s.outputs['Z'], z1, z1 + 0.25, 1, 0, smooth=True))
    blot = g.maprange(g.noise(9.0, 4, 0.6), 0.35, 0.7, 0.0, 1.0)
    k = g.math('MULTIPLY', band, blot)
    src = b.inputs['Base Color'].links[0].from_socket
    g.link(g.mix(g.math('MULTIPLY', k, 0.25), src, (base[0] * 0.55, base[1] * 0.55, base[2] * 0.55)), b.inputs['Base Color'])
    g.link(g.maprange(k, 0, 1, rough, rough * 0.55), b.inputs['Roughness'])
    return m


def glass(name):
    """薄い板ガラス: 屈折させず素通し（透過）＋表面の映り込み。屈折のノイズで向こう側がぼけるのを避ける。"""
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    for n in list(N):
        if n.type != 'OUTPUT_MATERIAL':
            N.remove(n)
    out = [n for n in N if n.type == 'OUTPUT_MATERIAL'][0]
    tr = N.new('ShaderNodeBsdfTransparent'); tr.inputs['Color'].default_value = (0.93, 0.96, 0.95, 1)
    gl = N.new('ShaderNodeBsdfGlossy'); gl.inputs['Roughness'].default_value = 0.03
    fr = N.new('ShaderNodeFresnel'); fr.inputs['IOR'].default_value = 1.5
    mx = N.new('ShaderNodeMixShader')
    L.new(fr.outputs['Fac'], mx.inputs['Fac']); L.new(tr.outputs[0], mx.inputs[1]); L.new(gl.outputs[0], mx.inputs[2])
    L.new(mx.outputs[0], out.inputs['Surface'])
    return m


def build_materials(aisles):
    M = {}
    def add(k, m):
        M[k] = m
    # ラック
    add('frame', mat('powder_black', (0.016, 0.016, 0.017), 0.48, var=0.18, grain=0.12, grain_scale=900))
    add('frame_in', mat('powder_black_in', (0.014, 0.014, 0.015), 0.55, var=0.1))
    add('perf_gold', perforated('tray_gold', (0.30, 0.255, 0.185), 210, rough=0.38, metal=0.85, hole_r=0.30))
    add('perf_sw', perforated('nvswitch_face', (0.20, 0.17, 0.125), 260, rough=0.36, metal=0.85, hole_r=0.33))
    add('psu', perforated('psu_grill', (0.04, 0.04, 0.042), 420, rough=0.5, metal=0.4, hole_r=0.36))
    add('perf_dark', perforated('switch_grill', (0.03, 0.03, 0.032), 330, rough=0.45, metal=0.5, hole_r=0.33))
    add('tray_plate', mat('tray_plate', (0.022, 0.022, 0.024), 0.42, 0.3, var=0.2))
    add('drive', striped('drive_carrier', (0.045, 0.045, 0.048), 0.0035, 0.0009, (0.004, 0.004, 0.004), 'Z', 0.45, 0.3))
    add('cage', mat('osfp_cage', (0.55, 0.55, 0.53), 0.3, 1.0, var=0.06))
    add('osfp', striped('osfp_module', (0.42, 0.42, 0.41), 0.003, 0.0008, (0.08, 0.08, 0.08), 'X', 0.35, 1.0))
    add('boot', mat('mpo_boot', (0.03, 0.03, 0.032), 0.55, var=0.15))
    add('boot_a', mat('mpo_boot_aqua', (0.04, 0.22, 0.24), 0.5, var=0.1))
    add('hole', mat('port_hole', (0.003, 0.003, 0.003), 0.85, var=0.0))
    add('handle', mat('handle_alu', (0.45, 0.46, 0.47), 0.32, 1.0, var=0.05))
    add('label', mat('label_white', (0.62, 0.62, 0.6), 0.75, var=0.08))
    add('led_g', mat('led_green', (0.02, 0.2, 0.05), 0.4, emit=(0.15, 1.0, 0.3), estr=2.5, var=0))
    add('led_b', mat('led_blue', (0.02, 0.05, 0.2), 0.4, emit=(0.2, 0.45, 1.0), estr=2.5, var=0))
    add('led_a', mat('led_amber', (0.2, 0.1, 0.01), 0.4, emit=(1.0, 0.45, 0.05), estr=4, var=0))
    add('screen', mat('touch_screen', (0.01, 0.012, 0.015), 0.08, emit=(0.18, 0.26, 0.33), estr=1.2, var=0, coat=1.0))
    add('fiber_y', mat('fiber_yellow', (0.50, 0.33, 0.02), 0.42, var=0.12, coat=0.2))
    add('fiber_a', mat('fiber_aqua', (0.07, 0.32, 0.34), 0.42, var=0.12, coat=0.2))
    add('hose', mat('hose_epdm', (0.012, 0.012, 0.012), 0.55, var=0.1))
    add('fit_red', mat('qd_red', (0.38, 0.025, 0.02), 0.35, 0.6, var=0.08))
    add('fit_blue', mat('qd_blue', (0.02, 0.07, 0.32), 0.35, 0.6, var=0.08))
    add('steel', mat('stainless', (0.55, 0.55, 0.56), 0.24, 1.0, var=0.05, mottle=0.06, mottle_scale=8))
    add('copper', mat('busbar_tin', (0.50, 0.46, 0.40), 0.3, 1.0, var=0.05, mottle=0.08, mottle_scale=6))
    add('cartridge', striped('nvlink_cartridge', (0.025, 0.025, 0.027), 0.006, 0.0018, (0.004, 0.004, 0.004), 'X', 0.5))
    add('black', mat('rubber_black', (0.01, 0.01, 0.01), 0.7, var=0.1))
    add('cord', mat('power_cord', (0.012, 0.012, 0.013), 0.5, var=0.08))
    add('patch', mat('patch_cord', (0.035, 0.06, 0.11), 0.5, var=0.15))
    add('sprinkler', mat('sprinkler_red', (0.22, 0.025, 0.018), 0.45, var=0.05))
    add('patch_plug', mat('patch_plug', (0.25, 0.26, 0.26), 0.25, var=0.1, coat=0.5))
    add('cord_o', mat('power_cord_orange', (0.36, 0.08, 0.01), 0.5, var=0.08))
    # 部屋
    add('conc', concrete('floor_concrete', aisles))
    add('line', mat('floor_line_yellow', (0.52, 0.34, 0.012), 0.35, var=0.1, mottle=0.25, mottle_scale=12, coat=0.4))
    add('wall', striped('wall_panel', (0.52, 0.53, 0.52), 1.0, 0.004, (0.25, 0.25, 0.25), 'X', 0.75, var=0.04))
    add('wall_y', striped('wall_panel_y', (0.52, 0.53, 0.52), 1.0, 0.004, (0.25, 0.25, 0.25), 'Y', 0.75, var=0.04))
    add('deck', striped('ceiling_deck', (0.07, 0.07, 0.072), 0.3, 0.06, (0.035, 0.035, 0.036), 'Y', 0.85, var=0.05))
    add('beam', mat('beam_paint', (0.09, 0.09, 0.092), 0.7, var=0.08))
    add('tray', mat('cable_tray_yellow', (0.50, 0.33, 0.012), 0.42, 0.25, var=0.12))
    add('bus', mat('busway_grey', (0.36, 0.365, 0.36), 0.45, 0.2, var=0.06))
    add('bus_dark', mat('busway_dark', (0.05, 0.05, 0.052), 0.5, 0.1, var=0.08))
    add('tape_blue', mat('band_blue', (0.02, 0.09, 0.36), 0.45, var=0.05))
    add('tape_red', mat('band_red', (0.4, 0.03, 0.02), 0.45, var=0.05))
    add('fws', mat('fws_pipe_paint', (0.06, 0.08, 0.075), 0.5, 0.0, var=0.05))
    add('insul', mat('pipe_insulation', (0.55, 0.55, 0.53), 0.6, var=0.1, mottle=0.1))
    add('lamp', mat('led_panel', (1, 1, 1), 0.5, emit=(1.0, 0.985, 0.96), estr=14, var=0))
    add('lamp_body', mat('led_housing', (0.5, 0.5, 0.5), 0.45, 0.6, var=0.05))
    add('contain', striped('containment_panel', (0.10, 0.105, 0.11), 0.2, 0.012, (0.05, 0.05, 0.052), 'X', 0.45, 0.3, var=0.15))
    add('contain_door', smudged('containment_door', (0.10, 0.105, 0.11), 0.45, 0.92, 1.15))
    add('cdu_door', smudged('cdu_door_paint', (0.055, 0.056, 0.058), 0.45, 0.8, 1.1))
    add('ups_floor', mat('eroom_floor_epoxy', (0.16, 0.19, 0.17), 0.3, var=0.0, mottle=0.12, mottle_scale=0.8, coat=0.3))
    add('contain_frame', mat('containment_frame', (0.04, 0.04, 0.042), 0.45, 0.3, var=0.08))
    add('glass', glass('glass_clear'))
    add('cdu', mat('cdu_body', (0.055, 0.056, 0.058), 0.45, 0.2, var=0.1, grain=0.08, grain_scale=900))
    add('cdu_in', mat('cdu_inner_galv', (0.35, 0.35, 0.34), 0.45, 0.8, var=0.1, mottle=0.12))
    add('phx_frame', mat('phx_frame_blue', (0.05, 0.09, 0.16), 0.45, 0.1, var=0.08))
    add('phx_plates', striped('phx_plates', (0.5, 0.5, 0.5), 0.0035, 0.0008, (0.12, 0.12, 0.12), 'X', 0.3, 1.0, var=0.05))
    add('pump', mat('pump_motor', (0.07, 0.12, 0.18), 0.4, 0.2, var=0.08))
    add('valve', mat('valve_handle', (0.45, 0.06, 0.03), 0.4, 0.1, var=0.05))
    add('gauge', mat('gauge_face', (0.75, 0.75, 0.72), 0.2, var=0.0, coat=1.0))
    add('tank', mat('expansion_tank', (0.22, 0.22, 0.21), 0.35, 0.2, var=0.05))
    add('ups', mat('ups_cabinet', (0.30, 0.31, 0.30), 0.45, 0.1, var=0.08))
    add('ups_dark', mat('ups_panel_dark', (0.03, 0.03, 0.032), 0.45, 0.2, var=0.08))
    # 電気室の盤: 同じ白でも板ごとに明るさと色味を変え、取っ手の高さに手の脂（smudged）
    add('ups_a', smudged('ups_cabinet_a', (0.25, 0.26, 0.25), 0.5, 0.85, 1.25))
    add('ups_b', smudged('ups_cabinet_b', (0.31, 0.31, 0.29), 0.46, 0.85, 1.25))
    add('ups_c', smudged('ups_cabinet_c', (0.22, 0.23, 0.235), 0.52, 0.85, 1.25))
    add('eroom_floor', concrete('eroom_floor', [(1.0, 1.4)], base=(0.15, 0.165, 0.155)))
    add('ground', mat('outdoor_concrete', (0.28, 0.27, 0.25), 0.85, var=0.0, mottle=0.25, mottle_scale=0.6, grain=0.2, grain_scale=80))
    add('galv', mat('galvanized', (0.45, 0.46, 0.46), 0.42, 0.9, var=0.1, mottle=0.15, mottle_scale=3))
    add('fan_grill', perforated('fan_grill', (0.03, 0.03, 0.03), 40, rough=0.5, metal=0.5, hole_r=0.42, plane='xy', hex_=False))
    add('sky_wall', mat('far_building', (0.4, 0.4, 0.39), 0.8, var=0.05))
    return M
