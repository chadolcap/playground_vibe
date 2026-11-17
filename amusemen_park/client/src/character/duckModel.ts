// 아바타 모델 생성 — 도형만 담당 (애니메이션은 duckAnimation.ts)
// 사람 캐릭터(man_1·man_2·woman_1·woman_2, 이름·색으로 고름) glTF 를 먼저 쓰고, 불러오지 못하면 도형으로 만든 새끼 오리로 대신한다
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { getMaterial, getToonGradient } from "../world/rides/common";

// 애니메이션이 움직이는 노드 모음
export interface DuckRig {
    // 위치·방향을 정하는 최상위 노드 (원점 = 발바닥, 정면 +z)
    root: THREE.Group;
    // 몸통 전체 (뒤뚱거림·통통 튀기)
    body: THREE.Object3D;
    // 날개 또는 팔 (어깨 기준 회전)
    wing_left: THREE.Object3D;
    wing_right: THREE.Object3D;
    // 다리 (엉덩이 기준 회전)
    leg_left: THREE.Object3D;
    leg_right: THREE.Object3D;
    // 무릎 (다리 안에서 정강이를 굽힘, 오리는 없음)
    knee_left: THREE.Object3D | null;
    knee_right: THREE.Object3D | null;
    // 발목 (발바닥을 땅과 평평하게 유지, 없으면 발이 정강이와 함께 기움)
    foot_left: THREE.Object3D | null;
    foot_right: THREE.Object3D | null;
    // 묶음 머리 (걸을 때 흔들림, 없으면 빈 배열)
    hair: THREE.Object3D[];
    // 사람 모델이면 true (걷기·앉기 동작이 다름)
    is_human: boolean;
    // 다리 회전 중심(엉덩이) 높이
    hip_height: number;
    // 앉을 때 몸통이 내려가는 높이
    sit_drop: number;
    // 앉을 때 다리를 몸통보다 덜 내리는 높이
    sit_leg_raise: number;
    // 발바닥 기준점(발끝·뒤꿈치) — 걸을 때 디딤발을 땅에 붙이는 계산용 (오리는 빈 배열)
    sole_points: SolePoint[];
    // 가장 낮은 발이 땅(0)에 닿도록 모델 전체를 올리고 내리는 노드 (오리는 null)
    ground_lift: THREE.Object3D | null;
}

// 발바닥 기준점 하나 — 이 점을 움직이는 뼈와 그 뼈 기준 좌표
export interface SolePoint {
    bone: THREE.Object3D;
    local: THREE.Vector3;
}

// 모델 크기 — 이름표 높이·앉는 위치 계산에 사용
export const DUCK_HEIGHT = 1.55;
// 앉았을 때 몸통이 내려가는 높이 (앉기 애니메이션)
export const DUCK_SIT_DROP = 0.3;
// 앉은 오리의 엉덩이가 좌석 면(앵커)에 닿도록 root 를 앵커보다 올리는 높이
export const DUCK_SEAT_OFFSET = 0.1;

const HIP_HEIGHT = 0.32;
const FOOT_COLOR = "#ff9f1c";

// 사람 캐릭터 glTF — 스킨 메시 + 뼈대 (Blender 에서 오리와 같은 키 1.55, 발바닥 원점, 정면 +z 로 내보냄)
// 뼈: root → body(arm_*, hair_*), leg_* → knee_* — 뼈 위치가 회전 중심, 기본 회전 0 이라 축 그대로 돌림
// 캐릭터마다 이름·색 해시로 하나를 고름 → 순서를 바꾸면 접속자마다 보이는 캐릭터가 바뀜 (새 모델은 뒤에 추가)
const HUMAN_MODEL_URLS = ["man_1", "man_2", "woman_1", "woman_2"].map((name) => `${import.meta.env.BASE_URL}models/${name}.glb`);
// 흔들리는 묶음 머리 뼈 이름 (양갈래 = 좌우, 포니테일 = 하나)
const HAIR_BONES = ["hair_left", "hair_right", "hair"];
// 앉으면 몸통 아래(가랑이)가 좌석 면 근처까지 내려가도록
const HUMAN_SIT_DROP = 0.34;
// 다리 회전 중심(가랑이)이 엉덩이 아랫면보다 낮아서, 앉을 때 다리를 조금 올려야 좌석에 묻히지 않음
const HUMAN_SIT_LEG_RAISE = 0.08;

