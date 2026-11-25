// 게임장 꾸밈 — 체크무늬 바닥·테두리, 뒤쪽 큰 아치 간판(전구 장식), 풍선 다발, 벤치, 화분
// 모든 좌표는 게임장 로컬 (+z = 게임기 정면 = 손님이 서는 쪽), arcade.ts 가 게임장 묶음에 붙임
import * as THREE from "three";
import { createBench } from "./decor";
import { createSignBoard } from "./labels";
import { addMesh, getMaterial, getToonGradient } from "./rides/common";

// 바닥 타원 반지름 (x: 게임기 줄 양 끝 너머, z: 뒤 아치 ~ 앞 벤치) 과 중심 z
const FLOOR_RADIUS_X = 8.2;
const FLOOR_RADIUS_Z = 5.6;
const FLOOR_CENTER_Z = 1.6;
// 뒤쪽 아치: 기둥 위치(±)·높이, 게임기 줄 뒤로 물러난 거리
const ARCH_HALF_WIDTH = 6.6;
const ARCH_HEIGHT = 5;
const ARCH_Z = -2.4;
const ARCH_SIGN_Y = 4.2;
// 전구 색 (무지개 순서로 돌아가며)
const BULB_COLORS = ["#ff5a4e", "#ffd166", "#7bc96f", "#5ec8ff", "#c7a8ff", "#ff8fab"] as const;
const BULB_RADIUS = 0.09;
const BALLOON_COLORS = ["#ff5a4e", "#ffd166", "#5ec8ff", "#ff8fab", "#7bc96f", "#c7a8ff"] as const;
// 앞쪽 벤치 (손님 자리 뒤에서 게임기를 바라봄 — rot_y π = −z 방향)
const BENCH_SPOTS = [
    { x: -3.6, z: 6.4, rot_y: Math.PI },
    { x: 3.6, z: 6.4, rot_y: Math.PI },
] as const;
// 화분 자리 (게임기 줄 양 끝 바깥 + 바닥 앞 모서리)
const PLANTER_SPOTS = [
    { x: -7.4, z: 0.2 },
    { x: 7.4, z: 0.2 },
    { x: -6.6, z: 4.6 },
    { x: 6.6, z: 4.6 },
] as const;
const PLANTER_SOLID_RADIUS = 0.5;

// 보라·흰 체크무늬 바닥 (한 칸 1m) + 분홍 테두리
function createCheckerFloor(): THREE.Group {
    const group = new THREE.Group();
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context !== null) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, 64, 64);
        context.fillStyle = "#e3d0ff";
        context.fillRect(0, 0, 32, 32);
        context.fillRect(32, 32, 32, 32);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.NearestFilter;
    // 원 도형 UV 는 지름 전체가 0~1 → 반복 수 = 반지름 (한 번 반복 = 2m = 2칸)
    texture.repeat.set(FLOOR_RADIUS_X, FLOOR_RADIUS_Z);
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(1, 64),
        new THREE.MeshToonMaterial({ map: texture, gradientMap: getToonGradient() }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.02, FLOOR_CENTER_Z);
    floor.scale.set(FLOOR_RADIUS_X, FLOOR_RADIUS_Z, 1);
    floor.receiveShadow = true;
    group.add(floor);

    const rim = new THREE.Mesh(new THREE.RingGeometry(0.965, 1, 64), getMaterial("#ff8fab"));
    rim.rotation.x = -Math.PI / 2;
    rim.position.set(0, 0.03, FLOOR_CENTER_Z);
    rim.scale.set(FLOOR_RADIUS_X, FLOOR_RADIUS_Z, 1);
    rim.receiveShadow = true;
    group.add(rim);
    return group;
}

// 전구 자리 모으기 → 한 번에 그리는 InstancedMesh (조명 영향 없이 밝은 색)
function createBulbs(points: readonly THREE.Vector3[]): THREE.InstancedMesh {
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(BULB_RADIUS, 10, 8), new THREE.MeshBasicMaterial(), points.length);
    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    points.forEach((point, index) => {
        bulbs.setMatrixAt(index, matrix.makeTranslation(point.x, point.y, point.z));
        bulbs.setColorAt(index, color.set(BULB_COLORS[index % BULB_COLORS.length]));
    });
    return bulbs;
}

