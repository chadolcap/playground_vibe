# 휴머노이드 뼈대(humanoid_rig.py 결과)의 hand_* 아래에 손가락 뼈 5개(thumb·index·middle·ring·pinky)와 웨이트 추가
# Blender 에서 전역 g 로 exec:
#   g = {"__name__": "__main__", "RIG": "woman_1_rig", "BODY": "woman_1_body",
#        "GAPS": [-0.038, -0.012, 0.020], "KNUCKLE_T": 0.5, "THUMB": {"w_min": 0.035, "t_min": 0.15, "t_max": 0.62}}
# 손 좌표계: t = 손목→손끝 비율(0~1), w = 손바닥 폭 방향(+ = 앞, 엄지 쪽), n = 손바닥 법선
#   GAPS: 손가락 사이 골짜기의 w(m, 작은 값부터) — 고폴리 원본의 손가락 구간 w 분포에서 측면 벽이 몰린 곳
#         좌우가 다르면 {"left": [...], "right": [...]} (THUMB 도 {"left": {...}, "right": {...}} 가능)
# 손가락 뼈 roll: 로컬 Z = 손바닥 법선 → 로컬 z 회전 = 손바닥 면 안에서 벌리기(+ = 엄지 쪽), 로컬 x 회전 = 굽히기(+ = 손바닥 쪽)
# 이미 손가락 뼈가 있으면 다시 실행하지 말 것 (웨이트를 손에서 한 번 더 옮김) — humanoid_rig.py 부터 다시
import bpy
import numpy as np
from mathutils import Vector

G = globals()
RIG, BODY = G["RIG"], G["BODY"]
GAPS = G["GAPS"]
KNUCKLE_T = G.get("KNUCKLE_T", 0.5)
THUMB = G.get("THUMB", {"w_min": 0.035, "t_min": 0.15, "t_max": 0.62})
# 손바닥과 손가락 웨이트를 섞는 폭(t 비율)
BLEND_T = G.get("BLEND_T", 0.06)
# w 가 작은 쪽부터 (엄지 반대편 = 새끼)
FINGERS = ("pinky", "ring", "middle", "index")


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def handFrame(rig, side):
    bone = rig.data.bones[f"hand_{side}"]
    h0, h1 = np.array(bone.head_local), np.array(bone.tail_local)
    d = h1 - h0
    length = np.linalg.norm(d)
    d /= length
    front = np.array([0.0, -1.0, 0.0])
    w_ax = front - d * front.dot(d)
    w_ax /= np.linalg.norm(w_ax)
    return h0, d, length, w_ax, np.cross(d, w_ax)


def labelHand(body, rig, side):
    # 손 웨이트가 있는 정점 → (정점 번호, 손가락 이름, 손가락 몫)
    h0, d, length, w_ax, _ = handFrame(rig, side)
    group = body.vertex_groups[f"hand_{side}"].index
    labels = []
    thumb = THUMB[side] if side in THUMB else THUMB
    for v in body.data.vertices:
        if not any(g.group == group and g.weight > 0.05 for g in v.groups):
            continue
        p = np.array(v.co) - h0
        t, w = p @ d / length, p @ w_ax
        if w > thumb["w_min"] and thumb["t_min"] < t < thumb["t_max"]:
            labels.append((v.index, "thumb", float(smoothstep(thumb["t_min"], thumb["t_min"] + 0.15, t))))
            continue
        gaps = GAPS[side] if isinstance(GAPS, dict) else GAPS
        finger = FINGERS[int(np.searchsorted(gaps, w))]
        share = float(smoothstep(KNUCKLE_T - BLEND_T, KNUCKLE_T + BLEND_T, t))
        if share > 0:
            labels.append((v.index, finger, share))
    return labels


def buildBones(rig, body, side, labels):
    h0, d, length, w_ax, n_ax = handFrame(rig, side)
    co = {i: np.array(body.data.vertices[i].co) for i, _, _ in labels}
    specs = {}
    for name in ("thumb",) + FINGERS:
        pts = np.array([co[i] for i, f, s in labels if f == name and s > 0.5])
        if len(pts) < 3:
            print("손가락 정점 부족", name, side, len(pts))
            continue
        t = (pts - h0) @ d / length
        lo, hi = np.percentile(t, 8), np.percentile(t, 95)
        root = pts[t <= lo + 0.08].mean(0)
        tip = pts[t >= hi - 0.05].mean(0)
        specs[name] = (Vector(root), Vector(tip))
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (root, tip) in specs.items():
        bone_name = f"{name}_{side}"
        if bone_name in rig.data.edit_bones:
            rig.data.edit_bones.remove(rig.data.edit_bones[bone_name])
        bone = rig.data.edit_bones.new(bone_name)
        bone.head, bone.tail = root, tip
        # 오른손은 roll 축을 뒤집어 거울 대칭 (humanoid_actions.py 가 *_right 뼈의 y·z 회전 부호를 뒤집음)
        bone.align_roll(Vector(n_ax) * (1 if side == "left" else -1))
        bone.parent = rig.data.edit_bones[f"hand_{side}"]
    bpy.ops.object.mode_set(mode="OBJECT")
    return specs


def assignWeights(body, side, labels):
    hand = body.vertex_groups[f"hand_{side}"]
    groups = {}
    for index, finger, share in labels:
        name = f"{finger}_{side}"
        if name not in groups:
            groups[name] = body.vertex_groups.get(name) or body.vertex_groups.new(name=name)
        hand_weight = next((g.weight for g in body.data.vertices[index].groups if g.group == hand.index), 0.0)
        moved = hand_weight * share
        groups[name].add([index], float(moved), "REPLACE")
        hand.add([index], hand_weight - moved, "REPLACE")


def smoothFingers(body):
    # 손가락 경계 정점이 한 손가락에만 묶이면 벌릴 때 사이 면이 찢긴 듯 뾰족해짐 → 손가락 웨이트만 메시를 따라 섞음
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    body.hide_set(False)
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    for finger in ("thumb",) + FINGERS:
        for side in ("left", "right"):
            group = body.vertex_groups.get(f"{finger}_{side}")
            if group is not None:
                body.vertex_groups.active_index = group.index
                bpy.ops.object.vertex_group_smooth(group_select_mode="ACTIVE", factor=0.5, repeat=2, expand=0.0)
    # glTF 는 정점당 뼈 4개까지
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def main():
    rig, body = bpy.data.objects[RIG], bpy.data.objects[BODY]
    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for side in ("left", "right"):
        labels = labelHand(body, rig, side)
        specs = buildBones(rig, body, side, labels)
        assignWeights(body, side, labels)
        counts = {f: sum(1 for _, x, s in labels if x == f and s > 0.5) for f in ("thumb",) + FINGERS}
        print(side, "손가락 뼈", list(specs), "정점", counts)
    smoothFingers(body)


if G.get("__name__") == "__main__":
    main()
