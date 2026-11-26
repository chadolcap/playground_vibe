---
name: skill-builder
description: "올바른 YAML frontmatter, 점진적 공개(progressive disclosure) 구조, 완전한 디렉터리 구성을 갖춘 새 Claude Code Skills를 만든다. 특정 워크플로용 커스텀 skills를 만들거나, skill 템플릿을 생성하거나, Claude Skills 명세를 이해해야 할 때 사용한다."
---

# 스킬 빌더

## 이 스킬이 하는 일

올바른 YAML frontmatter, 점진적 공개 아키텍처, 완전한 파일·폴더 구조를 갖춘, 실제 운영에 쓸 수 있는 Claude Code Skills를 만든다. 이 스킬은 Claude가 모든 환경(Claude.ai, Claude Code, SDK, API)에서 스스로 찾아 사용할 수 있는 스킬을 만드는 과정을 안내한다.

## 사전 준비

- Claude Code 2.0 이상 또는 Skills를 지원하는 Claude.ai
- Markdown과 YAML에 대한 기본 이해
- 텍스트 편집기 또는 IDE

## 빠른 시작

### 첫 스킬 만들기

```bash
# 1. Create skill directory (MUST be at top level, NOT in subdirectories!)
mkdir -p ~/.claude/skills/my-first-skill

# 2. Create SKILL.md with proper format
cat > ~/.claude/skills/my-first-skill/SKILL.md << 'EOF'
---
name: "My First Skill"
description: "Brief description of what this skill does and when Claude should use it. Maximum 1024 characters."
---

# My First Skill

## What This Skill Does
[Your instructions here]

## Quick Start
[Basic usage]
EOF

# 3. Verify skill is detected
# Restart Claude Code or refresh Claude.ai
```

---

## 전체 명세

### 📋 YAML Frontmatter (필수)

모든 SKILL.md는 정확히 두 개의 필수 필드를 담은 YAML frontmatter로 **반드시** 시작해야 한다.

```yaml
---
name: "Skill Name"                    # REQUIRED: Max 64 chars
description: "What this skill does    # REQUIRED: Max 1024 chars
and when Claude should use it."       # Include BOTH what & when
---
```

#### 필드 요구 사항

**`name`** (필수):
- **타입**: String
- **최대 길이**: 64자
- **형식**: 사람이 읽기 쉬운 표시 이름
- **용도**: 스킬 목록과 UI에 표시되고, Claude의 시스템 프롬프트에 로드된다
- **모범 사례**: Title Case를 쓰고, 간결하면서도 설명적으로 짓는다
- **예시**:
  - ✅ "API Documentation Generator"
  - ✅ "React Component Builder"
  - ✅ "Database Schema Designer"
  - ❌ "skill-1" (설명적이지 않음)
  - ❌ "This is a very long skill name that exceeds sixty-four characters" (너무 김)

**`description`** (필수):
- **타입**: String
- **최대 길이**: 1024자
- **형식**: 일반 텍스트 또는 최소한의 markdown
- **내용**: 반드시 다음을 포함한다
  1. 스킬이 **무엇을** 하는지 (기능)
  2. Claude가 **언제** 호출해야 하는지 (트리거 조건)
- **용도**: 자율 매칭을 위해 Claude의 시스템 프롬프트에 로드된다
- **모범 사례**: 핵심 트리거 단어를 앞쪽에 두고, 사용 사례를 구체적으로 쓴다
- **예시**:
  - ✅ "Generate OpenAPI 3.0 documentation from Express.js routes. Use when creating API docs, documenting endpoints, or building API specifications."
  - ✅ "Create React functional components with TypeScript, hooks, and tests. Use when scaffolding new components or converting class components."
  - ❌ "A comprehensive guide to API documentation" ("언제" 절이 없음)
  - ❌ "Documentation tool" (너무 모호함)

#### YAML 작성 규칙

