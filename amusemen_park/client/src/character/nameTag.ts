// 머리 위 이름표 — 항상 카메라를 바라보는 스프라이트
// 캔버스에 글자를 그리므로 POP체 로딩(loadWorldFonts) 후에 생성할 것
import * as THREE from "three";

const FONT = '44px "ONE-Mobile-POP", system-ui, sans-serif';
const CANVAS_HEIGHT = 72;
const PADDING_X = 22;
// 월드 단위 높이
const TAG_HEIGHT = 0.42;

export interface NameTagStyle {
    background: string;
    color: string;
}

const PLAYER_STYLE: NameTagStyle = { background: "rgba(255, 255, 255, 0.85)", color: "#3b2f1e" };

export function createNameTag(text: string, style: NameTagStyle = PLAYER_STYLE): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context === null) {
        throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
    }
    context.font = FONT;
    canvas.width = Math.ceil(context.measureText(text).width) + PADDING_X * 2;
    canvas.height = CANVAS_HEIGHT;

    context.fillStyle = style.background;
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, CANVAS_HEIGHT / 2);
    context.fill();
    context.font = FONT;
    context.fillStyle = style.color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    // 이름표는 다른 물체 뒤에 가려지되, 투명 가장자리가 뒤 물체를 지우지 않도록 깊이 기록 안 함
    const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set((canvas.width / canvas.height) * TAG_HEIGHT, TAG_HEIGHT, 1);
    // 이름표가 그림자를 만들지 않도록
    sprite.castShadow = false;
    return sprite;
}

export function disposeNameTag(sprite: THREE.Sprite): void {
    sprite.material.map?.dispose();
    sprite.material.dispose();
}
