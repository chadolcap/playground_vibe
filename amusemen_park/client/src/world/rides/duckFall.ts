// DUCK FALL — 에버랜드 슈퍼 후룸(2025)을 본뜬 워터 라이드 (좌석 4 = 2열 × 2줄)
// 실제 기구: 최대 20m·45° 낙하, 정상 180° 턴테이블, 뒤로 떨어지는 백워드 드롭, 뒤로 들어가 앞으로 나오는 리버싱 룸
// 게임 크기(반경 22)에 맞춰 높이는 약 13m 로 줄이고 구성 순서는 그대로:
// 승강장 → 컨베이어 리프트 → 턴테이블(180°) → 뒤로 낙하 → 리버싱 룸(180°) → 45° 큰 낙하 → 착수 물보라
// 모양: 물길·지지대·바위산은 코드(경로가 유일한 원본), 보트(생성 원형 래프트)와 리버싱 룸(scripts/duck_fall_room_build.py)은
//   models/duck_fall.glb 를 불러와 바꿔 끼움 — 불러오기 전·실패 시에는 코드 도형이 보임
import * as THREE from "three";
import { createGltfLoader } from "../gltfLoader";
import { RIDE_ID } from "@shared";
import {
    addMesh,
    applyGlbToonMaterials,
    buildPathFrames,
    createCart,
    createRails,
    createRibbon,
    createSupports,
    createThrill,
    getMaterial,
    placeOnPath,
    samplePath,
    type RideModel,
} from "./common";
import { buildCoasterTimeline, findDropBottomU } from "./ridePhysics";
import { arc, designTrack, findNearestU, line, lineTo, mark, type DesignedTrack, type PlanPoint, type ProfileStep } from "./trackDesign";

// 위에서 본 물길 (x, z) — 기구 로컬 좌표, +z = 게이트(앞)
const PLAN_POINTS: PlanPoint[] = [
    // 승강장 (앞쪽, -x 방향으로 출발)
    [5.5, 7], [0, 7], [-6, 7],
    // 왼쪽으로 돌며 컨베이어 리프트
    [-11.5, 3.5], [-14, -3], [-13.5, -10], [-10, -15.5],
    // 정상 턴테이블 → 뒤로 낙하
    [-4, -18.5], [3, -18], [8.5, -14.5],
    // 리버싱 룸 → 큰 낙하 → 착수 웅덩이 → 반지름 4m 로 크게 돌아 승강장
    // (물길 폭이 2.4m 라 회전 반지름이 이보다 작으면 안쪽 벽이 접혀 꺾여 보임)
    [11.5, -9], [13, -2], [12.6, 2.4], [10.4, 5.9],
];

const STATION_HEIGHT = 0.6;

// 원호 바닥에서 높이가 얼마나 줄어드는지 (반지름 R, 경사 degrees → 수평)
const arcDrop = (radius: number, degrees: number): number => radius * (1 - Math.cos(THREE.MathUtils.degToRad(degrees)));

// 높이 단면 (직선·원호) — 두 낙하 모두 9~10m, 바닥 반지름을 넓혀 착수 직전 약 3G
const PROFILE: ProfileStep[] = [
    line(13),
    // 컨베이어 리프트 40° (가파르게 해서 같은 거리로 더 높이)
    arc(6, 40), lineTo(18.5), arc(6, 0),
    // 정상: 턴테이블에서 멈춰 180° 돌아 뒤를 보게 됨
    line(1.2), mark("turntable"), line(1.8),
    // 뒤를 본 채 42° 낙하 (약 9m) — 짧으면 뒤로 내려가는 느낌이 나지 않음
    arc(4, -42), lineTo(10.5 + arcDrop(7, 42)), arc(7, 0),
    // 리버싱 룸: 어두운 건물 안에서 다시 180° 돌아 앞을 봄
    // 낙하 바닥에서 초속 약 13m 로 내려오므로 물 저항으로 멈출 거리(약 7m)를 두고 들어감 — 짧으면 한 번에 급정지
    line(7.5), mark("room"), line(2.5),
    // 50° 큰 낙하 (약 10m) → 착수 (남은 거리는 물의 저항으로 감속하며 승강장까지 평지)
    arc(4, -50), lineTo(STATION_HEIGHT + arcDrop(11, 50)), arc(11, 0),
];

