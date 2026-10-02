import { StructuredSummary } from './groundingChecker';
import { SignalResult } from '../repoAnalysis/signals';

/**
 * Renders the structured {headline, signalNotes, closing} object into a
 * readable, section-grouped display string. This is TEMPLATE code, not
 * LLM output — the grouping into Strengths/Areas to improve and which
 * signals land in which group is 100% deterministic (from breakdown[i]
 * .passed), so that structure can never be wrong regardless of what the
 * model wrote. Only the short per-signal note text and the headline/
 * closing sentences are the model's words.
 *
 * Kept dependency-free (no db, no express) so it can be shared by both the
 * production service (aiSummary.service.ts) and the Phase 8 experiment
 * script, which has no database connection.
 */
export function renderStructuredSummary(structured: StructuredSummary, breakdown: SignalResult[]): string {
  const noteBySignal = new Map(structured.signalNotes.map((n) => [n.signalId, n.note.trim()]));
  const passed = breakdown.filter((s) => s.passed);
  const failed = breakdown.filter((s) => !s.passed);

  const lines: string[] = [structured.headline.trim()];

  if (passed.length > 0) {
    lines.push('', 'Strengths:');
    for (const s of passed) {
      const note = noteBySignal.get(s.id);
      lines.push(`✓ ${s.label}${note ? ` — ${note}` : ''}`);
    }
  }

  if (failed.length > 0) {
    lines.push('', 'Areas to improve:');
    for (const s of failed) {
      const note = noteBySignal.get(s.id);
      lines.push(`○ ${s.label}${note ? ` — ${note}` : ''}`);
    }
  }

  lines.push('', structured.closing.trim());
  return lines.join('\n');
}
