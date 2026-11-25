# 회전목마 구조물 (Blender bpy) — 고정 받침 / 도는 부분(원판·가운데 기둥·지붕·목마 기둥·전구) 을 만들어 빈 객체 두 개에 묶음
# 치수는 client/src/world/rides/carousel.ts 와 같음 (원판 반지름 6.6, 지붕 높이 5.2, 목마 반지름 5, 좌석 12)
# 좌표: Blender Z 위 → glTF 로 내보내면 Y 위. 게임 코드의 pivot 각도 θ (rotation.y) 자리는 Blender (cos θ·r, sin θ·r)
# 재질 이름 규칙 (게임 코드가 읽어 툰 재질로 바꿈): toon_<rrggbb> = 툰 단색, glow_<rrggbb> = 스스로 빛나는 단색
# 사용: exec(open(r"...\scripts\carousel_build.py", encoding="utf-8").read(), {"__name__": "__main__"})
import math

import bpy

SEAT_COUNT = 12
BASE_RADIUS = 7.4
PLATFORM_RADIUS = 6.6
PLATFORM_TOP = 0.6
HORSE_RADIUS = 5.0
ROOF_HEIGHT = 5.2
ROOF_RADIUS = 7.6
COLUMN_RADIUS = 1.6
CEILING_Z = 4.9
# 목마 기둥 반지름 — 생성 목마에서 원래 기둥을 지운 구멍(반지름 0.035 × 배율 2.3 = 0.08)을 덮음
POLE_RADIUS = 0.085

BASE_COLOR = "f1cfa6"
PLATFORM_COLOR = "ffd6a5"
FLOOR_COLOR = "fefae0"
COLUMN_COLOR = "ffafcc"
MIRROR_COLOR = "bde0fe"
GOLD_COLOR = "ffd166"
POLE_COLOR = "e9c46a"
ROOF_PINK = "ff5d8f"
ROOF_WHITE = "ffffff"
CEILING_COLOR = "fff1e6"
FLAG_COLOR = "ffb703"
BULB_COLOR = "fff3b0"


def getMaterial(prefix, hex_color):
    name = f"{prefix}_{hex_color}"
    material = bpy.data.materials.get(name)
    if material is None:
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        rgb = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
        # sRGB → 선형 (셰이더 입력은 선형 값)
        linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
        bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (*linear, 1)
        bsdf.inputs["Roughness"].default_value = 0.6
        if prefix == "glow":
            bsdf.inputs["Emission Color"].default_value = (*linear, 1)
            bsdf.inputs["Emission Strength"].default_value = 2.0
    return material


def finish(obj, parent, prefix, hex_color, smooth=True):
    obj.data.materials.clear()
    obj.data.materials.append(getMaterial(prefix, hex_color))
    if smooth:
        for polygon in obj.data.polygons:
            polygon.use_smooth = True
    obj.parent = parent
    return obj


def addCylinder(parent, name, radius, depth, z, hex_color, vertices=48, prefix="toon", radius2=None):
    if radius2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, z))
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=radius2, depth=depth, location=(0, 0, z))
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, parent, prefix, hex_color)


def addTorus(parent, name, major, minor, z, hex_color, xy=(0, 0), segments=64):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=segments, minor_segments=min(8, segments // 2), location=(xy[0], xy[1], z))
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, parent, "toon", hex_color)


