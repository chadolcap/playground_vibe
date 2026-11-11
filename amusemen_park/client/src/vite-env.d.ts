/// <reference types="vite/client" />

interface ImportMetaEnv {
    // Colyseus 서버 주소 (예: http://localhost:2567)
    readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
