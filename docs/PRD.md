# Product Requirements Document (PRD) — Spendo

> Last updated: Sprint 01
> Maintained by: [CTO]

---

## 1. Overview

**Project Name:** Spendo

**One-line description:** A highly visual personal finance platform that analyzes credit card expenses, categorizes transactions automatically, and provides real-time budget tracking through a digital wallet extension.

**Problem:** People lack clear visibility into where their money goes. Credit card statements are raw data — users need automated categorization, visual insights, and real-time spending awareness to make better financial decisions.

**Target Users:** Individuals who use credit cards as their primary payment method and want to understand, control, and plan their spending habits.

---

## 2. User Personas

### Persona 1: Budget-Conscious Professional
- **Age:** 25-40
- **Behavior:** Uses 1-2 credit cards for most purchases. Reviews statements monthly but finds raw data overwhelming.
- **Goal:** Understand spending patterns, set category budgets, avoid overspending.
- **Pain Point:** Manually categorizing transactions in spreadsheets is tedious and error-prone.

### Persona 2: Financial Planner
- **Age:** 30-55
- **Behavior:** Actively manages household finances. Downloads statements regularly.
- **Goal:** Historical trend analysis across months, identify spending growth areas, plan savings.
- **Pain Point:** No single tool combines statement parsing with visual trend analysis and budgeting.

### Persona 3: Casual Spender
- **Age:** 20-35
- **Behavior:** Doesn't track spending actively. Surprised by credit card bills.
- **Goal:** Get a quick visual summary of where money went, with zero effort.
- **Pain Point:** Doesn't want to learn complex finance tools — needs something instant and visual.

---

## 3. Core Features

| # | Feature | Description | Priority |
|---|---------|-------------|----------|
| 1 | **Statement Upload & Parsing** | Upload credit card Excel/CSV files; system extracts all transactions automatically | Must Have |
| 2 | **Transaction Categorization** | Auto-classify each transaction into categories (Groceries, Dining, Entertainment, etc.) with near-100% accuracy | Must Have |
| 3 | **Historical Data Analysis** | Visual dashboards with graphs showing spending by category across selectable timeframes (1m, 3m, 6m, 1y) | Must Have |
| 4 | **Digital Wallet Extension** | Browser/mobile companion that tracks real-time spending from the user's digital wallet | Must Have |
| 5 | **Smart Budgeting** | Set budget limits per category; real-time tracking of spent vs. remaining balance | Must Have |
| 6 | **Automated Reports** | Generate monthly/quarterly financial summary reports with insights and recommendations | Nice to Have |
| 7 | **Savings Goals** | Set and track savings targets with progress visualization | Nice to Have |

---

## 4. User Stories

### Story 1: Statement Upload & Parsing
> As a **budget-conscious professional**, I want to **upload my credit card Excel file**, so that **all my transactions are automatically extracted and ready for analysis**.

**Acceptance Criteria:**
- [ ] User can upload .xlsx and .csv files
- [ ] System extracts date, merchant name, amount, and description from each row
- [ ] Duplicate transactions are detected and flagged
- [ ] Hebrew and English merchant names are both supported
- [ ] Upload errors show clear, actionable messages

### Story 2: Transaction Categorization
> As a **user**, I want **my transactions to be automatically categorized**, so that **I can see where my money goes without manual effort**.

**Acceptance Criteria:**
- [ ] Each transaction is assigned to exactly one category
- [ ] Known merchants are classified instantly via rule engine (confidence 1.0)
- [ ] Unknown merchants are classified via AI (confidence >= 0.7)
- [ ] User can manually override any category assignment
- [ ] Manual overrides are learned for future transactions from the same merchant
- [ ] Categorization accuracy target: >= 95% without manual intervention

### Story 3: Historical Data Analysis
> As a **financial planner**, I want to **select a timeframe and see visual spending breakdowns**, so that **I can identify trends and plan my budget**.

**Acceptance Criteria:**
- [ ] User can select analysis period: 1 month, 3 months, 6 months, or 1 year
- [ ] Dashboard shows spending by category (pie/donut chart)
- [ ] Dashboard shows spending over time (line/bar chart)
- [ ] Top merchants by spending amount are listed
- [ ] Month-over-month comparison is available
- [ ] All charts are interactive (hover for details, click to drill down)

