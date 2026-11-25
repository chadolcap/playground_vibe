// GLB 로더 — 모델은 Draco 메시 압축으로 내보내므로(scripts/humanoid_export.py·compress_glb.py) 디코더를 붙여 씀
// 디코더(public/draco, three 패키지의 examples/jsm/libs/draco/gltf 복사본)는 처음 압축 모델을 열 때 한 번만 받음
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let draco_loader: DRACOLoader | null = null;

export function createGltfLoader(): GLTFLoader {
    if (draco_loader === null) {
        draco_loader = new DRACOLoader();
        draco_loader.setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    }
    return new GLTFLoader().setDRACOLoader(draco_loader);
}
