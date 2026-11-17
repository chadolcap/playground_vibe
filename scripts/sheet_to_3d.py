# 4방향 캐릭터 시트(분할본) → Blender 3D 모델
# 형상: 정면·측면 실루엣으로 높이별 단면(초타원)을 로프팅
# 텍스처: 원본 4장을 정면/후면/좌/우에서 투영해 법선 방향으로 블렌딩
# 사용: exec 전에 SRC, NAME 전역 변수를 지정 (기본값은 man_1)
import bpy, bmesh, math, os
import numpy as np

SRC = globals().get("SRC", r"D:\work\study\playground_vibe\image\제작\4포즈\sheet_split\man_1")
NAME = globals().get("NAME", "man_1")
OUT = SRC + "_3d"
HEIGHT = 1.0          # 캐릭터 전체 높이(Blender 단위)
DZ = 1.0 / 400        # 단면 간격
SEG = 48              # 단면당 점 개수
ARM_DY = 0.03         # 팔 중심의 뒤쪽 오프셋(측면 몸통 중심 기준)
os.makedirs(OUT, exist_ok=True)


def loadRgba(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    a = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(a)
    bpy.data.images.remove(img)
    return a.reshape(h, w, 4)[::-1].copy()  # 위쪽 행이 0번


def shift(m, dy, dx):
    r = np.zeros_like(m)
    h, w = m.shape[:2]
    r[max(dy, 0):h + min(dy, 0), max(dx, 0):w + min(dx, 0)] = \
        m[max(-dy, 0):h + min(-dy, 0), max(-dx, 0):w + min(-dx, 0)]
    return r


def bleedColors(rgb, m, iters=80):
    # 배경을 가장자리 색으로 채워 투영 경계에 흰색이 묻지 않게 함
    known = m.copy()
    col = rgb * known[..., None]
    for _ in range(iters):
        acc = np.zeros_like(col)
        cnt = np.zeros(m.shape, np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            acc += shift(col, dy, dx)
            cnt += shift(known.astype(np.float32), dy, dx)
        new = (~known) & (cnt > 0)
        if not new.any():
            break
        col[new] = acc[new] / cnt[new][:, None]
        known |= new
    col[~known] = col[known].mean(0)
    return col


def saveImage(name, rgb):
    h, w = rgb.shape[:2]
    rgba = np.concatenate([rgb, np.ones((h, w, 1), np.float32)], 2)[::-1]
    old = bpy.data.images.get(name)
    if old:
        bpy.data.images.remove(old)
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(rgba.ravel())
    img.filepath_raw = os.path.join(OUT, name + ".png")
    img.file_format = "PNG"
    img.save()
    return img


def intervals(m, r, minlen=4):
    if r < 0 or r >= m.shape[0]:
        return []
    d = np.diff(np.concatenate([[0], m[r].astype(np.int8), [0]]))
    s = np.where(d == 1)[0]
    e = np.where(d == -1)[0] - 1
    return [(int(a), int(b)) for a, b in zip(s, e) if b - a >= minlen]


# ---------- 이미지 로드·마스크·보정 ----------
views = {}
for key in ("front", "back", "side_left", "side_right"):
    rgba = loadRgba(os.path.join(SRC, key + ".png"))
    rgb = rgba[..., :3]
    lum = rgb @ np.array([0.299, 0.587, 0.114], np.float32)
    m = lum < 0.92
    # 누끼 외곽의 밝은 점선이 색 채우기에 섞이지 않도록 4px 안쪽 색만 사용
    core = m.copy()
    for _ in range(4):
        core = core & shift(core, 1, 0) & shift(core, -1, 0) & shift(core, 0, 1) & shift(core, 0, -1)
    rows = np.where(m.any(1))[0]
    top, bot = int(rows[0]), int(rows[-1])
    S = (bot - top) / HEIGHT
    rr = int(round(bot - 0.2 * S))
    cols = np.where(m[rr])[0]
    c = (cols[0] + cols[-1]) / 2.0
    bleed = bleedColors(rgb, core)
    img = saveImage(f"{NAME}_{key}_bleed", bleed)
    views[key] = dict(m=m, top=top, bot=bot, S=S, c=c, w=m.shape[1], h=m.shape[0], img=img, rgb=rgb, bleed=bleed)
    print(key, "top", top, "bot", bot, "S", round(S, 1), "c", c)

F, SR = views["front"], views["side_right"]


def rowOf(v, z):
    return int(round(v["bot"] - z * v["S"]))


def fx(u):  # 정면 px → X
    return (u - F["c"]) / F["S"]


def sy(u):  # 오른쪽 측면 px → Y (이미지 오른쪽 = 캐릭터 앞 = -Y)
    return -(u - SR["c"]) / SR["S"]


def sideMain(z):
    iv = intervals(SR["m"], rowOf(SR, z))
    return max(iv, key=lambda p: p[1] - p[0]) if iv else None


zs = np.arange(0.0, 1.0 + 1e-9, DZ)
cpx = F["c"]

# 목: 0.5~0.75 구간에서 정면 폭이 가장 좁은 높이
best = None
for z in zs[(zs > 0.5) & (zs < 0.75)]:
    iv = intervals(F["m"], rowOf(F, z))
    if iv:
        wdt = iv[-1][1] - iv[0][0]
        if best is None or wdt < best[1]:
            best = (z, wdt)
z_neck = best[0]

# 가랑이: 위에서 내려오며 중심선이 처음 비는 높이
z_crotch = None
for z in zs[(zs < 0.45) & (zs > 0.08)][::-1]:
    iv = intervals(F["m"], rowOf(F, z))
    if iv and not any(a <= cpx <= b for a, b in iv):
        z_crotch = z
        break
hip = [p for p in intervals(F["m"], rowOf(F, z_crotch + 0.02)) if p[0] <= cpx <= p[1]][0]
xl, xr = hip[0] - 3, hip[1] + 3

# 손: 엉덩이 폭 바깥에 따로 떨어진 구간
hands = {"L": {}, "R": {}}
for z in zs[(zs < z_crotch + 0.2) & (zs > 0.05)]:
    for a, b in intervals(F["m"], rowOf(F, z)):
        if b < xl:
            hands["L"][z] = (a, b)
        elif a > xr:
            hands["R"][z] = (a, b)
print("z_neck", round(z_neck, 3), "z_crotch", round(z_crotch, 3), "hip", hip)

# 가슴 앞 최대값(측면) → 힙색 돌출 제한
chest = [sideMain(z)[1] for z in zs[(zs > z_neck - 0.2) & (zs < z_neck - 0.08)] if sideMain(z)]
front_cap = max(chest) + 0.035 * SR["S"]


def smooth(arr, k=9):
    if len(arr) < k:
        return arr
    pad = k // 2
    a = np.pad(np.asarray(arr, float), (pad, pad), mode="edge")
    return np.convolve(a, np.ones(k) / k, mode="valid")


def buildLoft(name, rings, n_exp, mat, k=9):
    rings = [r for r in rings if r[3] > 1e-3 and r[4] > 1e-3]
    if len(rings) < 3:
        return None
    rings.sort(key=lambda r: r[0])
    cols = list(zip(*rings))
    zz = cols[0]
    cx, cy, a, b = (smooth(c, k) for c in cols[1:])
    bm = bmesh.new()
    prev = first = None
    for i, z in enumerate(zz):
        ring = []
        for j in range(SEG):
            t = 2 * math.pi * j / SEG
            ct, st = math.cos(t), math.sin(t)
            x = cx[i] + a[i] * math.copysign(abs(ct) ** (2 / n_exp), ct)
            y = cy[i] + b[i] * math.copysign(abs(st) ** (2 / n_exp), st)
            ring.append(bm.verts.new((x, y, z)))
        if prev:
            for j in range(SEG):
                bm.faces.new((prev[j], prev[(j + 1) % SEG], ring[(j + 1) % SEG], ring[j]))
        else:
            first = ring
        prev = ring
    for ring, zc, i in ((first, zz[0], 0), (prev, zz[-1], -1)):
        cv = bm.verts.new((cx[i], cy[i], zc))
        for j in range(SEG):
            bm.faces.new((ring[j], ring[(j + 1) % SEG], cv))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    return ob


# ---------- 투영 재질 ----------
def buildMaterial(suffix="projection", masks=None, fallback=None, front_bias=1.0, power=8.0, front_power=None,
                  front_scale=1.0):
    # front_scale < 1: 정면 그림을 가로로 넓게 펴서 투영 (그림 속 얼굴이 3D 머리보다 좁을 때 윤곽을 가장자리로 밀어냄)
    # masks: 시점별 "팔이 가리는 영역" 이미지 → 그 영역은 해당 시점 색을 쓰지 않음
    # fallback: 어느 시점에서도 안 보이는 면(팔에 가려진 몸통 옆)에 채울 선형 RGB
    # front_bias: 정면 그림 가중치 배율 (얼굴에서 측면 눈이 섞이는 구간을 줄임)
    name = f"{NAME}_{suffix}"
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    N = nt.nodes.new
    L = nt.links.new
    tc = N("ShaderNodeTexCoord")
    sp = N("ShaderNodeSeparateXYZ")
    L(tc.outputs["Object"], sp.inputs[0])
    geo = N("ShaderNodeNewGeometry")
    sn0 = N("ShaderNodeSeparateXYZ")
    L(geo.outputs["Normal"], sn0.inputs[0])
    # 수평 성분만 정규화 → 위/아래를 향한 면(정수리·어깨)도 가장 가까운 시점 색을 받음
    hz = N("ShaderNodeCombineXYZ")
    L(sn0.outputs["X"], hz.inputs[0])
    L(sn0.outputs["Y"], hz.inputs[1])
    nrm = N("ShaderNodeVectorMath")
    nrm.operation = "NORMALIZE"
    L(hz.outputs[0], nrm.inputs[0])
    sn = N("ShaderNodeSeparateXYZ")
    L(nrm.outputs[0], sn.inputs[0])

    def math_(op, a, b=None, c=None):
        n = N("ShaderNodeMath")
        n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L(v, n.inputs[i])
        return n.outputs[0]

    # (키, 좌표축, 부호, 법선축, 법선부호)
    spec = [("front", "X", 1, "Y", -1), ("back", "X", -1, "Y", 1),
            ("side_right", "Y", -1, "X", -1), ("side_left", "Y", 1, "X", 1)]
    acc = None
    wsum = None
    for key, ax, sg, nax, nsg in spec:
        v = views[key]
        sx = front_scale if key == "front" else 1.0
        u = math_("MULTIPLY_ADD", sp.outputs[ax], sg * v["S"] * sx / v["w"], v["c"] / v["w"])
        vv = math_("MULTIPLY_ADD", sp.outputs["Z"], v["S"] / v["h"], (v["h"] - v["bot"]) / v["h"])
        cmb = N("ShaderNodeCombineXYZ")
        L(u, cmb.inputs[0])
        L(vv, cmb.inputs[1])
        tex = N("ShaderNodeTexImage")
        tex.image = v["img"]
        tex.extension = "EXTEND"
        L(cmb.outputs[0], tex.inputs[0])
        # 지수가 클수록 시점 간 섞이는 구간이 좁아짐(옆얼굴에 정면 눈이 번지는 현상 감소)
        pw = front_power if (key == "front" and front_power is not None) else power
        w = math_("POWER", math_("MAXIMUM", math_("MULTIPLY", sn.outputs[nax], float(nsg)), 0.0), pw)
        if key == "front" and front_bias != 1.0:
            w = math_("MULTIPLY", w, front_bias)
        if masks and key in masks:
            mt = N("ShaderNodeTexImage")
            mt.image = masks[key]
            mt.extension = "EXTEND"
            L(cmb.outputs[0], mt.inputs[0])
            w = math_("MULTIPLY", w, math_("SUBTRACT", 1.0, mt.outputs["Color"]))
        sc = N("ShaderNodeVectorMath")
        sc.operation = "SCALE"
        L(tex.outputs["Color"], sc.inputs[0])
        L(w, sc.inputs["Scale"])
        if acc is None:
            acc, wsum = sc.outputs[0], w
        else:
            ad = N("ShaderNodeVectorMath")
            ad.operation = "ADD"
            L(acc, ad.inputs[0])
            L(sc.outputs[0], ad.inputs[1])
            acc = ad.outputs[0]
            wsum = math_("ADD", wsum, w)
    eps = 1e-4
    if fallback is not None:
        eps = 0.03
        fb = N("ShaderNodeVectorMath")
        fb.operation = "ADD"
        L(acc, fb.inputs[0])
        fb.inputs[1].default_value = tuple(float(c) * eps for c in fallback)
        acc = fb.outputs[0]
    inv = math_("DIVIDE", 1.0, math_("ADD", wsum, eps))
    fin = N("ShaderNodeVectorMath")
    fin.operation = "SCALE"
    L(acc, fin.inputs[0])
    L(inv, fin.inputs["Scale"])
    bsdf = N("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.7
    bsdf.inputs["Specular IOR Level"].default_value = 0.2
    L(fin.outputs[0], bsdf.inputs["Base Color"])
    L(fin.outputs[0], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 0.25
    out = N("ShaderNodeOutputMaterial")
    L(bsdf.outputs[0], out.inputs["Surface"])
    return mat


mat = buildMaterial()


def skinMaterial():
    # 정면 손 영역 픽셀의 중앙값 → 손 전용 단색 재질 (시점 간 손 위치 오차로 배경이 묻는 문제 회피)
    rgba = loadRgba(os.path.join(SRC, "front.png"))
    px = []
    for side in ("L", "R"):
        for z, (a, b) in hands[side].items():
            r = rowOf(F, z)
            q = (b - a) // 4
            px.append(rgba[r, a + q:b - q + 1, :3])
    c = np.median(np.concatenate(px, 0), 0)
    global skin_srgb  # 팔 가림 마스크에서 그림 속 손을 찾는 데 사용
    skin_srgb = c
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    name = f"{NAME}_skin"
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*lin, 1.0)
    b.inputs["Roughness"].default_value = 0.6
    b.inputs["Subsurface Weight"].default_value = 0.1
    print("skin sRGB", np.round(c, 3))
    return m

# ---------- 파트별 단면 ----------
parts = {}

def concaveMajorant(z, y):
    # 높이별 반지름 곡선의 위쪽 볼록 껍질 — 실루엣보다 안으로 파인 곳(고랑)만 채우고 둥근 곳은 유지
    pts = sorted(zip(z, y))
    hull = []
    for p in pts:
        while len(hull) >= 2:
            (z0, y0), (z1, y1) = hull[-2], hull[-1]
            if (z1 - z0) * (p[1] - y0) - (y1 - y0) * (p[0] - z0) >= 0:
                hull.pop()
            else:
                break
        hull.append(p)
    hz_, hy_ = zip(*hull)
    return np.interp(z, hz_, hy_)


# 머리+머리카락
# 정면 폭(옆머리 뻗침·귀)과 측면 깊이(앞머리·코·눈 높이 들어감)를 그대로 쓰면 가로 고랑이 생겨
# 눈이 움푹 꺼져 보임 → 앞·뒤·좌·우 반지름을 각각 볼록 껍질로 다듬어 매끈한 둥근 머리로
hz, hxl, hxr, hyf, hyb = [], [], [], [], []
for z in zs[zs > z_neck]:
    iv = intervals(F["m"], rowOf(F, z))
    sm = sideMain(z)
    if not iv or not sm:
        continue
    hz.append(z)
    hxl.append(fx(iv[0][0]))
    hxr.append(fx(iv[-1][1]))
    hyf.append(sy(sm[1]))  # 측면 이미지 오른쪽 = 얼굴 앞(-Y)
    hyb.append(sy(sm[0]))
hz = np.array(hz)
x0 = float(np.median((np.array(hxl) + np.array(hxr)) / 2))
y0 = float(np.median((np.array(hyf) + np.array(hyb)) / 2))
pl = concaveMajorant(hz, x0 - np.array(hxl))
pr = concaveMajorant(hz, np.array(hxr) - x0)
pf = concaveMajorant(hz, y0 - np.array(hyf))
pb = concaveMajorant(hz, np.array(hyb) - y0)
rings = [(z, x0 + (r_ - l_) / 2, y0 + (b_ - f_) / 2, (l_ + r_) / 2, (f_ + b_) / 2)
         for z, l_, r_, f_, b_ in zip(hz, pl, pr, pf, pb)]
parts["head"] = buildLoft(f"{NAME}_head", rings, 2.3, mat, k=25)  # 껍질의 직선 구간 모서리를 둥글게

# 몸통(후드집업+골반)
torso_cy = {}
rings = []
for z in zs[(zs > z_crotch - 0.005) & (zs < z_neck + 0.02)]:
    iv = [p for p in intervals(F["m"], rowOf(F, z)) if p[0] <= cpx <= p[1]]
    sm = sideMain(z)
    if not iv or not sm:
        continue
    a0, b0 = max(iv[0][0], xl), min(iv[0][1], xr)
    s0, s1 = sm[0], min(sm[1], front_cap)
    torso_cy[round(z, 4)] = sy((s0 + s1) / 2)
    rings.append((z, fx((a0 + b0) / 2), sy((s0 + s1) / 2),
                  (b0 - a0) / 2 / F["S"], (s1 - s0) / 2 / SR["S"]))
parts["torso"] = buildLoft(f"{NAME}_torso", rings, 2.4, mat)


def torsoCy(z):
    keys = np.array(list(torso_cy.keys()))
    return torso_cy[keys[np.argmin(abs(keys - z))]]


# 다리+신발
base = sideMain(0.2)
base_w = base[1] - base[0]
z_shoe = max([z for z in zs[zs < 0.2] if sideMain(z) and sideMain(z)[1] - sideMain(z)[0] > 1.08 * base_w], default=0.08)
for side in ("L", "R"):
    rings = []
    for z in zs[zs < z_crotch + 0.02]:
        r = rowOf(F, z)
        lo, hi = (xl, cpx) if side == "L" else (cpx, xr)
        cols = np.where(F["m"][r, int(lo):int(hi) + 1])[0]
        sm = sideMain(z)
        if len(cols) < 4 or not sm:
            continue
        a0, b0 = lo + cols[0], lo + cols[-1]
        depth = sm[1] - sm[0]
        if z > z_shoe + 0.03:
            depth = min(depth, 1.1 * (b0 - a0) * SR["S"] / F["S"])
        cyp = (sm[0] + sm[1]) / 2
        rings.append((max(z, 0.0), fx((a0 + b0) / 2), sy(cyp), (b0 - a0) / 2 / F["S"], depth / 2 / SR["S"]))
    parts["leg_" + side] = buildLoft(f"{NAME}_leg_{side}", rings, 2.6, mat, k=5)

# 팔(소매) + 손 — 단면은 몸통·다리 텍스처의 "팔 가림 마스크"에도 사용
skin_mat = skinMaterial()
occluders = {"L": [], "R": []}
for side in ("L", "R"):
    hz = sorted(hands[side])
    if not hz:
        continue
    z_ht, z_hb = hz[-1], hz[0]
    cuff = hands[side][z_ht]
    wpx = cuff[1] - cuff[0]
    z_sh = z_neck - 0.045
    rings = []
    for z in zs[(zs >= z_ht - 0.01) & (zs <= z_sh)]:
        iv = intervals(F["m"], rowOf(F, z))
        if not iv:
            continue
        t = (z - z_ht) / max(z_sh - z_ht, 1e-6)
        rad = wpx / 2 * (1 + 0.25 * t)
        outer = iv[0][0] if side == "L" else iv[-1][1]
        cxp = outer + rad if side == "L" else outer - rad
        r = rad / F["S"]
        rings.append((z, fx(cxp), torsoCy(z) + ARM_DY, r, r * 1.05))
    # 어깨 둥근 마감
    z0, cx0, cy0, r0, _ = rings[-1]
    for k in range(1, 7):
        th = k / 6 * math.pi / 2
        rings.append((z0 + r0 * math.sin(th), cx0, cy0, max(r0 * math.cos(th), 2e-3), max(r0 * 1.05 * math.cos(th), 2e-3)))
    occluders[side] += rings
    parts["arm_" + side] = buildLoft(f"{NAME}_arm_{side}", rings, 2.0, mat, k=7)
    rings = []
    for z in hz:
        a0, b0 = hands[side][z]
        r = (b0 - a0) / 2 / F["S"]
        rings.append((z, fx((a0 + b0) / 2), torsoCy(z_ht) + ARM_DY + 0.01, r, r * 0.8))
    rings.append((z_ht + 0.012, rings[-1][1], rings[-1][2], rings[-1][3] * 0.95, rings[-1][4] * 0.95))
    occluders[side] += rings
    parts["hand_" + side] = buildLoft(f"{NAME}_hand_{side}", rings, 2.2, skin_mat, k=5)


# ---------- 팔 가림 마스크 + 부위별 재질 ----------
# 원본 그림에서 팔이 몸통 앞을 가린 영역을 몸통·다리에 칠하면, 팔이 움직일 때 "고정된 팔"이 보임
VIEW_AXIS = {"front": ("X", 1), "back": ("X", -1), "side_right": ("Y", -1), "side_left": ("Y", 1)}
# 측면은 카메라 쪽 팔만 보임 (L = 정면 이미지 왼쪽 = -X = 캐릭터 오른쪽)
VIEW_ARMS = {"front": ("L", "R"), "back": ("L", "R"), "side_right": ("L",), "side_left": ("R",)}


def softMask(m, radius=6, passes=3):
    # 상자 흐림 3회 ≈ 가우시안 — 마스크 경계에서 색이 뚝 끊겨 선처럼 보이는 것을 방지
    f = m.astype(np.float32)
    k = 2 * radius + 1
    for _ in range(passes):
        for ax in (0, 1):
            pad = [(0, 0), (0, 0)]
            pad[ax] = (radius + 1, radius)
            c = np.cumsum(np.pad(f, pad, mode="edge"), axis=ax)
            f = (np.take(c, range(k, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - k), axis=ax)) / k
    return np.clip(f, 0, 1)


def saveMask(name, m, radius=6):
    img = saveImage(name, np.repeat(softMask(m, radius)[..., None], 3, 2))
    img.colorspace_settings.name = "Non-Color"
    return img


def occluderMask(key, pad=10):
    v = views[key]
    ax, sg = VIEW_AXIS[key]
    m = np.zeros((v["h"], v["w"]), bool)
    for side in VIEW_ARMS[key]:
        for z, cx, cy, a, b in occluders[side]:
            ctr, half = (cx, a) if ax == "X" else (cy, b)
            u0 = int(math.floor((sg * ctr - half) * v["S"] + v["c"]))
            u1 = int(math.ceil((sg * ctr + half) * v["S"] + v["c"]))
            r = rowOf(v, z)
            m[max(r - 3, 0):max(r + 4, 0), max(u0, 0):max(u1 + 1, 0)] = True
    # 그림 속 손: 목 아래의 피부색 픽셀 (모델 손 위치와 그림 손 위치의 오차를 보완)
    # (손 높이로만 제한 — 신발의 크림색 그늘이 피부색으로 잡히지 않게)
    skin = (np.linalg.norm(v["rgb"] - skin_srgb, axis=2) < 0.12) & v["m"]
    skin[:rowOf(v, z_neck - 0.04)] = False
    skin[rowOf(v, z_crotch - 0.03):] = False
    m |= skin
    for _ in range(pad):  # 실제 그림 속 팔과 모델 팔의 오차를 덮도록 넓힘
        m = m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    return saveMask(f"{NAME}_{key}_armmask", m)


def regionMedianLinear(z0, z1, u0, u1):
    rows = [rowOf(F, z) for z in zs[(zs > z0) & (zs < z1)]]
    px = np.concatenate([F["rgb"][r, int(u0):int(u1)][F["m"][r, int(u0):int(u1)]] for r in rows], 0)
    c = np.median(px, 0)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def sideFaceMask(key, pad=8, front_ratio=0.55):
    # 측면 그림의 얼굴 앞쪽(눈·코·입·볼) — 머리 앞쪽 55%(귀 바로 앞까지) 중 피부가 있는 범위, 귀·옆머리는 그대로 사용
    # 경계는 넓게 흐려 귀 앞 그늘 속으로 서서히 바뀌게 함 (좁으면 세로 선으로 보임)
    # 실제 얼굴보다 넓은 머리 형상에 옆얼굴을 투영하면 3/4 각도에서 눈이 두 개로 보임 → 머리는 이 영역을 쓰지 않음
    v = views[key]
    m = np.zeros((v["h"], v["w"]), bool)
    skin = (np.linalg.norm(v["rgb"] - skin_srgb, axis=2) < 0.15) & v["m"]
    front_is_right = VIEW_AXIS[key][1] < 0  # side_right: 이미지 오른쪽이 캐릭터 앞
    for r in range(rowOf(v, z_neck + 0.3), rowOf(v, z_neck) + 1):
        cols = np.where(skin[r])[0]
        sil = np.where(v["m"][r])[0]
        if len(cols) <= 3 or len(sil) == 0:
            continue
        depth = sil[-1] - sil[0]
        if front_is_right:
            lo, hi = max(cols[0], int(sil[-1] - front_ratio * depth)), cols[-1]
        else:
            lo, hi = cols[0], min(cols[-1], int(sil[0] + front_ratio * depth))
        if hi > lo:
            m[r, lo:hi + 1] = True
    for _ in range(pad):
        m = m | shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)
    return saveMask(f"{NAME}_{key}_facemask", m, radius=16)


def sideCheekLinear():
    # 측면 그림 얼굴 높이의 피부 중앙값 — 손 색보다 볼 그늘에 가까워 마스크 경계의 밝기 차이가 줄어듦
    px = []
    for key in ("side_left", "side_right"):
        v = views[key]
        rows = slice(rowOf(v, z_neck + 0.15), rowOf(v, z_neck + 0.02))
        sk = (np.linalg.norm(v["rgb"][rows] - skin_srgb, axis=2) < 0.15) & v["m"][rows]
        px.append(v["rgb"][rows][sk])
    c = np.median(np.concatenate(px, 0), 0)
    print("cheek sRGB", np.round(c, 3))
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


masks = {key: occluderMask(key) for key in VIEW_AXIS}
half_hip = cpx - xl
torso_fb = regionMedianLinear(z_crotch + 0.15, z_neck - 0.1, cpx - 0.6 * half_hip, cpx - 0.15 * half_hip)
legs_fb = regionMedianLinear(z_shoe + 0.06, z_crotch - 0.03, xl + 0.2 * half_hip, cpx - 0.2 * half_hip)
print("fallback torso", np.round(torso_fb, 3), "legs", np.round(legs_fb, 3))
torso_mat = buildMaterial("torso", masks=masks, fallback=torso_fb)
legs_mat = buildMaterial("legs", masks=masks, fallback=legs_fb)
# 머리: 측면 그림의 얼굴 영역은 쓰지 않고, 정면 그림이 닿지 않는 볼 옆은 피부색으로
skin_lin = np.where(skin_srgb <= 0.04045, skin_srgb / 12.92, ((skin_srgb + 0.055) / 1.055) ** 2.4)
face_masks = {key: sideFaceMask(key) for key in ("side_left", "side_right")}
# 그림 속 얼굴은 3D 머리보다 좁아 얼굴 윤곽이 볼 45° 부근에 세로 선으로 찍힘
# → 정면 그림을 가로로 넓게 펴(front_scale) 윤곽을 머리 옆 가장자리로 밀고,
#   정면 가중치를 완만하게(cos²) 해 볼 옆면까지 원본 볼 그림이 이어지다 귀 근처에서 측면으로 넘어가게 함
head_mat = buildMaterial("head", masks=face_masks, fallback=sideCheekLinear(), front_power=2.0, front_scale=0.88)
for key, m_ in (("torso", torso_mat), ("leg_L", legs_mat), ("leg_R", legs_mat), ("head", head_mat)):
    if parts.get(key):
        parts[key].data.materials[0] = m_

# ---------- 씬 정리 ----------
col = bpy.data.collections.get(f"{NAME}_3d")
if col:
    for ob in list(col.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
else:
    col = bpy.data.collections.new(f"{NAME}_3d")
    bpy.context.scene.collection.children.link(col)
root = bpy.data.objects.new(f"{NAME}_root", None)
col.objects.link(root)
for key, ob in parts.items():
    if ob:
        col.objects.link(ob)
        ob.parent = root
print("parts", {k: (len(o.data.vertices) if o else None) for k, o in parts.items()})
print("z_shoe", round(z_shoe, 3), "front_cap", front_cap)


# 베이크·로우폴리·게임용 GLB 내보내기는 sheet_to_3d_export.py (같은 전역으로 이어서 exec)
