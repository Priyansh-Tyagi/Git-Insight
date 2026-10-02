import { LANGUAGE_TAXONOMY, SIGNAL_TAXONOMY } from './taxonomy';

export type Trend = 'growing' | 'stable' | 'stale';

export interface RepoSkillInput {
  id: string;
  languageStats: Record<string, number>; // bytes, from Phase 2 sync
  pushedAt: string; // ISO date, repo's last push — proxy for "last analyzed commit"
  passedSignalIds: string[]; // ids from score_breakdown where passed === true (Phase 4); [] if never analyzed
}

export interface SkillResult {
  skill: string;
  category: string;
  strengthScore: number; // 0-100
  trend: Trend;
  repoCount: number;
  evidenceRepoIds: string[];
}

function daysSince(isoDate: string): number {
  return (Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);
}

/** Buckets recency into a 0-100 score — a decay curve, not a continuous function, so it stays explainable. */
function recencyScore(days: number): number {
  if (days <= 30) return 100;
  if (days <= 90) return 80;
  if (days <= 180) return 60;
  if (days <= 365) return 30;
  return 10;
}

function repoCountScore(count: number): number {
  return Math.min(count / 5, 1) * 100; // capped at 5 repos for full marks — documented, not hidden
}

function classifyTrend(days: number): Trend {
  if (days <= 60) return 'growing';
  if (days <= 180) return 'stable';
  return 'stale';
}

interface SkillAccumulator {
  category: string;
  contributingRepos: Map<string, { pushedAt: string; languageShare: number | null }>;
}

export function inferSkills(repos: RepoSkillInput[]): SkillResult[] {
  const accumulators = new Map<string, SkillAccumulator>();

  for (const repo of repos) {
    const totalBytes = Object.values(repo.languageStats).reduce((sum, b) => sum + b, 0);

    for (const [lang, bytes] of Object.entries(repo.languageStats)) {
      const entry = LANGUAGE_TAXONOMY[lang];
      if (!entry) continue; // unmapped language — not in taxonomy yet, skip rather than guess

      if (!accumulators.has(entry.skill)) {
        accumulators.set(entry.skill, { category: entry.category, contributingRepos: new Map() });
      }
      const share = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0;
      accumulators.get(entry.skill)!.contributingRepos.set(repo.id, { pushedAt: repo.pushedAt, languageShare: share });
    }

    for (const signalId of repo.passedSignalIds) {
      const entry = SIGNAL_TAXONOMY[signalId];
      if (!entry) continue;

      if (!accumulators.has(entry.skill)) {
        accumulators.set(entry.skill, { category: entry.category, contributingRepos: new Map() });
      }
      // Signal-based skills are binary (present/absent), not a byte share — null means "not applicable."
      accumulators.get(entry.skill)!.contributingRepos.set(repo.id, { pushedAt: repo.pushedAt, languageShare: null });
    }
  }

  const results: SkillResult[] = [];

  for (const [skill, acc] of accumulators.entries()) {
    const contributing = Array.from(acc.contributingRepos.entries());
    const repoCount = contributing.length;

    const mostRecentPushedAt = contributing.reduce(
      (latest, [, r]) => (new Date(r.pushedAt) > new Date(latest) ? r.pushedAt : latest),
      contributing[0][1].pushedAt
    );
    const daysSinceMostRecent = daysSince(mostRecentPushedAt);

    const languageShares = contributing.map(([, r]) => r.languageShare).filter((s): s is number => s !== null);
    // Binary/signal-based skills (no language share concept) get full marks on this axis by definition of "present."
    const languageShareScore = languageShares.length > 0 ? languageShares.reduce((a, b) => a + b, 0) / languageShares.length : 100;

    const strengthScore = Math.round(
      0.4 * repoCountScore(repoCount) + 0.3 * recencyScore(daysSinceMostRecent) + 0.3 * languageShareScore
    );

    results.push({
      skill,
      category: acc.category,
      strengthScore,
      trend: classifyTrend(daysSinceMostRecent),
      repoCount,
      evidenceRepoIds: contributing.map(([repoId]) => repoId),
    });
  }

  return results.sort((a, b) => b.strengthScore - a.strengthScore);
}
