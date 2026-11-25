# DUCK-X (Blender bpy) — 승강장 dx_station / 앞 칸 dx_car_front / 뒤 칸 dx_car 빈 객체 세 개
# 레일·목재 구조물·체인은 경로가 원본이라 게임 코드(duckX.ts)가 만들고, 여기서는 경로와 무관한 승강장과 열차 칸만 만듦
# 치수는 client/src/world/rides/duckX.ts · common.ts 와 같음
#   승강장: 로컬 원점 = 승강장 바닥 가운데, 승강장판 24 × 3 × 0.6, 트랙 중심 로컬 z −2.6 · 높이 2
#   열차 칸: 로컬 원점 = 경로 위 0.15, 정면 +z, 좌석 2줄 × 2열 (x ±0.475, z ±0.55, 앉는 높이 0.7), 칸 간격 2.9
# 좌표: 게임 코드 (x, y, z) → Blender (x, −z, y). 세 빈 객체를 x 로 띄워 놓고 만들며, 게임 코드는 위치를 0 으로 되돌려 붙임
# 재질 이름 규칙: toon_<rrggbb> 툰 단색, glow_<rrggbb> 빛나는 단색. 도형 함수는 duck_voyage_build.py 의 것을 불러와 씀
# 생성한 오리 머리(메시 dx_duck, 중심 원점·게임 +z 를 바라봄)가 있으면 앞 칸 코에 붙임
# 사용: exec(open(r"...\scripts\duck_x_build.py", encoding="utf-8").read(), {"__name__": "__main__"})
import math
import os

import bmesh
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

STATION_WIDTH = 24
STATION_DEPTH = 3
TRACK_Z = -2.6
ROOF_Y = 4.9
ROOF_FRONT = 2.1
ROOF_BACK = -4.3
POST_XS = [-11.6, -7.7, -3.9, 0, 3.9, 7.7, 11.6]
CAR_LENGTH = 2.6
CAR_WIDTH = 2.2
SEAT_XS = (-0.475, 0.475)
SEAT_ZS = (0.55, -0.55)
GAUGE = 1.3

PLATFORM = "d4a373"
PLANK_LINE = "b5835a"
SAFETY = "ffd166"
POST = "fefae0"
POST_BASE = "7f5539"
ROOF_STRIPES = ["e63946", "fefae0"]
ROOF_EDGE = "1d3557"
SIGN = "1d3557"
SIGN_TEXT = "ffd60a"
GATE = "ffb703"
BULB_COLORS = ["ff5a4e", "ffd166", "7bc96f", "5ec8ff", "c7a8ff", "ff8fab"]
CHASSIS = "3d405b"
WHEEL = "adb5bd"
CAR_FRONT_BODY = "2a9d8f"
CAR_BODY = "40b5a6"
CAR_STRIPE = "ffd166"
CAR_TRIM = "fefae0"
SEAT = "e76f51"
HEADREST = "f4a261"
LAP_BAR = "e9ecef"
HEADLIGHT = "fff3b0"


def addScallops(parent, xs, z, y, axis_rot, colors, radius=0.38):
    # 처마 물결 장식: 원판을 만들어 위쪽 절반을 잘라냄 (회전목마·CRAZY BUMP와 같은 장식)
    for index, x in enumerate(xs):
        bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=0.05, location=B(x, y, z), rotation=axis_rot)
        scallop = bpy.context.active_object
        bm = bmesh.new()
        bm.from_mesh(scallop.data)
        cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, 1, 0), clear_outer=True)
        edges = [item for item in cut["geom_cut"] if isinstance(item, bmesh.types.BMEdge)]
        bmesh.ops.holes_fill(bm, edges=edges, sides=0)
        bm.to_mesh(scallop.data)
        bm.free()
        finish(scallop, parent, colors[index % len(colors)], smooth=False)


def buildPlatform(station):
    # 승강장판 + 나무 판자 줄눈 + 트랙 쪽 노란 안전선
    addBox(station, (STATION_WIDTH, STATION_DEPTH, 0.6), B(0, 0.3, 0), PLATFORM, bevel=False)
    for index in range(1, 48):
        x = -STATION_WIDTH / 2 + index * 0.5
        addBox(station, (0.03, STATION_DEPTH - 0.1, 0.01), B(x, 0.605, 0), PLANK_LINE, bevel=False)
    addBox(station, (STATION_WIDTH, 0.25, 0.02), B(0, 0.61, -STATION_DEPTH / 2 + 0.2), SAFETY, bevel=False)


