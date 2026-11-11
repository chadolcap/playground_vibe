// 놀이동산 월드 방
// 입장(별명 검증·중복 거부·방 번호·색 배정), 이동 검증, 탑승·하차, NPC 대화, 퇴장·재접속 유예
import { Room, ServerError, type Client } from "@colyseus/core";
import {
    BUMPER,
    CLIENT_MESSAGE,
    ERROR_CODE,
    NPC_ID_PREFIX,
    RIDE_ID,
    PLAYER_ANIM,
    RIDES,
    RIDE_LIST,
    ROOM_MAX_CLIENTS,
    SEAT_KIND,
    SERVER_MESSAGE,
    SPAWN_POINT,
    SPAWN_RADIUS,
    checkNickname,
    getRideGate,
    isNearRide,
    isNpcChoiceId,
    isRideId,
    nicknameKey,
    type BumperInputPayload,
    type ErrorCode,
    type MoveCorrection,
    type NpcTalkResult,
    type RideBoardResult,
    type RideId,
    type RideLeaveResult,
    type RoomInfo,
    type TimeSyncResult,
} from "@shared";
import { getNpcReply } from "../data/npcDialogs";
import { hueToHex, pickHue } from "../logic/colors";
import { checkMove, createBaseline, type MoveBaseline } from "../logic/movement";
import { Npc, ParkState, Player, Ride, Seat } from "../schema/ParkState";
import { BumperArena } from "./bumperArena";

// 입장 거부·요청 실패 시 오류 번호 (메시지에는 ERROR_CODE 문자열을 담음)
const JOIN_REJECT_CODE = 4100;
const REQUEST_REJECT_CODE = 4200;

// 상태 동기화 주기 50ms = 20Hz
const PATCH_INTERVAL_MS = 50;

// 클라이언트당 초당 최대 메시지 수 (이동 15Hz + 요청 여유분, 초과 시 연결 끊김)
const MAX_MESSAGES_PER_SECOND = 40;

// 연결이 끊긴 플레이어를 남겨 두고 재접속을 기다리는 시간(초)
const RECONNECT_SECONDS = 20;

// 하차 시 게이트 주변으로 흩어지는 반경 (여러 명이 한 점에 겹치지 않게)
const EXIT_SCATTER_RADIUS = 2;

// NPC 오리 몸통 색 (플레이어 색과 구분되도록 클래식한 오리색 위주)
const NPC_COLORS = ["#ffd84d", "#ffe680", "#f5c242", "#fff1a8", "#ffcf5c"];

// 사용 중인 방 번호 (이 서버 프로세스 기준)
const used_room_nos = new Set<number>();

// 비어 있는 가장 작은 번호를 배정 → 사라진 방 번호는 다음 새 방이 재사용
function acquireRoomNo(): number {
    let room_no = 1;
    while (used_room_nos.has(room_no)) {
        room_no += 1;
    }
    used_room_nos.add(room_no);
    return room_no;
}

function releaseRoomNo(room_no: number): void {
    used_room_nos.delete(room_no);
}

function rejectJoin(code: ErrorCode): never {
    throw new ServerError(JOIN_REJECT_CODE, code);
}

// 요청(room.request) 실패 — 클라이언트의 request 프로미스가 이 코드로 reject 됨
function rejectRequest(code: ErrorCode): never {
    throw new ServerError(REQUEST_REJECT_CODE, code);
}

// 중심점 주변 반경 안의 무작위 좌표
function scatterAround(center: { x: number; z: number }, radius: number): { x: number; z: number } {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;
    return { x: center.x + Math.cos(angle) * distance, z: center.z + Math.sin(angle) * distance };
}

export interface ParkJoinOptions {
    name?: unknown;
}

export class ParkRoom extends Room<{ state: ParkState }> {
    maxClients = ROOM_MAX_CLIENTS;
    patchRate = PATCH_INTERVAL_MS;
    maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;
    state = new ParkState();

    private room_no = 0;
    // 방 생성 시각 (ms) — 방 시각(room_time) = 지금 - 생성 시각, 놀이기구 움직임의 공통 기준
    private created_at = 0;
    // session_id → 별명 중복 비교 키
    private name_keys = new Map<string, string>();
    // session_id → 배정한 hue (색 중복 방지)
    private player_hues = new Map<string, number>();
    // session_id → 마지막으로 인정한 이동 (속도 검증 기준)
    private move_baselines = new Map<string, MoveBaseline>();
    // 범퍼카 경기장 (서버 물리)
    private bumper_arena: BumperArena | null = null;

