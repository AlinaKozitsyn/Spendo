import { useEffect, useState } from "react";
import { getCurrentSession, getGoals, saveGoals, type Goal } from "../auth";
import type { CategoryInfo } from "../types";

interface Props {
  categories: CategoryInfo[];
}

export function GoalsPanel({ categories }: Props) {
  const email = getCurrentSession() ?? "";
  const [goals, setGoals] = useState<Goal[]>([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = getGoals(email);
    const merged: Goal[] = categories.map((cat) => {
      const existing = stored.find((g) => g.category === cat.name);
      return { category: cat.name, goalAmount: existing?.goalAmount ?? 0 };
    });
    setGoals(merged);
  }, [categories, email]);

  const handleChange = (category: string, value: string) => {
    const num = parseFloat(value) || 0;
    setGoals((prev) =>
      prev.map((g) => (g.category === category ? { ...g, goalAmount: num } : g))
    );
    setSaved(false);
  };

  const handleSave = () => {
    saveGoals(email, goals.filter((g) => g.goalAmount > 0));
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  if (categories.length === 0) return null;

  const totalGoal = goals.reduce((s, g) => s + g.goalAmount, 0);
  const totalActual = categories.reduce((s, c) => s + c.total_spent, 0);
  const overAll = totalActual > totalGoal && totalGoal > 0;

  return (
    <div className="goals-panel">
      <div className="goals-panel-header">
        <div>
          <h2>🎯 Monthly Spending Goals</h2>
          <p className="goals-panel-sub">Set a limit for each category and track your progress.</p>
        </div>
        {totalGoal > 0 && (
          <div className={`goals-total-badge ${overAll ? "over" : "under"}`}>
            <span>{overAll ? "Over budget" : "On track"}</span>
            <strong>
              ₪{totalActual.toLocaleString("he-IL", { maximumFractionDigits: 0 })} /
              ₪{totalGoal.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
            </strong>
          </div>
        )}
      </div>

      <div className="goals-table-wrap">
        <table className="goals-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Actual (ILS)</th>
              <th>Goal (ILS)</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {goals.map((g) => {
              const cat = categories.find((c) => c.name === g.category);
              const actual = cat?.total_spent ?? 0;
              const pct = g.goalAmount > 0 ? Math.min((actual / g.goalAmount) * 100, 100) : 0;
              const over = g.goalAmount > 0 && actual > g.goalAmount;

              return (
                <tr key={g.category}>
                  <td className="goals-cat-cell">
                    {cat?.icon && <span className="goals-cat-icon">{cat.icon}</span>}
                    {g.category}
                  </td>
                  <td className="goals-actual-cell">
                    ₪{actual.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="goals-input-cell">
                    <input
                      type="number"
                      className="goals-input"
                      value={g.goalAmount || ""}
                      min={0}
                      placeholder="No limit"
                      onChange={(e) => handleChange(g.category, e.target.value)}
                      aria-label={`Goal for ${g.category}`}
                    />
                  </td>
                  <td className="goals-status-cell">
                    {g.goalAmount > 0 ? (
                      <div className="goals-bar-wrap">
                        <div
                          className={`goals-bar-fill ${over ? "over" : "ok"}`}
                          style={{ width: `${pct}%` }}
                        />
                        <span className={`goals-pct ${over ? "over" : "ok"}`}>
                          {over
                            ? `+${Math.round((actual / g.goalAmount - 1) * 100)}%`
                            : `${Math.round(pct)}%`}
                        </span>
                      </div>
                    ) : (
                      <span className="goals-no-limit">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <button
        className={`goals-save-btn ${saved ? "saved" : ""}`}
        onClick={handleSave}
      >
        {saved ? "✓ Goals Saved" : "Save Goals"}
      </button>
    </div>
  );
}
