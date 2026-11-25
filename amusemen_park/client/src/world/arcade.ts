// 게임장 — 게임기 5대(활 모양 배치)·바닥·간판, 게임기 위 이름표 "게임명 (N명)"
// 위치·정면은 shared/arcade.ts 의 ARCADE (로컬 +z = 정면, 손님이 서는 쪽), 게임기 자리는 getMachineLocal
import * as THREE from "three";
import { ARCADE, GAME_LIST, getMachineLocal, type GameId } from "@shared";
import { createArcadeDecor } from "./arcadeDecor";
import { addMesh, getMaterial } from "./rides/common";

const CABINET_WIDTH = 1.05;
const CABINET_HEIGHT = 2.0;
const SIDE_THICKNESS = 0.06;
const BODY_COLOR = "#f4f4f1";
// 화면이 뒤로 누운 각도 (라디안) — SIDE_PROFILE 의 화면 선 (0.24, 1.14) → (0.1, 1.72) 기울기
const SCREEN_TILT = Math.atan2(0.14, 0.58);
// 한 사람 몫 버튼 6개 (3개씩 두 줄)
const BUTTON_COLORS = ["#ff5a4e", "#ffd166", "#5ec8ff", "#7bc96f", "#ff8fab", "#c7a8ff"] as const;
// 이름표 (게임기 위) — 높이·글자
const TAG_Y = 3.25;
const TAG_HEIGHT = 0.42;
const TAG_FONT = '56px "ONE-Mobile-POP", system-ui, sans-serif';
const TAG_CANVAS_HEIGHT = 88;
// 캐릭터가 게임기를 뚫고 지나가지 않게 막는 원
const MACHINE_SOLID_RADIUS = 0.6;
// 게임기 전체 확대 배율 (모델 치수는 배율 1 기준, 충돌 원도 함께 키움)
const MACHINE_SCALE = 1.35;

export interface ArcadeModel {
    readonly root: THREE.Group;
    // 클릭 판정용 게임기 묶음 (userData.game_id)
    readonly machines: readonly THREE.Object3D[];
    // 게임별 참여 인원으로 이름표 갱신 (바뀐 것만 다시 그림)
    setCounts(counts: ReadonlyMap<string, number>): void;
}

interface NameTag {
    sprite: THREE.Sprite;
    canvas: HTMLCanvasElement;
    texture: THREE.CanvasTexture;
    text: string;
}

function createNameTag(): NameTag {
    const canvas = document.createElement("canvas");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false }));
    return { sprite, canvas, texture, text: "" };
}

function drawNameTag(tag: NameTag, text: string, color: string): void {
    if (tag.text === text) {
        return;
    }
    tag.text = text;
    const context = tag.canvas.getContext("2d");
    if (context === null) {
        return;
    }
    context.font = TAG_FONT;
    tag.canvas.width = Math.ceil(context.measureText(text).width) + 56;
    tag.canvas.height = TAG_CANVAS_HEIGHT;
    // 캔버스 크기를 바꾸면 상태가 초기화되므로 다시 설정
    context.fillStyle = "rgba(255, 255, 255, 0.92)";
    context.strokeStyle = color;
    context.lineWidth = 8;
    context.beginPath();
    context.roundRect(4, 4, tag.canvas.width - 8, tag.canvas.height - 8, (tag.canvas.height - 8) / 2);
    context.fill();
    context.stroke();
    context.font = TAG_FONT;
    context.fillStyle = "#3b2f1e";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, tag.canvas.width / 2, tag.canvas.height / 2 + 3);
    tag.texture.dispose();
    tag.texture = new THREE.CanvasTexture(tag.canvas);
    tag.texture.colorSpace = THREE.SRGBColorSpace;
    tag.sprite.material.map = tag.texture;
    tag.sprite.material.needsUpdate = true;
    tag.sprite.scale.set((tag.canvas.width / tag.canvas.height) * TAG_HEIGHT, TAG_HEIGHT, 1);
}