```yaml
---
# ✅ CORRECT: Simple string
name: "API Builder"
description: "Creates REST APIs with Express and TypeScript."

# ✅ CORRECT: Multi-line description
name: "Full-Stack Generator"
description: "Generates full-stack applications with React frontend and Node.js backend. Use when starting new projects or scaffolding applications."

# ✅ CORRECT: Special characters quoted
name: "JSON:API Builder"
description: "Creates JSON:API compliant endpoints: pagination, filtering, relationships."

# ❌ WRONG: Missing quotes with special chars
name: API:Builder  # YAML parse error!

# ❌ WRONG: Extra fields (ignored but discouraged)
name: "My Skill"
description: "My description"
version: "1.0.0"       # NOT part of spec
author: "Me"           # NOT part of spec
tags: ["dev", "api"]   # NOT part of spec
---
```

**중요**: Claude는 `name`과 `description`만 사용한다. 그 밖의 필드는 무시된다.

---

### 📂 디렉터리 구조

#### 최소 스킬 (필수)
```
~/.claude/skills/                    # Personal skills location
└── my-skill/                        # Skill directory (MUST be at top level!)
    └── SKILL.md                     # REQUIRED: Main skill file
```

**중요**: 스킬은 반드시 `~/.claude/skills/[skill-name]/` 바로 아래에 있어야 한다.
Claude Code는 중첩된 하위 디렉터리나 네임스페이스를 지원하지 않는다!

#### 전체 기능 스킬 (권장)
```
~/.claude/skills/
└── my-skill/                        # Top-level skill directory
        ├── SKILL.md                 # REQUIRED: Main skill file
        ├── README.md                # Optional: Human-readable docs
        ├── scripts/                 # Optional: Executable scripts
        │   ├── setup.sh
        │   ├── validate.js
        │   └── deploy.py
        ├── resources/               # Optional: Supporting files
        │   ├── templates/
        │   │   ├── api-template.js
        │   │   └── component.tsx
        │   ├── examples/
        │   │   └── sample-output.json
        │   └── schemas/
        │       └── config-schema.json
        └── docs/                    # Optional: Additional documentation
            ├── ADVANCED.md
            ├── TROUBLESHOOTING.md
            └── API_REFERENCE.md
```

#### 스킬 위치

**개인 스킬** (모든 프로젝트에서 사용 가능):
```
~/.claude/skills/
└── [your-skills]/
```
- **경로**: `~/.claude/skills/` 또는 `$HOME/.claude/skills/`
- **범위**: 이 사용자의 모든 프로젝트에서 사용할 수 있다
- **버전 관리**: git에 커밋되지 않는다 (저장소 밖)
- **사용 사례**: 개인 생산성 도구, 커스텀 워크플로

**프로젝트 스킬** (팀 공유, 버전 관리됨):
```
<project-root>/.claude/skills/
└── [team-skills]/
```
- **경로**: 프로젝트 루트의 `.claude/skills/`
- **범위**: 이 프로젝트에서만 사용할 수 있다
- **버전 관리**: git에 커밋해야 한다
- **사용 사례**: 팀 워크플로, 프로젝트 전용 도구, 공유 지식

---

### 🎯 점진적 공개 아키텍처

Claude Code는 **3단계 점진적 공개 시스템**을 사용해 컨텍스트 부담 없이 100개 이상의 스킬로 확장한다.

#### 1단계: 메타데이터 (이름 + 설명)
**로드 시점**: Claude Code 시작 시 항상
**크기**: 스킬당 약 200자
**목적**: 스킬 자율 매칭을 가능하게 한다
**컨텍스트**: 모든 스킬에 대해 시스템 프롬프트에 로드된다

```yaml
---
name: "API Builder"                   # 11 chars
description: "Creates REST APIs..."   # ~50 chars
---
# Total: ~61 chars per skill
# 100 skills = ~6KB context (minimal!)
```

#### 2단계: SKILL.md 본문
**로드 시점**: 스킬이 트리거되거나 매칭될 때
**크기**: 보통 약 1~10KB
**목적**: 주요 지침과 절차
**컨텍스트**: 활성화된 스킬에 대해서만 로드된다

