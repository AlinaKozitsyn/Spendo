"""
classifier/src/__init__.py
==========================
Public surface of the classifier module.
"""

from .classifier import ClassificationAgent
from .fuzzy_matcher import classify_by_fuzzy
from .rules import CATEGORY_RULES, classify_by_rules

__all__ = ["ClassificationAgent", "CATEGORY_RULES", "classify_by_rules", "classify_by_fuzzy"]
