import { pool } from '../config/db';
import { inferSkills, RepoSkillInput, SkillResult } from './skills/inferSkills';
import { aggregateByCategory, CategoryScore } from './skills/aggregateByCategory';

/**
 * Computes skills entirely from data already in Postgres — repos synced in
 * Phase 2 (language_stats) and analyzed in Phase 4 (score_breakdown). No
 * GitHub API calls happen here, so this is cheap enough to recompute on
 * every dashboard load rather than needing its own sync/TTL policy.
 */
export async function computeAndPersistSkills(
  userId: string
): Promise<{ skills: SkillResult[]; categories: CategoryScore[] }> {
  const repoRes = await pool.query(
    `SELECT id, language_stats, raw_metadata, score_breakdown FROM repositories WHERE user_id = $1`,
    [userId]
  );

  const repoInputs: RepoSkillInput[] = repoRes.rows.map((row) => ({
    id: row.id,
    languageStats: row.language_stats ?? {},
    pushedAt: row.raw_metadata?.pushedAt ?? new Date(0).toISOString(),
    passedSignalIds: Array.isArray(row.score_breakdown)
      ? row.score_breakdown.filter((s: any) => s.passed).map((s: any) => s.id)
      : [],
  }));

  const skills = inferSkills(repoInputs);
  const categories = aggregateByCategory(skills);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM user_skills WHERE user_id = $1`, [userId]);

    for (const skill of skills) {
      await client.query(
        `INSERT INTO user_skills (user_id, skill, category, strength_score, trend, repo_count, evidence_repo_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, skill.skill, skill.category, skill.strengthScore, skill.trend, skill.repoCount, JSON.stringify(skill.evidenceRepoIds)]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { skills, categories };
}
