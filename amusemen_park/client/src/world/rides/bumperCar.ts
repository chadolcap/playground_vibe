// 범퍼카 — 지붕 있는 경기장 안을 1인승 차 8대가 돌아다님 (좌석 8)
// 접속 중에는 서버 물리(충돌·조종) 결과 위치로 그리고, 그 전에는 자체 경로로 돌아다님
import * as THREE from "three";
import { BUMPER, RIDE_ID } from "@shared";
import { addMesh, type RideModel } from "./common";

const ARENA_WIDTH = BUMPER.ARENA_WIDTH;
const ARENA_DEPTH = BUMPER.ARENA_DEPTH;
const ROOF_HEIGHT = 5.2;
const CAR_COLORS = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#f78c6b", "#9b5de5", "#00bbf9", "#f15bb5"];

interface CarMotion {
    group: THREE.Group;
    // 리사주 곡선 매개변수 (서로 다른 경로로 돌아다니게)
    freq_x: number;
    freq_z: number;
    phase_x: number;
    phase_z: number;
}

export function createBumperCar(): BumperCarModel {
    const root = new THREE.Group();

    // 바닥·지붕·기둥
    addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH, 0.3, ARENA_DEPTH), "#4a4e69", [0, 0.15, 0]);
    // 지붕은 반투명 차양 — 위에서 구경하는 사람도 안에서 범퍼카가 부딪히는 모습을 볼 수 있게
    const canopy = addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH + 1, 0.3, ARENA_DEPTH + 1), "#ff8fab", [0, ROOF_HEIGHT + 0.15, 0]);
    const canopy_material = (canopy.material as THREE.MeshToonMaterial).clone();
    canopy_material.transparent = true;
    canopy_material.opacity = 0.28;
    canopy_material.depthWrite = false;
    canopy.material = canopy_material;
    canopy.castShadow = false;
    for (const x of [-ARENA_WIDTH / 2, ARENA_WIDTH / 2]) {
        for (const z of [-ARENA_DEPTH / 2, ARENA_DEPTH / 2]) {
            addMesh(root, new THREE.CylinderGeometry(0.25, 0.25, ROOF_HEIGHT, 10), "#ffd60a", [x, ROOF_HEIGHT / 2, z]);
        }
    }
    // 낮은 울타리 (정면 가운데는 출입구)
    addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH, 0.8, 0.2), "#ffd60a", [0, 0.6, -ARENA_DEPTH / 2]);
    for (const x of [-ARENA_WIDTH / 2, ARENA_WIDTH / 2]) {
        addMesh(root, new THREE.BoxGeometry(0.2, 0.8, ARENA_DEPTH), "#ffd60a", [x, 0.6, 0]);
    }
    for (const x of [-(ARENA_WIDTH / 4 + 1), ARENA_WIDTH / 4 + 1]) {
        addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH / 2 - 2, 0.8, 0.2), "#ffd60a", [x, 0.6, ARENA_DEPTH / 2]);
    }

    const seat_anchors: THREE.Object3D[] = [];
    const cars: CarMotion[] = CAR_COLORS.map((color, index) => {
        const group = new THREE.Group();
        addMesh(group, new THREE.CylinderGeometry(1.05, 1.05, 0.35, 16), "#212529", [0, 0.45, 0]);
        addMesh(group, new THREE.BoxGeometry(1.5, 0.5, 1.8), color, [0, 0.8, 0]);
        addMesh(group, new THREE.BoxGeometry(1.2, 0.6, 0.2), color, [0, 1.2, -0.75]);
        // 천장 전기 막대 (차 뒤 끝 — 앉은 오리 머리와 겹치지 않게)
        addMesh(group, new THREE.CylinderGeometry(0.04, 0.04, ROOF_HEIGHT - 1.2, 6), "#adb5bd", [0, 1.2 + (ROOF_HEIGHT - 1.2) / 2, -1.05]);
        const anchor = new THREE.Object3D();
        anchor.position.set(0, 1.05, 0.05);
        group.add(anchor);
        seat_anchors.push(anchor);
        root.add(group);
        return {
            group,
            freq_x: 0.35 + index * 0.045,
            freq_z: 0.5 + ((index * 3) % 8) * 0.04,
            phase_x: index * 0.9,
            phase_z: index * 1.7,
        };
    });

    const range_x = ARENA_WIDTH / 2 - 1.6;
    const range_z = ARENA_DEPTH / 2 - 1.6;
    // 서버 물리 위치를 받기 시작하면 자체 경로(리사주) 대신 그 위치로 그림
    let is_network_driven = false;
    // 차별 충돌 반동 (시작 시각 ms, 세기, 기울어질 방향)
    const bumps = cars.map(() => ({ start: -Infinity, strength: 0, side: 1 }));

    // 부딪힌 차가 살짝 튀어 오르며 흔들림 (시각 효과만, 0.45초)
    function applyBumpEffects(): void {
        const now = performance.now();
        cars.forEach((car, index) => {
            const bump = bumps[index];
            const elapsed = (now - bump.start) / 1000;
            const amount = elapsed < BUMP_DURATION ? Math.sin((elapsed / BUMP_DURATION) * Math.PI) * Math.min(bump.strength / 6, 1) : 0;
            car.group.position.y = amount * 0.35;
            car.group.rotation.z = amount * 0.22 * bump.side;
            car.group.rotation.x = -amount * 0.12;
        });
    }

    const model: BumperCarModel = {
        id: RIDE_ID.BUMPER_CAR,
        root,
        seat_anchors,
        update(time) {
            if (is_network_driven) {
                return;
            }
            for (const car of cars) {
                const angle_x = car.freq_x * time + car.phase_x;
                const angle_z = car.freq_z * time + car.phase_z;
                car.group.position.set(Math.sin(angle_x) * range_x, 0, Math.sin(angle_z) * range_z);
                // 진행 방향 = 위치의 미분
                const velocity_x = Math.cos(angle_x) * car.freq_x * range_x;
                const velocity_z = Math.cos(angle_z) * car.freq_z * range_z;
                car.group.rotation.y = Math.atan2(velocity_x, velocity_z);
            }
            applyBumpEffects();
        },
        applyCarPoses(poses) {
            is_network_driven = true;
            poses.forEach((pose, index) => {
                const car = cars[index];
                if (car !== undefined) {
                    car.group.position.set(pose.x, 0, pose.z);
                    car.group.rotation.y = pose.heading;
                }
            });
            applyBumpEffects();
        },
        bump(index, strength) {
            if (bumps[index] !== undefined) {
                bumps[index] = { start: performance.now(), strength, side: Math.random() < 0.5 ? -1 : 1 };
            }
        },
    };
    return model;
}

const BUMP_DURATION = 0.45;

export interface BumperCarPose {
    x: number;
    z: number;
    heading: number;
}

export interface BumperCarModel extends RideModel {
    // 서버 물리 결과(범퍼카 로컬 좌표)로 차를 배치 — 매 프레임 기구 갱신 뒤 호출
    applyCarPoses(poses: readonly BumperCarPose[]): void;
    // 충돌 반동 연출
    bump(index: number, strength: number): void;
}

export function isBumperCarModel(model: RideModel | undefined): model is BumperCarModel {
    return model !== undefined && "applyCarPoses" in model;
}
