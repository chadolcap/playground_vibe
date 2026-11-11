// 첫 페이지 — 별명 입력·검증·입장 처리
import { NICKNAME_MAX_LENGTH, checkNickname } from "@shared";
import { joinPark, toJoinErrorText, type JoinResult } from "../net/connection";

export interface IntroScreen {
    show(message?: string): void;
    hide(): void;
}

function getElement<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (element === null) {
        throw new Error(`#${id} 요소를 찾을 수 없습니다.`);
    }
    return element as T;
}

export function createIntroScreen(on_joined: (join_result: JoinResult, name: string) => void): IntroScreen {
    const screen_el = getElement<HTMLElement>("intro-screen");
    const form_el = getElement<HTMLFormElement>("join-form");
    const input_el = getElement<HTMLInputElement>("nickname-input");
    const count_el = getElement<HTMLElement>("nickname-count");
    const message_el = getElement<HTMLElement>("join-message");
    const button_el = getElement<HTMLButtonElement>("join-button");

    let is_joining = false;

    input_el.maxLength = NICKNAME_MAX_LENGTH;

    function setMessage(text: string, is_error: boolean): void {
        message_el.textContent = text;
        message_el.classList.toggle("is-error", is_error);
    }

    function setJoining(value: boolean): void {
        is_joining = value;
        button_el.disabled = value;
        input_el.disabled = value;
        button_el.textContent = value ? "입장하는 중…" : "입장하기";
    }

    function updateCount(): void {
        const length = Array.from(input_el.value.trim()).length;
        count_el.textContent = `${length}/${NICKNAME_MAX_LENGTH}`;
    }

    // 입력 중에는 규칙 위반만 즉시 안내 (빈 칸은 제출 시에만 안내)
    input_el.addEventListener("input", () => {
        updateCount();
        if (input_el.value.trim() === "") {
            setMessage("", false);
            return;
        }
        const result = checkNickname(input_el.value);
        setMessage(result.ok ? "" : result.reason, !result.ok);
    });

    form_el.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (is_joining) {
            return;
        }
        const result = checkNickname(input_el.value);
        if (!result.ok) {
            setMessage(result.reason, true);
            input_el.focus();
            return;
        }

        setJoining(true);
        setMessage("", false);
        try {
            const join_result = await joinPark(result.name);
            on_joined(join_result, result.name);
        } catch (error) {
            console.warn("[intro] 입장 실패", error);
            setMessage(toJoinErrorText(error), true);
        } finally {
            setJoining(false);
        }
    });

    return {
        show(message?: string): void {
            screen_el.hidden = false;
            setMessage(message ?? "", message !== undefined);
            updateCount();
        },
        hide(): void {
            screen_el.hidden = true;
        },
    };
}
