
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HexCellData, GameState } from './types';
import { INITIAL_TIME, BASE_POINTS_START, MAX_STREAK, GRID_ROWS, GRID_COLS, OPERATORS, MOCK_LEADERBOARD } from './constants';
import HexCell from './components/HexCell';
import ParticleEffect from './components/ParticleEffect';
import CharacterHelper from './components/CharacterHelper';
import { getIQInsights } from './services/geminiService';
import { soundService } from './services/soundService';
import { matchService } from './services/matchService';
import { Trophy, Timer, Zap, Brain, RefreshCw, ChevronRight, Play, Award, BarChart3, HelpCircle, Sparkles, Home, X, Volume2, VolumeX, User, Pause, Shield, Swords, Info, AlertTriangle, FastForward, Clock } from 'lucide-react';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import NeuralDuelLobby from './components/NeuralDuelLobby';
import DuelRecapModal from './components/DuelRecapModal';
import IntroVideo from './components/IntroVideo';
import ComicTutorial, { TutorialStep } from './components/ComicTutorial';
import UserProfileModal, { getRank } from './components/UserProfileModal'; // Updated import
import RegistrationSuccess from './components/RegistrationSuccess';
import { BADGES } from './constants/badges';
import { authService, profileService, leaderboardService, supabase, UserProfile } from './services/supabaseClient'; // Moved this import here

const TUTORIAL_STEPS = [
  {
    title: "OBIETTIVO & GRIGLIA",
    description: "Trova i 5 Target numerici usando le tessere a disposizione. La griglia è FISSA per ogni livello: trova tutte le combinazioni per avanzare.",
    icon: <Brain className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "REGOLE DI CONNESSIONE",
    description: "Trascina dai Numeri. Alterna sempre: Numero → Operatore → Numero. Non puoi collegare due tipi uguali consecutivamente.",
    icon: <RefreshCw className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "PUNTEGGIO & STREAK",
    description: "La precisione premia! Ogni risposta corretta consecutiva aumenta il moltiplicatore. Un errore azzera il moltiplicatore base.",
    icon: <Zap className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "SFIDE & CLASSIFICHE",
    description: "Oltre alla modalità Classica, competi in NEURAL DUEL (1vs1) e scala la Classifica Globale per Punti e Livello Massimo.",
    icon: <Swords className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "QI RANKING AI",
    description: "L'AI analizza la tua velocità e precisione per stimare il tuo QI di gioco. Punta all'Eccellenza Neurale.",
    icon: <Award className="w-12 h-12 text-[#FF8800]" />
  }
];

