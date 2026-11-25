// 회전목마 — 줄무늬 천막 지붕 아래 원판이 돌고, 목마 12마리가 기둥을 따라 오르내림 (좌석 12)
// 모양: Blender 로 만든 models/carousel.glb (scripts/carousel_build.py 구조물 + 생성 목마) 를 불러와 바꿔 끼움
//   불러오기 전·실패 시에는 아래 코드 도형이 보임 — 치수가 같아 바닥 높이·충돌 지도는 어느 쪽이든 맞음
import * as THREE from "three";
import { createGltfLoader } from "../gltfLoader";
import { RIDE_ID } from "@shared";
import { addMesh, applyGlbToonMaterials, getMaterial, getToonGradient, type RideModel } from "./common";

const MODEL_URL = `${import.meta.env.BASE_URL}models/carousel.glb`;
// 목마마다 다른 색 조합 (좌석 순서대로) — 생성 텍스처를 몸통·갈기(꼬리·발굽·고삐)·안장 영역으로 나눠 이 색으로 다시 칠함
const HORSE_PALETTES: readonly { body: string; mane: string; saddle: string }[] = [
    { body: "#fffaf3", mane: "#ff8fab", saddle: "#9ad1ff" }, // 흰 말
    { body: "#ffd6e0", mane: "#ff5d8f", saddle: "#ffe066" }, // 분홍 말
    { body: "#d9c8ff", mane: "#8e6cff", saddle: "#ffb3c6" }, // 보라 말
    { body: "#c8f0dc", mane: "#2fa877", saddle: "#ffd6a5" }, // 민트 말
    { body: "#cfe8ff", mane: "#4d96ff", saddle: "#fff1a8" }, // 하늘 말
    { body: "#fff1b8", mane: "#f4a300", saddle: "#c77dff" }, // 노랑 말
    { body: "#ffd8b8", mane: "#ff7f50", saddle: "#7bdff2" }, // 살구 말
    { body: "#c9a27e", mane: "#6b4226", saddle: "#e63946" }, // 밤색 말
    { body: "#5f5873", mane: "#f8f8ff", saddle: "#ff8fab" }, // 흑마 (흰 갈기)
    { body: "#e4e4e8", mane: "#8a8a99", saddle: "#4d96ff" }, // 회색 말
    { body: "#ffe0f0", mane: "#c77dff", saddle: "#7bc96f" }, // 연분홍·보라 갈기
    { body: "#f3e5d8", mane: "#c08552", saddle: "#2a9d8f" }, // 베이지 말
];
// 다시 칠한 텍스처 크기 (12장 — 원본 1024 보다 작게 해서 그래픽 메모리 절약)
const HORSE_TEXTURE_SIZE = 512;

const SEAT_COUNT = 12;
const PLATFORM_RADIUS = 6.6;
const HORSE_RADIUS = 5;
const ROOF_HEIGHT = 5.2;
const ROOF_RADIUS = 7.6;
// 한 바퀴 시간(초) — 바깥 목마 속도 약 2.6m/s 로 아이도 편하게
const LAP_SECONDS = 12;
// 운행 사이클(초): 승하차 정지 → 천천히 출발 → 일정하게 돎 → 천천히 멈춤
const LOAD_SECONDS = 10;
const RAMP_SECONDS = 5;
const RUN_SECONDS = 36;
const CYCLE_SECONDS = LOAD_SECONDS + RAMP_SECONDS * 2 + RUN_SECONDS;
// 목마가 오르내리는 높이와 한 바퀴에 오르내리는 횟수
const BOB_HEIGHT = 0.35;
const BOBS_PER_LAP = 4;

const HORSE_COLORS = ["#ffffff", "#f6d6ad", "#cdb4db", "#ffc8dd", "#bde0fe", "#fff1a8"];
const SADDLE_COLORS = ["#e63946", "#3a86ff", "#ffb703", "#8338ec"];

// 원판 회전각 — 방 시각만으로 계산 (출발·정지 구간은 각속도가 선형으로 변해 각도는 2차식)
function platformAngle(time: number): { angle: number; speed_ratio: number } {
    const omega = (Math.PI * 2) / LAP_SECONDS;
    const lap_angle = omega * (RAMP_SECONDS + RUN_SECONDS);
    const cycle = Math.floor(time / CYCLE_SECONDS);
    const local = time - cycle * CYCLE_SECONDS;
    let angle = cycle * lap_angle;
    let speed_ratio = 0;
    if (local < LOAD_SECONDS) {
        return { angle, speed_ratio };
    }
    const moving = local - LOAD_SECONDS;
    if (moving < RAMP_SECONDS) {
        speed_ratio = moving / RAMP_SECONDS;
        angle += (omega * moving * moving) / (2 * RAMP_SECONDS);
    } else if (moving < RAMP_SECONDS + RUN_SECONDS) {
        speed_ratio = 1;
        angle += omega * (RAMP_SECONDS / 2 + (moving - RAMP_SECONDS));
    } else {
        const braking = moving - RAMP_SECONDS - RUN_SECONDS;
        speed_ratio = 1 - braking / RAMP_SECONDS;
        angle += omega * (RAMP_SECONDS / 2 + RUN_SECONDS + braking - (braking * braking) / (2 * RAMP_SECONDS));
    }
    return { angle, speed_ratio };
}

