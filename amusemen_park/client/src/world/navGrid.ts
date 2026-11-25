// 지나갈 수 없는 칸 지도 + 길찾기 — 놀이기구를 캐릭터가 뚫고 지나가지 않게, 자동 이동은 기구를 돌아가게
// 막힌 칸: 기구 모델의 가파른 면(벽·기둥·울타리·지지대) 중 몸통 높이(BAND_MIN ~ BAND_MAX)를 지나는 부분
//   + 바위·수레 같은 막는 원(groundMap colliders)
//   낮은 바닥(BAND_MIN 아래)과 높이 떠 있는 레일(BAND_MAX 위) 아래는 지나갈 수 있음
//   움직이는 부분(열차·보트·회전판)은 여러 운행 시각에 차지한 자리를 모두 막음
//   기구 안의 좁은 틈(롤러코스터 지지대 사이 등, 폭 GAP_FILL_CELLS × 2 칸 미만)은 메워서 기구 속으로 들어가지 못하게
//   기구 중심부(반지름 RIDE_CORE_RADIUS 이하)도 막음 — 높이 떠 있는 레일 아래 넓은 안마당으로 들어가지 못하게, 탑승 입구(중심에서 14m)는 열림
import * as THREE from "three";
import { MAP_HALF, RIDES, RIDE_GATE_DISTANCE, type RideId } from "@shared";
import type { RideModel } from "./rides";

// 칸 크기(m) — 한 프레임 이동 거리(달리기 3.6m/s × 최대 0.05초)보다 커야 벽을 건너뛰지 않음
const CELL = 0.5;
// 몸통 높이 구간 — 이 구간을 지나는 가파른 면이 있는 칸은 막힘 (아래는 넘어갈 수 있는 낮은 턱, 위는 머리 위 구조물)
const BAND_MIN = 0.55;
const BAND_MAX = 1.6;
// 이보다 가파른 면(법선의 위쪽 성분이 작음)만 벽으로 봄 — 바닥·지붕 같은 평평한 면은 제외
const STEEP_NORMAL_Y = 0.7;
// 움직이는 부분이 차지하는 자리를 모으는 운행 시각 수 (한 바퀴에 고르게)
const MOTION_SAMPLES = 16;
const MOTION_SPAN = 60;
// 캐릭터 몸 반지름만큼 막힌 칸을 넓힘 (칸 수)
const CLEARANCE_CELLS = 1;
// 기구 안 좁은 틈을 메우는 폭 — 막힌 칸을 이만큼 넓혔다가 다시 줄임(닫기): 폭 2 × 4칸(4m) 미만 틈이 메워짐
const GAP_FILL_CELLS = 4;
// 기구 중심부를 막는 반지름 상한 — 탑승 입구(RIDE_GATE_DISTANCE)보다 이만큼 안쪽까지만 (입구 앞에 설 자리를 남김)
const RIDE_CORE_GATE_MARGIN = 4;

export interface NavGrid {
    // 몸이 들어갈 수 없는 자리인지 (몸 반지름만큼 넓힌 막힌 칸)
    isBlocked(x: number, z: number): boolean;
    // from 에서 걸어서 갈 수 없는 자리(기구 벽 안·벽에 둘러싸인 곳)면, 그 자리에서 from 쪽으로 직선을 따라 오다가
    // 처음 만나는 갈 수 있는 자리 (= 내 쪽에서 가장 가까운 기구 앞) — 갈 수 있으면 그대로
    nearestReachable(x: number, z: number, from_x: number, from_z: number): { x: number; z: number };
    // from → to 경로 (꺾임점 목록, 마지막 = to) — 갈 수 없으면 null
    findPath(from_x: number, from_z: number, to_x: number, to_z: number): { x: number; z: number }[] | null;
}

const SIZE = Math.ceil((MAP_HALF * 2) / CELL);

function cellOf(value: number): number {
    return Math.floor((value + MAP_HALF) / CELL);
}

function centerOf(cell: number): number {
    return (cell + 0.5) * CELL - MAP_HALF;
}