// 경로와 단면을 합친 물길 곡선 (승강장 높이로 끝나 처음과 이어짐)
export function createDuckFallTrack(): DesignedTrack {
    return designTrack(PLAN_POINTS, PROFILE, STATION_HEIGHT);
}

const MODEL_URL = `${import.meta.env.BASE_URL}models/duck_fall.glb`;
// 생성 래프트의 좌석 (가장자리 6자리 중 앞뒤·좌우 대각 4자리, 가운데를 바라봄) — 좌석 번호 순서는 코드 보트와 같음 (앞 왼쪽·앞 오른쪽·뒤 왼쪽·뒤 오른쪽)
const RAFT_SEAT_RADIUS = 0.53;
const RAFT_SEAT_HEIGHT = 0.36;
const RAFT_SEAT_ANGLES = [210, 330, 150, 30];

const TURNTABLE_SECONDS = 3.5;
const ROOM_SECONDS = 3;

const WATER_COLOR = "#48cae4";
// 물보라: 보트가 착수하는 순간 운동 에너지가 물을 밀어 올림 — 물방울은 포물선(중력)으로 날아올랐다 떨어짐
const SPLASH_DROPS = 64;
const SPLASH_SECONDS = 2;
const SPLASH_GRAVITY = 9.8;
const WOOD_COLOR = "#9c6644";
const ROCK_COLORS = ["#8d99ae", "#7d8597", "#a0a6b3"];
const ROOM_COLOR = "#5c5470";

interface SplashDrop {
    // 착수 지점 기준 초속도 (진행 방향 앞·옆으로 퍼지며 위로 솟음)
    velocity: THREE.Vector3;
    size: number;
}

// 물방울마다 고정된 초속도 (같은 순서로 만들어 모든 클라이언트에서 같은 모양)
// 양옆으로 높게 솟는 물 벽(보트가 물을 가르며 생김) + 앞으로 쏟아지는 물보라
function createSplashDrops(forward: THREE.Vector3, impact_speed: number): SplashDrop[] {
    const side = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const drops: SplashDrop[] = [];
    for (let index = 0; index < SPLASH_DROPS; index += 1) {
        const spread = ((index * 0.618) % 1) * 2 - 1;
        const lift = 0.5 + ((index * 0.381) % 1) * 0.6;
        // 빠르게 떨어질수록 높고 넓게 튐 (착수 속도에 비례)
        const velocity = new THREE.Vector3()
            .addScaledVector(side, spread * impact_speed * 0.45)
            .addScaledVector(forward, impact_speed * (0.2 + 0.3 * (1 - Math.abs(spread))))
            .setY(impact_speed * lift * (0.6 + 0.4 * Math.abs(spread)));
        drops.push({ velocity, size: 0.2 + ((index * 0.73) % 1) * 0.3 });
    }
    return drops;
}

// 리버싱 룸: 물길을 덮는 어두운 돌집 (앞뒤로 뚫림)
function createReversingRoom(position: THREE.Vector3, tangent: THREE.Vector3): THREE.Group {
    const room = new THREE.Group();
    const length = 5.5;
    for (const x of [-1.9, 1.9]) {
        addMesh(room, new THREE.BoxGeometry(0.4, 3.2, length), ROOM_COLOR, [x, 1.3, 0]);
    }
    addMesh(room, new THREE.BoxGeometry(4.4, 0.5, length + 0.4), "#3d3551", [0, 3.1, 0]);
    // 번개 장식
    addMesh(room, new THREE.BoxGeometry(0.5, 1.4, 0.2), "#ffd60a", [0, 2.2, length / 2 + 0.05], [0, 0, 0.5]);
    room.position.copy(position);
    room.rotation.y = Math.atan2(tangent.x, tangent.z);
    return room;
}

