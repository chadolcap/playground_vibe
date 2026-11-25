// 미니맵 — 화면 좌측 상단, 북쪽(-z)이 위. 길·광장·놀이기구는 한 번만 그려 두고, 매 갱신마다 오리 위치만 덧그림
// 확대: +/− 버튼, 마우스 휠, 두 손가락 벌리기(모바일). 확대 중에는 내 위치를 가운데에 두고 따라감
// 기구 이름은 확대해도 같은 글자 크기로 또렷하게 보이도록 매번 화면 좌표에 따로 그림
// 모바일(터치)은 화면을 덜 가리게 작게 두고, '크게보기' 버튼으로 화면 가운데 팝업으로 띄움 (크기는 minimap.css)
import { ARCADE, MAP_HALF, RIDE_LIST } from "@shared";
import { HUB_CENTER, HUB_RADIUS, getPathSegments } from "../world/terrain";

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
const SIZE = 200;
// 너무 자주 그리지 않도록 (초당 10회)
const REDRAW_INTERVAL_MS = 100;
// 확대 범위와 버튼 한 번에 바뀌는 배율
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 1.6;
const WHEEL_ZOOM_RATE = 0.0025;
// 휠 값이 줄 단위로 올 때 한 줄을 몇 픽셀로 볼지
const WHEEL_LINE_PX = 16;
// 확대해도 흐려지지 않도록 배경을 미리 이만큼 크게 그려 둠
const BACKGROUND_DETAIL = 3;
// 이보다 적게 움직이고 뗀 터치만 "누른 곳으로 걷기"로 봄 (핀치·흔들림과 구분)
const TAP_MOVE_LIMIT = 8;
// 두 번 누름(달리기)으로 보는 간격(ms)·거리(px) — 땅 클릭(controls/clickToMove.ts)과 같은 값
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE = 40;
// 기구 이름 글자 크기 (CSS px) — 확대할수록 조금 크게
const LABEL_FONT_PX = 10;
const LABEL_FONT_ZOOMED_PX = 12;
// 미니맵이 이보다 작게 보이면(모바일 축소 상태) 기구 이름은 글자가 겹쳐 읽을 수 없으므로 그리지 않음
const LABEL_MIN_MAP_PX = 120;

// 미니맵에 동그라미·이름으로 표시할 장소 — 놀이기구 + 게임장 (반지름은 영역 크기, 표시할 때 0.6배)
interface MapSpot {
    name: string;
    x: number;
    z: number;
    radius: number;
    color: string;
}

// 게임장 영역 반지름 (게임기 5대가 좌우 약 9m 로 늘어섬)
const ARCADE_MAP_RADIUS = 7;

const MAP_SPOTS: readonly MapSpot[] = [
    ...RIDE_LIST.map((ride) => ({ name: ride.name, x: ride.x, z: ride.z, radius: ride.footprint_radius, color: "rgba(255, 140, 120, 0.85)" })),
    { name: "게임장", x: ARCADE.x, z: ARCADE.z, radius: ARCADE_MAP_RADIUS, color: "rgba(167, 128, 255, 0.85)" },
];

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

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

