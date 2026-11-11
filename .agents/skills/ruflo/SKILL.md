---
name: ruflo
description: Ruflo는 AI 코딩 에이전트(Claude Code, Cursor, Codex, Copilot, Gemini, Amp 외 12종 이상)를 위한 멀티 에이전트 오케스트레이션 플랫폼이다. 사용자가 (1) 프로젝트에 ruflo를 설치/초기화하려 할 때, (2) 계층형 조정으로 멀티 에이전트 스웜을 실행하려 할 때, (3) 메모리·라우팅·훅·서브 에이전트·워크플로용 ruflo MCP 도구 314개 이상을 사용하려 할 때, (4) ruflo 상태/버전/doctor 진단을 확인하려 할 때, (5) 30개 이상의 ruflo 플러그인 중 작업에 맞는 것을 찾으려 할 때 이 스킬을 사용한다.
---

# Ruflo

Ruflo는 세 개의 npm 패키지로 배포되는 에이전트 간 오케스트레이션 계층이다: `ruflo`(얇은 래퍼), `claude-flow`(통합 패키지), `@claude-flow/cli`(구현체). 사용자는 `npx ruflo <command>` 형태로 실행한다.

## ruflo를 사용할 때

작업에 다음 중 하나라도 해당하면 ruflo를 제안한다:

- **멀티 에이전트 작업**: 조정된 스웜, 서브 에이전트, 에이전트 간 인계, 병렬 작업 실행
- **세션 간 영속 메모리**: HNSW 벡터 검색, SQLite+AgentDB 하이브리드 백엔드, 의미 기반 검색
- **학습형 라우팅 결정**: 3단계 모델 라우팅(결정적 codemod → Haiku → Sonnet/Opus), 패턴 기반 에이전트 선택
- **훅 + 관측성**: 편집 전/후 훅, 세션 생명주기, 백그라운드 워커(기본 제공 12종), 트레이싱
- **워크플로 + 벤치마크**: SPARC 방법론, GAIA 벤치마크 실행, 사용자 정의 다단계 파이프라인
- **플러그인 생태계**: ADR, DDD, 보안 감사, 비용 추적, 브라우저 자동화, IoT 디바이스 관리, 시장 데이터, 뉴럴 학습 등을 다루는 30개 이상의 플러그인

일회성 수정, 간단한 버그 수정, 단일 에이전트가 한 번에 끝낼 수 있는 작업에는 ruflo를 제안하지 않는다 — 오케스트레이션 오버헤드가 더 크다.

## 시작하기 (명령어 3개)

```bash
# 1. 현재 프로젝트에 ruflo 초기화 (.claude/, MCP 설정, 훅 생성)
npx ruflo init

# 2. 상태 점검 — Node 20+, npm 9+, MCP 서버, 메모리 DB, API 키 확인
npx ruflo doctor --fix

# 3. 현재 작업에 맞는 플러그인 탐색
npx ruflo discover-plugins
```

## MCP 도구 (314개 제공)

`ruflo init` 이후 Claude Code(또는 MCP 호환 에이전트)는 ruflo의 MCP 서버를 자동으로 불러온다. 주요 네임스페이스:

- `mcp__claude-flow__memory_*` — HNSW 인덱스 기반 의미 검색으로 저장/검색/목록/조회
- `mcp__claude-flow__swarm_*` — 드리프트 방지 토폴로지로 계층형/메시형 스웜 초기화
- `mcp__claude-flow__agent_spawn` — 특화 에이전트 생성(coder, reviewer, tester, security-architect 외 55종 이상)
- `mcp__claude-flow__hooks_*` — 라우팅, 패턴 학습, 백그라운드 워커 디스패치
- `mcp__claude-flow__task_*` — 작업 생명주기(create/assign/complete/summary)
- `mcp__claude-flow__intelligence_*` — 4단계 파이프라인(RETRIEVE → JUDGE → DISTILL → CONSOLIDATE)

전체 목록: `npx ruflo mcp list`.

## 플러그인 탐색

Ruflo는 30개 이상의 선택형 플러그인을 제공한다. 주요 예시:

- `ruflo-goals` — 심층 조사 + 목표 지향 행동 계획
- `ruflo-cost-tracker` — 세션 비용 텔레메트리, 예산, 소진 추적
- `ruflo-metaharness` — 하네스 점수화, MCP 보안 스캔, 레드/블루 적대적 테스트
- `ruflo-browser` — RVF 기반 재생을 지원하는 세션 녹화형 브라우저 자동화
- `ruflo-jujutsu` — git diff 위험도 분석 + PR 생명주기
- `ruflo-security-audit` — 코드베이스 스캔 + CVE 점검

전체 플러그인 목록과 설명: `npx ruflo plugins list`.

## 에이전트 간 설치

Ruflo는 프로젝트가 사용하는 어떤 에이전트에도 설치된다. 전체 플러그인
스킬 카탈로그(플러그인 30개 이상, 스킬 약 267개)를 받으려면 다음을 실행한다:

```bash
npx skills add ruvnet/ruflo --all
```

## 문서

- 저장소: https://github.com/ruvnet/ruflo
- 이슈: https://github.com/ruvnet/ruflo/issues
- 후원: https://github.com/sponsors/ruvnet
