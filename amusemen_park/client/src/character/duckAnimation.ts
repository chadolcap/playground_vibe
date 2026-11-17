// 아바타 절차적 애니메이션 — DuckRig 노드만 움직이므로 모델(도형/glTF)과 무관
// 사람 모델은 팔·다리를 엇갈려 흔들고, 오리는 뒤뚱거리며 날개를 파닥임
import * as THREE from "three";
import { PLAYER_ANIM, type PlayerAnim } from "@shared";
import type { DuckRig } from "./duckModel";
import { createGaitPose, createHumanGait, gaitPeriod, solveGait, type GaitPose, type HumanGait } from "./humanGait";

// 걷기 한 걸음 주기 (이동 속도 1 당 초당 위상 증가량) — 오리
const STEP_RATE_PER_SPEED = 2.2;
// 사람 걷기 주기를 정할 때 쓰는 최소 속도 (걷기 시작 직후 속도가 0 근처여도 발을 뗌)
const MIN_GAIT_SPEED = 0.8;
// 애니메이션 전환을 부드럽게 (값이 클수록 빨리 따라감)
const BLEND_RATE = 10;

export interface DuckAnimator {
    // speed = 현재 이동 속도(월드 단위/초) — 걷기 동작의 빠르기
    // excitement = 탑승 중 신남 정도 0~1 (스릴 기구에서 날개를 번쩍 들고 빠르게 파닥임)
    update(anim: PlayerAnim, speed: number, delta: number, time: number, excitement?: number): void;
}

function approach(current: number, target: number, delta: number): number {
    return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-BLEND_RATE * delta));
}

// 사람 동작에 필요한 상태 (개체마다 하나)
interface HumanState {
    gait: HumanGait | null;
    pose: GaitPose;
    // 앉기 비중 0~1 (앉고 일어설 때 다리를 부드럽게 접고 폄)
    sit_mix: number;
}

// 사람 걷기 — 디딤발 고정 보행(humanGait) + 엉덩이 비틀기·팔과 머리의 시간차
// walk_mix: 걷기 비중 0~1 (걷기 시작·멈춤 때 동작 크기를 서서히 바꿈)
// cycle: 왼발 보행 주기 0~1, speed·period: 보폭 계산용 이동 속도·주기 시간
function updateHuman(rig: DuckRig, state: HumanState, is_sit: boolean, phase: number, cycle: number, speed: number, period: number, walk_mix: number, delta: number, time: number, idle_offset: number, excitement: number): void {
    const swing = Math.sin(phase);
    state.sit_mix = approach(state.sit_mix, is_sit ? 1 : 0, delta);
    const sit_mix = state.sit_mix;
    const stand_mix = 1 - sit_mix;

    // 몸통: 디딤발 쪽으로 기울고 엉덩이를 비틀며 살짝 앞으로 숙임 (오르내림은 보행의 엉덩이 높이가 만듦)
    const breathe = Math.sin(time * 2 + idle_offset) * 0.008 * (1 - walk_mix);
    rig.body.position.y = approach(rig.body.position.y, is_sit ? -rig.sit_drop : 0, delta);
    rig.body.rotation.z = approach(rig.body.rotation.z, swing * 0.035 * walk_mix, delta);
    rig.body.rotation.y = approach(rig.body.rotation.y, swing * 0.1 * walk_mix, delta);
    rig.body.rotation.x = approach(rig.body.rotation.x, 0.06 * walk_mix, delta);
    rig.body.scale.y = 1 + breathe;

    // 다리: 걸을 때는 보행 IK 결과를 그대로(지연 없이 — 늦게 따라가면 발이 미끄러짐), 앉으면 앞으로 뻗음
    const pose = state.pose;
    if (state.gait !== null) {
        solveGait(state.gait, cycle, Math.max(speed, MIN_GAIT_SPEED), period, pose);
    }
    const walk = walk_mix * stand_mix;
    rig.leg_left.rotation.x = pose.leg_left * walk - 1.45 * sit_mix;
    rig.leg_right.rotation.x = pose.leg_right * walk - 1.45 * sit_mix;
    if (rig.knee_left !== null && rig.knee_right !== null) {
        rig.knee_left.rotation.x = pose.knee_left * walk;
        rig.knee_right.rotation.x = pose.knee_right * walk;
    }
    if (rig.foot_left !== null && rig.foot_right !== null) {
        rig.foot_left.rotation.x = pose.foot_left * walk;
        rig.foot_right.rotation.x = pose.foot_right * walk;
    }
    const leg_y = is_sit ? rig.hip_height - rig.sit_drop + rig.sit_leg_raise : rig.hip_height;
    rig.leg_left.position.y = approach(rig.leg_left.position.y, leg_y, delta);
    rig.leg_right.position.y = rig.leg_left.position.y;
    // 다리를 벌릴 때 디딤발이 닿도록 엉덩이(모델 전체)를 내림 (앉으면 좌석 기준이라 그대로)
    if (rig.ground_lift !== null) {
        rig.ground_lift.position.y = pose.hip_drop * walk;
    }

    // 팔: 같은 쪽 다리와 반대로 흔듦(왼다리가 앞이면 왼팔은 뒤), 앉으면 무릎 위에 두다가 신나면 만세
    // (머리가 큰 치비 비율이라 수직으로 들면 머리에 가려짐 → 최대 약 110° 로 비스듬히)
    const arm_swing = (state.gait !== null ? pose.reach_left * 0.4 : -Math.sin(phase - 0.3) * 0.4) * walk_mix;
    const raise = is_sit
        ? 0.1 + excitement * 1.8 + Math.sin(time * (4 + excitement * 10) + idle_offset) * 0.15 * excitement
        : 0.06 + Math.max(0, Math.sin(time * 1.3 + idle_offset)) * 0.04 * (1 - walk_mix) + Math.abs(swing) * 0.03 * walk_mix;
    rig.wing_left.rotation.x = approach(rig.wing_left.rotation.x, is_sit ? -0.5 * (1 - excitement) : arm_swing, delta);
    rig.wing_right.rotation.x = approach(rig.wing_right.rotation.x, is_sit ? -0.5 * (1 - excitement) : -arm_swing, delta);
    rig.wing_left.rotation.z = approach(rig.wing_left.rotation.z, raise, delta);
    rig.wing_right.rotation.z = approach(rig.wing_right.rotation.z, -raise, delta);

    // 묶음 머리: 몸보다 늦게 좌우로 흔들리고, 출렁일 때마다 뒤로 살짝 튐 (쉴 때는 바람에 날리듯 조금)
    const hair_side = Math.sin(phase - 1.1) * 0.14 * walk_mix + Math.sin(time * 1.7 + idle_offset) * 0.03 + Math.sin(time * 9) * 0.08 * excitement;
    const hair_back = Math.abs(Math.sin(phase - 0.6)) * 0.12 * walk_mix + 0.04 * excitement;
    for (const hair of rig.hair) {
        hair.rotation.z = approach(hair.rotation.z, hair_side, delta);
        hair.rotation.x = approach(hair.rotation.x, hair_back, delta);
    }
}

