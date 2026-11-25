// 휴머노이드 모델의 Blender Action 클립 재생 — 동작 상태(anim)·이동 속도에 맞춰 클립 비중을 부드럽게 바꿈
// 클립: idle·walk·run(반복), jump·sit·stand_up(한 번), wave·eat(반복), sit_cheer·hold(정지 자세) — scripts/humanoid_actions.py
// 의자 앉기를 따로 가진 모델: 기구 좌석 = sit·stand_up_seat(의자), 바닥 = sit_ground·stand_up(다리 뻗기) — 없으면 sit·stand_up 하나로
// 걷기·달리기는 재생 위치를 이동 거리로 직접 정해 디딤발이 땅에서 미끄러지지 않게 함
import * as THREE from "three";
import { MOVE_RULE, PLAYER_ANIM, type PlayerAnim } from "@shared";
import type { DuckAnimator } from "./duckAnimation";
import type { DuckRig } from "./duckModel";

// 한 주기(두 걸음) 동안 몸이 나아가는 거리(m) — Blender 에서 프레임마다 낮은 발이 뒤로 가는 거리를 평균 낸 값
// (humanoid_actions.py 의 걷기·달리기 자세를 바꾸면 다시 잼)
// 모델 GLB 노드 extras(walk_stride·run_stride)가 있으면 그 값 — 다리 길이가 다른 모델
const WALK_STRIDE = 0.47;
const RUN_STRIDE = 0.68;
// 초당 최대 주기 — 이보다 빠르면 다리를 정신없이 움직이는 대신 발이 조금 미끄러짐
const MAX_WALK_CYCLES = 4;
const MAX_RUN_CYCLES = 5.4;
// 클립 비중이 목표로 바뀌는 빠르기 (값이 클수록 빨리 전환)
const FADE_RATE = 9;
// 이보다 작은 비중은 꺼서 계산을 아낌
const WEIGHT_EPSILON = 0.002;
// 간식을 든 팔 자세(hold 클립)를 덧씌우는 오른팔 뼈
// (손가락 뼈가 있는 모델은 손가락을 오므려 간식을 쥠)
const HOLD_BONES = ["shoulder_right", "upper_arm_right", "forearm_right", "hand_right",
    "thumb_right", "index_right", "middle_right", "ring_right", "pinky_right"];
// 한 번만 재생하고 마지막 자세에서 멈추는 클립
const ONE_SHOT = new Set(["jump", "sit", "stand_up", "sit_ground", "stand_up_seat"]);
// 묶음 머리(hair_*) 흔들림 — 클립에는 머리 뼈 움직임이 없어 걷기 주기에 맞춰 덧씌움 (라디안)
// 머리 뼈 로컬 축: x = 앞뒤(+ 면 끝이 앞으로), z = 좌우
// 원래 머리 위치를 중심으로 위아래(z, 양갈래는 좌우 대칭이라 두 갈래가 함께 들썩임)·앞뒤(x)로 조금씩만 오감
const HAIR_BOB = 0.06;
const HAIR_SWING = 0.06;

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

// hold 클립의 첫 프레임 회전값 (오른팔 뼈마다)
function readHoldPose(clips: readonly THREE.AnimationClip[]): Map<string, THREE.Quaternion> {
    const pose = new Map<string, THREE.Quaternion>();
    const hold = clips.find((clip) => clip.name === "hold");
    for (const track of hold?.tracks ?? []) {
        const [bone, property] = track.name.split(".");
        if (property === "quaternion" && HOLD_BONES.includes(bone)) {
            pose.set(bone, new THREE.Quaternion().fromArray(track.values, 0));
        }
    }
    return pose;
}

