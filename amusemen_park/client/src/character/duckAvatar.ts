// 오리 아바타 = 모델(rig) + 애니메이션 + 이름표 — 플레이어·NPC 공용
import * as THREE from "three";
import { CHAT_RULE, PLAYER_ANIM, SNACK_KIND, isHeadbandId, type PlayerAnim } from "@shared";
import { createChurros } from "./churros";
import { createCottonCandy, type CottonCandy } from "./cottonCandy";
import { EMOTE_SECONDS, HOLD_ARM_ANGLE, createDuckAnimator, jumpHeight } from "./duckAnimation";
import { createHeadband } from "./headband";
import { DUCK_HEIGHT, DUCK_SEAT_OFFSET, createDuckRig } from "./duckModel";
import { TAG_HEIGHT, createNameTag, disposeNameTag, type NameTagStyle } from "./nameTag";
import { createSpeechBubble, disposeSpeechBubble } from "./speechBubble";

export interface DuckAvatar {
    // 위치·방향을 정하는 최상위 노드 (원점 = 발바닥, 정면 +z)
    readonly root: THREE.Group;
    anim: PlayerAnim;
    // 이동 속도 (걷기 동작 빠르기)
    speed: number;
    // 탑승 중 신남 정도 0~1 (스릴 기구 좌석에서 매 프레임 설정, update 후 0 으로 돌아감)
    excitement: number;
    // 손에 간식을 들고 있으면 true (캐릭터 동작 메뉴의 '먹기' 가능 여부)
    readonly holding: boolean;
    // 손에 든 간식 — kind: cotton_candy / churros ("" 또는 left 0 이면 없음), left: 남은 양 1 ~ 0
    setSnack(kind: string, color: string, left: number): void;
    // 쓰고 있는 머리띠 ID ("" 또는 모르는 값 = 벗음) — 바뀔 때만 다시 만듦
    setHeadband(headband_id: string): void;
    // 머리 위 말풍선을 CHAT_RULE.SHOW_SECONDS 동안 보여 줌 (새 글이 오면 바꿔 끼움, 그동안 이름표는 숨김)
    say(text: string): void;
    // 이름표 숨기기 (내 캐릭터 동작 메뉴가 열려 있는 동안)
    setTagHidden(hidden: boolean): void;
    update(delta: number, time: number): void;
    dispose(): void;
}

export interface DuckAvatarOptions {
    name: string;
    color: string;
    tag_style?: NameTagStyle;
    // 캐릭터 모델 순번 (없으면 이름·색 해시로 고름) — 같은 기구 NPC 끼리 서로 다른 캐릭터를 쓰게
    model_order?: number;
}

// 이름표가 머리 위로 떠 있는 간격 (이름표 높이의 절반 + 머리와 이름표 아래 끝 사이 0.14)
const TAG_GAP = TAG_HEIGHT / 2 + 0.14;
// 바닥 높이가 바뀔 때(기구 바닥에 오르내릴 때) 따라가는 빠르기
const GROUND_FOLLOW_RATE = 20;

// 서 있는 곳의 바닥 높이 — 플레이 화면이 설정 (없으면 땅 0)
let ground_height_source: ((x: number, z: number) => number) | null = null;

export function setGroundHeightSource(source: ((x: number, z: number) => number) | null): void {
    ground_height_source = source;
}

