// 놀이동산 Colyseus 서버 진입점
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GAME_LIST, ROOM_NAME, type GameId } from "@shared";
import { loadConfig } from "./config";
import { ParkRoom } from "./rooms/ParkRoom";
import { AirhockeyGameRoom } from "./game/airhockey/AirhockeyGameRoom";
import { FlagGameRoom } from "./game/flag/FlagGameRoom";
import { OthelloGameRoom } from "./game/othello/OthelloGameRoom";
import { RpsGameRoom } from "./game/rps/RpsGameRoom";
import { SteppingGameRoom } from "./game/stepping/SteppingGameRoom";

// 게임장 게임방 — 방 이름은 shared/arcade.ts GAME_LIST 의 room_name
const GAME_ROOMS: Record<GameId, typeof OthelloGameRoom | typeof RpsGameRoom | typeof SteppingGameRoom | typeof AirhockeyGameRoom | typeof FlagGameRoom> = {
    othello: OthelloGameRoom,
    rps: RpsGameRoom,
    stepping: SteppingGameRoom,
    airhockey: AirhockeyGameRoom,
    flag: FlagGameRoom,
};

async function startServer(): Promise<void> {
    const config = loadConfig();

    const game_server = new Server({
        transport: new WebSocketTransport(),
    });

    game_server.define(ROOM_NAME, ParkRoom);
    for (const game of GAME_LIST) {
        game_server.define(game.room_name, GAME_ROOMS[game.id]);
    }

    await game_server.listen(config.port);
    console.log(`[server] 포트 ${config.port} 에서 대기 중 (방 이름: "${ROOM_NAME}")`);
}

startServer().catch((error: unknown) => {
    console.error("[server] 시작 실패", error);
    process.exit(1);
});
