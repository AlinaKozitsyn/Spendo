import { useEffect, useState } from "react";
import {
  deleteAccount,
  deleteNote,
  getGoals,
  getLastCategories,
  getNotes,
  saveGoals,
  type Goal,
  type Note,
} from "../auth";

type Tab = "notes" | "goals" | "terms" | "delete";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface Props {
  email: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function AccountPanel({ email, onClose, onDeleted }: Props) {
  const [tab, setTab] = useState<Tab>("notes");
  const [notes, setNotes] = useState<Note[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [lastCats, setLastCats] = useState<Array<{ name: string; icon: string | null }>>([]);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const reload = () => {
    setNotes(getNotes(email));
    const g = getGoals(email);
    const cats = getLastCategories(email);
    setLastCats(cats);
    // merge: keep existing goal amounts, add missing cats with 0
    const merged: Goal[] = cats.map((c) => {
      const existing = g.find((x) => x.category === c.name);
      return { category: c.name, goalAmount: existing?.goalAmount ?? 0 };
    });
    setGoals(merged.length ? merged : g);
  };

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("spendo:notes-updated", handler);
    window.addEventListener("spendo:goals-updated", handler);
    return () => {
      window.removeEventListener("spendo:notes-updated", handler);
      window.removeEventListener("spendo:goals-updated", handler);
    };
  }, [email]);

  const handleGoalChange = (category: string, value: string) => {
    const num = parseFloat(value) || 0;
    setGoals((prev) =>
      prev.map((g) => (g.category === category ? { ...g, goalAmount: num } : g))
    );
    setSaved(false);
  };

  const handleSaveGoals = () => {
    saveGoals(email, goals.filter((g) => g.goalAmount > 0));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(email, id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleDeleteAccount = () => {
    deleteAccount(email);
    onDeleted();
  };

  const initials = email.slice(0, 2).toUpperCase();

  return (
    <>
      <div className="acct-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="acct-panel" role="dialog" aria-modal="true" aria-label="Account">
        {/* Header */}
        <div className="acct-header">
          <div className="acct-avatar" aria-hidden="true">{initials}</div>
          <div className="acct-identity">
            <span className="acct-email">{email}</span>
            <span className="acct-badge">Personal Account</span>
          </div>
          <button className="acct-close" onClick={onClose} aria-label="Close account panel">✕</button>
        </div>

        {/* Tabs */}
        <nav className="acct-tabs" role="tablist">
          {(["notes","goals","terms","delete"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              className={`acct-tab ${tab === t ? "active" : ""} ${t === "delete" ? "danger" : ""}`}
              onClick={() => { setTab(t); setDeleteConfirm(false); }}
              aria-selected={tab === t}
            >
              {t === "notes" && "📝 Notes"}
              {t === "goals" && "🎯 Goals"}
              {t === "terms" && "📋 Terms"}
              {t === "delete" && "🗑 Delete"}
            </button>
          ))}
        </nav>

        {/* Content */}
        <div className="acct-body">

          {/* ── Notes ── */}
          {tab === "notes" && (
            <div className="acct-section">
              <p className="acct-hint">
                Notes are added from the dashboard after uploading a statement.
              </p>
              {notes.length === 0 && (
                <div className="acct-empty">No notes yet. Upload a statement and add your first note.</div>
              )}
              <ul className="acct-notes-list">
                {notes.map((n) => (
                  <li key={n.id} className="acct-note-item">
                    <div className="acct-note-meta">
                      <span className="acct-note-period">{MONTH_NAMES[n.month - 1]} {n.year}</span>
                      <button
                        className="acct-note-del"
                        onClick={() => handleDeleteNote(n.id)}
                        aria-label="Delete note"
                      >✕</button>
                    </div>
                    <p className="acct-note-text">{n.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ── Goals ── */}
          {tab === "goals" && (
            <div className="acct-section">
              <p className="acct-hint">
                Set a monthly spending limit per category. Upload a statement first to see your categories.
              </p>
              {goals.length === 0 && (
                <div className="acct-empty">No categories loaded yet. Upload a statement to populate goals.</div>
              )}
              {goals.length > 0 && (
                <>
                  <table className="acct-goals-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Goal (ILS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {goals.map((g) => (
                        <tr key={g.category}>
                          <td>{g.category}</td>
                          <td>
                            <input
                              type="number"
                              className="acct-goal-input"
                              value={g.goalAmount || ""}
                              min={0}
                              placeholder="0"
                              onChange={(e) => handleGoalChange(g.category, e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button
                    className={`acct-save-btn ${saved ? "saved" : ""}`}
                    onClick={handleSaveGoals}
                  >
                    {saved ? "✓ Saved" : "Save Goals"}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Terms ── */}
          {tab === "terms" && (
            <div className="acct-section acct-terms">
              <h3>Spendo User Terms</h3>
              <p>Effective June 1, 2026. Spendo is a personal finance analytics platform for reviewing uploaded credit card or bank statements, categorizing transactions, visualizing spending patterns, tracking budgets, and surfacing insights.</p>
              <h4>Your responsibilities</h4>
              <ul>
                <li>Use a valid email address and keep your password secure.</li>
                <li>Upload only financial statements you own or have permission to use.</li>
                <li>Check category and insight accuracy before relying on them.</li>
                <li>Do not use Spendo for fraud, money laundering, or system abuse.</li>
                <li>You must be at least 18 years old.</li>
              </ul>
              <h4>Your rights</h4>
              <ul>
                <li>You can access, correct, export, and request deletion of your data.</li>
                <li>Account deletion removes account and transaction data.</li>
              </ul>
              <h4>Important limits</h4>
              <ul>
                <li>Spendo is a tool, not a bank or financial advisor.</li>
                <li>Spendo does not store card numbers, CVV codes, or bank passwords.</li>
                <li>Financial decisions remain your responsibility.</li>
              </ul>
            </div>
          )}

          {/* ── Delete ── */}
          {tab === "delete" && (
            <div className="acct-section acct-delete-section">
              <div className="acct-danger-icon" aria-hidden="true">⚠️</div>
              <h3>Delete Account</h3>
              <p>This permanently removes your account, all saved notes, and all goals. This action cannot be undone.</p>
              {!deleteConfirm ? (
                <button
                  className="acct-danger-btn"
                  onClick={() => setDeleteConfirm(true)}
                >
                  Delete My Account
                </button>
              ) : (
                <div className="acct-confirm-row">
                  <p className="acct-confirm-text">Are you absolutely sure?</p>
                  <button className="acct-danger-btn" onClick={handleDeleteAccount}>
                    Yes, delete everything
                  </button>
                  <button className="acct-cancel-btn" onClick={() => setDeleteConfirm(false)}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
