import React from 'react';
import { Transaction } from '../types';
import { ArrowUpCircle, ArrowDownCircle, Trash2 } from 'lucide-react';

interface Props {
  transaction: Transaction;
  onDelete: (id: string) => void;
}

export const TransactionItem: React.FC<Props> = ({ transaction, onDelete }) => {
  const isExpense = transaction.type === 'expense';
  
  return (
    <div className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-slate-100 mb-3 transition-all hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isExpense ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
          {isExpense ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
        </div>
        <div>
          <p className="font-semibold text-slate-800">{transaction.description}</p>
          <p className="text-xs text-slate-500 capitalize">{transaction.category} • {new Date(transaction.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-bold ${isExpense ? 'text-slate-800' : 'text-emerald-600'}`}>
          {isExpense ? '-' : '+'}€{transaction.amount.toFixed(2)}
        </span>
        <button 
          onClick={() => onDelete(transaction.id)}
          className="text-slate-300 hover:text-red-500 transition-colors"
          aria-label="Elimina"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};