def buildPosts(station):
    # 앞뒤 두 줄 기둥 (크림색 + 갈색 받침·머리) + 트랙 위로 내민 지붕을 받치는 까치발
    for x in POST_XS:
        for z in (1.3, -1.3):
            addCylinder(station, 0.13, ROOF_Y - 0.6, B(x, 0.6 + (ROOF_Y - 0.6) / 2, z), POST, vertices=12)
            addCylinder(station, 0.22, 0.25, B(x, 0.72, z), POST_BASE, vertices=12)
            addCylinder(station, 0.2, 0.18, B(x, ROOF_Y - 0.12, z), POST_BASE, vertices=12)
        addBeam(station, B(x, 4.1, -1.3), B(x, ROOF_Y - 0.1, -2.6), 0.12, POST_BASE)
    # 기둥 위 가로 보
    for z in (1.3, -1.3):
        addBox(station, (STATION_WIDTH, 0.22, 0.25), B(0, ROOF_Y - 0.1, z), POST_BASE)


def buildRoof(station):
    # 빨강·흰 줄무늬 박공 지붕 (트랙까지 덮음) + 용마루 + 처마 물결 장식 + 처마 전구
    depth = ROOF_FRONT - ROOF_BACK
    ridge_z = (ROOF_FRONT + ROOF_BACK) / 2
    rise = 1.0
    half = depth / 2
    angle = math.atan2(rise, half)
    slope = math.hypot(half, rise)
    stripes = 16
    stripe_width = (STATION_WIDTH + 1) / stripes
    for side in (-1, 1):
        center_z = ridge_z + side * half / 2
        for index in range(stripes):
            x = -(STATION_WIDTH + 1) / 2 + (index + 0.5) * stripe_width
            # 게임 x 축을 따라 기울어진 판: Blender X 축 회전
            addBox(station, (stripe_width + 0.01, slope + 0.1, 0.16), B(x, ROOF_Y + 0.1 + rise / 2, center_z),
                   ROOF_STRIPES[index % 2], rotation=(side * angle, 0, 0), bevel=False)
    addCylinder(station, 0.14, STATION_WIDTH + 1.2, B(0, ROOF_Y + 0.15 + rise, ridge_z), ROOF_EDGE, rotation=(0, math.pi / 2, 0), vertices=10)
    # 양끝 박공 (삼각형 판)
    for end in (-1, 1):
        mesh = bpy.data.meshes.new("gable")
        bm = bmesh.new()
        x = end * (STATION_WIDTH + 1) / 2
        a = bm.verts.new(B(x, ROOF_Y + 0.1, ROOF_FRONT))
        b = bm.verts.new(B(x, ROOF_Y + 0.1, ROOF_BACK))
        c = bm.verts.new(B(x, ROOF_Y + 0.1 + rise, ridge_z))
        bm.faces.new((a, b, c))
        bm.to_mesh(mesh)
        bm.free()
        gable = bpy.data.objects.new("gable", mesh)
        bpy.context.scene.collection.objects.link(gable)
        gable.modifiers.new("두께", "SOLIDIFY").thickness = 0.15
        finish(gable, station, ROOF_EDGE, smooth=False)
    # 처마 테두리 + 물결 장식 (앞뒤)
    xs = [-(STATION_WIDTH + 1) / 2 + 0.4 + index * 0.8 for index in range(int((STATION_WIDTH + 0.2) / 0.8))]
    for z, offset in ((ROOF_FRONT, 0.05), (ROOF_BACK, -0.05)):
        addBox(station, (STATION_WIDTH + 1, 0.12, 0.25), B(0, ROOF_Y + 0.05, z), ROOF_EDGE, bevel=False)
        addScallops(station, xs, z + offset, ROOF_Y - 0.05, (math.pi / 2, 0, 0), ROOF_STRIPES)
    # 처마 전구 (앞쪽)
    for index, x in enumerate(xs[::2]):
        addSphere(station, 0.09, B(x, ROOF_Y - 0.12, ROOF_FRONT - 0.15), BULB_COLORS[index % len(BULB_COLORS)], segments=8, prefix="glow")


