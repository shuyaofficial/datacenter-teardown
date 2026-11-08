# 部屋の並びと、部屋そのもの（床・壁・天井・天井の3段・囲い・CDU の配管・電気室・屋外）。
# 座標: x は列に沿って、y は奥（+y が列A の背面＝温かい通路）、z は上。単位 m。数値の正本は room/refs.md。
import math, random
from mathutils import Vector
from rb_core import MB, place, bezier_pts
import rb_parts as P

ROW_A = ['stor', 'stor', 'net', 'net'] + ['nvl'] * 8 + ['net', 'net', 'mgmt']
L = len(ROW_A) * 0.6                 # 9.0 m
COLD = 1.2                            # 冷たい通路の幅
HOT0, HOT1 = 1.2, 1.2 + 1.83          # 温かい通路（囲いの中）
B_FRONT = HOT1 + 1.2                  # 列B の正面の y（= 4.23）
C_FRONT = -COLD                       # 列C の正面の y
HC = (HOT0 + HOT1) / 2                # 温かい通路の中心
CC = -COLD / 2                        # 冷たい通路の中心
WALL_X0, WALL_X1 = -2.6, 13.0         # 部屋の端の壁（x1 に窓）
WALL_Y0, WALL_Y1 = -5.0, 6.4
CEIL = 4.5; BEAM = 4.05
CONT_Y = 0.95                         # 囲いの縦の板（ラックの天板の上、列A 側）
CONT_Z = 3.0
BUS_Y = (0.78, 0.92); BUS_Z = (2.42, 2.55)
TRAY_Y = (0.10, 0.70); TRAY_Z = (2.70, 2.80)
PIPE_Z = 3.25; PIPE_R = 0.09
SUP_Y, RET_Y = 1.15, 1.40             # TCS の行き・戻り（列A の上、囲いの屋根の上）
PIPE_X0, PIPE_X1 = WALL_X0 - 0.1, 9.6
CDU_X = 10.3                          # CDU の正面の x（正面は -x を向く）
CDU1_Y, CDU2_Y = HC + 0.6, HC         # 原点（正面から見て左端）の y。CDU2 は扉を開ける
EROOM_X1 = 19.0                       # 電気室の奥の壁
MAN_IN = 0.036                        # NVL72 のマニホールドの x（ラックの左端から）
FWS_SY, FWS_RY, FWS_SZ, FWS_RZ = 1.55, 1.85, 3.65, 3.85   # 施設の水（行き・戻り）が電気室の天井を抜ける高さ
COOLER_X0 = EROOM_X1 + 11.2           # 屋外のフルードクーラーの手前の端（配管の口がある面）
COOLER_YS = (-3.2, 0.4, 4.0)          # 3 台の中心の y
ERACK = {1: -2.05, -1: 4.05}          # 電気室の天井のケーブルラックの y（盤の列の真上）


def nvl_x():
    return [i * 0.6 for i, k in enumerate(ROW_A) if k == 'nvl']


def mirror_y(y, axis):
    return 2 * axis - y


def fws_outdoor():
    """屋外の施設の水の配管の道筋（壁の外の立ち下がり → 架台 → クーラーの前の母管）。
    supply: クーラー（中央の 1 台）→ 建物へ、ret: 建物 → クーラー。母管は 3 台に分ける。"""
    xs, xr = EROOM_X1 + 1.8, EROOM_X1 + 1.4          # 立ち下がりの x（柵より建物側）
    zs, zr = 0.75, 2.3                                # 架台の上の高さ（行きは下段、戻りは上段）
    hs, hr = COOLER_X0 - 0.7, COOLER_X0 - 1.1          # 母管の x
    cy = COOLER_YS[1]
    return {
        'xs': xs, 'xr': xr, 'zs': zs, 'zr': zr, 'hs': hs, 'hr': hr,
        'supply': [(COOLER_X0, cy, zs), (hs, cy, zs), (hs, FWS_SY, zs), (xs, FWS_SY, zs), (xs, FWS_SY, FWS_SZ)],
        'ret': [(xr, FWS_RY, FWS_RZ), (xr, FWS_RY, zr), (hr, FWS_RY, zr), (hr, cy, zr), (COOLER_X0, cy, zr)],
    }


# ------------------------------------------------------------------ 部屋の殻
def build_floor(M):
    mb = MB('floor_reflect', M, maxsize=4096)
    zones = [  # (x0, x1, y0, y1)  ラックの下は省く
        (WALL_X0, 0.0, WALL_Y0, WALL_Y1), (L, WALL_X1, WALL_Y0, WALL_Y1),
        (0.0, L, -COLD, 0.0), (0.0, L, 1.0, mirror_y(1.0, HC)),
        (0.0, L, WALL_Y0, C_FRONT - 1.1), (0.0, L, B_FRONT, WALL_Y1),
    ]
    for x0, x1, y0, y1 in zones:
        # 1 枚が大きすぎないように 3 m ごとに分ける（島の形を正方形に近づける）
        nx = max(1, math.ceil((x1 - x0) / 3.0)); ny = max(1, math.ceil((y1 - y0) / 3.0))
        for i in range(nx):
            for j in range(ny):
                a, b = x0 + (x1 - x0) * i / nx, x0 + (x1 - x0) * (i + 1) / nx
                c, d = y0 + (y1 - y0) * j / ny, y0 + (y1 - y0) * (j + 1) / ny
                dens = 1.0 if (0 <= c <= HOT1 or -COLD <= c < 0 or a >= L) else 0.55
                mb.quad('conc', [(a, c, 0), (b, c, 0), (b, d, 0), (a, d, 0)], d=dens)
    # 黄色い線（ラックの前の線、CDU の前の立ち入り注意の枠）
    zl = 0.0008
    for y in (-0.085, C_FRONT + 0.035):
        mb.box('line', -0.3, L + 0.3, y, y + 0.05, 0, zl, skip='z')
    for (x0, x1, y0, y1) in ((CDU_X - 0.75, CDU_X + 1.35, CDU2_Y - 0.6 - 0.15, CDU1_Y + 0.15),):
        for a, b, c, d in ((x0, x1, y0, y0 + 0.05), (x0, x1, y1 - 0.05, y1), (x0, x0 + 0.05, y0, y1), (x1 - 0.05, x1, y0, y1)):
            mb.box('line', a, b, c, d, 0, zl, skip='z')
        # 斜めの縞（前の部分だけ）
        for k in range(14):
            yy = y0 + 0.12 + k * 0.17
            if yy > y1 - 0.1:
                break
            mb.quad('line', [(x0 + 0.05, yy, zl), (x0 + 0.6, yy + 0.25, zl), (x0 + 0.6, yy + 0.05 + 0.25, zl), (x0 + 0.05, yy + 0.05, zl)])
    return mb.finish()


