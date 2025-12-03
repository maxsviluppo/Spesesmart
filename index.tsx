import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Home, ShoppingCart, ListTodo, Bell, BarChart3, 
  Wallet, PieChart, ArrowRight, Sparkles, CheckCircle2, Circle, Trash2, AlertTriangle, Info,
  ArrowUpCircle, ArrowDownCircle, Edit2, X, Check, Save
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// --- TYPES ---
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
  'Alimentari', 'Trasporti', 'Casa', 'Svago', 'Salute', 'Shopping', 'Ristoranti', 'Altro'
];

export const DEFAULT_INCOME_CATEGORIES = [
  'Stipendio', 'Regalo', 'Vendita', 'Investimenti', 'Altro'
];

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

// --- SERVICES ---
// Safe init: check if env exists (for GitHub Pages compatibility)
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const getFinancialAdvice = async (transactions: Transaction[], month: string) => {
  if (!ai) {
    return "API Key mancante. Configura le variabili d'ambiente per usare l'AI.";
  }

  if (transactions.length === 0) {
    return "Non ci sono abbastanza dati per generare un'analisi questo mese. Aggiungi alcune spese!";
  }

  const summary = transactions.map(t => 
    `- ${t.date.split('T')[0]}: ${t.type === 'expense' ? 'Spesa' : 'Entrata'} di €${t.amount} per ${t.description} (${t.category})`
  ).join('\n');

  const prompt = `
    Sei un assistente finanziario esperto e amichevole.
    Analizza le seguenti transazioni per il mese di ${month}.
    
    Dati Transazioni:
    ${summary}
    
    Per favore fornisci:
    1. Un breve riassunto dell'andamento del mese.
    2. Identifica la categoria dove ho speso di più.
    3. Un consiglio pratico per risparmiare basato su questi dati.
    
    Rispondi in italiano. Mantieni il tono incoraggiante e conciso (massimo 150 parole).
    Usa formattazione Markdown semplice (grassetto, elenchi).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Impossibile generare l'analisi al momento.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Si è verificato un errore durante l'analisi dei dati. Riprova più tardi.";
  }
};

// --- COMPONENTS ---

// StatsCard Component
interface StatsCardProps {
  label: string;
  amount: number;
  type: 'balance' | 'income' | 'expense';
}

const StatsCard: React.FC<StatsCardProps> = ({ label, amount, type }) => {
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

// TransactionItem Component
interface TransactionItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  isFirst?: boolean;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onDelete, onEdit, isFirst = false }) => {
  const isExpense = transaction.type === 'expense';
  
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const SWIPE_THRESHOLD = 70; 
  const DELETE_THRESHOLD = 150; 
  const MAX_SWIPE_RIGHT = 100;

  useEffect(() => {
    if (!isFirst || isDeleting) return;
    const interval = setInterval(() => {
      if (isDragging || isDeleting) return; 
      setCurrentX(-40);
      setTimeout(() => { if (!isDragging && !isDeleting) setCurrentX(40); }, 400);
      setTimeout(() => { if (!isDragging && !isDeleting) setCurrentX(0); }, 800);
    }, 5000);
    return () => clearInterval(interval);
  }, [isFirst, isDragging, isDeleting]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null || isDeleting) return;
    const x = e.touches[0].clientX;
    const diff = x - startX;
    
    if (diff > MAX_SWIPE_RIGHT) {
        setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2);
    } else {
        setCurrentX(diff);
    }
  };

  const handleTouchEnd = () => handleSwipeEnd();

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || startX === null || isDeleting) return;
    e.preventDefault(); 
    const x = e.clientX;
    const diff = x - startX;
    if (diff > MAX_SWIPE_RIGHT) {
         setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2);
    } else {
         setCurrentX(diff);
    }
  };

  const handleMouseUp = () => handleSwipeEnd();
  const handleMouseLeave = () => { if (isDragging) handleSwipeEnd(); };

  const handleSwipeEnd = () => {
    setIsDragging(false);
    if (currentX > SWIPE_THRESHOLD) {
      onEdit(transaction);
      setCurrentX(0); 
    } else if (currentX < -DELETE_THRESHOLD) {
      setIsDeleting(true);
      setCurrentX(-window.innerWidth);
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => onDelete(transaction.id), 300);
    } else {
      setCurrentX(0);
    }
    setStartX(null);
  };

  const getSwipeBackground = () => {
    if (currentX > 0) return 'bg-indigo-600';
    if (currentX < 0) return 'bg-red-600';
    return 'bg-slate-900';
  };

  if (isDeleting && Math.abs(currentX) >= window.innerWidth) {
      return <div className="h-[88px] mb-3 w-full"></div>;
  }

  return (
    <div 
      className="relative mb-3 h-[88px] w-full overflow-hidden rounded-xl select-none touch-pan-y"
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      style={{ touchAction: 'pan-y' }}
    >
      <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors ${getSwipeBackground()}`}>
        <div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX > 30 ? 1 : 0 }}>
          <Edit2 size={24} />
          <span>Modifica</span>
        </div>
        <div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX < -30 ? 1 : 0 }}>
          <span>Elimina</span>
          <Trash2 size={24} />
        </div>
      </div>
      <div 
        ref={itemRef}
        className="relative h-full bg-slate-900 flex items-center justify-between p-4 border border-slate-800 rounded-xl transition-transform ease-out"
        style={{ 
          transform: `translateX(${currentX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        <div className="flex items-center gap-3 pointer-events-none">
          <div className={`p-2 rounded-full ${isExpense ? 'bg-red-950/30 text-red-400' : 'bg-emerald-950/30 text-emerald-400'}`}>
            {isExpense ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
          </div>
          <div>
            <p className="font-medium text-slate-200">{transaction.description}</p>
            <p className="text-xs text-slate-500 capitalize">{transaction.category} • {new Date(transaction.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 pointer-events-none">
          <span className={`font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
            {isExpense ? '-' : '+'}€{transaction.amount.toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
};

// AddModal Component
interface AddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (amount: number, description: string, category: string, type: TransactionType, id?: string) => void;
  initialData?: Transaction | null;
  expenseCategories: string[];
  incomeCategories: string[];
  onAddCategory: (newCategory: string, type: TransactionType) => void;
}

const AddModal: React.FC<AddModalProps> = ({ 
  isOpen, onClose, onSave, initialData, expenseCategories, incomeCategories, onAddCategory
}) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const newCategoryInputRef = useRef<HTMLInputElement>(null);

  const currentCategories = type === 'expense' ? expenseCategories : incomeCategories;

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
        setType('expense');
        setAmount('');
        setDescription('');
        setCategory(expenseCategories[0] || '');
      }
    }
  }, [isOpen, initialData, expenseCategories]);

  useEffect(() => {
    if (isAddingCategory && newCategoryInputRef.current) newCategoryInputRef.current.focus();
  }, [isAddingCategory]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    onSave(
      parseFloat(amount), description, category || currentCategories[0], type, initialData?.id
    );
    onClose();
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim(), type);
      setCategory(newCategoryName.trim());
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
          <h2 className="text-lg font-bold text-slate-100">{isEditing ? 'Modifica Transazione' : 'Nuova Transazione'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              type="button"
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'expense' ? 'bg-slate-800 text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => { setType('expense'); setCategory(expenseCategories[0] || ''); setIsAddingCategory(false); }}
            >
              Uscita
            </button>
            <button
              type="button"
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'income' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => { setType('income'); setCategory(incomeCategories[0] || ''); setIsAddingCategory(false); }}
            >
              Entrata
            </button>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Importo (€)</label>
            <input
              type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
              className="w-full text-4xl font-bold text-slate-100 placeholder-slate-700 outline-none border-b border-slate-700 focus:border-indigo-500 pb-2 bg-transparent transition-colors"
              autoFocus={!isEditing} required
            />
          </div>
          <div>
             <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descrizione</label>
             <input
              type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Es. Spesa settimanale"
              className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {currentCategories.map(cat => (
                <button
                  key={cat} type="button" onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500 hover:text-slate-200'}`}
                >
                  {cat}
                </button>
              ))}
              {isAddingCategory ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={newCategoryInputRef} type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)}
                    onBlur={handleCreateCategory} onKeyDown={handleKeyDownCategory} placeholder="Nuova..."
                    className="px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-500 bg-slate-800 text-white outline-none w-24 placeholder-slate-500"
                  />
                </div>
              ) : (
                <button type="button" onClick={() => setIsAddingCategory(true)} className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300 transition-all flex items-center gap-1">
                  <Plus size={12} /> Nuova
                </button>
              )}
            </div>
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-indigo-900/20 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-2">
            {isEditing ? <Save size={20} /> : <Check size={20} />} {isEditing ? 'Aggiorna' : 'Salva'}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- APP ---