```markdown
# API Builder

## What This Skill Does
[Main instructions - loaded only when skill is active]

## Quick Start
[Basic procedures]

## Step-by-Step Guide
[Detailed instructions]
```

#### 3단계 이상: 참조 파일
**로드 시점**: Claude가 탐색할 때 필요에 따라
**크기**: 가변 (KB~MB)
**목적**: 심화 참조, 예시, 스키마
**컨텍스트**: Claude가 특정 파일에 접근할 때만 로드된다

```markdown
# In SKILL.md
See [Advanced Configuration](docs/ADVANCED.md) for complex scenarios.
See [API Reference](docs/API_REFERENCE.md) for complete documentation.
Use template: `resources/templates/api-template.js`

# Claude will load these files ONLY if needed
```

**이점**: 100개 이상의 스킬을 약 6KB 컨텍스트로 설치할 수 있다. 활성화된 스킬의 내용(1~10KB)만 컨텍스트에 들어간다.

---

### 📝 SKILL.md 내용 구조

#### 권장 4단계 구조

```markdown
---
name: "Your Skill Name"
description: "What it does and when to use it"
---

# Your Skill Name

## Level 1: Overview (Always Read First)
Brief 2-3 sentence description of the skill.

## Prerequisites
- Requirement 1
- Requirement 2

## What This Skill Does
1. Primary function
2. Secondary function
3. Key benefit

---

## Level 2: Quick Start (For Fast Onboarding)

### Basic Usage
```bash
# Simplest use case
command --option value
```

### Common Scenarios
1. **Scenario 1**: How to...
2. **Scenario 2**: How to...

---

## Level 3: Detailed Instructions (For Deep Work)

### Step-by-Step Guide

#### Step 1: Initial Setup
```bash
# Commands
```
Expected output:
```
Success message
```

#### Step 2: Configuration
- Configuration option 1
- Configuration option 2

#### Step 3: Execution
- Run the main command
- Verify results

### Advanced Options

#### Option 1: Custom Configuration
```bash
# Advanced usage
```

#### Option 2: Integration
```bash
# Integration steps
```

---

## Level 4: Reference (Rarely Needed)

### Troubleshooting

#### Issue: Common Problem
**Symptoms**: What you see
**Cause**: Why it happens
**Solution**: How to fix
```bash
# Fix command
```

#### Issue: Another Problem
**Solution**: Steps to resolve

### Complete API Reference
See [API_REFERENCE.md](docs/API_REFERENCE.md)

### Examples
See [examples/](resources/examples/)

### Related Skills
- [Related Skill 1](#)
- [Related Skill 2](#)

### Resources
- [External Link 1](https://example.com)
- [Documentation](https://docs.example.com)
```

---

### 🎨 내용 작성 모범 사례

#### 효과적인 설명 작성

**키워드를 앞에 둔다**:
```yaml
# ✅ GOOD: Keywords first
description: "Generate TypeScript interfaces from JSON schema. Use when converting schemas, creating types, or building API clients."

# ❌ BAD: Keywords buried
description: "This skill helps developers who need to work with JSON schemas by providing a way to generate TypeScript interfaces."
```

**트리거 조건을 포함한다**:
```yaml
# ✅ GOOD: Clear "when" clause
description: "Debug React performance issues using Chrome DevTools. Use when components re-render unnecessarily, investigating slow updates, or optimizing bundle size."

# ❌ BAD: No trigger conditions
description: "Helps with React performance debugging."
```

**구체적으로 쓴다**:
```yaml
# ✅ GOOD: Specific technologies
description: "Create Express.js REST endpoints with Joi validation, Swagger docs, and Jest tests. Use when building new APIs or adding endpoints."

# ❌ BAD: Too generic
description: "Build API endpoints with proper validation and testing."
```

#### 점진적 공개를 고려한 작성

**1단계는 짧게 유지한다** (개요):
```markdown
## What This Skill Does
Creates production-ready React components with TypeScript, hooks, and tests in 3 steps.
```

**2단계는 흔한 경로용이다** (빠른 시작):
```markdown
## Quick Start
```bash
# Most common use case (80% of users)
generate-component MyComponent
```
```

