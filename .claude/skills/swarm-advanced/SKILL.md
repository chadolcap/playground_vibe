---
name: swarm-advanced
description: |
  research, development, testing, 복잡한 분산 워크플로를 위한 고급 swarm 오케스트레이션(orchestration) 패턴이다
---

# 고급 스웜 오케스트레이션

분산 조사·개발·테스트 워크플로를 위한 고급 스웜 패턴을 익힌다. 이 스킬은 MCP 도구와 CLI 명령을 모두 사용하는 포괄적인 오케스트레이션 전략을 다룬다.

## 빠른 시작

### 사전 준비
```bash
# Ensure Claude Flow is installed
npm install -g claude-flow@alpha

# Add MCP server (if using MCP tools)
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

### 기본 패턴
```javascript
// 1. Initialize swarm topology
mcp__claude-flow__swarm_init({ topology: "mesh", maxAgents: 6 })

// 2. Spawn specialized agents
mcp__claude-flow__agent_spawn({ agentType: "researcher", name: "Agent 1" })

// 3. Orchestrate tasks
mcp__claude-flow__task_orchestrate({ task: "...", strategy: "parallel" })
```

## 핵심 개념

### 스웜 토폴로지

**Mesh 토폴로지** - 피어 투 피어 통신이며, 조사와 분석에 가장 알맞다
- 모든 에이전트가 직접 통신한다
- 유연성과 복원력이 높다
- 사용처: 조사, 분석, 브레인스토밍

**Hierarchical 토폴로지** - 코디네이터와 하위 에이전트로 구성되며, 개발에 가장 알맞다
- 명령 체계가 명확하다
- 순차 워크플로를 지원한다
- 사용처: 개발, 구조화된 워크플로

**Star 토폴로지** - 중앙 코디네이터를 두며, 테스트에 가장 알맞다
- 중앙에서 제어하고 모니터링한다
- 조정 아래 병렬로 실행한다
- 사용처: 테스트, 검증, 품질 보증

**Ring 토폴로지** - 순차 처리 체인이다
- 단계별로 처리한다
- 파이프라인 워크플로
- 사용처: 다단계 처리, 데이터 파이프라인

### 에이전트 전략

**Adaptive** - 작업 복잡도에 따라 동적으로 조정한다
**Balanced** - 에이전트에 작업을 고르게 분배한다
**Specialized** - 작업별로 전문 에이전트를 배정한다
**Parallel** - 동시 실행을 최대화한다

## 패턴 1: 조사 스웜

### 목적
병렬 정보 수집, 분석, 종합을 통해 깊이 있는 조사를 수행한다.

### 아키텍처
```javascript
// Initialize research swarm
mcp__claude-flow__swarm_init({
  "topology": "mesh",
  "maxAgents": 6,
  "strategy": "adaptive"
})

// Spawn research team
const researchAgents = [
  {
    type: "researcher",
    name: "Web Researcher",
    capabilities: ["web-search", "content-extraction", "source-validation"]
  },
  {
    type: "researcher",
    name: "Academic Researcher",
    capabilities: ["paper-analysis", "citation-tracking", "literature-review"]
  },
  {
    type: "analyst",
    name: "Data Analyst",
    capabilities: ["data-processing", "statistical-analysis", "visualization"]
  },
  {
    type: "analyst",
    name: "Pattern Analyzer",
    capabilities: ["trend-detection", "correlation-analysis", "outlier-detection"]
  },
  {
    type: "documenter",
    name: "Report Writer",
    capabilities: ["synthesis", "technical-writing", "formatting"]
  }
]

// Spawn all agents
researchAgents.forEach(agent => {
  mcp__claude-flow__agent_spawn({
    agentType: agent.type,
    name: agent.name,
    capabilities: agent.capabilities
  })
})
```

### 조사 워크플로

#### 1단계: 정보 수집
```javascript
// Parallel information collection
mcp__claude-flow__parallel_execute({
  "tasks": [
    {
      "id": "web-search",
      "command": "search recent publications and articles"
    },
    {
      "id": "academic-search",
      "command": "search academic databases and papers"
    },
    {
      "id": "data-collection",
      "command": "gather relevant datasets and statistics"
    },
    {
      "id": "expert-search",
      "command": "identify domain experts and thought leaders"
    }
  ]
})