def build_shell(M):
    """壁・天井のデッキ・梁・窓枠。窓のガラスは別（glass）。"""
    mb = MB('shell', M, maxsize=2048, dens={'wall': 90, 'wall_y': 90, 'deck': 40, 'beam': 120})
    H = CEIL
    # 窓（x = WALL_X1 の壁、y -1.0..3.0、z 0.95..2.55）
    wy0, wy1, wz0, wz1 = -1.0, 3.0, 0.95, 2.25
    t = 0.2
    mb.box('wall_y', WALL_X1, WALL_X1 + t, WALL_Y0, wy0, 0, H, skip='X')
    mb.box('wall_y', WALL_X1, WALL_X1 + t, wy1, WALL_Y1, 0, H, skip='X')
    mb.box('wall_y', WALL_X1, WALL_X1 + t, wy0, wy1, 0, wz0, skip='X')
    mb.box('wall_y', WALL_X1, WALL_X1 + t, wy0, wy1, wz1, H, skip='X')
    for a, b, c, d in ((wy0, wy0 + 0.06, wz0, wz1), (wy1 - 0.06, wy1, wz0, wz1), (wy0, wy1, wz0, wz0 + 0.06), (wy0, wy1, wz1 - 0.06, wz1),
                       (0.97, 1.03, wz0, wz1)):
        mb.box('contain_frame', WALL_X1 - 0.02, WALL_X1 + t + 0.02, a, b, c, d)
    mb.box('wall_y', WALL_X0 - t, WALL_X0, WALL_Y0, WALL_Y1, 0, H, skip='x')
    mb.box('wall', WALL_X0, WALL_X1, WALL_Y0 - t, WALL_Y0, 0, H, skip='y')
    mb.box('wall', WALL_X0, WALL_X1, WALL_Y1, WALL_Y1 + t, 0, H, skip='Y')
    # 壁の下の幅木
    for y0, y1 in ((WALL_Y0, WALL_Y0 + 0.012), (WALL_Y1 - 0.012, WALL_Y1)):
        mb.box('beam', WALL_X0, WALL_X1, y0, y1, 0, 0.1, skip='z', d=0.5)
    mb.box('deck', WALL_X0, WALL_X1 + t, WALL_Y0, WALL_Y1, H, H + 0.05, skip='Z')
    # 梁（y 方向、3 m ごと）と小梁
    x = WALL_X0 + 1.1
    while x < WALL_X1:
        mb.box('beam', x - 0.1, x + 0.1, WALL_Y0, WALL_Y1, H - 0.02, H, skip='Z')
        mb.box('beam', x - 0.006, x + 0.006, WALL_Y0, WALL_Y1, BEAM + 0.02, H - 0.02, skip='Z')
        mb.box('beam', x - 0.1, x + 0.1, WALL_Y0, WALL_Y1, BEAM, BEAM + 0.02)
        x += 3.0
    y = WALL_Y0 + 0.75
    while y < WALL_Y1:
        mb.box('beam', WALL_X0, WALL_X1, y - 0.05, y + 0.05, H - 0.25, H, skip='Z', d=0.5)
        y += 1.5
    # スプリンクラーの配管（冷たい通路の上に1本）
    mb.cyl('sprinkler', ((WALL_X0 + WALL_X1) / 2, CC + 0.25, 3.92), 'x', 0.03, WALL_X1 - WALL_X0, seg=12, d=0.6)
    x = WALL_X0 + 1.0
    while x < WALL_X1:
        mb.cyl('sprinkler', (x, CC + 0.25, 3.85), 'z', 0.012, 0.1, seg=8, d=0.6)
        mb.cyl('steel', (x, CC + 0.25, 3.79), 'z', 0.014, 0.025, seg=8, d=0.6)
        mb.box('steel', x - 0.004, x + 0.004, CC + 0.246, CC + 0.254, 3.95, BEAM, d=0.3)
        x += 3.0
    # 非常口の表示・消火器・掲示（壁の小物）
    mb.box('led_g', WALL_X0 + 0.001, WALL_X0 + 0.02, CC - 0.18, CC + 0.18, 2.55, 2.70)
    mb.box('label', WALL_X0, WALL_X0 + 0.01, 2.0, 2.6, 1.3, 1.7)
    mb.box('tape_red', WALL_X0, WALL_X0 + 0.16, HC - 0.06, HC + 0.06, 0.15, 0.62)
    mb.box('label', WALL_X1 - 0.01, WALL_X1, -3.2, -2.6, 1.4, 1.8)
    return mb.finish()


def build_lights(M, lamps):
    """天井の LED のライン照明（光る面）。Cycles の面光源は lamps に (x, y, z, 長さ, 幅, 強さ) を足す。"""
    mb = MB('luminaires', M, maxsize=512, dens={'lamp': 60, 'lamp_body': 80})
    def line(x0, x1, y, z, w=0.07, power=280, seg=1.5, gap=0.0):
        x = x0
        while x < x1 - 0.1:
            xe = min(x1, x + seg)
            mb.box('lamp_body', x, xe, y - w / 2 - 0.01, y + w / 2 + 0.01, z + 0.0, z + 0.06, skip='')
            mb.box('lamp', x + 0.01, xe - 0.01, y - w / 2, y + w / 2, z - 0.002, z, skip='Z')
            lamps.append(((x + xe) / 2, y, z - 0.004, xe - x - 0.02, w, power * (xe - x) / 1.5))
            # 吊りワイヤ
            for xx in (x + 0.1, xe - 0.1):
                mb.box('steel', xx - 0.001, xx + 0.001, y - 0.001, y + 0.001, z + 0.06, BEAM, d=0.2)
            x = xe + gap
    line(WALL_X0 + 0.4, WALL_X1 - 0.3, CC, 3.6, power=300)
    line(WALL_X0 + 0.4, WALL_X1 - 0.3, -3.6, 3.6, power=260)
    line(WALL_X0 + 0.4, WALL_X1 - 0.3, 5.3, 3.6, power=260)
    line(-0.2, L + 0.2, HC, CONT_Z - 0.03, w=0.05, power=300, seg=1.2, gap=0.3)     # 囲いの中
    for y in (0.4, 2.6):
        line(L + 0.4, WALL_X1 - 0.3, y, 3.6, power=260)
    line(WALL_X0 + 0.4, -0.3, 2.0, 3.6, power=200)
    return mb.finish()


