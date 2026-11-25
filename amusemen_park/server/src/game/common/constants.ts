// 게임장 공용 상수 (원본 multi_game 서버 common/constants.ts 에서 게임방에 필요한 값만 남김)
// 채널·Redis·DB·랭킹·광고·star·관리자 관련 상수는 놀이동산에서 쓰지 않아 제거했다.

export const PLAYERS_PER_ROOM = 2;              // 2인 게임방 1개당 인원
export const RECONNECT_WAIT_SEC = 5;            // 게임 중 끊긴 뒤 봇(자동 진행) 투입까지 대기
