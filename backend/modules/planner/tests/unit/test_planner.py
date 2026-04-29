"""
tests/unit/test_planner.py
==========================
Unit tests for PlannerAgent.
"""

import pytest
from datetime import date

from backend.modules.shared.src import (
    BudgetGoal, Category, ClassifiedTransaction, Transaction
)
from backend.modules.planner.src.planner import PlannerAgent


def make_ct(merchant: str, amount: float, category: str, group: str, txn_date: date) -> ClassifiedTransaction:
    """Helper to build a ClassifiedTransaction for testing."""
    return ClassifiedTransaction(
        transaction=Transaction(
            transaction_id="test_id",
            transaction_date=txn_date,
            merchant_name=merchant,
            amount=amount,
        ),
        category=Category(name=category, group=group),
        confidence=1.0,
    )


class TestPlannerMonthlySummaries:

    MARCH = date(2025, 3, 15)
    APRIL = date(2025, 4, 10)

    def test_empty_input_returns_empty(self):
        agent = PlannerAgent()
        assert agent.monthly_summaries([]) == []

    def test_single_transaction_single_month(self):
        ct = make_ct("רמי לוי", 200.0, "Groceries", "Essentials", self.MARCH)
        agent = PlannerAgent()
        summaries = agent.monthly_summaries([ct])
        assert len(summaries) == 1
        assert summaries[0].label == "2025-03"
        assert summaries[0].total_spent == 200.0

    def test_two_months_produces_two_summaries(self):
        cts = [
            make_ct("רמי לוי", 100.0, "Groceries", "Essentials", self.MARCH),
            make_ct("מקדונלד",  50.0, "Dining",    "Leisure",    self.APRIL),
        ]
        agent = PlannerAgent()
        summaries = agent.monthly_summaries(cts)
        assert len(summaries) == 2
        labels = [s.label for s in summaries]
        assert "2025-03" in labels
        assert "2025-04" in labels

    def test_budget_variance_over_budget(self):
        ct = make_ct("רמי לוי", 500.0, "Groceries", "Essentials", self.MARCH)
        goals = [BudgetGoal(category_name="Groceries", monthly_limit=300.0)]
        agent = PlannerAgent(budget_goals=goals)
        summary = agent.monthly_summaries([ct])[0]
        groceries = next(c for c in summary.categories if c.category_name == "Groceries")
        assert groceries.variance == pytest.approx(200.0)  # 500 - 300

    def test_budget_variance_under_budget(self):
        ct = make_ct("רמי לוי", 100.0, "Groceries", "Essentials", self.MARCH)
        goals = [BudgetGoal(category_name="Groceries", monthly_limit=300.0)]
        agent = PlannerAgent(budget_goals=goals)
        summary = agent.monthly_summaries([ct])[0]
        groceries = next(c for c in summary.categories if c.category_name == "Groceries")
        assert groceries.variance == pytest.approx(-200.0)  # 100 - 300

    def test_filter_by_month(self):
        cts = [
            make_ct("A", 100.0, "Groceries", "Essentials", self.MARCH),
            make_ct("B",  50.0, "Dining",    "Leisure",    self.APRIL),
        ]
        agent = PlannerAgent()
        summaries = agent.monthly_summaries(cts, month=3, year=2025)
        assert len(summaries) == 1
        assert summaries[0].label == "2025-03"


class TestPlannerTopMerchants:

    def test_top_merchants_sorted(self):
        cts = [
            make_ct("Merchant A", 300.0, "Other", "Other", date(2025, 3, 1)),
            make_ct("Merchant B", 100.0, "Other", "Other", date(2025, 3, 2)),
            make_ct("Merchant A",  50.0, "Other", "Other", date(2025, 3, 3)),
        ]
        agent = PlannerAgent()
        top = agent.top_merchants(cts, top_n=2)
        assert top[0] == ("Merchant A", 350.0)
        assert top[1] == ("Merchant B", 100.0)
