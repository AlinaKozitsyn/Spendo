import { useState, useCallback } from "react";
import {
  uploadFile,
  fetchTransactions,
  fetchSummary,
  fetchCategories,
  uploadFileToSlot,
  fetchMultiSummary,
  clearSlot,
} from "./api";
import type { Transaction, CategoryInfo, MonthlySummary, TopMerchant, SlotSummary } from "./types";
import { SpendingPieChart } from "./components/SpendingPieChart";
import { SpendingBarChart } from "./components/SpendingBarChart";
import { TransactionTable } from "./components/TransactionTable";
import { TopMerchants } from "./components/TopMerchants";
import { SpaceBackground } from "./components/SpaceBackground";
import { MultiUploadArea } from "./components/MultiUploadArea";
import { TrendChart } from "./components/TrendChart";
import { CategoryStackChart } from "./components/CategoryStackChart";
import { AnomalyPanel } from "./components/AnomalyPanel";
import { ConcentrationPanel } from "./components/ConcentrationPanel";
import { SpendingVelocityPanel } from "./components/SpendingVelocityPanel";
import { ForecastPanel } from "./components/ForecastPanel";
import { BudgetScorePanel } from "./components/BudgetScorePanel";
import { MultiMonthForecast } from "./components/MultiMonthForecast";
import { AuthGate } from "./components/AuthGate";
import { MoneyFactsLoader } from "./components/MoneyFactsLoader";
import { NotesPanel } from "./components/NotesPanel";
import { GoalsPanel } from "./components/GoalsPanel";
import { GoalVsActualChart } from "./components/GoalVsActualChart";
import { getCurrentSession, saveLastCategories } from "./auth";

type Mode = "single" | "multi";

interface SlotState {
  status: "empty" | "uploading" | "done" | "error";
  label?: string;
  total?: number;
  error?: string;
  summary?: SlotSummary;
}

const EMPTY_SLOT: SlotState = { status: "empty" };

