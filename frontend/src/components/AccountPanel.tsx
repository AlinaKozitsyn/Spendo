import { useEffect, useRef, useState } from "react";
import {
  deleteAccount,
  deleteNote,
  getGoals,
  getLastCategories,
  getNotes,
  saveGoals,
  saveNote,
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
  const [goalsSaved, setGoalsSaved] = useState(false);

  // note composer state
  const now = new Date();
  const [noteMonth, setNoteMonth] = useState(now.getMonth() + 1);
  const [noteYear, setNoteYear] = useState(now.getFullYear());
  const [noteText, setNoteText] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  // free-form goal row state (for when no categories are loaded)
  const [newGoalCat, setNewGoalCat] = useState("");
  const [newGoalAmt, setNewGoalAmt] = useState("");

  const reload = () => {
    setNotes(getNotes(email).slice().reverse());
    const g = getGoals(email);
    const cats = getLastCategories(email);
    setLastCats(cats);
    if (cats.length > 0) {
      const merged: Goal[] = cats.map((c) => {
        const existing = g.find((x) => x.category === c.name);
        return { category: c.name, goalAmount: existing?.goalAmount ?? 0 };
      });
      setGoals(merged);
    } else {
      setGoals(g);
    }
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

  // ── Note actions ────────────────────────────────────────────────────────

  const handleSaveNote = () => {
    if (!noteText.trim()) return;
    saveNote(email, { month: noteMonth, year: noteYear, text: noteText.trim() });
    setNoteText("");
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  const handleDeleteNote = (id: string) => {
    deleteNote(email, id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // ── Goal actions ────────────────────────────────────────────────────────

  const handleGoalChange = (category: string, value: string) => {
    const num = parseFloat(value) || 0;
    setGoals((prev) =>
      prev.map((g) => (g.category === category ? { ...g, goalAmount: num } : g))
    );
    setGoalsSaved(false);
  };

  const handleAddGoalRow = () => {
    if (!newGoalCat.trim()) return;
    const exists = goals.some((g) => g.category.toLowerCase() === newGoalCat.trim().toLowerCase());
    if (!exists) {
      setGoals((prev) => [...prev, { category: newGoalCat.trim(), goalAmount: parseFloat(newGoalAmt) || 0 }]);
    }
    setNewGoalCat("");
    setNewGoalAmt("");
    setGoalsSaved(false);
  };

  const handleRemoveGoalRow = (category: string) => {
    setGoals((prev) => prev.filter((g) => g.category !== category));
    setGoalsSaved(false);
  };

  const handleSaveGoals = () => {
    saveGoals(email, goals.filter((g) => g.goalAmount > 0));
    setGoalsSaved(true);
    setTimeout(() => setGoalsSaved(false), 2200);
  };

  const handleDeleteAccount = () => {
    deleteAccount(email);
    onDeleted();
  };

  const initials = email.slice(0, 2).toUpperCase();
  const currentYear = now.getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <>
      <div className="acct-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="acct-panel" role="dialog" aria-modal="true" aria-label="Account">

        {/* Header */}
        <div className="acct-header">
          <button className="acct-close" onClick={onClose} aria-label="Close account panel">✕</button>
          <div className="acct-identity">
            <span className="acct-email">{email}</span>
            <span className="acct-badge">Personal Account</span>
          </div>
          <div className="acct-avatar" aria-hidden="true">{initials}</div>
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
              {/* Composer */}
              <div className="acct-note-composer">
                <div className="acct-note-period-row">
                  <select
                    className="acct-select"
                    value={noteMonth}
                    onChange={(e) => setNoteMonth(Number(e.target.value))}
                    aria-label="Note month"
                  >
                    {MONTH_NAMES.map((m, i) => (
                      <option key={m} value={i + 1}>{m}</option>
                    ))}
                  </select>
                  <select
                    className="acct-select"
                    value={noteYear}
                    onChange={(e) => setNoteYear(Number(e.target.value))}
                    aria-label="Note year"
                  >
                    {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <textarea
                  className="acct-textarea"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Write a note about this period's spending…"
                  rows={3}
                  aria-label="Note content"
                />
                <button
                  className={`acct-save-btn ${noteSaved ? "saved" : ""}`}
                  onClick={handleSaveNote}
                  disabled={!noteText.trim()}
                >
                  {noteSaved ? "✓ Saved" : "Save Note"}
                </button>
              </div>

              {/* List */}
              {notes.length === 0 && (
                <div className="acct-empty">No notes yet. Write your first note above.</div>
              )}
              <ul className="acct-notes-list">
                {notes.map((n) => (
                  <li key={n.id} className="acct-note-item">
                    <div className="acct-note-meta">
                      <span className="acct-note-period">{MONTH_NAMES[n.month - 1]} {n.year}</span>
                      <button className="acct-note-del" onClick={() => handleDeleteNote(n.id)} aria-label="Delete note">✕</button>
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
              {lastCats.length === 0 && (
                <p className="acct-hint">
                  No statement uploaded yet — you can still add goals manually below. They will sync automatically once you upload a statement.
                </p>
              )}

              {/* Add row (always visible) */}
              <div className="acct-goal-add-row">
                <input
                  type="text"
                  className="acct-goal-cat-input"
                  value={newGoalCat}
                  onChange={(e) => setNewGoalCat(e.target.value)}
                  placeholder="Category name"
                  aria-label="New goal category"
                  onKeyDown={(e) => e.key === "Enter" && handleAddGoalRow()}
                />
                <input
                  type="number"
                  className="acct-goal-input"
                  value={newGoalAmt}
                  onChange={(e) => setNewGoalAmt(e.target.value)}
                  placeholder="ILS"
                  aria-label="New goal amount"
                  style={{ width: 80 }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddGoalRow()}
                />
                <button className="acct-add-btn" onClick={handleAddGoalRow} aria-label="Add goal">+</button>
              </div>

              {/* Goals table */}
              {goals.length > 0 && (
                <table className="acct-goals-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Goal (ILS)</th>
                      <th />
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
                        <td>
                          <button
                            className="acct-note-del"
                            onClick={() => handleRemoveGoalRow(g.category)}
                            aria-label={`Remove ${g.category}`}
                          >✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {goals.length === 0 && (
                <div className="acct-empty">Add your first goal using the fields above.</div>
              )}

              <button
                className={`acct-save-btn ${goalsSaved ? "saved" : ""}`}
                onClick={handleSaveGoals}
                disabled={goals.length === 0}
              >
                {goalsSaved ? "✓ Goals Saved" : "Save Goals"}
              </button>
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
                <button className="acct-danger-btn" onClick={() => setDeleteConfirm(true)}>
                  Delete My Account
                </button>
              ) : (
                <div className="acct-confirm-row">
                  <p className="acct-confirm-text">Are you absolutely sure?</p>
                  <button className="acct-danger-btn" onClick={handleDeleteAccount}>Yes, delete everything</button>
                  <button className="acct-cancel-btn" onClick={() => setDeleteConfirm(false)}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