# ------------------------------------------------------------------ 囲い（温かい通路）
def build_containment(M):
    mb = MB('containment', M, maxsize=2048, dens={'contain': 160, 'contain_frame': 260})
    yA, yB = CONT_Y, mirror_y(CONT_Y, HC)
    zt = CONT_Z
    for y in (yA, yB):
        # ラックの天板の上の縦の板（枠と板）
        mb.box('contain', 0.0, L, y - 0.004, y + 0.004, P.NH, zt)
        mb.box('contain_frame', 0.0, L, y - 0.02, y + 0.02, zt - 0.05, zt)
        mb.box('contain_frame', 0.0, L, y - 0.02, y + 0.02, P.NH, P.NH + 0.04)
        for i in range(int(L / 1.2) + 1):
            x = min(L - 0.04, i * 1.2)
            mb.box('contain_frame', x, x + 0.04, y - 0.02, y + 0.02, P.NH, zt)
    # 屋根（板とリブ）とダクトの立ち上がり
    mb.box('contain', 0.0, L, yA, yB, zt, zt + 0.006)
    for i in range(int(L / 0.6) + 1):
        x = min(L - 0.03, i * 0.6)
        mb.box('contain_frame', x, x + 0.03, yA, yB, zt - 0.04, zt)
    for x0 in (1.2, 5.4):
        mb.box('contain', x0, x0 + 2.4, HC - 0.6, HC - 0.594, zt, BEAM - 0.15)
        mb.box('contain', x0, x0 + 2.4, HC + 0.594, HC + 0.6, zt, BEAM - 0.15)
        mb.box('contain', x0, x0 + 0.006, HC - 0.6, HC + 0.6, zt, BEAM - 0.15)
        mb.box('contain', x0 + 2.394, x0 + 2.4, HC - 0.6, HC + 0.6, zt, BEAM - 0.15)
        mb.box('contain_frame', x0 - 0.02, x0 + 2.42, HC - 0.62, HC + 0.62, BEAM - 0.17, BEAM - 0.15)
    # 端の扉（両端）: 引き戸 2 枚、窓つき。ガラスは glass に入れる
    glass = []
    for xe, s in ((0.0, -1), (L, 1)):
        xo = xe + s * 0.02
        mb.box('contain_frame', xo - 0.03, xo + 0.03, yA - 0.03, yA + 0.05, 0, zt)
        mb.box('contain_frame', xo - 0.03, xo + 0.03, yB - 0.05, yB + 0.03, 0, zt)
        mb.box('contain_frame', xo - 0.03, xo + 0.03, yA, yB, 2.15, 2.21)
        mb.box('contain', xo - 0.004, xo + 0.004, yA, yB, 2.21, zt)
        mid = HC
        for a, b in ((yA + 0.05, mid - 0.003), (mid + 0.003, yB - 0.05)):
            dx = s * (0.035 if a < mid else 0.075)
            x0, x1 = xe + dx - 0.022, xe + dx + 0.022
            # 扉の枠と下の板、上のガラス窓
            mb.box('contain_frame', x0, x1, a, b, 0.01, 0.06)
            mb.box('contain_frame', x0, x1, a, b, 2.09, 2.14)
            mb.box('contain_frame', x0, x1, a, a + 0.05, 0.01, 2.14)
            mb.box('contain_frame', x0, x1, b - 0.05, b, 0.01, 2.14)
            mb.box('contain_door', x0 + 0.01, x1 - 0.01, a + 0.05, b - 0.05, 0.06, 1.15)
            mb.box('contain_frame', x0, x1, a + 0.05, b - 0.05, 1.15, 1.2)
            glass.append((x0 + 0.018, x1 - 0.018, a + 0.05, b - 0.05, 1.2, 2.09))
            hy = b - 0.12 if a < mid else a + 0.08
            mb.box('handle', xe + dx + s * 0.022, xe + dx + s * 0.04, hy, hy + 0.04, 0.95, 1.12)
            mb.box('handle', xe + dx - s * 0.022, xe + dx - s * 0.04, hy, hy + 0.04, 0.95, 1.12)
    # 列C の背面の囲い（隣の組。縦の板と屋根の手前だけ）
    yc = mirror_y(CONT_Y, CC)
    mb.box('contain', 0.0, L, yc - 0.004, yc + 0.004, P.NH, zt, d=0.4)
    mb.box('contain_frame', 0.0, L, yc - 0.02, yc + 0.02, zt - 0.05, zt, d=0.4)
    yb2 = mirror_y(CONT_Y, (B_FRONT + WALL_Y1) / 2)
    return mb.finish(), glass


