---
name: agentdb-learning
description: "AgentDB의 reinforcement learning(강화학습) 알고리즘 9종으로 AI learning plugin을 만들고 학습시킨다. Decision Transformer, Q-Learning, SARSA, Actor-Critic 등을 포함한다. self-learning agent를 만들거나, RL을 구현하거나, 경험을 통해 agent 행동을 최적화할 때 사용한다."
---

# AgentDB 학습 플러그인

## 이 스킬이 하는 일

AgentDB의 플러그인 시스템으로 강화학습 알고리즘 9종을 쓸 수 있게 한다. 경험을 통해 개선되는 자율 에이전트용 학습 플러그인을 만들고, 학습시키고, 배포한다. 오프라인 RL(Decision Transformer), 가치 기반 학습(Q-Learning), 정책 경사(Actor-Critic)와 고급 기법을 포함한다.

**성능**: WASM으로 가속된 신경망 추론으로 모델을 10~100배 빠르게 학습시킨다.

## 사전 요구 사항

- Node.js 18+
- AgentDB v1.0.7+ (agentic-flow 경유)
- 강화학습에 대한 기본 이해 (권장)

---

## CLI로 빠르게 시작하기

### 학습 플러그인 만들기

```bash
# Interactive wizard
npx agentdb@latest create-plugin

# Use specific template
npx agentdb@latest create-plugin -t decision-transformer -n my-agent

# Preview without creating
npx agentdb@latest create-plugin -t q-learning --dry-run

# Custom output directory
npx agentdb@latest create-plugin -t actor-critic -o ./plugins
```

### 사용 가능한 템플릿 목록 보기

```bash
# Show all plugin templates
npx agentdb@latest list-templates

# Available templates:
# - decision-transformer (sequence modeling RL - recommended)
# - q-learning (value-based learning)
# - sarsa (on-policy TD learning)
# - actor-critic (policy gradient with baseline)
# - curiosity-driven (exploration-based)
```

### 플러그인 관리

```bash
# List installed plugins
npx agentdb@latest list-plugins

# Get plugin information
npx agentdb@latest plugin-info my-agent

# Shows: algorithm, configuration, training status
```

---

## API로 빠르게 시작하기

```typescript
import { createAgentDBAdapter } from 'agentic-flow/reasoningbank';

// Initialize with learning enabled
const adapter = await createAgentDBAdapter({
  dbPath: '.agentdb/learning.db',
  enableLearning: true,       // Enable learning plugins
  enableReasoning: true,
  cacheSize: 1000,
});

// Store training experience
await adapter.insertPattern({
  id: '',
  type: 'experience',
  domain: 'game-playing',
  pattern_data: JSON.stringify({
    embedding: await computeEmbedding('state-action-reward'),
    pattern: {
      state: [0.1, 0.2, 0.3],
      action: 2,
      reward: 1.0,
      next_state: [0.15, 0.25, 0.35],
      done: false
    }
  }),
  confidence: 0.9,
  usage_count: 1,
  success_count: 1,
  created_at: Date.now(),
  last_used: Date.now(),
});

// Train learning model
const metrics = await adapter.train({
  epochs: 50,
  batchSize: 32,
});

console.log('Training Loss:', metrics.loss);
console.log('Duration:', metrics.duration, 'ms');
```

---

## 사용 가능한 학습 알고리즘 (총 9개)

### 1. Decision Transformer (권장)

**유형**: 오프라인 강화학습
**적합한 용도**: 기록된 경험으로 학습, 모방 학습
**강점**: 온라인 상호작용이 필요 없고 학습이 안정적이다

```bash
npx agentdb@latest create-plugin -t decision-transformer -n dt-agent
```

**사용 사례**:
- 과거 데이터로 학습
- 전문가 시연을 통한 모방 학습
- 환경과 상호작용하지 않는 안전한 학습
- 시퀀스 모델링 작업

**설정**:
```json
{
  "algorithm": "decision-transformer",
  "model_size": "base",
  "context_length": 20,
  "embed_dim": 128,
  "n_heads": 8,
  "n_layers": 6
}
```

### 2. Q-Learning

**유형**: 가치 기반 RL (Off-Policy)
**적합한 용도**: 이산 행동 공간, 샘플 효율
**강점**: 검증되었고 단순하며 소·중규모 문제에 잘 맞는다

```bash
npx agentdb@latest create-plugin -t q-learning -n q-agent
```

**사용 사례**:
- 그리드 월드, 보드게임
- 내비게이션 작업
- 자원 할당
- 이산 의사결정

