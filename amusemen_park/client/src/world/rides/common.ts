// 놀이기구 모델 공통 도구 — 재질 캐시, 도형 추가, 트랙(경로) 프레임, 레일·지지대·리본, 좌석 카트
// 모든 모델은 기구 로컬 좌표계 기준: 원점 = 기구 중심 바닥, +z = 게이트(통로) 방향, +y = 위
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import type { RideId } from "@shared";

export interface RideModel {
    id: RideId;
    // 월드에 배치되는 최상위 그룹 (위치·방향은 rides/index.ts 가 설정)
    root: THREE.Group;
    // 좌석 위치 — 탑승자가 앉을 자리. 자식 객체라서 기구와 함께 움직이며 +z 가 좌석 정면
    seat_anchors: THREE.Object3D[];
    // 운행 애니메이션 — 자세는 반드시 time(방 시각, 초)만으로 결정할 것 (delta 누적 금지)
    // 그래야 같은 방의 모든 클라이언트에서 기구·탑승자 위치가 일치함
    update(time: number, delta: number): void;
}

// ───────── 재질 ─────────
// 아기자기하고 부드러운 느낌: 카툰(툰) 셰이딩 — 명암을 몇 단계로만 나눠 각진 음영 대신 동글동글한 색면으로 보이게

const material_cache = new Map<string, THREE.MeshToonMaterial>();
let toon_gradient: THREE.DataTexture | null = null;

// 명암 단계 (어두운 쪽도 너무 어둡지 않게 → 파스텔 톤 유지)
const TOON_STEPS = [150, 196, 232, 255];

export function getToonGradient(): THREE.DataTexture {
    if (toon_gradient === null) {
        const data = new Uint8Array(TOON_STEPS.length * 4);
        TOON_STEPS.forEach((value, index) => data.set([value, value, value, 255], index * 4));
        toon_gradient = new THREE.DataTexture(data, TOON_STEPS.length, 1, THREE.RGBAFormat);
        toon_gradient.minFilter = THREE.NearestFilter;
        toon_gradient.magFilter = THREE.NearestFilter;
        toon_gradient.generateMipmaps = false;
        toon_gradient.needsUpdate = true;
    }
    return toon_gradient;
}

// 같은 색 재질은 하나만 만들어 공유 (그리기 호출·메모리 절약)
export function getMaterial(color: THREE.ColorRepresentation, emissive_intensity = 0): THREE.MeshToonMaterial {
    const hex = new THREE.Color(color).getHexString();
    const key = `${hex}|${emissive_intensity}`;
    let material = material_cache.get(key);
    if (material === undefined) {
        material = new THREE.MeshToonMaterial({ color: `#${hex}`, gradientMap: getToonGradient() });
        if (emissive_intensity > 0) {
            material.emissive = new THREE.Color(`#${hex}`);
            material.emissiveIntensity = emissive_intensity;
        }
        material_cache.set(key, material);
    }
    return material;
}

export function disposeMaterialCache(): void {
    for (const material of material_cache.values()) {
        material.dispose();
    }
    material_cache.clear();
    toon_gradient?.dispose();
    toon_gradient = null;
}

type Vec3 = readonly [number, number, number];

// 각진 상자는 모서리를 둥글게 (가장 짧은 변의 18% 반경) — 장난감 같은 부드러운 형태
function softenGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    if (!(geometry instanceof THREE.BoxGeometry)) {
        return geometry;
    }
    const { width, height, depth } = geometry.parameters;
    const radius = Math.min(width, height, depth) * 0.18;
    geometry.dispose();
    return new RoundedBoxGeometry(width, height, depth, 2, radius);
}

// 도형 하나를 만들어 부모에 붙임 (그림자 주고받기 기본 설정, 상자는 모서리를 둥글게)
export function addMesh(
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    color: THREE.ColorRepresentation,
    position: Vec3 = [0, 0, 0],
    rotation: Vec3 = [0, 0, 0],
): THREE.Mesh {
    const mesh = new THREE.Mesh(softenGeometry(geometry), getMaterial(color));
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
}

// ───────── 트랙(경로) 프레임 ─────────

