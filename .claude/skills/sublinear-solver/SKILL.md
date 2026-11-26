---
name: sublinear-solver
description: "sublinear-time-solver 로 크고 희소한 대각 지배(diagonally dominant) 선형 시스템(Mx = b)을 풀고, 전체를 풀지 않고도 해의 개별 항목을 추정한다. Laplacian 이나 그래프 시스템, 영향도 추정, 또는 해의 일부 항목만 필요할 때 사용한다(Use when). 작은 그래프나 단순 PageRank 에는 사용하지 않는다(Skip when): 그런 경우 ruflo 내장 power iteration 이 훨씬 빠르다."
---

# 준선형 시간 풀이

`sublinear-time-solver` 는 Neumann 급수, 랜덤 워크, push 방식으로 대각 지배 시스템을 푼다. 강점은 해의 한 항목을 행렬 크기에 대해 준선형인 시간에 추정하는 것이다. 무거운 패키지(의존성 약 184개, 설치 시 123 MB)라서 ruflo 는 이를 설치하지 않는다. 문제에 필요할 때만 설치한다:

```bash
npm i sublinear-time-solver          # or run it on demand:
npx sublinear-time-solver --help
```

## 효과가 있을 때

- 행 또는 열 기준으로 대각 지배인, 수천 행 이상의 행렬(`analyze` 로 확인).
- 벡터 전체가 아니라 `M^-1 b` 의 몇몇 항목만 필요할 때.
- ruflo 와 함께 MCP 서버로 쓰고 싶을 때: `npx sublinear-time-solver serve`.

## 효과가 없을 때

- ruflo 지식 그래프에서의 PageRank 나 personalized PageRank. `mcp__claude-flow__agentdb_graph-pathfinder`(기본값 `personalized-pagerank`)를 사용한다. sublinear-time-solver 1.7.2 의 `computePageRank` 로 측정한 결과: 500 노드에서 1.2 s, 2,000 노드에서 68 s. 내장 power iteration 은 같은 크기에서 밀리초 단위다.
- 대각 지배가 아닌 행렬. 이 방식들의 수렴 보장이 성립하지 않는다.

## CLI 작업 흐름

```bash
npx sublinear-time-solver generate -t diagonally-dominant -s 1000 -o M.json
npx sublinear-time-solver analyze -m M.json --full         # dominance + condition estimate
npx sublinear-time-solver solve -m M.json -b b.json --method neumann --epsilon 1e-6 -o x.json
```

행렬 JSON 은 `{ "rows", "cols", "format": "coo", "values", "rowIndices", "colIndices" }` 또는 `{ "rows", "cols", "format": "dense", "data": [[...]] }` 형식이다.
