"""
classifier/src/__init__.py
==========================
Public surface of the classifier module.
"""

from .classifier import ClassificationAgent
from .fuzzy_matcher import classify_by_fuzzy
from .llm_classifier import LLMClassifier
from .reporting import generate_classification_report
from .rules import ALLOWED_CATEGORIES, CATEGORY_RULES, classify_by_rules

__all__ = [
    "ClassificationAgent",
    "LLMClassifier",
    "ALLOWED_CATEGORIES",
    "CATEGORY_RULES",
    "classify_by_rules",
    "classify_by_fuzzy",
    "generate_classification_report",
]