# ------------------------------------------------------------------ 天井の3段（1列分。列B・C は鏡に写して置く）
def build_services(M, rng, nvl_xs):
    mb = MB('services', M, maxsize=4096, dens={'tray': 500, 'bus': 260, 'bus_dark': 300, 'steel': 300, 'fiber_y': 220, 'fiber_a': 220})
    x0, x1 = -0.5, PIPE_X1
    # --- バスウェイ（2.42–2.55）: 電気室から壁を抜けて列の上を走る
    by0, by1 = BUS_Y; bz0, bz1 = BUS_Z
    mb.box('bus', x0, WALL_X1 + 0.1, by0, by1, bz0 + 0.01, bz1 - 0.01)
    mb.box('bus_dark', x0, WALL_X1 + 0.1, by0 - 0.004, by1 + 0.004, bz0, bz0 + 0.012)
    mb.box('bus_dark', x0, WALL_X1 + 0.1, by0 - 0.004, by1 + 0.004, bz1 - 0.012, bz1)
    x = x0
    while x < WALL_X1:
        mb.box('bus_dark', x, x + 0.08, by0 - 0.012, by1 + 0.012, bz0 - 0.005, bz1 + 0.005)   # 継ぎ目
        x += 3.0
    mb.box('bus_dark', x0 - 0.02, x0, by0 - 0.01, by1 + 0.01, bz0 - 0.01, bz1 + 0.01)
    # 差し込み口（タップオフ）とラックへの線
    for i, k in enumerate(ROW_A):
        xr = i * 0.6
        boxes = [(xr + 0.06, 4), (xr + 0.32, 4)] if k == 'nvl' else [(xr + 0.2, 2)]
        for bx, n in boxes:
            mb.box('bus_dark', bx, bx + 0.22, by0 + 0.005, by1 - 0.005, bz0 - 0.13, bz0)
            mb.box('label', bx + 0.03, bx + 0.08, by0 + 0.004, by0 + 0.005, bz0 - 0.06, bz0 - 0.03)
            mb.box('led_g', bx + 0.18, bx + 0.19, by0 + 0.0035, by0 + 0.005, bz0 - 0.03, bz0 - 0.02)
            for c in range(n):
                cx = bx + 0.03 + c * 0.05
                top = P.NH if k == 'nvl' else P.OH
                ye = (P.ND - 0.08) if k == 'nvl' else 1.0
                pts = bezier_pts([(cx, (by0 + by1) / 2, bz0 - 0.13), (cx, (by0 + by1) / 2 + 0.02, bz0 - 0.2),
                                  (cx + rng.uniform(-0.02, 0.02), ye - 0.02, top + 0.06), (cx, ye, top - 0.05)], per=5)
                mb.tube('cord', pts, 0.011, sides=8, d=0.8)
    # 吊り金具（バスウェイ・トレイ共通）
    x = x0 + 0.3
    while x < PIPE_X1:
        for yy in (by0 - 0.03, by1 + 0.03):
            mb.box('steel', x, x + 0.01, yy - 0.005, yy + 0.005, bz0 - 0.03, BEAM, d=0.3)
        mb.box('steel', x - 0.02, x + 0.03, by0 - 0.05, by1 + 0.05, bz0 - 0.04, bz0 - 0.0, d=0.5)
        for yy in (TRAY_Y[0] - 0.03, TRAY_Y[1] + 0.03):
            mb.box('steel', x + 0.4, x + 0.41, yy - 0.005, yy + 0.005, TRAY_Z[0] - 0.04, BEAM, d=0.3)
        mb.box('steel', x + 0.38, x + 0.43, TRAY_Y[0] - 0.06, TRAY_Y[1] + 0.06, TRAY_Z[0] - 0.045, TRAY_Z[0] - 0.005, d=0.5)
        x += 1.5
    # --- 黄色いワイヤーメッシュのトレイ（2.70–2.80）
    ty0, ty1 = TRAY_Y; tz0, tz1 = TRAY_Z
    wr = 0.0025
    for k in range(13):
        y = ty0 + k * (ty1 - ty0) / 12
        mb.box('tray', x0, PIPE_X1, y - wr, y + wr, tz0, tz0 + 2 * wr)
    for yy in (ty0, ty1):
        for z in (tz0 + 0.05, tz1):
            mb.box('tray', x0, PIPE_X1, yy - wr, yy + wr, z - wr, z + wr)
    xx = x0
    while xx < PIPE_X1:
        mb.box('tray', xx - wr, xx + wr, ty0, ty1, tz0 - wr, tz0 + wr)
        for yy in (ty0, ty1):
            mb.box('tray', xx - wr, xx + wr, yy - wr, yy + wr, tz0, tz1)
        xx += 0.1
    # トレイの中の光ファイバ（束）
    for k in range(70):
        yy = rng.uniform(ty0 + 0.03, ty1 - 0.03); zz = tz0 + 0.008 + rng.uniform(0, 0.05) * (1 - abs(yy - 0.4) * 1.5)
        mat = 'fiber_y' if rng.random() < 0.8 else 'fiber_a'
        ctrl = [(x0 + 0.05, yy, zz)]
        x = x0 + 0.05
        while x < PIPE_X1 - 0.1:
            x += rng.uniform(0.5, 1.2)
            ctrl.append((min(x, PIPE_X1 - 0.05), yy + rng.uniform(-0.03, 0.03), zz + rng.uniform(-0.006, 0.006)))
        mb.tube(mat, bezier_pts(ctrl, per=3), 0.006, sides=6, d=1.0)
    # --- 冷却液の配管（3.25、外径 0.18）。行き = 青い帯、戻り = 赤い帯
    for y, band in ((SUP_Y, 'tape_blue'), (RET_Y, 'tape_red')):
        mb.cyl('steel', ((PIPE_X0 + PIPE_X1) / 2, y, PIPE_Z), 'x', PIPE_R, PIPE_X1 - PIPE_X0, seg=24, d=1.0)
        for xe in (PIPE_X0, PIPE_X1):
            mb.cyl('steel', (xe, y, PIPE_Z), 'x', PIPE_R + 0.03, 0.03, seg=24)
        x = PIPE_X0 + 0.5
        while x < PIPE_X1:
            mb.cyl(band, (x, y, PIPE_Z), 'x', PIPE_R + 0.002, 0.1, seg=24, caps=False)
            mb.cyl('steel', (x + 0.9, y, PIPE_Z), 'x', PIPE_R + 0.012, 0.035, seg=24)    # 継手（溝付きカップリング）
            x += 2.4
        # 吊り（クレビス）
        x = PIPE_X0 + 0.6
        while x < PIPE_X1:
            mb.box('steel', x - 0.006, x + 0.006, y - 0.006, y + 0.006, PIPE_Z + PIPE_R, BEAM, d=0.3)
            mb.tube('steel', [(x, y - PIPE_R - 0.01, PIPE_Z + PIPE_R + 0.02), (x, y - PIPE_R - 0.01, PIPE_Z - PIPE_R * 0.4),
                              (x, y, PIPE_Z - PIPE_R - 0.012), (x, y + PIPE_R + 0.01, PIPE_Z - PIPE_R * 0.4), (x, y + PIPE_R + 0.01, PIPE_Z + PIPE_R + 0.02)], 0.006, sides=6, d=0.5)
            x += 1.8
    # NVL72 への枝: 配管 → 屋根を抜けて下へ → ボールバルブ → 編組ホース → マニホールドの上
    for xr in nvl_xs:
        for xm, y, fit in ((xr + MAN_IN, SUP_Y, 'fit_blue'), (xr + 0.6 - MAN_IN, RET_Y, 'fit_red')):
            zt = 2.66
            mb.cyl('steel', (xm, y, (PIPE_Z + zt) / 2), 'z', 0.024, PIPE_Z - zt, seg=14)
            mb.cyl('steel', (xm, y, CONT_Z + 0.012), 'z', 0.045, 0.012, seg=16)        # 屋根の貫通の座
            mb.cyl('steel', (xm, y, 2.80), 'z', 0.036, 0.06, seg=16)                   # バルブ
            mb.box('valve' if fit == 'fit_red' else 'tape_blue', xm - 0.01, xm + 0.01, y - 0.11, y, 2.83, 2.845)
            mb.cyl(fit, (xm, y, zt - 0.015), 'z', 0.03, 0.03, seg=16)
            pts = bezier_pts([(xm, y, zt - 0.03), (xm, y, zt - 0.12), (xm, (y + P.ND - 0.05) / 2, P.NH + 0.2), (xm, P.ND - 0.05, P.NH + 0.16), (xm, P.ND - 0.05, P.NH + 0.085)], per=6)
            mb.tube('hose', pts, 0.019, sides=10, d=0.8)
    return mb.finish()


