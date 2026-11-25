// CRAZY BUMP — 지붕 있는 경기장 안을 1인승 차 8대가 돌아다님 (좌석 8)
// 접속 중에는 서버 물리(충돌·조종) 결과 위치로 그리고, 그 전에는 자체 경로로 돌아다님
// 모양: Blender 로 만든 models/crazy_bump.glb (scripts/crazy_bump_build.py 경기장 + 생성 CRAZY BUMP) 를 불러와 바꿔 끼움
//   불러오기 전·실패 시에는 아래 코드 도형이 보임 — 경기장 치수가 같아 바닥 높이·충돌 지도는 어느 쪽이든 맞음
import * as THREE from "three";
import { createGltfLoader } from "../gltfLoader";
import { CRAZY_BUMP, RIDE_ID } from "@shared";
import { addMesh, applyGlbToonMaterials, getToonGradient, type RideModel } from "./common";

const MODEL_URL = `${import.meta.env.BASE_URL}models/crazy_bump.glb`;
// 생성 CRAZY BUMP의 좌석 윗면·뒤 안테나 끝 (차 로컬, Blender 에서 잰 값) — 전기 막대는 안테나 끝에서 천장까지
const GLB_SEAT = new THREE.Vector3(0, 0.73, -0.2);
const POLE_Z = -0.73;
const POLE_BOTTOM = 1.67;
// 다시 칠한 차 텍스처 크기 (8장)
const CAR_TEXTURE_SIZE = 512;

const ARENA_WIDTH = CRAZY_BUMP.ARENA_WIDTH;
const ARENA_DEPTH = CRAZY_BUMP.ARENA_DEPTH;
const ROOF_HEIGHT = 5.2;
const CAR_COLORS = ["#ef476f", "#ffd166", "#06d6a0", "#118ab2", "#f78c6b", "#9b5de5", "#00bbf9", "#f15bb5"];

interface CarMotion {
    group: THREE.Group;
    // 리사주 곡선 매개변수 (서로 다른 경로로 돌아다니게)
    freq_x: number;
    freq_z: number;
    phase_x: number;
    phase_z: number;
}

