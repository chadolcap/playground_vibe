// 게임 소리 묶음 — 엔진·기구 효과음·배경음·음소거 버튼을 한 번에 만들고, 오류를 화면 루프에서 떼어 놓음
// 소리는 부가 기능이라, 만들거나 갱신하다 예외가 나면 소리만 끄고 게임(렌더·이동)은 계속 진행
import type * as THREE from "three";
import type { RideId } from "@shared";
import type { RideModel } from "../world/rides/common";
import { createAudioEngine, createSoundToggle, type AudioEngine } from "./audioEngine";
import { createParkAmbience, type ParkAmbience } from "./parkAmbience";
import { createRideSounds, type RideSounds } from "./rideSounds";

export interface GameAudio {
    // 매 프레임: 듣는 위치(내 오리), 지금 타고 있는 기구
    update(listener: THREE.Vector3, riding: RideId | null): void;
    // CRAZY BUMP 충돌
    bump(strength: number, point: THREE.Vector3, is_mine: boolean): void;
    dispose(): void;
}

export function createGameAudio(rides: ReadonlyMap<RideId, RideModel>, ui_layer: HTMLElement): GameAudio {
    let engine: AudioEngine | null = null;
    let ride_sounds: RideSounds | null = null;
    let ambience: ParkAmbience | null = null;
    let removeToggle: (() => void) | null = null;

    function shutdown(): void {
        // 정리 중 예외도 삼킴 (이미 망가진 상태일 수 있음)
        for (const step of [() => ride_sounds?.dispose(), () => ambience?.dispose(), () => removeToggle?.(), () => engine?.dispose()]) {
            try {
                step();
            } catch {
                // 무시
            }
        }
        ride_sounds = null;
        ambience = null;
        removeToggle = null;
        engine = null;
    }

    // 소리 작업을 실행하고, 실패하면 소리를 끄고 다시는 시도하지 않음
    function guard(action: () => void): void {
        if (engine === null) {
            return;
        }
        try {
            action();
        } catch (error) {
            console.error("[audio] 효과음에서 오류가 나서 소리를 끕니다", error);
            shutdown();
        }
    }

    try {
        engine = createAudioEngine();
        if (engine !== null) {
            ride_sounds = createRideSounds(engine, rides);
            // 놀이공원 배경음 (군중·먼 롤러코스터·비명)
            ambience = createParkAmbience(engine);
            removeToggle = createSoundToggle(ui_layer, engine);
        }
    } catch (error) {
        console.error("[audio] 효과음을 만들 수 없어 소리 없이 진행합니다", error);
        shutdown();
    }

    return {
        update(listener, riding) {
            guard(() => {
                ride_sounds?.update(listener, riding);
                ambience?.update(riding !== null);
            });
        },
        bump(strength, point, is_mine) {
            guard(() => ride_sounds?.bump(strength, point, is_mine));
        },
        dispose() {
            shutdown();
        },
    };
}
