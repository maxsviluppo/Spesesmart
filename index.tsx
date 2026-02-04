import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
console.log("App starting...");
import {
  Plus, Home, ShoppingCart, ListTodo, Bell, BarChart3,
  Wallet, PieChart as PieChartIcon, ArrowRight, Sparkles, CheckCircle2, Circle, Trash2, AlertTriangle, Info,
  ArrowUpCircle, ArrowDownCircle, Edit2, X, Check, Save, Mic, Settings, LogOut, Calendar, Clock, User, Key, Lock, ExternalLink, ChevronDown, ChevronUp, Mail,
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, MapPin, Droplets, ThermometerSun, Smartphone, Layout, Volume2, Eye, EyeOff, History,
  Flag, XCircle, RefreshCcw, StickyNote, Share2, Copy, Database, LogIn, KeyRound, Terminal, RotateCcw, Download, Upload, FileJson, ShieldAlert
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAZIONE DATABASE DINAMICA ---
// Non scriviamo più le chiavi qui per sicurezza.
// Le chiavi verranno lette dalla memoria del browser (localStorage).

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
  const url = localStorage.getItem('sb_url');
  const key = localStorage.getItem('sb_key');

  if (!url || !key) return null;

  try {
    return createClient(url, key);
  } catch (e) {
    console.error("Supabase init error", e);
    return null;
  }
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
          <AlertTriangle size={48} className="text-red-500 mb-4" />
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
    return (this as any).props.children;
  }
}

// --- COMPONENTS ---

// Setup Wizard Component (Per inserire le chiavi in sicurezza)
const SetupWizard = ({ onComplete }: { onComplete: () => void }) => {
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');

  const handleSave = () => {
    if (!url.startsWith('https://')) {
      alert("L'URL del progetto deve iniziare con https://");
      return;
    }
    if (key.length < 20) {
      alert("La chiave API sembra troppo corta.");
      return;
    }
    localStorage.setItem('sb_url', url.trim());
    localStorage.setItem('sb_key', key.trim());
    onComplete();
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="bg-slate-900 w-full max-w-md p-8 rounded-2xl border border-slate-800 shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-500/20 p-4 rounded-full">
            <ShieldAlert size={40} className="text-indigo-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-2">Configurazione Sicura</h1>
        <p className="text-slate-400 text-center text-sm mb-6">
          Per evitare di esporre le tue chiavi su GitHub, inseriscile qui. Verranno salvate solo nel tuo browser.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Supabase Project URL</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://xyz.supabase.co"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase">Supabase Public Anon Key</label>
            <input
              value={key}
              onChange={e => setKey(e.target.value)}
              placeholder="eyJhbG..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white mt-1"
              type="password"
            />
          </div>
          <button
            onClick={handleSave}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-500 mt-4"
          >
            Salva e Avvia App
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-800 text-center space-y-2">
          <p className="text-[10px] text-slate-500">
            Non sai dove trovare questi dati?
          </p>
          <p className="text-xs text-slate-400">
            Vai su <strong>Settings</strong> &gt; <strong>API</strong> nel tuo progetto Supabase.
          </p>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-indigo-400 text-xs font-bold hover:text-indigo-300 mt-2"
          >
            <ExternalLink size={14} /> Apri Dashboard Supabase
          </a>
        </div>
      </div>
    </div>
  );
};

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
          <h2 className="font-bold text-white flex items-center gap-2"><Share2 size={20} /> Condividi Lista</h2>
          <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-xs text-slate-400 mb-3">Seleziona gli elementi da inviare:</p>
          <div className="space-y-2">
            {items.map(i => (
              <div key={i.id} onClick={() => toggleSelection(i.id)} className={`p-3 rounded-lg border flex items-center gap-3 cursor-pointer ${selectedIds.has(i.id) ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-slate-950 border-slate-800'}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center border ${selectedIds.has(i.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-600'}`}>
                  {selectedIds.has(i.id) && <Check size={14} className="text-white" />}
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
            <span className="flex items-center gap-1"><ArrowUpCircle size={12} className="text-red-400" /> {Math.round(todayMax)}°</span>
            <span className="flex items-center gap-1"><ArrowDownCircle size={12} className="text-emerald-400" /> {Math.round(todayMin)}°</span>
          </div>
        </div>
      </div>
      <button onClick={fetchWeather} className="z-10 bg-slate-800/50 p-2 rounded-lg border border-slate-700/50"><RefreshCcw size={16} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} /></button>
    </div>
  );
};

// Voice Input (Safe for Safari)
const VoiceInput = ({ onResult }: { onResult: (text: string) => void }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check support only on mount to avoid SSR/Render crashes
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSupported(!!SpeechRecognition);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!isSupported) {
      alert("Input vocale non supportato su questo browser (prova Chrome o Safari aggiornato).");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
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

      recognition.onerror = (e: any) => {
        console.warn("Speech error:", e);
        stopListening();
      };

      recognition.onend = () => setIsListening(false);

      recognition.start();
    } catch (e) {
      console.error("Speech start error:", e);
      stopListening();
    }
  }, [onResult, stopListening, isSupported]);

  if (!isSupported) return null; // Don't render button if not supported OR if checking failed

  return (
    <button type="button" onClick={isListening ? stopListening : startListening} className={`p-3 rounded-xl transition-all flex items-center justify-center shrink-0 ${isListening ? 'bg-red-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400 border border-slate-700'}`}>
      <Mic size={20} className={isListening ? 'animate-bounce' : ''} />
    </button>
  );
};

