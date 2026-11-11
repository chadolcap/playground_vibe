// 방 시각 동기화 — 같은 방의 모든 클라이언트가 같은 "방 시각"으로 놀이기구를 움직이게 함
// NTP 방식: 요청 보낸 시각·응답 받은 시각의 중간을 서버 응답 시각으로 보고 차이(offset)를 계산
import type { Room } from "@colyseus/sdk";
import { CLIENT_MESSAGE, type TimeSyncResult } from "@shared";

// 처음 접속 시 연속 측정 횟수 (가장 왕복이 짧은 표본을 사용)
const INITIAL_SAMPLES = 5;
const RESYNC_INTERVAL_MS = 10_000;
// 최근 표본 몇 개 중에서 고를지
const SAMPLE_WINDOW = 6;
// 다시 맞출 때 한 번에 튀지 않도록 초당 따라가는 비율
const SLEW_RATE = 0.5;

interface Sample {
    rtt: number;
    offset: number;
}

export interface ServerClock {
    // 방 시각 (초) — 동기화 전에는 로컬 시각으로 대신함
    now(): number;
    readonly is_synced: boolean;
    // 매 프레임: 목표 offset 쪽으로 천천히 수렴
    update(delta: number): void;
    dispose(): void;
}

export function createServerClock(room: Room): ServerClock {
    const samples: Sample[] = [];
    let target_offset = 0;
    let current_offset = 0;
    let is_synced = false;
    let disposed = false;

    async function measure(): Promise<void> {
        const sent = performance.now();
        const result = await room.request<undefined, TimeSyncResult>(CLIENT_MESSAGE.TIME_SYNC);
        const received = performance.now();
        const rtt = received - sent;
        // 서버가 응답한 순간 ≈ 왕복의 중간
        samples.push({ rtt, offset: result.room_time - (sent + rtt / 2) });
        if (samples.length > SAMPLE_WINDOW) {
            samples.shift();
        }
        // 네트워크 지연이 가장 짧았던 표본이 가장 정확
        const best = samples.reduce((a, b) => (b.rtt < a.rtt ? b : a));
        target_offset = best.offset;
        if (!is_synced) {
            current_offset = target_offset;
            is_synced = true;
        }
    }

    async function initialSync(): Promise<void> {
        try {
            for (let count = 0; count < INITIAL_SAMPLES && !disposed; count += 1) {
                await measure();
            }
        } catch (error) {
            console.warn("[serverClock] 시각 동기화 실패 — 로컬 시각 사용", error);
        }
    }

    void initialSync();
    const timer = window.setInterval(() => {
        measure().catch((error: unknown) => console.warn("[serverClock] 재동기화 실패", error));
    }, RESYNC_INTERVAL_MS);

    return {
        now() {
            return (performance.now() + current_offset) / 1000;
        },
        get is_synced() {
            return is_synced;
        },
        update(delta) {
            const difference = target_offset - current_offset;
            // 1초 이상 어긋나면(탭 복귀 등) 바로 맞추고, 작은 차이는 부드럽게
            current_offset = Math.abs(difference) > 1000 ? target_offset : current_offset + difference * Math.min(1, SLEW_RATE * delta);
        },
        dispose() {
            disposed = true;
            window.clearInterval(timer);
        },
    };
}