export function createDuckAnimator(rig: DuckRig): DuckAnimator {
    let step_phase = 0;
    let walk_mix = 0;
    // 개체마다 대기 동작 박자를 조금씩 다르게
    const idle_offset = Math.random() * Math.PI * 2;
    const human: HumanState = { gait: rig.is_human ? createHumanGait(rig) : null, pose: createGaitPose(), sit_mix: 0 };

    return {
        update(anim, speed, delta, time, excitement = 0) {
            const is_walk = anim === PLAYER_ANIM.WALK;
            const is_sit = anim === PLAYER_ANIM.SIT;
            if (rig.is_human) {
                // 보폭이 이동 거리와 맞도록 주기를 속도에 맞춰 진행 (한 주기 = 2π)
                const gait_speed = Math.max(speed, MIN_GAIT_SPEED);
                const period = gaitPeriod(gait_speed);
                if (is_walk) {
                    step_phase += (Math.PI * 2 * delta) / period;
                }
                // 걷기 비중은 동작 전환보다 천천히 (걸음을 떼고 멈출 때 동작이 툭 끊기지 않게)
                walk_mix = THREE.MathUtils.lerp(walk_mix, is_walk ? 1 : 0, 1 - Math.exp(-6 * delta));
                const cycle = (((step_phase / (Math.PI * 2)) % 1) + 1) % 1;
                updateHuman(rig, human, is_sit, step_phase, cycle, gait_speed, period, walk_mix, delta, time, idle_offset, excitement);
                return;
            }
            if (is_walk) {
                step_phase += Math.max(speed, 1.5) * STEP_RATE_PER_SPEED * delta;
            }
            const swing = Math.sin(step_phase);

            // 몸통: 걸을 때 좌우 뒤뚱 + 통통, 쉴 때 숨쉬기, 앉으면 내려앉음
            const breathe = Math.sin(time * 2 + idle_offset) * 0.02;
            const target_tilt = is_walk ? swing * 0.16 : 0;
            const target_bounce = is_walk ? Math.abs(swing) * 0.08 : is_sit ? -rig.sit_drop : 0;
            rig.body.rotation.z = approach(rig.body.rotation.z, target_tilt, delta);
            rig.body.position.y = approach(rig.body.position.y, target_bounce, delta);
            rig.body.scale.y = 1 + (is_walk ? 0 : breathe);

            // 다리: 걸을 때 번갈아 앞뒤로, 앉으면 앞으로 쭉 뻗음
            const leg_swing = is_walk ? swing * 0.7 : 0;
            rig.leg_left.rotation.x = approach(rig.leg_left.rotation.x, is_sit ? -1.3 : leg_swing, delta);
            rig.leg_right.rotation.x = approach(rig.leg_right.rotation.x, is_sit ? -1.3 : -leg_swing, delta);
            const leg_y = is_sit ? rig.hip_height - rig.sit_drop + rig.sit_leg_raise : rig.hip_height;
            rig.leg_left.position.y = approach(rig.leg_left.position.y, leg_y, delta);
            rig.leg_right.position.y = rig.leg_left.position.y;

            // 날개: 걸을 때 파닥, 쉴 때 가끔 살짝, 앉으면 신나서 위로 (스릴 순간엔 만세하듯 번쩍 들고 빠르게)
            const flap = is_walk
                ? 0.25 + Math.abs(Math.sin(step_phase * 2)) * 0.35
                : is_sit
                    ? 0.6 + excitement * 0.9 + Math.sin(time * (6 + excitement * 12) + idle_offset) * (0.25 - excitement * 0.1)
                    : 0.1 + Math.max(0, Math.sin(time * 1.3 + idle_offset)) * 0.15;
            rig.wing_left.rotation.z = approach(rig.wing_left.rotation.z, flap, delta);
            rig.wing_right.rotation.z = approach(rig.wing_right.rotation.z, -flap, delta);
        },
    };
}