    onCreate(): void {
        this.room_no = acquireRoomNo();
        this.created_at = Date.now();
        // 매치메이킹 목록(getAvailableRooms 등)에서도 방 번호를 볼 수 있도록 기록
        void this.setMetadata({ room_no: this.room_no });
        this.setupRides();

        // 범퍼카: 초당 30회 물리 계산, 세게 부딪히면 방 전체에 알림 (충돌 연출용)
        this.bumper_arena = new BumperArena(
            this.state.bumper_cars,
            RIDES.bumper_car.seat_count,
            (hit) => this.broadcast(SERVER_MESSAGE.BUMPER_HIT, hit),
        );
        this.setSimulationInterval((delta_ms) => {
            const seats = this.state.rides.get(RIDE_ID.BUMPER_CAR)?.seats;
            if (seats !== undefined) {
                this.bumper_arena?.step(delta_ms / 1000, [...seats], this.clock.currentTime / 1000);
            }
        }, 1000 / BUMPER.SIMULATION_RATE);
        this.onMessage(CLIENT_MESSAGE.BUMPER_INPUT, (client, payload: unknown) => this.handleBumperInput(client, payload));

        this.onMessage(CLIENT_MESSAGE.ROOM_INFO, (): RoomInfo => ({
            room_no: this.room_no,
            player_count: this.clients.length,
            max_players: this.maxClients,
        }));
        this.onMessage(CLIENT_MESSAGE.TIME_SYNC, (): TimeSyncResult => ({ room_time: Date.now() - this.created_at }));
        this.onMessage(CLIENT_MESSAGE.MOVE, (client, payload: unknown) => this.handleMove(client, payload));
        this.onMessage(CLIENT_MESSAGE.RIDE_BOARD, (client, payload: unknown) => this.handleRideBoard(client, payload));
        this.onMessage(CLIENT_MESSAGE.RIDE_LEAVE, (client) => this.handleRideLeave(client));
        this.onMessage(CLIENT_MESSAGE.NPC_TALK, (client, payload: unknown) => this.handleNpcTalk(client, payload));

        console.log(`[ParkRoom] ${this.room_no}번 방 생성 (${this.roomId})`);
    }

    // 입장 전 검증 — 여기서 던진 오류는 클라이언트의 joinOrCreate 실패로 전달됨
    onAuth(_client: Client, options: ParkJoinOptions): { name: string } {
        const result = checkNickname(options?.name);
        if (!result.ok) {
            rejectJoin(result.code);
        }
        if (this.isNameTaken(result.name)) {
            rejectJoin(ERROR_CODE.DUPLICATE_NAME);
        }
        return { name: result.name };
    }

    onJoin(client: Client): void {
        const name: string = client.auth.name;
        // onAuth 와 onJoin 사이에 같은 별명이 먼저 입장했을 수 있으므로 다시 확인
        if (this.isNameTaken(name)) {
            rejectJoin(ERROR_CODE.DUPLICATE_NAME);
        }
        this.name_keys.set(client.sessionId, nicknameKey(name));

        const hue = pickHue([...this.player_hues.values()]);
        this.player_hues.set(client.sessionId, hue);

        const spawn = scatterAround(SPAWN_POINT, SPAWN_RADIUS);
        this.state.players.set(client.sessionId, new Player({
            session_id: client.sessionId,
            name,
            color: hueToHex(hue),
            x: spawn.x,
            y: 0,
            z: spawn.z,
            // 입구에서 공원 안쪽(-z 방향)을 바라봄
            rot_y: Math.PI,
        }));
        this.resetBaseline(client.sessionId, spawn.x, spawn.z);
        console.log(`[ParkRoom] ${this.room_no}번 방 입장 "${name}" (${this.clients.length}/${this.maxClients})`);
    }

    // 의도치 않은 연결 끊김 — 플레이어·좌석을 유지한 채 재접속을 기다림
    async onDrop(client: Client): Promise<void> {
        const player = this.state.players.get(client.sessionId);
        if (player !== undefined) {
            player.connected = false;
        }
        await this.allowReconnection(client, RECONNECT_SECONDS);
    }

