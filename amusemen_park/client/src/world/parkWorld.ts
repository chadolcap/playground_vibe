// 3D 월드 — 렌더러·카메라·조명·하늘 + 지형·장식·놀이기구를 묶어 화면에 그림
// 카메라 조작·캐릭터는 바깥(game/playSession.ts)에서 onFrame 으로 연결
import * as THREE from "three";
import { MAP_SIZE, SPAWN_POINT, type RideId } from "@shared";
import { disposeDuckGeometries } from "../character/duckModel";
import { createClouds, createDecor } from "./decor";
import { loadWorldFonts } from "./labels";
import { createRideModels, type RideModel } from "./rides";
import { disposeMaterialCache } from "./rides/common";
import { createTerrain, getPathSegments } from "./terrain";

export interface ParkWorld {
    readonly scene: THREE.Scene;
    readonly camera: THREE.PerspectiveCamera;
    readonly rides: ReadonlyMap<RideId, RideModel>;
    // 3D 화면 캔버스 (카메라 드래그 입력을 받는 면)
    readonly canvas: HTMLCanvasElement;
    // 매 프레임 호출할 함수 등록 (기구 갱신 후, 그리기 전) — 반환 함수로 해제
    onFrame(callback: FrameCallback): () => void;
    // 우측 상단 작은 화면(인셋)에 그릴 두 번째 카메라 — null 이면 인셋을 숨김 (탑승 시점 뷰)
    setInsetCamera(camera: THREE.PerspectiveCamera | null): void;
    // 놀이기구 움직임의 기준 시각(초) — 방 시각을 주면 모든 클라이언트의 기구 자세가 일치, null 이면 로컬 시각
    setRideTimeSource(source: (() => number) | null): void;
    // 성능 점검용: 한 프레임 처리(갱신+그리기 명령) 시간 평균(ms), 마지막 프레임 그리기 호출 수
    readonly stats: { frame_ms: number; draw_calls: number; triangles: number };
    dispose(): void;
}

// time = 누적 초, delta = 프레임 간격 초
export type FrameCallback = (time: number, delta: number) => void;

// 프레임 간격 상한 — 탭 전환 후 돌아왔을 때 기구가 한 번에 멀리 튀지 않게
const MAX_FRAME_DELTA = 0.1;

function isTouchDevice(): boolean {
    return window.matchMedia("(pointer: coarse)").matches;
}

// 인셋 화면 배치 (CSS 픽셀): 우측 상단, 나가기 버튼 아래, 화면 폭의 34% (최소 150, 최대 360), 4:3
const INSET_TOP = 60;
const INSET_MARGIN = 12;

interface InsetRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

function computeInsetRect(view_width: number): InsetRect {
    const width = Math.round(THREE.MathUtils.clamp(view_width * 0.34, 150, 360));
    const height = Math.round(width * 0.75);
    return { left: view_width - width - INSET_MARGIN, top: INSET_TOP, width, height };
}

// 위(진한 하늘색) → 아래(옅은 하늘색) 그라데이션 배경
function createSkyTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 2;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    if (context !== null) {
        // 파스텔 하늘: 위는 맑은 하늘색, 지평선 쪽은 복숭아빛
        const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, "#8fd0f7");
        gradient.addColorStop(0.55, "#c6e8fb");
        gradient.addColorStop(0.85, "#fdeee0");
        gradient.addColorStop(1, "#ffe3cf");
        context.fillStyle = gradient;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function createSun(is_touch: boolean): THREE.DirectionalLight {
    // 따뜻한 오후 햇살 (너무 세지 않게 — 그림자가 진하지 않고 포근하게)
    const sun = new THREE.DirectionalLight("#fff1dc", 1.9);
    sun.position.set(90, 150, 70);
    sun.castShadow = true;
    // 그림자 범위 = 맵 전체
    const half = MAP_SIZE / 2 + 10;
    sun.shadow.camera.left = -half;
    sun.shadow.camera.right = half;
    sun.shadow.camera.top = half;
    sun.shadow.camera.bottom = -half;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 420;
    // 모바일은 그림자 해상도를 낮춰 성능 확보
    const shadow_size = is_touch ? 1024 : 2048;
    sun.shadow.mapSize.set(shadow_size, shadow_size);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    return sun;
}

// 장면의 모든 도형·재질·텍스처 해제 (화면을 떠날 때 GPU 메모리 반환)
function disposeScene(scene: THREE.Scene): void {
    scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
        const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material !== undefined ? [mesh.material] : [];
        for (const material of materials) {
            for (const value of Object.values(material)) {
                if (value instanceof THREE.Texture) {
                    value.dispose();
                }
            }
            material.dispose();
        }
    });
    if (scene.background instanceof THREE.Texture) {
        scene.background.dispose();
    }
}

