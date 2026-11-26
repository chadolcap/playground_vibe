---
name: pair-programming
description: 여러 모드(driver/navigator/switch)를 갖춘 AI 보조 pair programming. 실시간 검증, 품질 모니터링, 종합 테스트를 제공한다. TDD, debugging, refactoring, 학습 세션을 지원하며, 자동 역할 전환, 지속적 code review, security scanning, truth-score 검증 기반 performance optimization 기능을 갖춘다.
---

# 페어 프로그래밍 (Pair Programming)

지능형 역할 관리, 실시간 품질 모니터링, 종합적인 개발 워크플로를 갖춘 협업형 AI 페어 프로그래밍이다.

## 이 스킬이 하는 일

이 스킬은 AI 지원을 받는 전문적인 페어 프로그래밍 기능을 제공하며, 여러 협업 모드와 지속적 검증, 통합 테스트를 지원한다. driver/navigator 역할을 관리하고, 실시간 코드 리뷰를 수행하며, 품질 지표를 추적하고, truth-score 검증으로 높은 기준을 보장한다.

**핵심 기능:**
- **다양한 모드**: Driver, Navigator, Switch, TDD, Review, Mentor, Debug
- **실시간 검증**: 실패 시 롤백을 포함한 자동 품질 점수 산정
- **역할 관리**: driver/navigator 역할 간 매끄러운 전환
- **테스트 연동**: 테스트 자동 생성, 커버리지 추적, 지속적 테스트
- **코드 리뷰**: 보안 스캔, 성능 분석, 모범 사례 적용
- **세션 유지**: 자동 저장, 복구, 내보내기, 공유

## Claude Code가 이 스킬을 쓰는 방식

세션 상태는 CLI가 보관하고 Claude Code는 그것을 읽는다. 입력할 REPL은 없다.

1. 매 턴 시작 시 `ruflo pair status --json`을 실행한다. `active`가 `false`이면 이 스킬은 휴면 상태다.
2. `mode`와 `aiRole`을 따른다. **driver**일 때는 직접 코드를 작성하고 사람이 리뷰한다. **navigator**일 때는 리뷰하고 제안하며, 요청받지 않으면 절대 편집하지 않는다. `tdd`, `review`, `mentor`, `debug`는 아래 설명처럼 이 동작을 세분화한다.
3. `switchDue`가 `true`이면 `ruflo pair switch`를 실행하고, 역할 교대를 알린 뒤 새 역할로 계속한다.
4. 세션 도중 모드를 바꾸려면 `ruflo pair mode <mode>`를 쓴다. 사람도 자신의 셸에서 같은 명령을 실행할 수 있다.

상태는 `.claude-flow/sessions/pair/current.json`에 저장된다. `ruflo pair end`는 이를 같은 위치의 `history.jsonl`에 보관한다.

## 사전 요구 사항

**필수:**
- `ruflo pair` 명령을 제공하는 Ruflo CLI 설치 (`npm install -g ruflo`)
- Git 저장소 (선택이지만 권장)

**권장:**
- 테스트 프레임워크 (Jest, pytest 등)
- 린터 설정 (ESLint, pylint 등)
- 코드 포매터 (Prettier, Black 등)

## 빠른 시작

### 기본 세션
```bash
# Start simple pair programming
ruflo pair start
```

### TDD 세션
```bash
# Test-driven development
ruflo pair start \
  --mode tdd \
  --test-first \
  --coverage 90
```

---

## 전체 가이드

### 세션 제어 명령

#### 세션 시작
```bash
# Basic start
ruflo pair start

# Expert refactoring session
ruflo pair start \
  --agent senior-dev \
  --focus refactor \
  --verify \
  --threshold 0.98

# Debugging session
ruflo pair start \
  --agent debugger-expert \
  --focus debug \
  --review

# Learning session
ruflo pair start \
  --mode mentor \
  --pace slow \
  --examples
```

#### 세션 관리
```bash
# Check status
ruflo pair status

# View history
ruflo pair history

# Pause session
/pause [--reason <reason>]

# Resume session
/resume

# End session
ruflo pair end [--save] [--report]
```

