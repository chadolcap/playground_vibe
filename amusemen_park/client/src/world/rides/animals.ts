// 주토피아 기구용 동물·식물 장식 (기본 도형 조합) — 반환 그룹의 원점 = 발 아래 바닥
import * as THREE from "three";
import { addMesh } from "./common";

function addLegs(parent: THREE.Object3D, color: THREE.ColorRepresentation, spread_x: number, spread_z: number, height: number, thickness: number): void {
    for (const x of [-spread_x, spread_x]) {
        for (const z of [-spread_z, spread_z]) {
            addMesh(parent, new THREE.BoxGeometry(thickness, height, thickness), color, [x, height / 2, z]);
        }
    }
}

export function createLion(): THREE.Group {
    const group = new THREE.Group();
    addLegs(group, "#d4a24c", 0.5, 0.25, 0.6, 0.22);
    addMesh(group, new THREE.BoxGeometry(1.6, 0.8, 0.8), "#e0ac52", [0, 0.95, 0]);
    addMesh(group, new THREE.SphereGeometry(0.62, 12, 10), "#9c5a2a", [0.95, 1.35, 0]);
    addMesh(group, new THREE.SphereGeometry(0.42, 12, 10), "#e0ac52", [1.2, 1.35, 0]);
    addMesh(group, new THREE.CylinderGeometry(0.05, 0.05, 0.9, 6), "#e0ac52", [-1.1, 1.1, 0], [0, 0, 0.9]);
    return group;
}

export function createGiraffe(): { group: THREE.Group; neck: THREE.Group } {
    const group = new THREE.Group();
    addLegs(group, "#f4c95d", 0.55, 0.28, 2, 0.2);
    addMesh(group, new THREE.BoxGeometry(1.7, 0.95, 0.85), "#f4c95d", [0, 2.4, 0]);
    // 무늬
    for (const [x, z] of [[-0.4, 0.43], [0.35, 0.43], [0, -0.43]]) {
        addMesh(group, new THREE.BoxGeometry(0.35, 0.35, 0.02), "#a0522d", [x, 2.45, z]);
    }
    // 목은 흔들 수 있도록 따로 묶음
    const neck = new THREE.Group();
    neck.position.set(0.7, 2.7, 0);
    group.add(neck);
    addMesh(neck, new THREE.CylinderGeometry(0.17, 0.24, 2.6, 8), "#f4c95d", [0.35, 1.25, 0], [0, 0, -0.28]);
    addMesh(neck, new THREE.BoxGeometry(0.75, 0.38, 0.38), "#f4c95d", [0.85, 2.55, 0]);
    return { group, neck };
}

export function createElephant(): THREE.Group {
    const group = new THREE.Group();
    addLegs(group, "#8d99ae", 0.6, 0.38, 1.1, 0.42);
    const body = addMesh(group, new THREE.SphereGeometry(1, 14, 12), "#8d99ae", [0, 1.7, 0]);
    body.scale.set(1.35, 0.95, 0.95);
    addMesh(group, new THREE.SphereGeometry(0.62, 12, 10), "#8d99ae", [1.35, 2, 0]);
    addMesh(group, new THREE.CylinderGeometry(0.1, 0.18, 1.3, 8), "#8d99ae", [1.85, 1.3, 0], [0, 0, 0.25]);
    for (const z of [-0.6, 0.6]) {
        addMesh(group, new THREE.CylinderGeometry(0.55, 0.55, 0.06, 12), "#7d8597", [1.15, 2.05, z], [Math.PI / 2, 0, 0]);
    }
    return group;
}

// 물 위로 등과 머리만 보이는 하마
export function createHippo(): THREE.Group {
    const group = new THREE.Group();
    const back = addMesh(group, new THREE.SphereGeometry(1, 14, 10), "#9d8189", [0, 0, 0]);
    back.scale.set(1.5, 0.55, 0.9);
    addMesh(group, new THREE.SphereGeometry(0.6, 12, 10), "#9d8189", [1.4, 0.15, 0]);
    for (const z of [-0.25, 0.25]) {
        addMesh(group, new THREE.SphereGeometry(0.12, 8, 6), "#6d597a", [1.5, 0.55, z]);
    }
    return group;
}

export function createPanda(): { group: THREE.Group; head: THREE.Group } {
    const group = new THREE.Group();
    const body = addMesh(group, new THREE.SphereGeometry(0.8, 14, 12), "#f8f9fa", [0, 0.75, 0]);
    body.scale.set(1, 1.05, 0.9);
    // 검은 팔다리
    for (const [x, y, z] of [[0.45, 0.3, 0.45], [-0.45, 0.3, 0.45], [0.55, 0.95, 0.35], [-0.55, 0.95, 0.35]]) {
        addMesh(group, new THREE.SphereGeometry(0.28, 10, 8), "#212529", [x, y, z]);
    }
    const head = new THREE.Group();
    head.position.set(0, 1.65, 0.05);
    group.add(head);
    addMesh(head, new THREE.SphereGeometry(0.55, 14, 12), "#f8f9fa");
    for (const x of [-0.38, 0.38]) {
        addMesh(head, new THREE.SphereGeometry(0.18, 10, 8), "#212529", [x, 0.42, 0]);
        addMesh(head, new THREE.SphereGeometry(0.12, 10, 8), "#212529", [x * 0.5, 0.08, 0.45]);
    }
    addMesh(head, new THREE.SphereGeometry(0.08, 8, 6), "#212529", [0, -0.08, 0.53]);
    return { group, head };
}

export function createAcacia(): THREE.Group {
    const group = new THREE.Group();
    addMesh(group, new THREE.CylinderGeometry(0.18, 0.28, 3, 8), "#7f5539", [0, 1.5, 0]);
    const crown = addMesh(group, new THREE.SphereGeometry(1.8, 12, 8), "#6a994e", [0, 3.3, 0]);
    crown.scale.set(1, 0.35, 1);
    return group;
}

export function createPalm(): THREE.Group {
    const group = new THREE.Group();
    addMesh(group, new THREE.CylinderGeometry(0.15, 0.25, 4, 8), "#a47148", [0, 2, 0], [0, 0, 0.08]);
    for (let index = 0; index < 6; index += 1) {
        const angle = (index / 6) * Math.PI * 2;
        const leaf = addMesh(group, new THREE.ConeGeometry(0.35, 2.2, 6), "#52b788", [Math.cos(angle) * 0.9, 3.9, Math.sin(angle) * 0.9]);
        leaf.rotation.set(Math.sin(angle) * 1.2, 0, -Math.cos(angle) * 1.2);
    }
    return group;
}

// 바위를 부모에 붙임 (절반쯤 땅에 묻힌 모양)
export function addRock(parent: THREE.Object3D, size: number, x: number, z: number, color: THREE.ColorRepresentation = "#adb5bd"): THREE.Mesh {
    return addMesh(parent, new THREE.DodecahedronGeometry(size, 0), color, [x, size * 0.45, z], [x, z, 0]);
}
