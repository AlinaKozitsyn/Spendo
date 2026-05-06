import { useMemo } from "react";
import type { Transaction, CategoryInfo, TopMerchant } from "../types";

interface Props {
  transactions: Transaction[];
  categories: CategoryInfo[];
  topMerchants: TopMerchant[];
  totalSpent: number;
}

interface Component {
  label: string;
  score: number;  // 0-25
  max: number;
  detail: string;
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "var(--color-success)";
  if (pct >= 55) return "var(--color-warning)";
  return "var(--color-danger)";
}

function scoreLabel(pct: number): string {
  if (pct >= 85) return "Excellent";
  if (pct >= 70) return "Good";
  if (pct >= 50) return "Fair";
  return "Needs Attention";
}

// SVG donut gauge
function Gauge({ score, color }: { score: number; color: string }) {
  const R = 52;
  const CX = 64, CY = 64;
  const circ = 2 * Math.PI * R;
  const filled = (score / 100) * circ;

  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      {/* track */}
      <circle cx={CX} cy={CY} r={R}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
      {/* arc */}
      <circle cx={CX} cy={CY} r={R}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x={CX} y={CY - 4} textAnchor="middle" fill={color}
        fontSize="26" fontWeight="800" fontFamily="inherit">{score}</text>
      <text x={CX} y={CY + 16} textAnchor="middle" fill="#64748b"
        fontSize="10" fontFamily="inherit">/ 100</text>
    </svg>
  );
}

export function BudgetScorePanel({ transactions, categories, topMerchants, totalSpent }: Props) {
  const { total, components } = useMemo(() => {
    if (!transactions.length) return { total: 0, components: [] };

    const mean = totalSpent / transactions.length;

    // ── Component 1: Hygiene (25 pts) — penalise duplicates & outliers ───
    const groups: Record<string, number> = {};
    for (const t of transactions) {
      const key = `${t.merchant_name.toLowerCase()}|${Math.round(t.amount * 100)}`;
      groups[key] = (groups[key] ?? 0) + 1;
    }
    const duplicatePairs = Object.values(groups).filter((c) => c >= 2).length;
    const outliers = transactions.filter((t) => t.amount > mean * 4).length;
    const hygieneScore = Math.max(0, 25 - duplicatePairs * 5 - outliers * 4);
    const hygieneDetail = duplicatePairs === 0 && outliers === 0
      ? "No duplicates or outliers"
      : `${duplicatePairs} duplicate group${duplicatePairs !== 1 ? "s" : ""}, ${outliers} outlier${outliers !== 1 ? "s" : ""}`;

    // ── Component 2: Diversity (25 pts) — HHI of merchant spend ─────────
    const topSum = topMerchants.reduce((s, m) => s + m.total_spent, 0);
    const otherShare = Math.max(0, totalSpent - topSum) / totalSpent;
    const hhi = topMerchants.reduce((s, m) => s + (m.total_spent / totalSpent) ** 2, 0)
      + (otherShare > 0 ? otherShare ** 2 : 0);
    const diversityScore = Math.round(Math.max(0, 25 * (1 - Math.min(hhi * 3.5, 1))));
    const diversityDetail = hhi < 0.1
      ? "Well diversified across merchants"
      : hhi < 0.22
      ? "Moderate merchant concentration"
      : `High concentration — top merchant is ${topMerchants[0] ? Math.round((topMerchants[0].total_spent / totalSpent) * 100) : 0}%`;

    // ── Component 3: Consistency (25 pts) — daily spend CoV ──────────────
    const byDate: Record<string, number> = {};
    for (const t of transactions) {
      const key = t.date.slice(0, 10);
      byDate[key] = (byDate[key] ?? 0) + t.amount;
    }
    const dailyAmounts = Object.values(byDate);
    let consistencyScore = 25;
    let consistencyDetail = "Consistent daily spending";
    if (dailyAmounts.length >= 3) {
      const avg = dailyAmounts.reduce((s, v) => s + v, 0) / dailyAmounts.length;
      const std = Math.sqrt(dailyAmounts.reduce((s, v) => s + (v - avg) ** 2, 0) / dailyAmounts.length);
      const cov = avg > 0 ? std / avg : 0; // coefficient of variation
      consistencyScore = Math.round(Math.max(0, 25 * (1 - Math.min(cov / 2, 1))));
      consistencyDetail = cov < 0.5 ? "Consistent daily spending"
        : cov < 1.2 ? "Moderate daily variance"
        : "High daily variance — some spending spikes";
    }

    // ── Component 4: Moderation (25 pts) — no single huge transaction ────
    const bigTxns = transactions.filter((t) => t.amount > totalSpent * 0.15).length;
    const catSpikes = categories.filter(
      (c) => totalSpent > 0 && c.total_spent / totalSpent > 0.5
    ).length;
    const moderationScore = Math.max(0, 25 - bigTxns * 6 - catSpikes * 8);
    const moderationDetail = bigTxns === 0 && catSpikes === 0
      ? "No single dominant transaction or category"
      : `${bigTxns} transaction${bigTxns !== 1 ? "s" : ""} >15% of total${catSpikes > 0 ? `; ${catSpikes} category spike` : ""}`;

    const total = hygieneScore + diversityScore + consistencyScore + moderationScore;

    const components: Component[] = [
      { label: "Hygiene",      score: hygieneScore,     max: 25, detail: hygieneDetail },
      { label: "Diversity",    score: diversityScore,   max: 25, detail: diversityDetail },
      { label: "Consistency",  score: consistencyScore, max: 25, detail: consistencyDetail },
      { label: "Moderation",   score: moderationScore,  max: 25, detail: moderationDetail },
    ];

    return { total, components };
  }, [transactions, categories, topMerchants, totalSpent]);

  const color = scoreColor(total);
  const label = scoreLabel(total);

  if (!transactions.length) return null;

  return (
    <div className="score-root">
      {/* Gauge + label */}
      <div className="score-top">
        <Gauge score={total} color={color} />
        <div className="score-label-block">
          <div className="score-label" style={{ color }}>{label}</div>
          <div className="score-sublabel">Budget Adherence Score</div>
        </div>
      </div>

      {/* Component breakdown */}
      <div className="score-components">
        {components.map((c) => {
          const pct = (c.score / c.max) * 100;
          const cColor = scoreColor(pct);
          return (
            <div key={c.label} className="score-comp-row">
              <div className="score-comp-header">
                <span className="score-comp-label">{c.label}</span>
                <span className="score-comp-pts" style={{ color: cColor }}>
                  {c.score}/{c.max}
                </span>
              </div>
              <div className="score-comp-bar-track">
                <div
                  className="score-comp-bar-fill"
                  style={{ width: `${pct}%`, background: cColor }}
                />
              </div>
              <div className="score-comp-detail">{c.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
