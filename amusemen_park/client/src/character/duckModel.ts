// 새끼 오리 모델 생성 — 도형만 담당 (애니메이션은 duckAnimation.ts)
// 추후 glTF 모델로 바꿀 때는 이 파일만 교체하고 같은 DuckRig 구조(움직일 노드)를 돌려주면 된다
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { getMaterial, getToonGradient } from "../world/rides/common";

// 애니메이션이 움직이는 노드 모음
export interface DuckRig {
    // 위치·방향을 정하는 최상위 노드 (원점 = 발바닥, 정면 +z)
    root: THREE.Group;
    // 몸통 전체 (뒤뚱거림·통통 튀기)
    body: THREE.Group;
    // 날개 (어깨 기준 회전)
    wing_left: THREE.Object3D;
    wing_right: THREE.Object3D;
    // 다리 (엉덩이 기준 회전)
    leg_left: THREE.Object3D;
    leg_right: THREE.Object3D;
}

// 모델 크기 — 이름표 높이·앉는 위치 계산에 사용
export const DUCK_HEIGHT = 1.55;
// 앉았을 때 몸통이 내려가는 높이 (앉기 애니메이션)
export const DUCK_SIT_DROP = 0.3;
// 앉은 오리의 엉덩이가 좌석 면(앵커)에 닿도록 root 를 앵커보다 올리는 높이
export const DUCK_SEAT_OFFSET = 0.1;

const HIP_HEIGHT = 0.32;
const FOOT_COLOR = "#ff9f1c";

// 모든 오리가 같은 도형을 공유 (색만 재질로 다르게)
interface DuckGeometries {
    body: THREE.BufferGeometry;
    face: THREE.BufferGeometry;
    wing: THREE.BufferGeometry;
    leg: THREE.BufferGeometry;
}

let shared_geometries: DuckGeometries | null = null;
let face_material: THREE.MeshToonMaterial | null = null;

function placed(geometry: THREE.BufferGeometry, x: number, y: number, z: number, scale: [number, number, number] = [1, 1, 1]): THREE.BufferGeometry {
    geometry.scale(scale[0], scale[1], scale[2]);
    geometry.translate(x, y, z);
    return geometry;
}

// 부위마다 색을 정점 색으로 칠해 하나의 도형으로 합침 (눈·부리·볼을 한 번에 그림)
function colored(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
    const rgb = new THREE.Color(color);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
        colors.set([rgb.r, rgb.g, rgb.b], index * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function mergeOrThrow(parts: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
    const merged = mergeGeometries(parts);
    if (merged === null) {
        throw new Error(`오리 ${name} 도형을 합치지 못했습니다.`);
    }
    for (const part of parts) {
        part.dispose();
    }
    return merged;
}

function buildGeometries(): DuckGeometries {
    // 몸통 + 머리 + 꼬리 + 머리 위 깃털 (모두 몸 색)
    const body = mergeOrThrow([
        placed(new THREE.SphereGeometry(0.5, 16, 12), 0, 0.62, -0.02, [1, 0.85, 1.12]),
        placed(new THREE.SphereGeometry(0.37, 16, 12), 0, 1.15, 0.2),
        placed(new THREE.ConeGeometry(0.16, 0.34, 8).rotateX(-2.2), 0, 0.82, -0.55),
        placed(new THREE.ConeGeometry(0.07, 0.22, 6).rotateX(-0.4), 0, 1.55, 0.18),
    ], "몸통");

    // 눈 + 부리 + 볼 (정점 색)
    const face = mergeOrThrow([
        colored(placed(new THREE.SphereGeometry(0.065, 10, 8), 0.15, 1.22, 0.5), "#1b1b1b"),
        colored(placed(new THREE.SphereGeometry(0.065, 10, 8), -0.15, 1.22, 0.5), "#1b1b1b"),
        colored(placed(new THREE.SphereGeometry(0.022, 6, 4), 0.17, 1.25, 0.56), "#ffffff"),
        colored(placed(new THREE.SphereGeometry(0.022, 6, 4), -0.13, 1.25, 0.56), "#ffffff"),
        colored(placed(new THREE.SphereGeometry(0.15, 12, 8), 0, 1.08, 0.58, [1.1, 0.42, 1]), FOOT_COLOR),
        colored(placed(new THREE.SphereGeometry(0.07, 8, 6), 0.25, 1.1, 0.43), "#ffadad"),
        colored(placed(new THREE.SphereGeometry(0.07, 8, 6), -0.25, 1.1, 0.43), "#ffadad"),
    ], "얼굴");

    // 날개: 어깨(원점)에서 아래로 늘어진 납작한 타원
    const wing = placed(new THREE.SphereGeometry(0.3, 12, 8), 0, -0.2, 0, [0.35, 0.85, 1.1]);

    // 다리 + 물갈퀴 발: 엉덩이(원점)에서 아래로
    const leg = mergeOrThrow([
        placed(new THREE.CylinderGeometry(0.045, 0.045, HIP_HEIGHT, 6), 0, -HIP_HEIGHT / 2, 0),
        placed(new THREE.SphereGeometry(0.14, 10, 6), 0, -HIP_HEIGHT + 0.03, 0.09, [1, 0.3, 1.4]),
    ], "다리");

    return { body, face, wing, leg };
}

function getSharedGeometries(): DuckGeometries {
    shared_geometries ??= buildGeometries();
    return shared_geometries;
}

function getFaceMaterial(): THREE.MeshToonMaterial {
    face_material ??= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient() });
    return face_material;
}

function shadowed(mesh: THREE.Mesh): THREE.Mesh {
    mesh.castShadow = true;
    return mesh;
}

// 몸 색(#rrggbb)을 받아 오리 한 마리 생성 — 메시 6개
export function createDuckRig(body_color: string): DuckRig {
    const geometries = getSharedGeometries();
    const body_material = getMaterial(body_color);
    // 날개는 몸보다 살짝 진한 색
    const wing_material = getMaterial(new THREE.Color(body_color).multiplyScalar(0.85));
    const foot_material = getMaterial(FOOT_COLOR);

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    body.add(shadowed(new THREE.Mesh(geometries.body, body_material)));
    body.add(new THREE.Mesh(geometries.face, getFaceMaterial()));

    const wing_left = shadowed(new THREE.Mesh(geometries.wing, wing_material));
    wing_left.position.set(0.47, 0.82, -0.02);
    const wing_right = shadowed(new THREE.Mesh(geometries.wing, wing_material));
    wing_right.position.set(-0.47, 0.82, -0.02);
    body.add(wing_left, wing_right);

    const leg_left = shadowed(new THREE.Mesh(geometries.leg, foot_material));
    leg_left.position.set(0.17, HIP_HEIGHT, 0.02);
    const leg_right = shadowed(new THREE.Mesh(geometries.leg, foot_material));
    leg_right.position.set(-0.17, HIP_HEIGHT, 0.02);
    root.add(leg_left, leg_right);

    return { root, body, wing_left, wing_right, leg_left, leg_right };
}

// 월드를 정리할 때 공유 도형도 함께 해제 (다음 입장 때 다시 생성)
export function disposeDuckGeometries(): void {
    if (shared_geometries !== null) {
        for (const geometry of Object.values(shared_geometries)) {
            geometry.dispose();
        }
        shared_geometries = null;
    }
    face_material?.dispose();
    face_material = null;
}
