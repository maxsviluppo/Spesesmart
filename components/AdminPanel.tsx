import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { Users, DollarSign, Trophy, TrendingUp, Calendar, Mail, X, Shield, Lock, Activity, List, Send, Save, Menu, Trash2 } from 'lucide-react';



interface AdminPanelProps {
    onClose: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    // Dashboard stats
    const [stats, setStats] = useState({
        subscribersCount: 0,
        maxScore: 0,
        maxLevel: 0,
    });
    const [subscribers, setSubscribers] = useState<{ username: string, email: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'subscribers' | 'planning' | 'newsletter'>('overview');

    // Confirm Delete State
    const [userToDelete, setUserToDelete] = useState<string | null>(null);
    const [adminToast, setAdminToast] = useState<{ msg: string, visible: boolean }>({ msg: '', visible: false });

    const showToast = (msg: string) => {
        setAdminToast({ msg, visible: true });
        setTimeout(() => setAdminToast(prev => ({ ...prev, visible: false })), 3000);
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (username === 'admin' && password === 'accessometti') {
            setIsAuthenticated(true);
            fetchData();
        } else {
            showToast('Credenziali non valide');
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch everything from profiles for now (assuming standard scale)
            // Cast to any to bypass dummy client type limitations
            const { data: profiles, count, error } = await (supabase as any)
                .from('profiles')
                // FIXED: Include ID to allow deletion. Added updated_at for status check.
                .select('id, username, email, total_score, max_level, updated_at', { count: 'exact' })
                .order('updated_at', { ascending: false });

            if (error) throw error;

            let maxS = 0;
            let maxL = 0;
            if (profiles) {
                // 5 Months Inactivity Rule
                const fiveMonthsAgo = new Date();
                fiveMonthsAgo.setMonth(fiveMonthsAgo.getMonth() - 5);

                profiles.forEach((p: any) => {
                    if ((p.total_score || 0) > maxS) maxS = p.total_score;
                    if ((p.max_level || 0) > maxL) maxL = p.max_level;

                    // Determine Status
                    const lastActive = p.updated_at ? new Date(p.updated_at) : new Date();
                    p.status = lastActive < fiveMonthsAgo ? 'Inattivo' : 'Attivo';
                });
                setSubscribers(profiles);
            }

            setStats({
                subscribersCount: count || profiles?.length || 0,
                maxScore: maxS,
                maxLevel: maxL
            });

        } catch (e) {
            console.error("Admin fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    // Trigger Confirmation Modal
    const handleDeleteUser = (userId: string) => {
        setUserToDelete(userId);
    };

    // Execute Delete
    // Execute Delete
    const confirmDelete = async () => {
        if (!userToDelete) return;

        try {
            console.log('Attempting delete via RPC for:', userToDelete);

            // Try using the secure RPC function first (Bypasses RLS)
            const { error: rpcError } = await (supabase as any).rpc('admin_delete_user', {
                target_user_id: userToDelete,
                admin_secret: 'accessometti'
            });

            if (rpcError) {
                console.warn('RPC Delete failed, trying standard delete...', rpcError);

                // Fallback to standard delete (Works if RLS is open or user is admin)
                const { error: deleteError } = await (supabase as any)
                    .from('profiles')
                    .delete()
                    .eq('id', userToDelete);

                if (deleteError) throw deleteError;
            }

            // Success feedback
            showToast('Utente eliminato correttamente.');
            fetchData();
            setUserToDelete(null);

        } catch (e: any) {
            console.error('Delete error:', e);
            showToast('Errore: ' + (e.message || 'Controlla la funzione SQL.'));
        }
    };

    // Login Screen
    if (!isAuthenticated) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
                <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-[#333] w-full max-w-md shadow-2xl relative">
                    <button
                        onClick={onClose}
                        className="absolute top-10 right-4 text-gray-500 hover:text-white transition-colors p-2"
                    >
                        <X size={24} />
                    </button>

                    <div className="flex flex-col items-center mb-8">
                        <div className="w-16 h-16 bg-[#FF8800]/20 rounded-full flex items-center justify-center mb-4 text-[#FF8800]">
                            <Shield size={32} />
                        </div>
                        <h2 className="text-2xl font-bold text-white">Admin Access</h2>
                        <p className="text-gray-400 text-sm">Area riservata amministrazione</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Username</label>
                            <div className="relative">
                                <Users className="absolute left-3 top-3 text-gray-500" size={18} />
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-[#111] border border-[#333] text-white rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-[#FF8800] focus:ring-1 focus:ring-[#FF8800] transition-all"
                                    placeholder="Inserisci username"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-[#111] border border-[#333] text-white rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-[#FF8800] focus:ring-1 focus:ring-[#FF8800] transition-all"
                                    placeholder="Inserisci password"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-[#FF8800] hover:bg-[#ff9900] text-black font-bold py-3 rounded-xl transition-all transform active:scale-95 mt-4"
                        >
                            Accedi al Pannello
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // Dashboard Interface
    return (
        <div className="fixed inset-0 z-50 flex flex-col md:flex-row bg-[#0a0a0a] text-white overflow-hidden animate-fade-in">
            {/* Sidebar (Desktop) */}
            <div className="hidden md:flex w-64 bg-[#111] border-r border-[#222] flex-col p-4">
                <div className="flex items-center gap-3 px-2 mb-8 mt-2">
                    <div className="w-8 h-8 bg-[#FF8800] rounded-lg flex items-center justify-center text-black font-bold">
                        <Shield size={18} />
                    </div>
                    <span className="font-bold text-lg tracking-tight">Admin<span className="text-[#FF8800]">Panel</span></span>
                </div>

                <nav className="flex-1 space-y-1">
                    <SidebarItem icon={<Activity />} label="Panoramica" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    <SidebarItem icon={<Users />} label="Iscritti" active={activeTab === 'subscribers'} onClick={() => setActiveTab('subscribers')} />
                    <SidebarItem icon={<Calendar />} label="Pianificazione" active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} />
                    <SidebarItem icon={<Mail />} label="Newsletter" active={activeTab === 'newsletter'} onClick={() => setActiveTab('newsletter')} />
                </nav>

                <button onClick={onClose} className="mt-auto flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#222] rounded-xl transition-all">
                    <X size={18} />
                    <span className="font-medium">Esci</span>
                </button>
            </div>

            {/* Mobile Header */}
            <div className="md:hidden bg-[#111] border-b border-[#222] p-4 pt-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[#FF8800] rounded-lg flex items-center justify-center text-black font-bold">
                        <Shield size={18} />
                    </div>
                    <span className="font-bold text-lg">Admin</span>
                </div>
                <button onClick={onClose} className="p-2 text-gray-400 hover:text-white">
                    <X size={24} />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto bg-[#0a0a0a] p-4 md:p-8 pb-24 md:pb-8">
                <header className="flex flex-col md:flex-row justify-between md:items-center mb-6 md:mb-8 gap-2">
                    <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                        {
                            activeTab === 'overview' ? 'Panoramica App' :
                                activeTab === 'subscribers' ? (
                                    <>
                                        Lista Iscritti
                                        <span className="text-lg bg-[#222] text-[#FF8800] px-3 py-1 rounded-full border border-[#333] font-mono">
                                            {stats.subscribersCount}
                                        </span>
                                    </>
                                ) :
                                    activeTab === 'planning' ? 'Pianificazione Sfide' : 'Newsletter'
                        }
                    </h1>
                    <div className="text-xs md:text-sm text-gray-500">Ultimo aggiornamento: Oggi, {new Date().toLocaleTimeString()}</div>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-8 h-8 border-4 border-[#FF8800] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {/* OVERVIEW TAB */}
                        {activeTab === 'overview' && (
                            <div className="space-y-8">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <StatCard icon={<Users />} label="Totale Iscritti" value={stats.subscribersCount.toString()} color="blue" />
                                    <StatCard icon={<DollarSign />} label="Proventi Stimati" value="€ 0.00" subtext="In attesa di acquisti in-app" color="green" />
                                    <StatCard icon={<Trophy />} label="Punteggio Record" value={stats.maxScore.toLocaleString()} color="yellow" />
                                    <StatCard icon={<TrendingUp />} label="Livello Max" value={stats.maxLevel.toString()} color="purple" />
                                </div>

                                {/* Recent Activity / Chart Placeholder */}
                                <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Activity size={18} className="text-[#FF8800]" /> Andamento
                                    </h3>
                                    <div className="h-48 flex items-center justify-center border-2 border-dashed border-[#333] rounded-xl text-gray-500">
                                        Grafico non disponibile (Richiede più dati storici)
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUBSCRIBERS TAB */}
                        {activeTab === 'subscribers' && (
                            <div className="bg-[#111] border border-[#222] rounded-2xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-[#1a1a1a] border-b border-[#222]">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">Username</th>
                                            <th className="px-4 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">Punteggio</th>
                                            <th className="px-4 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">Livello</th>
                                            <th className="px-4 py-3 font-semibold text-gray-400 text-xs uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#222]">
                                        {subscribers.map((user, idx) => (
                                            <tr key={idx} className="hover:bg-[#161616] transition-colors group">
                                                <td className="px-4 py-3">
                                                    <div className="font-medium text-white text-sm">{user.username || 'Anonimo'}</div>
                                                    <div className="text-gray-500 text-[9px] leading-3 uppercase tracking-wider truncate max-w-[140px]" title={user.email}>{user.email || 'N/A'}</div>
                                                    <div className="text-gray-600 text-[8px] mt-0.5">
                                                        {(user as any).updated_at ? new Date((user as any).updated_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Mai'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300 text-sm">{(user as any).total_score || 0}</td>
                                                <td className="px-4 py-3 text-gray-300 text-sm">{(user as any).max_level || 1}</td>
                                                <td className="px-4 py-3 flex items-center justify-between">
                                                    <span className={`px-2 py-0.5 text-[9px] rounded-full border ${(user as any).status === 'Inattivo'
                                                        ? 'bg-red-900/20 text-red-500 border-red-900/30'
                                                        : 'bg-green-900/30 text-green-400 border-green-900'
                                                        }`}>
                                                        {(user as any).status || 'Attivo'}
                                                    </span>
                                                    <button
                                                        onClick={() => handleDeleteUser((user as any).id)}
                                                        className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all border border-transparent hover:border-red-500/30"
                                                        title="Elimina Utente"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {subscribers.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                                    Nessun iscritto trovato.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>

                                <div className="p-4 bg-[#1a1a1a] border-t border-[#222]">
                                    <div className="flex items-start gap-2 text-gray-500">
                                        <Shield size={14} className="mt-0.5 flex-shrink-0" />
                                        <p className="text-[10px] italic leading-relaxed">
                                            <strong>Nota Automazione:</strong> Lo stato viene impostato automaticamente su <span className="text-red-500 font-bold uppercase">Inattivo</span> se l'utente non effettua l'accesso per più di <strong>5 mesi</strong>. Questa regola serve per identificare account potenzialmente dormienti.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* PLANNING TAB */}
                        {activeTab === 'planning' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                                    <h3 className="text-xl font-bold mb-4">Nuova Sfida Settimanale</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Titolo Sfida</label>
                                            <input type="text" className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-3 text-white focus:border-[#FF8800] outline-none" placeholder="Es. Maratona Matematica" />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-sm text-gray-400 block mb-2">Inizio</label>
                                                <input type="date" className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-3 text-white outline-none" />
                                            </div>
                                            <div>
                                                <label className="text-sm text-gray-400 block mb-2">Fine</label>
                                                <input type="date" className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-3 text-white outline-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Regole Speciali</label>
                                            <textarea className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-3 text-white h-24 outline-none resize-none" placeholder="Descrivi le regole..."></textarea>
                                        </div>
                                        <button className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                                            <Save size={18} /> Salva Pianificazione
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-[#111] border border-[#222] rounded-2xl p-6">
                                    <h3 className="text-xl font-bold mb-4">Sfide Programmate</h3>
                                    <div className="space-y-4">
                                        {[1, 2].map((i) => (
                                            <div key={i} className="flex items-center gap-4 p-4 bg-[#1a1a1a] rounded-xl border border-[#333]">
                                                <div className="w-10 h-10 bg-[#222] rounded-full flex items-center justify-center text-gray-400">
                                                    <Calendar size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-bold text-white">Sfida di Primavera {i}</h4>
                                                    <p className="text-xs text-gray-500">Inizia tra {i * 2} giorni</p>
                                                </div>
                                                <span className="text-xs bg-yellow-900/20 text-yellow-500 px-2 py-1 rounded border border-yellow-900">Programmata</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* NEWSLETTER TAB */}
                        {activeTab === 'newsletter' && (
                            <div className="max-w-3xl mx-auto">
                                <div className="bg-[#111] border border-[#222] rounded-2xl p-8">
                                    <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                        <Send className="text-[#FF8800]" /> Invia Aggiornamento
                                    </h3>
                                    <div className="space-y-6">
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Oggetto</label>
                                            <input type="text" className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-4 text-white focus:border-[#FF8800] outline-none text-lg" placeholder="Novità in arrivo..." />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-400 block mb-2">Messaggio a tutti gli iscritti ({stats.subscribersCount})</label>
                                            <textarea className="w-full bg-[#0a0a0a] border border-[#333] rounded-lg p-4 text-white h-48 outline-none resize-none font-mono text-sm leading-relaxed" placeholder="Scrivi il tuo messaggio qui..."></textarea>
                                        </div>
                                        <div className="flex justify-end gap-4">
                                            <button className="px-6 py-3 text-gray-400 hover:text-white transition-colors font-medium">Salva Bozza</button>
                                            <button className="px-8 py-3 bg-[#FF8800] text-black font-bold rounded-xl hover:bg-[#ff9900] transition-transform transform active:scale-95 flex items-center gap-2">
                                                <Send size={18} /> Invia Ora
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </>
                )}
            </div>

            {/* CONFIRM DELETE MODAL (Themed) */}
            {userToDelete && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-[#1a1a1a] p-6 rounded-2xl border border-red-900/50 shadow-[0_0_50px_rgba(220,38,38,0.2)] w-full max-w-sm mx-4 transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mb-4 text-red-500 border border-red-900/30">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Eliminare Utente?</h3>
                            <p className="text-gray-400 text-sm mb-6">
                                Stai per cancellare definitivamente questo profilo e tutti i suoi dati (punteggi, sfide, progressi).<br />
                                <span className="text-red-400 font-bold block mt-2">Questa azione non può essere annullata.</span>
                            </p>
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={() => setUserToDelete(null)}
                                    className="flex-1 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
                                >
                                    ANNULLA
                                </button>
                                <button
                                    onClick={confirmDelete}
                                    className="flex-1 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all hover:scale-[1.02]"
                                >
                                    ELIMINA
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Bottom Navigation */}
            <div className="md:hidden bg-[#111] border-t border-[#222] flex justify-around p-2 pb-safe">
                <MobileNavItem icon={<Activity />} label="Panoramica" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                <MobileNavItem icon={<Users />} label="Iscritti" active={activeTab === 'subscribers'} onClick={() => setActiveTab('subscribers')} />
                <MobileNavItem icon={<Calendar />} label="Pianif." active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} />
                <MobileNavItem icon={<Mail />} label="News" active={activeTab === 'newsletter'} onClick={() => setActiveTab('newsletter')} />
            </div>
        </div>
    );
};

// UI Helpers
const SidebarItem = ({ icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all mb-1 ${active
            ? 'bg-[#FF8800]/10 text-[#FF8800] font-medium'
            : 'text-gray-400 hover:text-white hover:bg-[#222]'
            }`}
    >
        {React.cloneElement(icon, { size: 18 })}
        <span>{label}</span>
    </button>
);

const StatCard = ({ icon, label, value, subtext, color }: any) => {
    const colors: any = {
        blue: 'text-blue-400 bg-blue-900/20 border-blue-900/30',
        green: 'text-green-400 bg-green-900/20 border-green-900/30',
        yellow: 'text-yellow-400 bg-yellow-900/20 border-yellow-900/30',
        purple: 'text-purple-400 bg-purple-900/20 border-purple-900/30',
    };

    return (
        <div className={`p-6 rounded-2xl border ${colors[color].split(' ')[2]} bg-[#111]`}>
            <div className={`w-12 h-12 rounded-xl ${colors[color]} flex items-center justify-center mb-4`}>
                {React.cloneElement(icon, { size: 24 })}
            </div>
            <p className="text-gray-400 text-sm font-medium uppercase tracking-wide">{label}</p>
            <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
            {subtext && <p className="text-xs text-gray-500 mt-2">{subtext}</p>}
        </div>
    );
};

const MobileNavItem = ({ icon, label, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all ${active ? 'text-[#FF8800]' : 'text-gray-500'}`}
    >
        {React.cloneElement(icon, { size: 24, strokeWidth: active ? 2.5 : 2 })}
        <span className="text-[10px] mt-1 font-medium">{label}</span>
    </button>
);

export default AdminPanel;
