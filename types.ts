export type TransactionType = 'expense' | 'income';

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  date: string; // ISO string
  type: TransactionType;
}

export const EXPENSE_CATEGORIES = [
  'Alimentari',
  'Trasporti',
  'Casa',
  'Svago',
  'Salute',
  'Shopping',
  'Ristoranti',
  'Altro'
];

export const INCOME_CATEGORIES = [
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