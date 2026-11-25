# 게임 캐릭터(스킨 메시) → 휴머노이드 뼈대 + 웨이트
# Blender 에서 전역 g 로 exec:
#   g = {"__name__": "__main__", "SRC": "man_1_mesh", "NAME": "man_1", "J": {...관절 좌표...}, "HAIR": []}
# 입력 메시: generated_to_game.py 결과(게임 크기 키 1.55, 원점 발바닥, 정면 Blender -Y)와 그 부위 웨이트
#   (arm_*, leg_*, knee_*, foot_*, body, hair_*) — 부위 웨이트를 영역 마스크로 다시 써서 팔·다리 웨이트가 몸통으로 새지 않게 함
# 결과: <NAME>_rig (Armature) + <NAME>_body (Armature 모디파이어), 원본 메시는 숨김
# 뼈: hips → spine → chest → neck → head → jaw, chest → shoulder_* → upper_arm_* → forearm_* → hand_*,
#     hips → pelvis_* → thigh_* → shin_* → foot_*, head → hair_* (묶음 머리가 있으면)
#     pelvis_* 는 엉덩이 바닥면을 따라 앞(J["pelvis"])→뒤(J["sit_bone"]) 수평 — 엉덩이 메시를 묶고, 앉으면 뼈 전체가 바닥에 닿음
# roll: 모든 뼈의 로컬 Z 축이 정면(-Y, 앞으로 뻗은 뼈는 위 +Z)을 향함 → 굽히기 = 로컬 X 회전
import bpy, math
import numpy as np
from mathutils import Vector

G = globals()
SRC, NAME = G["SRC"], G["NAME"]
# 관절 좌표 (왼쪽 = +X, 오른쪽 뼈는 X 를 뒤집어 만듦)
J = G["J"]
HAIR = G.get("HAIR", [])
# 관절 경계를 섞는 폭(m) — 좁으면 관절이 꺾여 보이고, 넓으면 이웃 부위까지 끌려감
BLEND_SPINE = G.get("BLEND_SPINE", 0.04)
BLEND_LIMB = G.get("BLEND_LIMB", 0.03)
SMOOTH_REPEAT = G.get("SMOOTH_REPEAT", 3)
# 좌우 골반 웨이트를 가운데에서 섞는 폭(m)
PELVIS_BLEND = G.get("PELVIS_BLEND", 0.04)
# 앉는 뼈(J["sit_bone"]) 아래로 엉덩이 아랫살을 골반에 묶는 깊이(m)
GLUTE_DEPTH = G.get("GLUTE_DEPTH", 0.10)
# 턱 웨이트가 입선(mouth_z) 위아래로 바뀌는 폭(m)
JAW_BLEND = G.get("JAW_BLEND", 0.035)

SIDES = (("left", 1.0), ("right", -1.0))


def mirror(p, s):
    return Vector((p[0] * s, p[1], p[2]))


def boneSpecs():
    # (이름, 부모, head, tail, roll 기준축)
    front, up = Vector((0, -1, 0)), Vector((0, 0, 1))
    specs = [
        ("hips", None, J["hips"], J["spine"], front),
        ("spine", "hips", J["spine"], J["chest"], front),
        ("chest", "spine", J["chest"], J["neck"], front),
        ("neck", "chest", J["neck"], J["head"], front),
        ("head", "neck", J["head"], J["head_top"], front),
        ("jaw", "head", J["jaw"], J["chin"], up),
    ]
    for side, s in SIDES:
        specs += [
            (f"shoulder_{side}", "chest", mirror(J["clavicle"], s), mirror(J["shoulder"], s), front),
            (f"upper_arm_{side}", f"shoulder_{side}", mirror(J["shoulder"], s), mirror(J["elbow"], s), front),
            (f"forearm_{side}", f"upper_arm_{side}", mirror(J["elbow"], s), mirror(J["wrist"], s), front),
            (f"hand_{side}", f"forearm_{side}", mirror(J["wrist"], s), mirror(J["hand_tip"], s), front),
            # 골반: 엉덩이 바닥면을 따라 앞(J["pelvis"])에서 뒤(J["sit_bone"])로 눕힌 뼈 — 엉덩이 메시를 묶고 다리가 매달림,
            # 앉으면 뼈 전체가 바닥과 나란히 닿음 (앞뒤로 누운 뼈라 roll 기준은 위)
            (f"pelvis_{side}", "hips", mirror(J["pelvis"], s), mirror(J["sit_bone"], s), up),
            (f"thigh_{side}", f"pelvis_{side}", mirror(J["hip"], s), mirror(J["knee"], s), front),
            (f"shin_{side}", f"thigh_{side}", mirror(J["knee"], s), mirror(J["ankle"], s), front),
            (f"foot_{side}", f"shin_{side}", mirror(J["ankle"], s), mirror(J["toe"], s), up),
        ]
    for hair in HAIR:
        specs.append((hair["name"], "head", Vector(hair["head"]), Vector(hair["tail"]), front))
    return specs


