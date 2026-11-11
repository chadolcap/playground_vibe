// 더블클릭(PC) / 더블탭(모바일)한 땅 위치 구하기 + 목적지 표시
// 화면 좌표에서 카메라 광선을 쏘아 땅(y=0) 평면과 만나는 점을 목적지로 사용
import * as THREE from "three";

// 두 번 탭 사이 최대 간격(ms)과, 탭으로 인정하는 최대 손가락 이동(px) — 드래그(시점 회전)와 구분
const DOUBLE_TAP_MS = 320;
const TAP_MOVE_TOLERANCE = 12;
const DOUBLE_TAP_DISTANCE = 40;

export interface ClickToMove {
    // 목적지 표시 갱신 (destination 이 null 이면 숨김)
    update(destination: { x: number; z: number } | null, time: number): void;
    dispose(): void;
}

export function createClickToMove(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    scene: THREE.Scene,
    on_target: (x: number, z: number) => void,
): ClickToMove {
    const raycaster = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointer = new THREE.Vector2();
    const hit = new THREE.Vector3();

    function pickGround(client_x: number, client_y: number): void {
        const rect = canvas.getBoundingClientRect();
        pointer.set(((client_x - rect.left) / rect.width) * 2 - 1, -((client_y - rect.top) / rect.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        if (raycaster.ray.intersectPlane(ground, hit) !== null) {
            on_target(hit.x, hit.z);
        }
    }

    // PC: 마우스 더블클릭
    const onDoubleClick = (event: MouseEvent): void => {
        pickGround(event.clientX, event.clientY);
        event.preventDefault();
    };

    // 모바일: 직접 더블탭 판정 (브라우저마다 터치 dblclick 지원이 달라서)
    const downs = new Map<number, { x: number; y: number }>();
    let last_tap = { time: -Infinity, x: 0, y: 0 };
    const onPointerDown = (event: PointerEvent): void => {
        if (event.pointerType !== "mouse") {
            downs.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }
    };
    const onPointerUp = (event: PointerEvent): void => {
        const down = downs.get(event.pointerId);
        downs.delete(event.pointerId);
        if (down === undefined || Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_MOVE_TOLERANCE) {
            return;
        }
        const now = performance.now();
        if (now - last_tap.time <= DOUBLE_TAP_MS && Math.hypot(event.clientX - last_tap.x, event.clientY - last_tap.y) <= DOUBLE_TAP_DISTANCE) {
            pickGround(event.clientX, event.clientY);
            last_tap = { time: -Infinity, x: 0, y: 0 };
        } else {
            last_tap = { time: now, x: event.clientX, y: event.clientY };
        }
    };

    canvas.addEventListener("dblclick", onDoubleClick);
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
            canvas.removeEventListener("dblclick", onDoubleClick);
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
