import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { SlotSummary } from "../types";

interface Props {
  slots: SlotSummary[];
}

export function MonthlyTrendChart({ slots }: Props) {
  const data = slots.map((s) => ({
    month: s.label,
    total: Math.round(s.total_spent),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#818cf8" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#818cf8" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
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
          contentStyle={{
            background: "rgba(8,18,42,0.92)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 10,
            color: "#e2e8f0",
            fontSize: 13,
          }}
          formatter={(val) => [`₪${Number(val).toLocaleString("he-IL")}`, "Total Spent"]}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="#818cf8"
          strokeWidth={2.5}
          fill="url(#trendGrad)"
          dot={{ fill: "#818cf8", r: 5, strokeWidth: 0 }}
          activeDot={{ r: 7, fill: "#c084fc" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
