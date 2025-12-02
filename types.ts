export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string; // ISO string
  type: TransactionType;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Alimentari',
  'Trasporti',
  'Casa',
  'Svago',
  'Salute',
  'Shopping',
  'Ristoranti',
  'Altro'
];

export const DEFAULT_INCOME_CATEGORIES = [
  'Stipendio',
  'Regalo',
  'Vendita',
  'Investimenti',
  'Altro'
];

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}