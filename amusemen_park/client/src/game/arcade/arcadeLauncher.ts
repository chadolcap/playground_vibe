// 게임장 게임 화면 실행기 — 게임기를 눌렀을 때만 동적 import 로 불러온다 (pixi.js·게임 화면·이미지가 놀이동산 첫 로딩에 끼지 않게)
// 놀이동산 화면 위에 Pixi 캔버스(720x1280 고정 해상도, 화면 크기에 맞춰 CSS 배율)를 덮어 원본 게임 씬을 그대로 띄운다.
import { Application } from "pixi.js";
import type { Room } from "@colyseus/sdk";
import type { GameId } from "@shared";
import { GAME_HEIGHT, GAME_WIDTH, POP_FONT_FAMILY } from "./config";
import type { Scene } from "./scenes/Scene";
import { SceneManager } from "./scenes/SceneManager";
import { ReleasePortraitRenderer } from "./characterPortrait";
import { AirhockeyScene } from "./games/airhockey/AirhockeyScene";
import { FlagScene } from "./games/flag/FlagScene";
import { OthelloScene } from "./games/othello/OthelloScene";
import { RpsScene } from "./games/rps/RpsScene";
import { SteppingScene } from "./games/stepping/SteppingScene";

export interface ArcadeLaunchOptions {
    game_id: GameId;
    room: Room;
    // 게임 화면을 붙일 부모 (놀이동산 화면)
    host: HTMLElement;
    // 게임이 끝나 놀이동산으로 돌아갈 때 (씬의 '나가기'·RETURN_TO_LOBBY)
    onExit: () => void;
}

export interface ArcadeGame {
    // 게임 화면을 보이기/숨기기 (상대를 기다리는 동안은 숨기고 대기중 팝업을 보여 줌)
    setVisible(visible: boolean): void;
    dispose(): void;
}

// 같은 화면 비율로 창에 꽉 차게 (원본 main.ts FitCanvasToWindow)
function fitCanvas(canvas: HTMLCanvasElement): void {
    const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
    canvas.style.width = `${GAME_WIDTH * scale}px`;
    canvas.style.height = `${GAME_HEIGHT * scale}px`;
}

function createScene(options: ArcadeLaunchOptions, onExitToLobby: () => void): Scene {
    // 내 userid = 게임방 sessionId (서버 gameRoomHelper.ReadJoinAuth)
    const scene_options = { room: options.room, my_userid: options.room.sessionId, is_rejoin: false, onExitToLobby };
    switch (options.game_id) {
        case "othello": return new OthelloScene(scene_options);
        case "stepping": return new SteppingScene(scene_options);
        case "airhockey": return new AirhockeyScene(scene_options);
        case "flag": return new FlagScene(scene_options);
        default: return new RpsScene(scene_options);
    }
}

export async function launchArcadeGame(options: ArcadeLaunchOptions): Promise<ArcadeGame> {
    // Pixi Text 는 만들 때 글꼴이 굳으므로 씬보다 먼저 글꼴을 기다린다
    try {
        await document.fonts.load(`24px "${POP_FONT_FAMILY}"`);
    } catch (error) {
        console.warn("[arcade] 글꼴 로드 실패", error);
    }

    const screen = document.createElement("div");
    screen.className = "arcade-screen";
    screen.hidden = true;
    options.host.appendChild(screen);

    const app = new Application();
    await app.init({ background: "#1a1a2e", width: GAME_WIDTH, height: GAME_HEIGHT, antialias: true });
    screen.appendChild(app.canvas);
    const onResize = (): void => fitCanvas(app.canvas);
    onResize();
    window.addEventListener("resize", onResize);

    let disposed = false;
    const scene_manager = new SceneManager(app);
    scene_manager.ChangeScene(createScene(options, () => options.onExit()));

    return {
        setVisible(visible) {
            screen.hidden = !visible;
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            window.removeEventListener("resize", onResize);
            scene_manager.Dispose();
            app.destroy(true, { children: true });
            screen.remove();
            ReleasePortraitRenderer();
        },
    };
}
