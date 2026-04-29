"""
classifier/src/rules.py
=======================
Rule-based keyword classification engine (no AI required).

RESPONSIBILITY:
  Map a merchant name → Category using a deterministic keyword lookup table.
  This is the fast, cheap, offline path. It handles the vast majority of
  transactions where the merchant name is predictable (e.g. "רמי לוי" → Groceries).

WHY RULES FIRST?
  - Instant, no API cost
  - Reproducible: same input always yields same output (confidence = 1.0)
  - Easy to audit and correct
  - The AI fallback (ClassificationAgent) only kicks in for unknowns

ADDING NEW RULES:
  Edit the CATEGORY_RULES dict below. Each entry is:
    "<CategoryName>": {
        "group": "<GroupName>",
        "keywords": ["keyword1", "keyword2", ...],
        "icon": "🛒"   # optional
    }
  Keywords are matched case-insensitively against the merchant name.
"""

from backend.modules.shared.src import Category

# ---------------------------------------------------------------------------
# Master category rule table
# Hebrew and English keywords are both supported.
# ---------------------------------------------------------------------------

CATEGORY_RULES: dict[str, dict] = {
    # --- Groceries ---
    "Groceries": {
        "group": "Essentials",
        "icon": "🛒",
        "keywords": [
            "רמי לוי", "שופרסל", "מגה", "ויקטורי", "יינות ביתן", "סופר",
            "superpharm", "super-pharm", "super pharm",
            "shufersal", "rami levy", "mega", "victory",
            "carrefour", "osher ad", "אושר עד",
        ],
    },
    # --- Dining & Restaurants ---
    "Dining": {
        "group": "Leisure",
        "icon": "🍽️",
        "keywords": [
            "מקדונלד", "בורגר קינג", "שווארמה", "פיצה", "סושי", "קפה",
            "mcdonalds", "burger king", "pizza", "sushi", "cafe", "coffee",
            "ten bis", "תן ביס", "wolt", "ווולט", "mishloha", "mishlocha",
        ],
    },
    # --- Fuel & Transportation ---
    "Fuel & Transport": {
        "group": "Essentials",
        "icon": "⛽",
        "keywords": [
            "דלק", "סונול", "פז", "גז", "ten", "תחנת דלק",
            "delek", "sonol", "paz", "fuel", "petrol",
            "רכבת", "אגד", "מטרופולין", "דן",
            "rail", "bus", "metro", "train", "uber", "gett",
        ],
    },
    # --- Utilities & Bills ---
    "Bills & Utilities": {
        "group": "Essentials",
        "icon": "📄",
        "keywords": [
            "חשמל", "מים", "גז", "פלאפון", "סלקום", "הוט", "HOT",
            "bezeq", "בזק", "partner", "פרטנר", "012", "cellcom", "סלקום",
            "electric", "water", "gas", "internet", "phone",
            "insurance", "ביטוח",
        ],
    },
    # --- Health & Pharmacy ---
    "Health": {
        "group": "Essentials",
        "icon": "💊",
        "keywords": [
            "בית מרקחת", "קופת חולים", "מכבי", "כללית", "ליאומית",
            "pharmacy", "hospital", "clinic", "doctor", "health",
            "super-pharm", "super pharm", "סופר פארם",
        ],
    },
    # --- Shopping & Retail ---
    "Shopping": {
        "group": "Leisure",
        "icon": "🛍️",
        "keywords": [
            "אמזון", "amazon", "ebay", "aliexpress", "zara", "h&m", "castro",
            "renuar", "רנואר", "fox", "golf", "קסטרו", "shein",
        ],
    },
    # --- Entertainment & Subscriptions ---
    "Entertainment": {
        "group": "Leisure",
        "icon": "🎬",
        "keywords": [
            "netflix", "spotify", "apple", "google play", "youtube",
            "yes", "yes+", "הוט", "hot", "disney", "amazon prime",
            "סינמה", "cinema", "yes vod", "תיאטרון",
        ],
    },
    # --- Savings & Investments ---
    "Savings": {
        "group": "Savings",
        "icon": "💰",
        "keywords": [
            "קרן", "חיסכון", "השקעה", "pension", "savings", "investment",
            "בנק", "bank", "ביטוח מנהלים",
        ],
    },
}

# ---------------------------------------------------------------------------
# Fallback category — used when no rule matches
# ---------------------------------------------------------------------------

UNCATEGORIZED = Category(name="Other", group="Other", icon="❓")


def classify_by_rules(merchant_name: str) -> tuple[Category, float]:
    """
    Attempt to classify a merchant name using the keyword rule table.

    Args:
        merchant_name: The raw merchant name string from the transaction.

    Returns:
        A tuple of (Category, confidence_score).
        confidence is 1.0 for a rule match, 0.0 for the fallback.

    WHY return a tuple?
        The ClassificationAgent needs to know whether to escalate to
        the AI path. A 0.0 confidence signals "I don't know — try AI."
    """
    lower = merchant_name.lower()

    for category_name, rule in CATEGORY_RULES.items():
        for keyword in rule["keywords"]:
            if keyword.lower() in lower:
                return (
                    Category(
                        name=category_name,
                        group=rule["group"],
                        icon=rule.get("icon"),
                    ),
                    1.0,
                )

    # No match found → return the fallback with 0.0 confidence
    return UNCATEGORIZED, 0.0
