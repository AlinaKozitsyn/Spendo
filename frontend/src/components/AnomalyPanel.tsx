import type { Transaction, CategoryInfo } from "../types";

interface Props {
  transactions: Transaction[];
  categories: CategoryInfo[];
  totalSpent: number;
}

type Severity = "high" | "medium" | "low";

interface Flag {
  type: "outlier" | "duplicate" | "spike";
  severity: Severity;
  merchant: string;       // raw merchant name (may be Hebrew)
  badge?: string;         // short LTR badge, e.g. "×2"
  detail: string;         // always LTR — amounts + English labels only
}

function computeFlags(
  transactions: Transaction[],
  categories: CategoryInfo[],
  totalSpent: number
): Flag[] {
  const flags: Flag[] = [];
  if (transactions.length < 3 || totalSpent === 0) return flags;

  const mean = totalSpent / transactions.length;

  // ── 1. Outlier transactions (> 3× average) ──────────────────────────────
  const outliers = [...transactions]
    .filter((t) => t.amount > mean * 3)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 4);

  for (const t of outliers) {
    const ratio = (t.amount / mean).toFixed(1);
    flags.push({
      type: "outlier",
      severity: t.amount > mean * 6 ? "high" : "medium",
      merchant: t.merchant_name,
      detail: `${ratio}× average  ·  ₪${t.amount.toLocaleString("he-IL")}`,
    });
  }

  // ── 2. Duplicate charges (same merchant + same amount ≥ 2×) ─────────────
  const groups: Record<string, Transaction[]> = {};
  for (const t of transactions) {
    const key = `${t.merchant_name.toLowerCase().trim()}|${Math.round(t.amount * 100)}`;
    (groups[key] = groups[key] ?? []).push(t);
  }
  for (const txns of Object.values(groups)) {
    if (txns.length < 2) continue;
    const t = txns[0];
    const eachFmt  = `₪${t.amount.toLocaleString("he-IL")}`;
    const totalFmt = `₪${(t.amount * txns.length).toLocaleString("he-IL")}`;
    flags.push({
      type: "duplicate",
      severity: txns.length >= 3 ? "high" : "medium",
      merchant: t.merchant_name,
      badge: `×${txns.length}`,
      detail: `${eachFmt} each  ·  ${totalFmt} total`,
    });
  }

  // ── 3. Category spending spike (> 40% of total) ──────────────────────────
  for (const cat of categories) {
    const pct = (cat.total_spent / totalSpent) * 100;
    if (pct < 40) continue;
    flags.push({
      type: "spike",
      severity: pct > 60 ? "high" : "medium",
      merchant: `${cat.icon ? cat.icon + "  " : ""}${cat.name}`,
      detail: `${pct.toFixed(0)}% of total spending this month`,
    });
  }

  return flags;
}

const ICON: Record<Flag["type"], string> = {
  outlier:   "💸",
  duplicate: "🔁",
  spike:     "📈",
};

const LABEL: Record<Flag["type"], string> = {
  outlier:   "Large transaction",
  duplicate: "Possible duplicate",
  spike:     "Category spike",
};

export function AnomalyPanel({ transactions, categories, totalSpent }: Props) {
  const flags = computeFlags(transactions, categories, totalSpent);

  if (flags.length === 0) {
    return (
      <div className="anomaly-clear">
        <span className="anomaly-clear-check">✓</span>
        No anomalies detected — spending looks normal
      </div>
    );
  }

  return (
    <ul className="anomaly-list">
      {flags.map((f, i) => (
        <li key={i} className={`anomaly-item anomaly-${f.severity}`}>
          <span className="anomaly-emoji">{ICON[f.type]}</span>

          <div className="anomaly-body">
            {/* Type label always LTR */}
            <div className="anomaly-type-label">{LABEL[f.type]}</div>

            {/* Merchant row: name in its own bidi-isolated span, badge stays LTR outside */}
            <div className="anomaly-title-row">
              <span className="anomaly-merchant">{f.merchant}</span>
              {f.badge && <span className="anomaly-count-badge">{f.badge}</span>}
            </div>

            {/* Detail: force LTR so amounts don't get reversed by page RTL */}
            <div className="anomaly-detail" dir="ltr">{f.detail}</div>
          </div>

          <span className={`anomaly-badge anomaly-badge-${f.severity}`}>
            {f.severity === "high" ? "High" : "Medium"}
          </span>
        </li>
      ))}
    </ul>
  );
}
