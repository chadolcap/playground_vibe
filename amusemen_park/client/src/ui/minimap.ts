// 미니맵 — 화면 좌측 상단, 북쪽(-z)이 위. 구역·길·놀이기구는 한 번만 그려 두고, 매 갱신마다 오리 위치만 덧그림
import { MAP_HALF, RIDE_LIST, ZONES, type ZoneId } from "@shared";
import { getPathSegments } from "../world/terrain";

export interface MinimapDot {
    x: number;
    z: number;
}

export interface Minimap {
    // 내 위치·방향(rot_y), 다른 플레이어 위치
    update(me: { x: number; z: number; rot_y: number }, others: readonly MinimapDot[]): void;
    dispose(): void;
}

// 화면에 보이는 크기(CSS px) — 실제 캔버스는 기기 픽셀 비율만큼 크게
const SIZE = 156;
// 너무 자주 그리지 않도록 (초당 10회)
const REDRAW_INTERVAL_MS = 100;

const ZONE_COLORS: Record<ZoneId, string> = {
    global_fair: "#f6e6c4",
    american_adventure: "#f3d3a4",
    magic_land: "#e3d4f5",
    european_adventure: "#cfe8b8",
    zootopia: "#dcedb2",
};

function createLayer(size_px: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement("canvas");
    canvas.width = size_px;
    canvas.height = size_px;
    const context = canvas.getContext("2d");
    if (context === null) {
        throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
    }
    return [canvas, context];
}

export function createMinimap(container: HTMLElement): Minimap {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const size_px = Math.round(SIZE * ratio);
    // 월드 좌표(-MAP_HALF~MAP_HALF) → 캔버스 픽셀
    const scale = size_px / (MAP_HALF * 2);
    const toPx = (value: number): number => (value + MAP_HALF) * scale;

    const wrapper = document.createElement("div");
    wrapper.className = "minimap";
    const [canvas, context] = createLayer(size_px);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    // 고정 배경: 잔디 → 구역 → 길 → 놀이기구
    const [background, bg] = createLayer(size_px);
    bg.fillStyle = "#bfe6a6";
    bg.fillRect(0, 0, size_px, size_px);
    for (const zone of Object.values(ZONES)) {
        bg.fillStyle = ZONE_COLORS[zone.id];
        bg.beginPath();
        bg.roundRect(toPx(zone.x - zone.width / 2), toPx(zone.z - zone.depth / 2), zone.width * scale, zone.depth * scale, 8 * ratio);
        bg.fill();
    }
    bg.strokeStyle = "#fffaf0";
    bg.lineCap = "round";
    for (const segment of getPathSegments()) {
        bg.lineWidth = Math.max(segment.width * scale, 2 * ratio);
        bg.beginPath();
        bg.moveTo(toPx(segment.ax), toPx(segment.az));
        bg.lineTo(toPx(segment.bx), toPx(segment.bz));
        bg.stroke();
    }
    for (const ride of RIDE_LIST) {
        bg.fillStyle = "rgba(255, 140, 120, 0.85)";
        bg.beginPath();
        bg.arc(toPx(ride.x), toPx(ride.z), Math.max(ride.footprint_radius * scale * 0.6, 4 * ratio), 0, Math.PI * 2);
        bg.fill();
        bg.fillStyle = "#ffffff";
        bg.beginPath();
        bg.arc(toPx(ride.x), toPx(ride.z), 1.8 * ratio, 0, Math.PI * 2);
        bg.fill();
    }

    let last_draw = 0;

    return {
        update(me, others) {
            const now = performance.now();
            if (now - last_draw < REDRAW_INTERVAL_MS) {
                return;
            }
            last_draw = now;
            context.drawImage(background, 0, 0);
            // 다른 오리
            context.fillStyle = "#5aa9e6";
            for (const dot of others) {
                context.beginPath();
                context.arc(toPx(dot.x), toPx(dot.z), 2.6 * ratio, 0, Math.PI * 2);
                context.fill();
            }
            // 내 위치: 바라보는 방향의 화살표 (rot_y 0 = +z = 화면 아래)
            const x = toPx(me.x);
            const y = toPx(me.z);
            const dir_x = Math.sin(me.rot_y);
            const dir_y = Math.cos(me.rot_y);
            const length = 7 * ratio;
            const half_width = 4.5 * ratio;
            context.fillStyle = "#ff5a5f";
            context.strokeStyle = "#ffffff";
            context.lineWidth = 1.6 * ratio;
            context.beginPath();
            context.moveTo(x + dir_x * length, y + dir_y * length);
            context.lineTo(x - dir_x * length * 0.6 - dir_y * half_width, y - dir_y * length * 0.6 + dir_x * half_width);
            context.lineTo(x - dir_x * length * 0.6 + dir_y * half_width, y - dir_y * length * 0.6 - dir_x * half_width);
            context.closePath();
            context.fill();
            context.stroke();
        },
        dispose() {
            wrapper.remove();
        },
    };
}
