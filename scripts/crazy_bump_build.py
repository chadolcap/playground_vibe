# CRAZY BUMP 경기장 (Blender bpy) — 바닥·범퍼 벽·기둥·지붕 트러스·반투명 차양·천장 전기망·조명을 빈 객체 crazy_bump_arena 에 묶음
# 치수는 shared/crazyBump.ts (경기장 18 × 14) 와 client/src/world/rides/crazyBump.ts (지붕 높이 5.2, 정면 +z 가운데 출입구 폭 4) 와 같음
# 좌표: 게임 코드 (x, y, z) → Blender (x, −z, y)
# 재질 이름 규칙 (게임 코드가 읽어 툰 재질로 바꿈): toon_<rrggbb> 툰 단색, glow_<rrggbb> 빛나는 단색, glass_<rrggbb> 반투명 단색
# 도형 함수(addBox·addCylinder·addSphere·addBeam·addTube·joinChildren)는 duck_voyage_build.py 의 것을 불러와 씀
# 사용: exec(open(r"...\scripts\crazy_bump_build.py", encoding="utf-8").read(), {"__name__": "__main__"})
import os

import bpy

_helpers = {"__name__": "duck_voyage_helpers"}
exec(open(os.path.join(r"D:\work\study\playground_vibe\scripts", "duck_voyage_build.py"), encoding="utf-8").read(), _helpers)
B = _helpers["B"]
getMaterial = _helpers["getMaterial"]
finish = _helpers["finish"]
addBox = _helpers["addBox"]
addCylinder = _helpers["addCylinder"]
addSphere = _helpers["addSphere"]
addBeam = _helpers["addBeam"]
addTube = _helpers["addTube"]
joinChildren = _helpers["joinChildren"]

ARENA_WIDTH = 18
ARENA_DEPTH = 14
ROOF_HEIGHT = 5.2
GATE_HALF = 2.0
WALL_HEIGHT = 0.8

FLOOR = "4a4e69"
FLOOR_LINE = "6c7093"
WALL = "ffd60a"
RUBBER = "2b2d42"
PILLAR = "ffd60a"
PILLAR_RING = "ef476f"
GOLD = "ffd166"
ROOF_FRAME = "ffd60a"
CANOPY = "ff8fab"
GRID = "adb5bd"
BULB_COLORS = ["ff5a4e", "ffd166", "7bc96f", "5ec8ff", "c7a8ff", "ff8fab"]


def buildFloor(arena):
    # 강철 바닥판 + 1m 간격 줄눈 (밝은 선)
    addBox(arena, (ARENA_WIDTH, ARENA_DEPTH, 0.3), B(0, 0.15, 0), FLOOR, bevel=False)
    for index in range(1, ARENA_WIDTH):
        x = -ARENA_WIDTH / 2 + index
        addBox(arena, (0.04, ARENA_DEPTH - 0.4, 0.01), B(x, 0.305, 0), FLOOR_LINE, bevel=False)
    for index in range(1, ARENA_DEPTH):
        z = -ARENA_DEPTH / 2 + index
        addBox(arena, (ARENA_WIDTH - 0.4, 0.04, 0.01), B(0, 0.305, z), FLOOR_LINE, bevel=False)


def wallSegments():
    # (시작, 끝) 게임 좌표 xz — 정면(+z) 가운데 출입구는 비움
    w, d = ARENA_WIDTH / 2, ARENA_DEPTH / 2
    return [
        ((-w, -d), (w, -d)),
        ((-w, -d), (-w, d)),
        ((w, -d), (w, d)),
        ((-w, d), (-GATE_HALF, d)),
        ((GATE_HALF, d), (w, d)),
    ]


def buildWalls(arena):
    # 노란 벽 + 안쪽 검은 고무 범퍼 관 + 위쪽 둥근 덮개
    for (ax, az), (bx, bz) in wallSegments():
        length = max(abs(bx - ax), abs(bz - az))
        cx, cz = (ax + bx) / 2, (az + bz) / 2
        along_x = abs(bx - ax) > abs(bz - az)
        size = (length, 0.2, WALL_HEIGHT) if along_x else (0.2, length, WALL_HEIGHT)
        addBox(arena, size, B(cx, 0.3 + WALL_HEIGHT / 2, cz), WALL)
        addTube(arena, [B(ax, 0.3 + WALL_HEIGHT, az), B(bx, 0.3 + WALL_HEIGHT, bz)], 0.13, WALL)
        # 고무 범퍼: 벽 안쪽으로 살짝 띄움 (경기장 가운데 방향)
        inward_x = 0 if along_x else (-0.18 if cx > 0 else 0.18)
        inward_z = (-0.18 if cz > 0 else 0.18) if along_x else 0
        addTube(arena, [B(ax + inward_x, 0.62, az + inward_z), B(bx + inward_x, 0.62, bz + inward_z)], 0.14, RUBBER)
    # 출입구 기둥 두 개 + 금색 구슬
    for x in (-GATE_HALF, GATE_HALF):
        addCylinder(arena, 0.16, 1.4, B(x, 1.0, ARENA_DEPTH / 2), PILLAR_RING, vertices=12)
        addSphere(arena, 0.2, B(x, 1.8, ARENA_DEPTH / 2), GOLD)