def buildSign(station):
    # 지붕 앞 간판: 남색 판 + 노란 빛나는 글자 + 둘레 전구 + 받침 기둥
    sign_y = ROOF_Y + 1.9
    sign_z = ROOF_FRONT - 0.6
    addBox(station, (7.4, 0.2, 1.5), B(0, sign_y, sign_z), SIGN)
    for x in (-2.4, 2.4):
        addBox(station, (0.15, 0.15, 1.2), B(x, ROOF_Y + 0.75, sign_z - 0.05), POST_BASE)
    bpy.ops.object.text_add(location=B(0, sign_y - 0.42, sign_z + 0.11), rotation=(math.pi / 2, 0, 0))
    text = bpy.context.active_object
    text.data.body = "DUCK-X"
    text.data.align_x = "CENTER"
    text.data.size = 1.0
    text.data.extrude = 0.04
    bpy.ops.object.convert(target="MESH")
    text = bpy.context.active_object
    finish(text, station, SIGN_TEXT, prefix="glow", smooth=False)
    count = 0
    for x in [-3.5 + index * 0.5 for index in range(15)]:
        for y in (sign_y + 0.66, sign_y - 0.66):
            addSphere(station, 0.07, B(x, y, sign_z + 0.12), BULB_COLORS[count % len(BULB_COLORS)], segments=8, prefix="glow")
            count += 1


def buildGates(station):
    # 트랙 쪽 탑승 문 (좌석 자리마다 노란 낮은 문, 사이사이 난간)
    rail_z = -STATION_DEPTH / 2 + 0.12
    for x in [-9 + index * 1.5 for index in range(13)]:
        addBox(station, (0.08, 0.08, 0.9), B(x, 1.05, rail_z), POST_BASE)
    for start in range(12):
        x0 = -9 + start * 1.5
        color = GATE if start % 2 == 0 else POST
        addTube(station, [B(x0 + 0.08, 1.4, rail_z), B(x0 + 1.42, 1.4, rail_z)], 0.04, color)
        addTube(station, [B(x0 + 0.08, 0.95, rail_z), B(x0 + 1.42, 0.95, rail_z)], 0.03, color)


