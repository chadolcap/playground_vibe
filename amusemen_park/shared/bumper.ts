// 범퍼카 공통 규칙 — 서버 물리 계산과 클라이언트 표시가 같은 값을 사용
// 좌표는 범퍼카 기구의 로컬 좌표 (경기장 중심 = 0,0 / +z = 입구 방향), 차 번호 = 좌석 번호

export const BUMPER = {
    // 경기장 크기 (클라이언트 모델: 18 × 14)
    ARENA_WIDTH: 18,
    ARENA_DEPTH: 14,
    // 차 충돌 반지름
    CAR_RADIUS: 1.05,
    // 최고 속도·가속·감속(마찰)·회전 속도
    MAX_SPEED: 7,
    ACCELERATION: 11,
    FRICTION: 2.2,
    TURN_RATE: 2.8,
    // 부딪힐 때 튕기는 정도 (1 = 완전 탄성)
    RESTITUTION: 0.9,
    // 이보다 세게 부딪혀야 충돌 알림 (상대 속도)
    HIT_MIN_SPEED: 1.6,
    // 같은 두 차의 충돌 알림 최소 간격 (초)
    HIT_COOLDOWN: 0.35,
    // 서버 물리 계산 주기 (Hz)
    SIMULATION_RATE: 30,
    // 클라이언트 입력 전송 주기 (Hz) / 입력이 끊긴 것으로 보는 시간 (초)
    INPUT_RATE: 15,
    INPUT_TIMEOUT: 0.6,
} as const;

// 벽에 부딪힌 경우 상대 차 번호
export const BUMPER_WALL = -1;

// 차 중심이 움직일 수 있는 범위 (경기장 벽 안쪽)
export const BUMPER_LIMIT_X = BUMPER.ARENA_WIDTH / 2 - BUMPER.CAR_RADIUS - 0.25;
export const BUMPER_LIMIT_Z = BUMPER.ARENA_DEPTH / 2 - BUMPER.CAR_RADIUS - 0.25;
