"""
classifier/src/classifier.py
============================
ClassificationAgent — Agent #2

RESPONSIBILITY:
  Classify a list of Transaction objects into ClassifiedTransactions by
  assigning each one a Category.

THREE-PASS STRATEGY:
  Pass 1 — Rule Engine (rules.py):
    Fast, deterministic keyword matching. Handles ~60% of transactions.
    Confidence = 1.0.

  Pass 1.5 — Fuzzy Matching (fuzzy_matcher.py):
    Catches near-misses: typos, extra spaces, abbreviations.
    Handles ~15% of transactions. Confidence = 0.9.

  Pass 2 — AI Fallback (Claude API):
    For transactions neither rules nor fuzzy could match, we
    send the merchant name to Claude and ask it to pick a category.
    This handles unusual/new merchants without code changes.
    Confidence = 0.7 (AI inference is good but not guaranteed).

WHY THIS DESIGN?
  - Speed: most transactions never hit the API → near-instant classification.
  - Cost: only unknown merchants incur API calls.
  - Auditability: rule-based results are 100% explainable; AI results are
    flagged with lower confidence so the UI can surface them for review.

DEPENDENCIES:
  - anthropic (pip install anthropic)
  - shared.models (Transaction, Category, ClassifiedTransaction)
  - classifier.src.rules (classify_by_rules)
"""

import json
import logging
import os
from typing import Optional

import anthropic

from backend.modules.shared.src import Category, ClassifiedTransaction, Transaction
from .fuzzy_matcher import classify_by_fuzzy
from .rules import CATEGORY_RULES, UNCATEGORIZED, classify_by_rules

logger = logging.getLogger(__name__)


