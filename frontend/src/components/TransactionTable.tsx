import type { Transaction } from "../types";

interface Props {
  transactions: Transaction[];
}

function confidenceClass(c: number): string {
  if (c >= 0.9) return "high";
  if (c >= 0.7) return "medium";
  return "low";
}

export function TransactionTable({ transactions }: Props) {
  if (transactions.length === 0) {
    return <p className="loading">No transactions to display</p>;
  }

  return (
    <div className="table-wrapper">
      <table className="txn-table" role="table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Merchant</th>
            <th scope="col">Category</th>
            <th scope="col">Amount</th>
            <th scope="col" aria-label="Classification confidence">Conf.</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((txn) => (
            <tr key={txn.transaction_id}>
              <td>{new Date(txn.date).toLocaleDateString("he-IL")}</td>
              <td>{txn.merchant_name}</td>
              <td>
                <span className="category-badge">
                  {txn.icon && <span aria-hidden="true">{txn.icon}</span>}
                  {txn.category}
                </span>
              </td>
              <td className="amount">
                {txn.amount.toLocaleString("he-IL", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {txn.currency}
              </td>
              <td>
                <span
                  className={`confidence-dot ${confidenceClass(txn.confidence)}`}
                  title={`Confidence: ${(txn.confidence * 100).toFixed(0)}%`}
                  aria-label={`Confidence: ${(txn.confidence * 100).toFixed(0)}%`}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
