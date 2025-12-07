import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plus, Home, ShoppingCart, ListTodo, Bell, BarChart3, 
  Wallet, PieChart as PieChartIcon, ArrowRight, Sparkles, CheckCircle2, Circle, Trash2, AlertTriangle, Info,
  ArrowUpCircle, ArrowDownCircle, Edit2, X, Check, Save, Mic, Settings, LogOut, Calendar, Clock, User, Key, Lock, ExternalLink, ChevronDown, ChevronUp, Mail,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, MapPin, Droplets, ThermometerSun, Smartphone, Layout, Volume2, Eye, EyeOff, History,
  Flag, XCircle, RefreshCcw, StickyNote, Share2, Copy, Database, LogIn, KeyRound, Terminal
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { createClient } from '@supabase/supabase-js';

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

export interface MemoItem {
  id: string;
  text: string;
  date: string; // ISO string
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

// Helper per Supabase Client (Dinamico)
const getSupabaseClient = () => {
  const url = localStorage.getItem('supabaseUrl');
  const key = localStorage.getItem('supabaseKey');
  if (url && key) {
    try {
        return createClient(url, key);
    } catch(e) {
        console.error("Supabase init error", e);
        return null;
    }
  }
  return null;
};

const getFinancialAdvice = async (transactions: Transaction[], month: string) => {
  // STRICT GUIDELINE: Use process.env.API_KEY exclusively.
  const apiKey = process.env.API_KEY;
  if (!apiKey) return "API Key non configurata nel sistema (process.env.API_KEY).";

  const ai = new GoogleGenAI({ apiKey });
  if (transactions.length === 0) return "Non ci sono abbastanza dati per generare un'analisi completa.";

  const summary = transactions.slice(0, 50).map(t => 
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
  } catch (error: any) {
    console.error("AI Error:", error);
    return `Errore AI: ${error.message || 'Sconosciuto'}`;
  }
};

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-slate-950 min-h-screen text-slate-200 flex flex-col items-center justify-center text-center">
           <AlertTriangle size={48} className="text-red-500 mb-4"/>
           <h1 className="text-xl font-bold mb-2">Qualcosa è andato storto.</h1>
           <p className="text-sm text-slate-400 mb-4">
             Errore rilevato: {this.state.error?.message || String(this.state.error)}
           </p>
           <button 
             onClick={() => { localStorage.clear(); location.reload(); }}
             className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-red-500 transition-colors"
           >
             Resetta Dati e Riavvia
           </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- COMPONENTS ---

// Share List Modal
const ShareListModal = ({ isOpen, onClose, items }: { isOpen: boolean; onClose: () => void; items: ListItem[] }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      const toBuy = items.filter(i => !i.completed).map(i => i.id);
      setSelectedIds(new Set(toBuy));
    }
  }, [isOpen, items]);

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleShare = async () => {
    const text = items
      .filter(i => selectedIds.has(i.id))
      .map(i => `- ${i.text}`)
      .join('\n');
    
    const shareData = {
      title: 'Lista della Spesa',
      text: `Lista della Spesa:\n\n${text}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.text);
        alert('Lista copiata negli appunti!');
      }
      onClose();
    } catch (err) {
      console.error('Error sharing', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden animate-slide-up flex flex-col max-h-[80vh]">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
           <h2 className="font-bold text-white flex items-center gap-2"><Share2 size={20}/> Condividi Lista</h2>
           <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
           <p className="text-xs text-slate-400 mb-3">Seleziona gli elementi da inviare:</p>
           <div className="space-y-2">
             {items.map(i => (
               <div key={i.id} onClick={() => toggleSelection(i.id)} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${selectedIds.has(i.id) ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedIds.has(i.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'}`}>
                    {selectedIds.has(i.id) && <Check size={14} className="text-white"/>}
                  </div>
                  <span className={`text-sm ${i.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{typeof i.text === 'string' ? i.text : 'Elemento'}</span>
               </div>
             ))}
             {items.length === 0 && <p className="text-center text-slate-500 text-sm">Lista vuota</p>}
           </div>
        </div>
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <button onClick={handleShare} disabled={selectedIds.size === 0} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <Share2 size={18} /> Invia {selectedIds.size} elementi
          </button>
        </div>
      </div>
    </div>
  );
};

// Weather Widget Component
const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const fetchWeather = useCallback(() => {
    setLoading(true);
    if (!navigator.geolocation) { setLoading(false); return; }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`
          );
          if (!response.ok) throw new Error('Errore rete');
          const data = await response.json();
          setWeather(data);
        } catch (err) { console.error(err); } finally { setLoading(false); }
      }, 
      (err) => { console.error(err); setLoading(false); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWeather]);

  const getWeatherIcon = (code: number) => {
    if (code === 0) return { icon: <Sun className="text-yellow-400" size={32} />, label: 'Sereno' };
    if (code >= 1 && code <= 3) return { icon: <Cloud className="text-slate-400" size={32} />, label: 'Nuvoloso' };
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { icon: <CloudRain className="text-blue-400" size={32} />, label: 'Pioggia' };
    if (code >= 71 && code <= 77) return { icon: <CloudSnow className="text-white" size={32} />, label: 'Neve' };
    if (code >= 95) return { icon: <CloudLightning className="text-purple-400" size={32} />, label: 'Temporale' };
    return { icon: <Cloud className="text-slate-400" size={32} />, label: 'Variabile' };
  };

  if (loading || !weather) return null;

  const current = weather.current;
  const todayMax = weather.daily.temperature_2m_max[0];
  const todayMin = weather.daily.temperature_2m_min[0];
  const { icon, label } = getWeatherIcon(current.weather_code);

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 mb-6 flex items-center justify-between relative overflow-hidden group">
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
                </div>
            </div>
        </div>
        <button onClick={fetchWeather} className="z-10 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50"><RefreshCcw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`}/></button>
    </div>
  );
};

// Voice Input
const VoiceInput = ({ onResult }: { onResult: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
        recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);
  
  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser non supportato o modalità PWA su iOS limitata.");
      return;
    }
    stopListening();
    try {
        const recognition = new SpeechRecognition();
        recognitionRef.current = recognition;
        recognition.lang = 'it-IT';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            const transcript = event.results?.[0]?.[0]?.transcript;
            if (transcript && typeof transcript === 'string') {
              onResult(transcript);
            }
            stopListening(); 
        };
        recognition.onerror = () => stopListening();
        recognition.onend = () => setIsListening(false);
        recognition.start();
    } catch(e) { stopListening(); }
  }, [onResult, stopListening]);

  return (
    <button type="button" onClick={isListening ? stopListening : startListening} className={`p-3 rounded-xl transition-all flex items-center justify-center shrink-0 ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
      <Mic size={20} className={isListening ? 'animate-bounce' : ''} />
    </button>
  );
};

