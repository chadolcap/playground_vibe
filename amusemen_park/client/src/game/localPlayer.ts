// 내 오리 조작 — 입력(키보드+조이스틱)을 카메라 기준 방향으로 바꿔 이동·회전, 맵 경계 안으로 제한
// 자동 걷기: 목적지(클릭 지점, 두 번 클릭이면 달리기)가 있으면 직접 조작이 없을 때 그곳까지 걸어감 (직접 조작하면 취소)
//   칸 지도(navGrid)로 기구·수레·바위를 돌아가는 길을 찾아 따라감, 목적지가 기구 위면 내 쪽 가장 가까운 기구 앞까지
//   그래도 오래 가까워지지 못하면 취소
import * as THREE from "three";
import { MAP_EDGE_MARGIN, MAP_HALF, MOVE_RULE, PLAYER_ANIM, type PlayerAnim } from "@shared";
import { EMOTE_SECONDS } from "../character/duckAnimation";
import type { DuckAvatar } from "../character/duckAvatar";
import type { MoveInput } from "../controls/keyboardInput";
import type { NavGrid } from "../world/navGrid";

// 이보다 약한 입력은 정지로 봄
const INPUT_THRESHOLD = 0.08;
// 몸을 진행 방향으로 돌리는 빠르기
const TURN_RATE = 12;
// 목적지에 이만큼 가까워지면 도착
const ARRIVE_DISTANCE = 0.3;
// 이 시간(초) 동안 목적지에 이만큼(m)도 가까워지지 못하면 갈 수 없는 곳으로 보고 자동 걷기 취소
const STUCK_SECONDS = 2;
const STUCK_PROGRESS = 0.3;
// 실제 이동 빠르기가 입력 빠르기의 이 비율보다 작은 상태가 이 시간(초)을 넘으면 막힌 것으로 보고 서 있는 동작
const BLOCKED_RATIO = 0.25;
const BLOCKED_SECONDS = 0.15;

export interface LocalPlayer {
    readonly avatar: DuckAvatar;
    // 탑승 중이면 조작을 막음 (7단계에서 사용)
    locked: boolean;
    // 자동 걷기 목적지 (없으면 null)
    readonly destination: { x: number; z: number } | null;
    // run: 달려서 감 (PC 두 번 클릭)
    setDestination(x: number, z: number, run?: boolean): void;
    clearDestination(): void;
    // 캐릭터 동작 메뉴에서 고른 동작 (없으면 null) — 움직이거나 탑승하면 취소
    readonly emote: PlayerAnim | null;
    // 바닥 앉기(SIT_GROUND)는 계속 유지, 인사·점프·먹기는 EMOTE_SECONDS 동안 하고 끝남 (하는 중이면 무시)
    playEmote(anim: PlayerAnim): void;
    // 바닥에 앉아 있으면 일어섬
    standUp(): void;
    update(inputs: readonly MoveInput[], camera_yaw: number, delta: number, time: number): void;
}

// 두 각도 사이 가장 짧은 회전 방향으로 보간
function turnToward(current: number, target: number, ratio: number): number {
    const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + difference * ratio;
}

function combineInputs(inputs: readonly MoveInput[]): MoveInput {
    let x = 0;
    let y = 0;
    // 움직이는 입력 중 하나라도 달리기면 달림
    let run = false;
    for (const input of inputs) {
        x += input.x;
        y += input.y;
        run ||= input.run === true && Math.hypot(input.x, input.y) >= INPUT_THRESHOLD;
    }
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length, run } : { x, y, run };
}

