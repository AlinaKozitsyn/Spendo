import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { CategorySummary } from "../types";

const COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#64748b",
];

interface Props {
  data: CategorySummary[];
}

export function SpendingPieChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="loading">No data</p>;
  }

  const chartData = data.map((cat) => ({
    name: cat.name,
    value: cat.total_spent,
    icon: cat.icon,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={(props: any) =>
            `${props.name ?? ""} ${((props.percent ?? 0) * 100).toFixed(0)}%`
          }
          labelLine={true}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: unknown) =>
            `${Number(value).toLocaleString("he-IL", { maximumFractionDigits: 0 })} ILS`
          }
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
