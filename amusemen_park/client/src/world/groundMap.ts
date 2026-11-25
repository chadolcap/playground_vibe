// 캐릭터가 서는 바닥 높이와 지나갈 수 없는 바위 — 장면의 실제 도형에서 자동으로 구함
// 바닥: 위에서 아래로 광선을 쏴서 STEP_MAX 이하의 가장 높은 윗면 (기구 바닥 원판·승강장·광장·길 등 모든 지면 물체)
// 바위: DodecahedronGeometry(addRock·DUCK FALL 바위산) — 몸통 높이에서 자른 단면을 원으로 막음
// 단단한 소품: userData.solid_radius 가 있는 묶음(솜사탕 수레 등) — 그 반지름 원으로 막고, 그 안의 도형은 바닥으로 쓰지 않음
// 놀이기구: 벽·기둥·울타리를 칸 지도(navGrid.ts)로 막음 — 직접 이동은 벽을 따라 미끄러지고, 자동 이동은 그 지도로 길을 찾음
import * as THREE from "three";
import type { RideId } from "@shared";
import { createNavGrid, type NavGrid } from "./navGrid";
import type { RideModel } from "./rides";

// 이 높이 이하의 윗면은 올라설 수 있는 바닥 (더 높은 물체는 지금처럼 지나감, 바위만 막힘)
const STEP_MAX = 1.0;
// 바닥 높이를 기억하는 칸 크기 (m) — 지면 물체는 움직이지 않으므로 한 번 잰 칸은 다시 재지 않음
const CELL_SIZE = 0.25;
// 캐릭터 몸 반지름 — 바위 표면에서 이만큼 떨어져 멈춤
const BODY_RADIUS = 0.3;
// 바위가 막는 높이 구간 (발바닥 ~ 가슴)
const BODY_TOP = 1.2;
// 겹친 바위에서 밀어내기를 반복하는 최대 횟수
const PUSH_PASSES = 6;
// 움직이는 도형을 찾을 때 비교하는 두 운행 시각 (초)
const PROBE_TIMES = [0, 23.7];

export interface Collider {
    x: number;
    z: number;
    radius: number;
}

export interface GroundMap {
    // (x, z) 에서 캐릭터가 설 바닥 높이 (땅 = 0)
    heightAt(x: number, z: number): number;
    // 바위 안으로 들어간 위치를 가장자리 밖으로 밀어냄 (밀어냈으면 true)
    // 바위 사이 오목한 틈처럼 밀어내도 빠져나오지 못하면 이동 전 위치(from)로 되돌림
    pushOut(position: THREE.Vector3, from_x: number, from_z: number): boolean;
    readonly colliders: readonly Collider[];
    // 지나갈 수 없는 칸 지도 (기구 + 막는 원) — 자동 이동 길찾기
    readonly nav: NavGrid;
}

function isRock(mesh: THREE.Mesh): boolean {
    return mesh.geometry instanceof THREE.DodecahedronGeometry;
}

function isUnder(node: THREE.Object3D, roots: ReadonlySet<THREE.Object3D>): boolean {
    for (let current: THREE.Object3D | null = node; current !== null; current = current.parent) {
        if (roots.has(current)) {
            return true;
        }
    }
    return false;
}

// 좌석이 달린 묶음(열차·보트·흔들리는 팔·CRAZY BUMP)은 움직이는 탑승물 → 바닥이 아님
// (CRAZY BUMP처럼 서버가 위치를 정하는 기구는 운행 시각을 바꿔도 움직이지 않으므로 좌석으로 판별)
function collectVehicles(rides: ReadonlyMap<RideId, RideModel>): Set<THREE.Object3D> {
    const vehicles = new Set<THREE.Object3D>();
    for (const model of rides.values()) {
        for (const anchor of model.seat_anchors) {
            let node: THREE.Object3D = anchor;
            while (node.parent !== null && node.parent !== model.root) {
                node = node.parent;
            }
            if (node.parent === model.root) {
                vehicles.add(node);
            }
        }
    }
    return vehicles;
}

// 운행 시각을 바꿔 봐서 움직이는 도형(턴테이블 등)을 찾음 — 다음 프레임에 원래 시각으로 돌아감
function collectMovingMeshes(rides: ReadonlyMap<RideId, RideModel>): Set<THREE.Object3D> {
    const first = new Map<THREE.Object3D, THREE.Matrix4>();
    const moving = new Set<THREE.Object3D>();
    PROBE_TIMES.forEach((time, index) => {
        for (const model of rides.values()) {
            model.update(time, 0);
            model.root.updateMatrixWorld(true);
            model.root.traverse((node) => {
                if (!(node instanceof THREE.Mesh)) {
                    return;
                }
                if (index === 0) {
                    first.set(node, node.matrixWorld.clone());
                } else if (!node.matrixWorld.equals(first.get(node) ?? node.matrixWorld)) {
                    moving.add(node);
                }
            });
        }
    });
    return moving;
}