export function createClipAnimator(rig: DuckRig): DuckAnimator {
    const model = rig.model ?? rig.root;
    const mixer = new THREE.AnimationMixer(model);
    const actions = new Map<string, THREE.AnimationAction>();
    const weights = new Map<string, number>();
    for (const clip of rig.clips) {
        if (clip.name === "hold" || clip.name === "a_pose") {
            continue;
        }
        const action = mixer.clipAction(clip);
        if (ONE_SHOT.has(clip.name)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
        }
        // 걷기·달리기는 재생 위치를 직접 정함
        if (clip.name === "walk" || clip.name === "run") {
            action.timeScale = 0;
        }
        action.setEffectiveWeight(0);
        actions.set(clip.name, action);
        weights.set(clip.name, 0);
    }
    const hold_pose = readHoldPose(rig.clips);
    let walk_stride = WALK_STRIDE;
    let run_stride = RUN_STRIDE;
    model.traverse((node) => {
        if (typeof node.userData.walk_stride === "number" && typeof node.userData.run_stride === "number") {
            walk_stride = node.userData.walk_stride;
            run_stride = node.userData.run_stride;
        }
    });
    // 바닥 앉기·의자에서 일어서기 클립 (없으면 sit·stand_up 으로)
    const sit_ground_clip = actions.has("sit_ground") ? "sit_ground" : "sit";
    const stand_up_seat_clip = actions.has("stand_up_seat") ? "stand_up_seat" : "stand_up";
    let stand_up_clip = "stand_up";
    const hold_bones = HOLD_BONES.map((name) => model.getObjectByName(name)).filter((node) => node !== undefined);
    const targets = new Map<string, number>();
    let stride_phase = 0;
    let hold_mix = 0;
    let hair_walk = 0;
    const hair_euler = new THREE.Euler();
    const hair_turn = new THREE.Quaternion();
    // 머리 뼈 기본 회전 — 클립에 머리 트랙이 없으므로 매 프레임 여기서부터 흔들림을 적용 (누적되면 머리가 돌아 올라감)
    const hair_rest = rig.hair.map((hair) => hair.quaternion.clone());
    const idle_offset = Math.random() * 10;
    let previous: PlayerAnim | null = null;
    // 앉았다가 일어서는 중 (stand_up 클립이 끝날 때까지)
    let standing_up = false;

    function restart(name: string): void {
        const action = actions.get(name);
        action?.reset().play();
    }

    function setTargets(anim: PlayerAnim, speed: number, excitement: number): number {
        targets.clear();
        if (standing_up) {
            targets.set(stand_up_clip, 1);
            return 0;
        }
        if (anim === PLAYER_ANIM.WALK) {
            // 걷기 최대 속도를 넘으면 달리기로 섞음
            const run = smoothstep(MOVE_RULE.MAX_SPEED * 1.05, MOVE_RULE.RUN_SPEED * 0.85, speed);
            targets.set("walk", 1 - run);
            targets.set("run", run);
            return run;
        }
        if (anim === PLAYER_ANIM.SIT || anim === PLAYER_ANIM.SIT_GROUND) {
            // 스릴 기구에서 신나면 만세 자세로
            if (anim === PLAYER_ANIM.SIT_GROUND) {
                targets.set(sit_ground_clip, 1);
                return 0;
            }
            const cheer = THREE.MathUtils.clamp(excitement, 0, 1);
            targets.set("sit", 1 - cheer);
            targets.set("sit_cheer", cheer);
            return 0;
        }
        const clip = anim === PLAYER_ANIM.JUMP ? "jump" : anim === PLAYER_ANIM.WAVE ? "wave" : anim === PLAYER_ANIM.EAT ? "eat" : "idle";
        targets.set(actions.has(clip) ? clip : "idle", 1);
        return 0;
    }

    return {
        update(anim, speed, delta, time, excitement = 0, holding = false) {
            const is_sit = anim === PLAYER_ANIM.SIT || anim === PLAYER_ANIM.SIT_GROUND;
            const was_sit = previous === PLAYER_ANIM.SIT || previous === PLAYER_ANIM.SIT_GROUND;
            if (anim !== previous) {
                // 앉았다가 그냥 서 있게 될 때만 일어서기 동작 (걸어 나가거나 인사·점프하면 바로 그 동작으로 섞음)
                // 기구 좌석에서 일어서면 의자에서 일어서기, 바닥에서는 다리를 당겨 일어서기
                stand_up_clip = previous === PLAYER_ANIM.SIT ? stand_up_seat_clip : "stand_up";
                standing_up = was_sit && anim === PLAYER_ANIM.IDLE && actions.has(stand_up_clip);
                if (standing_up) {
                    restart(stand_up_clip);
                }
                if (is_sit && !was_sit) {
                    restart(anim === PLAYER_ANIM.SIT_GROUND ? sit_ground_clip : "sit");
                } else if (anim === PLAYER_ANIM.JUMP) {
                    restart("jump");
                } else if (anim === PLAYER_ANIM.WAVE || anim === PLAYER_ANIM.EAT) {
                    restart(anim);
                }
                previous = anim;
            }
            const stand_up = actions.get(stand_up_clip);
            if (standing_up && stand_up !== undefined && stand_up.time >= stand_up.getClip().duration) {
                standing_up = false;
            }
            const run = setTargets(anim, speed, excitement);

            // 걷기·달리기: 이동 거리만큼 주기를 진행 (보폭은 걷기↔달리기 비중으로 섞음)
            const stride = THREE.MathUtils.lerp(walk_stride, run_stride, run);
            const cycles = Math.min(speed / stride, THREE.MathUtils.lerp(MAX_WALK_CYCLES, MAX_RUN_CYCLES, run));
            stride_phase = (stride_phase + cycles * delta) % 1;
            for (const name of ["walk", "run"]) {
                const action = actions.get(name);
                if (action !== undefined) {
                    action.time = stride_phase * action.getClip().duration;
                }
            }

            const ratio = 1 - Math.exp(-FADE_RATE * delta);
            for (const [name, action] of actions) {
                const target = targets.get(name) ?? 0;
                let weight = THREE.MathUtils.lerp(weights.get(name) ?? 0, target, ratio);
                if (target === 0 && weight < WEIGHT_EPSILON) {
                    weight = 0;
                }
                weights.set(name, weight);
                if (weight > 0 && !action.isScheduled()) {
                    action.play();
                }
                action.enabled = weight > 0;
                action.setEffectiveWeight(weight);
            }
            mixer.update(delta);

            // 간식을 들면 오른팔을 들고 있는 자세로 (인사·먹기·일어서기 중에는 클립 그대로)
            const hold_target = holding && anim !== PLAYER_ANIM.WAVE && anim !== PLAYER_ANIM.EAT && !standing_up ? 1 : 0;
            hold_mix = THREE.MathUtils.lerp(hold_mix, hold_target, ratio);
            if (hold_mix > WEIGHT_EPSILON) {
                for (const bone of hold_bones) {
                    const pose = hold_pose.get(bone.name);
                    if (pose !== undefined) {
                        bone.quaternion.slerp(pose, hold_mix);
                    }
                }
            }

            // 묶음 머리: 걸음마다 위아래로 들썩이고 앞뒤로 살짝 흔들림, 서 있을 때는 살짝 살랑임
            if (rig.hair.length > 0) {
                const walk_target = anim === PLAYER_ANIM.WALK ? Math.min(speed / MOVE_RULE.MAX_SPEED, 1.5) : 0;
                hair_walk = THREE.MathUtils.lerp(hair_walk, walk_target, ratio);
                const angle = stride_phase * Math.PI * 2;
                const bob = Math.sin(angle * 2) * HAIR_BOB * hair_walk + Math.sin(time * 1.7 + idle_offset) * 0.02 + Math.sin(time * 9) * 0.03 * excitement;
                const swing = Math.sin(angle - 0.6) * HAIR_SWING * hair_walk + Math.sin(time * 1.3 + idle_offset) * 0.015;
                rig.hair.forEach((hair, index) => {
                    const mirror = hair.name === "hair_right" ? -1 : 1;
                    hair_turn.setFromEuler(hair_euler.set(swing, 0, bob * mirror));
                    hair.quaternion.copy(hair_rest[index]).multiply(hair_turn);
                });
            }
        },
    };
}
