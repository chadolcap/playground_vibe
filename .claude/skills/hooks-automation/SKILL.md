---
name: hooks-automation
description: MCP 연동 지능형 hooks로 Claude Code 작업을 자동으로 조정·포맷팅·학습한다. pre/post task hooks, session management, Git integration, memory coordination, neural pattern training을 포함해 개발 워크플로를 강화한다.
---

# Hooks 자동화

MCP 도구와 neural pattern training에 연동된 hooks를 통해 Claude Code 작업을 조정하고 검증하며 학습하는 지능형 자동화 시스템이다.

## 이 스킬이 하는 일

이 스킬은 개발 작업을 자동으로 관리하고, 스웜 에이전트를 조정하며, 세션 상태를 유지하고, 코딩 패턴에서 지속적으로 학습하는 종합 hook 시스템을 제공한다. 에이전트 자동 배정, 코드 포맷팅, 성능 추적, 세션 간 메모리 유지를 가능하게 한다.

**핵심 기능:**
- **작업 전 Hooks**: 작업 전에 검증하고 준비하며 에이전트를 자동 배정한다
- **작업 후 Hooks**: 작업 후에 포맷팅하고 분석하며 패턴을 학습한다
- **세션 관리**: 상태를 유지하고 컨텍스트를 복원하며 요약을 생성한다
- **메모리 조정**: 스웜 에이전트 간 지식을 동기화한다
- **Git 연동**: 품질 검증이 포함된 자동 커밋 hooks
- **Neural 학습**: 성공한 패턴에서 지속적으로 학습한다
- **MCP 연동**: 스웜 도구와 매끄럽게 조정한다

## 사전 요구 사항

**필수:**
- Claude Flow CLI 설치 (`npm install -g claude-flow@alpha`)
- hooks가 활성화된 Claude Code
- hook 설정이 담긴 `.claude/settings.json`

**선택:**
- MCP 서버 설정 (claude-flow, ruv-swarm, flow-nexus)
- 버전 관리를 위한 Git 저장소
- 품질 검증을 위한 테스트 프레임워크

## 빠른 시작

### Hooks 시스템 초기화

```bash
# Initialize with default hooks configuration
npx @claude-flow/cli@latest init --hooks
```

다음이 생성된다:
- 미리 설정된 hooks가 담긴 `.claude/settings.json`
- `.claude/commands/hooks/`의 hook 명령 문서
- 자주 쓰는 작업용 기본 hook 핸들러

### 기본 Hook 사용법

```bash
# Pre-task hook (auto-spawns agents)
npx @claude-flow/cli@latest hooks pre-task --description "Implement authentication"

# Post-edit hook (auto-formats and stores in memory)
npx @claude-flow/cli@latest hooks post-edit --file "src/auth.js" --memory-key "auth/login"

# Session end hook (saves state and metrics)
npx @claude-flow/cli@latest hooks session-end --session-id "dev-session" --export-metrics
```

---

## 전체 가이드

### 사용 가능한 Hooks

#### 작업 전 Hooks

작업 **전에** 실행되어 준비와 검증을 하는 hooks:

**pre-edit** - 파일 수정 전에 검증하고 에이전트를 배정한다
```bash
npx @claude-flow/cli@latest hooks pre-edit [options]

Options:
  --file, -f <path>         File path to be edited
  --auto-assign-agent       Automatically assign best agent (default: true)
  --validate-syntax         Pre-validate syntax before edit
  --check-conflicts         Check for merge conflicts
  --backup-file             Create backup before editing

Examples:
  npx @claude-flow/cli@latest hooks pre-edit --file "src/auth/login.js"
  npx @claude-flow/cli@latest hooks pre-edit -f "config/db.js" --validate-syntax
  npx @claude-flow/cli@latest hooks pre-edit -f "production.env" --backup-file --check-conflicts
```

**기능:**
- 파일 유형에 따른 에이전트 자동 배정
- 깨진 코드를 막는 문법 검증
- 동시 편집 충돌 감지
- 안전을 위한 파일 자동 백업

