# 캐릭터 GLB 에서 쓸모없는 동작 채널을 지우고 버퍼를 다시 묶음 — 첫 접속 용량 줄이기
# python scripts/glb_strip_anim.py <파일.glb> [...]   (humanoid_export.exportGame 이 내보낸 뒤에도 호출)
# 지우는 것: 모든 동작에서 값이 그대로이고 그 값이 노드 기본값과 같은 (뼈, translation/rotation/scale) 채널
#   → 트랙이 없어도 뼈가 기본값에 머무르므로 결과가 같음 (기본값이 아닌 상수 자세는 동작 전환 때 필요하므로 남김)
#   주의: 트랙이 없어진 뼈(묶음 머리 등)에 게임 코드가 회전을 덧곱하면 매 프레임 쌓임 → 기본 회전에서 다시 계산할 것 (humanClips.ts hair_rest)
import json, os, struct, sys

REST = {"translation": [0, 0, 0], "rotation": [0, 0, 0, 1], "scale": [1, 1, 1]}
EPS = 1e-5


def readGlb(path):
    data = open(path, "rb").read()
    jlen = struct.unpack_from("<I", data, 12)[0]
    gltf = json.loads(data[20:20 + jlen])
    blen = struct.unpack_from("<I", data, 20 + jlen)[0]
    return gltf, data[28 + jlen:28 + jlen + blen]


def writeGlb(path, gltf, binary):
    text = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    binary += b"\0" * (-len(binary) % 4)
    total = 12 + 8 + len(text) + 8 + len(binary)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(text), 0x4E4F534A) + text)
        f.write(struct.pack("<II", len(binary), 0x004E4942) + binary)


def readFloats(gltf, binary, index):
    acc = gltf["accessors"][index]
    if acc.get("componentType") != 5126 or "sparse" in acc or "bufferView" not in acc:
        return None
    view = gltf["bufferViews"][acc["bufferView"]]
    size = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[acc["type"]]
    start = view.get("byteOffset", 0) + acc.get("byteOffset", 0)
    values = struct.unpack_from(f"<{acc['count'] * size}f", binary, start)
    return [values[i:i + size] for i in range(0, len(values), size)]


def isRest(gltf, binary, node, path, sampler):
    rest = gltf["nodes"][node].get(path, REST[path])
    values = readFloats(gltf, binary, sampler["output"])
    if values is None or sampler.get("interpolation") == "CUBICSPLINE":
        return False
    sign = -1 if path == "rotation" and sum(a * b for a, b in zip(values[0], rest)) < 0 else 1  # q 와 -q 는 같은 회전
    return all(abs(v * sign - r) < EPS for key in values for v, r in zip(key, rest))


def stripStaticChannels(gltf, binary):
    groups = {}
    for anim in gltf.get("animations", []):
        for channel in anim["channels"]:
            key = (channel["target"].get("node"), channel["target"]["path"])
            groups.setdefault(key, []).append((anim, channel))
    removable = {key for key, items in groups.items() if key[1] in REST
                 and all(isRest(gltf, binary, key[0], key[1], anim["samplers"][ch["sampler"]]) for anim, ch in items)}
    removed = 0
    for anim in gltf.get("animations", []):
        keep = [ch for ch in anim["channels"] if (ch["target"].get("node"), ch["target"]["path"]) not in removable]
        removed += len(anim["channels"]) - len(keep)
        used = sorted({ch["sampler"] for ch in keep})
        remap = {old: new for new, old in enumerate(used)}
        anim["samplers"] = [anim["samplers"][i] for i in used]
        for ch in keep:
            ch["sampler"] = remap[ch["sampler"]]
        anim["channels"] = keep
    return removed


def accessorRefs(gltf):
    # 모든 accessor 참조를 (dict, key) 로 모아 번호를 다시 매길 수 있게 함
    refs = []
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            refs += [(prim["attributes"], k) for k in prim["attributes"]]
            if "indices" in prim:
                refs.append((prim, "indices"))
            for target in prim.get("targets", []):
                refs += [(target, k) for k in target]
    for skin in gltf.get("skins", []):
        if "inverseBindMatrices" in skin:
            refs.append((skin, "inverseBindMatrices"))
    for anim in gltf.get("animations", []):
        for sampler in anim["samplers"]:
            refs += [(sampler, "input"), (sampler, "output")]
    return refs


def repack(gltf, binary):
    # 쓰이는 accessor·bufferView 만 남기고 BIN 을 4바이트 정렬로 다시 씀
    refs = accessorRefs(gltf)
    used_acc = sorted({d[k] for d, k in refs})
    acc_map = {old: new for new, old in enumerate(used_acc)}
    for d, k in refs:
        d[k] = acc_map[d[k]]
    gltf["accessors"] = [gltf["accessors"][i] for i in used_acc]
    view_refs = [(acc, "bufferView") for acc in gltf["accessors"] if "bufferView" in acc]
    view_refs += [(img, "bufferView") for img in gltf.get("images", []) if "bufferView" in img]
    for mesh in gltf.get("meshes", []):
        for prim in mesh["primitives"]:
            draco = prim.get("extensions", {}).get("KHR_draco_mesh_compression")
            if draco:
                view_refs.append((draco, "bufferView"))
    used_views = sorted({d[k] for d, k in view_refs})
    view_map, views, out = {}, [], bytearray()
    for old in used_views:
        view = dict(gltf["bufferViews"][old])
        start = view.get("byteOffset", 0)
        out += b"\0" * (-len(out) % 4)
        view["byteOffset"] = len(out)
        out += binary[start:start + view["byteLength"]]
        view_map[old] = len(views)
        views.append(view)
    for d, k in view_refs:
        d[k] = view_map[d[k]]
    gltf["bufferViews"] = views
    gltf["buffers"][0]["byteLength"] = len(out)
    return bytes(out)


def stripFile(path):
    before = os.path.getsize(path)
    gltf, binary = readGlb(path)
    if len(gltf.get("buffers", [])) != 1:
        print("건너뜀(버퍼가 1개가 아님):", path)
        return
    removed = stripStaticChannels(gltf, binary)
    binary = repack(gltf, binary)
    writeGlb(path, gltf, binary)
    print(f"{os.path.basename(path)}: 채널 {removed}개 제거, {before // 1024}KB → {os.path.getsize(path) // 1024}KB")


if __name__ == "__main__":
    for glb_path in sys.argv[1:]:
        stripFile(glb_path)
