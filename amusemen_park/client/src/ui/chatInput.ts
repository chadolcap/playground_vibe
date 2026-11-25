// 채팅 입력창 — 캐릭터 동작 메뉴의 '채팅'을 누르면 화면 아래에 열림 (Enter 보내기, Esc·바깥 누르기 닫기)
import { CHAT_RULE } from "@shared";

// 이보다 적게 가리면 키보드가 아님 (주소창이 접히고 펴지는 정도의 높이 변화는 무시, px)
const KEYBOARD_MIN_HEIGHT = 80;
// 키보드와 입력창 사이 간격(px)
const KEYBOARD_GAP = 8;

export interface ChatInput {
    readonly is_open: boolean;
    open(): void;
    close(): void;
    dispose(): void;
}

// on_send: 입력한 글 (정리·검증은 받는 쪽에서) — 보내면 입력창은 닫힘
export function createChatInput(container: HTMLElement, on_send: (text: string) => void): ChatInput {
    const form = document.createElement("form");
    form.className = "chat-input";
    form.hidden = true;
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = CHAT_RULE.MAX_LENGTH;
    input.placeholder = `하고 싶은 말 (${CHAT_RULE.MAX_LENGTH}자까지)`;
    input.autocomplete = "off";
    input.enterKeyHint = "send";
    const send = document.createElement("button");
    send.type = "submit";
    send.textContent = "보내기";
    form.append(input, send);
    container.appendChild(form);

    let is_open = false;

    // 모바일 키보드가 화면 아래를 가리면 그 높이만큼 입력창을 올려 키보드 바로 위에 붙임
    // (iOS 는 키보드가 떠도 레이아웃 높이는 그대로이고 보이는 영역(visualViewport)만 줄어듦,
    //  Android Chrome 은 레이아웃 높이 자체가 줄어 가린 높이가 0 — 이때는 CSS 기본 위치 그대로)
    const viewport = window.visualViewport;
    function followKeyboard(): void {
        if (viewport === null || !is_open) {
            return;
        }
        const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
        form.style.bottom = covered > KEYBOARD_MIN_HEIGHT ? `${Math.round(covered + KEYBOARD_GAP)}px` : "";
    }
    viewport?.addEventListener("resize", followKeyboard);
    viewport?.addEventListener("scroll", followKeyboard);

    function close(): void {
        if (!is_open) {
            return;
        }
        is_open = false;
        form.hidden = true;
        form.style.bottom = "";
        input.value = "";
        input.blur();
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const text = input.value;
        close();
        if (text.trim() !== "") {
            on_send(text);
        }
    });
    // 입력창 안의 키는 게임(이동·메뉴 단축키)으로 보내지 않음
    input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.code === "Escape") {
            close();
        }
    });
    // 3D 화면 드래그(카메라 회전)·바깥 누르기 판정으로 새지 않게
    form.addEventListener("pointerdown", (event) => event.stopPropagation());
    // 입력창 바깥(게임 화면)을 누르면 닫음
    const onOutside = (event: PointerEvent): void => {
        if (is_open && !form.contains(event.target as Node)) {
            close();
        }
    };
    window.addEventListener("pointerdown", onOutside);

    return {
        get is_open() {
            return is_open;
        },
        open() {
            is_open = true;
            form.hidden = false;
            // 입력칸으로 페이지를 스크롤하지 않게 (게임 화면이 밀려 올라가지 않음 — 위치는 followKeyboard 가 맞춤)
            input.focus({ preventScroll: true });
            followKeyboard();
        },
        close,
        dispose() {
            viewport?.removeEventListener("resize", followKeyboard);
            viewport?.removeEventListener("scroll", followKeyboard);
            window.removeEventListener("pointerdown", onOutside);
            form.remove();
        },
    };
}
