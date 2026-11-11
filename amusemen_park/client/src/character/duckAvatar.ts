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
    update(delta: number, time: number): void;
    dispose(): void;
}

export interface DuckAvatarOptions {
    name: string;
    color: string;
    tag_style?: NameTagStyle;
}

// 이름표가 머리 위로 떠 있는 간격
const TAG_GAP = 0.35;

export function createDuckAvatar(options: DuckAvatarOptions): DuckAvatar {
    const rig = createDuckRig(options.color);
    const animator = createDuckAnimator(rig);
    const tag = createNameTag(options.name, options.tag_style);
    tag.position.set(0, DUCK_HEIGHT + TAG_GAP, 0);
    // 이름표는 몸통이 아니라 root 에 붙여 뒤뚱거림에 흔들리지 않게
    rig.root.add(tag);

    const avatar: DuckAvatar = {
        root: rig.root,
        anim: PLAYER_ANIM.IDLE,
        speed: 0,
        update(delta, time) {
            animator.update(avatar.anim, avatar.speed, delta, time);
        },
        dispose() {
            rig.root.removeFromParent();
            // 공유 도형·재질은 남겨 두고 이 오리만의 이름표 텍스처만 해제
            disposeNameTag(tag);
        },
    };
    return avatar;
}
