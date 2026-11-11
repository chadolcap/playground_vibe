// 공유 데이터(기구 게이트)·NPC 대화 데이터 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import { NPC_CHOICE, RIDES, RIDE_GATE_DISTANCE, RIDE_LIST, RIDE_NEAR_MARGIN, getRideGate, isInsideMap, isNearRide } from "@shared";
import { getNpcReply, validateNpcDialogs } from "../src/data/npcDialogs";

test("모든 기구의 게이트는 맵 안, 기구 중심에서 정해진 거리만큼 떨어져 있다", () => {
    for (const ride of RIDE_LIST) {
        const gate = getRideGate(ride);
        assert.ok(isInsideMap(gate.x, gate.z), `${ride.id} 게이트가 맵 밖`);
        const distance = Math.hypot(gate.x - ride.x, gate.z - ride.z);
        assert.ok(Math.abs(distance - RIDE_GATE_DISTANCE) < 1e-9, `${ride.id} 거리 ${distance}`);
    }
});

// 광장(원점) → 게이트 직선 길의 폭 절반
const PATH_HALF_WIDTH = 2.5;

function distanceToSegment(px: number, pz: number, bx: number, bz: number): number {
    const length_sq = bx * bx + bz * bz;
    const ratio = Math.min(Math.max((px * bx + pz * bz) / length_sq, 0), 1);
    return Math.hypot(px - bx * ratio, pz - bz * ratio);
}

test("기구 영역끼리 겹치지 않는다", () => {
    for (const a of RIDE_LIST) {
        for (const b of RIDE_LIST) {
            if (a.id < b.id) {
                const distance = Math.hypot(a.x - b.x, a.z - b.z);
                assert.ok(distance > a.footprint_radius + b.footprint_radius, `${a.id} ↔ ${b.id} 거리 ${distance.toFixed(1)}`);
            }
        }
    }
});

test("회귀: 광장에서 각 게이트로 가는 길이 다른 기구 영역을 지나지 않는다", () => {
    for (const ride of RIDE_LIST) {
        const gate = getRideGate(ride);
        for (const other of RIDE_LIST) {
            if (other.id === ride.id) {
                continue;
            }
            const distance = distanceToSegment(other.x, other.z, gate.x, gate.z);
            assert.ok(distance > other.footprint_radius + PATH_HALF_WIDTH, `${ride.id} 길이 ${other.id} 영역 통과 (거리 ${distance.toFixed(1)})`);
        }
    }
});

test("회귀: 게이트뿐 아니라 기구 바로 옆에서도 '기구 근처'로 판정", () => {
    const ride = RIDES.lets_twist;
    const gate = getRideGate(ride);
    // 게이트 위
    assert.equal(isNearRide(ride, gate.x, gate.z), true);
    // 기구 반대편 바로 옆 (게이트에서는 멀지만 기구 영역 가장자리 근처) — 이전에는 탑승 버튼이 안 나오던 위치
    const back_x = ride.x + (ride.x - gate.x) / RIDE_GATE_DISTANCE * (ride.footprint_radius + 1);
    const back_z = ride.z + (ride.z - gate.z) / RIDE_GATE_DISTANCE * (ride.footprint_radius + 1);
    assert.equal(isNearRide(ride, back_x, back_z), true);
    // 멀리 떨어진 곳
    assert.equal(isNearRide(ride, ride.x + ride.footprint_radius + RIDE_NEAR_MARGIN + 5, ride.z), false);
    // 클라이언트용 축소 판정은 경계에서 서버보다 엄격
    const edge_x = ride.x + ride.footprint_radius + RIDE_NEAR_MARGIN - 0.3;
    assert.equal(isNearRide(ride, edge_x, ride.z), true);
    assert.equal(isNearRide(ride, edge_x, ride.z, 0.6), false);
});

test("NPC 수는 좌석 수보다 적다 (플레이어가 앉을 자리 확보)", () => {
    for (const ride of RIDE_LIST) {
        assert.ok(ride.npc_count >= 1 && ride.npc_count < ride.seat_count, ride.id);
    }
});

test("모든 기구 × 선택지에 NPC 대답이 있다", () => {
    for (const ride of RIDE_LIST) {
        for (const choice_id of Object.values(NPC_CHOICE)) {
            assert.ok(getNpcReply(ride.id, choice_id).length > 0);
        }
    }
});

test("대화 데이터에 빠진 항목이 있으면 시작 시 오류", () => {
    const broken = { [RIDES.panda_world.id]: { greeting: "안녕" } };
    assert.throws(() => validateNpcDialogs(broken), /빠진 항목/);
    assert.throws(() => validateNpcDialogs(null), /형식/);
});