**pre-bash** - 명령의 안전성과 자원 요구량을 확인한다
```bash
npx @claude-flow/cli@latest hooks pre-bash --command <cmd>

Options:
  --command, -c <cmd>       Command to validate
  --check-safety            Verify command safety (default: true)
  --estimate-resources      Estimate resource usage
  --require-confirmation    Request user confirmation for risky commands

Examples:
  npx @claude-flow/cli@latest hooks pre-bash -c "rm -rf /tmp/cache"
  npx @claude-flow/cli@latest hooks pre-bash --command "docker build ." --estimate-resources
```

**기능:**
- 명령 안전성 검증
- 자원 요구량 추정
- 파괴적 명령 확인
- 권한 확인

**pre-task** - 에이전트를 자동 생성하고 복잡한 작업을 준비한다
```bash
npx @claude-flow/cli@latest hooks pre-task [options]

Options:
  --description, -d <text>  Task description for context
  --auto-spawn-agents       Automatically spawn required agents (default: true)
  --load-memory             Load relevant memory from previous sessions
  --optimize-topology       Select optimal swarm topology
  --estimate-complexity     Analyze task complexity

Examples:
  npx @claude-flow/cli@latest hooks pre-task --description "Implement user authentication"
  npx @claude-flow/cli@latest hooks pre-task -d "Continue API dev" --load-memory
  npx @claude-flow/cli@latest hooks pre-task -d "Refactor codebase" --optimize-topology
```

**기능:**
- 작업 분석에 따른 에이전트 자동 생성
- 컨텍스트 연속성을 위한 메모리 불러오기
- 작업 구조에 맞춘 토폴로지 최적화
- 복잡도 추정과 소요 시간 예측

**pre-search** - 검색 작업을 준비하고 최적화한다
```bash
npx @claude-flow/cli@latest hooks pre-search --query <query>

Options:
  --query, -q <text>        Search query
  --check-cache             Check cache first (default: true)
  --optimize-query          Optimize search pattern

Examples:
  npx @claude-flow/cli@latest hooks pre-search -q "authentication middleware"
```

**기능:**
- 더 빠른 결과를 위한 캐시 확인
- 쿼리 최적화
- 검색 패턴 개선

#### 작업 후 Hooks

작업 **후에** 실행되어 결과를 처리하고 학습하는 hooks:

**post-edit** - 자동 포맷팅, 검증, 메모리 갱신
```bash
npx @claude-flow/cli@latest hooks post-edit [options]

Options:
  --file, -f <path>         File path that was edited
  --auto-format             Automatically format code (default: true)
  --memory-key, -m <key>    Store edit context in memory
  --train-patterns          Train neural patterns from edit
  --validate-output         Validate edited file

Examples:
  npx @claude-flow/cli@latest hooks post-edit --file "src/components/Button.jsx"
  npx @claude-flow/cli@latest hooks post-edit -f "api/auth.js" --memory-key "auth/login"
  npx @claude-flow/cli@latest hooks post-edit -f "utils/helpers.ts" --train-patterns
```

**기능:**
- 언어별 자동 포맷팅 (Prettier, Black, gofmt)
- 편집 컨텍스트와 결정 사항을 메모리에 저장
- 지속적 개선을 위한 neural pattern 학습
- 린트를 통한 출력 검증

**post-bash** - 실행을 기록하고 지표를 갱신한다
```bash
npx @claude-flow/cli@latest hooks post-bash --command <cmd>

Options:
  --command, -c <cmd>       Command that was executed
  --log-output              Log command output (default: true)
  --update-metrics          Update performance metrics
  --store-result            Store result in memory

Examples:
  npx @claude-flow/cli@latest hooks post-bash -c "npm test" --update-metrics
```

**기능:**
- 명령 실행 기록
- 성능 지표 추적
- 분석용 결과 저장
- 오류 패턴 감지

**post-task** - 성능 분석과 결정 사항 저장
```bash
npx @claude-flow/cli@latest hooks post-task [options]

Options:
  --task-id, -t <id>        Task identifier for tracking
  --analyze-performance     Generate performance metrics (default: true)
  --store-decisions         Save task decisions to memory
  --export-learnings        Export neural pattern learnings
  --generate-report         Create task completion report

Examples:
  npx @claude-flow/cli@latest hooks post-task --task-id "auth-implementation"
  npx @claude-flow/cli@latest hooks post-task -t "api-refactor" --analyze-performance
  npx @claude-flow/cli@latest hooks post-task -t "bug-fix-123" --store-decisions
```

