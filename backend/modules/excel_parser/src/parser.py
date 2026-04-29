"""
excel_parser/src/parser.py
==========================
ExcelParserAgent — Robust Excel/CSV parser for Israeli credit card statements.

RESPONSIBILITY (Single Responsibility Principle):
  Extract raw transaction rows from a credit-card Excel report and convert
  them into a list of canonical `Transaction` objects.

  This module does NOT classify, store, or analyse the transactions.
  Its only job is to read → validate → normalise → return.

SUPPORTED FORMATS:
  Israeli credit-card exports from:
    • Cal (כאל)
    • Max (מקס / לאומי קארד)
    • Isracard (ישראכארט)
    • Visa CAL
    • Leumi Card
    • Amex Israel
  Column names vary per provider; the COLUMN_ALIASES table handles the
  mapping without code changes. Header rows are auto-detected.

PIPELINE:
  1. Read workbook (openpyxl)
  2. Detect sheet (first sheet by default)
  3. Auto-detect header row (scan for known aliases)
  4. Normalise column names (collapse whitespace, strip invisible chars)
  5. Map aliases → canonical field names
  6. Parse and clean each row (dates, amounts, strings)
  7. Validate required fields per row
  8. Return ParseResult with transactions + warnings

DEPENDENCIES:
  - openpyxl  (reading .xlsx)
  - pandas    (tabular data wrangling)
  - shared.models (Transaction, ParseResult)
"""

import hashlib
import logging
import re
import unicodedata
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from backend.modules.shared.src import ParseResult, Transaction

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Column aliases — maps each canonical field to ALL known Hebrew/English
# column headers used by Israeli credit card providers.
#
# HOW TO ADD A NEW PROVIDER:
#   1. Open a sample export from the provider.
#   2. Note the exact column header text (including any newlines).
#   3. Add each header as a new alias in the appropriate field list below.
#   4. The parser normalises whitespace, so "תאריך\nעסקה" matches "תאריך עסקה".
#
# ORDER MATTERS: more specific aliases should come before generic ones.
# The first alias that matches a column wins.
# ---------------------------------------------------------------------------

COLUMN_ALIASES: dict[str, list[str]] = {
    "transaction_date": [
        # Hebrew — specific
        "תאריך עסקה",              # Cal, Max
        "תאריך העסקה",             # Isracard
        "תאריך רכישה",             # Visa exports
        "תאריך ביצוע",             # Leumi Card
        "תאריך הקנייה",            # Amex
        # Hebrew — generic (lower priority)
        "תאריך",                   # Fallback: any "date" column
        # English
        "transaction date",
        "purchase date",
        "date",
    ],
    "billing_date": [
        # Hebrew
        "תאריך חיוב",              # Cal, Max
        "מועד חיוב",               # Isracard
        "תאריך חשבון",             # Leumi Card
        "תאריך ערך",               # Bank: value date
        # English
        "billing date",
        "charge date",
        "value date",
    ],
    "merchant_name": [
        # Hebrew — specific (credit card)
        "שם בית עסק",              # Cal
        "שם בית העסק",             # Max
        "שם העסק",                 # Isracard
        "שם ספק",                  # Some providers
        "פרטי עסקה",               # Transaction details (used as merchant)
        "תיאור עסקה",              # Transaction description (used as merchant)
        # Hebrew — bank statements
        "הפעולה",                  # Bank: operation name (serves as merchant)
        # Hebrew — generic
        "בית עסק",                 # Short form
        "תיאור",                   # Generic "description"
        # English
        "merchant name",
        "merchant",
        "business name",
        "description",
    ],
    "amount": [
        # Hebrew — specific (credit card)
        "סכום עסקה",               # Cal
        "סכום העסקה",              # Max
        "סכום חיוב",               # Charge amount
        'חיוב בש"ח',               # Charge in ILS (with quotes)
        "חיוב בשח",                # Charge in ILS (no quotes)
        "סכום בש\"ח",              # Amount in ILS (escaped)
        # Hebrew — bank statements
        "חובה",                    # Bank: debit column
        # Hebrew — generic
        "סכום",                    # Fallback: any "amount" column
        # English
        "amount",
        "total",
        "sum",
        "charge amount",
        "debit",
    ],
    "category": [
        # Hebrew
        "קטגוריה",                 # Category
        "סוג עסקה",               # Transaction type
        "ענף",                     # Branch/sector (often = category)
        # English
        "category",
        "type",
    ],
    "description": [
        # Hebrew
        "פירוט",                   # Cal
        "פרטים",                   # Max
        "הערות",                   # Notes
        "מידע נוסף",               # Additional info
        # English
        "details",
        "notes",
        "remarks",
    ],
    "currency": [
        # Hebrew
        "מטבע",                    # Cal, Max
        "סוג מטבע",                # Currency type
        # English
        "currency",
    ],
}


