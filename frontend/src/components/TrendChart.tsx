import { useState } from "react";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { SlotSummary } from "../types";

interface Props {
  slots: SlotSummary[];
}

const LINE_COLORS = [
  "#818cf8", "#c084fc", "#38bdf8", "#34d399", "#fbbf24",
  "#f87171", "#fb923c", "#a3e635", "#e879f9", "#22d3ee",
  "#f472b6", "#4ade80",
];

type ViewMode = "total" | "category";

// ── Shared tooltip style ─────────────────────────────────────────────────────
const TOOLTIP_STYLE = {
  background: "rgba(8,18,42,0.95)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 10,
  color: "#e2e8f0",
  fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

// ── Total trend (area) ───────────────────────────────────────────────────────
function TotalView({ slots }: { slots: SlotSummary[] }) {
  const data = slots.map((s) => ({
    month: s.label,
    total: Math.round(s.total_spent),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false} tickLine={false} width={52}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
          formatter={(val) => [`₪${Number(val).toLocaleString("he-IL")}`, "Total Spent"]}
        />
        <Area
          type="monotone" dataKey="total"
          stroke="#818cf8" strokeWidth={2.5}
          fill="url(#trendGrad)"
          dot={{ fill: "#818cf8", r: 5, strokeWidth: 0 }}
          activeDot={{ r: 7, fill: "#c084fc" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Per-category trend (multi-line) ─────────────────────────────────────────
function CategoryView({ slots }: { slots: SlotSummary[] }) {
  const allCats = Array.from(
    new Set(slots.flatMap((s) => s.categories.map((c) => c.name)))
  );

  // Only keep categories that appear in more than one slot (otherwise a line is just a dot)
  const activeCats = allCats.filter((cat) => {
    const nonZero = slots.filter((s) =>
      s.categories.some((c) => c.name === cat && c.total_spent > 0)
    );
    return nonZero.length >= 1;
  });

  const data = slots.map((s) => {
    const entry: Record<string, string | number> = { month: s.label };
    for (const cat of activeCats) {
      const found = s.categories.find((c) => c.name === cat);
      entry[cat] = found ? Math.round(found.total_spent) : 0;
    }
    return entry;
  });

  // Hidden lines state — user can click legend to hide/show
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const toggleCat = (cat: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 48 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false} tickLine={false} width={52}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: "rgba(255,255,255,0.08)", strokeWidth: 1 }}
          formatter={(val, name) => [`₪${Number(val).toLocaleString("he-IL")}`, String(name)]}
          itemSorter={(item) => -(item.value as number)}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 16, lineHeight: "22px", cursor: "pointer" }}
          onClick={(e) => toggleCat(e.dataKey as string)}
          formatter={(value) => (
            <span style={{ color: hidden.has(value) ? "#334155" : "#94a3b8" }}>{value}</span>
          )}
        />
        {activeCats.map((cat, idx) => (
          <Line
            key={cat}
            type="monotone"
            dataKey={cat}
            stroke={LINE_COLORS[idx % LINE_COLORS.length]}
            strokeWidth={hidden.has(cat) ? 0 : 2}
            dot={{ r: hidden.has(cat) ? 0 : 4, strokeWidth: 0, fill: LINE_COLORS[idx % LINE_COLORS.length] }}
            activeDot={{ r: hidden.has(cat) ? 0 : 6 }}
            hide={hidden.has(cat)}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Exported wrapper with toggle ─────────────────────────────────────────────
export function TrendChart({ slots }: Props) {
  const [view, setView] = useState<ViewMode>("total");

  return (
    <div>
      <div className="chart-toggle-bar">
        <button
          className={`chart-toggle-btn ${view === "total" ? "active" : ""}`}
          onClick={() => setView("total")}
        >
          Total Spending
        </button>
        <button
          className={`chart-toggle-btn ${view === "category" ? "active" : ""}`}
          onClick={() => setView("category")}
        >
          By Category
        </button>
      </div>

      {view === "total" ? <TotalView slots={slots} /> : <CategoryView slots={slots} />}
    </div>
  );
}
