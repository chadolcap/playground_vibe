import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// "@shared" 별칭 → 서버와 함께 쓰는 공유 상수 폴더
const shared_dir = fileURLToPath(new URL("../shared", import.meta.url));

export default defineConfig({
    resolve: {
        alias: [
            { find: /^@shared$/, replacement: `${shared_dir}/index.ts` },
            { find: /^@shared\//, replacement: `${shared_dir}/` },
        ],
    },
    // 게임장 게임 화면(pixi.js)은 게임기를 누를 때 동적 import 로 불러옴 — 개발 서버가 그때 처음 의존성을 최적화하며
    // 페이지를 새로고침하지 않도록 미리 최적화
    optimizeDeps: {
        include: ["pixi.js"],
    },
    server: {
        // 같은 네트워크의 모바일 기기에서 접속 테스트할 수 있도록 외부 접속 허용
        host: true,
    },
});
