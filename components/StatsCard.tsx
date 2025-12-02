import React from 'react';

interface Props {
  label: string;
  amount: number;
  type: 'balance' | 'income' | 'expense';
}

export const StatsCard: React.FC<Props> = ({ label, amount, type }) => {
  let colorClass = "text-slate-200";
  let bgClass = "bg-slate-900";
  let borderClass = "border-slate-800";

  if (type === 'income') {
    colorClass = "text-emerald-400";
    bgClass = "bg-emerald-950/30";
    borderClass = "border-emerald-900/30";
  } else if (type === 'expense') {
    colorClass = "text-red-400";
    bgClass = "bg-red-950/30";
    borderClass = "border-red-900/30";
  } else {
    // Balance
    colorClass = "text-indigo-400";
    bgClass = "bg-slate-900";
  }

  return (
    <div className={`flex-1 p-4 rounded-2xl border shadow-sm flex flex-col items-center justify-center ${bgClass} ${borderClass}`}>
      <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</span>
      <span className={`text-xl sm:text-2xl font-bold truncate max-w-full ${colorClass}`}>
        {amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
      </span>
    </div>
  );
};