def addSphere(parent, name, radius, location, hex_color, prefix="toon", segments=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=segments // 2, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, parent, prefix, hex_color)


def addBox(parent, name, size, location, rotation_z, hex_color):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=(0, 0, rotation_z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    bevel = obj.modifiers.new("둥근모서리", "BEVEL")
    bevel.width = min(size) * 0.2
    bevel.segments = 2
    return finish(obj, parent, "toon", hex_color, smooth=False)


def joinChildren(parent, name):
    # 같은 재질끼리 한 메시로 합침 → 그리기 호출 감소
    bpy.ops.object.select_all(action="DESELECT")
    groups = {}
    for child in list(parent.children):
        if child.type == "MESH":
            groups.setdefault(child.data.materials[0].name, []).append(child)
    for material_name, objects in groups.items():
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
        objects[0].name = f"{name}_{material_name}"


def buildBase(root):
    addCylinder(root, "base_step", BASE_RADIUS, 0.3, 0.15, BASE_COLOR, radius2=BASE_RADIUS - 0.2)
    addTorus(root, "base_trim", BASE_RADIUS - 0.1, 0.05, 0.3, GOLD_COLOR)


def buildPlatform(spinner):
    addCylinder(spinner, "platform", PLATFORM_RADIUS, 0.3, 0.45, PLATFORM_COLOR)
    addCylinder(spinner, "platform_floor", PLATFORM_RADIUS - 0.2, 0.04, PLATFORM_TOP + 0.01, FLOOR_COLOR)
    addTorus(spinner, "platform_trim", PLATFORM_RADIUS, 0.06, PLATFORM_TOP, GOLD_COLOR)
    # 원판 옆면 장식 판 (24장, 분홍·흰 번갈아)
    for index in range(24):
        angle = (index + 0.5) / 24 * math.pi * 2
        r = PLATFORM_RADIUS + 0.02
        color = COLUMN_COLOR if index % 2 == 0 else ROOF_WHITE
        addBox(spinner, "platform_panel", (0.05, 1.2, 0.18), (math.cos(angle) * r, math.sin(angle) * r, 0.45), angle, color)


def buildColumn(spinner):
    height = CEILING_Z - PLATFORM_TOP
    addCylinder(spinner, "column", COLUMN_RADIUS, height, PLATFORM_TOP + height / 2, COLUMN_COLOR, vertices=24)
    for z in (1.2, CEILING_Z - 0.2):
        addCylinder(spinner, "column_band", COLUMN_RADIUS + 0.15, 0.25, z, GOLD_COLOR, vertices=24)
    # 거울 판 12장 (밝은 하늘색, 은은하게 빛남) + 금테
    for index in range(12):
        angle = (index + 0.5) / 12 * math.pi * 2
        r = COLUMN_RADIUS + 0.02
        x, y = math.cos(angle) * r, math.sin(angle) * r
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 2.9), rotation=(0, 0, angle))
        mirror = bpy.context.active_object
        mirror.name = "column_mirror"
        mirror.scale = (0.04, 0.55, 2.2)
        finish(mirror, spinner, "glow", MIRROR_COLOR, smooth=False)
        addBox(spinner, "column_mirror_frame", (0.05, 0.7, 0.1), (x, y, 4.05), angle, GOLD_COLOR)
        addBox(spinner, "column_mirror_frame", (0.05, 0.7, 0.1), (x, y, 1.75), angle, GOLD_COLOR)


