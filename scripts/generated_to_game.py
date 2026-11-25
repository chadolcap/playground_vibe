# AI 생성 캐릭터(한 덩어리 고폴리 메시) → 게임용 스킨 메시 + 뼈대 GLB
# Blender 에서 전역 g 로 exec:
#   g = {"__name__": "__main__", "OBJ": "<생성된 오브젝트 이름>", "NAME": "man_1",
#        "OUT": r"<결과 폴더>", "GAME_GLB": r"<게임 GLB 경로>",
#        "FACE_ROT": -90,            # 정면이 Blender -Y 를 보도록 Z축 회전(도)
#        "LEG_Z": 0.2,               # 다리 뼈 회전 중심 (좌우 다리가 완전히 갈라진 높이)
#        "KNEE_Z": 0.1,              # 무릎 뼈 회전 중심
#        "ARM_CUT": [(0.42, 0.135), (0.58, 0.10)],  # (z, x) — 겨드랑이·어깨 위, |x| 가 이 선 밖이면 팔
#        "ARM_MAX_X": 0.25,          # 팔 끝(손)의 |x| 보다 조금 크게 — 바깥의 머리카락은 몸통으로
#        "SHOULDER_Z": 0.52, "TRI_TARGET": 12000,
#        "HAIR": [{"name": "hair_left", "side": 1, "x_in": 0.185, "x_full": 0.22,   # 묶음 머리 (없으면 [])
#                  "z_top": 0.95, "z_full": 0.86, "z_bottom": 0.56}]}   # pivot 을 주지 않으면 머리끈 아래 머리카락 중심, z_bottom = 머리끝(선택)
# 뼈: root → body(arm_left, arm_right, hair_*), leg_left → knee_left, leg_right → knee_right
# 크기: 키 1.0 으로 정규화해 계산하고 GAME_SCALE(오리 키 1.55)로 키워 내보냄, 원점 발바닥, 정면 glTF +Z
import bpy, bmesh, math, os
import numpy as np
from mathutils import Matrix, Vector

G = globals()
OBJ, NAME, OUT = G["OBJ"], G["NAME"], G["OUT"]
FACE_ROT = G.get("FACE_ROT", 0)
LEG_Z = G.get("LEG_Z", 0.2)
ARM_CUT = G.get("ARM_CUT", [(0.42, 0.135), (0.58, 0.10)])
# 이보다 바깥은 팔이 아님 (어깨까지 내려온 양갈래·포니테일 끝이 팔로 분류되는 것 방지)
ARM_MAX_X = G.get("ARM_MAX_X", 0.25)
SHOULDER_Z = G.get("SHOULDER_Z", 0.52)
# (z, x): 이 높이 아래에서 |x| 가 이보다 안쪽이면 팔이 아님 — 허리가 가늘어 ARM_CUT 선이 엉덩이 폭보다 안쪽일 때 엉덩이 옆이 팔에 묶이지 않게
ARM_HIP = G.get("ARM_HIP")
KNEE_Z = G.get("KNEE_Z", LEG_Z * 0.5)
# 뼈 경계를 섞는 폭 — 좁으면 관절이 꺾여 보이고, 넓으면 몸통까지 끌려감
BLEND = G.get("BLEND", 0.025)
HAIR = G.get("HAIR", [])
GAME_SCALE = G.get("GAME_SCALE", 1.55)
TRI_TARGET = G.get("TRI_TARGET", 12000)
# 베이크 광선 시작 거리 — 작으면 원본 안쪽 면 색이 얼룩지고, 크면 목에 옷깃 색이 묻음
BAKE_EXTRUSION = G.get("BAKE_EXTRUSION", 0.006)
os.makedirs(OUT, exist_ok=True)


