// 효과음 합성 모음 — 한 번 울리고 끝나는 소리들 (소리마다 노드를 만들고 끝나면 저절로 정리됨)
// destination 에 연결하므로 기구별 음량(거리 감쇠)을 거쳐 나감
import type { AudioEngine } from "./audioEngine";

type Destination = AudioNode;

// 짧은 소음 조각: 필터를 거친 백색 소음 + 빠르게 커졌다 사라지는 음량
function noiseBurst(
    engine: AudioEngine,
    destination: Destination,
    options: { type: BiquadFilterType; frequency: number; q?: number; volume: number; duration: number; delay?: number; sweep_to?: number },
): void {
    const { context } = engine;
    const start = context.currentTime + (options.delay ?? 0);
    const source = context.createBufferSource();
    source.buffer = engine.noise;
    // 같은 소음이 반복돼 들리지 않게 시작 위치를 무작위로
    const offset = Math.random() * (engine.noise.duration - options.duration - 0.05);
    const filter = context.createBiquadFilter();
    filter.type = options.type;
    filter.frequency.setValueAtTime(options.frequency, start);
    if (options.sweep_to !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(options.sweep_to, start + options.duration);
    }
    filter.Q.value = options.q ?? 0.8;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
    source.connect(filter).connect(gain).connect(destination);
    source.start(start, Math.max(offset, 0), options.duration + 0.05);
}

// 짧은 음: 주파수가 미끄러지는 발진기 (쿵·딩·뾱)
function tone(
    engine: AudioEngine,
    destination: Destination,
    options: { type: OscillatorType; from: number; to?: number; volume: number; duration: number; delay?: number; attack?: number },
): void {
    const { context } = engine;
    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(options.from, start);
    if (options.to !== undefined) {
        oscillator.frequency.exponentialRampToValueAtTime(options.to, start + options.duration);
    }
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume, start + (options.attack ?? 0.005));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
    oscillator.connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.05);
}

// 리프트 체인 걸림쇠 '착' — 금속성 짧은 딸깍 (목재 코스터는 더 묵직하게)
export function playChainClack(engine: AudioEngine, destination: Destination, volume: number, heavy: boolean): void {
    noiseBurst(engine, destination, { type: "bandpass", frequency: heavy ? 1900 : 2600, q: 3, volume: volume * 0.9, duration: 0.045 });
    tone(engine, destination, { type: "square", from: heavy ? 210 : 320, to: heavy ? 140 : 220, volume: volume * 0.25, duration: 0.05 });
}

// 목재 트랙 이음매 '덜컹' — 둔탁한 나무 부딪힘
export function playWoodRattle(engine: AudioEngine, destination: Destination, volume: number): void {
    noiseBurst(engine, destination, { type: "bandpass", frequency: 420 + Math.random() * 380, q: 2.5, volume, duration: 0.07 });
    tone(engine, destination, { type: "triangle", from: 120 + Math.random() * 40, to: 70, volume: volume * 0.6, duration: 0.09 });
}

// 브레이크 '쉬이익 — 덜컥' (자석 브레이크 소리 + 열차가 걸리는 충격)
export function playBrake(engine: AudioEngine, destination: Destination, volume: number): void {
    noiseBurst(engine, destination, { type: "highpass", frequency: 2200, volume: volume * 0.5, duration: 1.3, sweep_to: 5000 });
    tone(engine, destination, { type: "sine", from: 140, to: 60, volume: volume * 0.7, duration: 0.25 });
}

// 출발 벨 '딩—동'
export function playBell(engine: AudioEngine, destination: Destination, volume: number): void {
    tone(engine, destination, { type: "sine", from: 1318, volume: volume * 0.5, duration: 0.9 });
    tone(engine, destination, { type: "sine", from: 2636, volume: volume * 0.12, duration: 0.5 });
    tone(engine, destination, { type: "sine", from: 1046, volume: volume * 0.5, duration: 1.1, delay: 0.35 });
}

// 물폭탄 착수 '쿠웅—촤아아' : 깊은 충격음 + 물이 쏟아지는 소음 + 흩날리는 물보라 + 떨어지는 물방울
export function playSplash(engine: AudioEngine, destination: Destination, volume: number): void {
    tone(engine, destination, { type: "sine", from: 95, to: 32, volume: volume, duration: 0.7, attack: 0.01 });
    noiseBurst(engine, destination, { type: "lowpass", frequency: 5200, volume: volume * 0.9, duration: 1.6, sweep_to: 420 });
    noiseBurst(engine, destination, { type: "highpass", frequency: 2800, volume: volume * 0.35, duration: 2.2, delay: 0.1 });
    for (let index = 0; index < 9; index += 1) {
        const pitch = 700 + Math.random() * 1100;
        tone(engine, destination, { type: "sine", from: pitch, to: pitch * 1.6, volume: volume * 0.08, duration: 0.07, delay: 0.5 + Math.random() * 1.6 });
    }
}

// 범퍼카 충돌 '쿵!' — 고무 범퍼의 둔탁한 충격 + 플라스틱 덜그럭 (세게 부딪힐수록 크고 낮게)
export function playBump(engine: AudioEngine, destination: Destination, strength: number): void {
    const power = Math.min(strength / 6, 1);
    tone(engine, destination, { type: "sine", from: 150 - power * 50, to: 45, volume: 0.35 + power * 0.55, duration: 0.3 });
    noiseBurst(engine, destination, { type: "bandpass", frequency: 900, q: 1.2, volume: 0.15 + power * 0.35, duration: 0.12 });
    noiseBurst(engine, destination, { type: "highpass", frequency: 3000, volume: 0.08 + power * 0.12, duration: 0.06, delay: 0.03 });
}

