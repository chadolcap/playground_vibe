// 범퍼카 — 서버 물리 위치를 받아 부드럽게 표시, 탑승 중 조종 입력 전송, 충돌 연출(효과·흔들림)
import * as THREE from "three";
import { Callbacks, type Room } from "@colyseus/sdk";
import { BUMPER, BUMPER_WALL, CLIENT_MESSAGE, RIDE_ID, SERVER_MESSAGE, type BumperHit, type BumperInputPayload } from "@shared";
import type { MoveInput } from "../controls/keyboardInput";
import { isBumperCarModel, type BumperCarPose } from "../world/rides/bumperCar";
import type { ParkWorld } from "../world/parkWorld";
import { createImpactEffects } from "./impactEffects";

interface CarState {
    x: number;
    z: number;
    heading: number;
}

interface Snapshot extends BumperCarPose {
    time: number;
}

interface StateCallbacks {
    onAdd(property: string, handler: (value: CarState, key: number) => void, immediate?: boolean): () => void;
    onChange(instance: object, handler: () => void): () => void;
}

// 다른 플레이어와 같은 방식: 서버 패치(50ms)의 2배만큼 과거를 보간해 그림
const INTERPOLATION_DELAY_MS = 100;
const MAX_SNAPSHOTS = 10;

export interface BumperCars {
    // 매 프레임 (기구 갱신 직후, 좌석에 앉히기 전에)
    update(): void;
    // 범퍼카 탑승 중일 때 조종 입력 전송 (my_seat = 내 좌석 번호, 아니면 null)
    drive(inputs: readonly MoveInput[], my_seat: number | null, delta: number): void;
    // 내 차의 현재 진행 방향 (카메라를 차 뒤로 맞추는 데 사용)
    headingOf(seat_index: number): number | null;
    dispose(): void;
}

export interface BumperCarsOptions {
    world: ParkWorld;
    room: Room;
    // 내 차가 부딪혔을 때 (화면 흔들림 등)
    onMyHit: (strength: number) => void;
    getMySeat: () => number | null;
}

function lerpAngle(from: number, to: number, ratio: number): number {
    return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * ratio;
}

export function createBumperCars(options: BumperCarsOptions): BumperCars {
    const { world, room, onMyHit, getMySeat } = options;
    const model = world.rides.get(RIDE_ID.BUMPER_CAR);
    const callbacks = Callbacks.get(room) as unknown as StateCallbacks;
    const histories: Snapshot[][] = [];
    const poses: BumperCarPose[] = [];
    const stops: (() => void)[] = [];
    const effects = createImpactEffects(world.scene);
    const hit_point = new THREE.Vector3();

    const stop_add = callbacks.onAdd("bumper_cars", (car, index) => {
        histories[index] = [{ time: performance.now(), x: car.x, z: car.z, heading: car.heading }];
        poses[index] = { x: car.x, z: car.z, heading: car.heading };
        stops.push(callbacks.onChange(car, () => {
            const history = histories[index];
            history.push({ time: performance.now(), x: car.x, z: car.z, heading: car.heading });
            if (history.length > MAX_SNAPSHOTS) {
                history.shift();
            }
        }));
    }, true);

    // 충돌: 모든 사람 화면에 충돌 효과 + 두 차가 튀어 오름, 내 차면 화면 흔들림
    const stop_hit = room.onMessage(SERVER_MESSAGE.BUMPER_HIT, (hit: BumperHit) => {
        if (!isBumperCarModel(model)) {
            return;
        }
        model.bump(hit.car_a, hit.strength);
        if (hit.car_b !== BUMPER_WALL) {
            model.bump(hit.car_b, hit.strength);
        }
        hit_point.set(hit.x, 1, hit.z);
        model.root.localToWorld(hit_point);
        effects.spawn(hit_point, hit.strength);
        const my_seat = getMySeat();
        if (my_seat !== null && (hit.car_a === my_seat || hit.car_b === my_seat)) {
            onMyHit(hit.strength);
        }
    });

    let input_elapsed = 0;
    let last_sent: BumperInputPayload | null = null;
    let last_sent_time = 0;

    return {
        update() {
            effects.update();
            if (!isBumperCarModel(model) || histories.length === 0) {
                return;
            }
            const render_time = performance.now() - INTERPOLATION_DELAY_MS;
            histories.forEach((history, index) => {
                const pose = poses[index];
                const newest = history[history.length - 1];
                if (render_time >= newest.time) {
                    Object.assign(pose, newest);
                    return;
                }
                for (let order = history.length - 1; order > 0; order -= 1) {
                    const older = history[order - 1];
                    const newer = history[order];
                    if (render_time >= older.time) {
                        const ratio = (render_time - older.time) / Math.max(newer.time - older.time, 1);
                        pose.x = THREE.MathUtils.lerp(older.x, newer.x, ratio);
                        pose.z = THREE.MathUtils.lerp(older.z, newer.z, ratio);
                        pose.heading = lerpAngle(older.heading, newer.heading, ratio);
                        return;
                    }
                }
                Object.assign(pose, history[0]);
            });
            model.applyCarPoses(poses);
        },
        drive(inputs, my_seat, delta) {
            if (my_seat === null) {
                last_sent = null;
                return;
            }
            input_elapsed += delta;
            if (input_elapsed < 1 / BUMPER.INPUT_RATE) {
                return;
            }
            input_elapsed = 0;
            let throttle = 0;
            let steer = 0;
            for (const input of inputs) {
                // 위(W·↑) = 앞으로, 오른쪽(D·→) = 오른쪽으로 핸들
                throttle += input.y;
                steer += input.x;
            }
            const payload: BumperInputPayload = { throttle: THREE.MathUtils.clamp(throttle, -1, 1), steer: THREE.MathUtils.clamp(steer, -1, 1) };
            const now = performance.now() / 1000;
            const changed = last_sent === null || payload.throttle !== last_sent.throttle || payload.steer !== last_sent.steer;
            // 값이 바뀌었거나, 서버 입력 유효시간이 지나기 전에 한 번씩 다시 보냄
            if (changed || now - last_sent_time > BUMPER.INPUT_TIMEOUT / 2) {
                room.send(CLIENT_MESSAGE.BUMPER_INPUT, payload);
                last_sent = payload;
                last_sent_time = now;
            }
        },
        headingOf(seat_index) {
            const pose = poses[seat_index];
            if (pose === undefined || !isBumperCarModel(model)) {
                return null;
            }
            return pose.heading + model.root.rotation.y;
        },
        dispose() {
            stop_add();
            stop_hit();
            for (const stop of stops) {
                stop();
            }
            effects.dispose();
        },
    };
}
