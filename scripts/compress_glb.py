# 정적 GLB(놀이기구·소품)를 Draco 메시 압축으로 다시 씀 — 첫 접속 용량 줄이기
# blender --background --python scripts/compress_glb.py -- <입력.glb> <출력.glb>
# 노드 이름·재질 이름(toon_/glow_/glass_<hex>)·extras·위치는 그대로 (게임은 이름으로 찾고 재질을 바꿔 끼움)
# 뼈대·동작이 있는 캐릭터는 이 스크립트를 쓰지 말 것 — 다시 불러오면 뼈 기본 방향이 바뀜 (humanoid_export.exportGame 사용)
import bpy, os, sys

args = sys.argv[sys.argv.index("--") + 1:]
SRC, DST = args[0], args[1]
DRACO_OPTIONS = {"export_draco_mesh_compression_enable": True, "export_draco_mesh_compression_level": 6,
                 "export_draco_position_quantization": 14, "export_draco_normal_quantization": 10,
                 "export_draco_texcoord_quantization": 12, "export_draco_generic_quantization": 12}

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC, import_shading="NORMALS")
for obj in bpy.data.objects:
    if obj.type == "ARMATURE":
        sys.exit(f"뼈대가 있는 모델은 다시 쓰지 않음: {SRC}")
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_apply=False, export_animations=False,
                          export_extras=True, export_image_format="JPEG", **DRACO_OPTIONS)
print("→", DST, os.path.getsize(SRC) // 1024, "KB →", os.path.getsize(DST) // 1024, "KB")