const WIN_VIDEOS = ['/Win1noaudio.mp4', '/Win2noaudioe.mp4', '/Win3noaudio.mp4', '/Win4noaudio.mp4'];
const LOSE_VIDEOS = ['/Lose1noaudio.mp4'];
const SURRENDER_VIDEOS = ['/ritirata.mp4', '/ritirata1.mp4', '/ritirata2.mp4'];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    totalScore: 0,
    streak: 0,
    level: 1,
    timeLeft: INITIAL_TIME,
    targetResult: 0,
    status: 'intro',
    estimatedIQ: 100,
    lastLevelPerfect: true,
    basePoints: BASE_POINTS_START,
    levelTargets: [],
  });

  const [grid, setGrid] = useState<HexCellData[]>([]);
  const [selectedPath, setSelectedPath] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [previewResult, setPreviewResult] = useState<number | null>(null);
  const [insight, setInsight] = useState<string>("");

  const [activeModal, setActiveModal] = useState<'leaderboard' | 'tutorial' | 'admin' | 'duel' | 'duel_selection' | 'resume_confirm' | 'logout_confirm' | 'profile' | 'registration_success' | null>(null);
  const [activeMatch, setActiveMatch] = useState<{ id: string, opponentId: string, isDuel: boolean, isP1: boolean } | null>(null);
  const [duelMode, setDuelMode] = useState<'standard' | 'blitz'>('standard');
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentTargets, setOpponentTargets] = useState(0);
  const [duelRounds, setDuelRounds] = useState({ p1: 0, p2: 0, current: 1 });
  const [tutorialStep, setTutorialStep] = useState(0);
  const [targetAnimKey, setTargetAnimKey] = useState(0);
  const [scoreAnimKey, setScoreAnimKey] = useState(0);
  const [isVictoryAnimating, setIsVictoryAnimating] = useState(false);
  const [triggerParticles, setTriggerParticles] = useState(false);
  const [toast, setToast] = useState<{ message: string, visible: boolean, actions?: { label: string, onClick: () => void, variant?: 'primary' | 'secondary' }[] }>({ message: '', visible: false });
  const [isMuted, setIsMuted] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showLostVideo, setShowLostVideo] = useState(false);
  const [showHomeTutorial, setShowHomeTutorial] = useState(false);
  const [showGameTutorial, setShowGameTutorial] = useState(false);
  const theme = 'orange';
  const [levelBuffer, setLevelBuffer] = useState<{ grid: HexCellData[], targets: number[] }[]>([]);
  const timerRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const winAudioRef = useRef<HTMLAudioElement | null>(null);

  // Supabase Integration
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [logoAnim, setLogoAnim] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const processedWinRef = useRef<string | null>(null);

  // Keep gameStateRef in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Logo Animation Effect
  useEffect(() => {
    const interval = setInterval(() => {
      setLogoAnim(true);
      setTimeout(() => setLogoAnim(false), 2000); // Slower breath (2s)
    }, 8000); // Slightly more frequent
    return () => clearInterval(interval);
  }, []);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  const [savedGame, setSavedGame] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [winVideoSrc, setWinVideoSrc] = useState(WIN_VIDEOS[0]);
  const [loseVideoSrc, setLoseVideoSrc] = useState(LOSE_VIDEOS[0]);
  const [surrenderVideoSrc, setSurrenderVideoSrc] = useState(SURRENDER_VIDEOS[0]);
  const [showSurrenderVideo, setShowSurrenderVideo] = useState(false);
  const [isVideoVisible, setIsVideoVisible] = useState(false);

  // NEW STATE FOR DUEL RECAP
  const [showDuelRecap, setShowDuelRecap] = useState(false);
  const [latestMatchData, setLatestMatchData] = useState<any>(null); // NEW: Full Match Object Store

  // NEW: Video Intro State
  const [showIntro, setShowIntro] = useState(true);
  const [onlinePlayers, setOnlinePlayers] = useState<any[]>([]);
  const [pendingMatchInvite, setPendingMatchInvite] = useState<string | null>(null);
  const [isJoiningPending, setIsJoiningPending] = useState(false);




  const handleUserInteraction = useCallback(async () => {
    await soundService.init();
  }, []);

  const showToast = useCallback((message: string, actions?: { label: string, onClick: () => void, variant?: 'primary' | 'secondary' }[]) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, visible: true, actions });
    // Se ci sono azioni, il toast rimane visibile più a lungo o finché non si clicca
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, actions ? 8000 : 2500);
  }, []);

  // DETERMINISTIC RNG HELPERS
  const stringToSeed = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  };

  const seededRandom = (seed: number) => {
    return () => {
      seed |= 0; seed = seed + 0x6d2b79f5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };


  const getDifficultyRange = (level: number) => {
    // MODIFIED: Much gentler slope for first 30 levels to ease player in
    if (level <= 5) return { min: 1, max: 12 };       // Very easy start (mostly sums)
    if (level <= 10) return { min: 5, max: 20 };      // Introducing complexity slowly
    if (level <= 20) return { min: 10, max: 35 };     // Moderate
    if (level <= 30) return { min: 15, max: 50 };     // Challenging but fair

    // Original linear scaling kicking in after level 30
    // Adjusted formula to match the curve
    return { min: 20 + ((level - 20) * 2), max: 50 + ((level - 20) * 5) };
  };

  // Helper: Calculate result from a cell path (for solver)
  const calculateResultFromCells = (cells: HexCellData[]): number | null => {
    if (cells.length < 1) return null;
    try {
      let result = 0;
      let currentOp = '+';
      let hasStarted = false;

      for (let i = 0; i < cells.length; i++) {
        const part = cells[i].value;
        if (OPERATORS.includes(part)) {
          currentOp = part;
        } else {
          const num = parseInt(part);
          if (!hasStarted) {
            result = num;
            hasStarted = true;
          } else {
            if (currentOp === '+') result += num;
            else if (currentOp === '-') result -= num;
            else if (currentOp === '×') result *= num;
            else if (currentOp === '÷') result = num !== 0 ? Math.floor(result / num) : result;
          }
        }
      }
      return result;
    } catch (e) {
      return null;
    }
  };

  // Helper: Check adjacency (rectilinear for orange theme)
  const areCellsAdjacent = (cell1: HexCellData, cell2: HexCellData): boolean => {
    const dr = Math.abs(cell1.row - cell2.row);
    const dc = Math.abs(cell1.col - cell2.col);
    return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
  };

  // SOLVER: Find all valid paths and their results
  const findAllSolutions = (gridCells: HexCellData[]): Set<number> => {
    if (!gridCells) return new Set();
    const solutions = new Set<number>();
    const maxPathLength = 7; // N-Op-N-Op-N-Op-N = 7 cells max

    const explorePath = (currentPath: HexCellData[], visited: Set<string>) => {
      const lastCell = currentPath[currentPath.length - 1];

      // Calculate if path is valid (at least 3 cells: N-Op-N)
      if (currentPath.length >= 3 && currentPath.length % 2 === 1) {
        const result = calculateResultFromCells(currentPath);
        if (result !== null && result > 0) {
          solutions.add(result);
        }
      }

      if (currentPath.length >= maxPathLength) return;

      // Try all adjacent cells
      for (const nextCell of gridCells) {
        if (visited.has(nextCell.id)) continue;
        if (lastCell.type === nextCell.type) continue;
        if (!areCellsAdjacent(lastCell, nextCell)) continue;

        const newVisited = new Set(visited);
        newVisited.add(nextCell.id);
        explorePath([...currentPath, nextCell], newVisited);
      }
    };

    // Start from every number cell
    const numberCells = gridCells.filter(c => c.type === 'number');
    for (const startCell of numberCells) {
      explorePath([startCell], new Set([startCell.id]));
    }

    return solutions;
  };

  const createLevelData = useCallback((level: number, seedStr?: string) => {
    const { min, max } = getDifficultyRange(level);
    let attempts = 0;
    const maxAttempts = 20;

    // Initialize RNG
    const rng = seedStr ? seededRandom(stringToSeed(seedStr)) : Math.random;

    // Helper: Weighted numbers for early levels
    const getWeightedNumber = () => {
      if (level <= 30) {
        const r = rng();
        // 60% chance of small numbers (1-4), 30% mid (5-7), 10% high (8-9) or 0
        if (r < 0.60) return Math.floor(rng() * 4) + 1;
        if (r < 0.90) return Math.floor(rng() * 3) + 5;
        return Math.floor(rng() * 3) + 7;
      }
      return Math.floor(rng() * 10);
    };

    // Helper: generate a balanced pool of operators to distribute spatially
    const generateBalancedOperatorPool = (count: number) => {
      const pool = [];
      let weights = { '+': 0.35, '-': 0.35, '×': 0.20, '÷': 0.10 };

      // Easier operators for early levels
      if (level <= 5) weights = { '+': 0.50, '-': 0.50, '×': 0.0, '÷': 0.0 };
      else if (level <= 15) weights = { '+': 0.40, '-': 0.40, '×': 0.20, '÷': 0.0 };
      else if (level <= 30) weights = { '+': 0.35, '-': 0.35, '×': 0.25, '÷': 0.05 };

      for (let i = 0; i < count; i++) {
        const r = rng();
        if (r < weights['+']) pool.push('+');
        else if (r < weights['+'] + weights['-']) pool.push('-');
        else if (r < weights['+'] + weights['-'] + weights['×']) pool.push('×');
        else pool.push('÷');
      }

      // Shuffle pool (Fisher-Yates) for uniform distribution
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool;
    };

    while (attempts < maxAttempts) {
      attempts++;

      // Count operators needed
      let opCount = 0;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if ((r + c) % 2 !== 0) opCount++;
        }
      }

      const opPool = generateBalancedOperatorPool(opCount);
      let opIndex = 0;

      // Generate random grid with spatial distribution logic
      const newGrid: HexCellData[] = [];
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const isOperator = (r + c) % 2 !== 0;
          newGrid.push({
            id: `${r}-${c}`,
            row: r,
            col: c,
            type: isOperator ? 'operator' : 'number',
            value: isOperator
              ? (opPool[opIndex++] || '+')
              : getWeightedNumber().toString(),
          });
        }
      }

      // Find all possible solutions
      const allSolutions = findAllSolutions(newGrid);
      const validSolutions = Array.from(allSolutions).filter(n => n >= min && n <= max);

      // Need at least 5 unique solutions. 
      // Ensure we pick solution targets that are somewhat spread out (numerically) if possible, or just shuffle well.
      if (validSolutions.length >= 5) {
        // Better shuffle for targets using deterministic RNG
        const shuffled = validSolutions.sort(() => rng() - 0.5);
        // Double shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(rng() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const targets = shuffled.slice(0, 5);

        // Extra check: If low level, ensure targets aren't too close to each other? 
        // No, randomness is fine as long as they are distinct.
        return { grid: newGrid, targets };
      }
    }

    // Fallback: simpler grid if generation fails often
    console.warn(`Level ${level}: Using fallback grid generation`);
    const newGrid: HexCellData[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const isOperator = (r + c) % 2 !== 0;
        newGrid.push({
          id: `${r}-${c}`,
          row: r,
          col: c,
          type: isOperator ? 'operator' : 'number',
          value: isOperator ? '+' : Math.floor(Math.random() * 5).toString(), // Fallback to very simple
        });
      }
    }
    // Generate simple targets for fallback
    const targets = [];
    for (let i = 0; i < 5; i++) targets.push(Math.floor(Math.random() * (max - min + 1)) + min);

    return { grid: newGrid, targets };
  }, []);

  const generateGrid = useCallback((forceStartLevel?: number, forcedSeed?: string) => {
    let nextLevelData;
    let newBuffer = [...levelBuffer];

    const currentLevel = forceStartLevel !== undefined ? forceStartLevel : gameState.level;

    if (newBuffer.length === 0 || forceStartLevel !== undefined || forcedSeed) {
      // If we have a forced seed (DUEL MODE), generate exactly that board
      newBuffer = [];
      nextLevelData = createLevelData(currentLevel, forcedSeed);
      for (let i = 1; i <= 5; i++) {
        newBuffer.push(createLevelData(currentLevel + i));
      }
    } else {
      // Shift buffer (Normal progression)
      nextLevelData = newBuffer.shift()!;
      // Replenish buffer
      newBuffer.push(createLevelData(gameState.level + 6));
    }

    setGrid(nextLevelData.grid);
    setLevelBuffer(newBuffer);

    setGameState(prev => ({
      ...prev,
      targetResult: 0,
      levelTargets: nextLevelData.targets.map(t => ({ value: t, completed: false }))
    }));
    setTargetAnimKey(k => k + 1);
  }, [levelBuffer, createLevelData, gameState.level]);

  // BADGE CHECKER
  const resetDuelState = async (matchId?: string, userId?: string) => {
    // 1. If currently in a match, ABANDON it properly on DB
    if (matchId && userId) {
      console.log("🏳️ Abandoning Match:", matchId);
      await matchService.abandonMatch(matchId, userId);
    }

    setActiveMatch(null);
    setDuelRounds({ p1: 0, p2: 0, current: 0 });
    setOpponentScore(0);
    setOpponentTargets(0);
    setShowDuelRecap(false);
    setGameState(prev => ({ ...prev, status: 'idle' }));
    setIsVideoVisible(false);
    setShowSurrenderVideo(false);
    setShowVideo(false);
    setShowLostVideo(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const checkAndUnlockBadges = useCallback(async (profile: any) => {
    if (!profile) return;
    const unlockedIds = profile.badges || [];
    const newBadges: string[] = [];

    BADGES.forEach(badge => {
      if (!unlockedIds.includes(badge.id)) {
        if (badge.condition(profile)) {
          newBadges.push(badge.id);
          // Toast Notification
          showToast(`🏆 Medaglia Sbloccata: ${badge.title}!`);
          soundService.playSuccess();
        }
      }
    });

    if (newBadges.length > 0) {
      const updatedBadges = [...unlockedIds, ...newBadges];
      // Update Local
      setUserProfile(prev => prev ? ({ ...prev, badges: updatedBadges }) : null);
      // Update Remote
      await profileService.updateProfile({ id: profile.id, badges: updatedBadges });
    }
  }, [showToast]);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const profile = await profileService.getProfile(userId);
      const save = await profileService.loadGameState(userId);
      if (save) setSavedGame(save);
      if (profile) {
        setUserProfile(profile);

        // Check for Badges on Load (In case of missed updates or offline play sync)
        checkAndUnlockBadges(profile);

        setGameState(prev => ({
          ...prev,
          // Only update stats if they are better in DB (usually sync handles this, but just in case)
          estimatedIQ: profile.estimated_iq || 100
        }));
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }, [checkAndUnlockBadges]);

  // Initialize Session & Handle Auth Redirects (Email Config etc.)
  useEffect(() => {
    // 1. Check current session immediately
    authService.getCurrentSession().then(session => {
      if (session?.user) {
        setCurrentUser(session.user);
        loadProfile(session.user.id);
      }
    });

    // 2. Listen for Auth Changes (Login, Logout, Email Confirmation Redirects)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth Event:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        setCurrentUser(session.user);
        loadProfile(session.user.id);


        // Show Welcome Message ONLY if it's a new registration or recovery
        const username = session.user.user_metadata?.username || 'Giocatore';
        const isSignup = window.location.hash && (window.location.hash.includes('type=signup') || window.location.hash.includes('type=recovery'));

        if (isSignup) {
          const welcomeMsg = `🎉 Account Confermato! Benvenuto in Number, ${username}!`;
          showToast(welcomeMsg, [{ label: 'Profilo', onClick: () => setActiveModal('profile') }]);
        }
        // Else: Standard login, silent entry (no toast)

        // Close modals if open
        setShowAuthModal(false);
      }

      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setUserProfile(null);
        setSavedGame(null);
        setGameState(prev => ({ ...prev, status: 'intro' }));
        showToast("Disconnessione completata.");
      }

      if (event === 'USER_UPDATED') {
        // Handle password recovery or profile update events
        if (session?.user) {
          setCurrentUser(session.user);
          loadProfile(session.user.id);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadProfile, showToast]);

  // GLOBAL PRESENCE & CHALLENGE NOTIFICATION
  useEffect(() => {
    if (!currentUser) {
      setOnlinePlayers([]);
      return;
    }

    // 1. GLOBAL PRESENCE TRACKING
    const globalChannel = (supabase as any)
      .channel('global_online_users', {
        config: { presence: { key: currentUser.id } }
      })
      .on('presence', { event: 'sync' }, () => {
        const state = globalChannel.presenceState();
        const players = Object.values(state).map((presence: any) => presence[0]);
        setOnlinePlayers(players);
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await globalChannel.track({
            id: currentUser.id,
            username: userProfile?.username || currentUser.user_metadata?.username || 'Guerriero',
            avatar_url: userProfile?.avatar_url,
            level: userProfile?.max_level || 1,
            online_at: new Date().toISOString()
          });
        }
      });

    // 2. GLOBAL CHALLENGE LISTENER
    const invitesChannel = (supabase as any)
      .channel('global_invites')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'matches',
        filter: `player2_id=eq.${currentUser.id}`
      }, (payload: any) => {
        const newMatch = payload.new;
        if (newMatch.status === 'invite_pending') {
          // Play badge sound
          soundService.playBadge();
          // Show toast with action - Updated to DIRECT ACCEPT
          showToast(`🎮 Nuova Sfida Ricevuta! Modalità: ${newMatch.mode.toUpperCase().replace('_', ' ')}`, [
            {
              label: 'Accetta',
              onClick: () => {
                setPendingMatchInvite(newMatch.id);
              },
              variant: 'primary'
            }
          ]);
        }
      })
      .subscribe();

    return () => {
      (supabase as any).removeChannel(globalChannel);
      (supabase as any).removeChannel(invitesChannel);
    };
  }, [currentUser, userProfile, showToast]);

  // 3. Game Over Trigger on Time Left reaching zero
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.timeLeft === 0 && !isVictoryAnimating) {
      // TIME ATTACK END (Duel)
      if (activeMatch?.mode === 'time_attack') {
        handleTimeAttackEnd();
        return;
      }

      // STANDARD GAME OVER (Single Player)
      if (!activeMatch?.isDuel) {
        setGameState(prev => ({ ...prev, status: 'game-over' }));
        if (currentUser) {
          profileService.clearSavedGame(currentUser.id);
          loadProfile(currentUser.id);
        }

        // VIDEO UNLOCK - AUTO PLAY MUTED ON TIMEOUT (Browser Policy)
        const loseVid = LOSE_VIDEOS[0];
        setLoseVideoSrc(loseVid);
        setShowLostVideo(true);
        setIsVideoVisible(true);

        if (videoRef.current) {
          videoRef.current.src = loseVid;
          videoRef.current.muted = true; // REQUIRED for auto-play without click
          videoRef.current.load();
          videoRef.current.play().catch(e => {
            console.warn("Loss video blocked (timeout):", e);
          });

          // Play Synchronized Audio Track (Lose1.mp3)
          soundService.playLose();
        }
      }
    }
  }, [gameState.timeLeft, gameState.status, activeMatch, currentUser, isVictoryAnimating, loadProfile]);

  useEffect(() => {
    if (!currentUser) return;

    // CHECK FOR PENDING INVITES ON LOAD
    matchService.getPendingInvitesForUser(currentUser.id).then(invites => {
      if (invites.length > 0) {
        invites.forEach(inv => {
          const modeLabel = inv.mode ? inv.mode.toUpperCase().replace('_', ' ') : 'DUEL';
          showToast(`⚔️ Invito per ${modeLabel} da ${inv.player1?.username || 'Sconosciuto'}!`, [
            {
              label: 'Accetta',
              onClick: () => {
                setPendingMatchInvite(inv.id);
              },
              variant: 'primary'
            },
            {
              label: 'Rifiuta',
              onClick: async () => {
                await matchService.declineInvite(inv.id, currentUser.id);
                showToast("Invito rifiutato.");
              },
              variant: 'secondary'
            }
          ]);
        });
      }
    });
  }, [currentUser, showToast]);

  // 4. URL DEEP LINKING (Invitation Handling)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('joinMatch');
    if (joinId) {
      console.log("🔗 Detected Match Invite Link:", joinId);
      setPendingMatchInvite(joinId);
      // Clean URL
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // 5. AUTO-JOIN PENDING INVITE
  useEffect(() => {
    if (currentUser && pendingMatchInvite && !isJoiningPending) {
      const autoJoin = async () => {
        setIsJoiningPending(true);
        showToast("Accesso alla sfida in corso...");
        try {
          const match = await matchService.getMatchById(pendingMatchInvite);
          if (!match) {
            showToast("Sfida scaduta o non trovata.");
          } else if (match.status === 'finished' || match.status === 'cancelled') {
            showToast("La sfida è già terminata o è stata annullata.");
          } else {
            // Check if I am already in the match or need to join
            const isP1 = match.player1_id === currentUser.id;
            const isP2 = match.player2_id === currentUser.id;

            if (isP1 || isP2) {
              // I'm part of it, just activate
              if (match.status === 'invite_pending' && isP2) {
                await matchService.acceptInvite(match.id, currentUser.id);
              }
            } else if (!match.player2_id) {
              // Joinable public or invite without player2
              await matchService.joinMatch(match.id, currentUser.id);
            } else {
              showToast("La sfida è già al completo.");
              setIsJoiningPending(false);
              setPendingMatchInvite(null);
              return;
            }

            // Start the game logic (onMatchStart copy)
            setActiveModal(null);
            setDuelMode(match.mode as any);
            setActiveMatch({
              id: match.id,
              opponentId: match.player1_id === currentUser.id ? match.player2_id! : match.player1_id,
              isDuel: true,
              isP1: match.player1_id === currentUser.id,
              mode: match.mode // Capture mode explicitly
            });

            setGameState(prev => ({
              ...prev,
              score: 0,
              streak: 0,
              level: 1,
              timeLeft: match.mode === 'time_attack' ? 60 : INITIAL_TIME,
              status: 'playing',
              levelTargets: [],
            }));
            generateGrid(1, match.grid_seed);
            setOpponentScore(0);
            matchService.resetRoundStatus(match.id);
            soundService.playSuccess();
          }
        } catch (e) {
          console.error("Auto-join error:", e);
          showToast("Impossibile caricare la sfida.");
        } finally {
          setIsJoiningPending(false);
          setPendingMatchInvite(null);
        }
      };
      autoJoin();
    } else if (!currentUser && pendingMatchInvite && !showAuthModal) {
      // Prompt for login if someone followed a link but isn't logged in
      setShowAuthModal(true);
      showToast("Accedi per accettare la sfida!");
    }
  }, [currentUser, pendingMatchInvite, isJoiningPending, showAuthModal, generateGrid, showToast]);


  const togglePause = async (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await handleUserInteraction();
    soundService.playUIClick();
    setIsPaused(!isPaused);
  };

  // Fetch Leaderboard Data on Open
  useEffect(() => {
    if (activeModal === 'leaderboard') {
      const fetchLeaderboard = async () => {
        const data = await leaderboardService.getTopPlayers(10);
        if (data) {
          setLeaderboardData(data as any);
        }
      };
      fetchLeaderboard();
    }
  }, [activeModal]);

  // Timer: Dedicated Loop for decrementing time only
  useEffect(() => {
    // MODIFIED: Timer disabled for Standard/Blitz Duel, ENABLED for Time Attack
    const isTimeDuel = activeMatch?.mode === 'time_attack';
    if (gameState.status === 'playing' && gameState.timeLeft > 0 && !isVictoryAnimating && !showVideo && !isPaused && (!activeMatch?.isDuel || isTimeDuel)) {
      timerRef.current = window.setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 0) return prev;
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [gameState.status, isPaused, isVictoryAnimating, showVideo, activeMatch, gameState.timeLeft]);


  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    loadProfile(user.id);
    setShowAuthModal(false);
    showToast(`Benvenuto, ${user.user_metadata?.username || 'Operatore'}`);
  };

  const toggleMute = async (e?: React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await handleUserInteraction();
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    soundService.setMuted(newMuted);
    if (!newMuted) soundService.playUIClick();
  };

  const goToHome = async (e?: React.PointerEvent) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    await handleUserInteraction();
    soundService.playReset();

    // SFIDA LOGIC (ABBANDONO)
    if (activeMatch && currentUser && latestMatchData?.status !== 'finished') {
      const targetToWin = duelMode === 'blitz' ? 3 : 5;
      const someoneWon = latestMatchData?.winner_id ||
        (latestMatchData?.p1_rounds >= targetToWin) ||
        (latestMatchData?.p2_rounds >= targetToWin);

      if (!someoneWon) {
        // Se esco durante un duello ATTIVO, dichiaro l'avversario vincitore (Abbandono)
        matchService.sendAbandonment(activeMatch.id, currentUser.id).catch(() => { });
        matchService.declareWinner(activeMatch.id, activeMatch.opponentId).catch(() => { });
        showToast("Sfida abbandonata.");
      }
    }

    setGameState(prev => ({ ...prev, status: 'idle' }));
    setActiveModal(null);
    setActiveMatch(null);
    setShowDuelRecap(false);
    setShowVideo(false);
    setShowLostVideo(false);
    setIsVictoryAnimating(false);
    setTriggerParticles(false);
    setPreviewResult(null);
    setSelectedPath([]);
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (currentUser) loadProfile(currentUser.id);
  };

  const goToDuelLobby = async () => {
    soundService.playReset();
    setGameState(prev => ({ ...prev, status: 'idle' }));
    setActiveModal('duel_selection'); // Torna alla lobby dei duelli
    setActiveMatch(null);
    setShowDuelRecap(false);
    setShowVideo(false);
    setShowLostVideo(false);
    setIsVictoryAnimating(false);
    setTriggerParticles(false);
    setPreviewResult(null);
    setSelectedPath([]);
    if (timerRef.current) window.clearInterval(timerRef.current);
  };


  const handleDuelRoundStart = (matchData: any) => {
    // Close Modal
    setShowDuelRecap(false);
    setGameState(prev => ({
      ...prev,
      levelTargets: [],
      // FORCE 60s for Time Attack when round actually starts
      timeLeft: (matchData.mode === 'time_attack') ? 60 : INITIAL_TIME,
      status: 'playing'
    }));

    if (activeMatch?.isDuel) {
      // Deterministic seed based on match ID and total rounds played
      // This ensures both players get the same board for each round
      const roundSum = (matchData.p1_rounds || 0) + (matchData.p2_rounds || 0);
      const deterministicSeed = `${matchData.id}_round_${roundSum}`;
      generateGrid(1, deterministicSeed);
    } else {
      generateGrid(gameState.level);
    }

    if (currentUser?.id === matchData.player1_id) {
      matchService.resetRoundStatus(matchData.id);
    }
    soundService.playReset();
  };

  // Wrapper for calculation using paths (IDs) instead of Cells
  const calculateResultFromPath = (pathIds: string[]): number | null => {
    const cells = pathIds.map(id => grid.find(c => c.id === id)).filter(Boolean) as HexCellData[];
    return calculateResultFromCells(cells);
  };

  // DUEL: Subscribe to Match Updates (Score, Rounds, Winner, READY STATUS)
  useEffect(() => {
    if (activeMatch?.id && activeMatch.isDuel) {
      const sub = matchService.subscribeToMatch(activeMatch.id, (payload: any) => {
        const newData = payload.new;
        if (!newData) return;

        setLatestMatchData((prev: any) => {
          if (prev?.id === newData.id && prev.status === 'finished' && newData.status !== 'finished') {
            return { ...newData, status: 'finished', winner_id: prev.winner_id };
          }
          return newData;
        });

        const amIP1 = newData.player1_id === currentUser?.id;

        // Ensure Active Match has critical data (Mode) for Host Timer
        if (activeMatch && (!activeMatch.mode || activeMatch.mode !== newData.mode)) {
          setActiveMatch(prev => prev ? { ...prev, isP1: amIP1, mode: newData.mode } : null);
        } else if (activeMatch && activeMatch.isP1 !== amIP1) {
          setActiveMatch(prev => prev ? { ...prev, isP1: amIP1 } : null);
        }

        // TIME ATTACK SYNC START
        // If match becomes ACTIVE and it's Time Attack, start immediately if not playing
        // AND ensuring we haven't already finished this match locally (prevent loop)
        if (newData.status === 'active' &&
          (newData.mode === 'time_attack' || activeMatch?.mode === 'time_attack') &&
          gameStateRef.current.status !== 'playing' &&
          processedWinRef.current !== newData.id) {
          console.log("⚡ Time Attack START SYNC");
          startGame(1); // Force start
        }

        if (newData.p1_ready && newData.p2_ready && showDuelRecap && newData.status !== 'finished') {
          handleDuelRoundStart(newData);
        }

        setOpponentScore(amIP1 ? newData.player2_score : newData.player1_score);
        setOpponentTargets(amIP1 ? newData.p2_rounds : newData.p1_rounds);

        setDuelRounds({
          p1: newData.p1_rounds || 0,
          p2: newData.p2_rounds || 0,
          current: newData.current_round || 1
        });

        const opponentTargetCount = amIP1 ? newData.p2_rounds : newData.p1_rounds;
        const currentMode = newData.mode || duelMode;
        const targetToWin = currentMode === 'blitz' ? 3 : 5;

        /* 
        // Condition excludes Time Attack from finding a winner by rounds
        if (currentMode !== 'time_attack' && opponentTargetCount >= targetToWin && newData.status !== 'finished') {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setGameState(prev => ({ ...prev, status: 'idle' }));
          setIsDragging(false);
          setSelectedPath([]);
          soundService.playExternalSound('lost.mp3');
          setShowDuelRecap(true);
        }

        if (newData.status === 'finished') {
          const amIWinner = newData.winner_id === currentUser?.id;
          if (amIWinner && processedWinRef.current !== newData.id) {
            processedWinRef.current = newData.id;
            profileService.syncProgress(currentUser!.id, gameStateRef.current.score, gameStateRef.current.level, gameStateRef.current.estimatedIQ)
              .catch(e => console.error("Realtime sync progress error:", e));
            loadProfile(currentUser!.id)
              .catch(e => console.error("Realtime load profile error:", e));
          }

          if (!amIWinner) soundService.playExternalSound('lost.mp3');
          if (timerRef.current) window.clearInterval(timerRef.current);

          setGameState(prev => ({ ...prev, status: 'idle' }));
          setIsDragging(false);
          setSelectedPath([]);
          setShowDuelRecap(true);
        }
        */

        // ADDITIONAL CHECK: Handle CANCELLED explicitly (Surrender/Abandon)
        if (newData.status === 'cancelled') {
          console.log("⚡ Realtime: Match Cancelled (Opponent Surrendered)");
          if (timerRef.current) window.clearInterval(timerRef.current);
          setGameState(prev => ({ ...prev, status: 'idle' }));

          // Trigger Surrender Win Flow
          const randomSurrender = SURRENDER_VIDEOS[Math.floor(Math.random() * SURRENDER_VIDEOS.length)];
          setSurrenderVideoSrc(randomSurrender);
          setShowSurrenderVideo(true);
          setIsVideoVisible(false);
          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.src = randomSurrender;
            videoRef.current.play().catch(e => {
              console.warn("Surrender video blocked:", e);
              setIsVideoVisible(false);
            });
          }
        }
      });

      if (latestMatchData?.id === activeMatch.id && latestMatchData?.status === 'finished' && gameStateRef.current.status === 'playing') {
        setGameState(prev => ({ ...prev, status: 'idle' }));
        setIsDragging(false);
        setSelectedPath([]);
        setShowDuelRecap(true);
      }

      return () => {
        if (sub) (supabase as any).removeChannel(sub);
      };
    }
  }, [activeMatch, currentUser, showDuelRecap, latestMatchData]);

  // MATCH BROADCAST LOGIC (Abandonment)
  useEffect(() => {
    if (activeMatch?.id) {
      const channel = matchService.subscribeToMatchEvents(activeMatch.id, (event, payload) => {
        if (event === 'match_abandoned' && payload.fromUserId !== currentUser?.id) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          setGameState(prev => ({ ...prev, status: 'idle' })); // Temporarily idle before recap

          // SURRENDER FLOW:
          // 1. Random Video
          const randomSurrender = SURRENDER_VIDEOS[Math.floor(Math.random() * SURRENDER_VIDEOS.length)];
          setSurrenderVideoSrc(randomSurrender);
          setShowSurrenderVideo(true);
          setIsVideoVisible(false);

          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.src = randomSurrender;
            videoRef.current.play().catch(e => {
              console.warn("Surrender (abandon) video blocked:", e);
              setIsVideoVisible(false);
            });
          }

          // 2. Add Points (Optional logic, using current score)
          // The recap will show current score + bonus if handled there.
        }
      });
      return () => { if (channel) (supabase as any).removeChannel(channel); };
    }
  }, [activeMatch, currentUser]);

  /* 
  // SYNC WATCHDOG (Fallback for missed events) - DISABLED temporarily as requested
  useEffect(() => {
    let syncInterval: NodeJS.Timeout;

    if (activeMatch?.id && gameStateRef.current.status === 'playing') {
      syncInterval = setInterval(async () => {
        const status = await matchService.verifyMatchStatus(activeMatch.id);

        // SAFETY CHECK: If transient error, skip this cycle
        if (status && status.status === 'ERROR') return;

        const isMatchGone = status === null;
        const isCancelled = status && status.status === 'cancelled';
        const isFinished = status && status.status === 'finished';

        // CASE 1: SURRENDER / ABNORMAL END
        // Match deleted or explicitly cancelled -> Force Surrender Win
        if (isMatchGone || isCancelled) {
          if (gameStateRef.current.status === 'playing') {
            console.warn("SYNC WATCHDOG: Match abandoned/missing. Triggering Surrender Win.");
            if (timerRef.current) window.clearInterval(timerRef.current);
            setGameState(prev => ({ ...prev, status: 'idle' }));

            const randomSurrender = SURRENDER_VIDEOS[Math.floor(Math.random() * SURRENDER_VIDEOS.length)];
            setSurrenderVideoSrc(randomSurrender);
            setShowSurrenderVideo(true);
            setIsVideoVisible(false);

            if (videoRef.current) {
              videoRef.current.muted = false;
              videoRef.current.src = randomSurrender;
              videoRef.current.play().catch(e => {
                console.warn("Surrender (watchdog) video blocked:", e);
                setIsVideoVisible(false);
              });
            }
          }
        }
        // CASE 2: NORMAL END (SYNC LAG)
        // Match finished but I am still playing -> Force Normal End
        else if (isFinished) {
          if (gameStateRef.current.status === 'playing') {
            console.log("SYNC WATCHDOG: Match finished normally. Syncing state.");
            if (timerRef.current) window.clearInterval(timerRef.current);

            // Determine if I won or lost based on DB
            const amIWinner = status.winner_id === currentUser?.id;

            // If I lost, show Lost Sound/Flow. If I won, handle Win.
            // Since we are lagging, easiest is to go to idle and let DuelRecap component show result.
            setGameState(prev => ({ ...prev, status: 'idle' }));
            if (!amIWinner) soundService.playExternalSound('lost.mp3');
            setShowDuelRecap(true);
          }
        }
      }, 3000); // Check every 3 seconds
    }

    return () => {
      if (syncInterval) clearInterval(syncInterval);
    };
  }, [activeMatch, currentUser, gameState.status]);
  */

  // NEW: Invite Listener (Global) - Properly placed after generateGrid
  useEffect(() => {
    if (!currentUser) return;

    const channel = (supabase as any).channel('invite-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `player2_id=eq.${currentUser.id}`,
        },
        async (payload: any) => {
          if (payload.new.status === 'invite_pending') {
            soundService.playSuccess(); // Notification sound

            showToast(`⚔️ SFIDA! Un giocatore ti ha invitato a ${payload.new.mode}.`, [
              {
                label: 'ACCETTA',
                onClick: async () => {
                  const success = await matchService.acceptInvite(payload.new.id, currentUser.id);
                  if (success) {
                    // Initialize Game
                    const seed = payload.new.grid_seed;
                    const mode = payload.new.mode;

                    setActiveMatch({ id: payload.new.id, opponentId: payload.new.player1_id, isDuel: true, isP1: false, mode: mode });
                    setDuelMode(mode);

                    // Reset Game State for Duel
                    soundService.playUIClick();
                    setGameState(prev => ({
                      ...prev,
                      score: 0,
                      totalScore: prev.totalScore,
                      streak: 0,
                      level: 1,
                      timeLeft: mode === 'time_attack' ? 60 : INITIAL_TIME,
                      targetResult: 0,
                      status: 'playing',
                      lastLevelPerfect: true,
                      basePoints: BASE_POINTS_START,
                      levelTargets: [],
                    }));

                    generateGrid(1, seed);
                    setOpponentScore(0);
                    matchService.resetRoundStatus(payload.new.id);

                    // If any modal is open, close it
                    setActiveModal(null);
                  }
                }
              },
              {
                label: 'RIFIUTA',
                onClick: async () => {
                  await matchService.abandonMatch(payload.new.id, currentUser.id);
                  showToast("Invito rifiutato.");
                }
              }
            ]);
          }
        }
      )
      .subscribe();

    return () => { (supabase as any).removeChannel(channel); };
  }, [currentUser, showToast, generateGrid]);


  const startGame = async (startLevel: number = 1) => {
    await handleUserInteraction();
    soundService.playUIClick();
    try {
      localStorage.setItem('number_tutorial_done', 'true');
    } catch (e) { console.warn("LocalStorage blocked", e); }

    setActiveModal(null);
    setIsVictoryAnimating(false);
    setTriggerParticles(false);
    setPreviewResult(null);
    setShowVideo(false);
    setPreviewResult(null);
    setShowVideo(false);
    setShowLostVideo(false);
    setShowDuelRecap(false); // Reset recap state strictly

    // Explicitly reset Main State for NEW GAME
    setGameState({
      score: 0,
      totalScore: 0,
      streak: 0,
      level: startLevel,
      timeLeft: (activeMatch?.mode === 'time_attack') ? 60 : INITIAL_TIME, // FORCE 60s for Time Attack
      targetResult: 0,
      status: 'playing',
      estimatedIQ: 100,
      lastLevelPerfect: true,
      basePoints: BASE_POINTS_START,
      levelTargets: [],
    });

    // Reset Buffer and Grid with explicit Level
    setTimeout(() => generateGrid(startLevel), 0);

    // Clear save if starting new
    if (currentUser) {
      profileService.clearSavedGame(currentUser.id);
      setSavedGame(null);
    }
  };

  const restoreGame = async () => {
    if (!savedGame) return;
    await handleUserInteraction();
    soundService.playSuccess(); // Different sound for restore?

    setActiveModal(null);
    setIsVictoryAnimating(false);
    setTriggerParticles(false);
    setPreviewResult(null);

    setGameState(prev => ({
      ...prev, // Keep some defaults
      score: savedGame.score || 0,
      totalScore: savedGame.totalScore || 0,
      streak: savedGame.streak || 0,
      level: savedGame.level || 1,
      timeLeft: savedGame.timeLeft || INITIAL_TIME,
      status: 'playing',
      estimatedIQ: savedGame.estimatedIQ || 100,
      // Re-hydrate targets from save if possible, or regenerate?
      // Simplest is to regenerate level.
      // This allows "save scumming" the grid layout but keeps points/time.
      // Acceptable for this iteration.
      levelTargets: [],
    }));

    // Generate Grid for the SAVED Level
    setTimeout(() => generateGrid(savedGame.level), 0);
    showToast("Partita Ripristinata");
  };

  const handleStartGameClick = useCallback(async (e?: React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await handleUserInteraction();

    if (savedGame) {
      setActiveModal('resume_confirm');
      return;
    }

    // New Comic Tutorial Check
    if (localStorage.getItem('comic_game_tutorial_done') !== 'true') {
      startGame(); // Start the game first so elements exist
      setTimeout(() => setShowGameTutorial(true), 1000); // Delay to let animation finish
    } else {
      startGame();
    }
  }, [savedGame, startGame, handleUserInteraction]);

  const nextTutorialStep = async () => {
    await handleUserInteraction();
    soundService.playSelect();
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(prev => prev + 1);
    } else {
      // Tutorial Finished - Just close and stay on Home
      setActiveModal(null);
      localStorage.setItem('number_tutorial_done', 'true');
      // If we are not playing, ensure we are visible in idle
      if (gameState.status !== 'playing') {
        setGameState(prev => ({ ...prev, status: 'idle' }));
      }
    }
  };

  const evaluatePath = (pathIds: string[]) => {
    try {
      if (pathIds.length < 3) {
        if (pathIds.length > 0) soundService.playReset();
        setSelectedPath([]);
        setPreviewResult(null);
        return;
      }

      const result = calculateResultFromPath(pathIds);
      // USE REF TO ENSURE FRESHNESS (Fixes First Target Glitch)
      const currentTargets = gameStateRef.current.levelTargets || [];
      const matchedTarget = currentTargets.find(t => t.value === result && !t.completed);

      if (matchedTarget) {
        // SYNC VIDEO TRIGGER FOR MOBILE - Call play() directly in user gesture stack
        const isLastTarget = currentTargets.filter(t => !t.completed).length === 1;
        const isTimeAttack = !!activeMatch && (activeMatch.mode === 'time_attack' || duelMode === 'time_attack');

        // CRITICAL MOBILE FIX: Set source and play synchronously within the event handler
        if (isLastTarget && !isTimeAttack && videoRef.current) {
          // 1. Play "Fine Partita" sound immediately on last click
          soundService.playLevelComplete();

          // 2. Delay the Victory Video (Win1/Win2) to let the first sound play
          setTimeout(() => {
            if (videoRef.current) {
              // Randomly pick between Win1 and Win2
              const winIdx = Math.floor(Math.random() * WIN_VIDEOS.length);
              const vidSrc = WIN_VIDEOS[winIdx];

              videoRef.current.src = vidSrc;
              videoRef.current.muted = true;
              videoRef.current.load();
              videoRef.current.play().catch(e => console.warn("Video play blocked:", e));

              // Play Sync Win Audio (matching the video)
              soundService.playWinner(winIdx);

              setWinVideoSrc(vidSrc);
              setShowVideo(true);
              setIsVideoVisible(true);
            }
          }, 800); // 0.8 second delay
        }

        handleSuccess(result!);
      } else {
        handleError();
      }
      setPreviewResult(null);
    } catch (err) {
      console.error("Critical error in evaluatePath:", err);
      // Prevent crash, reset selection
      setSelectedPath([]);
    }
  };

  /* HANDLE SUCCESS - FULLY REF BASED */
  const handleSuccess = async (matchedValue: number) => {
    try {
      // RACE CONDITION FIX: Do not process win if game is already over
      if (gameStateRef.current.status !== 'playing') return;

      soundService.playSuccess(); // Riproduci suono combinazione trovata

      // NEW SCORING: ARCADE SCALABLE
      const basePoints = 10;
      const streakBonus = gameStateRef.current.streak * 1;
      const currentPoints = basePoints + streakBonus;

      // DEFINISCI COSTANTI PER LINT FIX
      const finalTimeBonus = Math.floor(gameStateRef.current.timeLeft * 1.5);
      const finalVictoryBonus = 50;
      const totalPointsToAdd = currentPoints + finalTimeBonus + finalVictoryBonus;

      setScoreAnimKey(k => k + 1);

      // Update targets state
      const currentTargets = gameStateRef.current.levelTargets;
      const targetIndex = currentTargets.findIndex(t => t.value === matchedValue && !t.completed);

      const newTargets = [...currentTargets];
      if (targetIndex !== -1) {
        newTargets[targetIndex] = { ...newTargets[targetIndex], completed: true };
      }

      // Time Attack only applies if we are in an Active Duel
      const isTimeAttack = !!activeMatch && (duelMode === 'time_attack' || activeMatch.mode === 'time_attack');
      const allDone = newTargets.every(t => t.completed) && !isTimeAttack;

      if (allDone) {
        setTriggerParticles(false);
        // Sound is already played in evaluatePath for sync, or play here if needed as fallback
        if (!videoRef.current) soundService.playExternalSound('Fine_partita_win.mp3');

        // DUEL WIN LOGIC
        if (activeMatch?.isDuel && duelMode === 'standard') {
          try {
            await matchService.declareWinner(activeMatch.id, currentUser.id);
            processedWinRef.current = activeMatch.id;

            // Optimistic Update
            setLatestMatchData(prev => ({
              ...prev,
              status: 'finished',
              winner_id: currentUser!.id,
              player1_score: activeMatch.isP1 ? gameStateRef.current.score + totalPointsToAdd : prev?.player1_score,
              player2_score: !activeMatch.isP1 ? gameStateRef.current.score + totalPointsToAdd : prev?.player2_score,
              p1_rounds: activeMatch.isP1 ? 5 : prev?.p1_rounds,
              p2_rounds: !activeMatch.isP1 ? 5 : prev?.p2_rounds,
              last_time_bonus: finalTimeBonus,
              last_victory_bonus: finalVictoryBonus
            }));

            // Sync Profile
            await profileService.syncProgress(currentUser.id, totalPointsToAdd, gameStateRef.current.level, gameStateRef.current.estimatedIQ);
            await loadProfile(currentUser.id);

            // 1. Play "Fine Partita" sound
            soundService.playLevelComplete();

            // 2. Play Random Victory Video
            setTimeout(() => {
              if (videoRef.current) {
                const winIdx = Math.floor(Math.random() * WIN_VIDEOS.length);
                const vidSrc = WIN_VIDEOS[winIdx];
                videoRef.current.src = vidSrc;
                videoRef.current.muted = true;
                videoRef.current.load();
                videoRef.current.play().catch(e => console.warn("Duel win video blocked:", e));
                soundService.playWinner(winIdx);
                setWinVideoSrc(vidSrc);
                setShowVideo(true);
                setIsVideoVisible(true);
              }
            }, 800);

            // 3. Delay Recap to let video play
            setTimeout(() => {
              setShowDuelRecap(true);
            }, 7500); // 7.5s (longer than video)

          } catch (error: any) {
            console.error("Error finishing duel safely:", error);
            setGameState(prev => ({ ...prev, status: 'idle' }));
            setShowDuelRecap(true);
          }
          setSelectedPath([]);
          return;
        }

        // STANDARD LEVEL WIN LOGIC (Single Player)
        if (timerRef.current) window.clearInterval(timerRef.current);
        setIsVictoryAnimating(true);
        const nextLevelScore = gameStateRef.current.totalScore + totalPointsToAdd;

        setGameState(prev => ({
          ...prev,
          score: prev.score + totalPointsToAdd,
          totalScore: nextLevelScore,
          streak: 0,
          estimatedIQ: Math.min(200, prev.estimatedIQ + 4),
          levelTargets: newTargets,
        }));

        if (currentUser) {
          const saveState = {
            totalScore: nextLevelScore,
            streak: 0,
            level: gameState.level + 1,
            timeLeft: gameState.timeLeft + 60,
            estimatedIQ: Math.min(200, gameState.estimatedIQ + 4)
          };
          profileService.saveGameState(currentUser.id, saveState)
            .then(() => loadProfile(currentUser.id))
            .catch(e => console.error("Error saving game state:", e));
          setSavedGame(saveState);
        }

      } else {
        // NOT ALL DONE - CONTINUE PLAYING
        const newScore = gameStateRef.current.score + currentPoints;
        const completedCount = newTargets.filter(t => t.completed).length;

        setGameState(prev => ({
          ...prev,
          score: prev.score + currentPoints,
          totalScore: prev.totalScore + currentPoints,
          streak: prev.streak + 1,
          estimatedIQ: Math.min(200, prev.estimatedIQ + 0.5),
          levelTargets: newTargets
        }));

        // SYNC DUEL STATS
        if (activeMatch?.isDuel) {
          matchService.updateMatchStats(activeMatch.id, activeMatch.isP1, newScore, completedCount)
            .catch(e => console.error("Error syncing duel stats:", e));
        }

        // TIME ATTACK: Individual Target Refill
        if (duelMode === 'time_attack' || activeMatch?.mode === 'time_attack') {
          setTimeout(() => {
            const currentState = gameStateRef.current;
            if (!currentState || !currentState.grid) return;

            const currentGrid = currentState.grid;
            const currentRefTargets = currentState.levelTargets || [];
            const allSols = Array.from(findAllSolutions(currentGrid));
            const activeValues = currentRefTargets.filter(t => !t.completed).map(t => t.value);
            const candidates = allSols.filter(v => !activeValues.includes(v));

            if (candidates.length > 0) {
              const nextVal = candidates[Math.floor(Math.random() * candidates.length)];
              setGameState(prev => {
                const updated = [...prev.levelTargets];
                const idx = updated.findIndex(t => t.value === matchedValue && t.completed);
                if (idx !== -1) {
                  updated[idx] = { value: nextVal, completed: false };
                }
                return { ...prev, levelTargets: updated };
              });
              soundService.playPop();
            }
          }, 3000);
        }
      }
      setSelectedPath([]);
    } catch (error) {
      console.error("Critical error in handleSuccess:", error);
      setGameState(prev => ({ ...prev, status: 'idle' }));
      setSelectedPath([]);
    }
  };

  const handleTimeAttackEnd = () => {
    // 1. Play Sound (Finished)
    soundService.playExternalSound('Fine_partita_win.mp3');

    // 2. Final Score Update and Finish Match
    if (activeMatch && currentUser) {
      processedWinRef.current = activeMatch.id;
      const myScore = gameStateRef.current.score;
      const oppScore = opponentScore;

      let winnerId: string | null = null;
      if (myScore > oppScore) winnerId = currentUser.id;
      else if (oppScore > myScore) winnerId = activeMatch.opponentId;

      const iWon = winnerId === currentUser.id;

      matchService.updateMatchStats(activeMatch.id, activeMatch.isP1, myScore, gameStateRef.current.levelTargets.filter(t => t.completed).length)
        .then(() => matchService.declareWinner(activeMatch.id, winnerId))
        .catch(e => console.error("Error ending time attack:", e));

      // 3. Play Video before Recap
      if (iWon) {
        setTimeout(() => {
          if (videoRef.current) {
            const winIdx = Math.floor(Math.random() * WIN_VIDEOS.length);
            const vidSrc = WIN_VIDEOS[winIdx];
            videoRef.current.src = vidSrc;
            videoRef.current.muted = true;
            videoRef.current.load();
            videoRef.current.play().catch(e => console.warn("TimeAttack win video blocked:", e));
            soundService.playWinner(winIdx);
            setWinVideoSrc(vidSrc);
            setShowVideo(true);
            setIsVideoVisible(true);
          }
        }, 800);
      } else {
        setTimeout(() => {
          if (videoRef.current) {
            const loseVid = LOSE_VIDEOS[0];
            videoRef.current.src = loseVid;
            videoRef.current.muted = true;
            videoRef.current.load();
            videoRef.current.play().catch(e => console.warn("TimeAttack loss video blocked:", e));
            soundService.playLose();
            setLoseVideoSrc(loseVid);
            setShowLostVideo(true);
            setIsVideoVisible(true);
          }
        }, 800);
      }

      // 4. Show Recap after delay
      setTimeout(() => {
        setGameState(prev => ({ ...prev, status: 'idle' }));
        setShowDuelRecap(true);
      }, iWon ? 7500 : 4500);
    } else {
      setGameState(prev => ({ ...prev, status: 'idle' }));
      setShowDuelRecap(true);
    }
  };

  const handleError = () => {
    soundService.playError();
    setGameState(prev => ({
      ...prev,
      streak: 0,
      lastLevelPerfect: false,
      basePoints: BASE_POINTS_START,
      estimatedIQ: Math.max(70, prev.estimatedIQ - 1.5),
    }));
    setSelectedPath([]);
  };



  const nextLevel = () => {
    soundService.playUIClick();
    setIsVictoryAnimating(false);
    const nextLvl = gameState.level + 1;
    setGameState(prev => ({
      ...prev,
      level: nextLvl,
      status: 'playing',
      streak: 0,
      // CARRY OVER: Add 60s to whatever is left
      timeLeft: prev.timeLeft + 60,
    }));
    // Pass explicit level to avoid stale state
    generateGrid(nextLvl);
  };



  useEffect(() => {
    if (gameState.status === 'level-complete' || gameState.status === 'game-over') {
      getIQInsights(gameState.totalScore, gameState.level, gameState.timeLeft).then(setInsight);
    }
  }, [gameState.status, gameState.totalScore, gameState.level, gameState.timeLeft]); // Added dependencies

  /* INPUT BLOCKING LOGIC */
  const canInteract = () => {
    // STRICTLY BLOCK if game is over or paused or not playing
    if (gameState.status !== 'playing') return false;
    if (isPaused) return false;
    if (isVictoryAnimating) return false;
    if (showVideo || showLostVideo) return false;
    if (showDuelRecap) return false; // Explicitly block if recap is open
    return true;
  };

  const onStartInteraction = async (id: string) => {
    if (!canInteract()) return;
    await handleUserInteraction();

    const cell = grid.find(c => c.id === id);
    if (cell && cell.type === 'number') {
      soundService.playSelect();
      setIsDragging(true);
      setSelectedPath([id]);
      setPreviewResult(parseInt(cell.value));
    }
  };

  const isAdjacent = (cell1: HexCellData, cell2: HexCellData): boolean => {
    if (theme === 'orange') {
      const dr = Math.abs(cell1.row - cell2.row);
      const dc = Math.abs(cell1.col - cell2.col);
      // Rectilinear adjacency: Up/Down OR Left/Right
      return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
    }

    const dr = Math.abs(cell1.row - cell2.row);
    const dc = cell2.col - cell1.col;

    // Stessa riga
    if (dr === 0) return Math.abs(dc) === 1;

    // Righe adiacenti
    if (dr === 1) {
      // Per il sistema offset a righe pari
      if (cell1.row % 2 === 0) {
        return dc === 0 || dc === -1;
      } else {
        return dc === 0 || dc === 1;
      }
    }
    return false;
  };

  const onMoveInteraction = (id: string) => {
    if (!isDragging || !canInteract()) return;
    // BACKTRACKING LOGIC
    // Se l'utente torna alla penultima casella selezionata, rimuovi l'ultima (backtrack)
    if (selectedPath.length > 1 && id === selectedPath[selectedPath.length - 2]) {
      soundService.playSelect(); // Suono feedback rimozione
      const newPath = selectedPath.slice(0, -1);
      setSelectedPath(newPath);
      setPreviewResult(calculateResultFromPath(newPath));
      return;
    }

    if (selectedPath.includes(id)) return;

    const lastId = selectedPath[selectedPath.length - 1];
    const lastCell = grid.find(c => c.id === lastId);
    const currentCell = grid.find(c => c.id === id);

    if (lastCell && currentCell) {
      // Regola 1: Alternanza Tipi (Numero -> Operatore o viceversa)
      const typeCheck = lastCell.type !== currentCell.type;

      // Regola 2: Adiacenza Fisica (Deve essere un vicino diretto nell'esagono)
      const adjacencyCheck = isAdjacent(lastCell, currentCell);

      if (typeCheck && adjacencyCheck) {
        soundService.playSelect();
        const newPath = [...selectedPath, id];
        setSelectedPath(newPath);
        setPreviewResult(calculateResultFromPath(newPath));
      }
    }
  };

  const handleGlobalEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      evaluatePath(selectedPath);
    }
  };





  const handleVideoClose = () => {
    // 1. Visual Fade Out
    setIsVideoVisible(false);

    // 2. Audio Fade Out
    if (videoRef.current) {
      const vid = videoRef.current;
      const startVolume = vid.volume; // usually 1.0
      const fadeDuration = 2000;
      const intervalTime = 50; // run every 50ms
      const steps = fadeDuration / intervalTime; // 40 steps
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        const progress = Math.min(1, currentStep / steps);
        const newVolume = Math.max(0, startVolume * (1 - progress) * (1 - progress));

        if (newVolume > 0.01) {
          vid.volume = newVolume;
        } else {
          vid.volume = 0;
          clearInterval(fadeInterval);
        }
      }, intervalTime);
    }

    // 3. Unmount after fade
    setTimeout(() => {
      setShowVideo(false);
      setIsVictoryAnimating(false);
      setGameState(prev => ({
        ...prev,
        status: 'level-complete'
      }));
    }, 2000);
  };

  const handleLostVideoClose = () => {
    // 1. Visual Fade Out
    setIsVideoVisible(false);

    // 2. Audio Fade Out
    if (videoRef.current) {
      const vid = videoRef.current;
      const startVolume = vid.volume;
      const fadeDuration = 800;
      const intervalTime = 40;
      const steps = fadeDuration / intervalTime;
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        const progress = Math.min(1, currentStep / steps);
        const newVolume = Math.max(0, startVolume * (1 - progress) * (1 - progress));

        if (newVolume > 0.01) {
          vid.volume = newVolume;
        } else {
          vid.volume = 0;
          clearInterval(fadeInterval);
        }
      }, intervalTime);
    }

    // 3. Unmount after fade
    setTimeout(() => {
      setShowLostVideo(false);
    }, 800);
  };

  const handleSurrenderVideoClose = () => {
    setIsVideoVisible(false);
    if (videoRef.current) {
      const vid = videoRef.current;
      const startVolume = vid.volume;
      const fadeDuration = 800;
      const intervalTime = 40;
      const steps = fadeDuration / intervalTime;
      let currentStep = 0;

      const fadeInterval = setInterval(() => {
        currentStep++;
        const progress = Math.min(1, currentStep / steps);
        const newVolume = Math.max(0, startVolume * (1 - progress) * (1 - progress));
        if (newVolume > 0.01) vid.volume = newVolume;
        else {
          vid.volume = 0;
          clearInterval(fadeInterval);
        }
      }, intervalTime);
    }

    setTimeout(() => {
      setShowSurrenderVideo(false);
      setGameState(prev => ({ ...prev, status: 'opponent-surrendered' })); // Custom Status
    }, 800);
  };

  return (
    <>
      {showIntro && <IntroVideo onFinish={() => {
        setShowIntro(false);
        setGameState(prev => ({ ...prev, status: 'idle' }));
        // Check for Home Tutorial
        if (localStorage.getItem('comic_home_tutorial_done') !== 'true') {
          setTimeout(() => setShowHomeTutorial(true), 500);
        }
      }} />}
      <div
        className="min-h-[100dvh] bg-gradient-to-t from-[#004488] to-[#0088dd] text-slate-100 font-sans overflow-hidden select-none pb-20 safe-area-bottom"
        onPointerUp={handleGlobalEnd}
        onPointerLeave={handleGlobalEnd}
      >




        {/* WIN VIDEO OVERLAY REMOVED (Duplicate/Legacy) */}

        {/* UNIFIED VIDEO OVERLAY - Always in DOM for Mobile Unlock */}
        <div
          className={`fixed inset-0 z-[2000] bg-black flex items-center justify-center transition-opacity duration-[800ms] ease-out 
            ${(showVideo || showLostVideo || showSurrenderVideo) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          onPointerDown={() => {
            if (showVideo) handleVideoClose();
            else if (showLostVideo) handleLostVideoClose();
            else if (showSurrenderVideo) handleSurrenderVideoClose();
          }}
        >
          <video
            ref={videoRef}
            src={showVideo ? winVideoSrc : (showLostVideo ? loseVideoSrc : (showSurrenderVideo ? surrenderVideoSrc : ''))}
            className="w-full h-full object-cover"
            playsInline
            autoPlay
            onPlay={() => {
              if (videoRef.current) videoRef.current.volume = 0.7;
              setIsVideoVisible(true);
            }}
            onEnded={() => {
              if (showVideo) handleVideoClose();
              else if (showLostVideo) handleLostVideoClose();
              else if (showSurrenderVideo) handleSurrenderVideoClose();
            }}
          />

          {/* Overlay color based on state */}
          {showLostVideo && <div className="absolute inset-0 bg-red-900/10 mix-blend-overlay pointer-events-none"></div>}
          {showSurrenderVideo && <div className="absolute inset-0 bg-blue-900/10 mix-blend-overlay pointer-events-none"></div>}

          {(showVideo || showLostVideo || showSurrenderVideo) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 z-50 pointer-events-none">
              {/* FAIL-SAFE TAP TO PLAY (Only visible if video stuck/not visible) */}
              {/* FAIL-SAFE TAP TO PLAY REMOVED - AUTOMATIC ONLY */}


              <button
                className="absolute bottom-12 right-12 z-50 px-6 py-3 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl text-white font-orbitron font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all flex items-center gap-3 active:scale-95 group pointer-events-auto"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  if (showVideo) handleVideoClose();
                  else if (showLostVideo) handleLostVideoClose();
                  else if (showSurrenderVideo) handleSurrenderVideoClose();
                }}
              >
                <span>SKIP</span>
                <FastForward size={14} className={showLostVideo ? "text-red-500" : (showSurrenderVideo ? "text-blue-500" : "text-[#FF8800]")} />
              </button>
            </div>
          )}
        </div>


        <ParticleEffect trigger={triggerParticles} />

        {/* Abstract Curves Background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-[0.08]">
          <path d="M-100 200 Q 200 0 500 300 T 1000 100" stroke="white" strokeWidth="60" fill="none" />
          <path d="M-100 500 Q 300 300 600 600 T 1200 400" stroke="white" strokeWidth="40" fill="none" />
          <path d="M-100 800 Q 400 600 800 900 T 1300 700" stroke="white" strokeWidth="80" fill="none" />
          <path d="M800 -100 Q 600 300 900 600" stroke="white" strokeWidth="30" fill="none" />
        </svg>

        {toast.visible && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[10000] animate-toast-in w-[90%] max-w-md">
            <div className="bg-slate-900/95 text-white px-8 py-5 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex flex-col items-center gap-4 border-[3px] border-[#FF8800] backdrop-blur-xl">
              <span className="font-bold text-center text-lg leading-snug drop-shadow-md">{toast.message}</span>
              {toast.actions && (
                <div className="flex gap-3 w-full justify-center">
                  {toast.actions.map((action, i) => (
                    <button
                      key={i}
                      onPointerDown={(e) => { e.stopPropagation(); action.onClick(); }}
                      className={`px-6 py-2.5 rounded-xl font-black uppercase text-sm tracking-wider transition-all active:scale-95 shadow-lg border-2
                                ${action.variant === 'secondary'
                          ? 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'
                          : 'bg-[#FF8800] text-white border-white hover:bg-[#FF9900]'
                        }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}



        {gameState.status === 'idle' && (
          <>
            <CharacterHelper />
            <div className="z-10 w-full max-w-xl flex flex-col items-center text-center px-6 pt-24 pb-32 animate-screen-in relative">

              {/* TOP LEFT: User Auth */}
              <div className="fixed bottom-4 left-4 z-50 flex gap-3 items-center" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
                <button
                  onPointerDown={async (e) => {
                    e.stopPropagation();
                    await handleUserInteraction();
                    soundService.playUIClick();
                    if (currentUser) {
                      setActiveModal('logout_confirm');
                    } else {
                      showToast('Accesso richiesto');
                      setShowAuthModal(true);
                    }
                  }}
                  id={currentUser ? "user-profile-home" : "login-btn-home"}
                  className="flex items-center gap-3 pr-3 pl-1 py-1 rounded-full bg-black/40 border border-white/20 backdrop-blur-md hover:bg-black/60 transition-all group"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-white/50 shadow-lg ${currentUser ? 'bg-[#FF8800] text-white' : 'bg-slate-700 text-slate-400 group-hover:bg-white group-hover:text-[#FF8800] transition-colors'}`}>
                    <User size={20} strokeWidth={2.5} />
                  </div>
                  {currentUser && (
                    <div className="flex flex-col items-start pl-2 leading-none">
                      <span className="font-orbitron font-bold text-xs text-white uppercase tracking-widest leading-none">
                        {userProfile?.username || 'GUEST'}
                      </span>
                      <span className="font-orbitron text-[8px] font-black text-[#FF8800] uppercase tracking-tighter mt-1">
                        {userProfile?.total_score || 0} PTS
                      </span>
                    </div>
                  )}
                </button>
              </div>

              {/* TOP RIGHT: Audio (Fixed at the very top) */}
              <div className="fixed top-12 right-6 z-[3000] flex gap-3 items-center">
                <button
                  onPointerDown={toggleMute}
                  className={`w-12 h-12 rounded-full border-2 border-white/50 shadow-lg flex items-center justify-center active:scale-95 transition-all hover:scale-110
                    ${isMuted ? 'bg-slate-700 text-slate-400' : 'bg-[#FF8800] text-white'}`}
                  title="Audio"
                  id="audio-btn-home"
                >
                  {isMuted ? <VolumeX size={24} strokeWidth={2.5} /> : <Volume2 size={24} strokeWidth={2.5} />}
                </button>
              </div>

              {/* BOTTOM RIGHT ICONS: Admin & Tutorial (FIXED Position) */}
              <div className="fixed bottom-4 right-4 z-[2000] flex gap-3" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Tutorial Icon */}
                <button
                  onPointerDown={async (e) => { e.stopPropagation(); await handleUserInteraction(); soundService.playUIClick(); setTutorialStep(0); setActiveModal('tutorial'); }}
                  id="tutorial-btn-home"
                  className="w-12 h-12 rounded-full bg-white text-[#FF8800] border-2 border-white/50 shadow-lg flex items-center justify-center active:scale-95 transition-all hover:scale-110"
                  title="Tutorial"
                >
                  <HelpCircle size={24} strokeWidth={2.5} />
                </button>

                {/* Admin Access */}
                <button
                  onPointerDown={async (e) => {
                    e.stopPropagation();
                    await handleUserInteraction();
                    soundService.playUIClick();
                    setActiveModal('admin');
                  }}
                  className="w-12 h-12 rounded-full bg-white text-[#FF8800] border-2 border-white/50 shadow-lg flex items-center justify-center active:scale-95 transition-all hover:scale-110"
                  title="Admin Access"
                >
                  <Shield size={24} strokeWidth={2.5} />
                </button>
              </div>
              <div className="mb-6 flex flex-col items-center">
                {/* Logo: Custom Shape Image with White Border & Brain */}
                {/* Logo: Pure Color CSS Mask Implementation */}
                {/* Logo: Custom Shape Image with White Border & Brain */}
                {/* Logo: Pure Color CSS Mask Implementation */}
                <div
                  onPointerDown={async (e) => {
                    e.stopPropagation();
                    await handleUserInteraction();
                    soundService.playUIClick();
                    setActiveModal('profile');
                  }}
                  id="logo-home"
                  className={`relative w-36 h-36 flex items-center justify-center mb-4 transition-all duration-[2000ms] ease-in-out group cursor-pointer ${logoAnim ? 'scale-110 drop-shadow-[0_0_25px_rgba(255,136,0,0.6)]' : 'hover:scale-110'}`}
                  title="Apri Profilo"
                >
                  {/* Custom Octagon Image */}
                  <img src="/octagon-base.png" alt="Logo Base" className="absolute inset-0 w-full h-full object-contain drop-shadow-lg" />

                  {/* Brain Icon - Centered */}
                  <Brain className="relative w-16 h-16 text-white drop-shadow-md z-10" strokeWidth={2.5} />

                </div>

                <h1 className="text-6xl sm:text-8xl font-black font-orbitron tracking-tighter text-[#FF8800] lowercase" style={{ WebkitTextStroke: '3px white' }}>
                  number
                </h1>
              </div>

              {/* Tip Bubble Removed */}

              <div className="flex flex-col gap-4 items-center w-full max-w-sm relative z-20">
                <button
                  onPointerDown={handleStartGameClick}
                  id="play-btn-home"
                  className="w-full group relative overflow-hidden flex items-center justify-center gap-4 bg-gradient-to-r from-[#FF8800] to-[#FF5500] text-white py-5 rounded-2xl font-orbitron font-black text-xl border-[4px] border-white shadow-[0_8px_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-[0_4px_0_rgba(0,0,0,0.2)] hover:scale-105 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                  <Play className="w-8 h-8 fill-current relative z-10" />
                  <span className="tracking-widest relative z-10">{savedGame && savedGame.level > 1 ? `CONTINUA LVL ${savedGame.level}` : "GIOCA"}</span>
                </button>

                <div className="grid grid-cols-2 gap-4 w-full">
                  {/* 1VS1 MODE BUTTON - NEURAL DUEL */}
                  {/* 1VS1 MODE BUTTON - SINGLE ENTRY */}
                  <button
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white py-5 rounded-xl border-[3px] border-white shadow-[0_6px_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none hover:scale-105 transition-all duration-300 col-span-2 relative overflow-hidden group"
                    id="duel-btn-home"
                    onPointerDown={() => {
                      soundService.playUIClick();
                      if (!currentUser) {
                        showToast("Accedi per sfidare altri giocatori!");
                        setShowAuthModal(true);
                      } else {
                        setActiveModal('duel_selection'); // Open Selection logic
                      }
                    }}
                  >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                    <Swords className="w-8 h-8 animate-pulse text-yellow-300" />
                    <div className="flex flex-col items-start leading-none relative z-10">
                      <span className="font-orbitron text-xl font-black uppercase tracking-widest italic drop-shadow-md">NEURAL DUEL</span>
                      <span className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Sfida 1vs1 Realtime</span>
                    </div>
                    {/* Badge */}
                    <div className="absolute top-2 right-2 bg-red-600/90 backdrop-blur-md border border-white/20 px-2 py-0.5 rounded text-[8px] font-bold text-white animate-pulse shadow-lg">NEW MODES</div>
                  </button>

                  <button
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-600 text-white py-4 rounded-xl border-[3px] border-white shadow-[0_6px_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none hover:scale-105 transition-all duration-300 col-span-2 relative overflow-hidden group"
                    id="challenges-btn-home"
                    onPointerDown={() => { soundService.playUIClick(); showToast("Nessuna sfida attiva al momento"); }}
                  >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <Trophy className="w-6 h-6" />
                    <span className="font-orbitron text-sm font-black uppercase tracking-widest relative z-10">Sfide (0)</span>
                    {/* Coming Soon Badge */}
                    <div className="absolute top-2 right-2 bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold">PRESTO</div>
                  </button>

                  <button onPointerDown={async (e) => { e.stopPropagation(); await handleUserInteraction(); soundService.playUIClick(); setActiveModal('leaderboard'); }}
                    id="ranking-btn-home"
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-900 py-4 rounded-xl border-[3px] border-white shadow-[0_6px_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none hover:scale-105 transition-all duration-300 col-span-2 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-15"></div>
                    <BarChart3 className="w-6 h-6 relative z-10" />
                    <span className="font-orbitron text-xs font-black uppercase tracking-widest relative z-10">CLASSIFICA</span>
                  </button>
                </div>

                {/* AUTH BUTTON */}
                {/* Auth Button Moved to Top Right - Removed from here */}

                {/* Audio Button Removed */}


              </div>
            </div>
          </>
        )}



        {gameState.status !== 'idle' && (
          <div className="w-full h-full flex flex-col items-center z-10 p-4 max-w-4xl animate-screen-in">
            <header className="w-full max-w-2xl mx-auto mb-2 relative z-50">
              <div className="
              relative w-full flex justify-between items-center px-4 py-3 rounded-[2.5rem] border-[4px] border-white shadow-[0_8px_0_rgba(0,0,0,0.15)]
              bg-gradient-to-r from-orange-400 via-[#FF5500] to-orange-600
              transition-all duration-300
            ">
                {/* Left Group: Buttons */}
                <div className="flex items-center gap-3">
                  <button
                    onPointerDown={goToHome}
                    className="w-11 h-11 rounded-full border-[3px] border-white flex items-center justify-center transition-all active:scale-90 shadow-md bg-white text-[#FF8800]"
                    title="Home"
                  >
                    <Home className="w-6 h-6" />
                  </button>
                  <button
                    onPointerDown={toggleMute}
                    className="w-11 h-11 rounded-full border-[3px] border-white flex items-center justify-center transition-all active:scale-90 shadow-md bg-white text-[#FF8800]"
                  >
                    {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                  </button>
                </div>

                {/* Center: Floating Timer (Half-In/Half-Out) */}
                {/* Center: Floating Timer (Half-In/Half-Out) - CLICKABLE PAUSE */}
                <div id="timer-display-game" className="absolute left-1/2 -translate-x-1/2 top-1/2 transform translate-y-[-10%] z-[100] cursor-pointer group" onPointerDown={activeMatch?.isDuel ? undefined : togglePause}>
                  <div className={`relative w-24 h-24 rounded-full bg-slate-900 border-[4px] border-white flex items-center justify-center shadow-xl transition-all duration-300 ${isPaused ? 'border-[#FF8800] scale-110 shadow-[0_0_30px_rgba(255,136,0,0.5)]' : 'group-hover:scale-105'} ${(activeMatch?.isDuel && duelMode !== 'time_attack') ? 'border-red-500/50 grayscale-0 opacity-100 flex flex-col' : ''}`}>
                    <svg className="absolute inset-0 w-full h-full -rotate-90 scale-90">
                      <circle cx="50%" cy="50%" r="45%" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                      {!isPaused && (
                        <circle
                          cx="50%" cy="50%" r="45%"
                          stroke={activeMatch?.isDuel && duelMode !== 'time_attack'
                            ? `rgb(${Math.floor(((opponentTargets || 0) / (duelMode === 'blitz' ? 3 : 5)) * 205 + 34)}, ${Math.floor((1 - (opponentTargets || 0) / (duelMode === 'blitz' ? 3 : 5)) * 129 + 68)}, 68)`
                            : (gameState.timeLeft <= 10 ? '#ef4444' : '#FF8800')}
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray="283"
                          strokeDashoffset={activeMatch?.isDuel && duelMode !== 'time_attack'
                            ? 283 - (283 * (opponentTargets || 0) / (duelMode === 'blitz' ? 3 : 5))
                            : (283 * (1 - gameState.timeLeft / 60)) // Force 60s denominator
                          }
                          strokeLinecap="round"
                          className="transition-all duration-1000"
                        />
                      )}
                    </svg>
                    {isPaused ? (
                      <Pause className="w-10 h-10 text-white animate-pulse" fill="white" />
                    ) : (
                      <>
                        {/* Label Logic */}
                        {(() => {
                          if (activeMatch?.isDuel && duelMode !== 'time_attack') return <span className="text-[8px] font-black text-slate-500 uppercase leading-none mb-1">AVV</span>;
                          return null;
                        })()}

                        {/* Value Logic */}
                        <span className={`font-black font-orbitron text-white ${activeMatch?.isDuel ? 'text-4xl' : 'text-3xl'}`}>
                          {duelMode === 'time_attack'
                            ? gameState.timeLeft
                            : (activeMatch?.isDuel ? opponentTargets : gameState.timeLeft)}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* LEADERBOARD/STATS Header - ADAPTED FOR DUEL (WHITE CIRCLE VERSION) */}
                {activeMatch?.isDuel ? (
                  <div className="flex items-center gap-4 pl-20 sm:pl-0">
                    {duelMode === 'blitz' ? (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black uppercase text-amber-100">ROUND</span>
                        <span className="text-2xl font-black font-orbitron text-white">{duelRounds.current}/5</span>
                        {/* Opponent Mini Circle for Blitz too? */}
                      </div>
                    ) : null}

                    {/* Duel Dashboard circle: Shows Match Points, not global */}
                    <div id="score-display-game" className="w-14 h-14 rounded-full bg-white border-[3px] border-white/20 flex flex-col items-center justify-center shadow-xl transform hover:scale-105 transition-transform">
                      <span className="text-[7px] font-black text-[#FF8800] leading-none mb-0.5 uppercase">PTS</span>
                      <span className="text-xl font-black font-orbitron text-[#FF8800] leading-none">
                        {gameState.score}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div id="score-display-game" className="w-11 h-11 rounded-full border-[3px] border-white flex flex-col items-center justify-center shadow-md bg-white text-[#FF8800]">
                      <span className="text-[7px] font-black uppercase leading-none opacity-80 mb-0.5">PTS</span>
                      <span className="text-xs font-black font-orbitron leading-none tracking-tighter">{gameState.totalScore}</span>
                    </div>
                    <div className="w-11 h-11 rounded-full border-[3px] border-white flex flex-col items-center justify-center shadow-md bg-white text-[#FF8800]">
                      <span className="text-[7px] font-black uppercase leading-none opacity-80 mb-0.5">LV</span>
                      <span className="text-sm font-black font-orbitron leading-none">{gameState.level}</span>
                    </div>
                  </div>
                )}
              </div>
            </header>

            <main className="relative flex-grow w-full flex flex-col items-center justify-center">
              {gameState.status === 'playing' && (
                <div className="w-full flex flex-col items-center h-full relative">
                  {/* Info Row: Current Calculation Badge (Left) */}
                  <div className="w-full max-w-2xl px-4 flex justify-start items-center min-h-[50px] mb-2 mt-6">
                    <div className={`transition-all duration-300 transform origin-left
                        ${isDragging && selectedPath.length > 0 ? 'opacity-100 scale-100 translate-x-0' : 'opacity-0 scale-90 -translate-x-4 pointer-events-none'}`}>
                      <div className={`px-5 py-2 rounded-xl border-[3px] flex items-center gap-3 shadow-md transition-colors duration-200
                          ${(previewResult !== null && gameState.levelTargets.some(t => t.value === previewResult && !t.completed))
                          ? 'bg-[#FF8800] border-white text-white scale-105'
                          : 'bg-white border-[#FF8800] text-[#FF8800]'}`}>
                        <span className="text-[10px] font-black uppercase tracking-wider opacity-80">Totale:</span>
                        <span className="text-2xl font-black font-orbitron leading-none">
                          {previewResult !== null ? previewResult : '...'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center gap-2 mb-5">
                    {/* Level Targets List */}
                    <div className="flex gap-2 items-center flex-wrap justify-center max-w-[300px]" id="targets-display-tutorial">
                      {gameState.levelTargets.map((t, i) => (
                        <div key={i} className={`
                                flex items-center justify-center w-12 h-12 rounded-xl transition-all duration-300
                                ${t.completed
                            ? 'bg-[#FF8800] border-2 border-white scale-110 shadow-[0_0_15px_rgba(255,136,0,0.6)]'
                            : 'bg-[#0055AA] border-2 border-white/50 opacity-100'}
                                font-orbitron font-black text-white text-xl shadow-lg drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]
                             `}>
                          {t.value}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative flex-grow w-full flex items-center justify-center overflow-visible">

                    {isPaused && (
                      <div id="pause-overlay-game" className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl rounded-3xl transition-all animate-fadeIn">
                        <div className="flex flex-col items-center gap-4">
                          <Pause className="w-24 h-24 text-white opacity-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                          <span className="font-orbitron font-black text-2xl text-white tracking-[0.3em] animate-pulse">PAUSA</span>
                        </div>
                      </div>
                    )}

                    <div id="grid-container-game" className={`relative mx-auto transition-all duration-500 transform
                    ${isPaused ? 'opacity-10 scale-95 filter blur-lg pointer-events-none grayscale' : 'opacity-100 scale-100 filter-none'}
                    ${theme === 'orange'
                        ? 'w-[calc(272px*var(--hex-scale))] h-[calc(376px*var(--hex-scale))]'
                        : 'w-[calc(400px*var(--hex-scale))] h-[calc(480px*var(--hex-scale))]'
                      }`}>
                      {grid.map(cell => (
                        <HexCell key={cell.id} data={cell} isSelected={selectedPath.includes(cell.id)} isSelectable={!isVictoryAnimating && !isPaused} onMouseEnter={onMoveInteraction} onMouseDown={onStartInteraction} theme={theme} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {gameState.status === 'game-over' && (
                <div className="glass-panel p-6 rounded-[2rem] text-center modal-content animate-screen-in w-full max-w-sm mt-12 relative overflow-hidden border-[3px] border-[#FF8800]/30 shadow-[0_0_50px_rgba(255,136,0,0.2)]">
                  {/* Background Texture */}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

                  <AlertTriangle className="w-12 h-12 text-[#FF8800] mx-auto mb-2 animate-pulse" />
                  <h2 className="text-3xl font-black font-orbitron mb-1 text-[#FF8800] tracking-wider">HAI PERSO</h2>
                  <div className="text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-[0.2em]">Livello Non Superato</div>

                  <div className="space-y-3 relative z-10">
                    <button onPointerDown={(e) => { e.stopPropagation(); resetDuelState(); startGame(); }}
                      className="w-full bg-white text-slate-950 py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-xs shadow-lg active:scale-95 transition-all border-2 border-slate-200">
                      RIGIOCA LIVELLO {gameState.level}
                    </button>
                    <button onPointerDown={(e) => {
                      e.stopPropagation();
                      resetDuelState(activeMatch?.id, currentUser?.id);
                      goToHome();
                    }}
                      className="w-full bg-slate-800 text-slate-400 py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-sm border border-slate-700 active:scale-95 transition-all hover:bg-slate-700 hover:text-white">
                      TORNA ALLA HOME
                    </button>
                  </div>
                </div>
              )}

              {/* SURRENDER RECAP SCREEN */}
              {gameState.status === 'opponent-surrendered' && (
                <div className="glass-panel p-8 rounded-[2rem] text-center modal-content animate-screen-in w-full max-w-sm mt-12 relative overflow-hidden border-[3px] border-cyan-500 shadow-[0_0_60px_rgba(6,182,212,0.4)]">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

                  <Trophy className="w-16 h-16 text-cyan-400 mx-auto mb-4 animate-[bounce_2s_infinite]" />
                  <h2 className="text-3xl font-black font-orbitron mb-2 text-cyan-400 tracking-wider drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">HAI VINTO</h2>
                  <div className="text-xs font-bold text-white mb-6 uppercase tracking-[0.1em] bg-cyan-500/10 py-1 rounded">Vittoria per Ritiro</div>

                  <div className="bg-slate-900/60 p-5 rounded-2xl mb-6 border border-cyan-500/20">
                    <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest block mb-2">Punteggio Ottenuto</span>
                    <div className="text-4xl font-black font-orbitron text-white text-shadow-neon-cyan">
                      +{gameState.score + (duelMode === 'blitz' ? 50 : 100)} {/* Bonus for win */}
                    </div>
                    <span className="text-[8px] text-slate-500 uppercase font-bold mt-1 block">Accumulati nel Profilo Globale</span>
                  </div>

                  <button onPointerDown={(e) => {
                    e.stopPropagation();
                    // Just reset local, match is already gone/cancelled if we are here (surrender screen)
                    resetDuelState();
                    setActiveModal('duel_selection');
                  }}
                    className="w-full bg-cyan-600 text-white py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all border border-cyan-400 hover:bg-cyan-500">
                    TORNA ALLA LOBBY
                  </button>
                </div>
              )}

              {gameState.status === 'level-complete' && (
                <div className="glass-panel p-8 rounded-[2rem] text-center modal-content animate-screen-in w-full max-w-md mt-12 relative overflow-hidden border-[3px] border-[#FF8800]/50 shadow-[0_0_60px_rgba(255,136,0,0.3)]">
                  {/* Background Texture */}
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

                  <div className="relative z-10">
                    <div className="flex justify-center items-center gap-6 mb-6">
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider">Livello</span>
                        <span className="text-3xl font-black font-orbitron text-white">{gameState.level}</span>
                      </div>
                      <ChevronRight className="w-8 h-8 text-[#FF8800] animate-pulse" strokeWidth={3} />
                      <div className="flex flex-col items-center">
                        <span className="text-[9px] uppercase font-black text-[#FF8800] tracking-wider">Prossimo</span>
                        <span className="text-4xl font-black font-orbitron text-[#FF8800] drop-shadow-[0_0_10px_rgba(255,136,0,0.5)]">{gameState.level + 1}</span>
                      </div>
                    </div>

                    <div className="bg-slate-900/50 p-5 rounded-2xl mb-6 border border-white/10 space-y-3">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punti Livello</span>
                        <span className="text-lg font-orbitron font-black text-[#FF8800] animate-pulse">
                          +{gameState.score > 0 ? (gameState.timeLeft * 2) + 50 + (10 * 5) : '...'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Punteggio Totale</span>
                        <span className="text-lg font-orbitron font-black text-white">{gameState.totalScore}</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-green-500/10 rounded-lg p-2 flex flex-col items-center">
                          <span className="text-[8px] font-black uppercase text-green-400 tracking-wider">Residuo</span>
                          <span className="text-sm font-orbitron font-black text-green-300">{gameState.timeLeft}s</span>
                        </div>
                        <div className="bg-green-500/20 rounded-lg p-2 flex flex-col items-center border border-green-500/30">
                          <span className="text-[8px] font-black uppercase text-green-300 tracking-wider">Totale</span>
                          <span className="text-sm font-orbitron font-black text-white">{gameState.timeLeft + 60}s</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <button onPointerDown={(e) => { e.stopPropagation(); nextLevel(); }}
                        className="w-full bg-gradient-to-r from-[#FF8800] to-[#FF5500] text-white py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-lg shadow-[0_8px_20px_rgba(255,136,0,0.4)] active:scale-95 transition-all flex items-center justify-center gap-2 border-[3px] border-white group relative overflow-hidden">
                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                        <Play className="w-5 h-5 fill-current" />
                        <span className="relative z-10">Prossimo Livello</span>
                      </button>

                      <div className="grid grid-cols-2 gap-3">
                        <button onPointerDown={(e) => { e.stopPropagation(); startGame(gameState.level); }}
                          className="bg-slate-800 text-slate-300 py-3 rounded-xl font-bold uppercase text-xs active:scale-95 transition-all border border-slate-700 hover:text-white hover:bg-slate-700">
                          Rigioca
                        </button>
                        <button onPointerDown={(e) => { e.stopPropagation(); resetDuelState(activeMatch?.id, currentUser?.id); goToHome(e); }}
                          className="bg-slate-800 text-slate-300 py-3 rounded-xl font-bold uppercase text-xs active:scale-95 transition-all border border-slate-700 hover:text-white hover:bg-slate-700">
                          Home
                        </button>
                      </div>

                      <button className="text-[9px] text-cyan-500/40 uppercase font-black tracking-[0.2em] hover:text-cyan-400 transition-colors pt-1 animate-pulse">
                        Salvataggio Automatico Attivo
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div >
        )}

        {
          activeModal === 'tutorial' && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 modal-overlay bg-black/80" onPointerDown={() => { soundService.playUIClick(); setActiveModal(null); }}>
              <div className="bg-white border-[4px] border-[#FF8800] w-full max-w-md p-8 rounded-[2rem] shadow-[0_0_50px_rgba(255,136,0,0.3)] flex flex-col" onPointerDown={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center py-4">
                  <div className="mb-6 scale-125 drop-shadow-sm">{TUTORIAL_STEPS[tutorialStep].icon}</div>
                  <h2 className="text-2xl font-black font-orbitron text-[#FF8800] mb-4 uppercase tracking-widest">{TUTORIAL_STEPS[tutorialStep].title}</h2>
                  <p className="text-slate-600 font-bold text-sm leading-relaxed mb-10 border-t-2 border-slate-100 pt-4 w-full">{TUTORIAL_STEPS[tutorialStep].description}</p>
                  <button onPointerDown={(e) => { e.stopPropagation(); nextTutorialStep(); }} className="w-full bg-[#FF8800] text-white border-[3px] border-white py-5 rounded-2xl font-orbitron font-black text-sm uppercase shadow-lg active:scale-95 transition-all outline-none ring-0">
                    {tutorialStep === TUTORIAL_STEPS.length - 1 ? 'HO CAPITO' : 'AVANTI'}
                  </button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODE SELECTION MODAL */}
        {activeModal === 'duel_selection' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 modal-overlay bg-black/80 backdrop-blur-sm" onPointerDown={() => { soundService.playUIClick(); setActiveModal(null); }}>
            <div className="bg-slate-900 border-[3px] border-white/20 w-full max-w-lg p-8 rounded-[2rem] shadow-2xl flex flex-col relative overflow-hidden" onPointerDown={e => e.stopPropagation()}>
              {/* Background Decor */}
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

              <h2 className="text-3xl font-black font-orbitron text-white mb-2 uppercase text-center relative z-10 flex items-center justify-center gap-3">
                <Swords className="text-[#FF8800]" /> SELEZIONA SFIDA
              </h2>
              <p className="text-slate-400 text-center text-sm mb-8 font-mono relative z-10">Scegli il tuo stile di combattimento</p>

              <div className="flex flex-col gap-3 relative z-10 w-full">
                {/* Option 1: STANDARD */}
                <button
                  className="w-full bg-gradient-to-r from-red-600 to-rose-700 p-4 rounded-xl flex items-center gap-4 border-2 border-white/10 hover:border-white/40 hover:scale-[1.02] active:scale-95 transition-all group shadow-lg relative overflow-hidden"
                  onPointerDown={() => { soundService.playUIClick(); setDuelMode('standard'); setActiveModal('duel'); }}
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20 group-hover:bg-white/20 transition-colors shadow-inner relative z-10">
                    <Swords size={22} className="text-yellow-300 drop-shadow-sm" />
                  </div>
                  <div className="text-left flex-1 relative z-10">
                    <h3 className="font-orbitron font-black text-white text-lg uppercase leading-none mb-1 tracking-wider">STANDARD</h3>
                    <p className="text-[10px] text-white/80 font-bold uppercase tracking-wide">Velocità Pura • Partita Secca</p>
                  </div>
                  <ChevronRight className="text-white/30 group-hover:text-white transition-colors relative z-10" />
                </button>

                {/* Option 2: BLITZ */}
                <button
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-600 p-4 rounded-xl flex items-center gap-4 border-2 border-white/10 hover:border-white/40 hover:scale-[1.02] active:scale-95 transition-all group shadow-lg relative overflow-hidden"
                  onPointerDown={() => { soundService.playUIClick(); setDuelMode('blitz'); setActiveModal('duel'); }}
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                  <div className="absolute top-0 right-12 bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded-b-lg shadow-sm z-20">NEW</div>

                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20 group-hover:bg-white/20 transition-colors shadow-inner relative z-10">
                    <Zap size={22} className="text-white drop-shadow-sm" />
                  </div>
                  <div className="text-left flex-1 relative z-10">
                    <h3 className="font-orbitron font-black text-white text-lg uppercase leading-none mb-1 tracking-wider">BLITZ</h3>
                    <p className="text-[10px] text-white/80 font-bold uppercase tracking-wide">Tattica • 3 Round su 5</p>
                  </div>
                  <ChevronRight className="text-white/30 group-hover:text-white transition-colors relative z-10" />
                </button>

                {/* Option 3: TIME ATTACK */}
                <button
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-xl flex items-center gap-4 border-2 border-white/10 hover:border-white/40 hover:scale-[1.02] active:scale-95 transition-all group shadow-lg relative overflow-hidden"
                  onPointerDown={() => { soundService.playUIClick(); setDuelMode('time_attack'); setActiveModal('duel'); }}
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                  <div className="absolute top-0 right-12 bg-yellow-400 text-black text-[8px] font-black px-2 py-0.5 rounded-b-lg shadow-sm z-20 animate-pulse">HOT</div>

                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/20 group-hover:bg-white/20 transition-colors shadow-inner relative z-10">
                    <Clock size={22} className="text-white drop-shadow-sm" />
                  </div>
                  <div className="text-left flex-1 relative z-10">
                    <h3 className="font-orbitron font-black text-white text-lg uppercase leading-none mb-1 tracking-wider">TIME ATTACK</h3>
                    <p className="text-[10px] text-white/80 font-bold uppercase tracking-wide">60 Secondi • Target Infiniti</p>
                  </div>
                  <ChevronRight className="text-white/30 group-hover:text-white transition-colors relative z-10" />
                </button>
              </div>

              <button onClick={() => setActiveModal(null)} className="mt-8 text-slate-500 text-xs hover:text-white uppercase font-bold tracking-widest relative z-10">
                Annulla
              </button>
            </div>
          </div>
        )}
        {activeModal === 'registration_success' && (
          <RegistrationSuccess onEnter={() => setActiveModal(null)} />
        )}

        {activeModal === 'resume_confirm' && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 modal-overlay bg-black/90 backdrop-blur-md" onPointerDown={() => setActiveModal(null)}>
            <div className="bg-slate-900 border-[3px] border-[#FF8800] w-full max-w-sm p-8 rounded-[2rem] shadow-[0_0_50px_rgba(255,136,0,0.4)] flex flex-col text-center relative overflow-hidden" onPointerDown={e => e.stopPropagation()}>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

              <AlertTriangle className="w-16 h-16 text-[#FF8800] mx-auto mb-4 animate-pulse" />
              <h2 className="text-2xl font-black font-orbitron text-white mb-2 uppercase tracking-wider relative z-10">PARTITA SALVATA</h2>
              <p className="text-slate-400 font-bold text-sm mb-8 relative z-10">
                Hai una partita in sospeso.<br />Vuoi riprenderla o iniziarne una nuova?
              </p>

              <div className="space-y-3 relative z-10">
                <button
                  onPointerDown={(e) => { e.stopPropagation(); restoreGame(); }}
                  className="w-full bg-[#FF8800] text-white py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all border-2 border-white"
                >
                  RIPRENDI PARTITA
                </button>
                <button
                  onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
                  className="w-full bg-slate-800 text-slate-400 py-3 rounded-xl font-orbitron font-black uppercase tracking-widest text-xs border border-slate-600 active:scale-95 transition-all hover:text-white"
                >
                  NUOVA PARTITA (CANCELLA)
                </button>
                <button
                  onPointerDown={(e) => { e.stopPropagation(); soundService.playUIClick(); setActiveModal(null); }}
                  className="w-full py-2 text-slate-500 font-bold uppercase text-[10px] tracking-widest hover:text-white transition-colors"
                >
                  INDIETRO
                </button>
              </div>
            </div>
          </div>
        )}

        {activeModal === 'logout_confirm' && (
          <div className="fixed inset-0 z-[5000] flex items-center justify-center p-6 modal-overlay bg-black/90 backdrop-blur-md" onPointerDown={() => setActiveModal(null)}>
            <div className="bg-slate-900 border-[3px] border-red-500/50 w-full max-w-sm p-8 rounded-[2rem] shadow-[0_0_50px_rgba(220,38,38,0.4)] flex flex-col text-center relative overflow-hidden" onPointerDown={e => e.stopPropagation()}>
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none"></div>

              <User className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-2xl font-black font-orbitron text-white mb-2 uppercase tracking-wider relative z-10">LOGOUT</h2>
              <p className="text-slate-400 font-bold text-sm mb-8 relative z-10">
                Vuoi davvero disconnetterti?
              </p>

              <div className="space-y-3 relative z-10">
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    import('./services/supabaseClient').then(({ authService }) => authService.signOut());
                    setCurrentUser(null);
                    setUserProfile(null);
                    showToast(`Logout effettuato.`);
                    setActiveModal(null);
                  }}
                  className="w-full bg-red-600 text-white py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all border-2 border-white"
                >
                  CONFERMA USCITA
                </button>
                <button
                  onPointerDown={(e) => { e.stopPropagation(); setActiveModal(null); }}
                  className="w-full bg-slate-800 text-slate-400 py-3 rounded-xl font-orbitron font-black uppercase tracking-widest text-xs border border-slate-600 active:scale-95 transition-all hover:text-white"
                >
                  ANNULLA
                </button>
              </div>
            </div>
          </div>
        )}

        {activeModal === 'duel' && currentUser && (
          <NeuralDuelLobby
            currentUser={currentUser}
            userProfile={userProfile}
            mode={duelMode}
            showToast={showToast}
            onlinePlayers={onlinePlayers}
            onClose={() => setActiveModal('duel_selection')}
            onMatchStart={(seed, matchId, opponentId, isP1) => {
              setActiveModal(null);

              // Check if I am P1 by fetching match from matches state or just check if matchId was hosted by me
              // Simplified: The lobby component knows, or we just rely on latest match data sync.
              // Better: neuralDuelLobby already knows, but let's just use current user logic.
              setActiveMatch({ id: matchId, opponentId, isDuel: true, isP1: isP1 }); // Placeholder, fix in effect

              // Initialize Duel Game
              soundService.playUIClick();
              setGameState(prev => ({
                ...prev,
                score: 0,
                totalScore: prev.totalScore, // Preserve points during duel
                streak: 0,
                level: 1,
                timeLeft: duelMode === 'time_attack' ? 60 : INITIAL_TIME,
                targetResult: 0,
                status: 'playing',
                estimatedIQ: prev.estimatedIQ,
                lastLevelPerfect: true,
                basePoints: BASE_POINTS_START,
                levelTargets: [],
              }));
              // Pass the MATCH SEED to create the exact same board for both players
              generateGrid(1, seed);
              // Reset Opponent Score
              setOpponentScore(0);
              // Clean ready status just in case
              matchService.resetRoundStatus(matchId);
            }}
          />
        )}

        {
          activeModal === 'leaderboard' && (
            <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 modal-overlay bg-black/80" onPointerDown={() => { soundService.playUIClick(); setActiveModal(null); }}>
              <div className="glass-panel w-full max-w-md p-6 rounded-[2rem] modal-content flex flex-col h-[70vh]" onPointerDown={e => e.stopPropagation()}>
                <h2 className="text-2xl font-black font-orbitron text-white mb-4 uppercase flex items-center gap-3"><Award className="text-amber-400" /> CLASSIFICHE</h2>

                {/* Leaderboard Tabs */}
                <div className="flex bg-white/10 rounded-xl p-1 mb-4">
                  <button
                    onClick={() => setTutorialStep(0)} // Using tutorialStep variable as a hack for tab index or just create a new local state wrapper... 
                    // Actually, let's just assume we view SCORE by default, or better:
                    // Since I can't easily add state here without full re-write, I'll use a local var logic or verify if I can edit state.
                    // I will check if I can modify App state higher up. I see 'tutorialStep'.
                    // I'll create a simple toggle inside the render using a new state variable is simpler if I could...
                    // Let's use `scoreAnimKey` as a toggle for tabs? No that's dirty.
                    // I'll stick to a simple internal toggle using `tutorialStep` (since it's unused in this modal) 
                    // 0 = Score, 1 = Level.
                    onPointerDown={() => setTutorialStep(0)}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-all ${tutorialStep === 0 ? 'bg-[#FF8800] text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    Punteggio
                  </button>
                  <button
                    onPointerDown={() => setTutorialStep(1)}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs uppercase transition-all ${tutorialStep === 1 ? 'bg-cyan-500 text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    Livello Max
                  </button>
                </div>

                {(!leaderboardData || (!leaderboardData['byScore'] && !Array.isArray(leaderboardData))) ? (
                  <div className="text-center py-10 text-slate-400 font-orbitron">Caricamento...</div>
                ) : (
                  <div className="space-y-3 overflow-y-auto flex-1 pr-2 custom-scroll">
                    {/* DATA LIST */}
                    {((tutorialStep === 0 ? (leaderboardData as any).byScore : (leaderboardData as any).byLevel) || []).map((p: any, idx: number) => {
                      // Rank Calculation Inline for Leaderboard (avoiding circular dependency or extra imports if possible, but we imported `getRank` so use it)
                      const playerRank = getRank(p.max_level || 1);
                      const RankIcon = playerRank.icon;

                      return (
                        <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group">
                          {/* Top 3 Highlight */}
                          {idx < 3 && <div className={`absolute left-0 top-0 bottom-0 w-1 ${idx === 0 ? 'bg-[#FFD700]' : idx === 1 ? 'bg-gray-300' : 'bg-[#CD7F32]'}`}></div>}

                          <div className="flex items-center gap-3 pl-2">
                            {/* Avatar or Placeholder */}
                            <div className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-slate-800 border-2 border-white/10 overflow-hidden flex items-center justify-center">
                              {p.avatar_url ? (
                                <img src={p.avatar_url} className="w-full h-full object-cover" alt={p.username} />
                              ) : (
                                <span className="text-xs font-bold text-slate-500">{p.username?.charAt(0) || '?'}</span>
                              )}
                            </div>

                            <div className="flex flex-col">
                              <span className={`text-sm font-bold leading-tight ${idx < 3 ? 'text-white' : 'text-gray-300'}`}>
                                {idx + 1}. {p.username || 'Giocatore'}
                              </span>

                              <div className="flex items-center gap-1 mt-0.5">
                                {idx === 0 && <Sparkles size={10} className="text-yellow-400" />}
                                <RankIcon size={10} className={playerRank.color} />
                                <span className={`text-[8px] uppercase font-black tracking-widest ${playerRank.color}`}>{playerRank.title}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            {tutorialStep === 0 ? (
                              <>
                                <span className="font-orbitron font-black text-[#FF8800] text-sm">{p.total_score} pts</span>
                                <span className="font-orbitron font-bold text-gray-500 text-[9px]">Liv {p.max_level}</span>
                              </>
                            ) : (
                              <>
                                <span className="font-orbitron font-black text-cyan-400 text-sm">Liv {p.max_level}</span>
                                <span className="font-orbitron font-bold text-gray-500 text-[9px]">{p.total_score} pts</span>
                              </>
                            )}

                          </div>
                        </div>
                      )
                    })}

                    {((tutorialStep === 0 ? (leaderboardData as any).byScore : (leaderboardData as any).byLevel) || []).length === 0 && (
                      <div className="text-center py-8 text-gray-500 text-xs">Nessun dato disponibile</div>
                    )}
                  </div>
                )}

                <button onPointerDown={() => { soundService.playUIClick(); setActiveModal(null); }} className="mt-4 w-full bg-slate-800 text-white py-4 rounded-xl font-orbitron font-black text-xs uppercase active:scale-95 transition-all">CHIUDI</button>
              </div>
            </div>
          )
        }

        {activeModal === 'admin' && <AdminPanel onClose={() => setActiveModal(null)} />}

        {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={handleLoginSuccess} />}

        {activeModal === 'profile' && (
          <UserProfileModal
            currentUser={currentUser}
            userProfile={userProfile}
            onClose={() => setActiveModal(null)}
            onUpdate={(newP) => setUserProfile(newP)}
          />
        )}

        {/* DUEL RECAP MODAL */}
        {/* DUEL RECAP MODAL */}
        {showDuelRecap && latestMatchData && (
          <DuelRecapModal
            matchData={latestMatchData}
            currentUser={currentUser}
            isWinnerProp={latestMatchData.winner_id ? latestMatchData.winner_id === currentUser?.id : (gameState.score > opponentScore)}
            myScore={gameState.score}
            opponentScore={opponentScore}
            isFinal={latestMatchData.status === 'finished'}
            onReady={() => { }}
            onExit={goToDuelLobby}
          />
        )}

        <footer className="mt-auto py-6 text-slate-600 text-slate-600 text-[8px] tracking-[0.4em] uppercase font-black z-10 pointer-events-none opacity-40">AI Evaluation Engine v3.6 - LOCAL DEV</footer>

        {/* HOMEPAGE TUTORIAL OVERLAY */}
        <ComicTutorial
          isVisible={showHomeTutorial}
          steps={[
            {
              targetId: 'audio-btn-home',
              title: 'AUDIO IMMERSIVO',
              description: 'Clicca qui per attivare o disattivare il suono. Per un\'esperienza ottimale, ti consigliamo di tenerlo acceso!',
              position: 'top'
            },
            {
              targetId: currentUser ? 'user-profile-home' : 'login-btn-home',
              title: currentUser ? 'PROFILO & STATS' : 'ACCEDI ORA',
              description: currentUser
                ? 'Qui puoi vedere il tuo punteggio totale e gestire il tuo account.'
                : 'Registrati per salvare i progressi, scalare le classifiche e sfidare altri giocatori!',
              position: 'top'
            },
            {
              targetId: 'logo-home',
              title: 'IL TUO HUB',
              description: 'Clicca sul logo NUMBER per accedere al tuo Profilo Completo, vedere i Badge sbloccati e i Trofei!',
              position: 'bottom'
            },
            {
              targetId: 'tutorial-btn-home',
              title: 'GUIDA AI COMANDI',
              description: 'Se hai dubbi su come giocare, clicca qui per rivedere le regole base.',
              position: 'bottom'
            },
            {
              targetId: 'play-btn-home',
              title: 'INIZIA L\'AVVENTURA',
              description: 'Pronto a mettere alla prova i tuoi neuroni? Clicca qui per avviare la modalità Classica.',
              position: 'center'
            },
            {
              targetId: 'duel-btn-home',
              title: 'SFIDE 1VS1',
              description: 'Entra nell\'arena! Sfida altri utenti in tempo reale in duelli di velocità matematica.',
              position: 'bottom'
            },
            {
              targetId: 'ranking-btn-home',
              title: 'CLASSIFICA GLOBALE',
              description: 'Controlla la tua posizione nel mondo. Diventerai il numero 1?',
              position: 'bottom'
            }
          ]}
          onComplete={(neverShow) => {
            setShowHomeTutorial(false);
            if (neverShow) localStorage.setItem('comic_home_tutorial_done', 'true');
          }}
          onSkip={(neverShow) => {
            setShowHomeTutorial(false);
            if (neverShow) localStorage.setItem('comic_home_tutorial_done', 'true');
          }}
        />

        {/* GAME TUTORIAL OVERLAY */}
        <ComicTutorial
          isVisible={showGameTutorial}
          steps={[
            {
              targetId: 'targets-display-tutorial',
              title: 'I TUOI OBIETTIVI',
              description: 'Questi sono i numeri che devi ottenere. Trova le combinazioni nella griglia per raggiungerli tutti!',
              position: 'top'
            },
            {
              targetId: 'grid-container-game',
              title: 'LA GRIGLIA',
              description: 'Collega le celle: NUMERO -> OPERATORE -> NUMERO.  Esempio: 5 + 3.  Non puoi collegare due numeri vicini senza operatore!',
              position: 'center'
            },
            {
              targetId: 'score-display-game',
              title: 'PUNTEGGIO',
              description: 'Più sei veloce e mantieni la streak (serie di risposte corrette), più punti farai. Punta al record!',
              position: 'right'
            },
            {
              targetId: 'timer-display-game',
              title: 'TEMPO & PAUSA',
              description: 'Hai poco tempo! Se ti serve respirare, clicca qui per mettere in PAUSA il sistema.',
              position: 'center'
            }
          ]}
          onComplete={(neverShow) => {
            setShowGameTutorial(false);
            if (neverShow) localStorage.setItem('comic_game_tutorial_done', 'true');
          }}
          onSkip={(neverShow) => {
            setShowGameTutorial(false);
            if (neverShow) localStorage.setItem('comic_game_tutorial_done', 'true');
          }}
        />

      </div >
    </>
  );
};

export default App;
