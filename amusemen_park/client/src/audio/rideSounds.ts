// 기구별 효과음 — 방 시각으로 계산된 기구 상태(속도·G·운행 단계)에 맞춰 소리를 냄
// 그래서 같은 방의 모든 사람이 같은 순간에 비명·물보라 소리를 들음
// 타고 있으면 크게, 걸어 다니며 근처에 있으면 거리에 따라 작게 (멀면 들리지 않음)
// 출발부터 승강장에 돌아올 때까지 끊기지 않게: 굉음·떨림(드르르)은 움직이는 동안 계속, 돌아오는 길엔 물 찰랑임·환호
import * as THREE from "three";
import { RIDE_ID, type RideId } from "@shared";
import type { RideModel, RideThrill } from "../world/rides/common";
import type { AudioEngine } from "./audioEngine";
import { clamp01, createLoop, createRattle, setLevel, type LoopVoice, type RattleVoice } from "./soundLoops";
import {
    playBell,
    playBoardChime,
    playBrake,
    playBump,
    playChainClack,
    playChug,
    playCreak,
    playLeaveChime,
    playScreams,
    playSlosh,
    playSplash,
    playWhistle,
    playWoodRattle,
} from "./sfxLibrary";

type SoundKind = "steel_coaster" | "wood_coaster" | "flume" | "pendulum" | "swing_ship" | "train";

const RIDE_SOUND_KIND: Partial<Record<RideId, SoundKind>> = {
    [RIDE_ID.DUCK_X]: "wood_coaster",
    [RIDE_ID.DUCK_FALL]: "flume",
    [RIDE_ID.DUCK_TWIST]: "pendulum",
    [RIDE_ID.DUCK_VOYAGE]: "swing_ship",
};

// 걸어 다닐 때 기구 소리가 들리는 거리와 최대 음량 (타고 있을 때 1)
const HEAR_RANGE = 70;
const SPECTATOR_VOLUME = 0.6;
const CRAZY_BUMP_HEAR_RANGE = 40;
// 공간 울림으로 보내는 양 (가까운 소리도 야외에서 퍼지는 느낌)
const REVERB_SEND = 0.45;
// 체인 '착착착' 박자 (초) — 코스터 체인은 빠르게, 후룸 컨베이어는 느긋하게
const CHAIN_INTERVAL = { steel: 0.15, wood: 0.12, flume: 0.3 } as const;
// 몸이 뜨는 순간(에어타임·낙하 시작)에 여러 사람의 비명 — 자주 나지 않게 간격을 둠
const SCREAM_G = 0.45;
const SCREAM_COOLDOWN = 5;
const SCREAM_VOLUME = 0.12;
const SCREAM_VOICES = 8;
// 낙하·착수 뒤 들뜬 환호 '와아아' (비명보다 작게, 조금 늦게)
const CHEER_VOLUME = 0.07;
const CHEER_VOICES = 6;
const CHEER_DELAY = 1.3;
const PENDULUM_SCREAM_G = 0.2;
// 낙하가 시작돼 이 속도(m/s)를 넘어서는 순간에도 비명 (느린 속도로 넘어가 몸이 덜 뜨는 낙하용)
const DROP_SCREAM_SPEED = 6;
// 스윙 보트: 높이 올라가 멈칫하는 꼭대기(속도 거의 0, 몸이 뜸)마다 비명 — 반 주기(약 3초)마다 한 번씩
const SWING_SCREAM_G = 0.45;
const SWING_SCREAM_COOLDOWN = 2.5;
// 올라간 쪽에 따른 비명: 좌우 위치, 내 쪽 끝일 때 / 반대쪽 끝일 때 음량 배율, 기준이 되는 가운데 좌석 번호
const SWING_SIDE_PAN = 0.6;
const SWING_MY_SIDE_VOLUME = 1.4;
const SWING_FAR_SIDE_VOLUME = 0.55;
const SWING_MIDDLE_SEAT = 8;
// 승강장 높이 판정 (이보다 낮은 곳에서 멈췄다 출발하면 승강장 출발)
const STATION_MAX_HEIGHT = 3;
// 판다 기차 '칙' 박자와 기적 간격 (초)
const CHUG_INTERVAL = 0.45;
const WHISTLE_INTERVAL = 22;

