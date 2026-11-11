// 구역 좌표 (가이드맵 기준 배치)
// 좌표계: 월드 원점(0,0)이 맵 중앙, +x = 오른쪽(동), +z = 아래쪽(남, 입구 방향)

// 맵 전체 크기 (정사각형 한 변 길이)
export const MAP_SIZE = 240;
export const MAP_HALF = MAP_SIZE / 2;

// 맵 가장자리에서 이동 가능 영역까지의 여백 (울타리 두께)
export const MAP_EDGE_MARGIN = 2;

export const ZONE_ID = {
    GLOBAL_FAIR: "global_fair",
    AMERICAN_ADVENTURE: "american_adventure",
    MAGIC_LAND: "magic_land",
    EUROPEAN_ADVENTURE: "european_adventure",
    ZOOTOPIA: "zootopia",
} as const;

export type ZoneId = (typeof ZONE_ID)[keyof typeof ZONE_ID];

export interface ZoneInfo {
    id: ZoneId;
    name: string;
    // 구역 중심 좌표
    x: number;
    z: number;
    // 구역 크기 (x축 폭, z축 깊이)
    width: number;
    depth: number;
}

export const ZONES: Record<ZoneId, ZoneInfo> = {
    // 하단 중앙: 입구·스폰 지점
    global_fair: { id: "global_fair", name: "글로벌페어", x: 0, z: 90, width: 80, depth: 50 },
    // 중앙 우측
    american_adventure: { id: "american_adventure", name: "아메리칸 어드벤처", x: 60, z: 10, width: 90, depth: 80 },
    // 우측 상단
    magic_land: { id: "magic_land", name: "매직랜드", x: 60, z: -80, width: 90, depth: 70 },
    // 좌측 상단
    european_adventure: { id: "european_adventure", name: "유러피안 어드벤처", x: -60, z: -80, width: 90, depth: 70 },
    // 좌측 ~ 하단 좌측
    zootopia: { id: "zootopia", name: "주토피아", x: -65, z: 30, width: 100, depth: 110 },
};

// 입장 시 스폰 지점 (글로벌페어 입구)
export const SPAWN_POINT = { x: 0, z: 100 } as const;

// 스폰 시 겹치지 않도록 흩뿌리는 반경
export const SPAWN_RADIUS = 4;

// 이동 가능 영역 안인지 확인
export function isInsideMap(x: number, z: number): boolean {
    const limit = MAP_HALF - MAP_EDGE_MARGIN;
    return Math.abs(x) <= limit && Math.abs(z) <= limit;
}
