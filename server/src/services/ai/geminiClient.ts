import { GoogleGenAI, GenerateContentConfig } from '@google/genai';
import { env } from '../../config/env';

/**
 * Google now issues API keys prefixed "AQ." instead of the old "AIzaSy..."
 * format, but — confirmed via a real-world debugging report, not just
 * assumed — that prefix is NOT a reliable signal for which auth surface
 * the key belongs to: Google issues "AQ." keys for BOTH ordinary Developer
 * API ("Gemini API"-restricted) keys AND genuine Vertex AI Express Mode
 * keys. A key restricted to one surface gets rejected with 401
 * ACCESS_TOKEN_TYPE_UNSUPPORTED on the other — the same error either way,
 * so the symptom can't tell you which kind you have.
 *
 * So rather than guess from the prefix, each client mode is tried in
 * order and cached once one works — same pattern as the model fallback
 * chain above, for the same reason: don't hardcode an assumption about an
 * external system that's visibly still in flux.
 */
const clients: Partial<Record<'standard' | 'vertex', GoogleGenAI>> = {};

function getClient(mode: 'standard' | 'vertex'): GoogleGenAI {
  if (!clients[mode]) {
    clients[mode] = new GoogleGenAI({ apiKey: env.geminiApiKey, vertexai: mode === 'vertex' });
  }
  return clients[mode]!;
}

/** ACCESS_TOKEN_TYPE_UNSUPPORTED specifically — the key-surface-mismatch error, distinct from a genuinely bad/revoked key (plain 401 with a different reason, or no reason at all). */
function isTokenTypeMismatch(err: any): boolean {
  return String(err?.message ?? '').includes('ACCESS_TOKEN_TYPE_UNSUPPORTED');
}

// Remembers which client mode actually worked, so once we know, every
// subsequent call in this process skips straight to it instead of
// re-probing both modes every time.
let cachedWorkingMode: 'standard' | 'vertex' | null = null;

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
 * out further.
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

/** Any credential-related rejection — wrong auth surface for this key
 *  (ACCESS_TOKEN_TYPE_UNSUPPORTED) or a genuinely bad/revoked key. Handled
 *  by trying the other auth mode (see callGemini) before concluding which. */
function isAuthError(err: any): boolean {
  const status = err?.status ?? err?.response?.status ?? err?.code;
  return status === 401 || status === 403;
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
  /** Pass-through to Gemini's generation config — e.g. { responseMimeType: 'application/json', responseSchema } for schema-constrained structured output. See prompts.ts, GROUNDED_SUMMARY_SCHEMA. */
  generationConfig?: GenerateContentConfig;
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
  const modesToTry: Array<'standard' | 'vertex'> = cachedWorkingMode
    ? [cachedWorkingMode, ...(['standard', 'vertex'] as const).filter((m) => m !== cachedWorkingMode)]
    : ['standard', 'vertex'];

  const attemptsLog: string[] = [];

  for (const candidateModel of candidates) {
    let modelExhausted = false;
    let authFailuresOnThisModel = 0;

    for (const mode of modesToTry) {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await getClient(mode).models.generateContent({
            model: candidateModel,
            contents: prompt,
            config: generationConfig,
          });
          if (cachedWorkingModel !== candidateModel || cachedWorkingMode !== mode) {
            console.log(`  Gemini: using model "${candidateModel}" via ${mode === 'vertex' ? 'Vertex AI Express mode' : 'standard Developer API'}`);
            cachedWorkingModel = candidateModel;
            cachedWorkingMode = mode;
          }
          return result.text ?? '';
        } catch (err: any) {
          if (isAuthError(err)) {
            // Could be a genuine surface mismatch (this key only works in
            // the OTHER mode) or a bad key — can't tell from one attempt,
            // so record it and try the other mode before concluding anything.
            authFailuresOnThisModel++;
            attemptsLog.push(
              `${candidateModel} via ${mode}: ${isTokenTypeMismatch(err) ? 'ACCESS_TOKEN_TYPE_UNSUPPORTED (wrong auth surface for this key)' : `auth error (${err?.status ?? 'unknown'})`}`
            );
            break; // try the next mode for this same model, not a retry of this one
          }

          if (isModelUnavailableError(err)) {
            attemptsLog.push(`${candidateModel}: unavailable/retired (404)`);
            modelExhausted = true;
            if (cachedWorkingModel === candidateModel) cachedWorkingModel = null;
            break;
          }

          if (isRateLimitError(err)) {
            attemptsLog.push(`${candidateModel}: quota exhausted (429)`);
            modelExhausted = true;
            if (cachedWorkingModel === candidateModel) cachedWorkingModel = null;
            break;
          }

          if (isOverloadedError(err)) {
            if (attempt < maxRetries) {
              const backoff = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
              const delay = Math.round(backoff + Math.random() * backoff * 0.3); // up to 30% jitter
              console.warn(`  Gemini: "${candidateModel}" overloaded (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
              await sleep(delay);
              continue;
            }
            attemptsLog.push(`${candidateModel} via ${mode}: still overloaded after ${maxRetries + 1} attempts`);
            modelExhausted = true; // overload is a model property, not an auth-mode property — trying the other mode won't help
            break;
          }

          // Unrecognized error (bad prompt, malformed schema, etc.) — don't mask
          // it by silently working through every candidate model/mode.
          throw err;
        }
      }
      if (modelExhausted) break;
    }

    if (authFailuresOnThisModel >= modesToTry.length) {
      // Both auth surfaces rejected the SAME model — this isn't model-specific,
      // so trying 3 more models would just repeat the same failure 3 more times.
      throw new Error(
        `Gemini rejected this API key on both auth surfaces it tried:\n  ${attemptsLog.join('\n  ')}\n\n` +
          `This key isn't currently valid on either the standard Developer API or Vertex AI Express mode. ` +
          `Regenerate a key at aistudio.google.com, or — if you intend to use Vertex AI Express specifically — ` +
          `complete its explicit sign-up at console.cloud.google.com/vertex-ai ("Try Vertex AI Studio free") ` +
          `and use the key generated during THAT signup; a key from ordinary AI Studio isn't automatically enrolled.`
      );
    }
  }

  throw new Error(
    `All Gemini model candidates failed:\n  ${attemptsLog.join('\n  ')}\n` +
      `Tried: ${candidates.join(', ')} across both auth modes. Set GEMINI_MODEL_CANDIDATES in .env to override models.`
  );
}
