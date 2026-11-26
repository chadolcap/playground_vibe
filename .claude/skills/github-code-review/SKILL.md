---
name: github-code-review
description: AI 기반 swarm 협업으로 수행하는 종합 GitHub code review (PR 리뷰) 스킬
---

# GitHub 코드 리뷰 스킬

> **AI 기반 코드 리뷰**: 전문 리뷰 에이전트를 배치해 기존 정적 분석을 넘어서는 포괄적이고 지능적인 코드 리뷰를 수행한다.

## 🎯 빠른 시작

### 간단한 리뷰
```bash
# Initialize review swarm for PR
gh pr view 123 --json files,diff | npx ruv-swarm github review-init --pr 123

# Post review status
gh pr comment 123 --body "🔍 Multi-agent code review initiated"
```

### 전체 리뷰 워크플로
```bash
# Get PR context with gh CLI
PR_DATA=$(gh pr view 123 --json files,additions,deletions,title,body)
PR_DIFF=$(gh pr diff 123)

# Initialize comprehensive review
npx ruv-swarm github review-init \
  --pr 123 \
  --pr-data "$PR_DATA" \
  --diff "$PR_DIFF" \
  --agents "security,performance,style,architecture,accessibility" \
  --depth comprehensive
```

---

## 📚 목차

<details>
<summary><strong>핵심 기능</strong></summary>

