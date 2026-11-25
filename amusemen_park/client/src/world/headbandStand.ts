// 머리띠 판매점 — 작은 가판대(창구 진열대 + 뒷벽 + 줄무늬 차양) 위에 마네킹 머리 6개가 머리띠를 쓰고 진열됨, 간판
// 위치·정면 방향은 shared/headband.ts 의 HEADBAND_SHOP (로컬 +z = 정면, 손님이 서는 쪽)
import * as THREE from "three";
import { HEADBAND_LIST, HEADBAND_SHOP } from "@shared";
import { createHeadband } from "../character/headband";
import { createSignBoard } from "./labels";
import { addMesh } from "./rides/common";

const WIDTH = 3.4;
const DEPTH = 2.2;
const COUNTER_HEIGHT = 1.05;
const ROOF_Y = 2.9;
// 진열 마네킹 머리 반지름
const DISPLAY_HEAD = 0.13;
// 캐릭터가 가판대를 뚫고 지나가지 않게 막는 원 반지름 (가판대 모서리까지) — 창구 앞(SHOP_COUNTER_DISTANCE)보다 작아야 함
const STAND_SOLID_RADIUS = 2.0;
// 판매원 발판 높이·자리 — 진열대 위 마네킹 머리(위 끝 약 1.55m)보다 판매원 얼굴이 위로 보이게 (world/snackVendor.ts 가 이 위에 세움)
export const STAND_VENDOR_STEP_HEIGHT = 0.6;
export const STAND_VENDOR_SPOT = { x: 0.6, z: -0.35 } as const;

export function createHeadbandStand(): THREE.Group {
    const stand = new THREE.Group();

    // 앞쪽 진열대(창구) + 진열대 상판 + 뒷벽 + 옆벽
    addMesh(stand, new THREE.BoxGeometry(WIDTH, COUNTER_HEIGHT, 0.7), "#cdb4db", [0, COUNTER_HEIGHT / 2, DEPTH / 2 - 0.35]);
    addMesh(stand, new THREE.BoxGeometry(WIDTH + 0.2, 0.1, 0.9), "#fefae0", [0, COUNTER_HEIGHT + 0.05, DEPTH / 2 - 0.35]);
    addMesh(stand, new THREE.BoxGeometry(WIDTH, ROOF_Y, 0.15), "#ffc8dd", [0, ROOF_Y / 2, -DEPTH / 2 + 0.08]);
    for (const side of [-1, 1]) {
        addMesh(stand, new THREE.BoxGeometry(0.15, ROOF_Y, DEPTH), "#ffc8dd", [side * (WIDTH / 2 - 0.08), ROOF_Y / 2, 0]);
    }

    // 진열대 위 마네킹 머리 6개 (받침 + 머리 + 머리띠)
    HEADBAND_LIST.forEach((headband, index) => {
        const x = -WIDTH / 2 + 0.45 + index * ((WIDTH - 0.9) / (HEADBAND_LIST.length - 1));
        const base_y = COUNTER_HEIGHT + 0.1;
        addMesh(stand, new THREE.CylinderGeometry(0.03, 0.05, 0.12, 8), "#ffffff", [x, base_y + 0.06, DEPTH / 2 - 0.3]);
        addMesh(stand, new THREE.SphereGeometry(DISPLAY_HEAD, 14, 10), "#ffe8d6", [x, base_y + 0.12 + DISPLAY_HEAD, DEPTH / 2 - 0.3]);
        const model = createHeadband(headband.id, DISPLAY_HEAD * 2);
        model.position.set(x, base_y + 0.12 + DISPLAY_HEAD * 2, DEPTH / 2 - 0.3);
        stand.add(model);
    });

    // 판매원 발판 (진열대 뒤)
    addMesh(stand, new THREE.BoxGeometry(0.9, STAND_VENDOR_STEP_HEIGHT, 0.7), "#b98a63", [STAND_VENDOR_SPOT.x, STAND_VENDOR_STEP_HEIGHT / 2, STAND_VENDOR_SPOT.z]);
    addMesh(stand, new THREE.BoxGeometry(0.94, 0.06, 0.74), "#d4a373", [STAND_VENDOR_SPOT.x, STAND_VENDOR_STEP_HEIGHT - 0.03, STAND_VENDOR_SPOT.z]);

    // 뒷벽 거울(장식) — 손님이 써 보는 느낌
    addMesh(stand, new THREE.BoxGeometry(0.9, 1.1, 0.05), "#bde0fe", [0, 1.85, -DEPTH / 2 + 0.18]);

    // 보라·흰 줄무늬 차양 (앞으로 조금 기울어짐) + 차양 끝 술 장식
    const stripes = 7;
    for (let index = 0; index < stripes; index += 1) {
        const width = (WIDTH + 0.5) / stripes;
        const x = -(WIDTH + 0.5) / 2 + (index + 0.5) * width;
        addMesh(stand, new THREE.BoxGeometry(width, 0.12, DEPTH + 0.7), index % 2 === 0 ? "#9d4edd" : "#ffffff", [x, ROOF_Y + 0.1, 0.25], [0.14, 0, 0]);
    }
    for (let index = 0; index <= stripes; index += 1) {
        const x = -(WIDTH + 0.5) / 2 + index * ((WIDTH + 0.5) / stripes);
        addMesh(stand, new THREE.SphereGeometry(0.07, 8, 6), "#ffd166", [x, ROOF_Y - 0.1, DEPTH / 2 + 0.55]);
    }

    // 간판 (차양 위, 정면)
    const sign = createSignBoard("🎀 머리띠", { height: 0.7, background: "#fff3c4", color: "#7b2cbf" });
    sign.position.set(0, ROOF_Y + 0.7, 0.2);
    stand.add(sign);

    stand.userData.solid_radius = STAND_SOLID_RADIUS;
    stand.position.set(HEADBAND_SHOP.x, 0, HEADBAND_SHOP.z);
    stand.rotation.y = HEADBAND_SHOP.rot_y;
    return stand;
}
