# Multi-Agent Development Team Structure — Spendo

> Maintained by: [CTO]
> Last updated: Sprint 01
>
> This document defines the specialized AI agents that operate under the CTO's orchestration
> to execute the development of the Spendo FinTech platform. Each agent owns a distinct domain
> and communicates through well-defined contracts and interfaces.

---

## 1. Data Scientist & Categorization Agent

**Role:** The core intelligence behind Spendo's transaction categorization engine — the single most critical component of the platform.

**Responsibilities:**
- Design, build, and continuously improve the multi-pass categorization pipeline
- Parse and clean raw transaction data from Excel/CSV credit card statements
- Build and maintain the keyword rule engine (Pass 1) with Hebrew and English merchant mappings
- Implement fuzzy string matching (Pass 1.5) for merchant name variations, typos, and abbreviations
- Engineer Claude API prompts for zero-shot classification of unknown merchants (Pass 2)
- Implement the feedback loop: user overrides train the rule engine over time
- Monitor and report categorization accuracy metrics (target: >= 95%)
- Generate synthetic transaction datasets for testing and model validation

**Technical Skills & Stack:**
- **Python (Pandas, NumPy):** Core data manipulation — reading, cleaning, transforming tabular transaction data from diverse Excel/CSV formats
- **NLP & Text Processing:** Tokenization, normalization, and stemming for Hebrew and English merchant names; handling mixed-language text
- **Fuzzy Matching (`rapidfuzz`):** Levenshtein distance, token sort ratio, and partial ratio matching for merchant name variations (threshold tuning at 85% similarity)
- **Advanced Prompt Engineering:** Zero-shot and few-shot classification prompts for the Claude API; batch prompt design to classify multiple transactions in a single API call; structured JSON output parsing
- **Regex:** Pattern extraction for transaction amounts, dates, and merchant identifiers from inconsistent statement formats
- **Data Cleaning:** Handling encoding issues (UTF-8/Windows-1255 for Hebrew), stripping whitespace, normalizing currency symbols, deduplication via SHA-1 hashing
- **openpyxl:** Low-level Excel parsing for complex multi-sheet statements with merged cells and non-standard layouts
- **Statistics:** Confidence scoring, accuracy measurement, precision/recall tracking for categorization quality

**Key Outputs:**
- `ParseResult` — cleaned list of `Transaction` objects from raw files
- `ClassifiedTransaction[]` — transactions with categories and confidence scores
- Accuracy reports and categorization coverage metrics

---

## 2. UI/UX & Frontend Lead Agent

**Role:** Translates the PRD into a highly accessible, visually outstanding, and intuitive web and mobile interface. Owns the entire presentation layer.

**Responsibilities:**
- Design and implement the dashboard UI with interactive spending visualizations
- Build the statement upload flow with drag-and-drop, progress indicators, and validation feedback
- Create the budget management interface with real-time progress bars and threshold indicators
- Implement the historical analysis view with selectable timeframes (1m, 3m, 6m, 1y)
- Ensure full WCAG 2.1 AA compliance across all components
- Implement RTL (Right-to-Left) layout support for Hebrew users
- Build responsive layouts for desktop, tablet, and mobile viewports
- Design and implement the wallet extension popup UI

**Technical Skills & Stack:**
- **React + Next.js:** Component-based SPA with SSR for initial load performance; file-based routing; API route handlers for BFF (Backend-for-Frontend) pattern
- **TypeScript:** Strict typing for all frontend code; shared type definitions mirroring backend data contracts
- **Data Visualization (Recharts / Chart.js / D3.js):**
  - Recharts for standard charts (pie, bar, line) — React-native, declarative
  - D3.js for custom, complex visualizations (spending flow diagrams, budget radials)
  - Chart.js as fallback for lightweight, accessible chart rendering
- **Tailwind CSS:** Utility-first styling; custom design tokens for Spendo's visual identity; dark mode support; responsive breakpoints
- **WCAG 2.1 AA Compliance:**
  - ARIA labels and roles on all interactive elements
  - Keyboard navigation with visible focus indicators
  - Color contrast ratios >= 4.5:1 for text, >= 3:1 for UI components
  - Screen reader testing (NVDA, VoiceOver)
  - High-contrast mode toggle
  - Configurable font sizes (minimum 16px base)
