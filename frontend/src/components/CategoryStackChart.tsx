import {
  BarChart,
  Bar,
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

const COLORS = [
  "#818cf8", "#c084fc", "#38bdf8", "#34d399", "#fbbf24",
  "#f87171", "#fb923c", "#a3e635", "#e879f9", "#22d3ee",
  "#f472b6", "#4ade80",
];

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
}

// Custom tooltip: only show categories with spend > 0, sorted descending
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null;

  const items = [...payload]
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);

  const total = items.reduce((sum, p) => sum + p.value, 0);

  return (
    <div style={{
      background: "rgba(8,18,42,0.95)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      color: "#e2e8f0",
      maxWidth: 240,
      boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#a5b4fc", fontSize: 13 }}>
        {label}
      </div>
      {items.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#e2e8f0" }}>
            ₪{p.value.toLocaleString("he-IL")}
          </span>
        </div>
      ))}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
        <span style={{ color: "#64748b", fontWeight: 600 }}>Total</span>
        <span style={{ fontWeight: 700, color: "#a5b4fc" }}>₪{total.toLocaleString("he-IL")}</span>
      </div>
    </div>
  );
}

export function CategoryStackChart({ slots }: Props) {
  const allCats = Array.from(
    new Set(slots.flatMap((s) => s.categories.map((c) => c.name)))
  );

  const data = slots.map((s) => {
    const entry: Record<string, string | number> = { month: s.label };
    for (const cat of allCats) {
      const found = s.categories.find((c) => c.name === cat);
      entry[cat] = found ? Math.round(found.total_spent) : 0;
    }
    return entry;
  });

  // Sort categories by total spend across all months (largest first = bottom of stack)
  const activeCats = allCats
    .filter((cat) => data.some((d) => (d[cat] as number) > 0))
    .sort((a, b) => {
      const sumA = data.reduce((s, d) => s + (d[a] as number), 0);
      const sumB = data.reduce((s, d) => s + (d[b] as number), 0);
      return sumB - sumA;
    });

  return (
    <ResponsiveContainer width="100%" height={440}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 48 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fill: "#64748b", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
          tick={{ fill: "#64748b", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
          wrapperStyle={{ outline: "none" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, color: "#64748b", paddingTop: 16, lineHeight: "22px" }}
        />
        {activeCats.map((cat, idx) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={COLORS[idx % COLORS.length]}
            radius={idx === activeCats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