def vertsOf(me):
    co = np.empty(len(me.vertices) * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    return co.reshape(-1, 3)


def normalizeMesh(me, rot_deg):
    # 정면 회전 → 원점 = 발바닥 중심, 키 1.0
    if rot_deg:
        me.transform(Matrix.Rotation(math.radians(rot_deg), 4, "Z"))
    co = vertsOf(me)
    mn, mx = co.min(0), co.max(0)
    # 가로 중심은 발·다리(아래 20%)로 잡음 — 한쪽으로 뻗은 머리카락이 있으면 전체 중심이 몸에서 벗어남
    feet = co[co[:, 2] < mn[2] + 0.2 * (mx[2] - mn[2])]
    fmn, fmx = feet.min(0), feet.max(0)
    pivot = Vector(((fmn[0] + fmx[0]) / 2, (fmn[1] + fmx[1]) / 2, mn[2]))
    me.transform(Matrix.Scale(1.0 / (mx[2] - mn[2]), 4) @ Matrix.Translation(-pivot))
    me.update()


def gameMaterial(size):
    # 베이스 컬러 텍스처 한 장짜리 재질 (클라이언트는 map 만 툰 재질로 옮김 → 노멀·ORM 은 용량만 차지)
    iname = f"{NAME}_albedo"
    if bpy.data.images.get(iname):
        bpy.data.images.remove(bpy.data.images[iname])
    img = bpy.data.images.new(iname, size, size, alpha=False)
    m = bpy.data.materials.get(f"{NAME}_game_mat") or bpy.data.materials.new(f"{NAME}_game_mat")
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    t = next((n for n in nt.nodes if n.type == "TEX_IMAGE"), None) or nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    nt.nodes.active = t
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.8
    return m, img


def bakeFromSource(lo, src, size=2048):
    # 감축하면 원래 UV 경계가 무너져 얇은 틈이 보임 → 새 UV 를 펴고 고폴리 색을 구워 옮김
    bpy.ops.object.select_all(action="DESELECT")
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=1.0)
    # 감축 메시는 UV 조각이 접혀 겹치기도 함 → 겹친 면끼리 서로 색을 덮어써 계단 모양 얼룩이 생김
    # (woman_1: 양갈래 머리끈의 주황이 허벅지에 찍힘) → 겹친 면만 다시 펼치고 전체를 재배치
    ts = bpy.context.scene.tool_settings
    prev_sync = ts.use_uv_select_sync
    ts.use_uv_select_sync = True
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.uv.select_overlap()
    if any(f.select for f in bmesh.from_edit_mesh(lo.data).faces):
        bpy.ops.uv.smart_project(angle_limit=math.radians(30), island_margin=0.004)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
    ts.use_uv_select_sync = prev_sync
    bpy.ops.object.mode_set(mode="OBJECT")
    mat, img = gameMaterial(size)
    lo.data.materials.clear()
    lo.data.materials.append(mat)
    src.hide_set(False)
    src.hide_render = False
    src.select_set(True)
    sc = bpy.context.scene
    prev = sc.render.engine
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 4
    bk = sc.render.bake
    bk.use_pass_direct, bk.use_pass_indirect, bk.use_pass_color = False, False, True
    bk.use_selected_to_active, bk.cage_extrusion, bk.max_ray_distance, bk.margin = True, BAKE_EXTRUSION, BAKE_EXTRUSION * 3, 8
    bpy.ops.object.bake(type="DIFFUSE")
    bk.use_selected_to_active = False
    sc.render.engine = prev
    img.filepath_raw = os.path.join(OUT, img.name + ".png")
    img.file_format = "PNG"
    img.save()
    print("baked", img.filepath_raw)


