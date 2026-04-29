# Decision Log — Spendo

> Maintained by: [CTO]
> Format: Newest first.

---

## DEC-012 — Transaction Model Extended Fields (billing_date, category, raw_row)

**Date:** Sprint 01
**Status:** Accepted

**Context:**
Israeli credit card exports include fields beyond the minimum (date, merchant, amount). Some providers include billing date, their own category/sector, and other metadata. We also need the raw row data for debugging and future manual correction UI.

**Decision:**
Add optional fields to Transaction: `billing_date`, `category`, `source_company`, `raw_row`. Add diagnostic fields to ParseResult: `detected_columns`, `missing_fields`, `raw_columns`, `header_row`.

**Rationale:**
- Captures provider-assigned categories for higher classification accuracy
- raw_row enables a manual correction UI in Phase 2
- Diagnostic fields enable clear, actionable error messages when parsing fails
- All new fields are optional — no breaking change for existing code

---

## DEC-011 — Case-Insensitive Column Matching

**Date:** Sprint 01
**Status:** Accepted

**Context:**
English column names may appear in any case (Title Case, UPPERCASE, lowercase). Hebrew has no case distinction.

**Decision:**
The `_norm()` function lowercases all column names before matching.

**Rationale:**
- Hebrew is unaffected by lowercasing
- English headers now match regardless of case
- Simple, zero-cost operation

---

## DEC-010 — Best-Row Header Detection (Highest Alias Match Count)

**Date:** Sprint 01
**Status:** Accepted (updated from original threshold-based approach)

**Context:**
Real Israeli bank exports have title/summary rows before the actual column headers. The parser needs to find the header row automatically.

**Decision:**
Scan the first 30 rows, pick the row with the MOST alias matches (minimum 2).

**Rationale:**
- "Most matches" is more robust than "first row with 2+ matches"
- Avoids false positives where a title row coincidentally contains a known word
- 30-row scan covers all known formats (typically 0-5 title rows)
- Falls back to row 0 if no match found (backward compatible)

---

## DEC-009 — Multi-Alias Column Mapping for Israeli Card Providers

**Date:** Sprint 01
**Status:** Accepted

**Context:**
Israeli credit card providers (Cal, Max, Isracard) use different Hebrew column headers for the same fields. A single-value column map cannot handle this variation.

**Options:**
1. **Single map per provider** — user selects their provider before upload
2. **Multi-alias table** — each canonical field maps to all known variants
3. **AI-based column detection** — use LLM to identify columns

**Decision:**
Multi-alias table (`COLUMN_ALIASES`) where each field has 6-10 known variants.

**Rationale:**
- Zero user friction — no need to select provider or configure anything
- Deterministic and fast — no API calls needed
- Easy to extend: adding a new provider is just adding aliases to the dict
- AI detection is overkill for a problem with a finite, known set of column names

---

## DEC-008 — Wallet Extension Framework: Chrome Manifest V3

**Date:** Sprint 01
**Status:** Accepted

**Context:**
The Digital Wallet Extension needs to run in user browsers to capture real-time transactions. We need to choose the extension framework and API version.

**Options:**
1. **Manifest V3 (Chrome/Edge)** — Latest standard, service workers, declarativeNetRequest
2. **Manifest V2 (Legacy)** — Deprecated, being phased out by Chrome
3. **Cross-browser WebExtension API** — Firefox + Chrome compatibility layer

**Decision:**
Chrome Manifest V3, with WebExtension polyfill for Firefox compatibility.

**Rationale:**
- Manifest V2 is deprecated; Chrome will stop supporting it in 2025
- V3's service worker model is more secure (no persistent background pages)
- V3's `chrome.storage.session` provides secure token storage
- WebExtension polyfill gives us Firefox support with minimal overhead
- Chrome + Edge cover ~80% of desktop browser market share

---

## DEC-007 — Real-time Communication: WebSocket over Polling

**Date:** Sprint 01
**Status:** Accepted

**Context:**
The wallet extension needs to send transactions to the backend and receive budget alerts in real-time. We need to choose the communication protocol.

**Options:**
1. **WebSocket (WSS)** — Full-duplex, persistent connection
2. **HTTP Long Polling** — Simulated real-time via repeated requests
3. **Server-Sent Events (SSE)** — Server-to-client only, one-directional
4. **gRPC Streaming** — High-performance bidirectional

**Decision:**
WebSocket (WSS) via FastAPI's native WebSocket support.

**Rationale:**
- Full-duplex needed: extension sends transactions AND receives alerts
- Lower latency than polling (no repeated HTTP handshakes)
- SSE is one-directional — can't push transactions from extension
- gRPC adds complexity and requires HTTP/2; overkill for this use case
- FastAPI has built-in WebSocket support, no extra framework needed
- Redis pub/sub backs the WebSocket layer for horizontal scaling

---

## DEC-006 — Database: PostgreSQL for Financial Data

**Date:** Sprint 01
**Status:** Accepted

**Context:**
We need a primary database for storing transactions, categories, budgets, and user data. Financial data requires strong consistency, ACID compliance, and query flexibility.