// 캔버스에 그린 그림을 붙인 빛나는 판 (화면·위쪽 간판) — 조명 영향 없이 밝게 보이게 MeshBasicMaterial
function createCanvasPlane(
    pixel_width: number,
    pixel_height: number,
    width: number,
    height: number,
    draw: (context: CanvasRenderingContext2D, w: number, h: number) => void,
): THREE.Mesh {
    const canvas = document.createElement("canvas");
    canvas.width = pixel_width;
    canvas.height = pixel_height;
    const context = canvas.getContext("2d");
    if (context !== null) {
        draw(context, pixel_width, pixel_height);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture }));
}

// 위쪽 간판: 남색 띠 + 알록달록한 게임 이름 + 양쪽 작은 불빛
function drawMarquee(context: CanvasRenderingContext2D, w: number, h: number, name: string, color: string): void {
    context.fillStyle = "#1c2140";
    context.fillRect(0, 0, w, h);
    const letter_colors = ["#ff5a4e", "#ffd166", "#7bc96f", "#5ec8ff", "#c7a8ff", color];
    context.font = `${Math.round(h * 0.62)}px "ONE-Mobile-POP", system-ui, sans-serif`;
    context.textBaseline = "middle";
    const letters = Array.from(name);
    const total = letters.reduce((sum, letter) => sum + context.measureText(letter).width, 0);
    let x = (w - total) / 2;
    letters.forEach((letter, index) => {
        context.fillStyle = letter_colors[index % letter_colors.length];
        context.fillText(letter, x, h / 2 + 2);
        x += context.measureText(letter).width;
    });
    for (let index = 0; index < 4; index += 1) {
        context.fillStyle = index % 2 === 0 ? "#ff5a4e" : "#ffffff";
        context.beginPath();
        context.arc(w - 26 - index * 16, h * 0.78, 5, 0, Math.PI * 2);
        context.arc(26 + index * 16, h * 0.78, 5, 0, Math.PI * 2);
        context.fill();
    }
}

// 화면: 왼쪽 게임 목록(이 게임기 게임에 강조) + 오른쪽 게임 이름 큰 글씨
function drawScreen(context: CanvasRenderingContext2D, w: number, h: number, game_id: GameId, color: string): void {
    context.fillStyle = "#0d1b3e";
    context.fillRect(0, 0, w, h);
    const list_width = w * 0.42;
    const row_height = (h - 24) / GAME_LIST.length;
    context.font = `${Math.round(row_height * 0.5)}px "ONE-Mobile-POP", system-ui, sans-serif`;
    context.textBaseline = "middle";
    GAME_LIST.forEach((game, index) => {
        const y = 12 + index * row_height;
        const selected = game.id === game_id;
        context.fillStyle = selected ? "#2f9e44" : "#1f3466";
        context.fillRect(10, y + 3, list_width - 14, row_height - 6);
        context.fillStyle = selected ? "#ffffff" : "#b8c7ee";
        context.fillText(`${index + 1}. ${game.name}`, 20, y + row_height / 2);
    });
    // 오른쪽 그림 칸: 게임 색 바탕 + 이름
    const panel_x = list_width + 8;
    const panel_width = w - panel_x - 10;
    const gradient = context.createLinearGradient(0, 12, 0, h - 12);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "#16306b");
    context.fillStyle = gradient;
    context.fillRect(panel_x, 12, panel_width, h - 24);
    const name = GAME_LIST.find((game) => game.id === game_id)?.name ?? "";
    context.font = `${Math.round(h * 0.16)}px "ONE-Mobile-POP", system-ui, sans-serif`;
    context.textAlign = "center";
    context.lineWidth = 6;
    context.strokeStyle = "#1c2140";
    context.strokeText(name, panel_x + panel_width / 2, h * 0.3);
    context.fillStyle = "#ffe066";
    context.fillText(name, panel_x + panel_width / 2, h * 0.3);
    context.font = `${Math.round(h * 0.08)}px "ONE-Mobile-POP", system-ui, sans-serif`;
    context.fillStyle = "#ffffff";
    context.fillText("PRESS START", panel_x + panel_width / 2, h * 0.75);
}

