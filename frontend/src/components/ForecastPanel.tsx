import { useMemo } from "react";
import type { Transaction, CategoryInfo } from "../types";

interface Props {
  transactions: Transaction[];
  categories: CategoryInfo[];
  totalSpent: number;
}

interface CatForecast {
  name: string;
  icon: string | null;
  current: number;
  projected: number;
  pct: number;        // % of total
  dailyRate: number;
}

function daysInRange(transactions: Transaction[]): number {
  if (transactions.length < 2) return 1;
  const dates = transactions.map((t) => new Date(t.date).getTime());
  const span  = Math.max(...dates) - Math.min(...dates);
  return Math.max(1, Math.round(span / 86_400_000) + 1);
}

export function ForecastPanel({ transactions, categories, totalSpent }: Props) {
  const data = useMemo(() => {
    if (!transactions.length) return null;

    const elapsed = daysInRange(transactions);
    const dailyRate = totalSpent / elapsed;
    const projected30 = Math.round(dailyRate * 30);

    // Per-category forecasts
    const catForecasts: CatForecast[] = categories.map((cat) => {
      const catRate = cat.total_spent / elapsed;
      return {
        name: cat.name,
        icon: cat.icon,
        current: cat.total_spent,
        projected: Math.round(catRate * 30),
        pct: totalSpent > 0 ? (cat.total_spent / totalSpent) * 100 : 0,
        dailyRate: catRate,
      };
    }).sort((a, b) => b.projected - a.projected).slice(0, 6);

    // Days until ₪10k (example milestone)
    const milestone = Math.ceil(projected30 * 0.8);
    const daysToMilestone = dailyRate > 0 ? Math.ceil((milestone - totalSpent) / dailyRate) : null;

    return { elapsed, dailyRate, projected30, catForecasts, milestone, daysToMilestone };
  }, [transactions, categories, totalSpent]);

  if (!data) return <div className="loading">No data</div>;

  const { elapsed, dailyRate, projected30, catForecasts } = data;
  const maxProjected = catForecasts[0]?.projected ?? 1;

  // Color bar based on projection vs current
  const overratio = totalSpent > 0 ? projected30 / totalSpent : 1;
  const projColor = overratio > 2.5 ? "var(--color-danger)"
                  : overratio > 1.5 ? "var(--color-warning)"
                  : "var(--color-success)";

  return (
    <div className="forecast-root">
      {/* ── KPI row ── */}
      <div className="forecast-kpis">
        <div className="forecast-kpi">
          <div className="forecast-kpi-value" style={{ color: projColor }}>
            ₪{projected30.toLocaleString("he-IL")}
          </div>
          <div className="forecast-kpi-label">Projected 30-day total</div>
        </div>

        <div className="forecast-kpi">
          <div className="forecast-kpi-value">
            ₪{Math.round(dailyRate).toLocaleString("he-IL")}
          </div>
          <div className="forecast-kpi-label">Daily burn rate</div>
        </div>

        <div className="forecast-kpi">
          <div className="forecast-kpi-value">{elapsed}</div>
          <div className="forecast-kpi-label">Days of data</div>
        </div>
      </div>

      {/* ── Category projections ── */}
      <div className="forecast-section-title">Projected Spend per Category (30 days)</div>
      <div className="forecast-cat-list">
        {catForecasts.map((c) => (
          <div key={c.name} className="forecast-cat-row">
            <div className="forecast-cat-name">
              {c.icon && <span className="forecast-cat-icon">{c.icon}</span>}
              {c.name}
            </div>
            <div className="forecast-cat-bar-track">
              <div
                className="forecast-cat-bar-fill"
                style={{ width: `${(c.projected / maxProjected) * 100}%` }}
              />
            </div>
            <div className="forecast-cat-amt">₪{c.projected.toLocaleString("he-IL")}</div>
          </div>
        ))}
      </div>

      <div className="forecast-note">
        Based on {elapsed}-day spending pattern · Projection assumes constant rate
      </div>
    </div>
  );
}