export interface PathFrames {
    closed: boolean;
    // 전체 길이 (월드 단위)
    length: number;
    // 등간격 샘플 (segments + 1 개)
    positions: THREE.Vector3[];
    tangents: THREE.Vector3[];
    // 진행 방향에 수직인 "위쪽" — 평행 이동 방식이라 루프를 돌아도 뒤틀리지 않음
    ups: THREE.Vector3[];
}

export function createClosedCurve(points: readonly Vec3[]): THREE.CatmullRomCurve3 {
    return new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, "centripetal");
}

// 땅 위 타원 경로 (반지름 radius_x, radius_z, 높이 y)
export function createEllipseCurve(radius_x: number, radius_z: number, y: number, center_z = 0): THREE.CatmullRomCurve3 {
    const points: Vec3[] = [];
    const count = 48;
    for (let index = 0; index < count; index += 1) {
        // 반시계 방향으로 진행
        const angle = (index / count) * Math.PI * 2;
        points.push([Math.cos(angle) * radius_x, y, center_z + Math.sin(angle) * radius_z]);
    }
    return createClosedCurve(points);
}

export function buildPathFrames(curve: THREE.Curve<THREE.Vector3>, segments: number, closed: boolean): PathFrames {
    const positions = curve.getSpacedPoints(segments);
    const tangents: THREE.Vector3[] = [];
    const ups: THREE.Vector3[] = [];
    let up = new THREE.Vector3(0, 1, 0);
    for (let index = 0; index <= segments; index += 1) {
        const tangent = curve.getTangentAt(index / segments).normalize();
        // 직전 up 에서 진행 방향 성분을 제거 → 진행 방향이 바뀌어도 up 이 부드럽게 따라감
        up = up.clone().addScaledVector(tangent, -up.dot(tangent));
        if (up.lengthSq() < 1e-6) {
            up = new THREE.Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x);
        }
        up.normalize();
        tangents.push(tangent);
        ups.push(up);
    }
    return { closed, length: curve.getLength(), positions, tangents, ups };
}

const temp_side = new THREE.Vector3();
const temp_up = new THREE.Vector3();
const temp_tangent = new THREE.Vector3();
const temp_matrix = new THREE.Matrix4();

// 경로 위 u(0~1) 지점의 위치·방향을 샘플링
export function samplePath(frames: PathFrames, u: number, out_position: THREE.Vector3, out_tangent: THREE.Vector3, out_up: THREE.Vector3): void {
    const segments = frames.positions.length - 1;
    const wrapped = frames.closed ? ((u % 1) + 1) % 1 : THREE.MathUtils.clamp(u, 0, 1);
    const scaled = wrapped * segments;
    const index = Math.min(Math.floor(scaled), segments - 1);
    const ratio = scaled - index;
    out_position.lerpVectors(frames.positions[index], frames.positions[index + 1], ratio);
    out_tangent.lerpVectors(frames.tangents[index], frames.tangents[index + 1], ratio).normalize();
    out_up.lerpVectors(frames.ups[index], frames.ups[index + 1], ratio).normalize();
}

// 객체를 경로 위에 올림: 정면(+z) = 진행 방향, 위(+y) = 트랙 위쪽
export function placeOnPath(object: THREE.Object3D, frames: PathFrames, u: number, height_offset = 0): void {
    samplePath(frames, u, object.position, temp_tangent, temp_up);
    temp_side.crossVectors(temp_up, temp_tangent).normalize();
    temp_up.crossVectors(temp_tangent, temp_side).normalize();
    temp_matrix.makeBasis(temp_side, temp_up, temp_tangent);
    object.quaternion.setFromRotationMatrix(temp_matrix);
    object.position.addScaledVector(temp_up, height_offset);
}

// 높이에 따른 속도 (위치 에너지 → 운동 에너지 흉내): top_height 에서 가장 느리고 낮을수록 빠름
export function speedAtHeight(y: number, top_height: number, min_speed: number, scale: number): number {
    return Math.max(min_speed, Math.sqrt(2 * 9.8 * Math.max(top_height - y, 0)) * scale);
}

// 한 바퀴 시간표: 속도가 위치마다 다른 기구(코스터 등)도 "시각 → 경로 위치"를 계산할 수 있게 미리 한 바퀴를 시뮬레이션
// 모든 클라이언트가 같은 방 시각을 넣으면 같은 위치가 나오므로 기구 움직임이 서로 맞음
export interface LapTimeline {
    // 한 바퀴 걸리는 시간 (초)
    duration: number;
    // 시각(초) → 경로 위치 u (0~1)
    uAt(time: number): number;
}