export function createCrazyBump(): CrazyBumpCarModel {
    const root = new THREE.Group();

    // 바닥·지붕·기둥
    addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH, 0.3, ARENA_DEPTH), "#4a4e69", [0, 0.15, 0]);
    // 지붕은 반투명 차양 — 위에서 구경하는 사람도 안에서 CRAZY BUMP가 부딪히는 모습을 볼 수 있게
    const canopy = addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH + 1, 0.3, ARENA_DEPTH + 1), "#ff8fab", [0, ROOF_HEIGHT + 0.15, 0]);
    const canopy_material = (canopy.material as THREE.MeshToonMaterial).clone();
    canopy_material.transparent = true;
    canopy_material.opacity = 0.28;
    canopy_material.depthWrite = false;
    canopy.material = canopy_material;
    canopy.castShadow = false;
    for (const x of [-ARENA_WIDTH / 2, ARENA_WIDTH / 2]) {
        for (const z of [-ARENA_DEPTH / 2, ARENA_DEPTH / 2]) {
            addMesh(root, new THREE.CylinderGeometry(0.25, 0.25, ROOF_HEIGHT, 10), "#ffd60a", [x, ROOF_HEIGHT / 2, z]);
        }
    }
    // 낮은 울타리 (정면 가운데는 출입구)
    addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH, 0.8, 0.2), "#ffd60a", [0, 0.6, -ARENA_DEPTH / 2]);
    for (const x of [-ARENA_WIDTH / 2, ARENA_WIDTH / 2]) {
        addMesh(root, new THREE.BoxGeometry(0.2, 0.8, ARENA_DEPTH), "#ffd60a", [x, 0.6, 0]);
    }
    for (const x of [-(ARENA_WIDTH / 4 + 1), ARENA_WIDTH / 4 + 1]) {
        addMesh(root, new THREE.BoxGeometry(ARENA_WIDTH / 2 - 2, 0.8, 0.2), "#ffd60a", [x, 0.6, ARENA_DEPTH / 2]);
    }

    const seat_anchors: THREE.Object3D[] = [];
    const cars: CarMotion[] = CAR_COLORS.map((color, index) => {
        const group = new THREE.Group();
        addMesh(group, new THREE.CylinderGeometry(1.05, 1.05, 0.35, 16), "#212529", [0, 0.45, 0]);
        addMesh(group, new THREE.BoxGeometry(1.5, 0.5, 1.8), color, [0, 0.8, 0]);
        addMesh(group, new THREE.BoxGeometry(1.2, 0.6, 0.2), color, [0, 1.2, -0.75]);
        // 천장 전기 막대 (차 뒤 안테나 끝 — 앉은 오리 머리와 겹치지 않게), GLB 로 바꿔도 그대로 씀
        const pole = addMesh(group, new THREE.CylinderGeometry(0.04, 0.04, ROOF_HEIGHT - POLE_BOTTOM, 6), "#adb5bd", [0, POLE_BOTTOM + (ROOF_HEIGHT - POLE_BOTTOM) / 2, POLE_Z]);
        pole.userData.keep_with_glb = true;
        const anchor = new THREE.Object3D();
        anchor.position.set(0, 1.05, 0.05);
        group.add(anchor);
        seat_anchors.push(anchor);
        root.add(group);
        return {
            group,
            freq_x: 0.35 + index * 0.045,
            freq_z: 0.5 + ((index * 3) % 8) * 0.04,
            phase_x: index * 0.9,
            phase_z: index * 1.7,
        };
    });

    // GLB 로 바꿔 끼움: 코드 도형은 숨기기만 함 (전기 막대는 남김)
    const placeholders: THREE.Object3D[] = [];
    root.traverse((node) => {
        if (node instanceof THREE.Mesh && node.userData.keep_with_glb !== true) {
            placeholders.push(node);
        }
    });
    createGltfLoader().loadAsync(MODEL_URL).then(
        (gltf) => {
            const arena = gltf.scene.getObjectByName("crazy_bump_arena");
            const car_model = gltf.scene.getObjectByName("crazy_bump_car");
            if (arena === undefined || !(car_model instanceof THREE.Mesh)) {
                console.warn("[crazy_bump] GLB 에 필요한 객체가 없어 코드 모델을 그대로 씁니다.");
                return;
            }
            applyGlbToonMaterials(arena);
            for (const node of placeholders) {
                node.visible = false;
            }
            root.add(arena);
            const source = (car_model.material as THREE.MeshStandardMaterial).map;
            const textures = source === null ? null : createCarTextures(source);
            cars.forEach((car, index) => {
                const map = textures?.[index] ?? source;
                const mesh = new THREE.Mesh(car_model.geometry, new THREE.MeshToonMaterial({ map, gradientMap: getToonGradient() }));
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                car.group.add(mesh);
                // 생성 차의 좌석은 코드 차보다 낮고 조금 뒤 — 탑승자 자리를 옮김
                seat_anchors[index].position.copy(GLB_SEAT);
            });
        },
        (error: unknown) => console.warn("[crazy_bump] GLB 를 불러오지 못해 코드 모델을 씁니다.", error),
    );

    const range_x = ARENA_WIDTH / 2 - 1.6;
    const range_z = ARENA_DEPTH / 2 - 1.6;
    // 서버 물리 위치를 받기 시작하면 자체 경로(리사주) 대신 그 위치로 그림
    let is_network_driven = false;
    // 차별 충돌 반동 (시작 시각 ms, 세기, 기울어질 방향)
    const bumps = cars.map(() => ({ start: -Infinity, strength: 0, side: 1 }));

    // 부딪힌 차가 살짝 튀어 오르며 흔들림 (시각 효과만, 0.45초)
    function applyBumpEffects(): void {
        const now = performance.now();
        cars.forEach((car, index) => {
            const bump = bumps[index];
            const elapsed = (now - bump.start) / 1000;
            const amount = elapsed < BUMP_DURATION ? Math.sin((elapsed / BUMP_DURATION) * Math.PI) * Math.min(bump.strength / 6, 1) : 0;
            car.group.position.y = amount * 0.35;
            car.group.rotation.z = amount * 0.22 * bump.side;
            car.group.rotation.x = -amount * 0.12;
        });
    }

    const model: CrazyBumpCarModel = {
        id: RIDE_ID.CRAZY_BUMP,
        root,
        seat_anchors,
        update(time) {
            if (is_network_driven) {
                return;
            }
            for (const car of cars) {
                const angle_x = car.freq_x * time + car.phase_x;
                const angle_z = car.freq_z * time + car.phase_z;
                car.group.position.set(Math.sin(angle_x) * range_x, 0, Math.sin(angle_z) * range_z);
                // 진행 방향 = 위치의 미분
                const velocity_x = Math.cos(angle_x) * car.freq_x * range_x;
                const velocity_z = Math.cos(angle_z) * car.freq_z * range_z;
                car.group.rotation.y = Math.atan2(velocity_x, velocity_z);
            }
            applyBumpEffects();
        },
        applyCarPoses(poses) {
            is_network_driven = true;
            poses.forEach((pose, index) => {
                const car = cars[index];
                if (car !== undefined) {
                    car.group.position.set(pose.x, 0, pose.z);
                    car.group.rotation.y = pose.heading;
                }
            });
            applyBumpEffects();
        },
        bump(index, strength) {
            if (bumps[index] !== undefined) {
                bumps[index] = { start: performance.now(), strength, side: Math.random() < 0.5 ? -1 : 1 };
            }
        },
    };
    return model;
}

