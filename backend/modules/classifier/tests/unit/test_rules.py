"""
tests/unit/test_rules.py
========================
Unit tests for the rule-based classification engine.
"""

import pytest
from backend.modules.classifier.src.rules import classify_by_rules, UNCATEGORIZED


class TestClassifyByRules:

    def test_hebrew_grocery_match(self):
        cat, conf = classify_by_rules("רמי לוי סניף נתניה")
        assert cat.name == "Groceries"
        assert conf == 1.0

    def test_english_grocery_match(self):
        cat, conf = classify_by_rules("Shufersal Deal")
        assert cat.name == "Groceries"

    def test_dining_match(self):
        cat, conf = classify_by_rules("Wolt - מסעדה")
        assert cat.name == "Dining"

    def test_fuel_match(self):
        cat, conf = classify_by_rules("תחנת דלק סונול")
        assert cat.name == "Fuel & Transport"

    def test_case_insensitive(self):
        cat, conf = classify_by_rules("NETFLIX SUBSCRIPTION")
        assert cat.name == "Entertainment"

    def test_unknown_merchant_returns_other(self):
        cat, conf = classify_by_rules("XYZ Unknown Store 12345")
        assert cat.name == "Other"
        assert conf == 0.0

    def test_empty_string_returns_other(self):
        cat, conf = classify_by_rules("")
        assert cat.name == "Other"
        assert conf == 0.0

    def test_category_has_group(self):
        cat, _ = classify_by_rules("אמזון")
        assert cat.group != ""
