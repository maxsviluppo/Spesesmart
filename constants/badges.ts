
import { Trophy, Zap, Brain, Target, Star, Crown, Flame, Medal, Shield, Swords, Activity, Gem, Rocket, Lightbulb, Hash, Infinity, Sparkles, Diamond, Eye, Sun, Bug, Globe } from 'lucide-react';

export interface Badge {
    id: string;
    title: string;
    description: string;
    icon: any; // Lucide icon component
    color: string; // Tailwind text color class
    bgGradient: string; // Tailwind bg gradient class for unlocked state
    condition: (stats: { total_score: number; max_level: number; estimated_iq: number }) => boolean;
}

export const BADGES: Badge[] = [
    // --- LEVELS (Progression) ---
    { id: 'level_2', title: 'Recluta', description: 'Raggiungi il Livello 2.', icon: Star, color: 'text-slate-400', bgGradient: 'from-slate-500/20 to-gray-500/20', condition: (s) => s.max_level >= 2 },
    { id: 'level_5', title: 'Esploratore', description: 'Raggiungi il Livello 5.', icon: Star, color: 'text-cyan-400', bgGradient: 'from-cyan-500/20 to-blue-500/20', condition: (s) => s.max_level >= 5 },
    { id: 'level_10', title: 'Scalatore', description: 'Raggiungi il Livello 10.', icon: Target, color: 'text-green-400', bgGradient: 'from-green-500/20 to-emerald-500/20', condition: (s) => s.max_level >= 10 },
    { id: 'level_15', title: 'Veterano', description: 'Raggiungi il Livello 15.', icon: Shield, color: 'text-blue-500', bgGradient: 'from-blue-600/20 to-indigo-600/20', condition: (s) => s.max_level >= 15 },
    { id: 'level_20', title: 'Maestro', description: 'Raggiungi il Livello 20.', icon: Crown, color: 'text-amber-400', bgGradient: 'from-amber-500/20 to-yellow-500/20', condition: (s) => s.max_level >= 20 },
    { id: 'level_30', title: 'Stratega', description: 'Raggiungi il Livello 30.', icon: Brain, color: 'text-purple-400', bgGradient: 'from-purple-500/20 to-fuchsia-500/20', condition: (s) => s.max_level >= 30 },
    { id: 'level_40', title: 'Architetto', description: 'Raggiungi il Livello 40.', icon: Hash, color: 'text-pink-500', bgGradient: 'from-pink-500/20 to-rose-500/20', condition: (s) => s.max_level >= 40 },
    { id: 'level_50', title: 'Dominatore', description: 'Raggiungi il Livello 50.', icon: Swords, color: 'text-red-500', bgGradient: 'from-red-600/20 to-orange-600/20', condition: (s) => s.max_level >= 50 },
    { id: 'level_75', title: 'Leggenda Vivente', description: 'Raggiungi il Livello 75.', icon: Gem, color: 'text-teal-400', bgGradient: 'from-teal-500/20 to-emerald-500/20', condition: (s) => s.max_level >= 75 },
    { id: 'level_100', title: 'Divinità', description: 'Raggiungi il Livello 100.', icon: Infinity, color: 'text-yellow-300', bgGradient: 'from-yellow-400/20 to-amber-400/20', condition: (s) => s.max_level >= 100 },

    // --- SCORE (Accumulation) ---
    { id: 'score_1k', title: 'Promessa', description: 'Raggiungi 1.000 punti.', icon: Zap, color: 'text-yellow-400', bgGradient: 'from-yellow-500/20 to-orange-500/20', condition: (s) => s.total_score >= 1000 },
    { id: 'score_5k', title: 'Esperto', description: 'Raggiungi 5.000 punti.', icon: Flame, color: 'text-orange-500', bgGradient: 'from-orange-500/20 to-red-500/20', condition: (s) => s.total_score >= 5000 },
    { id: 'score_10k', title: 'Fuoriclasse', description: 'Raggiungi 10.000 punti.', icon: Medal, color: 'text-rose-500', bgGradient: 'from-rose-500/20 to-pink-500/20', condition: (s) => s.total_score >= 10000 },
    { id: 'score_25k', title: 'Campione', description: 'Raggiungi 25.000 punti.', icon: Trophy, color: 'text-purple-500', bgGradient: 'from-purple-500/20 to-indigo-500/20', condition: (s) => s.total_score >= 25000 },
    { id: 'score_50k', title: 'Elite', description: 'Raggiungi 50.000 punti.', icon: Diamond, color: 'text-cyan-400', bgGradient: 'from-cyan-500/20 to-blue-500/20', condition: (s) => s.total_score >= 50000 },
    { id: 'score_100k', title: 'Titano', description: 'Raggiungi 100.000 punti.', icon: Crown, color: 'text-amber-500', bgGradient: 'from-amber-600/20 to-yellow-600/20', condition: (s) => s.total_score >= 100000 },
    { id: 'score_500k', title: 'Miliardario', description: 'Raggiungi 500.000 punti.', icon: Gem, color: 'text-emerald-400', bgGradient: 'from-emerald-500/20 to-green-500/20', condition: (s) => s.total_score >= 500000 },
    { id: 'score_1m', title: 'Trilionario', description: 'Raggiungi 1.000.000 punti.', icon: Infinity, color: 'text-fuchsia-500', bgGradient: 'from-fuchsia-600/20 to-purple-600/20', condition: (s) => s.total_score >= 1000000 },

    // --- IQ (Intelligence) ---
    { id: 'iq_80', title: 'Pensatore', description: 'QI stimato > 80.', icon: Lightbulb, color: 'text-lime-400', bgGradient: 'from-lime-500/20 to-green-500/20', condition: (s) => s.estimated_iq >= 80 },
    { id: 'iq_100', title: 'Normale?', description: 'QI stimato > 100.', icon: Brain, color: 'text-slate-300', bgGradient: 'from-slate-400/20 to-gray-400/20', condition: (s) => s.estimated_iq >= 100 },
    { id: 'iq_115', title: 'Sveglio', description: 'QI stimato > 115.', icon: Zap, color: 'text-yellow-400', bgGradient: 'from-yellow-500/20 to-orange-500/20', condition: (s) => s.estimated_iq >= 115 },
    { id: 'iq_130', title: 'Genio', description: 'QI stimato > 130.', icon: Sparkles, color: 'text-cyan-400', bgGradient: 'from-cyan-500/20 to-blue-500/20', condition: (s) => s.estimated_iq >= 130 },
    { id: 'iq_145', title: 'Mensano', description: 'QI stimato > 145.', icon: Crown, color: 'text-purple-500', bgGradient: 'from-purple-500/20 to-fuchsia-500/20', condition: (s) => s.estimated_iq >= 145 },
    { id: 'iq_160', title: 'Visionario', description: 'QI stimato > 160.', icon: Eye, color: 'text-rose-500', bgGradient: 'from-rose-500/20 to-red-500/20', condition: (s) => s.estimated_iq >= 160 },
    { id: 'iq_180', title: 'Sovrano', description: 'QI stimato > 180.', icon: Sun, color: 'text-amber-500', bgGradient: 'from-amber-500/20 to-orange-500/20', condition: (s) => s.estimated_iq >= 180 },
    { id: 'iq_200', title: 'Onnisciente', description: 'QI stimato > 200.', icon: Infinity, color: 'text-white', bgGradient: 'from-white/20 to-slate-200/20', condition: (s) => s.estimated_iq >= 200 },

    // --- SPECIAL BOSSES (Mock Logic for now based on Levels) ---
    { id: 'boss_5', title: 'Guardiano Caduto', description: 'Sconfiggi il Guardiano al Livello 5.', icon: Swords, color: 'text-red-500', bgGradient: 'from-red-900/40 to-black/40', condition: (s) => s.max_level > 5 },
    { id: 'boss_matematico', title: 'Sterminatore Matematico', description: 'Sconfiggi il primo Boss: Il Boss Matematico.', icon: Swords, color: 'text-emerald-400', bgGradient: 'from-emerald-900/40 to-black/40', condition: (s) => false }, // Condition is manual sync
    { id: 'boss_10', title: 'Sentinel Down', description: 'Sconfiggi la Sentinella al Livello 10.', icon: Shield, color: 'text-orange-500', bgGradient: 'from-orange-900/40 to-black/40', condition: (s) => s.max_level > 10 },
    { id: 'boss_25', title: 'Glitch Fixer', description: 'Correggi l\'anomalia al Livello 25.', icon: Bug, color: 'text-green-500', bgGradient: 'from-green-900/40 to-black/40', condition: (s) => s.max_level > 25 },
    { id: 'boss_50', title: 'Matrix Breaker', description: 'Sconfiggi l\'Architetto al Livello 50.', icon: Globe, color: 'text-blue-500', bgGradient: 'from-blue-900/40 to-black/40', condition: (s) => s.max_level > 50 },

    // --- FUN / MISC (Add Logic later, currently level/score proxies) ---
    { id: 'speed_demon', title: 'Demone della Velocità', description: 'Completa un livello in tempo record (Mock).', icon: Rocket, color: 'text-red-400', bgGradient: 'from-red-500/20 to-orange-500/20', condition: (s) => s.max_level >= 8 && s.estimated_iq > 120 },
    { id: 'precision', title: 'Chirurgo', description: 'Precisione 100% in un livello (Mock).', icon: Target, color: 'text-teal-400', bgGradient: 'from-teal-500/20 to-cyan-500/20', condition: (s) => s.max_level >= 12 && s.total_score > 3000 },
    { id: 'grinder', title: 'Stakanovista', description: 'Gioca 50 partite (Mock).', icon: Activity, color: 'text-slate-400', bgGradient: 'from-slate-600/20 to-gray-600/20', condition: (s) => s.total_score > 20000 }
];
