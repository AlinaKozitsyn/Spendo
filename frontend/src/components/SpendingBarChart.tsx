import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { CategorySummary } from "../types";

const BAR_COLOR = "#6366f1";

interface Props {
  data: CategorySummary[];
}

export function SpendingBarChart({ data }: Props) {
  if (data.length === 0) {
    return <p className="loading">No data</p>;
  }

  const chartData = data.map((cat) => ({
    name: cat.name,
    amount: cat.total_spent,
    count: cat.transaction_count,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `${v.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`}
        />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value: unknown) =>
            `${Number(value).toLocaleString("he-IL", { maximumFractionDigits: 0 })} ILS`
          }
        />
        <Bar dataKey="amount" fill={BAR_COLOR} radius={[0, 6, 6, 0]} barSize={20} />
      </BarChart>
    </ResponsiveContainer>
  );
}
