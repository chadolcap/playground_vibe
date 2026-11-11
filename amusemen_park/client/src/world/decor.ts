// 장식 — 나무·꽃·가로등·맵 경계 울타리 (모두 인스턴싱: 종류별 그리기 호출 1~2회) + 구름
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { MAP_HALF, RIDE_LIST, SPAWN_POINT } from "@shared";
import { getMaterial } from "./rides/common";
import { HUB_CENTER, HUB_RADIUS, ZONE_SIGN_SPOTS, type PathSegment } from "./terrain";

// 기구 영역(footprint) 바깥으로 나무를 더 띄우는 여유
const RIDE_TREE_MARGIN = 1.5;

const TREE_ATTEMPTS = 1400;
const TREE_MAX = 280;
const FLOWER_ATTEMPTS = 2400;
const FLOWER_MAX = 900;
const CLOUD_COUNT = 12;
const LAMP_SPACING = 12;
const FENCE_POST_SPACING = 3;
// 정문 쪽 울타리 틈 (|x| < 이 값)
const ENTRANCE_GAP = 7;

// 매번 같은 배치가 나오는 난수 (mulberry32)
function createRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let value = state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
}

function distanceToSegment(x: number, z: number, segment: PathSegment): number {
    const dx = segment.bx - segment.ax;
    const dz = segment.bz - segment.az;
    const length_sq = dx * dx + dz * dz;
    const ratio = length_sq === 0 ? 0 : THREE.MathUtils.clamp(((x - segment.ax) * dx + (z - segment.az) * dz) / length_sq, 0, 1);
    return Math.hypot(x - (segment.ax + dx * ratio), z - (segment.az + dz * ratio));
}

function isTreeSpotFree(x: number, z: number, paths: readonly PathSegment[]): boolean {
    if (Math.abs(x) > MAP_HALF - 5 || Math.abs(z) > MAP_HALF - 5) {
        return false;
    }
    if (Math.hypot(x - HUB_CENTER.x, z - HUB_CENTER.z) < HUB_RADIUS + 4 || Math.hypot(x - SPAWN_POINT.x, z - SPAWN_POINT.z) < 14) {
        return false;
    }
    if (paths.some((segment) => distanceToSegment(x, z, segment) < segment.width / 2 + 2.5)) {
        return false;
    }
    if (RIDE_LIST.some((ride) => Math.hypot(x - ride.x, z - ride.z) < ride.footprint_radius + RIDE_TREE_MARGIN)) {
        return false;
    }
    return !Object.values(ZONE_SIGN_SPOTS).some((spot) => Math.hypot(x - spot.x, z - spot.z) < 5);
}

// 동글동글한 나뭇잎: 매끈한 구 4개를 뭉쳐 솜사탕처럼 (각진 다면체 대신)
function createFluffyCrown(): THREE.BufferGeometry {
    const puffs: [number, number, number, number][] = [[0, 0.15, 0, 1.25], [0.75, -0.2, 0.2, 0.85], [-0.7, -0.15, -0.15, 0.9], [0.1, -0.25, -0.75, 0.8]];
    const merged = mergeGeometries(puffs.map(([x, y, z, radius]) => new THREE.SphereGeometry(radius, 16, 12).translate(x, y, z)));
    return merged ?? new THREE.SphereGeometry(1.4, 16, 12);
}

