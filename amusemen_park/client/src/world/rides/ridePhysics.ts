// 놀이기구 운동 원리 — 실제 물리(에너지 보존·마찰·구심력)로 미리 계산한 "시각 → 자세·속도·G" 표
// 모든 값은 방 시각의 순수 함수라서 같은 방의 클라이언트끼리 기구 위치·연출이 일치함
//
// 적용한 원리
// - 롤러코스터: 체인 리프트로 끌어올린 위치 에너지가 내리막에서 운동 에너지로 바뀜 (v² = v₀² + 2gΔh)
//   구름 마찰·공기 저항으로 에너지를 조금씩 잃으므로 뒤쪽 언덕은 첫 언덕보다 낮아야 넘어감
// - 체감 G: 탑승자가 좌석 쪽으로 눌리는 힘 = (구심 가속도 + 중력)의 좌석 위 방향 성분 / g
//   볼록한 언덕 꼭대기에서는 1G 미만(에어타임, 몸이 뜸), 오목한 골짜기·루프 아래에서는 1G 초과(짓눌림)
// - 진자 기구(바이킹류): 모터가 박자에 맞춰 밀어 진폭을 키우고(펌핑), 끝나면 서서히 줄여 멈춤
//   팔 끝 좌석의 G = ω²L/g + cosθ → 높이 올라가 멈칫할 때 0 이하(거꾸로 매달린 무중력감)
import * as THREE from "three";
import { samplePath, type LapTimeline, type PathFrames, type RidePhase, type RideThrill } from "./common";

const GRAVITY = 9.8;
const STEP = 1 / 60;
const MAX_LAP_SECONDS = 600;
// 내리막·평지에서도 멈춰 서지 않도록 하는 최저 속도 (실제 코스터의 부스터 타이어 역할)
const MIN_FREE_SPEED = 0.8;
// 승강장 정지 직전 감속도 (m/s²) — 부드럽게 멈춰 서도록
const STATION_STOP_DECEL = 1.5;
// 승강장 앞에서 브레이크를 미리 거는 여유 거리 (m)
const END_BRAKE_MARGIN = 3;
// 중간 정차 지점 바로 앞에서 기어 들어가는 속도 (m/s)
const HOLD_CREEP_SPEED = 0.4;
// 평평한 정상으로 보는 높이 차 (m)
const TOP_PLATEAU_TOLERANCE = 0.05;
// G 계산용 곡률을 구할 때 앞뒤로 볼 표본 간격 (작으면 경로 잡음이 G 에 그대로 드러남)
const CURVATURE_SPAN = 6;
// 체감 G 평활 구간 (초) — 놀이기구 안전 기준(ASTM F2291)의 5Hz 필터에 해당
const G_FILTER_SECONDS = 0.2;

export interface CoasterPhysicsOptions {
    // 리프트 언덕을 끌어올리는 체인 속도 (m/s)
    chain_speed: number;
    // 승강장에서 타이어가 밀어 주는 출발 속도 (m/s)
    station_speed: number;
    // 마지막 브레이크 구간 목표 속도 (m/s)
    brake_speed: number;
    // 승강장 정차(승하차) 시간 (초)
    dwell_seconds: number;
    // 구름 마찰 계수 (기본 0.015, 물 위 보트는 더 큼)
    rolling_friction?: number;
    // 공기·물 저항 계수 (가속도 = drag × v²)
    drag?: number;
    // 브레이크 감속도 (m/s²)
    brake_decel?: number;
    // 진동 세기 0~1 (목재 코스터는 덜컹거림이 큼)
    shake?: number;
    // 중간 정차 지점 (턴테이블·리버싱 룸 등): 경로 위치 u 에서 seconds 동안 멈췄다가 정지 상태에서 다시 출발
    holds?: readonly { u: number; seconds: number }[];
    // 정차가 끝난 뒤 내리막이 시작될 때까지 밀어 주는 속도 (m/s) — 없으면 평지에서 최저 속도로 기어감
    hold_release_speed?: number;
    // 중간 정차 지점에 다가가며 줄이는 감속도 (m/s², 기본 = brake_decel)
    hold_decel?: number;
    // 트랙이 커브에서 기울 수 있는 최대 각도 (기본 80° — 물길은 물이 쏟아지지 않게 작게)
    max_bank_degrees?: number;
}