// 이 높이보다 낮은 정점을 발바닥으로 봄 (발바닥 원점 기준)
const SOLE_VERTEX_HEIGHT = 0.05;

// HUMAN_MODEL_URLS 와 같은 순서 (불러오지 못한 모델은 null)
const human_templates: (THREE.Object3D | null)[] = HUMAN_MODEL_URLS.map(() => null);
let human_loading: Promise<void> | null = null;

// 아바타를 만들기 전에 한 번 호출 — 모두 실패하면 오리로 표시되도록 오류를 삼킴
export function loadCharacterModel(): Promise<void> {
    const loader = new GLTFLoader();
    human_loading ??= Promise.all(HUMAN_MODEL_URLS.map((url, index) => loader.loadAsync(url).then(
        (gltf) => {
            const toon_materials = new Map<THREE.Material, THREE.MeshToonMaterial>();
            gltf.scene.traverse((node) => {
                // 크기는 Blender 에서 게임 크기로 내보냄 (스킨 메시는 도형 배율을 바꾸면 뼈 결합이 어긋남)
                if (node instanceof THREE.Mesh) {
                    node.castShadow = true;
                    // 공원의 툰 재질과 맞춤 (구운 텍스처는 그대로)
                    const source = node.material as THREE.MeshStandardMaterial;
                    let toon = toon_materials.get(source);
                    if (toon === undefined) {
                        toon = new THREE.MeshToonMaterial({ map: source.map, gradientMap: getToonGradient() });
                        toon_materials.set(source, toon);
                        source.dispose();
                    }
                    node.material = toon;
                }
            });
            human_templates[index] = gltf.scene;
        },
        (error: unknown) => {
            console.warn(`캐릭터 모델(${url})을 불러오지 못했습니다.`, error);
        },
    ))).then(() => undefined);
    return human_loading;
}

// 모든 접속자에게 같은 값(이름·색 등)으로 모델을 고름 — 고른 모델이 없으면 불러온 다른 모델
function pickHumanTemplate(look_key: string): THREE.Object3D | null {
    let hash = 0;
    for (let index = 0; index < look_key.length; index += 1) {
        hash = (hash * 31 + look_key.charCodeAt(index)) >>> 0;
    }
    return human_templates[hash % human_templates.length] ?? human_templates.find((template) => template !== null) ?? null;
}

function requireNode(scene: THREE.Object3D, name: string): THREE.Object3D {
    const node = scene.getObjectByName(name);
    if (node === undefined) {
        throw new Error(`캐릭터 모델에 ${name} 노드가 없습니다.`);
    }
    return node;
}

// 기본 자세의 메시에서 좌우 발바닥의 앞끝(발끝)·뒤끝(뒤꿈치)을 찾아 발 뼈 기준 좌표로 저장
// 발목 뼈가 없어 발이 정강이와 함께 돌기 때문에, 다리를 젖히면 발끝이 땅을 파고듦 → 이 점들로 파고든 깊이를 잼
// (높이는 0 으로 두어 발바닥 앞뒤 모서리를 그대로 씀 — 실제보다 살짝 보수적)
function findSolePoints(model: THREE.Object3D, left_bone: THREE.Object3D, right_bone: THREE.Object3D): SolePoint[] {
    model.updateMatrixWorld(true);
    const meshes: THREE.Mesh[] = [];
    model.traverse((node) => {
        if (node instanceof THREE.Mesh) {
            meshes.push(node);
        }
    });
    // 왼발(+x)·오른발(-x) 각각 [최소 z, 최대 z, x 합, 개수]
    const sides = [
        { bone: left_bone, sign: 1, min_z: Infinity, max_z: -Infinity, sum_x: 0, count: 0 },
        { bone: right_bone, sign: -1, min_z: Infinity, max_z: -Infinity, sum_x: 0, count: 0 },
    ];
    const vertex = new THREE.Vector3();
    for (const mesh of meshes) {
        const positions = mesh.geometry.getAttribute("position");
        for (let index = 0; index < positions.count; index += 1) {
            vertex.fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld);
            if (vertex.y >= SOLE_VERTEX_HEIGHT) {
                continue;
            }
            const side = vertex.x >= 0 ? sides[0] : sides[1];
            side.min_z = Math.min(side.min_z, vertex.z);
            side.max_z = Math.max(side.max_z, vertex.z);
            side.sum_x += vertex.x;
            side.count += 1;
        }
    }
    const points: SolePoint[] = [];
    for (const side of sides) {
        if (side.count === 0) {
            continue;
        }
        const x = side.sum_x / side.count;
        for (const z of [side.min_z, side.max_z]) {
            points.push({ bone: side.bone, local: side.bone.worldToLocal(new THREE.Vector3(x, 0, z)) });
        }
    }
    return points;
}