// 길가·잔디밭의 작은 꽃 (인스턴싱)
function createFlowers(paths: readonly PathSegment[]): THREE.InstancedMesh {
    const random = createRandom(7788);
    const spots: { x: number; z: number }[] = [];
    for (let attempt = 0; attempt < FLOWER_ATTEMPTS && spots.length < FLOWER_MAX; attempt += 1) {
        // 절반은 길가에 줄지어, 절반은 잔디밭 아무 곳
        let x: number;
        let z: number;
        if (attempt % 2 === 0) {
            const segment = paths[Math.floor(random() * paths.length)];
            const along = random();
            const side = random() < 0.5 ? -1 : 1;
            const length = Math.hypot(segment.bx - segment.ax, segment.bz - segment.az);
            const offset = segment.width / 2 + 0.9 + random() * 1.6;
            x = segment.ax + (segment.bx - segment.ax) * along - ((segment.bz - segment.az) / length) * offset * side;
            z = segment.az + (segment.bz - segment.az) * along + ((segment.bx - segment.ax) / length) * offset * side;
        } else {
            x = (random() * 2 - 1) * (MAP_HALF - 5);
            z = (random() * 2 - 1) * (MAP_HALF - 5);
        }
        const blocked = Math.hypot(x - HUB_CENTER.x, z - HUB_CENTER.z) < HUB_RADIUS + 1
            || paths.some((segment) => distanceToSegment(x, z, segment) < segment.width / 2 + 0.6)
            || RIDE_LIST.some((ride) => Math.hypot(x - ride.x, z - ride.z) < ride.footprint_radius);
        if (!blocked) {
            spots.push({ x, z });
        }
    }
    const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 10, 6).scale(1, 0.75, 1), getMaterial("#ffffff"), spots.length);
    const colors = ["#ff9fb6", "#ffe066", "#ffffff", "#c9a7ff", "#ffb38a"].map((hex) => new THREE.Color(hex));
    const dummy = new THREE.Object3D();
    spots.forEach((spot, order) => {
        dummy.position.set(spot.x, 0.18, spot.z);
        dummy.scale.setScalar(0.8 + random() * 0.6);
        dummy.updateMatrix();
        flowers.setMatrixAt(order, dummy.matrix);
        flowers.setColorAt(order, colors[order % colors.length]);
    });
    return flowers;
}

export interface Clouds {
    group: THREE.Group;
    // 방 시각과 무관한 순수 장식 — 천천히 흘러감
    update(time: number): void;
}

// 하늘에 떠다니는 뭉게구름
export function createClouds(): Clouds {
    const random = createRandom(4242);
    const group = new THREE.Group();
    const material = getMaterial("#ffffff");
    const clouds: { mesh: THREE.Mesh; base_x: number; speed: number }[] = [];
    for (let index = 0; index < CLOUD_COUNT; index += 1) {
        const puffs = 3 + Math.floor(random() * 3);
        const parts: THREE.BufferGeometry[] = [];
        for (let part = 0; part < puffs; part += 1) {
            parts.push(new THREE.SphereGeometry(3 + random() * 2.5, 14, 10).translate(part * 4 - puffs * 2, random() * 1.5, random() * 3));
        }
        const geometry = mergeGeometries(parts) ?? new THREE.SphereGeometry(4, 14, 10);
        geometry.scale(1, 0.55, 1);
        const mesh = new THREE.Mesh(geometry, material);
        const base_x = (random() * 2 - 1) * MAP_HALF * 1.4;
        mesh.position.set(base_x, 55 + random() * 25, (random() * 2 - 1) * MAP_HALF * 1.4);
        group.add(mesh);
        clouds.push({ mesh, base_x, speed: 0.6 + random() * 0.8 });
    }
    const span = MAP_HALF * 2.8;
    return {
        group,
        update(time) {
            for (const cloud of clouds) {
                // 동쪽으로 흐르다 맵 반대편에서 다시 나타남
                cloud.mesh.position.x = ((cloud.base_x + time * cloud.speed + span / 2) % span + span) % span - span / 2;
            }
        },
    };
}

function createTrees(paths: readonly PathSegment[]): THREE.Group {
    const random = createRandom(20261111);
    const spots: { x: number; z: number; scale: number }[] = [];
    for (let attempt = 0; attempt < TREE_ATTEMPTS && spots.length < TREE_MAX; attempt += 1) {
        const x = (random() * 2 - 1) * MAP_HALF;
        const z = (random() * 2 - 1) * MAP_HALF;
        // 나무끼리 너무 붙지 않게
        if (isTreeSpotFree(x, z, paths) && spots.every((spot) => Math.hypot(spot.x - x, spot.z - z) > 3.2)) {
            spots.push({ x, z, scale: 0.8 + random() * 0.7 });
        }
    }
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.34, 1.8, 10), getMaterial("#b98a63"), spots.length);
    // 잎 색은 인스턴스마다 다르게 → 재질 색을 흰색으로 두고 인스턴스 색을 곱함
    const leaves = new THREE.InstancedMesh(createFluffyCrown(), getMaterial("#ffffff"), spots.length);
    // 파스텔 초록 + 가끔 분홍 꽃나무
    const leaf_colors = ["#8fd18a", "#a6dd93", "#7cc68a", "#b8e5a3", "#9bd5a8", "#f7c6d3", "#8fd18a"].map((hex) => new THREE.Color(hex));
    const dummy = new THREE.Object3D();
    spots.forEach((spot, order) => {
        dummy.position.set(spot.x, 0.9 * spot.scale, spot.z);
        dummy.rotation.set(0, spot.x * 7.1, 0);
        dummy.scale.setScalar(spot.scale);
        dummy.updateMatrix();
        trunks.setMatrixAt(order, dummy.matrix);
        dummy.position.y = 2.6 * spot.scale;
        dummy.updateMatrix();
        leaves.setMatrixAt(order, dummy.matrix);
        leaves.setColorAt(order, leaf_colors[order % leaf_colors.length]);
    });
    trunks.castShadow = true;
    leaves.castShadow = true;
    const group = new THREE.Group();
    group.add(trunks, leaves);
    return group;
}

