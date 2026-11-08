# 機器の形（ラック1本ずつを「原型メッシュ」として作り、部屋では同じメッシュを複製して並べる）。
# ローカル座標: x はラックの幅 0..W（正面から見て左が 0）、y は正面 0 から奥 D、z は上。正面は -y を向く。
# 寸法: NVL72 600 x 1068 x 2236（NVIDIA / Vertiv MGX）、ネットワーク・ストレージ・管理 600 x 1200 x 2200（推）、
# CDU 600 x 1200 x 2000（Vertiv CoolChip 600kW）、1U = 44.45 mm。
import math, random
from mathutils import Vector
from rb_core import MB, bezier_pts

U = 0.04445
NW, ND, NH = 0.6, 1.068, 2.236          # NVL72
OW, OD, OH = 0.6, 1.2, 2.2              # その他のラック
RX0, RX1 = 0.059, 0.541                 # 19 インチの取り付け幅
CDU_W, CDU_D, CDU_H = 0.6, 1.2, 2.0
TRAY_Y = 0.40                           # 天井のファイバのトレイの中心（ラックの正面から奥へ）
TRAY_Z = 2.70


def shell(mb, W, D, H, rear_open=True):
    """枠: 側板・天板・台座・柱。正面と背面は開いている。"""
    mb.box('frame', 0, 0.012, 0, D, 0.10, H, skip='')
    mb.box('frame', W - 0.012, W, 0, D, 0.10, H)
    # 側板の継ぎ目（上下 2 枚）と小さな銘板。列の端で見える
    for xo, s in ((0.0, -1), (W, 1)):
        x0, x1 = (xo - 0.0008, xo) if s < 0 else (xo, xo + 0.0008)
        mb.box('frame_in', x0, x1, 0.02, D - 0.02, H * 0.52, H * 0.52 + 0.003, d=0.5, skip='xX'[s > 0] if False else '')
        mb.box('label', x0, x1, 0.06, 0.16, H - 0.25, H - 0.19, d=0.6)
        mb.box('frame_in', x0, x1, 0.02, 0.026, 0.12, H - 0.03, d=0.4)
        mb.box('frame_in', x0, x1, D - 0.026, D - 0.02, 0.12, H - 0.03, d=0.4)
    # 天板（ケーブルの出口を左前・右前・後ろに開ける）
    mb.box('frame', 0.012, W - 0.012, 0.20, D - 0.16, H - 0.025, H, skip='z')
    mb.box('frame', 0.10, W - 0.10, 0, 0.20, H - 0.025, H, skip='z')
    mb.box('frame', 0.012, W - 0.012, D - 0.04, D, H - 0.025, H, skip='z')
    mb.box('frame', 0.012, W - 0.012, 0.0, 0.03, H - 0.06, H - 0.025, skip='Y')
    mb.box('frame', 0.012, W - 0.012, D - 0.03, D, H - 0.06, H - 0.025, skip='y')
    # 台座と耐震ブレース
    mb.box('frame', 0.0, W, 0.02, D - 0.02, 0.0, 0.10, skip='z')
    mb.box('frame', 0.02, W - 0.02, -0.004, 0.02, 0.0, 0.10, skip='Y')
    mb.box('frame', 0.02, W - 0.02, D - 0.02, D + 0.004, 0.0, 0.10, skip='y')
    for x in (0.03, W - 0.09):
        for y in (0.03, D - 0.09):
            mb.box('black', x, x + 0.06, y, y + 0.06, -0.0, 0.012, skip='z')
    # 柱（前後）
    for y0, y1 in ((0.0, 0.03), (D - 0.03, D)):
        mb.box('frame', RX0 - 0.022, RX0, y0, y1, 0.10, H - 0.025)
        mb.box('frame', RX1, RX1 + 0.022, y0, y1, 0.10, H - 0.025)
    # 中の暗い詰め物（すき間から光が抜けないように）
    mb.box('frame_in', RX0, RX1, 0.05, D - 0.14, 0.11, H - 0.07, d=0.08)


