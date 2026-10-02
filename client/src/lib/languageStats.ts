import { Repo } from '../api/profile.api';

export interface LanguageShare {
  language: string;
  bytes: number;
  percent: number; // 0-100, rounded to 1 decimal
}

/**
 * Sums each language's byte count across all repos, then converts to a
 * percentage of the total. Pure and deterministic — same repo list always
 * produces the same breakdown, which matters for the same "reproducible,
 * not an LLM guess" story as the Engineering Score.
 */
export function aggregateLanguages(repos: Repo[]): LanguageShare[] {
  const totals = new Map<string, number>();

  for (const repo of repos) {
    for (const [lang, bytes] of Object.entries(repo.language_stats ?? {})) {
      totals.set(lang, (totals.get(lang) ?? 0) + bytes);
    }
  }

  const grandTotal = Array.from(totals.values()).reduce((sum, b) => sum + b, 0);
  if (grandTotal === 0) return [];

  return Array.from(totals.entries())
    .map(([language, bytes]) => ({
      language,
      bytes,
      percent: Math.round((bytes / grandTotal) * 1000) / 10,
    }))
    .sort((a, b) => b.bytes - a.bytes);
}
