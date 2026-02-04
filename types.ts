
export type CellType = 'number' | 'operator';

export interface HexCellData {
  id: string;
  type: CellType;
  value: string;
  row: number;
  col: number;
}

export interface GameState {
  score: number;
  totalScore: number;
  streak: number;
  level: number;
  timeLeft: number;
  targetResult: number;
  status: 'playing' | 'level-complete' | 'game-over' | 'idle' | 'intro' | 'opponent-surrendered' | 'round-won' | 'round-lost';
  estimatedIQ: number;
  lastLevelPerfect: boolean;
  basePoints: number;

  // targetQueue: number[]; // Deprecated in favor of levelTargets
  levelTargets: { value: number; displayValue?: string; completed: boolean; owner?: 'p1' | 'p2' }[];
  isBossLevel?: boolean;
  bossLevelId?: number | null;
}

export interface PlayerRank {
  name: string;
  score: number;
  iq: number;
  country: string;
}
