import { useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { Transaction } from "../types";

interface Props {
  transactions: Transaction[];
  totalSpent: number;
}

// Mon-first order; avoids RTL page reversing Sun→Sat
const DOW_ORDER  = [1, 2, 3, 4, 5, 6, 0];
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TOOLTIP_STYLE = {
  background: "rgba(8,18,42,0.95)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  fontSize: 11,
  color: "#e2e8f0",
};

export function SpendingVelocityPanel({ transactions, totalSpent }: Props) {
  const [activeDow, setActiveDow] = useState<number | null>(null);

  // ── Compute all stats once ────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!transactions.length) return null;

    const dowAmt   = new Array(7).fill(0);
    const dowCount = new Array(7).fill(0);
    // per-dow category breakdown
    const dowCat: Record<number, Record<string, { total: number; count: number }>> = {};
    const byDate: Record<string, number> = {};
    const byCat:  Record<string, { total: number; count: number }> = {};

    for (const t of transactions) {
      const d   = new Date(t.date);
      const dow = d.getDay();
      dowAmt[dow]   += t.amount;
      dowCount[dow] += 1;

      // per-dow category
      dowCat[dow] ??= {};
      dowCat[dow][t.category] ??= { total: 0, count: 0 };
      dowCat[dow][t.category].total += t.amount;
      dowCat[dow][t.category].count += 1;

      const key = t.date.slice(0, 10);
      byDate[key] = (byDate[key] ?? 0) + t.amount;

      byCat[t.category] ??= { total: 0, count: 0 };
      byCat[t.category].total += t.amount;
      byCat[t.category].count += 1;
    }

    // cumulative timeline
    const dates = Object.keys(byDate).sort();
    let running = 0;
    const cumulative = dates.map((d) => {
      running += byDate[d];
      return { date: d.slice(5), value: Math.round(running) };
    });

    const dailyAvg = dates.length > 0 ? totalSpent / dates.length : 0;

    const maxDow = Math.max(...dowAmt, 1);
    const heatmap = DOW_ORDER.map((dowIdx) => ({
      dowIdx,
      label:     DOW_LABELS[dowIdx],
      amount:    dowAmt[dowIdx],
      count:     dowCount[dowIdx],
      intensity: dowAmt[dowIdx] / maxDow,
    }));

    // overall category averages
    const catAvgsAll = Object.entries(byCat)
      .map(([name, d]) => ({ name, avg: d.total / d.count, total: d.total }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 6);

    return { cumulative, dailyAvg, heatmap, catAvgsAll, dowAmt, dowCount, dowCat };
  }, [transactions, totalSpent]);

  if (!stats) return <div className="loading">No data</div>;

  const { cumulative, dailyAvg, heatmap, catAvgsAll, dowAmt, dowCount, dowCat } = stats;

  // ── Derive displayed values based on selected day ─────────────────────────
  const selectedEntry = activeDow !== null ? heatmap.find((h) => h.dowIdx === activeDow) : null;

  const displayedKpi = activeDow !== null && dowCount[activeDow] > 0
    ? dowAmt[activeDow] / dowCount[activeDow]   // avg transaction size on that day
    : dailyAvg;

  const displayedKpiLabel = activeDow !== null
    ? `Avg transaction on ${DOW_LABELS[activeDow]}s`
    : "Daily Average Spend";

  const catAvgsFiltered = activeDow !== null && dowCat[activeDow]
    ? Object.entries(dowCat[activeDow])
        .map(([name, d]) => ({ name, avg: d.total / d.count, total: d.total }))
        .sort((a, b) => b.avg - a.avg)
        .slice(0, 6)
    : catAvgsAll;

  const maxCatAvg = catAvgsFiltered[0]?.avg ?? 1;

  return (
    <div className="velocity-root">

      {/* ── KPI row ── */}
      <div className="velocity-kpi-row">
        <div className="velocity-kpi">
          <div className="velocity-kpi-value">
            ₪{Math.round(displayedKpi).toLocaleString("he-IL")}
          </div>
          <div className="velocity-kpi-label">{displayedKpiLabel}</div>
        </div>

        {selectedEntry && (
          <div className="dow-detail-chip">
            <strong>{selectedEntry.label}</strong>
            <span>₪{Math.round(selectedEntry.amount).toLocaleString("he-IL")} total</span>
            <span className="dow-detail-count">{selectedEntry.count} transactions</span>
            <button className="dow-detail-close" onClick={() => setActiveDow(null)}>✕</button>
          </div>
        )}
      </div>

      {/* ── Day-of-week heatmap ── */}
      <div className="velocity-section">
        <div className="velocity-section-title">
          Day-of-Week Pattern
          {activeDow !== null
            ? ` — showing ${DOW_LABELS[activeDow]} only`
            : " — click a day to filter"}
        </div>
        <div className="dow-grid" style={{ direction: "ltr" }}>
          {heatmap.map((d) => {
            const isActive = activeDow === d.dowIdx;
            return (
              <div
                key={d.label}
                className={`dow-col${isActive ? " dow-col-active" : ""}`}
                onClick={() => setActiveDow(isActive ? null : d.dowIdx)}
                role="button"
                tabIndex={0}
                aria-label={`${d.label}: ₪${Math.round(d.amount)}`}
              >
                <div
                  className="dow-box"
                  style={{
                    background: isActive
                      ? "rgba(129,140,248,0.75)"
                      : "rgba(129,140,248,0.12)",
                    boxShadow: isActive ? "0 0 12px rgba(129,140,248,0.5)" : "none",
                    outline: isActive ? "2px solid rgba(129,140,248,0.7)" : "none",
                    cursor: "pointer",
                  }}
                />
                <div className="dow-lbl">{d.label}</div>
                {d.amount > 0 && (
                  <div className="dow-amt">
                    {d.amount >= 1000
                      ? `₪${(d.amount / 1000).toFixed(1)}k`
                      : `₪${Math.round(d.amount)}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Cumulative chart (always shows full timeline) ── */}
      {cumulative.length > 1 && (
        <div className="velocity-section">
          <div className="velocity-section-title">Cumulative Spending (all days)</div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={cumulative} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 2" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#64748b", fontSize: 9 }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis hide />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                cursor={{ stroke: "rgba(255,255,255,0.08)" }}
                formatter={(v) => [`₪${Number(v).toLocaleString("he-IL")}`, "Cumulative"]}
              />
              <Area
                type="monotone" dataKey="value"
                stroke="#34d399" strokeWidth={2}
                fill="url(#cumGrad)" dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Avg transaction by category — reacts to selected day ── */}
      <div className="velocity-section">
        <div className="velocity-section-title">
          {activeDow !== null
            ? `Avg Transaction by Category — ${DOW_LABELS[activeDow]}s only`
            : "Avg Transaction Size by Category"}
        </div>
        <div className="cat-avg-list">
          {catAvgsFiltered.map((c) => (
            <div key={c.name} className="cat-avg-row">
              <div className="cat-avg-name">{c.name}</div>
              <div className="cat-avg-track">
                <div
                  className="cat-avg-fill"
                  style={{ width: `${(c.avg / maxCatAvg) * 100}%` }}
                />
              </div>
              <div className="cat-avg-val">₪{Math.round(c.avg).toLocaleString("he-IL")}</div>
            </div>
          ))}
          {catAvgsFiltered.length === 0 && (
            <div style={{ color: "var(--color-text-secondary)", fontSize: 13 }}>
              No transactions on {activeDow !== null ? `${DOW_LABELS[activeDow]}s` : "this day"}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
