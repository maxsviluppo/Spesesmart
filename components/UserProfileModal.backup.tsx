import React, { useState } from 'react';
import { User, Trophy, Award, Lock, X, Star, Zap, Brain, Target, Shield, Sparkles, BookOpen, Crown, Gem, Infinity, Layers, Swords } from 'lucide-react';
import { UserProfile } from '../services/supabaseClient';
import { BADGES } from '../constants/badges';

interface UserProfileModalProps {
    currentUser: any;
    userProfile: UserProfile | null;
    onClose: () => void;
}

const UserProfileModal: React.FC<UserProfileModalProps> = ({ currentUser, userProfile, onClose }) => {
    const [activeTab, setActiveTab] = useState<'profile' | 'badges' | 'trophies' | 'boss'>('profile');
    const [selectedBadge, setSelectedBadge] = useState<string | null>(null);

    // Fallback data if profile is missing (e.g. offline)
    const stats = userProfile || {
        total_score: 0,
        max_level: 1,
        estimated_iq: 100,
        username: 'Ospite',
        badges: []
    };

    const unlockedBadges = stats.badges || [];

    // Rank Logic
    // Rank Logic - Expanded for long-term progression
    const getRank = (level: number) => {
        if (level >= 100) return { title: 'Divinità Numerica', icon: Infinity, color: 'text-rose-500', bg: 'bg-rose-500/20' };
        if (level >= 80) return { title: 'Oracolo Supremo', icon: Crown, color: 'text-amber-300', bg: 'bg-amber-500/20' };
        if (level >= 60) return { title: 'Signore del Calcolo', icon: Gem, color: 'text-fuchsia-400', bg: 'bg-fuchsia-500/20' };
        if (level >= 50) return { title: 'Maestro dell\'Algoritmo', icon: Layers, color: 'text-cyan-400', bg: 'bg-cyan-500/20' };
        if (level >= 40) return { title: 'Architetto Matrix', icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/20' };
        if (level >= 30) return { title: 'Stratega Quantico', icon: Brain, color: 'text-violet-400', bg: 'bg-violet-500/20' };
        if (level >= 20) return { title: 'Entità Trascendente', icon: Sparkles, color: 'text-pink-400', bg: 'bg-pink-500/20' };
        if (level >= 15) return { title: 'Visionario', icon: Zap, color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
        if (level >= 10) return { title: 'Operatore Elite', icon: Star, color: 'text-blue-400', bg: 'bg-blue-500/20' };
        if (level >= 5) return { title: 'Hacker Logico', icon: Shield, color: 'text-slate-300', bg: 'bg-slate-500/20' };
        return { title: 'Neofita', icon: BookOpen, color: 'text-slate-500', bg: 'bg-slate-500/10' };
    };

    const rank = getRank(stats.max_level);
    const RankIcon = rank.icon;

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 modal-overlay bg-black/80 backdrop-blur-sm" onPointerDown={(e) => { e.stopPropagation(); onClose(); }}>
            <div className="bg-slate-900 border-[3px] border-slate-700 w-full max-w-lg h-[80vh] rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] flex flex-col relative overflow-hidden" onPointerDown={e => e.stopPropagation()}>
                {/* Background Pattern */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

                {/* Header */}
                <div className="relative z-10 p-6 pb-2 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full border-[3px] border-[#FF8800] bg-slate-800 flex items-center justify-center overflow-hidden shadow-lg">
                            <User size={32} className="text-white" />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-2xl font-black font-orbitron text-white uppercase tracking-wider leading-none">
                                {stats.username}
                            </h2>
                            <div className={`flex items-center gap-2 mt-2 px-3 py-1 rounded-lg border border-white/10 ${rank.bg} w-fit`}>
                                <RankIcon size={12} className={rank.color} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${rank.color}`}>{rank.title}</span>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 rounded-full bg-black/20 hover:bg-red-500/20 flex items-center justify-center text-slate-400 hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                <div className="relative z-10 px-6 py-4 flex gap-2 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex-1 py-3 px-2 rounded-xl font-black font-orbitron uppercase text-[10px] tracking-wider transition-all border-2 min-w-[80px]
                            ${activeTab === 'profile' ? 'bg-[#FF8800] border-[#FF8800] text-white shadow-lg scale-105' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        Profilo
                    </button>
                    <button
                        onClick={() => setActiveTab('badges')}
                        className={`flex-1 py-3 px-2 rounded-xl font-black font-orbitron uppercase text-[10px] tracking-wider transition-all border-2 min-w-[80px]
                            ${activeTab === 'badges' ? 'bg-purple-600 border-purple-500 text-white shadow-lg scale-105' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        Badge
                    </button>
                    <button
                        onClick={() => setActiveTab('boss')}
                        className={`flex-1 py-3 px-2 rounded-xl font-black font-orbitron uppercase text-[10px] tracking-wider transition-all border-2 min-w-[80px]
                            ${activeTab === 'boss' ? 'bg-red-600 border-red-500 text-white shadow-lg scale-105' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        Boss
                    </button>
                    <button
                        onClick={() => setActiveTab('trophies')}
                        className={`flex-1 py-3 px-2 rounded-xl font-black font-orbitron uppercase text-[10px] tracking-wider transition-all border-2 min-w-[80px]
                            ${activeTab === 'trophies' ? 'bg-amber-500 border-amber-400 text-white shadow-lg scale-105' : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-500'}`}
                    >
                        Trofei
                    </button>
                </div>

                {/* Content Area */}
                <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-6 custom-scroll">

                    {/* PROFILE TAB */}
                    {activeTab === 'profile' && (
                        <div className="space-y-4 animate-fadeIn">
                            {/* Stats Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                    <Brain className="text-pink-500 w-8 h-8" />
                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">QI Stimato</span>
                                    <span className="text-3xl font-black font-orbitron text-white">{stats.estimated_iq}</span>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                    <Target className="text-cyan-500 w-8 h-8" />
                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Max Level</span>
                                    <span className="text-3xl font-black font-orbitron text-white">{stats.max_level}</span>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2 col-span-2">
                                    <Zap className="text-yellow-500 w-8 h-8" />
                                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Punteggio Totale</span>
                                    <span className="text-4xl font-black font-orbitron text-white">{stats.total_score.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Account Info */}
                            <div className="mt-6 p-4 bg-slate-800/30 rounded-2xl border border-white/5">
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <Shield size={16} className="text-slate-400" />
                                    Account Details
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Username</span>
                                        <span className="text-slate-300 font-mono">{stats.username}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">ID Utente</span>
                                        <span className="text-slate-600 font-mono text-xs">{stats.id ? stats.id.substring(0, 8) + '...' : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-slate-500">Stato</span>
                                        <span className="text-green-500 font-bold text-xs uppercase bg-green-500/10 px-2 py-1 rounded">Online</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BADGES TAB */}
                    {activeTab === 'badges' && (
                        <div className="grid grid-cols-3 gap-3 animate-fadeIn">
                            {BADGES.map((badge) => {
                                const isUnlocked = unlockedBadges.includes(badge.id);
                                const Icon = badge.icon;

                                return (
                                    <button
                                        key={badge.id}
                                        onClick={() => setSelectedBadge(selectedBadge === badge.id ? null : badge.id)}
                                        className={`aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-2 relative transition-all duration-300
                                            ${isUnlocked
                                                ? `bg-gradient-to-br ${badge.bgGradient} border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-105 opacity-100`
                                                : 'bg-slate-800/50 border-white/5 opacity-50 grayscale hover:opacity-70'
                                            }
                                        `}
                                    >
                                        <Icon size={24} className={isUnlocked ? badge.color : 'text-slate-500'} />

                                        {/* Lock Overlay */}
                                        {!isUnlocked && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl">
                                                <Lock size={12} className="text-slate-400" />
                                            </div>
                                        )}

                                        {/* Info Overlay (Click) */}
                                        {selectedBadge === badge.id && (
                                            <div className="absolute inset-0 bg-slate-900/95 z-20 flex flex-col items-center justify-center p-2 text-center rounded-xl animate-fadeIn">
                                                <span className={`text-[10px] font-black uppercase ${isUnlocked ? 'text-white' : 'text-slate-400'}`}>{badge.title}</span>
                                                <span className="text-[8px] text-slate-400 leading-tight mt-1">{badge.description}</span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* BOSS TAB - CHRONO PATH */}
                    {activeTab === 'boss' && (
                        <div className="space-y-4 animate-fadeIn pb-8">
                            <div className="text-center mb-6">
                                <h3 className="text-white font-orbitron font-black uppercase text-lg">Cronopercorso Boss</h3>
                                <p className="text-slate-400 text-[10px] uppercase tracking-widest">Sconfiggi i guardiani per avanzare</p>
                            </div>

                            <div className="relative border-l-2 border-slate-700 ml-4 pl-8 space-y-8">
                                {[5, 10, 15, 20, 25, 30].map((bossLevel) => {
                                    const isDefeated = stats.max_level > bossLevel;
                                    const isNext = stats.max_level <= bossLevel && stats.max_level > bossLevel - 5;
                                    const isLocked = stats.max_level <= bossLevel - 5;

                                    return (
                                        <div key={bossLevel} className="relative group">
                                            {/* Node Marker */}
                                            <div className={`absolute -left-[41px] w-6 h-6 rounded-full border-4 transition-all duration-300 z-10 
                                                ${isDefeated ? 'bg-green-500 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]' :
                                                    isNext ? 'bg-red-500 border-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)] scale-125' :
                                                        'bg-slate-900 border-slate-700'}`}
                                            >
                                                {isDefeated && <span className="absolute inset-0 flex items-center justify-center text-black font-bold text-[8px]">✓</span>}
                                            </div>

                                            {/* Content Card */}
                                            <div className={`p-4 rounded-xl border-2 transition-all relative overflow-hidden
                                                ${isDefeated ? 'bg-slate-800/50 border-green-500/30 opacity-60' :
                                                    isNext ? 'bg-gradient-to-r from-red-900/40 to-slate-900 border-red-500 shadow-xl scale-105' :
                                                        'bg-slate-900/50 border-slate-700 grayscale opacity-40'}`}
                                            >
                                                {isNext && <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-600 text-[8px] font-black text-white uppercase">Prossima Sfida</div>}

                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <span className={`text-[10px] font-black uppercase tracking-widest ${isNext ? 'text-red-400' : 'text-slate-500'}`}>Livello {bossLevel}</span>
                                                        <h4 className={`text-sm font-bold font-orbitron uppercase mt-1 ${isDefeated ? 'text-green-400 line-through decoration-2' : 'text-white'}`}>
                                                            {bossLevel === 5 ? 'Il Guardiano del Cancello' :
                                                                bossLevel === 10 ? 'Cyber Sentinel' :
                                                                    bossLevel === 15 ? 'Nucleo Instabile' :
                                                                        bossLevel === 20 ? 'L\'Architetto' : 'Entità Sconosciuta'}
                                                        </h4>
                                                    </div>
                                                    <div className="p-2 bg-black/30 rounded-lg">
                                                        {isLocked ? <Lock size={16} className="text-slate-600" /> : <Swords size={16} className={isDefeated ? 'text-green-500' : 'text-red-500'} />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                                <div className="absolute top-0 bottom-0 -left-[41px] w-0.5 bg-gradient-to-b from-green-500 via-red-500 to-slate-800 opacity-50 h-full"></div>
                            </div>
                        </div>
                    )}

                    {/* TROPHIES TAB */}
                    {activeTab === 'trophies' && (
                        <div className="flex flex-col items-center justify-center h-64 text-center animate-fadeIn">
                            <Trophy size={48} className="text-slate-700 mb-4" />
                            <h3 className="text-slate-300 font-orbitron font-bold uppercase mb-2">Sala dei Trofei</h3>
                            <p className="text-slate-500 text-xs px-8">Partecipa ai Tornei e agli Eventi Speciali per sbloccare coppe esclusive.</p>
                            <div className="mt-8 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl max-w-xs">
                                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Prossimo Torneo</span>
                                <p className="text-white font-black font-orbitron text-sm mt-1">COMING SOON</p>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default UserProfileModal;