// 고정 배경: 잔디 → 길 → 분수대 광장 → 놀이기구 (detail_px 크기, 맵 전체)
function drawBackground(detail_px: number, ratio: number): HTMLCanvasElement {
    const [background, bg] = createLayer(detail_px);
    const scale = detail_px / (MAP_HALF * 2);
    const toPx = (value: number): number => (value + MAP_HALF) * scale;
    const unit = ratio * BACKGROUND_DETAIL;
    bg.fillStyle = "#bfe6a6";
    bg.fillRect(0, 0, detail_px, detail_px);
    bg.strokeStyle = "#fffaf0";
    bg.lineCap = "round";
    for (const segment of getPathSegments()) {
        bg.lineWidth = Math.max(segment.width * scale, 2 * unit);
        bg.beginPath();
        bg.moveTo(toPx(segment.ax), toPx(segment.az));
        bg.lineTo(toPx(segment.bx), toPx(segment.bz));
        bg.stroke();
    }
    bg.fillStyle = "#fff6e3";
    bg.beginPath();
    bg.arc(toPx(HUB_CENTER.x), toPx(HUB_CENTER.z), HUB_RADIUS * scale, 0, Math.PI * 2);
    bg.fill();
    bg.fillStyle = "#48cae4";
    bg.beginPath();
    bg.arc(toPx(HUB_CENTER.x), toPx(HUB_CENTER.z), Math.max(3 * scale, 1.5 * unit), 0, Math.PI * 2);
    bg.fill();
    for (const spot of MAP_SPOTS) {
        bg.fillStyle = spot.color;
        bg.beginPath();
        bg.arc(toPx(spot.x), toPx(spot.z), Math.max(spot.radius * scale * 0.6, 4 * unit), 0, Math.PI * 2);
        bg.fill();
        bg.fillStyle = "#ffffff";
        bg.beginPath();
        bg.arc(toPx(spot.x), toPx(spot.z), 1.8 * unit, 0, Math.PI * 2);
        bg.fill();
    }
    return background;
}

function createZoomButton(label: string, title: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "minimap-zoom-button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    return button;
}

