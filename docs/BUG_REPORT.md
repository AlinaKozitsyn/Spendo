# Spendo Bug Report — 2026-04-29

Test file: `3.26.xlsx` (Israeli credit card statement, 39 data rows)

---

## 1. Parser: Header Row Not Auto-Detected [FIXED]

**Severity:** Critical — blocked all parsing
**Status:** Fixed

The Excel file has a title/summary section (rows 0-3) before the actual column headers at row 4. The parser defaulted to `header_row=0`, picking up the title as column names, so no columns matched.

**Fix applied:** Added `_detect_header_row()` in `backend/modules/excel_parser/src/parser.py` that scans the first 20 rows for known column headers from the alias table.

---

## 2. Parser: Newlines in Column Names [FIXED]

**Severity:** Critical — blocked column matching
**Status:** Fixed

Israeli bank exports use multi-line headers (e.g., `תאריך\nעסקה` instead of `תאריך עסקה`). The parser's `_normalise_columns()` only stripped whitespace but didn't collapse newlines.

**Fix applied:**
- Changed `_normalise_columns()` to collapse all whitespace (including `\n`, `\r`) into single spaces
- Replaced single-value `DEFAULT_COLUMN_MAP` with `COLUMN_ALIASES` — a multi-alias system where each canonical field maps to many possible Hebrew/English column names from different card providers (Cal, Max, Isracard)

---

## 3. Parser: DateTime String Not Recognized [FIXED]

**Severity:** Critical — all rows failed date parsing
**Status:** Fixed

Dates came as `"2026-02-27 00:00:00"` (datetime with time component). The parser only tried `%Y-%m-%d` (no time) and failed.

**Fix applied:** Added `"%Y-%m-%d %H:%M:%S"` to the date format list in `_require_date()`.

---

## 4. Parser: 2 Rows Skipped (Empty Summary Rows)

**Severity:** Low — expected behavior
**Status:** Not a bug

Rows 37-38 at the bottom of the file are empty/summary rows without merchant names. The parser correctly skips them.

```
Row 37: Missing required field 'merchant_name'
Row 38: Missing required field 'merchant_name'
```

---

## 5. Classifier: 24 of 37 Transactions Were Uncategorized (65%) [FIXED]

**Severity:** High — most transactions fell through to "Other"
**Status:** Fixed

Only 13/37 transactions were initially classified. The rule-based classifier lacked rules for common Israeli merchants.

**Fix applied:**
- Added new categories: `Donations`, `Software & Subscriptions`, `Office & Business`, `Events`
- Expanded keyword lists for `Groceries`, `Dining`, `Fuel & Transport`, `Entertainment`, `Transfers`
- Result: **37/37 transactions now classified (100%)**

### Full Classification Results After Fix:

| Merchant | Category |
|---|---|
| CARREFOUR קרית שרת רעננה | Groceries |
| מ. התחבורה - פנגו מוביט | Fuel & Transport |
| טיקצ'אק כרטיסים6565* | Entertainment |
| עמותת חיל האויר | Donations |
| כוורת (x3) | Dining |
| קפה נטו סבידור | Dining |
| מעיין 2000 בע"מ (x2) | Groceries |
| סעוד הראל -כללית | Health |
| פינת האופה רמות | Dining |
| MOVE | Fuel & Transport |
| שרותי בריאות כללית הו"ק (x2) | Health |
| כוכב הפרי והירק | Groceries |
| מאפיית הקריה | Dining |
| SpotifyIL | Entertainment |
| גולדה- קריית מלאכי | Dining |
| סופר פארם גרנד באר שבע | Groceries |
| סלקום שירות | Bills & Utilities |
| צפון ב"ש CARREFOUR CITY (x2) | Groceries |
| ביטוח לאומי ספק הוק (x2) | Bills & Utilities |
| גרין בוק אירועי מילואים | Events |
| אלטיאר ניהול (x2) | Office & Business |
| סיפורו של שניצל | Dining |
| APPLE.COM/BILL | Entertainment |
| לי אופיס בע"מ | Office & Business |
| חן מרקט | Groceries |
| CHOZEN | Dining |
| מ.א מכונות אוטומטיות | Office & Business |
| משקט | Dining |
| BIT | Transfers |
| OPENAI *CHATGPT SUBSCR | Software & Subscriptions |

---

## 6. Backend Not Running by Default

**Severity:** Medium — confusing UX
**Status:** Open (documentation issue)

The frontend shows "Bad Gateway" when the backend isn't running. There's no clear error message telling the user to start the backend server.

**Workaround:** Start backend manually:
```bash
cd Spendo
uvicorn backend.api.main:app --reload --port 8000
```

---

## Summary

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | Header row not auto-detected | Critical | Fixed |
| 2 | Newlines in column names | Critical | Fixed |
| 3 | DateTime format not recognized | Critical | Fixed |
| 4 | Empty summary rows skipped | Low | Not a bug |
| 5 | 65% transactions uncategorized | High | Fixed |
| 6 | No error message when backend is down | Medium | Open |
