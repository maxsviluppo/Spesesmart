
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HexCellData, GameState } from './types';
import { INITIAL_TIME, BASE_POINTS_START, MAX_STREAK, GRID_ROWS, GRID_COLS, OPERATORS, MOCK_LEADERBOARD } from './constants';
import HexCell from './components/HexCell';
import ParticleEffect from './components/ParticleEffect';
import CharacterHelper from './components/CharacterHelper';
import { getIQInsights } from './services/geminiService';
import { soundService } from './services/soundService';
import { matchService } from './services/matchService';
import { Trophy, Timer, Zap, Brain, RefreshCw, ChevronRight, Play, Award, BarChart3, HelpCircle, Sparkles, Home, X, Volume2, VolumeX, User, Pause, Shield, Swords, Info, AlertTriangle } from 'lucide-react';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import NeuralDuelLobby from './components/NeuralDuelLobby';
import DuelRecapModal from './components/DuelRecapModal';
import IntroVideo from './components/IntroVideo';
import { authService, profileService, leaderboardService, supabase } from './services/supabaseClient'; // Moved this import here

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
  const [activeModal, setActiveModal] = useState<'leaderboard' | 'tutorial' | 'admin' | 'duel' | 'duel_selection' | 'resume_confirm' | 'logout_confirm' | null>(null);
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
  const theme = 'orange';
  const [levelBuffer, setLevelBuffer] = useState<{ grid: HexCellData[], targets: number[] }[]>([]);
  const timerRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Supabase Integration
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  const [savedGame, setSavedGame] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);

  // NEW STATE FOR DUEL RECAP
  const [showDuelRecap, setShowDuelRecap] = useState(false);
  const [latestMatchData, setLatestMatchData] = useState<any>(null); // NEW: Full Match Object Store

  // NEW: Video Intro State
  const [showIntro, setShowIntro] = useState(true);



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

  const loadProfile = useCallback(async (userId: string) => {
    const profile = await profileService.getProfile(userId);
    const save = await profileService.loadGameState(userId);
    if (save) setSavedGame(save);
    if (profile) {
      setUserProfile(profile);
      setGameState(prev => ({
        ...prev,
        totalScore: Math.max(prev.totalScore, profile.total_score || 0),
        estimatedIQ: Math.max(prev.estimatedIQ, profile.estimated_iq || 0),
        status: prev.status === 'intro' ? 'intro' : prev.status
      }));
    }
  }, []);

  // Initialize Session
  useEffect(() => {
    const initSession = async () => {
      const session = await authService.getCurrentSession();
      if (session?.user) {
        setCurrentUser(session.user);
        loadProfile(session.user.id);
      }
    };
    initSession();
  }, [loadProfile]);

  // NEW: Game Over Trigger on Time Left reaching zero
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.timeLeft === 0 && !activeMatch?.isDuel && !isVictoryAnimating) {
      soundService.playExternalSound('lost.mp3');
      setShowLostVideo(true);
      setGameState(prev => ({ ...prev, status: 'game-over' }));

      if (currentUser) {
        profileService.clearSavedGame(currentUser.id);
        loadProfile(currentUser.id);
      }
    }
  }, [gameState.timeLeft, gameState.status, activeMatch, currentUser, isVictoryAnimating, loadProfile]);


  // REF: Track GameState for Subscriptions (Avoid Stale Closures)
  const gameStateRef = useRef(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // REF: Track Processed Wins (Avoid Double Sync)
  const processedWinRef = useRef<string | null>(null);


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
    // MODIFIED: Timer disabled for DUEL mode
    if (gameState.status === 'playing' && gameState.timeLeft > 0 && !isVictoryAnimating && !showVideo && !isPaused && !activeMatch?.isDuel) {
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
      // We start adding from: Current Level + Buffer Length (remaining) + 1
      // Buffer length after shift is 4. Next level to generate is Level + 5.
      // E.g. Level 1 playing. Buffer has [L2, L3, L4, L5, L6]. Shift -> Plays L2. Buffer has [L3..L6]. Gen L7.
      // So logic: (gameState.level + 1) is the level we represent now. + buffer.length (4) + 1 = +6.
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

  const handleDuelRoundStart = (matchData: any) => {
    // Close Modal
    setShowDuelRecap(false);
    setGameState(prev => ({
      ...prev,
      levelTargets: [],
      status: 'playing'
    }));
    generateGrid(gameState.level);
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

        if (activeMatch && activeMatch.isP1 !== amIP1) {
          setActiveMatch(prev => prev ? { ...prev, isP1: amIP1 } : null);
        }

        if (newData.p1_ready && newData.p2_ready && showDuelRecap) {
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
        const targetToWin = duelMode === 'blitz' ? 3 : 5;

        if (opponentTargetCount >= targetToWin && newData.status !== 'finished') {
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
            profileService.syncProgress(currentUser!.id, gameStateRef.current.score, gameStateRef.current.level, gameStateRef.current.estimatedIQ);
            loadProfile(currentUser!.id);
          }

          if (!amIWinner) soundService.playExternalSound('lost.mp3');
          if (timerRef.current) window.clearInterval(timerRef.current);

          setGameState(prev => ({ ...prev, status: 'idle' }));
          setIsDragging(false);
          setSelectedPath([]);
          setShowDuelRecap(true);
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
          setGameState(prev => ({ ...prev, status: 'idle' }));
          showToast("Sfida interrotta: l'avversario ha abbandonato.");
        }
      });
      return () => { if (channel) (supabase as any).removeChannel(channel); };
    }
  }, [activeMatch, currentUser]);


  const startGame = async () => {
    await handleUserInteraction();
    soundService.playUIClick();
    try {
      localStorage.setItem('number_tutorial_done', 'true');
    } catch (e) { console.warn("LocalStorage blocked", e); }

    setActiveModal(null);
    setIsVictoryAnimating(false);
    setTriggerParticles(false);
    setPreviewResult(null);

    // Explicitly reset Main State for NEW GAME
    setGameState({
      score: 0,
      totalScore: userProfile?.total_score || 0,
      streak: 0,
      level: 1,
      timeLeft: INITIAL_TIME,
      targetResult: 0,
      status: 'playing',
      estimatedIQ: 100,
      lastLevelPerfect: true,
      basePoints: BASE_POINTS_START,
      levelTargets: [],
    });

    // Reset Buffer and Grid with explicit Level 1
    setTimeout(() => generateGrid(1), 0);

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

  const handleStartGameClick = useCallback(async (e: React.PointerEvent) => {
    if (e) {
      // e.preventDefault();
      e.stopPropagation();
    }
    await handleUserInteraction();

    if (savedGame) {
      setActiveModal('resume_confirm');
      return;
    }

    let tutorialDone = 'false';
    try {
      tutorialDone = localStorage.getItem('number_tutorial_done') || 'false';
    } catch (e) { tutorialDone = 'true'; }

    if (tutorialDone !== 'true') {
      soundService.playUIClick();
      setTutorialStep(0);
      setActiveModal('tutorial');
    } else {
      startGame();
    }
  }, [savedGame, startGame, handleUserInteraction]);

  const nextTutorialStep = async () => {
    await handleUserInteraction();
    soundService.playTick();
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
      handleSuccess(result!);
    } else {
      handleError();
    }
    setPreviewResult(null);
  };

  /* HANDLE SUCCESS - FULLY REF BASED */
  const handleSuccess = (matchedValue: number) => {
    // RACE CONDITION FIX: Do not process win if game is already over
    if (gameStateRef.current.status !== 'playing') return;

    soundService.playSuccess();

    // NEW SCORING: Linear Progression based on streak (USE REF)
    const currentLevel = gameStateRef.current.level;
    const currentStreak = gameStateRef.current.streak;

    // Formula: Base(Level) * (Streak + 1)
    const baseForLevel = Math.pow(2, currentLevel - 1);
    const multiplier = currentStreak + 1;
    const currentPoints = baseForLevel * multiplier;

    setScoreAnimKey(k => k + 1);

    // Update targets state (USE REF)
    const currentTargets = gameStateRef.current.levelTargets;
    const newTargets = currentTargets.map(t =>
      t.value === matchedValue ? { ...t, completed: true } : t
    );
    const allDone = newTargets.every(t => t.completed);

    // 4. DUEL LOGIC
    if (activeMatch?.isDuel && currentUser) {
      const myTargetsFound = newTargets.filter(t => t.completed).length;

      // ATOMIC UPDATE: Send Score AND Targets together (Use REF score + currentPoints)
      matchService.updateMatchStats(activeMatch.id, activeMatch.isP1, gameStateRef.current.score + currentPoints, myTargetsFound);

      // BLITZ LOGIC: Check Round Win (3 Targets)
      if (duelMode === 'blitz' && myTargetsFound >= 3) {
        soundService.playSuccess();
        showToast(`ROUND ${duelRounds.current} VINTO!`);

        setTimeout(() => {
          generateGrid(gameStateRef.current.level); // Usare ref level
          setGameState(prev => ({
            ...prev,
            levelTargets: prev.levelTargets.map(t2 => ({ ...t2, completed: false })),
            status: 'playing'
          }));
        }, 2000);
        setSelectedPath([]);
        return;
      }
    }

    // 5. GLOBAL SYNC: Always update career stats on every success (EXCEPT IN DUEL MODE)
    if (currentUser && !activeMatch?.isDuel) {
      profileService.syncProgress(currentUser.id, currentPoints, gameStateRef.current.level, gameStateRef.current.estimatedIQ);
    }

    if (allDone) {
      if (activeMatch?.isDuel && duelMode === 'standard') {
        // Match Ends Immediately
        matchService.declareWinner(activeMatch.id, currentUser.id);

        // FLAG AS PROCESSED LOCALLY TO AVOID DOUBLE SYNC IN SUBSCRIPTION
        processedWinRef.current = activeMatch.id;

        // OPTIMISTICALLY UPDATE MATCH DATA FOR RECAP
        setLatestMatchData(prev => ({
          ...prev,
          status: 'finished',
          winner_id: currentUser!.id,
          player1_score: activeMatch.isP1 ? gameStateRef.current.score + currentPoints : prev?.player1_score,
          player2_score: !activeMatch.isP1 ? gameStateRef.current.score + currentPoints : prev?.player2_score,
          // Update Rounds for Abandonment Check
          p1_rounds: activeMatch.isP1 ? (duelMode === 'blitz' ? 3 : 5) : prev?.p1_rounds,
          p2_rounds: !activeMatch.isP1 ? (duelMode === 'blitz' ? 3 : 5) : prev?.p2_rounds
        }));

        // Update Local State but skip video/standard recap
        setGameState(prev => ({
          ...prev,
          score: prev.score + currentPoints,
          totalScore: prev.totalScore + currentPoints,
          status: 'idle',
          levelTargets: newTargets
        }));

        // SYNC PROFILE FOR WINNER (MATCH ENDED BY ALL TARGETS)
        profileService.syncProgress(currentUser.id, gameStateRef.current.score + currentPoints, gameStateRef.current.level, gameStateRef.current.estimatedIQ);
        loadProfile(currentUser.id);

        setShowDuelRecap(true);
        setSelectedPath([]);
        return;
      }

      // STOP TIMER IMMEDIATELY
      if (timerRef.current) window.clearInterval(timerRef.current);

      setIsVictoryAnimating(true);
      setTriggerParticles(true);

      const nextLevelScore = gameStateRef.current.totalScore + currentPoints;

      setGameState(prev => ({
        ...prev,
        score: prev.score + currentPoints,
        totalScore: nextLevelScore,
        streak: 0,
        estimatedIQ: Math.min(200, prev.estimatedIQ + 4),
        levelTargets: newTargets,
      }));

      // AUTO SAVE HERE (Level Completed -> State for STARTING next level)
      if (currentUser) {
        const saveState = {
          totalScore: nextLevelScore,
          streak: 0,
          level: gameState.level + 1, // Ready for next level
          timeLeft: gameState.timeLeft + 60, // Anticipate the +60s bonus
          estimatedIQ: Math.min(200, gameState.estimatedIQ + 4)
        };

        // Save active run state (snapshot) - syncProgress was already called for the last target
        profileService.saveGameState(currentUser.id, saveState)
          .then(() => loadProfile(currentUser.id)); // Reload badge when both finish

        setSavedGame(saveState);
      }

      // Delay to show particles before video
      setTimeout(() => {
        setTriggerParticles(false);
        soundService.playExternalSound('win.mp3');
        setShowVideo(true);
      }, 1000);
    } else {
      // Level Continues (NOT all targets completed yet)
      setGameState(prev => ({
        ...prev,
        score: prev.score + currentPoints,
        totalScore: prev.totalScore + currentPoints,
        streak: prev.streak + 1,
        estimatedIQ: Math.min(200, prev.estimatedIQ + 0.5),
        levelTargets: newTargets
      }));
    }
    setSelectedPath([]);
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
    setGameState(prev => ({
      ...prev,
      level: prev.level + 1,
      status: 'playing',
      streak: 0, // Reset streak on new level? Rule says "combinazioni del livello successiva" - implies standard streak rules reset per level usually, or it carries? Assuming reset per level is standard for "Level 1 has range X".
      // CARRY OVER: Add 60s to whatever is left
      timeLeft: prev.timeLeft + 60,
    }));
    generateGrid();
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
      soundService.playTick(); // Suono feedback rimozione
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
        soundService.playTick();
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




  return (
    <>
      {showIntro && <IntroVideo onFinish={() => {
        setShowIntro(false);
        setGameState(prev => ({ ...prev, status: 'idle' }));
      }} />}
      <div
        className="h-[100dvh] w-full bg-gradient-to-t from-[#004488] to-[#0088dd] text-slate-100 flex flex-col items-center justify-center select-none relative overflow-hidden"
        onPointerDown={handleUserInteraction}
        onMouseUp={handleGlobalEnd}
        onTouchEnd={handleGlobalEnd}
      >




        {/* WIN VIDEO OVERLAY */}
        {showVideo && !showLostVideo && (
          <div className="absolute inset-0 z-[5000] bg-black flex items-center justify-center animate-fadeIn" onPointerDown={(e) => e.stopPropagation()}>
            <video
              src="/win.mp4"
              autoPlay
              playsInline
              muted
              loop={false}
              onEnded={() => {
                setShowVideo(false);
                setIsVictoryAnimating(false);
                // Show Level Complete Modal ONLY after video ends
                setGameState(prev => ({ ...prev, status: 'level-complete' }));
              }}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* LOST VIDEO OVERLAY */}
        {showLostVideo && !showVideo && (
          <div className="absolute inset-0 z-[5000] bg-black flex items-center justify-center animate-fadeIn" onPointerDown={(e) => e.stopPropagation()}>
            <video
              src="/lost.mp4"
              autoPlay
              playsInline
              muted
              loop={false}
              onEnded={() => {
                setShowLostVideo(false);
              }}
              className="w-full h-full object-cover"
            />
          </div>
        )}


        <ParticleEffect trigger={triggerParticles} />

        {/* Abstract Curves Background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-[0.08]">
          <path d="M-100 200 Q 200 0 500 300 T 1000 100" stroke="white" strokeWidth="60" fill="none" />
          <path d="M-100 500 Q 300 300 600 600 T 1200 400" stroke="white" strokeWidth="40" fill="none" />
          <path d="M-100 800 Q 400 600 800 900 T 1300 700" stroke="white" strokeWidth="80" fill="none" />
          <path d="M800 -100 Q 600 300 900 600" stroke="white" strokeWidth="30" fill="none" />
        </svg>

        <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[9999] transition-all duration-500 pointer-events-none
        ${toast.visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-16 opacity-0 scale-95'}`}>
          <div className={`glass-panel px-8 py-4 rounded-[1.5rem] border ${toast.actions ? 'border-[#FF8800] bg-slate-900/95' : 'border-cyan-400/60'} shadow-[0_0_40px_rgba(34,211,238,0.4)] flex items-center gap-5 backdrop-blur-2xl pointer-events-auto`}>
            <div className="flex flex-col text-center">
              <span className="font-orbitron text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-0.5">Sistema</span>
              <span className="font-orbitron text-sm font-black text-white tracking-widest uppercase mb-1">{toast.message}</span>
              {toast.actions && (
                <div className="flex gap-3 mt-3 justify-center">
                  {toast.actions.map((act, i) => (
                    <button
                      key={i}
                      onPointerDown={(e) => { e.stopPropagation(); act.onClick(); setToast(p => ({ ...p, visible: false })); }}
                      className={`px-6 py-2 rounded-lg font-black uppercase text-[10px] transition-all shadow-lg active:scale-95
                                ${act.variant === 'secondary'
                          ? 'bg-slate-800 text-slate-400 border border-slate-600 hover:text-white'
                          : 'bg-[#FF8800] text-white animate-pulse-slow hover:scale-105'}`}
                    >
                      {act.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>



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
              <div className="fixed top-1 right-6 z-[3000] flex gap-3 items-center" style={{ marginTop: 'env(safe-area-inset-top)' }}>
                <button
                  onPointerDown={toggleMute}
                  className={`w-12 h-12 rounded-full border-2 border-white/50 shadow-lg flex items-center justify-center active:scale-95 transition-all hover:scale-110
                    ${isMuted ? 'bg-slate-700 text-slate-400' : 'bg-[#FF8800] text-white'}`}
                  title="Audio"
                >
                  {isMuted ? <VolumeX size={24} strokeWidth={2.5} /> : <Volume2 size={24} strokeWidth={2.5} />}
                </button>
              </div>

              {/* BOTTOM RIGHT ICONS: Admin & Tutorial (FIXED Position) */}
              <div className="fixed bottom-4 right-4 z-[2000] flex gap-3" style={{ marginBottom: 'env(safe-area-inset-bottom)' }}>
                {/* Tutorial Icon */}
                <button
                  onPointerDown={async (e) => { e.stopPropagation(); await handleUserInteraction(); soundService.playUIClick(); setTutorialStep(0); setActiveModal('tutorial'); }}
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
                <div className="relative w-36 h-36 flex items-center justify-center mb-4 transition-transform hover:scale-110 duration-500 group">
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
                    onPointerDown={() => { soundService.playUIClick(); showToast("Nessuna sfida attiva al momento"); }}
                  >
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
                    <Trophy className="w-6 h-6" />
                    <span className="font-orbitron text-sm font-black uppercase tracking-widest relative z-10">Sfide (0)</span>
                    {/* Coming Soon Badge */}
                    <div className="absolute top-2 right-2 bg-white/20 px-2 py-0.5 rounded text-[8px] font-bold">PRESTO</div>
                  </button>

                  <button onPointerDown={async (e) => { e.stopPropagation(); await handleUserInteraction(); soundService.playUIClick(); setActiveModal('leaderboard'); }}
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
              bg-[#FF8800]
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
                <div className="absolute left-1/2 -translate-x-1/2 top-1/2 transform translate-y-[-10%] z-[100] cursor-pointer group" onPointerDown={activeMatch?.isDuel ? undefined : togglePause}>
                  <div className={`relative w-24 h-24 rounded-full bg-slate-900 border-[4px] border-white flex items-center justify-center shadow-xl transition-all duration-300 ${isPaused ? 'border-[#FF8800] scale-110 shadow-[0_0_30px_rgba(255,136,0,0.5)]' : 'group-hover:scale-105'} ${activeMatch?.isDuel ? 'border-red-500/50 grayscale-0 opacity-100 flex flex-col' : ''}`}>
                    <svg className="absolute inset-0 w-full h-full -rotate-90 scale-90">
                      <circle cx="50%" cy="50%" r="45%" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                      {!isPaused && (
                        <circle
                          cx="50%" cy="50%" r="45%"
                          stroke={activeMatch?.isDuel
                            ? `rgb(${Math.floor(((opponentTargets || 0) / (duelMode === 'blitz' ? 3 : 5)) * 205 + 34)}, ${Math.floor((1 - (opponentTargets || 0) / (duelMode === 'blitz' ? 3 : 5)) * 129 + 68)}, 68)`
                            : (gameState.timeLeft < 10 ? '#ef4444' : '#FF8800')}
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray="283"
                          strokeDashoffset={activeMatch?.isDuel
                            ? 283 - (283 * (opponentTargets || 0) / (duelMode === 'blitz' ? 3 : 5))
                            : 283 - (283 * gameState.timeLeft / INITIAL_TIME)
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
                        {activeMatch?.isDuel && <span className="text-[8px] font-black text-slate-500 uppercase leading-none mb-1">AVV</span>}
                        <span className={`font-black font-orbitron text-white ${activeMatch?.isDuel ? 'text-4xl' : 'text-3xl'}`}>
                          {activeMatch?.isDuel ? opponentTargets : gameState.timeLeft}
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
                    <div className="w-14 h-14 rounded-full bg-white border-[3px] border-slate-900 flex flex-col items-center justify-center shadow-xl transform hover:scale-105 transition-transform">
                      <span className="text-[7px] font-black text-[#FF8800] leading-none mb-0.5 uppercase">PTS</span>
                      <span className="text-xl font-black font-orbitron text-[#FF8800] leading-none">
                        {gameState.score}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 pl-20 sm:pl-0">
                    <div className="w-11 h-11 rounded-full border-[3px] border-white flex flex-col items-center justify-center shadow-md bg-white text-[#FF8800]">
                      <span className="text-[7px] font-black uppercase leading-none opacity-80 mb-0.5">PTS</span>
                      <span className="text-xs font-black font-orbitron leading-none tracking-tighter">{gameState.score}</span>
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
                    <div className="flex gap-2 items-center flex-wrap justify-center max-w-[300px]">
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
                      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xl rounded-3xl transition-all animate-fadeIn">
                        <div className="flex flex-col items-center gap-4">
                          <Pause className="w-24 h-24 text-white opacity-100 drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]" />
                          <span className="font-orbitron font-black text-2xl text-white tracking-[0.3em] animate-pulse">PAUSA</span>
                        </div>
                      </div>
                    )}

                    <div className={`relative mx-auto transition-all duration-500 transform
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
                <div className="glass-panel p-8 rounded-[2.5rem] text-center modal-content animate-screen-in w-full max-w-md">
                  <h2 className="text-4xl font-black font-orbitron mb-2 text-red-500">FINE</h2>
                  <div className="text-xl font-bold text-white mb-6 uppercase tracking-wider">Livello Non Superato</div>

                  <div className="mb-8">
                    <span className="text-[10px] text-slate-500 uppercase font-black">Punteggio Finale</span>
                    <div className="text-6xl font-black font-orbitron text-white glitch-text" data-text={gameState.totalScore}>{gameState.totalScore}</div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl mb-8 flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-slate-300">Livello Raggiunto</span>
                      <span className="text-lg font-orbitron font-black text-white">{gameState.level}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-300">QI Stimato</span>
                      <span className="text-lg font-orbitron font-black text-cyan-400">{Math.round(gameState.estimatedIQ)}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button onPointerDown={(e) => { e.stopPropagation(); startGame(); }}
                      className="w-full bg-white text-slate-950 py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-sm shadow-lg active:scale-95 transition-all">
                      RIGIOCA
                    </button>
                    <button onPointerDown={goToHome}
                      className="w-full bg-slate-800 text-slate-400 py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-sm border border-slate-700 active:scale-95 transition-all hover:bg-slate-700 hover:text-white">
                      TORNA ALLA HOME
                    </button>
                  </div>
                </div>
              )}

              {gameState.status === 'level-complete' && (
                <div className="glass-panel p-8 rounded-[2.5rem] text-center modal-content animate-screen-in w-full max-w-md">
                  <div className="flex justify-center items-center gap-4 mb-6">
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase font-black text-slate-400">Livello</span>
                      <span className="text-3xl font-black font-orbitron text-white">{gameState.level}</span>
                    </div>
                    <ChevronRight className="w-8 h-8 text-[#FF8800] animate-pulse" />
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] uppercase font-black text-[#FF8800]">Prossimo</span>
                      <span className="text-4xl font-black font-orbitron text-[#FF8800]">{gameState.level + 1}</span>
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-2xl mb-6 flex flex-col gap-2">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-slate-300">Punti Ottenuti</span>
                      {/* Calcolo approssimativo o reale se salvato nello stato precedente */}
                      <span className="text-lg font-orbitron font-black text-[#FF8800] animate-pulse">
                        +{Math.pow(2, gameState.level - 2) * Math.pow(2, gameState.streak > 0 ? gameState.streak - 1 : 0) * 5}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-xs font-bold text-slate-300">Punteggio Totale</span>
                      <span className="text-lg font-orbitron font-black text-white">{gameState.totalScore}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-green-400">Tempo Residuo</span>
                      <span className="text-lg font-orbitron font-black text-green-400">{gameState.timeLeft}s</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center bg-green-500/10 p-2 rounded-lg">
                      <span className="text-xs font-black uppercase tracking-wider text-green-300">Tempo Totale</span>
                      <span className="text-xl font-orbitron font-black text-white">{gameState.timeLeft + 60}s</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button onPointerDown={(e) => { e.stopPropagation(); nextLevel(); }}
                      className="w-full bg-[#FF8800] text-white py-4 rounded-xl font-orbitron font-black uppercase tracking-widest text-lg shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white">
                      <Play className="w-5 h-5 fill-current" />
                      Prossimo Livello
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <button onPointerDown={(e) => { e.stopPropagation(); generateGrid(gameState.level - 1); setGameState(p => ({ ...p, status: 'playing', streak: 0 })); }}
                        className="bg-slate-700 text-slate-300 py-3 rounded-xl font-bold uppercase text-xs active:scale-95 transition-all border border-slate-600">
                        Rigioca
                      </button>
                      <button onPointerDown={(e) => { e.stopPropagation(); /* Save logic here if needed, currently valid */ goToHome(e); }}
                        className="bg-slate-700 text-slate-300 py-3 rounded-xl font-bold uppercase text-xs active:scale-95 transition-all border border-slate-600">
                        Home
                      </button>
                    </div>

                    <button className="text-[10px] text-cyan-500/50 uppercase font-black tracking-widest hover:text-cyan-400 transition-colors pt-2">
                      Salvataggio Automatico Attivo
                    </button>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10">
                {/* Option 1: STANDARD */}
                <button
                  className="bg-gradient-to-br from-red-600 to-rose-700 border-[3px] border-white shadow-lg relative overflow-hidden p-6 rounded-2xl flex flex-col items-center text-center transition-all duration-300 group active:scale-95 hover:scale-105"
                  onPointerDown={() => { soundService.playUIClick(); setDuelMode('standard'); setActiveModal('duel'); }}
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg relative z-10 backdrop-blur-sm">
                    <Swords size={32} className="text-yellow-300 drop-shadow-md" />
                  </div>
                  <h3 className="font-orbitron font-black text-white text-xl mb-2 relative z-10 tracking-wider italic">STANDARD</h3>
                  <p className="text-xs text-white/90 leading-tight relative z-10 font-bold">
                    <strong className="text-yellow-300 block mb-1 uppercase tracking-wide">Velocità Pura</strong>
                    Trova 5 combinazioni prima dell'avversario. Partita secca.
                  </p>
                </button>

                {/* Option 2: BLITZ */}
                <button
                  className="bg-gradient-to-br from-orange-500 to-amber-600 border-[3px] border-white shadow-lg relative overflow-hidden p-6 rounded-2xl flex flex-col items-center text-center transition-all duration-300 group active:scale-95 hover:scale-105"
                  onPointerDown={() => { soundService.playUIClick(); setDuelMode('blitz'); setActiveModal('duel'); }}
                >
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20"></div>
                  <div className="absolute top-0 right-0 bg-red-600 text-white text-[9px] font-black px-2 py-1 rounded-bl-lg border-l border-b border-white/20 z-20 shadow-sm animate-pulse">NEW</div>

                  <div className="w-16 h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg relative z-10 backdrop-blur-sm">
                    <Zap size={32} className="text-white drop-shadow-md" />
                  </div>
                  <h3 className="font-orbitron font-black text-white text-xl mb-2 relative z-10 tracking-wider italic">BLITZ</h3>
                  <p className="text-xs text-white/90 leading-tight relative z-10 font-bold">
                    <strong className="text-yellow-300 block mb-1 uppercase tracking-wide">Guerra Tattica</strong>
                    Vinci 3 Round su 5. Ogni round richiede 3 target.
                  </p>
                </button>
              </div>

              <button onClick={() => setActiveModal(null)} className="mt-8 text-slate-500 text-xs hover:text-white uppercase font-bold tracking-widest relative z-10">
                Annulla
              </button>
            </div>
          </div>
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
                timeLeft: INITIAL_TIME,
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
                    {((tutorialStep === 0 ? (leaderboardData as any).byScore : (leaderboardData as any).byLevel) || []).map((p: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5 relative overflow-hidden group">
                        {/* Top 3 Highlight */}
                        {idx < 3 && <div className={`absolute left-0 top-0 bottom-0 w-1 ${idx === 0 ? 'bg-[#FFD700]' : idx === 1 ? 'bg-gray-300' : 'bg-[#CD7F32]'}`}></div>}

                        <div className="flex flex-col pl-2">
                          <span className={`text-sm font-bold ${idx < 3 ? 'text-white' : 'text-gray-300'}`}>
                            {idx + 1}. {p.username || 'Giocatore'}
                          </span>
                          <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                            {p.country || 'IT'} {idx === 0 && <Sparkles size={8} className="text-yellow-400" />}
                          </span>
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
                    ))}

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

        {/* DUEL RECAP MODAL */}
        {/* DUEL RECAP MODAL */}
        {showDuelRecap && latestMatchData && (
          <DuelRecapModal
            matchData={latestMatchData}
            currentUser={currentUser}
            isWinnerProp={latestMatchData.winner_id === currentUser?.id || processedWinRef.current === latestMatchData.id}
            myScore={gameState.totalScore}
            opponentScore={opponentScore}
            isFinal={latestMatchData.status === 'finished'}
            onReady={() => { }}
            onExit={goToDuelLobby}
          />
        )}

        <footer className="mt-auto py-6 text-slate-600 text-[8px] tracking-[0.4em] uppercase font-black z-10 pointer-events-none opacity-40">AI Evaluation Engine v3.6 - LOCAL DEV</footer>
      </div>
    </>
  );
};

export default App;
