// 손에 든 츄러스 — 별 모양 단면의 긴 과자 + 아래쪽 종이 포장 (먹을수록 위에서부터 짧아짐)
// 솜사탕(cottonCandy.ts)과 같은 모양의 인터페이스 — 아바타가 간식 종류만 바꿔 끼움
import * as THREE from "three";
import { getMaterial } from "../world/rides/common";
import type { CottonCandy } from "./cottonCandy";

// 츄러스 길이 — 간식을 든 자세(손이 가슴 앞)에서 끝이 턱 아래에 오는 길이 (길면 얼굴을 가림),
// 먹기 동작에서는 끝이 입에 닿음 (솜사탕 cottonCandy.ts 의 STICK_LENGTH 와 같은 기준)
const CHURRO_LENGTH = 0.34;
// 별 모양 단면 (꼭짓점 수·바깥·안쪽 반지름)
const STAR_POINTS = 6;
const STAR_OUTER = 0.032;
const STAR_INNER = 0.022;
// 종이 포장 높이 (츄러스 아래쪽을 감쌈)
const SLEEVE_HEIGHT = 0.13;
// 다 먹어 가도 포장 위로 이만큼은 남아 보이다가 사라짐
const MIN_LENGTH_SCALE = 0.3;

let churro_geometry: THREE.BufferGeometry | null = null;
let sleeve_geometry: THREE.BufferGeometry | null = null;

// 별 모양 단면을 위(+y)로 길게 뽑은 도형 (원점 = 아래 끝)
function getChurroGeometry(): THREE.BufferGeometry {
    if (churro_geometry === null) {
        const star = new THREE.Shape();
        for (let index = 0; index <= STAR_POINTS * 2; index += 1) {
            const angle = (index / (STAR_POINTS * 2)) * Math.PI * 2;
            const radius = index % 2 === 0 ? STAR_OUTER : STAR_INNER;
            const point = [Math.cos(angle) * radius, Math.sin(angle) * radius] as const;
            if (index === 0) {
                star.moveTo(point[0], point[1]);
            } else {
                star.lineTo(point[0], point[1]);
            }
        }
        // 끝을 살짝 둥글게 (bevel)
        churro_geometry = new THREE.ExtrudeGeometry(star, { depth: CHURRO_LENGTH, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.006, bevelSegments: 2 });
        churro_geometry.rotateX(-Math.PI / 2);
    }
    return churro_geometry;
}

export function createChurros(): CottonCandy {
    const group = new THREE.Group();
    const churro = new THREE.Mesh(getChurroGeometry(), getMaterial("#d4a373"));
    churro.castShadow = true;
    group.add(churro);
    // 빨강·흰 종이 포장 (츄러스보다 살짝 굵게)
    sleeve_geometry ??= new THREE.CylinderGeometry(0.045, 0.04, SLEEVE_HEIGHT, 10).translate(0, SLEEVE_HEIGHT / 2, 0);
    const sleeve = new THREE.Mesh(sleeve_geometry, getMaterial("#e63946"));
    group.add(sleeve);
    return {
        group,
        set(color, left) {
            group.visible = left > 0;
            if (!group.visible) {
                return;
            }
            churro.material = getMaterial(color === "" ? "#d4a373" : color);
            // 위에서부터 베어 먹어 짧아짐 (원점이 아래 끝이라 y 배율만 줄이면 됨)
            churro.scale.y = MIN_LENGTH_SCALE + (1 - MIN_LENGTH_SCALE) * left;
        },
    };
}

// 장면을 떠날 때 공유 도형 해제
export function disposeChurrosGeometries(): void {
    churro_geometry?.dispose();
    sleeve_geometry?.dispose();
    churro_geometry = null;
    sleeve_geometry = null;
}