    onReconnect(client: Client): void {
        const player = this.state.players.get(client.sessionId);
        if (player !== undefined) {
            player.connected = true;
            this.resetBaseline(client.sessionId, player.x, player.z);
        }
        console.log(`[ParkRoom] ${this.room_no}번 방 재접속 ${client.sessionId}`);
    }

    // 실제 퇴장 (직접 나가기 또는 재접속 유예 시간 초과)
    onLeave(client: Client): void {
        const player = this.state.players.get(client.sessionId);
        if (player !== undefined && player.ride_id !== "") {
            this.vacateSeat(player);
        }
        this.state.players.delete(client.sessionId);
        this.name_keys.delete(client.sessionId);
        this.player_hues.delete(client.sessionId);
        this.move_baselines.delete(client.sessionId);
        console.log(`[ParkRoom] ${this.room_no}번 방 퇴장 ${client.sessionId}`);
    }

    onDispose(): void {
        releaseRoomNo(this.room_no);
        console.log(`[ParkRoom] ${this.room_no}번 방 제거`);
    }

    // 기구 좌석 생성 + 일부 좌석에 NPC 배치 (npc_1, npc_2, … 방마다 1부터)
    private setupRides(): void {
        let npc_no = 0;
        for (const ride_info of RIDE_LIST) {
            const ride = new Ride({ id: ride_info.id });
            for (let index = 0; index < ride_info.seat_count; index += 1) {
                ride.seats.push(new Seat());
            }
            // NPC 를 좌석 전체에 고르게 흩어 앉힘
            for (let order = 0; order < ride_info.npc_count; order += 1) {
                npc_no += 1;
                const seat_index = Math.floor((order * ride_info.seat_count) / ride_info.npc_count);
                const npc_id = `${NPC_ID_PREFIX}${npc_no}`;
                ride.seats[seat_index].kind = SEAT_KIND.NPC;
                ride.seats[seat_index].occupant_id = npc_id;
                this.state.npcs.set(npc_id, new Npc({
                    id: npc_id,
                    ride_id: ride_info.id,
                    seat_index,
                    color: NPC_COLORS[npc_no % NPC_COLORS.length],
                }));
            }
            this.state.rides.set(ride_info.id, ride);
        }
    }

    private handleMove(client: Client, payload: unknown): void {
        const player = this.state.players.get(client.sessionId);
        const baseline = this.move_baselines.get(client.sessionId);
        // 탑승 중에는 위치가 좌석에 고정되므로 이동 무시
        if (player === undefined || baseline === undefined || player.ride_id !== "") {
            return;
        }
        const result = checkMove(baseline, payload, this.clock.currentTime);
        this.move_baselines.set(client.sessionId, result.baseline);
        if (!result.ok) {
            // 서버가 인정한 마지막 위치로 되돌리도록 알림
            const correction: MoveCorrection = { x: player.x, z: player.z };
            client.send(SERVER_MESSAGE.MOVE_CORRECTION, correction);
            return;
        }
        player.x = result.payload.x;
        player.z = result.payload.z;
        player.rot_y = result.payload.rot_y;
        player.anim = result.payload.anim;
    }

    private handleRideBoard(client: Client, payload: unknown): RideBoardResult {
        const player = this.getPlayerOrReject(client);
        const ride_id = (payload as { ride_id?: unknown } | null)?.ride_id;
        if (!isRideId(ride_id)) {
            rejectRequest(ERROR_CODE.UNKNOWN_RIDE);
        }
        if (player.ride_id !== "") {
            rejectRequest(ERROR_CODE.ALREADY_RIDING);
        }
        if (!this.isNearRideGate(player, ride_id)) {
            rejectRequest(ERROR_CODE.RIDE_TOO_FAR);
        }
        const ride = this.state.rides.get(ride_id);
        const seat_index = ride === undefined ? -1 : ride.seats.findIndex((seat) => seat.kind === SEAT_KIND.EMPTY);
        if (ride === undefined || seat_index < 0) {
            rejectRequest(ERROR_CODE.RIDE_FULL);
        }
        ride.seats[seat_index].kind = SEAT_KIND.PLAYER;
        ride.seats[seat_index].occupant_id = client.sessionId;
        player.ride_id = ride_id;
        player.seat_index = seat_index;
        player.anim = PLAYER_ANIM.SIT;
        console.log(`[ParkRoom] ${this.room_no}번 방 탑승 "${player.name}" → ${ride_id} #${seat_index}`);
        return { ride_id, seat_index };
    }

