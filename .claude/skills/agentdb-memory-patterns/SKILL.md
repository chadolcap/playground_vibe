---
name: agentdb-memory-patterns
description: "AgentDB로 AI 에이전트의 persistent memory(영속 메모리) 패턴을 구현한다. session memory(세션 메모리), long-term storage(장기 저장), pattern learning(패턴 학습), context management(맥락 관리)를 포함한다. stateful agent, chat system, intelligent assistant를 만들 때 사용한다."
---

# AgentDB 메모리 패턴

## 이 스킬이 하는 일

AgentDB의 영속 저장소와 ReasoningBank 연동을 이용해 AI 에이전트용 메모리 관리 패턴을 제공한다. 에이전트가 대화를 기억하고, 상호작용에서 배우고, 세션이 바뀌어도 맥락을 유지하게 한다.

**성능**: 기존 방식보다 150배~12,500배 빠르며 하위 호환성은 100%다.

## 사전 요구 사항

- Node.js 18+
- AgentDB v1.0.7+ (agentic-flow 경유 또는 단독 설치)
- 에이전트 아키텍처에 대한 이해

## CLI로 빠르게 시작하기

### AgentDB 초기화

```bash
# Initialize vector database
npx agentdb@latest init ./agents.db

# Or with custom dimensions
npx agentdb@latest init ./agents.db --dimension 768

# Use preset configurations
npx agentdb@latest init ./agents.db --preset large

# In-memory database for testing
npx agentdb@latest init ./memory.db --in-memory
```

### Claude Code용 MCP 서버 시작

```bash
# Start MCP server (integrates with Claude Code)
npx agentdb@latest mcp

# Add to Claude Code (one-time setup)
claude mcp add agentdb npx agentdb@latest mcp
```

### 학습 플러그인 만들기

```bash
# Interactive plugin wizard
npx agentdb@latest create-plugin

# Use template directly
npx agentdb@latest create-plugin -t decision-transformer -n my-agent

# Available templates:
# - decision-transformer (sequence modeling RL)
# - q-learning (value-based learning)
# - sarsa (on-policy TD learning)
# - actor-critic (policy gradient)
# - curiosity-driven (exploration-based)
```

## API로 빠르게 시작하기

```typescript
import { createAgentDBAdapter } from 'agentic-flow/reasoningbank';

// Initialize with default configuration
const adapter = await createAgentDBAdapter({
  dbPath: '.agentdb/reasoningbank.db',
  enableLearning: true,      // Enable learning plugins
  enableReasoning: true,      // Enable reasoning agents
  quantizationType: 'scalar', // binary | scalar | product | none
  cacheSize: 1000,            // In-memory cache
});

// Store interaction memory
const patternId = await adapter.insertPattern({
  id: '',
  type: 'pattern',
  domain: 'conversation',
  pattern_data: JSON.stringify({
    embedding: await computeEmbedding('What is the capital of France?'),
    pattern: {
      user: 'What is the capital of France?',
      assistant: 'The capital of France is Paris.',
      timestamp: Date.now()
    }
  }),
  confidence: 0.95,
  usage_count: 1,
  success_count: 1,
  created_at: Date.now(),
  last_used: Date.now(),
});

// Retrieve context with reasoning
const context = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'conversation',
  k: 10,
  useMMR: true,              // Maximal Marginal Relevance
  synthesizeContext: true,    // Generate rich context
});
```

## 메모리 패턴

### 1. 세션 메모리
```typescript
class SessionMemory {
  async storeMessage(role: string, content: string) {
    return await db.storeMemory({
      sessionId: this.sessionId,
      role,
      content,
      timestamp: Date.now()
    });
  }

  async getSessionHistory(limit = 20) {
    return await db.query({
      filters: { sessionId: this.sessionId },
      orderBy: 'timestamp',
      limit
    });
  }
}
```

### 2. 장기 메모리
```typescript
// Store important facts
await db.storeFact({
  category: 'user_preference',
  key: 'language',
  value: 'English',
  confidence: 1.0,
  source: 'explicit'
});

// Retrieve facts
const prefs = await db.getFacts({
  category: 'user_preference'
});
```

### 3. 패턴 학습
```typescript
// Learn from successful interactions
await db.storePattern({
  trigger: 'user_asks_time',
  response: 'provide_formatted_time',
  success: true,
  context: { timezone: 'UTC' }
});

// Apply learned patterns
const pattern = await db.matchPattern(currentContext);
```

## 고급 패턴

### 계층형 메모리
```typescript
// Organize memory in hierarchy
await memory.organize({
  immediate: recentMessages,    // Last 10 messages
  shortTerm: sessionContext,    // Current session
  longTerm: importantFacts,     // Persistent facts
  semantic: embeddedKnowledge   // Vector search
});
```

### 메모리 통합
```typescript
// Periodically consolidate memories
await memory.consolidate({
  strategy: 'importance',       // Keep important memories
  maxSize: 10000,              // Size limit
  minScore: 0.5                // Relevance threshold
});
```

