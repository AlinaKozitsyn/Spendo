# ClassificationAgent — Module README

## Purpose
Classifies `Transaction` objects into `ClassifiedTransaction` objects by
assigning each transaction a `Category`.

## Strategy
1. **Pass 1 — Rule engine** (`rules.py`): fast keyword matching, zero API cost.
2. **Pass 2 — AI fallback** (`classifier.py`): Claude classifies unknowns.

## Public API

```python
from backend.modules.classifier import ClassificationAgent

agent = ClassificationAgent()  # reads ANTHROPIC_API_KEY from env
results = agent.classify_all(transactions)  # list[ClassifiedTransaction]
```

## Adding New Categories
Edit `CATEGORY_RULES` in `src/rules.py`. No code changes needed elsewhere.

## Dependencies
- `anthropic` (for AI fallback)
- `backend.modules.shared`

## Tests
```bash
pytest backend/modules/classifier/tests/unit/
```
