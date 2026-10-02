import { pool } from '../config/db';
import { env } from '../config/env';
import { callGemini } from './ai/geminiClient';
import { buildGroundedStructuredPrompt, GROUNDED_SUMMARY_SCHEMA, isValidStructuredSummary } from './ai/prompts';
import { checkStructuredSummary, StructuredSummary } from './ai/groundingChecker';
import { renderStructuredSummary } from './ai/renderSummary';
import { SignalResult } from './repoAnalysis/signals';

export class RepoNotFoundError extends Error {
  constructor() {
    super('REPO_NOT_FOUND');
  }
}

export class NotYetAnalyzedError extends Error {
  constructor() {
    super('NOT_YET_ANALYZED');
  }
}

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super('GEMINI_NOT_CONFIGURED');
  }
}

export class SummaryGenerationError extends Error {
  constructor(reason: string) {
    super(`SUMMARY_GENERATION_FAILED: ${reason}`);
  }
}

/**
 * Generates the AI summary — the only AI-generated content that actually
 * ships in the product. Reuses the score_breakdown already persisted by
 * Phase 4, so this makes zero new GitHub calls, only one Gemini call (plus
 * one retry if the model's JSON is malformed).
 *
 * Uses schema-constrained structured output (see prompts.ts,
 * GROUNDED_SUMMARY_SCHEMA) rather than free prose: each signal's true
 * pass/fail status is given directly to the model, and the model's only
 * job is a short, appropriately-toned note per signal — it never has to
 * infer or implicitly convey a verdict through word choice. This is what
 * eliminates the class of grounding bugs a free-prose + regex-parsing
 * approach kept surfacing (see groundingChecker.ts for the full history).
 *
 * checkStructuredSummary still runs after generation — not to reject the
 * summary (that would make the feature unreliable), but as defense in
 * depth: a note's WORDING could still, in principle, contradict the status
 * it was told to describe. Any such contradiction surfaces as a visible
 * warning, same transparency contract as before.
 */
export async function generateSummary(userId: string, repoId: string) {
  if (!env.geminiApiKey) throw new GeminiNotConfiguredError();

  const repoRes = await pool.query(
    `SELECT * FROM repositories WHERE id = $1 AND user_id = $2`,
    [repoId, userId]
  );
  if (repoRes.rowCount === 0) throw new RepoNotFoundError();

  const repo = repoRes.rows[0];
  if (!repo.score_breakdown) throw new NotYetAnalyzedError();

  const breakdown: SignalResult[] = repo.score_breakdown;
  const prompt = buildGroundedStructuredPrompt(repo.name, repo.engineering_score, breakdown);

  const structured = await generateStructuredSummary(prompt);

  const grounding = checkStructuredSummary(structured, breakdown);
  const warnings = grounding.claims.filter((c) => c.contradicted);

  const renderedSummary = renderStructuredSummary(structured, breakdown);

  await pool.query(
    `UPDATE repositories
     SET ai_summary = $1, ai_summary_structured = $2, ai_summary_generated_at = now(), ai_grounding_warnings = $3
     WHERE id = $4`,
    [renderedSummary, JSON.stringify(structured), JSON.stringify(warnings), repoId]
  );

  return { summary: renderedSummary, structured, warnings };
}

/**
 * Calls Gemini in JSON mode and validates the shape before trusting it. A
 * schema hint (responseSchema) makes malformed output rare but not
 * impossible — retries the generation once (not just a JSON.parse retry,
 * since a malformed response isn't necessarily fixed by re-parsing the
 * same text) before giving up with a clear error.
 */
async function generateStructuredSummary(prompt: string): Promise<StructuredSummary> {
  const generationConfig = { responseMimeType: 'application/json', responseSchema: GROUNDED_SUMMARY_SCHEMA };

  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await callGemini(prompt, { generationConfig });
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue; // malformed JSON despite the schema hint — try once more
    }
    if (isValidStructuredSummary(parsed)) return parsed;
  }

  throw new SummaryGenerationError('model did not return valid structured JSON after 2 attempts');
}
