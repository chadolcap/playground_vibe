# 팔이 몸통과 떨어져 생성된 메시(A-Pose 등)의 팔 부위 웨이트를 메시 연결로 정리
# Blender 에서 전역 g 로 exec: g = {"__name__": "__main__", "OBJ": "man_1v2_mesh", "ARMPIT_Z": 0.58}
# 옛 부위 구분(generated_to_game.py)은 x 경계선으로 팔을 나눠, 손 옆 허리살에도 팔 웨이트가 묻음 → 팔을 들면 허리가 끌려 나옴
# 겨드랑이(ARMPIT_Z) 아래에서 손끝과 이어진 덩어리만 팔(웨이트 1), 나머지 덩어리는 팔 웨이트를 몸통으로 옮김
import bpy, bmesh

G = globals()
OBJ = G["OBJ"]
ARMPIT_Z = G["ARMPIT_Z"]
SIDES = (("arm_left", 1.0), ("arm_right", -1.0))


def islandsBelow(bm, limit_z):
    # limit_z 아래 정점만으로 이은 연결 덩어리 → {정점 번호: 덩어리 번호}
    label = {}
    current = 0
    for start in bm.verts:
        if start.index in label or start.co.z >= limit_z:
            continue
        stack = [start]
        label[start.index] = current
        while stack:
            vertex = stack.pop()
            for edge in vertex.link_edges:
                other = edge.other_vert(vertex)
                if other.index not in label and other.co.z < limit_z:
                    label[other.index] = current
                    stack.append(other)
        current += 1
    return label


def main():
    obj = bpy.data.objects[OBJ]
    groups = {group.name: group.index for group in obj.vertex_groups}
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    deform = bm.verts.layers.deform.active
    label = islandsBelow(bm, ARMPIT_Z)
    body_id = groups["body"]
    for arm_name, sign in SIDES:
        arm_id = groups[arm_name]
        # 손끝 = 이 쪽에서 가장 바깥(|x| 최대)이면서 겨드랑이 아래인 정점
        tip = max((v for v in bm.verts if v.co.x * sign > 0 and v.co.z < ARMPIT_Z), key=lambda v: v.co.x * sign)
        arm_island = label[tip.index]
        moved = kept = 0
        for vertex in bm.verts:
            if vertex.index not in label or vertex.co.x * sign <= 0:
                continue
            weights = vertex[deform]
            if label[vertex.index] == arm_island:
                for group in list(weights.keys()):
                    del weights[group]
                weights[arm_id] = 1.0
                kept += 1
            elif arm_id in weights:
                weights[body_id] = weights.get(body_id, 0.0) + weights[arm_id]
                del weights[arm_id]
                moved += 1
        print(arm_name, "팔 덩어리 정점", kept, "팔 웨이트를 몸통으로 옮긴 정점", moved)
    bm.to_mesh(obj.data)
    bm.free()


if G.get("__name__") == "__main__":
    main()