// Store research findings in memory
mcp__claude-flow__memory_usage({
  "action": "store",
  "key": "research-findings-" + Date.now(),
  "value": JSON.stringify(findings),
  "namespace": "research",
  "ttl": 604800 // 7 days
})
```

#### 2단계: 분석과 검증
```javascript
// Pattern recognition in findings
mcp__claude-flow__pattern_recognize({
  "data": researchData,
  "patterns": ["trend", "correlation", "outlier", "emerging-pattern"]
})

// Cognitive analysis
mcp__claude-flow__cognitive_analyze({
  "behavior": "research-synthesis"
})

// Quality assessment
mcp__claude-flow__quality_assess({
  "target": "research-sources",
  "criteria": ["credibility", "relevance", "recency", "authority"]
})

// Cross-reference validation
mcp__claude-flow__neural_patterns({
  "action": "analyze",
  "operation": "fact-checking",
  "metadata": { "sources": sourcesArray }
})
```

#### 3단계: 지식 관리
```javascript
// Search existing knowledge base
mcp__claude-flow__memory_search({
  "pattern": "topic X",
  "namespace": "research",
  "limit": 20
})

// Create knowledge graph connections
mcp__claude-flow__neural_patterns({
  "action": "learn",
  "operation": "knowledge-graph",
  "metadata": {
    "topic": "X",
    "connections": relatedTopics,
    "depth": 3
  }
})

// Store connections for future use
mcp__claude-flow__memory_usage({
  "action": "store",
  "key": "knowledge-graph-X",
  "value": JSON.stringify(knowledgeGraph),
  "namespace": "research/graphs",
  "ttl": 2592000 // 30 days
})
```

#### 4단계: 보고서 생성
```javascript
// Orchestrate report generation
mcp__claude-flow__task_orchestrate({
  "task": "generate comprehensive research report",
  "strategy": "sequential",
  "priority": "high",
  "dependencies": ["gather", "analyze", "validate", "synthesize"]
})

// Monitor research progress
mcp__claude-flow__swarm_status({
  "swarmId": "research-swarm"
})

// Generate final report
mcp__claude-flow__workflow_execute({
  "workflowId": "research-report-generation",
  "params": {
    "findings": findings,
    "format": "comprehensive",
    "sections": ["executive-summary", "methodology", "findings", "analysis", "conclusions", "references"]
  }
})
```

### CLI 대체 방법
```bash
# Quick research swarm
npx @claude-flow/cli@latest swarm "research AI trends in 2025" \
  --strategy research \
  --mode distributed \
  --max-agents 6 \
  --parallel \
  --output research-report.md
```

## 패턴 2: 개발 스웜

### 목적
전문 에이전트들의 조정을 통해 풀스택 개발을 수행한다.

### 아키텍처
```javascript
// Initialize development swarm with hierarchy
mcp__claude-flow__swarm_init({
  "topology": "hierarchical",
  "maxAgents": 8,
  "strategy": "balanced"
})

// Spawn development team
const devTeam = [
  { type: "architect", name: "System Architect", role: "coordinator" },
  { type: "coder", name: "Backend Developer", capabilities: ["node", "api", "database"] },
  { type: "coder", name: "Frontend Developer", capabilities: ["react", "ui", "ux"] },
  { type: "coder", name: "Database Engineer", capabilities: ["sql", "nosql", "optimization"] },
  { type: "tester", name: "QA Engineer", capabilities: ["unit", "integration", "e2e"] },
  { type: "reviewer", name: "Code Reviewer", capabilities: ["security", "performance", "best-practices"] },
  { type: "documenter", name: "Technical Writer", capabilities: ["api-docs", "guides", "tutorials"] },
  { type: "monitor", name: "DevOps Engineer", capabilities: ["ci-cd", "deployment", "monitoring"] }
]

// Spawn all team members
devTeam.forEach(member => {
  mcp__claude-flow__agent_spawn({
    agentType: member.type,
    name: member.name,
    capabilities: member.capabilities,
    swarmId: "dev-swarm"
  })
})
```

### 개발 워크플로

#### 1단계: 아키텍처와 설계
```javascript
// System architecture design
mcp__claude-flow__task_orchestrate({
  "task": "design system architecture for REST API",
  "strategy": "sequential",
  "priority": "critical",
  "assignTo": "System Architect"
})

