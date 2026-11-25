// 가게 판매원 오리 — 간식 수레: duck_1, 머리띠 판매점: duck_2 (Blender 작업 파일: image/제작/캐릭터/duck_*_3d/duck_*.blend)
// 판매대 뒤에 서서 서 있기(idle)를 반복하다가 가끔 손님 쪽으로 안녕(wave) — 클립은 scripts/humanoid_actions.py 로 만든 Action
// 모델을 불러오지 못하면 판매원 없이 가게만 보임 (게임 진행에는 영향 없음)
import * as THREE from "three";
import { createGltfLoader } from "./gltfLoader";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { CART_VENDOR_SPOT, VENDOR_STEP_HEIGHT } from "./cottonCandyCart";
import { STAND_VENDOR_SPOT, STAND_VENDOR_STEP_HEIGHT } from "./headbandStand";
import { getToonGradient } from "./rides/common";

// 가게 로컬 좌표(정면 +z = 손님 쪽)의 판매원 자리 — 판매대 뒤에 서서 손님을 봄
// 간식 수레: 판매대 높이(1.5m)가 오리 키(1.55m)와 비슷해, 수레 뒤 발판(cottonCandyCart.ts) 위에 세워 얼굴·넥타이가 판매대 위로 보이게
export const CART_VENDOR_POSITION = new THREE.Vector3(CART_VENDOR_SPOT.x, VENDOR_STEP_HEIGHT, CART_VENDOR_SPOT.z);
// 머리띠 판매점: 진열대 뒤 발판(headbandStand.ts) 위 — 진열된 마네킹 머리 위로 얼굴이 보이게, 뒷벽 가운데 거울을 가리지 않게 옆으로
export const STAND_VENDOR_POSITION = new THREE.Vector3(STAND_VENDOR_SPOT.x, STAND_VENDOR_STEP_HEIGHT, STAND_VENDOR_SPOT.z);
// 인사 주기(초)와 한 번 인사하는 시간 (wave 클립 1초 × 2번) — 판매원마다 시작을 어긋나게
const WAVE_INTERVAL = 7;
const WAVE_SECONDS = 2;
// 서 있기 ↔ 인사가 섞이는 빠르기 (클수록 빨리 바뀜)
const FADE_RATE = 8;

interface Vendor {
    mixer: THREE.AnimationMixer;
    idle: THREE.AnimationAction | null;
    wave: THREE.AnimationAction | null;
    wave_mix: number;
    clock: number;
}

export interface ShopVendors {
    update(delta: number): void;
}

// 판매원 하나: 붙일 가게 묶음(createCottonCandyCart 등의 결과), 모델 이름(client/public/models/<이름>.glb), 가게 안 자리
export interface VendorSpot {
    shop: THREE.Object3D;
    model: string;
    position: THREE.Vector3;
}

export function createShopVendors(spots: readonly VendorSpot[]): ShopVendors {
    const vendors: Vendor[] = [];
    const loader = createGltfLoader();
    // 같은 모델은 한 번만 불러와 판매원마다 복제
    for (const model_name of new Set(spots.map((spot) => spot.model))) {
        const url = `${import.meta.env.BASE_URL}models/${model_name}.glb`;
        loader.loadAsync(url).then(
            (gltf) => placeVendors(gltf, spots.filter((spot) => spot.model === model_name)),
            (error: unknown) => console.warn(`판매원 모델(${url})을 불러오지 못했습니다.`, error),
        );
    }

    function placeVendors(gltf: { scene: THREE.Group; animations: THREE.AnimationClip[] }, model_spots: readonly VendorSpot[]): void {
        // 공원의 툰 재질과 맞춤 (구운 텍스처는 그대로) — 판매원마다 복제해도 재질은 같이 씀
        const toon_materials = new Map<THREE.Material, THREE.MeshToonMaterial>();
        gltf.scene.traverse((node) => {
            if (node instanceof THREE.Mesh) {
                node.castShadow = true;
                const source = node.material as THREE.MeshStandardMaterial;
                let toon = toon_materials.get(source);
                if (toon === undefined) {
                    toon = new THREE.MeshToonMaterial({ map: source.map, gradientMap: getToonGradient() });
                    toon_materials.set(source, toon);
                    source.dispose();
                }
                node.material = toon;
            }
        });
        const idle_clip = THREE.AnimationClip.findByName(gltf.animations, "idle");
        const wave_clip = THREE.AnimationClip.findByName(gltf.animations, "wave");
        for (const spot of model_spots) {
            const model = clone(gltf.scene);
            model.position.copy(spot.position);
            spot.shop.add(model);
            const mixer = new THREE.AnimationMixer(model);
            const idle = idle_clip === null ? null : mixer.clipAction(idle_clip);
            const wave = wave_clip === null ? null : mixer.clipAction(wave_clip);
            idle?.play();
            wave?.setEffectiveWeight(0).play();
            // 판매원끼리 동시에 인사하지 않게 시작 시각을 주기의 1/3 씩 어긋냄 (불러온 순서대로)
            vendors.push({ mixer, idle, wave, wave_mix: 0, clock: (vendors.length * WAVE_INTERVAL) / 3 });
        }
    }

    return {
        update(delta) {
            const ratio = 1 - Math.exp(-FADE_RATE * delta);
            for (const vendor of vendors) {
                vendor.clock += delta;
                const waving = vendor.clock % WAVE_INTERVAL < WAVE_SECONDS;
                // 인사를 시작할 때마다 손을 드는 처음부터
                if (waving && vendor.wave_mix < 0.01 && vendor.wave !== null) {
                    vendor.wave.time = 0;
                }
                vendor.wave_mix = THREE.MathUtils.lerp(vendor.wave_mix, waving ? 1 : 0, ratio);
                vendor.wave?.setEffectiveWeight(vendor.wave_mix);
                vendor.idle?.setEffectiveWeight(1 - vendor.wave_mix);
                vendor.mixer.update(delta);
            }
        },
    };
}
