// 간식 푸드 수레 (솜사탕·츄러스) — 바퀴 달린 나무 수레 + 줄무늬 차양 + 간판은 공통, 진열대 위 물건만 다름
// 솜사탕: 솜사탕 기계와 막대에 꽂힌 여러 색 솜사탕 / 츄러스: 튀김기와 컵에 꽂힌 츄러스
// 위치·정면 방향은 shared/snack.ts 의 COTTON_CANDY_CART·CHURROS_CART (로컬 +z = 정면, 손님이 서는 쪽)
import * as THREE from "three";
import { CHURROS_CART, COTTON_CANDY_CART, COTTON_CANDY_COLORS, type SnackCart } from "@shared";
import { createSignBoard } from "./labels";
import { addMesh } from "./rides/common";

const BODY_WIDTH = 2.6;
const BODY_DEPTH = 1.3;
// 몸통 높이 — 판매대(윗면 약 1.25m)가 낮아야 뒤에 선 판매원 오리(발판 위)의 얼굴·셔츠·넥타이가 보임
const BODY_HEIGHT = 0.7;
const COUNTER_Y = 0.45 + BODY_HEIGHT;
const CANOPY_Y = 2.75;
// 수레를 막는 원 반지름 (손잡이 끝까지 대략) — 판매 창구 앞(CART_COUNTER_DISTANCE)보다 작아야 손님이 설 수 있음
const CART_SOLID_RADIUS = 1.5;
// 수레 뒤 판매원 발판 높이·자리 — world/snackVendor.ts 가 판매원을 이 위에 세움
// 가운데(x 0)에 서서 진열품(오른쪽)과 기계(왼쪽) 사이로 얼굴이 보이게, 뒷바퀴(z −0.73)와 겹치지 않게 뒤로
export const VENDOR_STEP_HEIGHT = 0.55;
export const CART_VENDOR_SPOT = { x: 0, z: -1.12 } as const;

// 수레마다 다른 색·간판
interface CartStyle {
    // 몸통 앞 띠·바퀴·차양 줄무늬 색
    accent: string;
    wheel: string;
    sign_text: string;
    sign_color: string;
}

// 공통 수레 (몸통·손잡이·바퀴·차양·간판·막는 원·배치) — 진열대 위 물건은 decorate 로 붙임
function createSnackCart(pose: SnackCart, style: CartStyle, decorate: (cart: THREE.Group) => void): THREE.Group {
    const cart = new THREE.Group();

    // 수레 몸통 (나무 상자 + 앞쪽 색 띠) 과 손잡이
    addMesh(cart, new THREE.BoxGeometry(BODY_WIDTH, BODY_HEIGHT, BODY_DEPTH), "#e9c46a", [0, 0.45 + BODY_HEIGHT / 2, 0]);
    addMesh(cart, new THREE.BoxGeometry(BODY_WIDTH + 0.02, 0.28, BODY_DEPTH + 0.02), style.accent, [0, 0.45 + BODY_HEIGHT * 0.62, 0]);
    addMesh(cart, new THREE.BoxGeometry(BODY_WIDTH + 0.3, 0.1, BODY_DEPTH + 0.3), "#fefae0", [0, COUNTER_Y + 0.05, 0]);
    addMesh(cart, new THREE.CylinderGeometry(0.04, 0.04, 1.1, 8), "#b98a63", [-BODY_WIDTH / 2 - 0.45, 0.45 + BODY_HEIGHT * 0.6, 0], [0, 0, Math.PI / 2 - 0.35]);

    // 바퀴 2개 + 앞쪽 받침 다리
    for (const z of [-1, 1]) {
        addMesh(cart, new THREE.CylinderGeometry(0.42, 0.42, 0.12, 20), style.wheel, [0.55, 0.42, z * (BODY_DEPTH / 2 + 0.08)], [Math.PI / 2, 0, 0]);
        addMesh(cart, new THREE.CylinderGeometry(0.12, 0.12, 0.14, 12), "#fff3b0", [0.55, 0.42, z * (BODY_DEPTH / 2 + 0.08)], [Math.PI / 2, 0, 0]);
        addMesh(cart, new THREE.BoxGeometry(0.1, 0.45, 0.1), "#b98a63", [-BODY_WIDTH / 2 + 0.2, 0.22, z * (BODY_DEPTH / 2 - 0.15)]);
    }

    // 판매원 발판 (수레 뒤, 판매원 오리가 판매대 위로 얼굴을 내밀도록)
    addMesh(cart, new THREE.BoxGeometry(0.9, VENDOR_STEP_HEIGHT, 0.7), "#b98a63", [CART_VENDOR_SPOT.x, VENDOR_STEP_HEIGHT / 2, CART_VENDOR_SPOT.z]);
    addMesh(cart, new THREE.BoxGeometry(0.94, 0.06, 0.74), "#d4a373", [CART_VENDOR_SPOT.x, VENDOR_STEP_HEIGHT - 0.03, CART_VENDOR_SPOT.z]);

    decorate(cart);

    // 차양 기둥 4개 + 색·흰 줄무늬 지붕 + 지붕 끝 둥근 장식
    for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
            addMesh(cart, new THREE.CylinderGeometry(0.04, 0.04, CANOPY_Y - COUNTER_Y, 8), "#ffffff", [x * (BODY_WIDTH / 2 - 0.1), (CANOPY_Y + COUNTER_Y) / 2, z * (BODY_DEPTH / 2 - 0.1)]);
        }
    }
    const stripes = 6;
    for (let index = 0; index < stripes; index += 1) {
        const width = (BODY_WIDTH + 0.6) / stripes;
        const x = -(BODY_WIDTH + 0.6) / 2 + (index + 0.5) * width;
        addMesh(cart, new THREE.BoxGeometry(width, 0.12, BODY_DEPTH + 0.8), index % 2 === 0 ? style.accent : "#ffffff", [x, CANOPY_Y, 0], [0.12, 0, 0]);
    }
    for (let index = 0; index <= stripes; index += 1) {
        const x = -(BODY_WIDTH + 0.6) / 2 + index * ((BODY_WIDTH + 0.6) / stripes);
        addMesh(cart, new THREE.SphereGeometry(0.08, 8, 6), "#ffd166", [x, CANOPY_Y - 0.1, (BODY_DEPTH + 0.8) / 2 - 0.04]);
    }

    // 간판 (차양 위, 정면)
    const sign = createSignBoard(style.sign_text, { height: 0.7, background: "#fff3c4", color: style.sign_color });
    sign.position.set(0, CANOPY_Y + 0.55, 0.1);
    cart.add(sign);

    // 캐릭터가 수레를 뚫고 지나가거나 바퀴 위로 올라서지 않게 원으로 막음 (groundMap)
    cart.userData.solid_radius = CART_SOLID_RADIUS;
    cart.position.set(pose.x, 0, pose.z);
    cart.rotation.y = pose.rot_y;
    return cart;
}

