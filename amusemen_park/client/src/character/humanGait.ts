// 사람 걷기 — 디딤발을 땅에 고정하는 보행 주기 + 2관절 IK (엉덩이·무릎 각도를 발목 목표 위치에서 역산)
// 디딤기(stance): 발이 땅에 고정된 채 몸만 앞으로 → 뒤꿈치로 착지(발끝 들림) → 발바닥 평평 → 뒤꿈치 들며 발끝으로 차고 나감
// 흔들기(swing): 발을 들어 호를 그리며 앞으로 → 발이 엉덩이 쪽으로 올라오므로 IK 가 무릎을 뒤로 접음
// 좌표: 다리 평면(엉덩이 기준 z 앞, y 위), 땅 = y 0 / 뼈 회전 +x = 발이 뒤로 (glTF 뼈 기본 회전 0)
import * as THREE from "three";
import type { DuckRig } from "./duckModel";

// 한 주기 중 발이 땅에 닿아 있는 비율 (0.5 넘으면 두 발이 함께 닿는 순간이 있음)
// 빠를수록 짧게 = 걷기 → 종종 뛰기 (디딤기 보폭이 다리 길이를 넘지 않게)
const STANCE_RATIO_AT_REST = 0.62;
const STANCE_RATIO_PER_SPEED = 0.07;
const STANCE_RATIO_MIN = 0.4;
// 착지 때 발끝을 드는 각도 (음수 = 발끝 위), 차고 나갈 때 발끝으로 서는 최대 각도
const HEEL_PITCH = -0.32;
const TOE_PITCH_MAX = 0.6;
// 차고 나갈 때 뒤꿈치(발목)가 들리는 최대 높이 — 발끝이 긴 신발은 조금만 기울여도 발목이 높이 떠서 무릎이 완전히 접힘
const TOE_OFF_RISE = 0.06;
// 디딤기 중 뒤꿈치 구르기가 끝나는 지점, 발끝 구르기가 시작되는 지점 (0~1)
const HEEL_ROLL_END = 0.18;
const TOE_ROLL_START = 0.55;
// 흔들 때 발을 드는 높이 (속도에 따라 조금 더) — 엉덩이~발목이 0.22 뿐인 짧은 다리라 조금만
const SWING_LIFT = 0.02;
const SWING_LIFT_PER_SPEED = 0.008;
// 다리를 이만큼까지만 폄 (완전히 펴면 무릎이 덜컥거림)
const REACH_RATIO = 0.985;
// 다리를 이보다 접지 않음 (다리 길이 대비) — 무릎 굽힘 최대 약 1.5rad
const FOLD_RATIO = 0.76;
// 디딤기 앞뒤 중심을 찾는 반복 횟수 (삼분 탐색)
const CENTER_SEARCH_STEPS = 24;
// 엉덩이가 내려갈 수 있는 최대 깊이 (보폭이 커도 이보다 웅크리지 않음 — 넘으면 발이 조금 미끄러짐)
const MAX_HIP_DROP = 0.09;
// 한 주기 시간(초) = 느릴수록 길게, 빠를수록 짧게 (짧은 다리라 종종걸음)
const PERIOD_AT_REST = 0.75;
const PERIOD_PER_SPEED = 0.2;
const PERIOD_MIN = 0.3;

interface LegChain {
    leg: THREE.Object3D;
    knee: THREE.Object3D;
    foot: THREE.Object3D;
    // 허벅지(엉덩이→무릎)·정강이(무릎→발목) 길이와 기본 자세 각도
    thigh: number;
    shin: number;
    thigh_rest: number;
    shin_rest: number;
    // 기본 자세에서 엉덩이 기준 발목 앞뒤 위치, 발목 높이, 발목 기준 뒤꿈치·발끝 앞뒤 위치
    ankle_z: number;
    ankle_height: number;
    heel_z: number;
    toe_z: number;
    // 이 발이 차고 나갈 때 발끝으로 서는 각도 (발끝 길이에 맞춤)
    toe_pitch: number;
}

export interface HumanGait {
    left: LegChain;
    right: LegChain;
    hip_height: number;
}

export interface GaitPose {
    // 다리·무릎·발목 회전 (x 축)
    leg_left: number;
    knee_left: number;
    foot_left: number;
    leg_right: number;
    knee_right: number;
    foot_right: number;
    // 엉덩이(모델 전체)가 내려가는 높이 (0 이하)
    hip_drop: number;
    // 발이 앞(+1)·뒤(-1) 어디쯤인지 — 팔 흔들기용
    reach_left: number;
    reach_right: number;
}

export function createGaitPose(): GaitPose {
    return { leg_left: 0, knee_left: 0, foot_left: 0, leg_right: 0, knee_right: 0, foot_right: 0, hip_drop: 0, reach_left: 0, reach_right: 0 };
}

