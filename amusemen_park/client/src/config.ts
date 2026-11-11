// 클라이언트 환경 변수 읽기 (.env 의 VITE_ 접두사 변수만 노출됨)

const DEFAULT_SERVER_URL = "http://localhost:2567";

function readServerUrl(raw_value: string | undefined): string {
    if (raw_value === undefined || raw_value.trim() === "") {
        return DEFAULT_SERVER_URL;
    }
    const url = new URL(raw_value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`VITE_SERVER_URL 은 http(s) 주소여야 합니다: "${raw_value}"`);
    }
    return url.origin;
}

export const SERVER_URL = readServerUrl(import.meta.env.VITE_SERVER_URL);
