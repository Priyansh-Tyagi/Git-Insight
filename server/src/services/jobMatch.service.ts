import { pool } from '../config/db';
import { computeSkills } from './skillsInference.service';
import { extractSkills } from './jobMatch/extractSkills';
import { matchJob, FrameworkSkillEvidence, JobMatchResult, RepoRef, UserSkillEvidence } from './jobMatch/matchJob';

/**
 * Compares a pasted job description (and optionally a resume) with the user's GitHub-derived skills.
 * Read-only and deterministic: no GitHub or AI calls, and the pasted text is never stored or logged.
 */
export async function getJobMatch(userId: string, jobDescription: string, resume: string | null): Promise<JobMatchResult> {
  const { skills } = await computeSkills(userId);

  const repoRes = await pool.query(
    `SELECT id, name, is_fork, authenticity_flag, detected_frameworks, raw_metadata->>'pushedAt' AS pushed_at
     FROM repositories WHERE user_id = $1`,
    [userId]
  );
  const refs = new Map<string, RepoRef>();
  for (const r of repoRes.rows) {
    refs.set(r.id, { id: r.id, name: r.name, isFork: r.is_fork === true, isClone: r.authenticity_flag === 'possible_tutorial_clone' });
  }

  const userSkills: UserSkillEvidence[] = skills.map((s) => ({
    skill: s.skill,
    strengthScore: s.strengthScore,
    trend: s.trend,
    repoCount: s.repoCount,
    repos: s.evidenceRepoIds.map((id) => refs.get(id)).filter((r): r is RepoRef => !!r),
  }));

  // Only repositories that have actually been scanned (detected_frameworks is an array, even an empty one) count.
  const scanned = repoRes.rows.filter((r) => Array.isArray(r.detected_frameworks));
  const bySkill = new Map<string, FrameworkSkillEvidence>();
  for (const r of scanned) {
    for (const item of r.detected_frameworks as unknown[]) {
      const f = item as { skill?: unknown; via?: unknown };
      if (typeof f?.skill !== 'string') continue; // jsonb is untrusted shape — ignore anything malformed
      const entry = bySkill.get(f.skill) ?? { skill: f.skill, repos: [], via: [] };
      entry.repos.push({ ...refs.get(r.id)!, pushedAt: r.pushed_at ?? null });
      for (const v of Array.isArray(f.via) ? f.via : []) {
        if (typeof v === 'string' && entry.via.length < 3 && !entry.via.includes(`${r.name}/${v}`)) entry.via.push(`${r.name}/${v}`);
      }
      bySkill.set(f.skill, entry);
    }
  }

  return matchJob({
    requirements: extractSkills(jobDescription),
    resumeSkills: resume ? extractSkills(resume) : null,
    userSkills,
    frameworkEvidence: scanned.length > 0 ? [...bySkill.values()] : null,
    coverage: { scannedRepos: scanned.length, totalRepos: repoRes.rows.length },
  });
}
