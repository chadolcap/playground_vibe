// 오리 색 자동 배정 — 같은 방의 모든 플레이어가 서로 다른 색을 갖도록 hue(색상각)를 분배

// 황금각: 연속으로 더해도 원 위에서 겹치지 않고 고르게 퍼지는 각도
const GOLDEN_ANGLE = 137.50776405;

// 후보 hue 개수 — 방 최대 인원보다 충분히 많아야 모든 플레이어가 다른 색을 받음
const CANDIDATE_COUNT = 360;

// 새끼 오리다운 밝은 파스텔 톤
const SATURATION = 0.7;
const LIGHTNESS = 0.62;

// 원 위 두 hue 사이의 최단 거리 (0~180)
export function hueDistance(a: number, b: number): number {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
}

// 사용 중인 hue 들과 가장 멀리 떨어진 후보를 선택
// 후보는 황금각 수열 순서로 살피며, 거리가 같으면 앞선 후보를 택해 결과가 항상 같다
export function pickHue(used_hues: readonly number[]): number {
    let best_hue = 0;
    let best_distance = -1;
    for (let index = 0; index < CANDIDATE_COUNT; index += 1) {
        // 정수 hue 로 반올림해 같은 색 비교(중복 판정)를 정확하게 한다
        const hue = Math.round(index * GOLDEN_ANGLE) % 360;
        if (used_hues.length === 0) {
            return hue;
        }
        let nearest = 180;
        for (const used_hue of used_hues) {
            nearest = Math.min(nearest, hueDistance(hue, used_hue));
        }
        if (nearest > best_distance) {
            best_distance = nearest;
            best_hue = hue;
        }
    }
    return best_hue;
}

// HSL → "#rrggbb"
export function hueToHex(hue: number): string {
    const chroma = (1 - Math.abs(2 * LIGHTNESS - 1)) * SATURATION;
    const section = (hue % 360) / 60;
    const second = chroma * (1 - Math.abs((section % 2) - 1));
    const [r1, g1, b1] =
        section < 1 ? [chroma, second, 0]
        : section < 2 ? [second, chroma, 0]
        : section < 3 ? [0, chroma, second]
        : section < 4 ? [0, second, chroma]
        : section < 5 ? [second, 0, chroma]
        : [chroma, 0, second];
    const offset = LIGHTNESS - chroma / 2;
    const toHex = (value: number): string => Math.round((value + offset) * 255).toString(16).padStart(2, "0");
    return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
}
