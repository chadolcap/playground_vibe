---
name: verification-quality
description: |
  ruflo에 포함되어 배포된(shipped) 분석 명령(analyze diff, analyze complexity, analyze code)으로 코드 품질(code quality)과 변경 위험(change risk)을 점검하고, ruflo 자체의 CI regression guard를 실행하거나 확장한다. 변경의 위험도를 평가하거나, 복잡도 핫스팟(complexity hot spots)을 찾거나, ruflo에 regression guard를 추가할 때 사용한다. 이 파일 뒷부분에 나오는 truth-scoring과 auto-rollback 명령은 설계 메모일 뿐 배포된 CLI 명령이 아니다.
---

# 검증 및 품질 보증 스킬

## 이 스킬이 하는 일

이 스킬은 다음을 통해 코드 품질과 정확성을 보장하는 종합 검증·품질 보증 시스템을 제공한다.

- **Truth Scoring**: 코드·에이전트·작업에 대한 실시간 신뢰도 지표(0.0~1.0 척도)
- **검증 점검**: 코드 정확성, 보안, 모범 사례를 자동으로 검증
- **자동 롤백**: 검증에 실패한 변경을 즉시 되돌림(기본 임계값: 0.95)
- **품질 지표**: 추세, 신뢰 구간, 개선 추적을 포함한 통계 분석
- **CI/CD 연동**: 지속적 통합 파이프라인용 내보내기 기능
- **실시간 모니터링**: 지속적인 검증을 위한 라이브 대시보드와 감시(watch) 모드

> **배포된 것과 계획된 것.** *실제로 CI에서 돌아가는* 검증 스택 — 회귀 방지(regression-guard) 작업 6개 + witness manifest + 도구 발견성(tool-discoverability) 감사 — 은 실제로 존재하며 모든 push에서 실행된다. 이 문서 뒷부분에서 설명하는 truth-scoring / auto-rollback / WebSocket 대시보드는 일부만 배포되었고(`ruflo verify`가 witness 점검을 실행한다) 나머지는 설계 단계다 — 아래 "CI Guards" 절을 현재 상태의 공식 기준으로 삼는다.

## CI Guards — 실제로 배포된 것 (현재 상태)

Ruflo의 회귀 방지는 세 계층으로 이루어지며, 모두 publish 전에 게이트로 걸린다. 공식 참고 문서: [`verification/README.md`](../../../verification/README.md).

