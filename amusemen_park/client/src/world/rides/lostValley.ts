// 로스트밸리 — 땅과 연못을 오가는 수륙양용 차로 동물을 만나는 탐험 (좌석 8 = 2열 × 4줄)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import { addMesh, buildPathFrames, createCart, createEllipseCurve, createRibbon, placeOnPath, uAtConstantSpeed, type RideModel } from "./common";
import { addRock, createHippo, createPalm } from "./animals";

const AREA_RADIUS = 13;
const POND_CENTER_Z = -4.5;
const POND_RADIUS = 5.5;
const VEHICLE_SPEED = 2.8;

export function createLostValley(): RideModel {
    const root = new THREE.Group();

    addMesh(root, new THREE.CylinderGeometry(AREA_RADIUS, AREA_RADIUS, 0.08, 40), "#95d5b2", [0, 0.04, 0]);
    // 연못 (도로 뒤쪽 구간이 연못을 가로지름)
    addMesh(root, new THREE.CylinderGeometry(POND_RADIUS, POND_RADIUS, 0.1, 40), "#4cc9f0", [0, 0.1, POND_CENTER_Z]);

    const frames = buildPathFrames(createEllipseCurve(9, 7.5, 0.1), 200, true);
    root.add(createRibbon(frames, 2.8, "#a98467"));

    const hippo = createHippo();
    hippo.position.set(-1.5, 0.1, POND_CENTER_Z + 1);
    hippo.rotation.y = 0.8;
    root.add(hippo);
    for (const [x, z] of [[-6, 2], [5, 3.5], [10.8, -4], [-10.5, -5]]) {
        const palm = createPalm();
        palm.position.set(x, 0.08, z);
        root.add(palm);
    }
    addRock(root, 0.8, 2.5, 1.5, "#7f5539");
    addRock(root, 1.1, -3.5, -9.8, "#6c757d");

    // 수륙양용 차: 좌석 카트 + 바퀴 + 배 모양 앞부분
    const vehicle = createCart({ rows: 4, cols: 2, body_color: "#f77f00", seat_color: "#003049", row_pitch: 1 });
    for (const x of [-1.1, 1.1]) {
        for (const z of [-1.4, 1.4]) {
            addMesh(vehicle.group, new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), "#212529", [x, 0.2, z], [0, 0, Math.PI / 2]);
        }
    }
    addMesh(vehicle.group, new THREE.ConeGeometry(1, 1, 4), "#fcbf49", [0, 0.4, 2.6], [Math.PI / 2, Math.PI / 4, 0]);
    root.add(vehicle.group);

    return {
        id: RIDE_ID.LOST_VALLEY,
        root,
        seat_anchors: vehicle.anchors,
        update(time) {
            placeOnPath(vehicle.group, frames, uAtConstantSpeed(frames, VEHICLE_SPEED, time), 0.05);
            // 연못 안에서는 물에 잠겨 둥실둥실
            const in_pond = Math.hypot(vehicle.group.position.x, vehicle.group.position.z - POND_CENTER_Z) < POND_RADIUS - 0.5;
            if (in_pond) {
                vehicle.group.position.y -= 0.25 - Math.sin(time * 2.5) * 0.08;
                vehicle.group.rotateZ(Math.sin(time * 1.7) * 0.04);
            }
            hippo.position.y = 0.1 + Math.sin(time * 0.9) * 0.08;
        },
    };
}
