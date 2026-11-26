---
name: graph-mincut
description: "정확한 minimum cut(최소 컷, @ruvector/mincut-wasm via ruvector)으로 의존성 그래프나 지식 그래프에서 가장 약한 경계를 찾는다. 사용자가 모듈을 어디서 나눌지, 어떤 파일들이 느슨하게 결합되어 있는지, 노드가 어느 클러스터에 속하는지, 에이전트 간 작업을 어떻게 분할(partition)할지 물을 때 사용한다(Use when). 최단 경로나 단순 이웃 조회에는 사용하지 않는다(Skip when, agentdb_graph-query k-hop 사용)."
---

# 그래프 최소 컷과 분할

최소 컷(minimum cut)은 제거하면 그래프가 둘로 나뉘는 가장 비용이 적은 간선 집합이다. 코드 그래프에서는 모듈 경계를 긋는 비용이 가장 적은 곳을 가리키고, 한 노드 주변에서는 그 노드가 속한 클러스터의 가장자리를 가리킨다.

## 도구

| 질문 | 호출 |
|---|---|
| 이 코드베이스의 자연스러운 분할 지점 | `npx @claude-flow/cli analyze boundaries src/` (별칭 `mincut`) |
| 이 지식 그래프 노드가 어느 클러스터에 있고, 가장 약한 경계가 무엇인지 | `mcp__claude-flow__agentdb_graph-pathfinder` 에 `algorithm: "dynamic-mincut"` |
| 순위가 매겨진 이웃, 영향도 | 같은 도구에 `algorithm: "personalized-pagerank"` |

pathfinder 호출 예시:

```json
{ "seedNodeId": "entity:auth-module", "query": "auth boundary", "algorithm": "dynamic-mincut",
  "depth": 3, "threshold": 0, "complexityBudget": { "maxMillis": 2000 } }
```

응답에는 `paths`(컷에서 시드 쪽에 있는 노드들, 가까운 순)와 `cutValue`, `cutEdges`, `seedSideSize`, `otherSideSize`, `backend` 가 담긴 `mincut` 블록이 포함된다.

## 결과 읽기

- `backend: "mincut-wasm"` 은 `ruvector` 가 가져오는 wasm 솔버에서 정확한 컷이 나왔다는 뜻이다. 1,000 노드에서 JS Stoer-Wagner 폴백보다 약 30배 빠르다(187 ms 대 6 s).
- `backend: "js-fallback"` 은 ruvector 가 설치되어 있지 않다는 뜻이다. JS 폴백은 300 노드 이하의 이웃 영역에서만 실행된다. 이 제한을 풀려면 `npm i ruvector` 를 실행한다.
- `cutValue` 가 시드 자신의 차수(degree)에 가깝다면 시드가 약하게 연결되어 있다는 뜻이므로, 컷이 클러스터가 아니라 시드만 고립시킨다. 더 큰 `depth` 를 시도한다.
- `spectral-sparsify` 와 `connected-component-churn` 은 현재 k-hop 근사다. 응답에서 `implementation` 으로 표시된다.
