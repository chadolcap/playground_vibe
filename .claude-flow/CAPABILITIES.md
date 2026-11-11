# RuFlo V3 - 전체 기능 참조서
> 생성 시각: 2026-11-11T02:50:08.926Z
> 전체 문서: https://github.com/ruvnet/claude-flow

## 📋 목차

1. [개요](#개요)
2. [스웜 오케스트레이션](#스웜-오케스트레이션)
3. [사용 가능한 에이전트 (60개 이상)](#사용-가능한-에이전트)
4. [CLI 명령어 (명령어 26개, 하위 명령어 140개 이상)](#cli-명령어)
5. [훅 시스템 (훅 27개 + 워커 12개)](#훅-시스템)
6. [메모리와 인텔리전스 (RuVector)](#메모리와-인텔리전스)
7. [Hive-Mind 합의](#hive-mind-합의)
8. [성능 목표](#성능-목표)
9. [통합 생태계](#통합-생태계)

---

## 개요

RuFlo V3는 멀티 에이전트 AI 조정을 위한 도메인 주도 설계(DDD) 아키텍처로, 다음 기능을 제공한다:

- **15-에이전트 스웜 조정** - 계층형 및 메시형 토폴로지 지원
- **HNSW 벡터 검색** - 패턴 검색 150배~12,500배 고속화
- **SONA 뉴럴 학습** - 0.05ms 미만의 자기 최적화 적응
- **비잔틴 장애 허용** - 퀸(Queen) 주도 합의 메커니즘
- **MCP 서버 통합** - Model Context Protocol 지원

### 현재 설정
| 항목 | 값 |
|------|----|
| 토폴로지 | hierarchical-mesh |
| 최대 에이전트 수 | 15 |
| 메모리 백엔드 | hybrid |
| HNSW 인덱싱 | 사용 |
| 뉴럴 학습 | 사용 |
| LearningBridge | 사용 (SONA + ReasoningBank) |
| 지식 그래프 | 사용 (PageRank + 커뮤니티) |
| 에이전트 스코프 | 사용 (project/local/user) |

---

## 스웜 오케스트레이션

### 토폴로지
| 토폴로지 | 설명 | 적합한 경우 |
|----------|------|-------------|
| `hierarchical` | 퀸이 워커를 직접 제어 | 드리프트 방지, 엄격한 제어 |
| `mesh` | 완전 연결 P2P 네트워크 | 분산 작업 |
| `hierarchical-mesh` | V3 하이브리드 (권장) | 에이전트 10개 이상 |
| `ring` | 원형 통신 | 순차 워크플로 |
| `star` | 중앙 코디네이터 | 단순 조정 |
| `adaptive` | 부하에 따라 동적 변경 | 가변 작업량 |

### 전략
- `balanced` - 에이전트 간 균등 분배
- `specialized` - 명확한 역할, 중복 없음 (드리프트 방지)
- `adaptive` - 동적 작업 라우팅

### 빠른 명령어
```bash
# 스웜 초기화
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized

# 상태 확인
npx @claude-flow/cli@latest swarm status

# 활동 모니터링
npx @claude-flow/cli@latest swarm monitor
```

---

## 사용 가능한 에이전트

### 핵심 개발 (5)
`coder`, `reviewer`, `tester`, `planner`, `researcher`

### V3 특화 (4)
`security-architect`, `security-auditor`, `memory-specialist`, `performance-engineer`

### 스웜 조정 (5)
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`, `collective-intelligence-coordinator`, `swarm-memory-manager`

### 합의 및 분산 (7)
`byzantine-coordinator`, `raft-manager`, `gossip-coordinator`, `consensus-builder`, `crdt-synchronizer`, `quorum-manager`, `security-manager`

### 성능 및 최적화 (5)
`perf-analyzer`, `performance-benchmarker`, `task-orchestrator`, `memory-coordinator`, `smart-agent`

### GitHub 및 저장소 (9)
`github-modes`, `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`, `workflow-automation`, `project-board-sync`, `repo-architect`, `multi-repo-swarm`

### SPARC 방법론 (6)
`sparc-coord`, `sparc-coder`, `specification`, `pseudocode`, `architecture`, `refinement`

### 특화 개발 (8)
`backend-dev`, `mobile-dev`, `ml-developer`, `cicd-engineer`, `api-docs`, `system-architect`, `code-analyzer`, `base-template-generator`

### 테스트 및 검증 (2)
`tdd-london-swarm`, `production-validator`

### 작업별 에이전트 라우팅
| 작업 유형 | 권장 에이전트 | 토폴로지 |
|-----------|---------------|----------|
| 버그 수정 | researcher, coder, tester | mesh |
| 신규 기능 | coordinator, architect, coder, tester, reviewer | hierarchical |
| 리팩터링 | architect, coder, reviewer | mesh |
| 성능 | researcher, perf-engineer, coder | hierarchical |
| 보안 | security-architect, auditor, reviewer | hierarchical |
| 문서 | researcher, api-docs | mesh |

---

## CLI 명령어

### 핵심 명령어 (12)
| 명령어 | 하위 명령어 수 | 설명 |
|--------|----------------|------|
| `init` | 4 | 프로젝트 초기화 |
| `agent` | 8 | 에이전트 생명주기 관리 |
| `swarm` | 6 | 멀티 에이전트 조정 |
| `memory` | 11 | HNSW 검색 기반 AgentDB |
| `mcp` | 9 | MCP 서버 관리 |
| `task` | 6 | 작업 할당 |
| `session` | 7 | 세션 영속화 |
| `config` | 7 | 설정 |
| `status` | 3 | 시스템 모니터링 |
| `workflow` | 6 | 워크플로 템플릿 |
| `hooks` | 17 | 자기 학습 훅 |
| `hive-mind` | 6 | 합의 조정 |

### 고급 명령어 (14)
| 명령어 | 하위 명령어 수 | 설명 |
|--------|----------------|------|
| `daemon` | 5 | 백그라운드 워커 |
| `neural` | 5 | 패턴 학습 |
| `security` | 6 | 보안 스캔 |
| `performance` | 5 | 프로파일링 및 벤치마크 |
| `providers` | 5 | AI 제공자 설정 |
| `plugins` | 5 | 플러그인 관리 |
| `deployment` | 5 | 배포 관리 |
| `embeddings` | 4 | 벡터 임베딩 |
| `claims` | 4 | 권한 부여 |
| `migrate` | 5 | V2→V3 마이그레이션 |
| `process` | 4 | 프로세스 관리 |
| `doctor` | 1 | 상태 진단 |
| `completions` | 4 | 셸 자동 완성 |

### 명령어 예시
```bash
# 초기화
npx @claude-flow/cli@latest init --wizard

# 에이전트 생성
npx @claude-flow/cli@latest agent spawn -t coder --name my-coder

# 메모리 작업
npx @claude-flow/cli@latest memory store --key "pattern" --value "data" --namespace patterns
npx @claude-flow/cli@latest memory search --query "authentication"

# 진단
npx @claude-flow/cli@latest doctor --fix
```

---

## 훅 시스템

### 사용 가능한 훅 27개

#### 핵심 훅 (6)
| 훅 | 설명 |
|----|------|
| `pre-edit` | 파일 편집 전 컨텍스트 제공 |
| `post-edit` | 편집 결과 기록 |
| `pre-command` | 위험도 평가 |
| `post-command` | 명령 실행 지표 |
| `pre-task` | 작업 시작 + 에이전트 추천 |
| `post-task` | 작업 완료 학습 |

#### 세션 훅 (4)
| 훅 | 설명 |
|----|------|
| `session-start` | 세션 시작/복원 |
| `session-end` | 상태 저장 |
| `session-restore` | 이전 세션 복원 |
| `notify` | 에이전트 간 알림 |

#### 인텔리전스 훅 (5)
| 훅 | 설명 |
|----|------|
| `route` | 최적 에이전트 라우팅 |
| `explain` | 라우팅 결정 설명 |
| `pretrain` | 인텔리전스 초기 학습 |
| `build-agents` | 설정 생성 |
| `transfer` | 패턴 전이 |

#### 커버리지 훅 (3)
| 훅 | 설명 |
|----|------|
| `coverage-route` | 커버리지 기반 라우팅 |
| `coverage-suggest` | 개선 제안 |
| `coverage-gaps` | 공백 분석 |

### 백그라운드 워커 12개
| 워커 | 우선순위 | 목적 |
|------|----------|------|
| `ultralearn` | normal | 심층 지식 |
| `optimize` | high | 성능 |
| `consolidate` | low | 메모리 통합 |
| `predict` | normal | 예측 프리로드 |
| `audit` | critical | 보안 |
| `map` | normal | 코드베이스 매핑 |
| `preload` | low | 리소스 프리로드 |
| `deepdive` | normal | 심층 분석 |
| `document` | normal | 자동 문서화 |
| `refactor` | normal | 리팩터링 제안 |
| `benchmark` | normal | 벤치마킹 |
| `testgaps` | normal | 테스트 커버리지 공백 |

---

## 메모리와 인텔리전스

### RuVector 인텔리전스 시스템
- **SONA**: 자기 최적화 뉴럴 아키텍처 (0.05ms 미만)
- **MoE**: 전문가 혼합(Mixture of Experts) 라우팅
- **HNSW**: 검색 150배~12,500배 고속화
- **EWC++**: 파국적 망각 방지
- **Flash Attention**: 2.49배~7.47배 속도 향상
- **Int8 양자화**: 메모리 3.92배 절감

### 4단계 인텔리전스 파이프라인
1. **RETRIEVE** - HNSW 패턴 검색
2. **JUDGE** - 성공/실패 판정
3. **DISTILL** - LoRA 학습 추출
4. **CONSOLIDATE** - EWC++ 보존

### 자기 학습 메모리 (ADR-049)

| 구성 요소 | 상태 | 설명 |
|-----------|------|------|
| **LearningBridge** | ✅ 사용 | 인사이트를 SONA/ReasoningBank 뉴럴 파이프라인에 연결 |
| **MemoryGraph** | ✅ 사용 | PageRank 지식 그래프 + 커뮤니티 탐지 |
| **AgentMemoryScope** | ✅ 사용 | 3-스코프 에이전트 메모리 (project/local/user) |

**LearningBridge** - 인사이트가 학습 궤적(trajectory)을 트리거한다. 신뢰도는 접근 시 +0.03, 시간당 -0.005씩 감쇠하며 변한다. 통합 단계에서 JUDGE/DISTILL/CONSOLIDATE 파이프라인을 실행한다.

**MemoryGraph** - 항목 간 참조로 지식 그래프를 구성한다. PageRank로 영향력 있는 인사이트를 식별하고, 커뮤니티로 관련 지식을 묶는다. 그래프 인식 랭킹은 벡터 점수와 구조 점수를 혼합한다.

**AgentMemoryScope** - Claude Code의 3-스코프 디렉터리에 매핑된다:
- `project`: `<gitRoot>/.claude/agent-memory/<agent>/`
- `local`: `<gitRoot>/.claude/agent-memory-local/<agent>/`
- `user`: `~/.claude/agent-memory/<agent>/`

신뢰도가 높은 인사이트(0.8 초과)는 에이전트 간에 전이될 수 있다.

### 메모리 명령어
```bash
# 패턴 저장
npx @claude-flow/cli@latest memory store --key "name" --value "data" --namespace patterns

# 의미 기반 검색
npx @claude-flow/cli@latest memory search --query "authentication"

# 항목 목록 조회
npx @claude-flow/cli@latest memory list --namespace patterns

# 데이터베이스 초기화
npx @claude-flow/cli@latest memory init --force
```

---

## Hive-Mind 합의

### 퀸 유형
| 유형 | 역할 |
|------|------|
| Strategic Queen | 장기 계획 |
| Tactical Queen | 실행 조정 |
| Adaptive Queen | 동적 최적화 |

### 워커 유형 (8)
`researcher`, `coder`, `analyst`, `tester`, `architect`, `reviewer`, `optimizer`, `documenter`

### 합의 메커니즘
| 메커니즘 | 장애 허용 | 사용 사례 |
|----------|-----------|-----------|
| `byzantine` | 결함 노드 f < n/3 | 적대적 환경 |
| `raft` | 실패 노드 f < n/2 | 리더 기반 |
| `gossip` | 최종 일관성 | 대규모 |
| `crdt` | 충돌 없음 | 분산 환경 |
| `quorum` | 설정 가능 | 유연한 구성 |

### Hive-Mind 명령어
```bash
# 초기화
npx @claude-flow/cli@latest hive-mind init --queen-type strategic

# 상태 확인
npx @claude-flow/cli@latest hive-mind status

# 워커 생성
npx @claude-flow/cli@latest hive-mind spawn --count 5 --type worker

# 합의 제안
npx @claude-flow/cli@latest hive-mind consensus --propose "task"
```

---

## 성능 목표

| 지표 | 목표 | 상태 |
|------|------|------|
| HNSW 검색 | 150배~12,500배 고속화 | ✅ 구현됨 |
| 메모리 절감 | 50-75% | ✅ 구현됨 (3.92배) |
| SONA 통합 | 패턴 학습 | ✅ 구현됨 |
| Flash Attention | 2.49배~7.47배 | 🔄 진행 중 |
| MCP 응답 | 100ms 미만 | ✅ 달성 |
| CLI 시작 | 500ms 미만 | ✅ 달성 |
| SONA 적응 | 0.05ms 미만 | 🔄 진행 중 |
| 그래프 구축 (1k) | 200ms 미만 | ✅ 2.78ms (71.9배 여유) |
| PageRank (1k) | 100ms 미만 | ✅ 12.21ms (8.2배 여유) |
| 인사이트 기록 | 건당 5ms 미만 | ✅ 0.12ms (41배 여유) |
| 통합 | 500ms 미만 | ✅ 0.26ms (1,955배 여유) |
| 지식 전이 | 100ms 미만 | ✅ 1.25ms (80배 여유) |

---

## 통합 생태계

### 통합 패키지
| 패키지 | 버전 | 용도 |
|--------|------|------|
| agentic-flow | 3.0.0 | 핵심 조정 + ReasoningBank + Router |
| agentdb | 3.0.0-alpha.10 | 벡터 데이터베이스 + 컨트롤러 8개 |
| @ruvector/attention | 0.1.3 | Flash attention |
| @ruvector/sona | 0.1.5 | 뉴럴 학습 |

### 선택적 통합
| 패키지 | 명령어 |
|--------|--------|
| ruv-swarm | `npx ruv-swarm mcp start` |
| flow-nexus | `npx flow-nexus@latest mcp start` |
| agentic-jujutsu | `npx agentic-jujutsu@latest` |

### MCP 서버 설정
```bash
# Ruflo MCP 추가
claude mcp add ruflo -- npx -y ruflo@latest mcp start

# 선택적 서버
claude mcp add ruv-swarm -- npx -y ruv-swarm mcp start
claude mcp add flow-nexus -- npx -y flow-nexus@latest mcp start
```

---

## 빠른 참조

### 필수 명령어
```bash
# 설치
npx ruflo@latest init --wizard
npx ruflo@latest daemon start
npx ruflo@latest doctor --fix

# 스웜
npx ruflo@latest swarm init --topology hierarchical --max-agents 8
npx ruflo@latest swarm status

# 에이전트
npx ruflo@latest agent spawn -t coder
npx ruflo@latest agent list

# 메모리
npx ruflo@latest memory search --query "patterns"

# 훅
npx ruflo@latest hooks pre-task --description "task"
npx ruflo@latest hooks worker dispatch --trigger optimize
```

### 파일 구조
```
.claude-flow/
├── config.yaml      # 런타임 설정
├── CAPABILITIES.md  # 이 파일
├── data/            # 메모리 저장소
├── logs/            # 작업 로그
├── sessions/        # 세션 상태
├── hooks/           # 사용자 정의 훅
├── agents/          # 에이전트 설정
└── workflows/       # 워크플로 템플릿
```

---

**전체 문서**: https://github.com/ruvnet/claude-flow
**이슈**: https://github.com/ruvnet/claude-flow/issues
