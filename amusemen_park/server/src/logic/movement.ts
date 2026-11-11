// 이동 검증 — 순간이동(속도 초과)·맵 밖 이동·잘못된 값 차단
// 이동 예산(토큰 버킷) 방식: 시간이 지나면 "이동 가능 거리"가 쌓이고, 이동할 때마다 그만큼 차감
// → 네트워크에서 패킷이 몰려 도착해도(짧은 간격) 앞서 쌓인 예산으로 통과하고,
//   순간이동처럼 쌓인 예산보다 먼 이동만 거부된다
import { MOVE_RULE, PLAYER_ANIM, isInsideMap, type MovePayload, type PlayerAnim } from "@shared";

// 예산 최대치 = 이 시간(초) 동안 허용 속도로 갈 수 있는 거리 (오래 멈췄다가 순간이동하는 것 방지)
const MAX_BUDGET_SECONDS = 1;

// 부동소수점 오차 허용치
const DISTANCE_EPSILON = 0.05;

// 허용 속도 (월드 단위/초)
const ALLOWED_SPEED = MOVE_RULE.MAX_SPEED * MOVE_RULE.SPEED_TOLERANCE;
const MAX_BUDGET = ALLOWED_SPEED * MAX_BUDGET_SECONDS;

export interface MoveBaseline {
    // 마지막으로 인정한 위치
    x: number;
    z: number;
    // 예산을 마지막으로 계산한 시각 (ms)
    time: number;
    // 남은 이동 가능 거리
    budget: number;
}

export type MoveCheck =
    | { ok: true; payload: MovePayload; baseline: MoveBaseline }
    | { ok: false; reason: "payload" | "outside" | "speed"; baseline: MoveBaseline };

// 새 기준점 (입장·하차·재접속 시) — 예산은 가득 찬 상태로 시작
export function createBaseline(x: number, z: number, time: number): MoveBaseline {
    return { x, z, time, budget: MAX_BUDGET };
}

const MOVE_ANIMS: readonly PlayerAnim[] = [PLAYER_ANIM.IDLE, PLAYER_ANIM.WALK];

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

// 클라이언트가 보낸 원시 payload 를 검증해 MovePayload 로 변환
export function parseMovePayload(raw_payload: unknown): MovePayload | null {
    if (typeof raw_payload !== "object" || raw_payload === null) {
        return null;
    }
    const { x, z, rot_y, anim } = raw_payload as Record<string, unknown>;
    if (!isFiniteNumber(x) || !isFiniteNumber(z) || !isFiniteNumber(rot_y)) {
        return null;
    }
    // 걷기 중에는 앉기(sit)를 보낼 수 없음 — sit 은 서버가 탑승 처리 때만 설정
    if (!MOVE_ANIMS.includes(anim as PlayerAnim)) {
        return null;
    }
    return { x, z, rot_y, anim: anim as PlayerAnim };
}

// 직전 인정 위치에서 이번 위치까지 이동이 가능한지 검사
// 결과의 baseline 을 저장해 다음 검사에 사용 (거부되어도 쌓인 예산은 갱신됨)
export function checkMove(baseline: MoveBaseline, raw_payload: unknown, now: number): MoveCheck {
    const elapsed_seconds = Math.max(now - baseline.time, 0) / 1000;
    const budget = Math.min(baseline.budget + elapsed_seconds * ALLOWED_SPEED, MAX_BUDGET);
    const refilled: MoveBaseline = { x: baseline.x, z: baseline.z, time: now, budget };

    const payload = parseMovePayload(raw_payload);
    if (payload === null) {
        return { ok: false, reason: "payload", baseline: refilled };
    }
    if (!isInsideMap(payload.x, payload.z)) {
        return { ok: false, reason: "outside", baseline: refilled };
    }
    const distance = Math.hypot(payload.x - baseline.x, payload.z - baseline.z);
    if (distance > budget + DISTANCE_EPSILON) {
        return { ok: false, reason: "speed", baseline: refilled };
    }
    return {
        ok: true,
        payload,
        baseline: { x: payload.x, z: payload.z, time: now, budget: Math.max(budget - distance, 0) },
    };
}
