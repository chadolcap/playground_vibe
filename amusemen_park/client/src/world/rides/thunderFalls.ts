// 썬더폴스 — 보트가 물길을 따라 올라갔다가 높은 곳에서 첨벙 떨어지는 워터 슬라이드 (좌석 4 = 2열 × 2줄)
import * as THREE from "three";
import { RIDE_ID } from "@shared";
import {
    addMesh,
    buildLapTimeline,
    buildPathFrames,
    createCart,
    createClosedCurve,
    createRails,
    createRibbon,
    createSupports,
    placeOnPath,
    speedAtHeight,
    type RideModel,
} from "./common";

const FLUME_POINTS: [number, number, number][] = [
    // 승강장 (정면 낮은 곳)
    [6, 0.6, 7], [-2, 0.6, 7], [-8, 0.8, 4],
    // 왼쪽 뒤로 돌며 천천히 상승
    [-10, 3, -3], [-9, 7, -10], [-4, 9, -15], [3, 9.2, -16], [9, 9, -12], [10, 8.7, -6], [9.6, 8.4, -2.5],
    // 급강하 → 착수 웅덩이
    [9.2, 1.4, 3.2], [8.6, 0.6, 6.2],
];

const TOP_HEIGHT = 10.5;
const WATER_COLOR = "#48cae4";
const WOOD_COLOR = "#9c6644";
const ROCK_COLORS = ["#8d99ae", "#7d8597", "#a0a6b3"];

export function createThunderFalls(): RideModel {
    const root = new THREE.Group();
    const frames = buildPathFrames(createClosedCurve(FLUME_POINTS), 360, true);

    // 물길: 양쪽 나무 벽 + 물 띠
    root.add(createRails(frames, { gauge: 2.4, radius: 0.28, color: WOOD_COLOR }));
    root.add(createRibbon(frames, 2.3, WATER_COLOR, -0.15));
    root.add(createSupports(frames, { every: 9, radius: 0.22, color: WOOD_COLOR, min_height: 1.5 }));

    // 착수 웅덩이
    addMesh(root, new THREE.CylinderGeometry(5, 5.2, 0.35, 32), WATER_COLOR, [7, 0.18, 5]);
    addMesh(root, new THREE.TorusGeometry(5.1, 0.3, 8, 32), "#6c757d", [7, 0.3, 5], [Math.PI / 2, 0, 0]);

    // 뒤쪽 바위산
    const rocks: [number, number, number, number][] = [[-2, 3.5, -19, 5], [4, 2.5, -20, 4], [-7, 2, -17, 3.4], [9, 2, -17, 3]];
    rocks.forEach(([x, y, z, size], index) => {
        addMesh(root, new THREE.DodecahedronGeometry(size, 0), ROCK_COLORS[index % ROCK_COLORS.length], [x, y, z], [index, index * 0.7, 0]);
    });

    // 보트 (카트 몸체를 주황 보트로 사용)
    const boat = createCart({ rows: 2, cols: 2, body_color: "#ff9f1c", seat_color: "#2b2d42" });
    addMesh(boat.group, new THREE.BoxGeometry(2.4, 0.3, 2.8), "#f77f00", [0, 0.08, 0]);
    root.add(boat.group);

    // 오르막은 컨베이어처럼 천천히, 내리막은 빠르게 — 한 바퀴 시간표로 계산
    const timeline = buildLapTimeline(frames, (position, tangent) => (tangent.y > 0.2 ? 2.5 : speedAtHeight(position.y, TOP_HEIGHT, 3, 0.7)));

    return {
        id: RIDE_ID.THUNDER_FALLS,
        root,
        seat_anchors: boat.anchors,
        update(time) {
            placeOnPath(boat.group, frames, timeline.uAt(time), -0.05);
            // 물 위에서 살짝 출렁임
            boat.group.position.y += Math.sin(time * 3) * 0.05;
        },
    };
}
