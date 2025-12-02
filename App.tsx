import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, MonthlyStats, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from './types.ts';
import { AddModal } from './components/AddModal.tsx';
import { TransactionItem } from './components/TransactionItem.tsx';
import { StatsCard } from './components/StatsCard.tsx';
import { getFinancialAdvice } from './services/geminiService.ts';
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
  Filter
} from 'lucide-react';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
} from 'recharts';

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
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => `€${value.toFixed(2)}`}
                        contentStyle={{ 
                          backgroundColor: '#1e293b', 
                          borderRadius: '12px', 
                          border: '1px solid #334155', 
                          color: '#f8fafc',
                          boxShadow: '0 4px 20px -1px rgb(0 0 0 / 0.3)' 
                        }}
                        itemStyle={{ color: '#e2e8f0' }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {categoryData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full shadow-sm shadow-black/50" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-slate-400 truncate flex-1">{entry.name}</span>
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

export default App;