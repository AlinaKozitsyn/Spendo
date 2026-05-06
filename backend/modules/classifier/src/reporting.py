"""
classifier/src/reporting.py
============================
Classification analytics and reporting.

Generates reports on:
1. Classification distribution (% per category)
2. "Other" rate (target: < 10%)
3. Confidence distribution
4. Top unknown merchants
5. Rule vs LLM usage split
6. Errors / invalid LLM responses
"""

import json
import logging
from collections import Counter
from pathlib import Path
from typing import Optional

from backend.modules.shared.src import ClassifiedTransaction

logger = logging.getLogger(__name__)


def generate_classification_report(
    classified: list[ClassifiedTransaction],
    pipeline_stats: Optional[dict] = None,
    knowledge_dir: Optional[str] = None,
) -> dict:
    """
    Generate a comprehensive classification report.

    Args:
        classified: List of ClassifiedTransaction from the pipeline.
        pipeline_stats: Stats dict from ClassificationAgent.get_classification_report().
        knowledge_dir: Path to knowledge directory for Other review log.

    Returns:
        Report dict with all analytics.
    """
    total = len(classified)
    if total == 0:
        return {"total": 0, "message": "No transactions to report on"}

    # 1. Classification distribution
    category_counts = Counter(ct.category.name for ct in classified)
    distribution = {
        cat: {
            "count": count,
            "percentage": round(count / total * 100, 1),
        }
        for cat, count in category_counts.most_common()
    }

    # 2. "Other" rate
    other_count = category_counts.get("Other", 0)
    other_rate = round(other_count / total * 100, 1)
    other_status = "GOOD" if other_rate < 10 else "WARNING" if other_rate < 20 else "CRITICAL"

    # 3. Confidence distribution
    confidences = [ct.confidence for ct in classified]
    confidence_stats = {
        "mean": round(sum(confidences) / len(confidences), 3),
        "min": round(min(confidences), 3),
        "max": round(max(confidences), 3),
        "high_confidence": sum(1 for c in confidences if c >= 0.9),
        "medium_confidence": sum(1 for c in confidences if 0.5 <= c < 0.9),
        "low_confidence": sum(1 for c in confidences if c < 0.5),
    }

    # 4. Top unknown merchants (classified as Other)
    other_merchants = [
        ct.transaction.merchant_name
        for ct in classified
        if ct.category.name == "Other"
    ]
    top_unknown = Counter(other_merchants).most_common(20)

    # 5. Source split
    source_counts = Counter(ct.classification_source for ct in classified)
    source_split = {
        source: {
            "count": count,
            "percentage": round(count / total * 100, 1),
        }
        for source, count in source_counts.most_common()
    }

    # 6. Other review log stats
    other_log_count = 0
    if knowledge_dir:
        log_path = Path(knowledge_dir) / "other_review.jsonl"
        if log_path.exists():
            other_log_count = sum(1 for _ in open(log_path, encoding="utf-8"))

    report = {
        "total_transactions": total,
        "category_distribution": distribution,
        "other_rate": {
            "count": other_count,
            "percentage": other_rate,
            "status": other_status,
            "target": "< 10%",
        },
        "confidence": confidence_stats,
        "top_unknown_merchants": [
            {"merchant": m, "count": c} for m, c in top_unknown
        ],
        "source_split": source_split,
        "other_log_total": other_log_count,
    }

    if pipeline_stats:
        report["pipeline_stats"] = pipeline_stats

    return report
