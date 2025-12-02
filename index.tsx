import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Plus, 
  Wallet, 
  BarChart3, 
  PieChart, 
  Sparkles,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Info,
  CalendarDays,
  Filter,
  ArrowUpCircle, 
  ArrowDownCircle, 
  Trash2, 
  Edit2,
  X, 
  Check, 
  Save 
} from 'lucide-react';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Sector
} from 'recharts';
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

// --- GEMINI SERVICE ---
// Safe init: check if env exists (for GitHub Pages compatibility)
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';

// Only init AI if key is present to prevent immediate crash on static host
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const getFinancialAdvice = async (transactions: Transaction[], month: string) => {
  if (!ai) {
    return "API Key mancante. Configura le variabili d'ambiente per usare l'AI.";
  }

  if (transactions.length === 0) {
    return "Non ci sono abbastanza dati per generare un'analisi questo mese. Aggiungi alcune spese!";
  }

  // Prepare a summary string for the AI
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

// --- COMPONENT: TransactionItem ---
interface TransactionItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  isFirst?: boolean;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onDelete, onEdit, isFirst = false }) => {
  const isExpense = transaction.type === 'expense';
  
  // Swipe Logic State
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false); // New state to handle exit animation
  const itemRef = useRef<HTMLDivElement>(null);

  // Constants for swipe
  const SWIPE_THRESHOLD = 70; 
  const DELETE_THRESHOLD = 150; // Threshold to trigger full delete
  const MAX_SWIPE_RIGHT = 100; // Limit for edit (right swipe) only

  // Auto-swipe hint animation
  useEffect(() => {
    if (!isFirst || isDeleting) return;

    const interval = setInterval(() => {
      if (isDragging || isDeleting) return; 

      // Hint sequence
      setCurrentX(-40);
      
      setTimeout(() => {
        if (!isDragging && !isDeleting) setCurrentX(40);
      }, 400);

      setTimeout(() => {
        if (!isDragging && !isDeleting) setCurrentX(0);
      }, 800);

    }, 5000);

    return () => clearInterval(interval);
  }, [isFirst, isDragging, isDeleting]);

  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null || isDeleting) return;
    const x = e.touches[0].clientX;
    const diff = x - startX;
    
    // Logic: Limit swipe to the RIGHT (Edit), but allow full swipe to the LEFT (Delete)
    if (diff > MAX_SWIPE_RIGHT) {
        setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2); // Rubber band effect right
    } else {
        setCurrentX(diff); // Free movement left
    }
  };

  const handleTouchEnd = () => {
    handleSwipeEnd();
  };

  // Mouse Handlers
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

  const handleMouseUp = () => {
    handleSwipeEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) handleSwipeEnd();
  };

  // Logic to execute action or reset
  const handleSwipeEnd = () => {
    setIsDragging(false);
    
    if (currentX > SWIPE_THRESHOLD) {
      // Swipe Right -> Edit
      onEdit(transaction);
      setCurrentX(0); 
    } else if (currentX < -DELETE_THRESHOLD) {
      // Swipe Left -> Full Delete
      setIsDeleting(true);
      setCurrentX(-window.innerWidth); // Animate completely off screen
      
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate(50);

      // Wait for animation then delete
      setTimeout(() => onDelete(transaction.id), 300);
    } else {
      // Snap back if threshold not met
      setCurrentX(0);
    }
    setStartX(null);
  };

  // Helper to determine background color
  const getSwipeBackground = () => {
    if (currentX > 0) return 'bg-indigo-600'; // Edit Color
    if (currentX < 0) return 'bg-red-600'; // Delete Color
    return 'bg-slate-900';
  };

  if (isDeleting && Math.abs(currentX) >= window.innerWidth) {
      // Return null or placeholder while waiting for parent to delete data
      return <div className="h-[88px] mb-3 w-full"></div>;
  }

  return (
    <div 
      className="relative mb-3 h-[88px] w-full overflow-hidden rounded-xl select-none touch-pan-y"
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Background Layer (Actions) */}
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

      {/* Foreground Layer (Content) */}
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

