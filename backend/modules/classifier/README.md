# ClassificationAgent

## Purpose
Classifies `Transaction` objects into `ClassifiedTransaction` objects by using
Groq-hosted LLM semantic classification as the primary classifier.

## Strategy
1. Normalize parsed transaction fields into an LLM request payload.
2. Send uncached transactions to Groq using `llama-3.3-70b-versatile`.
3. Validate strict JSON against the fixed taxonomy in `src/rules.py`.
4. Cache repeated high-confidence merchant classifications in memory.
5. Log low-confidence, uncertain, `Other`, or technical fallback results to
   `classification_review.jsonl` for human review.

The classifier does not maintain merchant-specific rules and does not create
new rules when a classification is wrong.

## Public API

```python
from backend.modules.classifier import ClassificationAgent

agent = ClassificationAgent()  # reads GROQ_API_KEY from env
results = agent.classify_all(transactions)
```

## Configuration

```env
GROQ_API_KEY=gsk_...
LLM_CLASSIFICATION_MODEL=llama-3.3-70b-versatile
LLM_CLASSIFICATION_FALLBACK_MODEL=llama-3.1-8b-instant
```

## Tests

```bash
python -m pytest backend/modules/classifier/tests/unit -q
```
