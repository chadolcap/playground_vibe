// 판다월드 — 대나무 숲을 작은 관람 열차가 천천히 도는 곳 (좌석 6 = 객차 3칸 × 2석)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import {
    addMesh,
    buildPathFrames,
    createCart,
    createEllipseCurve,
    createRails,
    getMaterial,
    placeOnPath,
    placeTrain,
    uAtConstantSpeed,
    type RideModel,
} from "./common";
import { createPanda } from "./animals";

const AREA_RADIUS = 12;
const TRAIN_SPEED = 2.4;
const CAR_COUNT = 3;
const CAR_GAP = 2.3;
const ENGINE_GAP = 2.6;

// 안쪽 대나무 숲 (인스턴싱, 같은 배치가 나오도록 고정 순서로 생성)
function createBamboo(): THREE.InstancedMesh {
    const spots: [number, number, number][] = [];
    for (let index = 0; index < 46; index += 1) {
        const angle = index * 2.399;
        const radius = 2.2 + ((index * 37) % 31) / 10;
        const height = 3.5 + ((index * 53) % 25) / 10;
        spots.push([Math.cos(angle) * radius, height, Math.sin(angle) * radius * 0.8]);
    }
    const bamboo = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.14, 1, 6), getMaterial("#70a83b"), spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach(([x, height, z], order) => {
        dummy.position.set(x, height / 2, z);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        bamboo.setMatrixAt(order, dummy.matrix);
    });
    bamboo.castShadow = true;
    return bamboo;
}

export function createPandaWorld(): RideModel {
    const root = new THREE.Group();

    addMesh(root, new THREE.CylinderGeometry(AREA_RADIUS, AREA_RADIUS, 0.08, 40), "#b7e4c7", [0, 0.04, 0]);
    root.add(createBamboo());

    // 판다 집
    addMesh(root, new THREE.BoxGeometry(3, 2, 2.4), "#e76f51", [0, 1, -1]);
    addMesh(root, new THREE.ConeGeometry(2.4, 1.4, 4), "#264653", [0, 2.7, -1], [0, Math.PI / 4, 0]);

    const pandas = [[-2, 1.8, 0.5], [2.2, 2.5, -0.6], [0.5, 2, -0.2]].map(([x, z, turn]) => {
        const panda = createPanda();
        panda.group.position.set(x, 0.08, z);
        panda.group.rotation.y = turn;
        root.add(panda.group);
        return panda;
    });

    const frames = buildPathFrames(createEllipseCurve(9, 7.5, 0.15), 200, true);
    root.add(createRails(frames, { gauge: 1, radius: 0.06, color: "#6c757d", tie_every: 3, tie_color: "#7f5539" }));

    // 기관차
    const engine = new THREE.Group();
    addMesh(engine, new THREE.BoxGeometry(1.4, 0.6, 2.2), "#d62828", [0, 0.4, 0]);
    addMesh(engine, new THREE.CylinderGeometry(0.5, 0.5, 1.4, 12), "#212529", [0, 1, 0.3], [Math.PI / 2, 0, 0]);
    addMesh(engine, new THREE.BoxGeometry(1.3, 1.2, 0.8), "#d62828", [0, 1.1, -0.6]);
    addMesh(engine, new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8), "#212529", [0, 1.6, 0.8]);
    root.add(engine);

    // 객차 3칸 × 좌석 2 (나란히)
    const cars: THREE.Object3D[] = [];
    const seat_anchors: THREE.Object3D[] = [];
    for (let order = 0; order < CAR_COUNT; order += 1) {
        const cart = createCart({ rows: 1, cols: 2, body_color: order % 2 === 0 ? "#2a9d8f" : "#e9c46a" });
        cars.push(cart.group);
        seat_anchors.push(...cart.anchors);
        root.add(cart.group);
    }

    return {
        id: RIDE_ID.PANDA_WORLD,
        root,
        seat_anchors,
        update(time) {
            const engine_u = uAtConstantSpeed(frames, TRAIN_SPEED, time);
            placeOnPath(engine, frames, engine_u, 0.1);
            placeTrain(cars, frames, engine_u - ENGINE_GAP / frames.length, CAR_GAP, 0.1);
            pandas.forEach((panda, index) => {
                // 대나무를 먹으며 고개를 끄덕끄덕
                panda.head.rotation.x = Math.sin(time * 2 + index) * 0.15;
            });
        },
    };
}