export interface HoldState {
    // 지금까지 끝난 중간 정차 수 (이번 바퀴 기준)
    passed: number;
    // 지금 정차 중이면 진행률 0~1, 아니면 0
    progress: number;
}

export interface PhysicsTimeline extends LapTimeline {
    // 현재 열차(선두) 속도·체감 G·진동
    thrillAt(time: number, out: RideThrill): void;
    // 한 바퀴 안에서 경로 위치 u 에 처음 도달하는 시각 (초) — 물보라 같은 순간 연출용
    timeOfU(u: number): number;
    // 중간 정차 진행 상태 (턴테이블 회전 연출용)
    holdStateAt(time: number): HoldState;
}

interface TrackZones {
    // 승강장이 끝나는 표본 번호
    station_end: number;
    // 리프트 언덕 시작·끝 (끝 = 가장 높은 지점)
    lift_start: number;
    lift_end: number;
    // 마지막 브레이크 구간 시작 표본 번호
    brake_start: number;
}

// 경로 모양만 보고 구간을 나눔: 출발 높이 근처 = 승강장, 최고점까지 이어진 오르막 = 리프트, 끝부분 낮은 곳 = 브레이크
function findZones(frames: PathFrames): TrackZones {
    const last = frames.positions.length - 1;
    const start_y = frames.positions[0].y;
    let station_end = 0;
    while (station_end < last && Math.abs(frames.positions[station_end].y - start_y) < 0.35) {
        station_end += 1;
    }
    // 리프트 끝 = 가장 높은 높이(평평한 정상이면 그 시작)에 처음 닿는 지점
    // (정상이 평평하면 곡선의 미세한 굴곡 때문에 최고점이 정상 뒤쪽에 잡혀, 턴테이블 뒤까지 리프트로 오판함)
    const highest = frames.positions.reduce((max, position) => Math.max(max, position.y), -Infinity);
    const lift_end = Math.max(0, frames.positions.findIndex((position) => position.y >= highest - TOP_PLATEAU_TOLERANCE));
    let lift_start = lift_end;
    // 꼭대기가 평평한 트랙(정상 직선 구간)은 평평한 부분을 먼저 건너뛰고 오르막을 찾음
    const top_y = frames.positions[lift_end].y;
    while (lift_start > station_end && frames.tangents[lift_start - 1].y <= 0.02 && frames.positions[lift_start - 1].y > top_y - 2) {
        lift_start -= 1;
    }
    while (lift_start > station_end && frames.tangents[lift_start - 1].y > 0.02) {
        lift_start -= 1;
    }
    let brake_start = last;
    while (brake_start > lift_end && frames.positions[brake_start - 1].y < start_y + 0.8) {
        brake_start -= 1;
    }
    return { station_end, lift_start, lift_end, brake_start };
}

// 표본 index 의 곡률 벡터 = 진행 방향의 변화율 (휘는 쪽을 가리키고 크기 = 1/반지름)
function curvatureAt(frames: PathFrames, index: number, out: THREE.Vector3): THREE.Vector3 {
    const last = frames.positions.length - 1;
    const before = frames.closed ? (index - CURVATURE_SPAN + last) % last : Math.max(index - CURVATURE_SPAN, 0);
    const after = frames.closed ? (index + CURVATURE_SPAN) % last : Math.min(index + CURVATURE_SPAN, last);
    const span = (frames.length / last) * CURVATURE_SPAN * 2;
    return out.subVectors(frames.tangents[after], frames.tangents[before]).divideScalar(span);
}

// 경로 위치 u 의 체감 G (속도 speed 일 때)
function gForceAt(frames: PathFrames, u: number, speed: number): number {
    const index = Math.round(THREE.MathUtils.clamp(u, 0, 1) * (frames.positions.length - 1));
    const up = frames.ups[index];
    const curvature = curvatureAt(frames, index, new THREE.Vector3());
    return THREE.MathUtils.clamp((speed * speed * curvature.dot(up)) / GRAVITY + up.y, -1.5, 6);
}