// 뼈 방향 각도 (회전 0 일 때 아래를 향하면 0, +x 회전 방향이 +)
function restAngle(vector: THREE.Vector3): number {
    return Math.atan2(-vector.z, -vector.y);
}

function buildChain(rig: DuckRig, leg: THREE.Object3D, knee: THREE.Object3D | null, foot: THREE.Object3D | null): LegChain | null {
    if (knee === null || foot === null) {
        return null;
    }
    const soles = rig.sole_points.filter((sole) => sole.bone === foot);
    if (soles.length === 0) {
        return null;
    }
    const zs = soles.map((sole) => sole.local.z);
    const toe_z = Math.max(...zs);
    return {
        toe_pitch: Math.min(TOE_PITCH_MAX, Math.asin(Math.min(1, TOE_OFF_RISE / Math.max(toe_z, 1e-3)))),
        leg,
        knee,
        foot,
        thigh: knee.position.length(),
        shin: foot.position.length(),
        thigh_rest: restAngle(knee.position),
        shin_rest: restAngle(foot.position),
        ankle_z: knee.position.z + foot.position.z,
        ankle_height: -soles[0].local.y,
        heel_z: Math.min(...zs),
        toe_z,
    };
}

// 무릎·발목 뼈와 발바닥 기준점이 있는 사람 리그만 (없으면 null → 이전 방식)
export function createHumanGait(rig: DuckRig): HumanGait | null {
    const left = buildChain(rig, rig.leg_left, rig.knee_left, rig.foot_left);
    const right = buildChain(rig, rig.leg_right, rig.knee_right, rig.foot_right);
    return left === null || right === null ? null : { left, right, hip_height: rig.hip_height };
}

// 걷는 속도(월드 단위/초) → 한 주기 시간(초)
export function gaitPeriod(speed: number): number {
    return Math.max(PERIOD_MIN, PERIOD_AT_REST - PERIOD_PER_SPEED * speed);
}

function stanceRatio(speed: number): number {
    return Math.max(STANCE_RATIO_MIN, STANCE_RATIO_AT_REST - STANCE_RATIO_PER_SPEED * speed);
}

interface FootState {
    z: number;
    y: number;
    pitch: number;
}

// 발이 땅에 고정된 위치(flat_z: 발바닥이 평평할 때 발목의 앞뒤 위치)에서 구르는 발 → 발목 위치·발 기울기
function rollFoot(chain: LegChain, flat_z: number, stance: number, out: FootState): FootState {
    let pitch = 0;
    let pivot = 0;
    if (stance < HEEL_ROLL_END) {
        const rest = 1 - stance / HEEL_ROLL_END;
        pitch = HEEL_PITCH * rest * rest;
        pivot = chain.heel_z;
    } else if (stance > TOE_ROLL_START) {
        const lift = (stance - TOE_ROLL_START) / (1 - TOE_ROLL_START);
        pitch = chain.toe_pitch * lift * lift;
        pivot = chain.toe_z;
    }
    // 땅에 닿은 회전 중심(뒤꿈치·발끝)은 고정, 발목은 그 둘레를 돎
    const sin = Math.sin(pitch);
    const cos = Math.cos(pitch);
    out.z = flat_z + pivot + chain.ankle_height * sin - pivot * cos;
    out.y = chain.ankle_height * cos + pivot * sin;
    out.pitch = pitch;
    return out;
}

const foot_start: FootState = { z: 0, y: 0, pitch: 0 };
const foot_end: FootState = { z: 0, y: 0, pitch: 0 };

// 발목을 (z, y) 에 둘 때 엉덩이가 있을 수 있는 가장 높은 곳
function hipLimit(chain: LegChain, z: number, y: number): number {
    const reach = (chain.thigh + chain.shin) * REACH_RATIO;
    const horizontal = Math.min(Math.abs(z), reach * 0.999);
    return y + Math.sqrt(reach * reach - horizontal * horizontal);
}

// 착지(앞발)·차고 나감(뒷발) 두 순간에 엉덩이가 덜 내려가도록 디딤기 앞뒤 중심을 정함
// (발목은 기본 자세에서 엉덩이보다 앞에 있고, 차고 나갈 때 발목이 더 높아 뒤로 더 뻗을 수 있음)
function stanceStart(chain: LegChain, stride: number): number {
    let low = -stride;
    let high = stride;
    for (let step = 0; step < CENTER_SEARCH_STEPS; step += 1) {
        const first = low + (high - low) / 3;
        const second = high - (high - low) / 3;
        const lowest = (flat: number): number => Math.min(hipLimit(chain, flat + foot_start.z, foot_start.y), hipLimit(chain, flat + foot_end.z, foot_end.y));
        if (lowest(first) < lowest(second)) {
            low = first;
        } else {
            high = second;
        }
    }
    return (low + high) / 2;
}

