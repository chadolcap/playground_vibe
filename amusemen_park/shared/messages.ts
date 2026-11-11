// 서버·클라이언트가 함께 쓰는 통신 상수
// 메시지 type 이름을 변경하면 doc/놀이동산_온라인.xlsx 도 함께 갱신할 것

// Colyseus 방 이름
export const ROOM_NAME = "park";

// 방 하나의 최대 인원 — 가득 차면 joinOrCreate 가 새 방(다음 번호)을 만든다
export const ROOM_MAX_CLIENTS = 50;

// 클라이언트 → 서버 메시지 type
// [요청] 표시는 room.request() 로 보내고 응답(또는 ERROR_CODE 오류)을 받는 요청/응답 방식
export const CLIENT_MESSAGE = {
    // [요청] 입장한 방 정보 조회 → RoomInfo
    ROOM_INFO: "room_info",
    // [요청] 방 시각 조회 → TimeSyncResult (놀이기구 움직임을 모든 클라이언트가 같은 시각으로 맞추는 데 사용)
    TIME_SYNC: "time_sync",
    // 내 위치 전송 (응답 없음, 잘못된 이동이면 서버가 MOVE_CORRECTION 전송) — MovePayload
    MOVE: "move",
    // [요청] 놀이기구 탑승 — RideBoardPayload → RideBoardResult
    RIDE_BOARD: "ride_board",
    // [요청] 놀이기구 하차 — (payload 없음) → RideLeaveResult
    RIDE_LEAVE: "ride_leave",
    // [요청] NPC 대화 — NpcTalkPayload → NpcTalkResult
    NPC_TALK: "npc_talk",
    // 범퍼카 조종 입력 (응답 없음, 범퍼카 탑승 중에만) — BumperInputPayload
    BUMPER_INPUT: "bumper_input",
} as const;

// 서버 → 클라이언트 메시지 type
export const SERVER_MESSAGE = {
    // 이동이 거부되었을 때 서버가 인정한 위치로 되돌림 — MoveCorrection
    MOVE_CORRECTION: "move_correction",
    // 범퍼카끼리(또는 벽과) 세게 부딪힘 — 방 전체에 알림 (충돌 효과·흔들림 연출) — BumperHit
    BUMPER_HIT: "bumper_hit",
} as const;

// 오류 코드 (입장 거부 사유, 요청 실패 사유)
export const ERROR_CODE = {
    INVALID_NAME: "invalid_name",
    DUPLICATE_NAME: "duplicate_name",
    ROOM_FULL: "room_full",
    INVALID_PAYLOAD: "invalid_payload",
    UNKNOWN_RIDE: "unknown_ride",
    RIDE_FULL: "ride_full",
    RIDE_TOO_FAR: "ride_too_far",
    ALREADY_RIDING: "already_riding",
    NOT_RIDING: "not_riding",
    INVALID_MOVE: "invalid_move",
    UNKNOWN_NPC: "unknown_npc",
    NPC_TOO_FAR: "npc_too_far",
    UNKNOWN_CHOICE: "unknown_choice",
} as const;

// 플레이어 애니메이션 상태
export const PLAYER_ANIM = {
    IDLE: "idle",
    WALK: "walk",
    SIT: "sit",
} as const;

// 좌석 점유 종류
export const SEAT_KIND = {
    EMPTY: "empty",
    NPC: "npc",
    PLAYER: "player",
} as const;

// 이동 규칙 (서버 검증과 클라이언트 이동 속도가 같은 값을 사용)
export const MOVE_RULE = {
    // 최대 이동 속도 (월드 단위/초)
    MAX_SPEED: 6,
    // 네트워크 지연·프레임 흔들림을 감안한 서버 허용 배율
    SPEED_TOLERANCE: 1.5,
    // 클라이언트 위치 전송 주기 (Hz)
    SEND_RATE: 15,
} as const;

// ROOM_INFO 응답
export interface RoomInfo {
    // 사람이 읽는 방 번호 (1부터, 비어서 사라진 방 번호는 재사용)
    room_no: number;
    player_count: number;
    max_players: number;
}

// TIME_SYNC 응답
export interface TimeSyncResult {
    // 방이 만들어진 뒤 지난 시간 (ms) — 같은 방의 모든 클라이언트가 공유하는 기준 시각
    room_time: number;
}

export type PlayerAnim = (typeof PLAYER_ANIM)[keyof typeof PLAYER_ANIM];
export type SeatKind = (typeof SEAT_KIND)[keyof typeof SEAT_KIND];

// MOVE
export interface MovePayload {
    x: number;
    z: number;
    // Y축 회전(라디안)
    rot_y: number;
    anim: PlayerAnim;
}

// MOVE_CORRECTION
export interface MoveCorrection {
    x: number;
    z: number;
}

// RIDE_BOARD
export interface RideBoardPayload {
    ride_id: string;
}

export interface RideBoardResult {
    ride_id: string;
    seat_index: number;
}

// RIDE_LEAVE — 하차 후 서 있게 되는 위치
export interface RideLeaveResult {
    x: number;
    z: number;
}

// NPC_TALK
export interface NpcTalkPayload {
    npc_id: string;
    choice_id: string;
}

export interface NpcTalkResult {
    npc_id: string;
    choice_id: string;
    text: string;
}

// BUMPER_INPUT
export interface BumperInputPayload {
    // 앞(+1) / 뒤(-1)
    throttle: number;
    // 오른쪽(+1) / 왼쪽(-1)
    steer: number;
}

// BUMPER_HIT
export interface BumperHit {
    // 부딪힌 차 번호 (= 좌석 번호), car_b 가 -1 이면 벽
    car_a: number;
    car_b: number;
    // 부딪힌 세기 (상대 속도)
    strength: number;
    // 부딪힌 지점 (범퍼카 로컬 좌표)
    x: number;
    z: number;
}

export type ClientMessageType = (typeof CLIENT_MESSAGE)[keyof typeof CLIENT_MESSAGE];
export type ServerMessageType = (typeof SERVER_MESSAGE)[keyof typeof SERVER_MESSAGE];
export type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];
