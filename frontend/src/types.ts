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
