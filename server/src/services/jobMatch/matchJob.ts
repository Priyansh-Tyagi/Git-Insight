import { DetectedSkill, Importance } from './extractSkills';
import { classifyTrend, daysSince } from '../skills/inferSkills';

export type Trend = 'growing' | 'stable' | 'stale';
export type EvidenceQuality = 'strong' | 'moderate' | 'weak' | 'none';
export type VerificationMethod = 'languages' | 'dependencies';

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

/** A framework/library skill seen in the dependency files of scanned repositories. */
export interface FrameworkSkillEvidence {
  skill: string;
  repos: (RepoRef & { pushedAt: string | null })[];
  via: string[];
}

export interface Coverage {
  scannedRepos: number;
  totalRepos: number;
}

export type RequirementStatus = 'matched' | 'weak' | 'gap' | 'unverifiable';

export interface RequirementMatch {
  skill: string;
  category: string;
  importance: Importance;
  /** True when the skill is counted in the percentage (checked via languages or dependency files). */
  verifiable: boolean;
  /** Could be checked from dependency files — used by the UI to offer a repository scan. */
  frameworkVerifiable: boolean;
  /** Checkable from dependency files, but no repository has been scanned yet. */
  needsScan: boolean;
  method: VerificationMethod | null;
  status: RequirementStatus;
  quality: EvidenceQuality | null;
  strengthScore: number | null;
  trend: Trend | null;
  credit: number | null; // 0-1, only for checked requirements
  evidenceRepos: RepoRef[];
  /** For dependency evidence: e.g. "server/package.json: express". */
  via: string[];
  relatedEvidence: { skill: string; strengthScore: number }[]; // indirect support for unchecked skills
  /** 'implied' = not named in the posting, inferred from the work it describes (never scored). */
  origin: 'explicit' | 'implied';
  cues: string[];
}

export type ClaimStatus = 'supported' | 'weak' | 'unsupported' | 'unverifiable';

export interface ClaimCheck {
  skill: string;
  status: ClaimStatus;
  method: VerificationMethod | null;
  strengthScore: number | null;
  evidenceRepos: RepoRef[];
}

/** One row of the three-way comparison: what the job asks, what the resume claims, what GitHub shows. */
export interface ComparisonRow {
  skill: string;
  inJob: boolean;
  inResume: boolean;
  github: ClaimStatus;
}

