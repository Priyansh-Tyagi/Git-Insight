import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';
import { env } from '../../config/env';

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!client) {
    client = new GoogleGenerativeAI(env.geminiApiKey);
  }
  return client;
}

/**
 * Why a fallback CHAIN instead of one configured model:
 *
 * Over the course of building this phase, THREE different model IDs died
 * out from under us — gemini-1.5-flash (retired, 404), gemini-2.0-flash
 * (retired, 404), gemini-2.5-flash ("no longer available to new users",
 * 404). Google rotates its free-tier lineup every few weeks. Hardcoding a
 * single model string means this script breaks again the next time Google
 * retires whatever we pick today, with no way to tell without a live run.
 *
 * The fix: try a small ordered list of candidates and fail over between
 * them within a single call. Flash-Lite variants are listed first — as of
 * Sept 2026 they carry a ~500 requests/day free-tier quota vs. ~20/day for
 * the full Flash models, which is what actually caused the 429s (retrying
 * a 20/day quota, however cleverly, never gets you more than 20 calls).
 *
 * Override the whole list via GEMINI_MODEL_CANDIDATES in .env (comma
 * separated) if this list itself goes stale — no code change needed.
 */
const DEFAULT_MODEL_CANDIDATES = [
  'gemini-3.5-flash-lite', // ~500 req/day free tier — best fit for batch work
  'gemini-3.1-flash-lite', // same tier, alternate generation
  'gemini-3.6-flash',      // fuller model, ~20 req/day free tier
  'gemini-3.8-flash',      // newest, same ~20 req/day free tier
];

/** A 404 meaning the model name itself is retired/unavailable — not a rate limit,
 *  not a transient overload. No amount of retrying fixes this; move to the next candidate. */
function isModelUnavailableError(err: any): boolean {
  const status = err?.status ?? err?.response?.status ?? err?.code;
  const message = String(err?.message ?? '').toLowerCase();
  return (
    status === 404 ||
    message.includes('is no longer available') ||
    message.includes('not found') ||
    message.includes('not_found')
  );
}

/**
 * Gemini returns a 503 ("model is overloaded, please try again later") when
 * the model is busy — this is distinct from a 429 (quota/rate-limit) error
 * and needs a different fix: retrying shortly after, not just spacing calls
 * out further. The SDK surfaces this as an error whose `status` is 503, or
 * whose message contains "overloaded" / "UNAVAILABLE" depending on version.
 */
function isOverloadedError(err: any): boolean {
  const status = err?.status ?? err?.response?.status ?? err?.code;
  const message = String(err?.message ?? '').toLowerCase();
  return (
    status === 503 ||
    message.includes('overloaded') ||
    message.includes('unavailable') ||
    message.includes('service unavailable')
  );
}

/** A 429 — daily/per-minute quota exhausted for THIS model specifically.
 *  Different models have separate quota buckets, so falling over to the
 *  next candidate often succeeds immediately rather than needing a wait. */
function isRateLimitError(err: any): boolean {
  const status = err?.status ?? err?.response?.status ?? err?.code;
  const message = String(err?.message ?? '').toLowerCase();
  return status === 429 || message.includes('quota') || message.includes('rate limit');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CallGeminiOptions {
  /** Max retry attempts on a transient (503 overload) error, PER candidate model. Default 3. */
  maxRetries?: number;
  /** Base delay in ms before the first retry; doubles each attempt. Default 2000. */
  baseDelayMs?: number;
  /** Upper bound on the backoff delay, so it doesn't grow unbounded. Default 30000. */
  maxDelayMs?: number;
  /** Force a single specific model for this call, skipping the fallback chain entirely. */
  model?: string;
  /** Pass-through to Gemini's generationConfig — e.g. { responseMimeType: 'application/json', responseSchema } for schema-constrained structured output. See prompts.ts, GROUNDED_SUMMARY_SCHEMA. */
  generationConfig?: GenerationConfig;
}

// Remembers the first candidate that worked in this process, so subsequent
// calls in the same run skip straight past models we already know are dead
// — without needing to re-discover that on every single request. Reset to
// null if the cached model itself later fails (e.g. its quota runs out
// mid-run), so we fall back further rather than getting stuck.
let cachedWorkingModel: string | null = null;

function buildCandidateList(forcedModel?: string): string[] {
  if (forcedModel) return [forcedModel];

  const configured = env.geminiModelCandidates.length > 0 ? env.geminiModelCandidates : DEFAULT_MODEL_CANDIDATES;
  if (!cachedWorkingModel) return configured;

  // Known-good model first, then the rest (minus a duplicate), as a safety
  // net in case the cached one has since run out of quota.
  return [cachedWorkingModel, ...configured.filter((m) => m !== cachedWorkingModel)];
}

/**
 * The ONE place in the codebase that calls Gemini. Every AI-generated
 * summary in the product goes through this function — makes it trivial to
 * audit, swap models, or add logging/rate-limiting in one place rather than
 * hunting for scattered API calls.
 *
 * Tries each candidate model in order. Within a candidate: retries with
 * exponential backoff + jitter on a transient 503 (overloaded); a 429
 * (quota) or 404 (model retired/unavailable) moves immediately to the next
 * candidate instead of burning retries on an error retrying can't fix.
 * Any other error type fails immediately — silently trying every model on
 * an unrecognized error would hide real bugs (bad prompt, auth failure).
 */
export async function callGemini(prompt: string, options: CallGeminiOptions = {}): Promise<string> {
  const { maxRetries = 3, baseDelayMs = 2000, maxDelayMs = 30000, model: modelOverride, generationConfig } = options;
  const candidates = buildCandidateList(modelOverride);

  const attemptsLog: string[] = [];

  for (const candidateModel of candidates) {
    const model = getClient().getGenerativeModel({ model: candidateModel, generationConfig });

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await model.generateContent(prompt);
        if (cachedWorkingModel !== candidateModel) {
          console.log(`  Gemini: using model "${candidateModel}"`);
          cachedWorkingModel = candidateModel;
        }
        return result.response.text();
      } catch (err: any) {
        if (isModelUnavailableError(err)) {
          attemptsLog.push(`${candidateModel}: unavailable/retired (404)`);
          if (cachedWorkingModel === candidateModel) cachedWorkingModel = null;
          break; // next candidate — no point retrying a dead model name
        }

        if (isRateLimitError(err)) {
          attemptsLog.push(`${candidateModel}: quota exhausted (429)`);
          if (cachedWorkingModel === candidateModel) cachedWorkingModel = null;
          break; // next candidate — different model, separate quota bucket
        }

        if (isOverloadedError(err)) {
          if (attempt < maxRetries) {
            const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
            const delay = Math.round(backoff + Math.random() * backoff * 0.3); // up to 30% jitter
            console.warn(`  Gemini: "${candidateModel}" overloaded (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }
          attemptsLog.push(`${candidateModel}: still overloaded after ${maxRetries + 1} attempts`);
          break; // next candidate
        }

        // Unrecognized error (bad prompt, auth failure, etc.) — don't mask
        // it by silently working through every candidate model.
        throw err;
      }
    }
  }

  throw new Error(
    `All Gemini model candidates failed:\n  ${attemptsLog.join('\n  ')}\n` +
      `Tried: ${candidates.join(', ')}. Set GEMINI_MODEL_CANDIDATES in .env to override.`
  );
}
