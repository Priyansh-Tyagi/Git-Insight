import { describe, it, expect } from 'vitest';
import {
  scoreReadme,
  scoreLicense,
  scoreGitignore,
  scoreTests,
  scoreCI,
  scoreDocker,
  scoreDocs,
  scoreFolderStructure,
  scoreCommitActivity,
  scoreProjectSize,
  scoreDependencyHygiene,
  RepoSignalInput,
} from '../services/repoAnalysis/signals';

const baseInput: RepoSignalInput = {
  files: [],
  readmeLength: 0,
  sizeKb: 500,
  weeklyCommitCounts: new Array(52).fill(0),
};

describe('scoreReadme', () => {
  it('awards full points for a substantive README', () => {
    const result = scoreReadme({ ...baseInput, readmeLength: 500 });
    expect(result.points).toBe(15);
    expect(result.passed).toBe(true);
  });

  it('awards zero for a missing README', () => {
    const result = scoreReadme({ ...baseInput, readmeLength: 0 });
    expect(result.points).toBe(0);
  });

  it('awards zero for a README under the 300-char threshold', () => {
    const result = scoreReadme({ ...baseInput, readmeLength: 50 });
    expect(result.points).toBe(0);
    expect(result.detail).toContain('50 characters');
  });
});

describe('scoreLicense', () => {
  it('detects LICENSE regardless of extension', () => {
    expect(scoreLicense({ ...baseInput, files: ['LICENSE'] }).points).toBe(8);
    expect(scoreLicense({ ...baseInput, files: ['LICENSE.md'] }).points).toBe(8);
    expect(scoreLicense({ ...baseInput, files: ['license.txt'] }).points).toBe(8);
  });

  it('does not false-positive on unrelated files', () => {
    expect(scoreLicense({ ...baseInput, files: ['src/licensed-content.ts'] }).points).toBe(0);
  });
});

describe('scoreGitignore', () => {
  it('detects a root .gitignore', () => {
    expect(scoreGitignore({ ...baseInput, files: ['.gitignore'] }).points).toBe(5);
  });

  it('gives zero when absent', () => {
    expect(scoreGitignore({ ...baseInput, files: ['README.md'] }).points).toBe(0);
  });
});

describe('scoreTests', () => {
  it('gives 15 for a healthy test-to-source ratio', () => {
    const files = [
      'src/a.ts', 'src/b.ts', 'src/c.ts', 'src/d.ts',
      'src/a.test.ts', 'src/b.test.ts',
    ];
    const result = scoreTests({ ...baseInput, files });
    expect(result.points).toBe(15);
  });

  it('gives 8 for a thin but present test suite', () => {
    const files = Array.from({ length: 20 }, (_, i) => `src/file${i}.ts`).concat(['src/file0.test.ts']);
    const result = scoreTests({ ...baseInput, files });
    expect(result.points).toBe(8);
  });

  it('gives 0 when no test files exist', () => {
    const result = scoreTests({ ...baseInput, files: ['src/a.ts', 'src/b.ts'] });
    expect(result.points).toBe(0);
  });

  it('recognizes a __tests__ directory convention', () => {
    const files = ['src/a.ts', '__tests__/a.spec.js'];
    const result = scoreTests({ ...baseInput, files });
    expect(result.points).toBeGreaterThan(0);
  });
});

describe('scoreCI', () => {
  it('detects a GitHub Actions workflow', () => {
    expect(scoreCI({ ...baseInput, files: ['.github/workflows/ci.yml'] }).points).toBe(12);
  });

  it('does not false-positive on unrelated .github files', () => {
    expect(scoreCI({ ...baseInput, files: ['.github/ISSUE_TEMPLATE.md'] }).points).toBe(0);
  });
});

describe('scoreDocker', () => {
  it('detects a Dockerfile', () => {
    expect(scoreDocker({ ...baseInput, files: ['Dockerfile'] }).points).toBe(8);
  });

  it('detects docker-compose.yml', () => {
    expect(scoreDocker({ ...baseInput, files: ['docker-compose.yml'] }).points).toBe(8);
  });

  it('gives zero when absent', () => {
    expect(scoreDocker({ ...baseInput, files: ['src/index.ts'] }).points).toBe(0);
  });
});

describe('scoreDocs', () => {
  it('detects a docs/ folder', () => {
    expect(scoreDocs({ ...baseInput, files: ['docs/setup.md'] }).points).toBe(7);
  });

  it('gives zero without one', () => {
    expect(scoreDocs({ ...baseInput, files: ['README.md'] }).points).toBe(0);
  });
});

describe('scoreFolderStructure', () => {
  it('rewards a clean src/ layout with a tidy root', () => {
    const files = ['package.json', 'README.md', 'src/index.ts', 'src/utils.ts'];
    expect(scoreFolderStructure({ ...baseInput, files }).points).toBe(10);
  });

  it('penalizes everything dumped flat at root with no src/', () => {
    const files = Array.from({ length: 20 }, (_, i) => `file${i}.ts`);
    const result = scoreFolderStructure({ ...baseInput, files });
    expect(result.points).toBeLessThan(10);
  });
});

describe('scoreCommitActivity', () => {
  it('awards full points for recent, sustained activity', () => {
    const weeklyCommitCounts = new Array(52).fill(1); // 1 commit/week all year
    expect(scoreCommitActivity({ ...baseInput, weeklyCommitCounts }).points).toBe(10);
  });

  it('gives partial credit for old activity with enough total commits', () => {
    const weeklyCommitCounts = new Array(52).fill(0);
    weeklyCommitCounts[0] = 20; // all activity was a year ago, nothing recent
    const result = scoreCommitActivity({ ...baseInput, weeklyCommitCounts });
    expect(result.points).toBe(4);
  });

  it('gives zero for a near-empty commit history', () => {
    const weeklyCommitCounts = new Array(52).fill(0);
    weeklyCommitCounts[51] = 3; // recent but total is below the 10-commit floor
    expect(scoreCommitActivity({ ...baseInput, weeklyCommitCounts }).points).toBe(0);
  });
});

describe('scoreProjectSize', () => {
  it('rewards a reasonable size', () => {
    expect(scoreProjectSize({ ...baseInput, sizeKb: 1000 }).points).toBe(5);
  });

  it('penalizes a near-empty repo', () => {
    expect(scoreProjectSize({ ...baseInput, sizeKb: 5 }).points).toBe(0);
  });

  it('penalizes an unusually huge repo', () => {
    expect(scoreProjectSize({ ...baseInput, sizeKb: 200_000 }).points).toBe(0);
  });
});

describe('scoreDependencyHygiene', () => {
  it('detects package-lock.json', () => {
    expect(scoreDependencyHygiene({ ...baseInput, files: ['package-lock.json'] }).points).toBe(5);
  });

  it('detects requirements.txt', () => {
    expect(scoreDependencyHygiene({ ...baseInput, files: ['requirements.txt'] }).points).toBe(5);
  });

  it('gives zero with no lockfile', () => {
    expect(scoreDependencyHygiene({ ...baseInput, files: ['package.json'] }).points).toBe(0);
  });
});
