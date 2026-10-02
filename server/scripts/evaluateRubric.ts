/**
 * Rubric Validation Experiment (PRD Section 11.1).
 *
 * Run with: npm run evaluate
 *
 * Optional: set EVAL_GITHUB_TOKEN in .env for a higher rate limit (5000/hr
 * vs 60/hr unauthenticated). Not required for the small starter dataset.
 *
 * What this does:
 *  1. Fetches real signal data for every repo in the curated + toy dataset
 *  2. Scores each with the exact same computeEngineeringScore used in the app
 *  3. Reports group means, stdev, and Cohen's d effect size — does the
 *     rubric actually separate "known good" from "known toy" repos?
 *  4. Ablation: re-scores with each signal zeroed out one at a time, to see
 *     which signals actually drive the separation
 *  5. Writes results/rubric-validation-results.md — paste-ready for the paper
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { CURATED_REPOS, TOY_REPOS, DatasetRepo } from './evaluation/dataset';
import { fetchRepoSignalInput } from '../src/services/repoAnalysis/fetchRepoTree';
import { computeEngineeringScore } from '../src/services/repoAnalysis/scoreRepo';
import { ALL_SIGNAL_SCORERS, RepoSignalInput } from '../src/services/repoAnalysis/signals';
import { mean, stdDev, cohensD, effectSizeLabel } from '../src/services/evaluation/statistics';
import axios from 'axios';

const token = process.env.EVAL_GITHUB_TOKEN || undefined;

interface RepoResult {
  fullName: string;
  totalScore: number;
  breakdown: ReturnType<typeof computeEngineeringScore>['breakdown'];
  signalInput: RepoSignalInput;
  error?: string;
}

async function fetchAndScore(repo: DatasetRepo): Promise<RepoResult> {
  const [owner, name] = repo.fullName.split('/');
  try {
    const metaRes = await axios.get(`https://api.github.com/repos/${owner}/${name}`, {
      headers: token ? { Authorization: `token ${token}` } : {},
    });
    const defaultBranch = metaRes.data.default_branch;
    const sizeKb = metaRes.data.size;

    const signalInput = await fetchRepoSignalInput(token, owner, name, defaultBranch, sizeKb);
    const { totalScore, breakdown } = computeEngineeringScore(signalInput);

    return { fullName: repo.fullName, totalScore, breakdown, signalInput };
  } catch (err: any) {
    return {
      fullName: repo.fullName,
      totalScore: -1,
      breakdown: [],
      signalInput: { files: [], readmeLength: 0, sizeKb: 0, weeklyCommitCounts: [] },
      error: err?.response?.status ? `HTTP ${err.response.status}` : err.message,
    };
  }
}

function scoreWithSignalZeroed(input: RepoSignalInput, zeroedSignalId: string): number {
  const breakdown = ALL_SIGNAL_SCORERS.map((scorer) => {
    const result = scorer(input);
    return result.id === zeroedSignalId ? { ...result, points: 0 } : result;
  });
  return breakdown.reduce((sum, s) => sum + s.points, 0);
}

async function main() {
  console.log(`Fetching ${CURATED_REPOS.length} curated + ${TOY_REPOS.length} toy repos...`);
  console.log(token ? 'Using authenticated GitHub API (5000 req/hr).' : 'Using unauthenticated GitHub API (60 req/hr) — set EVAL_GITHUB_TOKEN in .env for a higher limit.\n');

  const curatedResults = await Promise.all(CURATED_REPOS.map(fetchAndScore));
  const toyResults = await Promise.all(TOY_REPOS.map(fetchAndScore));

  const failedFetches = [...curatedResults, ...toyResults].filter((r) => r.error);
  const curatedOk = curatedResults.filter((r) => !r.error);
  const toyOk = toyResults.filter((r) => !r.error);

  const curatedScores = curatedOk.map((r) => r.totalScore);
  const toyScores = toyOk.map((r) => r.totalScore);

  const d = cohensD(curatedScores, toyScores);

  let report = `# Rubric Validation Experiment Results\n\n`;
  report += `Generated ${new Date().toISOString()}\n\n`;

  if (failedFetches.length > 0) {
    report += `## Fetch failures (excluded from analysis)\n\n`;
    for (const f of failedFetches) report += `- ${f.fullName}: ${f.error}\n`;
    report += `\n`;
  }

  if (curatedOk.length === 0 || toyOk.length === 0) {
    report += `## Result: Unable to compute\n\n`;
    report += `${curatedOk.length === 0 ? 'Every curated repo' : 'Every toy repo'} fetch failed — see failures above. This is almost always GitHub's unauthenticated rate limit (60 req/hr, shared across everyone on the same IP — very easy to exhaust in a shared/cloud environment). Set \`EVAL_GITHUB_TOKEN\` in \`.env\` and try again, or wait an hour for the limit to reset.\n\n`;
    console.log('\n' + report);
    const outDir = path.join(__dirname, 'evaluation', 'results');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'rubric-validation-results.md'), report);
    console.log(`\nWritten to ${path.join(outDir, 'rubric-validation-results.md')} — but re-run with a token before trusting these results.`);
    return;
  }

  report += `## Group Separation\n\n`;
  report += `| Group | n | Mean Score | Std Dev |\n|---|---|---|---|\n`;
  report += `| Curated | ${curatedOk.length} | ${mean(curatedScores).toFixed(1)} | ${stdDev(curatedScores).toFixed(1)} |\n`;
  report += `| Toy | ${toyOk.length} | ${mean(toyScores).toFixed(1)} | ${stdDev(toyScores).toFixed(1)} |\n\n`;
  report += `**Cohen's d = ${d.toFixed(2)} (${effectSizeLabel(d)} effect size)**\n\n`;
  report += `> Sample sizes here are intentionally small (starter dataset). Expand \`scripts/evaluation/dataset.ts\` to ~15-20 repos per group before treating this as paper-ready evidence — see the comments in that file.\n\n`;

  report += `## Per-repo scores\n\n| Repo | Group | Score |\n|---|---|---|\n`;
  for (const r of curatedOk) report += `| ${r.fullName} | curated | ${r.totalScore} |\n`;
  for (const r of toyOk) report += `| ${r.fullName} | toy | ${r.totalScore} |\n`;
  report += `\n`;

  report += `## Ablation — effect size with each signal removed\n\n`;
  if (!Number.isFinite(d)) {
    report += `> Baseline Cohen's d is not finite (too few samples per group to estimate variance — see the note above). Ablation deltas are meaningless until the dataset has at least 2+ samples per group; showing raw ablated values only.\n\n`;
  }
  report += `| Signal removed | Cohen's d without it${Number.isFinite(d) ? ' | Change from baseline |' : ' |'}\n|---|---|${Number.isFinite(d) ? '---|' : ''}\n`;
  const allOkResults = [...curatedOk, ...toyOk];
  for (const scorer of ALL_SIGNAL_SCORERS) {
    const signalId = scorer({ files: [], readmeLength: 0, sizeKb: 0, weeklyCommitCounts: [] }).id;
    const curatedAblated = curatedOk.map((r) => scoreWithSignalZeroed(r.signalInput, signalId));
    const toyAblated = toyOk.map((r) => scoreWithSignalZeroed(r.signalInput, signalId));
    const dAblated = cohensD(curatedAblated, toyAblated);
    const dAblatedStr = Number.isFinite(dAblated) ? dAblated.toFixed(2) : String(dAblated);

    if (Number.isFinite(d)) {
      const delta = dAblated - d;
      report += `| ${signalId} | ${dAblatedStr} | ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} |\n`;
    } else {
      report += `| ${signalId} | ${dAblatedStr} |\n`;
    }
  }
  report += `\n> A large negative "change" means removing that signal hurts separation a lot — i.e. that signal is doing real work. A near-zero change means it's not contributing much to distinguishing these two groups in this dataset.\n`;

  console.log('\n' + report);

  const outDir = path.join(__dirname, 'evaluation', 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'rubric-validation-results.md');
  fs.writeFileSync(outPath, report);
  console.log(`\nWritten to ${outPath}`);
}

main().catch((err) => {
  console.error('Evaluation script failed:', err);
  process.exit(1);
});
