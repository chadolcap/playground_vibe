---
name: 3d-modeling
description: 놀이동산 프로젝트의 3D 모델 제작 절차. 캐릭터 시트(2D 그림)를 3D 캐릭터로 만들기, 놀이기구·건물·소품 모델링, Blender MCP 사용, GLB 내보내기와 게임 적용이 필요할 때 사용한다. "3d 모델", "모델링", "blender", "glb", "캐릭터 시트", "놀이기구 디자인" 요청에 반드시 이 스킬을 따른다.
---

# 3D 모델링 절차

사용자는 3D 툴을 다루지 않는다. Claude가 만들고 보여 주며, 사용자는 시안을 고르고 피드백한다.
선택이 필요하면 AskUserQuestion으로 묻는다.

## 0. 반드시 지킬 제약

- **외부 생성은 MCP for Blender Premium으로만**: 회사 보안 승인과 Premium(Pro) 활성화가 끝났다. `generate_3d`는 Premium 생성기(Rodin·Tripo·Meshy·Hunyuan3D)로만 쓰고, 다른 웹사이트·API로 이미지를 보내지 않는다.
  - 월 생성 횟수: 고품질 8회·표준 25회(매월 17일 초기화). 생성 전 `premium_request("GET", "/status")`로 남은 횟수를 확인하고, 고품질은 사용자 확인 후 쓴다.
  - 생성기를 쓸지, 2절의 로컬 파이프라인으로 만들지는 AskUserQuestion으로 고르게 한다.
- 원본 그림(캐릭터 시트 등)은 수정하지 않는다. 결과물은 별도 폴더에 저장한다.
- Blender 작업은 bpy 스크립트로 PC 안에서만 처리한다. 스크립트는 `scripts/`, 파일당 500줄 이하.

## 1. 요청 종류 판단

| 대상 | 방식 | 이유 |
|---|---|---|
| 캐릭터 (2D 시트 있음) | 2A Premium 생성 (횟수 없으면 2B 로컬) | 생성 품질이 로컬 로프팅보다 훨씬 높음 |
| 경로를 따라가는 것 (레일·물길·지지대·체인) | **코드로 생성** (3절) | 경로가 하나의 원본이어야 좌표가 어긋나지 않음 |
| 경로와 무관한 단독 물체 (승강장·게이트·간판·차체) | Blender 스크립트 → GLB (4절) | 형태 디테일이 필요하고 위치만 맞추면 됨 |
| 반복 부재가 많은 구조 (목조 트러스 등) | 코드 `InstancedMesh` | 수천 개를 draw call 1번으로 |

## 2A. 캐릭터 — Premium 생성 (기본)

