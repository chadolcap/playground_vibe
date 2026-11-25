// 놀이기구 ID, 좌석 수, 배치 좌표
import { PARK_HUB } from "./zones";

export const RIDE_ID = {
    DUCK_TWIST: "duck_twist",
    DUCK_FALL: "duck_fall",
    CRAZY_BUMP: "crazy_bump",
    DUCK_X: "duck_x",
    DUCK_VOYAGE: "duck_voyage",
    CAROUSEL: "carousel",
} as const;

export type RideId = (typeof RIDE_ID)[keyof typeof RIDE_ID];

export interface RideInfo {
    id: RideId;
    name: string;
    // 좌석 수 (NPC + 플레이어 합산 최대 인원)
    seat_count: number;
    // NPC 가 미리 앉아 있는 좌석 수
    npc_count: number;
    // 기구 중심 좌표
    x: number;
    z: number;
    // 탑승·하차 게이트(기구 앞) 기준 상호작용 가능 거리
    board_radius: number;
    // 기구 모델이 차지하는 반경 (다른 기구·길·나무가 들어오면 안 되는 영역)
    footprint_radius: number;
    // NPC 가 앉을 좌석 번호 (없으면 좌석 전체에 고르게) — 플레이어는 항상 앞 번호의 빈 좌석부터 앉음
    npc_seats?: readonly number[];
}

// 배치: 분수대 광장(PARK_HUB) 둘레에 안쪽 기구(DUCK VOYAGE·CRAZY BUMP·회전목마), 바깥쪽 기구(DUCK-X·DUCK FALL·DUCK TWIST)
export const RIDES: Record<RideId, RideInfo> = {
    duck_twist: { id: "duck_twist", name: "DUCK TWIST", seat_count: 8, npc_count: 2, x: 44, z: 32, board_radius: 8, footprint_radius: 11 },
    duck_fall: { id: "duck_fall", name: "DUCK FALL", seat_count: 4, npc_count: 1, x: 42, z: -46, board_radius: 8, footprint_radius: 22 },
    crazy_bump: { id: "crazy_bump", name: "CRAZY BUMP", seat_count: 8, npc_count: 2, x: 38, z: -2, board_radius: 8, footprint_radius: 12 },
    duck_x: { id: "duck_x", name: "DUCK-X", seat_count: 12, npc_count: 3, x: -37, z: -8, board_radius: 8, footprint_radius: 33 },
    // 스윙 보트 — 좌석 번호는 배의 양 끝 줄부터(0~3), 가운데 줄이 마지막(8·9). NPC 는 가운데에 앉혀 플레이어가 양 끝(가장 높이 올라가는 자리)부터 앉게 함
    duck_voyage: { id: "duck_voyage", name: "DUCK VOYAGE", seat_count: 10, npc_count: 2, x: 6, z: -36, board_radius: 8, footprint_radius: 13, npc_seats: [8, 9] },
    carousel: { id: "carousel", name: "회전목마", seat_count: 12, npc_count: 3, x: -4, z: 24, board_radius: 8, footprint_radius: 8 },
};

export const RIDE_LIST: readonly RideInfo[] = Object.values(RIDES);

// 게이트가 기구 중심에서 떨어진 거리 (기구 모델 바깥, 맵 중앙 방향)
export const RIDE_GATE_DISTANCE = 14;

// NPC 가 앉을 좌석 번호 목록 — npc_seats 가 있으면 검증해서 쓰고, 없으면 좌석 전체에 고르게 흩어 앉힘
// 잘못된 데이터(개수 불일치·범위 밖·정수 아님·중복)는 방을 만들다 엉뚱한 곳에서 터지지 않게 바로 오류로 알림
export function getNpcSeats(ride: RideInfo): number[] {
    if (ride.npc_seats === undefined) {
        return Array.from({ length: ride.npc_count }, (_, order) => Math.floor((order * ride.seat_count) / ride.npc_count));
    }
    const seats = [...ride.npc_seats];
    const is_valid = seats.length === ride.npc_count
        && seats.every((seat) => Number.isInteger(seat) && seat >= 0 && seat < ride.seat_count)
        && new Set(seats).size === seats.length;
    if (!is_valid) {
        throw new Error(`[rides] ${ride.id} 의 npc_seats ${JSON.stringify(seats)} 가 잘못됨 (NPC ${ride.npc_count}명, 좌석 0~${ride.seat_count - 1}, 중복 불가)`);
    }
    return seats;
}

export function isRideId(value: unknown): value is RideId {
    return typeof value === "string" && Object.hasOwn(RIDES, value);
}

// 기구 영역(footprint) 바깥으로 이만큼까지는 "기구 근처"로 봄
export const RIDE_NEAR_MARGIN = 3;

// 탑승·NPC 대화가 가능한 "기구 근처"인지 — 서버(최종 판정)와 클라이언트(버튼 표시)가 함께 사용
// 입구 게이트 반경 안이거나, 기구 영역 가장자리에서 RIDE_NEAR_MARGIN 안쪽이면 근처
// shrink: 클라이언트가 서버보다 조금 엄격하게 판정할 때 줄이는 거리 (서버 위치 지연 감안)
export function isNearRide(ride: RideInfo, x: number, z: number, shrink = 0): boolean {
    const gate = getRideGate(ride);
    const near_gate = Math.hypot(x - gate.x, z - gate.z) <= ride.board_radius - shrink;
    const near_body = Math.hypot(x - ride.x, z - ride.z) <= ride.footprint_radius + RIDE_NEAR_MARGIN - shrink;
    return near_gate || near_body;
}

// 탑승·하차 게이트 좌표 — 기구 중심에서 분수대 광장(PARK_HUB) 쪽으로 RIDE_GATE_DISTANCE 만큼 떨어진 지점
// 4단계 기구 모델의 입구도 이 좌표에 맞춰 배치할 것
export function getRideGate(ride: RideInfo): { x: number; z: number } {
    const dx = ride.x - PARK_HUB.x;
    const dz = ride.z - PARK_HUB.z;
    const length = Math.hypot(dx, dz);
    if (length === 0) {
        return { x: ride.x, z: ride.z + RIDE_GATE_DISTANCE };
    }
    return {
        x: ride.x - (dx / length) * RIDE_GATE_DISTANCE,
        z: ride.z - (dz / length) * RIDE_GATE_DISTANCE,
    };
}
