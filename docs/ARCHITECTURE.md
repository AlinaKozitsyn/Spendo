# Technical Architecture — Spendo

> Last updated: Sprint 01
> Maintained by: [CTO]

---

## 1. High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                 │
│                                                                     │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │   Web App (SPA)  │    │  Mobile App      │    │   Wallet     │  │
│  │   React / Next   │    │  React Native    │    │  Extension   │  │
│  │   Dashboard,     │    │  (Future)        │    │  (Browser/   │  │
│  │   Charts, Upload │    │                  │    │   Mobile)    │  │
│  └────────┬─────────┘    └────────┬─────────┘    └──────┬───────┘  │
│           │                       │                      │          │
└───────────┼───────────────────────┼──────────────────────┼──────────┘
            │ HTTPS/REST            │ HTTPS/REST           │ WebSocket
            ▼                       ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        API GATEWAY / BACKEND                        │
│                        (FastAPI + Python)                           │
│                                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────┐  │
│  │  Auth      │  │  File Upload │  │  Budget   │  │  Wallet    │  │
│  │  Service   │  │  & Parse API │  │  API      │  │  WebSocket │  │
│  └────────────┘  └──────────────┘  └───────────┘  └────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              CORE PROCESSING PIPELINE                        │   │
│  │                                                              │   │
│  │  ExcelParser → Categorization Engine → Analytics → Planner  │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌────────────┐ ┌────────────┐ ┌────────────┐
     │ PostgreSQL │ │   Redis    │ │ Claude API │
     │ (Primary   │ │ (Cache,    │ │ (AI class- │
     │  Storage)  │ │  Sessions, │ │  ification)│
     │            │ │  Real-time)│ │            │
     └────────────┘ └────────────┘ └────────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Core Logic** | Python 3.12 | Rich data ecosystem; pandas for tabular data |
| **Web Framework** | FastAPI | Async, WebSocket support, auto-generated OpenAPI docs |
| **Excel Parsing** | pandas + openpyxl | Industry standard for .xlsx; handles Hebrew text |
| **CSV Parsing** | pandas | Built-in CSV support with encoding detection |
| **AI Classification** | Anthropic Claude API | Classifies unknown merchants; high accuracy on Hebrew+English |
| **Primary Database** | PostgreSQL | ACID compliance for financial data; JSON support for flexible schemas |
| **Cache / Real-time** | Redis | Session management, real-time wallet event pub/sub, budget cache |
| **Frontend** | React + Next.js (Sprint 02+) | Component-based, SSR for SEO, rich charting ecosystem |
| **Charts** | Recharts or Chart.js | Accessible, interactive, responsive data visualization |
| **Wallet Extension** | Browser Extension (Manifest V3) | Chrome/Edge support; secure isolated context |
| **Testing** | pytest | Lightweight, no boilerplate |
| **Auth** | JWT + bcrypt | Stateless auth, secure password hashing |

---

## 3. Module Map

```
backend/
├── __init__.py
├── requirements.txt
├── config/
│   └── settings.py                # Env-var config, singleton
└── modules/
    ├── shared/
    │   └── src/
    │       ├── __init__.py
    │       └── models.py          # Canonical data contracts
    │
    ├── excel_parser/
    │   ├── README.md
    │   ├── src/
    │   │   ├── __init__.py
    │   │   ├── parser.py          # ExcelParserAgent (.xlsx)
    │   │   └── csv_parser.py      # CSV parsing support
    │   └── tests/unit/
    │       └── test_parser.py
    │
    ├── classifier/
    │   ├── README.md
    │   ├── src/
    │   │   ├── __init__.py
    │   │   ├── rules.py           # Keyword rule engine (Pass 1)
    │   │   ├── ai_classifier.py   # Claude API classifier (Pass 2)
    │   │   ├── fuzzy_matcher.py   # Fuzzy string matching (Pass 1.5)
    │   │   ├── classifier.py      # Orchestrates all passes
    │   │   └── learning.py        # User override feedback loop
    │   └── tests/unit/
    │       ├── test_rules.py
    │       └── test_classifier.py
    │
    ├── planner/
    │   ├── README.md
    │   ├── src/
    │   │   ├── __init__.py
    │   │   ├── planner.py         # PlannerAgent (analytics)
    │   │   └── report_generator.py # Automated report generation
    │   └── tests/unit/
    │       └── test_planner.py
    │
    ├── budgeting/
    │   ├── README.md
    │   ├── src/
    │   │   ├── __init__.py
    │   │   ├── budget_manager.py  # Budget CRUD, limit tracking
    │   │   ├── alerts.py          # Threshold alerts (80%, 100%)
    │   │   └── tracker.py         # Real-time spent vs. remaining
    │   └── tests/unit/
    │       └── test_budget.py
    │
    └── wallet/
        ├── README.md
        ├── src/
        │   ├── __init__.py
        │   ├── websocket_handler.py  # WebSocket connection manager
        │   ├── event_processor.py    # Incoming transaction processing
        │   └── extension_auth.py     # Extension authentication
        └── tests/unit/
            └── test_wallet.py
```