// 뱅크(기울기) 설계: 커브에서 탑승자가 느끼는 힘(중력 + 좌우 원심력)이 좌석 바로 아래를 향하도록 트랙을 기울임
// → 커브에서 옆으로 쏠리지 않고, 평행 이동으로 생기던 기울기 누적(직선인데 비스듬한 트랙)도 사라짐
// - 기울기 목표에는 좌우(수평) 곡률만 넣음: 언덕 꼭대기의 위아래 곡률(에어타임)까지 넣으면 몸이 뜨는 순간 "거꾸로"로 오판해 트랙이 뒤집힘
// - 루프처럼 트랙이 이미 뒤집혀 있고 느끼는 힘도 아래를 향하는 구간, 수직 구간만 평행 이동 방향을 그대로 이어 감
const BANK_FOLLOW = 0.3;
const DEFAULT_MAX_BANK_DEGREES = 80;

function bankFrames(frames: PathFrames, speed_by_index: readonly number[], max_bank_degrees: number): void {
    const last = frames.positions.length - 1;
    const max_bank = THREE.MathUtils.degToRad(max_bank_degrees);
    const world_up = new THREE.Vector3(0, 1, 0);
    const curvature = new THREE.Vector3();
    const felt = new THREE.Vector3();
    const target = new THREE.Vector3();
    const level = new THREE.Vector3();
    const side = new THREE.Vector3();
    let up = frames.ups[0].clone();
    for (let index = 0; index <= last; index += 1) {
        const tangent = frames.tangents[index];
        // 직전 방향을 이번 진행 방향에 수직이 되게 옮김 (평행 이동)
        up.addScaledVector(tangent, -up.dot(tangent)).normalize();
        level.copy(world_up).addScaledVector(tangent, -tangent.y);
        if (level.length() > 0.3) {
            level.normalize();
            const speed_squared = speed_by_index[index] ** 2;
            curvatureAt(frames, index, curvature);
            // 거꾸로 도는 중인지: 트랙이 이미 뒤집혀 있고, 위아래 곡률까지 넣은 실제 체감 힘도 아래를 향함 (루프 꼭대기)
            felt.copy(world_up).multiplyScalar(GRAVITY).addScaledVector(curvature, speed_squared);
            felt.addScaledVector(tangent, -felt.dot(tangent));
            const is_inverted = up.dot(level) < -0.2 && felt.dot(level) <= 0;
            if (!is_inverted) {
                // 목표 = 중력 + 좌우(수평) 원심력 방향
                side.crossVectors(tangent, world_up).normalize();
                target.copy(world_up).multiplyScalar(GRAVITY).addScaledVector(side, curvature.dot(side) * speed_squared);
                target.addScaledVector(tangent, -target.dot(tangent)).normalize();
                // 너무 눕지 않게 제한 (매 지점)
                const bank = target.angleTo(level);
                if (bank > max_bank) {
                    target.lerp(level, 1 - max_bank / bank).normalize();
                }
                up.lerp(target, BANK_FOLLOW).normalize();
            }
        }
        frames.ups[index] = up.clone();
    }
}

