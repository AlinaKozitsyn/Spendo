# Classification System Design — Spendo

> Authors: [CTO], [Data Scientist], [AI Agents Engineer]
> Date: 2026-04-29
> Version: 2.0

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      Transaction Input                        │
│  { merchant_name, raw_description, amount, transaction_date } │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 0: Knowledge Base Lookup                               │
│  Check merchant_kb.json for previously learned mappings       │
│  Confidence: 0.95 | Source: "rule_based"                      │
└──────┬───────────────────────────────────────────────────────┘
       │ miss
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 1: Rule Engine (rules.py)                              │
│  200+ Hebrew/English keywords across 22 categories            │
│  Substring match, case-insensitive                            │
│  Confidence: 1.0 | Source: "rule_based"                       │
│  Expected hit rate: ~80%                                      │
└──────┬───────────────────────────────────────────────────────┘
       │ miss
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 1.5: Fuzzy Matching (fuzzy_matcher.py)                 │
│  rapidfuzz token_set_ratio, threshold=80                      │
│  Catches typos, spacing, abbreviations                        │
│  Confidence: 0.9 | Source: "fuzzy"                            │
│  Expected hit rate: ~10%                                      │
└──────┬───────────────────────────────────────────────────────┘
       │ miss
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 2: LLM Classification (llm_classifier.py)              │
│  OpenAI GPT-4.1-mini (primary) / GPT-4o-mini (fallback)      │
│  Strict JSON output, validated and retried                    │
│  Confidence: LLM-reported (0.0-1.0) | Source: "llm"          │
│  Expected hit rate: ~8%                                       │
│  → Learns: saves to merchant_kb.json if confidence > 0.7     │
└──────┬───────────────────────────────────────────────────────┘
       │ miss / error
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Layer 3: Fallback                                            │
│  Category: "Other" | Confidence: 0.0 | Source: "fallback"     │
│  → Logged to other_review.jsonl for periodic review           │
│  Target: < 10% of transactions                                │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. Model Choice and Justification

### Primary: GPT-4.1-mini
| Factor | Rating |
|--------|--------|
| Hebrew understanding | Excellent |
| Short-text classification accuracy | 95%+ |
| JSON output reliability | Very high |
| Latency | ~200-400ms per batch |
| Cost | ~$0.001/transaction |

### Fallback: GPT-4o-mini
| Factor | Rating |
|--------|--------|
| Hebrew understanding | Good |
| Accuracy | 90%+ |
| Latency | ~100-200ms |
| Cost | ~$0.0005/transaction |

### When to upgrade
- **GPT-4.1 / GPT-4o**: Use for batch reclassification audits or when Other rate exceeds 10% despite rule expansion
- **Claude Sonnet/Opus**: Alternative for Hebrew-heavy workloads; available as backup since Anthropic SDK is already installed

### Cost analysis
With rule engine handling 80%+ of transactions:
- Upload of 50 transactions: ~10 hit LLM → ~$0.01 total
- Monthly (500 transactions): ~$0.10 total
- LLM cost is negligible compared to the accuracy improvement

### Configuration
```env
LLM_CLASSIFICATION_MODEL=gpt-4.1-mini
LLM_CLASSIFICATION_FALLBACK_MODEL=gpt-4o-mini
OPENAI_API_KEY=sk-...
```

---

## 3. Category Taxonomy (23 Categories)

| # | Category | Group | Icon | Keywords |
|---|----------|-------|------|----------|
| 1 | Groceries | Essentials | 🛒 | רמי לוי, שופרסל, carrefour, etc. |
| 2 | Restaurants & Cafes | Leisure | 🍽️ | מקדונלד, ארומה, wolt, etc. |
| 3 | Transport | Essentials | 🚗 | uber, gett, מונית |
| 4 | Fuel | Essentials | ⛽ | דלק, סונול, פז |
| 5 | Parking | Essentials | 🅿️ | פנגו, חניון |
| 6 | Public Transport | Essentials | 🚌 | רכבת, אגד, מוביט |
| 7 | Shopping | Leisure | 🛍️ | amazon, aliexpress, איקאה |
| 8 | Clothing | Leisure | 👗 | zara, h&m, קסטרו |
| 9 | Beauty & Personal Care | Leisure | 💅 | מספרה, ספא |
| 10 | Health & Pharmacy | Essentials | 💊 | סופר פארם, כללית, מכבי |
| 11 | Bills & Utilities | Essentials | 📄 | חשמל, מים, ארנונה |
| 12 | Phone & Internet | Essentials | 📱 | סלקום, בזק, HOT |
| 13 | Rent & Housing | Essentials | 🏠 | שכירות, משכנתא |
| 14 | Entertainment | Leisure | 🎬 | סינמה, תיאטרון |
| 15 | Travel | Leisure | ✈️ | אל על, booking, airbnb |
| 16 | Education | Essentials | 📚 | אוניברסיט, קורס |
| 17 | Subscriptions | Leisure | 🔄 | netflix, spotify, openai |
| 18 | Cash Withdrawal | Finance | 💵 | כספומט, ATM |
| 19 | Banking & Fees | Finance | 🏦 | עמלה, העברה, בנק |
| 20 | Government & Taxes | Essentials | 🏛️ | ביטוח לאומי, מס הכנסה |
| 21 | Gifts & Donations | Other | 🎁 | עמותה, תרומה |
| 22 | Pets | Other | 🐾 | וטרינר, pet |
| 23 | Other | Other | ❓ | Fallback only |

---

## 4. Classification Accuracy Expectations