// 미리 불러 둔 사람 모델을 복제 (도형·재질은 공유, 뼈대는 개체마다 새로 — 일반 clone 은 스킨이 원본 뼈에 묶임)
function createHumanRig(template: THREE.Object3D): DuckRig {
    const root = new THREE.Group();
    const model = SkeletonUtils.clone(template);
    root.add(model);
    const leg_left = requireNode(model, "leg_left");
    const leg_right = requireNode(model, "leg_right");
    const knee_left = model.getObjectByName("knee_left") ?? null;
    const knee_right = model.getObjectByName("knee_right") ?? null;
    const foot_left = model.getObjectByName("foot_left") ?? null;
    const foot_right = model.getObjectByName("foot_right") ?? null;
    return {
        root,
        body: requireNode(model, "body"),
        wing_left: requireNode(model, "arm_left"),
        wing_right: requireNode(model, "arm_right"),
        leg_left,
        leg_right,
        knee_left,
        knee_right,
        foot_left,
        foot_right,
        hair: HAIR_BONES.map((name) => model.getObjectByName(name)).filter((node) => node !== undefined),
        is_human: true,
        // 엉덩이 높이 = 모델의 다리 노드 높이 (모델마다 다르므로 상수 대신 파일에서 읽음)
        hip_height: leg_left.position.y,
        sit_drop: HUMAN_SIT_DROP,
        sit_leg_raise: HUMAN_SIT_LEG_RAISE,
        // 발을 움직이는 가장 아래 뼈 — 발목 → 무릎 → 다리 순으로 있는 것
        sole_points: findSolePoints(model, foot_left ?? knee_left ?? leg_left, foot_right ?? knee_right ?? leg_right),
        ground_lift: model,
    };
}

// 모든 오리가 같은 도형을 공유 (색만 재질로 다르게)
interface DuckGeometries {
    body: THREE.BufferGeometry;
    face: THREE.BufferGeometry;
    wing: THREE.BufferGeometry;
    leg: THREE.BufferGeometry;
}

let shared_geometries: DuckGeometries | null = null;
let face_material: THREE.MeshToonMaterial | null = null;

function placed(geometry: THREE.BufferGeometry, x: number, y: number, z: number, scale: [number, number, number] = [1, 1, 1]): THREE.BufferGeometry {
    geometry.scale(scale[0], scale[1], scale[2]);
    geometry.translate(x, y, z);
    return geometry;
}

