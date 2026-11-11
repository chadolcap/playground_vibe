// 내 위치 전송 — 초당 MOVE_RULE.SEND_RATE 회 이하, 위치·방향·동작이 바뀌었을 때만
import type { Room } from "@colyseus/sdk";
import { CLIENT_MESSAGE, MOVE_RULE, PLAYER_ANIM, type MovePayload } from "@shared";
import type { LocalPlayer } from "./localPlayer";

// 이보다 작은 변화는 보내지 않음
const POSITION_EPSILON = 0.01;
const ROTATION_EPSILON = 0.02;

export interface PositionSender {
    update(delta: number): void;
    // 서버가 위치를 되돌렸을 때 — 마지막 전송값을 서버 위치로 맞춤
    resetTo(x: number, z: number): void;
}

export function createPositionSender(room: Room, local_player: LocalPlayer): PositionSender {
    const interval = 1 / MOVE_RULE.SEND_RATE;
    let elapsed = 0;
    let last_sent: MovePayload | null = null;

    function hasChanged(next: MovePayload): boolean {
        if (last_sent === null) {
            return true;
        }
        return Math.abs(next.x - last_sent.x) > POSITION_EPSILON
            || Math.abs(next.z - last_sent.z) > POSITION_EPSILON
            || Math.abs(next.rot_y - last_sent.rot_y) > ROTATION_EPSILON
            || next.anim !== last_sent.anim;
    }

    return {
        update(delta) {
            elapsed += delta;
            // 탑승 중에는 위치가 좌석으로 정해지므로 전송하지 않음 (서버도 무시)
            if (elapsed < interval || local_player.locked) {
                return;
            }
            elapsed = 0;
            const root = local_player.avatar.root;
            const anim = local_player.avatar.anim === PLAYER_ANIM.WALK ? PLAYER_ANIM.WALK : PLAYER_ANIM.IDLE;
            const next: MovePayload = { x: root.position.x, z: root.position.z, rot_y: root.rotation.y, anim };
            if (hasChanged(next)) {
                room.send(CLIENT_MESSAGE.MOVE, next);
                last_sent = next;
            }
        },
        resetTo(x, z) {
            if (last_sent !== null) {
                last_sent = { ...last_sent, x, z };
            }
        },
    };
}
