# DUCK FALL 리버싱 룸 (Blender bpy) — 물길을 덮는 돌집: 돌 벽·박공 지붕·입구 아치·번개 간판·먹구름·등불 → 빈 객체 df_room
# 치수는 client/src/world/rides/duckFall.ts createReversingRoom 과 같음 (벽 x ±1.9, 길이 5.5, 지붕 높이 3.1)
# 로컬 좌표: 원점 = 물길 높이 − 0.6, 게임 +z = 물길 진행 방향. 게임 코드 (x, y, z) → Blender (x, −z, y)
# 도형 함수는 duck_voyage_build.py 의 것을 불러와 씀
# 사용: exec(open(r"...\scripts\duck_fall_room_build.py", encoding="utf-8").read(), {"__name__": "__main__"})
import math
import os
import random

import bmesh
import bpy

_helpers = {"__name__": "duck_voyage_helpers"}
exec(open(os.path.join(r"D:\work\study\playground_vibe\scripts", "duck_voyage_build.py"), encoding="utf-8").read(), _helpers)
B = _helpers["B"]
finish = _helpers["finish"]
addBox = _helpers["addBox"]
addCylinder = _helpers["addCylinder"]
addSphere = _helpers["addSphere"]
joinChildren = _helpers["joinChildren"]

LENGTH = 5.5
WALL_X = 1.9
WALL_TOP = 2.9
ROOF_Y = 3.1

# 공원 파스텔 톤 — 밝은 크림 돌벽 + 선명한 파란 지붕 (번개 간판·아치의 노랑이 잘 보이게)
WALL = "f3e6cc"
STONE_COLORS = ["e8d5b0", "f8eedb", "dcc59c"]
ROOF = "4d96ff"
ROOF_EDGE = "2f6fd6"
ARCH = "ffd60a"
BOLT = "ffd60a"
CLOUD_COLORS = ["dfe7f2", "c9d6e8", "f1f5fa"]
LANTERN = "fff3b0"
WOOD = "7f5539"


def buildWalls(room):
    rng = random.Random(7)
    for side in (-1, 1):
        x = side * WALL_X
        addBox(room, (0.4, LENGTH, 3.2), B(x, 1.3, 0), WALL)
        # 바깥면 돌 쌓기 (줄마다 엇갈린 돌덩이)
        for row in range(6):
            y = 0.0 + row * 0.5
            offset = 0.45 if row % 2 else 0.0
            z = -LENGTH / 2 + 0.45 + offset
            while z < LENGTH / 2 - 0.3:
                width = 0.7 + rng.random() * 0.3
                addBox(room, (0.12, width - 0.08, 0.42), B(x + side * 0.24, y + 0.25, z), STONE_COLORS[rng.randrange(3)])
                z += width
        # 등불 (입구 양옆, 앞뒤)
        for end in (-1, 1):
            z = end * (LENGTH / 2 + 0.15)
            addBox(room, (0.12, 0.12, 0.5), B(x + side * 0.1, 2.0, z), WOOD)
            addCylinder(room, 0.14, 0.3, B(x + side * 0.1, 1.65, z + end * 0.12), LANTERN, vertices=10, prefix="glow")


