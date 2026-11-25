# DUCK TWIST (Blender bpy) — 고정부 dt_base / 흔들리는 팔 dt_arm (축 기준) / 도는 좌석 원판 dt_wheel (원판 기준) 빈 객체 세 개
# 치수·좌석 자리는 client/src/world/rides/duckTwist.ts 와 같음 (축 높이 9.6, 팔 7.4, 원판 반지름 2.4, 좌석 8)
# 좌표: 게임 코드 (x, y, z) → Blender (x, −z, y). dt_arm·dt_wheel 의 자식은 각자 기준 좌표로 만들고 마지막에 빈 객체를 제자리로 올림
#   (게임 코드는 두 빈 객체의 위치를 0 으로 되돌려 arm_pivot·wheel 그룹에 붙임)
# 재질 이름 규칙: toon_<rrggbb> 툰 단색, glow_<rrggbb> 빛나는 단색. 도형 함수는 duck_voyage_build.py 의 것을 불러와 씀
# 생성한 별 장식(메시 twist_star, 중심 원점·게임 +z 를 바라봄)이 있으면 균형추 앞뒤에 붙임
# 사용: exec(open(r"...\scripts\duck_twist_build.py", encoding="utf-8").read(), {"__name__": "__main__"})
import math
import os

import bpy

_helpers = {"__name__": "duck_voyage_helpers"}
exec(open(os.path.join(r"D:\work\study\playground_vibe\scripts", "duck_voyage_build.py"), encoding="utf-8").read(), _helpers)
B = _helpers["B"]
finish = _helpers["finish"]
addBox = _helpers["addBox"]
addCylinder = _helpers["addCylinder"]
addSphere = _helpers["addSphere"]
addBeam = _helpers["addBeam"]
addTube = _helpers["addTube"]
joinChildren = _helpers["joinChildren"]

SEAT_COUNT = 8
AXLE_HEIGHT = 9.6
ARM_LENGTH = 7.4
WHEEL_RADIUS = 2.4
WHEEL_DROP = ARM_LENGTH + 0.2
PILLAR_X = 3.3

BASE = "6c63ff"
BASE_INNER = "fefae0"
WEDGE_COLORS = ["ffadad", "ffd6a5", "fdffb6", "caffbf", "9bf6ff", "a0c4ff", "bdb2ff", "ffc6ff"]
GOLD = "ffd166"
PILLAR = "ffc300"
PILLAR_BRACE = "ffb703"
AXLE = "adb5bd"
ARM = "ff006e"
ARM_STRIPE = "ffffff"
# 균형추는 파랑 — 노란 별 장식이 잘 보이게
WEIGHT = "3a86ff"
WEIGHT_PLATE = "8ecae6"
WHEEL = "3a86ff"
WHEEL_TOP = "8ecae6"
SEAT = "fb5607"
SEAT_TRIM = "ffffff"
BULB_COLORS = ["ff5a4e", "ffd166", "7bc96f", "5ec8ff", "c7a8ff", "ff8fab"]


def buildBase(base):
    # 보라 바닥 원판 + 무지개 조각 바닥 + 금테 + 둘레 전구
    addCylinder(base, 7.5, 0.6, B(0, 0.3, 0), BASE, vertices=48)
    for index in range(16):
        start = index / 16 * math.pi * 2
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=6.2, depth=0.04, location=B(0, 0.62, 0), end_fill_type="TRIFAN")
        wedge = bpy.context.active_object
        # 조각 밖 면 삭제 (부채꼴만 남김)
        import bmesh
        bm = bmesh.new()
        bm.from_mesh(wedge.data)
        for vert in bm.verts:
            angle = math.atan2(vert.co.y, vert.co.x)
            if math.hypot(vert.co.x, vert.co.y) > 1e-4:
                t = (angle - start) % (math.pi * 2)
                t = min(t, math.pi * 2 / 16)
                r = math.hypot(vert.co.x, vert.co.y)
                vert.co.x = math.cos(start + t) * r
                vert.co.y = math.sin(start + t) * r
        bm.to_mesh(wedge.data)
        bm.free()
        finish(wedge, base, WEDGE_COLORS[index % len(WEDGE_COLORS)], smooth=False)
    bpy.ops.mesh.primitive_torus_add(major_radius=6.25, minor_radius=0.1, major_segments=64, minor_segments=8, location=B(0, 0.62, 0))
    finish(bpy.context.active_object, base, GOLD)
    for index in range(32):
        angle = index / 32 * math.pi * 2
        addSphere(base, 0.12, B(math.cos(angle) * 7.45, 0.45, math.sin(angle) * 7.45), BULB_COLORS[index % len(BULB_COLORS)], segments=8, prefix="glow")