export default function App() {
  const [mode, setMode] = useState<Mode>("single");

  // ── Single-month state ──────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
  const [topMerchants, setTopMerchants] = useState<TopMerchant[]>([]);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  // ── Multi-month state ───────────────────────────────────────────────────────
  const [slots, setSlots] = useState<SlotState[]>([EMPTY_SLOT, EMPTY_SLOT, EMPTY_SLOT]);
  const [multiSummarySlots, setMultiSummarySlots] = useState<SlotSummary[]>([]);

  // ── Single-month handlers ───────────────────────────────────────────────────
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
      // persist categories so AccountPanel goals can access them
      const email = getCurrentSession();
      if (email) {
        const catData = await fetchCategories();
        saveLastCategories(email, catData.categories.map((c) => ({ name: c.name, icon: c.icon })));
      }
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

  // ── Multi-month handlers ────────────────────────────────────────────────────
  const handleSlotUpload = async (file: File, slotIdx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = { status: "uploading" };
      return next;
    });
    try {
      await uploadFileToSlot(file, slotIdx);
      const multi = await fetchMultiSummary();
      const slotSummary = multi.slots.find((s) => s.slot === slotIdx);
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = { status: "done", summary: slotSummary };
        return next;
      });
      setMultiSummarySlots(multi.slots);
    } catch (err: any) {
      setSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = { status: "error", error: err.message || "Upload failed" };
        return next;
      });
    }
  };

  const handleClearSlot = async (slotIdx: number) => {
    await clearSlot(slotIdx);
    setSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = { status: "empty" };
      return next;
    });
    const multi = await fetchMultiSummary();
    setMultiSummarySlots(multi.slots);
  };

  // ── Derived single-month values ─────────────────────────────────────────────
  const totalSpent = summaries.reduce((sum, s) => sum + s.total_spent, 0);
  const totalTxns = transactions.length;
  const categoryCount = categories.length;
  const hasDashboard = categories.length > 0;
  const chartCategories = summaries.length > 0 ? summaries[0].categories : [];

  // ── Multi-month derived ─────────────────────────────────────────────────────
  const hasMultiData = multiSummarySlots.length >= 2;

  return (
    <>
      <SpaceBackground />
      <AuthGate>
        <div className="app">
        {/* Header */}
        <header className="header">
          <div>
            <h1>Spendo</h1>
            <p className="subtitle">Personal Finance Dashboard</p>
          </div>

          {/* Mode Toggle */}
          <div className="mode-toggle" role="group" aria-label="Dashboard mode">
            <button
              className={`mode-btn ${mode === "single" ? "active" : ""}`}
              onClick={() => setMode("single")}
            >
              1 Month
            </button>
            <button
              className={`mode-btn ${mode === "multi" ? "active" : ""}`}
              onClick={() => setMode("multi")}
            >
              3 Months
            </button>
          </div>
        </header>

        {/* ── SINGLE-MONTH MODE ──────────────────────────────────────────────── */}
        {mode === "single" && (
          <>
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
              {uploading && <MoneyFactsLoader />}
            </div>

            {/* Dashboard */}
            {hasDashboard && (
              <>
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

                <div className="card">
                  <h2>Top Merchants</h2>
                  <TopMerchants merchants={topMerchants} />
                </div>

                {/* Insights row 1 */}
                <div className="card">
                  <h2>🚨 Anomaly Detection</h2>
                  <AnomalyPanel
                    transactions={transactions}
                    categories={categories}
                    totalSpent={totalSpent}
                  />
                </div>

                {/* Insights row 2 */}
                <div className="card">
                  <h2>💰 Spending Velocity & Patterns</h2>
                  <SpendingVelocityPanel
                    transactions={transactions}
                    totalSpent={totalSpent}
                  />
                </div>

                {/* Goals and notes */}
                <GoalVsActualChart categories={categories} />

                <div className="card">
                  <GoalsPanel categories={categories} />
                </div>

                <div className="card">
                  <NotesPanel
                    defaultMonth={summaries.length > 0 ? summaries[0].month : new Date().getMonth() + 1}
                    defaultYear={summaries.length > 0 ? summaries[0].year : new Date().getFullYear()}
                  />
                </div>

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
                  <TransactionTable transactions={transactions} />
                </div>
              </>
            )}

            {!hasDashboard && !uploading && (
              <div className="empty-state">
                <div className="icon" aria-hidden="true">📊</div>
                <p>Upload a credit card statement to see your spending analysis</p>
              </div>
            )}
          </>
        )}

        {/* ── MULTI-MONTH MODE ───────────────────────────────────────────────── */}
        {mode === "multi" && (
          <>
            <div className="card">
              <h2>Upload Up to 3 Monthly Statements</h2>
              <MultiUploadArea
                slots={slots}
                onUpload={handleSlotUpload}
                onClear={handleClearSlot}
              />
              {slots.some((slot) => slot.status === "uploading") && <MoneyFactsLoader compact />}
            </div>

            {hasMultiData && (
              <>
                {/* Summary stats for each slot */}
                <div className="stats-row">
                  {multiSummarySlots.map((s) => (
                    <div key={s.slot} className="stat-card">
                      <div className="stat-value">
                        ₪{s.total_spent.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                      </div>
                      <div className="stat-label">{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Trend chart */}
                <div className="card">
                  <h2>Monthly Spending Trend</h2>
                  <TrendChart slots={multiSummarySlots} />
                </div>

                {/* Category stack chart */}
                <div className="card">
                  <h2>Spending by Category — Month Comparison</h2>
                  <CategoryStackChart slots={multiSummarySlots} />
                </div>

                {/* Spending forecast */}
                <div className="card">
                  <h2>📈 Spending Forecast</h2>
                  <MultiMonthForecast slots={multiSummarySlots} />
                </div>

                {/* Per-month top merchants */}
                <div className="charts-grid" style={{ gridTemplateColumns: `repeat(${multiSummarySlots.length}, 1fr)` }}>
                  {multiSummarySlots.map((s) => (
                    <div key={s.slot} className="card">
                      <h2>Top Merchants — {s.label}</h2>
                      <TopMerchants merchants={s.top_merchants} />
                    </div>
                  ))}
                </div>
              </>
            )}

            {!hasMultiData && (
              <div className="empty-state">
                <div className="icon" aria-hidden="true">📅</div>
                <p>Upload at least 2 monthly statements to see a comparison</p>
              </div>
            )}
          </>
        )}
        </div>
      </AuthGate>
    </>
  );
}
