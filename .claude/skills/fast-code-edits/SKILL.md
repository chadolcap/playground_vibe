---
name: fast-code-edits
description: "LLM 호출 없이 코드 편집을 로컬에서 밀리초 단위로 적용한다: hooks_codemod 로 결정적 codemod(var-to-const, remove-console, add-logging)를 실행하고, hooks_fast-apply(agent-booster)로 큰 파일에 코드 조각을 병합한다. 여러 파일에 걸친 기계적 변환이나, 큰 파일 속 함수 하나의 교체 코드를 이미 갖고 있을 때 사용한다(Use when). 변경에 추론이 필요하면 사용하지 않고(Skip when) 모델로 라우팅한다."
---

# 빠른 코드 편집

두 엔진이 서로 다른 두 가지 일을 맡는다:

| 가진 것 | 사용 | 엔진 |
|---|---|---|
| 고정된 규칙이 있는 의도: `var-to-const`, `remove-console`, `add-logging` | `mcp__claude-flow__hooks_codemod` | TypeScript 컴파일러, 서식 보존 |
| 파일 일부를 대체할 새 코드(예: 다시 작성한 함수) | `mcp__claude-flow__hooks_fast-apply` | agent-booster (Morph 방식 fast apply) |
| 판단이 필요한 변경(타입 추가, 오류 처리, 리팩터링) | `mcp__claude-flow__hooks_model-route` 후 평소대로 편집 | 모델 |

## hooks_codemod

```json
{ "intent": "remove-console", "glob": "src/**/*.ts", "dryRun": true }
```

`code`, `file`, `files[]` 또는 `glob` 를 받는다. 경로는 프로젝트 안에 있어야 한다. 먼저 `dryRun` 으로 실행한 뒤, 그것 없이 다시 실행한다.

## hooks_fast-apply

`edit` 는 지시문이 아니라 코드여야 한다:

```json
{ "file": "src/math.ts",
  "edit": "export function add(a: number, b: number): number {\n  return a + b;\n}",
  "dryRun": true }
```

결과에는 `confidence`(0-1)와 `strategy`(예: `exact_replace`, `fuzzy_replace`, `insert`)가 담긴다. `minConfidence`(기본값 0.5) 미만이면 아무것도 쓰지 않는다. "make add typed" 같은 지시문은 `success: false` 를 반환한다. agent-booster 는 코드를 배치할 뿐, 코드를 작성하지 않는다.

## 라우팅 먼저

`mcp__claude-flow__hooks_model-route` 에 `{"task": "..."}` 를 넘기면, codemod 하나로 작업 전체를 처리할 수 있을 때 `[CODEMOD_AVAILABLE]` 를 반환한다. 그러면 모델 호출을 쓰는 대신 `hooks_codemod` 를 호출한다.

## CLI 대응 명령

```bash
npx @claude-flow/cli mcp exec -t hooks_codemod -p '{"intent":"var-to-const","file":"src/a.js","dryRun":true}'
npx @claude-flow/cli mcp exec -t hooks_fast-apply -p '{"file":"src/math.ts","edit":"<new function code>"}'
```
