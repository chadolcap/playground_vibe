// 놀이기구 탑승 — 게이트 근처 판정, 타기/내리기 요청, 좌석에 앉히기, 우측 상단 탑승 시점 카메라
import * as THREE from "three";
import type { Room } from "@colyseus/sdk";
import {
    CLIENT_MESSAGE,
    ERROR_CODE,
    PLAYER_ANIM,
    RIDES,
    RIDE_LIST,
    SEAT_KIND,
    isNearRide,
    type RideBoardResult,
    type RideId,
    type RideInfo,
    type RideLeaveResult,
} from "@shared";
import type { ActionItem } from "../ui/actionBar";
import type { ParkWorld } from "../world/parkWorld";
import type { LocalPlayer } from "./localPlayer";
import type { PositionSender } from "./positionSender";
import { createRideHaptics } from "./rideHaptics";
import { placeOnSeat } from "./seatPlacement";

// 서버 판정(기구 근처)보다 조금 안쪽에서만 버튼을 띄움 — 서버 위치가 최대 1/15초 늦기 때문
const CLIENT_RADIUS_MARGIN = 0.6;
// 탑승 시점 카메라: 좌석 앵커 기준 눈 높이·앞쪽 거리 (오리 머리보다 살짝 앞)
const RIDER_EYE_HEIGHT = 1.05;
const RIDER_EYE_FORWARD = 0.65;
const HALF_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
// 탑승 시점 스릴 연출 (보이는 것만 바꾸고 기구·좌석 위치는 그대로)
// - 속도감: 빠를수록 시야각을 넓혀 풍경이 옆으로 빨리 흘러가 보이게
// - 체감 G: 1G 미만(에어타임)이면 시선이 붕 뜨고, 고G 면 짓눌려 내려감
// - 진동: 레일 이음매를 지나는 덜컹거림
const RIDER_BASE_FOV = 70;
const FOV_PER_SPEED = 0.9;
const MAX_FOV_BOOST = 24;
const G_HEAD_SHIFT = 0.12;
const SHAKE_AMOUNT = 0.07;
const MS_TO_KMH = 3.6;
const AIRTIME_G = 0.3;
const HIGH_G = 3;

const RIDE_ERROR_TEXT: Record<string, string> = {
    [ERROR_CODE.RIDE_FULL]: "만석이에요! 잠시 후 다시 타 보거나 다른 놀이기구를 타 보세요.",
    [ERROR_CODE.RIDE_TOO_FAR]: "놀이기구 입구에 조금 더 가까이 가서 타 주세요.",
    [ERROR_CODE.ALREADY_RIDING]: "이미 놀이기구에 타고 있어요.",
    [ERROR_CODE.NOT_RIDING]: "타고 있는 놀이기구가 없어요.",
    [ERROR_CODE.UNKNOWN_RIDE]: "알 수 없는 놀이기구예요.",
};
const REQUEST_FAIL_TEXT = "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

interface Riding {
    ride_id: RideId;
    seat_index: number;
}

interface SeatState {
    kind: string;
}

export interface RideController {
    readonly riding: Riding | null;
    // 매 프레임 (기구 애니메이션 갱신 후): 탑승 중이면 좌석에 앉히고 인셋 카메라 갱신
    update(): void;
    // 지금 누를 수 있는 버튼 (타기 / 내리기)
    getActions(): ActionItem[];
    dispose(): void;
}

export interface RideControllerOptions {
    world: ParkWorld;
    room: Room;
    local_player: LocalPlayer;
    position_sender: PositionSender;
    notify: (text: string) => void;
}

function toErrorText(error: unknown): string {
    return error instanceof Error ? RIDE_ERROR_TEXT[error.message] ?? REQUEST_FAIL_TEXT : REQUEST_FAIL_TEXT;
}

