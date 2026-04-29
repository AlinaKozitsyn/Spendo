"""
classifier/src/rules.py
=======================
Fixed category taxonomy for transaction classification.

This module intentionally does not contain merchant-specific rules. Groq LLM
classification is the primary classifier; this file only defines the allowed
category set and category metadata used for validation and UI grouping.
"""

from backend.modules.shared.src import Category

ALLOWED_CATEGORIES: list[str] = [
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

CATEGORY_RULES: dict[str, dict[str, str | None]] = {
    "Groceries": {"group": "Essentials", "icon": None},
    "Restaurants / Cafes": {"group": "Food", "icon": None},
    "Food Delivery": {"group": "Food", "icon": None},
    "Transportation": {"group": "Transport", "icon": None},
    "Fuel / Car": {"group": "Transport", "icon": None},
    "Public Transport": {"group": "Transport", "icon": None},
    "Shopping / Clothing": {"group": "Lifestyle", "icon": None},
    "Health / Pharmacy": {"group": "Health", "icon": None},
    "Beauty / Cosmetics": {"group": "Lifestyle", "icon": None},
    "Home": {"group": "Essentials", "icon": None},
    "Utilities / Bills": {"group": "Essentials", "icon": None},
    "Education": {"group": "Essentials", "icon": None},
    "Entertainment": {"group": "Lifestyle", "icon": None},
    "Travel": {"group": "Lifestyle", "icon": None},
    "Digital Services / Subscriptions": {"group": "Lifestyle", "icon": None},
    "Banking Fees / Interest": {"group": "Finance", "icon": None},
    "Cash Withdrawal": {"group": "Finance", "icon": None},
    "Other": {"group": "Other", "icon": None},
}

UNCATEGORIZED = Category(name="Other", group="Other", icon=None)


def category_from_name(category_name: str) -> Category:
    """Build a Category object from the fixed taxonomy."""
    metadata = CATEGORY_RULES.get(category_name)
    if not metadata:
        metadata = CATEGORY_RULES["Other"]
        category_name = "Other"

    return Category(
        name=category_name,
        group=str(metadata["group"]),
        icon=metadata.get("icon"),
    )


def classify_by_rules(merchant_name: str) -> tuple[Category, float]:
    """
    Deprecated compatibility shim.

    Merchant-specific keyword matching has been removed. Technical fallbacks
    should call the LLM first and use this only as a no-op fallback path.
    """
    return UNCATEGORIZED, 0.0