def buildPillars(base):
    # 양쪽 A자 기둥 (게임 코드의 기울어진 상자와 같은 선) + 가로대 2단 + X자 가새 + 꼭대기 축받이
    for x in (-PILLAR_X, PILLAR_X):
        legs = []
        for side in (-1, 1):
            bottom = (x, 0.0, side * 1.73)
            top = (x, AXLE_HEIGHT, side * 0.03)
            addBeam(base, B(*bottom), B(*top), 0.5, PILLAR)
            addBox(base, (0.9, 0.9, 0.25), B(x, 0.72, side * 1.73), AXLE)
            legs.append((bottom, top))
        for ratio, thickness in ((0.3, 0.28), (0.62, 0.24)):
            y = AXLE_HEIGHT * ratio
            z = 1.73 + (0.03 - 1.73) * ratio
            addBeam(base, B(x, y, -z), B(x, y, z), thickness, PILLAR_BRACE)
        y0, y1 = AXLE_HEIGHT * 0.3, AXLE_HEIGHT * 0.62
        z0, z1 = 1.73 + (0.03 - 1.73) * 0.3, 1.73 + (0.03 - 1.73) * 0.62
        addBeam(base, B(x, y0, -z0), B(x, y1, z1), 0.14, PILLAR_BRACE)
        addBeam(base, B(x, y0, z0), B(x, y1, -z1), 0.14, PILLAR_BRACE)
        addBox(base, (0.9, 1.0, 1.0), B(x, AXLE_HEIGHT, 0), PILLAR)
        addSphere(base, 0.32, B(x, AXLE_HEIGHT + 0.65, 0), GOLD, segments=12)
    addCylinder(base, 0.35, PILLAR_X * 2 + 0.8, B(0, AXLE_HEIGHT, 0), AXLE, rotation=(0, math.pi / 2, 0), vertices=16)
    for x in (-PILLAR_X - 0.5, PILLAR_X + 0.5):
        addCylinder(base, 0.5, 0.12, B(x, AXLE_HEIGHT, 0), GOLD, rotation=(0, math.pi / 2, 0), vertices=20)


def buildArm(arm):
    # 축 기준 좌표: 분홍 팔(흰 줄무늬 띠 + 앞뒤 전구) + 위쪽 균형추(금테) + 축 통
    addBox(arm, (0.8, 0.8, ARM_LENGTH), B(0, -ARM_LENGTH / 2, 0), ARM)
    for index in range(1, 7):
        y = -index * ARM_LENGTH / 7
        addBox(arm, (0.86, 0.86, 0.18), B(0, y, 0), ARM_STRIPE, bevel=False)
    count = 0
    for index in range(12):
        y = -0.6 - index * 0.55
        for z in (-0.43, 0.43):
            addSphere(arm, 0.08, B(0, y, z), BULB_COLORS[count % len(BULB_COLORS)], segments=8, prefix="glow")
            count += 1
    addCylinder(arm, 0.55, 1.2, B(0, 0, 0), WEIGHT, rotation=(0, math.pi / 2, 0), vertices=20)
    addBox(arm, (0.6, 0.6, 2.0), B(0, 1.0, 0), ARM)
    addBox(arm, (1.8, 1.8, 1.8), B(0, 2.1, 0), WEIGHT)
    for z in (-0.92, 0.92):
        addBox(arm, (1.9, 0.08, 1.9), B(0, 2.1, z), WEIGHT_PLATE, bevel=False)
    # 팔 끝 원판 연결부 (원뿔)
    bpy.ops.mesh.primitive_cone_add(vertices=20, radius1=0.4, radius2=0.8, depth=0.5, location=B(0, -ARM_LENGTH + 0.1, 0))
    finish(bpy.context.active_object, arm, GOLD)


