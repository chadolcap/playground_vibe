---
name: agentdb-vector-search
description: "AgentDB로 semantic vector search(의미 기반 벡터 검색)를 구현해 지능형 document retrieval(문서 검색), similarity matching(유사도 매칭), context-aware querying(맥락 인식 질의)을 수행한다. RAG 시스템, semantic search engine, intelligent knowledge base를 만들 때 사용한다."
---

# AgentDB 벡터 검색

## 이 스킬이 하는 일

기존 방식보다 **150배~12,500배 빠른** AgentDB의 고성능 벡터 데이터베이스로 벡터 기반 의미 검색을 구현한다. HNSW 인덱싱, 양자화, 1ms 미만 검색(<100µs)을 제공한다.

## 사전 요구 사항

- Node.js 18+
- AgentDB v1.0.7+ (agentic-flow 경유 또는 단독 설치)
- OpenAI API 키(임베딩용) 또는 사용자 정의 임베딩 모델

## CLI로 빠르게 시작하기

### 벡터 데이터베이스 초기화

```bash
# Initialize with default dimensions (1536 for OpenAI ada-002)
npx agentdb@latest init ./vectors.db

# Custom dimensions for different embedding models
npx agentdb@latest init ./vectors.db --dimension 768  # sentence-transformers
npx agentdb@latest init ./vectors.db --dimension 384  # all-MiniLM-L6-v2

# Use preset configurations
npx agentdb@latest init ./vectors.db --preset small   # <10K vectors
npx agentdb@latest init ./vectors.db --preset medium  # 10K-100K vectors
npx agentdb@latest init ./vectors.db --preset large   # >100K vectors

# In-memory database for testing
npx agentdb@latest init ./vectors.db --in-memory
```

### 벡터 데이터베이스 조회

```bash
# Basic similarity search
npx agentdb@latest query ./vectors.db "[0.1,0.2,0.3,...]"

# Top-k results
npx agentdb@latest query ./vectors.db "[0.1,0.2,0.3]" -k 10

# With similarity threshold (cosine similarity)
npx agentdb@latest query ./vectors.db "0.1 0.2 0.3" -t 0.75 -m cosine

# Different distance metrics
npx agentdb@latest query ./vectors.db "[...]" -m euclidean  # L2 distance
npx agentdb@latest query ./vectors.db "[...]" -m dot        # Dot product

# JSON output for automation
npx agentdb@latest query ./vectors.db "[...]" -f json -k 5

# Verbose output with distances
npx agentdb@latest query ./vectors.db "[...]" -v
```

### 벡터 가져오기/내보내기

```bash
# Export vectors to JSON
npx agentdb@latest export ./vectors.db ./backup.json

# Import vectors from JSON
npx agentdb@latest import ./backup.json

# Get database statistics
npx agentdb@latest stats ./vectors.db
```

## API로 빠르게 시작하기

```typescript
import { createAgentDBAdapter, computeEmbedding } from 'agentic-flow/reasoningbank';

// Initialize with vector search optimizations
const adapter = await createAgentDBAdapter({
  dbPath: '.agentdb/vectors.db',
  enableLearning: false,       // Vector search only
  enableReasoning: true,       // Enable semantic matching
  quantizationType: 'binary',  // 32x memory reduction
  cacheSize: 1000,             // Fast retrieval
});

// Store document with embedding
const text = "The quantum computer achieved 100 qubits";
const embedding = await computeEmbedding(text);

await adapter.insertPattern({
  id: '',
  type: 'document',
  domain: 'technology',
  pattern_data: JSON.stringify({
    embedding,
    text,
    metadata: { category: "quantum", date: "2025-01-15" }
  }),
  confidence: 1.0,
  usage_count: 0,
  success_count: 0,
  created_at: Date.now(),
  last_used: Date.now(),
});

// Semantic search with MMR (Maximal Marginal Relevance)
const queryEmbedding = await computeEmbedding("quantum computing advances");
const results = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'technology',
  k: 10,
  useMMR: true,              // Diverse results
  synthesizeContext: true,    // Rich context
});
```

## 핵심 기능

### 1. 벡터 저장
```typescript
// Store with automatic embedding
await db.storeWithEmbedding({
  content: "Your document text",
  metadata: { source: "docs", page: 42 }
});
```

### 2. 유사도 검색
```typescript
// Find similar documents
const similar = await db.findSimilar("quantum computing", {
  limit: 5,
  minScore: 0.75
});
```

### 3. 하이브리드 검색 (벡터 + 메타데이터)
```typescript
// Combine vector similarity with metadata filtering
const results = await db.hybridSearch({
  query: "machine learning models",
  filters: {
    category: "research",
    date: { $gte: "2024-01-01" }
  },
  limit: 20
});
```

## 고급 사용법

### RAG (검색 증강 생성)
```typescript
// Build RAG pipeline
async function ragQuery(question: string) {
  // 1. Get relevant context
  const context = await db.searchSimilar(
    await embed(question),
    { limit: 5, threshold: 0.7 }
  );

  // 2. Generate answer with context
  const prompt = `Context: ${context.map(c => c.text).join('\n')}
