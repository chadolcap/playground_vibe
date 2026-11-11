// 탑승 중인 오리를 기구 좌석 앵커 위치·방향에 맞춰 앉힘 (기구와 함께 움직임)
import * as THREE from "three";
import { isRideId } from "@shared";
import type { DuckAvatar } from "../character/duckAvatar";
import { DUCK_SEAT_OFFSET } from "../character/duckModel";
import type { ParkWorld } from "../world/parkWorld";

const temp_up = new THREE.Vector3();

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
    return true;
}
