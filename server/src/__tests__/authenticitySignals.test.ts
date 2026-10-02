import { describe, it, expect } from 'vitest';
import {
  detectCommitShapeSignal,
  detectTimeClusteringSignal,
  detectStructuralFingerprintSignal,
  AuthenticitySignalInput,
} from '../services/authenticity/signals';

const organicInput: AuthenticitySignalInput = {
  files: ['src/index.ts', 'src/utils.ts', 'src/api.ts', 'src/db.ts', 'README.md'],
  totalFileCount: 5,
  firstCommitFileCount: 1,
  totalCommitCount: 40,
  firstCommitDate: '2025-01-01T10:00:00Z',
  lastCommitDate: '2025-06-01T10:00:00Z', // 5 months later
};

const cloneLikeInput: AuthenticitySignalInput = {
  files: ['public/index.html', 'src/App.js', 'src/index.js', 'src/logo.svg', 'src/App.css'],
  totalFileCount: 5,
  firstCommitFileCount: 5, // everything landed in commit 1
  totalCommitCount: 2,
  firstCommitDate: '2025-01-01T10:00:00Z',
  lastCommitDate: '2025-01-01T18:00:00Z', // 8 hours later
};

describe('detectCommitShapeSignal', () => {
  it('does not trigger for organic incremental history', () => {
    expect(detectCommitShapeSignal(organicInput).triggered).toBe(false);
  });

  it('triggers when nearly all files land in the first commit', () => {
    expect(detectCommitShapeSignal(cloneLikeInput).triggered).toBe(true);
  });

  it('does not trigger for a trivially small repo (avoids false positives on 1-2 file repos)', () => {
    const result = detectCommitShapeSignal({ ...cloneLikeInput, totalFileCount: 2, firstCommitFileCount: 2 });
    expect(result.triggered).toBe(false);
  });

  it('handles zero files without dividing by zero', () => {
    const result = detectCommitShapeSignal({ ...cloneLikeInput, totalFileCount: 0, firstCommitFileCount: 0 });
    expect(result.triggered).toBe(false);
  });
});

describe('detectTimeClusteringSignal', () => {
  it('does not trigger for commits spread across months', () => {
    expect(detectTimeClusteringSignal(organicInput).triggered).toBe(false);
  });

  it('triggers when all commits land within 48 hours', () => {
    expect(detectTimeClusteringSignal(cloneLikeInput).triggered).toBe(true);
  });

  it('does not trigger for a single-commit repo (nothing to cluster)', () => {
    const result = detectTimeClusteringSignal({ ...cloneLikeInput, totalCommitCount: 1 });
    expect(result.triggered).toBe(false);
  });

  it('does not trigger for zero commits', () => {
    const result = detectTimeClusteringSignal({ ...cloneLikeInput, totalCommitCount: 0 });
    expect(result.triggered).toBe(false);
  });
});

describe('detectStructuralFingerprintSignal', () => {
  it('triggers on a near-exact match to a known CRA scaffold', () => {
    expect(detectStructuralFingerprintSignal(cloneLikeInput).triggered).toBe(true);
  });

  it('does not trigger on an unrelated file structure', () => {
    expect(detectStructuralFingerprintSignal(organicInput).triggered).toBe(false);
  });

  it('does not trigger on a partial/weak match', () => {
    const result = detectStructuralFingerprintSignal({ ...organicInput, files: ['src/App.js'] });
    expect(result.triggered).toBe(false);
  });
});