def buildArmature():
    old = bpy.data.objects.get(f"{NAME}_rig")
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    data = bpy.data.armatures.new(f"{NAME}_rig")
    rig = bpy.data.objects.new(f"{NAME}_rig", data)
    bpy.context.scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, parent, head, tail, roll_axis in boneSpecs():
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = Vector(head), Vector(tail)
        bone.align_roll(roll_axis)
        if parent is not None:
            bone.parent = data.edit_bones[parent]
            # 사슬이 이어지는 뼈만 연결 (어깨·허벅지·턱은 부모 끝에서 떨어져 있음)
            bone.use_connect = (bone.parent.tail - bone.head).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    data.display_type = "STICK"
    rig.show_in_front = True
    return rig


def smoothstep(edge0, edge1, x):
    t = np.clip((x - edge0) / (edge1 - edge0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def chainParam(co, points):
    # 각 정점을 관절 사슬(points)에 투영한 누적 길이 + 관절 위치의 누적 길이
    lengths = [0.0]
    best_t = np.zeros(len(co))
    best_d = np.full(len(co), np.inf)
    for a, b in zip(points[:-1], points[1:]):
        a, b = np.array(a), np.array(b)
        seg = b - a
        seg_len = np.linalg.norm(seg)
        u = np.clip(((co - a) @ seg) / (seg_len * seg_len), 0.0, 1.0)
        d = np.linalg.norm(co - (a + u[:, None] * seg), axis=1)
        better = d < best_d
        best_d[better] = d[better]
        best_t[better] = lengths[-1] + u[better] * seg_len
        lengths.append(lengths[-1] + seg_len)
    return best_t, lengths


def splitChain(co, mask_w, bones, points, blend):
    # 사슬 영역(mask_w) 안의 정점을 관절마다 blend 폭으로 섞어 뼈에 나눔
    t, joints = chainParam(co, points)
    weights = {}
    # carry: 앞 관절들을 지나 이 뼈까지 넘어온 몫
    carry = np.ones(len(co))
    for index, bone in enumerate(bones):
        if index < len(bones) - 1:
            cut = joints[index + 1]
            nxt = smoothstep(cut - blend, cut + blend, t)
            weights[bone] = mask_w * carry * (1 - nxt)
            carry = carry * nxt
        else:
            weights[bone] = mask_w * carry
    return weights


def regionWeights(src, co):
    # 기존 부위 웨이트 → {영역: 정점별 웨이트}
    names = {g.index: g.name for g in src.vertex_groups}
    region = {}
    for v in src.data.vertices:
        for g in v.groups:
            name = names[g.group]
            key = "body"
            for side, _ in SIDES:
                if name == f"arm_{side}":
                    key = f"arm_{side}"
                elif name in (f"leg_{side}", f"knee_{side}", f"foot_{side}"):
                    key = f"leg_{side}"
            if name.startswith("hair"):
                key = name if any(h["name"] == name for h in HAIR) else "body"
            region.setdefault(key, np.zeros(len(co)))[v.index] += g.weight
    return region


def computeWeights(src, co):
    region = regionWeights(src, co)
    out = {}
    for side, s in SIDES:
        arm = region.get(f"arm_{side}", np.zeros(len(co)))
        out.update(splitChain(co, arm, [f"upper_arm_{side}", f"forearm_{side}", f"hand_{side}"],
                              [mirror(J[k], s) for k in ("shoulder", "elbow", "wrist", "hand_tip")], BLEND_LIMB))
        leg = region.get(f"leg_{side}", np.zeros(len(co)))
        out.update(splitChain(co, leg, [f"thigh_{side}", f"shin_{side}", f"foot_{side}"],
                              [mirror(J[k], s) for k in ("hip", "knee", "ankle", "toe")], BLEND_LIMB))
        # 엉덩이 아랫살: 옛 부위 구분에서 다리로 들어간 등 쪽 윗부분을 골반으로 — 앉으면 허벅지보다 엉덩이가 먼저 바닥에 닿음
        sit_z, sit_y = J["sit_bone"][2], J["sit_bone"][1]
        glute = (smoothstep(J["hip"][1], sit_y, co[:, 1])
                 * smoothstep(sit_z - GLUTE_DEPTH, sit_z - GLUTE_DEPTH * 0.4, co[:, 2]))
        out[f"pelvis_{side}_glute"] = out[f"thigh_{side}"] * glute
        out[f"thigh_{side}"] = out[f"thigh_{side}"] * (1 - glute)
    for hair in HAIR:
        out[hair["name"]] = region.get(hair["name"], np.zeros(len(co)))
    # 몸통: 높이로 hips/spine/chest/neck/head 를 섞고, 어깨 바깥은 shoulder, 아래 얼굴은 jaw
    body = region.get("body", np.zeros(len(co)))
    z = co[:, 2]
    cuts = [J["spine"][2], J["chest"][2], J["neck"][2], J["head"][2]]
    names = ["hips", "spine", "chest", "neck", "head"]
    previous = np.ones(len(co))
    for index, name in enumerate(names):
        if index < len(cuts):
            nxt = smoothstep(cuts[index] - BLEND_SPINE, cuts[index] + BLEND_SPINE, z)
            out[name] = body * previous * (1 - nxt)
            previous = previous * nxt
        else:
            out[name] = body * previous
    # 척추 아래(엉덩이·골반 부위)는 hips 대신 좌우 골반 뼈로 — 가운데(x=0)에서 좌우를 섞음
    left_share = smoothstep(-PELVIS_BLEND, PELVIS_BLEND, co[:, 0])
    out["pelvis_left"] = out["hips"] * left_share + out.pop("pelvis_left_glute")
    out["pelvis_right"] = out["hips"] * (1 - left_share) + out.pop("pelvis_right_glute")
    out["hips"] = out["hips"] * 0
    for side, s in SIDES:
        # 가슴 위쪽에서 어깨 관절 쪽으로 갈수록 shoulder 뼈 (팔을 들 때 어깨가 함께 올라감)
        x_in, x_out = J["clavicle"][0] + 0.02, J["shoulder"][0]
        lateral = smoothstep(x_in, x_out, co[:, 0] * s)
        height = smoothstep(J["chest"][2] + 0.04, J["shoulder"][2] - 0.04, z) * (1 - smoothstep(J["head"][2] - 0.02, J["head"][2] + 0.03, z))
        take = out["chest"] * lateral * height + out["neck"] * lateral * height * 0.5
        out[f"shoulder_{side}"] = take
        out["chest"] = out["chest"] - out["chest"] * lateral * height
        out["neck"] = out["neck"] - out["neck"] * lateral * height * 0.5
    # 턱: 입 아래·얼굴 앞쪽 (오물거릴 때 볼·턱만 움직임)
    # 입선 위아래를 넓게 섞어야 턱을 움직일 때 입선이 찢어지지 않음
    jaw_z = smoothstep(J["mouth_z"] + JAW_BLEND, J["mouth_z"] - JAW_BLEND, z) * smoothstep(J["chin"][2] - 0.03, J["chin"][2] + 0.005, z)
    jaw_front = smoothstep(J["jaw_front_y"], J["jaw_front_y"] - 0.06, co[:, 1])
    jaw_side = 1 - smoothstep(J["jaw_half_x"] * 0.6, J["jaw_half_x"], np.abs(co[:, 0]))
    jaw = out["head"] * jaw_z * jaw_front * jaw_side
    out["jaw"] = jaw
    out["head"] = out["head"] - jaw
    return out


def bindMesh(src, rig):
    old = bpy.data.objects.get(f"{NAME}_body")
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    body = src.copy()
    body.data = src.data.copy()
    body.name = body.data.name = f"{NAME}_body"
    bpy.context.scene.collection.objects.link(body)
    body.parent = None
    body.matrix_world = src.matrix_world.copy()
    co = np.array([v.co[:] for v in body.data.vertices])
    weights = computeWeights(src, co)
    body.modifiers.clear()
    body.vertex_groups.clear()
    total = np.zeros(len(co))
    for w in weights.values():
        total += w
    for name, w in weights.items():
        group = body.vertex_groups.new(name=name)
        w = w / np.maximum(total, 1e-6)
        for index in np.nonzero(w > 0.002)[0]:
            group.add([int(index)], float(w[index]), "REPLACE")
    # 관절 경계가 계단처럼 꺾이지 않게 메시 연결을 따라 부드럽게
    bpy.context.view_layer.objects.active = body
    for o in bpy.context.selected_objects:
        o.select_set(False)
    body.select_set(True)
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.5, repeat=SMOOTH_REPEAT)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    body.parent = rig
    src.hide_set(True)
    src.hide_render = True
    return body


def main():
    src = bpy.data.objects[SRC]
    if bpy.context.object is not None and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    rig = buildArmature()
    body = bindMesh(src, rig)
    print("rig", rig.name, "bones", len(rig.data.bones), "body", body.name, "groups", len(body.vertex_groups))


if G.get("__name__") == "__main__":
    main()
