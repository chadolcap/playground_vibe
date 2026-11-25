# humanoid_actions.py 의 Action 후처리·내보내기 — 디딤발 땅에 붙이기(groundFeet), 보폭 측정(strideOf), 게임 GLB 내보내기(exportGame)
# humanoid_actions.py 가 자기 전역에 exec 해서 씀 (단독 실행용 아님)
import bpy, math, os


def soleHeight(rig):
    bpy.context.view_layer.update()
    lowest = math.inf
    for side in ("left", "right"):
        bone = rig.pose.bones[f"foot_{side}"]
        lowest = min(lowest, (rig.matrix_world @ bone.head).z, (rig.matrix_world @ bone.tail).z)
    return lowest


def groundFeet(rig, frames):
    # 키 프레임마다 두 발 중 낮은 쪽(발목·발끝)이 기본 자세 높이에 오도록 엉덩이 높이를 더해 다시 키
    action = rig.animation_data.action
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    rest = soleHeight(rig)
    rig.animation_data.action = action
    hips = rig.pose.bones["hips"]
    scene = bpy.context.scene
    for frame, _ in frames:
        scene.frame_set(frame)
        drop = soleHeight(rig) - rest
        hips.location = (hips.location[0], hips.location[1] - drop, hips.location[2])
        hips.keyframe_insert("location", frame=frame)


def strideOf(rig, name, stance):
    # 한 주기 동안 디딤발이 뒤로 가는 거리 합 = 몸이 나아가는 거리 (게임 humanClips.ts 보폭)
    # 디딤발은 walkPose 위상으로 고름 (달리기는 두 발이 뜨는 구간이 있어 낮은 발로 고르면 틀림), 둘 다 디딤이면 낮은 발
    rig.animation_data.action = bpy.data.actions[name]
    last = int(rig.animation_data.action.frame_range[1])
    total, prev = 0.0, None
    for frame in range(last + 1):
        bpy.context.scene.frame_set(frame)
        feet = [(min((rig.matrix_world @ b.head).z, (rig.matrix_world @ b.tail).z), (rig.matrix_world @ b.head).y)
                for b in (rig.pose.bones["foot_left"], rig.pose.bones["foot_right"])]
        if prev is not None:
            phase = (frame - 0.5) / last
            on = [((phase + offset) % 1.0) < stance for offset in (0.0, 0.5)]
            i = (0 if prev[0][0] <= prev[1][0] else 1) if on[0] == on[1] else on.index(True)
            total += feet[i][1] - prev[i][1]
        prev = feet
    rig.animation_data.action = None
    return round(total, 3)


# 첫 접속 용량 줄이기 — Draco 메시 압축(게임은 world/gltfLoader.ts 의 DRACOLoader 로 풂), 텍스처 한 변 최대 크기(px)
DRACO_OPTIONS = {"export_draco_mesh_compression_enable": True, "export_draco_mesh_compression_level": 6,
                 "export_draco_position_quantization": 14, "export_draco_normal_quantization": 10,
                 "export_draco_texcoord_quantization": 12, "export_draco_generic_quantization": 12}
GAME_TEXTURE_SIZE = 1024


def shrinkTextures(objects, size):
    # 이 크기보다 큰 텍스처는 줄인 복사본으로 잠깐 바꿔 끼움 → (노드, 원래 이미지, 복사본) 목록 (내보낸 뒤 되돌림)
    swaps = []
    for obj in objects:
        for slot in obj.material_slots:
            if slot.material is None or not slot.material.use_nodes:
                continue
            for node in slot.material.node_tree.nodes:
                image = getattr(node, "image", None)
                if image is None or max(image.size) <= size:
                    continue
                small = image.copy()
                small.scale(size * image.size[0] // max(image.size), size * image.size[1] // max(image.size))
                node.image = small
                swaps.append((node, image, small))
    return swaps


def restoreTextures(swaps):
    for node, image, small in swaps:
        node.image = image
        bpy.data.images.remove(small)


def exportGame(rig, path):
    # 뼈대 + 스킨 메시 + 모든 Action(클립) → 게임 GLB (텍스처는 JPEG, 메시는 Draco 압축)
    # 보폭은 뼈대 노드 extras 로 (게임이 userData.walk_stride·run_stride 로 읽음) — 걷기·달리기 클립이 있는 모델만
    if "walk" in bpy.data.actions and "run" in bpy.data.actions:
        rig["walk_stride"], rig["run_stride"] = strideOf(rig, "walk", 0.6), strideOf(rig, "run", 0.5)
    body = next(child for child in rig.children if child.type == "MESH")
    # 게임은 모델 원점 = 발바닥으로 씀 — 뼈대 오브젝트가 옮겨진 채 저장된 blend 라도 원점·회전 0·배율 1 로 내보냄
    saved_transform = rig.matrix_world.copy()
    if not saved_transform.is_identity:
        print("경고: 뼈대 오브젝트 변환이 원점이 아님 → 원점으로 내보냄", tuple(round(v, 3) for v in rig.location))
        rig.matrix_world.identity()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (rig, body):
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    swaps = shrinkTextures([body], GAME_TEXTURE_SIZE)
    try:
        bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_skins=True,
                                  export_animations=True, export_animation_mode="ACTIONS", export_force_sampling=True,
                                  export_reset_pose_bones=True, export_optimize_animation_size=True, export_def_bones=True,
                                  export_morph=False, export_attributes=False, export_image_format="JPEG", export_extras=True,
                                  **DRACO_OPTIONS)
    finally:
        restoreTextures(swaps)
        rig.matrix_world = saved_transform
    # 모든 동작에서 기본값 그대로인 채널(뼈 크기·이동 등)을 지워 용량 줄임 (glb_strip_anim.py)
    strip = {"__name__": "glb_strip_anim"}
    script_dir = globals().get("SCRIPT_DIR", r"D:\work\study\playground_vibe\scripts")
    exec(open(os.path.join(script_dir, "glb_strip_anim.py"), encoding="utf-8").read(), strip)
    strip["stripFile"](path)
    print("→", path, os.path.getsize(path) // 1024, "KB", "stride", rig.get("walk_stride"), rig.get("run_stride"))
