# 휴머노이드 뼈대(humanoid_rig.py 결과)에 동작 Action 만들기 — 동작마다 별도 Action (glTF 애니메이션 클립 이름 = Action 이름)
# Blender 에서 전역 g 로 exec: g = {"__name__": "__main__", "RIG": "man_1_rig", "GAME_GLB": r"<게임 GLB 경로>"(없으면 내보내지 않음)}
#   선택: SIT_DROP(바닥 앉기)·CHAIR_DROP(의자 앉기, 주면 기구 좌석용 의자 클립을 따로 만듦) — 엉덩이 바닥이 원점 -0.1 에 닿는 값, ARM_Z_OFFSET
# 앉기·일어서기·점프 웅크림은 발목을 고정한 2관절 IK(legIK) — 엉덩이를 먼저 뒤로 빼며 내려앉음(무릎이 앞으로 나가지 않음)
# 각도 규칙(도, 뼈 로컬 오일러 XYZ) — 모두 "왼쪽 기준"으로 적고 *_right 뼈는 y·z 부호를 뒤집어 좌우 대칭으로 넣음
#   x: 앞으로 들기·굽히기 (팔·허벅지·몸통·고개 +x = 앞, 팔꿈치 +x = 굽힘, 무릎 -x = 굽힘, 발 +x = 발끝 위, 턱 +x = 벌림)
#   z: 옆으로 들기 (팔 +z = 바깥으로), y: 비틀기
# hips 위치 "hips_loc": (좌우, 위아래, 앞(+)/뒤) m — 점프 높이·앉을 때 내려가는 높이
# 클립 길이·보폭은 게임 코드(client/src/character/humanClips.ts)의 상수와 맞출 것
import bpy, math, os
from mathutils import Euler

G = globals()
RIG = G["RIG"]
FPS = 30
# 앉으면 엉덩이(hips)가 내려가는 높이 — 게임은 좌석 면(바닥)보다 DUCK_SEAT_OFFSET(0.1) 위에 원점을 둠
SIT_DROP = G.get("SIT_DROP", 0.278)
# 앉을 때 골반을 뒤로 기울이는 각도(도, 음수 = 뒤로) — 앉는 뼈로 바닥을 딛음
SIT_TILT = G.get("SIT_TILT", -10)
# 앉을 때 뻗은 다리(허벅지·정강이 뼈)의 바닥 기준 기울기(도, 0 = 수평) — 허벅지 뒷면이 바닥에 붙는 값
LEG_RAISE = G.get("LEG_RAISE", 0)
# 앉을 때 발 뼈의 바닥 기준 기울기(도) — 발끝이 위를 봄
FOOT_UP = G.get("FOOT_UP", 65)
# 기본 자세의 팔 벌림 보정(도) — 메시 기본 자세가 A-Pose(수직에서 27°)면 -17 (포즈 각도는 약 10° 기준)
ARM_Z_OFFSET = G.get("ARM_Z_OFFSET", -17)
# 의자 앉기(기구 좌석)에서 엉덩이가 내려가는 높이 — None 이면 바닥 앉기(sit_ground)·의자 앉기 클립을 따로 만들지 않음
CHAIR_DROP = G.get("CHAIR_DROP")


def legFlat(pose, side, thigh, shin, toe=0.0):
    # 허벅지·정강이 각도를 넣고 발바닥이 땅과 평평하도록 발목을 되돌림 (toe: 발끝을 더 드는 각도)
    pose[f"thigh_{side}"] = (thigh, 0, 0)
    pose[f"shin_{side}"] = (shin, 0, 0)
    pose[f"foot_{side}"] = (-(thigh + shin) + toe, 0, 0)


def both(pose, bone, value):
    pose[f"{bone}_left"] = value
    pose[f"{bone}_right"] = value


def armRest(pose, x=0.0, z=4.0, elbow=8.0):
    for side in ("left", "right"):
        pose[f"upper_arm_{side}"] = (x, 0, z)
        pose[f"forearm_{side}"] = (elbow, 0, 0)


