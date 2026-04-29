# AIcademy Scaffold — AI Vibe Coding Project Template

> Build software with AI as your coding partner.
> This template gives your team a structured starting point.

---

## What is Vibe Coding?

**Vibe Coding** is a development approach where AI does most of the coding, while humans make the decisions.

Instead of writing every line yourself, you:
1. **Describe** what you want to build
2. **Guide** the AI with clear roles and instructions
3. **Review** what it produces
4. **Iterate** until it's right

The key insight: **structure beats talent**. A well-organized prompt system with clear roles produces better code than unstructured back-and-forth with AI.

---

## Quick Start (5 minutes)

### Prerequisites
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed
- An Anthropic API key (`ANTHROPIC_API_KEY`)
- Git + Node.js (for Playwright E2E tests)

### Setup

```bash
# 1. Copy the scaffold into your new project
cp -r AIcademy-scaffold my-project
cd my-project

# 2. Initialize git
git init

# 3. Set up your environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 4. Fill in your project details
# Open CLAUDE.md and replace all {{PLACEHOLDERS}} with your project info

# 5. Install Playwright for E2E tests
npm init -y
npm install -D @playwright/test
npx playwright install chromium

# 6. Launch Claude Code
claude

# 7. Activate CTO mode to plan your architecture
/project:cto
```

---

## How This Template Works

### The 3 Files That Matter

| File | What It Does |
|---|---|
| **`CLAUDE.md`** | Tells Claude about YOUR project — stack, commands, structure. Auto-loaded on every conversation. |
| **`AGENTS.md`** | Defines 3 roles Claude can adopt: CTO, DEV, QA. Each has clear responsibilities. |
| **`docs/PRD.md`** | Your product requirements. What are you building and why? |

### The 3 Roles

| Role | Slash Command | When to Use |
|---|---|---|
| **CTO** | `/project:cto` | Planning architecture, making tech decisions, code review |
| **DEV** | `/project:dev` | Writing code, implementing features, fixing bugs |
| **QA** | `/project:qa` | Testing, finding bugs, verifying quality |

### The Workflow

```
1. PLAN    ->  /project:cto   ->  Design the system, break into tasks
2. BUILD   ->  /project:dev   ->  Implement features one by one
3. VERIFY  ->  /project:qa    ->  Test, find bugs, verify quality
4. REPEAT  ->  Back to step 1 for the next feature
```

---

## Project Structure

```
my-project/
├── CLAUDE.md                  # Project context (EDIT THIS FIRST)
├── AGENTS.md                  # Role definitions (CTO, DEV, QA)
├── README.md                  # This file
├── .env.example               # Environment variables template
├── playwright.config.ts       # E2E test configuration
│
├── .claude/
│   ├── settings.local.json    # Tool permissions for Claude
│   └── commands/
│       ├── cto.md             # /project:cto — architecture & planning
│       ├── dev.md             # /project:dev — implementation
│       ├── qa.md              # /project:qa — testing & quality
│       ├── plan.md            # /project:plan — force planning mode
│       ├── test.md            # /project:test — run tests
│       └── e2e.md             # /project:e2e — Playwright browser tests
│
├── backend/
│   ├── AGENTS.md              # Backend domain rules
│   └── modules/
│       └── _example/          # Copy this to create a new module
│           ├── README.md
│           ├── src/            # models, services, api routes
│           └── tests/
│               ├── unit/
│               └── integration/
│
├── frontend/
│   ├── AGENTS.md              # Frontend domain rules
│   └── modules/
│       └── _example/          # Copy this to create a new module
│           ├── README.md
│           ├── src/
│           │   └── components/
│           └── tests/
│               ├── unit/
│               └── integration/
│
├── tests/
│   ├── e2e/                   # Playwright E2E tests
│   │   └── example.spec.ts    # Starter test file
│   └── screenshots/           # GUI screenshots from tests
│
└── docs/
    ├── PRD.md                 # Product requirements (FILL THIS IN)
    ├── ARCHITECTURE.md        # Technical architecture
    ├── DECISIONS.md           # Decision log
    ├── knowledge/             # Research, references, domain docs
    ├── ui/
    │   └── UI_KIT.md          # Design system (colors, fonts, spacing)
    └── sprints/
        ├── README.md          # Sprint process guide
        └── sprint_01/
            ├── sprint_01_index.md
            ├── todo/
            ├── reports/
            └── reviews/
```

---

## Step-by-Step Guide

### Step 1: Define Your Project (10 min)

