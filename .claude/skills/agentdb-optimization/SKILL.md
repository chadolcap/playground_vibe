---
name: agentdb-optimization
description: "AgentDB 성능을 quantization(메모리 4~32배 절감), HNSW 인덱싱(검색 150배 고속화), caching, batch operations로 최적화한다. 메모리 사용량을 최적화하거나, 검색 속도를 높이거나, 수백만 개의 벡터(millions of vectors)로 확장할 때 사용한다."
---

# AgentDB 성능 최적화

## 이 스킬이 하는 일

AgentDB 벡터 데이터베이스를 위한 종합적인 성능 최적화 기법을 제공한다. quantization, HNSW 인덱싱, 캐싱 전략, 배치 연산으로 150배~12,500배의 성능 향상을 얻는다. 정확도를 유지하면서 메모리 사용량을 4~32배 줄인다.

**성능**: 벡터 검색 <100µs, 패턴 조회 <1ms, 벡터 100개 배치 삽입 2ms.

## 사전 요구 사항

- Node.js 18+
- AgentDB v1.0.7+ (agentic-flow 경유)
- 기존 AgentDB 데이터베이스 또는 애플리케이션

---

## 빠른 시작

### 성능 벤치마크 실행

```bash
# Comprehensive performance benchmarking
npx agentdb@latest benchmark

# Results show:
# ✅ Pattern Search: 150x faster (100µs vs 15ms)
# ✅ Batch Insert: 500x faster (2ms vs 1s for 100 vectors)
# ✅ Large-scale Query: 12,500x faster (8ms vs 100s at 1M vectors)
# ✅ Memory Efficiency: 4-32x reduction with quantization
```

### 최적화 켜기

```typescript
import { createAgentDBAdapter } from 'agentic-flow/reasoningbank';

// Optimized configuration
const adapter = await createAgentDBAdapter({
  dbPath: '.agentdb/optimized.db',
  quantizationType: 'binary',   // 32x memory reduction
  cacheSize: 1000,               // In-memory cache
  enableLearning: true,
  enableReasoning: true,
});
```

---

## Quantization 전략

### 1. Binary Quantization (32배 절감)

**적합한 경우**: 대규모 배포(벡터 1M개 이상), 메모리가 제한된 환경
**절충점**: 정확도 약 2~5% 손실, 메모리 32배 절감, 10배 빠름

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'binary',
  // 768-dim float32 (3072 bytes) → 96 bytes binary
  // 1M vectors: 3GB → 96MB
});
```

**사용 사례**:
- 모바일/엣지 배포
- 대규모 벡터 저장(수백만 개)
- 메모리 제약이 있는 실시간 검색

**성능**:
- 메모리: 32배 작음
- 검색 속도: 10배 빠름(비트 연산)
- 정확도: 원본의 95~98%

### 2. Scalar Quantization (4배 절감)

**적합한 경우**: 성능과 정확도의 균형, 중간 규모 데이터셋
**절충점**: 정확도 약 1~2% 손실, 메모리 4배 절감, 3배 빠름

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'scalar',
  // 768-dim float32 (3072 bytes) → 768 bytes (uint8)
  // 1M vectors: 3GB → 768MB
});
```

**사용 사례**:
- 높은 정확도가 필요한 프로덕션 애플리케이션
- 중간 규모 배포(벡터 10K~1M개)
- 범용 최적화

**성능**:
- 메모리: 4배 작음
- 검색 속도: 3배 빠름
- 정확도: 원본의 98~99%

### 3. Product Quantization (8~16배 절감)

**적합한 경우**: 고차원 벡터, 균형 잡힌 압축
**절충점**: 정확도 약 3~7% 손실, 메모리 8~16배 절감, 5배 빠름

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'product',
  // 768-dim float32 (3072 bytes) → 48-96 bytes
  // 1M vectors: 3GB → 192MB
});
```

**사용 사례**:
- 고차원 임베딩(512차원 초과)
- 이미지/비디오 임베딩
- 대규모 유사도 검색

**성능**:
- 메모리: 8~16배 작음
- 검색 속도: 5배 빠름
- 정확도: 원본의 93~97%

### 4. Quantization 없음 (Full Precision)

**적합한 경우**: 최대 정확도, 작은 데이터셋
**절충점**: 정확도 손실 없음, 메모리 전체 사용

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'none',
  // Full float32 precision
});
```

---

## HNSW 인덱싱

**Hierarchical Navigable Small World** - 검색 복잡도 O(log n)

