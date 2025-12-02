import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType } from '../types';
import { X, Check, Save, Plus } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (amount: number, description: string, category: string, type: TransactionType, id?: string) => void;
  initialData?: Transaction | null;
  expenseCategories: string[];
  incomeCategories: string[];
  onAddCategory: (newCategory: string, type: TransactionType) => void;
}

export const AddModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialData,
  expenseCategories,
  incomeCategories,
  onAddCategory
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  
  // New Category Logic
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  // Determine current list based on type
  const currentCategories = type === 'expense' ? expenseCategories : incomeCategories;

  // Reset or Populate form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setIsAddingCategory(false);
      setNewCategoryName('');

      if (initialData) {
        setType(initialData.type);
        setAmount(initialData.amount.toString());
        setDescription(initialData.description);
        setCategory(initialData.category);
      } else {
        // Reset for new entry
        setType('expense');
        setAmount('');
        setDescription('');
        // Default category is the first one available
        setCategory(expenseCategories[0] || '');
      }
    }
  }, [isOpen, initialData, expenseCategories]); // Added expenseCategories to dependency to ensure reset works on load

  // Focus input when adding category
  useEffect(() => {
    if (isAddingCategory && newCategoryInputRef.current) {
      newCategoryInputRef.current.focus();
    }
  }, [isAddingCategory]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    
    onSave(
      parseFloat(amount), 
      description, 
      category || currentCategories[0], // Fallback if somehow empty
      type,
      initialData?.id // Pass ID if editing
    );
    
    onClose();
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim(), type);
      setCategory(newCategoryName.trim()); // Select the new category
      setNewCategoryName('');
      setIsAddingCategory(false);
    } else {
      setIsAddingCategory(false);
    }
  };

  const handleKeyDownCategory = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateCategory();
    } else if (e.key === 'Escape') {
      setIsAddingCategory(false);
    }
  };

  const isEditing = !!initialData;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
          <h2 className="text-lg font-bold text-slate-100">
            {isEditing ? 'Modifica Transazione' : 'Nuova Transazione'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Type Toggle */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'expense' ? 'bg-slate-800 text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => { 
                setType('expense'); 
                setCategory(expenseCategories[0] || ''); 
                setIsAddingCategory(false);
              }}
            >
              Uscita
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'income' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => { 
                setType('income'); 
                setCategory(incomeCategories[0] || '');
                setIsAddingCategory(false);
              }}
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
              className="w-full text-4xl font-bold text-slate-100 placeholder-slate-700 outline-none border-b border-slate-700 focus:border-indigo-500 pb-2 bg-transparent transition-colors"
              autoFocus={!isEditing}
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
              className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {currentCategories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    category === cat 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500 hover:text-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}

              {/* Add Category Button/Input */}
              {isAddingCategory ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={newCategoryInputRef}
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onBlur={handleCreateCategory} // Save on blur
                    onKeyDown={handleKeyDownCategory}
                    placeholder="Nuova..."
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-500 bg-slate-800 text-white outline-none w-24 placeholder-slate-500"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300 transition-all flex items-center gap-1"
                >
                  <Plus size={12} />
                  Nuova
                </button>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            {isEditing ? <Save size={20} /> : <Check size={20} />} 
            {isEditing ? 'Aggiorna' : 'Salva'}
          </button>
        </form>
      </div>
    </div>
  );
};