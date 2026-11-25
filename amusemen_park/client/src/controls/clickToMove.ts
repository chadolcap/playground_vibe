// 클릭한 땅 위치 구하기 + 목적지 표시
// PC·모바일 공통: 한 번 클릭(탭) = 걷기, 빠르게 두 번 = 달리기 (첫 번째에 바로 걷기 시작, 두 번째에 달리기로 바꿈)
// 화면 좌표에서 카메라 광선을 쏘아 땅(y=0) 평면과 만나는 점을 목적지로 사용
import * as THREE from "three";

// 두 번 탭 사이 최대 간격(ms)과, 탭으로 인정하는 최대 포인터 이동(px)·누른 시간(ms) — 드래그(시점 회전)와 구분
const DOUBLE_TAP_MS = 320;
const TAP_MOVE_TOLERANCE = 12;
const TAP_MAX_MS = 450;
const DOUBLE_TAP_DISTANCE = 40;

export interface ClickToMoveOptions {
    // 이 물체(내 캐릭터)를 누르면 이동하지 않음 (이모티콘 버튼을 여는 클릭)
    ignore_target: THREE.Object3D;
    // 이 물체들(게임장 게임기 등)을 누르면 이동하지 않음 — 누른 쪽에서 따로 처리
    extra_ignore?: readonly THREE.Object3D[];
    // 누르는 순간 true 면 이동하지 않음 (이모티콘 버튼·채팅창이 열려 있으면 그 클릭은 창을 닫는 데만 씀)
    isBlocked: () => boolean;
}

export interface ClickToMove {
    // 목적지 표시 갱신 (destination 이 null 이면 숨김)
    update(destination: { x: number; z: number } | null, time: number): void;
    dispose(): void;
}

export function createClickToMove(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    scene: THREE.Scene,
    on_target: (x: number, z: number, run: boolean) => void,
    options: ClickToMoveOptions,
): ClickToMove {
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointer = new THREE.Vector2();
    const hit = new THREE.Vector3();

    function aim(client_x: number, client_y: number): void {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((client_x - rect.left) / rect.width) * 2 - 1, -((client_y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
    }

    function pickGround(client_x: number, client_y: number, run: boolean): void {
        aim(client_x, client_y);
        if (raycaster.ray.intersectPlane(ground, hit) !== null) {
            on_target(hit.x, hit.z, run);
        }
    }

    // 직접 탭 판정 (마우스·터치 공통 — 브라우저마다 터치 dblclick 지원이 달라서, PC 는 한 번 클릭도 써야 해서)
    const downs = new Map<number, { x: number; y: number; time: number; blocked: boolean }>();
    let last_tap = { time: -Infinity, x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent): void => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return;
        }
        aim(event.clientX, event.clientY);
        // 내 캐릭터를 누름(이모티콘 버튼 열기) 또는 열린 창을 닫는 클릭이면 이동하지 않음 — 누르는 순간 판정 (떼는 순간에는 창이 이미 닫혔을 수 있음)
        const blocked = options.isBlocked() || raycaster.intersectObject(options.ignore_target, true).length > 0
            || (options.extra_ignore !== undefined && raycaster.intersectObjects(options.extra_ignore as THREE.Object3D[], true).length > 0);
        downs.set(event.pointerId, { x: event.clientX, y: event.clientY, time: performance.now(), blocked });
    };
    const onPointerUp = (event: PointerEvent): void => {
        const down = downs.get(event.pointerId);
        downs.delete(event.pointerId);
        const now = performance.now();
        if (down === undefined || down.blocked || now - down.time > TAP_MAX_MS || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_MOVE_TOLERANCE) {
            return;
        }
        const is_double = now - last_tap.time <= DOUBLE_TAP_MS && Math.hypot(event.clientX - last_tap.x, event.clientY - last_tap.y) <= DOUBLE_TAP_DISTANCE;
        last_tap = is_double ? { time: -Infinity, x: 0, y: 0 } : { time: now, x: event.clientX, y: event.clientY };
        // 한 번에 바로 걷기, 이어서 두 번째면 같은 곳으로 달리기 (마우스·터치 공통 — 드래그·오래 누르기는 위에서 걸러짐)
        pickGround(event.clientX, event.clientY, is_double);
    };

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    // 목적지 표시: 바닥에 납작한 고리 + 가운데 점, 통통 숨쉬듯 커졌다 작아짐
    const marker = new THREE.Group();
    const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.8, 32),
        new THREE.MeshBasicMaterial({ color: "#ff8fab", transparent: true, opacity: 0.9, depthWrite: false }),
    );
    const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.22, 20),
        new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.95, depthWrite: false }),
    );
    for (const mesh of [ring, dot]) {
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.y = 0.08;
        marker.add(mesh);
    }
    marker.visible = false;
    scene.add(marker);

    return {
        update(destination, time) {
            marker.visible = destination !== null;
            if (destination !== null) {
                marker.position.set(destination.x, 0, destination.z);
                marker.scale.setScalar(1 + Math.sin(time * 6) * 0.12);
            }
        },
        dispose() {
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointerup", onPointerUp);
            marker.removeFromParent();
            ring.geometry.dispose();
            dot.geometry.dispose();
            (ring.material as THREE.Material).dispose();
            (dot.material as THREE.Material).dispose();
        },
    };
}