// 목마 한 마리 (로컬 -z 가 머리 방향, 원점 = 안장 아래 몸통 중심 높이 0)
function createHorse(color: string, saddle: string): THREE.Group {
    const horse = new THREE.Group();
    addMesh(horse, new THREE.CapsuleGeometry(0.32, 0.8, 6, 12), color, [0, 0, 0], [Math.PI / 2, 0, 0]);
    // 목·머리·주둥이
    addMesh(horse, new THREE.CapsuleGeometry(0.17, 0.45, 4, 10), color, [0, 0.38, -0.55], [-0.6, 0, 0]);
    addMesh(horse, new THREE.CapsuleGeometry(0.17, 0.32, 4, 10), color, [0, 0.62, -0.78], [Math.PI / 2 - 0.3, 0, 0]);
    // 갈기·꼬리
    addMesh(horse, new THREE.BoxGeometry(0.08, 0.5, 0.18), saddle, [0, 0.55, -0.45], [-0.6, 0, 0]);
    addMesh(horse, new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), saddle, [0, 0.05, 0.7], [0.7, 0, 0]);
    // 다리 4개 (달리는 자세로 앞뒤로 벌림)
    for (const [z, tilt] of [[-0.35, -0.5], [0.35, 0.5]] as const) {
        for (const x of [-0.15, 0.15]) {
            addMesh(horse, new THREE.CapsuleGeometry(0.07, 0.4, 4, 8), color, [x, -0.42, z + tilt * 0.25], [tilt, 0, 0]);
        }
    }
    // 안장
    addMesh(horse, new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12).scale(1, 1, 1.3), saddle, [0, 0.3, 0.02]);
    return horse;
}

// 생성 텍스처 픽셀을 영역별 비율(몸통·갈기·안장)로 나눔 — 경계는 부드럽게 섞음
// 안장: 푸른 계열(색상 170~260°), 갈기·꼬리·발굽: 따뜻한 계열 중 채도 높은 것, 나머지: 몸통(크림색)
function smoothStep(edge0: number, edge1: number, value: number): number {
    const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
}