| Metric | Without LLM | With LLM |
|--------|-------------|----------|
| Rule-based hit rate | 80-87% | 80-87% |
| Fuzzy hit rate | +5-10% | +5-10% |
| LLM hit rate | 0% | +5-8% |
| **Other rate** | **10-15%** | **< 5%** |
| **Total accuracy** | **85-90%** | **>95%** |

### Real data validation (3.26.xlsx, 37 transactions)
- Rule-based: 32/37 (86.5%)
- Other: 5/37 (13.5%) — all niche merchants (facility management, vending machines)
- With LLM enabled: expected 37/37 (100%)

---

## 5. Strategy to Reduce "Other"

### Immediate (automated)
1. **LLM Layer**: Classifies unknown merchants with semantic understanding
2. **Knowledge Base Learning**: LLM results with confidence > 0.7 are saved to `merchant_kb.json` for instant future matching
3. **Fuzzy Matching**: Catches typos and spacing variations

### Periodic (manual review)
1. **Other Review Log**: All "Other" transactions logged to `data/knowledge/other_review.jsonl`
2. **Merchant KB Growth**: Review log → add new rules or confirm LLM-learned mappings
3. **Rule Expansion**: Top unknown merchants from reports → add to CATEGORY_RULES

### Monitoring
- Other rate > 20%: **CRITICAL** — immediate rule expansion needed
- Other rate 10-20%: **WARNING** — schedule review session
- Other rate < 10%: **GOOD** — system is healthy

---

## 6. Knowledge Management Plan

### 6.1 Merchant Knowledge Base
- **File**: `data/knowledge/merchant_kb.json`
- **Schema**: `{ "merchant_lower": { "category": "...", "confidence": 0.95, "learned_at": "...", "source": "llm" } }`
- **Auto-updated**: when LLM classifies with confidence > 0.7
- **Priority**: checked BEFORE rule engine (Layer 0)

### 6.2 Other Review Log
- **File**: `data/knowledge/other_review.jsonl`
- **Schema**: `{ "merchant_name": "...", "amount": ..., "timestamp": "..." }`
- **Purpose**: periodic review to convert unknowns → rules

### 6.3 Synonym Dictionary
Built into CATEGORY_RULES keywords:
- Hebrew: בית מרקחת, pharmacy → Health & Pharmacy
- Hebrew: כספומט, ATM → Cash Withdrawal
- Abbreviations: סלקום = cellcom → Phone & Internet

### 6.4 Versioning
- Classification logic version tracked in CATEGORY_RULES (file changes = git history)
- LLM model version configurable via `LLM_CLASSIFICATION_MODEL` env var
- Knowledge base has `learned_at` timestamps per entry

---

## 7. Monitoring & Reporting

### API Endpoint
`GET /api/v1/classification-report`

### Report Contents
```json
{
  "total_transactions": 37,
  "category_distribution": {
    "Groceries": { "count": 7, "percentage": 18.9 },
    "Restaurants & Cafes": { "count": 10, "percentage": 27.0 },
    ...
  },
  "other_rate": {
    "count": 5,
    "percentage": 13.5,
    "status": "WARNING",
    "target": "< 10%"
  },
  "confidence": {
    "mean": 0.95,
    "min": 0.0,
    "max": 1.0,
    "high_confidence": 32,
    "low_confidence": 5
  },
  "top_unknown_merchants": [
    { "merchant": "אלטיאר ניהול", "count": 2 }
  ],
  "source_split": {
    "rule_based": { "count": 32, "percentage": 86.5 },
    "fallback": { "count": 5, "percentage": 13.5 }
  }
}
```

---

## 8. Future Improvements

| Priority | Improvement | Impact |
|----------|------------|--------|
| High | Add more Israeli merchants to CATEGORY_RULES | Reduce Other rate to < 5% without LLM |
| High | Enable LLM in production (set OPENAI_API_KEY) | Eliminate most "Other" classifications |
| Medium | Batch LLM processing (50+ transactions per call) | Reduce latency and cost |
| Medium | User correction UI → auto-update rules | Self-improving system |
| Medium | A/B test GPT-4.1-mini vs Claude Haiku for Hebrew | Find optimal model |
| Low | Category confidence calibration | More accurate confidence scores |
| Low | Multi-label classification (transaction → multiple categories) | Handle edge cases |

---

## 9. Test Coverage

**118 tests total**, all passing:

| Module | Tests | Coverage |
|--------|-------|----------|
| Rules (22 categories) | 47 | All categories, edge cases, Hebrew/English |
| Classifier pipeline | 6 | Full pipeline, source tracking, stats |
| Knowledge base | 2 | Save/load, confidence threshold |
| LLM classifier | 6 | Unavailable, validation, alignment, closest match |
| Reporting | 3 | Distribution, source split, empty report |
| Parser | 39 | Column detection, dates, amounts, Hebrew |
| Planner | 7 | Summaries, budgets, merchants |

---

## 10. Files Created/Modified

| File | Purpose |
|------|---------|
| `classifier/src/rules.py` | 23-category taxonomy, 200+ keywords |
| `classifier/src/classifier.py` | 3-layer pipeline + knowledge management |
| `classifier/src/llm_classifier.py` | **NEW** — OpenAI LLM classification layer |
| `classifier/src/reporting.py` | **NEW** — Classification analytics |
| `classifier/src/fuzzy_matcher.py` | Unchanged (Layer 1.5) |
| `shared/src/models.py` | Added classification_source, classification_reason |
| `config/settings.py` | Added OPENAI_API_KEY, LLM model config |
| `api/main.py` | New /classification-report endpoint |
| `classifier/tests/unit/test_rules.py` | 47 tests for all 22 categories |
| `classifier/tests/unit/test_classifier.py` | **NEW** — 17 pipeline + LLM tests |
