// 오리 절차적 애니메이션 — DuckRig 노드만 움직이므로 모델(도형/glTF)과 무관
import * as THREE from "three";
import { PLAYER_ANIM, type PlayerAnim } from "@shared";
import { DUCK_SIT_DROP, type DuckRig } from "./duckModel";

// 걷기 한 걸음 주기 (이동 속도 1 당 초당 위상 증가량)
const STEP_RATE_PER_SPEED = 2.2;
// 애니메이션 전환을 부드럽게 (값이 클수록 빨리 따라감)
const BLEND_RATE = 10;

export interface DuckAnimator {
    // speed = 현재 이동 속도(월드 단위/초) — 걷기 동작의 빠르기
    update(anim: PlayerAnim, speed: number, delta: number, time: number): void;
}

function approach(current: number, target: number, delta: number): number {
    return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-BLEND_RATE * delta));
}

export function createDuckAnimator(rig: DuckRig): DuckAnimator {
    let step_phase = 0;
    // 개체마다 대기 동작 박자를 조금씩 다르게
    const idle_offset = Math.random() * Math.PI * 2;

    return {
        update(anim, speed, delta, time) {
            const is_walk = anim === PLAYER_ANIM.WALK;
            const is_sit = anim === PLAYER_ANIM.SIT;
            if (is_walk) {
                step_phase += Math.max(speed, 1.5) * STEP_RATE_PER_SPEED * delta;
            }
            const swing = Math.sin(step_phase);

            // 몸통: 걸을 때 좌우 뒤뚱 + 통통, 쉴 때 숨쉬기, 앉으면 내려앉음
            const breathe = Math.sin(time * 2 + idle_offset) * 0.02;
            const target_tilt = is_walk ? swing * 0.16 : 0;
            const target_bounce = is_walk ? Math.abs(swing) * 0.08 : is_sit ? -DUCK_SIT_DROP : 0;
            rig.body.rotation.z = approach(rig.body.rotation.z, target_tilt, delta);
            rig.body.position.y = approach(rig.body.position.y, target_bounce, delta);
            rig.body.scale.y = 1 + (is_walk ? 0 : breathe);

            // 다리: 걸을 때 번갈아 앞뒤로, 앉으면 앞으로 쭉 뻗음
            const leg_swing = is_walk ? swing * 0.7 : 0;
            const sit_leg = -1.3;
            rig.leg_left.rotation.x = approach(rig.leg_left.rotation.x, is_sit ? sit_leg : leg_swing, delta);
            rig.leg_right.rotation.x = approach(rig.leg_right.rotation.x, is_sit ? sit_leg : -leg_swing, delta);
            rig.leg_left.position.y = approach(rig.leg_left.position.y, is_sit ? 0.32 - DUCK_SIT_DROP + 0.1 : 0.32, delta);
            rig.leg_right.position.y = rig.leg_left.position.y;

            // 날개: 걸을 때 파닥, 쉴 때 가끔 살짝, 앉으면 신나서 위로
            const flap = is_walk
                ? 0.25 + Math.abs(Math.sin(step_phase * 2)) * 0.35
                : is_sit
                    ? 0.6 + Math.sin(time * 6 + idle_offset) * 0.25
                    : 0.1 + Math.max(0, Math.sin(time * 1.3 + idle_offset)) * 0.15;
            rig.wing_left.rotation.z = approach(rig.wing_left.rotation.z, flap, delta);
            rig.wing_right.rotation.z = approach(rig.wing_right.rotation.z, -flap, delta);
        },
    };
}
