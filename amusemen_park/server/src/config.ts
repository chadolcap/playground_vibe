// 환경 변수 읽기 및 검증 (.env 는 실행 스크립트의 --env-file-if-exists 로 로드)

const DEFAULT_PORT = 2567;

export interface ServerConfig {
    port: number;
}

function readPort(raw_value: string | undefined): number {
    if (raw_value === undefined || raw_value.trim() === "") {
        return DEFAULT_PORT;
    }
    const port = Number(raw_value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`PORT 환경 변수가 올바르지 않습니다: "${raw_value}"`);
    }
    return port;
}

export function loadConfig(): ServerConfig {
    return {
        port: readPort(process.env.PORT),
    };
}
