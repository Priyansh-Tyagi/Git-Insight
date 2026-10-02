import { describe, it, expect } from 'vitest';
import { computeEngineeringScore } from '../services/repoAnalysis/scoreRepo';
import { generateStrengthsAndWeaknesses } from '../services/repoAnalysis/strengthsWeaknesses';
import { RepoSignalInput } from '../services/repoAnalysis/signals';

const wellMaintainedRepo: RepoSignalInput = {
  files: [
    'README.md', 'LICENSE', '.gitignore', 'package.json', 'package-lock.json',
    '.github/workflows/ci.yml', 'Dockerfile', 'docs/setup.md',
    'src/index.ts', 'src/utils.ts', 'src/api.ts',
    'src/index.test.ts', 'src/utils.test.ts',
  ],
  readmeLength: 1200,
  sizeKb: 800,
  weeklyCommitCounts: new Array(52).fill(2),
};

const toyRepo: RepoSignalInput = {
  files: ['index.js', 'style.css'],
  readmeLength: 0,
  sizeKb: 8,
  weeklyCommitCounts: [0, 0, 0, 0, 0, 5], // one initial commit, nothing since
};

describe('computeEngineeringScore', () => {
  it('scores a well-maintained repo highly', () => {
    const result = computeEngineeringScore(wellMaintainedRepo);
    expect(result.totalScore).toBeGreaterThan(80);
    expect(result.breakdown).toHaveLength(11);
  });

  it('scores a toy repo low', () => {
    const result = computeEngineeringScore(toyRepo);
    expect(result.totalScore).toBeLessThan(30);
  });

  it('produces a meaningfully different score between the two — the rubric actually discriminates', () => {
    const good = computeEngineeringScore(wellMaintainedRepo).totalScore;
    const toy = computeEngineeringScore(toyRepo).totalScore;
    expect(good - toy).toBeGreaterThan(40);
  });

  it('is fully deterministic — same input always produces the exact same score', () => {
    const results = Array.from({ length: 20 }, () => computeEngineeringScore(wellMaintainedRepo).totalScore);
    const allIdentical = results.every((r) => r === results[0]);
    expect(allIdentical).toBe(true);
  });

  it('every breakdown entry stays within its own max points, and the total is their sum', () => {
    const { totalScore, breakdown } = computeEngineeringScore(wellMaintainedRepo);
    for (const signal of breakdown) {
      expect(signal.points).toBeGreaterThanOrEqual(0);
      expect(signal.points).toBeLessThanOrEqual(signal.maxPoints);
    }
    expect(breakdown.reduce((sum, s) => sum + s.points, 0)).toBe(totalScore);
  });

  it('the max possible total across all signals is exactly 100, matching the design doc rubric', () => {
    const { breakdown } = computeEngineeringScore(wellMaintainedRepo);
    const maxPossible = breakdown.reduce((sum, s) => sum + s.maxPoints, 0);
    expect(maxPossible).toBe(100);
  });
});

describe('generateStrengthsAndWeaknesses', () => {
  it('a well-maintained repo yields more strengths than weaknesses', () => {
    const { breakdown } = computeEngineeringScore(wellMaintainedRepo);
    const { strengths, weaknesses } = generateStrengthsAndWeaknesses(breakdown);
    expect(strengths.length).toBeGreaterThan(weaknesses.length);
  });

  it('a toy repo yields more weaknesses than strengths', () => {
    const { breakdown } = computeEngineeringScore(toyRepo);
    const { strengths, weaknesses } = generateStrengthsAndWeaknesses(breakdown);
    expect(weaknesses.length).toBeGreaterThan(strengths.length);
  });

  it('every weakness message is templated text, never a raw signal id', () => {
    const { breakdown } = computeEngineeringScore(toyRepo);
    const { weaknesses } = generateStrengthsAndWeaknesses(breakdown);
    for (const w of weaknesses) {
      expect(w.length).toBeGreaterThan(15); // a real sentence, not a bare id like "readme"
    }
  });
});
