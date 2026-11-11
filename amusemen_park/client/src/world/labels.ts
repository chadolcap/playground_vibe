// 3D 표지판 글자 — 캔버스에 글자를 그려 텍스처로 사용
// 캔버스는 그리는 순간의 글꼴로 굳어지므로, 반드시 loadWorldFonts() 완료 후 생성할 것
import * as THREE from "three";

const SIGN_FONT_FAMILY = '"ONE-Mobile-POP", system-ui, sans-serif';
const CANVAS_FONT_SIZE = 72;
const CANVAS_PADDING_X = 40;
const CANVAS_HEIGHT = 128;

export async function loadWorldFonts(): Promise<void> {
    try {
        await document.fonts.load(`${CANVAS_FONT_SIZE}px "ONE-Mobile-POP"`, "가A");
    } catch (error) {
        // 글꼴을 못 받아도 대체 글꼴로 계속 진행
        console.warn("[labels] 글꼴 로딩 실패, 대체 글꼴 사용", error);
    }
}

export interface SignOptions {
    // 월드 단위 높이 (폭은 글자 길이에 맞춰 자동)
    height: number;
    background: string;
    color: string;
}

// 글자 길이에 맞춘 둥근 간판 판 (앞면만 글자, 뒷면은 단색)
export function createSignBoard(text: string, options: SignOptions): THREE.Group {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context === null) {
        throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
    }
    const font = `${CANVAS_FONT_SIZE}px ${SIGN_FONT_FAMILY}`;
    context.font = font;
    const text_width = Math.ceil(context.measureText(text).width);
    canvas.width = text_width + CANVAS_PADDING_X * 2;
    canvas.height = CANVAS_HEIGHT;

    // 캔버스 크기를 바꾸면 상태가 초기화되므로 다시 설정
    context.fillStyle = options.background;
    context.beginPath();
    context.roundRect(0, 0, canvas.width, canvas.height, 36);
    context.fill();
    context.font = font;
    context.fillStyle = options.color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2 + 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;

    const width = (canvas.width / canvas.height) * options.height;
    const group = new THREE.Group();
    const front = new THREE.Mesh(
        new THREE.PlaneGeometry(width, options.height),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
    const back = new THREE.Mesh(
        new THREE.PlaneGeometry(width, options.height),
        new THREE.MeshBasicMaterial({ color: options.background }),
    );
    back.rotation.y = Math.PI;
    back.position.z = -0.01;
    group.add(front, back);
    group.userData.width = width;
    return group;
}