**기능:**
- 실행 시간과 토큰 사용량 측정
- 결정 사항과 구현 선택 기록
- Neural 학습 패턴 내보내기
- 완료 보고서 생성

**post-search** - 결과를 캐시하고 패턴을 개선한다
```bash
npx @claude-flow/cli@latest hooks post-search --query <query> --results <path>

Options:
  --query, -q <text>        Original search query
  --results, -r <path>      Results file path
  --cache-results           Cache for future use (default: true)
  --train-patterns          Improve search patterns

Examples:
  npx @claude-flow/cli@latest hooks post-search -q "auth" -r "results.json" --train-patterns
```

**기능:**
- 이후 검색을 빠르게 하는 결과 캐싱
- 검색 패턴 개선
- 관련도 점수 산정

#### MCP 연동 Hooks

MCP 스웜 도구와 조정하는 hooks:

**mcp-initialized** - 스웜 설정을 유지한다
```bash
npx @claude-flow/cli@latest hooks mcp-initialized --swarm-id <id>

Features:
- Save swarm topology and configuration
- Store agent roster in memory
- Initialize coordination namespace
```

**agent-spawned** - 에이전트 명단과 메모리를 갱신한다
```bash
npx @claude-flow/cli@latest hooks agent-spawned --agent-id <id> --type <type>

Features:
- Register agent in coordination memory
- Update agent roster
- Initialize agent-specific memory namespace
```

**task-orchestrated** - 작업 진행을 모니터링한다
```bash
npx @claude-flow/cli@latest hooks task-orchestrated --task-id <id>

Features:
- Track task progress through memory
- Monitor agent assignments
- Update coordination state
```

**neural-trained** - 패턴 개선 사항을 저장한다
```bash
npx @claude-flow/cli@latest hooks neural-trained --pattern <name>

Features:
- Export trained neural patterns
- Update coordination models
- Share learning across agents
```

#### 메모리 조정 Hooks

**memory-write** - 에이전트가 조정 메모리에 쓸 때 실행된다
```bash
Features:
- Validate memory key format
- Update cross-agent indexes
- Trigger dependent hooks
- Notify subscribed agents
```

**memory-read** - 에이전트가 조정 메모리에서 읽을 때 실행된다
```bash
Features:
- Log access patterns
- Update popularity metrics
- Preload related data
- Track usage statistics
```

**memory-sync** - 스웜 에이전트 간 메모리를 동기화한다
```bash
npx @claude-flow/cli@latest hooks memory-sync --namespace <ns>

Features:
- Sync memory state across agents
- Resolve conflicts
- Propagate updates
- Maintain consistency
```

#### 세션 Hooks

**session-start** - 새 세션을 초기화한다
```bash
npx @claude-flow/cli@latest hooks session-start --session-id <id>

Options:
  --session-id, -s <id>     Session identifier
  --load-context            Load context from previous session
  --init-agents             Initialize required agents

Features:
- Create session directory
- Initialize metrics tracking
- Load previous context
- Set up coordination namespace
```

**session-restore** - 이전 세션 상태를 불러온다
```bash
npx @claude-flow/cli@latest hooks session-restore --session-id <id>

Options:
  --session-id, -s <id>     Session to restore
  --restore-memory          Restore memory state (default: true)
  --restore-agents          Restore agent configurations

Examples:
  npx @claude-flow/cli@latest hooks session-restore --session-id "swarm-20241019"
  npx @claude-flow/cli@latest hooks session-restore -s "feature-auth" --restore-memory
```

**기능:**
- 이전 세션 컨텍스트 불러오기
- 메모리 상태와 결정 사항 복원
- 에이전트를 이전 상태로 재구성
- 진행 중이던 작업 재개

**session-end** - 세션 상태를 정리하고 유지한다
```bash
npx @claude-flow/cli@latest hooks session-end [options]

Options:
  --session-id, -s <id>     Session identifier to end
  --save-state              Save current session state (default: true)
  --export-metrics          Export session metrics
  --generate-summary        Create session summary
  --cleanup-temp            Remove temporary files

Examples:
  npx @claude-flow/cli@latest hooks session-end --session-id "dev-session-2024"
  npx @claude-flow/cli@latest hooks session-end -s "feature-auth" --export-metrics --generate-summary
  npx @claude-flow/cli@latest hooks session-end -s "quick-fix" --cleanup-temp
```