**3단계는 세부 사항용이다** (단계별 안내):
```markdown
## Step-by-Step Guide

### Creating a Basic Component
1. Run generator
2. Choose template
3. Customize options
[Detailed explanations]
```

**4단계는 예외 상황용이다** (참조):
```markdown
## Advanced Configuration
For complex scenarios like HOCs, render props, or custom hooks, see [ADVANCED.md](docs/ADVANCED.md).
```

---

### 🛠️ 스크립트와 리소스 추가

#### 스크립트 디렉터리

**목적**: Claude가 실행할 수 있는 실행 스크립트
**위치**: 스킬 디렉터리 안의 `scripts/`
**사용법**: SKILL.md에서 참조한다

예시:
```bash
# In skill directory
scripts/
├── setup.sh          # Initialization script
├── validate.js       # Validation logic
├── generate.py       # Code generation
└── deploy.sh         # Deployment script
```

SKILL.md에서 참조하는 예:
```markdown
## Setup
Run the setup script:
```bash
./scripts/setup.sh
```

## Validation
Validate your configuration:
```bash
node scripts/validate.js config.json
```
```

#### 리소스 디렉터리

**목적**: 템플릿, 예시, 스키마, 정적 파일
**위치**: 스킬 디렉터리 안의 `resources/`
**사용법**: 스크립트가 참조하거나 복사한다

예시:
```bash
resources/
├── templates/
│   ├── component.tsx.template
│   ├── test.spec.ts.template
│   └── story.stories.tsx.template
├── examples/
│   ├── basic-example/
│   ├── advanced-example/
│   └── integration-example/
└── schemas/
    ├── config.schema.json
    └── output.schema.json
```

SKILL.md에서 참조하는 예:
```markdown
## Templates
Use the component template:
```bash
cp resources/templates/component.tsx.template src/components/MyComponent.tsx
```

## Examples
See working examples in `resources/examples/`:
- `basic-example/` - Simple component
- `advanced-example/` - With hooks and context
```

---

### 🔗 파일 참조와 탐색

Claude는 참조된 파일로 자동으로 이동할 수 있다. 다음 패턴을 사용한다.

#### Markdown 링크
```markdown
See [Advanced Configuration](docs/ADVANCED.md) for complex scenarios.
See [Troubleshooting Guide](docs/TROUBLESHOOTING.md) if you encounter errors.
```

#### 상대 파일 경로
```markdown
Use the template located at `resources/templates/api-template.js`
See examples in `resources/examples/basic-usage/`
```

#### 인라인 파일 내용
```markdown
## Example Configuration
See `resources/examples/config.json`:
```json
{
  "option": "value"
}
```
```

**모범 사례**: SKILL.md는 가볍게(약 2~5KB) 유지한다. 긴 내용은 별도 파일로 옮기고 참조한다. Claude는 필요한 것만 로드한다.

---

### ✅ 검증 체크리스트

스킬을 배포하기 전에 다음을 확인한다.

**YAML Frontmatter**:
- [ ] `---`로 시작한다
- [ ] `name` 필드가 있다 (최대 64자)
- [ ] `description` 필드가 있다 (최대 1024자)
- [ ] 설명에 "무엇"과 "언제"가 들어 있다
- [ ] `---`로 끝난다
- [ ] YAML 문법 오류가 없다

**파일 구조**:
- [ ] 스킬 디렉터리에 SKILL.md가 있다
- [ ] 디렉터리가 `~/.claude/skills/[skill-name]/` 또는 `.claude/skills/[skill-name]/` 바로 아래에 있다
- [ ] 명확하고 설명적인 디렉터리 이름을 쓴다
- [ ] **중첩된 하위 디렉터리가 없다** (Claude Code는 최상위 구조를 요구한다)

**내용 품질**:
- [ ] 1단계(개요)가 짧고 명확하다
- [ ] 2단계(빠른 시작)가 흔한 사용 사례를 보여 준다
- [ ] 3단계(세부 사항)가 단계별 안내를 제공한다
- [ ] 4단계(참조)가 심화 내용으로 연결된다
- [ ] 예시가 구체적이고 실행 가능하다
- [ ] 문제 해결 절이 흔한 문제를 다룬다