### 사용 가능한 모드

#### Driver 모드
사용자가 코드를 작성하고 AI가 방향을 안내한다.

```bash
ruflo pair start --mode driver
```

**사용자의 역할:**
- 실제 코드 작성
- 해결책 구현
- 즉각적인 결정
- 문법과 구조 처리

**AI Navigator의 역할:**
- 전략적 안내
- 잠재적 문제 발견
- 개선점 제안
- 실시간 리뷰
- 전체 방향 추적

**적합한 경우:**
- 새로운 패턴 학습
- 익숙한 기능 구현
- 빠른 반복 작업
- 직접 하는 디버깅

**명령:**
```
/suggest     - Get implementation suggestions
/review      - Request code review
/explain     - Ask for explanations
/optimize    - Request optimization ideas
/patterns    - Get pattern recommendations
```

#### Navigator 모드
AI가 코드를 작성하고 사용자가 방향을 제시한다.

```bash
ruflo pair start --mode navigator
```

**사용자의 역할:**
- 상위 수준의 방향 제시
- 생성된 코드 리뷰
- 아키텍처 결정
- 비즈니스 요구 사항 충족 보장

**AI Driver의 역할:**
- 구현 코드 작성
- 문법 세부 사항 처리
- 사용자의 안내 구현
- 보일러플레이트 관리
- 리팩터링 실행

**적합한 경우:**
- 빠른 프로토타이핑
- 보일러플레이트 생성
- AI 패턴에서 배우기
- 해결책 탐색

**명령:**
```
/implement   - Direct implementation
/refactor    - Request refactoring
/test        - Generate tests
/document    - Add documentation
/alternate   - See alternative approaches
```

#### Switch 모드
일정 간격으로 역할을 자동으로 교대한다.

```bash
# Default 10-minute intervals
ruflo pair start --mode switch

# 5-minute intervals (rapid)
ruflo pair start --mode switch --interval 5m

# 15-minute intervals (deep focus)
ruflo pair start --mode switch --interval 15m
```

**인계 절차:**
1. 전환 30초 전 경고
2. 현재 driver가 생각을 마무리
3. 컨텍스트 요약 생성
4. 역할이 매끄럽게 교대
5. 새 driver가 이어서 진행

**적합한 경우:**
- 균형 잡힌 협업
- 지식 공유
- 복잡한 기능
- 장시간 세션

#### 특화 모드

**TDD 모드** - 테스트 주도 개발:
```bash
ruflo pair start \
  --mode tdd \
  --test-first \
  --coverage 100
```
워크플로: 실패하는 테스트 작성 → 구현 → 리팩터링 → 반복

**Review 모드** - 지속적 코드 리뷰:
```bash
ruflo pair start \
  --mode review \
  --strict \
  --security
```
기능: 실시간 피드백, 보안 스캔, 성능 분석

**Mentor 모드** - 학습 중심:
```bash
ruflo pair start \
  --mode mentor \
  --explain-all \
  --pace slow
```
기능: 자세한 설명, 단계별 안내, 패턴 교육

**Debug 모드** - 문제 해결:
```bash
ruflo pair start \
  --mode debug \
  --verbose \
  --trace
```
기능: 문제 식별, 근본 원인 분석, 수정 제안

### 세션 중 명령

#### 코드 명령
```
/explain [--level basic|detailed|expert]
  Explain the current code or selection

/suggest [--type refactor|optimize|security|style]
  Get improvement suggestions

/implement <description>
  Request implementation (navigator mode)

/refactor [--pattern <pattern>] [--scope function|file|module]
  Refactor selected code

/optimize [--target speed|memory|both]
  Optimize code for performance

/document [--format jsdoc|markdown|inline]
  Add documentation to code

/comment [--verbose]
  Add inline comments

/pattern <pattern-name> [--example]
  Apply a design pattern
```

