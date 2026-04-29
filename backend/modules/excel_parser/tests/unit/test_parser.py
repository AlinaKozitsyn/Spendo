"""
tests/unit/test_parser.py
=========================
Unit tests for ExcelParserAgent.

Strategy:
  - We do NOT use real Excel files in unit tests (slow, fragile).
  - Instead we mock pandas.read_excel to return a controlled DataFrame.
  - This tests all parsing/validation logic without touching the filesystem.

Run with:
    pytest backend/modules/excel_parser/tests/unit/
"""

import pytest
import pandas as pd
from datetime import date
from unittest.mock import patch, MagicMock

from backend.modules.excel_parser.src.parser import ExcelParserAgent, DEFAULT_COLUMN_MAP


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def make_df(**overrides) -> pd.DataFrame:
    """
    Build a minimal, valid one-row DataFrame that the parser can consume.
    Pass keyword args to override any column value.
    """
    row = {
        "תאריך עסקה": "01/03/2025",
        "שם בית עסק": "רמי לוי",
        "סכום עסקה":  "250.50",
        "פירוט":      "קנייה",
        "מטבע":       "ILS",
    }
    row.update(overrides)
    return pd.DataFrame([row])


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------

class TestExcelParserHappyPath:

    def test_single_valid_row(self):
        """A clean row produces exactly one Transaction with correct fields."""
        with patch("pandas.read_excel", return_value=make_df()):
            agent = ExcelParserAgent("dummy.xlsx")
            result = agent.parse()

        assert len(result.transactions) == 1
        assert result.skipped_rows == 0
        txn = result.transactions[0]
        assert txn.merchant_name == "רמי לוי"
        assert txn.amount == 250.50
        assert txn.transaction_date == date(2025, 3, 1)
        assert txn.currency == "ILS"

    def test_amount_is_always_positive(self):
        """Negative amounts from the Excel (credit notes) should be abs()-ed."""
        with patch("pandas.read_excel", return_value=make_df(**{"סכום עסקה": "-150.00"})):
            agent = ExcelParserAgent("dummy.xlsx")
            result = agent.parse()
        assert result.transactions[0].amount == 150.00

    def test_comma_decimal_separator(self):
        """Israeli exports often use comma as decimal separator."""
        with patch("pandas.read_excel", return_value=make_df(**{"סכום עסקה": "1,234.50"})):
            agent = ExcelParserAgent("dummy.xlsx")
            result = agent.parse()
        assert result.transactions[0].amount == pytest.approx(1234.50)

    def test_transaction_id_is_deterministic(self):
        """Same row data should always produce the same transaction_id."""
        df = make_df()
        with patch("pandas.read_excel", return_value=df):
            r1 = ExcelParserAgent("dummy.xlsx").parse()
        with patch("pandas.read_excel", return_value=df):
            r2 = ExcelParserAgent("dummy.xlsx").parse()
        assert r1.transactions[0].transaction_id == r2.transactions[0].transaction_id

    def test_multiple_rows(self):
        """Parser handles multiple rows and returns all of them."""
        rows = {
            "תאריך עסקה": ["01/03/2025", "02/03/2025"],
            "שם בית עסק": ["רמי לוי", "מקדונלד"],
            "סכום עסקה":  ["100", "50"],
            "פירוט":      ["a", "b"],
            "מטבע":       ["ILS", "ILS"],
        }
        df = pd.DataFrame(rows)
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx").parse()
        assert len(result.transactions) == 2


# ---------------------------------------------------------------------------
# Error-handling tests
# ---------------------------------------------------------------------------

class TestExcelParserErrors:

    def test_missing_merchant_skips_row(self):
        """A row with no merchant name is skipped gracefully."""
        with patch("pandas.read_excel", return_value=make_df(**{"שם בית עסק": None})):
            result = ExcelParserAgent("dummy.xlsx").parse()
        assert len(result.transactions) == 0
        assert result.skipped_rows == 1
        assert len(result.errors) == 1

    def test_bad_amount_skips_row(self):
        """A row with a non-numeric amount is skipped."""
        with patch("pandas.read_excel", return_value=make_df(**{"סכום עסקה": "N/A"})):
            result = ExcelParserAgent("dummy.xlsx").parse()
        assert result.skipped_rows == 1

    def test_bad_date_skips_row(self):
        """A row with an unparseable date is skipped."""
        with patch("pandas.read_excel", return_value=make_df(**{"תאריך עסקה": "not-a-date"})):
            result = ExcelParserAgent("dummy.xlsx").parse()
        assert result.skipped_rows == 1

    def test_fatal_load_error_returns_empty_result(self):
        """If the file cannot be read at all, return a ParseResult with error."""
        with patch("pandas.read_excel", side_effect=FileNotFoundError("no file")):
            result = ExcelParserAgent("missing.xlsx").parse()
        assert len(result.transactions) == 0
        assert any("FATAL" in e for e in result.errors)
