"""
Tests for Groq-first transaction classification.
"""

from datetime import date
import tempfile

from backend.modules.shared.src import ClassifiedTransaction, Transaction
from backend.modules.classifier.src.classifier import ClassificationAgent
from backend.modules.classifier.src.llm_classifier import LLMClassifier
from backend.modules.classifier.src.reporting import generate_classification_report


def make_txn(
    merchant: str,
    amount: float = 100.0,
    description: str = "",
    raw_row: dict | None = None,
) -> Transaction:
    return Transaction(
        transaction_id="test123",
        transaction_date=date(2025, 3, 1),
        merchant_name=merchant,
        amount=amount,
        description=description,
        raw_row=raw_row,
    )


class FakeLLM:
    is_available = True

    def __init__(self, results: list[dict]):
        self.results = results
        self.items: list[dict] = []

    def classify_batch(self, items: list[dict]) -> list[dict]:
        self.items = items
        return self.results

    def get_cache_stats(self) -> dict:
        return {"cached_merchants": 0}


class TestClassificationPipeline:
    def test_all_transactions_are_sent_to_llm(self):
        agent = ClassificationAgent(use_ai_fallback=False)
        fake = FakeLLM([
            {
                "category": "Groceries",
                "subcategory": "Supermarket",
                "confidence": 0.95,
                "reason": "Israeli supermarket",
                "normalized_merchant_name": "Shufersal",
                "is_uncertain": False,
            },
            {
                "category": "Digital Services / Subscriptions",
                "subcategory": "Streaming",
                "confidence": 0.91,
                "reason": "Streaming subscription",
                "normalized_merchant_name": "Netflix",
                "is_uncertain": False,
            },
        ])
        agent._llm = fake

        results = agent.classify_all([
            make_txn("שופרסל דיל"),
            make_txn("NETFLIX.COM"),
        ])

        assert [item["merchant_name"] for item in fake.items] == ["שופרסל דיל", "NETFLIX.COM"]
        assert results[0].category.name == "Groceries"
        assert results[0].classification_source == "llm"
        assert results[1].category.name == "Digital Services / Subscriptions"

    def test_llm_payload_includes_raw_fields_and_context(self):
        agent = ClassificationAgent(use_ai_fallback=False)
        fake = FakeLLM([
            {
                "category": "Health / Pharmacy",
                "subcategory": "Pharmacy",
                "confidence": 0.88,
                "reason": "Pharmacy purchase",
                "normalized_merchant_name": "Super-Pharm",
                "is_uncertain": False,
            },
        ])
        agent._llm = fake

        agent.classify_all([
            make_txn(
                "סופר פארם",
                amount=42.5,
                description="חיוב כרטיס",
                raw_row={"שם בית עסק": "סופר פארם", "סכום חיוב": 42.5},
            )
        ])

        payload = fake.items[0]
        assert payload["merchant_name"] == "סופר פארם"
        assert payload["description"] == "חיוב כרטיס"
        assert payload["amount"] == 42.5
        assert payload["date"] == "2025-03-01"
        assert payload["raw_fields"]["שם בית עסק"] == "סופר פארם"

    def test_low_confidence_is_marked_for_review(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            agent = ClassificationAgent(use_ai_fallback=False, knowledge_dir=tmpdir)
            agent._llm = FakeLLM([
                {
                    "category": "Home",
                    "subcategory": "Household",
                    "confidence": 0.45,
                    "reason": "Ambiguous home-related merchant",
                    "normalized_merchant_name": "Unknown Home",
                    "is_uncertain": True,
                },
            ])

            result = agent.classify_one(make_txn("עסק לא ברור"))

            assert result.category.name == "Home"
            assert result.confidence == 0.45
            assert "marked_for_review" in result.classification_reason
            assert agent.get_classification_report()["review_required"] == 1

    def test_no_groq_available_is_technical_fallback_only(self):
        agent = ClassificationAgent(use_ai_fallback=False)
        result = agent.classify_one(make_txn("שופרסל דיל"))

        assert result.category.name == "Other"
        assert result.classification_source == "fallback"
        assert result.confidence == 0.0

    def test_no_merchant_knowledge_base_is_created(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            agent = ClassificationAgent(use_ai_fallback=False, knowledge_dir=tmpdir)
            assert not hasattr(agent, "_merchant_kb")
            assert not hasattr(agent, "_learn_merchant")


class TestLLMClassifier:
    def test_unavailable_returns_technical_fallback(self):
        llm = LLMClassifier(api_key=None)
        results = llm.classify_batch([
            {"merchant_name": "test", "description": "", "amount": 100},
        ])
        assert results[0]["category"] == "Other"
        assert results[0]["reason"] == "Groq client unavailable"

    def test_validate_and_align_accepts_json_object_shape(self):
        llm = LLMClassifier(api_key=None)
        raw = {
            "transactions": [
                {
                    "index": 0,
                    "category": "Groceries",
                    "confidence": 0.95,
                    "reason": "supermarket",
                },
            ]
        }
        result = llm._validate_and_align(raw, 1, "test-model")
        assert result[0]["category"] == "Groceries"
        assert result[0]["model"] == "test-model"

    def test_validate_and_align_invalid_category_maps_to_taxonomy(self):
        llm = LLMClassifier(api_key=None)
        result = llm._validate_and_align([
            {"index": 0, "category": "Subscription", "confidence": 0.9},
        ], 1, "test-model")
        assert result[0]["category"] == "Digital Services / Subscriptions"
        assert result[0]["is_uncertain"] is True

    def test_missing_llm_item_becomes_fallback(self):
        llm = LLMClassifier(api_key=None)
        result = llm._validate_and_align([], 1, "test-model")
        assert result[0]["category"] == "Other"
        assert result[0]["confidence"] == 0.0

    def test_low_confidence_marks_uncertain(self):
        llm = LLMClassifier(api_key=None)
        result = llm._validate_and_align([
            {"index": 0, "category": "Home", "confidence": 0.4},
        ], 1, "test-model")
        assert result[0]["is_uncertain"] is True

    def test_cache_hit_for_repeated_merchant(self):
        llm = LLMClassifier(api_key=None)
        llm._cache["test merchant|ils"] = {
            "category": "Groceries",
            "subcategory": "Supermarket",
            "confidence": 0.95,
            "reason": "cached",
            "normalized_merchant_name": "Test Merchant",
            "is_uncertain": False,
            "model": "test",
            "prompt_version": "test",
        }
        results = llm.classify_batch([
            {"merchant_name": "Test Merchant", "currency": "ILS", "amount": 100},
        ])
        assert results[0]["category"] == "Groceries"
        assert results[0]["_from_cache"] is True


class TestClassificationReport:
    def _make_classified(self, cat_name: str, source: str = "llm", confidence: float = 1.0):
        from backend.modules.shared.src import Category
        return ClassifiedTransaction(
            transaction=make_txn("test"),
            category=Category(name=cat_name, group="Test", icon=""),
            confidence=confidence,
            classification_source=source,
        )

    def test_basic_report(self):
        classified = [
            self._make_classified("Groceries"),
            self._make_classified("Groceries"),
            self._make_classified("Fuel / Car"),
            self._make_classified("Other", source="fallback", confidence=0.0),
        ]
        report = generate_classification_report(classified)
        assert report["total_transactions"] == 4
        assert report["category_distribution"]["Groceries"]["count"] == 2
        assert report["other_rate"]["count"] == 1

    def test_source_split(self):
        classified = [
            self._make_classified("Groceries", source="llm"),
            self._make_classified("Other", source="fallback", confidence=0.0),
        ]
        report = generate_classification_report(classified)
        assert "llm" in report["source_split"]
        assert "fallback" in report["source_split"]

    def test_empty_report(self):
        report = generate_classification_report([])
        assert report["total"] == 0