// 바위 하나 → 몸통 높이 구간(0 ~ BODY_TOP)에 걸친 부분을 모두 덮는 원 (구간에 닿지 않으면 null)
// 볼록한 도형이라 단면에서 가장 먼 점은 구간 안의 꼭짓점이거나 모서리가 구간 경계면을 지나는 점 중 하나
function rockCollider(mesh: THREE.Mesh): Collider | null {
    const center = mesh.getWorldPosition(new THREE.Vector3());
    const positions = mesh.geometry.getAttribute("position");
    const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    let reach = -1;
    const consider = (x: number, y: number, z: number): void => {
        if (y >= 0 && y <= BODY_TOP) {
            reach = Math.max(reach, Math.hypot(x - center.x, z - center.z));
        }
    };
    // 비색인 삼각형 목록 (DodecahedronGeometry) — 삼각형마다 세 모서리를 봄
    for (let index = 0; index + 2 < positions.count; index += 3) {
        corners.forEach((corner, offset) => corner.fromBufferAttribute(positions, index + offset).applyMatrix4(mesh.matrixWorld));
        for (let edge = 0; edge < 3; edge += 1) {
            const a = corners[edge];
            const b = corners[(edge + 1) % 3];
            consider(a.x, a.y, a.z);
            for (const plane_y of [0, BODY_TOP]) {
                if ((a.y - plane_y) * (b.y - plane_y) < 0) {
                    const ratio = (plane_y - a.y) / (b.y - a.y);
                    consider(a.x + (b.x - a.x) * ratio, plane_y, a.z + (b.z - a.z) * ratio);
                }
            }
        }
    }
    return reach < 0 ? null : { x: center.x, z: center.z, radius: reach + BODY_RADIUS };
}

// scene: 캐릭터를 넣기 전의 공원 장면 / rides: 기구 모델 (탑승물·움직이는 부분을 바닥에서 뺌)
export function createGroundMap(scene: THREE.Scene, rides: ReadonlyMap<RideId, RideModel>): GroundMap {
    const vehicles = collectVehicles(rides);
    const moving = collectMovingMeshes(rides);
    scene.updateMatrixWorld(true);

    const surfaces: THREE.Object3D[] = [];
    const colliders: Collider[] = [];
    const bounds = new THREE.Box3();
    const solids = new Set<THREE.Object3D>();
    scene.traverse((node) => {
        if (typeof node.userData.solid_radius === "number") {
            const center = node.getWorldPosition(new THREE.Vector3());
            colliders.push({ x: center.x, z: center.z, radius: node.userData.solid_radius + BODY_RADIUS });
            solids.add(node);
        }
    });
    scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh) || node instanceof THREE.SkinnedMesh || !node.visible) {
            return;
        }
        if (isRock(node)) {
            const collider = rockCollider(node);
            if (collider !== null) {
                colliders.push(collider);
            }
            return;
        }
        // 꽃처럼 밟고 지나가는 장식, 탑승물, 움직이는 부분, 전부 STEP_MAX 위에 떠 있는 것은 바닥이 아님
        if (node.userData.walk_through === true || moving.has(node) || isUnder(node, vehicles) || isUnder(node, solids)) {
            return;
        }
        bounds.setFromObject(node);
        if (bounds.min.y < STEP_MAX) {
            surfaces.push(node);
        }
    });

    // 기구 벽·기둥 + 막는 원 칸 지도 (움직이는 부분은 운행 시각을 바꿔 가며 모음 — 다음 프레임에 원래 시각으로 돌아감)
    const nav = createNavGrid(rides, vehicles, moving, colliders);

    const heights = new Map<number, number>();
    const raycaster = new THREE.Raycaster();
    const origin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    // 광선 시작을 STEP_MAX 바로 위에 둠 → 더 높은 물체 안에서 시작하면 그 물체의 뒷면이라 맞지 않음
    raycaster.far = STEP_MAX + 0.02;

    function measure(cell_x: number, cell_z: number): number {
        origin.set(cell_x * CELL_SIZE, STEP_MAX + 0.01, cell_z * CELL_SIZE);
        raycaster.set(origin, down);
        const hit = raycaster.intersectObjects(surfaces, false)[0];
        return hit === undefined ? 0 : Math.max(0, hit.point.y);
    }

    return {
        colliders,
        nav,
        heightAt(x, z) {
            const cell_x = Math.round(x / CELL_SIZE);
            const cell_z = Math.round(z / CELL_SIZE);
            // 칸 번호 두 개를 하나의 숫자 키로 (공원 크기 안에서 겹치지 않음)
            const key = cell_x * 100000 + cell_z;
            let height = heights.get(key);
            if (height === undefined) {
                height = measure(cell_x, cell_z);
                heights.set(key, height);
            }
            return height;
        },
        pushOut(position, from_x, from_z) {
            let pushed = false;
            // 겹친 바위(바위산)는 한 바위 밖으로 밀면 옆 바위 안일 수 있어 겹침이 없어질 때까지 반복
            for (let pass = 0; pass <= PUSH_PASSES; pass += 1) {
                if (pass === PUSH_PASSES) {
                    position.x = from_x;
                    position.z = from_z;
                    break;
                }
                let pushed_this_pass = false;
                for (const collider of colliders) {
                    const dx = position.x - collider.x;
                    const dz = position.z - collider.z;
                    const distance = Math.hypot(dx, dz);
                    if (distance >= collider.radius) {
                        continue;
                    }
                    // 정확히 중심이면 아무 쪽으로나
                    const nx = distance > 1e-6 ? dx / distance : 1;
                    const nz = distance > 1e-6 ? dz / distance : 0;
                    position.x = collider.x + nx * collider.radius;
                    position.z = collider.z + nz * collider.radius;
                    pushed_this_pass = true;
                }
                if (!pushed_this_pass) {
                    break;
                }
                pushed = true;
            }
            // 기구 벽·기둥에 막히면 벽을 따라 미끄러짐 (한 축씩 되돌려 봄) — 이미 막힌 자리에 서 있으면(하차 직후 등) 빠져나가게 그대로 둠
            if (nav.isBlocked(position.x, position.z) && !nav.isBlocked(from_x, from_z)) {
                if (!nav.isBlocked(position.x, from_z)) {
                    position.z = from_z;
                } else if (!nav.isBlocked(from_x, position.z)) {
                    position.x = from_x;
                } else {
                    position.x = from_x;
                    position.z = from_z;
                }
                pushed = true;
            }
            return pushed;
        },
    };
}
