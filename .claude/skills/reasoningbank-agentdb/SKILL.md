---
name: reasoningbank-agentdb
description: "150배 빠른 AgentDB 벡터 데이터베이스로 ReasoningBank adaptive learning(적응형 학습)을 구현한다. trajectory tracking(궤적 추적), verdict judgment(판정), memory distillation(메모리 증류), pattern recognition(패턴 인식)을 포함한다. self-learning agent를 만들거나, decision-making(의사결정)을 최적화하거나, experience replay 시스템을 구현할 때 사용한다."
---

# AgentDB 기반 ReasoningBank

## 이 스킬이 하는 일

AgentDB의 고성능 백엔드(150배~12,500배 빠름)를 이용한 ReasoningBank 적응형 학습 패턴을 제공한다. 에이전트가 경험에서 배우고, 결과를 판정하고, 메모리를 증류하고, 시간이 지나며 의사결정을 개선하게 하며 하위 호환성은 100%다.

**성능**: 패턴 조회 150배, 배치 작업 500배 빠르고 메모리 접근은 1ms 미만이다.

## 사전 요구 사항

- Node.js 18+
- AgentDB v1.0.7+ (agentic-flow 경유)
- 강화학습 개념에 대한 이해 (선택)

---

## CLI로 빠르게 시작하기

### ReasoningBank 데이터베이스 초기화

```bash
# Initialize AgentDB for ReasoningBank
npx agentdb@latest init ./.agentdb/reasoningbank.db --dimension 1536

# Start MCP server for Claude Code integration
npx agentdb@latest mcp
claude mcp add agentdb npx agentdb@latest mcp
```

### 기존 ReasoningBank에서 마이그레이션

```bash
# Automatic migration with validation
npx agentdb@latest migrate --source .swarm/memory.db

# Verify migration
npx agentdb@latest stats ./.agentdb/reasoningbank.db
```

---

## API로 빠르게 시작하기

```typescript
import { createAgentDBAdapter, computeEmbedding } from 'agentic-flow/reasoningbank';

// Initialize ReasoningBank with AgentDB
const rb = await createAgentDBAdapter({
  dbPath: '.agentdb/reasoningbank.db',
  enableLearning: true,      // Enable learning plugins
  enableReasoning: true,      // Enable reasoning agents
  cacheSize: 1000,            // 1000 pattern cache
});

// Store successful experience
const query = "How to optimize database queries?";
const embedding = await computeEmbedding(query);

await rb.insertPattern({
  id: '',
  type: 'experience',
  domain: 'database-optimization',
  pattern_data: JSON.stringify({
    embedding,
    pattern: {
      query,
      approach: 'indexing + query optimization',
      outcome: 'success',
      metrics: { latency_reduction: 0.85 }
    }
  }),
  confidence: 0.95,
  usage_count: 1,
  success_count: 1,
  created_at: Date.now(),
  last_used: Date.now(),
});

// Retrieve similar experiences with reasoning
const result = await rb.retrieveWithReasoning(embedding, {
  domain: 'database-optimization',
  k: 5,
  useMMR: true,              // Diverse results
  synthesizeContext: true,    // Rich context synthesis
});

console.log('Memories:', result.memories);
console.log('Context:', result.context);
console.log('Patterns:', result.patterns);
```

---

## ReasoningBank 핵심 개념

### 1. 궤적 추적

에이전트의 실행 경로와 결과를 추적한다:

```typescript
// Record trajectory (sequence of actions)
const trajectory = {
  task: 'optimize-api-endpoint',
  steps: [
    { action: 'analyze-bottleneck', result: 'found N+1 query' },
    { action: 'add-eager-loading', result: 'reduced queries' },
    { action: 'add-caching', result: 'improved latency' }
  ],
  outcome: 'success',
  metrics: { latency_before: 2500, latency_after: 150 }
};

const embedding = await computeEmbedding(JSON.stringify(trajectory));

await rb.insertPattern({
  id: '',
  type: 'trajectory',
  domain: 'api-optimization',
  pattern_data: JSON.stringify({ embedding, pattern: trajectory }),
  confidence: 0.9,
  usage_count: 1,
  success_count: 1,
  created_at: Date.now(),
  last_used: Date.now(),
});
```

