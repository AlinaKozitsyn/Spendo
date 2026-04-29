# Technical Architecture — Spendo

> Last updated: Sprint 01
> Maintained by: [CTO]

---

## 1. Tech Stack

| Layer               | Technology              | Why                                              |
|---------------------|-------------------------|--------------------------------------------------|
| **Core Logic**      | Python 3.12             | Rich data ecosystem; pandas for tabular data     |
| **Excel Parsing**   | pandas + openpyxl       | Industry standard for .xlsx; handles Hebrew text |
| **AI Classification** | Anthropic Claude API  | Classifies unknown merchants; already in stack   |
| **Testing**         | pytest                  | Lightweight, no boilerplate                      |
| **Frontend** (TBD)  | TBD (Sprint 02)         | Pending UI requirements                          |
| **Storage** (TBD)   | TBD (Sprint 02)         | SQLite or JSON for MVP                           |

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     User / UI Layer                      │
│         (uploads Excel file, views dashboard)            │
└──────────────────┬───────────────────────────────────────┘
                   │ file path + budget goals
                   ▼
┌──────────────────────────────────────────────────────────┐
│              Pipeline Orchestrator (main.py)             │
│   coordinates the three agents in sequence               │
└──┬──────────────┬──────────────────────┬─────────────────┘
   │              │                      │
   ▼              ▼                      ▼
┌──────────┐ ┌──────────────┐  ┌─────────────────┐
│  Agent 1 │ │   Agent 2    │  │    Agent 3      │
│  Excel   │ │Classification│  │    Planner      │
│  Parser  │ │   Agent      │  │    Agent        │
└──────────┘ └──────┬───────┘  └────────┬────────┘
                    │                   │
                    ▼ (unknowns only)   │
             ┌────────────┐             │
             │ Claude API │             ▼
             │ (Anthropic)│    MonthlySummary[]
             └────────────┘    CategorySummary[]
                                top_merchants[]

Shared contracts (no cross-module imports):
  backend/modules/shared/src/models.py
    → Transaction, Category, ClassifiedTransaction, BudgetGoal, ParseResult
```

---

## 3. Module Map

```
backend/
├── __init__.py
├── requirements.txt
├── config/
│   └── settings.py              # Env-var config, singleton
└── modules/
    ├── shared/
    │   └── src/
    │       ├── __init__.py
    │       └── models.py        # Canonical data contracts
    │
    ├── excel_parser/
    │   ├── README.md
    │   ├── src/
    │   │   ├── __init__.py
    │   │   └── parser.py        # ExcelParserAgent
    │   └── tests/unit/
    │       └── test_parser.py
    │
    ├── classifier/
    │   ├── README.md
    │   ├── src/
    │   │   ├── __init__.py
    │   │   ├── rules.py         # Keyword rule engine
    │   │   └── classifier.py   # ClassificationAgent (rules + AI)
    │   └── tests/unit/
    │       └── test_rules.py
    │
    └── planner/
        ├── README.md
        ├── src/
        │   ├── __init__.py
        │   └── planner.py      # PlannerAgent
        └── tests/unit/
            └── test_planner.py
```

---

## 4. Data Flow (Sprint 01)

```
Excel File (.xlsx)
      │
      ▼
ExcelParserAgent.parse()
      │  returns ParseResult
      ▼
[Transaction, Transaction, ...]
      │
      ▼
ClassificationAgent.classify_all()
  ├── Pass 1: Rule engine (keywords) → 80% of txns classified instantly
  └── Pass 2: Claude API → remaining ~20% unknowns
      │  returns [ClassifiedTransaction, ...]
      ▼
PlannerAgent.monthly_summaries()
      │  returns [MonthlySummary, ...]
      ▼
UI / Report
```

---

## 5. Key Data Models

```
Transaction (frozen dataclass)
  transaction_id:   str       # SHA-1 hash of (date, merchant, amount, row_idx)
  transaction_date: date
  merchant_name:    str
  amount:           float     # Always positive (abs value)
  currency:         str       # ISO 4217, default "ILS"
  description:      str|None
  source_file:      str|None

Category (frozen dataclass)
  name:   str     # e.g. "Groceries"
  group:  str     # e.g. "Essentials"
  icon:   str|None

ClassifiedTransaction (frozen dataclass)
  transaction:          Transaction
  category:             Category
  confidence:           float   # 1.0 = rule-based, 0.7 = AI, 0.0 = unknown
  manually_overridden:  bool

BudgetGoal (frozen dataclass)
  category_name:  str
  monthly_limit:  float
  currency:       str
```

---

## 6. Classification Confidence Levels

| Confidence | Meaning              | Source         |
|------------|----------------------|----------------|
| 1.0        | Exact keyword match  | rules.py       |
| 0.7        | AI inference         | Claude API     |
| 0.0        | Unknown / fallback   | Neither        |

Transactions with confidence < 1.0 should be surfaced in the UI for user review.

---

## 7. Configuration

All configuration lives in `backend/config/settings.py` and is loaded from `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
USE_AI_CLASSIFICATION=true
LOG_LEVEL=INFO
SPENDO_DATA_DIR=data
```

---

## 8. Out of Scope (Sprint 01)

- Web API / HTTP endpoints (Sprint 02)
- Frontend / Dashboard UI (Sprint 02)
- Database persistence (Sprint 02)
- User authentication (Sprint 03+)
- Multi-currency conversion (Sprint 03+)
