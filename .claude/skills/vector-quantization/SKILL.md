---
name: vector-quantization
description: "ruflo 메모리에 대한 시맨틱 벡터 검색(semantic vector search)과 1비트 RaBitQ 양자화(quantization). 사용자가 저장된 패턴이나 임베딩(embeddings)에 대한 유사도 검색이 필요하거나, 큰 임베딩 저장소를 줄이려 하거나(약 32배 작아짐), recall 이 낮은 이유를 물을 때 사용한다(Use when). 정확한 키 조회(memory_retrieve 사용)나 작은 저장소(<1k 항목)에는 사용하지 않는다(Skip when): 그런 경우 일반 검색이 이미 정확하다."
---

# 벡터 검색과 양자화

## 어느 계층을 쓸지

| 필요 | 사용 | 기반 |
|---|---|---|
| 저장된 메모리를 의미로 검색 | `mcp__claude-flow__memory_search` | ONNX all-MiniLM-L6-v2 (384차원) + HNSW |
| 임베딩과 함께 메모리 저장 | `mcp__claude-flow__memory_store` | 동일 |
| 큰 저장소 압축, 빠른 근사 검색 | `mcp__claude-flow__embeddings_rabitq_build` 후 `mcp__claude-flow__embeddings_rabitq_search` | `@ruvector/rabitq-wasm` (1비트 RaBitQ + 정확 재순위화) |
| 양자화 인덱스에 무엇이 있는지 확인 | `mcp__claude-flow__embeddings_rabitq_status` | 동일 |
| 직접 작성한 코드 안의 독립 벡터 DB | `npm i ruvector` (`new VectorDb({ dimensions })`) | ruvector 네이티브/WASM |

## 작업 흐름

1. 만들기 전에 먼저 검색한다: `memory_search` 에 `{"query": "...", "limit": 10}`. 점수는 코사인 유사도이며, MiniLM 에서는 약 0.7 이상이면 가까운 일치다.
2. 저장소가 크고(수만 항목) 검색이 느리면 RaBitQ 인덱스를 한 번 만든 뒤(`embeddings_rabitq_build`), `embeddings_rabitq_search` 로 조회한다. 대량 가져오기 후에는 다시 만든다.
3. 효과가 있었던 것을 저장한다: 안정적인 `key` 와 `namespace`(예: `patterns`)를 지정해 `memory_store`.

## 알아 둘 만한 recall 사실

- `@claude-flow/memory` RVF 백엔드는 `hnsw-index.ts` 의 HNSW 인덱스로 검색한다. 벡터 1,000개 이하의 저장소는 정확하게 전수 탐색된다(recall 1.0).
- 무작위 384차원 벡터 5,000개에서 정확 검색 대비 측정한 recall@10: HNSW(ef=200)로 0.89. 이전 인덱스는 0.09였다. 실제 임베딩은 군집을 이루므로 recall 이 더 높다(군집된 집합에서 0.99 측정).
- 무작위 벡터는 어떤 근사 인덱스에서든 최악의 경우다. 합성 데이터에서 recall 이 낮다고 해서 실제 데이터도 그만큼 나쁘다는 뜻은 아니다.

## CLI 대응 명령 (셸과 Codex 용)

```bash
npx @claude-flow/cli memory search --query "auth token refresh" --limit 10
npx @claude-flow/cli memory store --key "pattern-auth" --value "JWT with refresh" --namespace patterns
npx @claude-flow/cli mcp exec -t embeddings_rabitq_status
```
