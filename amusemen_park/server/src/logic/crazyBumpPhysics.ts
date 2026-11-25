// CRAZY BUMP 물리 — 가속·회전·마찰, 경기장 벽 튕김, 차끼리 충돌(원형) 튕김 + 충돌 알림
// 서버가 유일한 계산 주체 → 모든 클라이언트가 같은 결과(위치·충돌)를 받음
import { CRAZY_BUMP, CRAZY_BUMP_LIMIT_X, CRAZY_BUMP_LIMIT_Z, CRAZY_BUMP_WALL, type CrazyBumpHit } from "@shared";

export interface CrazyBumpBody {
    x: number;
    z: number;
    // 정면 방향 (라디안, 0 = +z)
    heading: number;
    vx: number;
    vz: number;
    // 이번 계산에 쓸 조종 입력 (-1 ~ 1)
    throttle: number;
    steer: number;
    // 자동 주행 목표 (사람이 타지 않은 차)
    target_x: number;
    target_z: number;
}

// 경기장에 차 count 대를 격자로 배치
export function createCrazyBumpBodies(count: number): CrazyBumpBody[] {
    const bodies: CrazyBumpBody[] = [];
    const columns = 4;
    for (let index = 0; index < count; index += 1) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = (column - (columns - 1) / 2) * 3.6;
        const z = row === 0 ? -2.5 : 2.5;
        bodies.push({ x, z, heading: row === 0 ? 0 : Math.PI, vx: 0, vz: 0, throttle: 0, steer: 0, target_x: x, target_z: z });
    }
    return bodies;
}

function clampInput(value: number): number {
    return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
}

// 사람이 타지 않은 차: 무작위 목표 지점을 향해 천천히 돌아다님
export function driveAutomatically(body: CrazyBumpBody, random: () => number): void {
    const dx = body.target_x - body.x;
    const dz = body.target_z - body.z;
    if (Math.hypot(dx, dz) < 1.5) {
        body.target_x = (random() * 2 - 1) * CRAZY_BUMP_LIMIT_X;
        body.target_z = (random() * 2 - 1) * CRAZY_BUMP_LIMIT_Z;
        return;
    }
    const want = Math.atan2(dx, dz);
    const turn = Math.atan2(Math.sin(want - body.heading), Math.cos(want - body.heading));
    // heading 을 늘려야 하면(왼쪽) steer 는 음수
    body.steer = Math.max(-1, Math.min(1, -turn * 2));
    body.throttle = 0.55;
}

// 한 단계 계산 — 반환: 이번 단계에 일어난 충돌 (세기가 HIT_MIN_SPEED 이상인 것만)
export function stepCrazyBumpCars(bodies: CrazyBumpBody[], dt: number): CrazyBumpHit[] {
    const hits: CrazyBumpHit[] = [];

    for (const body of bodies) {
        const throttle = clampInput(body.throttle);
        const steer = clampInput(body.steer);
        const speed = Math.hypot(body.vx, body.vz);
        // 움직일 때만 방향이 잘 바뀜 (제자리에서도 조금은 돌 수 있게)
        // steer +1 = 오른쪽: 정면이 +z 인 차의 오른쪽은 -x 이므로 heading 이 줄어드는 방향
        body.heading -= steer * CRAZY_BUMP.TURN_RATE * dt * Math.min(1, 0.35 + speed / CRAZY_BUMP.MAX_SPEED);
        body.vx += Math.sin(body.heading) * throttle * CRAZY_BUMP.ACCELERATION * dt;
        body.vz += Math.cos(body.heading) * throttle * CRAZY_BUMP.ACCELERATION * dt;
        // 마찰로 서서히 멈춤
        const damping = Math.max(0, 1 - CRAZY_BUMP.FRICTION * dt);
        body.vx *= damping;
        body.vz *= damping;
        const next_speed = Math.hypot(body.vx, body.vz);
        if (next_speed > CRAZY_BUMP.MAX_SPEED) {
            body.vx *= CRAZY_BUMP.MAX_SPEED / next_speed;
            body.vz *= CRAZY_BUMP.MAX_SPEED / next_speed;
        }
        body.x += body.vx * dt;
        body.z += body.vz * dt;
    }

    // 벽: 밖으로 나가면 안으로 밀고 속도 반사
    bodies.forEach((body, index) => {
        let wall_speed = 0;
        if (Math.abs(body.x) > CRAZY_BUMP_LIMIT_X) {
            wall_speed = Math.abs(body.vx);
            body.x = Math.sign(body.x) * CRAZY_BUMP_LIMIT_X;
            body.vx = -body.vx * CRAZY_BUMP.RESTITUTION;
        }
        if (Math.abs(body.z) > CRAZY_BUMP_LIMIT_Z) {
            wall_speed = Math.max(wall_speed, Math.abs(body.vz));
            body.z = Math.sign(body.z) * CRAZY_BUMP_LIMIT_Z;
            body.vz = -body.vz * CRAZY_BUMP.RESTITUTION;
        }
        if (wall_speed >= CRAZY_BUMP.HIT_MIN_SPEED) {
            hits.push({ car_a: index, car_b: CRAZY_BUMP_WALL, strength: wall_speed, x: body.x, z: body.z });
        }
    });

    // 차끼리: 겹치면 떼어 놓고, 부딪힌 방향(법선)으로 속도를 주고받음 (같은 질량 탄성 충돌)
    const min_distance = CRAZY_BUMP.CAR_RADIUS * 2;
    for (let a = 0; a < bodies.length; a += 1) {
        for (let b = a + 1; b < bodies.length; b += 1) {
            const first = bodies[a];
            const second = bodies[b];
            const dx = second.x - first.x;
            const dz = second.z - first.z;
            const distance = Math.hypot(dx, dz);
            if (distance >= min_distance || distance === 0) {
                continue;
            }
            const nx = dx / distance;
            const nz = dz / distance;
            const overlap = (min_distance - distance) / 2;
            first.x -= nx * overlap;
            first.z -= nz * overlap;
            second.x += nx * overlap;
            second.z += nz * overlap;
            // 서로 다가오는 속도 성분
            const closing = (first.vx - second.vx) * nx + (first.vz - second.vz) * nz;
            if (closing <= 0) {
                continue;
            }
            const impulse = closing * (1 + CRAZY_BUMP.RESTITUTION) / 2;
            first.vx -= impulse * nx;
            first.vz -= impulse * nz;
            second.vx += impulse * nx;
            second.vz += impulse * nz;
            if (closing >= CRAZY_BUMP.HIT_MIN_SPEED) {
                hits.push({ car_a: a, car_b: b, strength: closing, x: first.x + nx * CRAZY_BUMP.CAR_RADIUS, z: first.z + nz * CRAZY_BUMP.CAR_RADIUS });
            }
        }
    }
    return hits;
}