- [다중 에이전트 리뷰 시스템](#multi-agent-review-system)
- [전문 리뷰 에이전트](#specialized-review-agents)
- [PR 기반 Swarm 관리](#pr-based-swarm-management)
- [자동화 워크플로](#automated-workflows)
- [품질 게이트와 검사](#quality-gates--checks)

</details>

<details>
<summary><strong>리뷰 에이전트</strong></summary>

- [보안 리뷰 에이전트](#security-review-agent)
- [성능 리뷰 에이전트](#performance-review-agent)
- [아키텍처 리뷰 에이전트](#architecture-review-agent)
- [스타일·컨벤션 에이전트](#style--convention-agent)
- [접근성 에이전트](#accessibility-agent)

</details>

<details>
<summary><strong>고급 기능</strong></summary>

- [맥락 인식 리뷰](#context-aware-reviews)
- [이력 기반 학습](#learning-from-history)
- [PR 간 분석](#cross-pr-analysis)
- [사용자 정의 리뷰 에이전트](#custom-review-agents)

</details>

<details>
<summary><strong>통합과 자동화</strong></summary>

- [CI/CD 통합](#cicd-integration)
- [Webhook 핸들러](#webhook-handlers)
- [PR 댓글 명령](#pr-comment-commands)
- [자동 수정](#automated-fixes)

</details>

---

## 🚀 핵심 기능

### 다중 에이전트 리뷰 시스템

포괄적인 코드 리뷰를 위해 전문 AI 에이전트를 배치한다.

```bash
# Initialize review swarm with GitHub CLI integration
PR_DATA=$(gh pr view 123 --json files,additions,deletions,title,body)
PR_DIFF=$(gh pr diff 123)

# Start multi-agent review
npx ruv-swarm github review-init \
  --pr 123 \
  --pr-data "$PR_DATA" \
  --diff "$PR_DIFF" \
  --agents "security,performance,style,architecture,accessibility" \
  --depth comprehensive

# Post initial review status
gh pr comment 123 --body "🔍 Multi-agent code review initiated"
```

**장점:**
- ✅ 전문 에이전트가 병렬로 리뷰한다
- ✅ 여러 영역을 포괄적으로 다룬다
- ✅ 조정된 분석으로 리뷰 주기가 빨라진다
- ✅ 일관된 품질 기준을 적용한다

---

## 🤖 전문 리뷰 에이전트

### 보안 리뷰 에이전트

**초점:** 보안 취약점을 찾아내고 수정 방법을 제안한다

```bash
# Get changed files from PR
CHANGED_FILES=$(gh pr view 123 --json files --jq '.files[].path')

# Run security-focused review
SECURITY_RESULTS=$(npx ruv-swarm github review-security \
  --pr 123 \
  --files "$CHANGED_FILES" \
  --check "owasp,cve,secrets,permissions" \
  --suggest-fixes)

# Post findings based on severity
if echo "$SECURITY_RESULTS" | grep -q "critical"; then
  # Request changes for critical issues
  gh pr review 123 --request-changes --body "$SECURITY_RESULTS"
  gh pr edit 123 --add-label "security-review-required"
else
  # Post as comment for non-critical issues
  gh pr comment 123 --body "$SECURITY_RESULTS"
fi
```

<details>
<summary><strong>수행하는 보안 검사</strong></summary>

```javascript
{
  "checks": [
    "SQL injection vulnerabilities",
    "XSS attack vectors",
    "Authentication bypasses",
    "Authorization flaws",
    "Cryptographic weaknesses",
    "Dependency vulnerabilities",
    "Secret exposure",
    "CORS misconfigurations"
  ],
  "actions": [
    "Block PR on critical issues",
    "Suggest secure alternatives",
    "Add security test cases",
    "Update security documentation"
  ]
}
```

</details>

<details>
<summary><strong>댓글 템플릿: 보안 이슈</strong></summary>

```markdown
🔒 **Security Issue: [Type]**

**Severity**: 🔴 Critical / 🟡 High / 🟢 Low

**Description**:
[Clear explanation of the security issue]

**Impact**:
[Potential consequences if not addressed]

**Suggested Fix**:
```language
[Code example of the fix]
```

**References**:
- [OWASP Guide](link)
- [Security Best Practices](link)
```

</details>

---

### 성능 리뷰 에이전트

**초점:** 성능 영향과 최적화 기회를 분석한다

```bash
# Run performance analysis
npx ruv-swarm github review-performance \
  --pr 123 \
  --profile "cpu,memory,io" \
  --benchmark-against main \
  --suggest-optimizations
```

<details>
<summary><strong>분석하는 성능 지표</strong></summary>

```javascript
{
  "metrics": [
    "Algorithm complexity (Big O analysis)",
    "Database query efficiency",
    "Memory allocation patterns",
    "Cache utilization",
    "Network request optimization",
    "Bundle size impact",
    "Render performance"
  ],
  "benchmarks": [
    "Compare with baseline",
    "Load test simulations",
    "Memory leak detection",
    "Bottleneck identification"
  ]
}
```

</details>

---

### 아키텍처 리뷰 에이전트

**초점:** 디자인 패턴과 아키텍처 결정을 평가한다

```bash
# Architecture review
npx ruv-swarm github review-architecture \
  --pr 123 \
  --check "patterns,coupling,cohesion,solid" \
  --visualize-impact \
  --suggest-refactoring
```

<details>
<summary><strong>아키텍처 분석</strong></summary>

```javascript
{
  "patterns": [
    "Design pattern adherence",
    "SOLID principles",
    "DRY violations",
    "Separation of concerns",
    "Dependency injection",
    "Layer violations",
    "Circular dependencies"
  ],
  "metrics": [
    "Coupling metrics",
    "Cohesion scores",
    "Complexity measures",
    "Maintainability index"
  ]
}
```

</details>

---

### 스타일·컨벤션 에이전트

**초점:** 코딩 표준과 모범 사례를 적용한다

```bash
# Style enforcement with auto-fix
npx ruv-swarm github review-style \
  --pr 123 \
  --check "formatting,naming,docs,tests" \
  --auto-fix "formatting,imports,whitespace"
```

<details>
<summary><strong>스타일 검사</strong></summary>

```javascript
{
  "checks": [
    "Code formatting",
    "Naming conventions",
    "Documentation standards",
    "Comment quality",
    "Test coverage",
    "Error handling patterns",
    "Logging standards"
  ],
  "auto-fix": [
    "Formatting issues",
    "Import organization",
    "Trailing whitespace",
    "Simple naming issues"
  ]
}
```

</details>

---

## 🔄 PR 기반 Swarm 관리

### PR에서 Swarm 생성

```bash
# Create swarm from PR description using gh CLI
gh pr view 123 --json body,title,labels,files | npx ruv-swarm swarm create-from-pr

# Auto-spawn agents based on PR labels
gh pr view 123 --json labels | npx ruv-swarm swarm auto-spawn

# Create swarm with full PR context
gh pr view 123 --json body,labels,author,assignees | \
  npx ruv-swarm swarm init --from-pr-data
```

### Label 기반 에이전트 할당

PR label을 전문 에이전트에 매핑한다.

```json
{
  "label-mapping": {
    "bug": ["debugger", "tester"],
    "feature": ["architect", "coder", "tester"],
    "refactor": ["analyst", "coder"],
    "docs": ["researcher", "writer"],
    "performance": ["analyst", "optimizer"],
    "security": ["security", "authentication", "audit"]
  }
}
```

### PR 크기별 토폴로지 선택

```bash
# Automatic topology selection based on PR complexity
# Small PR (< 100 lines): ring topology
# Medium PR (100-500 lines): mesh topology
# Large PR (> 500 lines): hierarchical topology
npx ruv-swarm github pr-topology --pr 123
```

---

## 🎬 PR 댓글 명령

PR 댓글에서 swarm 명령을 바로 실행한다.

```markdown
<!-- In PR comment -->
/swarm init mesh 6
/swarm spawn coder "Implement authentication"
/swarm spawn tester "Write unit tests"
/swarm status
/swarm review --agents security,performance
```

<details>
<summary><strong>댓글 명령용 Webhook 핸들러</strong></summary>

```javascript
// webhook-handler.js
const { createServer } = require('http');
const { execSync } = require('child_process');

createServer((req, res) => {
  if (req.url === '/github-webhook') {
    const event = JSON.parse(body);

    if (event.action === 'opened' && event.pull_request) {
      execSync(`npx ruv-swarm github pr-init ${event.pull_request.number}`);
    }

    if (event.comment && event.comment.body.startsWith('/swarm')) {
      const command = event.comment.body;
      execSync(`npx ruv-swarm github handle-comment --pr ${event.issue.number} --command "${command}"`);
    }

    res.writeHead(200);
    res.end('OK');
  }
}).listen(3000);
```

</details>

---

## ⚙️ 리뷰 설정

### 설정 파일

```yaml
# .github/review-swarm.yml
version: 1
review:
  auto-trigger: true
  required-agents:
    - security
    - performance
    - style
  optional-agents:
    - architecture
    - accessibility
    - i18n

  thresholds:
    security: block      # Block merge on security issues
    performance: warn    # Warn on performance issues
    style: suggest       # Suggest style improvements

  rules:
    security:
      - no-eval
      - no-hardcoded-secrets
      - proper-auth-checks
      - validate-input
    performance:
      - no-n-plus-one
      - efficient-queries
      - proper-caching
      - optimize-loops
    architecture:
      - max-coupling: 5
      - min-cohesion: 0.7
      - follow-patterns
      - avoid-circular-deps
```

### 사용자 정의 리뷰 트리거

```javascript
{
  "triggers": {
    "high-risk-files": {
      "paths": ["**/auth/**", "**/payment/**", "**/admin/**"],
      "agents": ["security", "architecture"],
      "depth": "comprehensive",
      "require-approval": true
    },
    "performance-critical": {
      "paths": ["**/api/**", "**/database/**", "**/cache/**"],
      "agents": ["performance", "database"],
      "benchmarks": true,
      "regression-threshold": "5%"
    },
    "ui-changes": {
      "paths": ["**/components/**", "**/styles/**", "**/pages/**"],
      "agents": ["accessibility", "style", "i18n"],
      "visual-tests": true,
      "responsive-check": true
    }
  }
}
```

---

## 🤖 자동화 워크플로

### PR 생성 시 자동 리뷰

```yaml
# .github/workflows/auto-review.yml
name: Automated Code Review
on:
  pull_request:
    types: [opened, synchronize]
  issue_comment:
    types: [created]

jobs:
  swarm-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup GitHub CLI
        run: echo "${{ secrets.GITHUB_TOKEN }}" | gh auth login --with-token

      - name: Run Review Swarm
        run: |
          # Get PR context with gh CLI
          PR_NUM=${{ github.event.pull_request.number }}
          PR_DATA=$(gh pr view $PR_NUM --json files,title,body,labels)
          PR_DIFF=$(gh pr diff $PR_NUM)

          # Run swarm review
          REVIEW_OUTPUT=$(npx ruv-swarm github review-all \
            --pr $PR_NUM \
            --pr-data "$PR_DATA" \
            --diff "$PR_DIFF" \
            --agents "security,performance,style,architecture")

          # Post review results
          echo "$REVIEW_OUTPUT" | gh pr review $PR_NUM --comment -F -

          # Update PR status
          if echo "$REVIEW_OUTPUT" | grep -q "approved"; then
            gh pr review $PR_NUM --approve
          elif echo "$REVIEW_OUTPUT" | grep -q "changes-requested"; then
            gh pr review $PR_NUM --request-changes -b "See review comments above"
          fi

      - name: Update Labels
        run: |
          # Add labels based on review results
          if echo "$REVIEW_OUTPUT" | grep -q "security"; then
            gh pr edit $PR_NUM --add-label "security-review"
          fi
          if echo "$REVIEW_OUTPUT" | grep -q "performance"; then
            gh pr edit $PR_NUM --add-label "performance-review"
          fi
```

---

## 💬 지능형 댓글 생성

### 맥락 기반 리뷰 댓글 생성

```bash
# Get PR diff with context
PR_DIFF=$(gh pr diff 123 --color never)
PR_FILES=$(gh pr view 123 --json files)

# Generate review comments
COMMENTS=$(npx ruv-swarm github review-comment \
  --pr 123 \
  --diff "$PR_DIFF" \
  --files "$PR_FILES" \
  --style "constructive" \
  --include-examples \
  --suggest-fixes)

# Post comments using gh CLI
echo "$COMMENTS" | jq -c '.[]' | while read -r comment; do
  FILE=$(echo "$comment" | jq -r '.path')
  LINE=$(echo "$comment" | jq -r '.line')
  BODY=$(echo "$comment" | jq -r '.body')
  COMMIT_ID=$(gh pr view 123 --json headRefOid -q .headRefOid)

  # Create inline review comments
  gh api \
    --method POST \
    /repos/:owner/:repo/pulls/123/comments \
    -f path="$FILE" \
    -f line="$LINE" \
    -f body="$BODY" \
    -f commit_id="$COMMIT_ID"
done
```

### 댓글 일괄 관리

```bash
# Manage review comments efficiently
npx ruv-swarm github review-comments \
  --pr 123 \
  --group-by "agent,severity" \
  --summarize \
  --resolve-outdated
```

---

## 🚪 품질 게이트와 검사

### 상태 검사

```yaml
# Required status checks in branch protection
protection_rules:
  required_status_checks:
    strict: true
    contexts:
      - "review-swarm/security"
      - "review-swarm/performance"
      - "review-swarm/architecture"
      - "review-swarm/tests"
```

### 품질 게이트 정의

```bash
# Set quality gate thresholds
npx ruv-swarm github quality-gates \
  --define '{
    "security": {"threshold": "no-critical"},
    "performance": {"regression": "<5%"},
    "coverage": {"minimum": "80%"},
    "architecture": {"complexity": "<10"},
    "duplication": {"maximum": "5%"}
  }'
```

### 리뷰 지표 추적

```bash
# Monitor review effectiveness
npx ruv-swarm github review-metrics \
  --period 30d \
  --metrics "issues-found,false-positives,fix-rate,time-to-review" \
  --export-dashboard \
  --format json
```

---

## 🎓 고급 기능

### 맥락 인식 리뷰

프로젝트 전체 맥락을 바탕으로 PR을 분석한다.

```bash
# Review with comprehensive context
npx ruv-swarm github review-context \
  --pr 123 \
  --load-related-prs \
  --analyze-impact \
  --check-breaking-changes \
  --dependency-analysis
```

### 이력 기반 학습

코드베이스의 패턴으로 리뷰 에이전트를 학습시킨다.

```bash
# Learn from past reviews
npx ruv-swarm github review-learn \
  --analyze-past-reviews \
  --identify-patterns \
  --improve-suggestions \
  --reduce-false-positives

# Train on your codebase
npx ruv-swarm github review-train \
  --learn-patterns \
  --adapt-to-style \
  --improve-accuracy
```

### PR 간 분석

관련된 pull request 사이의 리뷰를 조정한다.

```bash
# Analyze related PRs together
npx ruv-swarm github review-batch \
  --prs "123,124,125" \
  --check-consistency \
  --verify-integration \
  --combined-impact
```

### 다중 PR Swarm 조정

```bash
# Coordinate swarms across related PRs
npx ruv-swarm github multi-pr \
  --prs "123,124,125" \
  --strategy "parallel" \
  --share-memory
```

---

## 🛠️ 사용자 정의 리뷰 에이전트

### 사용자 정의 에이전트 만들기

```javascript
// custom-review-agent.js
class CustomReviewAgent {
  constructor(config) {
    this.config = config;
    this.rules = config.rules || [];
  }

  async review(pr) {
    const issues = [];

    // Custom logic: Check for TODO comments in production code
    if (await this.checkTodoComments(pr)) {
      issues.push({
        severity: 'warning',
        file: pr.file,
        line: pr.line,
        message: 'TODO comment found in production code',
        suggestion: 'Resolve TODO or create issue to track it'
      });
    }

    // Custom logic: Verify API versioning
    if (await this.checkApiVersioning(pr)) {
      issues.push({
        severity: 'error',
        file: pr.file,
        line: pr.line,
        message: 'API endpoint missing versioning',
        suggestion: 'Add /v1/, /v2/ prefix to API routes'
      });
    }

    return issues;
  }

  async checkTodoComments(pr) {
    // Implementation
    const todoRegex = /\/\/\s*TODO|\/\*\s*TODO/gi;
    return todoRegex.test(pr.diff);
  }

  async checkApiVersioning(pr) {
    // Implementation
    const apiRegex = /app\.(get|post|put|delete)\(['"]\/api\/(?!v\d+)/;
    return apiRegex.test(pr.diff);
  }
}

module.exports = CustomReviewAgent;
```

### 사용자 정의 에이전트 등록

```bash
# Register custom review agent
npx ruv-swarm github register-agent \
  --name "custom-reviewer" \
  --file "./custom-review-agent.js" \
  --category "standards"
```

---

## 🔧 CI/CD 통합

### 빌드 파이프라인과 통합

```yaml
# .github/workflows/build-and-review.yml
name: Build and Review
on: [pull_request]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm test
      - run: npm run build

  swarm-review:
    needs: build-and-test
    runs-on: ubuntu-latest
    steps:
      - name: Run Swarm Review
        run: |
          npx ruv-swarm github review-all \
            --pr ${{ github.event.pull_request.number }} \
            --include-build-results
```

### 자동 PR 수정

```bash
# Auto-fix common issues
npx ruv-swarm github pr-fix 123 \
  --issues "lint,test-failures,formatting" \
  --commit-fixes \
  --push-changes
```

### PR에 진행 상황 업데이트

```bash
# Post swarm progress to PR using gh CLI
PROGRESS=$(npx ruv-swarm github pr-progress 123 --format markdown)

gh pr comment 123 --body "$PROGRESS"

# Update PR labels based on progress
if [[ $(echo "$PROGRESS" | grep -o '[0-9]\+%' | sed 's/%//') -gt 90 ]]; then
  gh pr edit 123 --add-label "ready-for-review"
fi
```

---

## 📋 전체 워크플로 예시

### 예시 1: 보안이 중요한 PR

```bash
# Review authentication system changes
npx ruv-swarm github review-init \
  --pr 456 \
  --agents "security,authentication,audit" \
  --depth "maximum" \
  --require-security-approval \
  --penetration-test
```

### 예시 2: 성능에 민감한 PR

```bash
# Review database optimization
npx ruv-swarm github review-init \
  --pr 789 \
  --agents "performance,database,caching" \
  --benchmark \
  --profile \
  --load-test
```

### 예시 3: UI 컴포넌트 PR

```bash
# Review new component library
npx ruv-swarm github review-init \
  --pr 321 \
  --agents "accessibility,style,i18n,docs" \
  --visual-regression \
  --component-tests \
  --responsive-check
```

### 예시 4: 기능 개발 PR

```bash
# Review new feature implementation
gh pr view 456 --json body,labels,files | \
  npx ruv-swarm github pr-init 456 \
    --topology hierarchical \
    --agents "architect,coder,tester,security" \
    --auto-assign-tasks
```

### 예시 5: 버그 수정 PR

```bash
# Review bug fix with debugging focus
npx ruv-swarm github pr-init 789 \
  --topology mesh \
  --agents "debugger,analyst,tester" \
  --priority high \
  --regression-test
```

---

## 📊 모니터링과 분석

### 리뷰 대시보드

```bash
# Launch real-time review dashboard
npx ruv-swarm github review-dashboard \
  --real-time \
  --show "agent-activity,issue-trends,fix-rates,coverage"
```

### 리뷰 보고서 생성

```bash
# Create comprehensive review report
npx ruv-swarm github review-report \
  --format "markdown" \
  --include "summary,details,trends,recommendations" \
  --email-stakeholders \
  --export-pdf
```

### PR Swarm 분석

```bash
# Generate PR-specific analytics
npx ruv-swarm github pr-report 123 \
  --metrics "completion-time,agent-efficiency,token-usage,issue-density" \
  --format markdown \
  --compare-baseline
```

### GitHub Insights로 내보내기

```bash
# Export metrics to GitHub Insights
npx ruv-swarm github export-metrics \
  --pr 123 \
  --to-insights \
  --dashboard-url
```

---

## 🔐 보안 고려 사항

### 모범 사례

1. **토큰 권한**: GitHub 토큰에는 꼭 필요한 최소 범위만 준다
2. **명령 검증**: 실행 전에 모든 PR 댓글을 검증한다
3. **속도 제한**: PR 작업에 속도 제한을 둔다
4. **감사 기록**: 규정 준수를 위해 모든 swarm 작업을 기록한다
5. **시크릿 관리**: PR 댓글이나 로그에 API 키를 절대 노출하지 않는다

### 보안 체크리스트

- [ ] GitHub 토큰 범위를 저장소로만 제한
- [ ] Webhook 서명 검증
- [ ] 명령 인젝션 방어 활성화
- [ ] 속도 제한 설정
- [ ] 감사 로그 활성화
- [ ] 시크릿 스캔 활성화
- [ ] 브랜치 보호 규칙 적용

---

## 📚 모범 사례

### 1. 리뷰 설정
- ✅ 명확한 리뷰 기준을 미리 정한다
- ✅ 적절한 심각도 기준치를 설정한다
- ✅ 사용하는 기술 스택에 맞게 에이전트 전문 분야를 설정한다
- ✅ 긴급 상황용 예외 처리 절차를 마련한다

### 2. 댓글 품질
- ✅ 실행 가능하고 구체적인 피드백을 준다
- ✅ 제안에 코드 예시를 포함한다
- ✅ 문서와 모범 사례를 참조한다
- ✅ 정중하고 건설적인 어조를 유지한다

### 3. 성능 최적화
- ✅ 중복 작업을 피하도록 분석 결과를 캐시한다
- ✅ 큰 PR에는 점진적 리뷰를 사용한다
- ✅ 에이전트 병렬 실행을 켠다
- ✅ 댓글 작업을 효율적으로 묶어 처리한다

### 4. PR 템플릿

```markdown
<!-- .github/pull_request_template.md -->
## Swarm Configuration
- Topology: [mesh/hierarchical/ring/star]
- Max Agents: [number]
- Auto-spawn: [yes/no]
- Priority: [high/medium/low]

## Tasks for Swarm
- [ ] Task 1 description
- [ ] Task 2 description
- [ ] Task 3 description

## Review Focus Areas
- [ ] Security review
- [ ] Performance analysis
- [ ] Architecture validation
- [ ] Accessibility check
```

### 5. 준비되면 자동 병합

```bash
# Auto-merge when swarm completes and passes checks
SWARM_STATUS=$(npx ruv-swarm github pr-status 123)

if [[ "$SWARM_STATUS" == "complete" ]]; then
  # Check review requirements
  REVIEWS=$(gh pr view 123 --json reviews --jq '.reviews | length')

  if [[ $REVIEWS -ge 2 ]]; then
    # Enable auto-merge
    gh pr merge 123 --auto --squash
  fi
fi
```

---

## 🔗 Claude Code와의 통합

### 워크플로 패턴

1. **Claude Code**가 PR diff와 맥락을 읽는다
2. **Swarm**이 PR 유형에 따라 리뷰 방식을 조정한다
3. **에이전트**들이 서로 다른 리뷰 측면을 병렬로 처리한다
4. **진행 상황** 업데이트가 PR에 자동으로 게시된다
5. 준비 완료로 표시하기 전에 **최종 리뷰**를 수행한다

### 예시: 전체 PR 관리

```javascript
[Single Message - Parallel Execution]:
  // Initialize coordination
  mcp__claude-flow__swarm_init { topology: "hierarchical", maxAgents: 5 }
  mcp__claude-flow__agent_spawn { agentType: "reviewer", name: "Senior Reviewer" }
  mcp__claude-flow__agent_spawn { agentType: "tester", name: "QA Engineer" }
  mcp__claude-flow__agent_spawn { agentType: "coordinator", name: "Merge Coordinator" }

  // Create and manage PR using gh CLI
  Bash("gh pr create --title 'Feature: Add authentication' --base main")
  Bash("gh pr view 54 --json files,diff")
  Bash("gh pr review 54 --approve --body 'LGTM after automated review'")

  // Execute tests and validation
  Bash("npm test")
  Bash("npm run lint")
  Bash("npm run build")

  // Track progress
  TodoWrite { todos: [
    { content: "Complete code review", status: "completed", activeForm: "Completing code review" },
    { content: "Run test suite", status: "completed", activeForm: "Running test suite" },
    { content: "Validate security", status: "completed", activeForm: "Validating security" },
    { content: "Merge when ready", status: "pending", activeForm: "Merging when ready" }
  ]}
```

---

## 🆘 문제 해결

### 자주 발생하는 문제

<details>
<summary><strong>문제: 리뷰 에이전트가 생성되지 않음</strong></summary>

**해결:**
```bash
# Check swarm status
npx ruv-swarm swarm-status

# Verify GitHub CLI authentication
gh auth status

# Re-initialize swarm
npx ruv-swarm github review-init --pr 123 --force
```

</details>

<details>
<summary><strong>문제: 댓글이 PR에 게시되지 않음</strong></summary>

**해결:**
```bash
# Verify GitHub token permissions
gh auth status

# Check API rate limits
gh api rate_limit

# Use batch comment posting
npx ruv-swarm github review-comments --pr 123 --batch
```

</details>

<details>
<summary><strong>문제: 리뷰가 너무 오래 걸림</strong></summary>

**해결:**
```bash
# Use incremental review for large PRs
npx ruv-swarm github review-init --pr 123 --incremental

# Reduce agent count
npx ruv-swarm github review-init --pr 123 --agents "security,style" --max-agents 3

# Enable parallel processing
npx ruv-swarm github review-init --pr 123 --parallel --cache-results
```

</details>

---

## 📖 추가 자료

### 관련 스킬
- `github-pr-manager` - PR 수명 주기 전반을 관리한다
- `github-workflow-automation` - GitHub 워크플로를 자동화한다
- `swarm-coordination` - 고급 swarm 오케스트레이션

### 문서
- [GitHub CLI 문서](https://cli.github.com/manual/)
- [RUV Swarm 가이드](https://github.com/ruvnet/ruv-swarm)
- [Claude Flow 통합](https://github.com/ruvnet/claude-flow)

### 지원
- GitHub Issues: 버그를 보고하고 기능을 요청한다
- 커뮤니티: 토론에 참여하고 경험을 공유한다
- 예시: 예시 설정과 워크플로를 살펴본다

---

## 📄 라이선스

이 스킬은 Claude Code Flow 프로젝트의 일부이며 MIT License로 배포된다.

---

**최종 수정일:** 2025-10-19
**버전:** 1.0.0
**관리자:** Claude Code Flow Team
