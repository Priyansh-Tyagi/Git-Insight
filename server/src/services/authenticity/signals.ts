import { matchFingerprint } from './fingerprints';

export interface AuthenticitySignalResult {
  id: string;
  label: string;
  triggered: boolean; // true = looks suspicious
  detail: string;
}

export interface AuthenticitySignalInput {
  files: string[];
  totalFileCount: number;
  firstCommitFileCount: number; // files touched in the oldest commit
  totalCommitCount: number;
  firstCommitDate: string; // ISO
  lastCommitDate: string; // ISO
}

/**
 * Signal 1 — commit shape: a single or very small number of large initial
 * commits containing most/all of the repo, vs. organic incremental history.
 */
export function detectCommitShapeSignal(input: AuthenticitySignalInput): AuthenticitySignalResult {
  if (input.totalFileCount === 0) {
    return { id: 'commit_shape', label: 'Commit Shape', triggered: false, detail: 'No files to evaluate' };
  }

  const ratio = input.firstCommitFileCount / input.totalFileCount;
  const triggered = ratio > 0.7 && input.totalFileCount > 3;

  return {
    id: 'commit_shape',
    label: 'Commit Shape',
    triggered,
    detail: triggered
      ? `First commit already contained ${Math.round(ratio * 100)}% of all files — little organic incremental history`
      : `First commit contained ${Math.round(ratio * 100)}% of files — consistent with incremental development`,
  };
}

/**
 * Signal 2 — time clustering: most/all commits landing in an unusually
 * short window, a common signature of following a tutorial in one sitting.
 */
export function detectTimeClusteringSignal(input: AuthenticitySignalInput): AuthenticitySignalResult {
  if (input.totalCommitCount === 0) {
    return { id: 'time_clustering', label: 'Time Clustering', triggered: false, detail: 'No commits to evaluate' };
  }

  const spanMs = new Date(input.lastCommitDate).getTime() - new Date(input.firstCommitDate).getTime();
  const spanHours = spanMs / (1000 * 60 * 60);
  const triggered = input.totalCommitCount > 1 && spanHours < 48;

  return {
    id: 'time_clustering',
    label: 'Time Clustering',
    triggered,
    detail: triggered
      ? `All ${input.totalCommitCount} commits landed within ${Math.round(spanHours)} hours — consistent with a single working session`
      : `Commits span ${Math.round(spanHours)} hours — consistent with ongoing work over time`,
  };
}

/**
 * Signal 3 — structural fingerprint: file layout closely matches a known,
 * largely-unmodified tutorial/starter template.
 */
export function detectStructuralFingerprintSignal(input: AuthenticitySignalInput): AuthenticitySignalResult {
  const match = matchFingerprint(input.files);

  return {
    id: 'structural_fingerprint',
    label: 'Structural Fingerprint',
    triggered: match.matched,
    detail: match.matched
      ? `Structure closely matches a known template: "${match.fingerprintName}" (${Math.round(match.matchRatio * 100)}% of defining files present)`
      : match.fingerprintName
        ? `Closest known template match was "${match.fingerprintName}" at only ${Math.round(match.matchRatio * 100)}% — not a close match`
        : 'No structural match to any known template',
  };
}

export const ALL_AUTHENTICITY_SIGNALS = [
  detectCommitShapeSignal,
  detectTimeClusteringSignal,
  detectStructuralFingerprintSignal,
];
