// 기구 연속음 도구 — 반복 소음(굉음·바람·물소리)·모터음·떨림(트레몰로) 루프와, 음량을 바뀔 때만 예약하는 setLevel
import type { AudioEngine } from "./audioEngine";

export interface LoopVoice {
    // 음량 (0 = 안 들림)
    gain: AudioParam;
    filter: BiquadFilterNode;
    stop(): void;
}

// 떨림 '드르르르': 소음을 빠르게 껐다 켰다(트레몰로) — 빠를수록 촘촘하게
export interface RattleVoice {
    level: AudioParam;
    rate: AudioParam;
    filter: BiquadFilterNode;
    stop(): void;
}

// 반복 소음(굉음·바람·물소리) 또는 낮은 모터음 — 음량 0 으로 시작해 상태에 따라 조절
export function createLoop(engine: AudioEngine, destination: AudioNode, filter_type: BiquadFilterType, frequency: number, motor: boolean): LoopVoice {
    const { context } = engine;
    const filter = context.createBiquadFilter();
    filter.type = filter_type;
    filter.frequency.value = frequency;
    filter.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.value = 0;
    filter.connect(gain).connect(destination);
    let source: AudioScheduledSourceNode;
    if (motor) {
        const oscillator = context.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = 70;
        oscillator.connect(filter);
        oscillator.start();
        source = oscillator;
    } else {
        const noise = context.createBufferSource();
        noise.buffer = engine.noise;
        noise.loop = true;
        noise.connect(filter);
        // 기구마다 소음 시작 위치를 달리해 같은 소리가 겹쳐 들리지 않게
        noise.start(0, Math.random() * engine.noise.duration);
        source = noise;
    }
    return {
        gain: gain.gain,
        filter,
        stop() {
            source.stop();
            gain.disconnect();
        },
    };
}

export function createRattle(engine: AudioEngine, destination: AudioNode): RattleVoice {
    const { context } = engine;
    const noise = context.createBufferSource();
    noise.buffer = engine.noise;
    noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 220;
    filter.Q.value = 1.4;
    // 트레몰로: 기본 0.5 ± 0.5 로 음량이 빠르게 오르내림
    const tremolo = context.createGain();
    tremolo.gain.value = 0.5;
    const lfo = context.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 12;
    const lfo_depth = context.createGain();
    lfo_depth.gain.value = 0.5;
    lfo.connect(lfo_depth).connect(tremolo.gain);
    const level = context.createGain();
    level.gain.value = 0;
    noise.connect(filter).connect(tremolo).connect(level).connect(destination);
    noise.start(0, Math.random() * engine.noise.duration);
    lfo.start();
    return {
        level: level.gain,
        rate: lfo.frequency,
        filter,
        stop() {
            noise.stop();
            lfo.stop();
            level.disconnect();
        },
    };
}

// 값마다 마지막으로 예약한 목표 (같은 목표를 매 프레임 다시 예약하지 않게)
const last_targets = new WeakMap<AudioParam, number>();

export function setLevel(engine: AudioEngine, param: AudioParam, value: number): void {
    // 소리 장치가 멈춰 있으면(첫 터치 전·음소거) 시각이 멈춰 있어 예약이 쌓이기만 하므로 건너뜀
    if (!engine.isRunning()) {
        return;
    }
    const last = last_targets.get(param);
    if (last !== undefined && Math.abs(last - value) <= Math.max(0.002, Math.abs(last) * 0.01)) {
        return;
    }
    last_targets.set(param, value);
    // 부드럽게 따라가게 (뚝뚝 끊기는 잡음 방지)
    param.setTargetAtTime(value, engine.context.currentTime, 0.08);
}

export function clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
}
