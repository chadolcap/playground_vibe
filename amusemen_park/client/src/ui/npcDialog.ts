// NPC 대화창 — 선택지를 누르면 대답을 표시 (요청 처리는 바깥에서 onChoose 로)
import { NPC_CHOICE_LIST, type NpcChoiceId } from "@shared";

export interface NpcDialog {
    readonly is_open: boolean;
    readonly npc_id: string | null;
    open(npc_id: string, ride_name: string): void;
    // 대답 문구 표시 (is_error 면 안내 색)
    showReply(text: string, is_error?: boolean): void;
    setPending(value: boolean): void;
    close(): void;
    dispose(): void;
}

const GREETING_TEXT = "꽥! 나한테 궁금한 게 있니? 아래에서 골라 봐!";

export function createNpcDialog(container: HTMLElement, on_choose: (npc_id: string, choice_id: NpcChoiceId) => void): NpcDialog {
    const panel = document.createElement("section");
    panel.className = "npc-dialog";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");

    const header = document.createElement("header");
    header.className = "npc-dialog-header";
    const title = document.createElement("h2");
    title.className = "npc-dialog-title";
    const close_button = document.createElement("button");
    close_button.type = "button";
    close_button.className = "npc-dialog-close";
    close_button.textContent = "✕";
    close_button.setAttribute("aria-label", "대화 닫기");
    header.append(title, close_button);

    const reply = document.createElement("p");
    reply.className = "npc-dialog-reply";
    reply.setAttribute("aria-live", "polite");

    const choices = document.createElement("div");
    choices.className = "npc-dialog-choices";
    const choice_buttons = NPC_CHOICE_LIST.map((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "npc-dialog-choice";
        button.textContent = choice.label;
        button.addEventListener("click", () => {
            if (current_npc_id !== null) {
                on_choose(current_npc_id, choice.id);
            }
        });
        return button;
    });
    choices.append(...choice_buttons);

    panel.append(header, reply, choices);
    // 대화창 위 클릭·드래그가 카메라 회전으로 새지 않게
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    container.appendChild(panel);

    let current_npc_id: string | null = null;

    const dialog: NpcDialog = {
        get is_open() {
            return current_npc_id !== null;
        },
        get npc_id() {
            return current_npc_id;
        },
        open(npc_id, ride_name) {
            current_npc_id = npc_id;
            title.textContent = `🐥 ${npc_id} · ${ride_name}`;
            dialog.showReply(GREETING_TEXT);
            dialog.setPending(false);
            panel.hidden = false;
        },
        showReply(text, is_error = false) {
            reply.textContent = text;
            reply.classList.toggle("is-error", is_error);
        },
        setPending(value) {
            for (const button of choice_buttons) {
                button.disabled = value;
            }
        },
        close() {
            current_npc_id = null;
            panel.hidden = true;
        },
        dispose() {
            panel.remove();
        },
    };
    close_button.addEventListener("click", () => dialog.close());
    return dialog;
}
