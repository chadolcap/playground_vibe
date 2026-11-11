// NPC 대화 — 가까운 NPC 에게 '말 걸기' 버튼, 대화창 선택지 요청, 멀어지면 대화창 닫기
import type { Room } from "@colyseus/sdk";
import {
    CLIENT_MESSAGE,
    ERROR_CODE,
    RIDES,
    isNearRide,
    type NpcChoiceId,
    type NpcTalkPayload,
    type NpcTalkResult,
    type RideId,
} from "@shared";
import type { ActionItem } from "../ui/actionBar";
import { createNpcDialog } from "../ui/npcDialog";
import type { LocalPlayer } from "./localPlayer";
import { findNearestNpc, type NpcDuck, type NpcDucks } from "./npcDucks";
import type { RideController } from "./rideController";

// 서버 판정보다 조금 안쪽에서만 버튼 표시 (서버 위치 지연 감안) — rideController 와 같은 값
const CLIENT_RADIUS_MARGIN = 0.6;
// 회전하는 기구에서 가장 가까운 NPC 가 계속 바뀌어 버튼 글자가 깜빡이지 않도록,
// 다른 NPC 가 이만큼 더 가까워져야 대상을 바꿈
const TARGET_SWITCH_MARGIN = 3;

const TALK_ERROR_TEXT: Record<string, string> = {
    [ERROR_CODE.NPC_TOO_FAR]: "조금 더 가까이 와서 말을 걸어 줘!",
    [ERROR_CODE.UNKNOWN_NPC]: "그 오리는 지금 대답할 수 없어요.",
    [ERROR_CODE.UNKNOWN_CHOICE]: "무슨 말인지 잘 모르겠어, 꽥?",
};
const TALK_FAIL_TEXT = "대답을 받지 못했어요. 잠시 후 다시 말을 걸어 주세요.";

export interface NpcTalk {
    getActions(): ActionItem[];
    // 매 프레임: 대화 중인 NPC 와 멀어지면 대화창 닫기
    update(): void;
    dispose(): void;
}

export interface NpcTalkOptions {
    room: Room;
    local_player: LocalPlayer;
    ride_controller: RideController;
    npc_ducks: NpcDucks;
    ui_layer: HTMLElement;
    notify: (text: string) => void;
}

export function createNpcTalk(options: NpcTalkOptions): NpcTalk {
    const { room, local_player, ride_controller, npc_ducks, ui_layer, notify } = options;
    const position = local_player.avatar.root.position;

    // 서버 규칙과 같음: 그 기구에 타고 있거나, 그 기구 근처
    function canTalkOnRide(ride_id: RideId): boolean {
        return ride_controller.riding?.ride_id === ride_id || isNearRide(RIDES[ride_id], position.x, position.z, CLIENT_RADIUS_MARGIN);
    }

    async function choose(npc_id: string, choice_id: NpcChoiceId): Promise<void> {
        dialog.setPending(true);
        try {
            const result = await room.request<NpcTalkPayload, NpcTalkResult>(CLIENT_MESSAGE.NPC_TALK, { npc_id, choice_id });
            // 기다리는 사이 다른 NPC 와 대화를 시작했으면 무시
            if (dialog.npc_id === result.npc_id) {
                dialog.showReply(result.text);
            }
        } catch (error) {
            const text = error instanceof Error ? TALK_ERROR_TEXT[error.message] ?? TALK_FAIL_TEXT : TALK_FAIL_TEXT;
            dialog.showReply(text, true);
        } finally {
            dialog.setPending(false);
        }
    }

    const dialog = createNpcDialog(ui_layer, (npc_id, choice_id) => void choose(npc_id, choice_id));
    let target: NpcDuck | null = null;

    // 지금 대상이 아직 대화 가능하고, 새 후보보다 크게 멀지 않으면 그대로 유지
    function pickTarget(): NpcDuck | null {
        const nearest = findNearestNpc(npc_ducks, position, canTalkOnRide);
        if (nearest === null) {
            target = null;
        } else if (target === null || !npc_ducks.list.has(target.id) || !canTalkOnRide(target.ride_id)) {
            target = nearest;
        } else if (nearest.avatar.root.position.distanceTo(position) + TARGET_SWITCH_MARGIN < target.avatar.root.position.distanceTo(position)) {
            target = nearest;
        }
        return target;
    }

    return {
        getActions() {
            const npc = pickTarget();
            if (npc === null || dialog.npc_id === npc.id) {
                return [];
            }
            return [{
                id: `npc_talk:${npc.id}`,
                label: `💬 ${npc.id}에게 말 걸기`,
                onClick: () => dialog.open(npc.id, RIDES[npc.ride_id].name),
            }];
        },
        update() {
            const npc_id = dialog.npc_id;
            if (npc_id === null) {
                return;
            }
            const npc = npc_ducks.list.get(npc_id);
            if (npc === undefined || !canTalkOnRide(npc.ride_id)) {
                dialog.close();
                notify(`${npc_id}와(과) 멀어져서 대화를 마쳤어요.`);
            }
        },
        dispose() {
            dialog.dispose();
        },
    };
}
