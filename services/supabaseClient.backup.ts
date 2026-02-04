import { createClient, User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseClient: any;

// SAFE INITIALIZATION: Prevent crash if Envs are missing (Vercel Build step or unconfigured env)
try {
    if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    } else {
        console.warn('⚠️ Supabase credentials missing! App running in Offline/Demo mode.');
        // Create a Dummy Client that simply returns null/errors without crashing
        supabaseClient = {
            auth: {
                getSession: async () => ({ data: { session: null } }),
                getUser: async () => ({ data: { user: null } }),
                signUp: async () => ({ error: { message: 'Offline Mode' } }),
                signInWithPassword: async () => ({ error: { message: 'Offline Mode' } }),
                signOut: async () => ({ error: null }),
                onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
            },
            from: () => ({
                select: () => ({
                    eq: () => ({ single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null }) }),
                    order: () => ({ limit: async () => ({ data: [] }) }),
                    upsert: async () => ({ error: null }),
                    insert: async () => ({ error: null }),
                    update: async () => ({ eq: async () => ({ error: null }) })
                }),
                upsert: async () => ({ select: () => ({ single: async () => ({ data: null }) }) }),
                update: async () => ({ eq: async () => ({ error: null }) }) // Chain fix
            })
        };
    }
} catch (e) {
    console.error('Supabase Critical Init Error:', e);
}

export const supabase = supabaseClient;

export interface UserProfile {
    id: string; // Matches auth.users.id
    username: string; // Display name
    total_score: number;
    max_level: number;
    badges: string[]; // JSON array of badge IDs
    estimated_iq: number;
    updated_at?: string;
}

export interface LeaderboardEntry {
    id?: string;
    player_name: string;
    score: number;
    level: number;
    country: string;
    iq: number;
    created_at?: string;
}

export const authService = {
    async signUp(email: string, password: string, username: string) {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username, // Metadata
                },
            },
        });
        return { data, error };
    },

    async signIn(email: string, password: string) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { data, error };
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        return { error };
    },

    async resetPassword(email: string) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password', // Handle this route if needed
        });
        return { error };
    },

    async getCurrentSession() {
        const { data } = await supabase.auth.getSession();
        return data.session;
    },

    async getUser() {
        const { data } = await supabase.auth.getUser();
        return data.user;
    }
};

export const profileService = {
    async getProfile(userId: string): Promise<UserProfile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            console.warn('Error fetching profile or profile does not exist:', error.message);
            return null;
        }
        return data;
    },

    async updateProfile(profile: Partial<UserProfile> & { id: string }) {
        const { data, error } = await supabase
            .from('profiles')
            .upsert(profile)
            .select()
            .single();

        if (error) {
            console.error('Error updating profile:', error);
            throw error;
        }
        return data;
    },

    // Sync game progress to DB (only updates if better for stats, but also handles current run save)
    async syncProgress(userId: string, newScore: number, newLevel: number, newIq: number) {
        const current = await this.getProfile(userId);

        const updates: any = { id: userId, updated_at: new Date().toISOString() };
        let shouldUpdate = false;

        // HIGH SCORES (Career Stats)
        if (!current) {
            updates.total_score = newScore;
            updates.max_level = newLevel;
            updates.estimated_iq = newIq;
            shouldUpdate = true;
        } else {
            if (newLevel > (current.max_level || 0)) {
                updates.max_level = newLevel;
                shouldUpdate = true;
            }
            if (newIq > (current.estimated_iq || 0)) {
                updates.estimated_iq = newIq;
                shouldUpdate = true;
            }
            if (newScore > (current.total_score || 0)) {
                updates.total_score = newScore;
                shouldUpdate = true;
            }
        }

        if (shouldUpdate) {
            await this.updateProfile(updates);
        }
        return current;
    },

    // Save Active Run State (Snapshot for Resume)
    async saveGameState(userId: string, gameState: any) {
        const { error } = await supabase
            .from('profiles')
            .update({
                current_run_state: gameState,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (error) console.error('Error saving game state:', error);
    },

    // Load Active Run State
    async loadGameState(userId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('current_run_state')
            .eq('id', userId)
            .single();

        if (error) {
            console.error('Error loading game state:', error);
            return null;
        }
        return data?.current_run_state;
    },

    // Clear Saved Game (on Game Over)
    async clearSavedGame(userId: string) {
        const { error } = await supabase
            .from('profiles')
            .update({ current_run_state: null })
            .eq('id', userId);

        if (error) console.error('Error clearing game save:', error);
    }
};

export const leaderboardService = {
    async getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
        // Try to fetch from 'profiles' first if we unify tables, else 'leaderboard'
        // Let's assume we read from 'profiles' for the source of truth if connected.
        // But for now, user asked for 'leaderboard' table support previously.
        // Let's stick to 'leaderboard' table for GLOBAL ranking, but synced from profile.

        const { data, error } = await supabase
            .from('leaderboard') // Or 'profiles' ordered by total_score
            .select('*')
            .order('score', { ascending: false })
            .limit(limit);

        if (error) {
            console.error('Error fetching leaderboard:', error);
            return [];
        }
        return data || [];
    },

    async addEntry(entry: LeaderboardEntry): Promise<void> {
        const { error } = await supabase
            .from('leaderboard')
            .insert([entry]);

        if (error) {
            console.error('Error adding score:', error);
        }
    }
};