---

## 4. Categorization Engine Architecture (Deep Dive)

The categorization engine is the **most critical component** of Spendo. It uses a multi-pass strategy to achieve near-100% accuracy:

```
Transaction Input
       │
       ▼
┌─────────────────────────┐
│  PASS 1: Exact Rules    │  Confidence: 1.0
│  Keyword lookup table   │  Speed: < 1ms per txn
│  "שופרסל" → Groceries   │  Coverage: ~60% of txns
└──────────┬──────────────┘
           │ unmatched
           ▼
┌─────────────────────────┐
│  PASS 1.5: Fuzzy Match  │  Confidence: 0.9
│  Levenshtein distance   │  Speed: < 5ms per txn
│  "שופר סל" → "שופרסל"   │  Coverage: ~15% of txns
│  Handles typos, spacing │
└──────────┬──────────────┘
           │ unmatched
           ▼
┌─────────────────────────┐
│  PASS 2: AI (Claude)    │  Confidence: 0.7
│  Batch API call         │  Speed: ~2s per batch
│  Hebrew+English support │  Coverage: ~20% of txns
│  Contextual reasoning   │
└──────────┬──────────────┘
           │ unmatched
           ▼
┌─────────────────────────┐
│  PASS 3: User Review    │  Confidence: 0.0 → 1.0
│  Flag for manual input  │  (after override)
│  Learn from overrides   │  Coverage: ~5% of txns
└─────────────────────────┘
```

### Classification Confidence Levels

| Confidence | Meaning | Source |
|---|---|---|
| 1.0 | Exact keyword match | rules.py |
| 0.9 | Fuzzy string match | fuzzy_matcher.py |
| 0.7 | AI inference | ai_classifier.py (Claude API) |
| 0.0 | Unknown / needs user review | None |

### Feedback Loop (Learning)
- When a user manually overrides a category, the merchant-category mapping is saved.
- On next encounter, the rule engine picks it up in Pass 1 (confidence 1.0).
- Over time, the rule table grows organically and AI calls decrease.
- This is stored in a `merchant_overrides` table in the database.

---

## 5. Digital Wallet Extension Architecture

### Communication Protocol
```
┌──────────────────┐         ┌──────────────────────┐
│  Wallet Extension │◄──────►│   Spendo Backend     │
│  (Browser/Mobile) │  WSS   │   WebSocket Server   │
└──────────────────┘         └──────────────────────┘
        │                              │
        │ 1. Auth handshake (JWT)      │
        │─────────────────────────────►│
        │                              │
        │ 2. Transaction event         │
        │─────────────────────────────►│
        │   {merchant, amount, ts}     │
        │                              │
        │ 3. Categorized confirmation  │
        │◄─────────────────────────────│
        │   {category, budget_status}  │
        │                              │
        │ 4. Budget alert (push)       │
        │◄─────────────────────────────│
        │   {alert_type, remaining}    │
```

### Extension Security Model
- **Manifest V3** (Chrome): Isolated world, no access to page DOM unless explicitly granted.
- **Authentication:** JWT token stored in extension's secure storage (`chrome.storage.session`).
- **Data in transit:** All communication over WSS (WebSocket Secure / TLS 1.3).
- **Minimal data exposure:** Extension sends only merchant name, amount, timestamp — never card numbers.
- **Token refresh:** Short-lived access tokens (15 min) with refresh token rotation.

### Real-time Flow
1. Extension detects a new wallet transaction (via digital wallet API or notification listener).
2. Encrypts and sends minimal transaction payload over WebSocket.
3. Backend receives event → categorizes instantly (rule engine) or queues for AI batch.
4. Backend updates budget tracker → checks thresholds.
5. If budget threshold crossed → pushes alert back to extension.
6. Extension displays non-intrusive notification to user.

---

## 6. Smart Budgeting Data Flow