// --- COMPONENT: AddModal ---
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

  // Reset or Populate form
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
      category || currentCategories[0], 
      type,
      initialData?.id
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

// --- COMPONENT: StatsCard ---
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

// --- MAIN APP COMPONENT ---
function App() {
  // State Transactions
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('spesesmart_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  // State Categories
  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('spesesmart_expense_categories');
    return saved ? JSON.parse(saved) : DEFAULT_EXPENSE_CATEGORIES;
  });

  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('spesesmart_income_categories');
    return saved ? JSON.parse(saved) : DEFAULT_INCOME_CATEGORIES;
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'reports'>('home');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Filter State
  const [selectedCategory, setSelectedCategory] = useState<string>('Tutte');
  
  // Chart Interactive State
  const [activeIndex, setActiveIndex] = useState(0);

  // AI State
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('spesesmart_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('spesesmart_expense_categories', JSON.stringify(expenseCategories));
  }, [expenseCategories]);

  useEffect(() => {
    localStorage.setItem('spesesmart_income_categories', JSON.stringify(incomeCategories));
  }, [incomeCategories]);

  // Derived Data: Transactions for the current month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentDate.getMonth() && 
             tDate.getFullYear() === currentDate.getFullYear();
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate]);

  // Derived Data: Transactions to display in the list (Filtered by Category)
  const displayedTransactions = useMemo(() => {
    if (selectedCategory === 'Tutte') {
      return monthlyTransactions;
    }
    return monthlyTransactions.filter(t => t.category === selectedCategory);
  }, [monthlyTransactions, selectedCategory]);

  // Combined Categories for the Filter List
  const allCategories = useMemo(() => {
    const categories = new Set([...expenseCategories, ...incomeCategories]);
    return ['Tutte', ...Array.from(categories).sort()];
  }, [expenseCategories, incomeCategories]);

  // Stats are always calculated on the full month data, regardless of visual filter
  const stats: MonthlyStats = useMemo(() => {
    return monthlyTransactions.reduce((acc, curr) => {
      if (curr.type === 'income') {
        acc.totalIncome += curr.amount;
        acc.balance += curr.amount;
      } else {
        acc.totalExpense += curr.amount;
        acc.balance -= curr.amount;
      }
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [monthlyTransactions]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    monthlyTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        data[t.category] = (data[t.category] || 0) + t.amount;
      });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [monthlyTransactions]);

  // Handlers
  const handleSaveTransaction = (amount: number, description: string, category: string, type: TransactionType, id?: string) => {
    if (id) {
      // Update existing
      setTransactions(prev => prev.map(t => 
        t.id === id 
          ? { ...t, amount, description, category, type }
          : t
      ));
    } else {
      // Create new
      const newTransaction: Transaction = {
        id: crypto.randomUUID(),
        amount,
        description,
        category,
        type,
        date: new Date().toISOString()
      };
      setTransactions(prev => [newTransaction, ...prev]);
    }
  };

  const handleAddCategory = (newCategory: string, type: TransactionType) => {
    if (type === 'expense') {
      if (!expenseCategories.includes(newCategory)) {
        setExpenseCategories(prev => [...prev, newCategory]);
      }
    } else {
      if (!incomeCategories.includes(newCategory)) {
        setIncomeCategories(prev => [...prev, newCategory]);
      }
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleOpenAddModal = () => {
    setEditingTransaction(null); // Ensure we are in "Add" mode
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    // Direct delete without confirmation for speed (since gesture is deliberate)
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
    setAiAdvice(null); // Reset AI advice when month changes
    setSelectedCategory('Tutte'); // Reset filter on month change
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [year, month] = e.target.value.split('-');
      const newDate = new Date(parseInt(year), parseInt(month) - 1, 1);
      setCurrentDate(newDate);
      setAiAdvice(null);
      setSelectedCategory('Tutte');
    }
  };

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const monthName = currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
    const advice = await getFinancialAdvice(monthlyTransactions, monthName);
    setAiAdvice(advice);
    setLoadingAi(false);
  };

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  // Custom Active Shape for Pie Chart
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
    return (
      <g>
        <text x={cx} y={cy - 10} dy={8} textAnchor="middle" fill="#94a3b8" className="text-[10px] uppercase font-bold tracking-wider">
          {payload.name.length > 12 ? payload.name.substring(0, 10) + '..' : payload.name}
        </text>
        <text x={cx} y={cy + 12} dy={8} textAnchor="middle" fill="#f8fafc" className="text-lg font-bold">
          €{value.toLocaleString()}
        </text>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 8}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          className="drop-shadow-lg"
        />
        <Sector
          cx={cx}
          cy={cy}
          startAngle={startAngle}
          endAngle={endAngle}
          innerRadius={outerRadius + 12}
          outerRadius={outerRadius + 13}
          fill={fill}
          opacity={0.3}
        />
      </g>
    );
  };

  // Helper for input type="month" value
  const currentMonthValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  // Colors for Chart (Adapted for Dark Mode)
  const COLORS = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#22d3ee', '#fb7185', '#e879f9'];

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto bg-slate-950 border-x border-slate-800 shadow-2xl overflow-hidden relative text-slate-200">
      
      {/* Header */}
      <header className="bg-slate-950/80 backdrop-blur-md p-6 sticky top-0 z-10 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Wallet size={18} strokeWidth={3} />
          </div>
          <h1 className="text-xl font-bold text-slate-100 tracking-tight">SpeseSmart</h1>
        </div>
        
        {/* Date Navigator with Native Picker */}
        <div className="flex items-center bg-slate-900 rounded-full p-1 border border-slate-800">
          <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-slate-800 hover:text-white transition-all text-slate-500 z-10">
            <ChevronLeft size={16} />
          </button>
          
          <div className="relative group mx-1">
             <div className="flex items-center gap-1 justify-center px-2 text-sm font-semibold text-slate-300 capitalize w-32 py-1 group-hover:text-white transition-colors">
                {currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
                <CalendarDays size={14} className="opacity-40 group-hover:opacity-100 transition-opacity" />
             </div>
             {/* Hidden Native Input */}
             <input
                type="month"
                value={currentMonthValue}
                onChange={handleDateSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
             />
          </div>

          <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-slate-800 hover:text-white transition-all text-slate-500 z-10">
            <ChevronRight size={16} />
          </button>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6">
        
        {/* Stats Row */}
        <div className="flex gap-3">
          <StatsCard label="Entrate" amount={stats.totalIncome} type="income" />
          <StatsCard label="Uscite" amount={stats.totalExpense} type="expense" />
        </div>
        <div className="w-full">
           <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm flex justify-between items-center">
             <div>
               <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Saldo Attuale</p>
               <p className={`text-3xl font-extrabold mt-1 ${stats.balance >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>
                 {stats.balance.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
               </p>
             </div>
             <div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
               <TrendingUp size={20} />
             </div>
           </div>
        </div>

        {/* Content based on Tab */}
        {activeTab === 'home' ? (
          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">Transazioni</h2>
              <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-2 py-1 rounded-full">
                {displayedTransactions.length} mov.
              </span>
             </div>

             {/* Category Filter Scroll */}
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex items-center justify-center min-w-[32px] h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500">
                  <Filter size={14} />
                </div>
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                      selectedCategory === cat 
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30' 
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
             </div>

             {displayedTransactions.length > 0 ? (
               <div className="space-y-0">
                 <div className="flex items-center gap-2 mb-2 px-2">
                    <Info size={12} className="text-slate-600" />
                    <span className="text-[10px] text-slate-600 uppercase tracking-wider">Scorri: SX per Eliminare • DX per Modificare</span>
                 </div>
                 {displayedTransactions.map((t, index) => (
                   <TransactionItem 
                     key={t.id} 
                     transaction={t} 
                     onDelete={handleDelete}
                     onEdit={handleEdit}
                     isFirst={index === 0 && selectedCategory === 'Tutte'}
                   />
                 ))}
               </div>
             ) : (
               <div className="text-center py-12 opacity-50">
                 {monthlyTransactions.length > 0 ? (
                   <>
                    <div className="bg-slate-900 border border-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Filter size={32} className="text-slate-600" />
                    </div>
                    <p className="text-slate-400">Nessuna transazione per questa categoria.</p>
                   </>
                 ) : (
                   <>
                    <div className="bg-slate-900 border border-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Plus size={32} className="text-slate-600" />
                    </div>
                    <p className="text-slate-400">Nessuna transazione questo mese.</p>
                    <p className="text-xs text-slate-600 mt-1">Tocca il tasto + per iniziare</p>
                   </>
                 )}
               </div>
             )}
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Charts Section */}
            <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800">
              <h3 className="font-bold text-slate-100 mb-6 flex items-center gap-2">
                <PieChart size={18} className="text-indigo-400" />
                Spese per Categoria
              </h3>
              
              {categoryData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RePieChart>
                      <Pie
                        activeIndex={activeIndex}
                        activeShape={renderActiveShape}
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        onMouseEnter={onPieEnter}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                    </RePieChart>
                  </ResponsiveContainer>
                  {/* Legend below */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {categoryData.map((entry, index) => (
                      <div 
                        key={entry.name} 
                        className={`flex items-center gap-2 text-xs p-1 rounded transition-colors ${activeIndex === index ? 'bg-slate-800/50' : ''}`}
                        onMouseEnter={() => setActiveIndex(index)}
                      >
                        <div className="w-2 h-2 rounded-full shadow-sm shadow-black/50" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className={`truncate flex-1 ${activeIndex === index ? 'text-white font-medium' : 'text-slate-400'}`}>{entry.name}</span>
                        <span className="font-bold text-slate-200">€{entry.value.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-600 py-10">Nessuna spesa da analizzare.</p>
              )}
            </div>

            {/* AI Section */}
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-2xl text-white shadow-xl shadow-indigo-900/10 border border-indigo-800/30 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-20">
                 <Sparkles size={100} />
               </div>
               
               <h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-indigo-100">
                 <Sparkles size={20} className="text-yellow-300" />
                 AI Advisor
               </h3>
               
               {!aiAdvice ? (
                 <div className="relative z-10">
                   <p className="text-indigo-200/80 text-sm mb-4">Ottieni un'analisi intelligente delle tue abitudini di spesa per questo mese.</p>
                   <button 
                    onClick={handleAiAnalysis}
                    disabled={loadingAi}
                    className="bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-semibold transition-all w-full border border-white/10 flex items-center justify-center gap-2 text-white"
                   >
                     {loadingAi ? 'Analisi in corso...' : 'Genera Report AI'}
                   </button>
                 </div>
               ) : (
                 <div className="relative z-10 animate-fade-in">
                   <div className="text-sm leading-relaxed text-indigo-100 prose prose-invert prose-sm max-w-none">
                     <div dangerouslySetInnerHTML={{ __html: aiAdvice.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                   </div>
                   <button 
                    onClick={() => setAiAdvice(null)}
                    className="mt-4 text-xs text-indigo-300 hover:text-white underline"
                   >
                     Chiudi analisi
                   </button>
                 </div>
               )}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button for Desktop/Mobile hybrid feeling */}
      <button
        onClick={handleOpenAddModal}
        className="fixed bottom-24 right-4 sm:right-[calc(50%-240px+1rem)] bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-90 transition-all z-20"
        aria-label="Aggiungi Transazione"
      >
        <Plus size={28} />
      </button>

      {/* Add Modal */}
      <AddModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveTransaction}
        initialData={editingTransaction}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        onAddCategory={handleAddCategory}
      />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 pb-safe pt-2 px-6 h-20 sm:max-w-lg sm:mx-auto z-20">
        <div className="flex justify-around items-center h-full pb-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <Wallet size={24} />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          
          {/* Spacer for FAB */}
          <div className="w-12"></div>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'reports' ? 'text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`}
          >
            <BarChart3 size={24} />
            <span className="text-[10px] font-medium">Report</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

// --- RENDER ---
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
