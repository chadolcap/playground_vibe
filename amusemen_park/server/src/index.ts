// 놀이동산 Colyseus 서버 진입점
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@shared";
import { loadConfig } from "./config";
import { ParkRoom } from "./rooms/ParkRoom";

async function startServer(): Promise<void> {
    const config = loadConfig();

    const game_server = new Server({
        transport: new WebSocketTransport(),
    });

    game_server.define(ROOM_NAME, ParkRoom);

    await game_server.listen(config.port);
    console.log(`[server] 포트 ${config.port} 에서 대기 중 (방 이름: "${ROOM_NAME}")`);
}

startServer().catch((error: unknown) => {
    console.error("[server] 시작 실패", error);
    process.exit(1);
});
