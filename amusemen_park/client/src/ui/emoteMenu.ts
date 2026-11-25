// 이모티콘 버튼(캐릭터 동작 메뉴) — 내 캐릭터를 클릭(탭)하면 머리 위에 알약 버튼을 반원 모양으로 띄움
// 캐릭터를 다시 누르거나 다른 곳을 누르면 닫힘 (드래그로 시점을 돌린 것은 클릭으로 보지 않음)
import * as THREE from "three";
import type { ActionItem, ScreenPoint } from "./actionBar";

// 클릭으로 인정하는 최대 포인터 이동(px)·누른 시간(ms) — 드래그(시점 회전)와 구분
const TAP_MOVE_TOLERANCE = 10;
const TAP_MAX_MS = 450;
// 버튼을 늘어놓는 반타원의 가로·세로 반지름(px)과 양 끝 각도 (0 = 오른쪽, 90° = 위)
// 머리를 감싸도록 가로로 넓고 세로로 낮게 — 알약 버튼(높이 34px) 5개가 겹치지 않는 가장 작은 크기:
//  맨 위와 그 옆 버튼은 가로 간격 92 × cos 50° ≈ 59px > '일어서기'(약 66px)·짧은 버튼(약 44px) 폭 절반 합 55px,
//  양 끝과 그 옆 버튼은 세로 간격 64 × (sin 50° − sin 10°) ≈ 38px > 버튼 높이 34px
const ARC_RADIUS_X = 92;
const ARC_RADIUS_Y = 64;
const ARC_START_DEGREES = 170;
const ARC_END_DEGREES = 10;

export interface EmoteMenu {
    readonly is_open: boolean;
    close(): void;
    // 같은 id·label·disabled 면 다시 그리지 않음
    setItems(items: readonly ActionItem[]): void;
    // 반원의 중심이 될 화면 좌표 (null = 화면 밖이라 숨김)
    setAnchor(point: ScreenPoint | null): void;
    dispose(): void;
}

// target: 클릭 판정에 쓰는 내 캐릭터 노드 (자식 메시까지 검사)
export function createEmoteMenu(container: HTMLElement, canvas: HTMLCanvasElement, camera: THREE.Camera, target: THREE.Object3D): EmoteMenu {
    const menu = document.createElement("div");
    menu.className = "emote-menu";
    menu.hidden = true;
    container.appendChild(menu);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let is_open = false;
    let current_key = "";

    function setOpen(next: boolean): void {
        is_open = next;
        // 숨겼다(display: none) 다시 보이면 버튼이 튀어나오는 효과가 다시 재생됨
        menu.hidden = !next;
    }

    function hitsTarget(client_x: number, client_y: number): boolean {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((client_x - rect.left) / rect.width) * 2 - 1, -((client_y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        return raycaster.intersectObject(target, true).length > 0;
    }

    // 지금 보이는 버튼의 항목 (누르면 같은 자리 항목의 onClick — 버튼을 다시 만들지 않고 항목만 바꿔 끼움)
    let current_items: readonly ActionItem[] = [];

    function applyItem(button: HTMLButtonElement, item: ActionItem): void {
        // 버튼마다 색 (world.css 의 .emote-button[data-id])
        button.dataset.id = item.id;
        button.disabled = item.disabled === true;
        button.textContent = item.label;
    }

    function render(items: readonly ActionItem[]): void {
        const buttons = menu.querySelectorAll<HTMLButtonElement>(".emote-button");
        current_items = items;
        // 개수가 같으면(앉기 ↔ 일어서기, 먹기 가능 여부만 바뀜) 글자·색·누를 수 있는지만 바꿈
        // — 버튼을 새로 만들면 모든 버튼의 튀어나오는 효과가 다시 재생되어 출렁여 보임
        if (buttons.length === items.length) {
            items.forEach((item, index) => applyItem(buttons[index], item));
            return;
        }
        menu.replaceChildren();
        items.forEach((item, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "emote-button";
            applyItem(button, item);
            // 반원 위에 같은 간격으로 (버튼 하나면 맨 위)
            const ratio = items.length > 1 ? index / (items.length - 1) : 0.5;
            const angle = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(ARC_START_DEGREES, ARC_END_DEGREES, ratio));
            button.style.left = `${Math.round(Math.cos(angle) * ARC_RADIUS_X)}px`;
            button.style.top = `${Math.round(-Math.sin(angle) * ARC_RADIUS_Y)}px`;
            button.style.animationDelay = `${index * 30}ms`;
            // 3D 화면 드래그(카메라 회전)로 이벤트가 새지 않게
            button.addEventListener("pointerdown", (event) => event.stopPropagation());
            button.addEventListener("click", () => current_items[index]?.onClick());
            menu.appendChild(button);
        });
    }

    // 포인터를 누른 위치·시각 (손가락 여러 개를 따로 추적)
    const downs = new Map<number, { x: number; y: number; time: number }>();
    const onPointerDown = (event: PointerEvent): void => {
        downs.set(event.pointerId, { x: event.clientX, y: event.clientY, time: performance.now() });
    };
    const onPointerUp = (event: PointerEvent): void => {
        const down = downs.get(event.pointerId);
        downs.delete(event.pointerId);
        if (down === undefined || performance.now() - down.time > TAP_MAX_MS || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_MOVE_TOLERANCE) {
            return;
        }
        // 내 캐릭터를 누르면 열고 닫기, 다른 곳을 누르면 닫기
        setOpen(hitsTarget(event.clientX, event.clientY) ? !is_open : false);
    };
    const onPointerCancel = (event: PointerEvent): void => {
        downs.delete(event.pointerId);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
        if (event.code === "Escape" && is_open) {
            setOpen(false);
        }
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    window.addEventListener("keydown", onKeyDown);

    return {
        get is_open() {
            return is_open;
        },
        close() {
            if (is_open) {
                setOpen(false);
            }
        },
        setItems(items) {
            const key = items.map((item) => `${item.id}|${item.label}|${item.disabled === true}`).join(";");
            if (key !== current_key) {
                current_key = key;
                render(items);
            }
        },
        setAnchor(point) {
            menu.style.visibility = point === null ? "hidden" : "";
            // 매 프레임 호출되므로 레이아웃을 다시 계산하지 않는 transform 으로만 이동
            if (point !== null) {
                menu.style.transform = `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0)`;
            }
        },
        dispose() {
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerCancel);
            window.removeEventListener("keydown", onKeyDown);
            menu.remove();
        },
    };
}
