"""
tests/unit/test_parser.py
=========================
Unit tests for ExcelParserAgent — robust Israeli credit card parsing.

Coverage:
  - Happy path: single row, multiple rows, deterministic IDs
  - Hebrew columns from different providers (Cal, Max, Isracard)
  - Header not in first row (title rows above data)
  - Amounts with ₪ symbol, commas, negative values
  - Empty rows, missing optional fields
  - Multiple possible merchant column names
  - Date formats: DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD, datetime, Excel serial
  - Currency symbol stripping
  - Diagnostics: detected_columns, missing_fields, raw_columns

Run with:
    pytest backend/modules/excel_parser/tests/unit/
"""

import pytest
import pandas as pd
from datetime import date
from unittest.mock import patch

from backend.modules.excel_parser.src.parser import ExcelParserAgent, COLUMN_ALIASES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_df(columns=None, rows=None, **overrides) -> pd.DataFrame:
    """
    Build a DataFrame with Cal-format Hebrew columns by default.
    Pass `columns` dict to override column names (e.g., Max format).
    Pass `rows` list of dicts for multi-row data.
    """
    if rows:
        return pd.DataFrame(rows)

    default = {
        "תאריך עסקה": "01/03/2025",
        "שם בית עסק": "רמי לוי",
        "סכום עסקה": "250.50",
        "פירוט": "קנייה",
        "מטבע": "ILS",
    }
    if columns:
        default = columns
    default.update(overrides)
    return pd.DataFrame([default])


def make_df_with_header_offset(title_rows: int, data_df: pd.DataFrame) -> pd.DataFrame:
    """
    Create a raw DataFrame with `title_rows` blank/title rows above the
    actual column headers. Simulates how pd.read_excel(header=None) would
    return a file with metadata rows above the data table.
    """
    # Title rows as NaN-filled rows
    n_cols = len(data_df.columns)
    title_data = [[None] * n_cols for _ in range(title_rows)]
    # Header row = column names
    title_data.append(list(data_df.columns))
    # Data rows
    for _, row in data_df.iterrows():
        title_data.append(list(row.values))
    return pd.DataFrame(title_data)


# ---------------------------------------------------------------------------
# Happy-path tests
# ---------------------------------------------------------------------------

class TestHappyPath:

    def test_single_valid_row(self):
        """A clean Cal-format row produces exactly one Transaction."""
        df = make_df()
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()

        assert len(result.transactions) == 1
        assert result.skipped_rows == 0
        txn = result.transactions[0]
        assert txn.merchant_name == "רמי לוי"
        assert txn.amount == 250.50
        assert txn.transaction_date == date(2025, 3, 1)
        assert txn.currency == "ILS"

    def test_amount_always_positive(self):
        """Negative amounts (credit notes) become positive via abs()."""
        df = make_df(**{"סכום עסקה": "-150.00"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].amount == 150.00

    def test_transaction_id_deterministic(self):
        """Same row data always produces the same transaction_id."""
        df = make_df()
        with patch("pandas.read_excel", return_value=df):
            r1 = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        with patch("pandas.read_excel", return_value=df):
            r2 = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert r1.transactions[0].transaction_id == r2.transactions[0].transaction_id

    def test_multiple_rows(self):
        """Parser handles multiple rows."""
        rows = [
            {"תאריך עסקה": "01/03/2025", "שם בית עסק": "רמי לוי", "סכום עסקה": "100", "מטבע": "ILS"},
            {"תאריך עסקה": "02/03/2025", "שם בית עסק": "מקדונלד", "סכום עסקה": "50", "מטבע": "ILS"},
        ]
        df = pd.DataFrame(rows)
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 2

    def test_raw_row_captured(self):
        """Each transaction should include the raw row data."""
        df = make_df()
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].raw_row is not None
        assert "שם בית עסק" in result.transactions[0].raw_row


# ---------------------------------------------------------------------------
# Hebrew column variations (different providers)
# ---------------------------------------------------------------------------

