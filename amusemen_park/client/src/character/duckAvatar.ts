// 오리 아바타 = 모델(rig) + 애니메이션 + 이름표 — 플레이어·NPC 공용
import * as THREE from "three";
import { PLAYER_ANIM, type PlayerAnim } from "@shared";
import { createDuckAnimator } from "./duckAnimation";
import { DUCK_HEIGHT, createDuckRig } from "./duckModel";
import { createNameTag, disposeNameTag, type NameTagStyle } from "./nameTag";

export interface DuckAvatar {
    // 위치·방향을 정하는 최상위 노드 (원점 = 발바닥, 정면 +z)
    readonly root: THREE.Group;
    anim: PlayerAnim;
    // 이동 속도 (걷기 동작 빠르기)
    speed: number;
    // 탑승 중 신남 정도 0~1 (스릴 기구 좌석에서 매 프레임 설정, update 후 0 으로 돌아감)
    excitement: number;
    update(delta: number, time: number): void;
    dispose(): void;
}

export interface DuckAvatarOptions {
    name: string;
    color: string;
    tag_style?: NameTagStyle;
}

// 이름표가 머리 위로 떠 있는 간격
// (이름표 높이의 절반 + 머리와 이름표 아래 끝 사이 0.14 — 이름표 크기를 바꾸면 함께 조정)
const TAG_GAP = 0.245;
// 바닥 높이가 바뀔 때(기구 바닥에 오르내릴 때) 따라가는 빠르기
const GROUND_FOLLOW_RATE = 20;

// 서 있는 곳의 바닥 높이 — 플레이 화면이 설정 (없으면 땅 0)
let ground_height_source: ((x: number, z: number) => number) | null = null;

export function setGroundHeightSource(source: ((x: number, z: number) => number) | null): void {
    ground_height_source = source;
}

export function createDuckAvatar(options: DuckAvatarOptions): DuckAvatar {
    // 외형 선택 키 = 이름 + 색 (NPC 는 색이 5가지뿐이라 색만으로는 일부 모델이 배정되지 않음)
    const rig = createDuckRig(options.color, `${options.name}|${options.color}`);
    const animator = createDuckAnimator(rig);
    const tag = createNameTag(options.name, options.tag_style);
    tag.position.set(0, DUCK_HEIGHT + TAG_GAP, 0);
    // 이름표는 몸통이 아니라 root 에 붙여 뒤뚱거림에 흔들리지 않게
    rig.root.add(tag);
    let ground_y = 0;

    const avatar: DuckAvatar = {
        root: rig.root,
        anim: PLAYER_ANIM.IDLE,
        speed: 0,
        excitement: 0,
        update(delta, time) {
            // 서 있으면 바닥 높이 위에 세움 (앉으면 좌석 앵커가 높이를 정함)
            if (avatar.anim !== PLAYER_ANIM.SIT) {
                const target = ground_height_source?.(rig.root.position.x, rig.root.position.z) ?? 0;
                ground_y = THREE.MathUtils.lerp(ground_y, target, 1 - Math.exp(-GROUND_FOLLOW_RATE * delta));
                rig.root.position.y = ground_y;
            }
            animator.update(avatar.anim, avatar.speed, delta, time, avatar.excitement);
            // 좌석에서 내리면 더 이상 설정되지 않으므로 자연히 0 으로
            avatar.excitement = 0;
        },
        dispose() {
            rig.root.removeFromParent();
            // 공유 도형·재질은 남겨 두고 이 오리만의 이름표 텍스처만 해제
            disposeNameTag(tag);
        },
    };
    return avatar;
}
