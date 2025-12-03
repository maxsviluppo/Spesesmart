import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Home, ShoppingCart, ListTodo, Bell, BarChart3, 
  Wallet, PieChart, ArrowRight, Sparkles 
} from 'lucide-react';
import { 
  Transaction, TransactionType, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES 
} from './types.ts';
import { StatsCard } from './components/StatsCard.tsx';
import { TransactionItem } from './components/TransactionItem.tsx';
import { AddModal } from './components/AddModal.tsx';
import { getFinancialAdvice } from './services/geminiService.ts';
import './index.css';

const App = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'shopping' | 'doit' | 'alerts' | 'reports'>('home');
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('transactions');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
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

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories));
  }, [expenseCategories]);

  useEffect(() => {
    localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories));
  }, [incomeCategories]);

  const currentMonth = new Date().toLocaleString('it-IT', { month: 'long', year: 'numeric' });
  
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const currentMonthTrans = transactions.filter(t => {
      const d = new Date(t.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const income = currentMonthTrans.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const expense = currentMonthTrans.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);

    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense
    };
  }, [transactions]);

  const handleOpenAddModal = () => {
    setEditingTransaction(null);
    setIsAddModalOpen(true);
  };

  const handleOpenShoppingModal = () => {
    console.log("Open Shopping Modal");
  };

  const handleOpenAlertModal = () => {
    console.log("Open Alert Modal");
  };

  const handleSaveTransaction = (amount: number, description: string, category: string, type: TransactionType, id?: string) => {
    if (id) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount, description, category, type } : t));
    } else {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 pb-32">
      <div className="max-w-lg mx-auto bg-slate-950 min-h-screen relative shadow-2xl shadow-black">
        
        {/* Header */}
        <header className="px-6 pt-12 pb-6 bg-gradient-to-b from-indigo-950/20 to-slate-950">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight">Il mio Wallet</h1>
              <p className="text-indigo-400 font-medium capitalize">{currentMonth}</p>
            </div>
            <div className="bg-slate-900 p-2 rounded-full border border-slate-800">
               <Wallet className="text-indigo-500" />
            </div>
          </div>

          <div className="flex gap-3 mb-2">
            <StatsCard label="Entrate" amount={monthlyStats.totalIncome} type="income" />
            <StatsCard label="Uscite" amount={monthlyStats.totalExpense} type="expense" />
          </div>
          <StatsCard label="Bilancio Totale" amount={monthlyStats.balance} type="balance" />
        </header>

        {/* Main Content */}
        <main className="px-6 space-y-8">
          
          <section className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-5 rounded-2xl border border-indigo-500/20 relative overflow-hidden">
             <div className="flex justify-between items-center mb-3 relative z-10">
               <div className="flex items-center gap-2">
                 <Sparkles size={18} className="text-indigo-400" />
                 <h3 className="font-bold text-indigo-100">Gemini Insights</h3>
               </div>
               {!aiAdvice && (
                 <button 
                  onClick={generateAdvice} 
                  disabled={isLoadingAi}
                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-full font-medium transition-colors disabled:opacity-50"
                 >
                   {isLoadingAi ? 'Analisi...' : 'Analizza'}
                 </button>
               )}
             </div>
             
             {aiAdvice ? (
               <div className="text-sm text-indigo-100/80 leading-relaxed animate-fade-in markdown-content">
                  {aiAdvice.split('\n').map((line, i) => <p key={i} className="mb-1">{line}</p>)}
               </div>
             ) : (
               <p className="text-xs text-indigo-300/60">
                 Tocca "Analizza" per ottenere consigli personalizzati sulle tue abitudini di spesa.
               </p>
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
                  <TransactionItem 
                    key={t.id} 
                    transaction={t} 
                    onDelete={handleDeleteTransaction}
                    onEdit={handleEditTransaction}
                    isFirst={index === 0}
                  />
                ))
              ) : (
                <div className="text-center py-10 text-slate-600">
                  <PieChart size={48} className="mx-auto mb-3 opacity-20" />
                  <p>Nessuna transazione registrata</p>
                </div>
              )}
            </div>
          </section>
        </main>

        <AddModal 
          isOpen={isAddModalOpen} 
          onClose={() => setIsAddModalOpen(false)} 
          onSave={handleSaveTransaction}
          initialData={editingTransaction}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          onAddCategory={handleAddCategory}
        />

        {/* Floating Action Button */}
        <div className="fixed bottom-24 left-0 right-0 z-40 max-w-lg mx-auto pointer-events-none flex justify-end px-6">
          <button 
            onClick={() => {
              if (activeTab === 'home') handleOpenAddModal();
              else if (activeTab === 'shopping') handleOpenShoppingModal();
              else if (activeTab === 'alerts') handleOpenAlertModal();
              else setActiveTab('home');
            }} 
            className="pointer-events-auto w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={28} />
          </button>
        </div>

        {/* Footer Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0E1629]/95 backdrop-blur-xl border-t border-slate-800 pb-safe z-40 max-w-lg mx-auto">
          <div className="flex justify-around items-center h-16 px-2">
              <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'home' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
                <Home size={22} className={activeTab === 'home' ? 'fill-indigo-400/20' : ''} />
                <span className="text-[9px] font-bold mt-1">Home</span>
              </button>
              <button onClick={() => setActiveTab('shopping')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'shopping' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
                <ShoppingCart size={22} className={activeTab === 'shopping' ? 'fill-indigo-400/20' : ''} />
                <span className="text-[9px] font-bold mt-1">Spesa</span>
              </button>
              <button onClick={() => setActiveTab('doit')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'doit' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
                <ListTodo size={22} className={activeTab === 'doit' ? 'fill-indigo-400/20' : ''} />
                <span className="text-[9px] font-bold mt-1">Do It</span>
              </button>
              <button onClick={() => setActiveTab('alerts')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'alerts' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
                <Bell size={22} className={activeTab === 'alerts' ? 'fill-indigo-400/20' : ''} />
                <span className="text-[9px] font-bold mt-1">Avvisi</span>
              </button>
              <button onClick={() => setActiveTab('reports')} className={`flex flex-col items-center justify-center w-14 transition-all ${activeTab === 'reports' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
                <BarChart3 size={22} className={activeTab === 'reports' ? 'fill-indigo-400/20' : ''} />
                <span className="text-[9px] font-bold mt-1">Report</span>
              </button>
          </div>
        </nav>
      </div>
    </div>
  );
};

// Check if root element exists
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