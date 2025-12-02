import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, TransactionType, MonthlyStats } from './types';
import { AddModal } from './components/AddModal';
import { TransactionItem } from './components/TransactionItem';
import { StatsCard } from './components/StatsCard';
import { getFinancialAdvice } from './services/geminiService';
import { 
  Plus, 
  Wallet, 
  BarChart3, 
  PieChart, 
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis 
} from 'recharts';

function App() {
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('spesesmart_transactions');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'reports'>('home');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // AI State
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('spesesmart_transactions', JSON.stringify(transactions));
  }, [transactions]);

  // Derived Data
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentDate.getMonth() && 
             tDate.getFullYear() === currentDate.getFullYear();
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate]);

  const stats: MonthlyStats = useMemo(() => {
    return filteredTransactions.reduce((acc, curr) => {
      if (curr.type === 'income') {
        acc.totalIncome += curr.amount;
        acc.balance += curr.amount;
      } else {
        acc.totalExpense += curr.amount;
        acc.balance -= curr.amount;
      }
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [filteredTransactions]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        data[t.category] = (data[t.category] || 0) + t.amount;
      });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTransactions]);

  // Handlers
  const handleAddTransaction = (amount: number, description: string, category: string, type: TransactionType) => {
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      amount,
      description,
      category,
      type,
      date: new Date().toISOString()
    };
    setTransactions(prev => [newTransaction, ...prev]);
  };

  const handleDelete = (id: string) => {
    if(confirm('Sei sicuro di voler eliminare questa transazione?')) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
    setAiAdvice(null); // Reset AI advice when month changes
  };

  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const monthName = currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
    const advice = await getFinancialAdvice(filteredTransactions, monthName);
    setAiAdvice(advice);
    setLoadingAi(false);
  };

  // Colors for Chart
  const COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto bg-slate-50 border-x border-slate-100 shadow-2xl overflow-hidden relative">
      
      {/* Header */}
      <header className="bg-white p-6 sticky top-0 z-10 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
            <Wallet size={18} strokeWidth={3} />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">SpeseSmart</h1>
        </div>
        
        {/* Date Navigator */}
        <div className="flex items-center bg-slate-100 rounded-full p-1">
          <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-white hover:shadow-sm transition-all text-slate-500">
            <ChevronLeft size={16} />
          </button>
          <span className="px-3 text-sm font-semibold text-slate-700 capitalize w-32 text-center">
            {currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-white hover:shadow-sm transition-all text-slate-500">
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
           <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center">
             <div>
               <p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Saldo Attuale</p>
               <p className={`text-2xl font-extrabold ${stats.balance >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                 {stats.balance.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
               </p>
             </div>
             {activeTab === 'home' && (
                <div className="h-10 w-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                  <BarChart3 size={20} />
                </div>
             )}
           </div>
        </div>

        {/* Content based on Tab */}
        {activeTab === 'home' ? (
          <div className="space-y-4">
             <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Transazioni Recenti</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                {filteredTransactions.length} mov.
              </span>
             </div>

             {filteredTransactions.length > 0 ? (
               <div className="space-y-0">
                 {filteredTransactions.map(t => (
                   <TransactionItem key={t.id} transaction={t} onDelete={handleDelete} />
                 ))}
               </div>
             ) : (
               <div className="text-center py-12 opacity-50">
                 <div className="bg-slate-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                   <Plus size={32} className="text-slate-400" />
                 </div>
                 <p className="text-slate-500">Nessuna transazione questo mese.</p>
                 <p className="text-xs text-slate-400 mt-1">Tocca il tasto + per iniziare</p>
               </div>
             )}
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Charts Section */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                <PieChart size={18} className="text-indigo-500" />
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
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: number) => `€${value.toFixed(2)}`}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {categoryData.map((entry, index) => (
                      <div key={entry.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                        <span className="text-slate-600 truncate flex-1">{entry.name}</span>
                        <span className="font-bold text-slate-800">€{entry.value.toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-slate-400 py-10">Nessuna spesa da analizzare.</p>
              )}
            </div>

            {/* AI Section */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Sparkles size={100} />
               </div>
               
               <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                 <Sparkles size={20} className="text-yellow-300" />
                 AI Advisor
               </h3>
               
               {!aiAdvice ? (
                 <div className="relative z-10">
                   <p className="text-indigo-100 text-sm mb-4">Ottieni un'analisi intelligente delle tue abitudini di spesa per questo mese.</p>
                   <button 
                    onClick={handleAiAnalysis}
                    disabled={loadingAi}
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-semibold transition-all w-full border border-white/10 flex items-center justify-center gap-2"
                   >
                     {loadingAi ? 'Analisi in corso...' : 'Genera Report AI'}
                   </button>
                 </div>
               ) : (
                 <div className="relative z-10 animate-fade-in">
                   <div className="text-sm leading-relaxed text-indigo-50 prose prose-invert prose-sm max-w-none">
                     <div dangerouslySetInnerHTML={{ __html: aiAdvice.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} />
                   </div>
                   <button 
                    onClick={() => setAiAdvice(null)}
                    className="mt-4 text-xs text-indigo-200 hover:text-white underline"
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
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-24 right-4 sm:right-[calc(50%-240px+1rem)] bg-indigo-600 text-white p-4 rounded-full shadow-xl hover:bg-indigo-700 active:scale-90 transition-all z-20"
        aria-label="Aggiungi Transazione"
      >
        <Plus size={28} />
      </button>

      {/* Add Modal */}
      <AddModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddTransaction}
      />

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-6 h-20 sm:max-w-lg sm:mx-auto z-20">
        <div className="flex justify-around items-center h-full pb-2">
          <button 
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'home' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Wallet size={24} />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          
          {/* Spacer for FAB */}
          <div className="w-12"></div>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'reports' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
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