export function createDuckFall(): RideModel {
    const root = new THREE.Group();
    const track = createDuckFallTrack();
    const frames = buildPathFrames(track.curve, 480, true);
    const turntable_point = track.marks.get("turntable") ?? new THREE.Vector3();
    const room_point = track.marks.get("room") ?? new THREE.Vector3();
    const turntable_u = findNearestU(frames, turntable_point);
    const room_u = findNearestU(frames, room_point);
    // 컨베이어로 천천히 올라가 턴테이블·리버싱 룸에서 멈췄다 낙하 → 착수하면 물의 저항으로 급감속(브레이크 구간)
    // 물이 마찰·저항이 커서 코스터보다 손실이 큼. 물길 기울기도 이 계산으로 정하므로 물길보다 먼저 만듦
    const timeline = buildCoasterTimeline(frames, {
        chain_speed: 2.2,
        station_speed: 2,
        // 착수 뒤 물살을 타고 승강장으로 돌아오는 속도 (너무 느리면 커브에서 걸린 것처럼 보임)
        brake_speed: 3.5,
        // 턴테이블·리버싱 룸에서 멈춘 뒤 내리막까지 밀어 주는 물살
        hold_release_speed: 2.5,
        // 리버싱 룸 앞 물 저항 감속 (약 1.2G), 물길은 물이 쏟아지지 않게 거의 기울이지 않음
        hold_decel: 12,
        max_bank_degrees: 15,
        dwell_seconds: 4,
        rolling_friction: 0.03,
        drag: 0.004,
        brake_decel: 9,
        shake: 0.3,
        holds: [
            { u: turntable_u, seconds: TURNTABLE_SECONDS },
            { u: room_u, seconds: ROOM_SECONDS },
        ],
    });
    const thrill = createThrill();

    // 물길: 양쪽 나무 벽 + 물 띠
    root.add(createRails(frames, { gauge: 2.4, radius: 0.28, color: WOOD_COLOR }));
    root.add(createRibbon(frames, 2.3, WATER_COLOR, -0.15));
    root.add(createSupports(frames, { every: 9, radius: 0.22, color: WOOD_COLOR, min_height: 1.5 }));

    // 정상 턴테이블 (보트와 함께 도는 원판)
    const turntable = addMesh(root, new THREE.CylinderGeometry(1.9, 1.9, 0.25, 28), "#adb5bd", [turntable_point.x, turntable_point.y - 0.3, turntable_point.z]);
    const room_tangent = new THREE.Vector3();
    samplePath(frames, room_u, new THREE.Vector3(), room_tangent, new THREE.Vector3());
    const room = createReversingRoom(new THREE.Vector3(room_point.x, room_point.y - 0.6, room_point.z), room_tangent);
    root.add(room);

    // 가운데 바위산 (물길이 둘러 흐름)
    const rocks: [number, number, number, number][] = [[0, 2.5, -7, 4.5], [4.5, 1.8, -4, 3], [-4.5, 1.6, -5, 2.8], [1, 1.2, -1, 2.2]];
    rocks.forEach(([x, y, z, size], index) => {
        addMesh(root, new THREE.DodecahedronGeometry(size, 0), ROCK_COLORS[index % ROCK_COLORS.length], [x, y, z], [index, index * 0.7, 0]);
    });

    // 보트 (카트 몸체를 주황 보트로 사용)
    const boat = createCart({ rows: 2, cols: 2, body_color: "#ff9f1c", seat_color: "#2b2d42" });
    addMesh(boat.group, new THREE.BoxGeometry(2.4, 0.3, 2.8), "#f77f00", [0, 0.08, 0]);
    root.add(boat.group);

    // GLB 로 보트·리버싱 룸을 바꿔 끼움: 코드 도형은 숨기기만 함
    const room_placeholders: THREE.Object3D[] = [];
    room.traverse((node) => {
        if (node instanceof THREE.Mesh) {
            room_placeholders.push(node);
        }
    });
    const boat_placeholders: THREE.Object3D[] = [];
    boat.group.traverse((node) => {
        if (node instanceof THREE.Mesh) {
            boat_placeholders.push(node);
        }
    });
    createGltfLoader().loadAsync(MODEL_URL).then(
        (gltf) => {
            const room_model = gltf.scene.getObjectByName("df_room");
            const boat_model = gltf.scene.getObjectByName("df_boat");
            if (room_model === undefined || boat_model === undefined) {
                console.warn("[duck_fall] GLB 에 필요한 객체가 없어 코드 모델을 그대로 씁니다.");
                return;
            }
            applyGlbToonMaterials(room_model);
            applyGlbToonMaterials(boat_model);
            for (const node of [...room_placeholders, ...boat_placeholders]) {
                node.visible = false;
            }
            room.add(room_model);
            boat.group.add(boat_model);
            // 래프트 좌석 자리로 탑승자를 옮기고 가운데를 바라보게
            boat.anchors.forEach((anchor, index) => {
                const angle = THREE.MathUtils.degToRad(RAFT_SEAT_ANGLES[index] ?? 0);
                // Blender (cos, sin) → 게임 (x, −z)
                const x = Math.cos(angle) * RAFT_SEAT_RADIUS;
                const z = -Math.sin(angle) * RAFT_SEAT_RADIUS;
                anchor.position.set(x, RAFT_SEAT_HEIGHT, z);
                anchor.rotation.y = Math.atan2(-x, -z);
            });
        },
        (error: unknown) => console.warn("[duck_fall] GLB 를 불러오지 못해 코드 모델을 씁니다.", error),
    );

    // 착수 지점·시각·속도 → 물보라 (시각의 순수 함수: 착수 후 경과 시간으로 물방울 위치 계산)
    const splash_u = findDropBottomU(frames, 0.9);
    const splash_time = timeline.timeOfU(splash_u);
    const splash_point = new THREE.Vector3();
    const splash_forward = new THREE.Vector3();
    samplePath(frames, splash_u, splash_point, splash_forward, new THREE.Vector3());
    splash_forward.setY(0).normalize();
    // 착수 웅덩이
    addMesh(root, new THREE.CylinderGeometry(4.2, 4.4, 0.35, 32), WATER_COLOR, [splash_point.x, 0.18, splash_point.z]);
    addMesh(root, new THREE.TorusGeometry(4.3, 0.3, 8, 32), "#6c757d", [splash_point.x, 0.3, splash_point.z], [Math.PI / 2, 0, 0]);
    timeline.thrillAt(splash_time - 0.05, thrill);
    const drops = createSplashDrops(splash_forward, thrill.speed);
    const spray = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), getMaterial("#e0fbfc", 0.25), SPLASH_DROPS);
    spray.frustumCulled = false;
    root.add(spray);
    // 착수 순간 퍼지는 물결 고리
    const ripple = addMesh(root, new THREE.TorusGeometry(1, 0.12, 6, 28), "#caf0f8", [splash_point.x, 0.4, splash_point.z], [Math.PI / 2, 0, 0]);
    const dummy = new THREE.Object3D();

    function updateSplash(time: number): void {
        const elapsed = (((time - splash_time) % timeline.duration) + timeline.duration) % timeline.duration;
        const active = elapsed < SPLASH_SECONDS;
        ripple.visible = active;
        spray.visible = active;
        if (!active) {
            return;
        }
        const fade = 1 - elapsed / SPLASH_SECONDS;
        ripple.scale.setScalar(1 + elapsed * 4);
        drops.forEach((drop, index) => {
            dummy.position.copy(splash_point).addScaledVector(drop.velocity, elapsed);
            dummy.position.y += -0.5 * SPLASH_GRAVITY * elapsed * elapsed;
            // 물에 다시 떨어진 물방울은 수면 아래로 숨김
            dummy.scale.setScalar(dummy.position.y < 0.3 ? 0 : drop.size * (0.6 + fade));
            dummy.updateMatrix();
            spray.setMatrixAt(index, dummy.matrix);
        });
        spray.instanceMatrix.needsUpdate = true;
    }

    return {
        id: RIDE_ID.DUCK_FALL,
        root,
        seat_anchors: boat.anchors,
        thrill,
        update(time) {
            placeOnPath(boat.group, frames, timeline.uAt(time), -0.05);
            timeline.thrillAt(time, thrill);
            // 턴테이블·리버싱 룸을 지날 때마다 반 바퀴씩: 첫 정차 뒤엔 뒤를 보고 내려가고, 두 번째 정차에서 다시 앞을 봄
            const hold = timeline.holdStateAt(time);
            const yaw = Math.PI * (hold.passed + hold.progress);
            boat.group.rotateY(yaw);
            turntable.rotation.y = hold.passed === 0 ? Math.PI * hold.progress : Math.PI;
            // 물 위에서 살짝 출렁임
            boat.group.position.y += Math.sin(time * 3) * 0.05;
            updateSplash(time);
        },
    };
}
