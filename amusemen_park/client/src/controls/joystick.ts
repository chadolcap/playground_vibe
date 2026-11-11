// 모바일 가상 조이스틱 — 화면 왼쪽 아래, 엄지로 끌어 이동
import type { MoveInput } from "./keyboardInput";

export interface Joystick {
    read(): MoveInput;
    dispose(): void;
}

// 이 비율 이하로 살짝 민 것은 무시 (손가락 떨림)
const DEAD_ZONE = 0.12;

// 포인터 캡처 — 아주 짧은 탭처럼 포인터가 이미 사라진 경우 브라우저가 예외를 던지므로 무시
export function capturePointer(element: Element, pointer_id: number): void {
    try {
        element.setPointerCapture(pointer_id);
    } catch {
        // 캡처하지 못해도 같은 요소 위의 이벤트는 계속 받으므로 진행
    }
}

export function createJoystick(container: HTMLElement): Joystick {
    const base = document.createElement("div");
    base.className = "joystick";
    base.setAttribute("aria-hidden", "true");
    const knob = document.createElement("div");
    knob.className = "joystick-knob";
    base.appendChild(knob);
    container.appendChild(base);

    let active_pointer: number | null = null;
    let value: MoveInput = { x: 0, y: 0 };

    function update(event: PointerEvent): void {
        const rect = base.getBoundingClientRect();
        const radius = rect.width / 2;
        let dx = event.clientX - (rect.left + radius);
        let dy = event.clientY - (rect.top + radius);
        const length = Math.hypot(dx, dy);
        if (length > radius) {
            dx = (dx / length) * radius;
            dy = (dy / length) * radius;
        }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        const strength = Math.min(length / radius, 1);
        // 화면 위쪽(-y)이 앞으로
        value = strength < DEAD_ZONE ? { x: 0, y: 0 } : { x: dx / radius, y: -dy / radius };
    }

    function release(): void {
        active_pointer = null;
        value = { x: 0, y: 0 };
        knob.style.transform = "";
        base.classList.remove("is-active");
    }

    const onPointerDown = (event: PointerEvent): void => {
        if (active_pointer !== null) {
            return;
        }
        active_pointer = event.pointerId;
        capturePointer(base, event.pointerId);
        base.classList.add("is-active");
        update(event);
        event.preventDefault();
    };
    const onPointerMove = (event: PointerEvent): void => {
        if (event.pointerId === active_pointer) {
            update(event);
        }
    };
    const onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId === active_pointer) {
            release();
        }
    };

    base.addEventListener("pointerdown", onPointerDown);
    base.addEventListener("pointermove", onPointerMove);
    base.addEventListener("pointerup", onPointerUp);
    base.addEventListener("pointercancel", onPointerUp);

    return {
        read: () => value,
        dispose() {
            base.remove();
        },
    };
}