// Store architecture decisions
mcp__claude-flow__memory_usage({
  "action": "store",
  "key": "architecture-decisions",
  "value": JSON.stringify(architectureDoc),
  "namespace": "development/design"
})
```

#### 2단계: 병렬 구현
```javascript
// Parallel development tasks
mcp__claude-flow__parallel_execute({
  "tasks": [
    {
      "id": "backend-api",
      "command": "implement REST API endpoints",
      "assignTo": "Backend Developer"
    },
    {
      "id": "frontend-ui",
      "command": "build user interface components",
      "assignTo": "Frontend Developer"
    },
    {
      "id": "database-schema",
      "command": "design and implement database schema",
      "assignTo": "Database Engineer"
    },
    {
      "id": "api-documentation",
      "command": "create API documentation",
      "assignTo": "Technical Writer"
    }
  ]
})

// Monitor development progress
mcp__claude-flow__swarm_monitor({
  "swarmId": "dev-swarm",
  "interval": 5000
})
```

#### 3단계: 테스트와 검증
```javascript
// Comprehensive testing
mcp__claude-flow__batch_process({
  "items": [
    { type: "unit", target: "all-modules" },
    { type: "integration", target: "api-endpoints" },
    { type: "e2e", target: "user-flows" },
    { type: "performance", target: "critical-paths" }
  ],
  "operation": "execute-tests"
})

// Quality assessment
mcp__claude-flow__quality_assess({
  "target": "codebase",
  "criteria": ["coverage", "complexity", "maintainability", "security"]
})
```

#### 4단계: 리뷰와 배포
```javascript
// Code review workflow
mcp__claude-flow__workflow_execute({
  "workflowId": "code-review-process",
  "params": {
    "reviewers": ["Code Reviewer"],
    "criteria": ["security", "performance", "best-practices"]
  }
})

// CI/CD pipeline
mcp__claude-flow__pipeline_create({
  "config": {
    "stages": ["build", "test", "security-scan", "deploy"],
    "environment": "production"
  }
})
```

### CLI 대체 방법
```bash
# Quick development swarm
npx @claude-flow/cli@latest swarm "build REST API with authentication" \
  --strategy development \
  --mode hierarchical \
  --monitor \
  --output sqlite
```

## 패턴 3: 테스트 스웜

### 목적
분산 테스트를 통해 포괄적인 품질 보증을 수행한다.

### 아키텍처
```javascript
// Initialize testing swarm with star topology
mcp__claude-flow__swarm_init({
  "topology": "star",
  "maxAgents": 7,
  "strategy": "parallel"
})

// Spawn testing team
const testingTeam = [
  {
    type: "tester",
    name: "Unit Test Coordinator",
    capabilities: ["unit-testing", "mocking", "coverage", "tdd"]
  },
  {
    type: "tester",
    name: "Integration Tester",
    capabilities: ["integration", "api-testing", "contract-testing"]
  },
  {
    type: "tester",
    name: "E2E Tester",
    capabilities: ["e2e", "ui-testing", "user-flows", "selenium"]
  },
  {
    type: "tester",
    name: "Performance Tester",
    capabilities: ["load-testing", "stress-testing", "benchmarking"]
  },
  {
    type: "monitor",
    name: "Security Tester",
    capabilities: ["security-testing", "penetration-testing", "vulnerability-scanning"]
  },
  {
    type: "analyst",
    name: "Test Analyst",
    capabilities: ["coverage-analysis", "test-optimization", "reporting"]
  },
  {
    type: "documenter",
    name: "Test Documenter",
    capabilities: ["test-documentation", "test-plans", "reports"]
  }
]

// Spawn all testers
testingTeam.forEach(tester => {
  mcp__claude-flow__agent_spawn({
    agentType: tester.type,
    name: tester.name,
    capabilities: tester.capabilities,
    swarmId: "testing-swarm"
  })
})
```

### 테스트 워크플로

#### 1단계: 테스트 계획
```javascript
// Analyze test coverage requirements
mcp__claude-flow__quality_assess({
  "target": "test-coverage",
  "criteria": [
    "line-coverage",
    "branch-coverage",
    "function-coverage",
    "edge-cases"
  ]
})

// Identify test scenarios
mcp__claude-flow__pattern_recognize({
  "data": testScenarios,
  "patterns": [
    "edge-case",
    "boundary-condition",
    "error-path",
    "happy-path"
  ]
})