1. **생성**: 분할된 `front.png` 한 장으로 `generate_3d(image=..., provider="hunyuan3d", quality="standard")` (표준은 Meshy·Hunyuan3D만 이미지 가능). 1~3분 걸리면 `job` 핸들로 이어서 기다린다(새로 요청하면 횟수 차감).
2. **확인**: `look(angles)`로 정면이 어느 축인지 본다(Hunyuan3D 결과는 +X를 봄 → `FACE_ROT=-90`).
3. **부위 경계 측정**: 높이별 X 구간(좌우 다리가 **완전히** 갈라진 높이 = `LEG_Z`)과, 팔이 몸통에 붙은 구간의 두께 분포(겨드랑이·어깨에서 두께가 꺾이는 x = `ARM_CUT`)를 numpy 로 잰다. 묶음 머리는 머리 폭 바깥 x 구간과 머리끈 높이를 잰다.
4. **게임 리그(스킨 메시 + 뼈대)**: `scripts/generated_to_game.py` 를 전역 g(`OBJ`·`NAME`·`OUT`·`GAME_GLB`·`FACE_ROT`·`LEG_Z`·`KNEE_Z`·`ARM_CUT`·`ARM_MAX_X`·`SHOULDER_Z`·`HAIR`)로 exec
   - 겹친 정점 병합 → 1.2만 삼각형 감축 → 법선 정리 → 새 UV(겹친 면 재펼침) + 고폴리 색 베이크 → 정점 가중치(경계를 `BLEND` 폭으로 섞음) → 뼈대 → 게임 크기(1.55)로 GLB
   - 뼈: `root → body(arm_*, hair_*), leg_* → knee_* → foot_*`. 모든 뼈가 위(+Z)를 향하고 roll 0 → glTF 에서 뼈 기본 회전이 0 이라 게임 코드가 축 그대로 회전
   - 발목 뼈 `foot_*` 는 `generated_to_game.py` 뒤에 `scripts/add_ankle_bones.py`(전역 `NAME`·`BLEND_FILE`·`GAME_GLB`·`ANKLE_Z`)로 추가한다 — 원본 .blend 는 읽기만 하고 발목 아래 무릎 가중치만 옮김. `ANKLE_Z` = 신발 앞뒤 폭이 줄어드는 높이(게임 크기, 남 0.09·여 0.085). 게임 코드가 발목을 다리·무릎 반대로 돌려 발바닥을 평평하게 유지하고 디딤발을 땅에 붙임
   - 묶음 머리: `HAIR` 에 `{"name", "side", "x_in", "x_full", "z_top", "z_full"}` (양갈래 = `hair_left`·`hair_right`, 포니테일 = `hair`). 회전 중심은 머리끈 아래 머리카락 중심으로 자동
   - 머리카락이 어깨까지 내려오면 `ARM_CUT` 상한을 어깨 높이로 낮추고 `ARM_MAX_X` 를 손 끝 |x| 보다 조금 크게 둔다. 가로 원점은 발 기준이라 한쪽으로 뻗은 머리가 있어도 맞음.
   - 저장해 둔 원본으로 다시 만들 때: `bpy.data.libraries.load` 로 `<이름>_hy` 오브젝트만 불러오고, 저장 전에 `bpy.data.libraries` 를 지운다(불러온 파일을 덮어쓸 수 없음). 생성 횟수는 쓰지 않음.
   - 휴머노이드 리그: `humanoid_rig.py`(관절 J) → (손가락이 떨어진 메시면) `finger_bones.py`(GAPS = 고폴리 손가락 구간 w 분포의 골짜기) → `humanoid_actions.py`(SIT_DROP·CHAIR_DROP 은 엉덩이 최저점이 원점 −0.1 이 되도록 변형 메시로 보정, 내보내기는 `humanoid_export.py`). 손·소매가 떨어진 덩어리인 생성 메시(Tripo·Meshy)에는 `arm_islands.py` 를 쓰지 않음
   - 손가락이 붙어 나온 메시(Tripo 등)는 같은 그림으로 Meshy standard 를 한 번 더 만들어 `transplant_hands.py`(소매 끝 CUFF_Z 평면으로 자르고 손목 단면 중심·팔 방향을 맞춰 손 이식) 후 generated_to_game 부터 다시. 손가락 경계 GAPS·THUMB 는 이식한 고해상도 손을 hand 뼈 좌표계로 옮겨 w 분포 골짜기로 잼(좌우 따로), 엄지가 손 방향으로 누운 모델은 FINGER_SPREAD 의 thumb 를 줄임
   - Premium 의 Meshy 는 standard 만 지원(high 는 Hunyuan3D·Tripo·Rodin), Meshy 결과는 이미 정면 −Y·고폴리(약 80만 면) → TRI_TARGET 2만
   - 새 캐릭터를 게임에 넣을 때는 `client/public/models/<이름>.glb` 로 내보내고 `duckModel.ts` 의 `HUMAN_MODEL_URLS` **끝에** 이름을 추가한다(이름·색 해시로 배정, 순서 변경 금지).
   - 클라이언트: `SkeletonUtils.clone` 으로 복제, 엉덩이 높이 = `leg_left` 뼈 위치, 무릎·머리 뼈는 있으면 사용. 걷기 동작은 `duckAnimation.ts` 의 `updateHuman`.
   - 결과는 `image/제작/캐릭터/<이름>_v<번호>/` (blend·albedo·parts GLB), 게임 GLB는 `client/public/models/`
5. **검증**
   - Blender: 포즈 뼈를 돌려(다리 ±0.45, 뒷다리 무릎 0.6, 팔, 머리) 4방향 전신과 엉덩이·무릎 확대. 확대할 때 크기 0 인 empty 를 대상으로 잡으면 보이는 깊이가 좁아 메시가 잘려 보이므로 메시를 대상으로 하고 `distance` 로 조절
   - 게임: `__park_world.scene` 의 SkinnedMesh 수·키(1.55)·발바닥(0), 걷는 동안 뼈 회전값 표본, 콘솔 오류
   - 확대에서 선·금이 보이면: solid 에도 보이면 형태(정점 병합 누락), material 에만 보이면 베이크(광선 거리 `BAKE_EXTRUSION`)
   - 경계가 픽셀 계단 모양인 다른 색 얼룩 = UV 겹침(다른 부위 색이 덮어씀). 의심되면 맞은 면의 UV 를 텍스처에서 직접 읽어 확인한다(추측으로 광선 거리·법선을 바꾸지 말 것).

## 2B. 캐릭터 — 로컬 파이프라인 (생성 횟수가 없을 때)

1. **분할**: 고정 중앙선이 아니라 줄마다 흰 여백(밝기 0.92 미만=잉크)의 최장 빈 구간 중앙에서 자른다 → `image/제작/캐릭터/<이름>/` 에 `front`·`back`·`side_left`·`side_right`.png. 잘린 곳이 없는지 모두 열어 확인한다.
   - 시트 배치: 좌상=side_right, 우상=side_left, 좌하=front, 우하=back (캐릭터 기준 이름)
