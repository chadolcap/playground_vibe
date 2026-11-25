// 간식 수레(솜사탕·츄러스) — 창구 앞에 서면 '솜사탕 받기'·'츄러스 받기' 버튼, 받은 간식을 내 오리 손에 들려 줌
// 다른 플레이어가 든 간식은 remotePlayers 가 같은 상태(snack_kind·snack_color·snack_until)로 그림
import type { Room } from "@colyseus/sdk";
import { CHURROS_CART, CLIENT_MESSAGE, COTTON_CANDY_CART, ERROR_CODE, isNearCart, snackKindLeft, type SnackCart } from "@shared";
import type { ActionItem } from "../ui/actionBar";
import type { LocalPlayer } from "./localPlayer";
import type { RideController } from "./rideController";
import type { ServerClock } from "./serverClock";

// 서버 판정보다 조금 안쪽에서만 버튼 표시 (서버 위치 지연 감안) — rideController 와 같은 값
const CLIENT_RADIUS_MARGIN = 0.6;

const SNACK_ERROR_TEXT: Record<string, string> = {
    [ERROR_CODE.CART_TOO_FAR]: "수레 앞으로 조금 더 가까이 와 주세요.",
    [ERROR_CODE.ALREADY_HAS_SNACK]: "들고 있는 간식을 다 먹고 다시 받아 주세요.",
};
const SNACK_FAIL_TEXT = "간식을 받지 못했어요. 잠시 후 다시 시도해 주세요.";

// 수레마다 버튼·요청·받았을 때 안내
interface CartInfo {
    id: string;
    cart: SnackCart;
    label: string;
    message: string;
    done_text: string;
}

const CARTS: readonly CartInfo[] = [
    { id: "cotton_candy_take", cart: COTTON_CANDY_CART, label: "🍭 솜사탕 받기", message: CLIENT_MESSAGE.COTTON_CANDY_TAKE, done_text: "🍭 솜사탕을 받았어요! 들고 다니며 천천히 먹어요." },
    { id: "churros_take", cart: CHURROS_CART, label: "✨ 츄러스 받기", message: CLIENT_MESSAGE.CHURROS_TAKE, done_text: "✨ 츄러스를 받았어요! 바삭할 때 천천히 먹어요." },
];

// 서버 상태 Player 스키마 중 간식 필드
interface SnackState {
    snack_kind: string;
    snack_color: string;
    snack_until: number;
}

export interface SnackStand {
    getActions(): ActionItem[];
    // 매 프레임: 내 오리 손의 간식 크기 갱신
    update(): void;
}

export interface SnackStandOptions {
    room: Room;
    local_player: LocalPlayer;
    ride_controller: RideController;
    server_clock: ServerClock;
    notify: (text: string) => void;
}

export function createSnackStand(options: SnackStandOptions): SnackStand {
    const { room, local_player, ride_controller, server_clock, notify } = options;
    const avatar = local_player.avatar;
    let is_pending = false;

    function myState(): SnackState | undefined {
        return (room.state as { players?: Map<string, SnackState> } | undefined)?.players?.get(room.sessionId);
    }

    // 방 시각(ms) 기준 남은 양 (간식 종류마다 유지 시간이 다를 수 있음)
    function snackLeft(state: SnackState | undefined): number {
        return state === undefined ? 0 : snackKindLeft(state.snack_kind, state.snack_until, server_clock.now() * 1000);
    }

    async function take(info: CartInfo): Promise<void> {
        is_pending = true;
        try {
            await room.request(info.message);
            notify(info.done_text);
        } catch (error) {
            notify(error instanceof Error ? SNACK_ERROR_TEXT[error.message] ?? SNACK_FAIL_TEXT : SNACK_FAIL_TEXT);
        } finally {
            is_pending = false;
        }
    }

    return {
        getActions() {
            const position = avatar.root.position;
            // 걸어서 창구 앞에 있고, 들고 있는 간식이 없을 때만
            if (ride_controller.riding !== null || snackLeft(myState()) > 0) {
                return [];
            }
            const info = CARTS.find((candidate) => isNearCart(position.x, position.z, CLIENT_RADIUS_MARGIN, candidate.cart));
            if (info === undefined) {
                return [];
            }
            return [{ id: info.id, label: info.label, disabled: is_pending, onClick: () => void take(info) }];
        },
        update() {
            const state = myState();
            avatar.setSnack(state?.snack_kind ?? "", state?.snack_color ?? "", snackLeft(state));
        },
    };
}
