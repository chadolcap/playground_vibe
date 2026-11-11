// NPC 오리 — 서버 상태(npcs)를 받아 기구 좌석에 앉혀 표시 (기구와 함께 움직임, 방 시각 동기화)
import * as THREE from "three";
import { Callbacks, type Room } from "@colyseus/sdk";
import { PLAYER_ANIM, isRideId, type RideId } from "@shared";
import { createDuckAvatar, type DuckAvatar } from "../character/duckAvatar";
import type { NameTagStyle } from "../character/nameTag";
import type { ParkWorld } from "../world/parkWorld";
import { placeOnSeat } from "./seatPlacement";

// 서버 상태 Npc 스키마 (클라이언트에는 스키마 클래스가 없어 구조로 읽음)
interface NpcState {
    id: string;
    ride_id: string;
    seat_index: number;
    color: string;
}

interface StateCallbacks {
    onAdd(property: string, handler: (value: NpcState, key: string) => void, immediate?: boolean): () => void;
    onRemove(property: string, handler: (value: NpcState, key: string) => void): () => void;
}

// 플레이어 이름표(흰색)와 구분되는 NPC 이름표
const NPC_TAG_STYLE: NameTagStyle = { background: "rgba(255, 226, 120, 0.92)", color: "#6b3e00" };

export interface NpcDuck {
    id: string;
    ride_id: RideId;
    // 좌석 번호는 바뀌지 않음
    seat_index: number;
    avatar: DuckAvatar;
}

export interface NpcDucks {
    readonly list: ReadonlyMap<string, NpcDuck>;
    update(time: number, delta: number): void;
    dispose(): void;
}

export function createNpcDucks(world: ParkWorld, room: Room): NpcDucks {
    const npcs = new Map<string, NpcDuck>();
    const callbacks = Callbacks.get(room) as unknown as StateCallbacks;

    function addNpc(state: NpcState): void {
        if (npcs.has(state.id) || !isRideId(state.ride_id)) {
            return;
        }
        const avatar = createDuckAvatar({ name: state.id, color: state.color, tag_style: NPC_TAG_STYLE });
        avatar.anim = PLAYER_ANIM.SIT;
        world.scene.add(avatar.root);
        npcs.set(state.id, { id: state.id, ride_id: state.ride_id, seat_index: state.seat_index, avatar });
    }

    function removeNpc(id: string): void {
        const npc = npcs.get(id);
        if (npc !== undefined) {
            npc.avatar.dispose();
            npcs.delete(id);
        }
    }

    const stop_add = callbacks.onAdd("npcs", (state) => addNpc(state), true);
    const stop_remove = callbacks.onRemove("npcs", (_state, id) => removeNpc(id));

    return {
        list: npcs,
        update(time, delta) {
            for (const npc of npcs.values()) {
                if (placeOnSeat(npc.avatar, world, npc.ride_id, npc.seat_index)) {
                    npc.avatar.update(delta, time);
                }
            }
        },
        dispose() {
            stop_add();
            stop_remove();
            for (const id of [...npcs.keys()]) {
                removeNpc(id);
            }
        },
    };
}

// 내 위치에서 가장 가까운 NPC (조건을 만족하는 기구의 NPC 중에서)
export function findNearestNpc(npcs: NpcDucks, position: THREE.Vector3, allowed: (ride_id: RideId) => boolean): NpcDuck | null {
    let nearest: NpcDuck | null = null;
    let nearest_distance = Infinity;
    for (const npc of npcs.list.values()) {
        if (!allowed(npc.ride_id)) {
            continue;
        }
        const distance = npc.avatar.root.position.distanceTo(position);
        if (distance < nearest_distance) {
            nearest = npc;
            nearest_distance = distance;
        }
    }
    return nearest;
}