### 2. 판정

궤적이 성공했는지 판정한다:

```typescript
// Retrieve similar past trajectories
const similar = await rb.retrieveWithReasoning(queryEmbedding, {
  domain: 'api-optimization',
  k: 10,
});

// Judge based on similarity to successful patterns
const verdict = similar.memories.filter(m =>
  m.pattern.outcome === 'success' &&
  m.similarity > 0.8
).length > 5 ? 'likely_success' : 'needs_review';

console.log('Verdict:', verdict);
console.log('Confidence:', similar.memories[0]?.similarity || 0);
```

### 3. 메모리 증류

비슷한 경험들을 패턴으로 통합한다:

```typescript
// Get all experiences in domain
const experiences = await rb.retrieveWithReasoning(embedding, {
  domain: 'api-optimization',
  k: 100,
  optimizeMemory: true,  // Automatic consolidation
});

// Distill into high-level pattern
const distilledPattern = {
  domain: 'api-optimization',
  pattern: 'For N+1 queries: add eager loading, then cache',
  success_rate: 0.92,
  sample_size: experiences.memories.length,
  confidence: 0.95
};

await rb.insertPattern({
  id: '',
  type: 'distilled-pattern',
  domain: 'api-optimization',
  pattern_data: JSON.stringify({
    embedding: await computeEmbedding(JSON.stringify(distilledPattern)),
    pattern: distilledPattern
  }),
  confidence: 0.95,
  usage_count: 0,
  success_count: 0,
  created_at: Date.now(),
  last_used: Date.now(),
});
```

---

## 추론 에이전트 연동

AgentDB는 ReasoningBank를 강화하는 추론 모듈 4개를 제공한다:

### 1. PatternMatcher

비슷한 성공 패턴을 찾는다:

```typescript
const result = await rb.retrieveWithReasoning(queryEmbedding, {
  domain: 'problem-solving',
  k: 10,
  useMMR: true,  // Maximal Marginal Relevance for diversity
});

// PatternMatcher returns diverse, relevant memories
result.memories.forEach(mem => {
  console.log(`Pattern: ${mem.pattern.approach}`);
  console.log(`Similarity: ${mem.similarity}`);
  console.log(`Success Rate: ${mem.success_count / mem.usage_count}`);
});
```

### 2. ContextSynthesizer

여러 메모리에서 풍부한 맥락을 만든다:

```typescript
const result = await rb.retrieveWithReasoning(queryEmbedding, {
  domain: 'code-optimization',
  synthesizeContext: true,  // Enable context synthesis
  k: 5,
});

// ContextSynthesizer creates coherent narrative
console.log('Synthesized Context:', result.context);
// "Based on 5 similar optimizations, the most effective approach
//  involves profiling, identifying bottlenecks, and applying targeted
//  improvements. Success rate: 87%"
```

### 3. MemoryOptimizer

자동으로 통합하고 가지치기한다:

```typescript
const result = await rb.retrieveWithReasoning(queryEmbedding, {
  domain: 'testing',
  optimizeMemory: true,  // Enable automatic optimization
});

// MemoryOptimizer consolidates similar patterns and prunes low-quality
console.log('Optimizations:', result.optimizations);
// { consolidated: 15, pruned: 3, improved_quality: 0.12 }
```

### 4. ExperienceCurator

품질과 관련성으로 걸러 낸다:

```typescript
const result = await rb.retrieveWithReasoning(queryEmbedding, {
  domain: 'debugging',
  k: 20,
  minConfidence: 0.8,  // Only high-confidence experiences
});

// ExperienceCurator returns only quality experiences
result.memories.forEach(mem => {
  console.log(`Confidence: ${mem.confidence}`);
  console.log(`Success Rate: ${mem.success_count / mem.usage_count}`);
});
```

---

## 기존 API 호환성

AgentDB는 기존 ReasoningBank와의 하위 호환성을 100% 유지한다:

