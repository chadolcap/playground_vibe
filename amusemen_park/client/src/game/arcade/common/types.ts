// 게임방 통신 공용 타입 (원본 multi_game 클라 common/types.ts 에서 게임방에 필요한 것만 남김)
// 로비·랭킹·광고·star·관리자·공지 타입은 놀이동산에서 쓰지 않아 제거했다.
// 서버 원본: server/src/game/common/types.ts — 바꾸면 doc/놀이동산_온라인.xlsx 의 game 시트도 함께 갱신

// S->C 메시지는 항상 이 envelope 형태로 온다. { type, payload, ts }
export interface Envelope<P = unknown> {
  type: string;
  payload: P;
  ts: string;
}

export const MessageType = {
  ENTER_ROOM: "ENTER_ROOM", // C->S 요청(게임방 입장, payload 없음) / S->C 응답
  OUT_USER: "OUT_USER", // S->C (게임 전/후 상대 퇴장 알림)
  READY: "READY", // C->S (게임 준비/취소)
  GAME_START: "GAME_START", // S->C (payload 없음)
  // 게임별 진행 메시지는 games/<게임>/types.ts 참고.
  GAME_RESULT: "GAME_RESULT", // S->C (최종 결과) / 같은 type 으로 C->S 재시작 요청
  RETURN_TO_LOBBY: "RETURN_TO_LOBBY", // S->C (payload 없음) — 방에서 내보냄 (놀이동산으로 돌아감)
  OPPONENT_JOINED: "OPPONENT_JOINED", // S->C — 재게임 신청 후 새 상대를 기다리던 중, 새 상대가 입장했을 때
  ERROR: "ERROR", // S->C
} as const;
export type MessageType = (typeof MessageType)[keyof typeof MessageType];

// ENTER_ROOM/OPPONENT_JOINED 응답에서 한 명의 정보.
// userid = 게임방 sessionId, avatar = 놀이동산 캐릭터 look_key ("별명|#rrggbb")
export interface RoomPlayerInfo {
  userid: string;
  name: string;
  avatar: string;
}

// ENTER_ROOM 으로 받는 값 (S->C). 요청은 payload 없음. 나는 userid 를 내 sessionId 와 비교해 구분한다.
export interface EnterRoomPayload {
  result: "Y" | "N";
  room: string;
  player1: RoomPlayerInfo;
  player2: RoomPlayerInfo;
}

// OUT_USER 로 받는 값 (S->C). 게임 전/후 상대가 나갔을 때 온다.
export interface OutUserPayload {
  userid: string;
}

// OPPONENT_JOINED 로 받는 값 (S->C).
export interface OpponentJoinedPayload {
  player: RoomPlayerInfo;
}

// READY 로 보내는 값 (C->S). 취소할 때는 ready:"N".
export interface ReadyPayload {
  ready: "Y" | "N";
}

// GAME_RESULT 의 winner/loser
export interface GameResultPlayerInfo {
  userid: string;
  win_count: number;
}

// GAME_RESULT 로 받는 값 (S->C, 최종 결과)
export interface GameResultPayload {
  winner: GameResultPlayerInfo;
  loser: GameResultPlayerInfo;
}

// GAME_RESULT 로 보내는 값 (C->S, 재시작 선택 — 같은 type 을 재사용한다)
export interface GameResultReplayPayload {
  replay: "Y" | "N";
}
