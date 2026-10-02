import { SignalResult } from '../repoAnalysis/signals';
import { SchemaType, Schema } from '@google/generative-ai';
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
 * GROUNDED-STRUCTURED — the schema-constrained production path. Rather than
 * one paragraph where the model has to both decide what to say AND
 * implicitly convey pass/fail through word choice (the entire source of
 * every grounding bug found in this phase — see groundingChecker.ts), each
 * signal gets its own explicit true/false status stated in the PROMPT, and
 * the model's only job per signal is one short, appropriately-toned note.
 * It never has to invent whether something passed — it's told directly.
 */
export const GROUNDED_SUMMARY_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    headline: {
      type: SchemaType.STRING,
      description: 'One warm, encouraging sentence mentioning the overall score out of 100. No other facts.',
    },
    signalNotes: {
      type: SchemaType.ARRAY,
      description: 'Exactly one entry per signal listed in the prompt, in the same order.',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          signalId: { type: SchemaType.STRING, description: 'Must exactly match one of the given signal ids.' },
          note: {
            type: SchemaType.STRING,
            description:
              'ONE short, friendly sentence (max ~20 words) about this specific signal, matching the status you were given for it. No new facts beyond the label/detail provided.',
          },
        },
        required: ['signalId', 'note'],
      },
    },
    closing: {
      type: SchemaType.STRING,
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

For a PASSED signal: write a brief, genuine note of praise or acknowledgment.
For a FAILED signal: write a brief, encouraging note that gently flags the gap and, where natural, a short suggestion — without being discouraging.

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
      (n) => typeof n === 'object' && n !== null && typeof (n as any).signalId === 'string' && typeof (n as any).note === 'string'
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
