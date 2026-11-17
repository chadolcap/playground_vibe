// 렛츠 트위스트 — 큰 팔이 앞뒤로 크게 흔들리고 끝의 좌석 원판이 회전하는 기구 (좌석 8)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import { addMesh, createThrill, type RideModel } from "./common";
import { createPendulumProgram } from "./ridePhysics";

const SEAT_COUNT = 8;
const AXLE_HEIGHT = 9.6;
const ARM_LENGTH = 7.4;
const WHEEL_RADIUS = 2.4;

export function createLetsTwist(): RideModel {
    const root = new THREE.Group();

    // 바닥 원판
    addMesh(root, new THREE.CylinderGeometry(7.5, 7.8, 0.6, 32), "#6c63ff", [0, 0.3, 0]);
    addMesh(root, new THREE.CylinderGeometry(6.2, 6.2, 0.62, 32), "#fefae0", [0, 0.31, 0]);

    // 양쪽 A자 기둥
    for (const x of [-3.3, 3.3]) {
        for (const z of [-1.6, 1.6]) {
            addMesh(root, new THREE.BoxGeometry(0.5, AXLE_HEIGHT + 0.4, 0.5), "#ffc300", [x, AXLE_HEIGHT / 2, z * 0.55], [z > 0 ? -0.17 : 0.17, 0, 0]);
        }
    }
    // 회전축
    addMesh(root, new THREE.CylinderGeometry(0.35, 0.35, 7.4, 12), "#adb5bd", [0, AXLE_HEIGHT, 0], [0, 0, Math.PI / 2]);

    // 흔들리는 팔 (축 기준으로 x축 회전)
    const arm_pivot = new THREE.Group();
    arm_pivot.position.set(0, AXLE_HEIGHT, 0);
    root.add(arm_pivot);
    addMesh(arm_pivot, new THREE.BoxGeometry(0.8, ARM_LENGTH, 0.8), "#ff006e", [0, -ARM_LENGTH / 2, 0]);
    // 반대편 균형추
    addMesh(arm_pivot, new THREE.BoxGeometry(1.8, 1.8, 1.8), "#ffbe0b", [0, 2.1, 0]);
    addMesh(arm_pivot, new THREE.BoxGeometry(0.6, 2, 0.6), "#ff006e", [0, 1, 0]);

    // 팔 끝 좌석 원판 (팔 방향을 축으로 회전)
    const wheel = new THREE.Group();
    wheel.position.set(0, -ARM_LENGTH - 0.2, 0);
    arm_pivot.add(wheel);
    addMesh(wheel, new THREE.CylinderGeometry(WHEEL_RADIUS + 0.4, WHEEL_RADIUS + 0.4, 0.3, 24), "#3a86ff");

    const seat_anchors: THREE.Object3D[] = [];
    for (let index = 0; index < SEAT_COUNT; index += 1) {
        const angle = (index / SEAT_COUNT) * Math.PI * 2;
        const seat = new THREE.Group();
        seat.position.set(Math.cos(angle) * WHEEL_RADIUS, 0.15, Math.sin(angle) * WHEEL_RADIUS);
        // 좌석 정면(+z)이 원판 바깥을 향하도록
        seat.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
        wheel.add(seat);
        addMesh(seat, new THREE.BoxGeometry(0.8, 0.2, 0.7), "#fb5607", [0, 0.1, 0]);
        addMesh(seat, new THREE.BoxGeometry(0.8, 0.7, 0.12), "#fb5607", [0, 0.45, -0.32]);
        const anchor = new THREE.Object3D();
        anchor.position.set(0, 0.25, 0);
        seat.add(anchor);
        seat_anchors.push(anchor);
    }

    // 운행 사이클: 승하차(정지) → 모터가 박자 맞춰 밀어 진폭을 키움 → 최고 120° 까지 휘두름 → 서서히 줄여 정지
    // 흔들림 주기는 팔 길이로 정해지는 진자 주기(√(L/g))를 따름 — 꼭대기에서 멈칫하는 순간 거꾸로 매달린 무중력감
    const program = createPendulumProgram({
        arm_length: ARM_LENGTH + 0.2,
        max_angle: THREE.MathUtils.degToRad(120),
        load_seconds: 8,
        pump_seconds: 18,
        peak_seconds: 14,
        decay_seconds: 12,
        wheel_spin: 1.6,
    });
    const thrill = createThrill();

    return {
        id: RIDE_ID.LETS_TWIST,
        root,
        seat_anchors,
        thrill,
        update(time) {
            arm_pivot.rotation.x = program.angleAt(time);
            wheel.rotation.y = program.wheelAngleAt(time);
            program.thrillAt(time, thrill);
        },
    };
}