// Store test plan
mcp__claude-flow__memory_usage({
  "action": "store",
  "key": "test-plan-" + Date.now(),
  "value": JSON.stringify(testPlan),
  "namespace": "testing/plans"
})
```

#### 2단계: 병렬 테스트 실행
```javascript
// Execute all test suites in parallel
mcp__claude-flow__parallel_execute({
  "tasks": [
    {
      "id": "unit-tests",
      "command": "npm run test:unit",
      "assignTo": "Unit Test Coordinator"
    },
    {
      "id": "integration-tests",
      "command": "npm run test:integration",
      "assignTo": "Integration Tester"
    },
    {
      "id": "e2e-tests",
      "command": "npm run test:e2e",
      "assignTo": "E2E Tester"
    },
    {
      "id": "performance-tests",
      "command": "npm run test:performance",
      "assignTo": "Performance Tester"
    },
    {
      "id": "security-tests",
      "command": "npm run test:security",
      "assignTo": "Security Tester"
    }
  ]
})

// Batch process test suites
mcp__claude-flow__batch_process({
  "items": testSuites,
  "operation": "execute-test-suite"
})
```

#### 3단계: 성능과 보안
```javascript
// Run performance benchmarks
mcp__claude-flow__benchmark_run({
  "suite": "comprehensive-performance"
})

// Bottleneck analysis
mcp__claude-flow__bottleneck_analyze({
  "component": "application",
  "metrics": ["response-time", "throughput", "memory", "cpu"]
})

// Security scanning
mcp__claude-flow__security_scan({
  "target": "application",
  "depth": "comprehensive"
})

// Vulnerability analysis
mcp__claude-flow__error_analysis({
  "logs": securityScanLogs
})
```

#### 4단계: 모니터링과 보고
```javascript
// Real-time test monitoring
mcp__claude-flow__swarm_monitor({
  "swarmId": "testing-swarm",
  "interval": 2000
})

// Generate comprehensive test report
mcp__claude-flow__performance_report({
  "format": "detailed",
  "timeframe": "current-run"
})

// Get test results
mcp__claude-flow__task_results({
  "taskId": "test-execution-001"
})

// Trend analysis
mcp__claude-flow__trend_analysis({
  "metric": "test-coverage",
  "period": "30d"
})
```

### CLI 대체 방법
```bash
# Quick testing swarm
npx @claude-flow/cli@latest swarm "test application comprehensively" \
  --strategy testing \
  --mode star \
  --parallel \
  --timeout 600
```

## 패턴 4: 분석 스웜

### 목적
전문 분석기를 통해 코드와 시스템을 깊이 분석한다.

### 아키텍처
```javascript
// Initialize analysis swarm
mcp__claude-flow__swarm_init({
  "topology": "mesh",
  "maxAgents": 5,
  "strategy": "adaptive"
})

// Spawn analysis specialists
const analysisTeam = [
  {
    type: "analyst",
    name: "Code Analyzer",
    capabilities: ["static-analysis", "complexity-analysis", "dead-code-detection"]
  },
  {
    type: "analyst",
    name: "Security Analyzer",
    capabilities: ["security-scan", "vulnerability-detection", "dependency-audit"]
  },
  {
    type: "analyst",
    name: "Performance Analyzer",
    capabilities: ["profiling", "bottleneck-detection", "optimization"]
  },
  {
    type: "analyst",
    name: "Architecture Analyzer",
    capabilities: ["dependency-analysis", "coupling-detection", "modularity-assessment"]
  },
  {
    type: "documenter",
    name: "Analysis Reporter",
    capabilities: ["reporting", "visualization", "recommendations"]
  }
]

// Spawn all analysts
analysisTeam.forEach(analyst => {
  mcp__claude-flow__agent_spawn({
    agentType: analyst.type,
    name: analyst.name,
    capabilities: analyst.capabilities
  })
})
```

### 분석 워크플로
```javascript
// Parallel analysis execution
mcp__claude-flow__parallel_execute({
  "tasks": [
    { "id": "analyze-code", "command": "analyze codebase structure and quality" },
    { "id": "analyze-security", "command": "scan for security vulnerabilities" },
    { "id": "analyze-performance", "command": "identify performance bottlenecks" },
    { "id": "analyze-architecture", "command": "assess architectural patterns" }
  ]
})

// Generate comprehensive analysis report
mcp__claude-flow__performance_report({
  "format": "detailed",
  "timeframe": "current"
})

// Cost analysis
mcp__claude-flow__cost_analysis({
  "timeframe": "30d"
})
```

## 고급 기법

### 오류 처리와 장애 허용

```javascript
// Setup fault tolerance for all agents
mcp__claude-flow__daa_fault_tolerance({
  "agentId": "all",
  "strategy": "auto-recovery"
})

