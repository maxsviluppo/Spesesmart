import React, { useState } from 'react';
import { TransactionType, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../types';
import { X, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (amount: number, description: string, category: string, type: TransactionType) => void;
}

export const AddModal: React.FC<Props> = ({ isOpen, onClose, onAdd }) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    
    onAdd(parseFloat(amount), description, category, type);
    
    // Reset fields
    setAmount('');
    setDescription('');
    setCategory(type === 'expense' ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
    onClose();
  };

  const categories = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Nuova Transazione</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Type Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              type="button"
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'expense' ? 'bg-white text-red-500 shadow-sm' : 'text-slate-500'}`}
              onClick={() => { setType('expense'); setCategory(EXPENSE_CATEGORIES[0]); }}
            >
              Uscita
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'income' ? 'bg-white text-emerald-500 shadow-sm' : 'text-slate-500'}`}
              onClick={() => { setType('income'); setCategory(INCOME_CATEGORIES[0]); }}
            >
              Entrata
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Importo (€)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full text-4xl font-bold text-slate-800 placeholder-slate-200 outline-none border-b border-slate-200 focus:border-indigo-500 pb-2 bg-transparent"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
             <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descrizione</label>
             <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Es. Spesa settimanale"
              className="w-full p-3 bg-slate-50 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    category === cat 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <Check size={20} /> Salva
          </button>
        </form>
      </div>
    </div>
  );
};