#### 테스트 명령
```
/test [--watch] [--coverage] [--only <pattern>]
  Run test suite

/test-gen [--type unit|integration|e2e]
  Generate tests for current code

/coverage [--report html|json|terminal]
  Check test coverage

/mock <target> [--realistic]
  Generate mock data or functions

/test-watch [--on-save]
  Enable test watching

/snapshot [--update]
  Create test snapshots
```

#### 리뷰 명령
```
/review [--scope current|file|changes] [--strict]
  Perform code review

/security [--deep] [--fix]
  Security analysis

/perf [--profile] [--suggestions]
  Performance analysis

/quality [--detailed]
  Check code quality metrics

/lint [--fix] [--config <config>]
  Run linters

/complexity [--threshold <value>]
  Analyze code complexity
```

#### 탐색 명령
```
/goto <file>[:line[:column]]
  Navigate to file or location

/find <pattern> [--regex] [--case-sensitive]
  Search in project

/recent [--limit <n>]
  Show recent files

/bookmark [add|list|goto|remove] [<name>]
  Manage bookmarks

/history [--limit <n>] [--filter <pattern>]
  Show command history

/tree [--depth <n>] [--filter <pattern>]
  Show project structure
```

#### Git 명령
```
/diff [--staged] [--file <file>]
  Show git diff

/commit [--message <msg>] [--amend]
  Commit with verification

/branch [create|switch|delete|list] [<name>]
  Branch operations

/stash [save|pop|list|apply] [<message>]
  Stash operations

/log [--oneline] [--limit <n>]
  View git log

/blame [<file>]
  Show git blame
```

#### AI 파트너 명령
```
/agent [switch|info|config] [<agent-name>]
  Manage AI agent

/teach <preference>
  Teach the AI your preferences

/feedback [positive|negative] <message>
  Provide feedback to AI

/personality [professional|friendly|concise|verbose]
  Adjust AI personality

/expertise [add|remove|list] [<domain>]
  Set AI expertise focus
```

#### 지표 명령
```
/metrics [--period today|session|week|all]
  Show session metrics

/score [--breakdown]
  Show quality scores

/productivity [--chart]
  Show productivity metrics

/leaderboard [--personal|team]
  Show improvement leaderboard
```

#### 역할·모드 명령
```
/switch [--immediate]
  Switch driver/navigator roles

/mode <type>
  Change mode (driver|navigator|switch|tdd|review|mentor|debug)

/role
  Show current role

/handoff
  Prepare role handoff
```

### 명령 단축어

| 별칭 | 전체 명령 |
|-------|-------------|
| `/s` | `/suggest` |
| `/e` | `/explain` |
| `/t` | `/test` |
| `/r` | `/review` |
| `/c` | `/commit` |
| `/g` | `/goto` |
| `/f` | `/find` |
| `/h` | `/help` |
| `/sw` | `/switch` |
| `/st` | `/status` |

### 설정

#### 기본 설정
`.claude-flow/pair-config.json`을 만든다:

```json
{
  "pair": {
    "enabled": true,
    "defaultMode": "switch",
    "defaultAgent": "auto",
    "autoStart": false,
    "theme": "professional"
  }
}
```

#### 전체 설정

