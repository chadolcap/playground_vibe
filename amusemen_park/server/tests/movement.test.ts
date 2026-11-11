// 이동 검증 테스트 (이동 예산 방식)
import { test } from "node:test";
import assert from "node:assert/strict";
import { MAP_EDGE_MARGIN, MAP_HALF, MOVE_RULE } from "@shared";
import { checkMove, createBaseline, parseMovePayload, type MoveBaseline } from "../src/logic/movement";

const allowed_speed = MOVE_RULE.MAX_SPEED * MOVE_RULE.SPEED_TOLERANCE;

function move(x: number, z: number, extra: Record<string, unknown> = {}): unknown {
    return { x, z, rot_y: 0, anim: "walk", ...extra };
}

// 예산이 바닥난 상태 (방금 최대로 이동한 직후)
function emptyBaseline(x = 0, z = 0, time = 1000): MoveBaseline {
    return { x, z, time, budget: 0 };
}

test("정상 속도의 이동은 허용", () => {
    const result = checkMove(emptyBaseline(), move(MOVE_RULE.MAX_SPEED, 0), 2000);
    assert.equal(result.ok, true);
});

test("허용 속도를 넘는 이동(순간이동)은 거부", () => {
    const result = checkMove(emptyBaseline(), move(allowed_speed + 1, 0), 2000);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.reason, "speed");
});

test("오래 멈춘 뒤에도 예산은 1초분까지만 쌓인다", () => {
    const result = checkMove(emptyBaseline(), move(allowed_speed * 2, 0), 11000);
    assert.equal(result.ok === false && result.reason, "speed");
});

test("회귀: 패킷이 몰려 도착해도 정상 속도 이동은 모두 통과", () => {
    // 최대 속도 이하(8.5/초)로 15Hz 전송, 단 네트워크에서 2개씩 같은 시각에 도착
    const speed = 8.5;
    const step = speed / MOVE_RULE.SEND_RATE;
    let baseline = createBaseline(0, 0, 0);
    let x = 0;
    for (let index = 1; index <= 60; index += 1) {
        x += step;
        const arrive_time = Math.ceil(index / 2) * 2 * (1000 / MOVE_RULE.SEND_RATE);
        const result = checkMove(baseline, move(x, 0), arrive_time);
        assert.equal(result.ok, true, `${index}번째 패킷 거부`);
        baseline = result.baseline;
    }
});

test("허용 속도를 꾸준히 넘으면 예산이 바닥나 결국 거부", () => {
    // 허용 속도의 1.3배로 계속 이동
    const step = (allowed_speed * 1.3) / MOVE_RULE.SEND_RATE;
    let baseline = createBaseline(0, 0, 0);
    let x = 0;
    let rejected = false;
    for (let index = 1; index <= 60 && !rejected; index += 1) {
        x += step;
        const result = checkMove(baseline, move(x, 0), index * (1000 / MOVE_RULE.SEND_RATE));
        rejected = !result.ok;
        baseline = result.baseline;
    }
    assert.equal(rejected, true);
});

test("맵 밖 좌표는 거부", () => {
    const edge = MAP_HALF - MAP_EDGE_MARGIN;
    assert.equal(checkMove(emptyBaseline(edge), move(edge, 0), 2000).ok, true);
    const outside = checkMove(emptyBaseline(edge), move(edge + 0.5, 0), 2000);
    assert.equal(outside.ok === false && outside.reason, "outside");
});

test("숫자가 아니거나 무한대·NaN 이면 거부", () => {
    assert.equal(parseMovePayload(null), null);
    assert.equal(parseMovePayload("move"), null);
    assert.equal(parseMovePayload(move(Number.NaN, 0)), null);
    assert.equal(parseMovePayload(move(Number.POSITIVE_INFINITY, 0)), null);
    assert.equal(parseMovePayload({ x: "1", z: 0, rot_y: 0, anim: "walk" }), null);
});

test("클라이언트는 sit 애니메이션을 직접 보낼 수 없음", () => {
    assert.equal(parseMovePayload(move(0, 0, { anim: "sit" })), null);
    assert.equal(parseMovePayload(move(0, 0, { anim: "fly" })), null);
    assert.notEqual(parseMovePayload(move(0, 0, { anim: "idle" })), null);
});
