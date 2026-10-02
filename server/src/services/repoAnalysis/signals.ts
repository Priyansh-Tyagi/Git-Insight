export interface SignalResult {
  id: string;
  label: string;
  points: number;
  maxPoints: number;
  passed: boolean; // true if points === maxPoints (used for strengths/weaknesses templating)
  detail: string; // human-readable reason, shown in the breakdown UI
}

/**
 * Everything the rubric needs, already fetched — kept as plain data so every
 * signal function below is pure and testable with zero network/DB mocking.
 */
export interface RepoSignalInput {
  files: string[]; // full relative paths, e.g. "src/index.ts", ".github/workflows/ci.yml"
  readmeLength: number; // 0 if no README
  sizeKb: number; // repo size from GitHub metadata
  weeklyCommitCounts: number[]; // last 52 weeks, oldest first (GitHub's stats/commit_activity shape)
}

function hasFileMatching(files: string[], pattern: RegExp): boolean {
  return files.some((f) => pattern.test(f));
}

function countMatching(files: string[], pattern: RegExp): number {
  return files.filter((f) => pattern.test(f)).length;
}

export function scoreReadme(input: RepoSignalInput): SignalResult {
  const passed = input.readmeLength > 300;
  return {
    id: 'readme',
    label: 'README',
    points: passed ? 15 : 0,
    maxPoints: 15,
    passed,
    detail: passed
      ? `README is ${input.readmeLength} characters — substantive`
      : input.readmeLength === 0
        ? 'No README found'
        : `README is only ${input.readmeLength} characters — too thin to score`,
  };
}

export function scoreLicense(input: RepoSignalInput): SignalResult {
  const passed = hasFileMatching(input.files, /^license(\.\w+)?$/i);
  return {
    id: 'license',
    label: 'LICENSE',
    points: passed ? 8 : 0,
    maxPoints: 8,
    passed,
    detail: passed ? 'LICENSE file present' : 'No LICENSE file found',
  };
}

export function scoreGitignore(input: RepoSignalInput): SignalResult {
  const passed = hasFileMatching(input.files, /^\.gitignore$/i);
  return {
    id: 'gitignore',
    label: '.gitignore',
    points: passed ? 5 : 0,
    maxPoints: 5,
    passed,
    detail: passed ? '.gitignore present' : 'No .gitignore — build artifacts may be tracked',
  };
}

export function scoreTests(input: RepoSignalInput): SignalResult {
  const testFilePattern = /(^|\/)(tests?|__tests__)\/|\.(test|spec)\.[jt]sx?$|_test\.py$|test_.*\.py$/i;
  const sourceFilePattern = /\.(js|jsx|ts|tsx|py|java|go|rb)$/i;

  const testFiles = countMatching(input.files, testFilePattern);
  const sourceFiles = countMatching(
    input.files.filter((f) => !testFilePattern.test(f)),
    sourceFilePattern
  );

  const ratio = sourceFiles === 0 ? 0 : testFiles / sourceFiles;

  let points = 0;
  let detail: string;
  if (testFiles === 0) {
    detail = 'No test files detected';
  } else if (ratio < 0.15) {
    points = 8;
    detail = `${testFiles} test file(s) found, but thin relative to ${sourceFiles} source files`;
  } else {
    points = 15;
    detail = `${testFiles} test file(s) found — solid coverage relative to ${sourceFiles} source files`;
  }

  return { id: 'tests', label: 'Tests', points, maxPoints: 15, passed: points === 15, detail };
}

export function scoreCI(input: RepoSignalInput): SignalResult {
  const passed = hasFileMatching(input.files, /^\.github\/workflows\/.+\.ya?ml$/i);
  return {
    id: 'ci',
    label: 'CI Pipeline',
    points: passed ? 12 : 0,
    maxPoints: 12,
    passed,
    detail: passed ? 'GitHub Actions workflow detected' : 'No CI pipeline detected',
  };
}

export function scoreDocker(input: RepoSignalInput): SignalResult {
  const passed = hasFileMatching(input.files, /^(dockerfile|docker-compose\.ya?ml)$/i);
  return {
    id: 'docker',
    label: 'Docker Support',
    points: passed ? 8 : 0,
    maxPoints: 8,
    passed,
    detail: passed ? 'Dockerfile or docker-compose found' : 'No Docker support detected',
  };
}

export function scoreDocs(input: RepoSignalInput): SignalResult {
  const passed = hasFileMatching(input.files, /^docs\//i);
  return {
    id: 'docs',
    label: 'Documentation',
    points: passed ? 7 : 0,
    maxPoints: 7,
    passed,
    detail: passed ? 'docs/ folder present' : 'No docs/ folder beyond the README',
  };
}

export function scoreFolderStructure(input: RepoSignalInput): SignalResult {
  const rootFiles = input.files.filter((f) => !f.includes('/'));
  const hasSrcFolder = hasFileMatching(input.files, /^(src|lib|app)\//i);

  // Heuristic from the design doc: penalize a flat root with everything dumped in it.
  const passed = hasSrcFolder && rootFiles.length <= 12;
  const points = passed ? 10 : hasSrcFolder || rootFiles.length <= 12 ? 5 : 0;

  return {
    id: 'structure',
    label: 'Folder Structure',
    points,
    maxPoints: 10,
    passed,
    detail: passed
      ? 'Organized into subfolders (src/lib/app), root kept clean'
      : `${rootFiles.length} files at repo root with ${hasSrcFolder ? 'a' : 'no'} clear src/lib folder`,
  };
}

export function scoreCommitActivity(input: RepoSignalInput): SignalResult {
  const last26Weeks = input.weeklyCommitCounts.slice(-26); // ~6 months
  const recentCommits = last26Weeks.reduce((sum, c) => sum + c, 0);
  const totalCommits = input.weeklyCommitCounts.reduce((sum, c) => sum + c, 0);

  const passed = recentCommits > 0 && totalCommits > 10;
  return {
    id: 'activity',
    label: 'Commit Activity',
    points: passed ? 10 : totalCommits > 10 ? 4 : 0,
    maxPoints: 10,
    passed,
    detail: passed
      ? `Active in the last 6 months, ${totalCommits} commits total`
      : totalCommits <= 10
        ? `Only ${totalCommits} commits total — too little history to judge activity`
        : 'No commits in the last 6 months — appears inactive',
  };
}

export function scoreProjectSize(input: RepoSignalInput): SignalResult {
  // Sanity band from the design doc: not a 5-file toy, not a 50MB+ binary dump.
  const passed = input.sizeKb >= 20 && input.sizeKb <= 50_000;
  return {
    id: 'size',
    label: 'Project Size',
    points: passed ? 5 : 0,
    maxPoints: 5,
    passed,
    detail: passed
      ? `${input.sizeKb} KB — reasonable project size`
      : input.sizeKb < 20
        ? `Only ${input.sizeKb} KB — likely too small to be a substantive project`
        : `${input.sizeKb} KB — unusually large, may include binary assets or vendored dependencies`,
  };
}

export function scoreDependencyHygiene(input: RepoSignalInput): SignalResult {
  const passed = hasFileMatching(
    input.files,
    /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|requirements\.txt|poetry\.lock|Gemfile\.lock)$/i
  );
  return {
    id: 'dependencies',
    label: 'Dependency Hygiene',
    points: passed ? 5 : 0,
    maxPoints: 5,
    passed,
    detail: passed ? 'Lockfile present — reproducible installs' : 'No lockfile found',
  };
}

export const ALL_SIGNAL_SCORERS = [
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
];
