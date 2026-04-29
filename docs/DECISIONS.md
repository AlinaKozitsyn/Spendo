# Decision Log — Spendo

> Maintained by: [CTO]
> Format: Newest first.

---

## DEC-003 — Two-pass classification strategy (rules → AI)

**Date:** Sprint 01
**Status:** Accepted

**Context:**
We need to classify ~hundreds of transactions per upload. Calling the Claude
API for every transaction would be slow and expensive.

**Decision:**
Use a keyword rule engine (Pass 1) for known merchants. Only unmatched
transactions hit the Claude API (Pass 2), batched in a single call.

**Tradeoffs:**
- ✅ Fast: most classifications are instant (no network)
- ✅ Cheap: API calls only for true unknowns
- ✅ Auditable: rule-based results are 100% explainable
- ⚠️ Rule table needs manual maintenance
- ⚠️ AI results are probabilistic (confidence 0.7, not 1.0)

**Alternatives Considered:**
- AI for everything: too slow and costly at scale
- No AI at all: poor UX for unknown merchants

---

## DEC-002 — Frozen dataclasses as shared contracts

**Date:** Sprint 01
**Status:** Accepted

**Context:**
Modules must not import from each other (see AGENTS.md). We need a
shared data format that all agents agree on.

**Decision:**
Use Python `@dataclass(frozen=True)` in `shared/src/models.py` as the
canonical inter-module contract.

**Tradeoffs:**
- ✅ Immutable → no accidental mutation across module boundaries
- ✅ No external dependencies (stdlib only)
- ✅ Type-safe, IDE-friendly
- ⚠️ Adding fields is a breaking change — treat like a public API

---

## DEC-001 — Python-only backend for Sprint 01

**Date:** Sprint 01
**Status:** Accepted

**Context:**
The project brief specifies Python as the core tech stack. We need to
deliver the parsing + classification pipeline before building a web API.

**Decision:**
Sprint 01 delivers a pure Python pipeline (no web framework). The
orchestration will be a simple `main.py` script for now.

**Tradeoffs:**
- ✅ Fast to build and test
- ✅ Decoupled from UI decisions (frontend TBD)
- ⚠️ Not usable from a browser yet — web API comes in Sprint 02

**Alternatives Considered:**
- FastAPI from day 1: premature; adds complexity before core logic is stable