**설정**:
```json
{
  "algorithm": "q-learning",
  "learning_rate": 0.001,
  "gamma": 0.99,
  "epsilon": 0.1,
  "epsilon_decay": 0.995
}
```

### 3. SARSA

**유형**: 가치 기반 RL (On-Policy)
**적합한 용도**: 안전한 탐색, 위험에 민감한 작업
**강점**: Q-Learning보다 보수적이어서 안전성에 유리하다

```bash
npx agentdb@latest create-plugin -t sarsa -n sarsa-agent
```

**사용 사례**:
- 안전이 중요한 애플리케이션
- 위험에 민감한 의사결정
- 탐색을 동반한 온라인 학습

**설정**:
```json
{
  "algorithm": "sarsa",
  "learning_rate": 0.001,
  "gamma": 0.99,
  "epsilon": 0.1
}
```

### 4. Actor-Critic

**유형**: 가치 베이스라인을 쓰는 정책 경사
**적합한 용도**: 연속 행동, 분산 감소
**강점**: 안정적이며 연속·이산 행동 모두에 쓸 수 있다

```bash
npx agentdb@latest create-plugin -t actor-critic -n ac-agent
```

**사용 사례**:
- 연속 제어 (로보틱스, 시뮬레이션)
- 복잡한 행동 공간
- 다중 에이전트 협조

**설정**:
```json
{
  "algorithm": "actor-critic",
  "actor_lr": 0.001,
  "critic_lr": 0.002,
  "gamma": 0.99,
  "entropy_coef": 0.01
}
```

### 5. Active Learning

**유형**: 질의 기반 학습
**적합한 용도**: 레이블 효율적 학습, human-in-the-loop
**강점**: 레이블링 비용을 최소화하고 불확실한 샘플에 집중한다

**사용 사례**:
- 사람 피드백 반영
- 레이블 효율적 학습
- 불확실성 샘플링
- 주석 비용 절감

### 6. Adversarial Training

**유형**: 견고성 강화
**적합한 용도**: 안전성, 섭동에 대한 견고성
**강점**: 모델 견고성을 높이고 적대적 공격을 방어한다

**사용 사례**:
- 보안 애플리케이션
- 견고한 의사결정
- 적대적 공격 방어
- 안전성 테스트

### 7. Curriculum Learning

**유형**: 점진적 난이도 학습
**적합한 용도**: 복잡한 작업, 빠른 수렴
**강점**: 학습이 안정적이고 어려운 작업에서 더 빨리 수렴한다

**사용 사례**:
- 복잡한 다단계 작업
- 탐색이 어려운 문제
- 기술 조합
- 전이 학습

### 8. Federated Learning

**유형**: 분산 학습
**적합한 용도**: 프라이버시, 분산된 데이터
**강점**: 프라이버시를 보존하고 확장 가능하다

**사용 사례**:
- 다중 에이전트 시스템
- 프라이버시에 민감한 데이터
- 분산 학습
- 협업 학습

### 9. Multi-Task Learning

**유형**: 전이 학습
**적합한 용도**: 연관된 작업, 지식 공유
**강점**: 새 작업을 더 빨리 배우고 일반화가 잘 된다

**사용 사례**:
- 작업군
- 전이 학습
- 도메인 적응
- 메타 학습

---

## 학습 워크플로

### 1. 경험 수집

```typescript
// Store experiences during agent execution
for (let i = 0; i < numEpisodes; i++) {
  const episode = runEpisode();

  for (const step of episode.steps) {
    await adapter.insertPattern({
      id: '',
      type: 'experience',
      domain: 'task-domain',
      pattern_data: JSON.stringify({
        embedding: await computeEmbedding(JSON.stringify(step)),
        pattern: {
          state: step.state,
          action: step.action,
          reward: step.reward,
          next_state: step.next_state,
          done: step.done
        }
      }),
      confidence: step.reward > 0 ? 0.9 : 0.5,
      usage_count: 1,
      success_count: step.reward > 0 ? 1 : 0,
      created_at: Date.now(),
      last_used: Date.now(),
    });
  }
}
```

### 2. 모델 학습

```typescript
// Train on collected experiences
const trainingMetrics = await adapter.train({
  epochs: 100,
  batchSize: 64,
  learningRate: 0.001,
  validationSplit: 0.2,
});

console.log('Training Metrics:', trainingMetrics);
// {
//   loss: 0.023,
//   valLoss: 0.028,
//   duration: 1523,
//   epochs: 100
// }
```

