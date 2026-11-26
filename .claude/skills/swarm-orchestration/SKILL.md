---
name: swarm-orchestration
description: "agentic-flow로 multi-agent swarm을 오케스트레이션(orchestration)해 병렬 작업 실행(parallel task execution), 동적 토폴로지(dynamic topology), 지능형 조정(intelligent coordination)을 수행한다. 단일 에이전트를 넘어 확장하거나, 복잡한 워크플로를 구현하거나, 분산 AI 시스템(distributed AI systems)을 만들 때 사용한다."
---

# Swarm 오케스트레이션

## 이 스킬이 하는 일

agentic-flow의 고급 조정 시스템으로 다중 에이전트 swarm을 오케스트레이션한다. mesh, hierarchical, adaptive 토폴로지를 지원하며, 작업 자동 분배, 부하 분산, 장애 허용(fault tolerance)을 제공한다.

## 사전 요구 사항

- agentic-flow v1.5.11+
- Node.js 18+
- 분산 시스템에 대한 이해 (있으면 도움이 된다)

## 빠른 시작

```bash
# Initialize swarm
npx agentic-flow hooks swarm-init --topology mesh --max-agents 5

# Spawn agents
npx agentic-flow hooks agent-spawn --type coder
npx agentic-flow hooks agent-spawn --type tester
npx agentic-flow hooks agent-spawn --type reviewer

# Orchestrate task
npx agentic-flow hooks task-orchestrate \
  --task "Build REST API with tests" \
  --mode parallel
```

## 토폴로지 패턴

### 1. Mesh (피어 간 직접 연결)
```typescript
// Equal peers, distributed decision-making
await swarm.init({
  topology: 'mesh',
  agents: ['coder', 'tester', 'reviewer'],
  communication: 'broadcast'
});
```

### 2. Hierarchical (Queen-Worker 계층형)
```typescript
// Centralized coordination, specialized workers
await swarm.init({
  topology: 'hierarchical',
  queen: 'architect',
  workers: ['backend-dev', 'frontend-dev', 'db-designer']
});
```

### 3. Adaptive (동적)
```typescript
// Automatically switches topology based on task
await swarm.init({
  topology: 'adaptive',
  optimization: 'task-complexity'
});
```

## 작업 오케스트레이션

### 병렬 실행
```typescript
// Execute tasks concurrently
const results = await swarm.execute({
  tasks: [
    { agent: 'coder', task: 'Implement API endpoints' },
    { agent: 'frontend', task: 'Build UI components' },
    { agent: 'tester', task: 'Write test suite' }
  ],
  mode: 'parallel',
  timeout: 300000 // 5 minutes
});
```

### 파이프라인 실행
```typescript
// Sequential pipeline with dependencies
await swarm.pipeline([
  { stage: 'design', agent: 'architect' },
  { stage: 'implement', agent: 'coder', after: 'design' },
  { stage: 'test', agent: 'tester', after: 'implement' },
  { stage: 'review', agent: 'reviewer', after: 'test' }
]);
```

### 적응형 실행
```typescript
// Let swarm decide execution strategy
await swarm.autoOrchestrate({
  goal: 'Build production-ready API',
  constraints: {
    maxTime: 3600,
    maxAgents: 8,
    quality: 'high'
  }
});
```

## 메모리 조정

```typescript
// Share state across swarm
await swarm.memory.store('api-schema', {
  endpoints: [...],
  models: [...]
});

// Agents read shared memory
const schema = await swarm.memory.retrieve('api-schema');
```

## 고급 기능

### 부하 분산
```typescript
// Automatic work distribution
await swarm.enableLoadBalancing({
  strategy: 'dynamic',
  metrics: ['cpu', 'memory', 'task-queue']
});
```

### 장애 허용
```typescript
// Handle agent failures
await swarm.setResiliency({
  retry: { maxAttempts: 3, backoff: 'exponential' },
  fallback: 'reassign-task'
});
```

### 성능 모니터링
```typescript
// Track swarm metrics
const metrics = await swarm.getMetrics();
// { throughput, latency, success_rate, agent_utilization }
```

## Hooks 연동

```bash
# Pre-task coordination
npx agentic-flow hooks pre-task --description "Build API"

# Post-task synchronization
npx agentic-flow hooks post-task --task-id "task-123"

# Session restore
npx agentic-flow hooks session-restore --session-id "swarm-001"
```

## 모범 사례

1. **작게 시작한다**: 에이전트 2~3개로 시작해 점차 늘린다
2. **메모리를 쓴다**: swarm 메모리로 컨텍스트를 공유한다
3. **지표를 모니터링한다**: 성능과 병목을 추적한다
4. **hooks를 켠다**: 조정과 동기화를 자동화한다
5. **타임아웃을 건다**: 멈춘 작업을 막는다

## 문제 해결

### 문제: 에이전트끼리 조정이 안 된다
**해결**: 메모리 접근을 확인하고 hooks를 켠다

### 문제: 성능이 낮다
**해결**: 토폴로지를 점검하고(adaptive 사용) 부하 분산을 켠다

## 더 알아보기

- Swarm 가이드: docs/swarm/orchestration.md
- 토폴로지 패턴: docs/swarm/topologies.md
- Hooks 연동: docs/hooks/coordination.md