export function createRideController(options: RideControllerOptions): RideController {
    const { world, room, local_player, position_sender, notify } = options;
    const avatar = local_player.avatar;
    const rider_camera = new THREE.PerspectiveCamera(70, 4 / 3, 0.1, 500);
    const temp_offset = new THREE.Vector3();

    let riding: Riding | null = null;
    let is_pending = false;
    // 모바일: 덜컹거림·체인·브레이크를 휴대폰 진동으로
    const haptics = createRideHaptics();

    // 스릴 기구면 탑승 시점 카메라에 속도·G·진동을 입히고 계기를 표시 (느린 관람 기구는 그대로)
    // 탑승 시점 시야각 설정 (바뀔 때만 투영 행렬 갱신)
    function setRiderFov(fov: number): void {
        if (Math.abs(rider_camera.fov - fov) > 0.05) {
            rider_camera.fov = fov;
            rider_camera.updateProjectionMatrix();
        }
    }

    function applyThrill(ride_id: RideId): void {
        const thrill = world.rides.get(ride_id)?.thrill;
        if (thrill === undefined) {
            // 관람 기구는 기본 시야각 (스릴 기구에서 넓어진 채 남지 않게)
            setRiderFov(RIDER_BASE_FOV);
            world.setInsetCaption(null);
            return;
        }
        setRiderFov(RIDER_BASE_FOV + Math.min(thrill.speed * FOV_PER_SPEED, MAX_FOV_BOOST));
        const head_shift = THREE.MathUtils.clamp((1 - thrill.g_force) * G_HEAD_SHIFT, -0.2, 0.25);
        // 진동은 방 시각과 무관한 화면 효과라 로컬 시계로 충분
        const now = performance.now() / 1000;
        haptics.update(thrill, now);
        const shake = thrill.shake * SHAKE_AMOUNT;
        temp_offset.set(Math.sin(now * 41) * shake, head_shift + Math.sin(now * 53) * shake, 0).applyQuaternion(avatar.root.quaternion);
        rider_camera.position.add(temp_offset);
        rider_camera.rotateZ(Math.sin(now * 29) * shake * 0.5);

        const speed_text = `${Math.round(thrill.speed * MS_TO_KMH)} km/h · ${thrill.g_force.toFixed(1)}G`;
        const badge = thrill.speed > 0 && thrill.g_force < AIRTIME_G ? "🪶 에어타임! " : thrill.g_force >= HIGH_G ? "💥 " : "";
        world.setInsetCaption(badge + speed_text);
    }

    // 서버 상태의 빈자리 수 (버튼에 표시)
    function countEmptySeats(ride_id: RideId): number {
        const seats = (room.state as { rides?: Map<string, { seats: Iterable<SeatState> }> }).rides?.get(ride_id)?.seats;
        if (seats === undefined) {
            return 0;
        }
        let count = 0;
        for (const seat of seats) {
            if (seat.kind === SEAT_KIND.EMPTY) {
                count += 1;
            }
        }
        return count;
    }

    // 입구 또는 기구 영역 가까이 있는 기구 중 중심이 가장 가까운 것 (서버와 같은 규칙, 조금 엄격하게)
    function findNearbyRide(): RideInfo | null {
        const position = avatar.root.position;
        let nearest: RideInfo | null = null;
        let nearest_distance = Infinity;
        for (const ride of RIDE_LIST) {
            if (!isNearRide(ride, position.x, position.z, CLIENT_RADIUS_MARGIN)) {
                continue;
            }
            const distance = Math.hypot(position.x - ride.x, position.z - ride.z);
            if (distance < nearest_distance) {
                nearest = ride;
                nearest_distance = distance;
            }
        }
        return nearest;
    }

    async function board(ride_id: RideId): Promise<void> {
        is_pending = true;
        try {
            const result = await room.request<{ ride_id: RideId }, RideBoardResult>(CLIENT_MESSAGE.RIDE_BOARD, { ride_id });
            riding = { ride_id, seat_index: result.seat_index };
            local_player.locked = true;
            avatar.anim = PLAYER_ANIM.SIT;
            world.setInsetCamera(rider_camera);
            notify(`🎢 ${RIDES[ride_id].name}에 탔어요! 오른쪽 위 화면에서 탑승 시점을 볼 수 있어요.`);
        } catch (error) {
            notify(toErrorText(error));
        } finally {
            is_pending = false;
        }
    }

    async function leave(): Promise<void> {
        if (riding === null) {
            return;
        }
        is_pending = true;
        const ride_id = riding.ride_id;
        try {
            const result = await room.request<undefined, RideLeaveResult>(CLIENT_MESSAGE.RIDE_LEAVE);
            riding = null;
            world.setInsetCamera(null);
            world.setInsetCaption(null);
            haptics.stop();
            // 다음 탑승은 기본 시야각에서 시작
            setRiderFov(RIDER_BASE_FOV);
            // 좌석에서 기울어졌던 자세를 바로 세우고, 기구 반대편(통로 쪽)을 바라보며 내림
            const ride = RIDES[ride_id];
            avatar.root.position.set(result.x, 0, result.z);
            avatar.root.rotation.set(0, Math.atan2(result.x - ride.x, result.z - ride.z), 0);
            avatar.anim = PLAYER_ANIM.IDLE;
            local_player.locked = false;
            position_sender.resetTo(result.x, result.z);
        } catch (error) {
            notify(toErrorText(error));
        } finally {
            is_pending = false;
        }
    }

    return {
        get riding() {
            return riding;
        },
        update() {
            if (riding === null) {
                return;
            }
            // 기구 애니메이션이 먼저 갱신된 뒤 호출되므로 이번 프레임의 좌석 위치에 정확히 앉음
            if (!placeOnSeat(avatar, world, riding.ride_id, riding.seat_index)) {
                return;
            }
            // 앉기 동작 재생은 localPlayer.update(잠금 상태)가 담당
            avatar.anim = PLAYER_ANIM.SIT;
            // 탑승 시점: 좌석 정면(+z)을 바라보는 카메라 (카메라는 기본이 -z 를 보므로 반 바퀴 돌림)
            rider_camera.quaternion.copy(avatar.root.quaternion).multiply(HALF_TURN);
            temp_offset.set(0, RIDER_EYE_HEIGHT, RIDER_EYE_FORWARD).applyQuaternion(avatar.root.quaternion);
            rider_camera.position.copy(avatar.root.position).add(temp_offset);
            applyThrill(riding.ride_id);
        },
        getActions() {
            if (riding !== null) {
                return [{ id: "ride_leave", label: "🛑 내리기", disabled: is_pending, onClick: () => void leave() }];
            }
            const ride = findNearbyRide();
            if (ride === null) {
                return [];
            }
            const empty = countEmptySeats(ride.id);
            const label = empty > 0 ? `🎢 ${ride.name} 타기 (빈자리 ${empty})` : `🎢 ${ride.name} 만석`;
            return [{ id: `ride_board:${ride.id}`, label, disabled: is_pending || empty === 0, onClick: () => void board(ride.id) }];
        },
        dispose() {
            world.setInsetCamera(null);
            world.setInsetCaption(null);
            haptics.stop();
        },
    };
}
