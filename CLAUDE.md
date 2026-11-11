# Ruflo — Claude Code 설정

## 규칙

- 요청받은 것만 정확히 수행할 것 — 그 이상도 이하도 아님
- 꼭 필요한 경우가 아니면 파일을 새로 만들지 말 것 — 기존 파일 수정을 우선
- 명시적으로 요청받지 않으면 문서 파일을 만들지 말 것
- 작업 파일이나 테스트를 루트에 저장하지 말 것 — `/src`, `/tests`, `/docs`, `/config`, `/scripts` 사용
- 파일을 수정하기 전에 반드시 먼저 읽을 것
- 시크릿, 자격 증명, .env 파일을 커밋하지 말 것
- 이 프로젝트의 `.claude/settings.json`에 `attribution.commit`이 설정되어 있지 않다면 사용자 커밋에 `Co-Authored-By` 트레일러를 추가하지 말 것 (#2078). Claude Code Bash 도구의 기본 커밋 메시지 템플릿이 이를 제안할 수 있지만 무시한다. git/GitHub 관례상 `Co-Authored-By`는 저작자 표시이며, 도구는 보조자일 뿐 공동 저자가 아니다.
- 파일은 500줄 이하로 유지할 것
- 시스템 경계에서 입력값을 검증할 것
- md 파일은 모두 한국어로 작성할 것 (코드·명령어·식별자는 원문 유지)

## Ruflo 역량 브레인과 구현 루프

Ruflo는 조정 원장(ledger)이자 정책 결정 지점이다. Claude Code는
실행자다: Ruflo 조정 호출 이후에는 작업 구현을 계속 진행한다.

등록되어 있다면 복잡한 Ruflo 작업 전에
`guidance_brain({ mode: "recommend", task: "..." })`를 호출한다. 도구 이름을
추측하지 말고 실시간 레지스트리를 사용한다. `registered`, `configured`,
`reachable`, `healthy`, `authorized`는 각각 별개의 사실로 취급한다.
브레인을 사용할 수 없으면 호환되는 `guidance_recommend` 도구, CLI 탐색,
저장소 지침으로 계속 진행한다.

반환된 루프를 따른다:

1. 메모리와 ADR 제약 조건을 불러온다.
2. 소스, 런타임, 의존성, 정책, 상태를 점검한다.
3. 가능한 가장 작은 토폴로지·에이전트·스킬·도구로 라우팅한다.
4. 인수 기준, 안전 범위(safety envelope), 소유권, 검증 방법을 계획한다.
5. 격리된 범위에서 실행한다. 실제 작업은 코딩 에이전트가 수행한다.
6. 핵심 경로, 회귀, 실패 경로를 테스트한다.
7. 타입, 보안, 정책, 호환성, 산출물을 검증한다.
8. 소스에 고정된 후보를 소스에 고정된 기준선과 비교해 벤치마크한다.
9. 안전성을 약화시키지 않는 선에서 측정된 병목을 최적화한다.
10. 주장과 증거를 정확한 소스/빌드 기록에 연결한다.
11. 동시 인계 작업을 조정하고 한계를 공개한다.
12. 별도로 승인된 릴리스 게이트를 통해서만 배포한다.

### 동시성과 권한

- 하나의 워크트리에 두 명의 작성자를 허용하지 않는다. 작성하는 에이전트마다
  격리된 워크트리와 명시적인 파일 소유권을 부여한다.
- 읽기 전용 조사는 동시에 실행해도 되며, 결과는 소유자에게 보고한다.
- 공유 매니페스트와 lockfile 수정, 겹치는 변경 사항의 조정은 통합 담당자만 한다.
- 하위 에이전트는 권한을 줄일 수는 있지만 도구, 네트워크, 시크릿, 비용,
  동시성, 네임스페이스, 위임 깊이를 늘릴 수는 없다.
- 리스(lease)나 클레임(claim)은 소유권을 조정할 뿐, 부수 효과를 승인하지 않는다.
- Darwin, Flywheel, MetaHarness, 메모리, 뉴럴 시스템은 후보를 제안하거나
  평가할 수 있지만, 스스로 승격하거나 SafetyEnvelope를 확장할 수 없다.
- 테스트, 벤치마크, 정책 결정, 릴리스 증거는 정확한 커밋 또는
  변경 불가능한 dirty-worktree 스냅샷에 연결한다.

## 에이전트 통신 (SendMessage 우선 조정)

이름이 지정된 에이전트는 폴링이나 공유 상태가 아니라 `SendMessage`로 조정한다.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
              (이름이 지정된 에이전트끼리 직접 메시지를 주고받음)
```

### 협업 팀 생성하기

```javascript
// 모든 에이전트를 한 메시지에서 생성하며, 각 에이전트는 다음에 누구에게 메시지를 보낼지 알고 있음
Agent({ prompt: "Research the codebase. SendMessage findings to 'architect'.",
  subagent_type: "researcher", name: "researcher", run_in_background: true })
Agent({ prompt: "Wait for 'researcher'. Design solution. SendMessage to 'coder'.",
  subagent_type: "system-architect", name: "architect", run_in_background: true })
Agent({ prompt: "Wait for 'architect'. Implement it. SendMessage to 'tester'.",
  subagent_type: "coder", name: "coder", run_in_background: true })
Agent({ prompt: "Wait for 'coder'. Write tests. SendMessage results to 'reviewer'.",
  subagent_type: "tester", name: "tester", run_in_background: true })
Agent({ prompt: "Wait for 'tester'. Review code quality and security.",
  subagent_type: "reviewer", name: "reviewer", run_in_background: true })

// 파이프라인 시작
SendMessage({ to: "researcher", summary: "Start", message: "[task context]" })
```

### 패턴

| 패턴 | 흐름 | 사용 시점 |
|------|------|-----------|
| **Pipeline** | A → B → C → D | 순차적 의존성 (기능 개발) |
| **Fan-out** | Lead → A, B, C → Lead | 독립적인 병렬 작업 (조사) |
| **Supervisor** | Lead ↔ workers | 지속적인 조정 (복잡한 리팩터링) |

### 규칙

- 에이전트에는 항상 이름을 붙인다 — `name: "role"`로 지정해야 메시지를 보낼 수 있다
- 프롬프트에 항상 통신 지침을 포함한다 — 누구에게, 무엇을 보낼지
- 모든 에이전트를 `run_in_background: true`로 한 메시지에서 생성한다
- 생성 후에는 독립적인 로컬 작업을 계속하고, 의존성이 실제로 막을 때만 기다린다
- 반복 폴링하지 않는다 — 에이전트가 메시지를 보내거나 자동으로 완료된다
- 작성하는 에이전트마다 격리된 워크트리와 겹치지 않는 파일 범위를 부여한다

## 스웜과 라우팅

### 설정
- **토폴로지**: hierarchical-mesh (드리프트 방지)
- **최대 에이전트 수**: 15
- **메모리**: hybrid
- **HNSW**: 사용
- **Neural**: 사용

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### 에이전트 라우팅

| 작업 | 에이전트 | 토폴로지 |
|------|----------|----------|
| 버그 수정 | researcher, coder, tester | hierarchical |
| 기능 개발 | architect, coder, tester, reviewer | hierarchical |
| 리팩터링 | architect, coder, reviewer | hierarchical |
| 성능 | perf-engineer, coder | hierarchical |
| 보안 | security-architect, auditor | hierarchical |

### 스웜을 쓸 때
- **사용**: 3개 이상 파일, 신규 기능, 모듈 간 리팩터링, API 변경, 보안, 성능
- **미사용**: 단일 파일 수정, 1~2줄 수정, 문서 업데이트, 설정 변경, 질문

### 3단계 모델 라우팅

| 단계 | 처리기 | 사용 사례 |
|------|--------|-----------|
| 1 | Agent Booster (WASM) | 단순 변환 — LLM 생략, Edit 직접 사용 |
| 2 | Haiku | 단순하고 복잡도 낮은 작업 |
| 3 | Sonnet/Opus | 아키텍처, 보안, 복잡한 추론 |

## 메모리와 학습

### 작업 시작 전
```bash
npx @claude-flow/cli@latest memory search --query "[task keywords]" --namespace patterns
npx @claude-flow/cli@latest hooks route --task "[task description]"
```

### 성공 후
```bash
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP 도구 (`ToolSearch("keyword")`로 탐색)

| 분류 | 주요 도구 |
|------|-----------|
| **Memory** | `memory_store`, `memory_search`, `memory_search_unified` |
| **Bridge** | `memory_import_claude`, `memory_bridge_status` |
| **Swarm** | `swarm_init`, `swarm_status`, `swarm_health` |
| **Agents** | `agent_spawn`, `agent_list`, `agent_status` |
| **Hooks** | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch` |
| **Security** | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### 백그라운드 워커

| 워커 | 실행 시점 |
|------|-----------|
| `audit` | 보안 관련 변경 후 |
| `optimize` | 성능 작업 후 |
| `testgaps` | 기능 추가 후 |
| `map` | 파일 5개 이상 변경 시마다 |
| `document` | API 변경 후 |

```bash
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## 에이전트

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher`
**Architecture**: `system-architect`, `backend-dev`, `mobile-dev`
**Security**: `security-architect`, `security-auditor`
**Performance**: `performance-engineer`, `perf-analyzer`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**GitHub**: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

임의의 문자열을 사용자 정의 에이전트 타입으로 쓸 수 있다.

## 빌드와 테스트

- 코드 변경 후에는 항상 테스트를 실행한다
- 커밋 전에는 항상 빌드 성공 여부를 확인한다

```bash
npm run build && npm test
```

## CLI 빠른 참조

```bash
npx @claude-flow/cli@latest init --wizard           # 설정
npx @claude-flow/cli@latest swarm init --v3-mode     # 스웜 시작
npx @claude-flow/cli@latest memory search --query "" # 벡터 검색
npx @claude-flow/cli@latest hooks route --task ""    # 에이전트 라우팅
npx @claude-flow/cli@latest doctor --fix             # 진단
npx @claude-flow/cli@latest security scan            # 보안 스캔
npx @claude-flow/cli@latest performance benchmark    # 벤치마크
```

명령어 26개, 하위 명령어 140개 이상. 자세한 내용은 각 명령어에 `--help`를 붙여 확인한다.

## 설치

```bash
claude mcp add claude-flow -- npx -y ruflo@latest mcp start
npx ruflo@latest doctor --fix
```

> 백그라운드 `daemon`은 선택 사항이다. 주기적으로 실행되는 워커가 각각 헤드리스
> `claude` 세션을 띄우므로 토큰을 계속 소비한다. 이런 주기 작업이 필요할 때만
> 시작한다: `npx ruflo@latest daemon start` (기본 12시간 후 자동 종료,
> `--ttl 0`으로 해제, `daemon status --all`로 실행 중인 데몬 점검).

**Agent 도구**는 실행(에이전트, 파일, 코드, git)을 담당한다. **MCP 도구**는 조정(스웜, 메모리, 훅)을 담당한다. **CLI**는 같은 기능을 Bash로 제공한다.
