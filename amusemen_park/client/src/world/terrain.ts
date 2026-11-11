// 지형 — 잔디 바닥, 구역별 바닥색, 길(중앙 광장에서 각 기구 게이트로), 구역 표지판, 정문 아치
import * as THREE from "three";
import { MAP_HALF, MAP_SIZE, RIDE_LIST, ZONES, getRideGate, type ZoneId } from "@shared";
import { createSignBoard } from "./labels";
import { addMesh, getMaterial } from "./rides/common";

export interface PathSegment {
    ax: number;
    az: number;
    bx: number;
    bz: number;
    width: number;
}

// 중앙 광장 (모든 길이 모이는 곳)
export const HUB_CENTER = { x: 0, z: 0 } as const;
export const HUB_RADIUS = 9;

// 정문 아치 위치 (남쪽 끝, 스폰 지점 뒤)
const ENTRANCE_Z = MAP_HALF - 6;

const ZONE_COLORS: Record<ZoneId, string> = {
    global_fair: "#f7e9cb",
    american_adventure: "#f6d9b0",
    magic_land: "#e6daf6",
    european_adventure: "#cdeab4",
    zootopia: "#dcefb6",
};

// 구역 표지판 위치 (길과 기구를 피한 자리)
export const ZONE_SIGN_SPOTS: Record<ZoneId, { x: number; z: number }> = {
    global_fair: { x: 9, z: 90 },
    american_adventure: { x: 22, z: 6 },
    magic_land: { x: 25, z: -50 },
    european_adventure: { x: -25, z: -50 },
    zootopia: { x: -24, z: -8 },
};

// 길 목록: 정문 → 광장 큰길 + 광장 → 각 기구 게이트
export function getPathSegments(): PathSegment[] {
    const segments: PathSegment[] = [{ ax: 0, az: ENTRANCE_Z + 3, bx: HUB_CENTER.x, bz: HUB_CENTER.z, width: 7 }];
    for (const ride of RIDE_LIST) {
        const gate = getRideGate(ride);
        segments.push({ ax: HUB_CENTER.x, az: HUB_CENTER.z, bx: gate.x, bz: gate.z, width: 5 });
    }
    return segments;
}

// 모서리가 둥근 직사각형 바닥
function createRoundedRect(width: number, depth: number, radius: number): THREE.ShapeGeometry {
    const half_w = width / 2;
    const half_d = depth / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-half_w + radius, -half_d);
    shape.lineTo(half_w - radius, -half_d);
    shape.quadraticCurveTo(half_w, -half_d, half_w, -half_d + radius);
    shape.lineTo(half_w, half_d - radius);
    shape.quadraticCurveTo(half_w, half_d, half_w - radius, half_d);
    shape.lineTo(-half_w + radius, half_d);
    shape.quadraticCurveTo(-half_w, half_d, -half_w, half_d - radius);
    shape.lineTo(-half_w, -half_d + radius);
    shape.quadraticCurveTo(-half_w, -half_d, -half_w + radius, -half_d);
    return new THREE.ShapeGeometry(shape, 6);
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

function createSignPost(text: string, color: string): THREE.Group {
    const post = new THREE.Group();
    addMesh(post, new THREE.CylinderGeometry(0.15, 0.18, 3.2, 8), "#7f5539", [0, 1.6, 0]);
    const board = createSignBoard(text, { height: 1.3, background: color, color: "#3d2c1e" });
    board.position.set(0, 3.4, 0.12);
    post.add(board);
    return post;
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
    arch.position.set(0, 0, ENTRANCE_Z);
    return arch;
}

export function createTerrain(): THREE.Group {
    const terrain = new THREE.Group();

    // 맵 바깥까지 이어지는 잔디
    addFlat(terrain, new THREE.PlaneGeometry(MAP_SIZE + 200, MAP_SIZE + 200), "#a9dc8e", 0, 0, 0);

    // 구역 바닥 (겹치는 구간의 깜빡임을 막으려고 높이를 조금씩 다르게)
    Object.values(ZONES).forEach((zone, order) => {
        addFlat(terrain, createRoundedRect(zone.width, zone.depth, 8), ZONE_COLORS[zone.id], zone.x, 0.02 + order * 0.004, zone.z);
    });

    // 길
    for (const segment of getPathSegments()) {
        const length = Math.hypot(segment.bx - segment.ax, segment.bz - segment.az);
        const angle = Math.atan2(segment.bx - segment.ax, segment.bz - segment.az);
        addFlat(terrain, new THREE.PlaneGeometry(segment.width, length), "#fbf0d9", (segment.ax + segment.bx) / 2, 0.05, (segment.az + segment.bz) / 2, angle);
        // 길 끝 둥근 마감
        addFlat(terrain, new THREE.CircleGeometry(segment.width / 2, 20), "#fbf0d9", segment.bx, 0.051, segment.bz);
    }
    addFlat(terrain, new THREE.CircleGeometry(HUB_RADIUS, 40), "#fff6e3", HUB_CENTER.x, 0.06, HUB_CENTER.z);
    addFlat(terrain, new THREE.RingGeometry(HUB_RADIUS - 0.6, HUB_RADIUS, 40), "#f1cfa6", HUB_CENTER.x, 0.065, HUB_CENTER.z);

    // 광장 가운데 분수
    addMesh(terrain, new THREE.CylinderGeometry(3, 3.3, 0.8, 24), "#d6ccc2", [0, 0.4, 0]);
    addMesh(terrain, new THREE.CylinderGeometry(2.6, 2.6, 0.82, 24), "#48cae4", [0, 0.41, 0]);
    addMesh(terrain, new THREE.CylinderGeometry(0.4, 0.6, 2.2, 12), "#d6ccc2", [0, 1.1, 0]);
    addMesh(terrain, new THREE.SphereGeometry(0.7, 14, 10), "#90e0ef", [0, 2.4, 0]);

    // 구역 표지판 — 글로벌페어는 스폰 지점(남쪽)을, 나머지는 광장 쪽을 바라봄
    for (const zone of Object.values(ZONES)) {
        const spot = ZONE_SIGN_SPOTS[zone.id];
        const post = createSignPost(zone.name, ZONE_COLORS[zone.id]);
        post.position.set(spot.x, 0, spot.z);
        post.rotation.y = zone.id === "global_fair" ? 0 : Math.atan2(HUB_CENTER.x - spot.x, HUB_CENTER.z - spot.z);
        terrain.add(post);
    }

    terrain.add(createEntranceArch());
    return terrain;
}
