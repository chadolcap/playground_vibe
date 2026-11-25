// 지형 — 잔디 바닥, 길(분수대 광장에서 각 기구 게이트로 + 안쪽·바깥쪽 순환길), 분수대, 매표소, 정문 아치
import * as THREE from "three";
import { MAP_HALF, MAP_SIZE, PARK_HUB, RIDES, RIDE_LIST, getRideGate, type RideId } from "@shared";
import { createSignBoard } from "./labels";
import { addMesh, getMaterial } from "./rides/common";

export interface PathSegment {
    ax: number;
    az: number;
    bx: number;
    bz: number;
    width: number;
}

// 분수대 광장 (모든 기구 길이 모이는 곳)
export const HUB_CENTER = PARK_HUB;
export const HUB_RADIUS = 9;
// 분수 수반 바깥 반지름과 물 반지름 — 오리 동상 부리에서 45° 로 쏜 물줄기가 물 안에 떨어지게 (duckFountain.ts 가 넘치면 경고)
export const FOUNTAIN_BASIN_RADIUS = 4.6;
export const FOUNTAIN_WATER_RADIUS = 4.2;

// 정문 아치 위치 (남쪽 끝, 스폰 지점 뒤) — 광장과 같은 x 에서 북쪽으로 들어옴
export const ENTRANCE_X = PARK_HUB.x;
const ENTRANCE_Z = MAP_HALF - 6;

// 매표소: 정문 큰길을 가운데 두고 양쪽 창구 + 길 위 차양 (중심·전체 폭·깊이)
export const TICKET_BOOTH = { x: ENTRANCE_X, z: 60, width: 22, depth: 8 } as const;

const PATH_WIDTH = 5;
const MAIN_ROAD_WIDTH = 7;
// 큰길이 바깥 순환길과 만나는 곳 (매표소 북쪽)
const MAIN_ROAD_END_Z = 54;
// 안쪽 순환길: 분수대를 감싸는 팔각형 (DUCK VOYAGE·CRAZY BUMP·회전목마 게이트 길과 만남)
const INNER_RING_RADIUS = 14;
const INNER_RING_SIDES = 8;
// 바깥 순환길: DUCK-X → DUCK FALL → DUCK TWIST → 매표소 → DUCK-X
// 기구 id 는 그 기구 게이트, 좌표는 기구 사이를 돌아가는 꺾임점 (모든 기구 영역에서 길 가장자리까지 1m 이상 떨어지게 잡음)
const OUTER_RING: readonly (RideId | readonly [number, number])[] = [
    RIDES.duck_x.id, [-14, -34], [-11, -57], [20, -58],
    RIDES.duck_fall.id, [60, -18], [60, 10],
    RIDES.duck_twist.id, [30, 50], [ENTRANCE_X, MAIN_ROAD_END_Z], [-14, 50], [-24, 36],
    RIDES.duck_x.id,
];

function toPoint(point: RideId | readonly [number, number]): { x: number; z: number } {
    return typeof point === "string" ? getRideGate(RIDES[point]) : { x: point[0], z: point[1] };
}

function addPolyline(segments: PathSegment[], points: readonly { x: number; z: number }[], width: number): void {
    for (let index = 0; index + 1 < points.length; index += 1) {
        segments.push({ ax: points[index].x, az: points[index].z, bx: points[index + 1].x, bz: points[index + 1].z, width });
    }
}

// 길 목록: 광장 → 각 기구 게이트 + 안쪽·바깥쪽 순환길(이웃한 기구를 차례로 이음) + 정문 → 바깥 순환길 큰길
// 바깥 순환길이 두르는 닫힌 다각형 (꺾임점 순서대로) — 안쪽 = 기구들이 있는 공원 안, 바깥 = 울타리까지의 외곽
export function getOuterRingPolygon(): { x: number; z: number }[] {
    return OUTER_RING.map(toPoint);
}

export function getPathSegments(): PathSegment[] {
    const segments: PathSegment[] = [];
    for (const ride of RIDE_LIST) {
        const gate = getRideGate(ride);
        segments.push({ ax: HUB_CENTER.x, az: HUB_CENTER.z, bx: gate.x, bz: gate.z, width: PATH_WIDTH });
    }
    const inner = Array.from({ length: INNER_RING_SIDES + 1 }, (_, index) => {
        const angle = (index / INNER_RING_SIDES) * Math.PI * 2;
        return { x: HUB_CENTER.x + Math.sin(angle) * INNER_RING_RADIUS, z: HUB_CENTER.z - Math.cos(angle) * INNER_RING_RADIUS };
    });
    addPolyline(segments, inner, PATH_WIDTH);
    addPolyline(segments, OUTER_RING.map(toPoint), PATH_WIDTH);
    segments.push({ ax: ENTRANCE_X, az: ENTRANCE_Z + 3, bx: ENTRANCE_X, bz: MAIN_ROAD_END_Z, width: MAIN_ROAD_WIDTH });
    return segments;
}

function addFlat(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string, x: number, y: number, z: number, rotation_y = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, getMaterial(color));
    // 바닥에 눕힘: 도형의 +y(위쪽)가 월드 -z 로 가도록 x축 -90° 회전
    mesh.rotation.set(-Math.PI / 2, 0, rotation_y);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

