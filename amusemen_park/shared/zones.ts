// 맵 크기·광장·입장 지점 (전체배치도 기준 배치)
// 좌표계: 월드 원점(0,0)이 맵 중앙, +x = 오른쪽(동), +z = 아래쪽(남, 입구 방향)

// 맵 전체 크기 (정사각형 한 변 길이)
export const MAP_SIZE = 160;
export const MAP_HALF = MAP_SIZE / 2;

// 맵 가장자리에서 이동 가능 영역까지의 여백 (울타리 두께)
export const MAP_EDGE_MARGIN = 2;

// 분수대 광장 중심 — 모든 기구의 입구가 이쪽을 바라봄
// (서쪽의 DUCK-X가 가장 커서 맵 중앙보다 동쪽·북쪽으로 조금 옮김)
export const PARK_HUB = { x: 8, z: -4 } as const;

// 입장 시 스폰 지점 (매표소를 지나온 공원 안쪽, 바깥 순환길 북쪽)
// 등 뒤 따라오는 카메라(약 6.4m 뒤)가 매표소 건물(북쪽 벽 z 56.6) 안에 들어가지 않도록 스폰 반경까지 감안해 안쪽에 둠
export const SPAWN_POINT = { x: 8, z: 45 } as const;

// 스폰 시 겹치지 않도록 흩뿌리는 반경
export const SPAWN_RADIUS = 4;

// 이동 가능 영역 안인지 확인
export function isInsideMap(x: number, z: number): boolean {
    const limit = MAP_HALF - MAP_EDGE_MARGIN;
    return Math.abs(x) <= limit && Math.abs(z) <= limit;
}