### Story 4: Digital Wallet Extension
> As a **casual spender**, I want **my daily purchases tracked automatically through my digital wallet**, so that **I always know how much I've spent this month**.

**Acceptance Criteria:**
- [ ] Extension captures transaction data from digital wallet in real-time
- [ ] Transactions appear in the app within seconds of purchase
- [ ] Extension works in background without user intervention
- [ ] Secure communication between extension and backend (encrypted, authenticated)
- [ ] Extension has minimal battery/performance impact on mobile

### Story 5: Smart Budgeting
> As a **budget-conscious professional**, I want to **set monthly spending limits per category and see real-time progress**, so that **I can stop overspending before it happens**.

**Acceptance Criteria:**
- [ ] User can set a monthly budget limit for any category
- [ ] Real-time progress bar shows spent vs. remaining per category
- [ ] Visual warnings at 80% and 100% of budget threshold
- [ ] Notifications/alerts when approaching or exceeding a budget limit
- [ ] Historical budget adherence tracking (did I stay within budget last month?)

---

## 5. Core User Flows

### Flow 1: Statement Upload Flow
```
User opens app → Clicks "Upload Statement" → Selects Excel/CSV file
→ System validates file format → Parser extracts transactions
→ Transactions displayed in table → User confirms/reviews
→ Categorization engine runs → Categories assigned
→ Dashboard updates with new data
```

### Flow 2: Categorization Flow
```
Transaction list received from parser
→ Pass 1: Rule engine matches merchant names to known categories (instant)
→ Pass 2: Unmatched transactions sent to AI classifier (batched)
→ All transactions now categorized with confidence scores
→ Low-confidence items flagged for user review
→ User overrides saved → Rule engine updated for future use
```

### Flow 3: Real-time Wallet Tracking Flow
```
User installs wallet extension → Authenticates with Spendo account
→ Extension monitors wallet transactions in background
→ New purchase detected → Encrypted payload sent to Spendo backend
→ Backend categorizes transaction → Updates budget tracking
→ User sees updated spending in app/extension dashboard
→ Budget threshold alert triggered if applicable
```

---

## 6. Out of Scope (MVP)

- Multi-user / family accounts
- Bank account integration (only credit cards for now)
- Investment tracking or portfolio management
- Tax calculation or filing
- Multi-currency conversion (planned for future sprint)
- AI-powered financial advice or recommendations

---

## 7. Success Criteria (KPIs)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Categorization Accuracy** | >= 95% | % of transactions correctly categorized without manual override |
| **Parse Success Rate** | >= 99% | % of uploaded files successfully parsed |
| **Time to First Insight** | < 30 seconds | From file upload to dashboard display |
| **UI Engagement** | > 3 min avg session | Average time users spend on dashboard per session |
| **Budget Adherence** | 70% of users within budget | % of users who stay within set category budgets |
| **Wallet Extension Latency** | < 5 seconds | Time from purchase to transaction appearing in app |
| **Accessibility Score** | WCAG 2.1 AA | Lighthouse accessibility audit score >= 90 |

---

## 8. Non-Functional Requirements

### Security
- All financial data encrypted at rest (AES-256) and in transit (TLS 1.3)
- No raw credit card numbers stored — only merchant, amount, date
- Session-based authentication with secure token management
- GDPR-compliant data handling with user data export/deletion

### Accessibility
- WCAG 2.1 AA compliance across all UI components
- Full keyboard navigation support
- Screen reader compatibility (ARIA labels)
- High-contrast mode and configurable font sizes
- RTL (Right-to-Left) language support for Hebrew

### Performance
- Dashboard renders within 2 seconds for up to 10,000 transactions
- File parsing completes within 10 seconds for standard statement files
- API response time < 200ms for cached data, < 2s for computed analytics

---

## 9. Technical Constraints

- **Must use:** Python for backend/core logic, Claude API for AI classification
- **Must support:** Hebrew and English text in merchant names
- **Must run on:** Web (responsive), with mobile extension support
- **Data privacy:** No transaction data sent to third parties except Claude API for classification (with minimal data exposure)