**Options:**
1. **PostgreSQL** — Relational, ACID, rich query language, JSON support
2. **SQLite** — Simple, file-based, no server needed
3. **MongoDB** — Document store, flexible schema
4. **MySQL** — Relational, widely used

**Decision:**
PostgreSQL.

**Rationale:**
- ACID transactions are non-negotiable for financial data integrity
- Rich aggregation queries needed for analytics (GROUP BY category, date ranges)
- JSON/JSONB columns for flexible metadata without schema migrations
- SQLite lacks concurrent write support — problematic with real-time wallet data
- MongoDB's eventual consistency model is risky for financial calculations
- PostgreSQL's `PARTITION BY` is ideal for time-series spending data
- Free tier available on most cloud providers; excellent tooling ecosystem

---

## DEC-005 — Caching & Real-time Layer: Redis

**Date:** Sprint 01
**Status:** Accepted

**Context:**
We need fast access to budget status (spent vs. remaining) for real-time tracking, session management, and pub/sub for WebSocket event distribution.

**Options:**
1. **Redis** — In-memory, pub/sub, session store, caching
2. **Memcached** — In-memory cache only
3. **Application-level cache** — In-process dictionary/LRU

**Decision:**
Redis.

**Rationale:**
- Budget status queries happen on every wallet transaction — must be sub-millisecond
- Pub/sub pattern needed to fan out alerts to multiple WebSocket connections
- Session management for JWT refresh tokens (blacklist revoked tokens)
- Memcached lacks pub/sub and persistence
- Application-level cache doesn't work across multiple backend instances
- Redis is already battle-tested for fintech real-time systems

---

## DEC-004 — Fuzzy Matching as Classification Pass 1.5

**Date:** Sprint 01
**Status:** Accepted

**Context:**
The rule engine (Pass 1) uses exact keyword matching, which fails on merchant name variations like extra spaces, typos, or abbreviations (e.g., "שופר סל" vs "שופרסל"). Sending all of these to the AI (Pass 2) is wasteful.

**Options:**
1. **Fuzzy string matching** (Levenshtein distance) as intermediate pass
2. **Regex patterns** per merchant — manually maintained
3. **Skip to AI** for all non-exact matches

**Decision:**
Add a fuzzy matching pass (Pass 1.5) using Levenshtein distance with a configurable similarity threshold (default 85%).

**Rationale:**
- Captures ~15% of transactions that exact match misses (spacing, minor typos)
- Much faster than AI — purely local computation (< 5ms per transaction)
- Reduces Claude API costs significantly
- Regex patterns require manual maintenance for every variation — doesn't scale
- Skipping to AI wastes API calls on easily resolvable variations
- Library: `rapidfuzz` (C-optimized, faster than `fuzzywuzzy`)

---

## DEC-003 — Multi-pass Classification Strategy (Rules → Fuzzy → AI)

**Date:** Sprint 01
**Status:** Accepted

**Context:**
We need to classify hundreds of transactions per upload. Calling the Claude API for every transaction would be slow and expensive. A simple regex parser would miss too many merchants and lack contextual understanding.

**Options:**
1. **AI for everything** — Send all transactions to Claude API
2. **Regex only** — Pattern matching with no AI fallback
3. **Multi-pass: Rules → AI** — Exact match first, AI for unknowns
4. **Multi-pass: Rules → Fuzzy → AI** — Add fuzzy matching as intermediate

**Decision:**
Multi-pass strategy: Rule engine (Pass 1) → Fuzzy matching (Pass 1.5) → Claude API (Pass 2) → User review (Pass 3).

**Rationale:**
- AI for everything: ~$0.50/upload at scale, 10s+ latency — unacceptable
- Regex only: brittle, no contextual understanding, fails on Hebrew abbreviations
- Rules → AI (no fuzzy): works but wastes AI calls on trivial variations
- Full multi-pass minimizes cost and latency while maximizing accuracy
- Rule engine handles ~60% instantly, fuzzy catches ~15% more, AI handles ~20%
- Remaining ~5% flagged for user review → feeds back into rule engine
- Target: >= 95% accuracy without manual intervention

---

## DEC-002 — Frozen Dataclasses as Shared Contracts

**Date:** Sprint 01
**Status:** Accepted

**Context:**
Modules must not import from each other (see AGENTS.md). We need a shared data format that all agents agree on.

**Decision:**
Use Python `@dataclass(frozen=True)` in `shared/src/models.py` as the canonical inter-module contract.

**Tradeoffs:**
- Immutable — no accidental mutation across module boundaries
- No external dependencies (stdlib only)
- Type-safe, IDE-friendly
- Adding fields is a breaking change — treat like a public API

---

## DEC-001 — Python-only Backend for Sprint 01

**Date:** Sprint 01
**Status:** Accepted

**Context:**
The project brief specifies Python as the core tech stack. We need to deliver the parsing + classification pipeline before building a web API.

**Decision:**
Sprint 01 delivers a pure Python pipeline (no web framework). The orchestration will be a simple `main.py` script for now.

**Tradeoffs:**
- Fast to build and test
- Decoupled from UI decisions (frontend TBD)
- Not usable from a browser yet — web API (FastAPI) comes in Sprint 02

**Alternatives Considered:**
- FastAPI from day 1: premature; adds complexity before core logic is stable
