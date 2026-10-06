import { SignalResult } from '../repoAnalysis/signals';
import { Type, Schema } from '@google/genai';
import { StructuredSummary } from './groundingChecker';

/**
 * GROUNDED condition — the one actually used in the product. Gemini is
 * handed the already-computed score, breakdown, strengths, and weaknesses
 * and told explicitly not to invent anything beyond them. This is the
 * "AI narrates, doesn't judge" design from Section 10 of the design doc.
 */
export function buildGroundedPrompt(
  repoName: string,
  totalScore: number,
  breakdown: SignalResult[],
  strengths: string[],
  weaknesses: string[]
): string {
  const breakdownLines = breakdown.map((s) => `- ${s.label}: ${s.points}/${s.maxPoints} (${s.detail})`).join('\n');

  return `You are summarizing an automated code-quality analysis for the repository "${repoName}".

The analysis below was computed by a deterministic rule-based system, NOT by you. Your only job is to narrate these findings in 3-4 friendly, natural sentences for a student reviewing their own repo. You MUST NOT invent, assume, or infer anything beyond what's listed here. If a signal isn't mentioned below, don't mention it. Do not restate every line item — synthesize into a short, readable summary that mentions the overall score and the most important 1-2 strengths and weaknesses.

Overall score: ${totalScore}/100

Signal breakdown:
${breakdownLines}

Strengths: ${strengths.length > 0 ? strengths.join(' ') : 'none identified'}
Weaknesses: ${weaknesses.length > 0 ? weaknesses.join(' ') : 'none identified'}

Write the summary now.`;
}

/**
 * GROUNDED-STRUCTURED — the schema-constrained production path.
 *
 * Earlier version of this schema had the model write a note and left
 * verification to infer pass/fail from the note's WORDING (regex patterns
 * over "no"/"lacks"/"consider adding"/etc. — see checkStructuredSummary's
 * history below). That caught the wrong failure mode: the model was never
 * confused about the status — it was TOLD directly — the problem was our
 * own checker failing to recognize soft, encouraging phrasing like "you
 * might tidy this up over time" or "0 commits... a blank slate" as meaning
 * FAILED. A live run flagged 14 notes this way; all 14 were genuinely
 * correct descriptions of a failing signal, just gently worded — 0 of them
 * were real model errors. No finite keyword list closes that gap, because
 * "implies absent" is an open-ended paraphrase space, not a fixed
 * vocabulary (same lesson as the free-text checker's 13-char window proof).
 *
 * The fix: stop inferring the verdict from the note's prose at all. The
 * schema now has the model ECHO the status as a constrained enum field,
 * separate from the free-text note. Copying a label you were just handed
 * is a far easier, far more reliable task for an LLM than generating prose
 * whose implicit sentiment happens to match every pattern a regex expects.
 * Verification becomes a direct string comparison — zero heuristics, zero
 * vocabulary gaps. If the model DOES echo the wrong enum value despite
 * being told the right one, that's a genuine, unambiguous error, not a
 * guess about what its wording might have implied.
 */
export const GROUNDED_SUMMARY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: {
      type: Type.STRING,
      description: 'One warm, encouraging sentence mentioning the overall score out of 100. No other facts.',
    },
    signalNotes: {
      type: Type.ARRAY,
      description: 'Exactly one entry per signal listed in the prompt, in the same order.',
      items: {
        type: Type.OBJECT,
        properties: {
          signalId: { type: Type.STRING, description: 'Must exactly match one of the given signal ids.' },
          status: {
            type: Type.STRING,
            format: 'enum',
            enum: ['pass', 'fail'],
            description: 'Copy EXACTLY the status you were given for this signal — "pass" if PASSED, "fail" if FAILED. Do not reinterpret it.',
          },
          note: {
            type: Type.STRING,
            description:
              'ONE short, friendly sentence (max ~20 words) about this specific signal, matching the status you were given for it. No new facts beyond the label/detail provided.',
          },
        },
        required: ['signalId', 'status', 'note'],
      },
    },
    closing: {
      type: Type.STRING,
      description: 'One brief encouraging closing sentence. No new factual claims about any signal.',
    },
  },
  required: ['headline', 'signalNotes', 'closing'],
};

export function buildGroundedStructuredPrompt(repoName: string, totalScore: number, breakdown: SignalResult[]): string {
  const signalLines = breakdown
    .map((s) => `- id: "${s.id}", label: "${s.label}", status: ${s.passed ? 'PASSED' : 'FAILED'}, detail: "${s.detail}"`)
    .join('\n');

  return `You are writing a friendly summary of an automated code-quality analysis for the repository "${repoName}", for a student reviewing their own repo.

The analysis below was computed by a deterministic rule-based system, NOT by you. Each signal already has a TRUE status (PASSED or FAILED) — do not second-guess or reinterpret it, only narrate it in your own words. Do not invent, assume, or infer anything beyond the label/detail given for each signal.

Overall score: ${totalScore}/100

Signals (write exactly one note per signal, in this order):
${signalLines}

For each signal, also copy its status into the "status" field exactly as given: "pass" for PASSED, "fail" for FAILED.

For a PASSED signal: write a brief, genuine note of praise or acknowledgment.
For a FAILED signal: write a brief, encouraging note that gently flags the gap and, where natural, a short suggestion — without being discouraging. A gentle tone does not change its status: it is still "fail".

Respond with JSON matching the given schema.`;
}

/** Runtime shape-check on Gemini's JSON output before trusting it — a schema hint doesn't guarantee compliance. */
export function isValidStructuredSummary(value: unknown): value is StructuredSummary {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.headline === 'string' &&
    typeof v.closing === 'string' &&
    Array.isArray(v.signalNotes) &&
    v.signalNotes.every(
      (n) =>
        typeof n === 'object' &&
        n !== null &&
        typeof (n as any).signalId === 'string' &&
        typeof (n as any).note === 'string' &&
        ((n as any).status === 'pass' || (n as any).status === 'fail')
    )
  );
}

/**
 * NAIVE condition — experiment-only, never used in the actual product.
 * Gemini gets raw README/metadata and is asked to review from scratch,
 * the way a plain "paste your README into ChatGPT" session would work.
 * This exists purely to produce a comparison baseline for the Phase 8
 * hallucination-rate experiment.
 */
export function buildNaivePrompt(repoName: string, readmeExcerpt: string, description: string | null): string {
  return `Review this GitHub repository named "${repoName}" and write a short code-quality summary (3-4 sentences) covering what you think its strengths and weaknesses are.

Description: ${description ?? 'none provided'}

README content:
${readmeExcerpt || '(no README found)'}

Write your review now.`;
}
