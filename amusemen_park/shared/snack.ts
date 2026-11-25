// 간식 수레(솜사탕·츄러스) — 위치·근처 판정·간식 유지 시간 (서버 판정과 클라이언트 버튼 표시가 함께 사용)
// 간식은 한 번에 하나만 들 수 있고, 다 먹으면(시간이 지나면) 어느 수레에서든 다시 받을 수 있음
import { PARK_HUB } from "./zones";

// 간식 종류 — 플레이어 상태 snack_kind 값
export const SNACK_KIND = {
    COTTON_CANDY: "cotton_candy",
    CHURROS: "churros",
} as const;

export type SnackKind = (typeof SNACK_KIND)[keyof typeof SNACK_KIND];

export interface SnackCart {
    x: number;
    z: number;
    // 수레 정면(손님이 서는 쪽) 방향 (라디안, 0 = +z, π/2 = +x)
    rot_y: number;
}

// 솜사탕 수레: 회전목마 길과 DUCK TWIST 길 사이에서 DUCK TWIST 쪽(분수대 기준 66° 방향), 분수대에서 20m (안쪽 순환길 바로 바깥)
// 정면이 분수대를 바라봄 (x·z 숫자는 문서 검사 스크립트가 읽으므로 상수 대신 숫자로 적음)
export const COTTON_CANDY_CART = { x: 16.1, z: 14.3, rot_y: Math.atan2(PARK_HUB.x - 16.1, PARK_HUB.z - 14.3) } as const;

// 츄러스 수레: DUCK-X와 DUCK VOYAGE 사이, 안쪽 순환길 북서쪽 바깥 잔디밭
// 정면은 사용자가 세워 둔 캐릭터가 바라보던 방향(남동쪽, 분수대 광장 쪽)
export const CHURROS_CART = { x: -7.3, z: -19.1, rot_y: 0.824 } as const;

// 수레 중심에서 손님이 서는 자리(판매 창구 앞)까지 거리
export const CART_COUNTER_DISTANCE = 2.2;

// 판매 창구 앞 이 반경 안이면 '솜사탕 받기'·'츄러스 받기' 가능
export const CART_NEAR_RADIUS = 3.5;

// 받은 솜사탕을 들고 있는 시간(초) — 조금씩 줄어들다 사라지고, 그 뒤에 다시 받을 수 있음
export const COTTON_CANDY_SECONDS = 60;

// 받은 츄러스를 들고 있는 시간(초) — 솜사탕과 같은 방식
export const CHURROS_SECONDS = 60;

// 솜사탕 색 (받을 때마다 무작위)
export const COTTON_CANDY_COLORS = ["#ffafcc", "#bde0fe", "#cdb4db", "#fff1a8"] as const;

// 츄러스 색 (설탕 묻은 갈색 한 가지)
export const CHURROS_COLOR = "#d4a373";

// 간식 종류별 수레·유지 시간
export const SNACK_CARTS: Record<SnackKind, { cart: SnackCart; seconds: number }> = {
    cotton_candy: { cart: COTTON_CANDY_CART, seconds: COTTON_CANDY_SECONDS },
    churros: { cart: CHURROS_CART, seconds: CHURROS_SECONDS },
};

export function isSnackKind(value: unknown): value is SnackKind {
    return typeof value === "string" && Object.hasOwn(SNACK_CARTS, value);
}

// 판매 창구 앞 좌표 (수레를 주지 않으면 솜사탕 수레)
export function getCartCounter(cart: SnackCart = COTTON_CANDY_CART): { x: number; z: number } {
    return {
        x: cart.x + Math.sin(cart.rot_y) * CART_COUNTER_DISTANCE,
        z: cart.z + Math.cos(cart.rot_y) * CART_COUNTER_DISTANCE,
    };
}

// 간식을 받을 수 있는 거리인지 — shrink: 클라이언트가 서버보다 조금 엄격하게 판정할 때 줄이는 거리
export function isNearCart(x: number, z: number, shrink = 0, cart: SnackCart = COTTON_CANDY_CART): boolean {
    const counter = getCartCounter(cart);
    return Math.hypot(x - counter.x, z - counter.z) <= CART_NEAR_RADIUS - shrink;
}

// 들고 있는 간식이 남은 비율 1(막 받음) ~ 0(다 먹음) — until·now 는 방 시각(ms), seconds = 그 간식의 유지 시간
export function snackLeft(until: number, now: number, seconds: number): number {
    if (until <= 0) {
        return 0;
    }
    return Math.min(1, Math.max(0, (until - now) / (seconds * 1000)));
}

// 들고 있는 솜사탕이 남은 비율 (솜사탕 유지 시간 기준)
export function cottonCandyLeft(until: number, now: number): number {
    return snackLeft(until, now, COTTON_CANDY_SECONDS);
}

// 간식 종류에 맞는 남은 비율 (모르는 종류면 0)
export function snackKindLeft(kind: string, until: number, now: number): number {
    return isSnackKind(kind) ? snackLeft(until, now, SNACK_CARTS[kind].seconds) : 0;
}
