import { pool } from '../config/db';
import { computeSkills } from './skillsInference.service';
import { extractSkills } from './jobMatch/extractSkills';
import { matchJob, JobMatchResult, RepoRef, UserSkillEvidence } from './jobMatch/matchJob';

/**
 * Compares a pasted job description (and optionally a resume) with the user's GitHub-derived skills.
 * Read-only and deterministic: no GitHub or AI calls, and the pasted text is never stored or logged.
 */
export async function getJobMatch(userId: string, jobDescription: string, resume: string | null): Promise<JobMatchResult> {
  const { skills } = await computeSkills(userId);

  const repoRes = await pool.query(
    `SELECT id, name, is_fork, authenticity_flag FROM repositories WHERE user_id = $1`,
    [userId]
  );
  const repoById = new Map<string, RepoRef>(
    repoRes.rows.map((r) => [
      r.id,
      { id: r.id, name: r.name, isFork: r.is_fork === true, isClone: r.authenticity_flag === 'possible_tutorial_clone' },
    ])
  );

  const userSkills: UserSkillEvidence[] = skills.map((s) => ({
    skill: s.skill,
    strengthScore: s.strengthScore,
    trend: s.trend,
    repoCount: s.repoCount,
    repos: s.evidenceRepoIds.map((id) => repoById.get(id)).filter((r): r is RepoRef => !!r),
  }));

  return matchJob({
    requirements: extractSkills(jobDescription),
    resumeSkills: resume ? extractSkills(resume) : null,
    userSkills,
  });
}