**기능:**
- 현재 컨텍스트와 진행 상황 저장
- 세션 지표 내보내기 (소요 시간, 명령, 토큰, 파일)
- 결정 사항과 다음 단계를 담은 작업 요약 생성
- 임시 파일 정리와 저장 공간 최적화

**notify** - 스웜 상태를 포함한 사용자 정의 알림
```bash
npx @claude-flow/cli@latest hooks notify --message <msg>

Options:
  --message, -m <text>      Notification message
  --level <level>           Notification level (info|warning|error)
  --swarm-status            Include swarm status (default: true)
  --broadcast               Send to all agents

Examples:
  npx @claude-flow/cli@latest hooks notify -m "Task completed" --level info
  npx @claude-flow/cli@latest hooks notify -m "Critical error" --level error --broadcast
```

**기능:**
- 조정 시스템에 알림 전송
- 스웜 상태와 지표 포함
- 모든 에이전트에 브로드캐스트
- 중요한 이벤트 기록

### 설정

#### 기본 설정

`.claude/settings.json`을 편집해 hooks를 설정한다:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^(Write|Edit|MultiEdit)$",
        "hooks": [{
          "type": "command",
          "command": "npx @claude-flow/cli@latest hooks pre-edit --file '${tool.params.file_path}' --memory-key 'swarm/editor/current'"
        }]
      },
      {
        "matcher": "^Bash$",
        "hooks": [{
          "type": "command",
          "command": "npx @claude-flow/cli@latest hooks pre-bash --command '${tool.params.command}'"
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "^(Write|Edit|MultiEdit)$",
        "hooks": [{
          "type": "command",
          "command": "npx @claude-flow/cli@latest hooks post-edit --file '${tool.params.file_path}' --memory-key 'swarm/editor/complete' --auto-format --train-patterns"
        }]
      },
      {
        "matcher": "^Bash$",
        "hooks": [{
          "type": "command",
          "command": "npx @claude-flow/cli@latest hooks post-bash --command '${tool.params.command}' --update-metrics"
        }]
      }
    ]
  }
}
```

#### 고급 설정

모든 기능을 담은 전체 hook 설정:

```json
{
  "hooks": {
    "enabled": true,
    "debug": false,
    "timeout": 5000,

    "PreToolUse": [
      {
        "matcher": "^(Write|Edit|MultiEdit)$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks pre-edit --file '${tool.params.file_path}' --auto-assign-agent --validate-syntax",
            "timeout": 3000,
            "continueOnError": true
          }
        ]
      },
      {
        "matcher": "^Task$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks pre-task --description '${tool.params.task}' --auto-spawn-agents --load-memory",
            "async": true
          }
        ]
      },
      {
        "matcher": "^Grep$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks pre-search --query '${tool.params.pattern}' --check-cache"
          }
        ]
      }
    ],

    "PostToolUse": [
      {
        "matcher": "^(Write|Edit|MultiEdit)$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks post-edit --file '${tool.params.file_path}' --memory-key 'edits/${tool.params.file_path}' --auto-format --train-patterns",
            "async": true
          }
        ]
      },
      {
        "matcher": "^Task$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks post-task --task-id '${result.task_id}' --analyze-performance --store-decisions --export-learnings",
            "async": true
          }
        ]
      },
      {
        "matcher": "^Grep$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks post-search --query '${tool.params.pattern}' --cache-results --train-patterns"
          }
        ]
      }
    ],

    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks session-start --session-id '${session.id}' --load-context"
          }
        ]
      }
    ],

    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks session-end --session-id '${session.id}' --export-metrics --generate-summary --cleanup-temp"
          }
        ]
      }
    ]
  }
}
```

#### 보호 파일 패턴

민감한 파일에 보호를 추가한다:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^(Write|Edit|MultiEdit)$",
        "hooks": [
          {
            "type": "command",
            "command": "npx @claude-flow/cli@latest hooks check-protected --file '${tool.params.file_path}'"
          }
        ]
      }
    ]
  }
}
```

#### 자동 테스트