// 옆판 윤곽 (z, y) — 앞(+z)으로 조작판이 튀어나오고, 화면은 뒤로 눕고, 위쪽 간판 덮개가 다시 앞으로 나옴
const SIDE_PROFILE: readonly (readonly [number, number])[] = [
    [-0.42, 0], [0.3, 0], [0.3, 0.92], [0.5, 0.98], [0.5, 1.08], [0.24, 1.14],
    [0.1, 1.72], [0.28, 1.78], [0.28, CABINET_HEIGHT], [-0.42, CABINET_HEIGHT],
];

function createSidePanel(): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    SIDE_PROFILE.forEach(([z, y], index) => (index === 0 ? shape.moveTo(z, y) : shape.lineTo(z, y)));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: SIDE_THICKNESS,
        bevelEnabled: true,
        bevelThickness: 0.015,
        bevelSize: 0.015,
        bevelSegments: 2,
    });
    // 두께 방향 가운데 정렬 — rotation.y = -π/2 로 붙이면 윤곽 x → 로컬 z
    geometry.translate(0, 0, -SIDE_THICKNESS / 2);
    return geometry;
}

// 오락기 한 대 (참조: 흰색 업라이트 2인용 오락기) — 흰 옆판·몸통, 기울어진 큰 화면, 2인 조작판, 위쪽 간판·조명, 아래 동전 투입구
function createMachine(game_id: GameId, color: string, name: string): THREE.Group {
    const machine = new THREE.Group();
    const inner = CABINET_WIDTH - SIDE_THICKNESS * 2;
    const side_geometry = createSidePanel();
    for (const side of [-1, 1]) {
        addMesh(machine, side === 1 ? side_geometry : side_geometry.clone(), BODY_COLOR, [side * (CABINET_WIDTH / 2 - SIDE_THICKNESS / 2), 0, 0], [0, -Math.PI / 2, 0]);
    }
    // 아래 몸통·뒤쪽 몸통·위쪽 덮개
    addMesh(machine, new THREE.BoxGeometry(inner, 0.92, 0.7), BODY_COLOR, [0, 0.46, -0.07]);
    addMesh(machine, new THREE.BoxGeometry(inner, 0.95, 0.4), BODY_COLOR, [0, 1.38, -0.2]);
    addMesh(machine, new THREE.BoxGeometry(inner, 0.22, 0.68), BODY_COLOR, [0, CABINET_HEIGHT - 0.11, -0.07]);
    addMesh(machine, new THREE.BoxGeometry(CABINET_WIDTH + 0.02, 0.05, 0.74), "#9aa0a6", [0, 0.025, -0.06]);

    // 위쪽 간판 + 아래로 비추는 조명 두 개
    const marquee = createCanvasPlane(512, 96, inner * 0.96, 0.17, (context, w, h) => drawMarquee(context, w, h, name, color));
    marquee.position.set(0, CABINET_HEIGHT - 0.11, 0.285);
    machine.add(marquee);
    for (const side of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 16), getMaterial("#fff8dc", 0.9));
        lamp.position.set(side * inner * 0.3, 1.77, 0.18);
        machine.add(lamp);
    }

    // 화면 (뒤로 눕힘): 검은 테두리 + 그림 화면
    const screen_group = new THREE.Group();
    screen_group.position.set(0, 1.43, 0.17);
    screen_group.rotation.x = -SCREEN_TILT;
    addMesh(screen_group, new THREE.BoxGeometry(inner * 0.98, 0.6, 0.05), "#1d1f2b");
    const screen = createCanvasPlane(512, 320, inner * 0.88, 0.52, (context, w, h) => drawScreen(context, w, h, game_id, color));
    screen.position.z = 0.028;
    screen_group.add(screen);
    machine.add(screen_group);

    // 2인 조작판 (앞쪽이 살짝 낮음): 흰 판 + 스틱 두 개 + 버튼 3×2 두 벌
    const panel = new THREE.Group();
    panel.position.set(0, 1.03, 0.37);
    panel.rotation.x = 0.1;
    addMesh(panel, new THREE.BoxGeometry(inner, 0.1, 0.27), BODY_COLOR);
    for (const side of [-1, 1]) {
        const stick_x = side * inner * 0.36;
        addMesh(panel, new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), "#5c6370", [stick_x, 0.1, 0]);
        addMesh(panel, new THREE.SphereGeometry(0.035, 12, 10), "#ffffff", [stick_x, 0.16, 0]);
        BUTTON_COLORS.forEach((button_color, index) => {
            const column = index % 3;
            const row = Math.floor(index / 3);
            const button_x = stick_x - side * (0.1 + column * 0.055);
            addMesh(panel, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), button_color, [button_x, 0.06, -0.03 + row * 0.055]);
        });
    }
    machine.add(panel);

    // 아래 앞면: 문짝(자물쇠) · 지폐 투입구 · 동전 투입구 · 작은 반환함
    addMesh(machine, new THREE.BoxGeometry(0.5, 0.42, 0.02), "#f8f8f6", [-0.1, 0.42, 0.29]);
    addMesh(machine, new THREE.BoxGeometry(0.025, 0.04, 0.02), "#5c6370", [0.12, 0.45, 0.305]);
    addMesh(machine, new THREE.BoxGeometry(0.1, 0.05, 0.03), "#3a3f4b", [-0.1, 0.78, 0.29]);
    addMesh(machine, new THREE.BoxGeometry(0.08, 0.14, 0.03), "#c9ccd1", [0.32, 0.6, 0.29]);
    addMesh(machine, new THREE.BoxGeometry(0.012, 0.06, 0.01), "#2b2d42", [0.32, 0.62, 0.31]);
    addMesh(machine, new THREE.BoxGeometry(0.2, 0.17, 0.02), "#f8f8f6", [0.3, 0.22, 0.29]);

    machine.scale.setScalar(MACHINE_SCALE);
    machine.userData.solid_radius = MACHINE_SOLID_RADIUS * MACHINE_SCALE;
    return machine;
}