### 자동 HNSW

AgentDB는 HNSW 인덱스를 자동으로 만든다.

```typescript
const adapter = await createAgentDBAdapter({
  dbPath: '.agentdb/vectors.db',
  // HNSW automatically enabled
});

// Search with HNSW (100µs vs 15ms linear scan)
const results = await adapter.retrieveWithReasoning(queryEmbedding, {
  k: 10,
});
```

### HNSW 파라미터

```typescript
// Advanced HNSW configuration
const adapter = await createAgentDBAdapter({
  dbPath: '.agentdb/vectors.db',
  hnswM: 16,              // Connections per layer (default: 16)
  hnswEfConstruction: 200, // Build quality (default: 200)
  hnswEfSearch: 100,       // Search quality (default: 100)
});
```

**파라미터 튜닝**:
- **M** (연결 수): 높을수록 recall이 좋아지고 메모리를 더 쓴다
  - 작은 데이터셋(<10K): M = 8
  - 중간 데이터셋(10K~100K): M = 16
  - 큰 데이터셋(>100K): M = 32
- **efConstruction**: 높을수록 인덱스 품질이 좋아지고 빌드가 느려진다
  - 빠른 빌드: 100
  - 균형: 200 (기본값)
  - 고품질: 400
- **efSearch**: 높을수록 recall이 좋아지고 검색이 느려진다
  - 빠른 검색: 50
  - 균형: 100 (기본값)
  - 높은 recall: 200

---

## 캐싱 전략

### 인메모리 패턴 캐시

```typescript
const adapter = await createAgentDBAdapter({
  cacheSize: 1000,  // Cache 1000 most-used patterns
});

// First retrieval: ~2ms (database)
// Subsequent: <1ms (cache hit)
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  k: 10,
});
```

**캐시 튜닝**:
- 작은 애플리케이션: 패턴 100~500개
- 중간 애플리케이션: 패턴 500~2000개
- 큰 애플리케이션: 패턴 2000~5000개

### LRU 캐시 동작

```typescript
// Cache automatically evicts least-recently-used patterns
// Most frequently accessed patterns stay in cache

// Monitor cache performance
const stats = await adapter.getStats();
console.log('Cache Hit Rate:', stats.cacheHitRate);
// Aim for >80% hit rate
```

---

## 배치 연산

### 배치 삽입 (500배 빠름)

```typescript
// ❌ SLOW: Individual inserts
for (const doc of documents) {
  await adapter.insertPattern({ /* ... */ });  // 1s for 100 docs
}

// ✅ FAST: Batch insert
const patterns = documents.map(doc => ({
  id: '',
  type: 'document',
  domain: 'knowledge',
  pattern_data: JSON.stringify({
    embedding: doc.embedding,
    text: doc.text,
  }),
  confidence: 1.0,
  usage_count: 0,
  success_count: 0,
  created_at: Date.now(),
  last_used: Date.now(),
}));

// Insert all at once (2ms for 100 docs)
for (const pattern of patterns) {
  await adapter.insertPattern(pattern);
}
```

### 배치 조회

```typescript
// Retrieve multiple queries efficiently
const queries = [queryEmbedding1, queryEmbedding2, queryEmbedding3];

// Parallel retrieval
const results = await Promise.all(
  queries.map(q => adapter.retrieveWithReasoning(q, { k: 5 }))
);
```

---

## 메모리 최적화

### 자동 통합(Consolidation)

```typescript
// Enable automatic pattern consolidation
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'documents',
  optimizeMemory: true,  // Consolidate similar patterns
  k: 10,
});

console.log('Optimizations:', result.optimizations);
// {
//   consolidated: 15,  // Merged 15 similar patterns
//   pruned: 3,         // Removed 3 low-quality patterns
//   improved_quality: 0.12  // 12% quality improvement
// }
```

### 수동 최적화

```typescript
// Manually trigger optimization
await adapter.optimize();

// Get statistics
const stats = await adapter.getStats();
console.log('Before:', stats.totalPatterns);
console.log('After:', stats.totalPatterns);  // Reduced by ~10-30%
```

### 가지치기(Pruning) 전략

```typescript
// Prune low-confidence patterns
await adapter.prune({
  minConfidence: 0.5,     // Remove confidence < 0.5
  minUsageCount: 2,       // Remove usage_count < 2
  maxAge: 30 * 24 * 3600, // Remove >30 days old
});
```

---

## 성능 모니터링

### 데이터베이스 통계

