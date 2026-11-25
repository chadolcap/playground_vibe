// 게임방 통신 로그 (원본 multi_game 서버 common/log.ts 기반 — 통계·관리자 마스킹은 해당 메시지가 없어 제거)
// 접속/퇴장, C→S, S→C 를 색으로 구분해 콘솔에 남긴다. 초당 수십 번 오가는 메시지는 남기지 않는다.

import type { Client, Room } from "@colyseus/core";
import * as types from "./types.js";

const RESET = "\x1b[0m";
const CYAN = "\x1b[36m"; // 접속
const GRAY = "\x1b[90m"; // 퇴장
const GREEN = "\x1b[32m"; // C → S
const MAGENTA = "\x1b[35m"; // S → C

function RoomTag(room: Room): string {
    return `${room.roomName}(${room.roomId})`;
}

// 로그를 남기지 않는 고빈도 메시지 (에어하키 퍽·레버 위치)
export const HIGH_FREQUENCY_MESSAGE_TYPES = new Set<string>([
    types.MessageType.PUCK_MOVE,
    types.MessageType.LEVER_MOVE,
]);

export function StringifyPayload(payload: unknown, max = 500): string {
    let text: string;
    try {
        text = JSON.stringify(payload) ?? String(payload);
    } catch {
        text = String(payload);
    }
    return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function LogConnect(room: Room, client: Client, extra?: unknown): void {
    const extra_text = extra !== undefined ? ` ${StringifyPayload(extra)}` : "";
    console.log(`${CYAN}[접속]${RESET} ${RoomTag(room)} sessionId=${client.sessionId} (현재 ${room.clients.length}명)${extra_text}`);
}

export function LogDisconnect(room: Room, client: Client, code?: number): void {
    console.log(`${GRAY}[퇴장]${RESET} ${RoomTag(room)} sessionId=${client.sessionId} code=${code}`);
}

export function LogClientMessage(room: Room, client: Client, type: string, payload: unknown): void {
    if (HIGH_FREQUENCY_MESSAGE_TYPES.has(type)) return;
    console.log(`${GREEN}[C→S]${RESET} ${RoomTag(room)} sessionId=${client.sessionId} type=${type} payload=${StringifyPayload(payload)}`);
}

export function LogServerMessage(room: Room, client: Client, type: string, payload: unknown): void {
    if (HIGH_FREQUENCY_MESSAGE_TYPES.has(type)) return;
    console.log(`${MAGENTA}[S→C]${RESET} ${RoomTag(room)} sessionId=${client.sessionId} type=${type} payload=${StringifyPayload(payload)}`);
}

// room.onMessage 등록 + envelope 에서 payload 꺼내기 + C→S 로그를 한 번에
export function RegisterLoggedMessage<T = unknown>(room: Room, type: string, handler: (client: Client, message: T) => unknown): void {
    room.onMessage(type, (client: Client, message: unknown) => {
        const payload = types.ReadPayload(message) as T;
        LogClientMessage(room, client, type, payload);
        return handler(client, payload);
    });
}