// on_pick: 미니맵을 누른 지점의 월드 좌표 (그곳까지 자동 이동 — 한 번 누름 = 걷기, 빠르게 두 번 = 달리기)
export function createMinimap(container: HTMLElement, on_pick: (x: number, z: number, run: boolean) => void): Minimap {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    // 캔버스 실제 픽셀 크기 — 보이는 크기(모바일 축소·팝업)가 바뀌면 그에 맞춰 다시 잡음 (draw 참고)
    let size_px = Math.round(SIZE * ratio);
    const detail_px = size_px * BACKGROUND_DETAIL;
    const background = drawBackground(detail_px, ratio);
    const label_font = getComputedStyle(document.body).fontFamily || "sans-serif";

    const wrapper = document.createElement("div");
    wrapper.className = "minimap";
    const [canvas, context] = createLayer(size_px);
    wrapper.appendChild(canvas);
    const zoom_bar = document.createElement("div");
    zoom_bar.className = "minimap-zoom";
    const zoom_in = createZoomButton("+", "미니맵 확대");
    const zoom_out = createZoomButton("−", "미니맵 축소");
    zoom_bar.append(zoom_in, zoom_out);
    wrapper.appendChild(zoom_bar);
    // 크게보기(모바일에서만 보임) / 팝업 닫기 버튼, 팝업 뒤 어두운 배경
    const expand_button = document.createElement("button");
    expand_button.type = "button";
    expand_button.className = "minimap-expand";
    expand_button.textContent = "크게보기";
    const close_button = createZoomButton("✕", "미니맵 닫기");
    close_button.classList.add("minimap-close");
    wrapper.append(expand_button, close_button);
    const backdrop = document.createElement("div");
    backdrop.className = "minimap-backdrop";
    container.append(backdrop, wrapper);
    wrapper.title = "누른 곳으로 걸어가요 · 휠이나 두 손가락으로 확대";

    let zoom = MIN_ZOOM;
    let center_x = 0;
    let center_z = 0;
    let last_draw = 0;
    let last_me = { x: 0, z: 0, rot_y: 0 };
    let last_others: readonly MinimapDot[] = [];

    // 보이는 영역 가운데: 확대 전엔 맵 중앙, 확대 중엔 내 위치 (맵 밖이 보이지 않게 가장자리에서 멈춤)
    function updateView(): void {
        const half_view = MAP_HALF / zoom;
        center_x = zoom <= MIN_ZOOM ? 0 : clamp(last_me.x, -MAP_HALF + half_view, MAP_HALF - half_view);
        center_z = zoom <= MIN_ZOOM ? 0 : clamp(last_me.z, -MAP_HALF + half_view, MAP_HALF - half_view);
    }

    // 월드 좌표 → 미니맵 캔버스 픽셀 (확대·이동 반영)
    const pixelsPerUnit = (): number => (size_px / (MAP_HALF * 2)) * zoom;
    const toPxX = (x: number): number => (x - center_x) * pixelsPerUnit() + size_px / 2;
    const toPxY = (z: number): number => (z - center_z) * pixelsPerUnit() + size_px / 2;

    // 보이는 크기에 맞춰 캔버스 픽셀 수를 바꿈 (작게 보일 때 글자가 뭉개지거나, 팝업에서 흐려지지 않게)
    function fitCanvas(): void {
        const shown_px = canvas.clientWidth;
        const next = Math.round((shown_px > 0 ? shown_px : SIZE) * ratio);
        if (next !== size_px) {
            size_px = next;
            canvas.width = size_px;
            canvas.height = size_px;
        }
    }

    function draw(): void {
        fitCanvas();
        updateView();
        // 배경에서 보이는 영역만 잘라 그림
        const source_scale = detail_px / (MAP_HALF * 2);
        const half_view = MAP_HALF / zoom;
        const source_size = half_view * 2 * source_scale;
        context.drawImage(
            background,
            (center_x - half_view + MAP_HALF) * source_scale,
            (center_z - half_view + MAP_HALF) * source_scale,
            source_size,
            source_size,
            0,
            0,
            size_px,
            size_px,
        );
        drawLabels();
        // 다른 오리
        context.fillStyle = "#5aa9e6";
        for (const dot of last_others) {
            context.beginPath();
            context.arc(toPxX(dot.x), toPxY(dot.z), 2.6 * ratio, 0, Math.PI * 2);
            context.fill();
        }
        drawMe();
    }

    // 기구·게임장 이름 (흰 테두리 글씨, 원 위쪽 — 미니맵 위 가장자리에 걸리면 원 아래쪽, 좌우 가장자리에서는 안쪽으로 밀어 넣음)
    function drawLabels(): void {
        if (size_px < LABEL_MIN_MAP_PX * ratio) {
            return;
        }
        const font_px = (zoom >= ZOOM_STEP ? LABEL_FONT_ZOOMED_PX : LABEL_FONT_PX) * ratio;
        context.font = `800 ${font_px}px ${label_font}`;
        context.textAlign = "center";
        context.textBaseline = "bottom";
        context.lineJoin = "round";
        context.lineWidth = 3 * ratio;
        context.strokeStyle = "rgba(255, 255, 255, 0.95)";
        context.fillStyle = "#4a3426";
        const edge = 3 * ratio;
        for (const spot of MAP_SPOTS) {
            const ride_px_x = toPxX(spot.x);
            const ride_px_y = toPxY(spot.z);
            const radius = Math.max(spot.radius * pixelsPerUnit() * 0.6, 4 * ratio);
            if (ride_px_x < -radius || ride_px_x > size_px + radius || ride_px_y < -radius || ride_px_y > size_px + radius) {
                continue;
            }
            let y = ride_px_y - radius - ratio;
            if (y - font_px < edge) {
                y = ride_px_y + radius + font_px + ratio;
            }
            const half_text = context.measureText(spot.name).width / 2;
            const x = Math.min(Math.max(ride_px_x, half_text + edge), size_px - half_text - edge);
            context.strokeText(spot.name, x, y);
            context.fillText(spot.name, x, y);
        }
    }

    // 내 위치: 바라보는 방향의 화살표 (rot_y 0 = +z = 화면 아래)
    function drawMe(): void {
        const x = toPxX(last_me.x);
        const y = toPxY(last_me.z);
        const dir_x = Math.sin(last_me.rot_y);
        const dir_y = Math.cos(last_me.rot_y);
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
    }

    function setZoom(next: number): void {
        const clamped = clamp(next, MIN_ZOOM, MAX_ZOOM);
        if (clamped === zoom) {
            return;
        }
        zoom = clamped;
        zoom_in.disabled = zoom >= MAX_ZOOM;
        zoom_out.disabled = zoom <= MIN_ZOOM;
        // 바로 그리지 않고 다음 갱신에서 그림 (휠·핀치가 연달아 들어와도 그리기 간격 제한을 지킴)
        last_draw = 0;
    }
    zoom_out.disabled = true;

    // ───────── 입력: 탭 = 걷기, 두 번 탭 = 달리기, 두 손가락 = 확대, 휠 = 확대 ─────────
    const pointers = new Map<number, { x: number; y: number }>();
    // 앞 탭 (두 번 누름 판정 — 두 번째 탭은 첫 탭이 고른 지점으로 달려감)
    let last_tap = { time: -Infinity, client_x: 0, client_y: 0, x: 0, z: 0 };
    // 펼친 미니맵을 닫는 예약 — 두 번째 탭을 기다리는 동안은 펼친 채로 둠 (바로 닫으면 두 번째 탭이 작은 미니맵의 다른 곳을 누름)
    let collapse_timer: number | undefined;
    let tap: { id: number; x: number; y: number } | null = null;
    let pinch: { distance: number; zoom: number } | null = null;

    const pointerDistance = (): number => {
        const [a, b] = [...pointers.values()];
        return Math.hypot(a.x - b.x, a.y - b.y);
    };

    // 3D 화면 드래그(카메라 회전)·더블탭 판정으로 새지 않게 막음
    const swallow = (event: Event): void => {
        event.stopPropagation();
        event.preventDefault();
    };

    // 남은 손가락 두 개를 새 기준으로 핀치를 다시 잡음 (세 손가락 중 하나를 떼도 배율이 튀지 않게)
    const restartPinch = (): void => {
        pinch = pointers.size >= 2 ? { distance: Math.max(pointerDistance(), 1), zoom } : null;
    };

    const onPointerDown = (event: PointerEvent): void => {
        swallow(event);
        // 마우스는 왼쪽 버튼만 (오른쪽·가운데 버튼은 걷기로 처리하지 않음)
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        try {
            // 손가락이 미니맵 밖으로 나가도 핀치가 이어지도록
            canvas.setPointerCapture(event.pointerId);
        } catch {
            // 이미 끝난 포인터 등 붙잡을 수 없으면 캡처 없이 진행
        }
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pointers.size === 1) {
            tap = { id: event.pointerId, x: event.clientX, y: event.clientY };
        } else {
            tap = null;
            restartPinch();
        }
    };

    const onPointerMove = (event: PointerEvent): void => {
        const pointer = pointers.get(event.pointerId);
        if (pointer === undefined) {
            return;
        }
        pointer.x = event.clientX;
        pointer.y = event.clientY;
        if (pinch !== null && pointers.size >= 2) {
            setZoom(pinch.zoom * (pointerDistance() / pinch.distance));
        } else if (tap !== null && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_MOVE_LIMIT) {
            tap = null;
        }
    };

    const onPointerUp = (event: PointerEvent): void => {
        swallow(event);
        if (tap !== null && tap.id === event.pointerId && pinch === null) {
            const now = performance.now();
            const is_double = now - last_tap.time <= DOUBLE_TAP_MS && Math.hypot(event.clientX - last_tap.client_x, event.clientY - last_tap.client_y) <= DOUBLE_TAP_DISTANCE;
            window.clearTimeout(collapse_timer);
            if (is_double) {
                // 두 번 누름: 첫 탭 지점으로 달려감, 펼친 미니맵은 바로 닫음
                on_pick(last_tap.x, last_tap.z, true);
                last_tap = { ...last_tap, time: -Infinity };
                setExpanded(false);
            } else {
                // 누른 위치(화면 크기와 무관하게 비율로) → 보이는 영역 안의 월드 좌표
                const rect = canvas.getBoundingClientRect();
                const half_view = MAP_HALF / zoom;
                const x = center_x + ((event.clientX - rect.left) / rect.width * 2 - 1) * half_view;
                const z = center_z + ((event.clientY - rect.top) / rect.height * 2 - 1) * half_view;
                on_pick(x, z, false);
                last_tap = { time: now, client_x: event.clientX, client_y: event.clientY, x, z };
                // 팝업에서 갈 곳을 골랐으면 (두 번째 탭을 기다린 뒤) 닫아서 걸어가는 모습이 보이게
                collapse_timer = window.setTimeout(() => setExpanded(false), DOUBLE_TAP_MS);
            }
        }
        const was_pinching = pinch !== null;
        pointers.delete(event.pointerId);
        tap = null;
        if (was_pinching) {
            restartPinch();
        }
    };

    const onPointerCancel = (event: PointerEvent): void => {
        pointers.delete(event.pointerId);
        tap = null;
        pinch = null;
    };

    const onWheel = (event: WheelEvent): void => {
        swallow(event);
        // 휠 값 단위를 픽셀로 맞춤 (줄 단위·쪽 단위로 오는 브라우저·설정에서는 값이 매우 작아 확대가 거의 안 됨)
        const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? canvas.clientHeight : 1;
        setZoom(zoom * Math.exp(-event.deltaY * unit * WHEEL_ZOOM_RATE));
    };

    // 미니맵 위 오른쪽 클릭 메뉴는 열지 않음
    const onContextMenu = (event: Event): void => {
        event.preventDefault();
    };

    const onZoomIn = (event: Event): void => {
        swallow(event);
        setZoom(zoom * ZOOM_STEP);
    };
    const onZoomOut = (event: Event): void => {
        swallow(event);
        setZoom(zoom / ZOOM_STEP);
    };

    // 팝업(크게보기) 열기·닫기 — 닫을 때는 확대를 되돌림 (작은 미니맵에는 확대 버튼이 없음)
    let expanded = false;
    function setExpanded(next: boolean): void {
        if (next === expanded) {
            return;
        }
        expanded = next;
        wrapper.classList.toggle("is-expanded", next);
        backdrop.classList.toggle("is-visible", next);
        if (!next) {
            setZoom(MIN_ZOOM);
        }
        last_draw = 0;
    }
    const onExpand = (event: Event): void => {
        swallow(event);
        setExpanded(true);
    };
    const onClose = (event: Event): void => {
        swallow(event);
        setExpanded(false);
    };
    // 팝업 버튼·배경을 눌러도 3D 화면 드래그가 시작되지 않게
    const stopDrag = (event: Event): void => event.stopPropagation();

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("contextmenu", onContextMenu);
    zoom_in.addEventListener("click", onZoomIn);
    zoom_out.addEventListener("click", onZoomOut);
    // 버튼을 눌러도 3D 화면 드래그가 시작되지 않게
    zoom_bar.addEventListener("pointerdown", (event) => event.stopPropagation());
    expand_button.addEventListener("click", onExpand);
    close_button.addEventListener("click", onClose);
    backdrop.addEventListener("click", onClose);
    for (const element of [expand_button, close_button, backdrop]) {
        element.addEventListener("pointerdown", stopDrag);
    }

    return {
        update(me, others) {
            last_me = me;
            last_others = others;
            const now = performance.now();
            if (now - last_draw < REDRAW_INTERVAL_MS) {
                return;
            }
            last_draw = now;
            draw();
        },
        dispose() {
            window.clearTimeout(collapse_timer);
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerCancel);
            canvas.removeEventListener("wheel", onWheel);
            canvas.removeEventListener("contextmenu", onContextMenu);
            zoom_in.removeEventListener("click", onZoomIn);
            zoom_out.removeEventListener("click", onZoomOut);
            expand_button.removeEventListener("click", onExpand);
            close_button.removeEventListener("click", onClose);
            backdrop.removeEventListener("click", onClose);
            wrapper.remove();
            backdrop.remove();
        },
    };
}
