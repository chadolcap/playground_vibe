// 분수대 오리 동상 — 광장 분수 가운데 받침 위에 한쪽 날개를 든 금도금 오리(duck_1 모델, '안녕' 동작에서 날개를 든 순간으로 고정), 수반 둘레 꽃밭
// 오리 부리에서 물줄기가 앞쪽 45° 위로 솟았다가 둥근 아치를 그리며 수반 물에 떨어지고, 떨어진 자리에 물결 고리가 퍼짐
// 분수대 수반·기둥은 terrain.ts, 동상 모델을 불러오지 못하면 받침과 물줄기만 보임 (부리 위치는 기본값)
import * as THREE from "three";
import { createGltfLoader } from "./gltfLoader";
import { getMaterial } from "./rides/common";
import { FOUNTAIN_BASIN_RADIUS, FOUNTAIN_WATER_RADIUS, HUB_CENTER } from "./terrain";

const STATUE_URL = `${import.meta.env.BASE_URL}models/duck_1.glb`;
// 기둥 위 (terrain.ts 분수 기둥 높이 2.2m) 받침 높이와 동상 크기
export const FOUNTAIN_PILLAR_TOP = 2.2;
const PEDESTAL_HEIGHT = 0.25;
const STATUE_SCALE = 1.1;
// 동상이 바라보는 방향 (0 = +z = 정문 쪽)
const STATUE_ROT_Y = 0;
// '안녕' 클립에서 날개를 가장 높이 든 순간 (초)
const WAVE_POSE_TIME = 0.25;
// 그 자세에서 오른쪽 위팔을 더 돌리는 각도(라디안, 뼈 로컬)와 날개 길이 배율 — 날개 끝이 머리 옆 바깥 위 45°로 (브라우저에서 찾은 값)
const RAISED_WING_TURN = { x: -0.3, z: 0.3 } as const;
const RAISED_WING_SCALE = 1.6;
// 금도금: 밝은 노란 금색 바탕 + 흰빛 반사광 (빛을 받는 쪽에 반짝이는 하이라이트) + 은은한 자체 발광 (그늘진 쪽도 어둡지 않게)
const GOLD_COLOR = "#ffd84a";
const GOLD_SPECULAR = "#fff8dc";
const GOLD_EMISSIVE = "#5c4300";
const GOLD_SHININESS = 90;
// 수반 둘레 꽃밭 — 수반 바깥(받침 테두리)에서 이만큼 바깥까지 (광장 반지름 9m 안, 바깥에 산책길을 남김)
const FLOWER_BED_WIDTH = 1.7;
// 꽃송이 수·색 (바닥 꽃·꽃나무와 같은 파스텔)
const BED_FLOWERS = 320;
const BED_FLOWER_COLORS = ["#ff9fb6", "#ffffff", "#ffe066", "#c9a7ff", "#ffb38a", "#ff8fab", "#9bd0ff"];
// 수반 물 높이 (terrain.ts 물 원판 윗면)
const WATER_Y = 0.82;
// 물줄기: 물방울 수·쏘는 빠르기(m/s)·쏘는 각도(앞쪽 위로)·중력 (한 방울이 물에 닿는 시간은 부리 높이로 계산)
// 떨어지는 지점이 수반 물 반지름(terrain.ts FOUNTAIN_WATER_RADIUS) 안에 들어오도록 빠르기를 정함 (넘치면 콘솔 경고)
const DROPS = 64;
const SPOUT_SPEED = 4;
const SPOUT_ANGLE = THREE.MathUtils.degToRad(45);
const SPOUT_FORWARD_SPEED = SPOUT_SPEED * Math.cos(SPOUT_ANGLE);
const SPOUT_UP_SPEED = SPOUT_SPEED * Math.sin(SPOUT_ANGLE);
const GRAVITY = 9.8;
// 물결 고리 수 (떨어지는 자리에서 차례로 퍼짐)
const RIPPLES = 3;
const RIPPLE_SECONDS = 1.2;
// 모델을 불러오기 전(또는 실패) 부리 끝 높이 기본값 (받침 위, 동상 기준)
const DEFAULT_BEAK_HEIGHT = 1.05;
const DEFAULT_BEAK_FORWARD = 0.55;

// 부리에서 쏜 물방울이 물에 닿을 때까지의 시간(초)
function flightSeconds(spout: THREE.Vector3): number {
    const drop_height = spout.y - WATER_Y;
    return (SPOUT_UP_SPEED + Math.sqrt(SPOUT_UP_SPEED * SPOUT_UP_SPEED + 2 * GRAVITY * drop_height)) / GRAVITY;
}

// 물에 닿는 자리 (분수대 가운데 기준 x, z)
function landingPoint(spout: THREE.Vector3, forward: THREE.Vector3): [number, number] {
    const distance = SPOUT_FORWARD_SPEED * flightSeconds(spout);
    return [spout.x + forward.x * distance, spout.z + forward.z * distance];
}

