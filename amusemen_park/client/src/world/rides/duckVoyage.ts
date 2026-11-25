// DUCK VOYAGE — 커다란 범선이 두 A자 탑 사이의 축에 매달려 진자처럼 앞뒤로 크게 흔들리는 스윙 보트 (좌석 10 = 5줄 × 2)
// 배는 길이 방향(x)으로 흔들리고, 축은 폭 방향(z). 배 양 끝 줄이 가장 높이 올라가 가장 무서운 자리
// 좌석 번호 순서: 양 끝 줄(0~3) → 그 안쪽 줄(4~7) → 가운데 줄(8·9) — 서버가 앞 번호부터 앉히므로 양 끝부터 참
// 모양: Blender 로 만든 models/duck_voyage.glb (scripts/duck_voyage_build.py 구조물 + 생성 오리 조각상) 를 불러와 바꿔 끼움
//   불러오기 전·실패 시에는 아래 코드 도형이 보임 — 치수·좌석 자리가 같아 바닥 높이·충돌 지도는 어느 쪽이든 맞음
import * as THREE from "three";
import { createGltfLoader } from "../gltfLoader";
import { RIDE_ID } from "@shared";
import { addMesh, applyGlbToonMaterials, createThrill, type RideModel } from "./common";
import { createPendulumProgram } from "./ridePhysics";

const MODEL_URL = `${import.meta.env.BASE_URL}models/duck_voyage.glb`;

// 축 높이와 축~배 중심 거리 — 배 끝 바닥이 흔들려도 땅에 닿지 않도록 √(팔² + 배 반길이²) + 선체 깊이 < 축 높이
const PIVOT_HEIGHT = 12.8;
const ARM_LENGTH = 8.5;
const HULL_LENGTH = 14.4;
const HULL_WIDTH = 3.7;
// 선체 모양: 가운데 바닥 깊이, 갑판 테두리 높이, 양 끝이 솟는 높이(현호), 끝으로 갈수록 좁아지는 정도
const HULL_DEPTH = 1.3;
const HULL_RAIL = 1.05;
const HULL_SHEER = 1.9;
const HULL_SECTIONS = 48;
const HULL_PROFILE_POINTS = 10;
// 좌석 줄 위치 (배 길이 방향) — 순서가 곧 좌석 번호 순서
const ROW_ORDER = [-5.2, 5.2, -2.6, 2.6, 0];
const SEAT_SIDE = 0.75;
const DECK_HEIGHT = 0.82;
// A자 탑 위치 (선체 바깥 양옆)
const TOWER_Z = 2.6;
const TOWER_FOOT_X = 4.5;

const HULL_COLOR = "#8b5a2b";
const HULL_DARK = "#6b4423";
const STRIPE_COLOR = "#c1121f";
const DECK_COLOR = "#deb887";
const SEAT_COLOR = "#264653";
const TOWER_COLOR = "#457b9d";

// a → b 를 잇는 각목 (단위 상자를 늘리고 돌림)
function addBeam(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, thickness: number, color: string): void {
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const mesh = addMesh(parent, new THREE.BoxGeometry(thickness, length, thickness), color);
    mesh.position.addVectors(a, b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.divideScalar(length));
}

// 길이 방향 위치 x 에서의 선체 치수 — 양 끝(|x| = 반길이)에서 폭이 0 이 되어 뾰족해지고, 테두리는 위로 솟고, 바닥은 얕아짐
function hullAt(x: number): { half_width: number; top: number; bottom: number } {
    const t = Math.min(Math.abs(x) / (HULL_LENGTH / 2), 1);
    return {
        half_width: (HULL_WIDTH / 2) * Math.sqrt(Math.max(1 - t ** 2.4, 0)),
        top: HULL_RAIL + HULL_SHEER * t ** 2.6,
        bottom: -HULL_DEPTH * (1 - t ** 2) + HULL_SHEER * 0.35 * t ** 3,
    };
}

