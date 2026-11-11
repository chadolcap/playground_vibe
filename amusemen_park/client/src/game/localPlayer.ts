// 내 오리 조작 — 입력(키보드+조이스틱)을 카메라 기준 방향으로 바꿔 이동·회전, 맵 경계 안으로 제한
// 자동 걷기: 목적지(더블클릭 지점)가 있으면 직접 조작이 없을 때 그곳까지 걸어감 (직접 조작하면 취소)
import * as THREE from "three";
import { MAP_EDGE_MARGIN, MAP_HALF, MOVE_RULE, PLAYER_ANIM } from "@shared";
import type { DuckAvatar } from "../character/duckAvatar";
import type { MoveInput } from "../controls/keyboardInput";

// 이보다 약한 입력은 정지로 봄
const INPUT_THRESHOLD = 0.08;
// 몸을 진행 방향으로 돌리는 빠르기
const TURN_RATE = 12;
// 목적지에 이만큼 가까워지면 도착
const ARRIVE_DISTANCE = 0.3;

export interface LocalPlayer {
    readonly avatar: DuckAvatar;
    // 탑승 중이면 조작을 막음 (7단계에서 사용)
    locked: boolean;
    // 자동 걷기 목적지 (없으면 null)
    readonly destination: { x: number; z: number } | null;
    setDestination(x: number, z: number): void;
    clearDestination(): void;
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
    for (const input of inputs) {
        x += input.x;
        y += input.y;
    }
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

export function createLocalPlayer(avatar: DuckAvatar): LocalPlayer {
    const limit = MAP_HALF - MAP_EDGE_MARGIN;
    const move = new THREE.Vector3();
    let destination: { x: number; z: number } | null = null;

    const player: LocalPlayer = {
        avatar,
        locked: false,
        get destination() {
            return destination;
        },
        setDestination(x, z) {
            destination = { x: THREE.MathUtils.clamp(x, -limit, limit), z: THREE.MathUtils.clamp(z, -limit, limit) };
        },
        clearDestination() {
            destination = null;
        },
        update(inputs, camera_yaw, delta, time) {
            const input = combineInputs(inputs);
            const strength = Math.hypot(input.x, input.y);
            const root = avatar.root;
            // 직접 조작하거나 탑승하면 자동 걷기 취소
            if (player.locked || strength >= INPUT_THRESHOLD) {
                destination = null;
            }
            let speed: number;
            if (!player.locked && strength >= INPUT_THRESHOLD) {
                // 카메라가 바라보는 방향 = 앞, 그 오른쪽 = 오른쪽 (땅 위 평면 기준)
                const forward_x = -Math.sin(camera_yaw);
                const forward_z = -Math.cos(camera_yaw);
                move.set(forward_x * input.y - forward_z * input.x, 0, forward_z * input.y + forward_x * input.x);
                speed = MOVE_RULE.MAX_SPEED * Math.min(strength, 1);
            } else if (destination !== null) {
                move.set(destination.x - root.position.x, 0, destination.z - root.position.z);
                const remaining = move.length();
                if (remaining <= ARRIVE_DISTANCE) {
                    destination = null;
                    speed = 0;
                } else {
                    // 마지막 한 걸음은 남은 거리만큼만 (지나치지 않게)
                    speed = Math.min(MOVE_RULE.MAX_SPEED, remaining / Math.max(delta, 1e-3));
                }
            } else {
                speed = 0;
            }
            if (speed === 0) {
                avatar.anim = player.locked ? avatar.anim : PLAYER_ANIM.IDLE;
                avatar.speed = 0;
                avatar.update(delta, time);
                return;
            }
            move.normalize();

            root.position.x = THREE.MathUtils.clamp(root.position.x + move.x * speed * delta, -limit, limit);
            root.position.z = THREE.MathUtils.clamp(root.position.z + move.z * speed * delta, -limit, limit);
            root.rotation.y = turnToward(root.rotation.y, Math.atan2(move.x, move.z), 1 - Math.exp(-TURN_RATE * delta));

            avatar.anim = PLAYER_ANIM.WALK;
            avatar.speed = Math.min(speed, MOVE_RULE.MAX_SPEED);
            avatar.update(delta, time);
        },
    };
    return player;
}