2. **3D 생성**: Blender에서 같은 전역으로 두 스크립트를 순서대로 exec 한다.
   ```python
   g = {"__name__": "__main__", "SRC": r"<분할 폴더>", "NAME": "<이름>", "GAME_GLB": r"<게임 GLB 경로>"}
   exec(open(r"D:\work\study\playground_vibe\scripts\sheet_to_3d.py", encoding="utf-8").read(), g)
   exec(open(r"D:\work\study\playground_vibe\scripts\sheet_to_3d_export.py", encoding="utf-8").read(), g)
   ```
   - `sheet_to_3d.py`: 실루엣 단면 로프팅 + 4방향 투영 텍스처, 팔 가림 마스크, 머리 볼록 껍질, 얼굴 투영 배율
   - `sheet_to_3d_export.py`: 베이크 → 약 1만 삼각형 → 부위 분리 리그 GLB
3. **검증**: `look`으로 정면·좌우·후면·3/4 각도와 머리 확대를 찍어 원본과 비교한다. 확인 촬영 때 숨길 물체는 `hide_render`로 숨긴다(`hide_set`은 반영 안 됨).
4. **게임 적용**: 이 방식의 부위 분리 리그는 지금 클라이언트(스킨 메시·게임 크기 1.55 그대로 사용)와 맞지 않는다. 베이크된 메시(`<이름>_baked`)를 키 1.0 으로 정규화한 뒤 2A 의 `generated_to_game.py` 에 `OBJ` 로 넘겨 스킨 리그로 내보낸다.
5. **알려진 한계** (시작 전에 사용자에게 알린다)
   - 실루엣 방식이라 코·귀·옷 주름 같은 입체는 표현하지 못한다.
   - 옆으로 뻗은 머리(양갈래·포니테일)는 머리카락을 별도 파트로 보강해야 한다.
   - 시트의 시점 간 그림이 서로 다르면 텍스처가 섞인다.

## 3. 놀이기구 (경로 기반)

원칙: **경로(`trackDesign`·`buildPathFrames`)는 코드가 유일한 원본**이다. 열차 운행, 레일, 지지대는 모두 이 경로에서 생성한다.

1. **방향 정하기**: 원하는 느낌의 시안 스크린샷 2~3개를 만들어 사용자에게 고르게 한다. 사용자에게 참고 사진을 요청하면 다시 작업하는 일이 줄어든다.
2. **경로 확정**: 레일 모양·높이를 먼저 고정하고 `npx tsx`로 속도·G·감속을 검증한다(`ridePhysics.ts` 규칙은 CLAUDE.md 참고).
3. **경로 위 디테일**: 레일·침목·트러스·체인을 코드에서 강화한다. 반복 부재는 `InstancedMesh`, 재질은 `getMaterial`(공용 툰 재질)을 쓴다.
   - 지지대가 열차 통과 공간(클리어런스)을 뚫지 않게 경로 기준으로 막는다. 회전·뱅크 구간을 특히 확인한다.
4. **단독 건물이 필요하면** 4절로 만들고, 배치 좌표는 코드에 둔다.
5. **게임 안 검증**: 여러 각도와 탑승 시점의 스크린샷, `stats.frame_ms` 측정.

## 4. 단독 물체 (Blender → GLB)

1. 필요하면 경로를 JSON(positions·tangents·ups)으로 내보내 Blender에 곡선으로 불러온다. 건물이 레일과 겹치지 않는지 확인하는 데만 쓴다.
2. bpy 스크립트로 모델링한다. 셰이더 노드는 이름 대신 type으로 찾고, enum 값은 하드코딩하지 않는다.
3. 공원과 스타일을 맞춘다. 둥근 툰 형태와 단색 위주로 만들고, 디테일은 형태(부재 수·굵기)로 더한다.
4. 내보내기 규칙: 원점=바닥 중심, 정면 glTF +Z, 단위 m, 색 속성(`color_attributes`) 제거, 면 수 최소화. 내보낸 GLB 는 `blender --background --python scripts/compress_glb.py -- <입력> <출력>` 으로 Draco 압축(게임은 `createGltfLoader()` 로만 불러옴)
5. `look`으로 확인하고, 게임에 배치해서 스크린샷과 `frame_ms`를 확인한다.

## 5. 보고

- 결과 스크린샷 비교, 원본 대비 차이, 남은 한계, 바뀐 파일을 알린다.
- 클라이언트 코드가 바뀌었으면 `cd amusemen_park/client && npm run build` 를 실행하고 결과를 보고한다. GLB만 교체했으면 브라우저 새로고침을 안내한다.