// 한 바퀴를 실제 물리로 시뮬레이션해 시간표를 만듦 (u=0 승강장에서 정차 → 출발 → 리프트 → 낙하 → 브레이크 → 정차)
// 주의: 계산한 속도에 맞춰 frames.ups(트랙 기울기)를 고치므로 레일·물길은 이 함수 다음에 만들 것
export function buildCoasterTimeline(frames: PathFrames, options: CoasterPhysicsOptions): PhysicsTimeline {
    const zones = findZones(frames);
    const last = frames.positions.length - 1;
    const friction = options.rolling_friction ?? 0.015;
    const drag = options.drag ?? 0.0012;
    const brake_decel = options.brake_decel ?? 6;
    const hold_decel = options.hold_decel ?? brake_decel;
    const shake = options.shake ?? 0.4;
    // 승강장까지 남은 거리 안에 목표 속도로 줄일 수 있도록, 필요한 제동 거리에 들어서면 브레이크 시작
    const needsEndBraking = (current: number, remaining: number): boolean =>
        current > options.brake_speed && (current * current - options.brake_speed ** 2) / (2 * brake_decel) >= remaining - END_BRAKE_MARGIN;

    const us: number[] = [];
    const speeds: number[] = [];
    const phases: RidePhase[] = [];
    // 정차 시간 동안은 승강장(u=0)에 멈춰 있음
    const dwell_steps = Math.round(options.dwell_seconds / STEP);
    for (let step = 0; step < dwell_steps; step += 1) {
        us.push(0);
        speeds.push(0);
        phases.push("stopped");
    }

    const position = new THREE.Vector3();
    const tangent = new THREE.Vector3();
    const up = new THREE.Vector3();
    const holds = [...(options.holds ?? [])].sort((a, b) => a.u - b.u);
    // 정차 구간의 [시작, 끝] 시각 (초)
    const hold_spans: [number, number][] = [];
    let distance = 0;
    let speed = 0;
    // 정차 직후 밀어 주는 중인지 (내리막에 들어서면 중력에 맡김)
    let is_releasing = false;
    while (distance < frames.length && us.length * STEP < MAX_LAP_SECONDS) {
        const u = distance / frames.length;
        const index = Math.min(Math.floor(u * last), last);
        samplePath(frames, u, position, tangent, up);
        let phase: RidePhase = "ride";
        if (index <= zones.station_end) {
            // 승강장: 타이어가 출발 속도까지 천천히 밀어 줌
            speed = Math.min(options.station_speed, speed + 2 * STEP);
        } else if (index >= zones.lift_start && index < zones.lift_end) {
            // 리프트 언덕: 체인에 걸리면 체인 속도로 일정하게 올라감 (관성으로 더 빠르면 그 속도를 유지)
            speed = Math.max(options.chain_speed, speed - GRAVITY * tangent.y * STEP);
            phase = "lift";
        } else if (index >= zones.brake_start || needsEndBraking(speed, frames.length - distance)) {
            phase = "brake";
            // 브레이크 구간: 목표 속도(승강장 끝 u=1 에서 멈추도록 남은 거리에 맞춘 상한 포함)까지 감속도만큼만 줄임
            // (상한으로 속도를 바로 잘라 내면 한 프레임에 10m/s 씩 떨어져 열차가 튐)
            const remaining = frames.length - distance;
            const target = Math.min(options.brake_speed, Math.max(0.6, Math.sqrt(2 * STATION_STOP_DECEL * remaining)));
            speed = speed > target ? Math.max(target, speed - brake_decel * STEP) : Math.min(target, speed + 2 * STEP);
        } else {
            // 자유 주행: 중력의 진행 방향 성분으로 가감속, 마찰·저항으로 에너지 손실
            const acceleration = -GRAVITY * tangent.y - friction * GRAVITY - drag * speed * speed;
            // 정차 직후 밀어 주는 동안은 최저 속도를 두지 않음 (0 에서 바로 0.8m/s 로 튀지 않고 서서히 출발)
            speed = Math.max(is_releasing ? 0 : MIN_FREE_SPEED, speed + acceleration * STEP);
            // 정차 직후: 물살·타이어가 밀어 줌 (내리막 경사에 들어서면 그만)
            if (is_releasing && options.hold_release_speed !== undefined) {
                if (tangent.y < -0.05) {
                    is_releasing = false;
                } else {
                    speed = Math.max(speed, Math.min(options.hold_release_speed, speed + 2 * STEP));
                }
            }
        }
        // 중간 정차 지점 접근: 멈출 수 있는 거리에 들어서면 미리 감속하고, 이번 스텝에 닿으면 정확히 그 자리에 멈춤
        // (지나친 뒤 되돌리면 위치가 뒤로 튀고, 빠른 채 닿으면 한 프레임에 급정지함)
        const next_hold = holds[hold_spans.length];
        if (next_hold !== undefined) {
            const to_hold = next_hold.u * frames.length - distance;
            if ((speed * speed) / (2 * hold_decel) >= to_hold) {
                speed = Math.max(HOLD_CREEP_SPEED, speed - hold_decel * STEP);
            }
            if (to_hold <= speed * STEP) {
                distance = next_hold.u * frames.length;
                const start = us.length * STEP;
                const steps = Math.round(next_hold.seconds / STEP);
                for (let step = 0; step < steps; step += 1) {
                    us.push(next_hold.u);
                    speeds.push(0);
                    phases.push("stopped");
                }
                hold_spans.push([start, us.length * STEP]);
                speed = 0;
                is_releasing = options.hold_release_speed !== undefined;
                continue;
            }
        }
        distance += speed * STEP;
        us.push(Math.min(distance / frames.length, 1));
        speeds.push(speed);
        phases.push(phase);
    }
    // 표본별 속도 (그 지점을 지날 때의 최고 속도) → 뱅크 설계 → 체감 G
    const speed_by_index = new Array<number>(last + 1).fill(0);
    us.forEach((u, step) => {
        const index = Math.round(u * last);
        speed_by_index[index] = Math.max(speed_by_index[index], speeds[step]);
    });
    for (let index = 1; index <= last; index += 1) {
        if (speed_by_index[index] === 0) {
            speed_by_index[index] = speed_by_index[index - 1];
        }
    }
    bankFrames(frames, speed_by_index, options.max_bank_degrees ?? DEFAULT_MAX_BANK_DEGREES);
    const raw_g = us.map((u, step) => (speeds[step] === 0 ? 1 : gForceAt(frames, u, speeds[step])));
    // 실제 코스터 G 측정처럼 5Hz 저역 통과(0.2초 이동 평균) — 트랙 이음매의 순간 튐은 몸이 느끼는 힘이 아님
    const half_window = Math.round(G_FILTER_SECONDS / STEP / 2);
    const g_forces = raw_g.map((_, step) => {
        let sum = 0;
        for (let offset = -half_window; offset <= half_window; offset += 1) {
            sum += raw_g[(step + offset + raw_g.length) % raw_g.length];
        }
        return sum / (half_window * 2 + 1);
    });
    const duration = us.length * STEP;

    // 매 프레임 불리므로 결과 객체를 새로 만들지 않고 재사용
    const time_index = { index: 0, ratio: 0 };
    const hold_state: HoldState = { passed: 0, progress: 0 };

    function indexAt(time: number): { index: number; ratio: number } {
        const local = ((time % duration) + duration) % duration;
        const scaled = local / STEP;
        time_index.index = Math.min(Math.floor(scaled), us.length - 1);
        time_index.ratio = scaled - time_index.index;
        return time_index;
    }

    return {
        duration,
        uAt(time) {
            const { index, ratio } = indexAt(time);
            const next = index + 1 < us.length ? us[index + 1] : 1;
            return us[index] + (next - us[index]) * ratio;
        },
        thrillAt(time, out) {
            const { index } = indexAt(time);
            out.speed = speeds[index];
            out.g_force = g_forces[index];
            out.shake = shake * THREE.MathUtils.clamp(speeds[index] / 20, 0, 1);
            out.phase = phases[index];
        },
        timeOfU(target_u) {
            const found = us.findIndex((u) => u >= target_u);
            return (found < 0 ? us.length : found) * STEP;
        },
        holdStateAt(time) {
            const local = ((time % duration) + duration) % duration;
            hold_state.passed = 0;
            hold_state.progress = 0;
            for (const [start, end] of hold_spans) {
                if (local >= end) {
                    hold_state.passed += 1;
                } else if (local >= start) {
                    hold_state.progress = (local - start) / (end - start);
                    break;
                }
            }
            return hold_state;
        },
    };
}

