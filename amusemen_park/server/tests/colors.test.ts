// 오리 색 배정 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import { ROOM_MAX_CLIENTS } from "@shared";
import { hueDistance, hueToHex, pickHue } from "../src/logic/colors";

test("방 최대 인원만큼 배정해도 색이 모두 다르다", () => {
    const used: number[] = [];
    for (let count = 0; count < ROOM_MAX_CLIENTS; count += 1) {
        used.push(pickHue(used));
    }
    assert.equal(new Set(used).size, ROOM_MAX_CLIENTS);
    assert.equal(new Set(used.map(hueToHex)).size, ROOM_MAX_CLIENTS);
});

test("새 색은 기존 색들과 최대한 멀리 떨어진다", () => {
    const first = pickHue([]);
    const second = pickHue([first]);
    // 두 번째 색은 첫 색의 거의 반대편
    assert.ok(hueDistance(first, second) >= 170, `거리 ${hueDistance(first, second)}`);
});

test("퇴장으로 빈 색 자리는 다음 입장자가 다시 쓴다", () => {
    const used = [0, 90, 180, 270];
    // 90 이 빠지면 그 자리(90 근처)가 가장 넓은 빈틈
    const without_90 = used.filter((hue) => hue !== 90);
    const next = pickHue(without_90);
    assert.ok(hueDistance(next, 90) <= 5, `배정된 hue ${next}`);
});

test("같은 입력이면 항상 같은 색 (결정적)", () => {
    assert.equal(pickHue([10, 200]), pickHue([10, 200]));
});

test("hue → #rrggbb 변환", () => {
    assert.match(hueToHex(0), /^#[0-9a-f]{6}$/);
    assert.match(hueToHex(359), /^#[0-9a-f]{6}$/);
    assert.notEqual(hueToHex(0), hueToHex(120));
});

test("hue 거리는 원형으로 계산", () => {
    assert.equal(hueDistance(10, 350), 20);
    assert.equal(hueDistance(0, 180), 180);
    assert.equal(hueDistance(90, 90), 0);
});