def buildPillars(arena):
    # 네 귀퉁이 기둥 (노랑 + 분홍 고리 줄무늬 + 금색 받침·머리)
    for x in (-ARENA_WIDTH / 2, ARENA_WIDTH / 2):
        for z in (-ARENA_DEPTH / 2, ARENA_DEPTH / 2):
            addCylinder(arena, 0.25, ROOF_HEIGHT, B(x, ROOF_HEIGHT / 2, z), PILLAR, vertices=16)
            for y in (1.2, 2.2, 3.2, 4.2):
                addCylinder(arena, 0.29, 0.22, B(x, y, z), PILLAR_RING, vertices=16)
            addCylinder(arena, 0.45, 0.25, B(x, 0.42, z), GOLD, vertices=16)
            addSphere(arena, 0.38, B(x, ROOF_HEIGHT + 0.45, z), GOLD, segments=14)


def buildRoof(arena):
    # 테두리 보 + X자 트러스 + 반투명 차양 + 천장 전기망 + 처마 전구
    w, d = ARENA_WIDTH / 2, ARENA_DEPTH / 2
    corners = [(-w, -d), (w, -d), (w, d), (-w, d)]
    for index in range(4):
        (ax, az), (bx, bz) = corners[index], corners[(index + 1) % 4]
        addBeam(arena, B(ax, ROOF_HEIGHT, az), B(bx, ROOF_HEIGHT, bz), 0.3, ROOF_FRAME)
    for sign in (-1, 1):
        addBeam(arena, B(-w, ROOF_HEIGHT + 0.05, -d * sign), B(w, ROOF_HEIGHT + 0.05, d * sign), 0.16, ROOF_FRAME)
    for x in (-w / 2, 0, w / 2):
        addBeam(arena, B(x, ROOF_HEIGHT, -d), B(x, ROOF_HEIGHT, d), 0.16, ROOF_FRAME)
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(0, ROOF_HEIGHT + 0.3, 0))
    canopy = bpy.context.active_object
    canopy.scale = (ARENA_WIDTH + 1, ARENA_DEPTH + 1, 0.12)
    finish(canopy, arena, CANOPY, prefix="glass", smooth=False)
    # 전기망: 차의 막대 끝이 닿는 천장 격자
    for index in range(1, 12):
        x = -w + index * ARENA_WIDTH / 12
        addBox(arena, (0.03, ARENA_DEPTH - 0.3, 0.03), B(x, ROOF_HEIGHT - 0.12, 0), GRID, bevel=False)
    for index in range(1, 10):
        z = -d + index * ARENA_DEPTH / 10
        addBox(arena, (ARENA_WIDTH - 0.3, 0.03, 0.03), B(0, ROOF_HEIGHT - 0.12, z), GRID, bevel=False)
    # 처마 물결 장식 (분홍·흰 반원 — 원판을 만들어 위쪽 절반을 잘라냄, 회전목마와 같은 장식)
    import bmesh
    import math
    count = 0
    for index in range(4):
        (ax, az), (bx, bz) = corners[index], corners[(index + 1) % 4]
        length = max(abs(bx - ax), abs(bz - az))
        steps = int(length / 0.9)
        # 이 변의 바깥 방향 (게임 좌표) → 원판 축 방향
        outward_x = 0.0 if az == bz else (0.35 if ax > 0 else -0.35)
        outward_z = 0.0 if ax == bx else (0.35 if az > 0 else -0.35)
        for step in range(steps):
            t = (step + 0.5) / steps
            x, z = ax + (bx - ax) * t + outward_x, az + (bz - az) * t + outward_z
            # 원판 축(로컬 Z)을 바깥 방향으로: 게임 x 쪽 변이면 Blender Y 축 회전, z 쪽 변이면 X 축 회전
            rotation = (math.pi / 2, 0, 0) if outward_x == 0 else (0, math.pi / 2, 0)
            bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.45, depth=0.05, location=B(x, ROOF_HEIGHT - 0.05, z), rotation=rotation)
            scallop = bpy.context.active_object
            bm = bmesh.new()
            bm.from_mesh(scallop.data)
            # 회전 뒤 월드 위쪽(+Z)이 되는 로컬 축의 양수 절반을 잘라냄
            normal = (0, 1, 0) if outward_x == 0 else (-1, 0, 0)
            cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0), plane_no=normal, clear_outer=True)
            edges = [item for item in cut["geom_cut"] if isinstance(item, bmesh.types.BMEdge)]
            bmesh.ops.holes_fill(bm, edges=edges, sides=0)
            bm.to_mesh(scallop.data)
            bm.free()
            finish(scallop, arena, CANOPY if count % 2 == 0 else "ffffff", smooth=False)
            count += 1
    # 처마 전구 (테두리 보 바깥 아래)
    count = 0
    for index in range(4):
        (ax, az), (bx, bz) = corners[index], corners[(index + 1) % 4]
        length = max(abs(bx - ax), abs(bz - az))
        steps = int(length)
        for step in range(steps):
            t = (step + 0.5) / steps
            x, z = ax + (bx - ax) * t, az + (bz - az) * t
            ox = 0.2 if x == w else (-0.2 if x == -w else 0)
            oz = 0.2 if z == d else (-0.2 if z == -d else 0)
            addSphere(arena, 0.11, B(x + ox, ROOF_HEIGHT - 0.1, z + oz), BULB_COLORS[count % len(BULB_COLORS)], segments=8, prefix="glow")
            count += 1


def main():
    old = bpy.data.objects.get("crazy_bump_arena")
    if old is not None:
        for child in list(old.children_recursive):
            bpy.data.objects.remove(child, do_unlink=True)
        bpy.data.objects.remove(old, do_unlink=True)
    arena = bpy.data.objects.new("crazy_bump_arena", None)
    bpy.context.scene.collection.objects.link(arena)
    buildFloor(arena)
    buildWalls(arena)
    buildPillars(arena)
    buildRoof(arena)
    joinChildren(arena, "arena")
    print("arena 메시", len(arena.children))


if __name__ == "__main__":
    main()