파일 수정 후 테스트를 실행한다:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "^Write$",
        "hooks": [
          {
            "type": "command",
            "command": "test -f '${tool.params.file_path%.js}.test.js' && npm test '${tool.params.file_path%.js}.test.js'",
            "continueOnError": true
          }
        ]
      }
    ]
  }
}
```

### MCP 도구 연동

Hooks는 조정을 위해 MCP 도구와 자동으로 연동된다:

#### 에이전트 추천이 포함된 Pre-Task Hook

```javascript
// Hook command
npx @claude-flow/cli@latest hooks pre-task --description "Build REST API"

// Internally calls this MCP tool:
mcp__claude-flow__hooks_pre-task {
  taskId: "<generated by the CLI>",
  description: "Build REST API",
  autoSpawn: false,
  timestamp: Date.now()
}
```

#### 메모리 저장이 포함된 Post-Edit Hook

```javascript
// Hook command
npx @claude-flow/cli@latest hooks post-edit --file "api/auth.js"

// Internally calls this MCP tool:
mcp__claude-flow__hooks_post-edit {
  filePath: "api/auth.js",
  success: true,
  timestamp: Date.now()
}
```

#### 상태 유지가 포함된 Session End Hook

```javascript
// Hook command
npx @claude-flow/cli@latest hooks session-end --save-state

// Internally calls this MCP tool, which saves the session state, stops the worker daemon and returns a summary:
mcp__claude-flow__hooks_session-end {
  saveState: true,
  timestamp: Date.now()
}
```

### 메모리 조정 프로토콜

모든 hooks는 표준화된 메모리 조정 패턴을 따른다:

#### 3단계 메모리 프로토콜

**1단계: STATUS** - Hook 시작
```javascript
mcp__claude-flow__memory_store {
  key: "swarm/hooks/pre-edit/status",
  namespace: "coordination",
  value: JSON.stringify({
    status: "running",
    hook: "pre-edit",
    file: "src/auth.js",
    timestamp: Date.now()
  })
}
```

**2단계: PROGRESS** - Hook 처리
```javascript
mcp__claude-flow__memory_store {
  key: "swarm/hooks/pre-edit/progress",
  namespace: "coordination",
  value: JSON.stringify({
    progress: 50,
    action: "validating syntax",
    file: "src/auth.js"
  })
}
```

**3단계: COMPLETE** - Hook 완료
```javascript
mcp__claude-flow__memory_store {
  key: "swarm/hooks/pre-edit/complete",
  namespace: "coordination",
  value: JSON.stringify({
    status: "complete",
    result: "success",
    agent_assigned: "backend-dev",
    syntax_valid: true,
    backup_created: true
  })
}
```

### Hook 응답 형식

Hooks는 작업 흐름을 제어하는 JSON 응답을 반환한다:

#### 계속 응답
```json
{
  "continue": true,
  "reason": "All validations passed",
  "metadata": {
    "agent_assigned": "backend-dev",
    "syntax_valid": true,
    "file": "src/auth.js"
  }
}
```

#### 차단 응답
```json
{
  "continue": false,
  "reason": "Protected file - manual review required",
  "metadata": {
    "file": ".env.production",
    "protection_level": "high",
    "requires": "manual_approval"
  }
}
```

#### 경고 응답
```json
{
  "continue": true,
  "reason": "Syntax valid but complexity high",
  "warnings": [
    "Cyclomatic complexity: 15 (threshold: 10)",
    "Consider refactoring for better maintainability"
  ],
  "metadata": {
    "complexity": 15,
    "threshold": 10
  }
}
```

### Git 연동

Hooks는 품질 관리를 위해 Git 작업과 연동할 수 있다:

#### Pre-Commit Hook
```bash
# Add to .git/hooks/pre-commit or use husky

#!/bin/bash
# Run quality checks before commit

# Get staged files
FILES=$(git diff --cached --name-only --diff-filter=ACM)

for FILE in $FILES; do
  # Run pre-edit hook for validation
  npx @claude-flow/cli@latest hooks pre-edit --file "$FILE" --validate-syntax

  if [ $? -ne 0 ]; then
    echo "Validation failed for $FILE"
    exit 1
  fi

  # Run post-edit hook for formatting
  npx @claude-flow/cli@latest hooks post-edit --file "$FILE" --auto-format
done

# Run tests
npm test

exit $?
```

#### Post-Commit Hook
```bash
# Add to .git/hooks/post-commit

#!/bin/bash
# Track commit metrics

COMMIT_HASH=$(git rev-parse HEAD)
COMMIT_MSG=$(git log -1 --pretty=%B)

