"""
Run parser and Groq classification metrics across multiple Excel datasets.

Usage:
    python backend/scripts/evaluate_generalization.py data/uploads/*.xlsx data/samples/*.xlsx
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.modules.classifier.src import ClassificationAgent
from backend.modules.excel_parser.src import ExcelParserAgent


def evaluate_file(path: Path, classify: bool) -> dict:
    parse_result = ExcelParserAgent(path).parse()
    row = {
        "file": str(path),
        "parsed": len(parse_result.transactions),
        "skipped": parse_result.skipped_rows,
        "header_row": parse_result.header_row,
        "missing_fields": parse_result.missing_fields,
        "detected_columns": parse_result.detected_columns,
        "other_count": None,
        "other_rate": None,
        "failure_examples": [],
    }

    if not classify:
        return row

    classifier = ClassificationAgent(groq_api_key=os.getenv("GROQ_API_KEY"))
    classified = classifier.classify_all(parse_result.transactions)
    other = [item for item in classified if item.category.name == "Other"]
    row["other_count"] = len(other)
    row["other_rate"] = round(len(other) / max(len(classified), 1) * 100, 1)
    row["failure_examples"] = [
        {
            "merchant_name": item.transaction.merchant_name,
            "amount": item.transaction.amount,
            "reason": item.classification_reason,
        }
        for item in other[:5]
    ]
    return row


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="+", help="Excel files to evaluate")
    parser.add_argument(
        "--parse-only",
        action="store_true",
        help="Only evaluate parser generalization; skip Groq classification",
    )
    args = parser.parse_args()

    classify = not args.parse_only and bool(os.getenv("GROQ_API_KEY"))
    if not classify:
        print("Groq classification skipped: set GROQ_API_KEY and omit --parse-only to measure Other rate.")

    for file_name in args.files:
        result = evaluate_file(Path(file_name), classify=classify)
        print(result)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