export function createDuckAvatar(options: DuckAvatarOptions): DuckAvatar {
    // 외형 선택 키 = 이름 + 색 (NPC 는 색이 5가지뿐이라 색만으로는 일부 모델이 배정되지 않음)
    const rig = createDuckRig(options.color, `${options.name}|${options.color}`, options.model_order);
    const animator = createDuckAnimator(rig);
    const tag = createNameTag(options.name, options.tag_style);
    const tag_y = DUCK_HEIGHT + TAG_GAP;
    tag.position.set(0, tag_y, 0);
    // 이름표는 몸통이 아니라 root 에 붙여 뒤뚱거림에 흔들리지 않게
    rig.root.add(tag);
    let ground_y = 0;
    // 간식 모델은 처음 받을 때 만듦 (대부분의 오리는 들고 있지 않음), 종류가 바뀌면 바꿔 끼움
    let snack: CottonCandy | null = null;
    let snack_kind = "";
    let is_holding = false;
    let headband_id = "";
    let headband: THREE.Group | null = null;
    // 지금 동작(anim)과 시작 시각 — 인사·먹기 진행용
    let last_anim: PlayerAnim = PLAYER_ANIM.IDLE;
    let anim_started = 0;
    // 점프 시작 시각 — 공중에서 걷기로 바뀌어도(또는 상태가 일찍 돌아와도) 착지할 때까지 떠 있음
    let jump_started = -Infinity;
    // 말풍선과 사라지는 시각 (update 의 time 기준, 처음 update 때 정함)
    let bubble: THREE.Sprite | null = null;
    let bubble_until = 0;
    let bubble_pending = false;
    let tag_hidden = false;

    function removeBubble(): void {
        if (bubble !== null) {
            bubble.removeFromParent();
            disposeSpeechBubble(bubble);
            bubble = null;
        }
    }

    // 말풍선이 떠 있거나 메뉴가 열려 있으면 이름표를 숨김
    function refreshTag(): void {
        tag.visible = !tag_hidden && bubble === null;
    }

    // 머리띠 도형은 머리띠마다 따로 만들었으므로 벗을 때 해제 (재질은 공용 캐시라 그대로)
    function removeHeadband(): void {
        headband?.traverse((node) => {
            if (node instanceof THREE.Mesh) {
                node.geometry.dispose();
            }
        });
        headband?.removeFromParent();
        headband = null;
        tag.position.y = tag_y;
    }

    const avatar: DuckAvatar = {
        root: rig.root,
        anim: PLAYER_ANIM.IDLE,
        speed: 0,
        excitement: 0,
        get holding() {
            return is_holding;
        },
        setSnack(kind, color, left) {
            const is_known = kind === SNACK_KIND.COTTON_CANDY || kind === SNACK_KIND.CHURROS;
            is_holding = is_known && left > 0;
            if (!is_holding) {
                snack?.set(color, 0);
                return;
            }
            if (snack === null || kind !== snack_kind) {
                snack?.group.removeFromParent();
                snack = kind === SNACK_KIND.CHURROS ? createChurros() : createCottonCandy();
                snack_kind = kind;
                // 팔을 앞으로 든 만큼 되돌려 막대가 위로 서게, 주먹 살짝 앞에 쥠
                snack.group.rotation.x = rig.hold_angle ?? HOLD_ARM_ANGLE;
                snack.group.position.z = 0.04;
                rig.hand_right.add(snack.group);
            }
            snack.set(color, left);
        },
        setHeadband(next_id) {
            const id = isHeadbandId(next_id) ? next_id : "";
            if (id === headband_id) {
                return;
            }
            headband_id = id;
            removeHeadband();
            if (isHeadbandId(id)) {
                headband = createHeadband(id, rig.head_top.userData.head_width as number);
                rig.head_top.add(headband);
                // 토끼 귀처럼 높은 머리띠가 이름표를 가리지 않게, 정수리 위로 솟은 만큼 이름표를 올림
                rig.root.updateMatrixWorld(true);
                const rise = new THREE.Box3().setFromObject(headband).max.y - rig.head_top.getWorldPosition(new THREE.Vector3()).y;
                tag.position.y = tag_y + Math.max(0, rise);
            }
            bubble?.position.setY(tag.position.y - TAG_HEIGHT / 2);
        },
        say(text) {
            removeBubble();
            bubble = createSpeechBubble(text);
            // 꼬리 끝을 이름표 아래 끝 높이에 (머리띠를 쓰면 이름표와 함께 올라감)
            bubble.position.set(0, tag.position.y - TAG_HEIGHT / 2, 0);
            rig.root.add(bubble);
            bubble_pending = true;
            refreshTag();
        },
        setTagHidden(hidden) {
            if (hidden !== tag_hidden) {
                tag_hidden = hidden;
                refreshTag();
            }
        },
        update(delta, time) {
            if (bubble_pending) {
                bubble_pending = false;
                bubble_until = time + CHAT_RULE.SHOW_SECONDS;
            } else if (bubble !== null && time >= bubble_until) {
                removeBubble();
                refreshTag();
            }
            if (avatar.anim !== last_anim) {
                last_anim = avatar.anim;
                anim_started = time;
                if (avatar.anim === PLAYER_ANIM.JUMP) {
                    jump_started = time;
                }
            }
            // 서 있으면 바닥 높이 위에 세움 (앉으면 좌석 앵커가 높이를 정함)
            if (avatar.anim !== PLAYER_ANIM.SIT) {
                // 바닥에 앉으면 좌석에 앉을 때처럼 엉덩이가 바닥 면에 닿게 올림
                const seat_offset = avatar.anim === PLAYER_ANIM.SIT_GROUND ? DUCK_SEAT_OFFSET : 0;
                const target = (ground_height_source?.(rig.root.position.x, rig.root.position.z) ?? 0) + seat_offset;
                ground_y = THREE.MathUtils.lerp(ground_y, target, 1 - Math.exp(-GROUND_FOLLOW_RATE * delta));
                // 코드로 움직이는 모델만 점프 높이를 더함 (휴머노이드는 점프 클립에 높이가 들어 있음)
                const jump_time = time - jump_started;
                const is_jumping = rig.clips.length === 0 && jump_time < (EMOTE_SECONDS[PLAYER_ANIM.JUMP] ?? 0);
                rig.root.position.y = ground_y + (is_jumping ? jumpHeight(jump_time) : 0);
            }
            animator.update(avatar.anim, avatar.speed, delta, time, avatar.excitement, is_holding, time - anim_started);
            // 좌석에서 내리면 더 이상 설정되지 않으므로 자연히 0 으로
            avatar.excitement = 0;
        },
        dispose() {
            removeHeadband();
            removeBubble();
            rig.root.removeFromParent();
            // 공유 도형·재질은 남겨 두고 이 오리만의 이름표 텍스처만 해제
            disposeNameTag(tag);
        },
    };
    return avatar;
}
