import { DetectedSkill, Importance } from './extractSkills';

export type Trend = 'growing' | 'stable' | 'stale';
export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'none';

export interface RepoRef {
  id: string;
  name: string;
  isFork: boolean;
  isClone: boolean; // authenticity flag possible_tutorial_clone
}

export interface UserSkillEvidence {
  skill: string;
  strengthScore: number;
  trend: Trend;
  repoCount: number;
  repos: RepoRef[];
}

export type RequirementStatus = 'matched' | 'weak' | 'gap' | 'unverifiable';

export interface RequirementMatch {
  skill: string;
  category: string;
  importance: Importance;
  verifiable: boolean;
  status: RequirementStatus;
  quality: EvidenceQuality | null;
  strengthScore: number | null;
  trend: Trend | null;
  credit: number | null; // 0-1, only for verifiable requirements
  evidenceRepos: RepoRef[];
  relatedEvidence: { skill: string; strengthScore: number }[]; // indirect support for unverifiable skills
}

export type ClaimStatus = 'supported' | 'weak' | 'unsupported' | 'unverifiable';

export interface ClaimCheck {
  skill: string;
  status: ClaimStatus;
  strengthScore: number | null;
  evidenceRepos: RepoRef[];
}

export interface JobMatchResult {
  matchPercent: number | null;
  counts: { requirements: number; verifiable: number; unverifiable: number; matched: number; weak: number; gap: number };
  requirements: RequirementMatch[];
  resumeClaims: { checks: ClaimCheck[]; counts: Record<ClaimStatus, number> } | null;
  nextSteps: string[];
  notes: string[];
}

export const STRONG_THRESHOLD = 60;
const QUALITY_CREDIT: Record<EvidenceQuality, number> = { strong: 1, moderate: 0.6, weak: 0.25, none: 0 };
const STALE_FACTOR = 0.7;
const WEIGHT: Record<Importance, number> = { required: 2, preferred: 1 };

/** "Original" evidence = a repo that is neither a fork nor flagged as a possible tutorial clone. */
export const isOriginal = (r: RepoRef) => !r.isFork && !r.isClone;

export function evidenceQuality(evidence: UserSkillEvidence | undefined): EvidenceQuality {
  if (!evidence || evidence.repos.length === 0) return 'none';
  if (!evidence.repos.some(isOriginal)) return 'weak';
  return evidence.strengthScore >= STRONG_THRESHOLD ? 'strong' : 'moderate';
}

function creditFor(quality: EvidenceQuality, trend: Trend | null): number {
  const base = QUALITY_CREDIT[quality];
  return quality !== 'none' && trend === 'stale' ? base * STALE_FACTOR : base;
}

const statusFor = (q: EvidenceQuality): RequirementStatus => (q === 'strong' || q === 'moderate' ? 'matched' : q === 'weak' ? 'weak' : 'gap');

export interface MatchInput {
  requirements: DetectedSkill[];
  resumeSkills: DetectedSkill[] | null;
  userSkills: UserSkillEvidence[];
}