// Error handling pattern
try {
  await mcp__claude-flow__task_orchestrate({
    "task": "complex operation",
    "strategy": "parallel",
    "priority": "high"
  })
} catch (error) {
  // Check swarm health
  const status = await mcp__claude-flow__swarm_status({})

  // Analyze error patterns
  await mcp__claude-flow__error_analysis({
    "logs": [error.message]
  })

  // Auto-recovery attempt
  if (status.healthy) {
    await mcp__claude-flow__task_orchestrate({
      "task": "retry failed operation",
      "strategy": "sequential"
    })
  }
}
```

### 메모리와 상태 관리

```javascript
// Cross-session persistence
mcp__claude-flow__memory_persist({
  "sessionId": "swarm-session-001"
})

// Namespace management for different swarms
mcp__claude-flow__memory_namespace({
  "namespace": "research-swarm",
  "action": "create"
})

// Create state snapshot
mcp__claude-flow__state_snapshot({
  "name": "development-checkpoint-1"
})

// Restore from snapshot if needed
mcp__claude-flow__context_restore({
  "snapshotId": "development-checkpoint-1"
})

// Backup memory stores
mcp__claude-flow__memory_backup({
  "path": "/workspaces/claude-code-flow/backups/swarm-memory.json"
})
```

### 뉴럴 패턴 학습

```javascript
// Train neural patterns from successful workflows
mcp__claude-flow__neural_train({
  "pattern_type": "coordination",
  "training_data": JSON.stringify(successfulWorkflows),
  "epochs": 50
})

// Adaptive learning from experience
mcp__claude-flow__learning_adapt({
  "experience": {
    "workflow": "research-to-report",
    "success": true,
    "duration": 3600,
    "quality": 0.95
  }
})

// Pattern recognition for optimization
mcp__claude-flow__pattern_recognize({
  "data": workflowMetrics,
  "patterns": ["bottleneck", "optimization-opportunity", "efficiency-gain"]
})
```

### 워크플로 자동화

```javascript
// Create reusable workflow
mcp__claude-flow__workflow_create({
  "name": "full-stack-development",
  "steps": [
    { "phase": "design", "agents": ["architect"] },
    { "phase": "implement", "agents": ["backend-dev", "frontend-dev"], "parallel": true },
    { "phase": "test", "agents": ["tester", "security-tester"], "parallel": true },
    { "phase": "review", "agents": ["reviewer"] },
    { "phase": "deploy", "agents": ["devops"] }
  ],
  "triggers": ["on-commit", "scheduled-daily"]
})

// Setup automation rules
mcp__claude-flow__automation_setup({
  "rules": [
    {
      "trigger": "file-changed",
      "pattern": "*.js",
      "action": "run-tests"
    },
    {
      "trigger": "PR-created",
      "action": "code-review-swarm"
    }
  ]
})

// Event-driven triggers
mcp__claude-flow__trigger_setup({
  "events": ["code-commit", "PR-merge", "deployment"],
  "actions": ["test", "analyze", "document"]
})
```

### 성능 최적화

```javascript
// Topology optimization
mcp__claude-flow__topology_optimize({
  "swarmId": "current-swarm"
})

// Load balancing
mcp__claude-flow__load_balance({
  "swarmId": "development-swarm",
  "tasks": taskQueue
})

// Agent coordination sync
mcp__claude-flow__coordination_sync({
  "swarmId": "development-swarm"
})

// Auto-scaling
mcp__claude-flow__swarm_scale({
  "swarmId": "development-swarm",
  "targetSize": 12
})
```

### 모니터링과 지표

```javascript
// Real-time swarm monitoring
mcp__claude-flow__swarm_monitor({
  "swarmId": "active-swarm",
  "interval": 3000
})

// Collect comprehensive metrics
mcp__claude-flow__metrics_collect({
  "components": ["agents", "tasks", "memory", "performance"]
})

// Health monitoring
mcp__claude-flow__health_check({
  "components": ["swarm", "agents", "neural", "memory"]
})

// Usage statistics
mcp__claude-flow__usage_stats({
  "component": "swarm-orchestration"
})

