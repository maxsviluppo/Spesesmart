import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Home, ShoppingCart, ListTodo, Bell, BarChart3, 
  Wallet, PieChart as PieChartIcon, ArrowRight, Sparkles, CheckCircle2, Circle, Trash2, AlertTriangle, Info,
  ArrowUpCircle, ArrowDownCircle, Edit2, X, Check, Save, Mic, Settings, LogOut, Calendar, Clock, User, Key, Lock, ExternalLink, ChevronDown, ChevronUp, Mail,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, MapPin, Droplets, ThermometerSun, Smartphone, Layout, Volume2, Eye, EyeOff, History,
  Flag
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

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

export type AlertPriority = 'high' | 'medium' | 'low';

export interface ManualAlert {
  id: string;
  message: string;
  date: string; // ISO Date only
  time: string; // HH:mm
  priority: AlertPriority;
  completed?: boolean;
}

export interface WeatherData {
  current: {
    temperature_2m: number;
    weather_code: number;
    relative_humidity_2m: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

// Constants
const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

// --- SERVICES ---
// Initialization of GenAI client with environment variable as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getFinancialAdvice = async (transactions: Transaction[], month: string) => {
  if (transactions.length === 0) return "Non ci sono abbastanza dati per generare un'analisi completa.";

  const summary = transactions.map(t => 
    `- ${t.date.split('T')[0]}: ${t.type === 'expense' ? 'Spesa' : 'Entrata'} di €${t.amount} per ${t.description} (${t.category})`
  ).join('\n');

  const prompt = `
    Sei un assistente finanziario personale. Analizza le transazioni dell'utente.
    Dati: ${summary}
    Fornisci: 
    1. Un breve riassunto della situazione finanziaria generale.
    2. Identifica tendenze o categorie critiche.
    3. Un consiglio pratico per migliorare il bilancio.
    Sii conciso (max 120 parole), motivante e diretto.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "Analisi non disponibile.";
  } catch (error) {
    console.error(error);
    return "Errore AI. Riprova più tardi.";
  }
};

// --- COMPONENTS ---

// Weather Widget Component
const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) {
      setError('GPS non supportato');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Open-Meteo API (Free, no key required)
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
          );
          if (!response.ok) throw new Error('Errore rete');
          const data = await response.json();
          setWeather(data);
        } catch (err) {
          console.error(err);
          setError('Meteo non disponibile');
        } finally {
          setLoading(false);
        }
      }, 
      (err) => {
        console.error(err);
        setError('Posizione negata');
        setLoading(false);
      }
    );
  }, []);

  // Helper per icona meteo e descrizione
  const getWeatherIcon = (code: number) => {
    // WMO Weather interpretation codes
    if (code === 0) return { icon: <Sun className="text-yellow-400" size={32} />, label: 'Sereno' };
    if (code >= 1 && code <= 3) return { icon: <Cloud className="text-slate-400" size={32} />, label: 'Nuvoloso' };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: <CloudRain className="text-blue-400" size={32} />, label: 'Pioggia' };
    if (code >= 71 && code <= 77) return { icon: <CloudSnow className="text-white" size={32} />, label: 'Neve' };
    if (code >= 95) return { icon: <CloudLightning className="text-purple-400" size={32} />, label: 'Temporale' };
    return { icon: <Cloud className="text-slate-400" size={32} />, label: 'Variabile' };
  };

  if (loading) return <div className="animate-pulse bg-slate-900/50 h-24 rounded-xl border border-slate-800 mb-6 flex items-center justify-center text-xs text-slate-500">Caricamento meteo...</div>;
  if (error) return null; // Nascondi silenziosamente se errore o permesso negato per non rovinare UI
  if (!weather) return null;

  const current = weather.current;
  const todayMax = weather.daily.temperature_2m_max[0];
  const todayMin = weather.daily.temperature_2m_min[0];
  const { icon, label } = getWeatherIcon(current.weather_code);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 mb-6 flex items-center justify-between relative overflow-hidden">
        {/* Background Accent */}
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl"></div>

        <div className="flex items-center gap-4 z-10">
            <div className="flex flex-col items-center">
                {icon}
                <span className="text-[10px] text-slate-400 font-medium mt-1">{label}</span>
            </div>
            <div>
                <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{Math.round(current.temperature_2m)}°</span>
                    <span className="text-xs text-slate-400">Posizione attuale</span>
                </div>
                <div className="flex gap-3 mt-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><ArrowUpCircle size={12} className="text-red-400"/> {Math.round(todayMax)}°</span>
                    <span className="flex items-center gap-1"><ArrowDownCircle size={12} className="text-emerald-400"/> {Math.round(todayMin)}°</span>
                    <span className="flex items-center gap-1"><Droplets size={12} className="text-blue-400"/> {current.relative_humidity_2m}%</span>
                </div>
            </div>
        </div>
        <div className="z-10 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50 backdrop-blur-sm">
             <MapPin size={20} className="text-indigo-400"/>
        </div>
    </div>
  );
};

// Voice Input Component
const VoiceInput = ({ onResult }: { onResult: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Il tuo browser non supporta la dettatura vocale.");
      return;
    }

    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onend = () => {
        setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      if (event.results && event.results[0] && event.results[0][0]) {
        const transcript = event.results[0][0].transcript;
        onResult(transcript);
      }
      recognition.stop();
      setIsListening(false);
    };

    // Stop automatically when user stops speaking to release system
    recognition.onspeechend = () => {
       recognition.stop();
    };

    recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
    };

    recognition.start();
  };

  return (
    <button 
      type="button"
      onClick={startListening} 
      className={`p-3 rounded-xl transition-all flex items-center justify-center shrink-0 ${isListening ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-900/50' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}`}
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
  onDoubleClick?: () => void;
}

const SwipeableItem: React.FC<SwipeableItemProps> = ({ 
  children, onSwipeLeft, onSwipeRight, 
  rightLabel = "Azione", rightIcon = <Edit2 size={24}/>, rightColor = "bg-indigo-600",
  leftLabel = "Elimina", onDoubleClick
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
    <div 
        className="relative mb-2 w-full overflow-hidden rounded-xl select-none touch-pan-y" 
        style={{ touchAction: 'pan-y' }}
        onDoubleClick={onDoubleClick}
    >
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
const StatsCard = ({ label, amount, type, onClick, isHidden }: { label: string, amount: number, type: 'balance'|'income'|'expense', onClick?: () => void, isHidden?: boolean }) => {
  let colors = type === 'income' ? "text-emerald-400 bg-emerald-950/30 border-emerald-900/30" : 
               type === 'expense' ? "text-red-400 bg-red-950/30 border-red-900/30" : 
               "text-indigo-400 bg-slate-900 border-slate-800";
  return (
    <div onClick={onClick} className={`flex-1 p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center ${colors} relative ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}>
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1">
          {label} 
          {type === 'balance' && (isHidden ? <EyeOff size={10} className="text-slate-500"/> : <Eye size={10} className="text-slate-500"/>)}
      </span>
      <span className="text-lg sm:text-xl font-bold truncate max-w-full">
          {isHidden ? '••••••' : (Number(amount) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
      </span>
    </div>
  );
};

// History Modal
const HistoryModal = ({ isOpen, onClose, transactions, type }: { isOpen: boolean, onClose: () => void, transactions: Transaction[], type: 'income'|'expense' }) => {
    if (!isOpen) return null;

    const filtered = transactions.filter(t => t.type === type).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    // Group by Month Year
    const grouped = filtered.reduce((acc, t) => {
        const d = new Date(t.date);
        const key = d.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
    }, {} as Record<string, Transaction[]>);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden animate-slide-up h-[80vh] flex flex-col">
                <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <h2 className={`text-lg font-bold flex items-center gap-2 ${type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                        <History size={20}/> Storico {type === 'income' ? 'Entrate' : 'Uscite'}
                    </h2>
                    <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {Object.entries(grouped).map(([period, items]) => (
                        <div key={period}>
                            <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 sticky top-0 bg-slate-900 py-2 border-b border-slate-800">{period}</h3>
                            <div className="space-y-2">
                                {items.map(t => (
                                    <div key={t.id} className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                                        <div>
                                            <p className="font-medium text-slate-200 text-sm">{t.description}</p>
                                            <p className="text-[10px] text-slate-500">{new Date(t.date).toLocaleDateString()} • {t.category}</p>
                                        </div>
                                        <span className={`font-bold ${type === 'income' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            €{t.amount.toFixed(2)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {filtered.length === 0 && <p className="text-center text-slate-500 py-10">Nessuna transazione trovata.</p>}
                </div>
            </div>
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
              {(type === 'expense' ? expenseCategories : incomeCategories).map((cat: string) => (
                <button key={String(cat)} type="button" onClick={() => setCategory(cat)} className={`px-3 py-1 rounded-full text-xs border ${category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 text-slate-400 border-slate-700'}`}>{String(cat)}</button>
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
const SettingsModal = ({ isOpen, onClose, onClearData, userName, setUserName, notificationsEnabled, setNotificationsEnabled, startUpTab, setStartUpTab, onSaveSettings, alarmVolume, setAlarmVolume, onTestSound }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden animate-slide-up max-h-[85vh] overflow-y-auto no-scrollbar">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
            <h2 className="font-bold text-white flex items-center gap-2"><Settings size={20}/> Configurazioni</h2>
            <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-8">
          
          {/* GENERALI */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Layout size={14}/> Generali</h3>
             
             {/* Startup Page */}
             <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
               <span className="text-sm text-slate-300">Pagina di Avvio</span>
               <select 
                 value={startUpTab} 
                 onChange={(e) => setStartUpTab(e.target.value)}
                 className="bg-slate-800 text-white text-xs p-2 rounded border border-slate-700 outline-none"
               >
                 <option value="home">Wallet</option>
                 <option value="shopping">Spesa</option>
                 <option value="doit">Do It</option>
                 <option value="alerts">Avvisi</option>
                 <option value="reports">Grafico</option>
               </select>
             </div>

             {/* Notifications */}
             <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
               <div className="flex items-center justify-between">
                 <span className="text-sm text-slate-300 flex items-center gap-2"><Smartphone size={16}/> Notifiche Push</span>
                 <button 
                    onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                    className={`w-10 h-6 rounded-full relative transition-colors ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
                 >
                   <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${notificationsEnabled ? 'left-5' : 'left-1'}`}></div>
                 </button>
               </div>
               
               {/* Volume Control */}
               {notificationsEnabled && (
                   <div className="mt-4 pt-3 border-t border-slate-800 space-y-2 animate-fade-in">
                       <div className="flex justify-between items-center">
                           <span className="text-xs text-slate-400 flex items-center gap-2"><Volume2 size={12}/> Volume Suoni</span>
                           <span className="text-xs font-bold text-indigo-400">{Math.round(alarmVolume * 100)}%</span>
                       </div>
                       <input 
                           type="range" 
                           min="0" 
                           max="1" 
                           step="0.05" 
                           value={alarmVolume} 
                           onChange={(e) => setAlarmVolume(parseFloat(e.target.value))}
                           className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                       />
                       <button 
                           onClick={onTestSound}
                           className="text-[10px] text-slate-500 hover:text-indigo-400 flex items-center gap-1 mt-1 transition-colors"
                       >
                           <Volume2 size={10}/> Prova suono
                       </button>
                   </div>
               )}
             </div>
          </div>

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

          {/* INFO */}
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Info size={14}/> Info App</h3>
             <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-slate-400 leading-relaxed">
                <p className="font-bold text-slate-200 mb-2">DevTools by Castro Massimo</p>
                <p className="mb-4">Questa App è realizzata da DevTools by Castro Massimo.<br/>Se hai bisogno di supporto, segnalazioni o di WebApp personalizzate contattaci.</p>
                
                <a 
                  href="mailto:castromassimo@gmail.com" 
                  className="flex items-center justify-center gap-2 w-full py-3 bg-slate-800 hover:bg-emerald-900/20 text-emerald-500 border border-slate-700 hover:border-emerald-500/50 rounded-xl transition-all font-bold"
                >
                    <Mail size={18} /> Scrivimi via Email
                </a>
             </div>
          </div>

          {/* SAVE BUTTON */}
          <button 
             onClick={onSaveSettings}
             className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 transition-all flex items-center justify-center gap-2"
          >
             <Save size={20} /> Salva Impostazioni
          </button>

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
  // Load Preferences
  const [startUpTab, setStartUpTab] = useState(() => localStorage.getItem('startUpTab') || 'home');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notificationsEnabled') === 'true');
  const [alarmVolume, setAlarmVolume] = useState(() => parseFloat(localStorage.getItem('alarmVolume') || '0.5'));
  const [activeTab, setActiveTab] = useState<'home' | 'shopping' | 'doit' | 'alerts' | 'reports'>(startUpTab as any);
  
  // Balance Visibility
  const [isBalanceHidden, setIsBalanceHidden] = useState(() => localStorage.getItem('isBalanceHidden') === 'true');

  // History Modals
  const [historyType, setHistoryType] = useState<'income'|'expense'|null>(null);
  
  // State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
       const d = JSON.parse(localStorage.getItem('transactions') || '[]');
       return Array.isArray(d) ? d : [];
    } catch { return []; }
  });

  const [shoppingList, setShoppingList] = useState<ListItem[]>(() => {
    try {
        const d = JSON.parse(localStorage.getItem('shoppingList') || '[]');
        return Array.isArray(d) ? d : [];
    } catch { return []; }
  });

  const [todoList, setTodoList] = useState<ListItem[]>(() => {
    try {
        const d = JSON.parse(localStorage.getItem('todoList') || '[]');
        return Array.isArray(d) ? d : [];
    } catch { return []; }
  });

  const [manualAlerts, setManualAlerts] = useState<ManualAlert[]>(() => {
    try {
        const d = JSON.parse(localStorage.getItem('manualAlerts') || '[]');
        return Array.isArray(d) ? d : [];
    } catch { return []; }
  });
  
  // Safe load of categories
  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => {
    try {
        const d = JSON.parse(localStorage.getItem('expenseCategories') || JSON.stringify(DEFAULT_EXPENSE_CATEGORIES));
        return (Array.isArray(d) && d.every(i => typeof i === 'string')) ? d : DEFAULT_EXPENSE_CATEGORIES;
    } catch { return DEFAULT_EXPENSE_CATEGORIES; }
  });

  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => {
    try {
        const d = JSON.parse(localStorage.getItem('incomeCategories') || JSON.stringify(DEFAULT_INCOME_CATEGORIES));
        return (Array.isArray(d) && d.every(i => typeof i === 'string')) ? d : DEFAULT_INCOME_CATEGORIES;
    } catch { return DEFAULT_INCOME_CATEGORIES; }
  });

  // Config State
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');

  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingListItemId, setEditingListItemId] = useState<string | null>(null); // For editing list items
  const [isAddingAlert, setIsAddingAlert] = useState(false);
  
  // Inputs
  const [newShoppingItem, setNewShoppingItem] = useState('');
  const [newTodoItem, setNewTodoItem] = useState('');
  
  // Alerts Inputs
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [newAlertMsg, setNewAlertMsg] = useState('');
  const [newAlertDate, setNewAlertDate] = useState('');
  const [newAlertTime, setNewAlertTime] = useState('');
  const [newAlertPriority, setNewAlertPriority] = useState<AlertPriority>('medium');

  // AI
  const [aiAdvice, setAiAdvice] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Persist
  useEffect(() => { localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('shoppingList', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('todoList', JSON.stringify(todoList)); }, [todoList]);
  useEffect(() => { localStorage.setItem('manualAlerts', JSON.stringify(manualAlerts)); }, [manualAlerts]);
  useEffect(() => { localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories)); }, [expenseCategories]);
  useEffect(() => { localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories)); }, [incomeCategories]);
  useEffect(() => { localStorage.setItem('userName', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('alarmVolume', alarmVolume.toString()); }, [alarmVolume]);
  useEffect(() => { localStorage.setItem('isBalanceHidden', String(isBalanceHidden)); }, [isBalanceHidden]);

  const handleSaveSettings = () => {
    localStorage.setItem('startUpTab', startUpTab);
    localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
    setIsSettingsOpen(false);
  };

  const playAlarmSound = (vol: number = alarmVolume) => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);
        
        const now = ctx.currentTime;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.linearRampToValueAtTime(440, now + 0.3);

        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc.start();
        osc.stop(now + 0.5);
    } catch (e) {
        console.error("Audio play error", e);
    }
  };

  // Derived
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const current = transactions.filter(t => new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
    const inc = current.filter(t => t.type === 'income').reduce((acc: number, t) => acc + (Number(t.amount)||0), 0);
    const exp = current.filter(t => t.type === 'expense').reduce((acc: number, t) => acc + (Number(t.amount)||0), 0);
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp };
  }, [transactions]);

  // Chart Data
  const expenseChartData = useMemo(() => {
    const now = new Date();
    const currentExpenses = transactions.filter(t => 
      t.type === 'expense' &&
      new Date(t.date).getMonth() === now.getMonth() &&
      new Date(t.date).getFullYear() === now.getFullYear()
    );

    const grouped = currentExpenses.reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + t.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .map(([name, value], index) => ({
        name,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length]
      }))
      .sort((a, b) => b.value - a.value); // Biggest first
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
        localStorage.clear();
        window.location.reload();
    }
  };

  const handleAddList = (type: 'shopping'|'todo', text: string) => {
    if (!text.trim()) return;
    
    // Check if updating existing
    if (editingListItemId) {
        if (type === 'shopping') {
            setShoppingList(p => p.map(i => i.id === editingListItemId ? { ...i, text: text.trim() } : i));
            setNewShoppingItem('');
        } else {
            setTodoList(p => p.map(i => i.id === editingListItemId ? { ...i, text: text.trim() } : i));
            setNewTodoItem('');
        }
        setEditingListItemId(null);
    } else {
        // Creating new
        const item = { id: crypto.randomUUID(), text: text.trim(), completed: false };
        if (type === 'shopping') { setShoppingList([item, ...shoppingList]); setNewShoppingItem(''); }
        else { setTodoList([item, ...todoList]); setNewTodoItem(''); }
    }
  };

  const startEditingList = (type: 'shopping'|'todo', item: ListItem) => {
    setEditingListItemId(item.id);
    if (type === 'shopping') setNewShoppingItem(item.text);
    else setNewTodoItem(item.text);
  };

  const toggleList = (type: 'shopping'|'todo', id: string) => {
    if (type === 'shopping') setShoppingList(p => p.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
    else setTodoList(p => p.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  };

  const deleteList = (type: 'shopping'|'todo', id: string) => {
    if (type === 'shopping') setShoppingList(p => p.filter(i => i.id !== id));
    else setTodoList(p => p.filter(i => i.id !== id));
    if (editingListItemId === id) {
        setEditingListItemId(null);
        if (type === 'shopping') setNewShoppingItem('');
        else setNewTodoItem('');
    }
  };

  const handleSaveAlert = () => {
    if(!newAlertMsg.trim() || !newAlertDate || !newAlertTime) {
        alert("Inserisci messaggio, data e ora.");
        return;
    }
    
    if (editingAlertId) {
       setManualAlerts(p => p.map(a => a.id === editingAlertId ? { ...a, message: newAlertMsg, date: newAlertDate, time: newAlertTime, priority: newAlertPriority } : a));
       setEditingAlertId(null);
    } else {
       setManualAlerts([{ 
          id: crypto.randomUUID(), 
          message: newAlertMsg, 
          date: newAlertDate, 
          time: newAlertTime,
          priority: newAlertPriority,
          completed: false
       }, ...manualAlerts]);
    }

    setNewAlertMsg('');
    setNewAlertDate('');
    setNewAlertTime('');
    setNewAlertPriority('medium');
    setIsAddingAlert(false);
  };

  const startEditingAlert = (alert: ManualAlert) => {
     setEditingAlertId(alert.id);
     setNewAlertMsg(alert.message);
     setNewAlertDate(alert.date);
     setNewAlertTime(alert.time);
     setNewAlertPriority(alert.priority);
     setIsAddingAlert(true);
  };
  
  const deleteAlert = (id: string) => {
    setManualAlerts(p => p.filter(a => a.id !== id));
  }

  const toggleAlertComplete = (id: string) => {
     setManualAlerts(p => p.map(a => a.id === id ? { ...a, completed: !a.completed } : a));
  };

  // Renderers
  const renderContent = () => {
    switch (activeTab) {
      case 'home': return (
        <>
          <WeatherWidget />
          <div className="space-y-2">
            <h3 className="font-bold text-white mb-2">Recenti</h3>
            {transactions.slice(0, 10).map(t => (
              <SwipeableItem key={t.id} onSwipeLeft={() => setTransactions(p => p.filter(x => x.id !== t.id))} onSwipeRight={() => { setEditingTransaction(t); setIsAddModalOpen(true); }} rightLabel="Modifica" rightIcon={<Edit2 size={24}/>}>
                <div className="flex items-center justify-between p-4 h-[70px]">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${t.type === 'expense' ? 'bg-red-950/40 text-red-400' : 'bg-emerald-950/40 text-emerald-400'}`}>{t.type === 'expense' ? <ArrowDownCircle size={20}/> : <ArrowUpCircle size={20}/>}</div>
                    <div><p className="font-medium text-slate-200 text-sm">{String(t.description)}</p><p className="text-[10px] text-slate-500 capitalize">{String(t.category)}</p></div>
                  </div>
                  <span className={`font-bold ${t.type === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>{t.type === 'expense' ? '-' : '+'}€{(Number(t.amount)||0).toFixed(2)}</span>
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
            <input value={newShoppingItem} onChange={e => setNewShoppingItem(e.target.value)} placeholder={editingListItemId ? "Modifica..." : "Prodotto..."} className={`flex-1 bg-slate-950 border ${editingListItemId ? 'border-indigo-500' : 'border-slate-700'} rounded-lg px-3 py-2 text-white outline-none`} onKeyDown={e => e.key === 'Enter' && handleAddList('shopping', newShoppingItem)}/>
            <VoiceInput onResult={setNewShoppingItem} />
            <button onClick={() => handleAddList('shopping', newShoppingItem)} className={`text-white p-2 rounded-lg ${editingListItemId ? 'bg-emerald-600' : 'bg-indigo-600'}`}>{editingListItemId ? <Check size={20}/> : <Plus size={20}/>}</button>
          </div>
          {shoppingList.map(i => (
             <SwipeableItem 
                key={i.id} 
                onSwipeLeft={() => deleteList('shopping', i.id)} 
                onSwipeRight={() => startEditingList('shopping', i)} 
                rightLabel="Modifica" 
                rightIcon={<Edit2 size={24}/>} 
                rightColor="bg-indigo-600"
             >
                <div className="flex items-center gap-3 p-4 h-[60px]">
                   <button onClick={(e) => { e.stopPropagation(); toggleList('shopping', i.id); }} className="focus:outline-none">
                     {i.completed ? <CheckCircle2 className="text-emerald-500" size={24}/> : <Circle className="text-slate-500" size={24}/>}
                   </button>
                   <span className={i.completed ? 'line-through text-slate-500' : 'text-white'}>{String(i.text)}</span>
                </div>
             </SwipeableItem>
          ))}
        </div>
      );
      case 'doit': return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ListTodo size={20} className="text-indigo-400"/> Cose da fare</h3>
          <div className="flex gap-2 mb-4">
            <input value={newTodoItem} onChange={e => setNewTodoItem(e.target.value)} placeholder={editingListItemId ? "Modifica..." : "Attività..."} className={`flex-1 bg-slate-950 border ${editingListItemId ? 'border-indigo-500' : 'border-slate-700'} rounded-lg px-3 py-2 text-white outline-none`} onKeyDown={e => e.key === 'Enter' && handleAddList('todo', newTodoItem)}/>
            <VoiceInput onResult={setNewTodoItem} />
            <button onClick={() => handleAddList('todo', newTodoItem)} className={`text-white p-2 rounded-lg ${editingListItemId ? 'bg-emerald-600' : 'bg-indigo-600'}`}>{editingListItemId ? <Check size={20}/> : <Plus size={20}/>}</button>
          </div>
          {todoList.map(i => (
             <SwipeableItem 
                key={i.id} 
                onSwipeLeft={() => deleteList('todo', i.id)} 
                onSwipeRight={() => startEditingList('todo', i)} 
                rightLabel="Modifica" 
                rightIcon={<Edit2 size={24}/>} 
                rightColor="bg-indigo-600"
             >
                <div className="flex items-center gap-3 p-4 h-[60px]">
                   <button onClick={(e) => { e.stopPropagation(); toggleList('todo', i.id); }} className="focus:outline-none">
                      {i.completed ? <CheckCircle2 className="text-indigo-500" size={24}/> : <Circle className="text-slate-500" size={24}/>}
                   </button>
                   <span className={i.completed ? 'line-through text-slate-500' : 'text-white'}>{String(i.text)}</span>
                </div>
             </SwipeableItem>
          ))}
        </div>
      );
      case 'alerts': {
        const sortedAlerts = [...manualAlerts].sort((a, b) => {
            const timeA = new Date(`${a.date}T${a.time}`).getTime();
            const timeB = new Date(`${b.date}T${b.time}`).getTime();
            return (isNaN(timeA) ? 0 : timeA) - (isNaN(timeB) ? 0 : timeB);
        });
        
        return (
        <div className="space-y-4">
           {/* SYSTEM ALERTS - HIGH PRIORITY */}
           {monthlyStats.balance < 0 && (
             <div className="bg-slate-900/80 p-4 rounded-xl border-l-4 border-red-500 shadow-sm flex items-start gap-3">
               <AlertTriangle className="text-red-500 shrink-0" size={20}/>
               <div>
                  <h4 className="font-bold text-red-200 text-sm">Saldo Negativo!</h4>
                  <p className="text-xs text-red-200/70 mt-1">Stai spendendo più di quanto guadagni questo mese.</p>
               </div>
             </div>
           )}

           {/* HEADER & TOGGLE ADD */}
           <div className="flex items-center justify-between mt-6 mb-2">
             <h3 className="font-bold text-white flex gap-2"><Bell className="text-yellow-400"/> Promemoria</h3>
             <button 
               onClick={() => { setIsAddingAlert(!isAddingAlert); setEditingAlertId(null); setNewAlertMsg(''); setNewAlertDate(''); setNewAlertTime(''); setNewAlertPriority('medium'); }} 
               className={`p-2 rounded-full transition-colors ${isAddingAlert ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
             >
               {isAddingAlert ? <ChevronUp size={20}/> : <Plus size={20}/>}
             </button>
           </div>
           
           {/* COLLAPSIBLE ADD FORM */}
           {isAddingAlert && (
             <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 mb-4 animate-slide-up space-y-4">
                 <div className="flex gap-2 items-center">
                    <input value={newAlertMsg} onChange={e => setNewAlertMsg(e.target.value)} placeholder="Messaggio avviso..." className="flex-1 bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-3 text-white outline-none placeholder-slate-600 text-sm transition-colors"/>
                    <VoiceInput onResult={setNewAlertMsg} />
                 </div>
                 
                 <div className="flex flex-col gap-3 w-full items-center">
                    <div className="w-full relative">
                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1"><Calendar size={12} className="text-cyan-400"/> Data</label>
                        <input type="date" value={newAlertDate} onChange={e => setNewAlertDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500 appearance-none"/>
                    </div>
                    <div className="w-full relative">
                        <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 flex items-center gap-1"><Clock size={12} className="text-cyan-400"/> Ora</label>
                        <input type="time" value={newAlertTime} onChange={e => setNewAlertTime(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-lg px-3 py-2 outline-none focus:border-indigo-500 appearance-none"/>
                    </div>
                 </div>

                 {/* PRIORITY SELECTOR */}
                 <div className="flex items-center gap-2 w-full">
                     <span className="text-[10px] text-slate-500 uppercase font-bold">Priorità:</span>
                     <div className="flex gap-2 flex-1">
                         {(['high', 'medium', 'low'] as AlertPriority[]).map(p => (
                             <button 
                                key={p} 
                                onClick={() => setNewAlertPriority(p)}
                                className={`flex-1 text-[10px] py-1 rounded border capitalize ${newAlertPriority === p 
                                    ? (p === 'high' ? 'bg-red-900/50 border-red-500 text-red-200' : p === 'medium' ? 'bg-yellow-900/50 border-yellow-500 text-yellow-200' : 'bg-blue-900/50 border-blue-500 text-blue-200')
                                    : 'bg-slate-950 border-slate-800 text-slate-500'
                                }`}
                             >
                                 {p === 'high' ? 'Alta' : p === 'medium' ? 'Media' : 'Bassa'}
                             </button>
                         ))}
                     </div>
                 </div>

                 <button onClick={handleSaveAlert} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-500 flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">
                    <Save size={18}/> {editingAlertId ? 'Aggiorna Promemoria' : 'Salva Promemoria'}
                 </button>
             </div>
           )}

           {/* LIST OF MANUAL ALERTS */}
           <div className="space-y-2">
             <p className="text-[10px] text-slate-500 text-center mb-2 italic">(Doppio clic per segnare come completato)</p>
             {sortedAlerts.map(a => {
               const isDue = new Date(`${a.date}T${a.time}`) <= new Date();
               const borderColor = a.priority === 'high' ? 'border-red-500' : a.priority === 'medium' ? 'border-yellow-500' : 'border-blue-500';
               const neonClass = (isDue && !a.completed) ? 'shadow-[0_0_15px_rgba(239,68,68,0.6)] border-red-500' : borderColor;
               
               return (
               <SwipeableItem 
                   key={a.id} 
                   onSwipeLeft={() => deleteAlert(a.id)}
                   onSwipeRight={() => startEditingAlert(a)}
                   rightLabel="Modifica"
                   rightIcon={<Edit2 size={24}/>}
                   onDoubleClick={() => toggleAlertComplete(a.id)}
               >
                 <div className={`bg-slate-900/40 p-4 rounded-xl border-l-4 flex flex-col gap-1 min-h-[70px] transition-all ${a.completed ? 'border-emerald-500 bg-emerald-950/20' : neonClass}`}>
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                            {(isDue && !a.completed) && <Bell size={14} className="text-red-400 animate-pulse" />}
                            <span className={`text-sm font-medium leading-relaxed ${a.completed ? 'text-emerald-300 line-through' : 'text-white'}`}>{String(a.message)}</span>
                        </div>
                        {a.completed && <span className="text-[9px] font-bold bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded uppercase">Completato</span>}
                        {(!a.completed && isDue) && <span className="text-[9px] font-bold bg-red-900/50 text-red-400 px-2 py-0.5 rounded uppercase animate-pulse">Scaduto</span>}
                    </div>
                    <div className="flex gap-3 text-[10px] text-indigo-300 font-mono mt-1">
                       <span className="flex items-center gap-1"><Calendar size={10}/> {new Date(a.date).toLocaleDateString()}</span>
                       <span className="flex items-center gap-1"><Clock size={10}/> {a.time}</span>
                       <span className={`capitalize ml-auto ${a.priority === 'high' ? 'text-red-400' : a.priority === 'medium' ? 'text-yellow-400' : 'text-blue-400'}`}>{a.priority}</span>
                    </div>
                 </div>
               </SwipeableItem>
               );
             })}
             {manualAlerts.length === 0 && !isAddingAlert && (
               <p className="text-center text-slate-600 text-xs py-4">Nessun promemoria impostato.</p>
             )}
           </div>
        </div>
        );
      }
      case 'reports': return (
        <div className="space-y-6">
            
          {/* AI ADVISOR MOVED HERE */}
          <section className="bg-indigo-950/30 p-4 rounded-xl border border-indigo-500/20 relative">
             <div className="flex justify-between items-center mb-2">
               <div className="flex items-center gap-2 text-indigo-200 font-bold"><Sparkles size={16}/><span>AI Advisor (Analisi Completa)</span></div>
               <button onClick={async () => { setIsLoadingAi(true); setAiAdvice(await getFinancialAdvice(transactions, 'Generale')); setIsLoadingAi(false); }} disabled={isLoadingAi} className="text-[10px] bg-indigo-600 px-2 py-1 rounded text-white">{isLoadingAi ? '...' : 'Analizza Tutto'}</button>
             </div>
             <p className="text-xs text-indigo-100/80 leading-relaxed whitespace-pre-line">{String(aiAdvice || "Tocca Analizza per ricevere consigli basati su tutte le tue finanze.")}</p>
          </section>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="font-bold text-white mb-4">Report Mensile</h3>
            <div className="space-y-3">
               <div className="flex justify-between"><span className="text-slate-400">Entrate</span><span className="text-emerald-400 font-bold">€{monthlyStats.totalIncome.toLocaleString()}</span></div>
               <div className="flex justify-between"><span className="text-slate-400">Uscite</span><span className="text-red-400 font-bold">€{monthlyStats.totalExpense.toLocaleString()}</span></div>
               <div className="h-px bg-slate-800"></div>
               <div className="flex justify-between"><span className="text-white">Saldo</span><span className={monthlyStats.balance >= 0 ? "text-indigo-400 font-bold" : "text-red-400 font-bold"}>€{monthlyStats.balance.toLocaleString()}</span></div>
            </div>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
             <h3 className="font-bold text-white mb-4 flex items-center gap-2"><PieChartIcon size={20} className="text-indigo-400"/> Spese per Categoria</h3>
             {expenseChartData.length > 0 ? (
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2}/>
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', fontSize: '12px' }}
                        itemStyle={{ color: '#e2e8f0' }}
                        formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
                      />
                      <Legend 
                         layout="vertical" 
                         verticalAlign="middle" 
                         align="right"
                         iconType="circle"
                         iconSize={8}
                         formatter={(value) => <span className="text-xs text-slate-300 ml-1">{value}</span>}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
             ) : (
                <p className="text-center text-slate-500 text-xs py-10">Nessuna spesa registrata questo mese.</p>
             )}
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
                <h1 className="text-2xl font-black text-indigo-400">Spese Smart</h1>
                {userName && <p className="text-xs text-indigo-400 font-medium">Ciao, {userName}</p>}
            </div>
            <button onClick={() => setIsSettingsOpen(true)} className="bg-slate-900 p-2 rounded-full border border-slate-800 text-slate-400 hover:text-white"><Settings size={20}/></button>
          </div>
          <div className="flex gap-2 mb-2">
            <StatsCard label="Entrate" amount={monthlyStats.totalIncome} type="income" onClick={() => setHistoryType('income')}/>
            <StatsCard label="Uscite" amount={monthlyStats.totalExpense} type="expense" onClick={() => setHistoryType('expense')}/>
          </div>
          <StatsCard label="Saldo" amount={monthlyStats.balance} type="balance" onClick={() => setIsBalanceHidden(!isBalanceHidden)} isHidden={isBalanceHidden}/>
        </header>

        <main className="px-4 space-y-6">{renderContent()}</main>

        {/* FAB */}
        {activeTab === 'home' && (
          <div className="fixed bottom-24 right-4 z-50 animate-slide-up">
            <button onClick={() => { setEditingTransaction(null); setIsAddModalOpen(true); }} className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 hover:scale-105 transition-all"><Plus size={28}/></button>
          </div>
        )}

        {/* Navbar with safe area padding */}
        <nav className="fixed bottom-0 left-0 right-0 bg-[#0E1629]/95 backdrop-blur-xl border-t border-slate-800 pb-[env(safe-area-inset-bottom)] z-40 max-w-lg mx-auto">
          <div className="flex justify-around items-center h-16">
              {[
                {id:'home', icon:Wallet, l:'Wallet'}, {id:'shopping', icon:ShoppingCart, l:'Spesa'}, 
                {id:'doit', icon:ListTodo, l:'Do It'}, {id:'alerts', icon:Bell, l:'Avvisi'}, {id:'reports', icon:PieChartIcon, l:'Grafico'}
              ].map(i => (
                <button key={i.id} onClick={() => setActiveTab(i.id as any)} className={`flex flex-col items-center justify-center w-14 ${activeTab === i.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                  <i.icon size={22} className={activeTab === i.id ? 'fill-indigo-400/20' : ''}/><span className="text-[9px] font-bold mt-1">{i.l}</span>
                </button>
              ))}
          </div>
        </nav>

        <AddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveTrans} initialData={editingTransaction} expenseCategories={expenseCategories} incomeCategories={incomeCategories} onAddCategory={(c: string, t: any) => t === 'expense' ? setExpenseCategories([...expenseCategories, c]) : setIncomeCategories([...incomeCategories, c])} />
        <HistoryModal isOpen={!!historyType} onClose={() => setHistoryType(null)} transactions={transactions} type={historyType || 'expense'} />
        <SettingsModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            onClearData={handleClearData} 
            userName={userName}
            setUserName={setUserName}
            notificationsEnabled={notificationsEnabled}
            setNotificationsEnabled={setNotificationsEnabled}
            startUpTab={startUpTab}
            setStartUpTab={setStartUpTab}
            onSaveSettings={handleSaveSettings}
            alarmVolume={alarmVolume}
            setAlarmVolume={setAlarmVolume}
            onTestSound={() => playAlarmSound(alarmVolume)}
        />
      </div>
    </div>
  );
};

let rootElement = document.getElementById('root');
if (!rootElement) { rootElement = document.createElement('div'); rootElement.id = 'root'; document.body.appendChild(rootElement); }
const root = createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);