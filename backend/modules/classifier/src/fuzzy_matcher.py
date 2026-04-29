"""
Deprecated fuzzy matcher compatibility module.

Fuzzy keyword matching is no longer part of the classification pipeline because
Groq LLM classification is the primary classifier.
"""

from backend.modules.shared.src import Category


def classify_by_fuzzy(merchant_name: str, threshold: int = 80) -> tuple[Category, float]:
    """Return no match; kept only for older imports."""
    return Category(name="Other", group="Other", icon=None), 0.0