- **RTL Support:** CSS logical properties (`margin-inline-start`), `dir="rtl"` attribute handling, bidirectional text rendering
- **Animation:** Framer Motion for micro-interactions (chart transitions, loading states, alerts) — respects `prefers-reduced-motion`
- **State Management:** React Context + useReducer for local state; TanStack Query (React Query) for server state and caching

**Key Outputs:**
- Interactive dashboard with spending charts and category breakdowns
- Statement upload interface with real-time parsing progress
- Budget management panel with live progress bars
- Wallet extension popup UI
- Accessibility audit reports (Lighthouse score >= 90)

---

## 3. Backend & Integration Agent

**Role:** Owns the server-side architecture, database design, API layer, and all integrations including the digital wallet extension communication protocol.

**Responsibilities:**
- Design and implement the FastAPI REST API serving all frontend data needs
- Manage PostgreSQL schema design, migrations, and query optimization for financial data
- Implement Redis caching layer for budget status, session management, and real-time pub/sub
- Build the WebSocket server for real-time wallet extension communication
- Implement file upload endpoints with validation, virus scanning, and size limits
- Design the wallet extension authentication and secure token exchange
- Implement rate limiting, request validation, and API versioning
- Orchestrate the processing pipeline: upload -> parse -> classify -> analyze -> store

**Technical Skills & Stack:**
- **Python (FastAPI):** Async request handling; dependency injection for services; auto-generated OpenAPI/Swagger docs; background task processing for long-running operations (file parsing, AI classification)
- **PostgreSQL:**
  - Schema design with proper normalization for transactions, categories, budgets, and users
  - Indexing strategy: B-tree on `(user_id, transaction_date)`, GIN on `merchant_name` for text search
  - Table partitioning by month for transaction data (performance at scale)
  - Alembic for schema migrations
- **Redis:**
  - Budget status cache: `budget:{user_id}:{category}:{month}` -> `{spent, limit, remaining}`
  - Pub/sub channels for WebSocket event distribution across backend instances
  - Session store for JWT refresh token blacklisting
  - Rate limiting counters with TTL
- **REST API Design:**
  - RESTful resource endpoints: `/api/v1/transactions`, `/api/v1/budgets`, `/api/v1/reports`
  - Pagination, filtering, and sorting on list endpoints
  - Consistent error response format with error codes
  - Request/response validation via Pydantic models
- **WebSocket (Real-time):**
  - FastAPI WebSocket endpoints for wallet extension connections
  - JWT authentication during WebSocket handshake
  - Heartbeat/ping-pong for connection health monitoring
  - Reconnection protocol with exponential backoff on client side
- **Browser Extension Communication:**
  - Manifest V3 service worker -> WebSocket client
  - `chrome.storage.session` for secure token storage in extension
  - Content Security Policy (CSP) headers for extension security
  - CORS configuration allowing extension origin
- **SQLAlchemy (Async):** ORM with async session management; repository pattern for data access layer

**Key Outputs:**
- FastAPI application with full REST API and WebSocket endpoints
- PostgreSQL schema and migration scripts
- Redis configuration and caching layer
- WebSocket protocol handler for wallet extension
- API documentation (auto-generated OpenAPI spec)

---

## 4. Security & Compliance Agent

**Role:** Safeguards all sensitive financial data flowing through the platform. Ensures every component meets security best practices and privacy compliance requirements.

**Responsibilities:**
- Conduct security reviews on all code before deployment
- Design and enforce encryption policies for data at rest and in transit
- Implement authentication and authorization systems
- Define and enforce Content Security Policy (CSP), CORS, and HTTP security headers
- Audit third-party dependencies for known vulnerabilities
- Design the data privacy framework (GDPR compliance, data retention, user data export/deletion)
- Perform threat modeling for each new feature
- Define incident response procedures for data breaches