export function createCottonCandyCart(): THREE.Group {
    return createSnackCart(COTTON_CANDY_CART, { accent: "#ff8fab", wheel: "#ff5d8f", sign_text: "🍭 솜사탕", sign_color: "#d6336c" }, (cart) => {
        // 솜사탕 기계: 은색 받침 + 둥근 그릇 + 그릇 속 몽글몽글 솜 (왼쪽 끝 — 가운데는 판매원 얼굴 자리)
        addMesh(cart, new THREE.CylinderGeometry(0.22, 0.28, 0.35, 16), "#ced4da", [-0.8, COUNTER_Y + 0.27, 0]);
        addMesh(cart, new THREE.CylinderGeometry(0.5, 0.32, 0.32, 24, 1, true), "#e9ecef", [-0.8, COUNTER_Y + 0.6, 0]);
        addMesh(cart, new THREE.SphereGeometry(0.34, 16, 10), "#ffc8dd", [-0.8, COUNTER_Y + 0.62, 0]);

        // 진열된 솜사탕 (막대에 꽂힌 여러 색, 오른쪽)
        COTTON_CANDY_COLORS.forEach((color, index) => {
            const x = 0.5 + index * 0.26;
            addMesh(cart, new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), "#f1e3c8", [x, COUNTER_Y + 0.35, 0.25]);
            addMesh(cart, new THREE.SphereGeometry(0.16, 12, 8), color, [x, COUNTER_Y + 0.66, 0.25]);
        });
    });
}

export function createChurrosCart(): THREE.Group {
    return createSnackCart(CHURROS_CART, { accent: "#e76f51", wheel: "#c1121f", sign_text: "✨ 츄러스", sign_color: "#9c4221" }, (cart) => {
        // 튀김기: 은색 통 + 황금빛 기름 + 튀겨지는 츄러스 두 줄
        addMesh(cart, new THREE.BoxGeometry(0.8, 0.32, 0.6), "#ced4da", [-0.75, COUNTER_Y + 0.26, 0]);
        addMesh(cart, new THREE.BoxGeometry(0.7, 0.04, 0.5), "#f4a261", [-0.75, COUNTER_Y + 0.43, 0]);
        for (const z of [-0.1, 0.1]) {
            addMesh(cart, new THREE.CylinderGeometry(0.03, 0.03, 0.6, 6), "#d4a373", [-0.75, COUNTER_Y + 0.46, z], [0, 0, Math.PI / 2]);
        }
        // 진열 컵 3개에 츄러스를 비스듬히 꽂음 (빨강 종이컵, 오른쪽 — 가운데는 판매원 얼굴 자리)
        for (let index = 0; index < 3; index += 1) {
            const x = 0.55 + index * 0.33;
            addMesh(cart, new THREE.CylinderGeometry(0.12, 0.09, 0.22, 12), "#e63946", [x, COUNTER_Y + 0.21, 0.25]);
            for (const tilt of [-0.18, 0, 0.18]) {
                addMesh(cart, new THREE.CylinderGeometry(0.028, 0.028, 0.55, 6), "#d4a373", [x + tilt * 0.4, COUNTER_Y + 0.45, 0.25], [0, 0, tilt]);
            }
        }
    });
}