# ------------------------------------------------------------------ CDU の周りの配管
def build_cdu_pipes(M, tops):
    """tops: CDU ごとの上の口の位置（部屋の座標）{'tcs_supply': (x, y, z), ...}"""
    mb = MB('cdu_pipes', M, maxsize=4096, dens={'steel': 420, 'fws': 260, 'insul': 200})
    r = 0.045
    def run(pts, rr=r, mat='steel'):
        mb.tube(mat, [Vector(p) for p in pts], rr, sides=18)
        for p in pts[1:-1]:
            mb.cyl(mat, p, 'z', rr * 1.05, 0.002, seg=18)
    zsH, zrH = 3.55, 3.40
    xs, xr = tops[0]['tcs_supply'][0], CDU_X - 0.15
    flows = {}
    for t in tops:
        sx, sy, sz = t['tcs_supply']; rx, ry, rz = t['tcs_return']
        run([(sx, sy, sz), (sx, sy, zsH - 0.0)])
        run([(rx, ry, rz), (rx, ry, 2.45), (xr, ry, 2.45), (xr, ry, zrH)])
        mb.cyl('steel', (sx, sy, 2.6), 'z', r + 0.02, 0.05, seg=18); mb.box('tape_blue', sx - 0.01, sx + 0.01, sy - 0.12, sy, 2.63, 2.645)
        mb.cyl('steel', (xr, ry, 2.7), 'z', r + 0.02, 0.05, seg=18); mb.box('valve', xr - 0.01, xr + 0.01, ry - 0.12, ry, 2.73, 2.745)
        for z in (2.9, 3.2):
            mb.cyl('tape_blue', (sx, sy, z), 'z', r + 0.002, 0.08, seg=18, caps=False)
            mb.cyl('tape_red', (xr, ry, z), 'z', r + 0.002, 0.08, seg=18, caps=False)
    ysA, ysB = SUP_Y, mirror_y(SUP_Y, HC); yrA, yrB = RET_Y, mirror_y(RET_Y, HC)
    # 行きのヘッダー（3.55）→ 列A・B の行き（3.25）
    run([(xs, ysA - 0.0, PIPE_Z), (xs, ysA, zsH), (xs, ysB, zsH), (xs, ysB, PIPE_Z)], rr=0.06)
    run([(xs, ysA, PIPE_Z), (PIPE_X1, ysA, PIPE_Z)], rr=PIPE_R)
    run([(xs, ysB, PIPE_Z), (PIPE_X1, ysB, PIPE_Z)], rr=PIPE_R)
    # 戻りのヘッダー（3.40）
    run([(xr, yrA, PIPE_Z), (xr, yrA, zrH), (xr, yrB, zrH), (xr, yrB, PIPE_Z)], rr=0.06)
    run([(xr, yrA, PIPE_Z), (PIPE_X1, yrA, PIPE_Z)], rr=PIPE_R)
    run([(xr, yrB, PIPE_Z), (PIPE_X1, yrB, PIPE_Z)], rr=PIPE_R)
    for y, band in ((ysA, 'tape_blue'), (ysB, 'tape_blue'), (yrA, 'tape_red'), (yrB, 'tape_red')):
        mb.cyl(band, (PIPE_X1 + 0.3, y, PIPE_Z), 'x', PIPE_R + 0.002, 0.1, seg=24, caps=False)
    # 施設の水（FWS）: CDU → 上 → 窓の壁を抜けて電気室の天井 → 屋外の冷却器へ
    zf_s, zf_r = 3.65, 3.85
    for t in tops:
        fx, fy, fz = t['fws_supply']; gx, gy, gz = t['fws_return']
        run([(fx, fy, fz), (fx, fy, zf_s)], rr=r, mat='fws')
        run([(gx, gy, gz), (gx, gy, zf_r)], rr=r, mat='fws')
        mb.cyl('steel', (fx, fy, 2.55), 'z', r + 0.02, 0.05, seg=18)
        mb.cyl('steel', (gx, gy, 2.55), 'z', r + 0.02, 0.05, seg=18)
    fxs = tops[0]['fws_supply'][0]; gxs = tops[0]['fws_return'][0]
    ys = sorted(t['fws_supply'][1] for t in tops); yr = sorted(t['fws_return'][1] for t in tops)
    run([(fxs, ys[0], zf_s), (fxs, ys[-1], zf_s)], rr=0.065, mat='fws')
    run([(gxs, yr[0], zf_r), (gxs, yr[-1], zf_r)], rr=0.065, mat='fws')
    ymid_s, ymid_r = FWS_SY, FWS_RY
    fo = fws_outdoor()     # 壁の外の立ち下がりまで。そこから先（屋外）は build_eroom が描く
    run([(fxs, ys[0], zf_s), (fxs, ymid_s, zf_s), (fo['xs'], ymid_s, zf_s)], rr=0.075, mat='fws')
    run([(gxs, yr[0], zf_r), (gxs, ymid_r, zf_r), (fo['xr'], ymid_r, zf_r)], rr=0.075, mat='fws')
    for x in (WALL_X1 - 0.01, WALL_X1 + 0.21, EROOM_X1 - 0.01, EROOM_X1 + 0.21):
        mb.cyl('frame', (x, ymid_s, zf_s), 'x', 0.11, 0.02, seg=18)
        mb.cyl('frame', (x, ymid_r, zf_r), 'x', 0.11, 0.02, seg=18)
    for x in (12.0, 15.0, 17.5):
        mb.cyl('tape_blue', (x, ymid_s, zf_s), 'x', 0.077, 0.1, seg=18, caps=False)
        mb.cyl('tape_red', (x, ymid_r, zf_r), 'x', 0.077, 0.1, seg=18, caps=False)
    # 列C（隣の組。列A を 180° 回した配置）の配管は、窓側の端で天井へ上がる
    for y in (mirror_y(SUP_Y, CC), mirror_y(RET_Y, CC)):
        xe = L - PIPE_X0
        run([(xe - 0.05, y, PIPE_Z), (xe + 0.25, y, PIPE_Z), (xe + 0.25, y, CEIL)], rr=PIPE_R)
        xs0 = L - PIPE_X1
        run([(xs0 + 0.05, y, PIPE_Z), (xs0 - 0.25, y, PIPE_Z), (xs0 - 0.25, y, CEIL)], rr=PIPE_R)
    flows['fws_supply'] = fo['supply'] + [(fxs, ymid_s, zf_s), (fxs, ys[0], zf_s), (fxs, ys[0], 2.15)]
    flows['fws_return'] = [(gxs, yr[0], 2.15), (gxs, yr[0], zf_r), (gxs, ymid_r, zf_r)] + fo['ret']
    return mb.finish(), flows


