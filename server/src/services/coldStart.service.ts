import { pool } from '../config/db';
import { assessColdStart, ColdStartAssessment, ColdStartRepoInput } from './coldStart/assessColdStart';

/** Reads already-synced/analyzed rows only — no GitHub calls, safe to compute on every dashboard load. */
export async function getColdStartAssessment(userId: string): Promise<ColdStartAssessment> {
  const res = await pool.query(
    `SELECT is_fork, engineering_score, authenticity_flag, score_breakdown FROM repositories WHERE user_id = $1`,
    [userId]
  );
  const inputs: ColdStartRepoInput[] = res.rows.map((row) => ({
    isFork: row.is_fork === true,
    analyzed: row.engineering_score !== null && row.engineering_score !== undefined,
    authenticityFlag: row.authenticity_flag ?? null,
    scoreBreakdown: Array.isArray(row.score_breakdown) ? row.score_breakdown : null,
  }));
  return assessColdStart(inputs);
}
