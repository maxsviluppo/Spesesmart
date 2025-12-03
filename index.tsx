
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Home, ShoppingCart, ListTodo, Bell, BarChart3, 
  Wallet, PieChart, ArrowRight, Sparkles, CheckCircle2, Circle, Trash2, AlertTriangle, Info,
  ArrowUpCircle, ArrowDownCircle, Edit2, X, Check, Save, Mic, Settings, LogOut, Calendar, Clock, User, Key, Lock, ExternalLink
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

export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
}

export interface ManualAlert {
  id: string;
  message: string;
  date: string; // ISO Date only
  time: string; // HH:mm
}

// --- SERVICES ---
// Gestione API Key dinamica
let ai: GoogleGenAI | null = null;

const initAI = (key: string) => {
  if (key) {
    try {
      ai = new GoogleGenAI({ apiKey: key });
    } catch (e) {
      console.error("Errore inizializzazione AI", e);
      ai = null;
    }
  } else {
    ai = null;
  }
};

const getFinancialAdvice = async (transactions: Transaction[], month: string, userKey: string) => {
  // Reinitalize if needed
  if (!ai && userKey) initAI(userKey);
  
  if (!ai) return "API Key mancante. Inseriscila nelle Impostazioni per usare l'AI.";
  if (transactions.length === 0) return "Non ci sono abbastanza dati per generare un'analisi questo mese.";

  const summary = transactions.map(t => 
    `- ${t.date.split('T')[0]}: ${t.type === 'expense' ? 'Spesa' : 'Entrata'} di €${t.amount} per ${t.description} (${t.category})`
  ).join('\n');

  const prompt = `
    Sei un assistente finanziario. Analizza le transazioni per ${month}.
    Dati: ${summary}
    Fornisci: 1. Riassunto breve. 2. Categoria più costosa. 3. Un consiglio flash.
    Max 100 parole.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Analisi non disponibile.";
  } catch (error) {
    return "Errore AI. Controlla la tua API Key.";
  }
};

// --- COMPONENTS ---

// Voice Input Component
const VoiceInput = ({ onResult }: { onResult: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Il tuo browser non supporta la dettatura vocale.");
      return;
    }
    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.start();
  };

  return (
    <button 
      type="button"
      onClick={startListening} 
      className={`p-3 rounded-xl transition-all flex items-center justify-center ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
    >
      <Mic size={20} />
    </button>
  );
};

// Generic Swipeable Item
interface SwipeableItemProps {
  children: React.ReactNode;
  onSwipeLeft: () => void; // Delete
  onSwipeRight?: () => void; // Edit or Complete
  rightLabel?: string;
  rightIcon?: React.ReactNode;
  rightColor?: string;
  leftLabel?: string; // Default Delete
}

const SwipeableItem: React.FC<SwipeableItemProps> = ({ 
  children, onSwipeLeft, onSwipeRight, 
  rightLabel = "Azione", rightIcon = <Edit2 size={24}/>, rightColor = "bg-indigo-600",
  leftLabel = "Elimina"
}) => {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const SWIPE_THRESHOLD = 70;
  const DELETE_THRESHOLD = 150;
  const MAX_SWIPE_RIGHT = 100;

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null || isDeleting) return;
    const x = e.touches[0].clientX;
    const diff = x - startX;
    
    // Allow right swipe only if handler exists
    if (diff > 0 && !onSwipeRight) return;

    if (diff > MAX_SWIPE_RIGHT) {
        setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2);
    } else {
        setCurrentX(diff);
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
    if (onSwipeRight && currentX > SWIPE_THRESHOLD) {
      onSwipeRight();
      setCurrentX(0);
    } else if (currentX < -DELETE_THRESHOLD) {
      setIsDeleting(true);
      setCurrentX(-window.innerWidth);
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => onSwipeLeft(), 300);
    } else {
      setCurrentX(0);
    }
    setStartX(null);
  };

  if (isDeleting && Math.abs(currentX) >= window.innerWidth) {
      return <div className="h-[70px] mb-2 w-full"></div>;
  }

  return (
    <div className="relative mb-2 w-full overflow-hidden rounded-xl select-none touch-pan-y" style={{ touchAction: 'pan-y' }}>
      <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors ${currentX > 0 ? rightColor : 'bg-red-600'}`}>
        {onSwipeRight && (
          <div className="flex items-center gap-2 text-white font-bold transition-opacity" style={{ opacity: currentX > 30 ? 1 : 0 }}>
            {rightIcon} <span>{rightLabel}</span>
          </div>
        )}
        <div className="flex items-center gap-2 text-white font-bold transition-opacity ml-auto" style={{ opacity: currentX < -30 ? 1 : 0 }}>
          <span>{leftLabel}</span> <Trash2 size={24} />
        </div>
      </div>
      <div 
        className="relative bg-slate-900 border border-slate-800 rounded-xl transition-transform ease-out"
        style={{ transform: `translateX(${currentX}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleEnd}
      >
        {children}
      </div>
    </div>
  );
};

