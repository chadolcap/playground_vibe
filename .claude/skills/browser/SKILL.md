---
name: browser
description: claude-flow 에이전트를 위한, AI에 최적화된 스냅샷 기반 웹 browser 자동화(web automation) 스킬이다
version: 1.0.0
triggers:
  - /browser
  - browse
  - web automation
  - scrape
  - navigate
  - screenshot
tools:
  - browser/open
  - browser/snapshot
  - browser/click
  - browser/fill
  - browser/screenshot
  - browser/close
---

# 브라우저 자동화 스킬

AI에 최적화된 스냅샷과 함께 agent-browser를 사용하는 웹 브라우저 자동화다. 전체 DOM 대신 요소 참조(@e1, @e2)를 사용해 컨텍스트를 93% 줄인다.

## 핵심 워크플로

```bash
# 1. Navigate to page
agent-browser open <url>

# 2. Get accessibility tree with element refs
agent-browser snapshot -i    # -i = interactive elements only

# 3. Interact using refs from snapshot
agent-browser click @e2
agent-browser fill @e3 "text"

# 4. Re-snapshot after page changes
agent-browser snapshot -i
```

## 빠른 참조

### 탐색
| 명령 | 설명 |
|---------|-------------|
| `open <url>` | URL로 이동한다 |
| `back` | 뒤로 간다 |
| `forward` | 앞으로 간다 |
| `reload` | 페이지를 새로 고친다 |
| `close` | 브라우저를 닫는다 |

### 스냅샷 (AI 최적화)
| 명령 | 설명 |
|---------|-------------|
| `snapshot` | 전체 접근성 트리 |
| `snapshot -i` | 상호작용 요소만 (버튼, 링크, 입력란) |
| `snapshot -c` | 압축 (빈 요소 제거) |
| `snapshot -d 3` | 깊이를 3단계로 제한 |
| `screenshot [path]` | 스크린샷 캡처 (경로가 없으면 base64) |

### 상호작용
| 명령 | 설명 |
|---------|-------------|
| `click <sel>` | 요소를 클릭한다 |
| `fill <sel> <text>` | 입력란을 비우고 채운다 |
| `type <sel> <text>` | 키 이벤트로 입력한다 |
| `press <key>` | 키를 누른다 (Enter, Tab 등) |
| `hover <sel>` | 요소 위에 마우스를 올린다 |
| `select <sel> <val>` | 드롭다운 옵션을 선택한다 |
| `check/uncheck <sel>` | 체크박스를 켜고 끈다 |
| `scroll <dir> [px]` | 페이지를 스크롤한다 |

### 정보 가져오기
| 명령 | 설명 |
|---------|-------------|
| `get text <sel>` | 텍스트 내용을 가져온다 |
| `get html <sel>` | innerHTML을 가져온다 |
| `get value <sel>` | 입력값을 가져온다 |
| `get attr <sel> <attr>` | 속성을 가져온다 |
| `get title` | 페이지 제목을 가져온다 |
| `get url` | 현재 URL을 가져온다 |

### 대기
| 명령 | 설명 |
|---------|-------------|
| `wait <selector>` | 요소를 기다린다 |
| `wait <ms>` | 밀리초만큼 기다린다 |
| `wait --text "text"` | 텍스트를 기다린다 |
| `wait --url "pattern"` | URL을 기다린다 |
| `wait --load networkidle` | 로드 상태를 기다린다 |

### 세션
| 명령 | 설명 |
|---------|-------------|
| `--session <name>` | 격리된 세션을 사용한다 |
| `session list` | 활성 세션 목록을 보여 준다 |

## 선택자

### 요소 참조 (권장)
```bash
# Get refs from snapshot
agent-browser snapshot -i
# Output: button "Submit" [ref=e2]

# Use ref to interact
agent-browser click @e2
```

### CSS 선택자
```bash
agent-browser click "#submit"
agent-browser fill ".email-input" "test@test.com"
```

### 의미 기반 로케이터
```bash
agent-browser find role button click --name "Submit"
agent-browser find label "Email" fill "test@test.com"
agent-browser find testid "login-btn" click
```

## 예시

### 로그인 흐름
```bash
agent-browser open https://example.com/login
agent-browser snapshot -i
agent-browser fill @e2 "user@example.com"
agent-browser fill @e3 "password123"
agent-browser click @e4
agent-browser wait --url "**/dashboard"
```

### 폼 제출
```bash
agent-browser open https://example.com/contact
agent-browser snapshot -i
agent-browser fill @e1 "John Doe"
agent-browser fill @e2 "john@example.com"
agent-browser fill @e3 "Hello, this is my message"
agent-browser click @e4
agent-browser wait --text "Thank you"
```

### 데이터 추출
```bash
agent-browser open https://example.com/products
agent-browser snapshot -i
# Iterate through product refs
agent-browser get text @e1  # Product name
agent-browser get text @e2  # Price
agent-browser get attr @e3 href  # Link
```

### 다중 세션 (Swarm)
```bash
# Session 1: Navigator
agent-browser --session nav open https://example.com
agent-browser --session nav state save auth.json

# Session 2: Scraper (uses same auth)
agent-browser --session scrape state load auth.json
agent-browser --session scrape open https://example.com/data
agent-browser --session scrape snapshot -i
```

## Claude Flow 연동

### MCP 도구
모든 브라우저 작업은 `browser/` 접두사가 붙은 MCP 도구로 제공된다.
- `browser/open`
- `browser/snapshot`
- `browser/click`
- `browser/fill`
- `browser/screenshot`
- 등

### 메모리 연동
```bash
# Store successful patterns
npx @claude-flow/cli memory store --namespace browser-patterns --key "login-flow" --value "snapshot->fill->click->wait"

# Retrieve before similar task
npx @claude-flow/cli memory search --query "login automation"
```

### 훅
```bash
# Pre-browse hook (get context)
npx @claude-flow/cli hooks pre-edit --file "browser-task.ts"

# Post-browse hook (record success)
npx @claude-flow/cli hooks post-task --task-id "browse-1" --success true
```

## 팁

1. **항상 스냅샷을 사용한다** - 참조가 붙어 있어 AI에 최적화되어 있다
2. **`-i` 플래그를 우선 사용한다** - 상호작용 요소만 가져오므로 출력이 작다
3. **선택자 대신 참조를 사용한다** - 더 안정적이고 결정적이다
4. **페이지 이동 후에는 다시 스냅샷을 찍는다** - 페이지 상태가 바뀐다
5. **병렬 작업에는 세션을 사용한다** - 세션마다 격리되어 있다