def standPose(breath=0.0):
    pose = {"chest": (breath * 1.5, 0, 0), "spine": (breath * 0.5, 0, 0), "head": (-breath * 1.2, 0, 0)}
    armRest(pose, z=4 + breath * 1.5)
    both(pose, "shoulder", (0, 0, breath * 1.0))
    pose["hips_loc"] = (0, 0, 0)
    return pose


def aPose():
    pose = {"hips_loc": (0, 0, 0)}
    armRest(pose, z=35, elbow=0)
    return pose


def walkPose(phase, run=False):
    # phase 0~1: 0 = 왼발이 앞에서 땅에 닿음, 0.5 = 오른발이 앞에서 닿음
    pose = {}
    lean = 9 if run else 3
    swing_leg = 58 if run else 40
    back_leg = 48 if run else 34
    lift = 110 if run else 60
    arm = 38 if run else 22
    elbow = 75 if run else 18
    # 디딤 구간 비율 (나머지는 발을 들어 앞으로 옮기는 구간)
    stance = 0.5 if run else 0.6
    front = math.sin(math.radians(swing_leg))
    back = math.sin(math.radians(back_leg))
    for side, offset in (("left", 0.0), ("right", 0.5)):
        p = (phase + offset) % 1.0
        c = math.cos(p * 2 * math.pi)
        if p < stance:
            # 디딤: 발이 몸 기준으로 일정한 속도로 뒤로 감 (발 앞뒤 위치가 직선 → 게임에서 미끄러지지 않음)
            u = p / stance
            reach = front + (-back - front) * u
            lifted = 0.0
        else:
            # 발 옮기기: 부드럽게 앞으로 가져오며 무릎을 굽혀 발을 듦
            u = (p - stance) / (1 - stance)
            eased = u * u * (3 - 2 * u)
            reach = -back + (front + back) * eased
            lifted = math.sin(u * math.pi)
        thigh = math.degrees(math.asin(reach))
        shin = -(6 + lift * lifted)
        # 디딜 때 뒤꿈치부터 닿도록 발끝을 살짝 듦
        toe = (6 if run else 12) * max(0.0, 1 - u * 4) if p < stance else 0.0
        legFlat(pose, side, thigh, shin, toe)
        # 팔은 같은 쪽 다리와 반대로
        pose[f"upper_arm_{side}"] = (-c * arm, 0, 6 if run else 4)
        pose[f"forearm_{side}"] = (elbow + (max(0.0, -c) * 15 if run else 0), 0, 0)
    c0 = math.cos(phase * 2 * math.pi)
    # 엉덩이 높이는 groundFeet 가 낮은 발을 땅에 붙여 정함 (다리를 벌리면 내려가 걷기 출렁임이 생김)
    pose["hips_loc"] = (0, 0, 0)
    pose["hips"] = (lean * 0.3, -c0 * (8 if run else 6), 0)
    pose["spine"] = (lean * 0.4, c0 * (5 if run else 4), 0)
    pose["chest"] = (lean * 0.3, c0 * (4 if run else 3), 0)
    pose["head"] = (-lean * 0.6, 0, 0)
    return pose


def restElevation(bone_name):
    # 기본 자세에서 뼈가 앞(-Y) 수평선 기준으로 올라간 각도(도) — 아래를 향한 다리 뼈는 약 -90
    bone = bpy.data.objects[RIG].data.bones[bone_name]
    direction = bone.tail_local - bone.head_local
    return math.degrees(math.atan2(direction.z, -direction.y))


def sagittal(point):
    # 뼈대 좌표(x, y, z) → 옆에서 본 평면 (앞(+) = Blender -Y, 위)
    return (-point[1], point[2])


def legChain():
    # 왼쪽 다리 관절의 기본 위치(옆 평면)와 길이 — hips 뼈 머리 기준 회전에 쓸 값
    bones = bpy.data.objects[RIG].data.bones
    hip, knee = sagittal(bones["thigh_left"].head_local), sagittal(bones["shin_left"].head_local)
    ankle, hips = sagittal(bones["foot_left"].head_local), sagittal(bones["hips"].head_local)
    return {"hip": hip, "ankle": ankle, "hips": hips,
            "thigh": math.dist(hip, knee), "shin": math.dist(knee, ankle)}