def lowPoly(src):
    lo = src.copy()
    lo.data = src.data.copy()
    lo.name = f"{NAME}_lowpoly"
    src.users_collection[0].objects.link(lo)
    lo.hide_set(False)
    lo.hide_render = False  # 원본의 숨김 상태를 물려받으면 베이크 불가
    # glTF 는 UV 경계마다 정점을 나눠 저장 → 합치지 않고 감축하면 경계가 금처럼 벌어짐
    bm = bmesh.new()
    bm.from_mesh(lo.data)
    before = len(bm.verts)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    print("merged verts", before, "->", len(bm.verts))
    bm.to_mesh(lo.data)
    bm.free()
    tris = sum(len(p.vertices) - 2 for p in lo.data.polygons)
    dec = lo.modifiers.new("decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = min(1.0, TRI_TARGET / tris)
    dec.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    lo.data = bpy.data.meshes.new_from_object(lo.evaluated_get(dg), depsgraph=dg)
    lo.modifiers.remove(dec)
    for ca in list(lo.data.color_attributes):  # 정점 색이 남으면 Three.js 에서 텍스처에 곱해짐
        lo.data.color_attributes.remove(ca)
    # 감축으로 뒤집힌 면 바로잡기 (뒤집힌 면은 어둡게 보이고, 베이크 광선도 반대로 쏴서 안쪽 색이 얼룩짐)
    bm = bmesh.new()
    bm.from_mesh(lo.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    bm.to_mesh(lo.data)
    bm.free()
    for p in lo.data.polygons:
        p.use_smooth = True
    bakeFromSource(lo, src)
    print("lowpoly tris", tris, "->", sum(len(p.vertices) - 2 for p in lo.data.polygons))
    return lo


def smooth(e0, e1, x):
    # e0→e1 구간에서 0→1 로 부드럽게 (e0 > e1 이면 반대 방향)
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def armCutXs(z):
    (z0, x0), (z1, x1) = ARM_CUT
    return x0 + (x1 - x0) * np.clip((z - z0) / (z1 - z0), 0.0, 1.0)


def skinWeights(co):
    # 정점마다 뼈 가중치 — 경계를 BLEND 폭만큼 부드럽게 섞어 관절에서 옷이 늘어나며 이어지게 함
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    ax = np.abs(x)
    w = {}
    for side, s in (("left", 1), ("right", -1)):
        on = (s * x > 0).astype(float)
        leg = on * smooth(LEG_Z + BLEND, LEG_Z - BLEND, z)
        knee = leg * smooth(KNEE_Z + BLEND, KNEE_Z - BLEND, z)
        w["leg_" + side] = leg - knee
        w["knee_" + side] = knee
        z1 = ARM_CUT[1][0]
        arm = on * smooth(-BLEND, BLEND, ax - armCutXs(z)) * smooth(z1, z1 - 0.05, z)
        arm *= (ax < ARM_MAX_X) * smooth(LEG_Z, LEG_Z + 0.04, z)
        if ARM_HIP is not None:
            hip_z, hip_x = ARM_HIP
            arm *= 1 - (z < hip_z) * smooth(hip_x + 0.01, hip_x - 0.01, ax)
        w["arm_" + side] = arm
    for h in HAIR:
        hw = smooth(h["x_in"], h["x_full"], h["side"] * x) * smooth(h["z_top"], h["z_full"], z)
        # 머리끝 높이(z_bottom)를 주면 그 아래는 머리카락이 아님 (A-Pose 처럼 팔이 머리 바깥 x 로 벌어진 경우)
        if "z_bottom" in h:
            hw *= smooth(h["z_bottom"] - 0.015, h["z_bottom"] + 0.015, z)
        w[h["name"]] = hw
    total = sum(w.values())
    over = np.maximum(total, 1.0)  # 합이 1 을 넘는 곳(팔·머리 겹침)은 비율대로 줄임
    for k in w:
        w[k] = w[k] / over
    w["body"] = np.clip(1.0 - sum(w.values()), 0.0, 1.0)
    return w


def boneHeads(co, w):
    # 뼈 머리(회전 중심) = 그 뼈에 주로 붙은 정점들의 가로 중심 + 정한 높이
    def center(name, z, band=0.03):
        m = (w[name] > 0.3) & (np.abs(co[:, 2] - z) < band)
        if not m.any():
            m = w[name] > 0.3
        return (float(co[m, 0].mean()), float(co[m, 1].mean()), z)

    heads = {"root": ((0, 0, 0), None), "body": ((0, 0, 0), "root")}
    for side in ("left", "right"):
        heads["leg_" + side] = (center("leg_" + side, LEG_Z - 0.02), "root")
        heads["leg_" + side] = ((heads["leg_" + side][0][0], heads["leg_" + side][0][1], LEG_Z), "root")
        heads["knee_" + side] = (center("knee_" + side, KNEE_Z), "leg_" + side)
        heads["arm_" + side] = (center("arm_" + side, SHOULDER_Z - 0.04), "body")
        heads["arm_" + side] = ((heads["arm_" + side][0][0], heads["arm_" + side][0][1], SHOULDER_Z), "body")
    for h in HAIR:
        # 회전 중심 = 지정값, 없으면 머리끈 바로 아래 머리카락의 중심
        pivot = h.get("pivot") or center(h["name"], h["z_top"] - 0.04, 0.02)
        heads[h["name"]] = (tuple(pivot), "body")
    return heads


def buildSkinned(lo, path):
    # 한 덩어리 메시 + 뼈대(모든 뼈가 위(+Z)를 향함 → glTF 에서 뼈의 기본 회전이 0 이라 게임 코드가 축 그대로 회전)
    co = vertsOf(lo.data)
    w = skinWeights(co)
    heads = boneHeads(co, w)
    lo.data.transform(Matrix.Scale(GAME_SCALE, 4))  # 게임 크기로 (스킨 메시는 클라이언트에서 도형 배율을 바꿀 수 없음)
    arm_data = bpy.data.armatures.new(NAME)
    rig = bpy.data.objects.new(NAME, arm_data)
    rig["game_rig"] = 1
    lo.users_collection[0].objects.link(rig)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (head, parent) in heads.items():
        b = arm_data.edit_bones.new(name)
        b.head = Vector(head) * GAME_SCALE
        b.tail = b.head + Vector((0, 0, 0.05))
        b.roll = 0
    for name, (head, parent) in heads.items():
        if parent:
            arm_data.edit_bones[name].parent = arm_data.edit_bones[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    mesh = lo.copy()
    mesh.data = lo.data.copy()
    mesh.name = f"{NAME}_mesh"
    mesh["game_rig"] = 1
    lo.users_collection[0].objects.link(mesh)
    mesh.vertex_groups.clear()
    for name, arr in w.items():
        vg = mesh.vertex_groups.new(name=name)
        for i in np.nonzero(arr > 1e-3)[0]:
            vg.add([int(i)], float(arr[i]), "REPLACE")
    mesh.parent = rig
    mod = mesh.modifiers.new("armature", "ARMATURE")
    mod.object = rig
    lo.data.transform(Matrix.Scale(1.0 / GAME_SCALE, 4))
    bpy.ops.object.select_all(action="DESELECT")
    for o in (rig, mesh):
        o.hide_set(False)
        o.hide_render = False
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_apply=False,
                              export_skins=True, export_animations=False, export_image_format="JPEG")
    print("bones", list(heads), "→", path, os.path.getsize(path), "bytes")
    return rig


src = bpy.data.objects[OBJ]
for o in [o for o in bpy.data.objects if o.get("game_rig") or o.name.startswith(f"{NAME}_lowpoly")]:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.data.orphans_purge(do_recursive=True)  # 이전 실행의 메시가 남으면 새 메시 이름에 .001 이 붙음
if not src.get("normalized"):
    normalizeMesh(src.data, FACE_ROT)
    src["normalized"] = 1
lowpoly = lowPoly(src)
buildSkinned(lowpoly, G.get("GAME_GLB", os.path.join(OUT, f"{NAME}_rig.glb")))
for o in (src, lowpoly):
    o.hide_set(True)
    o.hide_render = True
