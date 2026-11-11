// NPC 오리 공통 규칙 — 대화 선택지 ID·문구 (NPC 대답 내용은 서버 데이터 파일에서 관리)

// NPC ID 형식: npc_1, npc_2, … (별명은 이 접두사를 쓸 수 없음 — nickname.ts)
export const NPC_ID_PREFIX = "npc_";

// 대화 선택지 — 모든 NPC 공통, 표시 순서대로
export const NPC_CHOICE = {
    GREETING: "greeting",
    ABOUT_RIDE: "about_ride",
    FUN_POINT: "fun_point",
    RECOMMEND: "recommend",
} as const;

export type NpcChoiceId = (typeof NPC_CHOICE)[keyof typeof NPC_CHOICE];

export const NPC_CHOICE_LIST: readonly { id: NpcChoiceId; label: string }[] = [
    { id: NPC_CHOICE.GREETING, label: "안녕! 반가워" },
    { id: NPC_CHOICE.ABOUT_RIDE, label: "이 놀이기구는 어떤 거야?" },
    { id: NPC_CHOICE.FUN_POINT, label: "제일 재밌는 순간은 언제야?" },
    { id: NPC_CHOICE.RECOMMEND, label: "다음엔 뭘 타면 좋을까?" },
];

export function isNpcChoiceId(value: unknown): value is NpcChoiceId {
    return NPC_CHOICE_LIST.some((choice) => choice.id === value);
}
