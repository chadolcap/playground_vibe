// 채팅(머리 위 말풍선) 규칙 — 클라이언트(입력 즉시 안내)와 서버(최종 판정)가 같은 함수로 검증

export const CHAT_RULE = {
    // 한 번에 보낼 수 있는 최대 글자 수
    MAX_LENGTH: 40,
    // 말풍선을 보여 주는 시간(초)
    SHOW_SECONDS: 5,
    // 같은 사람이 연달아 보낼 수 있는 최소 간격(ms) — 도배 방지
    MIN_INTERVAL_MS: 1000,
} as const;

// 입력값을 정규화 — 완성형(NFC)으로 통일, 줄바꿈·제어 문자를 공백으로, 연속 공백은 하나로, 앞뒤 공백 제거
// 비었거나 MAX_LENGTH 를 넘으면 null
export function normalizeChat(raw_value: unknown): string | null {
    if (typeof raw_value !== "string") {
        return null;
    }
    const text = raw_value
        .normalize("NFC")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const length = Array.from(text).length;
    return length === 0 || length > CHAT_RULE.MAX_LENGTH ? null : text;
}