const TIMELINE_STEP = 1 / 60;
const TIMELINE_MAX_SECONDS = 600;

export function buildLapTimeline(frames: PathFrames, speedAt: (position: THREE.Vector3, tangent: THREE.Vector3) => number): LapTimeline {
    const times: number[] = [0];
    const us: number[] = [0];
    const position = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const up = new THREE.Vector3();
    let u = 0;
    let time = 0;
    while (u < 1 && time < TIMELINE_MAX_SECONDS) {
        samplePath(frames, u, position, tangent, up);
        u += (Math.max(speedAt(position, tangent), 0.1) * TIMELINE_STEP) / frames.length;
        time += TIMELINE_STEP;
        times.push(time);
        us.push(Math.min(u, 1));
    }
    const duration = time;
    return {
        duration,
        uAt(at_time) {
            const local = ((at_time % duration) + duration) % duration;
            // 등간격 표본이라 위치를 바로 계산
            const scaled = local / TIMELINE_STEP;
            const index = Math.min(Math.floor(scaled), times.length - 2);
            const ratio = scaled - index;
            return us[index] + (us[index + 1] - us[index]) * ratio;
        },
    };
}

// 일정한 속도로 도는 경로의 위치 (시각의 순수 함수)
export function uAtConstantSpeed(frames: PathFrames, speed: number, time: number): number {
    return (((speed * time) / frames.length) % 1 + 1) % 1;
}

function sideOf(frames: PathFrames, index: number): THREE.Vector3 {
    return new THREE.Vector3().crossVectors(frames.ups[index], frames.tangents[index]).normalize();
}

// ───────── 레일·지지대·리본 ─────────

export interface RailOptions {
    gauge: number;
    radius: number;
    color: THREE.ColorRepresentation;
    // 침목 간격 (프레임 개수 단위, 0 이면 침목 없음)
    tie_every?: number;
    tie_color?: THREE.ColorRepresentation;
}

// 경로 좌우로 두 줄 레일 + 침목
export function createRails(frames: PathFrames, options: RailOptions): THREE.Group {
    const group = new THREE.Group();
    const count = frames.closed ? frames.positions.length - 1 : frames.positions.length;
    for (const direction of [-1, 1]) {
        const points: THREE.Vector3[] = [];
        for (let index = 0; index < count; index += 1) {
            points.push(frames.positions[index].clone().addScaledVector(sideOf(frames, index), (direction * options.gauge) / 2));
        }
        const rail_curve = new THREE.CatmullRomCurve3(points, frames.closed);
        const geometry = new THREE.TubeGeometry(rail_curve, count, options.radius, 6, frames.closed);
        addMesh(group, geometry, options.color);
    }
    const tie_every = options.tie_every ?? 0;
    if (tie_every > 0) {
        const tie_count = Math.floor(count / tie_every);
        const ties = new THREE.InstancedMesh(
            new THREE.BoxGeometry(options.gauge + 0.3, 0.1, 0.25),
            getMaterial(options.tie_color ?? options.color),
            tie_count,
        );
        const dummy = new THREE.Object3D();
        for (let order = 0; order < tie_count; order += 1) {
            placeOnPath(dummy, frames, (order * tie_every) / (frames.positions.length - 1), -0.12);
            dummy.updateMatrix();
            ties.setMatrixAt(order, dummy.matrix);
        }
        ties.castShadow = true;
        group.add(ties);
    }
    return group;
}

export interface SupportOptions {
    // 기둥 간격 (프레임 개수 단위)
    every: number;
    radius: number;
    color: THREE.ColorRepresentation;
    // 이 높이보다 낮은 지점에는 기둥을 세우지 않음
    min_height: number;
}

// 트랙 아래에서 땅까지 내려오는 기둥 (인스턴싱)
export function createSupports(frames: PathFrames, options: SupportOptions): THREE.InstancedMesh {
    const spots = frames.positions.filter((position, index) => index % options.every === 0 && position.y > options.min_height);
    const supports = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(options.radius, options.radius * 1.2, 1, 8),
        getMaterial(options.color),
        spots.length,
    );
    const dummy = new THREE.Object3D();
    spots.forEach((position, order) => {
        const height = position.y - 0.25;
        dummy.position.set(position.x, height / 2, position.z);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        supports.setMatrixAt(order, dummy.matrix);
    });
    supports.castShadow = true;
    return supports;
}