// 부위마다 색을 정점 색으로 칠해 하나의 도형으로 합침 (눈·부리·볼을 한 번에 그림)
function colored(geometry: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
    const rgb = new THREE.Color(color);
    const count = geometry.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
        colors.set([rgb.r, rgb.g, rgb.b], index * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
}

function mergeOrThrow(parts: THREE.BufferGeometry[], name: string): THREE.BufferGeometry {
    const merged = mergeGeometries(parts);
    if (merged === null) {
        throw new Error(`오리 ${name} 도형을 합치지 못했습니다.`);
    }
    for (const part of parts) {
        part.dispose();
    }
    return merged;
}

function buildGeometries(): DuckGeometries {
    // 몸통 + 머리 + 꼬리 + 머리 위 깃털 (모두 몸 색)
    const body = mergeOrThrow([
        placed(new THREE.SphereGeometry(0.5, 16, 12), 0, 0.62, -0.02, [1, 0.85, 1.12]),
        placed(new THREE.SphereGeometry(0.37, 16, 12), 0, 1.15, 0.2),
        placed(new THREE.ConeGeometry(0.16, 0.34, 8).rotateX(-2.2), 0, 0.82, -0.55),
        placed(new THREE.ConeGeometry(0.07, 0.22, 6).rotateX(-0.4), 0, 1.55, 0.18),
    ], "몸통");

    // 눈 + 부리 + 볼 (정점 색)
    const face = mergeOrThrow([
        colored(placed(new THREE.SphereGeometry(0.065, 10, 8), 0.15, 1.22, 0.5), "#1b1b1b"),
        colored(placed(new THREE.SphereGeometry(0.065, 10, 8), -0.15, 1.22, 0.5), "#1b1b1b"),
        colored(placed(new THREE.SphereGeometry(0.022, 6, 4), 0.17, 1.25, 0.56), "#ffffff"),
        colored(placed(new THREE.SphereGeometry(0.022, 6, 4), -0.13, 1.25, 0.56), "#ffffff"),
        colored(placed(new THREE.SphereGeometry(0.15, 12, 8), 0, 1.08, 0.58, [1.1, 0.42, 1]), FOOT_COLOR),
        colored(placed(new THREE.SphereGeometry(0.07, 8, 6), 0.25, 1.1, 0.43), "#ffadad"),
        colored(placed(new THREE.SphereGeometry(0.07, 8, 6), -0.25, 1.1, 0.43), "#ffadad"),
    ], "얼굴");

    // 날개: 어깨(원점)에서 아래로 늘어진 납작한 타원
    const wing = placed(new THREE.SphereGeometry(0.3, 12, 8), 0, -0.2, 0, [0.35, 0.85, 1.1]);

    // 다리 + 물갈퀴 발: 엉덩이(원점)에서 아래로
    const leg = mergeOrThrow([
        placed(new THREE.CylinderGeometry(0.045, 0.045, HIP_HEIGHT, 6), 0, -HIP_HEIGHT / 2, 0),
        placed(new THREE.SphereGeometry(0.14, 10, 6), 0, -HIP_HEIGHT + 0.03, 0.09, [1, 0.3, 1.4]),
    ], "다리");

    return { body, face, wing, leg };
}

function getSharedGeometries(): DuckGeometries {
    shared_geometries ??= buildGeometries();
    return shared_geometries;
}

function getFaceMaterial(): THREE.MeshToonMaterial {
    face_material ??= new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: getToonGradient() });
    return face_material;
}

function shadowed(mesh: THREE.Mesh): THREE.Mesh {
    mesh.castShadow = true;
    return mesh;
}

// 사람 모델을 불러왔으면 사람(몸 색은 쓰지 않음), 아니면 몸 색(#rrggbb) 오리 한 마리 — 메시 6개
// look_key: 사람 모델을 고르는 값 (모든 접속자에게 같아야 함, 없으면 몸 색)
export function createDuckRig(body_color: string, look_key: string = body_color): DuckRig {
    const human_template = pickHumanTemplate(look_key);
    if (human_template !== null) {
        return createHumanRig(human_template);
    }
    const geometries = getSharedGeometries();
    const body_material = getMaterial(body_color);
    // 날개는 몸보다 살짝 진한 색
    const wing_material = getMaterial(new THREE.Color(body_color).multiplyScalar(0.85));
    const foot_material = getMaterial(FOOT_COLOR);

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    body.add(shadowed(new THREE.Mesh(geometries.body, body_material)));
    body.add(new THREE.Mesh(geometries.face, getFaceMaterial()));

    const wing_left = shadowed(new THREE.Mesh(geometries.wing, wing_material));
    wing_left.position.set(0.47, 0.82, -0.02);
    const wing_right = shadowed(new THREE.Mesh(geometries.wing, wing_material));
    wing_right.position.set(-0.47, 0.82, -0.02);
    body.add(wing_left, wing_right);

    const leg_left = shadowed(new THREE.Mesh(geometries.leg, foot_material));
    leg_left.position.set(0.17, HIP_HEIGHT, 0.02);
    const leg_right = shadowed(new THREE.Mesh(geometries.leg, foot_material));
    leg_right.position.set(-0.17, HIP_HEIGHT, 0.02);
    root.add(leg_left, leg_right);

    return {
        root, body, wing_left, wing_right, leg_left, leg_right,
        knee_left: null,
        knee_right: null,
        foot_left: null,
        foot_right: null,
        hair: [],
        is_human: false,
        hip_height: HIP_HEIGHT,
        sit_drop: DUCK_SIT_DROP,
        sit_leg_raise: 0.1,
        sole_points: [],
        ground_lift: null,
    };
}

// 월드를 정리할 때 공유 도형도 함께 해제 (다음 입장 때 다시 생성)
export function disposeDuckGeometries(): void {
    if (shared_geometries !== null) {
        for (const geometry of Object.values(shared_geometries)) {
            geometry.dispose();
        }
        shared_geometries = null;
    }
    face_material?.dispose();
    face_material = null;
}
