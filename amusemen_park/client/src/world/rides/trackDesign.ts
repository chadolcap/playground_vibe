// 트랙 설계 도구 — 실제 코스터·후룸처럼 "위에서 본 경로"와 "옆에서 본 높이 단면"을 따로 설계해 합침
// 높이 단면은 거북이 그래픽처럼 직선 / 원호(반지름·도달 각도)를 이어 그림 → 구간마다 G 를 미리 가늠할 수 있음
// (바닥 원호 반지름 R, 속도 v 이면 G ≈ 1 + v²/(R·g))
import * as THREE from "three";
import type { PathFrames } from "./common";

export type PlanPoint = readonly [number, number];

export type ProfileStep =
    | { kind: "line"; length: number }
    | { kind: "arc"; radius: number; to_degrees: number }
    | { kind: "line_to"; height: number }
    // 이 지점의 위치를 이름으로 기록 (턴테이블·건물 같은 장치를 놓을 자리)
    | { kind: "mark"; name: string };

export const line = (length: number): ProfileStep => ({ kind: "line", length });
export const arc = (radius: number, to_degrees: number): ProfileStep => ({ kind: "arc", radius, to_degrees });
export const lineTo = (height: number): ProfileStep => ({ kind: "line_to", height });
export const mark = (name: string): ProfileStep => ({ kind: "mark", name });

const PROFILE_STEP_LENGTH = 0.4;

interface ProfileSample {
    s: number;
    y: number;
}

// 높이 단면을 따라가며 (수평 거리 s, 높이 y) 표본을 만듦
function sampleProfile(steps: readonly ProfileStep[], start_height: number): { samples: ProfileSample[]; marks: Map<string, ProfileSample> } {
    const samples: ProfileSample[] = [{ s: 0, y: start_height }];
    const marks = new Map<string, ProfileSample>();
    let s = 0;
    let y = start_height;
    let angle = 0;
    const advance = (length: number): void => {
        s += length * Math.cos(angle);
        y += length * Math.sin(angle);
        samples.push({ s, y });
    };
    for (const step of steps) {
        if (step.kind === "mark") {
            marks.set(step.name, { s, y });
        } else if (step.kind === "line" || step.kind === "line_to") {
            // 경사 0 에서 높이 목표 직선은 길이가 무한대(멈춤)·NaN 이 되고, 방향이 반대면 뒤로 감 → 잘못된 설계로 건너뜀
            if (step.kind === "line_to" && (Math.abs(Math.sin(angle)) < 1e-3 || (step.height - y) / Math.sin(angle) <= 0)) {
                console.error(`[trackDesign] 높이 ${step.height} 까지 직선을 그을 수 없는 경사입니다 (지금 높이 ${y.toFixed(2)}, 각도 ${THREE.MathUtils.radToDeg(angle).toFixed(1)}°)`);
                continue;
            }
            const length = step.kind === "line" ? step.length : (step.height - y) / Math.sin(angle);
            const count = Math.max(1, Math.ceil(Math.abs(length) / PROFILE_STEP_LENGTH));
            for (let index = 0; index < count; index += 1) {
                advance(length / count);
            }
        } else {
            const target = THREE.MathUtils.degToRad(step.to_degrees);
            const turn = target - angle;
            const count = Math.max(1, Math.ceil((Math.abs(turn) * step.radius) / PROFILE_STEP_LENGTH));
            for (let index = 0; index < count; index += 1) {
                // 원호의 각 조각은 중간 각도로 직진 (정확한 원호 근사)
                angle += turn / count / 2;
                advance((Math.abs(turn) * step.radius) / count);
                angle += turn / count / 2;
            }
        }
    }
    return { samples, marks };
}

export interface DesignedTrack {
    curve: THREE.CatmullRomCurve3;
    // 높이 단면 수평 길이 / 위에서 본 경로 길이 — 0.9 안팎이어야 끝에 직선 브레이크 구간이 남음 (1 이상이면 단면이 잘림)
    fit_ratio: number;
    // mark 로 기록한 지점의 3D 위치
    marks: Map<string, THREE.Vector3>;
}

// 경로와 단면을 합친 3D 트랙 곡선 (출발 높이로 끝나 처음과 이어짐)
export function designTrack(plan_points: readonly PlanPoint[], steps: readonly ProfileStep[], start_height: number): DesignedTrack {
    const plan = new THREE.CatmullRomCurve3(plan_points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, "centripetal");
    const plan_length = plan.getLength();
    const { samples, marks } = sampleProfile(steps, start_height);
    const profile_length = samples[samples.length - 1].s;
    const toPoint = (s: number, y: number): THREE.Vector3 => {
        const point = plan.getPointAt(Math.min(s / plan_length, 1));
        return new THREE.Vector3(point.x, y, point.z);
    };
    // 단면이 경로보다 짧으면 남는 거리는 출발 높이의 평지(브레이크)로 채움
    const points: THREE.Vector3[] = [];
    const flat_spacing = 1;
    for (const sample of samples) {
        if (sample.s >= plan_length) {
            break;
        }
        points.push(toPoint(sample.s, sample.y));
    }
    for (let s = profile_length + flat_spacing; s < plan_length - flat_spacing; s += flat_spacing) {
        points.push(toPoint(s, start_height));
    }
    const mark_points = new Map<string, THREE.Vector3>();
    marks.forEach((sample, name) => mark_points.set(name, toPoint(sample.s, sample.y)));
    return {
        curve: new THREE.CatmullRomCurve3(points, true, "centripetal"),
        fit_ratio: profile_length / plan_length,
        marks: mark_points,
    };
}

// 트랙 위에서 point 와 가장 가까운 경로 위치 u (0~1)
export function findNearestU(frames: PathFrames, point: THREE.Vector3): number {
    let best = 0;
    let best_distance = Infinity;
    frames.positions.forEach((position, index) => {
        const distance = position.distanceToSquared(point);
        if (distance < best_distance) {
            best_distance = distance;
            best = index;
        }
    });
    return best / (frames.positions.length - 1);
}
