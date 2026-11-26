---
name: reasoningbank-intelligence
description: "ReasoningBank으로 adaptive learning(적응형 학습)을 구현해 pattern recognition(패턴 인식), strategy optimization(전략 최적화), continuous improvement(지속적 개선)를 수행한다. self-learning agent를 만들거나, workflow를 최적화하거나, meta-cognitive(메타인지) 시스템을 구현할 때 사용한다."
---

# ReasoningBank 인텔리전스

## 이 스킬이 하는 일

AI 에이전트가 경험에서 배우고, 패턴을 인식하고, 시간이 지나며 전략을 최적화하도록 ReasoningBank의 적응형 학습 시스템을 구현한다. 메타인지 능력과 지속적 개선을 가능하게 한다.

## 사전 요구 사항

- agentic-flow v1.5.11+
- AgentDB v1.0.4+ (영속 저장용)
- Node.js 18+

## 빠른 시작

```typescript
import { ReasoningBank } from 'agentic-flow/reasoningbank';

// Initialize ReasoningBank
const rb = new ReasoningBank({
  persist: true,
  learningRate: 0.1,
  adapter: 'agentdb' // Use AgentDB for storage
});

// Record task outcome
await rb.recordExperience({
  task: 'code_review',
  approach: 'static_analysis_first',
  outcome: {
    success: true,
    metrics: {
      bugs_found: 5,
      time_taken: 120,
      false_positives: 1
    }
  },
  context: {
    language: 'typescript',
    complexity: 'medium'
  }
});

// Get optimal strategy
const strategy = await rb.recommendStrategy('code_review', {
  language: 'typescript',
  complexity: 'high'
});
```

## 핵심 기능

### 1. 패턴 인식
```typescript
// Learn patterns from data
await rb.learnPattern({
  pattern: 'api_errors_increase_after_deploy',
  triggers: ['deployment', 'traffic_spike'],
  actions: ['rollback', 'scale_up'],
  confidence: 0.85
});

// Match patterns
const matches = await rb.matchPatterns(currentSituation);
```

### 2. 전략 최적화
```typescript
// Compare strategies
const comparison = await rb.compareStrategies('bug_fixing', [
  'tdd_approach',
  'debug_first',
  'reproduce_then_fix'
]);

// Get best strategy
const best = comparison.strategies[0];
console.log(`Best: ${best.name} (score: ${best.score})`);
```

### 3. 지속적 학습
```typescript
// Enable auto-learning from all tasks
await rb.enableAutoLearning({
  threshold: 0.7,        // Only learn from high-confidence outcomes
  updateFrequency: 100   // Update models every 100 experiences
});
```

## 고급 사용법

### 메타 학습
```typescript
// Learn about learning
await rb.metaLearn({
  observation: 'parallel_execution_faster_for_independent_tasks',
  confidence: 0.95,
  applicability: {
    task_types: ['batch_processing', 'data_transformation'],
    conditions: ['tasks_independent', 'io_bound']
  }
});
```

### 전이 학습
```typescript
// Apply knowledge from one domain to another
await rb.transferKnowledge({
  from: 'code_review_javascript',
  to: 'code_review_typescript',
  similarity: 0.8
});
```

### 적응형 에이전트
```typescript
// Create self-improving agent
class AdaptiveAgent {
  async execute(task: Task) {
    // Get optimal strategy
    const strategy = await rb.recommendStrategy(task.type, task.context);

    // Execute with strategy
    const result = await this.executeWithStrategy(task, strategy);

    // Learn from outcome
    await rb.recordExperience({
      task: task.type,
      approach: strategy.name,
      outcome: result,
      context: task.context
    });

    return result;
  }
}
```

## AgentDB 연동

```typescript
// Persist ReasoningBank data
await rb.configure({
  storage: {
    type: 'agentdb',
    options: {
      database: './reasoning-bank.db',
      enableVectorSearch: true
    }
  }
});

// Query learned patterns
const patterns = await rb.query({
  category: 'optimization',
  minConfidence: 0.8,
  timeRange: { last: '30d' }
});
```

## 성능 지표

```typescript
// Track learning effectiveness
const metrics = await rb.getMetrics();
console.log(`
  Total Experiences: ${metrics.totalExperiences}
  Patterns Learned: ${metrics.patternsLearned}
  Strategy Success Rate: ${metrics.strategySuccessRate}
  Improvement Over Time: ${metrics.improvement}
`);
```

## 모범 사례

1. **일관되게 기록한다**: 성공뿐 아니라 모든 작업 결과를 기록한다
2. **맥락을 제공한다**: 풍부한 맥락이 패턴 매칭을 개선한다
3. **임계값을 정한다**: 신뢰도가 낮은 학습 결과를 걸러 낸다
4. **주기적으로 검토한다**: 학습된 패턴의 품질을 점검한다
5. **벡터 검색을 쓴다**: 의미 기반 패턴 매칭을 켠다

## 문제 해결

### 문제: 추천 품질이 낮다
**해결**: 학습 데이터가 충분한지 확인한다 (작업 유형당 경험 100개 이상)

### 문제: 패턴 매칭이 느리다
**해결**: AgentDB에서 벡터 인덱싱을 켠다

### 문제: 메모리가 계속 커진다
**해결**: 오래된 경험에 TTL을 설정하거나 가지치기(pruning)를 켠다

## 더 알아보기

- ReasoningBank 가이드: agentic-flow/src/reasoningbank/README.md
- AgentDB 연동: packages/agentdb/docs/reasoningbank.md
- 패턴 학습: docs/reasoning/patterns.md
