// 플레이 세션 — 입장 후 내 오리 생성, 입력·카메라 연결, 다른 플레이어 표시·내 위치 전송, 매 프레임 갱신
import * as THREE from "three";
import type { Room } from "@colyseus/sdk";
import { CHAT_RULE, CLIENT_MESSAGE, ERROR_CODE, PLAYER_ANIM, RIDE_ID, SERVER_MESSAGE, normalizeChat, type ChatPayload, type ChatResult, type MoveCorrection } from "@shared";
import { createCrazyBumpCars } from "./crazyBumpCars";
import { createClickToMove } from "../controls/clickToMove";
import { createDuckAvatar, setGroundHeightSource } from "../character/duckAvatar";
import { createGroundMap } from "../world/groundMap";
import { createFollowCamera } from "../controls/followCamera";
import { createJoystick, type Joystick } from "../controls/joystick";
import { createKeyboardInput } from "../controls/keyboardInput";
import type { ParkWorld } from "../world/parkWorld";
import { createLocalPlayer, type LocalPlayer } from "./localPlayer";
import { createPositionSender } from "./positionSender";
import { createRemotePlayers, type RemotePlayers } from "./remotePlayers";
import { createRideController, type RideController } from "./rideController";
import { createServerClock, type ServerClock } from "./serverClock";
import { createSnackStand } from "./snackStand";
import { createHeadbandShop } from "./headbandShop";
import { createArcadeController } from "./arcadeController";
import { createNpcDucks } from "./npcDucks";
import { createNpcTalk } from "./npcTalk";
import { createActionBar, type ActionItem, type ScreenPoint } from "../ui/actionBar";
import { createEmoteMenu } from "../ui/emoteMenu";
import { createChatInput } from "../ui/chatInput";
import { createMinimap } from "../ui/minimap";
import { createGameAudio } from "../audio/gameAudio";
import { DUCK_HEIGHT, loadCharacterModel } from "../character/duckModel";

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
// (이름표 위 끝 = DUCK_HEIGHT + 0.28 — duckAvatar 의 TAG_GAP + 이름표 높이 절반, 그보다 0.07 위)
const BUBBLE_ANCHOR_HEIGHT = DUCK_HEIGHT + 0.35;
// 캐릭터 동작 메뉴 반타원의 중심: 정수리보다 조금 아래 — 양 끝 버튼은 머리 옆, 가운데 버튼은 정수리 바로 위
// (메뉴가 열리면 이름표를 숨기므로 그 자리까지 내려옴)
const EMOTE_ANCHOR_HEIGHT = DUCK_HEIGHT - 0.12;
// 채팅 실패 안내
const CHAT_ERROR_TEXT: Record<string, string> = {
    [ERROR_CODE.INVALID_CHAT]: "보낼 수 없는 글이에요.",
    [ERROR_CODE.CHAT_TOO_FAST]: "조금 천천히 말해 주세요.",
};
const CHAT_FAIL_TEXT = "채팅을 보내지 못했어요.";
const bubble_point = new THREE.Vector3();
const temp_forward = new THREE.Vector3();