// 수반 둘레 꽃밭: 초록 화단 고리 + 바깥 낮은 돌 테두리 + 여러 색 꽃송이(잎 위에 꽃, 인스턴싱 각 한 번)
// 꽃은 밟고 지나감 (바닥 꽃과 같음) — 광장을 걷는 길을 막지 않음
function createFlowerBed(): THREE.Group {
    const bed = new THREE.Group();
    // 수반 아래쪽이 바깥으로 0.3 벌어져 있어 그 바깥부터
    const inner = FOUNTAIN_BASIN_RADIUS + 0.3;
    const outer = inner + FLOWER_BED_WIDTH;
    const soil = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 64), getMaterial("#7cc68a"));
    soil.rotation.x = -Math.PI / 2;
    soil.position.y = 0.075;
    soil.receiveShadow = true;
    bed.add(soil);
    const border = new THREE.Mesh(new THREE.TorusGeometry(outer, 0.1, 8, 64), getMaterial("#e9dcc9"));
    border.rotation.x = -Math.PI / 2;
    border.position.y = 0.09;
    bed.add(border);

    // 고리 안에 고르게 흩어 심음 (황금각 나선으로 둘레 방향 고르게 + 반지름은 넓이가 고르게)
    const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6).scale(1, 0.55, 1), getMaterial("#5fae6e"), BED_FLOWERS);
    const blossoms = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 6).scale(1, 0.7, 1), getMaterial("#ffffff"), BED_FLOWERS);
    const colors = BED_FLOWER_COLORS.map((hex) => new THREE.Color(hex));
    const dummy = new THREE.Object3D();
    const golden_angle = Math.PI * (3 - Math.sqrt(5));
    for (let index = 0; index < BED_FLOWERS; index += 1) {
        const ratio = (index + 0.5) / BED_FLOWERS;
        const radius = Math.sqrt(inner * inner + ratio * (outer * outer - inner * inner)) * (1 + Math.sin(index * 7.31) * 0.012);
        const angle = index * golden_angle;
        const x = Math.cos(angle) * Math.min(radius, outer - 0.15);
        const z = Math.sin(angle) * Math.min(radius, outer - 0.15);
        const size = 0.85 + ((index * 37) % 10) / 20;
        dummy.position.set(x, 0.14, z);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        leaves.setMatrixAt(index, dummy.matrix);
        dummy.position.y = 0.24 * size;
        dummy.updateMatrix();
        blossoms.setMatrixAt(index, dummy.matrix);
        // 가까운 꽃끼리 색이 겹치지 않게 순서를 섞어 고름
        blossoms.setColorAt(index, colors[(index * 3) % colors.length]);
    }
    for (const mesh of [soil, border, leaves, blossoms]) {
        mesh.userData.walk_through = true;
    }
    bed.add(leaves, blossoms);
    return bed;
}

export interface DuckFountain {
    readonly group: THREE.Group;
    update(time: number): void;
}