// 선체 바깥면: 길이 방향 단면(U자)을 이어 붙인 곡면
function createHullGeometry(): THREE.BufferGeometry {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let section = 0; section <= HULL_SECTIONS; section += 1) {
        const x = -HULL_LENGTH / 2 + (section / HULL_SECTIONS) * HULL_LENGTH;
        const { half_width, top, bottom } = hullAt(x);
        for (let point = 0; point <= HULL_PROFILE_POINTS; point += 1) {
            // 왼쪽 테두리 → 바닥 → 오른쪽 테두리 (둥근 U자)
            const angle = (point / HULL_PROFILE_POINTS) * Math.PI;
            const z = -half_width * Math.cos(angle);
            const y = top - (top - bottom) * Math.sin(angle) ** 0.7;
            vertices.push(x, y, z);
        }
    }
    const row = HULL_PROFILE_POINTS + 1;
    for (let section = 0; section < HULL_SECTIONS; section += 1) {
        for (let point = 0; point < HULL_PROFILE_POINTS; point += 1) {
            const a = section * row + point;
            const b = a + row;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

// 선체 테두리를 따라 두르는 띠 (높이 from~to, 바깥으로 조금 띄움) / 갑판 (평평한 판)
function createHullBand(from: number, to: number, offset: number): THREE.BufferGeometry {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let section = 0; section <= HULL_SECTIONS; section += 1) {
        const x = -HULL_LENGTH / 2 + (section / HULL_SECTIONS) * HULL_LENGTH;
        const { half_width, top } = hullAt(x);
        for (const side of [-1, 1]) {
            const z = side * (half_width + offset);
            vertices.push(x, top - from, z, x, top - to, z);
        }
    }
    for (let section = 0; section < HULL_SECTIONS; section += 1) {
        for (const side of [0, 2]) {
            const a = section * 4 + side;
            const b = a + 4;
            indices.push(a, a + 1, b, b, a + 1, b + 1);
        }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

function createDeckGeometry(height: number, inset: number): THREE.BufferGeometry {
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let section = 0; section <= HULL_SECTIONS; section += 1) {
        const x = -HULL_LENGTH / 2 + (section / HULL_SECTIONS) * HULL_LENGTH;
        const half_width = Math.max(hullAt(x).half_width - inset, 0);
        vertices.push(x, height, -half_width, x, height, half_width);
    }
    for (let section = 0; section < HULL_SECTIONS; section += 1) {
        const a = section * 2;
        indices.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
}

// 양면을 그리는 재질로 메쉬 추가 (곡면을 한 겹으로 만들었으므로 안쪽에서도 보이게)
function addDoubleSided(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: string): THREE.Mesh {
    const mesh = addMesh(parent, geometry, color);
    const material = (mesh.material as THREE.MeshToonMaterial).clone();
    material.side = THREE.DoubleSide;
    mesh.material = material;
    return mesh;
}

function createShip(seat_anchors: THREE.Object3D[]): THREE.Group {
    const ship = new THREE.Group();
    // 선체: 양 끝이 뾰족하고 위로 솟은 곡면 + 붉은 띠 + 갑판
    addDoubleSided(ship, createHullGeometry(), HULL_COLOR);
    addDoubleSided(ship, createHullBand(0.35, 0.6, 0.03), STRIPE_COLOR);
    addDoubleSided(ship, createHullBand(0, 0.12, 0.04), HULL_DARK);
    addDoubleSided(ship, createDeckGeometry(DECK_HEIGHT, 0.15), DECK_COLOR);
    for (const direction of [-1, 1]) {
        // 깃대와 깃발 (솟은 이물·고물 위)
        const pole_x = direction * (HULL_LENGTH / 2 - 1.4);
        const pole_base = hullAt(pole_x).top;
        addMesh(ship, new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), "#f1faee", [pole_x, pole_base + 1.2, 0]);
        addMesh(ship, new THREE.BoxGeometry(1, 0.6, 0.05), direction > 0 ? "#e63946" : "#ffb703", [pole_x - direction * 0.5, pole_base + 2, 0]);
    }
    // 뱃머리 끝에서 앞으로 뻗은 기움 돛대 (+x 쪽)
    const bow = hullAt(HULL_LENGTH / 2);
    addMesh(ship, new THREE.CylinderGeometry(0.06, 0.1, 2.2, 8), "#ffb703", [HULL_LENGTH / 2 + 0.7, bow.top - 0.3, 0], [0, 0, -Math.PI / 2 + 0.35]);

    // 좌석: 가운데를 바라보게 (가운데 줄은 +x 쪽)
    for (const row_x of ROW_ORDER) {
        const facing = row_x > 0 ? -Math.PI / 2 : Math.PI / 2;
        for (const side of [-SEAT_SIDE, SEAT_SIDE]) {
            const seat = new THREE.Group();
            seat.position.set(row_x, DECK_HEIGHT, side);
            seat.rotation.y = facing;
            ship.add(seat);
            addMesh(seat, new THREE.BoxGeometry(0.7, 0.2, 0.65), SEAT_COLOR, [0, 0.12, 0]);
            addMesh(seat, new THREE.BoxGeometry(0.7, 0.6, 0.1), SEAT_COLOR, [0, 0.45, -0.3]);
            const anchor = new THREE.Object3D();
            anchor.position.set(0, 0.25, 0);
            seat.add(anchor);
            seat_anchors.push(anchor);
        }
    }
    return ship;
}

export function createDuckVoyage(): RideModel {
    const root = new THREE.Group();

    // 바닥과 울타리 (게이트 쪽 +z 는 비워 둠)
    addMesh(root, new THREE.CylinderGeometry(11.5, 11.8, 0.3, 40), "#e9d8a6", [0, 0.15, 0]);
    for (let index = 0; index < 28; index += 1) {
        const angle = (index / 28) * Math.PI * 2;
        if (Math.abs(angle - Math.PI / 2) < 0.35) {
            continue;
        }
        addMesh(root, new THREE.BoxGeometry(0.18, 1.1, 0.18), "#7f5539", [Math.cos(angle) * 11.2, 0.85, Math.sin(angle) * 11.2]);
    }

    // A자 탑 두 개 + 꼭대기 축
    for (const z of [-TOWER_Z, TOWER_Z]) {
        const top = new THREE.Vector3(0, PIVOT_HEIGHT, z);
        for (const x of [-TOWER_FOOT_X, TOWER_FOOT_X]) {
            addBeam(root, new THREE.Vector3(x, 0, z * 1.35), top, 0.55, TOWER_COLOR);
        }
        addBeam(root, new THREE.Vector3(-TOWER_FOOT_X * 0.55, PIVOT_HEIGHT * 0.45, z * 1.2), new THREE.Vector3(TOWER_FOOT_X * 0.55, PIVOT_HEIGHT * 0.45, z * 1.2), 0.3, TOWER_COLOR);
    }
    addMesh(root, new THREE.CylinderGeometry(0.4, 0.4, TOWER_Z * 2 + 0.8, 14), "#adb5bd", [0, PIVOT_HEIGHT, 0], [Math.PI / 2, 0, 0]);

    // 흔들리는 부분: 축 → 팔 4개 → 배
    const swing = new THREE.Group();
    swing.position.set(0, PIVOT_HEIGHT, 0);
    root.add(swing);
    for (const z of [-1.4, 1.4]) {
        for (const x of [-2.4, 2.4]) {
            addBeam(swing, new THREE.Vector3(0, 0, z), new THREE.Vector3(x, -ARM_LENGTH + 0.8, z), 0.28, "#e9ecef");
        }
    }
    const seat_anchors: THREE.Object3D[] = [];
    const ship = createShip(seat_anchors);
    ship.position.set(0, -ARM_LENGTH, 0);
    swing.add(ship);

    // 운행 사이클: 승하차(정지) → 박자 맞춰 밀어 진폭을 키움 → 최고 75° → 서서히 줄여 정지
    // 흔들림 주기는 팔 길이로 정해지는 진자 주기를 따르고, 꼭대기에서 멈칫할 때 몸이 붕 뜸
    const program = createPendulumProgram({
        arm_length: ARM_LENGTH,
        max_angle: THREE.MathUtils.degToRad(75),
        load_seconds: 8,
        pump_seconds: 18,
        peak_seconds: 16,
        decay_seconds: 12,
        wheel_spin: 0,
    });
    const thrill = createThrill();

    // GLB 로 바꿔 끼움: 코드 도형은 숨기기만 함 (바닥 높이 지도가 이미 이 도형을 기준으로 잡았을 수 있음 — 치수 동일)
    const placeholders: THREE.Object3D[] = [];
    root.traverse((node) => {
        if (node instanceof THREE.Mesh) {
            placeholders.push(node);
        }
    });
    createGltfLoader().loadAsync(MODEL_URL).then(
        (gltf) => {
            const base = gltf.scene.getObjectByName("duck_voyage_base");
            const swing_model = gltf.scene.getObjectByName("duck_voyage_swing");
            if (base === undefined || swing_model === undefined) {
                console.warn("[duck_voyage] GLB 에 필요한 객체가 없어 코드 모델을 그대로 씁니다.");
                return;
            }
            applyGlbToonMaterials(base);
            applyGlbToonMaterials(swing_model);
            for (const node of placeholders) {
                node.visible = false;
            }
            root.add(base);
            // Blender 에서는 축 높이에 둔 빈 객체 — 자식이 축 기준 좌표라 swing 그룹(축 위치·흔들림)에 그대로 붙임
            swing_model.position.set(0, 0, 0);
            swing.add(swing_model);
        },
        (error: unknown) => console.warn("[duck_voyage] GLB 를 불러오지 못해 코드 모델을 씁니다.", error),
    );

    return {
        id: RIDE_ID.DUCK_VOYAGE,
        root,
        seat_anchors,
        thrill,
        update(time) {
            swing.rotation.z = program.angleAt(time);
            program.thrillAt(time, thrill);
        },
    };
}
