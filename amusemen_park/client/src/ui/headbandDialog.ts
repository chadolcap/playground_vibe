// 머리띠 고르기 미니 팝업 — 머리띠 6종 + 벗기, 지금 쓰고 있는 것을 표시 (요청 처리는 바깥에서 on_choose 로)
// 모양은 NPC 대화창(npc-dialog) 스타일을 그대로 씀
import { HEADBAND_LIST, HEADBAND_NONE } from "@shared";

export interface HeadbandDialog {
    readonly is_open: boolean;
    open(): void;
    // 지금 쓰고 있는 머리띠 ("" = 없음) — 그 버튼을 강조
    setCurrent(headband_id: string): void;
    showMessage(text: string, is_error?: boolean): void;
    setPending(value: boolean): void;
    close(): void;
    dispose(): void;
}

const GREETING_TEXT = "어떤 머리띠를 써 볼까요? 고르면 바로 써져요!";
const REMOVE_LABEL = "🙅 벗기";

export function createHeadbandDialog(container: HTMLElement, on_choose: (headband_id: string) => void): HeadbandDialog {
    const panel = document.createElement("section");
    panel.className = "npc-dialog headband-dialog";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");

    const header = document.createElement("header");
    header.className = "npc-dialog-header";
    const title = document.createElement("h2");
    title.className = "npc-dialog-title";
    title.textContent = "🎀 머리띠 판매점";
    const close_button = document.createElement("button");
    close_button.type = "button";
    close_button.className = "npc-dialog-close";
    close_button.textContent = "✕";
    close_button.setAttribute("aria-label", "머리띠 판매점 닫기");
    header.append(title, close_button);

    const message = document.createElement("p");
    message.className = "npc-dialog-reply";
    message.setAttribute("aria-live", "polite");

    const choices = document.createElement("div");
    choices.className = "npc-dialog-choices headband-choices";
    const options = [...HEADBAND_LIST.map((headband) => ({ id: headband.id as string, label: headband.label })), { id: HEADBAND_NONE, label: REMOVE_LABEL }];
    const buttons = options.map((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "npc-dialog-choice headband-choice";
        // 라벨 앞의 그림 문자(🐰 등)만 따로 크게 — "🐰 토끼 귀" → 그림 + 이름
        const space = option.label.indexOf(" ");
        const icon = document.createElement("span");
        icon.className = "headband-choice-icon";
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = space < 0 ? "" : option.label.slice(0, space);
        const name = document.createElement("span");
        name.textContent = space < 0 ? option.label : option.label.slice(space + 1);
        button.append(icon, name);
        button.dataset.headband = option.id;
        button.addEventListener("click", () => on_choose(option.id));
        return button;
    });
    choices.append(...buttons);

    panel.append(header, message, choices);
    // 팝업 위 클릭·드래그가 카메라 회전으로 새지 않게
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    container.appendChild(panel);

    let is_open = false;
    let current = "";
    let is_pending = false;

    function refreshDisabled(): void {
        for (const button of buttons) {
            // 쓰고 있지 않을 때는 벗기 버튼을 누를 필요가 없음
            button.disabled = is_pending || (button.dataset.headband === HEADBAND_NONE && current === HEADBAND_NONE);
        }
    }

    const dialog: HeadbandDialog = {
        get is_open() {
            return is_open;
        },
        open() {
            is_open = true;
            dialog.showMessage(GREETING_TEXT);
            dialog.setPending(false);
            panel.hidden = false;
        },
        setCurrent(headband_id) {
            if (headband_id === current) {
                return;
            }
            current = headband_id;
            for (const button of buttons) {
                const is_current = button.dataset.headband === headband_id && headband_id !== HEADBAND_NONE;
                button.classList.toggle("is-selected", is_current);
                button.setAttribute("aria-pressed", String(is_current));
            }
            refreshDisabled();
        },
        showMessage(text, is_error = false) {
            message.textContent = text;
            message.classList.toggle("is-error", is_error);
        },
        setPending(value) {
            is_pending = value;
            refreshDisabled();
        },
        close() {
            is_open = false;
            panel.hidden = true;
        },
        dispose() {
            panel.remove();
        },
    };
    close_button.addEventListener("click", () => dialog.close());
    return dialog;
}