def legIK(pose, hips_lean, back, drop, foot=(0.0, 0.0), toe=0.0):
    # 엉덩이(hips)를 뒤로 back·아래로 drop 옮기고 상체를 hips_lean(도, + = 앞으로 숙임) 기울였을 때,
    # 발목을 바닥 위 기본 자리(+foot 앞·위 이동)에 고정하도록 허벅지·정강이·발 각도를 역산 (무릎은 앞으로 굽음)
    # 각 다리 뼈의 바닥 기준 기울기 변화 = 사슬 회전 합 - hips_lean (hips 를 앞으로 숙이면 다리는 뒤로 돌아감)
    c = legChain()
    lean = math.radians(hips_lean)
    off = (c["hip"][0] - c["hips"][0], c["hip"][1] - c["hips"][1])
    # hips 뼈 머리를 중심으로 앞으로 숙이면 아래쪽 관절은 뒤로 감
    hip = (c["hips"][0] - back + off[0] * math.cos(lean) + off[1] * math.sin(lean),
           c["hips"][1] - drop - off[0] * math.sin(lean) + off[1] * math.cos(lean))
    ankle = (c["ankle"][0] + foot[0], c["ankle"][1] + foot[1])
    l1, l2 = c["thigh"], c["shin"]
    dist = min(max(math.dist(hip, ankle), abs(l1 - l2) + 1e-4), l1 + l2 - 1e-4)
    to_ankle = math.atan2(ankle[1] - hip[1], ankle[0] - hip[0])
    bend = math.acos((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))
    thigh_elev = math.degrees(to_ankle + bend)
    knee = (hip[0] + l1 * math.cos(to_ankle + bend), hip[1] + l1 * math.sin(to_ankle + bend))
    shin_elev = math.degrees(math.atan2(ankle[1] - knee[1], ankle[0] - knee[0]))
    thigh = thigh_elev - restElevation("thigh_left") + hips_lean
    shin = (shin_elev - restElevation("shin_left")) - (thigh_elev - restElevation("thigh_left"))
    # 발바닥은 바닥과 평평 (toe 만큼 발끝을 더 듦)
    foot_rot = -(shin_elev - restElevation("shin_left")) + toe
    for side in ("left", "right"):
        pose[f"thigh_{side}"] = (thigh, 0, 0)
        pose[f"shin_{side}"] = (shin, 0, 0)
        pose[f"foot_{side}"] = (foot_rot, 0, 0)
    pose["hips"] = (hips_lean, 0, 0)
    pose["hips_loc"] = (0, -drop, -back)
    return pose


def hingePose(depth, arms_forward=True):
    # 힙 힌지 depth 0~1: 엉덩이를 먼저 뒤로 빼며 내리고, 균형을 잡으려 상체를 앞으로 숙임 (정강이는 거의 수직)
    lean = 38 * depth
    pose = {"spine": (6 * depth, 0, 0), "chest": (4 * depth, 0, 0), "head": (-lean * 0.55, 0, 0)}
    legIK(pose, lean, back=0.13 * depth, drop=0.09 * depth * depth + 0.02 * depth)
    for side in ("left", "right"):
        # 팔을 앞으로 내밀어 균형 (앉을 자리를 더듬듯)
        pose[f"upper_arm_{side}"] = ((32 if arms_forward else 0) * depth, 0, 6)
        pose[f"forearm_{side}"] = (8 + 14 * depth, 0, 0)
    return pose


def chairPose(lap=True):
    # 의자(기구 좌석)에 앉음: 엉덩이와 허벅지 뒷면이 좌석에, 허벅지는 수평, 정강이는 거의 수직으로 내려감
    pose = {"hips_loc": (0, -CHAIR_DROP, 0.0), "hips": (-4, 0, 0), "spine": (3, 0, 0), "chest": (2, 0, 0), "head": (1, 0, 0)}
    thigh = 4 - restElevation("thigh_left") - 4
    shin = (-84 - restElevation("shin_left")) - (4 - restElevation("thigh_left"))
    foot = -(-84 - restElevation("shin_left"))
    for side in ("left", "right"):
        pose[f"thigh_{side}"] = (thigh, 0, 0)
        pose[f"shin_{side}"] = (shin, 0, 0)
        pose[f"foot_{side}"] = (foot, 0, 0)
        # 손은 허벅지 위에 가볍게 올림
        pose[f"upper_arm_{side}"] = (34 if lap else 0, 0, -6 if lap else 12)
        pose[f"forearm_{side}"] = (34 if lap else 6, 0, 0)
    return pose