function createEntranceArch(): THREE.Group {
    const arch = new THREE.Group();
    for (const x of [-6, 6]) {
        addMesh(arch, new THREE.BoxGeometry(1.4, 7, 1.4), "#ffb4a2", [x, 3.5, 0]);
        addMesh(arch, new THREE.SphereGeometry(1.1, 20, 14), "#f6a6b2", [x, 7.6, 0]);
    }
    addMesh(arch, new THREE.BoxGeometry(13.4, 1.2, 1.2), "#e5989b", [0, 6.4, 0]);
    // 안쪽·바깥쪽 모두에서 보이도록 간판 두 장
    for (const direction of [1, -1]) {
        const sign = createSignBoard("🐥 오리 놀이동산", { height: 1.6, background: "#fff3c4", color: "#c1121f" });
        sign.position.set(0, 6.4, direction * 0.65);
        sign.rotation.y = direction === 1 ? 0 : Math.PI;
        arch.add(sign);
    }
    arch.position.set(ENTRANCE_X, 0, ENTRANCE_Z);
    return arch;
}

// 매표소 — 큰길 양쪽 창구 건물 + 길 위를 가로지르는 줄무늬 차양과 간판 (가운데로 걸어 지나감)
function createTicketBooth(): THREE.Group {
    const booth = new THREE.Group();
    const kiosk_width = (TICKET_BOOTH.width - MAIN_ROAD_WIDTH) / 2 - 0.5;
    const kiosk_depth = TICKET_BOOTH.depth - 2;
    const kiosk_x = MAIN_ROAD_WIDTH / 2 + 0.5 + kiosk_width / 2;
    for (const side of [-1, 1]) {
        const x = side * kiosk_x;
        addMesh(booth, new THREE.BoxGeometry(kiosk_width, 3, kiosk_depth), "#fff3e0", [x, 1.5, 0]);
        // 창구 유리와 받침 (정문 쪽·공원 쪽 모두)
        for (const z of [-1, 1]) {
            addMesh(booth, new THREE.BoxGeometry(kiosk_width - 1.6, 1.1, 0.1), "#90e0ef", [x, 1.9, z * (kiosk_depth / 2 + 0.03)]);
            addMesh(booth, new THREE.BoxGeometry(kiosk_width - 1.2, 0.12, 0.5), "#e5989b", [x, 1.25, z * (kiosk_depth / 2 + 0.25)]);
        }
    }
    // 지붕: 양쪽 건물과 큰길 위를 한 번에 덮는 줄무늬 차양 (기둥은 건물 벽이 대신함)
    const stripes = 8;
    const span = TICKET_BOOTH.width;
    for (let index = 0; index < stripes; index += 1) {
        const color = index % 2 === 0 ? "#f28482" : "#ffffff";
        addMesh(booth, new THREE.BoxGeometry(span / stripes, 0.3, kiosk_depth + 0.8), color, [-span / 2 + (index + 0.5) * (span / stripes), 3.2, 0]);
    }
    // 정문 쪽·공원 쪽 간판 두 장
    for (const direction of [1, -1]) {
        const sign = createSignBoard("🎟️ 매표소", { height: 1.1, background: "#fff3c4", color: "#c1121f" });
        sign.position.set(0, 4, direction * (kiosk_depth / 2 + 0.45));
        sign.rotation.y = direction === 1 ? 0 : Math.PI;
        booth.add(sign);
    }
    booth.position.set(TICKET_BOOTH.x, 0, TICKET_BOOTH.z);
    return booth;
}

export function createTerrain(): THREE.Group {
    const terrain = new THREE.Group();

    // 맵 바깥까지 이어지는 잔디
    addFlat(terrain, new THREE.PlaneGeometry(MAP_SIZE + 200, MAP_SIZE + 200), "#a9dc8e", 0, 0, 0);

    // 길
    for (const segment of getPathSegments()) {
        const length = Math.hypot(segment.bx - segment.ax, segment.bz - segment.az);
        const angle = Math.atan2(segment.bx - segment.ax, segment.bz - segment.az);
        addFlat(terrain, new THREE.PlaneGeometry(segment.width, length), "#fbf0d9", (segment.ax + segment.bx) / 2, 0.05, (segment.az + segment.bz) / 2, angle);
        // 길 끝 둥근 마감 (순환길 꺾이는 곳도 둥글게 이어짐)
        addFlat(terrain, new THREE.CircleGeometry(segment.width / 2, 20), "#fbf0d9", segment.bx, 0.051, segment.bz);
    }
    addFlat(terrain, new THREE.CircleGeometry(HUB_RADIUS, 40), "#fff6e3", HUB_CENTER.x, 0.06, HUB_CENTER.z);
    addFlat(terrain, new THREE.RingGeometry(HUB_RADIUS - 0.6, HUB_RADIUS, 40), "#f1cfa6", HUB_CENTER.x, 0.065, HUB_CENTER.z);

    // 광장 가운데 분수 (수반 + 물 + 가운데 기둥 — 기둥 위 오리 동상과 물줄기는 duckFountain.ts)
    const { x: hub_x, z: hub_z } = HUB_CENTER;
    addMesh(terrain, new THREE.CylinderGeometry(FOUNTAIN_BASIN_RADIUS, FOUNTAIN_BASIN_RADIUS + 0.3, 0.8, 32), "#d6ccc2", [hub_x, 0.4, hub_z]);
    addMesh(terrain, new THREE.CylinderGeometry(FOUNTAIN_WATER_RADIUS, FOUNTAIN_WATER_RADIUS, 0.82, 32), "#48cae4", [hub_x, 0.41, hub_z]);
    addMesh(terrain, new THREE.CylinderGeometry(0.4, 0.6, 2.2, 12), "#d6ccc2", [hub_x, 1.1, hub_z]);

    terrain.add(createEntranceArch(), createTicketBooth());
    return terrain;
}
