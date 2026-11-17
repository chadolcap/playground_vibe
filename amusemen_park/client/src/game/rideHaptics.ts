// 탑승 중 덜컹거림을 휴대폰 진동으로 전달 — 브라우저 Vibration API (navigator.vibrate)
// 안드로이드 크롬·삼성 인터넷 등은 지원, iOS 사파리는 API 가 없어 아무 일도 하지 않음 (오류 없이 무시)
// 진동은 화면 효과처럼 내 기기에서만 느끼는 것이라 로컬 시계로 박자를 맞춤 (기구 위치 동기화와 무관)
import type { RideThrill } from "../world/rides/common";

// 리프트 체인 걸림쇠 '딸깍' — 일정한 박자
// (휴대폰 진동 모터는 약 20ms 보다 짧으면 거의 느껴지지 않고, 0.1초보다 자주 부르면 서로 덮어써 뭉개짐)
const LIFT_CLICK_INTERVAL = 0.4;
const LIFT_CLICK_MS = 20;
// 주행 중 레일 이음매 덜컹거림 — 빠를수록 촘촘하고, 진동 세기(shake)가 클수록 길게
const RUMBLE_SLOW_INTERVAL = 0.24;
const RUMBLE_FAST_INTERVAL = 0.1;
const RUMBLE_FULL_SPEED = 22;
const RUMBLE_MIN_MS = 20;
const RUMBLE_EXTRA_MS = 26;
const RUMBLE_MIN_SHAKE = 0.05;
// 강한 G 로 짓눌리는 순간 / 브레이크가 걸리는 순간
const HIGH_G = 3;
const HIGH_G_MS = 80;
const BRAKE_PATTERN = [30, 40, 30, 40, 45];
// 에어타임(몸이 뜨는 순간)은 진동을 멈춰 무중력감을 대비시킴
const AIRTIME_G = 0.3;

export interface RideHaptics {
    // 매 프레임: 탑승 중인 기구의 스릴 정보(없으면 느린 관람 기구)와 현재 시각(초)
    update(thrill: RideThrill | undefined, now: number): void;
    // 내리거나 화면을 떠날 때 진동 멈춤
    stop(): void;
}

function canVibrate(): boolean {
    return typeof navigator !== "undefined"
        && typeof navigator.vibrate === "function"
        && typeof matchMedia === "function"
        && matchMedia("(pointer: coarse)").matches;
}

export function createRideHaptics(): RideHaptics {
    const enabled = canVibrate();
    let next_pulse_at = 0;
    let last_phase = "";
    let was_airtime = false;
    let was_high_g = false;

    function vibrate(pattern: number | number[]): void {
        try {
            navigator.vibrate(pattern);
        } catch {
            // 사용자 조작 전이거나 브라우저가 막으면 조용히 무시
        }
    }

    return {
        update(thrill, now) {
            if (!enabled || thrill === undefined) {
                return;
            }
            const phase_changed = thrill.phase !== last_phase;
            last_phase = thrill.phase;
            if (thrill.phase === "stopped") {
                return;
            }
            if (phase_changed && thrill.phase === "brake") {
                vibrate(BRAKE_PATTERN);
                next_pulse_at = now + 0.5;
                return;
            }

            const is_airtime = thrill.g_force < AIRTIME_G;
            if (is_airtime) {
                if (!was_airtime) {
                    vibrate(0);
                }
                was_airtime = true;
                return;
            }
            was_airtime = false;

            const is_high_g = thrill.g_force >= HIGH_G;
            if (is_high_g && !was_high_g) {
                vibrate(HIGH_G_MS);
                next_pulse_at = now + HIGH_G_MS / 1000;
            }
            was_high_g = is_high_g;

            if (now < next_pulse_at) {
                return;
            }
            if (thrill.phase === "lift") {
                vibrate(LIFT_CLICK_MS);
                next_pulse_at = now + LIFT_CLICK_INTERVAL;
                return;
            }
            if (thrill.shake < RUMBLE_MIN_SHAKE) {
                return;
            }
            const speed_ratio = Math.min(thrill.speed / RUMBLE_FULL_SPEED, 1);
            vibrate(Math.round(RUMBLE_MIN_MS + RUMBLE_EXTRA_MS * thrill.shake));
            next_pulse_at = now + RUMBLE_SLOW_INTERVAL + (RUMBLE_FAST_INTERVAL - RUMBLE_SLOW_INTERVAL) * speed_ratio;
        },
        stop() {
            if (enabled) {
                vibrate(0);
            }
            last_phase = "";
            was_airtime = false;
            was_high_g = false;
            next_pulse_at = 0;
        },
    };
}