// Swipeable Item (Enhanced for Mouse & Touch)
const SwipeableItem = ({ children, onSwipeLeft, onSwipeRight, rightLabel = "Modifica", rightIcon = <Edit2 size={24} />, leftLabel = "Elimina", onDoubleClick }: any) => {
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
    setCurrentX(diff > 100 ? 100 + (diff - 100) * 0.2 : diff);
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
    setCurrentX(diff > 100 ? 100 + (diff - 100) * 0.2 : diff);
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

// Expandable Item for Todo List
const ExpandableTodoItem = ({ item, onToggle }: { item: ListItem; onToggle: () => void }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`flex items-center gap-3 p-4 transition-all duration-200 cursor-pointer ${expanded ? '' : 'h-[60px]'}`}
      onDoubleClick={() => setExpanded(!expanded)}
    >
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="focus:outline-none shrink-0">
        {item.completed ? <CheckCircle2 className="text-indigo-500" size={24} /> : <Circle className="text-slate-500" size={24} />}
      </button>
      <span className={`text-sm leading-snug ${item.completed ? 'line-through text-slate-500' : 'text-white'} ${expanded ? 'whitespace-pre-wrap' : 'truncate'}`}>
        {String(item.text)}
      </span>
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
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-1 flex items-center gap-1">{label} {type === 'balance' && (isHidden ? <EyeOff size={10} /> : <Eye size={10} />)}</span>
      <span className="text-lg sm:text-xl font-bold truncate max-w-full">{isHidden ? '••••••' : (Number(amount) || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span>
    </div>
  );
};

// Settings Modal Updated with Password Reset & Demo Mode
const SettingsModal = ({
  isOpen, onClose, onClearData, userName, setUserName,
  notificationsEnabled, setNotificationsEnabled, startUpTab, setStartUpTab,
  onSaveSettings, alarmVolume, setAlarmVolume, onTestSound,
  onLogin, onResetPassword, currentUser, onLogout, onDemoLogin,
  onExportData, onImportData, onResetConfig
}: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset'>('login');
  const [authLoading, setAuthLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAuth = async () => {
    setAuthLoading(true);
    try {
      if (authMode === 'reset') {
        await onResetPassword(email);
      } else {
        await onLogin(email, password, authMode);
      }
    } catch (e) {
      console.error(e);
    }
    setAuthLoading(false);
    if (authMode !== 'reset') { setEmail(''); setPassword(''); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onImportData(e.target.files[0]);
      e.target.value = ''; // Reset
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 overflow-hidden animate-slide-up max-h-[85vh] overflow-y-auto no-scrollbar">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
          <h2 className="font-bold text-white flex items-center gap-2"><Settings size={20} /> Impostazioni</h2>
          <button onClick={onClose}><X size={24} className="text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-8">

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Layout size={14} /> Generali</h3>
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
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><FileJson size={14} /> Backup & Ripristino (Locale)</h3>
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
              <p className="text-[10px] text-slate-400">Salva tutti i tuoi dati (transazioni, liste, categorie) in un file JSON o ripristinali.</p>
              <div className="flex gap-2">
                <button onClick={onExportData} className="flex-1 bg-indigo-600/20 text-indigo-400 border border-indigo-600/50 hover:bg-indigo-600/30 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                  <Download size={14} /> Scarica Backup
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 hover:bg-emerald-600/30 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2">
                  <Upload size={14} /> Ripristina
                </button>
                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileChange} className="hidden" />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Database size={14} /> Account</h3>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4">
              {currentUser ? (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-sm">
                    {currentUser.id === 'demo' ? <User size={16} /> : <CheckCircle2 size={16} />}
                    {String(currentUser.email)}
                  </div>
                  <div className="text-xs text-slate-500">{currentUser.id === 'demo' ? 'Modalità Locale (Nessun Cloud)' : 'Sincronizzato col Cloud'}</div>
                  <button onClick={onLogout} className="text-xs bg-red-900/30 text-red-400 px-4 py-2 rounded border border-red-900/50">Disconnetti</button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 text-center mb-2">Accedi per sincronizzare i tuoi dati.</p>
                  <div className="flex gap-2">
                    <button onClick={() => setAuthMode('login')} className={`flex-1 text-xs py-1.5 rounded ${authMode === 'login' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Accedi</button>
                    <button onClick={() => setAuthMode('register')} className={`flex-1 text-xs py-1.5 rounded ${authMode === 'register' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}>Registrati</button>
                  </div>

                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none" />

                  {authMode !== 'reset' && (
                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white outline-none" />
                  )}

                  {authMode === 'login' && (
                    <button onClick={() => setAuthMode('reset')} className="text-[10px] text-indigo-400 hover:underline flex items-center gap-1 w-full justify-end">
                      <KeyRound size={10} /> Password dimenticata?
                    </button>
                  )}

                  <button onClick={handleAuth} disabled={authLoading} className="w-full bg-emerald-600 text-white py-2 rounded text-xs font-bold hover:bg-emerald-500 flex justify-center">
                    {authLoading ? 'Attendi...' : (authMode === 'login' ? 'Entra nel Cloud' : authMode === 'reset' ? 'Invia Email Recupero' : 'Crea Account')}
                  </button>
                  {authMode === 'reset' && <button onClick={() => setAuthMode('login')} className="text-center w-full text-[10px] text-slate-500 hover:text-slate-300">Torna al Login</button>}

                  <div className="pt-2 border-t border-slate-800 mt-2">
                    <button onClick={onDemoLogin} className="w-full bg-slate-800 text-slate-200 py-2 rounded text-xs font-bold hover:bg-slate-700 flex justify-center border border-slate-700">
                      Entra come Utente Demo (Locale)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><User size={14} /> Profilo Locale</h3>
            <input type="text" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Il tuo nome" className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-white" />
          </div>

          <button onClick={onSaveSettings} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 flex items-center justify-center gap-2"><Save size={20} /> Salva Impostazioni</button>

          <div className="pt-4 border-t border-slate-800 space-y-2">
            <button onClick={onResetConfig} className="w-full py-2 bg-yellow-900/20 text-yellow-400 border border-yellow-900/50 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-900/30 transition-colors text-xs"><RotateCcw size={16} /> Cambia API Keys</button>
            <button onClick={onClearData} className="w-full py-2 bg-red-900/20 text-red-400 border border-red-900/50 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-900/30 transition-colors text-xs"><Trash2 size={16} /> Resetta Dati App</button>
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
                <div className="flex gap-1"><input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="w-20 bg-slate-800 text-xs px-2 rounded text-white" /><button type="button" onClick={handleAddCat}><Check size={14} className="text-emerald-500" /></button></div>
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

// --- MAIN APP ---

const App = () => {
  const [isConfigured, setIsConfigured] = useState(() => !!localStorage.getItem('sb_url') && !!localStorage.getItem('sb_key'));

  const [startUpTab, setStartUpTab] = useState(() => localStorage.getItem('startUpTab') || 'home');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('notificationsEnabled') === 'true');
  const [alarmVolume, setAlarmVolume] = useState(() => parseFloat(localStorage.getItem('alarmVolume') || '0.5'));
  const [activeTab, setActiveTab] = useState<'home' | 'shopping' | 'doit' | 'alerts' | 'reports' | 'memos'>(startUpTab as any);

  // Supabase Config
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [isBalanceHidden, setIsBalanceHidden] = useState(() => localStorage.getItem('isBalanceHidden') === 'true');
  const [userName, setUserName] = useState(() => localStorage.getItem('userName') || '');

  // Strict JSON Parsing to avoid [object Object] errors
  const safeJsonParse = (key: string, defaultVal: any) => {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return defaultVal;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return defaultVal;
      return parsed;
    } catch {
      return defaultVal;
    }
  };

  const safeCategoriesParse = (key: string, defaultVal: string[]) => {
    const arr = safeJsonParse(key, defaultVal);
    // Filter out non-strings to prevent [object Object] rendering
    return arr.filter((i: any) => typeof i === 'string');
  };

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const raw = safeJsonParse('transactions', []);
    return raw.filter((t: any) => t && typeof t === 'object' && typeof t.amount === 'number' && typeof t.description === 'string');
  });

  const [shoppingList, setShoppingList] = useState<ListItem[]>(() => {
    const raw = safeJsonParse('shoppingList', []);
    return raw.filter((i: any) => i && typeof i === 'object' && (typeof i.text === 'string' || typeof i.text === 'number'));
  });

  const [todoList, setTodoList] = useState<ListItem[]>(() => {
    const raw = safeJsonParse('todoList', []);
    return raw.filter((i: any) => i && typeof i === 'object' && (typeof i.text === 'string' || typeof i.text === 'number'));
  });

  const [memos, setMemos] = useState<MemoItem[]>(() => {
    const raw = safeJsonParse('memos', []);
    return raw.filter((i: any) => i && typeof i === 'object' && (typeof i.text === 'string'));
  });

  const [manualAlerts, setManualAlerts] = useState<ManualAlert[]>(() => {
    const raw = safeJsonParse('manualAlerts', []);
    return raw.filter((a: any) => a && typeof a === 'object' && typeof a.message === 'string');
  });

  const [expenseCategories, setExpenseCategories] = useState<string[]>(() => safeCategoriesParse('expenseCategories', DEFAULT_EXPENSE_CATEGORIES));
  const [incomeCategories, setIncomeCategories] = useState<string[]>(() => safeCategoriesParse('incomeCategories', DEFAULT_INCOME_CATEGORIES));

  // UI State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false); // Share Modal State
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingListItemId, setEditingListItemId] = useState<string | null>(null);
  const [isAddingAlert, setIsAddingAlert] = useState(false);

  // Inputs
  const [newShoppingItem, setNewShoppingItem] = useState('');
  const [newTodoItem, setNewTodoItem] = useState('');
  const [newMemoItem, setNewMemoItem] = useState('');

  // Refs for focusing
  const shoppingInputRef = useRef<HTMLInputElement>(null);
  const todoInputRef = useRef<HTMLInputElement>(null);
  const memoInputRef = useRef<HTMLInputElement>(null);

  // Alerts Inputs
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [newAlertMsg, setNewAlertMsg] = useState('');
  const [newAlertDate, setNewAlertDate] = useState('');
  const [newAlertTime, setNewAlertTime] = useState('');
  const [newAlertPriority, setNewAlertPriority] = useState<AlertPriority>('medium');

  const [aiAdvice, setAiAdvice] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Persist Local
  useEffect(() => { if (!currentUser) localStorage.setItem('transactions', JSON.stringify(transactions)); }, [transactions, currentUser]);
  useEffect(() => { localStorage.setItem('shoppingList', JSON.stringify(shoppingList)); }, [shoppingList]);
  useEffect(() => { localStorage.setItem('todoList', JSON.stringify(todoList)); }, [todoList]);
  useEffect(() => { localStorage.setItem('memos', JSON.stringify(memos)); }, [memos]);
  useEffect(() => { localStorage.setItem('manualAlerts', JSON.stringify(manualAlerts)); }, [manualAlerts]);
  useEffect(() => { localStorage.setItem('expenseCategories', JSON.stringify(expenseCategories)); }, [expenseCategories]);
  useEffect(() => { localStorage.setItem('incomeCategories', JSON.stringify(incomeCategories)); }, [incomeCategories]);
  useEffect(() => { localStorage.setItem('userName', userName); }, [userName]);
  useEffect(() => { localStorage.setItem('alarmVolume', alarmVolume.toString()); }, [alarmVolume]);
  useEffect(() => { localStorage.setItem('isBalanceHidden', String(isBalanceHidden)); }, [isBalanceHidden]);

  // DB SYNC: Fetch on Login
  useEffect(() => {
    if (!isConfigured) return;

    const fetchCloudData = async () => {
      const sb = getSupabaseClient();
      if (sb) {
        const { data: { user } } = await sb.auth.getUser();
        if (user) {
          setCurrentUser(user);
          // Fetch Transactions from Cloud
          const { data, error } = await sb.from('transactions').select('*').order('date', { ascending: false });
          if (!error && data) {
            setTransactions(data as Transaction[]);
          }
        }
      }
    };
    fetchCloudData();
  }, [isConfigured]); // Run when configured

  const handleSupabaseAuth = async (e: string, p: string, mode: 'login' | 'register') => {
    const sb = getSupabaseClient();
    if (!sb) {
      alert("Configurazione mancante. Riavvia l'app.");
      return;
    }

    try {
      if (mode === 'register') {
        const { data, error } = await sb.auth.signUp({ email: e, password: p });
        if (error) throw error;
        else alert("Registrazione effettuata! Controlla la tua email per confermare.");
      } else {
        const { data, error } = await sb.auth.signInWithPassword({ email: e, password: p });
        if (error) throw error;
        else {
          setCurrentUser(data.user);
          // Force reload from cloud using the new authenticated client
          const { data: cloudData } = await sb.from('transactions').select('*').order('date', { ascending: false });
          if (cloudData) setTransactions(cloudData as Transaction[]);
          setIsSettingsOpen(false);
        }
      }
    } catch (err: any) {
      alert(`Errore Login/Registrazione: ${err.message || String(err)}`);
    }
  };

  const handleResetPassword = async (email: string) => {
    const sb = getSupabaseClient();
    if (!sb) return alert("Configurazione Supabase mancante.");

    try {
      const { error } = await sb.auth.resetPasswordForEmail(email);
      if (error) alert("Errore: " + (error.message || "Sconosciuto"));
      else alert("Email di recupero inviata! Controlla la posta.");
    } catch (e) {
      alert("Errore invio email.");
    }
  };

  const handleDemoLogin = () => {
    setCurrentUser({ id: 'demo', email: 'utente@locale.demo', aud: 'authenticated' });
    setIsSettingsOpen(false);
  };

  const handleLogout = async () => {
    if (currentUser?.id === 'demo') {
      setCurrentUser(null);
      return;
    }
    const sb = getSupabaseClient();
    if (sb) await sb.auth.signOut();
    setCurrentUser(null);
    // Revert to local storage
    try {
      const d = JSON.parse(localStorage.getItem('transactions') || '[]');
      setTransactions(d);
    } catch { setTransactions([]); }
  };

  const handleSaveSettings = () => {
    localStorage.setItem('startUpTab', startUpTab);
    localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
    setIsSettingsOpen(false);
  };

  const handleClearData = () => {
    if (confirm("Sei sicuro? Questo cancellerà TUTTE le transazioni, liste e note LOCALI, ma manterrà la configurazione di Supabase e il tuo profilo.")) {
      // Clear only data, NOT config
      localStorage.removeItem('transactions');
      localStorage.removeItem('shoppingList');
      localStorage.removeItem('todoList');
      localStorage.removeItem('memos');
      localStorage.removeItem('manualAlerts');

      // Reset State
      setTransactions([]);
      setShoppingList([]);
      setTodoList([]);
      setMemos([]);
      setManualAlerts([]);

      alert("Dati resettati.");
    }
  };

  const handleResetConfig = () => {
    if (confirm("Vuoi cancellare le chiavi API salvate e reinserirle?")) {
      localStorage.removeItem('sb_url');
      localStorage.removeItem('sb_key');
      setIsConfigured(false);
      setIsSettingsOpen(false);
    }
  };

  // EXPORT / IMPORT
  const handleExportData = () => {
    const data = {
      transactions,
      shoppingList,
      todoList,
      memos,
      manualAlerts,
      expenseCategories,
      incomeCategories,
      exportDate: new Date().toISOString(),
      version: 1
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `spesesmart-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportData = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);
        if (data.transactions && Array.isArray(data.transactions)) setTransactions(data.transactions);
        if (data.shoppingList && Array.isArray(data.shoppingList)) setShoppingList(data.shoppingList);
        if (data.todoList && Array.isArray(data.todoList)) setTodoList(data.todoList);
        if (data.memos && Array.isArray(data.memos)) setMemos(data.memos);
        if (data.manualAlerts && Array.isArray(data.manualAlerts)) setManualAlerts(data.manualAlerts);
        if (data.expenseCategories && Array.isArray(data.expenseCategories)) setExpenseCategories(data.expenseCategories);
        if (data.incomeCategories && Array.isArray(data.incomeCategories)) setIncomeCategories(data.incomeCategories);
        alert("Ripristino completato con successo!");
      } catch (err) {
        alert("Errore nel file di backup: formato non valido.");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // CRUD TRANSACTIONS WITH SYNC
  const handleSaveTrans = async (amount: number, description: string, category: string, type: TransactionType, id?: string) => {
    const newTrans = {
      id: id || crypto.randomUUID(),
      amount,
      description,
      category,
      type,
      date: id ? transactions.find(t => t.id === id)?.date || new Date().toISOString() : new Date().toISOString()
    };

    // Optimistic Update
    if (id) {
      setTransactions(p => p.map(t => t.id === id ? newTrans : t));
    } else {
      setTransactions(p => [newTrans, ...p]);
    }

    // Cloud Sync
    if (currentUser && currentUser.id !== 'demo') {
      const sb = getSupabaseClient();
      if (sb) {
        const payload = {
          user_id: currentUser.id, // Ensure user ownership
          amount: newTrans.amount,
          description: newTrans.description,
          category: newTrans.category,
          type: newTrans.type,
          date: newTrans.date
        };

        if (id) {
          await sb.from('transactions').update(payload).eq('id', id);
        } else {
          // Note: Supabase generates its own UUID, but we can pass one if we want consistency or let it generate
          // To match optimistic update, strictly we should use the same ID, but Supabase UUIDs are strict.
          // For simplicity in this demo, we insert and let Supabase handle it, or we could pass the ID if UUID v4.
          await sb.from('transactions').insert([{ ...payload, id: newTrans.id }]);
        }
      }
    }
  };

  const handleDeleteTrans = async (id: string) => {
    // Optimistic
    setTransactions(p => p.filter(t => t.id !== id));

    // Cloud
    if (currentUser && currentUser.id !== 'demo') {
      const sb = getSupabaseClient();
      if (sb) await sb.from('transactions').delete().eq('id', id);
    }
  };

  // Lists & Alerts Handlers (Keep Local for now to satisfy prompt focus on DB logic, can be extended later)
  const handleAddList = (type: 'shopping' | 'todo' | 'memo', text: string) => {
    if (!text.trim()) return;
    if (editingListItemId) {
      if (type === 'shopping') { setShoppingList(p => p.map(i => i.id === editingListItemId ? { ...i, text: text.trim() } : i)); setNewShoppingItem(''); }
      else if (type === 'todo') { setTodoList(p => p.map(i => i.id === editingListItemId ? { ...i, text: text.trim() } : i)); setNewTodoItem(''); }
      else { setMemos(p => p.map(i => i.id === editingListItemId ? { ...i, text: text.trim(), date: i.date } : i)); setNewMemoItem(''); }
      setEditingListItemId(null);
    } else {
      const item = { id: crypto.randomUUID(), text: text.trim(), completed: false };
      if (type === 'shopping') { setShoppingList([item, ...shoppingList]); setNewShoppingItem(''); }
      else if (type === 'todo') { setTodoList([item, ...todoList]); setNewTodoItem(''); }
      else { setMemos([{ id: crypto.randomUUID(), text: text.trim(), date: new Date().toISOString() }, ...memos]); setNewMemoItem(''); }
    }
  };
  const startEditingList = (type: 'shopping' | 'todo' | 'memo', item: any) => {
    setEditingListItemId(item.id);
    if (type === 'shopping') {
      setNewShoppingItem(item.text);
      setTimeout(() => shoppingInputRef.current?.focus(), 100);
    }
    else if (type === 'todo') {
      setNewTodoItem(item.text);
      setTimeout(() => todoInputRef.current?.focus(), 100);
    }
    else {
      setNewMemoItem(item.text);
      setTimeout(() => memoInputRef.current?.focus(), 100);
    }
  };
  const toggleList = (type: 'shopping' | 'todo', id: string) => {
    if (type === 'shopping') setShoppingList(p => p.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
    else setTodoList(p => p.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  };
  const deleteList = (type: 'shopping' | 'todo' | 'memo', id: string) => {
    if (type === 'shopping') setShoppingList(p => p.filter(i => i.id !== id));
    else if (type === 'todo') setTodoList(p => p.filter(i => i.id !== id));
    else setMemos(p => p.filter(i => i.id !== id));
    if (editingListItemId === id) { setEditingListItemId(null); type === 'shopping' ? setNewShoppingItem('') : type === 'todo' ? setNewTodoItem('') : setNewMemoItem(''); }
  };
  const handleSaveAlert = () => {
    if (!newAlertMsg.trim() || !newAlertDate || !newAlertTime) return alert("Dati mancanti");
    if (editingAlertId) { setManualAlerts(p => p.map(a => a.id === editingAlertId ? { ...a, message: newAlertMsg, date: newAlertDate, time: newAlertTime, priority: newAlertPriority } : a)); setEditingAlertId(null); }
    else { setManualAlerts([{ id: crypto.randomUUID(), message: newAlertMsg, date: newAlertDate, time: newAlertTime, priority: newAlertPriority, completed: false }, ...manualAlerts]); }
    setNewAlertMsg(''); setNewAlertDate(''); setNewAlertTime(''); setIsAddingAlert(false);
  };

  const deleteAlert = (id: string) => {
    setManualAlerts(p => p.filter(a => a.id !== id));
  };

  // Stats
  const monthlyStats = useMemo(() => {
    const now = new Date();
    const current = transactions.filter(t => new Date(t.date).getMonth() === now.getMonth() && new Date(t.date).getFullYear() === now.getFullYear());
    const inc = current.filter(t => t.type === 'income').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const exp = current.filter(t => t.type === 'expense').reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    return { totalIncome: inc, totalExpense: exp, balance: inc - exp };
  }, [transactions]);

  const expenseChartData = useMemo(() => {
    const now = new Date();
    const currentExpenses = transactions.filter(t => t.type === 'expense' && new Date(t.date).getMonth() === now.getMonth());
    const total = currentExpenses.reduce((acc, t) => acc + Number(t.amount), 0);
    const grouped = currentExpenses.reduce((acc, t) => {
      const amount = Number(t.amount);
      acc[t.category] = (acc[t.category] || 0) + amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped).map(([name, value], index) => {
      const val = Number(value);
      return {
        name: String(name), // Force string to avoid [object Object]
        value: val,
        percentage: total > 0 ? ((val / total) * 100).toFixed(1) : '0',
        color: CHART_COLORS[index % CHART_COLORS.length]
      };
    }).sort((a, b) => b.value - a.value);
  }, [transactions]);

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return (
        <>
          <WeatherWidget />
          <div className="space-y-2">
            <h3 className="font-bold text-white mb-2">Recenti</h3>
            {transactions.slice(0, 10).map(t => (
              <SwipeableItem key={t.id} onSwipeLeft={() => handleDeleteTrans(t.id)} onSwipeRight={() => { setEditingTransaction(t); setIsAddModalOpen(true); }} rightLabel="Modifica" rightIcon={<Edit2 size={24} />}>
                <div className="flex items-center justify-between p-4 h-[70px]">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${t.type === 'expense' ? 'bg-red-950/40 text-red-400' : 'bg-emerald-950/40 text-emerald-400'}`}>{t.type === 'expense' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}</div>
                    <div><p className="font-medium text-slate-200 text-sm">{String(t.description)}</p><p className="text-[10px] text-slate-500 capitalize">{String(t.category)}</p></div>
                  </div>
                  <span className={`font-bold ${t.type === 'expense' ? 'text-red-400' : 'text-emerald-400'}`}>{t.type === 'expense' ? '-' : '+'}€{(Number(t.amount) || 0).toFixed(2)}</span>
                </div>
              </SwipeableItem>
            ))}
            {transactions.length === 0 && <p className="text-center text-slate-600 text-sm py-4">Nessuna transazione</p>}
          </div>
        </>
      );
      case 'shopping': return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-white flex items-center gap-2"><ShoppingCart size={20} className="text-emerald-400" /> Lista Spesa</h3>
            <button onClick={() => setIsShareModalOpen(true)} className="p-2 bg-slate-800 rounded-full text-indigo-400"><Share2 size={18} /></button>
          </div>
          <div className="flex gap-2 mb-4">
            <input ref={shoppingInputRef} value={newShoppingItem} onChange={e => setNewShoppingItem(e.target.value)} placeholder="Prodotto..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none" onKeyDown={e => e.key === 'Enter' && handleAddList('shopping', newShoppingItem)} />
            <VoiceInput onResult={setNewShoppingItem} />
            <button onClick={() => handleAddList('shopping', newShoppingItem)} className={`text-white p-2 rounded-lg ${editingListItemId ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              {editingListItemId ? <Save size={20} /> : <Plus size={20} />}
            </button>
          </div>
          {shoppingList.map(i => (
            <SwipeableItem key={i.id} onSwipeLeft={() => deleteList('shopping', i.id)} onSwipeRight={() => startEditingList('shopping', i)}>
              <div className="flex items-center gap-3 p-4 h-[60px]">
                <button onClick={(e) => { e.stopPropagation(); toggleList('shopping', i.id); }} className="focus:outline-none">{i.completed ? <CheckCircle2 className="text-emerald-500" size={24} /> : <Circle className="text-slate-500" size={24} />}</button>
                <span className={i.completed ? 'line-through text-slate-500' : 'text-white'}>{String(i.text)}</span>
              </div>
            </SwipeableItem>
          ))}
        </div>
      );
      case 'doit': return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <h3 className="font-bold text-white mb-4 flex items-center gap-2"><ListTodo size={20} className="text-indigo-400" /> Cose da fare</h3>
          <div className="flex gap-2 mb-4">
            <input ref={todoInputRef} value={newTodoItem} onChange={e => setNewTodoItem(e.target.value)} placeholder="Attività..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none" onKeyDown={e => e.key === 'Enter' && handleAddList('todo', newTodoItem)} />
            <VoiceInput onResult={setNewTodoItem} />
            <button onClick={() => handleAddList('todo', newTodoItem)} className={`text-white p-2 rounded-lg ${editingListItemId ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              {editingListItemId ? <Save size={20} /> : <Plus size={20} />}
            </button>
          </div>
          {todoList.map(i => (
            <SwipeableItem key={i.id} onSwipeLeft={() => deleteList('todo', i.id)} onSwipeRight={() => startEditingList('todo', i)}>
              <ExpandableTodoItem item={i} onToggle={() => toggleList('todo', i.id)} />
            </SwipeableItem>
          ))}
        </div>
      );
      case 'memos': return (
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="flex gap-2 mb-4">
            <input ref={memoInputRef} value={newMemoItem} onChange={e => setNewMemoItem(e.target.value)} placeholder="Nota..." className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white outline-none" onKeyDown={e => e.key === 'Enter' && handleAddList('memo', newMemoItem)} />
            <VoiceInput onResult={setNewMemoItem} />
            <button onClick={() => handleAddList('memo', newMemoItem)} className={`text-white p-2 rounded-lg ${editingListItemId ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
              {editingListItemId ? <Save size={20} /> : <Plus size={20} />}
            </button>
          </div>
          {memos.map(i => (
            <SwipeableItem key={i.id} onSwipeLeft={() => deleteList('memo', i.id)} onSwipeRight={() => startEditingList('memo', i)}>
              <div className="p-4"><p className="text-white text-sm">{String(i.text)}</p></div>
            </SwipeableItem>
          ))}
        </div>
      );
      case 'alerts': return (
        <div className="space-y-4">
          {monthlyStats.balance < 0 && (
            <div className="bg-slate-900/80 p-4 rounded-xl border-l-4 border-red-500 shadow-sm flex items-start gap-3">
              <AlertTriangle className="text-red-500 shrink-0" size={20} />
              <div><h4 className="font-bold text-red-200 text-sm">Saldo Negativo!</h4></div>
            </div>
          )}
          <div className="flex items-center justify-between mt-6 mb-2">
            <h3 className="font-bold text-white flex gap-2"><Bell className="text-yellow-400" /> Promemoria</h3>
            <button onClick={() => setIsAddingAlert(!isAddingAlert)} className="p-2 rounded-full bg-slate-800 text-slate-400"><Plus size={20} /></button>
          </div>
          {isAddingAlert && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4 space-y-3">
              <div className="flex gap-2">
                <input value={newAlertMsg} onChange={e => setNewAlertMsg(e.target.value)} placeholder="Messaggio..." className="flex-1 bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
                <VoiceInput onResult={setNewAlertMsg} />
              </div>
              <div className="flex gap-2">
                <input type="date" value={newAlertDate} onChange={e => setNewAlertDate(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
                <input type="time" value={newAlertTime} onChange={e => setNewAlertTime(e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white" />
              </div>
              <button onClick={handleSaveAlert} className="w-full bg-indigo-600 text-white py-2 rounded-lg">Salva</button>
            </div>
          )}
          {manualAlerts.map(a => (
            <div key={a.id} className="bg-slate-900/40 p-4 rounded-xl border-l-4 border-indigo-500">
              <div className="flex justify-between"><span className="text-white text-sm">{a.message}</span><button onClick={() => deleteAlert(a.id)}><Trash2 size={16} className="text-slate-500" /></button></div>
              <div className="text-[10px] text-slate-400 mt-1">{a.date} {a.time}</div>
            </div>
          ))}
        </div>
      );
      case 'reports': return (
        <div className="space-y-6">
          <section className="bg-indigo-950/30 p-4 rounded-xl border border-indigo-500/20 relative">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 text-indigo-200 font-bold"><Sparkles size={16} /><span>AI Advisor</span></div>
              <button onClick={async () => { setIsLoadingAi(true); setAiAdvice(await getFinancialAdvice(transactions, 'Generale')); setIsLoadingAi(false); }} disabled={isLoadingAi} className="text-[10px] bg-indigo-600 px-2 py-1 rounded text-white">{isLoadingAi ? '...' : 'Analizza'}</button>
            </div>
            <p className="text-xs text-indigo-100/80 leading-relaxed whitespace-pre-line">{String(aiAdvice || "Tocca Analizza per ricevere consigli.")}</p>
          </section>
          <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
            <h3 className="font-bold text-white mb-4 flex items-center gap-2"><PieChartIcon size={20} className="text-indigo-400" /> Categorie</h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {expenseChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      );
    }
  };

  if (!isConfigured) {
    return <SetupWizard onComplete={() => setIsConfigured(true)} />;
  }

  return (
    <div className="min-h-[100dvh] bg-slate-950 text-slate-200 pb-32 font-sans">
      <ErrorBoundary>
        <div className="max-w-lg mx-auto bg-slate-950 min-h-[100dvh] relative shadow-2xl">
          <header className="px-6 pt-12 pb-6 bg-gradient-to-b from-indigo-950/20 to-slate-950">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h1 className="text-2xl font-black text-indigo-400">SpeseSmart</h1>
                {currentUser && <p className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">{currentUser.id === 'demo' ? <User size={10} /> : <Cloud size={10} />} {currentUser.email}</p>}
              </div>
              <button onClick={() => setIsSettingsOpen(true)} className="bg-slate-900 p-2 rounded-full border border-slate-800 text-slate-400 hover:text-white"><Settings size={20} /></button>
            </div>
            {activeTab === 'home' && (
              <div className="flex gap-2 mb-2 animate-fade-in">
                <StatsCard label="Entrate" amount={monthlyStats.totalIncome} type="income" />
                <StatsCard label="Uscite" amount={monthlyStats.totalExpense} type="expense" />
                <StatsCard label="Saldo" amount={monthlyStats.balance} type="balance" onClick={() => setIsBalanceHidden(!isBalanceHidden)} isHidden={isBalanceHidden} />
              </div>
            )}
          </header>

          <main className="px-4 space-y-6">{renderContent()}</main>

          {activeTab === 'home' && (
            <div className="fixed bottom-24 right-4 z-50 animate-slide-up">
              <button onClick={() => { setEditingTransaction(null); setIsAddModalOpen(true); }} className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:scale-105 transition-all"><Plus size={28} /></button>
            </div>
          )}

          <nav className="fixed bottom-0 left-0 right-0 bg-[#0E1629]/95 backdrop-blur-xl border-t border-slate-800 pb-[env(safe-area-inset-bottom)] z-40 max-w-lg mx-auto">
            <div className="flex justify-around items-center h-16">
              {[
                { id: 'home', icon: Wallet, l: 'Wallet' }, { id: 'shopping', icon: ShoppingCart, l: 'Spesa' },
                { id: 'doit', icon: ListTodo, l: 'Do It' }, { id: 'memos', icon: StickyNote, l: 'Memo' },
                { id: 'alerts', icon: Bell, l: 'Avvisi' }, { id: 'reports', icon: PieChartIcon, l: 'Grafico' }
              ].map(i => (
                <button key={i.id} onClick={() => setActiveTab(i.id as any)} className={`flex flex-col items-center justify-center w-14 ${activeTab === i.id ? 'text-indigo-400' : 'text-slate-500'}`}>
                  <i.icon size={22} className={activeTab === i.id ? 'fill-indigo-400/20' : ''} /><span className="text-[9px] font-bold mt-1">{i.l}</span>
                </button>
              ))}
            </div>
          </nav>

          <ShareListModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} items={shoppingList} />
          <AddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onSave={handleSaveTrans} initialData={editingTransaction} expenseCategories={expenseCategories} incomeCategories={incomeCategories} onAddCategory={(c: string, t: any) => t === 'expense' ? setExpenseCategories([...expenseCategories, c]) : setIncomeCategories([...incomeCategories, c])} />
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onClearData={handleClearData}
            userName={userName} setUserName={setUserName}
            notificationsEnabled={notificationsEnabled} setNotificationsEnabled={setNotificationsEnabled}
            startUpTab={startUpTab} setStartUpTab={setStartUpTab}
            onSaveSettings={handleSaveSettings}
            alarmVolume={alarmVolume} setAlarmVolume={setAlarmVolume}
            onLogin={handleSupabaseAuth} onResetPassword={handleResetPassword} currentUser={currentUser} onLogout={handleLogout}
            onDemoLogin={handleDemoLogin}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onResetConfig={handleResetConfig}
          />
        </div>
      </ErrorBoundary>
    </div>
  );
};

let rootElement = document.getElementById('root');
if (!rootElement) { rootElement = document.createElement('div'); rootElement.id = 'root'; document.body.appendChild(rootElement); }
if (rootElement) rootElement.innerHTML = '<div style="color:white; padding:20px;">Caricamento in corso...</div>';

try {
  const root = createRoot(rootElement!);
  root.render(<App />);
} catch (err: any) {
  console.error("Critical Render Error:", err);
  if (rootElement) {
    rootElement.innerHTML = `<div style="color:white; background:red; padding: 20px; font-family: sans-serif;">
      <h2>Errore di Avvio App</h2>
      <pre>${err?.message || String(err)}</pre>
    </div>`;
  }
}