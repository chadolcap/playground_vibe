// 손에 든 솜사탕 — 나무 막대 + 몽실몽실한 솜 (먹을수록 솜이 작아짐)
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { getMaterial } from "../world/rides/common";

// 막대 길이 — 간식을 든 자세(손이 가슴 앞)에서 솜 윗부분이 턱 아래에 오는 길이 (길면 솜이 얼굴을 가림),
// 먹기 동작에서는 솜 윗부분이 입에 닿음
const STICK_LENGTH = 0.16;
// 주먹이 막대 아래 끝에서 이만큼 위를 쥠 (막대 아래 끝은 주먹 밑으로 나옴) — 솜이 그만큼 손 쪽으로 내려와
// 먹기 동작에서도 솜 꼭대기가 눈보다 아래 (4종 캐릭터 모두 손 위치 기준이라 같이 적용)
const GRIP_FROM_BOTTOM = 0.1;
// 다 먹어 가도 막대 끝에 이만큼은 남아 보이다가 사라짐
const MIN_FLUFF_SCALE = 0.3;

export interface CottonCandy {
    readonly group: THREE.Group;
    // left: 남은 양 1 ~ 0
    set(color: string, left: number): void;
}

// 솜 도형은 모든 솜사탕이 공유 (색만 재질로 다르게)
let fluff_geometry: THREE.BufferGeometry | null = null;
let stick_geometry: THREE.BufferGeometry | null = null;

function getFluffGeometry(): THREE.BufferGeometry {
    if (fluff_geometry === null) {
        const puffs: [number, number, number, number][] = [
            [0, 0, 0, 0.16], [0.09, 0.05, 0.04, 0.11], [-0.08, 0.06, -0.03, 0.11], [0.02, 0.12, -0.06, 0.1], [-0.03, -0.07, 0.07, 0.1],
        ];
        fluff_geometry = mergeGeometries(puffs.map(([x, y, z, radius]) => new THREE.SphereGeometry(radius, 12, 8).translate(x, y, z))) ?? new THREE.SphereGeometry(0.18, 12, 8);
    }
    return fluff_geometry;
}

export function createCottonCandy(): CottonCandy {
    const group = new THREE.Group();
    stick_geometry ??= new THREE.CylinderGeometry(0.012, 0.012, STICK_LENGTH, 6).translate(0, STICK_LENGTH / 2 - GRIP_FROM_BOTTOM, 0);
    group.add(new THREE.Mesh(stick_geometry, getMaterial("#f1e3c8")));
    const fluff = new THREE.Mesh(getFluffGeometry(), getMaterial("#ffafcc"));
    fluff.position.y = STICK_LENGTH - GRIP_FROM_BOTTOM + 0.08;
    fluff.castShadow = true;
    group.add(fluff);
    let current_color = "";
    return {
        group,
        set(color, left) {
            group.visible = left > 0 && color !== "";
            if (!group.visible) {
                return;
            }
            if (color !== current_color) {
                current_color = color;
                fluff.material = getMaterial(color);
            }
            fluff.scale.setScalar(MIN_FLUFF_SCALE + (1 - MIN_FLUFF_SCALE) * left);
        },
    };
}

// 장면을 떠날 때 공유 도형 해제
export function disposeCottonCandyGeometries(): void {
    fluff_geometry?.dispose();
    stick_geometry?.dispose();
    fluff_geometry = null;
    stick_geometry = null;
}