# ------------------------------------------------------------------ 窓の向こう: 電気室と屋外
def build_eroom(M, rng):
    mb = MB('eroom', M, maxsize=2048, dens={'ups': 300, 'ups_a': 300, 'ups_b': 300, 'ups_c': 300, 'eroom_floor': 120, 'ups_dark': 400, 'wall': 80, 'wall_y': 80, 'conc': 120, 'deck': 40, 'galv': 150, 'ground': 40, 'fan_grill': 300})
    x0, x1, y0, y1, H = WALL_X1 + 0.2, EROOM_X1, -2.6, 4.6, 4.0
    mb.quad('eroom_floor', [(x0, y0, 0), (x1, y0, 0), (x1, y1, 0), (x0, y1, 0)], d=1.0)
    # 床の目地（1.5 m ごとの切り込み）と、盤の足元の黒ずみ
    zl = 0.0008
    xx = x0 + 1.5
    while xx < x1:
        mb.box('ups_dark', xx - 0.003, xx + 0.003, y0, y1, 0, zl, skip='z', d=0.3)
        xx += 1.5
    yy = y0 + 1.2
    while yy < y1:
        mb.box('ups_dark', x0, x1, yy - 0.003, yy + 0.003, 0, zl, skip='z', d=0.3)
        yy += 1.5
    mb.box('deck', x0, x1, y0, y1, H, H + 0.05, skip='Z')
    mb.box('wall', x0, x1, y0 - 0.2, y0, 0, H, skip='y'); mb.box('wall', x0, x1, y1, y1 + 0.2, 0, H, skip='Y')
    wy0, wy1, wz0, wz1 = -0.4, 3.4, 0.9, 2.9
    t = 0.2
    for a, b, c, d in ((y0, wy0, 0, H), (wy1, y1, 0, H), (wy0, wy1, 0, wz0), (wy0, wy1, wz1, H)):
        mb.box('wall_y', x1, x1 + t, a, b, c, d)
    for a, b, c, d in ((wy0, wy0 + 0.06, wz0, wz1), (wy1 - 0.06, wy1, wz0, wz1), (wy0, wy1, wz0, wz0 + 0.06), (wy0, wy1, wz1 - 0.06, wz1), (1.47, 1.53, wz0, wz1)):
        mb.box('contain_frame', x1 - 0.02, x1 + t + 0.02, a, b, c, d)
    # UPS と配電盤の列（左右の壁際、通路を向く）。板ごとに塗りの明るさを変え、扉に表示窓・銘板・換気口
    finishes = ('ups_a', 'ups_b', 'ups_c')
    for side, yb in ((1, y0 + 0.1), (-1, y1 - 0.1)):
        x = x0 + 0.6
        n = 0
        while x + 0.8 < x1 - 0.5:
            ya, yb2 = (yb, yb + 0.9) if side > 0 else (yb - 0.9, yb)
            yf = yb2 if side > 0 else ya       # 正面の y
            sgn = side
            def front(mat, xa, xb, za, zb, dep=0.003, d=1.0):
                mb.box(mat, x + xa, x + xb, yf, yf + sgn * dep, za, zb, d=d)
            fin = finishes[rng.randrange(3)]
            mb.box(fin, x + 0.004, x + 0.796, ya, yb2, 0.1, 2.0)
            mb.box('ups_dark', x, x + 0.8, ya, yb2, 0.0, 0.1)
            mb.box(finishes[rng.randrange(3)], x, x + 0.8, ya - 0.01, yb2 + 0.01, 2.0, 2.06)
            front('ups_dark', 0.0, 0.004, 0.1, 2.0, 0.001)               # 盤と盤の継ぎ目
            front('ups_dark', 0.398, 0.402, 0.12, 1.98, 0.001)           # 両開きの扉の合わせ目
            if n % 3 == 0:     # 表示とボタン
                front('screen', 0.25, 0.55, 1.45, 1.65, 0.004)
            else:              # 小さな表示窓（計器）と表示灯
                front('frame', 0.08, 0.26, 1.49, 1.63, 0.004)
                front('screen', 0.095, 0.245, 1.505, 1.615, 0.006)
                for k, lm in enumerate(('led_g', 'led_g', 'tape_red')):
                    front(lm, 0.10 + k * 0.05, 0.125 + k * 0.05, 1.40, 1.425, 0.006)
            front('label', 0.08, 0.32, 1.86, 1.93, 0.002)                # 銘板
            front('tray', 0.60, 0.66, 1.86, 1.92, 0.002)                 # 注意の黄色いシール
            for k in range(5):                                           # 上の換気口
                front('ups_dark', 0.45, 0.72, 1.62 + k * 0.04, 1.64 + k * 0.04)
            for k in range(3):
                front('ups_dark', 0.1, 0.7, 0.25 + k * 0.12, 0.30 + k * 0.12)
            for hx in (0.34, 0.44):                                      # 取っ手（両開き）
                front('handle', hx, hx + 0.02, 0.9, 1.2, 0.03)
            front('led_g', 0.1, 0.12, 1.8, 1.82)
            # 盤の上からケーブルラックへ上がる太いケーブル（バスウェイが上を通る盤は除く）
            for c in range(0 if (side > 0 and n == 0) else 4):
                cx = x + 0.2 + c * 0.13 + rng.uniform(-0.02, 0.02)
                yc = (ya + yb2) / 2 + rng.uniform(-0.15, 0.15)
                pts = bezier_pts([(cx, yc, 2.06), (cx, yc, 2.6), (cx + rng.uniform(-0.05, 0.05), ERACK[side] + rng.uniform(-0.1, 0.1), 3.0),
                                  (cx + rng.uniform(-0.05, 0.05), ERACK[side] + rng.uniform(-0.12, 0.12), 3.16)], per=6)
                mb.tube('cord', pts, 0.018, sides=8, d=0.6, rnd=rng.random())
            x += 0.8; n += 1
    # 天井のケーブルラック（はしご形、盤の列の上）と中のケーブル、吊りボルト
    for side in (1, -1):
        yc = ERACK[side]
        xa = x0 + 1.35 if side > 0 else x0      # 列の側はバスウェイの立ち上がりを避ける
        for yy in (yc - 0.3, yc + 0.3):
            mb.box('galv', xa, x1 - 0.1, yy - 0.004, yy + 0.004, 3.12, 3.22, d=0.6)
        xx = xa + 0.1
        while xx < x1 - 0.1:
            mb.box('galv', xx, xx + 0.03, yc - 0.3, yc + 0.3, 3.12, 3.14, d=0.4)
            xx += 0.3
        xx = xa + 0.4
        while xx < x1:
            for yy in (yc - 0.33, yc + 0.33):
                mb.box('steel', xx - 0.006, xx + 0.006, yy - 0.006, yy + 0.006, 3.1, H, d=0.2)
            mb.box('galv', xx - 0.02, xx + 0.02, yc - 0.36, yc + 0.36, 3.08, 3.12, d=0.4)
            xx += 1.5
        for k in range(9):
            yy = yc - 0.25 + k * 0.0625 + rng.uniform(-0.01, 0.01)
            mb.tube('cord', [(xa, yy, 3.16 + rng.uniform(0, 0.02)), ((xa + x1) / 2, yy + rng.uniform(-0.02, 0.02), 3.165), (x1 - 0.1, yy, 3.16)],
                    0.016, sides=8, d=0.5, rnd=rng.random())
        # 配電盤の上のバスウェイの立ち上がり
    for yy in (0.85, mirror_y(0.85, HC), mirror_y(0.85, CC)):
        mb.box('bus', x0 - 0.2, x0 + 1.2, yy - 0.07, yy + 0.07, 2.42, 2.55)
        mb.box('bus', x0 + 1.06, x0 + 1.2, yy - 0.07, yy + 0.07, 2.55, H)
    # 天井の照明
    for yy in (-0.5, 3.0):
        for k in range(3):
            xx = x0 + 0.6 + k * 1.9
            mb.box('lamp_body', xx, xx + 1.2, yy - 0.05, yy + 0.05, H - 0.1, H - 0.04)
            mb.box('lamp', xx + 0.01, xx + 1.19, yy - 0.04, yy + 0.04, H - 0.102, H - 0.1, skip='Z')
    # 屋外: 地面・フルードクーラー・塀・向かいの建物
    ox = x1 + 0.2
    mb.quad('ground', [(ox, -30, 0), (ox + 60, -30, 0), (ox + 60, 40, 0), (ox, 40, 0)], d=0.4)
    mb.box('wall_y', ox, ox + 0.3, -30, wy0 - 0.5, 0, 6.0, d=0.2)       # 建物の外壁（窓の左右）
    mb.box('wall_y', ox, ox + 0.3, wy1 + 0.5, 40, 0, 6.0, d=0.2)
    # フルードクーラー 3 台: 亜鉛めっきの箱（側面にコイル）の上に、上向きのファンが 6 つ並ぶ
    h = 2.6
    for cy in COOLER_YS:
        cx0, cx1 = COOLER_X0, COOLER_X0 + 12.0
        mb.box('galv', cx0, cx1, cy - 1.15, cy + 1.15, 0.5, h, d=1.0)
        mb.box('frame', cx0, cx1, cy - 1.2, cy + 1.2, 0.0, 0.5, d=0.6)
        mb.box('galv', cx0 - 0.03, cx1 + 0.03, cy - 1.18, cy + 1.18, h, h + 0.05)      # 上の縁
        for k in range(6):            # 上のファン（筒・丸い網・真ん中のモーター）
            fx = cx0 + 1.0 + k * 2.0
            mb.cyl('galv', (fx, cy, h + 0.32), 'z', 0.95, 0.55, seg=32, d=1.0, caps=False)
            mb.cyl('galv', (fx, cy, h + 0.6), 'z', 0.98, 0.04, seg=32, d=0.6, caps=False)
            mb.cyl('fan_grill', (fx, cy, h + 0.585), 'z', 0.94, 0.01, seg=32, d=1.0)
            mb.cyl('black', (fx, cy, h + 0.5), 'z', 0.16, 0.12, seg=16, d=0.5)
            mb.box('galv', fx + 0.99, fx + 1.01, cy - 1.15, cy + 1.15, h + 0.05, h + 0.4)  # ファンの間の仕切り
        for k in range(12):           # 側面のコイルの筋
            mb.box('ups_dark', cx0 + 0.2 + k * 0.98, cx0 + 1.0 + k * 0.98, cy - 1.151, cy + 1.151, 0.7, h - 0.2)
        for k in range(7):            # 側面の柱（ファン 1 つごとの区切り）
            xk = cx0 + k * 2.0
            mb.box('galv', xk - 0.04, xk + 0.04, cy - 1.17, cy + 1.17, 0.5, h)
    # 施設の水の配管（屋外）: 壁の外で立ち下がり、架台の上を通ってクーラーの前の母管で 3 台に分かれる
    fo = fws_outdoor()
    rp = 0.075
    def prun(pts, r=rp):
        mb.tube('fws', [Vector(q) for q in pts], r, sides=16, d=0.5, rnd=0.4)
        for q in pts[1:-1]:
            mb.cyl('fws', q, 'z', r * 1.06, 0.002, seg=16, d=0.3, rnd=0.4)
    prun(fo['supply'][1:])
    prun(fo['ret'][:-1])
    for q in (fo['supply'][-1], fo['ret'][0]):     # 天井から出てきた管との角
        mb.cyl('fws', q, 'z', rp * 1.06, rp * 2.0, seg=16, d=0.3, rnd=0.4)
    for cy in COOLER_YS:              # 母管 → 各クーラーの口（行きは下、戻りは上）
        prun([(fo['hs'], cy, fo['zs']), (COOLER_X0, cy, fo['zs'])])
        prun([(fo['hr'], cy, fo['zr']), (COOLER_X0, cy, fo['zr'])])
        for z in (fo['zs'], fo['zr']):
            mb.cyl('steel', (COOLER_X0 - 0.05, cy, z), 'x', rp + 0.05, 0.03, seg=18, d=0.4)
            mb.cyl('steel', (COOLER_X0 - 0.35, cy, z), 'x', rp + 0.03, 0.08, seg=18, d=0.4)     # 仕切り弁
            mb.cyl('steel', (COOLER_X0 - 0.35, cy, z + 0.14), 'z', 0.012, 0.16, seg=8, d=0.3)
            mb.box('valve', COOLER_X0 - 0.36, COOLER_X0 - 0.34, cy - 0.16, cy + 0.16, z + 0.22, z + 0.24, d=0.3)
    ys_all = (COOLER_YS[0], COOLER_YS[-1])
    prun([(fo['hs'], ys_all[0], fo['zs']), (fo['hs'], ys_all[1], fo['zs'])], r=0.09)
    prun([(fo['hr'], ys_all[0], fo['zr']), (fo['hr'], ys_all[1], fo['zr'])], r=0.09)
    for x, y, z, band in ((fo['xs'], FWS_SY, 1.6, 'tape_blue'), (fo['xr'], FWS_RY, 2.8, 'tape_red'),
                          (25.0, FWS_SY, fo['zs'], 'tape_blue'), (25.0, FWS_RY, fo['zr'], 'tape_red')):
        axis = 'z' if x in (fo['xs'], fo['xr']) and z not in (fo['zs'], fo['zr']) else 'x'
        mb.cyl(band, (x, y, z), axis, rp + 0.003, 0.12, seg=16, caps=False, d=0.4, rnd=0.5)
    # 架台（門形の鉄骨、3 m ごと）と、立ち下がりを壁に留める腕、母管の下の受け
    xk = fo['xs'] + 1.2
    while xk < fo['hr'] - 0.5:
        for yy in (FWS_SY - 0.3, FWS_RY + 0.3):
            mb.box('galv', xk - 0.05, xk + 0.05, yy - 0.05, yy + 0.05, 0.0, fo['zr'] - rp, d=0.4)
            mb.box('ground', xk - 0.2, xk + 0.2, yy - 0.2, yy + 0.2, 0.0, 0.12, d=0.3)
        for z in (fo['zs'] - rp, fo['zr'] - rp):
            mb.box('galv', xk - 0.05, xk + 0.05, FWS_SY - 0.35, FWS_RY + 0.35, z - 0.08, z, d=0.4)
        xk += 3.0
    for x, y, z in ((fo['xs'], FWS_SY, 3.0), (fo['xr'], FWS_RY, 3.2)):
        mb.box('galv', x1 + 0.2, x + 0.1, y - 0.04, y + 0.04, z - 0.06, z, d=0.4)
    for cy in COOLER_YS + (FWS_SY,):
        for x, z in ((fo['hs'], fo['zs']), (fo['hr'], fo['zr'])):
            mb.box('galv', x - 0.05, x + 0.05, cy + 0.25, cy + 0.35, 0.0, z - rp, d=0.4)
            mb.box('galv', x - 0.05, x + 0.05, cy + 0.15, cy + 0.45, z - rp - 0.06, z - rp, d=0.4)
    mb.box('ground', ox + 2.0, ox + 2.25, -30, 40, 0, 0.25, d=0.3)    # 縁石
    for k in range(-6, 9):                                            # 低い柵
        mb.box('galv', ox + 2.1, ox + 2.14, k * 3.0, k * 3.0 + 0.04, 0.25, 1.2, d=0.3)
    mb.box('galv', ox + 2.1, ox + 2.14, -18, 27, 1.15, 1.2, d=0.3)
    for k in range(4):
        mb.box('sky_wall', ox + 40 + k * 5, ox + 44 + k * 5, -30 + k * 14, -20 + k * 14, 0, 9 + k * 2, d=0.1)
    return mb.finish()
