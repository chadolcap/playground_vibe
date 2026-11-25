// PC 키보드 이동 입력 — WASD / 방향키, Shift 를 누르고 있으면 달리기
export interface MoveInput {
    // 오른쪽(+) / 왼쪽(-)
    x: number;
    // 앞(+) / 뒤(-)
    y: number;
    // 달리기 (키보드 Shift, 조이스틱 끝까지)
    run?: boolean;
}

const RUN_KEYS = new Set(["ShiftLeft", "ShiftRight"]);

export interface KeyboardInput {
    read(): MoveInput;
    dispose(): void;
}

const KEY_DIRECTIONS: Record<string, MoveInput> = {
    KeyW: { x: 0, y: 1 },
    ArrowUp: { x: 0, y: 1 },
    KeyS: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: -1 },
    KeyA: { x: -1, y: 0 },
    ArrowLeft: { x: -1, y: 0 },
    KeyD: { x: 1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
};

// 입력칸(추후 채팅 등)에 글자를 치는 중에는 이동하지 않음
function isTyping(): boolean {
    const element = document.activeElement;
    return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

export function createKeyboardInput(): KeyboardInput {
    const pressed = new Set<string>();
    const run_keys = new Set<string>();

    const onKeyDown = (event: KeyboardEvent): void => {
        if (RUN_KEYS.has(event.code) && !isTyping()) {
            run_keys.add(event.code);
        }
        if (event.code in KEY_DIRECTIONS && !isTyping()) {
            pressed.add(event.code);
            // 방향키로 페이지가 스크롤되지 않게
            event.preventDefault();
        }
    };
    const onKeyUp = (event: KeyboardEvent): void => {
        pressed.delete(event.code);
        run_keys.delete(event.code);
    };
    // 창 전환 시 키를 뗀 신호를 못 받아 계속 걷는 문제 방지
    const onBlur = (): void => {
        pressed.clear();
        run_keys.clear();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return {
        read() {
            let x = 0;
            let y = 0;
            for (const code of pressed) {
                x += KEY_DIRECTIONS[code].x;
                y += KEY_DIRECTIONS[code].y;
            }
            // 대각선이 더 빠르지 않도록 길이 1로 제한
            const length = Math.hypot(x, y);
            const run = run_keys.size > 0;
            return length > 1 ? { x: x / length, y: y / length, run } : { x, y, run };
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
            window.removeEventListener("blur", onBlur);
        },
    };
}