def buildRoof(room):
    # 박공 지붕 (물길 방향으로 길게) + 용마루 + 처마 테두리
    half = WALL_X + 0.7
    rise = 1.3
    for side in (-1, 1):
        angle = math.atan2(rise, half)
        slope = math.hypot(half, rise)
        center_x = side * half / 2
        center_y = ROOF_Y + rise / 2
        addBox(room, (slope + 0.1, LENGTH + 0.9, 0.22), B(center_x, center_y, 0), ROOF, rotation=(0, side * angle, 0))
        # 지붕 줄무늬 (기와 줄)
        for index in range(1, 4):
            t = index / 4
            addBox(room, (0.06, LENGTH + 0.9, 0.08), B(side * half * (1 - t), ROOF_Y + rise * t + 0.13, 0), ROOF_EDGE, rotation=(0, side * angle, 0))
    addCylinder(room, 0.16, LENGTH + 1.0, B(0, ROOF_Y + rise + 0.05, 0), ROOF_EDGE, rotation=(math.pi / 2, 0, 0), vertices=10)
    # 앞뒤 박공 벽 (삼각형)
    for end in (-1, 1):
        mesh = bpy.data.meshes.new("gable")
        bm = bmesh.new()
        z = end * (LENGTH / 2 + 0.05)
        a = bm.verts.new(B(-WALL_X - 0.2, ROOF_Y - 0.15, z))
        b = bm.verts.new(B(WALL_X + 0.2, ROOF_Y - 0.15, z))
        c = bm.verts.new(B(0, ROOF_Y + rise - 0.05, z))
        bm.faces.new((a, b, c))
        bm.to_mesh(mesh)
        bm.free()
        gable = bpy.data.objects.new("gable", mesh)
        bpy.context.scene.collection.objects.link(gable)
        gable.modifiers.new("두께", "SOLIDIFY").thickness = 0.2
        # 박공은 진한 파랑 — 노란 번개 간판이 잘 보이게
        finish(gable, room, ROOF_EDGE, smooth=False)
        addBox(room, (2 * WALL_X + 0.6, 0.3, 0.35), B(0, ROOF_Y - 0.2, z), ROOF_EDGE)


def buildArches(room):
    # 입구 아치 (노란 반원 테두리) — 물길 위를 넘는 반원
    for end in (-1, 1):
        z = end * (LENGTH / 2 + 0.12)
        bpy.ops.mesh.primitive_torus_add(major_radius=1.65, minor_radius=0.1, major_segments=32, minor_segments=8,
                                         location=B(0, 1.25, z), rotation=(math.pi / 2, 0, 0))
        arch = bpy.context.active_object
        bm = bmesh.new()
        bm.from_mesh(arch.data)
        # 아래 절반 잘라냄 (로컬 −y 가 회전 뒤 월드 아래)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=(0, -1, 0), clear_outer=True)
        bm.to_mesh(arch.data)
        bm.free()
        finish(arch, room, ARCH)


def buildBolt(room):
    # 번개 간판 (지그재그, 스스로 빛남) — 앞뒤 박공에
    outline = [(-0.15, 0.9), (0.35, 0.9), (0.05, 0.25), (0.35, 0.25), (-0.3, -0.75), (-0.05, -0.05), (-0.35, -0.05)]
    for end in (-1, 1):
        mesh = bpy.data.meshes.new("bolt")
        bm = bmesh.new()
        z = end * (LENGTH / 2 + 0.2)
        verts = [bm.verts.new(B(x * 1.0 * end, ROOF_Y + 0.6 + y * 0.6, z)) for x, y in outline]
        bm.faces.new(verts)
        bm.to_mesh(mesh)
        bm.free()
        bolt = bpy.data.objects.new("bolt", mesh)
        bpy.context.scene.collection.objects.link(bolt)
        bolt.modifiers.new("두께", "SOLIDIFY").thickness = 0.08
        finish(bolt, room, BOLT, prefix="glow", smooth=False)


def buildClouds(room):
    # 지붕 위 먹구름 두 덩이 (동글동글한 구 묶음)
    rng = random.Random(3)
    for cz in (-1.4, 1.6):
        for index in range(6):
            x = rng.uniform(-1.2, 1.2)
            z = cz + rng.uniform(-0.6, 0.6)
            y = ROOF_Y + 1.9 + rng.uniform(0, 0.5)
            addSphere(room, rng.uniform(0.45, 0.7), B(x, y, z), CLOUD_COLORS[index % 3], segments=12)


def main():
    old = bpy.data.objects.get("df_room")
    if old is not None:
        for child in list(old.children_recursive):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(old, do_unlink=True)
    room = bpy.data.objects.new("df_room", None)
    bpy.context.scene.collection.objects.link(room)
    buildWalls(room)
    buildRoof(room)
    buildArches(room)
    buildBolt(room)
    buildClouds(room)
    joinChildren(room, "room")
    print("room 메시", len(room.children))


if __name__ == "__main__":
    main()
