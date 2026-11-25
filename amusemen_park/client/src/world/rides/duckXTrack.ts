// DUCK-X 트랙 설계 — 실제 코스터처럼 "위에서 본 경로"와 "옆에서 본 높이 단면"을 따로 설계해 합침
// 실제 기구(에버랜드, 인타민 목재 코스터): 높이 56m, 77° 낙하, 최고 104km/h, 에어타임 12번
// 게임 공간(반경 33)에 맞춰 높이는 절반, 길이는 짧게 줄이되 구성 요소의 순서와 느낌은 그대로:
// 승강장 → 긴 직선 체인 리프트 → 꼭대기에서 77° 수직에 가까운 낙하 → 넓은 바닥 → 연속 에어타임 언덕 → 회전 → 브레이크
import * as THREE from "three";
import { arc, designTrack, line, lineTo, type DesignedTrack, type PlanPoint, type ProfileStep } from "./trackDesign";

// 위에서 본 경로 (x, z) — 기구 로컬 좌표, +z = 게이트(앞)
const PLAN_POINTS: PlanPoint[] = [
    // 승강장 (앞쪽, -x 방향으로 출발)
    [14.4, 6.3], [1.8, 6.3], [-10.8, 6.3],
    // 왼쪽으로 돌아 뒤쪽을 향함
    [-19.8, 2.7], [-24.3, -4.5],
    // 왼쪽 가장자리를 따라 곧게 뻗은 리프트
    [-25.2, -14.4], [-22.5, -23.4],
    // 뒤쪽을 가로지르는 낙하·바닥
    [-13.5, -27.4], [-0.9, -28.4], [10.8, -26.6],
    // 오른쪽 뒤 큰 회전
    [20.7, -21.6], [25.2, -12.6],
    // 가운데를 가로질러 돌아오는 에어타임 언덕 구간
    [17.1, -8.1], [4.5, -10.8], [-8, -13],
    // 안쪽 왼쪽 회전 — 빠른 속도로 도는 곳이라 반지름을 넉넉히 (좁으면 옆으로 10G 가까이 걸림)
    [-15.5, -9], [-16.5, -3],
    // 가운데 앞쪽 언덕 구간 → 오른쪽 급회전 → 브레이크 → 승강장
    [-10, 0.5], [3.6, -1.8], [16.2, -2.7], [24.3, 0.9], [22.5, 6.8],
];

// 에어타임 언덕: 오르막 → 꼭대기 원호 → 내리막 → 바닥 원호
// 꼭대기 반지름이 v²/g 보다 작을수록 몸이 더 붕 뜸 (반지름이 작으면 강한 에어타임)
function airtimeHill(slope_degrees: number, top: number, base: number, valley_radius: number, crest_radius: number): ProfileStep[] {
    return [arc(valley_radius, slope_degrees), lineTo(top), arc(crest_radius, -slope_degrees), lineTo(base + valley_radius * (1 - Math.cos(THREE.MathUtils.degToRad(slope_degrees)))), arc(valley_radius, 0)];
}

const STATION_HEIGHT = 2;
const LIFT_TOP = 27;

const PROFILE: ProfileStep[] = [
    // 승강장 + 리프트 앞 회전 (평지)
    line(32),
    // 리프트: 40° 직선 체인 오르막
    arc(12, 40), lineTo(LIFT_TOP), arc(10, 0), line(1.5),
    // 꼭대기 넘어 77° 낙하 → 넓은 바닥(반지름 15)으로 빠져나옴
    arc(7, -77), lineTo(14.5), arc(15, 0), line(2),
    // 연속 에어타임 언덕 (높이를 조금씩 낮춰 속도가 남도록)
    ...airtimeHill(32, 12, 2.9, 13, 15),
    line(2),
    // 두 번째 언덕은 꼭대기 반지름을 넓혀 부드러운 에어타임 (반지름이 너무 작으면 -1.5G 까지 튐)
    ...airtimeHill(24, 7, 2.9, 12, 18),
    // 승강장 높이로 내려와 긴 직선 브레이크 구간 (남은 거리는 createDuckXTrack 이 평지로 채움)
    arc(12, -8), lineTo(STATION_HEIGHT + 0.3), arc(12, 0),
];

// 경로와 단면을 합친 3D 트랙 곡선 (승강장 높이로 끝나 처음과 이어짐)
export function createDuckXTrack(): DesignedTrack {
    return designTrack(PLAN_POINTS, PROFILE, STATION_HEIGHT);
}