interface ListItem {
  id: string;
  text: string;
  completed: boolean;
}

interface AlertItem {
  id: string;
  type: 'warning' | 'info' | 'success';
  message: string;
  date: string;
}

const App = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'shopping' | 'doit' | 'alerts' | 'reports'>('home');
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('transactions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [shoppingList, setShoppingList] = useState<ListItem[]>(() => {
    try {
      const saved = localStorage.getItem('shoppingList');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newShoppingItem, setNewShoppingItem] = useState('');

  const [todoList, setTodoList] = useState<ListItem[]>(() => {
    try {
      const saved = localStorage.getItem('todoList');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [newTodoItem, setNewTodoItem] = useState('');

  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('expenseCategories');
      return saved ? JSON.parse(saved) : DEFAULT_EXPENSE_CATEGORIES;
    } catch { return DEFAULT_EXPENSE_CATEGORIES; }
  });
  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('incomeCategories');
      return saved ? JSON.parse(saved) : DEFAULT_INCOME_CATEGORIES;
    } catch { return DEFAULT_INCOME_CATEGORIES; }
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('shoppingList', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('todoList', JSON.stringify(todoList)); }, [todoList]);
  useEffect(() => { localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories)); }, [expenseCategories]);
  useEffect(() => { localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories)); }, [incomeCategories]);

  const currentMonth = new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' });
  
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentMonthTrans = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const income = currentMonthTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = currentMonthTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    return { totalIncome: income, totalExpense: expense, balance: income - expense };
  }, [transactions]);

  const systemAlerts = useMemo<AlertItem[]>(() => {
    const alerts: AlertItem[] = [];
    if (monthlyStats.balance < 0) {
      alerts.push({ id: 'bal-low', type: 'warning', message: 'Attenzione: Il saldo mensile è negativo.', date: new Date().toISOString() });
    }
    if (monthlyStats.totalExpense > monthlyStats.totalIncome && monthlyStats.totalIncome > 0) {
      alerts.push({ id: 'exp-high', type: 'warning', message: 'Le uscite superano le entrate questo mese.', date: new Date().toISOString() });
    }
    if (shoppingList.filter(i => !i.completed).length > 5) {
      alerts.push({ id: 'shop-len', type: 'info', message: `Hai ${shoppingList.filter(i => !i.completed).length} articoli nella lista della spesa.`, date: new Date().toISOString() });
    }
    if (todoList.filter(i => !i.completed).length > 0) {
       alerts.push({ id: 'todo-len', type: 'info', message: `Hai ${todoList.filter(i => !i.completed).length} attività in sospeso.`, date: new Date().toISOString() });
    }
    if (alerts.length === 0) {
        alerts.push({ id: 'ok', type: 'success', message: 'Tutto ok! Nessuna criticità rilevata.', date: new Date().toISOString() });
    }
    return alerts;
  }, [monthlyStats, shoppingList, todoList]);

  const handleOpenAddModal = () => {
    setEditingTransaction(null);
    setIsAddModalOpen(true);
  };

  const handleSaveTransaction = (amount: number, description: string, category: string, type: TransactionType, id?: string) => {
    if (id) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount, description, category, type } : t));
    } else {
      const newTransaction: Transaction = {
        id: crypto.randomUUID(), amount, description, category, type, date: new Date().toISOString()
      };
      setTransactions(prev => [newTransaction, ...prev]);
    }
    setIsAddModalOpen(false);
  };

  const handleDeleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsAddModalOpen(true);
  };

  const handleAddCategory = (newCat: string, type: TransactionType) => {
    if (type === 'expense') {
      if (!expenseCategories.includes(newCat)) setExpenseCategories([...expenseCategories, newCat]);
    } else {
      if (!incomeCategories.includes(newCat)) setIncomeCategories([...incomeCategories, newCat]);
    }
  };

  const generateAdvice = async () => {
    setIsLoadingAi(true);
    const advice = await getFinancialAdvice(transactions, currentMonth);
    setAiAdvice(advice);
    setIsLoadingAi(false);
  };

  const addListItem = (listType: 'shopping' | 'todo', text: string) => {
    if (!text.trim()) return;
    const newItem: ListItem = { id: crypto.randomUUID(), text: text.trim(), completed: false };
    if (listType === 'shopping') {
      setShoppingList(prev => [newItem, ...prev]);
      setNewShoppingItem('');
    } else {
      setTodoList(prev => [newItem, ...prev]);
      setNewTodoItem('');
    }
  };

  const toggleListItem = (listType: 'shopping' | 'todo', id: string) => {
    if (listType === 'shopping') {
      setShoppingList(prev => prev.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
    } else {
      setTodoList(prev => prev.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
    }
  };

  const deleteListItem = (listType: 'shopping' | 'todo', id: string) => {
    if (listType === 'shopping') {
      setShoppingList(prev => prev.filter(i => i.id !== id));
    } else {
      setTodoList(prev => prev.filter(i => i.id !== id));
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            <section className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-5 rounded-2xl border border-indigo-500/20 relative overflow-hidden">
               <div className="flex justify-between items-center mb-3 relative z-10">
                 <div className="flex items-center gap-2">
                   <Sparkles size={18} className="text-indigo-400" />
                   <h3 className="font-bold text-indigo-100">Gemini Insights</h3>
                 </div>
                 {!aiAdvice && (
                   <button onClick={generateAdvice} disabled={isLoadingAi} className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-50">
                     {isLoadingAi ? 'Analisi...' : 'Analizza'}
                   </button>
                 )}
               </div>
               {aiAdvice ? (
                 <div className="text-sm text-indigo-100/80 leading-relaxed animate-fade-in markdown-content">
                    {aiAdvice.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
                 </div>
               ) : (
                 <p className="text-xs text-indigo-300/60">Tocca "Analizza" per ottenere consigli personalizzati.</p>
               )}
            </section>
            <section>
              <div className="flex justify-between items-end mb-4">
                <h3 className="text-lg font-bold text-white">Transazioni Recenti</h3>
                <button onClick={() => setActiveTab('reports')} className="text-xs text-indigo-400 font-medium flex items-center gap-1 hover:text-indigo-300">
                  Vedi tutto <ArrowRight size={14} />
                </button>
              </div>
              <div className="space-y-1">
                {transactions.length > 0 ? (
                  transactions.slice(0, 10).map((t, index) => (
                    <TransactionItem key={t.id} transaction={t} onDelete={handleDeleteTransaction} onEdit={handleEditTransaction} isFirst={index === 0} />
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-600">
                    <PieChart size={48} className="mx-auto mb-3 opacity-20" />
                    <p>Nessuna transazione registrata</p>
                  </div>
                )}
              </div>
            </section>
          </>
        );
      case 'shopping':
        return (
          <div className="space-y-6">
             <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ShoppingCart className="text-emerald-400" size={20} />
                  Lista della Spesa
                </h3>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" value={newShoppingItem} onChange={(e) => setNewShoppingItem(e.target.value)}
                    placeholder="Aggiungi prodotto..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && addListItem('shopping', newShoppingItem)}
                  />
                  <button onClick={() => addListItem('shopping', newShoppingItem)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg transition-colors"><Plus size={24} /></button>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                  {shoppingList.length > 0 ? shoppingList.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 animate-slide-up">
                      <button onClick={() => toggleListItem('shopping', item.id)} className="flex items-center gap-3 flex-1 text-left">
                        {item.completed ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Circle className="text-slate-500" size={20} />}
                        <span className={`text-sm ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{item.text}</span>
                      </button>
                      <button onClick={() => deleteListItem('shopping', item.id)} className="text-slate-500 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                    </div>
                  )) : <p className="text-center text-slate-600 text-sm py-8">La lista è vuota</p>}
                </div>
             </div>
          </div>
        );
      case 'doit':
        return (
          <div className="space-y-6">
             <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <ListTodo className="text-indigo-400" size={20} />
                  Cose da fare (Do It)
                </h3>
                <div className="flex gap-2 mb-4">
                  <input 
                    type="text" value={newTodoItem} onChange={(e) => setNewTodoItem(e.target.value)}
                    placeholder="Nuova attività..."
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-indigo-500 transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && addListItem('todo', newTodoItem)}
                  />
                  <button onClick={() => addListItem('todo', newTodoItem)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg transition-colors"><Plus size={24} /></button>
                </div>
                <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
                  {todoList.length > 0 ? todoList.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-lg border border-slate-700/50 animate-slide-up">
                      <button onClick={() => toggleListItem('todo', item.id)} className="flex items-center gap-3 flex-1 text-left">
                        {item.completed ? <CheckCircle2 className="text-indigo-500" size={20} /> : <Circle className="text-slate-500" size={20} />}
                        <span className={`text-sm ${item.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{item.text}</span>
                      </button>
                      <button onClick={() => deleteListItem('todo', item.id)} className="text-slate-500 hover:text-red-400 p-2"><Trash2 size={16} /></button>
                    </div>
                  )) : <p className="text-center text-slate-600 text-sm py-8">Nessuna attività in programma</p>}
                </div>
             </div>
          </div>
        );
      case 'alerts':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Bell className="text-yellow-400" size={20} /> Centro Avvisi</h3>
            <div className="space-y-3">
              {systemAlerts.map((alert) => (
                <div key={alert.id} className={`p-4 rounded-xl border flex items-start gap-4 ${alert.type === 'warning' ? 'bg-red-950/20 border-red-900/50 text-red-200' : alert.type === 'success' ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-200' : 'bg-blue-950/20 border-blue-900/50 text-blue-200'}`}>
                  <div className={`p-2 rounded-full ${alert.type === 'warning' ? 'bg-red-900/30 text-red-400' : alert.type === 'success' ? 'bg-emerald-900/30 text-emerald-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    {alert.type === 'warning' ? <AlertTriangle size={20} /> : alert.type === 'success' ? <CheckCircle2 size={20} /> : <Info size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-medium leading-relaxed">{alert.message}</p>
                    <p className="text-[10px] opacity-60 mt-2 uppercase tracking-wider">Sistema • {new Date(alert.date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'reports':
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><BarChart3 className="text-indigo-400" size={20} /> Report Finanziario</h3>
            <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
               <h4 className="text-sm text-slate-400 mb-4">Riepilogo Totale</h4>
               <div className="space-y-3">
                 <div className="flex justify-between items-center"><span className="text-slate-300">Totale Entrate</span><span className="text-emerald-400 font-bold">+€{monthlyStats.totalIncome.toFixed(2)}</span></div>
                 <div className="flex justify-between items-center"><span className="text-slate-300">Totale Uscite</span><span className="text-red-400 font-bold">-€{monthlyStats.totalExpense.toFixed(2)}</span></div>
                 <div className="h-px bg-slate-800 my-2"></div>
                 <div className="flex justify-between items-center"><span className="text-slate-200 font-medium">Saldo</span><span className={`font-bold ${monthlyStats.balance >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>{monthlyStats.balance >= 0 ? '+' : ''}€{monthlyStats.balance.toFixed(2)}</span></div>
               </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-3">Tutte le transazioni</h4>
              <div className="space-y-1">
                {transactions.length > 0 ? (
                  transactions.map((t) => <TransactionItem key={t.id} transaction={t} onDelete={handleDeleteTransaction} onEdit={handleEditTransaction} />)
                ) : <p className="text-center text-slate-600 text-sm py-4">Nessun dato disponibile</p>}
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 pb-32">
      <div className="max-w-lg mx-auto bg-slate-950 min-h-screen relative shadow-2xl shadow-black">
        <header className="px-6 pt-12 pb-6 bg-gradient-to-b from-indigo-950/20 to-slate-950">
          <div className="flex justify-between items-start mb-6">
            <div><h1 className="text-3xl font-black text-white tracking-tight">Il mio Wallet</h1><p className="text-indigo-400 font-medium capitalize">{currentMonth}</p></div>
            <div className="bg-slate-900 p-2 rounded-full border border-slate-800"><Wallet className="text-indigo-500" /></div>
          </div>
          <div className="flex gap-3 mb-2"><StatsCard label="Entrate" amount={monthlyStats.totalIncome} type="income" /><StatsCard label="Uscite" amount={monthlyStats.totalExpense} type="expense" /></div>
          <StatsCard label="Bilancio Totale" amount={monthlyStats.balance} type="balance" />
        </header>

        <main className="px-6 space-y-8 min-h-[50vh]">
          {renderContent()}
        </main>

        <AddModal 
          isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveTransaction}
          initialData={editingTransaction} expenseCategories={expenseCategories} incomeCategories={incomeCategories} onAddCategory={handleAddCategory}
        />

        <div className="fixed bottom-24 left-0 right-0 z-50 max-w-lg mx-auto pointer-events-none flex justify-end px-6">
          <button onClick={handleOpenAddModal} className="pointer-events-auto w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all" aria-label="Aggiungi transazione"><Plus size={28} /></button>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 bg-[#0E1629]/95 backdrop-blur-xl border-t border-slate-800 pb-safe z-40 max-w-lg mx-auto">
          <div className="flex justify-around items-center h-16 px-2">
              <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'home' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><Home size={22} className={activeTab === 'home' ? 'fill-indigo-400/20' : ''} /><span className="text-[9px] font-bold mt-1">Home</span></button>
              <button onClick={() => setActiveTab('shopping')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'shopping' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><ShoppingCart size={22} className={activeTab === 'shopping' ? 'fill-indigo-400/20' : ''} /><span className="text-[9px] font-bold mt-1">Spesa</span></button>
              <button onClick={() => setActiveTab('doit')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'doit' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><ListTodo size={22} className={activeTab === 'doit' ? 'fill-indigo-400/20' : ''} /><span className="text-[9px] font-bold mt-1">Do It</span></button>
              <button onClick={() => setActiveTab('alerts')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'alerts' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><Bell size={22} className={activeTab === 'alerts' ? 'fill-indigo-400/20' : ''} /><span className="text-[9px] font-bold mt-1">Avvisi</span></button>
              <button onClick={() => setActiveTab('reports')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'reports' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}><BarChart3 size={22} className={activeTab === 'reports' ? 'fill-indigo-400/20' : ''} /><span className="text-[9px] font-bold mt-1">Report</span></button>
          </div>
        </nav>
      </div>
    </div>
  );
};

let rootElement = document.getElementById('root');
if (!rootElement) {
  rootElement = document.createElement('div');
  rootElement.id = 'root';
  document.body.appendChild(rootElement);
}

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);