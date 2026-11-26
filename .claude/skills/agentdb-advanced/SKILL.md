---
name: agentdb-advanced
description: "QUIC synchronization, multi-database 관리, custom distance metrics, hybrid search, 분산 시스템(distributed systems) 연동을 포함한 AgentDB 고급 기능을 익힌다. 분산 AI 시스템, multi-agent coordination, 고급 vector search 애플리케이션을 만들 때 사용한다."
---

# AgentDB 고급 기능

## 이 스킬이 하는 일

분산 시스템, 다중 데이터베이스 조정, 사용자 정의 거리 척도, 하이브리드 검색(벡터 + 메타데이터), QUIC 동기화, 프로덕션 배포 패턴 같은 AgentDB의 고급 기능을 다룬다. 노드 간 1ms 미만 통신과 고급 검색 기능을 갖춘 정교한 AI 시스템을 만들 수 있게 한다.

**성능**: QUIC 동기화 <1ms, 필터를 쓰는 하이브리드 검색, 사용자 정의 거리 척도.

## 사전 요구 사항

- Node.js 18+
- AgentDB v1.0.7+ (agentic-flow 경유)
- 분산 시스템에 대한 이해 (QUIC 동기화용)
- 벡터 검색 기초

---

## QUIC 동기화

### QUIC Sync란?

QUIC(Quick UDP Internet Connections)는 네트워크 경계를 넘어 AgentDB 인스턴스 사이를 1ms 미만의 지연으로 동기화하며, 자동 재시도·멀티플렉싱·암호화를 제공한다.

**장점**:
- 노드 간 지연 <1ms
- 멀티플렉싱 스트림 (여러 연산을 동시에 처리)
- 내장 암호화 (TLS 1.3)
- 자동 재시도와 복구
- 이벤트 기반 브로드캐스트

### QUIC Sync 켜기

```typescript
import { createAgentDBAdapter } from 'agentic-flow/reasoningbank';

// Initialize with QUIC synchronization
const adapter = await createAgentDBAdapter({
  dbPath: '.agentdb/distributed.db',
  enableQUICSync: true,
  syncPort: 4433,
  syncPeers: [
    '192.168.1.10:4433',
    '192.168.1.11:4433',
    '192.168.1.12:4433',
  ],
});

// Patterns automatically sync across all peers
await adapter.insertPattern({
  // ... pattern data
});

// Available on all peers within ~1ms
```

### QUIC 설정

```typescript
const adapter = await createAgentDBAdapter({
  enableQUICSync: true,
  syncPort: 4433,              // QUIC server port
  syncPeers: ['host1:4433'],   // Peer addresses
  syncInterval: 1000,          // Sync interval (ms)
  syncBatchSize: 100,          // Patterns per batch
  maxRetries: 3,               // Retry failed syncs
  compression: true,           // Enable compression
});
```

### 다중 노드 배포

```bash
# Node 1 (192.168.1.10)
AGENTDB_QUIC_SYNC=true \
AGENTDB_QUIC_PORT=4433 \
AGENTDB_QUIC_PEERS=192.168.1.11:4433,192.168.1.12:4433 \
node server.js

# Node 2 (192.168.1.11)
AGENTDB_QUIC_SYNC=true \
AGENTDB_QUIC_PORT=4433 \
AGENTDB_QUIC_PEERS=192.168.1.10:4433,192.168.1.12:4433 \
node server.js

# Node 3 (192.168.1.12)
AGENTDB_QUIC_SYNC=true \
AGENTDB_QUIC_PORT=4433 \
AGENTDB_QUIC_PEERS=192.168.1.10:4433,192.168.1.11:4433 \
node server.js
```

---

## 거리 척도

### 코사인 유사도 (기본값)

정규화된 벡터, 의미 유사도에 가장 적합하다.

```bash
# CLI
npx agentdb@latest query ./vectors.db "[0.1,0.2,...]" -m cosine

# API
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  metric: 'cosine',
  k: 10,
});
```

**사용 사례**:
- 텍스트 임베딩 (BERT, GPT 등)
- 의미 기반 검색
- 문서 유사도
- 대부분의 범용 애플리케이션

**공식**: `cos(θ) = (A · B) / (||A|| × ||B||)`
**범위**: [-1, 1] (1 = 동일, -1 = 정반대)

### 유클리드 거리 (L2)

공간 데이터, 기하학적 유사도에 가장 적합하다.

```bash
# CLI
npx agentdb@latest query ./vectors.db "[0.1,0.2,...]" -m euclidean

# API
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  metric: 'euclidean',
  k: 10,
});
```

**사용 사례**:
- 이미지 임베딩
- 공간 데이터
- 컴퓨터 비전
- 벡터 크기가 의미를 가질 때

**공식**: `d = √(Σ(ai - bi)²)`
**범위**: [0, ∞] (0 = 동일, ∞ = 매우 다름)

### 내적 (Dot Product)

미리 정규화된 벡터, 빠른 계산에 가장 적합하다.

