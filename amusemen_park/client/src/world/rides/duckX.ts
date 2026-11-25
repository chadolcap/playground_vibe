// DUCK-X — 긴 직선 체인 리프트와 77° 낙하, 연속 에어타임 언덕이 있는 대형 우든 코스터 (좌석 12 = 3칸 × 2열 × 2줄)
// 트랙 모양은 duckXTrack.ts (실제 기구의 구성 순서를 게임 크기로 줄여 설계)
import * as THREE from "three";
import { createGltfLoader } from "../gltfLoader";
import { RIDE_ID } from "@shared";
import {
    applyGlbToonMaterials,
    buildPathFrames,
    createCart,
    createRails,
    createStation,
    createThrill,
    getMaterial,
    placeOnPath,
    placeTrain,
    type PathFrames,
    type RideModel,
} from "./common";
import { buildCoasterTimeline } from "./ridePhysics";
import { createDuckXTrack } from "./duckXTrack";

const CAR_COUNT = 3;
const CAR_GAP = 2.9;
const GAUGE = 1.3;
const WOOD_COLOR = "#a47148";
const WOOD_DARK = "#7f5539";
const CHAIN_COLOR = "#3d405b";

// 목재 구조물(벤트): 일정 간격마다 트랙을 받치는 A자 틀 — 아래로 갈수록 넓어지고, 칸마다 X자 가새로 흔들림을 막음
const BENT_SPACING = 2.2;
const BENT_TOP_HALF = GAUGE / 2 + 0.35;
const BENT_SPREAD = 0.16;
const LEDGER_GAP = 2.6;
const MIN_BENT_HEIGHT = 2.6;

const Y_AXIS = new THREE.Vector3(0, 1, 0);

// Blender 로 만든 승강장·열차 칸 (scripts/duck_x_build.py) — 레일·목재 구조물·체인은 경로가 원본이라 코드로 둠
const MODEL_URL = `${import.meta.env.BASE_URL}models/duck_x.glb`;

// a → b 를 잇는 각목 하나의 인스턴스 행렬 (단위 상자를 늘리고 돌림)
function beamMatrix(a: THREE.Vector3, b: THREE.Vector3, thickness: number): THREE.Matrix4 {
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const rotation = new THREE.Quaternion().setFromUnitVectors(Y_AXIS, direction.divideScalar(length));
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    return new THREE.Matrix4().compose(center, rotation, new THREE.Vector3(thickness, length, thickness));
}

function createWoodStructure(frames: PathFrames): THREE.Group {
    const posts: THREE.Matrix4[] = [];
    const braces: THREE.Matrix4[] = [];
    const step = Math.max(1, Math.round(BENT_SPACING / (frames.length / (frames.positions.length - 1))));
    const side = new THREE.Vector3();
    // 각 높이에서 벤트 왼쪽·오른쪽 기둥 위치 (위는 트랙 폭, 아래로 갈수록 넓어짐)
    const pointAt = (position: THREE.Vector3, height: number, direction: number): THREE.Vector3 => {
        const half = BENT_TOP_HALF + (position.y - height) * BENT_SPREAD;
        return new THREE.Vector3(position.x + side.x * direction * half, height, position.z + side.z * direction * half);
    };
    for (let index = 0; index < frames.positions.length - 1; index += step) {
        const position = frames.positions[index];
        if (position.y < MIN_BENT_HEIGHT) {
            continue;
        }
        side.crossVectors(Y_AXIS, frames.tangents[index]).setY(0).normalize();
        const top = position.y - 0.35;
        for (const direction of [-1, 1]) {
            posts.push(beamMatrix(pointAt(position, 0, direction), pointAt(position, top, direction), 0.26));
        }
        // 가로 보(레저)와 그 사이 X자 가새
        let lower = 0;
        for (let height = LEDGER_GAP; lower < top - 0.5; height += LEDGER_GAP) {
            const upper = Math.min(height, top);
            posts.push(beamMatrix(pointAt(position, upper, -1), pointAt(position, upper, 1), 0.2));
            braces.push(beamMatrix(pointAt(position, lower, -1), pointAt(position, upper, 1), 0.12));
            braces.push(beamMatrix(pointAt(position, lower, 1), pointAt(position, upper, -1), 0.12));
            lower = upper;
        }
    }
    const group = new THREE.Group();
    for (const [matrices, color] of [[posts, WOOD_COLOR], [braces, WOOD_DARK]] as const) {
        const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), getMaterial(color), matrices.length);
        matrices.forEach((matrix, order) => mesh.setMatrixAt(order, matrix));
        mesh.castShadow = true;
        group.add(mesh);
    }
    return group;
}