function createHorseTextures(source: THREE.Texture): THREE.Texture[] | null {
    const image = source.image as CanvasImageSource | undefined;
    const canvas = document.createElement("canvas");
    canvas.width = HORSE_TEXTURE_SIZE;
    canvas.height = HORSE_TEXTURE_SIZE;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (image === undefined || context === null) {
        return null;
    }
    context.drawImage(image, 0, 0, HORSE_TEXTURE_SIZE, HORSE_TEXTURE_SIZE);
    const original = context.getImageData(0, 0, HORSE_TEXTURE_SIZE, HORSE_TEXTURE_SIZE);
    const pixel_count = HORSE_TEXTURE_SIZE * HORSE_TEXTURE_SIZE;
    const saddle_weight = new Float32Array(pixel_count);
    const mane_weight = new Float32Array(pixel_count);
    const lightness = new Float32Array(pixel_count);
    // 영역별 평균 밝기 (새 색에 곱할 명암 = 픽셀 밝기 / 영역 평균 밝기)
    const sums = { body: 0, mane: 0, saddle: 0 };
    const weights = { body: 0, mane: 0, saddle: 0 };
    for (let index = 0; index < pixel_count; index += 1) {
        const r = original.data[index * 4] / 255;
        const g = original.data[index * 4 + 1] / 255;
        const b = original.data[index * 4 + 2] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const saturation = max > 0 ? (max - min) / max : 0;
        const delta = Math.max(max - min, 1e-6);
        let hue = max === r ? ((g - b) / delta + 6) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
        hue *= 60;
        const light = 0.299 * r + 0.587 * g + 0.114 * b;
        const saddle = hue > 170 && hue < 260 ? smoothStep(0.04, 0.1, saturation) : 0;
        const warm = hue < 60 || hue > 300 ? 1 : 0;
        const mane = (1 - saddle) * warm * smoothStep(0.26, 0.38, saturation);
        const body = 1 - saddle - mane;
        saddle_weight[index] = saddle;
        mane_weight[index] = mane;
        lightness[index] = light;
        sums.saddle += light * saddle;
        sums.mane += light * mane;
        sums.body += light * body;
        weights.saddle += saddle;
        weights.mane += mane;
        weights.body += body;
    }
    const average = {
        body: sums.body / Math.max(weights.body, 1),
        mane: sums.mane / Math.max(weights.mane, 1),
        saddle: sums.saddle / Math.max(weights.saddle, 1),
    };
    return HORSE_PALETTES.map((palette) => {
        const body = new THREE.Color(palette.body);
        const mane = new THREE.Color(palette.mane);
        const saddle = new THREE.Color(palette.saddle);
        // THREE.Color 는 선형 값 → 캔버스(sRGB)에 쓰려고 sRGB 로 되돌림
        const colors = [body, mane, saddle].map((color) => color.clone().convertLinearToSRGB());
        const output = context.createImageData(HORSE_TEXTURE_SIZE, HORSE_TEXTURE_SIZE);
        for (let index = 0; index < pixel_count; index += 1) {
            const w_saddle = saddle_weight[index];
            const w_mane = mane_weight[index];
            const w_body = 1 - w_saddle - w_mane;
            const light = lightness[index];
            const shade_body = light / average.body;
            const shade_mane = light / average.mane;
            const shade_saddle = light / average.saddle;
            for (let channel = 0; channel < 3; channel += 1) {
                const key = channel === 0 ? "r" : channel === 1 ? "g" : "b";
                const value = colors[0][key] * shade_body * w_body + colors[1][key] * shade_mane * w_mane + colors[2][key] * shade_saddle * w_saddle;
                output.data[index * 4 + channel] = Math.min(255, Math.max(0, value * 255));
            }
            output.data[index * 4 + 3] = 255;
        }
        const target = document.createElement("canvas");
        target.width = HORSE_TEXTURE_SIZE;
        target.height = HORSE_TEXTURE_SIZE;
        target.getContext("2d")?.putImageData(output, 0, 0);
        const texture = new THREE.CanvasTexture(target);
        texture.colorSpace = THREE.SRGBColorSpace;
        // glTF 텍스처는 위아래를 뒤집지 않음 (원본과 같은 UV)
        texture.flipY = false;
        return texture;
    });
}

