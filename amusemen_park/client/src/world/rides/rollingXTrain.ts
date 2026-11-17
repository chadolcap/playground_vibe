// 롤링 엑스 트레인 — 수직 루프가 있는 롤러코스터 (좌석 12 = 3칸 × 2열 × 2줄)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import {
    buildPathFrames,
    createCart,
    createClosedCurve,
    createRails,
    createStation,
    createSupports,
    createThrill,
    placeTrain,
    type RideModel,
} from "./common";
import { buildCoasterTimeline } from "./ridePhysics";

// 루프 중심·반지름 — 진행하면서 z 를 조금씩 옮겨(나선) 들어가는 길과 나오는 길이 겹치지 않게 함
const LOOP_CENTER_X = 5;
// 꼭대기(11.2)를 리프트 정상(약 14)보다 충분히 낮춰야 루프 꼭대기에서도 속도가 남아 몸이 좌석에 붙음
const LOOP_CENTER_Y = 6.6;
const LOOP_RADIUS = 4.6;
// 높이에 따른 루프 폭 비율 (아래 → 위) — 실제 코스터의 물방울(클로소이드) 루프
// 원형 루프는 진입 순간 G 가 확 튀지만, 아래는 넓고 위는 좁으면 G 가 부드럽게 오르고 느려진 꼭대기에서도 몸이 좌석에 붙음
const LOOP_BOTTOM_WIDTH = 1.3;
const LOOP_TOP_NARROWING = 0.85;

function loopPoints(): [number, number, number][] {
    const points: [number, number, number][] = [];
    const steps = 12;
    for (let step = 0; step <= steps; step += 1) {
        const angle = -Math.PI / 2 + (step / steps) * Math.PI * 2;
        const z = -16.4 - (step / steps) * 3;
        const height_ratio = (Math.sin(angle) + 1) / 2;
        const half_width = LOOP_RADIUS * (LOOP_BOTTOM_WIDTH - LOOP_TOP_NARROWING * height_ratio);
        points.push([LOOP_CENTER_X + Math.cos(angle) * half_width, LOOP_CENTER_Y + Math.sin(angle) * LOOP_RADIUS, z]);
    }
    return points;
}

const TRACK_POINTS: [number, number, number][] = [
    // 승강장 (정면, -x 방향으로 출발)
    [10, 1.4, 6], [0, 1.4, 6], [-10, 1.4, 6],
    // 왼쪽으로 돌며 상승
    [-16, 4, 0], [-15, 11, -8], [-9, 14, -12],
    // 하강해 루프 진입
    [-3, 6, -15.8], [1, 2.4, -16.2],
    ...loopPoints(),
    // 루프 탈출 후 오른쪽으로 돌아 승강장 복귀
    [11, 2.6, -19.4], [16, 6, -12], [16, 4, -4], [14, 2, 3],
];

const CAR_COUNT = 3;
const CAR_GAP = 2.9;

export function createRollingXTrain(): RideModel {
    const root = new THREE.Group();
    const frames = buildPathFrames(createClosedCurve(TRACK_POINTS), 480, true);
    // 실제 물리로 한 바퀴를 미리 계산 → 방 시각만으로 열차 위치·체감 G 결정 (트랙 뱅크도 정하므로 레일보다 먼저)
    const timeline = buildCoasterTimeline(frames, { chain_speed: 3.5, station_speed: 4, brake_speed: 3, dwell_seconds: 5, shake: 0.4 });
    const thrill = createThrill();

    root.add(createRails(frames, { gauge: 1.2, radius: 0.12, color: "#e63946", tie_every: 3, tie_color: "#4a4e69" }));
    root.add(createSupports(frames, { every: 10, radius: 0.18, color: "#f1f1f1", min_height: 2.2 }));

    const station = createStation(16, 3, "#ffd6a5", "#e63946");
    station.position.set(0, 0, 8.6);
    root.add(station);

    const cars: THREE.Group[] = [];
    const seat_anchors: THREE.Object3D[] = [];
    for (let order = 0; order < CAR_COUNT; order += 1) {
        const cart = createCart({ rows: 2, cols: 2, body_color: order === 0 ? "#ff6b6b" : "#ff8787" });
        cars.push(cart.group);
        seat_anchors.push(...cart.anchors);
        root.add(cart.group);
    }

    return {
        id: RIDE_ID.ROLLING_X_TRAIN,
        root,
        seat_anchors,
        thrill,
        update(time) {
            placeTrain(cars, frames, timeline.uAt(time), CAR_GAP, 0.15);
            timeline.thrillAt(time, thrill);
        },
    };
}
