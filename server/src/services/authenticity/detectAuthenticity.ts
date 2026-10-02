import { ALL_AUTHENTICITY_SIGNALS, AuthenticitySignalInput, AuthenticitySignalResult } from './signals';

export type AuthenticityFlag = 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data';

export interface AuthenticityResult {
  flag: AuthenticityFlag;
  evidence: AuthenticitySignalResult[]; // always all 3, so the UI can show what was checked either way
}

export function detectAuthenticity(input: AuthenticitySignalInput): AuthenticityResult {
  if (input.totalFileCount === 0 || input.totalCommitCount === 0) {
    return {
      flag: 'insufficient_data',
      evidence: ALL_AUTHENTICITY_SIGNALS.map((fn) => fn(input)),
    };
  }

  const evidence = ALL_AUTHENTICITY_SIGNALS.map((fn) => fn(input));
  const triggeredCount = evidence.filter((s) => s.triggered).length;

  return {
    flag: triggeredCount >= 2 ? 'possible_tutorial_clone' : 'likely_original',
    evidence,
  };
}
