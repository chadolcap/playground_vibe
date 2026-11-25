// 게임방 공용 도우미 — 원본의 로비 매칭(좌석 예약·Redis 대기방)을 Colyseus 기본 매칭(joinOrCreate)으로 대신한다.
//  · 입장: 클라이언트가 놀이동산 별명·캐릭터를 입장 옵션으로 보냄 → onAuth 에서 검증해 UserInfo 로 만든다
//  · 정원이 차면 직접 lock() — 직접 잠가야 게임 중 한 명이 나가도 Colyseus 가 방을 다시 열지 않는다
//  · 재게임 상대를 기다릴 때만 unlock() → 다음 joinOrCreate 가 이 방으로 들어온다
import { ServerError, type Room } from "@colyseus/core";
import { GAME_AVATAR_MAX_LENGTH, checkNickname } from "@shared";
import * as types from "./types.js";
import type { GameJoinOptions, UserInfo } from "./types.js";
import * as gamePresence from "./gamePresence.js";

// 입장 거부 코드 (Colyseus ServerError 코드 — 놀이동산 방과 같은 값)
const JOIN_REJECT_CODE = 4200;

// onAuth 반환값 — onJoin 의 세 번째 인자(auth)로 그대로 들어온다
export interface GameSeatAuth {
    user: UserInfo;
}

// 입장 옵션 검증 → 실패하면 ServerError 로 입장 거부 (클라이언트 joinOrCreate 가 오류로 받음)
export function ReadJoinAuth(session_id: string, options: unknown): GameSeatAuth {
    const raw = (typeof options === "object" && options !== null ? options : {}) as Partial<GameJoinOptions>;
    const name_check = checkNickname(raw.name);
    const avatar = typeof raw.avatar === "string" ? raw.avatar.slice(0, GAME_AVATAR_MAX_LENGTH) : "";
    if (!name_check.ok || avatar.length === 0) {
        throw new ServerError(JOIN_REJECT_CODE, types.ErrorCode.INVALID_PLAYER);
    }
    return { user: { userid: session_id, name: name_check.name, avatar } };
}

// 정원이 찼으면 직접 잠근다 (onJoin 끝에서 호출)
export function LockWhenFull(room: Room): void {
    if (room.clients.length >= room.maxClients) {
        void room.lock();
    }
}

// 재게임 상대를 기다리는 방으로 연다
export function OpenForNewOpponent(room: Room): void {
    void room.unlock();
}

// 게임기 이름표 인원 갱신 (onJoin·onLeave·onDispose 에서 호출)
export function ReportPlayers(room: Room, game_id: string): void {
    gamePresence.SetRoomPlayers(room.roomId, game_id, room.clients.length);
}

export function ClearPlayers(room: Room): void {
    gamePresence.RemoveRoom(room.roomId);
}