Question: ${question}`;

  return await llm.generate(prompt);
}
```

### 배치 작업
```typescript
// Efficient batch storage
await db.batchStore(documents.map(doc => ({
  text: doc.content,
  embedding: doc.vector,
  metadata: doc.meta
})));
```

## MCP 서버 연동

```bash
# Start AgentDB MCP server for Claude Code
npx agentdb@latest mcp

# Add to Claude Code (one-time setup)
claude mcp add agentdb npx agentdb@latest mcp

# Now use MCP tools in Claude Code:
# - agentdb_query: Semantic vector search
# - agentdb_store: Store documents with embeddings
# - agentdb_stats: Database statistics
```

## 성능 벤치마크

```bash
# Run comprehensive benchmarks
npx agentdb@latest benchmark

# Results:
# ✅ Pattern Search: 150x faster (100µs vs 15ms)
# ✅ Batch Insert: 500x faster (2ms vs 1s for 100 vectors)
# ✅ Large-scale Query: 12,500x faster (8ms vs 100s at 1M vectors)
# ✅ Memory Efficiency: 4-32x reduction with quantization
```

## 양자화 옵션

AgentDB는 메모리 효율을 위해 여러 양자화 전략을 제공한다:

### 이진 양자화 (32배 감소)
```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'binary',  // 768-dim → 96 bytes
});
```

### 스칼라 양자화 (4배 감소)
```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'scalar',  // 768-dim → 768 bytes
});
```

### 곱 양자화 (8~16배 감소)
```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'product',  // 768-dim → 48-96 bytes
});
```

## 거리 척도

```bash
# Cosine similarity (default, best for most use cases)
npx agentdb@latest query ./db.sqlite "[...]" -m cosine

# Euclidean distance (L2 norm)
npx agentdb@latest query ./db.sqlite "[...]" -m euclidean

# Dot product (for normalized vectors)
npx agentdb@latest query ./db.sqlite "[...]" -m dot
```

## 고급 기능

### HNSW 인덱싱
- **O(log n) 검색 복잡도**
- **1ms 미만 조회** (<100µs)
- **인덱스 자동 생성**

### 캐시
- **패턴 1000개 인메모리 캐시**
- **1ms 미만 패턴 조회**
- **캐시 자동 무효화**

### MMR (최대 한계 관련성)
- **다양한 결과 집합**
- **중복 회피**
- **관련성과 다양성의 균형**

## 성능 팁

1. **HNSW 인덱싱을 켠다**: AgentDB에서는 자동이며 10~100배 빠르다
2. **양자화를 쓴다**: Binary(32배), Scalar(4배), Product(8~16배)만큼 메모리가 줄어든다
3. **배치 작업을 쓴다**: 대량 삽입이 500배 빠르다
4. **차원을 맞춘다**: 1536 (OpenAI), 768 (sentence-transformers), 384 (MiniLM)
5. **유사도 임계값**: 품질을 위해 0.7에서 시작하고 용도에 맞게 조정한다
6. **캐시를 켠다**: 자주 쓰는 질의에 패턴 1000개 캐시를 쓴다

## 문제 해결

### 문제: 검색 성능이 느리다
```bash
# Check if HNSW indexing is enabled (automatic)
npx agentdb@latest stats ./vectors.db

# Expected: <100µs search time
```

### 문제: 메모리 사용량이 높다
```bash
# Enable binary quantization (32x reduction)
# Use in adapter: quantizationType: 'binary'
```

### 문제: 관련성이 낮다
```bash
# Adjust similarity threshold
npx agentdb@latest query ./db.sqlite "[...]" -t 0.8  # Higher threshold

# Or use MMR for diverse results
# Use in adapter: useMMR: true
```

### 문제: 차원이 맞지 않는다
```bash
# Check embedding model dimensions:
# - OpenAI ada-002: 1536
# - sentence-transformers: 768
# - all-MiniLM-L6-v2: 384

npx agentdb@latest init ./db.sqlite --dimension 768
```

## 데이터베이스 통계

```bash
# Get comprehensive stats
npx agentdb@latest stats ./vectors.db

# Shows:
# - Total patterns/vectors
# - Database size
# - Average confidence
# - Domains distribution
# - Index status
```

## 성능 특성

- **벡터 검색**: <100µs (HNSW 인덱싱)
- **패턴 조회**: <1ms (캐시 사용 시)
- **배치 삽입**: 벡터 100개에 2ms
- **메모리 효율**: 양자화로 4~32배 감소
- **확장성**: 100만 개 이상의 벡터를 효율적으로 처리한다
- **지연 시간**: 대부분의 작업이 1ms 미만이다

## 더 알아보기

- GitHub: https://github.com/ruvnet/agentic-flow/tree/main/packages/agentdb
- 문서: node_modules/agentic-flow/docs/AGENTDB_INTEGRATION.md
- MCP 연동: Claude Code용 `npx agentdb@latest mcp`
- 웹사이트: https://agentdb.ruv.io
- CLI 도움말: `npx agentdb@latest --help`
- 명령 도움말: `npx agentdb@latest help <command>`