```bash
# CLI
npx agentdb@latest query ./vectors.db "[0.1,0.2,...]" -m dot

# API
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  metric: 'dot',
  k: 10,
});
```

**사용 사례**:
- 미리 정규화된 임베딩
- 빠른 유사도 계산
- 벡터가 이미 단위 길이일 때

**공식**: `dot = Σ(ai × bi)`
**범위**: [-∞, ∞] (높을수록 더 유사)

### 사용자 정의 거리 척도

```typescript
// Implement custom distance function
function customDistance(vec1: number[], vec2: number[]): number {
  // Weighted Euclidean distance
  const weights = [1.0, 2.0, 1.5, ...];
  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    sum += weights[i] * Math.pow(vec1[i] - vec2[i], 2);
  }
  return Math.sqrt(sum);
}

// Use in search (requires custom implementation)
```

---

## 하이브리드 검색 (벡터 + 메타데이터)

### 기본 하이브리드 검색

벡터 유사도와 메타데이터 필터링을 결합한다.

```typescript
// Store documents with metadata
await adapter.insertPattern({
  id: '',
  type: 'document',
  domain: 'research-papers',
  pattern_data: JSON.stringify({
    embedding: documentEmbedding,
    text: documentText,
    metadata: {
      author: 'Jane Smith',
      year: 2025,
      category: 'machine-learning',
      citations: 150,
    }
  }),
  confidence: 1.0,
  usage_count: 0,
  success_count: 0,
  created_at: Date.now(),
  last_used: Date.now(),
});

// Hybrid search: vector similarity + metadata filters
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'research-papers',
  k: 20,
  filters: {
    year: { $gte: 2023 },          // Published 2023 or later
    category: 'machine-learning',   // ML papers only
    citations: { $gte: 50 },       // Highly cited
  },
});
```

### 고급 필터링

```typescript
// Complex metadata queries
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'products',
  k: 50,
  filters: {
    price: { $gte: 10, $lte: 100 },      // Price range
    category: { $in: ['electronics', 'gadgets'] },  // Multiple categories
    rating: { $gte: 4.0 },                // High rated
    inStock: true,                        // Available
    tags: { $contains: 'wireless' },      // Has tag
  },
});
```

### 가중 하이브리드 검색

벡터 점수와 메타데이터 점수를 결합한다.

```typescript
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'content',
  k: 20,
  hybridWeights: {
    vectorSimilarity: 0.7,  // 70% weight on semantic similarity
    metadataScore: 0.3,     // 30% weight on metadata match
  },
  filters: {
    category: 'technology',
    recency: { $gte: Date.now() - 30 * 24 * 3600000 },  // Last 30 days
  },
});
```

---

## 다중 데이터베이스 관리

### 여러 데이터베이스

```typescript
// Separate databases for different domains
const knowledgeDB = await createAgentDBAdapter({
  dbPath: '.agentdb/knowledge.db',
});

const conversationDB = await createAgentDBAdapter({
  dbPath: '.agentdb/conversations.db',
});

const codeDB = await createAgentDBAdapter({
  dbPath: '.agentdb/code.db',
});

// Use appropriate database for each task
await knowledgeDB.insertPattern({ /* knowledge */ });
await conversationDB.insertPattern({ /* conversation */ });
await codeDB.insertPattern({ /* code */ });
```

### 데이터베이스 샤딩

```typescript
// Shard by domain for horizontal scaling
const shards = {
  'domain-a': await createAgentDBAdapter({ dbPath: '.agentdb/shard-a.db' }),
  'domain-b': await createAgentDBAdapter({ dbPath: '.agentdb/shard-b.db' }),
  'domain-c': await createAgentDBAdapter({ dbPath: '.agentdb/shard-c.db' }),
};

// Route queries to appropriate shard
function getDBForDomain(domain: string) {
  const shardKey = domain.split('-')[0];  // Extract shard key
  return shards[shardKey] || shards['domain-a'];
}

// Insert to correct shard
const db = getDBForDomain('domain-a-task');
await db.insertPattern({ /* ... */ });
```

---

## MMR (Maximal Marginal Relevance)

중복을 피하도록 다양한 결과를 가져온다.

```typescript
// Without MMR: Similar results may be redundant
const standardResults = await adapter.retrieveWithReasoning(queryEmbedding, {
  k: 10,
  useMMR: false,
});

// With MMR: Diverse, non-redundant results
const diverseResults = await adapter.retrieveWithReasoning(queryEmbedding, {
  k: 10,
  useMMR: true,
  mmrLambda: 0.5,  // Balance relevance (0) vs diversity (1)
});
```

**MMR 파라미터**:
- `mmrLambda = 0`: 최대 관련성 (중복될 수 있음)
- `mmrLambda = 0.5`: 균형 (기본값)
- `mmrLambda = 1`: 최대 다양성 (관련성이 낮아질 수 있음)

**사용 사례**:
- 검색 결과 다양화
- 추천 시스템
- 에코 체임버 회피
- 탐색형 검색

