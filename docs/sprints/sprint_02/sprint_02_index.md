# Sprint 02 — Dashboard UI Overhaul & Analytics Insights

| Field | Value |
|-------|-------|
| **Sprint** | 02 |
| **Goal** | Rebuild the frontend into a production-quality dashboard: space-themed dark UI, 3D charts, multi-month comparison mode, and a full analytics insights layer |
| **Status** | Complete |
| **Start** | 2026-05-05 |
| **End** | 2026-05-05 |

---

## Scope

### Theme 1 — UI & Visualisation
1. Dark glassmorphism design system (CSS variables, blur cards, nebula gradients)
2. Animated starfield canvas background
3. 3D SVG pie chart (painter's algorithm, hover pop-out, custom tooltip)
4. 3D bar chart (custom Recharts shape, per-bar colors, legend)
5. Fix overlapping axis labels on bar chart

### Theme 2 — LLM Classification Fixes
6. Root-cause: missing `.env` / GROQ_API_KEY not loaded → add `python-dotenv`
7. Token limit 413 errors on free tier → batching + `sleep(6)` between batches
8. Prompt rewrite: Hebrew merchant glossary, "Other is forbidden" rule
9. Remove batching after user upgraded to Groq Pro account

### Theme 3 — Multi-Month Comparison Mode
10. Backend: `_multi_state` + three new endpoints (upload-slot, multi-summary, clear-slot)
11. Frontend types: `SlotUploadResponse`, `SlotSummary`, `MultiSummary`
12. API functions: `uploadFileToSlot`, `fetchMultiSummary`, `clearSlot`
13. `MultiUploadArea` — 3-slot upload grid with empty/uploading/done/error states
14. `MonthlyTrendChart` → replaced by `TrendChart` with Total / By Category toggle
15. `CategoryStackChart` — stacked bar with custom tooltip (zero-filtered, sorted)
16. Mode toggle ("1 Month" / "3 Months") in header

### Theme 4 — Analytics Insights (1-month)
17. `AnomalyPanel` — outlier transactions (3×+), duplicate charges, category spikes; BiDi-safe rendering for Hebrew merchants
18. `SpendingVelocityPanel` — day-of-week heatmap (clickable, filters category bars), cumulative spending chart, avg transaction by category
19. `ForecastPanel` (removed from 1-month after sprint review)
20. `BudgetScorePanel` (removed from 1-month after sprint review)

### Theme 5 — Multi-Month Forecast
21. `MultiMonthForecast` — outlier-trimmed projection using robust mean (drops spike months), per-category bars with trend arrows (↑↓→), outlier notice banner

---

## Exit Criteria

- [x] Single-month dashboard fully functional with all insight cards
- [x] Multi-month mode: upload 3 files, see comparison charts + forecast
- [x] LLM classification working end-to-end with Groq Pro
- [x] Zero TypeScript errors (`tsc --noEmit` clean)
- [x] BiDi text issues resolved for Hebrew merchant names
- [x] RTL day-order bug fixed in heatmap

---

## Artifacts

- Sprint index: `docs/sprints/sprint_02/sprint_02_index.md` (this file)
- Report: `docs/sprints/sprint_02/reports/sprint_02_report.md`
- New frontend components: see report for full list
- Backend changes: `backend/api/main.py`, `backend/modules/classifier/src/llm_classifier.py`