def buildCar(car, body_color, is_front):
    # 아래 차대 + 바퀴 (레일 위 굴림 바퀴)
    addBox(car, (1.9, CAR_LENGTH - 0.2, 0.22), B(0, 0.12, 0), CHASSIS)
    for z in (-0.85, 0.85):
        addBox(car, (GAUGE + 0.2, 0.3, 0.14), B(0, 0.02, z), CHASSIS)
        for x in (-GAUGE / 2, GAUGE / 2):
            for dz in (-0.2, 0.2):
                addCylinder(car, 0.13, 0.1, B(x, 0.0, z + dz), WHEEL, rotation=(0, math.pi / 2, 0), vertices=14)
    # 차체 통: 바닥 + 옆판 두 장 + 앞판 + 뒤판 (둥근 모서리)
    half = CAR_LENGTH / 2
    addBox(car, (CAR_WIDTH - 0.1, CAR_LENGTH, 0.16), B(0, 0.3, 0), body_color)
    for side in (-1, 1):
        addBox(car, (0.18, CAR_LENGTH, 0.72), B(side * (CAR_WIDTH / 2 - 0.09), 0.62, 0), body_color)
        # 옆판 금색 띠 + 위 테두리 관
        addBox(car, (0.03, CAR_LENGTH - 0.3, 0.12), B(side * (CAR_WIDTH / 2 + 0.005), 0.6, 0), CAR_STRIPE, bevel=False)
        addTube(car, [B(side * (CAR_WIDTH / 2 - 0.09), 1.0, -half + 0.05), B(side * (CAR_WIDTH / 2 - 0.09), 1.0, half - 0.05)], 0.07, CAR_TRIM)
    addBox(car, (CAR_WIDTH, 0.18, 0.8), B(0, 0.66, half - 0.09), body_color)
    addBox(car, (CAR_WIDTH, 0.16, 0.5), B(0, 0.5, -half + 0.08), body_color)
    addTube(car, [B(-CAR_WIDTH / 2 + 0.1, 1.06, half - 0.09), B(CAR_WIDTH / 2 - 0.1, 1.06, half - 0.09)], 0.07, CAR_TRIM)
    # 뒤 연결고리 (다음 칸과 이어짐)
    addCylinder(car, 0.07, 0.4, B(0, 0.12, -half - 0.12), CHASSIS, rotation=(math.pi / 2, 0, 0), vertices=8)
    # 좌석 2줄 × 2열: 방석 + 기울어진 등받이 + 둥근 머리 받침 + 무릎 안전바
    for z in SEAT_ZS:
        for x in SEAT_XS:
            addBox(car, (0.72, 0.6, 0.16), B(x, 0.6, z + 0.02), SEAT)
            addBox(car, (0.72, 0.14, 0.75), B(x, 0.95, z - 0.33), SEAT, rotation=(math.radians(-10), 0, 0))
            bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=7, radius=0.24, location=B(x, 1.42, z - 0.4))
            headrest = bpy.context.active_object
            headrest.scale = (1.15, 0.5, 0.9)
            finish(headrest, car, HEADREST)
            addTube(car, [B(x - 0.3, 0.75, z + 0.2), B(x - 0.28, 0.98, z + 0.3), B(x + 0.28, 0.98, z + 0.3), B(x + 0.3, 0.75, z + 0.2)], 0.035, LAP_BAR)
    if not is_front:
        return
    # 앞 칸 코: 둥근 뱃머리 + 금색 띠 + 전조등 두 개 + 오리 머리 장식
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1.0, location=B(0, 0.6, half + 0.05))
    nose = bpy.context.active_object
    nose.scale = (CAR_WIDTH / 2 - 0.02, 0.6, 0.42)
    finish(nose, car, body_color)
    # 코 둘레 금색 띠 (코 타원 적도를 따라 살짝 바깥)
    band = [B(math.cos(t) * (CAR_WIDTH / 2 + 0.01), 0.6, half + 0.05 + math.sin(t) * 0.45) for t in [index / 12 * math.pi for index in range(13)]]
    addTube(car, band, 0.05, CAR_STRIPE)
    for x in (-0.6, 0.6):
        addSphere(car, 0.12, B(x, 0.45, half + 0.42), HEADLIGHT, segments=10, prefix="glow")
    mesh = bpy.data.meshes.get("dx_duck")
    if mesh is None:
        print("dx_duck 메시 없음 — 오리 장식 생략")
        return
    figure = bpy.data.objects.new("figurehead_duck", mesh)
    bpy.context.scene.collection.objects.link(figure)
    figure.parent = car
    # 오리 몸 전체가 보이게 코 위에 올려 앉힘
    figure.location = B(0, 1.62, half + 0.1)
    figure.scale = (1.2, 1.2, 1.2)


def clear(name):
    old = bpy.data.objects.get(name)
    if old is not None:
        for child in list(old.children_recursive):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(old, do_unlink=True)


def main():
    for name in ("dx_station", "dx_car_front", "dx_car"):
        clear(name)
    station = bpy.data.objects.new("dx_station", None)
    front = bpy.data.objects.new("dx_car_front", None)
    car = bpy.data.objects.new("dx_car", None)
    for obj in (station, front, car):
        bpy.context.scene.collection.objects.link(obj)
    buildPlatform(station)
    buildPosts(station)
    buildRoof(station)
    buildSign(station)
    buildGates(station)
    buildCar(front, CAR_FRONT_BODY, True)
    buildCar(car, CAR_BODY, False)
    joinChildren(station, "station")
    joinChildren(front, "front")
    joinChildren(car, "car")
    # 확인하기 쉽게 열차 칸을 승강장 앞쪽에 띄워 둠 (게임 코드는 위치를 0 으로 되돌림)
    front.location = (-3, 8, 0)
    car.location = (3, 8, 0)
    print("station", len(station.children), "front", len(front.children), "car", len(car.children))


if __name__ == "__main__":
    main()