```json
{
  "pair": {
    "general": {
      "enabled": true,
      "defaultMode": "switch",
      "defaultAgent": "senior-dev",
      "language": "javascript",
      "timezone": "UTC"
    },

    "modes": {
      "driver": {
        "enabled": true,
        "suggestions": true,
        "realTimeReview": true,
        "autoComplete": false
      },
      "navigator": {
        "enabled": true,
        "codeGeneration": true,
        "explanations": true,
        "alternatives": true
      },
      "switch": {
        "enabled": true,
        "interval": "10m",
        "warning": "30s",
        "autoSwitch": true,
        "pauseOnIdle": true
      }
    },

    "verification": {
      "enabled": true,
      "threshold": 0.95,
      "autoRollback": true,
      "preCommitCheck": true,
      "continuousMonitoring": true,
      "blockOnFailure": true
    },

    "testing": {
      "enabled": true,
      "autoRun": true,
      "framework": "jest",
      "onSave": true,
      "coverage": {
        "enabled": true,
        "minimum": 80,
        "enforce": true,
        "reportFormat": "html"
      }
    },

    "review": {
      "enabled": true,
      "continuous": true,
      "preCommit": true,
      "security": true,
      "performance": true,
      "style": true,
      "complexity": {
        "maxComplexity": 10,
        "maxDepth": 4,
        "maxLines": 100
      }
    },

    "git": {
      "enabled": true,
      "autoCommit": false,
      "commitTemplate": "feat: {message}",
      "signCommits": false,
      "pushOnEnd": false,
      "branchProtection": true
    },

    "session": {
      "autoSave": true,
      "saveInterval": "5m",
      "maxDuration": "4h",
      "idleTimeout": "15m",
      "breakReminder": "45m",
      "metricsInterval": "1m"
    },

    "ai": {
      "model": "advanced",
      "temperature": 0.7,
      "maxTokens": 4000,
      "personality": "professional",
      "expertise": ["backend", "testing", "security"],
      "learningEnabled": true
    }
  }
}
```

#### 내장 에이전트

```json
{
  "agents": {
    "senior-dev": {
      "expertise": ["architecture", "patterns", "optimization"],
      "style": "thorough",
      "reviewLevel": "strict"
    },
    "tdd-specialist": {
      "expertise": ["testing", "mocks", "coverage"],
      "style": "test-first",
      "reviewLevel": "comprehensive"
    },
    "debugger-expert": {
      "expertise": ["debugging", "profiling", "tracing"],
      "style": "analytical",
      "reviewLevel": "focused"
    },
    "junior-dev": {
      "expertise": ["learning", "basics", "documentation"],
      "style": "questioning",
      "reviewLevel": "educational"
    }
  }
}
```

#### CLI 설정
```bash
# Set configuration
ruflo pair config set defaultMode switch
ruflo pair config set verification.threshold 0.98

# Get configuration
ruflo pair config get
ruflo pair config get defaultMode

# Export/Import
ruflo pair config export > config.json
ruflo pair config import config.json

# Reset
ruflo pair config reset
```

#### 프로필 관리

재사용 가능한 프로필을 만든다:

```bash
# Create profile
ruflo pair profile create refactoring \
  --mode driver \
  --verify true \
  --threshold 0.98 \
  --focus refactor

# Use profile
ruflo pair start --profile refactoring

# List profiles
ruflo pair profile list
```

프로필 설정:
```json
{
  "profiles": {
    "refactoring": {
      "mode": "driver",
      "verification": {
        "enabled": true,
        "threshold": 0.98
      },
      "focus": "refactor"
    },
    "debugging": {
      "mode": "navigator",
      "agent": "debugger-expert",
      "trace": true,
      "verbose": true
    },
    "learning": {
      "mode": "mentor",
      "pace": "slow",
      "explanations": "detailed",
      "examples": true
    }
  }
}
```

### 실전 예시

#### 예시 1: 기능 구현

JWT 토큰으로 사용자 인증 구현하기:

```bash
# Session setup
ruflo pair start \
  --mode switch \
  --agent senior-dev \
  --focus implement \
  --verify \
  --test
```

**세션 흐름:**
```
👥 Starting pair programming for authentication feature...

[DRIVER: You - 10 minutes]
/explain JWT authentication flow
> AI explains JWT concepts and best practices

/suggest implementation approach
> AI suggests using middleware pattern with refresh tokens

# You write the basic auth middleware structure

[SWITCH TO NAVIGATOR]

[NAVIGATOR: AI - 10 minutes]
/implement JWT token generation with refresh tokens
> AI generates secure token implementation

/test-gen
> AI creates comprehensive test suite

[SWITCH TO DRIVER]

[DRIVER: You - 10 minutes]
# You refine the implementation
/review --security
> AI performs security review, suggests improvements

/commit --message "feat: JWT authentication with refresh tokens"
✅ Truth Score: 0.98 - Committed successfully
```

