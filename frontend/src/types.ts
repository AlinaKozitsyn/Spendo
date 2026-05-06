export interface Transaction {
  transaction_id: string;
  date: string;
  merchant_name: string;
  amount: number;
  currency: string;
  description: string | null;
  category: string;
  group: string;
  icon: string | null;
  confidence: number;
}

export interface CategoryInfo {
  name: string;
  group: string;
  icon: string | null;
  count: number;
  total_spent: number;
}

export interface CategorySummary {
  name: string;
  group: string;
  total_spent: number;
  transaction_count: number;
  icon: string | null;
}

export interface MonthlySummary {
  label: string;
  year: number;
  month: number;
  total_spent: number;
  categories: CategorySummary[];
}

export interface TopMerchant {
  name: string;
  total_spent: number;
}

export interface UploadResponse {
  message: string;
  filename: string;
  total_transactions: number;
  skipped_rows: number;
  errors: string[];
}

export interface SlotUploadResponse {
  message: string;
  slot: number;
  filename: string;
  total_transactions: number;
}

export interface SlotSummary {
  slot: number;
  filename: string;
  label: string;
  year: number;
  month: number;
  total_spent: number;
  transaction_count: number;
  categories: CategorySummary[];
  top_merchants: TopMerchant[];
}

export interface MultiSummary {
  slots: SlotSummary[];
}
