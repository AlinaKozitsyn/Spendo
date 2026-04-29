# Sprint 01 — Task List

> CTO creates tasks. DEV checks them off. QA verifies.

## Phase 1: Initial Bug Fixes

| # | Task | Owner | Status | Acceptance Criteria |
|---|------|-------|--------|---------------------|
| 1 | Auto-detect header row in Excel files | DEV | [x] | Parser finds headers at row 4+ in real bank exports |
| 2 | Handle newlines in Hebrew column names | DEV | [x] | `תאריך\nעסקה` maps correctly to `transaction_date` |
| 3 | Replace single column map with multi-alias system | DEV | [x] | Cal column names resolve correctly |
| 4 | Fix datetime string parsing | DEV | [x] | Dates with time component parse without errors |
| 5 | Expand classifier rules for Hebrew merchants | DEV | [x] | 37/37 test transactions classified |
| 6 | Add new categories (Donations, Software, Office, Events) | DEV | [x] | All 24 previously uncategorized merchants have categories |
| 7 | Validate full pipeline with real Excel file | QA | [x] | Upload returns 37 transactions, 0 uncategorized |
| 8 | Update BUG_REPORT.md with all findings | DEV | [x] | All issues documented |

## Phase 2: Comprehensive Parser Overhaul

| # | Task | Owner | Status | Acceptance Criteria |
|---|------|-------|--------|---------------------|
| 9 | Expand COLUMN_ALIASES for all providers (Cal, Max, Isracard, Leumi, Amex) | DEV | [x] | 50+ aliases across 7 fields |
| 10 | Add billing_date, category, raw_row to Transaction model | DEV | [x] | Model updated, no regressions |
| 11 | Enhanced data cleaning (₪ stripping, Excel serial dates, invisible chars) | DEV | [x] | Amounts with symbols parse correctly |
| 12 | Best-row header detection (highest match count) | DEV | [x] | Picks row with most matches |
| 13 | Structured API error response with diagnostics | DEV | [x] | Error shows detected_columns, missing_fields |
| 14 | Case-insensitive column matching | DEV | [x] | English headers in any case work |
| 15 | Rewrite unit tests (39 tests, all scenarios) | QA | [x] | 39/39 passing, 54/54 total |
| 16 | Validate with real file + run full suite | QA | [x] | 37/37 parsed, 54/54 tests pass |
| 17 | Write PARSER_DESIGN.md documentation | DEV | [x] | Full pipeline documented |
| 18 | Update sprint report and decisions log | DEV | [x] | DEC-009 through DEC-012 added |

---

## Status Key

- `[ ]` — Not started
- `[~]` — In progress
- `[x]` — Done
- `[!]` — Blocked