// 칸 지도를 정사각형(2r+1 칸)만큼 넓힘 (value 인 칸 주변을 value 로) — 가로·세로로 나눠 계산
function spread(source: Uint8Array, radius: number, value: number): Uint8Array {
    const rows = new Uint8Array(source.length).fill(1 - value);
    for (let cz = 0; cz < SIZE; cz += 1) {
        let last = -Infinity;
        // 왼쪽→오른쪽: 반경 안에 value 가 있었는지, 오른쪽→왼쪽도 같은 방식
        for (let cx = 0; cx < SIZE; cx += 1) {
            if (source[cz * SIZE + cx] === value) {
                last = cx;
            }
            if (cx - last <= radius) {
                rows[cz * SIZE + cx] = value;
            }
        }
        last = Infinity;
        for (let cx = SIZE - 1; cx >= 0; cx -= 1) {
            if (source[cz * SIZE + cx] === value) {
                last = cx;
            }
            if (last - cx <= radius) {
                rows[cz * SIZE + cx] = value;
            }
        }
    }
    const result = new Uint8Array(source.length).fill(1 - value);
    for (let cx = 0; cx < SIZE; cx += 1) {
        let last = -Infinity;
        for (let cz = 0; cz < SIZE; cz += 1) {
            if (rows[cz * SIZE + cx] === value) {
                last = cz;
            }
            if (cz - last <= radius) {
                result[cz * SIZE + cx] = value;
            }
        }
        last = Infinity;
        for (let cz = SIZE - 1; cz >= 0; cz -= 1) {
            if (rows[cz * SIZE + cx] === value) {
                last = cz;
            }
            if (last - cz <= radius) {
                result[cz * SIZE + cx] = value;
            }
        }
    }
    return result;
}

// 삼각형을 y 구간으로 자른 다각형 (Sutherland–Hodgman, 아래·위 두 평면)
function clipToBand(points: THREE.Vector3[]): THREE.Vector3[] {
    let polygon = points;
    for (const [limit, keep_above] of [[BAND_MIN, true], [BAND_MAX, false]] as const) {
        const next: THREE.Vector3[] = [];
        for (let index = 0; index < polygon.length; index += 1) {
            const a = polygon[index];
            const b = polygon[(index + 1) % polygon.length];
            const a_in = keep_above ? a.y >= limit : a.y <= limit;
            const b_in = keep_above ? b.y >= limit : b.y <= limit;
            if (a_in) {
                next.push(a);
            }
            if (a_in !== b_in) {
                next.push(a.clone().lerp(b, (limit - a.y) / (b.y - a.y)));
            }
        }
        polygon = next;
        if (polygon.length === 0) {
            break;
        }
    }
    return polygon;
}