def blank(mb, z0, z1, y=0.0, mat='tray_plate'):
    mb.box(mat, RX0, RX1, y, y + 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')


def leds(mb, x, y, z, kinds):
    for i, k in enumerate(kinds):
        mb.box(k, x + i * 0.007, x + i * 0.007 + 0.0035, y - 0.0015, y, z, z + 0.0028, skip='Y')


def osfp_port(mb, px, z0, z1, w=0.0215, y=0.0, boot='boot', depth=0.018):
    """OSFP: 金属のケージ・差したモジュール・MPO のブーツ。ブーツの先 (x, y, z) を返す。"""
    mb.box('cage', px - 0.0015, px + w + 0.0015, y - 0.002, y + 0.006, z0 - 0.0015, z1 + 0.0015, skip='Y')
    mb.box('osfp', px, px + w, y - depth, y - 0.002, z0, z1, skip='Y')
    mb.box(boot, px + w * 0.22, px + w * 0.78, y - depth - 0.026, y - depth, z0 + (z1 - z0) * 0.2, z1 - (z1 - z0) * 0.2, skip='Y')
    return (px + w / 2, y - depth - 0.026, (z0 + z1) / 2)


def rj45(mb, px, z0, y=0.0, plugged=True):
    mb.box('cage', px, px + 0.0125, y - 0.001, y + 0.004, z0, z0 + 0.0115, skip='Y')
    mb.box('hole', px + 0.0012, px + 0.0113, y - 0.0012, y, z0 + 0.0012, z0 + 0.0095, skip='Y')
    if plugged:
        mb.box('patch_plug', px + 0.0015, px + 0.011, y - 0.022, y - 0.001, z0 + 0.0015, z0 + 0.0095, skip='Y')
        return (px + 0.00625, y - 0.022, z0 + 0.0055)
    return None


# ------------------------------------------------------------------ NVL72
def nvl72_slots():
    """上からの並び（GB200 RA 図 3.1）。(種類, z0, z1) を返す。"""
    order = ['blank', 'blank', 'guide', 'guide', 'tor', 'tor'] + ['psu'] * 4 + ['cmp'] * 10 + ['sw'] * 9 + ['cmp'] * 8 + ['psu'] * 4
    z = NH - 0.08; out = []
    for k in order:
        out.append((k, z - U, z)); z -= U
    return out


def nvl72_body(M, rng):
    mb = MB('nvl72', M)
    shell(mb, NW, ND, NH)
    slots = nvl72_slots()
    ports = {'osfp': [], 'bf': [], 'mgmt': [], 'tor': []}
    for kind, z0, z1 in slots:
        if kind in ('blank', 'guide'):
            blank(mb, z0, z1)
            if kind == 'guide':     # 横のケーブルガイド（指の列）
                for i in range(12):
                    x = RX0 + 0.02 + i * 0.038
                    mb.box('frame', x, x + 0.006, -0.05, 0.0, z0 + 0.004, z1 - 0.004, skip='Y')
        elif kind == 'tor':
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            for row in range(2):
                for i in range(24):
                    px = RX0 + 0.035 + i * 0.0137 + (i // 6) * 0.004
                    p = rj45(mb, px, z0 + 0.007 + row * 0.016, plugged=False)
                    ports['tor'].append((px + 0.006, z0 + 0.012 + row * 0.016))
            for i in range(4):
                osfp_port(mb, RX1 - 0.11 + i * 0.024, z0 + 0.014, z1 - 0.014, w=0.019, depth=0.012)
            leds(mb, RX0 + 0.012, 0, z1 - 0.012, ['led_g', 'led_g'])
        elif kind == 'psu':
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            w = (RX1 - RX0) / 6
            for i in range(6):
                x0 = RX0 + i * w
                mb.box('psu', x0 + 0.003, x0 + w - 0.003, -0.003, 0.004, z0 + 0.003, z1 - 0.003, skip='Y')
                mb.box('handle', x0 + w - 0.02, x0 + w - 0.008, -0.018, -0.003, z0 + 0.008, z1 - 0.008, skip='Y')
                leds(mb, x0 + 0.008, -0.003, z1 - 0.011, ['led_g'])
        elif kind == 'sw':
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            mb.box('perf_sw', RX0 + 0.03, RX1 - 0.03, -0.002, 0.004, z0 + 0.004, z1 - 0.004, skip='Y')
            for hx in (RX0 + 0.004, RX1 - 0.022):
                mb.box('handle', hx, hx + 0.018, -0.02, -0.002, z0 + 0.008, z1 - 0.008, skip='Y')
            leds(mb, RX1 - 0.03 - 0.02, -0.002, z0 + 0.006, ['led_b', 'led_g'])
            mb.box('label', RX0 + 0.034, RX0 + 0.064, -0.0025, -0.002, z0 + 0.006, z0 + 0.013, skip='Y')
        elif kind == 'cmp':
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            for i in range(4):
                px = RX0 + 0.024 + i * 0.027
                ports['osfp'].append(osfp_port(mb, px, z0 + 0.012, z1 - 0.012))
            for i in range(2):   # BlueField-3
                px = RX0 + 0.136 + i * 0.022
                mb.box('cage', px, px + 0.019, -0.002, 0.006, z0 + 0.013, z1 - 0.013, skip='Y')
                mb.box('osfp', px + 0.002, px + 0.017, -0.012, -0.002, z0 + 0.0145, z1 - 0.0145, skip='Y')
                mb.box('boot_a', px + 0.005, px + 0.014, -0.034, -0.012, z0 + 0.016, z1 - 0.016, skip='Y')
                ports['bf'].append((px + 0.0095, -0.034, (z0 + z1) / 2))
            mp = rj45(mb, RX0 + 0.186, z0 + 0.016)
            ports['mgmt'].append(mp)
            mb.box('perf_gold', RX0 + 0.205, RX1 - 0.10, -0.002, 0.004, z0 + 0.004, z1 - 0.004, skip='Y')
            for i in range(8):     # E1.S の差し込み口
                x = RX1 - 0.098 + i * 0.0102
                mb.box('drive', x, x + 0.0094, -0.003, 0.004, z0 + 0.004, z1 - 0.004, skip='Y')
                if rng.random() < 0.9:
                    mb.box('led_g' if rng.random() < 0.85 else 'led_b', x + 0.003, x + 0.0055, -0.0034, -0.003, z1 - 0.009, z1 - 0.007, skip='Y')
            for hx in (RX0 - 0.0, RX1 - 0.014):
                mb.box('handle', hx, hx + 0.014, -0.022, -0.002, z0 + 0.007, z1 - 0.007, skip='Y')
            mb.box('label', RX0 + 0.17, RX0 + 0.2, -0.0025, -0.002, z0 + 0.003, z0 + 0.010, skip='Y')
            leds(mb, RX0 + 0.172, -0.002, z0 + 0.03, ['led_g', 'led_g' if rng.random() < 0.9 else 'led_a'])
    nvl72_rear(mb, slots, rng)
    return mb.finish(), ports


def nvl72_rear(mb, slots, rng):
    """背面: 左右の縦マニホールド（左=行き・青、右=戻り・赤）、ホース、中央のバスバー、銅ケーブルのカートリッジ 4 本、電源棚の背面。"""
    D = ND
    liquid = [(z0, z1) for k, z0, z1 in slots if k in ('cmp', 'sw')]
    zl0 = min(z for z, _ in liquid) - 0.03; zl1 = max(z for _, z in liquid) + 0.03
    # トレイの背面板
    for k, z0, z1 in slots:
        if k in ('cmp', 'sw', 'psu', 'tor'):
            mb.box('tray_plate', RX0, RX1, D - 0.13, D - 0.124, z0 + 0.0006, z1 - 0.0006, skip='y', d=0.4)
    # カートリッジ（銅ケーブルの束を収める縦の箱）
    for x0, x1 in ((0.135, 0.200), (0.204, 0.270), (0.330, 0.396), (0.400, 0.465)):
        mb.box('cartridge', x0, x1, D - 0.122, D - 0.03, zl0, zl1, skip='y')
        mb.box('frame', x0 - 0.002, x1 + 0.002, D - 0.032, D - 0.026, zl1 - 0.02, zl1 + 0.01, skip='y')
        mb.box('frame', x0 - 0.002, x1 + 0.002, D - 0.032, D - 0.026, zl0 - 0.01, zl0 + 0.02, skip='y')
        mb.box('label', x0 + 0.01, x0 + 0.04, D - 0.0302, D - 0.0298, zl1 - 0.06, zl1 - 0.045, skip='y')
        # 上下の口から見える銅ケーブルの曲がり
        for j in range(6):
            x = x0 + 0.006 + j * (x1 - x0 - 0.012) / 5
            mb.tube('cord', [(x, D - 0.06, zl1 + 0.01), (x, D - 0.05, zl1 + 0.035), (x, D - 0.09, zl1 + 0.05)], 0.0035, sides=5, d=0.5)
    # バスバー（中央）
    mb.box('copper', 0.282, 0.318, D - 0.05, D - 0.032, 0.30, NH - 0.30, skip='y')
    for k, z0, z1 in slots:
        if k in ('cmp', 'sw', 'tor'):
            mb.box('frame', 0.276, 0.324, D - 0.036, D - 0.03, z0 + 0.012, z0 + 0.02, skip='y', d=0.4)
    mb.box('frame', 0.27, 0.33, D - 0.04, D - 0.025, NH - 0.30, NH - 0.26, skip='y')
    # マニホールド
    zm0, zm1 = zl0 - 0.06, NH + 0.02
    for xm, fit in ((0.036, 'fit_blue'), (NW - 0.036, 'fit_red')):
        mb.cyl('steel', (xm, D - 0.05, (zm0 + zm1) / 2), 'z', 0.024, zm1 - zm0, seg=14)
        for z in (zm0 + 0.03, zm1 - 0.03):
            mb.cyl('frame', (xm, D - 0.05, z), 'z', 0.03, 0.03, seg=14)
        mb.cyl(fit, (xm, D - 0.05, zm1 + 0.02), 'z', 0.026, 0.035, seg=14)
        mb.cyl('steel', (xm, D - 0.05, zm1 + 0.06), 'z', 0.02, 0.05, seg=12)
        # 支持金具
        for z in (zm0 + 0.25, (zm0 + zm1) / 2, zm1 - 0.3):
            mb.box('frame', xm - 0.03, xm + 0.03, D - 0.085, D - 0.075, z - 0.02, z + 0.02, skip='y')
    # ホース: マニホールド → トレイ背面の継手
    for z0, z1 in liquid:
        zc = (z0 + z1) / 2
        for xm, xt, fit, side in ((0.036, 0.095, 'fit_blue', 1), (NW - 0.036, NW - 0.095, 'fit_red', -1)):
            mb.cyl(fit, (xm + side * 0.03, D - 0.05, zc), 'x', 0.009, 0.016, seg=10)
            mb.cyl(fit, (xt, D - 0.118, zc), 'y', 0.0085, 0.016, seg=10)
            j = rng.uniform(-0.006, 0.006)
            pts = bezier_pts([(xm + side * 0.038, D - 0.05, zc), (xm + side * 0.045, D - 0.035 + j, zc - 0.004),
                              (xt, D - 0.06 + j, zc - 0.006), (xt, D - 0.11, zc)], per=5)
            mb.tube('hose', pts, 0.0065, sides=7, d=0.8)
    # 漏液検知のロープ（底）
    mb.box('black', 0.03, NW - 0.03, D - 0.1, D - 0.096, 0.105, 0.11, d=0.4)


def nvl72_cables(M, ports, rng, name):
    """正面の光ファイバ（左の溝へ寄せて上へ）と管理用の LAN ケーブル（右の溝から ToR へ）。"""
    mb = MB(name, M, maxsize=2048)
    def fiber(p, mat, cx, r=0.0017):
        px, py, pz = p
        sag = rng.uniform(0.012, 0.05)
        out = py - rng.uniform(0.02, 0.05)
        ych = rng.uniform(-0.05, -0.015)
        ztop = NH + rng.uniform(0.0, 0.03)
        ctrl = [(px, py + 0.004, pz), (px, py - 0.008, pz), (px - 0.004, out, pz - sag * 0.6),
                ((px + cx) / 2, out - rng.uniform(0, 0.015), pz - sag), (cx + 0.012, ych - 0.01, pz - sag * 0.6),
                (cx, ych, pz - sag * 0.2 + 0.02), (cx + rng.uniform(-0.004, 0.004), ych, (pz + ztop) / 2),
                (cx, ych + 0.01, ztop - 0.05), (cx + 0.01, 0.02, ztop + 0.06),
                (cx + 0.03 + rng.uniform(0, 0.05), TRAY_Y - 0.15, TRAY_Z - 0.12),
                (cx + 0.06 + rng.uniform(0, 0.08), TRAY_Y - 0.05 + rng.uniform(-0.05, 0.05), TRAY_Z + 0.03)]
        mb.tube(mat, bezier_pts(ctrl, per=4), r, sides=5, d=1.0)
    for p in ports['osfp']:
        fiber(p, 'fiber_y', 0.034 + rng.uniform(-0.012, 0.012), 0.0018)
    for p in ports['bf'][::2]:
        fiber(p, 'fiber_a', 0.034 + rng.uniform(-0.012, 0.012), 0.0016)
    tor = list(ports['tor']); rng.shuffle(tor)
    for p, (tx, tz) in zip(ports['mgmt'], tor):
        px, py, pz = p
        cx = 0.04 + rng.uniform(-0.008, 0.008)
        sag = rng.uniform(0.02, 0.05)
        ctrl = [(px, py + 0.004, pz), (px, py - 0.012, pz - 0.01), (px - 0.03, py - 0.025, pz - sag),
                ((px + cx) / 2, -0.045 - rng.uniform(0, 0.01), pz - sag * 1.3), (cx + 0.02, -0.035, pz - sag * 0.8),
                (cx, -0.025, pz - sag * 0.3), (cx + rng.uniform(-0.004, 0.004), -0.027, (pz + tz) / 2), (cx, -0.03, tz - 0.08),
                (cx + 0.03, -0.04, tz - 0.035), (tx - 0.02, -0.045, tz - 0.02), (tx, -0.03, tz), (tx, -0.008, tz)]
        mb.tube('patch', bezier_pts(ctrl, per=4), 0.002, sides=5, d=1.0)
    return mb.finish()


# ------------------------------------------------------------------ ネットワークラック
def net_slots():
    order = ['tor', 'guide', 'q3400', 'guide2', 'q3400', 'guide2', 'q3400', 'guide2', 'q3400', 'guide2', 'sn5600', 'guide2']
    size = {'tor': 1, 'guide': 1, 'guide2': 2, 'q3400': 4, 'sn5600': 2}
    z = OH - 0.07; out = []
    for k in order:
        h = size[k] * U
        out.append((k, z - h, z)); z -= h
    return out, z


def net_body(M, rng):
    mb = MB('netrack', M)
    shell(mb, OW, OD, OH)
    slots, zbot = net_slots()
    ports = {'osfp': [], 'tor': [], 'mgmt': []}
    for kind, z0, z1 in slots:
        if kind in ('guide', 'guide2'):
            blank(mb, z0, z1)
            for i in range(14):
                x = RX0 + 0.012 + i * 0.033
                mb.box('frame', x, x + 0.007, -0.07, 0.0, z0 + 0.006, z1 - 0.006, skip='Y')
        elif kind == 'tor':
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            for row in range(2):
                for i in range(24):
                    px = RX0 + 0.035 + i * 0.0137 + (i // 6) * 0.004
                    p = rj45(mb, px, z0 + 0.007 + row * 0.016, plugged=rng.random() < 0.7)
                    if p:
                        ports['tor'].append(p)
            leds(mb, RX0 + 0.012, 0, z1 - 0.012, ['led_g', 'led_g'])
        elif kind in ('q3400', 'sn5600'):
            n_row, rows = (18, 4) if kind == 'q3400' else (16, 4)
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            span = (RX1 - RX0 - 0.03)
            pitch = span / n_row
            hh = (z1 - z0 - 0.012) / rows
            for r in range(rows):
                for i in range(n_row):
                    px = RX0 + 0.015 + i * pitch + 0.001
                    zz0 = z0 + 0.006 + r * hh + 0.0015
                    occupied = rng.random() < (0.94 if kind == 'q3400' else 0.8)
                    if occupied:
                        tip = osfp_port(mb, px, zz0, zz0 + hh - 0.004, w=pitch - 0.0035, depth=0.016)
                        ports['osfp'].append(tip)
                    else:
                        mb.box('cage', px, px + pitch - 0.0035, -0.002, 0.006, zz0, zz0 + hh - 0.004, skip='Y')
                        mb.box('hole', px + 0.002, px + pitch - 0.0055, -0.0022, 0.0, zz0 + 0.002, zz0 + hh - 0.006, skip='Y')
            leds(mb, RX0 + 0.003, -0.001, z1 - 0.008, ['led_g', 'led_b'])
            mb.box('label', RX1 - 0.012, RX1 - 0.003, -0.001, 0.0, z0 + 0.01, z0 + 0.04, skip='Y')
            for hx in (RX0 - 0.016, RX1 + 0.004):
                mb.box('handle', hx, hx + 0.012, -0.02, 0.0, z0 + 0.01, z1 - 0.01, skip='Y')
    # 下は空き（目隠し板）
    z = zbot
    while z - U > 0.12:
        blank(mb, z - U, z); z -= U
    rear_door(mb, OW, OD, OH)
    return mb.finish(), ports


def rear_door(mb, W, D, H):
    """ネットワーク・ストレージ・管理ラックの背面: パンチングの扉。"""
    mb.box('perf_dark', 0.015, W - 0.015, D + 0.004, D + 0.022, 0.11, H - 0.03, skip='y')
    mb.box('frame', 0.015, W - 0.015, D + 0.003, D + 0.025, H - 0.06, H - 0.03, skip='y')
    mb.box('frame', 0.015, W - 0.015, D + 0.003, D + 0.025, 0.11, 0.14, skip='y')
    mb.box('handle', W - 0.06, W - 0.04, D + 0.022, D + 0.04, 1.0, 1.25, skip='y')


def net_cables(M, ports, rng, name):
    """2 本ずつ（800G の双子ポート）の光ファイバを左右の溝へ。束が太くなる。"""
    mb = MB(name, M, maxsize=2048)
    mid = (RX0 + RX1) / 2
    for p in ports['osfp']:
        px, py, pz = p
        left = px < mid + rng.uniform(-0.02, 0.02)
        for twin in (-0.004, 0.004):
            cx = (0.034 if left else OW - 0.034) + rng.uniform(-0.016, 0.016)
            sag = rng.uniform(0.01, 0.045)
            out = py - rng.uniform(0.015, 0.04)
            ych = rng.uniform(-0.075, -0.02)
            ztop = OH + rng.uniform(0.0, 0.03)
            mat = 'fiber_y' if rng.random() < 0.82 else 'fiber_a'
            ctrl = [(px + twin, py + 0.004, pz), (px + twin, py - 0.006, pz), (px + twin * 2, out, pz - sag * 0.6),
                    ((px + cx) / 2, out - rng.uniform(0, 0.02), pz - sag), (cx + (0.012 if left else -0.012), ych - 0.01, pz - sag * 0.5),
                    (cx, ych, pz - sag * 0.1 + 0.02), (cx + rng.uniform(-0.006, 0.006), ych, (pz + ztop) / 2),
                    (cx, ych + 0.01, ztop - 0.05), (cx, 0.02, ztop + 0.07),
                    (cx + (0.06 if left else -0.06) * rng.random(), TRAY_Y - 0.15, TRAY_Z - 0.12),
                    (cx + (0.15 if left else -0.15) * rng.random(), TRAY_Y + rng.uniform(-0.1, 0.1), TRAY_Z + 0.03)]
            mb.tube(mat, bezier_pts(ctrl, per=3), 0.0016, sides=5, d=1.0)
    for p in ports['tor']:
        px, py, pz = p
        cx = OW - 0.03 + rng.uniform(-0.01, 0.01)
        ctrl = [(px, py + 0.004, pz), (px, py - 0.02, pz - 0.01), (cx - 0.02, -0.05, pz - 0.02), (cx, -0.04, pz),
                (cx, -0.03, OH + 0.02), (cx, 0.1, OH + 0.1), (cx - 0.1, TRAY_Y, TRAY_Z + 0.03)]
        mb.tube('patch', bezier_pts(ctrl, per=4), 0.0026, sides=5, d=0.8)
    return mb.finish()


# ------------------------------------------------------------------ ストレージ・管理
def storage_body(M, rng):
    mb = MB('storrack', M, maxsize=2048)
    shell(mb, OW, OD, OH)
    z = OH - 0.07
    for i in range(18):
        z0, z1 = z - 2 * U, z
        mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
        n = 24; w = (RX1 - RX0 - 0.05) / n
        for j in range(n):
            x = RX0 + 0.025 + j * w
            mb.box('drive', x + 0.0006, x + w - 0.0006, -0.006, 0.004, z0 + 0.007, z1 - 0.012, skip='Y')
            mb.box('frame', x + 0.001, x + w - 0.001, -0.009, -0.006, z1 - 0.024, z1 - 0.012, skip='Y')
            mb.box('led_g' if rng.random() < 0.92 else 'led_a', x + w * 0.3, x + w * 0.6, -0.0063, -0.006, z0 + 0.003, z0 + 0.006, skip='Y')
        for hx in (RX0 + 0.002, RX1 - 0.02):
            mb.box('handle', hx, hx + 0.018, -0.02, 0.0, z0 + 0.01, z1 - 0.01, skip='Y')
        leds(mb, RX0 + 0.004, -0.0, z0 + 0.004, ['led_b', 'led_g'])
        z -= 2 * U
    while z - U > 0.12:
        blank(mb, z - U, z); z -= U
    rear_door(mb, OW, OD, OH)
    return mb.finish()


def mgmt_body(M, rng):
    mb = MB('mgmtrack', M, maxsize=2048)
    shell(mb, OW, OD, OH)
    z = OH - 0.07
    order = ['tor', 'tor', 'guide'] + ['srv'] * 12 + ['blank'] + ['ufm'] * 2 + ['blank'] * 2 + ['srv'] * 4
    tor_ports = []
    for kind in order:
        z0, z1 = z - U, z
        if kind == 'blank':
            blank(mb, z0, z1)
        elif kind == 'guide':
            blank(mb, z0, z1)
            for i in range(14):
                x = RX0 + 0.012 + i * 0.033
                mb.box('frame', x, x + 0.007, -0.06, 0.0, z0 + 0.005, z1 - 0.005, skip='Y')
        elif kind == 'tor':
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            for row in range(2):
                for i in range(24):
                    px = RX0 + 0.035 + i * 0.0137 + (i // 6) * 0.004
                    p = rj45(mb, px, z0 + 0.007 + row * 0.016, plugged=rng.random() < 0.8)
                    if p:
                        tor_ports.append(p)
        else:
            mb.box('tray_plate', RX0, RX1, 0, 0.006, z0 + 0.0006, z1 - 0.0006, skip='Y')
            mb.box('perf_dark', RX0 + 0.03, RX0 + 0.20, -0.002, 0.004, z0 + 0.004, z1 - 0.004, skip='Y')
            for j in range(10 if kind == 'srv' else 4):
                x = RX0 + 0.21 + j * 0.024
                mb.box('drive', x, x + 0.022, -0.004, 0.004, z0 + 0.008, z1 - 0.008, skip='Y')
                mb.box('led_g', x + 0.017, x + 0.02, -0.0043, -0.004, z0 + 0.01, z0 + 0.013, skip='Y')
            for hx in (RX0 + 0.002, RX1 - 0.02):
                mb.box('handle', hx, hx + 0.018, -0.016, 0.0, z0 + 0.008, z1 - 0.008, skip='Y')
            leds(mb, RX1 - 0.045, -0.002, z1 - 0.012, ['led_g', 'led_b' if rng.random() < 0.2 else 'led_g'])
        z -= U
    while z - U > 0.12:
        blank(mb, z - U, z); z -= U
    for p in tor_ports:
        px, py, pz = p
        cx = OW - 0.03 + rng.uniform(-0.01, 0.01)
        ctrl = [(px, py + 0.004, pz), (px, py - 0.02, pz - 0.012), (cx - 0.03, -0.05, pz - 0.02), (cx, -0.04, pz - 0.05),
                (cx, -0.035, pz - rng.uniform(0.2, 0.9))]
        mb.tube('patch', bezier_pts(ctrl, per=4), 0.0026, sides=5)
    rear_door(mb, OW, OD, OH)
    return mb.finish()


# ------------------------------------------------------------------ CDU
def cdu_body(M, rng, name='cdu'):
    """CDU（液対液）。外箱・中の機器（ポンプ 2・板状熱交換器・ステンレス配管・バルブ・ろ過器・膨張タンク・制御盤）。
    正面は -y。扉は別のメッシュ（cdu_door）。上面に 4 本の配管の口（TCS 行き・戻り、FWS 行き・戻り）。"""
    W, D, H = CDU_W, CDU_D, CDU_H
    mb = MB(name, M, maxsize=2048)
    t = 0.015
    mb.box('cdu', 0, t, 0, D, 0.05, H); mb.box('cdu', W - t, W, 0, D, 0.05, H)
    mb.box('cdu', 0, W, 0, D, H - t, H); mb.box('cdu', 0, W, D - t, D, 0.05, H, skip='y')
    mb.box('cdu', 0, W, 0, D, 0.0, 0.05, skip='z')
    mb.box('cdu', 0, W, 0, 0.02, H - 0.08, H - t, skip='Y')    # 扉の上の帯
    mb.box('cdu_in', t, W - t, t, D - t, 0.05, 0.06, d=0.6)     # 底の受け皿
    # 内側の壁（亜鉛めっき）
    mb.box('cdu_in', t, t + 0.002, 0.02, D - t, 0.06, H - t, d=0.5); mb.box('cdu_in', W - t - 0.002, W - t, 0.02, D - t, 0.06, H - t, d=0.5)
    mb.box('cdu_in', t, W - t, D - t - 0.002, D - t, 0.06, H - t, d=0.5)
    # ポンプ 2 台（下段、左右に並ぶ。軸は前後で、扉を開けるとモーターの端が2つ並んで見える）
    PC = (0.165, 0.435)
    for pc in PC:
        mb.box('frame', pc - 0.12, pc + 0.12, 0.15, 0.56, 0.06, 0.10)
        mb.cyl('pump', (pc, 0.30, 0.22), 'y', 0.10, 0.26, seg=24)        # モーター
        for k in range(10):
            mb.cyl('pump', (pc, 0.21 + k * 0.02, 0.22), 'y', 0.106, 0.006, seg=24, caps=False)
        mb.cyl('black', (pc, 0.165, 0.22), 'y', 0.09, 0.012, seg=24)     # ファンカバー
        mb.cyl('steel', (pc, 0.47, 0.22), 'y', 0.12, 0.08, seg=28)       # 渦巻きの外箱
        mb.cyl('steel', (pc, 0.53, 0.22), 'y', 0.045, 0.04, seg=16)      # 吸い込み
        mb.cyl('steel', (pc, 0.47, 0.39), 'z', 0.035, 0.12, seg=16)      # 吐出
        mb.cyl('frame', (pc, 0.47, 0.36), 'z', 0.05, 0.02, seg=16)
        mb.box('label', pc - 0.05, pc + 0.05, 0.24, 0.34, 0.319, 0.321)
    # 板状熱交換器（中段）。板は x 方向に重なり、扉から板の縁の縞が見える。両端の厚い枠は濃い青、締め付けボルトが通る
    hx0, hx1, hy0, hy1, hz0, hz1 = 0.13, 0.47, 0.40, 0.90, 0.62, 1.42
    mb.box('phx_frame', hx0, hx0 + 0.04, hy0 - 0.02, hy1 + 0.02, hz0 - 0.06, hz1 + 0.06)
    mb.box('phx_frame', hx1 - 0.04, hx1, hy0 - 0.02, hy1 + 0.02, hz0 - 0.06, hz1 + 0.06)
    mb.box('phx_plates', hx0 + 0.04, hx1 - 0.04, hy0, hy1, hz0, hz1)
    mb.box('steel', hx0 + 0.04, hx1 - 0.04, hy0 + 0.2, hy0 + 0.3, hz1 + 0.035, hz1 + 0.05)        # 上の案内棒
    for y in (hy0 - 0.005, hy1 + 0.005):
        for z in (hz0 - 0.03, (hz0 + hz1) / 2, hz1 + 0.03):
            mb.cyl('steel', ((hx0 + hx1) / 2, y, z), 'x', 0.011, hx1 - hx0 + 0.12, seg=10)
            for x in (hx0 - 0.04, hx1 + 0.04):
                mb.cyl('steel', (x, y, z), 'x', 0.02, 0.025, seg=6)
    mb.box('label', hx0 + 0.005, hx0 + 0.035, hy0 + 0.05, hy0 + 0.12, hz1 - 0.12, hz1 - 0.06)
    mb.box('frame', 0.04, 0.56, 0.36, 0.94, 0.50, 0.56)          # 台
    pipe_r = 0.032
    def run(pts, r=pipe_r, mat='steel'):
        pts = [Vector(p) for p in pts]
        mb.tube(mat, pts, r, sides=18, d=1.0)
        for p in pts[1:-1]:
            mb.tube(mat, [p - Vector((0, 0, 0.0001)), p + Vector((0, 0, 0.0001))], r * 1.02, sides=18)
    def valve(p, axis, handle='valve'):
        x, y, z = p
        mb.cyl('steel', p, axis, pipe_r + 0.02, 0.05, seg=18)
        mb.cyl('steel', (x, y, z + 0.05), 'z', 0.008, 0.06, seg=8)
        mb.box(handle, x - 0.012, x + 0.012, y - 0.11, y + 0.01, z + 0.075, z + 0.087)
    def flange(p, axis):
        mb.cyl('steel', p, axis, pipe_r + 0.014, 0.016, seg=18)
    # 口: TCS は左の枠（前寄り）、FWS は右の枠（後ろ寄り）
    TS, TR = (hx0, 0.50, hz1 - 0.08), (hx0, 0.50, hz0 + 0.08)
    FS, FR = (hx1, 0.80, hz0 + 0.08), (hx1, 0.80, hz1 - 0.08)
    for p, s in ((TS, -1), (TR, -1), (FS, 1), (FR, 1)):
        flange((p[0] + s * 0.008, p[1], p[2]), 'x')
    # TCS: 戻り（ラックから温）→ ろ過器 → ポンプ 2 台 → 熱交換器 → 行き（上へ）
    SX, SY, RX, RY = 0.065, 0.50, 0.535, 0.30
    run([TS, (SX, SY, TS[2]), (SX, SY, H + 0.15)])                                             # 行き: 熱交換器 → 上へ
    run([(RX, RY, H + 0.15), (RX, RY, 0.62), (RX, 0.98, 0.62), (RX, 0.98, 0.22), (RX, 0.64, 0.22), (0.10, 0.64, 0.22)])  # 戻り: 上から → 後ろで下へ → 吸い込みの母管
    for pc in PC:
        run([(pc, 0.64, 0.22), (pc, 0.55, 0.22)])                                              # → 各ポンプの吸い込み
    run([(PC[0], 0.47, 0.45), (PC[1], 0.47, 0.45)])                                            # 吐出の合流
    run([(0.30, 0.47, 0.45), (0.30, 0.30, 0.45), (0.30, 0.30, 0.59), (0.09, 0.30, 0.59), (0.09, 0.50, 0.59), (0.09, 0.50, TR[2]), TR])
    valve((SX, SY, 1.62), 'z', 'tape_blue'); valve((RX, RY, 1.55), 'z'); valve((0.25, 0.30, 0.59), 'x')
    mb.cyl('steel', (SX, SY, 1.80), 'z', pipe_r + 0.016, 0.12, seg=18)                        # 流量計
    mb.box('black', SX - 0.03, SX + 0.03, SY - 0.09, SY - 0.045, 1.76, 1.84)
    mb.box('screen', SX - 0.022, SX + 0.022, SY - 0.0905, SY - 0.09, 1.785, 1.825)
    # 戻りの途中のろ過器と、膨張タンク
    mb.cyl('steel', (RX, RY, 1.05), 'z', 0.05, 0.30, seg=20); mb.cyl('steel', (RX, RY, 1.21), 'z', 0.058, 0.03, seg=20)
    mb.cyl('steel', (RX, RY, 0.89), 'z', 0.058, 0.03, seg=20)
    mb.cyl('tank', (0.20, 0.13, 0.86), 'z', 0.05, 0.22, seg=20)
    for z in (0.74, 0.98):
        mb.cyl('tank', (0.20, 0.13, z), 'z', 0.04, 0.02, seg=20)
    run([(0.20, 0.13, 0.99), (0.20, 0.13, 1.08), (SX, 0.13, 1.08), (SX, SY - 0.04, 1.08)], r=0.008)
    # 圧力計と温度計
    for p in ((SX, SY - 0.045, 1.45), (RX, RY - 0.045, 1.42), (RX, RY - 0.045, 0.72), (0.20, 0.255, 0.59)):
        mb.cyl('steel', (p[0], p[1] + 0.02, p[2]), 'y', 0.006, 0.04, seg=8)
        mb.cyl('gauge', (p[0], p[1] - 0.005, p[2]), 'y', 0.032, 0.014, seg=24)
        mb.cyl('steel', (p[0], p[1] - 0.013, p[2]), 'y', 0.034, 0.003, seg=24, caps=False)
    # 温度センサー（細い差し込み）と排水の小さなバルブ
    for p in ((SX, SY - 0.035, 1.30), (RX, RY - 0.035, 1.30)):
        mb.cyl('steel', p, 'y', 0.006, 0.04, seg=8); mb.box('black', p[0] - 0.008, p[0] + 0.008, p[1] - 0.05, p[1] - 0.02, p[2] - 0.01, p[2] + 0.01)
    for p in ((0.30, 0.20, 0.45), (0.09, 0.42, 0.62)):
        mb.cyl('steel', p, 'z', 0.007, 0.06, seg=8); mb.box('valve', p[0] - 0.006, p[0] + 0.006, p[1] - 0.04, p[1], p[2] + 0.03, p[2] + 0.036)
    # FWS（後ろ側）: 施設の水は上から入り、熱交換器の下へ。温まって上の口から出る
    FX, FY, GX, GY = 0.38, 1.06, 0.53, 1.12
    run([(FX, FY, H + 0.15), (FX, FY, FS[2]), (0.52, FY, FS[2]), (0.52, FS[1], FS[2]), FS])
    run([FR, (0.53, FR[1], FR[2]), (GX, GY, FR[2]), (GX, GY, H + 0.15)])
    valve((FX, FY, 1.62), 'z'); valve((GX, GY, 1.70), 'z')
    # 制御盤（上段、前寄りで浅い）と配線
    mb.box('frame', 0.06, 0.54, 0.62, 0.98, 1.62, H - 0.03)
    mb.box('cdu_in', 0.06, 0.54, 0.618, 0.62, 1.62, H - 0.03, d=0.6)
    for i in range(7):
        mb.box('black', 0.08 + i * 0.06, 0.12 + i * 0.06, 0.605, 0.618, 1.70, 1.78)
        mb.box('led_g', 0.09 + i * 0.06, 0.095 + i * 0.06, 0.604, 0.605, 1.76, 1.765)
    mb.box('bus_dark', 0.06, 0.54, 0.6, 0.618, 1.85, 1.95)
    for i in range(9):
        mb.box('label', 0.08 + i * 0.05, 0.11 + i * 0.05, 0.5995, 0.6, 1.88, 1.92)
    # 配線（制御盤から下の機器へ）と、側壁の配線ダクト
    mb.box('bus_dark', 0.02, 0.05, 0.62, 0.68, 0.1, 1.62)
    for i in range(5):
        mb.tube('cord', bezier_pts([(0.1 + i * 0.08, 0.61, 1.62), (0.1 + i * 0.07, 0.6, 1.5), (0.05, 0.62, 1.3), (0.04, 0.64, 0.6), (0.2, 0.55, 0.3)], per=6), 0.005, sides=6)
    # 上の口のフランジ
    for x, y in ((SX, SY), (RX, RY), (FX, FY), (GX, GY)):
        mb.cyl('steel', (x, y, H + 0.01), 'z', pipe_r + 0.02, 0.02, seg=20)
    # 中の配管にも行き（青）・戻り（赤）の帯。rnd を固定して乱数の並びを変えない（後に作る物の見た目を保つ）
    for x, y, zs, band in ((SX, SY, (1.20, 1.98), 'tape_blue'), (RX, RY, (0.75, 1.40, 1.98), 'tape_red'),
                           (FX, FY, (1.30, 1.98), 'tape_blue'), (GX, GY, (1.40, 1.98), 'tape_red')):
        for z in zs:
            mb.cyl(band, (x, y, z), 'z', pipe_r + 0.002, 0.06, seg=18, caps=False, rnd=0.5)
    mb.box('black', 0.05, 0.55, 0.06, 1.14, 0.06, 0.065, d=0.3)   # 漏液センサー
    mb.box('lamp', 0.1, 0.5, 0.03, 0.05, H - 0.04, H - 0.035, d=0.5)  # 保守用の灯
    pipes_top = {'tcs_supply': (SX, SY), 'tcs_return': (RX, RY), 'fws_supply': (FX, FY), 'fws_return': (GX, GY)}
    return mb.finish(), pipes_top


def cdu_door(M, name, right=False):
    """扉。原点はヒンジの軸。right=False なら板は +x へ、True なら -x へ伸びる。前面に 7 インチのタッチパネル。"""
    W, H = CDU_W - 0.004, CDU_H - 0.10
    mb = MB(name, M, maxsize=1024)
    if right:
        _box = mb.box
        mb.box = lambda mat, x0, x1, *a, **k: _box(mat, x0 - W, x1 - W, *a, **k)
    mb.box('cdu_door', 0.0, W, -0.025, 0.0, 0.0, H)
    mb.box('cdu_in', 0.02, W - 0.02, 0.0, 0.02, 0.05, H - 0.05, d=0.6)
    mb.box('perf_dark', 0.06, W - 0.06, -0.0255, -0.025, 0.12, 0.62)
    mb.box('screen', W / 2 - 0.085, W / 2 + 0.085, -0.027, -0.025, 1.36, 1.46)
    mb.box('frame', W / 2 - 0.092, W / 2 + 0.092, -0.026, -0.025, 1.35, 1.47)
    hx = (0.03, 0.05) if right else (W - 0.05, W - 0.03)
    mb.box('handle', hx[0], hx[1], -0.05, -0.025, 0.85, 1.05)
    mb.box('label', 0.05, 0.14, -0.0255, -0.025, 1.70, 1.74)
    leds(mb, W / 2 - 0.02, -0.025, 1.50, ['led_g', 'led_g', 'led_g'])
    return mb.finish()