class ClassificationAgent:
    """
    Classifies a batch of Transaction objects into ClassifiedTransactions.

    Usage:
        agent = ClassificationAgent()
        results = agent.classify_all(transactions)

    Args:
        api_key:        Anthropic API key. Falls back to ANTHROPIC_API_KEY env var.
        use_ai_fallback: If False, unknown merchants stay as "Other" without
                         calling the API. Useful for testing / offline mode.
    """

    AI_CONFIDENCE = 0.7
    """Confidence score assigned to AI-classified transactions."""

    MODEL = "claude-sonnet-4-20250514"
    """Claude model to use for AI classification."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        use_ai_fallback: bool = True,
    ) -> None:
        self.use_ai_fallback = use_ai_fallback
        self._client: Optional[anthropic.Anthropic] = None

        if use_ai_fallback:
            key = api_key or os.getenv("ANTHROPIC_API_KEY")
            if not key:
                logger.warning(
                    "No ANTHROPIC_API_KEY found. AI fallback disabled."
                )
                self.use_ai_fallback = False
            else:
                self._client = anthropic.Anthropic(api_key=key)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def classify_all(
        self, transactions: list[Transaction]
    ) -> list[ClassifiedTransaction]:
        """
        Classify a list of transactions.

        Pass 1: try rule-based classification for every transaction.
        Pass 2: batch-call Claude for any that scored 0.0 confidence.

        Args:
            transactions: List of Transaction objects from ExcelParserAgent.

        Returns:
            List of ClassifiedTransaction in the same order as input.
        """
        results: list[ClassifiedTransaction] = []
        needs_ai: list[tuple[int, Transaction]] = []  # (index, txn)

        # --- Pass 1: Rule engine (exact keyword match) ---
        needs_fuzzy: list[tuple[int, Transaction]] = []

        for idx, txn in enumerate(transactions):
            category, confidence = classify_by_rules(txn.merchant_name)
            if confidence > 0.0:
                results.append(
                    ClassifiedTransaction(
                        transaction=txn,
                        category=category,
                        confidence=confidence,
                    )
                )
            else:
                # Placeholder — will be replaced in Pass 1.5 or Pass 2
                results.append(
                    ClassifiedTransaction(
                        transaction=txn,
                        category=UNCATEGORIZED,
                        confidence=0.0,
                    )
                )
                needs_fuzzy.append((idx, txn))

        logger.info(
            "ClassificationAgent Pass 1: %d rule-matched, %d unmatched",
            len(transactions) - len(needs_fuzzy),
            len(needs_fuzzy),
        )

        # --- Pass 1.5: Fuzzy matching ---
        for idx, txn in needs_fuzzy:
            category, confidence = classify_by_fuzzy(txn.merchant_name)
            if confidence > 0.0:
                results[idx] = ClassifiedTransaction(
                    transaction=txn,
                    category=category,
                    confidence=confidence,
                )
            else:
                needs_ai.append((idx, txn))

        logger.info(
            "ClassificationAgent Pass 1.5: %d fuzzy-matched, %d need AI",
            len(needs_fuzzy) - len(needs_ai),
            len(needs_ai),
        )

        # --- Pass 2: AI fallback ---
        if needs_ai and self.use_ai_fallback and self._client:
            ai_results = self._classify_batch_with_ai(needs_ai)
            for idx, classified in ai_results:
                results[idx] = classified

        return results

    def classify_one(self, transaction: Transaction) -> ClassifiedTransaction:
        """
        Classify a single transaction (convenience wrapper).

        Useful for re-classifying a single corrected transaction without
        re-processing the whole batch.
        """
        return self.classify_all([transaction])[0]

    # ------------------------------------------------------------------
    # AI classification helpers
    # ------------------------------------------------------------------

    def _classify_batch_with_ai(
        self, items: list[tuple[int, Transaction]]
    ) -> list[tuple[int, ClassifiedTransaction]]:
        """
        Sends unknown merchants to Claude for classification.

        Batches all unknowns into a single API call to minimise latency and cost.
        Claude is prompted to return a JSON list of category assignments.

        Args:
            items: List of (result_index, Transaction) tuples to classify.

        Returns:
            List of (result_index, ClassifiedTransaction) tuples.
        """
        # Build the list of category names for Claude to choose from
        valid_categories = list(CATEGORY_RULES.keys()) + ["Other"]

        # Build a compact prompt: one merchant per line
        merchant_list = "\n".join(
            f"{i}. {txn.merchant_name}"
            for i, (_, txn) in enumerate(items)
        )

        prompt = f"""You are a financial expense classifier.
Classify each merchant into exactly one of these categories:
{json.dumps(valid_categories)}

Merchants to classify:
{merchant_list}

Return ONLY a JSON array of objects with keys "index" (int) and "category" (string).
Example: [{{"index": 0, "category": "Dining"}}, {{"index": 1, "category": "Shopping"}}]
Do not include any explanation, only the JSON array."""

        try:
            message = self._client.messages.create(
                model=self.MODEL,
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            raw = message.content[0].text.strip()
            assignments: list[dict] = json.loads(raw)
        except Exception as exc:
            logger.error("AI classification failed: %s", exc)
            # Return the items unchanged (Uncategorized) on failure
            return [
                (
                    idx,
                    ClassifiedTransaction(
                        transaction=txn,
                        category=UNCATEGORIZED,
                        confidence=0.0,
                    ),
                )
                for idx, txn in items
            ]

        # Build a lookup: prompt-index → category name
        ai_map: dict[int, str] = {
            a["index"]: a["category"] for a in assignments
        }

        results = []
        for prompt_idx, (result_idx, txn) in enumerate(items):
            category_name = ai_map.get(prompt_idx, "Other")
            rule = CATEGORY_RULES.get(category_name)

            if rule:
                category = Category(
                    name=category_name,
                    group=rule["group"],
                    icon=rule.get("icon"),
                )
            else:
                category = UNCATEGORIZED

            results.append(
                (
                    result_idx,
                    ClassifiedTransaction(
                        transaction=txn,
                        category=category,
                        confidence=self.AI_CONFIDENCE,
                    ),
                )
            )

        return results
