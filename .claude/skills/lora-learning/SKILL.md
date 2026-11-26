---
name: lora-learning
description: "ruflo 의 온디바이스 학습을 훈련하고 사용한다: @ruvector/learning-wasm 기반 MicroLoRA 어댑터(마이크로초 단위 WASM 적응), trajectory 기록, 패턴 학습. 사용자가 ruflo 가 성공한 작업에서 학습하길 원하거나, 라우팅을 프로젝트에 맞게 적응시키려 하거나, WASM 학습이 활성 상태인지 확인하려 할 때 사용한다(Use when). 피드백 신호가 없는 일회성 작업에는 사용하지 않는다(Skip when)."
---

# LoRA 학습

ruflo 는 작업 결과로부터 작은 저랭크(LoRA) 가중치를 적응시킨다. 빠른 경로는 `@claude-flow/cli` 와 함께 배포되는 `@ruvector/learning-wasm` 이다. 이 모듈은 `WasmMicroLoRA`, `WasmScopedLoRA`(연산자별 어댑터), `WasmTrajectoryBuffer` 를 제공한다. 이 모듈이 없으면 같은 코드가 더 느린 JS 폴백에서 실행된다.

## 백엔드 확인

```bash
npx @claude-flow/cli neural benchmark -i 1000     # MicroLoRA table: average adaptation time in microseconds
npx @claude-flow/cli neural status
```

벤치마크의 MicroLoRA 표는 WASM 모듈이 로드될 때만 나타난다. 측정값: 256차원 적응 1회당 약 2 µs. `RuVector JS fallback (install @ruvector/learning-wasm ...)` 이 보이면 선택적 의존성이 건너뛰어진 것이다. `--omit=optional` 없이 다시 설치한다.

## 작업에서 학습하기

1. 작업을 trajectory 로 기록한다: `mcp__claude-flow__hooks_intelligence_trajectory-start` 를 호출하고, 결정마다 `..._trajectory-step` 을, 마지막에 결과와 함께 `..._trajectory-end` 를 호출한다.
2. 재사용 가능한 패턴을 저장한다: `mcp__claude-flow__hooks_intelligence_pattern-store`.
3. 훈련한다: `mcp__claude-flow__neural_train`, 또는 CLI 에서 `npx @claude-flow/cli neural train -p coordination`.
4. 재사용한다: 다음에 비슷한 작업을 하기 전에 `mcp__claude-flow__hooks_intelligence_pattern-search`.

## 좋은 습관

- 검증된 결과(테스트 통과, 사용자 수락)만 기록한다. 검증되지 않은 성공으로 훈련하면 잘못된 것을 가르치게 된다.
- 어댑터가 도메인을 섞지 않도록 프로젝트마다 네임스페이스를 하나씩 둔다.
- 패턴 집합이 안정되면 `neural optimize` 가 저장된 패턴을 Int8 로 양자화한다(약 4배 작아짐).
