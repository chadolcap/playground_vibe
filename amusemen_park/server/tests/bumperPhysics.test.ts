// 범퍼카 물리 테스트
import { test } from "node:test";
import assert from "node:assert/strict";
import { BUMPER, BUMPER_LIMIT_X, BUMPER_LIMIT_Z, BUMPER_WALL } from "@shared";
import { createBumperBodies, driveAutomatically, stepBumperCars, type BumperBody } from "../src/logic/bumperPhysics";

const DT = 1 / BUMPER.SIMULATION_RATE;

function body(x: number, z: number, vx = 0, vz = 0, heading = 0): BumperBody {
    return { x, z, heading, vx, vz, throttle: 0, steer: 0, target_x: x, target_z: z };
}

test("8대 초기 배치는 경기장 안, 서로 겹치지 않음", () => {
    const bodies = createBumperBodies(8);
    assert.equal(bodies.length, 8);
    for (const [index, a] of bodies.entries()) {
        assert.ok(Math.abs(a.x) <= BUMPER_LIMIT_X && Math.abs(a.z) <= BUMPER_LIMIT_Z, `${index}번 밖`);
        for (const b of bodies.slice(index + 1)) {
            assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= BUMPER.CAR_RADIUS * 2);
        }
    }
});

test("가속하면 정면 방향으로 나아가고 최고 속도를 넘지 않음", () => {
    const car = body(0, 0);
    car.throttle = 1;
    for (let step = 0; step < 300; step += 1) {
        stepBumperCars([car], DT);
        car.x = 0;
        car.z = 0;
    }
    assert.ok(car.vz > 0, "정면(+z)으로 속도");
    assert.ok(Math.hypot(car.vx, car.vz) <= BUMPER.MAX_SPEED + 1e-9);
});

test("steer +1 은 오른쪽으로 회전 (정면 +z 기준 오른쪽 = -x)", () => {
    const car = body(0, 0);
    car.throttle = 1;
    car.steer = 1;
    for (let step = 0; step < 20; step += 1) {
        stepBumperCars([car], DT);
    }
    assert.ok(car.x < 0, `x=${car.x}`);
});

test("자동 주행 차는 목표 지점에 가까워짐", () => {
    const car = body(0, 0, 0, 0, Math.PI);
    car.target_x = 5;
    car.target_z = 3;
    const start = Math.hypot(car.target_x - car.x, car.target_z - car.z);
    for (let step = 0; step < 60; step += 1) {
        driveAutomatically(car, () => 0.5);
        stepBumperCars([car], DT);
    }
    assert.ok(Math.hypot(car.target_x - car.x, car.target_z - car.z) < start);
});

test("입력이 없으면 마찰로 서서히 멈춤", () => {
    const car = body(0, 0, 0, 5);
    for (let step = 0; step < 120; step += 1) {
        stepBumperCars([car], DT);
    }
    assert.ok(Math.hypot(car.vx, car.vz) < 0.2);
});

test("벽에 세게 부딪히면 튕겨 나오고 벽 충돌 알림", () => {
    const car = body(BUMPER_LIMIT_X - 0.05, 0, 6, 0);
    const hits = stepBumperCars([car], DT);
    assert.ok(car.x <= BUMPER_LIMIT_X);
    assert.ok(car.vx < 0, "속도 반사");
    assert.equal(hits[0]?.car_b, BUMPER_WALL);
});

test("마주 달려온 두 차는 부딪혀 서로 튕겨 나가고 충돌 알림", () => {
    const a = body(-1.2, 0, 5, 0);
    const b = body(1.2, 0, -5, 0);
    const hits = stepBumperCars([a, b], DT);
    assert.equal(hits.length, 1);
    assert.deepEqual([hits[0].car_a, hits[0].car_b], [0, 1]);
    assert.ok(a.vx < 0 && b.vx > 0, "서로 반대 방향으로 튕김");
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) >= BUMPER.CAR_RADIUS * 2 - 1e-9, "겹침 해소");
});

test("살짝 스친 정도(느린 충돌)는 알림 없음", () => {
    const a = body(-1.04, 0, 0.5, 0);
    const b = body(1.04, 0, -0.3, 0);
    assert.equal(stepBumperCars([a, b], DT).length, 0);
});

test("잘못된 입력값(NaN·범위 밖)도 안전하게 처리", () => {
    const car = body(0, 0);
    car.throttle = Number.NaN;
    car.steer = 99;
    stepBumperCars([car], DT);
    assert.ok(Number.isFinite(car.x) && Number.isFinite(car.heading));
});
