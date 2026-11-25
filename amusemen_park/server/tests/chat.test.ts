// 채팅 규칙 테스트 (글 정리·길이 제한)
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_RULE, normalizeChat } from "@shared";

test("앞뒤 공백을 지우고 줄바꿈·연속 공백은 공백 하나로", () => {
    assert.equal(normalizeChat("  안녕\n하세요   반가워요  "), "안녕 하세요 반가워요");
    assert.equal(normalizeChat("a\tb\u0000c"), "a b c");
});

test("한글 자모 분리 입력은 완성형으로 통일", () => {
    assert.equal(normalizeChat("가"), "가");
});

test("비었거나 글자가 아니면 거부", () => {
    assert.equal(normalizeChat(""), null);
    assert.equal(normalizeChat("   \n "), null);
    assert.equal(normalizeChat(123), null);
    assert.equal(normalizeChat(undefined), null);
});

test("최대 글자 수까지 허용하고 넘으면 거부 (이모지도 한 글자)", () => {
    assert.equal(normalizeChat("가".repeat(CHAT_RULE.MAX_LENGTH)), "가".repeat(CHAT_RULE.MAX_LENGTH));
    assert.equal(normalizeChat("가".repeat(CHAT_RULE.MAX_LENGTH + 1)), null);
    assert.equal(normalizeChat("😀".repeat(CHAT_RULE.MAX_LENGTH)), "😀".repeat(CHAT_RULE.MAX_LENGTH));
});