**Technical Skills & Stack:**
- **OWASP Top 10 Mastery:**
  - Injection prevention: parameterized queries (SQLAlchemy), input sanitization
  - Broken authentication: secure session management, account lockout policies
  - Sensitive data exposure: no PII in logs, no card numbers stored
  - XSS prevention: output encoding, CSP headers, React's built-in escaping
  - CSRF protection: SameSite cookies, anti-CSRF tokens
  - Security misconfiguration: hardened server configs, disabled debug modes in production
- **Encryption — Data at Rest:**
  - AES-256 encryption for sensitive database columns (merchant names, amounts)
  - Database-level encryption (PostgreSQL pgcrypto extension)
  - Encrypted backups with separate key management
  - Key rotation policy (quarterly)
- **Encryption — Data in Transit:**
  - TLS 1.3 enforced on all endpoints (HTTPS, WSS)
  - Certificate pinning for mobile app connections
  - HSTS headers with long max-age
- **Authentication & Authorization:**
  - OAuth 2.0 authorization code flow for third-party integrations
  - JWT access tokens (short-lived: 15 min) with RS256 signing
  - Refresh token rotation — single-use tokens, revocation on reuse detection
  - bcrypt password hashing (cost factor 12)
  - Rate limiting on auth endpoints: 5 attempts per minute per IP
  - Multi-factor authentication (MFA) support (TOTP-based)
- **Financial Privacy Compliance:**
  - GDPR: right to access, right to erasure, data portability (JSON export)
  - Data minimization: only store what's necessary (no raw card numbers, no CVVs)
  - Audit logging: immutable log of all data access operations
  - Data retention policy: auto-purge inactive accounts after 24 months
  - Privacy-by-design: Claude API receives only merchant name + amount (no user identifiers)
- **Dependency Auditing:** `pip-audit` / `safety` for Python dependency vulnerability scanning; automated CI checks

**Key Outputs:**
- Security review reports for each feature/sprint
- Threat model documents
- Authentication/authorization implementation
- Encryption configuration and key management procedures
- GDPR compliance checklist and data flow audit

---

## 5. QA & Automation Agent

**Role:** Ensures zero critical bugs in financial logic through comprehensive testing at every level. Stress-tests the categorization engine and validates the entire user experience.

**Responsibilities:**
- Design and maintain the test strategy across unit, integration, and E2E levels
- Build and maintain synthetic test datasets (realistic mock credit card statements)
- Write and maintain automated test suites for all modules
- Stress-test the categorization engine for accuracy, performance, and edge cases
- Validate budget calculations for mathematical precision (floating-point handling)
- Perform accessibility audits using automated tools and manual checklist
- Run regression tests on every code change
- Generate test coverage reports and enforce minimum thresholds (>= 80%)

**Technical Skills & Stack:**
- **pytest (Python Backend):**
  - Unit tests for each module: parser, classifier, budgeting, wallet handler
  - Integration tests for the full pipeline: upload -> parse -> classify -> analyze
  - Fixtures and factories for test data generation
  - Parameterized tests for multi-format statement parsing (different banks, locales)
  - `pytest-asyncio` for async FastAPI endpoint testing
  - `pytest-cov` for coverage reporting (minimum 80% line coverage)
- **Playwright (E2E Browser Testing):**
  - Full user flow testing: upload statement -> view dashboard -> set budget
  - Visual regression testing with screenshot comparison
  - Multi-browser testing: Chromium, Firefox, WebKit
  - Accessibility testing via `@axe-core/playwright`
  - Mobile viewport testing for responsive layout validation
  - Wallet extension testing in Chrome with extension fixtures
- **Jest / Vitest (Frontend Unit Testing):**
  - Component testing with React Testing Library
  - Chart rendering validation (correct data points, labels, colors)
  - State management testing (budget updates, real-time data)
  - Mock API responses for isolated frontend testing
- **Synthetic Data Generation:**
  - Python scripts to generate realistic mock credit card statements
  - Configurable parameters: number of transactions, date ranges, merchant mix, languages (Hebrew/English)
  - Edge case datasets: empty files, single transaction, 10,000+ transactions, corrupted formats
  - Known-answer datasets: pre-categorized transactions for accuracy benchmarking
  - Multi-bank format simulation: different column orders, date formats, currency representations
