// 게임장 — 위치·게임기 배치·게임 목록 (서버 게임방 등록·인원 집계와 클라이언트 게임기 모델·입장이 함께 사용)
// 게임 목록·방 이름을 바꾸면 doc/놀이동산_온라인.xlsx 의 game 시트도 함께 갱신할 것

// 게임장을 정한 자리: 캐릭터가 서서 바라본 지점 (x, z, 바라본 방향 rot_y — 0 = +z, π/2 = +x)
// x·z 숫자는 문서 검사 스크립트가 읽을 수 있게 숫자로 적음
export const ARCADE_VIEW_POINT = { x: 24.43, z: 38.72, rot_y: 4.352 } as const;

// 바라본 방향으로 이만큼 앞에 게임장 중심을 둠 (게임기 정면이 서 있던 자리를 향함)
export const ARCADE_FORWARD_DISTANCE = 5;

// 게임장 중심·정면 방향 (로컬 +z = 정면 = 손님이 서는 쪽 — 바라본 방향과 같은 쪽, 사용자 요청으로 180° 돌림)
export const ARCADE = {
    x: ARCADE_VIEW_POINT.x + Math.sin(ARCADE_VIEW_POINT.rot_y) * ARCADE_FORWARD_DISTANCE,
    z: ARCADE_VIEW_POINT.z + Math.cos(ARCADE_VIEW_POINT.rot_y) * ARCADE_FORWARD_DISTANCE,
    rot_y: ARCADE_VIEW_POINT.rot_y,
} as const;

export const GAME_ID = {
    OTHELLO: "othello",
    RPS: "rps",
    STEPPING: "stepping",
    AIRHOCKEY: "airhockey",
    FLAG: "flag",
} as const;

export type GameId = (typeof GAME_ID)[keyof typeof GAME_ID];

export interface GameInfo {
    id: GameId;
    // 게임기 이름표·대기 팝업에 쓰는 이름
    name: string;
    // Colyseus 방 이름 (client.joinOrCreate 에 그대로 사용)
    room_name: string;
    // 한 판 인원 (1 = 혼자 하는 게임, 대기 없이 바로 시작)
    players: number;
    // 게임기 몸체 색
    color: string;
}

// 게임기 순서 = 게임장 왼쪽(정면에서 볼 때)부터
export const GAME_LIST: readonly GameInfo[] = [
    { id: "othello", name: "오델로", room_name: "game_othello", players: 2, color: "#7bc96f" },
    { id: "rps", name: "가위바위보", room_name: "game_rps", players: 2, color: "#ff8fab" },
    { id: "stepping", name: "점핑", room_name: "game_stepping", players: 2, color: "#8ec9ff" },
    { id: "airhockey", name: "에어하키", room_name: "game_airhockey", players: 2, color: "#c7a8ff" },
    { id: "flag", name: "청기백기", room_name: "game_flag", players: 1, color: "#ffd166" },
];

// 게임기 사이 간격과 활 모양으로 휘는 정도 (게임장 로컬 좌표, 가운데 게임기가 가장 뒤)
export const ARCADE_MACHINE_GAP = 2.6;
export const ARCADE_ARC_DEPTH = 0.6;

// 게임장 로컬 좌표의 게임기 자리와 정면 방향 — 모든 게임기가 정면 앞 FOCUS 지점을 바라봄
const ARCADE_FOCUS_Z = 7;
export function getMachineLocal(index: number): { x: number; z: number; rot_y: number } {
    const offset = index - (GAME_LIST.length - 1) / 2;
    const x = offset * ARCADE_MACHINE_GAP;
    const z = -offset * offset * ARCADE_ARC_DEPTH * 0.5;
    return { x, z, rot_y: Math.atan2(-x, ARCADE_FOCUS_Z - z) };
}

export function isGameId(value: unknown): value is GameId {
    return GAME_LIST.some((game) => game.id === value);
}

// 게임방 입장 옵션의 캐릭터 값(look_key) 최대 길이 — 놀이동산 "별명|#rrggbb"
export const GAME_AVATAR_MAX_LENGTH = 40;