// StatsCard
const StatsCard = ({ label, amount, type }: { label: string, amount: number, type: 'balance'|'income'|'expense' }) => {
  let colors = type === 'income' ? "text-emerald-400 bg-emerald-950/30 border-emerald-900/30" : 
               type === 'expense' ? "text-red-400 bg-red-950/30 border-red-900/30" : 
               "text-indigo-400 bg-slate-900 border-slate-800";
  return (
    <div className={`flex-1 p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center ${colors}`}>
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</span>
      <span className="text-lg sm:text-xl font-bold truncate max-w-full">{amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
    </div>
  );
};

// AddModal
const AddModal = ({ isOpen, onClose, onSave, initialData, expenseCategories, incomeCategories, onAddCategory }: any) => {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setType(initialData.type);
        setAmount(initialData.amount.toString());
        setDescription(initialData.description);
        setCategory(initialData.category);
      } else {
        setAmount(''); setDescription(''); setCategory(expenseCategories[0] || '');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !description) return;
    onSave(parseFloat(amount), description, category, type, initialData?.id);
    onClose();
  };

  const handleAddCat = () => {
    if (newCategoryName.trim()) {
      onAddCategory(newCategoryName.trim(), type);
      setCategory(newCategoryName.trim());
      setIsAddingCategory(false);
      setNewCategoryName('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden animate-slide-up">
        <div className="p-4 border-b border-slate-800 flex justify-between bg-slate-900">
          <h2 className="text-lg font-bold text-slate-100">{initialData ? 'Modifica' : 'Nuova'} Transazione</h2>
          <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button type="button" className={`flex-1 py-2 rounded-md text-sm font-medium ${type === 'expense' ? 'bg-slate-800 text-red-400' : 'text-slate-500'}`} onClick={() => setType('expense')}>Uscita</button>
            <button type="button" className={`flex-1 py-2 rounded-md text-sm font-medium ${type === 'income' ? 'bg-slate-800 text-emerald-400' : 'text-slate-500'}`} onClick={() => setType('income')}>Entrata</button>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase">Importo (€)</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full text-4xl font-bold text-white bg-transparent border-b border-slate-700 focus:border-indigo-500 pb-2 outline-none" required />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 uppercase">Descrizione</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="Es. Spesa" className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-white outline-none focus:border-indigo-500" required />
            </div>
            <div className="mt-5"><VoiceInput onResult={setDescription} /></div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase mb-2 block">Categoria</label>
            <div className="flex flex-wrap gap-2">
              {(type === 'expense' ? expenseCategories : incomeCategories).map(cat => (
                <button key={cat} type="button" onClick={() => setCategory(cat)} className={`px-3 py-1 rounded-full text-xs border ${category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>{cat}</button>
              ))}
              {isAddingCategory ? (
                <div className="flex gap-1"><input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-20 bg-slate-800 text-xs px-2 rounded text-white" /><button type="button" onClick={handleAddCat}><Check size={14} className="text-emerald-500"/></button></div>
              ) : (
                <button type="button" onClick={() => setIsAddingCategory(true)} className="px-3 py-1 rounded-full text-xs border border-dashed border-slate-600 text-slate-500 flex gap-1"><Plus size={12} /> Nuova</button>
              )}
            </div>
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 transition-all">{initialData ? 'Aggiorna' : 'Salva'}</button>
        </form>
      </div>
    </div>
  );
};

// Settings Modal
const SettingsModal = ({ isOpen, onClose, onClearData, userName, setUserName, apiKey, setApiKey }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden animate-slide-up max-h-[85vh] overflow-y-auto no-scrollbar">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
            <h2 className="font-bold text-white flex items-center gap-2"><Settings size={20}/> Configurazioni</h2>
            <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-8">
          
          {/* PROFILO */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><User size={14}/> Profilo</h3>
             <input 
                type="text" 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)} 
                placeholder="Il tuo nome" 
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-indigo-500 outline-none"
             />
             <button disabled className="w-full py-3 bg-slate-800 text-slate-500 rounded-xl font-medium border border-slate-700 flex items-center justify-center gap-2 cursor-not-allowed opacity-60">
                <Lock size={16}/> Registrazione / Accedi (Presto)
             </button>
          </div>

          {/* AI CONFIG */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Key size={14}/> Intelligenza Artificiale</h3>
             <div className="bg-indigo-950/20 p-3 rounded-lg border border-indigo-900/40">
                <p className="text-xs text-indigo-200 mb-2">Per usare le funzioni AI (consigli e analisi), inserisci la tua API Key di Google Gemini.</p>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] text-indigo-400 flex items-center gap-1 hover:underline mb-3"><ExternalLink size={10}/> Ottieni API Key qui</a>
                <input 
                    type="password" 
                    value={apiKey} 
                    onChange={(e) => setApiKey(e.target.value)} 
                    placeholder="Incolla API Key (AIza...)" 
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:border-indigo-500 outline-none font-mono"
                />
             </div>
          </div>

          {/* INFO */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Info size={14}/> Info App</h3>
             <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
                <p><strong>SpeseSmart v1.2</strong></p>
                <p>Gestore finanziario locale e sicuro.</p>
                <p className="mt-2">Sviluppato con ❤️ per aiutarti a risparmiare.</p>
             </div>
          </div>

          {/* DANGER ZONE */}
          <div className="pt-4 border-t border-slate-800">
            <button onClick={onClearData} className="w-full py-3 bg-red-900/20 text-red-400 border border-red-900/50 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-900/30 transition-colors">
                <LogOut size={18} /> Resetta Dati App
            </button>
            <p className="text-[10px] text-center text-slate-600 mt-2">Questa azione è irreversibile.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---

const App = () => {
  const [activeTab, setActiveTab] = useState<'home' | 'shopping' | 'doit' | 'alerts' | 'reports'>('home');
  
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => JSON.parse(localStorage.getItem('transactions') || '[]'));
  const [shoppingList, setShoppingList] = useState<ListItem[]>(() => JSON.parse(localStorage.getItem('shoppingList') || '[]'));
  const [todoList, setTodoList] = useState<ListItem[]>(() => JSON.parse(localStorage.getItem('todoList') || '[]'));
  const [manualAlerts, setManualAlerts] = useState<ManualAlert[]>(() => JSON.parse(localStorage.getItem('manualAlerts') || '[]'));
  
  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem('expenseCategories') || JSON.stringify(DEFAULT_EXPENSE_CATEGORIES)));
  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => JSON.parse(localStorage.getItem('incomeCategories') || JSON.stringify(DEFAULT_INCOME_CATEGORIES)));

  // Config State
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');
  const [userApiKey, setUserApiKey] = useState(() => localStorage.getItem('userApiKey') || '');

  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  // Inputs
  const [newShoppingItem, setNewShoppingItem] = useState('');
  const [newTodoItem, setNewTodoItem] = useState('');
  
  // Alerts Inputs
  const [newAlertMsg, setNewAlertMsg] = useState('');
  const [newAlertDate, setNewAlertDate] = useState('');
  const [newAlertTime, setNewAlertTime] = useState('');

  // AI
  const [aiAdvice, setAiAdvice] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Init AI on load if key exists
  useEffect(() => {
    if (userApiKey) initAI(userApiKey);
  }, [userApiKey]);

  // Persist
  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('shoppingList', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('todoList', JSON.stringify(todoList)); }, [todoList]);
  useEffect(() => { localStorage.setItem('manualAlerts', JSON.stringify(manualAlerts)); }, [manualAlerts]);
  useEffect(() => { localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories)); }, [expenseCategories]);
  useEffect(() => { localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories)); }, [incomeCategories]);
  useEffect(() => { localStorage.setItem('userName', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('userApiKey', userApiKey); }, [userApiKey]);

  // Derived
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const current = transactions.filter(t => new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
    const inc = current.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
    const exp = current.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp };
  }, [transactions]);

  // Handlers
  const handleSaveTrans = (amount: number, description: string, category: string, type: TransactionType, id?: string) => {
    if (id) {
      setTransactions(p => p.map(t => t.id === id ? { ...t, amount, description, category, type } : t));
    } else {
      setTransactions(p => [{ id: crypto.randomUUID(), amount, description, category, type, date: new Date().toISOString() }, ...p]);
    }
  };

  const handleClearData = () => {
    if (confirm("Sei sicuro di voler cancellare TUTTI i dati?")) {
        let keepKey = false;
        if (userApiKey) {
            keepKey = confirm("Vuoi mantenere salvata la tua API Key?");
        }
        
        const keyBackup = userApiKey;
        const nameBackup = userName;

        localStorage.clear();
        
        if (keepKey) {
            localStorage.setItem('userApiKey', keyBackup);
            localStorage.setItem('userName', nameBackup); // Keep name too mostly
        }
        
        window.location.reload();
    }
  };

  const handleAddList = (type: 'shopping'|'todo', text: string) => {
    if (!text.trim()) return;
    const item = { id: crypto.randomUUID(), text: text.trim(), completed: false };
    if (type === 'shopping') { setShoppingList([item, ...shoppingList]); setNewShoppingItem(''); }
    else { setTodoList([item, ...todoList]); setNewTodoItem(''); }
  };

  const toggleList = (type: 'shopping'|'todo', id: string) => {
    if (type === 'shopping') setShoppingList(p => p.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
    else setTodoList(p => p.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  };

  const deleteList = (type: 'shopping'|'todo', id: string) => {
    if (type === 'shopping') setShoppingList(p => p.filter(i => i.id !== id));
    else setTodoList(p => p.filter(i => i.id !== id));
  };

  const handleAddAlert = () => {
    if(!newAlertMsg.trim() || !newAlertDate || !newAlertTime) {
        alert("Inserisci messaggio, data e ora.");
        return;
    }
    setManualAlerts([{ 
        id: crypto.randomUUID(), 
        message: newAlertMsg, 
        date: newAlertDate, 
        time: newAlertTime 
    }, ...manualAlerts]);
    setNewAlertMsg('');
    setNewAlertDate('');
    setNewAlertTime('');
  };

  // Renderers
  const renderContent = () => {
    switch (activeTab) {
      case 'home': return (
        <>
          <section className="bg-indigo-950/30 p-4 rounded-xl border border-indigo-500/20 relative mb-6">
             <div className="flex justify-between items-center mb-2">
               <div className="flex items-center gap-2 text-indigo-200 font-bold"><Sparkles size={16}/><span>AI Advisor</span></div>
               <button onClick={async () => { setIsLoadingAi(true); setAiAdvice(await getFinancialAdvice(transactions, 'Mese Corrente', userApiKey)); setIsLoadingAi(false); }} disabled={isLoadingAi} className="text-[10px] bg-indigo-600 px-2 py-1 rounded text-white">{isLoadingAi ? '...' : 'Analizza'}</button>
             </div>
             <p className="text-xs text-indigo-100/80 leading-relaxed whitespace-pre-line">{aiAdvice || "Tocca Analizza per consigli (Richiede API Key)."}</p>
          </section>
          <div className="space-y-2">
            <h3 className="font-bold text-white mb-2">Recenti</h3>
            {transactions.slice(0, 10).map(t => (
              <SwipeableItem key={t.id} onSwipeLeft={() => setTransactions(p => p.filter(x => x.id !== t.id))} onSwipeRight={() => { setEditingTransaction(t); setIsAddModalOpen(true); }}>
                <div className="flex items-center justify-between p-4 h-[70px]">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${t.type === 'expense' ? 'bg-red-950/40 text-red-400' : 'bg-emerald-950/40 text-emerald-400'}`}>{t.type === 'expense' ? <ArrowDownCircle size={20}/> : <ArrowUpCircle size={20}/>}</div>
                    <div><p className="font-medium text-slate-200 text-sm">{t.description}</p><p className="text-[10px] text-slate-500 capitalize">{t.category}</p></div>
                  </div>
                  <span className={`font-bold ${t.type === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>{t.type === 'expense' ? '-' : '+'}€{t.amount.toFixed(2)}</span>
                </div>
              </SwipeableItem>
            ))}
            {transactions.length === 0 && <p className="text-center text-slate-600 text-sm py-4">Nessuna transazione</p>}
          </div>
        </>
      );
      case 'shopping': return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ShoppingCart size={20} className="text-emerald-400"/> Lista Spesa</h3>
          <div className="flex gap-2 mb-4">
            <input value={newShoppingItem} onChange={e => setNewShoppingItem(e.target.value)} placeholder="Prodotto..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none" onKeyDown={e => e.key === 'Enter' && handleAddList('shopping', newShoppingItem)}/>
            <VoiceInput onResult={setNewShoppingItem} />
            <button onClick={() => handleAddList('shopping', newShoppingItem)} className="bg-indigo-600 text-white p-2 rounded-lg"><Plus/></button>
          </div>
          {shoppingList.map(i => (
             <SwipeableItem key={i.id} onSwipeLeft={() => deleteList('shopping', i.id)} onSwipeRight={() => toggleList('shopping', i.id)} rightLabel={i.completed ? "Apri" : "Fatto"} rightIcon={<CheckCircle2/>} rightColor="bg-emerald-600">
                <div className="flex items-center gap-3 p-4 h-[60px]">
                   {i.completed ? <CheckCircle2 className="text-emerald-500" size={20}/> : <Circle className="text-slate-500" size={20}/>}
                   <span className={i.completed ? 'line-through text-slate-500' : 'text-white'}>{i.text}</span>
                </div>
             </SwipeableItem>
          ))}
        </div>
      );
      case 'doit': return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ListTodo size={20} className="text-indigo-400"/> Cose da fare</h3>
          <div className="flex gap-2 mb-4">
            <input value={newTodoItem} onChange={e => setNewTodoItem(e.target.value)} placeholder="Attività..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none" onKeyDown={e => e.key === 'Enter' && handleAddList('todo', newTodoItem)}/>
            <VoiceInput onResult={setNewTodoItem} />
            <button onClick={() => handleAddList('todo', newTodoItem)} className="bg-indigo-600 text-white p-2 rounded-lg"><Plus/></button>
          </div>
          {todoList.map(i => (
             <SwipeableItem key={i.id} onSwipeLeft={() => deleteList('todo', i.id)} onSwipeRight={() => toggleList('todo', i.id)} rightLabel={i.completed ? "Apri" : "Fatto"} rightIcon={<CheckCircle2/>} rightColor="bg-indigo-600">
                <div className="flex items-center gap-3 p-4 h-[60px]">
                   {i.completed ? <CheckCircle2 className="text-indigo-500" size={20}/> : <Circle className="text-slate-500" size={20}/>}
                   <span className={i.completed ? 'line-through text-slate-500' : 'text-white'}>{i.text}</span>
                </div>
             </SwipeableItem>
          ))}
        </div>
      );
      case 'alerts': return (
        <div className="space-y-6">
           <div>
             <h3 className="font-bold text-white mb-2 flex gap-2"><Bell className="text-yellow-400"/> Avvisi Sistema</h3>
             {monthlyStats.balance < 0 && <div className="p-3 bg-red-900/20 text-red-200 border border-red-900/50 rounded-lg text-sm mb-2">Saldo negativo!</div>}
             {shoppingList.length > 5 && <div className="p-3 bg-blue-900/20 text-blue-200 border border-blue-900/50 rounded-lg text-sm mb-2">Lista spesa lunga ({shoppingList.length})</div>}
             {monthlyStats.balance >= 0 && shoppingList.length <= 5 && <p className="text-slate-500 text-sm">Nessun avviso critico.</p>}
           </div>
           
           <div>
             <h3 className="font-bold text-white mb-3 flex gap-2"><Edit2 className="text-indigo-400"/> I miei Promemoria</h3>
             <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4 space-y-3">
                 <div className="flex gap-2">
                    <input value={newAlertMsg} onChange={e => setNewAlertMsg(e.target.value)} placeholder="Messaggio avviso..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none placeholder-slate-600 text-sm"/>
                    <VoiceInput onResult={setNewAlertMsg} />
                 </div>
                 <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input type="date" value={newAlertDate} onChange={e => setNewAlertDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none text-xs h-10 accent-indigo-600"/>
                    </div>
                    <div className="relative w-24">
                        <input type="time" value={newAlertTime} onChange={e => setNewAlertTime(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none text-xs h-10 accent-indigo-600"/>
                    </div>
                    <button onClick={handleAddAlert} className="bg-indigo-600 text-white w-10 h-10 rounded-lg flex items-center justify-center hover:bg-indigo-500"><Plus size={20}/></button>
                 </div>
             </div>

             {manualAlerts.map(a => (
               <SwipeableItem key={a.id} onSwipeLeft={() => setManualAlerts(p => p.filter(x => x.id !== a.id))}>
                 <div className="p-4 flex items-center justify-between h-[60px]">
                     <div className="flex flex-col">
                        <span className="text-white text-sm font-medium">{a.message}</span>
                        <div className="flex gap-2 text-[10px] text-slate-500">
                           <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(a.date).toLocaleDateString()}</span>
                           <span className="flex items-center gap-1"><Clock size={10}/> {a.time}</span>
                        </div>
                     </div>
                 </div>
               </SwipeableItem>
             ))}
           </div>
        </div>
      );
      case 'reports': return (
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h3 className="font-bold text-white mb-4">Report Mensile</h3>
          <div className="space-y-3">
             <div className="flex justify-between"><span className="text-slate-400">Entrate</span><span className="text-emerald-400 font-bold">€{monthlyStats.totalIncome}</span></div>
             <div className="flex justify-between"><span className="text-slate-400">Uscite</span><span className="text-red-400 font-bold">€{monthlyStats.totalExpense}</span></div>
             <div className="h-px bg-slate-800"></div>
             <div className="flex justify-between"><span className="text-white">Saldo</span><span className={monthlyStats.balance >= 0 ? "text-indigo-400 font-bold" : "text-red-400 font-bold"}>€{monthlyStats.balance}</span></div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 pb-32 font-sans">
      <div className="max-w-lg mx-auto bg-slate-950 min-h-screen relative shadow-2xl">
        <header className="px-6 pt-12 pb-6 bg-gradient-to-b from-indigo-950/20 to-slate-950">
          <div className="flex justify-between items-start mb-6">
            <div>
                <h1 className="text-2xl font-black text-white">Wallet</h1>
                {userName && <p className="text-xs text-indigo-400 font-medium">Ciao, {userName}</p>}
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className="bg-slate-900 p-2 rounded-full border border-slate-800 text-slate-400 hover:text-white"><Settings size={20}/></button>
          </div>
          <div className="flex gap-2 mb-2"><StatsCard label="Entrate" amount={monthlyStats.totalIncome} type="income"/><StatsCard label="Uscite" amount={monthlyStats.totalExpense} type="expense"/></div>
          <StatsCard label="Saldo" amount={monthlyStats.balance} type="balance"/>
        </header>

        <main className="px-4 space-y-6">{renderContent()}</main>

        {/* FAB */}
        <div className="fixed bottom-24 right-4 z-50">
          <button onClick={() => { setEditingTransaction(null); setIsAddModalOpen(true); }} className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 hover:scale-105 transition-all"><Plus size={28}/></button>
        </div>

        {/* Navbar with safe area padding */}
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0E1629]/95 backdrop-blur-xl border-t border-slate-800 pb-[env(safe-area-inset-bottom)] z-40 max-w-lg mx-auto">
          <div className="flex justify-around items-center h-16">
              {[
                {id:'home', icon:Home, l:'Home'}, {id:'shopping', icon:ShoppingCart, l:'Spesa'}, 
                {id:'doit', icon:ListTodo, l:'Do It'}, {id:'alerts', icon:Bell, l:'Avvisi'}, {id:'reports', icon:BarChart3, l:'Report'}
              ].map(i => (
                <button key={i.id} onClick={() => setActiveTab(i.id as any)} className={`flex flex-col items-center justify-center w-14 ${activeTab === i.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                  <i.icon size={22} className={activeTab === i.id ? 'fill-indigo-400/20' : ''}/><span className="text-[9px] font-bold mt-1">{i.l}</span>
                </button>
              ))}
          </div>
        </nav>

        <AddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveTrans} initialData={editingTransaction} expenseCategories={expenseCategories} incomeCategories={incomeCategories} onAddCategory={(c: string, t: any) => t === 'expense' ? setExpenseCategories([...expenseCategories, c]) : setIncomeCategories([...incomeCategories, c])} />
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            onClearData={handleClearData} 
            userName={userName}
            setUserName={setUserName}
            apiKey={userApiKey}
            setApiKey={setUserApiKey}
        />
      </div>
    </div>
  );
};

let rootElement = document.getElementById('root');
if (!rootElement) { rootElement = document.createElement('div'); rootElement.id = 'root'; document.body.appendChild(rootElement); }
const root = createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);