// 내 오리 머리 위 지점을 화면 좌표(CSS 픽셀)로 변환 — 카메라 뒤쪽이면 null
function projectAboveHead(feet: THREE.Vector3, camera: THREE.Camera, canvas: HTMLCanvasElement, height = BUBBLE_ANCHOR_HEIGHT): ScreenPoint | null {
    bubble_point.set(feet.x, feet.y + height, feet.z).project(camera);
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
    // 캐릭터 모델은 내 정보를 기다리는 동안 함께 불러옴 (아바타는 모두 이 뒤에 생성됨)
    const [me] = await Promise.all([waitForMyPlayer(room), loadCharacterModel()]);
    // 모든 아바타(나·다른 플레이어·NPC)가 지면 물체(기구 바닥·승강장·광장 등) 위에 서도록 — 캐릭터를 넣기 전 장면으로 만듦
    const ground_map = createGroundMap(world.scene, world.rides);
    setGroundHeightSource(ground_map.heightAt);

    const avatar = createDuckAvatar({ name: me.name, color: me.color });
    avatar.root.position.set(me.x, 0, me.z);
    avatar.root.rotation.y = me.rot_y;
    world.scene.add(avatar.root);
    // 바위·수레·가판대·놀이기구는 통과하지 못함 (자동 걷기는 돌아가는 길을 찾음)
    const local_player = createLocalPlayer(avatar, ground_map.pushOut, ground_map.nav);

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
    const snack_stand = createSnackStand({ room, local_player, ride_controller, server_clock, notify });
    const headband_shop = createHeadbandShop({ room, local_player, ride_controller, ui_layer });
    // 게임장: 게임기를 누르면 게임방 입장 (아바타와 같은 별명·캐릭터 look_key 로 입장)
    const arcade = createArcadeController({ world, room, local_player, ride_controller, ui_layer, notify, name: me.name, avatar: `${me.name}|${me.color}` });
    // 터치 기기는 E 키 안내를 붙이지 않음
    const action_bar = createActionBar(ui_layer, joystick === null);
    // 내 캐릭터를 누르면 머리 위에 동작 버튼(안녕·앉기/일어서기·점프·먹기·채팅)
    const emote_menu = createEmoteMenu(ui_layer, world.canvas, world.camera, avatar.root);
    // 채팅: 서버가 받아 주면 내 머리 위에 말풍선 (다른 사람에게는 서버가 CHAT_SAY 로 알림)
    const sendChat = async (raw: string): Promise<void> => {
        const text = normalizeChat(raw);
        if (text === null) {
            notify(CHAT_ERROR_TEXT[ERROR_CODE.INVALID_CHAT]);
            return;
        }
        try {
            const result = await room.request<ChatPayload, ChatResult>(CLIENT_MESSAGE.CHAT, { text });
            avatar.say(result.text);
        } catch (error) {
            notify(error instanceof Error ? CHAT_ERROR_TEXT[error.message] ?? CHAT_FAIL_TEXT : CHAT_FAIL_TEXT);
        }
    };
    const chat_input = createChatInput(ui_layer, (text) => void sendChat(text));
    const emoteItems = (): ActionItem[] => {
        const is_sitting = local_player.emote === PLAYER_ANIM.SIT_GROUND;
        return [
            { id: "wave", label: "안녕", onClick: () => local_player.playEmote(PLAYER_ANIM.WAVE) },
            is_sitting
                ? { id: "stand", label: "일어서기", onClick: () => local_player.standUp() }
                : { id: "sit", label: "앉기", onClick: () => local_player.playEmote(PLAYER_ANIM.SIT_GROUND) },
            { id: "jump", label: "점프", onClick: () => local_player.playEmote(PLAYER_ANIM.JUMP) },
            // 먹기는 간식을 들고 있을 때만
            { id: "eat", label: "먹기", disabled: !avatar.holding, onClick: () => local_player.playEmote(PLAYER_ANIM.EAT) },
            {
                id: "chat",
                label: "채팅",
                onClick: () => {
                    emote_menu.close();
                    chat_input.open();
                },
            },
        ];
    };
    // 미니맵을 누른 곳까지 자동 걷기 (탑승 중에는 무시)
    const minimap = createMinimap(ui_layer, (x, z, run) => {
        if (!local_player.locked) {
            local_player.setDestination(x, z, run);
        }
    });

    // 서버가 이동을 거부하면(속도 초과 등) 서버가 인정한 위치로 되돌림
    const stop_correction = room.onMessage(SERVER_MESSAGE.MOVE_CORRECTION, (correction: MoveCorrection) => {
        avatar.root.position.set(correction.x, 0, correction.z);
        position_sender.resetTo(correction.x, correction.z);
    });

    // 클릭(탭)한 곳까지 자동 이동 (한 번 = 걷기, 두 번 = 달리기 — PC·모바일 공통) — 탑승 중에는 무시
    // 내 캐릭터를 누르거나(이모티콘 버튼) 이모티콘 버튼·채팅창이 열려 있을 때의 클릭은 이동하지 않음
    const click_to_move = createClickToMove(
        world.canvas,
        world.camera,
        world.scene,
        (x, z, run) => {
            if (!local_player.locked) {
                local_player.setDestination(x, z, run);
            }
        },
        { ignore_target: avatar.root, extra_ignore: arcade.machines, isBlocked: () => emote_menu.is_open || chat_input.is_open || arcade.is_busy },
    );

    // CRAZY BUMP: 서버 물리 위치 표시·조종·충돌 연출 (내 차가 부딪히면 화면 흔들림)
    const myCrazyBumpSeat = (): number | null => {
        const riding = ride_controller.riding;
        return riding !== null && riding.ride_id === RIDE_ID.CRAZY_BUMP ? riding.seat_index : null;
    };
    // 효과음·배경음 (Web Audio 합성) — 소리를 낼 수 없거나 오류가 나면 소리 없이 진행
    const game_audio = createGameAudio(world.rides, ui_layer);

    const crazy_bump_cars = createCrazyBumpCars({
        world,
        room,
        getMySeat: myCrazyBumpSeat,
        onMyHit: (strength) => follow_camera.shake(Math.min(strength / 6, 1)),
        onAnyHit: (strength, point, is_mine) => game_audio.bump(strength, point, is_mine),
    });

    const unsubscribe = world.onFrame((time, delta) => {
        server_clock.update(delta);
        // CRAZY BUMP 위치를 먼저 반영해야 좌석에 앉는 오리(나·다른 사람·NPC)가 이번 프레임 차 위치에 앉음
        crazy_bump_cars.update();
        const inputs = joystick === null ? [keyboard.read()] : [keyboard.read(), joystick.read()];
        // 탑승 중이면 좌석에 앉히고(신남 정도 설정) 나서 오리 애니메이션을 갱신해야 같은 프레임에 반영됨
        // (탑승 중 local_player.update 는 위치를 바꾸지 않고 애니메이션만 함)
        ride_controller.update();
        local_player.update(inputs, follow_camera.yaw, delta, time);
        click_to_move.update(local_player.destination, time);
        const crazy_bump_seat = myCrazyBumpSeat();
        // CRAZY BUMP에 타고 있으면 이동 입력이 곧 운전 입력 (위·아래 = 가속·후진, 좌·우 = 핸들)
        crazy_bump_cars.drive(inputs, crazy_bump_seat, delta);
        position_sender.update(delta);
        // 솜사탕(손에 든 크기)은 방 시각 기준 — 아바타 갱신 전에 정해야 같은 프레임에 반영
        snack_stand.update();
        headband_shop.update();
        arcade.update();
        remote_players.update(time, delta, server_clock.now() * 1000);
        npc_ducks.update(time, delta);
        npc_talk.update();
        // CRAZY BUMP는 지붕 아래에서 차 뒤를 따라가며 보고, 다른 기구는 멀리서 기구 전체를 봄
        const crazy_bump_heading = crazy_bump_seat === null ? null : crazy_bump_cars.headingOf(crazy_bump_seat);
        follow_camera.setMinDistance(ride_controller.riding === null || crazy_bump_seat !== null ? 0 : RIDING_CAMERA_DISTANCE);
        follow_camera.setYawTarget(crazy_bump_heading === null ? null : crazy_bump_heading + Math.PI);
        follow_camera.update(avatar.root.position, delta);
        // 간식 받기·머리띠 구경·타기/내리기 (첫 버튼은 E 키) — NPC 는 모두 기구에 타고 있어 말 걸기 버튼은 내지 않음
        // 가게 버튼을 앞에 둠: 가게 창구는 좁은 곳이라 그 앞에 서 있으면 가게를 이용하려는 것 (기구 근처 판정은 넓어 겹칠 수 있음)
        // 동작 메뉴가 열려 있으면 머리 위 자리를 메뉴에 내줌 (탑승하면 메뉴를 닫음)
        if (ride_controller.riding !== null) {
            emote_menu.close();
        }
        const head_point = ride_controller.riding === null ? projectAboveHead(avatar.root.position, world.camera, world.canvas) : null;
        action_bar.setActions(emote_menu.is_open ? [] : [...snack_stand.getActions(), ...headband_shop.getActions(), ...ride_controller.getActions()]);
        // 걸어 다닐 때는 내 오리 머리 위 말풍선, 탑승 중(기구와 함께 빠르게 움직임)에는 화면 오른쪽 아래 고정
        action_bar.setAnchor(head_point);
        // 동작 메뉴가 열려 있는 동안은 이름표를 숨기고 그 자리까지 버튼을 내림
        avatar.setTagHidden(emote_menu.is_open);
        if (emote_menu.is_open) {
            emote_menu.setItems(emoteItems());
            emote_menu.setAnchor(head_point === null ? null : projectAboveHead(avatar.root.position, world.camera, world.canvas, EMOTE_ANCHOR_HEIGHT));
        }
        // 미니맵 화살표는 바라보는 방향(탑승 중에는 좌석 방향)
        temp_forward.set(0, 0, 1).applyQuaternion(avatar.root.quaternion);
        minimap.update({ x: avatar.root.position.x, z: avatar.root.position.z, rot_y: Math.atan2(temp_forward.x, temp_forward.z) }, remote_players.positions());
        // 기구 효과음 (타고 있는 기구는 크게, 근처 기구는 거리에 따라 작게)
        game_audio.update(avatar.root.position, ride_controller.riding?.ride_id ?? null);
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
            setGroundHeightSource(null);
            server_clock.dispose();
            action_bar.dispose();
            emote_menu.dispose();
            chat_input.dispose();
            minimap.dispose();
            click_to_move.dispose();
            crazy_bump_cars.dispose();
            game_audio.dispose();
            npc_talk.dispose();
            headband_shop.dispose();
            arcade.dispose();
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