export async function createParkWorld(container: HTMLElement): Promise<ParkWorld> {
    // 표지판 글자를 POP체로 그리기 위해 글꼴부터 준비
    await loadWorldFonts();

    const is_touch = isTouchDevice();
    const renderer = new THREE.WebGLRenderer({ antialias: !is_touch, powerPreference: "high-performance" });
    // 고해상도 화면에서 픽셀 수가 폭증하지 않도록 상한 (모바일 1.5, PC 2)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, is_touch ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = is_touch ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    // 색이 쨍하지 않고 부드럽게 (밝은 부분이 하얗게 날아가지 않는 중립 톤 매핑)
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.05;
    // 한 프레임에 두 번(본 화면 + 인셋) 그려도 그림자 지도는 한 번만 계산하도록 직접 갱신
    renderer.shadowMap.autoUpdate = false;
    // 프레임 통계를 두 번 그린 것 합계로 보기 위해 직접 초기화
    renderer.info.autoReset = false;
    container.appendChild(renderer.domElement);

    // 인셋 화면 테두리 (그림은 같은 캔버스에 그리고, 테두리·제목만 HTML 로 겹침)
    const inset_frame = document.createElement("div");
    inset_frame.className = "inset-frame";
    inset_frame.hidden = true;
    container.appendChild(inset_frame);
    let inset_camera: THREE.PerspectiveCamera | null = null;

    const scene = new THREE.Scene();
    scene.background = createSkyTexture();
    scene.fog = new THREE.Fog("#f3ece4", 150, 380);
    // 하늘빛·풀빛 반사광을 넉넉히 → 그늘도 밝은 파스텔 톤
    scene.add(new THREE.HemisphereLight("#e6f4ff", "#c4e6a8", 1.7));
    const sun = createSun(is_touch);
    scene.add(sun, sun.target);

    const paths = getPathSegments();
    scene.add(createTerrain(), createDecor(paths));
    const clouds = createClouds();
    scene.add(clouds.group);
    const rides = createRideModels();
    for (const model of rides.values()) {
        scene.add(model.root);
    }

    // 캐릭터가 준비되기 전 첫 화면: 정문 안쪽(스폰 지점)에서 공원 중앙 쪽을 바라봄
    const camera = new THREE.PerspectiveCamera(55, 1, 0.3, 700);
    camera.position.set(SPAWN_POINT.x, 8, SPAWN_POINT.z + 10);
    camera.lookAt(SPAWN_POINT.x, 1, SPAWN_POINT.z - 20);

    const frame_callbacks = new Set<FrameCallback>();
    let ride_time_source: (() => number) | null = null;

    const resize = (): void => {
        const width = Math.max(container.clientWidth, 1);
        const height = Math.max(container.clientHeight, 1);
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    };
    const resize_observer = new ResizeObserver(resize);
    resize_observer.observe(container);
    resize();

    const stats = { frame_ms: 0, draw_calls: 0, triangles: 0 };
    let last_time = -1;
    renderer.setAnimationLoop((timestamp: number) => {
        const work_start = performance.now();
        const time = timestamp / 1000;
        const delta = last_time < 0 ? 0 : Math.min(time - last_time, MAX_FRAME_DELTA);
        last_time = time;
        const ride_time = ride_time_source === null ? time : ride_time_source();
        for (const model of rides.values()) {
            model.update(ride_time, delta);
        }
        clouds.update(time);
        for (const callback of frame_callbacks) {
            callback(time, delta);
        }
        renderer.info.reset();
        renderer.shadowMap.needsUpdate = true;
        const view_width = container.clientWidth;
        const view_height = container.clientHeight;
        renderer.setViewport(0, 0, view_width, view_height);
        renderer.render(scene, camera);
        if (inset_camera !== null) {
            const rect = computeInsetRect(view_width);
            // WebGL 뷰포트는 왼쪽 아래가 원점
            const bottom = view_height - rect.top - rect.height;
            renderer.setScissorTest(true);
            renderer.setScissor(rect.left, bottom, rect.width, rect.height);
            renderer.setViewport(rect.left, bottom, rect.width, rect.height);
            inset_camera.aspect = rect.width / rect.height;
            inset_camera.updateProjectionMatrix();
            renderer.render(scene, inset_camera);
            renderer.setScissorTest(false);
            Object.assign(inset_frame.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        }
        // 지수 이동 평균으로 흔들림 완화
        stats.frame_ms = stats.frame_ms * 0.9 + (performance.now() - work_start) * 0.1;
        stats.draw_calls = renderer.info.render.calls;
        stats.triangles = renderer.info.render.triangles;
    });

    return {
        scene,
        camera,
        rides,
        canvas: renderer.domElement,
        onFrame(callback) {
            frame_callbacks.add(callback);
            return () => frame_callbacks.delete(callback);
        },
        setRideTimeSource(source) {
            ride_time_source = source;
        },
        setInsetCamera(next_camera) {
            inset_camera = next_camera;
            inset_frame.hidden = next_camera === null;
        },
        stats,
        dispose(): void {
            renderer.setAnimationLoop(null);
            frame_callbacks.clear();
            resize_observer.disconnect();
            disposeScene(scene);
            disposeMaterialCache();
            disposeDuckGeometries();
            renderer.dispose();
            renderer.domElement.remove();
            inset_frame.remove();
        },
    };
}
