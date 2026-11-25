// 장식 — 나무(외곽)·꽃나무(공원 안)·꽃·가로등·맵 경계 울타리 (모두 인스턴싱: 종류별 그리기 호출 1~2회) + 벤치 + 구름
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { ARCADE, HEADBAND_SHOP, MAP_HALF, RIDE_LIST, SNACK_CARTS, SPAWN_POINT } from "@shared";
import { addMesh, getMaterial } from "./rides/common";
import { ENTRANCE_X, HUB_CENTER, HUB_RADIUS, TICKET_BOOTH, getOuterRingPolygon, type PathSegment } from "./terrain";

// 일부러 비운 나무 자리 (사용자가 지목한 나무) — 이 반경 안에는 나무를 심지 않음
const TREE_REMOVED_SPOTS: readonly { x: number; z: number }[] = [
    // 머리띠 판매점 앞 길목 (판매점으로 다가가는 시야를 가리던 나무)
    { x: 25.3, z: -16.5 },
];
// 비운 자리 근처에 다른 나무가 새로 끼어들지 않게 (나무 사이 최소 간격 3.2 보다 조금 작게)
const TREE_REMOVED_RADIUS = 3;
// 머리띠 판매점 주변 공터 — 판매점을 처음 놓았던 자리(33.8, −20.3) 기준 반경 8m 그대로 둠
// (판매점을 앞으로 옮긴 뒤에도 주변 나무 배치가 바뀌지 않게, 동남쪽 큰 나무(28.1, −14.0)는 남음)
const HEADBAND_CLEARING = { x: 33.8, z: -20.3, radius: 8 } as const;

// 벤치 자리 — rot_y: 앉은 사람이 바라보는 방향 (캐릭터와 같은 규칙: 0 = +z, 사용자가 캐릭터를 세워 정한 자리·방향)
const BENCHES: readonly { x: number; z: number; rot_y: number }[] = [
    // CRAZY BUMP와 DUCK FALL 사이 (2026-11-19 '11' 캐릭터가 서서 바라본 방향)
    { x: 40.12, z: -22.72, rot_y: 2.76 },
    // DUCK VOYAGE과 DUCK FALL 사이 (2026-11-19 '11' 캐릭터가 서서 바라본 방향)
    { x: 24.72, z: -33.08, rot_y: 0.879 },
    // DUCK-X 동쪽 앞 — 나란히 이어 붙인 벤치 2개 ('11' 캐릭터가 선 자리 (−14.13, −11.50)를 가운데로,
    // 벤치 길이 방향(로컬 +x = (cos, −sin))으로 ±0.95m — 벤치 길이 1.8m + 사이 0.1m)
    { x: -13.27, z: -11.11, rot_y: 5.853 },
    { x: -14.99, z: -11.89, rot_y: 5.853 },
    // DUCK-X 동쪽, 위 벤치 줄에서 북쪽으로 약 12m — 나란히 이어 붙인 벤치 2개 ('11' 캐릭터가 선 자리 (−12.45, 0.79)를 가운데로)
    { x: -13.40, z: 0.84, rot_y: 3.192 },
    { x: -11.50, z: 0.74, rot_y: 3.192 },
];
// 벤치 크기 (m) — 좌석 높이는 캐릭터가 앉기 알맞게
const BENCH_WIDTH = 1.8;
const BENCH_SEAT_Y = 0.45;
const BENCH_DEPTH = 0.5;
// 캐릭터가 벤치를 뚫고 지나가지 않게 막는 원 반지름 (벤치 양 끝까지)
const BENCH_SOLID_RADIUS = 0.95;

// 기구 영역(footprint) 바깥으로 나무를 더 띄우는 여유
const RIDE_TREE_MARGIN = 1.5;

// 공원 안(바깥 순환길 안쪽) 꽃나무 — 키 작은 동그란 덤불 위에 꽃송이 (기구 사이 시야를 가리지 않게)
const SHRUB_FLOWERS = 7;
const SHRUB_FLOWER_COLORS = ["#ff9fb6", "#ffffff", "#ffe066", "#c9a7ff", "#ffb38a", "#ff8fab"];

const TREE_ATTEMPTS = 1400;
const TREE_MAX = 280;
const FLOWER_ATTEMPTS = 2400;
const FLOWER_MAX = 900;
const CLOUD_COUNT = 12;
const LAMP_SPACING = 12;
const FENCE_POST_SPACING = 3;
// 정문 쪽 울타리 틈 (|x - ENTRANCE_X| < 이 값)
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

// 게임장(게임기 줄 + 손님 자리 + 아치·벤치 장식)을 가리지 않게 비우는 반경
const ARCADE_CLEARING_RADIUS = 10;

