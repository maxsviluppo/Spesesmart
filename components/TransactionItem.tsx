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
    <div className="flex items-center justify-between p-4 bg-slate-900 rounded-xl shadow-sm border border-slate-800 mb-3 transition-all hover:bg-slate-800/80">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isExpense ? 'bg-red-950/30 text-red-400' : 'bg-emerald-950/30 text-emerald-400'}`}>
          {isExpense ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
        </div>
        <div>
          <p className="font-medium text-slate-200">{transaction.description}</p>
          <p className="text-xs text-slate-500 capitalize">{transaction.category} • {new Date(transaction.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`font-bold ${isExpense ? 'text-slate-300' : 'text-emerald-400'}`}>
          {isExpense ? '-' : '+'}€{transaction.amount.toFixed(2)}
        </span>
        <button 
          onClick={() => onDelete(transaction.id)}
          className="text-slate-600 hover:text-red-400 transition-colors p-1"
          aria-label="Elimina"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};