// 길 양쪽에 번갈아 세우는 가로등
function createLamps(paths: readonly PathSegment[]): THREE.Group {
    const spots: { x: number; z: number }[] = [];
    for (const segment of paths) {
        const length = Math.hypot(segment.bx - segment.ax, segment.bz - segment.az);
        const dir_x = (segment.bx - segment.ax) / length;
        const dir_z = (segment.bz - segment.az) / length;
        const offset = segment.width / 2 + 0.8;
        // 광장 원 바깥부터 게이트 직전까지
        for (let distance = HUB_RADIUS + 4, side = 1; distance < length - 4; distance += LAMP_SPACING, side *= -1) {
            const along_x = segment.ax + dir_x * distance;
            const along_z = segment.az + dir_z * distance;
            const x = along_x - dir_z * offset * side;
            const z = along_z + dir_x * offset * side;
            if (Math.hypot(x - HUB_CENTER.x, z - HUB_CENTER.z) > HUB_RADIUS + 1) {
                spots.push({ x, z });
            }
        }
    }
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.14, 4, 6), getMaterial("#495057"), spots.length);
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 10, 8), getMaterial("#ffe8a3", 0.8), spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach((spot, order) => {
        dummy.position.set(spot.x, 2, spot.z);
        dummy.updateMatrix();
        posts.setMatrixAt(order, dummy.matrix);
        dummy.position.y = 4.15;
        dummy.updateMatrix();
        bulbs.setMatrixAt(order, dummy.matrix);
    });
    posts.castShadow = true;
    const group = new THREE.Group();
    group.add(posts, bulbs);
    return group;
}

// 맵 경계 울타리 (정문 쪽은 틈을 둠)
function createBoundaryFence(): THREE.Group {
    const edge = MAP_HALF - 1;
    const spots: { x: number; z: number }[] = [];
    for (let along = -edge; along <= edge; along += FENCE_POST_SPACING) {
        spots.push({ x: along, z: -edge }, { x: -edge, z: along }, { x: edge, z: along });
        if (Math.abs(along) > ENTRANCE_GAP) {
            spots.push({ x: along, z: edge });
        }
    }
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), getMaterial("#ffffff"), spots.length);
    const dummy = new THREE.Object3D();
    spots.forEach((spot, order) => {
        dummy.position.set(spot.x, 0.7, spot.z);
        dummy.updateMatrix();
        posts.setMatrixAt(order, dummy.matrix);
    });
    const group = new THREE.Group();
    group.add(posts);
    // 가로 난간 (남쪽은 정문 양옆으로 나눔)
    const rail_material = getMaterial("#ffffff");
    const rails: [number, number, number, number][] = [
        [0, -edge, edge * 2, 0.15], [-edge, 0, 0.15, edge * 2], [edge, 0, 0.15, edge * 2],
        [-(edge + ENTRANCE_GAP) / 2, edge, edge - ENTRANCE_GAP, 0.15], [(edge + ENTRANCE_GAP) / 2, edge, edge - ENTRANCE_GAP, 0.15],
    ];
    for (const [x, z, width, depth] of rails) {
        for (const y of [0.55, 1.15]) {
            const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, depth), rail_material);
            rail.position.set(x, y, z);
            group.add(rail);
        }
    }
    return group;
}

export function createDecor(paths: readonly PathSegment[]): THREE.Group {
    const decor = new THREE.Group();
    decor.add(createTrees(paths), createFlowers(paths), createLamps(paths), createBoundaryFence());
    return decor;
}
