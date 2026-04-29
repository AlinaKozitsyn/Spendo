"""
excel_parser/src/parser.py
==========================
ExcelParserAgent — Agent #1

RESPONSIBILITY (Single Responsibility Principle):
  Extract raw transaction rows from a credit-card Excel report and convert
  them into a list of canonical `Transaction` objects.

  This module does NOT classify, store, or analyse the transactions.
  Its only job is to read → validate → normalise → return.

SUPPORTED FORMATS:
  Israeli credit-card exports typically come from:
    • Cal (כאל)
    • Max (מקס / לאומי קארד)
    • Visa CAL
  Column names vary per bank; the ColumnMap config (config/column_maps.yaml)
  handles the mapping without code changes.

DEPENDENCIES:
  - openpyxl  (reading .xlsx)
  - pandas    (tabular data wrangling)
  - shared.models (Transaction, ParseResult)
"""

import hashlib
import logging
from datetime import date, datetime
from pathlib import Path
from typing import Optional

import pandas as pd

from backend.modules.shared.src import ParseResult, Transaction

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Column map — tells the parser which Excel column maps to which field.
# The dict key is our canonical field name; the value is the Excel header.
# Override by passing a custom column_map to ExcelParserAgent.__init__().
# ---------------------------------------------------------------------------

DEFAULT_COLUMN_MAP: dict[str, str] = {
    "transaction_date": "תאריך עסקה",   # "Transaction date" in Hebrew
    "merchant_name":    "שם בית עסק",   # "Merchant name"
    "amount":           "סכום עסקה",    # "Transaction amount"
    "description":      "פירוט",        # "Details" (optional column)
    "currency":         "מטבע",         # "Currency"  (optional column)
}


class ExcelParserAgent:
    """
    Parses a single credit-card Excel file into a ParseResult.

    Usage:
        agent = ExcelParserAgent(file_path="path/to/report.xlsx")
        result: ParseResult = agent.parse()

    Args:
        file_path:   Path to the .xlsx file to parse.
        column_map:  Optional override of DEFAULT_COLUMN_MAP.
                     Use this when the bank uses different column headers.
        sheet_name:  Name or index of the Excel sheet. Defaults to the first sheet.
        header_row:  0-based row index where the column headers live. Default 0.
    """

    def __init__(
        self,
        file_path: str | Path,
        column_map: Optional[dict[str, str]] = None,
        sheet_name: int | str = 0,
        header_row: int = 0,
    ) -> None:
        self.file_path  = Path(file_path)
        self.column_map = column_map or DEFAULT_COLUMN_MAP
        self.sheet_name = sheet_name
        self.header_row = header_row

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def parse(self) -> ParseResult:
        """
        Entry point. Reads the Excel file and returns a ParseResult.

        Returns:
            ParseResult with all successfully parsed transactions,
            plus counts and error messages for any rows that failed.
        """
        result = ParseResult(source_file=str(self.file_path))

        logger.info("ExcelParserAgent: reading %s", self.file_path)

        try:
            df = self._load_dataframe()
        except Exception as exc:
            # A load-level failure is fatal — return an empty result with the error.
            logger.error("Failed to load Excel file: %s", exc)
            result.errors.append(f"FATAL: Could not read file — {exc}")
            return result

        df = self._normalise_columns(df)

        for idx, row in df.iterrows():
            try:
                txn = self._parse_row(row, idx, str(self.file_path))
                result.transactions.append(txn)
            except (ValueError, KeyError) as exc:
                # Row-level failure is non-fatal — log it and move on.
                result.skipped_rows += 1
                result.errors.append(f"Row {idx}: {exc}")

        logger.info(
            "ExcelParserAgent: parsed %d transactions, skipped %d rows",
            len(result.transactions),
            result.skipped_rows,
        )
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _load_dataframe(self) -> pd.DataFrame:
        """
        Loads the target sheet from the Excel file into a Pandas DataFrame.

        WHY: openpyxl is used under the hood by pandas read_excel.
        We delegate sheet selection and header detection to pandas.
        """
        return pd.read_excel(
            self.file_path,
            sheet_name=self.sheet_name,
            header=self.header_row,
            dtype=str,          # Read everything as strings; we cast per-field later.
            engine="openpyxl",
        )

    def _normalise_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Renames the raw Excel column headers to our canonical field names
        using self.column_map.

        Only columns present in the map are kept; the rest are dropped.
        This makes downstream row parsing independent of the source format.
        """
        # Invert the map: Excel header → canonical name
        reverse_map = {v: k for k, v in self.column_map.items()}

        # Strip whitespace from column names (common in Israeli bank exports)
        df.columns = df.columns.str.strip()

        # Keep only columns we care about
        available = {col: reverse_map[col] for col in df.columns if col in reverse_map}
        df = df[list(available.keys())].rename(columns=available)

        return df

    def _parse_row(self, row: pd.Series, row_idx: int, source_file: str) -> Transaction:
        """
        Converts a single normalised DataFrame row into a Transaction.

        Raises:
            ValueError: if a required field is missing or cannot be parsed.
            KeyError:   if a required column is absent from the row.
        """
        merchant = self._require_str(row, "merchant_name", row_idx)
        amount   = self._require_float(row, "amount", row_idx)
        txn_date = self._require_date(row, "transaction_date", row_idx)

        # Optional fields — default gracefully
        description = row.get("description", None)
        if pd.isna(description):
            description = None

        currency = row.get("currency", "ILS")
        if pd.isna(currency):
            currency = "ILS"

        # Generate a stable, deterministic ID from the row's content.
        # WHY: Excel files have no built-in PK; we need something repeatable
        # so re-importing the same file doesn't create duplicates.
        txn_id = self._generate_id(txn_date, merchant, amount, row_idx)

        return Transaction(
            transaction_id=txn_id,
            transaction_date=txn_date,
            merchant_name=merchant.strip(),
            amount=amount,
            currency=str(currency).strip(),
            description=str(description).strip() if description else None,
            source_file=source_file,
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
    def _require_float(row: pd.Series, field: str, row_idx: int) -> float:
        """Extracts a mandatory numeric field; raises ValueError if non-numeric."""
        val = row.get(field)
        if val is None or pd.isna(val):
            raise ValueError(f"Missing required field '{field}'")
        try:
            # Israeli reports sometimes use ',' as decimal separator
            cleaned = str(val).replace(",", ".").replace("\xa0", "").strip()
            return abs(float(cleaned))   # abs() — we always store positive amounts
        except (ValueError, TypeError) as exc:
            raise ValueError(f"Cannot parse '{field}' as number: {val!r}") from exc

    @staticmethod
    def _require_date(row: pd.Series, field: str, row_idx: int) -> date:
        """Extracts a mandatory date field; tries multiple common formats."""
        val = row.get(field)
        if val is None or pd.isna(val):
            raise ValueError(f"Missing required field '{field}'")

        if isinstance(val, (datetime, date)):
            return val if isinstance(val, date) else val.date()

        # Try common Israeli date formats
        for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%d.%m.%Y"):
            try:
                return datetime.strptime(str(val).strip(), fmt).date()
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
