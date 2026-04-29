"""
scripts/generate_sample_data.py
===============================
Generates a realistic mock credit card Excel statement for testing.

Creates a single-month report with ~50 transactions across multiple
categories, using Hebrew and English merchant names typical of
Israeli credit card statements.

RUN:
  python -m backend.scripts.generate_sample_data
"""

import random
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

# Output path
OUTPUT_DIR = Path("data/samples")
OUTPUT_FILE = OUTPUT_DIR / "sample_march_2025.xlsx"

# Merchant definitions: (name, typical amount range)
MERCHANTS = {
    "Groceries": [
        ("רמי לוי שיווק השקמה", (80, 400)),
        ("שופרסל דיל", (50, 350)),
        ("מגה בעיר", (30, 200)),
        ("ויקטורי", (40, 250)),
        ("אושר עד", (60, 300)),
        ("יינות ביתן", (70, 280)),
    ],
    "Dining": [
        ("מקדונלדס", (30, 80)),
        ("קפה גרג", (20, 60)),
        ("פיצה האט", (40, 100)),
        ("שווארמה הגבעה", (25, 55)),
        ("Wolt", (35, 120)),
        ("תן ביס - מסעדה", (30, 90)),
    ],
    "Fuel & Transport": [
        ("סונול ת.דלק", (100, 350)),
        ("פז צהוב תחנת דלק", (120, 400)),
        ("דלק הצפון", (80, 300)),
        ("רכבת ישראל", (15, 50)),
        ("Gett", (20, 70)),
    ],
    "Bills & Utilities": [
        ("חברת חשמל", (200, 600)),
        ("פלאפון תקשורת", (50, 150)),
        ("HOT טלקום", (100, 250)),
        ("בזק בינלאומי", (80, 180)),
        ("מקורות - מים", (60, 200)),
    ],
    "Health": [
        ("סופר פארם", (30, 150)),
        ("מכבי שרותי בריאות", (20, 80)),
        ("בי קיור לייזר", (100, 500)),
    ],
    "Shopping": [
        ("AMAZON.COM", (50, 500)),
        ("זארה ZARA", (100, 400)),
        ("H&M", (80, 300)),
        ("קסטרו", (60, 250)),
        ("FOX HOME", (100, 350)),
        ("AliExpress", (15, 200)),
    ],
    "Entertainment": [
        ("NETFLIX.COM", (33, 33)),
        ("SPOTIFY", (20, 20)),
        ("סינמה סיטי", (35, 70)),
        ("Apple.com/bill", (10, 50)),
        ("GOOGLE *YouTube", (27, 27)),
    ],
    "Other": [
        ("העברת כספים", (100, 1000)),
        ("מש. כתריאל ושות", (200, 800)),
    ],
}


def generate_sample_report() -> pd.DataFrame:
    """Generate a realistic 1-month credit card statement."""
    random.seed(42)  # Reproducible

    rows = []
    start = date(2025, 3, 1)
    end = date(2025, 3, 31)

    # Generate ~50 transactions across the month
    for category, merchants in MERCHANTS.items():
        # Weight: groceries and dining happen more often
        count = {"Groceries": 8, "Dining": 7, "Fuel & Transport": 4,
                 "Bills & Utilities": 5, "Health": 3, "Shopping": 6,
                 "Entertainment": 5, "Other": 2}.get(category, 3)

        for _ in range(count):
            merchant_name, (min_amt, max_amt) = random.choice(merchants)
            day = random.randint(1, 28)
            txn_date = date(2025, 3, day)
            amount = round(random.uniform(min_amt, max_amt), 2)

            rows.append({
                "תאריך עסקה": txn_date.strftime("%d/%m/%Y"),
                "שם בית עסק": merchant_name,
                "סכום עסקה": f"{amount:.2f}",
                "מטבע": "ILS",
                "פירוט": "",
            })

    # Shuffle to simulate real unordered statement
    random.shuffle(rows)
    return pd.DataFrame(rows)


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    df = generate_sample_report()
    df.to_excel(str(OUTPUT_FILE), index=False, engine="openpyxl")
    print(f"Generated {len(df)} transactions -> {OUTPUT_FILE}")
    print(f"\nSample rows:")
    print(df.head(10).to_string(index=False))


if __name__ == "__main__":
    main()
