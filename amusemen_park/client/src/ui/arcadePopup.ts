// 게임장 대기중 팝업 — 게임 화면을 불러오는 동안·상대를 기다리는 동안 띄움 (로비 매칭 화면 대신)
// 모양은 NPC 대화창(npc-dialog) 스타일을 그대로 씀
export interface ArcadePopup {
    readonly is_open: boolean;
    open(title: string, text: string, on_cancel: () => void): void;
    setText(text: string): void;
    close(): void;
    dispose(): void;
}

export function createArcadePopup(container: HTMLElement): ArcadePopup {
    const panel = document.createElement("section");
    panel.className = "npc-dialog arcade-popup";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");

    const header = document.createElement("header");
    header.className = "npc-dialog-header";
    const title = document.createElement("h2");
    title.className = "npc-dialog-title";
    header.append(title);

    const message = document.createElement("p");
    message.className = "npc-dialog-reply arcade-popup-text";
    message.setAttribute("aria-live", "polite");

    const cancel_button = document.createElement("button");
    cancel_button.type = "button";
    cancel_button.className = "npc-dialog-choice arcade-popup-cancel";
    cancel_button.textContent = "취소";

    panel.append(header, message, cancel_button);
    container.appendChild(panel);

    let on_cancel: (() => void) | null = null;
    cancel_button.addEventListener("click", () => on_cancel?.());

    return {
        get is_open() {
            return !panel.hidden;
        },
        open(next_title, text, cancel) {
            title.textContent = next_title;
            message.textContent = text;
            on_cancel = cancel;
            panel.hidden = false;
        },
        setText(text) {
            message.textContent = text;
        },
        close() {
            panel.hidden = true;
            on_cancel = null;
        },
        dispose() {
            panel.remove();
        },
    };
}