// 리프트 오르막 가운데의 체인 (가장 높은 지점 앞의 가파른 오르막에만)
function createLiftChain(frames: PathFrames): THREE.InstancedMesh {
    const last = frames.positions.length - 1;
    let top = 0;
    frames.positions.forEach((position, index) => {
        if (position.y > frames.positions[top].y) {
            top = index;
        }
    });
    let start = top;
    while (start > 0 && frames.positions[start - 1].y < frames.positions[start].y + 1e-3 && frames.positions[start - 1].y > 2.4) {
        start -= 1;
    }
    const link_spacing = 0.5;
    const count = Math.max(1, Math.floor(((top - start) / last) * frames.length / link_spacing));
    const chain = new THREE.InstancedMesh(new THREE.BoxGeometry(0.22, 0.08, 0.32), getMaterial(CHAIN_COLOR), count);
    const dummy = new THREE.Object3D();
    for (let order = 0; order < count; order += 1) {
        placeOnPath(dummy, frames, (start + ((top - start) * order) / count) / last, -0.08);
        dummy.updateMatrix();
        chain.setMatrixAt(order, dummy.matrix);
    }
    return chain;
}

export function createDuckX(): RideModel {
    const root = new THREE.Group();
    const frames = buildPathFrames(createDuckXTrack().curve, 900, true);
    // 승강장 정차 → 체인 리프트로 천천히 꼭대기까지 → 77° 낙하는 실제 중력 가속 → 언덕 → 브레이크 → 정차 (한 바퀴 시간표)
    // 목재 코스터라 고속에서 덜컹거림이 큼. 계산한 속도로 트랙 기울기(뱅크)도 정하므로 레일보다 먼저 만듦
    const timeline = buildCoasterTimeline(frames, { chain_speed: 3.2, station_speed: 4, brake_speed: 3, dwell_seconds: 6, brake_decel: 7, shake: 1 });
    const thrill = createThrill();

    root.add(createRails(frames, { gauge: GAUGE, radius: 0.13, color: "#6c757d", tie_every: 2, tie_color: WOOD_DARK }));
    root.add(createWoodStructure(frames));
    root.add(createLiftChain(frames));

    // 승강장: 트랙(z 6.3) 바로 앞, 게이트 쪽
    const station = createStation(24, 3, "#d4a373", "#264653");
    station.position.set(1.8, 0, 8.9);
    root.add(station);

    const cars: THREE.Group[] = [];
    const seat_anchors: THREE.Object3D[] = [];
    for (let order = 0; order < CAR_COUNT; order += 1) {
        const cart = createCart({ rows: 2, cols: 2, body_color: order === 0 ? "#2a9d8f" : "#40b5a6" });
        cars.push(cart.group);
        seat_anchors.push(...cart.anchors);
        root.add(cart.group);
    }

    // GLB 로 바꿔 끼움: 승강장·카트의 코드 도형은 숨기기만 함 (치수가 같아 바닥 높이 지도는 그대로)
    const placeholders: THREE.Object3D[] = [];
    for (const group of [station, ...cars]) {
        group.traverse((node) => {
            if (node instanceof THREE.Mesh) {
                placeholders.push(node);
            }
        });
    }
    createGltfLoader().loadAsync(MODEL_URL).then(
        (gltf) => {
            const station_model = gltf.scene.getObjectByName("dx_station");
            const front_model = gltf.scene.getObjectByName("dx_car_front");
            const car_model = gltf.scene.getObjectByName("dx_car");
            if (station_model === undefined || front_model === undefined || car_model === undefined) {
                console.warn("[duck_x] GLB 에 필요한 객체가 없어 코드 모델을 그대로 씁니다.");
                return;
            }
            for (const model of [station_model, front_model, car_model]) {
                applyGlbToonMaterials(model);
                model.position.set(0, 0, 0);
            }
            for (const node of placeholders) {
                node.visible = false;
            }
            station.add(station_model);
            cars.forEach((car, order) => {
                car.add(order === 0 ? front_model : order === 1 ? car_model : car_model.clone());
            });
        },
        (error: unknown) => console.warn("[duck_x] GLB 를 불러오지 못해 코드 모델을 씁니다.", error),
    );

    return {
        id: RIDE_ID.DUCK_X,
        root,
        seat_anchors,
        thrill,
        update(time) {
            placeTrain(cars, frames, timeline.uAt(time), CAR_GAP, 0.15);
            timeline.thrillAt(time, thrill);
        },
    };
}
