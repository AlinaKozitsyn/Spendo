"""
shared/src/models.py
====================
Canonical data models (dataclasses) shared across ALL backend modules.

WHY THIS FILE EXISTS:
  Modules must never import from each other directly (see backend/AGENTS.md).
  Instead, every module communicates through these shared contracts.
  Changing a model here is a breaking change — treat it as a public API.

RULES:
  - All fields must have type annotations.
  - All models must be immutable (frozen=True) to prevent accidental mutation.
  - Add a docstring to every class and every non-obvious field.
"""

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


# ---------------------------------------------------------------------------
# Transaction — the atomic unit of financial data
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Transaction:
    """
    A single credit-card transaction as extracted from the Excel report.

    Produced by:  ExcelParserAgent
    Consumed by:  ClassificationAgent, PlannerAgent
    """

    transaction_id: str
    """Unique identifier — generated during parsing (e.g. row hash or UUID)."""

    transaction_date: date
    """Date the transaction was posted, parsed from the Excel date column."""

    merchant_name: str
    """Raw merchant / company name exactly as it appears in the report."""

    amount: float
    """Transaction amount in the report's native currency (always positive)."""

    currency: str = "ILS"
    """ISO 4217 currency code. Default is Israeli New Shekel."""

    description: Optional[str] = None
    """Optional free-text description column from the Excel file."""

    source_file: Optional[str] = None
    """Filename of the Excel report this transaction came from."""


# ---------------------------------------------------------------------------
# Category — the output of the classification step
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Category:
    """
    A single expense category with its financial group mapping.

    Produced by:  ClassificationAgent
    Consumed by:  PlannerAgent, UI layer
    """

    name: str
    """Human-readable category name, e.g. 'Groceries', 'Dining', 'Bills'."""

    group: str
    """
    High-level financial group this category belongs to.
    Standard groups: 'Essentials', 'Leisure', 'Savings', 'Health', 'Other'
    """

    icon: Optional[str] = None
    """Optional emoji or icon code for UI display."""


# ---------------------------------------------------------------------------
# ClassifiedTransaction — a Transaction enriched with its Category
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class ClassifiedTransaction:
    """
    A Transaction that has been run through the ClassificationAgent.

    This is the primary data object passed from the classification pipeline
    to the planning / reporting layer.
    """

    transaction: Transaction
    """The original, unmodified transaction record."""

    category: Category
    """The category assigned by the ClassificationAgent."""

    confidence: float = 1.0
    """
    Confidence score of the classification [0.0 – 1.0].
    1.0 = rule-based exact match; lower values indicate AI/fuzzy inference.
    """

    manually_overridden: bool = False
    """True when a human has corrected the auto-assigned category."""


# ---------------------------------------------------------------------------
# BudgetGoal — a spending limit set by the user for a given category
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class BudgetGoal:
    """
    A monthly spending target for a given expense category.

    Produced by:  User input (PlannerAgent persists it)
    Consumed by:  PlannerAgent (for variance / forecast calculations)
    """

    category_name: str
    """The Category.name this goal applies to."""

    monthly_limit: float
    """Maximum amount the user wants to spend in this category per month."""

    currency: str = "ILS"
    """ISO 4217 currency code. Should match the transaction currency."""


# ---------------------------------------------------------------------------
# ParseResult — structured output from ExcelParserAgent
# ---------------------------------------------------------------------------

@dataclass
class ParseResult:
    """
    The complete output of one ExcelParserAgent.parse() call.

    Uses a regular (mutable) dataclass because it is assembled incrementally
    during parsing and then handed off as a unit.
    """

    transactions: list[Transaction] = field(default_factory=list)
    """All successfully parsed Transaction objects."""

    skipped_rows: int = 0
    """Number of rows skipped due to missing / malformed data."""

    source_file: str = ""
    """Path or filename of the Excel file that was parsed."""

    errors: list[str] = field(default_factory=list)
    """Non-fatal parsing warnings / error messages (one per problematic row)."""
