import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getCurrentSession, getGoals, type Goal } from "../auth";
import type { CategoryInfo } from "../types";
import { useEffect, useState } from "react";

interface ChartRow {
  name: string;
  goal: number;
  actual: number;
  over: boolean;
}

interface Props {
  categories: CategoryInfo[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="goal-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: ₪{Number(p.value).toLocaleString("he-IL", { maximumFractionDigits: 0 })}
        </div>
      ))}
    </div>
  );
};

export function GoalVsActualChart({ categories }: Props) {
  const email = getCurrentSession() ?? "";
  const [goals, setGoals] = useState<Goal[]>([]);

  const reload = () => setGoals(getGoals(email));

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("spendo:goals-updated", handler);
    return () => window.removeEventListener("spendo:goals-updated", handler);
  }, [email]);

  const data: ChartRow[] = categories
    .map((cat) => {
      const g = goals.find((x) => x.category === cat.name);
      if (!g || g.goalAmount <= 0) return null;
      return {
        name: cat.name.length > 14 ? cat.name.slice(0, 13) + "…" : cat.name,
        goal: g.goalAmount,
        actual: cat.total_spent,
        over: cat.total_spent > g.goalAmount,
      };
    })
    .filter(Boolean) as ChartRow[];

  if (data.length === 0) return null;

  return (
    <div className="card goal-chart-card">
      <h2>📊 Goal vs Actual Spending</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.07)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₪${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#94a3b8" }}
          />
          <Bar dataKey="goal" name="Goal" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
          <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((entry, i) => (
              <Cell
                key={`cell-${i}`}
                fill={entry.over ? "#f87171" : "#34d399"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="goal-chart-legend">
        <span className="goal-legend-dot ok" /> Under goal &nbsp;
        <span className="goal-legend-dot over" /> Over goal &nbsp;
        <span className="goal-legend-dot goal" /> Goal target
      </p>
    </div>
  );
}