# ---------------------------------------------------------------------------
# Required fields — the parser will fail a row if any of these are missing.
# All other fields in COLUMN_ALIASES are optional.
# ---------------------------------------------------------------------------

REQUIRED_FIELDS = {"transaction_date", "merchant_name", "amount"}


# Generic semantic profiles used when exact aliases do not match. These are
# schema-level signals only; they are not merchant/category classification rules.
FIELD_PROFILES: dict[str, dict[str, list[str]]] = {
    "transaction_date": {
        "any": ["date", "day", "posted", "תאריך", "יום"],
        "positive": ["transaction", "purchase", "posted", "עסקה", "רכישה", "ביצוע", "קניה", "קנייה"],
        "negative": ["billing", "charge", "value", "חיוב", "ערך", "יתרה"],
    },
    "billing_date": {
        "any": ["date", "תאריך"],
        "positive": ["billing", "charge", "value", "חיוב", "ערך", "חשבון"],
        "negative": ["transaction", "purchase", "עסקה", "רכישה"],
    },
    "merchant_name": {
        "any": [
            "merchant", "business", "supplier", "vendor", "description", "details",
            "בית עסק", "שם העסק", "שם בית", "ספק", "תיאור", "פרטים", "הפעולה", "פעולה",
        ],
        "positive": ["name", "שם", "merchant", "business", "supplier", "vendor", "עסק", "ספק"],
        "negative": ["date", "amount", "total", "balance", "תאריך", "סכום", "יתרה", "זכות", "חובה"],
    },
    "amount": {
        "any": ["amount", "sum", "total", "debit", "charge", "סכום", "חיוב", "חובה"],
        "positive": ["amount", "sum", "total", "debit", "charge", "ils", "שח", "ש\"ח", "₪", "סכום", "חיוב", "חובה"],
        "negative": ["date", "balance", "credit", "תאריך", "יתרה", "זכות"],
    },
    "category": {
        "any": ["category", "type", "sector", "קטגוריה", "סוג", "ענף"],
        "positive": ["category", "type", "sector", "קטגוריה", "סוג", "ענף"],
        "negative": ["date", "amount", "תאריך", "סכום"],
    },
    "description": {
        "any": ["details", "notes", "remarks", "description", "memo", "פירוט", "פרטים", "הערות", "מידע"],
        "positive": ["details", "notes", "remarks", "memo", "פירוט", "פרטים", "הערות", "מידע"],
        "negative": ["date", "amount", "תאריך", "סכום"],
    },
    "currency": {
        "any": ["currency", "coin", "מטבע"],
        "positive": ["currency", "coin", "מטבע"],
        "negative": ["date", "amount", "תאריך", "סכום"],
    },
}

FIELD_MATCH_THRESHOLDS: dict[str, int] = {
    "transaction_date": 6,
    "billing_date": 6,
    "merchant_name": 5,
    "amount": 5,
    "category": 5,
    "description": 5,
    "currency": 5,
}


