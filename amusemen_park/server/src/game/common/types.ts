// 게임장 공용 메시지 타입·envelope·공통 타입 (원본 multi_game 서버 common/types.ts 에서 게임방에 필요한 것만 남김)
// 로비·랭킹·광고·star·관리자 관련 타입은 놀이동산에서 쓰지 않아 제거했다.
// 메시지 type·payload 를 바꾸면 doc/놀이동산_온라인.xlsx 의 game 시트도 함께 갱신할 것

// Colyseus 메시지 이름 = type, 메시지 본문 = envelope
// ts: 사람이 읽기 쉬운 시각 문자열 "MM-DD HH:mm:ss:쎈티초" — 표시 전용
export interface Envelope<P = unknown> {
    type: string;
    payload: P;
    ts: string;
}

// C→S 로 받은 메시지에서 payload 를 꺼낸다 — `{ payload: {...} }`(정식)와 `{ ... }`(하위 호환) 둘 다 받는다
export function ReadPayload(message: unknown): unknown {
    if (typeof message !== "object" || message === null) return message;
    if (!("payload" in message)) return message;
    return (message as { payload?: unknown }).payload;
}

export const MessageType = {
    // 게임방 공통
    ENTER_ROOM: "ENTER_ROOM",             // C→S 요청(payload 없음, 로딩 등 준비 완료 신호) / S→C 결과 { result, room, player1, player2 } — 같은 type 재사용
    OUT_USER: "OUT_USER",                 // S→C — 게임 전/후 상대가 나가면 남은 유저에게 알림
    READY: "READY",                       // C→S { ready: "Y"|"N" } — 응답(ack) 없음
    GAME_START: "GAME_START",             // S→C — 양쪽 ready:Y 확인 후 전송. payload 없음
    RETURN_TO_LOBBY: "RETURN_TO_LOBBY",   // S→C {} — 게임이 끝나 방에서 내보냄 (클라이언트는 놀이동산으로 돌아감)
    OPPONENT_JOINED: "OPPONENT_JOINED",   // S→C { player: RoomPlayerInfo } — 재게임 대기 중인 방에 새 상대 입장
    // SELECT_GAME / GAME_RESULT 는 여러 게임이 공유하는 이름 — payload 모양만 게임마다 다르다
    SELECT_GAME: "SELECT_GAME",           // C→S — RPS: { select: "가위"|… } / 오델로: { select: {x,y} }
    GAME_RESULT: "GAME_RESULT",           // S→C 최종 결과 / C→S { replay: "Y"|"N" } — 같은 type 재사용

    // 가위바위보(RPS) — 2선승제의 "한 판" 단위 진행 (payload 는 rps/rpsTypes.ts)
    ONE_START: "ONE_START",               // S→C { count } — 한 판 시작
    ONE_REMAIN_TIME: "ONE_REMAIN_TIME",   // S→C { count } — 남은 초, count:0 이 선택 종료 신호
    ONE_RESULT: "ONE_RESULT",             // S→C { player1, player2, win? } — 한 판 결과

    // 오델로 — 돌 색 선택 + 턴 진행 (payload 는 othello/othelloTypes.ts)
    DOLL_SELECT: "DOLL_SELECT",                       // C→S { color: 0|1 } / S→C { select: {색: userid} }
    DOLL_SELECT_REMAIN_TIME: "DOLL_SELECT_REMAIN_TIME", // S→C { count }
    TURN_START: "TURN_START",                         // S→C { turn: userid, can: [{x,y}] }
    TURN_REMAIN_TIME: "TURN_REMAIN_TIME",             // S→C { count }
    GAME_STATUS: "GAME_STATUS",                       // S→C 게임 중 재접속한 유저에게만 보내는 상태 스냅샷 (오델로·점핑)

    // 점핑(stepping) (payload 는 stepping/steppingTypes.ts)
    MAP_SELECT: "MAP_SELECT",                         // S→C { map: 1~3 }
    GAME_REMAIN_TIME: "GAME_REMAIN_TIME",             // S→C { count }
    MOVE_INFO: "MOVE_INFO",                           // C→S { count, location, save } / S→C userid, life 추가

    // 에어하키(airhockey) (payload 는 airhockey/airhockeyTypes.ts) — 좌표는 받는 유저 기준(내가 아래쪽)
    SERVE_SELECT: "SERVE_SELECT",                     // S→C { userid } — 첫 서브 동전 던지기 결과
    PUCK_MOVE: "PUCK_MOVE",                           // S→C { loc:{x,y} }
    LEVER_MOVE: "LEVER_MOVE",                         // C→S { loc:{x,y} } / S→C { user, loc }

    // 청기백기(flag, 1인) (payload 는 flag/flagTypes.ts)
    QUEST_SHOW: "QUEST_SHOW",                         // S→C { quest:{b,w} } 문제 / C→S { quest:{b,w} } 답

    // 공통
    ERROR: "ERROR",                       // S→C
} as const;
export type MessageType = typeof MessageType[keyof typeof MessageType];

export const ErrorCode = {
    INVALID_PLAYER: "INVALID_PLAYER",     // 입장 옵션(별명·캐릭터)이 잘못됨 → 입장 거부
} as const;
export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];

export interface ErrorPayload {
    code: ErrorCode;
    message: string;
}

// 게임방 유저 정보 — 입장 옵션(놀이동산 별명·캐릭터)으로 만든다. DB·전적이 없어 이것뿐이다.
// userid: 게임방 sessionId (재접속해도 그대로), avatar: 캐릭터 look_key (놀이동산 "이름|색" — 클라이언트가 같은 캐릭터를 고름)
export interface UserInfo {
    userid: string;
    name: string;
    avatar: string;
}

// 게임방 입장 옵션 (client.joinOrCreate 의 두 번째 인자)
export interface GameJoinOptions {
    name: string;
    avatar: string;
}

// ENTER_ROOM 의 player1/player2, OPPONENT_JOINED 의 player
export interface RoomPlayerInfo {
    userid: string;
    name: string;
    avatar: string;
}

// ENTER_ROOM 결과 응답 (S→C, type 은 ENTER_ROOM 을 그대로 재사용)
export interface EnterRoomPayload {
    result: "Y";
    room: string; // Colyseus roomId
    player1: RoomPlayerInfo;
    player2?: RoomPlayerInfo; // 혼자 하는 게임(청기백기)은 생략
}

// OUT_USER
export interface OutUserPayload {
    userid: string;
}

// OPPONENT_JOINED
export interface OpponentJoinedPayload {
    player: RoomPlayerInfo;
}

// READY
export interface ReadyPayload {
    ready: "Y" | "N";
}