export function createDuckFountain(): DuckFountain {
    const group = new THREE.Group();
    group.position.set(HUB_CENTER.x, 0, HUB_CENTER.z);
    const base_y = FOUNTAIN_PILLAR_TOP + PEDESTAL_HEIGHT;

    // 기둥 위 넓은 받침 (동상 발이 기둥보다 넓어서)
    const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.6, PEDESTAL_HEIGHT, 20), getMaterial("#d6ccc2"));
    pedestal.position.y = FOUNTAIN_PILLAR_TOP + PEDESTAL_HEIGHT / 2;
    pedestal.castShadow = true;
    group.add(pedestal, createFlowerBed());
    // 수반 안(물·기둥)으로 들어가지 못하게 원으로 막음 — 수반 아래쪽 가장 넓은 테두리까지 (groundMap 이 몸 반지름을 더함, 자동 이동은 돌아감)
    group.userData.solid_radius = FOUNTAIN_BASIN_RADIUS + 0.3;

    // 부리 끝 (분수대 로컬 좌표) — 모델을 불러오면 실제 부리 위치로 바뀜
    const spout = new THREE.Vector3(Math.sin(STATUE_ROT_Y) * DEFAULT_BEAK_FORWARD * STATUE_SCALE, base_y + DEFAULT_BEAK_HEIGHT * STATUE_SCALE, Math.cos(STATUE_ROT_Y) * DEFAULT_BEAK_FORWARD * STATUE_SCALE);
    const forward = new THREE.Vector3(Math.sin(STATUE_ROT_Y), 0, Math.cos(STATUE_ROT_Y));

    createGltfLoader().loadAsync(STATUE_URL).then(
        (gltf) => {
            const statue = gltf.scene;
            statue.scale.setScalar(STATUE_SCALE);
            statue.rotation.y = STATUE_ROT_Y;
            statue.position.y = base_y;
            // 금도금 동상: 구운 텍스처 대신 반짝이는 금색 재질 (툰 재질은 반사광이 없어 도금 느낌이 나지 않음)
            const gold = new THREE.MeshPhongMaterial({ color: GOLD_COLOR, specular: GOLD_SPECULAR, emissive: GOLD_EMISSIVE, shininess: GOLD_SHININESS });
            statue.traverse((node) => {
                if (node instanceof THREE.Mesh) {
                    (node.material as THREE.Material).dispose();
                    node.material = gold;
                    node.castShadow = true;
                }
            });
            group.add(statue);
            // 한쪽 날개를 든 '안녕' 자세로 한 번 맞추고 멈춤 (매 프레임 움직이지 않는 동상)
            const wave = THREE.AnimationClip.findByName(gltf.animations, "wave");
            if (wave !== null) {
                const mixer = new THREE.AnimationMixer(statue);
                mixer.clipAction(wave).play();
                mixer.setTime(WAVE_POSE_TIME);
            }
            // 오리 날개는 짧아 머리(몸의 절반 크기) 옆까지만 올라감 → 동상답게 오른쪽 날개를 길게 늘여 바깥 위로 활짝 듦 (아래팔은 곧게)
            statue.getObjectByName("upper_arm_right")?.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(RAISED_WING_TURN.x, 0, RAISED_WING_TURN.z)));
            statue.getObjectByName("upper_arm_right")?.scale.setScalar(RAISED_WING_SCALE);
            statue.getObjectByName("forearm_right")?.quaternion.identity();
            // 부리 끝 = 아래턱 뼈 위치에서 앞으로 (턱 뼈는 입 안쪽 경첩)
            group.updateMatrixWorld(true);
            const jaw = statue.getObjectByName("jaw");
            if (jaw !== undefined) {
                const world = jaw.getWorldPosition(new THREE.Vector3());
                group.worldToLocal(world);
                spout.copy(world).addScaledVector(forward, 0.42 * STATUE_SCALE);
            }
            const landing = Math.hypot(...landingPoint(spout, forward));
            if (landing > FOUNTAIN_WATER_RADIUS - 0.3) {
                console.warn(`분수 물줄기가 수반 물 밖(${landing.toFixed(2)}m)에 떨어집니다 — terrain.ts FOUNTAIN_WATER_RADIUS 를 넓히거나 SPOUT_SPEED 를 줄이세요.`);
            }
        },
        (error: unknown) => console.warn(`분수 동상 모델(${STATUE_URL})을 불러오지 못했습니다.`, error),
    );

    // 물방울 (인스턴싱 한 번에 그림) — 같은 간격으로 부리를 떠나 포물선을 그리고 물에 닿으면 다시 부리에서
    const drops = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 8, 6), getMaterial("#90e0ef"), DROPS);
    drops.userData.walk_through = true;
    group.add(drops);
    // 물결 고리 (물에 닿는 자리에서 커지며 옅어짐)
    const ripples: THREE.Mesh[] = [];
    for (let index = 0; index < RIPPLES; index += 1) {
        const ripple = new THREE.Mesh(
            new THREE.RingGeometry(0.18, 0.26, 24),
            new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.8, depthWrite: false }),
        );
        ripple.rotation.x = -Math.PI / 2;
        ripple.userData.walk_through = true;
        ripples.push(ripple);
        group.add(ripple);
    }

    const dummy = new THREE.Object3D();
    return {
        group,
        update(time) {
            // 한 방울이 날아가는 시간: 부리 높이에서 물 높이까지 (45° 위로 솟았다 아치를 그리며 떨어짐)
            const flight = flightSeconds(spout);
            for (let index = 0; index < DROPS; index += 1) {
                const t = ((time / flight + index / DROPS) % 1) * flight;
                // 물방울마다 살짝 다른 옆 흔들림 → 물줄기가 한 줄 선이 아니라 도톰하게
                const wobble = Math.sin(index * 12.9898) * 0.06;
                dummy.position.set(
                    spout.x + forward.x * SPOUT_FORWARD_SPEED * t + forward.z * wobble,
                    spout.y + SPOUT_UP_SPEED * t - 0.5 * GRAVITY * t * t,
                    spout.z + forward.z * SPOUT_FORWARD_SPEED * t - forward.x * wobble,
                );
                // 부리를 갓 떠난 물방울은 작게, 떨어질수록 조금 커짐
                dummy.scale.setScalar(0.6 + 0.6 * (t / flight));
                dummy.updateMatrix();
                drops.setMatrixAt(index, dummy.matrix);
            }
            drops.instanceMatrix.needsUpdate = true;
            // 물에 닿는 자리
            const [land_x, land_z] = landingPoint(spout, forward);
            ripples.forEach((ripple, index) => {
                const age = ((time / RIPPLE_SECONDS + index / RIPPLES) % 1);
                ripple.position.set(land_x, WATER_Y + 0.01, land_z);
                ripple.scale.setScalar(1 + age * 3.5);
                (ripple.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - age);
            });
        },
    };
}