export function matchJob({ requirements, resumeSkills, userSkills }: MatchInput): JobMatchResult {
  const bySkill = new Map(userSkills.map((s) => [s.skill, s]));

  const matches: RequirementMatch[] = requirements.map((req) => {
    if (!req.verifiable) {
      const related = req.related.map((r) => bySkill.get(r)).filter((s): s is UserSkillEvidence => !!s && s.repos.some(isOriginal));
      return {
        skill: req.skill, category: req.category, importance: req.importance, verifiable: false,
        status: 'unverifiable', quality: null, strengthScore: null, trend: null, credit: null, evidenceRepos: [],
        relatedEvidence: related.map((s) => ({ skill: s.skill, strengthScore: s.strengthScore })),
      };
    }
    const evidence = bySkill.get(req.skill);
    const quality = evidenceQuality(evidence);
    return {
      skill: req.skill, category: req.category, importance: req.importance, verifiable: true,
      status: statusFor(quality), quality,
      strengthScore: evidence?.strengthScore ?? null, trend: evidence?.trend ?? null,
      credit: creditFor(quality, evidence?.trend ?? null),
      evidenceRepos: evidence?.repos ?? [], relatedEvidence: [],
    };
  });

  const verifiable = matches.filter((m) => m.verifiable);
  const weightSum = verifiable.reduce((s, m) => s + WEIGHT[m.importance], 0);
  const matchPercent =
    weightSum === 0 ? null : Math.round((verifiable.reduce((s, m) => s + WEIGHT[m.importance] * (m.credit ?? 0), 0) / weightSum) * 100);

  const counts = {
    requirements: matches.length,
    verifiable: verifiable.length,
    unverifiable: matches.length - verifiable.length,
    matched: matches.filter((m) => m.status === 'matched').length,
    weak: matches.filter((m) => m.status === 'weak').length,
    gap: matches.filter((m) => m.status === 'gap').length,
  };

  const resumeClaims = resumeSkills ? checkClaims(resumeSkills, bySkill) : null;

  const notes: string[] = [];
  if (matches.length === 0) notes.push('No recognizable skills were found in the job description.');
  else if (verifiable.length === 0) notes.push('None of the skills in this posting can be verified from GitHub language data, so no match percentage is shown.');
  if (counts.unverifiable > 0) {
    notes.push('Frameworks, cloud and databases cannot be proven from language data, so they are listed separately and left out of the percentage.');
  }

  return { matchPercent, counts, requirements: matches, resumeClaims, nextSteps: buildNextSteps(matches), notes };
}

function checkClaims(resumeSkills: DetectedSkill[], bySkill: Map<string, UserSkillEvidence>) {
  const checks: ClaimCheck[] = resumeSkills.map((s) => {
    if (!s.verifiable) return { skill: s.skill, status: 'unverifiable' as const, strengthScore: null, evidenceRepos: [] };
    const evidence = bySkill.get(s.skill);
    const q = evidenceQuality(evidence);
    const status: ClaimStatus = q === 'strong' || q === 'moderate' ? 'supported' : q === 'weak' ? 'weak' : 'unsupported';
    return { skill: s.skill, status, strengthScore: evidence?.strengthScore ?? null, evidenceRepos: evidence?.repos ?? [] };
  });
  const counts: Record<ClaimStatus, number> = { supported: 0, weak: 0, unsupported: 0, unverifiable: 0 };
  for (const c of checks) counts[c.status]++;
  return { checks, counts };
}

const MAX_STEPS = 6;

function buildNextSteps(matches: RequirementMatch[]): string[] {
  const steps: string[] = [];
  const byImportance = (a: RequirementMatch, b: RequirementMatch) => Number(b.importance === 'required') - Number(a.importance === 'required');

  for (const m of matches.filter((x) => x.status === 'gap').sort(byImportance)) {
    steps.push(`Build and publish an original project that uses ${m.skill} — the posting asks for it and your GitHub shows none.`);
  }
  for (const m of matches.filter((x) => x.status === 'weak').sort(byImportance)) {
    steps.push(`Your ${m.skill} evidence is only in forks or tutorial-flagged repositories — publish an original ${m.skill} project so it counts.`);
  }
  for (const m of matches.filter((x) => x.status === 'matched' && x.trend === 'stale').sort(byImportance)) {
    steps.push(`Your ${m.skill} activity is stale — ship something recent with it.`);
  }
  const unverifiable = matches.filter((x) => x.status === 'unverifiable');
  if (unverifiable.length > 0) {
    const names = unverifiable.slice(0, 4).map((x) => x.skill).join(', ');
    steps.push(`GitHub can't verify ${names}${unverifiable.length > 4 ? ' and others' : ''} — describe concrete projects using them in your resume.`);
  }
  return steps.slice(0, MAX_STEPS);
}
