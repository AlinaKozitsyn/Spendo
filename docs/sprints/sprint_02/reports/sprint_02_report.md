# Sprint 02 — Report

| Field | Value |
|-------|-------|
| **Sprint** | 02 |
| **Date** | 2026-05-05 |
| **Status** | Complete |

---

## 1. LLM Classification Fixes

### Problem
All transactions were landing in "Other". Root causes:
1. `GROQ_API_KEY` never reached the Groq client — `.env` file existed but `python-dotenv` was not installed and `load_dotenv()` was not called.
2. Free-tier 12,000 TPM limit: a single request for a full statement (100+ transactions) hit 18,000+ tokens and returned HTTP 413.

### What was delivered
- Added `python-dotenv` dependency; added `load_dotenv()` call in `backend/config/settings.py`
- Rewrote LLM prompt: Israeli merchant glossary (שופרסל, פז, רב-קו, …), explicit category rules, hard rule "Other is forbidden unless zero merchant signal"
- Implemented `BATCH_SIZE=12` + `time.sleep(6)` between batches to stay within free-tier rate limit
- **After user upgraded to Groq Pro**: removed all batching — single request per file, no sleep, significantly faster classification

---

## 2. UI & Design System

### What was delivered

**Global theme** (`frontend/src/styles.css`)
- CSS variables: `--color-bg: #030a18`, `--color-surface`, `--glass-blur: blur(18px)`
- Body: 4-layer radial nebula gradients on `#030a18`
- All cards: `backdrop-filter: blur(18px)` + subtle `inset 0 1px 0` highlight

**SpaceBackground** (`frontend/src/components/SpaceBackground.tsx`)
- Canvas RAF animation, 420 stars with fractional positions
- 4% chance of "bright" star with radial gradient glow halo
- All stars twinkle via `sin(t × speed + phase)`

**SpendingPieChart** — full rewrite to pure SVG 3D geometry
- Custom `topPath()` / `sidePath()` functions for elliptical wedge faces
- Painter's algorithm: sort slices by `sin(midAngle)` for correct occlusion
- Hover pop-out via SVG translate; mouse-following tooltip
- No CSS perspective (avoids tooltip position skew)

**SpendingBarChart** — custom `Bar3D` Recharts shape
- Top face (lightened hex) + right side wall (darkened hex) polygons
- Per-bar colors from shared `CHART_COLORS` palette
- YAxis hidden; color legend rendered below chart

---

## 3. Multi-Month Comparison Mode

### Backend (`backend/api/main.py`)
Three new endpoints, completely isolated from single-month `_state`:
- `POST /api/v1/upload-slot/{slot}` — full parse → classify pipeline, stores in `_multi_state[slot]`
- `GET /api/v1/multi-summary` — returns per-slot summaries with categories and top merchants
- `DELETE /api/v1/upload-slot/{slot}` — clears one slot

### Frontend

| Component | Description |
|-----------|-------------|
| `MultiUploadArea` | 3-card grid; each slot cycles empty → uploading → done (shows label, tx count, total) → error; Remove button |
| `TrendChart` | Pill toggle: **Total Spending** (area chart) vs **By Category** (multi-line); clicking legend items hides/shows individual category lines |
| `CategoryStackChart` | Stacked bar per month; custom tooltip shows only non-zero categories sorted by value with total row; `cursor` fixed to dark theme (was beige) |

**Mode toggle** — "1 Month" / "3 Months" pill in the header; both modes fully independent, no shared state.

---

## 4. Analytics Insights — 1-Month Dashboard

### AnomalyPanel
Three detection types:
- **Outlier transactions**: amount > 3× mean, sorted by severity, capped at top 4
- **Duplicate charges**: same merchant + same amount appearing ≥2× (Medium), ≥3× (High)
- **Category spikes**: any category > 40% of total spend

BiDi fixes for Hebrew merchants:
- Merchant name in `unicode-bidi: isolate` span
- Count badge (`×2`) rendered as separate LTR element outside the span
- Detail line forced `dir="ltr"` so amounts don't reverse

### SpendingVelocityPanel
- **Day-of-week heatmap** — 7 uniform boxes (all same base color); click to select
  - On click: KPI updates to avg transaction size on that day; category bars filter to that day's transactions only; section titles update
  - `direction: ltr` on the grid container to fix RTL page reversing day order
- **Cumulative spending** — AreaChart showing running total over the month
- **Avg transaction by category** — horizontal bar list; responds to day filter

---

## 5. Multi-Month Forecast

### MultiMonthForecast
Outlier-resistant projection using `robustMean()`:
- **2 months**: averages unless high value is >1.8× the low (then uses the low)
- **3+ months**: drops the top value if it is >2× the median, then averages remainder
- Per-category projections with the same trimming logic
- Trend arrows per category (↑ red, ↓ green, → neutral) based on first→last month change
- Amber notice banner when trimming materially changes the projection (>12% difference)

---

## Bugs found & fixed

| # | Bug | Severity | Fix |
|---|-----|----------|-----|
| 1 | GROQ_API_KEY never loaded — all "Other" | Critical | `load_dotenv()` in settings.py |
| 2 | 413 token limit on free tier | Critical | Batch size 12 + sleep(6) |
| 3 | Bar chart Y-axis labels overlapping bars | High | Hide YAxis, render color legend below |
| 4 | Tooltip positions skewed by CSS 3D perspective | High | Replaced with pure SVG 3D geometry |
| 5 | Day-of-week heatmap reversed (RTL page) | Medium | `direction: ltr` on grid container |
| 6 | Heatmap click did nothing | Medium | Filter KPI + category bars on click |
| 7 | Hebrew merchant + English suffix BiDi scramble | Medium | `unicode-bidi: isolate` + `dir="ltr"` on detail |
| 8 | Category stack tooltip showed all rows including zeros | Low | Filter `value > 0`, sort descending |
| 9 | Stacked bar hover rectangle showed beige background | Low | `cursor={{ fill: "rgba(255,255,255,0.04)" }}` |

---

## New Files

### Frontend
```
src/components/SpaceBackground.tsx
src/components/MultiUploadArea.tsx
src/components/TrendChart.tsx          (replaces MonthlyTrendChart.tsx)
src/components/CategoryStackChart.tsx
src/components/AnomalyPanel.tsx
src/components/SpendingVelocityPanel.tsx
src/components/ForecastPanel.tsx       (1-month, removed from dashboard after review)
src/components/BudgetScorePanel.tsx    (removed from dashboard after review)
src/components/MultiMonthForecast.tsx
```

### Backend
```
backend/.env                           (GROQ_API_KEY, model settings)
```

---

## Key decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| 3D pie chart | Pure SVG, no CSS transform | CSS `perspective` skews tooltip hit positions |
| Multi-month state | Separate `_multi_state` dict | Never risk corrupting single-month data |
| Heatmap colors | Uniform base, only selected changes | User feedback: intensity-based opacity looked inconsistent |
| Forecast outlier method | Robust mean (trim top if >2× median) | IQR needs 4+ data points; this works with 2–3 months |
| BiDi fix | `unicode-bidi: isolate` + `dir="ltr"` on amounts | Separate bidi contexts per element rather than forcing global direction |

---

## Sprint 3 — Starting Point

The app is functionally complete for local use. Sprint 3 focus: make it **real** (production-ready, deployed, persistent).

Likely scope:
- User authentication
- Database persistence (replace in-memory `_state`)
- Cloud deployment (backend API + frontend static hosting)
- File storage (S3 or equivalent) instead of local uploads dir
- Budget goal setting (enables real Budget Adherence scoring)
