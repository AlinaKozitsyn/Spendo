# CHANGELOG — Spendo

All notable changes to this project are documented here.
Format: newest entry at the top.

---

## [Sprint 01] — Initial Architecture & Core Agents

### Added

#### Infrastructure
- `backend/__init__.py` — makes backend a Python package
- `backend/requirements.txt` — pinned dependencies (pandas, openpyxl, anthropic, pytest)
- `backend/config/settings.py` — centralised env-var configuration with `Settings` class

#### Shared Contracts (`backend/modules/shared/`)
- `models.py` — canonical frozen dataclasses shared across all modules:
  - `Transaction` — atomic unit from Excel parsing
  - `Category` — classification output
  - `ClassifiedTransaction` — Transaction + Category + confidence
  - `BudgetGoal` — user-defined monthly spending limit
  - `ParseResult` — structured output from ExcelParserAgent

#### Agent 1 — ExcelParserAgent (`backend/modules/excel_parser/`)
- `src/parser.py` — full implementation:
  - Configurable column map (Hebrew/English headers)
  - Row-level error handling (skips bad rows, never crashes)
  - Deterministic SHA-1 transaction IDs (prevents duplicate imports)
  - Supports common Israeli date formats (`dd/mm/yyyy`, `dd.mm.yyyy`, etc.)
  - Handles comma decimal separator common in Israeli bank exports
- `tests/unit/test_parser.py` — 9 unit tests (mocked pandas, no real files)
- `README.md`

#### Agent 2 — ClassificationAgent (`backend/modules/classifier/`)
- `src/rules.py` — keyword rule engine:
  - 8 predefined categories with Hebrew + English keywords
  - Groups: Essentials, Leisure, Savings, Other
  - Returns (Category, confidence) tuple; 0.0 signals AI escalation
- `src/classifier.py` — ClassificationAgent:
  - Two-pass strategy: rules first, Claude API for unknowns
  - Batch AI call (single API request for all unknowns)
  - Graceful degradation if API key is missing
- `tests/unit/test_rules.py` — 8 unit tests
- `README.md`

#### Agent 3 — PlannerAgent (`backend/modules/planner/`)
- `src/planner.py` — financial aggregation:
  - `monthly_summaries()` — per-category spend grouped by month
  - `top_merchants()` — top N merchants by total spend
  - Budget variance calculation (actual vs. BudgetGoal)
  - Optional month/year filtering
- `tests/unit/test_planner.py` — 8 unit tests
- `README.md`

#### Documentation
- `docs/ARCHITECTURE.md` — full system architecture, data flow diagram, module map
- `docs/DECISIONS.md` — 3 architectural decisions recorded (DEC-001 to DEC-003)
- `CHANGELOG.md` — this file

#### Directory Structure Created
```
backend/modules/
  shared/src/
  excel_parser/src/ + tests/unit/ + tests/integration/
  classifier/src/ + tests/unit/ + tests/integration/
  planner/src/ + tests/unit/
  config/
data/
  samples/
  uploads/
```

### Architecture Decisions
- **DEC-001**: Python-only backend for Sprint 01 (no web framework yet)
- **DEC-002**: Frozen dataclasses as shared inter-module contracts
- **DEC-003**: Two-pass classification (rules → AI) for speed and cost efficiency

### Next Steps (Sprint 02)
- [ ] Build pipeline orchestrator `main.py` connecting all 3 agents end-to-end
- [ ] Add `conftest.py` with shared pytest fixtures (sample transactions)
- [ ] Add FastAPI web layer exposing `/parse`, `/classify`, `/summary` endpoints
- [ ] Design and build frontend dashboard
- [ ] StorageAgent for persisting classification overrides and budget goals