```
User sets budget:  "Groceries: 2000 ILS/month"
                          │
                          ▼
              ┌──────────────────────┐
              │  budget_manager.py   │
              │  Store in PostgreSQL │
              │  Cache in Redis      │
              └──────────┬───────────┘
                         │
    ┌────────────────────┼────────────────────┐
    │                    │                    │
    ▼                    ▼                    ▼
New upload txn     Wallet real-time     Manual entry
    │                    │                    │
    └────────────────────┼────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │    tracker.py        │
              │  Aggregate spending  │
              │  per category/month  │
              └──────────┬───────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │     alerts.py        │
              │  Check thresholds:   │
              │  80% → warning       │
              │  100% → exceeded     │
              └──────────┬───────────┘
                         │
              ┌──────────┴───────────┐
              ▼                      ▼
        Push to UI            Push to Extension
     (dashboard badge)       (real-time alert)
```

---

## 7. Data Flow (Statement Upload — Sprint 01)

```
Excel/CSV File
      │
      ▼
ExcelParserAgent.parse()
      │  returns ParseResult
      ▼
[Transaction, Transaction, ...]
      │
      ▼
ClassificationAgent.classify_all()
  ├── Pass 1:   Rule engine (keywords) → ~60% classified instantly
  ├── Pass 1.5: Fuzzy matching → ~15% more classified
  └── Pass 2:   Claude API → ~20% remaining unknowns (batched)
      │  returns [ClassifiedTransaction, ...]
      ▼
PlannerAgent.analyze()
      │  returns analytics: MonthlySummary[], CategorySummary[]
      ▼
BudgetTracker.update()
      │  updates spent totals, checks thresholds
      ▼
UI Dashboard / Report
```

---

## 8. Key Data Models

```python
Transaction (frozen dataclass)
  transaction_id:   str       # SHA-1 hash of (date, merchant, amount, row_idx)
  transaction_date: date
  merchant_name:    str
  amount:           float     # Always positive (abs value)
  currency:         str       # ISO 4217, default "ILS"
  description:      str | None
  source_file:      str | None
  source_type:      str       # "upload" | "wallet"

Category (frozen dataclass)
  name:   str     # e.g. "Groceries"
  group:  str     # e.g. "Essentials"
  icon:   str | None

ClassifiedTransaction (frozen dataclass)
  transaction:          Transaction
  category:             Category
  confidence:           float   # 1.0 = rule, 0.9 = fuzzy, 0.7 = AI, 0.0 = unknown
  manually_overridden:  bool
  classification_pass:  str     # "rule" | "fuzzy" | "ai" | "manual"

BudgetGoal (frozen dataclass)
  category_name:  str
  monthly_limit:  float
  currency:       str

BudgetStatus (frozen dataclass)
  category_name:  str
  monthly_limit:  float
  spent:          float
  remaining:      float
  percentage:     float       # spent / monthly_limit * 100
  alert_level:    str         # "ok" | "warning" | "exceeded"

MerchantOverride (frozen dataclass)
  merchant_name:  str
  category_name:  str
  created_by:     str         # user_id
  created_at:     datetime
```

---

## 9. Security & Privacy Architecture

### Data at Rest
- PostgreSQL with AES-256 encryption for sensitive columns (merchant names, amounts).
- No raw credit card numbers are ever stored — parser strips them during ingestion.
- Database backups encrypted with separate key.

### Data in Transit
- All API endpoints served over HTTPS (TLS 1.3).
- WebSocket connections use WSS only.
- Claude API calls send minimal data: merchant name + amount only (no dates, no user identifiers).

### Authentication & Authorization
- JWT-based authentication with short-lived access tokens (15 min).
- Refresh token rotation — each refresh token is single-use.
- bcrypt for password hashing (cost factor 12).
- Rate limiting on auth endpoints (brute-force protection).

### Data Privacy
- GDPR-compliant: users can export all their data or request full deletion.
- Data retention policy: inactive accounts purged after 24 months.
- No transaction data shared with third parties (except minimal data to Claude API for classification).
- Audit log for all data access operations.

---

## 10. Configuration

All configuration lives in `backend/config/settings.py` and is loaded from `.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
USE_AI_CLASSIFICATION=true
LOG_LEVEL=INFO
SPENDO_DATA_DIR=data
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
JWT_SECRET=...
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=15
BUDGET_WARNING_THRESHOLD=0.8
BUDGET_EXCEEDED_THRESHOLD=1.0
```

---

## 11. Out of Scope (Sprint 01)

- Frontend / Dashboard UI (Sprint 02)
- Web API / HTTP endpoints (Sprint 02)
- Digital Wallet Extension (Sprint 03)
- Smart Budgeting real-time tracking (Sprint 03)
- User authentication (Sprint 02)
- Multi-currency conversion (Sprint 04+)
- Mobile app (Sprint 05+)
