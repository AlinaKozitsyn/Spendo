import { useMemo } from "react";
import type { SlotSummary } from "../types";

interface Props {
  slots: SlotSummary[];
}

interface CatProjection {
  name: string;
  values: number[];      // one per slot (raw)
  projected: number;     // outlier-trimmed estimate
  trend: "up" | "down" | "stable";
  trendPct: number;
}

// ── Outlier-resistant average ─────────────────────────────────────────────
// With ≥3 values: drop the highest if it is >2× the median of the rest.
// With 2 values:  use the lower one (more conservative).
function robustMean(vals: number[]): number {
  if (vals.length === 0) return 0;
  if (vals.length === 1) return vals[0];

  const sorted = [...vals].sort((a, b) => a - b);

  if (vals.length === 2) {
    // Two months: average, but cap at 1.5× the lower value to damp one-off spikes
    const [lo, hi] = sorted;
    return hi > lo * 1.8 ? lo : (lo + hi) / 2;
  }

  // 3+ months: trim the top value if it is >2× the median
  const mid = sorted[Math.floor(sorted.length / 2)];
  const top = sorted[sorted.length - 1];
  const cleaned = top > mid * 2 ? sorted.slice(0, -1) : sorted;
  return cleaned.reduce((s, v) => s + v, 0) / cleaned.length;
}

function trendDirection(vals: number[]): { trend: "up" | "down" | "stable"; pct: number } {
  if (vals.length < 2) return { trend: "stable", pct: 0 };
  const first = vals[0], last = vals[vals.length - 1];
  if (first === 0) return { trend: "stable", pct: 0 };
  const pct = ((last - first) / first) * 100;
  if (pct > 8)  return { trend: "up",   pct };
  if (pct < -8) return { trend: "down", pct };
  return { trend: "stable", pct };
}

const TREND_ICON  = { up: "↑", down: "↓", stable: "→" };
const TREND_COLOR = {
  up:     "var(--color-danger)",
  down:   "var(--color-success)",
  stable: "var(--color-text-secondary)",
};

const BAR_COLOR = "linear-gradient(90deg, #38bdf8, #818cf8)";

export function MultiMonthForecast({ slots }: Props) {
  const { projectedTotal, dailyRate, catProjections, outlierNote } = useMemo(() => {
    if (slots.length === 0) return { projectedTotal: 0, dailyRate: 0, catProjections: [], outlierNote: "" };

    // ── Total projection ──────────────────────────────────────────────────
    const totals = slots.map((s) => s.total_spent);
    const projectedTotal = Math.round(robustMean(totals));
    const avgDays = slots.reduce((s, sl) => {
      // estimate days from transaction count / assumed ~3 tx/day
      return s + Math.max(1, sl.transaction_count / 3);
    }, 0) / slots.length;
    const dailyRate = Math.round(projectedTotal / 30);

    // Flag if we trimmed an outlier month
    const rawMean = Math.round(totals.reduce((s, v) => s + v, 0) / totals.length);
    const outlierNote = Math.abs(rawMean - projectedTotal) > projectedTotal * 0.12
      ? `Raw average was ₪${rawMean.toLocaleString("he-IL")} — one outlier month was trimmed`
      : "";

    // ── Category projections ──────────────────────────────────────────────
    const allCats = Array.from(new Set(slots.flatMap((s) => s.categories.map((c) => c.name))));

    const catProjections: CatProjection[] = allCats.map((name) => {
      const values = slots.map((s) => {
        const found = s.categories.find((c) => c.name === name);
        return found ? found.total_spent : 0;
      });
      const projected = Math.round(robustMean(values));
      const { trend, pct: trendPct } = trendDirection(values);
      return { name, values, projected, trend, trendPct };
    })
    .filter((c) => c.projected > 0)
    .sort((a, b) => b.projected - a.projected)
    .slice(0, 8);

    return { projectedTotal, dailyRate, catProjections, outlierNote };
  }, [slots]);

  const maxCat = catProjections[0]?.projected ?? 1;

  return (
    <div className="forecast-root">
      {/* ── KPI row ── */}
      <div className="forecast-kpis">
        <div className="forecast-kpi">
          <div className="forecast-kpi-value" style={{ color: "var(--color-primary-light)" }}>
            ₪{projectedTotal.toLocaleString("he-IL")}
          </div>
          <div className="forecast-kpi-label">Projected next month</div>
        </div>
        <div className="forecast-kpi">
          <div className="forecast-kpi-value">
            ₪{dailyRate.toLocaleString("he-IL")}
          </div>
          <div className="forecast-kpi-label">Estimated daily spend</div>
        </div>
        <div className="forecast-kpi">
          <div className="forecast-kpi-value">{slots.length}</div>
          <div className="forecast-kpi-label">Months of data</div>
        </div>
      </div>

      {/* ── Outlier notice ── */}
      {outlierNote && (
        <div className="forecast-outlier-note">
          ℹ️ {outlierNote}
        </div>
      )}

      {/* ── Per-category projections ── */}
      <div className="forecast-section-title">Projected Spend by Category</div>
      <div className="forecast-cat-list">
        {catProjections.map((c) => (
          <div key={c.name} className="forecast-cat-row">
            <div className="forecast-cat-name">{c.name}</div>
            <div className="forecast-cat-bar-track">
              <div
                className="forecast-cat-bar-fill"
                style={{ width: `${(c.projected / maxCat) * 100}%`, background: BAR_COLOR }}
              />
            </div>
            <div className="forecast-cat-amt">₪{c.projected.toLocaleString("he-IL")}</div>
            <div
              className="forecast-cat-trend"
              style={{ color: TREND_COLOR[c.trend] }}
              title={`${c.trend === "stable" ? "Stable" : `${Math.abs(c.trendPct).toFixed(0)}% ${c.trend}`} vs first month`}
            >
              {TREND_ICON[c.trend]}
              {c.trend !== "stable" && (
                <span className="forecast-trend-pct">{Math.abs(c.trendPct).toFixed(0)}%</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="forecast-note">
        Projection uses outlier-trimmed average · Spike months excluded from estimate
      </div>
    </div>
  );
}
