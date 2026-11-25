// 머리 위 말풍선 — 채팅 글을 캔버스에 그린 스프라이트 (꼬리 끝이 스프라이트 원점)
// 이름표(nameTag.ts)처럼 POP체 로딩 후에 만들 것
import * as THREE from "three";

const FONT = '38px "ONE-Mobile-POP", system-ui, sans-serif';
const LINE_HEIGHT = 48;
// 한 줄 최대 폭(px) — 넘으면 다음 줄로 (한글은 띄어쓰기가 없어도 글자 단위로 나눔)
const MAX_LINE_WIDTH = 360;
const PADDING_X = 22;
const PADDING_Y = 14;
const RADIUS = 26;
const TAIL_WIDTH = 26;
const TAIL_HEIGHT = 18;
// 캔버스 1px 의 월드 크기 (이름표보다 조금 크게 — 글이 길어도 읽히게)
const WORLD_PER_PIXEL = 0.0024;
const BACKGROUND = "rgba(255, 255, 255, 0.95)";
const BORDER = "rgba(59, 47, 30, 0.35)";
const TEXT_COLOR = "#3b2f1e";

// 글을 폭에 맞게 줄로 나눔 — 띄어쓰기 단위로 먼저 채우고, 한 단어가 너무 길면 글자 단위로 자름
function wrapLines(context: CanvasRenderingContext2D, text: string): string[] {
    const lines: string[] = [];
    let line = "";
    for (const word of text.split(" ")) {
        const candidate = line === "" ? word : `${line} ${word}`;
        if (context.measureText(candidate).width <= MAX_LINE_WIDTH) {
            line = candidate;
            continue;
        }
        if (line !== "") {
            lines.push(line);
        }
        line = "";
        for (const char of Array.from(word)) {
            if (line !== "" && context.measureText(line + char).width > MAX_LINE_WIDTH) {
                lines.push(line);
                line = "";
            }
            line += char;
        }
    }
    if (line !== "") {
        lines.push(line);
    }
    return lines;
}

export function createSpeechBubble(text: string): THREE.Sprite {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (context === null) {
        throw new Error("캔버스 2D 컨텍스트를 만들 수 없습니다.");
    }
    context.font = FONT;
    const lines = wrapLines(context, text);
    const text_width = Math.max(...lines.map((line) => context.measureText(line).width));
    const body_width = Math.ceil(text_width) + PADDING_X * 2;
    const body_height = lines.length * LINE_HEIGHT + PADDING_Y * 2;
    // 테두리가 잘리지 않게 사방 2px 여백
    canvas.width = Math.max(body_width, RADIUS * 2 + TAIL_WIDTH) + 4;
    canvas.height = body_height + TAIL_HEIGHT + 4;

    const left = 2;
    const top = 2;
    const width = canvas.width - 4;
    const center_x = canvas.width / 2;
    context.beginPath();
    context.roundRect(left, top, width, body_height, RADIUS);
    // 아래 가운데 꼬리 (끝이 캔버스 맨 아래)
    context.moveTo(center_x - TAIL_WIDTH / 2, top + body_height - 1);
    context.lineTo(center_x, canvas.height - 2);
    context.lineTo(center_x + TAIL_WIDTH / 2, top + body_height - 1);
    context.fillStyle = BACKGROUND;
    context.fill();
    context.strokeStyle = BORDER;
    context.lineWidth = 2;
    context.stroke();
    // 꼬리와 몸통이 만나는 곳의 테두리 선을 덮음
    context.fillRect(center_x - TAIL_WIDTH / 2 + 2, top + body_height - 3, TAIL_WIDTH - 4, 4);

    context.font = FONT;
    context.fillStyle = TEXT_COLOR;
    context.textAlign = "center";
    context.textBaseline = "middle";
    lines.forEach((line, index) => {
        context.fillText(line, center_x, top + PADDING_Y + LINE_HEIGHT * (index + 0.5) + 2);
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.SpriteMaterial({ map: texture, depthWrite: false });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(canvas.width * WORLD_PER_PIXEL, canvas.height * WORLD_PER_PIXEL, 1);
    // 꼬리 끝(아래 가운데)이 위치 기준점
    sprite.center.set(0.5, 0);
    sprite.castShadow = false;
    return sprite;
}

export function disposeSpeechBubble(sprite: THREE.Sprite): void {
    sprite.material.map?.dispose();
    sprite.material.dispose();
}
