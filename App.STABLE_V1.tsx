
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HexCellData, GameState } from './types';
import { INITIAL_TIME, BASE_POINTS_START, MAX_STREAK, GRID_ROWS, GRID_COLS, OPERATORS, MOCK_LEADERBOARD } from './constants';
import HexCell from './components/HexCell';
import ParticleEffect from './components/ParticleEffect';
import CharacterHelper from './components/CharacterHelper';
import { getIQInsights } from './services/geminiService';
import { soundService } from './services/soundService';
import { authService, profileService, leaderboardService } from './services/supabaseClient';
import { Trophy, Timer, Zap, Brain, RefreshCw, ChevronRight, Play, Award, BarChart3, HelpCircle, Sparkles, Home, X, Volume2, VolumeX, User, Pause } from 'lucide-react';
import AuthModal from './components/AuthModal';

const TUTORIAL_STEPS = [
  {
    title: "OBIETTIVO & GRIGLIA",
    description: "Collega numeri e operatori per trovare i 5 Target visualizzati. ATTENZIONE: La griglia è FISSA! Non cambierà finché non avrai trovato tutte le soluzioni con le tessere a disposizione.",
    icon: <Brain className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "REGOLE DI CONNESSIONE",
    description: "Trascina il dito partendo da un Numero. Devi sempre alternare: Numero → Operatore → Numero. Non puoi collegare due numeri o due operatori direttamente.",
    icon: <RefreshCw className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "PUNTEGGIO ESPONENZIALE",
    description: "I punti crescono col Livello e raddoppiano con la Streak! Es. Livello 1: 1, 2, 4, 8, 16 punti. Un errore resetta la streak al valore base. La precisione è tutto.",
    icon: <Zap className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "TEMPO, CARRY-OVER & BONUS",
    description: "60 secondi iniziali. Il tempo che risparmi si SOMMA al livello successivo. Dal Livello 5 in poi, ogni risposta corretta aggiunge anche +2 secondi extra immediati!",
    icon: <Timer className="w-12 h-12 text-[#FF8800]" />
  },
  {
    title: "QI RANKING",
    description: "La nostra AI valuterà la tua velocità e precisione per stimare il tuo Quoziente Intellettivo. Scala la classifica globale e dimostra di essere una delle menti più brillanti.",
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
    status: 'idle',
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
  const [activeModal, setActiveModal] = useState<'leaderboard' | 'tutorial' | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [targetAnimKey, setTargetAnimKey] = useState(0);
  const [scoreAnimKey, setScoreAnimKey] = useState(0);
  const [isVictoryAnimating, setIsVictoryAnimating] = useState(false);
  const [triggerParticles, setTriggerParticles] = useState(false);
  const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });
  const [isMuted, setIsMuted] = useState(false);
  const [showVideo, setShowVideo] = useState(false); // Win Video state
  const [showLostVideo, setShowLostVideo] = useState(false); // Lost Video state
  const theme = 'orange'; // Fixed theme
  const [levelBuffer, setLevelBuffer] = useState<{ grid: HexCellData[], targets: number[] }[]>([]);
  const timerRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // Supabase Integration
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  // Leaderboard data state
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);

  const [savedGame, setSavedGame] = useState<any>(null);
  const [isPaused, setIsPaused] = useState(false);

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
  }, []);

  const togglePause = async (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await handleUserInteraction();
    soundService.playUIClick();
    setIsPaused(!isPaused);
  };

  // Timer: Dedicated Loop for decrementing time only
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.timeLeft > 0 && !isVictoryAnimating && !showVideo && !isPaused) {
      timerRef.current = window.setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 0) return prev; // Should be handled by effect below, but safety check
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    } else {
      if (timerRef.current) window.clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [gameState.status, isPaused, isVictoryAnimating, showVideo]);

  // Game Over Watcher: Handles Time hitting 0
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.timeLeft <= 0) {
      // CLEAR TIMER IMMEDIATELY
      if (timerRef.current) window.clearInterval(timerRef.current);

      // PREVENT RACE: If we are already animating victory, do NOT trigger loss
      if (isVictoryAnimating || showVideo) return;

      soundService.playExternalSound('lost.mp3');
      setShowLostVideo(true);
      setGameState(prev => ({ ...prev, status: 'game-over', timeLeft: 0 }));
    }
  }, [gameState.timeLeft, gameState.status, isVictoryAnimating, showVideo]);



  const loadProfile = async (userId: string) => {
    const profile = await profileService.getProfile(userId);
    const save = await profileService.loadGameState(userId);

    if (save) setSavedGame(save);

    if (profile) {
      setUserProfile(profile);
      // SYNC: Keep max stats locally for display
      setGameState(prev => ({
        ...prev,
        totalScore: Math.max(prev.totalScore, profile.total_score || 0),
        estimatedIQ: Math.max(prev.estimatedIQ, profile.estimated_iq || 0)
      }));
    }
  };

  const handleLoginSuccess = (user: any) => {
    setCurrentUser(user);
    loadProfile(user.id);
    setShowAuthModal(false);
    showToast(`Benvenuto, ${user.user_metadata?.username || 'Operatore'}`);
  };

  const handleUserInteraction = useCallback(async () => {
    await soundService.init();
  }, []);

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

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, visible: true });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
    }, 2500);
  };

  // Caricamento Leaderboard (Fixed duplicate state)
  useEffect(() => {
    if (activeModal === 'leaderboard') {
      leaderboardService.getLeaderboard().then(data => setLeaderboardData(data));
    }
  }, [activeModal]);

  // Salvataggio Punteggio su Game Over & Sync Progress
  useEffect(() => {
    if (gameState.status === 'game-over' && gameState.totalScore > 0) {
      const saveScore = async () => {
        // Save to Leaderboard (Public)
        await leaderboardService.addEntry({
          player_name: userProfile?.username || 'Guest',
          score: gameState.totalScore,
          level: gameState.level,
          country: 'IT',
          iq: Math.round(gameState.estimatedIQ)
        });

        // Sync to Profile (Private Persistence)
        if (currentUser) {
          const updated = await profileService.syncProgress(
            currentUser.id,
            gameState.totalScore,
            gameState.level,
            Math.round(gameState.estimatedIQ)
          );
          if (updated) setUserProfile(updated);
          profileService.clearSavedGame(currentUser.id); // Clear saved game on game over
          setSavedGame(null);
        }
      };
      saveScore();
    }
  }, [gameState.status]);

  const calculateResultFromPath = (pathIds: string[]): number | null => {
    if (pathIds.length < 1) return null;

    const expression: string[] = pathIds.map(id => {
      const cell = grid.find(c => c.id === id);
      return cell ? cell.value : '';
    });

    try {
      let result = 0;
      let currentOp = '+';
      let hasStarted = false;

      for (let i = 0; i < expression.length; i++) {
        const part = expression[i];
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

  // LEVELS & DIFFICULTY SCALING
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

  const createLevelData = useCallback((level: number) => {
    const { min, max } = getDifficultyRange(level);
    let attempts = 0;
    const maxAttempts = 15;

    // Helper: Weighted numbers for early levels
    const getWeightedNumber = () => {
      if (level <= 30) {
        const r = Math.random();
        // 60% chance of small numbers (1-4), 30% mid (5-7), 10% high (8-9) or 0
        if (r < 0.60) return Math.floor(Math.random() * 4) + 1;
        if (r < 0.90) return Math.floor(Math.random() * 3) + 5;
        return Math.floor(Math.random() * 3) + 7; // 7,8,9 (occasional 0 if map allows, keeping simple 1-9 for now) | Actually logic was 0-9 before. Let's allowing 0 to 9 but biased.
      }
      return Math.floor(Math.random() * 10);
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
        const r = Math.random();
        if (r < weights['+']) pool.push('+');
        else if (r < weights['+'] + weights['-']) pool.push('-');
        else if (r < weights['+'] + weights['-'] + weights['×']) pool.push('×');
        else pool.push('÷');
      }

      // Shuffle pool (Fisher-Yates) for uniform distribution
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
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
        // Better shuffle for targets
        const shuffled = validSolutions.sort(() => Math.random() - 0.5);
        // Double shuffle to ensure no bottom-bias inherited from generation order
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
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

  const generateGrid = useCallback((forceStartLevel?: number) => {
    let nextLevelData;
    let newBuffer = [...levelBuffer];

    // Use forced level if provided (for restarts), otherwise use current state level
    const currentLevel = forceStartLevel !== undefined ? forceStartLevel : gameState.level;

    if (newBuffer.length === 0 || forceStartLevel !== undefined) {
      // Initialize buffer from scratch
      newBuffer = []; // Clear buffer if forcing start
      nextLevelData = createLevelData(currentLevel);
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
      totalScore: 0,
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

  const handleStartGameClick = async (e?: React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await handleUserInteraction();

    if (savedGame) {
      // Simple Native Confirm for MVP. Could be a custom modal later.
      if (confirm(`Trovata partita salvata:\nLivello ${savedGame.level} - Punti ${savedGame.totalScore}\n\nVuoi riprenderla?`)) {
        restoreGame();
        return;
      }
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
  };

  const goToHome = (e?: React.PointerEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    soundService.playReset();
    // Toast removed as per user request
    setGameState(prev => ({ ...prev, status: 'idle' }));
    setSelectedPath([]);
    setIsDragging(false);
    setPreviewResult(null);
  };

  const nextTutorialStep = async () => {
    await handleUserInteraction();
    soundService.playTick();
    if (tutorialStep < TUTORIAL_STEPS.length - 1) {
      setTutorialStep(prev => prev + 1);
    } else {
      startGame();
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
    // Check if result matches any uncompleted target
    const matchedTarget = gameState.levelTargets.find(t => t.value === result && !t.completed);

    if (matchedTarget) {
      handleSuccess(result!);
    } else {
      handleError();
    }
    setPreviewResult(null);
  };

  const handleSuccess = (matchedValue: number) => {
    // RACE CONDITION FIX: Do not process win if game is already over
    if (gameState.status !== 'playing') return;

    soundService.playSuccess();

    // NEW SCORING: Linear Progression based on streak
    // Example Level 1: 1, 2, 3, 4, 5...
    // Formula: Base(Level) * (Streak + 1)
    const baseForLevel = Math.pow(2, gameState.level - 1);
    const multiplier = gameState.streak + 1; // Linear instead of exponential (Math.pow(2, streak))
    const currentPoints = baseForLevel * multiplier;

    setScoreAnimKey(k => k + 1);

    // TIME BONUS: > Level 5 adds +2 seconds per target
    if (gameState.level > 5) {
      setGameState(prev => ({
        ...prev,
        timeLeft: prev.timeLeft + 2
      }));
    }

    // Update targets state
    const newTargets = gameState.levelTargets.map(t =>
      t.value === matchedValue ? { ...t, completed: true } : t
    );
    const allDone = newTargets.every(t => t.completed);

    if (allDone) {
      // STOP TIMER IMMEDIATELY
      if (timerRef.current) window.clearInterval(timerRef.current);

      setIsVictoryAnimating(true);
      setTriggerParticles(true);

      const nextLevelState = {
        ...gameState,
        totalScore: gameState.totalScore + currentPoints,
        streak: 0,
        estimatedIQ: Math.min(200, gameState.estimatedIQ + 4),
        levelTargets: newTargets,
        timeLeft: gameState.timeLeft,
      };

      setGameState(prev => ({
        ...prev,
        totalScore: prev.totalScore + currentPoints,
        streak: 0,
        estimatedIQ: Math.min(200, prev.estimatedIQ + 4),
        levelTargets: newTargets,
      }));

      // AUTO SAVE HERE (Level Completed -> State for STARTING next level)
      if (currentUser) {
        const saveState = {
          totalScore: nextLevelState.totalScore,
          streak: 0,
          level: gameState.level + 1, // Ready for next level
          timeLeft: gameState.timeLeft + 60, // Anticipate the +60s bonus
          estimatedIQ: nextLevelState.estimatedIQ
        };

        profileService.saveGameState(currentUser.id, saveState);
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
  }, [gameState.status]);

  const onStartInteraction = async (id: string) => {
    if (gameState.status !== 'playing' || isVictoryAnimating) return;
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
    if (!isDragging || gameState.status !== 'playing' || isVictoryAnimating) return;
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

      <div className={`fixed top-12 left-1/2 -translate-x-1/2 z-[3000] transition-all duration-500 pointer-events-none
        ${toast.visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-16 opacity-0 scale-95'}`}>
        <div className="glass-panel px-8 py-4 rounded-[1.5rem] border border-cyan-400/60 shadow-[0_0_40px_rgba(34,211,238,0.4)] flex items-center gap-5 backdrop-blur-2xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center shadow-lg">
            <Home className="w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="font-orbitron text-[10px] font-black text-cyan-400 uppercase tracking-[0.2em] mb-0.5">Sistema</span>
            <span className="font-orbitron text-sm font-black text-white tracking-widest uppercase">{toast.message}</span>
          </div>
        </div>
      </div>



      {gameState.status === 'idle' && (
        <>
          <CharacterHelper />
          <div className="z-10 w-full max-w-xl flex flex-col items-center text-center px-6 py-10 animate-screen-in">
            <div className="mb-6 flex flex-col items-center">
              {/* Logo: Custom Shape Image with White Border & Brain */}
              {/* Logo: Pure Color CSS Mask Implementation */}
              <div className="relative w-36 h-36 flex items-center justify-center mb-4 transition-transform hover:scale-110 duration-500">
                {/* Custom Octagon Image */}
                <img src="/octagon-base.png" alt="Logo Base" className="absolute inset-0 w-full h-full object-contain drop-shadow-lg" />

                {/* Brain Icon - Centered */}
                <Brain className="relative w-16 h-16 text-white drop-shadow-md z-10" strokeWidth={2.5} />
              </div>

              <h1 className="text-6xl sm:text-8xl font-black font-orbitron tracking-tighter text-[#FF8800] lowercase" style={{ WebkitTextStroke: '3px white' }}>
                number
              </h1>
            </div>

            <div className="max-w-md bg-white/10 border-2 border-white/20 backdrop-blur-md px-8 py-4 rounded-2xl mb-10 shadow-[0_8px_0_rgba(0,0,0,0.1)] transform rotate-1 hover:rotate-0 transition-transform duration-300">
              <p className="text-white text-sm sm:text-base font-bold leading-relaxed drop-shadow-sm">
                Sincronizza i tuoi neuroni. <br />
                Risolvi puzzle aritmetici in una corsa contro il tempo.
              </p>
            </div>

            <div className="flex flex-col gap-4 items-center w-full max-w-sm relative z-20">
              <button
                onPointerDown={handleStartGameClick}
                className="w-full group relative overflow-hidden flex items-center justify-center gap-4 bg-[#FF8800] text-white py-5 rounded-2xl font-orbitron font-black text-xl border-[4px] border-white shadow-[0_8px_0_rgba(0,0,0,0.2)] active:translate-y-1 active:shadow-[0_4px_0_rgba(0,0,0,0.2)] hover:scale-105 transition-all duration-300"
              >
                <Play className="w-8 h-8 fill-current" />
                <span className="tracking-widest">GIOCA</span>
              </button>

              <div className="grid grid-cols-2 gap-4 w-full">
                <button onPointerDown={async (e) => { e.stopPropagation(); await handleUserInteraction(); soundService.playUIClick(); setTutorialStep(0); setActiveModal('tutorial'); }}
                  className="flex items-center justify-center gap-2 bg-white text-[#FF8800] py-4 rounded-xl border-[3px] border-white shadow-[0_6px_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none hover:scale-105 transition-all duration-300">
                  <HelpCircle className="w-6 h-6" />
                  <span className="font-orbitron text-xs font-black uppercase tracking-widest">Tutorial</span>
                </button>
                <button onPointerDown={async (e) => { e.stopPropagation(); await handleUserInteraction(); soundService.playUIClick(); setActiveModal('leaderboard'); }}
                  className="flex items-center justify-center gap-2 bg-white text-[#FF8800] py-4 rounded-xl border-[3px] border-white shadow-[0_6px_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none hover:scale-105 transition-all duration-300">
                  <BarChart3 className="w-6 h-6" />
                  <span className="font-orbitron text-xs font-black uppercase tracking-widest">Ranking</span>
                </button>
              </div>

              {/* AUTH BUTTON */}
              <button
                onPointerDown={async (e) => {
                  e.stopPropagation();
                  await handleUserInteraction();
                  soundService.playUIClick();
                  if (currentUser) {
                    if (confirm('Vuoi effettuare il logout?')) {
                      import('./services/supabaseClient').then(({ authService }) => authService.signOut());
                      setCurrentUser(null);
                      setUserProfile(null);
                    }
                  } else {
                    setShowAuthModal(true);
                  }
                }}
                className="mt-4 w-full bg-slate-900/50 text-cyan-400 py-3 rounded-xl border border-cyan-500/30 font-orbitron font-bold text-xs uppercase tracking-widest hover:bg-slate-900 hover:text-cyan-300 transition-all flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" />
                {currentUser ? `Operatore: ${userProfile?.username || 'Sconosciuto'}` : 'Accedi / Registrati'}
              </button>

              <button
                onPointerDown={toggleMute}
                className={`mt-2 flex items-center gap-3 px-6 py-3 rounded-2xl border-[3px] border-white transition-all duration-300 shadow-[0_6px_0_rgba(0,0,0,0.1)] active:translate-y-1 active:shadow-none hover:scale-105
                ${isMuted
                    ? 'bg-slate-300 text-slate-500'
                    : 'bg-white text-[#FF8800]'
                  }`}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                <span className="font-orbitron text-xs font-black uppercase tracking-[0.2em]">
                  Audio {isMuted ? 'OFF' : 'ON'}
                </span>
              </button>


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
              <div className="absolute left-1/2 -translate-x-1/2 top-1/2 transform translate-y-[-10%] z-[100] cursor-pointer group" onPointerDown={togglePause}>
                <div className={`relative w-24 h-24 rounded-full bg-slate-900 border-[4px] border-white flex items-center justify-center shadow-xl transition-all duration-300 ${isPaused ? 'border-[#FF8800] scale-110 shadow-[0_0_30px_rgba(255,136,0,0.5)]' : 'group-hover:scale-105'}`}>
                  <svg className="absolute inset-0 w-full h-full -rotate-90 scale-90">
                    <circle cx="50%" cy="50%" r="45%" stroke="rgba(255,255,255,0.1)" strokeWidth="8" fill="none" />
                    {!isPaused && (
                      <circle
                        cx="50%" cy="50%" r="45%"
                        stroke={gameState.timeLeft < 10 ? '#ef4444' : '#FF8800'}
                        strokeWidth="8"
                        fill="none"
                        strokeDasharray="283"
                        strokeDashoffset={283 - (283 * gameState.timeLeft / INITIAL_TIME)}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                      />
                    )}
                  </svg>
                  {isPaused ? (
                    <Pause className="w-10 h-10 text-white animate-pulse" fill="white" />
                  ) : (
                    <span className="text-3xl font-black font-orbitron text-white">
                      {gameState.timeLeft}
                    </span>
                  )}
                </div>
              </div>

              {/* Right Group: Stats */}
              <div className="flex items-center gap-3 pl-20 sm:pl-0">
                <div className="w-11 h-11 rounded-full border-[3px] border-white flex flex-col items-center justify-center shadow-md bg-white text-[#FF8800]">
                  <span className="text-[7px] font-black uppercase leading-none opacity-80 mb-0.5">PTS</span>
                  <span className="text-xs font-black font-orbitron leading-none tracking-tighter">{gameState.totalScore}</span>
                </div>
                <div className="w-11 h-11 rounded-full border-[3px] border-white flex flex-col items-center justify-center shadow-md bg-white text-[#FF8800]">
                  <span className="text-[7px] font-black uppercase leading-none opacity-80 mb-0.5">LV</span>
                  <span className="text-sm font-black font-orbitron leading-none">{gameState.level}</span>
                </div>
              </div>
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
                  {tutorialStep === TUTORIAL_STEPS.length - 1 ? 'GIOCA ORA' : 'AVANTI'}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        activeModal === 'leaderboard' && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 modal-overlay bg-black/80" onPointerDown={() => { soundService.playUIClick(); setActiveModal(null); }}>
            <div className="glass-panel w-full max-w-md p-8 rounded-[2rem] modal-content flex flex-col" onPointerDown={e => e.stopPropagation()}>
              <h2 className="text-2xl font-black font-orbitron text-white mb-6 uppercase flex items-center gap-3"><Award className="text-amber-400" /> RANKING GLOBAL</h2>

              {leaderboardData.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-orbitron">Caricamento...</div>
              ) : (
                <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-2 custom-scroll">
                  {leaderboardData.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 bg-white/5 rounded-2xl border border-white/5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{idx + 1}. {p.player_name || 'Anonimo'}</span>
                        <span className="text-[8px] text-slate-500 uppercase">{p.country || 'IT'}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="font-orbitron font-black text-[#FF8800] text-sm">{p.score}</span>
                        <span className="font-orbitron font-bold text-cyan-400 text-[10px]">IQ {p.iq}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onPointerDown={() => { soundService.playUIClick(); setActiveModal(null); }} className="mt-8 w-full bg-slate-800 text-white py-4 rounded-xl font-orbitron font-black text-xs uppercase active:scale-95 transition-all">CHIUDI</button>
            </div>
          </div>
        )
      }

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={handleLoginSuccess} />}

      <footer className="mt-auto py-6 text-slate-600 text-[8px] tracking-[0.4em] uppercase font-black z-10 pointer-events-none opacity-40">AI Evaluation Engine v3.6</footer>
    </div >
  );
};

export default App;
