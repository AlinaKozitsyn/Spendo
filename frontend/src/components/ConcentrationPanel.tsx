import type { TopMerchant } from "../types";

interface Props {
  topMerchants: TopMerchant[];
  totalSpent: number;
}

const BAR_COLORS = [
  "#818cf8", "#c084fc", "#38bdf8", "#34d399",
  "#fbbf24", "#f87171", "#fb923c",
];

function hhiLabel(hhi: number): { text: string; color: string } {
  if (hhi < 0.1)  return { text: "Diverse",       color: "var(--color-success)" };
  if (hhi < 0.22) return { text: "Moderate",      color: "var(--color-warning)" };
                   return { text: "Concentrated",  color: "var(--color-danger)"  };
}

export function ConcentrationPanel({ topMerchants, totalSpent }: Props) {
  if (!topMerchants.length || totalSpent === 0) return null;

  // HHI: sum of squared market shares (0–1 scale)
  const topSum = topMerchants.reduce((s, m) => s + m.total_spent, 0);
  const otherShare = Math.max(0, totalSpent - topSum) / totalSpent;
  const hhi = topMerchants.reduce((s, m) => s + (m.total_spent / totalSpent) ** 2, 0)
    + (otherShare > 0 ? otherShare ** 2 : 0);

  const { text: scoreLabel, color: scoreColor } = hhiLabel(hhi);

  const top = topMerchants[0];
  const topPct = (top.total_spent / totalSpent) * 100;
  const showAlert = hhi >= 0.22 && topPct > 22;

  const visible = topMerchants.slice(0, 7);
  const maxAmt = visible[0]?.total_spent ?? 1;

  return (
    <div>
      {/* Score row */}
      <div className="hhi-row">
        <div>
          <div className="hhi-score-label">Diversification Index (HHI)</div>
          <div className="hhi-score-value" style={{ color: scoreColor }}>{scoreLabel}</div>
        </div>
        <div className="hhi-pill" style={{ borderColor: scoreColor, color: scoreColor }}>
          {(hhi * 100).toFixed(0)}<span className="hhi-pill-max">/100</span>
        </div>
      </div>

      {/* Alert */}
      {showAlert && (
        <div className="concentration-alert">
          ⚠️ <strong>{top.name}</strong> accounts for {topPct.toFixed(0)}% of spending — consider spreading purchases
        </div>
      )}

      {/* Merchant bars */}
      <div className="conc-bars">
        {visible.map((m, i) => {
          const pct = (m.total_spent / totalSpent) * 100;
          const barWidth = (m.total_spent / maxAmt) * 100;
          return (
            <div key={m.name} className="conc-bar-row">
              <div className="conc-bar-name">{m.name}</div>
              <div className="conc-bar-track">
                <div
                  className="conc-bar-fill"
                  style={{ width: `${barWidth}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
                />
              </div>
              <div className="conc-bar-pct">{pct.toFixed(1)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
