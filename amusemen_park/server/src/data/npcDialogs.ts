// NPC 대화 데이터 로더 — 내용은 server/data/npc_dialogs.json 에서 관리 (코드와 분리)
import raw_dialogs from "../../data/npc_dialogs.json" with { type: "json" };
import { NPC_CHOICE_LIST, RIDE_LIST, type NpcChoiceId, type RideId } from "@shared";

export type NpcDialogs = Record<RideId, Record<NpcChoiceId, string>>;

// 모든 기구 × 모든 선택지에 비어 있지 않은 대답이 있는지 검증 (서버 시작 시 1회)
export function validateNpcDialogs(data: unknown): NpcDialogs {
    if (typeof data !== "object" || data === null) {
        throw new Error("NPC 대화 데이터 형식이 올바르지 않습니다.");
    }
    const table = data as Record<string, unknown>;
    const missing: string[] = [];
    for (const ride of RIDE_LIST) {
        const replies = table[ride.id];
        for (const choice of NPC_CHOICE_LIST) {
            const text = typeof replies === "object" && replies !== null
                ? (replies as Record<string, unknown>)[choice.id]
                : undefined;
            if (typeof text !== "string" || text.trim() === "") {
                missing.push(`${ride.id}.${choice.id}`);
            }
        }
    }
    if (missing.length > 0) {
        throw new Error(`NPC 대화 데이터에 빠진 항목이 있습니다: ${missing.join(", ")}`);
    }
    return table as NpcDialogs;
}

const npc_dialogs = validateNpcDialogs(raw_dialogs);

export function getNpcReply(ride_id: RideId, choice_id: NpcChoiceId): string {
    return npc_dialogs[ride_id][choice_id];
}
