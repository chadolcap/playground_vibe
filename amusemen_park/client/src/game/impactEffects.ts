// 충돌 효과 — 부딪힌 자리에 노란 별 모양이 '팡' 커졌다가 사라짐 (스프라이트 몇 개를 돌려 씀)
import * as THREE from "three";

const POOL_SIZE = 8;
const LIFETIME_MS = 420;

interface Burst {
    sprite: THREE.Sprite;
    start: number;
    size: number;
}

export interface ImpactEffects {
    spawn(position: THREE.Vector3, strength: number): void;
    update(): void;
    dispose(): void;
}

// 뾰족한 별 + 가운데 흰 빛 (캔버스로 한 번만 그림)
function createStarTexture(): THREE.CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context !== null) {
        const points = 10;
        context.beginPath();
        for (let index = 0; index <= points * 2; index += 1) {
            const angle = (index / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            const radius = index % 2 === 0 ? 60 : 28;
            context.lineTo(64 + Math.cos(angle) * radius, 64 + Math.sin(angle) * radius);
        }
        context.fillStyle = "#ffd166";
        context.fill();
        context.lineWidth = 6;
        context.strokeStyle = "#ffffff";
        context.stroke();
        const glow = context.createRadialGradient(64, 64, 0, 64, 64, 30);
        glow.addColorStop(0, "rgba(255,255,255,1)");
        glow.addColorStop(1, "rgba(255,255,255,0)");
        context.fillStyle = glow;
        context.beginPath();
        context.arc(64, 64, 30, 0, Math.PI * 2);
        context.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function createImpactEffects(scene: THREE.Scene): ImpactEffects {
    const texture = createStarTexture();
    const bursts: Burst[] = [];
    for (let index = 0; index < POOL_SIZE; index += 1) {
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(material);
        sprite.visible = false;
        scene.add(sprite);
        bursts.push({ sprite, start: -Infinity, size: 1 });
    }
    let next = 0;

    return {
        spawn(position, strength) {
            const burst = bursts[next];
            next = (next + 1) % POOL_SIZE;
            burst.sprite.position.copy(position);
            burst.start = performance.now();
            // 세게 부딪힐수록 크게
            burst.size = 1.4 + Math.min(strength / 7, 1) * 1.8;
            burst.sprite.visible = true;
        },
        update() {
            const now = performance.now();
            for (const burst of bursts) {
                if (!burst.sprite.visible) {
                    continue;
                }
                const progress = (now - burst.start) / LIFETIME_MS;
                if (progress >= 1) {
                    burst.sprite.visible = false;
                    continue;
                }
                const scale = burst.size * (0.4 + Math.sin(Math.min(progress * 1.6, 1) * Math.PI / 2) * 0.8);
                burst.sprite.scale.set(scale, scale, 1);
                burst.sprite.material.opacity = 1 - progress * progress;
                burst.sprite.material.rotation = progress * 0.8;
            }
        },
        dispose() {
            for (const burst of bursts) {
                burst.sprite.removeFromParent();
                burst.sprite.material.dispose();
            }
            texture.dispose();
        },
    };
}