def sitPose(lap=True):
    # image/제작/캐릭터/man_1/sit.png: 바닥에 앉아 다리를 앞으로 쭉 뻗음 — 엉덩이와 허벅지 뒷면이 바닥에 붙고 발끝은 위로
    # 다리 뼈는 바닥 기준 목표 기울기(앞 수평 = 0°)로 정하고 회전량을 거꾸로 계산
    # (hips 를 뒤로 기울이면(SIT_TILT 음수) 아래를 향한 다리는 그만큼 앞·위로 들리므로 빼 줌)
    pose = {"hips_loc": (0, -SIT_DROP, 0.0), "hips": (SIT_TILT, 0, 0), "spine": (-SIT_TILT * 0.6, 0, 0),
            "chest": (-SIT_TILT * 0.4, 0, 0), "head": (3, 0, 0)}
    thigh = LEG_RAISE - restElevation("thigh_left") + SIT_TILT
    # 무릎은 곧게 (정강이도 허벅지와 같은 기울기)
    shin = LEG_RAISE - restElevation("shin_left") + SIT_TILT - thigh
    # 발은 FOOT_UP 만큼 세워 발끝이 위를 봄
    foot = FOOT_UP - restElevation("foot_left") + SIT_TILT - thigh - shin
    for side in ("left", "right"):
        pose[f"thigh_{side}"] = (thigh, 0, 0)
        pose[f"shin_{side}"] = (shin, 0, 0)
        pose[f"foot_{side}"] = (foot, 0, 0)
        # 손은 허벅지 바깥 위에 올림 (sit.png)
        pose[f"upper_arm_{side}"] = (30 if lap else 0, 0, -10 if lap else 14)
        pose[f"forearm_{side}"] = (8 if lap else 0, 0, 0)
    return pose


def sitCheerPose():
    pose = chairPose(lap=False) if CHAIR_DROP is not None else sitPose(lap=False)
    for side in ("left", "right"):
        pose[f"shoulder_{side}"] = (0, 0, 14)
        pose[f"upper_arm_{side}"] = (18, 0, 120)
        pose[f"forearm_{side}"] = (20, 0, 0)
    pose["head"] = (-8, 0, 0)
    pose["jaw"] = (6, 0, 0)
    return pose


def crouchPose(depth):
    # depth 0~1: 점프 준비 웅크림 — 엉덩이를 뒤로 빼며 내리고 상체를 숙임 (발은 땅에 고정, 팔은 뒤로 젖힘)
    pose = standPose()
    legIK(pose, 30 * depth, back=0.07 * depth, drop=0.085 * depth)
    for side in ("left", "right"):
        pose[f"upper_arm_{side}"] = (-35 * depth, 0, 8)
        pose[f"forearm_{side}"] = (20 * depth + 8, 0, 0)
    pose["spine"] = (8 * depth, 0, 0)
    pose["chest"] = (4 * depth, 0, 0)
    pose["head"] = (-20 * depth, 0, 0)
    return pose


def jumpFrames():
    # 0.9초(27프레임): 웅크림 → 차고 오름 → 공중(다리 접고 만세) → 착지 → 바로 섬
    air = standPose()
    for side in ("left", "right"):
        legFlat(air, side, 40, -70, toe=-10)
        air[f"shoulder_{side}"] = (0, 0, 12)
        air[f"upper_arm_{side}"] = (20, 0, 115)
        air[f"forearm_{side}"] = (15, 0, 0)
    air["head"] = (-8, 0, 0)

    def airAt(height, tuck=1.0):
        pose = dict(air)
        for side in ("left", "right"):
            legFlat(pose, side, 40 * tuck, -70 * tuck, toe=-10 * tuck)
        pose["hips_loc"] = (0, height, 0)
        return pose

    takeoff = standPose()
    for side in ("left", "right"):
        legFlat(takeoff, side, -5, -2, toe=-25)
        takeoff[f"upper_arm_{side}"] = (40, 0, 60)
    takeoff["hips_loc"] = (0, 0.03, 0)
    return [(0, standPose()), (4, crouchPose(1.0)), (7, takeoff), (10, airAt(0.36, 0.6)), (13, airAt(0.6)),
            (16, airAt(0.36, 0.6)), (19, airAt(0.02, 0.2)), (22, crouchPose(0.8)), (27, standPose())]


