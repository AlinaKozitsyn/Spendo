import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import type { CategorySummary } from "../types";

export const CHART_COLORS = [
  "#818cf8", "#34d399", "#fbbf24", "#f87171", "#c084fc",
  "#f472b6", "#22d3ee", "#fb923c", "#a3e635", "#94a3b8",
  "#e879f9", "#2dd4bf",
];

function adjustHex(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${[r, g, b].map((c) => clamp(c + amount).toString(16).padStart(2, "0")).join("")}`;
}

const DEPTH = 7;

function Bar3D(props: any) {
  const { x, y, width, height, fill } = props;
  if (!height || height <= 0 || !width || width <= 0) return null;
  const d = DEPTH;
  const top = adjustHex(fill, 55);
  const side = adjustHex(fill, -55);
  return (
    <g>
      {/* Front face */}
      <rect x={x} y={y} width={width} height={height} fill={fill} rx={2} />
      {/* Top face */}
      <polygon
        points={`${x},${y} ${x + width},${y} ${x + width + d},${y - d} ${x + d},${y - d}`}
        fill={top}
      />
      {/* Right end cap */}
      <polygon
        points={`${x + width},${y} ${x + width + d},${y - d} ${x + width + d},${y - d + height} ${x + width},${y + height}`}
        fill={side}
      />
    </g>
  );
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "#1c2438", border: "1px solid #1e2d45", borderRadius: 10,
      padding: "10px 14px", fontSize: 13, color: "#e2e8f0",
      boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: payload[0].fill }}>{d.name}</div>
      <div>{Number(d.amount).toLocaleString("he-IL", { maximumFractionDigits: 0 })} <span style={{ color: "#64748b" }}>ILS</span></div>
      <div style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>{d.count} transactions</div>
    </div>
  );
};

interface Props {
  data: CategorySummary[];
}

export function SpendingBarChart({ data }: Props) {
  if (data.length === 0) return <p className="loading">No data</p>;

  const chartData = data.map((cat, i) => ({
    name: cat.name,
    amount: cat.total_spent,
    count: cat.transaction_count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const height = Math.max(280, data.length * 38 + 48);

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ left: 8, right: DEPTH + 20, top: DEPTH + 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#1e2d45" />
          <XAxis
            type="number"
            tickFormatter={(v) => v.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
            tick={{ fill: "#475569", fontSize: 11 }}
            axisLine={{ stroke: "#1e2d45" }}
            tickLine={false}
          />
          <YAxis type="category" dataKey="name" width={0} tick={false} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="amount" shape={<Bar3D />} barSize={22} isAnimationActive>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend below — no overlapping labels */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "6px 14px",
        marginTop: 12, justifyContent: "center", padding: "0 8px",
      }}>
        {chartData.map((entry, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#64748b" }}>
            <span style={{
              width: 10, height: 10, borderRadius: 3, background: entry.color,
              display: "inline-block", flexShrink: 0,
              boxShadow: `0 0 6px ${entry.color}88`,
            }} />
            <span style={{ color: "#94a3b8" }}>{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
