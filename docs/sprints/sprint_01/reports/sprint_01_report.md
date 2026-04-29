# Sprint 01 — Report

| Field | Value |
|-------|-------|
| **Sprint** | 01 |
| **Date** | 2026-04-29 |
| **Status** | Complete |
| **Tasks completed** | 9 / 9 (phase 1) + 7 / 7 (phase 2 — parser overhaul) |

---

## Phase 1: Initial Bug Fixes

### What was delivered
- Auto-detect header row (basic: first row with 2+ matches)
- Multi-alias column mapping replacing single-value DEFAULT_COLUMN_MAP
- Whitespace normalisation for newline-containing Hebrew headers
- DateTime string format support (`%Y-%m-%d %H:%M:%S`)
- Expanded classifier rules: 4 new categories, ~30 new keywords
- 100% classification rate on test file (37/37)

---

## Phase 2: Comprehensive Parser Overhaul

### What was delivered

1. **Expanded column aliases** — 7 canonical fields × 6-10 aliases each, covering Cal, Max, Isracard, Leumi Card, Amex Israel, and English exports

2. **Best-row header detection** — scans 30 rows, picks row with MOST alias matches (not just first with 2+)

3. **Robust data cleaning**:
   - Currency symbol stripping (₪, $, €, £, ¥)
   - Unicode control character removal (BOM, ZWJ, direction marks)
   - Case-insensitive matching for English headers
   - Excel serial date support (e.g., 45731 → 2025-03-15)
   - 8 date formats including 2-digit year
   - Non-breaking space handling in amounts

4. **Extended Transaction model** — added `billing_date`, `category`, `source_company`, `raw_row`

5. **Enhanced ParseResult diagnostics** — `detected_columns`, `missing_fields`, `raw_columns`, `header_row`

6. **Improved API error response** — when parsing fails, returns structured diagnostic JSON with detected columns, missing fields, and actionable hints

7. **Comprehensive test suite** — 39 unit tests covering:
   - Hebrew column variations (Cal, Max, Isracard)
   - Header not in first row
   - Amounts with ₪ and commas
   - Empty rows, missing optional fields
   - Multiple merchant column name variations
   - Excel serial dates
   - Diagnostics validation

### Test Results

```
54 passed, 0 failed (pytest — all backend modules)
39 parser tests, 8 classifier tests, 7 planner tests
Real file validation: 37/37 transactions parsed from 3.26.xlsx
```

---

## Bugs found

| # | Bug | Severity | Resolution |
|---|-----|----------|------------|
| 1 | Header row at index 0 assumption | Critical | Best-row auto-detection |
| 2 | Multi-line column headers | Critical | Whitespace normalisation |
| 3 | DateTime strings from Excel | Critical | Added format to list |
| 4 | 65% transactions uncategorized | High | Expanded rules + new categories |
| 5 | Case-sensitive English matching | Medium | Lowercase in _norm() |
| 6 | No diagnostics on parse failure | Medium | Structured error response |

---

## Key decisions made

- **DEC-009**: Multi-alias column mapping (provider-agnostic)
- **DEC-010**: Best-row header detection (highest match count)
- **DEC-011**: Case-insensitive column matching
- **DEC-012**: Extended Transaction model (billing_date, category, raw_row)

---

## Lessons learned

- **Always test with real data.** Sample data passed 100%, but real bank exports exposed 3 critical parsing bugs.
- **Israeli banks have wildly different formats.** The multi-alias approach is the right abstraction — adding a new provider is just adding strings, no code changes.
- **Error messages must be diagnostic.** "No transactions found" is useless. Showing which columns were detected and which are missing is actionable.
- **Best-row beats first-match** for header detection — title rows can coincidentally contain known words.

---

## Metrics

| Metric | Before | After Phase 1 | After Phase 2 |
|--------|--------|---------------|---------------|
| Providers supported | 1 (Cal only) | 1 (Cal only) | 6 (Cal, Max, Isracard, Leumi, Amex, English) |
| Column aliases | 5 | 5 | 50+ |
| Date formats | 4 | 5 | 8 + Excel serial |
| Unit tests (parser) | 8 | 8 | 39 |
| Unit tests (total) | 24 | 24 | 54 |
| Test file parse rate | 0/39 | 37/39 | 37/39 |
| Classification rate | 0% | 100% | 100% |
