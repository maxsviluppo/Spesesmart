import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Swords, Loader2, XCircle, User, Play, Eye, Radio } from 'lucide-react';
import { matchService, Match } from '../services/matchService';
import { soundService } from '../services/soundService';
import { supabase } from '../services/supabaseClient';

interface NeuralDuelProps {
    currentUser: any;
    onClose: () => void;
    onMatchStart: (seed: string, matchId: string, opponentId: string, isP1: boolean) => void;
    mode: 'standard' | 'blitz' | 'time_attack';
    showToast: (msg: string) => void;
    userProfile?: any;
}

const NeuralDuelLobby: React.FC<NeuralDuelProps> = ({ currentUser, onClose, onMatchStart, mode, showToast, userProfile }) => {
    const [matches, setMatches] = useState<any[]>([]);
    const [onlinePlayers, setOnlinePlayers] = useState<any[]>([]);
    const [myHostedMatch, setMyHostedMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(false);
    const [pendingChallenge, setPendingChallenge] = useState<any | null>(null);
    const channelRef = useRef<any>(null);

    const fetchMatches = useCallback(async () => {
        try {
            setLoading(true);
            const data = await matchService.getOpenMatches(mode);
            console.log(`LOBBY: Trovati ${data.length} tavoli per modalita' ${mode}`);
            if (data.length > 0) console.log("LOBBY DATA:", data.map(m => ({ id: m.id, p1: m.player1_id, status: m.status })));
            setMatches(data);

            // Auto-detect if I have a hosted match
            const myMatch = data.find((m: any) => m.player1_id === currentUser.id && m.status === 'pending');
            if (myMatch && !myHostedMatch) {
                console.log("LOBBY: Rilevato mio tavolo ospitato automaticamente");
                setMyHostedMatch(myMatch);
            }
        } catch (err) {
            console.error("LOBBY: Errore nel caricamento partite:", err);
        } finally {
            setLoading(false);
        }
    }, [mode, currentUser.id, myHostedMatch]);

    const cleanupMyMatch = useCallback(async () => {
        if (myHostedMatch) {
            await matchService.cancelMatch(myHostedMatch.id);
            setMyHostedMatch(null);
        }
    }, [myHostedMatch]);

    useEffect(() => {
        const lobbyChannel = (supabase as any)
            .channel(`lobby_presence_${mode}`, {
                config: { presence: { key: currentUser.id } }
            })
            .on('presence', { event: 'sync' }, () => {
                const state = lobbyChannel.presenceState();
                const players = Object.values(state).map((presence: any) => presence[0]);
                setOnlinePlayers(players);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload: any) => {
                console.log("MATCH CHANGE DETECTED:", payload.eventType, payload.new?.id);
                fetchMatches();
            })
            .subscribe(async (status: string) => {
                console.log("LOBBY CHANNEL STATUS:", status);
                if (status === 'SUBSCRIBED') {
                    await lobbyChannel.track({
                        id: currentUser.id,
                        username: userProfile?.username || currentUser.user_metadata?.username || 'Guerriero',
                        level: userProfile?.max_level || currentUser.user_metadata?.max_level || 1,
                        joined_at: new Date().toISOString()
                    });
                }
            });

        fetchMatches();
        const intervalId = setInterval(fetchMatches, 5000);

        return () => {
            clearInterval(intervalId);
            (supabase as any).removeChannel(lobbyChannel);
        };
    }, [mode, currentUser, fetchMatches]);

    const hostMatch = async () => {
        if (myHostedMatch) return;
        soundService.playUIClick();
        const seed = Math.random().toString(36).substring(7);
        try {
            const newMatch = await matchService.createMatch(currentUser.id, seed, mode);
            if (newMatch) {
                setMyHostedMatch(newMatch);
                channelRef.current = matchService.subscribeToMatch(newMatch.id, (payload) => {
                    if (payload.new.status === 'active' && payload.new.player2_id) {
                        onMatchStart(newMatch.grid_seed, newMatch.id, payload.new.player2_id, true);
                    }
                });
            }
        } catch (e: any) {
            console.error('Lobby error:', e);
            showToast(e.message || "Impossibile creare la sfida");
        }
    };

    const joinMatch = async (matchId: string, seed: string, p1Id: string) => {
        setPendingChallenge(null);
        soundService.playUIClick();
        if (myHostedMatch) {
            await cleanupMyMatch();
        }

        try {
            const success = await matchService.joinMatch(matchId, currentUser.id);
            if (success) {
                soundService.playSuccess();
                onMatchStart(seed, matchId, p1Id, false);
            } else {
                soundService.playError();
                showToast("Sfida non più disponibile.");
                fetchMatches();
            }
        } catch (e: any) {
            console.error('Join error:', e);
            showToast(e.message || "Impossibile unirsi alla sfida");
            fetchMatches();
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fadeIn p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-[2rem] w-full max-w-2xl h-[85vh] flex flex-col relative shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl border-2 ${mode === 'blitz' ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-red-500/20 border-red-500 text-red-500'}`}>
                            <Swords className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black font-orbitron text-white uppercase tracking-wider leading-none mb-1">
                                {mode === 'blitz' ? 'BLITZ ARENA' : mode === 'time_attack' ? 'CHRONO CLASH' : 'NEURAL LOBBY'}
                            </h2>
                            <div className="flex gap-2 items-center">
                                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">MODE: {mode}</span>
                                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest animate-pulse">Live</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={fetchMatches} className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-lg active:scale-95 border border-white/5" title="Aggiorna">
                            <Loader2 className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button onClick={async () => { await cleanupMyMatch(); onClose(); }} className="p-2 text-slate-400 hover:text-white transition-colors bg-white/5 rounded-lg border border-white/5">
                            <XCircle className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="relative z-10 flex-grow overflow-y-auto custom-scroll pr-2 mb-6 space-y-4">
                    {myHostedMatch ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fadeIn">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 rounded-full border-4 border-dashed border-[#FF8800] animate-spin-slow"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Swords className="text-[#FF8800] animate-pulse" size={40} />
                                </div>
                            </div>
                            <h3 className="text-2xl font-black font-orbitron text-white uppercase tracking-wider mb-2">
                                {userProfile?.username || currentUser.user_metadata?.username || 'Guerriero'}
                            </h3>
                            <div className="flex items-center gap-2 mb-8 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                <span className="text-[10px] font-black text-slate-500 uppercase">LIVELLO {userProfile?.max_level || 1}</span>
                            </div>
                            <p className="text-slate-400 text-sm max-w-xs mb-8">Sei in attesa di uno sfidante.<br />La partita inizierà automaticamente.</p>

                            <div className="flex flex-col gap-4 w-full max-w-xs">
                                <div className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between">
                                    <div className="flex flex-col items-start leading-none">
                                        <span className="text-[10px] text-slate-500 uppercase font-black mb-1">Visibilità</span>
                                        <span className="text-green-500 font-black uppercase text-[10px]">TUTTI POSSONO SFIDARTI</span>
                                    </div>
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_#22c55e]"></div>
                                </div>

                                <button
                                    onClick={cleanupMyMatch}
                                    className="w-full py-4 bg-red-600 text-white rounded-xl font-orbitron font-black uppercase tracking-widest text-xs border-2 border-white shadow-lg active:scale-95 transition-all"
                                >
                                    CHIUDI TAVOLO
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Partite in Corso</span>
                                </div>

                                {matches.filter(m => m.player1_id !== currentUser.id).length === 0 && (
                                    <div className="py-4 text-center border border-dashed border-white/5 rounded-xl opacity-40 italic text-[10px] uppercase">Nessuna sfida attiva</div>
                                )}

                                {matches.map((match) => {
                                    const isBusy = match.status === 'active';
                                    const isJoinable = match.status === 'pending' && !match.player2_id;

                                    return (
                                        <div
                                            key={match.id}
                                            onClick={() => isJoinable && setPendingChallenge(match)}
                                            className={`p-4 rounded-2xl flex items-center justify-between transition-all border group
                                            ${isBusy ? 'bg-slate-900/40 border-slate-800 opacity-80 cursor-not-allowed' :
                                                    isJoinable ? 'bg-green-500/5 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.05)] cursor-pointer hover:border-green-500/50 hover:bg-green-500/10 active:scale-[0.98]' :
                                                        'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 ${isBusy ? 'bg-slate-800 border-red-500/30' : 'bg-green-500/10 border-green-500/50 group-hover:border-green-500'}`}>
                                                        {isBusy ? <Swords className="text-red-500" size={20} /> : <Play className="text-green-500" size={20} />}
                                                    </div>
                                                    <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${isBusy ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
                                                </div>
                                                <div>
                                                    <div className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 group-hover:text-green-400 transition-colors">
                                                        {match.player1?.username || match.player1_id?.slice(0, 8) || 'Sconosciuto'}
                                                        {isBusy && <span className="text-red-500 mx-1">VS</span>}
                                                        {isBusy && (match.player2?.username || match.player2_id?.slice(0, 8) || 'Sconosciuto')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">
                                                        LVL {match.player1?.max_level || 1} • {isBusy ? "Partita avviata" : "In attesa di sfidanti"}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                {isBusy ? (
                                                    <span className="text-[9px] bg-red-600 font-black text-white px-2 py-0.5 rounded uppercase tracking-widest border border-red-400/30">IN SFIDA</span>
                                                ) : isJoinable ? (
                                                    <span className="text-[9px] bg-green-500 font-black text-slate-950 px-2 py-0.5 rounded uppercase tracking-widest animate-pulse">PRONTO</span>
                                                ) : (
                                                    <span className="text-[9px] bg-slate-700 font-black text-white px-2 py-0.5 rounded uppercase tracking-widest">PULL</span>
                                                )}
                                                <div className="text-[8px] text-slate-600 font-bold uppercase">{isBusy ? "Occupato" : isJoinable ? "Sfida ora" : "In attesa"}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="space-y-3 pt-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Eye className="w-3 h-3 text-cyan-400" />
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Spettatori in Lobby</span>
                                </div>

                                {(() => {
                                    const observers = onlinePlayers.filter(p => {
                                        const isInMatch = matches.some(m => String(m.player1_id) === String(p.id) || String(m.player2_id) === String(p.id));
                                        const isMe = String(p.id) === String(currentUser.id);
                                        if (isMe) return false;

                                        // LOG PER DIAGNOSTICA
                                        if (isInMatch) {
                                            console.log(`LOBBY: Nascondo ${p.username} (${p.id}) dagli osservatori perche' e' in una partita.`);
                                        } else {
                                            // Debug comparison for the first match if it exists
                                            if (matches.length > 0) {
                                                console.log(`DEBUG VISIBILITY: ${p.username} (${p.id}) NOT IN MATCH. First Match P1: ${matches[0].player1_id}`);
                                            }
                                        }
                                        return !isInMatch;
                                    });

                                    if (observers.length === 0) {
                                        return <p className="text-[10px] text-slate-600 italic text-center py-2 uppercase">Nessun osservatore attivo</p>;
                                    }

                                    return observers.map((player) => (
                                        <div key={player.id} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-between opacity-70">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-slate-800 border border-cyan-500/30 flex items-center justify-center">
                                                    <Eye className="text-cyan-500/50" size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-300 uppercase">{player.username}</div>
                                                    <span className="text-[8px] text-cyan-500/60 font-black uppercase tracking-tighter">OSSERVATORE</span>
                                                </div>
                                            </div>
                                            <div className="text-[8px] text-slate-600 font-mono">CONNESSO</div>
                                        </div>
                                    ));
                                })()}
                            </div>
                        </>
                    )}
                </div>

                {!myHostedMatch && (
                    <div className="relative z-10 flex flex-col gap-3">
                        <button
                            onClick={hostMatch}
                            className={`w-full py-4 rounded-xl font-orbitron font-black text-sm uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 border-2 border-white
                                ${mode === 'blitz' ? 'bg-orange-600' : 'bg-red-600'}`}
                        >
                            <Play size={16} fill="white" /> APRI TAVOLO (IN ATTESA)
                        </button>
                        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/5 rounded-xl justify-center">
                            <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                STATO: <span className="text-cyan-400">OSSERVATORE</span>
                            </span>
                        </div>
                    </div>
                )}

                {pendingChallenge && (
                    <div className="absolute inset-0 z-50 flex items-end justify-center p-6 bg-black/40 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-slate-900 border-2 border-green-500/50 p-6 rounded-[2rem] w-full max-w-sm shadow-2xl animate-slideUp">
                            <div className="flex flex-col items-center text-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500 flex items-center justify-center">
                                    <Swords className="text-green-500" size={28} />
                                </div>
                                <h3 className="text-lg font-black font-orbitron text-white uppercase tracking-wider">CONFERMI SFIDA?</h3>
                                <div className="flex gap-3 w-full mt-2">
                                    <button onClick={() => setPendingChallenge(null)} className="flex-1 py-3 bg-slate-800 text-slate-400 rounded-xl font-black text-xs uppercase border border-slate-700">ANNULLA</button>
                                    <button onClick={() => joinMatch(pendingChallenge.id, pendingChallenge.grid_seed, pendingChallenge.player1_id)} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-xs uppercase shadow-lg">SI, SFIDA!</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default NeuralDuelLobby;
