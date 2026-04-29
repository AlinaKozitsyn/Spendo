# Parser Design — ExcelParserAgent

> Author: [CTO]
> Last updated: 2026-04-29

---

## Overview

The `ExcelParserAgent` is a robust, provider-agnostic parser for Israeli credit card Excel/CSV statements. It handles column name variations across providers, auto-detects header rows, cleans financial data, and returns structured `Transaction` objects with full diagnostics.

---

## Pipeline

```
┌─────────────────────────────────────────────────────┐
│                  Excel/CSV File                      │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Step 1: Read Workbook (openpyxl)                   │
│  - Load file as raw DataFrame                       │
│  - All cells read as strings (dtype=str)            │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Step 2: Auto-Detect Header Row                     │
│  - Scan first 30 rows                               │
│  - Pick row with MOST known alias matches           │
│  - Require >= 2 matches (avoid false positives)     │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Step 3: Normalise Column Names                     │
│  - Strip invisible Unicode chars (BOM, ZWJ, etc.)   │
│  - Collapse whitespace (\n, \r, \t → single space)  │
│  - Lowercase for case-insensitive matching           │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Step 4: Map Aliases → Canonical Fields             │
│  - Each field has 6-10 known Hebrew/English aliases  │
│  - First alias match per field wins                  │
│  - Report detected_columns + missing_fields          │
│  - STOP if required fields missing (don't parse)     │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Step 5: Parse & Clean Each Row                     │
│  - Dates: 8 formats + Excel serial dates             │
│  - Amounts: strip ₪/$, handle comma semantics        │
│  - Strings: strip, validate non-empty                │
│  - Capture raw_row for debugging                     │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Step 6: Validate & Skip Bad Rows                   │
│  - Required: transaction_date, merchant_name, amount │
│  - Skip row on failure, collect error message        │
│  - Never fail entire upload for individual bad rows  │
└───────────────────────┬─────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Step 7: Return ParseResult                         │
│  - transactions[]                                    │
│  - skipped_rows, errors[]                            │
│  - detected_columns, missing_fields                  │
│  - raw_columns, header_row                           │
└─────────────────────────────────────────────────────┘
```

---

## Supported Providers

| Provider | merchant_name column | amount column | date column |
|----------|---------------------|---------------|-------------|
| Cal (כאל) | שם בית עסק | סכום עסקה | תאריך עסקה |
| Max (מקס) | שם בית העסק | סכום העסקה | תאריך העסקה |
| Isracard | שם העסק | סכום חיוב | תאריך העסקה |
| Leumi Card | שם בית עסק | חיוב בש"ח | תאריך ביצוע |
| Amex Israel | תיאור עסקה | סכום | תאריך הקנייה |
| English exports | Merchant Name | Amount | Transaction Date |

---

## Column Alias System

Each canonical field maps to a priority-ordered list of aliases:

```python
COLUMN_ALIASES = {
    "transaction_date": ["תאריך עסקה", "תאריך העסקה", "תאריך רכישה", ...],
    "billing_date":     ["תאריך חיוב", "מועד חיוב", ...],
    "merchant_name":    ["שם בית עסק", "שם בית העסק", "שם העסק", ...],
    "amount":           ["סכום עסקה", "סכום העסקה", "סכום חיוב", ...],
    "category":         ["קטגוריה", "סוג עסקה", "ענף", ...],
    "description":      ["פירוט", "פרטים", "הערות", ...],
    "currency":         ["מטבע", "סוג מטבע", ...],
}
```

**How to add a new provider:**
1. Open a sample export
2. Note the exact column header text
3. Add each header to the appropriate alias list in `parser.py`
4. The parser normalises whitespace, so `"תאריך\nעסקה"` matches `"תאריך עסקה"`

---

## Transaction Model

```python
@dataclass(frozen=True)
class Transaction:
    transaction_id: str       # Deterministic hash (date|merchant|amount|row)
    transaction_date: date    # Required
    merchant_name: str        # Required
    amount: float             # Required, always positive
    currency: str = "ILS"
    billing_date: date = None # Optional (if provider includes it)
    category: str = None      # Optional (from provider's own categorisation)
    description: str = None   # Optional
    source_file: str = None   # Which file this came from
    source_company: str = None# Auto-detected provider name
    raw_row: dict = None      # Original row for debugging
```

---

## Data Cleaning Rules

### Dates
| Format | Example | Notes |
|--------|---------|-------|
| DD/MM/YYYY | 15/03/2025 | Israeli standard |
| DD-MM-YYYY | 15-03-2025 | |
| DD.MM.YYYY | 15.03.2025 | |
| YYYY-MM-DD | 2025-03-15 | ISO format |
| YYYY-MM-DD HH:MM:SS | 2025-03-15 00:00:00 | Excel datetime |
| DD/MM/YY | 15/03/25 | 2-digit year |
| Excel serial | 45731 | Days since 1899-12-30 |

### Amounts
- Strip currency symbols: ₪, $, €, £, ¥
- Remove non-breaking spaces (\u00a0) and RTL/LTR markers
- Handle comma: if both `,` and `.` present → comma is thousands separator; otherwise → decimal
- Always `abs()` — negative amounts become positive
- Strip any remaining non-numeric characters

### Strings
- Remove Unicode control characters (BOM, zero-width, direction marks)
- Collapse all whitespace to single spaces
- Strip leading/trailing whitespace

---

## Error Handling Strategy

| Scope | Behavior |
|-------|----------|
| File-level (can't read) | Return empty ParseResult with FATAL error |
| Column-level (required field missing) | Return empty ParseResult with diagnostic info |
| Row-level (bad data) | Skip row, add to errors[], continue parsing |
| Field-level (optional missing) | Use default value, continue |

**Key principle:** Never fail the entire upload because of a few bad rows.

---

## ParseResult Diagnostics

When no transactions are found, the API returns:

```json
{
  "message": "No transactions could be parsed from the uploaded file.",
  "header_row_detected": 4,
  "columns_in_file": ["תאריך עסקה", "שם בית עסק", "unknown_col"],
  "columns_matched": {"transaction_date": "תאריך עסקה", "merchant_name": "שם בית עסק"},
  "required_fields_missing": ["amount"],
  "row_errors": ["Row 0: Missing required field 'amount'"],
  "hint": "The file columns could not be mapped to the required fields..."
}
```

---

## Test Coverage

39 unit tests covering:

| Category | Tests | What's covered |
|----------|-------|---------------|
| Happy path | 5 | Single row, multiple rows, deterministic IDs, raw_row |
| Hebrew variations | 7 | Cal, Max, Isracard, English, billing_date, category |
| Header detection | 3 | Row 4, row 0 fallback, best-row selection |
| Amount parsing | 6 | ₪ symbol, commas, negative, dollar, non-breaking space |
| Date parsing | 6 | DD/MM/YYYY, DD.MM.YYYY, ISO, datetime, 2-digit year, Excel serial |
| Error handling | 6 | Missing fields, bad data, empty rows, fatal errors |
| Diagnostics | 4 | detected_columns, raw_columns, missing_fields |
| Normalisation | 2 | Newlines, extra spaces |
