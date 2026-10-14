/**
 * Phase 9 — Cold-Start Mode.
 *
 * A profile with little original, analyzed work can't support the radar chart,
 * skill trends or percentile-style claims the rest of the dashboard makes. This
 * module decides — deterministically, no AI — whether a profile is "thin", why,
 * and what concrete next steps would fix it.
 *
 * "Evidence repo" = a repo that is (a) not a fork, (b) already analyzed, and
 * (c) not flagged possible_tutorial_clone. Only these count as evidence of the
 * user's own engineering.
 */

export const MIN_EVIDENCE_REPOS = 3;

export interface ColdStartRepoInput {
  isFork: boolean;
  analyzed: boolean; // engineering_score is not null
  authenticityFlag: string | null; // 'likely_original' | 'possible_tutorial_clone' | 'insufficient_data' | null
  scoreBreakdown: { id: string; label?: string; passed: boolean }[] | null;
}

export type ProfileDepth = 'insufficient' | 'thin' | 'sufficient';

export interface ColdStartAssessment {
  coldStart: boolean;
  depth: ProfileDepth;
  evidenceRepoCount: number;
  minEvidenceRepos: number;
  totals: { repos: number; forks: number; unanalyzed: number; possibleClones: number };
  reasons: string[];
  nextSteps: string[];
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function assessColdStart(repos: ColdStartRepoInput[]): ColdStartAssessment {
  const forks = repos.filter((r) => r.isFork);
  const own = repos.filter((r) => !r.isFork);
  const unanalyzed = own.filter((r) => !r.analyzed);
  const possibleClones = own.filter((r) => r.analyzed && r.authenticityFlag === 'possible_tutorial_clone');
  const evidence = own.filter((r) => r.analyzed && r.authenticityFlag !== 'possible_tutorial_clone');

  const evidenceRepoCount = evidence.length;
  const depth: ProfileDepth =
    evidenceRepoCount === 0 ? 'insufficient' : evidenceRepoCount < MIN_EVIDENCE_REPOS ? 'thin' : 'sufficient';

  const reasons: string[] = [];
  const nextSteps: string[] = [];

  if (depth !== 'sufficient') {
    reasons.push(
      `Only ${plural(evidenceRepoCount, 'original analyzed repository counts', 'original analyzed repositories count')} as evidence (${MIN_EVIDENCE_REPOS} needed for a full profile).`
    );
    if (repos.length === 0) reasons.push('No repositories have been synced yet.');
    if (forks.length > 0) reasons.push(`${plural(forks.length, 'fork is', 'forks are')} excluded — forks don't show your own engineering.`);
    if (possibleClones.length > 0)
      reasons.push(`${plural(possibleClones.length, 'repository is', 'repositories are')} flagged as possible tutorial clones and excluded.`);

    if (repos.length === 0) nextSteps.push('Sync your GitHub profile to import your repositories.');
    if (unanalyzed.length > 0)
      nextSteps.push(`Analyze ${plural(unanalyzed.length, 'synced repository', 'synced repositories')} that ${unanalyzed.length === 1 ? 'has' : 'have'} no score yet.`);

    const stillNeeded = MIN_EVIDENCE_REPOS - evidenceRepoCount - Math.min(unanalyzed.length, MIN_EVIDENCE_REPOS - evidenceRepoCount);
    if (stillNeeded > 0)
      nextSteps.push(`Publish ${plural(stillNeeded, 'more original project', 'more original projects')} (not a fork or tutorial follow-along) to reach a full profile.`);

    // Most common failing signals across evidence repos -> concrete improvement targets.
    const failCounts = new Map<string, { label: string; count: number }>();
    for (const r of evidence) {
      for (const s of r.scoreBreakdown ?? []) {
        if (s.passed) continue;
        const prev = failCounts.get(s.id);
        failCounts.set(s.id, { label: s.label ?? s.id, count: (prev?.count ?? 0) + 1 });
      }
    }
    const top = [...failCounts.entries()]
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, 3);
    if (top.length > 0 && evidenceRepoCount > 0) {
      nextSteps.push(
        `In your existing work, the most common gaps are: ${top.map(([, v]) => `${v.label} (${v.count}/${evidenceRepoCount})`).join(', ')}.`
      );
    }
  }

  return {
    coldStart: depth !== 'sufficient',
    depth,
    evidenceRepoCount,
    minEvidenceRepos: MIN_EVIDENCE_REPOS,
    totals: { repos: repos.length, forks: forks.length, unanalyzed: unanalyzed.length, possibleClones: possibleClones.length },
    reasons,
    nextSteps,
  };
}
