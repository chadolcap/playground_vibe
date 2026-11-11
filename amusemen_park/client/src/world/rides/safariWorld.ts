// 사파리월드 — 울타리 친 초원을 지붕 없는 사파리 버스가 한 바퀴 도는 탐험 (좌석 10 = 2열 × 5줄)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import { addMesh, buildPathFrames, createCart, createEllipseCurve, createRibbon, getMaterial, placeOnPath, uAtConstantSpeed, type RideModel } from "./common";
import { addRock, createAcacia, createElephant, createGiraffe, createLion } from "./animals";

const AREA_RADIUS = 13;
const BUS_SPEED = 3;

// 원형 울타리 (정면 +z 쪽은 출입구로 비워 둠)
function createRingFence(radius: number, gap_angle: number): THREE.InstancedMesh {
    const angles: number[] = [];
    for (let angle = 0; angle < Math.PI * 2; angle += 0.12) {
        // +z 방향(angle = π/2) 근처는 출입구
        if (Math.abs(angle - Math.PI / 2) > gap_angle) {
            angles.push(angle);
        }
    }
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 1.4, 0.2), getMaterial("#7f5539"), angles.length);
    const dummy = new THREE.Object3D();
    angles.forEach((angle, order) => {
        dummy.position.set(Math.cos(angle) * radius, 0.7, Math.sin(angle) * radius);
        dummy.updateMatrix();
        posts.setMatrixAt(order, dummy.matrix);
    });
    posts.castShadow = true;
    return posts;
}

export function createSafariWorld(): RideModel {
    const root = new THREE.Group();

    addMesh(root, new THREE.CylinderGeometry(AREA_RADIUS, AREA_RADIUS, 0.08, 40), "#e9c46a", [0, 0.04, 0]);
    root.add(createRingFence(AREA_RADIUS - 0.3, 0.22));

    const frames = buildPathFrames(createEllipseCurve(9.5, 8, 0.1), 200, true);
    root.add(createRibbon(frames, 3, "#bc8a5f"));

    // 동물·나무·바위 (도로 안쪽)
    const lion = createLion();
    lion.position.set(-3, 0.08, -2);
    lion.rotation.y = 0.6;
    const giraffe = createGiraffe();
    giraffe.group.position.set(3, 0.08, -3.5);
    giraffe.group.rotation.y = 2.4;
    const elephant = createElephant();
    elephant.position.set(-1.5, 0.08, 3);
    elephant.rotation.y = -0.4;
    const acacia = createAcacia();
    acacia.position.set(2.5, 0.08, 2);
    root.add(lion, giraffe.group, elephant, acacia);
    addRock(root, 0.9, 0.5, -0.5, "#b08968");
    addRock(root, 0.6, -4.5, 0.5, "#b08968");

    // 사파리 버스: 좌석 카트 + 얼룩말 무늬 옆판
    const bus = createCart({ rows: 5, cols: 2, body_color: "#386641", seat_color: "#f2e8cf", row_pitch: 1 });
    for (const x of [-1.15, 1.15]) {
        addMesh(bus.group, new THREE.BoxGeometry(0.1, 0.7, 5.4), "#f8f9fa", [x, 0.85, 0]);
        for (const z of [-2, -0.8, 0.4, 1.6]) {
            addMesh(bus.group, new THREE.BoxGeometry(0.12, 0.7, 0.3), "#212529", [x, 0.85, z]);
        }
    }
    addMesh(bus.group, new THREE.BoxGeometry(2.3, 1.1, 0.8), "#386641", [0, 0.9, 3.1]);
    root.add(bus.group);

    return {
        id: RIDE_ID.SAFARI_WORLD,
        root,
        seat_anchors: bus.anchors,
        update(time) {
            placeOnPath(bus.group, frames, uAtConstantSpeed(frames, BUS_SPEED, time), 0.05);
            giraffe.neck.rotation.z = Math.sin(time * 0.8) * 0.12;
        },
    };
}
