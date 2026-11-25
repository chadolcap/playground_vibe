# 생성 메시(TARGET)의 손을 손가락이 또렷한 다른 생성 메시(DONOR)의 손으로 바꿔 붙임 — 안녕할 때 손가락을 벌리려면 손가락이 떨어져 있어야 함
# Blender 에서 전역 g 로 exec:
#   g = {"__name__": "__main__", "TARGET": "woman_1v4_tripo", "DONOR": "woman_1v3_meshy", "OUT": "woman_1v4_src",
#        "CUFF_Z": 0.355, "OVERLAP": 0.03, "SHRINK": 0.85, "HAND_TRIS": 2500}
# 두 메시 모두 generated_to_game.py 의 정규화(키 1.0·발바닥 원점·정면 -Y)를 마친 상태여야 함 (같은 그림에서 생성한 A-Pose 라 손 위치가 거의 같음)
# 팔 축(겨드랑이 아래 z 0.44 중심 → 손끝)에 수직인 평면(소매 끝 높이 CUFF_Z)으로 TARGET 손을 잘라내고,
# DONOR 손(소매 안쪽으로 OVERLAP 만큼 겹침)을 손목 단면 중심에 맞춰 팔 방향 차이만큼 돌려 붙임 → 결과 OUT (TARGET 은 숨김 보관)
import bpy, bmesh
import numpy as np
from mathutils import Matrix, Vector

G = globals()
TARGET, DONOR, OUT = G["TARGET"], G["DONOR"], G["OUT"]
CUFF_Z = G.get("CUFF_Z", 0.355)
OVERLAP = G.get("OVERLAP", 0.03)
# 소매 안으로 들어가는 DONOR 부분(절단 평면 위)을 팔 축 쪽으로 줄이는 비율 — TARGET 소매를 뚫고 나오지 않게
# (TARGET 소매는 두께 없는 껍질이라, 깊게 끼워 넣지 않으면 손목을 돌릴 때 소매 안 빈 곳이 보임)
SHRINK = G.get("SHRINK", 0.85)
HAND_TRIS = G.get("HAND_TRIS", 2500)
# 팔 축에서 이 거리 안만 손 (다리·허리가방이 섞이지 않게)
RADIUS = G.get("RADIUS", 0.08)


def coords(obj):
    flat = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
    obj.data.vertices.foreach_get("co", flat)
    return flat.reshape(-1, 3).astype(float)


def armAxis(co, s):
    # 겨드랑이 아래 팔 중심(z 0.44)과 손끝 — 손끝은 대략의 팔 방향으로 가장 멀리 간 정점
    arm = co[(co[:, 0] * s > 0.15) & (co[:, 2] < 0.47) & (co[:, 2] > 0.27)]
    top = arm[np.abs(arm[:, 2] - 0.44) < 0.01].mean(0)
    guess = np.array([0.5 * s, 0.07, -0.86])
    guess /= np.linalg.norm(guess)
    rel = arm - top
    arm = arm[np.linalg.norm(rel - np.outer(rel @ guess, guess), axis=1) < 0.07]
    tip = arm[np.argmax((arm - top) @ guess)]
    axis = (tip - top) / np.linalg.norm(tip - top)
    cut = top + (tip - top) * ((CUFF_Z - top[2]) / (tip[2] - top[2]))
    return cut, axis


def handMask(co, cut, axis, extra=0.0):
    rel = co - cut
    along = rel @ axis
    radial = np.linalg.norm(rel - np.outer(along, axis), axis=1)
    return (along > -extra) & (radial < RADIUS) & (along < 0.16)


def wristCenter(co, cut, axis):
    rel = co - cut
    along = rel @ axis
    radial = np.linalg.norm(rel - np.outer(along, axis), axis=1)
    return co[(np.abs(along) < 0.004) & (radial < RADIUS)].mean(0)


def donorHand(donor, mask, transform, name, cut, axis):
    bm = bmesh.new()
    bm.from_mesh(donor.data)
    bm.verts.ensure_lookup_table()
    # 절단 평면 위(소매 안)로 갈수록 팔 축 쪽으로 줄임 (평면 아래 5mm 부터 시작해 평면 위 5mm 에서 SHRINK)
    for v in bm.verts:
        if not mask[v.index]:
            continue
        rel = np.array(v.co) - cut
        along = rel @ axis
        k = np.clip((0.005 - along) / 0.01, 0.0, 1.0)
        if k > 0:
            radial = rel - along * axis
            v.co = Vector((cut + along * axis + radial * (1 - (1 - SHRINK) * k)).tolist())
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not mask[v.index]], context="VERTS")
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    for material in donor.data.materials:
        mesh.materials.append(material)
    mesh.transform(transform)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    decimate = obj.modifiers.new("decimate", "DECIMATE")
    decimate.ratio = min(1.0, HAND_TRIS / max(len(mesh.polygons), 1))
    with bpy.context.temp_override(object=obj, active_object=obj):
        bpy.ops.object.modifier_apply(modifier="decimate")
    return obj


def main():
    target, donor = bpy.data.objects[TARGET], bpy.data.objects[DONOR]
    old = bpy.data.objects.get(OUT)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    tco, dco = coords(target), coords(donor)
    out = target.copy()
    out.data = target.data.copy()
    out.name = out.data.name = OUT
    bpy.context.scene.collection.objects.link(out)
    remove = np.zeros(len(tco), dtype=bool)
    pieces = [out]
    for s, label in ((1, "L"), (-1, "R")):
        t_cut, t_axis = armAxis(tco, s)
        d_cut, d_axis = armAxis(dco, s)
        remove |= handMask(tco, t_cut, t_axis)
        t_wrist, d_wrist = wristCenter(tco, t_cut, t_axis), wristCenter(dco, d_cut, d_axis)
        turn = Vector(d_axis.tolist()).rotation_difference(Vector(t_axis.tolist())).to_matrix().to_4x4()
        transform = Matrix.Translation(Vector(t_wrist.tolist())) @ turn @ Matrix.Translation(-Vector(d_wrist.tolist()))
        pieces.append(donorHand(donor, handMask(dco, d_cut, d_axis, OVERLAP), transform, f"{OUT}_hand_{label}", d_cut, d_axis))
        angle = np.degrees(np.arccos(np.clip(d_axis @ t_axis, -1, 1)))
        print(label, "손목", t_wrist.round(3), "팔 방향 차이", round(float(angle), 1), "도")
    bm = bmesh.new()
    bm.from_mesh(out.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[bm.verts[i] for i in np.nonzero(remove)[0]], context="VERTS")
    bm.to_mesh(out.data)
    bm.free()
    for obj in bpy.context.selected_objects:
        obj.select_set(False)
    for obj in pieces:
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = out
    bpy.ops.object.join()
    out["normalized"] = 1
    for obj in (target, donor):
        obj.hide_set(True)
        obj.hide_render = True
    print(OUT, "정점", len(out.data.vertices), "재질", [m.name for m in out.data.materials])


if G.get("__name__") == "__main__":
    main()