| 계층 | 내용 | `.github/workflows/v3-ci.yml` 안의 CI 작업 | ADR |
|---|---|---|---|
| **1 — 설치/동작 smoke** | 실제 빌드를 대상으로 사용자에게 보이는 실패 유형을 실행해 본다 | `smoke-install-no-bsqlite` (prebuild가 없는 플랫폼에서 npm install), `plugin-hooks-smoke` (#1859/#1862 — hook 플래그 파싱), `mcp-protocol-smoke` (#1874 — HTTP MCP 와이어 포맷), `memory-import-smoke` (#1883/#1884 — WSL 경로 + 키 정제), `mcp-roundtrip-smoke` (#1889 짝 도구 왕복 + #1863 cli-no-crash + ADR-095 G2 consensus-transport) | ADR-102 |
| **1 — 발견성 게이트** | 모든 MCP 도구 설명은 "언제 네이티브 도구 대신 이것을 쓰는가?"에 답해야 한다 | `tool-descriptions-audit` — `scripts/audit-tool-descriptions.mjs`, 기준선은 `verification/mcp-tool-baseline.json` (단조 감소: noGuidance / tooShort / duplicates) | ADR-112 |
| **2 — 암호학적 witness** | 문서화된 모든 수정의 핵심 마커가 dist에 여전히 있어야 한다; Ed25519 서명, OS별 번들 | `witness-verify` (ubuntu/macos/windows) — `verification/<os>/manifest.md.json`을 대상으로 `plugins/ruflo-core/scripts/witness/verify.mjs` 실행 | ADR-103 |
| **3 — 시간 이력** | 회귀가 언제 들어왔는가 | `verification/<os>/history.jsonl` + `history.mjs` (`summary` / `regressions` / `timeline`) | ADR-103 |

### 가드를 로컬에서 실행하기

```bash
# Tool-description discoverability audit (ADR-112)
node scripts/audit-tool-descriptions.mjs                       # fails if any baseline count rises
node scripts/audit-tool-descriptions.mjs --update-baseline     # lock the new floor after a fix lands

# Behavioral smokes (each builds what it needs; safe to run individually)
node plugins/ruflo-core/scripts/test-hooks.mjs "node $PWD/v3/@claude-flow/cli/bin/cli.js"
node plugins/ruflo-core/scripts/test-mcp-protocol.mjs
node plugins/ruflo-core/scripts/test-memory-import.mjs
node plugins/ruflo-core/scripts/test-mcp-roundtrips.mjs        # #1889 paired-tool round-trip
node plugins/ruflo-core/scripts/test-cli-no-crash.mjs          # #1863 unhandled-exception class
node plugins/ruflo-core/scripts/test-consensus-transport.mjs   # ADR-095 G2 consensus transport

# Witness manifest — regenerate + verify
node scripts/regen-witness.mjs
node plugins/ruflo-core/scripts/witness/verify.mjs --manifest verification/macos/manifest.md.json

# Temporal history
node plugins/ruflo-core/scripts/witness/history.mjs --history verification/macos/history.jsonl summary
node plugins/ruflo-core/scripts/witness/history.mjs --history verification/macos/history.jsonl regressions
```

### 새 가드 추가하기

1. **동작 smoke** → `plugins/ruflo-core/scripts/test-<name>.mjs`를 작성한다. 패턴: 먼저 정적 dist 스캔(빠르고 항상 끝남), 다음으로 내부 타임아웃 + 프로세스 수준 watchdog을 둔 동작 프로브를 실행해 CI가 절대 멈추지 않게 한다. `v3-ci.yml`의 해당 작업에 단계를 추가한다.
2. **기준선이 있는 정적 게이트** → 스캔해서 위반 수를 세고, 그 수가 `verification/<name>-baseline.json`의 단조 감소 기준선을 넘으면 실패하는 `scripts/audit-<name>.mjs`를 작성한다. `--update-baseline`을 지원한다. CI 작업을 추가하고, `publish`를 게이트해야 한다면 `witness-verify`의 `needs[]`에 연결한다.
3. **문서화된 수정 마커** → `verification/witness-fixes.json`에 `{ id, desc, file, marker }`를 추가하고 `node scripts/regen-witness.mjs`를 실행한다. 마커는 그 수정이 고유하게 만들어 내는 부분 문자열이어야 한다(`'function'` 같은 일반 패턴이면 안 된다).

## 사전 요구 사항

- Ruflo 설치 (`npx ruflo@latest`)
- Git 저장소 (롤백 기능용)
- Node.js 18+ (대시보드 기능용)
- `@noble/ed25519` (witness 검증기용 — 런타임 의존성 하나, `npm i @noble/ed25519`)

## 빠른 시작

다음 명령은 현재 CLI에 포함되어 있다.

```bash
# Change risk since HEAD~1 (without --risk it also shows classification and reviewers)
npx ruflo@latest analyze diff HEAD~1 --risk

# Complexity hot spots in a directory
npx ruflo@latest analyze complexity src/ --threshold 15

# Size, functions and TODOs per file
npx ruflo@latest analyze code -p ./src
```

truth-scoring, `verify check`, `verify rollback` 명령은 존재하지 않는다(`ruflo verify`는 설치된 ruflo 패키지를 서명된 witness manifest와 대조해 점검할 뿐이다). 에이전트 출력을 검증하려면 프로젝트 자체의 테스트·린터·타입 검사를 실행하고, 롤백은 git으로 한다(`git restore <file>`, `git revert <commit>`). ruflo 저장소 안에서는 [가드를 로컬에서 실행하기](#run-the-guards-locally)의 가드를 실행한다.

---

## 전체 가이드

> **설계 메모이며 배포되지 않았다.** 아래 내용은 모두 계획 중인 truth-scoring, 검증, 롤백 기능을 설명한다. `ruflo truth`, `ruflo verify check`, `ruflo verify rollback`은 현재 CLI에 없는 명령이므로 아래 예시를 실행하지 말고, 대신 [빠른 시작](#quick-start)의 명령을 사용한다.

### Truth Scoring 시스템

#### Truth 지표 보기

코드베이스와 에이전트 작업에 대한 종합 품질·신뢰도 지표를 표시한다.

**기본 사용법:**
```bash
# View current truth scores (default: table format)
npx ruflo@alpha truth

# View scores for specific time period
npx ruflo@alpha truth --period 7d

# View scores for specific agent
npx ruflo@alpha truth --agent coder --period 24h

# Find files/tasks below threshold
npx ruflo@alpha truth --threshold 0.8
```

**출력 형식:**
```bash
# Table format (default)
npx ruflo@alpha truth --format table

# JSON for programmatic access
npx ruflo@alpha truth --format json

# CSV for spreadsheet analysis
npx ruflo@alpha truth --format csv

# HTML report with visualizations
npx ruflo@alpha truth --format html --export report.html
```

**실시간 모니터링:**
```bash
# Watch mode with live updates
npx ruflo@alpha truth --watch

# Export metrics automatically
npx ruflo@alpha truth --export .claude-flow/metrics/truth-$(date +%Y%m%d).json
```

#### Truth Score 대시보드

대시보드 출력 예시:
```
📊 Truth Metrics Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Truth Score: 0.947 ✅
Trend: ↗️ +2.3% (7d)

Top Performers:
  verification-agent   0.982 ⭐
  code-analyzer       0.971 ⭐
  test-generator      0.958 ✅

Needs Attention:
  refactor-agent      0.821 ⚠️
  docs-generator      0.794 ⚠️

Recent Tasks:
  task-456  0.991 ✅  "Implement auth"
  task-455  0.967 ✅  "Add tests"
  task-454  0.743 ❌  "Refactor API"
```

#### 지표 설명

**Truth Score (0.0~1.0):**
- `1.0-0.95`: 우수 ⭐ (프로덕션 투입 가능)
- `0.94-0.85`: 양호 ✅ (허용 가능한 품질)
- `0.84-0.75`: 경고 ⚠️ (주의 필요)
- `<0.75`: 심각 ❌ (즉시 조치 필요)

**추세 표시:**
- ↗️ 개선 중 (상승 추세)
- → 안정 (일관된 성능)
- ↘️ 하락 중 (품질 회귀 감지)

**통계:**
- **평균 점수**: 모든 측정값의 truth score 평균
- **중앙값 점수**: 가운데 값 (이상치의 영향을 덜 받음)
- **표준 편차**: 점수의 일관성 (낮을수록 일관됨)
- **신뢰 구간**: 측정값의 통계적 신뢰도

### 검증 점검

#### 검증 실행

코드, 작업, 에이전트 출력에 대해 종합 검증 점검을 실행한다.

**파일 검증:**
```bash
# Verify single file
npx ruflo@alpha verify check --file src/app.js

# Verify directory recursively
npx ruflo@alpha verify check --directory src/

# Verify with auto-fix enabled
npx ruflo@alpha verify check --file src/utils.js --auto-fix

# Verify current working directory
npx ruflo@alpha verify check
```

**작업 검증:**
```bash
# Verify specific task output
npx ruflo@alpha verify check --task task-123

# Verify with custom threshold
npx ruflo@alpha verify check --task task-456 --threshold 0.99

# Verbose output for debugging
npx ruflo@alpha verify check --task task-789 --verbose
```

**일괄 검증:**
```bash
# Verify multiple files in parallel
npx ruflo@alpha verify batch --files "*.js" --parallel

# Verify with pattern matching
npx ruflo@alpha verify batch --pattern "src/**/*.ts"

# Integration test suite
npx ruflo@alpha verify integration --test-suite full
```

#### 검증 기준

검증 시스템은 다음을 평가한다.

1. **코드 정확성**
   - 문법 검증
   - 타입 검사 (TypeScript)
   - 로직 흐름 분석
   - 오류 처리 완전성

2. **모범 사례**
   - 코드 스타일 준수
   - SOLID 원칙
   - 디자인 패턴 활용
   - 모듈성과 재사용성

3. **보안**
   - 취약점 스캔
   - 시크릿 탐지
   - 입력 검증
   - 인증/인가 점검

4. **성능**
   - 알고리즘 복잡도
   - 메모리 사용 패턴
   - 데이터베이스 쿼리 최적화
   - 번들 크기 영향

5. **문서화**
   - JSDoc/TypeDoc 완전성
   - README 정확성
   - API 문서
   - 코드 주석 품질

#### CI/CD용 JSON 출력

```bash
# Get structured JSON output
npx ruflo@alpha verify check --json > verification.json

# Example JSON structure:
{
  "overallScore": 0.947,
  "passed": true,
  "threshold": 0.95,
  "checks": [
    {
      "name": "code-correctness",
      "score": 0.98,
      "passed": true
    },
    {
      "name": "security",
      "score": 0.91,
      "passed": false,
      "issues": [...]
    }
  ]
}
```

### 자동 롤백

#### 실패한 변경 롤백

검증 점검에 실패한 변경을 자동으로 되돌린다.

**기본 롤백:**
```bash
# Rollback to last known good state
npx ruflo@alpha verify rollback --last-good

# Rollback to specific commit
npx ruflo@alpha verify rollback --to-commit abc123

# Interactive rollback with preview
npx ruflo@alpha verify rollback --interactive
```

**스마트 롤백:**
```bash
# Rollback only failed files (preserve good changes)
npx ruflo@alpha verify rollback --selective

# Rollback with automatic backup
npx ruflo@alpha verify rollback --backup-first

# Dry-run mode (preview without executing)
npx ruflo@alpha verify rollback --dry-run
```

**롤백 성능:**
- Git 기반 롤백: <1초
- 선택적 파일 롤백: <500ms
- 백업 생성: 롤백 전에 자동 수행

### 검증 리포트

#### 리포트 생성

지표와 시각화를 포함한 상세 검증 리포트를 만든다.

**리포트 형식:**
```bash
# JSON report
npx ruflo@alpha verify report --format json

# HTML report with charts
npx ruflo@alpha verify report --export metrics.html --format html

# CSV for data analysis
npx ruflo@alpha verify report --format csv --export metrics.csv

# Markdown summary
npx ruflo@alpha verify report --format markdown
```

**기간별 리포트:**
```bash
# Last 24 hours
npx ruflo@alpha verify report --period 24h

# Last 7 days
npx ruflo@alpha verify report --period 7d

# Last 30 days with trends
npx ruflo@alpha verify report --period 30d --include-trends

# Custom date range
npx ruflo@alpha verify report --from 2025-01-01 --to 2025-01-31
```

**리포트 내용:**
- 전체 truth score
- 에이전트별 성능 지표
- 작업 완료 품질
- 검증 통과/실패율
- 롤백 빈도
- 품질 개선 추세
- 통계적 신뢰 구간

### 대화형 대시보드

#### 대시보드 실행

실시간으로 갱신되는 웹 기반 대화형 검증 대시보드를 실행한다.

```bash
# Launch dashboard on default port (3000)
npx ruflo@alpha verify dashboard

# Custom port
npx ruflo@alpha verify dashboard --port 8080

# Export dashboard data
npx ruflo@alpha verify dashboard --export

# Dashboard with auto-refresh
npx ruflo@alpha verify dashboard --refresh 5s
```

**대시보드 기능:**
- 실시간 truth score 갱신 (WebSocket)
- 대화형 차트와 그래프
- 에이전트 성능 비교
- 작업 이력 타임라인
- 롤백 이력 뷰어
- PDF/HTML로 내보내기
- 기간/에이전트/점수별 필터

### 설정

#### 기본 설정

`.claude-flow/config.json`에서 검증 환경을 설정한다.

```json
{
  "verification": {
    "threshold": 0.95,
    "autoRollback": true,
    "gitIntegration": true,
    "hooks": {
      "preCommit": true,
      "preTask": true,
      "postEdit": true
    },
    "checks": {
      "codeCorrectness": true,
      "security": true,
      "performance": true,
      "documentation": true,
      "bestPractices": true
    }
  },
  "truth": {
    "defaultFormat": "table",
    "defaultPeriod": "24h",
    "warningThreshold": 0.85,
    "criticalThreshold": 0.75,
    "autoExport": {
      "enabled": true,
      "path": ".claude-flow/metrics/truth-daily.json"
    }
  }
}
```

#### 임계값 설정

**검증 엄격도 조정:**
```bash
# Strict mode (99% accuracy required)
npx ruflo@alpha verify check --threshold 0.99

# Lenient mode (90% acceptable)
npx ruflo@alpha verify check --threshold 0.90

# Set default threshold
npx ruflo@alpha config set verification.threshold 0.98
```

**환경별 임계값:**
```json
{
  "verification": {
    "thresholds": {
      "production": 0.99,
      "staging": 0.95,
      "development": 0.90
    }
  }
}
```

### 연동 예시

#### CI/CD 연동

**GitHub Actions:**
```yaml
name: Quality Verification

on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Dependencies
        run: npm install

      - name: Run Verification
        run: |
          npx ruflo@alpha verify check --json > verification.json

      - name: Check Truth Score
        run: |
          score=$(jq '.overallScore' verification.json)
          if (( $(echo "$score < 0.95" | bc -l) )); then
            echo "Truth score too low: $score"
            exit 1
          fi

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: verification-report
          path: verification.json
```

**GitLab CI:**
```yaml
verify:
  stage: test
  script:
    - npx ruflo@alpha verify check --threshold 0.95 --json > verification.json
    - |
      score=$(jq '.overallScore' verification.json)
      if [ $(echo "$score < 0.95" | bc) -eq 1 ]; then
        echo "Verification failed with score: $score"
        exit 1
      fi
  artifacts:
    paths:
      - verification.json
    reports:
      junit: verification.json
```

#### Swarm 연동

swarm 작업 중에 검증을 자동으로 실행한다.

```bash
# Swarm with verification enabled
npx ruflo@alpha swarm --verify --threshold 0.98

# Hive Mind with auto-rollback
npx ruflo@alpha hive-mind --verify --rollback-on-fail

# Training pipeline with verification
npx ruflo@alpha train --verify --threshold 0.99
```

#### 페어 프로그래밍 연동

협업 개발 중에 실시간 검증을 켠다.

```bash
# Pair with verification
npx ruflo@alpha pair --verify --real-time

# Pair with custom threshold
npx ruflo@alpha pair --verify --threshold 0.97 --auto-fix
```

### 고급 워크플로

#### 지속적 검증

개발하는 동안 코드베이스를 지속적으로 모니터링한다.

```bash
# Watch directory for changes
npx ruflo@alpha verify watch --directory src/

# Watch with auto-fix
npx ruflo@alpha verify watch --directory src/ --auto-fix

# Watch with notifications
npx ruflo@alpha verify watch --notify --threshold 0.95
```

#### 모니터링 연동

외부 모니터링 시스템으로 지표를 보낸다.

```bash
# Export to Prometheus
npx ruflo@alpha truth --format json | \
  curl -X POST https://pushgateway.example.com/metrics/job/claude-flow \
  -d @-

# Send to DataDog
npx ruflo@alpha verify report --format json | \
  curl -X POST "https://api.datadoghq.com/api/v1/series?api_key=${DD_API_KEY}" \
  -H "Content-Type: application/json" \
  -d @-

# Custom webhook
npx ruflo@alpha truth --format json | \
  curl -X POST https://metrics.example.com/api/truth \
  -H "Content-Type: application/json" \
  -d @-
```

#### Pre-commit 훅

커밋 전에 자동으로 검증한다.

```bash
# Install pre-commit hook
npx ruflo@alpha verify install-hook --pre-commit

# .git/hooks/pre-commit example:
#!/bin/bash
npx ruflo@alpha verify check --threshold 0.95 --json > /tmp/verify.json

score=$(jq '.overallScore' /tmp/verify.json)
if (( $(echo "$score < 0.95" | bc -l) )); then
  echo "❌ Verification failed with score: $score"
  echo "Run 'npx ruflo@alpha verify check --verbose' for details"
  exit 1
fi

echo "✅ Verification passed with score: $score"
```

### 성능 지표

**검증 속도:**
- 단일 파일 점검: <100ms
- 디렉터리 스캔: <500ms (파일 100개당)
- 전체 코드베이스 분석: <5s (일반적인 프로젝트)
- Truth score 계산: <50ms

**롤백 속도:**
- Git 기반 롤백: <1s
- 선택적 파일 롤백: <500ms
- 백업 생성: <2s

**대시보드 성능:**
- 초기 로딩: <1s
- 실시간 갱신: 지연 <100ms (WebSocket)
- 차트 렌더링: 60 FPS

### 문제 해결

#### 자주 겪는 문제

**Truth Score가 낮다:**
```bash
# Get detailed breakdown
npx ruflo@alpha truth --verbose --threshold 0.0

# Check specific criteria
npx ruflo@alpha verify check --verbose

# View agent-specific issues
npx ruflo@alpha truth --agent <agent-name> --format json
```

**롤백 실패:**
```bash
# Check git status
git status

# View rollback history
npx ruflo@alpha verify rollback --history

# Manual rollback
git reset --hard HEAD~1
```

**검증 타임아웃:**
```bash
# Increase timeout
npx ruflo@alpha verify check --timeout 60s

# Verify in batches
npx ruflo@alpha verify batch --batch-size 10
```

### 종료 코드

검증 명령은 표준 종료 코드를 반환한다.

- `0`: 검증 통과 (점수 ≥ 임계값)
- `1`: 검증 실패 (점수 < 임계값)
- `2`: 검증 중 오류 (잘못된 입력, 시스템 오류)

### 관련 명령

- `npx ruflo@alpha pair` - 검증을 곁들인 협업 개발
- `npx ruflo@alpha train` - 검증 피드백을 활용한 학습
- `npx ruflo@alpha swarm` - 품질 점검을 포함한 다중 에이전트 조정
- `npx ruflo@alpha report` - 종합 프로젝트 리포트 생성

### 모범 사례

1. **적절한 임계값을 정한다**: 핵심 코드는 0.99, 일반 코드는 0.95, 실험 코드는 0.90을 쓴다
2. **자동 롤백을 켠다**: 나쁜 코드가 남지 않게 막는다
3. **추세를 모니터링한다**: 현재 점수만이 아니라 시간에 따른 개선을 추적한다
4. **CI/CD와 연동한다**: 검증을 파이프라인의 일부로 만든다
5. **watch 모드를 쓴다**: 개발 중에 즉시 피드백을 받는다
6. **지표를 내보낸다**: 모니터링 시스템에서 품질 지표를 추적한다
7. **롤백을 검토한다**: 변경이 거부된 이유를 파악한다
8. **에이전트를 학습시킨다**: 검증 피드백으로 에이전트 성능을 높인다

### 추가 자료

- Truth Scoring 알고리즘: `/docs/truth-scoring.md` 참고
- 검증 기준: `/docs/verification-criteria.md` 참고
- 연동 예시: `/examples/verification/` 참고
- API 레퍼런스: `/docs/api/verification.md` 참고
