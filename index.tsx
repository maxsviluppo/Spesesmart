import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
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
  Save,
  ListTodo,
  CheckSquare,
  Square,
  FileText,
  ChevronDown,
  ChevronUp,
  Mail,
  RotateCcw,
  ShoppingCart,
  ShoppingBag,
  Bell,
  Clock,
  AlertCircle
} from 'lucide-react';
import { 
  PieChart as RePieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Sector,
  Tooltip
} from 'recharts';
import { GoogleGenAI } from "@google/genai";

// --- TYPES ---
export type TransactionType = 'expense' | 'income';
export type PriorityLevel = 'high' | 'medium' | 'low';

export interface Transaction {
  id: string;
  amount: number;
  description: string;
  category: string;
  note?: string; 
  date: string; // ISO string
  type: TransactionType;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface ShoppingItem {
  id: string;
  name: string;
  category: string;
  completed: boolean;
}

export interface Alert {
  id: string;
  title: string;
  datetime: string; // ISO String containing date and time
  priority: PriorityLevel;
  notified: boolean; // To prevent double notifications
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

export const DEFAULT_SHOPPING_CATEGORIES = [
  'Frutta & Verdura',
  'Alimentari',
  'Bevande',
  'Casa & Igiene',
  'Surgelati',
  'Altro'
];

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

// --- SOUND UTILS ---
const playNotificationSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {
    console.error("Audio playback failed", e);
  }
};

// --- GEMINI SERVICE ---
const apiKey = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const getFinancialAdvice = async (transactions: Transaction[], month: string) => {
  if (!ai) {
    return "API Key mancante. Configura le variabili d'ambiente per usare l'AI.";
  }

  if (transactions.length === 0) {
    return "Non ci sono abbastanza dati per generare un'analisi questo mese. Aggiungi alcune spese!";
  }

  const summary = transactions.map(t => 
    `- ${t.date.split('T')[0]}: ${t.type === 'expense' ? 'Spesa' : 'Entrata'} di €${t.amount} per ${t.description} (${t.category}). Note: ${t.note || 'nessuna'}`
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

// --- COMPONENT: SwipeableItemWrapper ---
// Abstracting Swipe Logic for reuse
interface SwipeableProps {
  children: (currentX: number) => React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  onUndo: () => void;
  isDeleting: boolean;
  isConfirmingDelete: boolean;
  heightClass?: string;
}

// ... We are keeping individual implementations for now to maintain the specific rendering logic of each item type
// but utilizing shared patterns.

// --- COMPONENT: TransactionItem ---
interface TransactionItemProps {
  transaction: Transaction;
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  isFirst?: boolean;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onDelete, onEdit, isFirst = false }) => {
  const isExpense = transaction.type === 'expense';
  const hasNote = !!transaction.note && transaction.note.trim().length > 0;
  
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const SWIPE_THRESHOLD = 70; 
  const DELETE_THRESHOLD = 150;
  const MAX_SWIPE_RIGHT = 100;

  useEffect(() => {
    return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); };
  }, []);

