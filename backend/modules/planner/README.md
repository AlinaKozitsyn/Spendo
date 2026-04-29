# PlannerAgent — Module README

## Purpose
Aggregates `ClassifiedTransaction` data into monthly spending summaries,
budget variance reports, and top-merchant rankings.

## Public API

```python
from backend.modules.planner import PlannerAgent
from backend.modules.shared import BudgetGoal

goals = [BudgetGoal(category_name="Groceries", monthly_limit=1500.0)]
agent = PlannerAgent(budget_goals=goals)

summaries = agent.monthly_summaries(classified_transactions)
top = agent.top_merchants(classified_transactions, top_n=10)
```

## Output Types
- `MonthlySummary` — total spend + per-category breakdown for one month
- `CategorySummary` — spend, budget limit, and variance for one category
- `top_merchants()` — list of `(merchant_name, total_amount)` tuples

## Dependencies
- `backend.modules.shared` (no external packages needed)

## Tests
```bash
pytest backend/modules/planner/tests/unit/
```