export function createArcade(): ArcadeModel {
    const root = new THREE.Group();
    const machines: THREE.Object3D[] = [];
    const tags = new Map<GameId, NameTag>();

    // 바닥·뒤 아치 간판·풍선·벤치·화분
    root.add(createArcadeDecor());

    GAME_LIST.forEach((game, index) => {
        const local = getMachineLocal(index);
        const machine = createMachine(game.id, game.color, game.name);
        machine.position.set(local.x, 0, local.z);
        machine.rotation.y = local.rot_y;
        machine.userData.game_id = game.id;
        const tag = createNameTag();
        drawNameTag(tag, `${game.name} (0명)`, game.color);
        // 이름표는 게임기 배율과 상관없이 같은 크기로 보이게 게임장 묶음에 바로 붙임
        tag.sprite.position.set(local.x, TAG_Y, local.z);
        root.add(tag.sprite);
        tags.set(game.id, tag);
        root.add(machine);
        machines.push(machine);
    });

    root.position.set(ARCADE.x, 0, ARCADE.z);
    root.rotation.y = ARCADE.rot_y;
    // 충돌 원(groundMap)이 월드 좌표를 읽으므로 미리 계산
    root.updateMatrixWorld(true);

    return {
        root,
        machines,
        setCounts(counts) {
            for (const game of GAME_LIST) {
                const tag = tags.get(game.id);
                if (tag !== undefined) {
                    drawNameTag(tag, `${game.name} (${counts.get(game.id) ?? 0}명)`, game.color);
                }
            }
        },
    };
}
