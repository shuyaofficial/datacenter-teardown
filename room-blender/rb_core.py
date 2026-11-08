# 部屋づくりの土台: 形を足していく MeshBuilder と、焼き込み用 UV の詰め込み。
# 箱・円柱・管を作るときに、面ごとの UV（実寸 m × 画素密度）を同時に作り、最後に棚詰めで1枚の画像へ並べる。
# こうすると (a) 細い光ファイバも最低 3 画素の幅を持ち黒く焼けない、(b) 前面の穴の多い面だけ画素を多く割り当てられる。
import bpy, bmesh, math, random
from mathutils import Vector

# 材質ごとの画素密度（画素/m）。値は「上限いっぱいのときの目標」。画像が 4096 を超える分は全体を同じ比で縮める。
DENS = {
    'perf_gold': 2600, 'perf_sw': 2600, 'psu': 2600, 'perf_dark': 2200, 'drive': 2200,
    'cage': 1800, 'osfp': 1800, 'boot': 1500, 'hole': 900, 'handle': 1200, 'label': 1500,
    'led_g': 900, 'led_b': 900, 'led_a': 900, 'tray_plate': 1400, 'screen': 1400,
    'frame': 320, 'frame_in': 120, 'fiber_y': 500, 'fiber_a': 500, 'hose': 700,
    'fit_red': 900, 'fit_blue': 900, 'steel': 700, 'copper': 900, 'cartridge': 1200,
    'black': 500, 'rubber': 500,
}
DEFAULT_DENS = 400
MIN_PX = 3.0      # 島の最小の幅（画素）
MARGIN = 3        # 島と島のすき間（画素）


