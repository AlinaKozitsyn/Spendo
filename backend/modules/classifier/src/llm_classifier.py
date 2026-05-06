"""
classifier/src/llm_classifier.py
================================
Groq LLM transaction classifier.

The default model is llama-3.3-70b-versatile. The classifier sends transaction
context to Groq, requires strict JSON, validates the category taxonomy, and
returns low-confidence flags for review instead of creating rules.
"""

import json
import logging
from typing import Optional

from .rules import ALLOWED_CATEGORIES

logger = logging.getLogger(__name__)

PROMPT_VERSION = "v3.2"
LOW_CONFIDENCE_THRESHOLD = 0.7


class LLMClassifier:
    """Classify transactions using Groq chat completions."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "llama-3.3-70b-versatile",
        fallback_model: str = "llama-3.1-8b-instant",
    ) -> None:
        self.model = model
        self.fallback_model = fallback_model
        self.prompt_version = PROMPT_VERSION
        self._client = None
        self._cache: dict[str, dict] = {}

        if api_key:
            try:
                from groq import Groq
                self._client = Groq(api_key=api_key)
            except ImportError:
                logger.warning("groq package not installed. Run: pip install groq")

    @property
    def is_available(self) -> bool:
        return self._client is not None

    def classify_batch(self, items: list[dict]) -> list[dict]:
        """Classify uncached transactions and return one result per item."""
        if not items:
            return []

        results: list[Optional[dict]] = [None] * len(items)
        uncached_indices: list[int] = []

        for index, item in enumerate(items):
            cache_key = self._cache_key(item)
            cached = self._cache.get(cache_key)
            if cached:
                results[index] = cached.copy()
                results[index]["_from_cache"] = True
            else:
                uncached_indices.append(index)

        if uncached_indices and self._client:
            uncached_items = [items[index] for index in uncached_indices]

            llm_results = self._call_llm(uncached_items, self.model)
            if llm_results is None:
                logger.warning("Primary model failed; trying fallback model")
                llm_results = self._call_llm(uncached_items, self.fallback_model)
            if llm_results is None:
                llm_results = [self._fallback_result("Groq call failed")] * len(uncached_items)

            for uncached_index, llm_result in zip(uncached_indices, llm_results):
                results[uncached_index] = llm_result
                if self._is_cacheable(llm_result):
                    self._cache[self._cache_key(items[uncached_index])] = llm_result.copy()
        else:
            for index in uncached_indices:
                results[index] = self._fallback_result("Groq client unavailable")

        return [result or self._fallback_result("Missing classification result") for result in results]

    def classify_one(
        self,
        merchant_name: str,
        description: str = "",
        amount: float = 0,
        **kwargs,
    ) -> dict:
        item = {
            "merchant_name": merchant_name,
            "description": description,
            "amount": amount,
            **kwargs,
        }
        return self.classify_batch([item])[0]

    def get_cache_stats(self) -> dict:
        return {"cached_merchants": len(self._cache)}

    def _call_llm(self, items: list[dict], model: str) -> Optional[list[dict]]:
        categories_json = json.dumps(ALLOWED_CATEGORIES, ensure_ascii=False)
        # Embed explicit index in each item so the LLM mirrors it back reliably
        items_with_index = [{"index": i, **item} for i, item in enumerate(items)]
        transaction_payload = json.dumps(items_with_index, ensure_ascii=False, default=str, indent=2)

        system_prompt = f"""You are a financial transaction classifier for Israeli credit-card statements.
Classify each transaction into EXACTLY ONE of the allowed categories below.

ALLOWED CATEGORIES: {categories_json}

CONTEXT:
- Merchant names may be Hebrew, mixed Hebrew/English, or abbreviated. Ignore branch numbers and noise.
- בע"מ/בע''מ = company suffix (Ltd). סניף = branch. Ignore these.

KEY RULES:
1. Always pick a specific category. Use "Other" ONLY if no merchant signal exists whatsoever.
2. Groceries: שופרסל, רמי לוי, ויקטורי, מגה, AM:PM, סופר, SUPER, CARREFOUR
3. Restaurants / Cafes: ארומה, קפה, מסעדה, פיצה, MCDONALDS, KFC, BURGER, COFFEE, SUBWAY
4. Food Delivery: WOLT, וולט, 10BIS, תן ביס, UBER EATS, GLOVO
5. Fuel / Car: פז, סונול, דלק, פנגו, PANGO, חניה, YES PARKING, מוסך
6. Public Transport: רב-קו, רכבת, אגד, דן, מטרופולין
7. Health / Pharmacy: סופר פארם, SUPER PHARM, בית מרקחת, מכבי, לאומית, כללית
8. Utilities / Bills: חשמל, IEC, מים, גז, ארנונה, בזק, HOT, YES, PARTNER, CELLCOM, ORANGE, 012
9. Digital Services / Subscriptions: APPLE, GOOGLE, MICROSOFT, ADOBE, AMAZON, NETFLIX, SPOTIFY, ZOOM
10. Shopping / Clothing: ZARA, H&M, FOX, MANGO, CASTRO, NIKE, ADIDAS, IKEA, TERMINAL X
11. Travel: EL AL, אל על, HOTEL, מלון, AIRBNB, BOOKING, EXPEDIA
12. Banking Fees / Interest: עמלה, ריבית, הלוואה, BANK FEE
13. Cash Withdrawal: כספומט, ATM