export interface RideSounds {
    // 매 프레임: 듣는 위치(내 오리), 지금 타고 있는 기구
    update(listener: THREE.Vector3, riding: RideId | null): void;
    // CRAZY BUMP 충돌 (point = 월드 좌표, is_mine = 내 차가 부딪힘)
    bump(strength: number, point: THREE.Vector3, is_mine: boolean): void;
    dispose(): void;
}

interface RideVoice {
    kind: SoundKind;
    model: RideModel;
    // 거리 감쇠가 적용되는 기구 출력
    output: GainNode;
    rumble: LoopVoice;
    wind: LoopVoice;
    motor: LoopVoice;
    rattle: RattleVoice;
    last_phase: string;
    was_low_g: boolean;
    was_fast: boolean;
    next_clack_at: number;
    next_rattle_at: number;
    next_creak_at: number;
    next_slosh_at: number;
    last_scream_at: number;
    cheer_at: number;
    next_chug_at: number;
    next_whistle_at: number;
}

export function createRideSounds(engine: AudioEngine, rides: ReadonlyMap<RideId, RideModel>): RideSounds {
    const voices: RideVoice[] = [];
    for (const [ride_id, model] of rides) {
        const kind = RIDE_SOUND_KIND[ride_id];
        if (kind === undefined) {
            continue;
        }
        const output = engine.context.createGain();
        output.gain.value = 0;
        output.connect(engine.output);
        const send = engine.context.createGain();
        send.gain.value = REVERB_SEND;
        output.connect(send).connect(engine.reverb);
        voices.push({
            kind,
            model,
            output,
            // 바퀴 굉음 / 물소리
            rumble: createLoop(engine, output, "lowpass", kind === "flume" ? 700 : 160, false),
            // 귓가를 스치는 바람
            wind: createLoop(engine, output, "bandpass", 700, false),
            // 턴테이블·진자 모터 웅웅
            motor: createLoop(engine, output, "lowpass", 380, true),
            // 기구 떨림 드르르르
            rattle: createRattle(engine, output),
            last_phase: "",
            was_low_g: false,
            was_fast: false,
            next_clack_at: 0,
            next_rattle_at: 0,
            next_creak_at: 0,
            next_slosh_at: 0,
            last_scream_at: -Infinity,
            cheer_at: Infinity,
            next_chug_at: 0,
            // 다른 예정 시각과 같은 기준(페이지 시각, 초) — 세션 시작 기준 숫자만 쓰면 입장하자마자 울림
            next_whistle_at: performance.now() / 1000 + 5 + Math.random() * WHISTLE_INTERVAL,
        });
    }
    const source_position = new THREE.Vector3();
    const middle_seat = new THREE.Vector3();

    // 비명: 몸이 붕 뜨는 순간, 또는 (코스터·후룸) 낙하로 속도가 확 붙는 순간
    function screamOnLowG(voice: RideVoice, thrill: RideThrill, now: number, threshold: number, on_drop = false): void {
        const is_low_g = thrill.speed > 2 && thrill.g_force < threshold;
        const is_fast = thrill.phase === "ride" && thrill.speed > DROP_SCREAM_SPEED;
        const starts = (is_low_g && !voice.was_low_g) || (on_drop && is_fast && !voice.was_fast);
        if (starts && now - voice.last_scream_at > SCREAM_COOLDOWN) {
            playScreams(engine, voice.output, SCREAM_VOLUME, SCREAM_VOICES);
            voice.last_scream_at = now;
        }
        voice.was_low_g = is_low_g;
        voice.was_fast = is_fast;
    }

    // 예약해 둔 환호 (낙하·착수 직후)
    function cheerIfDue(voice: RideVoice, now: number): void {
        if (now >= voice.cheer_at) {
            playScreams(engine, voice.output, CHEER_VOLUME, CHEER_VOICES, "cheer");
            voice.cheer_at = Infinity;
        }
    }

    // 떨림: 운행 단계마다 세기·촘촘함을 다르게
    function setRattle(voice: RideVoice, level: number, rate: number, pitch: number): void {
        setLevel(engine, voice.rattle.level, level);
        setLevel(engine, voice.rattle.rate, rate);
        setLevel(engine, voice.rattle.filter.frequency, pitch);
    }

    function updateCoaster(voice: RideVoice, thrill: RideThrill, now: number, is_rider: boolean, seat_height: number): void {
        const is_wood = voice.kind === "wood_coaster";
        const speed_ratio = clamp01(thrill.speed / 22);
        const moving = thrill.speed > 0.2;
        // 굉음: 빠를수록 크고 높게, 느리게 굴러가는 승강장·브레이크 구간에서도 바퀴 소리는 이어짐
        setLevel(engine, voice.rumble.gain, Math.max(speed_ratio * (is_wood ? 0.7 : 0.55), moving ? 0.14 : 0));
        setLevel(engine, voice.rumble.filter.frequency, 120 + thrill.speed * 18);
        setLevel(engine, voice.wind.gain, speed_ratio * speed_ratio * 0.45 * (is_rider ? 1 : 0.15));
        setLevel(engine, voice.wind.filter.frequency, 500 + thrill.speed * 45);
        if (thrill.phase === "lift") {
            // 체인이 끌어올리며 차체가 잘게 떨림
            setRattle(voice, 0.16, 14, 260);
        } else if (thrill.phase === "brake") {
            // 브레이크 핀·타이어에 걸려 드르륵
            setRattle(voice, 0.28, 22, 320);
        } else {
            setRattle(voice, moving ? (0.08 + 0.42 * speed_ratio) * (is_wood ? 1.3 : 1) : 0, 9 + thrill.speed * 1.4, 180 + thrill.speed * 10);
        }
        if (thrill.phase === "lift" && now >= voice.next_clack_at) {
            playChainClack(engine, voice.output, 0.55, is_wood);
            voice.next_clack_at = now + (is_wood ? CHAIN_INTERVAL.wood : CHAIN_INTERVAL.steel);
        }
        if (is_wood && thrill.phase === "ride" && thrill.speed > 4 && now >= voice.next_rattle_at) {
            playWoodRattle(engine, voice.output, 0.35 * speed_ratio);
            voice.next_rattle_at = now + 0.05 + Math.random() * 0.25 * (1 - speed_ratio);
        }
        // 목재 구조물 끼익 (리프트·주행 중 가끔)
        if (is_wood && moving && thrill.phase !== "stopped" && now >= voice.next_creak_at) {
            playCreak(engine, voice.output, 0.12 + 0.12 * speed_ratio);
            voice.next_creak_at = now + 0.6 + Math.random() * 1.4;
        }
        if (voice.last_phase === "stopped" && thrill.phase !== "stopped" && seat_height < STATION_MAX_HEIGHT) {
            playBell(engine, voice.output, 0.5);
        }
        if (voice.last_phase !== "brake" && thrill.phase === "brake") {
            playBrake(engine, voice.output, 0.6);
            // 다 타고 들어오며 '와아' 하는 환호
            voice.cheer_at = now + 0.4;
        }
        screamOnLowG(voice, thrill, now, SCREAM_G, true);
        cheerIfDue(voice, now);
    }

    function updateFlume(voice: RideVoice, thrill: RideThrill, now: number, is_rider: boolean, seat_height: number): void {
        const speed_ratio = clamp01(thrill.speed / 12);
        const moving = thrill.speed > 0.2;
        // 물길 흐르는 소리 (늘 조금, 빠를수록 크게)
        setLevel(engine, voice.rumble.gain, 0.18 + speed_ratio * 0.4);
        setLevel(engine, voice.wind.gain, speed_ratio * speed_ratio * 0.3 * (is_rider ? 1 : 0.15));
        // 높은 곳에서 멈춤 = 턴테이블·리버싱 룸이 돌아가는 중 → 모터 웅웅
        const turning = thrill.phase === "stopped" && seat_height > STATION_MAX_HEIGHT;
        setLevel(engine, voice.motor.gain, turning ? 0.14 : 0);
        // 보트 바닥 떨림: 컨베이어에선 덜덜, 빠를수록 촘촘, 돌아갈 땐 물살에 잔잔하게
        if (thrill.phase === "lift") {
            setRattle(voice, 0.14, 11, 200);
        } else if (turning) {
            setRattle(voice, 0.08, 7, 160);
        } else {
            setRattle(voice, moving ? 0.06 + 0.3 * speed_ratio : 0, 7 + thrill.speed * 1.2, 150 + thrill.speed * 8);
        }
        if (thrill.phase === "lift" && now >= voice.next_clack_at) {
            playChainClack(engine, voice.output, 0.3, false);
            voice.next_clack_at = now + CHAIN_INTERVAL.flume;
        }
        // 착수 = 물 저항(브레이크 구간)이 시작되는 순간 → 물폭탄 + 비명, 조금 뒤 환호
        if (voice.last_phase !== "brake" && thrill.phase === "brake") {
            playSplash(engine, voice.output, 1);
            playScreams(engine, voice.output, SCREAM_VOLUME, SCREAM_VOICES);
            voice.last_scream_at = now;
            voice.cheer_at = now + CHEER_DELAY;
        }
        // 착수 뒤 승강장까지: 보트가 물길 벽에 부딪히며 찰랑찰랑 (승강장에 멈출 때까지 계속)
        if (moving && seat_height < STATION_MAX_HEIGHT && thrill.phase !== "lift" && now >= voice.next_slosh_at) {
            playSlosh(engine, voice.output, 0.18 + 0.2 * speed_ratio);
            voice.next_slosh_at = now + 0.45 + Math.random() * 0.6;
        }
        if (voice.last_phase === "stopped" && thrill.phase !== "stopped" && seat_height < STATION_MAX_HEIGHT) {
            playBell(engine, voice.output, 0.4);
        }
        screamOnLowG(voice, thrill, now, SCREAM_G, true);
        cheerIfDue(voice, now);
    }

    // 비명을 좌우 한쪽에서 들리게 하는 출구 (끝나면 저절로 정리됨)
    function pannedTo(voice: RideVoice, pan: number): StereoPannerNode {
        const panner = engine.context.createStereoPanner();
        panner.pan.value = pan;
        panner.connect(voice.output);
        return panner;
    }

    // listener_y: 내 높이, 탑승 중이면 배의 내 자리 높이 — 가운데 좌석보다 높으면 내 쪽 끝이 올라간 것
    function updateSwingShip(voice: RideVoice, thrill: RideThrill, now: number, is_rider: boolean, listener_y: number): void {
        const swing = clamp01(thrill.speed / 12);
        const running = thrill.phase === "ride";
        // 바닥을 휙 지나는 '휘이익' 바람 + 구동 모터 + 나무 배 떨림
        setLevel(engine, voice.wind.gain, swing * swing * 0.55 * (is_rider ? 1 : 0.4));
        setLevel(engine, voice.wind.filter.frequency, 380 + thrill.speed * 55);
        setLevel(engine, voice.motor.gain, running ? 0.05 + swing * 0.08 : 0);
        setLevel(engine, voice.motor.filter.frequency, 220 + swing * 300);
        setRattle(voice, running ? 0.04 + 0.2 * swing : 0, 7 + thrill.speed, 200);
        // 나무 배·축이 삐걱
        if (running && now >= voice.next_creak_at) {
            playCreak(engine, voice.output, 0.12 + 0.1 * swing);
            voice.next_creak_at = now + 0.8 + Math.random() * 1.6;
        }
        // 꼭대기에서 멈칫하며 몸이 뜨는 순간마다 비명 (흔들림이 커질수록 매번) — 올라간 쪽에 따라 다르게
        // - 뱃머리 쪽(+)이 올라가면 높은 목소리(아이들)가 한쪽에서, 고물 쪽(-)이면 낮은 목소리(어른)가 반대쪽에서
        // - 타고 있으면: 내 쪽 끝이 올라갔을 때는 바로 옆에서 크게, 반대쪽 끝이 올라갔을 때는 건너편에서 작게
        const is_peak = running && thrill.g_force < SWING_SCREAM_G;
        if (is_peak && !voice.was_low_g && now - voice.last_scream_at > SWING_SCREAM_COOLDOWN) {
            const bow_up = (thrill.side ?? 0) > 0;
            let volume = SCREAM_VOLUME;
            let pan = bow_up ? SWING_SIDE_PAN : -SWING_SIDE_PAN;
            if (is_rider) {
                voice.model.seat_anchors[SWING_MIDDLE_SEAT].getWorldPosition(middle_seat);
                if (listener_y > middle_seat.y + 1) {
                    volume *= SWING_MY_SIDE_VOLUME;
                    pan = 0;
                } else if (listener_y < middle_seat.y - 1) {
                    volume *= SWING_FAR_SIDE_VOLUME;
                }
            }
            playScreams(engine, pannedTo(voice, pan), volume, SCREAM_VOICES, "scream", bow_up ? 1.15 : 0.85);
            voice.last_scream_at = now;
        }
        voice.was_low_g = is_peak;
    }

    function updatePendulum(voice: RideVoice, thrill: RideThrill, now: number, is_rider: boolean): void {
        const swing = clamp01(thrill.speed / 14);
        // 휘두를 때 '휘익' 바람 + 모터 + 철골 떨림
        setLevel(engine, voice.wind.gain, swing * swing * 0.5 * (is_rider ? 1 : 0.4));
        setLevel(engine, voice.wind.filter.frequency, 400 + thrill.speed * 60);
        setLevel(engine, voice.motor.gain, thrill.phase === "ride" ? 0.06 + swing * 0.1 : 0);
        setLevel(engine, voice.motor.filter.frequency, 250 + swing * 400);
        setRattle(voice, thrill.phase === "ride" ? 0.05 + 0.25 * swing : 0, 8 + thrill.speed, 240);
        // 꼭대기에서 거꾸로 매달려 붕 뜨는 순간
        screamOnLowG(voice, thrill, now, PENDULUM_SCREAM_G);
    }

    function updateTrain(voice: RideVoice, now: number): void {
        if (now >= voice.next_chug_at) {
            playChug(engine, voice.output, 0.12);
            voice.next_chug_at = now + CHUG_INTERVAL;
        }
        if (now >= voice.next_whistle_at) {
            playWhistle(engine, voice.output, 0.5);
            voice.next_whistle_at = now + WHISTLE_INTERVAL;
        }
    }

    let last_riding: RideId | null = null;
    // 마지막으로 들은 위치 (CRAZY BUMP 충돌처럼 이벤트로 오는 소리의 거리 계산용)
    const last_listener = new THREE.Vector3();

    return {
        update(listener, riding) {
            last_listener.copy(listener);
            if (riding !== last_riding && engine.isRunning()) {
                if (riding !== null) {
                    playBoardChime(engine, engine.output);
                } else {
                    playLeaveChime(engine, engine.output);
                }
            }
            last_riding = riding;
            // 소리 장치가 멈췄거나 음소거면 효과음을 만들지 않음 (깨어날 때 한꺼번에 터지지 않게)
            const running = engine.isRunning();
            const now = performance.now() / 1000;
            for (const voice of voices) {
                const anchor = voice.model.seat_anchors[0];
                anchor.getWorldPosition(source_position);
                const is_rider = riding === voice.model.id;
                const distance = source_position.distanceTo(listener);
                const level = is_rider ? 1 : clamp01(1 - distance / HEAR_RANGE) ** 2 * SPECTATOR_VOLUME;
                setLevel(engine, voice.output.gain, level);
                const thrill = voice.model.thrill;
                if (!running || level < 0.01) {
                    // 들리지 않는 동안에도 단계는 따라가 둠 (다가갔을 때 엉뚱한 소리가 나지 않게)
                    voice.last_phase = thrill?.phase ?? "";
                    voice.cheer_at = Infinity;
                    // 다시 들리기 시작하는 순간을 "몸이 뜸·낙하 시작"으로 오인해 비명이 울리지 않도록 이미 그 상태였던 것으로 둠
                    voice.was_low_g = true;
                    voice.was_fast = true;
                    continue;
                }
                if (voice.kind === "train") {
                    updateTrain(voice, now);
                } else if (thrill !== undefined) {
                    if (voice.kind === "flume") {
                        updateFlume(voice, thrill, now, is_rider, source_position.y);
                    } else if (voice.kind === "pendulum") {
                        updatePendulum(voice, thrill, now, is_rider);
                    } else if (voice.kind === "swing_ship") {
                        updateSwingShip(voice, thrill, now, is_rider, listener.y);
                    } else {
                        updateCoaster(voice, thrill, now, is_rider, source_position.y);
                    }
                    voice.last_phase = thrill.phase;
                }
            }
        },
        bump(strength, point, is_mine) {
            if (!engine.isRunning()) {
                return;
            }
            const level = is_mine ? 1 : clamp01(1 - point.distanceTo(last_listener) / CRAZY_BUMP_HEAR_RANGE);
            if (level < 0.01) {
                return;
            }
            const output = engine.context.createGain();
            output.gain.value = level;
            output.connect(engine.output);
            const send = engine.context.createGain();
            send.gain.value = REVERB_SEND;
            output.connect(send).connect(engine.reverb);
            playBump(engine, output, strength);
            // 소리가 끝나면 정리
            window.setTimeout(() => output.disconnect(), 800);
        },
        dispose() {
            for (const voice of voices) {
                voice.rumble.stop();
                voice.wind.stop();
                voice.motor.stop();
                voice.rattle.stop();
                voice.output.disconnect();
            }
        },
    };
}
