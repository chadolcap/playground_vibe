# 생성 캐릭터의 팔과 몸통 옆면이 붙은 부분을 잘라 분리 — 팔을 들면 상의와 팔 사이에 공간이 생기고 하의는 끌려가지 않음
# Blender 에서 전역 g 로 exec:
#   g = {"__name__": "__main__", "SRC": "man_1_mesh", "OUT": "man_1_mesh_split", "Z_MIN": 0.50, "Z_MAX": 0.80}
# 입력: generated_to_game.py 결과 메시(부위 웨이트 arm_*·body 등 포함)
# 1) 면을 팔/몸통으로 나눔 (정점 arm 웨이트 평균 0.5 이상 = 팔)
# 2) Z_MIN~Z_MAX(허리띠 위 ~ 겨드랑이) 안에서 팔 면과 몸통 면이 만나는 모서리(한쪽에 U자 한 줄)를 잘라 벌림
# 3) 잘린 자리에 몸통 옆면 뚜껑·팔 안쪽 뚜껑을 각각 붙이고, 잘린 정점 웨이트를 몸통/팔로 확실히 나눔
# 결과: OUT 오브젝트 (원본은 그대로) — humanoid_rig.py 의 SRC 로 넘김
import bpy, bmesh
from mathutils import Vector

G = globals()
SRC, OUT = G["SRC"], G["OUT"]
Z_MIN = G.get("Z_MIN", 0.50)
Z_MAX = G.get("Z_MAX", 0.80)
# 뚜껑을 부풀리는 높이(m) — 소매 안쪽은 소매 단면이 둥근 원통이 되도록, 몸통 옆면은 옆구리가 살짝 둥글도록
ARM_BULGE = G.get("ARM_BULGE", 0.035)
TORSO_BULGE = G.get("TORSO_BULGE", 0.015)
ARM_GROUPS = {"left": "arm_left", "right": "arm_right"}
BODY_GROUP = "body"


def armWeight(vertex, deform, arm_ids):
    return sum(weight for group, weight in vertex[deform].items() if group in arm_ids)


def orderedChain(edges):
    # 이어진 모서리들 → 한쪽 끝에서 시작하는 정점 순서
    adjacent = {}
    for edge in edges:
        a, b = edge.verts
        adjacent.setdefault(a, []).append(b)
        adjacent.setdefault(b, []).append(a)
    ends = [vertex for vertex, near in adjacent.items() if len(near) == 1]
    if len(ends) != 2:
        raise RuntimeError(f"잘린 경계가 한 줄이 아님 (끝점 {len(ends)}개)")
    chain = [ends[0]]
    previous = None
    while len(chain) == 1 or chain[-1] is not ends[1]:
        current = chain[-1]
        nxt = next(vertex for vertex in adjacent[current] if vertex is not previous)
        previous = current
        chain.append(nxt)
    return chain


def nearestFaceUv(chain, faces, uv_layer):
    # 뚜껑 가운데에서 가장 가까운 같은 부위 면의 UV 한 점 — 정점마다 UV 섬이 달라 평균을 내면 아틀라스 엉뚱한 곳을 가리킴
    center = sum((vertex.co for vertex in chain), Vector()) / len(chain)
    face = min(faces, key=lambda candidate: (candidate.calc_center_median() - center).length)
    return sum((loop[uv_layer].uv for loop in face.loops), Vector((0.0, 0.0))) / len(face.loops)


def capChain(bm, chain, outward, uv_layer, same_part_faces, bulge):
    # 잘린 경계(정점 순서)를 닫는 뚜껑 면 — 법선이 outward 쪽을 보도록 감고, 옆 상의 색 한 가지로 칠함
    # bulge: 뚜껑 가운데를 바깥으로 부풀리는 높이(m) — 평평하면 팔 단면이 반원이 되어 팔을 들 때 종잇장처럼 납작해 보임
    uv = nearestFaceUv(chain, same_part_faces, uv_layer)
    face = bm.faces.new(chain)
    face.normal_update()
    if face.normal.dot(outward) < 0:
        face.normal_flip()
    for loop in face.loops:
        loop[uv_layer].uv = uv
    face.smooth = True
    normal = face.normal.copy()
    caps = bmesh.ops.triangulate(bm, faces=[face], quad_method="BEAUTY", ngon_method="BEAUTY")["faces"]
    if bulge <= 0:
        return caps
    # 뚜껑 안쪽 모서리만 잘게 나눠 정점을 만들고(경계 모서리는 옆 원래 면이 있어 그대로),
    # 경계에서 멀수록 바깥(normal)으로 밀어 둥근 돔 모양 — 오목한 U 자 모양이라 고리를 줄이는 inset 은 면이 접힘
    # bmesh 요소는 Python 집합 비교를 믿을 수 없어 번호(index)로 구분 — 새로 생긴 정점·면은 index_update 전까지 -1
    points = [vertex.co.copy() for vertex in chain]
    bm.verts.index_update()
    bm.faces.index_update()
    chain_ids = {vertex.index for vertex in chain}
    cap_ids = {cap.index for cap in caps}
    other_ids = {item.index for item in bm.faces if item.index not in cap_ids}
    # 삼각형마다 가운데 점을 넣고(poke) 모양을 고르게(beautify) 두 번 — 정점을 지우지 않고 더하기만 함
    # (subdivide_edges 격자 채우기는 정점을 다시 만들어, 다른 쪽 뚜껑이 쥔 경계 정점 참조가 끊김)
    for _ in range(2):
        bmesh.ops.poke(bm, faces=caps)
        caps = [item for item in bm.faces if item.index not in other_ids]
        cap_edges = list({edge for cap in caps for edge in cap.edges
                          if len(edge.link_faces) == 2 and all(item.index not in other_ids for item in edge.link_faces)})
        bmesh.ops.beautify_fill(bm, faces=caps, edges=cap_edges)
        caps = [item for item in bm.faces if item.index not in other_ids]
    inner = list({vertex.index: vertex for cap in caps for vertex in cap.verts if vertex.index not in chain_ids}.values())
    bmesh.ops.smooth_vert(bm, verts=inner, factor=0.5, use_axis_x=True, use_axis_y=True, use_axis_z=True)

    def boundaryDistance(position):
        best = float("inf")
        for a, b in zip(points, points[1:] + points[:1]):
            segment = b - a
            ratio = max(0.0, min(1.0, (position - a).dot(segment) / max(segment.length_squared, 1e-12)))
            best = min(best, (position - (a + segment * ratio)).length)
        return best

    distances = [boundaryDistance(vertex.co) for vertex in inner]
    farthest = max(distances, default=1.0)
    for vertex, distance in zip(inner, distances):
        ratio = distance / farthest
        vertex.co += normal * bulge * (1 - (1 - ratio) ** 2)
    bm.verts.index_update()
    bm.faces.index_update()
    for cap in caps:
        cap.smooth = True
        for loop in cap.loops:
            loop[uv_layer].uv = uv
    return caps