// push_out: 지나갈 수 없는 곳(바위)에 들어간 위치를 밖으로 밀어냄, 빠져나오지 못하면 이동 전 위치로 (밀어냈으면 true)
// nav: 지나갈 수 없는 칸 지도 (groundMap.nav — 자동 걷기 길찾기, 없으면 곧장 감)
export function createLocalPlayer(
    avatar: DuckAvatar,
    push_out: (position: THREE.Vector3, from_x: number, from_z: number) => boolean = () => false,
    nav: NavGrid | null = null,
): LocalPlayer {
    const limit = MAP_HALF - MAP_EDGE_MARGIN;
    const move = new THREE.Vector3();
    let destination: { x: number; z: number } | null = null;
    // 자동 걷기를 달려서 가는지
    let destination_run = false;
    // 자동 걷기 경로 꺾임점 (마지막 = 목적지)과 지금 향하는 꺾임점 번호
    let path: { x: number; z: number }[] = [];
    let path_index = 0;
    const to_destination = new THREE.Vector3();
    // 자동 걷기 막힘 판정: 지금까지 가장 가까웠던 남은 거리와, 그 뒤로 더 가까워지지 못한 시간
    let best_remaining = Infinity;
    let stuck_time = 0;
    // 정면으로 막혀 거의 못 움직인 시간 (걷는 동작을 멈추는 판정)
    let blocked_time = 0;
    let emote: PlayerAnim | null = null;
    // 한 번 하는 동작의 남은 시간(초)
    let emote_left = 0;

    const player: LocalPlayer = {
        avatar,
        locked: false,
        get destination() {
            return destination;
        },
        setDestination(x, z, run = false) {
            const root = avatar.root.position;
            const clamped_x = THREE.MathUtils.clamp(x, -limit, limit);
            const clamped_z = THREE.MathUtils.clamp(z, -limit, limit);
            // 기구·수레 위(벽 안·벽에 둘러싸인 곳)를 찍었으면 내 쪽으로 가장 가까운 갈 수 있는 자리(기구 바로 앞)까지, 그곳까지 돌아가는 길을 찾음
            destination = nav === null ? { x: clamped_x, z: clamped_z } : nav.nearestReachable(clamped_x, clamped_z, root.x, root.z);
            path = nav?.findPath(root.x, root.z, destination.x, destination.z) ?? [destination];
            path_index = 0;
            destination_run = run;
            best_remaining = Infinity;
            stuck_time = 0;
        },
        clearDestination() {
            destination = null;
        },
        get emote() {
            return emote;
        },
        playEmote(anim) {
            if (player.locked || anim === emote) {
                return;
            }
            emote = anim;
            emote_left = EMOTE_SECONDS[anim] ?? 0;
            // 제자리에서 하는 동작이므로 자동 걷기는 멈춤
            destination = null;
        },
        standUp() {
            if (emote === PLAYER_ANIM.SIT_GROUND) {
                emote = null;
            }
        },
        update(inputs, camera_yaw, delta, time) {
            const input = combineInputs(inputs);
            const strength = Math.hypot(input.x, input.y);
            const root = avatar.root;
            // 직접 조작하거나 탑승하면 자동 걷기 취소
            if (player.locked || strength >= INPUT_THRESHOLD) {
                destination = null;
            }
            // 움직이거나 탑승하면 동작 취소, 한 번 하는 동작은 시간이 다 되면 끝남
            if (emote !== null && emote !== PLAYER_ANIM.SIT_GROUND) {
                emote_left -= delta;
            }
            if (player.locked || strength >= INPUT_THRESHOLD || destination !== null || (emote !== PLAYER_ANIM.SIT_GROUND && emote_left <= 0)) {
                emote = null;
            }
            let speed: number;
            if (!player.locked && strength >= INPUT_THRESHOLD) {
                // 카메라가 바라보는 방향 = 앞, 그 오른쪽 = 오른쪽 (땅 위 평면 기준)
                const forward_x = -Math.sin(camera_yaw);
                const forward_z = -Math.cos(camera_yaw);
                move.set(forward_x * input.y - forward_z * input.x, 0, forward_z * input.y + forward_x * input.x);
                speed = (input.run === true ? MOVE_RULE.RUN_SPEED : MOVE_RULE.MAX_SPEED) * Math.min(strength, 1);
            } else if (destination !== null) {
                // 지금 꺾임점에 닿으면 다음 꺾임점으로 (마지막 꺾임점 = 목적지)
                let waypoint = path[path_index] ?? destination;
                to_destination.set(waypoint.x - root.position.x, 0, waypoint.z - root.position.z);
                while (to_destination.length() <= ARRIVE_DISTANCE && path_index < path.length - 1) {
                    path_index += 1;
                    waypoint = path[path_index];
                    to_destination.set(waypoint.x - root.position.x, 0, waypoint.z - root.position.z);
                    best_remaining = Infinity;
                }
                const remaining = to_destination.length();
                const is_last = path_index >= path.length - 1;
                // 한동안 지금 꺾임점에 가까워지지 못하면(막힌 곳) 취소
                if (remaining < best_remaining - STUCK_PROGRESS) {
                    best_remaining = remaining;
                    stuck_time = 0;
                } else {
                    stuck_time += delta;
                }
                if ((is_last && remaining <= ARRIVE_DISTANCE) || stuck_time > STUCK_SECONDS) {
                    destination = null;
                    speed = 0;
                } else {
                    move.copy(to_destination);
                    const top_speed = destination_run ? MOVE_RULE.RUN_SPEED : MOVE_RULE.MAX_SPEED;
                    // 마지막 한 걸음은 남은 거리만큼만 (지나치지 않게), 꺾임점에서는 그대로 지나가며 방향만 바꿈
                    speed = is_last ? Math.min(top_speed, remaining / Math.max(delta, 1e-3)) : top_speed;
                }
            } else {
                speed = 0;
            }
            if (speed === 0) {
                avatar.anim = player.locked ? avatar.anim : (emote ?? PLAYER_ANIM.IDLE);
                avatar.speed = 0;
                avatar.update(delta, time);
                return;
            }
            move.normalize();

            const before_x = root.position.x;
            const before_z = root.position.z;
            root.position.x = THREE.MathUtils.clamp(root.position.x + move.x * speed * delta, -limit, limit);
            root.position.z = THREE.MathUtils.clamp(root.position.z + move.z * speed * delta, -limit, limit);
            // 바위·수레에 막히면 가장자리를 따라 미끄러짐 (자동 걷기는 미리 비켜 가고, 오래 못 가까워지면 위에서 취소)
            push_out(root.position, before_x, before_z);
            root.rotation.y = turnToward(root.rotation.y, Math.atan2(move.x, move.z), 1 - Math.exp(-TURN_RATE * delta));

            // 실제로 움직인 빠르기 — 수레·바위에 정면으로 막혀 거의 못 가면 걷는 동작 대신 서 있음
            // (가장자리를 따라 미끄러지는 것은 걷기, 한 프레임 흔들림으로 깜빡이지 않게 BLOCKED_SECONDS 넘게 막혀야 멈춤)
            const actual_speed = Math.hypot(root.position.x - before_x, root.position.z - before_z) / Math.max(delta, 1e-3);
            blocked_time = actual_speed < speed * BLOCKED_RATIO ? blocked_time + delta : 0;
            const is_blocked = blocked_time > BLOCKED_SECONDS;
            avatar.anim = is_blocked ? (emote ?? PLAYER_ANIM.IDLE) : PLAYER_ANIM.WALK;
            avatar.speed = is_blocked ? 0 : Math.min(actual_speed, MOVE_RULE.RUN_SPEED);
            avatar.update(delta, time);
        },
    };
    return player;
}
