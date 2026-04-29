import { useState, useCallback } from "react";
import { uploadFile, fetchTransactions, fetchSummary, fetchCategories } from "./api";
import type { Transaction, CategoryInfo, MonthlySummary, TopMerchant } from "./types";
import { SpendingPieChart } from "./components/SpendingPieChart";
import { SpendingBarChart } from "./components/SpendingBarChart";
import { TransactionTable } from "./components/TransactionTable";
import { TopMerchants } from "./components/TopMerchants";

export default function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const loadDashboard = useCallback(async (category?: string) => {
    const [txnData, sumData, catData] = await Promise.all([
      fetchTransactions(category),
      fetchSummary(),
      fetchCategories(),
    ]);
    setTransactions(txnData.transactions);
    setSummaries(sumData.summaries);
    setTopMerchants(sumData.top_merchants);
    setCategories(catData.categories);
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadMsg(null);
    try {
      const res = await uploadFile(file);
      setUploadMsg({
        text: `${res.total_transactions} transactions processed from ${res.filename}`,
        ok: true,
      });
      setActiveFilter(null);
      await loadDashboard();
    } catch (err: any) {
      setUploadMsg({ text: err.message || "Upload failed", ok: false });
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleFilterClick = async (categoryName: string | null) => {
    setActiveFilter(categoryName);
    const { transactions: txns } = await fetchTransactions(categoryName || undefined);
    setTransactions(txns);
  };

  const totalSpent = summaries.reduce((sum, s) => sum + s.total_spent, 0);
  const totalTxns = transactions.length;
  const categoryCount = categories.length;
  const hasDashboard = categories.length > 0;

  // Prepare chart data from the first (and only, for Phase 1) monthly summary
  const chartCategories = summaries.length > 0 ? summaries[0].categories : [];

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div>
          <h1>Spendo</h1>
          <p className="subtitle">Personal Finance Dashboard</p>
        </div>
      </header>

      {/* Upload Area */}
      <div
        className={`upload-area ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        role="region"
        aria-label="File upload area"
      >
        <label>
          <button
            className="upload-btn"
            onClick={() => document.getElementById("file-input")?.click()}
            disabled={uploading}
            aria-busy={uploading}
          >
            {uploading ? (
              <><span className="spinner" />Processing...</>
            ) : (
              "Upload Statement"
            )}
          </button>
          <input
            id="file-input"
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            aria-label="Choose Excel or CSV file"
          />
        </label>
        <p>Drag & drop your credit card Excel/CSV file, or click to browse</p>
        {uploadMsg && (
          <p className={`upload-status ${uploadMsg.ok ? "success" : "error"}`} role="status">
            {uploadMsg.text}
          </p>
        )}
      </div>

      {/* Dashboard — only shown after data is loaded */}
      {hasDashboard && (
        <>
          {/* Stats Row */}
          <div className="stats-row" role="region" aria-label="Spending summary">
            <div className="stat-card">
              <div className="stat-value">{totalSpent.toLocaleString("he-IL", { maximumFractionDigits: 0 })}</div>
              <div className="stat-label">Total Spent (ILS)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalTxns}</div>
              <div className="stat-label">Transactions</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{categoryCount}</div>
              <div className="stat-label">Categories</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {summaries.length > 0
                  ? `${summaries[0].year}-${String(summaries[0].month).padStart(2, "0")}`
                  : "-"}
              </div>
              <div className="stat-label">Period</div>
            </div>
          </div>

          {/* Charts */}
          <div className="charts-grid">
            <div className="card">
              <h2>Spending by Category</h2>
              <SpendingPieChart data={chartCategories} />
            </div>
            <div className="card">
              <h2>Category Breakdown</h2>
              <SpendingBarChart data={chartCategories} />
            </div>
          </div>

          {/* Top Merchants */}
          <div className="card">
            <h2>Top Merchants</h2>
            <TopMerchants merchants={topMerchants} />
          </div>

          {/* Category Filter */}
          <div className="card">
            <h2>Transactions</h2>
            <div className="filter-bar" role="toolbar" aria-label="Category filter">
              <button
                className={`filter-btn ${activeFilter === null ? "active" : ""}`}
                onClick={() => handleFilterClick(null)}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  className={`filter-btn ${activeFilter === cat.name ? "active" : ""}`}
                  onClick={() => handleFilterClick(cat.name)}
                >
                  {cat.icon && <span>{cat.icon}</span>}
                  {cat.name} ({cat.count})
                </button>
              ))}
            </div>

            {/* Transaction Table */}
            <TransactionTable transactions={transactions} />
          </div>
        </>
      )}

      {/* Empty State */}
      {!hasDashboard && !uploading && (
        <div className="empty-state">
          <div className="icon" aria-hidden="true">📊</div>
          <p>Upload a credit card statement to see your spending analysis</p>
        </div>
      )}
    </div>
  );
}