#### 예시 2: 버그 수정

Node.js의 메모리 누수 디버깅하기:

```bash
# Session setup
ruflo pair start \
  --mode navigator \
  --agent debugger-expert \
  --focus debug \
  --trace
```

**세션 흐름:**
```
👥 Starting debugging session...

/status
> Analyzing application for memory issues...

/perf --profile
> Memory usage growing: 150MB → 450MB over 10 minutes

/find "new EventEmitter" --regex
> Found 3 instances of EventEmitter creation

/inspect eventEmitters --deep
> Discovering listeners not being removed

/suggest fix for memory leak
> AI suggests: "Add removeListener in cleanup functions"

/implement cleanup functions for all event emitters
> AI generates proper cleanup code

/test
> Memory stable at 150MB ✅

/commit --message "fix: memory leak in event emitters"
```

#### 예시 3: TDD 세션

테스트 주도 개발로 장바구니 만들기:

```bash
# Session setup
ruflo pair start \
  --mode tdd \
  --agent tdd-specialist \
  --test-first
```

**세션 흐름:**
```
👥 TDD Session: Shopping Cart Feature

[RED PHASE]
/test-gen "add item to cart"
> AI writes failing test:
  ✗ should add item to cart
  ✗ should update quantity for existing item
  ✗ should calculate total price

[GREEN PHASE]
/implement minimal cart functionality
> You write just enough code to pass tests

/test
> Tests passing: 3/3 ✅

[REFACTOR PHASE]
/refactor --pattern repository
> AI refactors to repository pattern

/test
> Tests still passing: 3/3 ✅

[NEXT CYCLE]
/test-gen "remove item from cart"
> AI writes new failing tests...
```

#### 예시 4: 코드 리팩터링

레거시 코드 현대화하기:

```bash
# Session setup
ruflo pair start \
  --mode driver \
  --focus refactor \
  --verify \
  --threshold 0.98
```

**세션 흐름:**
```
👥 Refactoring Session: Modernizing UserService

/analyze UserService.js
> AI identifies:
  - Callback hell (5 levels deep)
  - No error handling
  - Tight coupling
  - No tests

/suggest refactoring plan
> AI suggests:
  1. Convert callbacks to async/await
  2. Add error boundaries
  3. Extract dependencies
  4. Add unit tests

/test-gen --before-refactor
> AI generates tests for current behavior

/refactor callbacks to async/await
# You refactor with AI guidance

/test
> All tests passing ✅

/review --compare
> AI shows before/after comparison
> Code complexity: 35 → 12
> Truth score: 0.99 ✅

/commit --message "refactor: modernize UserService with async/await"
```

#### 예시 5: 성능 최적화

느린 React 애플리케이션 최적화하기:

```bash
# Session setup
ruflo pair start \
  --mode switch \
  --agent performance-expert \
  --focus optimize \
  --profile
```

**세션 흐름:**
```
👥 Performance Optimization Session

/perf --profile
> React DevTools Profiler Results:
  - ProductList: 450ms render
  - CartSummary: 200ms render
  - Unnecessary re-renders: 15

/suggest optimizations for ProductList
> AI suggests:
  1. Add React.memo
  2. Use useMemo for expensive calculations
  3. Implement virtualization for long lists

/implement React.memo and useMemo
# You implement with AI guidance

/perf --profile
> ProductList: 45ms render (90% improvement!) ✅

/implement virtualization with react-window
> AI implements virtual scrolling

/perf --profile
> ProductList: 12ms render (97% improvement!) ✅
> FPS: 60 stable ✅

/commit --message "perf: optimize ProductList with memoization and virtualization"
```

#### 예시 6: API 개발

Express로 RESTful API 만들기:

```bash
# Session setup
ruflo pair start \
  --mode navigator \
  --agent backend-expert \
  --focus implement \
  --test
```

