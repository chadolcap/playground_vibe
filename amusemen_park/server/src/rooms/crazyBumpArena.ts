// CRAZY BUMP 경기장 — 차 물리 계산, 탑승자 조종 입력, 상태(crazy_bump_cars) 반영, 충돌 알림
// 사람이 탄 차는 그 사람의 입력으로, 비었거나 NPC 가 탄 차는 자동 주행
import type { ArraySchema } from "@colyseus/schema";
import { CRAZY_BUMP, SEAT_KIND, type CrazyBumpHit } from "@shared";
import { createCrazyBumpBodies, driveAutomatically, stepCrazyBumpCars, type CrazyBumpBody } from "../logic/crazyBumpPhysics";
import { CrazyBumpCar, type Seat } from "../schema/ParkState";

interface DriverInput {
    throttle: number;
    steer: number;
    // 받은 시각 (초)
    time: number;
}

// 한 번에 처리하는 시간 상한 (서버가 잠시 멈췄다가 재개해도 차가 순간이동하지 않게)
const MAX_STEP_SECONDS = 0.1;

export class CrazyBumpArena {
    private bodies: CrazyBumpBody[];
    // 좌석(=차) 번호 → 마지막 조종 입력
    private inputs = new Map<number, DriverInput>();
    // "a:b" → 마지막 충돌 알림 시각 (같은 충돌이 연달아 알림되지 않게)
    private last_hits = new Map<string, number>();

    constructor(
        private cars: ArraySchema<CrazyBumpCar>,
        car_count: number,
        private onHit: (hit: CrazyBumpHit) => void,
    ) {
        this.bodies = createCrazyBumpBodies(car_count);
        for (const body of this.bodies) {
            this.cars.push(new CrazyBumpCar({ x: body.x, z: body.z, heading: body.heading }));
        }
    }

    setInput(seat_index: number, throttle: number, steer: number, now: number): void {
        if (seat_index < 0 || seat_index >= this.bodies.length) {
            return;
        }
        this.inputs.set(seat_index, { throttle, steer, time: now });
    }

    clearInput(seat_index: number): void {
        this.inputs.delete(seat_index);
    }

    // seats: CRAZY BUMP 좌석 상태 (kind 로 사람이 탔는지 판단), now: 초
    step(dt: number, seats: readonly Seat[], now: number): void {
        const step_seconds = Math.min(dt, MAX_STEP_SECONDS);
        this.bodies.forEach((body, index) => {
            if (seats[index]?.kind === SEAT_KIND.PLAYER) {
                const input = this.inputs.get(index);
                // 입력이 끊기면(창 전환·연결 불안정) 차를 세움
                const is_fresh = input !== undefined && now - input.time <= CRAZY_BUMP.INPUT_TIMEOUT;
                body.throttle = is_fresh ? input.throttle : 0;
                body.steer = is_fresh ? input.steer : 0;
            } else {
                driveAutomatically(body, Math.random);
            }
        });

        const hits = stepCrazyBumpCars(this.bodies, step_seconds);

        this.bodies.forEach((body, index) => {
            const car = this.cars[index];
            car.x = body.x;
            car.z = body.z;
            car.heading = body.heading;
        });

        for (const hit of hits) {
            const key = `${hit.car_a}:${hit.car_b}`;
            if (now - (this.last_hits.get(key) ?? -Infinity) >= CRAZY_BUMP.HIT_COOLDOWN) {
                this.last_hits.set(key, now);
                this.onHit(hit);
            }
        }
    }
}
