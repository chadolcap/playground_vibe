// 3인칭 추적 카메라 — 대상 뒤에서 따라가며, 드래그로 시점 회전(PC 마우스 / 모바일 화면 드래그), 휠·두 손가락으로 거리 조절
import * as THREE from "three";
import { capturePointer } from "./joystick";

export interface FollowCamera {
    // 수평 회전각 (0 = 카메라가 대상의 남쪽(+z)에서 북쪽을 바라봄)
    readonly yaw: number;
    // 최소 거리 강제 (탑승 중에는 기구 구조물에 가리지 않도록 멀리서 봄), 0 이면 해제
    setMinDistance(value: number): void;
    update(target: THREE.Vector3, delta: number): void;
    dispose(): void;
}

const MIN_PITCH = 0.12;
const MAX_PITCH = 1.25;
const MIN_DISTANCE = 3.5;
const MAX_DISTANCE = 16;
const ROTATE_SPEED = 0.0055;
// 카메라가 대상을 따라붙는 빠르기
const FOLLOW_RATE = 8;
// 대상(발밑)에서 바라볼 높이
const LOOK_HEIGHT = 1.1;

export function createFollowCamera(camera: THREE.PerspectiveCamera, surface: HTMLElement, initial_yaw: number): FollowCamera {
    let yaw = initial_yaw;
    let pitch = 0.42;
    let distance = 7;
    let forced_min_distance = 0;

    // 화면 위 손가락/마우스 (두 개면 확대·축소)
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch_start_gap = 0;
    let pinch_start_distance = distance;

    const look_target = new THREE.Vector3();
    const desired = new THREE.Vector3();
    let is_first_update = true;

    const onPointerDown = (event: PointerEvent): void => {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        capturePointer(surface, event.pointerId);
        if (pointers.size === 2) {
            const [a, b] = [...pointers.values()];
            pinch_start_gap = Math.hypot(a.x - b.x, a.y - b.y);
            pinch_start_distance = distance;
        }
    };
    const onPointerMove = (event: PointerEvent): void => {
        const previous = pointers.get(event.pointerId);
        if (previous === undefined) {
            return;
        }
        const current = { x: event.clientX, y: event.clientY };
        pointers.set(event.pointerId, current);
        if (pointers.size === 1) {
            yaw -= (current.x - previous.x) * ROTATE_SPEED;
            pitch = THREE.MathUtils.clamp(pitch + (current.y - previous.y) * ROTATE_SPEED, MIN_PITCH, MAX_PITCH);
        } else if (pointers.size === 2 && pinch_start_gap > 0) {
            const [a, b] = [...pointers.values()];
            const gap = Math.hypot(a.x - b.x, a.y - b.y);
            distance = THREE.MathUtils.clamp(pinch_start_distance * (pinch_start_gap / gap), MIN_DISTANCE, MAX_DISTANCE);
        }
    };
    const onPointerUp = (event: PointerEvent): void => {
        pointers.delete(event.pointerId);
        pinch_start_gap = 0;
    };
    const onWheel = (event: WheelEvent): void => {
        distance = THREE.MathUtils.clamp(distance * (1 + Math.sign(event.deltaY) * 0.1), MIN_DISTANCE, MAX_DISTANCE);
        event.preventDefault();
    };

    surface.addEventListener("pointerdown", onPointerDown);
    surface.addEventListener("pointermove", onPointerMove);
    surface.addEventListener("pointerup", onPointerUp);
    surface.addEventListener("pointercancel", onPointerUp);
    surface.addEventListener("wheel", onWheel, { passive: false });

    return {
        get yaw() {
            return yaw;
        },
        setMinDistance(value) {
            forced_min_distance = value;
        },
        update(target, delta) {
            look_target.set(target.x, target.y + LOOK_HEIGHT, target.z);
            const current_distance = Math.max(distance, forced_min_distance);
            const horizontal = Math.cos(pitch) * current_distance;
            desired.set(
                look_target.x + Math.sin(yaw) * horizontal,
                look_target.y + Math.sin(pitch) * current_distance,
                look_target.z + Math.cos(yaw) * horizontal,
            );
            // 땅 밑으로 파고들지 않게
            desired.y = Math.max(desired.y, 0.6);
            if (is_first_update) {
                camera.position.copy(desired);
                is_first_update = false;
            } else {
                camera.position.lerp(desired, 1 - Math.exp(-FOLLOW_RATE * delta));
            }
            camera.lookAt(look_target);
        },
        dispose() {
            surface.removeEventListener("pointerdown", onPointerDown);
            surface.removeEventListener("pointermove", onPointerMove);
            surface.removeEventListener("pointerup", onPointerUp);
            surface.removeEventListener("pointercancel", onPointerUp);
            surface.removeEventListener("wheel", onWheel);
        },
    };
}