// cycle: 이 발의 주기 위치 0~1 (0 = 뒤꿈치 착지) / ratio: 디딤기 비율 / stride: 디딤기 동안 몸이 나아가는 거리
function footAt(chain: LegChain, cycle: number, ratio: number, stride: number, lift: number, out: FootState): boolean {
    rollFoot(chain, 0, 0, foot_start);
    rollFoot(chain, -stride, 1, foot_end);
    const flat_start = stanceStart(chain, stride);
    if (cycle < ratio) {
        const stance = cycle / ratio;
        rollFoot(chain, flat_start - stance * stride, stance, out);
        return true;
    }
    // 흔들기: 차고 나간 자세 → 다음 착지 자세로 호를 그리며
    const swing = (cycle - ratio) / (1 - ratio);
    const ease = 0.5 - 0.5 * Math.cos(Math.PI * swing);
    const from_z = foot_end.z + flat_start;
    const to_z = foot_start.z + flat_start;
    out.z = THREE.MathUtils.lerp(from_z, to_z, ease);
    out.y = THREE.MathUtils.lerp(foot_end.y, foot_start.y, ease) + lift * Math.sin(Math.PI * swing);
    out.pitch = THREE.MathUtils.lerp(chain.toe_pitch, HEEL_PITCH, ease);
    return false;
}

// 엉덩이 높이 hip 에서 발목을 (z, y) 에 두는 다리·무릎·발목 회전 (닿지 않으면 다리를 최대한 뻗음)
function solveLeg(chain: LegChain, foot: FootState, hip: number, result: [number, number, number]): void {
    const target_z = foot.z;
    const target_y = foot.y - hip;
    const a = chain.thigh;
    const b = chain.shin;
    const distance = THREE.MathUtils.clamp(Math.hypot(target_z, target_y), Math.max(Math.abs(a - b) + 1e-4, (a + b) * FOLD_RATIO), (a + b) * REACH_RATIO);
    const target_angle = Math.atan2(-target_z, -target_y);
    const hip_bend = Math.acos(THREE.MathUtils.clamp((a * a + distance * distance - b * b) / (2 * a * distance), -1, 1));
    const knee_bend = Math.PI - Math.acos(THREE.MathUtils.clamp((a * a + b * b - distance * distance) / (2 * a * b), -1, 1));
    // 허벅지를 앞으로(-) 기울이고 정강이를 뒤로(+) 접음 = 사람 무릎
    const thigh_angle = target_angle - hip_bend;
    const leg = thigh_angle - chain.thigh_rest;
    const knee = thigh_angle + knee_bend - chain.shin_rest - leg;
    result[0] = leg;
    result[1] = knee;
    result[2] = foot.pitch - leg - knee;
}

// 디딤발이 닿도록 엉덩이가 내려가야 하는 높이
function reachableHip(chain: LegChain, foot: FootState, hip: number): number {
    return Math.min(hip, hipLimit(chain, foot.z, foot.y));
}

const left_foot: FootState = { z: 0, y: 0, pitch: 0 };
const right_foot: FootState = { z: 0, y: 0, pitch: 0 };
const solved: [number, number, number] = [0, 0, 0];

// cycle: 왼발 주기 위치 0~1 (오른발은 반 주기 뒤) / speed: 이동 속도 / period: 한 주기 시간
export function solveGait(gait: HumanGait, cycle: number, speed: number, period: number, pose: GaitPose): GaitPose {
    // 디딤기 동안 몸이 나아간 거리만큼 발이 뒤로 가야 미끄러지지 않음
    const ratio = stanceRatio(speed);
    const stride = speed * period * ratio;
    const lift = SWING_LIFT + SWING_LIFT_PER_SPEED * speed;
    const left_planted = footAt(gait.left, cycle, ratio, stride, lift, left_foot);
    const right_planted = footAt(gait.right, (cycle + 0.5) % 1, ratio, stride, lift, right_foot);

    let hip = gait.hip_height;
    if (left_planted) {
        hip = reachableHip(gait.left, left_foot, hip);
    }
    if (right_planted) {
        hip = reachableHip(gait.right, right_foot, hip);
    }
    hip = Math.max(hip, gait.hip_height - MAX_HIP_DROP);
    pose.hip_drop = hip - gait.hip_height;

    solveLeg(gait.left, left_foot, hip, solved);
    [pose.leg_left, pose.knee_left, pose.foot_left] = solved;
    solveLeg(gait.right, right_foot, hip, solved);
    [pose.leg_right, pose.knee_right, pose.foot_right] = solved;

    const half = Math.max(stride / 2, 0.05);
    pose.reach_left = THREE.MathUtils.clamp((left_foot.z - gait.left.ankle_z) / half, -1, 1);
    pose.reach_right = THREE.MathUtils.clamp((right_foot.z - gait.right.ankle_z) / half, -1, 1);
    return pose;
}