### 3. 성능 평가

```typescript
// Retrieve similar successful experiences
const testQuery = await computeEmbedding(JSON.stringify(testState));
const result = await adapter.retrieveWithReasoning(testQuery, {
  domain: 'task-domain',
  k: 10,
  synthesizeContext: true,
});

// Evaluate action quality
const suggestedAction = result.memories[0].pattern.action;
const confidence = result.memories[0].similarity;

console.log('Suggested Action:', suggestedAction);
console.log('Confidence:', confidence);
```

---

## 고급 학습 기법

### 경험 재생

```typescript
// Store experiences in buffer
const replayBuffer = [];

// Sample random batch for training
const batch = sampleRandomBatch(replayBuffer, batchSize: 32);

// Train on batch
await adapter.train({
  data: batch,
  epochs: 1,
  batchSize: 32,
});
```

### 우선순위 경험 재생

```typescript
// Store experiences with priority (TD error)
await adapter.insertPattern({
  // ... standard fields
  confidence: tdError,  // Use TD error as confidence/priority
  // ...
});

// Retrieve high-priority experiences
const highPriority = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'task-domain',
  k: 32,
  minConfidence: 0.7,  // Only high TD-error experiences
});
```

### 다중 에이전트 학습

```typescript
// Collect experiences from multiple agents
for (const agent of agents) {
  const experience = await agent.step();

  await adapter.insertPattern({
    // ... store experience with agent ID
    domain: `multi-agent/${agent.id}`,
  });
}

// Train shared model
await adapter.train({
  epochs: 50,
  batchSize: 64,
});
```

---

## 성능 최적화

### 배치 학습

```typescript
// Collect batch of experiences
const experiences = collectBatch(size: 1000);

// Batch insert (500x faster)
for (const exp of experiences) {
  await adapter.insertPattern({ /* ... */ });
}

// Train on batch
await adapter.train({
  epochs: 10,
  batchSize: 128,  // Larger batch for efficiency
});
```

### 점진적 학습

```typescript
// Train incrementally as new data arrives
setInterval(async () => {
  const newExperiences = getNewExperiences();

  if (newExperiences.length > 100) {
    await adapter.train({
      epochs: 5,
      batchSize: 32,
    });
  }
}, 60000);  // Every minute
```

---

## 추론 에이전트 연동

더 나은 성능을 위해 학습과 추론을 함께 쓴다:

```typescript
// Train learning model
await adapter.train({ epochs: 50, batchSize: 32 });

// Use reasoning agents for inference
const result = await adapter.retrieveWithReasoning(queryEmbedding, {
  domain: 'decision-making',
  k: 10,
  useMMR: true,              // Diverse experiences
  synthesizeContext: true,    // Rich context
  optimizeMemory: true,       // Consolidate patterns
});

// Make decision based on learned experiences + reasoning
const decision = result.context.suggestedAction;
const confidence = result.memories[0].similarity;
```

---

## CLI 작업

```bash
# Create plugin
npx agentdb@latest create-plugin -t decision-transformer -n my-plugin

# List plugins
npx agentdb@latest list-plugins

# Get plugin info
npx agentdb@latest plugin-info my-plugin

# List templates
npx agentdb@latest list-templates
```

---

## 문제 해결

### 문제: 학습이 수렴하지 않는다
```typescript
// Reduce learning rate
await adapter.train({
  epochs: 100,
  batchSize: 32,
  learningRate: 0.0001,  // Lower learning rate
});
```

### 문제: 과적합
```typescript
// Use validation split
await adapter.train({
  epochs: 50,
  batchSize: 64,
  validationSplit: 0.2,  // 20% validation
});

// Enable memory optimization
await adapter.retrieveWithReasoning(queryEmbedding, {
  optimizeMemory: true,  // Consolidate, reduce overfitting
});
```

### 문제: 학습이 느리다
```bash
# Enable quantization for faster inference
# Use binary quantization (32x faster)
```

---

## 더 알아보기

- **알고리즘 논문**: 자세한 논문은 docs/algorithms/ 를 참고한다
- **GitHub**: https://github.com/ruvnet/agentic-flow/tree/main/packages/agentdb
- **MCP 연동**: `npx agentdb@latest mcp`
- **웹사이트**: https://agentdb.ruv.io

---

**분류**: 머신러닝 / 강화학습
**난이도**: 중급~고급
**예상 소요 시간**: 30~60분
