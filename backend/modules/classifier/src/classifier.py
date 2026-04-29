"""
classifier/src/classifier.py
============================
Groq-first transaction classification pipeline.

Every uncached transaction is sent to the Groq-hosted LLM with the relevant
transaction context. The system keeps a fixed taxonomy, validates strict JSON,
caches repeated merchant classifications, and logs low-confidence results for
review. It does not create merchant-specific rules automatically.
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from backend.modules.shared.src import ClassifiedTransaction, Transaction
from .llm_classifier import LLMClassifier
from .rules import UNCATEGORIZED, category_from_name

logger = logging.getLogger(__name__)

LOW_CONFIDENCE_THRESHOLD = 0.7


class ClassificationAgent:
    """Classify transactions using Groq LLM as the primary classifier."""

    def __init__(
        self,
        groq_api_key: Optional[str] = None,
        use_ai_fallback: bool = True,
        llm_model: str = "llama-3.3-70b-versatile",
        llm_fallback_model: str = "llama-3.1-8b-instant",
        knowledge_dir: Optional[str] = None,
    ) -> None:
        self.use_ai_fallback = use_ai_fallback
        self._knowledge_dir = Path(knowledge_dir or os.getenv("SPENDO_DATA_DIR", "data")) / "knowledge"
        self._knowledge_dir.mkdir(parents=True, exist_ok=True)

        self._llm: Optional[LLMClassifier] = None
        api_key = groq_api_key or os.getenv("GROQ_API_KEY")
        if use_ai_fallback:
            self._llm = LLMClassifier(
                api_key=api_key,
                model=llm_model,
                fallback_model=llm_fallback_model,
            )

        self._stats = self._empty_stats()

    def classify_all(
        self, transactions: list[Transaction]
    ) -> list[ClassifiedTransaction]:
        """Classify a batch of transactions in input order."""
        self._stats = self._empty_stats()
        self._stats["total"] = len(transactions)

        if not transactions:
            return []

        if not self._llm or not self._llm.is_available:
            logger.warning("Groq classifier unavailable; using technical fallback for %d transactions", len(transactions))
            self._stats["fallback"] = len(transactions)
            self._stats["other_count"] = len(transactions)
            self._stats["other_rate"] = 100.0
            return [self._fallback_transaction(txn, "Groq classifier unavailable") for txn in transactions]

        llm_items = [self._transaction_to_llm_item(txn) for txn in transactions]
        llm_results = self._llm.classify_batch(llm_items)

        results: list[ClassifiedTransaction] = []
        for txn, llm_result in zip(transactions, llm_results):
            category_name = str(llm_result.get("category", "Other"))
            confidence = float(llm_result.get("confidence", 0.0))
            subcategory = str(llm_result.get("subcategory", "")).strip()
            reason = str(llm_result.get("reason", "")).strip()
            normalized = str(llm_result.get("normalized_merchant_name", "")).strip()
            is_uncertain = bool(llm_result.get("is_uncertain", False))

            category = category_from_name(category_name)
            source = "fallback" if confidence <= 0.0 and category.name == "Other" else "llm"

            reason_parts = []
            if subcategory:
                reason_parts.append(f"[{subcategory}]")
            if reason:
                reason_parts.append(reason)
            if normalized:
                reason_parts.append(f"normalized={normalized}")
            if is_uncertain:
                reason_parts.append("marked_for_review")

            classified = ClassifiedTransaction(
                transaction=txn,
                category=category,
                confidence=confidence,
                classification_source=source,
                classification_reason=" ".join(reason_parts),
            )
            results.append(classified)

            if source == "llm":
                self._stats["llm"] += 1
            else:
                self._stats["fallback"] += 1

            if confidence < LOW_CONFIDENCE_THRESHOLD or is_uncertain or category.name == "Other":
                self._stats["review_required"] += 1
                self._log_review(txn, llm_result)

        other_count = sum(1 for result in results if result.category.name == "Other")
        self._stats["other_count"] = other_count
        self._stats["other_rate"] = round(other_count / max(len(transactions), 1) * 100, 1)
        self._stats["cache"] = self._llm.get_cache_stats()

        logger.info(
            "Classification complete: %d total, %d llm, %d fallback, %d review, %d other (%.1f%%)",
            len(transactions),
            self._stats["llm"],
            self._stats["fallback"],
            self._stats["review_required"],
            other_count,
            self._stats["other_rate"],
        )

        return results

    def classify_one(self, transaction: Transaction) -> ClassifiedTransaction:
        """Classify one transaction."""
        return self.classify_all([transaction])[0]

    def get_classification_report(self) -> dict:
        """Return statistics from the last classification run."""
        return dict(self._stats)

    def _transaction_to_llm_item(self, txn: Transaction) -> dict:
        return {
            "merchant_name": txn.merchant_name,
            "description": txn.description or "",
            "amount": txn.amount,
            "currency": txn.currency,
            "date": txn.transaction_date.isoformat() if txn.transaction_date else "",
            "billing_date": txn.billing_date.isoformat() if txn.billing_date else "",
            "source_company": txn.source_company or "",
            "raw_fields": txn.raw_row or {},
        }

    def _fallback_transaction(self, txn: Transaction, reason: str) -> ClassifiedTransaction:
        fallback_result = {
            "category": "Other",
            "subcategory": "",
            "confidence": 0.0,
            "reason": reason,
            "normalized_merchant_name": "",
            "is_uncertain": True,
        }
        self._log_review(txn, fallback_result)
        return ClassifiedTransaction(
            transaction=txn,
            category=UNCATEGORIZED,
            confidence=0.0,
            classification_source="fallback",
            classification_reason=reason,
        )

    def _log_review(self, txn: Transaction, llm_result: dict) -> None:
        """Persist low-confidence or technical-fallback results for human review."""
        log_path = self._knowledge_dir / "classification_review.jsonl"
        entry = {
            "merchant_name": txn.merchant_name,
            "description": txn.description,
            "amount": txn.amount,
            "currency": txn.currency,
            "date": txn.transaction_date.isoformat() if txn.transaction_date else "",
            "raw_fields": txn.raw_row or {},
            "classification": llm_result,
            "timestamp": datetime.now().isoformat(),
        }
        try:
            with open(log_path, "a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except OSError as exc:
            logger.warning("Failed to write classification review log: %s", exc)

    @staticmethod
    def _empty_stats() -> dict:
        return {
            "total": 0,
            "llm": 0,
            "fallback": 0,
            "review_required": 0,
            "other_count": 0,
            "other_rate": 0.0,
            "cache": {"cached_merchants": 0},
        }