```typescript
import {
  retrieveMemories,
  judgeTrajectory,
  distillMemories
} from 'agentic-flow/reasoningbank';

// Legacy API works unchanged (uses AgentDB backend automatically)
const memories = await retrieveMemories(query, {
  domain: 'code-generation',
  agent: 'coder'
});

const verdict = await judgeTrajectory(trajectory, query);

const newMemories = await distillMemories(
  trajectory,
  verdict,
  query,
  { domain: 'code-generation' }
);
```

---

## 성능 특성

- **패턴 검색**: 150배 빠름 (100µs 대 15ms)
- **메모리 조회**: <1ms (캐시 사용 시)
- **배치 삽입**: 500배 빠름 (패턴 100개 기준 2ms 대 1s)
- **궤적 판정**: <5ms (조회 + 분석 포함)
- **메모리 증류**: <50ms (패턴 100개 통합)

---

## 고급 패턴

### 계층형 메모리

추상화 수준별로 메모리를 정리한다:

```typescript
// Low-level: Specific implementation
await rb.insertPattern({
  type: 'concrete',
  domain: 'debugging/null-pointer',
  pattern_data: JSON.stringify({
    embedding,
    pattern: { bug: 'NPE in UserService.getUser()', fix: 'Add null check' }
  }),
  confidence: 0.9,
  // ...
});

// Mid-level: Pattern across similar cases
await rb.insertPattern({
  type: 'pattern',
  domain: 'debugging',
  pattern_data: JSON.stringify({
    embedding,
    pattern: { category: 'null-pointer', approach: 'defensive-checks' }
  }),
  confidence: 0.85,
  // ...
});

// High-level: General principle
await rb.insertPattern({
  type: 'principle',
  domain: 'software-engineering',
  pattern_data: JSON.stringify({
    embedding,
    pattern: { principle: 'fail-fast with clear errors' }
  }),
  confidence: 0.95,
  // ...
});
```

### 다중 도메인 학습

도메인 간에 학습을 전이한다:

```typescript
// Learn from backend optimization
const backendExperience = await rb.retrieveWithReasoning(embedding, {
  domain: 'backend-optimization',
  k: 10,
});

// Apply to frontend optimization
const transferredKnowledge = backendExperience.memories.map(mem => ({
  ...mem,
  domain: 'frontend-optimization',
  adapted: true,
}));
```

---

## CLI 작업

### 데이터베이스 관리

```bash
# Export trajectories and patterns
npx agentdb@latest export ./.agentdb/reasoningbank.db ./backup.json

# Import experiences
npx agentdb@latest import ./experiences.json

# Get statistics
npx agentdb@latest stats ./.agentdb/reasoningbank.db
# Shows: total patterns, domains, confidence distribution
```

### 마이그레이션

```bash
# Migrate from legacy ReasoningBank
npx agentdb@latest migrate --source .swarm/memory.db --target .agentdb/reasoningbank.db

# Validate migration
npx agentdb@latest stats .agentdb/reasoningbank.db
```

---

## 문제 해결

### 문제: 마이그레이션이 실패한다
```bash
# Check source database exists
ls -la .swarm/memory.db

# Run with verbose logging
DEBUG=agentdb:* npx agentdb@latest migrate --source .swarm/memory.db
```

### 문제: 신뢰도 점수가 낮다
```typescript
// Enable context synthesis for better quality
const result = await rb.retrieveWithReasoning(embedding, {
  synthesizeContext: true,
  useMMR: true,
  k: 10,
});
```

### 문제: 메모리가 너무 커진다
```typescript
// Enable automatic optimization
const result = await rb.retrieveWithReasoning(embedding, {
  optimizeMemory: true,  // Consolidates similar patterns
});

// Or manually optimize
await rb.optimize();
```

---

## 더 알아보기

- **AgentDB 연동**: node_modules/agentic-flow/docs/AGENTDB_INTEGRATION.md
- **GitHub**: https://github.com/ruvnet/agentic-flow/tree/main/packages/agentdb
- **MCP 연동**: `npx agentdb@latest mcp`
- **웹사이트**: https://agentdb.ruv.io

---

**분류**: 머신러닝 / 강화학습
**난이도**: 중급
**예상 소요 시간**: 20~30분
