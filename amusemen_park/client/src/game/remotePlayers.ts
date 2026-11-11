// 다른 플레이어 표시 — 서버 상태(players)의 추가·삭제·변경을 받아 오리를 만들고 부드럽게 움직임
import * as THREE from "three";
import { Callbacks, type Room } from "@colyseus/sdk";
import { PLAYER_ANIM, type PlayerAnim } from "@shared";
import { createDuckAvatar, type DuckAvatar } from "../character/duckAvatar";
import type { ParkWorld } from "../world/parkWorld";
import { placeOnSeat } from "./seatPlacement";

// 서버 상태 Player 스키마 중 화면에 필요한 필드 (클라이언트에는 스키마 클래스가 없어 구조로 읽음)
interface PlayerState {
    session_id: string;
    name: string;
    color: string;
    x: number;
    z: number;
    rot_y: number;
    anim: string;
    ride_id: string;
    seat_index: number;
    connected: boolean;
}

// 클라이언트에는 서버 스키마 클래스가 없어 상태 타입을 추론할 수 없으므로,
// 실제 사용하는 콜백만 느슨한 타입으로 선언해 사용 (런타임 동작은 Colyseus Callbacks 그대로)
interface StateCallbacks {
    onAdd(property: string, handler: (value: PlayerState, key: string) => void, immediate?: boolean): () => void;
    onRemove(property: string, handler: (value: PlayerState, key: string) => void): () => void;
    onChange(instance: object, handler: () => void): () => void;
}

interface Snapshot {
    // 받은 시각 (performance.now, ms)
    time: number;
    x: number;
    z: number;
    rot_y: number;
}

interface RemotePlayer {
    state: PlayerState;
    avatar: DuckAvatar;
    snapshots: Snapshot[];
    stop_listening: () => void;
}

// 보간 지연: 이만큼 과거 시점을 그려서 항상 앞뒤 스냅샷 사이를 이어 그림 (서버 패치 50ms 의 2배)
const INTERPOLATION_DELAY_MS = 100;
const MAX_SNAPSHOTS = 12;

export interface RemotePlayers {
    readonly count: number;
    // 화면에 그려진 다른 오리들의 현재 위치 (미니맵용)
    positions(): { x: number; z: number }[];
    update(time: number, delta: number): void;
    dispose(): void;
}

function lerpAngle(from: number, to: number, ratio: number): number {
    return from + Math.atan2(Math.sin(to - from), Math.cos(to - from)) * ratio;
}

function toAnim(value: string): PlayerAnim {
    return value === PLAYER_ANIM.WALK || value === PLAYER_ANIM.SIT ? value : PLAYER_ANIM.IDLE;
}

function pushSnapshot(remote: RemotePlayer): void {
    remote.snapshots.push({ time: performance.now(), x: remote.state.x, z: remote.state.z, rot_y: remote.state.rot_y });
    if (remote.snapshots.length > MAX_SNAPSHOTS) {
        remote.snapshots.shift();
    }
}

// render_time 시점의 위치를 앞뒤 스냅샷 사이에서 선형 보간 (범위 밖이면 가장 가까운 스냅샷)
function sampleSnapshots(snapshots: readonly Snapshot[], render_time: number, out: Snapshot): void {
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    if (render_time <= first.time) {
        Object.assign(out, first);
        return;
    }
    if (render_time >= last.time) {
        Object.assign(out, last);
        return;
    }
    for (let index = snapshots.length - 1; index > 0; index -= 1) {
        const older = snapshots[index - 1];
        const newer = snapshots[index];
        if (render_time >= older.time) {
            const ratio = (render_time - older.time) / Math.max(newer.time - older.time, 1);
            out.x = THREE.MathUtils.lerp(older.x, newer.x, ratio);
            out.z = THREE.MathUtils.lerp(older.z, newer.z, ratio);
            out.rot_y = lerpAngle(older.rot_y, newer.rot_y, ratio);
            return;
        }
    }
}

export function createRemotePlayers(world: ParkWorld, room: Room): RemotePlayers {
    const remotes = new Map<string, RemotePlayer>();
    const callbacks = Callbacks.get(room) as unknown as StateCallbacks;
    const sample: Snapshot = { time: 0, x: 0, z: 0, rot_y: 0 };
    const previous_position = new THREE.Vector3();

    function addPlayer(state: PlayerState, session_id: string): void {
        // 내 오리는 playSession 이 직접 그림
        if (session_id === room.sessionId || remotes.has(session_id)) {
            return;
        }
        const avatar = createDuckAvatar({ name: state.name, color: state.color });
        avatar.root.position.set(state.x, 0, state.z);
        avatar.root.rotation.y = state.rot_y;
        world.scene.add(avatar.root);
        const remote: RemotePlayer = { state, avatar, snapshots: [], stop_listening: () => undefined };
        pushSnapshot(remote);
        // 이 플레이어의 필드가 바뀐 패치마다 스냅샷 저장
        remote.stop_listening = callbacks.onChange(state, () => pushSnapshot(remote));
        remotes.set(session_id, remote);
    }

    function removePlayer(session_id: string): void {
        const remote = remotes.get(session_id);
        if (remote !== undefined) {
            remote.stop_listening();
            remote.avatar.dispose();
            remotes.delete(session_id);
        }
    }

    // immediate=true: 이미 방에 있던 플레이어도 바로 추가
    const stop_add = callbacks.onAdd("players", (state, session_id) => addPlayer(state, session_id), true);
    const stop_remove = callbacks.onRemove("players", (_state, session_id) => removePlayer(session_id));

    return {
        get count() {
            return remotes.size;
        },
        positions() {
            return [...remotes.values()].map(({ avatar }) => ({ x: avatar.root.position.x, z: avatar.root.position.z }));
        },
        update(time, delta) {
            const render_time = performance.now() - INTERPOLATION_DELAY_MS;
            for (const remote of remotes.values()) {
                const { avatar, state } = remote;
                // 재접속 대기 중(connected=false)인 오리도 자리를 지키고 있으므로 그대로 표시
                // 탑승 중이면 좌석에 앉힘
                if (state.ride_id !== "" && placeOnSeat(avatar, world, state.ride_id, state.seat_index)) {
                    avatar.anim = PLAYER_ANIM.SIT;
                    avatar.speed = 0;
                    avatar.update(delta, time);
                    continue;
                }
                previous_position.copy(avatar.root.position);
                sampleSnapshots(remote.snapshots, render_time, sample);
                // 좌석에서 내려온 직후 기울어진 자세를 바로잡음
                avatar.root.rotation.set(0, sample.rot_y, 0);
                avatar.root.position.set(sample.x, 0, sample.z);
                avatar.anim = toAnim(state.anim);
                avatar.speed = delta > 0 ? previous_position.distanceTo(avatar.root.position) / delta : 0;
                avatar.update(delta, time);
            }
        },
        dispose() {
            stop_add();
            stop_remove();
            for (const session_id of [...remotes.keys()]) {
                removePlayer(session_id);
            }
        },
    };
}
