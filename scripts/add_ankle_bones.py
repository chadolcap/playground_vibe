# 게임 캐릭터 리그에 발목 뼈(foot_left·foot_right) 추가 → 게임 GLB 로 다시 내보냄
# 발목 뼈가 없으면 발이 정강이와 함께 기울어 걷는 동안 발끝이 땅을 파고듦 → 게임 코드가 발목을 반대로 돌려 발바닥을 평평하게 유지
# 메시·UV·텍스처는 그대로 두고 발목 아래 정점의 무릎 가중치만 발목 뼈로 옮김
# Blender 에서 전역 g 로 exec (원본 .blend 는 읽기만 함):
#   g = {"__name__": "__main__", "NAME": "man_1", "BLEND_FILE": r"<..._hy.blend>", "GAME_GLB": r"<게임 GLB 경로>",
#        "ANKLE_Z": 0.09}            # 발목 높이(게임 크기, 신발 앞뒤 폭이 줄어드는 높이)
# 뼈: root → body(arm_*, hair_*), leg_* → knee_* → foot_* (모든 뼈가 +Z 를 향하고 roll 0 → glTF 기본 회전 0)
import bpy, os
import numpy as np
from mathutils import Vector

G = globals()
NAME, BLEND_FILE, GAME_GLB = G["NAME"], G["BLEND_FILE"], G["GAME_GLB"]
ANKLE_Z = G.get("ANKLE_Z", 0.09)
# 발목 경계를 섞는 폭 — 좁으면 발목이 꺾여 보이고, 넓으면 정강이까지 끌려감
BLEND = G.get("BLEND", 0.02)


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def appendRig():
    # 원본 .blend 에서 리그·메시를 복사해 작업용 장면으로 (원본 파일은 저장하지 않음)
    scene = bpy.data.scenes.get("ankle_work") or bpy.data.scenes.new("ankle_work")
    bpy.context.window.scene = scene
    for o in [o for o in scene.objects if o.get("ankle_work") == NAME]:
        bpy.data.objects.remove(o, do_unlink=True)
    with bpy.data.libraries.load(BLEND_FILE, link=False) as (src, dst):
        dst.objects = [NAME, f"{NAME}_mesh"]
    for lib in list(bpy.data.libraries):
        bpy.data.libraries.remove(lib)
    for o in dst.objects:
        o["ankle_work"] = NAME
        scene.collection.objects.link(o)
    rig = next(o for o in dst.objects if o.type == "ARMATURE")
    mesh = next(o for o in dst.objects if o.type == "MESH")
    return rig, mesh


def moveWeights(mesh):
    # 발목 아래 정점: 무릎 가중치를 높이에 따라 발목 뼈로 옮김 → 발목 뼈 머리 위치 반환
    co = np.array([v.co[:] for v in mesh.data.vertices])
    heads = {}
    for side in ("left", "right"):
        knee = mesh.vertex_groups[f"knee_{side}"]
        foot = mesh.vertex_groups.get(f"foot_{side}") or mesh.vertex_groups.new(name=f"foot_{side}")
        knee_w = np.zeros(len(co))
        for v in mesh.data.vertices:
            for g in v.groups:
                if g.group == knee.index:
                    knee_w[v.index] = g.weight
        share = knee_w * smooth(ANKLE_Z + BLEND, ANKLE_Z - BLEND, co[:, 2])
        for i in np.nonzero(share > 1e-3)[0]:
            foot.add([int(i)], float(share[i]), "REPLACE")
            rest = knee_w[i] - share[i]
            if rest > 1e-3:
                knee.add([int(i)], float(rest), "REPLACE")
            else:
                knee.remove([int(i)])
        # 회전 중심 = 발목 바로 위 정강이 단면의 가로 중심 (발 단면은 발끝 쪽으로 치우침)
        band = (knee_w > 0.5) & (co[:, 2] > ANKLE_Z + 0.02) & (co[:, 2] < ANKLE_Z + 0.04)
        heads[side] = Vector((co[band, 0].mean(), co[band, 1].mean(), ANKLE_Z))
        print(side, "발 정점", int((share > 0.5).sum()), "발목", tuple(round(x, 3) for x in heads[side]))
    return heads


def addFootBones(rig, heads):
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    bones = rig.data.edit_bones
    for side, head in heads.items():
        name = f"foot_{side}"
        if name in bones:
            bones.remove(bones[name])
        b = bones.new(name)
        b.head = head
        b.tail = head + Vector((0, 0, 0.05))
        b.roll = 0
        b.parent = bones[f"knee_{side}"]
    bpy.ops.object.mode_set(mode="OBJECT")


def export(rig, mesh):
    bpy.ops.object.select_all(action="DESELECT")
    for o in (rig, mesh):
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=GAME_GLB, use_selection=True, use_active_scene=True, export_format="GLB", export_apply=False,
                              export_skins=True, export_animations=False, export_image_format="JPEG")
    print("→", GAME_GLB, os.path.getsize(GAME_GLB), "bytes")


rig, mesh = appendRig()
addFootBones(rig, moveWeights(mesh))
export(rig, mesh)