Open `CLAUDE.md` and replace all `{{PLACEHOLDERS}}`:
- `{{PROJECT_NAME}}` -- Your project name
- `{{PROJECT_DESCRIPTION}}` -- One-line description
- `{{TECH_STACK}}` -- e.g., "Next.js + TypeScript + Tailwind"
- `{{DEV_COMMAND}}` -- e.g., `npm run dev`
- `{{DEV_PORT}}` -- e.g., `3000`

### Step 2: Write Your PRD (15 min)

Open `docs/PRD.md` and fill in:
- What are you building?
- Who is it for?
- What are the core features? (keep it to 3-5)
- What does "done" look like?

### Step 3: Plan with CTO (15 min)

```bash
claude
/project:cto
```

Tell Claude:
> "Read the PRD and design the architecture. Break it into tasks for Sprint 1."

Claude will:
- Propose a technical architecture
- Create a task list in `docs/sprints/sprint_01/todo/`
- Identify risks and decisions needed

Review the plan. Ask questions. Approve or adjust.

### Step 4: Build with DEV (the main work)

```bash
/project:dev
```

Work through the task list one feature at a time:
> "Implement task 1: [description from the plan]"

Claude will write the code. You review it, test it, iterate.

**Create modules** by copying the `_example` template:
```bash
cp -r backend/modules/_example backend/modules/my-feature
cp -r frontend/modules/_example frontend/modules/my-feature
```

### Step 5: Verify with QA

```bash
/project:qa
```

Tell Claude:
> "Test the features we just built. Run E2E tests and check for bugs."

Claude will:
- Run existing tests
- Write new test scenarios
- Run Playwright E2E tests
- Report any bugs found

---

## Testing

### Unit Tests
Each module has its own `tests/` folder. Write unit tests alongside your code.

### E2E Tests (Playwright)
Browser tests live in `tests/e2e/`. Run them:

```bash
npx playwright test                # Run all E2E tests
npx playwright test --ui           # Interactive mode
npx playwright test --debug        # Step-through debugging
npx playwright show-report         # View HTML report
```

Configuration: `playwright.config.ts`

### Screenshots
Playwright captures screenshots in `tests/screenshots/` for visual verification.

---

## Tips for the Hackathon

### Do
- **Fill in CLAUDE.md first** -- it's the foundation of everything
- **Write a clear PRD** -- the better your requirements, the better the code
- **Use roles** -- CTO for planning, DEV for coding, QA for testing
- **Review code** -- don't blindly accept everything Claude writes
- **Commit often** -- small, frequent commits are better than one big one
- **Document decisions** -- use `docs/DECISIONS.md` for "why did we do X?"
- **Use the module structure** -- keep backend and frontend code organized

### Don't
- Don't skip the PRD -- "just start coding" leads to chaos
- Don't try to build everything at once -- pick 1-2 core features
- Don't ignore errors -- fix them before moving on
- Don't forget to test -- "it works on my machine" isn't enough
- Don't import directly across modules -- use shared interfaces

### Team Workflow

If you're working as a team:
1. **One person** sets up the repo and fills in `CLAUDE.md` + `docs/PRD.md`
2. **Divide by domain** -- one person on backend, one on frontend
3. **Use the roles** -- one person can focus on CTO/planning while others DEV
4. **Merge often** -- don't let branches diverge too far
5. **QA together** -- test each other's features before merging

---

## Available Slash Commands

| Command | What It Does |
|---|---|
| `/project:cto` | Switch Claude to CTO mode (architecture, planning, review) |
| `/project:dev` | Switch Claude to DEV mode (implementation, coding) |
| `/project:qa` | Switch Claude to QA mode (testing, bug finding) |
| `/project:plan` | Force Claude to plan before coding (prevents rushing) |
| `/project:test` | Run the project's test suite |
| `/project:e2e` | Run Playwright E2E browser tests |

---

## Claude API Integration

To use Claude AI in your app:

```bash
# Install the SDK (choose your stack)
npm install @anthropic-ai/sdk    # Node.js
pip install anthropic             # Python
```

```python
# Python example
import anthropic

client = anthropic.Anthropic()  # uses ANTHROPIC_API_KEY from .env

message = client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello, Claude!"}]
)
print(message.content[0].text)
```

```javascript
// Node.js example
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // uses ANTHROPIC_API_KEY from .env

const message = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello, Claude!" }],
});
console.log(message.content[0].text);
```

---

## Resources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Anthropic API Reference](https://docs.anthropic.com/en/api)
- [Playwright Documentation](https://playwright.dev/docs/intro)

---

## License

MIT -- use this template freely for your projects.