def buildRoof(spinner):
    # 천장 (아래에서 올려다볼 때 비지 않게) + 처마 띠
    addCylinder(spinner, "ceiling", ROOF_RADIUS - 0.1, 0.1, CEILING_Z, CEILING_COLOR)
    addCylinder(spinner, "eave", ROOF_RADIUS, 0.6, ROOF_HEIGHT, GOLD_COLOR, vertices=64)
    addTorus(spinner, "eave_trim", ROOF_RADIUS, 0.08, ROOF_HEIGHT + 0.3, ROOF_WHITE)
    # 처마 아래 물결 장식 (반원 48장이 이어짐, 분홍·흰 번갈아) — 원판을 만들어 위쪽 절반을 잘라냄
    import bmesh
    scallops = 48
    for index in range(scallops):
        angle = (index + 0.5) / scallops * math.pi * 2
        r = ROOF_RADIUS + 0.03
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.5, depth=0.06,
                                            location=(math.cos(angle) * r, math.sin(angle) * r, ROOF_HEIGHT - 0.3),
                                            rotation=(math.pi / 2, 0, angle + math.pi / 2))
        scallop = bpy.context.active_object
        scallop.name = "eave_scallop"
        # 로컬 +y 가 월드 위쪽 (x 축 90° 회전) → 로컬 y > 0 절반을 잘라내고 단면을 메움
        bm = bmesh.new()
        bm.from_mesh(scallop.data)
        cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 1, 0), clear_outer=True)
        edges = [item for item in cut["geom_cut"] if isinstance(item, bmesh.types.BMEdge)]
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        bm.to_mesh(scallop.data)
        bm.free()
        finish(scallop, spinner, "toon", ROOF_PINK if index % 2 == 0 else ROOF_WHITE, smooth=False)
    # 줄무늬 원뿔 지붕 (16조각): 조각마다 원뿔 일부를 남김
    stripes = 16
    for index in range(stripes):
        bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=ROOF_RADIUS + 0.25, radius2=0.35, depth=2.6,
                                        location=(0, 0, ROOF_HEIGHT + 0.3 + 1.3))
        cone = bpy.context.active_object
        cone.name = "roof_stripe"
        start = index / stripes * math.pi * 2
        end = (index + 1) / stripes * math.pi * 2
        mesh = cone.data
        # 조각 밖의 면 삭제 (면 중심 각도로 판단)
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(mesh)
        doomed = []
        for face in bm.faces:
            center = face.calc_center_median()
            if abs(center.x) < 1e-6 and abs(center.y) < 1e-6:
                doomed.append(face)
                continue
            angle = math.atan2(center.y, center.x) % (math.pi * 2)
            if not (start <= angle < end):
                doomed.append(face)
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
        bm.to_mesh(mesh)
        bm.free()
        finish(cone, spinner, "toon", ROOF_PINK if index % 2 == 0 else ROOF_WHITE)
    # 지붕 꼭대기: 작은 돔 + 깃대 + 깃발
    top_z = ROOF_HEIGHT + 0.3 + 2.6
    addSphere(spinner, "roof_dome", 0.45, (0, 0, top_z), GOLD_COLOR)
    addCylinder(spinner, "flag_pole", 0.05, 1.3, top_z + 0.9, "adb5bd", vertices=8)
    addBox(spinner, "flag", (0.7, 0.04, 0.4), (0.35, 0, top_z + 1.35), 0, FLAG_COLOR)
    # 처마 전구 (24개, 스스로 빛남)
    for index in range(24):
        angle = index / 24 * math.pi * 2
        r = ROOF_RADIUS + 0.06
        addSphere(spinner, "eave_bulb", 0.12, (math.cos(angle) * r, math.sin(angle) * r, ROOF_HEIGHT - 0.05), BULB_COLOR, prefix="glow", segments=8)


def buildPoles(spinner):
    # 목마 기둥 12개 — 게임 코드 pivot 각도(index/12·2π)와 같은 자리, 금색 기둥 + 위아래 받침 + 꼬임 장식 고리
    height = CEILING_Z - PLATFORM_TOP
    for index in range(SEAT_COUNT):
        angle = index / SEAT_COUNT * math.pi * 2
        x, y = math.cos(angle) * HORSE_RADIUS, math.sin(angle) * HORSE_RADIUS
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=POLE_RADIUS, depth=height, location=(x, y, PLATFORM_TOP + height / 2))
        finish(bpy.context.active_object, spinner, "toon", POLE_COLOR)
        for z in (PLATFORM_TOP + 0.08, CEILING_Z - 0.08):
            bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=POLE_RADIUS + 0.08, depth=0.16, location=(x, y, z))
            finish(bpy.context.active_object, spinner, "toon", GOLD_COLOR)
        # 목마가 오르내리는 구간(약 1.0~3.0m)을 피해 아래·위에만
        for z in (0.85, 3.6, 4.05, 4.45):
            addTorus(spinner, "pole_ring", POLE_RADIUS + 0.025, 0.03, z, GOLD_COLOR, xy=(x, y), segments=12)


def main():
    for name in ("carousel_base", "carousel_spinner"):
        old = bpy.data.objects.get(name)
        if old is not None:
            for child in list(old.children_recursive):
                bpy.data.objects.remove(child, do_unlink=True)
            bpy.data.objects.remove(old, do_unlink=True)
    base = bpy.data.objects.new("carousel_base", None)
    spinner = bpy.data.objects.new("carousel_spinner", None)
    for obj in (base, spinner):
        bpy.context.scene.collection.objects.link(obj)
    buildBase(base)
    buildPlatform(spinner)
    buildColumn(spinner)
    buildRoof(spinner)
    buildPoles(spinner)
    joinChildren(base, "base")
    joinChildren(spinner, "spinner")
    print("base 메시", len(base.children), "spinner 메시", len(spinner.children))


if __name__ == "__main__":
    main()