// 최고점을 지나 출발 높이 근처까지 떨어진 첫 지점 (워터 슬라이드 착수 지점)
export function findDropBottomU(frames: PathFrames, height_margin: number): number {
    const zones = findZones(frames);
    const start_y = frames.positions[0].y;
    const last = frames.positions.length - 1;
    for (let index = zones.lift_end; index <= last; index += 1) {
        if (frames.positions[index].y <= start_y + height_margin) {
            return index / last;
        }
    }
    return 1;
}

// ───────── 진자 기구 (렛츠 트위스트) ─────────

export interface PendulumOptions {
    // 회전축에서 좌석까지 거리 (m)
    arm_length: number;
    // 최대 흔들림 각도 (라디안)
    max_angle: number;
    // 운행 단계별 시간 (초): 승하차 → 진폭 키우기 → 최고 진폭 유지 → 진폭 줄이기
    load_seconds: number;
    pump_seconds: number;
    peak_seconds: number;
    decay_seconds: number;
    // 최고 진폭일 때 좌석 원판 회전 속도 (rad/s)
    wheel_spin: number;
}

export interface PendulumProgram {
    angleAt(time: number): number;
    wheelAngleAt(time: number): number;
    thrillAt(time: number, out: RideThrill): void;
}

function smoothstep(value: number): number {
    const clamped = THREE.MathUtils.clamp(value, 0, 1);
    return clamped * clamped * (3 - 2 * clamped);
}

