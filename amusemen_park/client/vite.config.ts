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
    server: {
        // 같은 네트워크의 모바일 기기에서 접속 테스트할 수 있도록 외부 접속 허용
        host: true,
    },
});