// 군중 비명 '꺄아아—' : 여러 사람 목소리를 모음 '아' 의 공명(포먼트)으로 흉내 — 높낮이·시작 시점을 조금씩 다르게
const SCREAM_FORMANTS: readonly [number, number][] = [[850, 1], [1250, 0.6], [2700, 0.25]];

// style: "scream" = 낙하 순간 높고 날카로운 '꺄아아', "cheer" = 낙하 뒤 들뜬 '와아아' (낮고 길게)
// pitch_scale: 목소리 높낮이 배율 (1 보다 크면 아이들처럼 높게, 작으면 어른처럼 낮게)
export function playScreams(
    engine: AudioEngine,
    destination: Destination,
    volume: number,
    voices: number,
    style: "scream" | "cheer" = "scream",
    pitch_scale = 1,
): void {
    const { context } = engine;
    const is_cheer = style === "cheer";
    for (let voice = 0; voice < voices; voice += 1) {
        const start = context.currentTime + Math.random() * (is_cheer ? 0.6 : 0.3);
        const duration = is_cheer ? 1.8 + Math.random() * 1.2 : 1.6 + Math.random() * 1.2;
        // 어린이(높은 음)~어른(낮은 음) 섞임
        const pitch = (is_cheer ? 220 + Math.random() * 260 : 380 + Math.random() * 420) * pitch_scale;
        const oscillator = context.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(pitch * 0.9, start);
        oscillator.frequency.linearRampToValueAtTime(pitch * 1.12, start + 0.25);
        oscillator.frequency.linearRampToValueAtTime(pitch * 0.82, start + duration);
        // 떨리는 목소리 (비브라토)
        const vibrato = context.createOscillator();
        vibrato.frequency.value = 5 + Math.random() * 3;
        const vibrato_depth = context.createGain();
        vibrato_depth.gain.value = pitch * 0.025;
        vibrato.connect(vibrato_depth).connect(oscillator.frequency);
        const envelope = context.createGain();
        envelope.gain.setValueAtTime(0.0001, start);
        envelope.gain.exponentialRampToValueAtTime(volume, start + 0.12);
        envelope.gain.setValueAtTime(volume, start + duration * 0.55);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        envelope.connect(destination);
        for (const [frequency, weight] of SCREAM_FORMANTS) {
            const formant = context.createBiquadFilter();
            formant.type = "bandpass";
            formant.frequency.value = frequency * (0.9 + Math.random() * 0.2);
            formant.Q.value = 5;
            const formant_gain = context.createGain();
            formant_gain.gain.value = weight;
            oscillator.connect(formant).connect(formant_gain).connect(envelope);
        }
        oscillator.start(start);
        vibrato.start(start);
        oscillator.stop(start + duration + 0.05);
        vibrato.stop(start + duration + 0.05);
    }
}

// 보트가 물길 벽에 부딪히며 출렁이는 '찰랑' (낮은 물소리 + 작은 거품)
export function playSlosh(engine: AudioEngine, destination: Destination, volume: number): void {
    noiseBurst(engine, destination, { type: "lowpass", frequency: 900 + Math.random() * 500, volume, duration: 0.45, sweep_to: 260 });
    for (let index = 0; index < 3; index += 1) {
        const pitch = 300 + Math.random() * 400;
        tone(engine, destination, { type: "sine", from: pitch, to: pitch * 1.8, volume: volume * 0.15, duration: 0.06, delay: 0.05 + Math.random() * 0.3 });
    }
}

// 목재 구조물이 비틀리며 나는 '끼익' (낮은 톱니파를 좁은 공명으로 거름)
export function playCreak(engine: AudioEngine, destination: Destination, volume: number): void {
    const { context } = engine;
    const start = context.currentTime;
    const duration = 0.25 + Math.random() * 0.25;
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    const pitch = 70 + Math.random() * 60;
    oscillator.frequency.setValueAtTime(pitch, start);
    oscillator.frequency.linearRampToValueAtTime(pitch * (1.3 + Math.random() * 0.5), start + duration);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600 + Math.random() * 500;
    filter.Q.value = 9;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter).connect(gain).connect(destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
}

// 판다 기차 '칙' (증기 뿜는 소리)과 기적 '뿌우—'
export function playChug(engine: AudioEngine, destination: Destination, volume: number): void {
    noiseBurst(engine, destination, { type: "bandpass", frequency: 1400, q: 0.9, volume, duration: 0.16 });
}

export function playWhistle(engine: AudioEngine, destination: Destination, volume: number): void {
    tone(engine, destination, { type: "triangle", from: 740, volume: volume * 0.5, duration: 0.5, attack: 0.05 });
    tone(engine, destination, { type: "triangle", from: 932, volume: volume * 0.35, duration: 0.5, attack: 0.05 });
    tone(engine, destination, { type: "triangle", from: 740, volume: volume * 0.5, duration: 0.9, attack: 0.05, delay: 0.6 });
    tone(engine, destination, { type: "triangle", from: 932, volume: volume * 0.35, duration: 0.9, attack: 0.05, delay: 0.6 });
}

// 탑승 '띠리링↑' / 하차 '띠리링↓'
export function playBoardChime(engine: AudioEngine, destination: Destination): void {
    [784, 988, 1318].forEach((frequency, index) => {
        tone(engine, destination, { type: "sine", from: frequency, volume: 0.22, duration: 0.35, delay: index * 0.08 });
    });
}

export function playLeaveChime(engine: AudioEngine, destination: Destination): void {
    [1318, 988, 784].forEach((frequency, index) => {
        tone(engine, destination, { type: "sine", from: frequency, volume: 0.18, duration: 0.3, delay: index * 0.08 });
    });
}
