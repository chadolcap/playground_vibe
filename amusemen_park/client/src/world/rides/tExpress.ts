// T익스프레스 — 높은 리프트 힐과 급강하가 있는 대형 우든 코스터 (좌석 12 = 3칸 × 2열 × 2줄)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import {
    buildLapTimeline,
    buildPathFrames,
    createCart,
    createClosedCurve,
    createRails,
    createStation,
    getMaterial,
    placeTrain,
    speedAtHeight,
    type PathFrames,
    type RideModel,
} from "./common";

const TRACK_POINTS: [number, number, number][] = [
    // 승강장
    [12, 2, 7], [0, 2, 7], [-12, 2, 7],
    // 리프트 힐 (뒤쪽으로 높이 올라감)
    [-19, 3, 1], [-19.5, 8, -6], [-17, 18, -14], [-13, 26, -20], [-8, 27, -24],
    // 첫 급강하
    [-3, 22, -27], [1, 6, -26], [5, 2.5, -23],
    // 에어타임 언덕 두 개
    [10, 12, -20], [15, 5, -15], [19, 10, -8], [19, 4, -1], [16, 2.2, 4],
];

const CAR_COUNT = 3;
const CAR_GAP = 2.9;
const TOP_HEIGHT = 29;
const WOOD_COLOR = "#a47148";
const WOOD_DARK = "#7f5539";

// 나무 격자 구조물: 레일 양쪽 기둥 + 일정 높이마다 가로 보 (인스턴싱)
function createWoodLattice(frames: PathFrames, gauge: number): THREE.Group {
    const group = new THREE.Group();
    const post_matrices: THREE.Matrix4[] = [];
    const beam_matrices: THREE.Matrix4[] = [];
    const dummy = new THREE.Object3D();
    const side = new THREE.Vector3();
    for (let index = 0; index < frames.positions.length - 1; index += 6) {
        const position = frames.positions[index];
        if (position.y < 2.5) {
            continue;
        }
        side.crossVectors(new THREE.Vector3(0, 1, 0), frames.tangents[index]).setY(0).normalize();
        const heading = Math.atan2(frames.tangents[index].x, frames.tangents[index].z);
        for (const direction of [-1, 1]) {
            const x = position.x + side.x * direction * (gauge / 2 + 0.2);
            const z = position.z + side.z * direction * (gauge / 2 + 0.2);
            dummy.position.set(x, (position.y - 0.3) / 2, z);
            dummy.rotation.set(0, heading, 0);
            dummy.scale.set(1, position.y - 0.3, 1);
            dummy.updateMatrix();
            post_matrices.push(dummy.matrix.clone());
        }
        for (let height = 3; height < position.y - 1; height += 3.5) {
            dummy.position.set(position.x, height, position.z);
            dummy.rotation.set(0, heading, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            beam_matrices.push(dummy.matrix.clone());
        }
    }
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.28, 1, 0.28), getMaterial(WOOD_COLOR), post_matrices.length);
    post_matrices.forEach((matrix, order) => posts.setMatrixAt(order, matrix));
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(gauge + 0.8, 0.2, 0.2), getMaterial(WOOD_DARK), beam_matrices.length);
    beam_matrices.forEach((matrix, order) => beams.setMatrixAt(order, matrix));
    posts.castShadow = true;
    beams.castShadow = true;
    group.add(posts, beams);
    return group;
}

export function createTExpress(): RideModel {
    const root = new THREE.Group();
    const frames = buildPathFrames(createClosedCurve(TRACK_POINTS), 560, true);

    root.add(createRails(frames, { gauge: 1.3, radius: 0.13, color: "#6c757d", tie_every: 2, tie_color: WOOD_DARK }));
    root.add(createWoodLattice(frames, 1.3));

    const station = createStation(20, 3, "#d4a373", "#264653");
    station.position.set(0, 0, 9.6);
    root.add(station);

    const cars: THREE.Group[] = [];
    const seat_anchors: THREE.Object3D[] = [];
    for (let order = 0; order < CAR_COUNT; order += 1) {
        const cart = createCart({ rows: 2, cols: 2, body_color: order === 0 ? "#2a9d8f" : "#40b5a6" });
        cars.push(cart.group);
        seat_anchors.push(...cart.anchors);
        root.add(cart.group);
    }

    // 오르막(리프트 힐)에서는 체인이 끌어올리듯 일정한 느린 속도, 나머지는 높이에 따른 속도 — 한 바퀴 시간표로 계산
    const timeline = buildLapTimeline(frames, (position, tangent) => (tangent.y > 0.35 ? 4 : speedAtHeight(position.y, TOP_HEIGHT, 4.5, 0.75)));

    return {
        id: RIDE_ID.T_EXPRESS,
        root,
        seat_anchors,
        update(time) {
            placeTrain(cars, frames, timeline.uAt(time), CAR_GAP, 0.15);
        },
    };
}
