// 게임장 — 게임기를 누르면 바로 게임방에 입장, 상대를 기다리는 동안 대기중 팝업, 게임 화면을 놀이동산 위에 띄움
// 게임 화면(pixi.js·원본 게임 씬·이미지)은 이때 처음 동적 import 로 불러온다 (놀이동산 첫 로딩에 포함되지 않음)
// 게임기 이름표의 참여 인원은 서버 상태 game_counts 를 그대로 표시
import * as THREE from "three";
import type { Room } from "@colyseus/sdk";
import { GAME_LIST, type GameInfo } from "@shared";
import { joinGameRoom } from "../net/connection";
import { createArcadePopup } from "../ui/arcadePopup";
import type { ParkWorld } from "../world/parkWorld";
import type { ArcadeGame } from "./arcade/arcadeLauncher";
import type { LocalPlayer } from "./localPlayer";
import type { RideController } from "./rideController";

// 탭으로 인정하는 최대 포인터 이동(px)·누른 시간(ms) — 드래그(시점 회전)와 구분 (clickToMove 와 같은 값)
const TAP_MOVE_TOLERANCE = 12;
const TAP_MAX_MS = 450;
const ENTER_FAIL_TEXT = "게임에 들어가지 못했어요. 잠시 후 다시 눌러 주세요.";

export interface ArcadeController {
    // 게임기 묶음 — 이걸 누르면 자동 걷기 대신 게임 입장 (clickToMove 가 무시할 대상)
    readonly machines: readonly THREE.Object3D[];
    // 게임 중(대기 포함)이면 true
    readonly is_busy: boolean;
    // 매 프레임: 이름표 인원 갱신
    update(): void;
    dispose(): void;
}

export interface ArcadeControllerOptions {
    world: ParkWorld;
    room: Room;
    local_player: LocalPlayer;
    ride_controller: RideController;
    ui_layer: HTMLElement;
    notify: (text: string) => void;
    // 놀이동산 별명·캐릭터 look_key ("별명|#rrggbb", duckAvatar 와 같은 값)
    name: string;
    avatar: string;
}

interface CountsState {
    game_counts?: Map<string, number>;
}

export function createArcadeController(options: ArcadeControllerOptions): ArcadeController {
    const { world, room, local_player, ride_controller, ui_layer, notify } = options;
    const machines = world.arcade.machines;
    const popup = createArcadePopup(ui_layer);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let busy = false;
    // 지금 진행 중인 입장 시도 번호 — 취소·종료 뒤 늦게 끝난 비동기 작업을 버리기 위함
    let attempt = 0;
    let game_room: Room | null = null;
    let game: ArcadeGame | null = null;

    function pickMachine(client_x: number, client_y: number): GameInfo | null {
        const rect = world.canvas.getBoundingClientRect();
        pointer.set(((client_x - rect.left) / rect.width) * 2 - 1, -((client_y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, world.camera);
        const hit = raycaster.intersectObjects(machines as THREE.Object3D[], true)[0];
        for (let node: THREE.Object3D | null = hit?.object ?? null; node !== null; node = node.parent) {
            const game_id = node.userData.game_id;
            if (typeof game_id === "string") {
                return GAME_LIST.find((info) => info.id === game_id) ?? null;
            }
        }
        return null;
    }

    // 게임을 끝내거나 취소 — 게임방에서 나가고(정상 종료) 게임 화면을 치운 뒤 조작을 돌려줌
    function finish(): void {
        attempt += 1;
        popup.close();
        const leaving = game_room;
        game_room = null;
        if (leaving !== null) {
            // 이미 끊긴 소켓이면 leave 가 끝나지 않을 수 있어 기다리지 않음
            void leaving.leave(true).catch(() => undefined);
        }
        game?.dispose();
        game = null;
        busy = false;
        if (ride_controller.riding === null) {
            local_player.locked = false;
        }
    }

    async function start(info: GameInfo): Promise<void> {
        if (busy || ride_controller.riding !== null) {
            return;
        }
        busy = true;
        const my_attempt = ++attempt;
        local_player.clearDestination();
        local_player.locked = true;
        popup.open(`🎮 ${info.name}`, "게임을 불러오는 중이에요…", finish);
        try {
            const [launcher, joined] = await Promise.all([
                import("./arcade/arcadeLauncher"),
                joinGameRoom(info.room_name, options.name, options.avatar),
            ]);
            if (my_attempt !== attempt) {
                void joined.leave(true).catch(() => undefined);
                return;
            }
            game_room = joined;
            // ENTER_ROOM 응답 = 상대까지 모여 게임 화면을 보일 때 (혼자 하는 게임은 바로 옴)
            joined.onMessage("ENTER_ROOM", () => {
                if (my_attempt === attempt) {
                    popup.close();
                    game?.setVisible(true);
                }
            });
            // 게임 화면을 띄우기 전에 끊기면 정리 (게임 화면이 뜬 뒤의 끊김은 게임 씬이 안내하고 '나가기'로 돌아옴)
            joined.onLeave(() => {
                if (my_attempt === attempt && popup.is_open) {
                    notify(ENTER_FAIL_TEXT);
                    finish();
                }
            });
            if (info.players > 1) {
                popup.setText("함께 할 상대를 기다리는 중이에요…\n다른 친구가 같은 게임기를 누르면 시작해요!");
            }
            const launched = await launcher.launchArcadeGame({ game_id: info.id, room: joined, host: ui_layer, onExit: finish });
            if (my_attempt !== attempt) {
                launched.dispose();
                return;
            }
            game = launched;
            // 이미 ENTER_ROOM 이 왔으면(팝업이 닫혔으면) 바로 보임
            game.setVisible(!popup.is_open);
        } catch (error) {
            console.error("[arcade] 게임 입장 실패", error);
            if (my_attempt === attempt) {
                notify(ENTER_FAIL_TEXT);
                finish();
            }
        }
    }

    // 게임기 탭 판정 (마우스·터치 공통)
    let down: { x: number; y: number; time: number; game: GameInfo | null } | null = null;
    const onPointerDown = (event: PointerEvent): void => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        down = { x: event.clientX, y: event.clientY, time: performance.now(), game: pickMachine(event.clientX, event.clientY) };
    };
    const onPointerUp = (event: PointerEvent): void => {
        const pressed = down;
        down = null;
        if (pressed?.game == null || performance.now() - pressed.time > TAP_MAX_MS || Math.hypot(event.clientX - pressed.x, event.clientY - pressed.y) > TAP_MOVE_TOLERANCE) {
            return;
        }
        if (ride_controller.riding !== null) {
            notify("놀이기구에서 내린 뒤 게임기를 눌러 주세요.");
            return;
        }
        void start(pressed.game);
    };
    world.canvas.addEventListener("pointerdown", onPointerDown);
    world.canvas.addEventListener("pointerup", onPointerUp);

    const counts = new Map<string, number>();
    return {
        machines,
        get is_busy() {
            return busy;
        },
        update() {
            const state_counts = (room.state as CountsState | undefined)?.game_counts;
            if (state_counts === undefined) {
                return;
            }
            counts.clear();
            state_counts.forEach((count, game_id) => counts.set(game_id, count));
            world.arcade.setCounts(counts);
        },
        dispose() {
            world.canvas.removeEventListener("pointerdown", onPointerDown);
            world.canvas.removeEventListener("pointerup", onPointerUp);
            finish();
            popup.dispose();
        },
    };
}