export function createPendulumProgram(options: PendulumOptions): PendulumProgram {
    const cycle = options.load_seconds + options.pump_seconds + options.peak_seconds + options.decay_seconds;
    // 진자의 고유 진동수 √(g/L) — 진폭이 크면 주기가 길어지므로 최고 진폭 기준으로 보정
    const omega = Math.sqrt(GRAVITY / options.arm_length) * (1 - (options.max_angle * options.max_angle) / 16);
    const swing_start = options.load_seconds;
    const peak_start = swing_start + options.pump_seconds;
    const decay_start = peak_start + options.peak_seconds;

    // 운행 단계에 따른 진폭 비율 0~1
    function envelope(local: number): number {
        if (local < swing_start) {
            return 0;
        }
        if (local < peak_start) {
            return smoothstep((local - swing_start) / options.pump_seconds);
        }
        if (local < decay_start) {
            return 1;
        }
        return 1 - smoothstep((local - decay_start) / options.decay_seconds);
    }

    // 원판 회전각 = 회전 속도(진폭 비율에 비례)의 누적 — 한 주기 표를 미리 만들어 시각의 순수 함수로 사용
    const wheel_table: number[] = [0];
    for (let local = STEP; local <= cycle; local += STEP) {
        wheel_table.push(wheel_table[wheel_table.length - 1] + options.wheel_spin * envelope(local) * STEP);
    }
    const wheel_per_cycle = wheel_table[wheel_table.length - 1];

    function angleAt(time: number): number {
        const local = ((time % cycle) + cycle) % cycle;
        return options.max_angle * envelope(local) * Math.sin(omega * (local - swing_start));
    }

    return {
        angleAt,
        wheelAngleAt(time) {
            const cycles = Math.floor(time / cycle);
            const local = time - cycles * cycle;
            // 1/60초 표 사이를 보간 (주사율이 높은 화면에서 계단처럼 끊겨 돌지 않게)
            const scaled = local / STEP;
            const index = Math.min(Math.floor(scaled), wheel_table.length - 2);
            const ratio = Math.min(scaled - index, 1);
            return cycles * wheel_per_cycle + wheel_table[index] + (wheel_table[index + 1] - wheel_table[index]) * ratio;
        },
        thrillAt(time, out) {
            const angle = angleAt(time);
            const angular_speed = (angleAt(time + STEP) - angleAt(time - STEP)) / (2 * STEP);
            out.speed = Math.abs(angular_speed) * options.arm_length;
            // 팔 방향(축 쪽)으로 눌리는 힘: 원운동 구심 가속도 + 중력의 팔 방향 성분
            out.g_force = (angular_speed * angular_speed * options.arm_length) / GRAVITY + Math.cos(angle);
            out.shake = 0.15 * THREE.MathUtils.clamp(out.speed / 12, 0, 1);
            out.side = Math.sign(angle);
            // 운행 중인지는 진폭으로 판단 (꼭대기에서 순간 속도가 0 이어도 운행 중)
            out.phase = envelope(((time % cycle) + cycle) % cycle) > 0.001 ? "ride" : "stopped";
        },
    };
}