**점진적 공개**:
- [ ] 핵심 지침이 SKILL.md에 있다 (약 2~5KB)
- [ ] 심화 내용이 별도의 docs/에 있다
- [ ] 큰 리소스가 resources/ 디렉터리에 있다
- [ ] 단계 사이의 탐색이 명확하다

**테스트**:
- [ ] 스킬이 Claude의 스킬 목록에 나타난다
- [ ] 관련 질의에서 설명이 트리거된다
- [ ] 지침이 명확하고 실행 가능하다
- [ ] 스크립트가 성공적으로 실행된다 (포함한 경우)
- [ ] 예시가 문서대로 동작한다

---

## 스킬 빌더 템플릿

### 템플릿 1: 기본 스킬 (최소)

```markdown
---
name: "My Basic Skill"
description: "One sentence what. One sentence when to use."
---

# My Basic Skill

## What This Skill Does
[2-3 sentences describing functionality]

## Quick Start
```bash
# Single command to get started
```

## Step-by-Step Guide

### Step 1: Setup
[Instructions]

### Step 2: Usage
[Instructions]

### Step 3: Verify
[Instructions]

## Troubleshooting
- **Issue**: Problem description
  - **Solution**: Fix description
```

### 템플릿 2: 중급 스킬 (스크립트 포함)

```markdown
---
name: "My Intermediate Skill"
description: "Detailed what with key features. When to use with specific triggers: scaffolding, generating, building."
---

# My Intermediate Skill

## Prerequisites
- Requirement 1
- Requirement 2

## What This Skill Does
1. Primary function
2. Secondary function
3. Integration capability

## Quick Start
```bash
./scripts/setup.sh
./scripts/generate.sh my-project
```

## Configuration
Edit `config.json`:
```json
{
  "option1": "value1",
  "option2": "value2"
}
```

## Step-by-Step Guide

### Basic Usage
[Steps for 80% use case]

### Advanced Usage
[Steps for complex scenarios]

## Available Scripts
- `scripts/setup.sh` - Initial setup
- `scripts/generate.sh` - Code generation
- `scripts/validate.sh` - Validation

## Resources
- Templates: `resources/templates/`
- Examples: `resources/examples/`

## Troubleshooting
[Common issues and solutions]
```

### 템플릿 3: 고급 스킬 (전체 기능)

```markdown
---
name: "My Advanced Skill"
description: "Comprehensive what with all features and integrations. Use when [trigger 1], [trigger 2], or [trigger 3]. Supports [technology stack]."
---

# My Advanced Skill

## Overview
[Brief 2-3 sentence description]

## Prerequisites
- Technology 1 (version X+)
- Technology 2 (version Y+)
- API keys or credentials

## What This Skill Does
1. **Core Feature**: Description
2. **Integration**: Description
3. **Automation**: Description

---

## Quick Start (60 seconds)

### Installation
```bash
./scripts/install.sh
```

### First Use
```bash
./scripts/quickstart.sh
```

Expected output:
```
✓ Setup complete
✓ Configuration validated
→ Ready to use
```

---

## Configuration

### Basic Configuration
Edit `config.json`:
```json
{
  "mode": "production",
  "features": ["feature1", "feature2"]
}
```

### Advanced Configuration
See [Configuration Guide](docs/CONFIGURATION.md)

---

## Step-by-Step Guide

### 1. Initial Setup
[Detailed steps]

### 2. Core Workflow
[Main procedures]

### 3. Integration
[Integration steps]

---

## Advanced Features

### Feature 1: Custom Templates
```bash
./scripts/generate.sh --template custom
```

### Feature 2: Batch Processing
```bash
./scripts/batch.sh --input data.json
```

### Feature 3: CI/CD Integration
See [CI/CD Guide](docs/CICD.md)

---

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `install.sh` | Install dependencies | `./scripts/install.sh` |
| `generate.sh` | Generate code | `./scripts/generate.sh [name]` |
| `validate.sh` | Validate output | `./scripts/validate.sh` |
| `deploy.sh` | Deploy to environment | `./scripts/deploy.sh [env]` |

---

## Resources

### Templates
- `resources/templates/basic.template` - Basic template
- `resources/templates/advanced.template` - Advanced template

### Examples
- `resources/examples/basic/` - Simple example
- `resources/examples/advanced/` - Complex example
- `resources/examples/integration/` - Integration example

### Schemas
- `resources/schemas/config.schema.json` - Configuration schema
- `resources/schemas/output.schema.json` - Output validation

---

## Troubleshooting

### Issue: Installation Failed
**Symptoms**: Error during `install.sh`
**Cause**: Missing dependencies
**Solution**:
```bash
# Install prerequisites
npm install -g required-package
./scripts/install.sh --force
```

### Issue: Validation Errors
**Symptoms**: Validation script fails
**Solution**: See [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

---

## API Reference
Complete API documentation: [API_REFERENCE.md](docs/API_REFERENCE.md)

## Related Skills
- [Related Skill 1](../related-skill-1/)
- [Related Skill 2](../related-skill-2/)

## Resources
- [Official Documentation](https://example.com/docs)
- [GitHub Repository](https://github.com/example/repo)
- [Community Forum](https://forum.example.com)

---

**Created**: 2025-10-19
**Category**: Advanced
**Difficulty**: Intermediate
**Estimated Time**: 15-30 minutes
```

