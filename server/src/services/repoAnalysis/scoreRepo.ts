import { ALL_SIGNAL_SCORERS, RepoSignalInput, SignalResult } from './signals';

export interface EngineeringScoreResult {
  totalScore: number; // 0-100
  breakdown: SignalResult[]; // all 11 signals, always in the same order
}

export function computeEngineeringScore(input: RepoSignalInput): EngineeringScoreResult {
  const breakdown = ALL_SIGNAL_SCORERS.map((scorer) => scorer(input));
  const totalScore = breakdown.reduce((sum, s) => sum + s.points, 0);

  return { totalScore, breakdown };
}
