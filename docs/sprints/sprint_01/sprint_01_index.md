# Sprint 01 — Robust Excel Ingestion for Israeli Credit Cards

| Field | Value |
|-------|-------|
| **Sprint** | 01 |
| **Goal** | Build a provider-agnostic parser that handles all Israeli credit card formats and achieves 100% parse + classification rate |
| **Status** | Complete |
| **Start** | 2026-04-29 |
| **End** | 2026-04-29 |

---

## Scope

### Phase 1: Critical Bug Fixes
1. Fix header row auto-detection for files with title sections
2. Fix column name matching for multi-line Hebrew headers
3. Add multi-alias column mapping for Cal provider
4. Fix date parsing for datetime strings
5. Expand classifier rules for uncategorized Hebrew merchants

### Phase 2: Comprehensive Parser Overhaul
6. Expand aliases to cover Cal, Max, Isracard, Leumi Card, Amex, English
7. Add billing_date, category, source_company, raw_row to Transaction model
8. Excel serial date support, currency symbol stripping, invisible char removal
9. Best-row header detection (highest match count, not just first match)
10. Structured API error diagnostics (detected_columns, missing_fields)
11. Case-insensitive English column matching
12. 39 unit tests + full regression suite (54 total)
13. PARSER_DESIGN.md documentation

---

## Exit Criteria

- [x] All tasks completed and tested
- [x] No critical bugs
- [x] 54/54 tests passing, zero regressions
- [x] Real Excel file: 37/37 transactions parsed and classified
- [x] Documentation complete (PARSER_DESIGN.md, decisions log, sprint report)

---

## Artifacts

- Design doc: `docs/PARSER_DESIGN.md`
- Tasks: `todo/sprint_01_todo.md`
- Report: `reports/sprint_01_report.md`
- Bug Report: `docs/BUG_REPORT.md`
- Decisions: `docs/DECISIONS.md` (DEC-009 through DEC-012)
