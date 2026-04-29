import type { TopMerchant } from "../types";

interface Props {
  merchants: TopMerchant[];
}

export function TopMerchants({ merchants }: Props) {
  if (merchants.length === 0) {
    return <p className="loading">No data</p>;
  }

  return (
    <ol className="merchant-list" aria-label="Top merchants by spending">
      {merchants.map((m, i) => (
        <li key={m.name} className="merchant-item">
          <span className="merchant-name">
            {i + 1}. {m.name}
          </span>
          <span className="merchant-amount">
            {m.total_spent.toLocaleString("he-IL", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            ILS
          </span>
        </li>
      ))}
    </ol>
  );
}
