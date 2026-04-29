"""
Tests for the fixed classification taxonomy.
"""

from backend.modules.classifier.src.rules import (
    ALLOWED_CATEGORIES,
    CATEGORY_RULES,
    category_from_name,
    classify_by_rules,
)


def test_allowed_categories_match_expected_taxonomy():
    assert ALLOWED_CATEGORIES == [
        "Groceries",
        "Restaurants / Cafes",
        "Food Delivery",
        "Transportation",
        "Fuel / Car",
        "Public Transport",
        "Shopping / Clothing",
        "Health / Pharmacy",
        "Beauty / Cosmetics",
        "Home",
        "Utilities / Bills",
        "Education",
        "Entertainment",
        "Travel",
        "Digital Services / Subscriptions",
        "Banking Fees / Interest",
        "Cash Withdrawal",
        "Other",
    ]


def test_every_category_has_metadata():
    assert set(CATEGORY_RULES) == set(ALLOWED_CATEGORIES)
    for category_name, metadata in CATEGORY_RULES.items():
        assert category_name
        assert metadata["group"]


def test_category_from_name_uses_taxonomy_metadata():
    category = category_from_name("Groceries")
    assert category.name == "Groceries"
    assert category.group == "Essentials"


def test_category_from_name_unknown_falls_to_other():
    category = category_from_name("Not Real")
    assert category.name == "Other"
    assert category.group == "Other"


def test_deprecated_rule_classifier_is_noop():
    category, confidence = classify_by_rules("NETFLIX")
    assert category.name == "Other"
    assert confidence == 0.0