---

## 실제 사례

### 예시 1: 간단한 문서화 스킬

```markdown
---
name: "README Generator"
description: "Generate comprehensive README.md files for GitHub repositories. Use when starting new projects, documenting code, or improving existing READMEs."
---

# README Generator

## What This Skill Does
Creates well-structured README.md files with badges, installation, usage, and contribution sections.

## Quick Start
```bash
# Answer a few questions
./scripts/generate-readme.sh

# README.md created with:
# - Project title and description
# - Installation instructions
# - Usage examples
# - Contribution guidelines
```

## Customization
Edit sections in `resources/templates/sections/` before generating.
```

### 예시 2: 코드 생성 스킬

```markdown
---
name: "React Component Generator"
description: "Generate React functional components with TypeScript, hooks, tests, and Storybook stories. Use when creating new components, scaffolding UI, or following component architecture patterns."
---

# React Component Generator

## Prerequisites
- Node.js 18+
- React 18+
- TypeScript 5+

## Quick Start
```bash
./scripts/generate-component.sh MyComponent

# Creates:
# - src/components/MyComponent/MyComponent.tsx
# - src/components/MyComponent/MyComponent.test.tsx
# - src/components/MyComponent/MyComponent.stories.tsx
# - src/components/MyComponent/index.ts
```

## Step-by-Step Guide

### 1. Run Generator
```bash
./scripts/generate-component.sh ComponentName
```

### 2. Choose Template
- Basic: Simple functional component
- With State: useState hooks
- With Context: useContext integration
- With API: Data fetching component

### 3. Customize
Edit generated files in `src/components/ComponentName/`

## Templates
See `resources/templates/` for available component templates.
```

---

## 더 알아보기

### 공식 자료
- [Anthropic Agent Skills 문서](https://docs.claude.com/en/docs/agents-and-tools/agent-skills)
- [GitHub Skills 저장소](https://github.com/anthropics/skills)
- [Claude Code 문서](https://docs.claude.com/en/docs/claude-code)

### 커뮤니티
- [Skills 마켓플레이스](https://github.com/anthropics/skills) - 커뮤니티 스킬을 둘러본다
- [Anthropic Discord](https://discord.gg/anthropic) - 커뮤니티에서 도움을 받는다

### 심화 주제
- 복잡한 탐색을 갖춘 다중 파일 스킬
- 다른 스킬을 생성하는 스킬
- MCP 도구와의 연동
- 동적 스킬 생성

---

**작성일**: 2025-10-19
**버전**: 1.0.0
**관리**: agentic-flow 팀
**라이선스**: MIT
