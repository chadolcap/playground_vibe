# Claude Flow V3 헬퍼

이 디렉터리에는 V3 개발용 헬퍼 스크립트와 유틸리티가 들어 있다.

## 🚀 빠른 시작

```bash
# V3 개발 환경 초기화
.claude/helpers/v3.sh init

# 빠른 상태 확인
.claude/helpers/v3.sh status

# 진행 지표 갱신
.claude/helpers/v3.sh update domain 3
.claude/helpers/v3.sh update agent 8
.claude/helpers/v3.sh update security 2
```

## 사용 가능한 헬퍼

### 🎛️ V3 마스터 도구
- **`v3.sh`** - 모든 V3 작업을 위한 메인 명령줄 인터페이스
  ```bash
  .claude/helpers/v3.sh help           # 전체 명령어 보기
  .claude/helpers/v3.sh status         # 개발 상태 빠르게 보기
  .claude/helpers/v3.sh update domain 3 # 특정 지표 갱신
  .claude/helpers/v3.sh validate       # 설정 검증
  .claude/helpers/v3.sh full-status    # 전체 상태 개요
  ```

### 📊 V3 진행 상황 관리
- **`update-v3-progress.sh`** - V3 개발 지표 갱신
  ```bash
  # 사용 예시:
  .claude/helpers/update-v3-progress.sh domain 3      # 도메인 3개 완료 표시
  .claude/helpers/update-v3-progress.sh agent 8       # 활성 에이전트 8개
  .claude/helpers/update-v3-progress.sh security 2    # CVE 2건 수정
  .claude/helpers/update-v3-progress.sh performance 2.5x # 성능 향상
  .claude/helpers/update-v3-progress.sh status        # 현재 상태 보기
  ```

### 🔍 설정 검증
- **`validate-v3-config.sh`** - 개발 환경 종합 검증
  - 필수 디렉터리와 파일 존재 여부 확인
  - JSON 설정 파일 유효성 검사
  - Node.js 및 개발 도구 확인
  - Git 저장소 상태 확인
  - 파일 권한 검증

### ⚡ 빠른 상태 확인
- **`v3-quick-status.sh`** - 개발 진행 상황 요약
  - 도메인, 에이전트, DDD 진행률 표시
  - 보안 및 성능 지표 표시
  - 색상으로 구분된 상태 표시
  - 현재 Git 브랜치 정보

## 헬퍼 스크립트 표준

### 파일 이름 규칙
- kebab-case 사용: `update-v3-progress.sh`
- 버전 접두사 포함: V3 전용 헬퍼는 `v3-*`
- 목적이 드러나는 설명적인 이름 사용

### 스크립트 요구 사항
- 실행 권한 필요 (`chmod +x`)
- 적절한 오류 처리 포함 (`set -e`)
- 인자 없이 호출하면 사용법 출력
- 일관된 종료 코드 사용 (0 = 성공, 0이 아니면 오류)

### 설정 연동
헬퍼는 `.claude/settings.json`에서 설정한다:
```json
{
  "helpers": {
    "directory": ".claude/helpers",
    "enabled": true,
    "v3ProgressUpdater": ".claude/helpers/update-v3-progress.sh"
  }
}
```

## 개발 지침

1. **보안 우선**: 모든 헬퍼는 입력값을 검증해야 한다
2. **멱등성**: 여러 번 실행해도 안전해야 한다
3. **빠른 실행**: 가능하면 1초 이내에 끝나야 한다
4. **명확한 출력**: 성공/오류 메시지를 분명하게 보여준다
5. **JSON 안전성**: JSON 파일을 수정할 때는 `jq`를 사용한다

## 새 헬퍼 추가하기

1. `.claude/helpers/`에 스크립트 작성
2. 실행 권한 부여: `chmod +x script-name.sh`
3. settings.json의 helpers 섹션에 추가
4. 커밋 전에 충분히 테스트
5. 이 README에 사용법 문서 추가
