// 머리띠 판매점 — 위치·근처 판정·머리띠 목록 (서버 판정과 클라이언트 버튼·팝업이 함께 사용)
import { PARK_HUB } from "./zones";

// 판매점 위치: DUCK VOYAGE와 CRAZY BUMP 사이 (DUCK FALL 길 동쪽 잔디밭) — 처음 자리(33.8, −20.3)에서 정면 쪽으로 1.5m 옮김
// 정면(창구)은 분수대 방향에서 오른쪽(위에서 볼 때 시계 방향)으로 45° 돌림 — 회전 y 가 줄면 오른쪽으로 돎
// rot_y = 정면 방향 (라디안, 0 = +z, π/2 = +x) — x·z 숫자는 문서 검사 스크립트가 읽으므로 숫자로 적음
const SHOP_TURN_RIGHT = Math.PI / 4;
export const HEADBAND_SHOP = { x: 32.3, z: -20.6, rot_y: Math.atan2(PARK_HUB.x - 33.8, PARK_HUB.z + 20.3) - SHOP_TURN_RIGHT } as const;

// 판매점 중심에서 손님이 서는 자리(창구 앞)까지 거리
export const SHOP_COUNTER_DISTANCE = 2.6;

// 창구 앞 이 반경 안이면 '머리띠 구경' 가능
export const SHOP_NEAR_RADIUS = 3.5;

// 머리띠 종류 (팝업 표시 순서)
export const HEADBAND_LIST = [
    { id: "bunny", label: "🐰 토끼 귀" },
    { id: "cat", label: "🐱 고양이 귀" },
    { id: "bear", label: "🐻 곰돌이 귀" },
    { id: "ribbon", label: "🎀 리본" },
    { id: "flower", label: "🌼 꽃" },
    { id: "devil", label: "😈 악마 뿔" },
] as const;

export type HeadbandId = (typeof HEADBAND_LIST)[number]["id"];

// 머리띠를 벗을 때 보내는 값
export const HEADBAND_NONE = "";

export function isHeadbandId(value: unknown): value is HeadbandId {
    return HEADBAND_LIST.some((headband) => headband.id === value);
}

// 창구 앞 좌표
export function getShopCounter(): { x: number; z: number } {
    return {
        x: HEADBAND_SHOP.x + Math.sin(HEADBAND_SHOP.rot_y) * SHOP_COUNTER_DISTANCE,
        z: HEADBAND_SHOP.z + Math.cos(HEADBAND_SHOP.rot_y) * SHOP_COUNTER_DISTANCE,
    };
}

// 머리띠를 고를 수 있는 거리인지 — shrink: 클라이언트가 서버보다 조금 엄격하게 판정할 때 줄이는 거리
export function isNearShop(x: number, z: number, shrink = 0): boolean {
    const counter = getShopCounter();
    return Math.hypot(x - counter.x, z - counter.z) <= SHOP_NEAR_RADIUS - shrink;
}
