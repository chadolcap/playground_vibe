// 놀이공원 배경음 — 사방에서 사람들이 떠드는 소리, 멀리서 덜컹덜컹 지나가는 롤러코스터와 비명
// 음원 파일(public/audio, ElevenLabs 로 생성)을 불러와 군중은 반복 재생하고, 롤러코스터는 가끔 한 번씩 재생
// 소리마다 좌우 위치(팬)를 줘서 여러 방향에서 들리게 하고, 멀리 있는 느낌을 위해 고음을 깎고 울림을 섞음
// 기구를 타는 동안은 배경음을 줄여 타고 있는 기구 소리가 잘 들리게 함
// 음원을 불러오지 못하면 그 소리만 빠지고 게임은 그대로 진행
import type { AudioEngine } from "./audioEngine";

// 배경음 전체 크기 (걸어 다닐 때 / 탑승 중)
const AMBIENCE_VOLUME = 0.85;
const AMBIENCE_RIDING_VOLUME = 0.3;
// 멀리서 들리는 느낌: 이 주파수보다 높은 소리를 깎고, 울림을 섞음
const DISTANCE_LOWPASS = 3200;
const REVERB_SEND = 0.5;
// 음원 파일 (vite public 폴더 기준)
const AUDIO_BASE = `${import.meta.env.BASE_URL}audio/`;
const CROWD_FILE = "park_crowd.mp3";
const COASTER_FILE = "park_coaster.mp3";
// 소리별 크기
const CROWD_VOLUME = 0.5;
const COASTER_VOLUME = 0.45;
// 멀리서 지나가는 롤러코스터 간격(초)
const COASTER_INTERVAL: readonly [number, number] = [6, 13];

export interface ParkAmbience {
    // 매 프레임: 탑승 중이면 배경음을 줄임
    update(is_riding: boolean): void;
    dispose(): void;
}

function randomBetween([min, max]: readonly [number, number]): number {
    return min + Math.random() * (max - min);
}

// 음원 하나를 불러와 소리 장치용으로 풀어 둠 (실패하면 null)
async function loadBuffer(context: AudioContext, file: string): Promise<AudioBuffer | null> {
    try {
        const response = await fetch(AUDIO_BASE + file);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        return await context.decodeAudioData(await response.arrayBuffer());
    } catch (error) {
        console.warn(`[audio] 배경음 ${file} 을 불러오지 못해 빼고 진행합니다`, error);
        return null;
    }
}

export function createParkAmbience(engine: AudioEngine): ParkAmbience {
    const { context } = engine;
    // 배경음 모음 → 먼 거리 필터 → 출력 (+ 울림)
    const bus = context.createGain();
    bus.gain.value = 0;
    const distance = context.createBiquadFilter();
    distance.type = "lowpass";
    distance.frequency.value = DISTANCE_LOWPASS;
    bus.connect(distance).connect(engine.output);
    const send = context.createGain();
    send.gain.value = REVERB_SEND;
    distance.connect(send).connect(engine.reverb);

    // 소리 하나를 정해진 방향에서 들리게 하는 출구
    function pannedOutput(volume: number, pan = Math.random() * 2 - 1): GainNode {
        const gain = context.createGain();
        gain.gain.value = volume;
        const panner = context.createStereoPanner();
        panner.pan.value = pan;
        gain.connect(panner).connect(bus);
        return gain;
    }

    let disposed = false;
    // 반복 재생 중인 음원 (정리할 때 멈춤)
    const loops: AudioBufferSourceNode[] = [];
    let coaster_buffer: AudioBuffer | null = null;

    // 음원을 끝없이 반복 재생 (군중)
    function startLoop(buffer: AudioBuffer, output: AudioNode): void {
        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(output);
        // 시작 위치를 무작위로 — 접속할 때마다 같은 순간부터 들리지 않게
        source.start(context.currentTime, Math.random() * buffer.duration);
        loops.push(source);
    }

    void loadBuffer(context, CROWD_FILE).then((buffer) => {
        if (buffer !== null && !disposed) {
            // 군중은 사방에서 들리므로 가운데
            startLoop(buffer, pannedOutput(CROWD_VOLUME, 0));
        }
    });
    void loadBuffer(context, COASTER_FILE).then((buffer) => {
        coaster_buffer = buffer;
    });

    // 멀리서 롤러코스터가 지나감: 무작위 방향에서 한 번 재생
    function playDistantCoaster(buffer: AudioBuffer): void {
        const source = context.createBufferSource();
        source.buffer = buffer;
        // 조금씩 빠르기·높낮이를 달리해 매번 같은 소리로 들리지 않게
        source.playbackRate.value = 0.9 + Math.random() * 0.2;
        const output = pannedOutput(COASTER_VOLUME * (0.7 + Math.random() * 0.3));
        source.connect(output);
        source.onended = () => output.disconnect();
        source.start();
    }

    const now = (): number => performance.now() / 1000;
    let bus_target = -1;
    let next_coaster = now() + randomBetween([1, 4]);

    return {
        update(is_riding) {
            // 소리 장치가 멈췄거나 음소거면 새 소리를 만들지 않음 (깨어날 때 몰아서 나지 않게 시각만 당겨 둠)
            const time = now();
            if (!engine.isRunning()) {
                next_coaster = Math.max(next_coaster, time + 1);
                return;
            }
            // 배경음 크기는 탑승 여부가 바뀔 때만 예약 (매 프레임 예약하면 쌓임)
            const target = is_riding ? AMBIENCE_RIDING_VOLUME : AMBIENCE_VOLUME;
            if (target !== bus_target) {
                bus_target = target;
                bus.gain.setTargetAtTime(target, context.currentTime, 0.4);
            }
            if (time >= next_coaster) {
                if (coaster_buffer !== null) {
                    playDistantCoaster(coaster_buffer);
                }
                next_coaster = time + randomBetween(COASTER_INTERVAL);
            }
        },
        dispose() {
            disposed = true;
            for (const source of loops) {
                try {
                    source.stop();
                } catch {
                    // 이미 멈춘 소리
                }
            }
            bus.disconnect();
            distance.disconnect();
        },
    };
}
