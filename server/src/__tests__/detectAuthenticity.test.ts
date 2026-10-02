import { describe, it, expect } from 'vitest';
import { detectAuthenticity } from '../services/authenticity/detectAuthenticity';
import { AuthenticitySignalInput } from '../services/authenticity/signals';

const organicInput: AuthenticitySignalInput = {
  files: ['src/index.ts', 'src/utils.ts', 'src/api.ts', 'src/db.ts', 'README.md'],
  totalFileCount: 5,
  firstCommitFileCount: 1,
  totalCommitCount: 40,
  firstCommitDate: '2025-01-01T10:00:00Z',
  lastCommitDate: '2025-06-01T10:00:00Z',
};

const cloneLikeInput: AuthenticitySignalInput = {
  files: ['public/index.html', 'src/App.js', 'src/index.js', 'src/logo.svg', 'src/App.css'],
  totalFileCount: 5,
  firstCommitFileCount: 5,
  totalCommitCount: 2,
  firstCommitDate: '2025-01-01T10:00:00Z',
  lastCommitDate: '2025-01-01T18:00:00Z',
};

const emptyInput: AuthenticitySignalInput = {
  files: [],
  totalFileCount: 0,
  firstCommitFileCount: 0,
  totalCommitCount: 0,
  firstCommitDate: '2025-01-01T10:00:00Z',
  lastCommitDate: '2025-01-01T10:00:00Z',
};

describe('detectAuthenticity', () => {
  it('flags a clone-like repo as possible_tutorial_clone (2+ signals trigger)', () => {
    const result = detectAuthenticity(cloneLikeInput);
    expect(result.flag).toBe('possible_tutorial_clone');
    expect(result.evidence.filter((e) => e.triggered).length).toBeGreaterThanOrEqual(2);
  });

  it('flags an organically-developed repo as likely_original', () => {
    const result = detectAuthenticity(organicInput);
    expect(result.flag).toBe('likely_original');
  });

  it('flags a repo with no files/commits as insufficient_data rather than guessing', () => {
    const result = detectAuthenticity(emptyInput);
    expect(result.flag).toBe('insufficient_data');
  });

  it('always returns all 3 signals as evidence, even when insufficient_data', () => {
    const result = detectAuthenticity(emptyInput);
    expect(result.evidence).toHaveLength(3);
  });

  it('is fully deterministic — same input always produces the same flag', () => {
    const flags = Array.from({ length: 20 }, () => detectAuthenticity(cloneLikeInput).flag);
    expect(flags.every((f) => f === flags[0])).toBe(true);
  });

  it('never flags possible_tutorial_clone off a single triggered signal alone', () => {
    // only time clustering triggers, commit shape and fingerprint don't
    const oneSignalInput: AuthenticitySignalInput = {
      files: ['src/unique-app-specific-file.ts'],
      totalFileCount: 10,
      firstCommitFileCount: 1, // organic shape
      totalCommitCount: 5,
      firstCommitDate: '2025-01-01T10:00:00Z',
      lastCommitDate: '2025-01-01T12:00:00Z', // clustered in time, but nothing else
    };
    const result = detectAuthenticity(oneSignalInput);
    expect(result.flag).not.toBe('possible_tutorial_clone');
  });
});
