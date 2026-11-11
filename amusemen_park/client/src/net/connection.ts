// 서버 접속 — park 방 입장과 오류 메시지 변환
import { Client, MatchMakeError, type Room } from "@colyseus/sdk";
import { CLIENT_MESSAGE, ERROR_CODE, ROOM_NAME, type RoomInfo } from "@shared";
import { SERVER_URL } from "../config";

const colyseus_client = new Client(SERVER_URL);

// 서버 ERROR_CODE → 사용자 안내 문구
const JOIN_ERROR_TEXT: Record<string, string> = {
    [ERROR_CODE.INVALID_NAME]: "사용할 수 없는 별명이에요. 다른 별명을 입력해 주세요.",
    [ERROR_CODE.DUPLICATE_NAME]: "이미 놀이동산에 같은 별명의 오리가 있어요. 다른 별명을 입력해 주세요.",
    [ERROR_CODE.ROOM_FULL]: "놀이동산이 가득 찼어요. 잠시 후 다시 시도해 주세요.",
};

const CONNECT_FAIL_TEXT = "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.";

export interface JoinResult {
    room: Room;
    // 방 정보 조회에 실패하면 null (입장 자체는 성공한 상태)
    room_info: RoomInfo | null;
}

// 정원이 찬 방은 건너뛰고 빈자리가 있는 방에 입장, 모두 차 있으면 서버가 새 방을 생성
export async function joinPark(name: string): Promise<JoinResult> {
    const room = await colyseus_client.joinOrCreate(ROOM_NAME, { name });
    let room_info: RoomInfo | null = null;
    try {
        room_info = await room.request<undefined, RoomInfo>(CLIENT_MESSAGE.ROOM_INFO);
    } catch (error) {
        console.warn("[connection] 방 정보 조회 실패", error);
    }
    return { room, room_info };
}

export function toJoinErrorText(error: unknown): string {
    if (error instanceof MatchMakeError) {
        return JOIN_ERROR_TEXT[error.message] ?? CONNECT_FAIL_TEXT;
    }
    return CONNECT_FAIL_TEXT;
}