// Trend analysis
mcp__claude-flow__trend_analysis({
  "metric": "agent-performance",
  "period": "7d"
})
```

## 모범 사례

### 1. 알맞은 토폴로지 고르기

- **Mesh**: 조사, 브레인스토밍, 협업 분석
- **Hierarchical**: 구조화된 개발, 순차 워크플로
- **Star**: 테스트, 검증, 중앙 집중 조정
- **Ring**: 파이프라인 처리, 단계별 워크플로

### 2. 에이전트 전문화

- 에이전트마다 구체적인 역량을 부여한다
- 책임이 겹치지 않게 한다
- 복잡한 워크플로에는 조정 에이전트를 사용한다
- 에이전트 간 통신에 메모리를 활용한다

### 3. 병렬 실행

- 병렬화할 수 있는 독립 작업을 찾는다
- 의존성이 있는 작업은 순차로 실행한다
- 병렬 실행 중 자원 사용량을 모니터링한다
- 적절한 오류 처리를 구현한다

### 4. 메모리 관리

- 네임스페이스로 메모리를 정리한다
- 알맞은 TTL 값을 설정한다
- 정기적으로 백업한다
- 체크포인트용 상태 스냅샷을 구현한다

### 5. 모니터링과 최적화

- 스웜 상태를 정기적으로 모니터링한다
- 지표를 수집하고 분석한다
- 성능에 따라 토폴로지를 최적화한다
- 뉴럴 패턴으로 성공 사례를 학습한다

### 6. 오류 복구

- 장애 허용 전략을 구현한다
- 자동 복구 메커니즘을 사용한다
- 오류 패턴을 분석한다
- 대체(fallback) 워크플로를 만든다

## 실제 예시

### 예시 1: AI 조사 프로젝트
```javascript
// Research AI trends, analyze findings, generate report
mcp__claude-flow__swarm_init({ topology: "mesh", maxAgents: 6 })
// Spawn: 2 researchers, 2 analysts, 1 synthesizer, 1 documenter
// Parallel gather → Analyze patterns → Synthesize → Report
```

### 예시 2: 풀스택 애플리케이션
```javascript
// Build complete web application with testing
mcp__claude-flow__swarm_init({ topology: "hierarchical", maxAgents: 8 })
// Spawn: 1 architect, 2 devs, 1 db engineer, 2 testers, 1 reviewer, 1 devops
// Design → Parallel implement → Test → Review → Deploy
```

### 예시 3: 보안 감사
```javascript
// Comprehensive security analysis
mcp__claude-flow__swarm_init({ topology: "star", maxAgents: 5 })
// Spawn: 1 coordinator, 1 code analyzer, 1 security scanner, 1 penetration tester, 1 reporter
// Parallel scan → Vulnerability analysis → Penetration test → Report
```

### 예시 4: 성능 최적화
```javascript
// Identify and fix performance bottlenecks
mcp__claude-flow__swarm_init({ topology: "mesh", maxAgents: 4 })
// Spawn: 1 profiler, 1 bottleneck analyzer, 1 optimizer, 1 tester
// Profile → Identify bottlenecks → Optimize → Validate
```

## 문제 해결

### 자주 발생하는 문제

**문제**: 스웜 에이전트들이 제대로 조정되지 않는다
**해결**: 토폴로지 선택을 점검하고, 메모리 사용을 확인하고, 모니터링을 켠다

**문제**: 병렬 실행이 실패한다
**해결**: 작업 의존성을 확인하고, 자원 한도를 점검하고, 오류 처리를 구현한다

**문제**: 메모리 영속화가 동작하지 않는다
**해결**: 네임스페이스를 확인하고, TTL 설정을 점검하고, 백업 설정을 확인한다

**문제**: 성능이 떨어진다
**해결**: 토폴로지를 최적화하고, 에이전트 수를 줄이고, 병목을 분석한다

## 관련 스킬

- `sparc-methodology` - 체계적인 개발 워크플로
- `github-integration` - 저장소 관리와 자동화
- `neural-patterns` - AI 기반 조정 최적화
- `memory-management` - 세션 간 상태 영속화

## 참고 자료

- [Claude Flow 문서](https://github.com/ruvnet/claude-flow)
- [스웜 오케스트레이션 가이드](https://github.com/ruvnet/claude-flow/wiki/swarm)
- [MCP 도구 참조](https://github.com/ruvnet/claude-flow/wiki/mcp)
- [성능 최적화](https://github.com/ruvnet/claude-flow/wiki/performance)

---

**버전**: 2.0.0
**최종 수정일**: 2025-10-19
**스킬 수준**: 고급
**예상 학습 시간**: 2~3시간
