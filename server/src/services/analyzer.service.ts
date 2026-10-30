import { pool } from '../config/db';
import { decrypt } from '../utils/crypto';
import { fetchRepoSignalInput } from './repoAnalysis/fetchRepoTree';
import { computeEngineeringScore } from './repoAnalysis/scoreRepo';
import { generateStrengthsAndWeaknesses } from './repoAnalysis/strengthsWeaknesses';
import { fetchCommitPatternInput } from './authenticity/fetchCommitHistory';
import { detectAuthenticity } from './authenticity/detectAuthenticity';
import { detectForRepo } from './repoAnalysis/detectForRepo';
import { FrameworkEvidence } from './repoAnalysis/detectFrameworks';

export class RepoNotFoundError extends Error {
  constructor() {
    super('REPO_NOT_FOUND');
  }
}

/**
 * Analyzes one repo belonging to userId, persists the result, and returns it.
 * Always re-analyzes on call — the caller (controller) decides whether to
 * skip this based on `last_analyzed_at`, keeping that policy decision out
 * of this service so it stays a pure "do the analysis" function.
 */
export async function analyzeRepo(userId: string, repoId: string) {
  const repoRes = await pool.query(
    `SELECT r.*, u.access_token_enc
     FROM repositories r
     JOIN users u ON u.id = r.user_id
     WHERE r.id = $1 AND r.user_id = $2`,
    [repoId, userId]
  );

  if (repoRes.rowCount === 0) throw new RepoNotFoundError();

  const repo = repoRes.rows[0];
  const accessToken = decrypt(repo.access_token_enc);
  const [owner, name] = repo.full_name.split('/');
  const defaultBranch = repo.raw_metadata?.defaultBranch ?? 'main';
  const sizeKb = repo.raw_metadata?.size ?? 0;

  const signalInput = await fetchRepoSignalInput(accessToken, owner, name, defaultBranch, sizeKb);
  const { totalScore, breakdown } = computeEngineeringScore(signalInput);
  const { strengths, weaknesses } = generateStrengthsAndWeaknesses(breakdown);

  const commitPatternInput = await fetchCommitPatternInput(
    accessToken,
    owner,
    name,
    defaultBranch,
    signalInput.files.length,
    signalInput.files
  );
  const { flag: authenticityFlag, evidence: authenticityEvidence } = detectAuthenticity(commitPatternInput);

  // Framework evidence is a bonus: if it can't be read, the rest of the analysis still stands, and a previous
  // good detection is kept (COALESCE below) rather than overwritten with "unknown".
  let detectedFrameworks: FrameworkEvidence[] | null = null;
  try {
    detectedFrameworks = await detectForRepo(accessToken, owner, name, signalInput.files);
  } catch {
    detectedFrameworks = null;
  }

  await pool.query(
    `UPDATE repositories
     SET engineering_score = $1, score_breakdown = $2, strengths = $3, weaknesses = $4, last_analyzed_at = now(),
         commit_pattern_json = $5, authenticity_flag = $6, authenticity_evidence = $7,
         detected_frameworks = COALESCE($8::jsonb, detected_frameworks)
     WHERE id = $9`,
    [
      totalScore,
      JSON.stringify(breakdown),
      JSON.stringify(strengths),
      JSON.stringify(weaknesses),
      JSON.stringify(commitPatternInput),
      authenticityFlag,
      JSON.stringify(authenticityEvidence),
      detectedFrameworks === null ? null : JSON.stringify(detectedFrameworks),
      repoId,
    ]
  );

  return { totalScore, breakdown, strengths, weaknesses, authenticityFlag, authenticityEvidence, detectedFrameworks };
}
