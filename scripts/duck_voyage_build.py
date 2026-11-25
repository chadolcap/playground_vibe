# DUCK VOYAGE (Blender bpy) — 고정부(바닥·울타리·A자 탑·축) / 흔들리는 부분(팔·배·좌석·깃발) 을 빈 객체 두 개에 묶음
# 치수·좌석 위치는 client/src/world/rides/duckVoyage.ts 와 같음 (축 높이 12.8, 팔 8.5, 선체 14.4 × 3.7, 좌석 5줄 × 2)
# 좌표: 게임 코드 (x, y, z) → Blender (x, −z, y). 게임 y 축 회전 θ = Blender Z 축 회전 θ
# duck_voyage_swing 빈 객체는 축 위치(0, 0, 12.8)에 두고 자식은 축 기준 좌표 — 게임 코드는 이 빈 객체 위치를 0 으로 되돌려 swing 그룹에 붙임
# 재질 이름 규칙 (게임 코드가 읽어 툰 재질로 바꿈): toon_<rrggbb> = 툰 단색, glow_<rrggbb> = 스스로 빛나는 단색
# 사용: exec(open(r"...\scripts\duck_voyage_build.py", encoding="utf-8").read(), {"__name__": "__main__"})
import math

import bmesh
import bpy

PIVOT_HEIGHT = 12.8
ARM_LENGTH = 8.5
HULL_LENGTH = 14.4
HULL_WIDTH = 3.7
HULL_DEPTH = 1.3
HULL_RAIL = 1.05
HULL_SHEER = 1.9
HULL_SECTIONS = 64
HULL_PROFILE_POINTS = 24
ROW_ORDER = [-5.2, 5.2, -2.6, 2.6, 0]
SEAT_SIDE = 0.75
DECK_HEIGHT = 0.82
TOWER_Z = 2.6
TOWER_FOOT_X = 4.5
FLOOR_RADIUS = 11.5
FENCE_RADIUS = 11.2
# 테두리 띠·손잡이 난간이 끝나는 위치 (|x|)
BAND_END = 6.0
# 오리 조각상 자리 (|x|, 깃대 ±5.8 바깥)
FIGUREHEAD_X = 6.7
RAIL_END = 5.6

WOOD_LIGHT = "9c6b3a"
WOOD_DARK = "7a4a24"
RAIL_DARK = "5e3a1c"
STRIPE = "c1121f"
GOLD = "ffd166"
DECK = "deb887"
DECK_LINE = "b08860"
SEAT = "264653"
TOWER = "457b9d"
STEEL = "e9ecef"
AXLE = "adb5bd"
FLOOR = "e9d8a6"
FENCE = "7f5539"
GLASS = "a9d6e5"
SHIELD_COLORS = ["e63946", "ffd166", "457b9d", "f1faee"]


def B(x, y, z):
    # 게임 좌표 → Blender 좌표
    return (x, -z, y)


def getMaterial(prefix, hex_color):
    name = f"{prefix}_{hex_color}"
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
        bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*linear, 1)
        bsdf.inputs["Roughness"].default_value = 0.6
        if prefix == "glow":
            bsdf.inputs["Emission Color"].default_value = (*linear, 1)
            bsdf.inputs["Emission Strength"].default_value = 2.0
    return material


def finish(obj, parent, hex_color, prefix="toon", smooth=True):
    obj.data.materials.clear()
    obj.data.materials.append(getMaterial(prefix, hex_color))
    if smooth and obj.type == "MESH":
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    obj.parent = parent
    return obj


def addBox(parent, size, location, hex_color, rotation=(0, 0, 0), bevel=True):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.active_object
    obj.scale = size
    if bevel:
        modifier = obj.modifiers.new("둥근모서리", "BEVEL")
        modifier.width = min(size) * 0.2
        modifier.segments = 2
    return finish(obj, parent, hex_color, smooth=False)


def addCylinder(parent, radius, depth, location, hex_color, rotation=(0, 0, 0), vertices=16, prefix="toon"):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    return finish(bpy.context.active_object, parent, hex_color, prefix=prefix)


def addSphere(parent, radius, location, hex_color, segments=12, prefix="toon"):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(4, segments // 2), radius=radius, location=location)
    return finish(bpy.context.active_object, parent, hex_color, prefix=prefix)


def addBeam(parent, a, b, thickness, hex_color):
    # Blender 좌표 a → b 를 잇는 각목
    from mathutils import Vector
    a, b = Vector(a), Vector(b)
    direction = b - a
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) / 2)
    obj = bpy.context.active_object
    obj.scale = (thickness, thickness, direction.length)
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    modifier = obj.modifiers.new("둥근모서리", "BEVEL")
    modifier.width = thickness * 0.15
    modifier.segments = 2
    return finish(obj, parent, hex_color, smooth=False)


