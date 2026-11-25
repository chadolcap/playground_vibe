// 놀이동산 캐릭터를 2D 그림으로 찍어 게임 화면(Pixi)에서 쓰는 텍스처로 만든다
// avatar = 놀이동산 캐릭터 look_key ("별명|#rrggbb") — 놀이동산과 같은 함수(createDuckRig)로 같은 캐릭터를 고른다
//  · face: 프로필 카드용 (머리~가슴, 정사각형)
//  · body: 점핑 말 등 전신용 (발끝~머리, 세로로 긴 그림)
import * as THREE from "three";
import { Texture } from "pixi.js";
import { DUCK_HEIGHT, createDuckRig, loadCharacterModel } from "../../character/duckModel";

export type PortraitKind = "face" | "body";

const FACE_SIZE = 256;
const BODY_WIDTH = 192;
const BODY_HEIGHT = 320;

const cache = new Map<string, Promise<Texture>>();
let renderer: THREE.WebGLRenderer | null = null;

function getRenderer(): THREE.WebGLRenderer {
    renderer ??= new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    return renderer;
}

// look_key 에서 몸 색을 꺼냄 (없으면 노랑)
function readColor(avatar: string): string {
    const color = avatar.split("|").pop() ?? "";
    return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffd166";
}

async function renderPortrait(avatar: string, kind: PortraitKind): Promise<Texture> {
    await loadCharacterModel();
    const width = kind === "face" ? FACE_SIZE : BODY_WIDTH;
    const height = kind === "face" ? FACE_SIZE : BODY_HEIGHT;
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight("#ffffff", "#c4e6a8", 2.2));
    const sun = new THREE.DirectionalLight("#fff1dc", 1.6);
    sun.position.set(1.5, 3, 4);
    scene.add(sun);

    const rig = createDuckRig(readColor(avatar), avatar);
    // 정면에서 살짝 비껴 서서 입체감이 보이게
    rig.root.rotation.y = -0.35;
    scene.add(rig.root);

    const camera = new THREE.PerspectiveCamera(kind === "face" ? 22 : 30, width / height, 0.1, 20);
    if (kind === "face") {
        camera.position.set(0, DUCK_HEIGHT * 0.8, 3);
        camera.lookAt(0, DUCK_HEIGHT * 0.78, 0);
    } else {
        camera.position.set(0, DUCK_HEIGHT * 0.55, 3.4);
        camera.lookAt(0, DUCK_HEIGHT * 0.5, 0);
    }

    const target = getRenderer();
    target.setPixelRatio(1);
    target.setSize(width, height, false);
    target.setClearColor(0x000000, 0);
    target.render(scene, camera);
    const url = target.domElement.toDataURL("image/png");
    scene.remove(rig.root);

    const image = new Image();
    image.src = url;
    await image.decode();
    return Texture.from(image);
}

// 같은 캐릭터·종류는 한 번만 찍는다 (실패하면 null — 호출한 쪽이 기본 그림을 씀)
export function GetCharacterTexture(avatar: string, kind: PortraitKind): Promise<Texture | null> {
    const key = `${kind}:${avatar}`;
    let pending = cache.get(key);
    if (pending === undefined) {
        pending = renderPortrait(avatar, kind);
        cache.set(key, pending);
    }
    return pending.catch((error: unknown) => {
        console.warn("[arcade] 캐릭터 그림을 만들지 못함", error);
        cache.delete(key);
        return null;
    });
}

// 게임 화면을 닫을 때 WebGL 컨텍스트를 돌려준다 (Pixi 화면과 함께 텍스처도 버리므로 캐시도 비움)
export function ReleasePortraitRenderer(): void {
    cache.clear();
    renderer?.dispose();
    renderer?.forceContextLoss();
    renderer = null;
}