class TestHebrewColumnVariations:

    def test_max_format_columns(self):
        """Max (מקס) uses 'שם בית העסק' and 'סכום העסקה'."""
        df = make_df(columns={
            "תאריך העסקה": "15/02/2025",
            "שם בית העסק": "שופרסל",
            "סכום העסקה": "89.90",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1
        assert result.transactions[0].merchant_name == "שופרסל"

    def test_isracard_format_columns(self):
        """Isracard uses 'שם העסק' for merchant."""
        df = make_df(columns={
            "תאריך העסקה": "10/01/2025",
            "שם העסק": "ZARA",
            "סכום חיוב": "299.00",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1
        assert result.transactions[0].merchant_name == "ZARA"
        assert result.transactions[0].amount == 299.00

    def test_description_as_merchant(self):
        """Some providers use 'תיאור עסקה' instead of a merchant name column."""
        df = make_df(columns={
            "תאריך עסקה": "20/03/2025",
            "תיאור עסקה": "חשמלה ירושלים",
            "סכום": "450.00",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].merchant_name == "חשמלה ירושלים"

    def test_english_column_names(self):
        """English headers should work too."""
        df = make_df(columns={
            "Transaction Date": "2025-03-01",
            "Merchant Name": "Amazon",
            "Amount": "150.00",
            "Currency": "USD",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].merchant_name == "Amazon"
        assert result.transactions[0].currency == "USD"

    def test_generic_hebrew_schema_without_exact_aliases(self):
        """Parser should infer canonical fields from generic Hebrew schema signals."""
        df = make_df(columns={
            "יום רכישה": "03/04/2026",
            "תיאור בית העסק": "פנגו מוביט",
            "חיוב כולל בשח": "107.00",
            "מידע נוסף": "הוראת קבע",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1
        assert result.transactions[0].merchant_name == "פנגו מוביט"
        assert result.transactions[0].amount == pytest.approx(107.00)

    def test_generic_english_schema_without_exact_aliases(self):
        """Parser should not require provider-specific English headers."""
        df = make_df(columns={
            "Purchase Posted On": "2026-04-03",
            "Vendor Display Text": "WOLT TLV",
            "Debit ILS": "125.90",
            "Memo Text": "restaurant delivery",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1
        assert result.transactions[0].merchant_name == "WOLT TLV"
        assert result.transactions[0].amount == pytest.approx(125.90)
        assert result.transactions[0].raw_row is not None
        assert "memo text" in result.transactions[0].raw_row

    def test_billing_date_captured(self):
        """Billing date column should be captured when present."""
        df = make_df(columns={
            "תאריך עסקה": "01/03/2025",
            "תאריך חיוב": "05/03/2025",
            "שם בית עסק": "רמי לוי",
            "סכום עסקה": "100",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].billing_date == date(2025, 3, 5)

    def test_category_from_file(self):
        """Category column from the file itself should be captured."""
        df = make_df(columns={
            "תאריך עסקה": "01/03/2025",
            "שם בית עסק": "רמי לוי",
            "סכום עסקה": "100",
            "קטגוריה": "מזון",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].category == "מזון"

    def test_sector_as_category(self):
        """'ענף' (sector/branch) column should map to category."""
        df = make_df(columns={
            "תאריך עסקה": "01/03/2025",
            "שם בית עסק": "רמי לוי",
            "סכום עסקה": "100",
            "ענף": "סופרמרקט",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].category == "סופרמרקט"


# ---------------------------------------------------------------------------
# Header detection (header not in row 0)
# ---------------------------------------------------------------------------

class TestHeaderDetection:

    def test_header_at_row_4(self):
        """Real bank exports have title rows; header may be at row 4."""
        data_df = make_df()
        raw_df = make_df_with_header_offset(4, data_df)

        # First call = header detection scan (header=None)
        # Second call = actual load with detected header
        with patch("pandas.read_excel", side_effect=[raw_df, data_df]):
            result = ExcelParserAgent("dummy.xlsx").parse()

        assert len(result.transactions) == 1
        assert result.header_row == 4

    def test_header_at_row_0_fallback(self):
        """If header is actually at row 0, should still work."""
        df = make_df()
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1

    def test_best_row_selected(self):
        """When multiple rows have alias matches, pick the one with the most."""
        # Row 0: has 1 match ("תאריך")
        # Row 2: has 3 matches ("תאריך עסקה", "שם בית עסק", "סכום עסקה")
        raw_data = [
            ["תאריך", None, None],              # Row 0: 1 match
            [None, None, None],                   # Row 1: empty
            ["תאריך עסקה", "שם בית עסק", "סכום עסקה"],  # Row 2: 3 matches
            ["01/03/2025", "רמי לוי", "100"],     # Row 3: data
        ]
        raw_df = pd.DataFrame(raw_data)
        data_df = pd.DataFrame([{
            "תאריך עסקה": "01/03/2025",
            "שם בית עסק": "רמי לוי",
            "סכום עסקה": "100",
        }])

        with patch("pandas.read_excel", side_effect=[raw_df, data_df]):
            result = ExcelParserAgent("dummy.xlsx").parse()
        assert result.header_row == 2


# ---------------------------------------------------------------------------
# Amount parsing (currency symbols, commas, formats)
# ---------------------------------------------------------------------------

class TestAmountParsing:

    def test_amount_with_shekel_symbol(self):
        """Amount '₪250.50' should parse to 250.50."""
        df = make_df(**{"סכום עסקה": "₪250.50"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].amount == pytest.approx(250.50)

    def test_amount_with_comma_thousands(self):
        """'1,234.50' — comma is thousands separator."""
        df = make_df(**{"סכום עסקה": "1,234.50"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].amount == pytest.approx(1234.50)

    def test_amount_with_comma_decimal(self):
        """'250,50' — comma is decimal separator (no dot present)."""
        df = make_df(**{"סכום עסקה": "250,50"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].amount == pytest.approx(250.50)

    def test_amount_with_dollar_symbol(self):
        """Amount '$99.99' should strip the dollar sign."""
        df = make_df(**{"סכום עסקה": "$99.99"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].amount == pytest.approx(99.99)

    def test_amount_negative_becomes_positive(self):
        """Negative amounts '-350.00' → 350.00."""
        df = make_df(**{"סכום עסקה": "-350.00"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].amount == pytest.approx(350.00)

    def test_amount_with_non_breaking_space(self):
        """Amount with non-breaking space '250\xa050' should parse."""
        df = make_df(**{"סכום עסקה": "250\xa050"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].amount == pytest.approx(25050.0)


# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

class TestDateParsing:

    def test_date_dd_mm_yyyy(self):
        df = make_df(**{"תאריך עסקה": "15/03/2025"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].transaction_date == date(2025, 3, 15)

    def test_date_dd_dot_mm_dot_yyyy(self):
        df = make_df(**{"תאריך עסקה": "15.03.2025"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].transaction_date == date(2025, 3, 15)

    def test_date_iso_format(self):
        df = make_df(**{"תאריך עסקה": "2025-03-15"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].transaction_date == date(2025, 3, 15)

    def test_date_with_time(self):
        """Excel datetime strings like '2025-03-15 00:00:00'."""
        df = make_df(**{"תאריך עסקה": "2025-03-15 00:00:00"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].transaction_date == date(2025, 3, 15)

    def test_date_two_digit_year(self):
        df = make_df(**{"תאריך עסקה": "15/03/25"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].transaction_date == date(2025, 3, 15)

    def test_date_excel_serial(self):
        """Excel serial date 45731 = 2025-03-15."""
        df = make_df(**{"תאריך עסקה": "45731"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.transactions[0].transaction_date == date(2025, 3, 15)


# ---------------------------------------------------------------------------
# Error handling and row skipping
# ---------------------------------------------------------------------------

class TestErrorHandling:

    def test_missing_merchant_skips_row(self):
        """A row with no merchant name is skipped."""
        df = make_df(**{"שם בית עסק": None})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 0
        assert result.skipped_rows == 1

    def test_bad_amount_skips_row(self):
        """A row with non-numeric amount is skipped."""
        df = make_df(**{"סכום עסקה": "N/A"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.skipped_rows == 1

    def test_bad_date_skips_row(self):
        """A row with unparseable date is skipped."""
        df = make_df(**{"תאריך עסקה": "not-a-date"})
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert result.skipped_rows == 1

    def test_empty_row_skipped(self):
        """Completely empty rows are skipped gracefully."""
        rows = [
            {"תאריך עסקה": "01/03/2025", "שם בית עסק": "רמי לוי", "סכום עסקה": "100"},
            {"תאריך עסקה": None, "שם בית עסק": None, "סכום עסקה": None},
            {"תאריך עסקה": "02/03/2025", "שם בית עסק": "שופרסל", "סכום עסקה": "200"},
        ]
        df = pd.DataFrame(rows)
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 2
        assert result.skipped_rows == 1

    def test_fatal_load_error(self):
        """If the file cannot be read, return a ParseResult with FATAL error."""
        with patch("pandas.read_excel", side_effect=FileNotFoundError("no file")):
            result = ExcelParserAgent("missing.xlsx", header_row=0).parse()
        assert len(result.transactions) == 0
        assert any("FATAL" in e for e in result.errors)

    def test_missing_optional_fields_ok(self):
        """Missing optional fields (description, currency) should not skip the row."""
        df = make_df(columns={
            "תאריך עסקה": "01/03/2025",
            "שם בית עסק": "רמי לוי",
            "סכום עסקה": "100",
        })
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1
        assert result.transactions[0].currency == "ILS"  # default
        assert result.transactions[0].description is None


# ---------------------------------------------------------------------------
# Diagnostics (detected_columns, missing_fields, raw_columns)
# ---------------------------------------------------------------------------

class TestDiagnostics:

    def test_detected_columns_populated(self):
        """ParseResult should report which columns were detected."""
        df = make_df()
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert "transaction_date" in result.detected_columns
        assert "merchant_name" in result.detected_columns
        assert "amount" in result.detected_columns

    def test_raw_columns_populated(self):
        """ParseResult should report the original column names."""
        df = make_df()
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.raw_columns) > 0

    def test_missing_fields_when_no_amount_column(self):
        """If the file has no amount column, missing_fields should report it."""
        df = pd.DataFrame([{
            "תאריך עסקה": "01/03/2025",
            "שם בית עסק": "רמי לוי",
            "unknown_col": "foo",
        }])
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert "amount" in result.missing_fields
        assert len(result.transactions) == 0

    def test_missing_fields_when_no_merchant_column(self):
        """If the file has no merchant column, missing_fields should report it."""
        df = pd.DataFrame([{
            "תאריך עסקה": "01/03/2025",
            "סכום עסקה": "100",
            "unknown_col": "foo",
        }])
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert "merchant_name" in result.missing_fields


# ---------------------------------------------------------------------------
# Column name normalisation (newlines, invisible chars)
# ---------------------------------------------------------------------------

class TestColumnNormalisation:

    def test_newline_in_column_name(self):
        """Columns with newlines (e.g., 'תאריך\\nעסקה') should match."""
        df = pd.DataFrame([{
            "תאריך\nעסקה": "01/03/2025",
            "שם בית\nעסק": "רמי לוי",
            "סכום\nעסקה": "100",
        }])
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1

    def test_extra_spaces_in_column_name(self):
        """Columns with extra spaces should still match."""
        df = pd.DataFrame([{
            "  תאריך  עסקה  ": "01/03/2025",
            " שם  בית  עסק ": "רמי לוי",
            "סכום   עסקה": "100",
        }])
        with patch("pandas.read_excel", return_value=df):
            result = ExcelParserAgent("dummy.xlsx", header_row=0).parse()
        assert len(result.transactions) == 1