function isInArcadeClearing(x: number, z: number): boolean {
    return Math.hypot(x - ARCADE.x, z - ARCADE.z) < ARCADE_CLEARING_RADIUS;
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
    // 간식 수레(솜사탕·츄러스)와 손님이 서는 자리를 비움
    if (Object.values(SNACK_CARTS).some(({ cart }) => Math.hypot(x - cart.x, z - cart.z) < 6)) {
        return false;
    }
    // 머리띠 판매점 주변은 나무 없이 트인 공터로
    if (Math.hypot(x - HEADBAND_CLEARING.x, z - HEADBAND_CLEARING.z) < HEADBAND_CLEARING.radius) {
        return false;
    }
    if (TREE_REMOVED_SPOTS.some((spot) => Math.hypot(x - spot.x, z - spot.z) < TREE_REMOVED_RADIUS)) {
        return false;
    }
    // 매표소 건물·차양을 가리지 않게
    return Math.abs(x - TICKET_BOOTH.x) > TICKET_BOOTH.width / 2 + 3 || Math.abs(z - TICKET_BOOTH.z) > TICKET_BOOTH.depth / 2 + 3;
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
            || RIDE_LIST.some((ride) => Math.hypot(x - ride.x, z - ride.z) < ride.footprint_radius)
            || Object.values(SNACK_CARTS).some(({ cart }) => Math.hypot(x - cart.x, z - cart.z) < 2.2)
            || Math.hypot(x - HEADBAND_SHOP.x, z - HEADBAND_SHOP.z) < 2.6
            || isInArcadeClearing(x, z);
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
    // 꽃은 밟고 지나감 (캐릭터가 꽃 위에 올라서지 않게 — groundMap 참고)
    flowers.userData.walk_through = true;
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

// 점이 다각형 안에 있는지 (가로 반직선이 변을 몇 번 가로지르는지)
function isInsidePolygon(x: number, z: number, polygon: readonly { x: number; z: number }[]): boolean {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
        const a = polygon[index];
        const b = polygon[previous];
        if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) {
            inside = !inside;
        }
    }
    return inside;
}

type TreeSpot = { x: number; z: number; scale: number };

// 나무 자리 (매번 같은 배치) — 바깥 순환길 바깥(외곽)은 큰 나무, 안쪽(기구 사이 잔디)은 키 작은 꽃나무
function createTreeSpots(paths: readonly PathSegment[]): { outer: TreeSpot[]; inner: TreeSpot[] } {
    const random = createRandom(20261111);
    const spots: TreeSpot[] = [];
    for (let attempt = 0; attempt < TREE_ATTEMPTS && spots.length < TREE_MAX; attempt += 1) {
        const x = (random() * 2 - 1) * MAP_HALF;
        const z = (random() * 2 - 1) * MAP_HALF;
        // 나무끼리 너무 붙지 않게
        if (isTreeSpotFree(x, z, paths) && spots.every((spot) => Math.hypot(spot.x - x, spot.z - z) > 3.2)) {
            spots.push({ x, z, scale: 0.8 + random() * 0.7 });
        }
    }
    // 게임장 자리는 나중에 비움 (생성 순서를 바꾸지 않아 다른 나무 배치는 그대로)
    const kept = spots.filter((spot) => !isInArcadeClearing(spot.x, spot.z));
    const ring = getOuterRingPolygon();
    return {
        outer: kept.filter((spot) => !isInsidePolygon(spot.x, spot.z, ring)),
        inner: kept.filter((spot) => isInsidePolygon(spot.x, spot.z, ring)),
    };
}

// 키 작은 꽃나무: 동글동글한 초록 덤불(키 약 1m) + 덤불 윗면에 한 가지 색 꽃송이
function createFlowerShrubs(spots: readonly TreeSpot[]): THREE.Group {
    const random = createRandom(5150);
    const bushes = new THREE.InstancedMesh(createFluffyCrown(), getMaterial("#ffffff"), spots.length);
    const flowers = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 6), getMaterial("#ffffff"), spots.length * SHRUB_FLOWERS);
    const bush_colors = ["#7cc68a", "#8fd18a", "#6fbf7f", "#9bd5a8"].map((hex) => new THREE.Color(hex));
    const flower_colors = SHRUB_FLOWER_COLORS.map((hex) => new THREE.Color(hex));
    const dummy = new THREE.Object3D();
    spots.forEach((spot, order) => {
        // 덤불: 나무 잎 모양을 납작하고 작게 (가로 반지름 약 0.6~0.9m, 키 약 0.8~1.2m)
        const size = 0.45 + (spot.scale - 0.8) * 0.25;
        dummy.position.set(spot.x, 0.5 * size / 0.45, spot.z);
        dummy.rotation.set(0, spot.x * 7.1, 0);
        dummy.scale.set(size, size * 0.85, size);
        dummy.updateMatrix();
        bushes.setMatrixAt(order, dummy.matrix);
        bushes.setColorAt(order, bush_colors[order % bush_colors.length]);
        // 꽃송이: 덤불 윗면 둘레에 흩어 심음 (덤불마다 한 가지 색)
        const color = flower_colors[order % flower_colors.length];
        for (let index = 0; index < SHRUB_FLOWERS; index += 1) {
            const angle = (index / SHRUB_FLOWERS) * Math.PI * 2 + random() * 0.6;
            const reach = 0.25 + random() * 0.35;
            dummy.position.set(spot.x + Math.cos(angle) * reach * size / 0.45, (0.95 + random() * 0.15) * size / 0.45, spot.z + Math.sin(angle) * reach * size / 0.45);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(0.8 + random() * 0.5);
            dummy.updateMatrix();
            flowers.setMatrixAt(order * SHRUB_FLOWERS + index, dummy.matrix);
            flowers.setColorAt(order * SHRUB_FLOWERS + index, color);
        }
    });
    bushes.castShadow = true;
    // 키가 1m 안팎이라 지면 측정(groundMap)이 윗면을 바닥으로 잡지 않게 — 캐릭터는 덤불을 지나감 (바닥 꽃과 같음)
    bushes.userData.walk_through = true;
    flowers.userData.walk_through = true;
    const group = new THREE.Group();
    group.add(bushes, flowers);
    return group;
}