- **Financial Logic Validation:**
  - Decimal precision tests (no floating-point rounding errors in budget calculations)
  - Currency handling tests (ILS formatting, thousands separator)
  - Budget threshold boundary tests (exactly 80%, exactly 100%, one shekel over)
  - Month boundary tests (transactions spanning midnight, timezone handling)
- **Performance Testing:**
  - Load testing with `locust` for API endpoint throughput
  - Categorization engine benchmarks: time per transaction, batch processing speed
  - Database query performance with realistic data volumes (100K+ transactions)

**Key Outputs:**
- Automated test suites (pytest, Playwright, Jest)
- Synthetic test data generator scripts
- Test coverage reports (>= 80% threshold)
- Categorization accuracy benchmark reports
- Performance and load test results
- Accessibility audit reports

---

## Inter-Agent Communication & Data Flow

The agents do not operate in isolation. Below is how data and control flow between them during the two primary workflows:

### Workflow 1: Statement Upload & Analysis

```
[FOUNDER] sets priorities and scope
       |
       v
[CTO] orchestrates, assigns tasks, reviews output
       |
       |--- Task 1: Parse file
       v
[Data Scientist Agent]
  - Receives: raw Excel/CSV file
  - Executes: parsing + categorization pipeline
  - Outputs: ClassifiedTransaction[] with confidence scores
  - Passes to: Backend Agent (for storage)
       |
       v
[Backend Agent]
  - Receives: ClassifiedTransaction[] from Data Scientist
  - Executes: stores in PostgreSQL, updates Redis budget cache
  - Outputs: REST API endpoints serving categorized data
  - Passes to: Frontend Agent (via API contracts)
       |
       v
[Frontend Agent]
  - Receives: API response (JSON) from Backend Agent
  - Executes: renders dashboard, charts, category breakdowns
  - Outputs: interactive UI visible to user
       |
       v
[QA Agent]
  - Receives: feature completion signal
  - Executes: runs test suites (unit, integration, E2E)
  - Outputs: test results, bug reports, accuracy benchmarks
  - Passes to: CTO for review
       |
       v
[Security Agent]
  - Reviews: all code changes for vulnerabilities
  - Validates: data handling, encryption, auth flows
  - Outputs: security sign-off or remediation requests
```

### Workflow 2: Real-time Wallet Tracking

```
[Frontend Agent] builds wallet extension UI
       |
       v
[Backend Agent] implements WebSocket server + auth
       |
       v
[Security Agent] reviews extension auth flow, CSP, token handling
       |
       v
[Data Scientist Agent] provides instant categorization for incoming transactions
       |
       v
[Backend Agent] updates budget tracker in Redis, checks thresholds
       |
       v
[Frontend Agent] displays real-time budget status + alerts in extension
       |
       v
[QA Agent] tests full flow: extension -> WebSocket -> categorize -> alert
```

### Communication Contracts

All inter-agent communication happens through **shared data models** defined in `backend/modules/shared/src/models.py`. No agent imports directly from another agent's module. Instead:

| From | To | Contract | Medium |
|---|---|---|---|
| Data Scientist | Backend | `ClassifiedTransaction[]`, `ParseResult` | Function return / message queue |
| Backend | Frontend | JSON over REST API (`/api/v1/*`) | HTTP responses matching OpenAPI spec |
| Backend | Frontend (real-time) | JSON over WebSocket | `{type, payload}` message frames |
| Frontend | Backend | HTTP requests + file uploads | Multipart form data, JSON bodies |
| Wallet Extension | Backend | Transaction events over WSS | `{merchant, amount, timestamp}` |
| QA | All Agents | Test results, bug reports | Markdown reports in `tests/reports/` |
| Security | All Agents | Security review findings | Documented in PR reviews + `docs/SECURITY.md` |

### Orchestration Rules

1. **No direct cross-agent imports** — all communication through shared contracts
2. **CTO reviews all inter-agent interfaces** before implementation begins
3. **QA validates every handoff** — if Data Scientist outputs data, QA tests it before Backend consumes it
4. **Security Agent has veto power** — any security concern blocks deployment until resolved
5. **FOUNDER approves** all irreversible decisions escalated by CTO
