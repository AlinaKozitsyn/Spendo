import { useRef } from "react";
import type { SlotSummary } from "../types";

interface SlotState {
  status: "empty" | "uploading" | "done" | "error";
  label?: string;
  total?: number;
  error?: string;
}

interface Props {
  slots: (SlotState & { summary?: SlotSummary })[];
  onUpload: (file: File, slot: number) => void;
  onClear: (slot: number) => void;
}

const SLOT_LABELS = ["Month 1", "Month 2", "Month 3"];

export function MultiUploadArea({ slots, onUpload, onClear }: Props) {
  const inputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  return (
    <div className="multi-upload-grid">
      {SLOT_LABELS.map((label, i) => {
        const slot = slots[i];
        const isDone = slot.status === "done";
        const isUploading = slot.status === "uploading";
        const isError = slot.status === "error";

        return (
          <div
            key={i}
            className={`multi-slot-card ${isDone ? "done" : ""} ${isError ? "error-slot" : ""}`}
            onClick={() => !isUploading && !isDone && inputRefs[i].current?.click()}
            role="button"
            tabIndex={0}
            aria-label={`Upload ${label}`}
          >
            <input
              ref={inputRefs[i]}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file, i);
                e.target.value = "";
              }}
            />
            <div className="slot-number">{i + 1}</div>
            <div className="slot-label">{label}</div>

            {isUploading && (
              <div className="slot-status">
                <span className="spinner" />
                <span>Processing…</span>
              </div>
            )}

            {isDone && slot.summary && (
              <div className="slot-done-info">
                <div className="slot-period">{slot.summary.label}</div>
                <div className="slot-txn-count">{slot.summary.transaction_count} transactions</div>
                <div className="slot-total">
                  ₪{slot.summary.total_spent.toLocaleString("he-IL", { maximumFractionDigits: 0 })}
                </div>
                <button
                  className="slot-clear-btn"
                  onClick={(e) => { e.stopPropagation(); onClear(i); }}
                >
                  ✕ Remove
                </button>
              </div>
            )}

            {slot.status === "empty" && (
              <div className="slot-hint">Click or drag to upload</div>
            )}

            {isError && (
              <div className="slot-error">{slot.error || "Upload failed"}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