function createTrees(spots: readonly TreeSpot[]): THREE.Group {
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

// 나무 벤치: 다리 4개 + 앉는 판 3줄 + 등받이 2줄 + 팔걸이 (로컬 +z = 앉은 사람이 바라보는 쪽, 등받이는 뒤 −z)
export function createBench(spot: { x: number; z: number; rot_y: number }): THREE.Group {
    const bench = new THREE.Group();
    const wood = "#c98b5a";
    const metal = "#5c677d";
    for (const side of [-1, 1]) {
        const x = side * (BENCH_WIDTH / 2 - 0.12);
        // 앞다리·뒷다리 (뒷다리는 등받이까지 이어짐) + 팔걸이
        addMesh(bench, new THREE.BoxGeometry(0.08, BENCH_SEAT_Y, 0.08), metal, [x, BENCH_SEAT_Y / 2, BENCH_DEPTH / 2 - 0.06]);
        addMesh(bench, new THREE.BoxGeometry(0.08, 0.95, 0.08), metal, [x, 0.475, -BENCH_DEPTH / 2 + 0.06], [-0.12, 0, 0]);
        addMesh(bench, new THREE.BoxGeometry(0.08, 0.06, BENCH_DEPTH), metal, [x + side * 0.04, BENCH_SEAT_Y + 0.22, 0]);
    }
    // 앉는 판 3줄
    for (let index = 0; index < 3; index += 1) {
        const z = -BENCH_DEPTH / 2 + 0.09 + index * ((BENCH_DEPTH - 0.18) / 2);
        addMesh(bench, new THREE.BoxGeometry(BENCH_WIDTH, 0.05, 0.13), wood, [0, BENCH_SEAT_Y, z]);
    }
    // 등받이 2줄 (살짝 뒤로 기움)
    for (const y of [0.68, 0.86]) {
        addMesh(bench, new THREE.BoxGeometry(BENCH_WIDTH, 0.12, 0.04), wood, [0, y, -BENCH_DEPTH / 2 + 0.02 - (y - BENCH_SEAT_Y) * 0.12], [-0.12, 0, 0]);
    }
    bench.position.set(spot.x, 0, spot.z);
    bench.rotation.y = spot.rot_y;
    // 캐릭터가 벤치를 뚫고 지나가지 않게 원으로 막음 (groundMap·navGrid)
    bench.userData.solid_radius = BENCH_SOLID_RADIUS;
    return bench;
}

// 맵 경계 울타리 (정문 쪽은 틈을 둠)
function createBoundaryFence(): THREE.Group {
    const edge = MAP_HALF - 1;
    const spots: { x: number; z: number }[] = [];
    for (let along = -edge; along <= edge; along += FENCE_POST_SPACING) {
        spots.push({ x: along, z: -edge }, { x: -edge, z: along }, { x: edge, z: along });
        if (Math.abs(along - ENTRANCE_X) > ENTRANCE_GAP) {
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
        [(-edge + ENTRANCE_X - ENTRANCE_GAP) / 2, edge, edge + ENTRANCE_X - ENTRANCE_GAP, 0.15],
        [(edge + ENTRANCE_X + ENTRANCE_GAP) / 2, edge, edge - ENTRANCE_X - ENTRANCE_GAP, 0.15],
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
    const tree_spots = createTreeSpots(paths);
    decor.add(...BENCHES.map(createBench));
    decor.add(createTrees(tree_spots.outer), createFlowerShrubs(tree_spots.inner), createFlowers(paths), createLamps(paths), createBoundaryFence());
    return decor;
}
