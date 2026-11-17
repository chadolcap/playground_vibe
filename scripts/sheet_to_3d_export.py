# sheet_to_3d.py 다음에 같은 전역(globals)으로 exec — 베이크 → 로우폴리 → 게임용 리그 GLB
# 필요한 전역: NAME, OUT, col, z_crotch, z_neck (sheet_to_3d.py 가 만듦)
# 선택 전역: GAME_GLB (게임용 리그 GLB 경로, 없으면 OUT/<NAME>_rig.glb), TRI_TARGET (기본 10000)
import bpy, os
from mathutils import Vector, Matrix


def bakeAndExport(size=2048):
    # 파트별 투영 재질 → 하나의 UV 텍스처로 구운 고폴리 메시(<NAME>_baked)
    meshes = [o for o in col.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    dups = []
    for o in meshes:
        d = o.copy()
        d.data = o.data.copy()
        col.objects.link(d)
        dups.append(d)
        d.select_set(True)
    bpy.context.view_layer.objects.active = dups[0]
    bpy.ops.object.join()
    baked = bpy.context.active_object
    baked.name = f"{NAME}_baked"
    baked.parent = None
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    iname = f"{NAME}_albedo"
    if bpy.data.images.get(iname):
        bpy.data.images.remove(bpy.data.images[iname])
    img = bpy.data.images.new(iname, size, size, alpha=False)
    for m in baked.data.materials:
        n = m.node_tree.nodes.new("ShaderNodeTexImage")
        n.image = img
        m.node_tree.nodes.active = n
    sc = bpy.context.scene
    prev = sc.render.engine
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 4
    sc.render.bake.use_pass_direct = False
    sc.render.bake.use_pass_indirect = False
    sc.render.bake.use_pass_color = True
    sc.render.bake.margin = 32
    bpy.ops.object.bake(type="DIFFUSE")
    sc.render.engine = prev
    img.filepath_raw = os.path.join(OUT, iname + ".png")
    img.file_format = "PNG"
    img.save()
    for m in baked.data.materials:
        for n in [n for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image == img]:
            m.node_tree.nodes.remove(n)
    bm_ = bpy.data.materials.get(f"{NAME}_baked_mat") or bpy.data.materials.new(f"{NAME}_baked_mat")
    bm_.use_nodes = True
    bsdf = bm_.node_tree.nodes.get("Principled BSDF")
    tex = bm_.node_tree.nodes.get("albedo") or bm_.node_tree.nodes.new("ShaderNodeTexImage")
    tex.name = "albedo"
    tex.image = img
    bm_.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.7
    baked.data.materials.clear()
    baked.data.materials.append(bm_)
    for o in col.objects:
        o.hide_set(o.name != baked.name)
    print("baked", len(baked.data.vertices), "verts")
    return baked


def normalizeMesh(me):
    # 원점 = 발바닥 중심(X·Y 바운딩 중앙, Z 최소), 키 1.0
    co = [v.co for v in me.vertices]
    mn = Vector((min(c.x for c in co), min(c.y for c in co), min(c.z for c in co)))
    mx = Vector((max(c.x for c in co), max(c.y for c in co), max(c.z for c in co)))
    pivot = Vector(((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, mn.z))
    me.transform(Matrix.Scale(1.0 / (mx.z - mn.z), 4) @ Matrix.Translation(-pivot))
    me.update()


def lowPoly(baked, tri_target):
    lo = baked.copy()
    lo.data = baked.data.copy()
    col.objects.link(lo)
    lo.name = f"{NAME}_lowpoly"
    lo.hide_set(False)
    normalizeMesh(lo.data)
    tris = sum(len(p.vertices) - 2 for p in lo.data.polygons)
    dec = lo.modifiers.new("decimate", "DECIMATE")
    dec.decimate_type = "COLLAPSE"
    dec.ratio = min(1.0, tri_target / tris)
    dec.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    lo.data = bpy.data.meshes.new_from_object(lo.evaluated_get(dg), depsgraph=dg)
    lo.modifiers.remove(dec)
    normalizeMesh(lo.data)  # 감축으로 바닥 아래로 내려간 정점 보정
    for ca in list(lo.data.color_attributes):  # 정점 색이 남으면 Three.js 에서 텍스처에 곱해짐
        lo.data.color_attributes.remove(ca)
    for p in lo.data.polygons:
        p.use_smooth = True
    print("lowpoly tris", tris, "->", sum(len(p.vertices) - 2 for p in lo.data.polygons))
    return lo


def classifyPiece(mn, mx):
    xc = (mn.x + mx.x) / 2
    side = "left" if xc > 0 else "right"  # 캐릭터 왼쪽 = +X (glTF 에서도 +X)
    if mx.z > 0.95:
        return "head"
    if mx.z < z_crotch + 0.04 and abs(xc) < 0.1:
        return "leg_" + side
    if mx.z < z_crotch + 0.14:
        return "hand_" + side
    if abs(xc) > 0.1:
        return "arm_" + side
    return "torso"


def exportGameRig(lo, path):
    # 노드: <NAME> → body(head·torso·arm_*→hand_*), leg_* / 팔 원점=어깨, 다리 원점=엉덩이
    for o in [o for o in col.objects if o.get("game_rig")]:
        bpy.data.objects.remove(o, do_unlink=True)
    rig_src = lo.copy()
    rig_src.data = lo.data.copy()
    col.objects.link(rig_src)
    bpy.ops.object.select_all(action="DESELECT")
    rig_src.select_set(True)
    bpy.context.view_layer.objects.active = rig_src
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="LOOSE")
    bpy.ops.object.mode_set(mode="OBJECT")
    named = {}
    for p in list(bpy.context.selected_objects):
        if len(p.data.polygons) < 30:  # 감축 중 생긴 작은 조각
            bpy.data.objects.remove(p, do_unlink=True)
            continue
        vs = [v.co for v in p.data.vertices]
        mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
        mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
        n = classifyPiece(mn, mx)
        assert n not in named, f"부위 중복: {n}"
        p.name = n
        p.data.name = n
        p["game_rig"] = 1
        named[n] = p
    print("rig parts", sorted(named))

    def pivotOf(o, zmin, z):
        vs = [v.co for v in o.data.vertices if v.co.z >= zmin]
        return Vector((sum(v.x for v in vs) / len(vs), sum(v.y for v in vs) / len(vs), z))

    z_hip, z_sh = round(z_crotch, 3), round(z_neck - 0.045, 3)
    pivots = {}
    for side in ("left", "right"):
        pivots["leg_" + side] = pivotOf(named["leg_" + side], z_hip - 0.02, z_hip)
        pivots["arm_" + side] = pivotOf(named["arm_" + side], z_sh - 0.015, z_sh)
        pivots["hand_" + side] = pivots["arm_" + side]  # 손은 팔과 함께 회전
    root = bpy.data.objects.new(NAME, None)
    body = bpy.data.objects.new("body", None)
    for e in (root, body):
        e["game_rig"] = 1
        col.objects.link(e)
    body.parent = root
    for n, o in named.items():
        pv = pivots.get(n, Vector())
        o.data.transform(Matrix.Translation(-pv))
        o.matrix_parent_inverse = Matrix.Identity(4)
        if n.startswith("leg"):
            o.parent, o.location = root, pv
        elif n.startswith("hand"):
            o.parent, o.location = named["arm_" + n.split("_")[1]], (0, 0, 0)
        elif n.startswith("arm"):
            o.parent, o.location = body, pv
        else:
            o.parent, o.location = body, (0, 0, 0)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for o in [root, body] + list(named.values()):
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_apply=True)
    print("hip", z_hip, "shoulder", z_sh, "→", path, os.path.getsize(path), "bytes")
    return root


baked = bakeAndExport()
lowpoly = lowPoly(baked, globals().get("TRI_TARGET", 10000))
lowpoly.hide_set(True)
exportGameRig(lowpoly, globals().get("GAME_GLB", os.path.join(OUT, f"{NAME}_rig.glb")))
# 결과 확인 때 겹치지 않도록 게임 리그만 보이게
for o in col.objects:
    hidden = not o.get("game_rig")
    o.hide_set(hidden)
    o.hide_render = hidden