npx @claude-flow/cli@latest hooks notify \
  --message "Commit completed: $COMMIT_MSG" \
  --level info \
  --swarm-status
```

#### Pre-Push Hook
```bash
# Add to .git/hooks/pre-push

#!/bin/bash
# Quality gate before push

# Run full test suite
npm run test:all

# Run quality checks
npx @claude-flow/cli@latest hooks session-end \
  --generate-report \
  --export-metrics

# Verify quality thresholds
TRUTH_SCORE=$(npx @claude-flow/cli@latest metrics score --format json | jq -r '.truth_score')

if (( $(echo "$TRUTH_SCORE < 0.95" | bc -l) )); then
  echo "Truth score below threshold: $TRUTH_SCORE < 0.95"
  exit 1
fi

exit 0
```

### 에이전트 조정 워크플로

에이전트가 조정을 위해 hooks를 쓰는 방식:

#### 에이전트 워크플로 예시

```bash
# Agent 1: Backend Developer
# STEP 1: Pre-task preparation
npx @claude-flow/cli@latest hooks pre-task \
  --description "Implement user authentication API" \
  --auto-spawn-agents \
  --load-memory

# STEP 2: Work begins - pre-edit validation
npx @claude-flow/cli@latest hooks pre-edit \
  --file "api/auth.js" \
  --auto-assign-agent \
  --validate-syntax

# STEP 3: Edit file (via Claude Code Edit tool)
# ... code changes ...

# STEP 4: Post-edit processing
npx @claude-flow/cli@latest hooks post-edit \
  --file "api/auth.js" \
  --memory-key "swarm/backend/auth-api" \
  --auto-format \
  --train-patterns

# STEP 5: Notify coordination system
npx @claude-flow/cli@latest hooks notify \
  --message "Auth API implementation complete" \
  --swarm-status \
  --broadcast

# STEP 6: Task completion
npx @claude-flow/cli@latest hooks post-task \
  --task-id "auth-api" \
  --analyze-performance \
  --store-decisions \
  --export-learnings
```

```bash
# Agent 2: Test Engineer (receives notification)
# STEP 1: Check memory for API details
npx @claude-flow/cli@latest hooks session-restore \
  --session-id "swarm-current" \
  --restore-memory

# Memory contains: swarm/backend/auth-api with implementation details

# STEP 2: Generate tests
npx @claude-flow/cli@latest hooks pre-task \
  --description "Write tests for auth API" \
  --load-memory

# STEP 3: Create test file
npx @claude-flow/cli@latest hooks post-edit \
  --file "api/auth.test.js" \
  --memory-key "swarm/testing/auth-api-tests" \
  --train-patterns

# STEP 4: Share test results
npx @claude-flow/cli@latest hooks notify \
  --message "Auth API tests complete - 100% coverage" \
  --broadcast
```

### 사용자 정의 Hook 만들기

특정 워크플로용 사용자 정의 hooks를 만든다:

#### 사용자 정의 Hook 템플릿

```javascript
// .claude/hooks/custom-quality-check.js

module.exports = {
  name: 'custom-quality-check',
  type: 'pre',
  matcher: /\.(ts|js)$/,

  async execute(context) {
    const { file, content } = context;

    // Custom validation logic
    const complexity = await analyzeComplexity(content);
    const securityIssues = await scanSecurity(content);

    // Store in memory
    await storeInMemory({
      key: `quality/${file}`,
      value: { complexity, securityIssues }
    });

    // Return decision
    if (complexity > 15 || securityIssues.length > 0) {
      return {
        continue: false,
        reason: 'Quality checks failed',
        warnings: [
          `Complexity: ${complexity} (max: 15)`,
          `Security issues: ${securityIssues.length}`
        ]
      };
    }

    return {
      continue: true,
      reason: 'Quality checks passed',
      metadata: { complexity, securityIssues: 0 }
    };
  }
};
```

#### 사용자 정의 Hook 등록

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "^(Write|Edit)$",
        "hooks": [
          {
            "type": "script",
            "script": ".claude/hooks/custom-quality-check.js"
          }
        ]
      }
    ]
  }
}
```

### 실전 예시

#### 예시 1: 풀스택 개발 워크플로