// 경로를 따라 펼친 평평한 띠 (물길·도로)
export function createRibbon(frames: PathFrames, width: number, color: THREE.ColorRepresentation, height_offset = 0): THREE.Mesh {
    const vertices: number[] = [];
    const indices: number[] = [];
    frames.positions.forEach((position, index) => {
        const side = sideOf(frames, index);
        const up = frames.ups[index];
        for (const direction of [-1, 1]) {
            const point = position.clone().addScaledVector(side, (direction * width) / 2).addScaledVector(up, height_offset);
            vertices.push(point.x, point.y, point.z);
        }
        if (index > 0) {
            const base = (index - 1) * 2;
            indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
        }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = getMaterial(color).clone();
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    return mesh;
}

// ───────── 좌석 카트 ─────────

export interface CartOptions {
    rows: number;
    cols: number;
    body_color: THREE.ColorRepresentation;
    seat_color?: THREE.ColorRepresentation;
    // 앞뒤 좌석 간격, 좌우 좌석 간격
    row_pitch?: number;
    col_pitch?: number;
}

export interface CartBuild {
    group: THREE.Group;
    // 앞줄 왼쪽부터 순서대로
    anchors: THREE.Object3D[];
}

// 좌석이 rows × cols 로 배치된 카트 (정면 +z)
export function createCart(options: CartOptions): CartBuild {
    const group = new THREE.Group();
    const row_pitch = options.row_pitch ?? 1.1;
    const col_pitch = options.col_pitch ?? 0.95;
    const seat_color = options.seat_color ?? "#3b3b48";
    const width = options.cols * col_pitch + 0.3;
    const length = options.rows * row_pitch + 0.5;
    addMesh(group, new THREE.BoxGeometry(width, 0.45, length), options.body_color, [0, 0.3, 0]);
    // 앞쪽 범퍼
    addMesh(group, new THREE.BoxGeometry(width, 0.55, 0.3), options.body_color, [0, 0.45, length / 2 - 0.05]);
    const anchors: THREE.Object3D[] = [];
    for (let row = 0; row < options.rows; row += 1) {
        for (let col = 0; col < options.cols; col += 1) {
            const x = (col - (options.cols - 1) / 2) * col_pitch;
            const z = ((options.rows - 1) / 2 - row) * row_pitch;
            addMesh(group, new THREE.BoxGeometry(col_pitch * 0.8, 0.18, row_pitch * 0.6), seat_color, [x, 0.6, z]);
            addMesh(group, new THREE.BoxGeometry(col_pitch * 0.8, 0.55, 0.1), seat_color, [x, 0.9, z - row_pitch * 0.32]);
            const anchor = new THREE.Object3D();
            anchor.position.set(x, 0.7, z);
            group.add(anchor);
            anchors.push(anchor);
        }
    }
    return { group, anchors };
}

// 기차·코스터처럼 여러 칸이 경로를 따라 일정 간격으로 이어 달리게 배치
export function placeTrain(cars: readonly THREE.Object3D[], frames: PathFrames, lead_u: number, car_gap: number, height_offset: number): void {
    cars.forEach((car, order) => {
        placeOnPath(car, frames, lead_u - (order * car_gap) / frames.length, height_offset);
    });
}

// 간단한 지붕 있는 승강장
export function createStation(width: number, depth: number, color: THREE.ColorRepresentation, roof_color: THREE.ColorRepresentation): THREE.Group {
    const group = new THREE.Group();
    addMesh(group, new THREE.BoxGeometry(width, 0.6, depth), color, [0, 0.3, 0]);
    for (const x of [-width / 2 + 0.4, width / 2 - 0.4]) {
        addMesh(group, new THREE.CylinderGeometry(0.15, 0.15, 3.6, 8), "#f5f5f5", [x, 2.1, -depth / 2 + 0.3]);
    }
    addMesh(group, new THREE.BoxGeometry(width + 0.6, 0.25, depth + 1.6), roof_color, [0, 3.95, 0.4]);
    return group;
}