## CLI 작업

### 데이터베이스 조회

```bash
# Query with vector embedding
npx agentdb@latest query ./agents.db "[0.1,0.2,0.3,...]"

# Top-k results
npx agentdb@latest query ./agents.db "[0.1,0.2,0.3]" -k 10

# With similarity threshold
npx agentdb@latest query ./agents.db "0.1 0.2 0.3" -t 0.75

# JSON output
npx agentdb@latest query ./agents.db "[...]" -f json
```

### 데이터 가져오기/내보내기

```bash
# Export vectors to file
npx agentdb@latest export ./agents.db ./backup.json

# Import vectors from file
npx agentdb@latest import ./backup.json

# Get database statistics
npx agentdb@latest stats ./agents.db
```

### 성능 벤치마크

```bash
# Run performance benchmarks
npx agentdb@latest benchmark

# Results show:
# - Pattern Search: 150x faster (100µs vs 15ms)
# - Batch Insert: 500x faster (2ms vs 1s)
# - Large-scale Query: 12,500x faster (8ms vs 100s)
```

## ReasoningBank 연동

```typescript
import { createAgentDBAdapter, migrateToAgentDB } from 'agentic-flow/reasoningbank';

// Migrate from legacy ReasoningBank
const result = await migrateToAgentDB(
  '.swarm/memory.db',           // Source (legacy)
  '.agentdb/reasoningbank.db'   // Destination (AgentDB)
);

console.log(`✅ Migrated ${result.patternsMigrated} patterns`);

// Train learning model
const adapter = await createAgentDBAdapter({
  enableLearning: true,
});

await adapter.train({
  epochs: 50,
  batchSize: 32,
});

// Get optimal strategy with reasoning
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'task-planning',
  synthesizeContext: true,
  optimizeMemory: true,
});
```

## 학습 플러그인

### 사용 가능한 알고리즘 (총 9개)

1. **Decision Transformer** - 시퀀스 모델링 강화학습 (권장)
2. **Q-Learning** - 가치 기반 학습
3. **SARSA** - On-policy TD 학습
4. **Actor-Critic** - 베이스라인을 쓰는 정책 경사
5. **Active Learning** - 질의 선택
6. **Adversarial Training** - 견고성
7. **Curriculum Learning** - 점진적 난이도
8. **Federated Learning** - 분산 학습
9. **Multi-task Learning** - 전이 학습

### 플러그인 목록 보기와 관리

```bash
# List available plugins
npx agentdb@latest list-plugins

# List plugin templates
npx agentdb@latest list-templates

# Get plugin info
npx agentdb@latest plugin-info <name>
```

## 추론 에이전트 (모듈 4개)

1. **PatternMatcher** - HNSW 인덱싱으로 비슷한 패턴을 찾는다
2. **ContextSynthesizer** - 여러 출처에서 풍부한 맥락을 만든다
3. **MemoryOptimizer** - 비슷한 패턴을 통합하고 품질이 낮은 것을 가지치기한다
4. **ExperienceCurator** - 품질 기준으로 경험을 걸러 낸다

## 모범 사례

1. **양자화를 켠다**: scalar/binary를 쓰면 메모리가 4~32배 줄어든다
2. **캐시를 쓴다**: 패턴 1000개 캐시로 1ms 미만에 조회한다
3. **배치 작업을 쓴다**: 개별 삽입보다 500배 빠르다
4. **정기적으로 학습시킨다**: 새 경험으로 학습 모델을 갱신한다
5. **추론을 켠다**: 맥락 합성과 최적화가 자동으로 이루어진다
6. **지표를 모니터링한다**: `stats` 명령으로 성능을 추적한다

## 문제 해결

### 문제: 메모리가 너무 커진다
```bash
# Check database size
npx agentdb@latest stats ./agents.db

# Enable quantization
# Use 'binary' (32x smaller) or 'scalar' (4x smaller)
```

### 문제: 검색 성능이 느리다
```bash
# Enable HNSW indexing and caching
# Results: <100µs search time
```

### 문제: 기존 ReasoningBank에서 마이그레이션해야 한다
```bash
# Automatic migration with validation
npx agentdb@latest migrate --source .swarm/memory.db
```

## 성능 특성

- **벡터 검색**: <100µs (HNSW 인덱싱)
- **패턴 조회**: <1ms (캐시 사용 시)
- **배치 삽입**: 패턴 100개에 2ms
- **메모리 효율**: 양자화로 4~32배 감소
- **하위 호환성**: ReasoningBank API와 100% 호환

## 더 알아보기

- GitHub: https://github.com/ruvnet/agentic-flow/tree/main/packages/agentdb
- 문서: node_modules/agentic-flow/docs/AGENTDB_INTEGRATION.md
- MCP 연동: Claude Code용 `npx agentdb@latest mcp`
- 웹사이트: https://agentdb.ruv.io
