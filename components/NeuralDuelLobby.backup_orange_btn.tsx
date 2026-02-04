import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Swords, Loader2, XCircle, User, Play, Eye, Radio, Search, Send, Trophy } from 'lucide-react';
import { matchService, Match } from '../services/matchService';
import { soundService } from '../services/soundService';
import { supabase, profileService } from '../services/supabaseClient';

interface NeuralDuelProps {
    currentUser: any;
    onClose: () => void;
    onMatchStart: (seed: string, matchId: string, opponentId: string, isP1: boolean) => void;
    mode: 'standard' | 'blitz' | 'time_attack';
    showToast: (msg: string) => void;
    userProfile?: any;
    onlinePlayers: any[];
}

const NeuralDuelLobby: React.FC<NeuralDuelProps> = ({ currentUser, onClose, onMatchStart, mode, showToast, userProfile, onlinePlayers }) => {
    const [matches, setMatches] = useState<any[]>([]);
    const [myHostedMatch, setMyHostedMatch] = useState<Match | null>(null);
    const [loading, setLoading] = useState(false);
    const [pendingChallenge, setPendingChallenge] = useState<any | null>(null);
    const channelRef = useRef<any>(null);
    const isFetchingRef = useRef(false);

    // NEW: Invite System State
    const [activeTab, setActiveTab] = useState<'lobby' | 'invite' | 'new_friend'>('lobby');
    const [inviteEmail, setInviteEmail] = useState('');
    const [sentInvites, setSentInvites] = useState<{ email: string, date: string, status: 'pending' | 'success', rewarded: boolean }[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('neural_sent_invites') || '[]');
        } catch { return []; }
    });

    // Check Invite Status
    useEffect(() => {
        const checkInvites = async () => {
            if (activeTab === 'new_friend') {
                const pending = sentInvites.filter(i => i.status === 'pending');
                if (pending.length === 0) return;

                const updatedInvites = [...sentInvites];
                let pointsAwarded = 0;

                for (const inv of pending) {
                    const { data } = await supabase.from('profiles').select('id').eq('email', inv.email).maybeSingle();
                    if (data) {
                        // Found! Update status
                        const idx = updatedInvites.findIndex(i => i.email === inv.email);
                        if (idx !== -1) {
                            updatedInvites[idx].status = 'success';
                            updatedInvites[idx].rewarded = true;
                            pointsAwarded += 100;
                        }
                    }
                }

                if (pointsAwarded > 0) {
                    setSentInvites(updatedInvites);
                    localStorage.setItem('neural_sent_invites', JSON.stringify(updatedInvites));

                    // Award Points
                    await profileService.syncProgress(currentUser.id, pointsAwarded, 0, 0);
                    soundService.playSuccess();
                    showToast(`AMICO TROVATO! +${pointsAwarded} Punti Bonus!`);
                }
            }
        };
        checkInvites();
    }, [activeTab]);

    const handleSendEmailInvite = async () => {
        if (!inviteEmail.includes('@')) {
            showToast("Indirizzo email non valido");
            return;
        }

        soundService.playUIClick();

        // Add to list
        const newInvite = { email: inviteEmail, date: new Date().toLocaleDateString(), status: 'pending' as const, rewarded: false };
        const newList = [newInvite, ...sentInvites];
        setSentInvites(newList);
        localStorage.setItem('neural_sent_invites', JSON.stringify(newList));

        setInviteEmail('');

        // Open Mail Client
        const subject = "Sfida su Neural Duel!";
        const body = `Ciao! Unisciti a me su Neural Duel e sfidami in battaglie di intelligenza. Scarica l'app qui: ${window.location.origin}`;
        window.location.href = `mailto:${inviteEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

        showToast("Invito inviato! Controlla la lista.");
    };
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [h2hStats, setH2hStats] = useState<Record<string, { wins: number; losses: number }>>({});
    const fetchH2H = async (opponentIds: string[]) => {
        if (!currentUser?.id || opponentIds.length === 0) return;

        try {
            console.log("H2H: Fetching stats for IDs:", opponentIds);
            const stats = await matchService.getHeadToHeadStats(currentUser.id, opponentIds);
            console.log("H2H: Received stats:", stats);
            if (stats && Object.keys(stats).length > 0) {
                setH2hStats(prev => ({ ...prev, ...stats }));
            }
        } catch (e: any) {
            if (e.name !== 'AbortError' && e.message !== 'signal is aborted without reason') {
                console.error("Error fetching H2H stats:", e);
            }
        }
    };

    // Live Search with Debounce
    useEffect(() => {
        if (activeTab !== 'invite') return;

        const timer = setTimeout(() => {
            handleSearch();
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [searchQuery, activeTab]);

    const handleSearch = async () => {
        // Allow empty query to fetch recent users
        setIsSearching(true);
        try {
            const results = await profileService.searchUsers(searchQuery);
            if (!results) return;

            // Filter out myself
            const filtered = results.filter((u: any) => u.id !== currentUser.id);
            setSearchResults(filtered);

            if (filtered.length > 0) {
                const searchOpponentIds = filtered.map((u: any) => u.id);
                fetchH2H(searchOpponentIds);
            }
        } catch (e: any) {
            if (e.name !== 'AbortError' && e.message !== 'signal is aborted without reason') {
                console.error("Search error", e);
            }
        } finally {
            setIsSearching(false);
        }
    };

    const handleInvite = async (userToInvite: any) => {
        soundService.playUIClick();
        const seed = Math.random().toString(36).substring(7);
        try {
            const newMatch = await matchService.createInviteMatch(currentUser.id, userToInvite.id, seed, mode);

            if (newMatch) {
                setMyHostedMatch(newMatch);
                showToast(`Invito inviato a ${userToInvite.username}`);

                channelRef.current = matchService.subscribeToMatch(newMatch.id, (payload) => {
                    if (payload.new.status === 'active') {
                        onMatchStart(newMatch.grid_seed, newMatch.id, payload.new.player2_id, true);
                    } else if (payload.new.status === 'finished' || payload.new.status === 'cancelled') {
                        showToast(`${userToInvite.username} ha rifiutato l'invito.`);
                        setMyHostedMatch(null);
                    }
                });
                return newMatch;
            }
        } catch (e: any) {
            console.error('Invite error:', e);
            showToast("Errore invio invito");
        }
        return null;
    };

    const handleShareInvite = async (user: any) => {
        // REUSE handleInvite to ensure match is created/synced correctly
        // Check if I'm already hosting against this user? 
        // handleInvite cleans up previous matches, so it creates a FRESH one.
        const match = await handleInvite(user);

        if (match) {
            const joinUrl = `${window.location.origin}${window.location.pathname}?joinMatch=${match.id}`;
            const title = `Sfida a Neural Duel!`;
            const text = `Ciao ${user.username}, ti sfido a Neural Duel! 🧠⚔️\nAccetta la sfida qui e DOVEVINCERE! 👇\n${joinUrl}`;

            if (navigator.share) {
                try {
                    await navigator.share({
                        title: title,
                        text: text,
                        url: joinUrl
                    });
                    showToast("Link sfida condiviso!");
                } catch (err) {
                    console.log('Share cancelled or failed', err);
                }
            } else {
                try {
                    await navigator.clipboard.writeText(text);
                    showToast("Link copiato negli appunti! Incollalo dove vuoi.");
                } catch (err) {
                    showToast("Impossibile condividere automaticamente.");
                }
            }
        }
    };

    const fetchMatches = useCallback(async () => {
        if (isFetchingRef.current) return;
        try {
            isFetchingRef.current = true;
            setLoading(true);
            // 1. CLEANUP STALE MATCHES FIRST (Self-healing)
            if (currentUser?.id) {
                // Optional: We could do this server side, but client-side check is fine for now
                // Logic inside matchService.getOpenMatches filters finished ones, but we want to know about OUR zombie matches
            }

            const data = await matchService.getOpenMatches(mode);
            setMatches(data);

            // 2. SYNC HOST STATUS
            // If I find a match hosted by ME in the list, resync my local state
            const myServerMatch = data.find((m: any) => m.player1_id === currentUser.id && m.status === 'pending');

            if (myServerMatch) {
                if (!myHostedMatch) {
                    console.log("LOBBY: Found existing hosted match, recovering...");
                    setMyHostedMatch(myServerMatch);
                }
            } else {
                // If I think I'm hosting but server says NO (e.g. it was filled or cancelled elsewhere), clear local
                if (myHostedMatch && myHostedMatch.status === 'pending') {
                    // Double check? No, just clear to be safe, or keep it if it's invite_pending?
                    // For now, if it's gone from 'pending' list, it might be active or dead.
                    // Let's trust local state for invites, but for public pending matches, trust server.
                }
            }

            // Fetch H2H for lobby participants
            const opponentIds = Array.from(new Set(data.map((m: any) => m.player1_id).filter((id: any) => id && id !== currentUser.id)));
            if (opponentIds.length > 0) {
                fetchH2H(opponentIds as string[]);
            }

        } catch (err: any) {
            if (err.name !== 'AbortError' && err.message !== 'signal is aborted without reason') {
                console.error("LOBBY: Errore nel caricamento partite:", err);
            }
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, [mode, currentUser?.id, myHostedMatch]);

    // INITIAL CLEANUP ON MOUNT
    useEffect(() => {
        if (currentUser?.id) {
            matchService.cleanupUserMatches(currentUser.id)
                .then(() => fetchMatches()) // Fetch fresh after cleanup
                .catch(e => console.error("Initial cleanup error", e));
        }
    }, [currentUser?.id]);

    const cleanupMyMatch = useCallback(async () => {
        if (myHostedMatch) {
            await matchService.cancelMatch(myHostedMatch.id);
            setMyHostedMatch(null);
        }
    }, [myHostedMatch]);

    useEffect(() => {
        const matchesChannel = (supabase as any)
            .channel(`lobby_matches_${mode}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, (payload: any) => {
                console.log("MATCH CHANGE DETECTED:", payload.eventType, payload.new?.id);
                fetchMatches();
            })
            .subscribe();

        fetchMatches();
        const intervalId = setInterval(fetchMatches, 5000);

        return () => {
            clearInterval(intervalId);
            (supabase as any).removeChannel(matchesChannel);
        };
    }, [mode, fetchMatches]);

    const myInvites = matches.filter(m => m.status === 'invite_pending' && m.player2_id === currentUser.id);
    const lobbyMatches = matches.filter(m => m.player1_id !== currentUser.id && m.status !== 'invite_pending');

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

    const handleInviteNewFriend = async () => {
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

                const joinUrl = `${window.location.origin}${window.location.pathname}?joinMatch=${newMatch.id}`;
                const title = "Sfida a Neural Duel!";
                const text = `Ti sfido a Neural Duel! 🧠\nClicca qui per accettare la sfida: ${joinUrl}`;

                if (navigator.share) {
                    try {
                        await navigator.share({ title, text, url: joinUrl });
                    } catch (err) { console.log('Share dismissed', err); }
                } else {
                    await navigator.clipboard.writeText(text);
                    showToast("Link sfida copiato!");
                }
            }
        } catch (e: any) {
            console.error('Invite New error:', e);
            showToast("Errore creazione invito");
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

    const handleAcceptInvite = async (match: any) => {
        soundService.playUIClick();
        try {
            const success = await matchService.acceptInvite(match.id, currentUser.id);
            if (success) {
                soundService.playSuccess();
                onMatchStart(match.grid_seed, match.id, match.player1_id, false);
            } else {
                showToast("Invito non più valido.");
                fetchMatches();
            }
        } catch (e) {
            console.error('Accept invite error:', e);
            showToast("Errore accettazione invito");
        }
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fadeIn p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-[2rem] w-full max-w-2xl h-[85vh] flex flex-col relative shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

                {/* Header */}
                <div className="relative z-10 mb-6 border-b border-white/10">
                    <div className="flex items-center justify-between pb-4">
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

                    {/* TABS */}
                    <div className="flex items-center justify-between px-2 mt-2">
                        <div className="flex gap-8">
                            <button
                                onClick={() => setActiveTab('lobby')}
                                className={`pb-2 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'lobby' ? 'text-white border-[#FF8800]' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                            >
                                Lobby Pubblica
                            </button>
                            <button
                                onClick={() => setActiveTab('invite')}
                                className={`pb-2 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${activeTab === 'invite' ? 'text-white border-green-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                            >
                                Sfida Amico
                            </button>
                        </div>

                        <button
                            onClick={handleInviteNewFriend}
                            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-lg font-black font-orbitron uppercase tracking-wider text-[10px] border border-white/20 shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
                        >
                            <Send size={12} />
                            INVITA AMICO
                        </button>
                    </div>
                </div>

                <div className="relative z-10 flex-grow overflow-y-auto custom-scroll pr-2 mb-6 space-y-4">
                    {/* HOSTED MATCH VIEW (Waiting) */}
                    {myHostedMatch ? (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 animate-fadeIn">
                            <div className="relative mb-8">
                                <div className={`w-24 h-24 rounded-full border-4 border-dashed animate-spin-slow ${activeTab === 'invite' ? 'border-green-500' : 'border-[#FF8800]'}`}></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    {activeTab === 'invite' ? <Send className="text-green-500 animate-pulse" size={32} /> : <Swords className="text-[#FF8800] animate-pulse" size={40} />}
                                </div>
                            </div>
                            <h3 className="text-2xl font-black font-orbitron text-white uppercase tracking-wider mb-2">
                                {userProfile?.username || currentUser.user_metadata?.username || 'Guerriero'}
                            </h3>
                            <div className="flex items-center gap-2 mb-8 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                <span className="text-[10px] font-black text-slate-500 uppercase">LIVELLO {userProfile?.max_level || 1}</span>
                            </div>

                            <p className="text-slate-400 text-sm max-w-xs mb-8">
                                {matches.some(m => m.id === myHostedMatch.id && m.status === 'invite_pending')
                                    ? "Invito inviato. In attesa di risposta..."
                                    : "Sei in attesa di uno sfidante. La partita inizierà automaticamente."}
                            </p>

                            <div className="flex flex-col gap-4 w-full max-w-xs">
                                <button
                                    onClick={cleanupMyMatch}
                                    className="w-full py-4 bg-red-600 text-white rounded-xl font-orbitron font-black uppercase tracking-widest text-xs border-2 border-white shadow-lg active:scale-95 transition-all"
                                >
                                    ANNULLA
                                </button>
                            </div>
                        </div>
                    ) : (
                        // NOT HOSTING -> SHOW LOBBY OR INVITE TABS
                        <>
                            {activeTab === 'lobby' && (
                                <div className="space-y-6">
                                    {/* HOST ACTION */}
                                    {!myHostedMatch && (
                                        <button
                                            onClick={hostMatch}
                                            className="w-full py-4 bg-gradient-to-r from-orange-500 to-amber-600 text-white rounded-2xl font-black font-orbitron uppercase tracking-widest text-xs border-2 border-white/20 shadow-[0_8px_20px_rgba(249,115,22,0.3)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
                                                <Swords size={18} />
                                            </div>
                                            APRI NUOVA SFIDA PUBBLICA
                                        </button>
                                    )}



                                    {/* INCOMING INVITES SECTION */}
                                    {myInvites.length > 0 && (
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Send className="w-3 h-3 text-green-500 animate-pulse rotate-180" />
                                                <span className="text-[10px] font-black text-green-500 uppercase tracking-[0.2em]">Inviti Ricevuti</span>
                                            </div>
                                            {myInvites.map(match => (
                                                <div key={match.id} className="p-4 bg-green-500/10 border border-green-500/30 rounded-2xl flex items-center justify-between animate-fadeIn translate-y-0 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-green-500/50 overflow-hidden">
                                                                {match.player1?.avatar_url ? (
                                                                    <img src={match.player1.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-green-500 font-bold uppercase">{match.player1?.username?.charAt(0) || 'S'}</div>
                                                                )}
                                                            </div>
                                                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${onlinePlayers.some(p => p.id === match.player1_id) ? 'bg-green-500' : 'bg-red-500/50'}`}></div>
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-black text-white uppercase tracking-wider">{match.player1?.username || 'Sconosciuto'}</div>
                                                            <div className="text-[10px] text-green-400 font-bold uppercase tracking-tighter mb-1">Ti ha sfidato!</div>
                                                            {h2hStats[match.player1_id] && (
                                                                <div className="flex gap-2 text-[9px] font-black uppercase">
                                                                    <span className="text-green-500 font-bold">Vinte: {h2hStats[match.player1_id].wins}</span>
                                                                    <span className="text-red-500 font-bold">Perse: {h2hStats[match.player1_id].losses}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button onClick={() => handleAcceptInvite(match)} className="px-5 py-2 bg-green-500 text-slate-950 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-green-400 transition-all active:scale-95 shadow-lg">ACCETTA</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* PUBLIC MATCHES SECTION */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-2">
                                            <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Partite in Corso</span>
                                        </div>

                                        {lobbyMatches.length === 0 && (
                                            <div className="py-8 text-center border border-dashed border-white/5 rounded-xl opacity-40 italic text-[10px] uppercase flex flex-col items-center gap-2">
                                                <Swords size={24} className="opacity-20" />
                                                Nessuna sfida attiva in {mode}
                                            </div>
                                        )}

                                        {lobbyMatches.map((match) => {
                                            const isBusy = match.status === 'active';
                                            const isJoinable = match.status === 'pending' && !match.player2_id;
                                            const player = match.player1;

                                            return (
                                                <div
                                                    key={match.id}
                                                    onClick={() => isJoinable && setPendingChallenge(match)}
                                                    className={`p-4 rounded-2xl flex items-center justify-between transition-all border group
                                                        ${isBusy ? 'bg-slate-900/40 border-slate-800 opacity-80 cursor-not-allowed' :
                                                            isJoinable ? 'bg-white/5 border-white/5 shadow-[0_0_20px_rgba(255,255,255,0.02)] cursor-pointer hover:border-cyan-500/30 hover:bg-white/[0.07] active:scale-[0.98]' :
                                                                'bg-slate-900/40 border-slate-800 opacity-50 cursor-not-allowed'}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className={`w-11 h-11 rounded-full overflow-hidden border-2 ${isBusy ? 'border-red-500/30' : 'border-white/10 group-hover:border-cyan-500/50'}`}>
                                                                {player?.avatar_url ? (
                                                                    <img src={player.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold uppercase text-xs">{player?.username?.charAt(0) || '?'}</div>
                                                                )}
                                                            </div>
                                                            {/* Online Status Dot */}
                                                            <div className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${onlinePlayers.some(p => p.id === match.player1_id) ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500/50'}`}></div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 group-hover:text-cyan-400 transition-colors truncate">
                                                                <span className="truncate">{player?.username || match.player1_id?.slice(0, 8) || 'Sconosciuto'}</span>
                                                                {isBusy && <span className="text-red-500 mx-1 text-[8px] shrink-0">VS</span>}
                                                                {isBusy && <span className="truncate">{match.player2?.username || match.player2_id?.slice(0, 8) || 'Sconosciuto'}</span>}
                                                            </div>
                                                            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-tight truncate">
                                                                LVL {player?.max_level || 1} • {isBusy ? "In Sfida" : "Pronto a combattere"}
                                                            </div>
                                                            {h2hStats[player?.id || match.player1_id] ? (
                                                                <div className="flex gap-2 text-[9px] font-black uppercase mt-1">
                                                                    <span className="text-green-500 font-bold">Vinte: {h2hStats[player?.id || match.player1_id].wins}</span>
                                                                    <span className="text-red-500 font-bold">Perse: {h2hStats[player?.id || match.player1_id].losses}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-2 text-[9px] font-black uppercase mt-1 opacity-20">
                                                                    <span>Vinte: 0</span>
                                                                    <span>Perse: 0</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-1">
                                                        {isBusy ? (
                                                            <span className="text-[9px] bg-red-600 font-black text-white px-2 py-0.5 rounded uppercase tracking-widest border border-red-400/30">LOCKED</span>
                                                        ) : isJoinable ? (
                                                            <span className="text-[9px] bg-[#FF8800] font-black text-white px-2 py-0.5 rounded uppercase tracking-widest group-hover:animate-pulse">SFIDA</span>
                                                        ) : (
                                                            <span className="text-[9px] bg-slate-700 font-black text-white px-2 py-0.5 rounded uppercase tracking-widest">PRIVATE</span>
                                                        )}
                                                        <div className="text-[8px] text-slate-600 font-bold uppercase">{isBusy ? "Occupato" : isJoinable ? "Libero" : "Invito"}</div>
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
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-bold text-slate-300 uppercase truncate">{player.username}</div>
                                                            <span className="text-[8px] text-cyan-500/60 font-black uppercase tracking-tighter">OSSERVATORE</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-[8px] text-slate-600 font-mono">CONNESSO</div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'invite' && (
                                <div className="space-y-6 px-2 animate-fadeIn">
                                    {/* SEARCH BAR */}
                                    <div className="flex gap-2">
                                        <div className="relative flex-grow">
                                            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                                                <Search className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Cerca per nome utente..."
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-bold"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <button
                                            onClick={handleSearch}
                                            disabled={isSearching}
                                            className="bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 px-4 rounded-xl active:scale-95 transition-all hover:bg-cyan-600/30 font-bold"
                                        >
                                            {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                                        </button>
                                    </div>

                                    {/* RESULTS LIST */}
                                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400 mb-2 mt-4 ml-1">
                                        {searchQuery.length > 0 ? 'Risultati Ricerca' : 'Giocatori Recenti'}
                                    </h3>
                                    <div className="space-y-3">
                                        {searchResults.length > 0 && (
                                            searchResults.map((user) => (
                                                <div key={user.id} className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-white/10 overflow-hidden">
                                                                {user.avatar_url ? (
                                                                    <img src={user.avatar_url} className="w-full h-full object-cover" alt={user.username} />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">{user.username.charAt(0)}</div>
                                                                )}
                                                            </div>
                                                            {/* Status Indicator */}
                                                            <div
                                                                className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${onlinePlayers.some(p => p.id === user.id)
                                                                    ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]'
                                                                    : 'bg-red-500/50'
                                                                    }`}
                                                                title={onlinePlayers.some(p => p.id === user.id) ? "Online nel Gioco" : "Offline"}
                                                            ></div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-white font-bold uppercase tracking-wider text-sm truncate">{user.username}</div>
                                                            <div className="text-[10px] text-slate-500 font-black uppercase truncate">Lv. {user.max_level || 1} • {user.total_score || 0} Pts</div>
                                                            {h2hStats[user.id] ? (
                                                                <div className="flex gap-2 text-[9px] font-black uppercase mt-1">
                                                                    <span className="text-green-500 font-bold">Vinte: {h2hStats[user.id].wins}</span>
                                                                    <span className="text-red-500 font-bold">Perse: {h2hStats[user.id].losses}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex gap-2 text-[9px] font-black uppercase mt-1 opacity-20">
                                                                    <span>Vinte: 0</span>
                                                                    <span>Perse: 0</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2 shrink-0">
                                                        {/* SHARE BUTTON (Replaces Email) */}
                                                        <button
                                                            onClick={() => handleShareInvite(user)}
                                                            disabled={myHostedMatch !== null && myHostedMatch.player2_id !== user.id}
                                                            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95
                                                                    ${(myHostedMatch !== null && myHostedMatch.player2_id !== user.id)
                                                                    ? 'bg-slate-800 border-slate-700 text-slate-600 cursor-not-allowed'
                                                                    : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/30 hover:text-white'}`}
                                                            title="Condividi Link Sfida (WhatsApp, Telegram, etc.)"
                                                        >
                                                            <Send size={14} />
                                                        </button>

                                                        <button
                                                            onClick={() => handleInvite(user)}
                                                            disabled={myHostedMatch !== null} // Disable if already hosting
                                                            className={`w-8 h-8 flex items-center justify-center rounded-lg border transition-all active:scale-95
                                                                        ${myHostedMatch
                                                                    ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
                                                                    : 'bg-green-500 text-white border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.3)] hover:scale-105 hover:bg-green-400'}`}
                                                            title={myHostedMatch ? "Sei già occupato" : "Invita a Giocare"}
                                                        >
                                                            <Swords size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )))}
                                    </div>
                                    {!isSearching && searchQuery.length > 2 && searchResults.length === 0 && (
                                        <div className="text-center py-8 opacity-50 text-xs italic">Nessun giocatore trovato</div>
                                    )}
                                </div>
                            )}

                            {/* NEW FRIEND TAB Content */}
                            {/* NEW FRIEND TAB REMOVED */}

                        </>
                    )}
                </div>
            </div>

            {/* PENDING CHALLENGE MODAL */}
            {
                pendingChallenge && (
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
                )
            }
        </div >
    );
};

export default NeuralDuelLobby;