```bash
# Session start - initialize coordination
npx @claude-flow/cli@latest hooks session-start --session-id "fullstack-feature"

# Pre-task planning
npx @claude-flow/cli@latest hooks pre-task \
  --description "Build user profile feature - frontend + backend + tests" \
  --auto-spawn-agents \
  --optimize-topology

# Backend work
npx @claude-flow/cli@latest hooks pre-edit --file "api/profile.js"
# ... implement backend ...
npx @claude-flow/cli@latest hooks post-edit \
  --file "api/profile.js" \
  --memory-key "profile/backend" \
  --train-patterns

# Frontend work (reads backend details from memory)
npx @claude-flow/cli@latest hooks pre-edit --file "components/Profile.jsx"
# ... implement frontend ...
npx @claude-flow/cli@latest hooks post-edit \
  --file "components/Profile.jsx" \
  --memory-key "profile/frontend" \
  --train-patterns

# Testing (reads both backend and frontend from memory)
npx @claude-flow/cli@latest hooks pre-task \
  --description "Test profile feature" \
  --load-memory

# Session end - export everything
npx @claude-flow/cli@latest hooks session-end \
  --session-id "fullstack-feature" \
  --export-metrics \
  --generate-summary
```

#### 예시 2: Hooks로 디버깅하기

```bash
# Start debugging session
npx @claude-flow/cli@latest hooks session-start --session-id "debug-memory-leak"

# Pre-task: analyze issue
npx @claude-flow/cli@latest hooks pre-task \
  --description "Debug memory leak in event handlers" \
  --load-memory \
  --estimate-complexity

# Search for event emitters
npx @claude-flow/cli@latest hooks pre-search --query "EventEmitter"
# ... search executes ...
npx @claude-flow/cli@latest hooks post-search \
  --query "EventEmitter" \
  --cache-results

# Fix the issue
npx @claude-flow/cli@latest hooks pre-edit \
  --file "services/events.js" \
  --backup-file
# ... fix code ...
npx @claude-flow/cli@latest hooks post-edit \
  --file "services/events.js" \
  --memory-key "debug/memory-leak-fix" \
  --validate-output

# Verify fix
npx @claude-flow/cli@latest hooks post-task \
  --task-id "memory-leak-fix" \
  --analyze-performance \
  --generate-report

# End session
npx @claude-flow/cli@latest hooks session-end \
  --session-id "debug-memory-leak" \
  --export-metrics
```

#### 예시 3: 멀티 에이전트 리팩터링

```bash
# Initialize swarm for refactoring
npx @claude-flow/cli@latest hooks pre-task \
  --description "Refactor legacy codebase to modern patterns" \
  --auto-spawn-agents \
  --optimize-topology

# Agent 1: Code Analyzer
npx @claude-flow/cli@latest hooks pre-task --description "Analyze code complexity"
# ... analysis ...
npx @claude-flow/cli@latest hooks post-task \
  --task-id "analysis" \
  --store-decisions

# Agent 2: Refactoring (reads analysis from memory)
npx @claude-flow/cli@latest hooks session-restore \
  --session-id "swarm-refactor" \
  --restore-memory

for file in src/**/*.js; do
  npx @claude-flow/cli@latest hooks pre-edit --file "$file" --backup-file
  # ... refactor ...
  npx @claude-flow/cli@latest hooks post-edit \
    --file "$file" \
    --memory-key "refactor/$file" \
    --auto-format \
    --train-patterns
done

# Agent 3: Testing (reads refactored code from memory)
npx @claude-flow/cli@latest hooks pre-task \
  --description "Generate tests for refactored code" \
  --load-memory

# Broadcast completion
npx @claude-flow/cli@latest hooks notify \
  --message "Refactoring complete - all tests passing" \
  --broadcast
```

### 성능 팁

1. **Hooks를 가볍게 유지한다** - 실행 시간 100ms 미만을 목표로 한다
2. **무거운 작업은 비동기로 처리한다** - 메인 흐름을 막지 않는다
3. **적극적으로 캐시한다** - 자주 접근하는 데이터를 저장한다
4. **관련 작업을 묶는다** - 여러 동작을 하나로 합친다
5. **메모리를 현명하게 쓴다** - 적절한 TTL을 설정한다
6. **Hook 성능을 모니터링한다** - 실행 시간을 추적한다
7. **가능하면 병렬화한다** - 독립적인 hooks는 동시에 실행한다

