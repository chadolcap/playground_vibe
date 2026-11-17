// 소리 엔진 — Web Audio API 로 효과음을 직접 합성 (음원 파일·패키지 없이)
// 브라우저 정책상 사용자가 화면을 한 번 누른 뒤에만 소리가 나므로, 누를 때마다 멈춘 소리 장치를 깨움
// 음소거 여부는 브라우저에 기억 (저장이 막힌 환경이면 켜진 상태로 시작)

const MUTE_STORAGE_KEY = "duck_park_muted";
// 전체 음량 (효과음이 배경처럼 은은하게)
const MASTER_VOLUME = 0.55;
// 소리 끄고 켤 때 툭 끊기지 않도록 부드럽게
const MUTE_FADE_SECONDS = 0.15;
// 바람·물·굉음 같은 연속음의 재료가 되는 소음 길이 (반복 재생)
// (가장 긴 원샷 소음인 물보라 2.2초보다 길게 — 짧으면 끝이 잘림)
const NOISE_SECONDS = 3;
// 잔향: 길이(초)와 섞는 양
const REVERB_SECONDS = 1.8;
const REVERB_LEVEL = 0.35;

export interface AudioEngine {
    readonly context: AudioContext;
    // 모든 효과음이 모이는 출력 (음소거는 여기서)
    readonly output: GainNode;
    // 반복 재생용 백색 소음
    readonly noise: AudioBuffer;
    // 공간 울림(잔향)으로 보내는 입력 — 야외 놀이공원의 퍼지는 느낌
    readonly reverb: AudioNode;
    readonly muted: boolean;
    setMuted(muted: boolean): void;
    // 소리 장치가 동작 중인지 (멈춰 있으면 효과음을 만들지 않음 — 쌓였다가 한꺼번에 터지지 않게)
    isRunning(): boolean;
    dispose(): void;
}

function readMuted(): boolean {
    try {
        return localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function writeMuted(muted: boolean): void {
    try {
        localStorage.setItem(MUTE_STORAGE_KEY, muted ? "1" : "0");
    } catch {
        // 저장이 막힌 환경(사생활 보호 모드 등)이면 이번 접속 동안만 유지
    }
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * NOISE_SECONDS), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
        data[index] = Math.random() * 2 - 1;
    }
    return buffer;
}

// 잔향 응답: 점점 작아지는 소음 (좌우를 달리해 넓게 퍼지는 느낌)
function createReverbImpulse(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * REVERB_SECONDS);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let index = 0; index < length; index += 1) {
            data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 3;
        }
    }
    return impulse;
}

export function createAudioEngine(): AudioEngine | null {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass === undefined) {
        return null;
    }
    const context = new AudioContextClass();
    // 좌우 위치(StereoPanner)가 없는 구형 브라우저(iOS 14.0 이하 등)는 효과음 없이 진행 — 만들다 실패하면 입장까지 막힘
    if (typeof context.createStereoPanner !== "function") {
        void context.close().catch(() => undefined);
        return null;
    }
    const output = context.createGain();
    let muted = readMuted();
    output.gain.value = muted ? 0 : MASTER_VOLUME;
    output.connect(context.destination);
    const noise = createNoiseBuffer(context);
    const convolver = context.createConvolver();
    convolver.buffer = createReverbImpulse(context);
    const reverb_level = context.createGain();
    reverb_level.gain.value = REVERB_LEVEL;
    convolver.connect(reverb_level).connect(output);

    // 화면을 누르거나 키를 누를 때마다 멈춘 소리 장치를 깨움 (모바일은 백그라운드에서 돌아오면 다시 멈춰 있음)
    // 음소거 중에는 깨우지 않음 (소리 장치를 멈춰 두어 연속음 계산에 CPU 를 쓰지 않게)
    const wake = (): void => {
        if (!muted && context.state !== "running") {
            void context.resume().catch(() => undefined);
        }
    };
    // 음소거는 소리를 줄인 뒤 소리 장치 자체를 멈춤 (출력만 0 이면 보이지 않는 연속음이 계속 계산됨)
    let suspend_timer = 0;
    const suspendWhenMuted = (): void => {
        window.clearTimeout(suspend_timer);
        suspend_timer = window.setTimeout(() => {
            if (muted) {
                void context.suspend().catch(() => undefined);
            }
        }, MUTE_FADE_SECONDS * 1000 + 50);
    };
    if (muted) {
        suspendWhenMuted();
    }
    const wake_events = ["pointerdown", "keydown", "touchend"] as const;
    for (const type of wake_events) {
        window.addEventListener(type, wake, { passive: true });
    }

    return {
        context,
        output,
        noise,
        reverb: convolver,
        get muted() {
            return muted;
        },
        setMuted(next) {
            muted = next;
            writeMuted(next);
            if (!next) {
                void context.resume().catch(() => undefined);
            }
            output.gain.cancelScheduledValues(context.currentTime);
            output.gain.setTargetAtTime(next ? 0 : MASTER_VOLUME, context.currentTime, MUTE_FADE_SECONDS / 3);
            if (next) {
                suspendWhenMuted();
            }
        },
        isRunning() {
            return context.state === "running" && !muted;
        },
        dispose() {
            window.clearTimeout(suspend_timer);
            for (const type of wake_events) {
                window.removeEventListener(type, wake);
            }
            output.disconnect();
            void context.close().catch(() => undefined);
        },
    };
}

// 화면 오른쪽 위(나가기 버튼 왼쪽) 소리 켜기/끄기 버튼
export function createSoundToggle(container: HTMLElement, engine: AudioEngine): () => void {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sound-button";
    const render = (): void => {
        button.textContent = engine.muted ? "🔇" : "🔊";
        const label = engine.muted ? "효과음 켜기" : "효과음 끄기";
        button.title = label;
        button.setAttribute("aria-label", label);
    };
    const onClick = (event: Event): void => {
        event.stopPropagation();
        engine.setMuted(!engine.muted);
        render();
    };
    render();
    button.addEventListener("click", onClick);
    // 3D 화면 드래그가 시작되지 않게
    button.addEventListener("pointerdown", (event) => event.stopPropagation());
    container.appendChild(button);
    return () => {
        button.removeEventListener("click", onClick);
        button.remove();
    };
}
