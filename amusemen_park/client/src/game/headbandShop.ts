// 머리띠 판매점 — 창구 앞에 서면 '머리띠 구경' 버튼, 누르면 미니 팝업에서 골라 머리에 씀
// 다른 플레이어의 머리띠는 remotePlayers 가 같은 상태(headband)로 그림
import type { Room } from "@colyseus/sdk";
import { CLIENT_MESSAGE, ERROR_CODE, HEADBAND_LIST, HEADBAND_NONE, isNearShop, type HeadbandSelectPayload, type HeadbandSelectResult } from "@shared";
import { createHeadbandDialog } from "../ui/headbandDialog";
import type { ActionItem } from "../ui/actionBar";
import type { LocalPlayer } from "./localPlayer";
import type { RideController } from "./rideController";

// 서버 판정보다 조금 안쪽에서만 버튼 표시 (서버 위치 지연 감안) — rideController 와 같은 값
const CLIENT_RADIUS_MARGIN = 0.6;

const SHOP_ERROR_TEXT: Record<string, string> = {
    [ERROR_CODE.SHOP_TOO_FAR]: "판매점 앞으로 조금 더 가까이 와 주세요.",
    [ERROR_CODE.UNKNOWN_HEADBAND]: "그 머리띠는 지금 팔지 않아요.",
};
const SHOP_FAIL_TEXT = "머리띠를 바꾸지 못했어요. 잠시 후 다시 골라 주세요.";

// 서버 상태 Player 스키마 중 머리띠 필드
interface HeadbandState {
    headband: string;
}

export interface HeadbandShop {
    getActions(): ActionItem[];
    // 매 프레임: 내 오리 머리띠 반영, 판매점에서 멀어지면 팝업 닫기
    update(): void;
    dispose(): void;
}

export interface HeadbandShopOptions {
    room: Room;
    local_player: LocalPlayer;
    ride_controller: RideController;
    ui_layer: HTMLElement;
}

export function createHeadbandShop(options: HeadbandShopOptions): HeadbandShop {
    const { room, local_player, ride_controller, ui_layer } = options;
    const avatar = local_player.avatar;
    let is_pending = false;

    const dialog = createHeadbandDialog(ui_layer, (headband_id) => void choose(headband_id));

    function myHeadband(): string {
        return (room.state as { players?: Map<string, HeadbandState> } | undefined)?.players?.get(room.sessionId)?.headband ?? HEADBAND_NONE;
    }

    function isNear(): boolean {
        const position = avatar.root.position;
        return ride_controller.riding === null && isNearShop(position.x, position.z, CLIENT_RADIUS_MARGIN);
    }

    async function choose(headband_id: string): Promise<void> {
        if (is_pending) {
            return;
        }
        is_pending = true;
        dialog.setPending(true);
        try {
            const result = await room.request<HeadbandSelectPayload, HeadbandSelectResult>(CLIENT_MESSAGE.HEADBAND_SELECT, { headband_id });
            const label = HEADBAND_LIST.find((headband) => headband.id === result.headband_id)?.label;
            const text = label === undefined ? "머리띠를 벗었어요." : `${label} 머리띠를 썼어요! 잘 어울려요.`;
            // 팝업 안에 결과를 보여 주므로 화면 아래 안내는 띄우지 않음 (팝업에 가려 겹쳐 보임)
            dialog.showMessage(text);
        } catch (error) {
            dialog.showMessage(error instanceof Error ? SHOP_ERROR_TEXT[error.message] ?? SHOP_FAIL_TEXT : SHOP_FAIL_TEXT, true);
        } finally {
            is_pending = false;
            dialog.setPending(false);
        }
    }

    return {
        getActions() {
            if (dialog.is_open || !isNear()) {
                return [];
            }
            return [{ id: "headband_browse", label: "🎀 머리띠 구경", onClick: () => dialog.open() }];
        },
        update() {
            const current = myHeadband();
            avatar.setHeadband(current);
            dialog.setCurrent(current);
            if (dialog.is_open && !isNear()) {
                dialog.close();
            }
        },
        dispose() {
            dialog.dispose();
        },
    };
}