# 바닥 앉기에서 엉덩이가 놓이는 자리(m, 서 있던 자리보다 뒤) — 엉덩이를 뒤로 빼며 앉으므로 그 자리에 그대로 앉음
GROUND_BACK = G.get("GROUND_BACK", 0.16)
# 게임이 앉은 캐릭터의 원점을 앉는 면보다 띄우는 높이 (client duckModel.ts DUCK_SEAT_OFFSET)
SEAT_OFFSET = 0.1


def groundTuck(lean, drop_ratio=1.0, arms_back=True):
    # 바닥에 엉덩이를 붙이고 무릎을 세운 자세 (발은 서 있던 자리 바닥에) — 바닥 앉기의 중간 자세
    pose = {"spine": (3, 0, 0), "chest": (2, 0, 0), "head": (-lean * 0.4, 0, 0)}
    # 바닥 앉기 중에는 게임이 원점을 바닥보다 SEAT_OFFSET 위에 두므로 발도 그만큼 내려 바닥을 딛게 함
    legIK(pose, lean, back=GROUND_BACK, drop=SIT_DROP * drop_ratio, foot=(0.0, -SEAT_OFFSET))
    for side in ("left", "right"):
        # 손을 엉덩이 옆 뒤쪽 바닥으로 뻗어 몸을 받침
        pose[f"upper_arm_{side}"] = ((-28, 0, 14) if arms_back else (30, 0, 8))
        pose[f"forearm_{side}"] = (10, 0, 0)
    return pose


def sitGroundPose(lap=True):
    # 바닥 앉기 최종 자세(sit.png) — 엉덩이 자리는 앉는 동작과 이어지게 GROUND_BACK 만큼 뒤
    pose = sitPose(lap)
    pose["hips_loc"] = (0, -SIT_DROP, -GROUND_BACK)
    return pose


def sitGroundFrames():
    # 1.1초(33프레임): 엉덩이를 뒤로 빼며 숙임 → 엉덩이부터 바닥에 내려앉음(무릎은 위로 섬) → 다리를 앞으로 뻗음
    return [(0, standPose()), (8, hingePose(0.7)), (15, hingePose(1.0)),
            (22, groundTuck(16, 0.97)), (25, groundTuck(6)), (33, sitGroundPose())]


def standUpGroundFrames():
    # 1.0초(30프레임): 다리를 당겨 무릎을 세움 → 상체를 숙여 무게를 발 위로 → 엉덩이부터 들며 일어섬
    pull = groundTuck(4)
    lean_in = groundTuck(36, arms_back=False)
    lift = hingePose(1.0)
    rise = hingePose(0.5)
    return [(0, sitGroundPose()), (8, pull), (14, lean_in), (20, lift), (25, rise), (30, standPose())]


def sitChairFrames():
    # 0.9초(27프레임): 엉덩이를 뒤로 빼며 숙임 → 엉덩이부터 좌석에 내려앉으며 다리를 앞으로 → 상체를 세움
    seat_lean = chairPose()
    seat_lean.update({"hips": (18, 0, 0), "spine": (8, 0, 0), "head": (-10, 0, 0)})
    # hips 를 숙이면 다리가 뒤로 도므로 허벅지 각도에 더해 다리는 의자 자세 그대로
    for side in ("left", "right"):
        thigh = seat_lean[f"thigh_{side}"]
        seat_lean[f"thigh_{side}"] = (thigh[0] + 22, 0, 0)
    return [(0, standPose()), (8, hingePose(0.7)), (15, hingePose(1.0)), (21, seat_lean), (27, chairPose())]