export function createCarousel(): RideModel {
    const root = new THREE.Group();

    // 고정된 바닥 받침 (원판 아래 계단 단)
    addMesh(root, new THREE.CylinderGeometry(PLATFORM_RADIUS + 0.6, PLATFORM_RADIUS + 0.8, 0.3, 40), "#f1cfa6", [0, 0.15, 0]);

    // 도는 부분: 원판 + 가운데 기둥 + 지붕 + 목마
    const spinner = new THREE.Group();
    root.add(spinner);
    addMesh(spinner, new THREE.CylinderGeometry(PLATFORM_RADIUS, PLATFORM_RADIUS, 0.3, 40), "#ffd6a5", [0, 0.45, 0]);
    addMesh(spinner, new THREE.CylinderGeometry(PLATFORM_RADIUS - 0.2, PLATFORM_RADIUS - 0.2, 0.32, 40), "#fefae0", [0, 0.46, 0]);
    // 가운데 거울 기둥 (원기둥 + 장식 띠)
    addMesh(spinner, new THREE.CylinderGeometry(1.6, 1.6, ROOF_HEIGHT - 0.6, 16), "#ffafcc", [0, ROOF_HEIGHT / 2 + 0.3, 0]);
    for (const y of [1.2, ROOF_HEIGHT - 0.6]) {
        addMesh(spinner, new THREE.CylinderGeometry(1.75, 1.75, 0.25, 16), "#ffd166", [0, y, 0]);
    }
    // 지붕: 처마 띠 + 줄무늬 원뿔 천막 + 꼭대기 깃발
    addMesh(spinner, new THREE.CylinderGeometry(ROOF_RADIUS, ROOF_RADIUS, 0.6, 40), "#ffd166", [0, ROOF_HEIGHT, 0]);
    const stripes = 16;
    for (let index = 0; index < stripes; index += 1) {
        const roof = new THREE.ConeGeometry(ROOF_RADIUS + 0.2, 2.6, 2, 1, false, (index / stripes) * Math.PI * 2, (Math.PI * 2) / stripes);
        addMesh(spinner, roof, index % 2 === 0 ? "#ff5d8f" : "#ffffff", [0, ROOF_HEIGHT + 1.6, 0]);
    }
    addMesh(spinner, new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), "#adb5bd", [0, ROOF_HEIGHT + 3.4, 0]);
    addMesh(spinner, new THREE.BoxGeometry(0.7, 0.4, 0.04), "#ffb703", [0.35, ROOF_HEIGHT + 3.8, 0]);
    // 처마 끝 전구 (스스로 빛나는 재질, 인스턴싱 1회 그리기)
    const bulb_count = 24;
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 8, 6), getMaterial("#fff3b0", 0.9), bulb_count);
    const dummy = new THREE.Object3D();
    for (let index = 0; index < bulb_count; index += 1) {
        const angle = (index / bulb_count) * Math.PI * 2;
        dummy.position.set(Math.cos(angle) * (ROOF_RADIUS + 0.05), ROOF_HEIGHT - 0.35, Math.sin(angle) * (ROOF_RADIUS + 0.05));
        dummy.updateMatrix();
        bulbs.setMatrixAt(index, dummy.matrix);
    }
    spinner.add(bulbs);

    // 목마: 회전축 기준 각도별 받침(pivot) → 오르내리는 목마 → 안장 위 좌석 앵커
    const horses: THREE.Group[] = [];
    const seat_anchors: THREE.Object3D[] = [];
    for (let index = 0; index < SEAT_COUNT; index += 1) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (index / SEAT_COUNT) * Math.PI * 2;
        spinner.add(pivot);
        // 천장까지 이어진 금색 기둥
        addMesh(pivot, new THREE.CylinderGeometry(0.06, 0.06, ROOF_HEIGHT - 0.6, 8), "#e9c46a", [HORSE_RADIUS, ROOF_HEIGHT / 2 + 0.3, 0]);
        const horse = createHorse(HORSE_COLORS[index % HORSE_COLORS.length], SADDLE_COLORS[index % SADDLE_COLORS.length]);
        horse.position.set(HORSE_RADIUS, 1.6, 0);
        pivot.add(horse);
        horses.push(horse);
        // 좌석 정면(+z)이 목마 머리(-z) 쪽을 보도록
        const anchor = new THREE.Object3D();
        anchor.position.set(0, 0.36, 0.05);
        anchor.rotation.y = Math.PI;
        horse.add(anchor);
        seat_anchors.push(anchor);
    }

    // GLB 로 바꿔 끼움: 코드 도형은 숨기기만 함 (바닥 높이 지도가 이미 이 도형을 기준으로 잡았을 수 있음 — 치수 동일)
    const placeholders: THREE.Object3D[] = [];
    root.traverse((node) => {
        if (node instanceof THREE.Mesh) {
            placeholders.push(node);
        }
    });
    createGltfLoader().loadAsync(MODEL_URL).then(
        (gltf) => {
            const base = gltf.scene.getObjectByName("carousel_base");
            const spinner_model = gltf.scene.getObjectByName("carousel_spinner");
            const horse_model = gltf.scene.getObjectByName("carousel_horse");
            if (base === undefined || spinner_model === undefined || !(horse_model instanceof THREE.Mesh)) {
                console.warn("[carousel] GLB 에 필요한 객체가 없어 코드 모델을 그대로 씁니다.");
                return;
            }
            applyGlbToonMaterials(base);
            applyGlbToonMaterials(spinner_model);
            for (const node of placeholders) {
                node.visible = false;
            }
            root.add(base);
            spinner.add(spinner_model);
            const source = (horse_model.material as THREE.MeshStandardMaterial).map;
            const horse_textures = source === null ? null : createHorseTextures(source);
            horses.forEach((horse, index) => {
                const map = horse_textures?.[index % horse_textures.length] ?? source;
                const material = new THREE.MeshToonMaterial({ map, gradientMap: getToonGradient() });
                const mesh = new THREE.Mesh(horse_model.geometry, material);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                horse.add(mesh);
            });
        },
        (error: unknown) => console.warn("[carousel] GLB 를 불러오지 못해 코드 모델을 씁니다.", error),
    );

    return {
        id: RIDE_ID.CAROUSEL,
        root,
        seat_anchors,
        update(time) {
            const { angle, speed_ratio } = platformAngle(time);
            // 원판이 +y 로 돌면 로컬 +x 의 목마는 -z 쪽으로 나아감 → 머리 방향과 같음
            spinner.rotation.y = angle;
            horses.forEach((horse, index) => {
                // 이웃한 목마는 엇갈려 오르내림, 멈춰 있으면 제자리 높이로
                horse.position.y = 1.6 + Math.sin(angle * BOBS_PER_LAP + index * Math.PI * 0.5) * BOB_HEIGHT * speed_ratio;
            });
        },
    };
}
