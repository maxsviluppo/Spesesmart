import React from 'react';

interface Props {
  label: string;
  amount: number;
  type: 'balance' | 'income' | 'expense';
}

export const StatsCard: React.FC<Props> = ({ label, amount, type }) => {
  let colorClass = "text-slate-800";
  let bgClass = "bg-white";

  if (type === 'income') {
    colorClass = "text-emerald-600";
    bgClass = "bg-emerald-50/50";
  } else if (type === 'expense') {
    colorClass = "text-red-600";
    bgClass = "bg-red-50/50";
  } else {
    colorClass = "text-indigo-600";
  }

  return (
    <div className={`flex-1 p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center ${bgClass}`}>
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">{label}</span>
      <span className={`text-xl sm:text-2xl font-bold truncate max-w-full ${colorClass}`}>
        {amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
      </span>
    </div>
  );
};