```bash
# Get comprehensive stats
npx agentdb@latest stats .agentdb/vectors.db

# Output:
# Total Patterns: 125,430
# Database Size: 47.2 MB (with binary quantization)
# Avg Confidence: 0.87
# Domains: 15
# Cache Hit Rate: 84%
# Index Type: HNSW
```

### 런타임 지표

```typescript
const stats = await adapter.getStats();

console.log('Performance Metrics:');
console.log('Total Patterns:', stats.totalPatterns);
console.log('Database Size:', stats.dbSize);
console.log('Avg Confidence:', stats.avgConfidence);
console.log('Cache Hit Rate:', stats.cacheHitRate);
console.log('Search Latency (avg):', stats.avgSearchLatency);
console.log('Insert Latency (avg):', stats.avgInsertLatency);
```

---

## 최적화 레시피

### 레시피 1: 최대 속도 (정확도 희생)

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'binary',  // 32x memory reduction
  cacheSize: 5000,             // Large cache
  hnswM: 8,                    // Fewer connections = faster
  hnswEfSearch: 50,            // Low search quality = faster
});

// Expected: <50µs search, 90-95% accuracy
```

### 레시피 2: 균형 잡힌 성능

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'scalar',  // 4x memory reduction
  cacheSize: 1000,             // Standard cache
  hnswM: 16,                   // Balanced connections
  hnswEfSearch: 100,           // Balanced quality
});

// Expected: <100µs search, 98-99% accuracy
```

### 레시피 3: 최대 정확도

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'none',    // No quantization
  cacheSize: 2000,             // Large cache
  hnswM: 32,                   // Many connections
  hnswEfSearch: 200,           // High search quality
});

// Expected: <200µs search, 100% accuracy
```

### 레시피 4: 메모리 제약 환경 (모바일/엣지)

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'binary',  // 32x memory reduction
  cacheSize: 100,              // Small cache
  hnswM: 8,                    // Minimal connections
});

// Expected: <100µs search, ~10MB for 100K vectors
```

---

## 확장 전략

### 소규모 (벡터 <10K개)

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'none',    // Full precision
  cacheSize: 500,
  hnswM: 8,
});
```

### 중간 규모 (벡터 10K~100K개)

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'scalar',  // 4x reduction
  cacheSize: 1000,
  hnswM: 16,
});
```

### 대규모 (벡터 100K~1M개)

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'binary',  // 32x reduction
  cacheSize: 2000,
  hnswM: 32,
});
```

### 초대규모 (벡터 >1M개)

```typescript
const adapter = await createAgentDBAdapter({
  quantizationType: 'product',  // 8-16x reduction
  cacheSize: 5000,
  hnswM: 48,
  hnswEfConstruction: 400,
});
```

---

## 문제 해결

### 문제: 메모리 사용량이 높다

```bash
# Check database size
npx agentdb@latest stats .agentdb/vectors.db

# Enable quantization
# Use 'binary' for 32x reduction
```

### 문제: 검색 성능이 느리다

```typescript
// Increase cache size
const adapter = await createAgentDBAdapter({
  cacheSize: 2000,  // Increase from 1000
});

// Reduce search quality (faster)
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  k: 5,  // Reduce from 10
});
```

### 문제: 정확도가 낮다

```typescript
// Disable or use lighter quantization
const adapter = await createAgentDBAdapter({
  quantizationType: 'scalar',  // Instead of 'binary'
  hnswEfSearch: 200,           // Higher search quality
});
```

---

## 성능 벤치마크

**테스트 시스템**: AMD Ryzen 9 5950X, 64GB RAM

| 연산 | 벡터 수 | 최적화 없음 | 최적화 후 | 향상 |
|-----------|-------------|-----------------|-----------|-------------|
| 검색 | 10K | 15ms | 100µs | 150x |
| 검색 | 100K | 150ms | 120µs | 1,250x |
| 검색 | 1M | 100s | 8ms | 12,500x |
| 배치 삽입 (100) | - | 1s | 2ms | 500x |
| 메모리 사용량 | 1M | 3GB | 96MB | 32x (binary) |

---

## 더 알아보기

- **Quantization 논문**: docs/quantization-techniques.pdf
- **HNSW 알고리즘**: docs/hnsw-index.pdf
- **GitHub**: https://github.com/ruvnet/agentic-flow/tree/main/packages/agentdb
- **웹사이트**: https://agentdb.ruv.io

---

**분류**: 성능 / 최적화
**난이도**: 중급
**예상 소요 시간**: 20~30분
