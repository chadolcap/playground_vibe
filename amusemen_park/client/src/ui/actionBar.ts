// 상호작용 버튼 줄 ('타기'·'내리기'·'말 걸기' 등) — PC 는 첫 버튼을 E 키로도 누를 수 있음
// 위치: setAnchor 로 화면 좌표를 주면 그 지점 위 말풍선(내 오리 머리 위), null 이면 화면 오른쪽 아래 고정
export interface ActionItem {
    // 같은 id·label·disabled 면 다시 그리지 않음
    id: string;
    label: string;
    disabled?: boolean;
    onClick: () => void;
}

export interface ScreenPoint {
    // CSS 픽셀 (화면 왼쪽 위 기준)
    x: number;
    y: number;
}

export interface ActionBar {
    setActions(actions: readonly ActionItem[]): void;
    // 말풍선 꼬리가 가리킬 화면 좌표 (null = 오른쪽 아래 고정 위치)
    setAnchor(point: ScreenPoint | null): void;
    dispose(): void;
}

const SHORTCUT_CODE = "KeyE";

export function createActionBar(container: HTMLElement, show_shortcut: boolean): ActionBar {
    const bar = document.createElement("div");
    bar.className = "action-bar";
    container.appendChild(bar);

    let current: readonly ActionItem[] = [];
    let current_key = "";

    function render(actions: readonly ActionItem[]): void {
        bar.replaceChildren();
        actions.forEach((action, index) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "action-button";
            button.disabled = action.disabled === true;
            button.textContent = show_shortcut && index === 0 ? `${action.label} (E)` : action.label;
            // 3D 화면 드래그(카메라 회전)로 이벤트가 새지 않게
            button.addEventListener("pointerdown", (event) => event.stopPropagation());
            button.addEventListener("click", () => action.onClick());
            bar.appendChild(button);
        });
    }

    const onKeyDown = (event: KeyboardEvent): void => {
        const element = document.activeElement;
        if (event.code !== SHORTCUT_CODE || event.repeat || element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            return;
        }
        const first = current[0];
        if (first !== undefined && first.disabled !== true) {
            first.onClick();
        }
    };
    window.addEventListener("keydown", onKeyDown);

    return {
        setActions(actions) {
            current = actions;
            const key = actions.map((action) => `${action.id}|${action.label}|${action.disabled === true}`).join(";");
            if (key !== current_key) {
                current_key = key;
                render(actions);
            }
        },
        setAnchor(point) {
            const is_bubble = point !== null;
            bar.classList.toggle("is-bubble", is_bubble);
            // 매 프레임 호출되므로 레이아웃을 다시 계산하지 않는 transform 으로만 이동
            bar.style.transform = is_bubble ? `translate3d(${Math.round(point.x)}px, ${Math.round(point.y)}px, 0) translate(-50%, -100%)` : "";
        },
        dispose() {
            window.removeEventListener("keydown", onKeyDown);
            bar.remove();
        },
    };
}
