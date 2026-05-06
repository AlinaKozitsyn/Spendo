import type {
  Transaction,
  CategoryInfo,
  MonthlySummary,
  TopMerchant,
  UploadResponse,
  SlotUploadResponse,
  MultiSummary,
} from "./types";

const BASE = "/api/v1";

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    if (typeof detail === "string") {
      throw new Error(detail);
    }
    if (detail && typeof detail === "object") {
      throw new Error(detail.message || detail.hint || JSON.stringify(detail));
    }
    throw new Error("Upload failed");
  }
  return res.json();
}

export async function fetchTransactions(
  category?: string
): Promise<{ transactions: Transaction[]; total: number }> {
  const params = category ? `?category=${encodeURIComponent(category)}` : "";
  const res = await fetch(`${BASE}/transactions${params}`);
  return res.json();
}

export async function fetchSummary(): Promise<{
  summaries: MonthlySummary[];
  top_merchants: TopMerchant[];
}> {
  const res = await fetch(`${BASE}/summary`);
  return res.json();
}

export async function fetchCategories(): Promise<{
  categories: CategoryInfo[];
}> {
  const res = await fetch(`${BASE}/categories`);
  return res.json();
}

export async function uploadFileToSlot(file: File, slot: number): Promise<SlotUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/upload-slot/${slot}`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    if (typeof detail === "string") throw new Error(detail);
    if (detail && typeof detail === "object") throw new Error(detail.message || JSON.stringify(detail));
    throw new Error("Upload failed");
  }
  return res.json();
}

export async function fetchMultiSummary(): Promise<MultiSummary> {
  const res = await fetch(`${BASE}/multi-summary`);
  return res.json();
}

export async function clearSlot(slot: number): Promise<void> {
  await fetch(`${BASE}/upload-slot/${slot}`, { method: "DELETE" });
}
