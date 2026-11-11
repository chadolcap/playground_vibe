// 놀이동산 방 상태 스키마 — Colyseus 가 변경분(patch)을 클라이언트에 자동 동기화
// 필드 이름·구조를 바꾸면 doc/놀이동산_온라인.xlsx 의 상태 동기화 항목도 함께 갱신할 것
import { schema, t, type SchemaType } from "@colyseus/schema";
import { PLAYER_ANIM, SEAT_KIND } from "@shared";

// 플레이어 (새끼 오리)
export const Player = schema({
    session_id: t.string(),
    name: t.string(),
    // 몸통 색 "#rrggbb" — 방 안에서 모두 다른 색
    color: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    // Y축 회전(라디안)
    rot_y: t.float32(),
    // idle / walk / sit
    anim: t.string().default(PLAYER_ANIM.IDLE),
    // 탑승 중인 기구 ID (탑승 안 함 = "")
    ride_id: t.string().default(""),
    // 탑승 좌석 번호 (탑승 안 함 = -1)
    seat_index: t.int8().default(-1),
    // 연결이 잠시 끊겨 재접속을 기다리는 중이면 false
    connected: t.boolean().default(true),
}, "Player");
export type Player = SchemaType<typeof Player>;

// 놀이기구 좌석 한 칸
export const Seat = schema({
    // empty / npc / player
    kind: t.string().default(SEAT_KIND.EMPTY),
    // NPC 면 npc_id, 플레이어면 session_id, 비어 있으면 ""
    occupant_id: t.string().default(""),
}, "Seat");
export type Seat = SchemaType<typeof Seat>;

// 놀이기구 (좌석 배치만 동기화 — 위치·운행 애니메이션은 클라이언트가 shared/rides.ts 기준으로 계산)
export const Ride = schema({
    id: t.string(),
    seats: t.array(Seat),
}, "Ride");
export type Ride = SchemaType<typeof Ride>;

// NPC 오리 — 기구 좌석에 앉아 있음
export const Npc = schema({
    // npc_1 형식 (머리 위 이름표에도 그대로 표시)
    id: t.string(),
    ride_id: t.string(),
    seat_index: t.int8(),
    color: t.string(),
}, "Npc");
export type Npc = SchemaType<typeof Npc>;

// 범퍼카 한 대 (서버 물리 결과) — 좌표는 범퍼카 기구 로컬 좌표, 배열 순서 = 좌석 번호
export const BumperCar = schema({
    x: t.float32(),
    z: t.float32(),
    // 정면 방향 (라디안, 0 = +z)
    heading: t.float32(),
}, "BumperCar");
export type BumperCar = SchemaType<typeof BumperCar>;

export const ParkState = schema({
    // key = session_id
    players: t.map(Player),
    // key = ride_id
    rides: t.map(Ride),
    // key = npc_id
    npcs: t.map(Npc),
    // 범퍼카 위치·방향 (index = 좌석 번호)
    bumper_cars: t.array(BumperCar),
}, "ParkState");
export type ParkState = SchemaType<typeof ParkState>;
