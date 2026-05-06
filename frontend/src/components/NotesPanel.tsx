import { useEffect, useState } from "react";
import { deleteNote, getCurrentSession, getNotes, saveNote, type Note } from "../auth";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface Props {
  defaultMonth: number;
  defaultYear: number;
}

export function NotesPanel({ defaultMonth, defaultYear }: Props) {
  const email = getCurrentSession() ?? "";
  const [notes, setNotes] = useState<Note[]>([]);
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);

  const reload = () => setNotes(getNotes(email).slice().reverse());

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener("spendo:notes-updated", handler);
    return () => window.removeEventListener("spendo:notes-updated", handler);
  }, [email]);

  const handleSave = () => {
    if (!text.trim()) return;
    saveNote(email, { month, year, text: text.trim() });
    setText("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = (id: string) => {
    deleteNote(email, id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="notes-panel">
      <div className="notes-panel-header">
        <h2>📝 My Notes</h2>
        <p className="notes-panel-sub">Capture observations about your spending this period.</p>
      </div>

      <div className="notes-composer">
        <div className="notes-period-row">
          <select
            className="notes-select"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            aria-label="Note month"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            className="notes-select"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label="Note year"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <textarea
          className="notes-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Dining was unusually high this month because of a team dinner. Consider cutting back next month."
          rows={3}
          aria-label="Note content"
        />
        <button
          className={`notes-save-btn ${saved ? "saved" : ""}`}
          onClick={handleSave}
          disabled={!text.trim()}
        >
          {saved ? "✓ Saved" : "Save Note"}
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="notes-list">
          {notes.map((n) => (
            <li key={n.id} className="notes-item">
              <div className="notes-item-meta">
                <span className="notes-item-period">
                  {MONTH_NAMES[n.month - 1]} {n.year}
                </span>
                <button
                  className="notes-item-del"
                  onClick={() => handleDelete(n.id)}
                  aria-label="Delete note"
                >✕</button>
              </div>
              <p className="notes-item-text">{n.text}</p>
            </li>
          ))}
        </ul>
      )}

      {notes.length === 0 && (
        <div className="notes-empty">No notes yet. Add your first observation above.</div>
      )}
    </div>
  );
}