**세션 흐름:**
```
👥 API Development Session

/design REST API for blog platform
> AI designs endpoints:
  POST   /api/posts
  GET    /api/posts
  GET    /api/posts/:id
  PUT    /api/posts/:id
  DELETE /api/posts/:id

/implement CRUD endpoints with validation
> AI implements with Express + Joi validation

/test-gen --integration
> AI generates integration tests

/security --api
> AI adds:
  - Rate limiting
  - Input sanitization
  - JWT authentication
  - CORS configuration

/document --openapi
> AI generates OpenAPI documentation

/test --integration
> All endpoints tested: 15/15 ✅
```

### 세션 템플릿

#### 빠른 시작 템플릿

```bash
# Refactoring template
ruflo pair --template refactor
# Focus: Code improvement
# Verification: High (0.98)
# Testing: After each change
# Review: Continuous

# Feature template
ruflo pair --template feature
# Focus: Implementation
# Verification: Standard (0.95)
# Testing: On completion
# Review: Pre-commit

# Debug template
ruflo pair --template debug
# Focus: Problem solving
# Verification: Moderate (0.90)
# Testing: Regression tests
# Review: Root cause

# Learning template
ruflo pair --template learn
# Mode: Mentor
# Pace: Slow
# Explanations: Detailed
# Examples: Many
```

### 세션 관리

#### 세션 상태

```bash
ruflo pair status
```

**출력:**
```
👥 Pair Programming Session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Session ID: pair_1755021234567
Duration: 45 minutes
Status: Active

Partner: senior-dev
Current Role: DRIVER (you)
Mode: Switch (10m intervals)
Next Switch: in 3 minutes

📊 Metrics:
├── Truth Score: 0.982 ✅
├── Lines Changed: 234
├── Files Modified: 5
├── Tests Added: 12
├── Coverage: 87% ↑3%
└── Commits: 3

🎯 Focus: Implementation
📝 Current File: src/auth/login.js
```

#### 세션 기록

```bash
ruflo pair history
```

**출력:**
```
📚 Session History
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 2024-01-15 14:30 - 16:45 (2h 15m)
   Partner: expert-coder
   Focus: Refactoring
   Truth Score: 0.975
   Changes: +340 -125 lines

2. 2024-01-14 10:00 - 11:30 (1h 30m)
   Partner: tdd-specialist
   Focus: Testing
   Truth Score: 0.991
   Tests Added: 24

3. 2024-01-13 15:00 - 17:00 (2h)
   Partner: debugger-expert
   Focus: Bug Fixing
   Truth Score: 0.968
   Issues Fixed: 5
```

#### 세션 유지

```bash
# Save session
ruflo pair --save [--name <name>]

# Load session
ruflo pair --load <session-id>

# Export session
ruflo pair --export <session-id> [--format json|md]

# Generate report
ruflo pair --report <session-id>
```

#### 백그라운드 세션

```bash
# Start in background
ruflo pair start --background

# Monitor background session
ruflo pair --monitor

# Attach to background session
ruflo pair --attach <session-id>

# End background session
ruflo pair end <session-id>
```

### 고급 기능

#### 사용자 정의 명령

설정에서 정의한다:

```json
{
  "customCommands": {
    "tdd": "/test-gen && /test --watch",
    "full-review": "/lint --fix && /test && /review --strict",
    "quick-fix": "/suggest --type fix && /implement && /test"
  }
}
```

사용자 정의 명령 사용:
```
/custom tdd
/custom full-review
```

#### 명령 체이닝

```
/test && /commit && /push
/lint --fix && /test && /review --strict
```

#### 세션 녹화

```bash
# Start with recording
ruflo pair start --record

# Replay session
ruflo pair --replay <session-id>

# Session analytics
ruflo pair --analytics <session-id>
```

#### 연동 옵션

**Git과 함께:**
```bash
ruflo pair start --git --auto-commit
```

**CI/CD와 함께:**
```bash
ruflo pair start --ci --non-interactive
```

**IDE와 함께:**
```bash
ruflo pair start --ide vscode
```

### 모범 사례