def buildWheel(wheel):
    # 원판 기준 좌표: 파란 원판 + 하늘색 윗면 + 금테 + 아래 전구 + 버킷 좌석 8 (바깥을 바라봄)
    addCylinder(wheel, WHEEL_RADIUS + 0.4, 0.3, B(0, 0, 0), WHEEL, vertices=40)
    addCylinder(wheel, WHEEL_RADIUS + 0.2, 0.04, B(0, 0.16, 0), WHEEL_TOP, vertices=40)
    bpy.ops.mesh.primitive_torus_add(major_radius=WHEEL_RADIUS + 0.4, minor_radius=0.1, major_segments=48, minor_segments=8, location=B(0, 0, 0))
    finish(bpy.context.active_object, wheel, GOLD)
    for index in range(16):
        angle = index / 16 * math.pi * 2
        addSphere(wheel, 0.1, B(math.cos(angle) * (WHEEL_RADIUS + 0.1), -0.18, math.sin(angle) * (WHEEL_RADIUS + 0.1)), BULB_COLORS[index % len(BULB_COLORS)], segments=8, prefix="glow")
    # 가운데는 팔 끝 연결 원뿔(dt_arm)이 내려와 덮으므로 비워 둠
    for index in range(SEAT_COUNT):
        angle = index / SEAT_COUNT * math.pi * 2
        sx, sz = math.cos(angle) * WHEEL_RADIUS, math.sin(angle) * WHEEL_RADIUS
        facing = math.atan2(math.cos(angle), math.sin(angle))
        cos_f, sin_f = math.cos(facing), math.sin(facing)

        def place(ox, oy, oz):
            # 좌석 로컬 (게임) → 원판 (게임) → Blender
            return B(sx + ox * cos_f + oz * sin_f, 0.15 + oy, sz - ox * sin_f + oz * cos_f)

        rotation = (0, 0, facing)
        addBox(wheel, (0.8, 0.7, 0.2), place(0, 0.1, 0), SEAT, rotation=rotation)
        addBox(wheel, (0.84, 0.16, 1.0), place(0, 0.6, -0.34), SEAT, rotation=rotation)
        for ox in (-0.42, 0.42):
            addBox(wheel, (0.1, 0.7, 0.45), place(ox, 0.3, -0.02), SEAT_TRIM, rotation=rotation)
        # 어깨 안전바 (금색 관 두 줄: 등받이 위에서 앞으로 휘어 내려옴)
        for ox in (-0.2, 0.2):
            points = [place(ox, 1.1, -0.3), place(ox, 1.2, 0.0), place(ox, 0.95, 0.25), place(ox, 0.55, 0.32)]
            addTube(wheel, points, 0.04, GOLD)


def placeStars(arm):
    mesh = bpy.data.meshes.get("twist_star")
    if mesh is None:
        print("twist_star 메시 없음 — 별 장식 생략")
        return
    # 메시는 게임 +z(Blender −Y) 를 바라보게 구워 둠 — 뒤쪽 별은 Z 축 180° 돌려 바깥을 보게
    for name, z, rot in (("twist_star_front", 1.05, 0.0), ("twist_star_back", -1.05, math.pi)):
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.scene.collection.objects.link(obj)
        obj.parent = arm
        obj.location = B(0, 2.1, z)
        obj.rotation_euler = (0, 0, rot)


def clear(name):
    old = bpy.data.objects.get(name)
    if old is not None:
        for child in list(old.children_recursive):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(old, do_unlink=True)


def main():
    for name in ("dt_base", "dt_arm", "dt_wheel"):
        clear(name)
    base = bpy.data.objects.new("dt_base", None)
    arm = bpy.data.objects.new("dt_arm", None)
    wheel = bpy.data.objects.new("dt_wheel", None)
    for obj in (base, arm, wheel):
        bpy.context.scene.collection.objects.link(obj)
    buildBase(base)
    buildPillars(base)
    buildArm(arm)
    buildWheel(wheel)
    placeStars(arm)
    joinChildren(base, "base")
    for obj in list(arm.children):
        if obj.name.startswith("twist_star"):
            obj.name = obj.name.replace("twist_star", "figurehead_star")
    joinChildren(arm, "arm")
    joinChildren(wheel, "wheel")
    arm.location = (0, 0, AXLE_HEIGHT)
    wheel.location = (0, 0, AXLE_HEIGHT - WHEEL_DROP)
    print("base", len(base.children), "arm", len(arm.children), "wheel", len(wheel.children))


if __name__ == "__main__":
    main()
