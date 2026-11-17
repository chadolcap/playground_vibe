// 탑승 중인 오리를 기구 좌석 앵커 위치·방향에 맞춰 앉힘 (기구와 함께 움직임)
import * as THREE from "three";
import { isRideId } from "@shared";
import type { DuckAvatar } from "../character/duckAvatar";
import { DUCK_SEAT_OFFSET } from "../character/duckModel";
import type { ParkWorld } from "../world/parkWorld";

const temp_up = new THREE.Vector3();
// 에어타임(1G 미만)일 때 좌석에서 떠오르는 최대 높이 — 안전바에 걸린 만큼만
const MAX_AIRTIME_LIFT = 0.2;
const AIRTIME_LIFT_PER_G = 0.18;
// 신남 정도를 정하는 기준: 이 속도·G 에 가까울수록 날개를 번쩍 듦
const EXCITED_SPEED = 20;
const EXCITED_HIGH_G = 3;

// 성공하면 true — 기구·좌석을 찾지 못하면 false (호출 측에서 걸어 다니는 상태로 처리)
export function placeOnSeat(avatar: DuckAvatar, world: ParkWorld, ride_id: string, seat_index: number): boolean {
    if (!isRideId(ride_id)) {
        return false;
    }
    const anchor = world.rides.get(ride_id)?.seat_anchors[seat_index];
    if (anchor === undefined) {
        return false;
    }
    anchor.getWorldPosition(avatar.root.position);
    anchor.getWorldQuaternion(avatar.root.quaternion);
    // 좌석의 "위" 방향으로 살짝 올림 (루프에서 거꾸로 돌 때도 좌석에 붙어 있도록)
    temp_up.set(0, 1, 0).applyQuaternion(avatar.root.quaternion);
    avatar.root.position.addScaledVector(temp_up, DUCK_SEAT_OFFSET);
    // 스릴 기구: 방 시각으로 계산된 G·속도라 모든 화면에서 같은 순간 같은 반응
    const thrill = world.rides.get(ride_id)?.thrill;
    if (thrill !== undefined) {
        const lift = THREE.MathUtils.clamp((1 - thrill.g_force) * AIRTIME_LIFT_PER_G, 0, MAX_AIRTIME_LIFT);
        avatar.root.position.addScaledVector(temp_up, lift);
        const floating = (1 - thrill.g_force) / (1 - 0.2);
        const pressed = (thrill.g_force - 1.5) / (EXCITED_HIGH_G - 1.5);
        avatar.excitement = THREE.MathUtils.clamp(Math.max(floating, pressed, thrill.speed / EXCITED_SPEED), 0, 1);
    }
    return true;
}
