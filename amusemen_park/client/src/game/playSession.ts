// 플레이 세션 — 입장 후 내 오리 생성, 입력·카메라 연결, 다른 플레이어 표시·내 위치 전송, 매 프레임 갱신
import * as THREE from "three";
import type { Room } from "@colyseus/sdk";
import { SERVER_MESSAGE, type MoveCorrection } from "@shared";
import { createDuckAvatar } from "../character/duckAvatar";
import { createFollowCamera } from "../controls/followCamera";
import { createJoystick, type Joystick } from "../controls/joystick";
import { createKeyboardInput } from "../controls/keyboardInput";
import type { ParkWorld } from "../world/parkWorld";
import { createLocalPlayer, type LocalPlayer } from "./localPlayer";
import { createPositionSender } from "./positionSender";
import { createRemotePlayers, type RemotePlayers } from "./remotePlayers";
import { createRideController, type RideController } from "./rideController";
import { createServerClock, type ServerClock } from "./serverClock";
import { createNpcDucks } from "./npcDucks";
import { createNpcTalk } from "./npcTalk";
import { createActionBar, type ScreenPoint } from "../ui/actionBar";
import { createMinimap } from "../ui/minimap";
import { DUCK_HEIGHT } from "../character/duckModel";

export interface PlaySession {
    readonly local_player: LocalPlayer;
    readonly remote_players: RemotePlayers;
    readonly ride_controller: RideController;
    readonly server_clock: ServerClock;
    dispose(): void;
}

// 서버 상태에서 읽는 내 플레이어 정보 (Colyseus 가 동기화한 Player 스키마)
interface PlayerSnapshot {
    name: string;
    color: string;
    x: number;
    z: number;
    rot_y: number;
}

const STATE_WAIT_MS = 5000;
// 탑승 중 3인칭 카메라 최소 거리 (기구 구조물에 가리지 않게)
const RIDING_CAMERA_DISTANCE = 14;

// 입장 직후 첫 상태가 도착할 때까지 기다렸다가 내 플레이어 정보를 읽음
function waitForMyPlayer(room: Room): Promise<PlayerSnapshot> {
    return new Promise((resolve, reject) => {
        const started = performance.now();
        const check = (): void => {
            const player = (room.state as { players?: Map<string, PlayerSnapshot> } | undefined)?.players?.get(room.sessionId);
            if (player !== undefined) {
                resolve({ name: player.name, color: player.color, x: player.x, z: player.z, rot_y: player.rot_y });
            } else if (performance.now() - started > STATE_WAIT_MS) {
                reject(new Error("서버에서 내 플레이어 정보를 받지 못했습니다."));
            } else {
                window.setTimeout(check, 50);
            }
        };
        check();
    });
}

// 말풍선 꼬리 위치: 발바닥 기준 이름표보다 조금 위
const BUBBLE_ANCHOR_HEIGHT = DUCK_HEIGHT + 0.7;
const bubble_point = new THREE.Vector3();
const temp_forward = new THREE.Vector3();

// 내 오리 머리 위 지점을 화면 좌표(CSS 픽셀)로 변환 — 카메라 뒤쪽이면 null
function projectAboveHead(feet: THREE.Vector3, camera: THREE.Camera, canvas: HTMLCanvasElement): ScreenPoint | null {
    bubble_point.set(feet.x, feet.y + BUBBLE_ANCHOR_HEIGHT, feet.z).project(camera);
    if (bubble_point.z > 1) {
        return null;
    }
    return {
        x: ((bubble_point.x + 1) / 2) * canvas.clientWidth,
        y: ((1 - bubble_point.y) / 2) * canvas.clientHeight,
    };
}

function isTouchDevice(): boolean {
    return window.matchMedia("(pointer: coarse)").matches;
}

// notify: 화면 아래 안내 문구 표시 (탑승 결과·오류 등)
export async function startPlaySession(world: ParkWorld, room: Room, ui_layer: HTMLElement, notify: (text: string) => void): Promise<PlaySession> {
    const me = await waitForMyPlayer(room);

    const avatar = createDuckAvatar({ name: me.name, color: me.color });
    avatar.root.position.set(me.x, 0, me.z);
    avatar.root.rotation.y = me.rot_y;
    world.scene.add(avatar.root);
    const local_player = createLocalPlayer(avatar);

    const keyboard = createKeyboardInput();
    const joystick: Joystick | null = isTouchDevice() ? createJoystick(ui_layer) : null;
    // 오리 등 뒤에서 시작 (오리가 바라보는 방향의 반대편)
    const follow_camera = createFollowCamera(world.camera, world.canvas, me.rot_y + Math.PI);

    // 놀이기구를 방 시각으로 움직여 모든 클라이언트에서 기구·탑승자 위치가 일치하게
    const server_clock = createServerClock(room);
    world.setRideTimeSource(() => server_clock.now());

    const remote_players = createRemotePlayers(world, room);
    const position_sender = createPositionSender(room, local_player);
    const ride_controller = createRideController({ world, room, local_player, position_sender, notify });
    const npc_ducks = createNpcDucks(world, room);
    const npc_talk = createNpcTalk({ room, local_player, ride_controller, npc_ducks, ui_layer, notify });
    // 터치 기기는 E 키 안내를 붙이지 않음
    const action_bar = createActionBar(ui_layer, joystick === null);
    const minimap = createMinimap(ui_layer);

    // 서버가 이동을 거부하면(속도 초과 등) 서버가 인정한 위치로 되돌림
    const stop_correction = room.onMessage(SERVER_MESSAGE.MOVE_CORRECTION, (correction: MoveCorrection) => {
        avatar.root.position.set(correction.x, 0, correction.z);
        position_sender.resetTo(correction.x, correction.z);
    });

    const unsubscribe = world.onFrame((time, delta) => {
        server_clock.update(delta);
        const inputs = joystick === null ? [keyboard.read()] : [keyboard.read(), joystick.read()];
        local_player.update(inputs, follow_camera.yaw, delta, time);
        ride_controller.update();
        position_sender.update(delta);
        remote_players.update(time, delta);
        npc_ducks.update(time, delta);
        npc_talk.update();
        follow_camera.setMinDistance(ride_controller.riding === null ? 0 : RIDING_CAMERA_DISTANCE);
        follow_camera.update(avatar.root.position, delta);
        // 타기/내리기가 먼저 (E 키), 그다음 말 걸기
        action_bar.setActions([...ride_controller.getActions(), ...npc_talk.getActions()]);
        // 걸어 다닐 때는 내 오리 머리 위 말풍선, 탑승 중(기구와 함께 빠르게 움직임)에는 화면 오른쪽 아래 고정
        action_bar.setAnchor(ride_controller.riding === null ? projectAboveHead(avatar.root.position, world.camera, world.canvas) : null);
        // 미니맵 화살표는 바라보는 방향(탑승 중에는 좌석 방향)
        temp_forward.set(0, 0, 1).applyQuaternion(avatar.root.quaternion);
        minimap.update({ x: avatar.root.position.x, z: avatar.root.position.z, rot_y: Math.atan2(temp_forward.x, temp_forward.z) }, remote_players.positions());
    });

    return {
        local_player,
        remote_players,
        ride_controller,
        server_clock,
        dispose() {
            unsubscribe();
            stop_correction();
            world.setRideTimeSource(null);
            server_clock.dispose();
            action_bar.dispose();
            minimap.dispose();
            npc_talk.dispose();
            npc_ducks.dispose();
            ride_controller.dispose();
            remote_players.dispose();
            follow_camera.dispose();
            joystick?.dispose();
            keyboard.dispose();
            avatar.dispose();
        },
    };
}