// Swipeable Item (Enhanced for Mouse & Touch)
const SwipeableItem = ({ children, onSwipeLeft, onSwipeRight, rightLabel="Modifica", rightIcon=<Edit2 size={24}/>, leftLabel="Elimina", onDoubleClick }: any) => {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Touch Handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null || isDeleting) return;
    const diff = e.touches[0].clientX - startX;
    if (diff > 0 && !onSwipeRight) return;
    setCurrentX(diff > 100 ? 100 + (diff-100)*0.2 : diff);
  };

  // Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || startX === null || isDeleting) return;
    e.preventDefault();
    const diff = e.clientX - startX;
    if (diff > 0 && !onSwipeRight) return;
    setCurrentX(diff > 100 ? 100 + (diff-100)*0.2 : diff);
  };

  const handleEnd = () => {
    if (!isDragging && startX === null) return;
    setIsDragging(false);
    
    if (onSwipeRight && currentX > 70) { 
        onSwipeRight(); 
        setCurrentX(0); 
    } else if (currentX < -150) {
      setIsDeleting(true); 
      setCurrentX(-window.innerWidth);
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(onSwipeLeft, 300);
    } else {
        setCurrentX(0);
    }
    setStartX(null);
  };

  if (isDeleting && Math.abs(currentX) >= window.innerWidth) return <div className="h-[70px] mb-2 w-full"></div>;

  return (
    <div 
        className="relative mb-2 w-full overflow-hidden rounded-xl select-none touch-pan-y" 
        style={{ touchAction: 'pan-y' }} 
        onDoubleClick={onDoubleClick}
        onMouseLeave={handleEnd}
        onMouseUp={handleEnd}
    >
      <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors ${currentX > 0 ? 'bg-indigo-600' : 'bg-red-600'}`}>
        {onSwipeRight && <div className="flex items-center gap-2 text-white font-bold" style={{ opacity: currentX > 30 ? 1 : 0 }}>{rightIcon} <span>{rightLabel}</span></div>}
        <div className="flex items-center gap-2 text-white font-bold ml-auto" style={{ opacity: currentX < -30 ? 1 : 0 }}><span>{leftLabel}</span> <Trash2 size={24} /></div>
      </div>
      <div 
        className="relative bg-slate-900 border border-slate-800 rounded-xl transition-transform ease-out" 
        style={{ transform: `translateX(${currentX}px)`, transition: isDragging ? 'none' : 'transform 0.3s ease-out' }} 
        onTouchStart={handleTouchStart} 
        onTouchMove={handleTouchMove} 
        onTouchEnd={handleEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
      >
        {children}
      </div>
    </div>
  );
};

// Custom Tooltip for Chart
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (!data) return null;
    return (
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-xl z-50 animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }}></div>
            <p className="font-bold text-slate-200 text-xs">{String(data.name)}</p>
        </div>
        <div className="flex items-baseline gap-2">
            <p className="text-indigo-400 font-bold text-lg">
            {Number(data.value).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}
            </p>
            <p className="text-xs text-slate-400 font-medium bg-slate-800 px-1.5 py-0.5 rounded">
            {data.percentage}%
            </p>
        </div>
      </div>
    );
  }
  return null;
};

// StatsCard
const StatsCard = ({ label, amount, type, onClick, isHidden }: any) => {
  const colors = type === 'income' ? "text-emerald-400 bg-emerald-950/30 border-emerald-900/30" : type === 'expense' ? "text-red-400 bg-red-950/30 border-red-900/30" : "text-indigo-400 bg-slate-900 border-slate-800";
  return (
    <div onClick={onClick} className={`flex-1 p-3 rounded-2xl border shadow-sm flex flex-col items-center justify-center ${colors} relative ${onClick ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}>
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1">{label} {type === 'balance' && (isHidden ? <EyeOff size={10}/> : <Eye size={10}/>)}</span>
      <span className="text-lg sm:text-xl font-bold truncate max-w-full">{isHidden ? '••••••' : (Number(amount) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
    </div>
  );
};

// Settings Modal Updated with Password Reset
const SettingsModal = ({ isOpen, onClose, onClearData, userName, setUserName, notificationsEnabled, setNotificationsEnabled, startUpTab, setStartUpTab, onSaveSettings, alarmVolume, setAlarmVolume, onTestSound, supabaseUrl, setSupabaseUrl, supabaseKey, setSupabaseKey, onLogin, onResetPassword, currentUser, onLogout }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login'|'register'|'reset'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const SQL_SCHEMA = `
-- Crea la tabella per le transazioni
create table public.transactions (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  amount numeric not null,
  description text not null,
  category text not null,
  type text not null,
  date timestamptz not null default now(),
  created_at timestamptz default now(),
  primary key (id)
);

-- Abilita la sicurezza (Row Level Security)
alter table public.transactions enable row level security;

-- Crea le policy per permettere agli utenti di vedere solo i propri dati
create policy "Users can read their own transactions"
on public.transactions for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert their own transactions"
on public.transactions for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own transactions"
on public.transactions for update to authenticated using (auth.uid() = user_id);

create policy "Users can delete their own transactions"
on public.transactions for delete to authenticated using (auth.uid() = user_id);
  `.trim();

  const handleAuth = async () => {
      setAuthLoading(true);
      try {
        if (authMode === 'reset') {
            await onResetPassword(email);
        } else {
            await onLogin(email, password, authMode);
        }
      } catch(e) {
          console.error(e);
      }
      setAuthLoading(false);
      if(authMode !== 'reset') { setEmail(''); setPassword(''); }
  };

  const copySql = () => {
      navigator.clipboard.writeText(SQL_SCHEMA);
      alert("Codice SQL copiato! Incollalo nell'SQL Editor di Supabase.");
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden animate-slide-up max-h-[85vh] overflow-y-auto no-scrollbar">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
            <h2 className="font-bold text-white flex items-center gap-2"><Settings size={20}/> Configurazioni</h2>
            <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-8">
          
          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Layout size={14}/> Generali</h3>
             <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
               <span className="text-sm text-slate-300">Pagina di Avvio</span>
               <select value={startUpTab} onChange={(e) => setStartUpTab(e.target.value)} className="bg-slate-800 text-white text-xs p-2 rounded border border-slate-700 outline-none">
                 <option value="home">Wallet</option>
                 <option value="shopping">Spesa</option>
                 <option value="doit">Do It</option>
                 <option value="memos">Memo</option>
                 <option value="alerts">Avvisi</option>
                 <option value="reports">Grafico</option>
               </select>
             </div>
          </div>

          <div className="space-y-3">
              <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Database size={14}/> Cloud & Sync (Supabase)</h3>
                  <button onClick={() => setShowSql(!showSql)} className="text-[10px] text-indigo-400 flex items-center gap-1 hover:text-indigo-300">
                      <Terminal size={12}/> {showSql ? 'Nascondi SQL' : 'Schema Database'}
                  </button>
              </div>

              {showSql && (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 animate-fade-in">
                      <div className="flex justify-between items-center mb-2">
                        <p className="text-[10px] text-slate-400">Esegui questo script nell'SQL Editor di Supabase per creare le tabelle.</p>
                        <button onClick={copySql} className="text-xs bg-indigo-600 text-white px-2 py-1 rounded flex items-center gap-1"><Copy size={12}/> Copia</button>
                      </div>
                      <pre className="text-[10px] text-slate-300 overflow-x-auto p-2 bg-slate-900 rounded border border-slate-800 font-mono">
                          {SQL_SCHEMA}
                      </pre>
                  </div>
              )}

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4">
                  <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 uppercase">Project URL</label>
                      <input type="text" value={supabaseUrl} onChange={e => setSupabaseUrl(e.target.value)} placeholder="https://your-project.supabase.co" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none"/>
                  </div>
                  <div className="space-y-2">
                      <label className="text-[10px] text-slate-500 uppercase">Anon Key</label>
                      <input type="password" value={supabaseKey} onChange={e => setSupabaseKey(e.target.value)} placeholder="eyJh..." className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none"/>
                  </div>

                  {supabaseUrl && supabaseKey && (
                      <div className="pt-2 border-t border-slate-800 animate-fade-in">
                          {currentUser ? (
                              <div className="text-center space-y-3">
                                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm"><CheckCircle2 size={16}/> {String(currentUser.email)}</div>
                                  <button onClick={onLogout} className="text-xs bg-red-900/30 text-red-400 px-4 py-2 rounded">Disconnetti</button>
                              </div>
                          ) : (
                              <div className="space-y-3">
                                  <div className="flex gap-2">
                                      <button onClick={() => setAuthMode('login')} className={`flex-1 text-xs py-1.5 rounded ${authMode==='login' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Accedi</button>
                                      <button onClick={() => setAuthMode('register')} className={`flex-1 text-xs py-1.5 rounded ${authMode==='register' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Registrati</button>
                                  </div>
                                  
                                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none"/>
                                  
                                  {authMode !== 'reset' && (
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none"/>
                                  )}

                                  {authMode === 'login' && (
                                      <button onClick={() => setAuthMode('reset')} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 w-full justify-end">
                                          <KeyRound size={10}/> Password dimenticata?
                                      </button>
                                  )}

                                  <button onClick={handleAuth} disabled={authLoading} className="w-full bg-emerald-600 text-white py-2 rounded text-xs font-bold hover:bg-emerald-500 flex justify-center">
                                      {authLoading ? 'Attendi...' : (authMode === 'login' ? 'Entra nel Cloud' : authMode === 'reset' ? 'Invia Email Recupero' : 'Crea Account')}
                                  </button>
                                  {authMode === 'reset' && <button onClick={() => setAuthMode('login')} className="text-center w-full text-[10px] text-slate-500 hover:text-slate-300">Torna al Login</button>}
                              </div>
                          )}
                      </div>
                  )}
              </div>
          </div>

          <div className="space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><User size={14}/> Profilo Locale</h3>
             <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Il tuo nome" className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white"/>
          </div>

          <button onClick={onSaveSettings} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 flex items-center justify-center gap-2"><Save size={20} /> Salva Impostazioni</button>
          
          <div className="pt-4 border-t border-slate-800">
            <button onClick={onClearData} className="w-full py-3 bg-red-900/20 text-red-400 border border-red-900/50 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-900/30 transition-colors"><LogOut size={18} /> Resetta Dati App</button>
          </div>
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
  }, [isOpen, initialData, expenseCategories]);

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
            <button type="button" className={`flex-1 py-2 rounded-md text-sm font-medium ${type === '