class ExcelParserAgent:
    """
    Parses a single credit-card Excel/CSV file into a ParseResult.

    Pipeline:
        1. Read workbook → detect sheet
        2. Auto-detect header row (scan for known aliases)
        3. Normalise column names (strip, collapse whitespace, remove invisible chars)
        4. Map aliases → canonical field names
        5. Parse and clean each row
        6. Validate required fields per row
        7. Return ParseResult with transactions + diagnostics

    Usage:
        agent = ExcelParserAgent(file_path="path/to/report.xlsx")
        result: ParseResult = agent.parse()
    """

    def __init__(
        self,
        file_path: str | Path,
        column_aliases: Optional[dict[str, list[str]]] = None,
        sheet_name: int | str = 0,
        header_row: Optional[int] = None,
    ) -> None:
        self.file_path = Path(file_path)
        self.column_aliases = column_aliases or COLUMN_ALIASES
        self.sheet_name = sheet_name
        # None = auto-detect; explicit int = use that row
        self._explicit_header_row = header_row

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse(self) -> ParseResult:
        """
        Entry point. Reads the Excel file and returns a ParseResult.

        Returns:
            ParseResult with all successfully parsed transactions,
            plus diagnostics (detected_columns, missing_fields, raw_columns).
        """
        result = ParseResult(source_file=str(self.file_path))

        logger.info("ExcelParserAgent: reading %s", self.file_path)

        # --- Step 1-2: Load and detect header ---
        try:
            df, header_idx = self._load_dataframe()
            result.header_row = header_idx
        except Exception as exc:
            logger.error("Failed to load Excel file: %s", exc)
            result.errors.append(f"FATAL: Could not read file — {exc}")
            return result

        # --- Step 3-4: Normalise and map columns ---
        raw_cols = list(df.columns.map(lambda c: self._norm(str(c))))
        result.raw_columns = raw_cols
        raw_df = df.copy()
        raw_df.columns = raw_cols

        df, rename_map = self._normalise_columns(df)
        df["__raw_fields"] = raw_df.apply(
            lambda raw_row: {k: v for k, v in raw_row.items() if pd.notna(v)},
            axis=1,
        )
        result.detected_columns = {v: k for k, v in rename_map.items()}

        # Check for missing required fields
        mapped_fields = set(rename_map.values())
        result.missing_fields = sorted(REQUIRED_FIELDS - mapped_fields)

        if result.missing_fields:
            msg = (
                f"Could not find required columns: {result.missing_fields}. "
                f"Detected columns in file: {raw_cols}. "
                f"Matched: {result.detected_columns}"
            )
            logger.warning(msg)
            result.errors.append(msg)
            return result

        # --- Step 5-7: Parse rows ---
        for idx, row in df.iterrows():
            try:
                txn = self._parse_row(row, idx, str(self.file_path))
                result.transactions.append(txn)
            except (ValueError, KeyError) as exc:
                result.skipped_rows += 1
                result.errors.append(f"Row {idx}: {exc}")

        logger.info(
            "ExcelParserAgent: parsed %d transactions, skipped %d rows",
            len(result.transactions),
            result.skipped_rows,
        )
        return result

    # ------------------------------------------------------------------
    # Step 1-2: Load workbook and detect header
    # ------------------------------------------------------------------

    def _load_dataframe(self) -> tuple[pd.DataFrame, int]:
        """
        Loads the Excel file and returns (DataFrame, header_row_index).

        If no explicit header_row was given, auto-detects by scanning
        for the row with the most known alias matches.
        """
        if self._explicit_header_row is not None:
            header = self._explicit_header_row
        else:
            header = self._detect_header_row()

        df = pd.read_excel(
            self.file_path,
            sheet_name=self.sheet_name,
            header=header,
            dtype=str,
            engine="openpyxl",
        )
        return df, header

    def _detect_header_row(self) -> int:
        """
        Scans the first 30 rows and picks the row with the MOST matches
        against known column aliases. Requires at least 2 matches.

        This is more robust than "first row with 2+ matches" because it
        handles files where a title row might coincidentally contain a
        known word. The row with the most matches is most likely the header.
        """
        try:
            df_raw = pd.read_excel(
                self.file_path,
                sheet_name=self.sheet_name,
                header=None,
                nrows=30,
                dtype=str,
                engine="openpyxl",
            )
        except Exception as exc:
            logger.warning("Header auto-detection failed: %s", exc)
            return 0

        best_idx = 0
        best_score = 0
        best_required_fields = 0

        for idx, row in df_raw.iterrows():
            cells = [
                self._norm(str(v))
                for v in row.values
                if pd.notna(v)
            ]
            score, required_fields = self._score_header_row(cells)
            if (required_fields, score) > (best_required_fields, best_score):
                best_required_fields = required_fields
                best_score = score
                best_idx = int(idx)

        if best_required_fields >= 2:
            logger.info(
                "Auto-detected header row at index %d (score=%d, required_fields=%d)",
                best_idx, best_score, best_required_fields,
            )
            return best_idx

        logger.warning("No header row found with >= 2 required field matches; defaulting to row 0")
        return 0

    def _score_header_row(self, cells: list[str]) -> tuple[int, int]:
        """Score a candidate header row by generic field matches."""
        matched_required = set()
        total_score = 0
        for cell in cells:
            field, score = self._best_field_for_column(cell)
            if field:
                total_score += score
                if field in REQUIRED_FIELDS:
                    matched_required.add(field)
        return total_score, len(matched_required)

    # ------------------------------------------------------------------
    # Step 3-4: Normalise and map columns
    # ------------------------------------------------------------------

    @staticmethod
    def _norm(s: str) -> str:
        """
        Normalise a string for column matching:
        - Strip Unicode control characters and invisible chars
        - Collapse all whitespace (newlines, tabs, etc.) to single space
        - Strip leading/trailing whitespace
        - Lowercase for case-insensitive English matching
          (Hebrew has no case, so this only affects English headers)
        """
        # Remove zero-width chars, BOM, direction marks, etc.
        cleaned = "".join(
            c for c in s
            if unicodedata.category(c)[0] != "C" or c in ("\n", "\r", "\t")
        )
        return re.sub(r"\s+", " ", cleaned).strip().lower()

    def _normalise_columns_legacy(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str]]:
        """
        Renames raw Excel column headers to canonical field names using
        the alias table. Returns (modified_df, rename_map).

        The rename_map is {raw_normalised_col: canonical_field_name}.
        """
        df.columns = df.columns.map(lambda c: self._norm(str(c)))

        # Build reverse map: normalised alias → canonical field name
        reverse_map: dict[str, str] = {}
        for canonical, aliases in self.column_aliases.items():
            for alias in aliases:
                normed = self._norm(alias)
                if normed not in reverse_map:
                    reverse_map[normed] = canonical

        # Match columns — first match per canonical field wins
        rename_map: dict[str, str] = {}
        for col in df.columns:
            if col in reverse_map and reverse_map[col] not in rename_map.values():
                rename_map[col] = reverse_map[col]

        if not rename_map:
            logger.warning(
                "No columns matched any known alias. Raw columns: %s",
                list(df.columns),
            )
            return df, rename_map

        df = df[list(rename_map.keys())].rename(columns=rename_map)
        logger.info("Mapped columns: %s", {v: k for k, v in rename_map.items()})

        return df, rename_map

    def _normalise_columns(self, df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str]]:
        """
        Map raw Excel columns into canonical fields.

        Exact aliases are preferred, then generic schema heuristics are used.
        Unmapped columns are preserved in raw_row so classification can still
        use the original Excel context.
        """
        df.columns = df.columns.map(lambda c: self._norm(str(c)))

        candidates: list[tuple[int, str, str]] = []
        for col in df.columns:
            field, score = self._best_field_for_column(col)
            if field:
                candidates.append((score, col, field))

        rename_map: dict[str, str] = {}
        used_fields: set[str] = set()
        used_cols: set[str] = set()
        for score, col, field in sorted(candidates, reverse=True):
            if col in used_cols or field in used_fields:
                continue
            if score < FIELD_MATCH_THRESHOLDS.get(field, 5):
                continue
            rename_map[col] = field
            used_cols.add(col)
            used_fields.add(field)

        if not rename_map:
            logger.warning(
                "No columns matched any known schema signal. Raw columns: %s",
                list(df.columns),
            )
            return df, rename_map

        df = df.rename(columns=rename_map)
        logger.info("Mapped columns: %s", {v: k for k, v in rename_map.items()})

        return df, rename_map

    def _best_field_for_column(self, column_name: str) -> tuple[Optional[str], int]:
        """Return the best canonical field match for a normalized column name."""
        exact = self._exact_alias_field(column_name)
        if exact:
            return exact, 100

        best_field: Optional[str] = None
        best_score = 0
        for field, profile in FIELD_PROFILES.items():
            score = self._score_column_for_field(column_name, profile)
            if score > best_score:
                best_field = field
                best_score = score

        return best_field, best_score

    def _exact_alias_field(self, column_name: str) -> Optional[str]:
        for canonical, aliases in self.column_aliases.items():
            for alias in aliases:
                if column_name == self._norm(alias):
                    return canonical
        return None

    @staticmethod
    def _score_column_for_field(column_name: str, profile: dict[str, list[str]]) -> int:
        score = 0
        for token in profile.get("any", []):
            if token in column_name:
                score += 4
        for token in profile.get("positive", []):
            if token in column_name:
                score += 3
        for token in profile.get("negative", []):
            if token in column_name:
                score -= 5
        return score

    # ------------------------------------------------------------------
    # Step 5-6: Parse individual rows
    # ------------------------------------------------------------------

    def _parse_row(self, row: pd.Series, row_idx: int, source_file: str) -> Transaction:
        """
        Converts a single normalised DataFrame row into a Transaction.

        Raises ValueError if a required field is missing or unparseable.
        """
        merchant = self._require_str(row, "merchant_name", row_idx)
        amount = self._parse_amount(row, "amount", row_idx)
        txn_date = self._parse_date(row, "transaction_date", row_idx)

        # Optional fields
        billing_date = self._parse_date_optional(row, "billing_date")
        category = self._get_optional_str(row, "category")
        description = self._get_optional_str(row, "description")

        currency = self._get_optional_str(row, "currency") or "ILS"

        # Capture raw row for debugging / manual correction UI
        raw_row = row.get("__raw_fields")
        if not isinstance(raw_row, dict):
            raw_row = {k: v for k, v in row.items() if pd.notna(v) and k != "__raw_fields"}

        txn_id = self._generate_id(txn_date, merchant, amount, row_idx)

        return Transaction(
            transaction_id=txn_id,
            transaction_date=txn_date,
            merchant_name=merchant.strip(),
            amount=amount,
            currency=currency.strip(),
            billing_date=billing_date,
            category=category,
            description=description.strip() if description else None,
            source_file=source_file,
            raw_row=raw_row,
        )

    # ------------------------------------------------------------------
    # Field extraction helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _require_str(row: pd.Series, field: str, row_idx: int) -> str:
        """Extracts a mandatory string field; raises ValueError if blank."""
        val = row.get(field)
        if val is None or pd.isna(val) or str(val).strip() == "":
            raise ValueError(f"Missing required field '{field}'")
        return str(val)

    @staticmethod
    def _get_optional_str(row: pd.Series, field: str) -> Optional[str]:
        """Extracts an optional string field; returns None if missing/blank."""
        val = row.get(field)
        if val is None or pd.isna(val) or str(val).strip() == "":
            return None
        return str(val).strip()

    @staticmethod
    def _parse_amount(row: pd.Series, field: str, row_idx: int) -> float:
        """
        Extracts a mandatory numeric field with robust cleaning:
        - Strips currency symbols (₪, $, €, etc.)
        - Removes non-breaking spaces, invisible chars
        - Handles comma as thousands separator OR decimal separator
        - Always returns abs() (positive amounts)
        """
        val = row.get(field)
        if val is None or pd.isna(val):
            raise ValueError(f"Missing required field '{field}'")
        try:
            cleaned = str(val)
            # Remove currency symbols, non-breaking spaces, invisible chars
            cleaned = re.sub(r"[₪$€£¥\u00a0\u200e\u200f\u202a-\u202e]", "", cleaned)
            cleaned = cleaned.strip()
            # Handle thousands/decimal separators
            if "," in cleaned and "." in cleaned:
                cleaned = cleaned.replace(",", "")  # comma is thousands sep
            else:
                cleaned = cleaned.replace(",", ".")  # comma is decimal sep
            # Remove any remaining non-numeric chars except . and -
            cleaned = re.sub(r"[^\d.\-]", "", cleaned)
            return abs(float(cleaned))
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Cannot parse '{field}' as number: {val!r}") from exc

    @staticmethod
    def _parse_date(row: pd.Series, field: str, row_idx: int) -> date:
        """
        Extracts a mandatory date field. Handles:
        - datetime/date objects
        - Common Israeli string formats (DD/MM/YYYY, DD.MM.YYYY, etc.)
        - ISO format (YYYY-MM-DD) with optional time
        - Excel serial date numbers (e.g. 44927 = 2023-01-01)
        """
        val = row.get(field)
        if val is None or pd.isna(val):
            raise ValueError(f"Missing required field '{field}'")
        return ExcelParserAgent._convert_to_date(val, field)

    @staticmethod
    def _parse_date_optional(row: pd.Series, field: str) -> Optional[date]:
        """Extracts an optional date field; returns None if missing/unparseable."""
        val = row.get(field)
        if val is None or pd.isna(val) or str(val).strip() == "":
            return None
        try:
            return ExcelParserAgent._convert_to_date(val, field)
        except ValueError:
            return None

    @staticmethod
    def _convert_to_date(val, field: str) -> date:
        """Core date conversion logic shared by required and optional paths."""
        if isinstance(val, datetime):
            return val.date()
        if isinstance(val, date):
            return val

        s = str(val).strip()

        # Try Excel serial date number (e.g., "44927")
        try:
            serial = float(s)
            if 1 < serial < 200000:  # sanity range for Excel dates
                # Excel epoch: 1899-12-30 (accounting for the 1900 leap year bug)
                return datetime(1899, 12, 30).date() + pd.Timedelta(days=int(serial))
        except (ValueError, OverflowError):
            pass

        # Try common string formats
        for fmt in (
            "%d/%m/%Y",         # 01/03/2025  (Israeli standard)
            "%d-%m-%Y",         # 01-03-2025
            "%d.%m.%Y",         # 01.03.2025
            "%Y-%m-%d",         # 2025-03-01  (ISO)
            "%Y-%m-%d %H:%M:%S",  # 2025-03-01 00:00:00 (Excel datetime)
            "%d/%m/%y",         # 01/03/25   (2-digit year)
            "%d-%m-%y",         # 01-03-25
            "%d.%m.%y",         # 01.03.25
        ):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue

        raise ValueError(f"Cannot parse '{field}' as date: {val!r}")

    @staticmethod
    def _generate_id(txn_date: date, merchant: str, amount: float, row_idx: int) -> str:
        """
        Generates a short, deterministic transaction ID.

        WHY deterministic? If the user re-uploads the same Excel file,
        we can detect and skip duplicates without a database primary key.
        """
        raw = f"{txn_date.isoformat()}|{merchant}|{amount:.2f}|{row_idx}"
        return hashlib.sha1(raw.encode()).hexdigest()[:12]