#### 세션 운영
1. **명확한 목표** - 세션 목표를 미리 정한다
2. **알맞은 모드** - 작업 유형에 따라 고른다
3. **검증 활성화** - 핵심 코드 경로에 적용한다
4. **정기적인 테스트** - 품질을 꾸준히 유지한다
5. **세션 메모** - 중요한 결정을 기록한다
6. **정기적인 휴식** - 45~60분마다 쉰다

#### 코드 작성
1. **일찍 테스트한다** - 변경할 때마다 테스트를 실행한다
2. **커밋 전에 검증한다** - truth score를 확인한다
3. **보안을 리뷰한다** - 민감한 코드는 항상 리뷰한다
4. **성능을 프로파일링한다** - 최적화에는 `/perf`를 쓴다
5. **세션을 저장한다** - 복잡한 작업일 때
6. **AI에게서 배운다** - 자주 질문한다

#### 모드 선택
- **Driver 모드**: 학습할 때, 구현을 직접 통제할 때
- **Navigator 모드**: 빠른 프로토타이핑, 코드 생성
- **Switch 모드**: 긴 세션, 균형 잡힌 협업
- **TDD 모드**: 테스트와 함께 개발할 때
- **Review 모드**: 품질에 집중할 때
- **Mentor 모드**: 학습이 우선일 때
- **Debug 모드**: 문제를 고칠 때

### 문제 해결

#### 세션이 시작되지 않을 때
- 에이전트 사용 가능 여부를 확인한다
- 설정 파일 문법을 검증한다
- 작업 공간이 깨끗한지 확인한다
- 로그 파일을 검토한다

#### 세션 연결이 끊겼을 때
- `--recover`로 복원한다
- 네트워크 연결을 확인한다
- 백그라운드 프로세스를 확인한다
- 자동 저장 파일을 검토한다

#### 성능이 나쁠 때
- 검증 임계값을 낮춘다
- 지속적 테스트를 끈다
- 시스템 자원을 확인한다
- 더 가벼운 AI 모델을 쓴다

#### 설정 문제
- JSON 문법을 검증한다
- 파일 권한을 확인한다
- 우선순위 순서를 검토한다 (CLI > env > project > user > global)
- `ruflo pair config validate`를 실행한다

### 품질 지표

#### Truth Score 임계값
```
Error:   < 0.90 ❌
Warning: 0.90 - 0.95 ⚠️
Good:    0.95 - 0.98 ✅
Excellent: > 0.98 🌟
```

#### 커버리지 임계값
```
Error:   < 70% ❌
Warning: 70% - 80% ⚠️
Good:    80% - 90% ✅
Excellent: > 90% 🌟
```

#### 복잡도 임계값
```
Error:   > 15 ❌
Warning: 10 - 15 ⚠️
Good:    5 - 10 ✅
Excellent: < 5 🌟
```

### 환경 변수

환경 변수로 설정을 덮어쓴다:

```bash
export CLAUDE_PAIR_MODE=driver
export CLAUDE_PAIR_VERIFY=true
export CLAUDE_PAIR_THRESHOLD=0.98
export CLAUDE_PAIR_AGENT=senior-dev
export CLAUDE_PAIR_AUTO_TEST=true
```

### 명령 기록

기록 탐색:
- `↑/↓` - 명령 기록을 위아래로 이동한다
- `Ctrl+R` - 명령 기록을 검색한다
- `!!` - 마지막 명령을 반복한다
- `!<n>` - 기록의 n번째 명령을 실행한다

### 키보드 단축키 (설정 가능)

기본 단축키:
```json
{
  "shortcuts": {
    "switch": "ctrl+shift+s",
    "suggest": "ctrl+space",
    "review": "ctrl+r",
    "test": "ctrl+t"
  }
}
```

### 관련 명령

- `ruflo pair --help` - 도움말을 보여 준다
- `ruflo pair config` - 설정을 관리한다
- `ruflo pair profile` - 프로필을 관리한다
- `ruflo pair templates` - 템플릿을 나열한다
- `ruflo pair agents` - 사용 가능한 에이전트를 나열한다