### Hooks 디버깅

문제 해결을 위해 디버그 모드를 켠다:

```bash
# Enable debug output
export CLAUDE_FLOW_DEBUG=true

# Test specific hook with verbose output
npx @claude-flow/cli@latest hooks pre-edit --file "test.js" --debug

# Check hook execution logs
cat .claude-flow/logs/hooks-$(date +%Y-%m-%d).log

# Validate configuration
npx @claude-flow/cli@latest hooks validate-config
```

### 장점

- **에이전트 자동 배정**: 파일 유형마다 알맞은 에이전트
- **일관된 코드 포맷팅**: 언어별 포매터
- **지속적 학습**: Neural pattern이 시간이 갈수록 개선된다
- **세션 간 메모리**: 컨텍스트가 세션 사이에 유지된다
- **성능 추적**: 종합적인 지표와 분석
- **자동 조정**: 에이전트가 메모리를 통해 동기화된다
- **스마트 에이전트 생성**: 작업 기반 에이전트 선택
- **품질 게이트**: 커밋 전 검증과 확인
- **오류 예방**: 편집 전 문법 검증
- **지식 공유**: 결정 사항을 저장하고 공유한다
- **수작업 감소**: 반복 작업 자동화
- **더 나은 협업**: 매끄러운 멀티 에이전트 조정

### 모범 사례

1. **Hooks를 일찍 설정한다** - 프로젝트 초기화 때 설정한다
2. **메모리 키를 전략적으로 쓴다** - 명확한 네임스페이스로 정리한다
3. **자동 포맷팅을 켠다** - 코드 일관성을 유지한다
4. **패턴을 꾸준히 학습시킨다** - 성공한 작업에서 배운다
5. **성능을 모니터링한다** - hook 실행 시간을 추적한다
6. **설정을 검증한다** - 실사용 전에 hooks를 테스트한다
7. **사용자 정의 Hooks를 문서화한다** - hook 문서를 유지한다
8. **적절한 타임아웃을 설정한다** - 멈춘 작업을 막는다
9. **오류를 우아하게 처리한다** - 필요할 때 continueOnError를 쓴다
10. **지표를 정기적으로 검토한다** - 사용 패턴에 따라 최적화한다

### 문제 해결

#### Hooks가 실행되지 않을 때
- `.claude/settings.json` 문법을 확인한다
- hook matcher 패턴을 점검한다
- 디버그 모드를 켠다
- 권한 설정을 검토한다
- claude-flow CLI가 PATH에 있는지 확인한다

#### Hook 타임아웃
- 설정에서 타임아웃 값을 늘린다
- 무거운 작업용 hooks는 비동기로 만든다
- hook 로직을 최적화한다
- MCP 도구의 네트워크 연결을 확인한다

#### 메모리 문제
- 메모리 키에 적절한 TTL을 설정한다
- 오래된 메모리 항목을 정리한다
- 메모리 네임스페이스를 효과적으로 쓴다
- 메모리 사용량을 모니터링한다

#### 성능 문제
- hook 실행 시간을 프로파일링한다
- 반복 작업에는 캐싱을 쓴다
- 가능하면 작업을 묶어서 처리한다
- hook 복잡도를 줄인다

### 관련 명령

- `npx @claude-flow/cli@latest init --hooks` - hooks 시스템을 초기화한다
- `npx @claude-flow/cli@latest hooks list` - 사용 가능한 hooks를 나열한다
- `npx @claude-flow/cli@latest memory stats` - 메모리 통계를 보여 준다
- `npx @claude-flow/cli@latest agent spawn` - 에이전트를 생성한다
- `npx @claude-flow/cli@latest swarm init` - 스웜을 초기화한다

### 다른 스킬과의 연동

이 스킬은 다음 스킬과 매끄럽게 함께 동작한다:
- **SPARC Methodology** - Hooks가 SPARC 워크플로를 강화한다
- **Pair Programming** - 페어링 세션의 품질을 자동으로 관리한다
- **Verification Quality** - hooks 안에서 truth-score 검증을 한다
- **GitHub Workflows** - 커밋·PR을 위한 Git 연동
- **Performance Analysis** - hooks 안에서 지표를 수집한다
- **Swarm Advanced** - hooks를 통한 멀티 에이전트 조정