def standUpChairFrames():
    # 0.8초(24프레임): 상체를 숙여 무게를 앞으로 → 엉덩이부터 들며 일어섬
    lean = chairPose(lap=False)
    lean.update({"hips": (26, 0, 0), "spine": (10, 0, 0), "head": (-14, 0, 0)})
    for side in ("left", "right"):
        thigh = lean[f"thigh_{side}"]
        lean[f"thigh_{side}"] = (thigh[0] + 30, 0, 0)
        lean[f"upper_arm_{side}"] = (30, 0, 8)
    return [(0, chairPose()), (7, lean), (13, hingePose(1.0)), (19, hingePose(0.45)), (24, standPose())]


def standUpFrames():
    # 의자 앉기를 따로 만들지 않는 캐릭터: 바닥 앉기에서 일어서기
    return standUpGroundFrames()


def sitDownFrames():
    # 의자 앉기를 따로 만들지 않는 캐릭터: 바닥 앉기 (게임이 마지막 프레임에서 멈춤)
    return sitGroundFrames()


def waveFrames():
    # 1초(30프레임) 반복: 오른팔을 머리 옆으로 들고 아래팔을 좌우로 두 번 흔듦
    frames = []
    for frame in range(0, 31, 5):
        pose = standPose()
        sway = math.sin(frame / 30 * 4 * math.pi)
        pose["shoulder_right"] = (0, 0, 14)
        pose["upper_arm_right"] = (12, 0, 128)
        # 아래팔을 90° 비틀어 손바닥이 앞을 봄 (비틀지 않으면 정면에서 손 옆면만 보여 얇아 보임)
        pose["forearm_right"] = (16, -90, 28 * sway)
        pose["hand_right"] = (0, 0, 12 * sway)
        pose["upper_arm_left"] = (0, 0, 5)
        pose["head"] = (-3, 0, -5)
        pose["chest"] = (0, 0, -3)
        # 손가락을 부채꼴로 쫙 벌림 (finger_bones.py 로 손가락 뼈를 넣은 모델만, z + = 엄지 쪽) — 흔들 때 살짝 더 벌어짐
        spread = 1.0 + 0.15 * abs(sway)
        for finger, angle in FINGER_SPREAD.items():
            pose[f"{finger}_right"] = (-6, 0, angle * spread)
        frames.append((frame, pose))
    return frames


# 안녕할 때 손가락 벌림 각도(도, 손바닥 면 안에서 + = 엄지 쪽) — 엄지는 크게, 가운데 손가락은 거의 그대로 (캐릭터마다 g 로 바꿀 수 있음)
FINGER_SPREAD = G.get("FINGER_SPREAD", {"thumb": 32, "index": 14, "middle": 2, "ring": -11, "pinky": -24})
# 간식을 쥘 때 손가락 굽힘(도, + = 손바닥 쪽)
FINGER_GRIP = {"thumb": (25, 0, -15), "index": (65, 0, 0), "middle": (70, 0, 0), "ring": (72, 0, 0), "pinky": (70, 0, 0)}


def gripRight(pose):
    for finger, value in FINGER_GRIP.items():
        pose[f"{finger}_right"] = value
    return pose


def holdPose():
    # 간식을 든 오른팔: 팔꿈치를 굽혀 손을 가슴 앞으로 (게임이 오른팔 뼈에만 덧씌움)
    pose = standPose()
    pose["upper_arm_right"] = (22, 0, 6)
    pose["forearm_right"] = (72, 0, 0)
    pose["hand_right"] = (-10, 0, 0)
    return gripRight(pose)


def eatFrames():
    # 1.2초(36프레임) 반복: 오른팔을 입 쪽으로 굽혀 들고, 턱을 오물오물 (한 주기에 두 번 씹음)
    frames = []
    for frame in range(0, 37, 3):
        t = frame / 36
        chew = 0.5 - 0.5 * math.cos(t * 4 * math.pi)
        pose = standPose()
        pose["shoulder_right"] = (6, 0, 6)
        # 손은 가슴 앞, 손에 쥔 간식(길이 약 0.28m)이 거의 수직으로 서서 끝이 입에 닿도록 팔을 굽힘
        # (간식은 손 뼈에 수직으로 쥐므로 아래팔이 수평에 가까워야 섬 — 들기 자세 hold 와 같은 원리)
        pose["upper_arm_right"] = (60, 15, -10)
        pose["forearm_right"] = (65 + 8 * chew, 0, 0)
        pose["hand_right"] = (-20, 0, 0)
        pose["jaw"] = (6.5 * chew, 0, 0)
        pose["head"] = (5 + 2 * chew, 0, 0)
        frames.append((frame, gripRight(pose)))
    return frames


