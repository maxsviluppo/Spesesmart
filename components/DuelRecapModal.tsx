import React, { useState, useEffect } from 'react';
import { Swords, CheckCircle2, Clock, Trophy, XCircle, RotateCw, Home, User, Play } from 'lucide-react';
import { matchService } from '../services/matchService';
import { soundService } from '../services/soundService';

interface DuelRecapProps {
    matchData: any;
    currentUser: any;
    myScore: number;
    opponentScore: number;
    roundWinnerId: string | null; // Null if waiting, or ID of round winner
    isFinal: boolean; // True if Blitz ended or Standard ended
    onReady: () => void; // Triggered when server says GO
    onExit: () => void;
    isWinnerProp?: boolean; // Override derived logic
}

const DuelRecapModal: React.FC<DuelRecapProps> = ({
    matchData,
    currentUser,
    myScore,
    opponentScore,
    isFinal,
    onReady,
    onExit,
    isWinnerProp
}) => {
    const [isLocalReady, setIsLocalReady] = useState(false);

    // Determine status
    const amIP1 = matchData?.player1_id === currentUser.id;
    const derivedWinner = matchData?.winner_id === currentUser.id;
    const isWinner = isWinnerProp !== undefined ? isWinnerProp : derivedWinner;

    const myRounds = amIP1 ? (matchData.p1_rounds || 0) : (matchData.p2_rounds || 0);
    const oppRounds = amIP1 ? (matchData.p2_rounds || 0) : (matchData.p1_rounds || 0);

    // Sync Ready State from Match Data (if someone else sets it)
    const remoteReady = amIP1 ? matchData.p1_ready : matchData.p2_ready;
    const otherReady = amIP1 ? matchData.p2_ready : matchData.p1_ready;

    useEffect(() => {
        if (remoteReady) setIsLocalReady(true);
        else setIsLocalReady(false);
    }, [remoteReady]);

    // Play Win Sound for whole match
    useEffect(() => {
        if (isFinal && isWinner) {
            soundService.playExternalSound('Fine_partita_win.mp3');
        }
    }, [isFinal, isWinner]);

    const handleReadyClick = async () => {
        if (isLocalReady) return;
        setIsLocalReady(true);
        soundService.playSuccess();
        // Update DB
        await matchService.setPlayerReady(matchData.id, amIP1, true);
    };

    const isAbandonment = (matchData?.status === 'finished' || matchData?.status === 'cancelled') &&
        matchData?.winner_id &&
        (!isFinal || matchData?.status === 'cancelled');

    return (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 modal-overlay bg-black/95 backdrop-blur-xl animate-fadeIn">
            <div className="bg-slate-900/80 border border-white/10 w-full max-w-[550px] rounded-[2rem] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5),0_0_40px_rgba(255,136,0,0.1)] flex flex-col relative overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>

                {/* HEADER COMPATTO */}
                <div className="relative z-10 bg-black/40 p-5 border-b border-white/5 text-center">
                    <h2 className="text-2xl font-black font-orbitron text-white uppercase tracking-wider flex items-center justify-center gap-3">
                        <Swords className="text-[#FF8800]" size={24} />
                        {isWinner ? "VITTORIA" : "SCONFITTA"}
                    </h2>
                    <p className={`text-[10px] font-black uppercase tracking-[0.3em] mt-1 ${isWinner ? 'text-green-400' : 'text-red-400'}`}>
                        {isAbandonment ? "PER ABBANDONO" : (isWinner ? "DOMINION" : "BATTO IN RITIRATA")}
                    </p>
                </div>

                {/* AREA CONTENUTI */}
                <div className="relative z-10 p-8 grid grid-cols-[1fr_auto_1fr] items-center gap-4">

                    {/* TU */}
                    <div className={`flex flex-col items-center gap-3 transition-all duration-300 ${isWinner ? 'scale-105' : 'opacity-70'}`}>
                        {matchData?.mode === 'blitz' ? (
                            <div className={`w-28 h-28 rounded-2xl flex flex-col items-center justify-center shadow-xl relative transition-all border-2
                                ${isWinner ? 'bg-[#FF8800]/10 border-[#FF8800]' : 'bg-white/5 border-white/10'}`}>
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-[9px] font-black text-white/50 uppercase mb-1">TARGETS</span>
                                    <span className={`font-orbitron font-black text-4xl ${isWinner ? 'text-[#FF8800]' : 'text-white'}`}>{myRounds}</span>
                                </div>
                                <div className="w-full h-[1px] bg-white/10 my-1"></div>
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-[7px] font-black text-white/30 uppercase">PTS</span>
                                    <span className={`font-orbitron font-bold text-xl ${isWinner ? 'text-[#FF8800]/80' : 'text-white/50'}`}>{myScore}</span>
                                </div>
                            </div>
                        ) : (
                            <div className={`w-28 h-28 rounded-2xl flex flex-col items-center justify-center shadow-xl relative transition-all
                                ${isWinner ? 'bg-[#FF8800]/5' : 'bg-white/5'}`}>
                                <span className="text-[9px] font-black text-white/30 uppercase absolute top-2">PUNTI</span>
                                <span className={`font-orbitron font-black text-4xl ${isWinner ? 'text-[#FF8800]' : 'text-white'}`}>{myScore}</span>
                            </div>
                        )}

                        <div className="flex flex-col items-center">
                            <span className="text-white font-black uppercase text-[11px] tracking-wider">TU</span>
                            <div className="flex flex-col items-center">
                                {/* Only show XP gain if not Blitz (since Blitz shows Points inside box or we can duplicate) */}
                                {matchData?.mode !== 'blitz' && <span className="text-[#FF8800] font-bold text-[9px] mt-0.5">+{myScore} XP</span>}
                                {matchData?.mode === 'blitz' && <span className="text-[#FF8800] font-bold text-[9px] mt-0.5">+{myScore} XP</span>}

                                {isWinner && (matchData?.last_time_bonus > 0 || matchData?.last_victory_bonus > 0) && (
                                    <div className="mt-2 space-y-0.5 bg-black/20 p-2 rounded-lg border border-white/5 w-full min-w-[120px]">
                                        {matchData.last_victory_bonus > 0 && (
                                            <div className="flex justify-between items-center text-[7px] font-black tracking-tighter uppercase">
                                                <span className="text-white/40">BONUS VITTORIA</span>
                                                <span className="text-green-400">+{matchData.last_victory_bonus}</span>
                                            </div>
                                        )}
                                        {matchData.last_time_bonus > 0 && (
                                            <div className="flex justify-between items-center text-[7px] font-black tracking-tighter uppercase">
                                                <span className="text-white/40">BONUS TEMPO</span>
                                                <span className="text-green-400">+{matchData.last_time_bonus}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* VS */}
                    <div className="flex flex-col items-center gap-2 px-2">
                        <div className="h-12 w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                        <span className="font-black font-orbitron text-2xl text-white/10 italic">VS</span>
                        <div className="h-12 w-[1px] bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
                    </div>

                    {/* AVVERSARIO */}
                    <div className={`flex flex-col items-center gap-3 transition-all duration-300 ${!isWinner ? 'scale-105' : 'opacity-50'}`}>
                        {matchData?.mode === 'time_attack' ? (
                            <div className={`w-28 h-28 rounded-2xl flex flex-col items-center justify-center shadow-xl relative transition-all
                                ${!isWinner ? 'bg-green-500/5' : 'bg-white/5'}`}>
                                <Clock size={24} className="text-white/30 mb-1" />
                                <span className="font-orbitron font-black text-2xl text-white/60">60s</span>
                            </div>
                        ) : matchData?.mode === 'blitz' ? (
                            <div className={`w-28 h-28 rounded-2xl flex flex-col items-center justify-center shadow-xl relative transition-all border-2
                                ${!isWinner ? 'bg-green-500/10 border-green-500' : 'bg-white/5 border-white/10'}`}>
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-[9px] font-black text-white/50 uppercase mb-1">TARGETS</span>
                                    <span className={`font-orbitron font-black text-4xl ${!isWinner ? 'text-green-500' : 'text-white'}`}>{oppRounds}</span>
                                </div>
                                <div className="w-full h-[1px] bg-white/10 my-1"></div>
                                <div className="flex flex-col items-center justify-center leading-none">
                                    <span className="text-[7px] font-black text-white/30 uppercase">PTS</span>
                                    <span className={`font-orbitron font-bold text-xl ${!isWinner ? 'text-green-500/80' : 'text-white/50'}`}>{opponentScore}</span>
                                </div>
                            </div>
                        ) : (
                            <div className={`w-28 h-28 rounded-2xl flex flex-col items-center justify-center shadow-xl relative transition-all
                                ${!isWinner ? 'bg-green-500/5' : 'bg-white/5'}`}>
                                <span className="text-[9px] font-black text-white/30 uppercase absolute top-2">PUNTI</span>
                                <span className={`font-orbitron font-black text-4xl ${!isWinner ? 'text-green-500' : 'text-white/60'}`}>{opponentScore}</span>
                            </div>
                        )}

                        <div className="flex flex-col items-center text-center">
                            <span className="text-white/70 font-black uppercase text-[11px] tracking-wider truncate max-w-[100px]">
                                {amIP1 ? matchData.player2?.username : matchData.player1?.username || 'Avversario'}
                            </span>
                            <span className="text-white/20 font-bold text-[9px] mt-0.5">LIVELLO {amIP1 ? matchData.player2?.max_level || 1 : matchData.player1?.max_level || 1}</span>
                        </div>
                    </div>

                </div>

                {/* FOOTER ACTIONS */}
                <div className="relative z-10 bg-black/40 p-6 flex gap-3 border-t border-white/5">
                    <button
                        onClick={() => { soundService.playUIClick(); onExit(); }}
                        className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white rounded-xl font-orbitron font-black text-[11px] uppercase tracking-widest transition-all active:scale-95 border border-white/10 flex items-center justify-center gap-2"
                    >
                        <Home size={16} /> LOBBY
                    </button>


                </div>
            </div>
        </div>
    );
};


export default DuelRecapModal;
