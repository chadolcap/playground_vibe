// 게임별 참여 인원 집계 — 게임방들이 인원을 알리면 합계가 바뀔 때 구독자(놀이동산 방)에게 알린다
// 같은 서버 프로세스 안에서만 집계한다 (게임방·놀이동산 방이 한 서버에 있음)

const players_by_room = new Map<string, { game_id: string; count: number }>();
const listeners = new Set<(counts: ReadonlyMap<string, number>) => void>();

export function GetGameCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    for (const { game_id, count } of players_by_room.values()) {
        counts.set(game_id, (counts.get(game_id) ?? 0) + count);
    }
    return counts;
}

function Notify(): void {
    const counts = GetGameCounts();
    for (const listener of listeners) {
        listener(counts);
    }
}

export function SetRoomPlayers(room_id: string, game_id: string, count: number): void {
    const before = players_by_room.get(room_id);
    if (before?.count === count && before.game_id === game_id) return;
    players_by_room.set(room_id, { game_id, count });
    Notify();
}

export function RemoveRoom(room_id: string): void {
    if (players_by_room.delete(room_id)) Notify();
}

// 반환 함수로 구독 해제
export function Subscribe(listener: (counts: ReadonlyMap<string, number>) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
