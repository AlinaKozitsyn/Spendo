"""
planner/src/planner.py
======================
PlannerAgent — Agent #3

RESPONSIBILITY:
  Given a list of ClassifiedTransactions, produce financial insights:
    1. Monthly spending summary per category and group
    2. Budget variance (actual vs. BudgetGoal)
    3. Savings goal tracking

  This module does NOT read files or classify transactions.
  It consumes the output of ExcelParserAgent + ClassificationAgent and
  transforms it into actionable financial data for the UI layer.

DESIGN NOTES:
  - All calculations are pure Python (no external dependencies for the core math).
  - The PlannerAgent is stateless: the same inputs always produce the same outputs.
  - Persistence (saving goals to disk / DB) is intentionally out of scope here
    and will be handled by a future StorageAgent.
"""

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date

from backend.modules.shared.src import BudgetGoal, ClassifiedTransaction

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Output models — specific to the planner, not shared globally
# ---------------------------------------------------------------------------

@dataclass
class CategorySummary:
    """Aggregated spending for a single category in a given period."""
    category_name: str
    group: str
    total_spent: float
    transaction_count: int
    budget_limit: float = 0.0          # 0.0 means no goal set
    variance: float = 0.0              # positive = over budget, negative = under
    icon: str | None = None


@dataclass
class MonthlySummary:
    """Full spending breakdown for a single calendar month."""
    year: int
    month: int
    categories: list[CategorySummary] = field(default_factory=list)
    total_spent: float = 0.0
    total_budget: float = 0.0

    @property
    def label(self) -> str:
        """Human-readable month label e.g. '2025-03'."""
        return f"{self.year:04d}-{self.month:02d}"


# ---------------------------------------------------------------------------
# PlannerAgent
# ---------------------------------------------------------------------------

class PlannerAgent:
    """
    Produces financial summaries and budget variance reports.

    Usage:
        agent = PlannerAgent(budget_goals=[...])
        summaries = agent.monthly_summaries(classified_transactions)

    Args:
        budget_goals: Optional list of BudgetGoal objects defining spending
                      limits per category. If empty, variance is not computed.
    """

    def __init__(self, budget_goals: list[BudgetGoal] | None = None) -> None:
        # Build a fast lookup: category_name → monthly_limit
        self._goals: dict[str, float] = {
            g.category_name: g.monthly_limit
            for g in (budget_goals or [])
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def monthly_summaries(
        self,
        transactions: list[ClassifiedTransaction],
        month: int | None = None,
        year: int | None = None,
    ) -> list[MonthlySummary]:
        """
        Compute per-category spending summaries, grouped by month.

        Args:
            transactions: Classified transactions to analyse.
            month:        If provided, filter to this calendar month (1–12).
            year:         If provided, filter to this calendar year.

        Returns:
            List of MonthlySummary, one per distinct year-month in the data,
            sorted chronologically.
        """
        if not transactions:
            return []

        # Filter by period if requested
        txns = self._filter_by_period(transactions, month, year)

        # Group transactions by (year, month) → category_name
        # Structure: {(year, month): {category_name: [amounts]}}
        buckets: dict[tuple, dict[str, list]] = defaultdict(lambda: defaultdict(list))

        for ct in txns:
            key = (
                ct.transaction.transaction_date.year,
                ct.transaction.transaction_date.month,
            )
            buckets[key][ct.category.name].append(
                (ct.transaction.amount, ct.category.group, ct.category.icon)
            )

        summaries = []
        for (yr, mo), categories in sorted(buckets.items()):
            cat_summaries = []
            monthly_total = 0.0
            monthly_budget = 0.0

            for cat_name, entries in categories.items():
                total = sum(amt for amt, _, _ in entries)
                group = entries[0][1]
                icon = entries[0][2]
                limit = self._goals.get(cat_name, 0.0)
                variance = total - limit if limit > 0 else 0.0

                cat_summaries.append(CategorySummary(
                    category_name=cat_name,
                    group=group,
                    total_spent=round(total, 2),
                    transaction_count=len(entries),
                    budget_limit=limit,
                    variance=round(variance, 2),
                    icon=icon,
                ))
                monthly_total += total
                monthly_budget += limit

            summaries.append(MonthlySummary(
                year=yr,
                month=mo,
                categories=sorted(cat_summaries, key=lambda c: c.total_spent, reverse=True),
                total_spent=round(monthly_total, 2),
                total_budget=round(monthly_budget, 2),
            ))

        logger.info(
            "PlannerAgent: generated %d monthly summaries from %d transactions",
            len(summaries),
            len(txns),
        )
        return summaries

    def top_merchants(
        self,
        transactions: list[ClassifiedTransaction],
        top_n: int = 10,
    ) -> list[tuple[str, float]]:
        """
        Return the top N merchants by total spend.

        Args:
            transactions: Classified transactions to analyse.
            top_n:        Number of merchants to return.

        Returns:
            List of (merchant_name, total_amount) tuples, sorted descending.
        """
        totals: dict[str, float] = defaultdict(float)
        for ct in transactions:
            totals[ct.transaction.merchant_name] += ct.transaction.amount

        return sorted(totals.items(), key=lambda x: x[1], reverse=True)[:top_n]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _filter_by_period(
        transactions: list[ClassifiedTransaction],
        month: int | None,
        year: int | None,
    ) -> list[ClassifiedTransaction]:
        """Filter the transaction list to a specific month/year if requested."""
        if month is None and year is None:
            return transactions

        result = []
        for ct in transactions:
            d: date = ct.transaction.transaction_date
            if year is not None and d.year != year:
                continue
            if month is not None and d.month != month:
                continue
            result.append(ct)
        return result
