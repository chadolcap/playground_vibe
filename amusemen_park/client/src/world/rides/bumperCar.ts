// 범퍼카 — 지붕 있는 경기장 안을 1인승 차 8대가 돌아다님 (좌석 8)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import { addMesh, type RideModel } from "./common";

const ARENA_WIDTH = 18;
const ARENA_DEPTH = 14;
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

export function createBumperCar(): RideModel {
    const root = new THREE.Group();

    // 바닥·지붕·기둥
    addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH, 0.3, ARENA_DEPTH), "#4a4e69", [0, 0.15, 0]);
    addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH + 1, 0.3, ARENA_DEPTH + 1), "#c9184a", [0, ROOF_HEIGHT + 0.15, 0]);
    addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH - 0.5, 0.1, ARENA_DEPTH - 0.5), "#2b2d42", [0, ROOF_HEIGHT - 0.05, 0]);
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
        // 천장 전기 막대
        addMesh(group, new THREE.CylinderGeometry(0.04, 0.04, ROOF_HEIGHT - 1.2, 6), "#adb5bd", [0, 1.2 + (ROOF_HEIGHT - 1.2) / 2, -0.8]);
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

    return {
        id: RIDE_ID.BUMPER_CAR,
        root,
        seat_anchors,
        update(time) {
            for (const car of cars) {
                const angle_x = car.freq_x * time + car.phase_x;
                const angle_z = car.freq_z * time + car.phase_z;
                car.group.position.set(Math.sin(angle_x) * range_x, 0, Math.sin(angle_z) * range_z);
                // 진행 방향 = 위치의 미분
                const velocity_x = Math.cos(angle_x) * car.freq_x * range_x;
                const velocity_z = Math.cos(angle_z) * car.freq_z * range_z;
                car.group.rotation.y = Math.atan2(velocity_x, velocity_z);
            }
        },
    };
}
