// 별명 규칙 — 클라이언트(입력 즉시 안내)와 서버(최종 판정)가 같은 함수로 검증
import { ERROR_CODE, type ErrorCode } from "./messages";
import { NPC_ID_PREFIX } from "./npc";

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 10;

// 허용 문자: 한글 완성형, 영문, 숫자, 밑줄 (공백·특수문자 불가)
const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/;

// NPC 이름(npc_1 형식)과 겹치지 않도록 예약된 접두사
const RESERVED_PREFIX = NPC_ID_PREFIX;

export type NicknameCheck =
    | { ok: true; name: string }
    | { ok: false; code: ErrorCode; reason: string };

// 입력값을 정규화 (앞뒤 공백 제거, 한글 자모 분리 입력(NFD)을 완성형(NFC)으로 통일)
export function normalizeNickname(raw_value: unknown): string {
    if (typeof raw_value !== "string") {
        return "";
    }
    return raw_value.normalize("NFC").trim();
}

export function checkNickname(raw_value: unknown): NicknameCheck {
    const name = normalizeNickname(raw_value);
    const length = Array.from(name).length;

    if (length === 0) {
        return { ok: false, code: ERROR_CODE.INVALID_NAME, reason: "별명을 입력해 주세요." };
    }
    if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
        return { ok: false, code: ERROR_CODE.INVALID_NAME, reason: `별명은 ${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}글자로 입력해 주세요.` };
    }
    if (!NICKNAME_PATTERN.test(name)) {
        return { ok: false, code: ERROR_CODE.INVALID_NAME, reason: "별명에는 한글, 영문, 숫자, 밑줄(_)만 쓸 수 있어요. (공백 불가)" };
    }
    if (name.toLowerCase().startsWith(RESERVED_PREFIX)) {
        return { ok: false, code: ERROR_CODE.INVALID_NAME, reason: `"${RESERVED_PREFIX}"로 시작하는 별명은 쓸 수 없어요.` };
    }
    return { ok: true, name };
}

// 중복 비교용 키 (영문 대소문자 구분 없이 같은 별명으로 취급)
export function nicknameKey(name: string): string {
    return name.toLowerCase();
}
