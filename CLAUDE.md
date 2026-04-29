# {{PROJECT_NAME}} — Claude Code Project Context

> **Stack:** {{TECH_STACK}}
> **Purpose:** {{PROJECT_DESCRIPTION}}
>
> This file is auto-loaded by Claude Code CLI when you open this project directory.
> It is the single source of truth for Claude's project awareness.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Name** | {{PROJECT_NAME}} |
| **Purpose** | {{PROJECT_DESCRIPTION}} |
| **Current sprint** | Sprint 01 |
| **Dev port** | {{DEV_PORT}} |

---

## 2. Key Commands

```bash
# Development — replace with your actual commands
{{DEV_COMMAND}}                    # Start dev server
{{BUILD_COMMAND}}                  # Production build
{{TEST_COMMAND}}                   # Run unit tests
{{LINT_COMMAND}}                   # Lint / type check

# E2E Testing (Playwright)
npx playwright test                # Run all E2E tests
npx playwright test --ui           # Interactive UI mode
npx playwright test --debug        # Debug mode
```

> E2E tests auto-start the dev server if `webServer` is configured in `playwright.config.ts`.

---

## 3. Definition of Done

```
A FEATURE IS "DONE" ONLY WHEN:
  1. Code works — dev server runs without errors
  2. Tests pass — unit tests cover the new logic
  3. E2E pass — browser tests on affected flows (if UI changed)
  4. No regressions — existing features still work
  5. Reviewed — teammate or CTO has seen the code
  6. Screenshots — captured for GUI changes (tests/screenshots/)
```

**NEVER mark done based on "it compiles" alone.**

---

## 4. Project Structure

```
{{PROJECT_NAME}}/
├── CLAUDE.md                # This file — project context for Claude
├── AGENTS.md                # Role definitions (CTO, DEV, QA)
├── README.md                # Project README
├── .env.example             # Environment variables template
├── playwright.config.ts     # Playwright E2E configuration
│
├── .claude/
│   ├── settings.local.json  # Tool permissions for Claude
│   └── commands/            # Slash commands
│
├── backend/
│   ├── AGENTS.md            # Backend domain rules
│   └── modules/
│       └── _example/        # Reference module (copy to start new)
│           ├── README.md
│           ├── src/          # Models, services, API routes
│           └── tests/        # unit/ and integration/
│
├── frontend/
│   ├── AGENTS.md            # Frontend domain rules
│   └── modules/
│       └── _example/        # Reference module (copy to start new)
│           ├── README.md
│           ├── src/          # Components, hooks, utils
│           └── tests/        # unit/ and integration/
│
├── tests/
│   ├── e2e/                 # Playwright E2E test files
│   └── screenshots/         # GUI screenshots (captured by tests)
│
└── docs/
    ├── PRD.md               # Product requirements
    ├── ARCHITECTURE.md      # Technical architecture
    ├── DECISIONS.md         # Decision log
    ├── knowledge/           # Research, references, domain knowledge
    ├── ui/
    │   └── UI_KIT.md        # Design system tokens
    └── sprints/
        └── sprint_01/       # Sprint artifacts (index, todo, reports)
```

---

## 5. Environment Variables

Copy `.env.example` → `.env`. Required:

```
ANTHROPIC_API_KEY=sk-ant-...      # Claude API key
```

---

## 6. Available Commands

| Command | Purpose |
|---|---|
| `/project:cto` | Activate CTO role — architecture & planning |
| `/project:dev` | Activate DEV role — implementation |
| `/project:qa` | Activate QA role — testing & quality |
| `/project:plan` | Force plan mode before complex work |
| `/project:test` | Run full test suite |
| `/project:e2e` | Run Playwright E2E browser tests |

---

## 7. Role Tags

| Tag | Who |
|---|---|
| `[CTO]` | Architecture, tech decisions, code review |
| `[DEV]` | Implementation, features, bug fixes |
| `[DEV:backend]` | Backend module implementation |
| `[DEV:frontend]` | Frontend module implementation |
| `[QA]` | Testing, quality gates, bug discovery |
| `[FOUNDER]` | Human operator — final decision maker |

> Reading order: domain `AGENTS.md` (e.g., `backend/AGENTS.md`) → root `AGENTS.md` → `docs/PRD.md`

---

## 8. Testing Strategy

| Level | Location | Tool | When |
|-------|----------|------|------|
| **Unit** | `*/modules/*/tests/unit/` | Jest / pytest / vitest | Every feature |
| **Integration** | `*/modules/*/tests/integration/` | Framework test runner | Cross-module features |
| **E2E** | `tests/e2e/` | Playwright | Every UI change |
| **Screenshots** | `tests/screenshots/` | Playwright | Every UI change |

---

## 9. What NOT to Do

- Do NOT silently expand scope beyond the current task
- Do NOT add dependencies without discussing with the team
- Do NOT mark features done without actually testing them
- Do NOT skip writing tests for new logic
- Do NOT hardcode secrets or credentials
- Do NOT import directly across modules — use shared interfaces