ACTIONS = {
    "a_pose": [(0, aPose()), (1, aPose())],
    "idle": [(0, standPose(0)), (30, standPose(1)), (60, standPose(0))],
    # 걷기·달리기는 매 프레임 키 (키 사이 보간으로 디딤발이 뜨거나 파고들지 않게)
    "walk": [(f, walkPose(f / 24)) for f in range(0, 25)],
    "run": [(f, walkPose(f / 18, run=True)) for f in range(0, 19)],
    "jump": jumpFrames(),
    "sit": sitDownFrames(),
    "sit_cheer": [(0, sitCheerPose()), (1, sitCheerPose())],
    "stand_up": standUpFrames(),
    "wave": waveFrames(),
    "eat": eatFrames(),
    "hold": [(0, holdPose()), (1, holdPose())],
}
if CHAIR_DROP is not None:
    # 기구 좌석 = 의자 앉기(sit·stand_up_seat), 바닥 = 다리 뻗고 앉기(sit_ground·stand_up)
    ACTIONS.update({"sit": sitChairFrames(), "stand_up_seat": standUpChairFrames(),
                    "sit_ground": sitGroundFrames(), "stand_up": standUpGroundFrames()})


def toQuaternion(bone, value):
    x, y, z = value
    # 포즈 각도는 "팔을 거의 내린(수직에서 약 10°) 기본 자세" 기준 — 기본 자세가 A-Pose 처럼 팔을 더 벌린 모델은 그 차이만큼 되돌림
    if bone.startswith("upper_arm"):
        z += ARM_Z_OFFSET
    if bone.endswith("_right"):
        y, z = -y, -z
    return Euler((math.radians(x), math.radians(y), math.radians(z)), "XYZ").to_quaternion()


def buildAction(rig, name, frames):
    old = bpy.data.actions.get(name)
    if old is not None:
        bpy.data.actions.remove(old)
    action = bpy.data.actions.new(name)
    action.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = action
    for frame, pose in frames:
        for pb in rig.pose.bones:
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = toQuaternion(pb.name, pose.get(pb.name, (0, 0, 0)))
            pb.location = (0, 0, 0)
            pb.keyframe_insert("rotation_quaternion", frame=frame)
        hips = rig.pose.bones["hips"]
        # hips 로컬 축: X = 왼쪽(+X), Y = 위, Z = 앞(-Y)
        side, up, forward = pose.get("hips_loc", (0, 0, 0))
        hips.location = (side, up, forward)
        hips.keyframe_insert("location", frame=frame)
    action.frame_range = (frames[0][0], frames[-1][0])
    action.use_frame_range = True
    if name in GROUNDED:
        groundFeet(rig, frames)
    rig.animation_data.action = None
    return action


# 낮은 발을 땅에 붙일 동작 (걷기·달리기 — 다리를 벌리면 발이 들려 공중에 뜬 채 걷게 됨)
GROUNDED = ("walk", "run")


# 후처리·내보내기 함수 (groundFeet·strideOf·exportGame) — 같은 폴더의 humanoid_export.py
SCRIPT_DIR = G.get("SCRIPT_DIR", r"D:\work\study\playground_vibe\scripts")
exec(open(os.path.join(SCRIPT_DIR, "humanoid_export.py"), encoding="utf-8").read(), G)


def main():
    rig = bpy.data.objects[RIG]
    bpy.context.scene.render.fps = FPS
    for name, frames in ACTIONS.items():
        action = buildAction(rig, name, frames)
        print(name, "frames", tuple(action.frame_range))
    for pb in rig.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    if G.get("GAME_GLB"):
        exportGame(rig, G["GAME_GLB"])


if G.get("__name__") == "__main__":
    main()
