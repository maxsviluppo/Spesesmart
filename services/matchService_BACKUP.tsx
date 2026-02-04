import { supabase } from './supabaseClient';

export interface Match {
    id: string;
    player1_id: string;
    player2_id: string | null;
    status: 'pending' | 'active' | 'finished' | 'cancelled';
    winner_id: string | null;
    grid_seed: string;
    player1_score: number;
    player2_score: number;
    target_score: number;
    mode: 'standard' | 'blitz';
    p1_rounds: number;
    p2_rounds: number;
    current_round: number;
    created_at: string;
}

export const matchService = {
    // Pulisce partite vecchie "appese" del giocatore
    async cleanupUserMatches(playerId: string) {
        console.log("🧹 Inizializzazione pulizia partite per:", playerId);
        const { error } = await (supabase as any)
            .from('matches')
            .update({ status: 'finished' }) // O delete, ma finished è più sicuro per storico
            .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
            .in('status', ['pending', 'active']);

        if (error) console.error("Errore pulizia sessioni:", error);
    },

    // Crea una nuova richiesta di partita con modalità specifica
    async createMatch(playerId: string, seed: string, mode: 'standard' | 'blitz' = 'standard'): Promise<Match | null> {
        // [IMPORTANT] Prima di creare, puliamo eventuali partite vecchie rimaste "appese"
        await this.cleanupUserMatches(playerId);

        // [SELF-HEALING] Check if profile exists...
        const { data: profileCheck } = await (supabase as any).from('profiles').select('id').eq('id', playerId).maybeSingle();

        if (!profileCheck) {
            console.warn("⚠️ Profile not found for user. Attempting auto-fix...", playerId);
            // Attempt to create a fallback profile
            const { error: profileError } = await (supabase as any).from('profiles').insert([
                { id: playerId, username: 'Player_' + playerId.substring(0, 4), max_level: 1, elo_rating: 1200 }
            ]);
            if (profileError) {
                console.error("❌ CRITICAL: Failed to create fallback profile. Match creation will likely fail.", profileError);
                // We continue anyway hoping for the best (maybe race condition), but log it.
            } else {
                console.info("✅ Profile auto-created. Proceeding with match.");
            }
        }

        const { data, error } = await (supabase as any)
            .from('matches')
            .insert([
                {
                    player1_id: playerId,
                    grid_seed: seed,
                    mode: mode,
                    status: 'pending', // Explicitly set pending
                    target_score: mode === 'blitz' ? 3 : 5, // Blitz rounds are shorter (3 targets), Standard match is 5 targets
                    p1_rounds: 0,
                    p2_rounds: 0,
                    current_round: 1
                }
            ])
            .select() // Returns the created object
            .single();

        if (error) {
            console.error('CREATE MATCH ERROR FULL:', error);
            console.error('Payload:', { player1_id: playerId, grid_seed: seed, mode });

            // Analyze Error Code
            if (error.code === '23503') {
                throw new Error("PROFILO NON TROVATO: Effettua il logout e rientra per sincronizzare i dati.");
            } else if (error.code === '42703') {
                throw new Error("ERRORE SCHEMA: Il database non è aggiornato alle ultime funzionalità.");
            } else {
                throw new Error(`ERRORE SFIDA (${error.code}): ${error.message}`);
            }
            return null;
        }
        return data;
    },

    // Partecipa a una partita esistente
    async joinMatch(matchId: string, playerId: string): Promise<boolean> {
        // [IMPORTANT] Prima di unirci, puliamo le nostre vecchie sessioni
        await this.cleanupUserMatches(playerId);

        const { error } = await (supabase as any)
            .from('matches')
            .update({
                player2_id: playerId,
                status: 'active' // La partita inizia appena entra il secondo giocatore
            })
            .eq('id', matchId)
            .is('player2_id', null); // Sicurezza: controlla che sia ancora libera

        if (error) {
            console.error('Error joining match:', error);
            return false;
        }
        return true;
    },

    // Trova una partita aperta in attesa PER LA STESSA MODALITÀ
    async findOpenMatch(mode: 'standard' | 'blitz' = 'standard'): Promise<Match | null> {
        const { data, error } = await (supabase as any)
            .from('matches')
            .select('*')
            .eq('status', 'pending')
            .eq('mode', mode) // Filter by mode
            .is('player2_id', null)
            .order('created_at', { ascending: false }) // Prendi la più recente
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // Ignora errore "nessuna riga trovata"
            console.error('Error finding match:', error);
        }
        return data || null;
    },

    // Ottieni tutte le partite (Aperte o In Corso) per mostrare lo stato dei giocatori
    async getOpenMatches(mode: 'standard' | 'blitz'): Promise<any[]> {
        console.log("Fetching matches for mode:", mode);

        // Prendiamo SOLO le 'pending' (In Attesa) e le 'active' (In Sfida)
        // Escludiamo le 'finished' per tenere la lobby pulita
        const { data: rawMatches, error: rawError } = await (supabase as any)
            .from('matches')
            .select('*')
            .in('status', ['pending', 'active'])
            .eq('mode', mode)
            .order('created_at', { ascending: false })
            .limit(30);

        if (rawError) {
            console.error('LOBBY ERROR (RAW):', rawError);
            return [];
        }

        console.log(`LOBBY: Raw matches found for ${mode}:`, rawMatches?.length || 0);

        // Now attempt to hydrate with profiles
        const { data, error } = await (supabase as any)
            .from('matches')
            .select(`
                *,
                player1:profiles!player1_id (*),
                player2:profiles!player2_id (*)
            `)
            .in('status', ['pending', 'active'])
            .eq('mode', mode)
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            console.error('LOBBY ERROR (JOINED):', error);
        }

        // STRATEGIA ROBUSTA: Ignoriamo la join automatica se fallisce e IDRATIAMO SEMPRE MANUALMENTE
        // Raccogliamo tutti gli ID unici dai match trovati
        const matchesToReturn = (data && data.length > 0) ? data : (rawMatches || []);
        const userIds = new Set<string>();

        matchesToReturn.forEach((m: any) => { // Type assertion per sicurezza
            if (m.player1_id) userIds.add(m.player1_id);
            if (m.player2_id) userIds.add(m.player2_id);
        });

        if (userIds.size > 0) {
            console.log(`LOBBY: Idratazione manuale per ${userIds.size} profili...`);
            const { data: profiles, error: profileError } = await (supabase as any)
                .from('profiles')
                .select('id, username, max_level')
                .in('id', Array.from(userIds));

            if (profileError) {
                console.error("LOBBY: Errore idratazione profili:", profileError);
            }

            if (profiles) {
                matchesToReturn.forEach((m: any) => {
                    // Sovrascrivi o riempi player1
                    if (m.player1_id) {
                        const p1 = profiles.find((p: any) => p.id === m.player1_id);
                        if (p1) {
                            // Merge per preservare altri campi se presenti
                            m.player1 = m.player1 ? { ...m.player1, ...p1 } : p1;
                        }
                    }
                    // Sovrascrivi o riempi player2
                    if (m.player2_id) {
                        const p2 = profiles.find((p: any) => p.id === m.player2_id);
                        if (p2) {
                            m.player2 = m.player2 ? { ...m.player2, ...p2 } : p2;
                        }
                    }
                });
            }
        }

        return matchesToReturn;
    },

    // Cancella una richiesta di partita (se mi stanco di aspettare)
    async cancelMatch(matchId: string) {
        const { error } = await (supabase as any)
            .from('matches')
            .delete() // O .update({ status: 'cancelled' }) se vogliamo storico. Delete è più pulito per lobby.
            .eq('id', matchId);

        if (error) console.error('Error canceling match:', error);
    },

    // Aggiorna il punteggio di un giocatore
    async updateScore(matchId: string, playerId: string, newScore: number, isPlayer1: boolean) {
        const updateData = isPlayer1
            ? { player1_score: newScore }
            : { player2_score: newScore };

        const { error } = await (supabase as any)
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) console.error('Error updating score:', error);
    },

    // Aggiorna il numero di target trovati
    async updateTargets(matchId: string, isPlayer1: boolean, targetsCount: number) {
        const updateData = isPlayer1
            ? { p1_rounds: targetsCount }
            : { p2_rounds: targetsCount };

        const { error } = await (supabase as any)
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) console.error('Error updating targets:', error);
    },

    // ATOMIC UPDATE: Punteggio + Target insieme per evitare race conditions/glitch di sync
    async updateMatchStats(matchId: string, isPlayer1: boolean, score: number, targetsCount: number) {
        const updateData = isPlayer1
            ? { player1_score: score, p1_rounds: targetsCount }
            : { player2_score: score, p2_rounds: targetsCount };

        const { error } = await (supabase as any)
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) console.error('Error updating match stats:', error);
    },

    // Incrementa i round vinti (Blitz Mode)
    async incrementRound(matchId: string, isPlayer1: boolean, currentRounds: number) {
        const updateData = isPlayer1
            ? { p1_rounds: currentRounds + 1, current_round: currentRounds + 1 } // Note: current_round should probably be handled carefully if both win simulatneously? 
            // Better: just inc p1_rounds. The "current_round" is sum of rounds + 1? Or just cosmetic.
            // Let's just update p1_rounds.
            : { p2_rounds: currentRounds + 1 };

        // For "current_round", purely display? Or actual logic?
        // Let's just update the winner's round count.
        const { error } = await (supabase as any)
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) console.error('Error incrementing round:', error);
    },

    // Dichiara vittoria
    async declareWinner(matchId: string, winnerId: string) {
        const { error } = await (supabase as any)
            .from('matches')
            .update({
                status: 'finished',
                winner_id: winnerId,
                finished_at: new Date().toISOString()
            })
            .eq('id', matchId);

        if (error) console.error('Error declaring winner:', error);
    },

    // Imposta lo stato "Pronto" per il round successivo
    async setPlayerReady(matchId: string, isPlayer1: boolean, ready: boolean) {
        const updateData = isPlayer1
            ? { p1_ready: ready }
            : { p2_ready: ready };

        const { error } = await (supabase as any)
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) console.error('Error setting player ready:', error);
    },

    // Reset degli stati "Pronto" all'inizio di un nuovo round
    async resetRoundStatus(matchId: string) {
        const { error } = await (supabase as any)
            .from('matches')
            .update({ p1_ready: false, p2_ready: false })
            .eq('id', matchId);

        if (error) console.error('Error resetting round status:', error);
    },

    // ABBANDONA PARTITA (Gestione Ritiro)
    async abandonMatch(matchId: string, playerId: string) {
        // 1. Notify Opponent immediately (Fast path)
        await this.sendAbandonment(matchId, playerId);

        // 2. Update DB status
        // If pending, just delete. If active, mark cancelled/finished.
        const { data: match } = await (supabase as any).from('matches').select('status, player1_id, player2_id').eq('id', matchId).single();

        if (match) {
            if (match.status === 'pending') {
                await this.cancelMatch(matchId);
            } else if (match.status === 'active') {
                const winnerId = (match.player1_id === playerId) ? match.player2_id : match.player1_id;
                await (supabase as any)
                    .from('matches')
                    .update({
                        status: 'cancelled',
                        winner_id: winnerId, // Declare the other player as winner
                        finished_at: new Date().toISOString()
                    })
                    .eq('id', matchId);
            }
        }
    },

    // --- MATCH SIGNALING (BROADCAST) ---
    subscribeToMatchEvents(matchId: string, onEvent: (event: string, payload: any) => void) {
        const channel = (supabase as any).channel(`match_${matchId}_events`);

        channel
            .on('broadcast', { event: 'match_abandoned' }, (payload: any) => onEvent('match_abandoned', payload.payload))
            .on('broadcast', { event: 'rematch_started' }, (payload: any) => onEvent('rematch_started', payload.payload))
            .subscribe();

        return channel;
    },

    async sendAbandonment(matchId: string, fromUserId: string) {
        const channel = (supabase as any).channel(`match_${matchId}_events`);
        channel.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
                try {
                    await channel.send({
                        type: 'broadcast',
                        event: 'match_abandoned',
                        payload: { fromUserId }
                    });
                } catch (e) {
                    console.error("Broadcast send failed:", e);
                }
            }
        });
    },

    async sendRematchEvent(matchId: string, newMatchId: string, seed: string) {
        const channel = (supabase as any).channel(`match_${matchId}_events`);
        channel.subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
                try {
                    await channel.send({
                        type: 'broadcast',
                        event: 'rematch_started',
                        payload: { newMatchId, seed }
                    });
                } catch (e) {
                    console.error("Rematch broadcast failed:", e);
                }
            }
        });
    },

    async startRematch(oldMatch: any, newSeed: string) {
        const { data, error } = await (supabase as any)
            .from('matches')
            .insert([
                {
                    player1_id: oldMatch.player1_id,
                    player2_id: oldMatch.player2_id,
                    grid_seed: newSeed,
                    mode: oldMatch.mode,
                    status: 'active',
                    target_score: oldMatch.target_score,
                    p1_rounds: 0,
                    p2_rounds: 0,
                    current_round: 1
                }
            ])
            .select()
            .single();

        if (error) {
            console.error('Error creating rematch:', error);
            return null;
        }
        return data;
    },
    // Iscriviti agli aggiornamenti di una partita specifica
    subscribeToMatch(matchId: string, callback: (payload: any) => void) {
        return (supabase as any)
            .channel(`match:${matchId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
                (payload: any) => callback(payload)
            )
            .subscribe();
    },

    // VERIFY MATCH STATUS (Fallback check)
    // Returns:
    // - Data object: Match exists
    // - null: Match definitively missing (PGRST116)
    // - { status: 'ERROR' }: Transient error, ignore this check
    async verifyMatchStatus(matchId: string) {
        const { data, error } = await (supabase as any)
            .from('matches')
            .select('status, winner_id')
            .eq('id', matchId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Row missing
            console.warn("Sync Watchdog Transient Error:", error.message);
            return { status: 'ERROR' };
        }
        return data;
    }
};
