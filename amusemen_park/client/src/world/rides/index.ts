// 놀이기구 8종 생성·배치 — 위치는 shared/rides.ts, 정면(+z)은 게이트(통로) 방향
import * as THREE from "three";
import { RIDES, RIDE_GATE_DISTANCE, RIDE_LIST, getRideGate, type RideId, type RideInfo } from "@shared";
import { createSignBoard } from "../labels";
import { addMesh, type RideModel } from "./common";
import { createBumperCar } from "./bumperCar";
import { createLetsTwist } from "./letsTwist";
import { createLostValley } from "./lostValley";
import { createPandaWorld } from "./pandaWorld";
import { createRollingXTrain } from "./rollingXTrain";
import { createSafariWorld } from "./safariWorld";
import { createTExpress } from "./tExpress";
import { createThunderFalls } from "./thunderFalls";

export type { RideModel } from "./common";

const RIDE_BUILDERS: Record<RideId, () => RideModel> = {
    rolling_x_train: createRollingXTrain,
    lets_twist: createLetsTwist,
    thunder_falls: createThunderFalls,
    bumper_car: createBumperCar,
    t_express: createTExpress,
    safari_world: createSafariWorld,
    lost_valley: createLostValley,
    panda_world: createPandaWorld,
};

// 게이트 아치 + 기구 이름 간판 (로컬 +z 쪽 게이트 위치에 세움)
function createGateArch(ride: RideInfo): THREE.Group {
    const gate = new THREE.Group();
    const sign = createSignBoard(ride.name, { height: 1.1, background: "#fff3c4", color: "#5a3e1b" });
    const half_width = Math.max(2.4, (sign.userData.width as number) / 2 + 0.4);
    for (const x of [-half_width, half_width]) {
        addMesh(gate, new THREE.CylinderGeometry(0.2, 0.25, 4, 10), "#ffb703", [x, 2, 0]);
        addMesh(gate, new THREE.SphereGeometry(0.35, 12, 10), "#fb8500", [x, 4.1, 0]);
    }
    addMesh(gate, new THREE.BoxGeometry(half_width * 2 + 0.4, 0.3, 0.3), "#fb8500", [0, 3.9, 0]);
    sign.position.set(0, 3.15, 0.2);
    gate.add(sign);
    gate.position.set(0, 0, RIDE_GATE_DISTANCE);
    return gate;
}

export function createRideModels(): Map<RideId, RideModel> {
    const models = new Map<RideId, RideModel>();
    for (const ride of RIDE_LIST) {
        const model = RIDE_BUILDERS[ride.id]();
        // 좌석 앵커 개수는 서버의 좌석 수와 반드시 같아야 함 (좌석 번호 = 앵커 번호)
        if (model.seat_anchors.length !== ride.seat_count) {
            console.error(`[rides] ${ride.id} 좌석 앵커 ${model.seat_anchors.length}개 ≠ 좌석 수 ${ride.seat_count}`);
        }
        // 기구 중심에 놓고 로컬 +z 가 게이트를 향하도록 회전
        const gate = getRideGate(ride);
        model.root.position.set(ride.x, 0, ride.z);
        model.root.rotation.y = Math.atan2(gate.x - ride.x, gate.z - ride.z);
        model.root.add(createGateArch(ride));
        model.root.name = ride.id;
        models.set(ride.id, model);
    }
    return models;
}

// 좌석 앵커의 현재 월드 좌표 (5·7단계 탑승 표시용)
export function getSeatWorldPosition(models: ReadonlyMap<RideId, RideModel>, ride_id: RideId, seat_index: number, target: THREE.Vector3): boolean {
    const anchor = models.get(ride_id)?.seat_anchors[seat_index];
    if (anchor === undefined || seat_index >= RIDES[ride_id].seat_count) {
        return false;
    }
    anchor.getWorldPosition(target);
    return true;
}
