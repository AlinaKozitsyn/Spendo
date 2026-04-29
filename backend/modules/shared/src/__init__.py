"""
shared/src/__init__.py
======================
Public surface of the `shared` module.

Import shared contracts like this:
    from backend.modules.shared import Transaction, Category, ClassifiedTransaction

Never import from shared.src.models directly in other modules — use this __init__
so the internal file layout can change without breaking callers.
"""

from .models import (
    BudgetGoal,
    Category,
    ClassifiedTransaction,
    ParseResult,
    Transaction,
)

__all__ = [
    "Transaction",
    "Category",
    "ClassifiedTransaction",
    "BudgetGoal",
    "ParseResult",
]