// 뒤쪽 큰 아치: 기둥 두 개 + 가로대 + "🎮 게임장" 간판, 가로대·기둥 앞면에 무지개 전구
function createBackArch(): THREE.Group {
    const arch = new THREE.Group();
    const bulb_points: THREE.Vector3[] = [];
    for (const side of [-1, 1]) {
        const x = side * ARCH_HALF_WIDTH;
        addMesh(arch, new THREE.CylinderGeometry(0.24, 0.3, ARCH_HEIGHT, 12), "#ffb703", [x, ARCH_HEIGHT / 2, 0]);
        addMesh(arch, new THREE.CylinderGeometry(0.45, 0.5, 0.25, 14), "#fb8500", [x, 0.12, 0]);
        addMesh(arch, new THREE.SphereGeometry(0.42, 14, 12), "#fb8500", [x, ARCH_HEIGHT + 0.25, 0]);
        // 기둥 앞면 세로 전구
        for (let y = 0.6; y < ARCH_HEIGHT - 0.3; y += 0.45) {
            bulb_points.push(new THREE.Vector3(x, y, 0.3));
        }
    }
    addMesh(arch, new THREE.BoxGeometry(ARCH_HALF_WIDTH * 2 + 0.5, 0.36, 0.36), "#fb8500", [0, ARCH_HEIGHT - 0.1, 0]);
    // 가로대 앞면 가로 전구
    for (let x = -ARCH_HALF_WIDTH + 0.4; x <= ARCH_HALF_WIDTH - 0.4 + 1e-6; x += 0.5) {
        bulb_points.push(new THREE.Vector3(x, ARCH_HEIGHT - 0.1, 0.2));
    }
    arch.add(createBulbs(bulb_points));

    const sign = createSignBoard("🎮 게임장", { height: 1.3, background: "#fff3c4", color: "#ff8a1f" });
    sign.position.set(0, ARCH_SIGN_Y, 0.22);
    arch.add(sign);
    arch.position.z = ARCH_Z;
    return arch;
}

// 풍선 다발 (풍선 3개 + 끈) — 묶은 곳 기준
function createBalloons(seed: number): THREE.Group {
    const group = new THREE.Group();
    const offsets = [[-0.35, 1.5, 0], [0.32, 1.7, 0.1], [0, 2.05, -0.15]] as const;
    offsets.forEach(([x, y, z], index) => {
        const color = BALLOON_COLORS[(seed + index) % BALLOON_COLORS.length];
        const balloon = addMesh(group, new THREE.SphereGeometry(0.3, 16, 12), color, [x, y, z]);
        balloon.scale.set(1, 1.2, 1);
        addMesh(group, new THREE.ConeGeometry(0.06, 0.1, 8), color, [x, y - 0.38, z]);
        // 끈: 묶은 곳(원점)에서 풍선 아래까지
        const length = Math.hypot(x, y - 0.42, z);
        const string = addMesh(group, new THREE.CylinderGeometry(0.008, 0.008, length, 4), "#ffffff", [x / 2, (y - 0.42) / 2, z / 2]);
        string.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(x, y - 0.42, z).normalize());
    });
    return group;
}

// 둥근 화분 + 동글동글한 덤불
function createPlanter(spot: { x: number; z: number }, seed: number): THREE.Group {
    const planter = new THREE.Group();
    addMesh(planter, new THREE.CylinderGeometry(0.42, 0.32, 0.5, 16), "#ffffff", [0, 0.25, 0]);
    addMesh(planter, new THREE.CylinderGeometry(0.44, 0.44, 0.08, 16), "#c7a8ff", [0, 0.5, 0]);
    addMesh(planter, new THREE.SphereGeometry(0.42, 14, 12), "#7bc96f", [0, 0.82, 0]);
    addMesh(planter, new THREE.SphereGeometry(0.28, 12, 10), "#8fd47f", [0.2, 1.08, 0.1]);
    addMesh(planter, new THREE.SphereGeometry(0.08, 8, 6), BALLOON_COLORS[seed % BALLOON_COLORS.length], [-0.18, 1.05, 0.3]);
    addMesh(planter, new THREE.SphereGeometry(0.08, 8, 6), "#ffffff", [0.25, 0.9, 0.32]);
    planter.position.set(spot.x, 0, spot.z);
    planter.userData.solid_radius = PLANTER_SOLID_RADIUS;
    return planter;
}

export function createArcadeDecor(): THREE.Group {
    const decor = new THREE.Group();
    decor.add(createCheckerFloor());
    const arch = createBackArch();
    decor.add(arch);
    // 아치 기둥 옆에 풍선 다발 (기둥 바깥쪽 중간 높이에 묶음)
    for (const side of [-1, 1]) {
        const balloons = createBalloons(side === -1 ? 0 : 3);
        balloons.position.set(side * (ARCH_HALF_WIDTH + 0.3), 3.2, ARCH_Z);
        decor.add(balloons);
    }
    for (const spot of BENCH_SPOTS) {
        decor.add(createBench(spot));
    }
    PLANTER_SPOTS.forEach((spot, index) => decor.add(createPlanter(spot, index)));
    return decor;
}