    private handleRideLeave(client: Client): RideLeaveResult {
        const player = this.getPlayerOrReject(client);
        if (player.ride_id === "" || !isRideId(player.ride_id)) {
            rejectRequest(ERROR_CODE.NOT_RIDING);
        }
        const exit = scatterAround(getRideGate(RIDES[player.ride_id]), EXIT_SCATTER_RADIUS);
        this.vacateSeat(player);
        player.x = exit.x;
        player.z = exit.z;
        player.anim = PLAYER_ANIM.IDLE;
        this.resetBaseline(client.sessionId, exit.x, exit.z);
        return { x: exit.x, z: exit.z };
    }

    private handleNpcTalk(client: Client, payload: unknown): NpcTalkResult {
        const player = this.getPlayerOrReject(client);
        const { npc_id, choice_id } = (payload ?? {}) as { npc_id?: unknown; choice_id?: unknown };
        const npc = typeof npc_id === "string" ? this.state.npcs.get(npc_id) : undefined;
        if (npc === undefined || !isRideId(npc.ride_id)) {
            rejectRequest(ERROR_CODE.UNKNOWN_NPC);
        }
        if (!isNpcChoiceId(choice_id)) {
            rejectRequest(ERROR_CODE.UNKNOWN_CHOICE);
        }
        // 같은 기구에 타고 있거나, 그 기구 근처(게이트·기구 영역)에 있어야 대화 가능
        if (player.ride_id !== npc.ride_id && !this.isNearRideGate(player, npc.ride_id)) {
            rejectRequest(ERROR_CODE.NPC_TOO_FAR);
        }
        return { npc_id: npc.id, choice_id, text: getNpcReply(npc.ride_id, choice_id) };
    }

    // 범퍼카 조종 입력 — 범퍼카에 타고 있는 사람의 것만 받음 (응답 없음)
    private handleBumperInput(client: Client, payload: unknown): void {
        const player = this.state.players.get(client.sessionId);
        if (player === undefined || player.ride_id !== RIDE_ID.BUMPER_CAR || typeof payload !== "object" || payload === null) {
            return;
        }
        const { throttle, steer } = payload as Partial<BumperInputPayload>;
        if (typeof throttle !== "number" || typeof steer !== "number") {
            return;
        }
        this.bumper_arena?.setInput(player.seat_index, throttle, steer, this.clock.currentTime / 1000);
    }

    private getPlayerOrReject(client: Client): Player {
        const player = this.state.players.get(client.sessionId);
        if (player === undefined) {
            rejectRequest(ERROR_CODE.INVALID_PAYLOAD);
        }
        return player;
    }

    // 입구 게이트 근처 또는 기구 영역 가까이 (클라이언트 버튼 표시와 같은 규칙 — shared/rides.ts)
    private isNearRideGate(player: Player, ride_id: RideId): boolean {
        return isNearRide(RIDES[ride_id], player.x, player.z);
    }

    // 플레이어가 앉아 있던 좌석을 비우고 탑승 정보 초기화
    private vacateSeat(player: Player): void {
        if (player.ride_id === RIDE_ID.BUMPER_CAR) {
            // 내린 뒤에는 그 차가 다시 자동 주행
            this.bumper_arena?.clearInput(player.seat_index);
        }
        const seat = this.state.rides.get(player.ride_id)?.seats[player.seat_index];
        if (seat !== undefined && seat.occupant_id === player.session_id) {
            seat.kind = SEAT_KIND.EMPTY;
            seat.occupant_id = "";
        }
        player.ride_id = "";
        player.seat_index = -1;
    }

    private resetBaseline(session_id: string, x: number, z: number): void {
        this.move_baselines.set(session_id, createBaseline(x, z, this.clock.currentTime));
    }

    private isNameTaken(name: string): boolean {
        const key = nicknameKey(name);
        for (const taken_key of this.name_keys.values()) {
            if (taken_key === key) {
                return true;
            }
        }
        return false;
    }
}