class MB:
    """1つのメッシュ（=1枚の焼き込み画像）を作る。材質ごとにスロットを持つ。"""

    def __init__(self, name, mats, dens=None, maxsize=4096, minsize=256):
        self.name, self.M = name, mats
        self.dens = dict(DENS, **(dens or {}))
        self.maxsize, self.minsize = maxsize, minsize
        self.bm = bmesh.new()
        self.uv = self.bm.loops.layers.uv.new('bake')
        self.rnd = self.bm.faces.layers.float.new('rnd')
        self.slots = []
        self.islands = []   # (faces, [[(u, v) per loop] per face], w, h)  単位は画素/m を掛けたもの

    def slot(self, mat):
        if mat not in self.slots:
            self.slots.append(mat)
        return self.slots.index(mat)

    def _d(self, mat, d):
        return self.dens.get(mat, DEFAULT_DENS) * d

    # ---- 面の追加 ----
    def _rect_island(self, face, d):
        """長方形（または平らな多角形）の面を1つの島にする。面の2辺の向きで平面に投影。"""
        vs = [l.vert.co for l in face.loops]
        e1 = (vs[1] - vs[0]); n = face.normal
        if e1.length < 1e-9:
            e1 = Vector((1, 0, 0))
        e1 = e1.normalized(); e2 = n.cross(e1).normalized()
        if n.z < -0.5:
            d *= 0.35            # 下を向く面はほとんど見えない
        uvs = [((v - vs[0]).dot(e1) * d, (v - vs[0]).dot(e2) * d) for v in vs]
        u0 = min(u for u, _ in uvs); v0 = min(v for _, v in uvs)
        uvs = [(u - u0, v - v0) for u, v in uvs]
        w = max(u for u, _ in uvs); h = max(v for _, v in uvs)
        self.islands.append(([face], [uvs], w, h))

    def box(self, mat, x0, x1, y0, y1, z0, z1, d=1.0, skip='', rnd=None):
        """skip: 省く面。x=-x 面, X=+x 面, y, Y, z, Z。見えない面を省いて画素を節約する。"""
        bm = self.bm; si = self.slot(mat); dd = self._d(mat, d)
        x0, x1 = min(x0, x1), max(x0, x1); y0, y1 = min(y0, y1), max(y0, y1); z0, z1 = min(z0, z1), max(z0, z1)
        v = {}
        for i, x in enumerate((x0, x1)):
            for j, y in enumerate((y0, y1)):
                for k, z in enumerate((z0, z1)):
                    v[i, j, k] = bm.verts.new((x, y, z))
        faces = {
            'x': (v[0, 0, 0], v[0, 0, 1], v[0, 1, 1], v[0, 1, 0]),
            'X': (v[1, 0, 0], v[1, 1, 0], v[1, 1, 1], v[1, 0, 1]),
            'y': (v[0, 0, 0], v[1, 0, 0], v[1, 0, 1], v[0, 0, 1]),
            'Y': (v[0, 1, 0], v[0, 1, 1], v[1, 1, 1], v[1, 1, 0]),
            'z': (v[0, 0, 0], v[0, 1, 0], v[1, 1, 0], v[1, 0, 0]),
            'Z': (v[0, 0, 1], v[1, 0, 1], v[1, 1, 1], v[0, 1, 1]),
        }
        r = random.random() if rnd is None else rnd
        for key, q in faces.items():
            if key in skip:
                continue
            f = bm.faces.new(q); f.material_index = si; f[self.rnd] = r; f.smooth = False
            f.normal_update()
            self._rect_island(f, dd)

    def quad(self, mat, pts, d=1.0, rnd=None):
        f = self.bm.faces.new([self.bm.verts.new(p) for p in pts])
        f.material_index = self.slot(mat); f[self.rnd] = random.random() if rnd is None else rnd
        f.normal_update(); self._rect_island(f, self._d(mat, d))
        return f

    def tube(self, mat, pts, r, sides=6, d=1.0, caps=False, rnd=None, smooth=True):
        """点の列に沿った管。UV は1本の帯（長さ方向 × 周方向）。"""
        bm = self.bm; si = self.slot(mat); dd = self._d(mat, d)
        pts = [Vector(p) for p in pts]
        n = len(pts)
        if n < 2:
            return
        rr = random.random() if rnd is None else rnd
        # 平行移動フレーム
        t0 = (pts[1] - pts[0]).normalized()
        ref = Vector((0, 0, 1)) if abs(t0.z) < 0.9 else Vector((1, 0, 0))
        nrm = t0.cross(ref).normalized()
        rings = []; lens = [0.0]
        prev_t = t0
        for i in range(n):
            if i == 0:
                t = t0
            elif i == n - 1:
                t = (pts[i] - pts[i - 1]).normalized()
            else:
                t = (pts[i + 1] - pts[i - 1]).normalized()
            if t.length < 1e-9:
                t = prev_t
            # フレームを回して運ぶ
            axis = prev_t.cross(t)
            if axis.length > 1e-8:
                ang = prev_t.angle(t)
                from mathutils import Matrix
                nrm = Matrix.Rotation(ang, 3, axis.normalized()) @ nrm
            prev_t = t
            b = t.cross(nrm).normalized()
            ring = [bm.verts.new(pts[i] + (nrm * math.cos(2 * math.pi * k / sides) + b * math.sin(2 * math.pi * k / sides)) * r)
                    for k in range(sides)]
            rings.append(ring)
            if i:
                lens.append(lens[-1] + (pts[i] - pts[i - 1]).length)
        circ = 2 * math.pi * r
        # 周方向は最低 MIN_PX 画素になるよう後で拡大（島の高さを cvh として記録）
        faces, uvl = [], []
        for i in range(n - 1):
            for k in range(sides):
                k2 = (k + 1) % sides
                f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k]))   # 法線は外向き
                f.material_index = si; f[self.rnd] = rr; f.smooth = smooth
                u0, u1 = lens[i] * dd, lens[i + 1] * dd
                v0, v1 = circ * k / sides * dd, circ * (k + 1) / sides * dd
                faces.append(f); uvl.append([(u0, v0), (u0, v1), (u1, v1), (u1, v0)])
        self.islands.append((faces, uvl, lens[-1] * dd, circ * dd))
        if caps:
            for ring in (rings[0], rings[-1][::-1]):
                f = bm.faces.new(ring[::-1]); f.material_index = si; f[self.rnd] = rr; f.normal_update()
                self._rect_island(f, dd)

    def cyl(self, mat, p, axis, r, length, seg=16, d=1.0, caps=True, rnd=None):
        p = Vector(p); a = {'x': Vector((1, 0, 0)), 'y': Vector((0, 1, 0)), 'z': Vector((0, 0, 1))}[axis] if isinstance(axis, str) else Vector(axis).normalized()
        self.tube(mat, [p - a * length / 2, p + a * length / 2], r, sides=seg, d=d, caps=caps, rnd=rnd)

    # ---- 仕上げ ----
    def _pack(self, k, S, dims):
        """棚詰め。入れば各島の左下(画素)を返す。入らなければ None。"""
        x = y = shelf = 0.0
        pos = [None] * len(dims)
        for idx in self._order:
            w, h = dims[idx]
            w = max(MIN_PX, w * k) + MARGIN; h = max(MIN_PX, h * k) + MARGIN
            if w > S or h > S:
                return None
            if x + w > S:
                y += shelf; x = 0.0; shelf = 0.0
            if y + h > S:
                return None
            pos[idx] = (x, y)
            x += w; shelf = max(shelf, h)
        return pos

    def finish(self, smooth_angle=None):
        """UV を確定し、メッシュを返す。画像の大きさは mesh['atlas'] に入れる。"""
        isl = self.islands
        dims, rot = [], []
        for _, _, w, h in isl:
            r = h > w
            rot.append(r); dims.append((h, w) if r else (w, h))
        tot = sum(max(MIN_PX, w) * max(MIN_PX, h) for w, h in dims)
        S = 2 ** max(int(math.log2(self.minsize)), min(int(math.log2(self.maxsize)), math.ceil(math.log2(math.sqrt(tot / 0.62) + 1))))
        self._order = sorted(range(len(dims)), key=lambda i: -dims[i][1])
        # 入る範囲で密度を上げる（目標の 1.6 倍まで）。余った画素を細部に回す
        lo, hi = 0.0, 1.6
        pos = self._pack(hi, S, dims)
        if pos is None:
            for _ in range(22):
                mid = (lo + hi) / 2
                p = self._pack(mid, S, dims)
                if p is None:
                    hi = mid
                else:
                    lo, pos = mid, p
            k = lo
        else:
            k = hi
        if pos is None:
            raise RuntimeError('UV が入らない: ' + self.name)
        for i, (faces, uvl, w, h) in enumerate(isl):
            ox, oy = pos[i]; ox += MARGIN / 2; oy += MARGIN / 2
            W, H = dims[i]
            sx = max(MIN_PX, W * k) / max(W * k, 1e-9) if W * k < MIN_PX else 1.0
            sy = max(MIN_PX, H * k) / max(H * k, 1e-9) if H * k < MIN_PX else 1.0
            for f, uvs in zip(faces, uvl):
                for loop, (u, v) in zip(f.loops, uvs):
                    if rot[i]:
                        u, v = v, u
                    loop[self.uv].uv = ((ox + u * k * sx) / S, (oy + v * k * sy) / S)
        me = bpy.data.meshes.new(self.name)
        self.bm.normal_update(); self.bm.to_mesh(me); self.bm.free()
        for m in self.slots:
            me.materials.append(self.M[m])
        me['atlas'] = S
        me['texel_k'] = k
        return me


def place(name, me, loc=(0, 0, 0), rotz=0.0, scale=(1, 1, 1), coll=None):
    ob = bpy.data.objects.new(name, me)
    ob.location = loc; ob.rotation_euler = (0, 0, rotz); ob.scale = scale
    (coll or bpy.context.scene.collection).objects.link(ob)
    return ob


def bezier_pts(ctrl, per=8):
    """制御点を Catmull-Rom で滑らかにつないだ点列。"""
    P = [Vector(p) for p in ctrl]
    if len(P) < 3:
        return P
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(per):
            t = s / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(P[-2])
    return out