---

## 컨텍스트 합성

여러 메모리에서 풍부한 컨텍스트를 생성한다.

```typescript
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'problem-solving',
  k: 10,
  synthesizeContext: true,  // Enable context synthesis
});

// ContextSynthesizer creates coherent narrative
console.log('Synthesized Context:', result.context);
// "Based on 10 similar problem-solving attempts, the most effective
//  approach involves: 1) analyzing root cause, 2) brainstorming solutions,
//  3) evaluating trade-offs, 4) implementing incrementally. Success rate: 85%"

console.log('Patterns:', result.patterns);
// Extracted common patterns across memories
```

---

## 프로덕션 패턴

### 커넥션 풀링

```typescript
// Singleton pattern for shared adapter
class AgentDBPool {
  private static instance: AgentDBAdapter;

  static async getInstance() {
    if (!this.instance) {
      this.instance = await createAgentDBAdapter({
        dbPath: '.agentdb/production.db',
        quantizationType: 'scalar',
        cacheSize: 2000,
      });
    }
    return this.instance;
  }
}

// Use in application
const db = await AgentDBPool.getInstance();
const results = await db.retrieveWithReasoning(queryEmbedding, { k: 10 });
```

### 오류 처리

```typescript
async function safeRetrieve(queryEmbedding: number[], options: any) {
  try {
    const result = await adapter.retrieveWithReasoning(queryEmbedding, options);
    return result;
  } catch (error) {
    if (error.code === 'DIMENSION_MISMATCH') {
      console.error('Query embedding dimension mismatch');
      // Handle dimension error
    } else if (error.code === 'DATABASE_LOCKED') {
      // Retry with exponential backoff
      await new Promise(resolve => setTimeout(resolve, 100));
      return safeRetrieve(queryEmbedding, options);
    }
    throw error;
  }
}
```

### 모니터링과 로깅

```typescript
// Performance monitoring
const startTime = Date.now();
const result = await adapter.retrieveWithReasoning(queryEmbedding, { k: 10 });
const latency = Date.now() - startTime;

if (latency > 100) {
  console.warn('Slow query detected:', latency, 'ms');
}

// Log statistics
const stats = await adapter.getStats();
console.log('Database Stats:', {
  totalPatterns: stats.totalPatterns,
  dbSize: stats.dbSize,
  cacheHitRate: stats.cacheHitRate,
  avgSearchLatency: stats.avgSearchLatency,
});
```

---

## CLI 고급 작업

### 데이터베이스 가져오기/내보내기

```bash
# Export with compression
npx agentdb@latest export ./vectors.db ./backup.json.gz --compress

# Import from backup
npx agentdb@latest import ./backup.json.gz --decompress

# Merge databases
npx agentdb@latest merge ./db1.sqlite ./db2.sqlite ./merged.sqlite
```

### 데이터베이스 최적화

```bash
# Vacuum database (reclaim space)
sqlite3 .agentdb/vectors.db "VACUUM;"

# Analyze for query optimization
sqlite3 .agentdb/vectors.db "ANALYZE;"

# Rebuild indices
npx agentdb@latest reindex ./vectors.db
```

---

## 환경 변수

```bash
# AgentDB configuration
AGENTDB_PATH=.agentdb/reasoningbank.db
AGENTDB_ENABLED=true

# Performance tuning
AGENTDB_QUANTIZATION=binary     # binary|scalar|product|none
AGENTDB_CACHE_SIZE=2000
AGENTDB_HNSW_M=16
AGENTDB_HNSW_EF=100

# Learning plugins
AGENTDB_LEARNING=true

# Reasoning agents
AGENTDB_REASONING=true

# QUIC synchronization
AGENTDB_QUIC_SYNC=true
AGENTDB_QUIC_PORT=4433
AGENTDB_QUIC_PEERS=host1:4433,host2:4433
```

---

## 문제 해결

### 문제: QUIC 동기화가 동작하지 않는다

```bash
# Check firewall allows UDP port 4433
sudo ufw allow 4433/udp

# Verify peers are reachable
ping host1

# Check QUIC logs
DEBUG=agentdb:quic node server.js
```

### 문제: 하이브리드 검색 결과가 없다

```typescript
// Relax filters
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  k: 100,  // Increase k
  filters: {
    // Remove or relax filters
  },
});
```

### 문제: 메모리 통합이 너무 공격적이다

```typescript
// Disable automatic optimization
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  optimizeMemory: false,  // Disable auto-consolidation
  k: 10,
});
```

---

## 더 알아보기

- **QUIC 프로토콜**: docs/quic-synchronization.pdf
- **하이브리드 검색**: docs/hybrid-search-guide.md
- **GitHub**: https://github.com/ruvnet/agentic-flow/tree/main/packages/agentdb
- **웹사이트**: https://agentdb.ruv.io

---

**분류**: 고급 / 분산 시스템
**난이도**: 고급
**예상 소요 시간**: 45~60분