Return strict JSON only:
{{
  "transactions": [
    {{
      "index": <must match input index>,
      "category": "<exact allowed category>",
      "subcategory": "<optional>",
      "confidence": <0.0-1.0>,
      "normalized_merchant_name": "<cleaned name>",
      "reason": "<one sentence>",
      "is_uncertain": <true if confidence < 0.7>
    }}
  ]
}}"""

        user_prompt = f"Classify these {len(items)} transactions:\n{transaction_payload}"

        try:
            response = self._client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=8192,
                temperature=0.0,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content.strip()
            parsed = json.loads(raw)
            assignments = parsed.get("transactions", parsed.get("results", parsed))
            return self._validate_and_align(assignments, len(items), model)
        except json.JSONDecodeError as exc:
            logger.error("Groq returned invalid JSON (model=%s): %s", model, exc)
            return None
        except Exception as exc:
            logger.error("Groq API call failed (model=%s): %s", model, exc)
            return None

    def _validate_and_align(
        self, assignments: list[dict] | dict, expected_count: int, model: str
    ) -> list[dict]:
        if isinstance(assignments, dict):
            assignments = assignments.get("transactions", assignments.get("results", []))
        if not isinstance(assignments, list):
            assignments = []

        by_index = {}
        for assignment in assignments:
            if not isinstance(assignment, dict):
                continue

            index = assignment.get("index", -1)
            category = str(assignment.get("category", "Other"))
            confidence = self._coerce_confidence(assignment.get("confidence", 0.0))
            is_uncertain = bool(assignment.get("is_uncertain", False)) or confidence < LOW_CONFIDENCE_THRESHOLD

            if category not in ALLOWED_CATEGORIES:
                category = self._find_closest_category(category)
                is_uncertain = True

            by_index[index] = {
                "category": category,
                "subcategory": str(assignment.get("subcategory", "")),
                "confidence": confidence,
                "normalized_merchant_name": str(assignment.get("normalized_merchant_name", "")),
                "reason": str(assignment.get("reason", "")),
                "is_uncertain": is_uncertain,
                "model": model,
                "prompt_version": self.prompt_version,
            }

        return [
            by_index.get(index, self._fallback_result(f"Groq did not return result for item {index}"))
            for index in range(expected_count)
        ]

    @staticmethod
    def _find_closest_category(invalid_category: str) -> str:
        lower = invalid_category.lower()
        for valid in ALLOWED_CATEGORIES:
            if valid.lower() in lower or lower in valid.lower():
                return valid

        mapping = {
            "food delivery": "Food Delivery",
            "delivery": "Food Delivery",
            "restaurant": "Restaurants / Cafes",
            "cafe": "Restaurants / Cafes",
            "dining": "Restaurants / Cafes",
            "supermarket": "Groceries",
            "grocery": "Groceries",
            "transport": "Transportation",
            "taxi": "Transportation",
            "parking": "Fuel / Car",
            "fuel": "Fuel / Car",
            "car": "Fuel / Car",
            "bus": "Public Transport",
            "train": "Public Transport",
            "pharmacy": "Health / Pharmacy",
            "health": "Health / Pharmacy",
            "clothing": "Shopping / Clothing",
            "shopping": "Shopping / Clothing",
            "beauty": "Beauty / Cosmetics",
            "cosmetic": "Beauty / Cosmetics",
            "subscription": "Digital Services / Subscriptions",
            "digital": "Digital Services / Subscriptions",
            "utility": "Utilities / Bills",
            "bill": "Utilities / Bills",
            "bank": "Banking Fees / Interest",
            "fee": "Banking Fees / Interest",
            "interest": "Banking Fees / Interest",
            "atm": "Cash Withdrawal",
            "cash": "Cash Withdrawal",
        }
        for key, category in mapping.items():
            if key in lower:
                return category
        return "Other"

    @staticmethod
    def _coerce_confidence(value: object) -> float:
        try:
            return max(0.0, min(1.0, float(value)))
        except (TypeError, ValueError):
            return 0.0

    def _fallback_result(self, reason: str) -> dict:
        return {
            "category": "Other",
            "subcategory": "",
            "confidence": 0.0,
            "normalized_merchant_name": "",
            "reason": reason,
            "is_uncertain": True,
            "model": self.model,
            "prompt_version": self.prompt_version,
        }

    @staticmethod
    def _is_cacheable(result: dict) -> bool:
        return (
            result.get("category") != "Other"
            and float(result.get("confidence", 0.0)) >= LOW_CONFIDENCE_THRESHOLD
            and not result.get("is_uncertain", False)
        )

    @staticmethod
    def _cache_key(item: dict) -> str:
        merchant = str(item.get("normalized_merchant_name") or item.get("merchant_name") or "").strip().lower()
        currency = str(item.get("currency") or "").strip().lower()
        return f"{merchant}|{currency}"