export function createNavGrid(
    rides: ReadonlyMap<RideId, RideModel>,
    vehicles: ReadonlySet<THREE.Object3D>,
    moving: ReadonlySet<THREE.Object3D>,
    circles: readonly { x: number; z: number; radius: number }[],
): NavGrid {
    const solid = new Uint8Array(SIZE * SIZE);

    function mark(x: number, z: number): void {
        const cx = cellOf(x);
        const cz = cellOf(z);
        if (cx >= 0 && cz >= 0 && cx < SIZE && cz < SIZE) {
            solid[cz * SIZE + cx] = 1;
        }
    }

    // 다각형 둘레를 칸보다 촘촘하게 따라가며 칠함 (벽·기둥은 위에서 보면 선·얇은 띠라 둘레로 충분)
    function markPolygon(polygon: readonly THREE.Vector3[]): void {
        for (let index = 0; index < polygon.length; index += 1) {
            const a = polygon[index];
            const b = polygon[(index + 1) % polygon.length];
            const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / (CELL * 0.5)));
            for (let step = 0; step <= steps; step += 1) {
                const ratio = step / steps;
                mark(a.x + (b.x - a.x) * ratio, a.z + (b.z - a.z) * ratio);
            }
        }
    }

    const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const edge_a = new THREE.Vector3();
    const edge_b = new THREE.Vector3();
    const instance_matrix = new THREE.Matrix4();
    const world_matrix = new THREE.Matrix4();

    function markMesh(mesh: THREE.Mesh): void {
        const positions = mesh.geometry.getAttribute("position");
        const index = mesh.geometry.getIndex();
        const triangle_count = (index !== null ? index.count : positions.count) / 3;
        const instances = mesh instanceof THREE.InstancedMesh ? mesh.count : 1;
        for (let instance = 0; instance < instances; instance += 1) {
            if (mesh instanceof THREE.InstancedMesh) {
                mesh.getMatrixAt(instance, instance_matrix);
                world_matrix.multiplyMatrices(mesh.matrixWorld, instance_matrix);
            } else {
                world_matrix.copy(mesh.matrixWorld);
            }
            for (let triangle = 0; triangle < triangle_count; triangle += 1) {
                for (let corner = 0; corner < 3; corner += 1) {
                    const vertex = index !== null ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
                    corners[corner].fromBufferAttribute(positions, vertex).applyMatrix4(world_matrix);
                }
                const min_y = Math.min(corners[0].y, corners[1].y, corners[2].y);
                const max_y = Math.max(corners[0].y, corners[1].y, corners[2].y);
                if (max_y < BAND_MIN || min_y > BAND_MAX) {
                    continue;
                }
                const normal = edge_a.subVectors(corners[1], corners[0]).cross(edge_b.subVectors(corners[2], corners[0]));
                const length = normal.length();
                if (length < 1e-9 || Math.abs(normal.y) / length > STEEP_NORMAL_Y) {
                    continue;
                }
                markPolygon(clipToBand([corners[0].clone(), corners[1].clone(), corners[2].clone()]));
            }
        }
    }

    function markRides(include: (mesh: THREE.Mesh) => boolean): void {
        for (const model of rides.values()) {
            model.root.updateMatrixWorld(true);
            model.root.traverse((node) => {
                if (node instanceof THREE.Mesh && !(node instanceof THREE.SkinnedMesh) && node.visible && node.userData.walk_through !== true && include(node)) {
                    markMesh(node);
                }
            });
        }
    }

    const isMoving = (mesh: THREE.Mesh): boolean => moving.has(mesh) || [...vehicles].some((vehicle) => vehicle === mesh || isAncestor(vehicle, mesh));
    // 고정된 부분은 한 번, 움직이는 부분은 운행 시각을 바꿔 가며 차지한 자리를 모두
    markRides((mesh) => !isMoving(mesh));
    for (let sample = 0; sample < MOTION_SAMPLES; sample += 1) {
        for (const model of rides.values()) {
            model.update((sample / MOTION_SAMPLES) * MOTION_SPAN, 0);
        }
        markRides(isMoving);
    }

    // 기구 안 좁은 틈 메우기 (닫기: 막힌 칸을 넓혔다가 다시 줄임 → 바깥 경계는 그대로, 좁은 틈만 막힘)
    const closed = spread(spread(solid, GAP_FILL_CELLS, 1), GAP_FILL_CELLS, 0);
    for (let index = 0; index < solid.length; index += 1) {
        solid[index] |= closed[index];
    }

    // 기구 중심부 (기구 영역 반지름과 입구 안쪽 거리 중 작은 쪽)
    for (const ride_id of rides.keys()) {
        const ride = RIDES[ride_id];
        const radius = Math.min(ride.footprint_radius, RIDE_GATE_DISTANCE - RIDE_CORE_GATE_MARGIN);
        const reach = Math.ceil(radius / CELL);
        const cx = cellOf(ride.x);
        const cz = cellOf(ride.z);
        for (let dz = -reach; dz <= reach; dz += 1) {
            for (let dx = -reach; dx <= reach; dx += 1) {
                if (Math.hypot(centerOf(cx + dx) - ride.x, centerOf(cz + dz) - ride.z) <= radius) {
                    mark(centerOf(cx + dx), centerOf(cz + dz));
                }
            }
        }
    }

    // 바위·수레 같은 막는 원 (이미 몸 반지름을 더한 원)
    for (const circle of circles) {
        const reach = Math.ceil(circle.radius / CELL) + 1;
        const cx = cellOf(circle.x);
        const cz = cellOf(circle.z);
        for (let dz = -reach; dz <= reach; dz += 1) {
            for (let dx = -reach; dx <= reach; dx += 1) {
                if (Math.hypot(centerOf(cx + dx) - circle.x, centerOf(cz + dz) - circle.z) < circle.radius - CELL * CLEARANCE_CELLS) {
                    mark(centerOf(cx + dx), centerOf(cz + dz));
                }
            }
        }
    }

    // 몸 반지름만큼 넓힌 막힌 칸
    const blocked = new Uint8Array(SIZE * SIZE);
    for (let cz = 0; cz < SIZE; cz += 1) {
        for (let cx = 0; cx < SIZE; cx += 1) {
            if (solid[cz * SIZE + cx] === 0) {
                continue;
            }
            for (let dz = -CLEARANCE_CELLS; dz <= CLEARANCE_CELLS; dz += 1) {
                for (let dx = -CLEARANCE_CELLS; dx <= CLEARANCE_CELLS; dx += 1) {
                    const nx = cx + dx;
                    const nz = cz + dz;
                    if (nx >= 0 && nz >= 0 && nx < SIZE && nz < SIZE) {
                        blocked[nz * SIZE + nx] = 1;
                    }
                }
            }
        }
    }

    function isBlockedCell(cx: number, cz: number): boolean {
        return cx < 0 || cz < 0 || cx >= SIZE || cz >= SIZE || blocked[cz * SIZE + cx] === 1;
    }

    // 두 점 사이 직선이 막힌 칸을 지나지 않는지 (경로 꺾임점 줄이기)
    function isClear(ax: number, az: number, bx: number, bz: number): boolean {
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / (CELL * 0.5)));
        for (let step = 0; step <= steps; step += 1) {
            const ratio = step / steps;
            if (isBlockedCell(cellOf(ax + (bx - ax) * ratio), cellOf(az + (bz - az) * ratio))) {
                return false;
            }
        }
        return true;
    }

    const grid: NavGrid = {
        isBlocked(x, z) {
            return isBlockedCell(cellOf(x), cellOf(z));
        },
        nearestReachable(x, z, from_x, from_z) {
            // from 에서 열린 칸을 따라 퍼져 나가며 갈 수 있는 칸 표시 (시작 칸은 벽에 붙어 막혀 있어도 출발 허용)
            const reachable = new Uint8Array(SIZE * SIZE);
            const queue = new Int32Array(SIZE * SIZE);
            const start = cellOf(from_z) * SIZE + cellOf(from_x);
            let head = 0;
            let tail = 0;
            if (start >= 0 && start < SIZE * SIZE) {
                reachable[start] = 1;
                queue[tail++] = start;
            }
            while (head < tail) {
                const node = queue[head++];
                const nx = node % SIZE;
                const nz = (node - nx) / SIZE;
                for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
                    if (isBlockedCell(nx + dx, nz + dz)) {
                        continue;
                    }
                    const next = (nz + dz) * SIZE + nx + dx;
                    if (reachable[next] === 0) {
                        reachable[next] = 1;
                        queue[tail++] = next;
                    }
                }
            }
            const isReachable = (px: number, pz: number): boolean => {
                const cx = cellOf(px);
                const cz = cellOf(pz);
                return cx >= 0 && cz >= 0 && cx < SIZE && cz < SIZE && reachable[cz * SIZE + cx] === 1;
            };
            if (isReachable(x, z)) {
                return { x, z };
            }
            const steps = Math.max(1, Math.ceil(Math.hypot(from_x - x, from_z - z) / (CELL * 0.5)));
            for (let step = 1; step <= steps; step += 1) {
                const ratio = step / steps;
                const px = x + (from_x - x) * ratio;
                const pz = z + (from_z - z) * ratio;
                if (isReachable(px, pz)) {
                    // 칸 가운데로 맞춰 벽에 바짝 붙지 않게
                    return { x: centerOf(cellOf(px)), z: centerOf(cellOf(pz)) };
                }
            }
            return { x: from_x, z: from_z };
        },
        findPath(from_x, from_z, to_x, to_z) {
            const start_x = cellOf(from_x);
            const start_z = cellOf(from_z);
            const goal_x = cellOf(to_x);
            const goal_z = cellOf(to_z);
            if (isClear(from_x, from_z, to_x, to_z)) {
                return [{ x: to_x, z: to_z }];
            }
            if (isBlockedCell(goal_x, goal_z)) {
                return null;
            }
            // A* (8방향, 대각선은 모서리를 깎지 않을 때만) — 시작 칸이 벽에 붙어 막힌 칸이어도 출발은 허용
            const total = SIZE * SIZE;
            const cost = new Float32Array(total).fill(Infinity);
            const came = new Int32Array(total).fill(-1);
            const closed = new Uint8Array(total);
            const heap: number[] = [];
            const priority = new Float32Array(total);
            const push = (node: number): void => {
                heap.push(node);
                let child = heap.length - 1;
                while (child > 0) {
                    const parent = (child - 1) >> 1;
                    if (priority[heap[parent]] <= priority[heap[child]]) {
                        break;
                    }
                    [heap[parent], heap[child]] = [heap[child], heap[parent]];
                    child = parent;
                }
            };
            const pop = (): number => {
                const top = heap[0];
                const last = heap.pop() as number;
                if (heap.length > 0) {
                    heap[0] = last;
                    let parent = 0;
                    for (;;) {
                        const left = parent * 2 + 1;
                        const right = left + 1;
                        let smallest = parent;
                        if (left < heap.length && priority[heap[left]] < priority[heap[smallest]]) {
                            smallest = left;
                        }
                        if (right < heap.length && priority[heap[right]] < priority[heap[smallest]]) {
                            smallest = right;
                        }
                        if (smallest === parent) {
                            break;
                        }
                        [heap[parent], heap[smallest]] = [heap[smallest], heap[parent]];
                        parent = smallest;
                    }
                }
                return top;
            };
            const heuristic = (cx: number, cz: number): number => {
                const dx = Math.abs(cx - goal_x);
                const dz = Math.abs(cz - goal_z);
                return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz);
            };
            const start = start_z * SIZE + start_x;
            const goal = goal_z * SIZE + goal_x;
            cost[start] = 0;
            priority[start] = heuristic(start_x, start_z);
            push(start);
            while (heap.length > 0) {
                const node = pop();
                if (node === goal) {
                    break;
                }
                if (closed[node] === 1) {
                    continue;
                }
                closed[node] = 1;
                const nx = node % SIZE;
                const nz = (node - nx) / SIZE;
                for (let dz = -1; dz <= 1; dz += 1) {
                    for (let dx = -1; dx <= 1; dx += 1) {
                        if ((dx === 0 && dz === 0) || isBlockedCell(nx + dx, nz + dz)) {
                            continue;
                        }
                        if (dx !== 0 && dz !== 0 && (isBlockedCell(nx + dx, nz) || isBlockedCell(nx, nz + dz))) {
                            continue;
                        }
                        const next = (nz + dz) * SIZE + nx + dx;
                        const next_cost = cost[node] + (dx !== 0 && dz !== 0 ? Math.SQRT2 : 1);
                        if (next_cost < cost[next]) {
                            cost[next] = next_cost;
                            came[next] = node;
                            priority[next] = next_cost + heuristic(nx + dx, nz + dz);
                            push(next);
                        }
                    }
                }
            }
            if (came[goal] === -1) {
                return null;
            }
            // 칸 경로 → 꺾임점: 앞 점에서 곧장 보이는 가장 먼 칸까지 건너뜀
            const cells: { x: number; z: number }[] = [];
            for (let node = goal; node !== start && node !== -1; node = came[node]) {
                cells.push({ x: centerOf(node % SIZE), z: centerOf(Math.floor(node / SIZE)) });
            }
            cells.reverse();
            cells[cells.length - 1] = { x: to_x, z: to_z };
            const path: { x: number; z: number }[] = [];
            let anchor = { x: from_x, z: from_z };
            let index = 0;
            while (index < cells.length) {
                let far = index;
                while (far + 1 < cells.length && isClear(anchor.x, anchor.z, cells[far + 1].x, cells[far + 1].z)) {
                    far += 1;
                }
                path.push(cells[far]);
                anchor = cells[far];
                index = far + 1;
            }
            return path;
        },
    };
    return grid;
}

function isAncestor(ancestor: THREE.Object3D, node: THREE.Object3D): boolean {
    for (let current = node.parent; current !== null; current = current.parent) {
        if (current === ancestor) {
            return true;
        }
    }
    return false;
}