def addTube(parent, points, radius, hex_color, cyclic=False):
    # Blender 좌표 점들을 잇는 둥근 관 (난간·울타리 가로대)
    curve = bpy.data.curves.new("tube", "CURVE")
    curve.dimensions = "3D"
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new("tube", curve)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.active_object
    return finish(obj, parent, hex_color)


def hullAt(x):
    t = min(abs(x) / (HULL_LENGTH / 2), 1)
    return {
        "half_width": (HULL_WIDTH / 2) * math.sqrt(max(1 - t ** 2.4, 0)),
        "top": HULL_RAIL + HULL_SHEER * t ** 2.6,
        "bottom": -HULL_DEPTH * (1 - t ** 2) + HULL_SHEER * 0.35 * t ** 3,
    }


def hullPoint(x, angle, offset=0.0):
    # 게임 좌표 선체 단면 점 (angle 0 = 왼쪽 테두리, π = 오른쪽 테두리)
    h = hullAt(x)
    z = -(h["half_width"] + offset) * math.cos(angle)
    y = h["top"] - (h["top"] - h["bottom"]) * math.sin(angle) ** 0.7
    return x, y, z


def buildHull(ship, ship_y):
    # 선체 곡면 (판자 두 색이 번갈아 가는 줄무늬) + 두께
    mesh = bpy.data.meshes.new("hull")
    bm = bmesh.new()
    row = HULL_PROFILE_POINTS + 1
    verts = []
    for section in range(HULL_SECTIONS + 1):
        x = -HULL_LENGTH / 2 + section / HULL_SECTIONS * HULL_LENGTH
        for point in range(row):
            gx, gy, gz = hullPoint(x, point / HULL_PROFILE_POINTS * math.pi)
            verts.append(bm.verts.new(B(gx, gy + ship_y, gz)))
    for section in range(HULL_SECTIONS):
        for point in range(HULL_PROFILE_POINTS):
            a = section * row + point
            face = bm.faces.new((verts[a], verts[a + 1], verts[a + row + 1], verts[a + row]))
            # 판자 줄: 단면 점 2개마다 색을 바꿈
            face.material_index = (point // 2) % 2
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("hull", mesh)
    bpy.context.scene.collection.objects.link(obj)
    mesh.materials.append(getMaterial("toon", WOOD_LIGHT))
    mesh.materials.append(getMaterial("toon", WOOD_DARK))
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    solidify = obj.modifiers.new("두께", "SOLIDIFY")
    solidify.thickness = 0.1
    obj.parent = ship
    # 테두리 띠: 붉은 띠 + 어두운 난간 띠 (바깥으로 살짝 띄운 띠 곡면)
    for top_from, top_to, offset, color in ((0.35, 0.6, 0.06, STRIPE), (0.0, 0.14, 0.07, RAIL_DARK)):
        band = bpy.data.meshes.new("band")
        bm = bmesh.new()
        sides = {-1: [], 1: []}
        # 양 끝은 선체 폭이 0 으로 모여 띠가 갈고리처럼 튀어나오므로 BAND_END 안쪽만
        for section in range(HULL_SECTIONS + 1):
            x = -BAND_END + section / HULL_SECTIONS * BAND_END * 2
            h = hullAt(x)
            for side in (-1, 1):
                z = side * (h["half_width"] + offset)
                sides[side].append((bm.verts.new(B(x, h["top"] - top_from + ship_y, z)), bm.verts.new(B(x, h["top"] - top_to + ship_y, z))))
        for side in (-1, 1):
            for section in range(HULL_SECTIONS):
                (a, b), (c, d) = sides[side][section], sides[side][section + 1]
                bm.faces.new((a, c, d, b) if side == 1 else (a, b, d, c))
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
        bm.to_mesh(band)
        bm.free()
        band_obj = bpy.data.objects.new("band", band)
        bpy.context.scene.collection.objects.link(band_obj)
        band_obj.modifiers.new("두께", "SOLIDIFY").thickness = 0.04
        finish(band_obj, ship, color)


def buildRailing(ship, ship_y):
    # 금색 손잡이 난간 (선체 위 0.45m) + 난간 기둥
    for side in (-1, 1):
        # 선체 끝이 가파르게 솟는 곳은 난간이 막대처럼 솟으므로 RAIL_END 안쪽만
        top_points = []
        for section in range(33):
            x = -RAIL_END + section / 32 * RAIL_END * 2
            h = hullAt(x)
            top_points.append(B(x, h["top"] + 0.45 + ship_y, side * h["half_width"]))
        addTube(ship, top_points, 0.05, GOLD)
        for index in range(-7, 8):
            x = index * 0.8
            h = hullAt(x)
            addCylinder(ship, 0.035, 0.45, B(x, h["top"] + 0.225 + ship_y, side * h["half_width"]), GOLD, vertices=8)


def buildSideDecor(ship, ship_y):
    # 붉은 띠 위 방패 (색 번갈아 + 금 장식) · 아래쪽 둥근 창 (금테 + 유리)
    for side in (-1, 1):
        for index, x in enumerate([-4.6, -3.45, -2.3, -1.15, 0, 1.15, 2.3, 3.45, 4.6]):
            h = hullAt(x)
            z = side * (h["half_width"] + 0.1)
            y = h["top"] - 0.47 + ship_y
            color = SHIELD_COLORS[index % len(SHIELD_COLORS)]
            addCylinder(ship, 0.32, 0.06, B(x, y, z), color, rotation=(math.pi / 2, 0, 0), vertices=20)
            addSphere(ship, 0.09, B(x, y, z + side * 0.05), GOLD, segments=10)
        for x in [-3.9, -1.95, 0, 1.95, 3.9]:
            from mathutils import Vector
            h = hullAt(x)
            depth = h["top"] - h["bottom"]
            angle = math.asin(min(1, (1.0 / depth) ** (1 / 0.7)))
            angle = angle if side == -1 else math.pi - angle
            # 단면 곡선의 접선으로 바깥 법선을 구해 창을 곡면에 붙임
            p0 = Vector(B(*hullPoint(x, angle - 0.01)))
            p1 = Vector(B(*hullPoint(x, angle + 0.01)))
            tangent = (p1 - p0).normalized()
            normal = Vector((0, -tangent.z, tangent.y)) * (-1 if side == -1 else 1)
            if normal.y * (-side) < 0:
                normal = -normal
            center = Vector(B(*hullPoint(x, angle))) + Vector((0, 0, ship_y))
            rotation = Vector((0, 0, 1)).rotation_difference(normal).to_euler()
            addCylinder(ship, 0.24, 0.05, center + normal * 0.14, GOLD, rotation=rotation, vertices=20)
            addCylinder(ship, 0.17, 0.05, center + normal * 0.16, GLASS, rotation=rotation, vertices=16, prefix="glow")


def buildDeck(ship, ship_y):
    # 갑판 판 (선체 안쪽 폭) + 판자 줄눈
    mesh = bpy.data.meshes.new("deck")
    bm = bmesh.new()
    pairs = []
    for section in range(HULL_SECTIONS + 1):
        x = -HULL_LENGTH / 2 + section / HULL_SECTIONS * HULL_LENGTH
        half = max(hullAt(x)["half_width"] - 0.15, 0)
        pairs.append((bm.verts.new(B(x, DECK_HEIGHT + ship_y, -half)), bm.verts.new(B(x, DECK_HEIGHT + ship_y, half))))
    for section in range(HULL_SECTIONS):
        (a, b), (c, d) = pairs[section], pairs[section + 1]
        bm.faces.new((a, c, d, b))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    deck = bpy.data.objects.new("deck", mesh)
    bpy.context.scene.collection.objects.link(deck)
    deck.modifiers.new("두께", "SOLIDIFY").thickness = 0.06
    finish(deck, ship, DECK, smooth=False)
    for z in [-1.2, -0.9, -0.6, -0.3, 0.0, 0.3, 0.6, 0.9, 1.2]:
        # 이 줄눈이 갑판 안에 드는 x 범위
        xs = [x / 20 for x in range(-144, 145) if hullAt(x / 20)["half_width"] - 0.2 > abs(z)]
        if len(xs) < 2:
            continue
        length = xs[-1] - xs[0]
        addBox(ship, (length, 0.025, 0.012), B((xs[0] + xs[-1]) / 2, DECK_HEIGHT + 0.006 + ship_y, z), DECK_LINE, bevel=False)


def buildSeats(ship, ship_y):
    # 좌석: 게임 코드와 같은 자리·방향 (가운데를 바라봄), 남색 방석 + 금색 틀 + 안전바
    for row_x in ROW_ORDER:
        facing = -math.pi / 2 if row_x > 0 else math.pi / 2
        cos_f, sin_f = math.cos(facing), math.sin(facing)

        def place(ox, oy, oz):
            # 좌석 로컬 (게임 좌표) → 배 좌표 → Blender
            return (row_x + ox * cos_f + oz * sin_f, DECK_HEIGHT + oy + ship_y, side + (-ox * sin_f + oz * cos_f))

        for side in (-SEAT_SIDE, SEAT_SIDE):
            rotation = (0, 0, facing)
            addBox(ship, (0.7, 0.65, 0.2), B(*place(0, 0.12, 0)), SEAT, rotation=rotation)
            addBox(ship, (0.7, 0.1, 0.6), B(*place(0, 0.45, -0.3)), SEAT, rotation=rotation)
            for ox in (-0.38, 0.38):
                addBox(ship, (0.05, 0.7, 0.08), B(*place(ox, 0.3, 0.02)), GOLD, rotation=rotation)
            addCylinder(ship, 0.035, 0.76, B(*place(0, 0.55, 0.38)), GOLD, rotation=(0, math.pi / 2, facing), vertices=8)


def buildEnds(ship, ship_y):
    # 양 끝 깃대 + 삼각 깃발 + 등불, 이물(+x) 기움 돛대
    for direction in (-1, 1):
        pole_x = direction * (HULL_LENGTH / 2 - 1.4)
        base = hullAt(pole_x)["top"]
        addCylinder(ship, 0.07, 2.6, B(pole_x, base + 1.3 + ship_y, 0), "f1faee", vertices=10)
        addSphere(ship, 0.12, B(pole_x, base + 2.65 + ship_y, 0), GOLD)
        flag = bpy.data.meshes.new("flag")
        bm = bmesh.new()
        a = bm.verts.new(B(pole_x, base + 2.5 + ship_y, 0))
        b = bm.verts.new(B(pole_x, base + 1.8 + ship_y, 0))
        c = bm.verts.new(B(pole_x - direction * 1.3, base + 2.15 + ship_y, 0))
        bm.faces.new((a, b, c))
        bm.to_mesh(flag)
        bm.free()
        flag_obj = bpy.data.objects.new("flag", flag)
        bpy.context.scene.collection.objects.link(flag_obj)
        flag_obj.modifiers.new("두께", "SOLIDIFY").thickness = 0.04
        finish(flag_obj, ship, "e63946" if direction > 0 else "ffb703", smooth=False)
        addCylinder(ship, 0.13, 0.3, B(pole_x, base + 1.0 + ship_y, direction * -0.12), "fff3b0", vertices=8, prefix="glow")
    bow = hullAt(HULL_LENGTH / 2)
    addCylinder(ship, 0.08, 2.2, B(HULL_LENGTH / 2 + 0.7, bow["top"] - 0.3 + ship_y, 0), GOLD, rotation=(0, math.pi / 2 - 0.35, 0), vertices=10)


def buildArms(swing):
    # 축 기준 좌표: 팔 4개(흰 강철) + 팔 사이 가로대 + 축 쪽 금색 원판
    for z in (-1.4, 1.4):
        for x in (-2.4, 2.4):
            addBeam(swing, B(0, 0, z), B(x, -ARM_LENGTH + 0.8, z), 0.3, STEEL)
        addBeam(swing, B(-1.4, -ARM_LENGTH * 0.55, z), B(1.4, -ARM_LENGTH * 0.55, z), 0.18, STEEL)
        addCylinder(swing, 0.75, 0.16, B(0, 0, z * 1.12), GOLD, rotation=(math.pi / 2, 0, 0), vertices=24)
    addCylinder(swing, 0.5, 2.6, B(0, 0, 0), GOLD, rotation=(math.pi / 2, 0, 0), vertices=20)


def buildBase(base):
    # 바닥 (게임 코드와 같은 반지름) + 나무 바닥 고리 + 울타리 (게이트 +z 쪽 비움)
    addCylinder(base, FLOOR_RADIUS, 0.3, (0, 0, 0.15), FLOOR, vertices=48)
    gate_angle = math.pi / 2
    angles = [index / 28 * math.pi * 2 for index in range(28)]
    for angle in angles:
        if abs(angle - gate_angle) < 0.35:
            continue
        x, z = math.cos(angle) * FENCE_RADIUS, math.sin(angle) * FENCE_RADIUS
        addBox(base, (0.18, 0.18, 1.1), B(x, 0.85, z), FENCE)
        addSphere(base, 0.11, B(x, 1.45, z), GOLD, segments=8)
    for rail_y in (0.75, 1.25):
        points = []
        for step in range(0, 97):
            angle = gate_angle + 0.33 + step / 96 * (math.pi * 2 - 0.66)
            points.append(B(math.cos(angle) * FENCE_RADIUS, rail_y, math.sin(angle) * FENCE_RADIUS))
        addTube(base, points, 0.045, FENCE)
    # A자 탑 두 개: 다리 2개 + 가로대 2단 + X자 가새 + 발판, 꼭대기 축받이
    for z in (-TOWER_Z, TOWER_Z):
        top = B(0, PIVOT_HEIGHT, z)
        for x in (-TOWER_FOOT_X, TOWER_FOOT_X):
            addBeam(base, B(x, 0, z * 1.35), top, 0.55, TOWER)
            addBox(base, (1.0, 1.0, 0.2), B(x, 0.4, z * 1.35), AXLE)
        for ratio, thickness in ((0.3, 0.3), (0.6, 0.26)):
            y = PIVOT_HEIGHT * ratio
            half = TOWER_FOOT_X * (1 - ratio)
            zz = z * (1.35 - 0.35 * ratio)
            addBeam(base, B(-half, y, zz), B(half, y, zz), thickness, TOWER)
        y0, y1 = PIVOT_HEIGHT * 0.3, PIVOT_HEIGHT * 0.6
        h0, h1 = TOWER_FOOT_X * 0.7, TOWER_FOOT_X * 0.4
        z0, z1 = z * (1.35 - 0.35 * 0.3), z * (1.35 - 0.35 * 0.6)
        addBeam(base, B(-h0, y0, z0), B(h1, y1, z1), 0.16, TOWER)
        addBeam(base, B(h0, y0, z0), B(-h1, y1, z1), 0.16, TOWER)
        addBox(base, (1.1, 0.9, 1.0), B(0, PIVOT_HEIGHT, z * 1.05), TOWER)
    addCylinder(base, 0.4, TOWER_Z * 2 + 0.8, B(0, PIVOT_HEIGHT, 0), AXLE, rotation=(math.pi / 2, 0, 0), vertices=16)
    for z in (-TOWER_Z - 0.45, TOWER_Z + 0.45):
        addCylinder(base, 0.55, 0.12, B(0, PIVOT_HEIGHT, z), GOLD, rotation=(math.pi / 2, 0, 0), vertices=20)


def placeFigureheads(ship, ship_y):
    # 생성한 오리 조각상(메시 figurehead_duck, 바닥 원점·+x 를 바라봄)을 이물·고물 끝에 앉힘 — 메시가 없으면 건너뜀
    mesh = bpy.data.meshes.get("figurehead_duck")
    if mesh is None:
        print("figurehead_duck 메시 없음 — 조각상 생략")
        return
    for name, x, rot in (("figurehead_bow", FIGUREHEAD_X, 0.0), ("figurehead_stern", -FIGUREHEAD_X, math.pi)):
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = ship
        obj.location = B(x, hullAt(x)["top"] - 0.15 + ship_y, 0)
        obj.rotation_euler = (0, 0, rot)


def joinChildren(parent, name):
    # 같은 재질 조합끼리 한 메시로 합침 → 그리기 호출 감소
    groups = {}
    for child in list(parent.children):
        if child.type == "MESH" and not child.name.startswith("figurehead"):
            key = tuple(m.name for m in child.data.materials)
            groups.setdefault(key, []).append(child)
    for key, objects in groups.items():
        for obj in objects:
            bpy.context.view_layer.objects.active = obj
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects) > 1:
            bpy.ops.object.join()
        objects[0].name = f"{name}_{'_'.join(key)}"


def main():
    for name in ("duck_voyage_base", "duck_voyage_swing"):
        old = bpy.data.objects.get(name)
        if old is not None:
            for child in list(old.children_recursive):
                bpy.data.objects.remove(child, do_unlink=True)
            bpy.data.objects.remove(old, do_unlink=True)
    base = bpy.data.objects.new("duck_voyage_base", None)
    swing = bpy.data.objects.new("duck_voyage_swing", None)
    for obj in (base, swing):
        bpy.context.scene.collection.objects.link(obj)
    buildBase(base)
    # 흔들리는 부분은 축 기준 좌표로 만들고 마지막에 빈 객체를 축 높이로 올림
    ship_y = -ARM_LENGTH
    buildArms(swing)
    buildHull(swing, ship_y)
    buildRailing(swing, ship_y)
    buildSideDecor(swing, ship_y)
    buildDeck(swing, ship_y)
    buildSeats(swing, ship_y)
    buildEnds(swing, ship_y)
    placeFigureheads(swing, ship_y)
    joinChildren(base, "base")
    joinChildren(swing, "swing")
    swing.location = (0, 0, PIVOT_HEIGHT)
    print("base 메시", len(base.children), "swing 메시", len(swing.children))


if __name__ == "__main__":
    main()