def setOnly(vertex, deform, keep_id, clear_ids):
    weights = vertex[deform]
    for group in clear_ids:
        if group in weights:
            del weights[group]
    weights[keep_id] = 1.0


def cleanArmWeights(bm, deform, is_arm, arm_id, body_id):
    # 팔 면에 닿지 않은 정점(하의 옆면 등)의 팔 웨이트는 몸통으로, 팔 면에만 닿은 정점은 팔 1
    # (옛 리그는 x 경계선으로 팔을 나눠 하의 옆면에도 팔 웨이트가 조금씩 묻어 있음 → 팔을 들면 하의가 끌려감)
    for vertex in bm.verts:
        faces = [face for face in vertex.link_faces if face in is_arm]
        if not faces:
            continue
        arm_faces = sum(1 for face in faces if is_arm[face])
        weights = vertex[deform]
        if arm_faces == 0 and arm_id in weights:
            weights[body_id] = weights.get(body_id, 0.0) + weights[arm_id]
            del weights[arm_id]
        elif arm_faces == len(faces):
            setOnly(vertex, deform, arm_id, [body_id])


def main():
    src = bpy.data.objects[SRC]
    old = bpy.data.objects.get(OUT)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    obj = src.copy()
    obj.data = src.data.copy()
    obj.name = obj.data.name = OUT
    obj.parent = None
    obj.modifiers.clear()
    obj.matrix_world = src.matrix_world.copy()
    bpy.context.scene.collection.objects.link(obj)

    group_ids = {group.name: group.index for group in obj.vertex_groups}
    body_id = group_ids[BODY_GROUP]
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    deform = bm.verts.layers.deform.active
    uv_layer = bm.loops.layers.uv.active
    for side, sign in (("left", 1.0), ("right", -1.0)):
        arm_id = group_ids[ARM_GROUPS[side]]
        is_arm = {face: sum(armWeight(v, deform, {arm_id}) for v in face.verts) / len(face.verts) >= 0.5 for face in bm.faces}
        seam = [edge for edge in bm.edges
                if len(edge.link_faces) == 2 and is_arm[edge.link_faces[0]] != is_arm[edge.link_faces[1]]
                and all(Z_MIN <= v.co.z <= Z_MAX and v.co.x * sign > 0.05 for v in edge.verts)]
        split = bmesh.ops.split_edges(bm, edges=seam)
        # 벌어진 경계: 몸통 쪽 사슬과 팔 쪽 사슬 (양 끝 겨드랑이 정점은 공유) — 원래 메시의 다른 열린 모서리는 섞지 않음
        boundary = [edge for edge in split["edges"] if edge.is_valid and edge.is_boundary]
        torso_edges = [edge for edge in boundary if not is_arm.get(edge.link_faces[0], False)]
        arm_edges = [edge for edge in boundary if is_arm.get(edge.link_faces[0], False)]
        torso_chain = orderedChain(torso_edges)
        arm_chain = orderedChain(arm_edges)
        # 잘린 정점 웨이트를 확실히 나눔 (끝점은 어깨와 이어져 그대로)
        for vertex in torso_chain[1:-1]:
            setOnly(vertex, deform, body_id, [arm_id])
        for vertex in arm_chain[1:-1]:
            setOnly(vertex, deform, arm_id, [body_id])
        torso_faces = [face for face, arm in is_arm.items() if face.is_valid and not arm]
        arm_faces = [face for face, arm in is_arm.items() if face.is_valid and arm]
        torso_caps = capChain(bm, torso_chain, Vector((sign, 0, 0)), uv_layer, torso_faces, TORSO_BULGE)
        arm_caps = capChain(bm, arm_chain, Vector((-sign, 0, 0)), uv_layer, arm_faces, ARM_BULGE)
        is_arm.update({face: False for face in torso_caps})
        is_arm.update({face: True for face in arm_caps})
        cleanArmWeights(bm, deform, is_arm, arm_id, body_id)
        print(side, "seam", len(seam), "torso chain", len(torso_chain), "arm chain", len(arm_chain),
              "caps", len(torso_caps), len(arm_caps))
    bm.normal_update()
    bm.to_mesh(obj.data)
    bm.free()
    # 뚜껑 삼각형이 기존 면과 정점이 같아 겹치는 경우(중복 면)를 지움 — 남기면 glTF 내보내기가 경고하고 그림자가 깜빡임
    obj.data.validate()
    obj.data.update()
    src.hide_set(True)
    return obj


if G.get("__name__") == "__main__":
    main()