  useEffect(() => {
    if (!isFirst || isDeleting || isConfirmingDelete || isExpanded) return;
    const interval = setInterval(() => {
      if (isDragging || isDeleting || isConfirmingDelete || isExpanded) return; 
      setCurrentX(-40);
      setTimeout(() => { if (!isDragging && !isDeleting && !isConfirmingDelete) setCurrentX(40); }, 400);
      setTimeout(() => { if (!isDragging && !isDeleting && !isConfirmingDelete) setCurrentX(0); }, 800);
    }, 5000);
    return () => clearInterval(interval);
  }, [isFirst, isDragging, isDeleting, isConfirmingDelete, isExpanded]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isConfirmingDelete || isExpanded) return;
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX === null || isDeleting || isConfirmingDelete || isExpanded) return;
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
    if (isConfirmingDelete || isExpanded) return;
    setStartX(e.clientX);
    setIsDragging(true);
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || startX === null || isDeleting || isConfirmingDelete || isExpanded) return;
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
      handleStartDeleteSequence();
    } else {
      setCurrentX(0);
    }
    setStartX(null);
  };

  const handleStartDeleteSequence = () => {
      if (navigator.vibrate) navigator.vibrate(50);
      setIsConfirmingDelete(true);
      setCurrentX(0);
      deleteTimerRef.current = setTimeout(() => performFinalDelete(), 3000);
  };

  const performFinalDelete = () => {
      setIsDeleting(true);
      setTimeout(() => onDelete(transaction.id), 300);
  };

  const handleUndo = () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
      setIsConfirmingDelete(false);
      setCurrentX(0);
  };

  const handleDoubleClick = () => {
    if (isDragging || isDeleting || isConfirmingDelete) return;
    setIsExpanded(!isExpanded);
  };

  const getSwipeBackground = () => {
    if (currentX > 0) return 'bg-indigo-600';
    if (currentX < 0) return 'bg-red-600';
    return 'bg-slate-900';
  };

  if (isDeleting) {
      return <div className="h-[88px] mb-3 w-full bg-transparent transition-all duration-300 opacity-0 transform -translate-x-full"></div>;
  }

  if (isConfirmingDelete) {
    return (
      <div className="relative mb-3 h-[88px] w-full bg-red-950/40 border border-red-900/50 rounded-xl flex items-center justify-between px-6 animate-fade-in overflow-hidden">
        <div className="absolute bottom-0 left-0 h-1 bg-red-600/50 w-full animate-[shrink_3s_linear_forwards] origin-left" style={{ animationName: 'shrinkWidth' }}></div>
        <style>{`@keyframes shrinkWidth { from { width: 100%; } to { width: 0%; } }`}</style>
        <div className="flex items-center gap-2 text-red-400">
           <Trash2 size={20} />
           <span className="font-medium text-sm">Eliminato</span>
        </div>
        <button onClick={handleUndo} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm border border-slate-700 transition-colors z-10">
          <RotateCcw size={16} />
          Annulla
        </button>
      </div>
    );
  }

  return (
    <div 
      className={`relative mb-3 w-full ${isExpanded ? 'h-auto min-h-[88px]' : 'h-[88px]'} overflow-hidden rounded-xl select-none touch-pan-y transition-all duration-300`}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onDoubleClick={handleDoubleClick}
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
        className={`relative h-full bg-slate-900 flex flex-col justify-center border border-slate-800 rounded-xl transition-transform ease-out overflow-hidden`}
        style={{ 
          transform: `translateX(${currentX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' 
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseDown}
      >
        <div className="flex items-center justify-between p-4 h-[88px]">
          <div className="flex items-center gap-3 pointer-events-none">
            <div className={`p-2 rounded-full ${isExpense ? 'bg-red-950/30 text-red-400' : 'bg-emerald-950/30 text-emerald-400'}`}>
              {isExpense ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
            </div>
            <div>
              <p className="font-medium text-slate-200">{transaction.description}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-slate-500 capitalize">{transaction.category} • {new Date(transaction.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-1 pointer-events-none">
            <span className={`font-bold ${isExpense ? 'text-red-400' : 'text-emerald-400'}`}>
              {isExpense ? '-' : '+'}€{transaction.amount.toFixed(2)}
            </span>
            {hasNote && (
               <div className="text-indigo-400">
                 <FileText size={14} />
               </div>
            )}
          </div>
        </div>

        {isExpanded && (
          <div 
            className="w-full bg-slate-950/50 border-t border-slate-800 p-4 animate-fade-in cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(false);
            }}
          >
             <div className="flex items-start gap-2 mb-2">
                <FileText size={14} className="text-slate-500 mt-0.5" />
                <span className="text-[10px] uppercase font-bold text-slate-500">Nota</span>
             </div>
             <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
               {transaction.note ? transaction.note : <span className="text-slate-600 italic">Nessuna nota inserita.</span>}
             </p>
             <div className="mt-3 flex justify-center">
                <span className="text-[10px] text-slate-600 uppercase font-bold tracking-wider">Tocca per chiudere</span>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- COMPONENT: AlertItem ---
interface AlertItemProps {
  alert: Alert;
  onDelete: (id: string) => void;
  onEdit: (alert: Alert) => void;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onDelete, onEdit }) => {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alertDate = new Date(alert.datetime);
  const isExpired = new Date() > alertDate;

  useEffect(() => { return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }; }, []);

  // Swipe handlers reused logic (simplified copy for brevity, idealy abstracted)
  const SWIPE_THRESHOLD = 70; const DELETE_THRESHOLD = 150; const MAX_SWIPE_RIGHT = 100;
  const handleTouchStart = (e: React.TouchEvent) => { if (isConfirmingDelete) return; setStartX(e.touches[0].clientX); setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => { if (startX === null || isDeleting || isConfirmingDelete) return; const x = e.touches[0].clientX; const diff = x - startX; if (diff > MAX_SWIPE_RIGHT) setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2); else setCurrentX(diff); };
  const handleTouchEnd = () => handleSwipeEnd();
  const handleMouseDown = (e: React.MouseEvent) => { if (isConfirmingDelete) return; setStartX(e.clientX); setIsDragging(true); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging || startX === null || isDeleting || isConfirmingDelete) return; e.preventDefault(); const x = e.clientX; const diff = x - startX; if (diff > MAX_SWIPE_RIGHT) setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2); else setCurrentX(diff); };
  const handleMouseUp = () => handleSwipeEnd();
  const handleMouseLeave = () => { if (isDragging) handleSwipeEnd(); };
  const handleSwipeEnd = () => { setIsDragging(false); if (currentX > SWIPE_THRESHOLD) { onEdit(alert); setCurrentX(0); } else if (currentX < -DELETE_THRESHOLD) { handleStartDeleteSequence(); } else { setCurrentX(0); } setStartX(null); };
  const handleStartDeleteSequence = () => { if (navigator.vibrate) navigator.vibrate(50); setIsConfirmingDelete(true); setCurrentX(0); deleteTimerRef.current = setTimeout(() => { setIsDeleting(true); setTimeout(() => onDelete(alert.id), 300); }, 3000); };
  const handleUndo = () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); setIsConfirmingDelete(false); setCurrentX(0); };
  const getSwipeBackground = () => { if (currentX > 0) return 'bg-indigo-600'; if (currentX < 0) return 'bg-red-600'; return 'bg-slate-900'; };

  if (isDeleting) return <div className="h-[88px] mb-3 w-full bg-transparent transition-all duration-300 opacity-0 transform -translate-x-full"></div>;
  if (isConfirmingDelete) return ( <div className="relative mb-3 h-[88px] w-full bg-red-950/40 border border-red-900/50 rounded-xl flex items-center justify-between px-6 animate-fade-in overflow-hidden"> <div className="absolute bottom-0 left-0 h-1 bg-red-600/50 w-full animate-[shrink_3s_linear_forwards]" style={{ animationName: 'shrinkWidth' }}></div> <style>{`@keyframes shrinkWidth { from { width: 100%; } to { width: 0%; } }`}</style> <div className="flex items-center gap-2 text-red-400"> <Trash2 size={20} /> <span className="font-medium text-sm">Eliminato</span> </div> <button onClick={handleUndo} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm border border-slate-700 transition-colors z-10"> <RotateCcw size={16} /> Annulla </button> </div> );

  // Priority Color Logic
  const getPriorityColor = () => {
    switch (alert.priority) {
      case 'high': return 'border-l-red-500';
      case 'medium': return 'border-l-orange-500';
      case 'low': return 'border-l-emerald-500';
      default: return 'border-l-slate-500';
    }
  };

  return (
    <div 
      className="relative mb-3 h-[88px] w-full overflow-hidden rounded-xl select-none touch-pan-y"
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      style={{ touchAction: 'pan-y' }}
    >
      <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors ${getSwipeBackground()}`}>
        <div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX > 30 ? 1 : 0 }}>
          <Edit2 size={24} /> <span>Modifica</span>
        </div>
        <div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX < -30 ? 1 : 0 }}>
          <span>Elimina</span> <Trash2 size={24} />
        </div>
      </div>

      <div 
        className={`relative h-full bg-slate-900 flex items-center justify-between p-4 border border-slate-800 rounded-xl transition-transform ease-out border-l-4 ${getPriorityColor()}`}
        style={{ 
          transform: `translateX(${currentX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' 
        }}
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
      >
        <div className="flex items-center gap-4 pointer-events-none w-full">
           <div className={`p-2 rounded-full ${isExpired ? 'bg-red-950/40 text-red-500 animate-pulse' : 'bg-slate-800 text-slate-400'}`}>
              <Bell size={20} />
           </div>
           <div className="flex-1 min-w-0">
             <div className="flex justify-between items-start">
               <p className={`font-medium truncate ${isExpired ? 'text-red-400' : 'text-slate-200'}`}>{alert.title}</p>
               {isExpired && <span className="text-[10px] font-bold bg-red-900/50 text-red-300 px-2 py-0.5 rounded ml-2">SCADUTO</span>}
             </div>
             <div className="flex items-center gap-2 mt-1">
               <Clock size={12} className="text-slate-500" />
               <p className="text-xs text-slate-500">
                 {alertDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
                 <span className="mx-1">•</span>
                 {alertDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
               </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: AlertModal ---
interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (title: string, datetime: string, priority: PriorityLevel, id?: string) => void;
  initialData?: Alert | null;
}

const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, onSave, initialData }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('medium');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setTitle(initialData.title);
        const d = new Date(initialData.datetime);
        setDate(d.toISOString().split('T')[0]);
        setTime(d.toTimeString().substring(0, 5));
        setPriority(initialData.priority);
      } else {
        setTitle('');
        const now = new Date();
        setDate(now.toISOString().split('T')[0]);
        // Set default time to next hour
        now.setHours(now.getHours() + 1);
        now.setMinutes(0);
        setTime(now.toTimeString().substring(0, 5));
        setPriority('medium');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !date || !time) return;
    const datetime = new Date(`${date}T${time}`).toISOString();
    onSave(title, datetime, priority, initialData?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-slide-up">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-100">{initialData ? 'Modifica Avviso' : 'Nuovo Avviso'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={24} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Titolo</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Es. Pagare bolletta" className="w-full text-xl font-bold text-slate-100 placeholder-slate-700 outline-none border-b border-slate-700 focus:border-indigo-500 pb-2 bg-transparent" autoFocus required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Data</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 outline-none focus:border-indigo-500" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Ora</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 outline-none focus:border-indigo-500" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Priorità</label>
            <div className="flex gap-2">
              {[
                { val: 'high', label: 'Alta', color: 'bg-red-500', border: 'border-red-500', text: 'text-red-500' },
                { val: 'medium', label: 'Media', color: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-500' },
                { val: 'low', label: 'Bassa', color: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-500' }
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setPriority(opt.val as PriorityLevel)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-bold transition-all ${priority === opt.val ? `${opt.color} text-white ${opt.border}` : `bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-600`}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 transition-all flex justify-center gap-2">
            {initialData ? <Save size={20} /> : <Check size={20} />} {initialData ? 'Aggiorna' : 'Salva'}
          </button>
        </form>
      </div>
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

  // State Tasks (Do It)
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('spesesmart_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [newTaskText, setNewTaskText] = useState('');

  // State Shopping List
  const [shoppingItems, setShoppingItems] = useState<ShoppingItem[]>(() => {
    const saved = localStorage.getItem('spesesmart_shopping');
    return saved ? JSON.parse(saved) : [];
  });
  const [shoppingCategories, setShoppingCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('spesesmart_shopping_categories');
    return saved ? JSON.parse(saved) : DEFAULT_SHOPPING_CATEGORIES;
  });

  // State Alerts
  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const saved = localStorage.getItem('spesesmart_alerts');
    return saved ? JSON.parse(saved) : [];
  });
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);

  const [isShoppingModalOpen, setIsShoppingModalOpen] = useState(false);
  const [editingShoppingItem, setEditingShoppingItem] = useState<ShoppingItem | null>(null);
  const [selectedShoppingCategory, setSelectedShoppingCategory] = useState('Tutte');

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
  const [activeTab, setActiveTab] = useState<'home' | 'reports' | 'doit' | 'shopping' | 'alerts'>('home');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string>('Tutte');
  const [activeIndex, setActiveIndex] = useState(0);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  // Persistence
  useEffect(() => { localStorage.setItem('spesesmart_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('spesesmart_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('spesesmart_shopping', JSON.stringify(shoppingItems)); }, [shoppingItems]);
  useEffect(() => { localStorage.setItem('spesesmart_shopping_categories', JSON.stringify(shoppingCategories)); }, [shoppingCategories]);
  useEffect(() => { localStorage.setItem('spesesmart_expense_categories', JSON.stringify(expenseCategories)); }, [expenseCategories]);
  useEffect(() => { localStorage.setItem('spesesmart_income_categories', JSON.stringify(incomeCategories)); }, [incomeCategories]);
  useEffect(() => { localStorage.setItem('spesesmart_alerts', JSON.stringify(alerts)); }, [alerts]);

  // Notifications Logic
  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    const interval = setInterval(() => {
      const now = new Date();
      setAlerts(prev => {
        let hasChanges = false;
        const newAlerts = prev.map(a => {
          if (!a.notified && new Date(a.datetime) <= now) {
            hasChanges = true;
            // Trigger Notification
            playNotificationSound();
            if (Notification.permission === 'granted') {
              new Notification("Avviso Scaduto: " + a.title, { body: "Priorità: " + a.priority });
            }
            return { ...a, notified: true };
          }
          return a;
        });
        return hasChanges ? newAlerts : prev;
      });
    }, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, []);

  // Derived Data
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(t => {
      const tDate = new Date(t.date);
      return tDate.getMonth() === currentDate.getMonth() && 
             tDate.getFullYear() === currentDate.getFullYear();
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, currentDate]);

  const displayedTransactions = useMemo(() => {
    if (selectedCategory === 'Tutte') return monthlyTransactions;
    return monthlyTransactions.filter(t => t.category === selectedCategory);
  }, [monthlyTransactions, selectedCategory]);

  const allCategories = useMemo(() => {
    const categories = new Set([...expenseCategories, ...incomeCategories]);
    return ['Tutte', ...Array.from(categories).sort()];
  }, [expenseCategories, incomeCategories]);

  const displayedShoppingItems = useMemo(() => {
    let items = shoppingItems;
    if (selectedShoppingCategory !== 'Tutte') items = items.filter(i => i.category === selectedShoppingCategory);
    return items.sort((a, b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1));
  }, [shoppingItems, selectedShoppingCategory]);

  const allShoppingCategories = useMemo(() => ['Tutte', ...shoppingCategories], [shoppingCategories]);

  const sortedAlerts = useMemo(() => {
    return [...alerts].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  }, [alerts]);

  const stats: MonthlyStats = useMemo(() => {
    return monthlyTransactions.reduce((acc, curr) => {
      if (curr.type === 'income') { acc.totalIncome += curr.amount; acc.balance += curr.amount; } 
      else { acc.totalExpense += curr.amount; acc.balance -= curr.amount; }
      return acc;
    }, { totalIncome: 0, totalExpense: 0, balance: 0 });
  }, [monthlyTransactions]);

  const categoryData = useMemo(() => {
    const data: Record<string, number> = {};
    monthlyTransactions.filter(t => t.type === 'expense').forEach(t => { data[t.category] = (data[t.category] || 0) + t.amount; });
    return Object.entries(data).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthlyTransactions]);

  // Handlers
  const handleSaveTransaction = (amount: number, description: string, category: string, type: TransactionType, note: string, id?: string) => {
    if (id) {
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, amount, description, category, type, note } : t));
    } else {
      setTransactions(prev => [{ id: crypto.randomUUID(), amount, description, category, type, note, date: new Date().toISOString() }, ...prev]);
    }
  };

  const handleSaveAlert = (title: string, datetime: string, priority: PriorityLevel, id?: string) => {
    if (id) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, title, datetime, priority } : a));
    } else {
      setAlerts(prev => [...prev, { id: crypto.randomUUID(), title, datetime, priority, notified: false }]);
    }
  };

  const handleDeleteAlert = (id: string) => setAlerts(prev => prev.filter(a => a.id !== id));
  const handleEditAlert = (alert: Alert) => { setEditingAlert(alert); setIsAlertModalOpen(true); };
  const handleOpenAlertModal = () => { setEditingAlert(null); setIsAlertModalOpen(true); };

  const handleAddCategory = (newCategory: string, type: TransactionType) => {
    if (type === 'expense') { if (!expenseCategories.includes(newCategory)) setExpenseCategories(prev => [...prev, newCategory]); }
    else { if (!incomeCategories.includes(newCategory)) setIncomeCategories(prev => [...prev, newCategory]); }
  };

  const handleEdit = (transaction: Transaction) => { setEditingTransaction(transaction); setIsModalOpen(true); };
  const handleOpenAddModal = () => { setEditingTransaction(null); setIsModalOpen(true); };
  const handleDelete = (id: string) => { setTransactions(prev => prev.filter(t => t.id !== id)); };
  
  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate); newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate); setAiAdvice(null); setSelectedCategory('Tutte');
  };
  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [year, month] = e.target.value.split('-');
      setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, 1));
      setAiAdvice(null); setSelectedCategory('Tutte');
    }
  };
  const handleAiAnalysis = async () => {
    setLoadingAi(true);
    const monthName = currentDate.toLocaleString('it-IT', { month: 'long', year: 'numeric' });
    const advice = await getFinancialAdvice(monthlyTransactions, monthName);
    setAiAdvice(advice); setLoadingAi(false);
  };
  const onPieEnter = (_: any, index: number) => setActiveIndex(index);
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault(); if (!newTaskText.trim()) return;
    setTasks(prev => [{ id: crypto.randomUUID(), text: newTaskText.trim(), completed: false, createdAt: Date.now() }, ...prev]);
    setNewTaskText('');
  };
  const handleToggleTask = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const handleDeleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
  const handleSaveShoppingItem = (name: string, category: string, id?: string) => {
    if (id) { setShoppingItems(prev => prev.map(i => i.id === id ? { ...i, name, category } : i)); }
    else { setShoppingItems(prev => [{ id: crypto.randomUUID(), name, category, completed: false }, ...prev]); }
  };
  const handleAddShoppingCategory = (newCategory: string) => { if (!shoppingCategories.includes(newCategory)) setShoppingCategories(prev => [...prev, newCategory]); };
  const handleToggleShoppingItem = (id: string) => setShoppingItems(prev => prev.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  const handleDeleteShoppingItem = (id: string) => setShoppingItems(prev => prev.filter(i => i.id !== id));
  const handleEditShoppingItem = (item: ShoppingItem) => { setEditingShoppingItem(item); setIsShoppingModalOpen(true); };
  const handleOpenShoppingModal = () => { setEditingShoppingItem(null); setIsShoppingModalOpen(true); };

  // Render Logic
  const currentMonthValue = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value } = props;
    return (
      <g>
        <text x={cx} y={cy - 12} dy={8} textAnchor="middle" fill="#94a3b8" className="text-[10px] uppercase font-bold tracking-widest animate-fade-in">{payload.name.length > 12 ? payload.name.substring(0, 10) + '..' : payload.name}</text>
        <text x={cx} y={cy + 12} dy={8} textAnchor="middle" fill="#f8fafc" className="text-xl font-black animate-fade-in">€{value.toLocaleString()}</text>
        <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 12} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="#020617" strokeWidth={4} cornerRadius={6} className="transition-all duration-300 ease-out" style={{ filter: `drop-shadow(0px 0px 6px ${fill}80)` }} />
        <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle} innerRadius={outerRadius + 18} outerRadius={outerRadius + 20} fill={fill} cornerRadius={10} opacity={0.4} />
      </g>
    );
  };
  const COLORS = ['#818cf8', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#22d3ee', '#fb7185', '#e879f9'];

  return (
    <div className="min-h-screen pb-24 max-w-lg mx-auto bg-slate-950 border-x border-slate-800 shadow-2xl overflow-hidden relative text-slate-200">
      <header className="bg-slate-950/90 backdrop-blur-xl px-6 py-5 sticky top-0 z-30 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 ring-1 ring-white/10"><Wallet size={20} strokeWidth={2.5} /></div>
          <div className="flex flex-col"><h1 className="text-lg font-bold text-white tracking-tight leading-tight">SpeseSmart</h1><span className="text-[10px] font-medium text-slate-500 tracking-wider uppercase">Wallet</span></div>
        </div>
        <div className="flex items-center bg-slate-900/80 rounded-full p-1 ring-1 ring-white/10 shadow-sm">
          <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
          <div className="relative px-3 h-8 flex items-center justify-center"><div className="flex items-baseline gap-1.5 text-sm"><span className="font-semibold text-white capitalize">{currentDate.toLocaleString('it-IT', { month: 'short' })}</span><span className="text-slate-500 font-medium text-xs">{currentDate.getFullYear()}</span></div><input type="month" value={currentMonthValue} onChange={handleDateSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" /></div>
          <button onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
        </div>
      </header>

      <main className="p-4 sm:p-6 space-y-6">
        {activeTab === 'home' && (
          <>
            <div className="flex gap-3"><StatsCard label="Entrate" amount={stats.totalIncome} type="income" /><StatsCard label="Uscite" amount={stats.totalExpense} type="expense" /></div>
            <div className="w-full"><div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm flex justify-between items-center"><div><p className="text-xs text-slate-500 uppercase font-bold tracking-wide">Saldo Attuale</p><p className={`text-3xl font-extrabold mt-1 ${stats.balance >= 0 ? 'text-indigo-400' : 'text-red-400'}`}>{stats.balance.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</p></div><div className="h-10 w-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500"><TrendingUp size={20} /></div></div></div>
            <div className="space-y-4">
             <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-slate-100">Transazioni</h2><span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-2 py-1 rounded-full">{displayedTransactions.length} mov.</span></div>
             <div className="sticky top-[80px] z-20 bg-slate-950/95 backdrop-blur py-2 flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                <div className="flex items-center justify-center min-w-[32px] h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500"><Filter size={14} /></div>
                {allCategories.map((cat) => ( <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600'}`}>{cat}</button> ))}
             </div>
             {displayedTransactions.length > 0 ? ( <div className="space-y-0"><div className="flex items-center gap-2 mb-2 px-2"><Info size={12} className="text-slate-600" /><span className="text-[10px] text-slate-600 uppercase tracking-wider">Doppio Clic: Note • Scorri: SX Elimina / DX Modifica</span></div>{displayedTransactions.map((t, index) => ( <TransactionItem key={t.id} transaction={t} onDelete={handleDelete} onEdit={handleEdit} isFirst={index === 0 && selectedCategory === 'Tutte'} /> ))}</div> ) : ( <div className="text-center py-12 opacity-50"><div className="bg-slate-900 border border-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3"><Plus size={32} className="text-slate-600" /></div><p className="text-slate-400">Nessuna transazione.</p></div> )}
          </div>
          </>
        )}

        {activeTab === 'doit' && (
          <div className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-100">Do It</h2><span className="text-xs text-indigo-400 font-bold bg-indigo-950/30 border border-indigo-900/50 px-3 py-1 rounded-full">{tasks.filter(t => t.completed).length}/{tasks.length} Completati</span></div>
             <form onSubmit={handleAddTask} className="relative group"><input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Aggiungi una nuova attività..." className="w-full bg-slate-900 border border-slate-800 text-slate-200 pl-4 pr-12 py-4 rounded-2xl outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all placeholder-slate-600" /><button type="submit" disabled={!newTaskText.trim()} className="absolute right-2 top-2 bottom-2 aspect-square bg-indigo-600 text-white rounded-xl flex items-center justify-center disabled:opacity-50 disabled:bg-slate-800 transition-all"><Plus size={20} /></button></form>
             <div className="space-y-3">
               <div className="flex items-center gap-2 mb-2 px-2"><Info size={12} className="text-slate-600" /><span className="text-[10px] text-slate-600 uppercase tracking-wider">Scorri verso SX per Eliminare</span></div>
               {tasks.length > 0 ? ( tasks.sort((a,b) => (a.completed === b.completed ? 0 : a.completed ? 1 : -1)).map(task => ( <TaskItem key={task.id} task={task} onToggle={handleToggleTask} onDelete={handleDeleteTask} /> )) ) : ( <div className="text-center py-20 opacity-50 flex flex-col items-center"><div className="bg-slate-900 border border-slate-800 w-20 h-20 rounded-full flex items-center justify-center mb-4"><ListTodo size={32} className="text-slate-600" /></div><p className="text-slate-400">Nessuna attività in lista.</p></div> )}
             </div>
          </div>
        )}

        {activeTab === 'shopping' && (
           <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-slate-100">Lista Spesa</h2><span className="text-xs text-indigo-400 font-bold bg-indigo-950/30 border border-indigo-900/50 px-3 py-1 rounded-full">{shoppingItems.filter(i => i.completed).length}/{shoppingItems.length} Presi</span></div>
               <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"><div className="flex items-center justify-center min-w-[32px] h-8 rounded-full bg-slate-900 border border-slate-800 text-slate-500"><Filter size={14} /></div>{allShoppingCategories.map((cat) => ( <button key={cat} onClick={() => setSelectedShoppingCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedShoppingCategory === cat ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:border-slate-600'}`}>{cat}</button> ))}</div>
              <div className="space-y-0">{shoppingItems.length > 0 ? ( <> <div className="flex items-center gap-2 mb-2 px-2"><Info size={12} className="text-slate-600" /><span className="text-[10px] text-slate-600 uppercase tracking-wider">Tocca per spuntare • Scorri: SX Elimina / DX Modifica</span></div> {displayedShoppingItems.map(item => ( <ShoppingListItem key={item.id} item={item} onToggle={handleToggleShoppingItem} onDelete={handleDeleteShoppingItem} onEdit={handleEditShoppingItem} /> ))} </> ) : ( <div className="text-center py-20 opacity-50 flex flex-col items-center"><div className="bg-slate-900 border border-slate-800 w-20 h-20 rounded-full flex items-center justify-center mb-4"><ShoppingCart size={32} className="text-slate-600" /></div><p className="text-slate-400">Lista della spesa vuota.</p></div> )}</div>
           </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100">Avvisi & Scadenze</h2>
                <span className="text-xs text-indigo-400 font-bold bg-indigo-950/30 border border-indigo-900/50 px-3 py-1 rounded-full">{alerts.length} Attivi</span>
             </div>
             <div className="space-y-0">
               {sortedAlerts.length > 0 ? (
                 <>
                   <div className="flex items-center gap-2 mb-2 px-2">
                      <Info size={12} className="text-slate-600" />
                      <span className="text-[10px] text-slate-600 uppercase tracking-wider">Margine colorato indica priorità</span>
                   </div>
                   {sortedAlerts.map(alert => (
                     <AlertItem key={alert.id} alert={alert} onDelete={handleDeleteAlert} onEdit={handleEditAlert} />
                   ))}
                 </>
               ) : (
                 <div className="text-center py-20 opacity-50 flex flex-col items-center">
                    <div className="bg-slate-900 border border-slate-800 w-20 h-20 rounded-full flex items-center justify-center mb-4">
                      <Bell size={32} className="text-slate-600" />
                    </div>
                    <p className="text-slate-400">Nessun avviso programmato.</p>
                 </div>
               )}
             </div>
          </div>
        )}

        {activeTab === 'reports' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-800"><h3 className="font-bold text-slate-100 mb-6 flex items-center gap-2"><PieChart size={18} className="text-indigo-400" />Spese per Categoria</h3>
              {categoryData.length > 0 ? ( <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><RePieChart><Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none" onMouseEnter={onPieEnter} isAnimationActive={true} animationBegin={0} animationDuration={800} animationEasing="ease-out" {...{ activeIndex, activeShape: renderActiveShape } as any}>{categoryData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} /> ))}</Pie></RePieChart></ResponsiveContainer><div className="mt-4 grid grid-cols-2 gap-2">{categoryData.map((entry, index) => ( <div key={entry.name} className={`flex items-center gap-2 text-xs p-1 rounded transition-colors ${activeIndex === index ? 'bg-slate-800/50' : ''}`} onMouseEnter={() => setActiveIndex(index)}><div className="w-2 h-2 rounded-full shadow-sm shadow-black/50" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div><span className={`truncate flex-1 ${activeIndex === index ? 'text-white font-medium' : 'text-slate-400'}`}>{entry.name}</span><span className="font-bold text-slate-200">€{entry.value.toFixed(0)}</span></div> ))}</div></div> ) : ( <p className="text-center text-slate-600 py-10">Nessuna spesa da analizzare.</p> )}
            </div>
            <div className="bg-gradient-to-br from-indigo-900 to-purple-900 p-6 rounded-2xl text-white shadow-xl shadow-indigo-900/10 border border-indigo-800/30 relative overflow-hidden"><div className="absolute top-0 right-0 p-4 opacity-20"><Sparkles size={100} /></div><h3 className="font-bold text-lg mb-2 flex items-center gap-2 text-indigo-100"><Sparkles size={20} className="text-yellow-300" />AI Advisor</h3>{!aiAdvice ? ( <div className="relative z-10"><p className="text-indigo-200/80 text-sm mb-4">Ottieni un'analisi intelligente delle tue abitudini di spesa per questo mese.</p><button onClick={handleAiAnalysis} disabled={loadingAi} className="bg-white/10 hover:bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-sm font-semibold transition-all w-full border border-white/10 flex items-center justify-center gap-2 text-white">{loadingAi ? 'Analisi in corso...' : 'Genera Report AI'}</button></div> ) : ( <div className="relative z-10 animate-fade-in"><div className="text-sm leading-relaxed text-indigo-100 prose prose-invert prose-sm max-w-none"><div dangerouslySetInnerHTML={{ __html: aiAdvice.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') }} /></div><button onClick={() => setAiAdvice(null)} className="mt-4 text-xs text-indigo-300 hover:text-white underline">Chiudi analisi</button></div> )}</div>
          </div>
        )}

        <div className="pt-10 pb-4">
            <div className="relative py-6">
                <div className="absolute top-0 left-10 right-10 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50 shadow-[0_0_8px_rgba(99,102,241,1)]"></div>
                <div className="text-center space-y-3"><div><h3 className="text-xs font-black text-slate-300 tracking-[0.2em] uppercase">DevTools</h3><p className="text-[10px] font-medium text-indigo-400 tracking-widest uppercase mt-0.5">By Castro Massimo</p></div><p className="text-[10px] text-slate-500 leading-relaxed px-4 max-w-xs mx-auto">Questa App è realizzata da DevTools by Castro Massimo.<br/>Se hai bisogno di supporto, segnalazioni o di WebApp personalizzate contattaci.</p><a href="mailto:castromassimo@gmail.com" className="inline-flex items-center justify-center p-3 rounded-full bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-indigo-500 hover:bg-slate-800/50 hover:shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)] transition-all duration-300 group" aria-label="Invia Email"><Mail size={20} className="text-indigo-400 group-hover:text-indigo-300 transition-colors" /></a></div>
            </div>
        </div>
      </main>

      {/* FAB */}
      {activeTab !== 'doit' && (
        <button
          onClick={() => {
            if (activeTab === 'shopping') handleOpenShoppingModal();
            else if (activeTab === 'alerts') handleOpenAlertModal();
            else handleOpenAddModal();
          }}
          className="fixed bottom-24 right-4 sm:right-[calc(50%-240px+1rem)] bg-indigo-600 text-white p-4 rounded-full shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 active:scale-90 transition-all z-20"
          aria-label="Aggiungi"
        >
          <Plus size={28} />
        </button>
      )}

      {/* Modals */}
      <AddModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveTransaction} initialData={editingTransaction} expenseCategories={expenseCategories} incomeCategories={incomeCategories} onAddCategory={handleAddCategory} />
      <ShoppingModal isOpen={isShoppingModalOpen} onClose={() => setIsShoppingModalOpen(false)} onSave={handleSaveShoppingItem} initialData={editingShoppingItem} categories={shoppingCategories} onAddCategory={handleAddShoppingCategory} />
      <AlertModal isOpen={isAlertModalOpen} onClose={() => setIsAlertModalOpen(false)} onSave={handleSaveAlert} initialData={editingAlert} />

      {/* Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 pb-safe pt-2 px-4 h-20 sm:max-w-lg sm:mx-auto z-20">
        <div className="flex justify-between items-center h-full pb-2">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'home' ? 'text-indigo-400' : 'text-slate-600'}`}><Wallet size={20} /><span className="text-[9px] font-medium">Home</span></button>
          <button onClick={() => setActiveTab('shopping')} className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'shopping' ? 'text-indigo-400' : 'text-slate-600'}`}><ShoppingCart size={20} /><span className="text-[9px] font-medium">Spesa</span></button>
          <button onClick={() => setActiveTab('doit')} className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'doit' ? 'text-indigo-400' : 'text-slate-600'}`}><ListTodo size={20} /><span className="text-[9px] font-medium">Do It</span></button>
          <button onClick={() => setActiveTab('alerts')} className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'alerts' ? 'text-indigo-400' : 'text-slate-600'}`}><Bell size={20} /><span className="text-[9px] font-medium">Avvisi</span></button>
          <button onClick={() => setActiveTab('reports')} className={`flex flex-col items-center gap-1 transition-colors w-12 ${activeTab === 'reports' ? 'text-indigo-400' : 'text-slate-600'}`}><BarChart3 size={20} /><span className="text-[9px] font-medium">Report</span></button>
        </div>
      </nav>
    </div>
  );
}

// --- RESTORED COMPONENTS FOR COMPLETENESS (TaskItem, ShoppingListItem, StatsCard, ShoppingModal, AddModal) ---
// These are needed because we are outputting the full file.

const TaskItem: React.FC<{task: Task, onToggle: (id: string) => void, onDelete: (id: string) => void}> = ({ task, onToggle, onDelete }) => {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DELETE_THRESHOLD = 150;

  useEffect(() => { return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }; }, []);

  const handleTouchStart = (e: React.TouchEvent) => { if (isConfirmingDelete) return; setStartX(e.touches[0].clientX); setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => { if (startX === null || isDeleting || isConfirmingDelete) return; const diff = e.touches[0].clientX - startX; if (diff < 0) setCurrentX(diff); else setCurrentX(diff * 0.2); };
  const handleTouchEnd = () => handleSwipeEnd();
  const handleMouseDown = (e: React.MouseEvent) => { if (isConfirmingDelete) return; setStartX(e.clientX); setIsDragging(true); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging || startX === null || isDeleting || isConfirmingDelete) return; e.preventDefault(); const diff = e.clientX - startX; if (diff < 0) setCurrentX(diff); else setCurrentX(diff * 0.2); };
  const handleMouseUp = () => handleSwipeEnd();
  const handleMouseLeave = () => { if (isDragging) handleSwipeEnd(); };
  const handleSwipeEnd = () => { setIsDragging(false); if (currentX < -DELETE_THRESHOLD) { handleStartDeleteSequence(); } else { setCurrentX(0); } setStartX(null); };
  const handleStartDeleteSequence = () => { if (navigator.vibrate) navigator.vibrate(50); setIsConfirmingDelete(true); setCurrentX(0); deleteTimerRef.current = setTimeout(() => { setIsDeleting(true); setTimeout(() => onDelete(task.id), 300); }, 3000); };
  const handleUndo = () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); setIsConfirmingDelete(false); setCurrentX(0); };

  if (isDeleting) return <div className="h-[88px] mb-3 w-full bg-transparent transition-all duration-300 opacity-0 transform -translate-x-full"></div>;
  if (isConfirmingDelete) return ( <div className="relative mb-3 h-[88px] w-full bg-red-950/40 border border-red-900/50 rounded-xl flex items-center justify-between px-6 animate-fade-in overflow-hidden"> <div className="absolute bottom-0 left-0 h-1 bg-red-600/50 w-full animate-[shrink_3s_linear_forwards]" style={{ animationName: 'shrinkWidth' }}></div> <style>{`@keyframes shrinkWidth { from { width: 100%; } to { width: 0%; } }`}</style> <div className="flex items-center gap-2 text-red-400"> <Trash2 size={20} /> <span className="font-medium text-sm">Eliminato</span> </div> <button onClick={handleUndo} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm border border-slate-700 transition-colors z-10"> <RotateCcw size={16} /> Annulla </button> </div> );

  return (
    <div className="relative mb-3 w-full h-[88px] overflow-hidden rounded-xl select-none touch-pan-y" onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} style={{ touchAction: 'pan-y' }} onClick={() => { if (!isDragging && !isDeleting && !isConfirmingDelete) onToggle(task.id); }}>
      <div className={`absolute inset-0 flex items-center justify-end px-6 transition-colors ${currentX < 0 ? 'bg-red-600' : 'bg-slate-900'}`}><div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX < -30 ? 1 : 0 }}><span>Elimina</span> <Trash2 size={24} /></div></div>
      <div className={`relative h-full bg-slate-900 flex items-center gap-4 p-4 border border-slate-800 rounded-xl transition-all duration-300 ${task.completed ? 'opacity-60 bg-slate-950/50 border-slate-900' : ''}`} style={{ transform: `translateX(${currentX}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors pointer-events-none ${task.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-500'}`}>{task.completed && <Check size={14} className="text-white" strokeWidth={3} />}</div>
        <span className={`flex-1 font-medium pointer-events-none transition-all ${task.completed ? 'text-slate-600 line-through' : 'text-slate-200'}`}>{task.text}</span>
      </div>
    </div>
  );
};

const ShoppingListItem: React.FC<{item: ShoppingItem, onToggle: (id: string) => void, onDelete: (id: string) => void, onEdit: (item: ShoppingItem) => void}> = ({ item, onToggle, onDelete, onEdit }) => {
  const [startX, setStartX] = useState<number | null>(null);
  const [currentX, setCurrentX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SWIPE_THRESHOLD = 70; const DELETE_THRESHOLD = 150; const MAX_SWIPE_RIGHT = 100;

  useEffect(() => { return () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }; }, []);

  const handleTouchStart = (e: React.TouchEvent) => { if (isConfirmingDelete) return; setStartX(e.touches[0].clientX); setIsDragging(true); };
  const handleTouchMove = (e: React.TouchEvent) => { if (startX === null || isDeleting || isConfirmingDelete) return; const diff = e.touches[0].clientX - startX; if (diff > MAX_SWIPE_RIGHT) setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2); else setCurrentX(diff); };
  const handleTouchEnd = () => handleSwipeEnd();
  const handleMouseDown = (e: React.MouseEvent) => { if (isConfirmingDelete) return; setStartX(e.clientX); setIsDragging(true); };
  const handleMouseMove = (e: React.MouseEvent) => { if (!isDragging || startX === null || isDeleting || isConfirmingDelete) return; e.preventDefault(); const diff = e.clientX - startX; if (diff > MAX_SWIPE_RIGHT) setCurrentX(MAX_SWIPE_RIGHT + (diff - MAX_SWIPE_RIGHT) * 0.2); else setCurrentX(diff); };
  const handleMouseUp = () => handleSwipeEnd();
  const handleMouseLeave = () => { if (isDragging) handleSwipeEnd(); };
  const handleSwipeEnd = () => { setIsDragging(false); if (currentX > SWIPE_THRESHOLD) { onEdit(item); setCurrentX(0); } else if (currentX < -DELETE_THRESHOLD) { handleStartDeleteSequence(); } else { setCurrentX(0); } setStartX(null); };
  const handleStartDeleteSequence = () => { if (navigator.vibrate) navigator.vibrate(50); setIsConfirmingDelete(true); setCurrentX(0); deleteTimerRef.current = setTimeout(() => { setIsDeleting(true); setTimeout(() => onDelete(item.id), 300); }, 3000); };
  const handleUndo = () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); setIsConfirmingDelete(false); setCurrentX(0); };
  const getSwipeBackground = () => { if (currentX > 0) return 'bg-indigo-600'; if (currentX < 0) return 'bg-red-600'; return 'bg-slate-900'; };

  if (isDeleting) return <div className="h-[72px] mb-3 w-full bg-transparent transition-all duration-300 opacity-0 transform -translate-x-full"></div>;
  if (isConfirmingDelete) return ( <div className="relative mb-3 h-[72px] w-full bg-red-950/40 border border-red-900/50 rounded-xl flex items-center justify-between px-6 animate-fade-in overflow-hidden"> <div className="absolute bottom-0 left-0 h-1 bg-red-600/50 w-full animate-[shrink_3s_linear_forwards]" style={{ animationName: 'shrinkWidth' }}></div> <style>{`@keyframes shrinkWidth { from { width: 100%; } to { width: 0%; } }`}</style> <div className="flex items-center gap-2 text-red-400"> <Trash2 size={20} /> <span className="font-medium text-sm">Eliminato</span> </div> <button onClick={handleUndo} className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm border border-slate-700 transition-colors z-10"> <RotateCcw size={16} /> Annulla </button> </div> );

  return (
    <div className="relative mb-3 w-full h-[72px] overflow-hidden rounded-xl select-none touch-pan-y" onMouseLeave={handleMouseLeave} onMouseUp={handleMouseUp} style={{ touchAction: 'pan-y' }} onClick={() => { if (!isDragging && !isDeleting && !isConfirmingDelete) onToggle(item.id); }}>
      <div className={`absolute inset-0 flex items-center justify-between px-6 transition-colors ${getSwipeBackground()}`}><div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX > 30 ? 1 : 0 }}><Edit2 size={24} /> <span>Modifica</span></div><div className="flex items-center gap-2 text-white font-bold transition-opacity duration-200" style={{ opacity: currentX < -30 ? 1 : 0 }}><span>Elimina</span> <Trash2 size={24} /></div></div>
      <div className={`relative h-full bg-slate-900 flex items-center justify-between p-4 border border-slate-800 rounded-xl transition-transform ease-out ${item.completed ? 'opacity-50' : ''}`} style={{ transform: `translateX(${currentX}px)`, transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
        <div className="flex items-center gap-4 pointer-events-none"><div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${item.completed ? 'bg-emerald-600 border-emerald-600' : 'border-slate-500'}`}>{item.completed && <Check size={14} className="text-white" strokeWidth={3} />}</div><div className="flex flex-col"><span className={`font-medium ${item.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{item.name}</span><span className="text-[10px] text-slate-500 uppercase tracking-wide">{item.category}</span></div></div>
      </div>
    </div>
  );
};

const StatsCard: React.FC<{label: string, amount: number, type: 'balance' | 'income' | 'expense'}> = ({ label, amount, type }) => {
  let colorClass = "text-slate-200"; let bgClass = "bg-slate-900"; let borderClass = "border-slate-800";
  if (type === 'income') { colorClass = "text-emerald-400"; bgClass = "bg-emerald-950/30"; borderClass = "border-emerald-900/30"; } else if (type === 'expense') { colorClass = "text-red-400"; bgClass = "bg-red-950/30"; borderClass = "border-red-900/30"; } else { colorClass = "text-indigo-400"; bgClass = "bg-slate-900"; }
  return ( <div className={`flex-1 p-4 rounded-2xl border shadow-sm flex flex-col items-center justify-center ${bgClass} ${borderClass}`}><span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">{label}</span><span className={`text-xl sm:text-2xl font-bold truncate max-w-full ${colorClass}`}>{amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}</span></div> );
};

const ShoppingModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (name: string, category: string, id?: string) => void, initialData?: ShoppingItem | null, categories: string[], onAddCategory: (newCategory: string) => void}> = ({ isOpen, onClose, onSave, initialData, categories, onAddCategory }) => {
  const [name, setName] = useState(''); const [category, setCategory] = useState(''); const [isAddingCategory, setIsAddingCategory] = useState(false); const [newCategoryName, setNewCategoryName] = useState(''); const newCategoryInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isOpen) { setIsAddingCategory(false); setNewCategoryName(''); if (initialData) { setName(initialData.name); setCategory(initialData.category); } else { setName(''); setCategory(categories[0] || ''); } } }, [isOpen, initialData, categories]);
  useEffect(() => { if (isAddingCategory && newCategoryInputRef.current) newCategoryInputRef.current.focus(); }, [isAddingCategory]);
  if (!isOpen) return null;
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!name.trim()) return; onSave(name, category || categories[0], initialData?.id); onClose(); };
  const handleCreateCategory = () => { if (newCategoryName.trim()) { onAddCategory(newCategoryName.trim()); setCategory(newCategoryName.trim()); setNewCategoryName(''); setIsAddingCategory(false); } else { setIsAddingCategory(false); } };
  const handleKeyDownCategory = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } else if (e.key === 'Escape') { setIsAddingCategory(false); } };
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"><div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-slide-up"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900"><h2 className="text-lg font-bold text-slate-100">{initialData ? 'Modifica Prodotto' : 'Nuovo Prodotto'}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={24} /></button></div><form onSubmit={handleSubmit} className="p-6 space-y-6"><div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nome Prodotto</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Es. Latte" className="w-full text-xl font-bold text-slate-100 placeholder-slate-700 outline-none border-b border-slate-700 focus:border-indigo-500 pb-2 bg-transparent" autoFocus={!initialData} required /></div><div><label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Categoria</label><div className="flex flex-wrap gap-2">{categories.map(cat => ( <button key={cat} type="button" onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500 hover:text-slate-200'}`}>{cat}</button> ))}{isAddingCategory ? ( <div className="flex items-center gap-1"><input ref={newCategoryInputRef} type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onBlur={handleCreateCategory} onKeyDown={handleKeyDownCategory} placeholder="Nuova..." className="px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-500 bg-slate-800 text-white outline-none w-24 placeholder-slate-500" /></div> ) : ( <button type="button" onClick={() => setIsAddingCategory(true)} className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300 transition-all flex items-center gap-1"><Plus size={12} /> Nuova</button> )}</div></div><button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 transition-all flex justify-center gap-2">{initialData ? <Save size={20} /> : <Check size={20} />} {initialData ? 'Aggiorna' : 'Aggiungi'}</button></form></div></div>
  );
};

const AddModal: React.FC<{isOpen: boolean, onClose: () => void, onSave: (amount: number, description: string, category: string, type: TransactionType, note: string, id?: string) => void, initialData?: Transaction | null, expenseCategories: string[], incomeCategories: string[], onAddCategory: (newCategory: string, type: TransactionType) => void}> = ({ isOpen, onClose, onSave, initialData, expenseCategories, incomeCategories, onAddCategory }) => {
  const [type, setType] = useState<TransactionType>('expense'); const [amount, setAmount] = useState(''); const [description, setDescription] = useState(''); const [category, setCategory] = useState(''); const [note, setNote] = useState(''); const [isAddingCategory, setIsAddingCategory] = useState(false); const [newCategoryName, setNewCategoryName] = useState(''); const newCategoryInputRef = useRef<HTMLInputElement>(null);
  const currentCategories = type === 'expense' ? expenseCategories : incomeCategories;
  useEffect(() => { if (isOpen) { setIsAddingCategory(false); setNewCategoryName(''); if (initialData) { setType(initialData.type); setAmount(initialData.amount.toString()); setDescription(initialData.description); setCategory(initialData.category); setNote(initialData.note || ''); } else { setType('expense'); setAmount(''); setDescription(''); setNote(''); setCategory(expenseCategories[0] || ''); } } }, [isOpen, initialData, expenseCategories]);
  useEffect(() => { if (isAddingCategory && newCategoryInputRef.current) newCategoryInputRef.current.focus(); }, [isAddingCategory]);
  if (!isOpen) return null;
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!amount || !description) return; onSave(parseFloat(amount), description, category || currentCategories[0], type, note, initialData?.id); onClose(); };
  const handleCreateCategory = () => { if (newCategoryName.trim()) { onAddCategory(newCategoryName.trim(), type); setCategory(newCategoryName.trim()); setNewCategoryName(''); setIsAddingCategory(false); } else { setIsAddingCategory(false); } };
  const handleKeyDownCategory = (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); handleCreateCategory(); } else if (e.key === 'Escape') { setIsAddingCategory(false); } };
  const isEditing = !!initialData;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in"><div className="bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-800 overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar"><div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10"><h2 className="text-lg font-bold text-slate-100">{isEditing ? 'Modifica Transazione' : 'Nuova Transazione'}</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X size={24} /></button></div><form onSubmit={handleSubmit} className="p-6 space-y-6"><div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800"><button type="button" className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'expense' ? 'bg-slate-800 text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => { setType('expense'); setCategory(expenseCategories[0] || ''); setIsAddingCategory(false); }}>Uscita</button><button type="button" className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${type === 'income' ? 'bg-slate-800 text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`} onClick={() => { setType('income'); setCategory(incomeCategories[0] || ''); setIsAddingCategory(false); }}>Entrata</button></div><div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Importo (€)</label><input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full text-4xl font-bold text-slate-100 placeholder-slate-700 outline-none border-b border-slate-700 focus:border-indigo-500 pb-2 bg-transparent" autoFocus={!isEditing} required /></div><div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Descrizione</label><input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Es. Spesa settimanale" className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg outline-none focus:border-indigo-500" required /></div><div><label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Note</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dettagli extra..." className="w-full p-3 bg-slate-950 border border-slate-800 text-slate-200 rounded-lg outline-none focus:border-indigo-500 min-h-[80px] resize-none" /></div><div><label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Categoria</label><div className="flex flex-wrap gap-2">{currentCategories.map(cat => ( <button key={cat} type="button" onClick={() => setCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${category === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-900 text-slate-400 border-slate-700 hover:border-indigo-500 hover:text-slate-200'}`}>{cat}</button> ))}{isAddingCategory ? ( <div className="flex items-center gap-1"><input ref={newCategoryInputRef} type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onBlur={handleCreateCategory} onKeyDown={handleKeyDownCategory} placeholder="Nuova..." className="px-3 py-1.5 rounded-full text-xs font-medium border border-indigo-500 bg-slate-800 text-white outline-none w-24 placeholder-slate-500" /></div> ) : ( <button type="button" onClick={() => setIsAddingCategory(true)} className="px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300 transition-all flex items-center gap-1"><Plus size={12} /> Nuova</button> )}</div></div><button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-indigo-500 transition-all flex justify-center gap-2">{isEditing ? <Save size={20} /> : <Check size={20} />} {isEditing ? 'Aggiorna' : 'Salva'}</button></form></div></div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);