const BUMP_DURATION = 0.45;

// 생성 차 텍스처를 차마다 다른 색으로 다시 칠함 — 밝고 채도 낮은 차체(흰색·옅은 하늘색)만 그 차 색으로,
// 어두운 고무 범퍼·좌석과 분홍 뒷등은 그대로 (명암 = 픽셀 밝기 / 차체 평균 밝기)
function createCarTextures(source: THREE.Texture): THREE.Texture[] | null {
    const image = source.image as CanvasImageSource | undefined;
    const canvas = document.createElement("canvas");
    canvas.width = CAR_TEXTURE_SIZE;
    canvas.height = CAR_TEXTURE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (image === undefined || context === null) {
        return null;
    }
    context.drawImage(image, 0, 0, CAR_TEXTURE_SIZE, CAR_TEXTURE_SIZE);
    const original = context.getImageData(0, 0, CAR_TEXTURE_SIZE, CAR_TEXTURE_SIZE);
    const pixel_count = CAR_TEXTURE_SIZE * CAR_TEXTURE_SIZE;
    const body_weight = new Float32Array(pixel_count);
    const value = new Float32Array(pixel_count);
    let body_sum = 0;
    let body_total = 0;
    for (let index = 0; index < pixel_count; index += 1) {
        const r = original.data[index * 4] / 255;
        const g = original.data[index * 4 + 1] / 255;
        const b = original.data[index * 4 + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 0 ? (max - min) / max : 0;
        // 분홍·빨강 계열(뒷등)은 칠하지 않음
        const warm = r >= g && r >= b && saturation > 0.12 ? 1 : 0;
        const weight = smoothStep(0.5, 0.65, max) * (1 - smoothStep(0.3, 0.45, saturation)) * (1 - warm);
        body_weight[index] = weight;
        value[index] = max;
        body_sum += max * weight;
        body_total += weight;
    }
    const body_average = body_sum / Math.max(body_total, 1);
    return CAR_COLORS.map((hex) => {
        const color = new THREE.Color(hex).convertLinearToSRGB();
        const output = context.createImageData(CAR_TEXTURE_SIZE, CAR_TEXTURE_SIZE);
        for (let index = 0; index < pixel_count; index += 1) {
            const weight = body_weight[index];
            const shade = value[index] / body_average;
            const channels = [color.r, color.g, color.b];
            for (let channel = 0; channel < 3; channel += 1) {
                const tinted = Math.min(1, channels[channel] * shade) * 255;
                output.data[index * 4 + channel] = tinted * weight + original.data[index * 4 + channel] * (1 - weight);
            }
            output.data[index * 4 + 3] = 255;
        }
        const target = document.createElement("canvas");
        target.width = CAR_TEXTURE_SIZE;
        target.height = CAR_TEXTURE_SIZE;
        target.getContext("2d")?.putImageData(output, 0, 0);
        const texture = new THREE.CanvasTexture(target);
        texture.colorSpace = THREE.SRGBColorSpace;
        // glTF 텍스처는 위아래를 뒤집지 않음 (원본과 같은 UV)
        texture.flipY = false;
        return texture;
    });
}

function smoothStep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

export interface CrazyBumpCarPose {
    x: number;
    z: number;
    heading: number;
}

export interface CrazyBumpCarModel extends RideModel {
    // 서버 물리 결과(CRAZY BUMP 로컬 좌표)로 차를 배치 — 매 프레임 기구 갱신 뒤 호출
    applyCarPoses(poses: readonly CrazyBumpCarPose[]): void;
    // 충돌 반동 연출
    bump(index: number, strength: number): void;
}

export function isCrazyBumpCarModel(model: RideModel | undefined): model is CrazyBumpCarModel {
    return model !== undefined && "applyCarPoses" in model;
}