export interface JobMatchResult {
  matchPercent: number | null;
  counts: {
    requirements: number;
    verifiable: number;
    unverifiable: number;
    matched: number;
    weak: number;
    gap: number;
    dependencyChecked: number;
    needsScan: number;
  };
  coverage: Coverage;
  requirements: RequirementMatch[];
  resumeClaims: { checks: ClaimCheck[]; counts: Record<ClaimStatus, number> } | null;
  /** Job x resume x GitHub, only when a resume was supplied. Only GitHub counts as proof. */
  comparison: ComparisonRow[] | null;
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

/**
 * Dependency evidence has no numeric strength, so quality is about how many original projects use the library:
 * two or more is a pattern (strong), one is a start (moderate), forks/clones only is weak.
 */
export function frameworkQuality(evidence: FrameworkSkillEvidence | undefined): EvidenceQuality {
  if (!evidence || evidence.repos.length === 0) return 'none';
  const originals = evidence.repos.filter(isOriginal).length;
  if (originals === 0) return 'weak';
  return originals >= 2 ? 'strong' : 'moderate';
}

/** Same thresholds as the skill radar (growing <= 60 days, stable <= 180, otherwise stale). */
export function frameworkTrend(evidence: FrameworkSkillEvidence | undefined): Trend | null {
  if (!evidence) return null;
  const pool = evidence.repos.some(isOriginal) ? evidence.repos.filter(isOriginal) : evidence.repos;
  const times = pool.map((r) => (r.pushedAt ? Date.parse(r.pushedAt) : NaN)).filter((t) => !Number.isNaN(t));
  if (times.length === 0) return null;
  return classifyTrend(daysSince(new Date(Math.max(...times)).toISOString()));
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
  /** null = no repository has been scanned for dependency files yet. */
  frameworkEvidence?: FrameworkSkillEvidence[] | null;
  coverage?: Coverage;
}

export function matchJob({ requirements, resumeSkills, userSkills, frameworkEvidence = null, coverage = { scannedRepos: 0, totalRepos: 0 } }: MatchInput): JobMatchResult {
  const bySkill = new Map(userSkills.map((s) => [s.skill, s]));
  const byFramework = frameworkEvidence ? new Map(frameworkEvidence.map((f) => [f.skill, f])) : null;

  const base = (req: DetectedSkill) => ({
    skill: req.skill,
    category: req.category,
    importance: req.importance,
    frameworkVerifiable: req.frameworkVerifiable,
    origin: req.origin,
    cues: req.cues,
  });

  const matches: RequirementMatch[] = requirements.map((req) => {
    if (req.verifiable) {
      const evidence = bySkill.get(req.skill);
      const quality = evidenceQuality(evidence);
      return {
        ...base(req), verifiable: true, needsScan: false, method: 'languages' as const,
        status: statusFor(quality), quality,
        strengthScore: evidence?.strengthScore ?? null, trend: evidence?.trend ?? null,
        credit: creditFor(quality, evidence?.trend ?? null),
        evidenceRepos: evidence?.repos ?? [], via: [], relatedEvidence: [],
      };
    }

    if (req.frameworkVerifiable && byFramework) {
      const evidence = byFramework.get(req.skill);
      const quality = frameworkQuality(evidence);
      const trend = frameworkTrend(evidence);
      return {
        ...base(req), verifiable: true, needsScan: false, method: 'dependencies' as const,
        status: statusFor(quality), quality, strengthScore: null, trend,
        credit: creditFor(quality, trend),
        evidenceRepos: evidence?.repos.map(({ pushedAt: _p, ...ref }) => ref) ?? [], via: evidence?.via ?? [], relatedEvidence: [],
      };
    }

    const related = req.related.map((r) => bySkill.get(r)).filter((s): s is UserSkillEvidence => !!s && s.repos.some(isOriginal));
    return {
      ...base(req), verifiable: false, needsScan: req.frameworkVerifiable, method: null,
      status: 'unverifiable' as const, quality: null, strengthScore: null, trend: null, credit: null,
      evidenceRepos: [], via: [],
      relatedEvidence: related.map((s) => ({ skill: s.skill, strengthScore: s.strengthScore })),
    };
  });

  const checked = matches.filter((m) => m.verifiable);
  const weightSum = checked.reduce((s, m) => s + WEIGHT[m.importance], 0);
  const matchPercent =
    weightSum === 0 ? null : Math.round((checked.reduce((s, m) => s + WEIGHT[m.importance] * (m.credit ?? 0), 0) / weightSum) * 100);

  const counts = {
    requirements: matches.length,
    verifiable: checked.length,
    unverifiable: matches.length - checked.length,
    matched: matches.filter((m) => m.status === 'matched').length,
    weak: matches.filter((m) => m.status === 'weak').length,
    gap: matches.filter((m) => m.status === 'gap').length,
    dependencyChecked: matches.filter((m) => m.method === 'dependencies').length,
    needsScan: matches.filter((m) => m.needsScan).length,
  };

  const resumeClaims = resumeSkills ? checkClaims(resumeSkills.filter((s) => s.origin === 'explicit'), bySkill, byFramework) : null;

  return {
    matchPercent, counts, coverage, requirements: matches, resumeClaims,
    comparison: resumeSkills ? buildComparison(requirements, resumeSkills, bySkill, byFramework) : null,
    nextSteps: buildNextSteps(matches, coverage),
    notes: buildNotes(matches, counts, coverage),
  };
}

function buildComparison(
  job: DetectedSkill[], resume: DetectedSkill[], bySkill: Map<string, UserSkillEvidence>, byFramework: Map<string, FrameworkSkillEvidence> | null
): ComparisonRow[] {
  const inJob = new Set(job.filter((s) => s.origin === 'explicit').map((s) => s.skill));
  const inResume = new Set(resume.filter((s) => s.origin === 'explicit').map((s) => s.skill));
  const union = new Map<string, DetectedSkill>();
  for (const s of [...job, ...resume]) if (s.origin === 'explicit' && !union.has(s.skill)) union.set(s.skill, s);
  const { checks } = checkClaims([...union.values()], bySkill, byFramework);
  const rank = (r: ComparisonRow) => (r.inJob && r.inResume ? 0 : r.inJob ? 1 : 2);
  return checks
    .map((c) => ({ skill: c.skill, inJob: inJob.has(c.skill), inResume: inResume.has(c.skill), github: c.status }))
    .sort((a, b) => rank(a) - rank(b) || a.skill.localeCompare(b.skill));
}

function buildNotes(matches: RequirementMatch[], counts: JobMatchResult['counts'], coverage: Coverage): string[] {
  const notes: string[] = [];
  if (matches.length === 0) {
    notes.push('No recognizable skills were found in the job description.');
    return notes;
  }
  if (counts.verifiable === 0) {
    notes.push(
      counts.needsScan > 0
        ? 'None of the skills in this posting can be checked yet — scan your repositories so frameworks can be checked from their dependency files.'
        : 'None of the skills in this posting can be verified from GitHub language data, so no match percentage is shown.'
    );
  }
  if (counts.dependencyChecked > 0) {
    notes.push(
      `Frameworks are checked from the dependency files of the ${coverage.scannedRepos} of ${coverage.totalRepos} repositories scanned so far. ` +
        'A declared dependency shows a project uses a library, not how well you know it.' +
        (coverage.scannedRepos < coverage.totalRepos ? ' Scan the rest to avoid false gaps.' : '')
    );
  }
  if (matches.some((m) => m.status === 'unverifiable' && !m.needsScan)) {
    notes.push("Skills GitHub data can't prove (for example Linux or REST API design) are listed separately and left out of the percentage.");
  }
  return notes;
}

function checkClaims(resumeSkills: DetectedSkill[], bySkill: Map<string, UserSkillEvidence>, byFramework: Map<string, FrameworkSkillEvidence> | null) {
  const checks: ClaimCheck[] = resumeSkills.map((s) => {
    if (s.verifiable) {
      const evidence = bySkill.get(s.skill);
      const q = evidenceQuality(evidence);
      return { skill: s.skill, method: 'languages' as const, status: claimStatus(q), strengthScore: evidence?.strengthScore ?? null, evidenceRepos: evidence?.repos ?? [] };
    }
    if (s.frameworkVerifiable && byFramework) {
      const evidence = byFramework.get(s.skill);
      return {
        skill: s.skill, method: 'dependencies' as const, status: claimStatus(frameworkQuality(evidence)), strengthScore: null,
        evidenceRepos: evidence?.repos.map(({ pushedAt: _p, ...ref }) => ref) ?? [],
      };
    }
    return { skill: s.skill, method: null, status: 'unverifiable' as const, strengthScore: null, evidenceRepos: [] };
  });
  const counts: Record<ClaimStatus, number> = { supported: 0, weak: 0, unsupported: 0, unverifiable: 0 };
  for (const c of checks) counts[c.status]++;
  return { checks, counts };
}

const claimStatus = (q: EvidenceQuality): ClaimStatus => (q === 'strong' || q === 'moderate' ? 'supported' : q === 'weak' ? 'weak' : 'unsupported');

const MAX_STEPS = 6;

function buildNextSteps(matches: RequirementMatch[], coverage: Coverage): string[] {
  const steps: string[] = [];
  const byImportance = (a: RequirementMatch, b: RequirementMatch) => Number(b.importance === 'required') - Number(a.importance === 'required');

  const needScan = matches.filter((m) => m.needsScan);
  if (needScan.length > 0) {
    const names = needScan.slice(0, 4).map((m) => m.skill).join(', ');
    const list = `${names}${needScan.length > 4 ? ' and others' : ''}`;
    steps.push(
      coverage.totalRepos === 0
        ? `Sync your GitHub repositories and scan them so GitHub can check ${list} from their dependency files.`
        : `Scan your repositories (${coverage.scannedRepos} of ${coverage.totalRepos} done) so GitHub can check ${list} from their dependency files.`
    );
  }
  for (const m of matches.filter((x) => x.status === 'gap').sort(byImportance)) {
    steps.push(
      m.method === 'dependencies'
        ? `Build and publish an original project that uses ${m.skill} — the posting asks for it and none of your scanned repositories declare it.`
        : `Build and publish an original project that uses ${m.skill} — the posting asks for it and your GitHub shows none.`
    );
  }
  for (const m of matches.filter((x) => x.status === 'weak').sort(byImportance)) {
    steps.push(`Your ${m.skill} evidence is only in forks or tutorial-flagged repositories — publish an original ${m.skill} project so it counts.`);
  }
  for (const m of matches.filter((x) => x.status === 'matched' && x.trend === 'stale').sort(byImportance)) {
    steps.push(`Your ${m.skill} activity is stale — ship something recent with it.`);
  }
  const unverifiable = matches.filter((x) => x.status === 'unverifiable' && !x.needsScan);
  if (unverifiable.length > 0) {
    const names = unverifiable.slice(0, 4).map((x) => x.skill).join(', ');
    steps.push(`GitHub can't verify ${names}${unverifiable.length > 4 ? ' and others' : ''} — describe concrete projects using them in your resume.`);
  }
  return steps.slice(0, MAX_STEPS);
}
