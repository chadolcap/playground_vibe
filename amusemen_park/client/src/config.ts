// 클라이언트 환경 변수 읽기 (.env 의 VITE_ 접두사 변수만 노출됨)

const DEFAULT_SERVER_PORT = 2567;

// 지정한 주소가 없으면 "페이지를 연 컴퓨터의 게임 서버 포트"로 접속 — 개발용 (같은 망의 다른 PC·휴대폰 포함)
// (localhost 로 고정하면 같은 망의 다른 PC·휴대폰에서는 자기 자신을 가리켜 입장이 안 됨)
// 배포(https·프록시 뒤)에서는 게임 서버 주소가 페이지와 다르므로 VITE_SERVER_URL 을 반드시 지정할 것
function defaultServerUrl(): string {
    const is_https = window.location.protocol === "https:";
    if (is_https || import.meta.env.PROD) {
        console.warn("[config] VITE_SERVER_URL 이 없어 기본 주소(페이지 호스트의 2567 포트)로 접속합니다. 배포 환경이면 게임 서버 주소를 지정하세요.");
    }
    // file:// 등 호스트 이름이 없는 경우 이 컴퓨터로
    const hostname = window.location.hostname || "localhost";
    return `${is_https ? "https:" : "http:"}//${hostname}:${DEFAULT_SERVER_PORT}`;
}

function readServerUrl(raw_value: string | undefined): string {
    if (raw_value === undefined || raw_value.trim() === "") {
        return defaultServerUrl();
    }
    const url = new URL(raw_value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error(`VITE_SERVER_URL 은 http(s) 주소여야 합니다: "${raw_value}"`);
    }
    return url.origin;
}

export const SERVER_URL = readServerUrl(import.meta.env.VITE_SERVER_URL);

// 사람 캐릭터 모델 고정 — 모델 이름(man_1·man_2·woman_1·woman_2)을 주면 모든 플레이어·NPC 가 그 모델로 나옴
// man_1 동작 작업 중 임시 고정, 작업이 끝나면 null 로 되돌려 이름·색 해시로 배정
export const FORCED_CHARACTER_MODEL: string | null = null;
